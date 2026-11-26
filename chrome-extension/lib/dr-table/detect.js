// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The detection layer of the lib/dr-table package. Detection reads the page
 * and returns findings. It builds no table pillbox and keeps no registry:
 * "is this element registered" is the injected opts.isRegistered check. The
 * caller (content.js) checks the registry in DR_MODEL and, for a first match,
 * registers the table and builds the table pillbox.
 *
 * The style probe is the port for every computed style and box read, so
 * detection runs in a plain Node context with no Chrome globals. `document`
 * comes in as opts.doc, or is the global `document` where opts.doc is absent.
 * opts.isArtifact, when the caller supplies it, replaces isAccessibilityArtifact
 * as the artifact check.
 */

const GRID_ARIA_SELECTOR = '[role="grid"], [role="table"]';

// A node with no `matches`, such as the document, carries no role.
function _carriesGridRole(el) {
  return typeof el.matches === 'function' && el.matches(GRID_ARIA_SELECTOR);
}

// Node.ELEMENT_NODE, which the DOM fixes at 1. A literal, because a plain Node
// context holds no `Node` global.
const DR_TABLE_ELEMENT_NODE = 1;

// The cap of a walk from an element up to the document root: none. The page's
// depth bounds the walk, one step per ancestor, so it ends on every page. A
// count cap would change results rather than bound work: a table more than
// that many levels under an aria-hidden ancestor, such as a page root hidden
// behind a dialog, would stop counting as an accessibility artifact and would
// register, and a right-click that many levels inside a table would miss it.
const WALK_TO_ROOT = Infinity;

// Every "simplify" switch in the settings contract, on, so a table passes the
// data test whatever its own switches hold, and a new switch reaches the test
// with no edit here. The read runs at load, so a missing DR_DEFAULTS fails
// before any function here runs.
const DETECTION_OPTIONS = Object.freeze(Object.fromEntries(
  Object.keys(DR_DEFAULTS).filter((key) => key.startsWith('simplify')).map((key) => [key, true])));

function _artifactCheck(opts) {
  return opts.isArtifact || isAccessibilityArtifact;
}

function _styleProbeOf(opts) {
  return opts.styleProbe || DEFAULT_STYLE_PROBE;
}

function _registeredCheck(opts) {
  return opts.isRegistered || (() => false);
}

/**
 * The geometry probe: does `el` look like a grid built from generic elements?
 * An accessibility artifact fails before the first layout read.
 * firstCellsAlign is the one check that reads boxes.
 *
 * @returns {boolean}
 */
function looksLikeGrid(el, opts = {}) {
  if (!el || typeof el.children === 'undefined') return false;
  const styleProbe = _styleProbeOf(opts);
  const children = Array.from(el.children);
  if (children.length < DR_DETECTION_SETTINGS.gridMinChildren) return false;
  const { modalFreq, candidates: candidateRows } = childCountCandidates(children);
  if (modalFreq < children.length * DR_DETECTION_SETTINGS.gridRepetitionShare) return false;
  if (_artifactCheck(opts)(el, opts)) return false;
  const display = styleProbe.getComputedStyle(el)?.display || '';
  if (!DR_DETECTION_SETTINGS.gridDisplayValues.includes(display)) return false;
  if (!probeRowsHoldRoundableCell(candidateRows, opts)) return false;
  return carriesGridMark(el, opts.vendorProfiles || GRID_VENDOR_PROFILES)
    || firstCellsAlign(children, candidateRows, styleProbe);
}

/**
 * Whether the candidate rows hold a cell the data test counts, reading the
 * rows' children as grid cells.
 * @returns {boolean}
 */
function probeRowsHoldRoundableCell(candidateRows, opts) {
  const port = opts.originalsPort || DEFAULT_ORIGINALS_PORT;
  // Each candidate row holds at least one cell, so the cell budget ends
  // within this many rows.
  const rows = candidateRows.slice(0, DR_DETECTION_SETTINGS.dataTestCellBudget);
  return holdsRoundableCell(buildRows(rows.map((row) => Array.from(row.children)), port));
}

