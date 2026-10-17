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
 * is the sole subscriber and owns what happens next. This view redraws the
 * table pillbox from the model's settings notice; every other load-time-executing wiring
 * (observers, listeners) stays in content.js. Loaded before content.js.
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
// Touch and pen: an expanded pillbox collapses on its own after this delay.
// This view alone reads it, so it lives here and not in the detection
// settings.
const PILLBOX_AUTO_COLLAPSE_MS = 3000;
// The clip test reads at most this many ancestors on its walk from a table up
// to the page body, one style read each, on every reposition. The cap bounds
// that cost per table. Real pages nest a table well under 100 ancestors deep,
// so the cap holds the cost down without cutting the walk short. Ancestors
// past it count as cutting off nothing: a deeper table's pillbox still moves
// with every scroll, and shows wherever its table's corner sits.
const PILLBOX_CLIP_WALK_CAP = 100;
// Overflow values that cut off an element's content at its box.
const CLIPPING_OVERFLOW = new Set(['hidden', 'scroll', 'auto', 'clip']);

// --- Per-table pillbox infrastructure ---

/** WeakMap from HTMLTableElement → HTMLButtonElement (the morph button) */
const tableToggles = new WeakMap();

/** Parallel Set of tracked tables so we can iterate for repositioning */
const trackedTables = new Set();

/** WeakMap from HTMLTableElement → ResizeObserver for the toggle */
const tableResizeObservers = new WeakMap();

// The table pillbox shows the table's on/off value, the same value the
// sidebar pillbox shows, so the two always agree. The press handler in
// content.js reads this value and writes its opposite. A table that is on
// with no cell to simplify still shows on.
function isTableOn(table) {
  return DR_STORE.getTableSettings(table).enabled === true;
}

function syncSwitchForTable(table) {
  const button = tableToggles.get(table);
  if (!button) return;
  button.setAttribute('aria-pressed', isTableOn(table) ? 'true' : 'false');
}

