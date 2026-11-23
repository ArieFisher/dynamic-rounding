// The controller and the application model it writes.

// ---------------------------------------------------------------------------
// Sidebar settings pull and unified toggle
// ---------------------------------------------------------------------------

(function sidebarPullAndUnifiedToggle() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('sidebar pull: source file content.js present in manifest', false, true);
    return;
  }

  // --- Settings live in DR_MODEL (content-script context), so content.js
  // applies from its own model, and the sidebar asks content.js for the
  // current value. ---

  eq('pull (inverted): the apply reads the table\'s own settings',
    /function applySidebarRounding\(table\)\s*\{\s*const opts = DR_MODEL\.getTableSettings\(table\)/.test(contentSrc),
    true);

  eq('pull (inverted): content.js answers request:activeTable with the active table\'s settings',
    /respond\('request:activeTable'[\s\S]{0,400}const active = DR_MODEL\.getActiveTable\(\);\s*const settings = DR_MODEL\.getTableSettings\(active\)/.test(contentSrc), true);

  // --- Unified rounding path ---

  // Both kinds record one shape through the registry port, with no markup
  // copy.
  eq('registry: every cell\'s originals are recorded via DR_MODEL.setTableOriginal, through the registry port',
    /set\(cellEl, record\)\s*\{\s*DR_MODEL\.setTableOriginal\(table, cellEl, record\);/.test(contentSrc) &&
      !/html:\s*cell\.innerHTML/.test(contentSrc), true);

  eq('registry: the table settings are recorded via DR_MODEL.setTableSettings, in the controller\'s one write',
    /function writeTableSettings\([\s\S]{0,400}DR_MODEL\.setTableSettings\(table,/.test(contentSrc), true);
  eq('registry: roundTable writes no settings (issue #328)',
    /function roundTable\([\s\S]{0,300}setTableSettings/.test(contentSrc), false);

  eq('unified: the apply re-runs roundTable rather than replaying a cached value',
    /function applySidebarRounding[\s\S]{0,600}roundTable\(/.test(contentSrc), true);

  // --- Display simplification: "35.0" → "35" when value unchanged but format would ---

  withCreateTreeWalker(function() {
    // Row contains a large number to anchor max_mag=3 so 35 does not get rounded
    // away from itself (35 with offset -0.5 → 35), AND a "35.0" cell that should
    // be re-formatted to "35".
    const table = makeMockTable([[
      { tag: 'td', text: '7984' },
      { tag: 'td', text: '35.0' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[1];
    eq('simplify: "35.0" cell marked as rounded',
      cell.classList.contains('dr-ext-rounded'), true);
    eq('simplify: "35.0" cell text rewritten to "35"',
      cell.innerText, '35');
  });

  // Negative: a cell whose format already matches (e.g. "35" with same opts)
  // should NOT be marked as rounded.
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '7984' },
      { tag: 'td', text: '35' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[1];
    eq('simplify: cell with no format or value change stays unmarked',
      cell.classList.contains('dr-ext-rounded'), false);
  });
})();

// ---------------------------------------------------------------------------
// Sync on switch: a switch with the sidebar open applies the
// clicked table's own settings in the model — the sidebar then
// mirrors them, and the table matches what the sidebar shows. Two cells: a
// non-default offset reaches the new table's rounding pass, and a table
// holding enabled:false still simplifies on a press, which reads the screen.
// ---------------------------------------------------------------------------

(function issue251_switchAppliesModelToNewTable() {
  const tableA = makeTablePillboxTestTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });
  // The value that must visibly round under offsetTop -2 sits in the SECOND
  // column: the shipped defaults leave the first column alone, and 286 at
  // offset -2 rounds to itself, so a first-column 8,584,629 would let a
  // defaults-run pass hide.
  const tableB = makeTablePillboxTestTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '286' }, { tag: 'td', text: '8,584,629' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });
  DR_MODEL.setTableSettings(tableB, { offsetTop: -2, offsetOther: -2 }, 'page');

  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = () => {};

  lastRightClickedTable = tableA;

  const buttonB = createTablePillboxWithSpies(tableB);
  fireMouseClick(buttonB);

  const rounded = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));
  const roundedText = tableB._cells[3].innerText;

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  eq('sync-on-switch: the clicked table is rounded (its settings hold enabled on)',
    rounded, true);
  eq('sync-on-switch: the rounding pass ran with the table\'s offset, not the shipped default',
    roundedText, '8,580,000');
})();

(function issue251_switchRespectsModelEnabledOff() {
  const tableA = makeTablePillboxTestTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });
  // Values that visibly change under the shipped default offset (see the
  // wire-message test's note: 1,000,000-style values round to themselves
  // and would let a wrongly-run rounding pass hide).
  const tableB = makeTablePillboxTestTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });
  DR_MODEL.setTableSettings(tableB, { enabled: false }, 'page');

  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = () => {};

  lastRightClickedTable = tableA;

  const buttonB = createTablePillboxWithSpies(tableB);
  fireMouseClick(buttonB);

  const rounded = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  eq('press on a different table simplifies it even where its settings stand at off (part one: the flip reads the screen)',
    rounded, true);
})();
// ---------------------------------------------------------------------------
// The application model (app/model.js, DR_MODEL)
// and the typed event bus (app/bus.js, DR_BUS). The selected
// table and the sidebar-open flag moved out of content.js's file-level lets
// into DR_MODEL; table-pillbox-view.js reports an intent through DR_BUS instead of
// writing content.js's variables directly.
// ---------------------------------------------------------------------------
(function appModelSelection_storeAndBus() {
  const busSrc = sourceByName('app/bus.js');
  const modelSrc = sourceByName('app/model.js');
  if (busSrc === null || modelSrc === null) {
    eq('app-model-selection: app/bus.js and app/model.js are present in the manifest', false, true);
    return;
  }

  // --- (a) discipline: one top-level declaration per file, like the lib
  // packages' index.js bundles. ---
  const topLevelDecls = (src) => src.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('app/bus.js: exactly one top-level declaration in the file',
    topLevelDecls(busSrc).length, 1);
  eq('app/bus.js: the sole top-level declaration is DR_BUS',
    /^const DR_BUS\b/m.test(busSrc), true);
  eq('app/model.js: exactly one top-level declaration in the file',
    topLevelDecls(modelSrc).length, 1);
  eq('app/model.js: the sole top-level declaration is DR_MODEL',
    /^const DR_MODEL\b/m.test(modelSrc), true);

  // --- (a) discipline: DR_BUS.TOPICS enumerates every topic with a family,
  // and no topic falls outside the two families. ---
  // The third family, request: a topic whose one responder returns an
  // answer to the publisher.
  const KNOWN_FAMILIES = ['intent', 'state-change', 'request'];
  const topics = DR_BUS.TOPICS;
  const topicNames = Object.keys(topics);
  eq('DR_BUS.TOPICS: at least one topic is registered',
    topicNames.length > 0, true);
  eq('DR_BUS.TOPICS: every topic belongs to one of the three known families',
    topicNames.every((t) => KNOWN_FAMILIES.includes(topics[t].family)), true);
  eq('DR_BUS.TOPICS: enumerates exactly the expected topics',
    topicNames.slice().sort(),
    ['intent:activateTable', 'intent:toggleTable',
     // The model's error state, published to the toast view in the same context.
     'state:errorRecorded',
     // The sidebar's three requests, each answered by the tab's content script.
     'request:applySettings', 'request:activeTable', 'request:captureState',
     // The service worker's one.
     'intent:menuClicked',
     // The content script's six reports to the sidebar, the settings
     // notice among them.
     'state:settingsChanged', 'state:tableActivated', 'state:tableSwitched',
     'state:rangeError', 'state:rangeOk',
     'state:previewSamplesChanged'].sort());

  // Every moved topic, each with the family and route the topic table states.
  // A route is the one fact that determines which contexts a publish reaches,
  // so a wrong one here delivers to the wrong audience in silence.
  const WORKER_TOPICS = {
    'intent:menuClicked': ['intent', 'tab'],
    // The content script's six reports. Every one broadcasts: the content
    // script holds no tabs interface, and the sidebar is an extension page.
    'state:settingsChanged': ['state-change', 'extension-pages'],
    'state:tableActivated': ['state-change', 'extension-pages'],
    'state:tableSwitched': ['state-change', 'extension-pages'],
    'state:rangeError': ['state-change', 'extension-pages'],
    'state:rangeOk': ['state-change', 'extension-pages'],
    'state:previewSamplesChanged': ['state-change', 'extension-pages'],
  };
  for (const name of Object.keys(WORKER_TOPICS)) {
    const [family, route] = WORKER_TOPICS[name];
    eq('DR_BUS.TOPICS: ' + name + ' is in the ' + family + ' family',
      topics[name] && topics[name].family, family);
    eq('DR_BUS.TOPICS: ' + name + ' carries the ' + route + ' route',
      topics[name] && topics[name].route, route);
  }
  eq('DR_BUS.TOPICS: intent:activateTable is in the intent family',
    topics['intent:activateTable'].family, 'intent');
  // The table pillbox view's click handler changes no table
  // itself — it publishes intent:toggleTable, and content.js (the sole
  // subscriber) determines what a committed toggle does.
  eq('DR_BUS.TOPICS: intent:toggleTable is in the intent family',
    topics['intent:toggleTable'].family, 'intent');
  // The sidebar's settings apply. The content script answers it, and the
  // sidebar reads whether anyone answered to determine bound versus unbound,
  // so it is a request.
  eq('DR_BUS.TOPICS: request:applySettings is in the request family',
    topics['request:applySettings'].family, 'request');
  eq('DR_BUS.TOPICS: request:applySettings routes to one tab\'s content script (cross-context: sidebar page -> content script)',
    topics['request:applySettings'].route, 'tab');

  // Publishing to an unregistered topic is rejected rather than silently
  // dropped, so the registry stays authoritative rather than aspirational.
  let unknownTopicThrew = null;
  try {
    DR_BUS.publish('not:a:real:topic', {});
  } catch (e) {
    unknownTopicThrew = e.message;
  }
  eq('DR_BUS.publish: an unregistered topic throws instead of publishing silently',
    typeof unknownTopicThrew, 'string');

  // --- (b) publishing the intent changes the model. ---
  const originalActive = DR_MODEL.getActiveTable();
  try {
    const fakeTable = { __fake: 'table-A' };
    DR_BUS.publish('intent:activateTable', { table: fakeTable });
    eq('intent:activateTable: publishing the intent updates DR_MODEL.getActiveTable()',
      DR_MODEL.getActiveTable(), fakeTable);
  } finally {
    DR_MODEL.setActiveTable(originalActive);
  }

  // --- (c) reconnect: closing and reopening the sidebar must pull the
  // model's current snapshot, not depend on a state-change message the
  // sidebar could have missed while it was gone (the bus keeps no history). ---
  const savedActive = DR_MODEL.getActiveTable();
  try {
    const reconnectTable = { __fake: 'table-B' };
    DR_MODEL.setActiveTable(reconnectTable);

    // No message is replayed here on purpose — a reconnecting view pulls,
    // it does not listen for what it missed. What a reopen pulls is the
    // active table.
    eq('reconnect: the model exposes no reader for a sidebar-open value',
      typeof DR_MODEL.isSidebarOpen, 'undefined');
    eq('reconnect: the model exposes no writer for a sidebar-open value',
      typeof DR_MODEL.setSidebarOpen, 'undefined');
    eq('reconnect: activeTable survives for the reopening view to pull',
      DR_MODEL.getActiveTable(), reconnectTable);
  } finally {
    DR_MODEL.setActiveTable(savedActive);
  }

  // --- (d) no file writes another file's variables: build the list of
  // identifiers content.js declares at its top level, then confirm
  // table-pillbox-view.js contains no assignment to any of them. ---
  const contentSrcForScan = sourceByName('content.js');
  const tablePillboxViewSrcForScan = sourceByName('table-pillbox-view.js');
  const topLevelBindingNames = (src) => {
    const names = [];
    const re = /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
    let match;
    while ((match = re.exec(src))) names.push(match[1]);
    return names;
  };
  const contentTopLevelNames = topLevelBindingNames(contentSrcForScan);
  eq('static scan: content.js still declares its usual top-level bindings (sanity check on the scan itself)',
    contentTopLevelNames.includes('lastRightClickedElement') && contentTopLevelNames.includes('reapplyObservers'),
    true);
  const crossFileWrites = contentTopLevelNames.filter((name) => {
    const assignRe = new RegExp('\\b' + name + '\\s*=[^=]');
    return assignRe.test(tablePillboxViewSrcForScan);
  });
  eq("static scan: table-pillbox-view.js assigns none of content.js's top-level bindings",
    crossFileWrites, []);

  // --- (e) hardening: the scan above only catches writes to content.js's
  // SURVIVING top-level bindings. It has a blind spot — a name that moved OUT
  // of content.js into DR_MODEL (activeTable) is invisible to
  // that scan, so a file that reintroduces a bare assignment to that name
  // would slip through undetected. Close
  // that gap by scanning for writes to DR_MODEL's own private field names,
  // read directly from app/model.js rather than from content.js.
  //
  // The field declarations sit one level inside the IIFE (2-space indent);
  // anchoring on that indentation (rather than a bare \b(?:let|const) scan
  // anywhere in the file) is what keeps this from also matching the `const
  // entry = ...` locals declared inside the table-registry getters/setters
  // — those are per-call temporaries, not fields.
  const modelFieldNames = Array.from(modelSrc.matchAll(/^ {2}(?:let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm))
    .map((m) => m[1])
    .filter((name) => name !== 'DR_MODEL');
  eq('static scan: app/model.js declares its five private fields (sanity check on the scan itself)',
    modelFieldNames.slice().sort(),
    ['ERROR_ROW_LIMIT', 'errorCount', 'errorRows',
     'activeTable', 'tableRegistry'].sort());
  const modelFieldWrites = modelFieldNames.filter((name) => {
    const assignRe = new RegExp('\\b' + name + '\\s*=[^=]');
    return assignRe.test(tablePillboxViewSrcForScan) || assignRe.test(contentSrcForScan);
  });
  eq("static scan (hardened): neither table-pillbox-view.js nor content.js assigns DR_MODEL's private field names directly",
    modelFieldWrites, []);
})();

// ---------------------------------------------------------------------------
// Publishing intent:toggleTable is content.js's only
// path to running a press — prove the wiring end to end (mirrors the
// intent:activateTable behavioral pin in the app-model-selection block above).
// ---------------------------------------------------------------------------
(function tablePillboxSplit_intentToggleTableRunsThePress() {
  // DR_DEFAULTS excludes row 0 (firstRow) and col 0 (firstColumn) — use a
  // 2x2 table so [row1, col1] is processed.
  const table = makeTablePillboxTestTable([
    [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
    [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
  ]);
  injectTablePillboxEntry(table);

  // The press writes the table's settings and moves the active table. The active table is shared model
  // state, so this test saves and restores it rather than leaving it for
  // whatever runs next.
  const savedActive = DR_MODEL.getActiveTable();
  try {
    DR_MODEL.setTableSettings(table, { enabled: false }, 'page');
    DR_MODEL.setActiveTable(table);

    const wasRounded = showsSimplified(table);
    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table });
    });
    const isNowRounded = showsSimplified(table);

    eq('table-pillbox-split: publishing intent:toggleTable runs the press (table becomes simplified)',
      !wasRounded && isNowRounded, true);

    // A second press takes it back off, through the same path and the same
    // intent.
    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table });
    });
    eq('table-pillbox-split: publishing intent:toggleTable again takes the table back to its original values',
      showsSimplified(table), false);
  } finally {
    DR_MODEL.setActiveTable(null);
    DR_MODEL.setActiveTable(savedActive);
  }
})();

