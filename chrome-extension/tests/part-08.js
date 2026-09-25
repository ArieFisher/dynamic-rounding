// ---------------------------------------------------------------------------
// Sprint pillbox-bidirectional-sync: acceptance criteria
//
// AC1: Clicking the table's morph pill while sidebar is open changes
//      enabledEl.checked to match the table's new rounded/unrounded state
//      (sidebar handler updates the checkbox).
//
// AC2: Clicking the sidebar's enabled toggle still updates the table's pill
//      state (existing behaviour unchanged — regression guard).
//
// AC3: Toggling a table that is NOT lastRightClickedTable does NOT send
//      state:tableEnabledChanged (no spurious sidebar update).
//
// AC4: background.js does NOT relay state:tableEnabledChanged when sidebarTabId is null.
//
// AC5: Existing tests pass (covered by running the full suite without --bail).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC1: Clicking the table's morph pill while sidebar is open sends
//      state:tableEnabledChanged to runtime, and sidebar's onMessage handler for
//      state:tableEnabledChanged sets enabledEl.checked = request.enabled.
//
// Unit test strategy:
//   Part A — ui-toggle.js guard: verify state:tableEnabledChanged is sent when
//     the pressed table is the active one.
//   Part B — sidebar.js handler (static): verify the source includes the
//     state:tableEnabledChanged branch that sets enabledEl.checked.
//   Note: actually exercising sidebar.js in Node requires eval'ing it, which
//   demands a full sidebar DOM. We test the handler logic indirectly via Part B
//   static analysis plus the integration guard in Part A.
// ---------------------------------------------------------------------------

(function pillbox_AC1_partA_sendMessageOnActiveTable() {
  // Capture sendMessage calls.
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  // Set state: the table we create below becomes the active one.
  lastRightClickedTable = null;

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'H1' },        { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);

  // Establish this table as the active one, so the press is an unmoved one.
  lastRightClickedTable = table;

  // Click should publish intent:toggleTable (rounding the table) then send state:tableEnabledChanged.
  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;
  // Reset global state
  lastRightClickedTable = null;

  const toggleMsg = sent.find(m => m.action === 'state:tableEnabledChanged');
  eq('AC1 part-A: state:tableEnabledChanged sent when the pressed table is the active one',
    toggleMsg !== undefined, true);
  // After click on a fresh table, it becomes rounded → enabled should be true.
  eq('AC1 part-A: state:tableEnabledChanged.enabled reflects new rounded state (true after first click)',
    toggleMsg && toggleMsg.enabled, true);
})();

(function pillbox_AC1_partB_sidebarHandlerStaticAnalysis() {
  // Verify sidebar.js source contains the state:tableEnabledChanged handler that sets enabledEl.checked.
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq("AC1 part-B: sidebar.js subscribes to 'state:tableEnabledChanged'",
    /boundTab\.subscribe\(\s*'state:tableEnabledChanged'/.test(sidebarSrc), true);
  eq('AC1 part-B: sidebar.js puts the reported value on the switch',
    sidebarSrc.includes('enabledEl.checked = enabled'), true);
  eq('AC1 part-B: sidebar.js calls updateDisabledState() after setting checked',
    sidebarSrc.includes('updateDisabledState()'), true);
})();

// ---------------------------------------------------------------------------
// AC2: Clicking the sidebar's enabled toggle still updates the table's pill
//      state (regression guard — existing path unchanged).
//
// The sidebar-to-table path goes through content.js's request:applySettings
// message handler. We test: (a) static guard the handler exists, (b) dynamic
// guard that a press still takes a table through the full round trip.
// ---------------------------------------------------------------------------

(function pillbox_AC2_sidebarToTablePath_regression() {
  // Static guard: content.js must still contain the request:applySettings
  // message handler that triggers rounding when the sidebar changes settings.
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('AC2 regression: source file content.js present in manifest', false, true);
    return;
  }
  eq('AC2 regression: content.js still handles request:applySettings message',
    contentSrc.includes('request:applySettings'), true);

  // Static guard: sidebar.js must still have enabledEl wired up.
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq('AC2 regression: sidebar.js still references enabledEl',
    sidebarSrc.includes('enabledEl'), true);

  // Dynamic guard: a press still takes a table on and back off. This ran
  // against a plain-toggle helper until the 2026-09-14 sidebar-state-removal
  // design retired it (#241); the press itself is the path now, so the intent
  // drives it. DR_DEFAULTS excludes row 0 (firstRow) and col 0 (firstColumn),
  // so only [row1, col1] is processed. Use 12,345, which rounds to 10,000.
  const table = makeToggleTable([
    [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
    [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
  ]);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });
  injectToggleEntry(table);

  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  try {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    DR_STORE.setSelectedTable(table);

    const wasRounded = isTableRounded(table);
    withCreateTreeWalker(function() { DR_BUS.publish('intent:toggleTable', { table }); });
    const isNowRounded = isTableRounded(table);

    eq('AC2 regression: a press takes a raw table to simplified',
      !wasRounded && isNowRounded, true);

    withCreateTreeWalker(function() { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('AC2 regression: a second press takes it back to its original values',
      isTableRounded(table), false);
  } finally {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// ---------------------------------------------------------------------------
// AC3: Guard branching on lastRightClickedTable.
//
// SPEC says: "Toggling a table that is NOT lastRightClickedTable does not send
// state:tableEnabledChanged (no spurious sidebar update)."
//
// IMPLEMENTATION BEHAVIOUR (found by adversarial test):
// When table !== lastRightClickedTable, the click handler first reassigns
// `lastRightClickedTable = table` (and sends state:tableSwitched), then
// the state:tableEnabledChanged guard re-checks — and now `table === lastRightClickedTable`
// is TRUE, so state:tableEnabledChanged IS sent.
//
// This is a gap between the spec (AC3) and the implementation. The test below
// documents the ACTUAL implementation behaviour so the reviewer can decide
// whether the spec or the code is correct.
// ---------------------------------------------------------------------------

(function pillbox_AC3_wrongTable_reassignsAndSendsState() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };


  const { table: tableA, buttonEl: buttonA } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
  ]);
  const { table: tableB } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '2,000,000' }, { tag: 'td', text: '300' }],
  ]);

  // lastRightClickedTable is tableB; we click tableA's button.
  lastRightClickedTable = tableB;

  fireMouseClick(buttonA);

  const switchMsgs  = sent.filter(m => m.action === 'state:tableSwitched');
  const toggleMsgs  = sent.filter(m => m.action === 'state:tableEnabledChanged');
  const lrc = lastRightClickedTable;

  global.chrome.runtime.sendMessage = origSend;
  lastRightClickedTable = null;

  // Implementation reassigns lastRightClickedTable to the clicked table.
  eq('AC3 impl: clicking non-lastRightClickedTable reassigns lastRightClickedTable',
    lrc === tableA, true);

  // Implementation sends state:tableSwitched for the table switch.
  eq('AC3 impl: clicking non-lastRightClickedTable sends state:tableSwitched',
    switchMsgs.length >= 1, true);

  // The AC3 spec ("toggling a non-selected table sends no state:tableEnabledChanged")
  // is satisfied since issue #251's sync-on-switch: the switch path applies
  // the model to the new table and returns before the same-table
  // state:tableEnabledChanged send, and the panel redraws from the model pull that
  // state:tableSwitched triggers instead.
  eq('AC3: clicking non-lastRightClickedTable sends NO state:tableEnabledChanged (panel redraws from the model pull)',
    toggleMsgs.length, 0);
})();

