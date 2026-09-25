// Helpers every piece of the suite may call: fake tables and grids, fake
// clicks, harnesses, and the like. They are function declarations, so the
// joined suite can call each one from any piece, whatever the order list
// says. A new helper goes here; a test section goes in the piece for the
// area it tests.

// A mock cell's one text piece, the way a page element holds its text: a
// text node child whose value reads and writes the cell's text. The placement
// step reads a native cell's text pieces, so a mock cell with no text node
// would hold no piece for a value to sit in.
function withTextPiece(cell) {
  cell.childNodes = [{
    nodeType: 3,
    parentNode: cell,
    parentElement: cell,
    get nodeValue() { return cell.textContent; },
    set nodeValue(v) { cell.textContent = v; cell.innerText = v; },
  }];
  return cell;
}

function makeMockCell(tag, text) {
  return withTextPiece({
    tagName: tag.toUpperCase(),
    innerText: text,
    textContent: text,
    classList: { add: function(cls) { this._classes = this._classes || []; this._classes.push(cls); },
                 contains: function(cls) { return (this._classes||[]).includes(cls); } },
    dataset: {},
    title: '',
    _classes: [],
  });
}

function makeMockTable(rowsSpec, querySelectorResult) {
  // rowsSpec: array of arrays of {tag, text}
  // colSpan and rowSpan stand at 1 on every cell, as they do on a real table
  // cell; a spec entry naming one declares a merge.
  const rows = rowsSpec.map(rowSpec => ({
    cells: rowSpec.map(s => Object.assign(makeMockCell(s.tag, s.text), {
      colSpan: s.colSpan || 1,
      rowSpan: s.rowSpan === undefined ? 1 : s.rowSpan,
    }))
  }));
  return {
    rows,
    querySelector: function() { return querySelectorResult || null; },
    dataset: {},
  };
}

function withCreateTreeWalker(fn) {
  global.document.createTreeWalker = function(cell) {
    let done = false;
    return {
      nextNode: function() {
        if (done) return null;
        done = true;
        // Return a fake text node whose nodeValue matches the cell text.
        return {
          nodeValue: cell.innerText,
          get nodeValue() { return this._val !== undefined ? this._val : cell.innerText; },
          set nodeValue(v) { cell.innerText = v; cell.textContent = v; this._val = v; }
        };
      }
    };
  };
  try { fn(); } finally { delete global.document.createTreeWalker; }
}

// --- Test 3 / 4 helper: row-header table shaped like Wikipedia's
// "List of James Bond films" — every data row opens with <th scope="row">.
//   [<th>Dr. No</th>,     <td>59.5</td>,  <td>1234</td>]
//   [<th>Goldfinger</th>, <td>124.9</td>, <td>5678</td>]
// Columns: A = the <th>, B = the first <td>, C = the second <td>.
function runRowHeaderTable(optsOverrides) {
  let rows;
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'th', text: 'Dr. No'     }, { tag: 'td', text: '59.5'  }, { tag: 'td', text: '1234' }],
      [{ tag: 'th', text: 'Goldfinger' }, { tag: 'td', text: '124.9' }, { tag: 'td', text: '5678' }],
    ]);
    roundTable(table, Object.assign({
      enabled: true, simplifyMixedCells: false, simplifyDates: true, simplifyTimes: true,
      simplifyFirstRow: true, simplifyFirstColumn: false,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    }, optsOverrides));
    rows = table.rows.map(row => row.cells);
  });
  return rows;
}

function isRounded(cell) { return cell.classList.contains('dr-ext-rounded'); }

// Helper: build a mock anchor element that looks enough like a DOM <a> node
// for isCellWholeLink and filterLinkMatches to consume.
function makeMockAnchor(text) {
  const anchor = {
    innerText: text,
    textContent: text,
    _isAnchor: true,
  };
  return anchor;
}

// Helper: build a mock text node that has a parentElement with optional anchor chain.
// If insideAnchor is an anchor object, parentElement.closest('a') returns it and
// cell.contains(anchor) returns true.
function makeMockTextNode(text, insideAnchor, cell) {
  const parentEl = insideAnchor
    ? {
        closest: (sel) => sel === 'a' ? insideAnchor : null,
      }
    : {
        closest: () => null,
      };
  return {
    nodeValue: text,
    parentElement: parentEl,
  };
}

// Build a mock cell for isCellWholeLink / filterLinkMatches testing.
// anchors: array of anchor text strings that appear as <a> children
// outsideText: text in the cell that is NOT inside any anchor (null if none)
// cell.innerText = outsideText + anchor texts combined (as visible text)
// cell.contains(anchor): returns true for any anchor we built
function makeLinkCell(anchors, outsideText) {
  const anchorObjs = anchors.map(t => makeMockAnchor(t));
  const allText = (outsideText ? outsideText + ' ' : '') +
    anchorObjs.map(a => a.innerText).join(' ');
  const trimmed = allText.trim();

  const cell = {
    innerText: trimmed,
    textContent: trimmed,
    // querySelectorAll('a') returns the anchor objects we built
    querySelectorAll: (sel) => sel === 'a' ? anchorObjs : [],
    contains: (node) => anchorObjs.includes(node),
    // classList / dataset stubs so makeMockTable-level code won't crash
    classList: {
      _classes: [],
      add(cls) { this._classes.push(cls); },
      contains(cls) { return this._classes.includes(cls); },
    },
    dataset: {},
    title: '',
    tagName: 'TD',
  };

  // Build text nodes list for filterLinkMatches's createTreeWalker.
  // We model the DOM structure: anchor text is inside anchor nodes, outside text is bare.
  const textNodes = [];
  if (outsideText) {
    textNodes.push(makeMockTextNode(outsideText, null, cell));
  }
  for (const a of anchorObjs) {
    textNodes.push(makeMockTextNode(a.innerText, a, cell));
  }

  // Attach a createTreeWalker stub that returns these text nodes in order.
  cell._textNodes = textNodes;
  return cell;
}

// Override createTreeWalker to handle linkCell's _textNodes when present.
function withLinkCreateTreeWalker(fn) {
  global.document.createTreeWalker = function(cell) {
    // If the cell has pre-built textNodes (link cell), use those.
    const nodes = cell._textNodes ? [...cell._textNodes] : [];
    // Fallback for plain cells: single text node from innerText.
    if (nodes.length === 0 && cell.innerText) {
      nodes.push({ nodeValue: cell.innerText, parentElement: { closest: () => null } });
    }
    return {
      nextNode() {
        return nodes.shift() || null;
      }
    };
  };
  try { fn(); } finally { delete global.document.createTreeWalker; }
}

/**
 * Build a minimal table DOM stub that isTableRounded, restoreTable, and
 * roundTable can consume. Returns an object that looks like a real HTMLTableElement
 * for the purposes of these functions.
 *
 * @param {Array<{tag:string, text:string}>} cellSpecs  — cells for a single row
 * @param {Object} [extra] — additional properties to merge onto the table stub
 */
