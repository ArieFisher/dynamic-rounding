/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// Constants
const CLEAN_REGEX = /[$€£¥,\s%]/g;
const PARENS_REGEX = /^\((.+)\)$/;
const NUMBER_IN_TEXT_REGEX = /-?\d[\d,]*(?:\.\d+)?/;
const NUMBER_IN_TEXT_REGEX_GLOBAL = /-?\d[\d,]*(?:\.\d+)?/g;
const DEFAULT_OFFSET_TOP = -0.5;
const DEFAULT_NUM_TOP = 1;
const VALIDATION_LIMIT = 20;

// Grid detection constants
/** Minimum number of direct children for an element to be a grid candidate. */
const GRID_MIN_CHILDREN = 5;
/** Maximum ancestor depth to walk up during lazy right-click discovery. */
const GRID_WALK_DEPTH_CAP = 15;
/** Number of column-0 cells sampled for column-width alignment check. */
const GRID_COL_WIDTH_SAMPLE = 10;
/** CSS display values that indicate a grid/flex layout. */
const GRID_DISPLAY_VALUES = new Set(['grid', 'flex', 'inline-grid', 'inline-flex']);
/** Library class substrings that short-circuit the geometry probe. */
const GRID_LIBRARY_CLASS_TOKENS = ['dg--', 'ag-'];
/** CSS selector for the cheap proactive ARIA pass. */
const GRID_ARIA_SELECTOR = '[role="grid"], [role="table"]';
/** Debounce delay (ms) for the grid virtualization re-apply observer. */
const GRID_REAPPLY_DEBOUNCE_MS = 100;
// EPSILON, X_FLOOR_THRESHOLD, roundWithOffset, and roundCellSetAware live in
// rounding.js (loaded by manifest content_scripts ahead of this file) so the
// sidebar can call the same arithmetic for its preview band.

// --- TableAdapter abstraction ---
// Two adapter classes provide a uniform row/cell interface over both native
// <table> elements and div-based virtual grids. The four engine functions
// (isDataTable, roundTable, resetTable, extractPreviewSamples) consume only
// the adapter API; they never touch .rows/.cells directly.

class NativeTableAdapter {
  constructor(el) {
    this.el = el;
  }
  getElement() { return this.el; }
  isVirtualized() { return false; }
  getRows() {
    return Array.from(this.el.rows).map(row => ({
      getCells() {
        return Array.from(row.cells).map(cell => ({
          getText() { return cell.innerText || cell.textContent || ''; },
          setText(s) {
            cell.dataset.originalHtml = cell.innerHTML;
            cell.textContent = s;
          },
          el: cell,
          tagName: cell.tagName,
        }));
      },
    }));
  }
}

/**
 * Depth-first search returning the deepest non-empty Text node
 * (nodeType === 3, non-whitespace nodeValue) under cellEl.
 * Returns null if no such node exists.
 * @param {Element} cellEl
 * @returns {Text|null}
 */
function findCellTextNode(cellEl) {
  if (!cellEl) return null;
  // Walk depth-first; track the deepest non-empty text node found.
  let best = null;
  function visit(node) {
    if (node.nodeType === 3) {
      // Text node
      if (node.nodeValue && node.nodeValue.trim() !== '') {
        best = node;
      }
      return;
    }
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        visit(node.childNodes[i]);
      }
    }
  }
  visit(cellEl);
  return best;
}

/** CSS class applied to rounded grid cells (same class used by native-table path). */
const GRID_ROUNDED_CLASS = 'dr-ext-rounded';

class GridAdapter {
  constructor(el) {
    this.el = el;
  }
  getElement() { return this.el; }
  isVirtualized() { return true; }

  /**
   * Return the scroll container for this grid.
   * Priority: known library selectors → else this.el.
   */
  _getScrollContainer() {
    const el = this.el;
    // Known library selectors (single-pane Databricks, AG Grid, etc.)
    const knownSelectors = [
      '.dg--grid-scroll-container',
      '.dg--grid-container',
      '.ag-center-cols-viewport',
      '[role="grid"]',
    ];
    for (const sel of knownSelectors) {
      const found = el.querySelector && el.querySelector(sel);
      if (found) return found;
    }
    // Check if the element itself matches a known selector
    if (el.matches) {
      for (const sel of knownSelectors) {
        try {
          if (el.matches(sel)) return el;
        } catch (e) { /* ignore */ }
      }
    }
    return el;
  }

  /**
   * Find the pinned pane sibling, if any.
   * Returns null for single-pane grids (Databricks).
   */
  _getPinnedPane(scrollContainer) {
    const pinnedSelectors = [
      '.dg--pinned-grid',
      '.ag-pinned-left-cols-container',
    ];
    const el = this.el;
    for (const sel of pinnedSelectors) {
      const found = el.querySelector && el.querySelector(sel);
      if (found && found !== scrollContainer) return found;
    }
    return null;
  }

  /**
   * Extract rows from a container element.
   * Prefers [role="row"] / .dg--virtual-row; else repetitive children.
   * @param {Element} container
   * @returns {Element[]}
   */
  _getRowEls(container) {
    if (!container) return [];
    // Try ARIA/library rows first
    let rows = container.querySelectorAll && container.querySelectorAll('[role="row"]');
    if (rows && rows.length > 0) return Array.from(rows);
    rows = container.querySelectorAll && container.querySelectorAll('.dg--virtual-row');
    if (rows && rows.length > 0) return Array.from(rows);
    // Fallback: repetitive children (direct children only)
    if (container.children) return Array.from(container.children);
    return [];
  }

  /**
   * Extract cell elements from a row element.
   * Prefers [role="cell"] / .dg--cell; else repetitive children.
   * (The legacy role "gridcell" is NOT used — per spike amendment 2, only role="cell" is correct.)
   * @param {Element} rowEl
   * @returns {Element[]}
   */
  _getCellEls(rowEl) {
    if (!rowEl) return [];
    let cells = rowEl.querySelectorAll && rowEl.querySelectorAll('[role="cell"]');
    if (cells && cells.length > 0) return Array.from(cells);
    cells = rowEl.querySelectorAll && rowEl.querySelectorAll('.dg--cell');
    if (cells && cells.length > 0) return Array.from(cells);
    // Fallback: direct children
    if (rowEl.children) return Array.from(rowEl.children);
    return [];
  }

  /**
   * Get the row key from a row element for pinned-pane stitching.
   * Prefers data-row, then data-index.
   * @param {Element} rowEl
   * @param {number} domIndex
   * @returns {string}
   */
  _getRowKey(rowEl, domIndex) {
    if (rowEl.dataset) {
      if (rowEl.dataset.row !== undefined) return rowEl.dataset.row;
      if (rowEl.dataset.index !== undefined) return rowEl.dataset.index;
    }
    return String(domIndex);
  }

  /**
   * Build a cell object compatible with the NativeTableAdapter cell shape.
   * setText uses nodeValue patching — never textContent/innerHTML/appendChild/removeChild.
   * @param {Element} cellEl
   * @returns {{getText(): string, setText(s: string): void, el: Element, tagName: string}}
   */
  _makeCellObj(cellEl) {
    return {
      el: cellEl,
      tagName: 'TD', // grid cells are treated as data cells (no <th> concept)
      getText() {
        // Prefer the stored original (if already rounded), else live text
        if (cellEl.dataset && cellEl.dataset.drOriginal !== undefined) {
          return cellEl.dataset.drOriginal;
        }
        const tn = findCellTextNode(cellEl);
        return tn ? tn.nodeValue : (cellEl.textContent || '');
      },
      setText(s) {
        const tn = findCellTextNode(cellEl);
        if (tn === null) return; // no-op: cell has no text node to patch
        // Store the original value on the cell element once.
        if (cellEl.dataset && cellEl.dataset.drOriginal === undefined) {
          cellEl.dataset.drOriginal = tn.nodeValue;
        }
        // Patch in place — NEVER replace the node (preserves React fiber identity).
        tn.nodeValue = s;
        if (cellEl.classList) cellEl.classList.add(GRID_ROUNDED_CLASS);
      },
    };
  }

  /**
   * Return stitched rows from the grid: pinned cells first, then scroll cells.
   * Each row exposes getCells() → array of cell objects.
   */
  getRows() {
    const scrollContainer = this._getScrollContainer();
    const pinnedPane = this._getPinnedPane(scrollContainer);

    const scrollRows = this._getRowEls(scrollContainer);
    if (scrollRows.length === 0) return [];

    // Build a map from row-key → pinned row element for efficient stitching.
    let pinnedRows = [];
    const pinnedByKey = new Map();
    if (pinnedPane) {
      pinnedRows = this._getRowEls(pinnedPane);
      pinnedRows.forEach((pr, idx) => {
        const key = this._getRowKey(pr, idx);
        pinnedByKey.set(key, pr);
      });
    }

    const adapter = this;
    return scrollRows.map((rowEl, idx) => {
      const scrollKey = adapter._getRowKey(rowEl, idx);
      // Find the matching pinned row (by data-row / data-index / DOM index).
      let pinnedRowEl = pinnedByKey.get(scrollKey) || (pinnedRows[idx] || null);

      return {
        getCells() {
          const cells = [];
          // Pinned cells first (if any pinned pane exists).
          if (pinnedRowEl) {
            const pinnedCellEls = adapter._getCellEls(pinnedRowEl);
            for (const cellEl of pinnedCellEls) {
              cells.push(adapter._makeCellObj(cellEl));
            }
          }
          // Scroll cells.
          const scrollCellEls = adapter._getCellEls(rowEl);
          for (const cellEl of scrollCellEls) {
            cells.push(adapter._makeCellObj(cellEl));
          }
          return cells;
        },
      };
    });
  }
}

