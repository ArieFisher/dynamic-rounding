/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The detection layer of the lib/dr-table package, with the DOM adapters and
 * the cell read and write it shares with the simplification pass. Loaded by
 * the manifest's content_scripts before content.js.
 *
 * Adapters: NativeTableAdapter and GridAdapter (chosen by makeAdapter)
 * present a table's rows and cells through one interface, over a native
 * <table> and over a grid built from generic elements. isDataTable and
 * readTableFingerprint here, the passes in content.js, the range pulse in
 * ui-pillbox.js (flashRangePulse), and the capture state collector
 * (collectCaptureState) read rows and cells through it. _hasHeaderRow also
 * reads a native table's first row element, for its head section.
 *
 * Detection reads the page and returns findings: isDataTable, looksLikeGrid,
 * findTargetTable, isAccessibilityArtifact, chainRootOf, nominateNest,
 * nominateNests, findTables, and readTableFingerprint. None writes the
 * dr-ext-grid marker class or builds a table pillbox, and none reads that
 * class as state: "is this element registered" is the injected
 * opts.isRegistered check. The callers (ui-pillbox.js, content.js) check the
 * registry in DR_MODEL and, for a first match, write the marker class (a style
 * hook only) and build the table pillbox. The rest of the file writes to the
 * page: the patch writer (writePatches) and restoreTextPieces write cell text
 * in place, through nodeValue, and the cell object's applyPatches calls the
 * patch writer, stores the cell's record through the originals port, and adds
 * the dr-ext-rounded marker class.
 *
 * Ports: DEFAULT_STYLE_PROBE (computed style, offset width, box) and the
 * originals port (a simplified cell's record) are the file's ports. Each has
 * a working default, so detection runs in a plain Node context with no Chrome
 * globals and no `window`. The vendor grid selectors come in as
 * opts.vendorProfiles, and `document` as opts.doc in the functions that take
 * it. Every other page read goes to the page directly, with no port: the
 * element and attribute reads of rows and cells, the text-piece walk
 * (collectTextPieces), the link filter (filterLinkMatches), the whole-link
 * test (isCellWholeLink), the rendered-text reads (the native adapter's
 * liveText and the cell object's runsTogether), and the hover-text read
 * (pageHoverText).
 *
 * Every detection setting this file reads lives in DR_DETECTION_SETTINGS
 * (constants.js), which the content script loads before this file. The file
 * reads it as a bare global with no local fallback copy, and
 * GRID_VENDOR_PROFILES reads it at the top level, so a missing object fails at
 * load, before any function here runs.
 */

/** CSS selector for the cheap load-time ARIA pass. */
const GRID_ARIA_SELECTOR = '[role="grid"], [role="table"]';
/**
 * CSS selector for a grid row's cells: the cell, grid-cell, row-header, and
 * column-header roles. All four count as cells, in document order, so a
 * labelled row's label is column A the way a native table's row header is.
 */
const GRID_CELL_SELECTOR = '[role="cell"], [role="gridcell"], [role="rowheader"], [role="columnheader"]';
/** Node.ELEMENT_NODE, or 1 (its fixed DOM value) in a context with no `Node` global. */
const DR_TABLE_ELEMENT_NODE = (typeof Node !== 'undefined' && Node.ELEMENT_NODE) || 1;

/**
 * The node above `node`: its parent element, else its parent node (the
 * document or a fragment), else null. Every parent read in this file calls it.
 * @param {Node} node
 * @returns {Node|null}
 */
function parentOf(node) {
  return node.parentElement || node.parentNode || null;
}

/**
 * The ancestor walk every walk up the tree calls: visits `start`, then each
 * node above it, and returns the first node `found` reports, or null. The walk
 * ends before a node `stopAt` reports, after `cap` nodes, and at the top of
 * the tree. `found` may keep state, for a walk that reads each node.
 * @param {Node|null} start
 * @param {number} cap - the most nodes the walk visits: the setting
 *   DR_DETECTION_SETTINGS.gridWalkDepthCap for a walk bounded by page depth
 *   (at the cap the walk ends and returns null), or Infinity for a walk
 *   bounded by the top of the tree alone
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

// The settings the data test classifies a cell under: every option in the
// settings contract (DR_DEFAULTS) whose name starts with "simplify", each on.
// The test reads no table's settings, so a table passes or fails the same way
// whatever its switches hold, and a switch added to the contract reaches the
// test with no edit here.
const DETECTION_OPTIONS = Object.freeze(Object.fromEntries(
  Object.keys(DR_DEFAULTS).filter((key) => key.startsWith('simplify')).map((key) => [key, true])));

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

/** Marker class on every cell the extension simplified (numbers, dates, and times), on native tables and grids alike. */
const SIMPLIFIED_CLASS = 'dr-ext-rounded';

/**
 * A simplified cell's record, stored through the originals port. A landed
 * write replaces it, so the written text never goes stale; a write that lands
 * nothing stores nothing.
 *
 * @typedef {object} CellRecord
 * @property {string} value - the text the cell classified: opts.value, the
 *   text the pass read before its first write, else getText()
 * @property {{text: string, written: string}[]} pieces - one entry per text
 *   piece, in page order: text, its original; written, its text after this write
 * @property {{start: number, end: number}[]|null} supRanges - a
 *   <sup>-bearing cell's exponent ranges, measured in value; null for a cell
 *   with no <sup>
 * @property {number[]|null} linkFilteredIdx - the positions of the numbers the
 *   link filter kept, for a cell rounded number by number; null otherwise
 * @property {string} pageTitle - the cell's hover text as the page set it,
 *   read on the first write and carried through every later write (the
 *   extension's hover text never replaces it), except that a held cell whose
 *   hover text the page changed takes the new text; '' when the page set none
 */

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
 * The hover text the extension gives a simplified cell: "Original: " and the
 * text the cell classified. A different live hover text is the page's.
 * @param {string} value
 * @returns {string}
 */
function originalHoverText(value) {
  return `Original: ${value}`;
}

/**
 * The page's hover text for a cell about to take a write. A cell with no
 * record has it read from the cell, on its first write. On a held cell, a live
 * hover text equal to the extension's hover text leaves the stored text in
 * place, and any other live hover text is the page's newer text, which
 * replaces it.
 * @param {Element} cellEl
 * @param {CellRecord|null} record
 * @returns {string}
 */
function pageHoverText(cellEl, record) {
  const live = cellEl.title || '';
  if (!record) return live;
  return live === originalHoverText(record.value) ? (record.pageTitle || '') : live;
}

/**
 * The cell object both adapters hand out: one read and one write over the
 * cell's text pieces, reading from the cell's record once the cell is
 * simplified. `reads` holds the differences between the kinds:
 *   tagName          the cell's tag; a grid cell reads as a data cell
 *   liveText()       the text the cell classifies when it has no record: a
 *                    native cell's rendered text, a grid cell's flat text
 *   displayedText()  the text the screen shows now, for the capture
 *   rendered         whether liveText() is rendered text, so the piece layout
 *                    converts its positions to flat-text positions
 * @param {Element} cellEl
 * @param {{has: Function, get: Function, set: Function}} port
 * @param {{tagName: string, liveText: () => string, displayedText: () => string, rendered: boolean}} reads
 */
function makeCellObj(cellEl, port, reads) {
  const recordOf = () => (port.has(cellEl) ? port.get(cellEl) : null);
  const getText = () => {
    const record = recordOf();
    return record ? record.value : reads.liveText();
  };
  return {
    el: cellEl,
    tagName: reads.tagName,
    getRecord: recordOf,
    getText,
    getDisplayedText: reads.displayedText,
    // The cell's text pieces as getText() read them, for the placement step and
    // the patch step (the layout's shape is PieceLayout). Returns
    // null when the cell no longer holds as many pieces as its record; the
    // pass sorts that cell as a rewritten cell before it reads a layout.
    // runsTogether reads the cell's rendered text only when the placement step
    // calls it, because a rendered-text read lays out the page.
    getPieceLayout() {
      const live = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const record = recordOf();
      if (record && record.pieces.length !== live.length) return null;
      const original = record ? record.pieces.map((piece) => piece.text) : live;
      const runsTogether = (i) => showsPiecesTogether(cellEl.innerText || cellEl.textContent || '', live, i);
      if (!reads.rendered) return { original, toFlat: null, rendered: false, runsTogether };
      const text = getText();
      const toFlat = mapRenderedToFlat(text, original.join('')) || mapValueToPiece(text, original);
      return { original, toFlat, rendered: true, runsTogether };
    },
    // Write the patches and return how many landed (see writePatches).
    // A landed write replaces the cell's record (CellRecord) through the
    // originals port.
    // The pass passes opts.value because a native cell's getText() reads
    // rendered text, and a rendered-text read after another cell's write lays
    // out the whole table again: once per cell, a 10,000-cell table takes most
    // of a minute.
    applyPatches(patches, opts = {}) {
      const { linkFilteredIdx, supRanges } = opts;
      const record = recordOf();
      const value = opts.value !== undefined ? opts.value : getText();
      const original = record
        ? record.pieces.map((piece) => piece.text)
        : collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const { landed } = writePatches(cellEl, patches, original);
      if (landed === 0) return 0;
      const written = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      port.set(cellEl, {
        value,
        pieces: original.map((text, i) => ({ text, written: written[i] })),
        supRanges: supRanges || null,
        linkFilteredIdx: linkFilteredIdx || null,
        pageTitle: pageHoverText(cellEl, record),
      });
      if (cellEl.classList) cellEl.classList.add(SIMPLIFIED_CLASS);
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

/**
 * Build one grid cell's cell object (see makeCellObj). The grid adapter and
 * the geometry probe's numeric step both build grid cells through it, so the
 * two read a cell's text the same way. Every write patches text pieces
 * through nodeValue — never textContent/innerHTML/appendChild/removeChild.
 * @param {Element} cellEl
 * @param {{has: Function, get: Function, set: Function}} port
 * @returns {{getText(): string, getPieceLayout(): PieceLayout|null,
 *            applyPatches(patches: object[], opts?: {value?: string, linkFilteredIdx?: number[]|null, supRanges?: {start:number,end:number}[]|null}): number,
 *            getDisplayedText(): string, getRecord(): CellRecord|null, el: Element, tagName: string}}
 */
function makeGridCellObj(cellEl, port) {
  return makeCellObj(cellEl, port, {
    // A grid cell reads as a data cell. The page marks a grid's header cell by
    // role (GRID_CELL_SELECTOR) and puts its header row outside every row group
    // (_hasHeaderRow), so tagName is never 'TH'.
    tagName: 'TD',
    // The cell's flat text: the join of its text pieces in page order, the
    // coordinate space every patch position counts in. A cell with no text
    // piece reads its textContent.
    liveText() {
      const pieces = collectTextPieces(cellEl);
      if (pieces.length === 0) return cellEl.textContent || '';
      return pieces.map((piece) => piece.nodeValue).join('');
    },
    // The cell's live textContent, for the capture; it never reads the record.
    displayedText() { return cellEl.textContent || ''; },
    rendered: false,
  });
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

/**
 * The {start, end} half-open ranges of a cell's text that sit inside a <sup>
 * element or an element whose computed vertical-align is 'super'. The ranges
 * count in the cell's flat text. The function reads the cell's text pieces
 * through collectTextPieces. The vertical-align check reads opts.styleProbe, so
 * the function runs when getComputedStyle is absent.
 *
 * opts.text, when given, is the rendered text the caller classifies, and each
 * range converts into its positions through mapRenderedToFlat. A range with no
 * rendered character drops out. When the two texts differ in anything but
 * whitespace, the ranges stay in flat-text positions.
 * @param {Element} cell
 * @param {{styleProbe?: object, text?: string}} [opts]
 * @returns {{start: number, end: number}[]}
 */
function getSuperscriptRanges(cell, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  if (!cell) return [];
  const ranges = [];
  let cursor = 0;
  let flat = '';
  for (const node of collectTextPieces(cell)) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    if (len > 0) {
      flat += node.nodeValue;
      const isSup = walkUp(parentOf(node), Infinity, (ancestor) => ancestor === cell, (ancestor) => {
        if (ancestor.tagName === SUPERSCRIPT_TAG) return true;
        const style = styleProbe.getComputedStyle(ancestor);
        return !!(style && style.verticalAlign === 'super');
      }) !== null;
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
 * Whether the cell's visible text lies entirely inside <a> elements (e.g. a
 * linked page number). Reads innerText directly, with no port.
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
 * Drops the matches from extractNumbersInText that fall inside an <a>
 * descendant of the cell. A match belongs to the first text piece that
 * contains its numStr, and drops when that piece has an <a> ancestor inside the
 * cell. When no single piece contains numStr, the match drops when any <a>
 * descendant's text contains it.
 */
function filterLinkMatches(cell, matches) {
  if (!matches || matches.length === 0) return matches;
  if (typeof cell.querySelectorAll !== 'function') return matches;
  const anchors = cell.querySelectorAll('a');
  if (!anchors || anchors.length === 0) return matches;

  const nonEmptyNodes = collectTextPieces(cell).filter(n => n.nodeValue.trim() !== '');

  return matches.filter(match => {
    const numStr = match.numStr;
    const containingNode = nonEmptyNodes.find(n => n.nodeValue.includes(numStr));
    if (containingNode) {
      const anchor = containingNode.parentElement && containingNode.parentElement.closest('a');
      if (anchor && cell.contains(anchor)) {
        return false;
      }
      return true;
    }
    // numStr sits in no single piece (a rare cross-piece match): drop it when any
    // <a> descendant's text contains it.
    const inAnchor = [...anchors].some(a => (a.innerText || a.textContent || '').includes(numStr));
    return !inAnchor;
  });
}

// The link filter's step of an extracted decision. classifyCell
// (lib/dr-simplify) applies every text-only filter to an extracted cell's
// candidate matches (quote spans, superscript spans, era years) but reads
// only text, which holds no <a> element, so filterLinkMatches above drops the
// matches inside links here. Each filter is an independent per-match
// predicate, so running this one after the ladder's filters gives the same
// final set as running all of them together (see the lib/dr-simplify/ladder.js
// header). If filtering empties the match list, the cell becomes a skip.
// staleFilteredIndices: when the caller is classifying a cell's *stored*
// pre-round text (the record's value, read through the cell object's
// getRecord) rather than the live cell, the live text no longer contains
// the original numStr values, so filterLinkMatches' substring search
// against live text nodes cannot locate them (and its fallback silently
// keeps everything, dropping the link filter with no signal). The
// simplification pass already ran filterLinkMatches once, against the live
// text, at the moment it rounded the cell; the caller passes the surviving
// match indices from that run here (see the registry record's
// linkFilteredIdx, stored by the cell object's applyPatches) so the same
// filter outcome applies instead of being silently skipped.
function finalizeExtractedDecision(decision, cell, staleFilteredIndices) {
  if (decision.mode !== 'extracted') return decision;
  const filtered = staleFilteredIndices
    ? decision.value.matches.filter((m) => staleFilteredIndices.has(m.index))
    : filterLinkMatches(cell, decision.value.matches);
  if (filtered.length === 0) return { mode: 'skip', reason: decision.reason };
  return { mode: 'extracted', reason: decision.reason, value: { matches: filtered } };
}

// Classify one cell: the ladder, then the placement step. isCellWholeLink and
// the superscript ranges are page reads the pure ladder cannot make, so they
// pass in as plain data (see the lib/dr-simplify/ladder.js header). The step
// reads the page and writes nothing: the pass writes the debug row for a split
// value (entry.placedReason) after classification.
//
// A simplified cell classifies its stored original rather than the rounded
// text now showing, on either kind: the cell object's getText()
// and getPieceLayout() answer from its record. The pass and the lens
// preview read alike. Each read below measured against that text takes the
// record's copy:
//   superscriptRanges  the record's supRanges, because rounding shrinks or
//                      grows the live text around the <sup>. A record with
//                      none measures the live cell against the stored text.
//   link filter        the record's linkFilteredIdx, the positions of the
//                      numbers the link filter kept when the cell rounded,
//                      because the filter's substring search cannot find
//                      the original numbers in the rounded live text. A
//                      record with none runs the live filter.
// isWholeLink stays a live read: rounding patches the values of text pieces and
// never adds or removes an <a>, so the anchor text and the cell text move
// together, and a whole-link cell never rounds in the first place.
function classifyTableCell(cellObj, rowIndex, opts, ranges) {
  const cell = cellObj.el;
  const record = cellObj.getRecord();
  const text = cellObj.getText();
  const layout = cellObj.getPieceLayout();
  const hasSuperscript = !!(cell.querySelector && cell.querySelector('sup'));
  const superscriptRanges = hasSuperscript
    ? ((record && record.supRanges) || getSuperscriptRanges(cell, { text }))
    : [];
  // A stacked cell's pieces each hold a number, and its joined text is not
  // one spaced identifier (see matchIdentifierShape).
  const digitsSpanPieces = !!layout && layout.original.filter((piece) => /\d/.test(piece)).length > 1;
  const classified = classifyCell({
    text,
    rowIndex,
    columnIndex: cellObj.columnIndex,
    ranges,
    isWholeLink: isCellWholeLink(cell),
    hasSuperscript,
    superscriptRanges,
    digitsSpanPieces,
  }, opts);
  const placed = placeDecision(classified, text, layout, { hasSuperscript });
  const keptIndices = (record && record.linkFilteredIdx) ? new Set(record.linkFilteredIdx) : null;
  return {
    cellObj,
    text,
    trimmed: typeof text === 'string' ? text.trim() : '',
    info: decisionToLegacyInfo(finalizeExtractedDecision(placed, cell, keptIndices)),
    placedReason: placed.reason,
    layout,
    col: cellObj.columnIndex,
    hasSuperscript,
    superscriptRanges,
  };
}

/**
 * The cell's text pieces in page order: every Text node under the cell,
 * whitespace-only and empty ones included. A patch position counts over the
 * join of these pieces (the cell's flat text), and the cell's record holds one
 * entry per piece, in this order. The function walks with the page's tree
 * walker when one exists, else walks child nodes depth-first, which visits the
 * same nodes in the same order.
 * @param {Element} cell
 * @returns {Text[]}
 */
function collectTextPieces(cell) {
  const pieces = [];
  const walker = typeof document !== 'undefined'
    ? document.createTreeWalker?.(cell, NodeFilter.SHOW_TEXT, null, false) : null;
  if (walker) {
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
 * Where each character of a cell's rendered text sits in its flat text. The
 * browser collapses runs of spaces and line breaks in the markup to one space,
 * trims the ends, and adds a line break at a <br> or a block boundary, so a
 * pretty-printed cell's rendered text is shorter than its flat text before a
 * number. Returns an array holding, for each rendered position, its flat
 * position, or null when the two texts differ in anything but whitespace
 * (hidden text inside the cell, a CSS text transform), so the caller keeps
 * rendered positions as they are.
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
 * The patch writer: applies patches {index, numStr, newNum} to the text pieces
 * of a cell. Each index is a position in the cell's flat text (flatPatches moves a
 * classified position there).
 *
 * `original`, when given, lists each piece's original text in page order, and
 * the patch positions count in the join of those texts; without it the live
 * pieces serve as the originals. Each piece's target text is its original with
 * its patches applied right to left, so an earlier position is unaffected by a
 * change at a later one. A patch is skipped when no piece holds its position
 * or numStr is not at that position.
 *
 * Every piece whose live text differs from its target takes the target,
 * written once through nodeValue; no node is added, removed, or replaced, so
 * <sup>, <a>, and every other node keep their identity. With no patch landed,
 * or with a cell that no longer holds one piece per original, nothing is
 * written.
 *
 * Returns the count of patches that landed, and each written piece's text
 * before and after the write. The caller records the cell as simplified only
 * on a landed count above zero, because a skipped patch leaves the screen
 * unchanged.
 *
 * @param {Element} cell
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {string[]} [original]
 * @returns {{landed: number, pieces: {i: number, before: string, after: string}[]}}
 */
function writePatches(cell, patches, original) {
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
 * writePatches.
 * @param {string[]} texts
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @returns {{texts: string[], landed: number}}
 */
function patchPieceTexts(texts, patches) {
  const spans = pieceSpans(texts);
  const byPiece = new Map();
  for (const patch of patches) {
    const span = pieceAt(spans, patch.index);
    if (!span) continue;
    if (!byPiece.has(span.i)) byPiece.set(span.i, []);
    byPiece.get(span.i).push(patch);
  }
  const out = texts.slice();
  let landed = 0;
  for (const [i, piecePatches] of byPiece) {
    let after = texts[i];
    for (const { index, numStr, newNum } of piecePatches.slice().sort((x, y) => y.index - x.index)) {
      const at = index - spans[i].start;
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
 *                piece count changed.
 * @param {Element} cell
 * @param {CellRecord|null|undefined} record
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
 * its position. With the count changed, each live piece pairs with a stored
 * piece by text, in page order and at most once per stored piece: a live piece
 * whose text equals a stored piece's written text takes that piece's original,
 * and any other live piece keeps its text.
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
// (writePatches) then writes each patch inside one piece.
//

/**
 * The layout of a cell's text pieces, which the cell object's
 * getPieceLayout() returns and the placement step and the patch step read.
 *
 * toFlat converts a native cell's rendered positions through
 * mapRenderedToFlat and, for a hidden sort key ahead of the value, maps the
 * trimmed rendered text to the one piece that holds it (mapValueToPiece).
 * With no such piece the rendered positions stand, and a patch that misses
 * there does not land.
 *
 * @typedef {object} PieceLayout
 * @property {string[]} original - each piece's text as the classified text saw it
 * @property {number[]|null} toFlat - for each position of the classified
 *   text, its position in the join of original; null when the positions count
 *   alike, and no entry for a position with no known counterpart
 * @property {boolean} rendered - whether the classified text is rendered
 *   text: true for a native cell, false for a grid cell
 * @property {(i: number) => boolean} runsTogether - whether the text the
 *   browser shows has piece i straight after piece i - 1 (see showsPiecesTogether)
 */

// Each piece's text with its index and its start in the join of the texts.
function pieceSpans(texts) {
  let at = 0;
  return texts.map((text, i) => {
    const span = { i, start: at, text };
    at += text.length;
    return span;
  });
}

// The piece that holds the character at a position of the join of the spans'
// texts, or null. The one lookup of a piece by position.
function pieceAt(spans, at) {
  return spans.find((span) => span.start <= at && at < span.start + span.text.length) || null;
}

// The piece that holds every character of [start, start + length), or null.
function pieceHolding(spans, start, length) {
  const span = pieceAt(spans, start);
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
 * @param {PieceLayout} layout
 * @param {number} start
 * @param {number} length
 * @returns {{i: number, start: number, text: string}|null}
 */
function layoutPieceHolding(layout, start, length) {
  const range = flatRange(layout, start, length);
  return pieceHolding(pieceSpans(layout.original), range.start, range.length);
}

/**
 * Move patches measured in the classified text into the join of the cell's
 * original pieces, the positions the patch writer counts in (see
 * writePatches). Where toFlat converts positions, numStr becomes
 * the flat text of the converted range, so a line break the browser
 * collapsed inside a value still matches. A patch whose position no piece
 * holds stays as it is, and does not land.
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {PieceLayout} layout
 * @returns {{index: number, numStr: string, newNum: string}[]}
 */
function flatPatches(patches, layout) {
  if (patches.length === 0) return patches;
  const spans = pieceSpans(layout.original);
  const flat = layout.original.join('');
  return patches.map((patch) => {
    const range = flatRange(layout, patch.index, patch.numStr.length);
    if (!pieceHolding(spans, range.start, 1)) return patch;
    const numStr = range.converted ? flat.substring(range.start, range.start + range.length) : patch.numStr;
    return Object.assign({}, patch, { index: range.start, numStr });
  });
}

// The position in the classified text of the character at a position of the
// join of original, or -1 when the classified text does not hold it. With no
// toFlat a flat text counts alike; a rendered text holds no known position (a
// hidden sort key could hold a stacked number), so it returns -1.
function textPosition(layout, text, flat) {
  if (!layout.toFlat) return layout.rendered ? -1 : flat;
  return layout.toFlat.findIndex((f, r) => f === flat && !/\s/.test(text[r]));
}

/**
 * Whether the text the browser shows has piece i straight after the
 * character before it, with no space or line break between. Pieces on
 * separate lines (a <br> or a block boundary) return false; pieces that inline
 * styling splits ("6,7" plain, "18,245" in bold) return true. Text that
 * differs from the pieces in more than whitespace, or lacks the piece's first
 * character, returns true, so the pieces stay unchanged.
 * @param {string} shown - the cell's rendered text
 * @param {string[]} pieces - the cell's live text pieces, in page order
 * @param {number} i
 * @returns {boolean}
 */
function showsPiecesTogether(shown, pieces, i) {
  const toFlat = mapRenderedToFlat(shown, pieces.join(''));
  if (!toFlat) return true;
  const { start } = pieceSpans(pieces)[i];
  const at = toFlat.findIndex((f, r) => f === start && !/\s/.test(shown[r]));
  return at <= 0 || !/\s/.test(shown[at - 1]);
}

// The numbers of a stacked cell: a cell whose text pieces each hold one
// whole number or unit number, or nothing but whitespace, currency signs (the
// currency list), a percent sign, or a listed currency code.
// Two numbers in one piece, even with a space between them ("416 555 1234"),
// make the cell not stacked, and so does a piece that reads as a date or a
// time ("2024" above "2025"), because a lone year stays a year. Returns the
// numbers as matches measured in the join of original, null when the cell
// is not stacked, or 'split' when a number sits across two pieces: a piece
// that ends in "." or "," before one that starts with a digit ("4." then
// "91"). A piece that starts with "." or "," never reads as a number, so "4"
// then ".91" is not stacked either. A digit next to a digit across two
// pieces reads as two numbers, the shape of one number per line, unless
// runTogether(span) holds for the second piece: then the two pieces read as
// one number split across them ("6,7" plain, then "18,245" in bold).
function stackedMatches(spans, runTogether) {
  const signPiece = new RegExp('^(?:' + CURRENCY_SIGN_ALTERNATION + '|%)+$');
  const filled = spans.filter((span) => span.text.length > 0);
  for (let k = 1; k < filled.length; k++) {
    const before = filled[k - 1].text;
    if (!/^\d/.test(filled[k].text)) continue;
    if (/[.,]$/.test(before) || (/\d$/.test(before) && runTogether(filled[k]))) return 'split';
  }
  const matches = [];
  for (const span of filled) {
    const trimmed = span.text.trim();
    if (trimmed === '' || signPiece.test(trimmed) || CURRENCY_CODES.includes(trimmed)) continue;
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
 * number of an extracted cell. A date or time passes through; its piece check
 * runs when its patch is built, because only a changed value needs one.
 *
 * A decision whose characters cross a piece boundary takes the stacked-cell
 * test (see stackedMatches), and so does a cell the ladder left unsimplified
 * because the "words" switch is off (reason 'mixed-disabled'). A stacked cell
 * rounds number by number as an extracted decision; a number split across
 * pieces skips with reason 'split'; any other cell skips with reason
 * 'pieces'. The test reads a digit beside a digit across two pieces as two
 * numbers unless the layout's runsTogether(i) holds for the second piece: the
 * shown text runs the pieces together, as inline styling does to one number
 * ("1" plain, "23" in bold), and the number skips with reason 'split'.
 * runsTogether reads the shown text on both table kinds.
 *
 * A cell with no layout (its pieces no longer reach its record) skips with
 * reason 'pieces-changed'. A cell with a <sup> keeps a skip decision, so a
 * footnote marker never rounds as a stacked number.
 *
 * @param {object} decision - classifyCell's decision
 * @param {string} text - the text the decision was classified on
 * @param {PieceLayout|null} layout
 * @param {{hasSuperscript?: boolean}} [opts]
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
  const matches = stackedMatches(pieceSpans(layout.original), (span) => layout.runsTogether(span.i));
  if (matches === 'split') return { mode: 'skip', reason: 'split' };
  if (matches === null) return decision.mode === 'skip' ? decision : { mode: 'skip', reason: 'pieces' };
  // stackedMatches counts in the join of original and the decision counts in
  // the classified text, so each match moves through textPosition here and the
  // patch step moves it back (see flatPatches).
  const placed = matches.map((m) => Object.assign({}, m, { index: textPosition(layout, text, m.index) }));
  if (placed.some((m) => m.index < 0)) return decision.mode === 'skip' ? decision : { mode: 'skip', reason: 'pieces' };
  return { mode: 'extracted', reason: 'stacked', value: { matches: placed } };
}

// --- Detection predicates ---
// The functions below find the tables and grids on a page and read their
// shape, from the DOM, with the GRID_* constants and makeAdapter above.
// ui-pillbox.js and content.js call them.

/**
 * The geometry probe: does `el` look like a grid built from generic elements?
 *
 * The checks run cheapest first, and the first to fail returns false: at
 * least DR_DETECTION_SETTINGS.gridMinChildren children; the most common child
 * count (see childCountCandidates) held by at least
 * DR_DETECTION_SETTINGS.gridRepetitionShare of them, which makes the children
 * that hold it the candidate rows; a display value in
 * DR_DETECTION_SETTINGS.gridDisplayValues; a cell the data test counts among
 * the candidate rows (probeRowsHoldNumber); and a grid mark (carriesGridMark)
 * or else first cells that align (firstCellsAlign), the one check that reads
 * boxes.
 *
 * @param {Element} el
 * @param {{styleProbe?: object, originalsPort?: object, vendorProfiles?: object[]}} [opts]
 * @returns {boolean}
 */
function looksLikeGrid(el, opts = {}) {
  if (!el || typeof el.children === 'undefined') return false;
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  const children = Array.from(el.children);
  if (children.length < DR_DETECTION_SETTINGS.gridMinChildren) return false;
  const { modalFreq, candidates: candidateRows } = childCountCandidates(children);
  if (modalFreq < children.length * DR_DETECTION_SETTINGS.gridRepetitionShare) return false;
  const computedForDisplay = styleProbe.getComputedStyle(el);
  const display = (computedForDisplay && computedForDisplay.display) || '';
  if (!DR_DETECTION_SETTINGS.gridDisplayValues.includes(display)) return false;
  if (!probeRowsHoldNumber(candidateRows, opts)) return false;
  return carriesGridMark(el, opts.vendorProfiles || GRID_VENDOR_PROFILES)
    || firstCellsAlign(children, candidateRows, styleProbe);
}

/**
 * Whether the geometry probe's candidate rows hold a cell the data test counts
 * (see holdsRoundableCell). The cells are the rows' children, read as grid cells.
 * @param {Element[]} candidateRows
 * @param {{originalsPort?: object}} opts
 * @returns {boolean}
 */
function probeRowsHoldNumber(candidateRows, opts) {
  const port = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
  // A candidate row holds at least one cell, so the data test's budget of
  // cell reads ends within this many rows; the column plan reads no further.
  const rows = candidateRows.slice(0, DR_DETECTION_SETTINGS.dataTestCellBudget);
  return holdsRoundableCell(buildRows(rows.map((row) => Array.from(row.children)), gridCellSpans,
    (cellEl) => makeGridCellObj(cellEl, port)));
}

/**
 * Whether the page marks `el` as a grid: role="grid", role="table", or a class
 * that contains a vendor profile's classToken. A marked element passes the
 * geometry probe with no alignment check.
 * @param {Element} el
 * @param {{classToken: string}[]} vendorProfiles
 * @returns {boolean}
 */
function carriesGridMark(el, vendorProfiles) {
  const role = el.getAttribute && el.getAttribute('role');
  if (role === 'grid' || role === 'table') return true;
  const elClass = (el.className && typeof el.className === 'string') ? el.className : '';
  return vendorProfiles.some(profile => elClass.includes(profile.classToken));
}

/**
 * Whether the first cells of the candidates line up, sampling at most
 * DR_DETECTION_SETTINGS.gridColumnWidthSample candidates. The probe measures
 * along the axis on which cells line up. On a row-first grid the candidates
 * are rows, and the first cells of the rows form column A, so their widths
 * agree. On a column-first grid (see isColumnFirst) the candidates are
 * columns, and the first cells of the columns form the first row, so their
 * heights agree. Fewer than two measurable candidates leave nothing to
 * disagree, so the answer is true.
 * @param {Element[]} children - the element's children, which fix the direction
 * @param {Element[]} candidateRows
 * @param {object} styleProbe
 * @returns {boolean}
 */
function firstCellsAlign(children, candidateRows, styleProbe) {
  const sample = candidateRows.slice(0, DR_DETECTION_SETTINGS.gridColumnWidthSample);
  const extentOf = isColumnFirst(children, styleProbe)
    ? (cell) => { const box = styleProbe.getBox(cell); return box ? box.height : -1; }
    : (cell) => styleProbe.getOffsetWidth(cell);
  const extents = sample.map(row => row.children[0] ? extentOf(row.children[0]) : -1)
                        .filter(w => w > 0);
  if (extents.length < 2) return true;
  const firstExtent = extents[0];
  const matchCount = extents.filter(w => w === firstExtent).length;
  return matchCount / extents.length >= DR_DETECTION_SETTINGS.gridColumnWidthAgreement;
}

/**
 * Find the grid or table root for the element `el` was right-clicked inside.
 * The body applies four routes in order: the nearest <table> ancestor; the
 * nearest ancestor (or `el` itself) that opts.isRegistered reports as
 * registered;
 * findTables from the chain root of the nest `el` sits in, whose nomination
 * step finds a marked grid the load-time scan missed; and the outermost
 * looksLikeGrid match on a walk up from `el`.
 *
 * It returns { handle, isNew }. `handle` is the resolved element. `isNew` is
 * true when the caller still has to mark the element and build its table
 * pillbox. The first route returns isNew: false for every native table,
 * registered or not: the load-time scan and the added-node pass register
 * native tables and build their table pillboxes, and a native table takes no
 * dr-ext-grid marker class. The second route returns isNew: false because it
 * matched a registered element. The last two return
 * !opts.isRegistered(handle). Without opts.isRegistered the second route does
 * nothing and the last two return isNew: true, since detection keeps no
 * registry.
 *
 * Returns null if nothing matches.
 *
 * @param {Element} el
 * @param {{styleProbe?: object, vendorProfiles?: object[], doc?: Document, isRegistered?: (handle: Element) => boolean}} [opts]
 * @returns {{handle: Element, isNew: boolean}|null}
 */
function findTargetTable(el, opts = {}) {
  if (!el) return null;
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const isRegistered = opts.isRegistered || (() => false);
  const docBody = doc && doc.body;

  if (typeof el.closest === 'function') {
    const tableAncestor = el.closest('table');
    if (tableAncestor) return { handle: tableAncestor, isNew: false };
  }
  const registered = registeredAncestor(el, docBody, isRegistered);
  if (registered) return { handle: registered, isNew: false };
  const nominated = nominatedInNest(el, { ...opts, isRegistered });
  if (nominated) return { handle: nominated, isNew: !isRegistered(nominated) };
  const outermost = outermostGridAbove(el, docBody, opts);
  return outermost && { handle: outermost, isNew: !isRegistered(outermost) };
}

/**
 * The nearest ancestor of `el`, or `el` itself, that isRegistered reports as
 * registered, within DR_DETECTION_SETTINGS.gridWalkDepthCap levels and short
 * of the document body. A walk up and not a closest('.dr-ext-grid') query,
 * because isRegistered is an arbitrary per-element check (typically a
 * WeakMap-backed registry.has), not a CSS selector.
 * @param {Element} el
 * @param {Element|null|undefined} docBody
 * @param {(handle: Element) => boolean} isRegistered
 * @returns {Element|null}
 */
function registeredAncestor(el, docBody, isRegistered) {
  return walkUp(el, DR_DETECTION_SETTINGS.gridWalkDepthCap, (node) => node === docBody,
    (node) => node.nodeType === DR_TABLE_ELEMENT_NODE && isRegistered(node));
}

/**
 * The element the nomination step selects (see nominateNests) over the chain
 * root of the nest `el` sits in, or null. The step applies the configured
 * nesting depth to the whole nest, so the element it selects can be a sibling
 * of the clicked element: a click in a vendor grid's row-number gutter
 * resolves the scrolling pane beside it. Pass 1 of findTables returns nothing
 * here, because a qualifying chain root holds no native table other than
 * accessibility artifacts.
 *
 * The step selects nothing for a nest whose chain is empty, for a depth
 * holding more than one element, and for a nest already holding a registered
 * element; each of those leaves the result to the geometry probe, which is the
 * behavior issue #382 records for a click in a sibling pane of a registered
 * nest.
 * @param {Element} el
 * @param {object} opts - the options of findTables, with isRegistered set
 * @returns {Element|null}
 */
function nominatedInNest(el, opts) {
  const chainRoot = chainRootOf(el, opts);
  const nominated = chainRoot && findTables(chainRoot, opts)[0];
  return nominated ? nominated.handle : null;
}

/**
 * The outermost element in an unbroken run of looksLikeGrid matches on a walk
 * up from `el`, within DR_DETECTION_SETTINGS.gridWalkDepthCap levels and short
 * of the document body, or null when no ancestor matches. The walk ends at the
 * first non-match above a match.
 * @param {Element} el
 * @param {Element|null|undefined} docBody
 * @param {object} opts - the options of looksLikeGrid
 * @returns {Element|null}
 */
function outermostGridAbove(el, docBody, opts) {
  let outermost = null;
  walkUp(parentOf(el), DR_DETECTION_SETTINGS.gridWalkDepthCap, (node) => node === docBody, (node) => {
    if (node.nodeType !== DR_TABLE_ELEMENT_NODE) return false;
    if (looksLikeGrid(node, opts)) {
      outermost = node;
      return false;
    }
    return outermost !== null;
  });
  return outermost;
}

/**
 * The nearest positioned ancestor of `el`, or `el` itself when it is
 * positioned; null when none is. Positioned means a CSS position of relative,
 * absolute, fixed, or sticky, read through the style probe.
 *
 * @param {Element} el
 * @param {{styleProbe?: object}} [opts]
 * @returns {Element|null}
 */
function _nearestPositionedAncestor(el, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  const POSITIONED = new Set(['relative', 'absolute', 'fixed', 'sticky']);
  return walkUp(el, Infinity, null, (node) => {
    if (typeof node.getAttribute !== 'function') return false;
    const style = styleProbe.getComputedStyle(node);
    return !!(style && POSITIONED.has(style.position));
  });
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
 * Whether a <table> is an accessibility artifact: a table that exists for
 * screen readers or as a chart's fallback. True
 * when the table or an ancestor carries aria-hidden="true"; when the nearest
 * positioned ancestor (or the table) has a `left` at or below
 * DR_DETECTION_SETTINGS.offscreenLeftPx, read through the style probe; or
 * when that ancestor also contains an <svg> with a non-empty aria-label, the
 * chart the table falls back for.
 *
 * @param {Element} table
 * @param {{styleProbe?: object}} [opts]
 * @returns {boolean}
 */
function isAccessibilityArtifact(table, opts = {}) {
  if (!table || typeof table.getAttribute !== 'function') return false;
  if (carriesHiddenMark(table)) return true;
  const posAncestor = _nearestPositionedAncestor(table, opts);
  return sitsOffscreen(posAncestor || table, opts.styleProbe || DEFAULT_STYLE_PROBE)
    || (!!posAncestor && holdsLabelledSvg(posAncestor));
}

/**
 * Whether `table` or an ancestor carries aria-hidden="true". The walk ends at
 * the document root, a node with no tagName.
 * @param {Element} table
 * @returns {boolean}
 */
function carriesHiddenMark(table) {
  return walkUp(table, Infinity, (node) => node !== table && typeof node.tagName === 'undefined',
    (node) => typeof node.getAttribute === 'function' && node.getAttribute('aria-hidden') === 'true') !== null;
}

/**
 * Whether the element's `left`, read through the style probe, sits at or below
 * DR_DETECTION_SETTINGS.offscreenLeftPx.
 * @param {Element} el - the nearest positioned ancestor of the table, or the table
 * @param {object} styleProbe
 * @returns {boolean}
 */
function sitsOffscreen(el, styleProbe) {
  const computed = styleProbe.getComputedStyle(el);
  const left = computed ? _parsePx(computed.left) : NaN;
  return !isNaN(left) && left <= DR_DETECTION_SETTINGS.offscreenLeftPx;
}

/**
 * Whether the element holds an <svg> with a non-empty aria-label: the chart a
 * table falls back for.
 * @param {Element} el - the table's nearest positioned ancestor
 * @returns {boolean}
 */
function holdsLabelledSvg(el) {
  if (typeof el.querySelector !== 'function') return false;
  try {
    return Array.from(el.querySelectorAll('svg')).some((svg) => {
      const label = typeof svg.getAttribute === 'function' ? svg.getAttribute('aria-label') : null;
      return typeof label === 'string' && label.trim() !== '';
    });
  } catch (e) { return false; }
}

/**
 * Whether the rows hold a cell the extension can round: the cell read of the
 * data test (isDataTable) and of the geometry probe's numeric step
 * (looksLikeGrid). Each cell goes through classifyTableCell, the function
 * the rounding pass calls for every cell, under DETECTION_OPTIONS (every
 * switch on) and no range expression. A cell counts when its decision is not
 * skip, so a whole-link cell, a cell holding only an identifier shape, a
 * number inside a link, and a number split across text pieces add nothing.
 *
 * The walk spends one budget of DR_DETECTION_SETTINGS.dataTestCellBudget cell
 * reads, counted across every row and cell in order; an empty cell counts as
 * a read. It returns true at the first cell that counts. It keeps each
 * ambiguous date with its grid column, and once the rows end or the budget
 * runs out, the column post-pass (resolveAmbiguousDates) reads them, so an
 * ambiguous date counts only when the post-pass resolves it to a reading. The
 * post-pass reads the dates within the budget alone.
 *
 * @param {{getCells(): object[]}[]} rows - rows of cell objects, each
 *   carrying its grid column (columnIndex)
 * @returns {boolean}
 */
function holdsRoundableCell(rows) {
  const pending = [];
  let cellsRead = 0;
  walk:
  for (let i = 0; i < rows.length; i++) {
    for (const cellObj of rows[i].getCells()) {
      if (cellsRead >= DR_DETECTION_SETTINGS.dataTestCellBudget) break walk;
      cellsRead++;
      const { info, col } = classifyTableCell(cellObj, i, DETECTION_OPTIONS, null);
      if (info.mode === 'date' && info.ambiguous) pending.push({ info, col });
      else if (info.mode !== 'skip') return true;
    }
  }
  return resolveAmbiguousDates(pending).some((entry) => entry.info.mode !== 'skip');
}

/**
 * The data test: whether `table` has at least two rows, a row with two or
 * more cells, and a cell the extension can round (see holdsRoundableCell).
 *
 * @param {Element} table
 * @param {{originalsPort?: object, vendorProfiles?: object[]}} [opts]
 * @returns {boolean}
 */
function isDataTable(table, opts = {}) {
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
  return holdsRoundableCell(rows);
}

/**
 * Read one table's shape fingerprint through the adapter: the column count
 * (the widest row's cell count) and, where the table has a header row, that
 * row's cell texts. The registry records it when the table registers, and
 * every action on a registered table compares the current shape against it.
 *
 * The row count stays out: a virtualized grid creates and destroys rows on
 * every scroll, so a row count would report a scroll as a shape change. For
 * the same reason a grid that groups nothing has no header texts (see
 * _hasHeaderRow): its first row is a data row that a scroll redraws.
 *
 * opts.originalText, when the caller supplies it, reads a cell's stored
 * pre-simplification text and returns undefined for a cell with none. A
 * fingerprint read through it stays the same while the extension simplifies
 * the table's header cells, so the extension's writes do not read as a page
 * change. Without it the read takes each cell's current text.
 *
 * The return holds plain values only, so a registry entry holding one stays
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
 * On a grid the answer is the adapter's outside-row mark: a grid that groups
 * its data rows puts its header row outside every group. A grid that groups
 * nothing (a database query grid) has a data row first, and a scroll redraws
 * it, so its text describes the rows on the screen rather than the table.
 *
 * A native table's adapter carries no outside-row mark, so the row itself is
 * read: it sits in a THEAD, or it holds header cells and no data cell, which
 * covers a leading row of <th> with no explicit head section. The pass reads
 * such a row like any other; the first-row exclusion leaves it as written, by
 * position.
 *
 * @param {Element} el
 * @param {NativeTableAdapter|GridAdapter} adapter
 * @param {{isOutside?: boolean, getCells(): object[]}} firstRow
 * @returns {boolean}
 */
function _hasHeaderRow(el, adapter, firstRow) {
  if (!(adapter instanceof NativeTableAdapter)) return firstRow.isOutside === true;
  const rowEl = el.rows && el.rows[0];
  const parent = rowEl && parentOf(rowEl);
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
 * With a missing side the function returns false. The one caller reads a missing recorded
 * fingerprint as a separate case before it compares, so a false here always
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
 * The two guards of a qualifying element: it is not a native table, and every
 * native table it holds is one isArtifact drops (pass 1 reports the others).
 *
 * @param {Element} el
 * @param {(table: Element, opts: object) => boolean} isArtifact
 * @param {object} opts
 * @returns {boolean}
 */
function _passesAriaGuards(el, isArtifact, opts) {
  if (!el || el.tagName === 'TABLE') return false;
  const nestedTables = typeof el.querySelectorAll === 'function' ? Array.from(el.querySelectorAll('table')) : [];
  return !nestedTables.some((t) => !isArtifact(t, opts));
}

/**
 * Whether an ancestor is a qualifying element. An ancestor carries no other
 * evidence of its role, so the role read goes through `matches`; an element
 * stub with no `matches` counts as not qualifying, which makes the
 * element below it a chain root.
 *
 * @param {Element} el
 * @param {(table: Element, opts: object) => boolean} isArtifact
 * @param {object} opts
 * @returns {boolean}
 */
function _isQualifyingAncestor(el, isArtifact, opts) {
  if (!el || typeof el.matches !== 'function') return false;
  let carriesRole = false;
  try { carriesRole = !!el.matches(GRID_ARIA_SELECTOR); } catch (e) { return false; }
  if (!carriesRole) return false;
  return _passesAriaGuards(el, isArtifact, opts);
}

/**
 * The nesting depth of `el` in the containment chain under `chainRoot`: the
 * count of qualifying ancestors from `el` up to and including `chainRoot` (the
 * chain root sits at depth 0). Returns -1 when the walk leaves the nest
 * without reaching the chain root, or first crosses an ancestor carrying a
 * cell role (then `el` belongs to a nest of its own), so the caller drops
 * the element rather than filing it at a wrong depth.
 *
 * @param {Element} el
 * @param {Element} chainRoot
 * @param {(table: Element, opts: object) => boolean} isArtifact
 * @param {object} opts
 * @returns {number}
 */
function _depthInChain(el, chainRoot, isArtifact, opts) {
  if (el === chainRoot) return 0;
  let count = 0;
  const reached = walkUp(parentOf(el), DR_DETECTION_SETTINGS.gridWalkDepthCap,
    (node) => node !== chainRoot && _isCellAncestor(node), (node) => {
      if (node === chainRoot) return true;
      if (_isQualifyingAncestor(node, isArtifact, opts)) count++;
      return false;
    });
  return reached ? count + 1 : -1;
}

/**
 * Apply the configured nesting depth to one containment chain and return the
 * element to register, or null.
 *
 * `byDepth` maps a nesting depth to the chain's elements at that depth — the
 * qualifying elements that passed the data test, and those alone. Two edge
 * rules complete the selection:
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
 * The chain root of the nest `el` sits in: the outermost qualifying element at
 * or above `el` that no cell separates from the nearest one, or null when no
 * qualifying element sits within DR_DETECTION_SETTINGS.gridWalkDepthCap
 * levels of `el`.
 *
 * The function first finds the nearest qualifying element at or above an
 * arbitrary element (a clicked cell, an added node, or a registered table),
 * walking across cells, so a click in a cell reaches the grid holding the
 * cell. From there it walks up to the outermost qualifying element, bounded by
 * the same cap, and stops at the document body and at the first ancestor
 * carrying a cell role. It continues past an ancestor that carries no role,
 * because a nest may put a plain wrapper between two qualifying elements.
 *
 * @param {Element} el
 * @param {{isArtifact?: (table: Element, opts: object) => boolean,
 *          doc?: Document, styleProbe?: object}} [opts]
 * @param {boolean} [isQualifying] - true when `el` is already a qualifying
 *   element, which skips the walk to the nearest one
 * @returns {Element|null}
 */
function chainRootOf(el, opts = {}, isQualifying = false) {
  if (!el) return null;
  const isArtifact = opts.isArtifact || isAccessibilityArtifact;
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const docBody = doc && doc.body;
  const cap = DR_DETECTION_SETTINGS.gridWalkDepthCap;
  const qualifies = (node) => _isQualifyingAncestor(node, isArtifact, opts);
  const nearest = isQualifying ? el : walkUp(el, cap, (node) => node === docBody, qualifies);
  let chainRoot = nearest;
  if (nearest) {
    walkUp(parentOf(nearest), cap, (node) => node === docBody || _isCellAncestor(node), (node) => {
      if (qualifies(node)) chainRoot = node;
      return false;
    });
  }
  return chainRoot;
}

/**
 * Run the nomination step on the nest under `chainRoot` and report the
 * outcome.
 *
 * The nest is `chainRoot` plus every qualifying element under it that no cell
 * separates from it: a qualifying element inside a cell belongs to a nest
 * of its own. The chain is the nest's elements that pass the data test,
 * grouped by nesting depth; _selectAtNestingDepth applies
 * DR_DETECTION_SETTINGS.nestingDepth with its two edge rules.
 *
 * The outcome is the reason the step returns what it returns, which separates
 * a nest worth watching from one worth leaving:
 *   - 'selected'   — `selected` holds the element to register.
 *   - 'empty'      — no element of the nest passes the data test. This is the
 *                    pending-table case: the nest's rows may arrive later.
 *   - 'crowded'    — a depth holds more than one element and no shallower
 *                    depth holds exactly one, so the nest registers nothing
 *                    (the product decision in issue #373).
 *   - 'registered' — the nest already holds an element opts.isRegistered
 *                    reports, so a second run over a registered nest registers
 *                    nothing.
 *
 * `chainSize` holds the chain's size: the nest elements that passed the data
 * test and filed at a nesting depth. It is 0 for 'empty', and 0 for
 * 'registered', which returns before the data test runs.
 *
 * opts.nestingDepth, when the caller supplies it, replaces
 * DR_DETECTION_SETTINGS.nestingDepth. Zero is a legal depth, so the override
 * test is a nullish check. The function keeps no record of a nest it has
 * already run on.
 *
 * @param {Element} chainRoot
 * @param {{isArtifact?: (table: Element, opts: object) => boolean,
 *          isRegistered?: (handle: Element) => boolean, nestingDepth?: number,
 *          doc?: Document, styleProbe?: object, vendorProfiles?: object[]}} [opts]
 * @returns {{chainRoot: Element, selected: Element|null, outcome: string, chainSize: number}}
 */
function nominateNest(chainRoot, opts = {}) {
  const isArtifact = opts.isArtifact || isAccessibilityArtifact;
  const isRegistered = opts.isRegistered || (() => false);
  const configuredDepth = opts.nestingDepth ?? DR_DETECTION_SETTINGS.nestingDepth;

  // The nest's members, each with its nesting depth. A qualifying element
  // whose walk up crosses a cell before it reaches the chain root belongs to
  // a nest of its own (_depthInChain returns -1), so it stays out of this
  // nest: a registered grid inside a cell never makes the grid around it read
  // as registered.
  const nested = typeof chainRoot.querySelectorAll === 'function'
    ? Array.from(chainRoot.querySelectorAll(GRID_ARIA_SELECTOR)) : [];
  const nest = [chainRoot].concat(nested)
    .filter((el) => _passesAriaGuards(el, isArtifact, opts))
    .map((el) => ({ el, depth: _depthInChain(el, chainRoot, isArtifact, opts) }))
    .filter((member) => member.depth >= 0);

  // A nest holding a registered element registers nothing: the scan already
  // ran over it, and a second registration would put a second table pillbox
  // on one grid.
  if (nest.some(({ el }) => isRegistered(el))) {
    return { chainRoot, selected: null, outcome: 'registered', chainSize: 0 };
  }

  const byDepth = new Map();
  let chainSize = 0;
  for (const { el, depth } of nest) {
    if (!isDataTable(el, opts)) continue;
    chainSize++;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth).push(el);
  }

  const selected = _selectAtNestingDepth(byDepth, configuredDepth);
  if (selected) return { chainRoot, selected, outcome: 'selected', chainSize };
  return { chainRoot, selected: null, outcome: chainSize === 0 ? 'empty' : 'crowded', chainSize };
}

/**
 * Run the nomination step over every nest under `root` and report one result
 * per nest, in document order.
 *
 * From `root` this lists the qualifying elements: `root` itself when it
 * carries the role, plus every descendant carrying it, each past the two
 * guards in _passesAriaGuards. It walks each one up to its chain root and runs
 * nominateNest on every chain root once. A chain root can sit outside `root`
 * (an added node inside a wrapper already in the page), so a second run over
 * the same nest evaluates the whole nest again.
 *
 * Both live scanners (ui-pillbox.js's load-time scan and content.js's
 * added-node pass) reach the grids on a page through this function, and the
 * controller turns each outcome into a registration or a pending table.
 *
 * @param {Element|Document} root
 * @param {{isArtifact?: (table: Element, opts: object) => boolean,
 *          isRegistered?: (handle: Element) => boolean, nestingDepth?: number,
 *          doc?: Document, styleProbe?: object, vendorProfiles?: object[]}} [opts]
 * @returns {{chainRoot: Element, selected: Element|null, outcome: string, chainSize: number}[]}
 */
function nominateNests(root, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const isArtifact = opts.isArtifact || isAccessibilityArtifact;

  const rootCarriesRole = root.tagName !== 'TABLE' && typeof root.matches === 'function' && root.matches(GRID_ARIA_SELECTOR);
  const roleBearing = (rootCarriesRole ? [root] : []).concat(Array.from(root.querySelectorAll(GRID_ARIA_SELECTOR)));
  const qualifying = roleBearing.filter((el) => _passesAriaGuards(el, isArtifact, opts));

  // One chain root per nest, each evaluated once. A Set keeps
  // insertion order, so the results stay in document order.
  const chainRoots = new Set();
  for (const el of qualifying) chainRoots.add(chainRootOf(el, opts, true));

  const results = [];
  for (const chainRoot of chainRoots) results.push(nominateNest(chainRoot, opts));
  return results;
}

/**
 * Scan `root` for native <table> elements (pass 1), then run the nomination
 * step over the elements carrying a grid or table role (pass 2).
 *
 * Pass 2 keeps the nests nominateNests reports as 'selected' and drops the
 * other three outcomes. A caller that acts on those — the controller, which
 * holds a pending table for an empty nest — calls nominateNests directly.
 *
 * Each result is { handle, isNew }; isNew is !opts.isRegistered(handle),
 * where opts.isRegistered is a caller-supplied registered check (e.g.
 * DR_MODEL.hasTable) for native tables and grid roots alike. Without
 * opts.isRegistered every result reports isNew: true, since detection keeps
 * no registry.
 *
 * @param {Element|Document} root
 * @param {{isArtifact?: (table: Element, opts: object) => boolean,
 *          isRegistered?: (handle: Element) => boolean, nestingDepth?: number,
 *          doc?: Document, styleProbe?: object, vendorProfiles?: object[]}} [opts]
 * @returns {{handle: Element, isNew: boolean}[]}
 */
function findTables(root, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const isArtifact = opts.isArtifact || isAccessibilityArtifact;
  const isRegistered = opts.isRegistered || (() => false);
  const results = [];

  // Pass 1: native <table> elements; isArtifact drops accessibility artifacts.
  const nativeTables = root.tagName === 'TABLE' ? [root] : Array.from(root.querySelectorAll('table'));
  for (const table of nativeTables) {
    if (isArtifact(table, opts)) continue;
    results.push({ handle: table, isNew: !isRegistered(table) });
  }

  for (const { selected, outcome } of nominateNests(root, opts)) {
    if (outcome !== 'selected') continue;
    results.push({ handle: selected, isNew: !isRegistered(selected) });
  }

  return results;
}
