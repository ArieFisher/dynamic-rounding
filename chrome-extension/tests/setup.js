/**
 * Test suite for chrome-extension content.js pure helpers.
 * Run: node tests.js
 *
 * Stubs out browser globals so we can eval content.js in Node and exercise
 * the pure functions (extractNumberInText, formatExtractedNumber, toNumber,
 * roundCellSetAware, findMaxMagnitude, restoreFormatting).
 */

const fs = require('fs');
const path = require('path');

global.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: () => {}
  }
};
global.document = {
  addEventListener: () => {},
  querySelectorAll: () => [],   // injectTableToggles calls this; return empty list
  readyState: 'complete',       // prevents DOMContentLoaded deferral
  body: { appendChild: () => {}, observe: () => {} },
};
global.window = {
  addEventListener: () => {},
  // Default: table is visible (display=block, visibility=visible).
  // Tests that exercise the visibility gate override this temporarily.
  getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
};
global.NodeFilter = { SHOW_TEXT: 4 };

// DR_LOG (lib/dr-log) forwards every row to the real console so devtools
// output is unchanged; in this suite that forwarding would print a row for
// every instrumented call site straight into the test report. Mute the two
// forwarded levels the content scripts use. The dr-log forwarding test
// installs its own console.debug spy and puts this mute back. The report at
// the bottom prints through console.log, which stays untouched.
console.debug = () => {};
console.warn = () => {};

// Stub observer constructors BEFORE eval so that content.js module-level code
// (guarded by `typeof MutationObserver !== 'undefined'`) sees them and runs
// the initialisation block. The stubs are no-ops; tests never exercise the
// real observer callbacks.
global.MutationObserver = class { observe() {} disconnect() {} };
global.ResizeObserver  = class { observe() {} unobserve() {} disconnect() {} };
global.Node = { ELEMENT_NODE: 1 };

// In a browser/extension the content scripts share a single top-level scope,
// loaded in the order manifest.json lists them under content_scripts[0].js.
// Read that list from the manifest instead of hardcoding filenames, so
// renaming a content script only requires a manifest update. We evaluate
// them together here, and re-expose DR_DEFAULTS on globalThis so test
// assertions outside the eval can read it.
// We also expose the per-table toggle infrastructure declared with const/let
// inside the eval'd code so the auto-table-toggle test section can access them.
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contentScriptFiles = manifest.content_scripts[0].js;
// Map from manifest filename to its individual source text, built FROM the
// manifest list. A few tests still need one file's text by name (a patched
// copy of a single constant, or a fragment check scoped to one file) — they
// look it up here instead of re-reading the file.
const contentScriptSources = new Map(
  contentScriptFiles.map((file) => [file, fs.readFileSync(path.join(__dirname, file), 'utf8')])
);
// Manifest-safe accessor for one file's source. If a file gets renamed in
// manifest.json but a test section below still looks it up by its old
// literal name, this returns null instead of undefined — callers guard on
// null explicitly instead of letting `undefined` reach a vm.runInContext()
// string build or a String.prototype call and crash the whole suite.
function sourceByName(name) {
  return contentScriptSources.get(name) ?? null;
}
const contentScriptBundle = contentScriptFiles
  .map((file) => contentScriptSources.get(file))
  .join('\n');