// AC3 guard that DOES hold: when lastRightClickedTable is null,
// the early-exit prevents state:tableEnabledChanged from being sent.
(function pillbox_AC3_noLastRightClicked_noMessage() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  lastRightClickedTable = null; // explicitly null

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '200' }],
  ]);

  // lastRightClickedTable remains null; guard `lastRightClickedTable &&` prevents send.
  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;
  lastRightClickedTable = null;

  const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
  eq('AC3 null-guard: null lastRightClickedTable means state:tableEnabledChanged is NOT sent',
    toggleMsgs.length, 0);
})();

// AC3 corollary: when lastRightClickedTable is null (no table right-clicked),
// clicking any morph pill also does NOT send state:tableEnabledChanged.
(function pillbox_AC3_noLastRightClicked_noMessage_corollary() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  lastRightClickedTable = null; // explicitly null

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '200' }],
  ]);

  // lastRightClickedTable remains null; guard `lastRightClickedTable &&` prevents send.
  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;

  const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
  eq('AC3 corollary: null lastRightClickedTable means state:tableEnabledChanged is NOT sent',
    toggleMsgs.length, 0);
})();

// AC3 corollary 2: a press on the active table publishes the settings
// record's new value, whatever the sidebar is doing. Nothing here reads that.
(function pillbox_AC3_sidebarClosed_noMessage() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '3,000,000' }, { tag: 'td', text: '100' }],
  ]);
  lastRightClickedTable = table; // same table, but sidebar is closed

  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;
  lastRightClickedTable = null;

  const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
  // Contract moved with the panel-state decoupling (issue #272 family): a
  // toggle on the CONNECTED table writes the record and reports it even with
  // the sidebar closed — the controller no longer reads panel visibility.
  // "No spurious sidebar update" still holds because a closed sidebar has no
  // page to receive the message; background additionally gates its relay on
  // sidebarTabId (AC4 below).
  eq('AC3 corollary 2: a press on the active table publishes the settings record once (a closed sidebar has no page to receive it)',
    toggleMsgs.length, 1);
})();

// ---------------------------------------------------------------------------
// AC4: background.js does NOT relay state:tableEnabledChanged when sidebarTabId is null.
//
// background.js runs in a service-worker context without the DOM and module
// system our harness uses, so we can't eval() it directly alongside the content
// scripts. Instead we test the guard at two levels:
//   (a) Static analysis: the source contains the null-guard exactly as specced.
//   (b) Extracted-logic test: inline a minimal reproduction of the guard and
//       verify its branching behaviour, confirming the written code is correct.
// ---------------------------------------------------------------------------

