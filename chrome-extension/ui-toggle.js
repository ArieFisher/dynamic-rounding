/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Per-table toggle widget UI and table/grid detection (presentation layer).
 *
 * Toggle geometry, style injection, button creation/positioning, the
 * highlight/flash affordances, and the detection predicates (looksLikeGrid,
 * findTargetTable, isDataTable) that decide what counts as a roundable table.
 * Module-level state here is view-transient only — DOM/timer bookkeeping
 * (tableToggles: table → its button element; trackedTables: the
 * reposition-on-scroll list; the resize-observer map; the style-injected
 * flags; the per-button auto-collapse timer) — never selection, sidebar, or
 * "have I found this table" state, which live in DR_STORE (app/store.js).
 * Before the app-model-registry sprint, tableToggles/trackedTables and the
 * dr-ext-grid marker class doubled as three separate "tables found" stores;
 * createToggleForTable now also registers the table with DR_STORE, and
 * every "have I already handled this element" check reads DR_STORE.hasTable
 * instead. tableToggles/trackedTables keep their narrower remaining job: a
 * DOM reference to each table's button, for aria-pressed updates and
 * scroll/resize repositioning. A user action (click/tap) reports an intent
 * on DR_BUS instead of calling a content.js function directly; content.js
 * is the sole subscriber and owns what happens next. All load-time-executing
 * wiring (observers, listeners) stays in content.js. Loaded before content.js.
 */

// Toggle geometry constants
const TOGGLE_DOT_PX = 10;
const TOGGLE_PILL_WIDTH_PX = 28;
const TOGGLE_PILL_HEIGHT_PX = 16;
const TOGGLE_KNOB_PX = 12;
const TOGGLE_KNOB_INSET_PX = 2;
const TOGGLE_KNOB_TRAVEL_PX = TOGGLE_PILL_WIDTH_PX - TOGGLE_KNOB_PX - 2 * TOGGLE_KNOB_INSET_PX;
const TOGGLE_HIT_PAD_PX = 7;
const TOGGLE_DOT_OVERLAP_PX = 8;
const TOGGLE_DOT_OVERHANG_PX = 2;
const TOGGLE_COLOR_ON = '#3d85c6';
const TOGGLE_COLOR_OFF = '#cccccc';
const TOUCH_AUTOCOLLAPSE_MS = 3000;
// Hover text for a locked pill — see tableHasUnrestorableCells. Wording
// mirrors sidebar.js's APPLY_BLOCKED_STATUS_MSG.
const LOCKED_TOGGLE_TITLE = 'This table\'s original values are no longer available. Reload the page to change it.';

// --- Per-table toggle switch infrastructure ---

/** WeakMap from HTMLTableElement → HTMLButtonElement (the morph button) */
const tableToggles = new WeakMap();

/** Parallel Set of tracked tables so we can iterate for repositioning */
const trackedTables = new Set();

/** WeakMap from HTMLTableElement → ResizeObserver for the toggle */
const tableResizeObservers = new WeakMap();

// isTableRounded used to read two page states directly: whether any cell
// carried the dr-ext-rounded class, and whether table.dataset.drShowingOriginal
// was 'true' (issue #245). Both now live in DR_STORE's per-table registry
// entry as a single appliedFlag — 'simplified' only when roundTable actually
// changed a cell and the table isn't currently showing originals.
function isTableRounded(table) {
  return DR_STORE.getTableAppliedFlag(table) === 'simplified';
}

// A locked table (issue #262) shows cells wearing dr-ext-rounded that
// DR_STORE has no original for. Only a content-script re-injection produces
// that pairing (see restoreTable's KNOWN ACCEPTED COST comment in
// content.js): the class survives in the page, the registry did not. Such a
// table is stuck showing simplified text — nothing in this instance can
// restore it, and re-rounding would destroy the title attribute's surviving
// originals — so every control over it renders locked. Evaluated live on
// each sync: if the site re-renders the table with fresh cells, the marker
// class disappears with the old cells and the lock lifts by itself.
function tableHasUnrestorableCells(table) {
  for (const cell of table.querySelectorAll('.dr-ext-rounded')) {
    if (DR_STORE.getTableOriginal(table, cell) === undefined) return true;
  }
  return false;
}

