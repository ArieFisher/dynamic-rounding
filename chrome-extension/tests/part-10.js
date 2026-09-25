// ---------------------------------------------------------------------------
// Sprint detection-constants: every detection setting and both lookup
// lists now have one home, the detection settings (DR_DETECTION_SETTINGS, in
// the configuration file constants.js), with no behavior change. The
// pillbox auto-collapse delay, once beside them, lives in the pillbox view
// (ui-toggle.js) as its own constant: the view alone reads it. Four groups
// of tests:
//   1. Source scan: none of the eight retired names carries a second
//      const/let/var definition anywhere the manifest loads, and the two
//      retired literal forms (the repetition-share division, the bare
//      column-width-agreement literal) and the retired Set are gone from
//      the detection layer (lib/dr-table/detect.js).
//   2. Source scan: the detection layer and the controller (content.js)
//      read DR_DETECTION_SETTINGS as a bare global — no typeof guard, no
//      OR-fallback, no reassignment — and the pillbox view reads none of it.
//   3. Behavior: a sandbox that evaluates the configuration file and then
//      the detection layer carries the nine pre-move values unchanged, and
//      looksLikeGrid, findTargetTable, isPhantomA11yTable, and isDataTable
//      behave exactly as the pre-move source did, on fixtures whose outcome
//      the pre-move values determine.
//   4. Behavior: a sandbox that evaluates the detection layer alone, with
//      no configuration file, fails at load with a ReferenceError naming
//      DR_DETECTION_SETTINGS — before any function in the file runs.
// ---------------------------------------------------------------------------

(function detectionSettings_retiredNamesHaveNoSecondDefinition() {
  const RETIRED_NAMES = [
    'GRID_MIN_CHILDREN',
    'GRID_WALK_DEPTH_CAP',
    'GRID_COL_WIDTH_SAMPLE',
    'GRID_DISPLAY_VALUES',
    'GRID_REAPPLY_DEBOUNCE_MS',
    'OFFSCREEN_LEFT_PX_THRESHOLD',
    'DEFAULT_VENDOR_PROFILES',
    'TOUCH_AUTOCOLLAPSE_MS',
  ];
  // Every file the manifest loads, plus this suite itself — a retired name
  // could resurface as a second definition in either.
  const scannedSources = manifest.content_scripts[0].js
    .map((file) => sourceByName(file) || '')
    .concat([SUITE_SOURCE])
    .join('\n');

  for (const name of RETIRED_NAMES) {
    const definitionPattern = new RegExp(`\\b(const|let|var)\\s+${name}\\b`);
    eq(`detection settings: ${name} carries no const/let/var definition anywhere the manifest loads`,
      definitionPattern.test(scannedSources), false);
  }
})();

