// The per-cell classification ladder (lib/dr-simplify).

(function classifyCell_outOfRange() {
  const ranges = [{ colMin: 5, colMax: 10, rowMin: 0, rowMax: 100 }];
  eq('classifyCell: "100" outside the range expression holds no stretch',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges }, LADDER_OPTS),
    { stretches: [] });
  eq('classifyCell: "100" inside the range expression holds one number stretch',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 6, ranges }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '100', 100)] });
})();

(function classifyCell_firstRow() {
  eq('classifyCell: "100" in the first row holds no stretch when simplifyFirstRow is false',
    classifyCell({ text: '100', rowIndex: 0, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
  eq('classifyCell: "100" in the first row holds one number stretch when simplifyFirstRow is true',
    classifyCell({ text: '100', rowIndex: 0, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyFirstRow: true })),
    { stretches: [expectedNumberStretch(0, '100', 100)] });
})();

(function classifyCell_firstColumn() {
  eq('classifyCell: "100" in the first column holds no stretch when simplifyFirstColumn is false',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges: null }, LADDER_OPTS),
    { stretches: [] });
  eq('classifyCell: "100" in the first column holds one number stretch when simplifyFirstColumn is true',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyFirstColumn: true })),
    { stretches: [expectedNumberStretch(0, '100', 100)] });
})();

(function classifyCell_percent() {
  eq('classifyCell: "50%" holds one number stretch over "50" when simplifyMixedPercent is true',
    classifyCell({ text: '50%', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '50', 50)] });
  eq('classifyCell: "50%" holds no stretch when simplifyMixedPercent is false',
    classifyCell({ text: '50%', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedPercent: false })),
    { stretches: [] });
})();

(function classifyCell_currency() {
  eq('classifyCell: "$100" holds one number stretch over "100" when simplifyMixedCurrency is true',
    classifyCell({ text: '$100', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(1, '100', 100)] });
  eq('classifyCell: "$100" holds no stretch when simplifyMixedCurrency is false',
    classifyCell({ text: '$100', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false })),
    { stretches: [] });
})();