// ---------------------------------------------------------------------------
// CLICK-HANDLER PARENT-EQUIVALENCE
// PIN across the full guard matrix. table-pillbox-view.js's two click branches
// (mouse/keyboard, touch second-tap) each publish one
// `DR_BUS.publish('intent:toggleTable', { table })`, and content.js's
// intent:toggleTable subscriber runs the press. This pin checks
// {same table, different table} for both click branches — not just that a
// guard's boolean outcome matches (the rebind tests above already
// cover that), but the ORDER and full contents of every dispatched message.
//
// The expected sequences below are LITERALS, so the pin holds in a shallow
// checkout or CI runner.
// ---------------------------------------------------------------------------
(function tablePillboxSplit_parentEquivalence_tablePillboxClickSequences() {
  // Keyed by sameTable — mouse and touch second-tap produce the identical
  // sequence per cell, since both branches publish to the same handler. That
  // equality is itself part of what this pin proves: see the per-mode
  // assertions below, which check mouse and touch against the same literal.
  //
  // A press reads nothing about the sidebar, so these two cells are the
  // whole matrix.
  const EXPECTED_SEQUENCES = {
    // A press on the ACTIVE table. The settings write comes first and lands
    // on the pressed table: the write's settings notice leads the sequence, carrying the flipped
    // enabled to the sidebar, and the apply that follows sends the range
    // status.
    'true': [
      { topic: 'state:settingsChanged', source: 'page',
        settings: Object.assign({}, DR_DEFAULTS, { enabled: true }) },
      { topic: 'state:rangeOk' },
    ],
    // A press on a table that is NOT the active one applies the pressed
    // table's own settings to it, whatever the sidebar is doing.
    //
    // state:tableSwitched leads, so the settings notice after it describes the
    // newly active table. No
    // state:previewSamplesChanged — the sidebar's pull chain ends in the
    // preview fetch.
    'false': [
      { topic: 'state:tableSwitched' },
      { topic: 'state:settingsChanged', source: 'page',
        settings: Object.assign({}, DR_DEFAULTS, { enabled: true }) },
      { topic: 'state:rangeOk' },
    ],
  };

  // sameTable=true reuses the SAME table object for both "which table is
  // active" and "which table gets pressed" — the unmoved press. sameTable=
  // false makes a different table active than the one pressed — the press
  // that moves the active table, which must publish the switch.
  function runTablePillboxClickFixture(mode, sameTable) {
    const clicked = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    clicked._cells.forEach(c => { c.querySelectorAll = () => []; });

    let selected = clicked;
    if (!sameTable) {
      selected = makeTablePillboxTestTable([
        [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
        [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
      ]);
      selected._cells.forEach(c => { c.querySelectorAll = () => []; });
    }

    const sentMessages = [];
    const origSendMessage = global.chrome.runtime.sendMessage;
    global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

    lastRightClickedTable = selected;

    const buttonEl = createTablePillboxWithSpies(clicked);
    if (mode === 'mouse') fireMouseClick(buttonEl);
    else fireTouchSecondTap(buttonEl);

    global.chrome.runtime.sendMessage = origSendMessage;
    lastRightClickedTable = null;

    return sentMessages;
  }

  for (const sameTable of [true, false]) {
    const expected = EXPECTED_SEQUENCES[String(sameTable)];
    for (const mode of ['mouse', 'touch']) {
      const seq = runTablePillboxClickFixture(mode, sameTable);
      eq(`table pillbox click sequence (${mode}, sameTable=${sameTable}): sendMessage sequence matches the frozen literal`,
        seq, expected);
    }
  }
})();

// =============================================================================
// The registry of found tables, per-cell originals,
// and the simplified/original flag live in DR_MODEL.
// =============================================================================

// --- (a) One restore path: a native table and a grid restore through the
// same restoreTable() call. ---
(function registrySprint_oneRestorePathForBothKinds() {
  withCreateTreeWalker(function () {
    // Native table: header row (excluded) + one data row.
    const table = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    roundTable(table, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: false, simplifyFirstColumn: true }));
    const nativeCell = table._cells[1];
    eq('registry restore: native cell is rounded before restore',
      nativeCell.classList.contains('dr-ext-rounded'), true);

    restoreTable(table, false);
    eq('registry restore: native cell HTML restored via the shared restoreTable() call',
      nativeCell.innerHTML, '8,584,629');
    eq('registry restore: native cell no longer carries dr-ext-rounded',
      nativeCell.classList.contains('dr-ext-rounded'), false);
  });

  // Grid: the SAME restoreTable() function, dispatching internally on kind.
  const grid = makeE2EGridWrapper([['8584629', '286']]);
  roundTable(grid.wrapperEl, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true }));
  const gridCell = grid.cellEls[0];
  eq('registry restore: grid cell is rounded before restore',
    gridCell.classList.contains('dr-ext-rounded'), true);

  restoreTable(grid.wrapperEl, false);
  eq('registry restore: grid cell text node restored via the same restoreTable() call',
    gridCell.childNodes[0].nodeValue, '8584629');
  eq('registry restore: grid cell no longer carries dr-ext-rounded',
    gridCell.classList.contains('dr-ext-rounded'), false);
})();

// --- (b) The re-apply observer works from model state: a simulated grid
// redraw re-applies rounding correctly with every page attribute this cell
// might have carried stripped away first. ---
(function registrySprint_reapplyFromModelStateOnly() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const cell0 = grid.cellEls[0];
    const roundedValue = cell0.childNodes[0].nodeValue;
    const originalValue = DR_MODEL.getTableOriginalText(grid.wrapperEl, cell0);

    // Strip every page attribute a pre-registry build would have relied on —
    // the re-apply must work from DR_MODEL alone.
    cell0.dataset = {};
    grid.wrapperEl.dataset = {};

    // Simulate a redraw reverting the sort (framework rewrites the text node
    // back to the original; node identity and the dr-ext-rounded class survive).
    cell0.childNodes[0].nodeValue = originalValue;

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: cell0.childNodes[0] }]);
    flushTimers(pendingTimers);

    eq('registry reapply: cell re-rounded after redraw with no page attributes present',
      cell0.childNodes[0].nodeValue, roundedValue);
  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// --- (e) A full simplify → off → simplify cycle returns the cell to the
// exact original text and then to the exact same simplified text.
//
// Off resets, which clears the record, and the re-simplify reads the
// restored cell and writes a fresh record. The assertions read what the user
// sees. ---
(function registrySprint_originalsSurviveOffAndOnCycle() {
  withCreateTreeWalker(function () {
    const table = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    injectTablePillboxEntry(table);
    const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: false, simplifyFirstColumn: true });
    const cell = table._cells[1];
    // withCreateTreeWalker's fake tree walker writes rounded text through
    // innerText/textContent (mirroring the DOM's own child-node/serialization
    // relationship, which a plain mock object does not have for free) — link
    // all three properties to one backing value so a write through any of
    // them (the round path via the walker, the restore path via a direct
    // innerHTML assignment) is visible through all three, the way a real
    // <td> keeps them in sync.
    let _text = cell.innerHTML;
    Object.defineProperties(cell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });

    roundTable(table, opts);
    const roundedText = cell.textContent;
    eq('registry cycle: cell rounds away from the original text',
      roundedText !== '8,584,629', true);

    resetTable(table); // the press that turns simplification off
    eq('registry cycle: cell shows the exact original text after the off press',
      cell.textContent, '8,584,629');
    eq('registry cycle: showsSimplified is false while the original text shows',
      showsSimplified(table), false);
    eq('registry cycle: the off press clears the stored original',
      DR_MODEL.hasTableOriginal(table, cell), false);

    roundTable(table, opts); // the press that turns it back on
    eq('registry cycle: cell is simplified again after the on press',
      cell.textContent, roundedText);
    eq('registry cycle: showsSimplified is true again after the on press',
      showsSimplified(table), true);
    eq('registry cycle: the on press writes a fresh stored original from the restored text',
      DR_MODEL.getTableOriginalText(table, cell), '8,584,629');
  });
})();

// --- (f) Grid magnitude basis freeze: roundTable
// freezes max_mag on first sight into DR_MODEL.setTableMaxMagnitude and every
// later reapplyRounding reuses that frozen value (see the frozenMaxMag
// entry in the pass settings header above simplifyTableCells in content.js).
// offsetTop/offsetOther are
// deliberately set apart so a magnitude-driven bucket flip is visible in the
// formatted output, not just in the stored number. ---
(function registrySprint_gridMagnitudeFrozenAtFirstSight() {
  let ctx;
  try {
    const opts = { offsetTop: -1, offsetOther: 0, numTop: 1 };
    // Sole visible row at first sight: magnitude 2 (555) — freezes max_mag at 2.
    ctx = setupVirtGrid([['555']], opts);
    const { grid, pendingTimers } = ctx;
    const cell555 = grid.cellEls[0];

    eq('magnitude freeze: 555 rounds via offsetTop (max_mag=2, within numTop of itself)',
      cell555.childNodes[0].nodeValue, '560');
    eq('magnitude freeze: DR_MODEL freezes maxMagnitude at 2 on first sight',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 2);

    // Simulate scroll bringing a magnitude-9 row into view alongside the
    // still-visible 555 row — appended to the wrapper's children, the
    // fallback _getRowEntries path this unlabelled-grid shape uses.
    const hugeCell = makeGridCellWithTextNode('5000000000');
    const hugeRow = makeElementNode('row', [hugeCell]);
    hugeRow.dataset = { row: '1' };
    hugeRow.children = [hugeCell];
    grid.wrapperEl.children.push(hugeRow);

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: cell555.childNodes[0] }]);
    flushTimers(pendingTimers);

    // If the basis recomputed from the now-visible magnitude-9 row (the
    // parent's behavior), 555 would fall out of the top bucket and round to
    // "600" (offsetOther) instead. HEAD must keep "560".
    eq('magnitude freeze: after a scroll-triggered reapply exposing a magnitude-9 row, 555 KEEPS the magnitude-2 basis ("560"), not a recomputed magnitude-9 basis ("600")',
      cell555.childNodes[0].nodeValue, '560');
    eq('magnitude freeze: DR_MODEL.getTableMaxMagnitude never shifts off the frozen value',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 2);
  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// --- (f) continued: an off-and-back-on round trip clears the frozen basis
