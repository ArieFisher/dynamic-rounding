/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// Constants
// CLEAN_REGEX, PARENS_REGEX, DEFAULT_OFFSET_TOP, DEFAULT_NUM_TOP, and
// VALIDATION_LIMIT live in core.js (loaded ahead of this file); they are used
// here too via shared global scope.

// EPSILON, X_FLOOR_THRESHOLD, roundWithOffset, and roundCellSetAware live in
// rounding.js (loaded by manifest content_scripts ahead of this file) so the
// sidebar can call the same arithmetic for its preview band.

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

const ACTION_TABLE_ACTIVATED = 'TABLE_ACTIVATED';

document.addEventListener('contextmenu', (event) => {
  lastRightClickedElement = event.target;
  const table = findTargetTable(event.target);
  if (table) {
    lastRightClickedTable = table;
    flashTargetedTable(table);
    try {
      chrome.runtime.sendMessage({ action: ACTION_TABLE_ACTIVATED });
    } catch (e) {
      // extension context may not be available; harmless
    }
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
    sendResponse({ ok: true });
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

// Detect and attach toggles for tables/grids inside (or equal to) a node added
// to the DOM. Mirrors injectTableToggles' two passes, including the phantom
// a11y-table filtering required by issue #128 so dynamically-rendered SPA grids
// (e.g. Kaggle's Data Explorer) are auto-detected and off-screen chart a11y
// tables are not. Extracted as a named function so the detection is unit-testable
// independently of the live MutationObserver wiring below.
function injectTogglesForAddedNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  // Pass 1: native <table> elements; phantom a11y tables are skipped.
  if (node.tagName === 'TABLE' && !tableToggles.has(node) && !isPhantomA11yTable(node)) {
    createToggleForTable(node);
  }
  if (typeof node.querySelectorAll === 'function') {
    node.querySelectorAll('table').forEach(table => {
      if (!tableToggles.has(table) && !isPhantomA11yTable(table)) {
        createToggleForTable(table);
      }
    });
    // Pass 2: cheap ARIA pass for added nodes — mirror injectTableToggles Pass 2.
    // A grid that only embeds phantom a11y tables must still be detected.
    node.querySelectorAll(GRID_ARIA_SELECTOR).forEach(el => {
      if (el.classList.contains('dr-ext-grid')) return;
      if (el.tagName === 'TABLE') return;
      if (Array.from(el.querySelectorAll('table')).some(t => !isPhantomA11yTable(t))) return;
      el.classList.add('dr-ext-grid');
      createToggleForTable(el);
    });
  }
  // The added node itself may be a [role="grid"/"table"] non-table element.
  if (node.tagName !== 'TABLE' && typeof node.matches === 'function' &&
      node.matches(GRID_ARIA_SELECTOR) && !node.classList.contains('dr-ext-grid')) {
    if (!Array.from(node.querySelectorAll('table')).some(t => !isPhantomA11yTable(t))) {
      node.classList.add('dr-ext-grid');
      createToggleForTable(node);
    }
  }
}

if (typeof MutationObserver !== 'undefined') {
  ensureScrollResizeListeners();

  // MutationObserver to watch for dynamically added/removed tables and grids
  const _tableObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        injectTogglesForAddedNode(node);
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
      // Issue #2: when the table is already simplified, read the stored original
      // rather than the rounded text now showing in the cell. Native-table rounded
      // cells stash it on dataset.originalValue; grid cells already return their
      // pre-round text from getText() (dataset.drOriginal).
      const cellEl = cellObj.el;
      const storedOriginal = cellEl && cellEl.dataset ? cellEl.dataset.originalValue : undefined;
      const text = storedOriginal !== undefined ? storedOriginal : cellObj.getText();
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) continue;
      if (isDateLike(trimmed) || isTimeLike(trimmed)) continue;
      if (/^(19|20)\d{2}$/.test(trimmed)) continue;
      const num = toNumber(trimmed);
      if (num !== null && num !== 0 && isFinite(num)) {
        out.push({ text: trimmed, num });
      } else {
        const extracted = extractNumbersInText(trimmed);
        for (const { num: extractedNum, numStr, index } of extracted) {
          // Issue #4: era-marked years (e.g. "2898 AD") are dates, not numbers —
          // exclude them from magnitude detection and the preview examples.
          if (isEraYear(trimmed, index, numStr)) continue;
          out.push({ text: trimmed, num: extractedNum });
        }
      }
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
  const topOffset = typeof DR_DEFAULTS.offsetTop === 'number' ? DR_DEFAULTS.offsetTop : -0.5;
  const otherOffset = typeof DR_DEFAULTS.offsetOther === 'number' ? DR_DEFAULTS.offsetOther : -0.5;

  // Reorder a magnitude bucket so cells that visibly *change* under the band's
  // default offset come first. Picking the raw document-order cell can land on
  // an already-round value (e.g. 250,000,000 → 250,000,000), making the preview
  // row look like rounding does nothing. Array.prototype.sort is stable, so
  // cells with the same "demonstrates rounding" verdict keep document order.
  const demoFirst = (bucket, offset) => bucket.slice().sort((a, b) => {
    const ca = roundWithOffset(a.num, offset) !== a.num ? 0 : 1;
    const cb = roundWithOffset(b.num, offset) !== b.num ? 0 : 1;
    return ca - cb;
  });

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
    top.push(demoFirst(byMag.get(m), topOffset)[0]);
  }
  if (top.length < 2 && topMags.length > 0) {
    // Same magnitude has multiple cells — fill from the top bucket.
    const bucket = demoFirst(byMag.get(topMags[0]), topOffset);
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
    bottom.push(demoFirst(byMag.get(m), otherOffset)[0]);
  }
  if (bottom.length < 3 && bottomMags.length > 0) {
    const bucket = demoFirst(byMag.get(bottomMags[0]), otherOffset);
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
 * Classify and compute rounded target values for all visible cells of a
 * virtualized grid, using the EXACT same gating logic as the initial
 * `roundTable` pass: isInRanges, getExclusionReason (firstRow / firstColumn /
 * percent / currency), whole-cell-quote, date/time, isCellWholeLink, <sup>
 * handling, and mode:'extracted' skip-on-grid.
 *
 * max_mag is computed only over the surviving in-range, non-excluded pure
 * (and extracted) numeric cells — the same filtered set the initial pass uses —
 * so that values produced here are identical to those the initial pass would
 * produce given the same visible DOM and opts.
 *
 * Returns a flat array of { cellObj, targetValue } for every TD cell in the
 * grid's current visible rows.  targetValue is:
 *   - null  → leave the cell unchanged (excluded, out-of-range, skip, or no
 *             change needed)
 *   - a string → the rounded/formatted value the cell should display
 *
 * Both `roundTable` (initial grid write pass) and `reapplyGridRounding`
 * (scroll/sort re-apply) call this single function so they cannot diverge.
 *
 * NOTE: mode:'extracted' cells (mixed text with embedded numbers, e.g.
 * <sup>-containing cells) are intentionally skipped on grids — that path
 * requires innerHTML writes incompatible with the nodeValue-only write model.
 * This is deferred work tracked in issue #120.
 *
 * @param {Element} wrapperEl - The grid wrapper element.
 * @param {object}  opts      - Fully-resolved rounding options.
 * @returns {Array<{cellObj: object, targetValue: string|null}>}
 */
function computeGridRoundedValues(wrapperEl, opts) {
  const offsetTop = resolveOffset(opts.offsetTop, DEFAULT_OFFSET_TOP);
  const offsetOther = resolveOffset(opts.offsetOther, offsetTop);
  const numTop = resolveNumTop(opts.numTop, DEFAULT_NUM_TOP);
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  // If the range expression is invalid, no cells should be rounded.
  if (rangeParse.error) return [];
  const ranges = rangeParse.ranges;
  const floorDecimals = Math.max(decimalCount(offsetTop), decimalCount(offsetOther));

  const adapter = makeAdapter(wrapperEl);
  const adapterRows = adapter.getRows();
  if (adapterRows.length === 0) return [];

  // --- Pass 1: classify every visible TD cell (same logic as roundTable) ---
  // cellEntries: flat array of { cellObj, text, trimmed, info }
  // info is the classification result: { mode: 'skip'|'pure'|'date'|'time'|'extracted', ... }
  // rowIndex and colIndex track position for isInRanges / getExclusionReason.
  const cellEntries = [];

  // Also build a per-column list of entries with ambiguous date mode so we can
  // run the column post-pass (same as roundTable).
  // Map: colIndex → array of indices into cellEntries
  const ambigByCol = new Map();

  for (let r = 0; r < adapterRows.length; r++) {
    const adapterCells = adapterRows[r].getCells();
    let dataCol = 0;
    for (let c = 0; c < adapterCells.length; c++) {
      const cellObj = adapterCells[c];
      if (cellObj.tagName !== 'TD') continue;
      const col = dataCol++;
      const cell = cellObj.el;
      const text = cellObj.getText();
      const trimmed = typeof text === 'string' ? text.trim() : '';

      const isWholeCellQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') &&
        (trimmed.match(/"/g) || []).length === 2;

      let info;
      if (!isInRanges(r, col, ranges)) {
        info = { mode: 'skip' };
      } else if (getExclusionReason(text, col, opts, r)) {
        info = { mode: 'skip' };
      } else if (isWholeCellQuoted) {
        info = { mode: 'skip' };
      } else if (isDateLike(trimmed)) {
        if (!opts.simplifyDates) {
          info = { mode: 'skip' };
        } else {
          const ambig = parseAmbiguousNumericDate(trimmed);
          if (ambig !== null) {
            info = { mode: 'date', ambiguous: ambig };
          } else {
            const parsed = parseDateLike(trimmed);
            info = { mode: 'date', month: parsed.month, day: parsed.day, year: parsed.year };
          }
        }
      } else if (isTimeLike(trimmed)) {
        info = opts.simplifyTimes ? { mode: 'time' } : { mode: 'skip' };
      } else {
        const num = toNumber(text);
        if (num !== null) {
          if (isCellWholeLink(cell)) {
            info = { mode: 'skip' };
          } else if (cell.querySelector && cell.querySelector('sup')) {
            // mode:'extracted' is skipped on grids (nodeValue-only write model).
            // Tracked in issue #120.
            info = { mode: 'skip' };
          } else {
            info = { mode: 'pure', num };
          }
        } else if (opts.simplifyMixedCells) {
          // mode:'extracted' is skipped on grids (nodeValue-only write model).
          // Tracked in issue #120.
          info = { mode: 'skip' };
        } else {
          info = { mode: 'skip' };
        }
      }

      const entryIdx = cellEntries.length;
      cellEntries.push({ cellObj, text, trimmed, info, col, rowIdx: r });

      if (info.mode === 'date' && info.ambiguous) {
        if (!ambigByCol.has(col)) ambigByCol.set(col, []);
        ambigByCol.get(col).push(entryIdx);
      }
    }
  }

  // --- Column post-pass: resolve ambiguous date cells per column ---
  for (const [col, indices] of ambigByCol) {
    let hasN1gt12 = false;
    let hasN2gt12 = false;
    for (const idx of indices) {
      const { info } = cellEntries[idx];
      if (info.ambiguous.n1 > 12) hasN1gt12 = true;
      if (info.ambiguous.n2 > 12) hasN2gt12 = true;
    }
    let formatHint;
    if (hasN1gt12 && !hasN2gt12) {
      formatHint = 'DMY';
    } else if (hasN2gt12 && !hasN1gt12) {
      formatHint = 'MDY';
    } else if (hasN1gt12 && hasN2gt12) {
      formatHint = 'MIXED';
    } else {
      formatHint = 'AMBIGUOUS';
    }
    for (const idx of indices) {
      const entry = cellEntries[idx];
      const { info } = entry;
      if (formatHint === 'MDY') {
        entry.info = { mode: 'date', month: info.ambiguous.n1, day: info.ambiguous.n2, year: info.ambiguous.year };
      } else if (formatHint === 'DMY') {
        entry.info = { mode: 'date', month: info.ambiguous.n2, day: info.ambiguous.n1, year: info.ambiguous.year };
      } else {
        entry.info = { mode: 'skip' };
      }
    }
  }
  // --- End column post-pass ---

  // --- Pass 2: compute max_mag over filtered (in-range, non-excluded) numeric cells ---
  const allNums = [];
  for (const { info } of cellEntries) {
    if (info.mode === 'pure') allNums.push(info.num);
    // mode:'extracted' is skipped on grids, so no extracted nums here
  }
  const max_mag = findMaxMagnitude([allNums]);

  // --- Pass 3: compute target value for each cell ---
  const results = [];
  for (const { cellObj, text, trimmed, info } of cellEntries) {
    if (info.mode === 'skip') {
      results.push({ cellObj, targetValue: null });
      continue;
    }

    let targetValue = null;

    if (info.mode === 'date') {
      const prefilled = (info.month !== undefined)
        ? { month: info.month, day: info.day, year: info.year }
        : undefined;
      const rounded = roundDateText(text, opts.dateGranularity, prefilled);
      if (rounded !== null && rounded !== text) targetValue = rounded;
    } else if (info.mode === 'time') {
      const rounded = roundTimeText(text, opts.timeGranularity);
      if (rounded !== null && rounded !== text) targetValue = rounded;
    } else if (info.mode === 'pure') {
      const roundedValue = roundCellSetAware(info.num, info.num, max_mag, offsetTop, offsetOther, numTop);
      const formatted = restoreFormatting(roundedValue, text, floorDecimals);
      if (formatted !== trimmed) targetValue = formatted;
    }
    // mode:'extracted' → targetValue stays null (skip on grid)

    results.push({ cellObj, targetValue });
  }

  return results;
}

/**
 * Re-apply grid rounding to all currently-visible cells of `wrapperEl`.
 * Called by the debounced MutationObserver after scroll or sort events.
 *
 * Delegates ALL classification and value computation to `computeGridRoundedValues`
 * — the same function used by the initial `roundTable` grid pass — so the two
 * passes are guaranteed to produce identical results for any given visible DOM
 * state and opts.  In particular, re-apply now honours:
 *   - isInRanges (cells outside the user's range are left untouched)
 *   - getExclusionReason (firstRow / firstColumn / percent / currency)
 *   - whole-cell-quote, date/time, isCellWholeLink, <sup> handling
 *   - max_mag computed over the same filtered in-range, non-excluded cell set
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

  // Delegate to the single shared classify+compute function.
  // targetValue is null for excluded/out-of-range/skip cells (leave untouched).
  const cellTargets = computeGridRoundedValues(wrapperEl, opts);

  for (const { cellObj, targetValue } of cellTargets) {
    // null means "leave unchanged" — excluded, out-of-range, or no change needed.
    if (targetValue === null) continue;

    const tn = findCellTextNode(cellObj.el);
    if (!tn) continue;
    const currentValue = tn.nodeValue;

    // Only write if the live text node differs from the computed target.
    if (currentValue === targetValue) continue;

    // Store the original value on freshly-recycled rows (not yet rounded by us).
    if (cellObj.el.dataset && cellObj.el.dataset.drOriginal === undefined) {
      cellObj.el.dataset.drOriginal = currentValue;
    }
    tn.nodeValue = targetValue;
    if (cellObj.el.classList) cellObj.el.classList.add(GRID_ROUNDED_CLASS);
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

  // --- Virtualized grid path ---
  // Delegate ALL classification and value computation to computeGridRoundedValues
  // so the initial write pass and reapplyGridRounding share one gated path and
  // cannot produce diverging results for the same visible DOM + opts.
  if (isVirtualized) {
    const cellTargets = computeGridRoundedValues(table, opts);
    for (const { cellObj, targetValue } of cellTargets) {
      // null means "leave unchanged" — excluded, out-of-range, or no change needed.
      if (targetValue === null) continue;
      cellObj.setText(targetValue);
    }
    syncSwitchForTable(table);

    // Attach the scroll/sort re-apply observer AFTER the initial pass so our own
    // nodeValue writes above do not immediately re-trigger it.
    if (typeof MutationObserver !== 'undefined') {
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
    return;
  }

  // --- Native <table> path (byte-identical to prior implementation) ---
  const data = [];
  // For native tables, cellsMap stores raw element.
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
      // For native adapters carry the raw element (unchanged).
      rowCells.push(cell);

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
              // Issue #4: drop era-marked years (e.g. "2898 AD") — dates, not
              // numbers to be offset-rounded.
              matches = matches.filter(m => !isEraYear(text, m.index, m.numStr));
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
          // Issue #4: drop era-marked years (e.g. "2898 AD") — dates, not
          // numbers to be offset-rounded.
          matches = matches.filter(m => !isEraYear(text, m.index, m.numStr));
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
  syncSwitchForTable(table);
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

// ROUND_DYNAMIC, singleValueMode, datasetMode, findMaxMagnitude, toNumber, and
// validateOffset (plus DEFAULT_OFFSET_TOP, DEFAULT_NUM_TOP, VALIDATION_LIMIT,
// CLEAN_REGEX, PARENS_REGEX) live in core.js, loaded by manifest content_scripts
// ahead of this file so the sidebar can call the same ROUND_DYNAMIC core.
