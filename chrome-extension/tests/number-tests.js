// Number reading, rounding, dates and times, and identifier shapes (lib/dr-number).

// --- extractNumbersInText (multi-match) ---

eq('extractNumbersInText: "₹615.71–623.33 crore" yields 615.71 and 623.33',
  extractNumbersInText('₹615.71–623.33 crore'),
  [
    { numStr: '615.71', num: 615.71, index: 1 },
    { numStr: '623.33', num: 623.33, index: 8 }
  ]);

eq('extractNumbersInText: "between 1,200 and 3,400 units" yields 1,200 and 3,400',
  extractNumbersInText('between 1,200 and 3,400 units'),
  [
    { numStr: '1,200', num: 1200, index: 8 },
    { numStr: '3,400', num: 3400, index: 18 }
  ]);

eq('extractNumbersInText: "286k" yields one number',
  extractNumbersInText('286k'),
  [{ numStr: '286', num: 286, index: 0 }]);

eq('extractNumbersInText: text with no digits yields no numbers',
  extractNumbersInText('N/A'),
  []);

eq('extractNumbersInText: three numbers in a sentence',
  extractNumbersInText('grew from 10 to 200 in 3,000 days').map(m => m.num),
  [10, 200, 3000]);

eq('extractNumbersInText: decimal followed by integer',
  extractNumbersInText('avg 4.5, peak 9'),
  [
    { numStr: '4.5', num: 4.5, index: 4 },
    { numStr: '9', num: 9, index: 14 }
  ]);

eq('extractNumbersInText: "a 100 b 200 c" yields each number\'s index',
  extractNumbersInText('a 100 b 200 c').map(m => ({ s: m.numStr, i: m.index })),
  [{ s: '100', i: 2 }, { s: '200', i: 8 }]);

eq('extractNumbersInText: "range 0 to 500" yields no zero',
  extractNumbersInText('range 0 to 500').map(m => m.num),
  [500]);

// --- Digits joined to letters yield no number ---
// NUMBER_IN_TEXT_PATTERN (numbers-in-text.js) holds the reason.

eq('extractNumbersInText: application number "XR47182913MKB07" yields no numbers',
  numStrs('XR47182913MKB07'),
  []);

eq('extractNumbersInText: zero-padded code "MKB07" yields no numbers',
  numStrs('MKB07'),
  []);

eq('extractNumbersInText: label "Q3" yields no numbers',
  numStrs('Q3'),
  []);

eq('extractNumbersInText: "abc1,200" yields no numbers',
  numStrs('abc1,200'),
  []);

// --- A hyphen after a digit is a separator, not a minus sign ---

eq('extractNumbersInText: phone number yields two positive numbers',
  numStrs('555-1234'),
  ['555', '1234']);

eq('extractNumbersInText: ZIP+4 yields two positive numbers',
  numStrs('12345-6789'),
  ['12345', '6789']);

eq('extractNumbersInText: hyphen range yields two positive numbers',
  numStrs('10-20'),
  ['10', '20']);

eq('extractNumbersInText: hyphen range with a currency sign yields two positive numbers',
  numStrs('₹1,968-2,054 crore'),
  ['1,968', '2,054']);

eq('extractNumbersInText: en-dash range with a currency sign yields two positive numbers',
  numStrs('₹1,968–2,054 crore'),
  ['1,968', '2,054']);

eq('extractNumbersInText: year-month yields two positive numbers',
  numStrs('2022-04'),
  ['2022', '04']);

// --- Negatives and plain amounts yield their numbers ---

eq('extractNumbersInText: negative after whitespace keeps its minus sign',
  numStrs('down -1,200 units'),
  ['-1,200']);

eq('extractNumbersInText: leading negative keeps its minus sign',
  numStrs('-5.2% change'),
  ['-5.2']);

eq('extractNumbersInText: currency-prefixed amount yields its digits',
  numStrs('$48,090.00'),
  ['48,090.00']);

eq('extractNumbersInText: caret exponent notation yields two numbers',
  numStrs('10^12'),
  ['10', '12']);

// --- formatNumber: the one write-back ---

eq('format: 8500000 over "8,584,629" writes "8,500,000"',
  formatNumber(8500000, '8,584,629'),
  '8,500,000');

eq('format: 300 over "286" writes "300"',
  formatNumber(300, '286'),
  '300');

eq('format: a whole result writes no decimals and groups its digits',
  formatNumber(1500, '1.234'),
  '1,500');

// --- The number reader: plain, grouped, signed and bracketed text ---

eq('toNumber: "286" reads as 286', toNumber('286'), 286);

eq('toNumber: "8,584,629" reads as 8584629', toNumber('8,584,629'), 8584629);

eq('toNumber: "$1,234.56" reads as 1234.56', toNumber('$1,234.56'), 1234.56);

eq('toNumber: "(500)" reads as -500', toNumber('(500)'), -500);

eq('toNumber: "286k" reads as no number', toNumber('286k'), null);

eq('toNumber: "N/A" reads as no number', toNumber('N/A'), null);

// --- End-to-end magnitude + rounding parity with example table ---
// 8,584,629           -> 8,500,000
// 286                 -> 300
// 8,584,629 USD       -> 8,500,000 USD
// 286k                -> 300k

(function endToEnd() {
  const cells = ['8,584,629', '286', '8,584,629 USD', '286k'];
  const infos = cells.map(text => {
    const num = toNumber(text);
    if (num !== null) return { kind: 'pure', num, text };
    const ex = extractNumbersInText(text)[0];
    if (ex) return { kind: 'extracted', num: ex.num, numStr: ex.numStr, index: ex.index, text };
    return { kind: 'skip', num: null, text };
  });

  const dataset = [infos.map(i => i.num)];
  const maxMag = findMaxMagnitude(dataset);
  eq('end to end: the max magnitude of "8,584,629", "286", "8,584,629 USD" and "286k" is 6', maxMag, 6);

  const out = infos.map(info => {
    if (info.kind === 'skip') return info.text;
    const rounded = roundValueSetAware(info.num, maxMag, -0.5, -0.5, 1);
    if (rounded === info.num) return info.text;
    if (info.kind === 'pure') return writePureCell(rounded, info.text);
    const num = formatNumber(rounded, info.numStr);
    return info.text.substring(0, info.index) + num + info.text.substring(info.index + info.numStr.length);
  });

  eq('end to end: "8,584,629", "286", "8,584,629 USD" and "286k" round to "8,500,000", "300", "8,500,000 USD" and "300k"', out,
    ['8,500,000', '300', '8,500,000 USD', '300k']);
})();

// --- Range cell: every number in the cell must round ---
(function rangeCell() {
  const text = '₹615.71–623.33 crore';
  const out = roundEveryNumberInText(text);

  eq('range cell: both numbers in "₹615.71–623.33 crore" round',
    out, '₹600–600 crore');
})();

// --- A comma that ends a number is punctuation, not a separator ---
// The match string ends in a digit. DIGIT_RUN_PATTERN (numbers-in-text.js)
// holds the reason.
eq('extractNumbersInText: comma after a number is left out of the match',
  extractNumbersInText('See ref 12, total 9,850'),
  [
    { numStr: '12', num: 12, index: 8 },
    { numStr: '9,850', num: 9850, index: 18 }
  ]);

eq('extractNumbersInText: a list of grouped numbers keeps each number\'s own separators',
  extractNumbersInText('1,200, 3,400, and 5,600').map(m => m.numStr),
  ['1,200', '3,400', '5,600']);

// --- Range cell with mixed magnitudes ---
(function rangeMixedMagnitudes() {
  const text = '50–5,000 range';
  const out = roundEveryNumberInText(text);

  // maxMag = 3 (from 5000). 50 is magnitude 1, far from top -> uses offset_other (=top, both -0.5),
  // so 50 rounds toward step = 10^1 * 0.5 = 5 -> 50.
  // 5000 stays as 5,000.
  eq('range cell: low end keeps its precision when far below top magnitude',
    out, '50–5,000 range');
})();

// --- Two numbers in one text, one longer once rounded, both round in place ---
(function spliceSafety() {
  // 9,876 rounds to 10,000, one character longer.
  const text = '9,876 then 1,234';
  const out = roundEveryNumberInText(text);

  // Both magnitude 3. step = 500. 9876/500=19.75->20*500=10,000. 1234/500=2.47->2*500=1,000.
  eq('two numbers in place: "9,876 then 1,234" rounds to "10,000 then 1,000"',
    out, '10,000 then 1,000');
})();

// --- The number reader: brackets, and texts with no digits ---
eq('toNumber: the bracketed number "(1,234)" reads as -1234', toNumber('(1,234)'), -1234);

eq('toNumber: an empty string reads as no number', toNumber(''), null);

eq('toNumber: whitespace only reads as no number', toNumber('   '), null);

eq('toNumber: a dollar sign alone reads as no number', toNumber('$'), null);

eq('toNumber: a euro sign alone reads as no number', toNumber('€'), null);

eq('toNumber: " $ " reads as no number', toNumber(' $ '), null);

// --- Pure cell writes: common shapes, whole and fractional results ---
eq('pure cell write: pure integer keeps commas',
  writePureCell(8500000, '8,584,629'), '8,500,000');

eq('pure cell write: currency prefix preserved',
  writePureCell(8500000, '$8,584,629'), '$8,500,000');

eq('pure cell write: percent suffix preserved',
  writePureCell(12, '12.34%'), '12%');

eq('pure cell write: a bracketed number keeps its brackets',
  writePureCell(-500, '(523)'), '(500)');

eq('pure cell write: whole number 1 from "1.04" -> "1"',
  writePureCell(1, '1.04'), '1');

eq('pure cell write: whole number 2 from "1.5" -> "2"',
  writePureCell(2, '1.5'), '2');

eq('pure cell write: 0 from "0.04" -> "0"',
  writePureCell(0, '0.04'), '0');

eq('pure cell write: negative whole number -5 from "-5.2" -> "-5"',
  writePureCell(-5, '-5.2'), '-5');

// A fractional result keeps its own decimals
eq('pure cell write: 1.5 from "1.4" -> "1.5"',
  writePureCell(1.5, '1.4'), '1.5');

eq('pure cell write: 1.25 from "1.234" -> "1.25"',
  writePureCell(1.25, '1.234'), '1.25');