(function detectionSettings_retiredLiteralFormsAreGoneFromDetection() {
  const src = detectCode || '';
  eq('detection settings: the detection layer no longer computes the repetition floor as children.length / 2',
    /children\.length\s*\/\s*2/.test(src), false);
  eq('detection settings: the detection layer no longer compares column-width agreement to a bare 0.8 literal',
    />=\s*0\.8\b/.test(src), false);
  eq('detection settings: the detection layer no longer builds a Set of the four display values',
    /new Set\(\s*\[\s*['"]grid['"]/.test(src), false);
  eq('detection settings: the detection layer reads the display-value list through DR_DETECTION_SETTINGS.gridDisplayValues.includes(display)',
    /DR_DETECTION_SETTINGS\.gridDisplayValues\.includes\(display\)/.test(src), true);
})();

(function detectionSettings_noFallbackCopy() {
  const filesToScan = {
    'lib/dr-table/detect.js': detectCode,
    'content.js': sourceByName('content.js'),
  };
  for (const [file, src] of Object.entries(filesToScan)) {
    if (src === null || src === undefined) {
      eq(`detection settings: source file ${file} present in manifest`, false, true);
      continue;
    }
    eq(`detection settings: ${file} carries no typeof DR_DETECTION_SETTINGS guard`,
      /typeof\s+DR_DETECTION_SETTINGS\b/.test(src), false);
    eq(`detection settings: ${file} carries no DR_DETECTION_SETTINGS || fallback`,
      /DR_DETECTION_SETTINGS\s*\|\|/.test(src), false);
    eq(`detection settings: ${file} carries no window.DR_DETECTION_SETTINGS read`,
      /window\.DR_DETECTION_SETTINGS\b/.test(src), false);
    eq(`detection settings: ${file} carries no globalThis.DR_DETECTION_SETTINGS read`,
      /globalThis\.DR_DETECTION_SETTINGS\b/.test(src), false);
    eq(`detection settings: ${file} carries no DR_DETECTION_SETTINGS reassignment`,
      /\bDR_DETECTION_SETTINGS\s*=[^=]/.test(src), false);
  }
})();

// The pillbox view holds no detection setting: its touch auto-collapse
// delay is its own constant, so the view reads the detection settings
// nowhere and the settings carry no delay the view alone reads.
(function detectionSettings_pillboxViewHoldsItsOwnDelay() {
  const src = uiToggleCode || '';
  eq('detection settings: ui-toggle.js defines PILLBOX_AUTO_COLLAPSE_MS as its own constant',
    /^const PILLBOX_AUTO_COLLAPSE_MS = 3000;/m.test(src), true);
  eq('detection settings: ui-toggle.js reads DR_DETECTION_SETTINGS nowhere',
    /DR_DETECTION_SETTINGS/.test(src), false);
  eq('detection settings: the auto-collapse timer takes the view\'s own constant',
    /},\s*PILLBOX_AUTO_COLLAPSE_MS\);/.test(src), true);
  eq('detection settings: the settings carry no pillboxAutoCollapseMs key',
    Object.prototype.hasOwnProperty.call(DR_DETECTION_SETTINGS, 'pillboxAutoCollapseMs'), false);
})();

// The detection settings' expected contents. Nine values are the pre-move
// ones, hand-copied from origin/main's lib/dr-table/detect.js (read via
// `git show origin/main:chrome-extension/lib/dr-table/detect.js`) and the
// design doc's key table; the detection-constants sprint moved them and
// changed none of them. A tenth moved value, the pillbox auto-collapse
// delay, went back to the pillbox view as its own constant: the view alone
// reads it, and it shapes nothing detection finds. Three keys have no
// pre-move value: nestingDepth, the
// nomination step's configured depth from the grid-nesting-rule sprint;
// dataTestCellBudget, the data test's cell budget from the data-test-budget
// sprint; and pendingRetestCap, a pending table's re-test cap from the
// pending-retest sprint. Key order matches constants.js's DR_DETECTION_SETTINGS
// declaration, so the JSON.stringify-based eq() comparison below is not
// order-sensitive noise.
const PRE_MOVE_DETECTION_SETTINGS = {
  nestingDepth: 1,
  gridMinChildren: 5,
  gridWalkDepthCap: 15,
  gridColumnWidthSample: 10,
  gridColumnWidthAgreement: 0.8,
  gridRepetitionShare: 0.5,
  gridDisplayValues: ['grid', 'flex', 'inline-grid', 'inline-flex'],
  dataTestCellBudget: 1000,
  vendorProfiles: [
    {
      name: 'databricks',
      classToken: 'dg--',
      scrollContainerSelectors: ['.dg--grid-scroll-container', '.dg--grid-container'],
      pinnedPaneSelectors: ['.dg--pinned-grid'],
    },
    {
      name: 'ag-grid',
      classToken: 'ag-',
      scrollContainerSelectors: ['.ag-center-cols-viewport'],
      pinnedPaneSelectors: ['.ag-pinned-left-cols-container'],
    },
  ],
  gridRedrawDelayMs: 100,
  reapplyMaxWaitMs: 1000,
  reapplyCellCap: 10000,
  pendingRetestCap: 100,
  offscreenLeftPx: -9999,
};

// jsdom-less criterion, extended: one vm sandbox with no
// chrome/window/getComputedStyle evaluates the configuration file
// (constants.js), the number core (lib/dr-number/core.js, for the currency
// signs the numeric probe strips) and then the detection layer
// (lib/dr-table/detect.js). The
// test pins DR_DETECTION_SETTINGS's values against PRE_MOVE_DETECTION_SETTINGS above and runs
// looksLikeGrid, findTargetTable, isPhantomA11yTable, and isDataTable against
// fixtures whose expected outcome holds only when each moved value reads at
// its pre-move value: a wrong read (a stale copy, a transposed value, a wrong
// sample size) flips at least one outcome below.
(function detectionSettings_sandboxBehaviorMatchesPreMoveValues() {
  if (constantsCode === null || detectCode === null) {
    eq('detection settings: source files constants.js and lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const sandbox = { outcomes: {}, threw: null };
  const ctx = vm.createContext(sandbox);

  vm.runInContext(
    constantsCode + '\n' + coreCode + '\n' + detectCode + `
    try {
      outcomes.settingsKeys = Object.keys(DR_DETECTION_SETTINGS).sort();
      outcomes.settings = DR_DETECTION_SETTINGS;

      function makeCell(text, width) { return { textContent: text, offsetWidth: width }; }
      function makeRow(cls, cells) { return { className: cls, children: cells }; }
      function makeEl(rows) { return { className: '', children: rows, getAttribute: () => null }; }
      const gridStyleProbe = {
        getComputedStyle: () => ({ display: 'grid' }),
        getOffsetWidth: (el) => (el && typeof el.offsetWidth === 'number') ? el.offsetWidth : -1,
      };
      const uniformRows = () => [0, 1, 2, 3, 4].map(() => makeRow('row', [makeCell('1', 100)]));

      // --- gridMinChildren (step 1): 4 children fails, 5 passes ---
      const fourRows = [0, 1, 2, 3].map(() => makeRow('row', [makeCell('5', 100)]));
      const fiveRows = [0, 1, 2, 3, 4].map(() => makeRow('row', [makeCell('5', 100)]));
      outcomes.minChildrenBelowFails = looksLikeGrid(makeEl(fourRows), { styleProbe: gridStyleProbe });
      outcomes.minChildrenAtPasses = looksLikeGrid(makeEl(fiveRows), { styleProbe: gridStyleProbe });

      // --- gridRepetitionShare (steps 2/3): a share below the 0.5 floor
      // fails (3-of-8 sharing either a class or a child count); a share
      // exactly at the floor passes (5-of-10) ---
      const belowFloorRows = [
        makeRow('x', [makeCell('1', 100)]),
        makeRow('x', [makeCell('1', 100)]),
        makeRow('x', [makeCell('1', 100)]),
        makeRow('y1', [makeCell('1', 100), makeCell('2', 100)]),
        makeRow('y2', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100)]),
        makeRow('y3', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100), makeCell('4', 100)]),
        makeRow('y4', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100), makeCell('4', 100), makeCell('5', 100)]),
        makeRow('y5', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100), makeCell('4', 100), makeCell('5', 100), makeCell('6', 100)]),
      ];
      outcomes.repetitionBelowFloorFails = looksLikeGrid(makeEl(belowFloorRows), { styleProbe: gridStyleProbe });

      const atFloorRows = [0, 1, 2, 3, 4].map(() => makeRow('row-a', [makeCell('10', 50), makeCell('20', 50)]))
        .concat([0, 1, 2, 3, 4].map(() => makeRow('row-b', [makeCell('1', 50), makeCell('2', 50), makeCell('3', 50)])));
      outcomes.repetitionAtFloorPasses = looksLikeGrid(makeEl(atFloorRows), { styleProbe: gridStyleProbe });

      // --- gridColumnWidthSample + gridColumnWidthAgreement (step 6): the
      // sample is bounded to the first 10 of 12 uniform rows; 8-of-10
      // matching widths (exactly 0.8) passes, 7-of-10 (0.7) fails ---
      const widthRow = (w) => makeRow('row', [makeCell('1', w)]);
      const widths8of10 = [100, 100, 100, 100, 100, 100, 100, 100, 999, 999, 999, 999].map(widthRow);
      const widths7of10 = [100, 100, 100, 100, 100, 100, 100, 999, 999, 999, 100, 100].map(widthRow);
      outcomes.widthAgreementAtThresholdPasses = looksLikeGrid(makeEl(widths8of10), { styleProbe: gridStyleProbe });
      outcomes.widthAgreementBelowThresholdFails = looksLikeGrid(makeEl(widths7of10), { styleProbe: gridStyleProbe });

      // --- gridDisplayValues: each of the four values passes, a fifth fails ---
      const probeForDisplay = (display) => ({ getComputedStyle: () => ({ display }), getOffsetWidth: gridStyleProbe.getOffsetWidth });
      outcomes.displayGridPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('grid') });
      outcomes.displayFlexPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('flex') });
      outcomes.displayInlineGridPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('inline-grid') });
      outcomes.displayInlineFlexPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('inline-flex') });
      outcomes.displayBlockFails = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('block') });

      // --- vendorProfiles (default, no opts override): a 'dg--' class
      // short-circuits ACCEPT even when the width-agreement step would
      // otherwise fail; the same rows with no vendor class do not ---
      const badWidthRows = [100, 200, 300, 400, 500].map(widthRow);
      outcomes.vendorClassShortCircuitsAccept = looksLikeGrid(
        Object.assign(makeEl(badWidthRows), { className: 'dg--outer' }), { styleProbe: gridStyleProbe });
      outcomes.noVendorClassFailsWidthCheck = looksLikeGrid(
        Object.assign(makeEl(badWidthRows), { className: '' }), { styleProbe: gridStyleProbe });

      // --- gridWalkDepthCap (findTargetTable step 3): a 20-deep ancestor
      // chain, every ancestor individually a qualifying grid, is bounded to
      // the 15th ancestor (label 14, zero-indexed) ---
      function makeAncestor(label) {
        return {
          label,
          className: '',
          getAttribute: () => null,
          nodeType: DR_TABLE_ELEMENT_NODE,
          children: uniformRows(),
          parentElement: null,
        };
      }
      const chain = [];
      for (let i = 0; i < 20; i++) chain.push(makeAncestor(i));
      for (let i = 0; i < chain.length - 1; i++) chain[i].parentElement = chain[i + 1];
      const walkResult = findTargetTable({ parentElement: chain[0] }, { styleProbe: gridStyleProbe });
      outcomes.walkDepthCapLabel = walkResult && walkResult.handle.label;

      // --- offscreenLeftPx (isPhantomA11yTable signal 2): at the threshold
      // and beyond it counts as off-screen; just inside it does not ---
      const offscreenTable = (left) => ({ getAttribute: () => null, style: { position: 'static', left: left + 'px' } });
      outcomes.offscreenAtThresholdIsPhantom = isPhantomA11yTable(offscreenTable(-9999));
      outcomes.offscreenBeyondThresholdIsPhantom = isPhantomA11yTable(offscreenTable(-10000));
      outcomes.offscreenInsideThresholdIsNotPhantom = isPhantomA11yTable(offscreenTable(-9998));

      // --- isDataTable: no collateral breakage from the load-order change ---
      outcomes.isDataTableStillFindsANumericTable = isDataTable({
        tagName: 'TABLE',
        rows: [
          { cells: [{ textContent: 'Name' }, { textContent: '100' }] },
          { cells: [{ textContent: 'Foo' },  { textContent: '200' }] },
        ],
      });
    } catch (e) {
      threw = e.message;
    }
    `,
    ctx
  );

  eq('detection settings: the combined sandbox does not throw', sandbox.threw, null);
  eq('detection settings: DR_DETECTION_SETTINGS exposes exactly fourteen keys, the nine pre-move keys plus nestingDepth, dataTestCellBudget, pendingRetestCap, reapplyMaxWaitMs, and reapplyCellCap',
    sandbox.outcomes.settingsKeys, Object.keys(PRE_MOVE_DETECTION_SETTINGS).sort());
  eq('detection settings: DR_DETECTION_SETTINGS carries every pre-move value unchanged, plus nestingDepth at 1, dataTestCellBudget at 1000, pendingRetestCap at 100, reapplyMaxWaitMs at 1000, and reapplyCellCap at 10000',
    sandbox.outcomes.settings, PRE_MOVE_DETECTION_SETTINGS);
  eq('detection settings: looksLikeGrid rejects 4 children (below gridMinChildren)',
    sandbox.outcomes.minChildrenBelowFails, false);
  eq('detection settings: looksLikeGrid accepts 5 children (at gridMinChildren)',
    sandbox.outcomes.minChildrenAtPasses, true);
  eq('detection settings: looksLikeGrid rejects a 3-of-8 share (below gridRepetitionShare)',
    sandbox.outcomes.repetitionBelowFloorFails, false);
  eq('detection settings: looksLikeGrid accepts a 5-of-10 share (at gridRepetitionShare)',
    sandbox.outcomes.repetitionAtFloorPasses, true);
  eq('detection settings: looksLikeGrid accepts an 8-of-10 sampled-width agreement (at gridColumnWidthAgreement, within gridColumnWidthSample)',
    sandbox.outcomes.widthAgreementAtThresholdPasses, true);
  eq('detection settings: looksLikeGrid rejects a 7-of-10 sampled-width agreement (below gridColumnWidthAgreement)',
    sandbox.outcomes.widthAgreementBelowThresholdFails, false);
  eq('detection settings: looksLikeGrid accepts display:grid (in gridDisplayValues)',
    sandbox.outcomes.displayGridPasses, true);
  eq('detection settings: looksLikeGrid accepts display:flex (in gridDisplayValues)',
    sandbox.outcomes.displayFlexPasses, true);
  eq('detection settings: looksLikeGrid accepts display:inline-grid (in gridDisplayValues)',
    sandbox.outcomes.displayInlineGridPasses, true);
  eq('detection settings: looksLikeGrid accepts display:inline-flex (in gridDisplayValues)',
    sandbox.outcomes.displayInlineFlexPasses, true);
  eq('detection settings: looksLikeGrid rejects display:block (not in gridDisplayValues)',
    sandbox.outcomes.displayBlockFails, false);
  eq('detection settings: looksLikeGrid short-circuits ACCEPT for the default databricks vendorProfiles class token',
    sandbox.outcomes.vendorClassShortCircuitsAccept, true);
  eq('detection settings: looksLikeGrid still runs the width-agreement step with no vendor class',
    sandbox.outcomes.noVendorClassFailsWidthCheck, false);
  eq('detection settings: findTargetTable bounds the ancestor walk to gridWalkDepthCap (15)',
    sandbox.outcomes.walkDepthCapLabel, 14);
  eq('detection settings: isPhantomA11yTable treats offscreenLeftPx itself as off-screen',
    sandbox.outcomes.offscreenAtThresholdIsPhantom, true);
  eq('detection settings: isPhantomA11yTable treats a value beyond offscreenLeftPx as off-screen',
    sandbox.outcomes.offscreenBeyondThresholdIsPhantom, true);
  eq('detection settings: isPhantomA11yTable treats a value inside offscreenLeftPx as on-screen',
    sandbox.outcomes.offscreenInsideThresholdIsNotPhantom, false);
  eq('detection settings: isDataTable still finds a plain 2x2 numeric table (no collateral breakage)',
    sandbox.outcomes.isDataTableStillFindsANumericTable, true);
})();

// A fresh sandbox with no configuration file: the detection layer reads
// DR_DETECTION_SETTINGS as a bare global with no fallback, so evaluating it alone throws
// a ReferenceError naming DR_DETECTION_SETTINGS — at load, before any function in the
// file runs. The try/catch sits outside vm.runInContext, so a caught error
// here can only have come from evaluating the source itself, never from a
// function call the script goes on to make.
(function detectionSettings_detectionFailsClosedWithNoConfigurationFile() {
  if (detectCode === null) {
    eq('detection settings: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const ctx = vm.createContext({});
  let caught = null;
  try {
    vm.runInContext(detectCode, ctx);
  } catch (e) {
    caught = { name: e.name, message: e.message };
  }
  eq('detection settings: evaluating the detection layer with no configuration file throws at load',
    caught !== null, true);
  eq('detection settings: the load-time failure is a ReferenceError',
    caught && caught.name, 'ReferenceError');
  eq('detection settings: the load-time failure message carries DR_DETECTION_SETTINGS',
    !!(caught && /DR_DETECTION_SETTINGS/.test(caught.message)), true);
})();

// Living docs: docs/design.md's package table and docs/vocabulary.md both
// carry the detection settings, per AGENTS.md's rule that a behavior-invalidating
// change updates every living doc it invalidates in the same branch.
(function detectionSettings_livingDocsCarryTheTerm() {
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  eq('living docs: docs/design.md carries the detection settings',
    designMd.includes('detection settings'), true);
  eq('living docs: docs/vocabulary.md defines the detection settings',
    vocabularyMd.includes('detection settings'), true);
})();

// VendorProfiles: a custom list replaces the default, and GridAdapter honors
// it for scroll-container resolution — proving the port is genuinely
// pluggable, not just a constant renamed in place.
(function gridAdapter_customVendorProfilesHonored() {
  const scrollEl = { tagName: 'DIV', className: 'my-lib-scroll' };
  const wrapperEl = {
    tagName: 'DIV',
    className: 'my-lib-wrapper',
    matches() { return false; },
    querySelector(sel) {
      return sel === '.my-lib-scroll-container' ? scrollEl : null;
    },
  };
  const customProfiles = [
    { name: 'my-lib', classToken: 'my-lib-', scrollContainerSelectors: ['.my-lib-scroll-container'], pinnedPaneSelectors: [] },
  ];

  const adapter = new GridAdapter(wrapperEl, { vendorProfiles: customProfiles });
  eq('GridAdapter: a custom vendorProfiles scroll-container selector is honored',
    adapter._getScrollContainer(), scrollEl);

  // Sanity: the DEFAULT profiles do not know this vendor's selector, so the
  // custom list above is what made the resolution succeed, not a coincidence.
  const adapterDefault = new GridAdapter(wrapperEl, {});
  eq('GridAdapter: default vendorProfiles do not resolve an unrelated vendor selector (sanity)',
    adapterDefault._getScrollContainer(), wrapperEl);
})();

// findTables' tableFilter: default (isPhantomA11yTable) drops a phantom a11y
// table; a pass-through filter keeps it. reuses makePass1DataTable / the
// aria-hidden phantom shape from the pass1-filter suite above.
(function findTables_tableFilterDefaultVsPassThrough() {
  const phantomTable = makePass1DataTable();
  const hiddenParent = {
    tagName: 'DIV',
    getAttribute: (name) => (name === 'aria-hidden' ? 'true' : null),
    style: {},
    parentElement: null,
    parentNode: null,
  };
  phantomTable.parentElement = hiddenParent;
  phantomTable.parentNode = null;

  const root = {
    tagName: 'BODY',
    querySelectorAll(sel) {
      return sel === 'table' ? [phantomTable] : [];
    },
  };

  eq('findTables: sanity — the fixture is both a valid data table and a phantom a11y table',
    isDataTable(phantomTable) && isPhantomA11yTable(phantomTable), true);
  eq('findTables: default tableFilter (isPhantomA11yTable) drops a phantom a11y table',
    findTables(root).length, 0);
  eq('findTables: a pass-through tableFilter keeps the phantom a11y table',
    findTables(root, { tableFilter: () => false }).length, 1);
})();

// =============================================================================
// Sprint grid-nesting-rule: one registration per grid, at the configured depth
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.3 and the
// grid-nesting-rule block in §5; decision D2 in
// docs/sprint-plans/grid-detection-recovery.md.
// =============================================================================
//
// The rule these assertions pin, in the specification's words:
//   - A qualifying element carries a grid or table role, is not a native
//     table, and holds no native table the accessibility-artifact guard keeps.
//   - A chain root is a qualifying element with no qualifying ancestor. A
//     containment chain is the chain root and the qualifying elements nested
//     under it that pass the data test, grouped by nesting depth; the root
//     sits at depth 0.
//   - The step selects the elements at the configured nesting depth. A depth
//     holding more than one element falls back outward to the nearest
//     shallower depth holding exactly one. A chain shorter than the configured
//     depth clamps to its innermost element. An empty chain registers nothing.
//     A nest holding a registered element registers nothing more.
//   - The step reports and registers nothing. Both live scanners run it.
//
// Every expected value below comes from that statement, never from the
// detection layer's source.

// The selector text the load-time scan's fixtures answer, spelled the way the
// scanner suites above spell it.
const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';

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

// --- AC1: the database query shape registers the scrolling pane alone ---

(function gridNesting_AC1_databaseQueryShapeRegistersTheScrollingPane() {
  const grid = makeDatabaseQueryGrid();

  // The data test is what drops the one-column pinned pane from the chain.
  eq('nesting AC1: the one-column pinned pane fails the data test',
    isDataTable(grid.pinnedPaneEl), false);
  eq('nesting AC1: the wrapper passes the data test, so depth drops it, not the test',
    isDataTable(grid.wrapperEl), true);
  eq('nesting AC1: the scrolling pane passes the data test',
    isDataTable(grid.scrollPaneEl), true);

  const fromHost = findTables(makeNestingHost([grid.wrapperEl]));
  eq('nesting AC1: a root holding the nest reports one table', fromHost.length, 1);
  eq('nesting AC1: the reported table is the scrolling pane',
    fromHost[0] && fromHost[0].handle === grid.scrollPaneEl, true);
  eq('nesting AC1: with no registry supplied the result reports isNew',
    fromHost[0] && fromHost[0].isNew, true);

  const fromWrapper = findTables(grid.wrapperEl);
  eq('nesting AC1: the chain root as root reports one table', fromWrapper.length, 1);
  eq('nesting AC1: the chain root as root reports the scrolling pane',
    fromWrapper[0] && fromWrapper[0].handle === grid.scrollPaneEl, true);

  // The registered element read through the grid adapter: its first column is
  // the identifier column, not the pinned pane's row-number gutter.
  const rows = makeAdapter(grid.scrollPaneEl).getRows();
  eq('nesting AC1: the scrolling pane reads six rows', rows.length, 6);
  eq('nesting AC1: row 0 cell 0 of the registered element is the identifier text',
    rows[0].getCells()[0].getText(), 'alpha');
  eq('nesting AC1: row 0 cell 0 of the registered element is no row number',
    /^\d+$/.test(rows[0].getCells()[0].getText()), false);
})();

// --- AC1: a range expression addresses the identifier column as column A ---
//
// Mechanism: roundTable runs twice on two fresh copies of the fixture, once
// with a range expression naming column A and once naming column B. Column A
// holds the identifier text and no number, so naming it leaves every numeric
// cell alone; naming column B changes the count column and leaves the rate
// column alone. The pair places the identifier column at A and the first
// numeric column at B. Both runs simplify the first row and the first column
// so the positional exclusions cannot stand in for the range.

(function gridNesting_AC1_rangeExpressionAddressesTheIdentifierColumnAsA() {
  const rangeOpts = { simplifyFirstRow: true, simplifyFirstColumn: true };

  const gridA = makeDatabaseQueryGrid();
  const countsBeforeA = dgColumnTexts(gridA.scrollRowEls, 1);
  const ratesBeforeA = dgColumnTexts(gridA.scrollRowEls, 2);
  roundTable(gridA.scrollPaneEl,
    Object.assign({}, DR_DEFAULTS, rangeOpts, { rangeExpr: 'A1:A6' }));
  eq('nesting AC1: a range expression naming column A leaves the count column unchanged',
    dgColumnTexts(gridA.scrollRowEls, 1), countsBeforeA);
  eq('nesting AC1: a range expression naming column A leaves the rate column unchanged',
    dgColumnTexts(gridA.scrollRowEls, 2), ratesBeforeA);
  eq('nesting AC1: a range expression naming column A rounds no cell of the identifier column',
    gridA.scrollRowEls.some((rowEl) => rowEl.children[0].classList.contains('dr-ext-rounded')), false);

  const gridB = makeDatabaseQueryGrid();
  const identifiersBeforeB = dgColumnTexts(gridB.scrollRowEls, 0);
  const countsBeforeB = dgColumnTexts(gridB.scrollRowEls, 1);
  const ratesBeforeB = dgColumnTexts(gridB.scrollRowEls, 2);
  roundTable(gridB.scrollPaneEl,
    Object.assign({}, DR_DEFAULTS, rangeOpts, { rangeExpr: 'B1:B6' }));
  const countsAfterB = dgColumnTexts(gridB.scrollRowEls, 1);
  eq('nesting AC1: a range expression naming column B changes every cell of the count column',
    countsAfterB.every((text, i) => text !== countsBeforeB[i]), true);
  eq('nesting AC1: a range expression naming column B leaves the rate column unchanged',
    dgColumnTexts(gridB.scrollRowEls, 2), ratesBeforeB);
  eq('nesting AC1: a range expression naming column B leaves the identifier column unchanged',
    dgColumnTexts(gridB.scrollRowEls, 0), identifiersBeforeB);

  forgetRegisteredTable(gridA.scrollPaneEl);
  forgetRegisteredTable(gridB.scrollPaneEl);
})();

// --- AC2: depth 0 registers the wrapper, gutter first ---

(function gridNesting_AC2_depthZeroRegistersTheWrapper() {
  const grid = makeDatabaseQueryGrid();
  const results = findTables(makeNestingHost([grid.wrapperEl]), { nestingDepth: 0 });
  eq('nesting AC2: depth 0 reports one table', results.length, 1);
  eq('nesting AC2: depth 0 reports the wrapper',
    results[0] && results[0].handle === grid.wrapperEl, true);

  const rows = makeAdapter(grid.wrapperEl).getRows();
  eq('nesting AC2: the wrapper stitches the pinned cells first, so row 0 cell 0 is a row number',
    rows[0].getCells()[0].getText(), '1');
})();

// --- AC3: two qualifying siblings at the configured depth fall back outward ---

(function gridNesting_AC3_crowdedDepthFallsBackToTheWrapper() {
  const grid = makeDatabaseQueryGrid({ pinnedColumns: 2 });
  eq('nesting AC3: a two-column pinned pane passes the data test',
    isDataTable(grid.pinnedPaneEl), true);

  const results = findTables(makeNestingHost([grid.wrapperEl]));
  eq('nesting AC3: a depth holding two elements still reports one table', results.length, 1);
  eq('nesting AC3: the fall-back outward lands on the wrapper',
    results[0] && results[0].handle === grid.wrapperEl, true);
})();

// --- AC4: a chain shorter than the configured depth clamps to its innermost ---

(function gridNesting_AC4_shortChainClampsToItsInnermostElement() {
  const lone = makeLoneGrid();
  eq('nesting AC4: the lone grid passes the data test', isDataTable(lone), true);
  const loneResults = findTables(makeNestingHost([lone]));
  eq('nesting AC4: a one-element chain at the shipped depth reports one table',
    loneResults.length, 1);
  eq('nesting AC4: a one-element chain at the shipped depth reports itself',
    loneResults[0] && loneResults[0].handle === lone, true);

  const grid = makeDatabaseQueryGrid();
  const deepResults = findTables(makeNestingHost([grid.wrapperEl]), { nestingDepth: 5 });
  eq('nesting AC4: a depth past the chain reports one table', deepResults.length, 1);
  eq('nesting AC4: a depth past the chain clamps to the scrolling pane',
    deepResults[0] && deepResults[0].handle === grid.scrollPaneEl, true);
})();

// --- Adversarial: a plain element between two qualifying elements adds no depth ---
//
// A nesting depth counts qualifying elements, so a role-less div between the
// wrapper and the two panes leaves both panes at depth 1 and the chain two
// long. A count of every ancestor instead would file the panes at depth 2,
// leave the shipped depth empty, and fall back outward to the wrapper.

(function gridNesting_aPlainElementBetweenQualifyingElementsAddsNoDepth() {
  const grid = makeDatabaseQueryGrid({ plainWrapper: true });
  const host = makeNestingHost([grid.wrapperEl]);

  eq('nesting: the plain layer sits between the wrapper and the two panes',
    grid.paneParentEl !== null &&
      grid.scrollPaneEl.parentElement === grid.paneParentEl &&
      grid.pinnedPaneEl.parentElement === grid.paneParentEl &&
      grid.paneParentEl.parentElement === grid.wrapperEl,
    true);
  eq('nesting: the plain layer carries no grid or table role',
    grid.paneParentEl.matches(GRID_ARIA_SELECTOR_TEXT), false);

  const shipped = findTables(host);
  eq('nesting: a plain layer inside the wrapper still reports one table', shipped.length, 1);
  eq('nesting: the shipped depth reports the scrolling pane past the plain layer',
    shipped[0] && shipped[0].handle === grid.scrollPaneEl, true);

  eq('nesting: depth 0 past the plain layer reports the wrapper',
    findTables(host, { nestingDepth: 0 }).map((r) => r.handle === grid.wrapperEl), [true]);
  eq('nesting: depth 2 past the plain layer clamps to the scrolling pane',
    findTables(host, { nestingDepth: 2 }).map((r) => r.handle === grid.scrollPaneEl), [true]);
})();

// --- AC5: two nests under one plain parent report separately ---

(function gridNesting_AC5_siblingNestsReportSeparately() {
  const first = makeDatabaseQueryGrid();
  const second = makeDatabaseQueryGrid();
  const results = findTables(makeNestingHost([first.wrapperEl, second.wrapperEl]));
  eq('nesting AC5: two nests under one plain parent report two tables', results.length, 2);
  eq('nesting AC5: each nest reports its own scrolling pane',
    results.map((r) => r.handle === first.scrollPaneEl || r.handle === second.scrollPaneEl),
    [true, true]);
  eq('nesting AC5: the two reported tables are different elements',
    results.length === 2 && results[0].handle !== results[1].handle, true);
})();

// --- AC6: both live scanners run the step and hold no ARIA pass of their own ---

(function gridNesting_AC6_neitherLiveScannerHoldsAnAriaPass() {
  const loadTimeScanSrc = sourceByName('ui-toggle.js');
  const addedNodePassSrc = sourceByName('content.js');

  eq('nesting AC6: the pillbox view is listed in the manifest', loadTimeScanSrc !== null, true);
  eq('nesting AC6: the controller is listed in the manifest', addedNodePassSrc !== null, true);
  eq('nesting AC6: the load-time scan names no grid or table role selector',
    loadTimeScanSrc !== null &&
      (loadTimeScanSrc.includes('GRID_ARIA_SELECTOR') || loadTimeScanSrc.includes('role="grid"')),
    false);
  eq('nesting AC6: the added-node pass names no grid or table role selector',
    addedNodePassSrc !== null &&
      (addedNodePassSrc.includes('GRID_ARIA_SELECTOR') || addedNodePassSrc.includes('role="grid"')),
    false);
  // The step's page-wide entry point is nominateNests; findTables composes it
  // and keeps the 'selected' outcomes. Both scanners act on the other outcomes
  // too, so both call nominateNests directly.
  eq('nesting AC6: the load-time scan calls the nomination step',
    loadTimeScanSrc !== null && /nominateNests\s*\(/.test(loadTimeScanSrc), true);
  eq('nesting AC6: the added-node pass calls the nomination step',
    addedNodePassSrc !== null && /nominateNests\s*\(/.test(addedNodePassSrc), true);
})();

(function gridNesting_AC6_loadTimeScanBuildsOnePillbox() {
  const grid = makeDatabaseQueryGrid();
  const before = DR_STORE.getRegisteredTables().length;

  withToggleDocumentMock(function () {
    // What a page holding the fixture hands the two passes: no native table,
    // and the three role-bearing elements in document order.
    global.document.querySelectorAll = function (sel) {
      if (sel === 'table') return [];
      if (sel === GRID_ARIA_SELECTOR_TEXT) {
        return [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
      }
      return [];
    };
    injectTableToggles();
  });

  const added = DR_STORE.getRegisteredTables().slice(before);
  eq('nesting AC6: the load-time scan on the fixture adds one registry entry', added.length, 1);
  eq('nesting AC6: the registered element is the scrolling pane',
    added.length === 1 && added[0] === grid.scrollPaneEl, true);
  eq('nesting AC6: the scrolling pane carries one pillbox',
    tableToggles.has(grid.scrollPaneEl), true);
  eq('nesting AC6: the wrapper carries no pillbox', tableToggles.has(grid.wrapperEl), false);
  eq('nesting AC6: the pinned pane carries no pillbox', tableToggles.has(grid.pinnedPaneEl), false);

  forgetRegisteredTable(grid.scrollPaneEl);
})();

(function gridNesting_AC6_addedNodePassBuildsOnePillbox() {
  const grid = makeDatabaseQueryGrid();
  const before = DR_STORE.getRegisteredTables().length;

  withToggleDocumentMock(function () {
    injectTogglesForAddedNode(grid.wrapperEl);
  });

  const added = DR_STORE.getRegisteredTables().slice(before);
  eq('nesting AC6: the added-node pass on the fixture adds one registry entry', added.length, 1);
  eq('nesting AC6: the added-node pass registers the scrolling pane',
    added.length === 1 && added[0] === grid.scrollPaneEl, true);
  eq('nesting AC6: the added-node pass puts one pillbox on the scrolling pane',
    tableToggles.has(grid.scrollPaneEl), true);
  eq('nesting AC6: the added-node pass puts no pillbox on the wrapper',
    tableToggles.has(grid.wrapperEl), false);
  eq('nesting AC6: the added-node pass puts no pillbox on the pinned pane',
    tableToggles.has(grid.pinnedPaneEl), false);

  // A node added inside a nest that already holds a registered element adds
  // no second registration.
  const beforeRediscovery = DR_STORE.getRegisteredTables().length;
  withToggleDocumentMock(function () {
    injectTogglesForAddedNode(grid.scrollPaneEl);
  });
  eq('nesting AC6: a node added inside a registered nest adds no registry entry',
    DR_STORE.getRegisteredTables().length, beforeRediscovery);

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- AC7: the living docs and the test page state the rule ---

(function gridNesting_AC7_livingDocsAndTheTestPageStateTheRule() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const extensionReadme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const testPage = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'test-pages', 'tables.html'), 'utf8');

  for (const term of ['qualifying element', 'chain root', 'containment chain', 'nesting depth']) {
    eq('nesting AC7: docs/vocabulary.md carries a row for "' + term + '"',
      new RegExp('^\\|\\s*' + term + '\\s*\\|', 'mi').test(vocabularyMd), true);
  }
  const pinnedPaneRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*pinned pane\s*\|/i.test(line)) || '';
  eq('nesting AC7: docs/vocabulary.md keeps a pinned pane row', pinnedPaneRow !== '', true);
  eq('nesting AC7: the pinned pane row states that the configured depth governs its columns',
    /depth/i.test(pinnedPaneRow), true);

  eq('nesting AC7: chrome-extension/README.md states the nesting depth',
    /nesting depth/i.test(extensionReadme), true);
  eq('nesting AC7: docs/design.md states the nesting depth',
    /nesting depth/i.test(designMd), true);

  const sectionStart = testPage.indexOf('13. Pinned-pane vendor grid');
  const nextHeadingAt = testPage.indexOf('<h2>', sectionStart);
  const section = sectionStart < 0 ? ''
    : testPage.slice(sectionStart, nextHeadingAt < 0 ? testPage.length : nextHeadingAt);
  const expectMatch = section.match(/<p class="expect">([\s\S]*?)<\/p>/);
  const expectText = expectMatch ? expectMatch[1] : '';
  eq('nesting AC7: the test page holds a pinned-pane vendor grid section', sectionStart >= 0, true);
  eq('nesting AC7: that section holds an expectation paragraph', expectText !== '', true);
  eq('nesting AC7: the expectation names the scrolling pane',
    /scrolling pane/i.test(expectText), true);
  eq('nesting AC7: the expectation states no pillbox on the wrapper',
    /pillbox[^.]*wrapper/i.test(expectText), false);
  eq('nesting AC7: the section states no second pillbox',
    /second pillbox/i.test(section), false);
})();

// --- Adversarial: a rediscovery reports nothing for a registered nest ---

(function gridNesting_rediscoveryIsIdempotent() {
  const grid = makeDatabaseQueryGrid();
  eq('nesting: a nest whose scrolling pane is registered reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.scrollPaneEl }).length, 0);
  eq('nesting: a nest whose wrapper is registered reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.wrapperEl }).length, 0);
  eq('nesting: a nest whose pinned pane is registered reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.pinnedPaneEl }).length, 0);
  eq('nesting: a nest holding no registered element still reports the scrolling pane',
    findTables(grid.wrapperEl, { isSeen: () => false }).map((r) => r.handle === grid.scrollPaneEl),
    [true]);
})();

// --- Adversarial: the depth port reads zero as a depth ---

(function gridNesting_theDepthPortReadsZeroAsADepth() {
  eq('nesting: the detection settings ship a nesting depth of 1', DR_DETECTION_SETTINGS.nestingDepth, 1);

  const grid = makeDatabaseQueryGrid();
  const host = makeNestingHost([grid.wrapperEl]);
  eq('nesting: the shipped depth reports the scrolling pane',
    findTables(host).map((r) => r.handle === grid.scrollPaneEl), [true]);
  eq('nesting: an override of zero reports the wrapper, so zero reads as a depth',
    findTables(host, { nestingDepth: 0 }).map((r) => r.handle === grid.wrapperEl), [true]);
})();

// --- Adversarial: an empty wrapper reports nothing and throws nothing ---

(function gridNesting_anEmptyWrapperReportsNothing() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  let caught = null;
  let results = null;
  try {
    results = findTables(makeNestingHost([grid.wrapperEl]));
  } catch (e) {
    caught = e.message;
  }
  eq('nesting: an empty wrapper throws nothing', caught, null);
  eq('nesting: an empty wrapper reports no table', results && results.length, 0);
})();

// --- Adversarial: pass 1 is unchanged ---

(function gridNesting_pass1StillReportsNativeTablesBesideTheNest() {
  const nativeTable = makePass1DataTable();
  const grid = makeDatabaseQueryGrid();
  const root = {
    tagName: 'BODY',
    querySelectorAll(sel) {
      if (sel === 'table') return [nativeTable];
      if (sel === GRID_ARIA_SELECTOR_TEXT) {
        return [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
      }
      return [];
    },
  };

  eq('nesting: the plain native table is no accessibility artifact (sanity)',
    isPhantomA11yTable(nativeTable), false);
  const results = findTables(root);
  eq('nesting: a root holding one native table and one nest reports two tables',
    results.length, 2);
  eq('nesting: pass 1 reports the native table first',
    results.length === 2 && results[0].handle === nativeTable, true);
  eq('nesting: pass 2 reports the scrolling pane second',
    results.length === 2 && results[1].handle === grid.scrollPaneEl, true);
})();

// --- Adversarial: the step reports and registers nothing ---

(function gridNesting_theStepReportsAndRegistersNothing() {
  const grid = makeDatabaseQueryGrid();
  const nestElements = [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
  const before = DR_STORE.getRegisteredTables().length;

  findTables(makeNestingHost([grid.wrapperEl]));

  eq('nesting: the nomination step adds no registry entry',
    DR_STORE.getRegisteredTables().length, before);
  eq('nesting: the nomination step registers no element of the nest',
    nestElements.map((el) => DR_STORE.hasTable(el)), [false, false, false]);
  eq('nesting: the nomination step writes no grid marker class',
    nestElements.map((el) => el.classList.contains('dr-ext-grid')), [false, false, false]);
})();

// =============================================================================
// Sprint shape-fingerprint: the reader, the comparison, and the chain-root walk
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.6 and the
// shape-fingerprint block in §5; decision D7 in
// docs/sprint-plans/grid-detection-recovery.md; the shape fingerprint row in
// docs/vocabulary.md.
// =============================================================================
//
// The rule these assertions pin, in the specification's words:
//   - A shape fingerprint is the column count, and the header row's cell
//     texts where the table has a header row, recorded for a table when it
//     enters the registry.
//   - The column count is the widest row's cell count.
//   - A grid has a header row where it groups its data rows and its first row
//     sits outside every group. A native table has one where its first row
//     sits in the head section or holds header cells alone.
//   - A table with no header row carries the column count alone, because the
//     first row of a grid that groups nothing is a data row that every scroll
//     redraws.
//   - The row count stays out for the same reason: a virtualized grid changes
//     its drawn row count on every scroll.
//   - Two fingerprints describe the same shape when the column counts match
//     and the header texts match element by element. Two readings that found
//     no header row compare on the column count alone, and a reading that
//     found one against a reading that did not is a difference.
//   - The originals port supplies a cell's stored pre-simplification text, so
//     the extension's own writes to a header cell read as no change.
//
// Every expected value below comes from that statement, never from the
// detection layer's source.

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

// --- The reader ---

(function shapeFingerprint_theReaderReportsColumnsAndTheHeaderRowsTexts() {
  const g = makeScrollingRowgroupGrid(['Region', 'Q1', 'Q2'], [
    ['North', '1,482,391', '918,554'], ['South', '55,120', '7,314'],
  ]);
  const reading = readTableFingerprint(g.wrapperEl);
  eq('fingerprint reader: the reading carries the grid\'s column count',
    reading.columnCount, 3);
  eq('fingerprint reader: the reading carries the header row\'s cell texts',
    reading.headerTexts, ['Region', 'Q1', 'Q2']);
  eq('fingerprint reader: the reading carries those two fields and no row count',
    Object.keys(reading).sort(), ['columnCount', 'headerTexts']);
})();

// A grid that groups no rows has a data row first. Its text describes the rows
// on the screen rather than the table, so the reading leaves it out.
(function shapeFingerprint_aGrouplessGridCarriesTheColumnCountAlone() {
  const grid = makeDatabaseQueryGrid();
  const reading = readTableFingerprint(grid.scrollPaneEl);
  eq('fingerprint reader: a groupless grid\'s reading carries its column count',
    reading.columnCount, 3);
  eq('fingerprint reader: a groupless grid\'s reading carries no header texts',
    reading.headerTexts, null);
})();

(function shapeFingerprint_theColumnCountIsTheWidestRowNotTheFirstRow() {
  const grouped = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391', '9,105'], ['South', '918,554'],
  ]);
  const groupedReading = readTableFingerprint(grouped.wrapperEl);
  eq('fingerprint reader: the column count is the widest row\'s cell count',
    groupedReading.columnCount, 3);
  eq('fingerprint reader: the header texts stay the header row\'s, narrower than the count',
    groupedReading.headerTexts, ['Region', 'Q1']);

  const groupless = makeGridWrapper([
    ['Region', 'Q1'],
    ['North', '1,482,391', '9,105'],
    ['South', '918,554'],
  ]);
  const grouplessReading = readTableFingerprint(groupless.wrapperEl);
  eq('fingerprint reader: a groupless grid\'s widest row still sets the column count',
    grouplessReading.columnCount, 3);
  eq('fingerprint reader: a groupless grid carries no header texts whatever its rows',
    grouplessReading.headerTexts, null);
})();

// The three native-table forms. The adapter's outside-row mark names the
// footer section on a native table, so the head section is read from the row.
(function shapeFingerprint_aNativeTablesHeaderRowIsItsHeadSectionOrItsHeaderCells() {
  const headSection = makeHeadSectionTable(['Region', 'Q1'], [['North', '1,482,391']]);
  eq('fingerprint reader: a native table whose first row sits in a head section carries header texts',
    readTableFingerprint(headSection).headerTexts, ['Region', 'Q1']);

  const headerCells = makeToggleTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  eq('fingerprint reader: a native table whose first row holds header cells alone carries header texts',
    readTableFingerprint(headerCells).headerTexts, ['Region', 'Q1']);

  const dataFirst = makeToggleTable([
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    [{ tag: 'td', text: 'South' }, { tag: 'td', text: '918,554' }],
  ]);
  const dataFirstReading = readTableFingerprint(dataFirst);
  eq('fingerprint reader: a native table whose first row holds data cells carries no header texts',
    dataFirstReading.headerTexts, null);
  eq('fingerprint reader: that table still carries its column count',
    dataFirstReading.columnCount, 2);

  const mixedFirstRow = makeToggleTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'td', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  eq('fingerprint reader: a first row holding one data cell beside a header cell carries no header texts',
    readTableFingerprint(mixedFirstRow).headerTexts, null);
})();

(function shapeFingerprint_theOriginalsPortReadsPastTheExtensionsOwnWrites() {
  const g = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391'], ['South', '918,554'],
  ]);
  const beforeSimplification = readTableFingerprint(g.wrapperEl);
  const headerCells = g.headerRow.children;
  const stored = new Map();
  headerCells.forEach((cellEl) => { stored.set(cellEl, cellEl.childNodes[0].nodeValue); });
  // What a simplification of the header row leaves on the screen.
  headerCells.forEach((cellEl) => { cellEl.childNodes[0].nodeValue = '7M'; });

  const throughThePort = readTableFingerprint(g.wrapperEl,
    { originalText: (cellEl) => stored.get(cellEl) });
  eq('fingerprint reader: a read through the originals port matches the pre-simplification reading',
    sameTableFingerprint(beforeSimplification, throughThePort), true);
  eq('fingerprint reader: the same read without the port carries the simplified texts',
    sameTableFingerprint(beforeSimplification, readTableFingerprint(g.wrapperEl)), false);
  eq('fingerprint reader: a port holding nothing for a cell falls back to the cell\'s own text',
    readTableFingerprint(g.wrapperEl, { originalText: () => undefined }).headerTexts,
    ['7M', '7M']);
})();

// --- The comparison ---

(function shapeFingerprint_theComparisonReadsColumnsAndHeaderTextsAlone() {
  const base = { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] };
  eq('fingerprint comparison: two equal readings compare the same',
    sameTableFingerprint(base, { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] }), true);
  eq('fingerprint comparison: a different column count compares different',
    sameTableFingerprint(base, { columnCount: 4, headerTexts: ['Region', 'Q1', 'Q2'] }), false);
  eq('fingerprint comparison: one differing header text compares different',
    sameTableFingerprint(base, { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q3'] }), false);
  eq('fingerprint comparison: a shorter header list compares different',
    sameTableFingerprint(base, { columnCount: 3, headerTexts: ['Region', 'Q1'] }), false);
  eq('fingerprint comparison: a missing reading compares different',
    sameTableFingerprint(base, null), false);
})();

// A table with no header row compares on the column count alone. A table that
// gained or lost its header row compares different.
(function shapeFingerprint_theComparisonReadsTwoHeaderlessReadingsOnTheColumnCount() {
  const headerless = { columnCount: 3, headerTexts: null };
  eq('fingerprint comparison: two readings with no header row and one column count compare the same',
    sameTableFingerprint(headerless, { columnCount: 3, headerTexts: null }), true);
  eq('fingerprint comparison: two readings with no header row and different column counts compare different',
    sameTableFingerprint(headerless, { columnCount: 4, headerTexts: null }), false);
  eq('fingerprint comparison: a reading with a header row against one without compares different',
    sameTableFingerprint(headerless, { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] }), false);
  eq('fingerprint comparison: that difference reads the same either way round',
    sameTableFingerprint({ columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] }, headerless), false);
})();

// The consequence on a groupless grid: a scroll changes the first row's text
// and the reading holds; a new result set changes the column count and the
// reading moves.
(function shapeFingerprint_aGrouplessGridsFirstRowTextIsNoPartOfTheReading() {
  const grid = makeDatabaseQueryGrid();
  const before = readTableFingerprint(grid.scrollPaneEl);
  dgReplaceRowCells(grid.scrollRowEls[0], ['golf', '44,190', '12.08']);
  eq('fingerprint comparison: a groupless grid\'s first-row text change compares the same',
    sameTableFingerprint(before, readTableFingerprint(grid.scrollPaneEl)), true);

  dgAppendRowCell(grid.scrollRowEls[0], '3,006');
  eq('fingerprint comparison: a groupless grid\'s column count change compares different',
    sameTableFingerprint(before, readTableFingerprint(grid.scrollPaneEl)), false);
})();

// The row count plays no part. A virtualized grid changes its drawn row count
// on every scroll, so a fingerprint carrying the count would report a scroll
// as a shape change.
(function shapeFingerprint_theRowCountPlaysNoPartInTheComparison() {
  const sixRows = makeGridWrapper([
    ['Region', 'Q1'], ['North', '1,482,391'], ['South', '918,554'],
    ['East', '55,120'], ['West', '7,314'], ['Inland', '2,905'],
  ]);
  const twoRows = makeGridWrapper([['Region', 'Q1'], ['North', '1,482,391']]);
  eq('fingerprint comparison: a six-row reading and a two-row reading of one shape compare the same',
    sameTableFingerprint(
      readTableFingerprint(sixRows.wrapperEl), readTableFingerprint(twoRows.wrapperEl)), true);
})();

// --- The living docs state the field ---
//
// Two doc-pin blocks already stand in this suite (the nesting rule's and the
// data-test budget's); this one follows them. The vocabulary defines the term
// and the registry row lists it; the design doc's state-ownership paragraph
// lists it among the per-table registry fields.

(function shapeFingerprint_theLivingDocsStateTheField() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');

  const fingerprintRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*shape fingerprint\s*\|/i.test(line)) || '';
  eq('fingerprint docs: docs/vocabulary.md carries a row for "shape fingerprint"',
    fingerprintRow !== '', true);
  eq('fingerprint docs: that row states the column count and the header row',
    /column count/i.test(fingerprintRow) && /header row/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states that the row count stays out',
    /row count/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states which grid has a header row',
    /(row group|groups its data rows|outside row)/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states which native table has one',
    /head section/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states what a table with no header row carries',
    /no header row/i.test(fingerprintRow), true);

  const registryRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*registry\s*\|/i.test(line)) || '';
  eq('fingerprint docs: the registry row lists the shape fingerprint among its details',
    /shape fingerprint/i.test(registryRow), true);

  const stateOwnership = designMd.split('\n')
    .find((line) => /The registry keys per-table storage on the live element/i.test(line)) || '';
  eq('fingerprint docs: docs/design.md keeps its per-table registry sentence',
    stateOwnership !== '', true);
  eq('fingerprint docs: that sentence lists the shape fingerprint',
    /shape fingerprint/i.test(stateOwnership), true);
  eq('fingerprint docs: that sentence states when the fingerprint carries header texts',
    /header row/i.test(stateOwnership), true);
})();

// --- The chain-root walk the mismatch path re-runs the nomination step from ---

(function shapeFingerprint_theChainRootWalkIsPublic() {
  const grid = makeDatabaseQueryGrid();
  eq('fingerprint chain root: the chain root of the scrolling pane is the wrapper',
    chainRootOf(grid.scrollPaneEl) === grid.wrapperEl, true);
  eq('fingerprint chain root: the chain root of the wrapper is the wrapper',
    chainRootOf(grid.wrapperEl) === grid.wrapperEl, true);

  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  eq('fingerprint chain root: a plain layer inside the wrapper leaves the chain root the wrapper',
    chainRootOf(plain.scrollPaneEl) === plain.wrapperEl, true);

  eq('fingerprint chain root: an element in no nest has none',
    chainRootOf(makeNestingHost([])) === null, true);
  eq('fingerprint chain root: a missing element has none', chainRootOf(null) === null, true);
})();

// =============================================================================
// Sprint pending-retest: the nomination step reports one nest at a time
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.3 and §3.4.
// =============================================================================
//
// The four outcomes, in the specification's words:
//   - 'selected'   the step selected an element to register.
//   - 'empty'      no element of the nest passes the data test, which is the
//                  pending-table case.
//   - 'crowded'    a depth holds more than one element and no shallower depth
//                  holds exactly one, so the nest registers nothing.
//   - 'registered' the nest already holds an element the caller reports as
//                  seen, which makes a rediscovery idempotent.
// The chain size counts the nest elements that passed the data test and filed
// at a depth; it is zero for 'empty' and for 'registered'.
//
// findTables keeps the 'selected' outcomes and drops the other three, so a
// caller that acts on them reads them here.

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

(function nominationStep_reportsSelectedForTheDatabaseQueryShape() {
  const grid = makeDatabaseQueryGrid();
  const result = nominateNest(grid.wrapperEl);

  eq('nomination: a filled database query grid reports the selected outcome',
    result.outcome, 'selected');
  eq('nomination: the selected element is the scrolling pane',
    result.selected === grid.scrollPaneEl, true);
  eq('nomination: the reported chain root is the wrapper',
    result.chainRoot === grid.wrapperEl, true);
  eq('nomination: the chain holds the wrapper and the scrolling pane',
    result.chainSize, 2);
  eq('nomination: findTables on the same shape reports the selected handle alone',
    findTables(grid.wrapperEl).map((r) => r.handle === grid.scrollPaneEl), [true]);
})();

(function nominationStep_reportsEmptyForAGridWithNoRows() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const result = nominateNest(grid.wrapperEl);

  eq('nomination: a grid with no rows reports the empty outcome', result.outcome, 'empty');
  eq('nomination: the empty outcome selects nothing', result.selected, null);
  eq('nomination: the empty outcome reports the wrapper as the chain root',
    result.chainRoot === grid.wrapperEl, true);
  eq('nomination: the empty outcome reports a chain size of zero', result.chainSize, 0);
  eq('nomination: findTables on a grid with no rows reports nothing',
    findTables(grid.wrapperEl).length, 0);
})();

(function nominationStep_reportsCrowdedWhenTheDepthHoldsTwoAndTheRootFails() {
  const nest = makeCrowdedNest();

  eq('nomination: the crowded root fails the data test', isDataTable(nest.rootEl), false);
  eq('nomination: both panes of the crowded nest pass the data test',
    [nest.paneAEl, nest.paneBEl].map(isDataTable), [true, true]);

  const result = nominateNest(nest.rootEl);
  eq('nomination: two passing siblings with a failing root report the crowded outcome',
    result.outcome, 'crowded');
  eq('nomination: the crowded outcome selects nothing', result.selected, null);
  eq('nomination: the crowded outcome counts both passing siblings', result.chainSize, 2);
  eq('nomination: findTables on the crowded shape reports nothing',
    findTables(nest.rootEl).length, 0);
})();

(function nominationStep_reportsRegisteredWhenTheNestHoldsASeenElement() {
  const grid = makeDatabaseQueryGrid();
  const result = nominateNest(grid.wrapperEl, { isSeen: (el) => el === grid.scrollPaneEl });

  eq('nomination: a nest holding a seen element reports the registered outcome',
    result.outcome, 'registered');
  eq('nomination: the registered outcome selects nothing', result.selected, null);
  eq('nomination: the registered outcome reports a chain size of zero', result.chainSize, 0);
  eq('nomination: findTables on a nest holding a seen element reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.scrollPaneEl }).length, 0);
})();

(function nominationStep_reportsOneResultPerNestInDocumentOrder() {
  const first = makeDatabaseQueryGrid();
  const second = makeDatabaseQueryGrid();
  const results = nominateNests(makeNestingHost([first.wrapperEl, second.wrapperEl]));

  eq('nomination: a host holding two grids reports two results', results.length, 2);
  eq('nomination: the results carry the two chain roots in document order',
    results.map((r) => r.chainRoot === first.wrapperEl || r.chainRoot === second.wrapperEl),
    [true, true]);
  eq('nomination: the first result belongs to the first grid',
    results[0] && results[0].chainRoot === first.wrapperEl, true);
  eq('nomination: the second result belongs to the second grid',
    results[1] && results[1].chainRoot === second.wrapperEl, true);
  eq('nomination: each result selects its own scrolling pane',
    results.map((r) => r.selected === first.scrollPaneEl || r.selected === second.scrollPaneEl),
    [true, true]);
})();

(function nominationStep_theChainRootWalkFindsTheOutermostQualifyingElement() {
  const grid = makeDatabaseQueryGrid();
  eq('nomination: the walk from the scrolling pane lands on the wrapper',
    chainRootOf(grid.scrollPaneEl) === grid.wrapperEl, true);
  eq('nomination: the walk from the pinned pane lands on the same wrapper',
    chainRootOf(grid.pinnedPaneEl) === grid.wrapperEl, true);
  eq('nomination: the walk from the wrapper lands on the wrapper itself',
    chainRootOf(grid.wrapperEl) === grid.wrapperEl, true);
  eq('nomination: a plain element with no qualifying ancestor has no chain root',
    chainRootOf(makeDgNode('DIV', 'plain-element', null, [])), null);
})();

// --- Criterion 5: the living docs state the pending table rule ---

(function pendingRetest_AC5_livingDocsStateTheRule() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const extensionReadme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

  const pendingRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*pending table\s*\|/i.test(line)) || '';
  eq('pending AC5: docs/vocabulary.md carries a row for "pending table"',
    pendingRow !== '', true);
  eq('pending AC5: the pending table row states the subtree observer',
    /subtree observer/i.test(pendingRow), true);
  eq('pending AC5: the pending table row states the re-test cap',
    /re-test cap/i.test(pendingRow), true);

  const designParagraphs = designMd.split('\n\n');
  const detectionParagraph = designParagraphs.find((p) => /^\*\*Detection\.\*\*/.test(p)) || '';
  eq('pending AC5: docs/design.md carries a Detection paragraph',
    detectionParagraph !== '', true);
  eq('pending AC5: the Detection paragraph states that an empty chain leaves a pending table',
    /pending table/i.test(detectionParagraph), true);
  eq('pending AC5: the Detection paragraph states the cap on failed re-tests',
    /reaches the cap/i.test(detectionParagraph), true);

  const stateParagraph = designParagraphs.find((p) => /hold state outside the model/i.test(p)) || '';
  eq('pending AC5: docs/design.md lists the state held outside the model',
    stateParagraph !== '', true);
  eq('pending AC5: that list names each pending table\'s subtree observer',
    /pending table[^.]*observer/i.test(stateParagraph), true);

  const detectionPoint = extensionReadme.split('\n')
    .find((line) => /Detection runs on demand/i.test(line)) || '';
  eq('pending AC5: chrome-extension/README.md carries the detection point',
    detectionPoint !== '', true);
  eq('pending AC5: the detection point states the pending table',
    /pending table/i.test(detectionPoint), true);
  eq('pending AC5: the detection point names the re-test cap in the detection settings',
    /pendingRetestCap/.test(detectionPoint), true);
})();

// =============================================================================
// Sprint merge-ladder: lib/dr-simplify classification ladder
// =============================================================================
//
// Before this sprint the classification ladder existed as two hand-kept-in-
// sync copies: the engine's per-cell loop in content.js (itself duplicated
// between the native-<table> path and computeGridRoundedValues, which
// documented itself as needing to match the native path "EXACTLY") and a much
// thinner copy in the sidebar preview-sample extractor (collectNumericCells /
// extractPreviewSamples) that skipped most of the rules outright. All three
// now call classifyCell (lib/dr-simplify/ladder.js).
//
// This section has three parts:
//   1. Package discipline — mirrors the DR_NUMBER/DR_TABLE checks.
//   2. classifyCell unit tests — one per ladder rule, exercised directly with
//      plain data (no DOM), matching the file's PURE contract.
//   3. Divergence tests — the preview extractor used to skip almost every
//      rule below; each test pins the MERGED (engine-wins) behavior and
//      documents what the old preview copy did instead.

// --- 1. Package discipline ---

(function drSimplifyBundleMatchesSourceDeclarations() {
  const FUNCTION_DECL_RE = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  const declaredNames = ladderCode === null ? [] :
    [...ladderCode.matchAll(FUNCTION_DECL_RE)].map((m) => m[1]).sort();
  eq('lib/dr-simplify/ladder.js: source present in manifest', ladderCode !== null, true);
  eq('lib/dr-simplify bundle: ladder.js declared at least one top-level function',
    declaredNames.length > 0, true);
  eq('lib/dr-simplify/index.js: DR_SIMPLIFY exists on the global scope after the main eval',
    typeof globalThis.DR_SIMPLIFY, 'object');
  eq('lib/dr-simplify bundle: DR_SIMPLIFY keys are exactly the top-level functions declared in ladder.js',
    Object.keys(globalThis.DR_SIMPLIFY || {}).sort(), declaredNames);
  eq('lib/dr-simplify bundle: every DR_SIMPLIFY entry is itself a function',
    declaredNames.every((n) => typeof (globalThis.DR_SIMPLIFY || {})[n] === 'function'), true);
})();

(function drSimplifyIndexJsDeclaresExactlyOneGlobal() {
  const indexSrc = sourceByName('lib/dr-simplify/index.js');
  if (indexSrc === null) {
    eq('lib/dr-simplify/index.js: source present in manifest', false, true);
    return;
  }
  const topLevelDeclarations = indexSrc.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('lib/dr-simplify/index.js: exactly one top-level declaration in the file',
    topLevelDeclarations.length, 1);
  eq('lib/dr-simplify/index.js: the sole top-level declaration is DR_SIMPLIFY',
    /^const DR_SIMPLIFY\b/m.test(indexSrc), true);
})();

// --- 2. classifyCell unit tests (pure, no DOM) ---

const LADDER_OPTS = {
  simplifyFirstRow: false,
  simplifyFirstColumn: false,
  simplifyMixedPercent: true,
  simplifyMixedCurrency: true,
  simplifyDates: true,
  simplifyTimes: false,
  simplifyMixedCells: true,
};

(function classifyCell_outOfRange() {
  const ranges = [{ colMin: 5, colMax: 10, rowMin: 0, rowMax: 100 }];
  eq('classifyCell: out-of-range cell is skipped',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges }, LADDER_OPTS),
    { mode: 'skip', reason: 'out-of-range' });
})();