function syncSwitchForTable(table) {
  const button = tableToggles.get(table);
  if (!button) return;
  if (tableHasUnrestorableCells(table)) {
    // The screen shows simplified text (pressed) and no control here can
    // change that (disabled) — see tableHasUnrestorableCells.
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-disabled', 'true');
    button.classList.add('dr-ext-morph-locked');
    button.title = LOCKED_TOGGLE_TITLE;
    return;
  }
  button.removeAttribute('aria-disabled');
  button.classList.remove('dr-ext-morph-locked');
  button.removeAttribute('title');
  button.setAttribute('aria-pressed', isTableRounded(table) ? 'true' : 'false');
}

let toggleStyleInjected = false;
function ensureToggleStyleInjected() {
  if (toggleStyleInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .dr-ext-morph {
      position: absolute;
      z-index: 2147483646;
      display: inline-flex;
      justify-content: flex-end;
      align-items: flex-start;
      padding: ${TOGGLE_HIT_PAD_PX}px;
      background: transparent;
      border: 0;
      cursor: pointer;
      vertical-align: top;
      -webkit-tap-highlight-color: transparent;
    }
    .dr-ext-morph-visible {
      position: relative;
      display: block;
      width: ${TOGGLE_DOT_PX}px;
      height: ${TOGGLE_DOT_PX}px;
      border-radius: 50%;
      background: ${TOGGLE_COLOR_OFF};
      transition: width .18s ease, height .18s ease, border-radius .18s ease, background .2s ease;
    }
    .dr-ext-morph[aria-pressed="true"] .dr-ext-morph-visible {
      background: ${TOGGLE_COLOR_ON};
    }
    .dr-ext-morph-knob {
      position: absolute;
      top: 50%;
      left: ${TOGGLE_KNOB_INSET_PX}px;
      transform: translateY(-50%);
      width: ${TOGGLE_KNOB_PX}px;
      height: ${TOGGLE_KNOB_PX}px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      opacity: 0;
      transition: opacity .12s ease, left .2s ease;
    }
    .dr-ext-morph.expanded .dr-ext-morph-visible,
    .dr-ext-morph:focus-visible .dr-ext-morph-visible {
      width: ${TOGGLE_PILL_WIDTH_PX}px;
      height: ${TOGGLE_PILL_HEIGHT_PX}px;
      border-radius: 999px;
    }
    .dr-ext-morph.expanded .dr-ext-morph-knob,
    .dr-ext-morph:focus-visible .dr-ext-morph-knob {
      opacity: 1;
    }
    .dr-ext-morph.expanded[aria-pressed="true"] .dr-ext-morph-knob,
    .dr-ext-morph:focus-visible[aria-pressed="true"] .dr-ext-morph-knob {
      left: ${TOGGLE_KNOB_INSET_PX + TOGGLE_KNOB_TRAVEL_PX}px;
    }
    @media (hover: hover) and (pointer: fine) {
      .dr-ext-morph:hover .dr-ext-morph-visible {
        width: ${TOGGLE_PILL_WIDTH_PX}px;
        height: ${TOGGLE_PILL_HEIGHT_PX}px;
        border-radius: 999px;
      }
      .dr-ext-morph:hover .dr-ext-morph-knob {
        opacity: 1;
      }
      .dr-ext-morph:hover[aria-pressed="true"] .dr-ext-morph-knob {
        left: ${TOGGLE_KNOB_INSET_PX + TOGGLE_KNOB_TRAVEL_PX}px;
      }
    }
    .dr-ext-morph:focus-visible { outline: 2px solid ${TOGGLE_COLOR_ON}!important; outline-offset: 2px; }
    /* Locked pill (issue #262): dimmed dot, no expand, no knob, explaining
       cursor. These rules sit last so they win the equal-specificity race
       against the hover/expanded/focus-visible rules above. */
    .dr-ext-morph.dr-ext-morph-locked { cursor: not-allowed; }
    .dr-ext-morph.dr-ext-morph-locked .dr-ext-morph-visible {
      width: ${TOGGLE_DOT_PX}px;
      height: ${TOGGLE_DOT_PX}px;
      border-radius: 50%;
      opacity: .55;
    }
    .dr-ext-morph.dr-ext-morph-locked .dr-ext-morph-knob { opacity: 0; }
  `;
  (document.head || document.documentElement).appendChild(style);
  toggleStyleInjected = true;
}

function positionToggle(table, buttonEl) {
  const rect = table.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(table);
  if (
    (rect.width === 0 && rect.height === 0) ||
    computedStyle.display === 'none' ||
    computedStyle.visibility === 'hidden'
  ) {
    buttonEl.style.display = 'none';
    return;
  }
  buttonEl.style.display = '';
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  // Position so the visible's bottom = rect.top + scrollY + TOGGLE_DOT_OVERLAP_PX
  // and the visible's right = rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX.
  // The wrapper has TOGGLE_HIT_PAD_PX padding on every side; with flex-end /
  // flex-start the visible sits inside the wrapper's content box, so its right
  // edge is wrapper.right - padding (not wrapper.right). One padding subtracts
  // from each axis — there is no double-padding term.
  const padding = TOGGLE_HIT_PAD_PX;
  const wrapperLeft = (rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - padding;
  const wrapperTop  = (rect.top   + scrollY + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - padding;
  buttonEl.style.left = wrapperLeft + 'px';
  buttonEl.style.top  = wrapperTop  + 'px';
}

/** Guard so the global tap-outside collapse listener is added only once */
let _globalTapCollapseAdded = false;

function createToggleForTable(table) {
  // For native <table> elements use isDataTable() (via NativeTableAdapter).
  // For div-based grid roots use isDataTable() via GridAdapter now that getRows() is implemented.
  // looksLikeGrid() is no longer used here — it remains available for findTargetTable walk-up.
  if (!isDataTable(table)) return;
  ensureToggleStyleInjected();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dr-ext-morph';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Toggle rounding for table');

  const visible = document.createElement('span');
  visible.className = 'dr-ext-morph-visible';

  const knob = document.createElement('span');
  knob.className = 'dr-ext-morph-knob';

  visible.appendChild(knob);
  button.appendChild(visible);

  (document.body || document.documentElement).appendChild(button);

  setTimeout(() => {
    positionToggle(table, button);
  }, 150);

  // Capture pointer type at pointerdown for use in click handler
  button.addEventListener('pointerdown', (e) => {
    button.dataset.pointerType = e.pointerType || '';
  });

  // Touch auto-collapse timer handle
  let _touchCollapseTimer = null;

  function scheduleAutoCollapse() {
    if (_touchCollapseTimer !== null) clearTimeout(_touchCollapseTimer);
    _touchCollapseTimer = setTimeout(() => {
      button.classList.remove('expanded');
      _touchCollapseTimer = null;
    }, TOUCH_AUTOCOLLAPSE_MS);
  }

  // Click handler: mouse/keyboard → immediate toggle; touch/pen → two-tap
  // expand-then-toggle. Once a tap/click actually commits to a toggle, this
  // view reports the intent and stops — it calls no content.js function
  // itself. The controller (content.js) is the sole subscriber to
  // intent:toggleTable; it decides whether the selection rebinds, runs the
  // toggle, and sends whatever sidebar messaging that implies. This view
  // keeps only the expand/collapse interaction state (view-transient), never
  // the toggle logic.
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    // A locked pill (aria-disabled — see syncSwitchForTable) reports
    // nothing: no expand, no intent. The controller guards the intent too
    // (toggleOriginalValues), but the view must not animate an interaction
    // it will not honor.
    if (button.getAttribute('aria-disabled') === 'true') return;
    const pType = button.dataset.pointerType;
    if (pType === 'touch' || pType === 'pen') {
      if (!button.classList.contains('expanded')) {
        // First tap: expand without toggling
        button.classList.add('expanded');
        scheduleAutoCollapse();
      } else {
        // Second tap: report the toggle intent, refresh collapse timer
        DR_BUS.publish('intent:toggleTable', { table });
        scheduleAutoCollapse();
      }
    } else {
      // Mouse / keyboard (Space is handled natively by <button>; Enter via keydown below)
      DR_BUS.publish('intent:toggleTable', { table });
    }
  });

  // Enter keydown bridge (Space is already handled natively by <button>)
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.stopPropagation(); button.click(); }
  });

  // Stop mousedown propagation to avoid triggering host-page handlers
  button.addEventListener('mousedown', (e) => e.stopPropagation());

  // Store button in WeakMap and table in tracked set (view-only bookkeeping —
  // the button element itself, and the reposition-on-scroll list). The
  // "found" registration these two used to also stand in for now goes
  // through DR_STORE's table registry, the one place that concept lives.
  tableToggles.set(table, button);
  trackedTables.add(table);
  DR_STORE.registerTable(table);

  // Render the initial state through the same sync every later state change
  // uses. On a fresh table this keeps aria-pressed 'false' exactly as set
  // above; on a re-injected page whose table still wears rounded markers
  // (see tableHasUnrestorableCells) the pill must arrive locked-and-selected
  // instead of claiming an unrounded table.
  syncSwitchForTable(table);

  // Set up ResizeObserver for repositioning
  const ro = new ResizeObserver(() => {
    positionToggle(table, button);
  });
  ro.observe(table);
  tableResizeObservers.set(table, ro);

  // Global tap-outside collapse (added once for all toggles)
  if (!_globalTapCollapseAdded) {
    _globalTapCollapseAdded = true;
    document.addEventListener('pointerdown', (e) => {
      document.querySelectorAll('.dr-ext-morph.expanded').forEach((btn) => {
        if (!btn.contains(e.target)) {
          btn.classList.remove('expanded');
        }
      });
    });
  }

  return button;
}

function injectTableToggles() {
  // Pass 1: native <table> elements; phantom a11y tables are skipped.
  document.querySelectorAll('table').forEach(table => {
    if (isPhantomA11yTable(table)) return;
    if (!DR_STORE.hasTable(table)) {
      createToggleForTable(table);
    }
  });
  // Pass 2: cheap ARIA pass — [role="grid"] and [role="table"].
  // Skip elements already found (DR_STORE's table registry) or that
  // contain / are a <table> already handled by pass 1.
  document.querySelectorAll(GRID_ARIA_SELECTOR).forEach(el => {
    if (DR_STORE.hasTable(el)) return;
    if (el.tagName === 'TABLE') return; // handled by pass 1
    if (Array.from(el.querySelectorAll('table')).some(t => !isPhantomA11yTable(t))) return; // contains a real native table — let pass 1 own it
    el.classList.add('dr-ext-grid');
    createToggleForTable(el);
  });
}

// Reposition all tracked toggles on scroll/resize
let _scrollResizeListenersAdded = false;
function ensureScrollResizeListeners() {
  if (_scrollResizeListenersAdded) return;
  _scrollResizeListenersAdded = true;
  window.addEventListener('scroll', () => {
    for (const table of trackedTables) {
      const button = tableToggles.get(table);
      if (button) {
        positionToggle(table, button);
      }
    }
  }, { passive: true });
  window.addEventListener('resize', () => {
    for (const table of trackedTables) {
      const button = tableToggles.get(table);
      if (button) {
        positionToggle(table, button);
      }
    }
  }, { passive: true });
}

let highlightStyleInjected = false;
function ensureHighlightStyleInjected() {
  if (highlightStyleInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes drExtTargetFlash {
      0%   { outline: 2px solid rgba(66, 133, 244, 0.95); outline-offset: 2px; }
      100% { outline: 2px solid rgba(66, 133, 244, 0);    outline-offset: 2px; }
    }
    .dr-ext-target-flash {
      animation: drExtTargetFlash 1s ease-out;
    }
    @keyframes drExtRangePulse {
      0%   { border-color: rgba(255,255,255,0.0);  box-shadow: 0 0 0 2px rgba(66,133,244,0.0); }
      25%  { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 2px rgba(66,133,244,0.6); }
      50%  { border-color: rgba(255,255,255,0.0);  box-shadow: 0 0 0 2px rgba(66,133,244,0.0); }
      75%  { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 2px rgba(66,133,244,0.6); }
      100% { border-color: rgba(255,255,255,0.0);  box-shadow: 0 0 0 2px rgba(66,133,244,0.0); }
    }
    .dr-ext-range-pulse {
      position: absolute;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid rgba(255,255,255,0.0);
      border-radius: 2px;
      box-sizing: border-box;
      animation: drExtRangePulse 0.6s ease-in-out 2;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
  highlightStyleInjected = true;
}

function flashTargetedTable(table) {
  table.classList.remove('dr-ext-target-flash');
  // Force reflow so the animation restarts when re-added.
  void table.offsetWidth;
  table.classList.add('dr-ext-target-flash');
}

/**
 * Pulse a faint blue-and-white border around the operated-on region.
 * - If ranges is null (whole-table mode), delegates to the existing table outline flash.
 * - If ranges is an array, overlays an absolutely-positioned div sized to the bounding
 *   rect of all targeted cells, then removes itself after the animation ends (~1.2s).
 *   The div is appended to document.body so it never wraps or alters td elements.
 *
 * Cell enumeration goes through the same TableAdapter (lib/dr-table, makeAdapter)
 * the rounding engine and preview use, not table.rows/row.cells directly — those
 * only exist on native <table> elements, so reading them here used to throw
 * a TypeError on div-based grids and abort the caller mid-flow. The adapter
 * gives a uniform row/cell view over both native tables and grids.
 */
function flashRangePulse(table, ranges) {
  if (!ranges) {
    // Whole-table mode: reuse the existing outline flash.
    flashTargetedTable(table);
    return;
  }

  // Collect all cells that fall within any of the provided ranges.
  const adapterRows = makeAdapter(table).getRows();
  const matchedCells = [];
  for (let r = 0; r < adapterRows.length; r++) {
    const cells = adapterRows[r].getCells();
    // Literal row number, same as the engine's range gating — the pulse must
    // frame the rows the engine touches (see GridAdapter._getRowEntries).
    const rowIdx = adapterRows[r].literalIndex;
    for (let c = 0; c < cells.length; c++) {
      if (isInRanges(rowIdx, c, ranges)) {
        matchedCells.push(cells[c].el);
      }
    }
  }

  if (matchedCells.length === 0) {
    // No cells matched (e.g. range outside table bounds) — fall back to whole-table flash.
    flashTargetedTable(table);
    return;
  }

  // Compute the union bounding rect of all matched cells relative to the viewport.
  let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
  for (const cell of matchedCells) {
    const rect = cell.getBoundingClientRect();
    if (rect.top    < top)    top    = rect.top;
    if (rect.left   < left)   left   = rect.left;
    if (rect.bottom > bottom) bottom = rect.bottom;
    if (rect.right  > right)  right  = rect.right;
  }

  // Convert to absolute page coordinates so the overlay stays put on scrollable pages.
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const absTop    = top    + scrollY;
  const absLeft   = left   + scrollX;
  const absWidth  = right  - left;
  const absHeight = bottom - top;

  const overlay = document.createElement('div');
  overlay.className = 'dr-ext-range-pulse';
  overlay.style.top    = absTop    + 'px';
  overlay.style.left   = absLeft   + 'px';
  overlay.style.width  = absWidth  + 'px';
  overlay.style.height = absHeight + 'px';

  // Self-cleanup: remove after animation ends or after max 1.5s safety timeout.
  const cleanup = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
  overlay.addEventListener('animationend', cleanup);
  setTimeout(cleanup, 1500);

  (document.body || document.documentElement).appendChild(overlay);
}