(function classifyCell_unknownExclusionFailsClosed() {
  // getExclusionReason today only ever returns 'first-row' | 'first-column' |
  // null, but classifyCell's ladder must fail
  // closed (no stretch) on any other non-null value a future exclusion rule
  // returns, instead of silently falling through and simplifying the cell.
  // classifyCell calls getExclusionReason as a bare same-scope identifier
  // (not through an overridable namespace), so the override has to live in
  // its own isolated scope built from the same three source files, with a
  // stub getExclusionReason declared after the real one (last declaration
  // of a name wins in the same scope).
  const isolatedSrc = readerCode + '\n' + numberTextCode + '\n' +
    'function getExclusionReason() { return "someFutureReason"; }\n' +
    ladderCode + '\nreturn classifyCell;';
  const isolatedClassifyCell = isolatedFunction(isolatedSrc)();
  eq('classifyCell: "100" under an unrecognized exclusion holds no stretch',
    isolatedClassifyCell({ text: '100', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
})();

(function classifyCell_quoted() {
  eq('classifyCell: "\\"12345\\"" holds no stretch',
    classifyCell({ text: '"12345"', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
  eq('classifyCell: "12345" with no quotes holds one number stretch',
    classifyCell({ text: '12345', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '12345', 12345)] });
})();

(function classifyCell_dates() {
  eq('classifyCell: "2020-01-01" holds no stretch when simplifyDates is false',
    classifyCell({ text: '2020-01-01', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyDates: false })),
    { stretches: [] });
  eq('classifyCell: "2020-01-01" holds one date stretch with its month and day when simplifyDates is true',
    classifyCell({ text: '2020-01-01', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [{
      kind: 'date', year: 2020, month: 1, monthBeforeYear: false, start: 0, end: 10, dayCut: { start: 7, end: 10 } }] });
  eq('classifyCell: "03/04/2020" holds one ambiguous date stretch with both numbers unread',
    classifyCell({ text: '03/04/2020', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [{
      kind: 'date', year: 2020, n1: 3, n2: 4, start: 0, end: 10, n1Cut: { start: 0, end: 3 }, n2Cut: { start: 3, end: 6 } }] });
  eq('classifyCell: "2020-13-45", a date that cannot exist, holds no stretch',
    classifyCell({ text: '2020-13-45', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
})();

(function classifyCell_times() {
  eq('classifyCell: "3:45 PM" holds no stretch when simplifyTimes is false',
    classifyCell({ text: '3:45 PM', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
  eq('classifyCell: "3:45 PM" holds one time stretch over the whole text when simplifyTimes is true',
    classifyCell({ text: '3:45 PM', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyTimes: true })),
    { stretches: [{
      kind: 'time', start: 0, end: 7, hourText: '3', hour: 3, minute: 45, second: 0, meridiem: ' PM' }] });
  // An impossible time stays as written, like an impossible date, so a
  // timestamp's digits never round as plain numbers. Its date still follows
  // the Dates switch.
  const timesOn = Object.assign({}, LADDER_OPTS, { simplifyTimes: true });
  eq('classifyCell: a cell holding an impossible time holds no time or number stretch',
    ['24:00', '10:00:75', '0:30 AM', '2025-01-01T10:00:60', '2025-11-26T24:00'].map((text) =>
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, timesOn).stretches.map((s) => s.kind)),
    [[], [], [], ['date'], ['date']]);
  eq('classifyCell: "2025-11-26T24:00" holds one date stretch over the date and the "T" when simplifyTimes is false',
    classifyCell({ text: '2025-11-26T24:00', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [{ kind: 'date', year: 2025, month: 11, monthBeforeYear: false, start: 0, end: 11,
      dayCut: { start: 7, end: 10 }, separator: { start: 10, end: 11 } }] });
})();

(function classifyCell_markup() {
  const whole = [{ start: 0, end: 2 }];
  eq('classifyCell: "42" whose number is a markup range holds no stretch',
    classifyCell({ text: '42', rowIndex: 1, columnIndex: 1, ranges: null, markupRanges: whole }, LADDER_OPTS),
    { stretches: [] });
  eq('classifyCell: "42" with no markup range holds one number stretch',
    classifyCell({ text: '42', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '42', 42)] });
  const twoNumbers = 'see 9,876,543 and 4,236,000';
  eq('classifyCell: "see 9,876,543 and 4,236,000" with the first number in a markup range holds a stretch over the second alone',
    stretchTexts(twoNumbers, classifyCell({ text: twoNumbers, rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 4, end: 13 }] }, LADDER_OPTS)),
    ['4,236,000']);
  eq('classifyCell: a cell whose every number sits in markup ranges holds no stretch',
    classifyCell({ text: '[1,234,567](https://x.test)', rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 0, end: 27 }] }, LADDER_OPTS),
    { stretches: [] });
  const dateOpts = Object.assign({}, LADDER_OPTS, { simplifyDates: true, simplifyTimes: true });
  eq('classifyCell: "2024-01-15" inside a markup range holds no stretch',
    classifyCell({ text: '2024-01-15', rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 0, end: 10 }] }, dateOpts), { stretches: [] });
  eq('classifyCell: " 14:30 " with the time inside a markup range holds no stretch',
    classifyCell({ text: ' 14:30 ', rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 1, end: 6 }] }, dateOpts), { stretches: [] });
  eq('classifyCell: " x 2023-01-01 then 2024-03-15" with the first date in a markup range holds one date stretch at 19 to 29',
    classifyCell({ text: ' x 2023-01-01 then 2024-03-15', rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 3, end: 13 }] }, dateOpts).stretches.map((s) => [s.kind, s.start, s.end]),
    [['date', 19, 29]]);
  eq('classifyCell: "Jan 15, 2024" with "Jan 15" in a markup range holds no stretch',
    classifyCell({ text: 'Jan 15, 2024', rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 0, end: 6 }] }, dateOpts), { stretches: [] });
  eq('classifyCell: "2023-01-01 2024" with the first date in a markup range holds one date stretch over the year 2024',
    classifyCell({ text: '2023-01-01 2024', rowIndex: 1, columnIndex: 1, ranges: null,
      markupRanges: [{ start: 0, end: 10 }] }, dateOpts).stretches.map((s) => [s.kind, s.year, s.start]),
    [['date', 2024, 11]]);
  eq('classifyCell: a superscript cell inside a markup range holds no stretch',
    classifyCell({ text: '1012', rowIndex: 1, columnIndex: 1, ranges: null, hasSuperscript: true,
      superscriptRanges: [{ start: 2, end: 4 }], markupRanges: [{ start: 0, end: 4 }] }, LADDER_OPTS),
    { stretches: [] });
})();

(function classifyCell_superscript() {
  // "10<sup>12</sup>" flattens to "1012"; the sole match spans the whole
  // string and overlaps the superscript mask, so nothing survives.
  eq('classifyCell: "1012" with "12" in a superscript holds no stretch',
    classifyCell({
      text: '1012', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 2, end: 4 }],
    }, LADDER_OPTS),
    { stretches: [] });

  // "20 <sup>15</sup>" flattens to "20 1015": the standalone "20" survives
  // masking even though the sup-adjacent "1015" match does not. "20 1015" is
  // not one number, since its spaced groups are outside the group shape.
  eq('classifyCell: "20 1015" with "15" in a superscript holds one number stretch over "20"',
    classifyCell({
      text: '20 1015', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 5, end: 7 }],
    }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '20', 20)] });

  // "5 %<sup>1</sup>" flattens to "5 %1", which the number reader reads as
  // one number; the "5" survives the mask over the footnote marker.
  eq('classifyCell: "5 %1" with "1" in a superscript holds one number stretch over "5"',
    classifyCell({
      text: '5 %1', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 3, end: 4 }],
    }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '5', 5)] });
})();