function makeToggleTableCell(s) {
  return {
    tagName: s.tag.toUpperCase(),
    innerText: s.text,
    textContent: s.text,
    innerHTML: s.text,
    classList: {
      _c: [],
      add(c) { this._c.push(c); },
      remove(c) { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
    dataset: {},
    title: '',
    querySelectorAll: () => [],
    removeAttribute() {},
  };
}

/**
 * Build a minimal table DOM stub.
 *
 * @param {Array<{tag:string, text:string}>|Array<Array<{tag:string, text:string}>>} rowsOrCells
 *   Either a flat array of cell specs (one row) or an array of row arrays.
 * @param {Object} [extra] — additional properties to merge onto the table stub
 */
function makeToggleTable(rowsOrCells, extra) {
  // Detect whether caller passed flat [{tag,text}] or nested [[{tag,text}]].
  const rowSpecs = Array.isArray(rowsOrCells[0]) ? rowsOrCells : [rowsOrCells];
  const rows = rowSpecs.map(rowSpec => ({ cells: rowSpec.map(makeToggleTableCell) }));
  const cells = rows.flatMap(r => r.cells);  // all cells, for querySelector helpers

  const table = Object.assign({
    tagName: 'TABLE',
    rows,
    dataset: {},
    _cells: cells,
    // classList on the table itself — used by flashTargetedTable
    classList: {
      _c: [],
      add(c)      { this._c.push(c); },
      remove(c)   { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
    // offsetWidth access in flashTargetedTable triggers reflow; just ignore it
    get offsetWidth() { return 0; },
    // querySelector('.dr-ext-rounded') — used by applySidebarRounding's menu-label check
    querySelector(sel) {
      if (sel === '.dr-ext-rounded') {
        return this._cells.find(c => c.classList.contains('dr-ext-rounded')) || null;
      }
      return null;
    },
    // querySelectorAll('.dr-ext-rounded') — used by restoreTable / resetTable
    querySelectorAll(sel) {
      if (sel === '.dr-ext-rounded') {
        return this._cells.filter(c => c.classList.contains('dr-ext-rounded'));
      }
      return [];
    },
    getBoundingClientRect() {
      return { top: 100, right: 500, bottom: 200, left: 100 };
    },
  }, extra || {});

  return table;
}

/**
 * Inject a fake entry into the module-level tableToggles WeakMap so that
 * syncSwitchForTable can find the button for this table.
 *
 * Returns a minimal button stub that supports setAttribute/getAttribute/classList
 * and addEventListener, matching the new dr-ext-morph button shape.
 *
 * @param {object} table — the table stub
 * @returns {object} the mock button element
 */
function injectToggleEntry(table) {
  const button = makeMockButton();
  tableToggles.set(table, button);
  return button;
}

/**
 * Build a minimal button stub that supports the interface used by
 * syncSwitchForTable, createToggleForTable, and test event dispatch.
 */
function makeMockButton() {
  const attrs = {};
  const classList = {
    _c: [],
    add(c)      { if (!this._c.includes(c)) this._c.push(c); },
    remove(c)   { this._c = this._c.filter(x => x !== c); },
    contains(c) { return this._c.includes(c); },
    toggle(c, force) {
      if (force === undefined) force = !this.contains(c);
      if (force) this.add(c); else this.remove(c);
      return force;
    },
  };
  const listeners = {};
  const button = {
    _tag: 'button',
    type: 'button',
    className: 'dr-ext-morph',
    style: {},
    _children: [],
    dataset: {},
    classList,
    setAttribute(name, value) { attrs[name] = value; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
    removeAttribute(name) { delete attrs[name]; },
    addEventListener(evt, fn) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    _listeners: listeners,
    appendChild(child) {
      this._children.push(child);
      child.parentElement = this;
      return child;
    },
    contains(node) { return false; },
    click() {
      const handlers = listeners['click'] || [];
      handlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
    },
    dispatchEvent(evt) {
      const handlers = listeners[evt.type] || [];
      handlers.forEach(fn => fn(evt));
    },
    parentElement: null,
    textContent: '',
    _clickCount: 0,
  };
  return button;
}

// ---------------------------------------------------------------------------
// Sprint layout-table-exclusion: isDataTable heuristic
// ---------------------------------------------------------------------------
//
// isDataTable(table) returns true iff:
//   - table.rows.length >= 2
//   - at least one row has cells.length >= 2
//   - at least one cell has numeric textContent (CLEAN_REGEX stripped + parseFloat + isFinite)
//
// Helper: build a minimal table stub for isDataTable.
// rowsSpec: array of arrays of textContent strings.
function makeIsDataTable(rowsSpec) {
  return {
    rows: rowsSpec.map(rowTexts => ({
      cells: rowTexts.map(text => ({ textContent: text }))
    }))
  };
}

// A reactive multi-segment cell mock: unlike makeSuperscriptCell (used by the
// static AC tests above), writing a text node's nodeValue here also updates
// cell.innerText/textContent/innerHTML, so getText() sees the post-round
// shortened text the way a real DOM element would.
function makeReactiveCell(segments) {
  const cell = {
    tagName: 'TD',
    dataset: {},
    title: '',
    classList: {
      _c: [],
      add(x) { this._c.push(x); },
      contains(x) { return this._c.includes(x); },
      remove(x) { this._c = this._c.filter((y) => y !== x); },
    },
    querySelectorAll: (sel) => (sel === 'a' && cell._anchor ? [cell._anchor] : []),
    querySelector: (sel) => (sel === 'sup' && segments.some((s) => s.inSup) ? { tagName: 'SUP' } : null),
    removeAttribute() {},
    contains(el) { return el === cell._anchor; },
  };
  const refresh = () => {
    const joined = segments.map((s) => s.text).join('');
    cell.innerText = joined;
    cell.textContent = joined;
    cell.innerHTML = joined;
  };
  cell._textNodes = segments.map((seg) => {
    let parent;
    if (seg.inSup) {
      parent = { tagName: 'SUP', parentNode: cell, parentElement: cell };
    } else if (seg.inAnchor) {
      const anchorEl = cell._anchor || (cell._anchor = { tagName: 'A', closest: (sel) => (sel === 'a' ? cell._anchor : null) });
      parent = anchorEl;
    } else {
      parent = { closest: () => null, tagName: 'TD' };
    }
    return {
      get nodeValue() { return seg.text; },
      set nodeValue(v) { seg.text = v; refresh(); },
      parentNode: parent,
      parentElement: parent,
    };
  });
  refresh();
  return cell;
}

function withReactiveCreateTreeWalker(fn) {
  const saved = global.document.createTreeWalker;
  global.document.createTreeWalker = function (cell) {
    const nodes = cell._textNodes ? [...cell._textNodes] : [];
    return { nextNode() { return nodes.shift() || null; } };
  };
  try {
    fn();
  } finally {
    if (saved === undefined) delete global.document.createTreeWalker;
    else global.document.createTreeWalker = saved;
  }
}

// Issue #403, test page Table 21. A cell whose markup carries line breaks
// and indentation around its text: the browser collapses them in the
// rendered text the classifier reads, and the patch step counts positions in
// the flat text, where they remain. The rendered read below collapses the
// flat text the way the browser does.
function makePrettyPrintedCell(segments) {
  const cell = makeReactiveCell(segments);
  Object.defineProperty(cell, 'innerText', {
    get() { return segments.map((s) => s.text).join('').replace(/\s+/g, ' ').trim(); },
    set() {},
  });
  return cell;
}

// Issue #430: a native table's pure, date, and time cells take the same
// three steps as every other cell — classify, place, patch. A value whose
// characters sit in one text piece rounds through the patch writer, with its
// rendered position converted to the flat text. A value that crosses a piece
// boundary stays unchanged with a debug row: the native placement step runs
// no stacked-cell test, and no writer spreads characters across pieces.
function nativeOnePieceOpts() {
  return Object.assign({}, DR_DEFAULTS, {
    enabled: true, simplifyFirstRow: true, simplifyFirstColumn: true,
    offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
  });
}

// A hidden sort key ahead of the value: the rendered text leaves it out and
// the flat text holds it, so the two differ in more than whitespace. The
// value sits in the one piece that holds it, and the sort key keeps its text.
function makeSortKeyCell(segments, rendered) {
  const cell = makeReactiveCell(segments);
  Object.defineProperty(cell, 'innerText', { get() { return rendered(); }, set() {} });
  return cell;
}

function createToggleWithSpies(table) {
  const appendedToBody = [];
  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;

  global.document.createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const el = {
      _tag: tag, type: '', className: '', style: {}, _children: [], _listeners: listeners,
      dataset: {}, parentElement: null, textContent: '',
      classList: (() => {
        const c = [];
        return {
          _c: c, add(x){if(!c.includes(x))c.push(x);}, remove(x){const i=c.indexOf(x);if(i>=0)c.splice(i,1);},
          contains(x){return c.includes(x);},
          toggle(x,f){const has=c.includes(x);const want=f===undefined?!has:f;if(want&&!has)c.push(x);else if(!want&&has)c.splice(c.indexOf(x),1);return want;},
        };
      })(),
      appendChild(ch){this._children.push(ch);ch.parentElement=this;return ch;},
      addEventListener(evt,fn){if(!listeners[evt])listeners[evt]=[];listeners[evt].push(fn);},
      setAttribute(n,v){attrs[n]=v;},
      getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
      removeAttribute(n){delete attrs[n];},
      contains(){return false;},
      dispatchEvent(evt){(listeners[evt.type]||[]).forEach(fn=>fn(evt));},
    };
    return el;
  };

  global.document.body = {
    appendChild(child) { appendedToBody.push(child); child.parentElement = global.document.body; }
  };
  global.document.documentElement = { appendChild() {} };
  toggleStyleInjected = false;

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  createToggleForTable(table);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');
  return buttonEl;
}

// Simulate a touch second-tap (two pointerdown+click sequences) on buttonEl.
function fireTouchSecondTap(buttonEl) {
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // First tap: expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  // Second tap: toggle
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  withCreateTreeWalker(function() {
    clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
  });

  global.setTimeout = origSetTimeout;
  global.clearTimeout = origClearTimeout;
}

function makeSuperscriptCell(segments) {
  const hasSup = segments.some(s => s.inSup);
  const fullText = segments.map(s => s.text).join('');

  const cell = {
    innerText: fullText,
    textContent: fullText,
    innerHTML: fullText,   // good-enough stub; the native record stores it
    classList: {
      _classes: [],
      add(cls) { this._classes.push(cls); },
      contains(cls) { return this._classes.includes(cls); },
    },
    dataset: {},
    title: '',
    tagName: 'TD',
    // querySelectorAll('a') → no anchors so filterLinkMatches is a no-op
    querySelectorAll: (sel) => sel === 'a' ? [] : [],
    // querySelector('sup') → truthy iff any segment is inside <sup>
    querySelector: (sel) => sel === 'sup' && hasSup ? { tagName: 'SUP' } : null,
  };

  // Build mock text nodes in document order.
  // Each node has parentNode whose ancestor chain reaches 'cell'.
  // For inSup nodes: parentNode is a fake <sup> element whose parentNode is cell.
  // For plain nodes: parentNode is cell itself (so the while-loop terminates).
  const textNodes = segments.map(seg => {
    let parentNode;
    if (seg.inSup) {
      // A fake <sup> element: tagName matches SUPERSCRIPT_TAG ('SUP'), parent is cell
      const supEl = { tagName: 'SUP', parentNode: cell, parentElement: cell };
      parentNode = supEl;
    } else {
      // Direct child of the cell — the ancestor walk hits cell immediately and stops
      parentNode = cell;
    }
    return {
      nodeValue: seg.text,
      parentNode,
      parentElement: parentNode,
    };
  });

  cell._textNodes = textNodes;
  return cell;
}

// Override createTreeWalker to dispatch on _textNodes when present (same
// contract as withLinkCreateTreeWalker but aware of superscript nodes).
function withSupCreateTreeWalker(fn) {
  global.document.createTreeWalker = function(cell) {
    const nodes = cell._textNodes ? [...cell._textNodes] : [];
    if (nodes.length === 0 && cell.innerText) {
      // Fallback: single text node, parent is cell (no <sup> ancestor)
      nodes.push({ nodeValue: cell.innerText, parentNode: cell, parentElement: cell });
    }
    return {
      nextNode() { return nodes.shift() || null; }
    };
  };
  try { fn(); } finally { delete global.document.createTreeWalker; }
}

// Helper: build a multi-node cell for applyExtractedPatches tests.
// segments: [{text, inSup?, inAnchor?}]
// Returns a cell mock whose _textNodes drive withSupCreateTreeWalker.
function makeExtractedCell(segments) {
  const fullText = segments.map(s => s.text).join('');
  const cell = {
    innerText: fullText,
    textContent: fullText,
    innerHTML: fullText,
    classList: {
      _classes: [],
      add(cls) { this._classes.push(cls); },
      contains(cls) { return this._classes.includes(cls); },
    },
    dataset: {},
    title: '',
    tagName: 'TD',
    querySelectorAll: (sel) => sel === 'a' ? [] : [],
    querySelector: (sel) => sel === 'sup' && segments.some(s => s.inSup) ? { tagName: 'SUP' } : null,
  };
  const textNodes = segments.map(seg => {
    let parentNode;
    if (seg.inSup) {
      parentNode = { tagName: 'SUP', parentNode: cell, parentElement: cell };
    } else {
      parentNode = cell;
    }
    return { nodeValue: seg.text, parentNode, parentElement: parentNode };
  });
  cell._textNodes = textNodes;
  return cell;
}

/**
 * Build a minimal mock cell element.
 * @param {string} text   — textContent of the cell
 * @param {number} [width=100] — offsetWidth of the cell (for column-0 width probe)
 */
function makeGridCell(text, width) {
  return {
    textContent: text,
    offsetWidth: (width === undefined ? 100 : width),
    children: [],
    nodeType: 1,
  };
}

/**
 * Build a minimal mock row element.
 * @param {Array<{text:string, width?:number}>} cellSpecs
 * @param {string} [className='row']  — className of the row
 * @param {number} [height=20]        — offsetHeight (not tested by looksLikeGrid; present only to prove it is ignored)
 */
function makeGridRow(cellSpecs, className, height) {
  const cls = (className === undefined ? 'row' : className);
  const cells = cellSpecs.map(s => makeGridCell(s.text, s.width));
  return {
    className: cls,
    children: cells,
    // children.length is accessed directly; Array.from is NOT called on row.children
    // so a plain array works fine.
    nodeType: 1,
    offsetHeight: (height === undefined ? 20 : height),
  };
}

/**
 * Build a minimal mock container element that can be passed to looksLikeGrid.
 *
 * @param {Array} rows       — array of row mocks (from makeGridRow)
 * @param {string} [display='flex']
 * @param {string} [role=null]
 * @param {string} [className='']
 */
function makeGridContainer(rows, display, role, className) {
  const disp = (display === undefined ? 'flex' : display);
  const cls  = (className === undefined ? '' : className);
  const container = {
    children: rows,
    tagName: 'DIV',
    className: cls,
    getAttribute: function(attr) {
      if (attr === 'role') return role || null;
      return null;
    },
    classList: {
      _c: [],
      add(c)      { this._c.push(c); },
      remove(c)   { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
    nodeType: 1,
    // parentElement / parentNode used by findTargetTable walk-up, not looksLikeGrid
    parentElement: null,
    parentNode: null,
  };
  // Install a per-element getComputedStyle stub so we can control display per element.
  // looksLikeGrid calls getComputedStyle(el) where el is the container.
  // We install it on the global window stub contextually within the test via a
  // wrapper — see withGridComputedStyle helper below.
  container._display = disp;
  return container;
}

/**
 * Temporarily override the global getComputedStyle (bare, not window.getComputedStyle)
 * to return a given display value for a specific element, then restore it after fn().
 *
 * looksLikeGrid calls bare `getComputedStyle(el)` — in the Node eval environment
 * this resolves to `globalThis.getComputedStyle`, so we must patch that, not
 * `window.getComputedStyle`.
 *
 * If the queried element is `targetEl`, returns {display: displayVal}.
 * Otherwise returns {display:'block', visibility:'visible'}.
 */
function withGridComputedStyle(targetEl, displayVal, fn) {
  const origGlobal = global.getComputedStyle;
  global.getComputedStyle = function(el) {
    if (el === targetEl) return { display: displayVal };
    return { display: 'block', visibility: 'visible' };
  };
  try { fn(); } finally { global.getComputedStyle = origGlobal; }
}

/**
 * Build a mock element suitable for the findTargetTable walk-up.
 * Provides: closest(), parentElement, classList, nodeType.
 */
function makeWalkEl(opts) {
  // opts: { passesLooksLikeGrid, display, className, role, rows }
  const disp = opts.display || 'flex';
  const rows = opts.rows || (function() {
    // Default: a grid with 5 rows, numeric content, uniform col-0 widths
    return [
      makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
      makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
      makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
      makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
      makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
    ];
  }());
  const el = {
    tagName: 'DIV',
    className: opts.className || '',
    getAttribute: function(attr) { return attr === 'role' ? (opts.role || null) : null; },
    classList: {
      _c: (opts.initialClasses || []).slice(),
      add(c)      { if (!this._c.includes(c)) this._c.push(c); },
      remove(c)   { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
    children: rows,
    nodeType: 1,
    parentElement: null,
    parentNode: null,
    // getBoundingClientRect — needed by positionToggle when createToggleForTable
    // fires its deferred setTimeout; return a zero-area rect so the toggle hides.
    getBoundingClientRect: function() { return { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }; },
    // closest() stub: only handles 'table' and '.dr-ext-grid'
    closest: function(sel) {
      if (sel === 'table') return null;  // not a <table> ancestor
      if (sel === '.dr-ext-grid') {
        // Walk up to see if any ancestor has dr-ext-grid
        let p = this.parentElement || this.parentNode;
        while (p && p !== document.body) {
          if (p.classList && p.classList.contains('dr-ext-grid')) return p;
          p = p.parentElement || p.parentNode;
        }
        return null;
      }
      return null;
    },
    _display: disp,
  };
  return el;
}

/**
 * Run findTargetTable with a controlled getComputedStyle that returns the
 * stored _display for each element in the `elements` array, and a patched
 * document.createElement / document.body so createToggleForTable doesn't throw.
 */
function withFindTargetEnv(elements, fn) {
  const origGetCS = global.window.getComputedStyle;
  const origGetCSGlobal = global.getComputedStyle;
  const origDocument = global.document;

  // Patch the bare getComputedStyle global (used by looksLikeGrid) to use each
  // element's _display property. Also patch window.getComputedStyle (used by
  // positionToggle) as a courtesy, though it is not exercised in walk-up tests.
  global.getComputedStyle = function(el) {
    if (el && el._display !== undefined) return { display: el._display };
    return { display: 'block', visibility: 'visible' };
  };
  global.window.getComputedStyle = global.getComputedStyle;

  // Patch document to support createElement (needed by createToggleForTable)
  const mockButtonEl = {
    type: '',
    className: '',
    style: {},
    dataset: {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    addEventListener: () => {},
    classList: { _c: [], add(c){ this._c.push(c); }, remove(c){ this._c=this._c.filter(x=>x!==c); }, contains(c){ return this._c.includes(c); } },
    appendChild: () => {},
    parentElement: null,
  };
  const mockSpanEl = { className: '', appendChild: () => {} };
  global.document = Object.assign({}, origDocument, {
    createElement: (tag) => {
      if (tag === 'button') return Object.assign({}, mockButtonEl, { style: {}, dataset: {}, classList: { _c: [], add(c){ this._c.push(c); }, remove(c){ this._c=this._c.filter(x=>x!==c); }, contains(c){ return this._c.includes(c); } } });
      return Object.assign({}, mockSpanEl);
    },
    body: {
      appendChild: () => {},
      observe: () => {},
      // Allow comparison: findTargetTable checks `current !== document.body`
    },
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    head: null,
    documentElement: { appendChild: () => {} },
  });

  try { fn(); } finally {
    global.window.getComputedStyle = origGetCS;
    global.getComputedStyle = origGetCSGlobal;
    global.document = origDocument;
  }
}

// A role-bearing element whose own class carries no vendor token, so the
// geometry probe's vendor short-circuit stays out of these cases.
function makeRoleBearingNest(rows) {
  return makeDgNode('DIV', 'plain-role-grid', 'grid', rows);
}

// A counting stand-in for the layout reads. Only the geometry probe reads
// layout during a right-click resolution, so a resolution that leaves this
// count at zero came from an earlier step. The returned values keep the
// geometry probe working when a case does reach it.
function makeCountingStyleProbe() {
  const probe = {
    calls: 0,
    getComputedStyle(el) {
      probe.calls++;
      return { display: 'flex', visibility: 'visible', position: 'static', left: '', verticalAlign: '' };
    },
    getOffsetWidth(el) {
      probe.calls++;
      return (el && typeof el.offsetWidth === 'number') ? el.offsetWidth : -1;
    },
  };
  return probe;
}

// A counting stand-in for the data test's numeric probe. It parses the way
// the detection layer's default probe does and records every read, so a
// test can state how many cells one resolution read.
function makeCountingNumericProbe() {
  const probe = {
    calls: 0,
    parse(text) {
      probe.calls++;
      const cleaned = String(text).trim().replace(/[$€£¥,\s%]/g, '');
      if (cleaned === '') return null;
      const parsed = parseFloat(cleaned);
      return isFinite(parsed) ? parsed : null;
    },
  };
  return probe;
}

// Helper: build a minimal native-table stub that NativeTableAdapter can wrap.
// el.rows is an array of row objects with .cells arrays of cell objects.
// Each cell has .innerText, .textContent, .tagName, .classList, .dataset,
// .innerHTML, .querySelector (for compatibility with roundTable internals).
function makeNativeTableEl(rowsSpec) {
  // rowsSpec: array of arrays of { tag, text }
  const el = {
    tagName: 'TABLE',
    rows: rowsSpec.map(rowSpec => ({
      cells: rowSpec.map(s => ({
        tagName: (s.tag || 'td').toUpperCase(),
        innerText: s.text,
        textContent: s.text,
        innerHTML: s.text,
        classList: {
          _c: [],
          add(c) { if (!this._c.includes(c)) this._c.push(c); },
          remove(c) { this._c = this._c.filter(x => x !== c); },
          contains(c) { return this._c.includes(c); },
        },
        dataset: {},
        title: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      }))
    })),
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

/**
 * Create a plain-object Text node (nodeType 3) with a live nodeValue.
 * Designed so findCellTextNode will recognise and return it.
 */
function makeTextNode(value) {
  return {
    nodeType: 3,
    nodeValue: value,
    childNodes: null,   // text nodes have no children; visit() guards on childNodes
  };
}

/**
 * Create a plain-object Element node (nodeType 1) that can contain childNodes.
 * @param {string} [className='']
 * @param {Array}  [childNodes=[]]
 */
function makeElementNode(className, childNodes) {
  const cls = className || '';
  const kids = childNodes || [];
  return {
    nodeType: 1,
    className: cls,
    childNodes: kids,
    children: kids.filter(n => n.nodeType === 1),
    dataset: {},
    // Real DOM elements expose removeAttribute; restoreTable calls it on
    // every restored cell (to drop the rounding tooltip). No-op in the stub.
    removeAttribute() {},
    classList: (() => {
      const c = [];
      return {
        _c: c,
        add(x)      { if (!c.includes(x)) c.push(x); },
        remove(x)   { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
        contains(x) { return c.includes(x); },
      };
    })(),
  };
}

/**
 * Create a div-grid cell element that wraps a single Text node.
 * The text node is accessible via cell.childNodes[0].
 * @param {string} text  — the cell's text content
 */
function makeGridCellWithTextNode(text) {
  const tn = makeTextNode(text);
  const cell = makeElementNode('', [tn]);
  return cell;
}

/**
 * Create a div-grid cell that wraps a nested span > text node (deeper nesting).
 * Tests that findCellTextNode descends past intermediate elements.
 */
function makeGridCellDeepTextNode(text) {
  const tn = makeTextNode(text);
  const span = makeElementNode('inner', [tn]);
  const cell = makeElementNode('', [span]);
  return cell;
}

/**
 * Build a complete div-based grid suitable for GridAdapter consumption.
 *
 * Returns { wrapperEl, rowEls, cellEls } so tests can inspect individual rows/cells.
 *
 * @param {Array<Array<string>>} rowData  — 2D array of cell text values
 * @param {{className?: string, useDataRow?: boolean, useDgClasses?: boolean}} [opts]
 */
function makeGridWrapper(rowData, opts) {
  const options = opts || {};
  const useDataRow = options.useDataRow !== false;   // default true
  const useDgClasses = !!options.useDgClasses;

  const rowEls = [];
  const allCellEls = [];

  rowData.forEach(function(cellTexts, rowIndex) {
    const cellEls = cellTexts.map(function(text) {
      const cell = makeGridCellWithTextNode(text);
      if (useDgClasses) {
        cell.classList.add('dg--cell');
        // querySelectorAll('.dg--cell') on a row element must return child cells
        // — we attach it on the row below after building it.
      }
      allCellEls.push(cell);
      return cell;
    });

    const row = makeElementNode(useDgClasses ? 'dg--virtual-row' : 'row', cellEls);
    if (useDataRow) {
      row.dataset = { row: String(rowIndex) };
    } else {
      row.dataset = {};
    }
    row.children = cellEls;

    // querySelectorAll stubs on the row element (used by GridAdapter._getCellEls)
    row.querySelectorAll = function(sel) {
      if (useDgClasses && sel === '.dg--cell') return cellEls;
      if (sel === '[role="cell"]') return [];
      return [];
    };

    rowEls.push(row);
  });

  // The wrapper element acts as both the grid root and the scroll container
  // (single-pane: no known library selectors → _getScrollContainer returns this.el)
  const wrapper = makeElementNode(options.className || 'grid-wrapper', rowEls);
  wrapper.tagName = 'DIV';
  wrapper.children = rowEls;

  // querySelectorAll stubs on the wrapper (used by GridAdapter._getScrollContainer
  // and _getRowEls / _getPinnedPane)
  wrapper.querySelector = function(sel) { return null; };   // no sub-containers
  wrapper.querySelectorAll = function(sel) {
    if (useDgClasses && sel === '.dg--virtual-row') return rowEls;
    if (sel === '[role="row"]') return [];
    // For _getPinnedPane selectors — return nothing (single-pane grid)
    return [];
  };
  wrapper.matches = function() { return false; };
  wrapper.dataset = {};

  return { wrapperEl: wrapper, rowEls: rowEls, cellEls: allCellEls };
}

// Match one node against the selector forms this file's fixtures are queried
// with: a comma-separated list whose parts are an attribute selector on role,
// a single class, or a tag name.
function dgNodeMatches(node, selector) {
  return String(selector).split(',').map((part) => part.trim()).filter(Boolean).some((part) => {
    const roleMatch = /^\[role="([^"]+)"\]$/.exec(part);
    if (roleMatch) return node.getAttribute('role') === roleMatch[1];
    if (part.charAt(0) === '.') return node.classList.contains(part.slice(1));
    return String(node.tagName).toUpperCase() === part.toUpperCase();
  });
}

// Every element descendant of `node`, in document order, that matches.
function dgDescendantsMatching(node, selector) {
  const found = [];
  (function visit(current) {
    for (const child of current.children) {
      if (dgNodeMatches(child, selector)) found.push(child);
      visit(child);
    }
  })(node);
  return found;
}

// One element node of the fixture. `childNodes` holds text nodes for a cell
// and element nodes everywhere else; `children` is the element half, which is
// what the adapters walk when a selector finds nothing.
function makeDgNode(tagName, className, role, childNodes) {
  const classes = new Set(String(className || '').split(/\s+/).filter(Boolean));
  const kids = childNodes || [];
  const node = {
    nodeType: 1,
    tagName: tagName,
    childNodes: kids,
    children: kids.filter((child) => child.nodeType === 1),
    dataset: {},
    parentElement: null,
    parentNode: null,
    style: {},
    textContent: '',
    innerText: '',
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    getAttribute(name) { return name === 'role' ? (role || null) : null; },
    removeAttribute() {},
    matches(selector) { return dgNodeMatches(node, selector); },
    querySelector(selector) { return dgDescendantsMatching(node, selector)[0] || null; },
    querySelectorAll(selector) { return dgDescendantsMatching(node, selector); },
    getBoundingClientRect() { return { top: 20, right: 420, bottom: 260, left: 20, width: 400, height: 240 }; },
  };
  Object.defineProperty(node, 'className', {
    get() { return Array.from(classes).join(' '); },
    configurable: true,
  });
  for (const child of node.children) {
    child.parentElement = node;
  }
  return node;
}

// One dg--cell wrapping a single text node, the shape the grid write path
// patches in place.
function makeDgCell(text) {
  const cell = makeDgNode('DIV', 'dg--cell', null, [makeTextNode(text)]);
  cell.textContent = text;
  cell.innerText = text;
  return cell;
}

function makeDgRow(rowIndex, cellTexts) {
  const row = makeDgNode('DIV', 'dg--virtual-row', null, cellTexts.map(makeDgCell));
  row.dataset = { row: String(rowIndex) };
  return row;
}

/**
 * Build the synthetic database-query-shaped grid.
 *
 * Three parameters cover the cases the nesting rule turns on:
 *   - pinnedColumns: cells in each pinned row. One column fails the data test,
 *     so the pinned pane drops out of the containment chain and depth 1 holds
 *     the scrolling pane alone. Two columns pass it, which puts two elements
 *     at depth 1.
 *   - rows: row pairs across the two panes. Zero builds an empty wrapper, the
 *     shape a later sprint retests once its rows arrive.
 *   - plainWrapper: puts one role-less div between the wrapper and the two
 *     panes. A nesting depth counts qualifying elements, so the extra layer
 *     leaves both panes at depth 1. `paneParentEl` in the result is that div,
 *     and null when the flag is false.
 *
 * @param {{pinnedColumns?: number, rows?: number, plainWrapper?: boolean}} [opts]
 * @returns {{wrapperEl: object, paneParentEl: object|null, pinnedPaneEl: object,
 *            scrollPaneEl: object, pinnedRowEls: object[], scrollRowEls: object[]}}
 */
function makeDatabaseQueryGrid(opts) {
  const options = opts || {};
  const pinnedColumns = options.pinnedColumns === undefined ? 1 : options.pinnedColumns;
  const rowCount = options.rows === undefined ? 6 : options.rows;
  const plainWrapper = !!options.plainWrapper;

  // Invented values. The identifier column names a measure; the two numeric
  // columns hold a count and a rate, one order of magnitude apart so a
  // set-aware pass has something to separate.
  const measures = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
  const counts = ['7,318,204', '551,077', '2,140,663', '73,915', '10,428', '3,906'];
  const rates = ['284.51', '31.77', '58.02', '7.44', '2.19', '0.63'];
  // The pinned pane's leading column is the row-number gutter; a second
  // pinned column holds a short label so the pane passes the data test only
  // when the caller sets two pinned columns.
  const gutterLabels = ['north', 'south', 'east', 'west', 'inland', 'coastal'];

  const pinnedRowEls = [];
  const scrollRowEls = [];
  for (let i = 0; i < rowCount; i++) {
    const pinnedTexts = [String(i + 1)];
    for (let c = 1; c < pinnedColumns; c++) pinnedTexts.push(gutterLabels[i % gutterLabels.length]);
    pinnedRowEls.push(makeDgRow(i, pinnedTexts));
    scrollRowEls.push(makeDgRow(i, [
      measures[i % measures.length],
      counts[i % counts.length],
      rates[i % rates.length],
    ]));
  }

  const pinnedPaneEl = makeDgNode('DIV', 'dg--grid-container dg--pinned-grid', 'grid', pinnedRowEls);
  const scrollPaneEl = makeDgNode('DIV', 'dg--grid-container dg--grid-scroll-container', 'grid', scrollRowEls);
  // makeDgNode links each element child back to its parent, so building the
  // plain layer first and the wrapper around it wires both directions.
  const paneParentEl = plainWrapper
    ? makeDgNode('DIV', 'dg--pane-row', null, [pinnedPaneEl, scrollPaneEl])
    : null;
  const wrapperEl = makeDgNode('DIV', 'dg--table-wrapper', 'table',
    paneParentEl ? [paneParentEl] : [pinnedPaneEl, scrollPaneEl]);

  return { wrapperEl, paneParentEl, pinnedPaneEl, scrollPaneEl, pinnedRowEls, scrollRowEls };
}

// A text piece that counts the writes to it.
function makeCountingTextNode(value) {
  let current = value;
  return {
    nodeType: 3,
    childNodes: null,
    writes: 0,
    get nodeValue() { return current; },
    set nodeValue(v) { this.writes++; current = v; },
  };
}

function setGridCellPieces(cell, childNodes) {
  cell.childNodes = childNodes;
  cell.children = childNodes.filter((node) => node.nodeType === 1);
}

// The cell's text pieces in page order, walked by hand.
function gridCellTextPieces(cell) {
  const found = [];
  (function visit(node) {
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) found.push(child);
      else visit(child);
    }
  })(cell);
  return found;
}

// Four cells, each a different piece layout:
//   a: whitespace pieces around a number in its own element
//   b: one piece with whitespace inside it
//   c: "$" in its own piece, the number in the next
//   d: one plain piece
function makePatchGrid() {
  const grid = makeE2EGridWrapper([
    ['8,584,629', '7,318,204'],
    ['2,140,663', '1,234,567'],
  ]);
  const [a, b, c] = grid.cellEls;
  const aNumber = makeCountingTextNode('8,584,629');
  setGridCellPieces(a, [makeTextNode(' '), makeElementNode('inner', [aNumber]), makeTextNode(' ')]);
  setGridCellPieces(b, [makeTextNode(' 7,318,204 ')]);
  setGridCellPieces(c, [makeElementNode('sym', [makeTextNode('$')]), makeElementNode('num', [makeTextNode('2,140,663')])]);
  return { grid, aNumber };
}

function makeKeyStatsGrid() {
  const grid = makeE2EGridWrapper([
    ['$338.49', '4.91tn'],
    ['125 126', '$337.91'],
    ['41.31m', '4.91tn'],
    ['Revenue 500 units', 'DT1234'],
    ['7.5m', '2024-03-15'],
  ]);
  const [, , stacked, dollar, , split, , , link, date] = grid.cellEls;
  setGridCellPieces(stacked, [makeElementNode('s', [
    makeTextNode(' 125 '), makeElementNode('br', []), makeTextNode(' 126'),
  ])]);
  setGridCellPieces(dollar, [makeElementNode('sym', [makeTextNode('$')]), makeElementNode('num', [makeTextNode('337.91')])]);
  setGridCellPieces(split, [makeTextNode('4.'), makeElementNode('dec', [makeTextNode('91')]), makeTextNode('tn')]);
  const anchor = makeElementNode('a', [makeTextNode('7.5m')]);
  anchor.innerText = '7.5m';
  setGridCellPieces(link, [anchor]);
  link.innerText = '7.5m';
  link.querySelectorAll = (sel) => (sel === 'a' ? [anchor] : []);
  setGridCellPieces(date, [makeTextNode('2024-'), makeElementNode('md', [makeTextNode('03-15')])]);
  return grid;
}

// The source text of one function or method: from its signature to the
// brace that closes its body. '' when the signature is absent.
function sourceBodyOf(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) return '';
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(start, k + 1);
  }
  return '';
}

/**
 * Build a self-contained div-grid wrapper whose querySelectorAll('.dr-ext-rounded')
 * dynamically reflects which cells currently carry that class.
 *
 * Uses makeGridWrapper (existing helper, ~L6821) for the DOM stub, then
 * overwrites the querySelectorAll stub on the wrapper so resetTable can find
 * rounded cells after roundTable has run.
 *
 * @param {Array<Array<string>>} rowData  — 2D array of cell text values
 * @returns {{ wrapperEl, rowEls, cellEls }}
 */
function makeE2EGridWrapper(rowData) {
  const grid = makeGridWrapper(rowData);

  // Collect all cells for dynamic querySelectorAll lookup.
  const allCells = grid.cellEls.slice();

  // Override wrapper querySelectorAll:
  // - '.dr-ext-rounded': walk allCells and return those carrying the class.
  // - other selectors: delegate to the original stub (returns []).
  grid.wrapperEl.querySelectorAll = function(sel) {
    if (sel === '.dr-ext-rounded') {
      return allCells.filter(function(c) {
        return c.classList.contains('dr-ext-rounded');
      });
    }
    // _getRowEls fallback path in GridAdapter uses children, not querySelectorAll,
    // so returning [] for other selectors is safe.
    return [];
  };

  // Override wrapper querySelector so isTableRounded / syncSwitchForTable don't throw.
  grid.wrapperEl.querySelector = function(sel) {
    if (sel === '.dr-ext-rounded') {
      return allCells.find(function(c) { return c.classList.contains('dr-ext-rounded'); }) || null;
    }
    return null;
  };

  // dataset is already set by makeGridWrapper; ensure drShowingOriginal can be deleted.
  if (!grid.wrapperEl.dataset) grid.wrapperEl.dataset = {};

  return grid;
}

/**
 * Build a grid with a capturing MutationObserver stub installed, then round it.
 * Returns { grid, capturedObserver, capturedTimers, origMO, origSetTimeout, origClearTimeout }.
 *
 * The caller is responsible for restoring globals in a finally block.
 *
 * @param {Array<Array<string>>} rowData
 * @param {object} [roundOpts]   — merged with DR_DEFAULTS for roundTable
 */
function setupVirtGrid(rowData, roundOpts) {
  const pendingTimers = [];
  let cancelledIds = new Set();

  // Capturing MutationObserver: stores callback + observe options so tests can drive them.
  let capturedObserver = null;
  const CapturingMO = class {
    constructor(cb) {
      this._cb = cb;
      this._observing = false;
      this._options = null;
      this._target = null;
      this.disconnectCount = 0;
      this.reconnectCount = 0;
      capturedObserver = this;
    }
    observe(target, options) {
      if (!this._observing) {
        this.reconnectCount++;
      }
      this._observing = true;
      this._target = target;
      this._options = options;
    }
    disconnect() {
      this._observing = false;
      this.disconnectCount++;
    }
    /** Test helper: fire the callback as if a mutation occurred. */
    trigger(mutations) {
      if (this._cb) this._cb(mutations || [], this);
    }
  };

  const origMO = global.MutationObserver;
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;

  global.MutationObserver = CapturingMO;
  global.setTimeout = function(fn, ms) {
    const id = pendingTimers.length;
    pendingTimers.push({ fn, ms, cancelled: false });
    return id;
  };
  global.clearTimeout = function(id) {
    if (id !== undefined && id !== null && pendingTimers[id]) {
      pendingTimers[id].cancelled = true;
    }
  };

  const grid = makeE2EGridWrapper(rowData);
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true }, roundOpts || {});
  roundTable(grid.wrapperEl, opts);

  return {
    grid,
    get capturedObserver() { return capturedObserver; },
    pendingTimers,
    origMO,
    origSetTimeout,
    origClearTimeout,
  };
}

/** Fire all non-cancelled pending timers synchronously (simulate "advance past debounce"). */
function flushTimers(pendingTimers) {
  for (const t of pendingTimers) {
    if (!t.cancelled) t.fn();
  }
}

function makePhantomEl(opts) {
  opts = opts || {};
  const attrs = opts.attrs || {};
  const style  = opts.style  || {};
  return {
    tagName:      opts.tagName || 'DIV',
    getAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    style:        Object.assign({}, style),
    parentElement: null,
    parentNode:   null,
    // querySelector / querySelectorAll stubs (overridden per-fixture where needed)
    querySelector:    function() { return null; },
    querySelectorAll: function() { return []; },
  };
}

// Link child -> parent -> grandparent -> … in parentElement chain.
function chainParents(child /*, ...parents */) {
  let current = child;
  for (let i = 1; i < arguments.length; i++) {
    current.parentElement = arguments[i];
    arguments[i].parentNode = null; // ensure parentNode fallback not needed
    current = arguments[i];
  }
  return child;
}

// An element that qualifies as "positioned" (inline style.position='absolute').
function makePositionedAncestor(styleOverrides) {
  return makePhantomEl({ style: Object.assign({ position: 'absolute' }, styleOverrides || {}) });
}

// A minimal 2-column numeric table stub (no aria-hidden, normal left, no svg).
function makeOnScreenTable() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  // parentElement: a plain non-positioned wrapper
  const wrapper = makePhantomEl({ tagName: 'DIV' });
  chainParents(table, wrapper);
  return table;
}

// =============================================================================
// Sprint filter-pass1-native: Pass 1 guard skips phantom a11y tables
// =============================================================================
//
// injectTableToggles() Pass 1 calls document.querySelectorAll('table') and skips
// any table for which isPhantomA11yTable(table) is true, then calls
// createToggleForTable(table) only for the survivors.
//
// A toggle was created iff tableToggles.has(table) becomes true afterwards.
//
// For each test we:
//   1. Temporarily replace global.document.querySelectorAll so Pass 1 sees our
//      fixture tables and Pass 2 (GRID_ARIA_SELECTOR) sees an empty list.
//   2. Temporarily stub document.createElement + document.body.appendChild so
//      createToggleForTable can run without errors.
//   3. Reset tableToggles / trackedTables for each run by deleting entries we
//      added (WeakMap doesn't expose a clear(), so we track which table objects
//      we inserted and delete them by re-using the objects).
//
// CRITICAL: phantom tables must pass isDataTable() so the only reason they
// would be skipped is the isPhantomA11yTable guard, not the isDataTable gate.
// Real on-screen tables must fail isPhantomA11yTable but pass isDataTable.
//
// Helper: build a 2-column 2-row numeric table stub (satisfies isDataTable).
// Also provide getAttribute (for isPhantomA11yTable signal 1) and parentElement
// chain + style (for signals 2/3).
//
function makePass1DataTable(opts) {
  opts = opts || {};
  const attrs = opts.attrs || {};
  const style  = opts.style  || {};
  const rows = [
    { cells: [
        { tagName: 'TD', innerText: '10000', textContent: '10000', innerHTML: '10000',
          classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
          dataset: {}, title: '', querySelectorAll: ()=>[], removeAttribute(){} },
        { tagName: 'TD', innerText: '20000', textContent: '20000', innerHTML: '20000',
          classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
          dataset: {}, title: '', querySelectorAll: ()=>[], removeAttribute(){} },
      ]
    },
    { cells: [
        { tagName: 'TD', innerText: '30000', textContent: '30000', innerHTML: '30000',
          classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
          dataset: {}, title: '', querySelectorAll: ()=>[], removeAttribute(){} },
        { tagName: 'TD', innerText: '40000', textContent: '40000', innerHTML: '40000',
          classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
          dataset: {}, title: '', querySelectorAll: ()=>[], removeAttribute(){} },
      ]
    },
  ];
  const table = {
    tagName: 'TABLE',
    rows: rows,
    dataset: {},
    getAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    style: Object.assign({}, style),
    parentElement: null,
    parentNode: null,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getBoundingClientRect: function() { return { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 }; },
    classList: {
      _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);},
      contains(c){return this._c.includes(c);}
    },
  };
  return table;
}

// Run injectTableToggles() with a controlled list of tables returned by
// document.querySelectorAll('table'). Stubs away document.createElement and
// document.body.appendChild so createToggleForTable doesn't throw in Node.
// Restores all globals afterwards. Returns { tables } (same array for inspection).
function runPass1WithTables(tables) {
  const origQSA      = global.document.querySelectorAll;
  const origCreateEl = global.document.createElement;
  const origBody     = global.document.body;
  const origDocEl    = global.document.documentElement;

  // Stub querySelectorAll: Pass 1 → our tables; Pass 2 (GRID_ARIA_SELECTOR) → []
  global.document.querySelectorAll = function(sel) {
    if (sel === 'table') return tables;
    return [];
  };

  // Stub createElement so createToggleForTable can build its button tree
  global.document.createElement = function(tag) {
    const attrs = {};
    const listeners = {};
    return {
      _tag: tag,
      type: '',
      className: '',
      style: {},
      _children: [],
      dataset: {},
      parentElement: null,
      textContent: '',
      classList: {
        _c: [],
        add(c)     { if (!this._c.includes(c)) this._c.push(c); },
        remove(c)  { this._c = this._c.filter(x => x !== c); },
        contains(c){ return this._c.includes(c); },
        toggle(c, f) {
          const has = this._c.includes(c);
          const want = f === undefined ? !has : f;
          if (want && !has) this._c.push(c);
          else if (!want && has) this._c = this._c.filter(x => x !== c);
          return want;
        },
      },
      contains() { return false; },
      appendChild(child) { this._children.push(child); child.parentElement = this; return child; },
      addEventListener(evt, fn) { if (!listeners[evt]) listeners[evt]=[]; listeners[evt].push(fn); },
      setAttribute(name, val) { attrs[name] = val; },
      getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
      removeAttribute(name) { delete attrs[name]; },
    };
  };

  // Stub body so button is appended without errors
  global.document.body = { appendChild() {} };
  global.document.documentElement = { appendChild() {} };

  // Reset toggleStyleInjected so ensureToggleStyleInjected doesn't try document.head
  const origToggleStyleInjected = toggleStyleInjected;
  toggleStyleInjected = true; // skip style injection (would need document.head)

  try {
    injectTableToggles();
  } finally {
    global.document.querySelectorAll  = origQSA;
    global.document.createElement     = origCreateEl;
    global.document.body              = origBody;
    global.document.documentElement   = origDocEl;
    toggleStyleInjected               = origToggleStyleInjected;
  }

  return { tables };
}

// Helper: clean up tableToggles / trackedTables for a list of table objects so
// they don't pollute subsequent tests.
function cleanupPass1Tables(tables) {
  for (const t of tables) {
    if (tableToggles.has(t)) {
      tableToggles.delete(t);
      trackedTables.delete(t);
    }
  }
}

// ---------------------------------------------------------------------------
// Sprint loosen-pass2-aria: Pass 2 phantom-table gate in injectTableToggles
// ---------------------------------------------------------------------------
//
// The spec change: Pass 2 now skips an ARIA grid ONLY when it contains at
// least one REAL (non-phantom) <table>.  A grid that contains only phantom
// a11y tables (aria-hidden, offscreen, or svg-chart-wrapped) must be picked up
// by Pass 2 and get a toggle.
//
// Helper: build a minimal ARIA grid element (div with role="grid" or role="table")
// with a proper classList and the querySelectorAll('table') that returns a given
// list of embedded table stubs.  Also provides a real row/cell structure so that
// isDataTable() → GridAdapter.getRows() returns numeric data rows, making
// createToggleForTable() proceed past the isDataTable guard.
//
function makeAriaGrid(embeddedTables) {
  const classes = new Set();

  // Build two rows × two numeric cells so isDataTable returns true.
  function makeGridCell(text) {
    return {
      tagName: 'DIV',
      textContent: text,
      dataset: {},
      classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
      querySelectorAll() { return []; },
      childNodes: [],
    };
  }
  function makeGridRow(texts) {
    const cellEls = texts.map(makeGridCell);
    return {
      tagName: 'DIV',
      dataset: {},
      children: cellEls,
      querySelectorAll() { return []; },
    };
  }
  const rowEls = [
    makeGridRow(['1,000,000', '2,000,000']),
    makeGridRow(['3,000,000', '4,000,000']),
  ];

  return {
    tagName: 'DIV',
    classList: {
      contains(c) { return classes.has(c); },
      add(c)      { classes.add(c); },
      remove(c)   { classes.delete(c); },
      _classes:   classes,
    },
    // querySelectorAll: for 'table' return embeddedTables; for grid-detection selectors
    // ([role="grid"], [role="row"], etc.) return nothing so GridAdapter falls back to children.
    querySelectorAll(sel) {
      if (sel === 'table') return embeddedTables || [];
      return [];
    },
    // children: the two rows — used by GridAdapter._getRowEls as fallback
    children: rowEls,
    getBoundingClientRect() {
      return { top: 50, right: 300, bottom: 100, left: 50 };
    },
  };
}

// Helper: build a minimal phantom embedded table (aria-hidden on self → isPhantomA11yTable true)
function makePhantomEmbeddedTable() {
  return makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
}

// Helper: build a minimal real on-screen embedded table (isPhantomA11yTable false)
function makeRealEmbeddedTable() {
  const tbl = makePhantomEl({ tagName: 'TABLE' });
  const wrapper = makePhantomEl({ tagName: 'DIV' });
  chainParents(tbl, wrapper);
  return tbl;
}

// Shared mock factory for the document.createElement / document.body rig
// that createToggleForTable requires.  Returns { restore } to undo.
function withToggleDocumentMock(fn) {
  const origCreateEl = global.document.createElement;
  const origBody     = global.document.body;
  const origDocEl    = global.document.documentElement;
  const origQSA      = global.document.querySelectorAll;
  const origScrollX  = global.window.scrollX;
  const origScrollY  = global.window.scrollY;

  global.window.scrollX = 0;
  global.window.scrollY = 0;
  global.document.documentElement = { appendChild() {} };

  global.document.createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const el = {
      _tag: tag,
      type: '',
      className: '',
      style: {},
      _children: [],
      dataset: {},
      parentElement: null,
      textContent: '',
      appendChild(child) {
        this._children.push(child);
        child.parentElement = this;
        return child;
      },
      addEventListener(evt, fn2) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn2);
      },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      removeAttribute(name) { delete attrs[name]; },
      classList: (() => {
        const c = [];
        return {
          _c: c,
          add(x)       { if (!c.includes(x)) c.push(x); },
          remove(x)    { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
          contains(x)  { return c.includes(x); },
          toggle(x, f) {
            const has = c.includes(x);
            const want = f === undefined ? !has : f;
            if (want && !has) c.push(x);
            else if (!want && has) c.splice(c.indexOf(x), 1);
            return want;
          },
        };
      })(),
      contains() { return false; },
    };
    return el;
  };

  global.document.body = {
    appendChild(child) { child.parentElement = global.document.body; },
    // The registry teardown detaches a pillbox through its parent, so the
    // body stub answers the other half of the pair.
    removeChild(child) { child.parentElement = null; },
  };

  try {
    fn();
  } finally {
    global.document.createElement   = origCreateEl;
    global.document.body            = origBody;
    global.document.documentElement = origDocEl;
    global.document.querySelectorAll = origQSA;
    global.window.scrollX            = origScrollX;
    global.window.scrollY            = origScrollY;
    toggleStyleInjected = true; // prevent style re-injection leaking across tests
  }
}