/**
 * Factory: returns a NativeTableAdapter for <table> elements, GridAdapter otherwise.
 * Adapters are ephemeral (never cached) — grids change row count on scroll.
 *
 * Duck-typing fallback: plain objects with a `rows` property (e.g. test stubs)
 * are treated as native tables since they expose the same row/cell interface.
 */
function makeAdapter(el) {
  if (el.tagName === 'TABLE' || (el.tagName === undefined && el.rows)) {
    return new NativeTableAdapter(el);
  }
  return new GridAdapter(el);
}

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

// DR_DEFAULTS is loaded from defaults.js (declared first in manifest content_scripts).
// It is shared with sidebar.js so the sidebar UI's initial state and the
// right-click toggle's fallback options come from a single source.

let lastRightClickedElement = null;
// Widened contract: may hold a <table> element OR a div-based grid root (any
// element carrying class dr-ext-grid or returned by findTargetTable). All
// callers that previously assumed HTMLTableElement must tolerate any Element.
let lastRightClickedTable = null;
let sidebarOpen = false;

// Per-table memory of the options used for the most recent roundTable() run.
// Consulted by toggleOriginalValues() when re-running the pipeline so that the
// "toggle back to rounded" path uses the same parameters as the original render.
const tableOptions = new WeakMap();

// Grid virtualization re-apply state.
// gridObservers: wrapperEl → MutationObserver watching the scroll container.
// gridReapplyTimers: wrapperEl → pending setTimeout id for the debounced re-apply.
const gridObservers = new WeakMap();
const gridReapplyTimers = new WeakMap();

document.addEventListener('contextmenu', (event) => {
  lastRightClickedElement = event.target;
  const table = findTargetTable(event.target);
  if (table) {
    lastRightClickedTable = table;
  }
}, true);

function runToggleAction(table) {
  ensureHighlightStyleInjected();
  if (!table.querySelector('.dr-ext-rounded')) {
    roundTable(table);
    chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Toggle readable data' });
  } else {
    toggleOriginalValues(table);
    chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Toggle readable data' });
  }
  // Context menu has no range expression → whole-table pulse (ranges null).
  flashRangePulse(table, null);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'MENU_CLICKED') {
    if (lastRightClickedElement) {
      const table = findTargetTable(lastRightClickedElement);
      if (table) {
        runToggleAction(table);
      } else {
        console.debug("Dynamic Rounding: No table found at right-click location.");
      }
    }
    return;
  }

  if (request.action === 'SIDEBAR_OPENED') {
    sidebarOpen = true;
    if (lastRightClickedTable) {
      requestSidebarSettingsAndApply(lastRightClickedTable);
      // Tell the sidebar its cached preview samples are stale; it will re-pull
      // GET_PREVIEW_SAMPLES against the now-current targeted table.
      try {
        chrome.runtime.sendMessage({ action: 'PREVIEW_SAMPLES_CHANGED' });
      } catch (e) {
        // sidebar may not be open yet; harmless
      }
    } else {
      console.debug("Dynamic Rounding: No table targeted. Right-click a table cell first.");
    }
    return;
  }

  if (request.action === 'CLOSE_SIDEBAR') {
    sidebarOpen = false;
    return;
  }

  if (request.action === 'APPLY_SIDEBAR_SETTINGS') {
    if (lastRightClickedTable) {
      applySidebarRounding(lastRightClickedTable, request.settings || DR_DEFAULTS);
    }
    return;
  }

  if (request.action === 'GET_PREVIEW_SAMPLES') {
    if (lastRightClickedTable) {
      const payload = extractPreviewSamples(lastRightClickedTable);
      sendResponse(payload);
    } else {
      sendResponse({ samples: null, maxMag: null });
    }
    return;
  }
});

window.addEventListener('pagehide', () => {
  try {
    chrome.runtime.sendMessage({ action: 'PAGE_UNLOADED' });
  } catch (e) {
    // extension context may already be gone
  }
});

// Ask the sidebar for its current UI state, then apply. The sidebar may not
// have finished loading when SIDEBAR_OPENED fires from the background, so we
// retry a few times before falling back to defaults.
function requestSidebarSettingsAndApply(table, attempt = 0) {
  chrome.runtime.sendMessage({ action: 'GET_SIDEBAR_SETTINGS' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.settings) {
      if (attempt < 10) {
        setTimeout(() => requestSidebarSettingsAndApply(table, attempt + 1), 50);
      } else {
        applySidebarRounding(table, DR_DEFAULTS);
      }
      return;
    }
    applySidebarRounding(table, response.settings);
  });
}

function applySidebarRounding(table, options) {
  const opts = Object.assign({}, DR_DEFAULTS, options || {});
  ensureHighlightStyleInjected();
  resetTable(table);
  if (opts.enabled !== false) {
    roundTable(table, opts);
    if (table.querySelector('.dr-ext-rounded')) {
      chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Toggle readable data' });
    }
  } else {
    chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Toggle readable data' });
  }
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  flashRangePulse(table, rangeParse.error ? null : rangeParse.ranges);
  syncSwitchForTable(table);
}

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

if (typeof MutationObserver !== 'undefined') {
  ensureScrollResizeListeners();

  // MutationObserver to watch for dynamically added/removed tables and grids
  const _tableObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // Pass 1: native <table> elements (unchanged).
        if (node.tagName === 'TABLE' && !tableToggles.has(node)) {
          createToggleForTable(node);
        }
        if (typeof node.querySelectorAll === 'function') {
          node.querySelectorAll('table').forEach(table => {
            if (!tableToggles.has(table)) {
              createToggleForTable(table);
            }
          });
          // Pass 2: cheap ARIA pass for added nodes — mirror injectTableToggles Pass 2.
          node.querySelectorAll(GRID_ARIA_SELECTOR).forEach(el => {
            if (el.classList.contains('dr-ext-grid')) return;
            if (el.tagName === 'TABLE') return;
            if (el.querySelector('table')) return;
            el.classList.add('dr-ext-grid');
            createToggleForTable(el);
          });
        }
        // The added node itself may be a [role="grid"/"table"] non-table element.
        if (node.tagName !== 'TABLE' && typeof node.matches === 'function' &&
            node.matches(GRID_ARIA_SELECTOR) && !node.classList.contains('dr-ext-grid')) {
          if (!node.querySelector('table')) {
            node.classList.add('dr-ext-grid');
            createToggleForTable(node);
          }
        }
      }
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // Handle removed table nodes and grid roots.
        const tablesToRemove = [];
        if (node.tagName === 'TABLE') {
          tablesToRemove.push(node);
        }
        if (typeof node.querySelectorAll === 'function') {
          node.querySelectorAll('table').forEach(t => tablesToRemove.push(t));
          // Also collect removed grid roots.
          node.querySelectorAll('.dr-ext-grid').forEach(g => tablesToRemove.push(g));
        }
        // The removed node itself may be a grid root.
        if (node.classList && node.classList.contains('dr-ext-grid')) {
          tablesToRemove.push(node);
        }
        for (const table of tablesToRemove) {
          const button = tableToggles.get(table);
          if (button && button.parentElement) {
            button.parentElement.removeChild(button);
          }
          const ro = tableResizeObservers.get(table);
          if (ro) {
            ro.disconnect();
          }
          // Tear down any grid virtualization observer and pending debounce timer
          // so removed grids don't re-apply rounding after they leave the DOM.
          const pendingTimer = gridReapplyTimers.get(table);
          if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer);
            gridReapplyTimers.delete(table);
          }
          const gridObs = gridObservers.get(table);
          if (gridObs) {
            gridObs.disconnect();
            gridObservers.delete(table);
          }
          trackedTables.delete(table);
        }
      }
    }
  });

  // Start injecting toggles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectTableToggles();
      if (document.body) {
        _tableObserver.observe(document.body, { childList: true, subtree: true });
      }
    });
  } else {
    injectTableToggles();
    if (document.body) {
      _tableObserver.observe(document.body, { childList: true, subtree: true });
    }
  }
}

// --- End per-table toggle switch infrastructure ---

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