// (resetTable sets maxMagnitude back to null) and re-freezes fresh from
// whatever is visible at the moment of the second press — it does NOT
// preserve the basis established by the first round. This is the registry's
// actual behavior, documented here so a reviewer can judge whether
// "frozen at first sight" was meant to survive a round trip.
//
// The round trip runs through a reset, which clears the frozen basis. ---
(function registrySprint_offAndOnRoundTripReFreezesRatherThanPreserving() {
  let ctx;
  try {
    const opts = { offsetTop: -1, offsetOther: 0, numTop: 1 };
    ctx = setupVirtGrid([['555']], opts);
    const { grid } = ctx;
    const cell555 = grid.cellEls[0];

    eq('toggle round trip: initial freeze is at max_mag=2 ("560")',
      cell555.childNodes[0].nodeValue, '560');
    eq('toggle round trip: DR_MODEL holds the frozen basis before any toggle',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 2);

    // Scroll in a magnitude-9 row BEFORE the off press, so the "first sight"
    // the re-round sees on the second press is the magnitude-9 view, not the
    // original magnitude-2 view.
    const hugeCell = makeGridCellWithTextNode('5000000000');
    const hugeRow = makeElementNode('row', [hugeCell]);
    hugeRow.dataset = { row: '1' };
    hugeRow.children = [hugeCell];
    grid.wrapperEl.children.push(hugeRow);

    const applyOpts = Object.assign(
      {}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true }, opts);

    DR_MODEL.setTableSettings(grid.wrapperEl, Object.assign({}, applyOpts, { enabled: false }), 'page');
    applySidebarRounding(grid.wrapperEl);
    eq('round trip: the off press clears the display back to "555"',
      cell555.childNodes[0].nodeValue, '555');
    eq('round trip: the off press clears the frozen basis',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), null);

    DR_MODEL.setTableSettings(grid.wrapperEl, Object.assign({}, applyOpts, { enabled: true }), 'page');
    applySidebarRounding(grid.wrapperEl);
    eq('round trip: DR_MODEL re-freezes from the now-visible magnitude-9 row (9), not the original magnitude-2 basis',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 9);
    // Under the re-frozen (9) basis, current_mag(555)=2, max_mag-current_mag=7
    // >= numTop(1), so 555 now takes offsetOther ("600") — a DIFFERENT
    // rendered value than the original round produced ("560"), purely
    // because of what happened to be visible at the second press.
    eq('round trip: 555 renders differently after the round trip than its original round ("600", not "560")',
      cell555.childNodes[0].nodeValue, '600');
  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// --- (g) settings notice sequence: showsSimplified (reading the cell
// markers) must report correctly to the sidebar across a full round ->
// peek-original -> peek-back cycle, not just a single toggle. The table pillbox
// test above pins one click; the guard matrix pins one
// intent:toggleTable dispatch. Neither exercises the 3-step peek cycle. ---
(function registrySprint_tableToggleStateAcrossPeekCycle() {
  const savedActive = DR_MODEL.getActiveTable();
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  try {
    const table = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
    ]);
    injectTablePillboxEntry(table);
    DR_MODEL.setActiveTable(table);

    // makeTablePillboxTestCell gives innerHTML/innerText/textContent as three
    // INDEPENDENT properties. A real <td>'s innerHTML/innerText/textContent
    // all derive from the same child-node tree, so writing one (restoreTable's
    // `cell.innerHTML = original.html`) is immediately visible through the
    // others (roundTable's re-classification reads getText() -> innerText).
    // Without this link the mock desyncs after the peek-original restore:
    // innerHTML goes back to '12,345' but innerText stays on the stale
    // rounded string, so the round-trip's re-round misclassifies the cell as
    // already-rounded and skips it — a fixture artifact, not a product bug
    // (see the identical link in registrySprint_originalsSurviveToggleCycle
    // above, needed for the same reason on the 2-toggle case).
    const dataCell = table._cells[3]; // row1/col1: 'Row' | '12,345'
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table }); // round
      DR_BUS.publish('intent:toggleTable', { table }); // peek original
      DR_BUS.publish('intent:toggleTable', { table }); // peek back
    });

    const toggleMsgs = sent.filter(m => m.topic === 'state:settingsChanged').map(m => m.settings);
    eq('toggle-state cycle: exactly one settings notice per dispatch (3 total)',
      toggleMsgs.length, 3);
    eq('toggle-state cycle: enabled sequence is true (rounded), false (peek original), true (peek back)',
      toggleMsgs.map(m => m.enabled), [true, false, true]);
    eq('toggle-state cycle: showsSimplified agrees with the last reported state',
      showsSimplified(table), true);
  } finally {
    global.chrome.runtime.sendMessage = origSend;
    DR_MODEL.setActiveTable(savedActive);
  }
})();

// --- (h) Registry, part 1: a table re-added after removal (the
// SAME element reference, as a virtualized-DOM library recycling a detached
// node back into the tree would do) must come back with a FRESH registry
// entry, not the previous round's leftover state. unregisterTable deletes
// the registry entry outright, so a later registerTable (via _ensureEntry)
// can only build a brand-new entry — this pins that no per-cell original,
// round options, or frozen magnitude survives the round trip. ---
(function registrySprint_reregisterAfterUnregisterGetsFreshEntry() {
  const table = { tagName: 'TABLE' }; // identity is all that matters here
  const cell = { tagName: 'TD' };

  DR_MODEL.registerTable(table);
  DR_MODEL.setTableOriginal(table, cell, { value: '8,584,629', pieces: [{ text: '8,584,629', written: '8,584,629' }] });
  DR_MODEL.setTableSettings(table, { offsetTop: -1 }, 'page');
  DR_MODEL.setTableMaxMagnitude(table, 7);

  eq('re-register: table holds an original before removal (pre-condition)',
    DR_MODEL.hasTableOriginal(table, cell), true);

  // Simulate the removed-node observer's cleanup: unregisterTable is the
  // ONLY registry call it makes (content.js's removedNodes loop).
  DR_MODEL.unregisterTable(table);

  eq('re-register: hasTable is false immediately after unregisterTable',
    DR_MODEL.hasTable(table), false);

  // The SAME table reference comes back (e.g. a virtualized list recycling
  // the detached DOM node into view again). registerTable is idempotent /
  // "found again" — it must not resurrect the old entry.
  DR_MODEL.registerTable(table);

  eq('re-register: the old per-cell original does NOT leak through (hasTableOriginal is false)',
    DR_MODEL.hasTableOriginal(table, cell), false);
  eq('re-register: getTableOriginal for the old cell reference is undefined, not the stale record',
    DR_MODEL.getTableOriginal(table, cell), undefined);
  eq('re-register: the table settings reset to the shipped defaults (not the leftover settings)',
    DR_MODEL.getTableSettings(table), Object.assign({}, DR_DEFAULTS));
  eq('re-register: maxMagnitude resets to null (not the leftover frozen value)',
    DR_MODEL.getTableMaxMagnitude(table), null);
})();

// --- The registry's fingerprint field. The entry
// carries the shape the table had when it registered, and the table pillbox view's
// builder is its one writer. The shape fingerprint row in docs/vocabulary.md
// defines the field. ---
(function shapeFingerprint_theRegistryHoldsAFingerprintPerTable() {
  const table = { tagName: 'TABLE' }; // identity is all that matters here

  eq('fingerprint registry: an unregistered table carries no fingerprint',
    DR_MODEL.getTableFingerprint(table), null);

  DR_MODEL.registerTable(table);
  eq('fingerprint registry: registerTable on its own records no fingerprint',
    DR_MODEL.getTableFingerprint(table), null);

  const recorded = { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] };
  DR_MODEL.setTableFingerprint(table, recorded);
  eq('fingerprint registry: the recorded fingerprint reads back whole',
    DR_MODEL.getTableFingerprint(table), recorded);
  eq('fingerprint registry: the recorded fingerprint is plain values',
    JSON.parse(JSON.stringify(DR_MODEL.getTableFingerprint(table))), recorded);

  DR_MODEL.unregisterTable(table);
  eq('fingerprint registry: unregisterTable drops the fingerprint with the entry',
    DR_MODEL.getTableFingerprint(table), null);

  DR_MODEL.registerTable(table);
  eq('fingerprint registry: a re-registration starts with no fingerprint',
    DR_MODEL.getTableFingerprint(table), null);
  DR_MODEL.unregisterTable(table);
})();

// The table pillbox view's builder records the shape after it registers the table,
// on a grid and on a native table alike.
(function shapeFingerprint_registrationRecordsTheTablesShape() {
  const grouped = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391'], ['South', '918,554'],
  ]);
  withTablePillboxDocumentMock(function () { registerDataTable(grouped.wrapperEl); });
  eq('fingerprint registry: registering a grid with a row group records its header row',
    DR_MODEL.getTableFingerprint(grouped.wrapperEl),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  forgetRegisteredTable(grouped.wrapperEl);

  const grid = makeDatabaseQueryGrid();
  withTablePillboxDocumentMock(function () { registerDataTable(grid.scrollPaneEl); });
  eq('fingerprint registry: registering a groupless grid records its column count alone',
    DR_MODEL.getTableFingerprint(grid.scrollPaneEl),
    { columnCount: 3, headerTexts: null });
  forgetRegisteredTable(grid.scrollPaneEl);

  const nativeTable = makeTablePillboxTestTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  withTablePillboxDocumentMock(function () { registerDataTable(nativeTable); });
  eq('fingerprint registry: registering a native table records its header row',
    DR_MODEL.getTableFingerprint(nativeTable),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  forgetRegisteredTable(nativeTable);
})();

// --- The teardown both the removal observer and the
// mismatch path run. One function discards a table's registration and every
// per-table resource the extension holds beside it: the table pillbox, the resize
// observer, a virtualized grid's re-apply observer and its pending timer, and
// the registry entry. The teardown writes no
// row: each caller writes its own. ---

