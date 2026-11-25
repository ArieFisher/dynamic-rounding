// Table registration: the load-time scan, the added-element pass, pending tables, and the removal sweep (content.js).

// ---------------------------------------------------------------------------
// content.js registerIfNew — the right-click call-site
// wrapper. It registers the table and builds the table pillbox, but only for
// a first-time (isNew) discovery.
// ---------------------------------------------------------------------------
(function registerIfNew_newGridRegistersWithTablePillbox() {
  withFindTargetEnv([], function() {
    const savedTablePillboxStyleInjected = tablePillboxStyleInjected;
    const table = makeAriaGrid([makeArtifactEmbeddedTable(), makeArtifactEmbeddedTable()]);

    const handleReturned = registerIfNew({ handle: table, isNew: true });

    eq('a new grid found on right-click: the found handle comes back',
      handleReturned, table);
    eq('a new grid found on right-click: the grid registers',
      DR_MODEL.hasTable(table), true);
    eq('a new grid found on right-click: the grid gets a table pillbox',
      tablePillboxes.has(table), true);

    cleanupPass1Tables([table]);
    tablePillboxStyleInjected = savedTablePillboxStyleInjected;
  });
})();

(function registerIfNew_alreadySeenHandleSkipsRegistration() {
  withFindTargetEnv([], function() {
    const table = makePass1DataTable();

    registerIfNew({ handle: table, isNew: false });

    eq('a handle found as already registered: it does not register again',
      DR_MODEL.hasTable(table), false);
    eq('a handle found as already registered: it gets no table pillbox',
      tablePillboxes.has(table), false);
  });
})();

// registerDataTable registers a table only after the data test passes.
(function registerDataTable_registersOnlyATableThatPassesTheDataTest() {
  withFindTargetEnv([], function() {
    const savedTablePillboxStyleInjected = tablePillboxStyleInjected;
    const emptyGrid = makeAriaGrid([]);
    emptyGrid.children = [];
    const nativeTable = makePass1DataTable();
    nativeTable.parentElement = { tagName: 'DIV', getAttribute: () => null, style: {}, parentElement: null, parentNode: null };

    registerDataTable(emptyGrid);
    registerDataTable(nativeTable);

    eq('registerDataTable: a grid that fails the data test does not register',
      DR_MODEL.hasTable(emptyGrid), false);
    eq('registerDataTable: a grid that fails the data test gets no table pillbox',
      tablePillboxes.has(emptyGrid), false);
    eq('registerDataTable: a native table gets a table pillbox',
      tablePillboxes.has(nativeTable), true);
    eq('registerDataTable: a native table registers',
      DR_MODEL.hasTable(nativeTable), true);

    cleanupPass1Tables([emptyGrid, nativeTable]);
    tablePillboxStyleInjected = savedTablePillboxStyleInjected;
  });
})();

// ---------------------------------------------------------------------------
// Sanity: isAccessibilityArtifact round-trip on the embedded-table fixtures
// ---------------------------------------------------------------------------
(function loadTimeScan_sanity_artifactEmbedded() {
  const artifact = makeArtifactEmbeddedTable();
  eq('load-time scan sanity: isAccessibilityArtifact(embedded accessibility artifact) === true',
    isAccessibilityArtifact(artifact), true);
})();

(function loadTimeScan_sanity_realEmbedded() {
  const real = makeRealEmbeddedTable();
  eq('load-time scan sanity: isAccessibilityArtifact(real embedded table) === false',
    isAccessibilityArtifact(real), false);
})();

// ---------------------------------------------------------------------------
// ARIA grid with ONLY accessibility artifacts → the load-time scan registers it with a table pillbox
// ---------------------------------------------------------------------------
(function loadTimeScan_gridWithOnlyArtifactTables_getsTablePillbox() {
  const artifact1 = makeArtifactEmbeddedTable();
  const artifact2 = makeArtifactEmbeddedTable();
  const grid = makeAriaGrid([artifact1, artifact2]);

  withTablePillboxDocumentMock(function() {
    // The scan finds no native table and finds our grid.
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTablePillboxes();
  });

  eq('load-time scan: grid with only accessibility artifacts registers',
    DR_MODEL.hasTable(grid), true);
  eq('load-time scan: grid with only accessibility artifacts gets a table pillbox registered',
    tablePillboxes.has(grid), true);
})();

// ---------------------------------------------------------------------------
// ARIA grid wrapping a REAL table → no registration and no table pillbox
// ---------------------------------------------------------------------------
(function loadTimeScan_gridWrappingARealTable_getsNoTablePillbox() {
  const realTbl = makeRealEmbeddedTable();
  const grid    = makeAriaGrid([realTbl]);

  withTablePillboxDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTablePillboxes();
  });

  eq('load-time scan: grid wrapping a real table does NOT register',
    DR_MODEL.hasTable(grid), false);
  eq('load-time scan: grid wrapping a real table does NOT get a table pillbox',
    tablePillboxes.has(grid), false);
})();

// ---------------------------------------------------------------------------
// grid with an artifact + one real table → still skipped
// ---------------------------------------------------------------------------
(function loadTimeScan_gridWithArtifactAndRealTable_getsNoTablePillbox() {
  const artifact = makeArtifactEmbeddedTable();
  const real    = makeRealEmbeddedTable();
  const grid    = makeAriaGrid([artifact, real]);

  withTablePillboxDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTablePillboxes();
  });

  eq('load-time scan: grid with accessibility artifact and real table does NOT register',
    DR_MODEL.hasTable(grid), false);
  eq('load-time scan: grid with accessibility artifact and real table does NOT get a table pillbox',
    tablePillboxes.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial: grid with NO embedded tables → registers with a table pillbox
// (with no embedded tables, every embedded table is an artifact: the empty case)
// ---------------------------------------------------------------------------
(function loadTimeScan_gridWithNoEmbeddedTables_getsTablePillbox() {
  const grid = makeAriaGrid([]);

  withTablePillboxDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTablePillboxes();
  });

  eq('load-time scan: grid with no embedded tables registers',
    DR_MODEL.hasTable(grid), true);
  eq('load-time scan: grid with no embedded tables gets a table pillbox',
    tablePillboxes.has(grid), true);
})();

