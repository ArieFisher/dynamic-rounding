/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The adapter layer of the lib/dr-table package: NativeTableAdapter and
 * GridAdapter (chosen by makeAdapter) present a table's rows and cells through
 * one interface. Loaded after cells.js and before classify.js and detect.js.
 *
 * Ports (DEFAULT_STYLE_PROBE and the originals port) have working defaults, so
 * the adapters run in a plain Node context with no Chrome globals. Every other
 * page read goes to the page directly.
 *
 * GRID_VENDOR_PROFILES reads DR_DETECTION_SETTINGS at the top level, so a
 * missing object fails at load, before any function here runs.
 */

// All four roles count as cells, so a labelled row's label is column A the
// way a native table's row header is.
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
 * The style probe: every guarded style, offsetWidth, and box read goes here.
 * With no real getComputedStyle it reports a visible, statically-positioned
 * block element, so detection runs in a context with no styles.
 * getBox returns null when the element draws no box (hidden, or a
 * `display: contents` row). A probe without getBox reads every grid as
 * row-first.
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
 * The originals port: per-cell storage for a simplified cell's record
 * (CellRecord). The default WeakMap suits a caller with no application model;
 * content.js passes a port backed by DR_MODEL's registry entry, so originals
 * survive a toggle without a page attribute.
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
 * count and how many children hold it. The geometry probe and the grid
 * adapter both call it, so the two read the same set.
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
 * Whether an element's children run side by side as columns (column-first)
 * instead of stacking as rows: the first two children that draw a box share a
 * top, with a larger left on the second. The geometry probe and the grid
 * adapter both call it, so the two read one direction for one grid.
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
 * Read one span value. A missing or unreadable value is 1. An explicit zero
 * is the "to the end" form, which HTML and ARIA define for rowspan and
 * neither honours for colspan, so the caller passes what zero means. The cap
 * of 1000 is the most a table cell allows, so a malformed value cannot
 * stretch the column cursor.
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

// A td's span property reads 1 with no colspan attribute, so the attribute decides.
function cellSpans(cellEl) {
  const read = (property, htmlAttribute, ariaAttribute) => {
    if (!cellEl) return null;
    const declares = typeof cellEl.hasAttribute === 'function'
      ? cellEl.hasAttribute(htmlAttribute) : cellEl[property] != null;
    if (declares && cellEl[property] != null) return cellEl[property];
    return typeof cellEl.getAttribute === 'function' ? cellEl.getAttribute(ariaAttribute) : null;
  };
  return {
    colSpan: normalizeSpan(read('colSpan', 'colspan', 'aria-colspan'), 1),
    rowSpan: normalizeSpan(read('rowSpan', 'rowspan', 'aria-rowspan'), Infinity),
  };
}

/**
 * Number every cell by the column the browser lays it out in (issue #330).
 * Both table kinds call this with their own span read, so one rule numbers
 * the columns. Without it, a merge in the data area shifts every later cell
 * off its column, and the table rounds at the wrong step.
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
      // Matters where a cell merged across reaches a column a merge above
      // still holds: the table model keeps the longer hold on the shared slot.
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
 * The rows of one table, built from each row's cell elements. The caller
 * reads each row's cell elements once, so the column plan and the cell
 * objects count the same row shape.
 * @param {Element[][]} rowCellEls - each row's cell elements, in column order
 * @param {(cellEl: Element) => object} makeCell - the cell object of the
 *   table kind (see makeCellObj)
 * @param {object[]} [rowProps] - fields to add to each row, by row position
 * @returns {{getCells(): object[]}[]}
 */
function buildRows(rowCellEls, makeCell, rowProps) {
  const plan = assignGridColumns(rowCellEls.map((cellEls) => cellEls.map(cellSpans)));
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
    const rows = Array.from(this.el.rows);
    return buildRows(rows.map((row) => Array.from(row.cells)), (cell) => {
      const rendered = () => cell.innerText || cell.textContent || '';
      return makeCellObj(cell, port, {
        liveText: rendered, displayedText: rendered, rendered: true,
      });
    }, rows.map((row) => {
      const parent = parentOf(row);
      return { isOutside: !!parent && parent.tagName === 'THEAD', isGrouped: true };
    }));
  }
}

/**
 * Whether an element carries a cell role. A cell bounds a table: a grid inside
 * a cell of another grid is a separate table, as with a native table. Every
 * walk that sorts elements between nested grids reads this one predicate.
 *
 * @param {Element} el
 * @returns {boolean}
 */
function _isCellAncestor(el) {
  if (!el || typeof el.matches !== 'function') return false;
  try { return !!el.matches(GRID_CELL_SELECTOR); } catch (e) { return false; }
}

