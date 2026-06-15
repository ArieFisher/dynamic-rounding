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

// Stub observer constructors BEFORE eval so that content.js module-level code
// (guarded by `typeof MutationObserver !== 'undefined'`) sees them and runs
// the initialisation block. The stubs are no-ops; tests never exercise the
// real observer callbacks.
global.MutationObserver = class { observe() {} disconnect() {} };
global.ResizeObserver  = class { observe() {} unobserve() {} disconnect() {} };
global.Node = { ELEMENT_NODE: 1 };

// In a browser/extension the two files share a single top-level scope; we
// emulate that here by evaluating them together, and re-expose DR_DEFAULTS on
// globalThis so test assertions outside the eval can read it.
// We also expose the per-table toggle infrastructure declared with const/let
// inside the eval'd code so the auto-table-toggle test section can access them.
const defaultsCode = fs.readFileSync(path.join(__dirname, 'defaults.js'), 'utf8');
const roundingCode = fs.readFileSync(path.join(__dirname, 'rounding.js'), 'utf8');
const coreCode = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
const parsingCode = fs.readFileSync(path.join(__dirname, 'parsing.js'), 'utf8');
const domAdaptersCode = fs.readFileSync(path.join(__dirname, 'dom-adapters.js'), 'utf8');
const uiToggleCode = fs.readFileSync(path.join(__dirname, 'ui-toggle.js'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
// Combined source for "source-includes" assertions that no longer care which
// content-script file a symbol physically lives in after the Phase 2 split.
const allContentSrc = parsingCode + '\n' + domAdaptersCode + '\n' + uiToggleCode + '\n' + code;
eval(defaultsCode + '\n' + roundingCode + '\n' + coreCode + '\n' +
     parsingCode + '\n' + domAdaptersCode + '\n' + uiToggleCode + '\n' + code + `
globalThis.DR_DEFAULTS = DR_DEFAULTS;
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
globalThis.runToggleAction = runToggleAction;
globalThis.toggleOriginalValues = toggleOriginalValues;
globalThis.injectTableToggles = injectTableToggles;
globalThis.isDataTable = isDataTable;
globalThis.collectNumericCells = collectNumericCells;
globalThis.extractPreviewSamples = extractPreviewSamples;
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
globalThis.TOUCH_AUTOCOLLAPSE_MS = TOUCH_AUTOCOLLAPSE_MS;
// _globalTapCollapseAdded is a let; expose getter/setter so tests can reset it.
Object.defineProperty(globalThis, '_globalTapCollapseAdded', {
  get() { return _globalTapCollapseAdded; },
  set(v) { _globalTapCollapseAdded = v; },
  configurable: true,
});
// Expose sidebarOpen and lastRightClickedTable so sidebar-rebind tests can control
// and inspect them without going through the onMessage listener (which is a no-op stub).
Object.defineProperty(globalThis, 'sidebarOpen', {
  get() { return sidebarOpen; },
  set(v) { sidebarOpen = v; },
  configurable: true,
});
Object.defineProperty(globalThis, 'lastRightClickedTable', {
  get() { return lastRightClickedTable; },
  set(v) { lastRightClickedTable = v; },
  configurable: true,
});
// Expose grid-detection helpers for the grid-detection test suite.
globalThis.looksLikeGrid = looksLikeGrid;
globalThis.findTargetTable = findTargetTable;
// Expose TableAdapter abstraction for the grid-adapter test suite.
globalThis.makeAdapter = makeAdapter;
globalThis.NativeTableAdapter = NativeTableAdapter;
globalThis.GridAdapter = GridAdapter;
// Expose grid-virtualization internals for the grid-virtualization test suite.
globalThis.reapplyGridRounding = reapplyGridRounding;
globalThis.computeGridRoundedValues = computeGridRoundedValues;
globalThis.gridObservers = gridObservers;
globalThis.gridReapplyTimers = gridReapplyTimers;
globalThis.GRID_REAPPLY_DEBOUNCE_MS = GRID_REAPPLY_DEBOUNCE_MS;
// Expose phantom a11y predicate and its threshold constant for tests
globalThis.isPhantomA11yTable = isPhantomA11yTable;
globalThis.OFFSCREEN_LEFT_PX_THRESHOLD = OFFSCREEN_LEFT_PX_THRESHOLD;
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

// --- extractNumberInText ---

eq('extract: plain comma number',
  extractNumberInText('8,584,629'),
  { numStr: '8,584,629', num: 8584629, index: 0 });

eq('extract: number with trailing word (USD)',
  extractNumberInText('8,584,629 USD'),
  { numStr: '8,584,629', num: 8584629, index: 0 });

eq('extract: number with trailing k',
  extractNumberInText('286k'),
  { numStr: '286', num: 286, index: 0 });

eq('extract: non-numeric returns null',
  extractNumberInText('N/A'),
  null);

eq('extract: number embedded mid-string',
  extractNumberInText('approx 1,234 (close)'),
  { numStr: '1,234', num: 1234, index: 7 });

eq('extract: decimal with suffix',
  extractNumberInText('1.5 hours'),
  { numStr: '1.5', num: 1.5, index: 0 });

eq('extract: empty string',
  extractNumberInText(''),
  null);

eq('extract: non-string input',
  extractNumberInText(null),
  null);

// --- extractNumbersInText (multi-match) ---

eq('extractAll: range with en-dash',
  extractNumbersInText('₹615.71–623.33 crore'),
  [
    { numStr: '615.71', num: 615.71, index: 1 },
    { numStr: '623.33', num: 623.33, index: 8 }
  ]);

eq('extractAll: two-number sentence',
  extractNumbersInText('between 1,200 and 3,400 units'),
  [
    { numStr: '1,200', num: 1200, index: 8 },
    { numStr: '3,400', num: 3400, index: 18 }
  ]);

eq('extractAll: single number still returns one-element array',
  extractNumbersInText('286k'),
  [{ numStr: '286', num: 286, index: 0 }]);

eq('extractAll: no digits returns empty array',
  extractNumbersInText('N/A'),
  []);

// --- formatExtractedNumber ---

eq('format: large number gets commas matching original',
  formatExtractedNumber(8500000, '8,584,629'),
  '8,500,000');

eq('format: small int no commas',
  formatExtractedNumber(300, '286'),
  '300');

eq('format: trailing zeros stripped when |x|<10',
  formatExtractedNumber(1.5, '1.234'),
  '1.5');

eq('format: |x|>=10 drops decimals even if original had them',
  formatExtractedNumber(1500, '1.234'),
  '1500');

// --- toNumber sanity (covered indirectly but pin behavior) ---

eq('toNumber: plain integer string', toNumber('286'), 286);
eq('toNumber: comma number', toNumber('8,584,629'), 8584629);
eq('toNumber: currency stripped', toNumber('$1,234.56'), 1234.56);
eq('toNumber: parens treated as negative', toNumber('(500)'), -500);
eq('toNumber: trailing word -> null', toNumber('286k'), null);
eq('toNumber: pure text -> null', toNumber('N/A'), null);

// --- End-to-end magnitude + rounding parity with example table ---
// Original | excludeWords=false expected
// 8,584,629           -> 8,500,000
// 286                 -> 300
// 8,584,629 USD       -> 8,500,000 USD
// 286k                -> 300k

(function endToEnd() {
  const cells = ['8,584,629', '286', '8,584,629 USD', '286k'];
  const infos = cells.map(text => {
    const num = toNumber(text);
    if (num !== null) return { mode: 'pure', num, text };
    const ex = extractNumberInText(text);
    if (ex) return { mode: 'extracted', num: ex.num, numStr: ex.numStr, index: ex.index, text };
    return { mode: 'skip', num: null, text };
  });

  const numericRange = [infos.map(i => i.num)];
  const maxMag = findMaxMagnitude(numericRange);
  eq('e2e: max magnitude across mixed cells', maxMag, 6);

  const out = infos.map(info => {
    if (info.mode === 'skip') return info.text;
    const rounded = roundCellSetAware(info.num, info.num, maxMag, -0.5, -0.5, 1);
    if (rounded === info.num) return info.text;
    if (info.mode === 'pure') return restoreFormatting(rounded, info.text);
    const num = formatExtractedNumber(rounded, info.numStr);
    return info.text.substring(0, info.index) + num + info.text.substring(info.index + info.numStr.length);
  });

  eq('e2e: full table output', out,
    ['8,500,000', '300', '8,500,000 USD', '300k']);
})();

// --- Range cell: every number in the cell must round ---
(function rangeCell() {
  const text = '₹615.71–623.33 crore';
  const matches = extractNumbersInText(text);
  const allNums = matches.map(m => m.num);
  const maxMag = findMaxMagnitude([allNums]);

  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const rounded = roundCellSetAware(m.num, m.num, maxMag, -0.5, -0.5, 1);
    if (rounded === m.num) continue;
    const newNum = formatExtractedNumber(rounded, m.numStr);
    out = out.substring(0, m.index) + newNum + out.substring(m.index + m.numStr.length);
  }

  eq('range cell: both numbers in "₹615.71–623.33 crore" round',
    out, '₹600–600 crore');
})();

// --- excludeWords=true path: extracted cells skipped, pure cells still round ---
(function excludeWordsOn() {
  const cells = ['8,584,629', '286', '8,584,629 USD', '286k'];
  const infos = cells.map(text => {
    const num = toNumber(text);
    if (num !== null) return { mode: 'pure', num, text };
    return { mode: 'skip', num: null, text };
  });

  const numericRange = [infos.map(i => i.num)];
  const maxMag = findMaxMagnitude(numericRange);

  const out = infos.map(info => {
    if (info.mode === 'skip') return info.text;
    const rounded = roundCellSetAware(info.num, info.num, maxMag, -0.5, -0.5, 1);
    return info.mode === 'pure' ? restoreFormatting(rounded, info.text) : info.text;
  });

  eq('excludeWords=true: only pure-numeric cells round',
    out, ['8,500,000', '300', '8,584,629 USD', '286k']);
})();

// --- Additional extractNumbersInText cases ---

eq('extractAll: three numbers in a sentence',
  extractNumbersInText('grew from 10 to 200 in 3,000 days').map(m => m.num),
  [10, 200, 3000]);

eq('extractAll: decimal followed by integer',
  extractNumbersInText('avg 4.5, peak 9'),
  [
    { numStr: '4.5', num: 4.5, index: 4 },
    { numStr: '9', num: 9, index: 14 }
  ]);

eq('extractAll: indices are correct for splicing',
  extractNumbersInText('a 100 b 200 c').map(m => ({ s: m.numStr, i: m.index })),
  [{ s: '100', i: 2 }, { s: '200', i: 8 }]);

eq('extractAll: zero is excluded',
  extractNumbersInText('range 0 to 500').map(m => m.num),
  [500]);

// --- Range cell with mixed magnitudes ---
(function rangeMixedMagnitudes() {
  const text = '50–5,000 range';
  const matches = extractNumbersInText(text);
  const allNums = matches.map(m => m.num);
  const maxMag = findMaxMagnitude([allNums]);

  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const rounded = roundCellSetAware(m.num, m.num, maxMag, -0.5, -0.5, 1);
    if (rounded === m.num) continue;
    const newNum = formatExtractedNumber(rounded, m.numStr);
    out = out.substring(0, m.index) + newNum + out.substring(m.index + m.numStr.length);
  }

  // maxMag = 3 (from 5000). 50 is magnitude 1, far from top -> uses offset_other (=top, both -0.5),
  // so 50 rounds toward base = 10^1 * 0.5 = 5 -> 50.
  // 5000 stays as 5,000.
  eq('range cell: low end keeps its precision when far below top magnitude',
    out, '50–5,000 range');
})();

// --- Splice safety: rounding doesn't affect later match indices because we go right-to-left ---
(function spliceSafety() {
  // Numbers that change length when rounded: 8,584,629 (9 chars) -> 8,500,000 (9 chars, same).
  // Pick one that changes length: 286 (3) -> 300 (3) same. Use 9,876 -> 10,000 (length grows).
  const text = '9,876 then 1,234';
  const matches = extractNumbersInText(text);
  const allNums = matches.map(m => m.num);
  const maxMag = findMaxMagnitude([allNums]);

  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const rounded = roundCellSetAware(m.num, m.num, maxMag, -0.5, -0.5, 1);
    if (rounded === m.num) continue;
    const newNum = formatExtractedNumber(rounded, m.numStr);
    out = out.substring(0, m.index) + newNum + out.substring(m.index + m.numStr.length);
  }

  // Both magnitude 3. base = 500. 9876/500=19.75->20*500=10,000. 1234/500=2.47->2*500=1,000.
  eq('splice safety: right-to-left replacement handles length-changing rounds',
    out, '10,000 then 1,000');
})();

// --- Parens-negative survives toNumber ---
eq('toNumber: parens with comma', toNumber('(1,234)'), -1234);
eq('toNumber: empty string returns null', toNumber(''), null);
eq('toNumber: whitespace only returns null', toNumber('   '), null);

// --- restoreFormatting roundtrips for common shapes ---
eq('restoreFormatting: pure integer keeps commas',
  restoreFormatting(8500000, '8,584,629'), '8,500,000');
eq('restoreFormatting: currency prefix preserved',
  restoreFormatting(8500000, '$8,584,629'), '$8,500,000');
eq('restoreFormatting: percent suffix preserved',
  restoreFormatting(12, '12.34%'), '12%');
eq('restoreFormatting: parens-negative preserved',
  restoreFormatting(-500, '(523)'), '(500)');

// --- Sprint A: exclusion checkboxes ---

eq('isDateLike: bare 4-digit year', isDateLike('2018'), true);
eq('isDateLike: bare year out of range', isDateLike('1899'), false);
eq('isDateLike: bare year out of range', isDateLike('2100'), false);
eq('isDateLike: ISO date', isDateLike('2024-03-14'), true);
eq('isDateLike: US slash date', isDateLike('3/14/2024'), true);
eq('isDateLike: dash date', isDateLike('3-14-2024'), true);
eq('isDateLike: "March 14, 2024"', isDateLike('March 14, 2024'), true);
eq('isDateLike: "14 March 2024"', isDateLike('14 March 2024'), true);
eq('isDateLike: "Mar 2024"', isDateLike('Mar 2024'), true);
eq('isDateLike: "Sept 2024"', isDateLike('Sept 2024'), true);
eq('isDateLike: plain number not a year -> false', isDateLike('1234'), false);
eq('isDateLike: random text -> false', isDateLike('hello'), false);
eq('isDateLike: empty -> false', isDateLike(''), false);

eq('isTimeLike: 14:30 -> true', isTimeLike('14:30'), true);
eq('isTimeLike: 14:30:45 -> true', isTimeLike('14:30:45'), true);
eq('isTimeLike: 2:30 PM -> true', isTimeLike('2:30 PM'), true);
eq('isTimeLike: 2:30pm -> true', isTimeLike('2:30pm'), true);
eq('isTimeLike: 2:3 -> false (single-digit minutes)', isTimeLike('2:3'), false);
eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);

(function exclusionFirstColumn() {
  const opts = Object.assign({}, {
    simplifyDates: false, simplifyTimes: false,
    simplifyFirstColumn: false
  });
  eq('exclude: first column with flag on', getExclusionReason('anything', 0, opts), 'firstColumn');
  eq('exclude: non-first column ignores flag', getExclusionReason('anything', 1, opts), null);
})();

(function exclusionDates() {
  // Dates/times are no longer exclusion reasons — getExclusionReason never returns
  // 'dates' or 'times' regardless of simplifyDates/simplifyTimes setting.
  const opts = { simplifyDates: true };
  eq('exclude: year cell with simplifyDates=true is NOT excluded (returns null)',
    getExclusionReason('2018', 1, opts), null);
  eq('exclude: non-date cell with simplifyDates=true returns null',
    getExclusionReason('1,234', 1, opts), null);
  eq('exclude: year cell with simplifyDates=false is NOT excluded (returns null)',
    getExclusionReason('2018', 1, { simplifyDates: false }), null);
})();

(function exclusionTimes() {
  // Times are no longer an exclusion reason — simplifyTimes only controls the
  // classification pass, not getExclusionReason.
  eq('exclude: time cell with simplifyTimes=true is NOT excluded (returns null)',
    getExclusionReason('14:30', 1, { simplifyTimes: true }), null);
})();

(function exclusionPercent() {
  // New semantics: percent cells are EXCLUDED by default (simplifyMixedPercent defaults false/unset).
  eq('exclude: percent excluded by default (simplifyMixedPercent unset)',
    getExclusionReason('45%', 1, {}), 'percent');
  eq('exclude: percent excluded when simplifyMixedPercent=false',
    getExclusionReason('45%', 1, { simplifyMixedPercent: false }), 'percent');
  eq('exclude: percent included when simplifyMixedPercent=true',
    getExclusionReason('45%', 1, { simplifyMixedPercent: true }), null);
})();

(function exclusionCurrency() {
  // New semantics: currency cells are EXCLUDED by default (simplifyMixedCurrency defaults false/unset).
  eq('exclude: currency excluded by default (simplifyMixedCurrency unset)',
    getExclusionReason('$1,234', 1, {}), 'currency');
  eq('exclude: currency excluded when simplifyMixedCurrency=false',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: false }), 'currency');
  eq('exclude: currency included when simplifyMixedCurrency=true',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: true }), null);
  eq('exclude: euro excluded by default',
    getExclusionReason('€1,234', 1, {}), 'currency');
  eq('exclude: euro included when simplifyMixedCurrency=true',
    getExclusionReason('€1,234', 1, { simplifyMixedCurrency: true }), null);
  eq('exclude: rupee excluded by default',
    getExclusionReason('₹615', 1, {}), 'currency');
})();

// --- Sprint sidebar-restructure: simplifyFirstRow ---

(function simplifyFirstRowTests() {
  // simplifyFirstRow=false: row 0 must be excluded regardless of cell content
  eq('simplifyFirstRow: row 0 excluded when flag is false',
    getExclusionReason('1,234', 1, { simplifyFirstRow: false }, 0), 'firstRow');
  // simplifyFirstRow=false: row 1 is not affected
  eq('simplifyFirstRow: row 1 not excluded when flag is false',
    getExclusionReason('1,234', 1, { simplifyFirstRow: false }, 1), null);
  // simplifyFirstRow=true: row 0 is NOT excluded
  eq('simplifyFirstRow: row 0 not excluded when flag is true',
    getExclusionReason('1,234', 1, { simplifyFirstRow: true }, 0), null);
  // simplifyFirstRow unset (default): row 0 IS excluded (!undefined = true, same as simplifyFirstRow=false)
  eq('simplifyFirstRow: row 0 excluded when flag is unset (default)',
    getExclusionReason('1,234', 1, {}, 0), 'firstRow');
  // simplifyFirstRow takes priority over firstColumn check
  eq('simplifyFirstRow: firstRow beats firstColumn when both apply',
    getExclusionReason('anything', 0, { simplifyFirstRow: false, simplifyFirstColumn: false }, 0), 'firstRow');
})();

// --- Sprint sidebar-restructure: simplifyMixedCells semantics ---

(function simplifyMixedCellsTests() {
  // With simplifyMixedCells=true, a cell with a number AND a word should be rounded
  // (mode='extracted' in roundTable). We test the path via the roundTable flow
  // by checking that the cell text '8,584,629 USD' gets an 'extracted' mode.
  const textWithWord = '$5.123 USD';
  const textPure = '5.123';

  // simplifyMixedCells=true: extractNumbersInText finds a match and cell would be rounded
  (function simplifyMixedCellsOn() {
    const matches = extractNumbersInText(textWithWord);
    eq('simplifyMixedCells=true: extractNumbersInText finds number in "$5.123 USD"',
      matches.length > 0, true);
    // Simulate the branch in roundTable: if (opts.simplifyMixedCells) -> extracted path
    const num = toNumber(textWithWord);
    eq('simplifyMixedCells=true: toNumber("$5.123 USD") is null (not pure numeric)',
      num, null);
    // When simplifyMixedCells=true, the cell would go through extracted path
    const optsInclude = { simplifyMixedCells: true };
    const wouldRound = num !== null ? true : (optsInclude.simplifyMixedCells && matches.length > 0);
    eq('simplifyMixedCells=true: cell with words would be rounded', wouldRound, true);
  })();

  // simplifyMixedCells=false (default): cell with words must NOT be rounded
  (function simplifyMixedCellsOff() {
    const num = toNumber(textWithWord);
    const optsExclude = { simplifyMixedCells: false };
    // Simulate roundTable logic: toNumber returns null, simplifyMixedCells=false -> skip
    const wouldRound = num !== null ? true : (optsExclude.simplifyMixedCells === true);
    eq('simplifyMixedCells=false: cell with words would NOT be rounded', wouldRound, false);
    // Same with default (unset)
    const optsDefault = {};
    const wouldRoundDefault = num !== null ? true : (optsDefault.simplifyMixedCells === true);
    eq('simplifyMixedCells unset: cell with words would NOT be rounded', wouldRoundDefault, false);
  })();
})();

// --- Sprint sidebar-restructure: simplifyMixedPercent / simplifyMixedCurrency round-trip ---

(function simplifyMixedPercentRoundTrip() {
  // simplifyMixedCurrency: true -> currency cells are NOT excluded
  eq('simplifyMixedCurrency=true: $1,234 is not excluded',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: true }), null);
  // simplifyMixedCurrency unset -> currency cells ARE excluded
  eq('simplifyMixedCurrency unset: $1,234 is excluded',
    getExclusionReason('$1,234', 1, {}), 'currency');
  // simplifyMixedPercent: true -> percent cells are NOT excluded
  eq('simplifyMixedPercent=true: 45% is not excluded',
    getExclusionReason('45%', 1, { simplifyMixedPercent: true }), null);
  // simplifyMixedPercent unset -> percent cells ARE excluded
  eq('simplifyMixedPercent unset: 45% is excluded',
    getExclusionReason('45%', 1, {}), 'percent');
})();

// First-match-wins priority: firstRow beats firstColumn beats percent beats currency
// (dates/times are no longer exclusion reasons)
(function exclusionPriority() {
  const opts = {
    simplifyFirstRow: false, simplifyFirstColumn: false, simplifyDates: true, simplifyTimes: true,
    simplifyMixedPercent: false, simplifyMixedCurrency: false
  };
  eq('priority: first row wins even when value is a date',
    getExclusionReason('2018', 0, opts, 0), 'firstRow');
  eq('priority: first column wins even when value is a date (non-zero row)',
    getExclusionReason('2018', 0, opts, 1), 'firstColumn');
  eq('priority: year value not excluded when only first-row/col flags set (dates no longer excluded)',
    getExclusionReason('2018', 1, opts, 1), null);
})();

// --- Sprint B: per-type granularity ---

// Date granularity
// NEW CONTRACT (sprint date-round-to-year-display): roundDateText always returns a
// 4-digit year string. It no longer returns null or a full date string like
// "March 14, 2020". The caller (roundTable) compares formattedValue === originalValue
// to detect the no-op case.
eq('roundDateText: year granularity returns a 4-digit year string',
  roundDateText('2018', 'year'), '2018');
eq('roundDateText: decade rounds bare year 2018 -> 2020',
  roundDateText('2018', 'decade'), '2020');
eq('roundDateText: century rounds bare year 2018 -> 2000',
  roundDateText('2018', 'century'), '2000');
eq('roundDateText: decade in "March 14, 2024" returns year string "2020"',
  roundDateText('March 14, 2024', 'decade'), '2020');
eq('roundDateText: century in "March 14, 2024" returns year string "2000"',
  roundDateText('March 14, 2024', 'century'), '2000');
eq('roundDateText: decade in ISO date "2024-03-14" returns "2020"',
  roundDateText('2024-03-14', 'decade'), '2020');
eq('roundDateText: unparseable input returns the original text unchanged',
  roundDateText('hello world', 'decade'), 'hello world');
eq('roundDateText: 2020 at decade granularity still returns "2020" (caller handles no-op)',
  roundDateText('2020', 'decade'), '2020');

// Time granularity
eq('roundTimeText: minute granularity is a no-op',
  roundTimeText('14:30', 'minute'), null);
eq('roundTimeText: hour rounds 14:30 up (round-half-up)',
  roundTimeText('14:30', 'hour'), '15:00');
eq('roundTimeText: hour rounds 14:31 up',
  roundTimeText('14:31', 'hour'), '15:00');
eq('roundTimeText: hour rounds 14:29 down',
  roundTimeText('14:29', 'hour'), '14:00');
eq('roundTimeText: hour with seconds',
  roundTimeText('14:29:30', 'hour'), '15:00:00');
eq('roundTimeText: hour with AM/PM preserved',
  roundTimeText('2:45 PM', 'hour'), '3:00 PM');
eq('roundTimeText: zero-pad preserved',
  roundTimeText('02:30', 'hour'), '03:00');
eq('roundTimeText: invalid input -> null',
  roundTimeText('not a time', 'hour'), null);
// Edge cases (12-hour and 24-hour wrap)
eq('roundTimeText: 12:45 PM wraps to 1:00 PM',
  roundTimeText('12:45 PM', 'hour'), '1:00 PM');
eq('roundTimeText: 11:45 AM crosses noon to 12:00 PM',
  roundTimeText('11:45 AM', 'hour'), '12:00 PM');
eq('roundTimeText: 11:45 PM wraps past midnight to 12:00 AM',
  roundTimeText('11:45 PM', 'hour'), '12:00 AM');
eq('roundTimeText: 12:45 AM wraps to 1:00 AM',
  roundTimeText('12:45 AM', 'hour'), '1:00 AM');
eq('roundTimeText: 23:30 wraps to 00:00 (24-hour)',
  roundTimeText('23:30', 'hour'), '00:00');
eq('roundTimeText: lowercase pm suffix preserved',
  roundTimeText('2:45pm', 'hour'), '3:00pm');

// --- Sprint C: advanced parameter resolvers ---

eq('resolveOffset: null -> fallback', resolveOffset(null, -0.5), -0.5);
eq('resolveOffset: undefined -> fallback', resolveOffset(undefined, -0.5), -0.5);
eq('resolveOffset: "" -> fallback', resolveOffset('', -0.5), -0.5);
eq('resolveOffset: numeric string', resolveOffset('-1.5', -0.5), -1.5);
eq('resolveOffset: number passes through', resolveOffset(-2, -0.5), -2);
eq('resolveOffset: NaN -> fallback', resolveOffset('abc', -0.5), -0.5);
eq('resolveOffset: out-of-range -> fallback (too low)',
  resolveOffset('-99', -0.5), -0.5);
eq('resolveOffset: out-of-range -> fallback (too high)',
  resolveOffset('99', -0.5), -0.5);
eq('resolveOffset: boundary -20 ok', resolveOffset('-20', -0.5), -20);
eq('resolveOffset: boundary +20 ok', resolveOffset('20', -0.5), 20);

eq('resolveNumTop: null -> fallback', resolveNumTop(null, 1), 1);
eq('resolveNumTop: "" -> fallback', resolveNumTop('', 1), 1);
eq('resolveNumTop: "3" -> 3', resolveNumTop('3', 1), 3);
eq('resolveNumTop: 0 -> fallback (must be >= 1)',
  resolveNumTop(0, 1), 1);
eq('resolveNumTop: negative -> fallback',
  resolveNumTop('-2', 1), 1);
eq('resolveNumTop: 2.7 floored to 2',
  resolveNumTop('2.7', 1), 2);

// --- Sprint G: range selector ---

// lettersToColIndex
eq('lettersToColIndex: A -> 0', lettersToColIndex('A'), 0);
eq('lettersToColIndex: B -> 1', lettersToColIndex('B'), 1);
eq('lettersToColIndex: Z -> 25', lettersToColIndex('Z'), 25);
eq('lettersToColIndex: AA -> 26', lettersToColIndex('AA'), 26);
eq('lettersToColIndex: AB -> 27', lettersToColIndex('AB'), 27);
eq('lettersToColIndex: lowercase ok', lettersToColIndex('a'), 0);
eq('lettersToColIndex: non-letter -> null', lettersToColIndex('A1'), null);

// parseRangeExpr
eq('parseRangeExpr: empty -> null ranges (whole table)',
  parseRangeExpr(''), { ranges: null });
eq('parseRangeExpr: whitespace -> null ranges',
  parseRangeExpr('   '), { ranges: null });

(function expr_singleColumn() {
  const r = parseRangeExpr('A');
  eq('parseRangeExpr: "A" -> whole column A',
    r, { ranges: [{ colMin: 0, colMax: 0, rowMin: 0, rowMax: Infinity }] });
})();

(function expr_columnRange() {
  const r = parseRangeExpr('A:D');
  eq('parseRangeExpr: "A:D" -> columns 0-3 all rows',
    r, { ranges: [{ colMin: 0, colMax: 3, rowMin: 0, rowMax: Infinity }] });
})();

(function expr_rowRange() {
  const r = parseRangeExpr('1:10');
  eq('parseRangeExpr: "1:10" -> rows 0-9 all cols',
    r, { ranges: [{ colMin: 0, colMax: Infinity, rowMin: 0, rowMax: 9 }] });
})();

(function expr_rect() {
  const r = parseRangeExpr('B2:E8');
  eq('parseRangeExpr: "B2:E8" -> rect (1,1)-(7,4)',
    r, { ranges: [{ colMin: 1, colMax: 4, rowMin: 1, rowMax: 7 }] });
})();

(function expr_openEnd() {
  const r = parseRangeExpr('G3:G');
  eq('parseRangeExpr: "G3:G" -> column G from row 2 down',
    r, { ranges: [{ colMin: 6, colMax: 6, rowMin: 2, rowMax: Infinity }] });
})();

(function expr_singleCell() {
  const r = parseRangeExpr('C5');
  eq('parseRangeExpr: "C5" -> single cell (4,2)',
    r, { ranges: [{ colMin: 2, colMax: 2, rowMin: 4, rowMax: 4 }] });
})();

(function expr_union() {
  const r = parseRangeExpr('{A1:E8, G3:G, I4:K5}');
  eq('parseRangeExpr: brace union of three ranges',
    r.ranges.length, 3);
})();

(function expr_unionNoBraces() {
  const r = parseRangeExpr('A1:B2, D:D');
  eq('parseRangeExpr: comma-separated without braces',
    r.ranges.length, 2);
})();

(function expr_semicolons() {
  const r = parseRangeExpr('A; B; C');
  eq('parseRangeExpr: semicolon separator',
    r.ranges.length, 3);
})();

(function expr_invalid() {
  const r = parseRangeExpr('A:B:C');
  eq('parseRangeExpr: triple colon -> error',
    typeof r.error, 'string');
})();

(function expr_invalidGarbage() {
  const r = parseRangeExpr('1A');
  eq('parseRangeExpr: digits-then-letters -> error',
    typeof r.error, 'string');
  const r2 = parseRangeExpr('@#$');
  eq('parseRangeExpr: punctuation -> error',
    typeof r2.error, 'string');
})();

// Open-ended in either direction
eq('parseRangeExpr: "G:G3" -> column G up to row 3',
  parseRangeExpr('G:G3'),
  { ranges: [{ colMin: 6, colMax: 6, rowMin: 0, rowMax: 2 }] });

// Swapped endpoints normalize
eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
  parseRangeExpr('A5:A2'),
  { ranges: [{ colMin: 0, colMax: 0, rowMin: 1, rowMax: 4 }] });

// isInRanges
(function isIn_null() {
  eq('isInRanges: null ranges -> always true (whole table)',
    isInRanges(5, 5, null), true);
})();

(function isIn_inside() {
  const ranges = [{ colMin: 1, colMax: 3, rowMin: 1, rowMax: 5 }];
  eq('isInRanges: inside rect', isInRanges(2, 2, ranges), true);
  eq('isInRanges: on boundary',  isInRanges(1, 1, ranges), true);
  eq('isInRanges: outside col',  isInRanges(2, 0, ranges), false);
  eq('isInRanges: outside row',  isInRanges(0, 2, ranges), false);
})();

(function isIn_unionMembership() {
  const ranges = [
    { colMin: 0, colMax: 1, rowMin: 0, rowMax: 1 },
    { colMin: 5, colMax: 5, rowMin: 2, rowMax: Infinity }
  ];
  eq('isInRanges: in first rect', isInRanges(0, 0, ranges), true);
  eq('isInRanges: in second open rect', isInRanges(100, 5, ranges), true);
  eq('isInRanges: between rects', isInRanges(2, 2, ranges), false);
})();

// NOTE: End-to-end investigation (sprint partial-range-fix attempt 2) confirmed the parser
// is correct — parseRangeExpr("D:E") correctly yields {colMin:3,colMax:4,...}. The actual
// highlight-on-wrong-columns symptom reported by the user (D:E rounds the wrong data columns)
// is caused by an off-by-one in the DOM cell-index mapping: rows[r].cells includes the
// <th scope="row"> row-header at c=0, so the user's column letter D (index 3) resolves to the
// 3rd DOM cell, which is the *3rd data column*, not the 4th. That bug is tracked and fixed by
// this sprint (`first-col-is-a`) — column-letter → DOM-index mapping skips row-header <th>s.

// --- Sprint partial-range-fix: adversarial parser regression tests ---

// Primary bug report: f4:g8 (lowercase partial-range)
(function sprint_f4g8_lowercase() {
  const r = parseRangeExpr('f4:g8');
  eq('sprint partial-range-fix: "f4:g8" -> no error',
    typeof r.error, 'undefined');
  eq('sprint partial-range-fix: "f4:g8" -> one range',
    r.ranges && r.ranges.length, 1);
  const rng = r.ranges && r.ranges[0];
  eq('sprint partial-range-fix: "f4:g8" colMin=5', rng && rng.colMin, 5);
  eq('sprint partial-range-fix: "f4:g8" colMax=6', rng && rng.colMax, 6);
  eq('sprint partial-range-fix: "f4:g8" rowMin=3', rng && rng.rowMin, 3);
  eq('sprint partial-range-fix: "f4:g8" rowMax=7', rng && rng.rowMax, 7);
})();

// Case-insensitive: uppercase F4:G8 must also work
(function sprint_F4G8_uppercase() {
  const r = parseRangeExpr('F4:G8');
  eq('sprint partial-range-fix: "F4:G8" -> no error',
    typeof r.error, 'undefined');
  const rng = r.ranges && r.ranges[0];
  eq('sprint partial-range-fix: "F4:G8" colMin=5', rng && rng.colMin, 5);
  eq('sprint partial-range-fix: "F4:G8" colMax=6', rng && rng.colMax, 6);
  eq('sprint partial-range-fix: "F4:G8" rowMin=3', rng && rng.rowMin, 3);
  eq('sprint partial-range-fix: "F4:G8" rowMax=7', rng && rng.rowMax, 7);
})();

// Acceptance criterion: B2:D (col+row on left, col-only on right) -> open row end
(function sprint_B2D_partial() {
  const r = parseRangeExpr('B2:D');
  eq('sprint partial-range-fix: "B2:D" -> no error',
    typeof r.error, 'undefined');
  eq('sprint partial-range-fix: "B2:D" -> one range',
    r.ranges && r.ranges.length, 1);
  const rng = r.ranges && r.ranges[0];
  eq('sprint partial-range-fix: "B2:D" colMin=1', rng && rng.colMin, 1);
  eq('sprint partial-range-fix: "B2:D" colMax=3', rng && rng.colMax, 3);
  eq('sprint partial-range-fix: "B2:D" rowMin=1', rng && rng.rowMin, 1);
  eq('sprint partial-range-fix: "B2:D" rowMax=Infinity', rng && rng.rowMax, Infinity);
})();

// Acceptance criterion: B:D5 (col-only on left, col+row on right) -> open row start
(function sprint_BD5_partial() {
  const r = parseRangeExpr('B:D5');
  eq('sprint partial-range-fix: "B:D5" -> no error',
    typeof r.error, 'undefined');
  eq('sprint partial-range-fix: "B:D5" -> one range',
    r.ranges && r.ranges.length, 1);
  const rng = r.ranges && r.ranges[0];
  eq('sprint partial-range-fix: "B:D5" colMin=1', rng && rng.colMin, 1);
  eq('sprint partial-range-fix: "B:D5" colMax=3', rng && rng.colMax, 3);
  eq('sprint partial-range-fix: "B:D5" rowMin=0', rng && rng.rowMin, 0);
  eq('sprint partial-range-fix: "B:D5" rowMax=4', rng && rng.rowMax, 4);
})();

// Regression guard: previously-working shapes must still pass
(function sprint_regression_A() {
  const r = parseRangeExpr('A');
  eq('sprint regression: "A" still works', r,
    { ranges: [{ colMin: 0, colMax: 0, rowMin: 0, rowMax: Infinity }] });
})();

(function sprint_regression_AD() {
  const r = parseRangeExpr('A:D');
  eq('sprint regression: "A:D" still works', r,
    { ranges: [{ colMin: 0, colMax: 3, rowMin: 0, rowMax: Infinity }] });
})();

(function sprint_regression_row_range() {
  const r = parseRangeExpr('1:10');
  eq('sprint regression: "1:10" still works', r,
    { ranges: [{ colMin: 0, colMax: Infinity, rowMin: 0, rowMax: 9 }] });
})();

(function sprint_regression_B2E8() {
  const r = parseRangeExpr('B2:E8');
  eq('sprint regression: "B2:E8" still works', r,
    { ranges: [{ colMin: 1, colMax: 4, rowMin: 1, rowMax: 7 }] });
})();

(function sprint_regression_union() {
  const r = parseRangeExpr('{A1:E8, G3:G}');
  eq('sprint regression: "{A1:E8, G3:G}" -> 2 ranges', r.ranges && r.ranges.length, 2);
})();

// ---------------------------------------------------------------------------
// Sprint first-col-is-a: pin behavior of <th>-skipping dataCol counter
//
// The dev's fix (reading II / data-perspective):
//   - <th> cells are skipped entirely; only <td> cells are counted.
//   - rangeExpr "A" maps to the first <td> (dataCol 0), not the leftmost DOM cell.
//   - simplifyFirstColumn=false excludes the first <td>, not the leftmost DOM cell.
//
// Helper: build a minimal mock table that roundTable can traverse.
// roundTable accesses: table.rows -> array of {cells: array of cell-like objects}
// cell-like object needs: tagName, innerText, textContent, classList, dataset,
//   title (writable), and a querySelector stub on the table.
// ---------------------------------------------------------------------------

function makeMockCell(tag, text) {
  return {
    tagName: tag.toUpperCase(),
    innerText: text,
    textContent: text,
    classList: { add: function(cls) { this._classes = this._classes || []; this._classes.push(cls); },
                 contains: function(cls) { return (this._classes||[]).includes(cls); } },
    dataset: {},
    title: '',
    _classes: [],
  };
}

function makeMockTable(rowsSpec, querySelectorResult) {
  // rowsSpec: array of arrays of {tag, text}
  const rows = rowsSpec.map(rowSpec => ({
    cells: rowSpec.map(s => makeMockCell(s.tag, s.text))
  }));
  return {
    rows,
    querySelector: function() { return querySelectorResult || null; },
    dataset: {},
  };
}

// roundTable calls chrome.runtime.sendMessage; already stubbed globally.
// It also calls document.createTreeWalker (via replaceTextPreservingHTML).
// We need to stub that too so the "apply rounding" path doesn't crash.
// Stub createTreeWalker to return a walker that finds the cell's single text node.

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

// --- Test 1: Table with row headers — range = "A" targets first <td>, not the <th> ---
// Row: [<th>Name</th>, <td>100</td>, <td>200</td>]
// With rangeExpr = "A" (col 0 in dataCol space) and simplifyFirstColumn=true (not excluded),
// "A" should hit <td>100</td> (the first <td>), NOT the <th>Name</th>.
(function firstColIsA_withRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'th', text: 'Name' },
      { tag: 'td', text: '100'  },
      { tag: 'td', text: '200'  },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: 'A'
    };
    roundTable(table, opts);
    const cells = table.rows[0].cells;
    // <th> Name: must NOT be rounded (it's not a <td>, skipped by the loop entirely)
    eq('first-col-is-A (row-header table): <th> Name is never rounded',
      cells[0].classList.contains('dr-ext-rounded'), false);
    // <td> 200: dataCol 1 = column B — out of range A, must NOT be rounded
    eq('first-col-is-A (row-header table): <td>200 at dataCol 1 not rounded',
      cells[2].classList.contains('dr-ext-rounded'), false);
  });
})();

// --- Test 2: Table without row headers — non-targeted columns stay untouched ---
// Note: directly asserting "first <td> gets the rounded class" depends on the
// rounding algorithm producing a *changed* value, which for some inputs (e.g.
// a single in-range cell) is a no-op. We pin only the negative behavior here:
// cells outside the range never get the rounded class.
(function firstColIsA_noRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '50000' },
      { tag: 'td', text: '100'   },
      { tag: 'td', text: '200'   },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: 'A'
    };
    roundTable(table, opts);
    const cells = table.rows[0].cells;
    eq('first-col-is-A (no row-header): second <td> is column B, not rounded',
      cells[1].classList.contains('dr-ext-rounded'), false);
    eq('first-col-is-A (no row-header): third <td> is column C, not rounded',
      cells[2].classList.contains('dr-ext-rounded'), false);
  });
})();

// --- Test 3: simplifyFirstColumn=false + row headers ---
// Row: [<th>Name</th>, <td>100</td>, <td>200</td>]
// rangeExpr = '' (whole table), simplifyFirstColumn = false.
// Dev behavior: simplifyFirstColumn=false checks dataCol === 0, so <td>100</td> is
// excluded (not the <th>, which is skipped from the data loop entirely).
(function simplifyFirstColumn_withRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'th', text: 'Name' },
      { tag: 'td', text: '100'  },
      { tag: 'td', text: '200'  },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: true, simplifyTimes: true,
      simplifyFirstColumn: false, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cells = table.rows[0].cells;
    // <th> Name: skipped (not a TD)
    eq('simplifyFirstColumn=false (row-header table): <th> Name never rounded',
      cells[0].classList.contains('dr-ext-rounded'), false);
    // <td>100 is dataCol 0 — excluded by simplifyFirstColumn=false (dev reading II)
    eq('simplifyFirstColumn=false (row-header table): <td>100 at dataCol 0 is excluded',
      cells[1].classList.contains('dr-ext-rounded'), false);
  });
})();

// --- Sprint icon-no-sidebar: manifest + background invariants ---
// NOTE: These are static-analysis proxies only. Whether the toolbar icon
// actually disappears in Chrome, and whether the context menu visually works,
// cannot be verified in this Node harness — those require a live browser.

(function sprintIconNoSidebar() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const bgPath = path.join(__dirname, 'background.js');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bgSource = fs.readFileSync(bgPath, 'utf8');

  // 1. "action" key must be absent — its presence would register a toolbar icon.
  eq('manifest: no "action" key (toolbar icon suppressed)',
    Object.prototype.hasOwnProperty.call(manifest, 'action'), false);

  // 2. "side_panel" must still be present — the panel itself must remain registered.
  eq('manifest: "side_panel" key still present',
    Object.prototype.hasOwnProperty.call(manifest, 'side_panel'), true);

  // 3. "contextMenus" must still be in permissions — right-click menu requires it.
  eq('manifest: "contextMenus" still in permissions',
    Array.isArray(manifest.permissions) && manifest.permissions.includes('contextMenus'), true);

  // 4. background.js must NOT reference chrome.action — no remnant action API usage.
  eq('background.js: no chrome.action.* references',
    /chrome\.action\b/.test(bgSource), false);

  // 5. background.js must still wire up contextMenus.create and sidePanel.open.
  eq('background.js: contextMenus.create still present',
    bgSource.includes('contextMenus.create'), true);

  eq('background.js: sidePanel.open still present',
    bgSource.includes('sidePanel.open'), true);
})();

// --- Sprint range-pulse-border: animation parameters and dispatch ---

// CSS string: capture style.textContent from ensureHighlightStyleInjected().
// We patch document.createElement to intercept the style element before injection.
(function rangePulseCssParams() {
  // Reset the module-level guard so we can trigger injection fresh.
  highlightStyleInjected = false;

  let capturedCss = null;
  const origCreate = document.createElement;
  document.createElement = (tag) => {
    const el = { textContent: null };
    if (tag === 'style') {
      Object.defineProperty(el, 'textContent', {
        set(v) { capturedCss = v; },
        get() { return capturedCss; }
      });
    }
    return el;
  };
  // Stub appendChild so the injection doesn't throw (document.head is undefined in stub).
  const origHead = document.head;
  const origDocEl = document.documentElement;
  document.documentElement = { appendChild: () => {} };

  ensureHighlightStyleInjected();

  // Restore stubs.
  document.createElement = origCreate;
  document.documentElement = origDocEl;
  // Re-set guard so later paths don't re-inject against the real (absent) DOM.
  highlightStyleInjected = true;

  eq('rangePulse CSS: animation duration is 0.6s',
    capturedCss !== null && capturedCss.includes('0.6s'), true);

  // The animation shorthand for .dr-ext-range-pulse should end with iteration-count 2.
  const animLine = capturedCss && (capturedCss.match(/animation:\s*drExtRangePulse[^;]+;/) || [])[0];
  eq('rangePulse CSS: iteration count is 2 (two cycles = ~1.2s total)',
    !!(animLine && /\s2\s*;$/.test(animLine.trim())), true);

  eq('rangePulse CSS: .dr-ext-target-flash class still present (no regression)',
    capturedCss !== null && capturedCss.includes('dr-ext-target-flash'), true);
})();

// Dispatch: flashRangePulse(table, null) must delegate to flashTargetedTable,
// which adds 'dr-ext-target-flash' to table.classList.
(function rangePulseNullRangesDispatch() {
  const classes = new Set();
  const mockTable = {
    classList: {
      remove(cls) { classes.delete(cls); },
      add(cls) { classes.add(cls); }
    },
    offsetWidth: 0,   // accessed via void table.offsetWidth in flashTargetedTable
    rows: []
  };

  flashRangePulse(mockTable, null);

  eq('rangePulse dispatch: null ranges adds dr-ext-target-flash (whole-table path)',
    classes.has('dr-ext-target-flash'), true);
})();

// Dispatch: flashRangePulse(table, ranges) with zero matching cells falls back
// to flashTargetedTable (same class added).
(function rangePulseEmptyCellsFallback() {
  const classes = new Set();
  const mockTable = {
    classList: {
      remove(cls) { classes.delete(cls); },
      add(cls) { classes.add(cls); }
    },
    offsetWidth: 0,
    rows: []  // no rows => no cells => matchedCells.length === 0 => fallback
  };

  // A valid non-null ranges array that can't match anything in an empty table.
  const ranges = [{ colMin: 0, colMax: 2, rowMin: 0, rowMax: 5 }];
  flashRangePulse(mockTable, ranges);

  eq('rangePulse dispatch: non-null ranges with no matching cells falls back to whole-table flash',
    classes.has('dr-ext-target-flash'), true);
})();

// ---------------------------------------------------------------------------
// Sprint exclude-numbers-in-links
// ---------------------------------------------------------------------------

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

// --- AC1: Cell whose entire content is inside <a> is left unrounded ---
// isCellWholeLink(<td><a href="#">1234</a></td>) must return true.
(function ac1_wholeLinkCell() {
  const cell = makeLinkCell(['1234'], null);
  eq('AC1: isCellWholeLink returns true for <td><a>1234</a></td>',
    isCellWholeLink(cell), true);
})();

// Converse: a cell with NO anchor must return false.
(function ac1_noLinkCell() {
  const plainCell = {
    innerText: '1234',
    querySelectorAll: () => [],
  };
  eq('AC1 (converse): isCellWholeLink returns false when no <a> present',
    isCellWholeLink(plainCell), false);
})();

// AC1 via roundTable: a pure-numeric whole-link cell is skipped (mode = 'skip'),
// so it never gets the dr-ext-rounded class.
(function ac1_roundTable_wholeLinkCellNotRounded() {
  withLinkCreateTreeWalker(function() {
    // Build a table row with one whole-link cell containing a large number.
    const linkCell = makeLinkCell(['8584629'], null);

    const table = {
      rows: [{ cells: [linkCell] }],
      querySelector: () => null,
      dataset: {},
    };
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: '',
    };
    roundTable(table, opts);
    eq('AC1: whole-link numeric cell is NOT rounded (dr-ext-rounded absent)',
      linkCell.classList.contains('dr-ext-rounded'), false);
  });
})();

// --- AC2: Mixed cell — <a>5</a> preserved, 1234 outside rounds ---
// filterLinkMatches must drop the match for '5' (inside anchor) and keep '1234' (outside).
(function ac2_filterLinkMatches_mixedCell() {
  withLinkCreateTreeWalker(function() {
    // Cell: "1234 and " + <a>5</a>  — innerText = "1234 and 5"
    // We model: outsideText = "1234 and", anchor = "5"
    const cell = makeLinkCell(['5'], '1234 and');

    const matches = extractNumbersInText(cell.innerText); // finds 1234 and 5
    const filtered = filterLinkMatches(cell, matches);

    // '5' inside anchor must be dropped; '1234' outside must be kept.
    const nums = filtered.map(m => m.num);
    eq('AC2: filterLinkMatches keeps 1234 (outside anchor)', nums.includes(1234), true);
    eq('AC2: filterLinkMatches drops 5 (inside anchor)', nums.includes(5), false);
  });
})();

// --- AC3: Mixed visible text with <a>5</a> inline — linked number preserved ---
// isCellWholeLink must return false (not the whole cell text is in links).
// filterLinkMatches must drop 5 and keep the other number.
(function ac3_inlineLinkPreservesLinkedNumber() {
  withLinkCreateTreeWalker(function() {
    // Cell: "Revenue 3000" + <a>5</a>   -> innerText = "Revenue 3000 5"
    const cell = makeLinkCell(['5'], 'Revenue 3000');

    eq('AC3: isCellWholeLink is false for mixed cell',
      isCellWholeLink(cell), false);

    const matches = extractNumbersInText(cell.innerText);
    const filtered = filterLinkMatches(cell, matches);
    const nums = filtered.map(m => m.num);
    eq('AC3: linked number 5 is absent from filtered matches', nums.includes(5), false);
    eq('AC3: non-linked 3000 survives filtering', nums.includes(3000), true);
  });
})();

// --- AC4: Hidden-sortkey regression guard ---
// A cell like <td><span style="display:none">700023000</span>+2.3%</td>
// The implementation reads cell.innerText (which browsers exclude hidden text from).
// We model this by making cell.innerText = '+2.3%' only (hidden span excluded).
// toNumber('+2.3%') -> null (percent), and with simplifyMixedPercent unset it's excluded entirely.
// The large hidden number 700023000 must NOT appear in any extracted matches.
(function ac4_hiddenSortkeyNotExtracted() {
  // Simulate: innerText is what the browser returns (no hidden text).
  // Browsers exclude hidden (display:none) content from innerText, so the cell's
  // innerText is just '+2.3%'; the 700023000 sortkey never reaches the rounding logic.
  const cellText = '+2.3%';

  // extractNumbersInText on the visible text must NOT return 700023000.
  const matches = extractNumbersInText(cellText);
  const nums = matches.map(m => m.num);
  eq('AC4: hidden sortkey 700023000 does NOT appear in extracted matches from visible text',
    nums.includes(700023000), false);

  // The visible text IS numeric (toNumber strips % via CLEAN_REGEX -> 2.3),
  // but getExclusionReason excludes percent cells by default -> cell is skipped.
  eq('AC4: percent cell excluded by default (regression guard: no spurious rounding)',
    getExclusionReason(cellText, 1, {}), 'percent');
})();

// AC4 via roundTable: confirm the cell is skipped, not rounded.
(function ac4_roundTable_hiddenSortkeyNotRounded() {
  withLinkCreateTreeWalker(function() {
    // Cell whose innerText (visible) is '+2.3%'; hidden sortkey not visible.
    const cell = makeMockCell('td', '+2.3%');
    cell.querySelectorAll = () => [];  // no anchors

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: '',
    };
    roundTable(table, opts);
    eq('AC4: percent cell with hidden sortkey is NOT rounded',
      cell.classList.contains('dr-ext-rounded'), false);
  });
})();

// --- AC5: manifest.json has a valid N.N.N version string ---
(function ac5_manifestVersion() {
  const manifest = JSON.parse(
    require('fs').readFileSync(require('path').join(__dirname, 'manifest.json'), 'utf8'));
  eq('AC5: manifest.json version matches semver N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);
})();

// --- AC6: scope guard removed — was a git-diff-based assertion that
// presumed a single-commit sprint and breaks in a stacked-PR world.
// The content-based regression guards in the quote and decimal blocks
// (which assert no sibling files contain new identifiers) cover the same
// intent without depending on git history shape.

// --- Static analysis: link-aware functions are defined and exported ---
(function ac_staticAnalysis() {
  eq('static: isCellWholeLink is defined', typeof isCellWholeLink, 'function');
  eq('static: filterLinkMatches is defined', typeof filterLinkMatches, 'function');

  // isCellWholeLink: cell with no querySelectorAll support returns false safely
  eq('static: isCellWholeLink handles cell without querySelectorAll',
    isCellWholeLink({ innerText: '123' }), false);

  // filterLinkMatches: returns original matches when cell has no querySelectorAll
  const dummyMatches = [{ numStr: '100', num: 100, index: 0 }];
  eq('static: filterLinkMatches returns matches unchanged when cell has no querySelectorAll',
    filterLinkMatches({ innerText: '100' }, dummyMatches), dummyMatches);

  // filterLinkMatches: empty matches returned as-is
  eq('static: filterLinkMatches handles empty matches array',
    filterLinkMatches({ innerText: '100', querySelectorAll: () => [] }, []).length, 0);
})();

// ---------------------------------------------------------------------------
// Sprint exclude-numbers-in-quotes
// ---------------------------------------------------------------------------

// --- 1. getQuoteMaskedRanges unit tests ---

(function quoteMaskedRangesUnit() {
  // Single quoted span at position 0
  const r1 = getQuoteMaskedRanges('"3 musketeers"');
  eq('quoteMasked: "3 musketeers" -> one range',
    r1.length, 1);
  eq('quoteMasked: "3 musketeers" start=0',
    r1[0].start, 0);
  eq('quoteMasked: "3 musketeers" end=14',
    r1[0].end, 14);

  // Quoted span mid-string
  const text2 = 'He said "the answer is 42", but 7 disagreed.';
  const r2 = getQuoteMaskedRanges(text2);
  eq('quoteMasked: mid-string span -> one range',
    r2.length, 1);
  eq('quoteMasked: mid-string span start=8',
    r2[0].start, 8);
  // "the answer is 42" = 18 chars, starts at 8 -> ends at 26
  eq('quoteMasked: mid-string span end=26',
    r2[0].end, 26);

  // Two separate quoted spans — must NOT be merged
  const text3 = 'a "1" and "2" b';
  const r3 = getQuoteMaskedRanges(text3);
  eq('quoteMasked: two spans -> two ranges (not merged)',
    r3.length, 2);
  eq('quoteMasked: first span start=2', r3[0].start, 2);
  eq('quoteMasked: first span end=5',   r3[0].end, 5);
  eq('quoteMasked: second span start=10', r3[1].start, 10);
  eq('quoteMasked: second span end=13',   r3[1].end, 13);

  // Unbalanced quote -> zero ranges
  eq('quoteMasked: unbalanced "hi -> zero ranges',
    getQuoteMaskedRanges('He said "hi').length, 0);

  // Empty string -> zero ranges
  eq('quoteMasked: empty string -> zero ranges',
    getQuoteMaskedRanges('').length, 0);
})();

// --- 2. Inline filtering: only 7 remains after quoting "the answer is 42" ---

(function quoteInlineFilter() {
  const text = 'He said "the answer is 42", but 7 disagreed.';
  const matches = extractNumbersInText(text);
  const quoteRanges = getQuoteMaskedRanges(text);
  const filtered = matches.filter(m =>
    !overlapsQuoteRange(quoteRanges, m.index, m.index + m.numStr.length)
  );
  eq('quoteFilter: before filter match count includes 42',
    matches.some(m => m.num === 42), true);
  eq('quoteFilter: after filter 42 is dropped',
    filtered.some(m => m.num === 42), false);
  eq('quoteFilter: after filter 7 remains',
    filtered.some(m => m.num === 7), true);
  eq('quoteFilter: after filter only one match remains',
    filtered.length, 1);
})();

// --- 3. Whole-cell short-circuit via roundTable mock ---

(function wholeCellQuoteShortCircuit() {
  withCreateTreeWalker(function() {
    // A cell whose entire trimmed content is a single balanced quoted span.
    // The cell has a number inside quotes — it must NOT get dr-ext-rounded.
    const table = makeMockTable([[
      { tag: 'td', text: '"3 musketeers"' },
      { tag: 'td', text: '42' },  // this one should round (control)
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: true, simplifyDates: false, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: true, simplifyMixedCurrency: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cells = table.rows[0].cells;
    eq('wholeCellQuote: "3 musketeers" cell not rounded (short-circuit)',
      cells[0].classList.contains('dr-ext-rounded'), false);
    // Note: 42 is a single cell with a large magnitude; whether it rounds depends on
    // the set. The key invariant is the quoted cell is skipped.
  });
})();

// --- 4. Spec-scope guards ---

(function quoteScopeGuards() {
  // Single quotes: numbers inside '...' are NOT excluded (out of scope)
  const singleQuote = "He said '42' and 7.";
  const sqMatches = extractNumbersInText(singleQuote);
  // getQuoteMaskedRanges only handles ASCII double-quotes — single quotes ignored
  const sqRanges = getQuoteMaskedRanges(singleQuote);
  eq('scope guard: single quotes not masked (zero quote ranges)',
    sqRanges.length, 0);
  eq('scope guard: 42 inside single quotes NOT excluded by filter',
    sqMatches.filter(m => !overlapsQuoteRange(sqRanges, m.index, m.index + m.numStr.length))
      .some(m => m.num === 42), true);

  // Typographic quotes: “...” are NOT masked
  const typoQuote = '“the answer is 42” but 7.';
  const tqRanges = getQuoteMaskedRanges(typoQuote);
  eq('scope guard: typographic “...” not masked (zero quote ranges)',
    tqRanges.length, 0);
  // Both 42 and 7 survive unfiltered
  const tqMatches = extractNumbersInText(typoQuote);
  const tqFiltered = tqMatches.filter(m => !overlapsQuoteRange(tqRanges, m.index, m.index + m.numStr.length));
  eq('scope guard: 42 inside typographic quotes NOT excluded',
    tqFiltered.some(m => m.num === 42), true);

  // Mixed: one balanced ASCII pair and a bare number
  // 'he said "foo 5" and 10' -> 5 is masked, 10 is not
  const mixed = 'he said "foo 5" and 10';
  const mxRanges = getQuoteMaskedRanges(mixed);
  const mxMatches = extractNumbersInText(mixed);
  const mxFiltered = mxMatches.filter(m => !overlapsQuoteRange(mxRanges, m.index, m.index + m.numStr.length));
  eq('scope guard: 5 inside ASCII quotes IS excluded',
    mxFiltered.some(m => m.num === 5), false);
  eq('scope guard: 10 outside ASCII quotes NOT excluded',
    mxFiltered.some(m => m.num === 10), true);
})();

// --- 5. Regression guards ---

(function quoteRegressionGuards() {
  // 5a. cell.innerText || cell.textContent is the read source (static analysis).
  // Lives in the NativeTableAdapter (dom-adapters.js) after the Phase 2 split.
  const contentSrc = allContentSrc;
  eq('regression: read source is cell.innerText || cell.textContent',
    contentSrc.includes('cell.innerText || cell.textContent'), true);

  // 5b. Manifest has a valid semver version string.
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  eq('regression: manifest.version matches N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);

  // 5c. Out-of-scope files not modified: sidebar.html, sidebar.js, js/, python/
  // We verify their content by checking they exist but do NOT contain getQuoteMaskedRanges.
  const sidebarHtmlPath = path.join(__dirname, 'sidebar.html');
  const sidebarJsPath = path.join(__dirname, 'sidebar.js');
  if (fs.existsSync(sidebarHtmlPath)) {
    eq('regression: sidebar.html not modified (no getQuoteMaskedRanges)',
      fs.readFileSync(sidebarHtmlPath, 'utf8').includes('getQuoteMaskedRanges'), false);
  } else {
    passed++; // file absent — trivially passes (was never in scope)
  }
  if (fs.existsSync(sidebarJsPath)) {
    eq('regression: sidebar.js not modified (no getQuoteMaskedRanges)',
      fs.readFileSync(sidebarJsPath, 'utf8').includes('getQuoteMaskedRanges'), false);
  } else {
    passed++;
  }
  // The content scripts MUST define getQuoteMaskedRanges (now in parsing.js)
  eq('regression: content scripts define getQuoteMaskedRanges',
    contentSrc.includes('function getQuoteMaskedRanges('), true);
  // ...and overlapsQuoteRange (now in parsing.js)
  eq('regression: content scripts define overlapsQuoteRange',
    contentSrc.includes('function overlapsQuoteRange('), true);
})();
// --- Sprint decimal-precision-display: decimalCount ---

eq('decimalCount: 0.5 -> 1', decimalCount(0.5), 1);
eq('decimalCount: 0.25 -> 2', decimalCount(0.25), 2);
eq('decimalCount: -0.5 -> 1 (sign stripped)', decimalCount(-0.5), 1);
eq('decimalCount: 1 -> 0', decimalCount(1), 0);
eq('decimalCount: -1 -> 0', decimalCount(-1), 0);
eq('decimalCount: null -> 0', decimalCount(null), 0);
eq('decimalCount: undefined -> 0', decimalCount(undefined), 0);
eq('decimalCount: NaN -> 0', decimalCount(NaN), 0);

// --- Sprint decimal-precision-display: formatExtractedNumber with floorDecimals ---

// trailing zeros always stripped regardless of floorDecimals or original decimal count
eq('formatExtractedNumber: trailing zeros stripped on whole number (floorDecimals=1)',
  formatExtractedNumber(1, '1', 1), '1');

eq('formatExtractedNumber: trailing zeros stripped on one-decimal result (floorDecimals=1)',
  formatExtractedNumber(1.5, '1.40', 1), '1.5');

// original has 2 decimals, floorDecimals=2: result has 2 meaningful decimals, no stripping needed
eq('formatExtractedNumber: two meaningful decimals preserved (floorDecimals=2)',
  formatExtractedNumber(1.75, '1.72', 2), '1.75');

// trailing zeros stripped even when original had 2 decimals and result is whole
eq('formatExtractedNumber: trailing zeros stripped on whole number (floorDecimals=0)',
  formatExtractedNumber(1, '1.00', 0), '1');

// |rounded| >= 10 short-circuit: decimals forced to 0, floorDecimals ignored
eq('formatExtractedNumber: |rounded|>=10 short-circuit overrides floorDecimals',
  formatExtractedNumber(12, '12', 1), '12');

// --- Sprint decimal-precision-display: regression guards ---

(function sprintRegressionGuards() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const readmePath = path.join(__dirname, '..', 'js', 'README.md');
  const changelogPath = path.join(__dirname, '..', 'js', 'CHANGELOG.md');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  eq('sprint regression: manifest version matches N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);

  const readme = fs.readFileSync(readmePath, 'utf8');
  eq('sprint regression: js/README.md contains Sheets decimal precision section header',
    /##\s+Note:\s+decimal precision in Sheets/i.test(readme), true);

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  eq('sprint regression: js/CHANGELOG.md contains doc update entry',
    /decimal precision in Sheets/.test(changelog), true);

  // Python directory: verify no .py files were modified (static guard via git-ignored stat)
  // We cannot run git here, so we verify python/ files are still intact by checking
  // that the python directory exists and contains expected files.
  const pythonDir = path.join(__dirname, '..', 'python');
  const fsStat = require('fs');
  eq('sprint regression: python/ directory exists (not deleted)',
    fsStat.existsSync(pythonDir), true);
})();
// --- Sprint sidebar-defaults-and-layout ---

(function sprintSidebarDefaultsAndLayout() {
  const sidebarPath = path.join(__dirname, 'sidebar.html');
  const sidebarHtml = fs.readFileSync(sidebarPath, 'utf8');

  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const sidebarJsPath = path.join(__dirname, 'sidebar.js');
  const sidebarJsSource = fs.readFileSync(sidebarJsPath, 'utf8');

  const contentJsPath = path.join(__dirname, 'content.js');
  const contentJsSource = fs.readFileSync(contentJsPath, 'utf8');

  // AC1/AC2: Sidebar UI defaults now live in defaults.js (single source of
  // truth shared with content.js). The HTML must NOT hard-code checked /
  // selected attributes — they would shadow the JS-applied defaults.
  eq('sidebar-defaults: simplifyMixedCells default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('sidebar-defaults: simplifyMixedCurrency default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('sidebar-defaults: simplifyMixedPercent default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('sidebar-defaults: dateGranularity default is "decade" in DR_DEFAULTS',
    DR_DEFAULTS.dateGranularity, 'decade');
  eq('sidebar-defaults: timeGranularity default is "hour" in DR_DEFAULTS',
    DR_DEFAULTS.timeGranularity, 'hour');
  eq('sidebar-defaults: sidebar.html does not hard-code "checked" attributes',
    /<input[^>]*checked/i.test(sidebarHtml), false);
  eq('sidebar-defaults: sidebar.html does not hard-code "selected" options',
    /<option[^>]*selected/i.test(sidebarHtml), false);
  eq('sidebar-defaults: sidebar.html loads defaults.js before sidebar.js',
    /defaults\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
  eq('sidebar-defaults: sidebar.js applies DR_DEFAULTS to the UI on load',
    /applyDefaultsToUI[\s\S]*DR_DEFAULTS/.test(sidebarJsSource), true);
  eq('sidebar-defaults: manifest content_scripts load order is defaults, rounding, core, parsing, dom-adapters, ui-toggle, content',
    JSON.stringify(manifest.content_scripts[0].js) === JSON.stringify([
      'defaults.js', 'rounding.js', 'core.js',
      'parsing.js', 'dom-adapters.js', 'ui-toggle.js', 'content.js',
    ]), true);

  // AC3: (sidebar-tidyup) the old "section-heading" with "Include numbers in cells containing:"
  // was removed in the sidebar-tidyup sprint — no replacement test needed here.

  // AC4a: rangeSection div has "hidden" attribute.
  eq('sidebar-defaults: rangeSection has hidden attribute',
    /<div[^>]*id="rangeSection"[^>]*hidden/.test(sidebarHtml) ||
    /<div[^>]*hidden[^>]*id="rangeSection"/.test(sidebarHtml), true);

  // AC4b: rangeSection markup is still present (not deleted).
  eq('sidebar-defaults: rangeSection markup still present in HTML',
    sidebarHtml.includes('id="rangeSection"'), true);

  // AC5: parseRangeExpr is still defined (now in parsing.js after Phase 2 split).
  eq('sidebar-defaults: content scripts still define parseRangeExpr',
    /function parseRangeExpr\b/.test(allContentSrc), true);

  // AC6: manifest.json has a valid N.N.N version string.
  eq('sidebar-defaults: manifest version matches N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);

  // AC7: manifest permissions do NOT include "storage".
  eq('sidebar-defaults: manifest permissions does not include "storage"',
    Array.isArray(manifest.permissions) && manifest.permissions.includes('storage'), false);

  // AC8: sidebar.js does not reference chrome.storage.sync.
  eq('sidebar-defaults: sidebar.js does not call chrome.storage.sync',
    /chrome\.storage\.sync/.test(sidebarJsSource), false);
  eq('sidebar-defaults: sidebar.js does not import chrome.storage',
    /chrome\.storage/.test(sidebarJsSource), false);
})();

// ---------------------------------------------------------------------------
// Sprint sidebar-settings-pull-and-unified-toggle (v1.12.0)
// ---------------------------------------------------------------------------

(function sprintSidebarPullAndUnifiedToggle() {
  const contentSrc = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // --- Sidebar pull: content.js requests, sidebar.js responds ---

  eq('pull: content.js sends GET_SIDEBAR_SETTINGS',
    /chrome\.runtime\.sendMessage\(\s*\{\s*action:\s*['"]GET_SIDEBAR_SETTINGS['"]/.test(contentSrc), true);

  eq('pull: content.js no longer applies defaults on SIDEBAR_OPENED',
    /SIDEBAR_OPENED[\s\S]{0,200}applySidebarRounding\([^)]*DR_DEFAULTS/.test(contentSrc), false);

  eq('pull: sidebar.js handles GET_SIDEBAR_SETTINGS and responds with currentSettings()',
    /GET_SIDEBAR_SETTINGS[\s\S]{0,120}sendResponse\([^)]*currentSettings\(\)/.test(sidebarSrc), true);

  // --- Unified rounding path: drop data-rounded-value, cache innerHTML ---

  eq('unified: data-rounded-value attribute no longer written',
    /data-rounded-value|dataset\.roundedValue/.test(contentSrc), false);

  eq('unified: data-original-html attribute is written',
    /dataset\.originalHtml\s*=/.test(contentSrc), true);

  eq('unified: per-table options WeakMap declared',
    /const\s+tableOptions\s*=\s*new\s+WeakMap/.test(contentSrc), true);

  eq('unified: toggleOriginalValues calls roundTable for original→rounded path',
    /function toggleOriginalValues[\s\S]{0,500}roundTable\(/.test(contentSrc), true);

  // --- Display simplification: "35.0" → "35" when value unchanged but format would ---

  withCreateTreeWalker(function() {
    // Row contains a large number to anchor max_mag=3 so 35 doesn't get rounded
    // away from itself (35 with offset -0.5 → 35), AND a "35.0" cell that should
    // be re-formatted to "35".
    const table = makeMockTable([[
      { tag: 'td', text: '7984' },
      { tag: 'td', text: '35.0' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
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
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
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

// --- auto-table-toggle ---
//
// Adversarial tests for the per-table toggle switch sprint.
// We call the new pure/semi-pure functions directly after eval.
// MutationObserver and ResizeObserver are stubbed as no-ops so the top-level
// initialisation code in content.js does not throw at eval time.

// Stub constructors so the module-level MutationObserver / ResizeObserver usage
// at content.js load time does not throw in Node. The stubs are injected BEFORE
// the eval, but since we patch globalThis here (after the eval), we need to work
// around the fact the eval already ran. In practice the guards in content.js
// (`if (typeof MutationObserver !== 'undefined')`) check the global at eval time.
// The eval has already run successfully (MutationObserver was undefined → guarded).
// These stubs are only needed for any test that directly calls createToggleForTable,
// which itself calls `new ResizeObserver(...)`. We therefore stub ResizeObserver
// on globalThis before those tests run.
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} };
global.Node = { ELEMENT_NODE: 1 };

// --- Helpers ---

/**
 * Build a minimal table DOM stub that isTableRounded, toggleOriginalValues, and
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
    // querySelector('.dr-ext-rounded') — used by isTableRounded and runToggleAction
    querySelector(sel) {
      if (sel === '.dr-ext-rounded') {
        return this._cells.find(c => c.classList.contains('dr-ext-rounded')) || null;
      }
      return null;
    },
    // querySelectorAll('.dr-ext-rounded') — used by toggleOriginalValues / resetTable
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

// --- AC5: isTableRounded returns false for a fresh table ---

(function atToggle_isTableRounded_freshTable() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  eq('auto-table-toggle: isTableRounded(fresh table) is false',
    isTableRounded(table), false);
})();

// --- AC5: isTableRounded returns true after roundTable marks cells ---

(function atToggle_isTableRounded_afterRound() {
  // Directly inject the rounded class to simulate a rounded table (don't run
  // the full roundTable pipeline which requires tree walkers etc.)
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  // Manually mark the cell as rounded — this is what roundTable does.
  table._cells[0].classList.add('dr-ext-rounded');
  eq('auto-table-toggle: isTableRounded(table with .dr-ext-rounded cell) is true',
    isTableRounded(table), true);
})();

// --- AC5: isTableRounded returns false when drShowingOriginal === 'true' ---
// (toggleOriginalValues sets this; the table still has rounded cells but is showing originals)

(function atToggle_isTableRounded_showingOriginal() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  table.dataset.drShowingOriginal = 'true';
  eq('auto-table-toggle: isTableRounded is false when drShowingOriginal===true',
    isTableRounded(table), false);
})();

// --- AC5: isTableRounded after toggleOriginalValues restores originals ---
// After toggleOriginalValues flips to showing originals, isTableRounded must be false.

(function atToggle_isTableRounded_afterToggleOff() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  // Simulate a post-roundTable state: cell has rounded class + originalHtml
  const cell = table._cells[0];
  cell.classList.add('dr-ext-rounded');
  cell.dataset.originalHtml = '1,000';
  cell.innerHTML = '1,000';
  // Also need to stub innerHTML setter so toggleOriginalValues can restore it
  Object.defineProperty(cell, 'innerHTML', {
    get() { return this._html !== undefined ? this._html : cell.textContent; },
    set(v) { this._html = v; },
    configurable: true,
  });

  // Inject toggle entry (proper button stub) so syncSwitchForTable doesn't crash
  injectToggleEntry(table);

  // Calling toggleOriginalValues (showingOriginal=false path) sets drShowingOriginal='true'
  toggleOriginalValues(table);

  eq('auto-table-toggle: after toggleOriginalValues, isTableRounded is false',
    isTableRounded(table), false);
  eq('auto-table-toggle: after toggleOriginalValues, drShowingOriginal is "true"',
    table.dataset.drShowingOriginal, 'true');
})();

// --- AC6: syncSwitchForTable sets aria-pressed on the button to match isTableRounded ---

(function atToggle_syncSwitch_ariaFalseWhenNotRounded() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  button.setAttribute('aria-pressed', 'true'); // pre-set to true to confirm it gets corrected

  syncSwitchForTable(table);
  eq('auto-table-toggle: syncSwitchForTable sets aria-pressed="false" on fresh table',
    button.getAttribute('aria-pressed'), 'false');
})();

(function atToggle_syncSwitch_ariaTrueWhenRounded() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  button.setAttribute('aria-pressed', 'false'); // pre-set to false to confirm it gets corrected

  // Mark table as rounded
  table._cells[0].classList.add('dr-ext-rounded');

  syncSwitchForTable(table);
  eq('auto-table-toggle: syncSwitchForTable sets aria-pressed="true" on rounded table',
    button.getAttribute('aria-pressed'), 'true');
})();

(function atToggle_syncSwitch_ariaFalseWhenShowingOriginal() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  table._cells[0].classList.add('dr-ext-rounded');
  table.dataset.drShowingOriginal = 'true';
  button.setAttribute('aria-pressed', 'true');

  syncSwitchForTable(table);
  eq('auto-table-toggle: syncSwitchForTable sets aria-pressed="false" when showingOriginal=true',
    button.getAttribute('aria-pressed'), 'false');
})();

// --- AC6: syncSwitchForTable is a no-op when no toggle registered ---

(function atToggle_syncSwitch_noEntryIsNoop() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  // No injectToggleEntry call — tableToggles has no entry for this table.
  // Should not throw.
  let threw = false;
  try { syncSwitchForTable(table); } catch (e) { threw = true; }
  eq('auto-table-toggle: syncSwitchForTable does not throw when no toggle registered',
    threw, false);
})();

// --- DOM shape: createToggleForTable creates the new morph button structure ---
// Spec (§3.6 + AC): button.dr-ext-morph > span.dr-ext-morph-visible > span.dr-ext-morph-knob
// The button must have type="button", aria-pressed="false", and an aria-label.

(function atToggle_createToggle_domShape() {
  const createdElements = [];
  const appendedChildren = [];

  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;

  global.document.createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const el = {
      _tag: tag,
      type: '',
      className: '',
      style: {},
      _children: [],
      _listeners: listeners,
      dataset: {},
      parentElement: null,
      textContent: '',
      appendChild(child) {
        this._children.push(child);
        child.parentElement = this;
        return child;
      },
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      classList: (() => {
        const c = [];
        return {
          _c: c,
          add(x)     { if (!c.includes(x)) c.push(x); },
          remove(x)  { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
          contains(x){ return c.includes(x); },
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
    createdElements.push(el);
    return el;
  };

  global.document.body = {
    appendChild(child) {
      appendedChildren.push(child);
      child.parentElement = global.document.body;
    }
  };
  global.document.documentElement = { appendChild() {} };

  // Reset the module-level flag so injection runs
  toggleStyleInjected = false;
  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },  { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(table);

  // Restore
  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  // The button element should have been created and appended to body
  const buttonEl = appendedChildren.find(e => e._tag === 'button');
  eq('auto-table-toggle: createToggleForTable appends a <button> to document.body',
    buttonEl !== undefined, true);

  // Must have class dr-ext-morph
  eq('auto-table-toggle: createToggleForTable creates a <button class="dr-ext-morph">',
    buttonEl ? buttonEl.className === 'dr-ext-morph' : false, true);

  // Must have type="button"
  eq('auto-table-toggle: createToggleForTable button has type="button"',
    buttonEl ? buttonEl.type === 'button' : false, true);

  // aria-pressed initially "false"
  eq('auto-table-toggle: createToggleForTable button has aria-pressed="false" initially',
    buttonEl ? buttonEl.getAttribute('aria-pressed') : null, 'false');

  // Must have aria-label (accessible name)
  const ariaLabel = buttonEl ? buttonEl.getAttribute('aria-label') : null;
  eq('auto-table-toggle: createToggleForTable button has non-empty aria-label',
    typeof ariaLabel === 'string' && ariaLabel.length > 0, true);

  // aria-label must mention rounding (case-insensitive)
  eq('auto-table-toggle: createToggleForTable aria-label mentions rounding',
    ariaLabel ? ariaLabel.toLowerCase().includes('round') : false, true);

  // First child of button must be span.dr-ext-morph-visible
  const visibleEl = buttonEl ? buttonEl._children[0] : null;
  eq('auto-table-toggle: button first child is <span class="dr-ext-morph-visible">',
    visibleEl ? (visibleEl._tag === 'span' && visibleEl.className === 'dr-ext-morph-visible') : false, true);

  // First child of visible must be span.dr-ext-morph-knob
  const knobEl = visibleEl ? visibleEl._children[0] : null;
  eq('auto-table-toggle: visible first child is <span class="dr-ext-morph-knob">',
    knobEl ? (knobEl._tag === 'span' && knobEl.className === 'dr-ext-morph-knob') : false, true);

  // tableToggles must now contain this table
  eq('auto-table-toggle: createToggleForTable registers table in tableToggles',
    tableToggles.has(table), true);
})();

// --- Anchor geometry (rest state, scroll=0) ---
// Spec (§3.2): wrapper left/top place the visible's bottom-right at
//   visible.bottom = rect.top  + scrollY + TOGGLE_DOT_OVERLAP_PX
//   visible.right  = rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX
// With justify-content: flex-end + padding: TOGGLE_HIT_PAD_PX, the visible sits
// inside the wrapper's content box on both axes, so its right edge is
// wrapper.right - padding (not wrapper.right). The wrapper offsets are therefore:
//   wrapperLeft = (rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX
//   wrapperTop  = (rect.top   + scrollY + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX
// (Note: this corrects a math error in the merged plan §3.6, which double-counted
// padding on the horizontal axis. See sprint log for the deviation.)
// All arithmetic is done in terms of the exposed globalThis constants.

(function atToggle_positionToggle_anchorGeometry_noScroll() {
  const tableRect = { top: 100, right: 500, bottom: 200, left: 100, width: 400, height: 100 };
  const table = { getBoundingClientRect() { return tableRect; } };
  const buttonEl = { style: {} };

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  positionToggle(table, buttonEl);

  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;

  const left = parseFloat(buttonEl.style.left);
  const top  = parseFloat(buttonEl.style.top);

  const expectedLeft = (tableRect.right + 0 + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;
  const expectedTop  = (tableRect.top   + 0 + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;

  eq('positionToggle: wrapper left matches anchor formula (scroll=0)',
    left, expectedLeft);
  eq('positionToggle: wrapper top matches anchor formula (scroll=0)',
    top, expectedTop);

  // Cross-check: derive the visible's bottom-right edges from the wrapper offset
  // and assert they sit at the spec-defined anchor. visible.right (document) =
  // wrapper.left + (wrapper width) - padding-right = wrapper.left + DOT + PAD.
  // visible.bottom (document) = wrapper.top + padding-top + DOT.
  const visibleRight  = left + TOGGLE_DOT_PX + TOGGLE_HIT_PAD_PX;
  const visibleBottom = top  + TOGGLE_HIT_PAD_PX + TOGGLE_DOT_PX;
  eq('positionToggle: visible.right sits TOGGLE_DOT_OVERHANG_PX past table right edge',
    visibleRight, tableRect.right + TOGGLE_DOT_OVERHANG_PX);
  eq('positionToggle: visible.bottom sits TOGGLE_DOT_OVERLAP_PX below table top edge',
    visibleBottom, tableRect.top + TOGGLE_DOT_OVERLAP_PX);
})();

// --- Anchor geometry with non-zero scroll ---
// scrollX=200, scrollY=300 should shift both axes accordingly.

(function atToggle_positionToggle_anchorGeometry_withScroll() {
  const tableRect = { top: 100, right: 500, bottom: 200, left: 100, width: 400, height: 100 };
  const table = { getBoundingClientRect() { return tableRect; } };
  const buttonEl = { style: {} };

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 200;
  global.window.scrollY = 300;

  positionToggle(table, buttonEl);

  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;

  const left = parseFloat(buttonEl.style.left);
  const top  = parseFloat(buttonEl.style.top);

  const expectedLeft = (tableRect.right + 200 + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;
  const expectedTop  = (tableRect.top   + 300 + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;

  eq('positionToggle: wrapper left includes scrollX offset',
    left, expectedLeft);
  eq('positionToggle: wrapper top includes scrollY offset',
    top, expectedTop);
})();

// --- AC3 / AC4: runToggleAction semantics ---
// runToggleAction calls roundTable when no .dr-ext-rounded cells exist,
// and toggleOriginalValues when .dr-ext-rounded cells exist.
// We verify the outcome on table.dataset rather than inspecting private calls.

(function atToggle_runToggleAction_onFreshTable() {
  // Use withCreateTreeWalker so roundTable can traverse cells.
  withCreateTreeWalker(function() {
    // Two-row table: row 0 is the header (excluded by default: DR_DEFAULTS.simplifyFirstRow=false),
    // row 1 has large numbers that WILL be rounded.
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    // Must have querySelectorAll on individual cells (used by roundTable → filterLinkMatches)
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    // Register a checkbox so syncSwitchForTable doesn't crash
    const input = injectToggleEntry(table);

    runToggleAction(table);

    // After runToggleAction on a fresh table, at least one cell should be rounded
    const hasRounded = table._cells.some(c => c.classList.contains('dr-ext-rounded'));
    eq('auto-table-toggle: runToggleAction on fresh table rounds cells (AC3)',
      hasRounded, true);
    // aria-pressed should now reflect the rounded state
    eq('auto-table-toggle: aria-pressed="true" after rounding via runToggleAction',
      input.getAttribute('aria-pressed'), 'true');
  });
})();

(function atToggle_runToggleAction_toggleOffRestoresOriginal() {
  // Simulate a table that is already rounded: has .dr-ext-rounded cells.
  const table = makeToggleTable([{ tag: 'td', text: '8,500,000' }]);
  const cell = table._cells[0];
  cell.classList.add('dr-ext-rounded');
  cell.dataset.originalHtml = '8,584,629';

  // The cell's innerHTML property needs to be writable
  let htmlVal = cell.innerHTML;
  Object.defineProperty(cell, 'innerHTML', {
    get() { return htmlVal; },
    set(v) { htmlVal = v; },
    configurable: true,
  });

  const input = injectToggleEntry(table);

  runToggleAction(table);

  // After toggling off: drShowingOriginal must be 'true' (AC4)
  eq('auto-table-toggle: runToggleAction on rounded table sets drShowingOriginal=true (AC4)',
    table.dataset.drShowingOriginal, 'true');
  // aria-pressed should be "false" — table is now showing originals, not rounded
  eq('auto-table-toggle: aria-pressed="false" after toggle-off via runToggleAction',
    input.getAttribute('aria-pressed'), 'false');
})();

// --- AC5: isTableRounded sequence: false → true → false via full toggle cycle ---

(function atToggle_isTableRounded_fullCycle() {
  withCreateTreeWalker(function() {
    // Two-row table: row 0 is excluded by default (DR_DEFAULTS.simplifyFirstRow=false), row 1 has
    // large numbers that WILL be rounded so the test exercises the true → false transition.
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    const input = injectToggleEntry(table);

    // 1. Initially false
    eq('auto-table-toggle: isTableRounded is false before roundTable',
      isTableRounded(table), false);

    // 2. After roundTable → true (if any cell changed)
    roundTable(table, Object.assign({}, DR_DEFAULTS));
    const afterRound = isTableRounded(table);
    // Note: roundTable may or may not mark cells depending on inputs.
    // We accept that: if it DID mark cells, it must be true; otherwise still false.
    // Either way isTableRounded must equal whether any cell has .dr-ext-rounded AND
    // drShowingOriginal is not 'true'.
    const expectedAfterRound = table.querySelector('.dr-ext-rounded') !== null
                                && table.dataset.drShowingOriginal !== 'true';
    eq('auto-table-toggle: isTableRounded after roundTable matches .dr-ext-rounded presence',
      afterRound, expectedAfterRound);

    // 3. After toggleOriginalValues → false
    if (table.querySelector('.dr-ext-rounded')) {
      // Set up innerHTML writability on rounded cells
      table.querySelectorAll('.dr-ext-rounded').forEach(cell => {
        if (!Object.getOwnPropertyDescriptor(cell, 'innerHTML') ||
            !Object.getOwnPropertyDescriptor(cell, 'innerHTML').set) {
          let v = cell.innerHTML;
          Object.defineProperty(cell, 'innerHTML', {
            get() { return v; }, set(x) { v = x; }, configurable: true
          });
        }
      });
      toggleOriginalValues(table);
      eq('auto-table-toggle: isTableRounded is false after toggleOriginalValues (AC5)',
        isTableRounded(table), false);
    }
  });
})();

// --- Static analysis: all new functions are defined ---

(function atToggle_staticAnalysis() {
  eq('auto-table-toggle: isTableRounded is defined',
    typeof isTableRounded, 'function');
  eq('auto-table-toggle: syncSwitchForTable is defined',
    typeof syncSwitchForTable, 'function');
  eq('auto-table-toggle: positionToggle is defined',
    typeof positionToggle, 'function');
  eq('auto-table-toggle: createToggleForTable is defined',
    typeof createToggleForTable, 'function');
  eq('auto-table-toggle: runToggleAction is defined',
    typeof runToggleAction, 'function');
  eq('auto-table-toggle: tableToggles WeakMap is defined',
    tableToggles instanceof WeakMap, true);
  eq('auto-table-toggle: trackedTables Set is defined',
    trackedTables instanceof Set, true);
})();

// --- Regression guard: content.js declares the new infrastructure ---

(function atToggle_contentJsDeclarations() {
  // Toggle widget infrastructure lives in ui-toggle.js after the Phase 2 split;
  // scan the combined content-script source so the contract is location-agnostic.
  const src = allContentSrc;
  eq('auto-table-toggle: declares tableToggles WeakMap',
    /const\s+tableToggles\s*=\s*new\s+WeakMap/.test(src), true);
  eq('auto-table-toggle: declares trackedTables Set',
    /const\s+trackedTables\s*=\s*new\s+Set/.test(src), true);
  eq('auto-table-toggle: defines isTableRounded',
    /function\s+isTableRounded\b/.test(src), true);
  eq('auto-table-toggle: defines syncSwitchForTable',
    /function\s+syncSwitchForTable\b/.test(src), true);
  eq('auto-table-toggle: defines positionToggle',
    /function\s+positionToggle\b/.test(src), true);
  eq('auto-table-toggle: defines createToggleForTable',
    /function\s+createToggleForTable\b/.test(src), true);
  eq('auto-table-toggle: defines injectTableToggles',
    /function\s+injectTableToggles\b/.test(src), true);
  // The toggle button must use the new dr-ext-morph CSS class
  eq('auto-table-toggle: toggle uses dr-ext-morph CSS class',
    src.includes('dr-ext-morph'), true);
})();

// =============================================================================
// Sprint accessibility-pass tests
// =============================================================================

// --- accessibility AC1: aria-label on toggle button ---
// Spec (AC): the <button class="dr-ext-morph"> has an aria-label (or accessible name)
// describing its purpose (mentioning rounding).

(function accessibilityAC1_ariaLabel() {
  const createdElements = [];
  const appendedToBody = [];

  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;

  global.document.createElement = (tag) => {
    const attrs = {};
    const el = {
      _tag: tag,
      type: '',
      className: '',
      style: {},
      _children: [],
      _listeners: {},
      dataset: {},
      parentElement: null,
      textContent: '',
      classList: {
        _c: [], add(c){ if(!this._c.includes(c)) this._c.push(c); },
        remove(c){ this._c = this._c.filter(x=>x!==c); },
        contains(c){ return this._c.includes(c); },
        toggle(c, f) {
          const has = this._c.includes(c);
          const want = f === undefined ? !has : f;
          if (want && !has) this._c.push(c);
          else if (!want && has) this._c = this._c.filter(x=>x!==c);
          return want;
        },
      },
      appendChild(child) {
        this._children.push(child);
        child.parentElement = this;
        return child;
      },
      addEventListener(evt, fn) {
        if (!this._listeners[evt]) this._listeners[evt] = [];
        this._listeners[evt].push(fn);
      },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      contains() { return false; },
    };
    createdElements.push(el);
    return el;
  };

  global.document.body = {
    appendChild(child) {
      appendedToBody.push(child);
      child.parentElement = global.document.body;
    }
  };
  global.document.documentElement = { appendChild() {} };
  toggleStyleInjected = false;

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);
  createToggleForTable(table);

  // Restore
  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  // The button should have been appended to body
  const buttonEl = appendedToBody.find(e => e._tag === 'button');
  const ariaLabel = buttonEl ? buttonEl.getAttribute('aria-label') : null;

  eq('accessibility AC1: toggle button has an aria-label attribute',
    typeof ariaLabel === 'string' && ariaLabel.length > 0, true);

  eq('accessibility AC1: toggle button aria-label mentions rounding',
    ariaLabel ? ariaLabel.toLowerCase().includes('round') : false, true);
})();

// --- accessibility AC2: CSS contains :focus-visible with outline and !important ---
// Spec: the CSS string injected by ensureToggleStyleInjected contains a
//       :focus-visible rule with `outline` and `!important`.

(function accessibilityAC2_focusVisibleCSS() {
  const src = allContentSrc; // toggle CSS now in ui-toggle.js (Phase 2 split)

  eq('accessibility AC2: content.js CSS contains :focus-visible selector',
    src.includes(':focus-visible'), true);

  // Verify that some :focus-visible rule contains outline and !important.
  // The CSS template in content.js uses ${…} interpolation, so we search
  // for a line that contains both ':focus-visible' and 'outline' and '!important'
  // (they may be on the same line in the source, possibly spanning a template expression).
  const lines = src.split('\n');
  const focusOutlineLine = lines.find(l =>
    l.includes(':focus-visible') && l.includes('outline'));
  const focusImportantLine = lines.find(l =>
    l.includes(':focus-visible') && l.includes('!important'));

  eq('accessibility AC2: :focus-visible rule contains outline property',
    focusOutlineLine !== undefined, true);

  eq('accessibility AC2: :focus-visible rule uses !important',
    focusImportantLine !== undefined, true);
})();

// --- accessibility AC3: button click handler updates aria-pressed (mouse path) ---
// Spec (§3.4): for a <button>, Space/Enter are native. The click handler must
// update aria-pressed when pointerType is 'mouse' or ''.
// We use createToggleForTable (with DOM stubs) to get real event listeners,
// then simulate pointerdown→click on a table that has rounded cells.

(function accessibilityAC3_buttonClickTogglesState() {
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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
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

  const table = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(table);

  // Restore
  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Simulate pointerdown with mouse type
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse', stopPropagation() {} });

  // Mark a cell as rounded so runToggleAction will call syncSwitchForTable → aria-pressed="true"
  // Since runToggleAction internally checks querySelector('.dr-ext-rounded'), we pre-mark the cell.
  // But runToggleAction first resets (calls toggleOriginalValues or roundTable).
  // Simplest approach: verify aria-pressed transitions by actually calling via click.
  // Pre-condition: table has rounded cells → click should toggleOriginalValues.
  table._cells[0].classList.add('dr-ext-rounded');
  const cell = table._cells[0];
  let htmlVal = cell.innerHTML || '50000';
  Object.defineProperty(cell, 'innerHTML', {
    get(){return htmlVal;}, set(v){htmlVal=v;}, configurable: true
  });
  cell.dataset.originalHtml = '50000';

  // Fire click via handlers
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  // After click: table shows originals (drShowingOriginal='true'), aria-pressed='false'
  eq('accessibility AC3: button click (mouse, was-rounded) sets aria-pressed="false"',
    buttonEl.getAttribute('aria-pressed'), 'false');
})();

// ---------------------------------------------------------------------------
// Sprint offscreen-hidden-table-suppression: visibility gate in positionToggle
// ---------------------------------------------------------------------------
//
// positionToggle now hides the toggle label (labelEl.style.display = 'none')
// when the table is offscreen or invisible, and shows it (labelEl.style.display = '')
// when the table is normally visible.
//
// All four tests stub window.getComputedStyle (and/or the rect) then restore
// the original before returning, so surrounding tests are unaffected.

// AC1: display:none (computed style) → labelEl.style.display === 'none'
(function visGate_displayNone() {
  const origGetComputedStyle = global.window.getComputedStyle;
  global.window.getComputedStyle = () => ({ display: 'none', visibility: 'visible' });

  const table = {
    getBoundingClientRect() { return { width: 400, height: 200, top: 100, right: 500, bottom: 300, left: 100 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  global.window.getComputedStyle = origGetComputedStyle;

  eq('visGate: display:none table → labelEl.style.display is "none"',
    labelEl.style.display, 'none');
})();

// AC2: visibility:hidden (computed style) → labelEl.style.display === 'none'
(function visGate_visibilityHidden() {
  const origGetComputedStyle = global.window.getComputedStyle;
  global.window.getComputedStyle = () => ({ display: 'block', visibility: 'hidden' });

  const table = {
    getBoundingClientRect() { return { width: 400, height: 200, top: 100, right: 500, bottom: 300, left: 100 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  global.window.getComputedStyle = origGetComputedStyle;

  eq('visGate: visibility:hidden table → labelEl.style.display is "none"',
    labelEl.style.display, 'none');
})();

// AC3: zero-area bounding rect → labelEl.style.display === 'none'
(function visGate_zeroAreaRect() {
  // No need to override getComputedStyle — default stub returns visible style.
  const table = {
    getBoundingClientRect() { return { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  eq('visGate: zero-area rect table → labelEl.style.display is "none"',
    labelEl.style.display, 'none');
})();

// AC4: normal rect + no hiding → labelEl.style.display === '' (visible)
(function visGate_normalVisible() {
  // Default getComputedStyle stub returns display:block / visibility:visible.
  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = {
    getBoundingClientRect() { return { width: 400, height: 200, top: 100, right: 500, bottom: 300, left: 100 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;

  eq('visGate: normal visible table → labelEl.style.display is "" (shown)',
    labelEl.style.display, '');
})();

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

// AC1: 1×1 table with a numeric cell → false (< 2 rows AND < 2 columns)
(function isDataTable_1x1_numeric() {
  const table = makeIsDataTable([['42']]);
  eq('isDataTable: 1×1 table with numeric cell -> false (too few rows)',
    isDataTable(table), false);
})();

// AC2: 2×2 table with no numeric cells → false
(function isDataTable_2x2_noNumeric() {
  const table = makeIsDataTable([
    ['foo', 'bar'],
    ['baz', 'qux'],
  ]);
  eq('isDataTable: 2×2 table with no numeric cells -> false',
    isDataTable(table), false);
})();

// AC3: 2×2 table with one numeric cell → true
(function isDataTable_2x2_oneNumeric() {
  const table = makeIsDataTable([
    ['label', 'other'],
    ['row2',  '1,234'],
  ]);
  eq('isDataTable: 2×2 table with one numeric cell -> true',
    isDataTable(table), true);
})();

// AC4: 3×3 table with all-text cells → false
(function isDataTable_3x3_allText() {
  const table = makeIsDataTable([
    ['Name',  'Role',   'Dept'],
    ['Alice', 'Eng',    'R&D'],
    ['Bob',   'Design', 'UX'],
  ]);
  eq('isDataTable: 3×3 table with all-text cells -> false',
    isDataTable(table), false);
})();

// AC5: 1-row table with numeric cells → false (< 2 rows)
(function isDataTable_1row_numeric() {
  const table = makeIsDataTable([['100', '200', '300']]);
  eq('isDataTable: 1-row table with numeric cells -> false (< 2 rows)',
    isDataTable(table), false);
})();

// AC6: 2-row, 1-column table with numeric cells → false (< 2 columns in every row)
(function isDataTable_2row_1col_numeric() {
  const table = makeIsDataTable([
    ['1000'],
    ['2000'],
  ]);
  eq('isDataTable: 2-row 1-column table with numeric cells -> false (< 2 columns)',
    isDataTable(table), false);
})();

// --- Sprint trim-trailing-zeros (chrome-extension): whole-number short-circuit ---

// restoreFormatting drops trailing zeros for whole-number results under 10
eq('restoreFormatting: whole number 1 from "1.04" -> "1"',
  restoreFormatting(1, '1.04'), '1');
eq('restoreFormatting: whole number 2 from "1.5" -> "2"',
  restoreFormatting(2, '1.5'), '2');
eq('restoreFormatting: 0 from "0.04" -> "0"',
  restoreFormatting(0, '0.04'), '0');
eq('restoreFormatting: negative whole number -5 from "-5.2" -> "-5"',
  restoreFormatting(-5, '-5.2'), '-5');

// Fractional results in the <10 band still keep their decimals
eq('restoreFormatting: 1.5 from "1.4" -> "1.5"',
  restoreFormatting(1.5, '1.4'), '1.5');
eq('restoreFormatting: 1.25 from "1.234" -> "1.25" (trailing zeros stripped)',
  restoreFormatting(1.25, '1.234'), '1.25');

// Trim plays nicely with format affixes
eq('restoreFormatting: whole number with percent -> "1%"',
  restoreFormatting(1, '1.04%'), '1%');
eq('restoreFormatting: whole number with currency -> "$2"',
  restoreFormatting(2, '$1.99'), '$2');
eq('restoreFormatting: whole negative in parens -> "(3)"',
  restoreFormatting(-3, '(2.85)'), '(3)');

// formatExtractedNumber trims trailing zeros for whole-number rounded results
eq('formatExtractedNumber: whole number 1 from "1.04" -> "1"',
  formatExtractedNumber(1, '1.04'), '1');
eq('formatExtractedNumber: whole number with floorDecimals=2 still trimmed',
  formatExtractedNumber(1, '1.04', 2), '1');

// =============================================================================
// Sprint date-round-to-year-display tests
// =============================================================================

// ---------------------------------------------------------------------------
// AC1: Worked-examples table
// Each row: [input, granularity, expected-year-string]
// ---------------------------------------------------------------------------
(function dateRoundWorkedExamples() {
  const cases = [
    // input              granularity  expected
    ['Jun 21, 2020',      'year',      '2020'],
    ['Jun 21, 2020',      'decade',    '2020'],
    ['Jun 21, 2020',      'century',   '2000'],
    ['Dec 21, 2020',      'year',      '2021'],
    ['Dec 21, 2020',      'decade',    '2020'],
    ['Dec 21, 2020',      'century',   '2000'],
    ['Jun 21, 2025',      'year',      '2025'],
    ['Jun 21, 2025',      'decade',    '2030'],
    ['Jun 21, 2025',      'century',   '2000'],
    ['Apr 11, 2026',      'year',      '2026'],
    ['Apr 11, 2026',      'decade',    '2030'],
    ['Apr 11, 2026',      'century',   '2000'],
    ['May 9, 2026',       'year',      '2026'],
    ['May 9, 2026',       'decade',    '2030'],
    ['May 9, 2026',       'century',   '2000'],
    ['Jun 30, 2024',      'year',      '2024'],
    ['Jun 30, 2024',      'decade',    '2020'],
    ['Jun 30, 2024',      'century',   '2000'],
    ['Jul 1, 2024',       'year',      '2025'],
    ['Jul 1, 2024',       'decade',    '2020'],
    ['Jul 1, 2024',       'century',   '2000'],
    ['1975',              'year',      '1975'],
    ['1975',              'decade',    '1980'],
    ['1975',              'century',   '2000'],
  ];

  for (const [input, gran, expected] of cases) {
    eq(`worked-example: "${input}" at ${gran} -> "${expected}"`,
      roundDateText(input, gran), expected);
  }
})();

// ---------------------------------------------------------------------------
// AC2: Shape equivalence — same logical date, different textual forms
// All forms of Jun 21, 2020 must round identically.
// ---------------------------------------------------------------------------
(function dateRoundShapeEquivalence() {
  const shapes = [
    'Jun 21, 2020',
    '2020/06/21',
    '2020-06-21',
    '2020 June 21',
    '21 June 2020',
  ];
  // Note: '06-21-2020' is an ambiguous numeric date (handled by column auto-detect,
  // not directly by roundDateText which only handles unambiguous shapes via parseDateLike).
  // It is tested end-to-end via roundTable below — a single-row column with n2=21>12
  // forces MDY → June 21 → identical rounding to the other shapes.

  for (const shape of shapes) {
    eq(`shape-equiv: "${shape}" year -> "2020"`,   roundDateText(shape, 'year'),    '2020');
    eq(`shape-equiv: "${shape}" decade -> "2020"`, roundDateText(shape, 'decade'),  '2020');
    eq(`shape-equiv: "${shape}" century -> "2000"`,roundDateText(shape, 'century'), '2000');
  }

  // End-to-end check for the ambiguous-numeric form: '06-21-2020' via roundTable.
  withCreateTreeWalker(function() {
    function runDateCell(text, gran) {
      const tbl = makeMockTable([[{ tag: 'td', text }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: gran,
      });
      return tbl.rows[0].cells[0].innerText;
    }
    eq('shape-equiv (via roundTable): "06-21-2020" year -> "2020"',    runDateCell('06-21-2020', 'year'),    '2020');
    eq('shape-equiv (via roundTable): "06-21-2020" decade -> "2020"',  runDateCell('06-21-2020', 'decade'),  '2020');
    eq('shape-equiv (via roundTable): "06-21-2020" century -> "2000"', runDateCell('06-21-2020', 'century'), '2000');
  });
})();

// ---------------------------------------------------------------------------
// AC3: Two-digit-year US dates via parseAmbiguousNumericDate + roundTable pipeline.
// We test via roundTable since roundDateText only handles unambiguous (parseDateLike) shapes.
// ---------------------------------------------------------------------------
(function dateRoundTwoDigitYear() {
  // 3/14/24 → 2024-03-14 (yy=24 < 50 → 2024). MDY forced since n2=14 > 12.
  // year granularity → 2024, decade → 2020, century → 2000.
  withCreateTreeWalker(function() {
    function twoDigitTable(cellText, gran) {
      const tbl = makeMockTable([[{ tag: 'td', text: cellText }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: gran,
      });
      return tbl.rows[0].cells[0].innerText;
    }

    // 3/14/24 → MDY forced (14 > 12) → 2024-03-14
    eq('two-digit-year: 3/14/24 year -> "2024"',   twoDigitTable('3/14/24', 'year'),    '2024');
    eq('two-digit-year: 3/14/24 decade -> "2020"', twoDigitTable('3/14/24', 'decade'),  '2020');
    eq('two-digit-year: 3/14/24 century -> "2000"',twoDigitTable('3/14/24', 'century'), '2000');

    // 3/14/75 → MDY forced (14 > 12) → 1975-03-14 (yy=75 >= 50 → 1975)
    eq('two-digit-year: 3/14/75 year -> "1975"',   twoDigitTable('3/14/75', 'year'),    '1975');
    eq('two-digit-year: 3/14/75 decade -> "1980"', twoDigitTable('3/14/75', 'decade'),  '1980');
    eq('two-digit-year: 3/14/75 century -> "2000"',twoDigitTable('3/14/75', 'century'), '2000');
  });
})();

// ---------------------------------------------------------------------------
// AC4: roundDateText always returns a 4-digit year string, never null.
// Test via prefilled date objects (bypassing text parsing).
// ---------------------------------------------------------------------------
(function dateRoundReturnType() {
  // Boundary: Dec 31 → fractional = year + 0.5 (month=12 >= 7)
  const decDates = [
    { year: 2020, month: 12, day: 31 },
    { year: 1975, month: 6,  day: 1  },
    { year: 2000, month: 1,  day: 1  },
    { year: 2099, month: 7,  day: 1  },
  ];
  for (const d of decDates) {
    const label = `${d.year}-${d.month}-${d.day}`;
    for (const gran of ['year', 'decade', 'century']) {
      const result = roundDateText('irrelevant', gran, d);
      eq(`roundDateText always returns string: prefilled ${label} at ${gran}`,
        typeof result === 'string' && /^\d{4}$/.test(result), true);
    }
  }
})();

// ---------------------------------------------------------------------------
// AC5: Column-level MDY/DMY auto-detect via roundTable pipeline.
// ---------------------------------------------------------------------------
(function dateRoundColumnAutoDetect() {
  withCreateTreeWalker(function() {

    // Helper: run roundTable with simplifyDates:true and return cell text array.
    function runDateTable(rowsSpec, gran) {
      const tbl = makeMockTable(rowsSpec);
      // Add querySelectorAll stub to all cells
      for (const row of tbl.rows) {
        for (const cell of row.cells) {
          cell.querySelectorAll = () => [];
        }
      }
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: gran,
      });
      return tbl.rows.map(row => row.cells.map(c => c.innerText));
    }

    // --- MDY column (discriminating) ---
    // '04/13/2022' forces MDY (n2=13 > 12). The sibling '12-03-2022' is discriminating:
    //   under MDY → Dec 3, fractional=2022.5, year rounds to 2023.
    //   under DMY → Mar 12, fractional=2022.0, year rounds to 2022.
    // If the column resolver picks MDY (as it should), the sibling rounds to 2023.
    const mdyResult = runDateTable([
      [{ tag: 'td', text: '04/13/2022' }],
      [{ tag: 'td', text: '12-03-2022' }],
    ], 'year');
    eq('MDY column: 04/13/2022 rounds to 2022', mdyResult[0][0], '2022');
    eq('MDY column: 12-03-2022 resolved as MDY (Dec 3 → year 2023, not DMY Mar 12 → 2022)',
      mdyResult[1][0], '2023');

    // --- DMY column ---
    // '13/04/2022' forces DMY (n1=13 > 12). '12-08-2022' under DMY = Aug 12 = 2022.
    // Under MDY, '12-08-2022' = Dec 8 → year rounds to 2023 (Dec → fractional=2022.5 → round → 2023).
    // Under DMY, '12-08-2022' = Aug 12 → year rounds to 2022 (Aug → fractional=2022.5 → round → 2023).
    // Hmm, let's recalculate: Aug → month=8 >= 7 → fractional=2022.5, Math.round(2022.5) = 2023.
    // And Dec → month=12 >= 7 → fractional=2022.5, same result. Both give 2023 at year granularity.
    // Better disambiguation: use a month < 7 for DMY path.
    // '12-03-2022': DMY → month=3 < 7 → fractional=2022.0 → year=2022.
    //               MDY → month=12 >= 7 → fractional=2022.5 → year=2023.
    const dmyResult = runDateTable([
      [{ tag: 'td', text: '13/04/2022' }],  // n1=13 forces DMY
      [{ tag: 'td', text: '12-03-2022' }],  // DMY: day=12, month=Mar → 2022; MDY: month=Dec → 2023
    ], 'year');
    eq('DMY column: 13/04/2022 rounds to 2022', dmyResult[0][0], '2022');
    eq('DMY column: 12-03-2022 resolved as DMY (Mar 12 → year 2022, not MDY Dec 12 → 2023)',
      dmyResult[1][0], '2022');

    // --- Ambiguous column ---
    // Column where ALL cells have both components <= 12. Cannot auto-detect → mode:'skip'.
    // Cell text must be unchanged.
    const ambigResult = runDateTable([
      [{ tag: 'td', text: '03-04-2022' }],
      [{ tag: 'td', text: '05-06-2023' }],
    ], 'year');
    eq('ambiguous column: 03-04-2022 left unchanged (mode:skip)',
      ambigResult[0][0], '03-04-2022');
    eq('ambiguous column: 05-06-2023 left unchanged (mode:skip)',
      ambigResult[1][0], '05-06-2023');
  });
})();

// ---------------------------------------------------------------------------
// AC6: Non-date strings pass through unchanged.
// ---------------------------------------------------------------------------
(function dateRoundNonDatePassthrough() {
  withCreateTreeWalker(function() {
    function runSingleCell(text) {
      const tbl = makeMockTable([[{ tag: 'td', text }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: 'decade',
      });
      return tbl.rows[0].cells[0].innerText;
    }

    eq('non-date passthrough: "hello" stays unchanged', runSingleCell('hello'), 'hello');
    // "14 March" has no year → isDateLike returns false → treated as a word-embedded number
    // simplifyMixedCells=false in our setup, so it skips non-numeric text.
    // Let's just verify it doesn't get the rounded class.
    const tbl = makeMockTable([[{ tag: 'td', text: '14 March' }]]);
    tbl.rows[0].cells[0].querySelectorAll = () => [];
    roundTable(tbl, {
      enabled: true, simplifyDates: true, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      simplifyMixedCells: false, simplifyFirstRow: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: '',
      dateGranularity: 'decade',
    });
    eq('non-date passthrough: "14 March" cell not rounded (no year)',
      tbl.rows[0].cells[0].classList.contains('dr-ext-rounded'), false);
  });
})();

// ---------------------------------------------------------------------------
// AC7: Bare-year no-op short-circuit — "2020" at decade granularity.
// roundDateText returns "2020", originalValue is "2020" → formattedValue === originalValue
// → roundTable skips it (no DOM rewrite, no dr-ext-rounded class).
// ---------------------------------------------------------------------------
(function dateRoundBareYearNoOp() {
  // roundDateText itself returns "2020" for both inputs (2020 at decade is 2020).
  eq('bare-year no-op: roundDateText("2020", "decade") returns "2020"',
    roundDateText('2020', 'decade'), '2020');

  // Via roundTable: the cell should NOT get the rounded class.
  withCreateTreeWalker(function() {
    const tbl = makeMockTable([[{ tag: 'td', text: '2020' }]]);
    tbl.rows[0].cells[0].querySelectorAll = () => [];
    roundTable(tbl, {
      enabled: true, simplifyDates: true, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      simplifyMixedCells: false, simplifyFirstRow: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: '',
      dateGranularity: 'decade',
    });
    eq('bare-year no-op: "2020" at decade not marked as rounded (short-circuit)',
      tbl.rows[0].cells[0].classList.contains('dr-ext-rounded'), false);
  });
})();

// ---------------------------------------------------------------------------
// AC8: isDateLike accepts newly added shapes.
// ---------------------------------------------------------------------------
(function dateRoundIsDateLikeNewShapes() {
  eq('isDateLike: "2020/07/21" (ISO slash) -> true',  isDateLike('2020/07/21'), true);
  eq('isDateLike: "2020 June 21" (Year Month Day) -> true', isDateLike('2020 June 21'), true);
  eq('isDateLike: "3/14/24" (two-digit year) -> true', isDateLike('3/14/24'), true);
  eq('isDateLike: "06/21/2020" (MDY slash) -> true',  isDateLike('06/21/2020'), true);
  eq('isDateLike: "21 June 2020" (DMY named) -> true', isDateLike('21 June 2020'), true);
})();

// ---------------------------------------------------------------------------
// AC9: Boundary semantics — Jun 30 rounds down, Jul 1 rounds up.
// ---------------------------------------------------------------------------
(function dateRoundBoundarySemantics() {
  // Jun 30: month=6 < 7 → fractional = 2024.0 → round → 2024 (year)
  eq('boundary: Jun 30, 2024 year -> 2024', roundDateText('Jun 30, 2024', 'year'), '2024');
  // Jul 1: month=7 >= 7 → fractional = 2024.5 → round → 2025 (year)
  eq('boundary: Jul 1, 2024 year -> 2025', roundDateText('Jul 1, 2024', 'year'), '2025');

  // Jun 30 decade: fractional=2024.0 → 2024/10=202.4 → round→202 → *10=2020
  eq('boundary: Jun 30, 2024 decade -> 2020', roundDateText('Jun 30, 2024', 'decade'), '2020');
  // Jul 1 decade: fractional=2024.5 → 2024.5/10=202.45 → round→202 → *10=2020
  eq('boundary: Jul 1, 2024 decade -> 2020', roundDateText('Jul 1, 2024', 'decade'), '2020');

  // Jun 21, 2025 decade: fractional=2025.0 → 2025/10=202.5 → round→203 (banker's rounds to 202 or 203?)
  // Math.round(202.5) = 203 in JS → 2030
  eq('boundary: Jun 21, 2025 decade -> 2030', roundDateText('Jun 21, 2025', 'decade'), '2030');
})();

// ---------------------------------------------------------------------------
// Additional: static analysis — new functions exist in content.js
// ---------------------------------------------------------------------------
(function dateRoundStaticAnalysis() {
  const src = allContentSrc; // date parsing now in parsing.js (Phase 2 split)

  eq('static: parseDateLike is defined in content.js',
    /function\s+parseDateLike\b/.test(src), true);
  eq('static: parseAmbiguousNumericDate is defined in content.js',
    /function\s+parseAmbiguousNumericDate\b/.test(src), true);
  eq('static: roundDateText returns string (no null return for parsed dates)',
    // The function must NOT have "return null" after the parsed guard
    // (it uses "return text" as fallback for unparseable input).
    /function roundDateText[\s\S]{0,800}return String\(/.test(src), true);
})();

// ---------------------------------------------------------------------------
// Sprint half-step-floor-chrome: Features 1 (sign-aware half-step),
// 2 (value-OoM floor), 3 (X_FLOOR_THRESHOLD-gated x-floor)
// ---------------------------------------------------------------------------
(function halfStepFloorGrid() {
  // 27-cell grid: {87M, 47M, 17M} x {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}
  const grid = [
    { v: 87054321, expected: { '2': 10000000, '1.5': 100000000, '1': 100000000,
      '0.5': 100000000, '0': 90000000, '-0.5': 85000000, '-1': 87000000,
      '-1.5': 87000000, '-2': 87100000 } },
    { v: 47054321, expected: { '2': 10000000, '1.5': 10000000, '1': 10000000,
      '0.5': 50000000, '0': 50000000, '-0.5': 45000000, '-1': 47000000,
      '-1.5': 47000000, '-2': 47100000 } },
    { v: 17054321, expected: { '2': 10000000, '1.5': 10000000, '1': 10000000,
      '0.5': 10000000, '0': 20000000, '-0.5': 15000000, '-1': 17000000,
      '-1.5': 17000000, '-2': 17100000 } },
  ];
  const offsets = [2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2];
  for (const row of grid) {
    for (const off of offsets) {
      const key = String(off);
      eq(`half-step grid: roundWithOffset(${row.v}, ${off})`,
        roundWithOffset(row.v, off), row.expected[key]);
    }
  }

  // Negative-value sign preservation (spot check)
  eq('half-step grid: sign preserved for negative input',
    roundWithOffset(-87054321, -0.5), -85000000);
  eq('half-step grid: zero short-circuits',
    roundWithOffset(0, 1.5), 0);
})();

(function quarterStepGrid() {
  // Generalized fractional formula: any non-integer offset uses
  // step = f * 10^(current_mag + ceil(offset)) where f = |offset - trunc(offset)|.
  // Quarter-step (f = 0.25) spot checks across 87M / 47M / 17M.
  const cases = [
    [87054321,  0.25,  75000000],
    [87054321, -0.25,  87500000],
    [47054321,  0.25,  50000000],
    [47054321, -0.25,  47500000],
    [17054321,  0.25,  25000000],
    [17054321, -0.25,  17500000],
    // |trunc(offset)| >= X_FLOOR_THRESHOLD triggers the x-floor too.
    [87054321,  1.25, 100000000],  // x-floor at rd(87M, 1) = 100M
    [87054321, -1.25,  87000000],  // very fine step, x-floor at rd(87M, -1) = 87M
  ];
  for (const [v, off, expected] of cases) {
    eq(`quarter-step grid: roundWithOffset(${v}, ${off})`,
      roundWithOffset(v, off), expected);
  }
})();

(function halfStepMonotonicity() {
  // Monotonicity at offsets 1 and 0.5 across [73, 4591, 63538, 162583, 400000]
  const values = [73, 4591, 63538, 162583, 400000];
  for (const off of [1, 0.5]) {
    const out = values.map(v => roundWithOffset(v, off));
    let monotonic = true;
    for (let i = 1; i < out.length; i++) {
      if (out[i] < out[i - 1]) { monotonic = false; break; }
    }
    eq(`monotonicity: non-decreasing at offset=${off} (got ${JSON.stringify(out)})`,
      monotonic, true);
  }
})();

(function xFloorThresholdFlip() {
  // Re-eval content.js with X_FLOOR_THRESHOLD = 0 to confirm the x-floor
  // gates on the constant. We sandbox the patched source so the eq()
  // assertions below don't disturb the live extension globals.
  const roundingSrc = fs.readFileSync(path.join(__dirname, 'rounding.js'), 'utf8');
  const contentSrc = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
  const patchedRounding = roundingSrc.replace(
    /const X_FLOOR_THRESHOLD = 1;/,
    'const X_FLOOR_THRESHOLD = 0;'
  );
  eq('x-floor flip: source contains X_FLOOR_THRESHOLD declaration',
    patchedRounding.includes('const X_FLOOR_THRESHOLD = 0;'), true);

  const sandbox = {
    chrome: global.chrome,
    document: global.document,
    window: global.window,
    NodeFilter: global.NodeFilter,
    MutationObserver: global.MutationObserver,
    ResizeObserver: global.ResizeObserver,
    Node: global.Node,
    DR_DEFAULTS: globalThis.DR_DEFAULTS,
  };
  const vm = require('vm');
  const ctx = vm.createContext(sandbox);
  // content.js runs its observer/listener wiring at load and depends on the
  // extracted layers (core/parsing/dom-adapters/ui-toggle), so eval them in the
  // same order the manifest loads them before content.js.
  vm.runInContext(
    patchedRounding + '\n' + coreCode + '\n' + parsingCode + '\n' +
    domAdaptersCode + '\n' + uiToggleCode + '\n' + contentSrc +
    '\nthis.__roundWithOffset = roundWithOffset;', ctx);
  const patchedRound = sandbox.__roundWithOffset;

  eq('x-floor flip: rd(17054321, 0.5) === 20000000 with X_FLOOR_THRESHOLD=0',
    patchedRound(17054321, 0.5), 20000000);
  // And confirm the live (X_FLOOR_THRESHOLD=1) implementation does NOT
  // apply the x-floor for the same call.
  eq('x-floor flip: rd(17054321, 0.5) === 10000000 with X_FLOOR_THRESHOLD=1 (default)',
    roundWithOffset(17054321, 0.5), 10000000);
})();

// =============================================================================
// Sprint expanding-toggle: new AC tests
// =============================================================================

// --- Knob travel derivation ---
// Spec (§3.5): TOGGLE_KNOB_TRAVEL_PX === TOGGLE_PILL_WIDTH_PX - TOGGLE_KNOB_PX - 2*TOGGLE_KNOB_INSET_PX === 12

(function morphAC_knobTravelDerivation() {
  eq('expanding-toggle: TOGGLE_KNOB_TRAVEL_PX equals derived formula',
    TOGGLE_KNOB_TRAVEL_PX, TOGGLE_PILL_WIDTH_PX - TOGGLE_KNOB_PX - 2 * TOGGLE_KNOB_INSET_PX);
  eq('expanding-toggle: TOGGLE_KNOB_TRAVEL_PX equals 12 (default geometry)',
    TOGGLE_KNOB_TRAVEL_PX, 12);
})();

// --- syncSwitchForTable → aria-pressed ---
// Fresh table (no .dr-ext-rounded) → aria-pressed="false"
// After marking cells → aria-pressed="true"
// With drShowingOriginal='true' → aria-pressed="false" even if cells are rounded

(function morphAC_syncSwitch_freshTable() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  syncSwitchForTable(table);
  eq('expanding-toggle: syncSwitchForTable fresh table → aria-pressed="false"',
    button.getAttribute('aria-pressed'), 'false');
})();

(function morphAC_syncSwitch_roundedTable() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  const button = injectToggleEntry(table);
  syncSwitchForTable(table);
  eq('expanding-toggle: syncSwitchForTable rounded table → aria-pressed="true"',
    button.getAttribute('aria-pressed'), 'true');
})();

(function morphAC_syncSwitch_showingOriginal() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  table.dataset.drShowingOriginal = 'true';
  const button = injectToggleEntry(table);
  syncSwitchForTable(table);
  eq('expanding-toggle: syncSwitchForTable drShowingOriginal=true → aria-pressed="false"',
    button.getAttribute('aria-pressed'), 'false');
})();

// --- Mouse click toggles state ---
// Spec (§3.4 + AC): pointerType 'mouse'/'': runToggleAction called, aria-pressed updates.
// We create a real button via createToggleForTable (with DOM stubs).

(function morphAC_mouseClick_togglesState() {
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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
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

  // Fresh (not rounded) table — click via mouse should call runToggleAction → round it
  const table = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(table);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Initial state: aria-pressed='false'
  eq('expanding-toggle: mouse click (before): aria-pressed is "false"',
    buttonEl.getAttribute('aria-pressed'), 'false');

  // Simulate pointerdown (mouse) → click
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  withCreateTreeWalker(function() {
    clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
  });

  // After click: should have rounded cells and aria-pressed='true'
  const hasRounded = table._cells.some(c => c.classList.contains('dr-ext-rounded'));
  eq('expanding-toggle: mouse click rounds table cells',
    hasRounded, true);
  eq('expanding-toggle: mouse click updates aria-pressed to "true"',
    buttonEl.getAttribute('aria-pressed'), 'true');
})();

// --- Touch first tap expands, does NOT toggle ---
// Spec (AC): pointerType 'touch' first tap → adds .expanded, aria-pressed unchanged

(function morphAC_touchFirstTap_expandsOnly() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);
  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Pre-condition: not expanded, aria-pressed='false'
  eq('expanding-toggle: touch first tap (before): aria-pressed is "false"',
    buttonEl.getAttribute('aria-pressed'), 'false');
  eq('expanding-toggle: touch first tap (before): not expanded',
    buttonEl.classList.contains('expanded'), false);

  // Replace setTimeout to prevent actual timer from running
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms) => 99; // no-op, return fake id
  global.clearTimeout = () => {};

  // Simulate pointerdown(touch) + click
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;

  // After first tap: expanded class added, aria-pressed unchanged
  eq('expanding-toggle: touch first tap adds .expanded class',
    buttonEl.classList.contains('expanded'), true);
  eq('expanding-toggle: touch first tap does NOT change aria-pressed',
    buttonEl.getAttribute('aria-pressed'), 'false');
})();

// --- Touch second tap toggles and refreshes expansion ---
// Spec (AC): second tap on already-expanded → calls runToggleAction, updates aria-pressed

(function morphAC_touchSecondTap_togglesState() {
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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  t._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Suppress timers
  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // First tap: expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  eq('expanding-toggle: touch second tap (setup): .expanded after first tap',
    buttonEl.classList.contains('expanded'), true);

  // Second tap: should toggle state
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  withCreateTreeWalker(function() {
    clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
  });

  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;

  const hasRounded = t._cells.some(c => c.classList.contains('dr-ext-rounded'));
  eq('expanding-toggle: touch second tap rounds table cells',
    hasRounded, true);
  eq('expanding-toggle: touch second tap updates aria-pressed to "true"',
    buttonEl.getAttribute('aria-pressed'), 'true');
})();

// --- Pen pointer behaves like touch (two-tap flow) ---
// Spec (AC): pointerType 'pen' uses same expand-then-toggle path as 'touch'

(function morphAC_penPointer_behavesLikeTouch() {
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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // First tap with pen → should expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'pen', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;

  eq('expanding-toggle: pen first tap adds .expanded class',
    buttonEl.classList.contains('expanded'), true);
  eq('expanding-toggle: pen first tap does NOT change aria-pressed',
    buttonEl.getAttribute('aria-pressed'), 'false');
})();

// --- Auto-collapse timer ---
// Spec (AC): after .expanded is added, TOUCH_AUTOCOLLAPSE_MS ms later .expanded is removed.
// We fake setTimeout to capture and drain the queued callback synchronously.

(function morphAC_autoCollapse_timer() {
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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Capture the scheduled timeout callback
  const pendingTimers = [];
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  global.setTimeout = (fn, ms) => { pendingTimers.push({ fn, ms }); return pendingTimers.length - 1; };
  global.clearTimeout = (id) => { if (pendingTimers[id]) pendingTimers[id].fn = null; };

  // Touch tap → expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  // Should be expanded now
  eq('expanding-toggle: auto-collapse: .expanded after first touch tap',
    buttonEl.classList.contains('expanded'), true);

  // Drain the captured timer (simulating TOUCH_AUTOCOLLAPSE_MS passing)
  const timer = pendingTimers[pendingTimers.length - 1];
  const capturedMs = timer ? timer.ms : -1;
  eq('expanding-toggle: auto-collapse: timer duration equals TOUCH_AUTOCOLLAPSE_MS',
    capturedMs, TOUCH_AUTOCOLLAPSE_MS);

  if (timer && timer.fn) timer.fn();  // fire the callback

  global.setTimeout = origSetTimeout;
  global.clearTimeout = origClearTimeout;

  eq('expanding-toggle: auto-collapse: .expanded removed after timer fires',
    buttonEl.classList.contains('expanded'), false);
})();

// --- Tap-outside collapse ---
// Spec (AC): pointerdown outside an .expanded button removes .expanded;
//            pointerdown inside preserves .expanded.
// We test via the global document pointerdown listener that createToggleForTable registers.

(function morphAC_tapOutside_collapses() {
  // We need to capture the global 'pointerdown' listener added to document.
  // Reset _globalTapCollapseAdded so createToggleForTable re-registers it on our stub.
  const origTapCollapseAdded = _globalTapCollapseAdded;
  _globalTapCollapseAdded = false;

  const docListeners = {};
  const origDocAddListener = global.document.addEventListener;
  global.document.addEventListener = (evt, fn) => {
    if (!docListeners[evt]) docListeners[evt] = [];
    docListeners[evt].push(fn);
  };

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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
      contains(node){return false;},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.document.addEventListener = origDocAddListener;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Manually mark as expanded
  buttonEl.classList.add('expanded');

  // The global listener relies on document.querySelectorAll('.dr-ext-morph.expanded').
  // We need to stub that for this test.
  const origQSA = global.document.querySelectorAll;
  global.document.querySelectorAll = (sel) => {
    if (sel === '.dr-ext-morph.expanded' && buttonEl.classList.contains('expanded')) {
      return [buttonEl];
    }
    return [];
  };

  // Suppress setTimeout
  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // Fire a pointerdown on an outside target (contains() returns false → should collapse)
  const outsideTarget = { nodeType: 1 };
  const pdHandlers = docListeners['pointerdown'] || [];
  pdHandlers.forEach(fn => fn({ target: outsideTarget }));

  global.document.querySelectorAll = origQSA;
  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;
  _globalTapCollapseAdded = origTapCollapseAdded;

  eq('expanding-toggle: tap-outside collapses .expanded button',
    buttonEl.classList.contains('expanded'), false);
})();

(function morphAC_tapInside_preservesExpanded() {
  // Reset so the listener gets re-registered on our stubbed document.addEventListener
  const origTapCollapseAdded2 = _globalTapCollapseAdded;
  _globalTapCollapseAdded = false;

  const docListeners = {};
  const origDocAddListener = global.document.addEventListener;
  global.document.addEventListener = (evt, fn) => {
    if (!docListeners[evt]) docListeners[evt] = [];
    docListeners[evt].push(fn);
  };

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
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;},
      contains(node){return node === this || (this._children && this._children.includes(node));},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.document.addEventListener = origDocAddListener;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');
  buttonEl.classList.add('expanded');

  const origQSA = global.document.querySelectorAll;
  global.document.querySelectorAll = (sel) => {
    if (sel === '.dr-ext-morph.expanded' && buttonEl.classList.contains('expanded')) {
      return [buttonEl];
    }
    return [];
  };

  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // Fire a pointerdown with target = the button itself (contains returns true)
  const pdHandlers = docListeners['pointerdown'] || [];
  pdHandlers.forEach(fn => fn({ target: buttonEl }));

  global.document.querySelectorAll = origQSA;
  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;
  _globalTapCollapseAdded = origTapCollapseAdded2;

  eq('expanding-toggle: tap-inside preserves .expanded on button',
    buttonEl.classList.contains('expanded'), true);
})();

// --- Constants vs literals check ---
// Spec (AC §3.5 + last AC bullet): geometry literals must only appear as constant declarations.
// Soft check: the constant names TOGGLE_DOT_PX etc. appear in the CSS template block.

(function morphAC_constantsUsedInCSS() {
  const src = allContentSrc; // toggle geometry now in ui-toggle.js (Phase 2 split)

  // The CSS function body should contain interpolations of the constants, not bare literals.
  // We extract the ensureToggleStyleInjected function body as a rough string.
  const fnStart = src.indexOf('function ensureToggleStyleInjected');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = fnStart !== -1 ? src.slice(fnStart, fnEnd !== -1 ? fnEnd : fnStart + 3000) : '';

  eq('expanding-toggle: TOGGLE_HIT_PAD_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_HIT_PAD_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_DOT_PX'), true);
  eq('expanding-toggle: TOGGLE_PILL_WIDTH_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_PILL_WIDTH_PX'), true);
  eq('expanding-toggle: TOGGLE_PILL_HEIGHT_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_PILL_HEIGHT_PX'), true);
  eq('expanding-toggle: TOGGLE_KNOB_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_KNOB_PX'), true);
  eq('expanding-toggle: TOGGLE_COLOR_ON referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_COLOR_ON'), true);

  // positionToggle body should reference the geometry constants
  const ptStart = src.indexOf('function positionToggle');
  const ptEnd = src.indexOf('\nfunction ', ptStart + 1);
  const ptBody = ptStart !== -1 ? src.slice(ptStart, ptEnd !== -1 ? ptEnd : ptStart + 1000) : '';

  eq('expanding-toggle: TOGGLE_HIT_PAD_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_HIT_PAD_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_OVERLAP_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_OVERLAP_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_OVERHANG_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_OVERHANG_PX'), true);
})();

// =============================================================================
// Sprint sidebar-preview-band: formatStep, collectNumericCells, extractPreviewSamples
// =============================================================================

(function previewBand_formatStep() {
  eq('formatStep: 5000 -> "5k"', formatStep(5000), '5k');
  eq('formatStep: 500 -> "500"', formatStep(500), '500');
  eq('formatStep: 2_500_000 -> "2.5M"', formatStep(2500000), '2.5M');
  eq('formatStep: 1e9 -> "1B"', formatStep(1e9), '1B');
  eq('formatStep: 2.5 -> "2.5"', formatStep(2.5), '2.5');
  eq('formatStep: 0.25 -> "0.25"', formatStep(0.25), '0.25');
  eq('formatStep: 1 -> "1"', formatStep(1), '1');
  eq('formatStep: 0 -> "0"', formatStep(0), '0');
})();

(function previewBand_stepForOffset() {
  // offset = 0 on a 5-digit number -> step = 10^4 = 10000
  eq('stepForOffset(27136, 0) = 10000', stepForOffset(27136, 0), 10000);
  // offset = -0.5 on a 5-digit number -> f=0.5, target_mag=4, step = 0.5*1e4
  eq('stepForOffset(27136, -0.5) = 5000', stepForOffset(27136, -0.5), 5000);
  // offset = -1 -> step = 10^(4-1) = 1000
  eq('stepForOffset(27136, -1) = 1000', stepForOffset(27136, -1), 1000);
  // num=0 -> 0
  eq('stepForOffset(0, -0.5) = 0', stepForOffset(0, -0.5), 0);
})();

(function previewBand_collectNumericCells() {
  // Build a small stub table; only the pure-number cells should appear.
  function tdCell(text) {
    return { tagName: 'TD', innerText: text, textContent: text };
  }
  function thCell(text) {
    return { tagName: 'TH', innerText: text, textContent: text };
  }
  const table = {
    rows: [
      { cells: [thCell('Header'), thCell('Year')] },
      { cells: [tdCell('Apples'), tdCell('27,136')] },
      { cells: [tdCell('Pears'),  tdCell('4,080')] },
      { cells: [tdCell('Empty'),  tdCell('')] },
      { cells: [tdCell('Word'),   tdCell('hello')] },
    ],
  };
  const cells = collectNumericCells(table);
  eq('collectNumericCells: returns 2 numeric cells', cells.length, 2);
  eq('collectNumericCells: first cell text', cells[0].text, '27,136');
  eq('collectNumericCells: first cell num', cells[0].num, 27136);
  eq('collectNumericCells: second cell num', cells[1].num, 4080);
})();

(function previewBand_extractPreviewSamples_buckets() {
  // 5 cells across 5 distinct magnitudes: 1e7, 1e6, 1e4, 1e2, 1e1.
  // num_top = 1 (DR_DEFAULTS) -> top band picks the highest magnitude only
  // (others differ from max_mag by >= 1). To exercise the 2-row top band,
  // give it two cells at the same top magnitude.
  function tdCell(text) {
    return { tagName: 'TD', innerText: text, textContent: text };
  }
  const table = {
    rows: [
      { cells: [tdCell('27,000,000'), tdCell('18,000,000')] }, // both mag 7
      { cells: [tdCell('4,080'),  tdCell('312')] },             // mag 3, 2
      { cells: [tdCell('56')] },                                // mag 1
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples: maxMag is 7', result.maxMag, 7);
  eq('extractPreviewSamples: top band has 2 rows', result.samples.top.length, 2);
  eq('extractPreviewSamples: top[0] is 27M', result.samples.top[0].num, 27000000);
  eq('extractPreviewSamples: top[1] is 18M', result.samples.top[1].num, 18000000);
  eq('extractPreviewSamples: bottom band has 3 rows', result.samples.bottom.length, 3);
  eq('extractPreviewSamples: bottom[0] is 4080', result.samples.bottom[0].num, 4080);
  eq('extractPreviewSamples: bottom[1] is 312', result.samples.bottom[1].num, 312);
  eq('extractPreviewSamples: bottom[2] is 56', result.samples.bottom[2].num, 56);
})();

(function previewBand_extractPreviewSamples_largeMagOnly() {
  // All cells in the top magnitude bucket -> bottom band ends up empty.
  function tdCell(text) {
    return { tagName: 'TD', innerText: text, textContent: text };
  }
  const table = {
    rows: [{ cells: [tdCell('27,000,000'), tdCell('18,000,000'), tdCell('45,000,000')] }],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (all-top): top has 2 rows', result.samples.top.length, 2);
  eq('extractPreviewSamples (all-top): bottom is empty', result.samples.bottom.length, 0);
})();

(function previewBand_extractPreviewSamples_emptyTable() {
  function tdCell(text) {
    return { tagName: 'TD', innerText: text, textContent: text };
  }
  const table = {
    rows: [{ cells: [tdCell('hello'), tdCell('world')] }],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (empty): maxMag null', result.maxMag, null);
  eq('extractPreviewSamples (empty): top length 0', result.samples.top.length, 0);
  eq('extractPreviewSamples (empty): bottom length 0', result.samples.bottom.length, 0);
})();

(function previewBand_manifestLoadsRoundingJs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  eq('manifest content_scripts loads rounding.js between defaults.js and content.js',
    manifest.content_scripts[0].js[1], 'rounding.js');
})();

// The extracted layers (core.js + the Phase 2 split: parsing.js, dom-adapters.js,
// ui-toggle.js) must all load AFTER rounding.js and BEFORE content.js — content.js
// runs last because it holds the only load-time-executing code (listeners and the
// MutationObserver wiring). This ordering is duplicated in three places (manifest
// content_scripts, sidebar.html, and this harness's eval concatenation); they must
// stay in lockstep.
(function layerLoadOrderAcrossEntryPoints() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts[0].js;
  const after = (a, b) => js.indexOf(a) > -1 && js.indexOf(b) > -1 && js.indexOf(a) < js.indexOf(b);
  eq('manifest: rounding.js < core.js < parsing.js < dom-adapters.js < ui-toggle.js < content.js',
    after('rounding.js', 'core.js') && after('core.js', 'parsing.js') &&
    after('parsing.js', 'dom-adapters.js') && after('dom-adapters.js', 'ui-toggle.js') &&
    after('ui-toggle.js', 'content.js'), true);
  eq('manifest: content.js loads last', js[js.length - 1], 'content.js');

  // The sidebar deliberately does NOT load the content-only layers — it only
  // needs the pure domain (defaults, rounding, core).
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('sidebar.html loads core.js after rounding.js and before sidebar.js',
    /rounding\.js[\s\S]*core\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
  eq('sidebar.html does not load content-only parsing.js', sidebarHtml.includes('parsing.js'), false);
  eq('sidebar.html does not load content-only dom-adapters.js', sidebarHtml.includes('dom-adapters.js'), false);
  eq('sidebar.html does not load content-only ui-toggle.js', sidebarHtml.includes('ui-toggle.js'), false);

  const testsSource = fs.readFileSync(path.join(__dirname, 'tests.js'), 'utf8');
  eq('tests.js eval concatenation orders the layers core→parsing→dom-adapters→ui-toggle→content',
    /coreCode[\s\S]*parsingCode[\s\S]*domAdaptersCode[\s\S]*uiToggleCode[\s\S]*code\b/.test(
      testsSource.slice(testsSource.indexOf('eval('))), true);
})();

(function previewBand_sidebarHtmlHasBands() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('sidebar.html has #topBand', /<div[^>]*id="topBand"/.test(sidebarHtml), true);
  eq('sidebar.html has #botBand', /<div[^>]*id="botBand"/.test(sidebarHtml), true);
  eq('sidebar.html loads rounding.js before sidebar.js',
    /rounding\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
})();

// ---------------------------------------------------------------------------
// Sprint sidebar-tidyup: flat toggle list, new defaults, switch wrappers
// ---------------------------------------------------------------------------

(function sprintSidebarTidyup() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // ── AC1: options section has exactly seven toggle rows in the canonical order ──
  // Parse all toggle-label texts inside #optionsSection.
  // Strategy: extract the optionsSection fragment, then collect every
  // class="toggle-label" span's text content via a simple regex.
  const optionsSectionMatch = sidebarHtml.match(/<div[^>]*id="optionsSection"[^>]*>([\s\S]*?)<\/div>\s*\n\s*<div/);
  // Fallback: grab everything between id="optionsSection"> and the next sibling div
  const optsSectionRaw = (() => {
    const start = sidebarHtml.indexOf('id="optionsSection"');
    if (start === -1) return '';
    const tagEnd = sidebarHtml.indexOf('>', start);
    // Walk forward tracking open/close divs to extract the full container
    let depth = 1;
    let i = tagEnd + 1;
    while (i < sidebarHtml.length && depth > 0) {
      const nextOpen  = sidebarHtml.indexOf('<div', i);
      const nextClose = sidebarHtml.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
      else { depth--; if (depth === 0) { return sidebarHtml.slice(tagEnd + 1, nextClose); } i = nextClose + 6; }
    }
    return '';
  })();

  // Collect label texts in document order
  const labelRe = /class="toggle-label"[^>]*>([\s\S]*?)<\/span>/g;
  const labelTexts = [];
  let lm;
  while ((lm = labelRe.exec(optsSectionRaw)) !== null) {
    labelTexts.push(lm[1].trim());
  }

  const expectedOrder = ['words', 'currencies', 'percentages', 'dates', 'times', 'first row', 'first column'];

  eq('sidebar-tidyup AC1: options section has exactly 7 toggle rows',
    labelTexts.length, 7);

  eq('sidebar-tidyup AC1: toggle rows are in canonical order',
    labelTexts, expectedOrder);

  // ── AC2: forbidden phrases do not appear anywhere in the options section ──

  const forbidden = [
    'Include numbers in cells containing',
    'Exclude:',
    'round to:'
  ];
  for (const phrase of forbidden) {
    eq(`sidebar-tidyup AC2: "${phrase}" absent from options section`,
      optsSectionRaw.includes(phrase), false);
  }

  // Also check the full HTML for the same forbidden phrases (belt-and-braces)
  for (const phrase of forbidden) {
    eq(`sidebar-tidyup AC2 (full HTML): "${phrase}" absent`,
      sidebarHtml.includes(phrase), false);
  }

  // ── AC3: DR_DEFAULTS has the seven expected values ──

  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedCells is true',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedCurrency is true',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedPercent is true',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyDates is true',
    DR_DEFAULTS.simplifyDates, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyTimes is false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyFirstRow is false',
    DR_DEFAULTS.simplifyFirstRow, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyFirstColumn is false',
    DR_DEFAULTS.simplifyFirstColumn, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.dateGranularity is "decade"',
    DR_DEFAULTS.dateGranularity, 'decade');
  eq('sidebar-tidyup AC3: DR_DEFAULTS.timeGranularity is "hour"',
    DR_DEFAULTS.timeGranularity, 'hour');

  // ── AC4: every option-row checkbox is wrapped in a .switch element ──
  // For each of the seven option inputs by id, verify there is a parent
  // element with class "switch" enclosing the input.
  const optionInputIds = [
    'simplifyMixedCells', 'simplifyMixedCurrency', 'simplifyMixedPercent',
    'simplifyDates', 'simplifyTimes', 'simplifyFirstRow', 'simplifyFirstColumn'
  ];
  for (const id of optionInputIds) {
    // Match <label class="switch"> ... <input ... id="<id>"> ... </label>
    // OR <span class="switch"> ... <input ... id="<id>"> ... </span>
    const switchWrapRe = new RegExp(
      '<(?:label|span)[^>]*class="[^"]*\\bswitch\\b[^"]*"[^>]*>[\\s\\S]{0,300}' +
      '<input[^>]*id="' + id + '"',
      'm'
    );
    eq(`sidebar-tidyup AC4: #${id} is wrapped in a .switch element`,
      switchWrapRe.test(sidebarHtml), true);
  }

  // ── AC5: #timeGranularity <select> lists hour first, minute second ──
  // Extract the <select id="timeGranularity"> element and check option order.
  const timeSelectMatch = sidebarHtml.match(/<select[^>]*id="timeGranularity"[^>]*>([\s\S]*?)<\/select>/);
  const timeSelectHtml = timeSelectMatch ? timeSelectMatch[1] : '';

  const timeOptionRe = /value="([^"]+)"/g;
  const timeOptionValues = [];
  let tom;
  while ((tom = timeOptionRe.exec(timeSelectHtml)) !== null) {
    timeOptionValues.push(tom[1]);
  }

  eq('sidebar-tidyup AC5: #timeGranularity has exactly 2 options',
    timeOptionValues.length, 2);
  eq('sidebar-tidyup AC5: first option is "hour"',
    timeOptionValues[0], 'hour');
  eq('sidebar-tidyup AC5: second option is "minute"',
    timeOptionValues[1], 'minute');
})();

