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

(function issue251_tableSwitchMirrorsModelSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('switch-pull: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('switch-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('switch-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Drift the panel away from the model: the pill shows on (as the old
    // defaults reset left it), the range expression is blank, and the
    // previous table's apply left the panel locked.
    h.enabledEl.checked = true;
    h.rangeExprEl.value = '';
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    eq('switch-pull: precondition — the previous table\'s state:applyBlocked locked the panel',
      h.bodyClasses.has('table-locked'), true);

    // The switch message: lift the lock, re-read the model.
    h.dispatch({ action: 'state:tableSwitched' });
    eq('switch-pull: a table switch lifts the lock',
      h.bodyClasses.has('table-locked'), false);
    eq('switch-pull: a table switch re-enables the main toggle',
      h.enabledEl.disabled, false);
    eq('switch-pull: the main toggle mirrors the model\'s enabled:false after a switch',
      h.enabledEl.checked, false);
    // The claim here is that the sidebar MIRRORS the application model. A
    // press that moves the active table sends state:tableSwitched and then clears
    // the range expression in its one settings write (2026-09-14 sidebar-
    // state-removal, part one). The send goes out first, and Chrome delivers
    // it after the content script's handler returns, so the pull it triggers
    // reads the cleared expression. What reaches the sidebar through this
    // path after such a press is therefore blank. This test still holds,
    // because it asserts the mirroring and the model fixture above is what
    // it mirrors.
    eq('switch-pull: the range expression mirrors the model after a switch (pull, not defaults reset)',
      h.rangeExprEl.value, 'B2:E8');
  } finally {
    h.restore();
  }
})();

(function issue251_previewRefreshMirrorsModelSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('refresh-pull: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('refresh-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('refresh-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Drift the pill on, then deliver the stale-view signal. The old bare
    // preview fetch ended in setTableBound(true), which reset the pill to
    // the shipped default (on) — the model says off.
    h.enabledEl.checked = true;
    h.dispatch({ action: 'state:previewSamplesChanged' });
    eq('refresh-pull: the main toggle mirrors the model\'s enabled:false after a preview refresh',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function issue251_lockOutlivesAPullResolvingUnderIt() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-vs-pull: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-vs-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('lock-vs-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Issue #262's lock forces the main toggle ON + disabled (the bound
    // table is stuck simplified). A settings pull that resolves while the
    // lock is displayed — a reconnect refresh whose apply just re-blocked —
    // must not write the model's enabled:false over the lock's forced ON.
    // Ordering here mirrors the wire: state:applyBlocked lands, then the
    // stale-view refresh runs its pull.
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    eq('lock-vs-pull: precondition — state:applyBlocked locked the panel',
      h.bodyClasses.has('table-locked'), true);

    h.dispatch({ action: 'state:previewSamplesChanged' });
    eq('lock-vs-pull: the pull leaves the locked toggle ON — the table IS simplified',
      h.enabledEl.checked, true);
    eq('lock-vs-pull: the pull leaves the locked toggle disabled',
      h.enabledEl.disabled, true);
    eq('lock-vs-pull: the lock itself survives the pull',
      h.bodyClasses.has('table-locked'), true);
  } finally {
    h.restore();
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, adversarial: the full wire path, not the store
// directly. appModelSettings_previewAndTableAgreeOnLiveSettings (above) calls
// DR_STORE.setSettings() straight from the test — it never exercises
// content.js's own onMessage listener or the state:settingsChanged
// subscriber, which is the actual code path a real request:applySettings
// message drives. This test dispatches that message through the captured
// listener (the AC1 pattern) against a table already bound as "selected",
// lets the real subscriber call applySidebarRounding, and checks the
// resulting cells against extractPreviewSamples computed from the same
// settings on an identical table — so the assertion covers the message
// arriving, not just the pure math agreeing.
// ---------------------------------------------------------------------------
(function appModelSettings_wireMessageAppliesLiveSettingsToBoundTableAndPreviewAgrees() {
  function makeWiredMockTable(rowsSpec) {
    const table = makeMockTable(rowsSpec);
    table.classList = { remove() {}, add() {}, contains() { return false; } };
    table.offsetWidth = 0;
    table.querySelectorAll = () => [];
    return table;
  }

  // Values chosen so the offsets below visibly change them (unlike, say,
  // 1,000,000 / 50 at offsetTop -2 / offsetOther 0.25, which round to
  // themselves and would pass this test even if rounding silently no-op'd).
  const rowsSpec = [[
    { tag: 'td', text: '1,234,567' },
    { tag: 'td', text: '37' },
  ]];
  const CUSTOM_OFFSET_TOP = -2;
  const CUSTOM_OFFSET_OTHER = 0.25;

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
  let wiredDR_STORE = null;
  let wiredExtractPreviewSamples = null;
  let boundTable = null;
  let ackResponse = null;

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
    // applySidebarRounding's ensureHighlightStyleInjected() needs these —
    // the reconnect/AC1 tests above never reach that call (no selected
    // table, so the subscriber's `if (selected)` guard short-circuits).
    createElement: () => ({ textContent: '', appendChild() {} }),
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
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
    withCreateTreeWalker(() => {
      try {
        eval(contentScriptBundle + `
          wiredDR_STORE = DR_STORE;
          wiredExtractPreviewSamples = extractPreviewSamples;
        `);
      } catch (e) {
        // module-level init may fail against the stub DOM; the onMessage
        // listener and the two wiring assignments above both run before any
        // dynamic/async code (see the AC1 test).
      }

      if (capturedListeners.length === 0 || !wiredDR_STORE) return;

      // Bind a table as "selected" — mirrors what the contextmenu handler
      // does for real, so the state:settingsChanged subscriber has
      // something to apply the incoming message to.
      boundTable = makeWiredMockTable(rowsSpec);
      wiredDR_STORE.setSelectedTable(boundTable);

      const customSettings = Object.assign({}, DR_DEFAULTS, {
        simplifyFirstRow: true, simplifyFirstColumn: true,
        offsetTop: CUSTOM_OFFSET_TOP, offsetOther: CUSTOM_OFFSET_OTHER,
        numTop: 1, rangeExpr: '',
      });

      // The real wire message, dispatched through the real onMessage
      // listener — not DR_STORE.setSettings() called directly from the test.
      capturedListener(
        { action: 'request:applySettings', settings: customSettings },
        {},
        (r) => { ackResponse = r; }
      );
    });
  } finally {
    global.chrome = saved.chrome;
    global.document = saved.document;
    global.window = saved.window;
  }

  eq('wire E2E: content.js onMessage listener was captured',
    capturedListeners.length > 0, true);
  eq('wire E2E: request:applySettings was acknowledged',
    ackResponse && ackResponse.ok, true);
  if (!boundTable) return;

  // The subscriber applied the message straight to the bound table — no
  // separate "apply" call from the test.
  const renderedTop = toNumber(boundTable.rows[0].cells[0].innerText);
  const renderedBottom = toNumber(boundTable.rows[0].cells[1].innerText);
  eq('wire E2E: the fixture top value actually changed under rounding (test validity check)',
    renderedTop !== 1234567, true);
  eq('wire E2E: the fixture bottom value actually changed under rounding (test validity check)',
    renderedBottom !== 37, true);
  eq('wire E2E: the bound table was actually rounded by the real subscriber path',
    boundTable.rows[0].cells[0].classList.contains('dr-ext-rounded'), true);

  // A fresh, identically-populated table for the preview extractor, so its
  // read of DR_STORE.getSettings() cannot see already-rounded text.
  const previewTable = makeWiredMockTable(rowsSpec);
  const preview = wiredExtractPreviewSamples(previewTable);
  eq('wire E2E: preview top band has the large cell',
    preview.samples.top.length, 1);
  eq('wire E2E: preview bottom band has the small cell',
    preview.samples.bottom.length, 1);

  const previewTop = roundWithOffset(preview.samples.top[0].num, CUSTOM_OFFSET_TOP);
  const previewBottom = roundWithOffset(preview.samples.bottom[0].num, CUSTOM_OFFSET_OTHER);

  eq('wire E2E: the table cell the real message pipeline rendered matches the preview-predicted top value',
    renderedTop, previewTop);
  eq('wire E2E: the table cell the real message pipeline rendered matches the preview-predicted bottom value',
    renderedBottom, previewBottom);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection (adversarial hardening): parent-equivalence pin.
// The contextmenu handler in content.js is the one call site both branches
// implement: the pre-model code wrote a bare `lastRightClickedTable = table`
// file-level let; HEAD calls DR_STORE.setSelectedTable(table) instead. The
// expected sendMessage sequences below are LITERALS captured from the parent
// branch (refactor/engine-returns-results, commit 35a5f52) by running its
// real contextmenu listener in this same harness, and were verified
// byte-identical to HEAD's output at review time. Freezing them keeps this
// pin alive on main and in shallow CI checkouts, where the parent ref does
// not exist for `git show`.
// ---------------------------------------------------------------------------
(function appModelSelection_parentEquivalence_contextmenuSelectionFlow() {
  // One sequence. This ran twice, once with the page's copy of "the sidebar
  // is open" set each way, and produced the identical sequence both times,
  // because the contextmenu handler never read that value. The 2026-09-14
  // sidebar-state-removal design retired the value (#241), so the two runs
  // collapse into one.
  const PARENT_EXPECTED_SEQUENCE = [{ action: 'state:tableActivated' }];

  // Minimal fixture the contextmenu handler's findTargetTable() walk-up
  // recognizes immediately as a table (closest('table') returns itself) —
  // same shape the existing table-contextmenu-activation runtime test uses.
  function makeFixtureTarget() {
    return {
      tagName: 'TABLE',
      classList: { remove() {}, add() {}, contains() { return false; } },
      get offsetWidth() { return 0; },
      rows: [],
      dataset: {},
      closest(sel) { return sel === 'table' ? this : null; },
      matches() { return false; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
  }

  // Evaluates `bundle`, then `postEvalLine` (same eval call, so postEvalLine
  // can still reference the bundle's top-level let/const bindings — e.g.
  // DR_STORE — even though those bindings are not reachable from outside
  // this function once eval() returns), captures the 'contextmenu' listener
  // the bundle registers, fires it once against a fresh fixture target, and
  // returns the resulting sendMessage sequence.
  function runContextmenuFixture(bundle, postEvalLine) {
    let capturedHandler = null;
    const sentMessages = [];
    const captureDoc = {
      addEventListener(type, handler) { if (type === 'contextmenu') capturedHandler = handler; },
      querySelectorAll: () => [],
      readyState: 'complete',
      body: { appendChild() {} },
    };
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
    };
    global.document = captureDoc;
    global.chrome = captureChrome;
    global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
    global.MutationObserver = class { observe() {} disconnect() {} };
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    global.Node = { ELEMENT_NODE: 1 };
    global.NodeFilter = { SHOW_TEXT: 4 };
    try {
      eval(bundle + postEvalLine);
      if (typeof capturedHandler !== 'function') return null;
      capturedHandler({ target: makeFixtureTarget() });
      return sentMessages;
    } finally {
      global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
      global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
      global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
    }
  }

  const headMessages = runContextmenuFixture(contentScriptBundle, '');

  eq("parent-equivalence: HEAD's contextmenu handler was captured",
    headMessages !== null, true);
  eq('parent-equivalence: contextmenu sendMessage sequence matches the frozen parent sequence',
    headMessages, PARENT_EXPECTED_SEQUENCE);
})();

// =============================================================================
// Sprint app-model-registry: the registry of found tables, per-cell originals,
// and the simplified/original flag live in DR_STORE; the dr-ext-grid marker
// class becomes a style hook only.
// =============================================================================

// --- (a) One restore path: a native table and a grid restore through the
// same restoreTable() call. ---
(function registrySprint_oneRestorePathForBothKinds() {
  withCreateTreeWalker(function () {
    // Native table: header row (excluded) + one data row.
    const table = makeToggleTable([
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
    const originalValue = DR_STORE.getTableOriginalText(grid.wrapperEl, cell0);

    // Strip every page attribute a pre-registry build would have relied on —
    // the re-apply must work from DR_STORE alone.
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

// --- (c) Static lock: no production read of the dr-ext-grid marker class as
// state — classList.contains/closest('.dr-ext-grid') may appear only as a
// write (classList.add) or inside a comment discussing the history; a real
// read call is what this locks out. ---
(function registrySprint_noMarkerClassReadLock() {
  const filesToScan = ['content.js', 'ui-toggle.js', 'lib/dr-table/detect.js'];
  const readPatterns = [
    /classList\.contains\(\s*['"]dr-ext-grid['"]\s*\)/g,
    /\.closest\(\s*['"]\.dr-ext-grid['"]\s*\)/g,
  ];
  for (const file of filesToScan) {
    const src = sourceByName(file);
    if (src === null) {
      eq(`registry static lock: ${file} present in manifest`, false, true);
      continue;
    }
    // Strip line comments and block comments before scanning, so a comment
    // that merely mentions the old pattern (documenting the sprint's own
    // removal of it) cannot trip the lock.
    const withoutComments = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    const matches = readPatterns.flatMap((re) => withoutComments.match(re) || []);
    eq(`registry static lock: ${file} has no dr-ext-grid marker-class read`,
      matches, []);
  }
})();

// --- (d) The shared-ownership guard comment is gone from content.js — the
// flag it warned about no longer has two independent writers to coordinate. ---
(function registrySprint_guardCommentRemoved() {
  const contentSrc = sourceByName('content.js');
  eq('registry: the old showing-original shared-ownership guard comment is gone',
    /Showing-original guard: when the per-table toggle has flipped the grid/.test(contentSrc),
    false);
})();

// --- (e) A full simplify → off → simplify cycle returns the cell to the
// exact original text and then to the exact same simplified text.
//
// The off step used to keep the registry's stored original and re-round from
// it. The 2026-09-14 sidebar-state-removal design retired that form flip
// (#241): off resets, which clears the record, and the re-simplify reads the
// restored cell and writes a fresh record. The assertions read what the user
// sees, which is unchanged. The record's lifetime changes with it. ---
(function registrySprint_originalsSurviveOffAndOnCycle() {
  withCreateTreeWalker(function () {
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    injectToggleEntry(table);
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
    eq('registry cycle: isTableRounded is false while the original text shows',
      isTableRounded(table), false);
    eq('registry cycle: the off press clears the stored original, where the form flip kept it',
      DR_STORE.hasTableOriginal(table, cell), false);

    roundTable(table, opts); // the press that turns it back on
    eq('registry cycle: cell is simplified again after the on press',
      cell.textContent, roundedText);
    eq('registry cycle: isTableRounded is true again after the on press',
      isTableRounded(table), true);
    eq('registry cycle: the on press writes a fresh stored original from the restored text',
      DR_STORE.getTableOriginalText(table, cell), '8,584,629');
  });
})();

// --- (f) Grid magnitude basis freeze: DELIBERATE BEHAVIOR CHANGE from the
// parent branch (refactor/app-model-settings), where computeGridRoundedValues
// took no frozenMaxMag parameter and reapplyRounding recomputed max_mag
// from whatever was visible on every scroll re-apply. HEAD's roundTable
// freezes max_mag on first sight into DR_STORE.setTableMaxMagnitude and every
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
    eq('magnitude freeze: DR_STORE freezes maxMagnitude at 2 on first sight',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);

    // Simulate scroll bringing a magnitude-9 row into view alongside the
    // still-visible 555 row — appended to the wrapper's children, the
    // fallback _getRowEls path this unlabelled-grid shape uses.
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
    eq('magnitude freeze: DR_STORE.getTableMaxMagnitude never shifts off the frozen value',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);
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
// actual behavior (#257), documented here so a reviewer can judge whether
// "frozen at first sight" was meant to survive a round trip.
//
// The round trip used to run through a form flip that kept the table's
// markers. The 2026-09-14 sidebar-state-removal design retired that flip
// (#241) in favor of a reset, and both clear the frozen basis the same way,
// so the behavior under test is unchanged — only the driver is. ---
(function registrySprint_offAndOnRoundTripReFreezesRatherThanPreserving() {
  let ctx;
  try {
    const opts = { offsetTop: -1, offsetOther: 0, numTop: 1 };
    ctx = setupVirtGrid([['555']], opts);
    const { grid } = ctx;
    const cell555 = grid.cellEls[0];

    eq('toggle round trip: initial freeze is at max_mag=2 ("560")',
      cell555.childNodes[0].nodeValue, '560');
    eq('toggle round trip: DR_STORE holds the frozen basis before any toggle',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);

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

    applySidebarRounding(grid.wrapperEl, Object.assign({}, applyOpts, { enabled: false }));
    eq('round trip: the off press clears the display back to "555"',
      cell555.childNodes[0].nodeValue, '555');
    eq('round trip: the off press clears the frozen basis',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), null);

    applySidebarRounding(grid.wrapperEl, Object.assign({}, applyOpts, { enabled: true }));
    eq('round trip: DR_STORE re-freezes from the now-visible magnitude-9 row (9), not the original magnitude-2 basis',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 9);
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

// --- (g) state:tableEnabledChanged sequence: isTableRounded (claim 4 — now reading
// DR_STORE's appliedFlag instead of a dr-ext-rounded/dataset.drShowingOriginal
// pair) must report correctly to the sidebar across a full round -> peek-
// original -> peek-back cycle, not just a single toggle. The pillbox-sprint
// AC1 test above pins one click; the toggle-split parent-equivalence guard
// matrix pins one intent:toggleTable dispatch. Neither exercises the 3-step
// peek cycle this sprint's registry model actually has to get right. ---
(function registrySprint_tableToggleStateAcrossPeekCycle() {
  const savedSelected = DR_STORE.getSelectedTable();
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  try {
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
    ]);
    injectToggleEntry(table);
    DR_STORE.setSelectedTable(table);

    // makeToggleTableCell gives innerHTML/innerText/textContent as three
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

    const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
    eq('toggle-state cycle: exactly one state:tableEnabledChanged per dispatch (3 total)',
      toggleMsgs.length, 3);
    eq('toggle-state cycle: enabled sequence is true (rounded), false (peek original), true (peek back)',
      toggleMsgs.map(m => m.enabled), [true, false, true]);
    eq('toggle-state cycle: isTableRounded agrees with the last reported state',
      isTableRounded(table), true);
  } finally {
    global.chrome.runtime.sendMessage = origSend;
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// --- (h) WeakMap/Set lockstep, part 1: a table re-added after removal (the
// SAME element reference, as a virtualized-DOM library recycling a detached
// node back into the tree would do) must come back with a FRESH registry
// entry, not the previous round's leftover state. unregisterTable deletes
// the WeakMap entry outright, so a later registerTable (via _ensureEntry)
// can only build a brand-new entry — this pins that no per-cell original,
// appliedFlag, round options, or frozen magnitude survives the round trip. ---
(function registrySprint_reregisterAfterUnregisterGetsFreshEntry() {
  const table = { tagName: 'TABLE' }; // identity is all that matters here
  const cell = { tagName: 'TD' };

  DR_STORE.registerTable(table);
  DR_STORE.setTableOriginal(table, cell, { value: '8,584,629', pieces: [{ text: '8,584,629', written: '8,584,629' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');
  DR_STORE.setTableRoundOptions(table, { offsetTop: -1 });
  DR_STORE.setTableMaxMagnitude(table, 7);

  eq('re-register: table is rounded with state before removal (pre-condition)',
    DR_STORE.getTableAppliedFlag(table), 'simplified');

  // Simulate the removed-node observer's cleanup: unregisterTable is the
  // ONLY registry call it makes (content.js's removedNodes loop).
  DR_STORE.unregisterTable(table);

  eq('re-register: hasTable is false immediately after unregisterTable',
    DR_STORE.hasTable(table), false);

  // The SAME table reference comes back (e.g. a virtualized list recycling
  // the detached DOM node into view again). registerTable is idempotent /
  // "found again" — it must not resurrect the old entry.
  DR_STORE.registerTable(table);

  eq('re-register: appliedFlag resets to "original" (not the leftover "simplified")',
    DR_STORE.getTableAppliedFlag(table), 'original');
  eq('re-register: the old per-cell original does NOT leak through (hasTableOriginal is false)',
    DR_STORE.hasTableOriginal(table, cell), false);
  eq('re-register: getTableOriginal for the old cell reference is undefined, not the stale record',
    DR_STORE.getTableOriginal(table, cell), undefined);
  eq('re-register: lastRoundOptions resets to null (not the leftover options object)',
    DR_STORE.getTableRoundOptions(table), null);
  eq('re-register: maxMagnitude resets to null (not the leftover frozen value)',
    DR_STORE.getTableMaxMagnitude(table), null);
})();

// --- Sprint shape-fingerprint: the registry's fingerprint field. The entry
// carries the shape the table had when it registered, and the pillbox view's
// builder is its one writer. Spec: the shape-fingerprint block in
// docs/sprint-plans/grid-detection-recovery-v2.md §5, and the shape
// fingerprint row in docs/vocabulary.md. ---
(function shapeFingerprint_theRegistryHoldsAFingerprintPerTable() {
  const table = { tagName: 'TABLE' }; // identity is all that matters here

  eq('fingerprint registry: an unregistered table carries no fingerprint',
    DR_STORE.getTableFingerprint(table), null);

  DR_STORE.registerTable(table);
  eq('fingerprint registry: registerTable on its own records no fingerprint',
    DR_STORE.getTableFingerprint(table), null);

  const recorded = { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] };
  DR_STORE.setTableFingerprint(table, recorded);
  eq('fingerprint registry: the recorded fingerprint reads back whole',
    DR_STORE.getTableFingerprint(table), recorded);
  eq('fingerprint registry: the recorded fingerprint is plain values',
    JSON.parse(JSON.stringify(DR_STORE.getTableFingerprint(table))), recorded);

  DR_STORE.unregisterTable(table);
  eq('fingerprint registry: unregisterTable drops the fingerprint with the entry',
    DR_STORE.getTableFingerprint(table), null);

  DR_STORE.registerTable(table);
  eq('fingerprint registry: a re-registration starts with no fingerprint',
    DR_STORE.getTableFingerprint(table), null);
  DR_STORE.unregisterTable(table);
})();

// The pillbox view's builder records the shape after it registers the table,
// on a grid and on a native table alike.
(function shapeFingerprint_registrationRecordsTheTablesShape() {
  const grouped = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391'], ['South', '918,554'],
  ]);
  withToggleDocumentMock(function () { createToggleForTable(grouped.wrapperEl); });
  eq('fingerprint registry: registering a grid with a row group records its header row',
    DR_STORE.getTableFingerprint(grouped.wrapperEl),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  forgetRegisteredTable(grouped.wrapperEl);

  const grid = makeDatabaseQueryGrid();
  withToggleDocumentMock(function () { createToggleForTable(grid.scrollPaneEl); });
  eq('fingerprint registry: registering a groupless grid records its column count alone',
    DR_STORE.getTableFingerprint(grid.scrollPaneEl),
    { columnCount: 3, headerTexts: null });
  forgetRegisteredTable(grid.scrollPaneEl);

  const nativeTable = makeToggleTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  withToggleDocumentMock(function () { createToggleForTable(nativeTable); });
  eq('fingerprint registry: registering a native table records its header row',
    DR_STORE.getTableFingerprint(nativeTable),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  forgetRegisteredTable(nativeTable);
})();

// --- (h) WeakMap/Set lockstep, part 2: the removed-node MutationObserver
// callback must find and unregister a table when the removedNodes entry is
// an ANCESTOR of the table, not the table itself — the real production
// callback (content.js's `_tableObserver`), not GV7's manual re-
// implementation of its cleanup steps. Exercised by re-evaluating the
// content-script bundle with a capturing MutationObserver installed first
// (mirrors appModelSelection_parentEquivalence_contextmenuSelectionFlow's
// runContextmenuFixture technique above), so `_tableObserver`'s real
// constructor closure is the one under test. ---
(function registrySprint_ancestorRemovalUnregistersDescendantTable() {
  const capturedInstances = [];
  class CapturingTableObserverMO {
    constructor(cb) { this._cb = cb; this.disconnectCalled = false; capturedInstances.push(this); }
    observe(target, opts) { this._target = target; this._opts = opts; }
    disconnect() { this.disconnectCalled = true; }
  }

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete', // else-branch runs synchronously: injectTableToggles() + observe()
    body: { appendChild() {} },
  };
  const captureChrome = {
    runtime: { onMessage: { addListener() {} }, sendMessage() {} },
  };
  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
  };
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  global.MutationObserver = CapturingTableObserverMO;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };

  try {
    // Expose this eval's own DR_STORE/tableToggles/trackedTables bindings
    // (distinct instances from the file-level ones the rest of the suite
    // uses) onto globalThis so this function can drive and inspect them
    // after eval() returns — same trick the top-of-file eval already uses.
    eval(contentScriptBundle + `
      globalThis.__rt_DR_STORE = DR_STORE;
      globalThis.__rt_tableToggles = tableToggles;
      globalThis.__rt_trackedTables = trackedTables;
    `);

    eq('ancestor removal: exactly one MutationObserver constructed (the _tableObserver watching document.body)',
      capturedInstances.length, 1);
    const tableObserver = capturedInstances[0];
    eq('ancestor removal: _tableObserver.observe was called with document.body',
      tableObserver._target === captureDoc.body, true);

    const freshDR_STORE = global.__rt_DR_STORE;
    const freshTableToggles = global.__rt_tableToggles;
    const freshTrackedTables = global.__rt_trackedTables;

    // A table nested under a container — the removedNodes record will carry
    // the CONTAINER, never the table directly (e.g. a host page detaching a
    // wrapping <div> that happens to hold the table, not the table itself).
    const table = { tagName: 'TABLE', nodeType: 1 };
    const removedButtons = [];
    const button = { parentElement: { removeChild(b) { removedButtons.push(b); } } };
    freshTableToggles.set(table, button);
    freshTrackedTables.add(table);
    freshDR_STORE.registerTable(table);

    eq('ancestor removal (pre): table is registered before the removal fires',
      freshDR_STORE.hasTable(table), true);

    const container = {
      nodeType: 1,
      // The only DOM relationship the real removal loop consults: does this
      // removed node CONTAIN the tracked table (a real Node.contains check
      // on a real ancestor, stubbed here to report the containment we set up).
      contains(el) { return el === table; },
    };

    // Fire the REAL captured callback — table itself is absent from
    // removedNodes; only its ancestor container is.
    tableObserver._cb([{ addedNodes: [], removedNodes: [container] }]);

    eq('ancestor removal: DR_STORE.hasTable is false after the ancestor-only removal record',
      freshDR_STORE.hasTable(table), false);
    eq('ancestor removal: trackedTables no longer has the table',
      freshTrackedTables.has(table), false);
    eq('ancestor removal: the table\'s toggle button was removed from its parent',
      removedButtons.includes(button), true);

    // A DIRECT removedNodes entry (the table itself, not an ancestor) must
    // also still work — the `table === node` half of the containment check.
    const table2 = { tagName: 'TABLE', nodeType: 1 };
    freshTableToggles.set(table2, { parentElement: { removeChild() {} } });
    freshTrackedTables.add(table2);
    freshDR_STORE.registerTable(table2);
    tableObserver._cb([{ addedNodes: [], removedNodes: [table2] }]);
    eq('direct removal: DR_STORE.hasTable is false when the table itself is the removedNodes entry',
      freshDR_STORE.hasTable(table2), false);
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
  }
})();

// --- Sprint shape-fingerprint: the teardown both the removal observer and the
// mismatch path run. One function discards a table's registration and every
// per-table resource the extension holds beside it: the pillbox, the resize
// observer, a virtualized grid's re-apply observer and its pending timer, the
// view's tracked-table list, and the registry entry. `reason` reaches the
// debug row. Spec: the shape-fingerprint block in
// docs/sprint-plans/grid-detection-recovery-v2.md §5. ---

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
    const removedPillboxes = registerFingerprintedTable(grid.scrollPaneEl);
    reapplyObservers.set(grid.scrollPaneEl, { observer: { disconnect() { gridObserverDisconnects++; } }, target: grid.scrollPaneEl });
    const pendingTimer = setTimeout(function () {}, 10000);
    reapplyTimers.set(grid.scrollPaneEl, pendingTimer);

    eq('fingerprint teardown: the grid registers and tracks before the teardown (precondition)',
      DR_STORE.hasTable(grid.scrollPaneEl) && trackedTables.has(grid.scrollPaneEl), true);

    teardownTableEntry(grid.scrollPaneEl, 'replaced');

    eq('fingerprint teardown: the pillbox comes off the page', removedPillboxes.length, 1);
    eq('fingerprint teardown: the resize observer disconnects',
      resizeObservers.length === 1 && resizeObservers[0].disconnected, true);
    eq('fingerprint teardown: the pending re-apply timer is cleared',
      clearedTimers.includes(pendingTimer), true);
    eq('fingerprint teardown: the timer record goes with it',
      reapplyTimers.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the re-apply observer disconnects', gridObserverDisconnects, 1);
    eq('fingerprint teardown: the re-apply observer record goes with it',
      reapplyObservers.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the view stops tracking the table',
      trackedTables.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the registry entry is gone',
      DR_STORE.hasTable(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the fingerprint goes with the entry',
      DR_STORE.getTableFingerprint(grid.scrollPaneEl), null);
    eq('fingerprint teardown: the teardown records a row naming its reason',
      recentLogRows().some((text) => /replaced table unregistered/.test(text)), true);
  } finally {
    global.ResizeObserver = savedResizeObserver;
    global.clearTimeout = savedClearTimeout;
    forgetRegisteredTable(grid.scrollPaneEl);
  }
})();

// --- Sprint pending-retest, criterion 4: a pending container removed from the
// page leaves no observer and no timer.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md, the pending-retest
// block in §5 — "The removal branch of the table observer drops a pending
// root's observer and timer."
//
// A pending table holds no registry entry, so the registry sweep above passes
// over it; the pending sweep is the only thing that reaches it. The real
// `_tableObserver` callback runs here, captured the same way the ancestor-
// removal case above captures it: the content-script bundle is re-evaluated
// with a capturing MutationObserver installed first, so the observer under
// test is the production one and not a re-implementation of its steps. ---
(function pendingRetest_AC4_removalDropsTheObserverAndTheTimer() {
  const capturedInstances = [];
  class CapturingRemovalMO {
    constructor(cb) { this._cb = cb; this.disconnectCount = 0; capturedInstances.push(this); }
    observe(target, options) { this._target = target; this._options = options; }
    disconnect() { this.disconnectCount++; }
  }

  const timers = [];
  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {} },
  };
  const captureChrome = { runtime: { onMessage: { addListener() {} }, sendMessage() {} } };
  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
    setTimeout: global.setTimeout, clearTimeout: global.clearTimeout,
  };
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  global.MutationObserver = CapturingRemovalMO;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };
  global.setTimeout = function (callback, ms) {
    timers.push({ callback, ms, cancelled: false });
    return timers.length - 1;
  };
  global.clearTimeout = function (id) {
    if (id !== undefined && id !== null && timers[id]) timers[id].cancelled = true;
  };

  try {
    eval(contentScriptBundle + `
      globalThis.__pending_pendingRoots = pendingRoots;
      globalThis.__pending_pendingObservers = pendingObservers;
      globalThis.__pending_pendingRetestTimers = pendingRetestTimers;
      globalThis.__pending_holdPendingTable = holdPendingTable;
    `);

    eq('pending AC4: exactly one observer stands after the load (the table observer)',
      capturedInstances.length, 1);
    const tableObserver = capturedInstances[0];
    const freshPendingRoots = global.__pending_pendingRoots;
    const holdPending = global.__pending_holdPendingTable;

    // Case 1: the removed node is an ancestor of the pending root.
    const root = { nodeType: 1, tagName: 'DIV' };
    holdPending(root);
    eq('pending AC4 (pre): the root is held as a pending table',
      freshPendingRoots.has(root), true);
    eq('pending AC4 (pre): holding the root builds one more observer',
      capturedInstances.length, 2);
    const pendingObserver = capturedInstances[1];

    // One mutation on the subtree schedules the debounced re-test.
    pendingObserver._cb([], pendingObserver);
    eq('pending AC4 (pre): the mutation schedules one re-test timer',
      timers.filter((t) => !t.cancelled).length, 1);

    const ancestor = { nodeType: 1, contains: (el) => el === root };
    tableObserver._cb([{ addedNodes: [], removedNodes: [ancestor] }]);

    eq('pending AC4: removing an ancestor disconnects the pending observer',
      pendingObserver.disconnectCount, 1);
    eq('pending AC4: removing an ancestor cancels the scheduled re-test timer',
      timers.filter((t) => !t.cancelled).length, 0);
    eq('pending AC4: removing an ancestor drops the pending root',
      freshPendingRoots.has(root), false);
    eq('pending AC4: no pending root remains after the ancestor removal',
      freshPendingRoots.size, 0);

    // Case 2: the removed node is the pending root itself.
    const rootItself = { nodeType: 1, tagName: 'DIV' };
    holdPending(rootItself);
    const secondObserver = capturedInstances[2];
    secondObserver._cb([], secondObserver);
    const scheduledForSecond = timers.filter((t) => !t.cancelled).length;
    eq('pending AC4 (pre): the second root schedules one re-test timer',
      scheduledForSecond, 1);

    tableObserver._cb([{ addedNodes: [], removedNodes: [rootItself] }]);

    eq('pending AC4: removing the pending root itself disconnects its observer',
      secondObserver.disconnectCount, 1);
    eq('pending AC4: removing the pending root itself cancels its re-test timer',
      timers.filter((t) => !t.cancelled).length, 0);
    eq('pending AC4: removing the pending root itself drops the pending root',
      freshPendingRoots.has(rootItself), false);
    eq('pending AC4: the pending observer map holds nothing for either root',
      [global.__pending_pendingObservers.has(root),
        global.__pending_pendingObservers.has(rootItself)], [false, false]);
    eq('pending AC4: the pending timer map holds nothing for either root',
      [global.__pending_pendingRetestTimers.has(root),
        global.__pending_pendingRetestTimers.has(rootItself)], [false, false]);
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
    global.setTimeout = saved.setTimeout; global.clearTimeout = saved.clearTimeout;
    delete global.__pending_pendingRoots;
    delete global.__pending_pendingObservers;
    delete global.__pending_pendingRetestTimers;
    delete global.__pending_holdPendingTable;
  }
})();

// --- (i) Off-and-on round trip under grid row recycling: round -> off press
// -> the host virtualization library recycles ONE cell (same row, a
// genuinely NEW element takes that grid position — the documented "element
// replaced" pattern, distinct from this extension's own nodeValue-patch-in-
// place write model) -> on press.
//
// The off step used to be a form flip that kept every marker and stored
// original in place. The 2026-09-14 sidebar-state-removal design retired it
// (#241): off resets, which restores every cell still in the grid and drops
// its record. The recycling scenario is unchanged — a brand-new element was
// never in the registry either way — and the last assertion below moves with
// the change: the recycled-away cell's record is dropped at the off press
// rather than surviving until the element is collectible.
//
// Uses a live-scanning querySelectorAll (walks wrapper.children -> row
// .children each call) instead of makeE2EGridWrapper's snapshot list, so
// the recycled cell is genuinely undiscoverable via '.dr-ext-rounded' the
// way a real detached-and-replaced DOM node would be — makeE2EGridWrapper's
// fixed `allCells` array would otherwise still "see" the old cell and mask
// the scenario this test exists to exercise. ---
(function registrySprint_offAndOnRoundTripUnderGridRecycling() {
  const grid = makeGridWrapper([['87654321', '1234567']]);
  grid.wrapperEl.querySelectorAll = function(sel) {
    if (sel !== '.dr-ext-rounded') return [];
    const found = [];
    for (const row of grid.wrapperEl.children) {
      for (const cell of row.children) {
        if (cell.classList && cell.classList.contains('dr-ext-rounded')) found.push(cell);
      }
    }
    return found;
  };
  grid.wrapperEl.querySelector = function(sel) {
    return grid.wrapperEl.querySelectorAll(sel)[0] || null;
  };

  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  roundTable(grid.wrapperEl, opts);

  const cellA = grid.cellEls[0]; // will be recycled away
  const cellSurvivor = grid.cellEls[1]; // stays in place across the whole cycle

  eq('recycling: both cells round on the initial pass (pre-condition)',
    cellA.classList.contains('dr-ext-rounded') && cellSurvivor.classList.contains('dr-ext-rounded'), true);

  resetTable(grid.wrapperEl); // the press that turns simplification off
  eq('recycling: the off press restores cellA\'s display text',
    cellA.childNodes[0].nodeValue, '87654321');

  // Simulate the host grid recycling row 0's first cell: a brand-new element
  // (never seen by this extension) occupies that position; cellA is no
  // longer reachable from the table at all.
  const cellB = makeGridCellWithTextNode('99999999');
  grid.rowEls[0].children = [cellB, cellSurvivor];

  roundTable(grid.wrapperEl, opts); // the press that turns it back on

  // Functional correctness: the recycled cell is treated as any other live
  // cell on the re-round — it rounds fresh from ITS OWN content, not
  // corrupted and not skipped. This matches what the parent (dataset-based)
  // branch would also do on the same scenario: a genuinely new element has
  // no dataset either, so both designs re-detect it from scratch. FAITHFUL
  // MATCH, not a regression.
  eq('recycling: the recycled cell (cellB) is picked up and rounded on the on press, not skipped',
    cellB.classList.contains('dr-ext-rounded'), true);
  eq('recycling: the recycled cell\'s rounded value differs from its own live text',
    cellB.childNodes[0].nodeValue !== '99999999', true);
  eq('recycling: the surviving cell also re-rounds correctly on the on press',
    cellSurvivor.classList.contains('dr-ext-rounded'), true);

  // The registry's per-table `originals` is a WeakMap keyed by cell element
  // (app/store.js). cellA was still in the grid at the off press, so the
  // restore visited it and dropped its record there — before the recycling
  // took the element out of the grid. Nothing is keyed to a cell the grid no
  // longer holds, and a cell the restore never reaches is collectible once
  // the page stops referencing it.
  eq('recycling: the off press drops the recycled-away cell\'s registry original',
    DR_STORE.hasTableOriginal(grid.wrapperEl, cellA), false);
})();

// --- (j) Content-script re-injection: DR_STORE lives in the content script's
// JS heap, which a re-injection (extension reload/update while a tab stays
// open) throws away and rebuilds from scratch — the live PAGE DOM survives
// untouched (classes, text, everything the OLD script instance wrote stay
// exactly as they were). The bundle is eval'd TWICE here against the SAME
// fixture tables/document, each eval producing its own independent DR_STORE
// (direct eval gives let/const their own lexical environment per call — the
// same mechanism runContextmenuFixture above already relies on), to model
// exactly that: instance 1 rounds the tables; instance 2 (fresh registry,
// same already-rounded DOM) is what a real re-injected script would face.
//
// A re-injected instance still cannot recover the true original from its
// own (empty) registry — that half of the KNOWN ACCEPTED COST comment on
// restoreTable (content.js) holds. What this test pins is the consequence
// the sprint did NOT accept: an unrestorable cell must be left exactly as
// found — marker, title, and text untouched — instead of resetTable
// stripping the marker and title off a cell it could not actually restore,
// and instead of a restore followed by a re-run of roundTable over
// already-rounded text, stamping a FALSE "Original: ..." title over the
// one attribute that still held the truth. Scenario A drives resetTable
// directly (the "reset" recovery action); scenario B drives the actual
// toggle-click wiring end to end. ---
(function registrySprint_reinjectionUnrestorableResetStaysTruthful() {
  function makeReinjectionFixtureTable(dataText) {
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: dataText }],
    ]);
    // Link innerHTML/innerText/textContent to one backing value on the data
    // cell, matching a real <td>'s single-node-tree-backed semantics (same
    // fix angle (f)'s test needed, for the same reason: restoreTable writes
    // innerHTML only, and getText()/the fake tree walker below read innerText).
    const dataCell = table._cells[3];
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });
    // A real removeAttribute('title') clears the title. makeToggleTableCell's
    // default stub is a no-op, which would hide exactly the bug this test
    // exists to catch — an implementation that unconditionally strips the
    // title would otherwise leave dataCell.title looking untouched.
    dataCell.removeAttribute = function (name) {
      if (name === 'title') this.title = '';
    };
    return { table, dataCell };
  }

  const { table: table1, dataCell: dataCell1 } = makeReinjectionFixtureTable('12,345');
  const { table: table2, dataCell: dataCell2 } = makeReinjectionFixtureTable('67,890');
  const { table: table3, dataCell: dataCell3 } = makeReinjectionFixtureTable('54,321');
  // Scenario D fixtures (issue #262): table5 is rounded by instance 1 and
  // then untouched — the pill's wrong-on-arrival case. table6 starts
  // unrounded and is later rounded BY instance 2 itself — the sanity case
  // proving the lock keys on missing registry records, not on "rounded".
  const { table: table5, dataCell: dataCell5 } = makeReinjectionFixtureTable('9,876');
  const { table: table6 } = makeReinjectionFixtureTable('8,765');
  const trueOriginal1 = '12,345';
  const trueOriginal2 = '67,890';
  const trueOriginal3 = '54,321';

  // A minimal document shared by every eval'd instance below — this is the
  // "live page" that persists across the simulated re-injection.
  // createTreeWalker mirrors withCreateTreeWalker's single-fake-text-node
  // approach, reading and writing through the SAME linked innerText/
  // innerHTML property. createElement/head back ensureHighlightStyleInjected,
  // which scenario B (the real click path) exercises for real.
  const sharedDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {} },
    head: { appendChild() {} },
    createElement() { return { textContent: '' }; },
    createTreeWalker(cell) {
      let done = false;
      return {
        nextNode() {
          if (done) return null;
          done = true;
          return {
            get nodeValue() { return cell.innerText; },
            set nodeValue(v) { cell.innerText = v; cell.textContent = v; },
          };
        },
      };
    },
  };
  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
  };
  global.document = sharedDoc;
  global.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage() {} } };
  global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  global.MutationObserver = class { observe() {} disconnect() {} };
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };

  try {
    // --- Instance 1: the content script as originally injected. Rounds
    // both fixture tables directly (bypassing detection/UI wiring,
    // irrelevant to this mechanism) with DR_DEFAULTS, same as the apply
    // path's fresh round. ---
    eval(contentScriptBundle + `
      globalThis.__ri1_roundTable = roundTable;
      globalThis.__ri1_isTableRounded = isTableRounded;
    `);
    global.__ri1_roundTable(table1, DR_DEFAULTS);
    global.__ri1_roundTable(table2, DR_DEFAULTS);
    global.__ri1_roundTable(table3, DR_DEFAULTS);
    global.__ri1_roundTable(table5, DR_DEFAULTS);
    const roundedText1 = dataCell1.innerText;
    const roundedTitle1 = dataCell1.title;
    const roundedText2 = dataCell2.innerText;
    const roundedTitle2 = dataCell2.title;
    const roundedText3 = dataCell3.innerText;
    const roundedTitle3 = dataCell3.title;

    eq('re-injection (pre): instance 1 actually rounded the sidebar-scenario cell away from the true original',
      roundedText3 !== trueOriginal3, true);
    eq('re-injection (pre): the sidebar-scenario cell\'s title holds the true original',
      roundedTitle3, `Original: ${trueOriginal3}`);

    eq('re-injection (pre): instance 1 actually rounded the cell away from the true original',
      roundedText1 !== trueOriginal1, true);
    eq('re-injection (pre): instance 1 reports the table as rounded',
      global.__ri1_isTableRounded(table1), true);
    eq('re-injection (pre): the title attribute holds the true original',
      roundedTitle1, `Original: ${trueOriginal1}`);

    // --- Instance 2: simulates re-injection. The DOM is untouched (both
    // data cells still show their rounded text, still carry
    // dr-ext-rounded) but this eval's DR_STORE is BRAND NEW — instance 1's
    // registry (and its stored true originals) is unreachable garbage now,
    // exactly as a real content-script reload would leave it. ---
    eval(contentScriptBundle + `
      globalThis.__ri2_isTableRounded = isTableRounded;
      globalThis.__ri2_resetTable = resetTable;
      globalThis.__ri2_DR_STORE = DR_STORE;
      globalThis.__ri2_DR_BUS = DR_BUS;
      globalThis.__ri2_roundTable = roundTable;
      globalThis.__ri2_syncSwitchForTable = syncSwitchForTable;
      globalThis.__ri2_tableToggles = tableToggles;
    `);

    eq('re-injection: a fresh instance reports the table as NOT rounded, despite the DOM still showing rounded text — a state/display mismatch the moment re-injection happens',
      global.__ri2_isTableRounded(table1), false);

    // --- Scenario A: the user's most natural recovery action is "reset"
    // (or an equivalent toggle-to-original click). Drive the SAME
    // production primitive (resetTable) the sprint's own restoreTable
    // KNOWN ACCEPTED COST comment discusses. ---
    const unrestorableCount = global.__ri2_resetTable(table1);

    eq('re-injection reset: resetTable reports the one cell it could not restore',
      unrestorableCount, 1);
    eq('re-injection reset: the dr-ext-rounded marker SURVIVES — the screen still shows rounded text, so the marker must stay truthful instead of claiming a clean reset that did not happen',
      dataCell1.classList.contains('dr-ext-rounded'), true);
    eq('re-injection reset: the title attribute SURVIVES — it is the last remaining copy of the true original and must not be stripped when nothing was actually restored',
      dataCell1.title, roundedTitle1);
    eq('re-injection reset: the displayed text is unchanged — not falsely "restored"',
      dataCell1.innerText, roundedText1);
    eq('re-injection reset: appliedFlag stays \'simplified\' — the truthful state, since the screen still shows rounded text',
      global.__ri2_DR_STORE.getTableAppliedFlag(table1), 'simplified');

    // --- Scenario B: the toggle-click path (not covered before this fix) —
    // drives the exact wiring a real click on the toggle switch uses
    // (ui-toggle.js's click handler publishes this same intent), end to
    // end through content.js's intent:toggleTable subscriber, the settings
    // write it makes, and the apply that follows. One click on a
    // re-injected, already-rounded table must not double-round the text or
    // stamp a false title over it. ---
    global.__ri2_DR_BUS.publish('intent:toggleTable', { table: table2 });

    eq('re-injection click path: one click after re-injection does not strip the dr-ext-rounded marker',
      dataCell2.classList.contains('dr-ext-rounded'), true);
    eq('re-injection click path: one click does not rewrite the title with a false original (no double-round)',
      dataCell2.title, roundedTitle2);
    eq('re-injection click path: one click leaves the displayed text unchanged',
      dataCell2.innerText, roundedText2);

    // --- Scenario C (issue #254): the sidebar apply path — the one other
    // resetTable caller. Drives the real wiring end to end: a sidebar
    // settings change lands as DR_STORE.setSettings (the
    // request:applySettings listener), whose state:settingsChanged
    // subscriber calls applySidebarRounding on the selected table. Before
    // the fix this ran roundTable over the already-rounded text — stamping
    // a false "Original: <rounded value>" title over the surviving truth
    // and recording the rounded value as the registry original of record.
    // It must refuse instead, and tell the sidebar why nothing changed.
    //
    // The new settings must DIFFER from the ones instance 1 rounded with:
    // re-rounding under identical settings is a value-preserving no-op the
    // engine skips, which would hide the title-stamping this test exists
    // to catch. offsetTop 1 re-rounds instance 1's '55,000' to '100,000',
    // so an unguarded apply visibly rewrites the cell and its title. ---
    const sentMessages = [];
    global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };
    global.__ri2_DR_STORE.setSelectedTable(table3);
    global.__ri2_DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { offsetTop: 1 }));

    eq('re-injection sidebar apply: the dr-ext-rounded marker survives',
      dataCell3.classList.contains('dr-ext-rounded'), true);
    eq('re-injection sidebar apply: the title still holds the TRUE original — not a re-stamped "Original: <rounded value>"',
      dataCell3.title, roundedTitle3);
    eq('re-injection sidebar apply: the displayed text is unchanged (no double-round)',
      dataCell3.innerText, roundedText3);
    eq('re-injection sidebar apply: appliedFlag stays \'simplified\' — the screen still shows rounded text',
      global.__ri2_DR_STORE.getTableAppliedFlag(table3), 'simplified');
    eq('re-injection sidebar apply: the registry records NO original for the unrestorable cell — a rounded value must not become the original of record',
      global.__ri2_DR_STORE.getTableOriginal(table3, dataCell3), undefined);
    eq('re-injection sidebar apply: exactly one state:applyBlocked notice is sent',
      sentMessages.filter((m) => m.action === 'state:applyBlocked').length, 1);
    eq('re-injection sidebar apply: the state:applyBlocked notice carries the unrestorable-cell count',
      (sentMessages.find((m) => m.action === 'state:applyBlocked') || {}).count, 1);
    eq('re-injection sidebar apply: no state:applyOk — the apply was refused',
      sentMessages.some((m) => m.action === 'state:applyOk'), false);
    eq('re-injection sidebar apply: no state:rangeOk/state:rangeError — roundTable never ran',
      sentMessages.some((m) => m.action === 'state:rangeOk' || m.action === 'state:rangeError'), false);

    // --- Scenario D (issue #262): the on-page pill on a locked table. A
    // table is locked when it shows cells wearing dr-ext-rounded that the
    // registry has no record for — the post-re-injection state. The pill
    // must render selected AND locked on arrival (before any interaction):
    // aria-pressed 'true' because the screen shows simplified text,
    // aria-disabled 'true' plus a hover title because nothing here can
    // change it. A table instance 2 rounded ITSELF (registry records
    // present) must stay a normal, unlocked pill — the lock keys on
    // missing records, not on "rounded". ---
    const stub5 = makeMockButton();
    global.__ri2_tableToggles.set(table5, stub5);
    global.__ri2_syncSwitchForTable(table5);

    eq('re-injection pill: locked table renders selected on arrival (screen shows simplified text)',
      stub5.getAttribute('aria-pressed'), 'true');
    eq('re-injection pill: locked table renders aria-disabled',
      stub5.getAttribute('aria-disabled'), 'true');
    eq('re-injection pill: locked table carries the locked marker class',
      stub5.classList.contains('dr-ext-morph-locked'), true);
    eq('re-injection pill: locked table explains itself on hover',
      typeof stub5.title === 'string' && stub5.title.includes('Reload the page'), true);

    const stub6 = makeMockButton();
    global.__ri2_tableToggles.set(table6, stub6);
    global.__ri2_syncSwitchForTable(table6);
    eq('re-injection pill: an unrounded table renders unselected',
      stub6.getAttribute('aria-pressed'), 'false');
    eq('re-injection pill: an unrounded table is not locked',
      stub6.getAttribute('aria-disabled'), null);

    global.__ri2_roundTable(table6, DR_DEFAULTS);
    global.__ri2_syncSwitchForTable(table6);
    eq('re-injection pill: a table THIS instance rounded renders selected',
      stub6.getAttribute('aria-pressed'), 'true');
    eq('re-injection pill: a table THIS instance rounded is NOT locked — its registry records exist',
      stub6.getAttribute('aria-disabled'), null);
    eq('re-injection pill: a table THIS instance rounded carries no locked class',
      stub6.classList.contains('dr-ext-morph-locked'), false);

    // --- Scenario E (issue #262): toggle clicks on a locked table must not
    // oscillate the pillbox. Before the fix, alternating clicks flipped
    // appliedFlag between 'simplified' and 'original' (both restore branches
    // no-op on cells without registry records), so the pillbox toggled
    // visually while the table never changed, and state:tableEnabledChanged
    // carried enabled:false to the sidebar under a visibly simplified
    // table. ---
    const stub2 = makeMockButton();
    global.__ri2_tableToggles.set(table2, stub2);
    sentMessages.length = 0;

    global.__ri2_DR_BUS.publish('intent:toggleTable', { table: table2 });
    eq('re-injection toggle click 1: appliedFlag stays \'simplified\' — the truthful state',
      global.__ri2_DR_STORE.getTableAppliedFlag(table2), 'simplified');
    eq('re-injection toggle click 1: the pill stays selected',
      stub2.getAttribute('aria-pressed'), 'true');

    global.__ri2_DR_BUS.publish('intent:toggleTable', { table: table2 });
    eq('re-injection toggle click 2: appliedFlag still \'simplified\' — no oscillation',
      global.__ri2_DR_STORE.getTableAppliedFlag(table2), 'simplified');
    eq('re-injection toggle click 2: the pill still selected — no oscillation',
      stub2.getAttribute('aria-pressed'), 'true');
    eq('re-injection toggle clicks: the pill is locked',
      stub2.getAttribute('aria-disabled'), 'true');
    eq('re-injection toggle clicks: displayed text never changed',
      dataCell2.innerText, roundedText2);
    eq('re-injection toggle clicks: the title still holds the true original',
      dataCell2.title, roundedTitle2);

    const toggleStates = sentMessages.filter((m) => m.action === 'state:tableEnabledChanged');
    // Issue #272 changed this contract: state:tableEnabledChanged reports the RECORD's
    // enabled — the value the click wrote — not the stuck table's display
    // state. The first click is a rebind (table3 was selected) and sends no
    // toggle-state; the second click asks to turn the stuck table off, so the
    // record and the message both go false. The panel guards its own display:
    // under the #262 lock (this table's state:applyBlocked lands first) the forced
    // ON is display-only and the record's value goes to the lock's stash —
    // pinned by the issue272 sidebar-harness tests below.
    eq('re-injection toggle clicks: state:tableEnabledChanged reports the record — off, as the click asked',
      toggleStates.map((m) => m.enabled), [false]);
    eq('re-injection toggle clicks: the record holds the user\'s off, even though the stuck table cannot change',
      global.__ri2_DR_STORE.getSettings().enabled, false);
    const actionSeq = sentMessages.map((m) => m.action);
    eq('re-injection toggle clicks: the blocked click\'s state:applyBlocked precedes its toggle-state — the panel locks before the record value lands in its stash',
      actionSeq.lastIndexOf('state:applyBlocked') !== -1 &&
      actionSeq.indexOf('state:tableEnabledChanged') !== -1 &&
      actionSeq.lastIndexOf('state:applyBlocked') < actionSeq.indexOf('state:tableEnabledChanged'), true);
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
  }
})();