(function shapeFingerprint_theTeardownDiscardsTheEntryAndEveryResourceBesideIt() {
  const grid = makeDatabaseQueryGrid();
  const resizeObservers = [];
  const savedResizeObserver = global.ResizeObserver;
  const clearedTimers = [];
  const savedClearTimeout = global.clearTimeout;
  let gridObserverDisconnects = 0;
  global.ResizeObserver = class {
    constructor() { this.disconnected = false; resizeObservers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() { this.disconnected = true; }
  };
  global.clearTimeout = function (id) { clearedTimers.push(id); return savedClearTimeout(id); };

  try {
    const removedTablePillboxes = registerFingerprintedTable(grid.scrollPaneEl);
    reapplyObservers.set(grid.scrollPaneEl, { observer: { disconnect() { gridObserverDisconnects++; } }, target: grid.scrollPaneEl });
    const pendingTimer = setTimeout(function () {}, 10000);
    reapplyTimers.set(grid.scrollPaneEl, { id: pendingTimer, burstStartMs: Date.now() });

    eq('fingerprint teardown: the grid registers and gets a table pillbox before the teardown (precondition)',
      DR_MODEL.hasTable(grid.scrollPaneEl) && tablePillboxes.has(grid.scrollPaneEl), true);

    const rows = logRowsDuring(() => teardownTableEntry(grid.scrollPaneEl));

    eq('fingerprint teardown: the teardown writes no row', rows, []);
    eq('fingerprint teardown: the table pillbox comes off the page', removedTablePillboxes.length, 1);
    eq('fingerprint teardown: the resize observer disconnects',
      resizeObservers.length === 1 && resizeObservers[0].disconnected, true);
    eq('fingerprint teardown: the pending re-apply timer is cleared',
      clearedTimers.includes(pendingTimer), true);
    eq('fingerprint teardown: the timer record goes with it',
      reapplyTimers.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the re-apply observer disconnects', gridObserverDisconnects, 1);
    eq('fingerprint teardown: the re-apply observer record goes with it',
      reapplyObservers.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the table pillbox view record goes with it',
      tablePillboxes.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the registry entry is gone',
      DR_MODEL.hasTable(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the fingerprint goes with the entry',
      DR_MODEL.getTableFingerprint(grid.scrollPaneEl), null);
  } finally {
    global.ResizeObserver = savedResizeObserver;
    global.clearTimeout = savedClearTimeout;
    forgetRegisteredTable(grid.scrollPaneEl);
  }
})();

// --- Page rows for activation, registration, and removal. A fresh evaluation
// of the content scripts runs the production right-click handler and table
// observer, and the rows land in that evaluation's own log buffer. ---
(function pageRows_activationRegistrationAndRemoval() {
  withRightClickSandbox(function (ctx) {
    const rows = (fn) => logRowsDuring(fn, ctx.log);
    const tableObserver = ctx.constructedObservers[0];
    const grid = makeDatabaseQueryGrid();
    eq('page rows: a right-click on a table writes one activate row, and its registration writes none',
      rows(() => ctx.contextmenuHandler({ target: grid.scrollRowEls[2].children[1] })),
      ['Dynamic Rounding: activate']);

    ctx.contextmenuHandler({ target: { parentElement: null } });
    // The menu topic also relays to the tab, which this evaluation lacks.
    global.chrome.tabs = { sendMessage() {}, query() {} };
    eq('page rows: a menu click with no table at the right-click writes one no table found row',
      rows(() => ctx.bus.publish('intent:menuClicked', {})), ['Dynamic Rounding: no table found']);

    const tables = [{ tagName: 'DIV' }, { tagName: 'DIV' }];
    tables.forEach((table) => ctx.model.registerTable(table));
    const pendingRoots = [{ nodeType: 1, tagName: 'DIV' }, { nodeType: 1, tagName: 'DIV' }];
    pendingRoots.forEach((root) => ctx.holdPendingTable(root));
    const removed = { nodeType: 1, contains: (el) => tables.includes(el) || pendingRoots.includes(el) };
    eq('page rows: a removal writes one row per kind of record, with its count',
      rows(() => tableObserver._cb([{ addedNodes: [], removedNodes: [removed] }])),
      ['Dynamic Rounding: unregister · tables: 2',
        'Dynamic Rounding: pending table drop · reason: removed · tables: 2']);
  });
})();

// ---------------------------------------------------------------------------
// A table pillbox press on the active table writes the table's settings (its
// enabled), not just the table's cells and the sidebar pillbox. A press
// that changed the cells without writing the settings would leave any later
// pull (a sidebar reopen or a table switch) showing a stale enabled over the
// table's truth.
//
// One press path covers the sidebar open and the sidebar closed alike, so
// this one test covers both cases. The settings notice goes out either way: a
// closed sidebar has no page to receive it.
// ---------------------------------------------------------------------------
(function issue272_sameTablePillboxPressWritesTheTablesSettings() {
  const savedActive = DR_MODEL.getActiveTable();
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  try {
    const table = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
    ]);
    injectTablePillboxEntry(table);
    DR_MODEL.setActiveTable(table);

    // Same innerHTML/innerText/textContent link as the toggle-state cycle
    // test above — restoreTable writes innerHTML, the re-round reads
    // innerText, and a real <td> derives both from one child-node tree.
    const dataCell = table._cells[3]; // row1/col1: 'Row' | '12,345'
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table }); // table pillbox: turn rounding on
    });
    eq('leak-1: the first table pillbox press rounds the connected table',
      showsSimplified(table), true);
    eq('leak-1: the table\'s settings follow the table pillbox — enabled true after toggle-on',
      DR_MODEL.getTableSettings(table).enabled, true);

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table }); // table pillbox: turn rounding off
    });
    eq('leak-1: the second table pillbox press restores the table to originals',
      showsSimplified(table), false);
    eq('leak-1: the table\'s settings follow the table pillbox — enabled false after toggle-off',
      DR_MODEL.getTableSettings(table).enabled, false);

    // A sidebar change runs this same apply, and it must honor the settings
    // the table pillbox just wrote — not silently re-round the table.
    withCreateTreeWalker(function () {
      applySidebarRounding(table);
    });
    eq('leak-1: a later apply honors the table\'s settings — the table stays on originals',
      showsSimplified(table), false);

    const notices = sent.filter((m) => m.topic === 'state:settingsChanged');
    eq('leak-1: one settings notice per table pillbox toggle, carrying the table\'s enabled — true then false',
      notices.map((m) => m.settings.enabled), [true, false]);
  } finally {
    global.chrome.runtime.sendMessage = origSend;
    DR_MODEL.setActiveTable(savedActive);
  }
})();

// A press on a table that is NOT the active one moves the active table to it
// and writes the pressed table's settings. A press means one thing, so it
// makes the pressed table active and writes its settings, whatever the
// sidebar is doing.
(function pressOnInactiveTableMovesTheActiveTableAndWritesItsSettings() {
  runPressFixture(() => {
    const active = makePressTable('1,000,000');
    const other = makePressTable('12,345');
    DR_MODEL.setActiveTable(active);

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table: other });
    });
    eq('press on an inactive table: the pressed table simplifies',
      showsSimplified(other), true);
    eq('press on an inactive table: the pressed table\'s settings follow the press',
      DR_MODEL.getTableSettings(other).enabled, true);
    eq('press on an inactive table: the pressed table becomes the active one',
      DR_MODEL.getActiveTable(), other);
    eq('press on an inactive table: the table that was active is left as it was',
      showsSimplified(active), false);
  });
})();

// --- The pressed table's settings stand at off and the press lands on a
// table that is not the active one. The press must turn the table on: a press
// that only re-applied the settings at off would change no numbers, and the
// user would press an on/off control and see nothing move. ---
(function partOne_pressOnInactiveTableSimplifiesEvenWithItsSettingsOff() {
  runPressFixture(({ sent }) => {
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_MODEL.setTableSettings(pressed, { enabled: false }, 'page');
    DR_MODEL.setActiveTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: a press on an inactive table simplifies it with its settings at off',
      showsSimplified(pressed), true);
    eq('part one: the pressed table\'s settings follow that press to on',
      DR_MODEL.getTableSettings(pressed).enabled, true);
    eq('part one: the press publishes the switch',
      sent.filter((m) => m.topic === 'state:tableSwitched').length, 1);
  });
})();

// --- Exactly one settings write per press, and the flip direction comes from
// the table's on/off value as it stood BEFORE that write. For a table showing the original
// whose settings already stand at on, the handler writes off: the
// table pillbox shows that table as on, the same as the sidebar pillbox. ---
(function partOne_onePressOneWriteReadingTheSettingFirst() {
  runPressFixture(({ resetWrites, writes }) => {
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_MODEL.setTableSettings(pressed, { enabled: true }, 'page');
    DR_MODEL.setActiveTable(active);
    resetWrites();

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: a press makes exactly one settings write',
      writes(), 1);
    eq('part one: a table showing the original with its settings at on ends at off after one press',
      DR_MODEL.getTableSettings(pressed).enabled, false);
    eq('part one: the table shows the original after that press',
      showsSimplified(pressed), false);
  });
})();

// --- A table with nothing to simplify. The table pillbox and the sidebar
// table pillbox show the one on/off value, so such a table stands at on after the
// first press and at off after the next, though no cell changes either way. ---
(function partOne_pressesOnATableWithNothingToSimplifyAlternate() {
  runPressFixture(() => {
    const table = makePressTable('no digits');
    DR_MODEL.setActiveTable(table);
    const tablePillbox = tablePillboxes.get(table);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('nothing to simplify: the settings stand at on after the first press',
      DR_MODEL.getTableSettings(table).enabled, true);
    eq('nothing to simplify: no cell changes on the first press',
      showsSimplified(table), false);
    eq('nothing to simplify: the table pillbox shows on after the first press',
      tablePillbox.getAttribute('aria-pressed'), 'true');

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('nothing to simplify: the settings stand at off after the second press',
      DR_MODEL.getTableSettings(table).enabled, false);
    eq('nothing to simplify: the table pillbox shows off after the second press',
      tablePillbox.getAttribute('aria-pressed'), 'false');
  });
})();

// --- The press applies the pressed table's own settings, and the values they
// carry are what the table gets. The offset seeded below differs from the
// shipped default, so a pass run against the defaults fails this. ---
(function partOne_pressAppliesTheTablesCurrentValues() {
  runPressFixture(() => {
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('8,584,629');
    DR_MODEL.setTableSettings(pressed, { enabled: false, offsetTop: -2, offsetOther: -2 }, 'page');
    DR_MODEL.setActiveTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: turning simplification on uses the table\'s own offset',
      pressed._cells[3].innerText, '8,580,000');
  });
})();

// --- Turning off resets: the press clears the simplified markers and the
// stored originals along with turning the settings off. ---
(function partOne_pressOffResetsTheTable() {
  runPressFixture(() => {
    const table = makePressTable('12,345');
    DR_MODEL.setTableSettings(table, { enabled: false }, 'page');
    DR_MODEL.setActiveTable(table);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('part one: the first press simplifies the active table (precondition)',
      showsSimplified(table), true);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });

    eq('part one: after an off press the table\'s settings stand at off',
      DR_MODEL.getTableSettings(table).enabled, false);
    eq('part one: after an off press no cell carries the simplified marker',
      table._cells.some((c) => c.classList.contains('dr-ext-rounded')), false);
    eq('part one: after an off press no cell has a stored original',
      table._cells.some((c) => DR_MODEL.hasTableOriginal(table, c)), false);
  });
})();

// --- A range expression the parser rejects stops the apply before any cell
// changes. Each table holds its own expression, so a moved press
// applies the pressed table's own, and an unparsable expression on another
// table never reaches it. ---
(function partOne_aMovedPressIgnoresAnotherTablesUnparsableRangeExpression() {
  runPressFixture(() => {
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_MODEL.setTableSettings(active, { enabled: false, rangeExpr: '1a' }, 'page');
    DR_MODEL.setActiveTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: the pressed table keeps its own blank range expression',
      DR_MODEL.getTableSettings(pressed).rangeExpr, '');
    eq('part one: that press simplifies the whole pressed table',
      showsSimplified(pressed), true);
  });
})();

(function partOne_unmovedPressKeepsTheRangeExpression() {
  runPressFixture(() => {
    const table = makePressTable('12,345');
    DR_MODEL.setTableSettings(table, { enabled: false, rangeExpr: 'B2' }, 'page');
    DR_MODEL.setActiveTable(table);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });

    eq('part one: a press on the already-active table keeps the range expression',
      DR_MODEL.getTableSettings(table).rangeExpr, 'B2');
  });
})();

// --- A right-click activation writes no settings, so the numbers on a
// right-clicked table stay as they are. A settings write applies to its
// table, so a write on activation would change the numbers. ---
(function partOne_activationWritesNoSettings() {
  runPressFixture(({ resetWrites, writes }) => {
    const table = makePressTable('12,345');
    DR_MODEL.setTableSettings(table, { enabled: true, rangeExpr: 'B2' }, 'page');
    resetWrites();

    withCreateTreeWalker(() => { DR_BUS.publish('intent:activateTable', { table }); });

    eq('part one: a right-click activation makes no settings write',
      writes(), 0);
    eq('part one: a right-click activation leaves the range expression alone',
      DR_MODEL.getTableSettings(table).rangeExpr, 'B2');
    eq('part one: a right-click activation changes no numbers on the table',
      showsSimplified(table), false);
    eq('part one: the activation still moves the active table',
      DR_MODEL.getActiveTable(), table);
  });
})();

// ---------------------------------------------------------------------------
// Each table's own settings are the only settings.
//
// The rule: every
// sidebar change writes the active table's settings, the redraw read answers
// with them, and a table with none starts from the shipped defaults.
// ---------------------------------------------------------------------------

// 8,584,629 rounds to 10,000,000 at offset 1 (heavy), to 8,580,000 at offset
// -2 (light), and to 8,500,000 at the shipped default, so each cell shows
// which settings produced it.
const ISSUE328_HEAVY = { enabled: true, offsetTop: 1, offsetOther: 1 };
const ISSUE328_LIGHT = { enabled: true, offsetTop: -2, offsetOther: -2 };

// A table's settings, or an empty object where the model answers none, so a
// failed read reports as a failed assertion rather than a thrown error.
function issue328SettingsOf(table) {
  return DR_MODEL.getTableSettings(table) || {};
}