// --- #325 Task 8: the on/off report reaches the sidebar exactly once ---
//
// The content script broadcasts the on/off report to every extension page,
// which already includes the open sidebar. The worker used to receive that
// broadcast and send it again, so the sidebar redrew twice on one fact, and
// the worker guarded the re-send on holding a sidebar tab number to keep the
// second delivery from going out with no sidebar open. The relay is gone, and
// with it the guard it needed. What replaces both: one publisher, one
// delivery.
(function onOffReportDeliveredOnce() {
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  eq('one delivery: the worker subscribes to no on/off report',
    /subscribe\(\s*'state:tableEnabledChanged'/.test(bgSrc), false);
  eq('one delivery: the worker publishes no on/off report',
    /publish\(\s*'state:tableEnabledChanged'/.test(bgSrc), false);
  eq('one delivery: the worker makes no wire send of its own for anything',
    bgSrc.includes('chrome.runtime.sendMessage'), false);
})();

// Sprint table-contextmenu-activation
// ---------------------------------------------------------------------------
// AC1: Right-clicking a table causes flashTargetedTable to run on that table.
// AC2: state:tableActivated onMessage in sidebar.js calls flashSidebarContainer.
// AC3: Right-clicking a non-table element produces NO flash and NO state:tableActivated send.
// AC4: background.js does NOT relay state:tableActivated when sidebarTabId is null.
// ---------------------------------------------------------------------------
//
// Runtime note: the main eval() above registered document.addEventListener with
// the no-op stub, so the contextmenu handler is not capturable from the
// already-evaluated code.  ACs 1 and 3 are therefore verified in two layers:
//   (a) live runtime: call flashTargetedTable() directly and assert its effect
//       (it is in global scope after the eval), confirming that the mechanism
//       the handler uses actually works.
//   (b) source-level: regex-assert that the contextmenu handler in content.js
//       correctly calls flashTargetedTable(table) inside the `if (table)` guard
//       and does NOT call it when there is no table.
// ACs 2 and 4 are pure source-level (sidebar.js / background.js have no eval
// path in this harness).
//
// Additionally, a second eval with a capturing stub is used to exercise the
// contextmenu handler end-to-end for ACs 1 and 3.
// ---------------------------------------------------------------------------

(function tableContextmenuActivation_sourceLevel() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('table-activation source: source file content.js present in manifest', false, true);
    return;
  }
  const bgSrc      = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // AC1 (source): contextmenu handler calls flashTargetedTable(table) inside
  // the `if (found)` guard. Sprint extract-dr-table: findTargetTable now
  // reports { handle, isNew } instead of the table itself, so the handler
  // guards on `found` and derives `table` from markAndToggleIfNewGrid(found)
  // before flashing it.
  // Pattern: `if (found) { ... flashTargetedTable(table) ...` within the handler.
  eq('table-activation AC1 source: contextmenu handler calls flashTargetedTable(table)',
    /if\s*\(\s*found\s*\)[\s\S]{0,300}flashTargetedTable\(\s*table\s*\)/.test(contentSrc),
    true);

  // AC1 (source): the call to flashTargetedTable is inside the `if (found)` block
  // — it cannot appear BEFORE the guard.
  // We verify that flashTargetedTable does NOT appear before the first `if (found)`.
  const contextmenuMatch = contentSrc.match(/document\.addEventListener\s*\(\s*['"]contextmenu['"][\s\S]*?\}\s*,\s*true\s*\)/);
  const handlerSrc = contextmenuMatch ? contextmenuMatch[0] : '';
  const flashIndex = handlerSrc.indexOf('flashTargetedTable');
  const guardIndex = handlerSrc.indexOf('if (found)');
  eq('table-activation AC1 source: flashTargetedTable appears after if(found) guard in handler',
    flashIndex !== -1 && guardIndex !== -1 && flashIndex > guardIndex,
    true);

  // AC3 (source): state:tableActivated sendMessage is inside the `if (found)` block,
  // meaning a non-table right-click cannot trigger it.
  const sendMsgIndex = handlerSrc.indexOf('state:tableActivated');
  eq('table-activation AC3 source: state:tableActivated send is inside if(found) guard',
    sendMsgIndex !== -1 && sendMsgIndex > guardIndex,
    true);

  // AC2 (source): sidebar.js state:tableActivated handler calls flashSidebarContainer().
  eq('table-activation AC2 source: sidebar.js state:tableActivated handler calls flashSidebarContainer()',
    /state:tableActivated[\s\S]{0,120}flashSidebarContainer\s*\(\s*\)/.test(sidebarSrc),
    true);

  // AC2 (source): flashSidebarContainer adds the dr-sidebar-flash class to document.body.
  eq('table-activation AC2 source: flashSidebarContainer adds dr-sidebar-flash class',
    /flashSidebarContainer[\s\S]{0,300}classList\.add\s*\(\s*SIDEBAR_FLASH_CLASS\s*\)/.test(sidebarSrc),
    true);

  // AC4 (source): the worker neither publishes nor subscribes to the activation
  // report. The sidebar receives it straight from the content script over the
  // broadcast carrier, so the old relay only ever delivered it to a content
  // script with no handler. Runtime coverage lives in backgroundMessageRouting.
  eq('table-activation AC4 source: the worker does not publish the activation report',
    /publish\(\s*'state:tableActivated'/.test(bgSrc), false);
  eq('table-activation AC4 source: the worker does not subscribe to it either',
    /subscribe\(\s*'state:tableActivated'/.test(bgSrc), false);

  // AC4 (source): content.js reaches the sidebar directly, without the worker.
  // The topic's route is what decides that, so the route is the thing to pin.
  eq('table-activation AC4 source: content.js publishes the activation report',
    /DR_BUS\.publish\(\s*'state:tableActivated'/.test(contentSrc), true);
  eq('table-activation AC4 source: and its route reaches every extension page, the sidebar included',
    DR_BUS.TOPICS['state:tableActivated'].route, 'extension-pages');
})();

// ---------------------------------------------------------------------------
// AC1 + AC3 runtime: re-eval with a capturing document.addEventListener stub
// so the contextmenu handler can be invoked directly.
// ---------------------------------------------------------------------------
(function tableContextmenuActivation_runtime() {
  let capturedHandler = null;
  const captureDoc = {
    addEventListener(type, handler) {
      if (type === 'contextmenu') capturedHandler = handler;
    },
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };

  // Track calls to chrome.runtime.sendMessage.
  const sentMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage(msg) { sentMessages.push(msg); },
    },
  };

  // Run a fresh isolated eval of the content scripts with capturing stubs.
  // We shadow global.document and global.chrome temporarily so the module-level
  // registration picks them up.  We restore them AFTER the handler has been
  // exercised, because the handler references global.chrome at call time (not
  // via a closure snapshot), so the stubs must remain active during the call.
  const savedDoc    = global.document;
  const savedChrome = global.chrome;
  global.document = captureDoc;
  global.chrome   = captureChrome;

  try {
    // Eval content scripts; the contextmenu listener is registered against captureDoc.
    // contentScriptBundle is already the manifest-order concatenation of all
    // content scripts (see the bootstrap section above).
    eval(contentScriptBundle);

    eq('table-activation runtime: contextmenu handler was captured',
      typeof capturedHandler, 'function');

    if (typeof capturedHandler !== 'function') {
      eq('table-activation AC1 runtime: handler capture required (skipped)', false, true);
      eq('table-activation AC3 runtime: handler capture required (skipped)', false, true);
      return;
    }

    // --- AC1: right-clicking a table flashes that table AND sends state:tableActivated ---
    const flashedClasses = [];
    const mockTable = {
      tagName: 'TABLE',
      classList: {
        remove(cls) { },
        add(cls) { flashedClasses.push(cls); },
        contains() { return false; },
      },
      get offsetWidth() { return 0; },
      rows: [],
      dataset: {},
      // findTargetTable uses el.closest('table') (lowercase) to find the table ancestor.
      closest(sel) { return sel === 'table' ? this : null; },
      matches(sel) { return false; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    sentMessages.length = 0;
    capturedHandler({ target: mockTable });

    eq('table-activation AC1 runtime: flashTargetedTable adds dr-ext-target-flash to the table',
      flashedClasses.includes('dr-ext-target-flash'),
      true);

    eq('table-activation AC1 runtime: state:tableActivated sent when right-clicking a table',
      sentMessages.some(m => m.action === 'state:tableActivated'),
      true);

    // --- AC3: right-clicking a non-table element — no flash, no state:tableActivated ---
    const nonTableTarget = {
      tagName: 'SPAN',
      classList: { contains() { return false; } },
      closest(sel) { return null; },
      matches(sel) { return false; },
      parentElement: null,
    };
    sentMessages.length = 0;
    capturedHandler({ target: nonTableTarget });

    eq('table-activation AC3 runtime: no state:tableActivated sent when right-clicking non-table',
      sentMessages.some(m => m.action === 'state:tableActivated'),
      false);

  } finally {
    // Restore globals after all handler calls are done.
    global.document = savedDoc;
    global.chrome   = savedChrome;
  }
})();

// ---------------------------------------------------------------------------
// Sprint extract-dr-table (adversarial hardening): end-to-end double-invocation
// coverage through the REAL captured content.js listeners — not a direct call
// to markAndToggleIfNewGrid with a hand-built {handle, isNew} object (that is
// already covered above, but only exercises the wrapper in isolation).
//
// Before this sprint, findTargetTable itself wrote the dr-ext-grid marker
// inline, so a table seen twice never grew a second widget. That guard now
// lives across two calls (findTargetTable reports isNew; the caller's
// markAndToggleIfNewGrid marks+builds only when isNew). This test proves the
// split still reproduces the old guarantee end-to-end: firing the actual
// captured 'contextmenu' listener twice on the same never-before-seen grid,
// and then firing the actual captured 'intent:menuClicked' onMessage listener
// against that same target, builds exactly one toggle widget.
// ---------------------------------------------------------------------------
(function doubleInvocation_contextmenuAndMenuClicked_noDuplicateWidget() {
  // A minimal div-based "grid" using the same ARIA-free, querySelectorAll-less
  // fallback shape GridAdapter already supports (repetitive children): no
  // real Text nodes, so GridAdapter's applyPatches() finds nothing to patch and
  // safely no-ops. This fixture only needs to prove marker/widget bookkeeping,
  // not actual cell rewriting (covered elsewhere).
  function makeCell(text) { return { nodeType: 1, textContent: text, children: [] }; }
  function makeRow(texts) { return { nodeType: 1, className: 'row', children: texts.map(makeCell) }; }
  const rows = [
    makeRow(['A', '100']), makeRow(['B', '200']), makeRow(['C', '300']),
    makeRow(['D', '400']), makeRow(['E', '500']),
  ];
  const gridClassList = (() => {
    const c = [];
    return {
      _c: c,
      add(x) { if (!c.includes(x)) c.push(x); },
      remove(x) { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
      contains(x) { return c.includes(x); },
    };
  })();
  const gridEl = {
    nodeType: 1, tagName: 'DIV', className: 'grid-wrapper', children: rows,
    classList: gridClassList, parentElement: null, parentNode: null,
    // applySidebarRounding calls table.querySelector(...) directly, with no `&&`
    // guard, so this must exist (returning "not already rounded"), and
    // syncSwitchForTable's lock check scans querySelectorAll the same way
    // (returning "no rounded cells").
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 }; },
  };
  const clickTarget = {
    nodeType: 1, tagName: 'DIV', parentElement: gridEl, parentNode: gridEl,
    closest(sel) { return null; }, // first right-click: no <table>/.dr-ext-grid ancestor yet
  };

  let buttonCreateCount = 0;
  function mockCreateElement(tag) {
    if (tag === 'button') {
      buttonCreateCount++;
      return {
        type: '', className: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
        addEventListener() {}, appendChild() {}, parentElement: null,
      };
    }
    return { className: '', style: {}, textContent: '', appendChild() {} };
  }

  let contextmenuHandler = null;
  // Chrome hands an arriving message to every registered listener. The bus
  // registers one and content.js keeps one for the requests, so a stub that
  // held only the last registration would drop the bus's.
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
  // findTargetTable's walk-up (case 3) calls looksLikeGrid, which reads layout
  // via the bare `getComputedStyle` global (not the window.getComputedStyle
  // stub set up once at the top of this file). Provide a flex display so the
  // fixture clears looksLikeGrid's layout gate.
  global.getComputedStyle = () => ({ display: 'flex' });

  try {
    eval(contentScriptBundle);

    eq('double-invocation: contextmenu handler was captured', typeof contextmenuHandler, 'function');
    eq('double-invocation: the bus registered its message listener', messageListeners.length, 1);
    if (typeof contextmenuHandler !== 'function' || messageListeners.length === 0) return;

    // --- First right-click: new grid discovered via walk-up -> marked + widget built ---
    contextmenuHandler({ target: clickTarget });

    eq('double-invocation: first contextmenu marks the grid with dr-ext-grid',
      gridEl.classList.contains('dr-ext-grid'), true);
    eq('double-invocation: first contextmenu builds exactly one toggle widget',
      buttonCreateCount, 1);

    // --- Second right-click on the SAME target: findTargetTable now resolves
    // this grid via case 2 (closest('.dr-ext-grid')), since it is already
    // marked -- the replacement for the old inline-write re-entry guard. ---
    clickTarget.closest = function(sel) { return sel === '.dr-ext-grid' ? gridEl : null; };
    contextmenuHandler({ target: clickTarget });

    eq('double-invocation: second contextmenu on the same grid builds NO second widget',
      buttonCreateCount, 1);

    // --- intent:menuClicked dispatch against the same last-right-clicked element:
    // must reuse the existing widget too, not build another. ---
    const beforeMenuClick = sentMessages.length;
    fireMessage({ action: 'intent:menuClicked' });

    eq('double-invocation: intent:menuClicked on an already-marked grid builds NO widget',
      buttonCreateCount, 1);
    // Exact sequence, not presence. The right-click above CONNECTED this
    // grid, and the panel-state decoupling (issue #272 family) makes a
    // toggle on the connected table take the record path with the sidebar
    // closed too: state:applyOk from the apply, state:rangeOk from the round, then the
    // record report. No intent:updateMenuLabel here only because this minimal
    // grid's querySelector always returns null, so the enabled branch's
    // conditional send is skipped — a fixture artifact, not contract.
    eq('double-invocation: a sidebar-closed intent:menuClicked on the connected grid takes the record path',
      sentMessages.slice(beforeMenuClick).map((m) => m.action),
      ['state:applyOk', 'state:rangeOk', 'state:tableEnabledChanged']);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.getComputedStyle = savedGCS;
  }
})();

// ---------------------------------------------------------------------------
// Sprint right-click-registers (controller level): the right-click handler
// registers what the new route resolves and makes it active.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.5 and the
// right-click-registers block in §5; decision D1.
// ---------------------------------------------------------------------------
//
// The resolver half of these criteria sits with the findTargetTable tests
// further up this file. "Registers" and "makes it active" are controller
// facts, so they run through the real captured contextmenu listener against a
// fresh evaluation of the content scripts, and read that evaluation's own
// application model and pillbox bookkeeping.
//
// The MutationObserver stub is capturing rather than no-op so the observer
// counts around one right-click are readable: this branch carries no pending
// table and no subtree observer, and the criterion is that the route needs
// neither.

// --- AC1: a right-click in the scrolling pane registers it and makes it active ---

(function rightClickRegisters_AC1_runtime_scrollingPaneRegistersAndBecomesActive() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click AC1 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    eq('right-click AC1 runtime: no scan registered the nest before the click',
      ctx.store.getRegisteredTables().length, 0);

    ctx.contextmenuHandler({ target: grid.scrollRowEls[2].children[1] });

    eq('right-click AC1 runtime: the scrolling pane enters the registry',
      ctx.store.hasTable(grid.scrollPaneEl), true);
    eq('right-click AC1 runtime: the scrolling pane becomes the active table',
      ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
    eq('right-click AC1 runtime: the registry holds the scrolling pane alone',
      ctx.store.getRegisteredTables().map((el) => el === grid.scrollPaneEl), [true]);
    eq('right-click AC1 runtime: the scrolling pane carries a pillbox',
      ctx.tableToggles.has(grid.scrollPaneEl), true);
    eq('right-click AC1 runtime: the pinned pane carries no pillbox',
      ctx.tableToggles.has(grid.pinnedPaneEl), false);
    eq('right-click AC1 runtime: the wrapper carries no pillbox',
      ctx.tableToggles.has(grid.wrapperEl), false);
    eq('right-click AC1 runtime: the grid marker class lands on the scrolling pane alone',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
        .map((el) => el.classList.contains('dr-ext-grid')), [false, false, true]);
    eq('right-click AC1 runtime: the click reports the table as activated',
      ctx.sentMessages.some((m) => m.action === 'state:tableActivated'), true);
  });
})();

// --- AC1: a right-click on the nest's own layers registers the scrolling pane ---

(function rightClickRegisters_AC1_runtime_aClickOnAPlainLayerRegistersTheScrollingPane() {
  withRightClickSandbox(function (ctx) {
    const plain = makeDatabaseQueryGrid({ plainWrapper: true });

    eq('right-click AC1 runtime: the contextmenu handler was captured (plain layer)',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: plain.paneParentEl });

    eq('right-click AC1 runtime: a click on the plain layer between the panes registers the scrolling pane',
      ctx.store.hasTable(plain.scrollPaneEl), true);
    eq('right-click AC1 runtime: that click makes the scrolling pane active',
      ctx.store.getSelectedTable() === plain.scrollPaneEl, true);
    eq('right-click AC1 runtime: that click puts a pillbox on the scrolling pane',
      ctx.tableToggles.has(plain.scrollPaneEl), true);
    eq('right-click AC1 runtime: that click puts no pillbox on the plain layer or the wrapper',
      [plain.paneParentEl, plain.wrapperEl].map((el) => ctx.tableToggles.has(el)), [false, false]);
  });
})();

// --- AC2: a right-click in the row-number gutter registers the scrolling pane ---

(function rightClickRegisters_AC2_runtime_gutterRegistersTheScrollingPane() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click AC2 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: grid.pinnedRowEls[0].children[0] });

    eq('right-click AC2 runtime: a click in the row-number gutter registers the scrolling pane',
      ctx.store.hasTable(grid.scrollPaneEl), true);
    eq('right-click AC2 runtime: the scrolling pane becomes the active table',
      ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
    eq('right-click AC2 runtime: the pinned pane stays out of the registry',
      ctx.store.hasTable(grid.pinnedPaneEl), false);
    eq('right-click AC2 runtime: the wrapper stays out of the registry',
      ctx.store.hasTable(grid.wrapperEl), false);
    eq('right-click AC2 runtime: the scrolling pane carries a pillbox',
      ctx.tableToggles.has(grid.scrollPaneEl), true);
    eq('right-click AC2 runtime: the pinned pane carries no pillbox',
      ctx.tableToggles.has(grid.pinnedPaneEl), false);
    eq('right-click AC2 runtime: the wrapper carries no pillbox',
      ctx.tableToggles.has(grid.wrapperEl), false);
  });
})();