// A whole result keeps the cell's format marks and brackets
eq('pure cell write: whole number with percent -> "1%"',
  writePureCell(1, '1.04%'), '1%');

eq('pure cell write: whole number with currency -> "$2"',
  writePureCell(2, '$1.99'), '$2');

eq('pure cell write: a whole result from the bracketed number "(2.85)" -> "(3)"',
  writePureCell(-3, '(2.85)'), '(3)');

// --- Finding dates ---

eq('findDates: the bare year "2018" is a date', findDates('2018') !== null, true);

eq('findDates: the bare year "1899" is no date', findDates('1899') !== null, false);

eq('findDates: the bare year "2100" is no date', findDates('2100') !== null, false);

eq('findDates: "2024-03-14" is a date', findDates('2024-03-14') !== null, true);

eq('findDates: "3/14/2024" is a date', findDates('3/14/2024') !== null, true);

eq('findDates: "3-14-2024" is a date', findDates('3-14-2024') !== null, true);

eq('findDates: "March 14, 2024" is a date', findDates('March 14, 2024') !== null, true);

eq('findDates: "14 March 2024" is a date', findDates('14 March 2024') !== null, true);

eq('findDates: "Mar 2024" is a date', findDates('Mar 2024') !== null, true);

eq('findDates: "Sept 2024" is a date', findDates('Sept 2024') !== null, true);

eq('findDates: plain number "1234" is no date', findDates('1234') !== null, false);

eq('findDates: "hello" is no date', findDates('hello') !== null, false);

eq('findDates: empty text is no date', findDates('') !== null, false);

// --- Exclusions ---

(function exclusionFirstColumn() {
  const opts = { simplifyFirstColumn: false };
  eq('exclude: column 0 with simplifyFirstColumn off -> "first-column"', getExclusionReason(0, opts), 'first-column');
  eq('exclude: non-first column ignores flag', getExclusionReason(1, opts), null);
})();

// --- simplifyFirstRow ---

(function simplifyFirstRowTests() {
  eq('simplifyFirstRow: row 0 excluded when flag is false',
    getExclusionReason(1, { simplifyFirstRow: false }, 0), 'first-row');
  eq('simplifyFirstRow: row 1 not excluded when flag is false',
    getExclusionReason(1, { simplifyFirstRow: false }, 1), null);
  eq('simplifyFirstRow: row 0 not excluded when flag is true',
    getExclusionReason(1, { simplifyFirstRow: true }, 0), null);
  eq('simplifyFirstRow: row 0 excluded when flag is unset (default)',
    getExclusionReason(1, {}, 0), 'first-row');
})();

// First-match-wins priority: first-row beats first-column
(function exclusionPriority() {
  const opts = { simplifyFirstRow: false, simplifyFirstColumn: false };
  eq('priority: row 0, column 0 -> first row',
    getExclusionReason(0, opts, 0), 'first-row');
  eq('priority: row 1, column 0 -> first column',
    getExclusionReason(0, opts, 1), 'first-column');
  eq('priority: row 1, column 1 -> no exclusion',
    getExclusionReason(1, opts, 1), null);
})();

// --- Per-type granularity ---

// Date granularity
// CONTRACT: roundDateText drops the parts of the date finer than the granularity
// and changes only the date portion of the cell text. For mixed cells (label +
// date) the surrounding text is preserved.
eq('roundDateText: year granularity returns a 4-digit year string',
  roundDateText('2018', 'year'), '2018');

eq('roundDateText: decade cuts bare year 2018 -> 2010',
  roundDateText('2018', 'decade'), '2010');

eq('roundDateText: century cuts bare year 2018 -> 2000',
  roundDateText('2018', 'century'), '2000');

eq('roundDateText: decade in "March 14, 2024" returns year string "2020"',
  roundDateText('March 14, 2024', 'decade'), '2020');

eq('roundDateText: century in "March 14, 2024" returns year string "2000"',
  roundDateText('March 14, 2024', 'century'), '2000');

eq('roundDateText: decade in ISO date "2024-03-14" returns "2020"',
  roundDateText('2024-03-14', 'decade'), '2020');

eq('roundDateText: unparseable input returns the original text unchanged',
  roundDateText('hello world', 'decade'), 'hello world');

eq('roundDateText: 2020 at decade granularity still returns "2020"',
  roundDateText('2020', 'decade'), '2020');

eq('roundDateText: mixed cell preserves label, replaces date (ISO dash, decade)',
  roundDateText('Payment Disbursed on: 2025-04-02', 'decade'), 'Payment Disbursed on: 2020');

eq('roundDateText: mixed cell preserves label, replaces date (ISO dash, year)',
  roundDateText('Due date: 2024-11-15', 'year'), 'Due date: 2024');

eq('roundDateText: mixed cell preserves label, replaces date (named month, decade)',
  roundDateText('Filed: March 14, 2024', 'decade'), 'Filed: 2020');

eq('roundDateText: mixed cell preserves trailing text after date',
  roundDateText('2024-03-14 (estimated)', 'decade'), '2020 (estimated)');

eq('roundDateText: mixed cell preserves label at month granularity',
  roundDateText('Paid on 2025-04-02', 'month'), 'Paid on 2025-04');

// Month granularity removes the day and keeps the date's own style.
(function dateMonthGranularity() {
  const cases = [
    ['December 13, 2096',   'December 2096'],
    ['Dec 13, 2096',        'Dec 2096'],
    ['Sept. 4, 1998',       'Sept. 1998'],
    ['June 21st, 2020',     'June 2020'],
    ['21 June 2020',        'June 2020'],
    ['21st June 2020',      'June 2020'],
    ['2020 June 21',        '2020 June'],
    ['2096-12-13',          '2096-12'],
    ['2096/12/13',          '2096/12'],
    ['Jun 2020',            'Jun 2020'],
    ['2096',                '2096'],
  ];
  for (const [input, expected] of cases) {
    eq(`roundDateText: "${input}" at month -> "${expected}"`, roundDateText(input, 'month'), expected);
  }
})();

// At quarter a date becomes its quarter and full year, on the side of the
// year where the month stood. A date with no month stays as written.
(function quarterCases() {
  const cases = [
    ['Feb 15, 2025',        'Q1 2025'],
    ['Sept. 4, 1998',       'Q3 1998'],
    ['June 21st, 2020',     'Q2 2020'],
    ['15 Feb 2025',         'Q1 2025'],
    ['2025 Feb 15',         '2025 Q1'],
    ['2025-02-15',          '2025 Q1'],
    ['2025/12/15',          '2025 Q4'],
    ['August 2025',         'Q3 2025'],
    ['MAY 2025',            'Q2 2025'],
    ['2025-04-01',          '2025 Q2'],
    ['2025-03-31',          '2025 Q1'],
    ['2025',                '2025'],
    ['Paid on 2025-04-02',  'Paid on 2025 Q2'],
    ['Jun 2020 - Dec 2020', 'Q2 2020 - Q4 2020'],
  ];
  for (const [input, expected] of cases) {
    eq(`roundDateText: "${input}" at quarter -> "${expected}"`, roundDateText(input, 'quarter'), expected);
  }
})();

// An ordinal suffix on any part of a date keeps the cell a date, and the
// suffix goes with the part it follows.
eq('findDates: "2020th" (ordinal on a bare year) is a date', (findDates('2020th') !== null), true);
eq('findDates: "7/21st/2020" (ordinal on a numeric part) is a date', (findDates('7/21st/2020') !== null), true);
eq('roundDateText: "Jun 2015th" at decade -> "2010"', roundDateText('Jun 2015th', 'decade'), '2010');
eq('roundDateText: "2015-07-21st" at month -> "2015-07"', roundDateText('2015-07-21st', 'month'), '2015-07');
eq('roundDateText: "2015-07-21st" at year -> "2015"', roundDateText('2015-07-21st', 'year'), '2015');
eq('roundDateText: "2015-07-21st" at quarter -> "2015 Q3"', roundDateText('2015-07-21st', 'quarter'), '2015 Q3');
eq('roundDateText: "Jun 2015th" at quarter -> "Q2 2015"', roundDateText('Jun 2015th', 'quarter'), 'Q2 2015');

// Every date in a cell changes; the words and any time of day stay.
eq('roundDateText: "Jun 2020 - Dec 2020" at year -> "2020 - 2020"',
  roundDateText('Jun 2020 - Dec 2020', 'year'), '2020 - 2020');
eq('roundDateText: "June 3, 2021 to Dec 13, 2096" at month -> "June 2021 to Dec 2096"',
  roundDateText('June 3, 2021 to Dec 13, 2096', 'month'), 'June 2021 to Dec 2096');
eq('roundDateText: "2019-03-02 and 2096-12-13" at decade -> "2010 and 2090"',
  roundDateText('2019-03-02 and 2096-12-13', 'decade'), '2010 and 2090');

// A month word must be a month name or its short form.
eq('findDates: "market 21, 2015" (word starting like a month) is no date', (findDates('market 21, 2015') !== null), false);
eq('findDates: "Marching 4, 2015" is no date', (findDates('Marching 4, 2015') !== null), false);
eq('findDates: "Sept. 4, 1998" is a date', (findDates('Sept. 4, 1998') !== null), true);
eq('findDates: "MAY 4, 1998" is a date', (findDates('MAY 4, 1998') !== null), true);

// A date that cannot exist is found, and marked so the cell holds.
eq('findDates: "2020-13-45" is impossible', findDates('2020-13-45')[0].impossible, true);
eq('findDates: "June 45, 2020" is impossible', findDates('June 45, 2020')[0].impossible, true);
eq('findDates: "45/12/2020" is impossible', findDates('45/12/2020')[0].impossible, true);
eq('findDates: "13/13/2020" is impossible', findDates('13/13/2020')[0].impossible, true);
eq('roundDateText: "2020-13-45" stays as written', roundDateText('2020-13-45', 'year'), '2020-13-45');

// A worked example: every granularity cuts, none rounds.
eq('roundDateText: December 13, 2096 at year -> 2096',
  roundDateText('December 13, 2096', 'year'), '2096');
eq('roundDateText: December 13, 2096 at decade -> 2090',
  roundDateText('December 13, 2096', 'decade'), '2090');
eq('roundDateText: December 13, 2096 at century -> 2000',
  roundDateText('December 13, 2096', 'century'), '2000');