// ---------------------------------------------------------------------------
// Adversarial: an already registered grid is skipped (preserved guard)
// ---------------------------------------------------------------------------
(function loadTimeScan_alreadyRegisteredGrid_getsNoSecondTablePillbox() {
  const grid = makeAriaGrid([]);
  DR_MODEL.registerTable(grid); // the "already found" signal the scan checks

  withTablePillboxDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTablePillboxes();
  });

  // Already registered → skipped → tablePillboxes should NOT have a new entry
  eq('load-time scan: already registered grid gets no table pillbox again',
    tablePillboxes.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial: element with tagName=TABLE is skipped by the qualifying guard
// (a qualifying element is never a native table)
// ---------------------------------------------------------------------------
(function loadTimeScan_roleBearingTableElement_getsNoTablePillbox() {
  const artifact = makeArtifactEmbeddedTable();
  // Make an ARIA-grid-matching element that is itself a <TABLE>
  const classes = new Set();
  const gridTable = {
    tagName: 'TABLE',    // triggers the early-return guard
    classList: {
      contains(c) { return classes.has(c); },
      add(c)      { classes.add(c); },
      remove(c)   { classes.delete(c); },
    },
    querySelectorAll(sel) {
      return sel === 'table' ? [artifact] : [];
    },
    getBoundingClientRect() { return { top: 0, right: 0, bottom: 0, left: 0 }; },
  };

  withTablePillboxDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [gridTable];
      return [];
    };

    injectTablePillboxes();
  });

  eq('load-time scan: a TABLE element carrying the grid role does not register',
    DR_MODEL.hasTable(gridTable), false);
  eq('load-time scan: a TABLE element carrying the grid role gets no table pillbox',
    tablePillboxes.has(gridTable), false);
})();

// ---------------------------------------------------------------------------
// MutationObserver added-node path
// applies the SAME accessibility artifact filter as the load-time scan.
//
// Kaggle is a React single-page application that renders its Data Explorer
// grid AFTER load, so detection runs through the
// MutationObserver added-node handler, which passes each added element to
// injectTablePillboxes. These tests call it directly with element-node stubs.
// ---------------------------------------------------------------------------

// an added [role="table"] grid whose ONLY embedded
// <table>s are chart accessibility artifacts → registers and gets a table pillbox.
(function observer_addedGridOnlyArtifactTables_getsTablePillbox() {
  const artifact1 = makeArtifactEmbeddedTable();
  const artifact2 = makeArtifactEmbeddedTable();
  const grid = asAddedGridNode(makeAriaGrid([artifact1, artifact2]));

  withTablePillboxDocumentMock(function() {
    injectTablePillboxes(grid);
  });

  eq('observer: added grid with only accessibility artifacts registers',
    DR_MODEL.hasTable(grid), true);
  eq('observer: added grid with only accessibility artifacts gets a table pillbox',
    tablePillboxes.has(grid), true);
})();

// an added grid wrapping a REAL table → observer bows out (no registration or table pillbox
// on the grid itself; the scan runs the real embedded table as a nest of one).
(function observer_addedGridRealTable_bowsOut() {
  const realTbl = makePass1DataTable(); // not an artifact, has .rows for isDataTable
  const grid = asAddedGridNode(makeAriaGrid([realTbl]));

  withTablePillboxDocumentMock(function() {
    injectTablePillboxes(grid);
  });

  eq('observer: added grid wrapping a real table does NOT register',
    DR_MODEL.hasTable(grid), false);
  eq('observer: added grid wrapping a real table does NOT get a table pillbox',
    tablePillboxes.has(grid), false);

  cleanupPass1Tables([realTbl]);
})();

// an accessibility artifact <table> reached via querySelectorAll on the
// added node gets NO table pillbox (the artifact skip on the added-node pass).
(function observer_addedSubtreeArtifactTable_noTablePillbox() {
  const artifact = makeArtifactEmbeddedTable();
  const container = {
    nodeType: global.Node.ELEMENT_NODE,
    tagName: 'DIV',
    classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
    matches() { return false; },
    querySelectorAll(sel) { return sel === 'table' ? [artifact] : []; },
  };

  withTablePillboxDocumentMock(function() {
    injectTablePillboxes(container);
  });

  eq('observer: accessibility artifact <table> in added subtree gets NO table pillbox',
    tablePillboxes.has(artifact), false);
})();

// a real native <table> reached via querySelectorAll on the added node
// DOES get a table pillbox (a native table the added-node pass keeps).
(function observer_addedSubtreeRealTable_getsTablePillbox() {
  const realTbl = makePass1DataTable();
  const container = {
    nodeType: global.Node.ELEMENT_NODE,
    tagName: 'DIV',
    classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
    matches() { return false; },
    querySelectorAll(sel) { return sel === 'table' ? [realTbl] : []; },
  };

  withTablePillboxDocumentMock(function() {
    injectTablePillboxes(container);
  });

  eq('observer: real <table> in added subtree gets a table pillbox',
    tablePillboxes.has(realTbl), true);

  cleanupPass1Tables([realTbl]);
})();


// ---------------------------------------------------------------------------
// A grid that arrives before its rows registers when
// the rows arrive.
// ---------------------------------------------------------------------------
//
// The rule these assertions pin:
//   - A chain root whose containment chain is empty — no qualifying element of
//     its nest passes the data test — becomes a pending table: one debounced
//     subtree observer on the chain root, watching childList, characterData,
//     and subtree.
//   - A change to the subtree runs the nomination step from the root again. A
//     registration clears the pending record and disconnects the observer.
//   - A re-test that still finds the chain empty counts against
//     DR_DETECTION_SETTINGS.pendingRetestCap; reaching the cap drops the observer, the
//     timer, and the count, and records a debug log row.
//   - The pending unit is the chain root, so a nest of several qualifying
//     elements carries one observer.
//
// Every expected value below comes from that statement, never from the
// controller's source.

