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
 * constants, the placement step (placeDecision), and the
 * structure-preserving cell-write helpers (applyExtractedPatches,
 * restoreTextPieces, getSuperscriptRanges, link filtering). Loaded by
 * manifest content_scripts before content.js.
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
 * port of the predicate detection used before the lib/dr-table extraction:
 * strip currency signs, commas, percent signs and whitespace, then
 * parseFloat. The strip reads CLEAN_REGEX, so the probe admits exactly the
 * currency signs CURRENCIES lists. It deliberately does NOT delegate to
 * DR_NUMBER.toNumber — that parser's unicode-minus and parenthesized-negative
 * handling changes which tables are detected (dates, times, and unit-suffixed
 * cells lose their toggle; accounting negatives gain one). A caller that
 * wants DR_NUMBER-aware detection passes a custom probe via opts.numericProbe.
 */
const DEFAULT_NUMERIC_PROBE = {
  parse(text) {
    const cleaned = String(text).trim().replace(CLEAN_REGEX, '');
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

/**
 * Read one span value, normalized the way a table cell holds it.
 *
 * A missing, blank, or unreadable value is one column or one row. An explicit
 * zero is the "to the end" form, which HTML and ARIA both define for rowspan
 * and neither honours for colspan, so the caller passes what zero means.
 * Column spans are capped at the 1000 a table cell allows, so a malformed
 * value cannot stretch the column cursor.
 *
 * @param {string|number|null|undefined} raw
 * @param {number} whenZero
 * @returns {number}
 */
function normalizeSpan(raw, whenZero) {
  if (raw === null || raw === undefined || raw === '') return 1;
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value) || value < 0) return 1;
  if (value === 0) return whenZero;
  return Math.min(value, 1000);
}

/** Spans of a native table cell, read from the element's own properties. */
function nativeCellSpans(cell) {
  return {
    colSpan: normalizeSpan(cell.colSpan, 1),
    rowSpan: normalizeSpan(cell.rowSpan, Infinity),
  };
}

/**
 * Spans of a grid cell, read from the accessibility attributes a page
 * declares. A grid that declares none reports one column and one row for
 * every cell, which is the same numbering the read position gives.
 */
function gridCellSpans(cellEl) {
  const read = (cellEl && typeof cellEl.getAttribute === 'function')
    ? (name) => cellEl.getAttribute(name)
    : () => null;
  return {
    colSpan: normalizeSpan(read('aria-colspan'), 1),
    rowSpan: normalizeSpan(read('aria-rowspan'), Infinity),
  };
}

/**
 * Number every cell by the column the browser lays it out in (issue #330).
 *
 * Rows are walked in order, each with a cursor starting at the leftmost
 * column. A cell merged down holds its columns on the rows below it and the
 * cursor skips a held column; a cell merged across advances the cursor by its
 * whole width. Both table kinds call this with their own span reads, so the
 * numbering rule lives in one place and the two kinds agree cell for cell.
 *
 * Without this, a cell's position in the row read stands for its column, and
 * a merge inside the data area shifts every cell after it: the first-column
 * exclusion and the range expression then fall on the wrong cells, the
 * dataset behind the max magnitude gains or loses values, and the whole table
 * rounds at the wrong step.
 *
 * @param {{colSpan: number, rowSpan: number}[][]} rowSpans
 * @returns {{columnIndex: number, columnSpan: number}[][]}
 */
function assignGridColumns(rowSpans) {
  // Per column, how many further rows a merge above holds it for.
  const held = [];
  return rowSpans.map((cells) => {
    let cursor = 0;
    const placed = cells.map(({ colSpan, rowSpan }) => {
      while (held[cursor] > 0) cursor += 1;
      const columnIndex = cursor;
      // The longer of the two holds wins. On well-formed markup no covered
      // column carries a hold at this point, so this reads as a plain write;
      // it matters where a cell merged across reaches into a column a merge
      // above still holds, which the table model keeps on the shared slot.
      for (let col = cursor; col < cursor + colSpan; col++) {
        held[col] = Math.max(held[col] || 0, rowSpan);
      }
      cursor += colSpan;
      return { columnIndex, columnSpan: colSpan };
    });
    for (let col = 0; col < held.length; col++) {
      if (held[col] > 0) held[col] -= 1;
    }
    return placed;
  });
}