// Time granularity: one rule for a clock time and an ISO date-time. A time
// rounds to the nearest hour or minute; a time in the last hour or the last
// minute of the clock goes down, so no time passes midnight; seconds drop.
const CLOCK_TIME_CASES = [
  // [input, granularity, expected, what the case covers]
  ['14:29:30', 'hour', '14:00', 'minutes and seconds read once, below the half hour'],
  ['14:30:00', 'hour', '15:00', 'the half hour rounds up'],
  ['14:30', 'hour', '15:00', 'the half hour rounds up with no seconds'],
  ['14:31', 'hour', '15:00', 'past the half hour rounds up'],
  ['14:29', 'hour', '14:00', 'below the half hour rounds down'],
  ['3:45 PM', 'hour', '4:00 PM', 'a twelve-hour time keeps its meridiem'],
  ['2:45pm', 'hour', '3:00pm', 'a lowercase meridiem keeps its case'],
  ['11:45 AM', 'hour', '12:00 PM', 'the morning rounds up across noon'],
  ['12:45 PM', 'hour', '1:00 PM', 'noon hour rounds up to one'],
  ['12:45 AM', 'hour', '1:00 AM', 'midnight hour rounds up to one'],
  ['09:05', 'hour', '09:00', 'a padded hour keeps its padding'],
  ['02:30', 'hour', '03:00', 'a padded hour keeps its padding when it rounds up'],
  ['22:45', 'hour', '23:00', 'the hour before the last hour rounds up'],
  ['10:45 PM', 'hour', '11:00 PM', 'the hour before the last twelve-hour hour rounds up'],
  ['23:45', 'hour', '23:00', 'the last hour goes down'],
  ['23:30', 'hour', '23:00', 'the last hour goes down at the half hour'],
  ['11:45 PM', 'hour', '11:00 PM', 'the last hour goes down with PM'],
  ['11:58 p.m.', 'hour', '11:00 p.m.', 'the last hour goes down with a dotted meridiem'],
  ['11:45', 'hour', '11:00', 'an hour of 11 with no meridiem goes down'],
  ['23:59:45', 'hour', '23:00', 'the last minute goes down at hour'],
  ['14:29:30', 'minute', '14:30', 'thirty seconds rounds up'],
  ['14:29:29', 'minute', '14:29', 'below thirty seconds rounds down'],
  ['14:59:30', 'minute', '15:00', 'the minute carries into the hour'],
  ['11:59:30 AM', 'minute', '12:00 PM', 'the minute carries across noon'],
  ['12:59:30 AM', 'minute', '1:00 AM', 'the minute carries out of the midnight hour'],
  ['23:58:45', 'minute', '23:59', 'the last hour still rounds up to its last minute'],
  ['23:59:45', 'minute', '23:59', 'the last minute goes down'],
  ['11:59:45 PM', 'minute', '11:59 PM', 'the last minute goes down with PM'],
  ['11:59:45', 'minute', '11:59', 'the last minute of an hour of 11 with no meridiem goes down'],
  ['09:05:40', 'minute', '09:06', 'a padded hour keeps its padding at minute'],
];

for (const [input, granularity, expected, covers] of CLOCK_TIME_CASES) {
  eq(`roundTimeCell: ${input} at ${granularity} -> ${expected} (${covers})`,
    roundTimeCell(input, granularity), expected);
}

eq('roundTimeCell: a time with no seconds is unchanged at minute',
  roundTimeCell('14:30', 'minute'), null);
eq('roundTimeCell: a twelve-hour time with no seconds is unchanged at minute',
  roundTimeCell('3:45 PM', 'minute'), null);
eq('roundTimeCell: a time already on the hour is unchanged at hour',
  roundTimeCell('14:00', 'hour'), null);
eq('roundTimeCell: invalid input -> null',
  roundTimeCell('not a time', 'hour'), null);
eq('roundTimeCell: an hour past 23 stays as written',
  roundTimeCell('25:30', 'hour'), null);
eq('roundTimeCell: a minute past 59 stays as written',
  roundTimeCell('14:75', 'hour'), null);
eq('roundTimeCell: a second past 59 stays as written',
  roundTimeCell('14:29:75', 'minute'), null);
eq('roundTimeCell: a twelve-hour hour of 0 stays as written',
  roundTimeCell('0:15 AM', 'hour'), null);
eq('roundTimeCell: a twelve-hour hour past 12 stays as written',
  roundTimeCell('13:15 PM', 'hour'), null);
eq('roundTimeCell: an ISO date-time with a second past 59 stays as written',
  roundTimeCell('2026-01-01T14:29:75', 'minute'), null);

// No time passes midnight: every second of the last hour, at either
// granularity, stays inside it.
(function noTimePassesMidnight() {
  const pad = (n) => String(n).padStart(2, '0');
  const crossed = [];
  for (const granularity of ['hour', 'minute']) {
    for (let minute = 0; minute < 60; minute++) {
      for (let second = 0; second < 60; second++) {
        const text = `23:${pad(minute)}:${pad(second)}`;
        const twelve = `11:${pad(minute)}:${pad(second)} PM`;
        const iso = `2026-11-09T23:${pad(minute)}:${pad(second)}`;
        const out24 = roundTimeCell(text, granularity) || text;
        const out12 = roundTimeCell(twelve, granularity) || twelve;
        const outIso = roundTimeCell(iso, granularity) || iso;
        if (!out24.startsWith('23:')) crossed.push(text + ' ' + granularity + ' -> ' + out24);
        if (!/^11:\d\d PM$/.test(out12)) crossed.push(twelve + ' ' + granularity + ' -> ' + out12);
        if (!outIso.startsWith('2026-11-09 23:')) crossed.push(iso + ' ' + granularity + ' -> ' + outIso);
      }
    }
  }
  eq('roundTimeCell: no time in the last hour passes midnight', crossed, []);
})();

// roundClockTime: the one rounding rule both paths call. It takes the hour as
// written and returns it in the same convention.
eq('roundClockTime: twenty-four hour, hour',
  roundClockTime({ hour: 14, minute: 29, second: 30 }, 'hour'), { hour: 14, minute: 0, isPm: null });
eq('roundClockTime: twelve hour carries across noon at minute',
  roundClockTime({ hour: 11, minute: 59, second: 30, isPm: false }, 'minute'), { hour: 12, minute: 0, isPm: true });
eq('roundClockTime: an unknown granularity -> null',
  roundClockTime({ hour: 14, minute: 29, second: 30 }, 'second'), null);
eq('roundClockTime: a twelve-hour hour of 0 -> null',
  roundClockTime({ hour: 0, minute: 15, second: 0, isPm: false }, 'hour'), null);
eq('roundClockTime: an hour of 11 with no AM/PM goes down',
  roundClockTime({ hour: 11, minute: 45, second: 0 }, 'hour'), { hour: 11, minute: 0, isPm: null });
eq('roundClockTime: an hour of 11 on the twenty-four hour clock rounds up',
  roundClockTime({ hour: 11, minute: 45, second: 0, isTwentyFourHour: true }, 'hour'),
  { hour: 12, minute: 0, isPm: null });
eq('roundClockTime: hour 23 on the twenty-four hour clock goes down',
  roundClockTime({ hour: 23, minute: 45, second: 0, isTwentyFourHour: true }, 'hour'),
  { hour: 23, minute: 0, isPm: null });

// --- ISO 8601 date-time: follows the time rule, date preserved ---
// The time part is the one clock-time shape, so a one-digit hour reads the
// same as a two-digit hour.
eq('roundTimeCell: "2025-11-26 09:30.5" (a fraction with no seconds) stays as written',
  roundTimeCell('2025-11-26 09:30.5', 'hour'), null);
eq('roundTimeCell: "2025-01-01T10:00:60" (out-of-range seconds) stays as written',
  roundTimeCell('2025-01-01T10:00:60', 'hour'), null);
eq('roundTimeCell: a time with a part out of range stays as written',
  ['24:00', '10:00:75', '13:00 PM', '2025-11-26T24:00'].map((t) => roundTimeCell(t, 'hour')),
  [null, null, null, null]);
eq('roundTimeCell: one-digit-hour date-time rounds like a two-digit one',
  [roundTimeCell('2025-11-26 9:30', 'hour'), roundTimeCell('2025-11-26 09:30', 'hour')],
  ['2025-11-26 10:00', '2025-11-26 10:00']);

const ISO_DATE_TIME_CASES = [
  // [input, granularity, expected, what the case covers]
  ['2026-01-01T14:29:30', 'hour', '2026-01-01 14:00', 'minutes and seconds read once'],
  ['2026-01-01T14:29:30', 'minute', '2026-01-01 14:30', 'thirty seconds rounds up'],
  ['2026-01-01T14:29:29', 'minute', '2026-01-01 14:29', 'below thirty seconds rounds down'],
  ['2026-11-09T23:45', 'hour', '2026-11-09 23:00', 'the last hour goes down'],
  ['2026-11-09T23:59:45', 'minute', '2026-11-09 23:59', 'the last minute goes down'],
  ['2026-11-09T23:59:45', 'hour', '2026-11-09 23:00', 'the last minute goes down at hour'],
  ['2026-11-09T22:45', 'hour', '2026-11-09 23:00', 'the hour before the last hour rounds up'],
  ['2026-11-09T11:45', 'hour', '2026-11-09 12:00', 'an hour of 11 rounds up on the 24-hour clock'],
  ['2026-11-09T11:30', 'hour', '2026-11-09 12:00', 'an hour of 11 rounds up at the half hour'],
  ['2026-11-09T11:59:45', 'minute', '2026-11-09 12:00', 'minute 11:59 carries into 12:00 on the 24-hour clock'],
  ['2026-11-09T14:59:30', 'minute', '2026-11-09 15:00', 'the minute carries into the hour'],
  ['2025-11-26T16:16:00.000-05:00', 'minute', '2025-11-26 16:16', 'the fraction and offset drop'],
  ['2025-11-26T16:16:00.000-05:00', 'hour', '2025-11-26 16:00', 'below the half hour rounds down'],
  ['2025-11-26T16:30:00Z', 'hour', '2025-11-26 17:00', 'the half hour rounds up'],
  ['2025-11-26T23:15:00Z', 'hour', '2025-11-26 23:00', 'the last hour goes down below the half hour'],
  ['2024-11-03T08:15:29.999-05:00', 'minute', '2024-11-03 08:15', 'a fraction of a second never rounds up'],
  ['2024-11-03T08:15:30.250-05:00', 'hour', '2024-11-03 08:00', 'the fraction and offset drop at hour'],
];

