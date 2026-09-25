// The per-cell classification ladder (lib/dr-simplify).

(function classifyCell_outOfRange() {
  const ranges = [{ colMin: 5, colMax: 10, rowMin: 0, rowMax: 100 }];
  eq('classifyCell: out-of-range cell is skipped',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges }, LADDER_OPTS),
    { mode: 'skip', reason: 'out-of-range' });
})();

(function classifyCell_firstRow() {
  eq('classifyCell: first-row cell is skipped when simplifyFirstRow is false',
    classifyCell({ text: '100', rowIndex: 0, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'first-row' });
  eq('classifyCell: first-row cell simplifies when simplifyFirstRow is true',
    classifyCell({ text: '100', rowIndex: 0, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyFirstRow: true })),
    { mode: 'pure', reason: 'simplify', value: { num: 100 } });
})();

(function classifyCell_firstColumn() {
  eq('classifyCell: first-column cell is skipped when simplifyFirstColumn is false',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'first-column' });
  eq('classifyCell: first-column cell simplifies when simplifyFirstColumn is true',
    classifyCell({ text: '100', rowIndex: 1, columnIndex: 0, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyFirstColumn: true })),
    { mode: 'pure', reason: 'simplify', value: { num: 100 } });
})();

(function classifyCell_percent() {
  eq('classifyCell: percent cell simplifies when simplifyMixedPercent is true',
    classifyCell({ text: '50%', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'pure', reason: 'simplify', value: { num: 50 } });
  eq('classifyCell: percent cell is skipped when simplifyMixedPercent is false',
    classifyCell({ text: '50%', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedPercent: false })),
    { mode: 'skip', reason: 'percent' });
})();

(function classifyCell_currency() {
  eq('classifyCell: currency cell simplifies when simplifyMixedCurrency is true',
    classifyCell({ text: '$100', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'pure', reason: 'simplify', value: { num: 100 } });
  eq('classifyCell: currency cell is skipped when simplifyMixedCurrency is false',
    classifyCell({ text: '$100', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false })),
    { mode: 'skip', reason: 'currency' });
})();