function resetTable(table) {
  // --- Grid virtualization teardown (must happen BEFORE cell restore) ---
  // Clear any pending debounce timer so a queued re-apply cannot fire after reset.
  const pendingTimer = gridReapplyTimers.get(table);
  if (pendingTimer !== undefined) {
    clearTimeout(pendingTimer);
    gridReapplyTimers.delete(table);
  }
  // Disconnect the scroll/sort observer so it stops watching the scroll container.
  const gridObserver = gridObservers.get(table);
  if (gridObserver) {
    gridObserver.disconnect();
    gridObservers.delete(table);
  }
  // Also clear the stored options so reapplyGridRounding (if somehow still
  // in-flight) will bail out harmlessly when it finds no opts.
  tableOptions.delete(table);

  const roundedCells = table.querySelectorAll('.dr-ext-rounded');
  for (const cell of roundedCells) {
    // Grid cells are reset via nodeValue patching (drOriginal is set by GridAdapter.setText).
    // Native-table cells are reset via innerHTML (originalHtml is set by NativeTableAdapter.setText).
    if (cell.dataset.drOriginal !== undefined) {
      // Grid path: restore the original text node value in place (preserves node identity).
      const tn = findCellTextNode(cell);
      if (tn !== null) {
        tn.nodeValue = cell.dataset.drOriginal;
      }
      cell.classList.remove(GRID_ROUNDED_CLASS);
      delete cell.dataset.drOriginal;
    } else {
      // Native-table path: restore full HTML (supports mixed/extracted cells).
      if (cell.dataset.originalHtml !== undefined) {
        cell.innerHTML = cell.dataset.originalHtml;
      }
      cell.classList.remove('dr-ext-rounded');
      delete cell.dataset.originalValue;
      delete cell.dataset.originalHtml;
      cell.removeAttribute('title');
    }
  }
  delete table.dataset.drShowingOriginal;
  syncSwitchForTable(table);
}

// --- Preview-band sample extraction (consumed by sidebar via IPC) ---

// Walk every <td> in the table and return its trimmed text + parsed number, but
// only for cells whose entire content parses as a single number (mode 'pure'
// in roundTable's classifier). Cells matched only via simplifyMixedCells / dates /
// times are intentionally skipped here — they're deferred to a future sprint.
function collectNumericCells(table) {
  const out = [];
  const rows = makeAdapter(table).getRows();
  for (const row of rows) {
    const cells = row.getCells();
    for (const cellObj of cells) {
      if (cellObj.tagName !== 'TD') continue;
      const text = cellObj.getText();
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) continue;
      if (isDateLike(trimmed) || isTimeLike(trimmed)) continue;
      if (/^(19|20)\d{2}$/.test(trimmed)) continue;
      const num = toNumber(trimmed);
      if (num === null || num === 0 || !isFinite(num)) continue;
      out.push({ text: trimmed, num });
    }
  }
  return out;
}

// Pick up to 2 large-magnitude + 3 smaller-magnitude representative samples
// for the sidebar preview band. Bucketed by magnitude (floor(log10|num|)) so
// the band shows the actual offset_top vs offset_other split that
// roundCellSetAware will apply to the table.
function extractPreviewSamples(table) {
  const cells = collectNumericCells(table);
  if (cells.length === 0) {
    return { samples: { top: [], bottom: [] }, maxMag: null };
  }
  const numTop = DR_DEFAULTS.numTop || 1;

  const byMag = new Map();
  let maxMag = null;
  for (const c of cells) {
    const mag = Math.floor(Math.log10(Math.abs(c.num)));
    if (maxMag === null || mag > maxMag) maxMag = mag;
    if (!byMag.has(mag)) byMag.set(mag, []);
    byMag.get(mag).push(c);
  }

  // Top band: cells whose magnitude is within numTop of maxMag (i.e. cells
  // that roundCellSetAware will route to offset_top). Pick up to 2; prefer
  // distinct magnitudes.
  const topMags = Array.from(byMag.keys())
    .filter(m => (maxMag - m) < numTop)
    .sort((a, b) => b - a);
  const top = [];
  for (const m of topMags) {
    if (top.length >= 2) break;
    top.push(byMag.get(m)[0]);
  }
  if (top.length < 2 && topMags.length > 0) {
    // Same magnitude has multiple cells — fill from the top bucket.
    const bucket = byMag.get(topMags[0]);
    for (let i = 1; i < bucket.length && top.length < 2; i++) {
      top.push(bucket[i]);
    }
  }

  // Bottom band: remaining magnitudes, one per bucket, descending. If <3
  // distinct buckets remain, fill from the largest remaining bucket.
  const bottomMags = Array.from(byMag.keys())
    .filter(m => (maxMag - m) >= numTop)
    .sort((a, b) => b - a);
  const bottom = [];
  for (const m of bottomMags) {
    if (bottom.length >= 3) break;
    bottom.push(byMag.get(m)[0]);
  }
  if (bottom.length < 3 && bottomMags.length > 0) {
    const bucket = byMag.get(bottomMags[0]);
    for (let i = 1; i < bucket.length && bottom.length < 3; i++) {
      bottom.push(bucket[i]);
    }
  }

  const toRow = c => ({ original: c.text, num: c.num });
  return {
    samples: { top: top.map(toRow), bottom: bottom.map(toRow) },
    maxMag,
  };
}

/**
 * Compute the rounded/formatted value that rounding WOULD produce for a single
 * grid cell whose current live text is `text`, given the table-level parameters
 * already derived from all visible cells (`max_mag`, `floorDecimals`).
 *
 * Returns the formatted string if rounding would produce a different value, or
 * null if the cell should be left unchanged (skipped, not a number, etc.).
 *
 * This is the shared per-cell logic reused by both `roundTable` (initial pass)
 * and `reapplyGridRounding` (scroll/sort re-apply). Keeping it in one place
 * ensures the two passes can never diverge.
 *
 * NOTE: mode:'extracted' (mixed text with embedded numbers) is intentionally
 * skipped on grids — that path requires innerHTML writes which are incompatible
 * with the nodeValue-only write model.
 *
 * @param {string} text          - The cell's current live text value.
 * @param {object} opts          - Resolved rounding options (from tableOptions).
 * @param {number} max_mag       - Maximum magnitude computed from all visible cells.
 * @param {number} floorDecimals - Decimal floor derived from offset parameters.
 * @returns {string|null}
 */