// The row pairs a database query grid draws once its rows arrive: a row-number
// gutter row in the pinned pane, and an identifier with a count and a rate in
// the scrolling pane. Invented values, one order of magnitude apart.
const PENDING_FILL_ROWS = [
  ['alpha', '7,318,204', '284.51'],
  ['bravo', '551,077', '31.77'],
  ['charlie', '2,140,663', '58.02'],
];

// --- a container inserted empty and then filled registers ---

(function pendingRetest_aLoneContainerFilledLaterRegistersAndGainsATablePillbox() {
  const lone = makeDgNode('DIV', 'lone-pending-grid', 'grid', []);
  const before = DR_MODEL.getRegisteredTables().length;

  eq('pending: the suite holds no pending table before this case',
    pendingRoots.size, 0);

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(lone);
    });

    eq('pending: an empty container registers nothing',
      DR_MODEL.hasTable(lone), false);
    eq('pending: an empty container gains no table pillbox', tablePillboxes.has(lone), false);
    eq('pending: an empty container is held as a pending table',
      pendingRoots.has(lone), true);
    eq('pending: the empty container carries one observer', observers.length, 1);

    // The rows arrive, each holding a number.
    PENDING_FILL_ROWS.forEach((cellTexts, i) => appendDgChild(lone, makeDgRow(i, cellTexts)));
    eq('pending: the filled container passes the data test', isDataTable(lone), true);

    withTablePillboxDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending: one mutation schedules one re-test', runPendingRetestTimers(timers), 1);
    });

    eq('pending: the filled container registers', DR_MODEL.hasTable(lone), true);
    eq('pending: the filled container gains a table pillbox', tablePillboxes.has(lone), true);
    eq('pending: the registration drops the pending record',
      pendingRoots.has(lone), false);
    eq('pending: the registration disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending: the registration adds exactly one registry entry',
      DR_MODEL.getRegisteredTables().length - before, 1);
  });

  forgetRegisteredTable(lone);
})();

(function pendingRetest_anEmptyDatabaseQueryGridFilledLaterRegistersItsScrollingPane() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const before = DR_MODEL.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(grid.wrapperEl);
    });

    eq('pending: an empty database query grid registers nothing',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_MODEL.hasTable(el)),
      [false, false, false]);
    eq('pending: an empty database query grid holds the wrapper as a pending table',
      pendingRoots.has(grid.wrapperEl), true);
    eq('pending: the empty wrapper carries one observer', observers.length, 1);

    fillDatabaseQueryGrid(grid);

    withTablePillboxDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending: one fill schedules one re-test', runPendingRetestTimers(timers), 1);
    });

    eq('pending: the filled grid registers the scrolling pane alone',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_MODEL.hasTable(el)),
      [false, false, true]);
    eq('pending: the scrolling pane gains a table pillbox',
      tablePillboxes.has(grid.scrollPaneEl), true);
    eq('pending: the wrapper gains no table pillbox', tablePillboxes.has(grid.wrapperEl), false);
    eq('pending: the pinned pane gains no table pillbox',
      tablePillboxes.has(grid.pinnedPaneEl), false);
    eq('pending: the registration drops the wrapper\'s pending record',
      pendingRoots.has(grid.wrapperEl), false);
    eq('pending: the registration disconnects the wrapper\'s observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending: the fill adds exactly one registry entry',
      DR_MODEL.getRegisteredTables().length - before, 1);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- one observer per pending wrapper ---

