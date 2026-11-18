// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The adapter layer of the lib/dr-table package: NativeTableAdapter and
 * GridAdapter (chosen by makeAdapter) present a table's rows and cells through
 * one interface.
 */

// All four roles count as cells, so a header cell at the start of a grid row is
// column A, as a <th> at the start of a native table row is.
const GRID_CELL_SELECTOR = '[role="cell"], [role="gridcell"], [role="rowheader"], [role="columnheader"]';

function parentOf(node) {
  return node.parentElement || node.parentNode || null;
}

/**
 * The ancestor walk: the first node from `start` upward that `found` reports,
 * or null. The walk ends before a node `stopAt` reports, after `cap` nodes,
 * and at the tree's top.
 * @param {Node|null} start
 * @param {number} cap - most nodes visited (the walk then returns null):
 *   gridWalkDepthCap, or Infinity for the tree's top alone
 * @param {((node: Node) => boolean)|null} stopAt - null stops nowhere
 * @param {(node: Node) => boolean} found
 * @returns {Node|null}
 */
function walkUp(start, cap, stopAt, found) {
  let node = start;
  for (let depth = 0; node && depth < cap && !(stopAt && stopAt(node)); depth++) {
    if (found(node)) return node;
    node = parentOf(node);
  }
  return null;
}

/**
 * The style probe: every guarded style, offsetWidth, and box read goes here.
 * With no real getComputedStyle it reports a statically-positioned block
 * element, so detection runs in a context with no styles.
 * getBox returns null when the element draws no box (hidden, or a
 * `display: contents` row).
 */
const DEFAULT_STYLE_PROBE = {
  getComputedStyle(el) {
    if (typeof getComputedStyle === 'function') {
      try { return getComputedStyle(el) || null; } catch (e) { return null; }
    }
    return { display: 'block', position: 'static', left: '', verticalAlign: '' };
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
 * content.js passes a port backed by DR_MODEL's registry entry, because the
 * registry holds each table's originals.
 */
const DEFAULT_ORIGINALS_PORT = new WeakMap();

/**
 * The children that hold the most common non-zero child count, with that
 * count and how many children hold it. The geometry probe and the grid
 * adapter both call it, so the two read the same set.
 *
 * @returns {{modalChildCount: number, modalFreq: number, candidates: Element[]}}
 */
function childCountCandidates(children) {
  const childCountFreq = new Map();
  for (const child of children) {
    const childCount = child.children ? child.children.length : 0;
    childCountFreq.set(childCount, (childCountFreq.get(childCount) || 0) + 1);
  }
  let modalChildCount = 0;
  let modalFreq = 0;
  for (const [childCount, freq] of childCountFreq) {
    if (freq > modalFreq && childCount > 0) { modalFreq = freq; modalChildCount = childCount; }
  }
  const candidates = modalFreq > 0
    ? children.filter((c) => c.children && c.children.length === modalChildCount)
    : [];
  return { modalChildCount, modalFreq, candidates };
}

/**
 * The direction reader: true for a column-first grid, false for a row-first
 * grid. The geometry probe and the grid adapter both call it, so the two get
 * one direction for one grid.
 *
 * @returns {boolean}
 */
function isColumnFirst(children, styleProbe) {
  if (typeof styleProbe.getBox !== 'function') return false;
  const sample = children.slice(0, DR_DETECTION_SETTINGS.gridSampleSize);
  const boxes = [];
  for (const child of sample) {
    const box = styleProbe.getBox(child);
    if (box) boxes.push(box);
    if (boxes.length === 2) break;
  }
  if (boxes.length < 2) return false;
  return boxes[1].top === boxes[0].top && boxes[1].left > boxes[0].left;
}

// This statement reads DR_DETECTION_SETTINGS at load, so it throws when the
// object is missing, before any function in this file runs.
const GRID_VENDOR_PROFILES = DR_DETECTION_SETTINGS.vendorProfiles;

/**
 * Read one span value. A missing or unreadable value is 1. An explicit zero
 * is the "to the end" form, which HTML and ARIA define for rowspan and
 * neither honours for colspan, so the caller passes what zero means. The cap
 * of 1000, the most HTML allows for colspan, keeps a malformed value from
 * stretching the column cursor.
 *
 * @returns {number}
 */
function normalizeSpan(raw, whenZero) {
  if (raw === null || raw === undefined || raw === '') return 1;
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value) || value < 0) return 1;
  if (value === 0) return whenZero;
  return Math.min(value, 1000);
}