function computeGridCellRoundedValue(text, opts, max_mag, floorDecimals) {
  const offsetTop = resolveOffset(opts.offsetTop, DEFAULT_OFFSET_TOP);
  const offsetOther = resolveOffset(opts.offsetOther, offsetTop);
  const numTop = resolveNumTop(opts.numTop, DEFAULT_NUM_TOP);

  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return null;

  // Whole-cell quote short-circuit.
  const isWholeCellQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') &&
    (trimmed.match(/"/g) || []).length === 2;
  if (isWholeCellQuoted) return null;

  if (isDateLike(trimmed)) {
    if (!opts.simplifyDates) return null;
    const result = roundDateText(trimmed, opts.dateGranularity);
    if (result === null || result === trimmed) return null;
    return result;
  }

  if (isTimeLike(trimmed)) {
    if (!opts.simplifyTimes) return null;
    const result = roundTimeText(trimmed, opts.timeGranularity);
    if (result === null || result === trimmed) return null;
    return result;
  }

  const num = toNumber(text);
  if (num === null) return null;

  const roundedValue = roundCellSetAware(num, num, max_mag, offsetTop, offsetOther, numTop);
  const formattedValue = restoreFormatting(roundedValue, text, floorDecimals);
  if (formattedValue === trimmed) return null;
  return formattedValue;
}

/**
 * Re-apply grid rounding to all currently-visible cells of `wrapperEl`.
 * Called by the debounced MutationObserver after scroll or sort events.
 *
 * Guards against infinite re-triggering by disconnecting the grid's observer
 * for the duration of the write pass and reconnecting after.
 *
 * @param {Element} wrapperEl - The grid wrapper element (key into tableOptions).
 */
function reapplyGridRounding(wrapperEl) {
  // Clear the stored timer reference (it has already fired).
  gridReapplyTimers.delete(wrapperEl);

  const observer = gridObservers.get(wrapperEl);

  // Disconnect FIRST — our own nodeValue writes fire characterData mutations;
  // without this guard we enter an infinite re-apply loop.
  if (observer) observer.disconnect();

  const opts = tableOptions.get(wrapperEl);
  if (!opts) {
    // Table has been reset/removed — reconnect (no-op write) and bail.
    if (observer) {
      const scrollContainer = new GridAdapter(wrapperEl)._getScrollContainer();
      observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
    }
    return;
  }

  const offsetTop = resolveOffset(opts.offsetTop, DEFAULT_OFFSET_TOP);
  const offsetOther = resolveOffset(opts.offsetOther, offsetTop);
  const floorDecimals = Math.max(decimalCount(offsetTop), decimalCount(offsetOther));

  // Pass 1: collect all current visible numeric values to compute max_mag
  // (set-aware rounding: the same logic as the initial roundTable pass).
  const currentAdapter = makeAdapter(wrapperEl);
  const rows = currentAdapter.getRows();
  const allNums = [];
  for (const row of rows) {
    for (const cellObj of row.getCells()) {
      if (cellObj.tagName !== 'TD') continue;
      const tn = findCellTextNode(cellObj.el);
      const text = tn ? tn.nodeValue : (cellObj.el.textContent || '');
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed || isDateLike(trimmed) || isTimeLike(trimmed)) continue;
      const num = toNumber(text);
      if (num !== null) allNums.push(num);
    }
  }
  const max_mag = findMaxMagnitude([allNums]);

  // Pass 2: for each cell, compute what rounding would produce from opts;
  // re-apply via nodeValue if the current live value differs.
  for (const row of rows) {
    for (const cellObj of row.getCells()) {
      if (cellObj.tagName !== 'TD') continue;
      const tn = findCellTextNode(cellObj.el);
      if (!tn) continue;
      const currentValue = tn.nodeValue;
      const rounded = computeGridCellRoundedValue(currentValue, opts, max_mag, floorDecimals);
      if (rounded !== null && currentValue !== rounded) {
        // Store original if not already stored (freshly-recycled row).
        if (cellObj.el.dataset && cellObj.el.dataset.drOriginal === undefined) {
          cellObj.el.dataset.drOriginal = currentValue;
        }
        tn.nodeValue = rounded;
        if (cellObj.el.classList) cellObj.el.classList.add(GRID_ROUNDED_CLASS);
      }
    }
  }

  // Reconnect the observer after the write pass.
  if (observer) {
    const scrollContainer = new GridAdapter(wrapperEl)._getScrollContainer();
    observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
  }
}

function roundTable(table, options) {
  const opts = Object.assign({}, DR_DEFAULTS, options || {});
  tableOptions.set(table, opts);
  const offsetTop = resolveOffset(opts.offsetTop, DEFAULT_OFFSET_TOP);
  const offsetOther = resolveOffset(opts.offsetOther, offsetTop);
  const numTop = resolveNumTop(opts.numTop, DEFAULT_NUM_TOP);
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  if (rangeParse.error) {
    chrome.runtime.sendMessage({ action: 'RANGE_ERROR', error: rangeParse.error });
    return;
  }
  chrome.runtime.sendMessage({ action: 'RANGE_OK' });
  const ranges = rangeParse.ranges;
  const adapter = makeAdapter(table);
  const adapterRows = adapter.getRows();
  // Clean stub path: if the adapter returns no rows (e.g. GridAdapter stub),
  // return early without throwing.
  if (adapterRows.length === 0) return;
  const isVirtualized = adapter.isVirtualized();
  const data = [];
  // For native tables, cellsMap stores raw element. For grid tables, cellsMap
  // stores the full cellObj so the write pass can call cellObj.setText().
  const cellsMap = [];
  const cellInfo = [];

  for (let r = 0; r < adapterRows.length; r++) {
    const adapterCells = adapterRows[r].getCells();
    const rowData = [];
    const rowCells = [];
    const rowInfo = [];
    let dataCol = 0;
    for (let c = 0; c < adapterCells.length; c++) {
      const cellObj = adapterCells[c];
      const cell = cellObj.el;
      // Skip <th> row-header cells entirely — they are not data columns.
      if (cellObj.tagName !== 'TD') continue;
      const col = dataCol++;
      const text = cellObj.getText();
      rowData.push(text);
      // Carry the full cellObj for grid adapters so the write pass can call
      // cellObj.setText(); for native adapters carry the raw element (unchanged).
      rowCells.push(isVirtualized ? cellObj : cell);

      const trimmed = typeof text === 'string' ? text.trim() : '';
      // Whole-cell quote short-circuit: if the entire cell content is a single
      // balanced ASCII double-quoted span, skip it entirely (no numbers to round).
      const isWholeCellQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') &&
        (trimmed.match(/"/g) || []).length === 2;

      if (!isInRanges(r, col, ranges)) {
        rowInfo.push({ mode: 'skip' });
      } else if (getExclusionReason(text, col, opts, r)) {
        rowInfo.push({ mode: 'skip' });
      } else if (isWholeCellQuoted) {
        rowInfo.push({ mode: 'skip' });
      } else if (isDateLike(trimmed)) {
        // Date-like cells must never fall through to numeric rounding (a bare
        // year like "2018" parses as a number). Simplify when the toggle is on,
        // otherwise leave the cell untouched.
        if (!opts.simplifyDates) {
          rowInfo.push({ mode: 'skip' });
        } else {
          const ambig = parseAmbiguousNumericDate(trimmed);
          if (ambig !== null) {
            rowInfo.push({ mode: 'date', ambiguous: ambig });
          } else {
            // Unambiguous: parse now and store the resolved fields
            const parsed = parseDateLike(trimmed);
            rowInfo.push({ mode: 'date', month: parsed.month, day: parsed.day, year: parsed.year });
          }
        }
      } else if (isTimeLike(trimmed)) {
        // Same guard for time-like cells.
        rowInfo.push(opts.simplifyTimes ? { mode: 'time' } : { mode: 'skip' });
      } else {
        const num = toNumber(text);
        if (num !== null) {
          // Whole-cell link check: if the entire visible text is inside <a> tags, skip.
          if (isCellWholeLink(cell)) {
            rowInfo.push({ mode: 'skip' });
          } else if (cell.querySelector && cell.querySelector('sup')) {
            // The cell contains a <sup> element: the flattened text mixes base and exponent
            // digits (e.g. "10<sup>12</sup>" -> innerText "1012").  Route through the
            // inline-extraction path so superscript masking can protect the exponent.
            if (opts.simplifyMixedCells) {
              let matches = extractNumbersInText(text);
              matches = filterLinkMatches(cell, matches);
              const quoteRanges = getQuoteMaskedRanges(text);
              if (quoteRanges.length > 0) {
                matches = matches.filter(m => !overlapsQuoteRange(quoteRanges, m.index, m.index + m.numStr.length));
              }
              const superRanges = getSuperscriptRanges(cell);
              if (superRanges.length > 0) {
                matches = matches.filter(m => !overlapsQuoteRange(superRanges, m.index, m.index + m.numStr.length));
              }
              if (matches.length > 0) {
                rowInfo.push({ mode: 'extracted', matches });
              } else {
                rowInfo.push({ mode: 'skip' });
              }
            } else {
              rowInfo.push({ mode: 'skip' });
            }
          } else {
            rowInfo.push({ mode: 'pure', num });
          }
        } else if (opts.simplifyMixedCells) {
          let matches = extractNumbersInText(text);
          matches = filterLinkMatches(cell, matches);
          const quoteRanges = getQuoteMaskedRanges(text);
          if (quoteRanges.length > 0) {
            matches = matches.filter(m => !overlapsQuoteRange(quoteRanges, m.index, m.index + m.numStr.length));
          }
          const superRanges = getSuperscriptRanges(cell);
          if (superRanges.length > 0) {
            matches = matches.filter(m => !overlapsQuoteRange(superRanges, m.index, m.index + m.numStr.length));
          }
          if (matches.length > 0) {
            rowInfo.push({ mode: 'extracted', matches });
          } else {
            rowInfo.push({ mode: 'skip' });
          }
        } else {
          rowInfo.push({ mode: 'skip' });
        }
      }
    }
    data.push(rowData);
    cellsMap.push(rowCells);
    cellInfo.push(rowInfo);
  }

  // --- Column post-pass: resolve ambiguous numeric date cells per column ---
  // Determine the maximum number of data columns across all rows.
  const numCols = cellInfo.reduce((max, row) => Math.max(max, row.length), 0);
  for (let c = 0; c < numCols; c++) {
    // Collect all ambiguous date cells in this column.
    const ambigCells = [];
    for (let r = 0; r < cellInfo.length; r++) {
      const info = cellInfo[r][c];
      if (info && info.mode === 'date' && info.ambiguous) {
        ambigCells.push({ r, info });
      }
    }
    if (ambigCells.length === 0) continue;

    // Compute format hint from the ambiguous cells.
    let hasN1gt12 = false; // n1 > 12 → rejects MDY interpretation (n1 must be day)
    let hasN2gt12 = false; // n2 > 12 → rejects DMY interpretation (n2 must be day)
    for (const { info } of ambigCells) {
      if (info.ambiguous.n1 > 12) hasN1gt12 = true;
      if (info.ambiguous.n2 > 12) hasN2gt12 = true;
    }

    let formatHint;
    if (hasN1gt12 && !hasN2gt12) {
      formatHint = 'DMY'; // n1 is day, n2 is month
    } else if (hasN2gt12 && !hasN1gt12) {
      formatHint = 'MDY'; // n1 is month, n2 is day
    } else if (hasN1gt12 && hasN2gt12) {
      formatHint = 'MIXED';
    } else {
      formatHint = 'AMBIGUOUS';
    }

    // Resolve or downgrade each ambiguous cell based on the hint.
    for (const { r, info } of ambigCells) {
      if (formatHint === 'MDY') {
        cellInfo[r][c] = { mode: 'date', month: info.ambiguous.n1, day: info.ambiguous.n2, year: info.ambiguous.year };
      } else if (formatHint === 'DMY') {
        cellInfo[r][c] = { mode: 'date', month: info.ambiguous.n2, day: info.ambiguous.n1, year: info.ambiguous.year };
      } else {
        // AMBIGUOUS or MIXED — cannot resolve safely
        cellInfo[r][c] = { mode: 'skip' };
      }
    }
  }
  // --- End column post-pass ---

  const allNums = [];
  for (const row of cellInfo) {
    for (const info of row) {
      if (info.mode === 'pure') allNums.push(info.num);
      else if (info.mode === 'extracted') {
        for (const m of info.matches) allNums.push(m.num);
      }
    }
  }
  const max_mag = findMaxMagnitude([allNums]);

  // Compute the decimal floor from the offset parameters once for the whole table.
  // This reflects the precision implied by the user's offset choice (e.g. offset 0.25 → 2 decimals).
  const floorDecimals = Math.max(decimalCount(offsetTop), decimalCount(offsetOther));

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const info = cellInfo[r][c];
      if (info.mode === 'skip') continue;

      const originalValue = data[r][c];
      let formattedValue;

      if (info.mode === 'date') {
        const prefilled = (info.month !== undefined) ? { month: info.month, day: info.day, year: info.year } : undefined;
        formattedValue = roundDateText(originalValue, opts.dateGranularity, prefilled);
        if (formattedValue === originalValue) continue;
      } else if (info.mode === 'time') {
        formattedValue = roundTimeText(originalValue, opts.timeGranularity);
        if (formattedValue === null || formattedValue === originalValue) continue;
      } else if (info.mode === 'pure') {
        const roundedValue = roundCellSetAware(info.num, info.num, max_mag, offsetTop, offsetOther, numTop);
        formattedValue = restoreFormatting(roundedValue, originalValue, floorDecimals);
        // Compare formatted output to the trimmed original: catches cases
        // where the number is numerically unchanged but the display format
        // simplifies (e.g. "35.0" → "35").
        if (formattedValue === originalValue.trim()) continue;
      } else {
        // mode === 'extracted': multi-match HTML-preserving patches.
        // Known limitation: mode:'extracted' cells (mixed text with embedded numbers,
        // e.g. <sup>-containing cells) require applyExtractedPatches which writes innerHTML.
        // This is incompatible with the nodeValue-only write model required for virtualized
        // grids (innerHTML writes crash React's reconciler). Skip extracted cells on grids
        // for this sprint — only pure-numeric and date/time cells are rounded on grids.
        if (isVirtualized) continue;

        // Round each match and patch its text node directly. This avoids the
        // whole-cell character-distribution approach, which mis-allocates
        // characters when newText length differs from original (corrupting
        // adjacent <sup> content, punctuation, and <a> text nodes).
        const cell = cellsMap[r][c];
        const patches = [];
        for (const m of info.matches) {
          const rounded = roundCellSetAware(m.num, m.num, max_mag, offsetTop, offsetOther, numTop);
          const newNum = formatExtractedNumber(rounded, m.numStr, floorDecimals);
          if (newNum !== m.numStr) patches.push({ index: m.index, numStr: m.numStr, newNum });
        }
        if (patches.length === 0) continue;
        cell.dataset.originalHtml = cell.innerHTML;
        applyExtractedPatches(cell, patches);
        cell.title = `Original: ${originalValue}`;
        cell.classList.add('dr-ext-rounded');
        cell.dataset.originalValue = originalValue;
        continue;
      }

      if (isVirtualized) {
        // Grid path: write via nodeValue patching only — never innerHTML/textContent.
        // cellsMap holds the full cellObj (GridAdapter._makeCellObj) for grid tables.
        // cellObj.setText stores drOriginal, patches in place, adds dr-ext-rounded.
        // Do NOT set dataset.originalHtml (would cause resetTable to fall into the
        // native innerHTML restore branch — the crash mode on toggle-off).
        const cellObj = cellsMap[r][c];
        cellObj.setText(formattedValue);
      } else {
        // Native-table path: cache pristine HTML before mutation so toggle/reset can
        // restore it without needing to keep the rounded value around.
        const cell = cellsMap[r][c];
        cell.dataset.originalHtml = cell.innerHTML;
        replaceTextPreservingHTML(cell, originalValue, formattedValue);
        cell.title = `Original: ${originalValue}`;
        cell.classList.add('dr-ext-rounded');
        cell.dataset.originalValue = originalValue;
      }
    }
  }
  syncSwitchForTable(table);

  // Attach the scroll/sort re-apply observer AFTER the initial pass so our own
  // nodeValue writes above do not immediately re-trigger it.
  // Only virtualized grids get an observer — native <table> adapters do not.
  if (isVirtualized && typeof MutationObserver !== 'undefined') {
    // Disconnect any stale observer (e.g. roundTable called twice on same grid).
    const staleObserver = gridObservers.get(table);
    if (staleObserver) staleObserver.disconnect();

    // Clear any pending debounce timer from a previous observer.
    const staleTimer = gridReapplyTimers.get(table);
    if (staleTimer !== undefined) {
      clearTimeout(staleTimer);
      gridReapplyTimers.delete(table);
    }

    const scrollContainer = adapter._getScrollContainer();
    const wrapperEl = table; // alias for clarity inside the closure

    const observer = new MutationObserver(() => {
      // Cancel any pending debounce timer for this grid and schedule a fresh one.
      const pending = gridReapplyTimers.get(wrapperEl);
      if (pending !== undefined) clearTimeout(pending);

      const timerId = setTimeout(() => {
        reapplyGridRounding(wrapperEl);
      }, GRID_REAPPLY_DEBOUNCE_MS);

      gridReapplyTimers.set(wrapperEl, timerId);
    });

    observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
    gridObservers.set(wrapperEl, observer);
  }
}

function lettersToColIndex(letters) {
  const up = letters.toUpperCase();
  let n = 0;
  for (let i = 0; i < up.length; i++) {
    const code = up.charCodeAt(i);
    if (code < 65 || code > 90) return null;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseRangeEndpoint(token) {
  const m = token.trim().match(/^([A-Za-z]+)?(\d+)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const col = m[1] ? lettersToColIndex(m[1]) : null;
  if (m[1] && col === null) return null;
  const row = m[2] ? parseInt(m[2], 10) - 1 : null;
  if (m[2] && (row < 0 || !isFinite(row))) return null;
  return { col, row };
}

function parseRangeToken(token) {
  const t = token.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const parts = t.split(':');
    if (parts.length !== 2) return null;
    const l = parseRangeEndpoint(parts[0]);
    const r = parseRangeEndpoint(parts[1]);
    if (!l || !r) return null;
    // Open-ended semantics: left-null = unbounded below (0), right-null = unbounded above (Infinity).
    const lcol = l.col === null ? 0 : l.col;
    const rcol = r.col === null ? Infinity : r.col;
    const lrow = l.row === null ? 0 : l.row;
    const rrow = r.row === null ? Infinity : r.row;
    return {
      colMin: Math.min(lcol, rcol),
      colMax: Math.max(lcol, rcol),
      rowMin: Math.min(lrow, rrow),
      rowMax: Math.max(lrow, rrow)
    };
  }
  const e = parseRangeEndpoint(t);
  if (!e) return null;
  return {
    colMin: e.col ?? 0,
    colMax: e.col ?? Infinity,
    rowMin: e.row ?? 0,
    rowMax: e.row ?? Infinity
  };
}

function parseRangeExpr(expr) {
  if (typeof expr !== 'string') return { ranges: null };
  const trimmed = expr.trim();
  if (!trimmed) return { ranges: null }; // null = whole table
  const stripped = trimmed.replace(/^\{/, '').replace(/\}$/, '');
  const tokens = stripped.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { ranges: null };
  const ranges = [];
  for (const tok of tokens) {
    const r = parseRangeToken(tok);
    if (!r) return { error: `Invalid range: "${tok}"` };
    ranges.push(r);
  }
  return { ranges };
}

function isInRanges(r, c, ranges) {
  if (!ranges) return true;
  for (const range of ranges) {
    if (r >= range.rowMin && r <= range.rowMax &&
        c >= range.colMin && c <= range.colMax) {
      return true;
    }
  }
  return false;
}

function resolveOffset(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(num)) return fallback;
  if (num < -VALIDATION_LIMIT || num > VALIDATION_LIMIT) return fallback;
  return num;
}

function resolveNumTop(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  if (!isFinite(num) || num < 1) return fallback;
  return Math.floor(num);
}

function getExclusionReason(text, columnIndex, options, rowIndex) {
  if (!options.simplifyFirstRow && rowIndex === 0) return 'firstRow';
  if (!options.simplifyFirstColumn && columnIndex === 0) return 'firstColumn';
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!options.simplifyMixedPercent && /%/.test(t)) return 'percent';
  if (!options.simplifyMixedCurrency && /[$€£¥₹]/.test(t)) return 'currency';
  return null;
}

const MONTH_NAMES = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

// Regex constants for date candidate normalization
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUPERSCRIPT_TAG = 'SUP';
const FOOTNOTE_MARKERS = '*†‡';
const DATE_NOISE_CLASS = `[\\s${SUPERSCRIPT_DIGITS}${FOOTNOTE_MARKERS}]`;
const LEADING_DATE_NOISE_RE = new RegExp(`^${DATE_NOISE_CLASS}+`);
const TRAILING_DATE_NOISE_RE = new RegExp(`${DATE_NOISE_CLASS}+$`);
const ORDINAL_SUFFIX_RE = /(\d+)(st|nd|rd|th)/gi;

// Map lowercase month abbreviation/name prefix → 1-based month number
const MONTH_NAME_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

/**
 * Resolve a matched month-name token (e.g. "June", "jun.", "Jul") to a 1-based month number.
 * Returns null if not recognised.
 */
function resolveMonthName(token) {
  const t = token.toLowerCase().replace(/[.\s]/g, '');
  // Try exact key first, then 3-letter prefix
  if (MONTH_NAME_MAP[t] !== undefined) return MONTH_NAME_MAP[t];
  const prefix3 = t.slice(0, 4); // "sept" is 4 chars
  if (MONTH_NAME_MAP[prefix3] !== undefined) return MONTH_NAME_MAP[prefix3];
  const prefix3s = t.slice(0, 3);
  if (MONTH_NAME_MAP[prefix3s] !== undefined) return MONTH_NAME_MAP[prefix3s];
  return null;
}

/**
 * Normalize a trimmed date candidate by stripping leading/trailing superscript digits,
 * footnote markers, and reducing ordinal suffixes (1st→1, 2nd→2, etc.) to bare numbers.
 * Collapses and trims whitespace at the end.
 */
function normalizeDateCandidate(text) {
  let s = text;
  // Strip leading/trailing superscript digits and footnote markers
  s = s.replace(LEADING_DATE_NOISE_RE, '').replace(TRAILING_DATE_NOISE_RE, '');
  // Replace ordinal suffixes: "1st" → "1", "21st" → "21", etc.
  s = s.replace(ORDINAL_SUFFIX_RE, '$1');
  // Collapse internal whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Parse an unambiguous date-like string into {year, month, day}.
 * Returns null for all-numeric N1/N2/Y or N1-N2-Y shapes (handled by parseAmbiguousNumericDate).
 * Supported shapes:
 *   ISO dash:      2020-07-21
 *   ISO slash:     2020/07/21
 *   Named-month:   June 21, 2020 / Jun 21, 2020 / 21 June 2020 / 2020 June 21 / Jun 2020
 *   Bare year:     2020
 * Adjacent non-date characters (trailing words, leading labels, footnote superscripts,
 * ordinal suffixes) are tolerated via normalizeDateCandidate + relaxed anchors.
 */
function parseDateLike(text) {
  if (typeof text !== 'string') return null;
  const t = normalizeDateCandidate(text.trim());

  // ISO dash: YYYY-MM-DD (must be 4-digit year first to avoid ambiguous N1-N2-Y)
  // Boundary-aware: allow surrounding non-word chars but not word chars
  const isoDash = t.match(/(?:^|(?<=[^\w]))(\d{4})-(\d{2})-(\d{2})(?=$|[^\w])/);
  if (isoDash) {
    return { year: parseInt(isoDash[1], 10), month: parseInt(isoDash[2], 10), day: parseInt(isoDash[3], 10) };
  }

  // ISO slash: YYYY/MM/DD
  const isoSlash = t.match(/(?:^|(?<=[^\w]))(\d{4})\/(\d{2})\/(\d{2})(?=$|[^\w])/);
  if (isoSlash) {
    return { year: parseInt(isoSlash[1], 10), month: parseInt(isoSlash[2], 10), day: parseInt(isoSlash[3], 10) };
  }

  // Named-month forms (case-insensitive): Month DD, YYYY
  const mnRe = new RegExp(`(?:^|(?<=[^\\w]))(${MONTH_NAMES})\\s+(\\d{1,2}),?\\s+(\\d{4})(?=$|[^\\w])`, 'i');
  const mnMatch = t.match(mnRe);
  if (mnMatch) {
    const month = resolveMonthName(mnMatch[1]);
    if (month !== null) return { year: parseInt(mnMatch[3], 10), month, day: parseInt(mnMatch[2], 10) };
  }

  // Day Month Year: 21 June 2020
  const dmyRe = new RegExp(`(?:^|(?<=[^\\w]))(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})(?=$|[^\\w])`, 'i');
  const dmyMatch = t.match(dmyRe);
  if (dmyMatch) {
    const month = resolveMonthName(dmyMatch[2]);
    if (month !== null) return { year: parseInt(dmyMatch[3], 10), month, day: parseInt(dmyMatch[1], 10) };
  }

  // Year Month Day: 2020 June 21
  const ymdRe = new RegExp(`(?:^|(?<=[^\\w]))(\\d{4})\\s+(${MONTH_NAMES})\\s+(\\d{1,2})(?=$|[^\\w])`, 'i');
  const ymdMatch = t.match(ymdRe);
  if (ymdMatch) {
    const month = resolveMonthName(ymdMatch[2]);
    if (month !== null) return { year: parseInt(ymdMatch[1], 10), month, day: parseInt(ymdMatch[3], 10) };
  }

  // Month Year: Jun 2020
  const myRe = new RegExp(`(?:^|(?<=[^\\w]))(${MONTH_NAMES})\\s+(\\d{4})(?=$|[^\\w])`, 'i');
  const myMatch = t.match(myRe);
  if (myMatch) {
    const month = resolveMonthName(myMatch[1]);
    if (month !== null) return { year: parseInt(myMatch[2], 10), month, day: 1 };
  }

  // Bare year: 2020 (1900–2099) — STRICT anchors preserved to avoid false positives
  // "Sales: 2020", "$2,020.00", "version 2020.1.3" must all return false
  const bareYear = t.match(/^(\d{4})$/);
  if (bareYear) {
    const y = parseInt(bareYear[1], 10);
    if (y >= 1900 && y <= 2099) return { year: y, month: 1, day: 1 };
  }

  return null;
}

/**
 * Parse an all-numeric ambiguous date: N1/N2/Y or N1-N2-Y.
 * Supports 4-digit and 2-digit years. 2-digit-year pivot: yy < 50 → 2000+yy, else 1900+yy.
 * Adjacent non-date characters are tolerated via normalizeDateCandidate + relaxed anchors.
 * Returns {n1, n2, year} or null.
 */
function parseAmbiguousNumericDate(text) {
  if (typeof text !== 'string') return null;
  const t = normalizeDateCandidate(text.trim());
  // N1/N2/Y or N1-N2-Y (but not YYYY-MM-DD or YYYY/MM/DD which are unambiguous)
  // Boundary-aware: allow surrounding non-word chars but not word chars
  const m = t.match(/(?:^|(?<=[^\w]))(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?=$|[^\w])/);
  if (!m) return null;
  const n1 = parseInt(m[1], 10);
  const n2 = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (m[3].length === 2) {
    year = year < 50 ? 2000 + year : 1900 + year;
  }
  return { n1, n2, year };
}

function isDateLike(text) {
  return parseDateLike(text) !== null || parseAmbiguousNumericDate(text) !== null;
}

function isTimeLike(text) {
  // HH:MM or HH:MM:SS, optional AM/PM
  return /^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i.test(text);
}

/**
 * Round a date cell to the requested granularity and return a year-only string.
 *
 * @param {string} text          - Original cell text.
 * @param {string} granularity   - 'year' | 'decade' | 'century'.
 * @param {{month: number, day: number, year: number}} [prefilled]
 *   Pre-resolved date from the classification pass. If omitted, parseDateLike is called.
 * @returns {string} Always returns a string (the rounded year as digits).
 */
function roundDateText(text, granularity, prefilled) {
  const parsed = prefilled || parseDateLike(text);
  if (!parsed) return text; // fallback: shouldn't happen for mode:'date' cells

  const { year, month } = parsed;

  // fractional = year + 0.5 if month >= 7, else year + 0
  const fractional = year + (month >= 7 ? 0.5 : 0);

  let roundedYear;
  if (granularity === 'decade') {
    roundedYear = Math.round(fractional / 10) * 10;
  } else if (granularity === 'century') {
    roundedYear = Math.round(fractional / 100) * 100;
  } else {
    // 'year' or default
    roundedYear = Math.round(fractional);
  }

  const d = new Date(roundedYear, 0, 1);
  return String(d.getFullYear());
}

function roundTimeText(text, granularity) {
  if (typeof text !== 'string') return null;
  if (granularity === 'minute' || !granularity) return null;
  if (granularity !== 'hour') return null;
  const trimmed = text.trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[ap]\.?m\.?)?$/i);
  if (!m) return null;
  const origHourStr = m[1];
  const origHour = parseInt(origHourStr, 10);
  const minutes = parseInt(m[2], 10);
  const seconds = m[3] ? parseInt(m[3], 10) : 0;
  const ampmRaw = m[4] || '';
  const has12HourSuffix = ampmRaw !== '';
  const isPm = has12HourSuffix && /p/i.test(ampmRaw);

  // Round up if at or past the half-hour mark.
  const roundUp = minutes > 30 || (minutes === 30 && seconds >= 0) || (minutes === 29 && seconds >= 30);

  let hour24;
  if (has12HourSuffix) {
    // 12-hour clock: 12 AM = 0, 1-11 AM = 1-11, 12 PM = 12, 1-11 PM = 13-23.
    hour24 = (origHour % 12) + (isPm ? 12 : 0);
  } else {
    hour24 = origHour;
  }
  if (roundUp) hour24 = (hour24 + 1) % 24;
  else hour24 = hour24 % 24;

  let displayHour;
  let displayAmpm = '';
  if (has12HourSuffix) {
    const newIsPm = hour24 >= 12;
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    displayHour = String(h12);
    // Preserve the original AM/PM token style ("AM", "am", "a.m.", " PM", etc.)
    // by swapping the a/p letter but keeping the rest of the original suffix.
    displayAmpm = newIsPm ? ampmRaw.replace(/a/i, c => c === 'A' ? 'P' : 'p')
                          : ampmRaw.replace(/p/i, c => c === 'P' ? 'A' : 'a');
  } else {
    displayHour = origHourStr.length === 2
      ? String(hour24).padStart(2, '0')
      : String(hour24);
  }

  let result = `${displayHour}:00`;
  if (m[3]) result += ':00';
  result += displayAmpm;
  return result === trimmed ? null : result;
}