// --- AC3: a role-bearing element that fails the data test registers nothing ---

(function rightClickRegisters_AC3_runtime_aFailedDataTestRegistersNothing() {
  withRightClickSandbox(function (ctx) {
    const oneCell = makeRoleBearingNest([makeDgRow(0, ['17'])]);
    const noNumber = makeRoleBearingNest([
      makeDgRow(0, ['north', 'alpha']),
      makeDgRow(1, ['south', 'bravo']),
    ]);

    eq('right-click AC3 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: oneCell.children[0].children[0] });

    eq('right-click AC3 runtime: a click in the one-row-one-cell element registers nothing',
      ctx.store.getRegisteredTables().length, 0);
    eq('right-click AC3 runtime: a click in the one-row-one-cell element leaves no active table',
      ctx.store.getSelectedTable(), null);
    eq('right-click AC3 runtime: the one-row-one-cell element gets no pillbox',
      ctx.tableToggles.has(oneCell), false);

    ctx.contextmenuHandler({ target: noNumber.children[0].children[0] });

    eq('right-click AC3 runtime: a click in the two-rows-no-number element registers nothing',
      ctx.store.getRegisteredTables().length, 0);
    eq('right-click AC3 runtime: a click in the two-rows-no-number element leaves no active table',
      ctx.store.getSelectedTable(), null);
    eq('right-click AC3 runtime: the two-rows-no-number element gets no pillbox',
      ctx.tableToggles.has(noNumber), false);
    eq('right-click AC3 runtime: neither click reports a table as activated',
      ctx.sentMessages.some((m) => m.action === 'state:tableActivated'), false);
  });
})();

// --- AC5: the route needs no pending observer ---

(function rightClickRegisters_AC5_runtime_theRouteInstallsNoObserver() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click AC5 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    // The content scripts build one observer at load, over the document body,
    // for removed subtrees. Everything after this line is the right-click.
    const observersAtLoad = ctx.constructedObservers.length;
    const observeCallsAtLoad = ctx.observeCalls.length;

    ctx.contextmenuHandler({ target: grid.pinnedRowEls[1].children[0] });

    eq('right-click AC5 runtime: the resolution and registration construct no observer',
      ctx.constructedObservers.length - observersAtLoad, 0);
    eq('right-click AC5 runtime: the resolution and registration call observe no times',
      ctx.observeCalls.length - observeCallsAtLoad, 0);
    eq('right-click AC5 runtime: no observer watches any element of the nest',
      ctx.observeCalls.some((call) =>
        call.target === grid.wrapperEl ||
        call.target === grid.pinnedPaneEl ||
        call.target === grid.scrollPaneEl), false);
    eq('right-click AC5 runtime: the registration still happened without one',
      ctx.store.hasTable(grid.scrollPaneEl) &&
        ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
  });
})();

