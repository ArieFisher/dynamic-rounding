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
 * Module-level state lives here but all load-time-executing wiring (observers,
 * listeners) stays in content.js. Loaded before content.js.
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

// --- Per-table toggle switch infrastructure ---

/** WeakMap from HTMLTableElement → HTMLButtonElement (the morph button) */
const tableToggles = new WeakMap();

/** Parallel Set of tracked tables so we can iterate for repositioning */
const trackedTables = new Set();

/** WeakMap from HTMLTableElement → ResizeObserver for the toggle */
const tableResizeObservers = new WeakMap();

function isTableRounded(table) {
  return table.querySelector('.dr-ext-rounded') !== null && table.dataset.drShowingOriginal !== 'true';
}

function syncSwitchForTable(table) {
  const button = tableToggles.get(table);
  if (button) {
    button.setAttribute('aria-pressed', isTableRounded(table) ? 'true' : 'false');
  }
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

/**
 * Heuristic test: does `el` look like a data grid built from non-table elements?
 *
 * Applies a cheap-first ladder (S2/S4). Steps 1–5 are pure DOM/CSS reads with no
 * geometry; step 6 (offsetWidth) is guarded by all prior steps and runs only on
 * a bounded sample of column-0 cells.
 *
 * Short-circuit ACCEPT (skip step 6) when el carries:
 *   - role="grid" or role="table"  (ARIA)
 *   - a class containing "dg--" or "ag-"  (known library prefixes)
 *
 * @param {Element} el
 * @returns {boolean}
 */
function looksLikeGrid(el) {
  if (!el || typeof el.children === 'undefined') return false;

  // --- Step 1: Child count ≥ GRID_MIN_CHILDREN ---
  const children = Array.from(el.children);
  if (children.length < GRID_MIN_CHILDREN) return false;

  // --- Step 2: Repetitive structure — children share class or child shape ---
  // "Share class" = majority of children have the same first className token.
  // "Child shape" = most children have the same number of children.
  const classFreq = new Map();
  const childCountFreq = new Map();
  for (const child of children) {
    const cls = (child.className && typeof child.className === 'string')
      ? child.className.trim().split(/\s+/)[0]
      : '';
    classFreq.set(cls, (classFreq.get(cls) || 0) + 1);
    const cc = child.children.length;
    childCountFreq.set(cc, (childCountFreq.get(cc) || 0) + 1);
  }
  const maxClassCount = Math.max(...classFreq.values());
  const maxChildCount = Math.max(...childCountFreq.values());
  // At least half of children must share a class token OR a child count.
  const repetitive = (maxClassCount >= children.length / 2) || (maxChildCount >= children.length / 2);
  if (!repetitive) return false;

  // --- Step 3: Consistent cell count — candidate rows have equal child counts ---
  // The modal child count must appear in at least half of the children.
  let modalChildCount = 0;
  let modalFreq = 0;
  for (const [cc, freq] of childCountFreq) {
    if (freq > modalFreq && cc > 0) { modalFreq = freq; modalChildCount = cc; }
  }
  if (modalFreq < children.length / 2) return false;

  // Candidate rows: children whose child count equals the modal.
  const candidateRows = children.filter(c => c.children.length === modalChildCount);

  // --- Step 4: Layout — display is grid or flex ---
  let display = '';
  if (typeof getComputedStyle === 'function') {
    try { display = getComputedStyle(el).display || ''; } catch (e) { /* ignore */ }
  }
  if (!GRID_DISPLAY_VALUES.has(display)) return false;

  // --- Step 5: Numeric content — ≥ 1 cell parses as a finite number (mandatory) ---
  let hasNumeric = false;
  outer:
  for (const row of candidateRows) {
    for (const cell of Array.from(row.children)) {
      const text = (cell.textContent || '').trim().replace(CLEAN_REGEX, '');
      if (text !== '' && isFinite(parseFloat(text))) { hasNumeric = true; break outer; }
    }
  }
  if (!hasNumeric) return false;

  // --- Short-circuit ACCEPT before geometry probe ---
  const role = el.getAttribute && el.getAttribute('role');
  if (role === 'grid' || role === 'table') return true;
  const elClass = (el.className && typeof el.className === 'string') ? el.className : '';
  if (GRID_LIBRARY_CLASS_TOKENS.some(token => elClass.includes(token))) return true;

  // --- Step 6: Column-width alignment — sample offsetWidth of column-0 cells ---
  // Bounded to GRID_COL_WIDTH_SAMPLE rows; only runs when all prior steps passed.
  const sample = candidateRows.slice(0, GRID_COL_WIDTH_SAMPLE);
  const widths = sample.map(row => row.children[0] ? row.children[0].offsetWidth : -1)
                       .filter(w => w > 0);
  if (widths.length < 2) return true; // too few rows to measure — benefit of the doubt
  const firstWidth = widths[0];
  // Accept when ≥ 80 % of sampled widths match the first.
  const matchCount = widths.filter(w => w === firstWidth).length;
  return matchCount / widths.length >= 0.8;
}

/**
 * Find the best grid/table root for the element `el` was right-clicked inside.
 *
 * Resolution order (per D1 / S6):
 *   1. Nearest <table> ancestor (cheapest, most precise).
 *   2. Nearest ancestor already carrying class dr-ext-grid.
 *   3. Walk UP from el calling looksLikeGrid at each ancestor; return the
 *      OUTERMOST match — keep walking while the parent also passes; stop when
 *      the parent fails, is <body>, or depth exceeds GRID_WALK_DEPTH_CAP.
 *      On a new match: add dr-ext-grid, call createToggleForTable, return it.
 *
 * Returns null if nothing found.
 *
 * @param {Element} el
 * @returns {Element|null}
 */
function findTargetTable(el) {
  if (!el) return null;

  // 1. Nearest <table> ancestor.
  if (typeof el.closest === 'function') {
    const tableAncestor = el.closest('table');
    if (tableAncestor) return tableAncestor;
  }

  // 2. Nearest ancestor already tagged as a grid root.
  if (typeof el.closest === 'function') {
    const existingGrid = el.closest('.dr-ext-grid');
    if (existingGrid) return existingGrid;
  }

  // 3. Walk up, calling looksLikeGrid; return the outermost consecutive match.
  let current = el.parentElement || el.parentNode;
  let depth = 0;
  let outermost = null;

  while (current && current !== document.body && depth < GRID_WALK_DEPTH_CAP) {
    if (current.nodeType !== Node.ELEMENT_NODE) {
      current = current.parentElement || current.parentNode;
      depth++;
      continue;
    }
    if (looksLikeGrid(current)) {
      outermost = current;
      // Keep walking to find the outermost matching container.
    } else if (outermost !== null) {
      // Parent failed — stop; outermost is our answer.
      break;
    }
    current = current.parentElement || current.parentNode;
    depth++;
  }

  if (outermost !== null) {
    if (!outermost.classList.contains('dr-ext-grid')) {
      outermost.classList.add('dr-ext-grid');
      createToggleForTable(outermost);
    }
    return outermost;
  }

  return null;
}

/** Maximum number of cells sampled across grid rows when probing isDataTable for virtual grids. */
const GRID_IS_DATA_TABLE_CELL_SAMPLE = 10;

function isDataTable(table) {
  const adapter = makeAdapter(table);
  const rows = adapter.getRows();
  if (rows.length < 2) return false;
  let hasMultipleColumns = false;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].getCells().length >= 2) {
      hasMultipleColumns = true;
      break;
    }
  }
  if (!hasMultipleColumns) return false;
  // For virtual grids, limit the cell scan to a small sample to avoid probing
  // potentially hundreds of rows. For native tables the loop is cheap.
  const maxCells = adapter.isVirtualized() ? GRID_IS_DATA_TABLE_CELL_SAMPLE : Infinity;
  let cellCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getCells();
    for (let j = 0; j < cells.length; j++) {
      if (cellCount >= maxCells) return false;
      cellCount++;
      const text = cells[j].getText().trim().replace(CLEAN_REGEX, '');
      if (text !== '' && isFinite(parseFloat(text))) return true;
    }
  }
  return false;
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

  // Click handler: mouse/keyboard → immediate toggle; touch/pen → two-tap expand-then-toggle
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const pType = button.dataset.pointerType;
    if (pType === 'touch' || pType === 'pen') {
      if (!button.classList.contains('expanded')) {
        // First tap: expand without toggling
        button.classList.add('expanded');
        scheduleAutoCollapse();
      } else {
        // Second tap: toggle state, refresh collapse timer
        if (sidebarOpen && lastRightClickedTable && table !== lastRightClickedTable) {
          lastRightClickedTable = table;
          try {
            chrome.runtime.sendMessage({ action: 'RESET_SIDEBAR_TO_DEFAULTS' });
          } catch (e) {
            // sidebar may be torn down; harmless
          }
          try {
            chrome.runtime.sendMessage({ action: 'PREVIEW_SAMPLES_CHANGED' });
          } catch (e) {
            // sidebar may be torn down; harmless
          }
        }
        runToggleAction(table);
        syncSwitchForTable(table);
        scheduleAutoCollapse();
      }
    } else {
      // Mouse / keyboard (Space is handled natively by <button>; Enter via keydown below)
      if (sidebarOpen && lastRightClickedTable && table !== lastRightClickedTable) {
        lastRightClickedTable = table;
        try {
          chrome.runtime.sendMessage({ action: 'RESET_SIDEBAR_TO_DEFAULTS' });
        } catch (e) {
          // sidebar may be torn down; harmless
        }
        try {
          chrome.runtime.sendMessage({ action: 'PREVIEW_SAMPLES_CHANGED' });
        } catch (e) {
          // sidebar may be torn down; harmless
        }
      }
      runToggleAction(table);
      syncSwitchForTable(table);
    }
  });

  // Enter keydown bridge (Space is already handled natively by <button>)
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.stopPropagation(); button.click(); }
  });

  // Stop mousedown propagation to avoid triggering host-page handlers
  button.addEventListener('mousedown', (e) => e.stopPropagation());

  // Store button in WeakMap and table in tracked set
  tableToggles.set(table, button);
  trackedTables.add(table);

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
  // Pass 1: native <table> elements (unchanged).
  document.querySelectorAll('table').forEach(table => {
    if (!tableToggles.has(table)) {
      createToggleForTable(table);
    }
  });
  // Pass 2: cheap ARIA pass — [role="grid"] and [role="table"].
  // Skip elements already carrying dr-ext-grid (already handled) or that
  // contain / are a <table> already handled by pass 1.
  document.querySelectorAll(GRID_ARIA_SELECTOR).forEach(el => {
    if (el.classList.contains('dr-ext-grid')) return;
    if (el.tagName === 'TABLE') return; // handled by pass 1
    if (el.querySelector('table')) return; // contains a native table — let pass 1 own it
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
 */
function flashRangePulse(table, ranges) {
  if (!ranges) {
    // Whole-table mode: reuse the existing outline flash.
    flashTargetedTable(table);
    return;
  }

  // Collect all cells that fall within any of the provided ranges.
  const rows = Array.from(table.rows);
  const matchedCells = [];
  for (let r = 0; r < rows.length; r++) {
    const cells = Array.from(rows[r].cells);
    for (let c = 0; c < cells.length; c++) {
      if (isInRanges(r, c, ranges)) {
        matchedCells.push(cells[c]);
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