/**
 * Returns an array of {start, end} half-open index ranges corresponding to text that is
 * physically inside a <sup> element (or an element whose computed vertical-align is 'super')
 * within the given cell.  The indices are into the same string the number extractor sees —
 * the concatenation of all text nodes in document order, which matches cell.textContent
 * (and cell.innerText for ordinary in-flow content).
 *
 * Approach: walk the cell's text nodes via document.createTreeWalker, keeping a running
 * cursor.  For each text node, if any ancestor up to (but not including) the cell is a
 * <sup> element (or has verticalAlign 'super'), record {start: cursor, end: cursor + len}.
 *
 * Guards:
 * - If document.createTreeWalker is unavailable, returns [].
 * - getComputedStyle is only called when typeof getComputedStyle === 'function', so the
 *   helper never throws in the Node test harness.
 * @param {Element} cell
 * @returns {{start: number, end: number}[]}
 */
function getSuperscriptRanges(cell) {
  if (!cell || typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') {
    return [];
  }
  const ranges = [];
  const treeWalker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
  let cursor = 0;
  let node;
  while ((node = treeWalker.nextNode())) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    if (len > 0) {
      // Check if any ancestor up to (not including) cell is a <sup> element.
      let isSup = false;
      let ancestor = node.parentNode || node.parentElement;
      while (ancestor && ancestor !== cell) {
        if (ancestor.tagName === SUPERSCRIPT_TAG) {
          isSup = true;
          break;
        }
        // Also check computed verticalAlign, but only when getComputedStyle is available
        // (it may be absent in the Node test harness).
        if (!isSup && typeof getComputedStyle === 'function') {
          try {
            const style = getComputedStyle(ancestor);
            if (style && style.verticalAlign === 'super') {
              isSup = true;
              break;
            }
          } catch (e) { /* ignore */ }
        }
        ancestor = ancestor.parentNode || ancestor.parentElement;
      }
      if (isSup) {
        ranges.push({ start: cursor, end: cursor + len });
      }
    }
    cursor += len;
  }
  return ranges;
}

