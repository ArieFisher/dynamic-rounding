/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The adapter layer of the lib/dr-table package: NativeTableAdapter and
 * GridAdapter (chosen by makeAdapter) present a table's rows and cells through
 * one interface, over a native <table> and over a grid built from generic
 * elements. isDataTable and readTableFingerprint (detect.js), the passes in
 * content.js, the range pulse in ui-pillbox.js (flashRangePulse), and the
 * capture state collector (collectCaptureState) read rows and cells through
 * it. Loaded by the manifest's content_scripts after cells.js and before
 * classify.js and detect.js.
 *
 * Ports: DEFAULT_STYLE_PROBE (computed style, offset width, box) and the
 * originals port (a simplified cell's record) are this file's ports. Each has
 * a working default, so the adapters run in a plain Node context with no
 * Chrome globals and no `window`. The vendor grid selectors come in as
 * opts.vendorProfiles. Every other page read goes to the page directly, with
 * no port: the element and attribute reads of rows and cells, and the native
 * adapter's liveText.
 *
 * Every detection setting this file reads lives in DR_DETECTION_SETTINGS
 * (constants.js), which the content script loads before this file. The file
 * reads it as a bare global with no local fallback copy, and
 * GRID_VENDOR_PROFILES reads it at the top level, so a missing object fails at
 * load, before any function here runs.
 */

/**
 * CSS selector for a grid row's cells: the cell, grid-cell, row-header, and
 * column-header roles. All four count as cells, in document order, so a
 * labelled row's label is column A the way a native table's row header is.
 */
const GRID_CELL_SELECTOR = '[role="cell"], [role="gridcell"], [role="rowheader"], [role="columnheader"]';

/**
 * The node above `node`: its parent element, else its parent node, else null.
 * @param {Node} node
 * @returns {Node|null}
 */
function parentOf(node) {
  return node.parentElement || node.parentNode || null;
}

/**
 * The style probe: the one source for every guarded getComputedStyle,
 * offsetWidth, and box read in this file. With no real getComputedStyle it
 * reports a normal, visible, statically-positioned block element, which keeps
 * detection running in a context with no styles.
 *
 * getBox returns an element's box ({top, left, width, height}), or null when
 * the element draws no box: a hidden element or a `display: contents` row. A
 * probe without getBox reads every grid as row-first (see isColumnFirst).
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
  getBox(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    let rect = null;
    try { rect = el.getBoundingClientRect(); } catch (e) { return null; }
    if (!rect || !(rect.width > 0 || rect.height > 0)) return null;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  },
};

/**
 * The originals port: per-cell storage for a simplified cell's record, read
 * and written by the cell objects of both adapters. The default is a private
 * WeakMap<cellEl, record>, which suits a caller with no application model (a
 * test). content.js passes a port backed by the table's registry entry in
 * DR_MODEL (app/model.js), so a cell's originals survive a toggle without a
 * page attribute. makeAdapter takes another port as opts.originalsPort. The
 * record's shape is CellRecord.
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
 * The children that hold the most common non-zero child count, with that
 * count and how many children hold it. The geometry probe takes them as
 * candidate rows (columns, on a column-first grid) and the grid adapter takes
 * them as a column-first grid's columns, so the two read the same set.
 *
 * @param {Element[]} children
 * @returns {{modalChildCount: number, modalFreq: number, candidates: Element[]}}
 */
function childCountCandidates(children) {
  const childCountFreq = new Map();
  for (const child of children) {
    const cc = child.children ? child.children.length : 0;
    childCountFreq.set(cc, (childCountFreq.get(cc) || 0) + 1);
  }
  let modalChildCount = 0;
  let modalFreq = 0;
  for (const [cc, freq] of childCountFreq) {
    if (freq > modalFreq && cc > 0) { modalFreq = freq; modalChildCount = cc; }
  }
  const candidates = modalFreq > 0
    ? children.filter((c) => c.children && c.children.length === modalChildCount)
    : [];
  return { modalChildCount, modalFreq, candidates };
}

/**
 * The direction reader: whether an element's children run side by side as
 * columns (a column-first grid) instead of stacking as rows (a row-first
 * grid). It compares the boxes of the first two children that draw a box,
 * among at most DR_DETECTION_SETTINGS.gridColumnWidthSample children: the same
 * top with a larger left is column-first. Every other case is row-first,
 * including a probe without getBox. The geometry probe and the grid adapter
 * both call it, so the two read one direction for one grid.
 *
 * @param {Element[]} children
 * @param {object} styleProbe
 * @returns {boolean}
 */
function isColumnFirst(children, styleProbe) {
  if (!styleProbe || typeof styleProbe.getBox !== 'function') return false;
  const sample = children.slice(0, DR_DETECTION_SETTINGS.gridColumnWidthSample);
  const boxes = [];
  for (const child of sample) {
    const box = styleProbe.getBox(child);
    if (box) boxes.push(box);
    if (boxes.length === 2) break;
  }
  if (boxes.length < 2) return false;
  return boxes[1].top === boxes[0].top && boxes[1].left > boxes[0].left;
}

// Known third-party grid libraries. `classToken` ends looksLikeGrid before its
// alignment step; `scrollContainerSelectors` and `pinnedPaneSelectors` locate
// GridAdapter's scroll container and pinned pane. A caller may pass another
// list as opts.vendorProfiles.
const GRID_VENDOR_PROFILES = DR_DETECTION_SETTINGS.vendorProfiles;

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

/** Spans of a native table cell, read from its colSpan and rowSpan properties. */
function nativeCellSpans(cell) {
  return {
    colSpan: normalizeSpan(cell.colSpan, 1),
    rowSpan: normalizeSpan(cell.rowSpan, Infinity),
  };
}

/**
 * Spans of a grid cell, read from its aria-colspan and aria-rowspan
 * attributes. For a grid that declares none, the function returns one column
 * and one row for every cell, which numbers cells the way the read position does.
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
 * Rows are walked in order, each with a cursor that starts at the leftmost
 * column. A cell merged down holds its columns on the rows below it, and the
 * cursor skips a held column; a cell merged across advances the cursor by its
 * whole width. Both table kinds call this with the span read of their kind, so
 * one rule numbers the columns and the two kinds agree cell for cell.
 *
 * Without this, a merge inside the data area shifts every cell after it: the
 * first-column exclusion and the range expression fall on the wrong cells,
 * the dataset behind the max magnitude gains or loses values, and the whole
 * table rounds at the wrong step.
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
      // Each covered column takes the longer of its hold and this cell's
      // rowSpan. On well-formed markup no covered column carries a hold here,
      // so this is a plain write; it matters where a cell merged across reaches
      // a column a merge above still holds, which the table model keeps on the
      // shared slot.
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
 * The rows of one table, built from each row's cell elements: both adapters
 * and the geometry probe's numeric step build their rows here. The caller
 * reads each row's cell elements once, so the column plan (assignGridColumns)
 * and the cell objects count the same row shape. A cell object carries its plan
 * entry as columnIndex and columnSpan; a table that declares no span plans
 * every cell at its read position.
 * @param {Element[][]} rowCellEls - each row's cell elements, in column order
 * @param {(cellEl: Element) => {colSpan: number, rowSpan: number}} readSpans
 *   - the span read of the table kind (nativeCellSpans or gridCellSpans)
 * @param {(cellEl: Element) => object} makeCell - the cell object of the
 *   table kind (see makeCellObj)
 * @param {object[]} [rowProps] - fields to add to each row, by row position
 * @returns {{getCells(): object[]}[]}
 */
function buildRows(rowCellEls, readSpans, makeCell, rowProps) {
  const plan = assignGridColumns(rowCellEls.map((cellEls) => cellEls.map(readSpans)));
  return rowCellEls.map((cellEls, r) => Object.assign({}, rowProps && rowProps[r], {
    getCells() {
      return cellEls.map((cellEl, c) => Object.assign({}, plan[r][c], makeCell(cellEl)));
    },
  }));
}

class NativeTableAdapter {
  constructor(el, opts = {}) {
    this.el = el;
    this.originalsPort = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
  }
  getElement() { return this.el; }
  isGrid() { return false; }
  getRows() {
    const port = this.originalsPort;
    return buildRows(Array.from(this.el.rows, (row) => Array.from(row.cells)), nativeCellSpans, (cell) => {
      // A native cell classifies its rendered text, which is also what the screen shows.
      const rendered = () => cell.innerText || cell.textContent || '';
      return makeCellObj(cell, port, {
        tagName: cell.tagName, liveText: rendered, displayedText: rendered, rendered: true,
      });
    });
  }
}

/**
 * Whether an element carries a cell role, per GRID_CELL_SELECTOR. A cell
 * bounds a table: a grid inside a cell of another grid is a separate table,
 * the way a native table inside a cell is. Every walk that sorts elements
 * between two nested grids reads this one predicate: the walks that find a
 * chain root and count nesting depth, and the grid adapter's reads of the
 * grid's rows and cells. An element stub with no `matches` counts as no cell.
 *
 * @param {Element} el
 * @returns {boolean}
 */
function _isCellAncestor(el) {
  if (!el || typeof el.matches !== 'function') return false;
  try { return !!el.matches(GRID_CELL_SELECTOR); } catch (e) { return false; }
}

/**
 * The descendants of `root` matching `selector` that belong to `root`: those
 * with no ancestor carrying a cell role between them and `root`. A match inside
 * a cell of `root` belongs to a table nested in that cell, so a grid reads
 * only the rows and cells that belong to it, as a native table's rows leave
 * out a table nested in one of its cells.
 *
 * One call resolves each ancestor once: the walk records the answer for every
 * element it passes, and a later walk that reaches a recorded element takes
 * its answer and stops. The work grows with the size of the tree under
 * `root`, not with the matches times their depth.
 *
 * @param {Element} root
 * @param {string} selector
 * @returns {Element[]}
 */
function _ownDescendants(root, selector) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  // Element → whether a cell sits between it (itself included) and `root`.
  const insideCell = new Map();
  const isInsideCell = (start) => {
    const passed = [];
    let at = start;
    let answer = false;
    while (at && at !== root) {
      if (insideCell.has(at)) { answer = insideCell.get(at); break; }
      passed.push(at);
      if (_isCellAncestor(at)) { answer = true; break; }
      at = parentOf(at);
    }
    for (const el of passed) insideCell.set(el, answer);
    return answer;
  };
  return Array.from(root.querySelectorAll(selector))
    .filter((match) => !isInsideCell(parentOf(match)));
}

