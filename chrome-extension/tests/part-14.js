// ---------------------------------------------------------------------------
// Issue #275: the context-menu toggle must go through the same controller
// branch a pill click uses. The right-click that opens the menu already
// connects the table (the contextmenu handler calls setSelectedTable), so
// with the sidebar open, "Toggle table" on that table must write the
// record and report it (state:tableEnabledChanged) — the #272 contract. Before the
// fix, intent:menuClicked simplified the table directly: the page changed,
// the settings record and the sidebar both went stale, and the next reopen or switch
// re-imposed the stale record. Fresh-eval fixture modeled on the
// double-invocation test above; same minimal grid, real captured handlers.
// ---------------------------------------------------------------------------
(function issue275_menuToggleOnConnectedTableWritesRecord() {
  function makeCell(text) { return { nodeType: 1, textContent: text, children: [] }; }
  function makeRow(texts) { return { nodeType: 1, className: 'row', children: texts.map(makeCell) }; }
  const rows = [
    makeRow(['A', '100']), makeRow(['B', '200']), makeRow(['C', '300']),
    makeRow(['D', '400']), makeRow(['E', '500']),
  ];
  const gridClassList = (() => {
    const c = [];
    return {
      add(x) { if (!c.includes(x)) c.push(x); },
      remove(x) { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
      contains(x) { return c.includes(x); },
    };
  })();
  const gridEl = {
    nodeType: 1, tagName: 'DIV', className: 'grid-wrapper', children: rows,
    classList: gridClassList, parentElement: null, parentNode: null,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 }; },
  };
  const clickTarget = {
    nodeType: 1, tagName: 'DIV', parentElement: gridEl, parentNode: gridEl,
    closest() { return null; },
  };

  function mockCreateElement(tag) {
    if (tag === 'button') {
      return {
        type: '', className: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
        addEventListener() {}, appendChild() {}, parentElement: null,
      };
    }
    return { className: '', style: {}, textContent: '', appendChild() {}, addEventListener() {} };
  }

  let contextmenuHandler = null;
  // Chrome hands an arriving message to every registered listener: the bus's
  // and the one content.js keeps for the requests.
  const messageListeners = [];
  const fireMessage = (msg) => messageListeners.forEach((fn) => fn(msg, {}, () => {}));
  const captureDoc = {
    addEventListener(type, handler) { if (type === 'contextmenu') contextmenuHandler = handler; },
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {}, observe() {} },
    head: { appendChild() {} },
    createElement: mockCreateElement,
  };
  const sentMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { messageListeners.push(fn); } },
      sendMessage(msg) { sentMessages.push(msg); },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedGCS = global.getComputedStyle;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.getComputedStyle = () => ({ display: 'flex' });

  try {
    eval(contentScriptBundle + `
      globalThis.__i275_DR_STORE = DR_STORE;
    `);
    const store = global.__i275_DR_STORE;

    eq('menu-toggle record: contextmenu handler was captured', typeof contextmenuHandler, 'function');
    eq('menu-toggle record: the bus registered its message listener', messageListeners.length, 1);
    if (typeof contextmenuHandler !== 'function' || messageListeners.length === 0) return;

    // The right-click that opens the menu: discovers, marks, and CONNECTS
    // the grid — exactly what a real menu use does before intent:menuClicked.
    contextmenuHandler({ target: clickTarget });
    eq('menu-toggle record: the right-click connected the grid',
      store.getSelectedTable(), gridEl);

    // The settings record starts at on, the table showing simplified values.
    store.setTableAppliedFlag(gridEl, 'simplified');
    eq('menu-toggle record: precondition — the record starts enabled',
      store.getSettings().enabled, true);

    sentMessages.length = 0;
    fireMessage({ action: 'intent:menuClicked' });

    eq('menu-toggle record: the menu toggle on the connected table writes the record\'s off',
      store.getSettings().enabled, false);
    const toggleMsgs = sentMessages.filter((m) => m.action === 'state:tableEnabledChanged');
    eq('menu-toggle record: the menu toggle reports the record to the panel — off',
      toggleMsgs.map((m) => m.enabled), [false]);
  } finally {
    delete global.__i275_DR_STORE;
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.getComputedStyle = savedGCS;
  }
})();

// ---------------------------------------------------------------------------
// Issue #272, leak 2: the #262 lock's forced ON must be display-only. The
// panel stashes the record's enabled when the lock engages, every save under
// the lock writes the stashed value (the sliders stay usable while locked),
// record changes landing under the lock update the stash, and lifting the
// lock puts the stashed value back on the switch. Before the fix, a save
// under the lock wrote the forced ON into the record — silently discarding
// the user's off — and the forced ON outlived the lock until the next pull.
// ---------------------------------------------------------------------------
(function issue272_saveUnderLockWritesTheRecordsEnabled() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-save: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-save: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // The module-level pull mirrored the model: enabled off.
    eq('lock-save: precondition — the switch mirrors the model\'s off',
      h.enabledEl.checked, false);
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    eq('lock-save: precondition — the lock forces the switch on',
      h.enabledEl.checked, true);

    // A save while locked — the granularity control's change listener runs
    // the same applyNow a slider drag ends in.
    h.tabMessages.length = 0;
    h.el('dateGranularity').fire('change');
    const applyMsg = h.tabMessages.find((m) => m.action === 'request:applySettings');
    eq('lock-save: the save reaches the wire', applyMsg !== undefined, true);
    eq('lock-save: a save under the lock writes the record\'s off — not the forced on',
      applyMsg && applyMsg.settings.enabled, false);
  } finally {
    h.restore();
  }
})();