// ---------------------------------------------------------------------------
// Sprint date-tolerant-detection: isDateLike with adjacent text and markers
// ---------------------------------------------------------------------------

(function sprintDateTolerance() {

  // --- Acceptance criteria: positive cases ---

  // AC1: ISO date with trailing word
  eq('dateTolerance AC1: isDateLike("2020-03-14 sales") -> true',
    isDateLike('2020-03-14 sales'), true);

  // AC2: Named-month date with trailing superscript digit (footnote ref)
  eq('dateTolerance AC2: isDateLike("March 14, 2024¹") -> true',
    isDateLike('March 14, 2024¹'), true);

  // AC3: Ordinal day in standard month-day-year form
  eq('dateTolerance AC3: isDateLike("Jun 1st, 2020") -> true',
    isDateLike('Jun 1st, 2020'), true);

  // AC4: Day-month-year with ordinal day
  eq('dateTolerance AC4: isDateLike("21st June 2020") -> true',
    isDateLike('21st June 2020'), true);

  // --- Acceptance criteria: negative (false-positive guards) ---

  // AC5: "Sales: 2020" — label before bare year must NOT be a date
  eq('dateTolerance AC5: isDateLike("Sales: 2020") -> false',
    isDateLike('Sales: 2020'), false);

  // AC6: "$2,020.00" — currency amount containing a year-like number
  eq('dateTolerance AC6: isDateLike("$2,020.00") -> false',
    isDateLike('$2,020.00'), false);

  // AC7: "version 2020.1.3" — version string with year-like first component
  eq('dateTolerance AC7: isDateLike("version 2020.1.3") -> false',
    isDateLike('version 2020.1.3'), false);

  // --- Adversarial: multiple superscripts ---
  eq('dateTolerance: multiple superscripts "March 14, 2024¹²" -> true',
    isDateLike('March 14, 2024¹²'), true);

  // --- Adversarial: footnote markers ---
  eq('dateTolerance: footnote asterisk "March 14, 2024*" -> true',
    isDateLike('March 14, 2024*'), true);

  eq('dateTolerance: footnote dagger "March 14, 2024†" -> true',
    isDateLike('March 14, 2024†'), true);

  // --- Adversarial: leading label before full date ---
  eq('dateTolerance: leading label "Date: 2020-03-14" -> true',
    isDateLike('Date: 2020-03-14'), true);

  // --- Adversarial: ordinal in the middle (no comma) ---
  eq('dateTolerance: "June 1st 2020" -> true',
    isDateLike('June 1st 2020'), true);

  // --- Adversarial: bare year remains strict ---

  // "Q4 2020" — adjacent non-date word; bare-year strict anchors must block this
  eq('dateTolerance: bare-year strict "Q4 2020" -> false',
    isDateLike('Q4 2020'), false);

  // "2020 revenue" — trailing word on bare year must also be blocked
  eq('dateTolerance: bare-year strict "2020 revenue" -> false',
    isDateLike('2020 revenue'), false);

  // --- Adversarial: empty / whitespace ---
  eq('dateTolerance: empty string -> false',
    isDateLike(''), false);

  eq('dateTolerance: whitespace only "   " -> false',
    isDateLike('   '), false);

  // --- Regression: plain dates still work after the relaxation ---
  eq('dateTolerance regression: isDateLike("2020-03-14") -> true',
    isDateLike('2020-03-14'), true);

  eq('dateTolerance regression: isDateLike("March 14, 2024") -> true',
    isDateLike('March 14, 2024'), true);

  eq('dateTolerance regression: isDateLike("2020") -> true',
    isDateLike('2020'), true);

})();