(function classifyCell_unknownExclusionFailsClosed() {
  // getExclusionReason today only ever returns 'firstRow' | 'firstColumn' |
  // 'percent' | 'currency' | null, but classifyCell's ladder must fail
  // closed (skip) on any other non-null value a future exclusion rule
  // returns, instead of silently falling through and simplifying the cell.
  // classifyCell calls getExclusionReason as a bare same-scope identifier
  // (not through an overridable namespace), so the override has to live in
  // its own isolated scope built from the same three source files, with a
  // stub getExclusionReason declared after the real one (last declaration
  // of a name wins in the same scope).
  const isolatedSrc = coreCode + '\n' + parsingCode + '\n' +
    'function getExclusionReason() { return "someFutureReason"; }\n' +
    ladderCode + '\nreturn classifyCell;';
  const isolatedClassifyCell = new Function(isolatedSrc)();
  eq('classifyCell: unrecognized non-null exclusion reason still skips the cell',
    isolatedClassifyCell({ text: '100', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'excluded' });
})();

(function classifyCell_quoted() {
  eq('classifyCell: whole-cell-quoted cell is skipped regardless of content',
    classifyCell({ text: '"12345"', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'quoted' });
})();

(function classifyCell_dates() {
  eq('classifyCell: date-like cell is skipped when simplifyDates is false',
    classifyCell({ text: '2020-01-01', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyDates: false })),
    { mode: 'skip', reason: 'dates-disabled' });
  eq('classifyCell: unambiguous date-like cell resolves when simplifyDates is true',
    classifyCell({ text: '2020-01-01', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'date', reason: 'simplify', value: { month: 1, day: 1, year: 2020 } });
  eq('classifyCell: ambiguous numeric date returns a pending decision',
    classifyCell({ text: '03/04/2020', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'date', reason: 'simplify', pending: 'ambiguous-date', value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } });
})();

(function classifyCell_times() {
  eq('classifyCell: time-like cell is skipped when simplifyTimes is false',
    classifyCell({ text: '3:45 PM', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'times-disabled' });
  eq('classifyCell: time-like cell simplifies when simplifyTimes is true',
    classifyCell({ text: '3:45 PM', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyTimes: true })),
    { mode: 'time', reason: 'simplify' });
})();

(function classifyCell_link() {
  eq('classifyCell: whole-cell link cell is skipped',
    classifyCell({ text: '42', rowIndex: 1, columnIndex: 1, ranges: null, isWholeLink: true }, LADDER_OPTS),
    { mode: 'skip', reason: 'link' });
})();

(function classifyCell_footnoteSuperscript() {
  // "10<sup>12</sup>" flattens to "1012"; the sole match spans the whole
  // string and overlaps the superscript mask, so nothing survives.
  eq('classifyCell: whole-cell exponent with no surviving match after masking is skipped',
    classifyCell({
      text: '1012', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 2, end: 4 }],
    }, LADDER_OPTS),
    { mode: 'skip', reason: 'footnote' });

  // "20 <sup>15</sup>" flattens to "20 1015": the standalone "20" survives
  // masking even though the sup-adjacent "1015" match does not.
  eq('classifyCell: a superscript-flagged cell keeps non-overlapping matches',
    classifyCell({
      text: '20 1015', rowIndex: 1, columnIndex: 1, ranges: null,
      hasSuperscript: true, superscriptRanges: [{ start: 5, end: 7 }],
    }, LADDER_OPTS),
    { mode: 'extracted', reason: 'footnote', value: { matches: [{ numStr: '20', num: 20, index: 0 }] } });

  eq('classifyCell: superscript-flagged cell is skipped when simplifyMixedCells is false',
    classifyCell({
      text: '1012', rowIndex: 1, columnIndex: 1, ranges: null, hasSuperscript: true,
    }, Object.assign({}, LADDER_OPTS, { simplifyMixedCells: false })),
    { mode: 'skip', reason: 'footnote' });
})();