(function issue272_lockLiftRestoresTheRecordsEnabled() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-lift: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-lift: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    h.dispatch({ action: 'state:applyOk' });
    eq('lock-lift: state:applyOk lifts the lock',
      h.bodyClasses.has('table-locked'), false);
    eq('lock-lift: state:applyOk re-enables the switch', h.enabledEl.disabled, false);
    eq('lock-lift: the switch returns to the record\'s off — the forced ON does not outlive the lock',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function issue272_recordChangesUnderLockAreDisplayOnlyAndTracked() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('locked toggle-state: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('locked toggle-state: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    h.dispatch({ action: 'state:tableEnabledChanged', enabled: false });
    eq('locked toggle-state: the switch stays forced on while locked — the record change is display-only',
      h.enabledEl.checked, true);
    h.dispatch({ action: 'state:tableEnabledChanged', enabled: true });
    h.dispatch({ action: 'state:applyOk' });
    eq('locked toggle-state: the lift shows the record\'s latest value (on)',
      h.enabledEl.checked, true);

    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    h.dispatch({ action: 'state:tableEnabledChanged', enabled: false });
    h.dispatch({ action: 'state:applyOk' });
    eq('locked toggle-state: the lift shows the record\'s latest value (off)',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

// A re-lock while already locked must keep the stash — never capture the
// forced ON. The real sequence: a save under the lock re-applies on the
// content side, the stuck table blocks again, and a second state:applyBlocked
// lands while the switch is already forced on. Without the engage-guard the
// stash becomes true and the next save writes the forced ON into the record
// — leak 2 verbatim, one message later.
(function issue272_reLockKeepsTheStash() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('re-lock: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('re-lock: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.dispatch({ action: 'state:applyBlocked', count: 1 }); // stash = model's off
    h.dispatch({ action: 'state:applyBlocked', count: 1 }); // re-lock: stash must survive
    h.tabMessages.length = 0;
    h.el('dateGranularity').fire('change');
    const applyMsg = h.tabMessages.find((m) => m.action === 'request:applySettings');
    eq('re-lock: a save after a second state:applyBlocked still writes the record\'s off',
      applyMsg && applyMsg.settings.enabled, false);
    h.dispatch({ action: 'state:applyOk' });
    eq('re-lock: the lift still shows the record\'s off',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

// Unbinding while locked (a save whose delivery fails runs setTableBound(false))
// must drop the stash with the lock. Without the clear, the stash outlives the
// lock and the next state:applyOk restores a stale ON over the no-table off.
(function issue272_unbindWhileLockedDropsTheStash() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('unbind-locked: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('unbind-locked: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // Drift the switch on, then lock — the stash captures the drifted on.
    h.enabledEl.checked = true;
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    // A save whose delivery fails: nothing answers applyNow's request, and it
    // unbinds the panel (setTableBound(false)) — lock and stash both go.
    h.chromeMock.runtime.lastError = { message: 'no receiving end' };
    h.el('dateGranularity').fire('change');
    h.chromeMock.runtime.lastError = null;
    eq('unbind-locked: the failed delivery unbinds and lifts the lock',
      h.bodyClasses.has('table-locked'), false);
    eq('unbind-locked: the no-table state forces the switch off',
      h.enabledEl.checked, false);
    h.dispatch({ action: 'state:applyOk' });
    eq('unbind-locked: a later state:applyOk does not resurrect the pre-unbind stash',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function issue272_pullUnderLockTracksTheRecord() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-pull-stash: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-pull-stash: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // Drift the switch on, then lock — the stash captures the drifted on.
    h.enabledEl.checked = true;
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    // A pull resolving under the lock reads the model's enabled:false. The
    // display must not change (pinned by the #251 lock-vs-pull test above);
    // the stash must track it so the lift shows the model, not the value
    // stashed at lock time.
    h.dispatch({ action: 'state:previewSamplesChanged' });
    eq('lock-pull-stash: the pull leaves the locked switch on (display-only)',
      h.enabledEl.checked, true);
    h.dispatch({ action: 'state:applyOk' });
    eq('lock-pull-stash: the lift shows the model\'s off from the pull, not the pre-lock drift',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

// --- capture: the displayed-text read and the plain-original-text read ---
//
// The capture records what the screen shows AND what each cell held before.
// Two reads serve it. (1) Adapter cells gain getDisplayedText(): the live
// rendered text, never the originals port — on a rounded grid getText()
// answers with the ORIGINAL (the engine's contract; see the port-preferring
// read in GridAdapter._makeCellObj), so a capture reading getText() would
// lie about the screen. (2) The registry stores a cell's original in two
// shapes (grid: { value, pieces, ... }; native: { html, value, ... });
// DR_STORE.getTableOriginalText() resolves the difference in one place and
// returns plain text for either kind, or undefined when nothing is stored.

(function captureDisplayedTextRead() {
  // Native cell: the displayed text is the live text — the same read
  // getText() uses, because the native write path never shadows it.
  const nativeCellEl = { tagName: 'TD', innerText: '1,234', textContent: '1,234' };
  const nativeStub = {
    rows: [{ parentElement: { tagName: 'TBODY' }, cells: [nativeCellEl] }],
  };
  const nativeCell = new NativeTableAdapter(nativeStub).getRows()[0].getCells()[0];
  eq('capture-reads: a native cell\'s displayed text is its live text',
    typeof nativeCell.getDisplayedText === 'function'
      ? nativeCell.getDisplayedText() : null,
    '1,234');

  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const makeGridCellEl = (text) => ({
    nodeType: 1,
    childNodes: [{ nodeType: 3, nodeValue: text }],
    classList: { add() {}, contains() { return false; } },
    // Like the DOM: textContent derives from the child nodes, so a
    // patch through nodeValue shows up in the whole-cell read.
    get textContent() { return this.childNodes[0].nodeValue; },
  });
  const adapter = new GridAdapter({}, { originalsPort: makePort() });

  // Grid cell, unrounded: displayed text equals the engine's read.
  const fresh = adapter._makeCellObj(makeGridCellEl('98,765'));
  eq('capture-reads: an unrounded grid cell\'s displayed text equals its engine text',
    typeof fresh.getDisplayedText === 'function'
      ? { displayed: fresh.getDisplayedText(), engine: fresh.getText() } : null,
    { displayed: '98,765', engine: '98,765' });

  // Grid cell, rounded: the engine's read answers with the original through
  // the port; the displayed read answers with what the screen shows now.
  const rounded = adapter._makeCellObj(makeGridCellEl('98,765'));
  rounded.applyPatches([{ index: 0, numStr: '98,765', newNum: '99,000' }]);
  eq('capture-reads: a rounded grid cell keeps engine text = original, displayed text = live',
    typeof rounded.getDisplayedText === 'function'
      ? { engine: rounded.getText(), displayed: rounded.getDisplayedText() } : null,
    { engine: '98,765', displayed: '99,000' });
})();

// A grid cell that builds its text from several pieces — a number and a unit
// in separate nodes — displays all of them. findCellTextNode answers with one
// deepest text node (the write path's patch target); the displayed-text read
// answers with the cell's whole text, matching the native read. Regression
// for #303: "1,234<span>%</span>" recorded text: "%".
(function captureDisplayedTextReadsWholeCell() {
  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const adapter = new GridAdapter({}, { originalsPort: makePort() });
  const textNode = (text) => ({ nodeType: 3, nodeValue: text });
  const span = (text) => ({ nodeType: 1, childNodes: [textNode(text)] });
  const makePiecedCellEl = (children, wholeText) => ({
    nodeType: 1,
    childNodes: children,
    classList: { add() {}, contains() { return false; } },
    textContent: wholeText,
  });

  const numberThenUnit = adapter._makeCellObj(
    makePiecedCellEl([textNode('1,234'), span('%')], '1,234%'));
  eq('capture-reads: a grid cell of number-then-unit pieces displays the whole text',
    numberThenUnit.getDisplayedText(), '1,234%');

  const unitThenNumber = adapter._makeCellObj(
    makePiecedCellEl([span('$'), textNode('1,234')], '$1,234'));
  eq('capture-reads: a grid cell of unit-then-number pieces displays the whole text',
    unitThenNumber.getDisplayedText(), '$1,234');
})();

(function capturePlainOriginalTextRead() {
  const has = typeof DR_STORE.getTableOriginalText === 'function';
  const table = {};
  const gridCell = {};
  const nativeCell = {};
  const stringCell = {};
  DR_STORE.setTableOriginal(table, gridCell,
    { value: '98,765', pieces: [{ text: '98,765', written: '100,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableOriginal(table, nativeCell,
    { value: '1,234', pieces: [{ text: '1,234', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableOriginal(table, stringCell, '55,000');
  eq('capture-reads: a grid original (record) reads back as its value field',
    has ? DR_STORE.getTableOriginalText(table, gridCell) : null, '98,765');
  eq('capture-reads: a plain-string original reads back as itself',
    has ? DR_STORE.getTableOriginalText(table, stringCell) : null, '55,000');
  eq('capture-reads: a native original (record) reads back as its value field',
    has ? DR_STORE.getTableOriginalText(table, nativeCell) : null, '1,234');
  eq('capture-reads: a cell with no stored original reads back undefined',
    has ? DR_STORE.getTableOriginalText(table, {}) : null, undefined);
  DR_STORE.unregisterTable(table);
})();

// --- lib/dr-capture: the capture state serializer ---
//
// collectCaptureState() turns the registry into the plain-value capture
// state: every registered table in full detail, plus the bound table's raw
// markup as the fixture seed. Dependencies arrive as parameters with working
// defaults (deps.store, deps.adapterFor), so these tests drive the function
// with stand-ins and no DOM. Locked honesty is pinned here: a cell wearing
// the rounded marker with no stored original serializes as original: null
// and flips the table's locked flag — never a reconstructed value.

(function captureStateSerializer() {
  eq('capture-state: collectCaptureState loads in the content-script bundle',
    typeof globalThis.collectCaptureState, 'function');
  if (typeof globalThis.collectCaptureState !== 'function') return;

  const markerClassList = (marked) => ({ contains: (c) => marked && c === 'dr-ext-rounded' });
  const makeCellEl = (marked) => ({ classList: markerClassList(marked) });

  // A fake store: tables and per-cell originals handed in as Maps.
  const makeFakeStore = (tables, opts) => ({
    getRegisteredTables: () => tables,
    getSelectedTable: () => (opts && opts.selected) || null,
    getSettings: () => ({ enabled: true, offsetTop: -0.5 }),
    getErrorState: () => (opts && opts.errorState) || { hasError: false, count: 0, rows: [] },
    getTableAppliedFlag: (t) => (opts && opts.flags && opts.flags.get(t)) || 'original',
    getTableRoundOptions: (t) => (opts && opts.roundOptions && opts.roundOptions.get(t)) || null,
    getTableMaxMagnitude: (t) => {
      const m = opts && opts.maxMags && opts.maxMags.get(t);
      return m === undefined ? null : m;
    },
    getTableOriginalText: (t, cellEl) =>
      opts && opts.originals ? opts.originals.get(cellEl) : undefined,
  });

  // A fake adapter factory: each table object carries its own row spec.
  const fakeAdapterFor = (table) => ({
    isVirtualized: () => !!table._virtualized,
    getRows: () => table._rows.map((row) => ({
      isOutside: !!row.isOutside,
      // columnIndex and columnSpan are part of the adapter's cell contract
      // (see assignGridColumns); this spec declares no merge, so each cell
      // sits at its read position and covers one column.
      getCells: () => row.cells.map((cell, c) => ({
        el: cell.el,
        tagName: cell.tagName || 'TD',
        columnIndex: c,
        columnSpan: 1,
        getDisplayedText: () => cell.text,
      })),
    })),
  });

  // Table A: native, simplified, one header row + one data row (ragged).
  const a1 = makeCellEl(true);
  const tableA = {
    outerHTML: '<table><tr><td>99,000</td></tr></table>',
    _rows: [
      { cells: [{ el: makeCellEl(false), tagName: 'TH', text: 'Amount' }] },
      { cells: [
        { el: a1, text: '99,000' },
        { el: makeCellEl(false), text: 'n/a' },
      ] },
      { isOutside: true, cells: [{ el: makeCellEl(false), text: 'Total' }] },
    ],
  };
  // Table B: virtualized grid, untouched.
  const tableB = {
    _virtualized: true,
    _rows: [{ cells: [{ el: makeCellEl(false), text: '42' }] }],
  };

  const originals = new Map([[a1, '98,765']]);
  const flags = new Map([[tableA, 'simplified']]);
  const roundOptions = new Map([[tableA, { offsetTop: -1, enabled: true }]]);
  const maxMags = new Map([[tableB, 4]]);
  const store = makeFakeStore([tableA, tableB],
    { selected: tableA, originals, flags, roundOptions, maxMags });

  const state = collectCaptureState({ store, adapterFor: fakeAdapterFor });

  eq('capture-state: the state carries its format version', state.captureFormat, 6);
  eq('capture-state: the settings record is carried verbatim',
    state.settings, { enabled: true, offsetTop: -0.5 });
  eq('capture-state: every registered table is serialized', state.tables.length, 2);
  eq('capture-state: the bound table is found by index', state.activeTableIndex, 0);
  eq('capture-state: the fixture seed is the bound table\'s markup at capture time, verbatim',
    state.fixtureSeed, '<table><tr><td>99,000</td></tr></table>');

  const recA = state.tables[0];
  eq('capture-state: per-table detail (kind, appliedFlag, lastRoundOptions, maxMagnitude, counts)',
    {
      kind: recA.kind, appliedFlag: recA.appliedFlag,
      lastRoundOptions: recA.lastRoundOptions, maxMagnitude: recA.maxMagnitude,
      rowCount: recA.rowCount, columnCount: recA.columnCount,
    },
    {
      kind: 'native', appliedFlag: 'simplified',
      lastRoundOptions: { offsetTop: -1, enabled: true }, maxMagnitude: null,
      rowCount: 3, columnCount: 2,
    });
  eq('capture-state: a header cell serializes with role th',
    recA.cells[0],
    { row: 0, col: 0, role: 'th', isOutside: false, text: 'Amount', original: null, wearsMarker: false });
  eq('capture-state: a simplified cell carries displayed text AND its original',
    recA.cells[1],
    { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765', wearsMarker: true });
  eq('capture-state: a cell with no stored original serializes original: null',
    recA.cells[2].original, null);
  eq('capture-state: an outside row keeps its flag',
    recA.cells[3].isOutside, true);
  eq('capture-state: a marked cell WITH its original does not lock the table',
    recA.locked, false);

  const recB = state.tables[1];
  eq('capture-state: a virtualized grid serializes as kind grid with its frozen magnitude',
    { kind: recB.kind, maxMagnitude: recB.maxMagnitude }, { kind: 'grid', maxMagnitude: 4 });

  // Locked honesty: the marker with no original behind it.
  const lockedCell = makeCellEl(true);
  const tableL = { _rows: [{ cells: [{ el: lockedCell, text: '99,000' }] }] };
  const lockedState = collectCaptureState({
    store: makeFakeStore([tableL], {}),
    adapterFor: fakeAdapterFor,
  });
  eq('capture-state: a rounded marker with no stored original locks the table and stays null',
    { locked: lockedState.tables[0].locked, original: lockedState.tables[0].cells[0].original },
    { locked: true, original: null });

  // Empty registry: an honest nothing.
  const emptyState = collectCaptureState({
    store: makeFakeStore([], {}),
    adapterFor: fakeAdapterFor,
  });
  eq('capture-state: an empty registry serializes as no tables, no focus, no seed',
    { tables: emptyState.tables, activeTableIndex: emptyState.activeTableIndex, fixtureSeed: emptyState.fixtureSeed },
    { tables: [], activeTableIndex: null, fixtureSeed: null });

  // A capture is a bug report: one table whose walk throws must not take
  // the whole capture down. It serializes as an error record instead.
  const throwingAdapterFor = () => ({
    isVirtualized: () => false,
    getRows: () => { throw new Error('hostile walk'); },
  });
  const errState = collectCaptureState({
    store: makeFakeStore([{}, tableB], {}),
    adapterFor: (t) => (t === tableB ? fakeAdapterFor(t) : throwingAdapterFor()),
  });
  eq('capture-state: a table whose walk throws serializes as an error record',
    {
      kind: errState.tables[0].kind,
      cells: errState.tables[0].cells,
      hasError: /hostile walk/.test(errState.tables[0].error),
    },
    { kind: 'unknown', cells: [], hasError: true });
  eq('capture-state: the tables after a throwing one still serialize in full',
    errState.tables[1].cells.length, 1);
})();

// The per-cell marker flag reaches the cell record (#304). The serializer
// already reads the rounded marker to compute the locked pairing; the
// renderer needs it per cell to tell a lost original (marker, original: null)
// from a cell that was never rounded (no marker, original: null).
(function captureStateCarriesMarkerFlag() {
  if (typeof globalThis.collectCaptureState !== 'function') return;

  const markerClassList = (marked) => ({ contains: (c) => marked && c === 'dr-ext-rounded' });
  const makeCellEl = (marked) => ({ classList: markerClassList(marked) });

  const marked = makeCellEl(true);
  const unmarked = makeCellEl(false);
  const lost = makeCellEl(true);
  const table = { _rows: [{ cells: [
    { el: marked, text: '99,000' },
    { el: unmarked, text: 'Amount' },
    { el: lost, text: '99,000' },
  ] }] };
  const store = {
    getRegisteredTables: () => [table],
    getSelectedTable: () => null,
    getSettings: () => ({}),
    getErrorState: () => ({ hasError: false, count: 0, rows: [] }),
    getTableAppliedFlag: () => 'simplified',
    getTableRoundOptions: () => null,
    getTableMaxMagnitude: () => null,
    getTableOriginalText: (t, cellEl) => (cellEl === marked ? '98,765' : undefined),
  };
  const adapterFor = () => ({
    isVirtualized: () => false,
    getRows: () => table._rows.map((row) => ({
      isOutside: false,
      getCells: () => row.cells.map((cell) => ({
        el: cell.el,
        tagName: 'TD',
        getDisplayedText: () => cell.text,
      })),
    })),
  });

  const cells = collectCaptureState({ store, adapterFor }).tables[0].cells;
  eq('capture-state: a marked cell record carries wearsMarker true beside its original',
    { wearsMarker: cells[0].wearsMarker, original: cells[0].original },
    { wearsMarker: true, original: '98,765' });
  eq('capture-state: an unmarked cell record carries wearsMarker false',
    { wearsMarker: cells[1].wearsMarker, original: cells[1].original },
    { wearsMarker: false, original: null });
  eq('capture-state: a lost original keeps the locked pairing readable per cell',
    { wearsMarker: cells[2].wearsMarker, original: cells[2].original },
    { wearsMarker: true, original: null });
})();

// --- content.js: the request:captureState topic ---
//
// The sidebar asks for the whole page-side half of a capture in one request.
// The answer is composed by buildCaptureStateResponse() — a named function
// the suite drives directly, because the bus's own listener is a no-op stub
// here (the established equivalent-path pattern, see the intent:closeSidebar
// note above). A source assertion pins that the responder exists and routes
// through it.

(function captureWireAction() {
  eq('capture-wire: buildCaptureStateResponse loads in the content-script bundle',
    typeof globalThis.buildCaptureStateResponse, 'function');
  eq('capture-wire: the responder answers request:captureState through buildCaptureStateResponse',
    /respond\('request:captureState'[\s\S]{0,200}buildCaptureStateResponse\(\)/.test(sourceByName('content.js') || ''),
    true);
  if (typeof globalThis.buildCaptureStateResponse !== 'function') return;

  // The shared DR_STORE still holds stub tables registered by earlier test
  // sections (the suite never unregisters them), so these assertions are
  // relative: no absolute table counts, and the focus assertions pin MY
  // table through activeTableIndex.
  const prevSelected = DR_STORE.getSelectedTable();

  // With no table bound: no lens preview, no seed, no focus — and the page
  // field and log snapshot still present.
  DR_STORE.setSelectedTable(null);
  const unboundResponse = buildCaptureStateResponse();
  eq('capture-wire: no table bound still answers with an honest unbound state',
    {
      captureFormat: unboundResponse.captureFormat,
      activeTableIndex: unboundResponse.activeTableIndex,
      fixtureSeed: unboundResponse.fixtureSeed,
      lensPreview: unboundResponse.lensPreview,
      tablesIsArray: Array.isArray(unboundResponse.tables),
    },
    { captureFormat: 6, activeTableIndex: null, fixtureSeed: null, lensPreview: null, tablesIsArray: true });
  eq('capture-wire: the response carries this context\'s log snapshot',
    Array.isArray(unboundResponse.log.entries) && unboundResponse.log.limit, 50);
  eq('capture-wire: collecting logs its own row, and that row lands in the capture',
    /capture state collected/.test(unboundResponse.log.entries.slice(-1)[0].text), true);
  eq('capture-wire: the page field exists even where location does not',
    'url' in unboundResponse.page && 'title' in unboundResponse.page, true);

  // With a real stub table registered and selected.
  const table = makeToggleTable([
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  table.outerHTML = '<table><tr><td>8,584,629</td><td>286</td></tr></table>';
  DR_STORE.registerTable(table);
  DR_STORE.setSelectedTable(table);
  try {
    const response = buildCaptureStateResponse();
    const mine = response.tables[response.activeTableIndex];
    eq('capture-wire: the bound table serializes in full and is the focus',
      {
        bound: response.activeTableIndex !== null,
        kind: mine.kind,
        cellTexts: mine.cells.map((c) => c.text),
      },
      { bound: true, kind: 'native', cellTexts: ['8,584,629', '286'] });
    eq('capture-wire: the fixture seed is the bound table\'s markup',
      response.fixtureSeed, '<table><tr><td>8,584,629</td><td>286</td></tr></table>');
    eq('capture-wire: the capture carries the lens preview',
      !!response.lensPreview && Array.isArray(response.lensPreview.samples.top), true);
  } finally {
    DR_STORE.setSelectedTable(prevSelected);
    DR_STORE.unregisterTable(table);
  }
})();

// --- lib/dr-capture: the capture file renderer ---
//
// buildCaptureDocument() is a pure string renderer: the whole capture state
// in, one self-contained HTML document out. The safety doctrine (after the
// model extension's, adapted for string assembly): every dynamic value
// passes through one escape on its way in; the file declares a CSP that
// forbids scripts and remote fetches; a hidden pre holds the full state as
// escaped JSON (a script-typed island would let an end-tag in a payload
// break out); and the capture carries the fixture seed twice — visible
// escaped text for reading, JSON for byte-exact trust. These tests attack
// the escaping with hostile payloads and round-trip the island.

(function captureRenderer() {
  eq('capture-render: the DR_CAPTURE package loads in the content-script bundle',
    typeof globalThis.DR_CAPTURE, 'object');
  eq('capture-render: manifest loads the dr-capture package whole and in order',
    contentScriptFiles.indexOf('lib/dr-capture/state.js') !== -1 &&
      contentScriptFiles.indexOf('lib/dr-capture/render.js') ===
        contentScriptFiles.indexOf('lib/dr-capture/state.js') + 1 &&
      contentScriptFiles.indexOf('lib/dr-capture/index.js') ===
        contentScriptFiles.indexOf('lib/dr-capture/render.js') + 1,
    true);
  const sidebarHtmlForCapture = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('capture-render: sidebar.html loads the dr-capture package before sidebar.js',
    ['lib/dr-capture/state.js', 'lib/dr-capture/render.js', 'lib/dr-capture/index.js']
      .every((f) => sidebarHtmlForCapture.indexOf(f) !== -1 &&
        sidebarHtmlForCapture.indexOf(f) < sidebarHtmlForCapture.indexOf('"sidebar.js"')),
    true);
  if (typeof globalThis.DR_CAPTURE !== 'object') return;

  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const filenameFor = DR_CAPTURE.filenameFor;
  const LOCKED_TEXT = 'This table\'s original values are no longer available. Reload the page to change it.';

  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: {
      url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z',
    },
    mark: 'looks-right',
    remarks: 'rounded to 99,000\nbut the page stayed 98,765',
    settings: { enabled: true },
    activeTableIndex: 0,
    tables: [{
      kind: 'native', appliedFlag: 'simplified', lastRoundOptions: { offsetTop: -0.5 },
      maxMagnitude: null, locked: false, rowCount: 2, columnCount: 1,
      cells: [
        { row: 0, col: 0, role: 'th', isOutside: false, text: 'Amount', original: null },
        { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765' },
      ],
    }],
    lensPreview: { samples: { top: [{ original: '98,765', num: 98765 }], bottom: [] }, maxMag: 4 },
    sidebarView: {
      enabled: true,
      switches: { simplifyMixedCells: true, simplifyDates: false },
      dateGranularity: 'year', timeGranularity: 'hour', rangeExpr: '',
      stops: [-2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1],
      topVal: -0.5, botVal: -0.5, coupled: true,
      status: '', noTable: false, locked: false,
      lensPreview: { top: ['98,765'], bottom: [] },
    },
    log: {
      content: {
        entries: [{ at: '2026-09-09T18:00:00.000Z', level: 'debug', text: 'apply ran' }],
        dropped: 0, limit: 50,
      },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
    fixtureSeed: '<table><tr><td>98,765</td></tr></table>',
  }, over || {});

  // Extract and parse the hidden JSON island the way a consuming tool does:
  // take the pre's text, undo the HTML escaping (ampersand last), JSON.parse.
  const islandJson = (docHtml) => {
    const m = docHtml.match(/<pre id="capture-state" hidden>([\s\S]*?)<\/pre>/);
    if (!m) return null;
    return JSON.parse(m[1]
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&'));
  };

  const html = buildCaptureDocument({ state: makeState(), lockedStatusText: LOCKED_TEXT });

// --- The capture rendering places a cell under its own column ---

(function theCaptureRenderingPlacesACellAtItsColumn() {
  // A total row merged across the first two columns: one header row of three
  // cells, then a row holding a label at column 0 and the total at column 2.
  const merged = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: {},
        maxMagnitude: null, locked: false, rowCount: 2, columnCount: 3,
        cells: [
          { row: 0, col: 0, role: 'th', isOutside: false, text: 'Product', original: null },
          { row: 0, col: 1, role: 'th', isOutside: false, text: 'Units', original: null },
          { row: 0, col: 2, role: 'th', isOutside: false, text: 'Revenue', original: null },
          { row: 1, col: 0, role: 'th', isOutside: false, text: 'Total', original: null },
          { row: 1, col: 2, role: 'td', isOutside: false, text: '1,000,000', original: '1,140,043' },
        ],
      }],
    }),
    lockedStatusText: '',
  });
  const rows = merged.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  eq('#330: a cell the state records at a later column renders under that column',
    rows[1], '<tr><th>Total</th><td></td><td class="cap-simplified" ' +
      'title="Original: 1,140,043">1,000,000</td></tr>');
  eq('#330: a row whose cells fill every column renders unchanged',
    rows[0], '<tr><th>Product</th><th>Units</th><th>Revenue</th></tr>');
})();

(function theCaptureRenderingPadsEveryRowToTheTableWidth() {
  // A total row merged across all three columns, and a row the state holds
  // no cell for at all.
  const padded = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: {},
        maxMagnitude: null, locked: false, rowCount: 3, columnCount: 3,
        cells: [
          { row: 0, col: 0, role: 'th', isOutside: false, text: 'Product', original: null },
          { row: 0, col: 1, role: 'th', isOutside: false, text: 'Units', original: null },
          { row: 0, col: 2, role: 'th', isOutside: false, text: 'Revenue', original: null },
          { row: 2, col: 0, role: 'th', isOutside: false, text: 'Total', original: null },
        ],
      }],
    }),
    lockedStatusText: '',
  });
  const rows = padded.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  eq('#330: the columns a merge covers render blank even at the table\'s right edge',
    rows[2], '<tr><th>Total</th><td></td><td></td></tr>');
  eq('#330: a row the state holds no cell for still renders',
    rows[1], '<tr><td></td><td></td><td></td></tr>');
})();

  eq('capture-render: the CSP forbids scripts and remote fetches',
    /http-equiv="Content-Security-Policy"[^>]*script-src 'none'/.test(html) &&
      /img-src data:/.test(html), true);
  // The capture is itself a page with a real table, and with file access
  // enabled Chrome injects the extension's content scripts into it. The
  // document element carries the capture marker so the content script
  // stands down on capture pages — otherwise the extension rounds the
  // capture's own table and the file misreports the evidence it holds.
  eq('capture-render: the document element carries the capture marker',
    /<html lang="en" data-dr-capture="1">/.test(html), true);
  eq('capture-render: the file carries no script element at all',
    html.toLowerCase().includes('<script'), false);
  eq('capture-render: the mark shows as its glyph and is stored as its token',
    html.includes('\u{1F44D}') && islandJson(html).mark, 'looks-right');
  // The visible word is derived from the token, so no second word list exists.
  eq('capture-render: the mark renders its word beside the glyph',
    html.includes('<span>Looks right</span>'), true);
  eq('capture-render: the island carries the remarks under the remarks key and no note key',
    islandJson(html).remarks === 'rounded to 99,000\nbut the page stayed 98,765' &&
      !('note' in islandJson(html)), true);
  eq('capture-render: header facts are present',
    ['https://www.example.com/prices', '2.1.50', 'test-platform', '2026-09-09T18:00:00.000Z']
      .every((s) => html.includes(s)), true);
  eq('capture-render: the remarks render under their label',
    html.includes('Remarks:') && html.includes('rounded to 99,000'), true);
  eq('capture-render: a simplified cell shows its value with the original on hover',
    /<td[^>]*title="Original: 98,765"[^>]*>99,000<\/td>/.test(html), true);
  eq('capture-render: the bound table renders a second time with the originals',
    /with the originals/.test(html) &&
      /<td[^>]*>98,765<\/td>/.test(html), true);
  eq('capture-render: the table renderings state the span limit',
    html.includes('Cell spans are not recorded') &&
      html.includes('the columns it covers render blank'), true);
  eq('capture-render: the likeness shows both thumbs when the lens control is coupled',
    (html.match(/class="cap-thumb/g) || []).length, 2);
  eq('capture-render: the coupled heading names the shared value',
    html.includes('Lens control (coupled, both at -0.5)'), true);
  eq('capture-render: the registry section lists every table with the bound one marked',
    /<h2>Registry<\/h2>/.test(html) &&
      /native[\s\S]{0,120}bound/.test(html), true);
  eq('capture-render: the retired word for the bound table never renders',
    /<b>focused<\/b>/.test(html) || /focused table/.test(html), false);
  eq('capture-render: the seed intro names the bound table and capture time',
    html.includes('bound table’s markup as it stood at capture time'), true);
  eq('capture-render: the footer names the state block without a how-to sentence',
    html.includes('holds the full capture state') &&
      !html.includes('To extract the state'), true);
  eq('capture-render: the island round-trips the whole state',
    islandJson(html).tables[0].cells[1],
    { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765' });

  // Hostile payloads: cell text and title attribute.
  const hostile = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: null,
        maxMagnitude: null, locked: false, rowCount: 1, columnCount: 1,
        cells: [{
          row: 0, col: 0, role: 'td', isOutside: false,
          text: '"><img src=x onerror=alert(1)>',
          original: 'a"b<c>&d\'e',
        }],
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: hostile cell text appears only escaped',
    hostile.includes('<img'), false);
  eq('capture-render: hostile cell text is still readable in its escaped form',
    hostile.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'), true);
  eq('capture-render: a hostile original cannot break out of the title attribute',
    /title="Original: a&quot;b&lt;c&gt;&amp;d&#39;e"/.test(hostile), true);

  // Hostile fixture seed: an end-tag for the island's own pre plus a script
  // element, with a carriage return JSON must carry byte-exact.
  const hostileSeed = '</pre><script>alert(1)</script>\r\n<table><tr><td>1</td></tr></table>';
  const seeded = buildCaptureDocument({
    state: makeState({ fixtureSeed: hostileSeed }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a hostile seed cannot break out of the island or add a script',
    seeded.toLowerCase().includes('<script'), false);
  eq('capture-render: the island returns the hostile seed byte-exact',
    islandJson(seeded).fixtureSeed, hostileSeed);

  // Locked table: the wording arrives as a value (no third copy) and renders.
  const locked = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: null,
        maxMagnitude: null, locked: true, rowCount: 1, columnCount: 1,
        cells: [{ row: 0, col: 0, role: 'td', isOutside: false, text: '99,000', original: null }],
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a locked table renders the locked wording passed in as a value',
    locked.includes('This table&#39;s original values are no longer available'), true);

  // Console section: both contexts labeled; an empty buffer is a finding.
  eq('capture-render: both log sections render, and an empty one says so',
    html.includes('Content script') && html.includes('Sidebar') &&
      html.includes('Nothing was logged.'), true);

  // No table bound: the capture stays honest instead of refusing.
  const unbound = buildCaptureDocument({
    state: makeState({ activeTableIndex: null, tables: [], fixtureSeed: null }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: an unbound capture says no table was bound',
    unbound.includes('No table was bound'), true);
  eq('capture-render: an unbound capture says it carries no fixture seed',
    unbound.includes('No fixture seed'), true);

  // Filename: compact date first (sorts by day), then the source, then the
  // time (a second capture is a new file), then the mark token, so a folder
  // listing shows each file's verdict without opening the file.
  const at = new Date(2026, 8, 9, 14, 5, 6);
  eq('capture-render: the filename is compact-date first, source-slugged, time, then the mark',
    filenameFor({ at, url: 'https://www.example.com/prices', mark: 'looks-right' }),
    'dr-capture-20260909-example-com-140506-looks-right.html');
  // A page opened from disk has no host; its file name stands in for it.
  eq('capture-render: a file URL names the page file without its extension',
    filenameFor({ at, url: 'file:///Users/me/Projects/tables.html', mark: 'not-sure' }),
    'dr-capture-20260909-tables-140506-not-sure.html');
  eq('capture-render: a percent-encoded file name decodes before slugging',
    filenameFor({ at, url: 'file:///Users/me/My%20Table.html', mark: 'looks-wrong' }),
    'dr-capture-20260909-my-table-140506-looks-wrong.html');
  eq('capture-render: a file URL with no file name gets the no-source slug',
    filenameFor({ at, url: 'file:///', mark: 'looks-wrong' }),
    'dr-capture-20260909-no-source-140506-looks-wrong.html');
  eq('capture-render: a capture with no page url gets the no-source slug',
    filenameFor({ at, url: null, mark: 'looks-wrong' }),
    'dr-capture-20260909-no-source-140506-looks-wrong.html');
  eq('capture-render: an unparsable url gets the no-source slug',
    filenameFor({ at, url: 'not a url', mark: 'looks-wrong' }),
    'dr-capture-20260909-no-source-140506-looks-wrong.html');
  eq('capture-render: each mark token ends the name before .html',
    ['looks-right', 'not-sure', 'looks-wrong'].map((mark) =>
      filenameFor({ at, url: 'https://example.com/', mark }).replace(/^.*-140506-/, '')),
    ['looks-right.html', 'not-sure.html', 'looks-wrong.html']);
  // The mark reaches the name through the same reducer as the source, so a
  // value outside the three tokens cannot carry a path separator into it.
  eq('capture-render: a mark outside the three tokens is reduced like the source',
    filenameFor({ at, url: 'https://example.com/', mark: '../x' }),
    'dr-capture-20260909-example-com-140506-x.html');
})();

// --- lib/dr-capture: the file reads top to bottom ---
//
// The header is a header: the title and a small muted list of facts. The
// mark and the remarks share the first section under it. The sidebar
// likeness comes before the bound table, so the file reads in the order a
// reader reconstructs the scene: what the controls said, then what the page
// showed. A thin line separates every top-level section. A reader hint (a
// note) is one size below the table text, italic, and opens with "Note: ",
// so it never reads as content; the lens preview lines are content.
(function captureLayout() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z' },
    mark: 'looks-wrong',
    remarks: 'the total rounded away',
    settings: { enabled: true },
    activeTableIndex: 0,
    tables: [{
      kind: 'native', appliedFlag: 'simplified', lastRoundOptions: { offsetTop: -0.5 },
      maxMagnitude: null, locked: false, rowCount: 2, columnCount: 1,
      cells: [
        { row: 0, col: 0, role: 'th', isOutside: false, text: 'Amount', original: null },
        { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765' },
      ],
    }],
    lensPreview: null,
    sidebarView: {
      enabled: true, switches: {}, dateGranularity: 'year', timeGranularity: 'hour',
      rangeExpr: '', stops: [-1, 0, 1], topVal: 0, botVal: 0, coupled: true,
      status: '', noTable: false, locked: false,
      lensPreview: { top: ['98,765'], bottom: [] },
    },
    log: {
      content: { entries: [], dropped: 0, limit: 50 },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
    fixtureSeed: '<table><tr><td>98,765</td></tr></table>',
  }, over || {});
  const html = buildCaptureDocument({ state: makeState(), lockedStatusText: '' });
  const header = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));

  // The whole header shape is pinned, so no sentence re-enters it unseen.
  eq('capture-render: the header holds the title and the meta list, and nothing else',
    /^<header><h1>[^<]*<\/h1><dl class="cap-meta">(?:<dt>[^<]*<\/dt><dd>[^<]*<\/dd>)+<\/dl>$/
      .test(header) && html.includes('.cap-meta { font-size: 12px'), true);
  eq('capture-render: the header carries neither the mark nor the remarks',
    header.includes('cap-mark') || header.includes('Remarks:'), false);
  eq('capture-render: the mark and the remarks share one section directly under the header',
    /<\/header><main><section class="cap-remarks"><p class="cap-mark">[\s\S]{0,120}<b>Remarks:<\/b> the total rounded away/
      .test(html), true);
  eq('capture-render: the mark renders its glyph and word in the remarks section',
    /<section class="cap-remarks"><p class="cap-mark">\u{1F44E} <span>Looks wrong<\/span>/u.test(html), true);
  const order = ['<h2>Sidebar</h2>', '<h2>Bound table</h2>', '<h2>Registry</h2>',
    '<h2>Detection settings</h2>', '<h2>Extension logs</h2>', '<h2>Fixture seed</h2>']
    .map((h) => html.indexOf(h));
  eq('capture-render: the file reads sidebar, bound table, registry, detection settings, logs, seed',
    order.every((i, n) => i !== -1 && (n === 0 || i > order[n - 1])), true);
  eq('capture-render: the likeness and the table no longer sit side by side',
    html.includes('cap-visual') || html.includes('Sidebar (rendered open)'), false);
  eq('capture-render: a thin line separates each top-level section',
    html.includes('main > section { border-top: 1px solid #ddd'), true);
  eq('capture-render: a note is one size below the table text, italic, and prefixed',
    html.includes('.cap-note { font-size: 13px; font-style: italic') &&
      html.includes('<p class="cap-note">Note: Hover a dotted cell to see its original.</p>'), true);
  eq('capture-render: every reader hint renders as a note',
    (html.match(/<p class="cap-note">Note: /g) || []).length, 4);
  const unbound = buildCaptureDocument({
    state: makeState({ activeTableIndex: null, tables: [], fixtureSeed: null }),
    lockedStatusText: '',
  });
  eq('capture-render: an unbound capture carries the one note that always applies',
    (unbound.match(/<p class="cap-note">Note: /g) || []).length === 1 &&
      unbound.includes('Note: Service worker rows are not captured.'), true);
  eq('capture-render: lens preview lines are content, not notes',
    /<div class="cap-band">98,765<\/div>/.test(html), true);
  eq('capture-render: an absence is never a note',
    unbound.includes('<p class="cap-empty">No table was bound'), true);
})();

// --- lib/dr-capture: the screenshot section ---
//
// The sidebar takes a screenshot of the bound tab at finish and hands the
// image to the renderer beside the state, never inside it: the state holds
// a small record (taken, format, size) and the JSON island stays small. The
// image reaches the file only as an image data URL; anything else, a failed
// take, or no record at all renders as an absence with its reason.
(function captureScreenshotSection() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z' },
    mark: 'looks-wrong', remarks: '', settings: { enabled: true }, detectionSettings: null,
    activeTableIndex: null, tables: [], lensPreview: null, fixtureSeed: null,
    sidebarView: null, errorState: null,
    log: { content: null, sidebar: { entries: [], dropped: 0, limit: 50 } },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
  }, over || {});
  const islandOf = (docHtml) => {
    const m = docHtml.match(/<pre id="capture-state" hidden>([\s\S]*?)<\/pre>/);
    return m ? m[1] : '';
  };
  const islandJson = (docHtml) => JSON.parse(islandOf(docHtml)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'));

  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==';
  const taken = { taken: true, format: 'jpeg', chars: jpeg.length };
  const html = buildCaptureDocument({
    state: makeState({ screenshot: taken }), lockedStatusText: '', screenshotDataUrl: jpeg,
  });
  eq('capture-render: the screenshot renders as an image from the data URL passed beside the state',
    html.includes('<img class="cap-shot" src="' + jpeg + '"'), true);
  eq('capture-render: the island carries the screenshot record and never the image data',
    islandJson(html).screenshot, taken);
  eq('capture-render: the island holds no image data',
    islandOf(html).includes('data:image'), false);
  const order = ['<h2>Sidebar</h2>', '<h2>Screenshot</h2>', '<h2>Bound table</h2>']
    .map((h) => html.indexOf(h));
  eq('capture-render: the Screenshot section sits between the sidebar likeness and the bound table',
    order.every((i, n) => i !== -1 && (n === 0 || i > order[n - 1])), true);
  eq('capture-render: the screenshot carries a note on what the image shows',
    /<img class="cap-shot"[^>]*>\s*<p class="cap-note">Note: The tab/.test(html), true);

  const failed = buildCaptureDocument({
    state: makeState({ screenshot: { taken: false, reason: 'activeTab was not granted' } }),
    lockedStatusText: '', screenshotDataUrl: null,
  });
  eq('capture-render: a failed screenshot renders as an absence with the reason',
    failed.includes('<p class="cap-empty">No screenshot: activeTab was not granted.</p>') &&
      !failed.includes('<img class="cap-shot"'), true);
  const absent = buildCaptureDocument({ state: makeState(), lockedStatusText: '' });
  eq('capture-render: an absent screenshot record renders as an absence',
    absent.includes('<p class="cap-empty">No screenshot was recorded.</p>') &&
      !absent.includes('<img class="cap-shot"'), true);

  // The image reaches the src attribute only as an image data URL: a
  // scheme, a quote, or an attribute cannot enter through the value.
  const hostile = ['javascript:alert(1)', 'data:text/html;base64,AAAA',
    'data:image/png;base64,AAAA" onerror="alert(1)', ''];
  const hostileOut = hostile.map((value) => buildCaptureDocument({
    state: makeState({ screenshot: taken }), lockedStatusText: '', screenshotDataUrl: value,
  }));
  eq('capture-render: a value outside the image data URL shape never reaches the img src',
    hostileOut.every((out) => !out.includes('<img class="cap-shot"') && !out.includes('onerror') &&
      !out.includes('javascript:') &&
      out.includes('No screenshot: the image data was not an image data URL.')), true);
  eq('capture-render: a png data URL renders like a jpeg one',
    buildCaptureDocument({
      state: makeState({ screenshot: { taken: true, format: 'png', chars: 26 } }),
      lockedStatusText: '', screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    }).includes('<img class="cap-shot" src="data:image/png;base64,iVBORw0KGgo="'), true);
})();

// --- lib/dr-capture: the renderer keeps the state's absences (#304) ---
//
// The state records three kinds of absence honestly; the page a human reads
// must present each as an absence, never as something it is not: a lost
// original never becomes a substituted value, an error record never becomes
// an empty table, a missing log snapshot never becomes an empty buffer. The
// glyph lookup resolves only the three mark words, so a hostile mark cannot
// pull a prototype property into the document.
(function captureRendererAbsenceHonesty() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const LOCKED_TEXT = 'This table\'s original values are no longer available. Reload the page to change it.';

  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z' },
    mark: 'looks-wrong',
    remarks: '',
    settings: { enabled: true },
    activeTableIndex: 0,
    tables: [],
    lensPreview: null,
    sidebarView: null,
    log: {
      content: { entries: [], dropped: 0, limit: 50 },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
    fixtureSeed: null,
  }, over || {});

  // A locked table: the marker with no original behind it. The originals view
  // renders the absence, never the displayed (rounded) value.
  const locked = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: null,
        maxMagnitude: null, locked: true, rowCount: 1, columnCount: 2,
        cells: [
          { row: 0, col: 0, role: 'td', isOutside: false,
            text: '99,000', original: null, wearsMarker: true },
          { row: 0, col: 1, role: 'td', isOutside: false,
            text: 'n/a', original: null, wearsMarker: false },
        ],
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  // The originals table alone: from its heading to its closing tag. The JSON
  // island later in the document carries the displayed value by design.
  const originalsTable = (locked.split('with the originals')[1] || '').split('</table>')[0];
  eq('capture-render: a lost original renders as lost, never as the displayed value',
    /original lost/.test(originalsTable) && !originalsTable.includes('99,000'), true);
  eq('capture-render: a never-rounded cell still shows its text in the originals view',
    originalsTable.includes('n/a'), true);

  // An error record on the bound table: a failure notice, not an empty table.
  const failed = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'unknown', appliedFlag: null, lastRoundOptions: null,
        maxMagnitude: null, locked: false, rowCount: null, columnCount: null,
        cells: [], error: 'hostile walk',
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  const boundHalf = failed.split('<h2>Registry')[0];
  eq('capture-render: an error record on the bound table renders as a failure notice with its error text',
    /serialization[\s\S]{0,40}failed/i.test(boundHalf) && boundHalf.includes('hostile walk'),
    true);
  eq('capture-render: an error record on the bound table renders no table and no null counts',
    failed.includes('<table class="cap-table">') || failed.includes('null row(s)'), false);

  // A missing log snapshot (the state pull failed) is distinct from an empty
  // buffer: the sidebar half here IS an empty buffer and keeps its sentence.
  const pullFailed = buildCaptureDocument({
    state: makeState({
      log: { content: null, sidebar: { entries: [], dropped: 0, limit: 50 } },
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a missing log snapshot renders as a failed state pull',
    pullFailed.includes('state pull failed'), true);
  eq('capture-render: an empty buffer keeps its own sentence beside a failed pull',
    pullFailed.includes('Nothing was logged.'), true);

  // The glyph lookup resolves only the three mark words: a prototype property
  // name must not reach the document as a glyph.
  const hostileMark = buildCaptureDocument({
    state: makeState({ mark: 'constructor' }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a mark outside the three words resolves no glyph',
    hostileMark.includes('[native code]'), false);
  eq('capture-render: the hostile mark word still renders escaped as text',
    hostileMark.includes('<span>constructor</span>'), true);
})();

// --- lib/dr-capture: the size warning (#306) ---
//
// A capture has no size bound — the full-detail default is deliberate — so
// the form shows an estimate before the save when the pulled state is
// large. The estimate reads the serialized state's length; the file runs
// about four times that, because it carries the same content about four
// times (two table renderings, the JSON island, the visible seed).

(function captureSizeWarningHelper() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const sizeWarning = DR_CAPTURE.sizeWarning;
  const has = typeof sizeWarning === 'function';

  const small = { tables: [{ cells: [{ text: '99,000' }] }] };
  eq('capture-size: an ordinary state gets no warning',
    has ? sizeWarning(small) : 'missing', null);

  // 2,000,000 serialized characters estimate an 8 MB file.
  const big = { filler: 'x'.repeat(2 * 1000 * 1000) };
  eq('capture-size: a large state gets a warning that says the estimated size',
    has ? sizeWarning(big) : 'missing',
    'This capture will be large: about 8 MB.');

  // Just under the threshold (a 4 MB estimate): still no warning.
  const nearlyBig = { filler: 'x'.repeat(999 * 1000) };
  eq('capture-size: a state just under the threshold gets no warning',
    has ? sizeWarning(nearlyBig) : 'missing', null);
})();

(function captureSizeNoteGlue() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  eq('capture-size: the form holds a hidden size note',
    /<div[^>]*id="captureSizeNote"[^>]*hidden/.test(sidebarHtmlSrc), true);
  eq('capture-size: opening the form measures the pulled state through the package helper',
    sidebarJsSrc.includes('DR_CAPTURE.sizeWarning(') &&
      sidebarJsSrc.includes('captureSizeNote'), true);
  eq('capture-size: a failed save reports on the status line and is logged',
    sidebarJsSrc.includes('Capture failed') &&
      /DR_LOG\.warn\([^)]*save failed/.test(sidebarJsSrc), true);
})();

// --- sidebar: the capture section and its glue ---
//
// The suite never executes sidebar.js (it is asserted as source text — the
// established style for sidebar wiring), so these tests pin the markup and
// the glue's load-bearing seams: the three mark buttons, the form that
// nothing saves without, the one save path, and the state pull.

(function captureSidebarSection() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  eq('capture-ui: sidebar.html carries the capture section with three mark buttons',
    sidebarHtmlSrc.includes('id="captureSection"') &&
      ['data-mark="looks-right"', 'data-mark="not-sure"', 'data-mark="looks-wrong"']
        .every((m) => sidebarHtmlSrc.includes(m)),
    true);
  eq('capture-ui: the remarks form starts hidden and holds one remarks field and both buttons',
    /<div[^>]*id="captureForm"[^>]*hidden/.test(sidebarHtmlSrc) &&
      ['id="captureRemarks"', 'id="captureSave"', 'id="captureCancel"']
        .every((id) => sidebarHtmlSrc.includes(id)) &&
      !sidebarHtmlSrc.includes('id="captureExpected"'),
    true);
  eq('capture-ui: the remarks preview text follows the mark',
    ['Suggestions / questions / remarks', 'expected / observed / cause (if known)']
      .every((hint) => sidebarJsSrc.includes(hint)) &&
      /placeholder/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the glue asks for the capture state over request:captureState',
    sidebarJsSrc.includes("DR_BUS.request('request:captureState'"), true);
  eq('capture-ui: exactly one save path creates the blob URL',
    (sidebarJsSrc.match(/createObjectURL/g) || []).length, 1);
  eq('capture-ui: nothing saves without a pressed mark',
    /function saveCapture\(\)[\s\S]{0,200}if \(captureMark === null\) return;/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the renderer receives the locked wording as a value, not a copy',
    /buildCaptureDocument\(\{[\s\S]{0,120}lockedStatusText: APPLY_BLOCKED_STATUS_MSG/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the filename comes from the package helper and carries the mark',
    /DR_CAPTURE\.filenameFor\(\{[^}]*mark: mark/.test(sidebarJsSrc), true);
  eq('capture-ui: the sidebar\'s own log snapshot travels beside the content script\'s',
    /sidebar: DR_LOG\.snapshot\(\)/.test(sidebarJsSrc), true);
  eq('capture-ui: an unanswered state request still saves and records the failure',
    /DR_LOG\.warn\([^)]*went unanswered/.test(sidebarJsSrc), true);
  const saveBody = (sidebarJsSrc.match(/function saveCapture\(\)[\s\S]*?\n\}/) || [''])[0];
  eq('capture-ui: finish takes the screenshot beside the state pull and the save waits for both',
    saveBody.includes("DR_BUS.request('request:captureState'") &&
      saveBody.includes('takeCaptureScreenshot(chrome.tabs, boundTab.windowId()') &&
      (saveBody.match(/assembleAndSaveCapture\(/g) || []).length === 1, true);
  eq('capture-ui: the renderer receives the image beside the state, never inside it',
    /buildCaptureDocument\(\{[\s\S]{0,200}screenshotDataUrl:/.test(sidebarJsSrc) &&
      /state\.screenshot = /.test(sidebarJsSrc) &&
      !/state\.screenshotDataUrl/.test(sidebarJsSrc), true);
})();

// --- sidebar: the screenshot take never blocks the save ---
//
// takeCaptureScreenshot takes its tabs interface as a parameter and answers
// through one callback, so the suite drives the real source with a stub
// that settles at once. Every route — a resolved take, a rejected one, a
// throw before the promise exists, a tabs interface with no capture — calls
// the callback exactly once, with the image or with a not-taken record that
// holds the reason.
(function captureScreenshotTake() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const source = sidebarSrc.match(/function takeCaptureScreenshot\([\s\S]*?\n\}/);
  eq('capture-shot: takeCaptureScreenshot extracted from sidebar.js', !!source, true);
  if (!source) return;
  const warned = [];
  const logStub = { warn: (text) => { warned.push(text); }, debug: () => {} };
  // The quality constant sits beside the take in the source; the take reads
  // it as a bare name, so the extracted function receives it the same way.
  const quality = sidebarSrc.match(/const CAPTURE_SCREENSHOT_QUALITY = (\d+);/);
  eq('capture-shot: the quality constant sits beside the take', !!quality, true);
  const take = (new Function('DR_LOG', 'CAPTURE_SCREENSHOT_QUALITY', 'return ' + source[0] + ';'))(
    logStub, quality ? Number(quality[1]) : 0);

  const drive = (tabsApi, windowId) => {
    const results = [];
    take(tabsApi, windowId, (result) => { results.push(result); });
    return results;
  };
  const settled = (value) => ({ then(ok) { ok(value); } });
  const rejected = (error) => ({ then(ok, fail) { fail(error); } });

  const okArgs = [];
  const ok = drive({ captureVisibleTab: (...args) => { okArgs.push(args); return settled('data:image/jpeg;base64,AAAA'); } }, 7);
  eq('capture-shot: a resolved take yields the data URL and a taken record with its char count',
    ok, [{ dataUrl: 'data:image/jpeg;base64,AAAA',
      record: { taken: true, format: 'jpeg', chars: 'data:image/jpeg;base64,AAAA'.length } }]);
  eq('capture-shot: the take passes jpeg at quality 85 and the window it was given',
    okArgs, [[7, { format: 'jpeg', quality: 85 }]]);

  const noWindowArgs = [];
  drive({ captureVisibleTab: (...args) => { noWindowArgs.push(args); return settled('data:image/jpeg;base64,AAAA'); } }, null);
  eq('capture-shot: with no window the take omits the window argument',
    noWindowArgs, [[{ format: 'jpeg', quality: 85 }]]);

  const failed = drive({ captureVisibleTab: () => rejected(new Error('activeTab missing')) }, 7);
  eq('capture-shot: a rejected take yields a not-taken record with the reason and no data URL',
    failed, [{ dataUrl: null, record: { taken: false, reason: 'activeTab missing' } }]);
  eq('capture-shot: a rejected take logs a warn row',
    warned.length === 1 && /screenshot failed \(activeTab missing\)/.test(warned[0]), true);

  const threw = drive({ captureVisibleTab: () => { throw new Error('no permission'); } }, 7);
  eq('capture-shot: a take that throws before returning yields a not-taken record',
    threw, [{ dataUrl: null, record: { taken: false, reason: 'no permission' } }]);

  const missing = drive({}, 7);
  eq('capture-shot: a missing capture function yields a not-taken record',
    missing.length === 1 && missing[0].dataUrl === null && missing[0].record.taken === false &&
      typeof missing[0].record.reason === 'string' && missing[0].record.reason.length > 0, true);

  const empty = drive({ captureVisibleTab: () => settled('') }, 7);
  eq('capture-shot: a take that answers with no image yields a not-taken record',
    empty.length === 1 && empty[0].dataUrl === null && empty[0].record.taken === false, true);
})();

// --- capture follow-ups: the pull guard, the glyph pin, the header line ---

// #305: the serializer guards per table; the response composer's
// lens-preview step is the one step after it that walks the bound table.
// Unguarded, a throw there discards the whole page-side half — the
// serialized registry, the fixture seed, and the log rows.
(function capturePullSurvivesThrowingPreview() {
  if (typeof globalThis.buildCaptureStateResponse !== 'function') return;
  const prevSelected = DR_STORE.getSelectedTable();
  const throwing = {
    get rows() { throw new Error('hostile preview walk'); },
  };
  DR_STORE.registerTable(throwing);
  DR_STORE.setSelectedTable(throwing);
  let response = null;
  let threw = false;
  try {
    response = buildCaptureStateResponse();
  } catch (e) {
    threw = true;
  } finally {
    DR_STORE.setSelectedTable(prevSelected);
    DR_STORE.unregisterTable(throwing);
  }
  eq('capture-wire: a throwing lens preview keeps the page-side half',
    {
      threw,
      tablesIsArray: !!response && Array.isArray(response.tables),
      lensPreview: response ? response.lensPreview : 'response lost',
      hasLog: !!(response && response.log),
    },
    { threw: false, tablesIsArray: true, lensPreview: null, hasLog: true });
  eq('capture-wire: the discarded lens preview leaves a warn row',
    DR_LOG.snapshot().entries.some(
      (row) => row.level === 'warn' && /lens preview/.test(row.text)),
    true);
})();

// #308: the mark glyphs live in two machine copies — the sidebar's buttons
// and the renderer's map — and one copy cannot read the other (static
// markup against a content-script constant). This pin holds them together:
// a glyph change that lands in one place fails here, naming the other.
(function captureGlyphCopiesMatch() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const buttonGlyphs = {};
  const buttonRe = /data-mark="([a-z-]+)"[^>]*>([^<]+)</g;
  let m;
  while ((m = buttonRe.exec(sidebarHtmlSrc)) !== null) {
    buttonGlyphs[m[1]] = m[2].replace(/&#(\d+);/g,
      (_, code) => String.fromCodePoint(Number(code)));
  }
  eq('capture-glyphs: the sidebar buttons and the renderer map carry the same three glyphs',
    buttonGlyphs, CAPTURE_MARK_GLYPHS);
  // The button title is the mark's word for the sidebar; the renderer derives
  // the same word from the token, so the two surfaces stay in step.
  const buttonTitles = {};
  const titleRe = /data-mark="([a-z-]+)"[^>]*title="([^"]+)"/g;
  while ((m = titleRe.exec(sidebarHtmlSrc)) !== null) buttonTitles[m[1]] = m[2];
  const rendererLabels = {};
  Object.keys(CAPTURE_MARK_GLYPHS).forEach((token) => {
    rendererLabels[token] = DR_CAPTURE.markLabel(token);
  });
  eq('capture-glyphs: the sidebar button titles match the renderer\'s mark words',
    buttonTitles, rendererLabels);
  eq('capture-glyphs: a token outside the three renders as itself',
    DR_CAPTURE.markLabel('constructor'), 'constructor');
})();

// The header once stated what the file holds (#310). The product owner
// retired the line as stating the obvious; this pin keeps it out.
(function captureHeaderCarriesNoCaveat() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const html = DR_CAPTURE.buildCaptureDocument({
    state: {
      captureFormat: 6,
      meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
      mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
      tables: [], lensPreview: null, sidebarView: null,
      log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
    },
    lockedStatusText: '',
  });
  eq('capture-header: the header carries no share caveat',
    html.includes('Share it as you would share the page.'), false);
})();

// --- lib/dr-capture: the detection settings in force at capture time (D8) ---
//
// The capture state gains a detectionSettings field: a plain copy of DR_DETECTION_SETTINGS taken at
// capture time, so a capture shows the detection values that were in force.

// Criterion 1: collectCaptureState carries every key of the detection settings,
// the format version moves to 2, and the copy is plain and detached — a
// mutation on the returned copy must never reach DR_DETECTION_SETTINGS itself.
(function captureStateCarriesDetectionSettings() {
  eq('capture-settings: collectCaptureState loads in the content-script bundle',
    typeof globalThis.collectCaptureState, 'function');
  if (typeof globalThis.collectCaptureState !== 'function') return;

  const makeFakeStore = () => ({
    getRegisteredTables: () => [],
    getSelectedTable: () => null,
    getSettings: () => ({}),
    getErrorState: () => ({ hasError: false, count: 0, rows: [] }),
    getTableAppliedFlag: () => 'original',
    getTableRoundOptions: () => null,
    getTableMaxMagnitude: () => null,
    getTableOriginalText: () => undefined,
  });
  const fakeAdapterFor = () => ({ isVirtualized: () => false, getRows: () => [] });

  const state = collectCaptureState({ store: makeFakeStore(), adapterFor: fakeAdapterFor });

  eq('capture-settings: the capture state carries every key of the detection settings, with the values in force',
    state.detectionSettings, DR_DETECTION_SETTINGS);
  eq('capture-settings: the state\'s captureFormat equals CAPTURE_FORMAT',
    state.captureFormat, CAPTURE_FORMAT);
  eq('capture-settings: CAPTURE_FORMAT is 6',
    CAPTURE_FORMAT, 6);
  eq('capture-settings: the returned copy is not the same object as DR_DETECTION_SETTINGS',
    state.detectionSettings !== DR_DETECTION_SETTINGS, true);

  // Adversarial: mutate the returned copy and confirm the live block holds.
  const originalDisplayValuesLength = DR_DETECTION_SETTINGS.gridDisplayValues.length;
  const originalMinChildren = DR_DETECTION_SETTINGS.gridMinChildren;
  const originalFirstVendorName = DR_DETECTION_SETTINGS.vendorProfiles[0].name;

  state.detectionSettings.gridDisplayValues.push('mutated-by-test');
  state.detectionSettings.gridMinChildren = 999999;
  state.detectionSettings.vendorProfiles[0].name = 'mutated-by-test';

  eq('capture-settings: pushing onto the returned copy\'s list leaves DR_DETECTION_SETTINGS\'s list unchanged',
    DR_DETECTION_SETTINGS.gridDisplayValues.length, originalDisplayValuesLength);
  eq('capture-settings: changing a scalar on the returned copy leaves DR_DETECTION_SETTINGS\'s scalar unchanged',
    DR_DETECTION_SETTINGS.gridMinChildren, originalMinChildren);
  eq('capture-settings: changing a nested profile field on the returned copy leaves DR_DETECTION_SETTINGS\'s profile unchanged',
    DR_DETECTION_SETTINGS.vendorProfiles[0].name, originalFirstVendorName);
})();

// Criterion 2: the rendered file shows the detection settings in its visible
// half — a scalar, every item of a display-value list, and a vendor
// profile's name and selector — and a hostile value in a profile field
// reaches the visible half only in its escaped form.
(function captureDetectionSettingsSectionRendersValues() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;

  const baseState = (detectionSettings) => ({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
    mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
    tables: [], lensPreview: null, sidebarView: null,
    log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
    detectionSettings,
  });
  const visibleHalf = (html) => html.slice(0, html.indexOf('id="capture-state"'));

  const settings = {
    exampleScalarSetting: 4242,
    exampleDisplayValues: ['north-list-value', 'south-list-value'],
    exampleVendorProfiles: [{
      name: 'north-vendor',
      classToken: 'nv--',
      scrollContainerSelectors: ['.nv--scroll-container'],
      pinnedPaneSelectors: ['.nv--pinned-pane'],
    }],
  };
  const visible = visibleHalf(buildCaptureDocument({ state: baseState(settings), lockedStatusText: '' }));

  eq('capture-settings: a scalar detection setting renders in the visible half',
    visible.includes('4242'), true);
  eq('capture-settings: every item of a display-value list renders in the visible half',
    visible.includes('north-list-value') && visible.includes('south-list-value'), true);
  eq('capture-settings: a vendor profile\'s name renders in the visible half',
    visible.includes('north-vendor'), true);
  eq('capture-settings: a vendor profile\'s selector renders in the visible half',
    visible.includes('.nv--scroll-container'), true);

  // Hostile half: a profile name and a selector each carrying <script>, a
  // double quote, and an ampersand must reach the visible half escaped only.
  const hostileSettings = {
    exampleScalarSetting: 'one<script>alert(3)</script>"&',
    exampleDisplayValues: ['.list<script>alert(4)</script>"&item'],
    exampleVendorProfiles: [{
      name: 'north<script>alert(1)</script>"&vendor',
      classToken: 'nv--',
      scrollContainerSelectors: ['.nv--<script>alert(2)</script>"&pane'],
      pinnedPaneSelectors: [],
    }],
  };
  const hostileVisible = visibleHalf(
    buildCaptureDocument({ state: baseState(hostileSettings), lockedStatusText: '' }));

  eq('capture-settings: a hostile profile field never renders a literal script tag in the visible half',
    hostileVisible.toLowerCase().includes('<script>'), false);
  eq('capture-settings: a hostile profile field renders its angle brackets escaped',
    hostileVisible.includes('&lt;script&gt;') && hostileVisible.includes('&lt;/script&gt;'), true);
  eq('capture-settings: a hostile profile field renders its double quote escaped',
    hostileVisible.includes('&quot;'), true);
  eq('capture-settings: a hostile profile field renders its ampersand escaped',
    hostileVisible.includes('&amp;'), true);
})();

// Criterion 3: a state with no detectionSettings field (null, or the key absent) does
// not throw, renders the absence placeholder in the detection settings section, and the
// header still states the format version — the capture still saves. The
// sidebar side: assembleAndSaveCapture's fallback state carries
// detectionSettings: null, so a failed state pull renders the absence honestly rather
// than losing the field.
(function captureDetectionSettingsAbsenceHonesty() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;

  const baseState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
    mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
    tables: [], lensPreview: null, sidebarView: null,
    log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
  }, over || {});
  const visibleHalf = (html) => html.slice(0, html.indexOf('id="capture-state"'));

  let threwWithNull = false;
  let htmlWithNull = '';
  try {
    htmlWithNull = buildCaptureDocument({ state: baseState({ detectionSettings: null }), lockedStatusText: '' });
  } catch (e) {
    threwWithNull = true;
  }
  eq('capture-settings: a null detectionSettings field does not throw while building the document',
    threwWithNull, false);

  const stateWithAbsentSettings = baseState({});
  delete stateWithAbsentSettings.detectionSettings;
  let threwWithAbsent = false;
  let htmlWithAbsent = '';
  try {
    htmlWithAbsent = buildCaptureDocument({ state: stateWithAbsentSettings, lockedStatusText: '' });
  } catch (e) {
    threwWithAbsent = true;
  }
  eq('capture-settings: a state with the detectionSettings field absent does not throw while building the document',
    threwWithAbsent, false);

  eq('capture-settings: a null detectionSettings field renders the absence placeholder in the detection settings section',
    /<h2>Detection settings<\/h2>[\s\S]{0,80}—/.test(visibleHalf(htmlWithNull)), true);
  eq('capture-settings: an absent detectionSettings field renders the absence placeholder in the detection settings section',
    /<h2>Detection settings<\/h2>[\s\S]{0,80}—/.test(visibleHalf(htmlWithAbsent)), true);
  eq('capture-settings: the format version still prints in the header when detectionSettings is absent',
    /<dt>Capture format<\/dt><dd>6<\/dd>/.test(visibleHalf(htmlWithAbsent)), true);

  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const fnStart = sidebarJsSrc.indexOf('function assembleAndSaveCapture');
  const fnBody = fnStart === -1 ? '' : sidebarJsSrc.slice(fnStart, sidebarJsSrc.indexOf('\nfunction ', fnStart + 1));
  eq('capture-settings: assembleAndSaveCapture\'s fallback state carries detectionSettings: null',
    fnStart !== -1 && /detectionSettings:\s*null/.test(fnBody), true);
})();

// Criterion 4: the living docs name the detection settings in the capture
// paragraph or row a reader would consult — the README's capture section,
// the design doc's Capture paragraph, and the vocabulary's capture state
// row — loose enough to survive rewording, tight enough to fail if the
// mention is dropped.
(function captureDetectionSettingsLivingDocsNameTheTerm() {
  const readmeMd = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');

  const readmeCaptureSection = (readmeMd.split('\n## Capture\n')[1] || '').split('\n## ')[0];
  eq('living docs: chrome-extension/README.md\'s capture paragraph names the detection settings',
    readmeCaptureSection.includes('detection settings'), true);

  const designCaptureParagraph = designMd.split('\n').find((line) => line.startsWith('**Capture.**')) || '';
  eq('living docs: docs/design.md\'s Capture paragraph names the detection settings',
    designCaptureParagraph.includes('detection settings'), true);

  const vocabularyCaptureStateRow = vocabularyMd.split('\n').find((line) => line.startsWith('| capture state |')) || '';
  eq('living docs: docs/vocabulary.md\'s capture state row names the detection settings',
    vocabularyCaptureStateRow.includes('detection settings'), true);
})();

// Criterion 5: the detection settings section sits in the visible half under its own
// heading, ahead of the hidden capture-state JSON block, so a reader finds
// it while scanning the file rather than only in the JSON.
(function captureDetectionSettingsHeadingPrecedesStateBlock() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const html = DR_CAPTURE.buildCaptureDocument({
    state: {
      captureFormat: 6,
      meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
      mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
      tables: [], lensPreview: null, sidebarView: null,
      log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
      detectionSettings: { exampleScalarSetting: 1 },
    },
    lockedStatusText: '',
  });
  const headingMatch = /<h2>Detection settings<\/h2>/.exec(html);
  const stateBlockIndex = html.indexOf('id="capture-state"');
  eq('capture-settings: the visible half carries the Detection settings heading',
    headingMatch !== null, true);
  eq('capture-settings: the detection settings heading sits before the hidden capture-state block',
    headingMatch !== null && stateBlockIndex !== -1 && headingMatch.index < stateBlockIndex, true);
})();

// --- content.js: the extension stands down on capture pages ---
//
// A saved capture holds a real table; opened with file access enabled, the
// content script runs on it like on any page. The renderer stamps
// data-dr-capture on the document element, and the controller gates its two
// entry points on that marker — the contextmenu handler (selection and the
// menu path) and the load-time scan with its added-node observer (pillboxes
// and registration). With neither, no table on a capture page is ever
// selected, registered, or rounded. Source-text assertions, matching the
// suite's style for load-time wiring the harness cannot re-run.

(function captureMarkerStandDown() {
  const src = sourceByName('content.js') || '';
  eq('capture-marker: the controller reads the capture marker once',
    /const IS_CAPTURE_PAGE = [\s\S]{0,220}drCapture/.test(src), true);
  eq('capture-marker: the contextmenu handler stands down on a capture page',
    /contextmenu[\s\S]{0,120}if \(IS_CAPTURE_PAGE\) return;/.test(src), true);
  eq('capture-marker: the load-time scan and observer stand down on a capture page',
    /typeof MutationObserver !== 'undefined' && !IS_CAPTURE_PAGE/.test(src), true);
})();

// --- lib/dr-log: the log buffer ---
//
// DR_LOG holds the last 50 rows the extension records, one instance per
// context (content script and sidebar each evaluate the file separately).
// Every capture carries a snapshot of this buffer, so these tests pin the
// row shape, the cap, the drop counter, the console forwarding, and the
// snapshot's copy semantics. The buffer is a singleton shared with every
// other test in this file, so all assertions here are relative (last row,
// before/after counts) — and the cap test runs last because it fills it.

(function drLogBuffer() {
  eq('dr-log: DR_LOG loads in the content-script bundle',
    typeof globalThis.DR_LOG, 'object');
  eq('dr-log: manifest loads lib/dr-log/index.js directly after constants.js',
    contentScriptFiles[1], 'lib/dr-log/index.js');
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('dr-log: sidebar.html loads lib/dr-log/index.js before sidebar.js',
    sidebarHtml.indexOf('lib/dr-log/index.js') !== -1 &&
      sidebarHtml.indexOf('lib/dr-log/index.js') < sidebarHtml.indexOf('sidebar.js'),
    true);
  if (typeof globalThis.DR_LOG !== 'object') return;
  const LOG = globalThis.DR_LOG;

  LOG.debug('row shape probe');
  let snap = LOG.snapshot();
  const last = snap.entries[snap.entries.length - 1];
  eq('dr-log: a row holds its level and text',
    { level: last.level, text: last.text },
    { level: 'debug', text: 'row shape probe' });
  eq('dr-log: a row\'s timestamp parses as a date',
    isNaN(Date.parse(last.at)), false);
  eq('dr-log: the snapshot reports the row cap', snap.limit, 50);

  // console.info and console.error are not muted by the harness (only debug
  // and warn are); spy them for the duration of these three calls so the
  // forwarded rows stay out of the test report.
  const origInfo = console.info;
  const origError = console.error;
  console.info = () => {};
  console.error = () => {};
  LOG.info('info probe');
  LOG.warn('warn probe');
  LOG.error('error probe');
  console.info = origInfo;
  console.error = origError;
  eq('dr-log: info, warn, and error rows carry their level',
    LOG.snapshot().entries.slice(-3).map((e) => e.level),
    ['info', 'warn', 'error']);

  LOG.debug(42);
  eq('dr-log: non-string text is stored as a string',
    LOG.snapshot().entries.slice(-1)[0].text, '42');

  // Forwarding: a row still reaches the console (devtools behavior is
  // unchanged). The harness mutes console.debug/console.warn globally; this
  // test installs its own spy and puts the mute back.
  const origDebug = console.debug;
  let forwarded = null;
  console.debug = (msg) => { forwarded = msg; };
  LOG.debug('forwarding probe');
  console.debug = origDebug;
  eq('dr-log: a row forwards to the console', forwarded, 'forwarding probe');

  const snapA = LOG.snapshot();
  snapA.entries[snapA.entries.length - 1].text = 'mutated';
  eq('dr-log: snapshot rows are copies, so mutating one never reaches the buffer',
    LOG.snapshot().entries.slice(-1)[0].text, 'forwarding probe');

  LOG.debug('x'.repeat(3000));
  eq('dr-log: a long row is cut at 2000 characters',
    LOG.snapshot().entries.slice(-1)[0].text.length, 2000);

  // The 50-row cap and the drop counter — last in this section because it
  // fills the shared buffer.
  const droppedBefore = LOG.snapshot().dropped;
  for (let i = 0; i < 55; i++) LOG.debug('cap probe ' + i);
  snap = LOG.snapshot();
  eq('dr-log: the buffer holds at most 50 rows', snap.entries.length, 50);
  eq('dr-log: rows dropped past the cap are counted',
    snap.dropped >= droppedBefore + 5, true);
  eq('dr-log: the newest row survives the cap',
    snap.entries[snap.entries.length - 1].text, 'cap probe 54');
})();

// --- lib/dr-log: the stack trace and the row listener ---
//
// A warn or error row carries the stack trace at the moment it was recorded,
// the same trace the extension error page shows, so a capture holds it and
// the application model can store it. Debug and info rows carry none: they
// are frequent, and a trace costs a stack walk per row. The row listener is
// how the controller learns that a row landed without the log module reaching
// up to the application model or the bus, both of which load after it.

(function drLogStackTraceAndListener() {
  if (typeof globalThis.DR_LOG !== 'object') return;
  const LOG = globalThis.DR_LOG;
  const origError = console.error;
  console.error = () => {};
  try {
    function stackProbeCaller() { LOG.warn('stack probe'); }
    stackProbeCaller();
    const warnRow = LOG.snapshot().entries.slice(-1)[0];
    eq('dr-log: a warn row carries the stack trace that recorded it',
      typeof warnRow.stack === 'string' && /stackProbeCaller/.test(warnRow.stack), true);
    eq('dr-log: the stack trace starts at the caller, with the log module\'s own frames left out',
      /stackProbeCaller/.test(String(warnRow.stack).split('\n')[0]), true);

    function errorStackProbeCaller() { LOG.error('error stack probe'); }
    errorStackProbeCaller();
    eq('dr-log: an error row carries the stack trace',
      /errorStackProbeCaller/.test(LOG.snapshot().entries.slice(-1)[0].stack || ''), true);

    LOG.debug('no stack probe');
    eq('dr-log: a debug row carries no stack trace',
      LOG.snapshot().entries.slice(-1)[0].stack, null);
    LOG.info('no stack probe');
    eq('dr-log: an info row carries no stack trace',
      LOG.snapshot().entries.slice(-1)[0].stack, null);

    // One list: the levels that carry a trace are the levels the controller
    // records as extension errors, read from here and held nowhere else.
    eq('dr-log: the error levels are warn and error', LOG.ERROR_LEVELS, ['warn', 'error']);
    eq('dr-log: the controller reads the error levels from the log module',
      /DR_LOG\.ERROR_LEVELS/.test(sourceByName('content.js') || '') &&
        !/ERROR_ROW_LEVELS/.test(sourceByName('content.js') || ''), true);

    // A deep stack trace is cut at the same bound as row text.
    const savedLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 200;
    function deepWarn(n) { if (n === 0) { LOG.warn('deep probe'); return; } deepWarn(n - 1); }
    deepWarn(150);
    Error.stackTraceLimit = savedLimit;
    eq('dr-log: a long stack trace is cut at 2000 characters',
      String(LOG.snapshot().entries.slice(-1)[0].stack).length, 2000);

    const snapCopy = LOG.snapshot();
    snapCopy.entries[snapCopy.entries.length - 1].stack = 'mutated';
    eq('dr-log: a snapshot row\'s stack trace is a copy',
      LOG.snapshot().entries.slice(-1)[0].stack === 'mutated', false);

    const seen = [];
    const off = LOG.onRow((row) => { seen.push(row); });
    LOG.debug('listener probe');
    eq('dr-log: a row listener receives each row as it lands',
      seen.length === 1 && seen[0].text === 'listener probe' && seen[0].level === 'debug', true);
    seen[0].text = 'mutated';
    eq('dr-log: the listener receives a copy, so mutating it never reaches the buffer',
      LOG.snapshot().entries.slice(-1)[0].text, 'listener probe');
    off();
    LOG.debug('after removal probe');
    eq('dr-log: a removed row listener receives nothing more', seen.length, 1);

    let reported = null;
    console.error = (msg) => { reported = msg; };
    const offThrowing = LOG.onRow(() => { throw new Error('listener failure'); });
    LOG.debug('throwing listener probe');
    offThrowing();
    eq('dr-log: a listener that throws does not stop the row from recording',
      LOG.snapshot().entries.slice(-1)[0].text, 'throwing listener probe');
    eq('dr-log: a listener\'s failure is reported on the console',
      typeof reported === 'string' && /listener failure/.test(reported), true);
  } finally {
    console.error = origError;
  }
})();

// --- app model: the error state ---
//
// The tab's error state: whether an extension error has been recorded on
// this page, how many, and the last rows with their stack traces. The
// controller writes it from the log buffer's row listener, the toast view
// redraws from its state change, and the capture carries it. It never clears
// within a page's life; a reload starts clean because nothing persists.
//
// The live model is a singleton every earlier test has written to, so these
// tests build a fresh one: the settings contract, the bus, and the model,
// evaluated together in their own context.

(function appModelErrorState() {
  const { store, bus } = makeIsolatedModel();
  const empty = { hasError: false, count: 0, rows: [] };
  eq('error state: a fresh model holds no error', store.getErrorState(), empty);
  eq('error state: the snapshot a reconnecting view pulls carries the error state',
    store.getSnapshot().errorState, empty);

  const published = [];
  bus.subscribe('state:errorRecorded', (payload) => { published.push(payload); });
  const row = { at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'probe row', stack: 'at probe' };
  store.recordError(row);
  eq('error state: recording a row sets the indicator and the count',
    { hasError: store.getErrorState().hasError, count: store.getErrorState().count },
    { hasError: true, count: 1 });
  eq('error state: the recorded row keeps its time, level, text, and stack trace',
    store.getErrorState().rows[0], row);
  eq('error state: recording publishes the whole error state as a state change',
    published, [{ errorState: { hasError: true, count: 1, rows: [row] } }]);

  const read = store.getErrorState();
  read.rows[0].text = 'mutated';
  read.rows.push({});
  eq('error state: the getter returns copies', store.getErrorState().rows, [row]);

  for (let i = 0; i < 60; i++) {
    store.recordError({ at: 'x', level: 'warn', text: 'row ' + i, stack: null });
  }
  eq('error state: the rows hold at most 50 while the count keeps counting',
    { rows: store.getErrorState().rows.length, count: store.getErrorState().count },
    { rows: 50, count: 61 });
  eq('error state: the newest row survives the cap',
    store.getErrorState().rows[49].text, 'row 59');

  eq('bus: state:errorRecorded is a same-context state-change topic',
    DR_BUS.TOPICS['state:errorRecorded'], { family: 'state-change', route: null });
})();

// --- controller: the log buffer feeds the error state ---
//
// Every warn or error row the content script records is an extension error:
// the controller's row listener writes it into the model's error state, and
// debug and info rows stay out. Every failure the extension records today is
// a warn row, and the extension error page lists warn output beside errors.
// These run against the live model and log buffer, so every count is
// relative.

(function controllerRoutesErrorRows() {
  const before = DR_STORE.getErrorState().count;
  const origError = console.error;
  console.error = () => {};
  try {
    DR_LOG.warn('controller error probe');
    const afterWarn = DR_STORE.getErrorState();
    eq('controller: a warn row lands in the model\'s error state',
      { count: afterWarn.count, hasError: afterWarn.hasError,
        text: afterWarn.rows.slice(-1)[0] && afterWarn.rows.slice(-1)[0].text },
      { count: before + 1, hasError: true, text: 'controller error probe' });
    eq('controller: the recorded row carries the stack trace of the call that logged it',
      /controllerRoutesErrorRows/.test((afterWarn.rows.slice(-1)[0] || {}).stack || ''), true);
    DR_LOG.error('controller error-level probe');
    eq('controller: an error row lands in the model\'s error state',
      DR_STORE.getErrorState().count, before + 2);
    DR_LOG.debug('controller debug probe');
    DR_LOG.info('controller info probe');
    eq('controller: debug and info rows stay out of the error state',
      DR_STORE.getErrorState().count, before + 2);
  } finally {
    console.error = origError;
  }
})();

// --- toast view: an error row shows on the page ---
//
// The toast view subscribes to the model's error state change and draws the
// newest row's text in one fixed element at the page's bottom right, removed
// by a click or after the hide delay. A second row replaces the text and
// restarts the delay, so a repeating warning shows one toast. The view never
// logs: a row it recorded would publish back to it.
//
// The live view has drawn against earlier tests' page stubs by the time this
// section runs, so these build the settings contract, the bus, the model,
// and the view together in a fresh context with their own page stub. The
// model's publish reaching the view's subscription is the wiring under test.

(function toastViewShowsErrorRows() {
  const uiToastCode = sourceByName('ui-toast.js');
  eq('toast: ui-toast.js is a content script in the manifest', uiToastCode !== null, true);
  if (uiToastCode === null) return;

  const appended = [];
  const timers = [];
  let cleared = 0;
  const makeEl = (tag) => {
    const listeners = {};
    const attrs = {};
    return {
      _tag: tag, className: '', textContent: '', parentNode: null, _listeners: listeners,
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) { return attrs[name] === undefined ? null : attrs[name]; },
      addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    };
  };
  const container = () => ({
    appendChild(child) { appended.push(child); child.parentNode = this; return child; },
    removeChild(child) {
      const i = appended.indexOf(child);
      if (i >= 0) appended.splice(i, 1);
      child.parentNode = null;
    },
  });
  const vm = require('vm');
  const sandbox = {
    chrome: global.chrome,
    console,
    document: { createElement: makeEl, body: container(), head: container() },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => { cleared++; },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\n' + storeCode + '\n' + uiToastCode +
    '\nthis.__store = DR_STORE; this.__toast = DR_TOAST;', ctx);
  const store = sandbox.__store;
  const view = sandbox.__toast;
  const isToast = (el) => el.className === view.TOAST_CLASS;

  store.recordError({ at: 'x', level: 'warn', text: 'Dynamic Rounding: toast probe one', stack: null });
  const toast = appended.find(isToast);
  eq('toast: an error row appends one toast to the page', !!toast, true);
  eq('toast: the toast shows the row\'s text',
    toast ? toast.textContent : null, 'Dynamic Rounding: toast probe one');
  eq('toast: the toast is a status region for assistive technology',
    toast ? toast.getAttribute('role') : null, 'status');
  eq('toast: the view injects its stylesheet once',
    appended.filter((el) => el._tag === 'style' && el.textContent.includes(view.TOAST_CLASS)).length, 1);
  eq('toast: the toast hides itself after the hide delay',
    timers.length === 1 && timers[0].ms === view.TOAST_HIDE_MS, true);

  store.recordError({ at: 'x', level: 'warn', text: 'toast probe two', stack: null });
  eq('toast: a second row replaces the text of the one toast',
    { count: appended.filter(isToast).length, text: toast ? toast.textContent : null },
    { count: 1, text: 'toast probe two' });
  eq('toast: a second row restarts the hide delay',
    { cleared, timers: timers.length }, { cleared: 1, timers: 2 });

  if (timers[1]) timers[1].fn();
  eq('toast: the hide delay removes the toast', appended.some(isToast), false);

  store.recordError({ at: 'x', level: 'error', text: 'toast probe three', stack: null });
  const second = appended.find(isToast);
  eq('toast: a row after the hide draws a fresh toast',
    !!second && second !== toast && second.textContent === 'toast probe three', true);
  if (second) second._listeners.click[0]();
  eq('toast: a click removes the toast', appended.some(isToast), false);
  eq('toast: the stylesheet is injected once for the page\'s life',
    appended.filter((el) => el._tag === 'style').length, 1);
  eq('toast: the view logs nothing', /DR_LOG\./.test(uiToastCode), false);
})();

// --- capture: the error state and the stack traces travel in the capture ---
//
// The capture state carries the model's error state, and each log row's
// stack trace renders under the row, folded, so a reader opens the trace
// only for the row in question. Format 3 marks both additions. The sidebar's
// fallback state, used when the page half never arrives, carries the new
// field as an absence, like every other page-side field.

(function captureCarriesErrorState() {
  if (typeof globalThis.collectCaptureState !== 'function' ||
      typeof globalThis.DR_CAPTURE !== 'object') return;
  const errorState = {
    hasError: true, count: 1,
    rows: [{ at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'probe', stack: '    at roundTable' }],
  };
  const fakeStore = {
    getRegisteredTables: () => [],
    getSelectedTable: () => null,
    getSettings: () => ({ enabled: true }),
    getErrorState: () => errorState,
  };
  const state = collectCaptureState({ store: fakeStore, adapterFor: () => null });
  eq('capture-state: the state carries the model\'s error state', state.errorState, errorState);
  eq('capture-state: format 6 renames the detection settings key',
    state.captureFormat, 6);

  const renderState = {
    captureFormat: 6,
    meta: { url: 'https://www.example.com/p', title: 'P', version: '2.1.70',
      platform: 'test', at: '2026-09-17T16:00:00.000Z' },
    mark: 'looks-wrong', remarks: '', settings: { enabled: true }, detectionSettings: null,
    activeTableIndex: null, tables: [], lensPreview: null, fixtureSeed: null,
    sidebarView: { enabled: true, switches: {}, dateGranularity: 'year', timeGranularity: 'hour',
      rangeExpr: '', stops: [0], topVal: 0, botVal: 0, coupled: true, status: '',
      noTable: true, locked: false, lensPreview: { top: [], bottom: [] } },
    errorState: errorState,
    log: {
      content: {
        entries: [
          { at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'traced row',
            stack: '    at roundTable (chrome-extension://' + 'a'.repeat(32) +
              '/content.js:1523:18)\n    at <script>alert(1)</script>' },
          { at: '2026-09-17T16:00:01.000Z', level: 'debug', text: 'plain row', stack: null },
        ],
        dropped: 0, limit: 50,
      },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
  };
  const html = DR_CAPTURE.buildCaptureDocument({ state: renderState, lockedStatusText: '' });
  const visible = html.slice(0, html.indexOf('id="capture-state"'));
  eq('capture-render: a row\'s stack trace renders under the row, folded, each frame in the short form',
    /traced row[\s\S]{0,200}<details[\s\S]{0,200}content\.js:1523:18 \(roundTable\)/.test(visible) &&
      !visible.includes('chrome-extension://'), true);
  eq('capture-render: a row with no stack trace renders no fold',
    (visible.match(/<details/g) || []).length, 1);
  eq('capture-render: a hostile stack trace reaches the visible half escaped only',
    visible.includes('&lt;script&gt;alert(1)&lt;/script&gt;') &&
      !visible.toLowerCase().includes('<script'), true);
  // The island's text, unescaped (ampersand last), parsed back.
  const island = html.match(/<pre id="capture-state" hidden>([\s\S]*?)<\/pre>/);
  const islandState = island ? JSON.parse(island[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')) : null;
  eq('capture-render: the island carries the stack trace byte-exact',
    islandState && islandState.log.content.entries[0].stack,
    renderState.log.content.entries[0].stack);
  eq('capture-render: the island carries the error state',
    islandState && islandState.errorState, errorState);

  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const fnStart = sidebarJsSrc.indexOf('function assembleAndSaveCapture');
  const fnBody = fnStart === -1 ? '' :
    sidebarJsSrc.slice(fnStart, sidebarJsSrc.indexOf('\nfunction ', fnStart + 1));
  eq('capture: assembleAndSaveCapture\'s fallback state carries errorState: null',
    fnStart !== -1 && /errorState:\s*null/.test(fnBody), true);
})();

// --- lib/dr-capture: stack frames print in the short form ---
//
// V8 writes a frame as "at fn (origin/path:line:col)" or, with no name, as
// "at origin/path:line:col". The capture prints each frame the way Chrome's
// extension error page does: path:line:col (fn), the extension's own origin
// dropped, an unnamed frame marked as an anonymous function. A line outside
// either shape prints as it is, so nothing is lost; the JSON island keeps
// the raw string byte-exact either way.
(function captureTraceShortForm() {
  if (typeof globalThis.DR_CAPTURE !== 'object' ||
      typeof DR_CAPTURE.formatStackFrame !== 'function') {
    eq('capture-trace: the package exposes the frame formatter',
      typeof globalThis.DR_CAPTURE === 'object' && typeof DR_CAPTURE.formatStackFrame, 'function');
    return;
  }
  const origin = 'chrome-extension://' + 'abcdefghijklmnopabcdefghijklmnop' + '/';
  const f = DR_CAPTURE.formatStackFrame;
  eq('capture-trace: a named frame renders as path:line:col (name)',
    f('    at roundTable (' + origin + 'content.js:1523:18)'), 'content.js:1523:18 (roundTable)');
  eq('capture-trace: an unnamed frame renders as an anonymous function',
    f('    at ' + origin + 'adapters/messaging.js:399:9'),
    'adapters/messaging.js:399:9 (anonymous function)');
  eq('capture-trace: an Object.<anonymous> frame keeps its function part',
    f('    at Object.<anonymous> (' + origin + 'x.js:1:2)'), 'x.js:1:2 (Object.<anonymous>)');
  eq('capture-trace: an async frame keeps the async prefix',
    f('    at async fetchIt (' + origin + 'y.js:3:4)'), 'y.js:3:4 (async fetchIt)');
  eq('capture-trace: a constructor frame keeps the new prefix',
    f('    at new Foo (' + origin + 'z.js:5:6)'), 'z.js:5:6 (new Foo)');
  eq('capture-trace: a frame from another origin keeps its URL',
    f('    at run (https://example.com/app.js:7:8)'), 'https://example.com/app.js:7:8 (run)');
  // V8 also writes frames with no location — a built-in, a promise
  // combinator — and a cut frame; each prints as it is.
  const passThrough = ['Error', '<script>alert(1)</script>', '',
    '    at new Promise (<anonymous>)', '    at Array.forEach (<anonymous>)',
    '    at async Promise.all (index 0)', '    at roundTable (' + origin + 'content.js:15'];
  eq('capture-trace: a line outside the frame shape prints as it is',
    passThrough.map(f), passThrough);
})();

// --- lib/dr-log: call sites route through the buffer ---
//
// The extension's own console.debug call sites (two in content.js, one in
// detect.js) route through DR_LOG so their rows land in the capture. A
// direct console.debug row is invisible to the capture, so none may remain
// in the content scripts. detect.js is also evaluated standalone in vm
// sandboxes elsewhere in this suite, so its call site guards on DR_LOG's
// presence instead of assuming the load order.

(function drLogCallSites() {
  eq('dr-log: content.js keeps no direct console.debug call',
    /console\.debug\(/.test(sourceByName('content.js') || ''), false);
  eq('dr-log: detect.js keeps no direct console.debug call',
    /console\.debug\(/.test(detectCode || ''), false);
  eq('dr-log: registration logs a row (ui-toggle.js)',
    /DR_LOG\.debug\([^)]*egistered/.test(uiToggleCode || ''), true);
  eq('dr-log: a blocked apply logs a warn row (content.js)',
    /DR_LOG\.warn\([^)]*locked/.test(sourceByName('content.js') || ''), true);
  eq('dr-log: a table turning locked logs a warn row (ui-toggle.js)',
    /DR_LOG\.warn\([^)]*ocked/.test(uiToggleCode || ''), true);
})();