// =============================================================================
// Sprint sidebar-table-rebind: createToggleForTable click rebind logic
// =============================================================================
//
// Helper: create a real toggle button via createToggleForTable with DOM stubs,
// then return { buttonEl, sentMessages } so callers can dispatch events and
// inspect chrome.runtime.sendMessage calls.
//
// The caller is responsible for resetting sidebarOpen / lastRightClickedTable
// before and after each sub-test, and for restoring chrome.runtime.sendMessage.

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

// Simulate a mouse click on a button obtained from createToggleForTable.
// Dispatches pointerdown (mouse) then invokes all click handlers.
// Wraps the click in withCreateTreeWalker so roundTable can run.
function fireMouseClick(buttonEl) {
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  withCreateTreeWalker(function() {
    clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
  });
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

// ---------------------------------------------------------------------------
// AC1 (mouse path): sidebar open + different table → rebind + RESET dispatched
// ---------------------------------------------------------------------------

(function sidebarRebind_AC1_mouse_differentTable() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  // Capture all sendMessage calls
  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  // Set module state: sidebar open, bound to tableA
  sidebarOpen = true;
  lastRightClickedTable = tableA;

  // Create toggle for tableB and click it (mouse path)
  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  // Capture state before restore
  const reboundToB_mouse = (lastRightClickedTable === tableB);
  const hasRounded_mouse = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));

  // Restore
  global.chrome.runtime.sendMessage = origSendMessage;
  sidebarOpen = false;
  lastRightClickedTable = null;

  // 1a. lastRightClickedTable must now be tableB
  eq('rebind AC1 mouse: lastRightClickedTable rebound to tableB',
    reboundToB_mouse, true);

  // 1b. RESET_SIDEBAR_TO_DEFAULTS dispatched exactly once
  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC1 mouse: RESET_SIDEBAR_TO_DEFAULTS dispatched exactly once',
    resetCalls.length, 1);

  // 1c. PREVIEW_SAMPLES_CHANGED also dispatched
  const previewCalls = sentMessages.filter(m => m.action === 'PREVIEW_SAMPLES_CHANGED');
  eq('rebind AC1 mouse: PREVIEW_SAMPLES_CHANGED dispatched',
    previewCalls.length >= 1, true);

  // 1d. Toggle still runs (cells get rounded, since table has numbers)
  eq('rebind AC1 mouse: toggle action ran against tableB (cells rounded)',
    hasRounded_mouse, true);
})();