// Five steps: simplify A heavy, make B active and change it to
// light, make A active again, then change A.
(function issue328_twoTablesKeepTheirOwnSettings() {
  runPressFixture(() => {
    const tableA = makePressTable('8,584,629');
    const tableB = makePressTable('8,584,629');
    withCreateTreeWalker(() => {
      DR_BUS.publish('intent:activateTable', { table: tableA });
      askContentScript({ topic: 'request:applySettings',
        settings: Object.assign({}, DR_DEFAULTS, ISSUE328_HEAVY) });
      DR_BUS.publish('intent:activateTable', { table: tableB });
      askContentScript({ topic: 'request:applySettings',
        settings: Object.assign({}, DR_DEFAULTS, ISSUE328_LIGHT) });
      DR_BUS.publish('intent:activateTable', { table: tableA });
    });

    const answer = askContentScript({ topic: 'request:activeTable' });
    eq('per-table settings: the redraw read on A answers A\'s heavy rounding',
      answer && answer.settings && [answer.settings.offsetTop, answer.settings.offsetOther], [1, 1]);
    eq('per-table settings: A still shows its heavy rounding after B changed',
      tableA._cells[3].innerText, '10,000,000');
    eq('per-table settings: B shows its light rounding',
      tableB._cells[3].innerText, '8,580,000');

    withCreateTreeWalker(() => {
      askContentScript({ topic: 'request:applySettings',
        settings: Object.assign({}, DR_DEFAULTS, ISSUE328_HEAVY, { simplifyFirstColumn: true }) });
    });
    eq('per-table settings: a change on A writes A\'s settings',
      issue328SettingsOf(tableA).simplifyFirstColumn, true);
    eq('per-table settings: a change on A leaves B\'s settings light',
      [issue328SettingsOf(tableB).offsetTop, issue328SettingsOf(tableB).simplifyFirstColumn],
      [-2, DR_DEFAULTS.simplifyFirstColumn]);
    eq('per-table settings: a change on A leaves B\'s cells light',
      tableB._cells[3].innerText, '8,580,000');
  });
})();

// The redraw read answers the active table's settings, and the shipped
// defaults with no table active. The settings apply with no table active
// answers, so the sidebar stays bound, and writes nothing.
(function issue328_theSettingsRequestsReachTheActiveTable() {
  runPressFixture(() => {
    const noneActive = askContentScript({ topic: 'request:activeTable' });
    eq('per-table settings: with no table active the redraw read answers the shipped defaults',
      noneActive && noneActive.settings, Object.assign({}, DR_DEFAULTS));

    const table = makePressTable('12,345');
    DR_MODEL.setTableSettings(table, { rangeExpr: 'B2' }, 'page');
    DR_MODEL.setActiveTable(table);
    const active = askContentScript({ topic: 'request:activeTable' });
    eq('per-table settings: the redraw read answers the active table\'s range expression',
      active && active.settings && active.settings.rangeExpr, 'B2');

    DR_MODEL.setActiveTable(null);
    const applied = askContentScript({ topic: 'request:applySettings',
      settings: Object.assign({}, DR_DEFAULTS, { rangeExpr: 'A1' }) });
    eq('per-table settings: the settings apply with no table active still answers',
      applied, { ok: true });
    eq('per-table settings: the settings apply with no table active writes no table\'s settings',
      issue328SettingsOf(table).rangeExpr, 'B2');
  });
})();

// Each table keeps its own range expression, so a press that makes a
// different table active clears neither.
(function issue328_aMovedPressKeepsBothRangeExpressions() {
  runPressFixture(() => {
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_MODEL.setTableSettings(active, { enabled: false, rangeExpr: 'B2' }, 'page');
    DR_MODEL.setTableSettings(pressed, { enabled: false, rangeExpr: 'B2' }, 'page');
    DR_MODEL.setActiveTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('per-table settings: a moved press keeps the pressed table\'s range expression',
      issue328SettingsOf(pressed).rangeExpr, 'B2');
    eq('per-table settings: a moved press keeps the previous table\'s range expression',
      issue328SettingsOf(active).rangeExpr, 'B2');
    eq('per-table settings: a moved press flips the pressed table\'s on/off value alone',
      [issue328SettingsOf(pressed).enabled, issue328SettingsOf(active).enabled],
      [true, false]);
  });
})();

// Each path runs the shape check once, before its write or its apply. Only
// the first check can find a changed shape: it registers the fresh table, and
// a second check on that table compares it against the shape it registered a
// moment ago. The count reads the check's first step, the read of the
// recorded shape.
(function issue328_eachPathRunsTheShapeCheckOnce() {
  runPressFixture(() => {
    const table = makePressTable('8,584,629');
    DR_MODEL.setActiveTable(table);
    const origRead = DR_MODEL.getTableFingerprint;
    let checks = 0;
    DR_MODEL.getTableFingerprint = (t) => { checks++; return origRead(t); };
    const countChecks = (run) => {
      checks = 0;
      withCreateTreeWalker(run);
      return checks;
    };
    try {
      const press = countChecks(() => DR_BUS.publish('intent:toggleTable', { table }));
      const apply = countChecks(() => askContentScript({ topic: 'request:applySettings',
        settings: Object.assign({}, DR_DEFAULTS, ISSUE328_LIGHT) }));
      const read = countChecks(() => askContentScript({ topic: 'request:activeTable' }));
      eq('shape check: a table pillbox press, a sidebar change, and a redraw read each run it once',
        [press, apply, read], [1, 1, 1]);
    } finally {
      DR_MODEL.getTableFingerprint = origRead;
    }
  });
})();

// A table no one has turned on reads off: the shipped on/off value is off,
// so the sidebar pillbox matches a table showing the original, and the
// sidebar's redraw read on an untouched table leaves it showing the original.
// Only a toggle or the sidebar pillbox turns it on.
(function issue328_anUntouchedTableReadsOff() {
  runPressFixture(() => {
    const table = makePressTable('8,584,629');
    DR_MODEL.setActiveTable(table);
    eq('defaults: a table with no settings reads off',
      DR_MODEL.getTableSettings(table).enabled, false);
    withCreateTreeWalker(() => askContentScript({ topic: 'request:activeTable' }));
    eq('defaults: a redraw read on an untouched table leaves it showing the original',
      [showsSimplified(table), table._cells[3].innerText], [false, '8,584,629']);
  });
})();

// The redraw read runs no apply. The toggle already simplified the table
// under its own settings, and the read answers those settings, so an apply
// would rebuild cells that already match.
(function issue328_theRedrawReadRunsNoApply() {
  runPressFixture(({ sent }) => {
    const table = makePressTable('8,584,629');
    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    const simplified = table._cells[3].innerText;
    sent.length = 0;
    withCreateTreeWalker(() => askContentScript({ topic: 'request:activeTable' }));
    eq('redraw read: no apply runs on the simplified table',
      sent.filter((m) => ['state:rangeOk', 'state:rangeError'].includes(m.topic)).length, 0);
    eq('redraw read: the simplified cells stay as the toggle left them',
      [showsSimplified(table), table._cells[3].innerText], [true, simplified]);
  });
})();

// The redraw read runs the shape check before it answers, so a table the page
// gave a new column registers fresh and the answer reads the fresh entry. On
// this grid the fresh registration lands on the same element, so the fresh
// entry shows in its settings and its fingerprint. The check publishes a
// table switch, which makes the sidebar send a second read; that read finds
// the fresh fingerprint unchanged and publishes nothing.
(function issue328_theRedrawReadAnswersFromAFreshTable() {
  runPressFixture(({ sent }) => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setTableSettings(grid.scrollPaneEl,
      Object.assign({}, ISSUE328_LIGHT, { rangeExpr: 'B2' }), 'page');
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 101)));

    sent.length = 0;
    let answer = null;
    withTablePillboxDocumentMock(function () { answer = askContentScript({ topic: 'request:activeTable' }); });
    const fresh = DR_MODEL.getActiveTable();
    eq('redraw read: a changed shape registers fresh and leaves the fresh table active',
      [fresh === grid.scrollPaneEl, (DR_MODEL.getTableFingerprint(grid.scrollPaneEl) || {}).columnCount],
      [true, 4]);
    eq('redraw read: the answer holds the fresh entry\'s settings, the shipped defaults',
      answer && answer.settings, Object.assign({}, DR_DEFAULTS));
    eq('redraw read: the shape change sends the table switch to the sidebar',
      sent.some((m) => m.topic === 'state:tableSwitched'), true);

    sent.length = 0;
    withTablePillboxDocumentMock(function () { askContentScript({ topic: 'request:activeTable' }); });
    eq('redraw read: the next read finds the shape unchanged and sends nothing',
      [DR_MODEL.getActiveTable() === fresh, sent.map((m) => m.topic)], [true, []]);

    if (fresh) forgetRegisteredTable(fresh);
  });
})();

// Turning a table off resets its cells and keeps its settings, so the next
// press simplifies it again under the settings it had.
(function issue328_anOffPressKeepsTheTablesSettings() {
  runPressFixture(() => {
    const table = makePressTable('8,584,629');
    DR_MODEL.setTableSettings(table, Object.assign({}, ISSUE328_LIGHT, { enabled: false }), 'page');
    DR_MODEL.setActiveTable(table);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('per-table settings: a press simplifies under the table\'s own offsets',
      table._cells[3].innerText, '8,580,000');
    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('per-table settings: an off press keeps the table\'s offsets',
      [issue328SettingsOf(table).enabled, issue328SettingsOf(table).offsetTop], [false, -2]);
    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('per-table settings: the next on press simplifies under those offsets again',
      table._cells[3].innerText, '8,580,000');
  });
})();

// A shape change registers a new table. It holds no settings, so it reads the
// shipped defaults, and it shows the page's original values, the same as a table
// found on page load. Nothing from the replaced table's settings reaches it.
(function issue328_aShapeChangeRegistersANewTableUnderTheDefaults() {
  runPressFixture(({ writes, resetWrites }) => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setTableSettings(grid.scrollPaneEl,
      Object.assign({}, ISSUE328_LIGHT, { rangeExpr: 'B2' }), 'page');
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 101)));

    resetWrites();
    let outcome = null;
    withTablePillboxDocumentMock(function () { outcome = revalidateTableShape(grid.scrollPaneEl); });
    const fresh = outcome && outcome.table;

    eq('per-table settings: the shape change registers a fresh table (precondition)',
      outcome && outcome.switched, true);
    eq('per-table settings: the fresh table reads the shipped defaults',
      fresh && DR_MODEL.getTableSettings(fresh), Object.assign({}, DR_DEFAULTS));
    eq('per-table settings: the fresh table shows the original',
      fresh && showsSimplified(fresh), false);
    eq('per-table settings: the shape change writes no table\'s settings',
      writes(), 0);

    if (fresh) forgetRegisteredTable(fresh);
  });
})();

// The settings notice crosses to the sidebar, so it carries plain values
// alone: which side wrote it and the table's whole settings. A live table
// element cannot cross.
(function issue328_theSettingsNoticeReachesTheExtensionPages() {
  runPressFixture(({ sent }) => {
    const active = makePressTable('12,345');
    DR_MODEL.setActiveTable(active);
    sent.length = 0;
    DR_MODEL.setTableSettings(active, { offsetTop: 1 }, 'page');
    DR_MODEL.setTableSettings(active, { offsetTop: -1 }, 'sidebar');

    const notices = sent.filter((m) => m.topic === 'state:settingsChanged');
    eq('per-table settings: each write sends one notice, marking its source',
      notices.map((n) => n.source), ['page', 'sidebar']);
    eq('per-table settings: the notice holds no field beyond the two plain values',
      notices.length > 0 && Object.keys(notices[0]).sort(), ['settings', 'source', 'topic']);
    eq('per-table settings: the notice carries the table\'s whole settings, defaults filled in',
      notices.length > 0 && notices[0].settings, Object.assign({}, DR_DEFAULTS, { offsetTop: 1 }));
  });
})();

// ---------------------------------------------------------------------------
// The comparison at the two controller entry points
// ---------------------------------------------------------------------------
//
// The rule these assertions pin:
//   - Every action on a registered table compares the table's current shape
//     against the fingerprint the registry recorded, before it acts.
//   - A match changes nothing.
//   - A mismatch discards the entry whole, re-runs the nomination step from
//     the nest's chain root, registers the result, makes it active, and
//     publishes the table-switched topic. The fresh registration can land on
//     a different element than the one the action named.
//   - Nothing registering stops the action. The active table clears when the
//     discarded table was the active one.
//   - A table with no recorded fingerprint compares against nothing and
//     counts as a match.
//   - The fresh table is a new table: it reads the shipped defaults and shows
//     raw.
//
// Every expected value below comes from that statement, never from the
// controller's source.