(function classifyCell_firstRow() {
  eq('classifyCell: first-row cell is skipped when simplifyFirstRow is false',
    classifyCell({ text: '100', rowIndex: 0, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'first-row' });
  eq('classifyCell: first-row cell simplifies when simplifyFirstRow is true',
    classifyCell({ text: '100', rowIndex: 0, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyFirstRow: true })),
    { mode: 'pure', reason: 'simplify', value: { num: 100 } });
})();

(function classifyCell_firstColumn() {
  eq('classifyCell: first-column cell is skipped when simplifyFirstColumn is false',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'first-column' });
  eq('classifyCell: first-column cell simplifies when simplifyFirstColumn is true',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyFirstColumn: true })),
    { mode: 'pure', reason: 'simplify', value: { num: 100 } });
})();

(function classifyCell_percent() {
  eq('classifyCell: percent cell simplifies when simplifyMixedPercent is true',
    classifyCell({ text: '50%', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'pure', reason: 'simplify', value: { num: 50 } });
  eq('classifyCell: percent cell is skipped when simplifyMixedPercent is false',
    classifyCell({ text: '50%', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedPercent: false })),
    { mode: 'skip', reason: 'percent' });
})();

(function classifyCell_currency() {
  eq('classifyCell: currency cell simplifies when simplifyMixedCurrency is true',
    classifyCell({ text: '$100', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'pure', reason: 'simplify', value: { num: 100 } });
  eq('classifyCell: currency cell is skipped when simplifyMixedCurrency is false',
    classifyCell({ text: '$100', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false })),
    { mode: 'skip', reason: 'currency' });
})();