/**
 * Returns an array of {start, end} ranges for all balanced ASCII double-quoted spans
 * in the given string. Unbalanced quotes produce no range for the unpaired quote.
 * @param {string} text
 * @returns {{start: number, end: number}[]}
 */
function getQuoteMaskedRanges(text) {
  if (typeof text !== 'string') return [];
  const ranges = [];
  const re = /"([^"]*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

/**
 * Returns true if [matchStart, matchEnd) overlaps any range in maskedRanges.
 * @param {{start: number, end: number}[]} maskedRanges
 * @param {number} matchStart
 * @param {number} matchEnd
 * @returns {boolean}
 */
function overlapsQuoteRange(maskedRanges, matchStart, matchEnd) {
  for (const range of maskedRanges) {
    if (matchStart < range.end && matchEnd > range.start) return true;
  }
  return false;
}

function extractNumberInText(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(NUMBER_IN_TEXT_REGEX);
  if (!match) return null;
  const numStr = match[0];
  const num = toNumber(numStr);
  if (num === null || num === 0) return null;
  return { numStr, num, index: match.index };
}

function extractNumbersInText(text) {
  if (typeof text !== 'string') return [];
  const matches = [];
  const re = new RegExp(NUMBER_IN_TEXT_REGEX_GLOBAL.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = toNumber(m[0]);
    if (num !== null && num !== 0) {
      matches.push({ numStr: m[0], num, index: m.index });
    }
  }
  return matches;
}