(function classifyCell_mixedText() {
  eq('classifyCell: mixed text with a numeric match simplifies',
    classifyCell({ text: 'Revenue 500 units', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).mode,
    'extracted');
  eq('classifyCell: mixed text drops era-marked years from extracted matches',
    classifyCell({ text: 'Kalki 2898 AD and 500 more', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)
      .value.matches.map((m) => m.num),
    [500]);
  eq('classifyCell: mixed text drops numbers inside a quoted span',
    classifyCell({ text: 'Product "42" ships in 10 days', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS)
      .value.matches.map((m) => m.numStr),
    ['10']);
  eq('classifyCell: mixed text is skipped when simplifyMixedCells is false',
    classifyCell({ text: 'Revenue 500 units', rowIndex: 1, columnIndex: 1, ranges: null },
      Object.assign({}, LADDER_OPTS, { simplifyMixedCells: false })),
    { mode: 'skip', reason: 'mixed-disabled' });
  eq('classifyCell: mixed text with no numeric content is skipped',
    classifyCell({ text: 'hello world', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'no-number' });
})();

(function classifyCell_unitNumbers() {
  const wordsOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCells: false });
  const currencyOff = Object.assign({}, LADDER_OPTS, { simplifyMixedCurrency: false });
  const at = (text, extra) => Object.assign({ text, rowIndex: 1, columnIndex: 1, ranges: null }, extra || {});
  eq('classifyCell: a unit number simplifies with the words setting off',
    classifyCell(at('4.91tn'), wordsOff),
    { mode: 'extracted', reason: 'unit', value: { matches: [{ numStr: '4.91', num: 4.91, index: 0 }] } });
  eq('classifyCell: a unit number simplifies with the words setting on',
    classifyCell(at('CAD45.67'), LADDER_OPTS),
    { mode: 'extracted', reason: 'unit', value: { matches: [{ numStr: '45.67', num: 45.67, index: 3 }] } });
  eq('classifyCell: a code before the number excludes the cell with the currency setting off',
    classifyCell(at('CAD45.67'), currencyOff), { mode: 'skip', reason: 'currency' });
  eq('classifyCell: a code after the number excludes the cell with the currency setting off',
    classifyCell(at('45.67 USD'), currencyOff), { mode: 'skip', reason: 'currency' });
  eq('classifyCell: a unit number that is a whole link is skipped',
    classifyCell(at('7.5m', { isWholeLink: true }), LADDER_OPTS), { mode: 'skip', reason: 'link' });
  eq('classifyCell: an identifier is not a unit number',
    classifyCell(at('DT1234'), wordsOff), { mode: 'skip', reason: 'mixed-disabled' });
  eq('classifyCell: a plain currency number stays pure',
    classifyCell(at('$45.67'), wordsOff), { mode: 'pure', reason: 'simplify', value: { num: 45.67 } });
  // "4.91<sup>1</sup>tn" flattens to "4.911tn": the footnote digit must not
  // join the unit number.
  eq('classifyCell: a cell with a <sup> is not a unit number',
    classifyCell(at('4.911tn', { hasSuperscript: true, superscriptRanges: [{ start: 4, end: 5 }] }), wordsOff),
    { mode: 'skip', reason: 'mixed-disabled' });
})();

(function pickDateFormatHint_and_resolveAmbiguousDateDecision() {
  eq('pickDateFormatHint: n1 > 12 only -> DMY', pickDateFormatHint([{ n1: 25, n2: 4 }]), 'DMY');
  eq('pickDateFormatHint: n2 > 12 only -> MDY', pickDateFormatHint([{ n1: 3, n2: 25 }]), 'MDY');
  eq('pickDateFormatHint: both > 12 across the column -> MIXED',
    pickDateFormatHint([{ n1: 25, n2: 4 }, { n1: 3, n2: 25 }]), 'MIXED');
  eq('pickDateFormatHint: neither > 12 -> AMBIGUOUS', pickDateFormatHint([{ n1: 3, n2: 4 }]), 'AMBIGUOUS');

  eq('resolveAmbiguousDateDecision: MDY resolves n1 as month, n2 as day',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } }, 'MDY'),
    { mode: 'date', reason: 'simplify', value: { month: 3, day: 4, year: 2020 } });
  eq('resolveAmbiguousDateDecision: DMY resolves n2 as month, n1 as day',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } }, 'DMY'),
    { mode: 'date', reason: 'simplify', value: { month: 4, day: 3, year: 2020 } });
  eq('resolveAmbiguousDateDecision: MIXED downgrades to skip',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 25, n2: 25, year: 2020 } } }, 'MIXED'),
    { mode: 'skip', reason: 'ambiguous-date' });
  eq('resolveAmbiguousDateDecision: AMBIGUOUS downgrades to skip',
    resolveAmbiguousDateDecision({ value: { ambiguous: { n1: 3, n2: 4, year: 2020 } } }, 'AMBIGUOUS'),
    { mode: 'skip', reason: 'ambiguous-date' });
})();

// --- Identifier shapes (issue #426) ---
//
// A cell whose whole text is an identifier shape (a phone number, an IP
// address, a web or email address, an ISBN, a postal code, or digit groups
// split by whitespace outside thousands grouping) stays as written. The
// "still rounds" rows pin the near misses each shape must leave alone.
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
];

const IDENTIFIER_NEAR_MISSES = [
  '1 234 567', '12 345.67', '1 234 567', '1 234 567',
  '1 234 567 890', '9 780 306 406 157',
  '100-200', '192.5', '1.5', '90210', '1234567890', '9780306406157',
  '$1,613,245', '4.91tn', 'About 1,613,245 people',
];