(function classifyCell_unknownExclusionFailsClosed() {
  // getExclusionReason today only ever returns 'firstRow' | 'firstColumn' |
  // 'percent' | 'currency' | null, but classifyCell's ladder must fail
  // closed (skip) on any other non-null value a future exclusion rule
  // returns, instead of silently falling through and simplifying the cell.
  // classifyCell calls getExclusionReason as a bare same-scope identifier
  // (not through an overridable namespace), so the override has to live in
  // its own isolated scope built from the same three source files, with a
  // stub getExclusionReason declared after the real one (last declaration
  // of a name wins in the same scope).
  const isolatedSrc = coreCode + '\n' + parsingCode + '\n' +
    'function getExclusionReason() { return "someFutureReason"; }\n' +
    ladderCode + '\nreturn classifyCell;';
  const isolatedClassifyCell = new Function(isolatedSrc)();
  eq('classifyCell: unrecognized non-null exclusion reason still skips the cell',
    isolatedClassifyCell({ text: '100', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'excluded' });
})();

(function classifyCell_quoted() {
  eq('classifyCell: whole-cell-quoted cell is skipped regardless of content',
    classifyCell({ text: '"12345"', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'quoted' });
})();

(function classifyCell_dates() {
  eq('classifyCell: date-like cell is skipped when simplifyDates is false',
    classifyCell({ text: '2020-01-01', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyDates: false })),
    { mode: 'skip', reason: 'dates-disabled' });
  eq('classifyCell: unambiguous date-like cell resolves when simplifyDates is true',
    classifyCell({ text: '2020-01-01', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'date', reason: 'simplify', value: { month: 1, day: 1, year: 2020 } });
  eq('classifyCell: ambiguous numeric date returns a pending decision',
    classifyCell({ text: '03/04/2020', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'date', reason: 'simplify', pending: 'ambiguous-date', value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } });
})();

(function classifyCell_times() {
  eq('classifyCell: time-like cell is skipped when simplifyTimes is false',
    classifyCell({ text: '3:45 PM', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'times-disabled' });
  eq('classifyCell: time-like cell simplifies when simplifyTimes is true',
    classifyCell({ text: '3:45 PM', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyTimes: true })),
    { mode: 'time', reason: 'simplify' });
})();

(function classifyCell_link() {
  eq('classifyCell: whole-cell link cell is skipped',
    classifyCell({ text: '42', rowIndex: 1, columnIndex: 1, ranges: null, isWholeLink: true }, LADDER_OPTS),
    { mode: 'skip', reason: 'link' });
})();

(function classifyCell_footnoteSuperscript() {
  // "10<sup>12</sup>" flattens to "1012"; the sole match spans the whole
  // string and overlaps the superscript mask, so nothing survives.
  eq('classifyCell: whole-cell exponent with no surviving match after masking is skipped',
    classifyCell({
      text: '1012', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 2, end: 4 }],
    }, LADDER_OPTS),
    { mode: 'skip', reason: 'footnote' });

  // "20 <sup>15</sup>" flattens to "20 1015": the standalone "20" survives
  // masking even though the sup-adjacent "1015" match does not.
  eq('classifyCell: a superscript-flagged cell keeps non-overlapping matches',
    classifyCell({
      text: '20 1015', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 5, end: 7 }],
    }, LADDER_OPTS),
    { mode: 'extracted', reason: 'footnote', value: { matches: [{ numStr: '20', num: 20, index: 0 }] } });

  eq('classifyCell: superscript-flagged cell is skipped when simplifyMixedCells is false',
    classifyCell({
      text: '1012', rowIndex: 1, columnIndex: 1, ranges: null, hasSuperscript: true,
    }, Object.assign({}, LADDER_OPTS, { simplifyMixedCells: false })),
    { mode: 'skip', reason: 'footnote' });
})();