(function pendingRetest_aPendingWrapperCarriesOneObserverForThreeElements() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const extraPaneEl = appendDgChild(grid.wrapperEl,
    makeDgNode('DIV', 'dg--grid-container dg--extra-pane', 'grid', []));

  eq('pending: three role-bearing elements sit under the empty wrapper',
    [grid.pinnedPaneEl, grid.scrollPaneEl, extraPaneEl]
      .map((el) => el.parentElement === grid.wrapperEl), [true, true, true]);
  eq('pending: no element of the empty nest passes the data test',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl, extraPaneEl].map(isDataTable),
    [false, false, false, false]);

  withPendingHarness(function ({ observers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(grid.wrapperEl);
    });

    eq('pending: a nest of four qualifying elements carries one observer',
      observers.length, 1);
    eq('pending: the one observer watches the chain root',
      observers[0] && observers[0].observeCalls.length === 1 &&
        observers[0].observeCalls[0].target === grid.wrapperEl, true);
    eq('pending: the observer watches added nodes, changed text, and the whole subtree',
      observers[0] && observers[0].observeCalls[0].options,
      { childList: true, characterData: true, subtree: true });

    // A second pass over the same empty wrapper holds the record it already
    // has rather than starting a second one.
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(grid.wrapperEl);
    });
    eq('pending: a second pass over the same empty wrapper adds no second observer',
      observers.length, 1);
    eq('pending: a second pass leaves one pending root', pendingRoots.size, 1);

    dropPendingTable(grid.wrapperEl);
  });

  eq('pending: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// --- the re-test cap bounds a container that never passes ---
//
// The container holds rows of text and no number, so every re-test finds the
// chain empty. The debounce is driven once per re-test, the way a subtree that
// churns without loading data drives it.

(function pendingRetest_aContainerThatNeverPassesStopsAtTheCap() {
  const neverEl = makeDgNode('DIV', 'never-a-data-grid', 'grid', [
    makeDgRow(0, ['alpha', 'north', 'open']),
    makeDgRow(1, ['bravo', 'south', 'open']),
    makeDgRow(2, ['charlie', 'east', 'open']),
  ]);
  eq('pending: a container of text rows never passes the data test',
    isDataTable(neverEl), false);
  eq('pending: the detection settings ship a re-test cap of 100',
    DR_DETECTION_SETTINGS.pendingRetestCap, 100);

  // The log buffer holds the last 50 rows and counts the rows that dropped off
  // the front, so the two together give a running total this case can subtract
  // to find the rows it recorded itself.
  const recordedRows = () => {
    const buffer = DR_LOG.copyBuffer();
    return buffer.dropped + buffer.rows.length;
  };
  const logRowsBefore = recordedRows();

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(neverEl);
    });

    eq('pending: the container is held as a pending table',
      pendingRoots.has(neverEl), true);
    eq('pending: the held container starts at zero failed re-tests',
      pendingRetestCounts.get(neverEl), 0);

    const observer = observers[0];
    // One short of the cap: the observer stays connected.
    for (let i = 0; i < DR_DETECTION_SETTINGS.pendingRetestCap - 1; i++) {
      if (observer) observer.trigger();
      runPendingRetestTimers(timers);
    }
    eq('pending: one short of the cap the count reads the failed re-tests',
      pendingRetestCounts.get(neverEl), DR_DETECTION_SETTINGS.pendingRetestCap - 1);
    eq('pending: one short of the cap the observer stays connected',
      observer && observer.disconnectCount, 0);
    eq('pending: one short of the cap the container is still pending',
      pendingRoots.has(neverEl), true);

    // The re-test that reaches the cap.
    if (observer) observer.trigger();
    runPendingRetestTimers(timers);

    eq('pending: reaching the cap disconnects the observer',
      observer && observer.disconnectCount, 1);
    eq('pending: reaching the cap drops the pending root',
      pendingRoots.has(neverEl), false);
    eq('pending: reaching the cap drops the failed-re-test count',
      pendingRetestCounts.has(neverEl), false);
    eq('pending: reaching the cap drops the debounce timer',
      pendingRetestTimers.has(neverEl), false);
    eq('pending: reaching the cap leaves the observer map empty for the root',
      pendingObservers.has(neverEl), false);
    eq('pending: the dropped container registers nothing',
      DR_MODEL.hasTable(neverEl), false);

    const added = recordedRows() - logRowsBefore;
    const rows = DR_LOG.copyBuffer().rows;
    const newRows = rows.slice(Math.max(0, rows.length - added));
    eq('pending: the cap cycle records at least one log row', added >= 1, true);
    eq('pending: reaching the cap records one debug row for the drop',
      newRows.filter((row) => row.level === 'debug' && /pending table/.test(row.text)).map((row) => row.text),
      ['Dynamic Rounding: pending table drop · reason: re-test cap']);

    // A later mutation on the dropped container costs nothing: no observer
    // remains to run, and the record is gone.
    eq('pending: the dropped container holds no pending record',
      pendingRoots.size, 0);
  });
})();

// --- A pending table has no longest wait ---
//
// The burst runs 1500 milliseconds, past the re-apply observer's longest wait.

(function pendingRetest_aSustainedBurstNeverRunsTheRetest() {
  const neverEl = makeDgNode('DIV', 'sustained-burst-grid', 'grid', [
    makeDgRow(0, ['alpha', 'north', 'open']),
    makeDgRow(1, ['bravo', 'south', 'open']),
    makeDgRow(2, ['charlie', 'east', 'open']),
  ]);
  const stepMs = 50;
  const changes = 30;
  const savedNow = Date.now;

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(neverEl);
    });
    const observer = observers[0];
    const timersBefore = timers.length;
    let clock = savedNow.call(Date);
    Date.now = () => clock;
    try {
      for (let i = 0; i < changes; i++) {
        observer.trigger();
        clock += stepMs;
      }
    } finally {
      Date.now = savedNow;
    }
    const waits = timers.slice(timersBefore);
    eq('pending burst: one timer per change, each a full settle delay',
      waits.map((timer) => timer.ms), new Array(changes).fill(DR_DETECTION_SETTINGS.settleDelayMs));
    eq('pending burst: only the last change keeps a live timer',
      waits.filter((timer) => !timer.cancelled).length, 1);
    eq('pending burst: no re-test ran during the burst', pendingRetestCounts.get(neverEl), 0);
    eq('pending burst: the burst is longer than the re-apply longest wait',
      changes * stepMs > DR_DETECTION_SETTINGS.reapplyMaxWaitMs, true);
    eq('pending burst: once the page goes quiet, one re-test runs', runPendingRetestTimers(timers), 1);
    eq('pending burst: that re-test counts as one failed re-test', pendingRetestCounts.get(neverEl), 1);
    dropPendingTable(neverEl);
  });
})();

// --- Adversarial: a re-test that finds the nest registered ends the record ---
//
// The vocabulary row states the rule: a re-test that finds the nest already
// registered ends the pending table, as does one that finds its configured
// depth crowded. The registration here goes through the table pillbox builder
// directly, which is the route a right-click takes today — the pending record
// stands until the next re-test, and that re-test is what drops it. Without
// this the record outlives the registration: a live observer on a subtree the
// extension already registered, re-testing until it reaches the cap.

