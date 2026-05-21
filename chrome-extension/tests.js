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
global.document = { addEventListener: () => {} };
global.window = { addEventListener: () => {} };
global.NodeFilter = { SHOW_TEXT: 4 };

const code = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
eval(code);

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

eq('format: decimal padding preserved when |x|<10',
  formatExtractedNumber(1.5, '1.234'),
  '1.500');

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

eq('isYearValue: 2018 -> true', isYearValue('2018'), true);
eq('isYearValue: 1899 -> false', isYearValue('1899'), false);
eq('isYearValue: 2100 -> false', isYearValue('2100'), false);
eq('isYearValue: 12 -> false', isYearValue('12'), false);
eq('isYearValue: 20181 -> false', isYearValue('20181'), false);

eq('isDateLike: bare 4-digit year', isDateLike('2018'), true);
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
    excludeWords: true, excludeDates: false, excludeTimes: false,
    excludeFirstColumn: true, excludePercent: false, excludeCurrency: false
  });
  eq('exclude: first column with flag on', getExclusionReason('anything', 0, opts), 'firstColumn');
  eq('exclude: non-first column ignores flag', getExclusionReason('anything', 1, opts), null);
})();

(function exclusionDates() {
  const opts = { excludeDates: true };
  eq('exclude: year cell when excludeDates=true',
    getExclusionReason('2018', 1, opts), 'dates');
  eq('exclude: non-date cell when excludeDates=true',
    getExclusionReason('1,234', 1, opts), null);
  eq('exclude: year cell when excludeDates=false',
    getExclusionReason('2018', 1, { excludeDates: false }), null);
})();

(function exclusionTimes() {
  eq('exclude: time cell when excludeTimes=true',
    getExclusionReason('14:30', 1, { excludeTimes: true }), 'times');
})();

(function exclusionPercent() {
  eq('exclude: percent off by default',
    getExclusionReason('45%', 1, {}), null);
  eq('exclude: percent on',
    getExclusionReason('45%', 1, { excludePercent: true }), 'percent');
})();

(function exclusionCurrency() {
  eq('exclude: currency off by default',
    getExclusionReason('$1,234', 1, {}), null);
  eq('exclude: currency on',
    getExclusionReason('$1,234', 1, { excludeCurrency: true }), 'currency');
  eq('exclude: euro on',
    getExclusionReason('€1,234', 1, { excludeCurrency: true }), 'currency');
  eq('exclude: rupee on',
    getExclusionReason('₹615', 1, { excludeCurrency: true }), 'currency');
})();

// First-match-wins priority: firstColumn beats dates beats times beats percent beats currency
(function exclusionPriority() {
  const opts = {
    excludeFirstColumn: true, excludeDates: true, excludeTimes: true,
    excludePercent: true, excludeCurrency: true
  };
  eq('priority: first column wins even when value is a date',
    getExclusionReason('2018', 0, opts), 'firstColumn');
  eq('priority: dates beats percent for a year value',
    getExclusionReason('2018', 1, opts), 'dates');
})();

// --- Sprint B: per-type granularity ---

// Date granularity
eq('roundDateText: year granularity is a no-op (returns null)',
  roundDateText('2018', 'year'), null);
eq('roundDateText: decade rounds bare year',
  roundDateText('2018', 'decade'), '2010');
eq('roundDateText: century rounds bare year',
  roundDateText('2018', 'century'), '2000');
eq('roundDateText: decade in "March 14, 2024"',
  roundDateText('March 14, 2024', 'decade'), 'March 14, 2020');
eq('roundDateText: century in "March 14, 2024"',
  roundDateText('March 14, 2024', 'century'), 'March 14, 2000');
eq('roundDateText: decade in ISO date',
  roundDateText('2024-03-14', 'decade'), '2020-03-14');
eq('roundDateText: no year present -> null',
  roundDateText('hello world', 'decade'), null);
eq('roundDateText: 2020 at decade granularity unchanged',
  roundDateText('2020', 'decade'), null);

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
