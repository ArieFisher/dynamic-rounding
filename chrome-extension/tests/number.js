// Number reading, rounding, dates and times, and identifier shapes (lib/dr-number).

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

// --- Boundary guard: digits welded to letters are identifiers, not quantities ---
// Rounding them yields a value that still looks like a valid identifier, so the
// corruption cannot be spotted by eye. The whole run must be skipped.

const numStrs = text => extractNumbersInText(text).map(m => m.numStr);

eq('guard: application number is not mined for digits',
  numStrs('XR47182913MKB07'),
  []);

eq('guard: trailing zero-padded segment is not mined',
  numStrs('MKB07'),
  []);

eq('guard: short label+digit is not mined',
  numStrs('Q3'),
  []);

eq('guard: refusal does not let the scan re-enter mid-number',
  numStrs('abc1,200'),
  []);

// --- Boundary guard: a hyphen after a digit is a separator, not a minus sign ---

eq('guard: phone number yields two positive numbers',
  numStrs('555-1234'),
  ['555', '1234']);

eq('guard: ZIP+4 yields two positive numbers',
  numStrs('12345-6789'),
  ['12345', '6789']);

eq('guard: hyphen range yields two positive numbers',
  numStrs('10-20'),
  ['10', '20']);

eq('guard: hyphen-typed range now matches en-dash behaviour',
  numStrs('₹1,968-2,054 crore'),
  ['1,968', '2,054']);

eq('guard: en-dash range is unchanged',
  numStrs('₹1,968–2,054 crore'),
  ['1,968', '2,054']);

eq('guard: year-month is no longer read as a negative month',
  numStrs('2022-04'),
  ['2022', '04']);

// --- Boundary guard: genuine negatives and ordinary quantities still match ---

eq('guard: negative after whitespace still signed',
  numStrs('down -1,200 units'),
  ['-1,200']);

eq('guard: leading negative still signed',
  numStrs('-5.2% change'),
  ['-5.2']);

eq('guard: currency-prefixed amount unaffected',
  numStrs('$48,090.00'),
  ['48,090.00']);

eq('guard: numbers after a letter-word boundary unaffected',
  numStrs('between 1,200 and 3,400 units'),
  ['1,200', '3,400']);

eq('guard: caret exponent notation unaffected',
  numStrs('10^12'),
  ['10', '12']);

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

// --- A comma that ends a number is punctuation, not a separator ---
// The match string must end in a digit. A trailing comma in numStr breaks
// every step that searches the live text for that string: the link filter
// cannot find "12," inside the <a> whose text node ends at "12", so the
// linked number is kept; the patch step then finds "12" where it expects
// "12," and skips, and the cell logs a patch that did not land.
eq('extractAll: comma after a number is left out of the match',
  extractNumbersInText('See ref 12, total 9,850'),
  [
    { numStr: '12', num: 12, index: 8 },
    { numStr: '9,850', num: 9850, index: 18 }
  ]);

eq('extractAll: a list of grouped numbers keeps each number\'s own separators',
  extractNumbersInText('1,200, 3,400, and 5,600').map(m => m.numStr),
  ['1,200', '3,400', '5,600']);

eq('extract: comma after the first number is left out of the match',
  extractNumberInText('12, then 5'),
  { numStr: '12', num: 12, index: 0 });

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

eq('toNumber: dollar sign only returns null', toNumber('$'), null);

eq('toNumber: euro sign only returns null', toNumber('€'), null);

eq('toNumber: currency symbol with spaces returns null', toNumber(' $ '), null);

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
// CONTRACT: roundDateText replaces only the date portion of the cell text with the
// rounded year. For pure date cells the result is a 4-digit year string. For mixed
// cells (label + date) the surrounding text is preserved and only the date is replaced.
// The caller (roundTable) compares formattedValue === originalValue to detect no-ops.
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

eq('roundDateText: mixed cell preserves label, replaces date (ISO dash, decade)',
  roundDateText('Payment Disbursed on: 2025-04-02', 'decade'), 'Payment Disbursed on: 2030');

eq('roundDateText: mixed cell preserves label, replaces date (ISO dash, year)',
  roundDateText('Due date: 2024-11-15', 'year'), 'Due date: 2025');

eq('roundDateText: mixed cell preserves label, replaces date (named month, decade)',
  roundDateText('Filed: March 14, 2024', 'decade'), 'Filed: 2020');

eq('roundDateText: mixed cell preserves trailing text after date',
  roundDateText('2024-03-14 (estimated)', 'decade'), '2020 (estimated)');

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

// --- ISO 8601 date-time: follows the time instruction, date preserved ---
eq('parseISODateTime: full offset timestamp',
  parseISODateTime('2025-11-26T16:16:00.000-05:00'),
  { year: 2025, month: 11, day: 26, hour: 16, minute: 16 });

eq('parseISODateTime: Z suffix', parseISODateTime('2025-11-26T16:16:00Z'),
  { year: 2025, month: 11, day: 26, hour: 16, minute: 16 });

eq('parseISODateTime: space separator', parseISODateTime('2025-11-26 16:16'),
  { year: 2025, month: 11, day: 26, hour: 16, minute: 16 });

eq('parseISODateTime: not a datetime -> null',
  parseISODateTime('2025-11-26'), null);

eq('parseISODateTime: out-of-range hour -> null',
  parseISODateTime('2025-11-26T25:16'), null);

eq('isDateTimeLike: ISO timestamp -> true',
  isDateTimeLike('2025-11-26T16:16:00.000-05:00'), true);

eq('isDateTimeLike: bare date -> false', isDateTimeLike('2025-11-26'), false);

eq('isDateTimeLike: bare time -> false', isDateTimeLike('16:16'), false);

eq('roundTimeText: ISO datetime minute -> drops seconds/ms/offset, T->space',
  roundTimeText('2025-11-26T16:16:00.000-05:00', 'minute'), '2025-11-26 16:16');

eq('roundTimeText: ISO datetime hour rounds 16:16 down',
  roundTimeText('2025-11-26T16:16:00.000-05:00', 'hour'), '2025-11-26 16:00');