/**
 * A fresh placement for one cell: the column plan's entry for it, or the read
 * position when the plan holds no entry — a table whose rows changed between
 * the plan and the read, which leaves the cell numbered as it was before this
 * rule. Fresh because the caller builds each cell object on top of it, and a
 * shared entry would tie every cell object at that position together.
 */
function columnPlacement(planRow, position) {
  const entry = planRow && planRow[position];
  return entry
    ? { columnIndex: entry.columnIndex, columnSpan: entry.columnSpan }
    : { columnIndex: position, columnSpan: 1 };
}

/** CSS class applied to every simplified cell, on native tables and grids alike. */
const GRID_ROUNDED_CLASS = 'dr-ext-rounded';

/**
 * OriginalsPort: pluggable per-cell storage for a simplified cell's record,
 * which both adapters' cell objects read and write, following the same
 * port-with-a-working-default pattern as StyleProbe/NumericProbe above. The
 * default is a private WeakMap<cellEl, record> — correct for a standalone or
 * test caller with no application model to hand in. content.js's real call
 * sites inject a port backed by DR_STORE's per-table registry entry (see
 * app/store.js, loaded after this file) instead, which is what makes a
 * cell's originals survive a rounding toggle without a page attribute.
 * A custom port is passed via opts.originalsPort on makeAdapter.
 * The record's shape is documented at applyPatches in makeCellObj.
 */
function makeDefaultOriginalsPort() {
  const store = new WeakMap();
  return {
    has(cellEl) { return store.has(cellEl); },
    get(cellEl) { return store.get(cellEl); },
    set(cellEl, record) { store.set(cellEl, record); },
  };
}
const DEFAULT_ORIGINALS_PORT = makeDefaultOriginalsPort();

/**
 * The cell object both adapters hand out: one read and one write over the
 * cell's text pieces, answering from the cell's record once the cell is
 * simplified. `reads` holds the differences between the kinds:
 *   tagName        the cell's tag; a grid cell reads as a data cell
 *   liveText()     the text the cell classifies with no record: a native
 *                  cell's rendered text, a grid cell's flat text
 *   displayedText()  what the screen shows right now, for the capture
 *   rendered       whether liveText() is rendered text, so the piece layout
 *                  converts its positions to flat-text positions
 * @param {Element} cellEl
 * @param {{has: Function, get: Function, set: Function}} port
 * @param {{tagName: string, liveText: () => string, displayedText: () => string, rendered: boolean}} reads
 */