for (const [input, granularity, expected, covers] of ISO_DATE_TIME_CASES) {
  eq(`roundTimeCell: ${input} at ${granularity} -> ${expected} (${covers})`,
    roundTimeCell(input, granularity), expected);
}

eq('roundTimeCell: an ISO date-time already in the result form is unchanged',
  roundTimeCell('2025-11-26 16:16', 'minute'), null);

// --- Offsets and num_top read from a setting value ---

eq('resolveOffset: null -> fallback', resolveOffset(null, -0.5), -0.5);

eq('resolveOffset: undefined -> fallback', resolveOffset(undefined, -0.5), -0.5);

eq('resolveOffset: "" -> fallback', resolveOffset('', -0.5), -0.5);

eq('resolveOffset: "-1.5" -> -1.5', resolveOffset('-1.5', -0.5), -1.5);

eq('resolveOffset: -2 -> -2', resolveOffset(-2, -0.5), -2);

eq('resolveOffset: "abc" -> fallback', resolveOffset('abc', -0.5), -0.5);

eq('resolveOffset: "-99" -> fallback',
  resolveOffset('-99', -0.5), -0.5);

eq('resolveOffset: "99" -> fallback',
  resolveOffset('99', -0.5), -0.5);

eq('resolveOffset: "-20" -> -20', resolveOffset('-20', -0.5), -20);

eq('resolveOffset: "20" -> 20', resolveOffset('20', -0.5), 20);

eq('resolveNumTop: null -> fallback', resolveNumTop(null, 1), 1);

eq('resolveNumTop: "" -> fallback', resolveNumTop('', 1), 1);

eq('resolveNumTop: "3" -> 3', resolveNumTop('3', 1), 3);

eq('resolveNumTop: 0 -> fallback',
  resolveNumTop(0, 1), 1);

eq('resolveNumTop: "-2" -> fallback',
  resolveNumTop('-2', 1), 1);

eq('resolveNumTop: "2.7" -> 2',
  resolveNumTop('2.7', 1), 2);

// A blank offset or top-band count falls back to DR_DEFAULTS, the one
// defaults record, so an edit there reaches every table.
(function roundingSettingsReadDefaultsRecord() {
  const saved = { offsetTop: DR_DEFAULTS.offsetTop, numTop: DR_DEFAULTS.numTop };
  try {
    DR_DEFAULTS.offsetTop = -1.5;
    DR_DEFAULTS.numTop = 3;
    eq('rounding settings with every value blank: the offsets and top-band count read DR_DEFAULTS',
      resolveRoundingSettings({}), { offsetTop: -1.5, offsetOther: -1.5, numTop: 3 });
  } finally {
    Object.assign(DR_DEFAULTS, saved);
  }
})();

// --- Steps and their labels ---

(function formatStep_labelsEachStep() {
  eq('formatStep: 5000 -> "5k"', formatStep(5000), '5k');
  eq('formatStep: 500 -> "500"', formatStep(500), '500');
  eq('formatStep: 2_500_000 -> "2.5M"', formatStep(2500000), '2.5M');
  eq('formatStep: 1e9 -> "1B"', formatStep(1e9), '1B');
  eq('formatStep: 2.5 -> "2.5"', formatStep(2.5), '2.5');
  eq('formatStep: 0.25 -> "0.25"', formatStep(0.25), '0.25');
  eq('formatStep: 1 -> "1"', formatStep(1), '1');
  eq('formatStep: 0 -> "0"', formatStep(0), '0');
})();

(function stepForOffset_stepOfEachOffset() {
  eq('stepForOffset(27136, 0) = 10000', stepForOffset(27136, 0), 10000);
  eq('stepForOffset(27136, -0.5) = 5000', stepForOffset(27136, -0.5), 5000);
  eq('stepForOffset(27136, -1) = 1000', stepForOffset(27136, -1), 1000);
  eq('stepForOffset(0, -0.5) = 0', stepForOffset(0, -0.5), 0);
})();

// --- Range expressions ---

// lettersToColIndex
eq('lettersToColIndex: A -> 0', lettersToColIndex('A'), 0);

eq('lettersToColIndex: B -> 1', lettersToColIndex('B'), 1);

eq('lettersToColIndex: Z -> 25', lettersToColIndex('Z'), 25);

eq('lettersToColIndex: AA -> 26', lettersToColIndex('AA'), 26);

eq('lettersToColIndex: AB -> 27', lettersToColIndex('AB'), 27);

eq('lettersToColIndex: a -> 0', lettersToColIndex('a'), 0);

eq('lettersToColIndex: A1 -> null', lettersToColIndex('A1'), null);

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
  eq('parseRangeExpr: "{A1:E8, G3:G, I4:K5}" -> 3 ranges',
    r.ranges.length, 3);
})();

(function expr_unionNoBraces() {
  const r = parseRangeExpr('A1:B2, D:D');
  eq('parseRangeExpr: "A1:B2, D:D" -> 2 ranges',
    r.ranges.length, 2);
})();

(function expr_semicolons() {
  const r = parseRangeExpr('A; B; C');
  eq('parseRangeExpr: "A; B; C" -> 3 ranges',
    r.ranges.length, 3);
})();

(function expr_invalid() {
  const r = parseRangeExpr('A:B:C');
  eq('parseRangeExpr: "A:B:C" -> error',
    typeof r.error, 'string');
})();

(function expr_invalidGarbage() {
  const r = parseRangeExpr('1A');
  eq('parseRangeExpr: "1A" -> error',
    typeof r.error, 'string');
  const r2 = parseRangeExpr('@#$');
  eq('parseRangeExpr: "@#$" -> error',
    typeof r2.error, 'string');
})();

// Open-ended in either direction
eq('parseRangeExpr: "G:G3" -> column G up to row 3',
  parseRangeExpr('G:G3'),
  { ranges: [{ colMin: 6, colMax: 6, rowMin: 0, rowMax: 2 }] });

// Swapped endpoints normalize
eq('parseRangeExpr: "A5:A2" -> rows 1-4 of column A',
  parseRangeExpr('A5:A2'),
  { ranges: [{ colMin: 0, colMax: 0, rowMin: 1, rowMax: 4 }] });

// isInRanges
(function isIn_null() {
  eq('isInRanges: null ranges -> true',
    isInRanges(5, 5, null), true);
})();

(function isIn_inside() {
  const ranges = [{ colMin: 1, colMax: 3, rowMin: 1, rowMax: 5 }];
  eq('isInRanges: (2,2) in B2:D6 -> true', isInRanges(2, 2, ranges), true);
  eq('isInRanges: (1,1) in B2:D6 -> true',  isInRanges(1, 1, ranges), true);
  eq('isInRanges: (2,0) in B2:D6 -> false',  isInRanges(2, 0, ranges), false);
  eq('isInRanges: (0,2) in B2:D6 -> false',  isInRanges(0, 2, ranges), false);
})();

(function isIn_unionMembership() {
  const ranges = [
    { colMin: 0, colMax: 1, rowMin: 0, rowMax: 1 },
    { colMin: 5, colMax: 5, rowMin: 2, rowMax: Infinity }
  ];
  eq('isInRanges: (0,0) in A1:B2 or F3:F -> true', isInRanges(0, 0, ranges), true);
  eq('isInRanges: (100,5) in A1:B2 or F3:F -> true', isInRanges(100, 5, ranges), true);
  eq('isInRanges: (2,2) in A1:B2 or F3:F -> false', isInRanges(2, 2, ranges), false);
})();

// --- Range expressions with a partial endpoint ---

// Lowercase letters read as uppercase
(function f4g8_lowercase() {
  const r = parseRangeExpr('f4:g8');
  eq('partial range: "f4:g8" -> no error',
    typeof r.error, 'undefined');
  eq('partial range: "f4:g8" -> one range',
    r.ranges && r.ranges.length, 1);
  const rng = r.ranges && r.ranges[0];
  eq('partial range: "f4:g8" colMin=5', rng && rng.colMin, 5);
  eq('partial range: "f4:g8" colMax=6', rng && rng.colMax, 6);
  eq('partial range: "f4:g8" rowMin=3', rng && rng.rowMin, 3);
  eq('partial range: "f4:g8" rowMax=7', rng && rng.rowMax, 7);
})();

// Case-insensitive: uppercase F4:G8 must also work
(function F4G8_uppercase() {
  const r = parseRangeExpr('F4:G8');
  eq('partial range: "F4:G8" -> no error',
    typeof r.error, 'undefined');
  const rng = r.ranges && r.ranges[0];
  eq('partial range: "F4:G8" colMin=5', rng && rng.colMin, 5);
  eq('partial range: "F4:G8" colMax=6', rng && rng.colMax, 6);
  eq('partial range: "F4:G8" rowMin=3', rng && rng.rowMin, 3);
  eq('partial range: "F4:G8" rowMax=7', rng && rng.rowMax, 7);
})();

// B2:D (col+row on left, col-only on right) -> open row end
(function B2D_partial() {
  const r = parseRangeExpr('B2:D');
  eq('partial range: "B2:D" -> no error',
    typeof r.error, 'undefined');
  eq('partial range: "B2:D" -> one range',
    r.ranges && r.ranges.length, 1);
  const rng = r.ranges && r.ranges[0];
  eq('partial range: "B2:D" colMin=1', rng && rng.colMin, 1);
  eq('partial range: "B2:D" colMax=3', rng && rng.colMax, 3);
  eq('partial range: "B2:D" rowMin=1', rng && rng.rowMin, 1);
  eq('partial range: "B2:D" rowMax=Infinity', rng && rng.rowMax, Infinity);
})();

// B:D5 (col-only on left, col+row on right) -> open row start
(function BD5_partial() {
  const r = parseRangeExpr('B:D5');
  eq('partial range: "B:D5" -> no error',
    typeof r.error, 'undefined');
  eq('partial range: "B:D5" -> one range',
    r.ranges && r.ranges.length, 1);
  const rng = r.ranges && r.ranges[0];
  eq('partial range: "B:D5" colMin=1', rng && rng.colMin, 1);
  eq('partial range: "B:D5" colMax=3', rng && rng.colMax, 3);
  eq('partial range: "B:D5" rowMin=0', rng && rng.rowMin, 0);
  eq('partial range: "B:D5" rowMax=4', rng && rng.rowMax, 4);
})();