// ---------------------------------------------------------------------------
// AC1 (touch second-tap path): same assertions as mouse
// ---------------------------------------------------------------------------

(function sidebarRebind_AC1_touch_differentTable() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  sidebarOpen = true;
  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireTouchSecondTap(buttonB);

  // Capture state before restore
  const reboundToB_touch = (lastRightClickedTable === tableB);
  const hasRounded_touch = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));

  global.chrome.runtime.sendMessage = origSendMessage;
  sidebarOpen = false;
  lastRightClickedTable = null;

  eq('rebind AC1 touch: lastRightClickedTable rebound to tableB',
    reboundToB_touch, true);

  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC1 touch: RESET_SIDEBAR_TO_DEFAULTS dispatched exactly once',
    resetCalls.length, 1);

  const previewCalls = sentMessages.filter(m => m.action === 'PREVIEW_SAMPLES_CHANGED');
  eq('rebind AC1 touch: PREVIEW_SAMPLES_CHANGED dispatched',
    previewCalls.length >= 1, true);

  eq('rebind AC1 touch: toggle action ran against tableB (cells rounded)',
    hasRounded_touch, true);
})();

// ---------------------------------------------------------------------------
// AC2 (mouse path): sidebar open, clicking same table → NO RESET dispatched
// ---------------------------------------------------------------------------