(function classifyCell_mixedText() {
  eq('classifyCell: mixed text with a numeric match simplifies',
    classifyCell({ text: 'Revenue 500 units', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).mode,
    'extracted');
  eq('classifyCell: mixed text drops era-marked years from extracted matches',
    classifyCell({ text: 'Kalki 2898 AD and 500 more', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)
      .value.matches.map((m) => m.num),
    [500]);
  eq('classifyCell: mixed text drops numbers inside a quoted span',
    classifyCell({ text: 'Product "42" ships in 10 days', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)
      .value.matches.map((m) => m.numStr),
    ['10']);
  eq('classifyCell: mixed text is skipped when simplifyMixedCells is false',
    classifyCell({ text: 'Revenue 500 units', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedCells: false })),
    { mode: 'skip', reason: 'mixed-disabled' });
  eq('classifyCell: mixed text with no numeric content is skipped',
    classifyCell({ text: 'hello world', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'no-number' });
})();

// A unit number: one number with a magnitude suffix after it, a listed
// currency code before or after it, or both. The match reports the number's
// digits and their position in the text as given.
(function matchUnitNumber_shapes() {
  if (typeof matchUnitNumber !== 'function') {
    eq('matchUnitNumber: the function exists', false, true);
    return;
  }
  const m = (text) => {
    const found = matchUnitNumber(text);
    return found && { numStr: found.numStr, index: found.index };
  };
  eq('matchUnitNumber: a suffix directly after the number', m('4.91tn'), { numStr: '4.91', index: 0 });
  eq('matchUnitNumber: a one-letter suffix', m('41.31m'), { numStr: '41.31', index: 0 });
  eq('matchUnitNumber: a suffix after one space, any case', m('5.2 Bn'), { numStr: '5.2', index: 0 });
  eq('matchUnitNumber: an upper-case suffix', m('10K'), { numStr: '10', index: 0 });
  eq('matchUnitNumber: a code before the number', m('CAD45.67'), { numStr: '45.67', index: 3 });
  eq('matchUnitNumber: a code then a symbol', m('CAD$45.67'), { numStr: '45.67', index: 4 });
  eq('matchUnitNumber: a symbol then a code', m('$CAD45.67'), { numStr: '45.67', index: 4 });
  eq('matchUnitNumber: a code and one space', m('CAD 45.67'), { numStr: '45.67', index: 4 });
  eq('matchUnitNumber: a code and a suffix', m('CAD45.67m'), { numStr: '45.67', index: 3 });
  eq('matchUnitNumber: a code after the number', m('45.67 CAD'), { numStr: '45.67', index: 0 });
  eq('matchUnitNumber: a grouped number with a code after it', m('1,234 USD'), { numStr: '1,234', index: 0 });
  eq('matchUnitNumber: a symbol and a suffix', m('$4.91tn'), { numStr: '4.91', index: 1 });
  eq('matchUnitNumber: a negative number with a suffix', m('-2.5bn'), { numStr: '-2.5', index: 0 });
  eq('matchUnitNumber: the index counts the text\'s own whitespace', m(' 41.31m '), { numStr: '41.31', index: 1 });
  eq('matchUnitNumber: the match carries the number\'s value', matchUnitNumber('41.31m').num, 41.31);

  for (const text of ['DT1234', 'cust15', 'XYZ45.67', '45.67kg', '4.91tnx', 'm45', '45.67', '$45.67',
    'CAD', '12 of 40', 'usd45', 'CAD45.67 USD', '4.91  tn', 'Revenue 500m']) {
    eq('matchUnitNumber: "' + text + '" is not a unit number', matchUnitNumber(text), null);
  }
})();

(function classifyCell_unitNumbers() {
  const wordsOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCells: false });
  const currencyOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false });
  const at = (text, extra) => Object.assign({ text, rowIndex: 1, columnIndex: 1, ranges: null }, extra || {});
  eq('classifyCell: a unit number simplifies with the words setting off',
    classifyCell(at('4.91tn'), wordsOff),
    { mode: 'extracted', reason: 'unit', value: { matches: [{ numStr: '4.91', num: 4.91, index: 0 }] } });
  eq('classifyCell: a unit number simplifies with the words setting on',
    classifyCell(at('CAD45.67'), LADDER_OPTS),
    { mode: 'extracted', reason: 'unit', value: { matches: [{ numStr: '45.67', num: 45.67, index: 3 }] } });
  eq('classifyCell: a code before the number excludes the cell with the currency setting off',
    classifyCell(at('CAD45.67'), currencyOff), { mode: 'skip', reason: 'currency' });
  eq('classifyCell: a code after the number excludes the cell with the currency setting off',
    classifyCell(at('45.67 USD'), currencyOff), { mode: 'skip', reason: 'currency' });
  eq('classifyCell: a unit number that is a whole link is skipped',
    classifyCell(at('7.5m', { isWholeLink: true }), LADDER_OPTS), { mode: 'skip', reason: 'link' });
  eq('classifyCell: an identifier is not a unit number',
    classifyCell(at('DT1234'), wordsOff), { mode: 'skip', reason: 'mixed-disabled' });
  eq('classifyCell: a plain currency number stays pure',
    classifyCell(at('$45.67'), wordsOff), { mode: 'pure', reason: 'simplify', value: { num: 45.67 } });
  // "4.91<sup>1</sup>tn" flattens to "4.911tn": the footnote digit must not
  // join the unit number.
  eq('classifyCell: a cell with a <sup> is not a unit number',
    classifyCell(at('4.911tn', { hasSuperscript: true, superscriptRanges: [{ start: 4, end: 5 }] }), wordsOff),
    { mode: 'skip', reason: 'mixed-disabled' });
})();