function makeCellObj(cellEl, port, reads) {
  const recordOf = () => (port.has(cellEl) ? port.get(cellEl) : null);
  // The text the cell classifies: the record's pre-simplification text once
  // the cell is simplified, else the live text.
  const getText = () => {
    const record = recordOf();
    return record ? record.value : reads.liveText();
  };
  return {
    el: cellEl,
    tagName: reads.tagName,
    getText,
    getDisplayedText: reads.displayedText,
    // The cell's pieces as getText() saw them, for the placement step (see
    // placeDecision) and the patch step: each piece's original text from
    // the record once the cell is simplified, else each piece's live text.
    // toFlat converts a native cell's rendered positions to flat-text
    // positions; a grid cell classifies its flat text, so its toFlat is
    // null. null when the cell no longer holds as many pieces as its record,
    // which the pass sorts as a rewritten cell before it reads a layout.
    getPieceLayout() {
      const live = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const record = recordOf();
      if (record && record.pieces.length !== live.length) return null;
      const original = record ? record.pieces.map((piece) => piece.text) : live;
      if (!reads.rendered) return { original, toFlat: null };
      const text = getText();
      return { original, toFlat: mapRenderedToFlat(text, original.join('')) || mapValueToPiece(text, original) };
    },
    // Write the patches and return how many landed. The patches count in
    // the join of the cell's original pieces (see flatPatches), so the
    // target text of every piece comes from its original, and each piece
    // whose live text differs from its target takes the target. A landed
    // write stores the cell's record through the originals port:
    //   value            the text the cell classified: opts.value, the text
    //                    the pass read before its first write, else getText()
    //   pieces           one entry per text piece, in page order: text, its
    //                    original; written, its text after this write
    //   supRanges        a <sup>-bearing cell's exponent ranges, measured in
    //                    value; null for a cell with no <sup>
    //   linkFilteredIdx  the positions of the numbers the link filter kept,
    //                    for a cell rounded number by number; null otherwise
    // Every landed write replaces the record, so the written text never
    // goes stale. A write that lands nothing writes and stores nothing.
    // The pass passes opts.value because a native cell's getText() reads
    // rendered text, and a rendered-text read after another cell's write
    // lays out the whole table again: once per cell, a 10,000-cell table
    // takes most of a minute.
    applyPatches(patches, opts = {}) {
      const { linkFilteredIdx, supRanges } = opts;
      const record = recordOf();
      const value = opts.value !== undefined ? opts.value : getText();
      const original = record
        ? record.pieces.map((piece) => piece.text)
        : collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const { landed } = applyExtractedPatches(cellEl, patches, original);
      if (landed === 0) return 0;
      const written = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      port.set(cellEl, {
        value,
        pieces: original.map((text, i) => ({ text, written: written[i] })),
        supRanges: supRanges || null,
        linkFilteredIdx: linkFilteredIdx || null,
      });
      if (cellEl.classList) cellEl.classList.add(GRID_ROUNDED_CLASS);
      return landed;
    },
  };
}