(function pendingRetest_aRegisteredRetestEndsThePendingRecord() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const before = DR_MODEL.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(grid.wrapperEl);
    });

    eq('pending registered: the empty wrapper is held as a pending table',
      pendingRoots.has(grid.wrapperEl), true);
    eq('pending registered: the empty wrapper carries one observer', observers.length, 1);

    // The rows arrive, and another route registers the scrolling pane before
    // the re-test runs.
    fillDatabaseQueryGrid(grid);
    withTablePillboxDocumentMock(function () {
      registerDataTable(grid.scrollPaneEl);
    });
    eq('pending registered: the other route registered the scrolling pane',
      DR_MODEL.hasTable(grid.scrollPaneEl), true);
    eq('pending registered: the pending record still stands before the re-test',
      pendingRoots.has(grid.wrapperEl), true);

    withTablePillboxDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending registered: one mutation schedules one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending registered: a re-test over a registered nest drops the pending root',
      pendingRoots.has(grid.wrapperEl), false);
    eq('pending registered: a re-test over a registered nest disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending registered: the observer map holds nothing for the wrapper',
      pendingObservers.has(grid.wrapperEl), false);
    eq('pending registered: the failed-re-test count map holds nothing for the wrapper',
      pendingRetestCounts.has(grid.wrapperEl), false);
    eq('pending registered: the debounce timer map holds nothing for the wrapper',
      pendingRetestTimers.has(grid.wrapperEl), false);
    eq('pending registered: the nest holds one registry entry in all',
      DR_MODEL.getRegisteredTables().length - before, 1);
    eq('pending registered: the re-test puts no second table pillbox on the nest',
      [tablePillboxes.has(grid.wrapperEl), tablePillboxes.has(grid.pinnedPaneEl)], [false, false]);
    eq('pending registered: no pending root remains', pendingRoots.size, 0);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- A table of either kind whose cells fill in after it appears registers ---
//
// The table arrives with its number column empty, so it fails the data test,
// and the page fills those cells in place afterwards, the way a folder listing
// fills its date column after the table appears. Invented values.

const LATE_FILL_HEADER = ['Region', 'Units'];
const LATE_FILL_EMPTY_ROWS = [['North', ''], ['South', '']];

(function pendingRetest_aTableFilledLaterRegistersOnBothKinds() {
  const results = {};
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(LATE_FILL_EMPTY_ROWS, { header: LATE_FILL_HEADER });
    const read = () => ({
      registered: DR_MODEL.hasTable(t.table),
      pillbox: tablePillboxes.has(t.table),
      pending: pendingRoots.has(t.table),
    });
    withTablePillboxDocumentMock(() => {
      injectTablePillboxes(t.table);
      const beforeFill = read();
      t.write(0, 1, '4,281,905');
      t.write(1, 1, '622,148');
      page.settle();
      results[kind] = { beforeFill, afterFill: read() };
      dropPendingTable(t.table);
    });
  });

  for (const kind of RW_KINDS) {
    eq(`late fill (${kind}): no table pillbox before the fill, a table pillbox after it`,
      results[kind], {
        beforeFill: { registered: false, pillbox: false, pending: true },
        afterFill: { registered: true, pillbox: true, pending: false },
      });
  }
  eq('late fill: a native table and a grid drawn from the same rows give the same result',
    results.native, results.grid);
})();

// --- A table of either kind that never fills stops being watched at the cap ---

(function pendingRetest_aTableThatNeverFillsStopsAtTheCapOnBothKinds() {
  const results = {};
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(LATE_FILL_EMPTY_ROWS, { header: LATE_FILL_HEADER });
    withTablePillboxDocumentMock(() => {
      injectTablePillboxes(t.table);
      const heldAtStart = pendingRoots.has(t.table);
      // Each change rewrites a label, so every re-test still finds no number.
      for (let i = 0; i < DR_DETECTION_SETTINGS.pendingRetestCap - 1; i++) {
        t.write(0, 0, `North ${String.fromCharCode(97 + (i % 26))}`);
        page.settle();
      }
      const heldOneShortOfTheCap = pendingRoots.has(t.table);
      t.write(0, 0, 'North');
      page.settle();
      results[kind] = {
        heldAtStart, heldOneShortOfTheCap,
        heldAtTheCap: pendingRoots.has(t.table),
        registered: DR_MODEL.hasTable(t.table),
      };
      dropPendingTable(t.table);
    });
  });

  for (const kind of RW_KINDS) {
    eq(`re-test cap (${kind}): the table is watched until the cap and dropped at it`,
      results[kind], { heldAtStart: true, heldOneShortOfTheCap: true, heldAtTheCap: false, registered: false });
  }
})();

// --- The page cap bounds how many tables are pending at once ---
//
// The cap counts both table kinds together. A table that fails the data test
// past the cap is not held, the first such table writes one row, and a pending
// table that registers frees its place.