/**
 * Whether the page marks `el` as a grid: role="grid", role="table", or a
 * vendor classToken. A marked element skips the alignment check.
 * @returns {boolean}
 */
function carriesGridMark(el, vendorProfiles) {
  if (_carriesGridRole(el)) return true;
  const elClass = (el.className && typeof el.className === 'string') ? el.className : '';
  return vendorProfiles.some(profile => elClass.includes(profile.classToken));
}

/**
 * Whether the first cells of the candidates line up: widths on a row-first
 * grid (column A), heights on a column-first grid (the first row). With fewer
 * than two measurable first cells the answer is true.
 * @returns {boolean}
 */
function firstCellsAlign(children, candidateRows, styleProbe) {
  const sample = candidateRows.slice(0, DR_DETECTION_SETTINGS.gridSampleSize);
  const extentOf = isColumnFirst(children, styleProbe)
    ? (cell) => { const box = styleProbe.getBox(cell); return box ? box.height : -1; }
    : (cell) => styleProbe.getOffsetWidth(cell);
  const extents = sample.map(row => row.children[0] ? extentOf(row.children[0]) : -1)
                        .filter(extent => extent > 0);
  if (extents.length < 2) return true;
  const firstExtent = extents[0];
  const matchCount = extents.filter(extent => extent === firstExtent).length;
  return matchCount / extents.length >= DR_DETECTION_SETTINGS.gridAlignmentAgreement;
}

/**
 * Find the table the element `el` was right-clicked inside: the nearest table
 * of either kind around it. One walk goes up from `el` and ends at the first
 * element that opts.isRegistered reports, or at the first native table or
 * chain root whose nest the nomination step selects an element in. The step
 * applies the configured nesting depth to the whole nest, so the selected
 * element can be a sibling of the clicked one: a click in a vendor grid's
 * row-number gutter resolves the scrolling pane beside it.
 *
 * The walk passes over a nest the step selects nothing in and goes on to the
 * table around it: a native table that is an accessibility artifact or fails
 * the data test, a grid nest with no data table at its depth, and a nest that
 * holds a registered element off the walk's path, as after a click in a
 * sibling pane of a registered scrolling pane. When the walk ends with no
 * table, the geometry probe returns the outermost looksLikeGrid match above
 * `el`.
 *
 * `isNew` is true when the caller still has to register the element and build
 * its table pillbox. Without opts.isRegistered every result reports isNew:
 * true.
 * Returns null if nothing matches.
 *
 * @returns {{handle: Element, isNew: boolean}|null}
 */
function findTargetTable(el, opts = {}) {
  if (!el) return null;
  const isRegistered = _registeredCheck(opts);
  const docBody = _documentBody(opts);
  let found = null;
  walkUp(el, WALK_TO_ROOT, (node) => node === docBody, (node) => {
    found = _targetAt(node, isRegistered, opts);
    return found !== null;
  });
  if (found) return found;
  const outermost = outermostGridAbove(el, docBody, opts);
  return outermost && { handle: outermost, isNew: !isRegistered(outermost) };
}

// The right-click target at one step of findTargetTable's walk, or null.
function _targetAt(node, isRegistered, opts) {
  if (isRegistered(node)) return { handle: node, isNew: false };
  if (!_isNestRoot(node, opts)) return null;
  const { selected } = nominateNest(node, opts);
  return selected ? { handle: selected, isNew: true } : null;
}

// A native table or a chain root: the element the nomination step runs from.
function _isNestRoot(node, opts) {
  if (node.tagName === 'TABLE') return true;
  return _isQualifyingElement(node, _artifactCheck(opts), opts) && chainRootOf(node, opts, true) === node;
}

function _documentBody(opts) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  return doc && doc.body;
}

/**
 * The outermost element in an unbroken run of looksLikeGrid matches above
 * `el`, or null. The walk ends at the first non-match above a match.
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

const POSITIONED_VALUES = new Set(['relative', 'absolute', 'fixed', 'sticky']);

/**
 * The nearest positioned ancestor of `el`, or `el` itself when it is
 * positioned; null when none is.
 *
 * @returns {Element|null}
 */