// On an HTML table a unit number rounds with the words setting off; only its
// digits change. Dataset: 4.91 (magnitude 0) and 45.67 (magnitude 1), so
// 45.67 takes the top band (step 5) and 4.91 the other band (step 0.5).
(function nativeTable_unitNumbersRoundWithWordsOff() {
  withCreateTreeWalker(function () {
    const table = makeMockTable([[
      { tag: 'td', text: '4.91tn' }, { tag: 'td', text: 'CAD45.67m' }, { tag: 'td', text: 'DT1234' },
    ]]);
    roundTable(table, Object.assign({}, DR_DEFAULTS, {
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedCells: false,
    }));
    eq('HTML table: unit numbers round with the words setting off and an identifier stays',
      table.rows[0].cells.map((cell) => cell.innerText), ['5tn', 'CAD45m', 'DT1234']);
  });
})();

(function getExclusionReason_currencyCodes() {
  const currencyOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false });
  eq('getExclusionReason: a listed code counts as a currency sign',
    getExclusionReason('CAD45.67m', 1, currencyOff, 1), 'currency');
  eq('getExclusionReason: a code inside a longer word does not count',
    getExclusionReason('CADENCE 12', 1, currencyOff, 1), null);
  eq('getExclusionReason: a code in lower case does not count',
    getExclusionReason('usd 12', 1, currencyOff, 1), null);
})();