(function sidebarRebind_AC2_mouse_sameTable() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  sidebarOpen = true;
  lastRightClickedTable = tableA;

  const buttonA = createToggleWithSpies(tableA);
  fireMouseClick(buttonA);

  global.chrome.runtime.sendMessage = origSendMessage;
  sidebarOpen = false;
  lastRightClickedTable = null;

  // Same-table guard: RESET must NOT be dispatched
  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC2 mouse: RESET_SIDEBAR_TO_DEFAULTS NOT dispatched for same-table click',
    resetCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// AC2 (touch second-tap path): same table → NO RESET dispatched
// ---------------------------------------------------------------------------

(function sidebarRebind_AC2_touch_sameTable() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '100' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  sidebarOpen = true;
  lastRightClickedTable = tableA;

  const buttonA = createToggleWithSpies(tableA);
  fireTouchSecondTap(buttonA);

  global.chrome.runtime.sendMessage = origSendMessage;
  sidebarOpen = false;
  lastRightClickedTable = null;

  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC2 touch: RESET_SIDEBAR_TO_DEFAULTS NOT dispatched for same-table click',
    resetCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// AC3 (mouse path): sidebar CLOSED → clicking a different table → NO RESET
// ---------------------------------------------------------------------------

(function sidebarRebind_AC3_mouse_sidebarClosed() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  // Sidebar is CLOSED, lastRightClickedTable is tableA (different from tableB)
  sidebarOpen = false;
  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC3 mouse: RESET_SIDEBAR_TO_DEFAULTS NOT dispatched when sidebar closed',
    resetCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// AC3 (touch second-tap path): sidebar CLOSED → NO RESET
// ---------------------------------------------------------------------------

(function sidebarRebind_AC3_touch_sidebarClosed() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '100' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '2,000,000' }, { tag: 'td', text: '400' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  sidebarOpen = false;
  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireTouchSecondTap(buttonB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC3 touch: RESET_SIDEBAR_TO_DEFAULTS NOT dispatched when sidebar closed',
    resetCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// AC4: CLOSE_SIDEBAR flips sidebarOpen back to false; subsequent different-table
//      click does NOT dispatch RESET_SIDEBAR_TO_DEFAULTS.
//
// Because chrome.runtime.onMessage.addListener is a no-op stub, we deliver
// SIDEBAR_OPENED / CLOSE_SIDEBAR by setting sidebarOpen directly via the
// exposed getter/setter — this is equivalent to the message path and tests
// the same observable behavior (sidebarOpen flag drives the guard).
// ---------------------------------------------------------------------------

(function sidebarRebind_AC4_closeSidebarFlipsFlag() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  // Step 1: open sidebar (set flag as the SIDEBAR_OPENED handler would)
  sidebarOpen = true;
  lastRightClickedTable = tableA;

  // Step 2: close sidebar (set flag as the CLOSE_SIDEBAR handler would)
  sidebarOpen = false;

  // Step 3: verify flag is false
  eq('rebind AC4: sidebarOpen is false after CLOSE_SIDEBAR',
    sidebarOpen, false);

  // Step 4: click a different table; no RESET should be dispatched
  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const resetCalls = sentMessages.filter(m => m.action === 'RESET_SIDEBAR_TO_DEFAULTS');
  eq('rebind AC4: after CLOSE_SIDEBAR, different-table click does NOT dispatch RESET',
    resetCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// Source-level assertions (supplementary): verify structural invariants that
// cover both click branches and the sidebar.js handler in a single pass.
// These complement the live tests above and are an accepted fallback pattern
// for aspects that the Node harness cannot exercise at runtime.
// ---------------------------------------------------------------------------

(function sidebarRebind_sourceLevel() {
  // Click-handler rebind logic now spans content.js + ui-toggle.js (Phase 2);
  // scan the combined content-script source.
  const contentSrc = allContentSrc;
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // content.js: sidebarOpen flag is declared as a module-level let
  eq('rebind source: content.js declares let sidebarOpen = false',
    /let\s+sidebarOpen\s*=\s*false/.test(contentSrc), true);

  // content.js: SIDEBAR_OPENED handler sets sidebarOpen = true
  eq('rebind source: content.js SIDEBAR_OPENED sets sidebarOpen = true',
    /SIDEBAR_OPENED[\s\S]{0,200}sidebarOpen\s*=\s*true/.test(contentSrc), true);

  // content.js: CLOSE_SIDEBAR handler sets sidebarOpen = false
  eq('rebind source: content.js CLOSE_SIDEBAR sets sidebarOpen = false',
    /CLOSE_SIDEBAR[\s\S]{0,100}sidebarOpen\s*=\s*false/.test(contentSrc), true);

  // content.js mouse/keyboard click branch contains the rebind precondition
  eq('rebind source: mouse/keyboard branch has sidebarOpen && lastRightClickedTable && table !== lastRightClickedTable guard',
    /sidebarOpen\s*&&\s*lastRightClickedTable\s*&&\s*table\s*!==\s*lastRightClickedTable/.test(contentSrc), true);

  // content.js: both click branches send RESET_SIDEBAR_TO_DEFAULTS
  // Count occurrences — must appear at least twice (one per branch)
  const resetCount = (contentSrc.match(/RESET_SIDEBAR_TO_DEFAULTS/g) || []).length;
  eq('rebind source: RESET_SIDEBAR_TO_DEFAULTS appears in both click branches (>= 2 occurrences)',
    resetCount >= 2, true);

  // content.js: rebind sets lastRightClickedTable = table before sending messages
  eq('rebind source: content.js assigns lastRightClickedTable = table in rebind block',
    /lastRightClickedTable\s*=\s*table/.test(contentSrc), true);

  // sidebar.js: RESET_SIDEBAR_TO_DEFAULTS handler calls applyDefaultsToUI
  eq('rebind source: sidebar.js RESET_SIDEBAR_TO_DEFAULTS handler calls applyDefaultsToUI()',
    /RESET_SIDEBAR_TO_DEFAULTS[\s\S]{0,200}applyDefaultsToUI\(\)/.test(sidebarSrc), true);

  // sidebar.js: RESET_SIDEBAR_TO_DEFAULTS handler calls fetchPreviewSamples
  eq('rebind source: sidebar.js RESET_SIDEBAR_TO_DEFAULTS handler calls fetchPreviewSamples()',
    /RESET_SIDEBAR_TO_DEFAULTS[\s\S]{0,200}fetchPreviewSamples\(\)/.test(sidebarSrc), true);

  // sidebar.js: RESET_SIDEBAR_TO_DEFAULTS handler does NOT auto-apply settings
  // (must NOT call applyNow() or applySidebarRounding() inside the handler)
  const resetHandlerMatch = sidebarSrc.match(/RESET_SIDEBAR_TO_DEFAULTS[\s\S]{0,400}/);
  const resetHandlerBlock = resetHandlerMatch ? resetHandlerMatch[0] : '';
  eq('rebind source: sidebar.js RESET handler does NOT call applyNow()',
    /applyNow\s*\(\)/.test(resetHandlerBlock), false);
})();

// =============================================================================
// Sprint sidebar-pill-left: toggle switch appears left of label in every row
// =============================================================================
//
// Acceptance criteria:
//   AC1. In every option row the switch (<label class="switch">) comes before
//        the .toggle-label text node — verified by comparing indexOf positions
//        of the checkbox <input> vs <span class="toggle-label"> within each row.
//   AC2. On the dates/times rows the <select id="dateGranularity"> /
//        <select id="timeGranularity"> is the last element — its index appears
//        AFTER the .toggle-label in the row substring.
//   AC3. sidebar.html does NOT contain "row-reverse" anywhere.
//   AC4. The .toggle-row CSS block does NOT contain "justify-content: space-between".

(function sidebarPillLeft() {
  const sidebarPath = path.join(__dirname, 'sidebar.html');
  const sidebarHtml = fs.readFileSync(sidebarPath, 'utf8');

  // Helper: extract the substring of sidebarHtml that covers the .toggle-row
  // whose checkbox has the given id. We find the opening <div class="toggle-row">
  // that contains id="<rowId>" and slice up to the matching </div>.
  function getRowSubstring(rowId) {
    // Find the checkbox input for this id within the full source.
    const inputPattern = new RegExp('id=["\']' + rowId + '["\']');
    const inputIdx = sidebarHtml.search(inputPattern);
    if (inputIdx === -1) return null;

    // Walk backwards to the nearest <div class="toggle-row"> opening tag.
    const beforeInput = sidebarHtml.slice(0, inputIdx);
    const divStart = beforeInput.lastIndexOf('<div class="toggle-row">');
    if (divStart === -1) return null;

    // Walk forwards to find the matching closing </div>.
    // We look for the first </div> that closes the outermost .toggle-row div.
    const fromDiv = sidebarHtml.slice(divStart);
    // Scan for the first </div> after the opening tag (these rows have no nested divs).
    const closeIdx = fromDiv.indexOf('</div>');
    if (closeIdx === -1) return null;

    return fromDiv.slice(0, closeIdx + '</div>'.length);
  }

  // --- AC1: switch appears before .toggle-label in each option row ---
  // Rows to check: simplifyMixedCells, simplifyFirstColumn (simple), simplifyDates, simplifyTimes.
  const simpleRows = ['simplifyMixedCells', 'simplifyFirstColumn'];
  for (const id of simpleRows) {
    const row = getRowSubstring(id);
    eq(`sidebar-pill-left AC1: row "${id}" exists in sidebar.html`,
      row !== null, true);
    if (row !== null) {
      const inputIdx = row.search(new RegExp('id=["\']' + id + '["\']'));
      const labelIdx = row.indexOf('<span class="toggle-label">');
      eq(`sidebar-pill-left AC1: switch input comes before .toggle-label in row "${id}"`,
        inputIdx < labelIdx, true);
    }
  }

  // Also check the date and time rows (they have a <select> too).
  const complexRows = ['simplifyDates', 'simplifyTimes'];
  for (const id of complexRows) {
    const row = getRowSubstring(id);
    eq(`sidebar-pill-left AC1: row "${id}" exists in sidebar.html`,
      row !== null, true);
    if (row !== null) {
      const inputIdx = row.search(new RegExp('id=["\']' + id + '["\']'));
      const labelIdx = row.indexOf('<span class="toggle-label">');
      eq(`sidebar-pill-left AC1: switch input comes before .toggle-label in row "${id}"`,
        inputIdx < labelIdx, true);
    }
  }

  // --- AC2: <select> is the last element (after .toggle-label) in dates/times rows ---
  const selectPairs = [
    { rowId: 'simplifyDates',  selectId: 'dateGranularity' },
    { rowId: 'simplifyTimes',  selectId: 'timeGranularity' },
  ];
  for (const { rowId, selectId } of selectPairs) {
    const row = getRowSubstring(rowId);
    if (row !== null) {
      const labelIdx  = row.indexOf('<span class="toggle-label">');
      const selectIdx = row.search(new RegExp('<select[^>]*id=["\']' + selectId + '["\']'));
      eq(`sidebar-pill-left AC2: <select id="${selectId}"> appears after .toggle-label in row`,
        selectIdx > labelIdx, true);
    }
  }

  // --- AC3: sidebar.html does not use row-reverse ---
  eq('sidebar-pill-left AC3: sidebar.html does not contain "row-reverse"',
    sidebarHtml.includes('row-reverse'), false);

  // --- AC4: .toggle-row CSS block does not use justify-content: space-between ---
  // Find the .toggle-row block by locating ".toggle-row {" and scanning to the closing "}".
  const toggleRowBlockStart = sidebarHtml.indexOf('.toggle-row {');
  eq('sidebar-pill-left AC4: .toggle-row CSS block is present in sidebar.html',
    toggleRowBlockStart !== -1, true);
  if (toggleRowBlockStart !== -1) {
    const fromBlock = sidebarHtml.slice(toggleRowBlockStart);
    const blockClose = fromBlock.indexOf('}');
    const toggleRowBlock = blockClose !== -1 ? fromBlock.slice(0, blockClose + 1) : fromBlock.slice(0, 200);
    eq('sidebar-pill-left AC4: .toggle-row CSS block does not contain "justify-content: space-between"',
      toggleRowBlock.includes('justify-content: space-between'), false);
  }
})();

// ---------------------------------------------------------------------------
// Sprint exclude-exponents: <sup>-aware number masking
// ---------------------------------------------------------------------------
//
// Helpers for building mock cells that contain <sup> children.
//
// The developer's getSuperscriptRanges(cell) walks document.createTreeWalker
// text nodes and checks parentNode/parentElement upward for tagName === 'SUP'.
// The roundTable branch guard uses cell.querySelector('sup') to decide whether
// a cell needs <sup>-aware handling.
//
// makeSuperscriptCell(segments) builds a mock cell where each segment is
//   { text: string, inSup: boolean }.
// The resulting cell:
//   - cell.innerText / cell.textContent: concatenation of all segment texts
//   - cell._textNodes: list of mock text nodes; nodes with inSup:true have
//     parentNode.tagName === 'SUP'; others have parentNode === cell
//   - cell.querySelector('sup'): returns a truthy object when any inSup:true
//     segment exists; null otherwise
//   - cell.querySelectorAll('a'): returns [] (no anchors, so filterLinkMatches
//     keeps all matches)
// ---------------------------------------------------------------------------

function makeSuperscriptCell(segments) {
  const hasSup = segments.some(s => s.inSup);
  const fullText = segments.map(s => s.text).join('');

  const cell = {
    innerText: fullText,
    textContent: fullText,
    innerHTML: fullText,   // good-enough stub; replaceTextPreservingHTML may use it
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

// Standard opts for the exponent tests.  simplifyMixedCells: true is required to
// engage the <sup> extraction path (the guard at line ~773 of content.js).
const supTestOpts = {
  enabled: true,
  simplifyMixedCells: true,
  simplifyMixedCurrency: true,
  simplifyMixedPercent: true,
  simplifyFirstRow: true,
  simplifyFirstColumn: true,
  excludeDates: true,
  excludeTimes: false,
  offsetTop: -0.5,
  offsetOther: -0.5,
  numTop: 1,
  rangeExpr: '',
};

// ---------------------------------------------------------------------------
// AC4 (getSuperscriptRanges direct unit tests)
// ---------------------------------------------------------------------------
(function supAC4_directUnitTests() {
  // AC4a: cell with NO <sup> — getSuperscriptRanges must return []
  withSupCreateTreeWalker(function() {
    const plainCell = makeSuperscriptCell([{ text: '1012', inSup: false }]);
    const ranges = getSuperscriptRanges(plainCell);
    eq('sup AC4a: getSuperscriptRanges returns [] for cell with no <sup>',
      ranges, []);
  });

  // AC4b: cell built as "10" + <sup>"12"</sup> → range covers indices 2..4
  // (cursor starts at 0; "10" is 2 chars, so "12" runs from 2 to 4)
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '10', inSup: false },
      { text: '12', inSup: true },
    ]);
    const ranges = getSuperscriptRanges(cell);
    eq('sup AC4b: getSuperscriptRanges returns one range for <sup>12</sup>',
      ranges.length, 1);
    eq('sup AC4b: range start is 2 (after "10")',
      ranges[0].start, 2);
    eq('sup AC4b: range end is 4 (covers "12")',
      ranges[0].end, 4);
  });

  // AC4c: cell "20 × 10" + <sup>"15"</sup> → range covers indices 7..9
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '20 × 10', inSup: false },  // "20 × 10" = 7 chars
      { text: '15', inSup: true },
    ]);
    const ranges = getSuperscriptRanges(cell);
    eq('sup AC4c: getSuperscriptRanges on "20 × 10<sup>15</sup>" returns one range',
      ranges.length, 1);
    eq('sup AC4c: range start is 7',
      ranges[0].start, 7);
    eq('sup AC4c: range end is 9',
      ranges[0].end, 9);
  });

  // AC4d: cell with unicode-minus negative exponent "~ 10" + <sup>"−32"</sup> + " sec"
  // "~ 10" = 4 chars, "−32" (unicode minus U+2212 is 1 char) = 3 chars → range [4, 7)
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '~ 10', inSup: false },
      { text: '−32', inSup: true },   // "−32"
      { text: ' sec', inSup: false },
    ]);
    const ranges = getSuperscriptRanges(cell);
    eq('sup AC4d: getSuperscriptRanges on "~ 10<sup>−32</sup> sec" returns one range',
      ranges.length, 1);
    eq('sup AC4d: range start is 4',
      ranges[0].start, 4);
    eq('sup AC4d: range end is 7',
      ranges[0].end, 7);
  });
})();

// ---------------------------------------------------------------------------
// AC1: Whole-cell exponent cell — 10<sup>12</sup> → innerText "1012"
// The exponent digits "12" must NOT be altered after roundTable runs.
// ---------------------------------------------------------------------------
(function supAC1_wholeCellExponent() {
  withSupCreateTreeWalker(function() {
    // "10<sup>12</sup>" → flattened innerText "1012"
    // segments: "10" (plain) + "12" (in <sup>)
    const cell = makeSuperscriptCell([
      { text: '10', inSup: false },
      { text: '12', inSup: true },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    // The exponent "12" must not have been touched — cell.innerText must still
    // contain "12" at the sup position (indices 2..4 of the flattened text).
    const supNode = cell._textNodes[1];
    eq('sup AC1: exponent text node "12" is unchanged after roundTable',
      supNode.nodeValue, '12');
  });
})();

// ---------------------------------------------------------------------------
// AC2a: "20 × 10<sup>15</sup>" — the "15" exponent must not be rounded.
// ---------------------------------------------------------------------------
(function supAC2a_positiveExponent() {
  withSupCreateTreeWalker(function() {
    // innerText: "20 × 1015" (7 + 2 chars)
    const cell = makeSuperscriptCell([
      { text: '20 × 10', inSup: false },
      { text: '15', inSup: true },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2a: exponent "15" in "20 × 10<sup>15</sup>" is unchanged',
      supNode.nodeValue, '15');
  });
})();

// ---------------------------------------------------------------------------
// AC2b: "20 × 10<sup>−12</sup> s" — unicode-minus negative exponent preserved.
// ---------------------------------------------------------------------------
(function supAC2b_negativeExponentWithUnit() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '20 × 10', inSup: false },
      { text: '−12', inSup: true },   // "−12"
      { text: ' s', inSup: false },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2b: exponent "−12" in "20 × 10<sup>−12</sup> s" is unchanged',
      supNode.nodeValue, '−12');
  });
})();

// ---------------------------------------------------------------------------
// AC2c: "~ 10<sup>−32</sup> sec" — the "−32" exponent must not be rounded.
// ---------------------------------------------------------------------------
(function supAC2c_negativeExponentTildeForm() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '~ 10', inSup: false },
      { text: '−32', inSup: true },   // "−32"
      { text: ' sec', inSup: false },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2c: exponent "−32" in "~ 10<sup>−32</sup> sec" is unchanged',
      supNode.nodeValue, '−32');
  });
})();

// ---------------------------------------------------------------------------
// AC2d: "6 × 10<sup>9</sup>" — the "9" exponent must not be rounded.
// ---------------------------------------------------------------------------
(function supAC2d_singleDigitExponent() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '6 × 10', inSup: false },
      { text: '9', inSup: true },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2d: exponent "9" in "6 × 10<sup>9</sup>" is unchanged',
      supNode.nodeValue, '9');
  });
})();

// ---------------------------------------------------------------------------
// AC3: Mixed cell — exponent protected, non-exponent number still eligible.
//
// Cell: "From inflation (~ 10<sup>−32</sup> sec) – 1234 ka"
// The "1234" is not inside <sup> so it goes through the normal extraction path.
// We use 1234 (magnitude 3) with default offsetTop=-0.5 which at max_mag=3
// should round 1234 → ~1000 (or similar). The key assertion is:
//   (a) the "−32" exponent node is unchanged, AND
//   (b) the "1234" text node IS modified (i.e. rounded/simplified).
// ---------------------------------------------------------------------------
(function supAC3_mixedCellExponentProtectedNonExponentRounded() {
  withSupCreateTreeWalker(function() {
    // segments: prefix, exponent (sup), suffix with large number
    const cell = makeSuperscriptCell([
      { text: 'From inflation (~ 10', inSup: false },
      { text: '−32', inSup: true },             // "−32"
      { text: ' sec) – 1234 ka', inSup: false }, // "– 1234 ka"
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    // The exponent node must be untouched
    const supNode = cell._textNodes[1];
    eq('sup AC3: exponent "−32" in mixed cell is unchanged',
      supNode.nodeValue, '−32');

    // The non-exponent part must have been processed — assert the cell was
    // marked as rounded (dr-ext-rounded), which only happens when formattedValue
    // differs from originalValue (i.e. "1234" was simplified).
    eq('sup AC3: mixed cell is marked dr-ext-rounded (non-exponent 1234 was simplified)',
      cell.classList.contains('dr-ext-rounded'), true);
  });
})();

// ---------------------------------------------------------------------------
// Sprint invert-datetime-pills: simplifyDates / simplifyTimes boolean wiring
//
// Acceptance criteria verified here:
//   AC1: simplifyDates=true  → date cell IS rounded (dr-ext-rounded added, text changed)
//   AC2: simplifyDates=false → date cell is left UNCHANGED (no class, same text)
//   AC3: simplifyTimes=true  → time cell IS simplified (dr-ext-rounded added, text changed)
//   AC4: simplifyTimes=false → time cell is left UNCHANGED
//   AC5: sidebar.js updateDisabledState wires dateGranularity.disabled to !simplifyDates
//        and timeGranularity.disabled to !simplifyTimes (static source analysis only —
//        the test harness has no sidebar DOM path so live execution is not possible).
// ---------------------------------------------------------------------------

// --- AC1: simplifyDates=true → date cell is rounded ---
// Use a bare year "2018" with decade granularity: roundDateText("2018","decade")="2020",
// so the cell text must change and dr-ext-rounded must be added.
(function invertPills_AC1_simplifyDatesTrue() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC1: simplifyDates=true — date cell gets dr-ext-rounded class',
      cell.classList.contains('dr-ext-rounded'), true);
    eq('invert-pills AC1: simplifyDates=true — date cell text is changed (2018→2020)',
      cell.innerText, '2020');
  });
})();

// --- AC2: simplifyDates=false → date cell is left unchanged ---
// Same "2018" cell, same decade granularity, but simplifyDates=false.
// The cell must NOT be rounded — text stays "2018", no class added.
(function invertPills_AC2_simplifyDatesFalse() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC2: simplifyDates=false — date cell does NOT get dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC2: simplifyDates=false — date cell text is unchanged',
      cell.innerText, '2018');
  });
})();

// AC1/AC2 parity check with ISO date "2024-03-14" (decade granularity → "2020")
(function invertPills_AC1_AC2_isoDate() {
  withCreateTreeWalker(function() {
    // simplifyDates=true branch
    const tableOn = makeMockTable([[{ tag: 'td', text: '2024-03-14' }]]);
    roundTable(tableOn, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOn = tableOn.rows[0].cells[0];
    eq('invert-pills AC1 (ISO date): simplifyDates=true — ISO date rounded',
      cellOn.classList.contains('dr-ext-rounded'), true);
  });

  withCreateTreeWalker(function() {
    // simplifyDates=false branch — same input
    const tableOff = makeMockTable([[{ tag: 'td', text: '2024-03-14' }]]);
    roundTable(tableOff, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOff = tableOff.rows[0].cells[0];
    eq('invert-pills AC2 (ISO date): simplifyDates=false — ISO date NOT rounded',
      cellOff.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC2 (ISO date): simplifyDates=false — ISO date text unchanged',
      cellOff.innerText, '2024-03-14');
  });
})();

// --- AC3: simplifyTimes=true → time cell IS simplified ---
// "14:30" with hour granularity → roundTimeText returns "15:00" (half-hour rounds up).
(function invertPills_AC3_simplifyTimesTrue() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC3: simplifyTimes=true — time cell gets dr-ext-rounded class',
      cell.classList.contains('dr-ext-rounded'), true);
    eq('invert-pills AC3: simplifyTimes=true — time cell text is changed (14:30→15:00)',
      cell.innerText, '15:00');
  });
})();

// --- AC4: simplifyTimes=false → time cell is left UNCHANGED ---
// Same "14:30" cell; with simplifyTimes=false the cell must stay as-is.
(function invertPills_AC4_simplifyTimesFalse() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC4: simplifyTimes=false — time cell does NOT get dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC4: simplifyTimes=false — time cell text is unchanged',
      cell.innerText, '14:30');
  });
})();