// --- scrolling a virtualized grid, which changes the drawn row
// count, does not trip the fingerprint. Shape one: a grid that groups its data
// rows, with the header row outside the group. A scroll replaces the group's
// rows and leaves the header row alone. ---

(function shapeFingerprint_criterion1a_aRedrawnRowGroupKeepsTheEntry() {
  runPressFixture(({ sent }) => {
    const g = makeScrollingRowgroupGrid(['Region', 'Q1'], [
      ['North', '1,482,391'], ['South', '918,554'], ['East', '55,120'],
    ]);
    registerFingerprintedTable(g.wrapperEl);
    DR_MODEL.setActiveTable(g.wrapperEl);
    const recorded = DR_MODEL.getTableFingerprint(g.wrapperEl);
    const scrolledAwayCell = g.dataRowEls()[0].children[1];
    DR_MODEL.setTableOriginal(g.wrapperEl, scrolledAwayCell,
      { value: '1,482,391', pieces: [{ text: '1,482,391', written: '1,482,391' }] });

    // The scroll: a different set of rows, and fewer of them.
    g.redraw([['West', '7,314'], ['Inland', '2,905']]);

    sent.length = 0;
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: g.wrapperEl });
    });

    eq('fingerprint scroll: a redrawn row group leaves the recorded fingerprint in place',
      DR_MODEL.getTableFingerprint(g.wrapperEl) === recorded, true);
    eq('fingerprint scroll: a redrawn row group publishes no table switch',
      sent.filter((m) => m.topic === 'state:tableSwitched').length, 0);
    eq('fingerprint scroll: a redrawn row group keeps the entry\'s originals',
      DR_MODEL.hasTableOriginal(g.wrapperEl, scrolledAwayCell), true);

    forgetRegisteredTable(g.wrapperEl);
  });
})();

// Shape two: a database query grid groups no rows, so its first row is a data
// row. The criterion holds here because the reading leaves that row's text
// out: the pane's fingerprint is its column count, which a scroll keeps.

(function shapeFingerprint_criterion1b_aRedrawnGrouplessPaneKeepsTheEntry() {
  runPressFixture(({ sent }) => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    const recorded = DR_MODEL.getTableFingerprint(grid.scrollPaneEl);
    const scrolledAwayCell = grid.scrollRowEls[0].children[1];
    DR_MODEL.setTableOriginal(grid.scrollPaneEl, scrolledAwayCell,
      { value: '7,318,204', pieces: [{ text: '7,318,204', written: '7,318,204' }] });

    // The scroll: the pane draws a different, shorter set of rows at the same
    // column count.
    dgReplacePaneRows(grid.scrollPaneEl, [
      makeDgRow(6, ['golf', '44,190', '12.08']),
      makeDgRow(7, ['hotel', '9,715', '4.33']),
    ]);

    sent.length = 0;
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint scroll: a redrawn groupless pane leaves the recorded fingerprint in place',
      DR_MODEL.getTableFingerprint(grid.scrollPaneEl) === recorded, true);
    eq('fingerprint scroll: a redrawn groupless pane publishes no table switch',
      sent.filter((m) => m.topic === 'state:tableSwitched').length, 0);
    eq('fingerprint scroll: a redrawn groupless pane keeps the entry\'s originals',
      DR_MODEL.hasTableOriginal(grid.scrollPaneEl, scrolledAwayCell), true);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- What each shape reads on: a grid that groups its data rows compares its
// header row's texts, and a grid that groups nothing compares its column count
// alone. ---

(function shapeFingerprint_aGroupedGridsHeaderTextChangeTripsTheCheck() {
  runPressFixture(() => {
    const g = makeScrollingRowgroupGrid(['Region', 'Q1'], [
      ['North', '1,482,391'], ['South', '918,554'],
    ]);
    const removedTablePillboxes = registerFingerprintedTable(g.wrapperEl);
    DR_MODEL.setActiveTable(g.wrapperEl);

    g.headerRow.children[1].childNodes[0].nodeValue = 'Q2';

    let outcome = null;
    withTablePillboxDocumentMock(function () { outcome = revalidateTableShape(g.wrapperEl); });

    eq('fingerprint grouped header: a header text change reports a switch',
      outcome.switched, true);
    eq('fingerprint grouped header: the grid registers fresh',
      outcome.table === g.wrapperEl, true);
    eq('fingerprint grouped header: the discard takes the old table pillbox off the page',
      removedTablePillboxes.length, 1);
    eq('fingerprint grouped header: the fresh fingerprint carries the new header text',
      DR_MODEL.getTableFingerprint(g.wrapperEl),
      { columnCount: 2, headerTexts: ['Region', 'Q2'] });

    forgetRegisteredTable(g.wrapperEl);
  });
})();

// The same check on a table whose first row holds header cells alone: a native
// table and a grid with a row group register fresh when the header texts
// change at the same column count. A grid with no row group keeps its entry,
// because a virtualized grid can scroll its first row away.
(function shapeFingerprint_aHeaderCellsAloneFirstRowTripsTheCheckOnATableThatGroupsItsRows() {
  for (const [kind, grouped] of [['native', false], ['native', true], ['grid', false], ['grid', true]]) {
    const groups = kind === 'native' || grouped;
    const label = `${kind}, ${grouped ? 'with' : 'no'} row group`;
    runPressFixture(() => {
      const draw = (texts) => rwDrawTable(kind, [{ part: grouped ? 'body' : 'bare', grouped, rows: [
        texts.map((pieces) => ({ pieces, header: 'col' })),
        ['North', '1,482,391'], ['South', '918,554'],
      ] }]).table;
      const table = draw(['Region', 'Q1']);
      const removedTablePillboxes = registerFingerprintedTable(table);
      DR_MODEL.setActiveTable(table);
      eq(`fingerprint header cells (${label}): registration records ${groups ? 'the header texts' : 'the column count alone'} (precondition)`,
        DR_MODEL.getTableFingerprint(table), { columnCount: 2, headerTexts: groups ? ['Region', 'Q1'] : null });

      const headerCell = grouped ? table.children[0].children[0].children[1] : table.children[0].children[1];
      rwTextNodesOf(headerCell)[0].nodeValue = 'Q2';
      let outcome = null;
      withTablePillboxDocumentMock(function () { outcome = revalidateTableShape(table); });
      eq(`fingerprint header cells (${label}): a header text change ${groups ? 'reports a switch' : 'keeps the entry'}`, outcome.switched, groups);
      eq(`fingerprint header cells (${label}): ${groups ? 'the discard takes the old table pillbox off the page' : 'no table pillbox leaves the page'}`,
        removedTablePillboxes.length, groups ? 1 : 0);
      if (groups) {
        eq(`fingerprint header cells (${label}): the fresh fingerprint carries the new header text`,
          DR_MODEL.getTableFingerprint(table), { columnCount: 2, headerTexts: ['Region', 'Q2'] });
      }

      forgetRegisteredTable(table);
    });
  }
})();

(function shapeFingerprint_aGrouplessGridsFirstRowTextDoesNotTripTheCheck() {
  runPressFixture(() => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    const recorded = DR_MODEL.getTableFingerprint(grid.scrollPaneEl);

    dgReplaceRowCells(grid.scrollRowEls[0], ['golf', '44,190', '12.08']);
    let held = null;
    withTablePillboxDocumentMock(function () { held = revalidateTableShape(grid.scrollPaneEl); });
    eq('fingerprint groupless: a first-row text change reports no switch', held.switched, false);
    eq('fingerprint groupless: the recorded fingerprint stays in place',
      DR_MODEL.getTableFingerprint(grid.scrollPaneEl) === recorded, true);

    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 17)));
    let switched = null;
    withTablePillboxDocumentMock(function () { switched = revalidateTableShape(grid.scrollPaneEl); });
    eq('fingerprint groupless: a column count change reports a switch', switched.switched, true);
    eq('fingerprint groupless: the fresh fingerprint carries the new column count',
      DR_MODEL.getTableFingerprint(grid.scrollPaneEl).columnCount, 4);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- changing the column set trips the fingerprint. The entry is
// discarded, and a table pillbox press afterwards simplifies from the original. ---

// Shape one: the page redraws its rows one column wider, so every cell of the
// new result set is a fresh element carrying raw text.

(function shapeFingerprint_criterion2_aRedrawnWiderResultSetPressesFromRaw() {
  runPressFixture(({ sent }) => {
    const grid = makeDatabaseQueryGrid();
    const removedTablePillboxes = registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    const countCell = grid.scrollRowEls[1].children[1];

    // The first press simplifies, so the entry holds originals and the
    // cells wear the marker before the page changes anything.
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    eq('fingerprint column change: the first press simplifies the pane (precondition)',
      showsSimplified(grid.scrollPaneEl), true);
    eq('fingerprint column change: that press stored originals (precondition)',
      DR_MODEL.hasTableOriginal(grid.scrollPaneEl, countCell), true);

    // The page returns a result set one column wider.
    const measures = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const counts = ['7,318,204', '551,077', '2,140,663', '73,915', '10,428', '3,906'];
    const rates = ['284.51', '31.77', '58.02', '7.44', '2.19', '0.63'];
    const added = ['6,204,118', '412,905', '88,340', '9,127', '1,006', '771'];
    grid.scrollRowEls.forEach((rowEl, i) =>
      dgReplaceRowCells(rowEl, [measures[i], counts[i], rates[i], added[i]]));
    const addedCell = grid.scrollRowEls[1].children[3];

    sent.length = 0;
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint column change: the discard takes the old table pillbox off the page',
      removedTablePillboxes.length, 1);
    eq('fingerprint column change: the pane registers fresh',
      DR_MODEL.hasTable(grid.scrollPaneEl), true);
    eq('fingerprint column change: the fresh registration records the new column count',
      DR_MODEL.getTableFingerprint(grid.scrollPaneEl).columnCount, 4);
    eq('fingerprint column change: the press after the change turns simplification on',
      DR_MODEL.getTableSettings(grid.scrollPaneEl).enabled, true);
    eq('fingerprint column change: the pane shows simplified values',
      showsSimplified(grid.scrollPaneEl), true);
    eq('fingerprint column change: the fresh entry\'s originals carry the new column\'s text',
      DR_MODEL.getTableOriginalText(grid.scrollPaneEl, addedCell), '412,905');

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// Shape two: the page adds one cell to every row and leaves the rows' other
// cells in place. Those cells still carry the extension's own simplified text
// and its marker class, and the discard drops the originals that back them.

(function shapeFingerprint_criterion2_anAddedColumnOverSurvivingCellsPressesFromRaw() {
  runPressFixture(({ sent }) => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    const countCell = grid.scrollRowEls[1].children[1];

    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    eq('fingerprint added column: the first press simplifies the pane (precondition)',
      showsSimplified(grid.scrollPaneEl), true);

    const added = ['6,204,118', '412,905', '88,340', '9,127', '1,006', '771'];
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, added[i]));
    const addedCell = grid.scrollRowEls[1].children[3];

    sent.length = 0;
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint added column: the pane registers fresh',
      DR_MODEL.hasTable(grid.scrollPaneEl), true);
    eq('fingerprint added column: the fresh entry\'s originals carry the new column\'s text',
      DR_MODEL.getTableOriginalText(grid.scrollPaneEl, addedCell), '412,905');
    eq('fingerprint added column: the fresh entry\'s originals carry a surviving cell\'s raw text',
      DR_MODEL.getTableOriginalText(grid.scrollPaneEl, countCell), '551,077');

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// The restore runs before the discard, against the old entry while it still
// holds the originals, so a surviving cell shows the original at the moment the fresh
// entry records.
(function shapeFingerprint_theDiscardRestoresTheSurvivingCellsFirst() {
  runPressFixture(() => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);

    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    const countCell = grid.scrollRowEls[1].children[1];
    eq('fingerprint restore: the press simplified the count column (precondition)',
      countCell.childNodes[0].nodeValue !== '551,077', true);

    const added = ['6,204,118', '412,905', '88,340', '9,127', '1,006', '771'];
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, added[i]));

    let outcome = null;
    withTablePillboxDocumentMock(function () { outcome = revalidateTableShape(grid.scrollPaneEl); });

    eq('fingerprint restore: the check reports a switch', outcome.switched, true);
    eq('fingerprint restore: a surviving cell reads its raw text once the fresh entry records',
      countCell.childNodes[0].nodeValue, '551,077');
    eq('fingerprint restore: that cell carries no simplified marker',
      countCell.classList.contains('dr-ext-rounded'), false);
    eq('fingerprint restore: the fresh entry holds no original for that cell',
      DR_MODEL.hasTableOriginal(grid.scrollPaneEl, countCell), false);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- a discarded entry's originals never reach the fresh entry. ---

(function shapeFingerprint_criterion3_aDiscardedEntrysOriginalsStayBehind() {
  runPressFixture(() => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    const sentinelCell = grid.scrollRowEls[2].children[1];
    DR_MODEL.setTableOriginal(grid.scrollPaneEl, sentinelCell,
      { value: '2,140,663', pieces: [{ text: '2,140,663', written: '2,140,663' }] });
    eq('fingerprint originals: the entry holds the sentinel original (precondition)',
      DR_MODEL.hasTableOriginal(grid.scrollPaneEl, sentinelCell), true);

    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 1000)));

    let outcome = null;
    withTablePillboxDocumentMock(function () { outcome = revalidateTableShape(grid.scrollPaneEl); });

    eq('fingerprint originals: the check reports a switch', outcome.switched, true);
    eq('fingerprint originals: the fresh registration lands on the same pane',
      outcome.table === grid.scrollPaneEl, true);
    eq('fingerprint originals: the sentinel original does not reach the fresh entry',
      DR_MODEL.hasTableOriginal(grid.scrollPaneEl, sentinelCell), false);
    eq('fingerprint originals: the fresh entry holds an original for no cell of the grid',
      grid.scrollRowEls.some((rowEl) =>
        rowEl.children.some((cellEl) => DR_MODEL.hasTableOriginal(grid.scrollPaneEl, cellEl))),
      false);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- on a database query grid whose new result makes the pinned
// pane pass the data test, the fresh registration lands on the wrapper, the
// wrapper is active, and the old pane holds no table pillbox. ---

(function shapeFingerprint_criterion4_aNewResultSetMovesTheRegistrationOutward() {
  runPressFixture(({ sent }) => {
    const grid = makeDatabaseQueryGrid();
    withTablePillboxDocumentMock(function () { injectTablePillboxes(grid.wrapperEl); });
    eq('fingerprint move: the page registers the scrolling pane alone (precondition)',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_MODEL.hasTable(el)),
      [false, false, true]);
    const removedTablePillboxes = trackTablePillboxDetach(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);

    // The new result set: the pinned pane gains a second column, which makes
    // it pass the data test, and the scrolling pane comes back two columns
    // wide. Two elements then sit at the configured depth, and the edge rule
    // falls back outward to the wrapper.
    const labels = ['north', 'south', 'east', 'west', 'inland', 'coastal'];
    const measures = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const counts = ['7,318,204', '551,077', '2,140,663', '73,915', '10,428', '3,906'];
    grid.pinnedRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, labels[i]));
    grid.scrollRowEls.forEach((rowEl, i) => dgReplaceRowCells(rowEl, [measures[i], counts[i]]));

    sent.length = 0;
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint move: the fresh registration lands on the wrapper',
      DR_MODEL.hasTable(grid.wrapperEl), true);
    eq('fingerprint move: the wrapper becomes the active table',
      DR_MODEL.getActiveTable() === grid.wrapperEl, true);
    eq('fingerprint move: the discarded pane holds no registry entry',
      DR_MODEL.hasTable(grid.scrollPaneEl), false);
    eq('fingerprint move: the discarded pane\'s table pillbox comes off the page',
      removedTablePillboxes.length, 1);
    eq('fingerprint move: the wrapper carries a table pillbox',
      tablePillboxes.has(grid.wrapperEl), true);
    eq('fingerprint move: the move publishes one table switch',
      sent.filter((m) => m.topic === 'state:tableSwitched').length, 1);

    forgetRegisteredTable(grid.wrapperEl);
  });
})();

// --- a native table's fingerprint trips when its header row's text
// changes, and holds when a data cell's text changes. ---

(function shapeFingerprint_criterion5_aNativeTablesHeaderTextTripsTheFingerprint() {
  runPressFixture(() => {
    const table = makeTablePillboxTestTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
      [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    ]);
    const removedTablePillboxes = registerFingerprintedTable(table);
    DR_MODEL.setActiveTable(table);
    eq('fingerprint native: registration records the header row (precondition)',
      DR_MODEL.getTableFingerprint(table), { columnCount: 2, headerTexts: ['Region', 'Q1'] });

    // A data cell's text changes and the header row's does not.
    table.rows[1].cells[1].innerText = '918,554';
    table.rows[1].cells[1].textContent = '918,554';
    let held = null;
    withTablePillboxDocumentMock(function () { held = revalidateTableShape(table); });
    eq('fingerprint native: a data cell change reports no switch', held.switched, false);
    eq('fingerprint native: a data cell change returns the same table',
      held.table === table, true);
    eq('fingerprint native: a data cell change takes no table pillbox off the page',
      removedTablePillboxes.length, 0);

    // The header row's text changes.
    table.rows[0].cells[1].innerText = 'Q2';
    table.rows[0].cells[1].textContent = 'Q2';
    let switched = null;
    withTablePillboxDocumentMock(function () { switched = revalidateTableShape(table); });
    eq('fingerprint native: a header text change reports a switch', switched.switched, true);
    eq('fingerprint native: the native table registers fresh', switched.table === table, true);
    eq('fingerprint native: the discard takes the old table pillbox off the page',
      removedTablePillboxes.length, 1);
    eq('fingerprint native: the fresh fingerprint carries the new header text',
      DR_MODEL.getTableFingerprint(table), { columnCount: 2, headerTexts: ['Region', 'Q2'] });

    forgetRegisteredTable(table);
  });
})();