// Helper: turn a makeAriaGrid() result into an added-node stub: it must look
// like an element node and match GRID_ARIA_SELECTOR via node.matches().
function asAddedGridNode(grid) {
  grid.nodeType = global.Node.ELEMENT_NODE;
  grid.tagName = 'DIV';
  grid.matches = function(sel) { return sel === '[role="grid"], [role="table"]'; };
  return grid;
}

// Drive the pending table's observer and its debounce the way the re-apply
// observer tests drive theirs. The capturing MutationObserver records every
// instance and every observe call, so a test can count the observers a nest
// produced; the setTimeout stub stores each scheduled callback for the test to
// run.
function withPendingHarness(fn) {
  const observers = [];
  const timers = [];
  const CapturingPendingMO = class {
    constructor(cb) {
      this._cb = cb;
      this.observeCalls = [];
      this.disconnectCount = 0;
      observers.push(this);
    }
    observe(target, options) { this.observeCalls.push({ target, options }); }
    disconnect() { this.disconnectCount++; }
    /** Test helper: run the callback as one subtree mutation. */
    trigger() { if (this._cb) this._cb([], this); }
  };

  const origMO = global.MutationObserver;
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  global.MutationObserver = CapturingPendingMO;
  global.setTimeout = function (callback, ms) {
    timers.push({ callback, ms, cancelled: false, ran: false });
    return timers.length - 1;
  };
  global.clearTimeout = function (id) {
    if (id !== undefined && id !== null && timers[id]) timers[id].cancelled = true;
  };

  try {
    fn({ observers, timers });
  } finally {
    global.MutationObserver = origMO;
    global.setTimeout = origSetTimeout;
    global.clearTimeout = origClearTimeout;
  }
}

