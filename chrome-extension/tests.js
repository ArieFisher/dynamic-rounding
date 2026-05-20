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
