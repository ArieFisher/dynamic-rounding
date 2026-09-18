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
 *
 * This file is the lib/dr-table package's detection layer. Detection
 * (isDataTable, looksLikeGrid, findTargetTable, isPhantomA11yTable) reports
 * findings only — it never writes a marker class or builds a toggle widget,
 * and (app-model-registry sprint) it never reads the dr-ext-grid class as
 * state either: "have I already found this element" is an injected opts.isSeen
 * check (see findTargetTable, findTables). Callers (ui-toggle.js, content.js)
 * own both sides: they check DR_STORE's table registry and, for a first-time
 * match, write the dr-ext-grid marker (a style hook only, from here on) and
 * construct the widget.
 *
 * Every environment-sensitive read (computed style, offsetWidth, number
 * parsing, the vendor grid selectors, `document` itself) goes through a
 * small port with a working default, so the functions below run under a
 * plain Node/jsdom-less context with no Chrome globals and no `window`.
 *
 * Every detection setting this file reads — the child-count floor, the walk-depth
 * cap, the column-width sample size and agreement threshold, the repetition
 * share, the data test's cell budget, the off-screen threshold, and the
 * vendor and display-value lookup lists — lives in DR_DETECTION_SETTINGS (constants.js).
 * The content script loads
 * constants.js before this file, so this file reads DR_DETECTION_SETTINGS as a bare
 * global with no local fallback copy of any of those values.
 * GRID_VENDOR_PROFILES below reads DR_DETECTION_SETTINGS at the top level, so a missing
 * object fails at load, before any function in this file runs.
 */

// Grid detection constants
/** CSS selector for the cheap load-time ARIA pass. */
const GRID_ARIA_SELECTOR = '[role="grid"], [role="table"]';
/** Node.ELEMENT_NODE, with a fallback for contexts with no `Node` global (its value, 1, is part of the DOM spec and never changes). */
const DR_TABLE_ELEMENT_NODE = (typeof Node !== 'undefined' && Node.ELEMENT_NODE) || 1;

// --- Ports: pluggable defaults for environment-sensitive reads ---
// Each accepts an optional `opts` bag on the calling function; every default
// below mirrors this file's pre-port behavior exactly when the real browser
// globals are present, and degrades to a safe, working default when they are
// not — that degradation, not a thrown error, is what lets detection run
// standalone (a Node script, a unit test, a future non-extension host).

/**
 * StyleProbe: the shared source for every guarded getComputedStyle/offsetWidth
 * read in this file (looksLikeGrid's display and column-width checks,
 * isPhantomA11yTable's positioned-ancestor check, getSuperscriptRanges'
 * vertical-align check). With no real getComputedStyle, assumes a normal,
 * visible, statically-positioned block element — the jsdom-less default that
 * lets detection keep running instead of reasoning from an absent style.
 */
const DEFAULT_STYLE_PROBE = {
  getComputedStyle(el) {
    if (typeof getComputedStyle === 'function') {
      try { return getComputedStyle(el) || null; } catch (e) { return null; }
    }
    return { display: 'block', visibility: 'visible', position: 'static', left: '', verticalAlign: '' };
  },
  getOffsetWidth(el) {
    return (el && typeof el.offsetWidth === 'number') ? el.offsetWidth : -1;
  },
};

/**
 * NumericProbe: parses a cell's text to a number for the "does this look
 * numeric" checks in looksLikeGrid/isDataTable. This default is a
 * self-contained, byte-equivalent port of the predicate detection used
 * before the lib/dr-table extraction: strip currency/comma/percent/
 * whitespace symbols, then parseFloat. It deliberately does NOT delegate to
 * DR_NUMBER.toNumber — that parser's unicode-minus and parenthesized-negative
 * handling changes which tables are detected (dates, times, and unit-suffixed
 * cells lose their toggle; accounting negatives gain one). A caller that
 * wants DR_NUMBER-aware detection passes a custom probe via opts.numericProbe.
 */
const DEFAULT_NUMERIC_PROBE = {
  parse(text) {
    const cleaned = String(text).trim().replace(/[$€£¥,\s%]/g, '');
    if (cleaned === '') return null;
    const parsed = parseFloat(cleaned);
    return isFinite(parsed) ? parsed : null;
  },
};