eq('roundTimeText: ISO datetime hour rounds 16:30 up (half-up)',
  roundTimeText('2025-11-26T16:30:00Z', 'hour'), '2025-11-26 17:00');

eq('roundTimeText: ISO datetime hour-up at end of day clamps to 23:59 same day',
  roundTimeText('2025-11-26T23:45:00Z', 'hour'), '2025-11-26 23:59');

eq('roundTimeText: ISO datetime 23:15 hour rounds down to 23:00 (same day)',
  roundTimeText('2025-11-26T23:15:00Z', 'hour'), '2025-11-26 23:00');

eq('roundTimeText: ISO datetime minute is idempotent on space form',
  roundTimeText('2025-11-26 16:16', 'minute'), '2025-11-26 16:16');

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
  // Lives in the NativeTableAdapter (lib/dr-table/detect.js) after the Phase 2 split.
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
// AC4: roundDateText returns a 4-digit year string for pure date cells and
// prefilled date objects. Test via prefilled date objects (bypassing text parsing).
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
  eq('static: roundDateText uses String() conversion for year (no null return for parsed dates)',
    // The function must use String() to convert the rounded year.
    // Uses "return text" as fallback for unparseable input.
    /function roundDateText[\s\S]{0,900}String\(new Date\(/.test(src), true);
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
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const contentSrc = sourceByName('content.js');
  if (roundingSrc === null || contentSrc === null || coreCode === null ||
      parsingCode === null || detectCode === null || messagingCode === null ||
      storeCode === null || uiToggleCode === null) {
    eq('x-floor flip: source files present in manifest', false, true);
    return;
  }
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
  // extracted layers (core/parsing/detect/ui-toggle), so eval them in the
  // same order the manifest loads them before content.js.
  vm.runInContext(
    constantsCode + '\n' + (sourceByName('lib/dr-log/index.js') || '') + '\n' +
    patchedRounding + '\n' + coreCode + '\n' + parsingCode + '\n' +
    detectCode + '\n' + messagingCode + '\n' + storeCode + '\n' +
    uiToggleCode + '\n' + contentSrc +
    '\nthis.__roundWithOffset = roundWithOffset;', ctx);
  const patchedRound = sandbox.__roundWithOffset;

  eq('x-floor flip: rd(17054321, 0.5) === 20000000 with X_FLOOR_THRESHOLD=0',
    patchedRound(17054321, 0.5), 20000000);
  // And confirm the live (X_FLOOR_THRESHOLD=1) implementation does NOT
  // apply the x-floor for the same call.
  eq('x-floor flip: rd(17054321, 0.5) === 10000000 with X_FLOOR_THRESHOLD=1 (default)',
    roundWithOffset(17054321, 0.5), 10000000);
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

// ---------------------------------------------------------------------------
// Sprint refactor/simplify-naming-unification — Adversarial contract lock-in
// ---------------------------------------------------------------------------

(function simplifyNamingUnification() {

  // -------------------------------------------------------------------------
  // AC1: Renames are total — no old key names survive in any source file.
  // Pattern strings are split across concatenation to prevent self-matching.
  // -------------------------------------------------------------------------
  // Content-script entries are manifest-driven (guarded, no crash on a
  // rename); the other files are not content scripts, so they keep direct
  // reads by their own fixed names. The suite's own text is the joined
  // suite, since no file on disk holds it.
  const contentScriptFileNames = ['constants.js', 'content.js'];
  const directReadFileNames = ['sidebar.html', 'sidebar.js', 'tests.js'];
  const oldKeys = [
    'include' + 'Words',
    'include' + 'Currency',
    'include' + 'Percent',
    'exclude' + 'FirstRow',
    'exclude' + 'FirstColumn',
  ];
  for (const file of contentScriptFileNames) {
    const src = sourceByName(file);
    if (src === null) {
      eq(`AC1: source file ${file} present in manifest`, false, true);
      continue;
    }
    for (const key of oldKeys) {
      eq(`AC1: old key "${key}" absent from ${file}`,
        src.includes(key), false);
    }
  }
  for (const file of directReadFileNames) {
    const src = file === 'tests.js'
      ? SUITE_SOURCE
      : fs.readFileSync(path.join(__dirname, file), 'utf8');
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

// ---------------------------------------------------------------------------
// Sprint advanced-preview-redesign
// AC1: formatOomLabel exhaustive suffix-boundary check
// AC2: formatStrategyHeader structure + "(i.e. …)" clause correctness
// AC3: renderBotBand DESCENDING sort (real DOM-stub eval)
// AC4: step-label CSS classes (step top / step bot)
// Adversarial: sort-mutation side-effect check
// ---------------------------------------------------------------------------
(function advancedPreviewRedesignTests() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // -------------------------------------------------------------------------
  // Extract formatOomLabel and formatStrategyHeader from sidebar.js source.
  // They depend on trimNum (from rounding.js), stepForOffset and formatStep
  // (also rounding.js).  We pass them as parameters to new Function.
  // -------------------------------------------------------------------------
  const constBlock = sidebarSrc.match(
    /const OOM_LABEL_CLASS\s*=[\s\S]*?const STRATEGY_CLASS\s*=.*?;/
  );
  const formatOomLabelFn = sidebarSrc.match(
    /function formatOomLabel\([\s\S]*?\n\}/
  );
  const formatStrategyHeaderFn = sidebarSrc.match(
    /function formatStrategyHeader\([\s\S]*?\n\}/
  );

  if (!constBlock || !formatOomLabelFn || !formatStrategyHeaderFn) {
    eq('sidebar-ap-extract: able to extract formatOomLabel + formatStrategyHeader', false, true);
    return;
  }

  // Build a helper bundle: rounding helpers + sidebar functions.
  // stepForOffset, formatStep, trimNum come from rounding.js (already evaled
  // into the test scope's globalThis; we pass them in to avoid scope issues).
  const apHelperSrc = '(function(trimNum, stepForOffset, formatStep) {\n' +
    constBlock[0] + '\n' +
    formatOomLabelFn[0] + '\n' +
    formatStrategyHeaderFn[0] + '\n' +
    'return { formatOomLabel: formatOomLabel, formatStrategyHeader: formatStrategyHeader };\n' +
    '})(trimNum, stepForOffset, formatStep)';

  let apHelpers;
  try {
    apHelpers = (new Function('trimNum', 'stepForOffset', 'formatStep',
      'return ' + apHelperSrc + ';'
    ))(trimNum, stepForOffset, formatStep);
  } catch (e) {
    eq('sidebar-ap-extract: new Function eval succeeded', false, true);
    return;
  }

  const fmtOom = apHelpers.formatOomLabel;
  const fmtHdr = apHelpers.formatStrategyHeader;

  eq('ap-extract: formatOomLabel is a function', typeof fmtOom, 'function');
  eq('ap-extract: formatStrategyHeader is a function', typeof fmtHdr, 'function');

  // -------------------------------------------------------------------------
  // AC1: Exhaustive formatOomLabel mapping for mag = 9,8,7,6,5,4,3,2,1,0,-1,-2
  // Expected values derived from the spec pattern (10^mag with k/M/B suffix),
  // NOT from reading the implementation.
  // -------------------------------------------------------------------------
  // Suffix boundaries: mag 9 → 1B+, mag 6 → 1M+, mag 3 → 1k+
  eq('AC1-oom: mag=9 → "1B+" (1e9 boundary)', fmtOom(9), '1B+');
  eq('AC1-oom: mag=8 → "100M+" (within B range, 1e8=100M)', fmtOom(8), '100M+');
  eq('AC1-oom: mag=7 → "10M+" (within M range, 1e7=10M)', fmtOom(7), '10M+');
  eq('AC1-oom: mag=6 → "1M+" (1e6 boundary)', fmtOom(6), '1M+');
  eq('AC1-oom: mag=5 → "100k+" (within k range, 1e5=100k)', fmtOom(5), '100k+');
  eq('AC1-oom: mag=4 → "10k+" (within k range, 1e4=10k)', fmtOom(4), '10k+');
  eq('AC1-oom: mag=3 → "1k+" (1e3 boundary)', fmtOom(3), '1k+');
  eq('AC1-oom: mag=2 → "100+" (1e2, no suffix)', fmtOom(2), '100+');
  eq('AC1-oom: mag=1 → "10+" (1e1, no suffix)', fmtOom(1), '10+');
  eq('AC1-oom: mag=0 → "1+" (1e0=1, no suffix)', fmtOom(0), '1+');
  eq('AC1-oom: mag=-1 → "0.1+" (sub-unit, 1e-1=0.1)', fmtOom(-1), '0.1+');
  eq('AC1-oom: mag=-2 → "0.01+" (sub-unit, 1e-2=0.01)', fmtOom(-2), '0.01+');

  // -------------------------------------------------------------------------
  // AC2: formatStrategyHeader structure. Per issue #1 the descriptive
  // "(i.e. a half of 1M)" clause was removed — the header is now exactly
  // "<oomLabel> → nearest <stepLabel>" with no clause, for every stop.
  // We derive the expected step independently via stepForOffset/formatStep.
  // -------------------------------------------------------------------------

  // Scenario A: maxMag=5, offset=-0.5 → step=50k.
  (function hdrScenarioA() {
    const maxMag = 5; const offset = -0.5;
    const oomVal = Math.pow(10, maxMag);        // 100000
    const stepLabel = formatStep(stepForOffset(oomVal, offset)); // '50k'
    const header = fmtHdr(maxMag, offset);
    eq('AC2-A: header is exactly "100k+ → nearest 50k"',
      header, '100k+ → nearest ' + stepLabel);
    eq('AC2-A: header has no "(i.e." clause', header.includes('(i.e.'), false);
  })();

  // Scenario B: maxMag=3, offset=-0.5 → step=500.
  (function hdrScenarioB() {
    const maxMag = 3; const offset = -0.5;
    const stepLabel = formatStep(stepForOffset(Math.pow(10, maxMag), offset)); // '500'
    const header = fmtHdr(maxMag, offset);
    eq('AC2-B: header is exactly "1k+ → nearest 500"',
      header, '1k+ → nearest ' + stepLabel);
    eq('AC2-B: header has no clause', header.includes('(i.e.'), false);
  })();

  // -------------------------------------------------------------------------
  // AC2-ALL-STOPS: All 11 slider stops × 2 maxMag values. The header is always
  // exactly "<oomLabel> → nearest <stepLabel>" with the step derived from the
  // real stepForOffset/formatStep, and never contains a "(i.e." clause or a
  // "×" multiplier.
  // -------------------------------------------------------------------------
  (function hdrAllStops() {
    const stops = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
    const testMags = [6, 5]; // 1M and 100k

    for (const mag of testMags) {
      const oomVal = Math.pow(10, mag);
      const oomLabel = fmtOom(mag);
      for (const offset of stops) {
        const tag = 'AC2-ALL mag=' + mag + ' offset=' + offset;
        const stepLabel = formatStep(stepForOffset(oomVal, offset));
        const header = fmtHdr(mag, offset);
        eq(tag + ': header is exactly "' + oomLabel + ' → nearest ' + stepLabel + '"',
          header, oomLabel + ' → nearest ' + stepLabel);
        eq(tag + ': no "(i.e." clause', header.includes('(i.e.'), false);
        eq(tag + ': no "×" multiplier', header.includes('×'), false);
      }
    }
  })();

  // -------------------------------------------------------------------------
  // AC2-STRATEGY-MONOTONIC: the slider stops must be ordered so the resulting
  // rounding STEP changes in a single direction across the track. This is the
  // whole point of the stop ordering: stepForOffset is non-monotonic in the
  // offset value (half-steps interleave with integer steps), so the array order
  // — not numeric sort — is what guarantees a one-directional strategy sweep.
  // Read STOPS straight from sidebar.js and assert step() is strictly
  // increasing across it for several magnitudes.
  // -------------------------------------------------------------------------
  (function strategyMonotonic() {
    const src = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
    const m = src.match(/const STOPS\s*=\s*\[([^\]]*)\]/);
    if (!m) {
      eq('AC2-mono: STOPS array found in sidebar.js', false, true);
      return;
    }
    const STOPS = m[1].split(',').map((s) => parseFloat(s.trim()));
    eq('AC2-mono: STOPS has 9 stops', STOPS.length, 9);

    for (const mag of [6, 5, 3, 9]) {
      const oomVal = Math.pow(10, mag);
      let monotonic = true;
      let firstBreak = null;
      for (let i = 1; i < STOPS.length; i++) {
        const prev = stepForOffset(oomVal, STOPS[i - 1]);
        const cur = stepForOffset(oomVal, STOPS[i]);
        if (!(cur > prev)) {
          monotonic = false;
          firstBreak = STOPS[i - 1] + '→' + STOPS[i] + ' (' + prev + '≮' + cur + ')';
          break;
        }
      }
      eq('AC2-mono mag=' + mag + ': step() strictly increases across STOPS' +
        (firstBreak ? ' [break at ' + firstBreak + ']' : ''), monotonic, true);
    }

    // Spot-check the exact step sweep at mag 6 against the worked example.
    const expectAtMag6 = [10e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6];
    STOPS.forEach((offset, i) => {
      eq('AC2-mono mag=6: offset ' + offset + ' → step ' + expectAtMag6[i],
        stepForOffset(1e6, offset), expectAtMag6[i]);
    });
  })();

  // -------------------------------------------------------------------------
  // AC3: renderBotBand DESCENDING sort by magnitude.
  // Extract renderBotBand from sidebar.js, provide DOM stubs, call with rows
  // in ASCENDING order, assert rendered order is DESCENDING.
  // Also check for sort-mutation side-effect on the caller's array.
  // -------------------------------------------------------------------------
  const renderBotBandFn = sidebarSrc.match(
    /function renderBotBand\([\s\S]*?\n\}/
  );
  const renderTopBandFn = sidebarSrc.match(
    /function renderTopBand\([\s\S]*?\n\}/
  );

  if (!renderBotBandFn || !renderTopBandFn) {
    eq('sidebar-ap-extract: able to extract renderBotBand + renderTopBand', false, true);
    return;
  }

  // Build a minimal DOM stub sufficient for renderBotBand.
  // We collect appended children in order so we can inspect the render sequence.
  function makeEl(tag) {
    const children = [];
    const el = {
      _tag: tag,
      _children: children,
      _classNames: [],
      className: '',
      textContent: '',
      innerHTML: '',
      appendChild(child) { children.push(child); return child; },
      set className(v) { this._classNames.push(v); },
      get className() { return this._classNames[this._classNames.length - 1] || ''; },
    };
    return el;
  }

  // Collect elements appended to the band container in order.
  function makeBandEl() {
    const appended = [];
    return {
      _appended: appended,
      innerHTML: '',
      appendChild(child) { appended.push(child); return child; },
    };
  }

  // Stub document.createElement for the eval scope.
  const stubDocument = {
    createElement(tag) { return makeEl(tag); }
  };

  // Extract the sidebar consts and render functions + their helpers.
  // We need: STEP_CLASS_TOP/BOT, OOM_LABEL_CLASS, STRATEGY_CLASS,
  //          formatOomLabel, formatStrategyHeader, renderTopBand, renderBotBand.
  // External deps we pass in: formatOriginal, roundWithOffset, stepForOffset,
  //                            formatStep, cachedMaxMag (null = no strategy header).
  const renderSrc = '(function(document, formatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, cachedMaxMag) {\n' +
    constBlock[0] + '\n' +
    formatOomLabelFn[0] + '\n' +
    formatStrategyHeaderFn[0] + '\n' +
    renderTopBandFn[0] + '\n' +
    renderBotBandFn[0] + '\n' +
    'return { renderBotBand: renderBotBand, renderTopBand: renderTopBand };\n' +
    '})';

  let renderHelpers;
  let realFormatOriginal;
  try {
    // We need formatOriginal from the already-evaled sidebar helpers.
    // However, formatOriginal in sidebar.js depends on toNumber (from content.js,
    // already on globalThis). Extract it from sidebar.js source.
    const sidebarConstBlock2 = sidebarSrc.match(
      /const PREVIEW_DECIMAL_THRESHOLD\s*=.*?;\s*const PREVIEW_MAX_DECIMALS\s*=.*?;/
    );
    const fmtCommasFn2 = sidebarSrc.match(/function formatNumberWithCommas\([\s\S]*?\n\}/);
    const formatOriginalFn2 = sidebarSrc.match(/function formatOriginal\([\s\S]*?\n\}/);

    const fmtOrigSrc = '(function(toNumber) {\n' +
      sidebarConstBlock2[0] + '\n' +
      fmtCommasFn2[0] + '\n' +
      formatOriginalFn2[0] + '\n' +
      'return formatOriginal;\n' +
      '})(toNumber)';
    realFormatOriginal = (new Function('toNumber', 'return ' + fmtOrigSrc + ';'))(toNumber);

    renderHelpers = (new Function(
      'document', 'formatOriginal', 'roundWithOffset', 'stepForOffset',
      'formatStep', 'trimNum', 'cachedMaxMag',
      'return ' + renderSrc + '(document, formatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, cachedMaxMag);'
    ))(stubDocument, realFormatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, null);
  } catch (e) {
    eq('sidebar-ap-extract: renderBotBand eval succeeded', String(e), '');
    return;
  }

  const realRenderBotBand = renderHelpers.renderBotBand;
  const realRenderTopBand = renderHelpers.renderTopBand;

  eq('ap-extract: renderBotBand is a function', typeof realRenderBotBand, 'function');
  eq('ap-extract: renderTopBand is a function', typeof realRenderTopBand, 'function');

  // Rows fed in ASCENDING magnitude order: 50 (mag=1), 500 (mag=2), 5000 (mag=3), 50000 (mag=4)
  const rowsAscending = [
    { num: 50,    original: '50' },
    { num: 500,   original: '500' },
    { num: 5000,  original: '5,000' },
    { num: 50000, original: '50,000' },
  ];
  // Deep-copy original array reference so we can check mutation.
  const originalArray = rowsAscending.slice();

  const bandEl = makeBandEl();
  realRenderBotBand(bandEl, rowsAscending, -0.5, 4);

  // The band container should have 4 "pair" div children.
  eq('AC3-sort: renderBotBand appended 4 pair elements', bandEl._appended.length, 4);

  // Each pair div contains children: from-span, arrow-span, num-span, step-span.
  // The from-span's textContent reflects the original number.
  // We can extract the rendered order by reading from-span textContent on each pair.
  function getFromText(pairEl) {
    // first child is the "from" span
    return pairEl._children[0] ? pairEl._children[0].textContent : '';
  }

  const renderedFromTexts = bandEl._appended.map(getFromText);
  // Expected descending order: 50,000 first, then 5,000, 500, 50
  eq('AC3-sort: first rendered row is highest magnitude (50,000)',
    renderedFromTexts[0], '50,000');
  eq('AC3-sort: second rendered row is next (5,000)',
    renderedFromTexts[1], '5,000');
  eq('AC3-sort: third rendered row (500)',
    renderedFromTexts[2], '500');
  eq('AC3-sort: fourth rendered row is lowest magnitude (50)',
    renderedFromTexts[3], '50');

  // -------------------------------------------------------------------------
  // Adversarial: sort-mutation check.
  // renderBotBand uses rows.slice().sort(...) which must NOT mutate the caller's
  // array. If it sorts in place, cachedSamples would be corrupted across renders.
  // -------------------------------------------------------------------------
  eq('AC3-mutation: renderBotBand does NOT mutate caller rows[0] (still 50 after render)',
    rowsAscending[0].num, 50);
  eq('AC3-mutation: renderBotBand does NOT mutate caller rows[3] (still 50000 after render)',
    rowsAscending[3].num, 50000);
  // Belt-and-suspenders: the entire original order is preserved.
  const originalNums = originalArray.map(r => r.num);
  const afterNums = rowsAscending.map(r => r.num);
  eq('AC3-mutation: full array order unchanged after renderBotBand',
    afterNums, originalNums);

  // -------------------------------------------------------------------------
  // AC3-edge: zero rows and null el guard
  // -------------------------------------------------------------------------
  const emptyEl = makeBandEl();
  realRenderBotBand(emptyEl, [], -0.5, 0);
  eq('AC3-edge: empty rows renders nothing', emptyEl._appended.length, 0);

  realRenderBotBand(null, rowsAscending, -0.5, 4); // should not throw
  eq('AC3-edge: null el is a no-op (no throw)', true, true);

  // -------------------------------------------------------------------------
  // AC4: bottom-band examples carry a brown trailing step label "(5k)" after
  // the rounded number, showing what the example rounds to the nearest of. The
  // pair still has three cells (from, arrow, num); the step span lives INSIDE
  // the num span (a 4th grid child would wrap to the next row). The top example
  // keeps its three cells and is prefixed "e.g.".
  // -------------------------------------------------------------------------

  // AC4a: bottom band pair has 3 cells (from/arrow/num); the brown step label
  // is nested in the num span, not a 4th grid child.
  const botBandEl2 = makeBandEl();
  realRenderBotBand(botBandEl2, [{ num: 1000, original: '1,000' }], -0.5, 3);
  eq('AC4-bot: bottom example pair has exactly 3 cells (from/arrow/num)',
    botBandEl2._appended[0]._children.length, 3);
  const botNumSpan = botBandEl2._appended[0]._children[2];
  eq('AC4-bot: num span has a nested step-label child',
    botNumSpan._children.length, 1);
  eq('AC4-bot: step-label child has class "step-label"',
    botNumSpan._children[0] ? botNumSpan._children[0].className : '', 'step-label');
  // 1,000 at offset -0.5 rounds to the nearest 500 → label "(500)".
  eq('AC4-bot: step-label text is " (500)"',
    botNumSpan._children[0] ? botNumSpan._children[0].textContent : '', ' (500)');

  // AC4a-zero: a zero row gets no step label (avoids "(0)").
  const botZeroEl = makeBandEl();
  realRenderBotBand(botZeroEl, [{ num: 0, original: '0' }], -0.5, 3);
  const zeroNumSpan = botZeroEl._appended[0]._children[2];
  eq('AC4-bot-zero: zero row num span has no step-label child',
    zeroNumSpan._children.length, 0);

  // AC4b: top band example pair is prefixed "e.g." and has no step label.
  // renderTopBand with cachedMaxMag=null skips the strategy header, so the only
  // appended element is the example.
  const topBandEl2 = makeBandEl();
  realRenderTopBand(topBandEl2, [{ num: 100000, original: '100,000' }], -0.5);
  eq('AC4-top: top band appended exactly one element (no header)',
    topBandEl2._appended.length, 1);
  const topExamplePair = topBandEl2._appended[0];
  eq('AC4-top: top example has exactly 3 cells (from/arrow/num, no step)',
    topExamplePair._children.length, 3);
  eq('AC4-top: top example "from" is prefixed "e.g."',
    topExamplePair._children[0].textContent, 'e.g. 100,000');
  // Top-band num cell carries no nested step label.
  eq('AC4-top: top example num cell has no nested step label',
    topExamplePair._children[2]._children.length, 0);

  // AC4-strip (issue #3): the "from" shows the bare number, not the original
  // surrounding text. renderTopBand keys off row.num, so a row whose original
  // was "₹2,000 crore" still renders just "e.g. 2,000".
  const stripBandEl = makeBandEl();
  realRenderTopBand(stripBandEl, [{ num: 2000, original: '₹2,000 crore' }], -0.5);
  eq('AC4-strip: top "from" strips surrounding text to bare "e.g. 2,000"',
    stripBandEl._appended[0]._children[0].textContent, 'e.g. 2,000');

  // AC4c: source-level constant values are correct (structural). The step-class
  // constants were removed; the OoM-label and strategy classes remain.
  eq('AC4-src: STEP_CLASS_TOP constant removed from source',
    /const STEP_CLASS_TOP\b/.test(sidebarSrc), false);
  eq('AC4-src: STEP_CLASS_BOT constant removed from source',
    /const STEP_CLASS_BOT\b/.test(sidebarSrc), false);
  eq('AC4-src: OOM_LABEL_CLASS constant is "oom-label" in source',
    /const OOM_LABEL_CLASS\s*=\s*['"]oom-label['"]/.test(sidebarSrc), true);
  eq('AC4-src: STRATEGY_CLASS constant is "strategy" in source',
    /const STRATEGY_CLASS\s*=\s*['"]strategy['"]/.test(sidebarSrc), true);
  eq('AC4-src: STEP_LABEL_CLASS constant is "step-label" in source',
    /const STEP_LABEL_CLASS\s*=\s*['"]step-label['"]/.test(sidebarSrc), true);

  // AC4e: when cachedMaxMag is set, the top band renders the strategy line AND
  // the example as two from|arrow|num pairs in the same band container (the
  // #topBand grid lays them on two lines with their "→" arrows aligned in the
  // middle column). Rebuild the render helpers with a non-null cachedMaxMag to
  // exercise the header path.
  let renderHelpersWithMag;
  try {
    renderHelpersWithMag = (new Function(
      'document', 'formatOriginal', 'roundWithOffset', 'stepForOffset',
      'formatStep', 'trimNum', 'cachedMaxMag',
      'return ' + renderSrc + '(document, formatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, cachedMaxMag);'
    ))(stubDocument, realFormatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, 6);
  } catch (e) {
    eq('AC4e: renderTopBand (cachedMaxMag=6) eval succeeded', String(e), '');
  }
  if (renderHelpersWithMag) {
    const topWithHdr = makeBandEl();
    renderHelpersWithMag.renderTopBand(topWithHdr, [{ num: 8584629, original: '8,584,629' }], -0.5);
    eq('AC4e: top band appends 2 elements (strategy line + example)',
      topWithHdr._appended.length, 2);
    const stratPair = topWithHdr._appended[0];
    const examplePair = topWithHdr._appended[1];
    eq('AC4e: first appended element is the strategy pair (class "pair strategy")',
      stratPair.className, 'pair strategy');
    eq('AC4e: strategy pair has 3 cells (from/arrow/num)',
      stratPair._children.length, 3);
    eq('AC4e: strategy "from" is the OoM label "1M+" (maxMag=6)',
      stratPair._children[0].textContent, '1M+');
    eq('AC4e: strategy "num" starts "nearest "',
      stratPair._children[2].textContent.indexOf('nearest ') === 0, true);
    eq('AC4e: second appended element is the example pair (class "pair example")',
      examplePair.className, 'pair example');
    eq('AC4e: example pair has 3 cells (from/arrow/num)',
      examplePair._children.length, 3);
    // The two "→" arrows sit in the same (middle) grid column so they align.
    eq('AC4e: strategy arrow is in the middle cell ("→")',
      stratPair._children[1].textContent, '→');
    eq('AC4e: example arrow is in the middle cell ("→")',
      examplePair._children[1].textContent, '→');
  }

  // AC4f: sidebar.html lays the top band out on the shared results-band grid
  // (no flex override), so the strategy line and the example line stack and
  // their "→" arrows align in the middle column. The strategy cells are blue.
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('AC4f: #topBand element carries the results-band grid class',
    /<div[^>]*id="topBand"[^>]*class="results-band"|<div[^>]*class="results-band"[^>]*id="topBand"/.test(sidebarHtmlSrc), true);
  eq('AC4f: #topBand is NOT overridden to display:flex',
    /#topBand\s*\{[^}]*display:\s*flex/.test(sidebarHtmlSrc), false);
  eq('AC4f: #topBand strategy cells are blue (#1a73e8)',
    /#topBand \.strategy \.num\s*\{\s*color:\s*#1a73e8/.test(sidebarHtmlSrc), true);
  eq('AC4f: .step-label colour rule present in sidebar.html',
    /\.step-label\s*\{\s*color:\s*#b3623d/.test(sidebarHtmlSrc), true);

  // AC4d: oom-label span is still appended inside the from-span for non-zero
  // rows of the bottom band (kept per the issue #3 decision).
  const oomLabelBandEl = makeBandEl();
  realRenderBotBand(oomLabelBandEl, [{ num: 5000, original: '5,000' }], -0.5, 3);
  const fromSpan = oomLabelBandEl._appended[0]._children[0];
  eq('AC4-oom-label: from-span has oom-label child appended',
    fromSpan._children.length >= 1, true);
  eq('AC4-oom-label: oom-label child has class "oom-label"',
    fromSpan._children[0] ? fromSpan._children[0].className : '', 'oom-label');
  eq('AC4-oom-label: oom-label text contains "(1k+)"',
    fromSpan._children[0] ? fromSpan._children[0].textContent.includes('1k+') : false, true);

  // -------------------------------------------------------------------------
  // AC5: renderBand removed, renderTopBand + renderBotBand present in source
  // -------------------------------------------------------------------------
  eq('AC5-structure: renderBand is removed from sidebar.js source',
    /function renderBand\b/.test(sidebarSrc), false);
  eq('AC5-structure: renderTopBand is defined in sidebar.js source',
    /function renderTopBand\b/.test(sidebarSrc), true);
  eq('AC5-structure: renderBotBand is defined in sidebar.js source',
    /function renderBotBand\b/.test(sidebarSrc), true);
  eq('AC5-structure: renderPreviewBands calls renderTopBand',
    /renderTopBand\(/.test(sidebarSrc), true);
  eq('AC5-structure: renderPreviewBands calls renderBotBand',
    /renderBotBand\(/.test(sidebarSrc), true);
})();

// -------------------------------------------------------------------------
// AC2: formatStrategyHeader — exhaustive mag=3 (1k+) table. Per issue #1 the
// header is exactly "<oomLabel> → nearest <stepLabel>" for every offset stop,
// with no "(i.e. …)" clause and no "×" multiplier.
// -------------------------------------------------------------------------
(function ac2_mag3_exhaustiveTable() {
  const sidebarSrc  = fs.readFileSync(path.join(__dirname, 'sidebar.js'),  'utf8');
  const constBlock  = sidebarSrc.match(/const OOM_LABEL_CLASS\s*=[\s\S]*?const STRATEGY_CLASS\s*=.*?;/);
  const fmtOomFn    = sidebarSrc.match(/function formatOomLabel\([\s\S]*?\n\}/);
  const fmtHdrFn    = sidebarSrc.match(/function formatStrategyHeader\([\s\S]*?\n\}/);

  if (!constBlock || !fmtOomFn || !fmtHdrFn) {
    eq('AC2-mag3-extract: able to extract formatOomLabel + formatStrategyHeader', false, true);
    return;
  }

  const helperSrc = '(function(trimNum, stepForOffset, formatStep) {\n' +
    constBlock[0] + '\n' + fmtOomFn[0] + '\n' + fmtHdrFn[0] + '\n' +
    'return { formatOomLabel: formatOomLabel, formatStrategyHeader: formatStrategyHeader };\n' +
    '})(trimNum, stepForOffset, formatStep)';

  let helpers;
  try {
    helpers = (new Function('trimNum', 'stepForOffset', 'formatStep',
      'return ' + helperSrc + ';'
    ))(trimNum, stepForOffset, formatStep);
  } catch (e) {
    eq('AC2-mag3-eval: new Function eval succeeded', String(e), '');
    return;
  }

  const fmtOom = helpers.formatOomLabel;
  const fmtHdr = helpers.formatStrategyHeader;

  const mag = 3;
  const oomVal   = Math.pow(10, mag);  // 1000
  const oomLabel = fmtOom(mag);        // "1k+"

  eq('AC2-mag3: oomLabel is "1k+"', oomLabel, '1k+');

  const offsets = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
  for (const offset of offsets) {
    const tag     = 'AC2-mag3 offset=' + offset;
    const stepLbl = formatStep(stepForOffset(oomVal, offset));
    const header  = fmtHdr(mag, offset);

    eq(tag + ': header is exactly "' + oomLabel + ' → nearest ' + stepLbl + '"',
      header, oomLabel + ' → nearest ' + stepLbl);
    eq(tag + ': no "(i.e." clause', header.includes('(i.e.'), false);
    eq(tag + ': no "×" multiplier', header.includes('×'), false);
  }

  // Spot-check the exact step labels for two representative stops (regression guard).
  eq('AC2-mag3 offset=0.5: header is exactly "1k+ → nearest 5k"',
    fmtHdr(mag, 0.5), '1k+ → nearest 5k');
  eq('AC2-mag3 offset=-1: header is exactly "1k+ → nearest 100"',
    fmtHdr(mag, -1), '1k+ → nearest 100');
  // New extended stops: -1.5 → 0.5·10^(mag-1)=50, -2 → 10^(mag-2)=10.
  eq('AC2-mag3 offset=-1.5: header is exactly "1k+ → nearest 50"',
    fmtHdr(mag, -1.5), '1k+ → nearest 50');
  eq('AC2-mag3 offset=-2: header is exactly "1k+ → nearest 10"',
    fmtHdr(mag, -2), '1k+ → nearest 10');
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

(function getExclusionReason_currencyCodes() {
  const currencyOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false });
  eq('getExclusionReason: a listed code counts as a currency sign',
    getExclusionReason('CAD45.67m', 1, currencyOff, 1), 'currency');
  eq('getExclusionReason: a code inside a longer word does not count',
    getExclusionReason('CADENCE 12', 1, currencyOff, 1), null);
  eq('getExclusionReason: a code in lower case does not count',
    getExclusionReason('usd 12', 1, currencyOff, 1), null);
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

// =============================================================================
// One currency list
// =============================================================================
// Every currency rule reads CURRENCIES in lib/dr-number/core.js. These
// assertions drive themselves from that list, so a currency added there is
// covered here without a second list to keep in step.

(function currencies_oneListDrivesEveryRule() {
  if (!Array.isArray(CURRENCIES) || CURRENCIES.length === 0) {
    eq('currencies: the one currency list is present and not empty', false, true);
    return;
  }

  // Every sign the list names reads as a sign: the digits beside it parse.
  for (const { name, signs } of CURRENCIES) {
    for (const sign of signs) {
      eq('currencies: "' + sign + '" (' + name + ') before the digits reads as a number',
        toNumber(sign + '450'), 450);
    }
  }

  // Every code the list names is a currency code, so the currency exclusion
  // and the unit-number reader both admit it.
  const currencyOff = { simplifyFirstRow: true, simplifyFirstColumn: true,
    simplifyMixedPercent: true, simplifyMixedCurrency: false };
  for (const { name, code } of CURRENCIES) {
    eq('currencies: the code ' + code + ' (' + name + ') excludes a cell with the currency setting off',
      getExclusionReason('450 ' + code, 1, currencyOff, 1), 'currency');
  }

  // The data test's numeric probe strips exactly the signs the reader strips.
  // Before the collapse it carried its own shorter list, so a rupee cell read
  // as a number for the reader and as text for the probe.
  for (const sign of CURRENCY_SIGNS) {
    eq('currencies: the numeric probe reads "' + sign + '450" like the number reader does',
      DEFAULT_NUMERIC_PROBE.parse(sign + '450'), 450);
  }

  // The sign-only piece test admits every sign, so a cell that draws its sign
  // in one piece and its digits in another still simplifies.
  for (const sign of CURRENCY_SIGNS) {
    const spans = [{ i: 0, start: 0, text: sign }, { i: 1, start: sign.length, text: '450' }];
    eq('currencies: a cell drawn as "' + sign + '" beside "450" is a stacked cell',
      stackedMatches(spans, () => false), [{ numStr: '450', num: 450, index: sign.length }]);
  }
})();

(function currencies_roundingKeepsTheSign() {
  // Before the collapse, restore carried its own four-symbol chain, so a cell
  // marked with any other currency rounded and lost its sign outright.
  for (const { name, signs } of CURRENCIES) {
    for (const sign of signs) {
      eq('currencies: rounding keeps "' + sign + '" (' + name + ')',
        restoreFormatting(500, sign + '450'), sign + '500');
    }
  }
  eq('currencies: a sign after the digits goes back after them',
    restoreFormatting(500, '450 kr'), '500 kr');
  eq('currencies: a sign before the digits keeps its space',
    restoreFormatting(500, '\u20b9 450'), '\u20b9 500');
  eq('currencies: a letter that only looks like a sign gains none',
    restoreFormatting(500, 'Revenue 450'), '500');
  eq('currencies: an accounting negative keeps its brackets and its sign',
    restoreFormatting(-500, '($450)'), '($500)');
})();

(function currencies_letterSignsTakeTheTokenRule() {
  // A sign written in letters counts on the end that carries the letter only
  // when no letter sits against it, the same rule a currency code takes. A
  // sign written as a picture counts anywhere.
  for (const text of ['Revenue', 'Rate', 'Region', 'Fresh', 'Free', 'From', 'krona', 'Crop',
    'R2D2', 'Form 10-K', 'Q4 2024', 'DT1234']) {
    eq('currencies: "' + text + '" does not read as a number',
      toNumber(text), null);
  }
  eq('currencies: a letter sign against the digits still reads ("R45")', toNumber('R45'), 45);
  eq('currencies: a letter sign and a space still read ("kr 45")', toNumber('kr 45'), 45);
  eq('currencies: a two-letter sign against the digits still reads ("Fr45")', toNumber('Fr45'), 45);
  eq('currencies: the longest sign wins ("EC$45")', toNumber('EC$45'), 45);
  eq('currencies: a picture sign after the digits reads ("45€")', toNumber('45€'), 45);
  eq('currencies: a picture sign with a letter left beside it does not read ("a€45")',
    toNumber('a€45'), null);

  // Regression: the currency exclusion once fired on any capital R, so a
  // plain text cell was skipped as currency with the setting off.
  const currencyOff = { simplifyFirstRow: true, simplifyFirstColumn: true,
    simplifyMixedPercent: true, simplifyMixedCurrency: false };
  eq('currencies: "Revenue 45" is not a currency cell',
    getExclusionReason('Revenue 45', 1, currencyOff, 1), null);
  eq('currencies: "Fresh 45" is not a currency cell',
    getExclusionReason('Fresh 45', 1, currencyOff, 1), null);
  eq('currencies: "R 45" is a currency cell',
    getExclusionReason('R 45', 1, currencyOff, 1), 'currency');
})();

// --- Reading the sign ---

eq('bracketed: a bracket pair reads as a minus sign',
  extractNumbersInText('(1,234)'),
  [{ numStr: '1,234', num: -1234, index: 1 }]);

eq('bracketed: a currency sign inside the brackets keeps the minus sign',
  extractNumbersInText('($1,234)'),
  [{ numStr: '1,234', num: -1234, index: 2 }]);

eq('bracketed: a currency sign outside the brackets keeps the minus sign',
  extractNumbersInText('$(1,234)'),
  [{ numStr: '1,234', num: -1234, index: 2 }]);

eq('bracketed: a percent sign inside the brackets keeps the minus sign',
  extractNumbersInText('(12.3%)'),
  [{ numStr: '12.3', num: -12.3, index: 1 }]);

eq('bracketed: a space between the bracket and the number keeps the minus sign',
  extractNumbersInText('( 1,234 )'),
  [{ numStr: '1,234', num: -1234, index: 2 }]);

eq('bracketed: brackets around a number among words read as a minus sign',
  extractNumbersInText('Net loss (1,234) for the year'),
  [{ numStr: '1,234', num: -1234, index: 10 }]);

eq('bracketed: a written minus sign inside brackets is not doubled',
  extractNumbersInText('(-1,234)'),
  [{ numStr: '-1,234', num: -1234, index: 1 }]);

eq('bracketed: brackets holding words leave the number positive',
  extractNumbersInText('(see note 4)'),
  [{ numStr: '4', num: 4, index: 10 }]);

eq('bracketed: a bracket pair followed by digits is an area code, not a minus sign',
  extractNumbersInText('(416) 555-1234').map((m) => m.num),
  [416, 555, 1234]);

eq('bracketed: an unclosed bracket leaves the number positive',
  extractNumbersInText('(1,234').map((m) => m.num), [1234]);

eq('bracketed: an unopened bracket leaves the number positive',
  extractNumbersInText('1,234)').map((m) => m.num), [1234]);

eq('bracketed: the first-number reader takes the same sign',
  extractNumberInText('(1,234)'),
  { numStr: '1,234', num: -1234, index: 1 });

eq('bracketed: the bracket test answers for the number it is given',
  [isBracketedNegative('(1,234)', 1, '1,234'), isBracketedNegative('(see 4)', 5, '4')],
  [true, false]);

// --- Writing the sign back ---

eq('bracketed: the rounded number carries the sign the original text showed',
  formatExtractedNumber(-1200, '1,234'), '1,200');

eq('bracketed: a written minus sign survives rounding',
  formatExtractedNumber(-1200, '-1,234'), '-1,200');

eq('bracketed: the sign rule leaves a positive number alone',
  formatExtractedNumber(1200, '1,234'), '1,200');

// --- The whole-text match ---

eq('bracketed: a bracket pair holding more than the number is not a whole-text match',
  [
    matchBracketedNumber('(see note 4)'),
    matchBracketedNumber('(1,234) (5,678)'),
    matchBracketedNumber('USD (1,234)'),
  ],
  [null, null, null]);

// The observers the page model reports to. The harness clears the list.
const rwObservers = [];

let rwDeliveringToObserver = false;

class RewriteObserver {
  constructor(callback) { this.callback = callback; this.target = null; this.queue = []; }
  observe(target) {
    this.target = target;
    if (!rwObservers.includes(this)) rwObservers.push(this);
  }
  disconnect() {
    this.target = null;
    this.queue = [];
    const at = rwObservers.indexOf(this);
    if (at >= 0) rwObservers.splice(at, 1);
  }
}