// --- A table with no recorded fingerprint compares against nothing. Only a
// first write through the registry's setters creates such an entry. ---

(function shapeFingerprint_anUnrecordedFingerprintCountsAsAMatch() {
  runPressFixture(() => {
    const table = makeTablePillboxTestTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
      [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    ]);
    const cell = table.rows[1].cells[1];
    DR_MODEL.setTableOriginal(table, cell,
      { value: '1,482,391', pieces: [{ text: '1,482,391', written: '1,482,391' }] });
    eq('fingerprint unrecorded: the entry carries no fingerprint (precondition)',
      DR_MODEL.getTableFingerprint(table), null);

    const outcome = revalidateTableShape(table);
    eq('fingerprint unrecorded: the check reports no switch', outcome.switched, false);
    eq('fingerprint unrecorded: the check returns the same table', outcome.table === table, true);
    eq('fingerprint unrecorded: the entry\'s originals stay',
      DR_MODEL.hasTableOriginal(table, cell), true);
    DR_MODEL.unregisterTable(table);
  });
})();

// --- Nothing registering stops the action. The page returns a narrower result
// set holding no number, so the column count trips the check and every element
// of the nest then fails the data test. ---

(function shapeFingerprint_nothingRegisteringStopsThePressAndClearsTheActiveTable() {
  runPressFixture(({ sent, writes, resetWrites }) => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);

    emptyTheDatabaseQueryGridOfNumbers(grid);

    resetWrites();
    sent.length = 0;
    const rows = logRowsDuring(() => withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    }));

    eq('fingerprint recovery: the shape change writes one row',
      rows, ['Dynamic Rounding: shape change · result: none registered']);
    eq('fingerprint recovery: no element of the nest holds a registry entry',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_MODEL.hasTable(el)),
      [false, false, false]);
    eq('fingerprint recovery: the discarded table was active, so the active table clears',
      DR_MODEL.getActiveTable() === null, true);
    eq('fingerprint recovery: the sidebar is told to re-read, so it shows the no-table state (#506)',
      sent.filter((m) => m.topic === 'state:previewSamplesChanged').length, 1);
    eq('fingerprint recovery: the press stops, so it makes no settings write', writes(), 0);
  });
})();

(function shapeFingerprint_nothingRegisteringLeavesAnotherActiveTableAlone() {
  runPressFixture(({ sent }) => {
    const other = makePressTable('1,000,000');
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(other);

    emptyTheDatabaseQueryGridOfNumbers(grid);

    sent.length = 0;
    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint recovery: a discarded table that was not active leaves the active table alone',
      DR_MODEL.getActiveTable() === other, true);
    eq('fingerprint recovery: a discarded table that was not active sends the sidebar no re-read',
      sent.some((m) => m.topic === 'state:previewSamplesChanged'), false);
  });
})();

// The restore runs before the discard on this path too: the page shows the original
// after a recovery that registers nothing. The narrowing keeps each row's
// simplified cell, so the surviving text is the extension's own until the
// restore puts the original back, and no entry remains to restore from after.
(function shapeFingerprint_theNothingRegisteringPathLeavesThePageReadingRaw() {
  runPressFixture(() => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setActiveTable(grid.scrollPaneEl);

    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    const countCell = grid.scrollRowEls[1].children[1];
    eq('fingerprint restore: the press simplified the count column (precondition)',
      countCell.childNodes[0].nodeValue !== '551,077', true);

    // The page narrows every row to its count cell and empties the pinned
    // rows, so no row of the nest holds two cells and nothing registers.
    grid.pinnedRowEls.forEach((rowEl) => dgKeepRowCells(rowEl, []));
    grid.scrollRowEls.forEach((rowEl) => dgKeepRowCells(rowEl, [1]));

    withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint restore: the nest holds no registry entry after the recovery',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_MODEL.hasTable(el)),
      [false, false, false]);
    eq('fingerprint restore: the surviving cell reads its raw text',
      countCell.childNodes[0].nodeValue, '551,077');
    eq('fingerprint restore: the surviving cell carries no simplified marker',
      countCell.classList.contains('dr-ext-rounded'), false);
  });
})();

// --- A press on a table whose shape changed presses a new table: the press
// turns it on under the shipped defaults, and nothing from the replaced
// table's settings reaches it. The press still applies once. ---

(function shapeFingerprint_aShapeChangeOnAPressUsesTheDefaults() {
  runPressFixture(({ sent }) => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_MODEL.setTableSettings(grid.scrollPaneEl,
      { enabled: false, offsetTop: -2, rangeExpr: 'B2' }, 'page');
    DR_MODEL.setActiveTable(grid.scrollPaneEl);
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 101)));

    sent.length = 0;
    const rows = logRowsDuring(() => withTablePillboxDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    }));
    const fresh = DR_MODEL.getActiveTable();

    eq('fingerprint move: beside the press\'s settings change row, the shape change writes one row and no unregister row',
      rows.filter((text) => !/settings change/.test(text)),
      ['Dynamic Rounding: shape change · result: registered']);
    eq('fingerprint move: the fresh table holds the shipped defaults with the press\'s on',
      fresh && DR_MODEL.getTableSettings(fresh), Object.assign({}, DR_DEFAULTS, { enabled: true }));
    eq('fingerprint move: a shape change still runs exactly one apply',
      sent.filter((m) => m.topic === 'state:rangeOk' || m.topic === 'state:rangeError').length, 1);
    eq('fingerprint move: a shape change publishes the table switch once',
      sent.filter((m) => m.topic === 'state:tableSwitched').length, 1);
    const notices = sent.filter((m) => m.topic === 'state:settingsChanged');
    eq('fingerprint move: the press sends the one settings notice, holding its on under the defaults',
      notices.map((m) => [m.source, m.settings.enabled, m.settings.offsetTop, m.settings.rangeExpr]),
      [['page', true, DR_DEFAULTS.offsetTop, '']]);

    if (fresh) forgetRegisteredTable(fresh);
  });
})();

// --- A sidebar apply on a table the page refilled. No notice may reach the
// sidebar with values from before the apply: it would redraw the controls to
// them, and a keystroke before the switch's pull would land on a blanked
// range box. The switch leads, and the one settings notice is the apply's
// own. ---