(function pendingTableCap_aTablePastTheCapIsNotWatchedUntilAPlaceFrees() {
  const savedCap = DR_DETECTION_SETTINGS.pendingTableCap;
  const recordedRows = () => {
    const buffer = DR_LOG.copyBuffer();
    return buffer.dropped + buffer.rows.length;
  };
  const capRowsSince = (before) => {
    const added = recordedRows() - before;
    const rows = DR_LOG.copyBuffer().rows;
    return rows.slice(Math.max(0, rows.length - added))
      .filter((row) => /pending table cap/.test(row.text)).map((row) => row.text);
  };
  const built = [];
  eq('page cap: the detection settings ship a pending table cap of 50',
    savedCap, 50);

  withRewritePage((page) => {
    withTablePillboxDocumentMock(() => {
      try {
        eq('page cap: the case starts with no pending table', pendingRoots.size, 0);
        DR_DETECTION_SETTINGS.pendingTableCap = 2;
        pendingTableCapLogged = false;
        const build = (kind) => {
          const t = rwBuildTable(kind, LATE_FILL_EMPTY_ROWS, { header: LATE_FILL_HEADER });
          built.push(t);
          return t;
        };
        const first = build('native');
        const second = build('grid');
        const third = build('native');
        const fourth = build('grid');
        const rowsBefore = recordedRows();

        [first, second, third].forEach((t) => injectTablePillboxes(t.table));
        eq('page cap: the tables up to the cap are watched, of both kinds',
          [first, second].map((t) => pendingRoots.has(t.table)), [true, true]);
        eq('page cap: a table past the cap is not watched', pendingRoots.has(third.table), false);
        eq('page cap: the first table past the cap writes one row',
          capRowsSince(rowsBefore), ['Dynamic Rounding: pending table cap · tables: 2']);

        injectTablePillboxes(fourth.table);
        eq('page cap: a second table past the cap is not watched', pendingRoots.has(fourth.table), false);
        eq('page cap: a second table past the cap writes no second row',
          capRowsSince(rowsBefore).length, 1);

        first.write(0, 1, '4,281,905');
        page.settle();
        eq('page cap: the pending table that fills registers', DR_MODEL.hasTable(first.table), true);
        eq('page cap: its registration frees a place', pendingRoots.has(first.table), false);

        injectTablePillboxes(third.table);
        eq('page cap: a table past the cap is watched once a place frees', pendingRoots.has(third.table), true);
      } finally {
        DR_DETECTION_SETTINGS.pendingTableCap = savedCap;
        for (const t of built) {
          dropPendingTable(t.table);
          resetTable(t.table);
          forgetRegisteredTable(t.table);
        }
      }
    });
  });
  eq('page cap: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// --- Adversarial: a re-test that finds the depth crowded ends the record ---
//
// A crowded nest registers nothing, by product decision, and
// it registers nothing on every later re-test for the same reason. Holding the
// record would leave an observer re-testing a shape whose answer cannot change
// until the page rebuilds it.

(function pendingRetest_aCrowdedRetestEndsThePendingRecord() {
  const rootEl = makeDgNode('DIV', 'crowded-pending-root', 'table', []);
  const nest = makeCrowdedNest();
  const before = DR_MODEL.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(rootEl);
    });

    eq('pending crowded: the empty root is held as a pending table',
      pendingRoots.has(rootEl), true);
    eq('pending crowded: the empty root carries one observer', observers.length, 1);

    // The page draws a row group of text rows and two panes that each pass the
    // data test, which puts two elements at the configured depth.
    nest.rootEl.children.slice().forEach((child) => appendDgChild(rootEl, child));
    eq('pending crowded: the filled root still fails the data test',
      isDataTable(rootEl), false);
    eq('pending crowded: both panes pass the data test',
      [nest.paneAEl, nest.paneBEl].map(isDataTable), [true, true]);
    eq('pending crowded: the filled nest reports the crowded outcome',
      nominateNest(rootEl).outcome, 'crowded');

    withTablePillboxDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending crowded: one mutation schedules one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending crowded: a crowded re-test drops the pending root',
      pendingRoots.has(rootEl), false);
    eq('pending crowded: a crowded re-test disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending crowded: the observer map holds nothing for the root',
      pendingObservers.has(rootEl), false);
    eq('pending crowded: the failed-re-test count map holds nothing for the root',
      pendingRetestCounts.has(rootEl), false);
    eq('pending crowded: the debounce timer map holds nothing for the root',
      pendingRetestTimers.has(rootEl), false);
    eq('pending crowded: a crowded nest registers no element',
      [rootEl, nest.paneAEl, nest.paneBEl].map((el) => DR_MODEL.hasTable(el)),
      [false, false, false]);
    eq('pending crowded: a crowded nest gains no table pillbox',
      [rootEl, nest.paneAEl, nest.paneBEl].map((el) => tablePillboxes.has(el)),
      [false, false, false]);
    eq('pending crowded: a crowded nest adds no registry entry',
      DR_MODEL.getRegisteredTables().length - before, 0);
    eq('pending crowded: no pending root remains', pendingRoots.size, 0);
  });
})();

// --- Adversarial: the debounce collapses a burst of mutations into one re-test ---

