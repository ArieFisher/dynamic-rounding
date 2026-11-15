/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The detection layer of the lib/dr-table package. Detection reads the page
 * and returns findings. It builds no table pillbox and keeps no registry:
 * "is this element registered" is the injected opts.isRegistered check. The
 * caller (content.js) checks the registry in DR_MODEL and, for a first match,
 * registers the table and builds the table pillbox.
 *
 * The style probe is the port for every computed style and box read, so
 * detection runs in a plain Node context with no Chrome globals. `document`
 * comes in as opts.doc.
 *
 * DETECTION_OPTIONS reads DR_DEFAULTS at the top level, so a missing object
 * fails at load, before any function here runs.
 */

const GRID_ARIA_SELECTOR = '[role="grid"], [role="table"]';

// Node.ELEMENT_NODE, or its fixed DOM value where no `Node` global exists.
const DR_TABLE_ELEMENT_NODE = (typeof Node !== 'undefined' && Node.ELEMENT_NODE) || 1;

// Every "simplify" switch in the settings contract, on, so a table passes the
// data test whatever its own switches hold, and a new switch reaches the test
// with no edit here.
const DETECTION_OPTIONS = Object.freeze(Object.fromEntries(
  Object.keys(DR_DEFAULTS).filter((key) => key.startsWith('simplify')).map((key) => [key, true])));

/**
 * The geometry probe: does `el` look like a grid built from generic elements?
 * The checks run cheapest first; firstCellsAlign is the one that reads boxes.
 *
 * @param {Element} el
 * @param {{isArtifact?: (el: Element, opts: object) => boolean, styleProbe?: object, originalsPort?: object, vendorProfiles?: object[]}} [opts]
 * @returns {boolean}
 */
function looksLikeGrid(el, opts = {}) {
  if (!el || typeof el.children === 'undefined') return false;
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  const children = Array.from(el.children);
  if (children.length < DR_DETECTION_SETTINGS.gridMinChildren) return false;
  const { modalFreq, candidates: candidateRows } = childCountCandidates(children);
  if (modalFreq < children.length * DR_DETECTION_SETTINGS.gridRepetitionShare) return false;
  if ((opts.isArtifact || isAccessibilityArtifact)(el, opts)) return false;
  const computedForDisplay = styleProbe.getComputedStyle(el);
  const display = (computedForDisplay && computedForDisplay.display) || '';
  if (!DR_DETECTION_SETTINGS.gridDisplayValues.includes(display)) return false;
  if (!probeRowsHoldNumber(candidateRows, opts)) return false;
  return carriesGridMark(el, opts.vendorProfiles || GRID_VENDOR_PROFILES)
    || firstCellsAlign(children, candidateRows, styleProbe);
}

/**
 * Whether the candidate rows hold a cell the data test counts, reading the
 * rows' children as grid cells.
 * @param {Element[]} candidateRows
 * @param {{originalsPort?: object}} opts
 * @returns {boolean}
 */
function probeRowsHoldNumber(candidateRows, opts) {
  const port = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
  // Each candidate row holds at least one cell, so the cell budget ends
  // within this many rows.
  const rows = candidateRows.slice(0, DR_DETECTION_SETTINGS.dataTestCellBudget);
  return holdsRoundableCell(buildRows(rows.map((row) => Array.from(row.children)),
    (cellEl) => makeCellObj(cellEl, port)));
}

/**
 * Whether the page marks `el` as a grid: role="grid", role="table", or a
 * vendor classToken. A marked element skips the alignment check.
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
 * Whether the first cells of the candidates line up: widths on a row-first
 * grid (column A), heights on a column-first grid (the first row). Fewer than
 * two measurable candidates leave nothing to disagree, so the answer is true.
 * @param {Element[]} children - the element's children, which fix the direction
 * @param {Element[]} candidateRows
 * @param {object} styleProbe
 * @returns {boolean}
 */
function firstCellsAlign(children, candidateRows, styleProbe) {
  const sample = candidateRows.slice(0, DR_DETECTION_SETTINGS.gridSampleSize);
  const extentOf = isColumnFirst(children, styleProbe)
    ? (cell) => { const box = styleProbe.getBox(cell); return box ? box.height : -1; }
    : (cell) => styleProbe.getOffsetWidth(cell);
  const extents = sample.map(row => row.children[0] ? extentOf(row.children[0]) : -1)
                        .filter(w => w > 0);
  if (extents.length < 2) return true;
  const firstExtent = extents[0];
  const matchCount = extents.filter(w => w === firstExtent).length;
  return matchCount / extents.length >= DR_DETECTION_SETTINGS.gridAlignmentAgreement;
}