// --- Adversarial: a second right-click in the same nest adds no second entry ---

(function rightClickRegisters_runtime_aSecondClickAddsNoSecondRegistration() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: grid.scrollRowEls[0].children[1] });
    const afterFirst = ctx.store.getRegisteredTables().length;
    ctx.contextmenuHandler({ target: grid.scrollRowEls[4].children[2] });

    eq('right-click runtime: the first click registers one table', afterFirst, 1);
    eq('right-click runtime: a second click in the registered pane adds no entry',
      ctx.store.getRegisteredTables().length, 1);
    eq('right-click runtime: the active table stays the scrolling pane',
      ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
  });
})();

// ---------------------------------------------------------------------------
// Sprint extract-dr-table (adversarial hardening): static purity scan.
// Detection functions (findTargetTable, findTables, looksLikeGrid, isDataTable,
// isPhantomA11yTable) must never write to the page — no classList.add,
// createElement, appendChild, or createToggleForTable inside their bodies.
// Write-layer helpers (applyExtractedPatches,
// restoreTextPieces, GridAdapter's applyPatches) legitimately create/mutate nodes and are correctly
// excluded from this scan — they are reachable only from explicit write calls
// (roundTable / reapplyRounding), never from detection.
// ---------------------------------------------------------------------------
(function detectionFunctions_sourceScan_noPageWrites() {
  if (detectCode === null) {
    eq('purity scan: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const FORBIDDEN = ['classList.add', 'createElement', 'appendChild', 'createToggleForTable'];
  const DETECTION_FNS = ['findTargetTable', 'findTables', 'looksLikeGrid', 'isDataTable', 'isPhantomA11yTable'];

  // Extract a top-level `function name(` body by brace-matching from the
  // opening brace to its balanced close. Good enough for this file's flat,
  // non-string-brace-heavy source.
  function extractFunctionBody(src, fnName) {
    const sig = new RegExp(`function ${fnName}\\s*\\(`);
    const m = sig.exec(src);
    if (!m) return null;
    const braceStart = src.indexOf('{', m.index);
    if (braceStart === -1) return null;
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return src.slice(braceStart, i + 1);
      }
    }
    return null;
  }

  for (const fnName of DETECTION_FNS) {
    const body = extractFunctionBody(detectCode, fnName);
    eq(`purity scan: ${fnName} body located in lib/dr-table/detect.js`, body !== null, true);
    if (body === null) continue;
    for (const token of FORBIDDEN) {
      eq(`purity scan: ${fnName} does not call/reference "${token}"`,
        body.includes(token), false);
    }
  }
})();

// AC1 (live): flashTargetedTable (already in global scope from the main eval)
// adds 'dr-ext-target-flash' to the passed table's classList.
(function tableContextmenuActivation_flashFn() {
  const addedClasses = [];
  const mockTable = {
    classList: {
      remove() {},
      add(cls) { addedClasses.push(cls); },
    },
    get offsetWidth() { return 0; },
  };

  flashTargetedTable(mockTable);

  eq('table-activation AC1 live: flashTargetedTable adds dr-ext-target-flash class',
    addedClasses.includes('dr-ext-target-flash'),
    true);
})();

// AC2 (live): flashSidebarContainer in sidebar.js logic — exercised via a
// minimal eval of sidebar.js with a capturing document.body stub.
// sidebar.js calls document.getElementById at module scope, so we must provide
// a full-enough stub to get past those calls before onMessage.addListener fires.
(function tableContextmenuActivation_sidebarFlash() {
  const bodyClasses = new Set();
  let animEndListener = null;
  const captureBody = {
    classList: {
      remove(cls) { bodyClasses.delete(cls); },
      add(cls)    { bodyClasses.add(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      // The sidebar's opening read runs after the tab lookup now, and it
      // reaches this on the way (issue #343). Without it the eval stops
      // before the lookup and the sidebar binds to no tab.
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    get offsetWidth() { return 0; },
    addEventListener(type, fn, opts) {
      if (type === 'animationend') animEndListener = fn;
    },
  };

  // Minimal element stub — covers getElementById and createElement usages.
  function makeEl() {
    const el = {
      addEventListener() {},
      removeEventListener() {},
      classList: {
        add() {}, remove() {}, contains() { return false; },
        toggle() {},
      },
      style: {},
      value: '',
      checked: false,
      disabled: false,
      textContent: '',
      innerHTML: '',
      appendChild() {},
      querySelector()    { return makeEl(); },
      querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches()  { return false; },
      // The sidebar tags its status message with a source and clears the tag
      // again. Without this the eval stops there, before the tab lookup the
      // opening read now runs behind (issue #343).
      dataset: {},
      closest()  { return null; },
    };
    return el;
  }

  const captureDoc2 = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById() { return makeEl(); },
    createElement()  { return makeEl(); },
  };

  // Minimal stubs for sidebar.js dependencies.
  const savedDoc    = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;

  global.document = captureDoc2;
  global.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => {},
    },
    // The sidebar records the tab it was opened for and acts only on reports
    // from that tab (issue #343), so this harness answers with one. No
    // sendMessage: the opening read then goes unanswered and the sidebar
    // falls to its unbound state, which is what this section already assumed.
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      onActivated: { addListener() {} },
    },
  };
  global.window = {
    addEventListener() {},
    close() {},
    getComputedStyle: () => ({ display: 'block' }),
  };

  let capturedOnMessageHandler = null;
  global.chrome.runtime.onMessage.addListener = (fn) => { capturedOnMessageHandler = fn; };
  const roundingSrcForFlash = sourceByName('lib/dr-number/rounding.js');
  const coreSrcForFlash = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrcForFlash === null || coreSrcForFlash === null) {
    eq('table-activation AC2 live: source files (defaults/rounding/core) present in manifest',
      false, true);
    global.document = savedDoc;
    global.chrome   = savedChrome;
    global.window   = savedWindow;
    return;
  }

  try {
    const dir = path.join(__dirname);
    // The bus goes in the same eval as sidebar.js, so the sidebar's
    // subscriptions attach to a bus of its own. Without it DR_BUS resolves to
    // the content-script bundle's global one, and every report the content
    // script publishes would run a half-built sidebar's handler — a crossing
    // the browser cannot make, because the two run in separate contexts.
    eval(
      constantsCode + '\n' +
      roundingSrcForFlash + '\n' +
      coreSrcForFlash     + '\n' +
      messagingCode + '\n' +
      fs.readFileSync(path.join(dir, 'sidebar.js'), 'utf8')
    );
  } catch(e) {
    // sidebar.js may reference DOM elements that are not fully stubbed — that is
    // acceptable; we only need the onMessage handler to be captured before the crash.
  }

  // Exercise the handler WHILE global.document still points to captureDoc2 so
  // that flashSidebarContainer can reach captureBody via document.body.
  eq('table-activation AC2 live: sidebar onMessage handler was captured',
    typeof capturedOnMessageHandler, 'function');

  if (typeof capturedOnMessageHandler === 'function') {
    // Invoke the state:tableActivated message and verify the flash class is applied.
    capturedOnMessageHandler({ action: 'state:tableActivated' }, FROM_SIDEBAR_TAB, () => {});

    eq('table-activation AC2 live: state:tableActivated message adds dr-sidebar-flash to document.body',
      bodyClasses.has('dr-sidebar-flash'),
      true);

    // Simulate animationend — the class should be removed afterwards.
    if (typeof animEndListener === 'function') animEndListener();
    eq('table-activation AC2 live: dr-sidebar-flash removed after animationend',
      bodyClasses.has('dr-sidebar-flash'),
      false);
  }

  // Restore globals after the assertions have run.
  global.document = savedDoc;
  global.chrome   = savedChrome;
  global.window   = savedWindow;
})();