// The table pillbox view redraws the table pillbox from the model's settings notice,
// as the sidebar redraws the sidebar pillbox. The model publishes the notice on every settings write, and
// every write targets the active table, so this subscriber redraws the active
// table's pillbox. The bus delivers the notice to this subscriber in the same
// context, before the controller applies the written settings.
DR_BUS.subscribe('state:settingsChanged', () => {
  const active = DR_STORE.getSelectedTable();
  if (active) syncSwitchForTable(active);
});

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
  `;
  (document.head || document.documentElement).appendChild(style);
  toggleStyleInjected = true;
}

// The pillbox sits in the page body, outside every page area, so the
// positioning hides it while its spot is out of a page area's view. This
// test returns true when the point (x, y), in
// window coordinates, sits outside the box of an ancestor that cuts off its
// content on that axis. The walk stops at the page body, whose overflow the
// window scroll covers, and at PILLBOX_CLIP_WALK_CAP ancestors.
function isPillboxSpotClipped(table, x, y) {
  let el = table.parentElement;
  for (let i = 0; el && el !== document.body && i < PILLBOX_CLIP_WALK_CAP; i++) {
    const style = window.getComputedStyle(el);
    const clipsX = CLIPPING_OVERFLOW.has(style.overflowX);
    const clipsY = CLIPPING_OVERFLOW.has(style.overflowY);
    if (clipsX || clipsY) {
      const box = el.getBoundingClientRect();
      if (clipsX && (x < box.left || x > box.right)) return true;
      if (clipsY && (y < box.top || y > box.bottom)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

function positionToggle(table, buttonEl) {
  const rect = table.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(table);
  // The centre of the dot, which sits over the table's top-right corner.
  const spotX = rect.right + TOGGLE_DOT_OVERHANG_PX - TOGGLE_DOT_PX / 2;
  const spotY = rect.top + TOGGLE_DOT_OVERLAP_PX - TOGGLE_DOT_PX / 2;
  if (
    (rect.width === 0 && rect.height === 0) ||
    computedStyle.display === 'none' ||
    computedStyle.visibility === 'hidden' ||
    isPillboxSpotClipped(table, spotX, spotY)
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
  // isDataTable() reads native tables through NativeTableAdapter and grids
  // through GridAdapter.
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
    }, PILLBOX_AUTO_COLLAPSE_MS);
  }

  // Click handler: mouse/keyboard → immediate press; touch/pen → two-tap
  // expand-then-press. Once a tap or click commits to a press, this view
  // publishes the intent and stops. It calls no content.js function itself.
  // The controller (content.js) is the sole subscriber to intent:toggleTable,
  // and it runs the one press path: make the pressed table active, flip its
  // form, write the table's settings, and send whatever sidebar messaging
  // that implies. This view keeps only the expand/collapse interaction state
  // (view-transient), never the press logic.
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const pType = button.dataset.pointerType;
    if (pType === 'touch' || pType === 'pen') {
      if (!button.classList.contains('expanded')) {
        // First tap: expand without toggling
        button.classList.add('expanded');
        scheduleAutoCollapse();
      } else {
        // Second tap: publish the toggle intent, refresh collapse timer
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

  // View-only bookkeeping: the button element, and the reposition-on-scroll
  // list. DR_STORE's table registry holds the "found" registration.
  tableToggles.set(table, button);
  trackedTables.add(table);
  DR_STORE.registerTable(table);
  // The shape fingerprint, recorded once per registration. Every later
  // action on this table compares the table's shape against this reading
  // first, and a mismatch discards the entry and registers the table fresh
  // (see the controller). The originals port reads a cell's stored
  // pre-simplification text; a table registering holds none, so the read
  // takes the cells as they stand, and the two comparison sites pass the
  // same port so a simplified header cell still compares against this
  // reading.
  DR_STORE.setTableFingerprint(table, readTableFingerprint(table, {
    originalText: (cellEl) => DR_STORE.getTableOriginalText(table, cellEl),
  }));
  DR_LOG.debug("Dynamic Rounding: registered " +
    (table.tagName === 'TABLE' ? 'native table' : 'grid') + ".");

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

// The load-time scan. Pass 1 covers native <table> elements. Pass 2 hands the
// grids to the nomination step in the detection layer (nominateNests), which
// returns one outcome per nest — the same step the added-node pass in
// content.js runs, so one page and one added subtree register the same
// element. This view holds no scan of its own.
//
// Pass 2's outcomes go to the controller (consumeNominations in content.js),
// which registers what the step selected and holds a chain root whose chain is
// empty as a pending table. A pending record is page-held state with a live
// observer in it, and this view holds no such state; routing the outcomes
// through the controller keeps both scanners on one copy of that rule. The
// two files share one scope, and this call runs at DOMContentLoaded, after
// every content script has loaded.
function injectTableToggles() {
  // Pass 1: native <table> elements; accessibility artifacts are skipped.
  document.querySelectorAll('table').forEach(table => {
    if (isPhantomA11yTable(table)) return;
    if (!DR_STORE.hasTable(table)) {
      createToggleForTable(table);
    }
  });
  // Pass 2: the nomination step. createToggleForTable re-runs the data test
  // the step already ran; this view accepts the second read so the detection
  // layer only nominates and this view alone registers.
  consumeNominations(nominateNests(document, { isSeen: DR_STORE.hasTable }));
}

function repositionAllToggles() {
  for (const table of trackedTables) {
    const button = tableToggles.get(table);
    if (button) {
      positionToggle(table, button);
    }
  }
}

// Reposition all tracked toggles on scroll/resize. A scroll event fires on the
// element that scrolled and does not bubble, so the scroll listener runs in
// the capture phase: it runs on a page area's scroll as well as the window's.
// The browser fires at most one scroll event per scrolling element per frame.
let _scrollResizeListenersAdded = false;
function ensureScrollResizeListeners() {
  if (_scrollResizeListenersAdded) return;
  _scrollResizeListenersAdded = true;
  window.addEventListener('scroll', repositionAllToggles, { capture: true, passive: true });
  window.addEventListener('resize', repositionAllToggles, { passive: true });
}

let highlightStyleInjected = false;
function ensureHighlightStyleInjected() {
  if (highlightStyleInjected) return;
  const style = document.createElement('style');
  // The whole-table outline sits inside the table's edge: a page box that
  // cuts off its content at the table's edge, such as a chat page's table
  // card, would cut off an outline drawn outside it.
  style.textContent = `
    @keyframes drExtTargetFlash {
      0%   { outline: 2px solid rgba(66, 133, 244, 0.95); outline-offset: -2px; }
      100% { outline: 2px solid rgba(66, 133, 244, 0);    outline-offset: -2px; }
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
    for (let c = 0; c < cells.length; c++) {
      // The cell's grid column, the same number the engine gates on, so the
      // pulse frames the cells the range actually rounds even where a merge
      // moves a cell away from its position in the row read.
      if (isInRanges(r, cells[c].columnIndex, ranges)) {
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