function _nearestPositionedAncestor(el, opts = {}) {
  const styleProbe = _styleProbeOf(opts);
  return walkUp(el, WALK_TO_ROOT, null, (node) => {
    if (typeof node.getAttribute !== 'function') return false;
    const style = styleProbe.getComputedStyle(node);
    return !!(style && POSITIONED_VALUES.has(style.position));
  });
}

/**
 * Whether an element, a native table or a grid, is an accessibility artifact:
 * a copy for one audience. True when the element or an ancestor carries
 * aria-hidden="true", which hides it from screen readers, or when the element,
 * or its nearest positioned ancestor, sits off-screen, which leaves it to
 * screen readers alone.
 *
 * @returns {boolean}
 */
function isAccessibilityArtifact(el, opts = {}) {
  if (!el || typeof el.getAttribute !== 'function') return false;
  if (carriesHiddenMark(el)) return true;
  return sitsOffscreen(_nearestPositionedAncestor(el, opts) || el, _styleProbeOf(opts));
}

/**
 * Whether `el` or an ancestor carries aria-hidden="true".
 * @returns {boolean}
 */
function carriesHiddenMark(el) {
  return walkUp(el, WALK_TO_ROOT, null,
    (node) => typeof node.getAttribute === 'function' && node.getAttribute('aria-hidden') === 'true') !== null;
}

/**
 * Whether `el` sits off-screen. The caller passes an element's nearest
 * positioned ancestor, or the element itself when none is positioned.
 * @returns {boolean}
 */
function sitsOffscreen(el, styleProbe) {
  const computed = styleProbe.getComputedStyle(el);
  const left = parseFloat(computed && computed.left);
  return !isNaN(left) && left <= DR_DETECTION_SETTINGS.offscreenLeftPx;
}

/**
 * Whether the rows hold a cell the extension can round: the cell read of the
 * data test (isDataTable) and of the geometry probe's numeric step
 * (looksLikeGrid). classifyTableCell is the function the rounding pass calls
 * for every cell.
 *
 * The walk spends one budget of DR_DETECTION_SETTINGS.dataTestCellBudget cell
 * reads across every row, and an empty cell counts as a read. The walk holds
 * each ambiguous date for the column post-pass, which reads the dates within
 * the budget alone. Each cell object in `rows` carries its grid column
 * (columnIndex).
 *
 * @returns {boolean}
 */
function holdsRoundableCell(rows) {
  const ambiguousCells = [];
  let cellsRead = 0;
  walk:
  for (let i = 0; i < rows.length; i++) {
    for (const cellObj of rows[i].getCells()) {
      if (cellsRead >= DR_DETECTION_SETTINGS.dataTestCellBudget) break walk;
      cellsRead++;
      const { classification, columnIndex } = classifyTableCell(cellObj, i, DETECTION_OPTIONS, null);
      if (isAmbiguousDateClassification(classification)) ambiguousCells.push({ classification, columnIndex });
      else if (classification.stretches.length > 0) return true;
    }
  }
  return resolveAmbiguousDates(ambiguousCells).some((classifiedCell) => classifiedCell.classification.stretches.length > 0);
}

/**
 * The data test: whether `table` has at least two rows, a row with two or
 * more cells, and a cell the extension can round (see holdsRoundableCell).
 *
 * @returns {boolean}
 */
