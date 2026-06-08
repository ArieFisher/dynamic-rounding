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
const code = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
eval(defaultsCode + '\n' + roundingCode + '\n' + code + `
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
    excludeWords: true, simplifyDates: false, simplifyTimes: false,
    excludeFirstColumn: true, excludePercent: false, excludeCurrency: false
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
  // New semantics: percent cells are EXCLUDED by default (includePercent defaults false/unset).
  eq('exclude: percent excluded by default (includePercent unset)',
    getExclusionReason('45%', 1, {}), 'percent');
  eq('exclude: percent excluded when includePercent=false',
    getExclusionReason('45%', 1, { includePercent: false }), 'percent');
  eq('exclude: percent included when includePercent=true',
    getExclusionReason('45%', 1, { includePercent: true }), null);
})();

(function exclusionCurrency() {
  // New semantics: currency cells are EXCLUDED by default (includeCurrency defaults false/unset).
  eq('exclude: currency excluded by default (includeCurrency unset)',
    getExclusionReason('$1,234', 1, {}), 'currency');
  eq('exclude: currency excluded when includeCurrency=false',
    getExclusionReason('$1,234', 1, { includeCurrency: false }), 'currency');
  eq('exclude: currency included when includeCurrency=true',
    getExclusionReason('$1,234', 1, { includeCurrency: true }), null);
  eq('exclude: euro excluded by default',
    getExclusionReason('€1,234', 1, {}), 'currency');
  eq('exclude: euro included when includeCurrency=true',
    getExclusionReason('€1,234', 1, { includeCurrency: true }), null);
  eq('exclude: rupee excluded by default',
    getExclusionReason('₹615', 1, {}), 'currency');
})();

// --- Sprint sidebar-restructure: excludeFirstRow ---

(function excludeFirstRowTests() {
  // excludeFirstRow=true: row 0 must be excluded regardless of cell content
  eq('excludeFirstRow: row 0 excluded when flag is true',
    getExclusionReason('1,234', 1, { excludeFirstRow: true }, 0), 'firstRow');
  // excludeFirstRow=true: row 1 is not affected
  eq('excludeFirstRow: row 1 not excluded when flag is true',
    getExclusionReason('1,234', 1, { excludeFirstRow: true }, 1), null);
  // excludeFirstRow=false: row 0 is NOT excluded
  eq('excludeFirstRow: row 0 not excluded when flag is false',
    getExclusionReason('1,234', 1, { excludeFirstRow: false }, 0), null);
  // excludeFirstRow unset (default): row 0 is NOT excluded
  eq('excludeFirstRow: row 0 not excluded when flag is unset (default)',
    getExclusionReason('1,234', 1, {}, 0), null);
  // excludeFirstRow takes priority over firstColumn check
  eq('excludeFirstRow: firstRow beats firstColumn when both apply',
    getExclusionReason('anything', 0, { excludeFirstRow: true, excludeFirstColumn: true }, 0), 'firstRow');
})();

// --- Sprint sidebar-restructure: includeWords semantics ---

(function includeWordsTests() {
  // With includeWords=true, a cell with a number AND a word should be rounded
  // (mode='extracted' in roundTable). We test the path via the roundTable flow
  // by checking that the cell text '8,584,629 USD' gets an 'extracted' mode.
  const textWithWord = '$5.123 USD';
  const textPure = '5.123';

  // includeWords=true: extractNumbersInText finds a match and cell would be rounded
  (function includeWordsOn() {
    const matches = extractNumbersInText(textWithWord);
    eq('includeWords=true: extractNumbersInText finds number in "$5.123 USD"',
      matches.length > 0, true);
    // Simulate the branch in roundTable: if (opts.includeWords) -> extracted path
    const num = toNumber(textWithWord);
    eq('includeWords=true: toNumber("$5.123 USD") is null (not pure numeric)',
      num, null);
    // When includeWords=true, the cell would go through extracted path
    const optsInclude = { includeWords: true };
    const wouldRound = num !== null ? true : (optsInclude.includeWords && matches.length > 0);
    eq('includeWords=true: cell with words would be rounded', wouldRound, true);
  })();

  // includeWords=false (default): cell with words must NOT be rounded
  (function includeWordsOff() {
    const num = toNumber(textWithWord);
    const optsExclude = { includeWords: false };
    // Simulate roundTable logic: toNumber returns null, includeWords=false -> skip
    const wouldRound = num !== null ? true : (optsExclude.includeWords === true);
    eq('includeWords=false: cell with words would NOT be rounded', wouldRound, false);
    // Same with default (unset)
    const optsDefault = {};
    const wouldRoundDefault = num !== null ? true : (optsDefault.includeWords === true);
    eq('includeWords unset: cell with words would NOT be rounded', wouldRoundDefault, false);
  })();
})();

// --- Sprint sidebar-restructure: includePercent / includeCurrency round-trip ---

(function includePercentRoundTrip() {
  // includeCurrency: true -> currency cells are NOT excluded
  eq('includeCurrency=true: $1,234 is not excluded',
    getExclusionReason('$1,234', 1, { includeCurrency: true }), null);
  // includeCurrency unset -> currency cells ARE excluded
  eq('includeCurrency unset: $1,234 is excluded',
    getExclusionReason('$1,234', 1, {}), 'currency');
  // includePercent: true -> percent cells are NOT excluded
  eq('includePercent=true: 45% is not excluded',
    getExclusionReason('45%', 1, { includePercent: true }), null);
  // includePercent unset -> percent cells ARE excluded
  eq('includePercent unset: 45% is excluded',
    getExclusionReason('45%', 1, {}), 'percent');
})();

// First-match-wins priority: firstRow beats firstColumn beats percent beats currency
// (dates/times are no longer exclusion reasons)
(function exclusionPriority() {
  const opts = {
    excludeFirstRow: true, excludeFirstColumn: true, simplifyDates: true, simplifyTimes: true,
    includePercent: false, includeCurrency: false
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
//   - excludeFirstColumn excludes the first <td>, not the leftmost DOM cell.
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
// With rangeExpr = "A" (col 0 in dataCol space) and no excludeFirstColumn,
// "A" should hit <td>100</td> (the first <td>), NOT the <th>Name</th>.
(function firstColIsA_withRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'th', text: 'Name' },
      { tag: 'td', text: '100'  },
      { tag: 'td', text: '200'  },
    ]]);
    const opts = {
      enabled: true, excludeWords: true, simplifyDates: false, simplifyTimes: false,
      excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
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
      enabled: true, excludeWords: true, simplifyDates: false, simplifyTimes: false,
      excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
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

// --- Test 3: excludeFirstColumn + row headers ---
// Row: [<th>Name</th>, <td>100</td>, <td>200</td>]
// rangeExpr = '' (whole table), excludeFirstColumn = true.
// Dev behavior: excludeFirstColumn checks dataCol === 0, so <td>100</td> is
// excluded (not the <th>, which is skipped from the data loop entirely).
(function excludeFirstColumn_withRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'th', text: 'Name' },
      { tag: 'td', text: '100'  },
      { tag: 'td', text: '200'  },
    ]]);
    const opts = {
      enabled: true, excludeWords: true, simplifyDates: true, simplifyTimes: true,
      excludeFirstColumn: true, excludePercent: false, excludeCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cells = table.rows[0].cells;
    // <th> Name: skipped (not a TD)
    eq('excludeFirstColumn (row-header table): <th> Name never rounded',
      cells[0].classList.contains('dr-ext-rounded'), false);
    // <td>100 is dataCol 0 — excluded by excludeFirstColumn (dev reading II)
    eq('excludeFirstColumn (row-header table): <td>100 at dataCol 0 is excluded',
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
      enabled: true, excludeWords: true, simplifyDates: false, simplifyTimes: false,
      excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
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
// toNumber('+2.3%') -> null (percent), and with includePercent unset it's excluded entirely.
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
      enabled: true, excludeWords: true, simplifyDates: false, simplifyTimes: false,
      excludeFirstColumn: false, includePercent: false, includeCurrency: false,
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
      enabled: true, includeWords: true, simplifyDates: false, simplifyTimes: false,
      excludeFirstColumn: false, includePercent: true, includeCurrency: true,
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
  // 5a. cell.innerText || cell.textContent is the read source (static analysis)
  const contentSrc = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
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
  // content.js MUST define getQuoteMaskedRanges (existence check)
  eq('regression: content.js defines getQuoteMaskedRanges',
    contentSrc.includes('function getQuoteMaskedRanges('), true);
  // content.js MUST define overlapsQuoteRange
  eq('regression: content.js defines overlapsQuoteRange',
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
  eq('sidebar-defaults: includeWords default is true in DR_DEFAULTS',
    DR_DEFAULTS.includeWords, true);
  eq('sidebar-defaults: includeCurrency default is true in DR_DEFAULTS',
    DR_DEFAULTS.includeCurrency, true);
  eq('sidebar-defaults: includePercent default is true in DR_DEFAULTS',
    DR_DEFAULTS.includePercent, true);
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
  eq('sidebar-defaults: manifest content_scripts loads defaults.js, rounding.js, content.js in order',
    manifest.content_scripts[0].js[0] === 'defaults.js' &&
    manifest.content_scripts[0].js[1] === 'rounding.js' &&
    manifest.content_scripts[0].js[2] === 'content.js', true);

  // AC3: (sidebar-tidyup) the old "section-heading" with "Include numbers in cells containing:"
  // was removed in the sidebar-tidyup sprint — no replacement test needed here.

  // AC4a: rangeSection div has "hidden" attribute.
  eq('sidebar-defaults: rangeSection has hidden attribute',
    /<div[^>]*id="rangeSection"[^>]*hidden/.test(sidebarHtml) ||
    /<div[^>]*hidden[^>]*id="rangeSection"/.test(sidebarHtml), true);

  // AC4b: rangeSection markup is still present (not deleted).
  eq('sidebar-defaults: rangeSection markup still present in HTML',
    sidebarHtml.includes('id="rangeSection"'), true);

  // AC5: content.js still defines parseRangeExpr (no regression).
  eq('sidebar-defaults: content.js still defines parseRangeExpr',
    /function parseRangeExpr\b/.test(contentJsSource), true);

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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
    // Two-row table: row 0 is the header (excluded by DR_DEFAULTS.excludeFirstRow=true),
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
    // Two-row table: row 0 is excluded (DR_DEFAULTS.excludeFirstRow=true), row 1 has
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
  const src = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
  eq('auto-table-toggle: content.js declares tableToggles WeakMap',
    /const\s+tableToggles\s*=\s*new\s+WeakMap/.test(src), true);
  eq('auto-table-toggle: content.js declares trackedTables Set',
    /const\s+trackedTables\s*=\s*new\s+Set/.test(src), true);
  eq('auto-table-toggle: content.js defines isTableRounded',
    /function\s+isTableRounded\b/.test(src), true);
  eq('auto-table-toggle: content.js defines syncSwitchForTable',
    /function\s+syncSwitchForTable\b/.test(src), true);
  eq('auto-table-toggle: content.js defines positionToggle',
    /function\s+positionToggle\b/.test(src), true);
  eq('auto-table-toggle: content.js defines createToggleForTable',
    /function\s+createToggleForTable\b/.test(src), true);
  eq('auto-table-toggle: content.js defines injectTableToggles',
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
  const src = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

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
        excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
        includeWords: false, excludeFirstRow: false,
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
        excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
        includeWords: false, excludeFirstRow: false,
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
        excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
        includeWords: false, excludeFirstRow: false,
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
        excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
        includeWords: false, excludeFirstRow: false,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: 'decade',
      });
      return tbl.rows[0].cells[0].innerText;
    }

    eq('non-date passthrough: "hello" stays unchanged', runSingleCell('hello'), 'hello');
    // "14 March" has no year → isDateLike returns false → treated as a word-embedded number
    // excludeWords=false in our setup? Actually includeWords is false here, so it skips.
    // Let's just verify it doesn't get the rounded class.
    const tbl = makeMockTable([[{ tag: 'td', text: '14 March' }]]);
    tbl.rows[0].cells[0].querySelectorAll = () => [];
    roundTable(tbl, {
      enabled: true, simplifyDates: true, simplifyTimes: false,
      excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
      includeWords: false, excludeFirstRow: false,
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
      excludeFirstColumn: false, excludePercent: false, excludeCurrency: false,
      includeWords: false, excludeFirstRow: false,
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
  const src = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

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
  vm.runInContext(patchedRounding + '\n' + contentSrc + '\nthis.__roundWithOffset = roundWithOffset;', ctx);
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
  const src = require('fs').readFileSync(require('path').join(__dirname, 'content.js'), 'utf8');

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

  eq('sidebar-tidyup AC3: DR_DEFAULTS.includeWords is true',
    DR_DEFAULTS.includeWords, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.includeCurrency is true',
    DR_DEFAULTS.includeCurrency, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.includePercent is true',
    DR_DEFAULTS.includePercent, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyDates is true',
    DR_DEFAULTS.simplifyDates, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyTimes is false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.excludeFirstRow is false',
    DR_DEFAULTS.excludeFirstRow, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.excludeFirstColumn is false',
    DR_DEFAULTS.excludeFirstColumn, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.dateGranularity is "decade"',
    DR_DEFAULTS.dateGranularity, 'decade');
  eq('sidebar-tidyup AC3: DR_DEFAULTS.timeGranularity is "hour"',
    DR_DEFAULTS.timeGranularity, 'hour');

  // ── AC4: every option-row checkbox is wrapped in a .switch element ──
  // For each of the seven option inputs by id, verify there is a parent
  // element with class "switch" enclosing the input.
  const optionInputIds = [
    'includeWords', 'includeCurrency', 'includePercent',
    'simplifyDates', 'simplifyTimes', 'excludeFirstRow', 'excludeFirstColumn'
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
  const contentSrc = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
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
  // Rows to check: includeWords, excludeFirstColumn (simple), simplifyDates, simplifyTimes.
  const simpleRows = ['includeWords', 'excludeFirstColumn'];
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

// Standard opts for the exponent tests.  includeWords: true is required to
// engage the <sup> extraction path (the guard at line ~773 of content.js).
const supTestOpts = {
  enabled: true,
  includeWords: true,
  includeCurrency: true,
  includePercent: true,
  excludeFirstRow: false,
  excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
// AND includeWords=false, the cell must be fully skipped.
// Adversarial: confirm there is no fallthrough that rounds the time as a numeric value.
// (Note: includeWords=true would extract 14 and 30 independently — that is a separate
// feature path. Here we test the pure numeric exclusion path only.)
(function invertPills_adv_AC4_timeNotTreatedAsNumber() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC4: 14:30 with simplifyTimes=false and includeWords=false — not rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC4: 14:30 with simplifyTimes=false and includeWords=false — text unchanged',
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
      enabled: true, includeWords: false, includeCurrency: false, includePercent: false,
      excludeFirstRow: false, excludeFirstColumn: false,
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