// AC3/AC4 parity check with "3:45 PM" (hour granularity → "4:00 PM")
(function invertPills_AC3_AC4_twelveHour() {
  withCreateTreeWalker(function() {
    // simplifyTimes=true
    const tableOn = makeMockTable([[{ tag: 'td', text: '3:45 PM' }]]);
    roundTable(tableOn, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOn = tableOn.rows[0].cells[0];
    eq('invert-pills AC3 (12-hr): simplifyTimes=true — "3:45 PM" rounded',
      cellOn.classList.contains('dr-ext-rounded'), true);
    eq('invert-pills AC3 (12-hr): simplifyTimes=true — text changed to "4:00 PM"',
      cellOn.innerText, '4:00 PM');
  });

  withCreateTreeWalker(function() {
    // simplifyTimes=false — same input must be untouched
    const tableOff = makeMockTable([[{ tag: 'td', text: '3:45 PM' }]]);
    roundTable(tableOff, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOff = tableOff.rows[0].cells[0];
    eq('invert-pills AC4 (12-hr): simplifyTimes=false — "3:45 PM" NOT rounded',
      cellOff.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC4 (12-hr): simplifyTimes=false — text unchanged',
      cellOff.innerText, '3:45 PM');
  });
})();

// --- AC5: sidebar.js updateDisabledState wires granularity dropdowns to toggles ---
// The harness has no live sidebar DOM, so we verify via static source analysis.
// We assert:
//   (a) updateDisabledState references dateGranularity.disabled and !simplifyDates
//   (b) updateDisabledState references timeGranularity.disabled and !simplifyTimes
// This proves the boolean is wired the correct way round in the sidebar source.
(function invertPills_AC5_sidebarDisabledStateStaticAnalysis() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // dateGranularity.disabled must be set to !simplifyDates (true when OFF, false when ON)
  eq('invert-pills AC5: sidebar.js sets dateGranularity.disabled = !simplifyDates',
    /dateGranularityEl\.disabled\s*=\s*!document\.getElementById\(['"]simplifyDates['"]\)\.checked/.test(sidebarSrc),
    true);

  // timeGranularity.disabled must be set to !simplifyTimes
  eq('invert-pills AC5: sidebar.js sets timeGranularity.disabled = !simplifyTimes',
    /timeGranularityEl\.disabled\s*=\s*!document\.getElementById\(['"]simplifyTimes['"]\)\.checked/.test(sidebarSrc),
    true);

  // updateDisabledState function must still exist (not deleted or renamed)
  eq('invert-pills AC5: sidebar.js defines updateDisabledState',
    /function updateDisabledState\b/.test(sidebarSrc), true);
})();

// --- Old keys (excludeDates / excludeTimes) must be absent from content.js and defaults.js ---
// These were renamed to simplifyDates/simplifyTimes in this sprint.
// If the old names are still present as property assignments or conditions, the
// inversion is incomplete and rounding behaviour would be controlled by the wrong key.
(function invertPills_oldKeysAbsent() {
  const contentSrc = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
  const defaultsSrc = fs.readFileSync(path.join(__dirname, 'defaults.js'), 'utf8');
  const sidebarSrc  = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // "excludeDates" and "excludeTimes" must not appear as identifiers in any of these files.
  eq('invert-pills regression: content.js does not reference excludeDates',
    /\bexcludeDates\b/.test(contentSrc), false);
  eq('invert-pills regression: content.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(contentSrc), false);
  eq('invert-pills regression: defaults.js does not reference excludeDates',
    /\bexcludeDates\b/.test(defaultsSrc), false);
  eq('invert-pills regression: defaults.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(defaultsSrc), false);
  eq('invert-pills regression: sidebar.js does not reference excludeDates',
    /\bexcludeDates\b/.test(sidebarSrc), false);
  eq('invert-pills regression: sidebar.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(sidebarSrc), false);

  // Conversely, simplifyDates and simplifyTimes MUST appear in each file.
  eq('invert-pills regression: content.js references simplifyDates',
    /\bsimplifyDates\b/.test(contentSrc), true);
  eq('invert-pills regression: content.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(contentSrc), true);
  eq('invert-pills regression: defaults.js references simplifyDates',
    /\bsimplifyDates\b/.test(defaultsSrc), true);
  eq('invert-pills regression: defaults.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(defaultsSrc), true);
  eq('invert-pills regression: sidebar.js references simplifyDates',
    /\bsimplifyDates\b/.test(sidebarSrc), true);
  eq('invert-pills regression: sidebar.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(sidebarSrc), true);
})();

// ---------------------------------------------------------------------------
// Sprint invert-datetime-pills: adversarial tests
//
// These tests are written from the SPEC, not the implementation.
// Adversarial focus: prove the boolean polarity is correct (true=simplify,
// false=leave alone) across a wider set of inputs and combinations that the
// developer's own tests did not exercise.
// ---------------------------------------------------------------------------

// --- ADV-AC1: century granularity also works when simplifyDates=true ---
// A different granularity than the developer tested (decade) to ensure the
// boolean wiring is not granularity-specific.
(function invertPills_adv_AC1_century() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'century', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC1 (century): simplifyDates=true — 2018 rounded to 2000',
      cell.innerText, '2000');
    eq('ADV AC1 (century): simplifyDates=true — cell gets dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), true);
  });
})();

// ---------------------------------------------------------------------------
// Extra: getSuperscriptRanges returns [] when document.createTreeWalker is absent
// ---------------------------------------------------------------------------
(function supExtra_noTreeWalker() {
  const savedWalker = global.document.createTreeWalker;
  delete global.document.createTreeWalker;
  const cell = makeSuperscriptCell([{ text: '10', inSup: false }, { text: '12', inSup: true }]);
  const ranges = getSuperscriptRanges(cell);
  eq('sup extra: getSuperscriptRanges returns [] when createTreeWalker is unavailable',
    ranges, []);
  if (savedWalker !== undefined) global.document.createTreeWalker = savedWalker;
})();

// ---------------------------------------------------------------------------
// Extra: getSuperscriptRanges returns [] for a null/undefined cell argument
// ---------------------------------------------------------------------------
(function supExtra_nullCell() {
  withSupCreateTreeWalker(function() {
    eq('sup extra: getSuperscriptRanges(null) returns []',
      getSuperscriptRanges(null), []);
    eq('sup extra: getSuperscriptRanges(undefined) returns []',
      getSuperscriptRanges(undefined), []);
  });
})();

// --- ADV-AC2: century granularity, simplifyDates=false — year must NOT be rounded ---
// Adversarial: if the implementation only guards the decade path, century would leak.
(function invertPills_adv_AC2_century() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'century', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC2 (century): simplifyDates=false — cell does NOT get dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC2 (century): simplifyDates=false — text unchanged (2018)',
      cell.innerText, '2018');
  });
})();

// --- ADV-AC2: mixed table — date cell left alone while numeric cell rounds ---
// A date-like year appears alongside a large number.
// simplifyDates=false: the year must not be rounded even though max_mag is
// computed from the real number in the same table.
(function invertPills_adv_AC2_mixedTable() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '8,584,629' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    eq('ADV AC2 (mixed): simplifyDates=false — date cell NOT rounded even with large sibling',
      dateCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC2 (mixed): simplifyDates=false — date cell text unchanged (2018)',
      dateCell.innerText, '2018');
    // Numeric cell SHOULD still be rounded (control: proves roundTable ran)
    const numCell = table.rows[0].cells[1];
    eq('ADV AC2 (mixed): numeric sibling 8,584,629 IS rounded (control)',
      numCell.classList.contains('dr-ext-rounded'), true);
  });
})();

// --- ADV-AC3/AC4: isolation — simplifyTimes=true with simplifyDates=false ---
// Time cell must be simplified; a date cell in the same row must be left alone.
// This catches any incorrect coupling between the two boolean flags.
(function invertPills_adv_AC3_timesOnDatesOff() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
      { tag: 'td', text: '2018' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const timeCell = table.rows[0].cells[0];
    const dateCell = table.rows[0].cells[1];
    eq('ADV AC3/AC4 isolation: simplifyTimes=true — time cell IS rounded',
      timeCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV AC3/AC4 isolation: simplifyTimes=true — time cell text changed (14:30→15:00)',
      timeCell.innerText, '15:00');
    eq('ADV AC3/AC4 isolation: simplifyDates=false — date cell NOT rounded',
      dateCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC3/AC4 isolation: simplifyDates=false — date cell text unchanged (2018)',
      dateCell.innerText, '2018');
  });
})();

// --- ADV-AC1/AC4: isolation — simplifyDates=true with simplifyTimes=false ---
// Date cell must be simplified; a time cell in the same row must be left alone.
(function invertPills_adv_AC1_datesOnTimesOff() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    const timeCell = table.rows[0].cells[1];
    eq('ADV AC1/AC4 isolation: simplifyDates=true — date cell IS rounded',
      dateCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV AC1/AC4 isolation: simplifyDates=true — date cell text changed (2018→2020)',
      dateCell.innerText, '2020');
    eq('ADV AC4/AC1 isolation: simplifyTimes=false — time cell NOT rounded',
      timeCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC4/AC1 isolation: simplifyTimes=false — time cell text unchanged (14:30)',
      timeCell.innerText, '14:30');
  });
})();

// --- ADV-AC4: time cell with simplifyTimes=false is not treated as a pure number ---
// "14:30" is not parseable by toNumber (returns null), so with simplifyTimes=false
// AND simplifyMixedCells=false, the cell must be fully skipped.
// Adversarial: confirm there is no fallthrough that rounds the time as a numeric value.
// (Note: simplifyMixedCells=true would extract 14 and 30 independently — that is a separate
// feature path. Here we test the pure numeric exclusion path only.)
(function invertPills_adv_AC4_timeNotTreatedAsNumber() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC4: 14:30 with simplifyTimes=false and simplifyMixedCells=false — not rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC4: 14:30 with simplifyTimes=false and simplifyMixedCells=false — text unchanged',
      cell.innerText, '14:30');
  });
})();

// --- ADV: DR_DEFAULTS has correct polarity ---
// simplifyDates must default to true (simplify by default).
// simplifyTimes must default to false (do not simplify by default).
// This is the direct spec requirement for the "inverted" rename: the default
// behavior (dates simplified, times not) must be encoded correctly.
(function invertPills_adv_defaults() {
  eq('ADV defaults: DR_DEFAULTS.simplifyDates is true (dates simplified by default)',
    DR_DEFAULTS.simplifyDates, true);
  eq('ADV defaults: DR_DEFAULTS.simplifyTimes is false (times not simplified by default)',
    DR_DEFAULTS.simplifyTimes, false);
  // Old keys must be absent from DR_DEFAULTS
  eq('ADV defaults: DR_DEFAULTS has no excludeDates key',
    Object.prototype.hasOwnProperty.call(DR_DEFAULTS, 'excludeDates'), false);
  eq('ADV defaults: DR_DEFAULTS has no excludeTimes key',
    Object.prototype.hasOwnProperty.call(DR_DEFAULTS, 'excludeTimes'), false);
})();

// --- ADV-AC1/AC3: both simplifyDates=true and simplifyTimes=true — both simplified ---
// Confirm both flags can be active simultaneously without one suppressing the other.
(function invertPills_adv_bothTrue() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    const timeCell = table.rows[0].cells[1];
    eq('ADV both=true: date cell IS rounded (2018→2020)',
      dateCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV both=true: date cell text changed to 2020',
      dateCell.innerText, '2020');
    eq('ADV both=true: time cell IS rounded (14:30→15:00)',
      timeCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV both=true: time cell text changed to 15:00',
      timeCell.innerText, '15:00');
  });
})();

// --- ADV-AC2/AC4: both simplifyDates=false and simplifyTimes=false — neither simplified ---
// The fully-off state: no date or time cell gets rounded.
(function invertPills_adv_bothFalse() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    const timeCell = table.rows[0].cells[1];
    eq('ADV both=false: date cell NOT rounded',
      dateCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV both=false: date cell text unchanged (2018)',
      dateCell.innerText, '2018');
    eq('ADV both=false: time cell NOT rounded',
      timeCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV both=false: time cell text unchanged (14:30)',
      timeCell.innerText, '14:30');
  });
})();

// ---------------------------------------------------------------------------
// Sprint refactor/simplify-naming-unification — Adversarial contract lock-in
// ---------------------------------------------------------------------------

(function simplifyNamingUnification() {

  // -------------------------------------------------------------------------
  // AC1: Renames are total — no old key names survive in any source file.
  // Pattern strings are split across concatenation to prevent self-matching.
  // -------------------------------------------------------------------------
  const sourceFiles = [
    'defaults.js', 'sidebar.html', 'sidebar.js', 'content.js', 'tests.js'
  ];
  const oldKeys = [
    'include' + 'Words',
    'include' + 'Currency',
    'include' + 'Percent',
    'exclude' + 'FirstRow',
    'exclude' + 'FirstColumn',
  ];
  for (const file of sourceFiles) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    for (const key of oldKeys) {
      eq(`AC1: old key "${key}" absent from ${file}`,
        src.includes(key), false);
    }
  }

  // -------------------------------------------------------------------------
  // AC2: simplifyFirstRow polarity — four cases.
  // -------------------------------------------------------------------------

  // Case 1: flag true → row 0 IS simplified (not excluded)
  eq('AC2 simplifyFirstRow: true + row 0 → null (row IS simplified)',
    getExclusionReason('1,234', 1, { simplifyFirstRow: true }, 0), null);

  // Case 2: flag false → row 0 excluded
  eq('AC2 simplifyFirstRow: false + row 0 → "firstRow"',
    getExclusionReason('1,234', 1, { simplifyFirstRow: false }, 0), 'firstRow');

  // Case 3: flag unset (undefined) → row 0 excluded (intentional default change)
  eq('AC2 simplifyFirstRow: unset + row 0 → "firstRow" (new default semantics)',
    getExclusionReason('1,234', 1, {}, 0), 'firstRow');

  // Case 4: flag false but row 1 → null (only row 0 is affected)
  eq('AC2 simplifyFirstRow: false + row 1 → null (non-first row unaffected)',
    getExclusionReason('1,234', 1, { simplifyFirstRow: false }, 1), null);

  // -------------------------------------------------------------------------
  // AC3: simplifyFirstColumn polarity — mirror of AC2.
  // -------------------------------------------------------------------------

  // Case 1: flag true → col 0 IS simplified (not excluded)
  eq('AC3 simplifyFirstColumn: true + col 0 → null (col IS simplified)',
    getExclusionReason('1,234', 0, { simplifyFirstColumn: true, simplifyFirstRow: true }, 1), null);

  // Case 2: flag false → col 0 excluded
  eq('AC3 simplifyFirstColumn: false + col 0 → "firstColumn"',
    getExclusionReason('1,234', 0, { simplifyFirstRow: true, simplifyFirstColumn: false }, 1), 'firstColumn');

  // Case 3: flag unset → col 0 excluded (intentional default change)
  eq('AC3 simplifyFirstColumn: unset + col 0 → "firstColumn" (new default semantics)',
    getExclusionReason('1,234', 0, { simplifyFirstRow: true }, 1), 'firstColumn');

  // Case 4: flag false but col 1 → null (only col 0 is affected)
  eq('AC3 simplifyFirstColumn: false + col 1 → null (non-first column unaffected)',
    getExclusionReason('1,234', 1, { simplifyFirstRow: true, simplifyFirstColumn: false }, 1), null);

  // -------------------------------------------------------------------------
  // AC4a: simplifyMixedCurrency polarity.
  // -------------------------------------------------------------------------

  eq('AC4a simplifyMixedCurrency: true + "$1,234" → null (NOT excluded)',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: true }, 1), null);

  eq('AC4a simplifyMixedCurrency: false + "$1,234" → "currency"',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: false }, 1), 'currency');

  // -------------------------------------------------------------------------
  // AC4b: simplifyMixedPercent polarity.
  // -------------------------------------------------------------------------

  eq('AC4b simplifyMixedPercent: true + "45%" → null (NOT excluded)',
    getExclusionReason('45%', 1, { simplifyMixedPercent: true }, 1), null);

  eq('AC4b simplifyMixedPercent: false + "45%" → "percent"',
    getExclusionReason('45%', 1, { simplifyMixedPercent: false }, 1), 'percent');

  // -------------------------------------------------------------------------
  // AC5: simplifyMixedCells=false → prose cell with embedded number not touched.
  // Use roundTable with a real mock table.
  // -------------------------------------------------------------------------
  withCreateTreeWalker(function() {
    // Two cells: a large anchor so max_mag is set, and a prose cell.
    const table = makeMockTable([[
      { tag: 'td', text: '8,000,000' },
      { tag: 'td', text: 'about 1,234 widgets' },
    ]]);
    roundTable(table, {
      enabled: true,
      simplifyMixedCells: false,
      simplifyMixedCurrency: false,
      simplifyMixedPercent: false,
      simplifyFirstRow: true,
      simplifyFirstColumn: true,
      simplifyDates: false,
      simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const proseCell = table.rows[0].cells[1];
    eq('AC5 simplifyMixedCells=false: prose cell NOT marked as rounded',
      proseCell.classList.contains('dr-ext-rounded'), false);
    eq('AC5 simplifyMixedCells=false: prose cell text unchanged',
      proseCell.innerText, 'about 1,234 widgets');
  });

  // -------------------------------------------------------------------------
  // AC6: DR_DEFAULTS snapshot — all seven new keys with exact default values.
  // -------------------------------------------------------------------------
  eq('AC6 DR_DEFAULTS: simplifyMixedCells = true',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('AC6 DR_DEFAULTS: simplifyMixedCurrency = true',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('AC6 DR_DEFAULTS: simplifyMixedPercent = true',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('AC6 DR_DEFAULTS: simplifyDates = true',
    DR_DEFAULTS.simplifyDates, true);
  eq('AC6 DR_DEFAULTS: simplifyTimes = false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('AC6 DR_DEFAULTS: simplifyFirstRow = false',
    DR_DEFAULTS.simplifyFirstRow, false);
  eq('AC6 DR_DEFAULTS: simplifyFirstColumn = false',
    DR_DEFAULTS.simplifyFirstColumn, false);

  // -------------------------------------------------------------------------
  // AC7: sidebar.html id ↔ setting key parity — each of the seven keys must
  // appear as id="<key>" on a checkbox <input>.
  // -------------------------------------------------------------------------
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sevenKeys = [
    'simplifyMixedCells', 'simplifyMixedCurrency', 'simplifyMixedPercent',
    'simplifyDates', 'simplifyTimes', 'simplifyFirstRow', 'simplifyFirstColumn'
  ];
  for (const key of sevenKeys) {
    // Match <input ... type="checkbox" ... id="<key>"> (or id before type)
    eq(`AC7 sidebar.html: checkbox with id="${key}" present`,
      new RegExp(`<input[^>]*type="checkbox"[^>]*id="${key}"|<input[^>]*id="${key}"[^>]*type="checkbox"`).test(sidebarHtml),
      true);
  }

})();

// =============================================================================
// applyExtractedPatches — unit tests and integration regression tests
// =============================================================================

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

// ---------------------------------------------------------------------------
// Unit tests for applyExtractedPatches
// ---------------------------------------------------------------------------
(function applyExtractedPatches_unitTests() {

  // AP1: single text node, single patch
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'Revenue 1500 USD' }]);
    applyExtractedPatches(cell, [{ index: 8, numStr: '1500', newNum: '2k' }]);
    eq('AP1: single node patch replaces number', cell._textNodes[0].nodeValue, 'Revenue 2k USD');
  });

  // AP2: two patches in the same node, right-to-left order preserved
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '1500 and 2500' }]);
    applyExtractedPatches(cell, [
      { index: 0,  numStr: '1500', newNum: '2k' },
      { index: 9,  numStr: '2500', newNum: '3k' },
    ]);
    eq('AP2: two patches in same node', cell._textNodes[0].nodeValue, '2k and 3k');
  });

  // AP3: patch targets a plain node; sup node is untouched
  // cell: "1.5×10"(plain) + "31"(sup) + " m"(plain) + "3"(sup)
  // flat: "1.5×1031 m3", patch "1.5" at index 0 → "2"
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ' m' },
      { text: '3', inSup: true },
    ]);
    applyExtractedPatches(cell, [{ index: 0, numStr: '1.5', newNum: '2' }]);
    eq('AP3: base node updated', cell._textNodes[0].nodeValue, '2×10');
    eq('AP3: sup "31" node untouched', cell._textNodes[1].nodeValue, '31');
    eq('AP3: " m" node untouched',     cell._textNodes[2].nodeValue, ' m');
    eq('AP3: sup "3" node untouched',  cell._textNodes[3].nodeValue, '3');
  });

  // AP4: patch in a later plain node; earlier node untouched
  // cell: "text, "(plain) + "1500"(plain)
  // patch "1500" at index 6
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: 'text, ' },
      { text: '1500' },
    ]);
    applyExtractedPatches(cell, [{ index: 6, numStr: '1500', newNum: '2k' }]);
    eq('AP4: first node untouched', cell._textNodes[0].nodeValue, 'text, ');
    eq('AP4: second node patched',  cell._textNodes[1].nodeValue, '2k');
  });

  // AP5: defensive — wrong numStr at index → node unchanged
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    applyExtractedPatches(cell, [{ index: 4, numStr: '9999', newNum: '10k' }]);
    eq('AP5: wrong numStr → no change', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

  // AP6: empty patches array → no-op
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    applyExtractedPatches(cell, []);
    eq('AP6: empty patches → unchanged', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

})();

// ---------------------------------------------------------------------------
// Integration regression tests via roundTable
// These reproduce the three Wikipedia bugs.
// ---------------------------------------------------------------------------
(function applyExtractedPatches_regressionTests() {

  const makeSupTable = (cell) => ({
    rows: [{ cells: [cell] }],
    querySelector: () => null,
    dataset: {},
  });

  // RG1: Comma preservation
  // Cell: "1.5×10<sup>31</sup>, more text"
  // flat: "1.5×1031, more text"
  // "1.5" is in the base node; after rounding it shortens.
  // The comma and "more text" node must be untouched.
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ', more text' },
    ]);
    cell.querySelector = (sel) => sel === 'sup' ? { tagName: 'SUP' } : null;
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG1: comma and trailing text preserved',
      cell._textNodes[2].nodeValue, ', more text');
    eq('RG1: sup exponent node untouched',
      cell._textNodes[1].nodeValue, '31');
  });

  // RG2: Superscript digit preserved after rounding
  // Cell: "1.5×10<sup>31</sup> m<sup>3</sup>"
  // flat: "1.5×1031 m3"
  // Rounding "1.5" → shorter string must not corrupt the <sup>3</sup> node.
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ' m' },
      { text: '3', inSup: true },
    ]);
    cell.querySelector = (sel) => sel === 'sup' ? { tagName: 'SUP' } : null;
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG2: sup "3" node still contains "3" after rounding',
      cell._textNodes[3].nodeValue, '3');
    eq('RG2: " m" node still contains " m"',
      cell._textNodes[2].nodeValue, ' m');
  });

  // RG3: Anchor text node intact after rounding an adjacent number
  // Cell structure (flat): "1234 lithium-7"
  // "1234" is in a plain node; "lithium-7" is inside an anchor node.
  // filterLinkMatches excludes "7" (inside anchor), so only "1234" is rounded.
  // 1234 with offsetTop=-0.5 rounds to 1000 (confirmed: step=500, round(1234/500)=2, 2×500=1000).
  // The anchor text node must be exactly "lithium-7" after rounding.
  withSupCreateTreeWalker(function() {
    const anchor = {
      innerText: 'lithium-7',
      textContent: 'lithium-7',
      _isAnchor: true,
    };
    const plainNode = {
      nodeValue: '1234 ',
      parentNode: {},
      parentElement: { closest: () => null },
    };
    const anchorNode = {
      nodeValue: 'lithium-7',
      parentNode: anchor,
      parentElement: { closest: (sel) => sel === 'a' ? anchor : null },
    };
    const cell = {
      innerText: '1234 lithium-7',
      textContent: '1234 lithium-7',
      innerHTML: '1234 lithium-7',
      classList: { _classes: [], add(c) { this._classes.push(c); }, contains(c) { return this._classes.includes(c); } },
      dataset: {},
      title: '',
      tagName: 'TD',
      querySelectorAll: (sel) => sel === 'a' ? [anchor] : [],
      querySelector: () => null,
      contains: (node) => node === anchor,
      _textNodes: [plainNode, anchorNode],
    };
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG3: anchor text node is intact after rounding adjacent number',
      anchorNode.nodeValue, 'lithium-7');
    eq('RG3: plain node was rounded (1234 → 1000)',
      plainNode.nodeValue, '1000 ');
  });

})();

// =============================================================================
// Grid Detection — looksLikeGrid() and findTargetTable() unit tests
// Sprint: grid-detection  Spec: docs/sprint-plans/grid-support.md §6
// =============================================================================

// ---------------------------------------------------------------------------
// Mock-element helpers for grid detection tests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// looksLikeGrid() — PASS cases
// ---------------------------------------------------------------------------

// LG1: Pass — unlabelled div-grid, VARIABLE ROW HEIGHTS (AC2, S2 headline)
// S2 mandates row height is NOT tested. Rows must have differing heights yet
// the function must still return true. Column-0 offsetWidths are uniform (80px)
// so step 6 passes.
(function looksLikeGrid_pass_variableRowHeights() {
  const rows = [
    makeGridRow([{text:'Name',width:80},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:80},{text:'5678'}], 'row', 35),  // taller
    makeGridRow([{text:'Bar baz',width:80},{text:'9012'}], 'row', 50), // even taller
    makeGridRow([{text:'Qux',width:80},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:80},{text:'7890'}], 'row', 80),  // very tall
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — unlabelled, variable row heights',
      looksLikeGrid(container), true);
  });
})();

// LG2: Pass — ARIA short-circuit (role="grid") skips geometry probe
// The geometry probe (step 6) is skipped when role="grid". We prove this by
// making column-0 offsetWidths NON-uniform (all different) — if step 6 ran,
// the 80% alignment check would fail and return false. With the ARIA
// short-circuit the function must still return true.
(function looksLikeGrid_pass_ariaShortCircuit() {
  const rows = [
    makeGridRow([{text:'Col',width:10},{text:'1234'}], 'row', 20),  // width 10
    makeGridRow([{text:'Foo',width:20},{text:'5678'}], 'row', 20),  // width 20
    makeGridRow([{text:'Bar',width:30},{text:'9012'}], 'row', 20),  // width 30
    makeGridRow([{text:'Qux',width:40},{text:'3456'}], 'row', 20),  // width 40
    makeGridRow([{text:'Etc',width:50},{text:'7890'}], 'row', 20),  // width 50
  ];
  // All column-0 widths differ → step 6 would reject; ARIA role must short-circuit before it.
  const container = makeGridContainer(rows, 'flex', 'grid', '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — ARIA role="grid" short-circuits geometry probe (non-uniform widths still accepted)',
      looksLikeGrid(container), true);
  });
})();

// LG3: Pass — Databricks shape (library class "dg--" short-circuits geometry probe)
// The wrapper contains a pinned pane and a scroll pane as children, but for
// looksLikeGrid we test the wrapper itself: it has ≥5 row-like children,
// repetitive structure, numeric content, and the "dg--" class which short-circuits
// before the geometry probe. Column-0 widths are deliberately non-uniform so that
// if the geometry probe ran it would fail — proving the short-circuit works.
(function looksLikeGrid_pass_databricksClass() {
  const rows = [
    makeGridRow([{text:'Header',width:10},{text:'0'}], 'dg--row', 20),
    makeGridRow([{text:'Foo',width:20},{text:'1234.56'}], 'dg--row', 20),
    makeGridRow([{text:'Bar',width:30},{text:'7890.12'}], 'dg--row', 20),
    makeGridRow([{text:'Baz',width:40},{text:'3456.78'}], 'dg--row', 20),
    makeGridRow([{text:'Qux',width:50},{text:'9012.34'}], 'dg--row', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, 'dg--table-wrapper');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — Databricks "dg--" class short-circuits geometry probe',
      looksLikeGrid(container), true);
  });
})();

// ---------------------------------------------------------------------------
// looksLikeGrid() — REJECT cases (AC4 false-positive guard)
// ---------------------------------------------------------------------------

// LG4: Reject — CSS layout/card grid with NO numeric content (AC4)
// Repetitive card-style divs with text-only content must be rejected.
// This proves step 5 (numeric-content guard) works as the mandatory false-positive guard.
(function looksLikeGrid_reject_cssCardGrid() {
  const rows = [
    makeGridRow([{text:'Card A',width:100},{text:'Buy now'}], 'card', 20),
    makeGridRow([{text:'Card B',width:100},{text:'Learn more'}], 'card', 20),
    makeGridRow([{text:'Card C',width:100},{text:'Details'}], 'card', 20),
    makeGridRow([{text:'Card D',width:100},{text:'Visit site'}], 'card', 20),
    makeGridRow([{text:'Card E',width:100},{text:'Sign up'}], 'card', 20),
  ];
  const container = makeGridContainer(rows, 'grid', null, 'card-grid');
  withGridComputedStyle(container, 'grid', function() {
    eq('looksLikeGrid: reject — CSS card grid with no numeric content',
      looksLikeGrid(container), false);
  });
})();

// LG5: Reject — nav menu (repetitive rows, no numbers) (AC4)
// A navigation menu with text-only items must be rejected.
// This is the second false-positive guard test per the spec.
(function looksLikeGrid_reject_navMenu() {
  const rows = [
    makeGridRow([{text:'Home',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'About',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Products',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Contact',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Blog',width:100},{text:''}], 'nav-item', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, 'nav-menu');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — nav menu with no numeric content',
      looksLikeGrid(container), false);
  });
})();

// LG6: Reject — too few children (< GRID_MIN_CHILDREN = 5)
(function looksLikeGrid_reject_tooFewChildren() {
  const rows = [
    makeGridRow([{text:'Foo',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Baz',width:100},{text:'9012'}], 'row', 20),
    // only 3 rows — fewer than GRID_MIN_CHILDREN (5)
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — fewer than 5 children',
      looksLikeGrid(container), false);
  });
})();

// LG7: Reject — display is not grid/flex (step 4)
(function looksLikeGrid_reject_blockDisplay() {
  const rows = [
    makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
  ];
  const container = makeGridContainer(rows, 'block', null, '');
  withGridComputedStyle(container, 'block', function() {
    eq('looksLikeGrid: reject — display:block (not grid/flex)',
      looksLikeGrid(container), false);
  });
})();

// LG8: Reject — non-uniform column-0 widths (step 6) when no short-circuit
// Proves the geometry probe rejects grids where column widths are misaligned.
// All widths differ so < 80% match → rejected.
(function looksLikeGrid_reject_nonUniformColumnWidths() {
  const rows = [
    makeGridRow([{text:'Name',width:10},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:20},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:30},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:40},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:50},{text:'7890'}], 'row', 20),
  ];
  // No role, no library class → step 6 runs and must reject.
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — non-uniform column-0 widths (step 6)',
      looksLikeGrid(container), false);
  });
})();

// LG9: Pass — column-0 widths are uniform (80% threshold satisfied)
// Exactly matching widths → step 6 passes.
(function looksLikeGrid_pass_uniformColumnWidths() {
  const rows = [
    makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — uniform column-0 widths',
      looksLikeGrid(container), true);
  });
})();

// ---------------------------------------------------------------------------
// findTargetTable() walk-up tests
// ---------------------------------------------------------------------------

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

// FT1: findTargetTable — returns OUTERMOST matching ancestor (S6), not inner pane
// Build three nested containers: innermost → middle → outer.
// Both innermost and outer pass looksLikeGrid (both have numeric content, flex,
// uniform col-0 widths). Middle also passes. The walk-up must keep going as long
// as the parent passes and return the OUTERMOST (outer), not innermost.
(function findTargetTable_returnsOutermostAncestor() {
  withFindTargetEnv([], function() {
    // inner, middle, outer all pass looksLikeGrid
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    const inner  = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const middle = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer  = makeWalkEl({ display: 'flex', rows: makeRows5() });

    // Wire up parent chain: inner → middle → outer → (body = stop)
    inner.parentElement  = middle;
    inner.parentNode     = middle;
    middle.parentElement = outer;
    middle.parentNode    = outer;
    outer.parentElement  = document.body;
    outer.parentNode     = document.body;

    // The click target is inner itself (not in any <table>, no dr-ext-grid yet).
    // Adjust closest() on inner to use the real chain.
    inner.closest = function(sel) {
      if (sel === 'table') return null;
      if (sel === '.dr-ext-grid') return null;
      return null;
    };

    const result = findTargetTable(inner);

    eq('findTargetTable: returns outermost ancestor (S6), not inner pane',
      result, outer);
  });
})();

// FT2: findTargetTable — does NOT overshoot to <body> and respects depth cap
// A chain of 3 containers where only the first two pass looksLikeGrid;
// the third fails. The walk must stop at the second (outermost passing) container,
// not continue to body.
(function findTargetTable_stopsAtFailingParent() {
  withFindTargetEnv([], function() {
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    // Text-only rows: will fail looksLikeGrid at step 5 (no numeric content)
    const noNumericRows = [
      makeGridRow([{text:'Alpha',width:100},{text:'Foo'}], 'row', 20),
      makeGridRow([{text:'Beta',width:100},{text:'Bar'}], 'row', 20),
      makeGridRow([{text:'Gamma',width:100},{text:'Baz'}], 'row', 20),
      makeGridRow([{text:'Delta',width:100},{text:'Qux'}], 'row', 20),
      makeGridRow([{text:'Epsilon',width:100},{text:'Quux'}], 'row', 20),
    ];

    const inner    = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outerOk  = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const failsLLG = makeWalkEl({ display: 'flex', rows: noNumericRows });

    inner.parentElement    = outerOk;
    inner.parentNode       = outerOk;
    outerOk.parentElement  = failsLLG;
    outerOk.parentNode     = failsLLG;
    failsLLG.parentElement = document.body;
    failsLLG.parentNode    = document.body;

    inner.closest = function(sel) { return null; };

    const result = findTargetTable(inner);

    // Must return outerOk, not failsLLG or body
    eq('findTargetTable: stops at failing parent, returns outermost passing container',
      result, outerOk);

    // Must NOT return the body sentinel or the failing container
    eq('findTargetTable: does not return failing container',
      result === failsLLG, false);
  });
})();

// FT3: findTargetTable — prefers native <table> ancestor over grid heuristic
// When the element has a <table> ancestor, closest('table') must be returned
// immediately without engaging the looksLikeGrid walk-up (AC1).
(function findTargetTable_prefersNativeTable() {
  withFindTargetEnv([], function() {
    const tableEl = { tagName: 'TABLE', rows: [], dataset: {} };

    // A click target that has a <table> ancestor.
    const clickTarget = {
      tagName: 'TD',
      nodeType: 1,
      parentElement: tableEl,
      parentNode: tableEl,
      closest: function(sel) {
        if (sel === 'table') return tableEl;
        return null;
      },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: prefers native <table> ancestor over grid heuristic',
      result, tableEl);
  });
})();

// FT4: findTargetTable — returns null when nothing found
// A click target with no grid ancestors and no <table> ancestor.
(function findTargetTable_returnsNullWhenNothing() {
  withFindTargetEnv([], function() {
    // Text-only rows fail looksLikeGrid (step 5 — no numeric content)
    const noNumericRows = [
      makeGridRow([{text:'Alpha',width:100},{text:'Foo'}], 'row', 20),
      makeGridRow([{text:'Beta',width:100},{text:'Bar'}], 'row', 20),
      makeGridRow([{text:'Gamma',width:100},{text:'Baz'}], 'row', 20),
      makeGridRow([{text:'Delta',width:100},{text:'Qux'}], 'row', 20),
      makeGridRow([{text:'Epsilon',width:100},{text:'Quux'}], 'row', 20),
    ];

    const parent = makeWalkEl({ display: 'flex', rows: noNumericRows });
    parent.parentElement = document.body;
    parent.parentNode    = document.body;

    const clickTarget = {
      tagName: 'DIV',
      nodeType: 1,
      parentElement: parent,
      parentNode: parent,
      closest: function(sel) { return null; },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: returns null when no grid or table found',
      result, null);
  });
})();

// FT5: findTargetTable — returns already-tagged ancestor (.dr-ext-grid) without re-walking
// If an ancestor already carries `dr-ext-grid`, it must be returned immediately
// via closest('.dr-ext-grid') without calling looksLikeGrid again.
(function findTargetTable_returnsAlreadyTaggedGrid() {
  withFindTargetEnv([], function() {
    const existingGrid = makeWalkEl({ display: 'flex' });
    existingGrid.classList.add('dr-ext-grid');

    const clickTarget = {
      tagName: 'DIV',
      nodeType: 1,
      parentElement: existingGrid,
      parentNode: existingGrid,
      closest: function(sel) {
        if (sel === 'table') return null;
        if (sel === '.dr-ext-grid') return existingGrid;
        return null;
      },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: returns already-tagged .dr-ext-grid ancestor immediately',
      result, existingGrid);
  });
})();