(function pendingRetest_twoMutationsInsideTheDelayScheduleOneRetest() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });

  withPendingHarness(function ({ observers, timers }) {
    withTablePillboxDocumentMock(function () {
      injectTablePillboxes(grid.wrapperEl);
    });

    const observer = observers[0];
    if (observer) observer.trigger();
    if (observer) observer.trigger();

    const scheduled = timers.filter((t) => t.ms === DR_DETECTION_SETTINGS.settleDelayMs);
    eq('pending debounce: two mutations schedule two timers and cancel the first',
      scheduled.map((t) => t.cancelled), [true, false]);
    eq('pending debounce: the delay is the settle delay',
      scheduled.every((t) => t.ms === DR_DETECTION_SETTINGS.settleDelayMs), true);

    fillDatabaseQueryGrid(grid);
    withTablePillboxDocumentMock(function () {
      eq('pending debounce: two mutations inside the delay run one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending debounce: the one re-test registers the scrolling pane',
      DR_MODEL.hasTable(grid.scrollPaneEl), true);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
  eq('pending debounce: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// --- A pending table and the accessibility artifact filter ---
//
// A chain root that is an artifact starts no observer, and a pending table
// whose chain root turns into an artifact drops its observer on the next
// re-test. The fixture grid reads its attributes and style from a table the
// case edits, the way a page edits them.

function makeHideableGrid(role, childNodes) {
  const attrs = { role };
  const node = makeDgNode('DIV', 'pending-artifact', role, childNodes || []);
  node.getAttribute = (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null);
  node.setAttribute = (name, value) => { attrs[name] = value; };
  return node;
}

function makePlainBox(child) {
  const box = makeDgNode('DIV', 'plain-box', null, [child]);
  const attrs = {};
  box.getAttribute = (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null);
  box.setAttribute = (name, value) => { attrs[name] = value; };
  return box;
}

(function pendingArtifact_anArtifactChainRootStartsNoObserver() {
  const forms = [
    { name: 'aria-hidden on the grid', build: () => { const g = makeHideableGrid('grid'); g.setAttribute('aria-hidden', 'true'); return [g, g]; } },
    { name: 'aria-hidden on the parent', build: () => {
      const g = makeHideableGrid('grid'); const box = makePlainBox(g); box.setAttribute('aria-hidden', 'true'); return [g, box]; } },
    { name: 'the positioned grid drawn off-screen', build: () => {
      const g = makeHideableGrid('grid'); g.style = { position: 'absolute', left: AF_OFFSCREEN_LEFT }; return [g, g]; } },
  ];
  for (const form of forms) {
    const [grid, added] = form.build();
    const outcome = nominateNest(grid, { isRegistered: DR_MODEL.hasTable, styleProbe: inlineStyleProbe });
    eq(`pending artifact, ${form.name}: the nomination outcome is artifact`,
      [outcome.outcome, outcome.selected === null], ['artifact', true]);

    withPendingHarness(function ({ observers, timers }) {
      consumeNomination(outcome);
      eq(`pending artifact, ${form.name}: consuming the outcome holds no pending table`, pendingRoots.has(grid), false);
      eq(`pending artifact, ${form.name}: consuming the outcome starts no observer`, observers.length, 0);

      const savedStyle = global.getComputedStyle;
      global.getComputedStyle = inlineStyleProbe.getComputedStyle;
      try {
        withTablePillboxDocumentMock(function () { injectTablePillboxes(added); });
        eq(`pending artifact, ${form.name}: the added-node pass holds no pending table`, pendingRoots.has(grid), false);
        eq(`pending artifact, ${form.name}: the added-node pass starts no observer`, observers.length, 0);

        const page = makePlainBox(added);
        const savedQsa = global.document.querySelectorAll;
        withTablePillboxDocumentMock(function () {
          global.document.querySelectorAll = (selector) => page.querySelectorAll(selector);
          injectTablePillboxes();
        });
        global.document.querySelectorAll = savedQsa;
        eq(`pending artifact, ${form.name}: the load-time scan holds no pending table`, pendingRoots.has(grid), false);
        eq(`pending artifact, ${form.name}: the load-time scan starts no observer`, observers.length, 0);
      } finally {
        global.getComputedStyle = savedStyle;
      }
      eq(`pending artifact, ${form.name}: no timer is scheduled`, timers.length, 0);
    });
    eq(`pending artifact, ${form.name}: the grid stays unregistered`, DR_MODEL.hasTable(grid), false);
  }
})();

(function pendingArtifact_aChainRootThatBecomesAnArtifactDropsItsObserver() {
  const turns = [
    { name: 'aria-hidden set on the grid', turn: (grid) => grid.setAttribute('aria-hidden', 'true') },
    { name: 'aria-hidden set on the parent', turn: (grid, box) => box.setAttribute('aria-hidden', 'true') },
    { name: 'the grid moved off-screen', turn: (grid) => { grid.style = { position: 'absolute', left: AF_OFFSCREEN_LEFT }; } },
    { name: 'the parent moved off-screen', turn: (grid, box) => { box.style = { position: 'fixed', left: AF_OFFSCREEN_LEFT }; } },
  ];
  for (const filled of [false, true]) {
    for (const { name, turn } of turns) {
      const label = `${name}, ${filled ? 'rows arrived' : 'still empty'}`;
      const grid = makeHideableGrid('grid');
      const box = makePlainBox(grid);
      const before = DR_MODEL.getRegisteredTables().length;

      withPendingHarness(function ({ observers, timers }) {
        withTablePillboxDocumentMock(function () { injectTablePillboxes(grid); });
        eq(`pending artifact turn, ${label}: the empty grid is held as a pending table`, pendingRoots.has(grid), true);
        eq(`pending artifact turn, ${label}: one observer watches it`, observers.length, 1);

        if (filled) PENDING_FILL_ROWS.forEach((cellTexts, i) => appendDgChild(grid, makeDgRow(i, cellTexts)));
        turn(grid, box);

        const savedStyle = global.getComputedStyle;
        global.getComputedStyle = inlineStyleProbe.getComputedStyle;
        try {
          withTablePillboxDocumentMock(function () {
            observers[0].trigger();
            eq(`pending artifact turn, ${label}: one mutation schedules one re-test`, runPendingRetestTimers(timers), 1);
          });
        } finally {
          global.getComputedStyle = savedStyle;
        }

        eq(`pending artifact turn, ${label}: the re-test drops the pending table`, pendingRoots.has(grid), false);
        eq(`pending artifact turn, ${label}: the re-test disconnects the observer`, observers[0].disconnectCount, 1);
        eq(`pending artifact turn, ${label}: the maps hold nothing for the grid`,
          [pendingObservers.has(grid), pendingRetestCounts.has(grid), pendingRetestTimers.has(grid)], [false, false, false]);
        eq(`pending artifact turn, ${label}: the grid registers nothing and gains no table pillbox`,
          [DR_MODEL.hasTable(grid), tablePillboxes.has(grid), DR_MODEL.getRegisteredTables().length - before], [false, false, 0]);
      });
    }
  }
})();

// --- (h) Registry, part 2: the removed-node MutationObserver
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
    readyState: 'complete', // else-branch runs synchronously: injectTablePillboxes() + observe()
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
    // Expose this eval's own DR_MODEL/tablePillboxes bindings
    // (distinct instances from the file-level ones the rest of the suite
    // uses) onto globalThis so this function can drive and inspect them
    // after eval() returns — same trick the setup's exposure script uses.
    eval(contentScriptBundle + `
      globalThis.__rt_DR_MODEL = DR_MODEL;
      globalThis.__rt_tablePillboxes = tablePillboxButtons(tablePillboxViews);
    `);

    eq('ancestor removal: exactly one MutationObserver constructed (the _tableObserver watching document.body)',
      capturedInstances.length, 1);
    const tableObserver = capturedInstances[0];
    eq('ancestor removal: _tableObserver.observe was called with document.body',
      tableObserver._target === captureDoc.body, true);

    const freshDR_MODEL = global.__rt_DR_MODEL;
    const freshTablePillboxes = global.__rt_tablePillboxes;

    // A table nested under a container — the removedNodes record will carry
    // the CONTAINER, never the table directly (e.g. a host page detaching a
    // wrapping <div> that happens to hold the table, not the table itself).
    const table = { tagName: 'TABLE', nodeType: 1 };
    const removedButtons = [];
    const button = { parentElement: { removeChild(b) { removedButtons.push(b); } } };
    freshTablePillboxes.set(table, button);
    freshDR_MODEL.registerTable(table);

    eq('ancestor removal (pre): table is registered before the removal fires',
      freshDR_MODEL.hasTable(table), true);

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

    eq('ancestor removal: DR_MODEL.hasTable is false after the ancestor-only removal record',
      freshDR_MODEL.hasTable(table), false);
    eq('ancestor removal: the table\'s table pillbox was removed from its parent',
      removedButtons.includes(button), true);

    // A DIRECT removedNodes entry (the table itself, not an ancestor) must
    // also still work — the `table === node` half of the containment check.
    const table2 = { tagName: 'TABLE', nodeType: 1 };
    freshTablePillboxes.set(table2, { parentElement: { removeChild() {} } });
    freshDR_MODEL.registerTable(table2);
    tableObserver._cb([{ addedNodes: [], removedNodes: [table2] }]);
    eq('direct removal: DR_MODEL.hasTable is false when the table itself is the removedNodes entry',
      freshDR_MODEL.hasTable(table2), false);
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
  }
})();

// The page removing the active table clears the active table and
// tells the sidebar to re-read, so the sidebar shows the no-table state
// instead of describing a table that is gone. Removing any other table leaves
// the active table where it is. Same fixture as the removal test above: the
// real table observer, from a fresh evaluation of the content script.
(function issue506_removingTheActiveTableClearsIt() {
  const capturedInstances = [];
  class CapturingTableObserverMO {
    constructor(cb) { this._cb = cb; capturedInstances.push(this); }
    observe() {}
    disconnect() {}
  }
  const sent = [];
  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {} },
  };
  const captureChrome = {
    runtime: { onMessage: { addListener() {} }, sendMessage(msg) { sent.push(msg); } },
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
    eval(contentScriptBundle + `
      globalThis.__rt506_DR_MODEL = DR_MODEL;
    `);
    const tableObserver = capturedInstances[0];
    const model = global.__rt506_DR_MODEL;

    const active = { tagName: 'TABLE', nodeType: 1 };
    const other = { tagName: 'TABLE', nodeType: 1 };
    model.registerTable(active);
    model.registerTable(other);
    model.setActiveTable(active);

    sent.length = 0;
    tableObserver._cb([{ addedNodes: [], removedNodes: [other] }]);
    eq('removed table: removing another table leaves the active table in place',
      model.getActiveTable(), active);
    eq('removed table: removing another table sends the sidebar nothing',
      sent.some((m) => m.topic === 'state:previewSamplesChanged'), false);

    tableObserver._cb([{ addedNodes: [], removedNodes: [active] }]);
    eq('removed table: removing the active table clears the active table',
      model.getActiveTable(), null);
    eq('removed table: removing the active table tells the sidebar to re-read',
      sent.some((m) => m.topic === 'state:previewSamplesChanged'), true);
  } finally {
    delete global.__rt506_DR_MODEL;
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
  }
})();