class NativeTableAdapter {
  constructor(el, opts = {}) {
    this.el = el;
    this.originalsPort = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
  }
  getElement() { return this.el; }
  isVirtualized() { return false; }
  getRows() {
    // isOutside marks a footer-section row — the native analog of a grid row
    // outside the row group. Outside rows round like any other, but their
    // values stay out of the dataset: consumers skip them when computing the
    // max magnitude and the lens preview pool.
    const rowEls = Array.from(this.el.rows);
    // One pass over the spans numbers every cell by its grid column, before
    // any text is read; a cell then carries the number its consumers gate on.
    const plan = assignGridColumns(
      rowEls.map((row) => Array.from(row.cells).map(nativeCellSpans)));
    const port = this.originalsPort;
    return rowEls.map((row, r) => ({
      isOutside: !!((row.parentElement || row.parentNode) &&
        (row.parentElement || row.parentNode).tagName === 'TFOOT'),
      getCells() {
        return Array.from(row.cells).map((cell, c) => {
          // A native cell classifies its rendered text, and the screen shows
          // the same text.
          const rendered = () => cell.innerText || cell.textContent || '';
          return Object.assign(columnPlacement(plan[r], c), makeCellObj(cell, port, {
            tagName: cell.tagName, liveText: rendered, displayedText: rendered, rendered: true,
          }));
        });
      },
    }));
  }
}

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
   * Build one grid cell's cell object (see makeCellObj). Every write patches
   * text pieces through nodeValue — never textContent/innerHTML/appendChild/removeChild.
   * @param {Element} cellEl
   * @returns {{getText(): string, getPieceLayout(): object|null,
   *            applyPatches(patches: object[], opts?: {value?: string, linkFilteredIdx?: number[]|null, supRanges?: {start:number,end:number}[]|null}): number,
   *            getDisplayedText(): string, el: Element, tagName: string}}
   */
  _makeCellObj(cellEl) {
    return makeCellObj(cellEl, this.originalsPort, {
      // Grid cells are treated as data cells (no <th> concept).
      tagName: 'TD',
      // The cell's flat text, i.e. the join of its text pieces in page
      // order, the coordinate space every patch position counts in. A cell
      // with no text piece reads its textContent, which a page element holds
      // empty in that case.
      liveText() {
        const pieces = collectTextPieces(cellEl);
        if (pieces.length === 0) return cellEl.textContent || '';
        return pieces.map((piece) => piece.nodeValue).join('');
      },
      // The cell's whole live text, never the originals port.
      displayedText() { return cellEl.textContent || ''; },
      rendered: false,
    });
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
    // Each row's cell elements in the order getCells() hands them out: the
    // pinned pane's cells, then the scrolling pane's. Read once here so the
    // column plan below and the cell objects below that count in the same
    // row shape, and so a row is queried for its cells once, not twice.
    const rowCellEls = scrollEntries.map(({ el: rowEl }, idx) => {
      const scrollKey = adapter._getRowKey(rowEl, idx);
      // Find the matching pinned row (by data-row / data-index / DOM index).
      const pinnedRowEl = pinnedByKey.get(scrollKey) || (pinnedRows[idx] || null);
      const pinned = pinnedRowEl ? adapter._getCellEls(pinnedRowEl) : [];
      return pinned.concat(adapter._getCellEls(rowEl));
    });
    // A grid declares a merge through the accessibility attributes, the only
    // spans its markup carries; a grid that declares none numbers its columns
    // by read position, as it did before this rule (issue #330).
    const plan = assignGridColumns(
      rowCellEls.map((cellEls) => cellEls.map(gridCellSpans)));

    return scrollEntries.map(({ isOutside }, idx) => ({
      isOutside,
      getCells() {
        return rowCellEls[idx].map((cellEl, c) => Object.assign(
          columnPlacement(plan[idx], c), adapter._makeCellObj(cellEl)));
      },
    }));
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
    return new NativeTableAdapter(el, opts);
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
 *
 * opts.text, when given, is the rendered text the caller classifies, and each
 * range converts into its positions through mapRenderedToFlat. A range with
 * no rendered character drops out. When the two texts differ in anything but
 * whitespace, the ranges stay in flat-text positions.
 * @param {Element} cell
 * @param {{doc?: Document, styleProbe?: object, text?: string}} [opts]
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
  let flat = '';
  let node;
  while ((node = treeWalker.nextNode())) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    if (len > 0) {
      flat += node.nodeValue;
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
  const toFlat = typeof opts.text === 'string' ? mapRenderedToFlat(opts.text, flat) : null;
  if (!toFlat) return ranges;
  const rendered = [];
  for (const { start, end } of ranges) {
    const inside = [];
    toFlat.forEach((at, i) => { if (at >= start && at < end) inside.push(i); });
    if (inside.length > 0) rendered.push({ start: inside[0], end: inside[inside.length - 1] + 1 });
  }
  return rendered;
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

  // Collect text nodes via TreeWalker.
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

/**
 * The cell's text pieces in page order: every text node under the cell,
 * whitespace-only and empty ones included. A patch position counts over the
 * join of these pieces (the cell's flat text), and a grid cell's originals
 * record holds piece indexes into this list. Walks with the page's
 * tree walker when one exists, else walks child nodes depth-first, which
 * visits the same nodes in the same order.
 * @param {Element} cell
 * @returns {Text[]}
 */
function collectTextPieces(cell) {
  const pieces = [];
  if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) pieces.push(node);
    return pieces;
  }
  (function visit(node) {
    const kids = node.childNodes || [];
    for (let k = 0; k < kids.length; k++) {
      if (kids[k].nodeType === 3) pieces.push(kids[k]);
      else visit(kids[k]);
    }
  })(cell);
  return pieces;
}