(function issue328_aSidebarApplyOnARefilledTableSendsOnlyTheWrittenSettings() {
  runPressFixture(({ sent }) => {
    const table = makeTablePillboxTestTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
      [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    ]);
    registerFingerprintedTable(table);
    DR_MODEL.setTableSettings(table, { offsetTop: -2, rangeExpr: 'B2' }, 'page');
    DR_MODEL.setActiveTable(table);

    table.rows[0].cells[1].innerText = 'Q2';
    table.rows[0].cells[1].textContent = 'Q2';
    const written = Object.assign({}, DR_DEFAULTS, { offsetTop: 1, rangeExpr: 'C3' });

    sent.length = 0;
    withCreateTreeWalker(function () {
      withTablePillboxDocumentMock(function () {
        askContentScript({ topic: 'request:applySettings', settings: written });
      });
    });

    const sequence = sent
      .filter((m) => m.topic === 'state:settingsChanged' || m.topic === 'state:tableSwitched')
      .map((m) => (m.topic === 'state:tableSwitched'
        ? 'switched'
        : 'settings source=' + m.source + ' offsetTop=' +
          m.settings.offsetTop + ' range=' + m.settings.rangeExpr));
    eq('refilled apply: the switch leads, and the apply sends the one settings notice',
      sequence, [
        'switched',
        'settings source=sidebar offsetTop=1 range=C3',
      ]);
    eq('refilled apply: the table stays the active one',
      DR_MODEL.getActiveTable() === table, true);
    eq('refilled apply: the table holds the written settings',
      DR_MODEL.getTableSettings(table), written);

    forgetRegisteredTable(table);
  });
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
  const { model, bus } = makeIsolatedModel();
  const empty = { hasError: false, count: 0, rows: [] };
  eq('error state: a fresh model holds no error', model.getErrorState(), empty);

  const published = [];
  bus.subscribe('state:errorRecorded', (payload) => { published.push(payload); });
  const row = { at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'probe row', stack: 'at probe' };
  model.recordError(row);
  eq('error state: recording a row sets the indicator and the count',
    { hasError: model.getErrorState().hasError, count: model.getErrorState().count },
    { hasError: true, count: 1 });
  eq('error state: the recorded row keeps its time, level, text, and stack trace',
    model.getErrorState().rows[0], row);
  eq('error state: recording publishes the whole error state as a state change',
    published, [{ errorState: { hasError: true, count: 1, rows: [row] } }]);

  const read = model.getErrorState();
  read.rows[0].text = 'mutated';
  read.rows.push({});
  eq('error state: the getter returns copies', model.getErrorState().rows, [row]);

  for (let i = 0; i < 60; i++) {
    model.recordError({ at: 'x', level: 'warn', text: 'row ' + i, stack: null });
  }
  eq('error state: the rows hold at most 50 while the count keeps counting',
    { rows: model.getErrorState().rows.length, count: model.getErrorState().count },
    { rows: 50, count: 61 });
  eq('error state: the newest row survives the cap',
    model.getErrorState().rows[49].text, 'row 59');

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
  const before = DR_MODEL.getErrorState().count;
  const origError = console.error;
  console.error = () => {};
  try {
    DR_LOG.warn('controller error probe');
    const afterWarn = DR_MODEL.getErrorState();
    eq('controller: a warn row lands in the model\'s error state',
      { count: afterWarn.count, hasError: afterWarn.hasError,
        text: afterWarn.rows.slice(-1)[0] && afterWarn.rows.slice(-1)[0].text },
      { count: before + 1, hasError: true, text: 'controller error probe' });
    eq('controller: the recorded row carries the stack trace of the call that logged it',
      /controllerRoutesErrorRows/.test((afterWarn.rows.slice(-1)[0] || {}).stack || ''), true);
    DR_LOG.error('controller error-level probe');
    eq('controller: an error row lands in the model\'s error state',
      DR_MODEL.getErrorState().count, before + 2);
    DR_LOG.debug('controller debug probe');
    DR_LOG.info('controller info probe');
    eq('controller: debug and info rows stay out of the error state',
      DR_MODEL.getErrorState().count, before + 2);
  } finally {
    console.error = origError;
  }
})();

// --- The responders answer through the bus ---
//
// The redraw read carries a rule the source assertions above cannot see:
// with no table active it answers the shipped defaults beside a pair of nulls
// rather than nothing, because the sidebar reads a null samples field as the
// unbound state. This drives the content script's own bus listener the way Chrome
// does, in an isolated eval so the shared-scope model stays untouched.
(function movedRespondersAnswerThroughTheBus() {
  const capturedListeners = [];
  function fire(message) {
    let answer;
    for (const fn of capturedListeners) fn(message, {}, (r) => { answer = r; });
    return answer;
  }

  const saved = { chrome: global.chrome, document: global.document, window: global.window };
  global.chrome = {
    runtime: {
      onMessage: { addListener(fn) { capturedListeners.push(fn); } },
      sendMessage: () => {},
      lastError: null,
    },
  };
  global.document = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };
  global.window = {
    addEventListener: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  try {
    eval(contentScriptBundle);
  } catch (e) {
    // Module-level code may fail in the stub environment; the bus's listener
    // registers before any dynamic code runs.
  } finally {
    global.chrome = saved.chrome;
    global.document = saved.document;
    global.window = saved.window;
  }

  eq('moved responders: the bus listener was captured', capturedListeners.length, 1);
  if (capturedListeners.length === 0) return;

  // Nothing has been right-clicked in this isolated model.
  eq('moved responders: no active table answers the shipped defaults and a pair of nulls, not nothing',
    fire({ topic: 'request:activeTable' }),
    { settings: Object.assign({}, DR_DEFAULTS), samples: null, maxMag: null });

  const captureAnswer = fire({ topic: 'request:captureState' });
  eq('moved responders: the capture state answers an object',
    captureAnswer !== null && typeof captureAnswer === 'object', true);
})();

// The redraw read takes the settings and the lens preview from one active
// table, and holds no bound field: the sidebar reads bound from the samples.
(function redrawReadAnswersFromTheActiveTable() {
  runPressFixture(() => {
    DR_MODEL.setActiveTable(null);
    eq('redraw read: with no table active the answer holds the shipped defaults and null samples',
      askContentScript({ topic: 'request:activeTable' }),
      { settings: Object.assign({}, DR_DEFAULTS), samples: null, maxMag: null });

    const table = makePressTable('4,236,000');
    DR_MODEL.setTableSettings(table, { offsetTop: -1, simplifyFirstColumn: true }, 'page');
    DR_MODEL.setActiveTable(table);
    let answer;
    withCreateTreeWalker(() => { answer = askContentScript({ topic: 'request:activeTable' }); });
    eq('redraw read: the answer holds exactly the settings, the samples, and the max magnitude',
      answer && Object.keys(answer).sort(), ['maxMag', 'samples', 'settings']);
    eq('redraw read: the settings are the active table\'s',
      answer && answer.settings, DR_MODEL.getTableSettings(table));
    let expected;
    withCreateTreeWalker(() => { expected = extractPreviewSamples(table); });
    eq('redraw read: the samples and max magnitude are the active table\'s lens preview',
      answer && [answer.samples, answer.maxMag], [expected.samples, expected.maxMag]);
    eq('redraw read: an active table that holds a number answers samples, so the sidebar binds',
      answer && answer.samples !== null && answer.samples.top.length > 0, true);
  });
})();

// --- Test 10: a shape change during a pass. The table re-detects as a new
// table and shows the original under the shipped defaults; the active table changes
// only when the changed table was the active one. ---
(function rewrite10_aShapeChangeDuringAPassReDetects() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const header = ['Region', 'Q1', 'Q2'];
    const rows = [['North', '1,234', '5,678'], ['South', '2,468', '3,579']];
    const active = build(rows, { header });
    const other = build(rows, { header });
    const savedActive = DR_MODEL.getActiveTable();
    let switches = 0;
    const unsubscribe = DR_BUS.subscribe('state:tableSwitched', () => { switches++; });
    try {
      withTablePillboxDocumentMock(() => {
        registerDataTable(active.table);
        registerDataTable(other.table);
        DR_MODEL.setTableSettings(active.table,
          Object.assign({}, RW_OPTS, { simplifyFirstRow: false, enabled: true }), 'page');
        DR_MODEL.setActiveTable(active.table);
        applySidebarRounding(active.table);
        roundTableUnder(other.table, Object.assign({}, RW_OPTS, { simplifyFirstRow: false }));

        other.headerWrite(2, 'Q3');
        page.settle();
        eq(`#421 shape change (${kind}): a change on the inactive table leaves the active table alone`,
          { selected: DR_MODEL.getActiveTable() === active.table, switches }, { selected: true, switches: 0 });
        eq(`#421 shape change (${kind}): the changed table registers fresh with the new header`,
          (DR_MODEL.getTableFingerprint(other.table) || {}).headerTexts, ['Region', 'Q1', 'Q3']);
        eq(`#421 shape change (${kind}): the changed table shows the original, under the shipped defaults`,
          { rounded: showsSimplified(other.table), texts: other.rowTexts(),
            settings: DR_MODEL.getTableSettings(other.table) },
          { rounded: false, texts: [['North', '1,234', '5,678'], ['South', '2,468', '3,579']],
            settings: Object.assign({}, DR_DEFAULTS) });

        active.headerWrite(2, 'Q3');
        page.settle();
        eq(`#421 shape change (${kind}): a change on the active table moves the active table to the fresh entry`,
          { selected: DR_MODEL.getActiveTable() === active.table, switches }, { selected: true, switches: 1 });
        eq(`#421 shape change (${kind}): the active table shows the original, under the shipped defaults`,
          { rounded: showsSimplified(active.table), texts: active.rowTexts(),
            settings: DR_MODEL.getTableSettings(active.table) },
          { rounded: false, texts: [['North', '1,234', '5,678'], ['South', '2,468', '3,579']],
            settings: Object.assign({}, DR_DEFAULTS) });
      });
    } finally {
      unsubscribe();
      DR_MODEL.setActiveTable(null);
      DR_MODEL.setActiveTable(savedActive);
    }
  });
})();

// A cell whose patch lands nothing counts as left as written for a text
// mismatch, on both table kinds. The native cell's rendered text differs
// from its one piece in more than whitespace; the grid cell's text changes
// between classification and the write. Either way no number sits where the
// pass expects it.
(function rewriteTextMismatchCountsTheCell() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    let restoreMagnitude = null;
    if (kind === 'native') {
      t.redraw(1, 1, '3,578');
      Object.defineProperty(t.cell(1, 1), 'innerText', { get: () => '3,579' });
    } else {
      const setMaxMagnitude = DR_MODEL.setTableMaxMagnitude;
      DR_MODEL.setTableMaxMagnitude = function (table, value) {
        t.pieces(1, 1)[0].nodeValue = '3,578';
        return setMaxMagnitude.call(DR_MODEL, table, value);
      };
      restoreMagnitude = () => { DR_MODEL.setTableMaxMagnitude = setMaxMagnitude; };
    }
    let result = null;
    try {
      result = roundTableUnder(t.table, RW_OPTS);
    } finally {
      if (restoreMagnitude) restoreMagnitude();
    }
    eq(`#421 text mismatch (${kind}): the pass counts one cell as left as written`,
      result.leftAsWritten.textMismatch, 1);
  });
})();

// --- The settings change row ---
//
// One apply writes one row: on/off, and the count of numbers the pass left as
// written, by reason. The cells are test page section 25's: a number that
// inline styling splits, alone and beside a number that rounds. The exact
// row proves no page text reaches it.
const SETTINGS_CHANGE_ROWS = [[['6,7', { tag: 'b', text: '18,245' }],
  ['6,7', { tag: 'b', text: '18,245' }, ' beside 4,523']]];

(function settingsChange_oneRowPerApply() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const rowsOf = (table, opts) => {
      const rows = [];
      const offRow = DR_LOG.onRow((row) => rows.push(row.text));
      try {
        DR_MODEL.setTableSettings(table, opts, 'page');
        withTablePillboxDocumentMock(() => applySidebarRounding(table));
      } finally {
        offRow();
      }
      return rows;
    };
    const t = build(SETTINGS_CHANGE_ROWS);
    eq(`settings change (${kind}): turning a table on writes one row with the split numbers counted`,
      rowsOf(t.table, Object.assign({}, RW_OPTS, { enabled: true })),
      ['Dynamic Rounding: settings change · on/off: on · left as written: split number 2']);
    eq(`settings change (${kind}): turning a table off writes one row`,
      rowsOf(t.table, Object.assign({}, RW_OPTS, { enabled: false })),
      ['Dynamic Rounding: settings change · on/off: off']);
    eq(`settings change (${kind}): an invalid range expression writes one row with no count`,
      rowsOf(t.table, Object.assign({}, RW_OPTS, { enabled: true, rangeExpr: 'not a range' })),
      ['Dynamic Rounding: settings change · on/off: on']);
    const words = build([['Revenue grew to 1,234 units', 'Costs fell 5,678 dollars'],
      ['Margin of 2,468 points', ['Ref 3,5', { tag: 'b', text: '79' }, ' total']]]);
    const wordRows = rowsOf(words.table, Object.assign({}, RW_OPTS, { enabled: true }));
    eq(`settings change (${kind}): a table whose cells hold words writes one row holding no page text`,
      wordRows.length === 1 &&
        /^Dynamic Rounding: settings change · on\/off: on( · left as written: [a-z ,0-9]+)?$/.test(wordRows[0]),
      true);
  });
})();
