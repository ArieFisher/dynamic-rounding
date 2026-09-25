// ---------------------------------------------------------------------------
// Sprint engine-returns-results: static purity scan.
// The simplification engine (roundTable, the one simplification pass —
// simplifyTableCells, classifyTableCell, cellPatches — and
// reapplyRounding) must never call chrome.* directly — it returns result
// values instead, and the controller sends the messages. Mirrors the
// detectionFunctions_sourceScan_noPageWrites pattern above.
// ---------------------------------------------------------------------------
(function engineFunctions_sourceScan_noChromeCalls() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('engine purity scan: source file content.js present in manifest', false, true);
    return;
  }
  const ENGINE_FNS = ['roundTable', 'simplifyTableCells', 'classifyTableCell', 'cellPatches', 'reapplyRounding'];

  // Extract a top-level `function name(` body by brace-matching from the
  // opening brace to its balanced close (same approach as the detection
  // purity scan above).
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

  for (const fnName of ENGINE_FNS) {
    const body = extractFunctionBody(contentSrc, fnName);
    eq(`engine purity scan: ${fnName} body located in content.js`, body !== null, true);
    if (body === null) continue;
    eq(`engine purity scan: ${fnName} does not reference "chrome."`,
      body.includes('chrome.'), false);
  }
})();

// ---------------------------------------------------------------------------
// Sprint engine-returns-results: the engine runs end-to-end with NO `chrome`
// global present at all — not even a stub. This loads the real content-script
// bundle in a vm sandbox that never defines `chrome`. The only top-level
// statement in content.js that unconditionally touches chrome — registering
// the runtime message listener, controller wiring unrelated to the engine —
// is neutralized to a no-op so the module can load; every other chrome.*
// reference in content.js lives inside a function body this test never calls.
// If roundTable (or anything it reaches) touched chrome, loading or calling
// it here would throw ReferenceError: chrome is not defined.
// ---------------------------------------------------------------------------
(function engineRunsWithNoChromeGlobal() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('no-chrome e2e: source file content.js present in manifest', false, true);
    return;
  }

  eq('no-chrome e2e: content.js registers no Chrome message listener of its own',
    contentSrc.split('chrome.runtime.onMessage.addListener(').length - 1, 0);
  // No patch needed: every remaining chrome.* reference in content.js sits
  // inside a function body this test never calls. Loading the file unpatched
  // is a stronger check than loading a patched copy.
  const noChromeContentSrc = contentSrc;

  // Sandbox has NO `chrome` property whatsoever — only the DOM/browser
  // primitives the engine's non-controller code paths actually touch
  // (document.createTreeWalker via collectTextPieces, NodeFilter).
  const sandbox = {
    document: {
      addEventListener() {},
      createTreeWalker(cell) {
        let done = false;
        return {
          nextNode() {
            if (done) return null;
            done = true;
            return {
              get nodeValue() { return this._val !== undefined ? this._val : cell.innerText; },
              set nodeValue(v) { cell.innerText = v; cell.textContent = v; this._val = v; },
            };
          },
        };
      },
    },
    window: {
      addEventListener() {},
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    },
    NodeFilter: { SHOW_TEXT: 4 },
    Node: { ELEMENT_NODE: 1 },
  };

  const vm = require('vm');
  const ctx = vm.createContext(sandbox);
  // Load the content scripts in manifest order (same order contentScriptBundle
  // uses), substituting the neutralized content.js source for the real one.
  const bundle = contentScriptFiles
    .map((file) => (file === 'content.js' ? noChromeContentSrc : contentScriptSources.get(file)))
    .join('\n');

  let threw = null;
  try {
    vm.runInContext(bundle + '\nthis.__roundTable = roundTable;', ctx);
  } catch (e) {
    threw = e.message;
  }
  eq('no-chrome e2e: the engine bundle loads with no `chrome` global defined anywhere',
    threw, null);
  eq('no-chrome e2e: `chrome` is genuinely absent from the sandbox',
    'chrome' in sandbox, false);
  if (threw !== null || typeof sandbox.__roundTable !== 'function') return;

  const table = makeMockTable([[{ tag: 'td', text: '1,234,567' }]]);
  let callThrew = null;
  let result;
  try {
    result = sandbox.__roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      // The fixture's only row is row 0 — simplifyFirstRow/Column must be true
      // or getExclusionReason would exclude the only cell under test.
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    });
  } catch (e) {
    callThrew = e.message;
  }

  eq('no-chrome e2e: calling roundTable on a fixture does not throw with no chrome global present',
    callThrew, null);
  eq('no-chrome e2e: roundTable returns rangeStatus "ok"',
    result && result.rangeStatus, 'ok');
  eq('no-chrome e2e: roundTable returns applied: true',
    result && result.applied, true);
  eq('no-chrome e2e: roundTable actually rounded the fixture cell',
    table.rows[0].cells[0].classList.contains('dr-ext-rounded'), true);
})();

// ---------------------------------------------------------------------------
// Sprint engine-returns-results: pin the exact state:rangeOk/state:rangeError message
// sequence for one full apply (applySidebarRounding -> roundTable ->
// sendRangeStatusMessage -> chrome.runtime.sendMessage).
//
// The flow used to start at a plain-toggle helper, which the 2026-09-14
// sidebar-state-removal design retired (#241). The apply is the one path to
// roundTable now, so it drives the flow here. It leads with its own state:applyOk,
// which the retired helper never sent; the state:rangeOk/state:rangeError and
// intent:updateMenuLabel tail is byte-identical to the frozen capture.
//
// Before this sprint, roundTable sent state:rangeError/state:rangeOk itself. Now the
// engine returns { applied, rangeStatus, error } and the controller sends the
// message. The two expected sequences below (one per range-validity branch)
// were verified byte-for-byte against content.js as it stood at commit
// 4340bd1 (the refactor/merge-ladder tip this sprint branched from) by
// running that commit's real content.js through this same vm harness and
// diffing the captured chrome.runtime.sendMessage sequence against the one
// captured here. They were identical. This test pins that verified sequence
// so a future change cannot silently drop or duplicate a message.
// ---------------------------------------------------------------------------
(function engineReturnsResults_rangeStatusMessageSequence() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('range-status sequence: source file content.js present in manifest', false, true);
    return;
  }

  // Isolated vm context per run so module-level state (DR_DEFAULTS mutation,
  // highlightStyleInjected, tableOptions) never bleeds between the two
  // scenarios below.
  function runFullToggleFlow(rangeExprOverride) {
    const sentMessages = [];
    const sandbox = {
      document: {
        addEventListener() {},
        querySelectorAll() { return []; },
        readyState: 'complete',
        body: { appendChild() {} },
        createElement() { return { textContent: '' }; },
        head: { appendChild() {} },
        createTreeWalker(cell) {
          let done = false;
          return {
            nextNode() {
              if (done) return null;
              done = true;
              return {
                get nodeValue() { return this._val !== undefined ? this._val : cell.innerText; },
                set nodeValue(v) { cell.innerText = v; cell.textContent = v; this._val = v; },
              };
            },
          };
        },
      },
      window: {
        addEventListener() {},
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
      },
      NodeFilter: { SHOW_TEXT: 4 },
      Node: { ELEMENT_NODE: 1 },
      MutationObserver: class { observe() {} disconnect() {} },
      ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
      chrome: {
        runtime: {
          sendMessage(msg) { sentMessages.push(msg); },
          onMessage: { addListener() {} },
          lastError: null,
        },
      },
    };
    const vm = require('vm');
    const ctx = vm.createContext(sandbox);
    const bundle = contentScriptFiles
      .map((file) => (file === 'content.js' ? contentSrc : contentScriptSources.get(file)))
      .join('\n');
    vm.runInContext(
      bundle + '\nthis.__applySidebarRounding = applySidebarRounding; this.__DR_DEFAULTS = DR_DEFAULTS;',
      ctx
    );

    // 2x2 so the target cell (row 1, col 1) sits outside DR_DEFAULTS's
    // simplifyFirstRow/simplifyFirstColumn: false exclusion — DR_DEFAULTS
    // (unlike the no-chrome e2e fixture above) is used as-is here, matching
    // the settings record a press carries into the apply.
    const table = makeMockTable([
      [{ tag: 'td', text: 'label' }, { tag: 'td', text: 'header' }],
      [{ tag: 'td', text: 'label' }, { tag: 'td', text: '1,234,567' }],
    ]);
    // The apply ends with flashRangePulse, which flashes the whole-table
    // outline via table.classList — a real <table> element has this; the bare
    // mock from makeMockTable does not. It also opens with a reset and closes
    // by checking for a simplified cell, both through the marker-class
    // selector, so the mock needs a live scan rather than a fixed answer — an
    // empty list would hide the closing intent:updateMenuLabel.
    table.classList = { add() {}, remove() {} };
    table.querySelectorAll = (sel) => {
      if (sel !== '.dr-ext-rounded') return [];
      const found = [];
      for (const row of table.rows) {
        for (const cell of row.cells) {
          if (cell.classList && cell.classList.contains('dr-ext-rounded')) found.push(cell);
        }
      }
      return found;
    };
    table.querySelector = (sel) => table.querySelectorAll(sel)[0] || null;
    if (rangeExprOverride !== undefined) {
      sandbox.__DR_DEFAULTS.rangeExpr = rangeExprOverride;
    }
    let threw = null;
    try {
      sandbox.__applySidebarRounding(table, sandbox.__DR_DEFAULTS);
    } catch (e) {
      threw = e.message;
    }
    return { sentMessages, threw, table };
  }

  // --- Scenario 1: valid range (default rangeExpr === '') -> rounds, state:rangeOk ---
  const okRun = runFullToggleFlow(undefined);
  eq('range-status sequence (valid range): the apply does not throw',
    okRun.threw, null);
  eq('range-status sequence (valid range): exact message sequence matches parent-branch capture, behind the apply\'s own state:applyOk',
    okRun.sentMessages,
    [
      { action: 'state:applyOk' },
      { action: 'state:rangeOk' },
      { action: 'intent:updateMenuLabel', title: 'Toggle table' },
    ]);
  eq('range-status sequence (valid range): the cell was actually rounded',
    okRun.table.rows[1].cells[1].classList.contains('dr-ext-rounded'), true);

  // --- Scenario 2: invalid range ("1a" matches neither a column letter nor a
  // row number pattern) -> no rounding, state:rangeError with the parse error ---
  const errorRun = runFullToggleFlow('1a');
  eq('range-status sequence (invalid range): the apply does not throw',
    errorRun.threw, null);
  eq('range-status sequence (invalid range): exact message sequence matches parent-branch capture, behind the apply\'s own state:applyOk',
    errorRun.sentMessages,
    [
      { action: 'state:applyOk' },
      { action: 'state:rangeError', error: 'Invalid range: "1a"' },
    ]);
  eq('range-status sequence (invalid range): the cell was NOT rounded',
    errorRun.table.rows[1].cells[1].classList.contains('dr-ext-rounded'), false);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection: the application model (app/store.js, DR_STORE)