(function pickDateFormatHint_and_resolveAmbiguousDateDecision() {
  eq('pickDateFormatHint: n1 > 12 only -> DMY', pickDateFormatHint([{ n1: 25, n2: 4 }]), 'DMY');
  eq('pickDateFormatHint: n2 > 12 only -> MDY', pickDateFormatHint([{ n1: 3, n2: 25 }]), 'MDY');
  eq('pickDateFormatHint: both > 12 across the column -> MIXED',
    pickDateFormatHint([{ n1: 25, n2: 4 }, { n1: 3, n2: 25 }]), 'MIXED');
  eq('pickDateFormatHint: neither > 12 -> AMBIGUOUS', pickDateFormatHint([{ n1: 3, n2: 4 }]), 'AMBIGUOUS');

  eq('resolveAmbiguousDateDecision: MDY resolves n1 as month, n2 as day',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } }, 'MDY'),
    { mode: 'date', reason: 'simplify', value: { month: 3, day: 4, year: 2020 } });
  eq('resolveAmbiguousDateDecision: DMY resolves n2 as month, n1 as day',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } }, 'DMY'),
    { mode: 'date', reason: 'simplify', value: { month: 4, day: 3, year: 2020 } });
  eq('resolveAmbiguousDateDecision: MIXED downgrades to skip',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 25, n2: 25, year: 2020 } } }, 'MIXED'),
    { mode: 'skip', reason: 'ambiguous-date' });
  eq('resolveAmbiguousDateDecision: AMBIGUOUS downgrades to skip',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } }, 'AMBIGUOUS'),
    { mode: 'skip', reason: 'ambiguous-date' });
})();

// --- 3. Divergence tests: merged (engine-wins) preview behavior ---
//
// Every fixture below hides its numeric data behind a TH header row and a TH
// label column so the first-row/first-column rule (itself one of the
// divergences, tested explicitly first) doesn't confound the others.

(function mergeLadderDivergence_outOfRange() {
  // OLD preview copy: collectNumericCells never parsed rangeExpr or checked
  // isInRanges — every numeric cell was sampled regardless of the sidebar's
  // range restriction. The merged ladder now applies isInRanges exactly like
  // the engine.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('123'), tdCell('456')] },
    ],
  };
  eq('merge-ladder divergence (no range restriction): both columns are sampled',
    collectNumericCells(table).map((c) => c.num).sort(), [123, 456]);
  eq('merge-ladder divergence (out-of-range): a rangeExpr restricts the sample to the in-range column',
    collectNumericCells(table, { rangeExpr: 'B:B' }).map((c) => c.num), [123]);
  eq('merge-ladder divergence (invalid range): an invalid range expression yields no samples, matching the engine which rounds nothing',
    collectNumericCells(table, { rangeExpr: 'not a range' }).length, 0);
})();

(function mergeLadderDivergence_firstRow() {
  // OLD preview copy: walked every <td> with no row/column awareness — a
  // numeric header-row <td> was sampled like any other cell. The merged
  // ladder applies getExclusionReason's first-row rule exactly like the
  // engine, whose DR_DEFAULTS ships simplifyFirstRow: false.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [tdCell('label'), tdCell('777')] }, // row 0
      { cells: [tdCell('label'), tdCell('888')] }, // row 1
    ],
  };
  eq('merge-ladder divergence (first-row): the row-0 numeric cell is excluded even though its column is not first',
    collectNumericCells(table).map((c) => c.num), [888]);
})();

(function mergeLadderDivergence_firstColumn() {
  // Same rule, isolated to the column axis (DR_DEFAULTS ships
  // simplifyFirstColumn: false too).
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [tdCell('999'), tdCell('999')] },  // row 0 — excluded by first-row regardless
      { cells: [tdCell('111'), tdCell('222')] },  // row 1: column 0 vs column 1
    ],
  };
  eq('merge-ladder divergence (first-column): the column-0 numeric cell is excluded even in a non-first row',
    collectNumericCells(table).map((c) => c.num), [222]);
})();

(function mergeLadderDivergence_percentGating() {
  // OLD preview copy: never checked simplifyMixedPercent — a percent cell was
  // always sampled as a pure number, even with the sidebar's percent toggle
  // off. The merged ladder applies getExclusionReason's percent rule.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('50%')] },
    ],
  };
  eq('merge-ladder divergence (percent on): percent cell is sampled',
    collectNumericCells(table, { simplifyMixedPercent: true }).map((c) => c.num), [50]);
  eq('merge-ladder divergence (percent off): percent cell is excluded from samples',
    collectNumericCells(table, { simplifyMixedPercent: false }).length, 0);
})();

(function mergeLadderDivergence_currencyGating() {
  // Same rule, currency symbols.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('$100')] },
    ],
  };
  eq('merge-ladder divergence (currency on): currency cell is sampled',
    collectNumericCells(table, { simplifyMixedCurrency: true }).map((c) => c.num), [100]);
  eq('merge-ladder divergence (currency off): currency cell is excluded from samples',
    collectNumericCells(table, { simplifyMixedCurrency: false }).length, 0);
})();

(function mergeLadderDivergence_quotedCell() {
  // OLD preview copy had no whole-cell-quote check — toNumber('"12345"')
  // fails (quotes aren't stripped), so it fell into the mixed-text fallback
  // and extractNumbersInText happily found "12345" inside the quotes,
  // sampling a cell the engine treats as literal text and never touches.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('"12345"')] },
    ],
  };
  eq('merge-ladder divergence (quoted cell): a whole-cell-quoted number is excluded from samples',
    collectNumericCells(table).length, 0);
})();

(function mergeLadderDivergence_quotedNumberInMixedText() {
  // OLD preview copy's mixed-text fallback never applied quote masking —
  // 'Product "42" ships in 10 days' would surface 42 (a quoted, literal
  // value) as a would-change sample alongside the real number 10.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('Product "42" ships in 10 days')] },
    ],
  };
  eq('merge-ladder divergence (quoted number in mixed text): only the unquoted number is sampled',
    collectNumericCells(table).map((c) => c.num), [10]);
})();

(function mergeLadderDivergence_wholeCellLink() {
  // OLD preview copy never called isCellWholeLink — a pure numeric cell whose
  // entire visible text is a hyperlink (e.g. a linked page number) was
  // sampled like any other pure number, even though the engine leaves it
  // untouched.
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const linkCell = makeLinkCell(['42'], null);
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), linkCell] },
    ],
  };
  eq('merge-ladder divergence (whole-cell link): a whole-cell-link number is excluded from samples',
    collectNumericCells(table).length, 0);
})();

(function mergeLadderDivergence_mixedTextLinkedNumber() {
  // OLD preview copy's mixed-text fallback never applied filterLinkMatches —
  // "<text> 42" with "42" wrapped in <a> would surface 42 as a sample the
  // engine never touches (filterLinkMatches drops it).
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const mixedLinkCell = makeLinkCell(['42'], 'See page for details');
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), mixedLinkCell] },
    ],
  };
  withLinkCreateTreeWalker(() => {
    eq('merge-ladder divergence (linked number in mixed text): a number inside <a> is excluded from samples',
      collectNumericCells(table).length, 0);
  });
})();

(function mergeLadderDivergence_superscriptMasking() {
  // OLD preview copy never checked cell.querySelector('sup') — a whole-cell
  // exponent like "10<sup>12</sup>" (flattened innerText "1012") was parsed
  // as the single pure number 1012, a wrong value the engine never produces
  // (the engine masks the exponent and, finding nothing left to round,
  // leaves the cell untouched entirely).
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  withSupCreateTreeWalker(() => {
    const supCell = makeSuperscriptCell([
      { text: '10', inSup: false },
      { text: '12', inSup: true },
    ]);
    const table = {
      rows: [
        { cells: [thCell(''), thCell('A')] },
        { cells: [thCell('Row'), supCell] },
      ],
    };
    eq('merge-ladder divergence (superscript exponent): a whole-cell exponent is excluded, not misread as 1012',
      collectNumericCells(table).length, 0);
  });
})();

(function mergeLadderDivergence_mixedCellsOption() {
  // OLD preview copy's mixed-text fallback ran unconditionally — it never
  // checked opts.simplifyMixedCells, so turning that sidebar toggle off had
  // no effect on the preview even though the engine would leave every mixed
  // cell untouched.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('Revenue: 5,000 units')] },
    ],
  };
  eq('merge-ladder divergence (mixed cells on): embedded number is sampled',
    collectNumericCells(table, { simplifyMixedCells: true }).map((c) => c.num), [5000]);
  eq('merge-ladder divergence (mixed cells off): embedded number is excluded from samples',
    collectNumericCells(table, { simplifyMixedCells: false }).length, 0);
})();

(function mergeLadderParity_datesAndTimesStillExcludedFromPreview() {
  // Deliberate, UNCHANGED scope restriction (not a divergence fix): the
  // preview band is about numeric magnitude/offset, so mode:'date' and
  // mode:'time' decisions from the ladder are excluded from the sample pool
  // even though the ladder classifies them and the engine would simplify
  // them. The old preview copy also excluded dates/times (via its own
  // isDateLike/isTimeLike/isDateTimeLike checks) — this is parity, not a fix.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('2020-01-01'), tdCell('3:45 PM')] },
    ],
  };
  eq('merge-ladder parity (dates/times): date and time cells are still excluded from preview samples',
    collectNumericCells(table, { simplifyTimes: true }).length, 0);
})();

// --- 4. Engine-path equivalence pin ---
//
// The divergence tests above pin the PREVIEW path against the merged ladder.
// They say nothing about the ENGINE path (roundTable's native-table loop),
// which is what actually writes values into a page. Before this sprint the
// native loop carried its own inline copy of every rule below; classifyCell
// now makes every one of those decisions instead. A single fixture that
// exercises several rules together, with the exact applied cell text pinned,
// catches a future change to the ladder's shared logic (rule order,
// max_mag interaction, formatting) that a per-rule unit test run in
// isolation would not: rules here interact through one shared max_mag pass
// and one shared column post-pass, same as on a real page.
//
// These values were captured by running this exact fixture through
// roundTable on both this branch and its pre-ladder parent branch (the two
// hand-kept-in-sync copies), confirming byte-identical output. This test
// pins that already-verified behavior against future drift; it does not
// re-derive it.
(function mergeLadderEnginePin_multiRuleNativeTable() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'th', text: '' }, { tag: 'th', text: 'A' }, { tag: 'th', text: 'B' },
       { tag: 'th', text: 'C' }, { tag: 'th', text: 'D' }, { tag: 'th', text: 'E' },
       { tag: 'th', text: 'F' }],
      [{ tag: 'th', text: 'Row' },
       { tag: 'td', text: '27,000,000' },        // plain, top band
       { tag: 'td', text: '4,080' },              // plain, other band
       { tag: 'td', text: '50%' },                // percent (gated on)
       { tag: 'td', text: '$1,234,000' },         // currency (gated on)
       { tag: 'td', text: '"98765"' },            // whole-cell quoted: untouched
       { tag: 'td', text: '2020-01-01' }],        // unambiguous ISO date
      [{ tag: 'th', text: 'Row2' },
       { tag: 'td', text: 'Revenue: 5,234,000 units' },  // mixed-text extraction
       { tag: 'td', text: 'Kalki 2898 AD' },              // era year: no surviving number
       { tag: 'td', text: '312' },                        // plain, shares max_mag with row 1
       { tag: 'td', text: '' }, { tag: 'td', text: '' }, { tag: 'td', text: '' }],
    ]);
    const opts = {
      enabled: true, simplifyFirstRow: false, simplifyFirstColumn: false,
      simplifyMixedPercent: true, simplifyMixedCurrency: true,
      simplifyDates: true, simplifyTimes: true, simplifyMixedCells: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
      dateGranularity: 'month', timeGranularity: 'hour',
    };
    roundTable(table, opts);
    const applied = table.rows.map((row) => row.cells.map((c) => c.textContent));
    eq('merge-ladder engine pin: multi-rule fixture applies the exact pinned values',
      applied, [
        ['', 'A', 'B', 'C', 'D', 'E', 'F'],
        ['Row', '25,000,000', '4,000', '50%', '$1,000,000', '"98765"', '2020'],
        ['Row2', 'Revenue: 5,000,000 units', 'Kalki 2898 AD', '300', '', '', ''],
      ]);
  });
})();