/**
 * Find the grid or table root for the element `el` was right-clicked inside.
 * Four routes apply in order: the nearest <table> ancestor that is not an
 * accessibility artifact (an artifact is passed over for the table around
 * it); the nearest registered ancestor; the nomination step over the nest `el`
 * sits in, which finds a marked grid the load-time scan missed; and the
 * outermost looksLikeGrid match above `el`.
 *
 * `isNew` is true when the caller still has to mark the element and build its
 * table pillbox. The first route returns isNew: false for every native table,
 * registered or not, because the load-time scan and the added-node pass
 * register native tables. Without opts.isRegistered the last two routes
 * return isNew: true. Returns null if nothing matches.
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
    let tableAncestor = el.closest('table');
    while (tableAncestor && !registrableTables([tableAncestor], opts).length) {
      const above = parentOf(tableAncestor);
      tableAncestor = above && typeof above.closest === 'function' ? above.closest('table') : null;
    }
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
 * registered. A walk up, not a closest() query, because isRegistered is an
 * arbitrary per-element check (typically a WeakMap-backed registry.has).
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
 * The element the nomination step selects over the chain root of the nest `el`
 * sits in, or null. The step applies the configured nesting depth to the whole
 * nest, so the element can be a sibling of the clicked one: a click in a
 * vendor grid's row-number gutter resolves the scrolling pane beside it.
 *
 * When the step selects nothing in `el`'s nest, findTables returns the element
 * selected in the first nest inside a cell under the chain root, if any; with
 * none, the result falls to the geometry probe (issue #382 records this for a
 * click in a sibling pane of a registered nest).
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
 * The outermost element in an unbroken run of looksLikeGrid matches above
 * `el`, or null. The walk ends at the first non-match above a match.
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
 * Whether an element, a native table or a grid, is an accessibility artifact:
 * an element that exists for screen readers. True when the element or an
 * ancestor carries aria-hidden="true", or when the element, or its nearest
 * positioned ancestor, sits offscreen.
 *
 * @param {Element} el
 * @param {{styleProbe?: object}} [opts]
 * @returns {boolean}
 */
function isAccessibilityArtifact(el, opts = {}) {
  if (!el || typeof el.getAttribute !== 'function') return false;
  if (carriesHiddenMark(el)) return true;
  return sitsOffscreen(_nearestPositionedAncestor(el, opts) || el, opts.styleProbe || DEFAULT_STYLE_PROBE);
}

/**
 * Whether `el` or an ancestor carries aria-hidden="true".
 * @param {Element} el
 * @returns {boolean}
 */
function carriesHiddenMark(el) {
  return walkUp(el, Infinity, (node) => node !== el && typeof node.tagName === 'undefined',
    (node) => typeof node.getAttribute === 'function' && node.getAttribute('aria-hidden') === 'true') !== null;
}

/**
 * @param {Element} el - the nearest positioned ancestor of the element, or the element
 * @param {object} styleProbe
 * @returns {boolean}
 */
