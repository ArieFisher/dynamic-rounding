/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * DOM adapters and low-level DOM read/write primitives (the "driven" side).
 *
 * The TableAdapter abstraction (NativeTableAdapter / GridAdapter, chosen by
 * makeAdapter) gives the engine a uniform row/cell interface over native
 * <table> elements and div-based virtual grids. Also holds the grid-shape
 * constants and the structure-preserving cell-write helpers
 * (replaceTextPreservingHTML, applyExtractedPatches, getSuperscriptRanges,
 * link filtering). Loaded by manifest content_scripts before content.js.
 */

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
   *
   * Row source order: [role="row"] → .dg--virtual-row → <tr> → repetitive
   * children. The <tr> source covers ARIA grids (role="grid"/"table") that
   * render their rows as bare <tr> elements without role="row" — e.g. Kaggle's
   * Data Explorer, whose movie rows are orphan <tr> inside the grid.
   *
   * Scoping: when the container groups rows in one or more [role="rowgroup"]
   * elements (the ARIA analog of <tbody>), row discovery is restricted to those
   * groups. This keeps header rows and per-column summary/stats rows — which
   * sit OUTSIDE the rowgroup — from being treated as data rows. Both signals are
   * standard ARIA, so this stays general (not site-specific).
   *
   * @param {Element} container
   * @returns {Element[]}
   */
  _getRowEls(container) {
    if (!container) return [];
    if (!container.querySelectorAll) {
      return container.children ? Array.from(container.children) : [];
    }
    // Scope to ARIA rowgroup(s) when present so header/summary rows outside the
    // group are excluded; otherwise search the whole container.
    const rowgroups = container.querySelectorAll('[role="rowgroup"]');
    const scopes = (rowgroups && rowgroups.length > 0)
      ? Array.from(rowgroups)
      : [container];

    for (const sel of ['[role="row"]', '.dg--virtual-row', 'tr']) {
      let rows = [];
      for (const scope of scopes) {
        if (scope.querySelectorAll) rows = rows.concat(Array.from(scope.querySelectorAll(sel)));
      }
      if (rows.length > 0) return rows;
    }
    // Fallback: repetitive children of the first scope.
    const first = scopes[0];
    if (first && first.children) return Array.from(first.children);
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

// --- Table/grid detection predicates ---
// Decide whether an element is a roundable table/grid. Grouped with the adapters
// because they read DOM shape and lean on the GRID_* constants and makeAdapter
// defined above. Consumed by the toggle UI (ui-toggle.js) and the engine.

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
/** Left-offset threshold (px) below which an element is treated as deliberately off-screen hidden. */
const OFFSCREEN_LEFT_PX_THRESHOLD = -9999;

/**
 * Return the nearest *positioned* ancestor of `el` (or `el` itself if it is
 * positioned).  An element is "positioned" when its CSS position is one of
 * relative | absolute | fixed | sticky.  We check inline style first (works in
 * both real browser and Node test harness), then fall back to getComputedStyle
 * when available.  Returns null when no positioned ancestor is found.
 *
 * @param {Element} el
 * @returns {Element|null}
 */
function _nearestPositionedAncestor(el) {
  const POSITIONED = new Set(['relative', 'absolute', 'fixed', 'sticky']);
  let current = el;
  while (current) {
    if (typeof current.getAttribute !== 'function') {
      // Not a real element node; step up
      current = current.parentElement || current.parentNode || null;
      continue;
    }
    let pos = '';
    // Inline style is reliable in both browser and Node harness
    if (current.style && typeof current.style.position === 'string') {
      pos = current.style.position;
    }
    // Computed style when inline is absent and getComputedStyle is available
    if (!pos && typeof getComputedStyle === 'function') {
      try { pos = getComputedStyle(current).position || ''; } catch (e) { /* ignore */ }
    }
    if (POSITIONED.has(pos)) return current;
    current = current.parentElement || current.parentNode || null;
  }
  return null;
}

/**
 * Parse a CSS length string (e.g. "-10000px") to a float.  Returns NaN when
 * the value is absent or non-numeric.
 *
 * @param {string} value
 * @returns {number}
 */
function _parsePx(value) {
  if (typeof value !== 'string' || value === '') return NaN;
  return parseFloat(value);
}

/**
 * Determine whether a <table> element is an off-screen / aria-hidden /
 * SVG-chart-fallback accessibility artifact rather than real page content.
 *
 * Returns true when ANY ONE of the following signals holds:
 *   1. The table (or any ancestor) carries aria-hidden="true".
 *   2. The table's nearest positioned ancestor (or the table itself) has an
 *      inline or computed `left` value ≤ OFFSCREEN_LEFT_PX_THRESHOLD px.
 *      NOTE: In the Node test harness getComputedStyle does not report a
 *      meaningful `left`; this check therefore relies primarily on inline style.
 *   3. The table is inside a nearest positioned ancestor that also contains an
 *      <svg> with a non-empty aria-label (a "chart-ish" SVG), indicating the
 *      table is an a11y fallback for a chart rendered by that SVG.
 *
 * @param {Element} table
 * @returns {boolean}
 */
function isPhantomA11yTable(table) {
  if (!table || typeof table.getAttribute !== 'function') return false;

  // --- Signal 1: aria-hidden on self or any ancestor ---
  let node = table;
  while (node) {
    if (typeof node.getAttribute === 'function') {
      if (node.getAttribute('aria-hidden') === 'true') return true;
    }
    node = node.parentElement || node.parentNode || null;
    // Stop at document root (no parentElement means we've left the element tree)
    if (node && typeof node.tagName === 'undefined') break;
  }

  // --- Signal 2: nearest positioned ancestor has left ≤ threshold ---
  const posAncestor = _nearestPositionedAncestor(table);
  const checkEl = posAncestor || table;

  let leftVal = NaN;
  // Prefer inline style (works in Node harness too)
  if (checkEl.style && typeof checkEl.style.left === 'string') {
    leftVal = _parsePx(checkEl.style.left);
  }
  // Fall back to computed style when inline is absent
  if (isNaN(leftVal) && typeof getComputedStyle === 'function') {
    try {
      const computed = getComputedStyle(checkEl);
      if (computed && computed.left) leftVal = _parsePx(computed.left);
    } catch (e) { /* ignore */ }
  }
  if (!isNaN(leftVal) && leftVal <= OFFSCREEN_LEFT_PX_THRESHOLD) return true;

  // --- Signal 3: nearest positioned ancestor contains a chart-ish <svg> ---
  if (posAncestor) {
    // Use querySelector when available (browser); fall back gracefully in harness
    if (typeof posAncestor.querySelector === 'function') {
      try {
        const svgs = posAncestor.querySelectorAll('svg');
        for (let i = 0; i < svgs.length; i++) {
          const svg = svgs[i];
          if (typeof svg.getAttribute === 'function') {
            const label = svg.getAttribute('aria-label');
            if (typeof label === 'string' && label.trim() !== '') return true;
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  return false;
}

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