class GridAdapter {
  constructor(el, opts = {}) {
    this.el = el;
    this.vendorProfiles = opts.vendorProfiles || GRID_VENDOR_PROFILES;
    this.originalsPort = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
    this.styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  }
  getElement() { return this.el; }
  isGrid() { return true; }

  /**
   * The grid's scroll container: the first descendant of this grid that
   * matches a vendor profile's scrollContainerSelectors, in profile order,
   * then [role="grid"]; else the grid element.
   */
  _getScrollContainer() {
    const el = this.el;
    // The vendor profiles' selectors (database query grids, AG Grid, etc.),
    // then the generic ARIA grid role for a grid no profile covers.
    const knownSelectors = [
      ...this.vendorProfiles.flatMap((p) => p.scrollContainerSelectors || []),
      '[role="grid"]',
    ];
    for (const sel of knownSelectors) {
      const found = _ownDescendants(el, sel)[0];
      if (found) return found;
    }
    return el;
  }

  /**
   * The pinned pane inside this grid element, or null. A single-pane grid (a
   * database query grid) has none.
   */
  _getPinnedPane(scrollContainer) {
    const pinnedSelectors = this.vendorProfiles.flatMap((p) => p.pinnedPaneSelectors || []);
    const el = this.el;
    for (const sel of pinnedSelectors) {
      const found = _ownDescendants(el, sel)[0];
      if (found && found !== scrollContainer) return found;
    }
    return null;
  }