/**
 * Returns the number of fractional digits in n's string representation.
 * Sign is stripped before counting. null/undefined/NaN all return 0.
 * Examples: decimalCount(0.5) → 1, decimalCount(-0.25) → 2, decimalCount(1) → 0.
 */
function decimalCount(n) {
  if (n === null || n === undefined || (typeof n === 'number' && isNaN(n))) return 0;
  const s = String(Math.abs(n));
  const dot = s.indexOf('.');
  if (dot === -1) return 0;
  return s.length - dot - 1;
}

/**
 * Format a rounded number extracted from inline text for display.
 *
 * Band rule for minimumFractionDigits:
 *   |rounded| < 10  → use Math.max(decimals, floorDecimals)
 *     The <10 band covers small values such as percentages/fractions where
 *     the offset's own decimal precision is meaningful to the reader.
 *   |rounded| >= 10 → zero decimals (existing short-circuit unchanged).
 *     Large magnitudes are already rounded to integer multiples of a coarse
 *     base, so decimal places would be spurious.
 *
 * @param {number} rounded       - The rounded numeric value.
 * @param {string} originalNumStr - The original number string (for comma/decimal detection).
 * @param {number} [floorDecimals=0] - Minimum decimal places from the offset's own precision.
 */
function formatExtractedNumber(rounded, originalNumStr, floorDecimals = 0) {
  const hasCommas = originalNumStr.includes(',');
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
    useGrouping: hasCommas
  });
}

function toggleOriginalValues(table) {
  const roundedCells = table.querySelectorAll('.dr-ext-rounded');
  if (roundedCells.length === 0) return;

  const showingOriginal = table.dataset.drShowingOriginal === 'true';

  if (showingOriginal) {
    // Re-run the pipeline with the last-used options so the rounded view
    // reflects current parameters rather than a stale cached value.
    const opts = tableOptions.get(table) || DR_DEFAULTS;
    resetTable(table);
    roundTable(table, opts);
  } else {
    // Restore each cell to its pristine HTML; keep the class and dataset so
    // a subsequent toggle knows to re-round.
    for (const cell of roundedCells) {
      if (cell.dataset.originalHtml !== undefined) {
        cell.innerHTML = cell.dataset.originalHtml;
      }
      cell.removeAttribute('title');
    }
    table.dataset.drShowingOriginal = 'true';
  }
  syncSwitchForTable(table);
}

// --- Core Algorithm Inlined ---

function ROUND_DYNAMIC(values, offset_top, offset_other, num_top) {
  const firstIsArray = Array.isArray(values);

  if (firstIsArray) {
    return datasetMode(values, offset_top, offset_other, num_top);
  } else {
    return singleValueMode(values, offset_top);
  }
}

function singleValueMode(value, offset) {
  offset = (offset === undefined || offset === "") ? DEFAULT_OFFSET_TOP : offset;
  validateOffset(offset, "offset");

  if (value === "" || value === null) return "";

  const num = toNumber(value);
  if (num === null) return value;
  if (num === 0) return 0;

  return roundWithOffset(num, offset);
}

function datasetMode(range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? DEFAULT_OFFSET_TOP : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? offset_top : offset_other;
  num_top = (num_top === undefined || num_top === "") ? DEFAULT_NUM_TOP : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  if (!Array.isArray(range[0])) {
    range = [range];
  }

  const numericRange = range.map(row => row.map(cell => toNumber(cell)));
  const max_mag = findMaxMagnitude(numericRange);

  return range.map((row, r) =>
    row.map((cell, c) => roundCellSetAware(cell, numericRange[r][c], max_mag, offset_top, offset_other, num_top))
  );
}

function findMaxMagnitude(numericRange) {
  let max_mag = null;
  for (let row of numericRange) {
    for (let num of row) {
      if (num !== null && num !== 0 && isFinite(num)) {
        const mag = Math.floor(Math.log10(Math.abs(num)));
        if (max_mag === null || mag > max_mag) {
          max_mag = mag;
        }
      }
    }
  }
  return max_mag;
}

