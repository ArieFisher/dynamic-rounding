/**
 * Test suite for chrome-extension content.js pure helpers.
 * Run: node tests.js
 *
 * Stubs out browser globals so we can eval content.js in Node and exercise
 * the pure functions (extractNumberInText, formatNumber, toNumber,
 * roundCellSetAware, findMaxMagnitude, pureNumberSpan).
 */

const fs = require('fs');
const path = require('path');

// The content script's one message listener, the bus's. The first
// registration is the content-script bundle's below; a later eval that
// leaves this stub in place registers a bus of its own, which stays out.
let contentMessageListener = null;
global.chrome = {
  runtime: {
    onMessage: { addListener: (fn) => { if (!contentMessageListener) contentMessageListener = fn; } },
    sendMessage: () => {}
  }
};

// Deliver one message to the content script the way Chrome hands the
// sidebar's request to it, and return the responder's answer. A request no
// responder answers returns undefined.
function askContentScript(message) {
  let answer;
  contentMessageListener(message, {}, (reply) => { answer = reply; });
  return answer;
}
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
// We also expose the per-table pillbox infrastructure declared with const/let
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
// Combined source for "source-includes" assertions that do not care which
// content-script file holds a symbol.
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
// Expose pillbox infrastructure for tests
globalThis.tableToggles = tableToggles;
globalThis.trackedTables = trackedTables;
// toggleStyleInjected is a let; expose a getter/setter so tests can reset it.
Object.defineProperty(globalThis, 'toggleStyleInjected', {
  get() { return toggleStyleInjected; },
  set(v) { toggleStyleInjected = v; },
  configurable: true,
});
// highlightStyleInjected is a let as well: the range-pulse CSS test resets it
// to capture the injection, and an apply earlier in the suite sets it.
Object.defineProperty(globalThis, 'highlightStyleInjected', {
  get() { return highlightStyleInjected; },
  set(v) { highlightStyleInjected = v; },
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
// Expose the pillbox geometry constants (all are const, so direct assignment works)
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
// lastRightClickedTable proxies the active table onto DR_STORE's
// getter/setter pair, exactly like the toggleStyleInjected/
// _globalTapCollapseAdded shims above proxy onto their own file-level lets.
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
globalThis.GRID_CELL_SELECTOR = GRID_CELL_SELECTOR;
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
// pending-table suites. The step returns outcomes findTables drops, so the
// suites read them here rather than through findTables.
globalThis.chainRootOf = chainRootOf;
globalThis.nominateNest = nominateNest;
globalThis.nominateNests = nominateNests;
// Expose the controller's pending-table state and the three functions that
// hold, re-test, and drop a pending record. The
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
// Expose the accessibility artifact predicate and its threshold constant for tests
globalThis.isPhantomA11yTable = isPhantomA11yTable;
globalThis.OFFSCREEN_LEFT_PX_THRESHOLD = DR_DETECTION_SETTINGS.offscreenLeftPx;
// Expose content.js's marker call-site wrapper for direct unit testing.
globalThis.markAndToggleIfNewGrid = markAndToggleIfNewGrid;
// Expose the DR_STORE-backed originals port so grid-adapter tests can build
// an adapter the same way roundTable and collectNumericCells do in
// production (registryAdapter) — a plain
// makeAdapter(el) with no opts uses lib/dr-table's private default port
// instead, which is invisible to DR_STORE and would make a test's setup
// silently diverge from what the real call sites do.
globalThis.registryOriginalsPort = registryOriginalsPort;
globalThis.restoreTable = restoreTable;
// resetTable is the one way back to raw, so tests reach the original values
// through it.
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
// it was opened for and acts only on messages from that tab, so a
// harness's tab-query stub and the sender it dispatches messages from have
// to name one number. Both read it here so they cannot drift.
const SIDEBAR_HARNESS_TAB = 42;
const FROM_SIDEBAR_TAB = { tab: { id: SIDEBAR_HARNESS_TAB } };

// The same observer stubs as above, installed again after the eval. Every
// test that calls createToggleForTable, which constructs a ResizeObserver,
// reads these.
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} };
global.Node = { ELEMENT_NODE: 1 };