/**
 * Where each character of a cell's rendered text sits in its flat text.
 * The browser collapses runs of spaces and line breaks in the markup to one
 * space, trims the ends, and adds a line break at a <br> or a block
 * boundary, so a pretty-printed cell's rendered text is shorter than its
 * flat text before a number. The walk pairs equal characters, skips a flat
 * whitespace character with no rendered counterpart, and points a rendered
 * whitespace character with no flat counterpart at the next flat character.
 * Returns an array holding, for each rendered position, its flat position,
 * or null when the two texts differ in anything but whitespace (hidden text
 * inside the cell, a CSS text transform), so the caller keeps rendered
 * positions as they are.
 * @param {string} rendered
 * @param {string} flat
 * @returns {number[]|null}
 */
function mapRenderedToFlat(rendered, flat) {
  const isSpace = (ch) => /\s/.test(ch);
  const toFlat = [];
  let j = 0;
  for (let i = 0; i < rendered.length;) {
    if (j < flat.length && rendered[i] === flat[j]) {
      toFlat.push(j++);
      i++;
    } else if (isSpace(rendered[i])) {
      toFlat.push(j < flat.length && isSpace(flat[j]) ? j++ : j);
      i++;
    } else if (j < flat.length && isSpace(flat[j])) {
      j++;
    } else {
      return null;
    }
  }
  return flat.substring(j).trim() === '' ? toFlat : null;
}

/**
 * Where a cell's trimmed rendered text sits in its flat text, for a cell
 * whose two texts differ in more than whitespace: a hidden sort key ahead of
 * the value ("000000007002300" hidden, then "7,002,300"). The value sits in
 * the one piece whose trimmed text equals it, or else in the one piece that
 * holds it exactly once. Returns an array holding, for each rendered
 * position of the value, its flat position, with no entry for any other
 * rendered position, or null when no single piece qualifies.
 * @param {string} rendered
 * @param {string[]} pieces
 * @returns {number[]|null}
 */
function mapValueToPiece(rendered, pieces) {
  const value = rendered.trim();
  if (value === '') return null;
  let candidates = pieces.map((text, i) => i).filter((i) => pieces[i].trim() === value);
  if (candidates.length !== 1) {
    candidates = pieces.map((text, i) => i).filter((i) => {
      const at = pieces[i].indexOf(value);
      return at >= 0 && pieces[i].indexOf(value, at + 1) < 0;
    });
  }
  if (candidates.length !== 1) return null;
  const i = candidates[0];
  let flatStart = pieces[i].indexOf(value);
  for (let k = 0; k < i; k++) flatStart += pieces[k].length;
  const lead = rendered.length - rendered.trimStart().length;
  const toFlat = [];
  for (let k = 0; k < value.length; k++) toFlat[lead + k] = flatStart + k;
  return toFlat;
}

/**
 * Applies targeted per-number patches to the text pieces of a cell.
 * Each patch {index, numStr, newNum} identifies a position in the cell's flat
 * text (the join of its text pieces in page order — same coordinate space as
 * getSuperscriptRanges and extractNumbersInText), the original string, and
 * its replacement.
 *
 * `original`, when given, lists each piece's original text in page order,
 * and the patch positions count in the join of those texts. Without it the
 * live pieces serve as the originals. Each piece's target text is its
 * original with its patches applied, grouped by the piece that holds their
 * position and applied right to left inside each piece, so an earlier
 * position is unaffected by a change at a later one. A patch is skipped when
 * no piece holds its position or numStr is not at that position.
 *
 * Every piece whose live text differs from its target takes the target,
 * written once, through nodeValue; no node is added, removed, or replaced,
 * so <sup>, <a>, and every other node keep their identity. A piece that
 * already shows its target takes no write. With no patch landed, or with a
 * cell that no longer holds one piece per original, nothing is written.
 *
 * Returns the count of patches that landed, and each written piece's text
 * before and after the write, in piece order. The caller records the cell as
 * simplified only on a landed count above zero, because a skipped patch
 * leaves the screen unchanged.
 *
 * @param {Element} cell
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {string[]} [original]
 * @returns {{landed: number, pieces: {i: number, before: string, after: string}[]}}
 */