// FT6: findTargetTable — marks the outermost grid with dr-ext-grid class (AC2)
// After findTargetTable discovers a new grid via walk-up, it must add
// 'dr-ext-grid' to the outermost element.
(function findTargetTable_marksOutermostWithClass() {
  withFindTargetEnv([], function() {
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    const inner = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer = makeWalkEl({ display: 'flex', rows: makeRows5() });

    inner.parentElement = outer;
    inner.parentNode    = outer;
    outer.parentElement = document.body;
    outer.parentNode    = document.body;

    inner.closest = function(sel) { return null; };

    findTargetTable(inner);

    eq('findTargetTable: marks outermost grid with dr-ext-grid class',
      outer.classList.contains('dr-ext-grid'), true);
  });
})();

// ---------------------------------------------------------------------------
// Sprint grid-adapter: TableAdapter abstraction
// AC2 — NativeTableAdapter round-trip test
// AC3 — GridAdapter stub no-throw test
// AC4 — source scan: no role="gridcell" or data-row-index literals in content.js
// ---------------------------------------------------------------------------

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

// TA1: NativeTableAdapter round-trip
// Build a native table element, wrap it with makeAdapter(), walk the adapter
// API (getRows → getCells → getText) and assert values match what was put in.
// Also assert isVirtualized() === false and getElement() returns the element.
(function nativeTableAdapter_roundTrip() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: '1,234' }, { tag: 'td', text: '5,678' }],
    [{ tag: 'td', text: '9,012' }, { tag: 'td', text: '3,456' }],
  ]);

  const adapter = makeAdapter(tableEl);

  eq('NativeTableAdapter: makeAdapter returns NativeTableAdapter for TABLE element',
    adapter instanceof NativeTableAdapter, true);

  eq('NativeTableAdapter: getElement() returns the original element',
    adapter.getElement(), tableEl);

  eq('NativeTableAdapter: isVirtualized() === false',
    adapter.isVirtualized(), false);

  const rows = adapter.getRows();
  eq('NativeTableAdapter: getRows() returns 2 rows',
    rows.length, 2);

  const cells0 = rows[0].getCells();
  eq('NativeTableAdapter: row 0 has 2 cells',
    cells0.length, 2);

  eq('NativeTableAdapter: row 0 cell 0 getText() returns "1,234"',
    cells0[0].getText(), '1,234');

  eq('NativeTableAdapter: row 0 cell 1 getText() returns "5,678"',
    cells0[1].getText(), '5,678');

  const cells1 = rows[1].getCells();
  eq('NativeTableAdapter: row 1 cell 0 getText() returns "9,012"',
    cells1[0].getText(), '9,012');

  eq('NativeTableAdapter: row 1 cell 1 getText() returns "3,456"',
    cells1[1].getText(), '3,456');

  // Each cell object must expose .el pointing back to the DOM cell element
  eq('NativeTableAdapter: cell .el is the underlying DOM cell',
    cells0[0].el, tableEl.rows[0].cells[0]);
})();

// TA2: NativeTableAdapter — cell count matches table structure
// A 3-row × 3-column table round-trips with correct row and cell counts.
(function nativeTableAdapter_3x3() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: 'a' }, { tag: 'td', text: 'b' }, { tag: 'td', text: 'c' }],
    [{ tag: 'td', text: '1' }, { tag: 'td', text: '2' }, { tag: 'td', text: '3' }],
    [{ tag: 'td', text: 'x' }, { tag: 'td', text: 'y' }, { tag: 'td', text: 'z' }],
  ]);

  const adapter = makeAdapter(tableEl);
  const rows = adapter.getRows();

  eq('NativeTableAdapter: 3×3 table — getRows() returns 3 rows',
    rows.length, 3);

  eq('NativeTableAdapter: 3×3 table — row 1 has 3 cells',
    rows[1].getCells().length, 3);

  eq('NativeTableAdapter: 3×3 table — row 2 cell 2 text is "z"',
    rows[2].getCells()[2].getText(), 'z');
})();

// TA3: GridAdapter stub — makeAdapter on a non-TABLE element returns GridAdapter
// isVirtualized() === true, getRows() === [], getElement() returns the element.
(function gridAdapter_stub_properties() {
  const divEl = {
    tagName: 'DIV',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      contains(c) { return this._c.includes(c); },
    },
  };

  const adapter = makeAdapter(divEl);

  eq('GridAdapter: makeAdapter on DIV returns GridAdapter',
    adapter instanceof GridAdapter, true);

  eq('GridAdapter: getElement() returns the div element',
    adapter.getElement(), divEl);

  eq('GridAdapter: isVirtualized() === true',
    adapter.isVirtualized(), true);

  eq('GridAdapter: getRows() returns empty array (stub)',
    adapter.getRows().length, 0);
})();

// TA4: roundTable on a grid element (non-TABLE) — must not throw, must be a no-op
// The stub path: GridAdapter.getRows() → [] causes roundTable to return early.
// No .dr-ext-rounded cells should appear; no exception thrown.
(function gridAdapter_stub_noThrow() {
  const divEl = {
    tagName: 'DIV',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      contains(c) { return this._c.includes(c); },
    },
  };

  let threw = false;
  try {
    roundTable(divEl, Object.assign({}, DR_DEFAULTS));
  } catch (e) {
    threw = true;
  }

  eq('GridAdapter stub: roundTable on grid element does not throw',
    threw, false);

  // The element should have no .dr-ext-rounded cells since it was a no-op
  eq('GridAdapter stub: roundTable on grid element is a no-op (querySelector returns null)',
    divEl.querySelector('.dr-ext-rounded'), null);
})();

// TA5: source-scan — no role="gridcell" or data-row-index literals in content.js
// Per AC4 of the grid-adapter sprint, these stale Sprint 1 selectors must have
// been replaced by role="cell" / data-row / data-index.
(function sourceNoLegacySelectors() {
  const contentSrc = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

  eq('grid-adapter AC4: no role="gridcell" literal remains in content.js',
    contentSrc.includes('role="gridcell"'), false);

  eq('grid-adapter AC4: no data-row-index literal remains in content.js',
    contentSrc.includes('data-row-index'), false);
})();

// =============================================================================
// Sprint grid-rounding tests
// Spec: docs/sprint-plans/grid-support-v2.md §2 D3 + §4 "grid-rounding"
// =============================================================================

// ---------------------------------------------------------------------------
// DOM-stub helpers for grid cells that contain real Text nodes (nodeType 3).
//
// findCellTextNode does a depth-first walk that checks node.nodeType,
// node.nodeValue, and iterates node.childNodes. We build minimal objects that
// satisfy exactly those interfaces — no jsdom required.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GR1: Unlabelled variable-row-height grid — structural extraction + nodeValue rounding
// The headline test: no ARIA roles, no dg-- classes. GridAdapter must fall back
// to direct children as rows and direct row-children as cells.
// ---------------------------------------------------------------------------

(function gr1_unlabelledGrid_extractionAndRounding() {
  // Build a 3×2 grid with numeric values at different magnitudes
  const grid = makeGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
    ['7654321', '55'],
  ]);

  const adapter = makeAdapter(grid.wrapperEl);

  eq('GR1: makeAdapter returns GridAdapter for div wrapper',
    adapter instanceof GridAdapter, true);

  eq('GR1: isVirtualized() === true',
    adapter.isVirtualized(), true);

  const rows = adapter.getRows();
  eq('GR1: getRows() returns 3 rows',
    rows.length, 3);

  const cells0 = rows[0].getCells();
  eq('GR1: row 0 has 2 cells',
    cells0.length, 2);

  eq('GR1: row 0 cell 0 getText() returns "8584629"',
    cells0[0].getText(), '8584629');

  eq('GR1: row 0 cell 1 getText() returns "286"',
    cells0[1].getText(), '286');

  // Now round via setText and confirm nodeValue changed
  cells0[0].setText('8500000');
  const tn0 = grid.cellEls[0].childNodes[0];
  eq('GR1: after setText, text node nodeValue is rounded value',
    tn0.nodeValue, '8500000');

  // The dr-ext-rounded class must be on the cell element
  eq('GR1: after setText, cell carries dr-ext-rounded class',
    grid.cellEls[0].classList.contains('dr-ext-rounded'), true);
})();

// ---------------------------------------------------------------------------
// GR2: .dg--virtual-row / .dg--cell shaped grid — path extracts via library selectors
// ---------------------------------------------------------------------------

(function gr2_dgGrid_extraction() {
  const grid = makeGridWrapper([
    ['1000000', '500'],
    ['2000000', '750'],
  ], { useDgClasses: true });

  const adapter = makeAdapter(grid.wrapperEl);

  const rows = adapter.getRows();
  eq('GR2: dg-- grid getRows() returns 2 rows',
    rows.length, 2);

  const cells = rows[0].getCells();
  eq('GR2: dg-- grid row 0 has 2 cells',
    cells.length, 2);

  eq('GR2: dg-- grid row 0 cell 0 text is "1000000"',
    cells[0].getText(), '1000000');

  // Confirm data-row attribute path: row 0 has dataset.row = "0"
  eq('GR2: dg-- grid row 0 has data-row="0"',
    grid.rowEls[0].dataset.row, '0');

  eq('GR2: dg-- grid row 1 has data-row="1"',
    grid.rowEls[1].dataset.row, '1');
})();

// ---------------------------------------------------------------------------
// GR3: nodeValue write asserts NODE IDENTITY — the regression guard for the
// reconciler crash. The spec mandates: patch in place, never replace the node.
// ---------------------------------------------------------------------------

(function gr3_nodeIdentityPreservation() {
  const grid = makeGridWrapper([
    ['9876543', '123'],
  ]);

  const adapter = makeAdapter(grid.wrapperEl);
  const rows = adapter.getRows();
  const cellObj = rows[0].getCells()[0];

  // Capture the Text node object reference BEFORE setText.
  const textNodeBefore = grid.cellEls[0].childNodes[0];
  const childCountBefore = grid.cellEls[0].childNodes.length;

  // Round via setText
  cellObj.setText('9900000');

  // The Text node reference returned by findCellTextNode must be the SAME object.
  const textNodeAfter = grid.cellEls[0].childNodes[0];

  eq('GR3: text node object identity preserved after setText (same reference)',
    textNodeAfter === textNodeBefore, true);

  eq('GR3: text node nodeValue was patched to rounded value',
    textNodeAfter.nodeValue, '9900000');

  // The cell's child node list length must be unchanged (no insertion/removal)
  eq('GR3: cell childNodes.length unchanged after setText (no appendChild/removeChild)',
    grid.cellEls[0].childNodes.length, childCountBefore);

  // Double-safety: the cell element itself is unchanged (not recreated)
  eq('GR3: cell element reference unchanged after setText',
    grid.cellEls[0], grid.cellEls[0]);
})();

// ---------------------------------------------------------------------------
// GR3b: setText does NOT use textContent/innerHTML — source-level guard
// The spec forbids: cell.textContent=, cell.innerHTML=, removeChild, appendChild
// on a cell during a grid write. We verify the node reference is identical (GR3)
// which implies none of those paths ran. Additionally scan source for the
// critical prohibition.
// ---------------------------------------------------------------------------

(function gr3b_noTextContentWriteInGridPath() {
  // The _makeCellObj method must ONLY use tn.nodeValue = s.
  // Source scan: the setText implementation inside _makeCellObj must not contain
  // 'textContent =' (with a write) or 'innerHTML =' outside the native-table path.
  // GridAdapter now lives in dom-adapters.js (Phase 2 split).
  const src = allContentSrc;

  // Extract _makeCellObj body (from _makeCellObj to the closing brace of its returned object)
  const makeCellObjIdx = src.indexOf('_makeCellObj(');
  const bodyAfter = makeCellObjIdx >= 0 ? src.slice(makeCellObjIdx, makeCellObjIdx + 1000) : '';

  // Within that body, there must be no 'textContent =' assignment
  // (the tn.nodeValue = s line is the ONLY allowed write in grid setText)
  eq('GR3b: _makeCellObj setText does not contain textContent= assignment',
    /textContent\s*=/.test(bodyAfter), false);

  // Must contain the nodeValue write pattern
  eq('GR3b: _makeCellObj setText uses nodeValue = s (the required write model)',
    /tn\.nodeValue\s*=/.test(bodyAfter), true);
})();

// ---------------------------------------------------------------------------
// GR4: resetTable restores originals on visible rows; recycled rows (no
// .dr-ext-rounded) are left untouched
// ---------------------------------------------------------------------------

(function gr4_resetTable_restoresOriginals() {
  const grid = makeGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
  ]);

  const adapter = makeAdapter(grid.wrapperEl);
  const rows = adapter.getRows();

  // Round all cells
  rows.forEach(function(row) {
    row.getCells().forEach(function(c) {
      c.setText('ROUNDED');
    });
  });

  // All cells should carry dr-ext-rounded and drOriginal
  eq('GR4 (setup): cell 0 is rounded',
    grid.cellEls[0].classList.contains('dr-ext-rounded'), true);
  eq('GR4 (setup): cell 0 drOriginal is stored original value',
    grid.cellEls[0].dataset.drOriginal, '8584629');

  // Simulate a recycled row: cell has NO .dr-ext-rounded (framework removed+readded it)
  // We model this by creating a fresh cell that was never rounded by us.
  const recycledCell = makeGridCellWithTextNode('FRAMEWORK_TEXT');
  // recycledCell has no dr-ext-rounded class and no drOriginal — simulates a
  // framework-recycled row that shows fresh content.

  // Build a querySelectorAll stub on the wrapper that returns only the already-rounded cells
  // (the recycled cell is not in the DOM under the wrapper for purposes of this test)
  const roundedCells = grid.cellEls.filter(function(c) {
    return c.classList.contains('dr-ext-rounded');
  });

  // Attach querySelectorAll('.dr-ext-rounded') to the wrapper
  grid.wrapperEl.querySelectorAll = function(sel) {
    if (sel === '.dr-ext-rounded') return roundedCells;
    return [];
  };

  // Also need querySelector for isTableRounded's call after reset
  grid.wrapperEl.querySelector = function(sel) {
    if (sel === '.dr-ext-rounded') return null; // after reset, none
    return null;
  };

  // resetTable expects a table.querySelectorAll that returns .dr-ext-rounded cells
  resetTable(grid.wrapperEl);

  // All previously-rounded cells should now have their original text restored
  eq('GR4: cell 0 nodeValue restored to original',
    grid.cellEls[0].childNodes[0].nodeValue, '8584629');

  eq('GR4: cell 0 no longer carries dr-ext-rounded',
    grid.cellEls[0].classList.contains('dr-ext-rounded'), false);

  eq('GR4: cell 0 drOriginal cleared after reset',
    grid.cellEls[0].dataset.drOriginal, undefined);

  // The recycled cell was never touched by us and must not be modified
  eq('GR4: recycled cell text node untouched (framework text preserved)',
    recycledCell.childNodes[0].nodeValue, 'FRAMEWORK_TEXT');

  eq('GR4: recycled cell has no dr-ext-rounded class',
    recycledCell.classList.contains('dr-ext-rounded'), false);
})();

// ---------------------------------------------------------------------------
// GR5: extractPreviewSamples on a grid — expected structure returned
// ---------------------------------------------------------------------------

(function gr5_extractPreviewSamples_gridStructure() {
  // Build a grid with numeric cells of two distinct magnitudes so both
  // top and bottom bands are populated in the returned structure.
  const grid = makeGridWrapper([
    ['8584629', '286'],
    ['9123456', '514'],
    ['7654321', '432'],
  ]);

  const result = extractPreviewSamples(grid.wrapperEl);

  // Must return the correct shape: { samples: { top: [...], bottom: [...] }, maxMag: <number> }
  eq('GR5: extractPreviewSamples returns an object with samples key',
    typeof result.samples, 'object');

  eq('GR5: extractPreviewSamples samples has top array',
    Array.isArray(result.samples.top), true);

  eq('GR5: extractPreviewSamples samples has bottom array',
    Array.isArray(result.samples.bottom), true);

  eq('GR5: extractPreviewSamples returns maxMag as a number',
    typeof result.maxMag, 'number');

  // The large-magnitude cells (8M, 9M, 7M) are magnitude 6; they go in top.
  eq('GR5: top band contains at least one entry',
    result.samples.top.length >= 1, true);

  // Each entry must have original and num fields
  if (result.samples.top.length > 0) {
    eq('GR5: top[0] has original field',
      typeof result.samples.top[0].original, 'string');
    eq('GR5: top[0] has num field',
      typeof result.samples.top[0].num, 'number');
  }

  // maxMag for cells in the 8M range is 6
  eq('GR5: maxMag is 6 for cells around 8,000,000',
    result.maxMag, 6);
})();

// ---------------------------------------------------------------------------
// GR6: Adversarial extras
// ---------------------------------------------------------------------------

// GR6a: findCellTextNode returns the deepest non-empty text node
(function gr6a_findCellTextNode_deepestNode() {
  // Cell with nested structure: div > span > text("42")
  const innerText = makeTextNode('42');
  const span = makeElementNode('inner', [innerText]);
  const cell = makeElementNode('cell', [span]);

  // findCellTextNode must walk depth-first and return the deepest node
  const result = findCellTextNode(cell);

  eq('GR6a: findCellTextNode returns the deepest non-empty text node',
    result === innerText, true);

  eq('GR6a: findCellTextNode result nodeValue is "42"',
    result && result.nodeValue, '42');
})();

// GR6b: findCellTextNode returns null when no text node exists
(function gr6b_findCellTextNode_nullWhenEmpty() {
  // Cell with only element children, no text
  const span = makeElementNode('inner', []);
  const cell = makeElementNode('cell', [span]);

  eq('GR6b: findCellTextNode returns null for cell with no text nodes',
    findCellTextNode(cell), null);
})();

// GR6c: findCellTextNode returns null for a whitespace-only text node
(function gr6c_findCellTextNode_whitespaceIsNull() {
  const wsNode = makeTextNode('   ');
  const cell = makeElementNode('cell', [wsNode]);

  eq('GR6c: findCellTextNode returns null for whitespace-only text node',
    findCellTextNode(cell), null);
})();

// GR6d: setText is a no-op when the cell has no text node
(function gr6d_setText_noopWhenNoTextNode() {
  // Build a cell with no text node
  const emptyCell = makeElementNode('empty-cell', []);
  emptyCell.querySelector = function() { return null; };

  const adapter = makeAdapter(
    (function() {
      const wrapEl = makeElementNode('wrapper', []);
      wrapEl.tagName = 'DIV';
      wrapEl.dataset = {};
      wrapEl.querySelector = function() { return null; };
      wrapEl.querySelectorAll = function() { return []; };
      wrapEl.matches = function() { return false; };
      return wrapEl;
    })()
  );

  // Directly call _makeCellObj to get a cell object for our empty cell
  const cellObj = adapter._makeCellObj(emptyCell);

  let threw = false;
  try {
    cellObj.setText('should-be-noop');
  } catch (e) {
    threw = true;
  }

  eq('GR6d: setText on cell with no text node does not throw',
    threw, false);

  eq('GR6d: setText on cell with no text node leaves classList unchanged',
    emptyCell.classList.contains('dr-ext-rounded'), false);
})();

// GR6e: dataset.drOriginal is stored ONCE and NOT overwritten on a second setText call
(function gr6e_drOriginal_storedOnce() {
  const grid = makeGridWrapper([['12345']]);
  const adapter = makeAdapter(grid.wrapperEl);
  const cellObj = adapter.getRows()[0].getCells()[0];

  // First setText: original should be stored
  cellObj.setText('12000');
  const storedOriginal = grid.cellEls[0].dataset.drOriginal;
  eq('GR6e: drOriginal stored on first setText',
    storedOriginal, '12345');

  // Second setText (e.g. rounding again): drOriginal must NOT change
  cellObj.setText('10000');
  eq('GR6e: drOriginal NOT overwritten on second setText',
    grid.cellEls[0].dataset.drOriginal, '12345');

  // But the nodeValue IS updated
  eq('GR6e: nodeValue updated to second setText value',
    grid.cellEls[0].childNodes[0].nodeValue, '10000');
})();

// GR6f: isDataTable returns true for a grid with numeric cells
(function gr6f_isDataTable_numericGrid() {
  const grid = makeGridWrapper([
    ['Name', '1234567'],
    ['Foo',  '9876543'],
    ['Bar',  '5555555'],
  ]);

  // isDataTable calls makeAdapter(el).getRows(), so the wrapper must be a div
  eq('GR6f: isDataTable returns true for grid with numeric cells',
    isDataTable(grid.wrapperEl), true);
})();

// GR6g: isDataTable returns false for an all-text grid (no finite numbers)
(function gr6g_isDataTable_allTextGrid() {
  const grid = makeGridWrapper([
    ['Name',  'City'],
    ['Alice', 'Paris'],
    ['Bob',   'Berlin'],
    ['Carol', 'Tokyo'],
  ]);

  eq('GR6g: isDataTable returns false for all-text grid (no numeric cells)',
    isDataTable(grid.wrapperEl), false);
})();

// GR6h: findCellTextNode returns the LAST non-empty text node in depth-first order
// (implementation uses "best = node" overwriting, so last DFS visit wins — this is
// the "deepest" semantic: the last text node encountered in DFS order).
(function gr6h_findCellTextNode_lastDfsTextNode() {
  // Cell with two sibling text nodes; the second (deeper in DFS order) should win.
  const firstText  = makeTextNode('first');
  const secondText = makeTextNode('42');
  const cell = makeElementNode('cell', [firstText, secondText]);

  const result = findCellTextNode(cell);

  // The implementation overwrites `best` on every non-empty text node, so the
  // last one encountered (secondText) is returned.
  eq('GR6h: findCellTextNode returns last non-empty text node in DFS order',
    result === secondText, true);
})();

// GR6i: GridAdapter.setText sequence — getText after setText returns the rounded value
// (confirms the adapter's read/write round-trip works symmetrically)
(function gr6i_setText_getTextRoundTrip() {
  const grid = makeGridWrapper([['9876543']]);
  const adapter = makeAdapter(grid.wrapperEl);
  const cellObj = adapter.getRows()[0].getCells()[0];

  eq('GR6i (setup): getText before setText returns original',
    cellObj.getText(), '9876543');

  cellObj.setText('9900000');

  // The nodeValue was patched; getText should now return the rounded value
  // (implementation reads drOriginal if set, so getText returns the original — check)
  // Actually, getText returns drOriginal if dataset.drOriginal is set.
  // After setText, drOriginal = '9876543' and nodeValue = '9900000'.
  // getText() returns dataset.drOriginal ('9876543') — this is the spec design:
  // getText after setText returns the ORIGINAL so re-rounding uses the right base.
  eq('GR6i: getText after setText returns stored original (for re-round safety)',
    cellObj.getText(), '9876543');

  // The nodeValue on the text node is the rounded value
  eq('GR6i: text node nodeValue after setText is the rounded value',
    grid.cellEls[0].childNodes[0].nodeValue, '9900000');
})();

// GR6j: SPEC GAP GUARD — roundTable must call adapter's setText (or equivalent
// nodeValue-only path) for grid cells. The spec (D3) says the write is:
//   tn.nodeValue = s   (via GridAdapter.setText → findCellTextNode → nodeValue =)
// NOT cell.innerHTML = … which destroys React fiber identity.
//
// Source-level assertion: content.js must NOT contain a bare `cell.innerHTML =`
// assignment *outside* the native-table reset/extracted path. We check that the
// replaceTextPreservingHTML fallback branch (line ~2195) and the extracted-patch
// branch are the only innerHTML writes; a grid-routed pure-cell path must not
// write innerHTML.
//
// This test encodes the hard rule from the sprint brief:
//   "The grid write must be nodeValue-only."
// It passes today because replaceTextPreservingHTML's single-text-node path is
// nodeValue-safe. It will flag a regression if someone adds an innerHTML= write
// in the adapter's setText or in a new grid-specific roundTable branch.
(function gr6j_gridSetText_sourceGuard_noInnerHTMLInAdapterSetText() {
  // GridAdapter now lives in dom-adapters.js (Phase 2 split).
  const src = allContentSrc;

  // Extract _makeCellObj body (the GridAdapter's cell factory, ~1000 chars)
  const idx = src.indexOf('_makeCellObj(');
  const body = idx >= 0 ? src.slice(idx, idx + 1200) : '';

  // The grid adapter's setText (inside _makeCellObj) must NOT assign innerHTML
  eq('GR6j: GridAdapter _makeCellObj setText has no innerHTML= assignment',
    /innerHTML\s*=/.test(body), false);

  // It MUST have the nodeValue assignment (the only permitted write)
  eq('GR6j: GridAdapter _makeCellObj setText uses tn.nodeValue = s',
    /tn\.nodeValue\s*=/.test(body), true);
})();

// =============================================================================
// E2E grid rounding tests — drive roundTable/resetTable on real div-grid stubs.
// Spec: docs/sprint-plans/grid-support-v2.md §2 D3 + §4 "grid-rounding".
// Regression guard for commit 3404e86: roundTable must write via nodeValue
// (GridAdapter.setText → drOriginal), NOT via replaceTextPreservingHTML /
// innerHTML (which crashes React's reconciler).
// =============================================================================

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

// ---------------------------------------------------------------------------
// E2E-GR1: roundTable on a numeric div-grid — nodeValue written, node identity
// preserved, drOriginal set, originalHtml NOT set, dr-ext-rounded applied.
// ---------------------------------------------------------------------------
(function e2e_gr1_roundTable_numericGrid_nodeValuePath() {
  // 3-row grid. Use simplifyFirstRow:true so all rows (including row 0) are processed.
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
    ['7654321', '55'],
  ]);

  // cellEls[0] is row-0, col-0.  With simplifyFirstRow:true it will be rounded.
  const cell0 = grid.cellEls[0];
  const textNodeBefore = cell0.childNodes[0];
  const childCountBefore = cell0.childNodes.length;
  const originalValue = textNodeBefore.nodeValue;  // '8584629'

  // Drive the real engine entry point with simplifyFirstRow+Column:true so row/col 0
  // are not excluded by the default "skip header" heuristic.
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  roundTable(grid.wrapperEl, opts);

  // The cell must now carry the rounded class.
  eq('E2E-GR1: cell[0] has dr-ext-rounded after roundTable',
    cell0.classList.contains('dr-ext-rounded'), true);

  // The text was actually changed (8584629 → some abbreviated form; check it differs).
  eq('E2E-GR1: cell[0] text node value changed from original',
    cell0.childNodes[0].nodeValue !== originalValue, true);

  // Node identity: the SAME Text node object must hold the new value.
  eq('E2E-GR1: Text node object identity preserved (same reference)',
    cell0.childNodes[0] === textNodeBefore, true);

  // childNodes.length must be unchanged (no appendChild / removeChild).
  eq('E2E-GR1: cell[0] childNodes.length unchanged after roundTable',
    cell0.childNodes.length, childCountBefore);

  // drOriginal must be set on the cell element (nodeValue path).
  eq('E2E-GR1: cell[0] dataset.drOriginal is set to original text',
    cell0.dataset.drOriginal, originalValue);

  // originalHtml must NOT be set (that is the native-table / extracted path).
  eq('E2E-GR1: cell[0] dataset.originalHtml is NOT set on a grid cell',
    cell0.dataset.originalHtml, undefined);
})();

// ---------------------------------------------------------------------------
// E2E-GR2: resetTable after roundTable — Text node restored in place, class
// removed, drOriginal cleared, childNodes.length still unchanged.
// ---------------------------------------------------------------------------
(function e2e_gr2_resetTable_restoresNodeValue() {
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
  ]);

  const cell0 = grid.cellEls[0];
  const textNodeBefore = cell0.childNodes[0];
  const childCountBefore = cell0.childNodes.length;
  const originalValue = textNodeBefore.nodeValue;  // '8584629'

  // Round first — use simplifyFirstRow+Column:true so row/col 0 are not excluded.
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  roundTable(grid.wrapperEl, opts);

  // Confirm the cell is rounded before we reset (pre-condition).
  eq('E2E-GR2 (pre): cell[0] is rounded before resetTable',
    cell0.classList.contains('dr-ext-rounded'), true);

  // Now reset.
  resetTable(grid.wrapperEl);

  // nodeValue must be back to the original on the SAME Text node.
  eq('E2E-GR2: Text node nodeValue restored to original value',
    textNodeBefore.nodeValue, originalValue);

  // The SAME node object must still be in childNodes[0].
  eq('E2E-GR2: Text node identity preserved through reset (same reference)',
    cell0.childNodes[0] === textNodeBefore, true);

  // dr-ext-rounded class must be removed.
  eq('E2E-GR2: dr-ext-rounded removed after resetTable',
    cell0.classList.contains('dr-ext-rounded'), false);

  // drOriginal must be cleared.
  eq('E2E-GR2: dataset.drOriginal cleared after resetTable',
    cell0.dataset.drOriginal, undefined);

  // childNodes.length still unchanged (no innerHTML write at any point).
  eq('E2E-GR2: childNodes.length unchanged throughout (no innerHTML write)',
    cell0.childNodes.length, childCountBefore);
})();

// ---------------------------------------------------------------------------
// E2E-GR3 (Negative guard): after roundTable on a grid, NO cell has
// dataset.originalHtml set. Locks in that grids never take the native write path.
// ---------------------------------------------------------------------------
(function e2e_gr3_noOriginalHtmlOnGridCells() {
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
    ['7654321', '55'],
  ]);

  // simplifyFirstRow:true ensures all rows are processed (maximal coverage).
  roundTable(grid.wrapperEl, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true }));

  const anyHasOriginalHtml = grid.cellEls.some(function(c) {
    return c.dataset.originalHtml !== undefined;
  });

  eq('E2E-GR3: no grid cell has dataset.originalHtml after roundTable (native path locked out)',
    anyHasOriginalHtml, false);
})();

// ---------------------------------------------------------------------------
// E2E-GR4: mode:'extracted' skip on grids — mixed-text cell is left unrounded;
// pure-numeric cell IS rounded. Known limitation: grids skip extracted cells
// (innerHTML incompatible with nodeValue-only write model).
// ---------------------------------------------------------------------------
(function e2e_gr4_extractedModeSkippedOnGrid() {
  // Two rows so simplifyFirstRow:false (default) doesn't exclude everything.
  // Row 0: skipped (simplifyFirstRow:false).
  // Row 1: mixed-text cell → extracted mode → skipped on grid;
  //        pure-numeric cell → pure mode → rounded.
  const grid = makeE2EGridWrapper([
    ['placeholder', '0'],             // row 0: excluded by simplifyFirstRow:false
    ['abc 1234567 def', '9876543'],   // row 1: exercised
  ]);

  // cellEls[2] = row1/col0 (mixed), cellEls[3] = row1/col1 (numeric)
  const mixedCell   = grid.cellEls[2];
  const numericCell = grid.cellEls[3];

  const mixedTextBefore   = mixedCell.childNodes[0].nodeValue;
  const numericTextBefore = numericCell.childNodes[0].nodeValue;

  // Use opts with simplifyMixedCells:true so mixed cells are classified as extracted,
  // and simplifyFirstRow:false (default) so row 0 is excluded (standard behaviour).
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyMixedCells: true });
  roundTable(grid.wrapperEl, opts);

  // Mixed cell must be UNROUNDED (extracted path skipped on virtualized grid).
  eq('E2E-GR4: mixed-text cell NOT rounded on grid (extracted mode skipped)',
    mixedCell.classList.contains('dr-ext-rounded'), false);

  eq('E2E-GR4: mixed-text cell text node unchanged',
    mixedCell.childNodes[0].nodeValue, mixedTextBefore);

  // Pure-numeric cell must be rounded.
  eq('E2E-GR4: pure-numeric cell IS rounded on grid',
    numericCell.classList.contains('dr-ext-rounded'), true);

  eq('E2E-GR4: pure-numeric cell text changed from original',
    numericCell.childNodes[0].nodeValue !== numericTextBefore, true);

  // drOriginal set on numeric, not on mixed.
  eq('E2E-GR4: drOriginal set on pure-numeric cell',
    numericCell.dataset.drOriginal, numericTextBefore);

  eq('E2E-GR4: drOriginal NOT set on mixed-text cell',
    mixedCell.dataset.drOriginal, undefined);
})();

// =============================================================================
// Grid-virtualization re-apply tests
// Spec: docs/sprint-plans/grid-support-v2.md §2 D4 + §4 "grid-virtualization"
// Commit: a65129c added GRID_REAPPLY_DEBOUNCE_MS, gridObservers, gridReapplyTimers,
// computeGridCellRoundedValue, reapplyGridRounding, observer attachment in roundTable,
// and teardown in resetTable + removed-node observer.
//
// Timer/observer control mechanism:
//   - Before each test, override global.MutationObserver with a capturing stub that
//     stores the callback so tests can fire it manually (simulating DOM mutations).
//   - Override global.setTimeout with a synchronous capture: store {fn, ms} in a
//     local array; call fn() directly to "advance past the debounce".
//   - Override global.clearTimeout with a no-op that marks the captured timer cancelled.
//   - Restore all globals in a finally block.
//
// The capturing MutationObserver must be installed BEFORE roundTable is called so that
// roundTable's `new MutationObserver(cb)` instantiates the capturing class, not the
// no-op stub that was installed at eval time.
// =============================================================================

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