function isDataTable(table, opts = {}) {
  const adapter = makeAdapter(table, opts);
  const rows = adapter.getRows();
  if (rows.length < 2) return false;
  if (!rows.some((row) => row.getCells().length >= 2)) return false;
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
 * opts.originalText, when the caller supplies it, reads a cell's text from
 * the originals and returns undefined for a cell with none. A fingerprint
 * read through it stays the same while the extension simplifies the table's
 * header cells, so the extension's writes do not read as a page change.
 *
 * The return holds plain values only, so a registry entry holding one stays
 * serializable.
 *
 * @returns {{columnCount: number, headerTexts: string[]|null}}
 */
function readTableFingerprint(el, opts = {}) {
  const rows = makeAdapter(el, opts).getRows();
  const columnCount = rows.reduce((widest, row) => Math.max(widest, row.getCells().length), 0);
  const headerTexts = rows.length > 0 && _hasHeaderRow(rows[0])
    ? rows[0].getCells().map((cellObj) => _fingerprintCellText(cellObj, opts))
    : null;
  return { columnCount, headerTexts };
}

/**
 * Whether the first row the adapter returns is a header row.
 * @returns {boolean}
 */
function _hasHeaderRow(firstRow) {
  if (firstRow.isOutside === true) return true;
  // readTableFingerprint's comment holds the reason for this test.
  if (firstRow.isGrouped !== true) return false;
  const cells = firstRow.getCells();
  return cells.length > 0 && cells.every((cellObj) => cellObj.isHeaderCell);
}

/**
 * One header cell's text for the fingerprint: its text from the originals
 * where opts.originalText holds one, the cell's current text otherwise.
 *
 * @returns {string}
 */
function _fingerprintCellText(cellObj, opts) {
  if (typeof opts.originalText === 'function') {
    const stored = opts.originalText(cellObj.el);
    if (stored !== undefined) return stored;
  }
  return cellObj.getText();
}

/**
 * Whether two shape fingerprints describe the same shape: the same column
 * count, and the same header texts element by element.
 *
 * A missing fingerprint gives false.
 *
 * @returns {boolean}
 */
function sameTableFingerprint(a, b) {
  if (!a || !b) return false;
  if (a.columnCount !== b.columnCount) return false;
  const left = a.headerTexts;
  const right = b.headerTexts;
  // Two fingerprints with no header texts match on the column count alone.
  // Header texts on one side only mean the table gained or lost its header row.
  if (left === null || right === null) return left === right;
  return left.length === right.length && left.every((text, i) => text === right[i]);
}

/**
 * The three guards of a qualifying element: it is not a native table, it is
 * not an accessibility artifact, and every native table it holds is an
 * accessibility artifact (the scan runs each of the others as a nest of one).
 *
 * @returns {boolean}
 */
function _passesQualifyingGuards(el, isArtifact, opts) {
  if (el.tagName === 'TABLE' || isArtifact(el, opts)) return false;
  return _nativeTablesIn(el).every((t) => isArtifact(t, opts));
}

function _isQualifyingElement(el, isArtifact, opts) {
  return !!el && _carriesGridRole(el) && _passesQualifyingGuards(el, isArtifact, opts);
}

function _qualifyingDescendants(root, isArtifact, opts) {
  return Array.from(root.querySelectorAll?.(GRID_ARIA_SELECTOR) || [])
    .filter((el) => _passesQualifyingGuards(el, isArtifact, opts));
}

/**
 * The count of qualifying ancestors from `el` up to and including `chainRoot`
 * (the chain root sits at depth 0). Returns -1 when the walk leaves the nest
 * or first crosses a cell-role ancestor (`el` then belongs to a nest of its
 * own), so the caller drops the element rather than filing it at a wrong
 * depth.
 *
 * @returns {number}
 */
function _depthInChain(el, chainRoot, isArtifact, opts) {
  if (el === chainRoot) return 0;
  let count = 0;
  const reached = walkUp(parentOf(el), DR_DETECTION_SETTINGS.gridWalkDepthCap,
    (node) => node !== chainRoot && _isCellAncestor(node), (node) => {
      if (node === chainRoot) return true;
      if (_isQualifyingElement(node, isArtifact, opts)) count++;
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
 *   - A depth that does not hold exactly one element falls back outward to
 *     the nearest shallower depth holding exactly one.
 * A chain where no depth from the clamped one outward holds exactly one
 * element returns null, which registers nothing for that nest.
 *
 * @returns {Element|null}
 */
function _selectAtNestingDepth(byDepth, configuredDepth) {
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
 * A caller that already holds `el` as a qualifying element passes
 * `isQualifying` true, which skips the walk to the nearest one.
 *
 * @returns {Element|null}
 */
function chainRootOf(el, opts = {}, isQualifying = false) {
  if (!el) return null;
  const isArtifact = _artifactCheck(opts);
  const docBody = _documentBody(opts);
  const cap = DR_DETECTION_SETTINGS.gridWalkDepthCap;
  const qualifies = (node) => _isQualifyingElement(node, isArtifact, opts);
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
 * outcome. _selectAtNestingDepth applies the configured nesting depth to the
 * nest's containment chain.
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
 *                    reports, so the nest registers nothing: a second
 *                    registration would put a second table pillbox on one
 *                    grid.
 *
 * opts.nestingDepth, when the caller supplies it, replaces
 * DR_DETECTION_SETTINGS.nestingDepth. Zero is a legal depth, so the override
 * test is a nullish check.
 *
 * @returns {{chainRoot: Element, selected: Element|null, outcome: string}}
 */
function nominateNest(chainRoot, opts = {}) {
  const isArtifact = _artifactCheck(opts);
  const isRegistered = _registeredCheck(opts);
  const configuredDepth = opts.nestingDepth ?? DR_DETECTION_SETTINGS.nestingDepth;

  if (isArtifact(chainRoot, opts)) {
    return { chainRoot, selected: null, outcome: 'artifact' };
  }

  // An element nested in a cell is out of a grid's nest (_depthInChain returns
  // -1), so a registered grid inside a cell never makes the grid around it
  // read as registered.
  const nest = chainRoot.tagName === 'TABLE' ? [{ el: chainRoot, depth: 0 }]
    : [chainRoot].filter((el) => _passesQualifyingGuards(el, isArtifact, opts))
      .concat(_qualifyingDescendants(chainRoot, isArtifact, opts))
      .map((el) => ({ el, depth: _depthInChain(el, chainRoot, isArtifact, opts) }))
      .filter((member) => member.depth >= 0);

  if (nest.some(({ el }) => isRegistered(el))) {
    return { chainRoot, selected: null, outcome: 'registered' };
  }

  const byDepth = new Map();
  for (const { el, depth } of nest) {
    if (!isDataTable(el, opts)) continue;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth).push(el);
  }

  const selected = _selectAtNestingDepth(byDepth, configuredDepth);
  if (selected) return { chainRoot, selected, outcome: 'selected' };
  return { chainRoot, selected: null, outcome: byDepth.size === 0 ? 'empty' : 'crowded' };
}

/**
 * The native tables in `root`: `root` itself when it is a table, then every
 * descendant table, in document order.
 *
 * @returns {Element[]}
 */
function _nativeTablesIn(root) {
  const own = root.tagName === 'TABLE' ? [root] : [];
  return typeof root.querySelectorAll === 'function' ? own.concat(Array.from(root.querySelectorAll('table'))) : own;
}

/**
 * The one table scan: run the nomination step over every nest under `root`
 * and report one result per nest, native tables first, then grids, each kind
 * in document order. Both live scanners (the load-time scan and the
 * added-node pass, both in content.js) read it, and the controller turns
 * each outcome into a registration or a pending table.
 *
 * A chain root can sit outside `root` (an added node inside a wrapper already
 * in the page), so a second run over the same nest evaluates the whole nest
 * again. No result checks the registry beyond the step's own 'registered'
 * outcome; the caller does.
 *
 * @returns {{chainRoot: Element, selected: Element|null, outcome: string}[]}
 */
function scanTables(root, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const isArtifact = _artifactCheck(opts);

  const qualifying = (_isQualifyingElement(root, isArtifact, opts) ? [root] : [])
    .concat(_qualifyingDescendants(root, isArtifact, opts));

  // A Set keeps insertion order, so the results stay in the order above.
  const chainRoots = new Set(_nativeTablesIn(root));
  for (const el of qualifying) chainRoots.add(chainRootOf(el, opts, true));

  return Array.from(chainRoots, (chainRoot) => nominateNest(chainRoot, opts));
}
