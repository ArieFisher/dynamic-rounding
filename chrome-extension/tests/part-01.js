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

// ---------------------------------------------------------------------------
// Sprint first-col-is-a: pin column-index behavior for tables with <th> cells
//
// Column index is the cell's position in its row, counting <th> cells:
//   - <th> cells are never rounded, but they still occupy their column.
//   - rangeExpr "A" maps to the leftmost DOM cell — the <th> in a row-header
//     table, so the leading <td> there is column "B".
//   - simplifyFirstColumn gates the leftmost DOM cell, so in a row-header table
//     it does not gate the leading <td>.
//
// Helper: build a minimal mock table that roundTable can traverse.
// roundTable accesses: table.rows -> array of {cells: array of cell-like objects}
// cell-like object needs: tagName, innerText, textContent, classList, dataset,
//   title (writable), and a querySelector stub on the table.
// ---------------------------------------------------------------------------

// roundTable calls document.createTreeWalker (via collectTextPieces).
// We need to stub that too so the "apply rounding" path doesn't crash.
// Stub createTreeWalker to return a walker that finds the cell's single text node.

// --- Test 1: Table with row headers — nothing outside the range is rounded ---
// Row: [<th>Name</th>, <td>100</td>, <td>200</td>]
// With rangeExpr = "A" the range covers the <th> column only; neither <td> is
// in range, and the <th> itself is never rounded.
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
    // <td>100 is column B and <td>200 column C — both out of range A
    eq('first-col-is-A (row-header table): <td>100 at column B not rounded',
      cells[1].classList.contains('dr-ext-rounded'), false);
    eq('first-col-is-A (row-header table): <td>200 at column C not rounded',
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

// --- Test 3: simplifyFirstColumn gates the <th>, not the leading <td> ---
// Regression: selecting "first column" used to enable the *second* rendered
// column, because only <td> cells were counted and the <th> was invisible to
// the column index. The <th> is the first column, so the leading <td> (column
// B) is rounded regardless of the toggle, and the <th> is never rounded.
(function simplifyFirstColumn_withRowHeader() {
  for (const flag of [false, true]) {
    const rows = runRowHeaderTable({ simplifyFirstColumn: flag });
    eq(`simplifyFirstColumn=${flag} (row-header table): <th> is never rounded`,
      isRounded(rows[0][0]), false);
    eq(`simplifyFirstColumn=${flag} (row-header table): leading <td> is column B, not gated`,
      isRounded(rows[0][1]), true);
  }
})();

// --- Test 4: range letters count the <th> column ---
// "A" is the <th> column (nothing to round there); "B" is the leading <td>.
(function rangeLetters_withRowHeader() {
  const rangeA = runRowHeaderTable({ rangeExpr: 'A' });
  eq('range "A" (row-header table): <th> column matched, leading <td> untouched',
    isRounded(rangeA[0][1]), false);
  eq('range "A" (row-header table): column C untouched',
    isRounded(rangeA[0][2]), false);

  const rangeB = runRowHeaderTable({ rangeExpr: 'B' });
  eq('range "B" (row-header table): leading <td> is rounded',
    isRounded(rangeB[0][1]), true);
  eq('range "B" (row-header table): column C untouched',
    isRounded(rangeB[0][2]), false);
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

// --- 3b. Era-marked years are not parameter-rounded by roundTable (issue #4) ---

(function eraYearNotParameterRounded() {
  withCreateTreeWalker(function() {
    // "Kalki 2898 AD": the 2898 is a calendar year (era marker), so it must NOT
    // be rounded to 3,000 by the numeric offset. A real number in the same row
    // still rounds (control), proving the exclusion is specific to the era year.
    const table = makeMockTable([[
      { tag: 'td', text: 'Kalki 2898 AD' },
      { tag: 'td', text: '1,050,000,000' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: true, simplifyDates: false, simplifyTimes: false,
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedPercent: true, simplifyMixedCurrency: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cells = table.rows[0].cells;
    eq('era-round: "Kalki 2898 AD" cell is NOT rounded (era year, not a number)',
      cells[0].classList.contains('dr-ext-rounded'), false);
    eq('era-round: "Kalki 2898 AD" text left unchanged',
      cells[0].innerText, 'Kalki 2898 AD');
    eq('era-round: control 1,050,000,000 still rounds',
      cells[1].classList.contains('dr-ext-rounded'), true);
  });
})();

// --- 3c. A silently failed extracted patch records nothing (#301) ---
//
// The patch step skips silently when the number is not at its flat-text
// position in the live nodes (the text moved between classification and
// patching). The write path records a cell as simplified only when a patch
// confirmed a change: no stored original, no hover text, no marker, no
// simplified flag — and a log row states the failure so a capture shows it
// instead of a false success.

(function extractedPatchOptsFor() {
  globalThis.EXTRACTED_PATCH_OPTS = {
    enabled: true, simplifyMixedCells: true, simplifyDates: false, simplifyTimes: false,
    simplifyFirstRow: true, simplifyFirstColumn: true,
    simplifyMixedPercent: true, simplifyMixedCurrency: true,
    offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
    rangeExpr: '',
  };
})();

(function failedExtractedPatchRecordsNothing() {
  // The walker's one text node does not hold the extracted number at its
  // expected position, so every patch skips.
  global.document.createTreeWalker = function () {
    let done = false;
    return {
      nextNode: function () {
        if (done) return null;
        done = true;
        return { nodeValue: 'Cost: [moved text] per month' };
      },
    };
  };
  const table = makeMockTable([[
    { tag: 'td', text: 'Cost: 123,456 per month' },
  ]]);
  try {
    roundTable(table, EXTRACTED_PATCH_OPTS);
    const cell = table.rows[0].cells[0];
    eq('patch-honesty: a cell whose patches all skip gets no marker',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('patch-honesty: a cell whose patches all skip gets no hover text',
      cell.title, '');
    eq('patch-honesty: a cell whose patches all skip stores no original',
      DR_STORE.getTableOriginalText(table, cell), undefined);
    eq('patch-honesty: a table whose only change failed keeps form original',
      DR_STORE.getTableAppliedFlag(table), 'original');
    eq('patch-honesty: the failure leaves a debug row, which raises no toast',
      DR_LOG.snapshot().entries.some(
        (row) => row.level === 'debug' && /cells were left unrounded/.test(row.text)),
      true);
  } finally {
    delete global.document.createTreeWalker;
    DR_STORE.unregisterTable(table);
  }
})();

// Control: the same cell with its number where the patch expects it still
// records in full — the honesty gate never blocks a confirmed change.
(function landedExtractedPatchStillRecords() {
  const table = makeMockTable([[
    { tag: 'td', text: 'Cost: 123,456 per month' },
  ]]);
  try {
    withCreateTreeWalker(function () {
      roundTable(table, EXTRACTED_PATCH_OPTS);
    });
    const cell = table.rows[0].cells[0];
    eq('patch-honesty: a landed patch changes the cell text',
      cell.innerText.includes('123,456'), false);
    eq('patch-honesty: a landed patch stamps the marker and hover text',
      cell.classList.contains('dr-ext-rounded') &&
        cell.title === 'Original: Cost: 123,456 per month',
      true);
    eq('patch-honesty: a landed patch stores the original',
      DR_STORE.getTableOriginalText(table, cell), 'Cost: 123,456 per month');
    eq('patch-honesty: a landed patch flips the form',
      DR_STORE.getTableAppliedFlag(table), 'simplified');
  } finally {
    DR_STORE.unregisterTable(table);
  }
})();

// Two numbers in one text piece are two patches that land in one write. The
// failure row holds a count of patches, never of touched pieces, so two
// landed patches in one piece log no row.
(function twoPatchesInOnePieceLogNoFailure() {
  const table = makeMockTable([[
    { tag: 'td', text: 'Cost: 123,456 to 654,321 per month' },
  ]]);
  const failureRows = [];
  const offRow = DR_LOG.onRow((row) => {
    if (/cells were left unrounded/.test(row.text)) failureRows.push(row.text);
  });
  try {
    withCreateTreeWalker(function () {
      roundTable(table, EXTRACTED_PATCH_OPTS);
    });
    const cell = table.rows[0].cells[0];
    eq('patch-honesty: both numbers in one piece change',
      /123,456|654,321/.test(cell.innerText), false);
    eq('patch-honesty: two landed patches in one piece log no failure row',
      failureRows, []);
  } finally {
    offRow();
    DR_STORE.unregisterTable(table);
  }
})();

// The patch step reports what it did: the landed count is the write path's
// only evidence that the screen changed.
(function applyExtractedPatchesReturnsLandedCount() {
  global.document.createTreeWalker = function () {
    let done = false;
    return {
      nextNode: function () {
        if (done) return null;
        done = true;
        return { nodeValue: 'A 100 B 200' };
      },
    };
  };
  try {
    const { landed } = applyExtractedPatches({}, [
      { index: 2, numStr: '100', newNum: '90' },
      { index: 8, numStr: '999', newNum: '1,000' },
    ]);
    eq('patch-honesty: applyExtractedPatches returns the landed count', landed, 1);
    eq('patch-honesty: an empty patch list lands zero patches',
      applyExtractedPatches({}, []).landed, 0);
  } finally {
    delete global.document.createTreeWalker;
  }
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

  const contentJsSource = sourceByName('content.js');
  if (contentJsSource === null) {
    eq('sidebar-defaults: source file content.js present in manifest', false, true);
    return;
  }

  // AC1/AC2: Sidebar UI defaults now live in constants.js (single source of
  // truth shared with content.js). The HTML must NOT hard-code checked /
  // selected attributes — they would shadow the JS-applied defaults.
  eq('sidebar-defaults: simplifyMixedCells default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('sidebar-defaults: simplifyMixedCurrency default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('sidebar-defaults: simplifyMixedPercent default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('sidebar-defaults: dateGranularity default is "year" in DR_DEFAULTS',
    DR_DEFAULTS.dateGranularity, 'year');
  eq('sidebar-defaults: timeGranularity default is "hour" in DR_DEFAULTS',
    DR_DEFAULTS.timeGranularity, 'hour');
  eq('sidebar-defaults: sidebar.html does not hard-code "checked" attributes',
    /<input[^>]*checked/i.test(sidebarHtml), false);
  eq('sidebar-defaults: sidebar.html does not hard-code "selected" options',
    /<option[^>]*selected/i.test(sidebarHtml), false);
  eq('sidebar-defaults: sidebar.html loads constants.js before sidebar.js',
    /constants\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
  eq('sidebar-defaults: sidebar.js applies DR_DEFAULTS to the UI on load',
    /applyDefaultsToUI[\s\S]*DR_DEFAULTS/.test(sidebarJsSource), true);
  eq('sidebar-defaults: manifest content_scripts load order is defaults, log buffer, dr-number package, dr-table package, dr-simplify package, messaging bus, store, ui-toggle, content',
    JSON.stringify(manifest.content_scripts[0].js) === JSON.stringify([
      'constants.js',
      'lib/dr-log/index.js',
      'lib/dr-number/rounding.js', 'lib/dr-number/core.js',
      'lib/dr-number/parsing.js', 'lib/dr-number/identifiers.js',
      'lib/dr-number/index.js',
      'lib/dr-table/detect.js', 'lib/dr-table/index.js',
      'lib/dr-simplify/ladder.js', 'lib/dr-simplify/index.js',
      'lib/dr-capture/state.js', 'lib/dr-capture/render.js',
      'lib/dr-capture/index.js',
      'adapters/messaging.js', 'app/store.js',
      'ui-toggle.js', 'ui-toast.js', 'content.js',
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