// Run the debounce timers a pending observer scheduled, and only those: the
// pillbox builder schedules its own positioning timer at another delay, and
// running that one here would test nothing about the re-test. Returns how many
// ran.
function runPendingRetestTimers(timers) {
  let ran = 0;
  for (const timer of timers) {
    if (timer.cancelled || timer.ran) continue;
    if (timer.ms !== DR_DETECTION_SETTINGS.gridRedrawDelayMs) continue;
    timer.ran = true;
    ran++;
    timer.callback();
  }
  return ran;
}

// Add one element child to a fixture node after it was built. makeDgNode links
// a child to its parent at construction, so a later child takes that link here.
function appendDgChild(parentEl, childEl) {
  parentEl.childNodes.push(childEl);
  parentEl.children.push(childEl);
  childEl.parentElement = parentEl;
  return childEl;
}

// Fill an empty database query grid fixture, the way the page fills a grid
// that drew before its rows loaded.
function fillDatabaseQueryGrid(grid) {
  PENDING_FILL_ROWS.forEach((scrollTexts, i) => {
    appendDgChild(grid.pinnedPaneEl, makeDgRow(i, [String(i + 1)]));
    appendDgChild(grid.scrollPaneEl, makeDgRow(i, scrollTexts));
  });
}

// Build a <tr>-style row element whose cells are its element children.
function makeTrRow(cellTexts) {
  const cellEls = cellTexts.map(makeGridCellWithTextNode);
  const row = makeElementNode('', cellEls);
  row.tagName = 'TR';
  row.children = cellEls;
  row.querySelectorAll = function(sel) {
    if (sel === '[role="cell"]' || sel === '.dg--cell') return [];
    return [];
  };
  return row;
}