// --- a pending container removed from the
// page leaves no observer and no timer: the removal branch of the table
// observer drops a pending root's observer and timer.
//
// A pending table holds no registry entry, so the registry sweep above passes
// over it; the pending sweep is the only thing that reaches it. The real
// `_tableObserver` callback runs here, captured the same way the ancestor-
// removal case above captures it: the content-script bundle is re-evaluated
// with a capturing MutationObserver installed first, so the observer under
// test is the production one and not a re-implementation of its steps. ---
(function pendingRetest_removalDropsTheObserverAndTheTimer() {
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

    eq('pending: exactly one observer stands after the load (the table observer)',
      capturedInstances.length, 1);
    const tableObserver = capturedInstances[0];
    const freshPendingRoots = global.__pending_pendingRoots;
    const holdPending = global.__pending_holdPendingTable;

    // Case 1: the removed node is an ancestor of the pending root.
    const root = { nodeType: 1, tagName: 'DIV' };
    holdPending(root);
    eq('pending (pre): the root is held as a pending table',
      freshPendingRoots.has(root), true);
    eq('pending (pre): holding the root builds one more observer',
      capturedInstances.length, 2);
    const pendingObserver = capturedInstances[1];

    // One mutation on the subtree schedules the debounced re-test.
    pendingObserver._cb([], pendingObserver);
    eq('pending (pre): the mutation schedules one re-test timer',
      timers.filter((t) => !t.cancelled).length, 1);

    const ancestor = { nodeType: 1, contains: (el) => el === root };
    tableObserver._cb([{ addedNodes: [], removedNodes: [ancestor] }]);

    eq('pending: removing an ancestor disconnects the pending observer',
      pendingObserver.disconnectCount, 1);
    eq('pending: removing an ancestor cancels the scheduled re-test timer',
      timers.filter((t) => !t.cancelled).length, 0);
    eq('pending: removing an ancestor drops the pending root',
      freshPendingRoots.has(root), false);
    eq('pending: no pending root remains after the ancestor removal',
      freshPendingRoots.size, 0);

    // Case 2: the removed node is the pending root itself.
    const rootItself = { nodeType: 1, tagName: 'DIV' };
    holdPending(rootItself);
    const secondObserver = capturedInstances[2];
    secondObserver._cb([], secondObserver);
    const scheduledForSecond = timers.filter((t) => !t.cancelled).length;
    eq('pending (pre): the second root schedules one re-test timer',
      scheduledForSecond, 1);

    tableObserver._cb([{ addedNodes: [], removedNodes: [rootItself] }]);

    eq('pending: removing the pending root itself disconnects its observer',
      secondObserver.disconnectCount, 1);
    eq('pending: removing the pending root itself cancels its re-test timer',
      timers.filter((t) => !t.cancelled).length, 0);
    eq('pending: removing the pending root itself drops the pending root',
      freshPendingRoots.has(rootItself), false);
    eq('pending: the pending observer map holds nothing for either root',
      [global.__pending_pendingObservers.has(root),
        global.__pending_pendingObservers.has(rootItself)], [false, false]);
    eq('pending: the pending timer map holds nothing for either root',
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