/**
 * The descendants of `root` matching `selector` with no cell-role ancestor
 * between them and `root`: a match inside a cell belongs to a table nested
 * in that cell. Each ancestor is resolved once, so the work grows with the
 * tree under `root`, not with matches times depth.
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

  // The first descendant matching a vendor scrollContainerSelectors entry,
  // then [role="grid"]; else the grid element.
  _getScrollContainer() {
    const el = this.el;
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

  // The pinned pane inside this grid, or null; a single-pane grid has none.
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
   * The container's rows from the first selector that matches rows:
   * [role="row"], .dg--virtual-row, <tr>, then the container's children. The
   * <tr> source covers a grid whose rows are bare <tr> elements with no row
   * role.
   *
   * With row groups present, the selector is chosen from rows inside a group,
   * so a stray role="row" block outside every group (a description panel)
   * cannot change the choice. The result is the container-wide match list in
   * document order, so a row's position is its literal row number.
   *
   * isOutside marks a row in no row group. Only the shape fingerprint reads it
   * (_hasHeaderRow).
   *
   * A row from the children fallback on a column-first grid has no row
   * element: its entry holds el: null and cellEls.
   *
   * @param {Element} container
   * @returns {{el: Element|null, isOutside: boolean, isGrouped: boolean, cellEls?: Element[]}[]}
   */
  _getRowEntries(container) {
    if (!container) return [];
    if (!container.querySelectorAll) {
      return this._childRowEntries(container);
    }
    const rowgroups = _ownDescendants(container, '[role="rowgroup"]');
    const isGrouped = rowgroups.length > 0;
    const scopes = isGrouped ? rowgroups : [container];

    for (const sel of ['[role="row"]', '.dg--virtual-row', 'tr']) {
      let rows = [];
      for (const scope of scopes) {
        rows = rows.concat(_ownDescendants(scope, sel));
      }
      if (rows.length === 0) continue;
      if (!isGrouped) return rows.map((el) => ({ el, isOutside: false, isGrouped }));
      const inGroup = new Set(rows);
      return _ownDescendants(container, sel)
        .map((el) => ({ el, isOutside: !inGroup.has(el), isGrouped }));
    }
    // Row groups that hold no rows are non-conforming markup, so only the
    // first group's children count.
    return this._childRowEntries(scopes[0]);
  }

  /**
   * Rows from an element's children, the fallback when no row selector
   * matches. On a column-first grid each child is a column; only columns with
   * the most common item count count, so every row holds one cell per column.
   *
   * @param {Element} parent
   * @returns {{el: Element|null, isOutside: boolean, isGrouped: boolean, cellEls?: Element[]}[]}
   */
  _childRowEntries(parent) {
    if (!parent || !parent.children) return [];
    const children = Array.from(parent.children);
    if (!isColumnFirst(children, this.styleProbe)) {
      return children.map((el) => ({ el, isOutside: false, isGrouped: false }));
    }
    const { modalChildCount, candidates: columns } = childCountCandidates(children);
    const rows = [];
    for (let r = 0; r < modalChildCount; r++) {
      rows.push({ el: null, isOutside: false, isGrouped: false, cellEls: columns.map((column) => column.children[r]) });
    }
    return rows;
  }

  /**
   * @param {Element} container
   * @returns {Element[]}
   */
  _getRowEls(container) {
    return this._getRowEntries(container).map((entry) => entry.el);
  }

  /**
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
    // A row read from a column-first grid has no row element, so it takes no
    // pinned cells.
    const rowCellEls = scrollEntries.map(({ el: rowEl, cellEls }, idx) => {
      if (cellEls) return cellEls;
      const scrollKey = adapter._getRowKey(rowEl, idx);
      const pinnedRowEl = pinnedByKey.get(scrollKey) || (pinnedRows[idx] || null);
      const pinned = pinnedRowEl ? adapter._getCellEls(pinnedRowEl) : [];
      return pinned.concat(adapter._getCellEls(rowEl));
    });
    return buildRows(rowCellEls, (cellEl) => makeGridCellObj(cellEl, adapter.originalsPort),
      scrollEntries.map(({ isOutside, isGrouped }) => ({ isOutside, isGrouped })));
  }
}

/**
 * A NativeTableAdapter for a <table> element, a GridAdapter otherwise. Plain
 * objects with a `rows` property (test stubs) count as native tables. Adapters
 * are never cached, because a grid's row count changes on scroll.
 */
function makeAdapter(el, opts = {}) {
  if (el.tagName === 'TABLE' || (el.tagName === undefined && el.rows)) {
    return new NativeTableAdapter(el, opts);
  }
  return new GridAdapter(el, opts);
}