// Build a Kaggle-shaped ARIA grid:
//   grid[role=table]
//     div[role=row]            ← lone description block (NOT a data row)
//     div[role=none] > tr(th)  ← header row, OUTSIDE any rowgroup
//     div[role=none] > tr(td)  ← per-column stats row, OUTSIDE any rowgroup
//     div[role=rowgroup] > span > tr(td) ...  ← the real data rows
function makeKaggleLikeGrid(dataRows) {
  const descRow = makeElementNode('', [makeGridCellWithTextNode('About this file')]);
  descRow.querySelectorAll = () => [];

  const headerTr = makeTrRow(['Release_Date', 'Popularity', 'Vote_Count']);
  const statsTr  = makeTrRow(['9515', '9824', '9827']);

  const dataTrs = dataRows.map(makeTrRow);
  const rowgroup = makeElementNode('', dataTrs);
  rowgroup.querySelectorAll = function(sel) {
    if (sel === 'tr') return dataTrs;
    return []; // no [role="row"] / .dg--virtual-row inside
  };

  const allTrs = [headerTr, statsTr, ...dataTrs];
  const wrapper = makeElementNode('grid', [descRow, headerTr, statsTr, rowgroup]);
  wrapper.tagName = 'DIV';
  wrapper.matches = () => false;
  wrapper.querySelector = () => null;
  wrapper.querySelectorAll = function(sel) {
    if (sel === '[role="rowgroup"]') return [rowgroup];
    if (sel === '[role="row"]') return [descRow];
    if (sel === 'tr') return allTrs;
    return [];
  };
  return wrapper;
}