// A brace union of a rectangle and an open column
(function regression_union() {
  const r = parseRangeExpr('{A1:E8, G3:G}');
  eq('parseRangeExpr: "{A1:E8, G3:G}" -> 2 ranges', r.ranges && r.ranges.length, 2);
})();

// --- A percent cell with the percent switch off ---
// toNumber reads "+2.3%" as 2.3, but with the percent switch off its percent
// sign holds the number.
(function percentCellHeldWithThePercentSwitchUnset() {
  eq('percent cell "+2.3%" held with the percent switch unset',
    classifyAt('+2.3%', {}).stretches, []);
})();

// ---------------------------------------------------------------------------
// Numbers inside quotes
// ---------------------------------------------------------------------------

// --- getQuoteMaskedRanges unit tests ---

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

// --- Inline filtering: only 7 remains after quoting "the answer is 42" ---

(function quoteInlineFilter() {
  const text = 'He said "the answer is 42", but 7 disagreed.';
  const matches = extractNumbersInText(text);
  const quoteRanges = getQuoteMaskedRanges(text);
  const filtered = matches.filter(m =>
    !overlapsMaskedRange(quoteRanges, m.index, m.index + m.numStr.length)
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

// --- Scope guards ---

(function quoteScopeGuards() {
  // Single quotes: numbers inside '...' are not masked (out of scope)
  const singleQuote = "He said '42' and 7.";
  const sqMatches = extractNumbersInText(singleQuote);
  // getQuoteMaskedRanges only handles ASCII double-quotes — single quotes ignored
  const sqRanges = getQuoteMaskedRanges(singleQuote);
  eq('scope guard: single quotes not masked (zero quote ranges)',
    sqRanges.length, 0);
  eq('scope guard: 42 inside single quotes is not masked',
    sqMatches.filter(m => !overlapsMaskedRange(sqRanges, m.index, m.index + m.numStr.length))
      .some(m => m.num === 42), true);

  // Typographic quotes: “...” are NOT masked
  const typoQuote = '“the answer is 42” but 7.';
  const tqRanges = getQuoteMaskedRanges(typoQuote);
  eq('scope guard: typographic “...” not masked (zero quote ranges)',
    tqRanges.length, 0);
  // Both 42 and 7 survive unfiltered
  const tqMatches = extractNumbersInText(typoQuote);
  const tqFiltered = tqMatches.filter(m => !overlapsMaskedRange(tqRanges, m.index, m.index + m.numStr.length));
  eq('scope guard: 42 inside typographic quotes is not masked',
    tqFiltered.some(m => m.num === 42), true);

  // Mixed: one balanced ASCII pair and a bare number
  // 'he said "foo 5" and 10' -> 5 is masked, 10 is not
  const mixed = 'he said "foo 5" and 10';
  const mxRanges = getQuoteMaskedRanges(mixed);
  const mxMatches = extractNumbersInText(mixed);
  const mxFiltered = mxMatches.filter(m => !overlapsMaskedRange(mxRanges, m.index, m.index + m.numStr.length));
  eq('scope guard: 5 inside ASCII quotes is masked',
    mxFiltered.some(m => m.num === 5), false);
  eq('scope guard: 10 outside ASCII quotes is not masked',
    mxFiltered.some(m => m.num === 10), true);
})();

// ---------------------------------------------------------------------------
// Era-marked years: getEraYearMaskedRanges locates each year token bound to
// an era marker.
// ---------------------------------------------------------------------------
(function eraYearMaskedRanges() {
  // The number at [index, index + numStr.length) sits in an era-year range.
  const isEraYear = (text, index, numStr) =>
    overlapsMaskedRange(getEraYearMaskedRanges(text), index, index + numStr.length);

  // The digit token bound to a marker (either order) is an era year.
  eq('era: "Kalki 2898 AD" → 2898 is an era year',
    isEraYear('Kalki 2898 AD', 'Kalki '.length, '2898'), true);
  eq('era: "500 BC" → 500 is an era year',
    isEraYear('500 BC', 0, '500'), true);
  eq('era: "AD 79" → 79 is an era year',
    isEraYear('AD 79', 'AD '.length, '79'), true);
  // Both orders take the same spacing and the same larger-number guard.
  eq('era: "AD79" (no space) → 79 is an era year, like "2898AD"',
    [isEraYear('AD79', 'AD'.length, '79'), isEraYear('2898AD', 0, '2898')], [true, true]);
  eq('era: "AD 79.5" and "1.2898 AD" → a decimal is NOT an era year',
    [isEraYear('AD 79.5', 'AD '.length, '79.5'), isEraYear('1.2898 AD', 0, '1.2898')], [false, false]);
  eq('era: "Founded AD 79." → a sentence-ending period keeps 79 an era year',
    isEraYear('Founded AD 79.', 'Founded AD '.length, '79'), true);
  eq('era: "1200 CE" → 1200 is an era year',
    isEraYear('1200 CE', 0, '1200'), true);
  eq('era: "2,898 BCE" → comma year is an era year',
    isEraYear('2,898 BCE', 0, '2,898'), true);

  // Negatives: plain numbers, and marker letters embedded in a word.
  eq('era: plain "Revenue 3,000,000" is NOT an era year',
    isEraYear('Revenue 3,000,000', 'Revenue '.length, '3,000,000'), false);
  eq('era: bare "2898" (no marker) is NOT an era year',
    isEraYear('2898', 0, '2898'), false);
  eq('era: "ADELAIDE 12" does NOT match (AD inside a word)',
    isEraYear('ADELAIDE 12', 'ADELAIDE '.length, '12'), false);

  // Lowercase, period-less marker letters are ordinary words/abbreviations, not
  // eras: "3,420 ad hoc", "120 bp" (basis points), "5 ah", "12 ce", "9 bc".
  // These must NOT be read as years, which would keep them from rounding.
  eq('era: "3,420 ad hoc" → "ad" is a word, NOT an era year',
    isEraYear('3,420 ad hoc', 0, '3,420'), false);
  eq('era: "120 bp" (basis points) is NOT an era year',
    isEraYear('120 bp', 0, '120'), false);
  eq('era: "5 ah" is NOT an era year',
    isEraYear('5 ah', 0, '5'), false);
  // Period-punctuated lowercase forms stay unambiguous and DO match.
  eq('era: "79 a.d." (dotted, lowercase) is still an era year',
    isEraYear('79 a.d.', 0, '79'), true);
})();

// =============================================================================
// Date rounding to year display tests
// =============================================================================

// ---------------------------------------------------------------------------
// Worked-examples table
// ---------------------------------------------------------------------------
(function dateRoundWorkedExamples() {
  const cases = [
    // input              granularity  expected
    ['Jun 21, 2020',      'year',      '2020'],
    ['Jun 21, 2020',      'decade',    '2020'],
    ['Jun 21, 2020',      'century',   '2000'],
    ['Dec 21, 2020',      'year',      '2020'],
    ['Dec 21, 2020',      'decade',    '2020'],
    ['Dec 21, 2020',      'century',   '2000'],
    ['Jun 21, 2025',      'year',      '2025'],
    ['Jun 21, 2025',      'decade',    '2020'],
    ['Jun 21, 2025',      'century',   '2000'],
    ['Apr 11, 2026',      'year',      '2026'],
    ['Apr 11, 2026',      'decade',    '2020'],
    ['Apr 11, 2026',      'century',   '2000'],
    ['May 9, 2026',       'year',      '2026'],
    ['May 9, 2026',       'decade',    '2020'],
    ['May 9, 2026',       'century',   '2000'],
    ['Jun 30, 2024',      'year',      '2024'],
    ['Jun 30, 2024',      'decade',    '2020'],
    ['Jun 30, 2024',      'century',   '2000'],
    ['Jul 1, 2024',       'year',      '2024'],
    ['Jul 1, 2024',       'decade',    '2020'],
    ['Jul 1, 2024',       'century',   '2000'],
    ['1975',              'year',      '1975'],
    ['1975',              'decade',    '1970'],
    ['1975',              'century',   '1900'],
  ];

  for (const [input, gran, expected] of cases) {
    eq(`worked-example: "${input}" at ${gran} -> "${expected}"`,
      roundDateText(input, gran), expected);
  }
})();

// ---------------------------------------------------------------------------
// Shape equivalence — same logical date, different textual forms
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
  // '06-21-2020' is an all-numeric date, which the column post-pass reads and
  // roundDateText holds. The roundTable check below covers it: in a one-row
  // column, a second part above 12 makes the format hint month-first, so the
  // date reads as June 21 and rounds like the other shapes.

  for (const shape of shapes) {
    eq(`shape-equiv: "${shape}" year -> "2020"`,   roundDateText(shape, 'year'),    '2020');
    eq(`shape-equiv: "${shape}" decade -> "2020"`, roundDateText(shape, 'decade'),  '2020');
    eq(`shape-equiv: "${shape}" century -> "2000"`,roundDateText(shape, 'century'), '2000');
  }

  // The all-numeric form '06-21-2020' through roundTable.
  withCreateTreeWalker(function() {
    function runDateCell(text, gran) {
      const tbl = makeMockTable([[{ tag: 'td', text }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, roundTableOpts({ simplifyDates: true, dateGranularity: gran }));
      return tbl.rows[0].cells[0].innerText;
    }
    eq('shape-equiv (table cell): "06-21-2020" year -> "2020"',    runDateCell('06-21-2020', 'year'),    '2020');
    eq('shape-equiv (table cell): "06-21-2020" decade -> "2020"',  runDateCell('06-21-2020', 'decade'),  '2020');
    eq('shape-equiv (table cell): "06-21-2020" century -> "2000"', runDateCell('06-21-2020', 'century'), '2000');
  });
})();

// ---------------------------------------------------------------------------
// roundDateText returns a 4-digit year string for a pure date cell read
// by the classification pass. The date object is passed in, bypassing text parsing.
// ---------------------------------------------------------------------------
(function dateRoundReturnType() {
  for (const year of [2020, 1975, 2000, 2099]) {
    const d = { year, start: 0, end: 10, dayCut: { start: 7, end: 10 } };
    for (const gran of ['year', 'decade', 'century']) {
      const result = roundDateText(`${year}-12-31`, gran, [d]);
      eq(`roundDateText: a passed date ${year}-12-31 at ${gran} returns a four-digit year`,
        typeof result === 'string' && /^\d{4}$/.test(result), true);
    }
  }
})();

// ---------------------------------------------------------------------------
// A bare year already on its decade — "2020" at decade granularity — keeps
// its text, and roundTable leaves the cell unmarked.
// ---------------------------------------------------------------------------
(function dateRoundBareYearNoOp() {
  // Via roundTable: the cell should NOT get the rounded class.
  withCreateTreeWalker(function() {
    const tbl = makeMockTable([[{ tag: 'td', text: '2020' }]]);
    tbl.rows[0].cells[0].querySelectorAll = () => [];
    roundTable(tbl, roundTableOpts({ simplifyDates: true, dateGranularity: 'decade' }));
    eq('bare-year no-op: "2020" at decade not marked as rounded',
      tbl.rows[0].cells[0].classList.contains('dr-ext-rounded'), false);
  });
})();

// ---------------------------------------------------------------------------
// findDates finds a date in each of these shapes.
// ---------------------------------------------------------------------------
(function findDates_dateShapes() {
  eq('findDates: "2020/07/21" (ISO slash) is a date',  (findDates('2020/07/21') !== null), true);
  eq('findDates: "2020 June 21" (year-month-day, named month) is a date', (findDates('2020 June 21') !== null), true);
  eq('findDates: "3/14/24" (two-digit year) is a date', (findDates('3/14/24') !== null), true);
  eq('findDates: "06/21/2020" (month-day-year slash) is a date',  (findDates('06/21/2020') !== null), true);
  eq('findDates: "21 June 2020" (day-month-year, named month) is a date', (findDates('21 June 2020') !== null), true);
})();

// ---------------------------------------------------------------------------
// Boundary semantics — a date never leaves its own year, decade, or century.
// ---------------------------------------------------------------------------
(function dateRoundBoundarySemantics() {
  eq('boundary: Dec 31, 2029 decade -> 2020', roundDateText('Dec 31, 2029', 'decade'), '2020');
  eq('boundary: Jan 1, 2030 decade -> 2030', roundDateText('Jan 1, 2030', 'decade'), '2030');
  eq('boundary: Dec 31, 2099 century -> 2000', roundDateText('Dec 31, 2099', 'century'), '2000');
})();

// ---------------------------------------------------------------------------
// Sign-aware half-step, value-OoM floor, and a fractional offset above 1 in
// size never returning less than the integer offset nearer zero
// ---------------------------------------------------------------------------
(function halfStepFloorCases() {
  // 27 cases: {87M, 47M, 17M} x {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}
  const cases = [
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
  for (const row of cases) {
    for (const off of offsets) {
      const key = String(off);
      eq(`half-step cases: roundWithOffset(${row.v}, ${off}) returns ${row.expected[key]}`,
        roundWithOffset(row.v, off), row.expected[key]);
    }
  }

  eq('half-step cases: -87054321 at -0.5 returns -85000000',
    roundWithOffset(-87054321, -0.5), -85000000);
  eq('half-step cases: 0 at 1.5 returns 0',
    roundWithOffset(0, 1.5), 0);
})();

(function quarterStepCases() {
  // stepForOffset (lib/dr-number/rounding.js) holds the step for a fractional
  // offset. Quarter-step spot checks across 87M / 47M / 17M.
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
    eq(`quarter-step cases: roundWithOffset(${v}, ${off}) returns ${expected}`,
      roundWithOffset(v, off), expected);
  }
})();

(function halfStepMonotonicity() {
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
  // Eval rounding.js with X_FLOOR_THRESHOLD = 0 to confirm the x-floor gates
  // on the constant. The patched source runs in a sandbox so its
  // declarations do not replace the live extension globals.
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  if (roundingSrc === null) {
    eq('x-floor flip: source files present in manifest', false, true);
    return;
  }
  const patchedRounding = roundingSrc.replace(
    /const X_FLOOR_THRESHOLD = 1;/,
    'const X_FLOOR_THRESHOLD = 0;'
  );
  eq('x-floor flip: source contains X_FLOOR_THRESHOLD declaration',
    patchedRounding.includes('const X_FLOOR_THRESHOLD = 0;'), true);

  const sandbox = {};
  const vm = require('vm');
  const ctx = vm.createContext(sandbox);
  vm.runInContext(patchedRounding + '\nthis.__roundWithOffset = roundWithOffset;', ctx);
  const patchedRound = sandbox.__roundWithOffset;

  eq('x-floor flip: rd(17054321, 0.5) === 20000000 with X_FLOOR_THRESHOLD=0',
    patchedRound(17054321, 0.5), 20000000);
})();

// ---------------------------------------------------------------------------
// findDates with words and marks beside the date
// ---------------------------------------------------------------------------

(function findDates_wordsAndMarksBesideTheDate() {
  eq('findDates: "2020-03-14 sales" is a date',
    (findDates('2020-03-14 sales') !== null), true);

  eq('findDates: "March 14, 2024¹" is a date',
    (findDates('March 14, 2024¹') !== null), true);

  eq('findDates: "Jun 1st, 2020" is a date',
    (findDates('Jun 1st, 2020') !== null), true);

  eq('findDates: "21st June 2020" is a date',
    (findDates('21st June 2020') !== null), true);

  eq('findDates: "Sales: 2020" is no date',
    (findDates('Sales: 2020') !== null), false);

  eq('findDates: "$2,020.00" is no date',
    (findDates('$2,020.00') !== null), false);

  eq('findDates: "version 2020.1.3" is no date',
    (findDates('version 2020.1.3') !== null), false);

  eq('findDates: multiple superscripts "March 14, 2024¹²" is a date',
    (findDates('March 14, 2024¹²') !== null), true);

  eq('findDates: footnote asterisk "March 14, 2024*" is a date',
    (findDates('March 14, 2024*') !== null), true);

  eq('findDates: footnote dagger "March 14, 2024†" is a date',
    (findDates('March 14, 2024†') !== null), true);

  eq('findDates: leading label "Date: 2020-03-14" is a date',
    (findDates('Date: 2020-03-14') !== null), true);

  eq('findDates: "June 1st 2020" is a date',
    (findDates('June 1st 2020') !== null), true);

  eq('findDates: bare-year strict "Q4 2020" is no date',
    (findDates('Q4 2020') !== null), false);

  eq('findDates: bare-year strict "2020 revenue" is no date',
    (findDates('2020 revenue') !== null), false);

  eq('findDates: whitespace only "   " is no date',
    (findDates('   ') !== null), false);
})();

// ---------------------------------------------------------------------------
// First-column exclusion and the switch defaults
// ---------------------------------------------------------------------------

(function firstColumnExclusionAndSwitchDefaults() {

  // -------------------------------------------------------------------------
  // simplifyFirstColumn polarity — mirror of the first-row case.
  // -------------------------------------------------------------------------

  eq('simplifyFirstColumn: true + col 0 → null (col IS simplified)',
    getExclusionReason(0, { simplifyFirstColumn: true, simplifyFirstRow: true }, 1), null);

  eq('simplifyFirstColumn: unset + col 0 → "first-column"',
    getExclusionReason(0, { simplifyFirstRow: true }, 1), 'first-column');

  // -------------------------------------------------------------------------
  // DR_DEFAULTS snapshot — the six switch defaults.
  // -------------------------------------------------------------------------
  eq('DR_DEFAULTS: simplifyMixedCurrency = true',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('DR_DEFAULTS: simplifyMixedPercent = true',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('DR_DEFAULTS: simplifyDates = true',
    DR_DEFAULTS.simplifyDates, true);
  eq('DR_DEFAULTS: simplifyTimes = false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('DR_DEFAULTS: simplifyFirstRow = false',
    DR_DEFAULTS.simplifyFirstRow, false);
  eq('DR_DEFAULTS: simplifyFirstColumn = false',
    DR_DEFAULTS.simplifyFirstColumn, false);
})();

// --- Unit numbers, currency codes, identifier shapes, and currency signs ---

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

(function currencyCodes_holdANumberWithCurrencyOff() {
  eq('currency code: "CAD45.67m" holds its number with currency off',
    classifyAt('CAD45.67m', LADDER_OPTS_CURRENCY_OFF).stretches, []);
  eq('currency code: "CADENCE 12" rounds its number with currency off',
    stretchTexts('CADENCE 12', classifyAt('CADENCE 12', LADDER_OPTS_CURRENCY_OFF)), ['12']);
  eq('currency code: "usd 12" rounds its number with currency off',
    stretchTexts('usd 12', classifyAt('usd 12', LADDER_OPTS_CURRENCY_OFF)), ['12']);
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
    '1 '.repeat(50000) + 'x',
    '416-555-1234' + ' '.repeat(100000) + 'x',
    '0'.repeat(100000) + '.1',
  ];
  const started = Date.now();
  for (const text of texts) getIdentifierMaskedRanges(text);
  eq('identifier shape inside text: eleven 100,000-character texts scan in under a second',
    Date.now() - started < 1000, true);
  const wholeCellStarted = Date.now();
  matchIdentifierShape('ISBN' + ' '.repeat(100000) + 'x');
  eq('identifier shape: a 100,000-character cell after "ISBN" tests in under a second',
    Date.now() - wholeCellStarted < 1000, true);
})();

// In a cell that holds many numbers, each leading-zero run that stands alone
// is a code, each one that is a group of a longer number is not, and the
// search for codes runs in time that grows in step with the cell's length.
(function leadingZeroRuns_inALongCell() {
  eq('identifier shape inside text: "a 1,034 b 007 c 1 034 567 d 0012 " three times keeps each "007" and "0012"',
    getIdentifierMaskedRanges('a 1,034 b 007 c 1 034 567 d 0012 '.repeat(3)),
    [0, 33, 66].flatMap((at) => [{ start: at + 10, end: at + 13 }, { start: at + 28, end: at + 32 }]));
  const text = '2021-06-03 '.repeat(9000);
  const started = Date.now();
  const ranges = getIdentifierMaskedRanges(text);
  eq('identifier shape inside text: a 99,000-character cell of 9,000 dates scans in under a second',
    Date.now() - started < 1000, true);
  eq('identifier shape inside text: a cell of 9,000 dates holds 18,000 leading-zero runs',
    ranges.length, 18000);
})();

// With the currency switch off, a cell of many numbers classifies in time
// proportional to its length, and a sign more than 24 characters before a
// number no longer holds it.
(function currencySign_inALongCell() {
  const roundedTexts = (text) => stretchTexts(text, classifyAt(text, LADDER_OPTS_CURRENCY_OFF));
  const text = '$1 - '.repeat(10000);
  const started = Date.now();
  const classification = classifyAt(text, LADDER_OPTS_CURRENCY_OFF);
  eq('currency sign: a 50,000-character cell of 10,000 "$1 - " reads in under a second with currency off',
    Date.now() - started < 1000, true);
  eq('currency sign: a cell of 10,000 "$1 - " holds every number with currency off',
    classification.stretches, []);
  eq('currency sign: "$" and 23 spaces before "12" holds the number with currency off',
    classifyAt('$' + ' '.repeat(23) + '12', LADDER_OPTS_CURRENCY_OFF).stretches, []);
  eq('currency sign: "$" and 24 spaces before "12" rounds the number with currency off',
    roundedTexts('$' + ' '.repeat(24) + '12'), ['12']);
  eq('currency sign: "YEAR" and 23 spaces before "12" rounds the number with currency off',
    roundedTexts('YEAR' + ' '.repeat(23) + '12'), ['12']);
  eq('currency sign: "COUNTRY" and 21 spaces before "12" rounds the number with currency off',
    roundedTexts('COUNTRY' + ' '.repeat(21) + '12'), ['12']);
  eq('currency sign: "ZUSD" and 21 spaces before "12" rounds the number with currency off',
    roundedTexts('ZUSD' + ' '.repeat(21) + '12'), ['12']);
  eq('currency sign: "INDUSTRY 1,234,567,890.123 – 15" rounds both numbers with currency off',
    roundedTexts('INDUSTRY 1,234,567,890.123 – 15'), ['1,234,567,890.123', '15']);
  eq('currency sign: "12 - 18,000,000,000,000 USD" holds both numbers with currency off',
    roundedTexts('12 - 18,000,000,000,000 USD'), []);
  eq('currency sign: "12", 30 spaces, and "- 18 USD" holds both numbers with currency off',
    roundedTexts('12' + ' '.repeat(30) + '- 18 USD'), []);
})();

// --- Shared rounding case table (js/round-dynamic-cases.json) ---
// js/tests.js and python/tests/ run the same table, so Python's own copy of
// the rounding stays in agreement with the shared library files.
(function sharedCaseTable() {
  const sharedCaseGroups = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'round-dynamic-cases.json'), 'utf8')
  );

  // A case with no offset or top-band count runs at the extension's own
  // defaults, so the table also checks that those match the other copies.
  const SHARED_DEFAULT_OFFSET = DR_DEFAULTS.offsetTop;
  const SHARED_DEFAULT_NUM_TOP = DR_DEFAULTS.numTop;

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
        const actual = input.map((v, i) => (nums[i] === null ? v : roundValueSetAware(nums[i], maxMag, oTop, oOther, nTop)));
        eq(name, actual, expected);
      } else {
        const offset = params.offset_top === undefined ? SHARED_DEFAULT_OFFSET : params.offset_top;
        const num = toNumber(input);
        const actual = num === null ? input : roundWithOffset(num, offset);
        eq(name, actual, expected);
      }
    }
  }
})();