function applyExtractedPatches(cell, patches, original) {
  if (!patches || patches.length === 0) return { landed: 0, pieces: [] };
  const pieces = collectTextPieces(cell);
  const live = pieces.map((piece) => piece.nodeValue);
  const from = original || live;
  if (from.length !== live.length) return { landed: 0, pieces: [] };
  const { texts, landed } = patchPieceTexts(from, patches);
  if (landed === 0) return { landed: 0, pieces: [] };
  const touched = [];
  texts.forEach((after, i) => {
    if (live[i] === after) return;
    pieces[i].nodeValue = after;
    touched.push({ i, before: live[i], after });
  });
  return { landed, pieces: touched };
}

/**
 * Each piece's text with its patches applied, and how many patches landed.
 * The patch positions count in the join of the texts; see
 * applyExtractedPatches.
 * @param {string[]} texts
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @returns {{texts: string[], landed: number}}
 */
function patchPieceTexts(texts, patches) {
  const starts = [];
  let flatLen = 0;
  for (const text of texts) {
    starts.push(flatLen);
    flatLen += text.length;
  }
  const byPiece = new Map();
  for (const patch of patches) {
    const i = texts.findIndex((text, k) => starts[k] <= patch.index && patch.index < starts[k] + text.length);
    if (i < 0) continue;
    if (!byPiece.has(i)) byPiece.set(i, []);
    byPiece.get(i).push(patch);
  }
  const out = texts.slice();
  let landed = 0;
  for (const [i, piecePatches] of byPiece) {
    let after = texts[i];
    for (const { index, numStr, newNum } of piecePatches.slice().sort((x, y) => y.index - x.index)) {
      const at = index - starts[i];
      if (after.substring(at, at + numStr.length) !== numStr) continue;
      after = after.substring(0, at) + newNum + after.substring(at + numStr.length);
      landed++;
    }
    out[i] = after;
  }
  return { texts: out, landed };
}

/**
 * Sort a cell by its record, the first step of every pass and every restore:
 *   'fresh'      the cell holds no record.
 *   'held'       the cell holds as many text pieces as its record, and each
 *                piece shows its original or its written text.
 *   'rewritten'  anything else: a piece holds text that is neither, or the
 *                piece count changed. The sign that the page wrote a new
 *                value into the cell.
 * @param {Element} cell
 * @param {{pieces: {text: string, written: string}[]}|null|undefined} record
 * @returns {'fresh'|'held'|'rewritten'}
 */
function sortCellByRecord(cell, record) {
  if (!record) return 'fresh';
  const live = collectTextPieces(cell).map((piece) => piece.nodeValue);
  if (live.length !== record.pieces.length) return 'rewritten';
  return record.pieces.every((piece, i) => live[i] === piece.text || live[i] === piece.written)
    ? 'held'
    : 'rewritten';
}

/**
 * Put a cell's original text back into every text piece that still shows
 * the extension's written text, through nodeValue like the patch writer. A
 * piece the page rewrote keeps the page's text, so this never writes a
 * number the page no longer shows.
 *
 * With the piece count unchanged, each piece pairs with the stored piece at
 * its position. With the count changed, the pieces no longer line up, so
 * each live piece pairs with a stored piece by text: a live piece whose text
 * equals a stored piece's written text takes that piece's original. The
 * match runs in page order, and each stored piece matches one live piece at
 * most, so two pieces showing the same written text each get their own
 * original back. A live piece that matches no written text keeps its text.
 * @param {Element} cell
 * @param {{text: string, written: string}[]} storedPieces
 */
function restoreTextPieces(cell, storedPieces) {
  const pieces = collectTextPieces(cell);
  if (pieces.length === storedPieces.length) {
    storedPieces.forEach((piece, i) => {
      if (piece.text !== piece.written && pieces[i].nodeValue === piece.written) pieces[i].nodeValue = piece.text;
    });
    return;
  }
  const written = storedPieces.filter((piece) => piece.text !== piece.written);
  let next = 0;
  for (const live of pieces) {
    const at = written.findIndex((piece, k) => k >= next && piece.written === live.nodeValue);
    if (at < 0) continue;
    live.nodeValue = written[at].text;
    next = at + 1;
  }
}