// VendorProfiles: known third-party grid libraries. `classToken` short-
// circuits looksLikeGrid's geometry probe; `scrollContainerSelectors` /
// `pinnedPaneSelectors` resolve GridAdapter's scroll and pinned panes. A
// consumer may pass a custom list via opts.vendorProfiles.
//
// The read sits at the top level, so a missing DR_DETECTION_SETTINGS object fails at
// load, before GridAdapter or looksLikeGrid runs.
const GRID_VENDOR_PROFILES = DR_DETECTION_SETTINGS.vendorProfiles;

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
    // isOutside marks a footer-section row — the native analog of a grid row
    // outside the row group. Outside rows round like any other, but their
    // values stay out of the dataset: consumers skip them when computing the
    // max magnitude and the lens preview pool.
    return Array.from(this.el.rows).map(row => ({
      isOutside: !!((row.parentElement || row.parentNode) &&
        (row.parentElement || row.parentNode).tagName === 'TFOOT'),
      getCells() {
        return Array.from(row.cells).map(cell => ({
          // No setText: the native path writes cells directly in roundTable so it
          // can preserve markup in mixed cells and stash both originalHtml and
          // originalValue. A textContent-based setText here would flatten mixed
          // cells and skip originalValue, silently feeding the sidebar preview
          // its own rounded output.
          getText() { return cell.innerText || cell.textContent || ''; },
          // The displayed text: what the screen shows right now. On a native
          // cell that is the same live read getText() uses (the native write
          // path never shadows it); the method exists so consumers that need
          // "as displayed" — the capture's state serializer — can use one
          // read on either adapter kind. GridAdapter's counterpart differs:
          // there getText() answers with the original through the originals
          // port once the cell is rounded.
          getDisplayedText() { return cell.innerText || cell.textContent || ''; },
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

/**
 * OriginalsPort: pluggable per-cell "what did this cell say before I rounded
 * it" storage for GridAdapter's getText/setText, following the same port-
 * with-a-working-default pattern as StyleProbe/NumericProbe above. The
 * default is a private WeakMap<cellEl, text> — correct for a standalone or
 * test caller with no application model to hand in. content.js's real call
 * sites inject a port backed by DR_STORE's per-table registry entry (see
 * app/store.js, loaded after this file) instead, which is what makes a
 * grid's originals survive a rounding toggle without a page attribute.
 * A custom port is passed via opts.originalsPort on makeAdapter/GridAdapter.
 */
function makeDefaultOriginalsPort() {
  const store = new WeakMap();
  return {
    has(cellEl) { return store.has(cellEl); },
    get(cellEl) { return store.get(cellEl); },
    set(cellEl, text) { store.set(cellEl, text); },
  };
}
const DEFAULT_ORIGINALS_PORT = makeDefaultOriginalsPort();

class GridAdapter {
  constructor(el, opts = {}) {
    this.el = el;
    this.vendorProfiles = opts.vendorProfiles || GRID_VENDOR_PROFILES;
    this.originalsPort = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
  }
  getElement() { return this.el; }
  isVirtualized() { return true; }

  /**
   * Return the scroll container for this grid.
   * Priority: known library selectors → else this.el.
   */
  _getScrollContainer() {
    const el = this.el;
    // Known library selectors (single-pane database query grids, AG Grid, etc.), plus
    // the generic ARIA grid role as a final, vendor-agnostic fallback.
    const knownSelectors = [
      ...this.vendorProfiles.flatMap((p) => p.scrollContainerSelectors || []),
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
   * Returns null for single-pane grids (database query grids).
   */
  _getPinnedPane(scrollContainer) {
    const pinnedSelectors = this.vendorProfiles.flatMap((p) => p.pinnedPaneSelectors || []);
    const el = this.el;
    for (const sel of pinnedSelectors) {
      const found = el.querySelector && el.querySelector(sel);
      if (found && found !== scrollContainer) return found;
    }
    return null;
  }

  /**
   * Extract rows from a container element, each as { el, isOutside }.
   *
   * Row source order: [role="row"] → .dg--virtual-row → <tr> → repetitive
   * children. The <tr> source covers ARIA grids (role="grid"/"table") that
   * render their rows as bare <tr> elements without role="row" — e.g. Kaggle's
   * Data Explorer, whose movie rows are orphan <tr> inside the grid.
   *
   * Rowgroups pick the row shape, not the row set: when the container groups
   * rows in one or more [role="rowgroup"] elements (the ARIA analog of
   * <tbody>), a selector wins only when it matches rows INSIDE a group — so a
   * stray decorated block (e.g. Kaggle's role="row" description panel) cannot
   * beat the <tr> rows that hold the data. The returned list is then the
   * container-wide match list for that winning selector, in document order:
   * header and summary rows outside the group count as rows like any other,
   * and only the shipped first-row/first-column defaults hold them — the same
   * treatment a native table's <thead> and Total rows get. Row position in
   * this list IS the row's literal row number.
   *
   * isOutside marks the rows not inside any rowgroup. An outside row rounds
   * like any other, but its values stay out of the dataset: consumers skip it
   * when computing the max magnitude and the lens preview pool.
   *
   * @param {Element} container
   * @returns {{el: Element, isOutside: boolean}[]}
   */
  _getRowEntries(container) {
    if (!container) return [];
    if (!container.querySelectorAll) {
      const kids = container.children ? Array.from(container.children) : [];
      return kids.map((el) => ({ el, isOutside: false }));
    }
    const rowgroups = container.querySelectorAll('[role="rowgroup"]');
    const isGrouped = !!(rowgroups && rowgroups.length > 0);
    const scopes = isGrouped ? Array.from(rowgroups) : [container];

    for (const sel of ['[role="row"]', '.dg--virtual-row', 'tr']) {
      let rows = [];
      for (const scope of scopes) {
        if (scope.querySelectorAll) rows = rows.concat(Array.from(scope.querySelectorAll(sel)));
      }
      if (rows.length === 0) continue;
      if (!isGrouped) return rows.map((el) => ({ el, isOutside: false }));
      // The winning selector's full universe, not just the in-group matches;
      // a universe row not inside any group is an outside row.
      const inGroup = new Set(rows);
      return Array.from(container.querySelectorAll(sel))
        .map((el) => ({ el, isOutside: !inGroup.has(el) }));
    }
    // Fallback: repetitive children of the first scope. When row groups are
    // present this is non-conforming markup (a group must own rows), and the
    // fallback stays narrow — the first group's children only — rather than
    // guessing at rows among the container's mixed children; the whole-grid
    // row universe above applies only to rows a selector can name.
    const first = scopes[0];
    if (first && first.children) {
      return Array.from(first.children).map((el) => ({ el, isOutside: false }));
    }
    return [];
  }

  /**
   * Extract row elements from a container — _getRowEntries without the
   * outside-row marking, for callers that only stitch by list position
   * (pinned panes).
   * @param {Element} container
   * @returns {Element[]}
   */
  _getRowEls(container) {
    return this._getRowEntries(container).map((entry) => entry.el);
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
    const port = this.originalsPort;
    return {
      el: cellEl,
      tagName: 'TD', // grid cells are treated as data cells (no <th> concept)
      getText() {
        // Prefer the stored original (if already rounded), else live text
        if (port.has(cellEl)) {
          return port.get(cellEl);
        }
        const tn = findCellTextNode(cellEl);
        return tn ? tn.nodeValue : (cellEl.textContent || '');
      },
      setText(s) {
        const tn = findCellTextNode(cellEl);
        // No text node to patch: the write skips, and the caller reads the
        // false so a skipped write never counts toward the table's form.
        if (tn === null) return false;
        // Store the original value once, through the port.
        if (!port.has(cellEl)) {
          port.set(cellEl, tn.nodeValue);
        }
        // Patch in place — NEVER replace the node (preserves React fiber identity).
        tn.nodeValue = s;
        if (cellEl.classList) cellEl.classList.add(GRID_ROUNDED_CLASS);
        return true;
      },
      // The displayed text: what the screen shows right now — the cell's
      // whole live text, never the originals port. On a rounded grid cell
      // getText() above answers with the ORIGINAL (the engine's contract:
      // classification must see pre-round text), so a consumer that needs
      // "as displayed" — the capture's state serializer — reads this one.
      // The whole text, not findCellTextNode's one node: a cell that builds
      // its text from several pieces (a number and a unit in separate
      // nodes) displays all of them, matching the native read.
      // Declared after setText so the GR3b/GR6j source guards' fixed scan
      // window over _makeCellObj still covers the write path.
      getDisplayedText() {
        return cellEl.textContent || '';
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

    const scrollEntries = this._getRowEntries(scrollContainer);
    if (scrollEntries.length === 0) return [];

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
    return scrollEntries.map(({ el: rowEl, isOutside }, idx) => {
      const scrollKey = adapter._getRowKey(rowEl, idx);
      // Find the matching pinned row (by data-row / data-index / DOM index).
      let pinnedRowEl = pinnedByKey.get(scrollKey) || (pinnedRows[idx] || null);

      return {
        isOutside,
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
function makeAdapter(el, opts = {}) {
  if (el.tagName === 'TABLE' || (el.tagName === undefined && el.rows)) {
    return new NativeTableAdapter(el);
  }
  return new GridAdapter(el, opts);
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
 * - If doc.createTreeWalker is unavailable, returns [].
 * - The vertical-align check goes through opts.styleProbe (default:
 *   DEFAULT_STYLE_PROBE), so the helper never throws when getComputedStyle
 *   is absent.
 * @param {Element} cell
 * @param {{doc?: Document, styleProbe?: object}} [opts]
 * @returns {{start: number, end: number}[]}
 */
function getSuperscriptRanges(cell, opts = {}) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  if (!cell || !doc || typeof doc.createTreeWalker !== 'function') {
    return [];
  }
  const ranges = [];
  const treeWalker = doc.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
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
        if (!isSup) {
          const style = styleProbe.getComputedStyle(ancestor);
          if (style && style.verticalAlign === 'super') {
            isSup = true;
            break;
          }
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
  // lib/dr-table also runs standalone (test sandboxes evaluate this file
  // alone), so the row routes through DR_LOG only when dr-log is loaded.
  (typeof DR_LOG !== 'undefined' ? DR_LOG : console).debug("Dynamic Rounding: Skipped complex multi-node cell replacement to preserve layout.");
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
 * A patch is skipped when its node cannot be found or numStr is not at the
 * expected position. Returns the number of patches that landed: the caller
 * records the cell as simplified only on a count above zero, because a
 * skipped patch leaves the screen unchanged.
 *
 * @returns {number} how many patches landed
 */
function applyExtractedPatches(cell, patches) {
  if (!patches || patches.length === 0) return 0;
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
  const nodePositions = [];
  let flatLen = 0;
  let node;
  while ((node = walker.nextNode())) {
    nodePositions.push({ node, start: flatLen });
    flatLen += node.nodeValue.length;
  }
  const sorted = [...patches].sort((a, b) => b.index - a.index);
  let landed = 0;
  for (const { index, numStr, newNum } of sorted) {
    const pos = nodePositions.find(
      p => p.start <= index && index < p.start + p.node.nodeValue.length
    );
    if (!pos) continue;
    const i = index - pos.start;
    const v = pos.node.nodeValue;
    if (v.substring(i, i + numStr.length) !== numStr) continue;
    pos.node.nodeValue = v.substring(0, i) + newNum + v.substring(i + numStr.length);
    landed++;
  }
  return landed;
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
 *   - a class matching one of opts.vendorProfiles' classToken (default:
 *     GRID_VENDOR_PROFILES — "dg--" or "ag-")
 *
 * @param {Element} el
 * @param {{styleProbe?: object, numericProbe?: object, vendorProfiles?: object[]}} [opts]
 * @returns {boolean}
 */
function looksLikeGrid(el, opts = {}) {
  if (!el || typeof el.children === 'undefined') return false;
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  const numericProbe = opts.numericProbe || DEFAULT_NUMERIC_PROBE;
  const vendorProfiles = opts.vendorProfiles || GRID_VENDOR_PROFILES;

  // --- Step 1: Child count ≥ DR_DETECTION_SETTINGS.gridMinChildren ---
  const children = Array.from(el.children);
  if (children.length < DR_DETECTION_SETTINGS.gridMinChildren) return false;

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
  // At least DR_DETECTION_SETTINGS.gridRepetitionShare of children must share a class
  // token OR a child count.
  const repetitionFloor = children.length * DR_DETECTION_SETTINGS.gridRepetitionShare;
  const repetitive = (maxClassCount >= repetitionFloor) || (maxChildCount >= repetitionFloor);
  if (!repetitive) return false;

  // --- Step 3: Consistent cell count — candidate rows have equal child counts ---
  // The modal child count must appear in at least DR_DETECTION_SETTINGS.gridRepetitionShare
  // of the children.
  let modalChildCount = 0;
  let modalFreq = 0;
  for (const [cc, freq] of childCountFreq) {
    if (freq > modalFreq && cc > 0) { modalFreq = freq; modalChildCount = cc; }
  }
  if (modalFreq < repetitionFloor) return false;

  // Candidate rows: children whose child count equals the modal.
  const candidateRows = children.filter(c => c.children.length === modalChildCount);

  // --- Step 4: Layout — display is grid or flex ---
  const computedForDisplay = styleProbe.getComputedStyle(el);
  const display = (computedForDisplay && computedForDisplay.display) || '';
  if (!DR_DETECTION_SETTINGS.gridDisplayValues.includes(display)) return false;

  // --- Step 5: Numeric content — ≥ 1 cell parses as a finite number (mandatory) ---
  let hasNumeric = false;
  outer:
  for (const row of candidateRows) {
    for (const cell of Array.from(row.children)) {
      const text = (cell.textContent || '').trim();
      const parsed = text === '' ? null : numericProbe.parse(text);
      if (parsed !== null && isFinite(parsed)) { hasNumeric = true; break outer; }
    }
  }
  if (!hasNumeric) return false;

  // --- Short-circuit ACCEPT before geometry probe ---
  const role = el.getAttribute && el.getAttribute('role');
  if (role === 'grid' || role === 'table') return true;
  const elClass = (el.className && typeof el.className === 'string') ? el.className : '';
  if (vendorProfiles.some(profile => elClass.includes(profile.classToken))) return true;

  // --- Step 6: Column-width alignment — sample offsetWidth of column-0 cells ---
  // Bounded to DR_DETECTION_SETTINGS.gridColumnWidthSample rows; only runs when all prior
  // steps passed.
  const sample = candidateRows.slice(0, DR_DETECTION_SETTINGS.gridColumnWidthSample);
  const widths = sample.map(row => row.children[0] ? styleProbe.getOffsetWidth(row.children[0]) : -1)
                       .filter(w => w > 0);
  if (widths.length < 2) return true; // too few rows to measure — benefit of the doubt
  const firstWidth = widths[0];
  // Accept when the sampled-width agreement meets DR_DETECTION_SETTINGS.gridColumnWidthAgreement.
  const matchCount = widths.filter(w => w === firstWidth).length;
  return matchCount / widths.length >= DR_DETECTION_SETTINGS.gridColumnWidthAgreement;
}

/**
 * Find the best grid/table root for the element `el` was right-clicked inside.
 *
 * Resolution order (per D1 / S6):
 *   1. Nearest <table> ancestor (cheapest, most precise).
 *   2. Nearest ancestor (or el itself) already registered as found, per
 *      opts.isSeen.
 *   3. The nomination step (findTables), run from the chain root of the nest
 *      el sits in; return the element the configured nesting depth selects.
 *      This route registers a marked grid the load-time scan missed.
 *   4. Walk UP from el calling looksLikeGrid at each ancestor; return the
 *      OUTERMOST match — keep walking while the parent also passes; stop when
 *      the parent fails, is <body>, or depth exceeds DR_DETECTION_SETTINGS.gridWalkDepthCap.
 *
 * REPORTS only — this function never writes the dr-ext-grid marker class and
 * never builds a toggle widget, and it never reads that class either: "has
 * this element already been found" is opts.isSeen, a caller-supplied check
 * (e.g. the app model's table registry), following the same contract
 * findTables (below) already uses. Without opts.isSeen, step 2 is a no-op
 * and cases 3 and 4 report isNew: true throughout: this function keeps no
 * registry of its own, so without opts.isSeen every result reports isNew:
 * true.
 *
 * It returns { handle, isNew }, where `handle` is the resolved element and
 * `isNew` tells the caller whether this is the first time resolution has
 * reached this element — i.e. whether the caller still needs to mark it and
 * construct its widget. Case 1 resolves to an element the caller already
 * knows how to handle (a bare <table>), so isNew is always false for it;
 * cases 2, 3 and 4 defer to opts.isSeen.
 *
 * Returns null if nothing found.
 *
 * @param {Element} el
 * @param {{styleProbe?: object, numericProbe?: object, vendorProfiles?: object[], doc?: Document, isSeen?: (handle: Element) => boolean}} [opts]
 * @returns {{handle: Element, isNew: boolean}|null}
 */
function findTargetTable(el, opts = {}) {
  if (!el) return null;
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const isSeen = opts.isSeen || (() => false);
  const docBody = doc && doc.body;

  // 1. Nearest <table> ancestor.
  if (typeof el.closest === 'function') {
    const tableAncestor = el.closest('table');
    if (tableAncestor) return { handle: tableAncestor, isNew: false };
  }

  // 2. Nearest already-found ancestor (or el itself), per opts.isSeen — a
  // walk-up rather than a closest('.dr-ext-grid') query, since isSeen is an
  // arbitrary per-element check (typically a WeakMap-backed registry.has),
  // not a CSS selector.
  let seenCandidate = el;
  let seenDepth = 0;
  while (seenCandidate && seenCandidate !== docBody && seenDepth < DR_DETECTION_SETTINGS.gridWalkDepthCap) {
    if (seenCandidate.nodeType === DR_TABLE_ELEMENT_NODE && isSeen(seenCandidate)) {
      return { handle: seenCandidate, isNew: false };
    }
    seenCandidate = seenCandidate.parentElement || seenCandidate.parentNode;
    seenDepth++;
  }

  // 3. The nomination step, run from the chain root of the nest el sits in.
  // The step applies the configured nesting depth to the whole nest, so the
  // element it selects can be a sibling of the clicked element: a click in a
  // vendor grid's row-number gutter resolves the scrolling pane beside it.
  // Pass 1 of the step returns nothing here: a qualifying chain root holds no
  // native table other than accessibility artifacts, so the step's one result
  // is the nomination.
  //
  // The step returns nothing for a nest whose chain is empty, for a depth
  // holding more than one element, and for a nest already holding a registered
  // element; each of those falls through to the geometry probe below, which is
  // the behavior issue #382 records for a click in a sibling pane of a
  // registered nest.
  const chainRoot = chainRootOf(el, opts);
  if (chainRoot) {
    const nominated = findTables(chainRoot, { ...opts, isSeen })[0];
    if (nominated) return { handle: nominated.handle, isNew: !isSeen(nominated.handle) };
  }

  // 4. Walk up, calling looksLikeGrid; return the outermost consecutive match.
  let current = el.parentElement || el.parentNode;
  let depth = 0;
  let outermost = null;

  while (current && current !== docBody && depth < DR_DETECTION_SETTINGS.gridWalkDepthCap) {
    if (current.nodeType !== DR_TABLE_ELEMENT_NODE) {
      current = current.parentElement || current.parentNode;
      depth++;
      continue;
    }
    if (looksLikeGrid(current, opts)) {
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
    return { handle: outermost, isNew: !isSeen(outermost) };
  }

  return null;
}

// Left-offset threshold (px) below which an element is treated as
// deliberately off-screen hidden: DR_DETECTION_SETTINGS.offscreenLeftPx.

/**
 * Return the nearest *positioned* ancestor of `el` (or `el` itself if it is
 * positioned).  An element is "positioned" when its CSS position is one of
 * relative | absolute | fixed | sticky.  We check inline style first (works in
 * both real browser and Node test harness), then fall back to getComputedStyle
 * when available.  Returns null when no positioned ancestor is found.
 *
 * @param {Element} el
 * @param {{styleProbe?: object}} [opts]
 * @returns {Element|null}
 */
function _nearestPositionedAncestor(el, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
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
    // Computed style when inline is absent
    if (!pos) {
      const style = styleProbe.getComputedStyle(current);
      if (style && style.position) pos = style.position;
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
 *      inline or computed `left` value ≤ DR_DETECTION_SETTINGS.offscreenLeftPx px.
 *      NOTE: In the Node test harness getComputedStyle does not report a
 *      meaningful `left`; this check therefore relies primarily on inline style.
 *   3. The table is inside a nearest positioned ancestor that also contains an
 *      <svg> with a non-empty aria-label (a "chart-ish" SVG), indicating the
 *      table is an a11y fallback for a chart rendered by that SVG.
 *
 * @param {Element} table
 * @param {{styleProbe?: object}} [opts]
 * @returns {boolean}
 */
function isPhantomA11yTable(table, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
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
  const posAncestor = _nearestPositionedAncestor(table, opts);
  const checkEl = posAncestor || table;

  let leftVal = NaN;
  // Prefer inline style (works in Node harness too)
  if (checkEl.style && typeof checkEl.style.left === 'string') {
    leftVal = _parsePx(checkEl.style.left);
  }
  // Fall back to computed style when inline is absent
  if (isNaN(leftVal)) {
    const computed = styleProbe.getComputedStyle(checkEl);
    if (computed && computed.left) leftVal = _parsePx(computed.left);
  }
  if (!isNaN(leftVal) && leftVal <= DR_DETECTION_SETTINGS.offscreenLeftPx) return true;

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

/**
 * @param {Element} table
 * @param {{numericProbe?: object, vendorProfiles?: object[]}} [opts]
 * @returns {boolean}
 */
function isDataTable(table, opts = {}) {
  const numericProbe = opts.numericProbe || DEFAULT_NUMERIC_PROBE;
  const adapter = makeAdapter(table, opts);
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
  // The scan spends one budget of DR_DETECTION_SETTINGS.dataTestCellBudget cell reads,
  // counted across every row and cell in document order, on native tables
  // and grids alike. An empty cell counts as a read. The scan returns true
  // at the first cell that parses as a finite number, and returns false once
  // it has spent the budget with no number found.
  let cellsRead = 0;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getCells();
    for (let j = 0; j < cells.length; j++) {
      if (cellsRead >= DR_DETECTION_SETTINGS.dataTestCellBudget) return false;
      cellsRead++;
      const text = cells[j].getText().trim();
      if (text === '') continue;
      const parsed = numericProbe.parse(text);
      if (parsed !== null && isFinite(parsed)) return true;
    }
  }
  return false;
}

/**
 * Read one table's shape fingerprint through the adapter: the column count
 * (the widest row's cell count) and, where the table has a header row, that
 * row's cell texts. The registry records it when the table registers, and
 * every action on a registered table compares the table's current shape
 * against the recorded one before it acts.
 *
 * The row count stays out of the fingerprint on purpose. A virtualized grid
 * creates and destroys rows on every scroll, so a row count would report a
 * scroll as a shape change.
 *
 * Header texts are read only where _hasHeaderRow holds for the first row the
 * adapter returns; otherwise headerTexts is null and the fingerprint is the
 * column count alone. A grid that groups nothing has a data row first, and a
 * scroll redraws it, so its text would report a scroll as a shape change.
 *
 * opts.originalText, when the caller supplies it, reads a cell's stored
 * pre-simplification text and returns undefined for a cell with none. A
 * fingerprint read through it stays the same while the extension simplifies
 * the table's own header cells, which is what keeps the extension's writes
 * from reading as a page change. Without it the read takes each cell's
 * current text.
 *
 * The return is plain values only, so a registry entry holding one stays
 * serializable.
 *
 * @param {Element} el
 * @param {{originalText?: (cellEl: Element) => (string|undefined),
 *          vendorProfiles?: object[], originalsPort?: object}} [opts]
 * @returns {{columnCount: number, headerTexts: string[]|null}}
 */
function readTableFingerprint(el, opts = {}) {
  const adapter = makeAdapter(el, opts);
  const rows = adapter.getRows();
  const readsHeader = rows.length > 0 && _hasHeaderRow(el, adapter, rows[0]);
  let columnCount = 0;
  let headerTexts = null;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getCells();
    if (cells.length > columnCount) columnCount = cells.length;
    if (i === 0 && readsHeader) {
      headerTexts = cells.map((cellObj) => _fingerprintCellText(cellObj, opts));
    }
  }
  return { columnCount, headerTexts };
}

/**
 * Whether the first row the adapter returns is a header row, which determines
 * whether the fingerprint carries header texts at all.
 *
 * On a grid the answer is the adapter's own outside-row mark: a grid that
 * groups its data rows puts its header row outside every group, and the
 * adapter marks that row isOutside. A grid that groups nothing — the shape a
 * database query grid takes — has a data row first, and a scroll redraws it,
 * so its text describes the rows on the screen rather than the table.
 *
 * On a native table the adapter's isOutside marks the footer section alone,
 * so the head section is read from the row itself: the row sits in a THEAD,
 * or it holds header cells and no data cell. The second form covers a table
 * written with a leading row of <th> and no explicit head section, which the
 * simplification engine already reads as a header row by skipping every <th>
 * cell it holds.
 *
 * @param {Element} el
 * @param {NativeTableAdapter|GridAdapter} adapter
 * @param {{isOutside: boolean, getCells(): object[]}} firstRow
 * @returns {boolean}
 */
function _hasHeaderRow(el, adapter, firstRow) {
  if (!(adapter instanceof NativeTableAdapter)) return firstRow.isOutside === true;
  const rowEl = el.rows && el.rows[0];
  const parent = rowEl && (rowEl.parentElement || rowEl.parentNode);
  if (parent && parent.tagName === 'THEAD') return true;
  const cells = firstRow.getCells();
  return cells.length > 0 && cells.every((cellObj) => cellObj.tagName === 'TH');
}

/**
 * One header cell's text for the fingerprint: its stored pre-simplification
 * text where opts.originalText holds one, the cell's current text otherwise.
 *
 * @param {{getText(): string, el: Element}} cellObj
 * @param {{originalText?: (cellEl: Element) => (string|undefined)}} opts
 * @returns {string}
 */
function _fingerprintCellText(cellObj, opts) {
  if (typeof opts.originalText === 'function') {
    const stored = opts.originalText(cellObj.el);
    if (stored !== undefined && stored !== null) return String(stored);
  }
  return cellObj.getText();
}

/**
 * Whether two shape fingerprints describe the same shape: the same column
 * count, and the same header texts element by element.
 *
 * Either side missing answers false. The one caller reads a missing recorded
 * fingerprint as its own case before it compares, so a false here always
 * means a read that returned nothing.
 *
 * @param {{columnCount: number, headerTexts: string[]|null}} a
 * @param {{columnCount: number, headerTexts: string[]|null}} b
 * @returns {boolean}
 */
function sameTableFingerprint(a, b) {
  if (!a || !b) return false;
  if (a.columnCount !== b.columnCount) return false;
  const left = a.headerTexts;
  const right = b.headerTexts;
  // Two readings that found no header row compare on the column count alone.
  // A reading that found one against a reading that did not is a difference:
  // the table gained or lost its header row.
  if (left === null || right === null) return left === right;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/**
 * The two guards the nomination step applies to an element carrying a grid or
 * table role, before the data test runs on it: the element is not a native
 * table, and every native table it holds is one tableFilter drops (pass 1
 * reports the others).
 * An element carrying the role and passing both guards is a qualifying
 * element.
 *
 * @param {Element} el
 * @param {(table: Element, opts: object) => boolean} tableFilter
 * @param {object} opts
 * @returns {boolean}
 */
function _passesAriaGuards(el, tableFilter, opts) {
  if (!el || el.tagName === 'TABLE') return false;
  const nestedTables = typeof el.querySelectorAll === 'function' ? Array.from(el.querySelectorAll('table')) : [];
  return !nestedTables.some((t) => !tableFilter(t, opts));
}

/**
 * Whether an ancestor is a qualifying element. An ancestor carries no other
 * evidence of its role, so the role read goes through `matches`; an element
 * stub with no `matches` counts as not qualifying, which makes the
 * element below it its own chain root.
 *
 * @param {Element} el
 * @param {(table: Element, opts: object) => boolean} tableFilter
 * @param {object} opts
 * @returns {boolean}
 */
function _isQualifyingAncestor(el, tableFilter, opts) {
  if (!el || typeof el.matches !== 'function') return false;
  let carriesRole = false;
  try { carriesRole = !!el.matches(GRID_ARIA_SELECTOR); } catch (e) { return false; }
  if (!carriesRole) return false;
  return _passesAriaGuards(el, tableFilter, opts);
}

/**
 * Walk up from `el` to its chain root: the outermost qualifying ancestor of
 * the nest `el` sits in. The walk is bounded by DR_DETECTION_SETTINGS.gridWalkDepthCap DOM
 * levels and stops at the document body, and it continues past an ancestor
 * that carries no role, because a nest may put a plain wrapper between two
 * qualifying elements. An element with no parent is its own chain root.
 *
 * @param {Element} el
 * @param {(table: Element, opts: object) => boolean} tableFilter
 * @param {object} opts
 * @returns {Element}
 */
function _chainRootOf(el, tableFilter, opts) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const docBody = doc && doc.body;
  let chainRoot = el;
  let current = el.parentElement || el.parentNode || null;
  let depth = 0;
  while (current && current !== docBody && depth < DR_DETECTION_SETTINGS.gridWalkDepthCap) {
    if (_isQualifyingAncestor(current, tableFilter, opts)) chainRoot = current;
    current = current.parentElement || current.parentNode || null;
    depth++;
  }
  return chainRoot;
}

/**
 * The nesting depth of `el` inside the chain `chainRoot` heads: the count of
 * qualifying ancestors from `el` up to and including `chainRoot`. The chain
 * root itself sits at depth 0, an element directly under it at depth 1.
 * Returns -1 when the walk leaves the nest without reaching the chain root,
 * so the caller drops the element rather than filing it at a wrong depth.
 *
 * @param {Element} el
 * @param {Element} chainRoot
 * @param {(table: Element, opts: object) => boolean} tableFilter
 * @param {object} opts
 * @returns {number}
 */
function _depthInChain(el, chainRoot, tableFilter, opts) {
  if (el === chainRoot) return 0;
  let count = 0;
  let current = el.parentElement || el.parentNode || null;
  let steps = 0;
  while (current && steps < DR_DETECTION_SETTINGS.gridWalkDepthCap) {
    if (current === chainRoot) return count + 1;
    if (_isQualifyingAncestor(current, tableFilter, opts)) count++;
    current = current.parentElement || current.parentNode || null;
    steps++;
  }
  return -1;
}

/**
 * Apply the configured nesting depth to one containment chain and return the
 * element to register, or null.
 *
 * `byDepth` maps a nesting depth to the chain's elements at that depth — the
 * qualifying elements that passed the data test, and those alone. Two edge
 * rules complete the selection (decision D2):
 *   - A chain shorter than the configured depth clamps to its deepest depth.
 *   - A depth holding more than one element falls back outward to the nearest
 *     shallower depth holding exactly one.
 * A chain where no depth from the clamped one outward holds exactly one
 * element returns null, which registers nothing for that nest.
 *
 * @param {Map<number, Element[]>} byDepth
 * @param {number} configuredDepth
 * @returns {Element|null}
 */
function _selectAtNestingDepth(byDepth, configuredDepth) {
  if (byDepth.size === 0) return null;
  const deepest = Math.max(...byDepth.keys());
  for (let depth = Math.min(configuredDepth, deepest); depth >= 0; depth--) {
    const atDepth = byDepth.get(depth) || [];
    if (atDepth.length === 1) return atDepth[0];
  }
  return null;
}

/**
 * The chain root of the nest `el` sits in: the outermost qualifying element
 * at or above `el`, or null when no qualifying element sits within
 * DR_DETECTION_SETTINGS.gridWalkDepthCap levels of `el`.
 *
 * This is the public form of the private _chainRootOf walk. _chainRootOf
 * takes a qualifying element and returns the outermost qualifying element
 * above it; this wrapper first finds the nearest qualifying element at or
 * above an arbitrary one, which is what a caller holding a clicked cell, an
 * added node, or a registered table has. The walk starts at `el` itself, so a
 * call on a qualifying element returns that element's own chain root.
 *
 * @param {Element} el
 * @param {{
 *   tableFilter?: (table: Element, opts: object) => boolean, doc?: Document,
 *   styleProbe?: object,
 * }} [opts]
 * @returns {Element|null}
 */
function chainRootOf(el, opts = {}) {
  if (!el) return null;
  const tableFilter = opts.tableFilter || isPhantomA11yTable;
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const docBody = doc && doc.body;
  let current = el;
  let depth = 0;
  while (current && current !== docBody && depth < DR_DETECTION_SETTINGS.gridWalkDepthCap) {
    if (_isQualifyingAncestor(current, tableFilter, opts)) {
      return _chainRootOf(current, tableFilter, opts);
    }
    current = current.parentElement || current.parentNode || null;
    depth++;
  }
  return null;
}

/**
 * Run the nomination step on the one nest `chainRoot` heads and report the
 * outcome.
 *
 * The nest is `chainRoot` plus every qualifying element under it. The chain
 * is the nest's elements that pass the data test, grouped by nesting depth;
 * _selectAtNestingDepth applies DR_DETECTION_SETTINGS.nestingDepth with decision D2's two
 * edge rules.
 *
 * The outcome kind states why the step returns what it returns, which is what
 * separates a nest worth watching from one worth leaving:
 *   - 'selected'   — `selected` holds the element to register.
 *   - 'empty'      — no element of the nest passes the data test. This is the
 *                    pending-table case: the nest's rows may arrive later.
 *   - 'crowded'    — a depth holds more than one element and no shallower
 *                    depth holds exactly one, so the nest registers nothing
 *                    (the product decision in issue #373).
 *   - 'registered' — the nest already holds an element opts.isSeen reports,
 *                    which makes a rediscovery idempotent.
 *
 * `chainSize` holds the chain's size: the nest elements that passed the data
 * test and filed at a nesting depth. It is 0 for 'empty', and 0 for
 * 'registered', which returns before the data test runs.
 *
 * The configured depth reads through a port in the style of
 * opts.vendorProfiles: opts.nestingDepth when the caller supplies one,
 * DR_DETECTION_SETTINGS.nestingDepth otherwise. Zero is a legal depth, so the override
 * check is a nullish check.
 *
 * REPORTS only — like findTargetTable, this never writes the dr-ext-grid
 * marker class and never builds a toggle widget, and it holds no record of a
 * nest it has already run on.
 *
 * @param {Element} chainRoot
 * @param {{
 *   tableFilter?: (table: Element) => boolean,
 *   isSeen?: (handle: Element) => boolean,
 *   nestingDepth?: number, doc?: Document,
 *   styleProbe?: object, numericProbe?: object, vendorProfiles?: object[],
 * }} [opts]
 * @returns {{chainRoot: Element, selected: Element|null, outcome: string, chainSize: number}}
 */
function nominateNest(chainRoot, opts = {}) {
  const tableFilter = opts.tableFilter || isPhantomA11yTable;
  const isSeen = opts.isSeen || (() => false);
  const configuredDepth = opts.nestingDepth ?? DR_DETECTION_SETTINGS.nestingDepth;

  const nested = typeof chainRoot.querySelectorAll === 'function'
    ? Array.from(chainRoot.querySelectorAll(GRID_ARIA_SELECTOR)) : [];
  const nest = [chainRoot].concat(nested)
    .filter((el) => _passesAriaGuards(el, tableFilter, opts));

  // A nest holding a registered element registers nothing: the scan already
  // ran over it, and a second registration would put a second pillbox on one
  // grid.
  if (nest.some((el) => isSeen(el))) {
    return { chainRoot, selected: null, outcome: 'registered', chainSize: 0 };
  }

  // The chain — the nest's elements that pass the data test, by depth.
  const byDepth = new Map();
  let chainSize = 0;
  for (const el of nest) {
    if (!isDataTable(el, opts)) continue;
    const depth = _depthInChain(el, chainRoot, tableFilter, opts);
    if (depth < 0) continue;
    chainSize++;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth).push(el);
  }

  // The configured depth and its two edge rules.
  const selected = _selectAtNestingDepth(byDepth, configuredDepth);
  if (selected) return { chainRoot, selected, outcome: 'selected', chainSize };
  return { chainRoot, selected: null, outcome: chainSize === 0 ? 'empty' : 'crowded', chainSize };
}

/**
 * Run the nomination step over every nest under `root` and report one result
 * per nest, in document order.
 *
 * From `root` this lists the qualifying elements — `root` itself when it
 * carries the role, plus every descendant carrying it, each past the two
 * guards in _passesAriaGuards. It walks each one up to its chain root and
 * runs nominateNest on every chain root once. A chain root can sit outside
 * `root` — an added node inside a wrapper already in the page — which is what
 * makes a rediscovery re-evaluate the whole nest.
 *
 * REPORTS only, per nominateNest. Both live scanners (ui-toggle.js's
 * load-time scan and content.js's added-node pass) reach the grids on a page
 * through this function, and the controller turns each outcome into a
 * registration or a pending table.
 *
 * @param {Element|Document} root
 * @param {{
 *   tableFilter?: (table: Element) => boolean,
 *   isSeen?: (handle: Element) => boolean,
 *   nestingDepth?: number, doc?: Document,
 *   styleProbe?: object, numericProbe?: object, vendorProfiles?: object[],
 * }} [opts]
 * @returns {{chainRoot: Element, selected: Element|null, outcome: string, chainSize: number}[]}
 */
function nominateNests(root, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const tableFilter = opts.tableFilter || isPhantomA11yTable;

  // Step 1: the qualifying elements under `root`, `root` itself included when
  // it carries the role.
  const rootCarriesRole = root.tagName !== 'TABLE' && typeof root.matches === 'function' && root.matches(GRID_ARIA_SELECTOR);
  const roleBearing = (rootCarriesRole ? [root] : []).concat(Array.from(root.querySelectorAll(GRID_ARIA_SELECTOR)));
  const qualifying = roleBearing.filter((el) => _passesAriaGuards(el, tableFilter, opts));

  // Steps 2 and 3: one chain root per nest, each evaluated once. A Set keeps
  // insertion order, so the results stay in document order.
  const chainRoots = new Set();
  for (const el of qualifying) chainRoots.add(_chainRootOf(el, tableFilter, opts));

  const results = [];
  for (const chainRoot of chainRoots) results.push(nominateNest(chainRoot, opts));
  return results;
}

/**
 * Scan `root` for native <table> elements (pass 1), then run the nomination
 * step over the elements carrying a grid or table role (pass 2).
 *
 * Pass 2 keeps the nests nominateNests reports as 'selected' and drops the
 * other three outcomes, so this function reports the elements to register and
 * nothing else. A caller that acts on the other outcomes — the controller,
 * which holds a pending table for an empty nest — calls nominateNests
 * directly.
 *
 * REPORTS only — like findTargetTable, this never writes the dr-ext-grid
 * marker class and never builds a toggle widget. Each result is
 * { handle, isNew }; isNew is computed from opts.isSeen (a caller-supplied
 * "have I already handled this element" check — e.g. DR_STORE.hasTable,
 * for both native tables and grid roots alike). Without opts.isSeen every
 * result reports isNew: true, since detection keeps no registry of its own.
 *
 * @param {Element|Document} root
 * @param {{
 *   tableFilter?: (table: Element) => boolean,
 *   isSeen?: (handle: Element) => boolean,
 *   nestingDepth?: number, doc?: Document,
 *   styleProbe?: object, numericProbe?: object, vendorProfiles?: object[],
 * }} [opts]
 * @returns {{handle: Element, isNew: boolean}[]}
 */
function findTables(root, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const tableFilter = opts.tableFilter || isPhantomA11yTable;
  const isSeen = opts.isSeen || (() => false);
  const results = [];

  // Pass 1: native <table> elements; tableFilter drops accessibility artifacts.
  const nativeTables = root.tagName === 'TABLE' ? [root] : Array.from(root.querySelectorAll('table'));
  for (const table of nativeTables) {
    if (tableFilter(table, opts)) continue;
    results.push({ handle: table, isNew: !isSeen(table) });
  }

  // Pass 2: the nomination step, one nest at a time.
  for (const { selected, outcome } of nominateNests(root, opts)) {
    if (outcome !== 'selected') continue;
    results.push({ handle: selected, isNew: !isSeen(selected) });
  }

  return results;
}