(function classifyCell_mixedText() {
  eq('classifyCell: "Revenue 500 units" holds one number stretch over "500"',
    classifyCell({ text: 'Revenue 500 units', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [expectedNumberStretch(8, '500', 500)] });
  eq('classifyCell: "Kalki 2898 AD and 500 more" holds a number stretch for 500 alone',
    classifyCell({ text: 'Kalki 2898 AD and 500 more', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)
      .stretches.map((s) => s.num),
    [500]);
  const quoted = 'Product "42" ships in 10 days';
  eq('classifyCell: "Product \\"42\\" ships in 10 days" holds a number stretch over "10" alone',
    stretchTexts(quoted, classifyCell({ text: quoted, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)),
    ['10']);
  eq('classifyCell: "hello world" holds no stretch',
    classifyCell({ text: 'hello world', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
})();

(function classifyCell_unitNumbers() {
  const currencyOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false });
  const at = (text, extra) => Object.assign({ text, rowIndex: 1, columnIndex: 1, ranges: null }, extra || {});
  eq('classifyCell: "4.91tn" holds one number stretch over "4.91"',
    classifyCell(at('4.91tn'), LADDER_OPTS),
    { stretches: [expectedNumberStretch(0, '4.91', 4.91)] });
  eq('classifyCell: "CAD45.67" holds one number stretch over "45.67"',
    classifyCell(at('CAD45.67'), LADDER_OPTS),
    { stretches: [expectedNumberStretch(3, '45.67', 45.67)] });
  eq('classifyCell: "CAD45.67" holds no stretch with the currency setting off',
    classifyCell(at('CAD45.67'), currencyOff), { stretches: [] });
  eq('classifyCell: "45.67 USD" holds no stretch with the currency setting off',
    classifyCell(at('45.67 USD'), currencyOff), { stretches: [] });
  eq('classifyCell: "45.67 USD" holds one number stretch over "45.67" with the currency setting on',
    classifyCell(at('45.67 USD'), LADDER_OPTS), { stretches: [expectedNumberStretch(0, '45.67', 45.67)] });
  eq('classifyCell: "7.5m" inside a markup range holds no stretch',
    classifyCell(at('7.5m', { markupRanges: [{ start: 0, end: 4 }] }), LADDER_OPTS), { stretches: [] });
  eq('classifyCell: "7.5m" with no markup range holds one number stretch over "7.5"',
    classifyCell(at('7.5m'), LADDER_OPTS), { stretches: [expectedNumberStretch(0, '7.5', 7.5)] });
  eq('classifyCell: "DT1234" holds no stretch',
    classifyCell(at('DT1234'), LADDER_OPTS), { stretches: [] });
  eq('classifyCell: "$45.67" holds one number stretch over "45.67"',
    classifyCell(at('$45.67'), LADDER_OPTS), { stretches: [expectedNumberStretch(1, '45.67', 45.67)] });
  // "4.91<sup>1</sup>tn" flattens to "4.911tn": the footnote digit must not
  // join the unit number.
  eq('classifyCell: "4.911tn" with "1" in a superscript holds no stretch',
    classifyCell(at('4.911tn', { hasSuperscript: true, superscriptRanges: [{ start: 4, end: 5 }] }), LADDER_OPTS),
    { stretches: [] });
})();

(function pickDateFormatHint_readsTheColumn() {
  eq('pickDateFormatHint: n1 > 12 only -> day-first', pickDateFormatHint([{ n1: 25, n2: 4 }]), 'day-first');
  eq('pickDateFormatHint: n2 > 12 only -> month-first', pickDateFormatHint([{ n1: 3, n2: 25 }]), 'month-first');
  eq('pickDateFormatHint: both > 12 across the column -> mixed',
    pickDateFormatHint([{ n1: 25, n2: 4 }, { n1: 3, n2: 25 }]), 'mixed');
  eq('pickDateFormatHint: neither > 12 -> ambiguous', pickDateFormatHint([{ n1: 3, n2: 4 }]), 'ambiguous');
})();

// --- Stretch positions and order ---
//
// Each stretch's start and end index the text the ladder classified, leading
// whitespace included, and the stretches come back in text order.

(function classifyCell_stretchesIndexTheUntrimmedText() {
  const dateTimeOpts = Object.assign({}, LADDER_OPTS, { simplifyTimes: true });
  eq('stretch positions: "  12,345" holds one number stretch at 2 to 8',
    classifyAt('  12,345', LADDER_OPTS), { stretches: [expectedNumberStretch(2, '12,345', 12345)] });
  eq('stretch positions: "  Jun 2020" holds one date stretch at 2 to 10',
    classifyAt('  Jun 2020', LADDER_OPTS).stretches.map((s) => [s.kind, s.start, s.end, s.year, s.month]),
    [['date', 2, 10, 2020, 6]]);
  eq('stretch positions: "  14:29" holds one time stretch at 2 to 7',
    classifyAt('  14:29', dateTimeOpts).stretches.map((s) => [s.kind, s.start, s.end]),
    [['time', 2, 7]]);
  eq('stretch positions: " 14:29 " holds one time stretch over "14:29", the trimmed text',
    stretchTexts(' 14:29 ', classifyAt(' 14:29 ', dateTimeOpts)), ['14:29']);
  eq('stretch positions: "  03/04/2020" holds one date stretch whose two number cuts sit after the leading spaces',
    classifyAt('  03/04/2020', LADDER_OPTS).stretches.map((s) => [s.kind, s.start, s.end, s.n1Cut, s.n2Cut]),
    [['date', 2, 12, { start: 2, end: 5 }, { start: 5, end: 8 }]]);
})();

(function classifyCell_stretchesComeInTextOrder() {
  const numbers = '  9 then 1,234 and 56.7 and 8';
  eq('stretch order: "  9 then 1,234 and 56.7 and 8" holds four number stretches in text order',
    classifyAt(numbers, LADDER_OPTS).stretches.map((s) => [s.kind, numbers.slice(s.start, s.end), s.num]),
    [['number', '9', 9], ['number', '1,234', 1234], ['number', '56.7', 56.7], ['number', '8', 8]]);
  const dates = ' 2021-06-30, then 2020-01-15 and Mar 2019';
  eq('stretch order: " 2021-06-30, then 2020-01-15 and Mar 2019" holds three date stretches in text order',
    classifyAt(dates, LADDER_OPTS).stretches.map((s) => [s.kind, dates.slice(s.start, s.end), s.year]),
    [['date', '2021-06-30', 2021], ['date', '2020-01-15', 2020], ['date', 'Mar 2019', 2019]]);
})();

// --- Identifier shapes ---
//
// A cell whose whole text is an identifier shape (a phone number, an IP
// address, a web or email address, an ISBN, a postal code, a digit run with
// a leading zero, or digit groups split by whitespace outside thousands
// grouping) stays as written, and so does one with a currency sign, a sign,
// or brackets around it. The "still rounds" rows pin the near misses each
// shape must leave alone.
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
  ['311@example.com', 'web-or-email-address'],
  ['ISBN 978-0-306-40615-7', 'isbn'],
  ['978-0-306-40615-7', 'isbn'],
  ['ISBN: 0-306-40615-2', 'isbn'],
  ['ISBN 9780306406157', 'isbn'],
  ['M5V 2T6', 'postal-code'],
  ['SW1A 1AA', 'postal-code'],
  ['M1 1AE', 'postal-code'],
  ['90210-1234', 'postal-code'],
  ['$ 4165 5512', 'grouped-digits'],
  ['(978 0 306 40615 7)', 'grouped-digits'],
  ['$978-0-306-40615-7', 'isbn'],
  ['(416-555-1234)', 'phone-number'],
  ['$192.168.0.1', 'ip-address'],
  ['007', 'leading-zero'],
  ['01234', 'leading-zero'],
  ['02134', 'leading-zero'],
  ['0012345678', 'leading-zero'],
  ['-0123', 'leading-zero'],
  ['+007', 'leading-zero'],
  ['\u22120123', 'leading-zero'],
  ['(0123)', 'leading-zero'],
  ['$0123', 'leading-zero'],
];

const IDENTIFIER_NEAR_MISSES = [
  '1 234 567', '12 345.67', '1 234 567', '1 234 567',
  '1 234 567 890', '9 780 306 406 157',
  '100-200', '192.5', '1.5', '90210', '1234567890', '9780306406157',
  '$1,613,245', '4.91tn', 'About 1,613,245 people',
  '$ 1234567890', '(1 234 567)', '$1 234 567', '-1 234 567',
  '0', '0.5', '0.0625', '0123.45', '012,345', '-0.5',
];

(function identifierShapes_matchTheWholeCell() {
  for (const [text, name] of IDENTIFIER_SHAPE_CELLS) {
    eq(`identifier shape: "${text}" matches ${name}`, matchIdentifierShape(text), name);
    eq(`identifier shape: "${text}" holds no stretch`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
      { stretches: [] });
  }
  for (const text of IDENTIFIER_NEAR_MISSES) {
    eq(`identifier shape: "${text}" matches no shape`, matchIdentifierShape(text), null);
    eq(`identifier shape: "${text}" still rounds`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).stretches.length > 0, true);
  }
  eq('identifier shape: "DT1234" matches no shape and holds no stretch',
    [matchIdentifierShape('DT1234'), classifyCell({ text: 'DT1234', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)],
    [null, { stretches: [] }]);
  eq('identifier shape: "21 June 2020" holds one date stretch',
    classifyCell({ text: '21 June 2020', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)
      .stretches.map((s) => s.kind), ['date']);
})();

// --- Identifier shapes inside text ---
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
  ['Account 00012345 holds 1,613,245', ['1,613,245']],
  ['Ref #007 for 918,554 units', ['918,554']],
  ['Ship to 02134, 440,193 parcels', ['440,193']],
  ['Part -0123 for 918,554 units', ['918,554']],
  ['Employee ID 0000123, late again, owes 918,554', ['918,554']],
];

const IDENTIFIER_SPAN_NEAR_MISSES = [
  ['Call 416 555 1234 about 281,745 units', ['416', '555', '1234', '281,745']],
  ['+1 416 555 1234 ordered 281,745', ['1', '416', '555', '1234', '281,745']],
  ['In 2024 12 stores opened', ['2024', '12']],
  ['978-0-306-40615-7 sold 90,114 copies', ['978', '306', '40615', '7', '90,114']],
  ['Call 416-555-12345 about 281,745 units', ['416', '555', '12345', '281,745']],
  ['Range 100-200 of 1,613,245', ['100', '200', '1,613,245']],
  ['Zip 90210 has 93,662 people', ['90210', '93,662']],
  ['Host 192.168.0.1.5 served 12 requests', ['12']],
  ['Sold 1,034,567 units at 0.5 each', ['1,034,567', '0.5']],
  ['Price 0123.45 for 4,567 units', ['0123.45', '4,567']],
  ['Revenue 1 034 567 units', ['1 034 567']],
  ['Sold 12 345 units', ['12 345']],
];

(function identifierShapes_holdTheirDigitsInsideText() {
  const extractedNumbers = (text) => {
    const classification = classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS);
    return classification.stretches.every((s) => s.kind === 'number') ? stretchTexts(text, classification) : classification;
  };
  for (const [text, expected] of IDENTIFIER_SPAN_CELLS) {
    eq(`identifier shape inside text: "${text}" rounds only its quantity`, extractedNumbers(text), expected);
  }
  for (const [text, expected] of IDENTIFIER_SPAN_NEAR_MISSES) {
    eq(`identifier shape inside text: "${text}" rounds every number`, extractedNumbers(text), expected);
  }
  eq('identifier shape inside text: "Call 416-555-1234" matches no whole-cell shape',
    matchIdentifierShape('Call 416-555-1234'), null);
  eq('identifier shape inside text: "Call 416-555-1234" holds no stretch',
    classifyCell({ text: 'Call 416-555-1234', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { stretches: [] });
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

// A number right after "@" belongs to an at-name or an address, in any cell.
(function atNameNumbersNeverRound() {
  for (const text of ['@1234', '@2020vision', '@cherry1234', 'Follow @2020vision on X']) {
    eq(`at-name: "${text}" holds no stretch`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
      { stretches: [] });
  }
  eq('at-name: a count beside an at-name still rounds, and the at-name stays',
    extractNumbersInText('@2020vision has 1,613,245 fans').map((m) => m.numStr), ['1,613,245']);
})();

// A clock time inside text never rounds as a number, whatever the Times
// setting holds, and the cell's other numbers round.
const CLOCK_TIME_SPAN_CELLS = [
  ['9:45 - 11:45 AM', []],
  ['11:45 AM - 1:00 PM', []],
  ['8:00-9:00', []],
  ['Meeting at 11:45 for 1,613,245 holders', ['1,613,245']],
  ['Doors 18:30:15, 2,734 seats', ['2,734']],
  ['Opens 9:15am, 4,821 tickets', ['4,821']],
];

const CLOCK_TIME_SPAN_NEAR_MISSES = [
  ['Ratio 16:9 on 4,821 screens', ['16', '9', '4,821']],
  ['Score 123:45 after 2,734 games', ['123', '45', '2,734']],
];

(function clockTimes_holdTheirDigitsInsideText() {
  const extractedNumbers = (text, opts, extra) => {
    const classification = classifyAt(text, opts, extra);
    return stretchTexts(text, { stretches: classification.stretches.filter((s) => s.kind === 'number') });
  };
  const timesOn = Object.assign({}, LADDER_OPTS, { simplifyTimes: true });
  for (const [text, expected] of CLOCK_TIME_SPAN_CELLS) {
    eq(`clock time inside text: "${text}" rounds only its quantity`, extractedNumbers(text, LADDER_OPTS), expected);
    eq(`clock time inside text: "${text}" rounds the same numbers with Times on`, extractedNumbers(text, timesOn), expected);
  }
  for (const [text, expected] of CLOCK_TIME_SPAN_NEAR_MISSES) {
    eq(`clock time inside text: "${text}" rounds every number`, extractedNumbers(text, LADDER_OPTS), expected);
  }
  eq('clock time inside text: a footnote marker right after a clock time leaves the time whole',
    extractedNumbers('18:302 departs, 1,234 seats', LADDER_OPTS,
      { hasSuperscript: true, superscriptRanges: [{ start: 5, end: 6 }] }),
    ['1,234']);
})();

// =============================================================================
// Bracketed numbers — the accounting minus sign
// =============================================================================
// A bracket pair around a number is that number's minus sign: "(1,234)" is
// -1,234. The brackets are format marks, so the number's own text is its
// digits alone, the digits alone round, and the brackets stay where the page
// put them — including when the page gives a bracket its own text piece.
// =============================================================================

const bracketOpts = Object.assign({}, DR_DEFAULTS, {
  simplifyFirstRow: true,
  simplifyFirstColumn: true,
});

// --- Classification ---

(function bracketedCellClassifiesAsExtracted() {
  eq('bracketed: "(1,234)" holds one number stretch over "1,234" with the value -1234',
    classifyCell({ text: '(1,234)', rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts),
    { stretches: [expectedNumberStretch(1, '1,234', -1234)] });
})();

(function plainNumberKeepsItsSign() {
  eq('bracketed: "1,234" holds one number stretch with the value 1234',
    classifyCell({ text: '1,234', rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts).stretches,
    [expectedNumberStretch(0, '1,234', 1234)]);
})();

(function bracketedWholeLinkStaysUnchanged() {
  eq('bracketed: "(1,234)" that is one markup range holds no stretch',
    classifyCell({ text: '(1,234)', rowIndex: 1, columnIndex: 1, ranges: null, markupRanges: [{ start: 0, end: 7 }] }, bracketOpts),
    { stretches: [] });
})();

(function bracketedQuotedCellStaysUnchanged() {
  eq('bracketed: "\\"(1,234)\\"" holds no stretch',
    classifyCell({ text: '"(1,234)"', rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts),
    { stretches: [] });
})();


// =============================================================================
// Each number, date, and time in a cell follows its own switch
// =============================================================================
//
// Each row runs one column through the ladder, the placement step, and the
// table step, with dates at year, times at hour, and the currency and percent
// switches on, unless the row states other settings.

(function mixedCells_eachValueFollowsItsOwnSwitch() {
  const rows = [
    ['Paid $12,345 on November 09 2026', {}, 'Paid $10,000 on 2026'],
    ['Paid $12,345 on November 09 2026', { simplifyMixedCurrency: false }, 'Paid $12,345 on 2026'],
    ['Paid $12,345 on November 09 2026', { simplifyDates: false }, 'Paid $10,000 on November 09 2026'],
    ['Monday, November 09 2026 at 19:54 UTC', {}, 'Monday, 2026 at 20:00 UTC'],
    ['Meeting at 19:54', {}, 'Meeting at 20:00'],
    ['19:54 — 12,345 units', {}, '20:00 — 10,000 units'],
    ['12:45 - 1:30 PM', {}, '12:45 - 2:00 PM'],
    ['2026-11-09T19:54:00Z', {}, '2026 20:00'],
    ['Deployed 2026-11-09T19:54:00Z, 12,345 users', {}, 'Deployed 2026 20:00, 10,000 users'],
    ['03/04/2026: 12,345', {}, '03/04/2026: 10,000'],
    ['1999-13-45 and Jun 2020, 12,345', {}, '1999-13-45 and 2020, 10,000'],
    ['Sold 5% on Jun 2020', { simplifyMixedPercent: false }, 'Sold 5% on 2020'],
    ['Revenue (USD) 12,345', { simplifyMixedCurrency: false }, 'Revenue (USD) 10,000'],
    ['Lap 3:43.13', {}, 'Lap 3:43.13'],
    ['Meeting at 24:00', {}, 'Meeting at 24:00'],
  ];
  for (const [text, settingsPatch, expected] of rows) {
    const named = Object.keys(settingsPatch).length > 0 ? ` with ${JSON.stringify(settingsPatch)}` : '';
    eq(`mixed cell: "${text}"${named} becomes "${expected}"`, simplifyColumn([text], settingsPatch), [expected]);
  }
})();

(function mixedCells_isoDateTimeResults() {
  // [Dates, Times, value, result]
  const rows = [
    ['year', 'hour', '2026-11-09T19:54:00Z', '2026 20:00'],
    ['year', 'off', '2026-11-09T19:54:00Z', '2026 19:54:00Z'],
    ['month', 'off', '2026-11-09T19:54:00Z', '2026-11 19:54:00Z'],
    ['off', 'hour', '2026-11-09T19:54:00Z', '2026-11-09 20:00'],
    ['off', 'off', '2026-11-09T19:54:00Z', '2026-11-09T19:54:00Z'],
    ['month', 'hour', '2026-11-09T19:54:00Z', '2026-11 20:00'],
    ['quarter', 'minute', '2026-11-09T19:54:00Z', '2026 Q4 19:54'],
    ['decade', 'hour', '2026-11-09T19:54:00Z', '2020 20:00'],
    ['year', 'hour', '2026-11-09T23:45', '2026 23:00'],
    ['year', 'off', '2026-11-09 19:54', '2026 19:54'],
  ];
  for (const [dates, times, text, expected] of rows) {
    const settingsPatch = Object.assign(
      dates === 'off' ? { simplifyDates: false } : { dateGranularity: dates },
      times === 'off' ? { simplifyTimes: false } : { timeGranularity: times });
    eq(`ISO date-time: "${text}" with Dates ${dates} and Times ${times} becomes "${expected}"`,
      simplifyColumn([text], settingsPatch), [expected]);
  }
})();

(function mixedCells_unreadableColumnHoldsItsDates() {
  eq('mixed cell: "03/04/2026: 12,345" and "05/06/2026: 23,456" in one column become "03/04/2026: 10,000" and "05/06/2026: 25,000"',
    simplifyColumn(['03/04/2026: 12,345', '05/06/2026: 23,456'], {}),
    ['03/04/2026: 10,000', '05/06/2026: 25,000']);
  eq('mixed cell: "03/04/2026: 12,345" in a column with "13/04/2026" and "04/13/2026" becomes "03/04/2026: 10,000"',
    simplifyColumn(['03/04/2026: 12,345', '13/04/2026', '04/13/2026'], {}),
    ['03/04/2026: 10,000', '13/04/2026', '04/13/2026']);
})();

(function mixedCells_oneValueCellsGiveTheSameResult() {
  const rows = [
    ['Jun 2020 - Dec 2020', {}, '2020 - 2020'],
    ['2020-07-21', { dateGranularity: 'month' }, '2020-07'],
    ['02134', {}, '02134'],
    ['$1,234', {}, '$1,000'],
    ['Lap 3:43.13', {}, 'Lap 3:43.13'],
    ['Meeting at 24:00', {}, 'Meeting at 24:00'],
  ];
  for (const [text, settingsPatch, expected] of rows) {
    for (const timesPatch of [{}, { simplifyTimes: false }]) {
      const patch = Object.assign({}, settingsPatch, timesPatch);
      const named = Object.keys(patch).length > 0 ? ` with ${JSON.stringify(patch)}` : '';
      eq(`one-value cell: "${text}"${named} becomes "${expected}"`, simplifyColumn([text], patch), [expected]);
    }
  }
})();

(function mixedCells_heldValuesLeaveTheOthers() {
  eq('mixed cell: "9:15 and 12:45 - 1:30 PM, 12,345" becomes "9:15 and 12:45 - 2:00 PM, 10,000"',
    simplifyColumn(['9:15 and 12:45 - 1:30 PM, 12,345'], {}), ['9:15 and 12:45 - 2:00 PM, 10,000']);
  eq('mixed cell: "1999-13-45, 2020-07-21 and 12,345" becomes "1999-13-45, 2020 and 10,000"',
    simplifyColumn(['1999-13-45, 2020-07-21 and 12,345'], {}), ['1999-13-45, 2020 and 10,000']);
  const currencyOff = { simplifyMixedCurrency: false };
  eq('mixed cell: "Paid USD12,345 on Jun 2020" with the currency switch off becomes "Paid USD12,345 on 2020"',
    simplifyColumn(['Paid USD12,345 on Jun 2020'], currencyOff), ['Paid USD12,345 on 2020']);
  eq('mixed cell: "Paid 12,345 USD on Jun 2020" with the currency switch off becomes "Paid 12,345 USD on 2020"',
    simplifyColumn(['Paid 12,345 USD on Jun 2020'], currencyOff), ['Paid 12,345 USD on 2020']);
  eq('mixed cell: "Paid 12,345 (USD) on Jun 2020" with the currency switch off becomes "Paid 10,000 (USD) on 2020"',
    simplifyColumn(['Paid 12,345 (USD) on Jun 2020'], currencyOff), ['Paid 10,000 (USD) on 2020']);
  eq('mixed cell: "See Jun 2020 report, 12,345 users" with "Jun 2020" a link becomes "See Jun 2020 report, 10,000 users"',
    simplifyColumn(['See Jun 2020 report, 12,345 users'], {}, [{ ladder: { markupRanges: [{ start: 4, end: 12 }] } }]),
    ['See Jun 2020 report, 10,000 users']);
  eq('mixed cell: "Call at 19:54, 12,345 users" with "19:54" a link becomes "Call at 19:54, 10,000 users"',
    simplifyColumn(['Call at 19:54, 12,345 users'], {}, [{ ladder: { markupRanges: [{ start: 8, end: 13 }] } }]),
    ['Call at 19:54, 10,000 users']);
  eq('mixed cell: "Jun 2020, 12,345 users" drawn as "Jun " and "2020, 12,345 users" becomes "Jun 2020, 10,000 users"',
    simplifyColumn(['Jun 2020, 12,345 users'], {}, [{ pieces: ['Jun ', '2020, 12,345 users'] }]),
    ['Jun 2020, 10,000 users']);
})();

(function signsHoldTheirNumbers() {
  const currencyOff = { simplifyMixedCurrency: false };
  const percentOff = { simplifyMixedPercent: false };
  for (const text of ['$-1,234', '$−1,234', '£-1,234', '$ -1,234', '$+1,234', '45.67 m CAD', '$12–18', '$12 to 18',
    '₹615.71–623.33 crore', '$12m–18m', '12m–18m USD', '$1.2bn–1.7bn', '€12k–18k', '12 – $18',
    '1,234 €.', '1,234 kr.']) {
    eq(`sign beside a number: "${text}" with the currency switch off stays "${text}"`,
      simplifyColumn([text], currencyOff), [text]);
  }
  for (const text of ['(12.3)%', '12–18%', '12-18%', '-12 to -18%', '−12 to −18%', '(12) to (18)%', '45%.']) {
    eq(`sign beside a number: "${text}" with the percent switch off stays "${text}"`,
      simplifyColumn([text], percentOff), [text]);
  }
  eq('sign beside a number: "12–18%" with the percent switch on becomes "10–20%"',
    simplifyColumn(['12–18%'], {}), ['10–20%']);
  eq('sign beside a number: "₹615.71–623.33 crore" with the currency switch on becomes "₹600–600 crore"',
    simplifyColumn(['₹615.71–623.33 crore'], {}), ['₹600–600 crore']);
  eq('sign beside a number: "$12m–18m" with the currency switch on becomes "$10m–20m"',
    simplifyColumn(['$12m–18m'], {}), ['$10m–20m']);
  eq('sign beside a number: "45%." with the percent switch on becomes "45"',
    simplifyColumn(['45%.'], {}), ['45']);
  const spaces = ' '.repeat(1000);
  const longRange = '5' + spaces + 'to' + spaces + '18 pts';
  const started = Date.now();
  const longRangeResult = simplifyColumn([longRange], percentOff);
  eq('sign beside a number: "5", 1,000 spaces, "to", 1,000 spaces, "18 pts" with the percent switch off becomes "… 20 pts" in under a second',
    [longRangeResult[0].endsWith('to' + spaces + '20 pts'), Date.now() - started < 1000], [true, true]);
})();

(function markupHoldsOneValueOfAPair() {
  const link = (start, end) => [{ ladder: { markupRanges: [{ start, end }] } }];
  eq('markup: "2026-11-09T11:45" with the date a link becomes "2026-11-09 12:00"',
    simplifyColumn(['2026-11-09T11:45'], {}, link(0, 10)), ['2026-11-09 12:00']);
  eq('markup: "2026-11-09 11:45" with the date a link becomes "2026-11-09 12:00"',
    simplifyColumn(['2026-11-09 11:45'], {}, link(0, 10)), ['2026-11-09 12:00']);
  eq('markup: "2026-11-09T11:45" with "11:45" a link becomes "2026 11:45"',
    simplifyColumn(['2026-11-09T11:45'], {}, link(11, 16)), ['2026 11:45']);
  eq('markup: "2026-11-09T11:45" with "11:45" a link and the times switch off becomes "2026 11:45"',
    simplifyColumn(['2026-11-09T11:45'], { simplifyTimes: false }, link(11, 16)), ['2026 11:45']);
  eq('markup: "12:45 - 1:30 PM" with "1:30 PM" a link stays "12:45 - 1:30 PM"',
    simplifyColumn(['12:45 - 1:30 PM'], {}, link(8, 15)), ['12:45 - 1:30 PM']);
})();

(function webAddressCellsStay() {
  for (const text of ['https://example.com/log?at=2026-11-09T19:54:00Z', 'https://example.com/watch?t=10:30',
    'https://example.com/2020-07-21/post']) {
    eq(`web address: "${text}" stays "${text}"`, simplifyColumn([text], {}), [text]);
  }
})();