function sitsOffscreen(el, styleProbe) {
  const computed = styleProbe.getComputedStyle(el);
  const left = computed ? _parsePx(computed.left) : NaN;
  return !isNaN(left) && left <= DR_DETECTION_SETTINGS.offscreenLeftPx;
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
  const readsHeader = rows.length > 0 && _hasHeaderRow(rows[0]);
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
 * Whether the first row the adapter returns is a header row.
 * @param {{isOutside?: boolean, isGrouped?: boolean, getCells(): object[]}} firstRow
 * @returns {boolean}
 */
function _hasHeaderRow(firstRow) {
  if (firstRow.isOutside === true) return true;
  // A virtualized grid that groups nothing can scroll its first row away, so
  // the texts of a row of header cells there could differ on a later read.
  if (firstRow.isGrouped !== true) return false;
  const cells = firstRow.getCells();
  return cells.length > 0 && cells.every((cellObj) => cellObj.isHeaderCell);
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
 * The three guards of a qualifying element: it is not a native table, it is
 * not an accessibility artifact, and every native table it holds is one
 * isArtifact drops (pass 1 reports the others).
 *
 * @param {Element} el
 * @param {(table: Element, opts: object) => boolean} isArtifact
 * @param {object} opts
 * @returns {boolean}
 */
function _passesAriaGuards(el, isArtifact, opts) {
  if (!el || el.tagName === 'TABLE' || isArtifact(el, opts)) return false;
  return !_nativeTablesIn(el).some((t) => !isArtifact(t, opts));
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
 * The count of qualifying ancestors from `el` up to and including `chainRoot`
 * (the chain root sits at depth 0). Returns -1 when the walk leaves the nest
 * or first crosses a cell-role ancestor (`el` then belongs to a nest of its
 * own), so the caller drops the element rather than filing it at a wrong
 * depth.
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
 * The nearest qualifying element is found walking across cells, so a click in
 * a cell reaches the grid holding it. The walk up to the outermost one stops
 * at the first cell-role ancestor and continues past a plain wrapper, because
 * a nest may put one between two qualifying elements.
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
 *   - 'artifact'   — the chain root is an accessibility artifact, so the nest
 *                    registers nothing and a pending table for it stops.
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

  if (isArtifact(chainRoot, opts)) {
    return { chainRoot, selected: null, outcome: 'artifact', chainSize: 0 };
  }

  // An element nested in a cell is out of this nest (_depthInChain returns
  // -1), so a registered grid inside a cell never makes the grid around it
  // read as registered.
  const nested = typeof chainRoot.querySelectorAll === 'function'
    ? Array.from(chainRoot.querySelectorAll(GRID_ARIA_SELECTOR)) : [];
  const nest = [chainRoot].concat(nested)
    .filter((el) => _passesAriaGuards(el, isArtifact, opts))
    .map((el) => ({ el, depth: _depthInChain(el, chainRoot, isArtifact, opts) }))
    .filter((member) => member.depth >= 0);

  // A second registration would put a second table pillbox on one grid.
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
 * Both live scanners (the load-time scan and the added-node pass, both in
 * content.js) reach the grids on a page through this function, and the
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

  // A Set keeps insertion order, so the results stay in document order.
  const chainRoots = new Set();
  for (const el of qualifying) chainRoots.add(chainRootOf(el, opts, true));

  const results = [];
  for (const chainRoot of chainRoots) results.push(nominateNest(chainRoot, opts));
  return results;
}

/**
 * The native tables in `tables` that are not accessibility artifacts, in
 * their order. Every scan of native tables filters through this function, so
 * the artifact filter runs in this file alone.
 *
 * @param {Element[]} tables
 * @param {{isArtifact?: (table: Element, opts: object) => boolean,
 *          styleProbe?: object}} [opts]
 * @returns {Element[]}
 */
function registrableTables(tables, opts = {}) {
  const isArtifact = opts.isArtifact || isAccessibilityArtifact;
  return tables.filter((table) => !isArtifact(table, opts));
}

/**
 * The native tables in `root`: `root` itself when it is a table, then every
 * descendant table, in document order. The one native-table query in the
 * extension.
 *
 * @param {Element|Document} root
 * @returns {Element[]}
 */
function _nativeTablesIn(root) {
  const own = root.tagName === 'TABLE' ? [root] : [];
  return typeof root.querySelectorAll === 'function' ? own.concat(Array.from(root.querySelectorAll('table'))) : own;
}

/**
 * The one table scan. Both live scanners (the load-time scan and the
 * added-node pass) and findTables read it.
 *
 * `tables` holds the native tables that are not accessibility artifacts:
 * `root` when it is a table, then its descendant tables. `nominations` holds
 * one nominateNests result per nest under `root`, with every outcome, so a
 * caller can act on 'empty' (pending table) as well as 'selected'. Neither list
 * checks the registry; the caller does.
 *
 * @param {Element|Document} root
 * @param {{isArtifact?: (table: Element, opts: object) => boolean,
 *          isRegistered?: (handle: Element) => boolean, nestingDepth?: number,
 *          doc?: Document, styleProbe?: object, vendorProfiles?: object[]}} [opts]
 * @returns {{tables: Element[], nominations: {chainRoot: Element, selected: Element|null, outcome: string, chainSize: number}[]}}
 */
function scanTables(root, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return { tables: [], nominations: [] };
  return {
    tables: registrableTables(_nativeTablesIn(root), opts),
    nominations: nominateNests(root, opts),
  };
}

/**
 * The handles scanTables finds under `root`, native tables first, then the
 * nests the nomination step reports as 'selected'. A table root yields itself
 * alone among the native tables. A caller that acts on the other outcomes — the
 * controller, which holds a pending table for an empty nest — reads
 * scanTables.
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
  const isRegistered = opts.isRegistered || (() => false);
  const { tables, nominations } = scanTables(root, opts);
  // A table root yields itself alone, so a shape-change re-registration covers
  // that one table.
  const native = root && root.tagName === 'TABLE' ? tables.filter((table) => table === root) : tables;
  const handles = native.concat(nominations.filter(({ outcome }) => outcome === 'selected').map(({ selected }) => selected));
  return handles.map((handle) => ({ handle, isNew: !isRegistered(handle) }));
}