// --- Placement step ---
// Every cell, native or grid, takes three steps: classify, place, patch. The
// placement step checks a classifyCell decision against the cell's text
// pieces before any patch is built, and the patch writer
// (applyExtractedPatches) then writes each patch inside one piece.
//
// A layout comes from the cell object's getPieceLayout():
//   original    each piece's text as the classified text saw it
//   toFlat      for each position of the classified text, its position in
//               the join of original; null when the positions count alike,
//               and no entry for a position with no known counterpart
// A native cell classifies its rendered text and converts positions through
// mapRenderedToFlat. When the rendered and flat texts differ in more than
// whitespace, such as a hidden sort key ahead of the value, toFlat maps the
// trimmed rendered text to the one piece that holds it (mapValueToPiece).
// With no such piece the rendered positions stand, and a patch that misses
// there does not land.

// The cell's pieces as the classified text saw them, each with its index
// and its start in the join of original.
function pieceSpans(layout) {
  const spans = [];
  let at = 0;
  layout.original.forEach((text, i) => {
    spans.push({ i, start: at, text });
    at += text.length;
  });
  return spans;
}

// The piece that holds every character of [start, start + length), or null.
function pieceHolding(spans, start, length) {
  const span = spans.find((s) => s.start <= start && start < s.start + s.text.length);
  return span && start + length <= span.start + span.text.length ? span : null;
}

// A range of the classified text, as a range of the join of original.
// converted is false when toFlat holds no entry for the range, which then
// keeps its classified positions.
function flatRange(layout, start, length) {
  if (!layout.toFlat || length === 0) return { start, length, converted: false };
  const first = layout.toFlat[start];
  const last = layout.toFlat[start + length - 1];
  if (first === undefined || last === undefined) return { start, length, converted: false };
  return { start: first, length: last + 1 - first, converted: true };
}

/**
 * The piece that holds every character of a range of the classified text,
 * or null when the range crosses a piece boundary.
 * @param {{original: string[], toFlat: number[]|null}} layout
 * @param {number} start
 * @param {number} length
 * @returns {{i: number, start: number, text: string}|null}
 */
function layoutPieceHolding(layout, start, length) {
  const range = flatRange(layout, start, length);
  return pieceHolding(pieceSpans(layout), range.start, range.length);
}

/**
 * Move patches measured in the classified text into the join of the cell's
 * original pieces, the positions the patch writer counts in (see
 * applyExtractedPatches). Where toFlat converts positions, numStr becomes
 * the flat text of the converted range, so a line break the browser
 * collapsed inside a value still matches. A patch whose position no piece
 * holds stays as it is, and does not land.
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {{original: string[], toFlat: number[]|null}} layout
 * @returns {{index: number, numStr: string, newNum: string}[]}
 */
function flatPatches(patches, layout) {
  if (patches.length === 0) return patches;
  const spans = pieceSpans(layout);
  const flat = layout.original.join('');
  return patches.map((patch) => {
    const range = flatRange(layout, patch.index, patch.numStr.length);
    if (!pieceHolding(spans, range.start, 1)) return patch;
    const numStr = range.converted ? flat.substring(range.start, range.start + range.length) : patch.numStr;
    return Object.assign({}, patch, { index: range.start, numStr });
  });
}