// roundCellSetAware and roundWithOffset live in rounding.js.

function toNumber(value) {
  if (typeof value === "number") {
    return isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    let cleaned = value.trim()
      .replace(/[‐-―−﹘﹣－]/g, "-")
      .replace(CLEAN_REGEX, "")
      .replace(PARENS_REGEX, "-$1");
    const parsed = Number(cleaned);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateOffset(offset, paramName) {
  if (offset < -VALIDATION_LIMIT || offset > VALIDATION_LIMIT) {
    throw new Error(paramName + " must be between -" + VALIDATION_LIMIT + " and " + VALIDATION_LIMIT + ", got " + offset);
  }
}

/**
 * Restore the formatting of a pure-numeric cell after rounding.
 *
 * Band rule for minimumFractionDigits (mirrors formatExtractedNumber):
 *   |roundedValue| < 10  → use Math.max(decimals, floorDecimals)
 *   |roundedValue| >= 10 → zero decimals (short-circuit, unchanged)
 *
 * @param {number} roundedValue   - The rounded numeric value.
 * @param {string} originalString - Original cell text (for symbol/format detection).
 * @param {number} [floorDecimals=0] - Minimum decimal places from the offset's precision.
 */
function restoreFormatting(roundedValue, originalString, floorDecimals = 0) {
  let result;
  const originalTrimmed = originalString.trim();

  result = roundedValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10
  });

  // Handle percent
  if (originalTrimmed.includes('%')) {
    result += '%';
  }

  // Handle plus
  if (originalTrimmed.includes('+') && roundedValue > 0) {
    result = '+' + result;
  }

  // Handle currency
  if (originalTrimmed.includes('$')) {
    result = '$' + result;
  } else if (originalTrimmed.includes('€')) {
    result = '€' + result;
  } else if (originalTrimmed.includes('£')) {
    result = '£' + result;
  } else if (originalTrimmed.includes('¥')) {
    result = '¥' + result;
  }

  // Handle parens
  if (roundedValue < 0 && /^\(.*?\)$/.test(originalTrimmed)) {
    result = '(' + result.replace('-', '') + ')';
  }
  
  return result;
}

/**
 * Returns true if the cell's entire visible text is contained within <a> elements.
 * Used to skip pure-numeric cells whose value is a hyperlink (e.g. a linked page number).
 */
function isCellWholeLink(cell) {
  if (typeof cell.querySelectorAll !== 'function') return false;
  const anchors = cell.querySelectorAll('a');
  if (!anchors || anchors.length === 0) return false;
  const cellText = (cell.innerText || '').trim();
  if (!cellText) return false;
  const anchorText = [...anchors].map(a => (a.innerText || '').trim()).join('').trim();
  return anchorText === cellText;
}

/**
 * Filters out matches from extractNumbersInText that fall inside an <a> descendant of cell.
 * For each match, walks the cell's text nodes via TreeWalker and checks whether the node
 * containing match.numStr has an <a> ancestor within the cell. If no single node contains
 * numStr, falls back to checking whether any <a> descendant's text includes numStr.
 */
function filterLinkMatches(cell, matches) {
  if (!matches || matches.length === 0) return matches;
  if (typeof cell.querySelectorAll !== 'function') return matches;
  const anchors = cell.querySelectorAll('a');
  if (!anchors || anchors.length === 0) return matches;

  // Collect text nodes via TreeWalker (same pattern as replaceTextPreservingHTML).
  const treeWalker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    textNodes.push(currentNode);
  }
  const nonEmptyNodes = textNodes.filter(n => n.nodeValue.trim() !== '');

  return matches.filter(match => {
    const numStr = match.numStr;
    // Find the first text node that contains numStr.
    const containingNode = nonEmptyNodes.find(n => n.nodeValue.includes(numStr));
    if (containingNode) {
      // Check whether this node has an <a> ancestor that is a descendant of cell.
      const anchor = containingNode.parentElement && containingNode.parentElement.closest('a');
      if (anchor && cell.contains(anchor)) {
        return false; // drop: number is inside a link
      }
      return true;
    }
    // numStr not found in any single node (rare cross-node match).
    // Conservative fallback: if any <a> descendant's text contains numStr, drop it.
    const inAnchor = [...anchors].some(a => (a.innerText || a.textContent || '').includes(numStr));
    return !inAnchor;
  });
}

function replaceTextPreservingHTML(cell, originalText, newText) {
  const treeWalker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
  let currentNode;
  const textNodes = [];
  
  while (currentNode = treeWalker.nextNode()) {
    textNodes.push(currentNode);
  }
  
  const nonEmptyNodes = textNodes.filter(n => n.nodeValue.trim() !== '');
  const trimmedOriginal = originalText.trim();
  
  if (nonEmptyNodes.length === 1) {
    const text = nonEmptyNodes[0].nodeValue;
    nonEmptyNodes[0].nodeValue = text.replace(trimmedOriginal, newText);
    return;
  }
  
  for (let node of nonEmptyNodes) {
    if (node.nodeValue.includes(trimmedOriginal)) {
      node.nodeValue = node.nodeValue.replace(trimmedOriginal, newText);
      return;
    }
  }
  
  if (cell.innerHTML.includes(trimmedOriginal)) {
    cell.innerHTML = cell.innerHTML.replace(trimmedOriginal, newText);
    return;
  }
  
  // Advanced replacement across multiple nodes to avoid destroying HTML structure
  let fullText = "";
  const nodePositions = [];
  for (let node of textNodes) {
    const start = fullText.length;
    fullText += node.nodeValue;
    nodePositions.push({ node, start, end: fullText.length });
  }
  
  const matchIndex = fullText.indexOf(trimmedOriginal);
  if (matchIndex !== -1) {
    const matchEnd = matchIndex + trimmedOriginal.length;
    let firstNodeIdx = -1;
    let lastNodeIdx = -1;
    
    for (let i = 0; i < nodePositions.length; i++) {
      if (nodePositions[i].end > matchIndex && firstNodeIdx === -1) {
        firstNodeIdx = i;
      }
      if (nodePositions[i].start < matchEnd) {
        lastNodeIdx = i;
      }
    }
    
    if (firstNodeIdx !== -1 && lastNodeIdx !== -1) {
      // Distribute newText across the matched nodes to preserve exact HTML span structure
      let remainingNewText = newText;
      for (let i = firstNodeIdx; i <= lastNodeIdx; i++) {
        const pos = nodePositions[i];
        const nodeStr = pos.node.nodeValue;
        
        const overlapStartInNode = Math.max(0, matchIndex - pos.start);
        const overlapEndInNode = Math.min(nodeStr.length, matchEnd - pos.start);
        const overlapLen = overlapEndInNode - overlapStartInNode;
        
        let replacementForThisNode = "";
        if (i === lastNodeIdx) {
          replacementForThisNode = remainingNewText;
        } else {
          replacementForThisNode = remainingNewText.substring(0, overlapLen);
          remainingNewText = remainingNewText.substring(overlapLen);
        }
        
        const beforeMatch = nodeStr.substring(0, overlapStartInNode);
        const afterMatch = nodeStr.substring(overlapEndInNode);
        
        pos.node.nodeValue = beforeMatch + replacementForThisNode + afterMatch;
      }
      return;
    }
  }
  
  // Removed absolute innerText fallback to completely eliminate risk of breaking column widths or DOM structures
  console.debug("Dynamic Rounding: Skipped complex multi-node cell replacement to preserve layout.");
}

/**
 * Applies targeted per-number patches to the text nodes of a cell.
 * Each patch {index, numStr, newNum} identifies a position in the cell's flat
 * text (TreeWalker/textContent order — same coordinate space as getSuperscriptRanges
 * and extractNumbersInText), the original string, and its replacement.
 *
 * Patches are applied right-to-left so earlier flat-text positions are unaffected
 * by changes at higher positions. Only the specific text node containing each
 * number is touched; <sup>, <a>, and all other surrounding nodes are left intact.
 *
 * Fails silently (skips the patch) if the node cannot be found or if numStr is
 * not present at the expected position — same behaviour as the old fallback.
 */
function applyExtractedPatches(cell, patches) {
  if (!patches || patches.length === 0) return;
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
  const nodePositions = [];
  let flatLen = 0;
  let node;
  while ((node = walker.nextNode())) {
    nodePositions.push({ node, start: flatLen });
    flatLen += node.nodeValue.length;
  }
  const sorted = [...patches].sort((a, b) => b.index - a.index);
  for (const { index, numStr, newNum } of sorted) {
    const pos = nodePositions.find(
      p => p.start <= index && index < p.start + p.node.nodeValue.length
    );
    if (!pos) continue;
    const i = index - pos.start;
    const v = pos.node.nodeValue;
    if (v.substring(i, i + numStr.length) !== numStr) continue;
    pos.node.nodeValue = v.substring(0, i) + newNum + v.substring(i + numStr.length);
  }
}