// AC4 (runtime): the worker relays no activation report into a tab, whether or
// not it holds a sidebar tab number. The relay retired before #325; what #325
// changes is where the claim is read from — the worker holds no message
// listener of its own now, so the listener under test is the bus's, and the
// worker's own subscriptions are the only thing that could act on an arriving
// topic. It subscribes to no activation report, so nothing does.
(function tableContextmenuActivation_backgroundRelay() {
  const sentTabMessages = [];
  let capturedBgHandler = null;
  let capturedClickHandler = null;

  const captureChromeBg = {
    runtime: {
      lastError: null,
      onInstalled: { addListener: () => {} },
      onMessage:   { addListener: (fn) => { capturedBgHandler = fn; } },
      sendMessage: (msg, cb) => { if (cb) cb(undefined); },
    },
    contextMenus: {
      create: () => {},
      update: () => {},
      onClicked: { addListener: (fn) => { capturedClickHandler = fn; } },
    },
    tabs: {
      query(q, cb) { cb([{ id: 1 }]); },
      sendMessage(tabId, msg, cb) { sentTabMessages.push({ tabId, msg }); if (cb) cb(undefined); },
      onUpdated:   { addListener: () => {} },
      onRemoved:   { addListener: () => {} },
      onActivated: { addListener: () => {} },
    },
    // Omitted deliberately: background.js guards on chrome.sidePanel, so with
    // it absent the sidebar-open handler never awaits and the tab number is
    // set by the time the call returns.
  };

  // Every handler call runs while the stub is the global chrome. The bus reads
  // chrome at send time, not at load time, so a call made after the restore
  // below would send through the suite's bare default stub and reach nothing.
  const PANEL_TAB = 99;
  const result = {};
  const savedChrome = global.chrome;
  global.chrome = captureChromeBg;
  try {
    eval(messagingCode + '\n' +
      fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'));
    result.listenerType = typeof capturedBgHandler;
    if (result.listenerType === 'function') {
      // Case A: no sidebar tab number (never opened).
      sentTabMessages.length = 0;
      capturedBgHandler({ action: 'state:tableActivated' }, {}, () => {});
      result.relaysWithNoTabNumber = sentTabMessages.length;

      // Case B: the sidebar was opened, so the worker holds its tab number.
      // The handler runs to completion synchronously with chrome.sidePanel
      // absent.
      sentTabMessages.length = 0;
      capturedClickHandler({ menuItemId: 'dr-action-sidebar' }, { id: PANEL_TAB });
      result.sentOpenedReport = sentTabMessages.some(m => m.tabId === PANEL_TAB &&
        m.msg && m.msg.action === 'state:sidebarOpened');

      sentTabMessages.length = 0;
      capturedBgHandler({ action: 'state:tableActivated' }, {}, () => {});
      result.relaysWithTabNumber = sentTabMessages.length;
    }
  } finally {
    global.chrome = savedChrome;
  }

  eq('table-activation AC4 runtime: the bus listener is the worker\'s only message listener',
    result.listenerType, 'function');
  eq('table-activation AC4 runtime: no relay when the worker holds no sidebar tab number',
    result.relaysWithNoTabNumber, 0);
  eq('table-activation AC4 runtime: opening the sidebar sends its report to that tab',
    result.sentOpenedReport, true);
  eq('table-activation AC4 runtime: still no relay once the worker holds one',
    result.relaysWithTabNumber, 0);
})();

// ---------------------------------------------------------------------------
// END Sprint table-contextmenu-activation tests
// ---------------------------------------------------------------------------

// Sprint advanced-lower-dot-brown: linked-state bot thumb/label colour change
// AC1. Linked-state bot thumb background is #c48a6a (brown), NOT grey #9aa0a6.
// AC2. Decoupled-state bot thumb is still #b3623d (unchanged).
// AC3. Linked-state bot LABEL color matches the linked thumb (same hex #c48a6a).
// AC4. Old grey #9aa0a6 no longer appears for either of these two rules.
// AC5. The linked brown (#c48a6a) is lighter than the decoupled brown (#b3623d).
// ---------------------------------------------------------------------------

(function advancedLowerDotBrown() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // --- AC1: .dual-thumb.bot.linked background is #c48a6a ---
  eq('lower-dot-brown AC1: .dual-thumb.bot.linked background is #c48a6a',
    /\.dual-thumb\.bot\.linked\s*\{[^}]*background\s*:\s*#c48a6a/.test(sidebarHtml), true);

  // --- AC1 (negative): .dual-thumb.bot.linked does NOT use grey #9aa0a6 ---
  // Extract the specific rule so we don't false-positive on other rules.
  const linkedThumbRuleMatch = sidebarHtml.match(/\.dual-thumb\.bot\.linked\s*\{[^}]*\}/);
  const linkedThumbRule = linkedThumbRuleMatch ? linkedThumbRuleMatch[0] : '';
  eq('lower-dot-brown AC1 neg: .dual-thumb.bot.linked rule does not contain #9aa0a6',
    linkedThumbRule.includes('#9aa0a6'), false);

  // --- AC2: .dual-thumb.bot (decoupled) background is still #b3623d ---
  // The rule may be a multi-line block; match the .dual-thumb.bot { ... } block
  // that is NOT the .linked variant, and confirm it contains #b3623d.
  // Strategy: find the line/block for the rule selector without .linked.
  const decoupledRuleMatch = sidebarHtml.match(/\.dual-thumb\.bot\s*\{[^}]*\}/);
  const decoupledRule = decoupledRuleMatch ? decoupledRuleMatch[0] : '';
  eq('lower-dot-brown AC2: .dual-thumb.bot (decoupled) block is present in sidebar.html',
    decoupledRule.length > 0, true);
  eq('lower-dot-brown AC2: .dual-thumb.bot (decoupled) contains background #b3623d',
    decoupledRule.includes('#b3623d'), true);

  // --- AC3: Linked-state bot LABEL color is #c48a6a (matches the thumb) ---
  // Rule: #sliderBlock.linked .label-row .lbl.bot { color: #c48a6a; }
  eq('lower-dot-brown AC3: #sliderBlock.linked .lbl.bot color is #c48a6a',
    /#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*color\s*:\s*#c48a6a/.test(sidebarHtml), true);

  // Verify thumb and label use the EXACT same hex (AC3 consistency check).
  const linkedLabelMatch = sidebarHtml.match(/#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*color\s*:\s*(#[0-9a-fA-F]{6})/);
  const linkedThumbBgMatch = sidebarHtml.match(/\.dual-thumb\.bot\.linked\s*\{[^}]*background\s*:\s*(#[0-9a-fA-F]{6})/);
  const linkedLabelHex  = linkedLabelMatch  ? linkedLabelMatch[1].toLowerCase()  : 'MISSING';
  const linkedThumbHex  = linkedThumbBgMatch ? linkedThumbBgMatch[1].toLowerCase() : 'MISSING';
  eq('lower-dot-brown AC3 consistency: linked label hex === linked thumb hex',
    linkedLabelHex, linkedThumbHex);

  // --- AC4: Old grey #9aa0a6 no longer appears in either of these two rules ---
  // (linked thumb rule checked above; now check the linked label rule)
  const linkedLabelRuleMatch = sidebarHtml.match(/#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*\}/);
  const linkedLabelRule = linkedLabelRuleMatch ? linkedLabelRuleMatch[0] : '';
  eq('lower-dot-brown AC4: linked label rule does not contain #9aa0a6',
    linkedLabelRule.includes('#9aa0a6'), false);

  // --- AC5: The linked brown (#c48a6a) is lighter than the decoupled brown (#b3623d) ---
  // Parse each hex to RGB, then compute perceived lightness (simple average of R,G,B).
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  function lightness(rgb) { return (rgb.r + rgb.g + rgb.b) / 3; }

  const linkedBrown    = hexToRgb('#c48a6a');   // the new colour
  const decoupledBrown = hexToRgb('#b3623d');   // the existing decoupled colour
  eq('lower-dot-brown AC5: linked brown (#c48a6a) is lighter than decoupled brown (#b3623d)',
    lightness(linkedBrown) > lightness(decoupledBrown), true);
})();


// ---------------------------------------------------------------------------
// --- sidebar.js: truncateDecimals / formatOriginal ---
//
// Strategy: extract the real implementations from sidebar.js source via regex
// and eval them in this scope (where toNumber and formatNumberWithCommas are
// already available from the evaled core.js / content.js block above).
// This exercises the REAL implementation, not a reimplementation.
// ---------------------------------------------------------------------------
(function sidebarHelperTests() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // Extract the two constants and three functions we need from sidebar.js.
  // We pull them as a verbatim block so they reference each other correctly.
  // toNumber and formatNumberWithCommas are already on globalThis from the
  // content-script eval above.
  const constBlock = sidebarSrc.match(
    /const PREVIEW_DECIMAL_THRESHOLD\s*=.*?;\s*const PREVIEW_MAX_DECIMALS\s*=.*?;/
  );
  const fmtCommasFn = sidebarSrc.match(
    /function formatNumberWithCommas\([\s\S]*?\n\}/
  );
  const truncateFn = sidebarSrc.match(
    /function truncateDecimals\([\s\S]*?\n\}/
  );
  const formatOriginalFn = sidebarSrc.match(
    /function formatOriginal\([\s\S]*?\n\}/
  );

  if (!constBlock || !fmtCommasFn || !truncateFn || !formatOriginalFn) {
    // Signal extraction failure clearly — treat as a failed test so CI notices.
    eq('sidebar-extract: able to extract truncateDecimals + formatOriginal from sidebar.js',
       false, true);
    return;
  }

  // Eval into a local object using an IIFE so the const declarations bind in
  // function scope (not global) and the new Function body can hold them.
  // toNumber is passed in from the already-evaled content-script scope.
  // Note: string concatenation is used (not a template literal) to avoid any
  // back-tick/interpolation issues with the extracted source text.
  const helperSrc = '(function() {\n' +
    constBlock[0] + '\n' +
    fmtCommasFn[0] + '\n' +
    truncateFn[0] + '\n' +
    formatOriginalFn[0] + '\n' +
    'return { formatNumberWithCommas: formatNumberWithCommas, truncateDecimals: truncateDecimals, formatOriginal: formatOriginal };\n' +
    '})()';
  const helpers = (new Function(
    'toNumber',
    'return ' + helperSrc + ';'
  ))(toNumber);

  const trunc = helpers.truncateDecimals;
  const fmtOrig = helpers.formatOriginal;

  // Verify we got real functions, not undefined.
  eq('sidebar-extract: truncateDecimals is a function',
     typeof trunc, 'function');
  eq('sidebar-extract: formatOriginal is a function',
     typeof fmtOrig, 'function');

  // -----------------------------------------------------------------
  // Acceptance criterion 1: original numbers display with thousands commas.
  // formatOriginal converts numeric strings to comma-formatted numbers.
  // -----------------------------------------------------------------
  eq('AC1: formatOriginal integer string gets commas (273233 -> "273,233")',
     fmtOrig('273233'), '273,233');
  eq('AC1: formatOriginal large integer number gets commas',
     fmtOrig(1000000), '1,000,000');
  eq('AC1: formatOriginal already-comma string parses and re-formats ("273,233")',
     fmtOrig('273,233'), '273,233');
  eq('AC1: formatOriginal negative large integer gets commas',
     fmtOrig(-1234567), '-1,234,567');

  // -----------------------------------------------------------------
  // Acceptance criterion 2: rounded numbers magnitude >= 100 → NO decimals.
  // truncateDecimals should strip all decimals for |n| >= 100.
  // -----------------------------------------------------------------
  eq('AC2: truncateDecimals(1234.56) -> 1234 (magnitude >= 100, no decimals)',
     trunc(1234.56), 1234);
  eq('AC2: truncateDecimals(100.9999) -> 100 (exactly at threshold, no decimals)',
     trunc(100.9999), 100);
  eq('AC2: truncateDecimals(-1234.56) -> -1234 (negative, magnitude >= 100)',
     trunc(-1234.56), -1234);
  eq('AC2: truncateDecimals(-100.9) -> -100 (negative at threshold)',
     trunc(-100.9), -100);
  eq('AC2: formatOriginal("1234.56") -> "1,234" (magnitude >= 100, commas, no decimals)',
     fmtOrig('1234.56'), '1,234');
  eq('AC2: formatOriginal(100) -> "100" (exactly at boundary, no decimals)',
     fmtOrig(100), '100');

  // -----------------------------------------------------------------
  // Acceptance criterion 3: magnitude < 100 → at most 4 decimals, TRUNCATED.
  // This is the adversarial core: must be truncation, NOT rounding.
  // -----------------------------------------------------------------

  // Key adversarial case: 1.99999 must NOT round up to 2.
  eq('AC3-adversarial: truncateDecimals(1.99999) -> 1.9999 (truncated, not rounded to 2)',
     trunc(1.99999), 1.9999);
  eq('AC3-adversarial: truncateDecimals(1.7999999999) -> 1.7999 (truncated at 4 decimals)',
     trunc(1.7999999999), 1.7999);
  eq('AC3-adversarial: truncateDecimals(1.00005) -> 1 (truncates, not rounds to 1.0001)',
     trunc(1.00005), 1);

  // Boundary: 99.99999 must NOT round to 100, and must stay < threshold, giving 4 dec.
  eq('AC3-boundary-99.99999: truncateDecimals(99.99999) -> 99.9999 (below threshold, truncated)',
     trunc(99.99999), 99.9999);
  eq('AC3-boundary-99.99999: formatOriginal("99.99999") -> "99.9999" (not rounded to 100)',
     fmtOrig('99.99999'), '99.9999');

  // Boundary: exactly 100 — at threshold, no decimals.
  eq('AC3-boundary-100: truncateDecimals(100) -> 100 (integer, no change)',
     trunc(100), 100);
  eq('AC3-boundary-100: truncateDecimals(100.0001) -> 100 (at/above threshold, trunc)',
     trunc(100.0001), 100);

  // Negatives below threshold: trunc toward zero (not floor).
  eq('AC3-negative: truncateDecimals(-1.7999) -> -1.7999 (toward zero, not -1.8)',
     trunc(-1.7999), -1.7999);
  eq('AC3-negative: truncateDecimals(-1.99999) -> -1.9999 (truncated, not -2)',
     trunc(-1.99999), -1.9999);
  eq('AC3-negative: truncateDecimals(-99.99999) -> -99.9999 (negative, below threshold)',
     trunc(-99.99999), -99.9999);
  eq('AC3-negative: formatOriginal("-99.99999") -> "-99.9999" (negative, truncated, not -100)',
     fmtOrig('-99.99999'), '-99.9999');
  eq('AC3-negative: formatOriginal("-1.7999") -> "-1.7999" (toward zero)',
     fmtOrig('-1.7999'), '-1.7999');

  // Negative boundary: -100 at threshold → no decimals.
  eq('AC3-negative-100: truncateDecimals(-100) -> -100',
     trunc(-100), -100);
  eq('AC3-negative-100: formatOriginal("-100") -> "-100"',
     fmtOrig('-100'), '-100');
  eq('AC3-negative-100: truncateDecimals(-100.5) -> -100 (magnitude >= 100, no decimals)',
     trunc(-100.5), -100);

  // Numbers with fewer than 4 decimals are preserved as-is (no padding).
  eq('AC3-fewer-decimals: truncateDecimals(1.5) -> 1.5',
     trunc(1.5), 1.5);
  eq('AC3-fewer-decimals: truncateDecimals(0.1234) -> 0.1234',
     trunc(0.1234), 0.1234);
  eq('AC3-fewer-decimals: formatOriginal("1.5") -> "1.5"',
     fmtOrig('1.5'), '1.5');

  // -----------------------------------------------------------------
  // Comma parsing of original: string with commas should parse and reformat.
  // -----------------------------------------------------------------
  eq('comma-parse: formatOriginal("273,233") -> "273,233" (toNumber strips commas)',
     fmtOrig('273,233'), '273,233');
  eq('comma-parse: formatOriginal("1,234.5678999") -> "1,234" (magnitude >= 100, trunc)',
     fmtOrig('1,234.5678999'), '1,234');
  eq('comma-parse: formatOriginal("99,999") -> "99,999" (magnitude >= 100, no decimals)',
     fmtOrig('99,999'), '99,999');

  // -----------------------------------------------------------------
  // NaN / unparseable fallback: should return the raw string, not "NaN".
  // -----------------------------------------------------------------
  eq('NaN-fallback: formatOriginal("abc") -> "abc" (raw string passthrough)',
     fmtOrig('abc'), 'abc');
  eq('NaN-fallback: formatOriginal("") -> "" (empty string passthrough)',
     fmtOrig(''), '');
  eq('NaN-fallback: formatOriginal(null) -> "null" (null stringified)',
     fmtOrig(null), 'null');
  eq('NaN-fallback: formatOriginal("12abc") -> "12abc" (non-numeric string raw)',
     fmtOrig('12abc'), '12abc');

  // -----------------------------------------------------------------
  // Edge cases: zero, very small numbers, integers.
  // -----------------------------------------------------------------
  eq('edge: truncateDecimals(0) -> 0',
     trunc(0), 0);
  eq('edge: formatOriginal("0") -> "0"',
     fmtOrig('0'), '0');
  eq('edge: formatOriginal(0.00001) -> "0" (truncated to 4 places, last digit gone)',
     fmtOrig(0.00001), '0');
  eq('edge: formatOriginal(0.00009999) -> "0" (below 4th decimal place)',
     fmtOrig(0.00009999), '0');
  eq('edge: formatOriginal(0.1234) -> "0.1234" (exactly 4 decimals)',
     fmtOrig(0.1234), '0.1234');
  eq('edge: formatOriginal(0.12345) -> "0.1234" (5th decimal truncated)',
     fmtOrig(0.12345), '0.1234');

  // -----------------------------------------------------------------
  // REGRESSION GUARD: formatOriginal must TRUNCATE, never ROUND.
  // These assertions pin the production function against the bug where
  // toFixed() was used (which rounds), causing e.g. 1.7999999999 -> '1.8'.
  // All cases below would fail under a rounding implementation.
  // -----------------------------------------------------------------

  // Spec AC3 canonical example: deep-9s value, must truncate not round.
  eq('regression-trunc: formatOriginal(1.7999999999) -> "1.7999" (not "1.8")',
     fmtOrig(1.7999999999), '1.7999');

  // Near-integer truncation: 1.999999999 must NOT round up to 2.
  eq('regression-trunc: formatOriginal(1.999999999) -> "1.9999" (not "2", not "1")',
     fmtOrig(1.999999999), '1.9999');

  // 5th decimal truncated, not rounded: 5.12349999999 must NOT become '5.1235'.
  eq('regression-trunc: formatOriginal(5.12349999999) -> "5.1234" (not "5.1235")',
     fmtOrig(5.12349999999), '5.1234');

  // Just below threshold: numeric (not string) 99.99999 must NOT round to 100.
  eq('regression-trunc: formatOriginal(99.99999) -> "99.9999" (not "100")',
     fmtOrig(99.99999), '99.9999');

  // Negative near-integer: -1.999999999 must NOT round to -2.
  eq('regression-trunc: formatOriginal(-1.999999999) -> "-1.9999" (not "-2")',
     fmtOrig(-1.999999999), '-1.9999');

  // Negative just below threshold: numeric -99.99999 must NOT round to -100.
  eq('regression-trunc: formatOriginal(-99.99999) -> "-99.9999" (not "-100")',
     fmtOrig(-99.99999), '-99.9999');

  // Magnitude >= 100 with numeric (not string) input: 1234.56 -> "1,234".
  eq('regression-trunc: formatOriginal(1234.56) -> "1,234" (numeric input, commas, no decimals)',
     fmtOrig(1234.56), '1,234');

  // Numeric 1.5 (not string): trailing zeros stripped, no padding.
  eq('regression-trunc: formatOriginal(1.5) -> "1.5" (numeric, no padding)',
     fmtOrig(1.5), '1.5');

  // Integer 2: no decimals, no commas.
  eq('regression-trunc: formatOriginal(2) -> "2" (integer, no decimals)',
     fmtOrig(2), '2');

  // Negative tiny value: -0.00001 truncates to 0, must NOT produce "-0".
  eq('regression-trunc: formatOriginal(-0.00001) -> "0" (no negative zero)',
     fmtOrig(-0.00001), '0');

  // Adversarial fp-noise: 49.99995 must NOT round to '50'.
  eq('regression-trunc: formatOriginal(49.99995) -> "49.9999" (fp-noise, not "50")',
     fmtOrig(49.99995), '49.9999');
})();