// =============================================================================
// One currency list
// =============================================================================
// Every currency rule reads CURRENCIES in lib/dr-number/reader.js. These
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

  // Every code the list names is a currency code, so the currency switch and
  // the unit-number reader both read it.
  for (const { name, code } of CURRENCIES) {
    eq('currencies: the code ' + code + ' (' + name + ') holds "450 ' + code + '" with the currency setting off',
      classifyAt('450 ' + code, LADDER_OPTS_CURRENCY_OFF).stretches, []);
  }

  // The data test reads a cell through the number reader, so a table whose
  // only number carries any sign the reader strips is a data table.
  for (const sign of CURRENCY_SIGNS) {
    eq('currencies: the data test passes a table whose only number is "' + sign + '450"',
      isDataTable(makeIsDataTable([['Item', 'Price'], ['Box', sign + '450']])), true);
  }

  // The number span steps past every sign, so a cell that draws its sign in
  // one piece and its digits in another still simplifies.
  for (const sign of CURRENCY_SIGNS) {
    const classification = classifyCell({ text: sign + '450', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS);
    eq('currencies: a cell drawn as "' + sign + '" beside "450" keeps its number',
      placeClassification(classification, { original: [sign, '450'], toFlat: null }).stretches,
      [expectedNumberStretch(sign.length, '450', 450)]);
  }
})();