// and the typed event bus (adapters/messaging.js, DR_BUS). The selected
// table and the sidebar-open flag moved out of content.js's file-level lets
// into DR_STORE; ui-toggle.js reports an intent through DR_BUS instead of
// writing content.js's variables directly.
// ---------------------------------------------------------------------------
(function appModelSelection_storeAndBus() {
  const busSrc = sourceByName('adapters/messaging.js');
  const storeSrc = sourceByName('app/store.js');
  if (busSrc === null || storeSrc === null) {
    eq('app-model-selection: adapters/messaging.js and app/store.js are present in the manifest', false, true);
    return;
  }

  // --- (a) discipline: one top-level declaration per file, like the lib
  // packages' index.js bundles. ---
  const topLevelDecls = (src) => src.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('adapters/messaging.js: exactly one top-level declaration in the file',
    topLevelDecls(busSrc).length, 1);
  eq('adapters/messaging.js: the sole top-level declaration is DR_BUS',
    /^const DR_BUS\b/m.test(busSrc), true);
  eq('app/store.js: exactly one top-level declaration in the file',
    topLevelDecls(storeSrc).length, 1);
  eq('app/store.js: the sole top-level declaration is DR_STORE',
    /^const DR_STORE\b/m.test(storeSrc), true);

  // --- (a) discipline: DR_BUS.TOPICS enumerates every topic with a family,
  // and no topic falls outside the two families. ---
  // Issue #325 added the third family, request: a topic whose one responder
  // returns an answer to the publisher.
  const KNOWN_FAMILIES = ['intent', 'state-change', 'request'];
  const topics = DR_BUS.TOPICS;
  const topicNames = Object.keys(topics);
  eq('DR_BUS.TOPICS: at least one topic is registered',
    topicNames.length > 0, true);
  eq('DR_BUS.TOPICS: every topic belongs to one of the three known families',
    topicNames.every((t) => KNOWN_FAMILIES.includes(topics[t].family)), true);
  eq('DR_BUS.TOPICS: enumerates exactly the expected topics',
    topicNames.slice().sort(),
    ['intent:selectTable', 'intent:toggleTable', 'state:selectedTableChanged',
     'state:settingsChanged',
     // The model's error state, published to the toast view in the same context.
     'state:errorRecorded',
     // The sidebar's four requests, each answered by the tab's content script.
     'request:applySettings', 'request:settings', 'request:previewSamples',
     'request:captureState',
     // The service worker's four, plus the two it receives (#325).
     'intent:menuClicked', 'state:sidebarOpened', 'intent:closeSidebar',
     'state:sidebarClosed', 'state:pageUnloaded', 'intent:updateMenuLabel',
     // The content script's eight reports to the sidebar.
     'state:tableActivated', 'state:tableSwitched', 'state:tableEnabledChanged',
     'state:rangeError', 'state:rangeOk', 'state:applyBlocked', 'state:applyOk',
     'state:previewSamplesChanged'].sort());

  // Every moved topic, each with the family and route the topic table states.
  // A route is the one fact that determines which contexts a publish reaches,
  // so a wrong one here delivers to the wrong audience in silence.
  const WORKER_TOPICS = {
    'intent:menuClicked': ['intent', 'tab'],
    'state:sidebarOpened': ['state-change', 'tab'],
    'intent:closeSidebar': ['intent', 'extension-pages'],
    'state:sidebarClosed': ['state-change', 'extension-pages'],
    'state:pageUnloaded': ['state-change', 'extension-pages'],
    'intent:updateMenuLabel': ['intent', 'extension-pages'],
    // The content script's eight reports. Every one broadcasts: the content
    // script holds no tabs interface, and the sidebar is an extension page.
    'state:tableActivated': ['state-change', 'extension-pages'],
    'state:tableSwitched': ['state-change', 'extension-pages'],
    'state:tableEnabledChanged': ['state-change', 'extension-pages'],
    'state:rangeError': ['state-change', 'extension-pages'],
    'state:rangeOk': ['state-change', 'extension-pages'],
    'state:applyBlocked': ['state-change', 'extension-pages'],
    'state:applyOk': ['state-change', 'extension-pages'],
    'state:previewSamplesChanged': ['state-change', 'extension-pages'],
  };
  for (const name of Object.keys(WORKER_TOPICS)) {
    const [family, route] = WORKER_TOPICS[name];
    eq('DR_BUS.TOPICS: ' + name + ' is in the ' + family + ' family',
      topics[name] && topics[name].family, family);
    eq('DR_BUS.TOPICS: ' + name + ' carries the ' + route + ' route',
      topics[name] && topics[name].route, route);
  }
  eq('DR_BUS.TOPICS: intent:selectTable is in the intent family',
    topics['intent:selectTable'].family, 'intent');
  // Sprint toggle-split: the toggle view's click handler changes no table
  // itself — it publishes intent:toggleTable, and content.js (the sole
  // subscriber) determines what a committed toggle does.
  eq('DR_BUS.TOPICS: intent:toggleTable is in the intent family',
    topics['intent:toggleTable'].family, 'intent');
  eq('DR_BUS.TOPICS: state:selectedTableChanged is in the state-change family',
    topics['state:selectedTableChanged'].family, 'state-change');
  // The sidebar's settings apply. It carried the intent family and the
  // request:applySettings name on the wire until issue #325; the content
  // script always answered it, and the sidebar always read whether anyone
  // answered to decide bound versus unbound, so it is a request.
  eq('DR_BUS.TOPICS: request:applySettings is in the request family',
    topics['request:applySettings'].family, 'request');
  eq('DR_BUS.TOPICS: state:settingsChanged is in the state-change family',
    topics['state:settingsChanged'].family, 'state-change');
  eq('DR_BUS.TOPICS: request:applySettings routes to one tab\'s content script (cross-context: sidebar page -> content script)',
    topics['request:applySettings'].route, 'tab');
  eq('DR_BUS.TOPICS: state:settingsChanged has no route (same-context: model -> controller only)',
    topics['state:settingsChanged'].route, null);

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

  // --- (b) publishing the intent changes the model and emits the
  // resulting state-change with the whole new value. ---
  const originalSelected = DR_STORE.getSelectedTable();
  try {
    const fakeTable = { __fake: 'table-A' };
    let stateChangePayload = 'NOT_CALLED';
    const unsubscribe = DR_BUS.subscribe('state:selectedTableChanged', (payload) => {
      stateChangePayload = payload;
    });
    try {
      DR_BUS.publish('intent:selectTable', { table: fakeTable });
    } finally {
      unsubscribe();
    }
    eq('intent:selectTable: publishing the intent updates DR_STORE.getSelectedTable()',
      DR_STORE.getSelectedTable(), fakeTable);
    eq('intent:selectTable: the resulting state-change fires exactly once, carrying the whole new value',
      stateChangePayload, { table: fakeTable });
  } finally {
    DR_STORE.setSelectedTable(originalSelected);
  }

  // --- (c) reconnect: closing and reopening the sidebar must pull the
  // model's current snapshot, not depend on a state-change message the
  // sidebar could have missed while it was gone (the bus keeps no history). ---
  const savedSelected = DR_STORE.getSelectedTable();
  try {
    const reconnectTable = { __fake: 'table-B' };
    DR_STORE.setSelectedTable(reconnectTable);

    // No message is replayed here on purpose — a reconnecting view pulls,
    // it does not listen for what it missed. The store carried a third
    // field, "the sidebar is open", until the 2026-09-14 sidebar-state-
    // removal design retired it (#241); what a reopen pulls is the
    // selection and the settings.
    const snapshot = DR_STORE.getSnapshot();
    eq('reconnect: getSnapshot returns the selection to a reconnecting view',
      snapshot.selectedTable, reconnectTable);
    eq('reconnect: the snapshot carries the settings alongside the selection',
      snapshot.settings, DR_STORE.getSettings());
    eq('reconnect: the snapshot carries no sidebar-open field — the model holds none',
      Object.prototype.hasOwnProperty.call(snapshot, 'sidebarOpen'), false);
    eq('reconnect: the model exposes no reader for a sidebar-open value',
      typeof DR_STORE.isSidebarOpen, 'undefined');
    eq('reconnect: the model exposes no writer for a sidebar-open value',
      typeof DR_STORE.setSidebarOpen, 'undefined');
    eq('reconnect: selectedTable survives for the reopening view to pull',
      DR_STORE.getSelectedTable(), reconnectTable);
  } finally {
    DR_STORE.setSelectedTable(savedSelected);
  }

  // --- (d) no file writes another file's variables: build the list of
  // identifiers content.js declares at its top level, then confirm
  // ui-toggle.js contains no assignment to any of them. ---
  const contentSrcForScan = sourceByName('content.js');
  const uiToggleSrcForScan = sourceByName('ui-toggle.js');
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
  eq('static scan: content.js no longer declares lastRightClickedTable at top level',
    contentTopLevelNames.includes('lastRightClickedTable'),
    false);
  const crossFileWrites = contentTopLevelNames.filter((name) => {
    const assignRe = new RegExp('\\b' + name + '\\s*=[^=]');
    return assignRe.test(uiToggleSrcForScan);
  });
  eq("static scan: ui-toggle.js assigns none of content.js's top-level bindings",
    crossFileWrites, []);

  // --- (e) hardening: the scan above only catches writes to content.js's
  // SURVIVING top-level bindings. It has a blind spot — a name that moved OUT
  // of content.js into DR_STORE (selectedTable) is invisible to
  // that scan once it is gone from content.js's own declaration list, so a
  // file that reintroduces a bare assignment to that name (exactly the old
  // anti-pattern this sprint removed) would slip through undetected. Close
  // that gap by scanning for writes to DR_STORE's own private field names,
  // read directly from app/store.js rather than from content.js.
  //
  // The field declarations sit one level inside the IIFE (2-space indent);
  // anchoring on that indentation (rather than a bare \b(?:let|const) scan
  // anywhere in the file) is what keeps this from also matching the `const
  // entry = ...` locals declared inside the table-registry getters/setters
  // (app-model-registry sprint) — those are per-call temporaries, not fields.
  const storeFieldNames = Array.from(storeSrc.matchAll(/^ {2}(?:let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm))
    .map((m) => m[1])
    .filter((name) => name !== 'DR_STORE');
  eq('static scan: app/store.js declares its seven private fields (sanity check on the scan itself)',
    storeFieldNames.slice().sort(),
    ['ERROR_ROW_LIMIT', 'errorCount', 'errorRows',
     'registeredTables', 'selectedTable', 'settings', 'tableRegistry'].sort());
  const storeFieldWrites = storeFieldNames.filter((name) => {
    const assignRe = new RegExp('\\b' + name + '\\s*=[^=]');
    return assignRe.test(uiToggleSrcForScan) || assignRe.test(contentSrcForScan);
  });
  eq("static scan (hardened): neither ui-toggle.js nor content.js assigns DR_STORE's private field names directly",
    storeFieldWrites, []);
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split: ui-toggle.js splits into drawing (render from state,
// hold only view-transient state) and publishing (intents on DR_BUS in place
// of calls into the controller). The click handler used to call the
// controller's plain-toggle helper straight from the view.
//
// The forbidden list named that helper and the form-flip helper it reached
// until the 2026-09-14 sidebar-state-removal design retired both (#241). A
// list of names that exist nowhere cannot fail, so the list now names the
// controller entry points that DO exist: a view calling any of these reaches
// past the intent and around the one press path.
// ---------------------------------------------------------------------------
(function toggleSplit_viewCallsNoControllerFunctionDirectly() {
  const uiToggleSrc = sourceByName('ui-toggle.js');
  if (uiToggleSrc === null) {
    eq('toggle-split: ui-toggle.js is present in the manifest', false, true);
    return;
  }
  const FORBIDDEN_CONTROLLER_CALLS = ['applySidebarRounding', 'resetTable', 'roundTable'];
  // Sanity check on the scan itself: every forbidden name is a real function
  // in the content-script stack, so the filter below tests something.
  const missingFromController = FORBIDDEN_CONTROLLER_CALLS.filter(
    (name) => !new RegExp('function\\s+' + name + '\\s*\\(').test(allContentSrc));
  eq('toggle-split: every forbidden name is a real controller function (sanity check on the scan itself)',
    missingFromController, []);

  const foundCalls = FORBIDDEN_CONTROLLER_CALLS.filter((name) => {
    const callRe = new RegExp('\\b' + name + '\\s*\\(');
    return callRe.test(uiToggleSrc);
  });
  eq('toggle-split: ui-toggle.js calls no controller function directly',
    foundCalls, []);

  // The click handler publishes the press as an intent instead.
  eq('toggle-split: ui-toggle.js publishes intent:toggleTable from the click handler',
    /DR_BUS\.publish\(\s*'intent:toggleTable'/.test(uiToggleSrc), true);
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split: publishing intent:toggleTable is content.js's only
// path to running a press — prove the wiring end to end (mirrors the
// intent:selectTable behavioral pin in the app-model-selection block above).
// ---------------------------------------------------------------------------
(function toggleSplit_intentToggleTableRunsThePress() {
  // DR_DEFAULTS excludes row 0 (firstRow) and col 0 (firstColumn) — use a
  // 2x2 table so [row1, col1] is processed.
  const table = makeToggleTable([
    [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
    [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
  ]);
  injectToggleEntry(table);

  // The press writes the settings record and moves the active table now
  // (2026-09-14 sidebar-state-removal, part one), where the retired
  // plain-toggle path wrote neither. Both are shared model state, so this
  // test saves and restores them rather than leaving them for whatever runs
  // next.
  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  try {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    DR_STORE.setSelectedTable(table);

    const wasRounded = isTableRounded(table);
    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table });
    });
    const isNowRounded = isTableRounded(table);

    eq('toggle-split: publishing intent:toggleTable runs the press (table becomes simplified)',
      !wasRounded && isNowRounded, true);

    // A second press takes it back off, through the same path and the same
    // intent.
    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table });
    });
    eq('toggle-split: publishing intent:toggleTable again takes the table back to its original values',
      isTableRounded(table), false);
  } finally {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split: KNOWN BUG FIX — flashRangePulse used to read
// table.rows/row.cells directly, which only exist on native <table>
// elements. On a div-based grid Array.from(undefined) threw a TypeError,
// aborting the caller mid-flow (reverting the fix crashes this suite rather
// than failing an assertion). flashRangePulse now enumerates cells through the same TableAdapter
// (makeAdapter) the rounding engine and preview already use, so a grid's
// cells are found the same way a native table's are. This test fails
// without the fix: matchedCells.length would be 0 for the grid case below,
// and the (missing/whole-grid) fallback flash would not carry the
// range-restricted geometry asserted here.
// ---------------------------------------------------------------------------
(function toggleSplit_rangeFlashWorksOnGrids() {
  // 2x2 div-based grid (no ARIA roles, no vendor classes — the plain
  // fallback shape GridAdapter already supports elsewhere in this suite).
  const grid = makeGridWrapper([
    ['1,000,000', '500'],
    ['2,000,000', '750'],
  ]);

  // Distinct bounding rects per cell (document order: row0/col0, row0/col1,
  // row1/col0, row1/col1) so the union rect proves WHICH cells were matched
  // (column 1 only) rather than the whole grid or nothing at all.
  const rects = [
    { top: 0,  left: 0,   right: 100, bottom: 20 },
    { top: 0,  left: 100, right: 200, bottom: 20 },
    { top: 20, left: 0,   right: 100, bottom: 40 },
    { top: 20, left: 100, right: 200, bottom: 40 },
  ];
  grid.cellEls.forEach((cell, i) => { cell.getBoundingClientRect = () => rects[i]; });

  // Intercept the overlay div flashRangePulse creates and appends.
  const origCreateElement = global.document.createElement;
  const origBody = global.document.body;
  const origSetTimeout = global.setTimeout;
  let overlay = null;
  global.document.createElement = (tag) => {
    const el = { style: {}, addEventListener() {} };
    if (tag === 'div') overlay = el;
    return el;
  };
  const appended = [];
  global.document.body = { appendChild(el) { appended.push(el); } };
  global.setTimeout = () => 0; // avoid a real pending 1.5s cleanup timer

  // Range expression equivalent to selecting column B only (both rows) —
  // a partial range, so a whole-grid fallback would be visibly wrong.
  const ranges = [{ colMin: 1, colMax: 1, rowMin: 0, rowMax: 1 }];
  flashRangePulse(grid.wrapperEl, ranges);

  global.document.createElement = origCreateElement;
  global.document.body = origBody;
  global.setTimeout = origSetTimeout;

  eq('range-flash grid: an overlay is appended to document.body (not silently skipped)',
    appended.length, 1);
  eq('range-flash grid: the overlay carries the range-pulse class',
    overlay && overlay.className, 'dr-ext-range-pulse');
  eq('range-flash grid: the overlay is sized/positioned to the union of the matched grid cells (col 1 only), not the whole grid or nothing',
    overlay && { top: overlay.style.top, left: overlay.style.left, width: overlay.style.width, height: overlay.style.height },
    { top: '0px', left: '100px', width: '100px', height: '40px' });
})();

// ---------------------------------------------------------------------------
// Sprint grid-first-row-literal: the range pulse numbers rows the same way
// the engine gates them — by literal row number — so on a rowgroup grid the
// pulse frames the rows the engine actually touches, not the rows one slot
// below them.
// ---------------------------------------------------------------------------
(function gridLiteralNumbering_rangePulseFramesEngineRows() {
  // Table-10 shape: header row outside the rowgroup, two data rows inside.
  // The data rows are literal rows 2 and 3 (indices 1 and 2).
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1482391'], ['South', '918554']],
    null
  );

  // Distinct rects per data row so the overlay geometry proves WHICH row
  // matched: first data row at 0–20, second at 20–40.
  const rowRects = [
    { top: 0,  left: 0, right: 200, bottom: 20 },
    { top: 20, left: 0, right: 200, bottom: 40 },
  ];
  g.dataRowEls.forEach(function(rowEl, i) {
    rowEl.children.forEach(function(cell) {
      cell.getBoundingClientRect = function() { return rowRects[i]; };
    });
  });

  const origCreateElement = global.document.createElement;
  const origBody = global.document.body;
  const origSetTimeout = global.setTimeout;
  let overlay = null;
  global.document.createElement = (tag) => {
    const el = { style: {}, addEventListener() {} };
    if (tag === 'div') overlay = el;
    return el;
  };
  global.document.body = { appendChild() {} };
  global.setTimeout = () => 0;

  // Range naming literal row 2 only (index 1) — the first data row, the one
  // the engine rounds first under the shipped defaults.
  flashRangePulse(g.wrapperEl, [{ rowMin: 1, rowMax: 1, colMin: 0, colMax: 1 }]);

  global.document.createElement = origCreateElement;
  global.document.body = origBody;
  global.setTimeout = origSetTimeout;

  eq('range-pulse literal: the overlay frames the FIRST data row (literal row 2), matching the engine',
    overlay && { top: overlay.style.top, height: overlay.style.height },
    { top: '0px', height: '20px' });
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split (adversarial hardening): CLICK-HANDLER PARENT-EQUIVALENCE
// PIN across the full guard matrix. The consolidation claims that collapsing
// ui-toggle.js's two inlined click branches (mouse/keyboard, touch second-tap)
// down to one `DR_BUS.publish('intent:toggleTable', { table })` line each,
// with content.js's new intent:toggleTable subscriber running the same
// guarded body both branches used to run inline, produces the identical
// observable chrome.runtime.sendMessage sequence as before. This pin proves
// that claim across {same table, different table} x {sidebar open, closed},
// for both click branches — not just that a guard's boolean outcome matches
// (the AC1-AC4 rebind tests above already cover that), but that the ORDER
// and full contents of every dispatched message are unchanged.
//
// The expected sequences below are LITERALS captured by running the REAL
// click handler from both this sprint's parent (refactor/app-model-selection,
// the last commit with the guard/dispatch logic inlined per click branch in
// ui-toggle.js) and HEAD against this same fixture and harness, and verified
// byte-identical at review time. Frozen here rather than re-derived via
// `git show` at test-run time, matching the rationale in commit 394afa7: a
// shallow checkout or CI runner may not have the parent ref available.
// ---------------------------------------------------------------------------
(function toggleSplit_parentEquivalence_toggleClickSequences() {
  // Keyed by sameTable — mouse and touch second-tap produce the identical
  // sequence per cell, since both branches publish to the same handler. That
  // equality is itself part of what this pin proves: see the per-mode
  // assertions below, which check mouse and touch against the same literal.
  //
  // The matrix used to carry a second dimension, whether the sidebar stood
  // open, and four cells. The 2026-09-14 sidebar-state-removal design
  // retired the value that dimension varied (#241), and with it the branch
  // that read it — a press means one thing now, so the two surviving cells
  // are the whole matrix.
  const EXPECTED_SEQUENCES = {
    // A press on the ACTIVE table. Issue #272 put the settings-record write
    // at the front of this path: the press calls DR_STORE.setSettings with
    // the flipped enabled, the state-change subscriber runs the apply, and
    // the apply's own state:applyOk leads the sequence. state:tableEnabledChanged then
    // carries the settings record's new value, because no switch went out to
    // carry it. Byte-identical to the frozen parent capture for this cell.
    'true': [
      { action: 'state:applyOk' },
      { action: 'state:rangeOk' },
      { action: 'intent:updateMenuLabel', title: 'Toggle table' },
      { action: 'state:tableEnabledChanged', enabled: true },
    ],
    // A press on a table that is NOT the active one. Issue #251 made this
    // path sync the pressed table to the settings record in place of
    // simplifying it with the shipped defaults. The sidebar-state removal
    // then made it the only meaning such a press has, whatever the sidebar
    // is doing.
    //
    // state:tableSwitched leads so the sidebar lifts the previous table's lock
    // before this table's own state:applyBlocked/state:applyOk lands. No
    // state:previewSamplesChanged — the sidebar's pull chain ends in the preview
    // fetch. No state:tableEnabledChanged — the switch's own handler re-reads the
    // settings record, so a send here would deliver one fact twice.
    'false': [
      { action: 'state:tableSwitched' },
      { action: 'state:applyOk' },
      { action: 'state:rangeOk' },
      { action: 'intent:updateMenuLabel', title: 'Toggle table' },
    ],
  };

  // sameTable=true reuses the SAME table object for both "which table is
  // active" and "which table gets pressed" — the unmoved press. sameTable=
  // false makes a different table active than the one pressed — the press
  // that moves the active table, which must publish the switch.
  function runToggleClickFixture(mode, sameTable) {
    const clicked = makeToggleTable([
      [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    clicked._cells.forEach(c => { c.querySelectorAll = () => []; });

    let selected = clicked;
    if (!sameTable) {
      selected = makeToggleTable([
        [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
        [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
      ]);
      selected._cells.forEach(c => { c.querySelectorAll = () => []; });
    }

    const sentMessages = [];
    const origSendMessage = global.chrome.runtime.sendMessage;
    global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

    lastRightClickedTable = selected;

    const buttonEl = createToggleWithSpies(clicked);
    if (mode === 'mouse') fireMouseClick(buttonEl);
    else fireTouchSecondTap(buttonEl);

    global.chrome.runtime.sendMessage = origSendMessage;
    lastRightClickedTable = null;

    return sentMessages;
  }

  for (const sameTable of [true, false]) {
    const expected = EXPECTED_SEQUENCES[String(sameTable)];
    for (const mode of ['mouse', 'touch']) {
      const seq = runToggleClickFixture(mode, sameTable);
      eq(`toggle click sequence (${mode}, sameTable=${sameTable}): sendMessage sequence matches the frozen literal`,
        seq, expected);
    }
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection (adversarial hardening): statelessness. The bus
// keeps no last-value cache and no delivery history (see adapters/messaging.js
// header) — a subscriber that attaches AFTER a publish must never see that
// publish, unlike an EventEmitter with replay or a BehaviorSubject.
// ---------------------------------------------------------------------------
(function appModelSelection_busIsStateless_lateSubscriberMissesPastPublish() {
  const topic = 'state:selectedTableChanged';
  const fakeTable = { __fake: 'stateless-check' };
  const savedSelected = DR_STORE.getSelectedTable();
  try {
    // Publish BEFORE any subscriber attaches — nothing is listening yet.
    DR_BUS.publish(topic, { table: fakeTable });

    let received = 'NOT_CALLED';
    const unsubscribe = DR_BUS.subscribe(topic, (payload) => { received = payload; });
    try {
      eq('DR_BUS statelessness: a subscriber that attaches after a publish never receives that publish',
        received, 'NOT_CALLED');
    } finally {
      unsubscribe();
    }
  } finally {
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection (adversarial hardening): reentrancy. Same-context
// delivery is synchronous (see adapters/messaging.js header), so a subscribed
// handler may itself call DR_BUS.publish() for a different topic before
// returning. A two-topic cycle — A's handler publishes B; B's handler
// increments a counter and, guarded to do so only once, publishes A back —
// must settle without an infinite loop or a stack overflow.
// ---------------------------------------------------------------------------
(function appModelSelection_busReentrancy_twoTopicCycleSettles() {
  // The second topic was state:sidebarOpenChanged until the 2026-09-14
  // sidebar-state-removal design retired it (#241). state:settingsChanged
  // takes its place: the controller subscribes to it in production, and that
  // subscriber applies to whichever table is active, so the fixture clears
  // the active table first and the production handler no-ops. What the test
  // measures — the bus's own delivery under a nested publish — is unchanged.
  const TOPIC_A = 'state:selectedTableChanged';
  const TOPIC_B = 'state:settingsChanged';
  const savedSelected = DR_STORE.getSelectedTable();
  DR_STORE.setSelectedTable(null);
  let counter = 0;

  const unsubA = DR_BUS.subscribe(TOPIC_A, () => {
    DR_BUS.publish(TOPIC_B, { settings: DR_STORE.getSettings() }); // A's handler always publishes B
  });
  const unsubB = DR_BUS.subscribe(TOPIC_B, () => {
    counter++;
    if (counter === 1) {
      DR_BUS.publish(TOPIC_A, { table: null }); // guarded to bounce back to A only once
    }
  });

  let threw = null;
  try {
    DR_BUS.publish(TOPIC_A, { table: null }); // kick off the cycle
  } catch (e) {
    threw = e.message;
  } finally {
    unsubA();
    unsubB();
    DR_STORE.setSelectedTable(savedSelected);
  }

  eq('DR_BUS reentrancy: a guarded two-topic publish cycle completes without throwing (no infinite loop/stack overflow)',
    threw, null);
  eq('DR_BUS reentrancy: B fires exactly twice (initial A->B hop, then one guarded bounce back through A)',
    counter, 2);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings (issue #240): the depth guard itself. The cycle
// above is self-limiting (a caller-side counter stops it after one bounce);
// this one is NOT — neither handler has a stop condition, so without the
// bus's own guard this would recurse until the real call stack overflows.
// ---------------------------------------------------------------------------
(function appModelSettings_busReentrancy_unguardedCycleTerminatesSafely() {
  const TOPIC_A = 'state:selectedTableChanged';
  const TOPIC_B = 'state:settingsChanged';
  const savedSelected = DR_STORE.getSelectedTable();
  DR_STORE.setSelectedTable(null); // see the note on the guarded cycle above

  const unsubA = DR_BUS.subscribe(TOPIC_A, () => { DR_BUS.publish(TOPIC_B, { settings: DR_STORE.getSettings() }); });
  const unsubB = DR_BUS.subscribe(TOPIC_B, () => { DR_BUS.publish(TOPIC_A, { table: null }); });

  let threw = null;
  try {
    DR_BUS.publish(TOPIC_A, { table: null });
  } catch (e) {
    threw = e.message;
  } finally {
    unsubA();
    unsubB();
    DR_STORE.setSelectedTable(savedSelected);
  }

  eq('DR_BUS reentrancy (unguarded cycle): publish() throws a catchable error instead of crashing with a real stack overflow',
    typeof threw, 'string');
  eq('DR_BUS reentrancy (unguarded cycle): the thrown error names the depth guard, not a raw engine stack-overflow error',
    /publish depth exceeded/.test(threw || ''), true);

  // The guard must reset cleanly — every nested publish() decrements the
  // depth counter in a finally as the exception unwinds — so an unrelated
  // publish afterward must behave normally, not still read as "deep".
  let secondThrew = null;
  const unsubCheck = DR_BUS.subscribe(TOPIC_A, () => {});
  try {
    DR_BUS.publish(TOPIC_A, { table: null });
  } catch (e) {
    secondThrew = e.message;
  } finally {
    unsubCheck();
  }
  eq('DR_BUS reentrancy (unguarded cycle): the depth counter recovers — a later unrelated publish does not throw',
    secondThrew, null);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, adversarial: wire-payload parity with the parent
// branch's sendToActiveTab (refactor/app-model-selection, before this sprint
// inverted the transport). The message body itself is unchanged — {action,
// settings}, same field names, same nesting, no extra bus-envelope fields —
// but sendToActiveTab always passed chrome.tabs.sendMessage a THIRD argument,
// a response callback, and used it to react to delivery: clear statusEl on
// success, setTableBound(false) on chrome.runtime.lastError (no content
// script on the tab). adapters/messaging.js's publish() relay calls
// chrome.tabs.sendMessage with only two arguments — no callback — so that
// reaction is silently gone for the settings-apply path: a real Chrome would
// also log an "Unchecked runtime.lastError" warning on every failed delivery.
// This isolates DR_BUS in its own vm sandbox (messaging.js has no DOM
// dependency) and pins the call shape directly, independent of sidebar.js's
// heavier DOM requirements.
// ---------------------------------------------------------------------------
(function appModelSettings_wirePayload_parityWithParentSendToActiveTab() {
  if (messagingCode === null) {
    eq('wire payload: adapters/messaging.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const sentCalls = [];
  const sandbox = {
    chrome: {
      tabs: {
        query(q, cb) { cb([{ id: 7 }]); },
        sendMessage(...args) { sentCalls.push(args); },
      },
      runtime: {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\nthis.__DR_BUS = DR_BUS;', sandbox);

  // The settings apply is a request (#325), so the ask is what puts it on the
  // wire. Both verbs build the same envelope through the same tab carrier, so
  // this still pins the shape the old sendToActiveTab sent.
  sandbox.__DR_BUS.request('request:applySettings',
    { settings: { offsetTop: -2, rangeExpr: 'A1:B2' } }, () => {});

  eq('wire payload: exactly one chrome.tabs.sendMessage call for one ask',
    sentCalls.length, 1);
  if (sentCalls.length !== 1) return;

  const [tabId, msg, callback] = sentCalls[0];
  // Issue #325 put the topic name itself on the wire, in the same action field
  // the transport already used. The name changed; the field and the envelope
  // shape did not.
  eq('wire payload: message action is the topic name',
    msg.action, 'request:applySettings');
  eq('wire payload: message field names are exactly {action, settings} — no extra bus-envelope fields',
    Object.keys(msg).sort(), ['action', 'settings'].sort());
  eq('wire payload: settings payload is nested exactly as sendToActiveTab sent it, unchanged',
    JSON.stringify(msg.settings), JSON.stringify({ offsetTop: -2, rangeExpr: 'A1:B2' }));

  // ADVERSARIAL regression pin (see PR notes): the parent's sendToActiveTab
  // always passed a response callback (chrome.tabs.sendMessage's 3rd
  // argument) and used it to reflect delivery failure back into the UI
  // (setTableBound(false) on chrome.runtime.lastError) and to clear statusEl
  // on success. This only pins the MECHANISM — that publish() still passes a
  // callback — not the behavior; see appModelSettings_settingsPublish_
  // deliveryFeedback_behavioral below for the behavioral coverage.
  eq('wire payload: the ask passes a response callback to chrome.tabs.sendMessage, matching sendToActiveTab\'s delivery-failure handling (regression — see PR notes)',
    typeof callback, 'function');
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, adversarial fix (behavioral): the pin above only
// proves publish() PASSES a callback to chrome.tabs.sendMessage — it says
// nothing about what that callback does. This drives sidebar.js's real
// applyNow() -> DR_BUS.publish() path end to end and checks the two
// behaviors refactor/app-model-selection's sendToActiveTab had: a failed
// delivery (chrome.runtime.lastError) must unbind the sidebar via
// setTableBound(false); a successful delivery must clear #status.
// ---------------------------------------------------------------------------
(function appModelSettings_settingsPublish_deliveryFeedback_behavioral() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('settings publish delivery: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }

  // Minimal element stub — same shape as the other sidebar.js eval harnesses
  // in this file (see tableContextmenuActivation_sidebarFlash above).
  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
    };
  }

  // #status and #enabled are the two elements setTableBound touches; capture
  // the exact objects sidebar.js's document.getElementById() hands back so we
  // can read their mutations directly, with no need to export any function.
  const statusEl = makeEl();
  const enabledEl = makeEl();
  enabledEl.checked = true;
  let enabledChangeHandler = null;
  enabledEl.addEventListener = function (type, fn) { if (type === 'change') enabledChangeHandler = fn; };

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

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  // chrome.tabs.query/sendMessage resolve synchronously so the whole chain —
  // sidebar.js's applyNow() -> DR_BUS.request() -> chrome.tabs.sendMessage's
  // own callback -> the sidebar's answer callback — runs deterministically
  // within one call, with queuedLastError picking whether the stub answers
  // with a value or with nothing (matching real sendMessage semantics).
  const sentTabMessages = [];
  let queuedLastError = null;
  const captureChrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      get lastError() { return queuedLastError; },
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      // Chrome hands the callback the responder's value on success, and
      // nothing (with lastError set) when nobody answered. queuedLastError
      // picks which, so one stub covers both directions.
      sendMessage(tabId, msg, cb) {
        sentTabMessages.push(msg);
        if (typeof cb === 'function') cb(queuedLastError ? undefined : { ok: true });
      },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  // sidebar.js's top-level code — including its own change/click listener
  // registrations — resolves `document`/`chrome`/`window` dynamically off
  // the global object every time it runs, not just at eval time. The
  // captured enabledChangeHandler is called below, well after the initial
  // eval, so the stubs must stay installed for that call too — restore the
  // real globals only once every scenario below has run.
  try {
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        coreSrc + '\n' +
        messagingCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // sidebar.js's module-level settings/preview pull can throw past this
      // point in this stub environment (chrome.tabs.sendMessage's callback
      // gets no real response) — the 'change' listener registers before that
      // runs, so we only need it captured.
    }

    eq('settings publish delivery: sidebar\'s enabled-checkbox change handler was captured',
      typeof enabledChangeHandler, 'function');
    if (typeof enabledChangeHandler !== 'function') return;

    // --- Failure: chrome.runtime.lastError set -> setTableBound(false) ran. ---
    bodyClasses.delete('no-table');
    enabledEl.checked = true;
    statusEl.textContent = '';
    queuedLastError = { message: 'Could not establish connection.' };
    sentTabMessages.length = 0;
    enabledChangeHandler();

    eq('settings publish delivery: one request:applySettings message sent for the change',
      sentTabMessages.length, 1);
    eq('settings publish delivery: failed delivery adds the no-table class (setTableBound(false) ran)',
      bodyClasses.has('no-table'), true);
    eq('settings publish delivery: failed delivery flips the enabled checkbox off (setTableBound(false) ran)',
      enabledEl.checked, false);
    eq('settings publish delivery: failed delivery sets #status to the no-table message (setTableBound(false) ran)',
      statusEl.textContent, 'Right-click a table to connect it here.');

    // --- Success: no lastError -> #status is cleared. ---
    bodyClasses.delete('no-table');
    statusEl.textContent = 'a stale status message';
    queuedLastError = null;
    enabledChangeHandler();

    eq('settings publish delivery: successful delivery clears #status',
      statusEl.textContent, '');
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

// ---------------------------------------------------------------------------
// Issue #254 (sidebar side): the state:applyBlocked / state:applyOk notice lifecycle.
// The content script refuses a sidebar apply on a table whose registry
// originals did not survive re-injection (see the re-injection suite's
// scenario C) and sends state:applyBlocked; every non-refused apply sends
// state:applyOk. This drives sidebar.js's real onMessage handler and applyNow's
// real delivery callback, in the same eval harness as the delivery-feedback
// test above, and pins:
//   - state:applyBlocked shows the user-visible notice in #status (source-tagged);
//   - the notice survives applyNow's delivery-success clear — Chrome does
//     not guarantee whether the response callback or the content script's
//     status message lands first, so the clear must skip sourced messages;
//   - state:applyOk clears the notice, and ONLY the notice (a range error's
//     source tag is not its to clear), mirroring state:rangeOk;
//   - an unsourced stale status still clears on delivery success (the
//     behavior the delivery-feedback test above pins is preserved).
// ---------------------------------------------------------------------------
(function sidebarApplyBlocked_noticeLifecycle() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('apply-blocked notice: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }

  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
    };
  }

  const statusEl = makeEl();
  const enabledEl = makeEl();
  enabledEl.checked = true;
  let enabledChangeHandler = null;
  enabledEl.addEventListener = function (type, fn) { if (type === 'change') enabledChangeHandler = fn; };

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

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  let onMessageHandler = null;
  let queuedLastError = null;
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { onMessageHandler = fn; } },
      sendMessage() {},
      get lastError() { return queuedLastError; },
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      sendMessage(tabId, msg, cb) { if (typeof cb === 'function') cb(queuedLastError ? undefined : { ok: true }); },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  try {
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        coreSrc + '\n' +
        messagingCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // sidebar.js's module-level settings/preview pull can throw past this
      // point in this stub environment — both the onMessage listener and the
      // 'change' listener register before that runs.
    }

    eq('apply-blocked notice: sidebar onMessage handler was captured',
      typeof onMessageHandler, 'function');
    eq('apply-blocked notice: sidebar\'s enabled-checkbox change handler was captured',
      typeof enabledChangeHandler, 'function');
    if (typeof onMessageHandler !== 'function' || typeof enabledChangeHandler !== 'function') return;

    // --- state:applyBlocked shows the notice, tagged with its source. ---
    statusEl.textContent = '';
    delete statusEl.dataset.source;
    onMessageHandler({ action: 'state:applyBlocked', count: 3 }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:applyBlocked sets the user-visible notice in #status',
      statusEl.textContent,
      'This table\'s original values are no longer available. Reload the page, then apply settings again.');
    eq('apply-blocked notice: the notice is tagged with its source',
      statusEl.dataset.source, 'blocked');

    // --- The notice survives applyNow's delivery-success clear. ---
    enabledChangeHandler();
    eq('apply-blocked notice: a delivery-success clear does NOT wipe the notice (message/response ordering is not guaranteed)',
      statusEl.textContent,
      'This table\'s original values are no longer available. Reload the page, then apply settings again.');

    // --- state:rangeOk does not clear it either (source mismatch). ---
    onMessageHandler({ action: 'state:rangeOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:rangeOk leaves the blocked notice alone',
      statusEl.textContent,
      'This table\'s original values are no longer available. Reload the page, then apply settings again.');

    // --- state:applyOk clears it. ---
    onMessageHandler({ action: 'state:applyOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:applyOk clears the notice',
      statusEl.textContent, '');
    eq('apply-blocked notice: state:applyOk removes the source tag',
      statusEl.dataset.source, undefined);

    // --- state:applyOk leaves a range error alone (source mismatch, mirroring
    // state:rangeOk's own guard). ---
    onMessageHandler({ action: 'state:rangeError', error: 'Invalid range expression.' }, FROM_SIDEBAR_TAB, () => {});
    onMessageHandler({ action: 'state:applyOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:applyOk leaves a range error alone',
      statusEl.textContent, 'Invalid range expression.');
    onMessageHandler({ action: 'state:rangeOk' }, FROM_SIDEBAR_TAB, () => {});

    // --- An unsourced stale status still clears on delivery success — the
    // delivery-feedback behavior pinned above is preserved. ---
    statusEl.textContent = 'a stale status message';
    delete statusEl.dataset.source;
    enabledChangeHandler();
    eq('apply-blocked notice: an unsourced stale status still clears on delivery success',
      statusEl.textContent, '');

    // --- Issue #262: state:applyBlocked also locks the panel. The connected
    // table is stuck showing simplified values, so the main toggle must
    // show ON (the truth) and stop accepting input, and the settings area
    // dims via body.table-locked. state:applyOk, a table switch
    // (state:tableSwitched), and unbinding (delivery failure →
    // setTableBound(false)) each lift the lock. ---
    enabledEl.checked = false;
    enabledEl.disabled = false;
    onMessageHandler({ action: 'state:applyBlocked', count: 1 }, FROM_SIDEBAR_TAB, () => {});
    eq('sidebar lock: state:applyBlocked adds body.table-locked',
      bodyClasses.has('table-locked'), true);
    eq('sidebar lock: state:applyBlocked forces the main toggle ON — the table IS simplified',
      enabledEl.checked, true);
    eq('sidebar lock: state:applyBlocked disables the main toggle',
      enabledEl.disabled, true);

    onMessageHandler({ action: 'state:applyOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('sidebar lock: state:applyOk lifts the lock',
      bodyClasses.has('table-locked'), false);
    eq('sidebar lock: state:applyOk re-enables the main toggle',
      enabledEl.disabled, false);

    onMessageHandler({ action: 'state:applyBlocked', count: 1 }, FROM_SIDEBAR_TAB, () => {});
    onMessageHandler({ action: 'state:tableSwitched' }, FROM_SIDEBAR_TAB, () => {});
    eq('sidebar lock: a table switch (state:tableSwitched) lifts the lock',
      bodyClasses.has('table-locked'), false);
    eq('sidebar lock: a table switch re-enables the main toggle',
      enabledEl.disabled, false);

    onMessageHandler({ action: 'state:applyBlocked', count: 1 }, FROM_SIDEBAR_TAB, () => {});
    queuedLastError = { message: 'Could not establish connection.' };
    enabledChangeHandler();
    queuedLastError = null;
    eq('sidebar lock: unbinding (delivery failure) lifts the lock',
      bodyClasses.has('table-locked'), false);
    eq('sidebar lock: unbinding re-enables the main toggle for the no-table state',
      enabledEl.disabled, false);
    eq('sidebar lock: unbinding drops the stale source tag — the no-table message it writes is unsourced',
      statusEl.dataset.source, undefined);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

// ---------------------------------------------------------------------------
// Issue #262 (static): the locked presentation exists in the stylesheets.
// body.table-locked must dim and mute the settings area and the title-row
// switch in sidebar.html; the on-page pill's locked look lives in
// ui-toggle.js's injected style.
// ---------------------------------------------------------------------------
(function lockedPresentation_stylesExist() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('locked styles: sidebar.html styles body.table-locked',
    sidebarHtmlSrc.includes('body.table-locked'), true);
  eq('locked styles: the locked sidebar blocks pointer input (pointer-events: none present in the table-locked block)',
    /body\.table-locked[^}]*\{[^}]*pointer-events:\s*none/.test(sidebarHtmlSrc), true);
  eq('locked styles: ui-toggle.js styles the locked pill class',
    uiToggleCode !== null && uiToggleCode.includes('.dr-ext-morph-locked'), true);
  eq('locked styles: the locked pill shows a not-allowed cursor',
    uiToggleCode !== null && /\.dr-ext-morph-locked[^}]*\{[^}]*cursor:\s*not-allowed/.test(uiToggleCode), true);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings: settings live in DR_STORE, sourced from
// DR_DEFAULTS at init, changed only through setSettings (publishing the
// whole new value), and read back through getSettings().
// ---------------------------------------------------------------------------
(function appModelSettings_storeSettingsField() {
  eq('DR_STORE.getSettings: defaults to DR_DEFAULTS-shaped values at store init',
    DR_STORE.getSettings().offsetTop, DR_DEFAULTS.offsetTop);

  const savedSettings = DR_STORE.getSettings();
  try {
    let stateChangePayload = 'NOT_CALLED';
    const unsubscribe = DR_BUS.subscribe('state:settingsChanged', (payload) => {
      stateChangePayload = payload;
    });
    const newSettings = Object.assign({}, DR_DEFAULTS, { offsetTop: 0.25, rangeExpr: 'A1:C9' });
    try {
      DR_STORE.setSettings(newSettings);
    } finally {
      unsubscribe();
    }
    eq('DR_STORE.setSettings: getSettings() reflects the new value',
      DR_STORE.getSettings().offsetTop, 0.25);
    eq('DR_STORE.setSettings: the resulting state-change carries the whole new value, not a delta',
      stateChangePayload && stateChangePayload.settings && stateChangePayload.settings.rangeExpr, 'A1:C9');

    // getSettings() returns a copy — mutating what a caller read must not
    // corrupt the store's own internal value (immutability convention).
    const read = DR_STORE.getSettings();
    read.offsetTop = 999;
    eq('DR_STORE.getSettings: returns a copy, not a live reference — mutating it does not affect the store',
      DR_STORE.getSettings().offsetTop, 0.25);
  } finally {
    DR_STORE.setSettings(savedSettings);
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, AC2: the preview band and the table must round
// the same cell to the same value once a setting changes — the bug this
// sprint fixes was extractPreviewSamples reading DR_DEFAULTS while roundTable
// read the model, so they disagreed the moment a slider moved off default.
// ---------------------------------------------------------------------------
(function appModelSettings_previewAndTableAgreeOnLiveSettings() {
  const savedSettings = DR_STORE.getSettings();
  try {
    const customSettings = Object.assign({}, DR_DEFAULTS, {
      simplifyFirstRow: true,
      simplifyFirstColumn: true,
      offsetTop: -2,
      offsetOther: 0.25,
      numTop: 1,
      rangeExpr: '',
    });
    // Validity check on the fixture itself: these offsets must differ from
    // DR_DEFAULTS, or a regression back to reading DR_DEFAULTS would slip
    // through this test undetected.
    eq('preview/table agreement: fixture offsets differ from DR_DEFAULTS (test validity check)',
      customSettings.offsetTop !== DR_DEFAULTS.offsetTop && customSettings.offsetOther !== DR_DEFAULTS.offsetOther,
      true);
    DR_STORE.setSettings(customSettings);

    const previewTable = makeMockTable([[
      { tag: 'td', text: '1,000,000' },
      { tag: 'td', text: '50' },
    ]]);
    const preview = extractPreviewSamples(previewTable);
    eq('preview/table agreement: top band has the large cell',
      preview.samples.top.length, 1);
    eq('preview/table agreement: bottom band has the small cell',
      preview.samples.bottom.length, 1);

    const expectedTop = roundWithOffset(1000000, customSettings.offsetTop);
    const expectedBottom = roundWithOffset(50, customSettings.offsetOther);

    // What the sidebar's preview band would render for these two cells,
    // built from the same sample the model supplied.
    eq('preview/table agreement: preview top sample rounds via the live offsetTop',
      roundWithOffset(preview.samples.top[0].num, customSettings.offsetTop), expectedTop);
    eq('preview/table agreement: preview bottom sample rounds via the live offsetOther',
      roundWithOffset(preview.samples.bottom[0].num, customSettings.offsetOther), expectedBottom);

    // What the table actually renders for the identical cells, applied the
    // way the state:settingsChanged subscriber does — straight from the model.
    const liveTable = makeMockTable([[
      { tag: 'td', text: '1,000,000' },
      { tag: 'td', text: '50' },
    ]]);
    withCreateTreeWalker(() => {
      roundTable(liveTable, DR_STORE.getSettings());
    });
    const renderedTop = toNumber(liveTable.rows[0].cells[0].innerText);
    const renderedBottom = toNumber(liveTable.rows[0].cells[1].innerText);

    eq('preview/table agreement: the table cell value matches the preview-predicted top value',
      renderedTop, expectedTop);
    eq('preview/table agreement: the table cell value matches the preview-predicted bottom value',
      renderedBottom, expectedBottom);
  } finally {
    DR_STORE.setSettings(savedSettings);
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, AC5: settings survive a sidebar close and
// reopen — pulled from the model (request:settings), not reset to DR_DEFAULTS.
// Uses the same isolated-eval capture pattern as the request:applySettings
// AC1 test above, so this shared-scope DR_STORE is untouched by it.
// ---------------------------------------------------------------------------
(function appModelSettings_settingsSurviveSidebarReconnect() {
  // Chrome hands an arriving message to every registered listener, so collect
  // them all and fan out the same way. The bundle registers one today, the
  // bus's; keeping only the last registration would silently skip whichever
  // listener registers first should a second one ever appear.
  const capturedListeners = [];
  function capturedListener(req, sender, respond) {
    // Chrome keeps the reply port open when ANY listener returns true, and
    // closes it otherwise. Returning nothing here would make the
    // synchronous-answer assertions below unfalsifiable.
    let keepOpen = false;
    for (const fn of capturedListeners) {
      if (fn(req, sender, respond || function () {}) === true) keepOpen = true;
    }
    return keepOpen;
  }
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { capturedListeners.push(fn); } },
      sendMessage: () => {},
      lastError: null,
    },
  };
  const captureDoc = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };
  const captureWindow = {
    addEventListener: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };

  const saved = { chrome: global.chrome, document: global.document, window: global.window };
  global.chrome = captureChrome;
  global.document = captureDoc;
  global.window = captureWindow;
  try {
    eval(contentScriptBundle);
  } catch (e) {
    // module-level code may fail in the stub environment; the onMessage
    // listener registers before any dynamic code runs (see the AC1 test).
  } finally {
    global.chrome = saved.chrome;
    global.document = saved.document;
    global.window = saved.window;
  }

  eq('reconnect: the isolated listener was captured',
    capturedListeners.length > 0, true);
  if (capturedListeners.length === 0) return;

  // The sidebar sets a custom value (an "open" session), then — simulated by
  // nothing happening in between — closes and reopens, pulling the model.
  const customSettings = {
    enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: true,
    simplifyMixedPercent: true, simplifyFirstRow: false, simplifyFirstColumn: false,
    simplifyDates: true, simplifyTimes: false, dateGranularity: 'year', timeGranularity: 'hour',
    offsetTop: 0.25, offsetOther: -1.5, numTop: 1, rangeExpr: 'B2:E8',
  };
  let applyResponse = null;
  capturedListener({ action: 'request:applySettings', settings: customSettings }, {}, (r) => { applyResponse = r; });
  eq('reconnect: request:applySettings was acknowledged before the (simulated) close',
    applyResponse && applyResponse.ok, true);

  // Reopen: exactly what pullSettingsAndApplyToUI's request:settings does.
  let getResponse = null;
  capturedListener({ action: 'request:settings' }, {}, (r) => { getResponse = r; });

  eq('reconnect: request:settings returns a settings object',
    !!(getResponse && getResponse.settings), true);
  eq('reconnect: offsetTop survives the close/reopen',
    getResponse.settings.offsetTop, 0.25);
  eq('reconnect: offsetOther survives the close/reopen',
    getResponse.settings.offsetOther, -1.5);
  eq('reconnect: rangeExpr survives the close/reopen',
    getResponse.settings.rangeExpr, 'B2:E8');
  eq('reconnect: a changed boolean flag survives the close/reopen',
    getResponse.settings.simplifyMixedCells, false);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, bucket-2 fix: a pulled enabled:false must survive
// sidebar reopen when the reopen lands on a TABLE THAT IS BOUND. This drives
// sidebar.js's real pullSettingsAndApplyToUI() -> applySettingsToUI() ->
// fetchPreviewSamples() chain end to end (same eval harness shape as
// appModelSettings_settingsPublish_deliveryFeedback_behavioral above).
//
// The bug (as found): pullSettingsAndApplyToUI applied the pulled settings
// (correctly setting enabledEl.checked = false), then called
// fetchPreviewSamples(), whose response callback called setTableBound(true)
// once request:previewSamples resolved with a bound table — and setTableBound's
// bound branch unconditionally did `enabledEl.checked = DR_DEFAULTS.enabled
// !== false`, which is true, clobbering the pulled false. Sprint 9 patched
// it by threading the pulled settings through fetchPreviewSamples; issue
// #251 then removed the bound branch's default write entirely, which made
// the threading unnecessary. This test stays as the regression pin either
// way: a pulled enabled:false must survive the reopen.
// ---------------------------------------------------------------------------
(function appModelSettings_pulledEnabledSurvivesReopenOnBoundTable() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('reopen-bound: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }

  // Same minimal element stub as the other full-sidebar.js eval harnesses in
  // this file (see appModelSettings_settingsPublish_deliveryFeedback_behavioral).
  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
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

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  // The model holds enabled:false. request:settings returns that pulled settings
  // object; request:previewSamples returns a non-null samples object, i.e. the
  // reopen landed on a table that is bound (the reviewer's reachable end
  // state). Both resolve synchronously so the whole
  // pullSettingsAndApplyToUI() -> fetchPreviewSamples() chain — including
  // sidebar.js's own module-level call to pullSettingsAndApplyToUI() on
  // load — settles deterministically within the single eval() call below.
  const pulledSettings = Object.assign({}, DR_DEFAULTS, { enabled: false });
  const captureChrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      lastError: null,
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      sendMessage(tabId, msg, cb) {
        if (msg.action === 'request:settings') {
          cb({ settings: pulledSettings });
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
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        coreSrc + '\n' +
        messagingCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // The stubs above are built to let the whole module-level
      // pullSettingsAndApplyToUI() -> fetchPreviewSamples() chain resolve
      // synchronously and without throwing, unlike the sibling harness (which
      // only needs the 'change' listener captured before its own pull runs).
      // Record any throw instead of silently swallowing it — an unstubbed
      // DOM method here must fail this test loudly, not make enabledEl.checked
      // read its untouched initial value and pass for the wrong reason.
      evalError = e;
    }

    eq('reopen-bound: sidebar.js\'s module-level pull ran to completion with no stub gaps',
      evalError, null);
    eq('reopen-bound: the pulled enabled:false survives the reopen once the preview response resolves (samples !== null)',
      enabledEl.checked, false);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