// A td's span property returns 1 with no colspan attribute, so the code checks
// the attribute.
function cellSpans(cellEl) {
  const read = (property, htmlAttribute, ariaAttribute) => {
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
 * Both table kinds reach it through buildRows, so one rule numbers the
 * columns. Without it, a merge in the data area shifts every later cell
 * off its column, and the code for every rule that gates a cell by grid
 * column (the exclusions, the range expression, the dataset, the column
 * post-pass, the capture state) gets the wrong column.
 *
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
      // Where a cell merged across reaches a column that a merge above still
      // holds, the column keeps the longer of the two holds.
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
 * @returns {{isOutside?: boolean, isGrouped?: boolean, getCells(): object[]}[]}
 */
function buildRows(rowCellEls, originalsPort, rowProps) {
  const plan = assignGridColumns(rowCellEls.map((cellEls) => cellEls.map(cellSpans)));
  return rowCellEls.map((cellEls, r) => Object.assign({}, rowProps && rowProps[r], {
    getCells() {
      return cellEls.map((cellEl, c) => Object.assign({}, plan[r][c], makeCellObj(cellEl, originalsPort)));
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
    const rows = Array.from(this.el.rows);
    return buildRows(rows.map((row) => Array.from(row.cells)), this.originalsPort,
      rows.map((row) => {
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

/**
 * The first of `root`'s own descendants to match a selector, trying the
 * selectors in order and passing over `skip`.
 *
 * @returns {Element|null}
 */
function _firstOwnDescendant(root, selectors, skip) {
  for (const sel of selectors) {
    const found = _ownDescendants(root, sel)[0];
    if (found && found !== skip) return found;
  }
  return null;
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

  _getScrollContainer() {
    const selectors = [
      ...this.vendorProfiles.flatMap((p) => p.scrollContainerSelectors || []),
      '[role="grid"]',
    ];
    return _firstOwnDescendant(this.el, selectors) || this.el;
  }

  _getPinnedPane(scrollContainer) {
    const selectors = this.vendorProfiles.flatMap((p) => p.pinnedPaneSelectors || []);
    // A pinned pane that is the scroll container would join each row's
    // cells to themselves.
    return _firstOwnDescendant(this.el, selectors, scrollContainer);
  }

  /**
   * The <tr> selector covers a grid whose rows are bare <tr> elements with no
   * row role.
   *
   * With row groups present, the selector is chosen from rows inside a group,
   * so a stray role="row" block outside every group (a description panel)
   * cannot change the choice. The result is the container-wide match list in
   * document order, so a row's position is its literal row number.
   *
   * isOutside marks a row in no row group. Its only reader is _hasHeaderRow,
   * in the shape fingerprint code.
   *
   * A row from the children fallback on a column-first grid has no row
   * element: its entry holds el: null and cellEls.
   *
   * @returns {{el: Element|null, isOutside: boolean, isGrouped: boolean, cellEls?: Element[]}[]}
   */
  _getRowEntries(container) {
    if (!container.querySelectorAll) {
      return this._childRowEntries(container);
    }
    const rowgroups = _ownDescendants(container, '[role="rowgroup"]');
    const isGrouped = rowgroups.length > 0;
    const scopes = isGrouped ? rowgroups : [container];

    for (const sel of ['[role="row"]', '.dg--virtual-row', 'tr']) {
      const rows = scopes.flatMap((scope) => _ownDescendants(scope, sel));
      if (rows.length === 0) continue;
      const inGroup = new Set(rows);
      const matches = isGrouped ? _ownDescendants(container, sel) : rows;
      return matches.map((el) => ({ el, isOutside: !inGroup.has(el), isGrouped }));
    }
    // With no row group, scopes[0] is the container. Row groups that hold no
    // row elements are non-conforming markup, and only the first group's
    // children count.
    return this._childRowEntries(scopes[0]);
  }

  /**
   * Rows from an element's children, the fallback when no row selector
   * matches. On a column-first grid each child is a column; only columns with
   * the most common item count count, so every row holds one cell per column.
   *
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

  _getCellEls(rowEl) {
    let cells = _ownDescendants(rowEl, GRID_CELL_SELECTOR);
    if (cells.length > 0) return cells;
    cells = _ownDescendants(rowEl, '.dg--cell');
    if (cells.length > 0) return cells;
    if (rowEl.children) return Array.from(rowEl.children);
    return [];
  }

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

    const pinnedRows = pinnedPane ? this._getRowEntries(pinnedPane).map((entry) => entry.el) : [];
    const pinnedByKey = new Map(pinnedRows.map((pr, idx) => [this._getRowKey(pr, idx), pr]));

    // A row read from a column-first grid has no row element, so it takes no
    // pinned cells.
    const rowCellEls = scrollEntries.map(({ el: rowEl, cellEls }, idx) => {
      if (cellEls) return cellEls;
      const scrollKey = this._getRowKey(rowEl, idx);
      const pinnedRowEl = pinnedByKey.get(scrollKey) || pinnedRows[idx];
      const pinned = pinnedRowEl ? this._getCellEls(pinnedRowEl) : [];
      return pinned.concat(this._getCellEls(rowEl));
    });
    return buildRows(rowCellEls, this.originalsPort,
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