(function currencies_roundingKeepsTheSign() {
  // The pure number span steps past every sign the one list names, so a cell
  // marked with any listed currency keeps its sign.
  for (const { name, signs } of CURRENCIES) {
    for (const sign of signs) {
      eq('currencies: rounding keeps "' + sign + '" (' + name + ')',
        writePureCell(500, sign + '450'), sign + '500');
    }
  }
  eq('currencies: a sign after the digits stays after them',
    writePureCell(500, '450 kr'), '500 kr');
  eq('currencies: a sign before the digits keeps its space',
    writePureCell(500, '\u20b9 450'), '\u20b9 500');
  eq('currencies: a letter that only looks like a sign stays inside the span',
    writePureCell(500, 'Revenue 450'), '500');
  eq('currencies: an accounting negative keeps its brackets and its sign',
    writePureCell(-500, '($450)'), '($500)');
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
  eq('currencies: "R45" reads as 45', toNumber('R45'), 45);
  eq('currencies: "kr 45" reads as 45', toNumber('kr 45'), 45);
  eq('currencies: "Fr45" reads as 45', toNumber('Fr45'), 45);
  eq('currencies: "EC$45" reads as 45', toNumber('EC$45'), 45);
  eq('currencies: a picture sign after the digits reads ("45€")', toNumber('45€'), 45);
  eq('currencies: a picture sign with a letter left beside it does not read ("a€45")',
    toNumber('a€45'), null);

  // A capital R inside a word is no currency sign, so with the setting off
  // the number beside it still rounds.
  eq('currencies: "Revenue 45" rounds its number with currency off',
    stretchTexts('Revenue 45', classifyAt('Revenue 45', LADDER_OPTS_CURRENCY_OFF)), ['45']);
  eq('currencies: "Fresh 45" rounds its number with currency off',
    stretchTexts('Fresh 45', classifyAt('Fresh 45', LADDER_OPTS_CURRENCY_OFF)), ['45']);
  eq('currencies: "R 45" holds its number with currency off',
    classifyAt('R 45', LADDER_OPTS_CURRENCY_OFF).stretches, []);
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

eq('bracketed: "(1,234)" is a bracketed number and "(see 4)" is not',
  [isBracketedNegative('(1,234)', 1, '1,234'), isBracketedNegative('(see 4)', 5, '4')],
  [true, false]);

eq('bracketed: the bracket span of "($ 1,234 %)" covers both brackets and the format marks',
  bracketSignSpan('Loss ($ 1,234 %) net', 8, '1,234'), { start: 5, end: 16 });

eq('bracketed: "1) Revenue (2,500)" reads 1 as positive and 2,500 as negative',
  extractNumbersInText('1) Revenue (2,500)').map((m) => m.num), [1, -2500]);

eq('bracketed: "(kr 1,234)", "(EC$1,234)" and "(F.CFA 1,234)" each read as -1,234',
  ['(kr 1,234)', '(EC$1,234)', '(F.CFA 1,234)'].map((t) => extractNumbersInText(t).map((m) => m.num)),
  [[-1234], [-1234], [-1234]]);

// A cell that holds many opening brackets reads in time that grows in step
// with its length, and a bracket pair in it still stands as a minus sign.
(function bracketsInALongCell() {
  const text = '(a 1 '.repeat(40000) + '(2)';
  const started = Date.now();
  const numbers = extractNumbersInText(text);
  eq('bracketed: a 200,000-character cell of 40,000 opening brackets reads in under a second',
    Date.now() - started < 1000, true);
  eq('bracketed: in that cell the last number alone is negative',
    [numbers.length, numbers.filter((m) => m.num < 0).map((m) => m.numStr)], [40001, ['2']]);
})();

// --- The whole-text match ---

eq('bracketed: a bracket pair holding more than the number is not a whole-text match',
  [
    matchBracketedNumber('(see note 4)'),
    matchBracketedNumber('(1,234) (5,678)'),
    matchBracketedNumber('USD (1,234)'),
  ],
  [null, null, null]);

// --- Decimal comma: strict US reading ---
// The number format function returns the marks a number uses, US style.
// The number shape test accepts a group mark only in the group shape and
// only before the decimal mark. A run with no group mark goes to the
// conversion, and a run with a second dot gives no number there.

eq('number format function: returns the US marks',
  numberFormat(), { group: ',', decimal: '.' });

(function decimalComma_numberShapeTest() {
  const marks = numberFormat();
  const rows = [
    ['1,234', true], ['1,234.56', true], ['1234.5', true], ['0.125', true],
    ['12,345,678', true], ['-1,234', true], ['+1,234', true], ['1234', true],
    ['13,63', false], ['987,5', false], ['1,0845', false], ['1,234,56', false],
    ['1.234,56', false], ['12,34,567', false], [',123', false], ['1,234.5,6', false],
    ['-13,63', false],
  ];
  for (const [run, expected] of rows) {
    eq('number shape test: "' + run + '" ' + (expected ? 'passes' : 'fails'),
      isNumberShape(run, marks), expected);
  }
})();

(function decimalComma_numberReaderTable() {
  const rows = [
    ['1,234', 1234], ['1,234.56', 1234.56], ['1234.5', 1234.5], ['0.125', 0.125],
    ['13,63', null], ['987,5', null], ['1,0845', null], ['1,234,56', null],
    ['1.234,56', null], ['1.234.567', null], ['12.03.2024', null],
    ['-1,234', -1234], ['−1,234', -1234], ['-13,63', null],
    ['(13,63)', null],
    ['1,234%', 1234], ['12.5%', 12.5], ['13,63%', null],
  ];
  for (const [text, expected] of rows) {
    eq('number reader: "' + text + '" reads as ' + (expected === null ? 'no number' : expected),
      toNumber(text), expected);
  }
})();

eq('number reader: the capture values in European style read as no number',
  ['13,63€', '5,16€', '2,37€', '1.234,56 €', '1 234,56'].map(toNumber),
  [null, null, null, null, null]);

eq('number reader: "1,234", "€1,234.56" and "0.125" read as 1234, 1234.56 and 0.125',
  ['1,234', '€1,234.56', '0.125'].map(toNumber),
  [1234, 1234.56, 0.125]);

// Inside text, the digit run takes every comma and dot between digits, so
// the number shape test tests the whole run. A pattern that stopped at the
// first dot would take "1.234" from "1.234,56" and "12.03" from "12.03.2024".
eq('decimal comma in text: "13,63€ (includes 2,37€ VAT)" holds no number',
  extractNumbersInText('13,63€ (includes 2,37€ VAT)'), []);

eq('decimal comma in text: "Total: 1.234,56 €" holds no number',
  extractNumbersInText('Total: 1.234,56 €'), []);

eq('decimal comma in text: a dotted date "on 12.03.2024 we" holds no number',
  extractNumbersInText('on 12.03.2024 we'), []);

eq('decimal comma in text: a dotted version "1.2.3" holds no number',
  extractNumbersInText('version 1.2.3 ships'), []);

eq('decimal comma in text: "up 1,234.56 units" holds the number 1,234.56',
  extractNumbersInText('up 1,234.56 units'),
  [{ numStr: '1,234.56', num: 1234.56, index: 3 }]);

eq('decimal comma in text: a sentence\'s final period stays outside the run',
  extractNumbersInText('total 9,850.').map((m) => m.numStr), ['9,850']);

eq('decimal comma: "1.234,56 EUR" is not a unit number',
  matchUnitNumber('1.234,56 EUR'), null);

eq('decimal comma: "1,234.56 EUR" is a unit number',
  matchUnitNumber('1,234.56 EUR'), { numStr: '1,234.56', num: 1234.56, index: 0 });

(function decimalComma_ladderLeavesTheCellAsWritten() {
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  eq('decimal comma: every European-style cell holds no stretch',
    ['13,63€', '5,16 €', '1.234,56 €', '0,75', '987,5',
      '14,37€ (includes 2,49€ VAT)'].map((text) => classifyAt(text, opts).stretches),
    [[], [], [], [], [], []]);
  eq('decimal comma: "1,234.56" and "0.125" each hold one number stretch',
    ['1,234.56', '0.125'].map((text) => classifyAt(text, opts).stretches),
    [[expectedNumberStretch(0, '1,234.56', 1234.56)], [expectedNumberStretch(0, '0.125', 0.125)]]);
})();

// --- Whitespace as a group mark ---
// Whitespace between two digits is a group mark, and the number shape test
// tests it as it tests a comma: only in the group shape. The in-text pattern
// takes a space-grouped run whole, so a pure cell and a number inside words
// read alike, and the spaced-digit identifier shape keeps its own test.

(function groupSpace_numberShapeTest() {
  const marks = numberFormat();
  const rows = [
    ['1 234', true], ['1 034 567', true], ['1 234 567 890', true], ['1 234.56', true],
    ['-1 234', true],
    ['12 34', false], ['1 2345', false], ['1234 567', false], ['1 234,56', false],
    ['1,234 567', false], ['1 234.5 6', false],
  ];
  for (const [run, expected] of rows) {
    eq('number shape test: "' + run + '" ' + (expected ? 'passes' : 'fails'),
      isNumberShape(run, marks), expected);
  }
})();

(function groupSpace_numberReader() {
  const rows = [
    ['1 034 567', 1034567], ['1 234.56', 1234.56], ['$ 1 234', 1234], ['(1 234)', -1234],
    ['1 234 %', 1234], ['-1 234', -1234], ['−1 234', -1234],
    ['12 34', null], ['1 2345', null], ['2024 12', null], ['1 234,56', null],
  ];
  for (const [text, expected] of rows) {
    eq('number reader: "' + text + '" reads as ' + (expected === null ? 'no number' : expected),
      toNumber(text), expected);
  }
  eq('number reader: "1 034 567" with narrow no-break spaces reads as 1034567',
    toNumber('1\u202f034\u202f567'), 1034567);
  eq('number reader: "1 234" with a no-break space reads as 1234',
    toNumber('1\u00a0234'), 1234);
})();

eq('number reader: "125" above "126", and "1" above "234", read as no number',
  ['125\n126', '1\n234'].map(toNumber), [null, null]);

eq('group space in text: a space-grouped number is one run',
  extractNumbersInText('Revenue 1 034 567 units'),
  [{ numStr: '1 034 567', num: 1034567, index: 8 }]);

eq('group space in text: a short pair in the group shape is one run',
  numStrs('sold 12 345 units'), ['12 345']);

eq('group space in text: a decimal part stays with the run',
  numStrs('Budget 1 234 567.50 total'), ['1 234 567.50']);

eq('group space in text: a negative keeps its sign',
  extractNumbersInText('down -1 200 units').map((m) => m.num), [-1200]);

eq('group space in text: narrow no-break spaces group the run',
  numStrs('Budget 1 034 567 total'), ['1 034 567']);

eq('group space in text: a chain outside the group shape stays several numbers',
  numStrs('Call 416 555 1234 now'), ['416', '555', '1234']);

eq('group space in text: a year before a count stays two numbers',
  numStrs('In 2024 12 stores opened'), ['2024', '12']);

eq('group space in text: a last group of four digits breaks the chain',
  numStrs('1 234 5678'), ['1', '234', '5678']);

eq('group space in text: a first group of four digits breaks the chain',
  numStrs('In 2024 12 345 stores'), ['2024', '12', '345']);

eq('group space in text: a middle group of two digits breaks the chain',
  numStrs('12 34 567'), ['12', '34', '567']);

eq('group space in text: a decimal comma after a spaced run holds no number',
  extractNumbersInText('Total 1 234,56 €'), []);

// A space-grouped price with a decimal comma is one run with a comma outside
// the group shape, so no group of it rounds on its own (#491).
eq('group space: "12 345,67 €" holds no number, alone and inside words',
  [extractNumbersInText('12 345,67 €'), extractNumbersInText('Total: 12 345,67 €'), toNumber('12 345,67 €')],
  [[], [], null]);

eq('group space: "1 234 USD" is a unit number',
  matchUnitNumber('1 234 USD'), { numStr: '1 234', num: 1234, index: 0 });

(function groupSpace_cellReadsAlikeAloneAndInsideWords() {
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  const texts = (text) => stretchTexts(text, classifyAt(text, opts));
  eq('group space: a pure cell "1 034 567" reads as one number',
    classifyAt('1 034 567', opts), { stretches: [expectedNumberStretch(0, '1 034 567', 1034567)] });
  eq('group space: "Revenue 1 034 567 units" rounds the same one number',
    classifyAt('Revenue 1 034 567 units', opts).stretches.map((s) => s.num), [1034567]);
  eq('group space: a three-digit group with a leading zero is a group, not a code',
    texts('Revenue 1 034 567 units'), ['1 034 567']);
  eq('group space: a leading-zero run after a lone digit is still a code',
    texts('Form 1 0345 holds 918,554 units'), ['1', '918,554']);
  eq('group space: a leading-zero code alone in text still holds',
    texts('Ship to 02134, 440,193 parcels'), ['440,193']);
})();

// A line break is no group mark: the digits sit on two lines, which read as
// two numbers. The same reader serves the Sheets library.
(function groupSpace_aLineBreakSeparatesTwoNumbers() {
  const matchesOf = (text) => extractNumbersInText(text).map((m) => m.numStr);
  eq('line break: "Revenue 1 234\\n567 units" holds two numbers', matchesOf('Revenue 1 234\n567 units'), ['1 234', '567']);
  eq('line break: "125\\n126" holds two numbers', matchesOf('125\n126'), ['125', '126']);
  eq('line break: "1500\\n1600" holds two numbers', matchesOf('1500\n1600'), ['1500', '1600']);
  eq('line break: "1 234 567" on one line holds one number', matchesOf('1 234 567'), ['1 234 567']);
})();

// --- One write-back path ---
// Every number is patched in place, digits only, grouped with the marks the
// number format function returns. A pure cell's number span leaves out its
// leading format marks and sign characters and its trailing format marks,
// so those stay where the page put them.

eq('write-back: a number with no group mark comes back grouped',
  formatNumber(10000, '12345'), '10,000');

eq('write-back: a space-grouped original comes back with commas',
  formatNumber(1000000, '1 234 567'), '1,000,000');

eq('write-back: trailing zeros go',
  formatNumber(35, '35.0'), '35');

eq('write-back: a whole result from a whole original writes no decimals',
  formatNumber(12, '12'), '12');

eq('write-back: a result writes its own decimals, not the original\'s count',
  formatNumber(1.5, '1.234'), '1.5');

eq('write-back: a result keeps every decimal it holds',
  formatNumber(1.75, '1.72'), '1.75');

eq('write-back: a negative whose original holds no minus sign writes none',
  formatNumber(-1000, '1,234'), '1,000');

eq('write-back: a written minus sign stays',
  formatNumber(-1000, '-1,234'), '-1,000');

eq('pure number span: a currency sign stays outside the span',
  pureNumberSpan('$12345'), { numStr: '12345', index: 1 });

eq('pure number span: a currency sign, its gap, and the cell\'s whitespace stay outside',
  pureNumberSpan('  $ 1,234 '), { numStr: '1,234', index: 4 });

eq('pure number span: a plus and a percent sign stay outside',
  pureNumberSpan('+5%'), { numStr: '5', index: 1 });

eq('pure number span: a dash minus sign stays outside',
  pureNumberSpan('−1,234'), { numStr: '1,234', index: 1 });

eq('pure number span: a bracket pair stays outside',
  pureNumberSpan('(1 234)'), { numStr: '1 234', index: 1 });

eq('pure number span: a sign after the digits stays outside',
  pureNumberSpan('450 kr'), { numStr: '450', index: 0 });

eq('pure number span: space-grouped digits form one span',
  pureNumberSpan('1 234 567'), { numStr: '1 234 567', index: 0 });