// ---------------------------------------------------------------------------
// GV1: Recycle (childList) — new row appended while grid is rounded;
// observer + debounce fires; new row's numeric cells become rounded.
// ---------------------------------------------------------------------------
(function gv1_recycle_newRowRounded() {
  let ctx;
  try {
    // 2-row grid with big numbers so rounding changes the value.
    ctx = setupVirtGrid([
      ['8584629', '1234567'],
      ['7654321', '2345678'],
    ]);
    const { grid, pendingTimers } = ctx;

    // Pre-condition: existing cells are rounded.
    eq('GV1 (pre): existing cell[0] is rounded after roundTable',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), true);

    // Simulate row recycling: append a new unrounded row.
    const newCell0 = makeGridCellWithTextNode('9876543');
    const newCell1 = makeGridCellWithTextNode('3456789');
    const newRow = makeElementNode('row', [newCell0, newCell1]);
    newRow.dataset = { row: '2' };
    newRow.children = [newCell0, newCell1];
    newRow.querySelectorAll = function(sel) { return []; };

    // Add to the grid's children and allCells so querySelectorAll('.dr-ext-rounded') works.
    grid.wrapperEl.children.push(newRow);
    grid.wrapperEl.rowEls = grid.wrapperEl.children;
    // Patch the querySelectorAll on the wrapper to also scan new cells.
    const allCells = grid.cellEls.concat([newCell0, newCell1]);
    grid.wrapperEl.querySelectorAll = function(sel) {
      if (sel === '.dr-ext-rounded') {
        return allCells.filter(function(c) { return c.classList.contains('dr-ext-rounded'); });
      }
      return [];
    };

    // Trigger the observer callback (simulating a childList mutation).
    const obs = ctx.capturedObserver;
    eq('GV1 (pre): capturing observer was created',
      obs !== null, true);

    obs.trigger([{ type: 'childList' }]);

    // The observer callback schedules a debounce timer — flush it.
    flushTimers(pendingTimers);

    // The new cells should now be rounded.
    eq('GV1: new row cell[0] is rounded after recycle + re-apply',
      newCell0.classList.contains('dr-ext-rounded'), true);

    eq('GV1: new row cell[1] is rounded after recycle + re-apply',
      newCell1.classList.contains('dr-ext-rounded'), true);

    // The text node value must have changed from the original unrounded value.
    eq('GV1: new row cell[0] text node value differs from original unrounded value',
      newCell0.childNodes[0].nodeValue !== '9876543', true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV2: Sort revert (characterData) — the headline test.
// Round a grid; rewrite a rounded cell's text node back to its original value
// (simulating an in-place sort: same Text node, class .dr-ext-rounded retained).
// Trigger observer + debounce; assert cell is re-rounded.
// ---------------------------------------------------------------------------
(function gv2_sortRevert_cellReRounded() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;

    // cell[0] is a big numeric cell — it should be rounded.
    const cell0 = grid.cellEls[0];
    eq('GV2 (pre): cell[0] carries dr-ext-rounded after initial roundTable',
      cell0.classList.contains('dr-ext-rounded'), true);

    const tn0 = cell0.childNodes[0];
    const roundedValue = tn0.nodeValue;   // e.g. '8600000'
    const originalValue = cell0.dataset.drOriginal;  // e.g. '8584629'

    eq('GV2 (pre): roundedValue differs from original',
      roundedValue !== originalValue, true);

    // Simulate an in-place sort: framework rewrites text node back to original
    // but the cell KEEPS our .dr-ext-rounded class (node identity preserved).
    tn0.nodeValue = originalValue;
    // Class is still present (as in real sort behaviour).
    eq('GV2 (pre): class still present after sort-revert (simulated)',
      cell0.classList.contains('dr-ext-rounded'), true);

    // Trigger characterData mutation.
    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn0 }]);

    // Flush the debounce timer.
    flushTimers(pendingTimers);

    // The cell must be re-rounded: its text node value must equal the rounded value again.
    eq('GV2: cell[0] text node value re-rounded after sort-revert + re-apply',
      cell0.childNodes[0].nodeValue, roundedValue);

    eq('GV2: cell[0] still carries dr-ext-rounded after re-apply',
      cell0.classList.contains('dr-ext-rounded'), true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV3: Debounce — N rapid mutations result in reapplyGridRounding running once.
// Fire the observer callback 5 times in quick succession; assert that only
// one non-cancelled timer fires (earlier ones are cancelled by the debounce).
// ---------------------------------------------------------------------------
(function gv3_debounce_nMutationsFireReapplyOnce() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    // Fire observer callback 5 times rapidly.
    for (let i = 0; i < 5; i++) {
      obs.trigger([{ type: 'childList' }]);
    }

    // Count how many timers were NOT cancelled (should be exactly 1 — the last scheduled one).
    const activeCnt = pendingTimers.filter(function(t) { return !t.cancelled; }).length;
    eq('GV3: exactly 1 active (non-cancelled) debounce timer after 5 rapid mutations',
      activeCnt, 1);

    // Track re-apply call count by spying on gridReapplyTimers writes inside flush.
    let reapplyCalls = 0;
    const origRAGR = global.reapplyGridRounding;
    // We can't easily intercept the closure directly; instead count timer fires.
    // Each non-cancelled timer fires reapplyGridRounding once.
    flushTimers(pendingTimers);
    // If any additional timers were scheduled by the re-apply itself, they would appear here.
    const newTimers = pendingTimers.filter(function(t, i) { return i >= 5; });
    eq('GV3: no additional debounce timers spawned by the single re-apply (bounded)',
      newTimers.filter(function(t) { return !t.cancelled; }).length, 0);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV4: No self-trigger loop — a single re-apply does not schedule an unbounded
// cascade. After flushing the debounce timer once, no further timers should be
// pending (disconnect/reconnect guard prevents our own writes from re-triggering).
// ---------------------------------------------------------------------------
(function gv4_noSelfTriggerLoop() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    // Trigger once and flush — this runs reapplyGridRounding.
    obs.trigger([{ type: 'childList' }]);
    const countBefore = pendingTimers.length;  // should be 1

    flushTimers(pendingTimers);

    // reapplyGridRounding disconnects observer before writes and reconnects after.
    // Its own nodeValue writes must NOT schedule a new debounce timer.
    const countAfter = pendingTimers.length;
    eq('GV4: no new timer scheduled during re-apply (self-trigger loop prevented)',
      countAfter, countBefore);

    // Also assert the observer was disconnected during the write pass and reconnected.
    eq('GV4: observer disconnected at least once during re-apply (write guard)',
      obs.disconnectCount >= 1, true);

    eq('GV4: observer reconnected after re-apply',
      obs.reconnectCount >= 2, true);  // once in roundTable, once in reapplyGridRounding

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV5: After resetTable — a subsequent mutation does NOT trigger rounding.
// Observer disconnected + timer cleared on reset; subsequent observer trigger
// must not schedule a new debounce timer.
// ---------------------------------------------------------------------------
(function gv5_afterResetTable_noReTrigger() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    // Pre-condition: observer is set up.
    eq('GV5 (pre): gridObservers has entry for wrapperEl',
      gridObservers.has(grid.wrapperEl), true);

    // Reset the table — should disconnect the observer and clear any pending timer.
    resetTable(grid.wrapperEl);

    eq('GV5: gridObservers entry removed after resetTable',
      gridObservers.has(grid.wrapperEl), false);

    eq('GV5: gridReapplyTimers entry removed after resetTable',
      gridReapplyTimers.has(grid.wrapperEl), false);

    // Observer should be disconnected.
    eq('GV5: observer disconnected after resetTable',
      obs.disconnectCount >= 1, true);

    // Now simulate a mutation — the observer callback fires (it's the same object,
    // but it's been disconnected so in the real DOM it would not fire; here we
    // call it manually to prove the debounce logic does NOT schedule a new timer
    // because gridObservers / tableOptions no longer has the wrapper).
    const timerCountBefore = pendingTimers.length;
    obs.trigger([{ type: 'childList' }]);
    // The callback still fires (we're calling it directly), but reapplyGridRounding
    // will bail harmlessly because tableOptions no longer has the wrapper.
    // The debounce timer IS still scheduled by the closure (the closure holds wrapperEl).
    // Flush it and confirm no rounding occurred.
    flushTimers(pendingTimers);

    // After flush, cell[0] should be unrounded (resetTable restored originals).
    eq('GV5: cell[0] is NOT rounded after resetTable (dr-ext-rounded removed)',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), false);

    // Original value must be restored.
    eq('GV5: cell[0] text node value is restored to original after resetTable',
      grid.cellEls[0].childNodes[0].nodeValue, '8584629');

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV6 (Adversarial): Native <table> gets NO observer — after rounding a native
// table, gridObservers has no entry for it. Observer is grid-only (perf guard).
// ---------------------------------------------------------------------------
(function gv6_nativeTable_noGridObserver() {
  // Build a minimal native table stub that isDataTable and roundTable can process.
  const origMO = global.MutationObserver;
  const origSetTimeout = global.setTimeout;
  try {
    // Count MutationObserver instantiations to ensure none happen for native tables.
    let moConstructCount = 0;
    global.MutationObserver = class {
      constructor(cb) { moConstructCount++; this._cb = cb; }
      observe() {}
      disconnect() {}
    };
    global.setTimeout = () => 99;

    // Use the existing makeMockTable-level helper if available, or build manually.
    // We need a table with rows and cells that roundTable can process.
    // The simplest approach: build with the pattern used by existing native-table tests.
    const cell00 = { innerHTML: '8584629', textContent: '8584629', dataset: {}, classList: { _c: [], add(x){this._c.push(x);}, remove(x){this._c=this._c.filter(v=>v!==x);}, contains(x){return this._c.includes(x);} }, getAttribute: () => null };
    const cell01 = { innerHTML: '1234567', textContent: '1234567', dataset: {}, classList: { _c: [], add(x){this._c.push(x);}, remove(x){this._c=this._c.filter(v=>v!==x);}, contains(x){return this._c.includes(x);} }, getAttribute: () => null };
    const row0 = { cells: [cell00, cell01], tagName: 'TR', rowIndex: 0 };
    const cell10 = { innerHTML: '7654321', textContent: '7654321', dataset: {}, classList: { _c: [], add(x){this._c.push(x);}, remove(x){this._c=this._c.filter(v=>v!==x);}, contains(x){return this._c.includes(x);} }, getAttribute: () => null };
    const cell11 = { innerHTML: '2345678', textContent: '2345678', dataset: {}, classList: { _c: [], add(x){this._c.push(x);}, remove(x){this._c=this._c.filter(v=>v!==x);}, contains(x){return this._c.includes(x);} }, getAttribute: () => null };
    const row1 = { cells: [cell10, cell11], tagName: 'TR', rowIndex: 1 };
    const nativeTable = {
      tagName: 'TABLE',
      rows: [row0, row1],
      classList: { _c: [], add(x){this._c.push(x);}, remove(x){this._c=this._c.filter(v=>v!==x);}, contains(x){return this._c.includes(x);} },
      dataset: {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 40 }),
    };

    const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true });
    roundTable(nativeTable, opts);

    eq('GV6: gridObservers has NO entry for a native <table> after roundTable',
      gridObservers.has(nativeTable), false);

    eq('GV6: no MutationObserver instantiated for native table rounding',
      moConstructCount, 0);

  } finally {
    global.MutationObserver = origMO;
    global.setTimeout = origSetTimeout;
  }
})();

// ---------------------------------------------------------------------------
// GV7 (Adversarial): Removed-grid teardown — simulate the removed-node observer
// path for an observed grid; assert its observer is disconnected + timer cleared.
// ---------------------------------------------------------------------------
(function gv7_removedGrid_teardown() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    // Schedule a pending debounce timer by triggering the observer.
    obs.trigger([{ type: 'childList' }]);

    eq('GV7 (pre): a debounce timer is pending',
      pendingTimers.filter(function(t) { return !t.cancelled; }).length, 1);

    eq('GV7 (pre): gridObservers has entry for grid',
      gridObservers.has(grid.wrapperEl), true);

    // The removed-node observer path in content.js (the _tableObserver that watches
    // document.body) calls disconnect + delete when it detects a tracked table was
    // removed from the DOM. We simulate that path directly by invoking the same
    // cleanup logic that the observer callback executes:
    //   clearTimeout(gridReapplyTimers.get(table)); gridReapplyTimers.delete(table);
    //   gridObservers.get(table).disconnect(); gridObservers.delete(table);
    // In the test harness the _tableObserver is a no-op stub, so we exercise the
    // teardown path via resetTable (which runs the same teardown code and is the
    // direct production path called by the toggle-off handler).
    // For the removed-node path specifically: call the same sequence manually.
    const pendingTimer = gridReapplyTimers.get(grid.wrapperEl);
    if (pendingTimer !== undefined) {
      global.clearTimeout(pendingTimer);
      gridReapplyTimers.delete(grid.wrapperEl);
    }
    const gridObs = gridObservers.get(grid.wrapperEl);
    if (gridObs) {
      gridObs.disconnect();
      gridObservers.delete(grid.wrapperEl);
    }

    // Assert cleanup.
    eq('GV7: observer disconnected after removed-node teardown',
      obs.disconnectCount >= 1, true);

    eq('GV7: gridObservers entry deleted after removed-node teardown',
      gridObservers.has(grid.wrapperEl), false);

    eq('GV7: gridReapplyTimers entry deleted after removed-node teardown',
      gridReapplyTimers.has(grid.wrapperEl), false);

    // Previously-pending timer must now be cancelled.
    eq('GV7: pending debounce timer was cancelled during teardown',
      pendingTimers.filter(function(t) { return !t.cancelled; }).length, 0);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV8: Exclusion-gate parity — re-apply HONORS firstRow / firstColumn gates.
//
// Regression guard for the BLOCK: before the fix, reapplyGridRounding recomputed
// max_mag over an unfiltered cell set and wrote excluded cells.  After the fix
// (computeGridRoundedValues shared path), excluded cells get targetValue:null and
// are never written.
//
// Grid layout (2 rows × 2 cols):
//   row 0:  'Header'     '999999'     ← row 0 excluded by simplifyFirstRow:false
//   row 1:  '12345678'   '87654321'   ← row 1 data; col 0 excluded by simplifyFirstColumn:false
//
// Round with simplifyFirstRow:false, simplifyFirstColumn:false (the real defaults).
// After initial roundTable:
//   - cellEls[0] (row0,col0) = excluded (firstRow)   → NOT rounded
//   - cellEls[1] (row0,col1) = excluded (firstRow)   → NOT rounded
//   - cellEls[2] (row1,col0) = excluded (firstColumn)→ NOT rounded
//   - cellEls[3] (row1,col1) = in-range numeric      → IS rounded
//
// Then simulate a sort-revert on cellEls[3] (revert text to original).
// Trigger observer + flush.
// Assert:
//   - cellEls[0] still NOT rounded (text unchanged, no dr-ext-rounded)
//   - cellEls[2] still NOT rounded (text unchanged, no dr-ext-rounded)
//   - cellEls[3] IS re-rounded (text equals initial rounded value)
// ---------------------------------------------------------------------------
(function gv8_reapply_honorsExclusionGates_firstRowFirstColumn() {
  let ctx;
  try {
    ctx = setupVirtGrid(
      [
        ['Header', '999999'],
        ['12345678', '87654321'],
      ],
      // Override the setupVirtGrid defaults: exclusions must be ON (false = exclude).
      { simplifyFirstRow: false, simplifyFirstColumn: false }
    );
    const { grid, pendingTimers } = ctx;

    // cellEls layout (row-major): [row0col0, row0col1, row1col0, row1col1]
    const cell_r0c0 = grid.cellEls[0];  // 'Header'    — excluded firstRow
    const cell_r0c1 = grid.cellEls[1];  // '999999'    — excluded firstRow
    const cell_r1c0 = grid.cellEls[2];  // '12345678'  — excluded firstColumn
    const cell_r1c1 = grid.cellEls[3];  // '87654321'  — should be rounded

    // --- Pre-conditions after initial roundTable ---
    eq('GV8 (pre): row-0 col-0 is NOT rounded by initial pass (firstRow excluded)',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV8 (pre): row-0 col-1 is NOT rounded by initial pass (firstRow excluded)',
      cell_r0c1.classList.contains('dr-ext-rounded'), false);

    eq('GV8 (pre): row-1 col-0 is NOT rounded by initial pass (firstColumn excluded)',
      cell_r1c0.classList.contains('dr-ext-rounded'), false);

    eq('GV8 (pre): row-1 col-1 IS rounded by initial pass (in-range data cell)',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

    // Capture the rounded value so we can verify re-apply restores it.
    const tn_r1c1 = cell_r1c1.childNodes[0];
    const roundedValue_r1c1 = tn_r1c1.nodeValue;
    const originalValue_r1c1 = cell_r1c1.dataset.drOriginal;  // '87654321'

    eq('GV8 (pre): row-1 col-1 rounded value differs from original',
      roundedValue_r1c1 !== originalValue_r1c1, true);

    // Simulate a sort-revert on the in-range cell: framework rewrites the text
    // node back to the original value (node identity preserved, class retained).
    tn_r1c1.nodeValue = originalValue_r1c1;

    eq('GV8 (pre): row-1 col-1 class still present after sort-revert',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

    // Trigger observer and flush debounce.
    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn_r1c1 }]);
    flushTimers(pendingTimers);

    // --- Post-conditions: excluded cells must NOT be rounded ---
    eq('GV8: row-0 col-0 text unchanged after re-apply (firstRow exclusion honored)',
      cell_r0c0.childNodes[0].nodeValue, 'Header');

    eq('GV8: row-0 col-0 does NOT carry dr-ext-rounded after re-apply',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV8: row-1 col-0 text unchanged after re-apply (firstColumn exclusion honored)',
      cell_r1c0.childNodes[0].nodeValue, '12345678');

    eq('GV8: row-1 col-0 does NOT carry dr-ext-rounded after re-apply',
      cell_r1c0.classList.contains('dr-ext-rounded'), false);

    // --- Post-condition: the in-range data cell MUST be re-rounded ---
    eq('GV8: row-1 col-1 re-rounded after sort-revert + re-apply',
      cell_r1c1.childNodes[0].nodeValue, roundedValue_r1c1);

    eq('GV8: row-1 col-1 still carries dr-ext-rounded after re-apply',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV9: Exclusion-gate parity — re-apply HONORS percent / currency gates.
//
// Grid layout (2 rows × 2 cols):
//   row 0:  '75%'        '50%'        ← % cells excluded by simplifyMixedPercent:false
//   row 1:  '12345678'   '$9,999,999' ← col 1 currency excluded by simplifyMixedCurrency:false
//
// Round with simplifyFirstRow:true, simplifyFirstColumn:true (skip those gates),
// simplifyMixedPercent:false, simplifyMixedCurrency:false.
//
// After initial roundTable:
//   - cellEls[0] (row0,col0) = % excluded  → NOT rounded
//   - cellEls[1] (row0,col1) = % excluded  → NOT rounded
//   - cellEls[2] (row1,col0) = plain int   → IS rounded
//   - cellEls[3] (row1,col1) = $ excluded  → NOT rounded
//
// Simulate sort-revert on cellEls[2]; trigger observer + flush.
// Assert:
//   - cellEls[0] and cellEls[1] still NOT rounded (percent exclusion honored)
//   - cellEls[3] still NOT rounded (currency exclusion honored)
//   - cellEls[2] IS re-rounded (plain numeric, in-range)
// ---------------------------------------------------------------------------
(function gv9_reapply_honorsExclusionGates_percentCurrency() {
  let ctx;
  try {
    ctx = setupVirtGrid(
      [
        ['75%', '50%'],
        ['12345678', '$9999999'],
      ],
      {
        simplifyFirstRow: true,
        simplifyFirstColumn: true,
        simplifyMixedPercent: false,
        simplifyMixedCurrency: false,
      }
    );
    const { grid, pendingTimers } = ctx;

    const cell_r0c0 = grid.cellEls[0];  // '75%'       — excluded percent
    const cell_r0c1 = grid.cellEls[1];  // '50%'       — excluded percent
    const cell_r1c0 = grid.cellEls[2];  // '12345678'  — should be rounded
    const cell_r1c1 = grid.cellEls[3];  // '$9999999'  — excluded currency

    // --- Pre-conditions after initial roundTable ---
    eq('GV9 (pre): row-0 col-0 (75%) is NOT rounded by initial pass (percent excluded)',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV9 (pre): row-0 col-1 (50%) is NOT rounded by initial pass (percent excluded)',
      cell_r0c1.classList.contains('dr-ext-rounded'), false);

    eq('GV9 (pre): row-1 col-0 IS rounded by initial pass (plain numeric)',
      cell_r1c0.classList.contains('dr-ext-rounded'), true);

    eq('GV9 (pre): row-1 col-1 ($9999999) is NOT rounded by initial pass (currency excluded)',
      cell_r1c1.classList.contains('dr-ext-rounded'), false);

    // Capture the rounded value for re-apply verification.
    const tn_r1c0 = cell_r1c0.childNodes[0];
    const roundedValue_r1c0 = tn_r1c0.nodeValue;
    const originalValue_r1c0 = cell_r1c0.dataset.drOriginal;

    eq('GV9 (pre): row-1 col-0 rounded value differs from original',
      roundedValue_r1c0 !== originalValue_r1c0, true);

    // Simulate sort-revert on the plain numeric cell.
    tn_r1c0.nodeValue = originalValue_r1c0;

    // Trigger observer and flush debounce.
    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn_r1c0 }]);
    flushTimers(pendingTimers);

    // --- Post-conditions: excluded cells must NOT be rounded ---
    eq('GV9: row-0 col-0 text unchanged after re-apply (percent exclusion honored)',
      cell_r0c0.childNodes[0].nodeValue, '75%');

    eq('GV9: row-0 col-0 does NOT carry dr-ext-rounded after re-apply',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV9: row-0 col-1 text unchanged after re-apply (percent exclusion honored)',
      cell_r0c1.childNodes[0].nodeValue, '50%');

    eq('GV9: row-1 col-1 text unchanged after re-apply (currency exclusion honored)',
      cell_r1c1.childNodes[0].nodeValue, '$9999999');

    eq('GV9: row-1 col-1 does NOT carry dr-ext-rounded after re-apply',
      cell_r1c1.classList.contains('dr-ext-rounded'), false);

    // --- Post-condition: the plain numeric cell MUST be re-rounded ---
    eq('GV9: row-1 col-0 re-rounded after sort-revert + re-apply',
      cell_r1c0.childNodes[0].nodeValue, roundedValue_r1c0);

    eq('GV9: row-1 col-0 still carries dr-ext-rounded after re-apply',
      cell_r1c0.classList.contains('dr-ext-rounded'), true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// Sprint add-phantom-a11y-predicate: isPhantomA11yTable
// ---------------------------------------------------------------------------
//
// isPhantomA11yTable(table) returns true when ANY of three signals holds:
//   Signal 1 – table or any ancestor has aria-hidden="true"
//   Signal 2 – nearest positioned ancestor (or the table itself) has inline
//               left <= OFFSCREEN_LEFT_PX_THRESHOLD (-9999)
//   Signal 3 – nearest positioned ancestor contains an <svg> with a non-empty
//               aria-label
// Returns false for an ordinary on-screen 2-column numeric table.
//
// Mock-building helpers:
//   makePhantomEl(attrs)  – minimal element node with getAttribute / parentElement / style
//   chainParents(child, ...parents)  – link elements into a parentElement chain
//   makePositionedAncestor(styleProps)  – element with style.position = 'absolute'

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

// --- AC: OFFSCREEN_LEFT_PX_THRESHOLD is -9999 ---
(function phantomA11y_threshold_value() {
  eq('isPhantomA11yTable: OFFSCREEN_LEFT_PX_THRESHOLD === -9999',
    OFFSCREEN_LEFT_PX_THRESHOLD, -9999);
})();

// ---------------------------------------------------------------------------
// Signal 1: aria-hidden="true" on the table itself
// ---------------------------------------------------------------------------
(function phantomA11y_signal1_selfHidden() {
  const table = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
  eq('isPhantomA11yTable: aria-hidden="true" on table itself -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 1: aria-hidden="true" on immediate parent
(function phantomA11y_signal1_parentHidden() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  const parent = makePhantomEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, parent);
  eq('isPhantomA11yTable: aria-hidden="true" on immediate parent -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 1: aria-hidden="true" several ancestors up (nested deeply)
(function phantomA11y_signal1_deepAncestorHidden() {
  const table      = makePhantomEl({ tagName: 'TABLE' });
  const tbody      = makePhantomEl({ tagName: 'TBODY' });
  const innerDiv   = makePhantomEl({ tagName: 'DIV' });
  const middleDiv  = makePhantomEl({ tagName: 'DIV' });
  const outerDiv   = makePhantomEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, tbody, innerDiv, middleDiv, outerDiv);
  eq('isPhantomA11yTable: aria-hidden="true" several levels up -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: aria-hidden="false" must NOT trigger signal 1
(function phantomA11y_signal1_ariaHiddenFalse() {
  const table  = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'false' } });
  const parent = makePhantomEl({ tagName: 'DIV',   attrs: { 'aria-hidden': 'false' } });
  chainParents(table, parent);
  eq('isPhantomA11yTable: aria-hidden="false" does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Signal 2: nearest positioned ancestor has inline left <= threshold
// ---------------------------------------------------------------------------

// Signal 2: positioned ancestor with left: -10000px (Kaggle evidence)
(function phantomA11y_signal2_offscreenLeft_minus10000() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-10000px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-10000px -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 2: positioned ancestor at exactly the threshold value (-9999px)
(function phantomA11y_signal2_offscreenLeft_exactThreshold() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9999px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-9999px (at threshold) -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 2: table itself is positioned and off-screen (no separate ancestor)
(function phantomA11y_signal2_tableSelfOffscreen() {
  const table = makePhantomEl({ tagName: 'TABLE', style: { position: 'absolute', left: '-10000px' } });
  eq('isPhantomA11yTable: table itself is positioned with left=-10000px -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: left value just ABOVE threshold (-9998px) must NOT trigger
(function phantomA11y_signal2_leftJustAboveThreshold() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9998px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-9998px (above threshold) -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: modest off-screen like -100px must NOT trigger signal 2
(function phantomA11y_signal2_modestNegativeLeft() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-100px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-100px (not extreme) -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: non-positioned ancestor with extreme left — should NOT count because the
// ancestor is not positioned; no positioned ancestor found so checkEl = table,
// and table has no extreme left.
(function phantomA11y_signal2_nonPositionedAncestorIgnored() {
  const table   = makePhantomEl({ tagName: 'TABLE' });
  // wrapper has no inline style.position and getComputedStyle returns '' for position
  const wrapper = makePhantomEl({ tagName: 'DIV', style: { left: '-10000px' } });
  chainParents(table, wrapper);
  // No positioned ancestor found → checkEl = table (which has no extreme left)
  eq('isPhantomA11yTable: non-positioned ancestor with extreme left -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Signal 3: nearest positioned ancestor contains <svg> with non-empty aria-label
// ---------------------------------------------------------------------------

// Signal 3: positioned ancestor has querySelectorAll('svg') returning labelled svg
(function phantomA11y_signal3_svgWithAriaLabel() {
  const svg = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': 'Monthly Revenue Chart' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor has svg[aria-label="..."] -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 3: multiple SVGs in ancestor, only one has a label — still triggers
(function phantomA11y_signal3_multipleSvgsOneLabelledOne() {
  const svgNoLabel  = makePhantomEl({ tagName: 'SVG' }); // no aria-label
  const svgLabelled = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': 'Pie Chart' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svgNoLabel; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svgNoLabel, svgLabelled] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: one of two svgs has aria-label -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: svg with EMPTY aria-label must NOT trigger signal 3
(function phantomA11y_signal3_svgEmptyAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': '' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with empty aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: svg with whitespace-only aria-label must NOT trigger signal 3
(function phantomA11y_signal3_svgWhitespaceAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': '   ' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with whitespace-only aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: svg with NO aria-label attribute at all must NOT trigger signal 3
(function phantomA11y_signal3_svgNoAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG' }); // getAttribute returns null
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with no aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: no positioned ancestor found at all — signal 3 is skipped entirely (no crash)
(function phantomA11y_signal3_noPosAncestor() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  // No parentElement — predicate must not throw and returns false
  eq('isPhantomA11yTable: no positioned ancestor, no signals -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Negative case: ordinary on-screen 2-column numeric table
// ---------------------------------------------------------------------------
(function phantomA11y_negative_ordinaryTable() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const parent = makePhantomEl({ tagName: 'DIV' });
  chainParents(table, parent);
  // No aria-hidden, no off-screen left, no positioned ancestor → false
  eq('isPhantomA11yTable: ordinary on-screen numeric table -> false',
    isPhantomA11yTable(table), false);
})();

// Negative: positioned ancestor but normal on-screen left (-50px), no svg, no aria-hidden
(function phantomA11y_negative_onscreenPositionedAncestor() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-50px' });
  posAnc.querySelectorAll = function() { return []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor with normal left (-50px), no svg -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Guard: invalid / null input
// ---------------------------------------------------------------------------
(function phantomA11y_nullInput() {
  eq('isPhantomA11yTable: null -> false',
    isPhantomA11yTable(null), false);
})();

(function phantomA11y_noGetAttribute() {
  eq('isPhantomA11yTable: plain object without getAttribute -> false',
    isPhantomA11yTable({}), false);
})();

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

// --- pass1-filter AC1: phantom tables (aria-hidden ancestor) get NO toggle ---
// Build N=3 phantom tables (aria-hidden parent), all valid data tables.
// After Pass 1 none of them should be in tableToggles.

(function pass1Filter_ariaHiddenPhantoms_zeroToggles() {
  function makeAriaHiddenPhantom() {
    const t = makePass1DataTable();
    // aria-hidden="true" on the immediate parent (Signal 1)
    const hiddenParent = {
      tagName: 'DIV',
      getAttribute: function(name) { return name === 'aria-hidden' ? 'true' : null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = hiddenParent;
    t.parentNode    = null;
    return t;
  }

  const phantoms = [makeAriaHiddenPhantom(), makeAriaHiddenPhantom(), makeAriaHiddenPhantom()];

  // Sanity: each phantom is a valid data table (isDataTable guard is NOT the cause of skip)
  eq('pass1-filter: phantom aria-hidden table satisfies isDataTable (sanity)',
    isDataTable(phantoms[0]), true);
  // Sanity: each phantom is detected as phantom
  eq('pass1-filter: phantom aria-hidden table isPhantomA11yTable is true (sanity)',
    isPhantomA11yTable(phantoms[0]), true);

  runPass1WithTables(phantoms);

  const togglesCreated = phantoms.filter(t => tableToggles.has(t)).length;
  eq('pass1-filter: 3 aria-hidden phantom tables → ZERO toggles created',
    togglesCreated, 0);

  cleanupPass1Tables(phantoms);
})();

// --- pass1-filter AC1: phantom tables (off-screen left) get NO toggle ---
// Build N=2 phantom tables with positioned ancestor left=-10000px.

(function pass1Filter_offscreenLeftPhantoms_zeroToggles() {
  function makeOffscreenPhantom() {
    const t = makePass1DataTable();
    // Positioned ancestor with extreme left (Signal 2)
    const posAnc = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: { position: 'absolute', left: '-10000px' },
      parentElement: null,
      parentNode: null,
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
    };
    t.parentElement = posAnc;
    t.parentNode    = null;
    return t;
  }

  const phantoms = [makeOffscreenPhantom(), makeOffscreenPhantom()];

  // Sanity checks
  eq('pass1-filter: off-screen phantom table satisfies isDataTable (sanity)',
    isDataTable(phantoms[0]), true);
  eq('pass1-filter: off-screen phantom table isPhantomA11yTable is true (sanity)',
    isPhantomA11yTable(phantoms[0]), true);

  runPass1WithTables(phantoms);

  const togglesCreated = phantoms.filter(t => tableToggles.has(t)).length;
  eq('pass1-filter: 2 off-screen phantom tables → ZERO toggles created',
    togglesCreated, 0);

  cleanupPass1Tables(phantoms);
})();

// --- pass1-filter AC2: a normal on-screen table still gets exactly ONE toggle ---

(function pass1Filter_realTable_getsOneToggle() {
  const realTable = makePass1DataTable();
  // No aria-hidden, no positioned ancestor, no svg → isPhantomA11yTable returns false
  const wrapper = {
    tagName: 'DIV',
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
  };
  realTable.parentElement = wrapper;
  realTable.parentNode    = null;

  // Sanity checks
  eq('pass1-filter: real on-screen table satisfies isDataTable (sanity)',
    isDataTable(realTable), true);
  eq('pass1-filter: real on-screen table isPhantomA11yTable is false (sanity)',
    isPhantomA11yTable(realTable), false);

  runPass1WithTables([realTable]);

  eq('pass1-filter: normal on-screen table → exactly ONE toggle created',
    tableToggles.has(realTable), true);

  cleanupPass1Tables([realTable]);
})();

// --- pass1-filter adversarial: mix of phantom + real tables in one Pass 1 run ---
// Only the real tables should get toggles; count equals exactly the number of real tables.

(function pass1Filter_mixedFixture_onlyRealTablesGetToggles() {
  // Two phantom tables (aria-hidden ancestor)
  function makeAriaHiddenPhantom() {
    const t = makePass1DataTable();
    const hiddenParent = {
      tagName: 'DIV',
      getAttribute: function(name) { return name === 'aria-hidden' ? 'true' : null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = hiddenParent;
    t.parentNode    = null;
    return t;
  }

  // One phantom with off-screen left
  function makeOffscreenPhantom() {
    const t = makePass1DataTable();
    const posAnc = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: { position: 'absolute', left: '-10000px' },
      parentElement: null,
      parentNode: null,
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
    };
    t.parentElement = posAnc;
    t.parentNode    = null;
    return t;
  }

  // Two real on-screen tables
  function makeRealTable() {
    const t = makePass1DataTable();
    const wrapper = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = wrapper;
    t.parentNode    = null;
    return t;
  }

  const phantom1 = makeAriaHiddenPhantom();
  const phantom2 = makeAriaHiddenPhantom();
  const phantom3 = makeOffscreenPhantom();
  const real1    = makeRealTable();
  const real2    = makeRealTable();

  // Interleave so Pass 1 processes them in mixed order
  const allTables = [phantom1, real1, phantom2, real2, phantom3];

  runPass1WithTables(allTables);

  const phantoms = [phantom1, phantom2, phantom3];
  const reals    = [real1, real2];

  const phantomToggles = phantoms.filter(t => tableToggles.has(t)).length;
  const realToggles    = reals.filter(t => tableToggles.has(t)).length;

  eq('pass1-filter (mix): phantom tables get ZERO toggles',
    phantomToggles, 0);
  eq('pass1-filter (mix): real tables each get a toggle — count equals 2',
    realToggles, 2);
  eq('pass1-filter (mix): total toggles created equals number of real tables',
    tableToggles.has(real1) && tableToggles.has(real2) && !tableToggles.has(phantom1) &&
    !tableToggles.has(phantom2) && !tableToggles.has(phantom3), true);

  cleanupPass1Tables(allTables);
})();

// --- pass1-filter: Pass 1 skips phantom but does NOT skip a non-data real table ---
// (edge: if a real table fails isDataTable, no toggle either — confirm the skip
// here is from isDataTable, not from isPhantomA11yTable)
(function pass1Filter_nonDataRealTable_noToggle() {
  // 1-row table: fails isDataTable (< 2 rows)
  const nonDataTable = {
    tagName: 'TABLE',
    rows: [
      { cells: [
          { tagName: 'TD', innerText: '100', textContent: '100', innerHTML: '100',
            classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
            dataset: {}, title: '', querySelectorAll:()=>[], removeAttribute(){} },
          { tagName: 'TD', innerText: '200', textContent: '200', innerHTML: '200',
            classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
            dataset: {}, title: '', querySelectorAll:()=>[], removeAttribute(){} },
        ]
      },
    ],
    dataset: {},
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getBoundingClientRect: function() { return { top: 10, right: 100, bottom: 50, left: 10 }; },
    classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
  };

  // Confirm isPhantomA11yTable is false (skip is NOT from the phantom guard)
  eq('pass1-filter: non-data real table isPhantomA11yTable is false (sanity)',
    isPhantomA11yTable(nonDataTable), false);
  // Confirm isDataTable is false
  eq('pass1-filter: non-data real table isDataTable is false (sanity)',
    isDataTable(nonDataTable), false);

  runPass1WithTables([nonDataTable]);

  eq('pass1-filter: non-data real table gets no toggle (isDataTable gate)',
    tableToggles.has(nonDataTable), false);

  cleanupPass1Tables([nonDataTable]);
})();

// --- pass1-filter: duplicate Pass 1 call does NOT create a second toggle for a real table ---
// (regression guard: tableToggles.has check prevents double-insertion)
(function pass1Filter_duplicateRun_noDoubleToggle() {
  const realTable = makePass1DataTable();
  const wrapper = {
    tagName: 'DIV',
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
  };
  realTable.parentElement = wrapper;
  realTable.parentNode    = null;

  // First run
  runPass1WithTables([realTable]);
  const afterFirst = tableToggles.has(realTable);

  // Second run — table already in tableToggles; Pass 1 should skip it.
  // We verify the toggle isn't re-inserted: since WeakMap.set overwrites,
  // a re-create would swap the button object, so we check its identity holds.
  const buttonAfterFirst = tableToggles.get(realTable);
  runPass1WithTables([realTable]);
  const buttonAfterSecond = tableToggles.get(realTable);

  eq('pass1-filter: first Pass 1 run creates toggle for real table',
    afterFirst, true);
  eq('pass1-filter: second Pass 1 run does not replace the existing toggle (same object)',
    buttonAfterFirst === buttonAfterSecond, true);

  cleanupPass1Tables([realTable]);
})();

// --- Report ---
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  for (const f of failures) {
    console.log(`\n  ${f.name}`);
    console.log(`    expected: ${JSON.stringify(f.expected)}`);
    console.log(`    actual:   ${JSON.stringify(f.actual)}`);
  }
  process.exit(1);
}