// --- Identifier shapes (issue #426) ---
//
// A cell whose whole text is an identifier shape (a phone number, an IP
// address, a web or email address, an ISBN, a postal code, or digit groups
// split by whitespace outside thousands grouping) stays as written. The
// "still rounds" rows pin the near misses each shape must leave alone.
const IDENTIFIER_SHAPE_CELLS = [
  ['416 555 1234', 'phone-number'],
  ['+1 416 555 1234', 'phone-number'],
  ['4165 5512', 'grouped-digits'],
  ['44 20 7946 0958', 'grouped-digits'],
  ['416-555-1234', 'phone-number'],
  ['416 555-1234', 'phone-number'],
  ['(416) 555-1234', 'phone-number'],
  ['(416) 555 1234', 'phone-number'],
  ['(416)555-1234', 'phone-number'],
  ['+1 (416) 555-1234', 'phone-number'],
  ['416.555.1234', 'phone-number'],
  ['1-800-555-0199', 'phone-number'],
  ['192.168.0.1', 'ip-address'],
  ['2001:db8::1', 'ip-address'],
  ['https://example.com/item/123', 'web-or-email-address'],
  ['www.example.com/p/12', 'web-or-email-address'],
  ['sales@example.com', 'web-or-email-address'],
  ['ISBN 978-0-306-40615-7', 'isbn'],
  ['978-0-306-40615-7', 'isbn'],
  ['ISBN: 0-306-40615-2', 'isbn'],
  ['ISBN 9780306406157', 'isbn'],
  ['M5V 2T6', 'postal-code'],
  ['SW1A 1AA', 'postal-code'],
  ['M1 1AE', 'postal-code'],
  ['90210-1234', 'postal-code'],
];
const IDENTIFIER_NEAR_MISSES = [
  '1 234 567', '12 345.67', '1 234 567', '1 234 567',
  '1 234 567 890', '9 780 306 406 157',
  '100-200', '192.5', '1.5', '90210', '1234567890', '9780306406157',
  '$1,613,245', '4.91tn', 'About 1,613,245 people',
];

(function identifierShapes_matchTheWholeCell() {
  for (const [text, name] of IDENTIFIER_SHAPE_CELLS) {
    eq(`identifier shape: "${text}" matches ${name}`, matchIdentifierShape(text), name);
    eq(`identifier shape: "${text}" is a skipped cell`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
      { mode: 'skip', reason: 'identifier' });
  }
  for (const text of IDENTIFIER_NEAR_MISSES) {
    eq(`identifier shape: "${text}" matches no shape`, matchIdentifierShape(text), null);
    eq(`identifier shape: "${text}" still rounds`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).mode !== 'skip', true);
  }
  eq('identifier shape: "DT1234" keeps its no-number reason',
    classifyCell({ text: 'DT1234', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'no-number' });
  eq('identifier shape: a date written with spaces still reads as a date',
    classifyCell({ text: '21 June 2020', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).mode, 'date');
})();

// --- Identifier shapes inside text (issue #465) ---
//
// Inside an extracted cell, a span matching an identifier shape holds its
// digits, and every other number in the cell rounds. Digit groups split by
// spaces alone stay whole-cell only: inside a sentence they are as likely to
// be two numbers side by side.
const IDENTIFIER_SPAN_CELLS = [
  ['Call 416-555-1234 about 1,613,245 units', ['1,613,245']],
  ['(416) 555-1234 ordered 918,554', ['918,554']],
  ['Dial +1 (416) 555-1234 for 263,114 refunds', ['263,114']],
  ['Fax 416.555.1234, 427,808 pages', ['427,808']],
  ['Call 416 555-1234 about 612,027 units', ['612,027']],
  ['Dial 1-800-555-0199 for 88,209 refunds', ['88,209']],
  ['Host 192.168.0.1 served 1,482,391 requests', ['1,482,391']],
  ['Host 2001:db8::1 served 947,310 requests', ['947,310']],
  ['See https://example.com/item/123 for 431,552 rows', ['431,552']],
  ['See (www.example.com/p/12) for 431,552 rows', ['431,552']],
  ['Mail 311@example.com about 270,987 orders', ['270,987']],
  ['ISBN 978-0-306-40615-7 sold 90,114 copies', ['90,114']],
  ['ISBN: 0-306-40615-2 sold 90,114 copies', ['90,114']],
  ['Ship to M5V 2T6, 1,506,220 parcels', ['1,506,220']],
  ['Ship to SW1A 1AA, 1,002,466 parcels', ['1,002,466']],
  ['Ship to 90210-1234, 440,193 parcels', ['440,193']],
];
const IDENTIFIER_SPAN_NEAR_MISSES = [
  ['Call 416 555 1234 about 281,745 units', ['416', '555', '1234', '281,745']],
  ['+1 416 555 1234 ordered 281,745', ['1', '416', '555', '1234', '281,745']],
  ['In 2024 12 stores opened', ['2024', '12']],
  ['978-0-306-40615-7 sold 90,114 copies', ['978', '306', '40615', '7', '90,114']],
  ['Call 416-555-12345 about 281,745 units', ['416', '555', '12345', '281,745']],
  ['Range 100-200 of 1,613,245', ['100', '200', '1,613,245']],
  ['Zip 90210 has 93,662 people', ['90210', '93,662']],
  ['Host 192.168.0.1.5 served 12 requests', ['192.168', '12']],
];

(function identifierShapes_holdTheirDigitsInsideText() {
  const extractedNumbers = (text) => {
    const decision = classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS);
    return decision.mode === 'extracted' ? decision.value.matches.map((m) => m.numStr) : decision;
  };
  for (const [text, expected] of IDENTIFIER_SPAN_CELLS) {
    eq(`identifier shape inside text: "${text}" rounds only its quantity`, extractedNumbers(text), expected);
  }
  for (const [text, expected] of IDENTIFIER_SPAN_NEAR_MISSES) {
    eq(`identifier shape inside text: "${text}" rounds every number`, extractedNumbers(text), expected);
  }
  eq('identifier shape inside text: "Call 416-555-1234" matches no whole-cell shape',
    matchIdentifierShape('Call 416-555-1234'), null);
  eq('identifier shape inside text: "Call 416-555-1234" holds no number to round',
    classifyCell({ text: 'Call 416-555-1234', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'no-number' });
  eq('identifier shape inside text: a footnote cell holds its phone number and rounds its quantity',
    extractSimplifyMatches('Call 416-555-1234 about 1,613,245 units1', [{ start: 39, end: 40 }]).map((m) => m.numStr),
    ['1,613,245']);
  eq('identifier shape inside text: a footnote marker right after a phone number leaves the phone number whole',
    extractSimplifyMatches('416-555-12341 about 1,613,245 units', [{ start: 12, end: 13 }]).map((m) => m.numStr),
    ['1,613,245']);
  eq('identifier shape inside text: ranges cover each span in the text',
    getIdentifierMaskedRanges('Call 416-555-1234 or sales@example.com'),
    [{ start: 5, end: 17 }, { start: 21, end: 38 }]);
  eq('identifier shape inside text: a text with no shape has no ranges',
    getIdentifierMaskedRanges('About 1,613,245 people'), []);
})();

// Every span pattern starts only where a shape can start and has no repeat
// that can match one character two ways, so a long text with many near
// starts takes time linear in its length.
(function identifierSpans_runInLinearTime() {
  const texts = [
    '-a'.repeat(50000),
    '1-'.repeat(50000),
    '1.'.repeat(50000),
    'a:'.repeat(50000),
    'x@'.repeat(50000),
    'ISBN 9'.repeat(20000),
    'A1'.repeat(50000),
    'ISBN' + ' '.repeat(100000) + 'x',
  ];
  const started = Date.now();
  for (const text of texts) getIdentifierMaskedRanges(text);
  eq('identifier shape inside text: eight 100,000-character texts scan in under a second',
    Date.now() - started < 1000, true);
  const wholeCellStarted = Date.now();
  matchIdentifierShape('ISBN' + ' '.repeat(100000) + 'x');
  eq('identifier shape: a 100,000-character cell after "ISBN" tests in under a second',
    Date.now() - wholeCellStarted < 1000, true);
})();

// A number right after "@" belongs to an at-name or an address, in any cell.
(function atNameNumbersNeverRound() {
  for (const text of ['@1234', '@2020vision', '@cherry1234', 'Follow @2020vision on X']) {
    eq(`at-name: "${text}" holds no number to round`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
      { mode: 'skip', reason: 'no-number' });
  }
  eq('at-name: a count beside an at-name still rounds, and the at-name stays',
    extractNumbersInText('@2020vision has 1,613,245 fans').map((m) => m.numStr), ['1,613,245']);
})();

(function identifierShapes_stayOnEveryTableKind() {
  // One row of identifiers beside one quantity, so the table has a number to
  // round and the identifiers are the only cells the rule holds back.
  const identifiers = ['416 555 1234', '(416) 555-1234', '192.168.0.1', 'M5V 2T6', 'ISBN 978-0-306-40615-7'];
  const quantity = '1,613,245';
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });

  // A cell with words holds its phone number and rounds its count (issue #465).
  const inText = 'Call 416-555-1234 about 1,613,245 units';
  const inTextRounded = 'Call 416-555-1234 about 1,500,000 units';

  withCreateTreeWalker(function() {
    const table = makeMockTable([[...identifiers, inText, quantity].map((text) => ({ tag: 'td', text }))]);
    roundTable(table, opts);
    eq('identifier shape (native table): identifiers stay as written and the quantity rounds',
      table.rows[0].cells.map((c) => c.textContent), [...identifiers, inTextRounded, '1,500,000']);
  });

  const grid = makeE2EGridWrapper([[...identifiers, inText, quantity]]);
  try {
    roundTable(grid.wrapperEl, opts);
    eq('identifier shape (grid): identifiers stay as written and the quantity rounds',
      grid.cellEls.map((cell) => pieceTextsOf(cell).join('')), [...identifiers, inTextRounded, '1,500,000']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }

  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const previewTable = {
    rows: [
      { cells: [thCell(''), ...identifiers.map(() => thCell('A')), thCell('B')] },
      { cells: [thCell('Row'), ...identifiers.map(tdCell), tdCell(quantity)] },
    ],
  };
  eq('identifier shape (sidebar preview): only the quantity is sampled',
    collectNumericCells(previewTable).map((c) => c.num), [1613245]);
})();

// --- Shared rounding case table (js/round-dynamic-cases.json) ---
//
// This table is generated from this package's own parsing/rounding path (the
// source of truth) and is also run against js/tests.js and python/tests/, so
// the three copies of dynamic rounding stay in agreement. Running it here
// too guards against future drift in this copy: it should pass by
// construction, since the table was generated by calling these very
// functions.
(function sharedCaseTable() {
  const sharedCaseGroups = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'round-dynamic-cases.json'), 'utf8')
  );

  // core.js declares these as module-local `const`s, which a direct eval
  // never leaks to the enclosing scope (only its function declarations do,
  // which is how toNumber/roundWithOffset/etc. above are reachable). Mirror
  // the documented defaults here rather than exposing another global just
  // for this test section.
  const SHARED_DEFAULT_OFFSET = -0.5;
  const SHARED_DEFAULT_NUM_TOP = 1;

  for (const group of sharedCaseGroups) {
    for (const c of group.cases) {
      const { input, params, expected } = c;
      const name = `[shared] ${group.description}: ${JSON.stringify(input)}`;
      if (Array.isArray(input)) {
        const oTop = params.offset_top === undefined ? SHARED_DEFAULT_OFFSET : params.offset_top;
        const oOther = params.offset_other === undefined ? oTop : params.offset_other;
        const nTop = params.num_top === undefined ? SHARED_DEFAULT_NUM_TOP : params.num_top;
        const nums = input.map((v) => toNumber(v));
        const maxMag = findMaxMagnitude([nums]);
        const actual = input.map((v, i) => roundCellSetAware(v, nums[i], maxMag, oTop, oOther, nTop));
        eq(name, actual, expected);
      } else {
        const offset = params.offset_top === undefined ? SHARED_DEFAULT_OFFSET : params.offset_top;
        const num = toNumber(input);
        const actual = num === null ? input : (num === 0 ? 0 : roundWithOffset(num, offset));
        eq(name, actual, expected);
      }
    }
  }
})();