  /**
   * The container's rows, each as { el, isOutside }, from the first selector
   * that matches rows: [role="row"], .dg--virtual-row, <tr>, then the
   * container's children. The <tr> source covers a grid (role="grid" or
   * "table") whose rows are bare <tr> elements with no row role, directly
   * inside the grid as orphan rows.
   *
   * When the container holds row groups ([role="rowgroup"], the ARIA analog of
   * <tbody>), the first selector that matches rows inside a group applies, so
   * a stray block carrying role="row" outside every group, such as a
   * description panel, has no effect on which selector applies. The
   * list is the container-wide match list for that selector, in document
   * order. Header and summary rows outside the group count as rows like any
   * other, and only the first-row and first-column exclusions skip them, as
   * with a native table's <thead> and total rows. A row's position in the list
   * is its literal row number.
   *
   * isOutside marks a row that sits in no row group. An outside row rounds like
   * any other row, and its values join the dataset like any other row's. Only
   * the shape fingerprint reads the mark (_hasHeaderRow).
   *
   * A row from the children fallback on a column-first grid has no row
   * element: its entry holds el: null and cellEls, the row's cells in column
   * order (see _childRowEntries).
   *
   * @param {Element} container
   * @returns {{el: Element|null, isOutside: boolean, cellEls?: Element[]}[]}
   */
  _getRowEntries(container) {
    if (!container) return [];
    if (!container.querySelectorAll) {
      return this._childRowEntries(container);
    }
    // Each query skips elements inside a cell of the grid: those belong to a
    // table nested in that cell.
    const rowgroups = _ownDescendants(container, '[role="rowgroup"]');
    const isGrouped = rowgroups.length > 0;
    const scopes = isGrouped ? rowgroups : [container];

    for (const sel of ['[role="row"]', '.dg--virtual-row', 'tr']) {
      let rows = [];
      for (const scope of scopes) {
        rows = rows.concat(_ownDescendants(scope, sel));
      }
      if (rows.length === 0) continue;
      if (!isGrouped) return rows.map((el) => ({ el, isOutside: false }));
      // The chosen selector's matches across the whole container; a match
      // inside no row group is an outside row.
      const inGroup = new Set(rows);
      return _ownDescendants(container, sel)
        .map((el) => ({ el, isOutside: !inGroup.has(el) }));
    }
    // Fallback: the first scope's children. Row groups that hold no rows are
    // non-conforming markup, so only the first group's children count; the
    // container-wide list above applies to rows a selector matches.
    return this._childRowEntries(scopes[0]);
  }