// Build a Table-10-shaped ARIA grid: [role="row"] rows, with an optional
// header row before the rowgroup and an optional summary row after it, both
// OUTSIDE the group. Data rows sit inside the rowgroup.
function makeRowgroupRoleGrid(headerTexts, dataRows, summaryTexts) {
  function makeRoleRow(cellTexts) {
    const cellEls = cellTexts.map(makeGridCellWithTextNode);
    const row = makeElementNode('g-row', cellEls);
    row.children = cellEls;
    row.querySelectorAll = function(sel) {
      if (sel === '[role="cell"]') return cellEls;
      return [];
    };
    return row;
  }

  const headerRow = headerTexts ? makeRoleRow(headerTexts) : null;
  const dataRowEls = dataRows.map(makeRoleRow);
  const summaryRow = summaryTexts ? makeRoleRow(summaryTexts) : null;

  const rowgroup = makeElementNode('', dataRowEls);
  rowgroup.querySelectorAll = function(sel) {
    if (sel === '[role="row"]') return dataRowEls;
    return [];
  };

  // Document order, as the real querySelectorAll would report it.
  const allRows = [];
  if (headerRow) allRows.push(headerRow);
  allRows.push.apply(allRows, dataRowEls);
  if (summaryRow) allRows.push(summaryRow);

  const kids = [];
  if (headerRow) kids.push(headerRow);
  kids.push(rowgroup);
  if (summaryRow) kids.push(summaryRow);

  const wrapper = makeElementNode('aria-grid', kids);
  wrapper.tagName = 'DIV';
  wrapper.matches = function() { return false; };
  wrapper.querySelector = function() { return null; };
  wrapper.querySelectorAll = function(sel) {
    if (sel === '[role="rowgroup"]') return [rowgroup];
    if (sel === '[role="row"]') return allRows;
    return [];
  };
  return { wrapperEl: wrapper, dataRowEls, headerRow, summaryRow };
}

// Helper: a native table of `rows` by `cols` cells, with a number placed at
// the given one-based position in document order (row by row, left to
// right), or no number at all when numberPosition is null. Every other cell
// is empty, so the fixture also exercises the rule that an empty cell counts
// as a read.
function buildBudgetTableRowsSpec(rows, cols, numberPosition) {
  const spec = [];
  for (let r = 0; r < rows; r++) {
    const rowSpec = [];
    for (let c = 0; c < cols; c++) {
      const position = r * cols + c + 1;
      rowSpec.push({ tag: 'td', text: (position === numberPosition) ? '42' : '' });
    }
    spec.push(rowSpec);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Shared helper: create a real button via createToggleForTable with full DOM
// stubs so its click-handler closure captures the real module-level variables.
// Returns { table, buttonEl }.
// ---------------------------------------------------------------------------
function makeRealToggleButton(tableSpec, docMock) {
  const appendedToBody = [];
  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;
  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;

  // Minimal createElement stub that produces event-capable elements.
  global.document.createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const el = {
      _tag: tag, type: '', className: '', style: {}, _children: [],
      _listeners: listeners, dataset: {}, parentElement: null, textContent: '',
      classList: (() => {
        const c = [];
        return {
          _c: c,
          add(x)      { if (!c.includes(x)) c.push(x); },
          remove(x)   { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
          contains(x) { return c.includes(x); },
          toggle(x, f){
            const has = c.includes(x);
            const want = f === undefined ? !has : f;
            if (want && !has) c.push(x); else if (!want && has) c.splice(c.indexOf(x), 1);
            return want;
          },
        };
      })(),
      appendChild(ch) { this._children.push(ch); ch.parentElement = this; return ch; },
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      setAttribute(n, v) { attrs[n] = v; },
      getAttribute(n) {
        return Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null;
      },
      removeAttribute(n) { delete attrs[n]; },
      contains() { return false; },
      dispatchEvent(evt) { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
    };
    if (docMock && docMock.onCreateElement) docMock.onCreateElement(el, tag);
    return el;
  };

  global.document.body = {
    appendChild(child) { appendedToBody.push(child); child.parentElement = global.document.body; }
  };
  global.document.documentElement = { appendChild() {} };
  toggleStyleInjected = false;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = makeToggleTable(tableSpec);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(table);

  // Restore globals
  global.document.createElement   = origCreateEl;
  global.document.body             = origDocBody;
  global.document.documentElement  = origDocEl;
  global.window.scrollX            = origScrollX;
  global.window.scrollY            = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');
  return { table, buttonEl };
}

// Helper: fire a mouse click on a button element (pointerdown + click).
function fireMouseClick(buttonEl, fn) {
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  withCreateTreeWalker(function() {
    clickHandlers.forEach(h => h({ stopPropagation() {}, type: 'click' }));
    if (fn) fn();
  });
}

function withRightClickSandbox(run) {
  let contextmenuHandler = null;
  const observeCalls = [];
  const constructedObservers = [];
  const pendingTimers = [];

  class CapturingRightClickMO {
    constructor(cb) { this._cb = cb; constructedObservers.push(this); }
    observe(target, options) { observeCalls.push({ target, options }); }
    disconnect() {}
  }

  function makeMockElement(tag) {
    const classes = [];
    return {
      tagName: String(tag).toUpperCase(),
      type: '', className: '', textContent: '',
      style: {}, dataset: {},
      classList: {
        add(c) { if (!classes.includes(c)) classes.push(c); },
        remove(c) { const i = classes.indexOf(c); if (i >= 0) classes.splice(i, 1); },
        contains(c) { return classes.includes(c); },
      },
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      addEventListener() {}, appendChild() {}, parentElement: null,
    };
  }

  const captureDoc = {
    addEventListener(type, handler) { if (type === 'contextmenu') contextmenuHandler = handler; },
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {} },
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    createElement: makeMockElement,
  };
  const sentMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage(msg) { sentMessages.push(msg); },
    },
  };

  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
    getComputedStyle: global.getComputedStyle, setTimeout: global.setTimeout,
  };
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = {
    addEventListener() {}, scrollX: 0, scrollY: 0,
    getComputedStyle: () => ({ display: 'flex', visibility: 'visible' }),
  };
  global.MutationObserver = CapturingRightClickMO;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };
  // The geometry probe reads layout through the bare getComputedStyle global.
  global.getComputedStyle = () => ({ display: 'flex', visibility: 'visible' });
  // A collecting stub keeps the pillbox's deferred positioning out of the
  // globals a later section runs under.
  global.setTimeout = function (fn, ms) { pendingTimers.push({ fn, ms }); return pendingTimers.length - 1; };

  try {
    // The evaluation's own DR_STORE and tableToggles bindings, exposed the way
    // the registry and parent-equivalence harnesses above expose theirs.
    eval(contentScriptBundle + `
      globalThis.__rcr_DR_STORE = DR_STORE;
      globalThis.__rcr_tableToggles = tableToggles;
    `);
    run({
      get contextmenuHandler() { return contextmenuHandler; },
      store: global.__rcr_DR_STORE,
      tableToggles: global.__rcr_tableToggles,
      observeCalls, constructedObservers, sentMessages, pendingTimers,
    });
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
    global.getComputedStyle = saved.getComputedStyle; global.setTimeout = saved.setTimeout;
    delete global.__rcr_DR_STORE;
    delete global.__rcr_tableToggles;
  }
}

// A plain parent carrying no grid or table role: a nest boundary that
// qualifies nothing of its own, so each grid under it heads its own chain.
function makeNestingHost(children) {
  return makeDgNode('DIV', 'nesting-host', null, children);
}

// A lone grid: one role="grid" element with numeric rows and no qualifying
// element under it, so its containment chain is one element long.
function makeLoneGrid() {
  return makeDgNode('DIV', 'lone-grid', 'grid', [
    makeDgRow(0, ['north', '4,281,905', '17.40']),
    makeDgRow(1, ['south', '622,148', '9.05']),
    makeDgRow(2, ['east', '58,730', '3.62']),
  ]);
}

// The live text of one column across a list of fixture rows.
function dgColumnTexts(rowEls, columnIndex) {
  return rowEls.map((rowEl) => rowEl.children[columnIndex].childNodes[0].nodeValue);
}

// Drop a registration and the pillbox bookkeeping that goes with it, so a
// later case counts its own registrations alone.
function forgetRegisteredTable(table) {
  DR_STORE.unregisterTable(table);
  tableToggles.delete(table);
  trackedTables.delete(table);
}

// Replace one fixture row's cells, the way a virtualized grid redraws a row.
function dgReplaceRowCells(rowEl, cellTexts) {
  const cellEls = cellTexts.map(makeDgCell);
  for (const cellEl of cellEls) {
    cellEl.parentElement = rowEl;
    cellEl.parentNode = rowEl;
  }
  rowEl.childNodes = cellEls;
  rowEl.children = cellEls;
}

// Add one cell to the end of a fixture row, the way a wider result set does.
// The row's existing cell elements stay, so a test can hold one of them across
// the change.
function dgAppendRowCell(rowEl, text) {
  const cellEl = makeDgCell(text);
  cellEl.parentElement = rowEl;
  cellEl.parentNode = rowEl;
  rowEl.childNodes = rowEl.childNodes.concat([cellEl]);
  rowEl.children = rowEl.children.concat([cellEl]);
}

// Narrow one fixture row to a subset of the cell elements it already holds,
// the way a page that drops a column leaves the rest of the row in place. The
// kept cells are the same elements, so a test can read what they show.
function dgKeepRowCells(rowEl, indices) {
  const kept = indices.map((i) => rowEl.children[i]);
  rowEl.childNodes = kept;
  rowEl.children = kept;
}

// Replace one fixture pane's drawn rows, the way a scroll does.
function dgReplacePaneRows(paneEl, rowEls) {
  for (const rowEl of rowEls) {
    rowEl.parentElement = paneEl;
    rowEl.parentNode = paneEl;
  }
  paneEl.childNodes = rowEls;
  paneEl.children = rowEls;
}

// An ARIA grid that groups its data rows, with the header row outside the
// group. redraw() replaces the group's rows and leaves the header row in
// place, which is what a scroll of a virtualized grid does.
function makeScrollingRowgroupGrid(headerTexts, dataRows) {
  function makeRoleRow(cellTexts) {
    const cellEls = cellTexts.map(makeGridCellWithTextNode);
    const row = makeElementNode('g-row', cellEls);
    row.children = cellEls;
    row.querySelectorAll = (sel) => (sel === '[role="cell"]' ? cellEls : []);
    return row;
  }
  const headerRow = makeRoleRow(headerTexts);
  let dataRowEls = dataRows.map(makeRoleRow);
  const rowgroup = makeElementNode('', []);
  rowgroup.querySelectorAll = (sel) => (sel === '[role="row"]' ? dataRowEls : []);
  const wrapperEl = makeElementNode('aria-grid', [headerRow, rowgroup]);
  wrapperEl.tagName = 'DIV';
  wrapperEl.matches = (sel) => sel === GRID_ARIA_SELECTOR_TEXT;
  wrapperEl.querySelector = () => null;
  wrapperEl.querySelectorAll = function (sel) {
    if (sel === '[role="rowgroup"]') return [rowgroup];
    if (sel === '[role="row"]') return [headerRow].concat(dataRowEls);
    return [];
  };
  wrapperEl.getAttribute = (name) => (name === 'role' ? 'grid' : null);
  wrapperEl.getBoundingClientRect = () => (
    { top: 20, right: 420, bottom: 260, left: 20, width: 400, height: 240 });
  return {
    wrapperEl,
    headerRow,
    dataRowEls: () => dataRowEls,
    redraw(rows) { dataRowEls = rows.map(makeRoleRow); },
  };
}