(function identifierShapes_matchTheWholeCell() {
  for (const [text, name] of IDENTIFIER_SHAPE_CELLS) {
    eq(`identifier shape: "${text}" matches ${name}`, matchIdentifierShape(text), name);
    eq(`identifier shape: "${text}" is a skipped cell`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
      { mode: 'skip', reason: 'identifier' });
  }
  for (const text of IDENTIFIER_NEAR_MISSES) {
    eq(`identifier shape: "${text}" matches no shape`, matchIdentifierShape(text), null);
    eq(`identifier shape: "${text}" still rounds`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).mode !== 'skip', true);
  }
  eq('identifier shape: "DT1234" keeps its no-number reason',
    classifyCell({ text: 'DT1234', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'no-number' });
  eq('identifier shape: a date written with spaces still reads as a date',
    classifyCell({ text: '21 June 2020', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS).mode, 'date');
})();

// --- Identifier shapes inside text (issue #465) ---
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
];

const IDENTIFIER_SPAN_NEAR_MISSES = [
  ['Call 416 555 1234 about 281,745 units', ['416', '555', '1234', '281,745']],
  ['+1 416 555 1234 ordered 281,745', ['1', '416', '555', '1234', '281,745']],
  ['In 2024 12 stores opened', ['2024', '12']],
  ['978-0-306-40615-7 sold 90,114 copies', ['978', '306', '40615', '7', '90,114']],
  ['Call 416-555-12345 about 281,745 units', ['416', '555', '12345', '281,745']],
  ['Range 100-200 of 1,613,245', ['100', '200', '1,613,245']],
  ['Zip 90210 has 93,662 people', ['90210', '93,662']],
  ['Host 192.168.0.1.5 served 12 requests', ['192.168', '12']],
];

(function identifierShapes_holdTheirDigitsInsideText() {
  const extractedNumbers = (text) => {
    const decision = classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS);
    return decision.mode === 'extracted' ? decision.value.matches.map((m) => m.numStr) : decision;
  };
  for (const [text, expected] of IDENTIFIER_SPAN_CELLS) {
    eq(`identifier shape inside text: "${text}" rounds only its quantity`, extractedNumbers(text), expected);
  }
  for (const [text, expected] of IDENTIFIER_SPAN_NEAR_MISSES) {
    eq(`identifier shape inside text: "${text}" rounds every number`, extractedNumbers(text), expected);
  }
  eq('identifier shape inside text: "Call 416-555-1234" matches no whole-cell shape',
    matchIdentifierShape('Call 416-555-1234'), null);
  eq('identifier shape inside text: "Call 416-555-1234" holds no number to round',
    classifyCell({ text: 'Call 416-555-1234', rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
    { mode: 'skip', reason: 'no-number' });
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
    eq(`at-name: "${text}" holds no number to round`,
      classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, LADDER_OPTS),
      { mode: 'skip', reason: 'no-number' });
  }
  eq('at-name: a count beside an at-name still rounds, and the at-name stays',
    extractNumbersInText('@2020vision has 1,613,245 fans').map((m) => m.numStr), ['1,613,245']);
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
  eq('bracketed: a whole-cell bracketed number classifies as extracted',
    classifyCell({ text: '(1,234)', rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts),
    { mode: 'extracted', reason: 'simplify', value: { matches: [{ numStr: '1,234', num: -1234, index: 1 }] } });
})();

(function bracketedCellRoundsWithWordsOff() {
  const opts = Object.assign({}, bracketOpts, { simplifyMixedCells: false });
  eq('bracketed: a bracketed cell rounds with the words setting off',
    classifyCell({ text: '(1,234)', rowIndex: 1, columnIndex: 1, ranges: null }, opts).mode,
    'extracted');
})();

(function plainNumberStaysPure() {
  eq('bracketed: a plain number still classifies as pure',
    classifyCell({ text: '1,234', rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts).mode,
    'pure');
})();

(function bracketedWholeLinkStaysUnchanged() {
  eq('bracketed: a bracketed cell that is one whole link stays unchanged',
    classifyCell({ text: '(1,234)', rowIndex: 1, columnIndex: 1, ranges: null, isWholeLink: true }, bracketOpts),
    { mode: 'skip', reason: 'link' });
})();

(function bracketedQuotedCellStaysUnchanged() {
  eq('bracketed: a quoted bracketed number stays unchanged',
    classifyCell({ text: '"(1,234)"', rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts),
    { mode: 'skip', reason: 'quoted' });
})();