  /**
   * Rows from an element's children, the fallback when no row selector
   * matches. On a row-first grid each child is a row. On a column-first grid
   * (see isColumnFirst) each child is a column, and row r holds the r-th item
   * of every column, in column order. The columns are the children holding the
   * most common item count (see childCountCandidates), so a column with a
   * different count stays out and every row holds one cell per column.
   *
   * @param {Element} parent
   * @returns {{el: Element|null, isOutside: boolean, cellEls?: Element[]}[]}
   */
  _childRowEntries(parent) {
    if (!parent || !parent.children) return [];
    const children = Array.from(parent.children);
    if (!isColumnFirst(children, this.styleProbe)) {
      return children.map((el) => ({ el, isOutside: false }));
    }
    const { modalChildCount, candidates: columns } = childCountCandidates(children);
    const rows = [];
    for (let r = 0; r < modalChildCount; r++) {
      rows.push({ el: null, isOutside: false, cellEls: columns.map((column) => column.children[r]) });
    }
    return rows;
  }

  /**
   * The rows' elements: _getRowEntries without the outside-row mark, for
   * callers that stitch by list position (pinned panes).
   * @param {Element} container
   * @returns {Element[]}
   */
  _getRowEls(container) {
    return this._getRowEntries(container).map((entry) => entry.el);
  }

  /**
   * A row element's cell elements: GRID_CELL_SELECTOR matches, else .dg--cell
   * matches, else the direct children.
   * @param {Element} rowEl
   * @returns {Element[]}
   */
  _getCellEls(rowEl) {
    if (!rowEl) return [];
    let cells = _ownDescendants(rowEl, GRID_CELL_SELECTOR);
    if (cells.length > 0) return cells;
    cells = _ownDescendants(rowEl, '.dg--cell');
    if (cells.length > 0) return cells;
    if (rowEl.children) return Array.from(rowEl.children);
    return [];
  }

  /**
   * A row's key for pinned-pane stitching: its data-row value, else its
   * data-index value, else its DOM index.
   * @param {Element} rowEl
   * @param {number} domIndex
   * @returns {string}
   */
  _getRowKey(rowEl, domIndex) {
    if (rowEl && rowEl.dataset) {
      if (rowEl.dataset.row !== undefined) return rowEl.dataset.row;
      if (rowEl.dataset.index !== undefined) return rowEl.dataset.index;
    }
    return String(domIndex);
  }

  /** Stitched rows: each row's pinned cells first, then its scroll cells. */
  getRows() {
    const scrollContainer = this._getScrollContainer();
    const pinnedPane = this._getPinnedPane(scrollContainer);

    const scrollEntries = this._getRowEntries(scrollContainer);
    if (scrollEntries.length === 0) return [];

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
    // Each row's cell elements in the order getCells() returns them: the
    // pinned pane's cells, then the scroll container's. Read once, so the
    // column plan and the cell objects count the same row shape and each row
    // is queried for its cells once. A row read from a column-first grid
    // carries its cells and no row element, so it takes no pinned cells.
    const rowCellEls = scrollEntries.map(({ el: rowEl, cellEls }, idx) => {
      if (cellEls) return cellEls;
      const scrollKey = adapter._getRowKey(rowEl, idx);
      // The pinned row with the same row key, else the one at the same position.
      const pinnedRowEl = pinnedByKey.get(scrollKey) || (pinnedRows[idx] || null);
      const pinned = pinnedRowEl ? adapter._getCellEls(pinnedRowEl) : [];
      return pinned.concat(adapter._getCellEls(rowEl));
    });
    return buildRows(rowCellEls, gridCellSpans, (cellEl) => makeGridCellObj(cellEl, adapter.originalsPort),
      scrollEntries.map(({ isOutside }) => ({ isOutside })));
  }
}

/**
 * Factory: a NativeTableAdapter for a <table> element, a GridAdapter
 * otherwise. Plain objects with a `rows` property (e.g. test stubs) count as
 * native tables. Adapters are never cached, because a grid's row count changes
 * on scroll.
 */
function makeAdapter(el, opts = {}) {
  if (el.tagName === 'TABLE' || (el.tagName === undefined && el.rows)) {
    return new NativeTableAdapter(el, opts);
  }
  return new GridAdapter(el, opts);
}