// A native table whose first row sits in a head section. The adapter reads
// the row's parent, so the section is a parent stub carrying the tag name.
function makeHeadSectionTable(headerTexts, dataRows) {
  const table = makeToggleTable(
    [headerTexts.map((text) => ({ tag: 'td', text }))].concat(
      dataRows.map((rowTexts) => rowTexts.map((text) => ({ tag: 'td', text })))));
  table.rows[0].parentElement = { tagName: 'THEAD' };
  return table;
}

// A nest whose chain root fails the data test while two qualifying children
// pass it: the shape that leaves the configured depth crowded with no
// shallower depth to fall back to.
//
// The root's own row read comes from the row group under it, which holds two
// rows of text and no number, so the root fails the data test. The two panes
// sit outside that row group and hold their own rows, so each passes. Both
// panes carry the table role rather than the grid role, which keeps the grid
// adapter's scroll-container lookup on the root itself.
function makeCrowdedNest() {
  const textCell = (text) => {
    const cell = makeDgNode('DIV', 'text-cell', null, [makeTextNode(text)]);
    cell.textContent = text;
    cell.innerText = text;
    return cell;
  };
  const textRow = (cellTexts) => makeDgNode('DIV', 'text-row', 'row', cellTexts.map(textCell));
  const rowGroupEl = makeDgNode('DIV', 'text-rowgroup', 'rowgroup', [
    textRow(['alpha', 'north']),
    textRow(['bravo', 'south']),
  ]);
  const paneAEl = makeDgNode('DIV', 'crowded-pane-a', 'table', [
    makeDgRow(0, ['alpha', '7,318,204']),
    makeDgRow(1, ['bravo', '551,077']),
  ]);
  const paneBEl = makeDgNode('DIV', 'crowded-pane-b', 'table', [
    makeDgRow(0, ['charlie', '2,140,663']),
    makeDgRow(1, ['delta', '73,915']),
  ]);
  const rootEl = makeDgNode('DIV', 'crowded-root', 'table', [rowGroupEl, paneAEl, paneBEl]);
  return { rootEl, paneAEl, paneBEl };
}

// ---------------------------------------------------------------------------
// Issue #251: the sidebar mirrors the model's settings on any table switch.
// A shared harness (same eval shape as the reopen-bound test above, plus an
// onMessage capture and a rangeExpr capture) drives sidebar.js's real
// onMessage handler. The model holds enabled:false and a non-default
// rangeExpr; each scenario first drifts the controls away from the model —
// exactly what the old code left behind — then delivers the message under
// test and asserts the panel snapped back to the model.
// ---------------------------------------------------------------------------
function makeIssue251SidebarHarness() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    return null;
  }

  function makeEl() {
    const listeners = {};
    return {
      addEventListener(type, fn) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      // fire: drive a captured listener the way a real control event would —
      // lets a test trigger sidebar.js's applyNow path (issue #272 tests).
      fire(type, evt) { (listeners[type] || []).forEach((fn) => fn(evt)); },
      removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    };
  }

  const statusEl = makeEl();
  const enabledEl = makeEl();
  const rangeExprEl = makeEl();

  const bodyClasses = new Set();
  const captureBody = {
    classList: {
      add(cls) { bodyClasses.add(cls); },
      remove(cls) { bodyClasses.delete(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    addEventListener() {},
    get offsetWidth() { return 0; },
  };

  // Memoized: sidebar.js grabs each control once at module level and attaches
  // listeners to it; a test must be able to reach that SAME element (via
  // el(id) on the returned harness) to fire those listeners (issue #272).
  const elsById = { status: statusEl, enabled: enabledEl, rangeExpr: rangeExprEl };
  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (!elsById[id]) elsById[id] = makeEl();
      return elsById[id];
    },
    createElement() { return makeEl(); },
  };

  // The model's settings differ from the shipped defaults on two controls,
  // so a handler that pulls is distinguishable from one that resets: after
  // any refresh the panel must show enabled:false and rangeExpr 'B2:E8'.
  const modelSettings = Object.assign({}, DR_DEFAULTS, { enabled: false, rangeExpr: 'B2:E8' });
  let onMessageHandler = null;
  const tabMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { onMessageHandler = fn; } },
      sendMessage() {},
      lastError: null,
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      sendMessage(tabId, msg, cb) {
        tabMessages.push(msg);
        if (msg.action === 'request:settings') {
          cb({ settings: modelSettings });
        } else if (msg.action === 'request:previewSamples') {
          cb({ samples: { top: [], bottom: [] }, maxMag: 0 });
        } else {
          // The settings apply. Chrome hands back the responder's value on
          // success and nothing when nobody answered, which is the fact the
          // sidebar reads to decide bound versus unbound.
          cb(captureChrome.runtime.lastError ? undefined : { ok: true });
        }
      },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  let evalError = null;
  try {
    eval(
      constantsCode + '\n' +
      roundingSrc + '\n' +
      coreSrc + '\n' +
      messagingCode + '\n' +
      fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
    );
  } catch (e) {
    evalError = e;
  }

  return {
    statusEl, enabledEl, rangeExprEl, bodyClasses, evalError, tabMessages,
    chromeMock: captureChrome,
    el(id) { return elsById[id]; },
    dispatch(msg) { onMessageHandler(msg, FROM_SIDEBAR_TAB, () => {}); },
    hasHandler() { return typeof onMessageHandler === 'function'; },
    restore() {
      global.document = savedDoc;
      global.chrome = savedChrome;
      global.window = savedWindow;
    },
  };
}

// Register one element the way the page does — through the pillbox view's
// builder, the one writer of the shape fingerprint — and hand back the list a
// later teardown records its pillbox removal in. The document mock's body stub
// carries no removeChild, so the pillbox gets a parent stub of its own.
function registerFingerprintedTable(table) {
  withToggleDocumentMock(function () { createToggleForTable(table); });
  return trackPillboxDetach(table);
}

function trackPillboxDetach(table) {
  const removedPillboxes = [];
  const button = tableToggles.get(table);
  if (button) {
    button.parentElement = {
      removeChild(child) { removedPillboxes.push(child); child.parentElement = null; },
    };
  }
  return removedPillboxes;
}

// The last ten debug rows, for an assertion that one row landed. The buffer
// caps at 50 rows and drops from the front, so a fixed index into it drifts.
function recentLogRows() {
  return DR_LOG.snapshot().entries.slice(-10).map((row) => row.text);
}

// ===========================================================================
// One meaning for a pillbox press (2026-09-14 sidebar-state-removal, part one)
// ===========================================================================
//
// A press made three different things happen, and which one it made happen
// turned on a value the page could not keep true: whether the sidebar stood
// open. Only the service worker could correct that value, and the correction
// needed a tab number the service worker lost on an idle restart and on an
// ordinary sidebar close. Once the value went stale, a press on a second
// table silently became "move the sidebar here" for the rest of the page's
// life. With the settings record's on/off value at off, such a press changed
// no numbers at all, so the pillbox read as intermittent (#241).
//
// The rule now: a press makes the pressed table active and flips its form
// from what the screen shows, writing the settings record once.
//
// A helper, because every case below needs the same three things reset: the
// settings record, the active table, and the messages a press sends.
function runPressFixture(setup) {
  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };
  // Count settings writes at the model's own publish, which is the one place
  // every write passes through, rather than by wrapping the setter.
  let settingsWrites = 0;
  const unsub = DR_BUS.subscribe('state:settingsChanged', () => { settingsWrites++; });
  // A press that carries a range expression ends in a per-range pulse, which
  // builds overlay elements. The suite's shared document stub has no
  // createElement; supply one for the length of the press.
  const origCreateElement = global.document.createElement;
  global.document.createElement = () => ({
    style: {}, classList: { add() {}, remove() {} },
    appendChild() {}, remove() {}, setAttribute() {},
    addEventListener() {}, removeEventListener() {},
  });
  try {
    // Clear the active table BEFORE seeding the settings record, so the
    // seeding write has nothing to apply to.
    DR_STORE.setSelectedTable(null);
    return setup({ sent, writes: () => settingsWrites, resetWrites: () => { settingsWrites = 0; } });
  } finally {
    unsub();
    if (origCreateElement === undefined) delete global.document.createElement;
    else global.document.createElement = origCreateElement;
    global.chrome.runtime.sendMessage = origSend;
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
}

function makePressTable(text) {
  const table = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'V' }],
    [{ tag: 'td', text: 'R' }, { tag: 'td', text: text }],
  ]);
  table._cells.forEach((c) => {
    c.querySelectorAll = () => [];
    // A press that keeps a range expression ends in a per-cell pulse, which
    // measures each cell in the range; the toggle-table mock has no layout.
    c.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
  });
  injectToggleEntry(table);
  return table;
}

// The change: two word-only columns in place of three columns of data, and a
// single word in each pinned row. The column count moves from three to two.
function emptyTheDatabaseQueryGridOfNumbers(grid) {
  const places = ['november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra'];
  const states = ['pending', 'running', 'queued', 'halted', 'idle', 'done'];
  grid.pinnedRowEls.forEach((rowEl, i) => dgReplaceRowCells(rowEl, [places[i]]));
  grid.scrollRowEls.forEach((rowEl, i) => dgReplaceRowCells(rowEl, [places[i], states[i]]));
}

function makeIsolatedModel() {
  const vm = require('vm');
  const sandbox = { chrome: global.chrome, console };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\n' + storeCode +
    '\nthis.__store = DR_STORE; this.__bus = DR_BUS;', ctx);
  return { store: sandbox.__store, bus: sandbox.__bus };
}

// ---------------------------------------------------------------------------
// Issue #325 — every cross-context topic on the event bus.
//
// A shared sandbox harness for the bus tests below. adapters/messaging.js has
// no DOM dependency, so it runs in its own vm context with only the Chrome
// interfaces stubbed. Each call builds a fresh bus, which matters: a responder
// registration and a subscription both outlive the test that made them, and
// the one-responder rule would make the second test in a file throw for the
// first test's registration.
//
// opts.noTabs        omit chrome.tabs entirely — the content-script context.
// opts.noActiveTab   chrome.tabs.query answers with no tabs.
// opts.throwOnSend   chrome.tabs.sendMessage throws, as it does when the tab
//                    holds no content script.
// opts.reply         the value chrome.tabs.sendMessage hands its callback.
// ---------------------------------------------------------------------------
function makeBusSandbox(opts) {
  const options = opts || {};
  const vm = require('vm');
  const sent = { pages: [], tabs: [], queries: 0 };
  let captured = null;
  const tabs = {
    query(q, cb) { sent.queries++; cb(options.noActiveTab ? [] : [{ id: 7 }]); },
    sendMessage(tabId, msg, cb) {
      sent.tabs.push({ tabId, msg });
      if (options.throwOnSend) throw new Error('no content script');
      if (cb) cb(options.reply);
    },
  };
  const sandbox = {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) { sent.pages.push(msg); if (cb) cb(undefined); },
        onMessage: { addListener(fn) { captured = fn; } },
      },
    },
  };
  if (!options.noTabs) sandbox.chrome.tabs = tabs;
  vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\nthis.__DR_BUS = DR_BUS;', sandbox);
  return {
    bus: sandbox.__DR_BUS,
    sent,
    // Call the bus's own onMessage listener the way Chrome would.
    fire(request, sender, sendResponse) {
      return captured(request, sender || {}, sendResponse || function () {});
    },
  };
}