// The numbers of a stacked cell: a cell whose text pieces each hold one
// whole number or unit number, or nothing but whitespace, currency symbols
// (the number parser's list), a percent sign, or a listed currency code.
// Two numbers in one piece, even with a space between them ("416 555 1234"),
// make the cell not stacked, and so does a piece that reads as a date or a
// time ("2024" above "2025"), because a lone year stays a year. Returns the
// numbers as matches measured in the join of original, null when the cell
// is not stacked, or 'split' when a number sits across two pieces: a piece
// that ends in "." or "," before one that starts with a digit ("4." then
// "91"). A piece that starts with "." or "," never reads as a number, so "4"
// then ".91" is not stacked either. A digit next to a digit across two
// pieces reads as two numbers, the shape of one number per line.
function stackedMatches(spans) {
  const symbolPiece = new RegExp('^(?:' + CURRENCY_SIGN_ALTERNATION + '|%)+$');
  const filled = spans.filter((span) => span.text.length > 0);
  for (let k = 1; k < filled.length; k++) {
    if (/[.,]$/.test(filled[k - 1].text) && /^\d/.test(filled[k].text)) return 'split';
  }
  const matches = [];
  for (const span of filled) {
    const trimmed = span.text.trim();
    if (trimmed === '' || symbolPiece.test(trimmed) || CURRENCY_CODES.includes(trimmed)) continue;
    if (isDateTimeLike(trimmed) || isDateLike(trimmed) || isTimeLike(trimmed)) return null;
    const unit = matchUnitNumber(span.text);
    const found = unit ? [unit] : extractNumbersInText(span.text);
    if (found.length !== 1 || (!unit && toNumber(span.text) === null)) return null;
    matches.push({ numStr: found[0].numStr, num: found[0].num, index: span.start + found[0].index });
  }
  return matches.length > 0 ? matches : null;
}

/**
 * The placement step: place a classifyCell decision in the cell's text
 * pieces. A patch edits one piece, so a decision stands only when the
 * characters it changes sit in one piece: a pure cell's trimmed text, each
 * number of an extracted cell. A date or time passes through; its piece
 * check runs when its patch is built, because only a changed value needs
 * one.
 *
 * A decision whose characters cross a piece boundary skips with reason
 * 'pieces'. With opts.stacked, the cell first takes the stacked-cell test
 * (see stackedMatches), and so does a cell held back as mixed text: a
 * stacked cell rounds number by number as an extracted decision, and a
 * number split across pieces skips with reason 'split'. Grids take the
 * stacked-cell test. Native tables do not: the test reads a digit beside a
 * digit across pieces as two numbers, and a native cell's inline styling
 * splits one number that way ("1" plain, "23" in bold).
 *
 * A cell with no layout (its pieces no longer reach its record) skips with
 * reason 'pieces-changed'. A cell with a <sup> keeps a skip decision, so a
 * footnote marker never rounds as a stacked number.
 *
 * @param {object} decision - classifyCell's decision
 * @param {string} text - the text the decision was classified on
 * @param {{original: string[], toFlat: number[]|null}|null} layout
 * @param {{hasSuperscript?: boolean, stacked?: boolean}} [opts]
 * @returns {object} the placed decision
 */
function placeDecision(decision, text, layout, opts = {}) {
  if (!layout) return { mode: 'skip', reason: 'pieces-changed' };
  if (opts.hasSuperscript && decision.mode === 'skip') return decision;
  if (decision.mode === 'pure') {
    const lead = text.length - text.trimStart().length;
    if (layoutPieceHolding(layout, lead, text.trim().length)) return decision;
  } else if (decision.mode === 'extracted') {
    if (decision.value.matches.every((m) => layoutPieceHolding(layout, m.index, m.numStr.length))) return decision;
  } else if (!(decision.mode === 'skip' && decision.reason === 'mixed-disabled')) {
    return decision;
  }
  if (!opts.stacked) return decision.mode === 'skip' ? decision : { mode: 'skip', reason: 'pieces' };
  const matches = stackedMatches(pieceSpans(layout));
  if (matches === 'split') return { mode: 'skip', reason: 'split' };
  if (matches === null) return decision.mode === 'skip' ? decision : { mode: 'skip', reason: 'pieces' };
  return { mode: 'extracted', reason: 'stacked', value: { matches } };
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