const coreCode = sourceByName('lib/dr-number/core.js');
const parsingCode = sourceByName('lib/dr-number/parsing.js');
const detectCode = sourceByName('lib/dr-table/detect.js');
const ladderCode = sourceByName('lib/dr-simplify/ladder.js');
const constantsCode = sourceByName('constants.js');
// background.js pulls its files in with importScripts, which Node has no
// equivalent for, and several sections below eval a whole context file on its
// own. Stub the loader so those sites load.
global.importScripts = () => {};
const messagingCode = sourceByName('adapters/messaging.js');
const storeCode = sourceByName('app/store.js');
const uiToggleCode = sourceByName('ui-toggle.js');
// Combined source for "source-includes" assertions that no longer care which
// content-script file a symbol physically lives in after the Phase 2 split.
const allContentSrc = contentScriptBundle;
eval(contentScriptBundle + `
globalThis.DR_DEFAULTS = DR_DEFAULTS;
globalThis.DR_DETECTION_SETTINGS = DR_DETECTION_SETTINGS;
globalThis.DR_NUMBER = DR_NUMBER;
// Expose the log buffer (lib/dr-log) for the dr-log test suite.
globalThis.DR_LOG = DR_LOG;
// Expose the capture state serializer (lib/dr-capture) and its content.js
// wire-response composer for the capture test suites.
globalThis.collectCaptureState = collectCaptureState;
globalThis.buildCaptureStateResponse = buildCaptureStateResponse;
// Expose the capture format version so the capture-settings tests can pin the
// state's captureFormat against the source of truth instead of a literal.
globalThis.CAPTURE_FORMAT = CAPTURE_FORMAT;
// Expose the lib/dr-capture package bundle, mirroring DR_NUMBER above.
globalThis.DR_CAPTURE = DR_CAPTURE;
// Expose the renderer's glyph map so the glyph pin can compare it against
// the sidebar's buttons.
globalThis.CAPTURE_MARK_GLYPHS = CAPTURE_MARK_GLYPHS;
// Expose toggle infrastructure for tests
globalThis.tableToggles = tableToggles;
globalThis.trackedTables = trackedTables;
// toggleStyleInjected is a let; expose a getter/setter so tests can reset it.
Object.defineProperty(globalThis, 'toggleStyleInjected', {
  get() { return toggleStyleInjected; },
  set(v) { toggleStyleInjected = v; },
  configurable: true,
});
globalThis.isTableRounded = isTableRounded;
globalThis.syncSwitchForTable = syncSwitchForTable;
globalThis.positionToggle = positionToggle;
globalThis.createToggleForTable = createToggleForTable;
globalThis.injectTableToggles = injectTableToggles;
globalThis.injectTogglesForAddedNode = injectTogglesForAddedNode;
globalThis.isDataTable = isDataTable;
globalThis.collectNumericCells = collectNumericCells;
globalThis.extractPreviewSamples = extractPreviewSamples;
globalThis.isEraYear = isEraYear;
// The one currency list and what it derives, so the currency suite reads the
// canon rather than restating any part of it.
globalThis.CURRENCIES = CURRENCIES;
globalThis.CURRENCY_SIGNS = CURRENCY_SIGNS;
globalThis.CURRENCY_CODES = CURRENCY_CODES;
globalThis.CLEAN_REGEX = CLEAN_REGEX;
globalThis.DEFAULT_NUMERIC_PROBE = DEFAULT_NUMERIC_PROBE;
globalThis.eraYearDigitRanges = eraYearDigitRanges;
globalThis.formatStep = formatStep;
globalThis.stepForOffset = stepForOffset;
// Expose new toggle geometry constants (all are const, so direct assignment works)
globalThis.TOGGLE_DOT_PX = TOGGLE_DOT_PX;
globalThis.TOGGLE_PILL_WIDTH_PX = TOGGLE_PILL_WIDTH_PX;
globalThis.TOGGLE_PILL_HEIGHT_PX = TOGGLE_PILL_HEIGHT_PX;
globalThis.TOGGLE_KNOB_PX = TOGGLE_KNOB_PX;
globalThis.TOGGLE_KNOB_INSET_PX = TOGGLE_KNOB_INSET_PX;
globalThis.TOGGLE_KNOB_TRAVEL_PX = TOGGLE_KNOB_TRAVEL_PX;
globalThis.TOGGLE_HIT_PAD_PX = TOGGLE_HIT_PAD_PX;
globalThis.TOGGLE_DOT_OVERLAP_PX = TOGGLE_DOT_OVERLAP_PX;
globalThis.TOGGLE_DOT_OVERHANG_PX = TOGGLE_DOT_OVERHANG_PX;
globalThis.TOGGLE_COLOR_ON = TOGGLE_COLOR_ON;
globalThis.TOGGLE_COLOR_OFF = TOGGLE_COLOR_OFF;
globalThis.PILLBOX_AUTO_COLLAPSE_MS = PILLBOX_AUTO_COLLAPSE_MS;
// _globalTapCollapseAdded is a let; expose getter/setter so tests can reset it.
Object.defineProperty(globalThis, '_globalTapCollapseAdded', {
  get() { return _globalTapCollapseAdded; },
  set(v) { _globalTapCollapseAdded = v; },
  configurable: true,
});
// lastRightClickedTable no longer exists as a binding in content.js (sprint
// app-model-selection moved it into DR_STORE) — this shim keeps every
// existing test working unmodified by proxying the old name onto the
// store's getter/setter pair, exactly like the toggleStyleInjected/
// _globalTapCollapseAdded shims above proxy onto their own file-level lets.
//
// A second shim proxied a sidebarOpen field beside it. The 2026-09-14
// sidebar-state-removal design retired that field (#241), so the shim and
// every assignment to it are gone from this file.
Object.defineProperty(globalThis, 'lastRightClickedTable', {
  get() { return DR_STORE.getSelectedTable(); },
  set(v) { DR_STORE.setSelectedTable(v); },
  configurable: true,
});
// Expose the application model and event bus directly for the
// app-model-selection test suite.
globalThis.DR_STORE = DR_STORE;
globalThis.DR_BUS = DR_BUS;
// Expose the toast view for the toast test section.
globalThis.DR_TOAST = DR_TOAST;
// Expose grid-detection helpers for the grid-detection test suite.
globalThis.looksLikeGrid = looksLikeGrid;
globalThis.findTargetTable = findTargetTable;
globalThis.findTables = findTables;
// The shape fingerprint: the detection layer's reader and comparison, and
// the controller's two users of them — the teardown a mismatch runs and the
// check both entry points call.
globalThis.readTableFingerprint = readTableFingerprint;
globalThis.sameTableFingerprint = sameTableFingerprint;
globalThis.teardownTableEntry = teardownTableEntry;
globalThis.revalidateTableShape = revalidateTableShape;
// Expose TableAdapter abstraction for the grid-adapter test suite.
globalThis.makeAdapter = makeAdapter;
globalThis.NativeTableAdapter = NativeTableAdapter;
globalThis.GridAdapter = GridAdapter;
// Expose the lib/dr-table package bundle, mirroring DR_NUMBER below.
globalThis.DR_TABLE = DR_TABLE;
// Expose the lib/dr-simplify package bundle (the classification ladder),
// mirroring DR_NUMBER/DR_TABLE above.
globalThis.DR_SIMPLIFY = DR_SIMPLIFY;
globalThis.classifyCell = classifyCell;
globalThis.pickDateFormatHint = pickDateFormatHint;
globalThis.resolveAmbiguousDateDecision = resolveAmbiguousDateDecision;
globalThis.finalizeExtractedDecision = finalizeExtractedDecision;
globalThis.decisionToLegacyInfo = decisionToLegacyInfo;
// Expose grid-virtualization internals for the grid-virtualization test suite.
globalThis.reapplyRounding = reapplyRounding;
globalThis.simplifyTableCells = simplifyTableCells;
globalThis.registryAdapter = registryAdapter;
globalThis.GRID_TABLE_PASS = GRID_TABLE_PASS;
globalThis.reapplyObservers = reapplyObservers;
globalThis.reapplyTimers = reapplyTimers;
globalThis.GRID_REAPPLY_DEBOUNCE_MS = DR_DETECTION_SETTINGS.gridRedrawDelayMs;
// Expose the nomination step (lib/dr-table/detect.js) for the nesting and
// pending-table suites. The step reports outcomes findTables drops, so the
// suites read them here rather than through findTables.
globalThis.chainRootOf = chainRootOf;
globalThis.nominateNest = nominateNest;
globalThis.nominateNests = nominateNests;
// Expose the controller's pending-table state and the three functions that
// hold, re-test, and drop a pending record (sprint pending-retest). The
// content-script bundle evaluates in its own scope, so the pending suite
// reaches these names only through this list.
globalThis.consumeNominations = consumeNominations;
globalThis.holdPendingTable = holdPendingTable;
globalThis.retestPendingTable = retestPendingTable;
globalThis.dropPendingTable = dropPendingTable;
globalThis.pendingRoots = pendingRoots;
globalThis.pendingObservers = pendingObservers;
globalThis.pendingRetestTimers = pendingRetestTimers;
globalThis.pendingRetestCounts = pendingRetestCounts;
// Expose phantom a11y predicate and its threshold constant for tests
globalThis.isPhantomA11yTable = isPhantomA11yTable;
globalThis.OFFSCREEN_LEFT_PX_THRESHOLD = DR_DETECTION_SETTINGS.offscreenLeftPx;
// Expose content.js's badge/marker call-site wrapper (sprint extract-dr-table)
// for direct unit testing.
globalThis.markAndToggleIfNewGrid = markAndToggleIfNewGrid;
// Expose the DR_STORE-backed originals port (app-model-registry sprint) so
// grid-adapter tests can build an adapter the same way roundTable/
// collectNumericCells/computeGridRoundedValues do in production — a plain
// makeAdapter(el) with no opts uses lib/dr-table's private default port
// instead, which is invisible to DR_STORE and would make a test's setup
// silently diverge from what the real call sites do.
globalThis.registryOriginalsPort = registryOriginalsPort;
globalThis.restoreTable = restoreTable;
// resetTable is the one way off simplified since the 2026-09-14 sidebar-
// state-removal design retired the form flip that kept a table's markers
// (#241). Tests that used to reach the original values through that flip
// call this instead.
globalThis.resetTable = resetTable;
globalThis.applySidebarRounding = applySidebarRounding;
`);

let passed = 0;
let failed = 0;
const failures = [];

function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push({ name, actual, expected });
  }
}

// The tab every sidebar harness below binds to. The sidebar records the tab
// it was opened for and acts only on reports from that tab (issue #343), so
// a harness's tab-query stub and the sender it dispatches reports from have
// to name one number. Both read it here so they cannot drift.
const SIDEBAR_HARNESS_TAB = 42;
const FROM_SIDEBAR_TAB = { tab: { id: SIDEBAR_HARNESS_TAB } };