// (b) roundTable simplifies a hidden cell and resetTable restores it.
//
// A hidden cell's raw text is the one real text node under it; its rendered
// text stays empty throughout, because rounding a hidden cell does not
// unhide it. textContent and innerHTML share one backing value (the raw
// text, exactly as a real <td> keeps them in sync); innerText is a fixed
// empty string, unrelated to that backing value, modeling the rendered read
// a hidden row keeps regardless of what the underlying text node holds.
function makeHiddenNumericCell(rawText) {
  let raw = rawText;
  return {
    tagName: 'TD',
    innerText: '',
    get textContent() { return raw; },
    set textContent(v) { raw = v; },
    get innerHTML() { return raw; },
    set innerHTML(v) { raw = v; },
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      remove(c) { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
    dataset: {},
    title: '',
    querySelectorAll: () => [],
    removeAttribute() {},
  };
}

// A tree walker over the hidden cell's one real text node: its nodeValue is
// the raw text (textContent), never the (unrelated) rendered read.
function withHiddenCellTreeWalker(cell, fn) {
  global.document.createTreeWalker = function() {
    let done = false;
    return {
      nextNode() {
        if (done) return null;
        done = true;
        return {
          get nodeValue() { return cell.textContent; },
          set nodeValue(v) { cell.textContent = v; },
        };
      },
    };
  };
  try { fn(); } finally { delete global.document.createTreeWalker; }
}

// The worked example from the issue: a label column merged down over two rows,
// and a total row merged across the first two columns.
function makeMergedSpanTable() {
  return makeMockTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }, { tag: 'th', text: 'Q2' }],
    [{ tag: 'td', text: 'West', rowSpan: 2 }, { tag: 'td', text: '1,234' }, { tag: 'td', text: '2,345' }],
    [{ tag: 'td', text: '12,500' }, { tag: 'td', text: '3,210' }],
    [{ tag: 'td', text: 'Total', colSpan: 2 }, { tag: 'td', text: '5,555' }],
  ]);
}

// The same table with every merge written out: the reading each consumer must
// agree with.
function makeUnmergedSpanTable() {
  return makeMockTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }, { tag: 'th', text: 'Q2' }],
    [{ tag: 'td', text: 'West' }, { tag: 'td', text: '1,234' }, { tag: 'td', text: '2,345' }],
    [{ tag: 'td', text: 'West' }, { tag: 'td', text: '12,500' }, { tag: 'td', text: '3,210' }],
  ]);
}

// Declare merges on a grid the way a page does, through the accessibility
// attributes. Every cell answers the attribute read, as a page element does;
// only the cells named here answer with a span.
function declareGridSpans(grid, spansByCellIndex) {
  grid.cellEls.forEach(function (cellEl, idx) {
    const spans = spansByCellIndex[idx] || {};
    cellEl.getAttribute = function (name) {
      if (name === 'aria-colspan') return spans.colSpan ? String(spans.colSpan) : null;
      if (name === 'aria-rowspan') return spans.rowSpan ? String(spans.rowSpan) : null;
      return null;
    };
  });
  return grid;
}

function adapterColumnsOf(el) {
  return makeAdapter(el).getRows().map((row) => row.getCells().map((cell) => cell.columnIndex));
}

function rwRecordMutation(node) {
  for (const observer of rwObservers) {
    for (let at = node; at; at = at.parentNode) {
      if (at === observer.target) { observer.queue.push({ target: node }); break; }
    }
  }
}

function rwDeliverMutations() {
  for (const observer of rwObservers.slice()) {
    if (observer.queue.length === 0) continue;
    const records = observer.queue;
    observer.queue = [];
    rwDeliveringToObserver = true;
    try { observer.callback(records, observer); } finally { rwDeliveringToObserver = false; }
  }
}

function rwText(value) {
  let current = value;
  const node = {
    nodeType: 3, childNodes: null, parentNode: null, parentElement: null, writes: 0,
    get nodeValue() { return current; },
    set nodeValue(v) { current = v; node.writes++; rwRecordMutation(node); },
  };
  return node;
}

function rwTextNodesOf(root) {
  const found = [];
  (function visit(node) {
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) found.push(child);
      else visit(child);
    }
  })(root);
  return found;
}

function rwSerialize(node) {
  if (node.nodeType === 3) return node.nodeValue;
  const tag = node.tagName.toLowerCase();
  return '<' + tag + '>' + node.childNodes.map(rwSerialize).join('') + '</' + tag + '>';
}

function rwClone(node) {
  if (node.nodeType === 3) return rwText(node.nodeValue);
  return rwEl(node.tagName, node._attrs, node.childNodes.map(rwClone));
}

function rwSetChildren(el, children) {
  el.childNodes = children;
  for (const child of children) { child.parentNode = el; child.parentElement = el; }
  rwRecordMutation(el);
}

// One element. innerHTML reads the markup, and a write of markup the element
// served before puts a fresh copy of those nodes in, the way the browser
// parses markup into new nodes.
function rwEl(tagName, attrs, children) {
  const classes = new Set();
  const snapshots = new Map();
  const el = {
    nodeType: 1, tagName: String(tagName).toUpperCase(), childNodes: [],
    parentNode: null, parentElement: null, dataset: {}, style: {}, title: '',
    _attrs: Object.assign({}, attrs || {}), innerHTMLWrites: 0,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    get className() { return Array.from(classes).join(' '); },
    get children() { return el.childNodes.filter((node) => node.nodeType === 1); },
    get textContent() { return rwTextNodesOf(el).map((node) => node.nodeValue).join(''); },
    get innerText() { return el.textContent; },
    get innerHTML() {
      const markup = el.childNodes.map(rwSerialize).join('');
      snapshots.set(markup, el.childNodes.map(rwClone));
      return markup;
    },
    set innerHTML(markup) {
      el.innerHTMLWrites++;
      const nodes = snapshots.get(markup);
      rwSetChildren(el, nodes ? nodes.map(rwClone) : [rwText(markup)]);
    },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(el._attrs, name) ? el._attrs[name] : null; },
    setAttribute(name, value) { el._attrs[name] = String(value); },
    removeAttribute(name) { delete el._attrs[name]; if (name === 'title') el.title = ''; },
    matches(selector) { return dgNodeMatches(el, selector); },
    querySelector(selector) { return dgDescendantsMatching(el, selector)[0] || null; },
    querySelectorAll(selector) { return dgDescendantsMatching(el, selector); },
    contains(other) {
      for (let at = other; at; at = at.parentNode) if (at === el) return true;
      return false;
    },
    closest(selector) {
      for (let at = el; at && at.nodeType === 1; at = at.parentNode) if (dgNodeMatches(at, selector)) return at;
      return null;
    },
    getBoundingClientRect() { return { top: 10, left: 10, right: 410, bottom: 210, width: 400, height: 200 }; },
  };
  if (el.tagName === 'TABLE') {
    Object.defineProperty(el, 'rows', { get() { return dgDescendantsMatching(el, 'tr'); } });
  }
  if (el.tagName === 'TR') {
    Object.defineProperty(el, 'cells', {
      get() { return el.children.filter((c) => c.tagName === 'TD' || c.tagName === 'TH'); },
    });
  }
  rwSetChildren(el, children || []);
  return el;
}

// A cell's contents: a string is one text piece; an array lists pieces, each
// a string for a bare text piece or { tag, text } for a piece inside its own
// element.
function rwPieces(spec) {
  const items = Array.isArray(spec) ? spec : [spec];
  return items.map((item) => (typeof item === 'string'
    ? rwText(item)
    : rwEl(item.tag, {}, [rwText(item.text)])));
}

/**
 * Draw one table of either kind from the same rows. A native table holds a
 * head section for the header and a body for the rows; a grid holds its
 * header row outside a row group and its data rows inside it, or its data
 * rows alone with no header.
 *
 * @param {'native'|'grid'} kind
 * @param {Array<Array<string|Array>>} rows
 * @param {{header?: string[]}} [opts]
 */
function rwBuildTable(kind, rows, opts) {
  const header = (opts && opts.header) || null;
  const isNative = kind === 'native';
  const makeCell = (spec) => rwEl(isNative ? 'td' : 'div', isNative ? {} : { role: 'cell' }, rwPieces(spec));
  const makeRow = (specs) => rwEl(isNative ? 'tr' : 'div', isNative ? {} : { role: 'row' }, specs.map(makeCell));
  const dataRows = rows.map(makeRow);
  let body;
  let table;
  if (isNative) {
    body = rwEl('tbody', {}, dataRows);
    const head = header
      ? [rwEl('thead', {}, [rwEl('tr', {}, header.map((text) => rwEl('th', {}, [rwText(text)])))])]
      : [];
    table = rwEl('table', {}, head.concat([body]));
  } else {
    const headerRow = header
      ? [rwEl('div', { role: 'row' }, header.map((text) => rwEl('div', { role: 'columnheader' }, [rwText(text)])))]
      : [];
    body = header ? rwEl('div', { role: 'rowgroup' }, dataRows) : null;
    table = rwEl('div', { role: 'grid' }, header ? headerRow.concat([body]) : dataRows);
    if (!header) body = table;
  }
  const rowEl = (r) => body.children[r];
  const cell = (r, c) => rowEl(r).children[c];
  return {
    kind, table,
    cell,
    pieces: (r, c) => rwTextNodesOf(cell(r, c)),
    text: (r, c) => cell(r, c).textContent,
    // The page writes a new text into one piece of a cell, in place.
    write: (r, c, text, k) => { rwTextNodesOf(cell(r, c))[k || 0].nodeValue = text; },
    // The page redraws a cell's contents with new pieces, in place.
    redraw: (r, c, spec) => rwSetChildren(cell(r, c), rwPieces(spec)),
    addRow: (specs) => rwSetChildren(body, body.childNodes.concat([makeRow(specs)])),
    headerWrite: (c, text) => {
      const headerCells = isNative ? table.rows[0].cells : table.children[0].children;
      rwTextNodesOf(headerCells[c])[0].nodeValue = text;
    },
    rowTexts: () => body.children.map((row) => row.children.map((c) => c.textContent)),
  };
}

/**
 * Run one case against the page model: the observer stand-in, a fake clock
 * for every timer, and a tree walker over the model's text nodes.
 * page.advance(ms) delivers queued mutation records and runs every timer due
 * inside the window, in due order. page.passes() counts the re-apply timers
 * that ran: timers an observer callback scheduled.
 */
function withRewritePage(fn) {
  const saved = {
    MutationObserver: global.MutationObserver,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    now: Date.now,
    walker: global.document.createTreeWalker,
    createElement: global.document.createElement,
  };
  // No element factory, so the toast view draws nothing for the cap's
  // warning rows; the shape-change case supplies its own for the pillbox.
  delete global.document.createElement;
  const clock = { now: 5000000 };
  const timers = [];
  global.MutationObserver = RewriteObserver;
  global.setTimeout = (callback, ms) => {
    timers.push({ callback, due: clock.now + (ms || 0), cancelled: false, ran: false,
      fromObserver: rwDeliveringToObserver });
    return timers.length - 1;
  };
  global.clearTimeout = (id) => { if (timers[id]) timers[id].cancelled = true; };
  Date.now = () => clock.now;
  global.document.createTreeWalker = (root) => {
    const nodes = rwTextNodesOf(root);
    return { nextNode: () => nodes.shift() || null };
  };
  const page = {
    advance(ms) {
      const until = clock.now + ms;
      for (let guard = 0; guard < 100; guard++) {
        rwDeliverMutations();
        const due = timers.filter((t) => !t.cancelled && !t.ran && t.due <= until)
          .sort((a, b) => a.due - b.due)[0];
        if (!due) break;
        clock.now = Math.max(clock.now, due.due);
        due.ran = true;
        due.callback();
      }
      clock.now = until;
    },
    settle() { page.advance(3000); },
    passes: () => timers.filter((t) => t.ran && t.fromObserver).length,
    pendingPasses: () => timers.filter((t) => !t.ran && !t.cancelled && t.fromObserver).length,
    now: () => clock.now,
  };
  try {
    fn(page);
  } finally {
    global.MutationObserver = saved.MutationObserver;
    global.setTimeout = saved.setTimeout;
    global.clearTimeout = saved.clearTimeout;
    Date.now = saved.now;
    if (saved.walker === undefined) delete global.document.createTreeWalker;
    else global.document.createTreeWalker = saved.walker;
    if (saved.createElement !== undefined) global.document.createElement = saved.createElement;
    rwObservers.length = 0;
  }
}

// Run one case on each table kind, with the table's registry entry and
// every re-apply resource cleared afterwards.
function eachRewriteKind(kinds, run) {
  for (const kind of kinds) {
    withRewritePage((page) => {
      const tables = [];
      const build = (rows, opts) => { const t = rwBuildTable(kind, rows, opts); tables.push(t.table); return t; };
      try {
        run(kind, page, build);
      } catch (e) {
        eq(`#421 a case on the ${kind} kind runs without an exception`, String((e && e.stack) || e), null);
      } finally {
        for (const table of tables) {
          resetTable(table);
          forgetRegisteredTable(table);
        }
      }
    });
  }
}
