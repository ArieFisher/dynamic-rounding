// Rounding a whole table: roundTable, restore, the re-apply observer, and the lens preview (content.js).

// ---------------------------------------------------------------------------
// Pin column-index behavior for tables with <th> cells
//
// Column index is the cell's position in its row, counting <th> cells:
//   - <th> cells round under the same switches as any cell, and they occupy their column.
//   - rangeExpr "A" maps to the leftmost DOM cell — the <th> in a row-header
//     table, so the leading <td> there is column "B".
//   - simplifyFirstColumn gates the leftmost DOM cell, so in a row-header table
//     it does not gate the leading <td>.
// ---------------------------------------------------------------------------

// A table with row headers: nothing outside the range is rounded.
// Row: [<th>Name</th>, <td>123</td>, <td>234</td>]
// With rangeExpr = "A" the range covers the <th> column only; neither <td> is
// in range, and the <th> holds a name, not a number. Both <td> values change
// when they round, so a range that let them in would mark them.
(function firstColIsA_withRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'th', text: 'Name' },
      { tag: 'td', text: '123'  },
      { tag: 'td', text: '234'  },
    ]]);
    roundTable(table, roundTableOpts({ rangeExpr: 'A' }));
    const cells = table.rows[0].cells;
    // <th> Name holds no number, so it stays raw.
    eq('first-col-is-A (row-header table): a <th> holding a name shows the original',
      cells[0].classList.contains('dr-ext-rounded'), false);
    // <td>123 is column B and <td>234 column C — both out of range A
    eq('first-col-is-A (row-header table): <td>123 at column B not rounded',
      cells[1].classList.contains('dr-ext-rounded'), false);
    eq('first-col-is-A (row-header table): <td>234 at column C not rounded',
      cells[2].classList.contains('dr-ext-rounded'), false);
  });
})();

// A table without row headers: columns outside the range stay untouched.
// Note: directly asserting "first <td> gets the rounded class" depends on the
// rounding algorithm producing a *changed* value, which for some inputs (e.g.
// a single in-range cell) is a no-op. We pin only the negative behavior here:
// cells outside the range never get the rounded class.
(function firstColIsA_noRowHeader() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '50000' },
      { tag: 'td', text: '123'   },
      { tag: 'td', text: '234'   },
    ]]);
    roundTable(table, roundTableOpts({ rangeExpr: 'A' }));
    const cells = table.rows[0].cells;
    eq('first-col-is-A (no row-header): second <td> is column B, not rounded',
      cells[1].classList.contains('dr-ext-rounded'), false);
    eq('first-col-is-A (no row-header): third <td> is column C, not rounded',
      cells[2].classList.contains('dr-ext-rounded'), false);
  });
})();

// simplifyFirstColumn gates the <th>, not the leading <td>.
// The <th> counts toward the column index, so "first column" means the <th>,
// not the second rendered column. The <th> is the first column, so the leading <td> (column
// B) is rounded regardless of the first-column switch, and the <th> holds a name, so it shows the original.
(function simplifyFirstColumn_withRowHeader() {
  for (const flag of [false, true]) {
    const rows = runRowHeaderTable({ simplifyFirstColumn: flag });
    eq(`simplifyFirstColumn=${flag} (row-header table): a <th> holding a name shows the original`,
      isRounded(rows[0][0]), false);
    eq(`simplifyFirstColumn=${flag} (row-header table): leading <td> is column B, not gated`,
      isRounded(rows[0][1]), true);
  }
})();

// Range letters count the <th> column.
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


// ---------------------------------------------------------------------------
// Header cells follow the switches
//
// A header cell rounds like any other cell: the first-row and first-column
// switches govern by position, whatever tag the page gave the cell. A grid
// already reads every cell as a data cell, so these assertions hold the
// native table to the same rule.
// ---------------------------------------------------------------------------

const HEADER_CELL_OPTS = {
  enabled: true, simplifyDates: false, simplifyTimes: false,
  simplifyFirstRow: false, simplifyFirstColumn: false,
  simplifyMixedPercent: false, simplifyMixedCurrency: true,
  offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
  rangeExpr: '',
};

function roundHeaderCellTable(rowsSpec, optsOverrides) {
  let rows;
  withCreateTreeWalker(function () {
    const table = makeMockTable(rowsSpec);
    roundTable(table, Object.assign({}, HEADER_CELL_OPTS, optsOverrides));
    rows = table.rows.map((row) => row.cells);
  });
  return rows;
}

// A header row of <th> prices over a body of <td> cells: the shape a pricing
// comparison takes. At -0.5 each value rounds to half its own order: 195 to
// the nearest 50, 25 to the nearest 5.
const PRICE_HEADER_ROWS = [
  [{ tag: 'th', text: 'Plan' },  { tag: 'th', text: '$195' }, { tag: 'th', text: '$550' }],
  [{ tag: 'td', text: 'Users' }, { tag: 'td', text: '25' },   { tag: 'td', text: '40' }],
];

(function headerCells_theFirstRowSwitchGovernsAHeaderRow() {
  const off = roundHeaderCellTable(PRICE_HEADER_ROWS, { simplifyFirstRow: false });
  eq('header cells: with the first-row switch off, a <th> price in row one shows the original',
    off[0][1].innerText, '$195');
  eq('header cells: with the first-row switch off, the original <th> carries no rounded marker',
    isRounded(off[0][1]), false);
  const on = roundHeaderCellTable(PRICE_HEADER_ROWS, { simplifyFirstRow: true });
  eq('header cells: with the first-row switch on, a <th> price in row one rounds',
    on[0][1].innerText, '$200');
  eq('header cells: with the first-row switch on, the rounded <th> carries the rounded marker',
    isRounded(on[0][1]), true);
})();

// Row headers holding counts: column A is the <th> column, so the first-column
// switch governs them. At -0.5, 1,234 rounds to the nearest 500.
const SEAT_ROWS = [
  [{ tag: 'th', text: 'Seats' }, { tag: 'th', text: 'Price' }],
  [{ tag: 'th', text: '1,234' }, { tag: 'td', text: '99' }],
  [{ tag: 'th', text: '5,678' }, { tag: 'td', text: '49' }],
];

(function headerCells_theFirstColumnSwitchGovernsRowHeaders() {
  const off = roundHeaderCellTable(SEAT_ROWS, { simplifyFirstColumn: false });
  eq('header cells: with the first-column switch off, a <th> count in column A shows the original',
    off[1][0].innerText, '1,234');
  const on = roundHeaderCellTable(SEAT_ROWS, { simplifyFirstColumn: true });
  eq('header cells: with the first-column switch on, a <th> count in column A rounds',
    on[1][0].innerText, '1,000');
  eq('header cells: with the first-column switch on, the second <th> count rounds too',
    on[2][0].innerText, '5,500');
})();

// A header cell outside row one and column A sits under no switch, so it
// rounds under the defaults like any other cell.
(function headerCells_aHeaderCellElsewhereRoundsLikeAnyCell() {
  const rows = roundHeaderCellTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
    [{ tag: 'td', text: 'North' },  { tag: 'th', text: '1,234,567' }],
  ]);
  eq('header cells: a <th> outside row one and column A rounds under the defaults',
    rows[1][1].innerText, '1,000,000');
})();

// The shape fingerprint records the header row's texts. Once the extension
// simplifies a header cell, the fingerprint must read that cell through its
// stored original, or the extension's own write would read as a page change
// and discard the entry on the next action.
(function headerCells_aSimplifiedHeaderCellReadsAsNoShapeChange() {
  withCreateTreeWalker(function () {
    const table = makeMockTable(PRICE_HEADER_ROWS);
    const readOpts = { originalText: (cellEl) => DR_MODEL.getTableOriginalText(table, cellEl) };
    const before = readTableFingerprint(table, readOpts);
    roundTableUnder(table, Object.assign({}, HEADER_CELL_OPTS, { simplifyFirstRow: true }));
    eq('header cells: the fingerprint test simplified the header row',
      table.rows[0].cells[1].innerText, '$200');
    eq('header cells: the fingerprint reads a simplified header cell through its original',
      sameTableFingerprint(before, readTableFingerprint(table, readOpts)), true);
    DR_MODEL.unregisterTable(table);
  });
})();

// The lens preview samples the cells the table rounds, so a header row joins
// its pool exactly when the first-row switch lets the row round.
(function headerCells_theLensPreviewFollowsTheFirstRowSwitch() {
  withCreateTreeWalker(function () {
    const table = makeMockTable(PRICE_HEADER_ROWS);
    const nums = (overrides) =>
      collectNumericCells(table, Object.assign({}, HEADER_CELL_OPTS, overrides)).map((c) => c.num);
    eq('header cells: the lens preview leaves a header row showing the original out',
      nums({ simplifyFirstRow: false }), [25, 40]);
    eq('header cells: the lens preview takes a simplified header row in',
      nums({ simplifyFirstRow: true }), [195, 550, 25, 40]);
  });
})();

// --- A percent cell with the percent switch off ---
(function roundTable_percentCellHeldWithThePercentSwitchOff() {
  withLinkCreateTreeWalker(function() {
    const cell = makeMockCell('td', '+2.3%');
    roundTable(makeTableOfCells([[cell]]), roundTableOpts());
    eq('roundTable: percent cell "+2.3%" with the percent switch off is not rounded',
      cell.classList.contains('dr-ext-rounded'), false);
  });
})();

// A cell whose whole trimmed text is one balanced quoted span stays as
// written, though the number inside the quotes would round to 35.
(function wholeCellQuote_quotedCellStaysAsWritten() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '"37 musketeers"' },
      { tag: 'td', text: '42' },
    ]]);
    roundTable(table, roundTableOpts({ simplifyMixedPercent: true, simplifyMixedCurrency: true }));
    const cells = table.rows[0].cells;
    eq('wholeCellQuote: the quoted cell "37 musketeers" stays as written',
      { text: cells[0].innerText, rounded: cells[0].classList.contains('dr-ext-rounded') },
      { text: '"37 musketeers"', rounded: false });
    eq('wholeCellQuote: the unquoted 42 beside it rounds to 40',
      cells[1].innerText, '40');
  });
})();

// Era-marked years are not rounded by the offsets.
(function eraYearNotParameterRounded() {
  withCreateTreeWalker(function() {
    // "Kalki 2898 AD": the 2898 is a calendar year (era marker), so it must NOT
    // be rounded to 3,000 by the numeric offset. A real number in the same row
    // still rounds (control), proving the exclusion is specific to the era year.
    const table = makeMockTable([[
      { tag: 'td', text: 'Kalki 2898 AD' },
      { tag: 'td', text: '1,050,000,000' },
    ]]);
    roundTable(table, roundTableOpts({ simplifyMixedPercent: true, simplifyMixedCurrency: true }));
    const cells = table.rows[0].cells;
    eq('era-round: "Kalki 2898 AD" cell is NOT rounded (era year, not a number)',
      cells[0].classList.contains('dr-ext-rounded'), false);
    eq('era-round: "Kalki 2898 AD" text left unchanged',
      cells[0].innerText, 'Kalki 2898 AD');
    eq('era-round: control 1,050,000,000 still rounds',
      cells[1].classList.contains('dr-ext-rounded'), true);
  });
})();

// A failed extracted-cell patch records nothing.
//
// The patch step skips when the number is not at its flat-text position in
// the live nodes (the text moved between classification and patching). A
// cell whose patches all skip gets no stored original, no hover text, and no
// marker, and the pass counts it as left as written for a text mismatch.

const EXTRACTED_PATCH_OPTS = roundTableOpts({ simplifyMixedPercent: true, simplifyMixedCurrency: true });

// Two numbers in one text piece are two patches that land in one write, so
// the pass counts no text mismatch.
(function twoPatchesInOnePieceCountNoMismatch() {
  const table = makeMockTable([[
    { tag: 'td', text: 'Cost: 123,456 to 654,321 per month' },
  ]]);
  try {
    let result = null;
    withCreateTreeWalker(function () {
      result = roundTable(table, EXTRACTED_PATCH_OPTS);
    });
    const cell = table.rows[0].cells[0];
    eq('extracted-cell patch: both numbers in one piece change',
      /123,456|654,321/.test(cell.innerText), false);
    eq('extracted-cell patch: two landed patches in one piece count no text mismatch',
      result.leftAsWritten.textMismatch, 0);
  } finally {
    DR_MODEL.unregisterTable(table);
  }
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
    const result = roundTable(table, EXTRACTED_PATCH_OPTS);
    const cell = table.rows[0].cells[0];
    eq('extracted-cell patch: a cell whose patches all skip gets no marker',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('extracted-cell patch: a cell whose patches all skip gets no hover text',
      cell.title, '');
    eq('extracted-cell patch: a cell whose patches all skip stores no original',
      DR_MODEL.getTableOriginalText(table, cell), undefined);
    eq('extracted-cell patch: the pass counts the cell as left as written for a text mismatch',
      result.leftAsWritten.textMismatch, 1);
  } finally {
    delete global.document.createTreeWalker;
    DR_MODEL.unregisterTable(table);
  }
})();

// Control: the same cell with its number where the patch expects it
// records in full.
(function landedExtractedPatchStillRecords() {
  const table = makeMockTable([[
    { tag: 'td', text: 'Cost: 123,456 per month' },
  ]]);
  try {
    withCreateTreeWalker(function () {
      roundTable(table, EXTRACTED_PATCH_OPTS);
    });
    const cell = table.rows[0].cells[0];
    eq('extracted-cell patch: a landed patch changes the cell text',
      cell.innerText.includes('123,456'), false);
    eq('extracted-cell patch: a landed patch stamps the marker and hover text',
      cell.classList.contains('dr-ext-rounded') &&
        cell.title === 'Original: Cost: 123,456 per month',
      true);
    eq('extracted-cell patch: a landed patch stores the original',
      DR_MODEL.getTableOriginalText(table, cell), 'Cost: 123,456 per month');
  } finally {
    DR_MODEL.unregisterTable(table);
  }
})();

// ---------------------------------------------------------------------------
// Two-digit-year US dates through roundTable, since an all-numeric date needs
// the column post-pass.
// ---------------------------------------------------------------------------
(function dateRoundTwoDigitYear() {
  // 3/14/24 → 2024-03-14 (yy=24 < 50 → 2024). Month-first, since n2=14 > 12.
  // year granularity → 2024, decade → 2020, century → 2000.
  const twoDigit = (text, granularity) => roundDateColumn([text], granularity)[0];
  eq('two-digit-year: 3/14/24 year -> "2024"',   twoDigit('3/14/24', 'year'),    '2024');
  eq('two-digit-year: 3/14/24 decade -> "2020"', twoDigit('3/14/24', 'decade'),  '2020');
  eq('two-digit-year: 3/14/24 century -> "2000"',twoDigit('3/14/24', 'century'), '2000');

  // 3/14/75 → month-first (14 > 12) → 1975-03-14 (yy=75 >= 50 → 1975)
  eq('two-digit-year: 3/14/75 year -> "1975"',   twoDigit('3/14/75', 'year'),    '1975');
  eq('two-digit-year: 3/14/75 decade -> "1970"', twoDigit('3/14/75', 'decade'),  '1970');
  eq('two-digit-year: 3/14/75 century -> "1900"',twoDigit('3/14/75', 'century'), '1900');
  eq('two-digit-year: 3/14/75 month -> "3/75"',  twoDigit('3/14/75', 'month'),   '3/75');
  eq('two-digit-year: 3/14/75 quarter -> "Q1 1975"', twoDigit('3/14/75', 'quarter'), 'Q1 1975');
})();

// ---------------------------------------------------------------------------
// The column's format hint for all-numeric dates, through roundTable.
// ---------------------------------------------------------------------------
(function dateRoundColumnAutoDetect() {
  // --- Month-first column ---
  // '04/13/2022' sets month-first (n2=13 > 12). At month granularity the
  // sibling '12-03-2022' tells the two readings apart: month-first keeps the
  // month 12, day-first keeps 03.
  const monthFirst = roundDateColumn(['04/13/2022', '12-03-2022'], 'month');
  eq('month-first column: 04/13/2022 at month -> 04/2022', monthFirst[0], '04/2022');
  eq('month-first column: 12-03-2022 reads as month-first (Dec 3 → 12-2022, not day-first Mar 12 → 03-2022)',
    monthFirst[1], '12-2022');

  // --- Day-first column ---
  // '13/04/2022' sets day-first (n1=13 > 12). At month granularity the
  // sibling '12-03-2022' keeps 03 under day-first and 12 under month-first.
  const dayFirst = roundDateColumn(['13/04/2022', '12-03-2022'], 'month');
  eq('day-first column: 13/04/2022 at month -> 04/2022', dayFirst[0], '04/2022');
  eq('day-first column: 12-03-2022 reads as day-first (Mar 12 → 03-2022, not month-first Dec 3 → 12-2022)',
    dayFirst[1], '03-2022');

  // At quarter the column's reading sets which part is the month:
  // '12-03-2022' is Q4 when month-first and Q1 when day-first.
  const monthFirstQuarter = roundDateColumn(['04/13/2022', '12-03-2022'], 'quarter');
  eq('month-first column: 04/13/2022 at quarter -> Q2 2022', monthFirstQuarter[0], 'Q2 2022');
  eq('month-first column: 12-03-2022 at quarter -> Q4 2022', monthFirstQuarter[1], 'Q4 2022');
  const dayFirstQuarter = roundDateColumn(['13/04/2022', '12-03-2022'], 'quarter');
  eq('day-first column: 13/04/2022 at quarter -> Q2 2022', dayFirstQuarter[0], 'Q2 2022');
  eq('day-first column: 12-03-2022 at quarter -> Q1 2022', dayFirstQuarter[1], 'Q1 2022');

  // A numeric date with words around it changes in place, so the words stay.
  const wordsResult = roundDateColumn(['Due 7/21/2020', '7/4/99'], 'year');
  eq('numeric date in words: Due 7/21/2020 at year -> Due 2020', wordsResult[0], 'Due 2020');
  eq('numeric date in words: 7/4/99 at year -> 1999', wordsResult[1], '1999');

  // Every numeric date in a cell changes, and a cell's second date counts
  // toward its column's reading: 7/31/2020 is the only date that settles it.
  const rangeResult = roundDateColumn(['7/1/2020 - 7/31/2020', '12/31/2020 11:59'], 'month');
  eq('numeric range: both dates change at month', rangeResult[0], '7/2020 - 7/2020');
  eq('numeric date with a time: the time stays', rangeResult[1], '12/2020 11:59');

  // A cell whose numeric date sits in a column with an ambiguous format hint
  // stays as written, its named date included.
  const heldResult = roundDateColumn(['Jun 2020 - 03/04/2020', '05/06/2021'], 'year');
  eq('ambiguous format hint: a cell with a named and a numeric date stays as written',
    heldResult[0], 'Jun 2020 - 03/04/2020');

  // --- Ambiguous column ---
  // Column where ALL cells have both components <= 12, so no reading of day
  // and month holds for the column.
  const ambigResult = roundDateColumn(['03-04-2022', '05-06-2023'], 'year');
  eq('ambiguous column: 03-04-2022 left unchanged', ambigResult[0], '03-04-2022');
  eq('ambiguous column: 05-06-2023 left unchanged', ambigResult[1], '05-06-2023');
})();

// ---------------------------------------------------------------------------
// Non-date strings pass through unchanged.
// ---------------------------------------------------------------------------
(function dateRoundNonDatePassthrough() {
  eq('non-date pass-through: "hello" stays unchanged', roundDateColumn(['hello'], 'decade')[0], 'hello');
})();

// =============================================================================
// The lens preview's samples and sample choice
//
// DR_DEFAULTS leave the first row and the first column as written, and the
// lens preview samples only the cells the table rounds, so the fixtures below
// put a <th> header row and a <th> label column around their numbers.
// =============================================================================

(function lensPreview_collectNumericCells() {
  // Build a small stub table; only the pure-number cells should appear.
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

(function lensPreview_extractPreviewSamples_buckets() {
  // 5 cells across 5 distinct magnitudes: 1e7, 1e6, 1e4, 1e2, 1e1.
  // num_top = 1 (DR_DEFAULTS) -> the top band holds the highest magnitude only
  // (others differ from max_mag by >= 1). Two cells share the top magnitude,
  // and the preview still holds one top-band sample.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row1'), tdCell('27,000,000'), tdCell('18,000,000')] }, // both mag 7
      { cells: [thCell('Row2'), tdCell('4,080'),  tdCell('312')] },            // mag 3, 2
      { cells: [thCell('Row3'), tdCell('56')] },                              // mag 1
    ],
  };
  const result = extractPreviewSamples(table);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: maxMag is 7', result.maxMag, 7);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: the top band holds 1 sample', result.samples.top.length, 1);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: the top-band sample is 27M', result.samples.top[0].num, 27000000);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: the other band holds 3 samples', result.samples.other.length, 3);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: the first other-band sample is 4,080', result.samples.other[0].num, 4080);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: the second other-band sample is 312', result.samples.other[1].num, 312);
  eq('lens preview of 27M, 18M, 4,080, 312, and 56: the third other-band sample is 56', result.samples.other[2].num, 56);
})();

(function lensPreview_extractPreviewSamples_onePerOrderOfMagnitude() {
  // The other band shows one sample per distinct lower order of magnitude,
  // with no cap. Negatives bucket by absolute value. For 1234 / 123 / -12 the
  // preview is three lines: top-band 1k+ (1234) plus other-band 100+ (123)
  // and 10+ (|-12|).
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('1234'), tdCell('123'), tdCell('-12')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('lens preview of 1234, 123, and -12: maxMag is 3', result.maxMag, 3);
  eq('lens preview of 1234, 123, and -12: the top-band sample is 1234', result.samples.top[0].num, 1234);
  eq('lens preview of 1234, 123, and -12: the other band holds one sample per lower magnitude, 2 samples',
    result.samples.other.length, 2);
  eq('lens preview of 1234, 123, and -12: the first other-band sample is 123', result.samples.other[0].num, 123);
  eq('lens preview of 1234, 123, and -12: the second other-band sample is -12, read by its absolute value', result.samples.other[1].num, -12);

  // No cap: five distinct lower magnitudes yield five other-band samples.
  const deep = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C'), thCell('D'), thCell('E'), thCell('F')] },
      { cells: [thCell('Row'),
        tdCell('7,000,000'),                                  // mag 6 -> top
        tdCell('500,000'), tdCell('40,000'), tdCell('3,000'), // mags 5,4,3
        tdCell('200'), tdCell('10'),                          // mags 2,1
      ] },
    ],
  };
  const deepResult = extractPreviewSamples(deep);
  eq('lens preview of 7M down to 10: the other band holds 5 samples, one per lower order of magnitude',
    deepResult.samples.other.length, 5);
  eq('lens preview of 7M down to 10: the other-band samples descend by magnitude',
    deepResult.samples.other.map(r => r.num), [500000, 40000, 3000, 200, 10]);
})();

(function lensPreview_extractPreviewSamples_prefersDemonstrative() {
  // Within a magnitude bucket, an already-round value (250,000,000) would make
  // a useless "X -> X" sample. extractPreviewSamples should surface a cell
  // that visibly changes under the default offset instead, even when the
  // already-round cell appears first in document order.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      // Top bucket (mag 8): round value first, then a value that changes.
      { cells: [thCell('Top'), tdCell('250,000,000'), tdCell('269,690,569')] },
      // Other-band bucket (mag 5): round value first, then a value that changes.
      { cells: [thCell('Other'), tdCell('350,000'), tdCell('235,132')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('lens preview of 250M then 269,690,569: the first top-band sample is 269,690,569',
    result.samples.top[0].num, 269690569);
  eq('lens preview of 350,000 then 235,132: the first other-band sample is 235,132',
    result.samples.other[0].num, 235132);
})();

(function lensPreview_extractPreviewSamples_allRoundFallback() {
  // If every cell in a bucket is already round, fall back to document order
  // rather than dropping the sample.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('250,000,000'), tdCell('500,000')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('lens preview of 250M and 500,000, both already round: the first top-band sample is 250M',
    result.samples.top[0].num, 250000000);
})();

(function lensPreview_extractPreviewSamples_largeMagOnly() {
  // All cells in the top magnitude bucket -> other band ends up empty.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('18,000,000'), tdCell('45,000,000')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('lens preview of 27M, 18M, and 45M: the top band holds 27M alone', result.samples.top.map((row) => row.num), [27000000]);
  eq('lens preview of 27M, 18M, and 45M: the other band is empty', result.samples.other.length, 0);
})();

(function lensPreview_extractPreviewSamples_zeroCell() {
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('4,080'), tdCell('0'), tdCell('56')] },
    ],
  };
  const result = extractPreviewSamples(table);
  const allNums = result.samples.top.concat(result.samples.other).map(s => s.num);
  eq('lens preview of 4,080, 0, and 56: no sample is 0', allNums.includes(0), false);
  eq('lens preview of 4,080, 0, and 56: the other band holds only 56',
    result.samples.other.map(s => s.num), [56]);
})();

(function lensPreview_extractPreviewSamples_emptyTable() {
  const table = {
    rows: [{ cells: [tdCell('hello'), tdCell('world')] }],
  };
  const result = extractPreviewSamples(table);
  eq('lens preview of a table with no numbers: maxMag is null', result.maxMag, null);
  eq('lens preview of a table with no numbers: the top band is empty', result.samples.top.length, 0);
  eq('lens preview of a table with no numbers: the other band is empty', result.samples.other.length, 0);
})();

(function lensPreview_extractPreviewSamples_tableStepMaxMagnitude() {
  // The lens preview splits its samples under the max magnitude the table
  // step's datasetMaxMagnitude returns for the classified cells, the one the
  // simplification pass rounds against. A stub returning 3 for a dataset
  // whose largest number has magnitude 7 moves 27,000,000 and 4,080 into the
  // top band and leaves 312 in the other band. The top band's one sample comes
  // from the largest order of magnitude, so 4,080 gets no top-band sample.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('4,080'), tdCell('312')] },
    ],
  };
  const realDatasetMaxMagnitude = datasetMaxMagnitude;
  const passed = [];
  datasetMaxMagnitude = (classifiedCells) => { passed.push(classifiedCells); return 3; };
  let result;
  try {
    result = extractPreviewSamples(table);
  } finally {
    datasetMaxMagnitude = realDatasetMaxMagnitude;
  }
  eq('lens preview of 27M, 4,080, and 312 under a max magnitude of 3: the max magnitude is read once', passed.length, 1);
  eq('lens preview of 27M, 4,080, and 312 under a max magnitude of 3: the max magnitude reads 27M, 4,080, and 312',
    (passed[0] || []).flatMap((classifiedCell) => classifiedCell.classification.stretches
      .filter((stretch) => stretch.kind === 'number').map((stretch) => stretch.num)),
    [27000000, 4080, 312]);
  eq('lens preview of 27M, 4,080, and 312 under a max magnitude of 3: maxMag is 3', result.maxMag, 3);
  eq('lens preview of 27M, 4,080, and 312 under a max magnitude of 3: the top band holds 27M alone', result.samples.top.map((row) => row.num),
    [27000000]);
  eq('lens preview of 27M, 4,080, and 312 under a max magnitude of 3: the other band holds 312', result.samples.other.map((row) => row.num),
    [312]);
})();

// ---------------------------------------------------------------------------
// the lens preview and the table must round the same cell to the same
// value once a setting changes: extractPreviewSamples and roundTable both
// read the table's settings.
// ---------------------------------------------------------------------------
(function appModelSettings_previewAndTableAgreeOnLiveSettings() {
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

  // Values the offsets change, so a pass that rounded nothing would show.
  const rowsSpec = [[
    { tag: 'td', text: '1,234,567' },
    { tag: 'td', text: '37' },
  ]];
  const previewTable = makeMockTable(rowsSpec);
  DR_MODEL.setTableSettings(previewTable, customSettings, 'page');
  const preview = extractPreviewSamples(previewTable);
  eq('preview/table agreement: the top-band sample is 1,234,567',
    preview.samples.top.map((sample) => sample.num), [1234567]);
  eq('preview/table agreement: the other-band sample is 37',
    preview.samples.other.map((sample) => sample.num), [37]);

  const expectedTop = roundWithOffset(1234567, customSettings.offsetTop);
  const expectedOther = roundWithOffset(37, customSettings.offsetOther);
  eq('preview/table agreement: the table settings change both values (test validity check)',
    expectedTop !== 1234567 && expectedOther !== 37, true);

  // What the table actually renders for the identical cells, applied the
  // way the apply does — straight from the table's settings in the model.
  const liveTable = makeMockTable(rowsSpec);
  DR_MODEL.setTableSettings(liveTable, customSettings, 'page');
  withCreateTreeWalker(() => {
    roundTable(liveTable, DR_MODEL.getTableSettings(liveTable));
  });
  const renderedTop = toNumber(liveTable.rows[0].cells[0].innerText);
  const renderedOther = toNumber(liveTable.rows[0].cells[1].innerText);

  eq('preview/table agreement: the table cell value matches the preview-predicted top value',
    renderedTop, expectedTop);
  eq('preview/table agreement: the table cell value matches the preview-predicted other-band value',
    renderedOther, expectedOther);
  DR_MODEL.unregisterTable(previewTable);
  DR_MODEL.unregisterTable(liveTable);
})();

// ---------------------------------------------------------------------------
// The cross-context apply: a request:applySettings message, delivered through
// the content script's own listener to the active table, writes the table's
// settings and simplifies it, and extractPreviewSamples on the same table,
// which classifies each simplified cell's stored original, predicts the
// values the table shows.
// ---------------------------------------------------------------------------
(function appModelSettings_crossContextMessageAppliesLiveSettingsToBoundTableAndPreviewAgrees() {
  // Values the offsets below change: 1,000,000 and 50 at offsetTop -2 and
  // offsetOther 0.25 round to themselves and would pass with no rounding.
  const CUSTOM_OFFSET_TOP = -2;
  const CUSTOM_OFFSET_OTHER = 0.25;
  runPressFixture(() => {
    const table = makeTablePillboxTestTable([
      { tag: 'td', text: '1,234,567' },
      { tag: 'td', text: '37' },
    ]);
    DR_MODEL.setActiveTable(table);
    const customSettings = Object.assign({}, DR_DEFAULTS, {
      simplifyFirstRow: true, simplifyFirstColumn: true,
      offsetTop: CUSTOM_OFFSET_TOP, offsetOther: CUSTOM_OFFSET_OTHER,
      numTop: 1, rangeExpr: '', enabled: true,
    });
    let ackResponse = null;
    try {
      withCreateTreeWalker(() => {
        ackResponse = askContentScript({ topic: 'request:applySettings', settings: customSettings });
      });
      eq('cross-context apply: request:applySettings was acknowledged',
        ackResponse && ackResponse.ok, true);

      const renderedTop = toNumber(table.rows[0].cells[0].innerText);
      const renderedOther = toNumber(table.rows[0].cells[1].innerText);
      eq('cross-context apply: the fixture top value actually changed under rounding (test validity check)',
        renderedTop !== 1234567, true);
      eq('cross-context apply: the fixture other-band value actually changed under rounding (test validity check)',
        renderedOther !== 37, true);
      eq('cross-context apply: the message alone simplifies the active table',
        table.rows[0].cells[0].classList.contains('dr-ext-rounded'), true);

      // The preview extractor reads the table's own settings and each
      // simplified cell's stored original, so the rounded text on the screen
      // stays out of its read.
      const preview = extractPreviewSamples(table);
      eq('cross-context apply: preview top band has the large cell',
        preview.samples.top.length, 1);
      eq('cross-context apply: preview other band has the small cell',
        preview.samples.other.length, 1);
      eq('cross-context apply: the top value the table shows matches the preview-predicted top value',
        renderedTop, roundWithOffset(preview.samples.top[0].num, CUSTOM_OFFSET_TOP));
      eq('cross-context apply: the other-band value the table shows matches the preview-predicted other-band value',
        renderedOther, roundWithOffset(preview.samples.other[0].num, CUSTOM_OFFSET_OTHER));
    } finally {
      resetTable(table);
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// ---------------------------------------------------------------------------
// collectNumericCells classifies a rounded cell's registry original using
// ranges and filters measured against that text, not against the live,
// already-rounded cell, whose positions differ.
// ---------------------------------------------------------------------------

(function lensPreview_supStaleRegression() {
  withReactiveCreateTreeWalker(function () {
    const opts = EXTRACTED_PATCH_OPTS;
    // "1234.5678 kg" + <sup>"9"</sup> -> flattened "1234.5678 kg9". The
    // footnote digit sits after a decimal number that rounding shortens
    // (e.g. "1234.5678" -> "1000"), shifting where "9" lands in the live text.
    const segsFor = () => ([
      { text: '1234.5678 kg', inSup: false },
      { text: '9', inSup: true },
    ]);
    const otherCell = () => makeReactiveCell([{ text: '99999', inSup: false }]);

    const beforeTable = { rows: [{ cells: [makeReactiveCell(segsFor()), otherCell()] }], dataset: {} };
    const before = collectNumericCells(beforeTable, opts);
    eq('sup-stale regression: pre-round preview finds a numeric sample in the sup cell',
      before.length > 0, true);

    const cell = makeReactiveCell(segsFor());
    const table = { rows: [{ cells: [cell, otherCell()] }], dataset: {} };
    roundTable(table, opts);
    eq('sup-stale regression: the cell rounds and its registry original holds its text',
      DR_MODEL.getTableOriginal(table, cell).value, '1234.5678 kg9');

    const after = collectNumericCells(table, opts);
    eq('sup-stale regression: preview sample set is unchanged after rounding',
      after.map((c) => c.num), before.map((c) => c.num));
  });
})();

(function lensPreview_linkedNumberPostRoundRegression() {
  withReactiveCreateTreeWalker(function () {
    const opts = EXTRACTED_PATCH_OPTS;
    // Plain "1234.5678" (should round) plus a link whose OWN number,
    // "51234.5678", contains the plain number's digits as a substring. Once
    // rounding shortens the plain occurrence away, a live-text substring
    // search for "1234.5678" spuriously matches inside the linked node
    // instead, wrongly excluding the still-valid plain match.
    const segsFor = () => ([
      { text: 'Total 1234.5678 see also ', inSup: false, inAnchor: false },
      { text: '51234.5678', inSup: false, inAnchor: true },
    ]);
    const otherCell = () => makeReactiveCell([{ text: '99999', inSup: false }]);

    const beforeTable = { rows: [{ cells: [makeReactiveCell(segsFor()), otherCell()] }], dataset: {} };
    const before = collectNumericCells(beforeTable, opts);
    eq('linked-number-post-round regression: pre-round preview keeps the plain (non-linked) number',
      before.some((c) => c.num === 1234.5678), true);

    const cell = makeReactiveCell(segsFor());
    const table = { rows: [{ cells: [cell, otherCell()] }], dataset: {} };
    roundTable(table, opts);
    eq('linked-number-post-round regression: the cell rounds and its registry original holds its text',
      DR_MODEL.getTableOriginal(table, cell).value, 'Total 1234.5678 see also 51234.5678');

    const after = collectNumericCells(table, opts);
    eq('linked-number-post-round regression: preview sample set is unchanged after rounding',
      after.map((c) => c.num), before.map((c) => c.num));
  });
})();

(function nativeDateCell_roundsInItsPieceAndSkipsAcrossPieces() {
  withReactiveCreateTreeWalker(function () {
    const oneSegments = [{ text: ' 2024-09-15 ', inSup: false }];
    const splitSegments = [{ text: '2024-', inSup: false }, { text: '09-15', inSup: false }];
    const oneCell = makeReactiveCell(oneSegments);
    const splitCell = makeReactiveCell(splitSegments);
    const table = makeTableOfCells([[oneCell], [splitCell]]);
    try {
      roundTable(table, Object.assign(nativeOnePieceOpts(), { simplifyDates: true, dateGranularity: 'year' }));
      eq('native date cell: a date in one piece rounds, and the piece keeps its whitespace',
        oneSegments[0].text, ' 2024 ');
      eq('native date cell: a date across pieces keeps its text',
        splitSegments.map((seg) => seg.text).join('|'), '2024-|09-15');
      eq('native date cell: a date across pieces gets no marker',
        splitCell.classList.contains('dr-ext-rounded'), false);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

(function nativePureCell_hiddenSortKeyRoundsTheVisibleValue() {
  withReactiveCreateTreeWalker(function () {
    const keyed = [{ text: '000000007002300', inSup: false }, { text: '7,002,300', inSup: false }];
    const repeated = [{ text: '0000004523789', inSup: false }, { text: '4523789', inSup: false }];
    const keyedCell = makeSortKeyCell(keyed, () => keyed[1].text);
    const repeatedCell = makeSortKeyCell(repeated, () => repeated[1].text);
    const table = makeTableOfCells([[keyedCell], [repeatedCell]]);
    try {
      roundTable(table, nativeOnePieceOpts());
      eq('native sort-key cell: the visible value rounds',
        keyed[1].text, '7,000,000');
      eq('native sort-key cell: the hidden sort key keeps its text',
        keyed[0].text, '000000007002300');
      eq('native sort-key cell: a sort key that also holds the digits keeps its text, and the visible value rounds',
        repeated.map((seg) => seg.text).join('|'), '0000004523789|4,500,000');
      eq('native sort-key cell: the cells record as simplified',
        keyedCell.classList.contains('dr-ext-rounded') && repeatedCell.classList.contains('dr-ext-rounded'), true);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// A native table places each number in its piece, as a grid does. A native
// cell classifies its rendered text, which shows whether two pieces sit on
// separate lines or run together, so a digit beside a digit across two pieces
// reads as two numbers only when the rendered text shows a line break between
// them. Dataset 337.91, 125, 126, so the
// max magnitude is 2.
//   a: a currency sign in its own piece, then the number
//   b: one number per line
//   c: one number that inline styling splits into two pieces ("6,7" plain,
//      "18,245" bold): the rendered text runs them together, so it stays
//   d: a number split after its grouping comma: stays
(function nativeSeparatePieces_roundsEachNumberInItsPiece() {
  withReactiveCreateTreeWalker(function () {
    const onRows = (segs) => () => segs.map((seg) => seg.text).join('\n');
    const joined = (segs) => () => segs.map((seg) => seg.text).join('');
    const a = [{ text: '$', inSup: false }, { text: '337.91', inSup: false }];
    const b = [{ text: '125', inSup: false }, { text: '126', inSup: false }];
    const c = [{ text: '6,7', inSup: false }, { text: '18,245', inSup: false }];
    const d = [{ text: '3,406,', inSup: false }, { text: '918', inSup: false }];
    const cells = [
      makeSortKeyCell(a, joined(a)), makeSortKeyCell(b, onRows(b)),
      makeSortKeyCell(c, joined(c)), makeSortKeyCell(d, joined(d)),
    ];
    const table = makeTableOfCells(cells.map((cell) => [cell]));
    const rows = [];
    const offRow = DR_LOG.onRow((row) => rows.push(row));
    const opts = nativeOnePieceOpts();
    try {
      eq('native separate pieces: the lens preview pool holds the numbers the pass rounds',
        collectNumericCells(table, opts).map((cell) => cell.num), [337.91, 125, 126]);
      const result = roundTable(table, opts);
      eq('native separate pieces: a currency sign in its own piece stays and the number rounds',
        a.map((seg) => seg.text), ['$', '350']);
      eq('native separate pieces: one number per line rounds number by number',
        b.map((seg) => seg.text), ['150', '150']);
      eq('native separate pieces: a number that inline styling splits into two pieces stays unchanged',
        c.map((seg) => seg.text), ['6,7', '18,245']);
      eq('native separate pieces: a number split after its grouping comma stays unchanged',
        d.map((seg) => seg.text), ['3,406,', '918']);
      eq('native separate pieces: the pass writes no row and counts each split number',
        { rows: rows.length, splitValue: result.leftAsWritten.splitValue }, { rows: 0, splitValue: 2 });
    } finally {
      offRow();
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// A hidden sort key beside a currency sign in its own tag: the rendered text
// ("$7,002,300") differs from the flat text in more than whitespace, and no
// one piece holds it, so no rendered position maps to a piece. A number
// could sit in the hidden text, so the cell stays unchanged and its
// numbers stay out of the lens preview pool.
(function nativeSeparatePieces_hiddenSortKeyStaysUnchanged() {
  withReactiveCreateTreeWalker(function () {
    const segs = [{ text: '7002300', inSup: false }, { text: '$', inSup: false }, { text: '7,002,300', inSup: false }];
    const cell = makeSortKeyCell(segs, () => '$7,002,300');
    const table = makeTableOfCells([[cell]]);
    try {
      eq('native separate pieces: a hidden sort key beside numbers in separate pieces keeps its numbers out of the pool',
        collectNumericCells(table, nativeOnePieceOpts()), []);
      roundTable(table, nativeOnePieceOpts());
      eq('native separate pieces: a hidden sort key beside numbers in separate pieces leaves every piece unchanged',
        segs.map((seg) => seg.text), ['7002300', '$', '7,002,300']);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// Test page section 8, "Linked number in text". The cell reads
// "See <a>ref 12</a>, total 9,850". The linked 12 holds and 9,850 rounds,
// with no patch left unlanded.
(function linkedReferenceFollowedByComma() {
  withReactiveCreateTreeWalker(function () {
    const opts = EXTRACTED_PATCH_OPTS;
    const segments = [
      { text: 'See ', inSup: false, inAnchor: false },
      { text: 'ref 12', inSup: false, inAnchor: true },
      { text: ', total 9,850', inSup: false, inAnchor: false },
    ];
    const cell = makeReactiveCell(segments);
    const table = makeTableOfCells([[cell]]);
    try {
      const result = roundTableUnder(table, opts);
      eq('table 8 linked reference: no patch is left unlanded',
        result.leftAsWritten.textMismatch, 0);
      eq('table 8 linked reference: the linked 12 holds',
        segments[1].text, 'ref 12');
      eq('table 8 linked reference: the plain 9,850 rounds',
        segments[2].text, ', total 10,000');
      eq('table 8 linked reference: the cell records as simplified',
        cell.classList.contains('dr-ext-rounded'), true);
      // A re-apply classifies the stored original, so the linked 12 stays.
      reapplyRounding(table);
      eq('table 8 linked reference: the linked 12 holds after a re-apply',
        segments[1].text, 'ref 12');
      eq('table 8 linked reference: the plain number stays rounded after a re-apply',
        segments[2].text, ', total 10,000');
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

(function prettyPrintedExtractedCellRounds() {
  withReactiveCreateTreeWalker(function () {
    const opts = EXTRACTED_PATCH_OPTS;
    const segments = [{ text: '\n            Grew 9,850 units\n          ', inSup: false, inAnchor: false }];
    const cell = makePrettyPrintedCell(segments);
    const table = makeTableOfCells([[cell]]);
    try {
      const result = roundTable(table, opts);
      eq('table 21 line breaks: no patch is left unlanded',
        result.leftAsWritten.textMismatch, 0);
      eq('table 21 line breaks: the number inside words rounds, and the line breaks stay',
        segments[0].text, '\n            Grew 10,000 units\n          ');
      eq('table 21 line breaks: the cell records as simplified',
        cell.classList.contains('dr-ext-rounded'), true);
      eq('table 21 line breaks: the stored original is the rendered text',
        (DR_MODEL.getTableOriginal(table, cell) || {}).value, 'Grew 9,850 units');
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// A footnote in a pretty-printed cell: the superscript range counts in flat
// text and converts to rendered positions, so the footnote digit stays
// masked and the quantity beside it rounds.
(function prettyPrintedFootnoteStaysMasked() {
  withReactiveCreateTreeWalker(function () {
    const opts = EXTRACTED_PATCH_OPTS;
    const segments = [
      { text: '\n      Total\n      9,850 kg\n      ', inSup: false },
      { text: '7', inSup: true },
      { text: '\n    ', inSup: false },
    ];
    const cell = makePrettyPrintedCell(segments);
    const table = makeTableOfCells([[cell]]);
    try {
      roundTableUnder(table, opts);
      eq('pretty-printed footnote: the quantity rounds',
        segments[0].text, '\n      Total\n      10,000 kg\n      ');
      eq('pretty-printed footnote: the footnote digit holds',
        segments[1].text, '7');
      reapplyRounding(table);
      eq('pretty-printed footnote: the footnote digit holds after a re-apply',
        [segments[0].text, segments[1].text], ['\n      Total\n      10,000 kg\n      ', '7']);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

(function nativePureCell_prettyPrintedRoundsInItsPiece() {
  withReactiveCreateTreeWalker(function () {
    const segments = [{ text: '\n      4,523,789\n    ', inSup: false }];
    const cell = makePrettyPrintedCell(segments);
    const table = makeTableOfCells([[cell]]);
    try {
      roundTable(table, nativeOnePieceOpts());
      eq('native pure cell: a pretty-printed value rounds, and the line breaks stay',
        segments[0].text, '\n      4,500,000\n    ');
      eq('native pure cell: the stored original is the rendered text',
        (DR_MODEL.getTableOriginal(table, cell) || {}).value, '4,523,789');
      eq('native pure cell: the cell records as simplified',
        cell.classList.contains('dr-ext-rounded'), true);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

(function nativePureCell_valueAcrossPiecesStaysUnchanged() {
  withReactiveCreateTreeWalker(function () {
    // "4,523," plain and "789" in bold: one number across two text pieces.
    const segments = [{ text: '4,523,', inSup: false }, { text: '789', inSup: false }];
    const cell = makeReactiveCell(segments);
    const table = makeTableOfCells([[cell]]);
    try {
      const result = roundTable(table, nativeOnePieceOpts());
      eq('native pure cell across pieces: the first piece keeps its text',
        segments[0].text, '4,523,');
      eq('native pure cell across pieces: the second piece keeps its text',
        segments[1].text, '789');
      eq('native pure cell across pieces: the cell gets no marker',
        cell.classList.contains('dr-ext-rounded'), false);
      eq('native pure cell across pieces: the cell stores no original',
        DR_MODEL.getTableOriginal(table, cell), undefined);
      eq('native pure cell across pieces: the pass counts the cell as a split number',
        result.leftAsWritten.splitValue, 1);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// ---------------------------------------------------------------------------
// An exponent in a <sup> stays as written: the exponent's text node keeps its
// text after the pass. "10<sup>12</sup>" flattens to "1012".
// ---------------------------------------------------------------------------
(function sup_theExponentStaysAsWritten() {
  const CASES = [
    ['10<sup>12</sup>', [{ text: '10', inSup: false }, { text: '12', inSup: true }]],
    ['20 × 10<sup>15</sup>', [{ text: '20 × 10', inSup: false }, { text: '15', inSup: true }]],
    ['20 × 10<sup>−12</sup> s',
      [{ text: '20 × 10', inSup: false }, { text: '−12', inSup: true }, { text: ' s', inSup: false }]],
    ['~ 10<sup>−32</sup> sec',
      [{ text: '~ 10', inSup: false }, { text: '−32', inSup: true }, { text: ' sec', inSup: false }]],
    ['6 × 10<sup>9</sup>', [{ text: '6 × 10', inSup: false }, { text: '9', inSup: true }]],
  ];
  withSupCreateTreeWalker(function() {
    for (const [markup, segments] of CASES) {
      const cell = makeSuperscriptCell(segments);
      roundTable(makeTableOfCells([[cell]]), supTestOpts);
      eq(`sup: the exponent "${segments[1].text}" in "${markup}" is unchanged`,
        cell._textNodes[1].nodeValue, segments[1].text);
    }
  });
})();

// A cell with an exponent and a number outside the <sup>:
// "From inflation (~ 10<sup>−32</sup> sec) – 1234 ka". The exponent stays,
// and 1234 (magnitude 3, the max magnitude) rounds to 1,000 at offset -0.5.
(function supAC3_mixedCellExponentProtectedNonExponentRounded() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: 'From inflation (~ 10', inSup: false },
      { text: '−32', inSup: true },
      { text: ' sec) – 1234 ka', inSup: false },
    ]);
    roundTable(makeTableOfCells([[cell]]), supTestOpts);
    eq('sup: exponent "−32" in mixed cell is unchanged',
      cell._textNodes[1].nodeValue, '−32');
    eq('sup: the 1234 outside the exponent rounds to 1,000',
      cell._textNodes[2].nodeValue, ' sec) – 1,000 ka');
    eq('sup: the cell with an exponent and a rounded number carries the marker',
      cell.classList.contains('dr-ext-rounded'), true);
  });
})();

// A native cell whose raised digits sit in a span styled vertical-align:
// super rounds exactly like the same cell written with a <sup>.
(function supStyled_nativeCellRoundsLikeASupCell() {
  const roundOne = (raised) => {
    const cell = makeSuperscriptCell([
      { text: '4,523,789 ', inSup: false },
      Object.assign({ text: '12', inSup: false }, raised),
    ]);
    roundTable(makeTableOfCells([[cell]]), supTestOpts);
    return cell._textNodes.map((node) => node.nodeValue);
  };
  const saved = global.getComputedStyle;
  global.getComputedStyle = inlineStyleProbe.getComputedStyle;
  try {
    withSupCreateTreeWalker(function() {
      const sup = roundOne({ inSup: true });
      const styled = roundOne({ styledSup: true });
      eq('styled superscript (native): the base rounds and the raised digits stay', styled, ['4,500,000 ', '12']);
      eq('styled superscript (native): the cell rounds the same as a <sup> cell', styled, sup);
    });
  } finally {
    global.getComputedStyle = saved;
  }
})();

// ---------------------------------------------------------------------------
// The date and time switches: a date or time cell changes only with its own
// switch on, at any granularity, beside any other cell.
// ---------------------------------------------------------------------------
(function dateTimeSwitches_eachSwitchGovernsItsOwnCells() {
  // [case, settings, cell texts, expected texts, expected markers]
  const CASES = [
    ['with the date switch on, 2018 at decade rounds to 2010',
      { simplifyDates: true }, ['2018'], ['2010'], [true]],
    ['with the date switch off, 2018 at decade stays as written',
      { simplifyDates: false }, ['2018'], ['2018'], [false]],
    ['with the date switch on, the ISO date 2024-03-14 at decade rounds to 2020',
      { simplifyDates: true }, ['2024-03-14'], ['2020'], [true]],
    ['with the date switch off, the ISO date 2024-03-14 at decade stays as written',
      { simplifyDates: false }, ['2024-03-14'], ['2024-03-14'], [false]],
    ['with the time switch on, 14:30 at hour rounds to 15:00',
      { simplifyTimes: true }, ['14:30'], ['15:00'], [true]],
    ['with the time switch off, 14:30 at hour stays as written',
      { simplifyTimes: false }, ['14:30'], ['14:30'], [false]],
    ['with the time switch on, the 12-hour time 3:45 PM at hour rounds to 4:00 PM',
      { simplifyTimes: true }, ['3:45 PM'], ['4:00 PM'], [true]],
    ['with the time switch off, the 12-hour time 3:45 PM at hour stays as written',
      { simplifyTimes: false }, ['3:45 PM'], ['3:45 PM'], [false]],
    ['with the date switch on, 2018 at century rounds to 2000',
      { simplifyDates: true, dateGranularity: 'century' }, ['2018'], ['2000'], [true]],
    ['with the date switch off, 2018 at century stays as written',
      { simplifyDates: false, dateGranularity: 'century' }, ['2018'], ['2018'], [false]],
    ['with the date switch off, 2018 stays as written beside 8,584,629, which rounds',
      { simplifyDates: false }, ['2018', '8,584,629'], ['2018', '8,500,000'], [false, true]],
    ['with the time switch on and the date switch off, 14:30 rounds to 15:00 and 2018 stays as written',
      { simplifyDates: false, simplifyTimes: true }, ['14:30', '2018'], ['15:00', '2018'], [true, false]],
    ['with the date switch on and the time switch off, 2018 rounds to 2010 and 14:30 stays as written',
      { simplifyDates: true, simplifyTimes: false }, ['2018', '14:30'], ['2010', '14:30'], [true, false]],
    ['with both switches on, 2018 rounds to 2010 and 14:30 rounds to 15:00',
      { simplifyDates: true, simplifyTimes: true }, ['2018', '14:30'], ['2010', '15:00'], [true, true]],
    ['with both switches off, 2018 and 14:30 stay as written',
      { simplifyDates: false, simplifyTimes: false }, ['2018', '14:30'], ['2018', '14:30'], [false, false]],
  ];
  for (const [name, switches, texts, expectedTexts, expectedMarkers] of CASES) {
    withCreateTreeWalker(function() {
      const table = makeMockTable([texts.map((text) => ({ tag: 'td', text }))]);
      roundTable(table, roundTableOpts(Object.assign(
        { dateGranularity: 'decade', timeGranularity: 'hour' }, switches)));
      const cells = table.rows[0].cells;
      eq(`date and time switches: ${name}`,
        { texts: cells.map((cell) => cell.innerText), rounded: cells.map(isRounded) },
        { texts: expectedTexts, rounded: expectedMarkers });
    });
  }
})();

// =============================================================================
// Grid rounding tests
// =============================================================================

// ---------------------------------------------------------------------------
// Grid patch writes. A grid cell's change lands as a patch to the one
// text piece that holds the changed characters, and the cell's originals
// record holds each touched piece's text by piece index.
//
// Invented values at one magnitude, so each rounded value is derived by hand:
// under the defaults every number sits in the top band, and an offset of -0.5
// on magnitude 6 rounds to a step of 500,000.
//   8,584,629 → 8,500,000    7,318,204 → 7,500,000
//   2,140,663 → 2,000,000    1,234,567 → 1,000,000
// ---------------------------------------------------------------------------

const PATCH_GRID_OPTS = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });

const pieceTextsOf = (cell) => gridCellTextPieces(cell).map((node) => node.nodeValue);

(function gridPatch_roundWritesEachChangeIntoItsPiece() {
  const { grid } = makePatchGrid();
  const [a, b, c, d] = grid.cellEls;
  const piecesBefore = grid.cellEls.map(gridCellTextPieces);
  const childCountsBefore = grid.cellEls.map((cell) => cell.childNodes.length);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch: a number between whitespace pieces changes in its own piece',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);
    eq('grid patch: whitespace inside the patched piece stays',
      pieceTextsOf(b), [' 7,500,000 ']);
    eq('grid patch: a number after a piece of its own patches at that piece\'s position',
      pieceTextsOf(c), ['$', '2,000,000']);
    eq('grid patch: a plain one-piece cell rounds in its piece',
      pieceTextsOf(d), ['1,000,000']);
    eq('grid patch: every text piece is the same node object after the round',
      keepsEveryTextPiece(grid.cellEls, piecesBefore), true);
    eq('grid patch: every cell keeps its child count after the round',
      grid.cellEls.map((cell) => cell.childNodes.length), childCountsBefore);
    eq('grid patch: every rounded cell carries the marker class',
      grid.cellEls.every((cell) => cell.classList.contains('dr-ext-rounded')), true);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A date piece with whitespace around it: the date's own text is replaced and
// the piece's whitespace stays once. Year granularity: 2024-03-15 → 2024.
(function gridPatch_aPaddedDatePieceKeepsItsWhitespaceOnce() {
  const grid = makeE2EGridWrapper([[' 2024-03-15 ']]);
  try {
    roundTable(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { simplifyDates: true, dateGranularity: 'year' }));
    eq('grid patch: a padded date piece keeps its whitespace once',
      pieceTextsOf(grid.cellEls[0]), [' 2024 ']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_recordHoldsTheReadTextAndEachTouchedPiece() {
  const { grid } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch: the record holds the flat text and each piece\'s original and written text',
      DR_MODEL.getTableOriginal(grid.wrapperEl, a),
      { value: ' 8,584,629 ',
        pieces: [{ text: ' ', written: ' ' }, { text: '8,584,629', written: '8,500,000' }, { text: ' ', written: ' ' }],
        pageTitle: '' });
    eq('grid patch: a piece\'s whitespace is part of its stored text',
      DR_MODEL.getTableOriginal(grid.wrapperEl, b),
      { value: ' 7,318,204 ', pieces: [{ text: ' 7,318,204 ', written: ' 7,500,000 ' }], pageTitle: '' });
    eq('grid patch: the plain-text read of a record is its value',
      DR_MODEL.getTableOriginalText(grid.wrapperEl, a), ' 8,584,629 ');
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_restorePutsEveryPieceBack() {
  const { grid } = makePatchGrid();
  const [a, b, c, d] = grid.cellEls;
  const piecesBefore = grid.cellEls.map(gridCellTextPieces);
  const childCountsBefore = grid.cellEls.map((cell) => cell.childNodes.length);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    resetTable(grid.wrapperEl);
    eq('grid patch restore: each piece holds its original text again',
      [pieceTextsOf(a), pieceTextsOf(b), pieceTextsOf(c), pieceTextsOf(d)],
      [[' ', '8,584,629', ' '], [' 7,318,204 '], ['$', '2,140,663'], ['1,234,567']]);
    eq('grid patch restore: every text piece is the same node object after the restore',
      keepsEveryTextPiece(grid.cellEls, piecesBefore), true);
    eq('grid patch restore: every cell keeps its child count after the restore',
      grid.cellEls.map((cell) => cell.childNodes.length), childCountsBefore);
    eq('grid patch restore: the records are cleared',
      grid.cellEls.map((cell) => DR_MODEL.hasTableOriginal(grid.wrapperEl, cell)),
      [false, false, false, false]);
    eq('grid patch restore: the marker classes are removed',
      grid.cellEls.some((cell) => cell.classList.contains('dr-ext-rounded')), false);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A cell the page redrew with fewer pieces is a rewritten cell.
// The restore keeps the page's text in it and drops its record and marker,
// so no cell is left unrestorable.
(function gridPatch_aCellWithFewerPiecesKeepsThePagesText() {
  const { grid } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    // The page redraws cell a with one piece; the record's pieces no longer
    // line up with the cell's.
    setGridCellPieces(a, [makeTextNode('9,100,000')]);
    resetTable(grid.wrapperEl);
    eq('grid patch restore: the redrawn cell keeps the page\'s text',
      pieceTextsOf(a), ['9,100,000']);
    eq('grid patch restore: the redrawn cell drops its marker and record',
      { marked: a.classList.contains('dr-ext-rounded'), record: DR_MODEL.hasTableOriginal(grid.wrapperEl, a) },
      { marked: false, record: false });
    eq('grid patch restore: the other cells restore',
      pieceTextsOf(b), [' 7,318,204 ']);
    eq('grid patch restore: with every cell restored, the grid shows its originals',
      showsSimplified(grid.wrapperEl), false);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_reapplyWritesOnlyWhereTheOriginalStands() {
  const { grid, aNumber } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch re-apply (setup): the round wrote the number piece once', aNumber.writes, 1);

    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece already patched is not written again', aNumber.writes, 1);

    // The page redraws the piece with its original text.
    aNumber.nodeValue = '8,584,629';
    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece redrawn to its original is patched again',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);

    // The page changes the piece's text in place. The piece shows neither
    // its original nor its written text, so the cell is a rewritten cell and
    // simplifies the page's value fresh.
    b.childNodes[0].nodeValue = ' 7,318,204.5 ';
    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece whose text the page changed simplifies the page\'s value',
      { pieces: pieceTextsOf(b), original: DR_MODEL.getTableOriginalText(grid.wrapperEl, b) },
      { pieces: [' 7,500,000 '], original: ' 7,318,204.5 ' });
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A later simplification with an invalid range expression stores its options
// and returns an error without resetting the grid, so the re-apply observer
// from the first simplification still fires. The re-apply reads the stored
// invalid expression and writes nothing, as the first simplification would.
(function gridReapply_underAnInvalidRangeExpression_writesNothing() {
  const { grid, aNumber } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
    const result = roundTableUnder(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { rangeExpr: 'A:B:C' }));
    eq('grid re-apply invalid range (setup): the second simplification returns the range error',
      result.rangeStatus, 'error');
    aNumber.nodeValue = '8,584,629';
    const writesBefore = aNumber.writes;
    reapplyRounding(grid.wrapperEl);
    eq('grid re-apply invalid range: a piece redrawn to its original is not patched',
      { pieces: pieceTextsOf(a), writes: aNumber.writes },
      { pieces: [' ', '8,584,629', ' '], writes: writesBefore });
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A grid whose first simplification found no dataset holds no magnitude
// freeze (null). The re-apply then computes the max magnitude from the
// visible cells, and only a first simplification stores a freeze, so the
// freeze stays unset for the next re-apply.
(function gridReapply_withNoMagnitudeFreeze_computesTheMaxMagnitudeAndLeavesTheFreezeUnset() {
  const { grid, aNumber } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid re-apply no freeze (setup): the first simplification stores a freeze',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 6);
    DR_MODEL.setTableMaxMagnitude(grid.wrapperEl, null);
    aNumber.nodeValue = '8,584,629';
    reapplyRounding(grid.wrapperEl);
    eq('grid re-apply no freeze: a piece redrawn to its original rounds under the max magnitude of the visible cells',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);
    eq('grid re-apply no freeze: the re-apply stores no freeze',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), null);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// ---------------------------------------------------------------------------
// A table turned on while it holds nothing to simplify keeps its re-apply
// observer, and a page change that brings in a number simplifies it. The
// table pillbox and the sidebar pillbox show on for such a table, so the
// screen must follow once a number arrives. Both table kinds run the one
// re-apply pass; each kind gets a case.
(function reapply_onTableThatGainsANumberSimplifiesIt_grid() {
  const grid = makeE2EGridWrapper([
    ['north', 'south'],
    ['east', 'west'],
  ]);
  const [a] = grid.cellEls;
  const aText = makeCountingTextNode('pending');
  setGridCellPieces(a, [aText]);
  try {
    roundTableUnder(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { enabled: true }));
    eq('re-apply on a table that gains a number (grid, setup): the first pass simplifies nothing',
      showsSimplified(grid.wrapperEl), false);
    aText.nodeValue = '8,584,629';
    reapplyRounding(grid.wrapperEl);
    eq('re-apply on a table that gains a number (grid): the new number simplifies',
      aText.nodeValue, '8,500,000');
    eq('re-apply on a table that gains a number (grid): the table shows simplified values',
      showsSimplified(grid.wrapperEl), true);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function reapply_onTableThatGainsANumberSimplifiesIt_native() {
  withCreateTreeWalker(function() {
    const table = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'north' }, { tag: 'td', text: 'south' }],
      [{ tag: 'td', text: 'east' }, { tag: 'td', text: 'pending' }],
    ]);
    const cell = table._cells[3];
    try {
      roundTableUnder(table, Object.assign({}, DR_DEFAULTS, { enabled: true }));
      eq('re-apply on a table that gains a number (native, setup): the first pass simplifies nothing',
        showsSimplified(table), false);
      cell.innerText = '8,584,629';
      cell.textContent = '8,584,629';
      reapplyRounding(table);
      eq('re-apply on a table that gains a number (native): the new number simplifies',
        cell.innerText, '8,500,000');
      eq('re-apply on a table that gains a number (native): the table shows simplified values',
        showsSimplified(table), true);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// Numbers in separate text pieces and unit numbers on grids. A grid cell's
// text is its flat text. A cell that holds whole numbers in separate text
// pieces rounds each in its own piece. A unit number's digits change and its suffix
// or currency code stays. An extracted cell rounds as it does on a native
// table. makeKeyStatsGrid (helpers.js) states the grid's dataset.
// ---------------------------------------------------------------------------

const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyDates: true });

// "Revenue 500 units" and "DT1234" round like any extracted cell, but both
// show unchanged pieces here: 500 already sits on the step this dataset's
// magnitude rounds to, so it formats back to itself, and "DT1234"'s digits
// sit glued to a letter with no separator, so the number extractor never
// finds them at all — on a grid or a native table alike.
(function gridSeparatePieces_roundWritesEachNumberInItsPiece() {
  const grid = makeKeyStatsGrid();
  const piecesBefore = grid.cellEls.map(gridCellTextPieces);
  try {
    const result = roundTable(grid.wrapperEl, KEY_STATS_OPTS);
    eq('grid separate pieces: each cell\'s pieces after the round',
      grid.cellEls.map(pieceTextsOf), [
        ['$350'], ['5tn'],
        [' 150 ', ' 150'], ['$', '350'],
        ['40m'], ['4.', '91', 'tn'],
        ['Revenue 500 units'], ['DT1234'],
        ['7.5m'], ['2024-', '03-15'],
      ]);
    eq('grid separate pieces: every text piece is the same node object after the round',
      keepsEveryTextPiece(grid.cellEls, piecesBefore), true);
    eq('grid separate pieces: the max magnitude counts the numbers in separate pieces one by one',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 2);
    eq('grid separate pieces: the pass counts the split number and the split date',
      result.leftAsWritten, { splitValue: 2, textMismatch: 0 });
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function gridSeparatePieces_recordAndRestore() {
  const grid = makeKeyStatsGrid();
  const [, , pair, dollar] = grid.cellEls;
  const originalPieces = grid.cellEls.map(pieceTextsOf);
  try {
    roundTable(grid.wrapperEl, KEY_STATS_OPTS);
    eq('grid separate pieces: the record holds the flat original and each piece\'s original and written text',
      DR_MODEL.getTableOriginal(grid.wrapperEl, pair),
      { value: ' 125 \n 126', pieces: [{ text: ' 125 ', written: ' 150 ' }, { text: ' 126', written: ' 150' }],
        pageTitle: '' });
    eq('grid separate pieces: an untouched "$" piece holds the same original and written text',
      DR_MODEL.getTableOriginal(grid.wrapperEl, dollar).pieces,
      [{ text: '$', written: '$' }, { text: '337.91', written: '350' }]);
    resetTable(grid.wrapperEl);
    eq('grid separate pieces: the restore restores every cell', showsSimplified(grid.wrapperEl), false);
    eq('grid separate pieces: the restore puts every piece back', grid.cellEls.map(pieceTextsOf), originalPieces);
    eq('grid separate pieces: the restore clears every record',
      grid.cellEls.some((cell) => DR_MODEL.hasTableOriginal(grid.wrapperEl, cell)), false);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A cell with numbers in separate pieces whose first piece gets shorter: a later piece's position
// moves, so the re-apply measures each patch against the live pieces.
(function gridSeparatePieces_reapplyAfterAPieceShortened() {
  const grid = makeE2EGridWrapper([['337.91 126']]);
  const [cell] = grid.cellEls;
  const first = makeCountingTextNode('337.91');
  const second = makeCountingTextNode('126');
  setGridCellPieces(cell, [makeElementNode('a1', [first]), makeElementNode('a2', [second])], { lines: true });
  try {
    roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid separate pieces re-apply (setup): both pieces round', pieceTextsOf(cell), ['350', '150']);
    reapplyRounding(grid.wrapperEl);
    eq('grid separate pieces re-apply: pieces already patched are not written again',
      [first.writes, second.writes], [1, 1]);
    second.nodeValue = '126';
    reapplyRounding(grid.wrapperEl);
    eq('grid separate pieces re-apply: a later piece redrawn to its original is patched again',
      pieceTextsOf(cell), ['350', '150']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// Numbers in separate pieces, edge cases. Dataset 125, 126, 4.91, so the max magnitude is 2:
// 125 → 150, 126 → 150, 4.91 → 5.
//   a: one number per block element with no whitespace between in the
//      markup: the rendered text puts each on its own line, so the digits
//      beside digits across pieces read as two numbers
//   b: a suffix in its own piece
//   c: digits that join across a piece boundary: unchanged
//   d: two unit numbers, one per block element: the rendered text puts each
//      on its own line, so both round
//   e: a number split before its decimal point: unchanged
(function gridSeparatePieces_edges() {
  const grid = makeE2EGridWrapper([['125126', '4.91tn', '416 5551234', '4.91tn41.31m', '4.91']]);
  const [a, b, c, d, e] = grid.cellEls;
  setGridCellPieces(e, [makeTextNode('4'), makeElementNode('dec', [makeTextNode('.91')])]);
  setGridCellPieces(a, [makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])], { lines: true });
  setGridCellPieces(b, [makeTextNode('4.91'), makeElementNode('u', [makeTextNode('tn')])]);
  setGridCellPieces(c, [makeTextNode('416 555'), makeElementNode('x', [makeTextNode('1234')])]);
  setGridCellPieces(d, [makeElementNode('l1', [makeTextNode('4.91tn')]), makeElementNode('l2', [makeTextNode('41.31m')])], { lines: true });
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid separate pieces: one number per element with no whitespace between rounds number by number',
      pieceTextsOf(a), ['150', '150']);
    eq('grid separate pieces: a suffix in its own piece stays and the digits round', pieceTextsOf(b), ['5', 'tn']);
    eq('grid separate pieces: digits that join across a piece boundary leave the cell unchanged',
      pieceTextsOf(c), ['416 555', '1234']);
    eq('grid separate pieces: two unit numbers on separate lines both round',
      pieceTextsOf(d), ['5tn', '40m']);
    eq('grid separate pieces: a number split before its decimal point stays unchanged',
      pieceTextsOf(e), ['4', '.91']);
    eq('grid separate pieces: the max magnitude leaves out the cell whose digits join across a piece boundary',
      DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 2);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// The cells of the native separate pieces test above, on a grid (test page
// section 25). A grid reads the gap between
// two pieces from the cell's rendered text, as a native table does, so one
// number that inline styling splits ("6,7" plain, "18,245" in bold) stays
// unchanged.
(function gridSeparatePieces_sameCellsAsTheNativeTable() {
  const grid = makeE2EGridWrapper([['$337.91', '125126', '6,718,245']]);
  const [a, b, c] = grid.cellEls;
  setGridCellPieces(a, [makeElementNode('s', [makeTextNode('$')]), makeElementNode('n', [makeTextNode('337.91')])]);
  setGridCellPieces(b, [makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])], { lines: true });
  setGridCellPieces(c, [makeTextNode('6,7'), makeElementNode('b', [makeTextNode('18,245')])]);
  try {
    const result = roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid separate pieces: a currency sign in its own piece stays and the number rounds, as on a native table',
      pieceTextsOf(a), ['$', '350']);
    eq('grid separate pieces: one number per line rounds, as on a native table',
      pieceTextsOf(b), ['150', '150']);
    eq('grid separate pieces: one number that inline styling splits stays unchanged, as on a native table',
      pieceTextsOf(c), ['6,7', '18,245']);
    eq('grid separate pieces: the pass counts the styled number as a split number',
      result.leftAsWritten.splitValue, 1);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// The joined text of numbers in separate pieces ("1500 1600") looks like digit groups split by
// whitespace, but its digits sit in several text pieces, so the spaced-digit
// identifier shape does not apply and each number rounds. A one-piece cell
// with the same kind of text stays as written. Dataset 1500, 1600, 45, 46,
// so the max magnitude is 3: 1500 → 1,500, 1600 → 1,500, 45 → 45, 46 → 45.
(function gridSeparatePieces_digitsInSeveralPiecesAreNotOneIdentifier() {
  const grid = makeE2EGridWrapper([['1500 1600', '45 46', '4165 5512']]);
  const [a, b, c] = grid.cellEls;
  setGridCellPieces(a, [makeTextNode(' 1500 '), makeElementNode('br', []), makeTextNode(' 1600')]);
  setGridCellPieces(b, [makeElementNode('l1', [makeTextNode('45')]), makeTextNode(' '),
    makeElementNode('l2', [makeTextNode('46')])]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid separate pieces: numbers in several pieces round though their join looks like spaced digit groups',
      pieceTextsOf(a), [' 1,500 ', ' 1,500']);
    eq('grid separate pieces: two-digit numbers in several pieces round number by number',
      pieceTextsOf(b), ['45', ' ', '45']);
    eq('grid separate pieces: spaced digit groups in one piece stay as written',
      pieceTextsOf(c), ['4165 5512']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A markup range holds on a cell with numbers in separate pieces: a number inside a link stays, and
// once the cell is rounded the record's kept positions drive the preview.
(function gridSeparatePieces_markupRange() {
  const grid = makeE2EGridWrapper([['125126']]);
  const [cell] = grid.cellEls;
  const plain = makeElementNode('p', [makeTextNode('125')]);
  const anchor = makeElementNode('a', [makeTextNode('126')]);
  anchor.tagName = 'A';
  anchor.innerText = '126';
  setGridCellPieces(cell, [plain, anchor], { lines: true });
  cell.querySelectorAll = (sel) => (sel === 'a' ? [anchor] : []);
  cell.contains = (node) => node === anchor || node === plain;
  for (const holder of [plain, anchor]) {
    holder.childNodes[0].parentElement = holder;
    holder.closest = (sel) => (sel === 'a' && holder === anchor ? anchor : null);
  }
  const pool = () => collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((sample) => sample.num);
  withGridPieceTreeWalker(() => {
    try {
      eq('grid separate pieces link (setup): the preview leaves out the linked number', pool(), [125]);
      roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
      eq('grid separate pieces link: the number inside the link stays', pieceTextsOf(cell), ['150', '126']);
      reapplyRounding(grid.wrapperEl);
      eq('grid separate pieces link: the number inside the link stays after a re-apply', pieceTextsOf(cell), ['150', '126']);
      eq('grid separate pieces link: the preview after the round leaves out the linked number', pool(), [125]);
    } finally {
      DR_MODEL.unregisterTable(grid.wrapperEl);
    }
  });
})();

// Cells with numbers in separate pieces that stay unchanged, and the ones that round. Dataset
// 4.91, 125, and 126, so the max magnitude is 2.
//   a: a number beside a superscript in a <sup>, glued together with no
//      separator: the base number rounds and the superscript stays,
//      exactly as a native table rounds this shape — the digit run
//      right after the <sup> is never even a candidate match, since the
//      number extractor never starts a match right after a letter
//   b: a year above a year: each piece holds a number
//   c: "1," then "234": a number split after its grouping comma
//   d: a listed currency code in its own piece above two numbers
(function gridSeparatePieces_cellsThatStayAndCellsThatRound() {
  const grid = makeE2EGridWrapper([['4.91T12', '20242025', '1,234', 'CAD125126']]);
  const [a, b, c, d] = grid.cellEls;
  const sup = makeElementNode('sup', [makeTextNode('12')]);
  setGridCellPieces(a, [makeTextNode('4.91T'), sup]);
  a.querySelector = (sel) => (sel === 'sup' ? sup : null);
  setGridCellPieces(b, [makeElementNode('l1', [makeTextNode('2024')]), makeElementNode('l2', [makeTextNode('2025')])], { lines: true });
  setGridCellPieces(c, [makeTextNode('1,'), makeElementNode('g', [makeTextNode('234')])]);
  setGridCellPieces(d, [makeElementNode('c', [makeTextNode('CAD')]),
    makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])], { lines: true });
  const opts = Object.assign({}, PATCH_GRID_OPTS, { simplifyDates: true });
  try {
    eq('grid separate pieces: the lens preview samples keep the superscript\'s base number and the years, and leave out the split number',
      collectNumericCells(grid.wrapperEl, opts).map((sample) => sample.num).sort((x, y) => x - y), [4.91, 125, 126, 2024, 2025]);
    roundTable(grid.wrapperEl, opts);
    eq('grid separate pieces: a cell with a <sup> rounds its base and keeps the superscript', pieceTextsOf(a), ['5T', '12']);
    eq('grid separate pieces: years on separate lines round, as on a native table', pieceTextsOf(b), ['2,000', '2,000']);
    eq('grid separate pieces: a number split after its grouping comma stays unchanged', pieceTextsOf(c), ['1,', '234']);
    eq('grid separate pieces: a currency code in its own piece stays and the numbers round',
      pieceTextsOf(d), ['CAD', '150', '150']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A grid cell whose <sup> is a real footnote, separated from its base
// number by whitespace rather than glued to it: the base rounds, the
// footnote digit stays. A later re-apply and the lens preview locate the
// footnote's piece through the piece layout, so the rounded, therefore
// shifted, live text does not move the mask.
(function gridFootnote_maskSurvivesReapplyAndPreview() {
  const grid = makeE2EGridWrapper([['Revenue 837 units 7']]);
  const [cell] = grid.cellEls;
  const sup = makeElementNode('sup', [makeTextNode('7')]);
  sup.tagName = 'SUP';
  sup.childNodes[0].parentElement = sup;
  const plain = makeTextNode('Revenue 837 units ');
  setGridCellPieces(cell, [plain, sup]);
  cell.querySelector = (sel) => (sel === 'sup' ? sup : null);
  const pool = () => collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((sample) => sample.num);
  withGridPieceTreeWalker(() => {
    try {
      roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
      eq('grid footnote: the base rounds and the footnote digit stays',
        pieceTextsOf(cell), ['Revenue 850 units ', '7']);
      reapplyRounding(grid.wrapperEl);
      eq('grid footnote: the footnote digit stays after a re-apply',
        pieceTextsOf(cell), ['Revenue 850 units ', '7']);
      eq('grid footnote: the preview after the round reads the base number, not the footnote digit', pool(), [837]);
    } finally {
      DR_MODEL.unregisterTable(grid.wrapperEl);
    }
  });
})();

// A grid cell whose raised digits sit in a span styled vertical-align: super
// rounds exactly like the same cell written with a <sup>.
(function gridStyledSuperscript_roundsLikeASupCell() {
  const roundOne = (raisedEl) => {
    const grid = makeE2EGridWrapper([['4,523,789 12']]);
    const [cell] = grid.cellEls;
    raisedEl.childNodes[0].parentElement = raisedEl;
    setGridCellPieces(cell, [makeTextNode('4,523,789 '), raisedEl]);
    cell.querySelector = (sel) => (sel === 'sup' && raisedEl.tagName === 'SUP' ? raisedEl : null);
    try {
      roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
      return pieceTextsOf(cell);
    } finally {
      DR_MODEL.unregisterTable(grid.wrapperEl);
    }
  };
  const sup = Object.assign(makeElementNode('sup', [makeTextNode('12')]), { tagName: 'SUP' });
  const styled = Object.assign(makeElementNode('raised', [makeTextNode('12')]),
    { tagName: 'SPAN', style: { verticalAlign: 'super' } });
  const savedStyle = global.getComputedStyle;
  global.getComputedStyle = inlineStyleProbe.getComputedStyle;
  try {
    withGridPieceTreeWalker(() => {
      const supTexts = roundOne(sup);
      const styledTexts = roundOne(styled);
      eq('styled superscript (grid): the base rounds and the raised digits stay', styledTexts, ['4,500,000 ', '12']);
      eq('styled superscript (grid): the cell rounds the same as a <sup> cell', styledTexts, supTexts);
    });
  } finally {
    global.getComputedStyle = savedStyle;
  }
})();

// A rounded grid footnote cell whose base piece shrinks: the live piece the
// footnote sits beside is now shorter than it was when the cell first
// classified, so a re-apply that re-measured the superscript mask against
// the LIVE pieces' text would mask the wrong position in the frozen
// pre-round text and let the footnote round as an ordinary number.
(function gridFootnote_maskSurvivesAReapplyAfterTheBaseShrinks() {
  const grid = makeE2EGridWrapper([['Revenue 4.91tn units 137']]);
  const [cell] = grid.cellEls;
  const sup = makeElementNode('sup', [makeTextNode('137')]);
  sup.tagName = 'SUP';
  sup.childNodes[0].parentElement = sup;
  const plain = makeTextNode('Revenue 4.91tn units ');
  setGridCellPieces(cell, [plain, sup]);
  cell.querySelector = (sel) => (sel === 'sup' ? sup : null);
  withGridPieceTreeWalker(() => {
    try {
      roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
      const afterFirstRound = pieceTextsOf(cell);
      eq('grid footnote re-apply (setup): the base rounds and the footnote holds',
        afterFirstRound[1], '137');
      reapplyRounding(grid.wrapperEl);
      eq('grid footnote re-apply: the footnote stays masked after the base has already shrunk',
        pieceTextsOf(cell), afterFirstRound);
    } finally {
      DR_MODEL.unregisterTable(grid.wrapperEl);
    }
  });
})();

// A rounded cell with numbers in separate pieces that the page redraws with
// fewer pieces is a rewritten cell. Its one remaining piece shows the extension's
// written text for the first stored piece, so it matches that piece by text
// and takes its original back before the record drops: the re-apply then
// simplifies the cell from 125, the lens preview reads 125, and a restore puts
// 125 back and leaves nothing unrestorable.
(function gridSeparatePieces_aRoundedCellThatLostAPiece() {
  const grid = makeE2EGridWrapper([['125126']]);
  const [cell] = grid.cellEls;
  setGridCellPieces(cell, [makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])], { lines: true });
  try {
    roundTableUnder(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid separate pieces (setup): the first simplification writes 150 into the first piece',
      pieceTextsOf(cell)[0], '150');
    setGridCellPieces(cell, [makeElementNode('l1', [makeTextNode('150')])]);
    let threw = null;
    try { reapplyRounding(grid.wrapperEl); } catch (e) { threw = String(e); }
    eq('grid separate pieces: the re-apply simplifies a cell that lost a piece from the original its written text matches',
      { threw, pieces: pieceTextsOf(cell), original: DR_MODEL.getTableOriginalText(grid.wrapperEl, cell) },
      { threw: null, pieces: ['150'], original: '125' });
    eq('grid separate pieces: the lens preview reads the matched original in a cell that lost a piece',
      collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((c) => c.num), [125]);
    resetTable(grid.wrapperEl);
    eq('grid separate pieces: the restore leaves nothing unrestorable after a cell lost a piece',
      showsSimplified(grid.wrapperEl), false);
    eq('grid separate pieces: the restore puts the matched original back', pieceTextsOf(cell), ['125']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// A unit number that is the largest number on the grid sets the frozen max
// magnitude: 5,432.1 has magnitude 3.
(function gridSeparatePieces_aUnitNumberJoinsTheDataset() {
  const grid = makeE2EGridWrapper([['4.91', '5,432.1m']]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid separate pieces: a unit number joins the dataset', DR_MODEL.getTableMaxMagnitude(grid.wrapperEl), 3);
    eq('grid separate pieces: the unit number keeps its suffix', pieceTextsOf(grid.cellEls[1]), ['5,500m']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function gridSeparatePieces_currencyOffKeepsTheNumberASymbolInItsOwnPieceTouches() {
  const grid = makeKeyStatsGrid();
  const [, unit, , dollar] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, Object.assign({}, KEY_STATS_OPTS, { simplifyMixedCurrency: false }));
    eq('grid separate pieces: with the currency switch off, the number a "$" in its own piece touches stays as written',
      pieceTextsOf(dollar), ['$', '337.91']);
    eq('grid separate pieces: with the currency switch off, a suffixed number still rounds',
      pieceTextsOf(unit), ['5tn']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// The lens preview lists exactly the numbers the grid rounds: the numbers in
// separate pieces one by one, the unit numbers, the number inside "Revenue 500
// units", and nothing from "DT1234" (the reason sits above
// gridSeparatePieces_roundWritesEachNumberInItsPiece) or the split number or
// the link. It lists the same numbers once the grid is rounded, read from the
// records.
(function gridSeparatePieces_lensPreviewMatchesThePage() {
  const grid = makeKeyStatsGrid();
  const nums = () => collectNumericCells(grid.wrapperEl, KEY_STATS_OPTS)
    .map((sample) => sample.num).sort((x, y) => x - y);
  const expected = [4.91, 41.31, 125, 126, 337.91, 338.49, 500];
  try {
    eq('grid separate pieces: the lens preview pool before the round', nums(), expected);
    roundTable(grid.wrapperEl, KEY_STATS_OPTS);
    eq('grid separate pieces: the lens preview pool after the round', nums(), expected);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// ---------------------------------------------------------------------------
// The lens preview on a grid
// ---------------------------------------------------------------------------

(function lensPreview_gridSamples() {
  // Numbers of two magnitudes fill both bands, behind a header row and a
  // label column, which the defaults leave as written.
  const grid = makeGridWrapper([
    ['label', 'x', 'y'],
    ['R1', '8584629', '286'],
    ['R2', '9123456', '514'],
    ['R3', '7654321', '432'],
  ]);

  const result = extractPreviewSamples(grid.wrapperEl);
  eq('lens preview of a grid of 7M to 9M and 286 to 514: maxMag is 6',
    result.maxMag, 6);
  eq('lens preview of a grid of 7M to 9M and 286 to 514: the top band holds 8,584,629',
    result.samples.top.map((sample) => sample.num), [8584629]);
  eq('lens preview of a grid of 7M to 9M and 286 to 514: the top-band sample holds its original text',
    result.samples.top.map((sample) => sample.original), ['8584629']);
  eq('lens preview of a grid of 7M to 9M and 286 to 514: the other band holds 286',
    result.samples.other.map((sample) => sample.num), [286]);
})();

// The grid read is the cell's flat text: every text piece, joined in
// page order, however deep the pieces sit.
(function gridRead_isTheFlatText() {
  const readOf = (cell) => makeCellObj(cell, new GridAdapter({}).originalsPort).getText();
  eq('grid read: a piece inside nested elements is read',
    readOf(makeElementNode('cell', [makeElementNode('inner', [makeTextNode('42')])])), '42');
  eq('grid read: a cell with no text piece reads as empty',
    readOf(makeElementNode('cell', [makeElementNode('inner', [])])), '');
  eq('grid read: a whitespace piece is part of the read',
    readOf(makeElementNode('cell', [makeTextNode('   ')])), '   ');
  eq('grid read: every piece joins in page order',
    readOf(makeElementNode('cell', [makeTextNode('first'), makeElementNode('b', [makeTextNode('42')])])), 'first42');
})();

// =============================================================================
// Grid writes through roundTable and resetTable: each change lands in its
// text node's nodeValue, never through an innerHTML write, which breaks a
// framework that renders the cell, such as React.
// =============================================================================

// The registry original is stored once: a second write against the
// patched piece lands nothing and leaves the stored original in place.
// A re-round starts from restored text: every apply restores the table first.
(function gridWrite_theRegistryOriginalIsStoredOnce() {
  const grid = makeGridWrapper([['12345']]);
  const adapter = makeAdapter(grid.wrapperEl, { originalsPort: registryOriginalsPort(grid.wrapperEl) });
  const cellObj = adapter.getRows()[0].getCells()[0];

  // First write: original should be stored
  cellObj.applyPatches([{ index: 0, numStr: '12345', newNum: '12000' }], { value: cellObj.getText() });
  eq('grid write: the first write stores the registry original',
    DR_MODEL.getTableOriginalText(grid.wrapperEl, grid.cellEls[0]), '12345');

  // Second write, against the piece's patched text: the piece no longer
  // shows its stored original, so nothing lands.
  eq('grid write: a second write into the patched piece lands nothing',
    cellObj.applyPatches([{ index: 0, numStr: '12000', newNum: '10000' }], { value: cellObj.getText() }), 0);
  eq('grid write: the second write leaves the registry original in place',
    DR_MODEL.getTableOriginalText(grid.wrapperEl, grid.cellEls[0]), '12345');
  eq('grid write: the piece keeps the first write',
    grid.cellEls[0].childNodes[0].nodeValue, '12000');
})();

(function gridWrite_marksOnlyConfirmedWrites() {
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
  ]);
  // The page redraws every cell between classification and the write:
  // roundTable stores the frozen max magnitude between the two, so the
  // redraw runs there. Each patch then finds other characters at its
  // position, and every write skips.
  const setMaxMagnitude = DR_MODEL.setTableMaxMagnitude;
  DR_MODEL.setTableMaxMagnitude = function (table, value) {
    for (const cell of grid.cellEls) cell.childNodes[0].nodeValue = '1';
    return setMaxMagnitude.call(DR_MODEL, table, value);
  };
  try {
    const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
    const result = roundTable(grid.wrapperEl, opts);
    eq('grid patch: a write that lands nothing adds no marker through roundTable',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), false);
    eq('grid patch: a grid whose every write skipped shows its originals',
      showsSimplified(grid.wrapperEl), false);
    eq('grid patch: the pass counts the skipped writes as left as written for a text mismatch',
      result.leftAsWritten.textMismatch > 0, true);
  } finally {
    DR_MODEL.setTableMaxMagnitude = setMaxMagnitude;
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// ---------------------------------------------------------------------------
// A grid under the defaults: the first row and the first column stay as
// written, and a number in the second column rounds.
// ---------------------------------------------------------------------------
(function grid_theFirstRowAndColumnStayUnderTheDefaults() {
  // Row 0 sits under the first-row exclusion. In row 1, "abc 1234567 def"
  // sits under the first-column exclusion, and 9876543 in the second column
  // rounds.
  const grid = makeE2EGridWrapper([
    ['placeholder', '0'],
    ['abc 1234567 def', '9876543'],
  ]);
  const extractedCell = grid.cellEls[2];
  const pureCell = grid.cellEls[3];

  roundTable(grid.wrapperEl, Object.assign({}, DR_DEFAULTS));

  eq('grid under the defaults: "abc 1234567 def" in the first column is not rounded',
    extractedCell.classList.contains('dr-ext-rounded'), false);
  eq('grid under the defaults: the extracted cell in the first column keeps its text',
    extractedCell.childNodes[0].nodeValue, 'abc 1234567 def');
  eq('grid under the defaults: the pure cell 9876543 in the second column carries the marker',
    pureCell.classList.contains('dr-ext-rounded'), true);
  eq('grid under the defaults: the pure cell 9876543 rounds to 10,000,000',
    pureCell.childNodes[0].nodeValue, '10,000,000');
  eq('grid under the defaults: the pure cell stores its registry original',
    DR_MODEL.getTableOriginalText(grid.wrapperEl, pureCell), '9876543');
  eq('grid under the defaults: the extracted cell in the first column stores no registry original',
    DR_MODEL.getTableOriginal(grid.wrapperEl, extractedCell), undefined);
})();

// ---------------------------------------------------------------------------
// A grid cell's write reports whether it landed, and only a confirmed write
// marks the cell. A grid cell can hold a number yet no text piece for the
// nodeValue write to patch; such a write skips and leaves no marker.
// ---------------------------------------------------------------------------

(function gridApplyPatchesReturnsLanded() {
  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const port = makePort();
  const adapter = new GridAdapter({}, { originalsPort: port });

  const withNode = makeCellObj(makeGridCellWithTextNode('8584629'), adapter.originalsPort);
  eq('grid patch: applyPatches returns a landed count when the write lands',
    withNode.applyPatches([{ index: 0, numStr: '8584629', newNum: '8,500,000' }], { value: withNode.getText() }), 1);

  const bareEl = makeElementNode('', []);
  bareEl.textContent = '8584629';
  const bare = makeCellObj(bareEl, adapter.originalsPort);
  eq('grid patch: applyPatches returns zero when the cell has no text piece',
    bare.applyPatches([{ index: 0, numStr: '8584629', newNum: '8,500,000' }], { value: bare.getText() }), 0);
  eq('grid patch: a skipped write adds no marker and no record',
    { marked: bareEl.classList.contains('dr-ext-rounded'), recorded: port.has(bareEl) },
    { marked: false, recorded: false });
})();

// =============================================================================
// The re-apply observer on both table kinds
// =============================================================================

// ---------------------------------------------------------------------------
// A grid that reuses its row elements appends a new row while the grid is
// rounded: the observer's pass, once the settle delay passes, rounds the new
// row's cells.
// ---------------------------------------------------------------------------
(function reapplyObserver_aNewRowRounds() {
  let ctx;
  try {
    // 2-row grid with big numbers so rounding changes the value.
    ctx = setupVirtGrid([
      ['8584629', '1234567'],
      ['7654321', '2345678'],
    ]);
    const { grid, pendingTimers } = ctx;

    eq('re-apply observer new row (setup): an existing cell is rounded',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), true);

    // The grid appends a new, unrounded row.
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

    const obs = ctx.capturedObserver;
    eq('re-apply observer new row (setup): the grid holds a re-apply observer',
      obs !== null, true);

    obs.trigger([{ type: 'childList' }]);
    flushTimers(pendingTimers);

    eq('re-apply observer new row: the first new cell is rounded',
      newCell0.classList.contains('dr-ext-rounded'), true);
    eq('re-apply observer new row: the second new cell is rounded',
      newCell1.classList.contains('dr-ext-rounded'), true);
    eq('re-apply observer new row: the new 9876543 rounds to 10,000,000 under the frozen max magnitude',
      newCell0.childNodes[0].nodeValue, '10,000,000');
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// The page redraws a rounded cell's piece to its original in place, as a
// sort does: same text node, marker still on. The observer's pass rounds the
// cell again.
// ---------------------------------------------------------------------------
(function reapplyObserver_aPieceRedrawnToItsOriginalRoundsAgain() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;

    const cell0 = grid.cellEls[0];
    eq('re-apply observer redraw (setup): the first cell carries the marker after the first simplification',
      cell0.classList.contains('dr-ext-rounded'), true);

    const tn0 = cell0.childNodes[0];
    const roundedValue = tn0.nodeValue;
    const originalValue = DR_MODEL.getTableOriginalText(grid.wrapperEl, cell0);

    eq('re-apply observer redraw (setup): the rounded value differs from the original',
      roundedValue !== originalValue, true);

    tn0.nodeValue = originalValue;
    eq('re-apply observer redraw (setup): the marker stays on through the redraw',
      cell0.classList.contains('dr-ext-rounded'), true);

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn0 }]);
    flushTimers(pendingTimers);

    eq('re-apply observer redraw: the cell shows its rounded value again',
      cell0.childNodes[0].nodeValue, roundedValue);
    eq('re-apply observer redraw: the cell still carries the marker',
      cell0.classList.contains('dr-ext-rounded'), true);
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// A burst of page changes runs one pass: five rapid changes leave one live
// settle-delay timer, and its pass schedules no further timer.
// ---------------------------------------------------------------------------
(function reapplyObserver_aBurstRunsOnePass() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    for (let i = 0; i < 5; i++) {
      obs.trigger([{ type: 'childList' }]);
    }

    const activeCnt = pendingTimers.filter(function(t) { return !t.cancelled; }).length;
    eq('re-apply observer burst: five rapid changes leave exactly one live settle-delay timer',
      activeCnt, 1);

    flushTimers(pendingTimers);
    const newTimers = pendingTimers.filter(function(t, i) { return i >= 5; });
    eq('re-apply observer burst: the one pass schedules no further timer',
      newTimers.filter(function(t) { return !t.cancelled; }).length, 0);
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// The pass's own writes schedule no pass: the pass disconnects the observer
// before it writes and reconnects it after.
// ---------------------------------------------------------------------------
(function reapplyObserver_ownWritesScheduleNoPass() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    obs.trigger([{ type: 'childList' }]);
    const countBefore = pendingTimers.length;

    flushTimers(pendingTimers);

    eq('re-apply observer own writes: the pass schedules no new timer',
      pendingTimers.length, countBefore);
    eq('re-apply observer own writes: the pass disconnects the observer before it writes',
      obs.disconnectCount >= 1, true);
    eq('re-apply observer own writes: the observer is connected again after the pass',
      obs.reconnectCount >= 2, true);  // once in roundTable, once in reapplyRounding
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// After a restore, a page change rounds nothing: the restore disconnects the
// observer and clears its timer.
// ---------------------------------------------------------------------------
(function reapplyObserver_afterARestoreRoundsNothing() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    eq('re-apply observer restore (setup): the grid holds an observer entry',
      reapplyObservers.has(grid.wrapperEl), true);

    resetTable(grid.wrapperEl);

    eq('re-apply observer restore: the restore removes the observer entry',
      reapplyObservers.has(grid.wrapperEl), false);
    eq('re-apply observer restore: the restore removes the timer entry',
      reapplyTimers.has(grid.wrapperEl), false);
    eq('re-apply observer restore: the restore disconnects the observer',
      obs.disconnectCount >= 1, true);

    // A disconnected observer fires no callback on a real page; the stub
    // fires it anyway. The pass then finds no observer entry and writes
    // nothing.
    obs.trigger([{ type: 'childList' }]);
    flushTimers(pendingTimers);

    eq('re-apply observer restore: a later page change leaves the first cell without the marker',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), false);
    eq('re-apply observer restore: a later page change leaves the first cell at its original',
      grid.cellEls[0].childNodes[0].nodeValue, '8584629');
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// A press turning simplification off on a virtualized grid restores the
// original values, and the re-apply observer does not round them again. An
// observer that saw the restore writes' characterData mutations would round
// the cells again about 100 milliseconds later, so they would flash the
// original and then show simplified values while the table is off.
//
// Off is a restore, which disconnects the observer. This test drives a
// mutation through anyway — the stub calls the callback whether or not the
// observer was disconnected, so the re-apply's own bail is still what the
// assertions read.
// ---------------------------------------------------------------------------
(function reapplyObserver_aPressOffRoundsNothingAgain() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    eq('re-apply observer press off (setup): the first cell is rounded after the first simplification',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), true);

    // The user presses the grid's table pillbox to turn simplification off.
    resetTable(grid.wrapperEl);

    eq('re-apply observer press off: the grid shows its originals after the press turns simplification off',
      showsSimplified(grid.wrapperEl), false);
    eq('re-apply observer press off: the first cell shows its original',
      grid.cellEls[0].childNodes[0].nodeValue, '8584629');

    // The restore writes fire characterData mutations the observer listens
    // for; the stub fires one, and the settle-delay timer runs.
    obs.trigger([{ type: 'characterData' }]);
    flushTimers(pendingTimers);

    // The re-apply bails because the restore removed the table's re-apply
    // observer.
    eq('re-apply observer press off: the first cell still shows its original after the observer fires',
      grid.cellEls[0].childNodes[0].nodeValue, '8584629');
    eq('re-apply observer press off: the second cell still shows its original after the observer fires',
      grid.cellEls[1].childNodes[0].nodeValue, '100');

    // A press back on runs the apply, which re-simplifies from the table's
    // settings. setupVirtGrid rounds with the first row and column included;
    // the table's settings here carry the same, so the re-simplify reaches
    // the same cells.
    DR_MODEL.setTableSettings(grid.wrapperEl,
      { simplifyFirstRow: true, simplifyFirstColumn: true, enabled: true }, 'page');
    applyTableSettings(grid.wrapperEl);
    eq('re-apply observer press off: the grid shows simplified values after the press turns simplification back on',
      showsSimplified(grid.wrapperEl), true);
    eq('re-apply observer press off: the first cell rounds to 8,500,000 after the press turns simplification back on',
      grid.cellEls[0].childNodes[0].nodeValue, '8,500,000');
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// A native <table> gets the same re-apply observer a grid gets, watching the
// table element itself.
// ---------------------------------------------------------------------------
(function reapplyObserver_aNativeTableGetsOne() {
  const origMO = global.MutationObserver;
  const origSetTimeout = global.setTimeout;
  try {
    let moConstructCount = 0;
    global.MutationObserver = class {
      constructor(cb) { moConstructCount++; this._cb = cb; }
      observe() {}
      disconnect() {}
    };
    global.setTimeout = () => 99;

    const nativeTable = makeTablePillboxTestTable([
      [{ tag: 'td', text: '8584629' }, { tag: 'td', text: '1234567' }],
      [{ tag: 'td', text: '7654321' }, { tag: 'td', text: '2345678' }],
    ]);
    withCreateTreeWalker(() => {
      roundTable(nativeTable, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true }));
    });

    eq('re-apply observer native table: a native <table> holds a re-apply observer after roundTable',
      reapplyObservers.has(nativeTable), true);
    eq('re-apply observer native table: the observer watches the native table element itself',
      (reapplyObservers.get(nativeTable) || {}).target === nativeTable, true);
    eq('re-apply observer native table: one MutationObserver is built for the native table',
      moConstructCount, 1);
    resetTable(nativeTable);
  } finally {
    global.MutationObserver = origMO;
    global.setTimeout = origSetTimeout;
  }
})();

// ---------------------------------------------------------------------------
// A grid the page removes: the teardown disconnects its re-apply observer
// and cancels its pending timer.
// ---------------------------------------------------------------------------
(function reapplyObserver_aRemovedGridTearsDown() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    obs.trigger([{ type: 'childList' }]);

    eq('re-apply observer removed grid (setup): a settle-delay timer is pending',
      pendingTimers.filter(function(t) { return !t.cancelled; }).length, 1);
    eq('re-apply observer removed grid (setup): the grid holds an observer entry',
      reapplyObservers.has(grid.wrapperEl), true);

    // The removed-node observer in content.js (the tableObserver that watches
    // document.body) runs teardownTableEntry when it detects a tracked table was
    // removed from the DOM. In the test harness the tableObserver is a no-op
    // stub, so the teardown runs directly.
    teardownTableEntry(grid.wrapperEl);

    eq('re-apply observer removed grid: the teardown disconnects the observer',
      obs.disconnectCount >= 1, true);
    eq('re-apply observer removed grid: the teardown deletes the observer entry',
      reapplyObservers.has(grid.wrapperEl), false);
    eq('re-apply observer removed grid: the teardown deletes the timer entry',
      reapplyTimers.has(grid.wrapperEl), false);
    eq('re-apply observer removed grid: the teardown cancels the pending timer',
      pendingTimers.filter(function(t) { return !t.cancelled; }).length, 0);
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// The re-apply honors the first-row and first-column exclusions: an excluded
// cell is never written, and the max magnitude comes from the cells the
// exclusions leave in.
// ---------------------------------------------------------------------------
(function reapplyObserver_honorsTheFirstRowAndColumnExclusions() {
  let ctx;
  try {
    ctx = setupVirtGrid(
      [
        ['Header', '999999'],
        ['12345678', '87654321'],
      ],
      { simplifyFirstRow: false, simplifyFirstColumn: false }
    );
    const { grid, pendingTimers } = ctx;

    const cell_r0c0 = grid.cellEls[0];  // 'Header'    — first row
    const cell_r0c1 = grid.cellEls[1];  // '999999'    — first row
    const cell_r1c0 = grid.cellEls[2];  // '12345678'  — first column
    const cell_r1c1 = grid.cellEls[3];  // '87654321'  — rounds

    eq('re-apply exclusions (setup): row 0 column 0 is not rounded by the first pass (first row)',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);
    eq('re-apply exclusions (setup): row 0 column 1 is not rounded by the first pass (first row)',
      cell_r0c1.classList.contains('dr-ext-rounded'), false);
    eq('re-apply exclusions (setup): row 1 column 0 is not rounded by the first pass (first column)',
      cell_r1c0.classList.contains('dr-ext-rounded'), false);
    eq('re-apply exclusions (setup): row 1 column 1 is rounded by the first pass',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

    const tn_r1c1 = cell_r1c1.childNodes[0];
    const roundedValue_r1c1 = tn_r1c1.nodeValue;
    const originalValue_r1c1 = DR_MODEL.getTableOriginalText(grid.wrapperEl, cell_r1c1);

    eq('re-apply exclusions (setup): row 1 column 1 rounded value differs from the original',
      roundedValue_r1c1 !== originalValue_r1c1, true);

    // The page redraws the rounded cell's piece to its original.
    tn_r1c1.nodeValue = originalValue_r1c1;

    eq('re-apply exclusions (setup): row 1 column 1 keeps the marker through the redraw',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn_r1c1 }]);
    flushTimers(pendingTimers);

    eq('re-apply exclusions: row 0 column 0 keeps its text after the re-apply (first row)',
      cell_r0c0.childNodes[0].nodeValue, 'Header');
    eq('re-apply exclusions: row 0 column 0 carries no marker after the re-apply',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);
    eq('re-apply exclusions: row 1 column 0 keeps its text after the re-apply (first column)',
      cell_r1c0.childNodes[0].nodeValue, '12345678');
    eq('re-apply exclusions: row 1 column 0 carries no marker after the re-apply',
      cell_r1c0.classList.contains('dr-ext-rounded'), false);
    eq('re-apply exclusions: row 1 column 1, redrawn to its original, rounds again',
      cell_r1c1.childNodes[0].nodeValue, roundedValue_r1c1);
    eq('re-apply exclusions: row 1 column 1 still carries the marker after the re-apply',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// ---------------------------------------------------------------------------
// The re-apply honors the percent and currency switches: with both off, a
// percent cell and a currency cell stay as written through the re-apply.
// ---------------------------------------------------------------------------
(function reapplyObserver_honorsThePercentAndCurrencySwitches() {
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

    const cell_r0c0 = grid.cellEls[0];  // '75%'       — percent switch off
    const cell_r0c1 = grid.cellEls[1];  // '50%'       — percent switch off
    const cell_r1c0 = grid.cellEls[2];  // '12345678'  — rounds
    const cell_r1c1 = grid.cellEls[3];  // '$9999999'  — currency switch off

    eq('re-apply switches (setup): row 0 column 0 (75%) is not rounded by the first pass (percent switch off)',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);
    eq('re-apply switches (setup): row 0 column 1 (50%) is not rounded by the first pass (percent switch off)',
      cell_r0c1.classList.contains('dr-ext-rounded'), false);
    eq('re-apply switches (setup): row 1 column 0 is rounded by the first pass',
      cell_r1c0.classList.contains('dr-ext-rounded'), true);
    eq('re-apply switches (setup): row 1 column 1 ($9999999) is not rounded by the first pass (currency switch off)',
      cell_r1c1.classList.contains('dr-ext-rounded'), false);

    const tn_r1c0 = cell_r1c0.childNodes[0];
    const roundedValue_r1c0 = tn_r1c0.nodeValue;
    const originalValue_r1c0 = DR_MODEL.getTableOriginalText(grid.wrapperEl, cell_r1c0);

    eq('re-apply switches (setup): row 1 column 0 rounded value differs from the original',
      roundedValue_r1c0 !== originalValue_r1c0, true);

    // The page redraws the rounded cell's piece to its original.
    tn_r1c0.nodeValue = originalValue_r1c0;

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn_r1c0 }]);
    flushTimers(pendingTimers);

    eq('re-apply switches: row 0 column 0 keeps its text after the re-apply (percent switch off)',
      cell_r0c0.childNodes[0].nodeValue, '75%');
    eq('re-apply switches: row 0 column 0 carries no marker after the re-apply',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);
    eq('re-apply switches: row 0 column 1 keeps its text after the re-apply (percent switch off)',
      cell_r0c1.childNodes[0].nodeValue, '50%');
    eq('re-apply switches: row 1 column 1 keeps its text after the re-apply (currency switch off)',
      cell_r1c1.childNodes[0].nodeValue, '$9999999');
    eq('re-apply switches: row 1 column 1 carries no marker after the re-apply',
      cell_r1c1.classList.contains('dr-ext-rounded'), false);
    eq('re-apply switches: row 1 column 0, redrawn to its original, rounds again',
      cell_r1c0.childNodes[0].nodeValue, roundedValue_r1c0);
    eq('re-apply switches: row 1 column 0 still carries the marker after the re-apply',
      cell_r1c0.classList.contains('dr-ext-rounded'), true);
  } finally {
    restoreVirtGridGlobals(ctx);
  }
})();

// The pass reads every row of a grid with a row group. The header row holds
// because it is the literal first row; the first data row and the summary
// row round. The first column still holds.
(function gridEveryRowIsRead_headerHolds_dataAndSummaryRound() {
  const g = makeRowgroupRoleGrid(
    ['Region', '999999'],
    [['North', '1482391'], ['South', '918554']],
    ['Total', '2400945']
  );
  const { cells: results } = planTablePass(g.wrapperEl, Object.assign({}, DR_DEFAULTS));
  // results are row-major over all rows: [header c0, header c1, r1c0, r1c1, r2c0, r2c1, total c0, total c1]
  eq('every row is read: every cell of every row is classified',
    results.length, 8);
  eq('every row is read: the header row\'s numeric cell holds under the first-row default',
    results[1] && results[1].patches.length, 0);
  eq('every row is read: the first data row rounds under defaults',
    !!(results[3] && results[3].patches.length > 0), true);
  eq('every row is read: the first column of a data row still holds',
    results[2] && results[2].patches.length, 0);
  eq('every row is read: the summary row below the group rounds with the data',
    !!(results[7] && results[7].patches.length > 0), true);
})();

// With the row group first (no header row outside it), the first data row is
// the grid's literal first row and holds under the default.
(function gridEveryRowIsRead_groupAtTop_firstDataRowHolds() {
  const g = makeRowgroupRoleGrid(
    null,
    [['1111111', '1482391'], ['2222222', '918554']],
    ['Total', '2400945']
  );
  const { cells: results } = planTablePass(g.wrapperEl, Object.assign({}, DR_DEFAULTS));
  eq('every row is read: a grid with its row group first holds its first data row',
    results[1] && results[1].patches.length, 0);
  eq('every row is read: a grid with its row group first rounds its second data row',
    !!(results[3] && results[3].patches.length > 0), true);
  eq('every row is read: a grid with its row group first rounds its summary row',
    !!(results[5] && results[5].patches.length > 0), true);
})();

// Outside rows: a row outside the row group rounds, and its values join the
// dataset like any other row's.
(function gridOutsideRow_joinsTheDataset() {
  // Total is a magnitude ABOVE the data (7 vs 6): it feeds the max magnitude,
  // so the max magnitude reads 7.
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1,482,391'], ['South', '918,554']],
    ['Total', '24,009,450']
  );
  const { cells: results, maxMag } = planTablePass(g.wrapperEl, Object.assign({}, DR_DEFAULTS));
  eq('outside-row: the outside summary row sets the max magnitude',
    maxMag, 7);
  eq('outside-row: the outside row still rounds',
    !!(results[7] && results[7].patches.length > 0), true);
})();

// On the order-summary shape, the shipped defaults hold the header row and
// the label column and round every amount. Results are row-major over six
// rows of two cells. Invented values: under -0.5 at max magnitude 1,
// $48.60 → $50, $12.00 → $10, $7.35 → $7.5, $9.84 → $10, CAD$77.79 → CAD$80.
(function gridHeaderRoles_amountsRoundUnderDefaults() {
  const g = rwBuildLabelledGrid();
  const { cells: results, maxMag } = planTablePass(g.table, Object.assign({}, DR_DEFAULTS));
  eq('order summary under the defaults: six rows of two cells are classified', results.length, 12);
  eq('order summary under the defaults: the max magnitude comes from the amounts', maxMag, 1);
  eq('order summary under the defaults: the header row holds',
    [0, 1].map((i) => results[i] && results[i].patches.length), [0, 0]);
  eq('order summary under the defaults: the label column holds on every body row',
    [2, 4, 6, 8, 10].map((i) => results[i] && results[i].patches.length), [0, 0, 0, 0, 0]);
  eq('order summary under the defaults: every amount rounds',
    [3, 5, 7, 9, 11].map((i) => !!(results[i] && results[i].patches.length > 0)), [true, true, true, true, true]);
})();

// With the first-column switch on, the label column is the column the switch
// releases: the label sits at column 0 of each result row, and the amounts
// still round.
(function gridHeaderRoles_firstColumnSwitchReachesTheLabels() {
  const g = rwBuildLabelledGrid();
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstColumn: true });
  const { cells: results } = planTablePass(g.table, opts);
  eq('order summary, first column on: the subtotal label is the first cell of the first body row',
    !!results[2] && results[2].classifiedCell.cellObj.getText().trim().startsWith('Subtotal'), true);
  eq('order summary, first column on: the labels take no change',
    [2, 4, 6, 8, 10].map((i) => results[i] && results[i].patches.length), [0, 0, 0, 0, 0]);
  eq('order summary, first column on: the amounts still round',
    [3, 5, 7, 9, 11].map((i) => !!(results[i] && results[i].patches.length > 0)), [true, true, true, true, true]);
})();

// Outside rows: the lens preview pool draws from every row, the outside row
// included.
(function gridOutsideRow_joinsThePreview() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1482391'], ['South', '918554']],
    ['Total', '2400945']
  );
  const cells = collectNumericCells(g.wrapperEl);
  eq('outside-row: lens preview pool includes the first data row value',
    cells.some(function(c) { return c.num === 1482391; }), true);
  eq('outside-row: lens preview pool includes the outside row value',
    cells.some(function(c) { return c.num === 2400945; }), true);
})();

// A header-section row's td values feed the dataset. The offsets are pulled
// apart: with the thead value (magnitude 8) in the basis, the body value
// (magnitude 7) is the other band (nearest 1M → 88,000,000); a header row
// left out of the dataset would put it on the top band (nearest 5M →
// 90,000,000).
(function nativeHeaderRow_staysInDataset() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'td', text: '987,654,321' }],
      [{ tag: 'td', text: '87,654,321' }],
    ]);
    table.rows[0].parentElement = { tagName: 'THEAD' };
    const opts = {
      enabled: true, simplifyDates: false, simplifyTimes: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -1, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    eq('outside-row (native): a header-section value still feeds the dataset',
      table.rows[1].cells[0].innerText, '88,000,000');
  });
})();

// When a table's only number sits in an outside row, that row alone makes
// the dataset: it sets the max magnitude, so the value is the top band and
// takes the top-band offset (nearest 5M → 25,000,000), never the other-band
// offset (nearest 1M → 24,000,000).
(function gridOutsideRow_aloneMakesTheDataset() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', 'n/a']],
    ['Total', '24,009,450']
  );
  const opts = Object.assign({}, DR_DEFAULTS, { offsetTop: -0.5, offsetOther: -1 });
  const { cells: results, maxMag } = planTablePass(g.wrapperEl, opts);
  eq('outside-row: an outside row alone sets the max magnitude',
    maxMag, 7);
  eq('outside-row: an outside row alone takes the top-band offset',
    results[5] && results[5].patches[0] && results[5].patches[0].newNum, '25,000,000');
})();

// Outside rows, native analog: a footer-section row rounds and joins the
// dataset. The offsets are pulled apart so the dataset shows in the output:
// with the footer value (magnitude 8) in the dataset, the body value
// (magnitude 7) is the other band and takes offset_other (nearest 1M →
// 88,000,000); a footer left out of the dataset would put the body value on
// the top band (nearest 5M → 90,000,000).
(function nativeFooterRow_joinsTheDataset() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'td', text: '87,654,321' }],
      [{ tag: 'td', text: '987,654,321' }],
    ]);
    table.rows[1].parentElement = { tagName: 'TFOOT' };
    roundTable(table, roundTableOpts({ offsetOther: -1 }));
    eq('outside-row (native): the body value rounds on the other band, because the footer value raised the max magnitude',
      table.rows[0].cells[0].innerText, '88,000,000');
    eq('outside-row (native): the footer row still rounds',
      table.rows[1].cells[0].innerText, '1,000,000,000');
  });
})();

// Every row feeds the dataset, header, body, and total alike, on a native
// table and a grid. One drawing per case, the same sections on both kinds: a
// header row in a head section (a grid draws it outside every row group), two
// body rows in a body section (a grid draws them in a row group), and a total
// row in a footer section (a grid draws it after the row group, outside it).
// Each case puts the one magnitude-7 value in one row kind; every other
// number sits at magnitude 6. Both switches are on, so no exclusion holds the
// header row or the label column, and the offsets sit apart: at max
// magnitude 6 the body value 1,234,567 is the top band (nearest 500,000 →
// 1,000,000); at max magnitude 7 it is the other band (nearest 100,000 →
// 1,200,000). Invented values.
const EVERY_ROW_OPTS = Object.assign({}, DR_DEFAULTS, {
  simplifyFirstRow: true, simplifyFirstColumn: true, offsetTop: -0.5, offsetOther: -1, numTop: 1,
});
const EVERY_ROW_LARGE = '24,009,450';

function everyRowDraw(kind, largeIn) {
  const pick = (rowKind, otherwise) => (largeIn === rowKind ? EVERY_ROW_LARGE : otherwise);
  return rwDrawTable(kind, [
    { part: 'head', rows: [[{ pieces: 'Region', header: 'col' }, { pieces: pick('header', 'Units'), header: 'col' }]] },
    { part: 'body', rows: [['North', '1,234,567'], ['South', pick('body', '918,554')]], grouped: true },
    { part: 'foot', rows: [['Total', pick('total', '2,153,121')]] },
  ]).table;
}

// One case's reading: the max magnitude the pass computes, and the text the
// first body row's value shows after the table is simplified.
function everyRowRead(kind, largeIn) {
  let reading = null;
  withRewritePage(() => {
    const table = everyRowDraw(kind, largeIn);
    try {
      const { maxMag } = planTablePass(table, EVERY_ROW_OPTS);
      roundTableUnder(table, EVERY_ROW_OPTS);
      const bodyValue = tkCellTexts(table).find((cell) => cell.at === '1:1');
      reading = { maxMag, bodyValue: bodyValue ? bodyValue.text : null };
    } finally {
      resetTable(table);
      forgetRegisteredTable(table);
    }
  });
  return reading;
}

(function everyRow_eachRowKindSetsTheMaxMagnitudeOnBothKinds() {
  for (const kind of ['native', 'grid']) {
    eq(`every row (${kind}): with no magnitude-7 value the max magnitude is 6 and the body value takes the top-band offset`,
      everyRowRead(kind, null), { maxMag: 6, bodyValue: '1,000,000' });
    for (const rowKind of ['header', 'body', 'total']) {
      eq(`every row (${kind}): a ${rowKind} row sets the max magnitude, so the body value takes the other-band offset`,
        everyRowRead(kind, rowKind), { maxMag: 7, bodyValue: '1,200,000' });
    }
  }
})();

// The lens preview pool takes every row's values on both kinds: the header
// row's, the body rows', and the total row's.
(function everyRow_theLensPreviewPoolTakesEveryRow() {
  for (const kind of ['native', 'grid']) {
    for (const rowKind of ['header', 'total']) {
      withRewritePage(() => {
        const table = everyRowDraw(kind, rowKind);
        try {
          eq(`every row (${kind}): the lens preview pool holds the ${rowKind} row's value`,
            collectNumericCells(table, EVERY_ROW_OPTS).some((cell) => cell.num === 24009450), true);
        } finally {
          forgetRegisteredTable(table);
        }
      });
    }
  }
})();

// -------------------------------------------------------------------------
// Numbers inside words feed the max magnitude. A table whose only large
// value sits inside words ("₹2,000 crore") has a max magnitude of 3, from
// the 2,000, beside a pure cell holding 5.
// -------------------------------------------------------------------------
(function lensPreview_aNumberInsideWordsFeedsTheMaxMagnitude() {
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('₹2,000 crore'), tdCell('5')] },
    ],
  };

  const result = extractPreviewSamples(table);

  eq('lens preview of "₹2,000 crore" and 5: maxMag is 3, from the 2,000 inside words',
    result.maxMag, 3);

  eq('lens preview of "₹2,000 crore" and 5: the top band holds a sample',
    result.samples.top.length >= 1, true);

  eq('lens preview of "₹2,000 crore" and 5: the top-band sample is 2000',
    result.samples.top[0] && result.samples.top[0].num, 2000);

  // A table of pure cells alone.
  const pureTable = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('286')] },
    ],
  };
  const pureResult = extractPreviewSamples(pureTable);
  eq('lens preview of the pure cells 27M and 286: maxMag is 7',
    pureResult.maxMag, 7);

  // The samples hold the number inside words beside a pure cell.
  const mixedTable = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('Revenue: ₹2,000 crore'), tdCell('5')] },
    ],
  };
  const nums = collectNumericCells(mixedTable).map(c => c.num);
  eq('lens preview of "Revenue: ₹2,000 crore" and 5: the samples hold 2000',
    nums.includes(2000), true);
})();

// -------------------------------------------------------------------------
// Era-marked years are dates, not offset-rounded numbers: the lens preview
// leaves them out of the max magnitude and the samples.
// -------------------------------------------------------------------------
(function lensPreview_leavesEraYearsOut() {
  // collectNumericCells: the era year is dropped, real numbers are kept.
  const cells = collectNumericCells({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('Kalki 2898 AD'), tdCell('1,050,000,000')] },
    ],
  });
  const nums = cells.map(c => c.num);
  eq('era-collect: 2898 (era year) excluded from numeric cells',
    nums.includes(2898), false);
  eq('era-collect: 1,050,000,000 (real number) still collected',
    nums.includes(1050000000), true);

  // "~3,420 ad hoc": a lowercase "ad" is not the AD era marker, so the 3,420
  // must be collected.
  const adHocCells = collectNumericCells({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('~30,800 PAD (EFT)'), tdCell('~3,420 ad hoc')] },
    ],
  });
  const adHocNums = adHocCells.map(c => c.num);
  eq('era-collect: "~3,420 ad hoc" number is collected (not an era year)',
    adHocNums.includes(3420), true);
  eq('era-collect: "~30,800 PAD (EFT)" number is collected',
    adHocNums.includes(30800), true);

  // extractPreviewSamples: maxMag comes from the real number, not the era year,
  // and no sample carries the era-year value.
  const result = extractPreviewSamples({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('Kalki 2898 AD'), tdCell('1,050,000,000'), tdCell('500')] },
    ],
  });
  eq('era-samples: maxMag is 9 (from 1.05B, not the 2898 AD year)',
    result.maxMag, 9);
  const sampleNums = result.samples.top.concat(result.samples.other).map(r => r.num);
  eq('era-samples: no sample is the 2898 AD year',
    sampleNums.includes(2898), false);
})();

// -------------------------------------------------------------------------
// When a native table is already simplified, collectNumericCells reads the
// stored original (DR_MODEL's table registry) rather than the rounded text
// showing in the cell.
// -------------------------------------------------------------------------
(function originalValueOnSimplifiedTable() {
  // A rounded native cell: innerText shows the rounded "3,000,000" but the true
  // original "2,794,356" is recorded in the registry.
  const roundedCell = {
    tagName: 'TD',
    innerText: '3,000,000',
    textContent: '3,000,000',
    dataset: {},
    childNodes: [{ nodeType: 3, nodeValue: '3,000,000' }],
  };
  const labelCell = { tagName: 'TH', innerText: '', textContent: '' };
  const headerCell = { tagName: 'TH', innerText: 'A', textContent: 'A' };
  const rowLabelCell = { tagName: 'TH', innerText: 'Row', textContent: 'Row' };
  const mockTable = {
    rows: [
      { cells: [labelCell, headerCell] },
      { cells: [rowLabelCell, roundedCell] },
    ],
  };
  DR_MODEL.setTableOriginal(mockTable, roundedCell, {
    value: '2,794,356', pieces: [{ text: '2,794,356', written: '3,000,000' }],
  });
  const cells = collectNumericCells(mockTable);
  eq('orig-value: reads original text, not rounded',
    cells[0].text, '2,794,356');
  eq('orig-value: parses num from original, not rounded',
    cells[0].num, 2794356);
})();

// A simplified native cell classifies its stored original pieces, so the
// placement step reads the pieces the value was written from, not the live
// pieces, which hold the written text. The stored pieces hold the value in
// one piece, so it joins the pool. The same split with no stored original
// stays out of the pool, because the placement step reads a value that
// crosses a piece boundary.
(function previewSimplifiedNativeCell_placesItsStoredPieces() {
  withReactiveCreateTreeWalker(function () {
    const opts = { simplifyFirstRow: true, simplifyFirstColumn: true, rangeExpr: '' };
    const roundedCell = makeReactiveCell([{ text: '6,700,000', inSup: false }, { text: ' kg', inSup: false }]);
    const table = { rows: [{ cells: [roundedCell] }], dataset: {} };
    DR_MODEL.setTableOriginal(table, roundedCell, {
      value: '6,718,245 kg',
      pieces: [{ text: '6,718,245', written: '6,700,000' }, { text: ' kg', written: ' kg' }],
    });
    const liveCell = makeReactiveCell([{ text: '6,7', inSup: false }, { text: '18,245', inSup: false }]);
    const liveTable = { rows: [{ cells: [liveCell] }], dataset: {} };
    try {
      eq('preview simplified native cell: the stored original joins the pool through its stored pieces',
        collectNumericCells(table, opts).map((c) => c.num), [6718245]);
      eq('preview simplified native cell: the same split with no stored original stays out',
        collectNumericCells(liveTable, opts), []);
    } finally {
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// The lens preview writes no log rows: a native value split across text
// pieces, which the simplification pass counts, leaves the log unchanged
// when the preview classifies it.
(function previewWritesNoLogRows() {
  withReactiveCreateTreeWalker(function () {
    const opts = { simplifyFirstRow: true, simplifyFirstColumn: true, rangeExpr: '' };
    const splitCell = makeReactiveCell([{ text: '3,406,', inSup: false }, { text: '918', inSup: false }]);
    const table = { rows: [{ cells: [splitCell] }], dataset: {} };
    const rows = [];
    const offRow = DR_LOG.onRow((row) => rows.push(row));
    try {
      eq('preview log rows: the split value stays out of the pool',
        collectNumericCells(table, opts), []);
      eq('preview log rows: the preview writes no row', rows.length, 0);
      eq('preview log rows (control): the simplification pass counts the split number',
        roundTable(table, opts).leftAsWritten.splitValue, 1);
    } finally {
      offRow();
      DR_MODEL.unregisterTable(table);
    }
  });
})();

// On a native table a unit number rounds; only its
// digits change. Dataset: 4.91 (magnitude 0) and 45.67 (magnitude 1), so
// 45.67 takes the top band (step 5) and 4.91 the other band (step 0.5).
(function nativeTable_unitNumbersRoundAndAnIdentifierStays() {
  withCreateTreeWalker(function () {
    const table = makeMockTable([[
      { tag: 'td', text: '4.91tn' }, { tag: 'td', text: 'CAD45.67m' }, { tag: 'td', text: 'DT1234' },
    ]]);
    roundTable(table, Object.assign({}, DR_DEFAULTS, {
      simplifyFirstRow: true, simplifyFirstColumn: true,
    }));
    eq('native table: unit numbers round and an identifier stays',
      table.rows[0].cells.map((cell) => cell.innerText), ['5tn', 'CAD45m', 'DT1234']);
  });
})();

// The lens preview samples are the numbers the simplification pass rounds:
// each rule below that holds a number back in the pass holds it out of the
// samples.

(function lensPreviewPool_outOfRange() {
  // The samples follow the range expression, as the pass does.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('123'), tdCell('456')] },
    ],
  };
  eq('lens preview samples (no range restriction): both columns are sampled',
    collectNumericCells(table).map((c) => c.num).sort(), [123, 456]);
  eq('lens preview samples (out-of-range): a rangeExpr restricts the sample to the in-range column',
    collectNumericCells(table, { rangeExpr: 'B:B' }).map((c) => c.num), [123]);
  eq('lens preview samples (invalid range): an invalid range expression yields no samples, as the pass rounds nothing',
    collectNumericCells(table, { rangeExpr: 'not a range' }).length, 0);
})();

(function lensPreviewPool_firstRow() {
  // A numeric header-row <td> is not sampled: DR_DEFAULTS ship
  // simplifyFirstRow: false, and the samples follow the first-row exclusion.
  const table = {
    rows: [
      { cells: [tdCell('label'), tdCell('777')] }, // row 0
      { cells: [tdCell('label'), tdCell('888')] }, // row 1
    ],
  };
  eq('lens preview samples (first-row): the row-0 numeric cell is excluded even though its column is not first',
    collectNumericCells(table).map((c) => c.num), [888]);
})();

(function lensPreviewPool_firstColumn() {
  // Same rule, isolated to the column axis (DR_DEFAULTS ships
  // simplifyFirstColumn: false too).
  const table = {
    rows: [
      { cells: [tdCell('999'), tdCell('999')] },  // row 0 — excluded by first-row regardless
      { cells: [tdCell('111'), tdCell('222')] },  // row 1: column 0 vs column 1
    ],
  };
  eq('lens preview samples (first-column): the column-0 numeric cell is excluded even in a non-first row',
    collectNumericCells(table).map((c) => c.num), [222]);
})();

(function lensPreviewPool_percentGating() {
  // With the percent switch off, a percent cell is not sampled: the number
  // the sign touches stays as written.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('50%')] },
    ],
  };
  eq('lens preview samples (percent on): percent cell is sampled',
    collectNumericCells(table, { simplifyMixedPercent: true }).map((c) => c.num), [50]);
  eq('lens preview samples (percent off): percent cell is excluded from samples',
    collectNumericCells(table, { simplifyMixedPercent: false }).length, 0);
})();

(function lensPreviewPool_currencyGating() {
  // Same rule, currency symbols.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('$100')] },
    ],
  };
  eq('lens preview samples (currency on): currency cell is sampled',
    collectNumericCells(table, { simplifyMixedCurrency: true }).map((c) => c.num), [100]);
  eq('lens preview samples (currency off): currency cell is excluded from samples',
    collectNumericCells(table, { simplifyMixedCurrency: false }).length, 0);
})();

(function lensPreviewPool_quotedCell() {
  // A quoted cell stays as written, so its number is not sampled.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('"12345"')] },
    ],
  };
  eq('lens preview samples (quoted cell): a whole-cell-quoted number is excluded from samples',
    collectNumericCells(table).length, 0);
})();

(function lensPreviewPool_quotedNumberInMixedText() {
  // A quoted number inside words stays as written: in
  // 'Product "42" ships in 10 days' only the 10 is sampled.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('Product "42" ships in 10 days')] },
    ],
  };
  eq('lens preview samples (quoted number in mixed text): only the unquoted number is sampled',
    collectNumericCells(table).map((c) => c.num), [10]);
})();

(function lensPreviewPool_wholeCellLink() {
  // A pure cell whose whole visible text is a link (e.g. a linked page
  // number) is not sampled, because the pass leaves it as written.
  const linkCell = makeLinkCell(['42'], null);
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), linkCell] },
    ],
  };
  eq('lens preview samples (whole-cell link): a whole-cell-link number is excluded from samples',
    collectNumericCells(table).length, 0);
})();

(function lensPreviewPool_mixedTextLinkedNumber() {
  // A number inside a link sits in a markup range, so the pass leaves it as
  // written and the samples leave it out.
  const mixedLinkCell = makeLinkCell(['42'], 'See page for details');
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), mixedLinkCell] },
    ],
  };
  withLinkCreateTreeWalker(() => {
    eq('lens preview samples (linked number in mixed text): a number inside <a> is excluded from samples',
      collectNumericCells(table).length, 0);
  });
})();

(function lensPreviewPool_superscriptMasking() {
  // A whole-cell exponent like "10<sup>12</sup>" (flattened innerText
  // "1012") must not be sampled as the single pure number 1012: the pass
  // masks the exponent and, finding nothing left to round, leaves the cell
  // as written.
  withSupCreateTreeWalker(() => {
    const supCell = makeSuperscriptCell([
      { text: '10', inSup: false },
      { text: '12', inSup: true },
    ]);
    const table = {
      rows: [
        { cells: [thCell(''), thCell('A')] },
        { cells: [thCell('Row'), supCell] },
      ],
    };
    eq('lens preview samples (superscript exponent): a whole-cell exponent is excluded, not misread as 1012',
      collectNumericCells(table).length, 0);
  });
})();

(function lensPreviewPool_embeddedNumber() {
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('Revenue: 5,000 units')] },
    ],
  };
  eq('lens preview samples (embedded number): the number in a cell with words is sampled',
    collectNumericCells(table).map((c) => c.num), [5000]);
})();

(function lensPreviewPool_datesAndTimesStayOut() {
  // Dates and times stay out of the samples; the reason sits on
  // numericPreviewCells in content.js.
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('2020-01-01'), tdCell('3:45 PM')] },
    ],
  };
  eq('lens preview samples (dates/times): date and time cells are still excluded from preview samples',
    collectNumericCells(table, { simplifyTimes: true }).length, 0);
})();

// The tests above read the lens preview samples. This one reads what the
// simplification pass writes into a native table: a single fixture that
// exercises several rules together, with the exact applied cell text pinned,
// catches a change to the ladder's shared logic (rule order, max_mag
// interaction, formatting) that a per-rule unit test run in isolation would
// not: rules here interact through one shared max_mag pass and one shared
// column post-pass, same as on a real page.
(function severalRules_onANativeTable() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'th', text: '' }, { tag: 'th', text: 'A' }, { tag: 'th', text: 'B' },
       { tag: 'th', text: 'C' }, { tag: 'th', text: 'D' }, { tag: 'th', text: 'E' },
       { tag: 'th', text: 'F' }],
      [{ tag: 'th', text: 'Row' },
       { tag: 'td', text: '27,000,000' },        // plain, top band
       { tag: 'td', text: '4,080' },              // plain, other band
       { tag: 'td', text: '50%' },                // percent (gated on)
       { tag: 'td', text: '$1,234,000' },         // currency (gated on)
       { tag: 'td', text: '"98765"' },            // whole-cell quoted: untouched
       { tag: 'td', text: '2020-01-01' }],        // unambiguous ISO date
      [{ tag: 'th', text: 'Row2' },
       { tag: 'td', text: 'Revenue: 5,234,000 units' },  // mixed-text extraction
       { tag: 'td', text: 'Kalki 2898 AD' },              // era year: no surviving number
       { tag: 'td', text: '312' },                        // plain, shares max_mag with row 1
       { tag: 'td', text: '' }, { tag: 'td', text: '' }, { tag: 'td', text: '' }],
    ]);
    roundTable(table, roundTableOpts({
      simplifyFirstRow: false, simplifyFirstColumn: false,
      simplifyMixedPercent: true, simplifyMixedCurrency: true,
      simplifyDates: true, simplifyTimes: true,
      dateGranularity: 'month', timeGranularity: 'hour',
    }));
    const applied = table.rows.map((row) => row.cells.map((c) => c.textContent));
    eq('several rules on a native table: the pass writes the exact pinned values',
      applied, [
        ['', 'A', 'B', 'C', 'D', 'E', 'F'],
        ['Row', '25,000,000', '4,000', '50%', '$1,000,000', '"98765"', '2020-01'],
        ['Row2', 'Revenue: 5,000,000 units', 'Kalki 2898 AD', '300', '', '', ''],
      ]);
  });
})();

(function identifierShapes_stayOnEveryTableKind() {
  // One row of identifiers beside one quantity, so the table has a number to
  // round and the identifiers are the only cells the rule holds back.
  const identifiers = ['416 555 1234', '(416) 555-1234', '192.168.0.1', 'M5V 2T6', 'ISBN 978-0-306-40615-7'];
  const quantity = '1,613,245';
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });

  // A cell with words holds its phone number and rounds its count.
  const inText = 'Call 416-555-1234 about 1,613,245 units';
  const inTextRounded = 'Call 416-555-1234 about 1,500,000 units';

  withCreateTreeWalker(function() {
    const table = makeMockTable([[...identifiers, inText, quantity].map((text) => ({ tag: 'td', text }))]);
    roundTable(table, opts);
    eq('identifier shape (native table): identifiers stay as written and the quantity rounds',
      table.rows[0].cells.map((c) => c.textContent), [...identifiers, inTextRounded, '1,500,000']);
  });

  const grid = makeE2EGridWrapper([[...identifiers, inText, quantity]]);
  try {
    roundTable(grid.wrapperEl, opts);
    eq('identifier shape (grid): identifiers stay as written and the quantity rounds',
      grid.cellEls.map((cell) => pieceTextsOf(cell).join('')), [...identifiers, inTextRounded, '1,500,000']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }

  const previewTable = {
    rows: [
      { cells: [thCell(''), ...identifiers.map(() => thCell('A')), thCell('B')] },
      { cells: [thCell('Row'), ...identifiers.map(tdCell), tdCell(quantity)] },
    ],
  };
  eq('identifier shape (lens preview): only the quantity is sampled',
    collectNumericCells(previewTable).map((c) => c.num), [1613245]);
})();

// A cart totals table in European style, minimized and synthetic. "7,42€"
// must not read as 742 and round to "700€". Every cell stays as written on
// both table kinds, and the pass writes no row.
(function decimalComma_cartTableStaysAsWritten() {
  const rows = [
    ['Item', 'Price'],
    ['Subtotal', '7,42€'],
    ['Shipment', '6,95€'],
    ['Total', '14,37€ (includes 2,49€ VAT)'],
  ];
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  const passRows = [];
  const offRow = DR_LOG.onRow((row) => passRows.push(row));
  try {
    withCreateTreeWalker(function() {
      const table = makeMockTable(rows.map((row) => row.map((text) => ({ tag: 'td', text }))));
      roundTable(table, opts);
      eq('decimal comma (native table): every cell of the cart table stays as written',
        table.rows.map((row) => row.cells.map((c) => c.textContent)), rows);
    });

    const grid = makeE2EGridWrapper(rows);
    try {
      roundTable(grid.wrapperEl, opts);
      eq('decimal comma (grid): every cell of the cart table stays as written',
        grid.cellEls.map((cell) => pieceTextsOf(cell).join('')), rows.flat());
    } finally {
      DR_MODEL.unregisterTable(grid.wrapperEl);
    }
    eq('decimal comma (both table kinds): the pass writes no row', passRows.length, 0);
  } finally {
    offRow();
  }
})();

// One write-back path. Every number is patched in place, digits only,
// grouped with US marks, and the characters around it stay where the page
// put them: a number inside words gets its group mark ("up 10,000 units"),
// and a pure cell keeps its own minus sign.
(function oneWriteBackPath_onEveryTableKind() {
  const cells = ['up 12345 units', '$12345', '(1,234)', '+5%', '$ 1,234', '1 234 567', '35.0', '−1,234'];
  const expected = ['up 10,000 units', '$10,000', '(1,000)', '+5%', '$ 1,000', '1,000,000', '35', '−1,000'];
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });

  withCreateTreeWalker(function() {
    const table = makeMockTable([cells.map((text) => ({ tag: 'td', text }))]);
    roundTable(table, opts);
    eq('one write-back path (native table): each number is patched in place with US marks',
      table.rows[0].cells.map((c) => c.textContent), expected);
  });

  const grid = makeE2EGridWrapper([cells]);
  try {
    roundTable(grid.wrapperEl, opts);
    eq('one write-back path (grid): each number is patched in place with US marks',
      grid.cellEls.map((cell) => pieceTextsOf(cell).join('')), expected);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// ---------------------------------------------------------------------------
// The rounding pass runs with NO `chrome` global present at all — not even a
// stub. This loads the real content-script bundle, unpatched, in a vm
// sandbox that never defines `chrome`: every chrome.* reference in the
// content scripts sits inside a function body this test never calls. If
// roundTable (or anything it reaches) touched chrome, loading or calling it
// here would throw ReferenceError: chrome is not defined.
// ---------------------------------------------------------------------------
(function roundingPassRunsWithNoChromeGlobal() {
  // Sandbox has NO `chrome` property whatsoever — only the DOM/browser
  // primitives the rounding pass touches (document.createTreeWalker via
  // collectTextPieces, NodeFilter).
  const sandbox = {
    document: {
      addEventListener() {},
      createTreeWalker(cell) {
        let done = false;
        return {
          nextNode() {
            if (done) return null;
            done = true;
            return {
              get nodeValue() { return this._val !== undefined ? this._val : cell.innerText; },
              set nodeValue(v) { cell.innerText = v; cell.textContent = v; this._val = v; },
            };
          },
        };
      },
    },
    window: {
      addEventListener() {},
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    },
    NodeFilter: { SHOW_TEXT: 4 },
    Node: { ELEMENT_NODE: 1 },
  };

  const vm = require('vm');
  const ctx = vm.createContext(sandbox);

  let threw = null;
  try {
    vm.runInContext(contentScriptBundle + '\nthis.__roundTable = roundTable;', ctx);
  } catch (e) {
    threw = e.message;
  }
  eq('no chrome global: the content-script bundle loads with no `chrome` global defined anywhere',
    threw, null);
  eq('no chrome global: `chrome` is genuinely absent from the sandbox',
    'chrome' in sandbox, false);
  if (threw !== null || typeof sandbox.__roundTable !== 'function') return;

  const table = makeMockTable([[{ tag: 'td', text: '1,234,567' }]]);
  let callThrew = null;
  let result;
  try {
    result = sandbox.__roundTable(table, roundTableOpts());
  } catch (e) {
    callThrew = e.message;
  }

  eq('no chrome global: calling roundTable on a fixture does not throw with no chrome global present',
    callThrew, null);
  eq('no chrome global: roundTable returns rangeStatus "ok"',
    result && result.rangeStatus, 'ok');
  eq('no chrome global: roundTable actually rounded the fixture cell',
    table.rows[0].cells[0].classList.contains('dr-ext-rounded'), true);
})();

// An off and on round trip on a grid that reuses its cells: round, press
// off, the grid puts a new element in one cell's place, press on.
//
// Off restores every cell still in the grid and drops its record, so the
// replaced cell's record is gone at the off press. The new element was never
// in the registry and rounds from its own text at the on press.
//
// The wrapper's querySelectorAll walks the live rows on each call, so the
// replaced cell drops out of '.dr-ext-rounded' the way a detached element
// does; makeE2EGridWrapper's fixed cell list would still find it.
(function gridReuse_offAndOnRoundTripWithAReplacedCell() {
  const grid = makeGridWrapper([['87654321', '1234567']]);
  grid.wrapperEl.querySelectorAll = function(sel) {
    if (sel !== '.dr-ext-rounded') return [];
    const found = [];
    for (const row of grid.wrapperEl.children) {
      for (const cell of row.children) {
        if (cell.classList && cell.classList.contains('dr-ext-rounded')) found.push(cell);
      }
    }
    return found;
  };
  grid.wrapperEl.querySelector = function(sel) {
    return grid.wrapperEl.querySelectorAll(sel)[0] || null;
  };

  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  roundTable(grid.wrapperEl, opts);

  const cellA = grid.cellEls[0]; // replaced while the grid is off
  const cellSurvivor = grid.cellEls[1]; // stays in place across the whole cycle

  eq('reused grid cell: both cells round on the first pass (pre-condition)',
    cellA.classList.contains('dr-ext-rounded') && cellSurvivor.classList.contains('dr-ext-rounded'), true);

  resetTable(grid.wrapperEl); // the press that turns simplification off
  eq('reused grid cell: the off press restores the first cell\'s text',
    cellA.childNodes[0].nodeValue, '87654321');

  // The grid puts a new element, never seen by this extension, in the first
  // cell's place; the first cell is no longer reachable from the table.
  const cellB = makeGridCellWithTextNode('99999999');
  grid.rowEls[0].children = [cellB, cellSurvivor];

  roundTable(grid.wrapperEl, opts); // the press that turns it back on

  // The new cell rounds from its own text like any other live cell.
  eq('reused grid cell: the new element in the first cell\'s place rounds on the on press',
    cellB.classList.contains('dr-ext-rounded'), true);
  eq('reused grid cell: the new element\'s 99999999 rounds to 100,000,000',
    cellB.childNodes[0].nodeValue, '100,000,000');
  eq('reused grid cell: the cell that stayed rounds again on the on press',
    cellSurvivor.classList.contains('dr-ext-rounded'), true);

  // The registry's per-table `originals` is a WeakMap keyed by cell element
  // (app/model.js). The first cell was still in the grid at the off press, so
  // the restore visited it and dropped its record there, before the grid
  // took the element out. Nothing is keyed to a cell the grid no longer
  // holds, and a cell the restore never reaches is collectible once the page
  // stops referencing it.
  eq('reused grid cell: the off press drops the replaced cell\'s registry original',
    DR_MODEL.hasTableOriginal(grid.wrapperEl, cellA), false);
})();

// Content-script re-injection. The bundle is eval'd twice against the same
// fixture tables and document, each eval with its own DR_MODEL (direct eval
// gives let/const their own lexical environment per call): instance 1
// rounds the tables, and instance 2, with an empty registry and the same
// rounded page, stands for the re-injected script. The cost this pins is
// the KNOWN ACCEPTED COST comment on restoreTable (content.js).
//   A: a restore leaves an unrestorable cell exactly as found.
//   B: a sidebar apply simplifies the unrestorable cell again.
//   C: the table pillbox shows off for an unrounded table and on for one
//      instance 2 rounded.
(function reinjection_anUnrestorableCellStaysAsFound() {
  function makeReinjectionFixtureTable(dataText) {
    const table = makeTablePillboxTestTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: dataText }],
    ]);
    // Link innerHTML, innerText, and textContent to one backing value on the
    // data cell, as a real <td> holding one text node links them, so a write
    // through any one of them shows in the other two.
    const dataCell = table._cells[3];
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });
    // A real removeAttribute('title') clears the title. makeTablePillboxTestCell's
    // default stub is a no-op, which would hide exactly the bug this test
    // exists to catch — an implementation that unconditionally strips the
    // title would otherwise leave dataCell.title looking untouched.
    dataCell.removeAttribute = function (name) {
      if (name === 'title') this.title = '';
    };
    return { table, dataCell };
  }

  const { table: restoreCaseTable, dataCell: restoreCaseCell } = makeReinjectionFixtureTable('12,345');
  const { table: applyCaseTable, dataCell: applyCaseCell } = makeReinjectionFixtureTable('54,321');
  // Scenario C fixture: starts unrounded and is later rounded by instance 2
  // itself.
  const { table: pillboxCaseTable } = makeReinjectionFixtureTable('8,765');
  const restoreCaseOriginal = '12,345';
  const applyCaseOriginal = '54,321';

  // A minimal document shared by every eval'd instance below — this is the
  // "live page" that persists across the simulated re-injection.
  // createTreeWalker mirrors withCreateTreeWalker's single-fake-text-node
  // approach, reading and writing through the SAME linked innerText/
  // innerHTML property. createElement/head back ensureHighlightStyleInjected,
  // which scenario B, the sidebar apply, reaches.
  const sharedDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {} },
    head: { appendChild() {} },
    createElement() { return { textContent: '' }; },
    createTreeWalker(cell) {
      let done = false;
      return {
        nextNode() {
          if (done) return null;
          done = true;
          return {
            get nodeValue() { return cell.innerText; },
            set nodeValue(v) { cell.innerText = v; cell.textContent = v; },
          };
        },
      };
    },
  };
  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
  };
  global.document = sharedDoc;
  global.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage() {} } };
  global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  global.MutationObserver = class { observe() {} disconnect() {} };
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };

  try {
    // --- Instance 1: the content script as originally injected. Rounds
    // both fixture tables directly (bypassing detection/UI wiring,
    // irrelevant to this mechanism) with DR_DEFAULTS, same as the apply
    // path's fresh round. ---
    eval(contentScriptBundle + `
      globalThis.__ri1_roundTable = roundTable;
    `);
    global.__ri1_roundTable(restoreCaseTable, DR_DEFAULTS);
    global.__ri1_roundTable(applyCaseTable, DR_DEFAULTS);
    const restoreCaseRoundedText = restoreCaseCell.innerText;
    const restoreCaseRoundedTitle = restoreCaseCell.title;
    const applyCaseRoundedText = applyCaseCell.innerText;
    const applyCaseRoundedTitle = applyCaseCell.title;

    eq('re-injection (pre): instance 1 actually rounded the sidebar-scenario cell away from the true original',
      applyCaseRoundedText !== applyCaseOriginal, true);
    eq('re-injection (pre): the sidebar-scenario cell\'s title holds the true original',
      applyCaseRoundedTitle, `Original: ${applyCaseOriginal}`);

    eq('re-injection (pre): instance 1 actually rounded the cell away from the true original',
      restoreCaseRoundedText !== restoreCaseOriginal, true);
    eq('re-injection (pre): instance 1 reports the table as rounded',
      showsSimplified(restoreCaseTable), true);
    eq('re-injection (pre): the title attribute holds the true original',
      restoreCaseRoundedTitle, `Original: ${restoreCaseOriginal}`);

    // --- Instance 2: the re-injected script. The page still shows instance
    // 1's rounded text and markers, and this eval's DR_MODEL starts empty.
    // Its bus listener is kept, so scenario B can deliver the sidebar's
    // apply the way Chrome does. ---
    let ri2Listener = null;
    global.chrome.runtime.onMessage.addListener = (fn) => { ri2Listener = fn; };
    eval(contentScriptBundle + `
      globalThis.__ri2_resetTable = resetTable;
      globalThis.__ri2_DR_MODEL = DR_MODEL;
      globalThis.__ri2_roundTable = roundTable;
      globalThis.__ri2_syncTablePillbox = syncTablePillbox;
      globalThis.__ri2_tablePillboxes = tablePillboxButtons(tablePillboxViews);
    `);

    // --- Scenario A: a restore. The screen still shows rounded text, so the
    // marker stays to match it, and the title, the last copy of the true
    // original, stays too. ---
    global.__ri2_resetTable(restoreCaseTable);

    eq('re-injection restore: the unrestorable cell keeps its marker',
      restoreCaseCell.classList.contains('dr-ext-rounded'), true);
    eq('re-injection restore: the unrestorable cell keeps its title',
      restoreCaseCell.title, restoreCaseRoundedTitle);
    eq('re-injection restore: the unrestorable cell keeps its rounded text',
      restoreCaseCell.innerText, restoreCaseRoundedText);

    // --- Scenario B: the sidebar apply with the table on, on a table holding
    // an unrestorable cell. Drives the real wiring end to end: a sidebar
    // settings change reaches the request:applySettings responder, which
    // writes the active table's settings and runs the apply. The reset leaves
    // the cell's simplified text in place, and the pass then reads that text
    // as the cell's own: it simplifies it again and records it as the
    // original. That cost is accepted; a page reload clears it.
    //
    // The new settings differ from the ones instance 1 rounded with:
    // re-rounding under identical settings is a value-preserving no-op the
    // simplification pass skips. offsetTop 1 re-rounds instance 1's text to a coarser
    // value, so the second simplification shows in the cell and its title. ---
    const sentMessages = [];
    global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };
    global.__ri2_DR_MODEL.setActiveTable(applyCaseTable);
    ri2Listener({ topic: 'request:applySettings', settings: Object.assign({}, DR_DEFAULTS, { enabled: true, offsetTop: 1 }) },
      {}, () => {});

    eq('re-injection sidebar apply: the apply simplifies the unrestorable cell\'s displayed text again',
      applyCaseCell.innerText !== applyCaseRoundedText, true);
    eq('re-injection sidebar apply: the registry records the simplified text as the cell\'s original',
      global.__ri2_DR_MODEL.getTableOriginalText(applyCaseTable, applyCaseCell), applyCaseRoundedText);
    eq('re-injection sidebar apply: the title holds the simplified text as the original',
      applyCaseCell.title, `Original: ${applyCaseRoundedText}`);
    eq('re-injection sidebar apply: the cell keeps the simplified marker',
      applyCaseCell.classList.contains('dr-ext-rounded'), true);
    eq('re-injection sidebar apply: the apply runs the simplification pass, which sends the range status',
      sentMessages.some((m) => m.topic === 'state:rangeOk' || m.topic === 'state:rangeError'), true);

    // --- Scenario C: the table pillbox sync on fresh and simplified tables. ---
    const pillboxStub = makeMockButton();
    global.__ri2_tablePillboxes.set(pillboxCaseTable, pillboxStub);
    global.__ri2_syncTablePillbox(pillboxCaseTable);
    eq('re-injection table pillbox: an unrounded table renders off',
      pillboxStub.getAttribute('aria-pressed'), 'false');

    global.__ri2_DR_MODEL.setTableSettings(pillboxCaseTable, { enabled: true }, 'page');
    global.__ri2_roundTable(pillboxCaseTable, DR_DEFAULTS);
    global.__ri2_syncTablePillbox(pillboxCaseTable);
    eq('re-injection table pillbox: a table THIS instance rounded renders on',
      pillboxStub.getAttribute('aria-pressed'), 'true');
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
  }
})();

// --- End to end on a native table ---

(function bracketedCellRoundsAcrossPieces() {
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '(' }, { text: '1,234' }, { text: ')' }]);
    roundTable(makeTableOfCells([[cell]]), supTestOpts);
    eq('bracketed: the digits round and the brackets stay in their own pieces',
      cell._textNodes.map((n) => n.nodeValue), ['(', '1,000', ')']);
  });
})();

(function bracketedCellKeepsItsCurrencySign() {
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '$(1,234)' }]);
    roundTable(makeTableOfCells([[cell]]), supTestOpts);
    eq('bracketed: a currency sign outside the brackets stays put',
      cell._textNodes[0].nodeValue, '$(1,000)');
  });
})();

// --- The sign reaches the max magnitude ---

(function bracketedNumberSetsTheMaxMagnitude() {
  withSupCreateTreeWalker(function() {
    const big = makeExtractedCell([{ text: '(12,345)' }]);
    const small = makeExtractedCell([{ text: '678' }]);
    const table = makeTableOfCells([[big, small]]);
    roundTable(table, Object.assign({}, supTestOpts, { offsetOther: -2 }));
    eq('bracketed: a bracketed number sets the max magnitude and rounds in the top band',
      big._textNodes[0].nodeValue, '(10,000)');
    eq('bracketed: the other band rounds against that max magnitude',
      small._textNodes[0].nodeValue, '678');
  });
})();

// --- End to end on a grid ---

(function bracketedGridCellRoundsAcrossPieces() {
  const grid = makeE2EGridWrapper([['4.91', '(5,432.1)']]);
  const bracketed = grid.cellEls[1];
  setGridCellPieces(bracketed, [makeTextNode('('), makeTextNode('5,432.1'), makeTextNode(')')]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('bracketed: a grid cell rounds its digits and keeps its brackets in their own pieces',
      gridCellTextPieces(bracketed).map((node) => node.nodeValue), ['(', '5,500', ')']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

(function bracketedSeparatePiecesGridCellRounds() {
  const grid = makeE2EGridWrapper([['4.91', '(125)(126)']]);
  const pair = grid.cellEls[1];
  setGridCellPieces(pair, [makeTextNode('(125)'), makeTextNode('(126)')]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('bracketed: a grid cell with bracketed numbers in separate pieces rounds',
      gridCellTextPieces(pair).map((node) => node.nodeValue), ['(150)', '(150)']);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// --- The lens preview carries the sign ---

(function bracketedNumberReachesTheLensPreviewAsNegative() {
  const grid = makeE2EGridWrapper([['4.91', '(5,432.1)']]);
  const bracketed = grid.cellEls[1];
  setGridCellPieces(bracketed, [makeTextNode('('), makeTextNode('5,432.1'), makeTextNode(')')]);
  try {
    eq('bracketed: the lens preview pool reads the original of the cell as a negative',
      collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((cell) => cell.num), [4.91, -5432.1]);
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('bracketed: the lens preview pool still reads it as a negative once rounded',
      collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((cell) => cell.num), [4.91, -5432.1]);
  } finally {
    DR_MODEL.unregisterTable(grid.wrapperEl);
  }
})();

// --- The first-column exclusion falls on the label column ---

(function theFirstColumnExclusionFollowsTheGridColumn() {
  withCreateTreeWalker(function () {
    const table = makeMergedSpanTable();
    roundTable(table, Object.assign({}, DR_DEFAULTS));
    eq('merged cells: the cell after a downward merge is not read as the first column',
      table.rows[2].cells[0].classList.contains('dr-ext-rounded'), true);
  });
})();

// --- The max magnitude matches the unmerged equivalent ---

(function theMaxMagnitudeMatchesTheUnmergedTable() {
  withCreateTreeWalker(function () {
    const merged = makeMergedSpanTable();
    const unmerged = makeUnmergedSpanTable();
    // The two offsets differ, so the band a value falls in against the max
    // magnitude changes its text. Under the shipped defaults both offsets are
    // the same and the max magnitude picks between two equal choices, which
    // would leave this test blind to the reading it is here to pin.
    const opts = Object.assign({}, DR_DEFAULTS, { offsetTop: -1, offsetOther: 0 });
    roundTable(merged, opts);
    roundTable(unmerged, opts);
    const textsOf = (table, r) => table.rows[r].cells.map((cell) => cell.textContent);
    eq('merged cells: the merged table rounds its first data row like the unmerged one',
      textsOf(merged, 1), textsOf(unmerged, 1));
    eq('merged cells: the merged table rounds its second data row like the unmerged one',
      textsOf(merged, 2), textsOf(unmerged, 2).slice(1));
  });
})();

// =============================================================================
// Cells the page rewrites
//
// While a table is simplified, the page can write a new value into a cell. A
// pass sorts each cell into one of three groups: fresh (no stored originals),
// held (every text piece shows its original or its written text, and the
// piece count matches), and rewritten (anything else). A held cell takes its
// target text from its stored originals; a rewritten cell gets its original
// text back in each piece that still shows written text, drops its record,
// and simplifies fresh. The restore sorts the same way. One re-apply observer
// watches every simplified table.
//
// The page model below: element and text nodes that report each change to
// the mutation observers watching an ancestor. The observer stand-in queues
// one record per change and delivers the queue when the harness advances its
// clock, the way a browser delivers records after the running task. Timers
// run on the same fake clock. Every case builds its table through one builder
// that draws a native table or a grid from the same rows.
//
// Invented values. The options round the top band at offset -1 and the other
// band at offset 0, so a change in the max magnitude changes the result:
//   max magnitude 3: 1,234 -> 1,200   5,678 -> 5,700   2,468 -> 2,500
//                    3,579 -> 3,600   4,321 -> 4,300   8,765 -> 8,800
//   max magnitude 4: 98,765 -> 99,000, and every magnitude-3 value rounds to
//                    the nearest 1,000: 1,234 -> 1,000, 5,678 -> 6,000
// =============================================================================

const RW_OPTS = Object.assign({}, DR_DEFAULTS, {
  simplifyFirstRow: true, simplifyFirstColumn: true, simplifyDates: false,
  offsetTop: -1, offsetOther: 0, numTop: 1,
});

const RW_ROWS = [['1,234', '5,678'], ['2,468', '3,579']];

const RW_KINDS = ['native', 'grid'];

// Every log row from here on, kept whole: the log's own buffer drops old
// rows.
const rwLogged = [];

DR_LOG.onRow((row) => rwLogged.push(row));

const rwRows = (level, pattern) => rwLogged
  .filter((row) => row.level === level && pattern.test(row.text)).length;

const RW_CAP_ROW = /^Dynamic Rounding: above cell cap · cells: [\d,]+$/;

// --- A cell the extension holds, unchanged: the pass writes nothing. ---
(function rewrite01_aHeldCellTakesNoWrite() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    const held = t.pieces(0, 1)[0];
    const writesBefore = held.writes;
    t.write(1, 0, '4,321');
    page.settle();
    eq(`held cell (${kind}): the pass ran on the page edit elsewhere in the table`,
      t.text(1, 0), '4,300');
    eq(`held cell (${kind}): the pass writes nothing into a held cell`,
      { text: t.text(0, 1), writes: held.writes - writesBefore }, { text: '5,700', writes: 0 });
  });
})();

// --- A piece the page redrew to its original takes the patch again. ---
(function rewrite02_aPieceRedrawnToItsOriginalTakesThePatchAgain() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '1,234');
    page.settle();
    eq(`redraw (${kind}): a piece redrawn to its original shows the simplified value again`,
      t.text(0, 0), '1,200');
    eq(`redraw (${kind}): the stored original stays the original`,
      DR_MODEL.getTableOriginalText(t.table, t.cell(0, 0)), '1,234');
  });
})();

// --- The magnitude freeze on both table kinds. Expected texts come from
// RW_OPTS (top band offset -1, other band offset 0) and the frozen max
// magnitude 3. A max magnitude computed again would be 4 and would turn the
// held cells into 1,000 / 6,000 / 2,000 / 4,000. ---
(function freeze01_aLargerValueTheTableGainsRoundsUnderTheFrozenMaxMagnitude() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const cellCase = build(RW_ROWS);
    roundTableUnder(cellCase.table, RW_OPTS);
    cellCase.write(0, 0, '98,765');
    page.settle();
    eq(`magnitude freeze (${kind}): a larger value in a cell rounds under the top band's offset and the other cells keep their text`,
      cellCase.rowTexts(), [['99,000', '5,700'], ['2,500', '3,600']]);
    eq(`magnitude freeze (${kind}): after a larger value in a cell the max magnitude stays 3`,
      DR_MODEL.getTableMaxMagnitude(cellCase.table), 3);

    const rowCase = build(RW_ROWS);
    roundTableUnder(rowCase.table, RW_OPTS);
    rowCase.addRow(['98,765', '1,111']);
    page.settle();
    eq(`magnitude freeze (${kind}): a larger value in an added row rounds under the top band's offset and the other cells keep their text`,
      rowCase.rowTexts(), [['1,200', '5,700'], ['2,500', '3,600'], ['99,000', '1,100']]);
    eq(`magnitude freeze (${kind}): after an added row the stored originals stay the true originals`,
      [rowCase.cell(0, 0), rowCase.cell(0, 1), rowCase.cell(1, 0), rowCase.cell(1, 1)]
        .map((cell) => DR_MODEL.getTableOriginalText(rowCase.table, cell)),
      ['1,234', '5,678', '2,468', '3,579']);
  });
})();

// --- A toggle off and on computes the max magnitude again: the larger value
// sets magnitude 4, so the magnitude-3 values round to the nearest 1,000. ---
(function freeze02_aToggleOffAndOnComputesTheMaxMagnitudeAgain() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const cellCase = build(RW_ROWS);
    roundTableUnder(cellCase.table, RW_OPTS);
    cellCase.write(0, 0, '98,765');
    page.settle();
    resetTable(cellCase.table);
    roundTableUnder(cellCase.table, RW_OPTS);
    eq(`magnitude freeze (${kind}): after a toggle off and on the max magnitude reflects the larger value in a cell`,
      cellCase.rowTexts(), [['99,000', '6,000'], ['2,000', '4,000']]);

    const rowCase = build(RW_ROWS);
    roundTableUnder(rowCase.table, RW_OPTS);
    rowCase.addRow(['98,765', '1,111']);
    page.settle();
    resetTable(rowCase.table);
    roundTableUnder(rowCase.table, RW_OPTS);
    eq(`magnitude freeze (${kind}): after a toggle off and on the max magnitude reflects the larger value in an added row`,
      rowCase.rowTexts(), [['1,000', '6,000'], ['2,000', '4,000'], ['99,000', '1,000']]);
  });
})();

(function freeze04_theLensPreviewReadsTheMagnitudeFreeze() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '98,765');
    page.settle();
    const preview = extractPreviewSamples(t.table);
    eq(`lens preview (${kind}): the preview max magnitude is the frozen one`, preview.maxMag, 3);
    eq(`lens preview (${kind}): the top band holds the larger value alone`,
      preview.samples.top.map((s) => s.num), [98765]);
  });
})();

(function freeze04b_aLensPreviewBelowTheFrozenMaxMagnitudeHoldsNoTopBandSample() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    [[0, 0, '123'], [0, 1, '567'], [1, 0, '246'], [1, 1, '357']]
      .forEach(([row, col, text]) => t.write(row, col, text));
    page.settle();
    const preview = extractPreviewSamples(t.table);
    eq(`lens preview of 123, 567, 246, and 357 under a frozen max magnitude of 3 (${kind}): maxMag is 3`,
      preview.maxMag, 3);
    eq(`lens preview of 123, 567, 246, and 357 under a frozen max magnitude of 3 (${kind}): the top band is empty`,
      preview.samples.top, []);
    eq(`lens preview of 123, 567, 246, and 357 under a frozen max magnitude of 3 (${kind}): the other band holds 123`,
      preview.samples.other.map((s) => s.num), [123]);
  });
})();

(function freeze05_thePreviewFollowsTheFreezeAfterASettingsWrite() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '98,765');
    page.settle();
    resetTable(t.table);
    roundTableUnder(t.table, RW_OPTS);
    eq(`lens preview (${kind}): after a settings write the preview max magnitude is the table's current freeze`,
      extractPreviewSamples(t.table).maxMag, DR_MODEL.getTableMaxMagnitude(t.table));
    eq(`lens preview (${kind}): the current freeze is the larger value's magnitude`,
      DR_MODEL.getTableMaxMagnitude(t.table), 4);
  });
})();

// --- A first simplification that finds no number stores no max
// magnitude, so the next pass computes it from the numbers that arrive. ---
(function freeze03_aFirstSimplificationWithNoNumberFreezesNothing() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['pending', 'n/a'], ['tbd', 'none']]);
    roundTableUnder(t.table, RW_OPTS);
    eq(`no number at the first simplification (${kind}): a table with no number holds no max magnitude`,
      DR_MODEL.getTableMaxMagnitude(t.table) == null, true);
    t.write(0, 0, '1,234');
    t.write(0, 1, '5,678');
    page.settle();
    eq(`no number at the first simplification (${kind}): the next pass computes the max magnitude from the numbers that arrive`,
      t.rowTexts(), [['1,200', '5,700'], ['tbd', 'none']]);
  });
})();

// --- The page writes a new number. The cell simplifies it, and a
// restore puts back the new number. ---
(function rewrite04_aNewNumberSimplifiesAndRestoresToItself() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '4,321');
    page.settle();
    eq(`new number (${kind}): the cell simplifies the page's new value`, t.text(0, 0), '4,300');
    eq(`new number (${kind}): the stored original is the page's new value`,
      DR_MODEL.getTableOriginalText(t.table, t.cell(0, 0)), '4,321');
    resetTable(t.table);
    eq(`new number (${kind}): a restore puts back the page's new value`, t.text(0, 0), '4,321');
  });
})();

// --- The page writes a number that needs no rounding. The marker and
// the stored originals go, and a restore leaves the page's number. ---
(function rewrite05_anAlreadyRoundNumberReleasesTheCell() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '100');
    page.settle();
    eq(`round number (${kind}): the cell shows the page's number`, t.text(0, 0), '100');
    eq(`round number (${kind}): the marker and the stored originals go`,
      { marked: t.cell(0, 0).classList.contains('dr-ext-rounded'),
        stored: DR_MODEL.hasTableOriginal(t.table, t.cell(0, 0)) },
      { marked: false, stored: false });
    resetTable(t.table);
    eq(`round number (${kind}): a restore leaves the page's number`, t.text(0, 0), '100');
  });
})();

// --- The page writes text that is not a number. The cell is
// released, its hover text goes, and the page's text stays. ---
(function rewrite06_aWordReleasesTheCell() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, 'pending');
    page.settle();
    eq(`word (${kind}): the cell is released and keeps the page's text`,
      { text: t.text(0, 0), marked: t.cell(0, 0).classList.contains('dr-ext-rounded'),
        stored: DR_MODEL.hasTableOriginal(t.table, t.cell(0, 0)), title: t.cell(0, 0).title },
      { text: 'pending', marked: false, stored: false, title: '' });
    resetTable(t.table);
    eq(`word (${kind}): a restore leaves the page's text`, t.text(0, 0), 'pending');
  });
})();

// --- Hover text: a simplified cell carries its original as hover text, and a
// restore removes it, on both table kinds. A cell the pass leaves as written
// carries none. ---
(function hoverText_bothKindsShowTheOriginal() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['1,234', '5,678'], ['2,468', 'n/a']]);
    roundTableUnder(t.table, RW_OPTS);
    eq(`hover text (${kind}): a simplified cell shows its original`,
      t.cell(0, 0).title, 'Original: 1,234');
    eq(`hover text (${kind}): a cell left as written shows none`,
      t.cell(1, 1).title, '');
    resetTable(t.table);
    eq(`hover text (${kind}): a restore removes it`,
      [t.cell(0, 0).title, t.cell(0, 1).title], ['', '']);
  });
})();

// --- Times at minute granularity, on both table kinds: each clock time and
// ISO date-time rounds to the nearest minute, the last minute of the clock
// goes down, and the seconds drop. ---
(function timeRounding_minuteGranularityRoundsOnBothKinds() {
  const opts = Object.assign({}, RW_OPTS, { simplifyTimes: true, timeGranularity: 'minute' });
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['14:29:30', '23:59:45'], ['11:59:30 AM', '2026-01-01T14:29:30']]);
    roundTableUnder(t.table, opts);
    eq(`time rounding (${kind}): times round to the nearest minute and the last minute goes down`,
      t.rowTexts(), [['14:30', '23:59'], ['12:00 PM', '2026-01-01 14:30']]);
  });
})();

// --- Times at hour granularity, on both table kinds: the last hour of the
// clock goes down. ---
(function timeRounding_hourGranularityKeepsTheLastHourOnBothKinds() {
  const opts = Object.assign({}, RW_OPTS, { simplifyTimes: true, timeGranularity: 'hour' });
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['14:29:30', '23:45'], ['11:58 p.m.', '2026-11-09T23:45']]);
    roundTableUnder(t.table, opts);
    eq(`time rounding (${kind}): times round to the nearest hour and the last hour goes down`,
      t.rowTexts(), [['14:00', '23:00'], ['11:00 p.m.', '2026-11-09 23:00']]);
  });
})();

// --- Hover text the page set: a cell that carries the page's own hover text
// shows its original as hover text while simplified, and a restore puts the
// page's hover text back exactly. A cell with none ends with none. A write to
// a cell that is already simplified never takes the extension's own hover
// text for the page's. ---
(function hoverText_theRestorePutsTheHoverTextOfThePageBack() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['1,234', '5,678'], ['2,468', '3,579']]);
    t.cell(0, 0).title = 'Q1 revenue, in thousands';
    roundTableUnder(t.table, RW_OPTS);
    eq(`page hover text (${kind}): a simplified cell shows its original`,
      t.cell(0, 0).title, 'Original: 1,234');
    resetTable(t.table);
    eq(`page hover text (${kind}): a restore puts the page's hover text back`,
      t.cell(0, 0).title, 'Q1 revenue, in thousands');
    eq(`page hover text (${kind}): a cell with none has none after the restore`,
      t.cell(0, 1).title, '');
    eq(`page hover text (${kind}): the restore leaves the page's text`,
      t.text(0, 0), '1,234');
  });
})();

(function hoverText_aWriteToASimplifiedCellKeepsTheHoverTextOfThePage() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['1,234', '5,678'], ['2,468', '3,579']]);
    t.cell(0, 0).title = 'Q1 revenue, in thousands';
    roundTableUnder(t.table, RW_OPTS);
    // The page redraws the piece to its original: the held cell takes the patch again.
    t.write(0, 0, '1,234');
    page.settle();
    eq(`page hover text (${kind}): a held cell written again shows its original`,
      t.cell(0, 0).title, 'Original: 1,234');
    // The page writes a new value: the cell is released, then simplified fresh.
    t.write(0, 0, '9,876');
    page.settle();
    eq(`page hover text (${kind}): a rewritten cell shows its new original`,
      t.cell(0, 0).title, 'Original: 9,876');
    resetTable(t.table);
    eq(`page hover text (${kind}): a restore after both writes puts the page's hover text back`,
      t.cell(0, 0).title, 'Q1 revenue, in thousands');
  });
})();

// --- Hover text the page changed: a restore never writes hover text the page
// no longer shows, the way it never writes a number the page no longer shows.
// A release puts the stored page hover text back only while the cell still
// shows the extension's own hover text. ---
(function hoverText_aPageThatChangesTextAndHoverTextKeepsTheLatest() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['1,234', '5,678'], ['2,468', '3,579']]);
    t.cell(0, 0).title = 'Updated 10:00';
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '9,876');
    t.cell(0, 0).title = 'Updated 10:05';
    page.settle();
    eq(`changed hover text (${kind}): the rewritten cell shows its new original`,
      t.cell(0, 0).title, 'Original: 9,876');
    resetTable(t.table);
    eq(`changed hover text (${kind}): a restore leaves the latest hover text of the page`,
      t.cell(0, 0).title, 'Updated 10:05');
  });
})();

(function hoverText_aTitleOnlyChangeSurvivesTheNextWriteAndRestore() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['1,234', '5,678'], ['2,468', '3,579']]);
    t.cell(0, 0).title = 'Updated 10:00';
    roundTableUnder(t.table, RW_OPTS);
    t.cell(0, 0).title = 'Updated 10:05';
    // The page redraws the piece to its original: the held cell takes the patch again.
    t.write(0, 0, '1,234');
    page.settle();
    eq(`changed hover text (${kind}): the held cell shows its original again`,
      t.cell(0, 0).title, 'Original: 1,234');
    resetTable(t.table);
    eq(`changed hover text (${kind}): a restore leaves the latest hover text of the page`,
      t.cell(0, 0).title, 'Updated 10:05');
  });
})();

(function hoverText_aRestoreLeavesATitleOnlyChange() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([['1,234', '5,678'], ['2,468', '3,579']]);
    t.cell(0, 0).title = 'Updated 10:00';
    roundTableUnder(t.table, RW_OPTS);
    t.cell(0, 0).title = 'Updated 10:05';
    resetTable(t.table);
    eq(`changed hover text (${kind}): a restore with no pass between leaves the latest hover text`,
      [t.cell(0, 0).title, t.text(0, 0)], ['Updated 10:05', '1,234']);
  });
})();

// --- The page rewrites one piece of a cell with several pieces. The
// other pieces show their original text again before the cell simplifies
// fresh, so the stored originals hold no text the extension wrote. ---
(function rewrite07_onePieceOfSeveralRewritten() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTableUnder(t.table, RW_OPTS);
    eq(`one piece (${kind}, precondition): both numbers of the cell round`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['1,200', ' to ', '5,700']);
    t.write(0, 0, '2,222', 0);
    page.settle();
    eq(`one piece (${kind}): the cell simplifies the page's new value and its other piece`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['2,200', ' to ', '5,700']);
    eq(`one piece (${kind}): the stored originals hold no extension-written text`,
      ((DR_MODEL.getTableOriginal(t.table, t.cell(0, 0)) || {}).pieces || []).map((p) => p.text),
      ['2,222', ' to ', '5,678']);
  });
})();

// --- A number that appears twice in a cell rounds or stays by its own
// piece: a piece inside a markup range stays, and a plain piece rounds.
// Invented values at magnitude 3 under RW_OPTS: 1,234 -> 1,200 and
// 9,850 -> 9,900. ---
// The rows of a table with the given cell at (0, 0).
const rowsAroundCell = (cell) => [[cell, '2,468'], ['3,579', '4,321']];
// The texts of the pieces of the cell at (r, c).
const cellPieceTexts = (t, r, c) => t.pieces(r, c).map((piece) => piece.nodeValue);

(function markupRange_aNumberTwiceOnePlainOneLinked() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const plainThenLinked = build(rowsAroundCell(['1,234 items, see ', { tag: 'a', text: '1,234' }]));
    roundTableUnder(plainThenLinked.table, RW_OPTS);
    eq(`a number twice, plain then linked (${kind}): the plain 1,234 rounds and the linked 1,234 holds`,
      cellPieceTexts(plainThenLinked, 0, 0), ['1,200 items, see ', '1,234']);
    eq(`a number twice, plain then linked (${kind}): the rest of the table rounds`,
      [plainThenLinked.text(0, 1), plainThenLinked.text(1, 0)], ['2,500', '3,600']);
    reapplyRounding(plainThenLinked.table);
    eq(`a number twice, plain then linked (${kind}): the same holds after a re-apply`,
      cellPieceTexts(plainThenLinked, 0, 0), ['1,200 items, see ', '1,234']);
  });
})();

(function markupRange_aNumberTwiceOneLinkedOnePlain() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const linkedThenPlain = build(rowsAroundCell([{ tag: 'a', text: '1,234' }, ' items, total 1,234']));
    roundTableUnder(linkedThenPlain.table, RW_OPTS);
    eq(`a number twice, linked then plain (${kind}): the linked 1,234 holds and the plain 1,234 rounds`,
      cellPieceTexts(linkedThenPlain, 0, 0), ['1,234', ' items, total 1,200']);
    reapplyRounding(linkedThenPlain.table);
    eq(`a number twice, linked then plain (${kind}): the same holds after a re-apply`,
      cellPieceTexts(linkedThenPlain, 0, 0), ['1,234', ' items, total 1,200']);
  });
})();

(function markupRange_aNumberTwiceBothPlainOrBothLinked() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const bothPlain = build(rowsAroundCell(['1,234 and ', { tag: 'b', text: '1,234' }]));
    roundTableUnder(bothPlain.table, RW_OPTS);
    eq(`a number twice, both plain (${kind}): both occurrences round`,
      cellPieceTexts(bothPlain, 0, 0), ['1,200 and ', '1,200']);
    const bothLinked = build(rowsAroundCell([{ tag: 'a', text: '1,234' }, ' and ', { tag: 'a', text: '1,234' }]));
    roundTableUnder(bothLinked.table, RW_OPTS);
    eq(`a number twice, both linked (${kind}): both occurrences hold`,
      cellPieceTexts(bothLinked, 0, 0), ['1,234', ' and ', '1,234']);
  });
})();

// A number whose digits span two pieces sits in no single piece: it stays
// unchanged.
(function splitNumber_aNumberAcrossTwoPiecesStaysUnchanged() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(rowsAroundCell(['ref 1,2', { tag: 'b', text: '34' }]));
    roundTableUnder(t.table, RW_OPTS);
    eq(`split number (${kind}): the number across two pieces stays unchanged`,
      cellPieceTexts(t, 0, 0), ['ref 1,2', '34']);
  });
})();

// A pretty-printed native cell: whitespace between the pieces makes the
// rendered text differ from the flat text, so the number positions convert
// from the rendered text to the pieces.
(function markupRange_aPrettyPrintedCellWithADuplicateNumber() {
  eachRewriteKind(['native'], (kind, page, build) => {
    const t = build(rowsAroundCell(['\n      1,234 items\n      see ', { tag: 'a', text: '1,234' }, '\n    ']));
    const cell = t.cell(0, 0);
    Object.defineProperty(cell, 'innerText', {
      get() { return t.pieces(0, 0).map((p) => p.nodeValue).join('').replace(/\s+/g, ' ').trim(); },
      configurable: true,
    });
    roundTableUnder(t.table, RW_OPTS);
    eq(`a number twice, pretty-printed (${kind}): the plain 1,234 rounds and the linked 1,234 holds`,
      cellPieceTexts(t, 0, 0), ['\n      1,200 items\n      see ', '1,234', '\n    ']);
    reapplyRounding(t.table);
    eq(`a number twice, pretty-printed (${kind}): the same holds after a re-apply`,
      cellPieceTexts(t, 0, 0), ['\n      1,200 items\n      see ', '1,234', '\n    ']);
  });
})();

(function record_holdsValuePiecesAndPageTitleAlone() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(rowsAroundCell(['Total 9,850 kg ', { tag: 'sup', text: '7' }, ' ref ', { tag: 'a', text: '12' }]));
    roundTableUnder(t.table, RW_OPTS);
    const record = DR_MODEL.getTableOriginal(t.table, t.cell(0, 0));
    eq(`record (${kind}): the cell with a link and a footnote simplified (precondition)`,
      cellPieceTexts(t, 0, 0), ['Total 9,900 kg ', '7', ' ref ', '12']);
    eq(`record (${kind}): the record holds value, pieces, and pageTitle alone`,
      Object.keys(record).sort(), ['pageTitle', 'pieces', 'value']);
  });
})();

// A re-apply, started by the page rewriting a different cell, classifies the
// simplified cell again from its stored original: the linked number and the
// footnote digit hold and the plain numbers stay rounded.
(function reapply_aSimplifiedCellKeepsItsLinkAndFootnote() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(rowsAroundCell(['Total 9,850 kg ', { tag: 'sup', text: '7' }, ' ref ', { tag: 'a', text: '12' }, ' and 5,678']));
    roundTableUnder(t.table, RW_OPTS);
    eq(`re-apply of a cell with a link and a footnote (${kind}, precondition): the plain numbers round, the footnote and the link hold`,
      cellPieceTexts(t, 0, 0), ['Total 9,900 kg ', '7', ' ref ', '12', ' and 5,700']);
    t.write(1, 0, '4,321');
    page.settle();
    eq(`re-apply of a cell with a link and a footnote (${kind}): the pass ran on the other cell's rewrite`,
      t.text(1, 0), '4,300');
    eq(`re-apply of a cell with a link and a footnote (${kind}): the linked number and the footnote digit hold and the plain numbers stay rounded`,
      cellPieceTexts(t, 0, 0), ['Total 9,900 kg ', '7', ' ref ', '12', ' and 5,700']);
  });
})();

// The page rewrites the plain piece of a cell that holds a link: the cell is
// a rewritten cell, so it simplifies again from the page's new text and the
// linked number still holds.
(function reapply_aRewrittenCellKeepsItsLink() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(rowsAroundCell(['1,234 items, see ', { tag: 'a', text: '1,234' }]));
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '4,321 items, see ', 0);
    page.settle();
    eq(`rewritten cell with a link (${kind}): the new plain number rounds and the linked number holds`,
      cellPieceTexts(t, 0, 0), ['4,300 items, see ', '1,234']);
    eq(`rewritten cell with a link (${kind}): the stored original is the page's new text`,
      DR_MODEL.getTableOriginalText(t.table, t.cell(0, 0)), '4,321 items, see 1,234');
  });
})();

// --- A grid that reuses its cell elements for other rows on scroll.
// Each reused cell simplifies the new row's value, and a restore puts back
// that value, never the previous row's. ---
(function rewrite09_aReusedGridCellShowsItsNewRow() {
  eachRewriteKind(['grid'], (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    const scrolled = [['4,321', '8,765'], ['6,543', '7,654']];
    scrolled.forEach((row, r) => row.forEach((text, c) => t.write(r, c, text)));
    page.settle();
    eq('reused cells (grid): every reused cell simplifies the new row\'s value',
      t.rowTexts(), [['4,300', '8,800'], ['6,500', '7,700']]);
    resetTable(t.table);
    eq('reused cells (grid): a restore puts back the new rows\' values',
      t.rowTexts(), scrolled);
  });
})();

// --- The extension's own writes, a restore included, run no pass,
// and a burst of page edits runs one pass. ---
(function rewrite11_ownWritesRunNoPassAndABurstRunsOne() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    page.settle();
    eq(`own writes (${kind}): the first simplification runs no pass`, page.passes(), 0);
    t.write(0, 0, '4,321');
    t.write(0, 1, '8,765');
    t.write(1, 0, '6,543');
    page.settle();
    eq(`own writes (${kind}): a burst of page edits runs one pass`,
      { passes: page.passes(), texts: t.rowTexts() },
      { passes: 1, texts: [['4,300', '8,800'], ['6,500', '3,600']] });
    page.settle();
    eq(`own writes (${kind}): the pass's own writes run no further pass`, page.passes(), 1);
    resetTable(t.table);
    page.settle();
    eq(`own writes (${kind}): a restore runs no pass`, page.passes(), 1);
  });
})();

// --- An added row simplifies, on each kind. ---
(function rewrite12_anAddedRowSimplifies() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    t.addRow(['4,321', '8,765']);
    page.settle();
    eq(`added row (${kind}): the added row simplifies`,
      t.rowTexts()[2], ['4,300', '8,800']);
  });
})();

// --- A restore before any pass has run, after the page rewrote one
// piece of a cell. The page's text stays, and the untouched pieces show
// their originals. ---
(function rewrite13_aRestoreBeforeAnyPassKeepsThePagesText() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTableUnder(t.table, RW_OPTS);
    t.write(0, 0, '2,222', 0);
    t.write(1, 1, '9,999');
    resetTable(t.table);
    eq(`early restore (${kind}): the rewritten piece keeps the page's text, and the untouched piece shows its original`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['2,222', ' to ', '5,678']);
    eq(`early restore (${kind}): a cell the page rewrote whole keeps the page's text`,
      t.text(1, 1), '9,999');
    eq(`early restore (${kind}): the cells the extension held show their originals`,
      [t.text(0, 1), t.text(1, 0)], ['2,468', '3,579']);
    eq(`early restore (${kind}): every cell restores, so the table shows its originals`,
      showsSimplified(t.table), false);
  });
})();

// --- The cell cap. A table one cell over the cap writes nothing,
// its re-apply observer stops, and one debug row records it. A table at the cap runs
// its pass. A table over the cap at its first simplification never attaches
// a re-apply observer. The pass target is below every duration, so a re-apply pass
// row beside the stop's row would show. ---
(function rewrite14_theCellCap() {
  const savedCap = DR_DETECTION_SETTINGS.reapplyCellCap;
  const savedTarget = DR_DETECTION_SETTINGS.passTargetMs;
  DR_DETECTION_SETTINGS.reapplyCellCap = 4;
  DR_DETECTION_SETTINGS.passTargetMs = -1;
  try {
    eachRewriteKind(RW_KINDS, (kind, page, build) => {
      const t = build(RW_ROWS);
      roundTableUnder(t.table, RW_OPTS);
      t.write(0, 0, '4,321');
      page.settle();
      eq(`cell cap (${kind}): a table at the cap runs its pass`, t.text(0, 0), '4,300');

      const rowsBefore = rwLogged.length;
      t.addRow(['8,765']);
      t.write(0, 1, '6,543');
      page.settle();
      eq(`cell cap (${kind}): a pass over the cap writes nothing`,
        [t.text(0, 1), t.rowTexts()[2][0]], ['6,543', '8,765']);
      eq(`cell cap (${kind}): the stop writes one row and no re-apply pass row`,
        rwLogged.slice(rowsBefore).map((row) => row.text), ['Dynamic Rounding: above cell cap · cells: 5']);
      t.write(1, 0, '7,654');
      page.settle();
      eq(`cell cap (${kind}): the stopped re-apply observer runs no later pass`, t.text(1, 0), '7,654');

      const big = build(RW_ROWS.concat([['9,876']]));
      const rowsAtFirst = rwRows('debug', RW_CAP_ROW);
      roundTableUnder(big.table, RW_OPTS);
      eq(`cell cap (${kind}): the first simplification over the cap still simplifies`,
        big.text(2, 0), '9,900');
      eq(`cell cap (${kind}): the first simplification over the cap records one debug row`,
        rwRows('debug', RW_CAP_ROW) - rowsAtFirst, 1);
      eq(`cell cap (${kind}): the cap writes no warn row, so it raises no toast`,
        rwRows('warn', RW_CAP_ROW), 0);
      big.write(0, 0, '4,321');
      page.settle();
      eq(`cell cap (${kind}): a table over the cap at its first simplification runs no pass`,
        big.text(0, 0), '4,321');
    });
  } finally {
    DR_DETECTION_SETTINGS.reapplyCellCap = savedCap;
    DR_DETECTION_SETTINGS.passTargetMs = savedTarget;
  }
})();

// --- The pass target. A re-apply pass writes a row only when it runs longer
// than the pass target; one that leaves a split number as written still
// writes none. ---
(function rewrite_aReapplyPassWritesARowOnlyOverThePassTarget() {
  const savedTarget = DR_DETECTION_SETTINGS.passTargetMs;
  try {
    eachRewriteKind(RW_KINDS, (kind, page, build) => {
      DR_DETECTION_SETTINGS.passTargetMs = savedTarget;
      const t = build([[['6,7', { tag: 'b', text: '18,245' }], '1,234'], ['2,468', '3,579']]);
      roundTableUnder(t.table, RW_OPTS);
      let before = rwLogged.length;
      t.write(1, 0, '4,321');
      page.settle();
      eq(`pass target (${kind}): a re-apply pass under the target writes no row`,
        rwLogged.slice(before).map((row) => row.text), []);
      DR_DETECTION_SETTINGS.passTargetMs = -1;
      before = rwLogged.length;
      t.write(1, 0, '4,322');
      page.settle();
      const rows = rwLogged.slice(before).map((row) => row.text);
      eq(`pass target (${kind}): a re-apply pass over the target writes one row with its duration`,
        rows.length === 1 && /^Dynamic Rounding: re-apply pass · ms: [\d,]+$/.test(rows[0]), true);
    });
  } finally {
    DR_DETECTION_SETTINGS.passTargetMs = savedTarget;
  }
})();

// --- Page edits arriving faster than the settle delay. A pass runs
// once the burst reaches the longest wait. ---
(function rewrite15_aBurstThatNeverGoesQuietStillRunsAPass() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTableUnder(t.table, RW_OPTS);
    const start = page.now();
    let firstPassAt = null;
    for (let step = 0; step < 20; step++) {
      t.write(1, 1, step % 2 === 0 ? '4,321' : '4,322');
      page.advance(50);
      if (firstPassAt === null && page.passes() > 0) firstPassAt = page.now() - start;
    }
    eq(`longest wait (${kind}): a pass runs within the longest wait of the burst's start`,
      firstPassAt !== null && firstPassAt <= 1000, true);
    eq(`longest wait (${kind}): that pass simplifies the page's value`, t.text(1, 1), '4,300');
    // 20 steps of 50 ms end exactly at the longest wait, so the capped pass is
    // the last event before this check. Another step count leaves a live timer.
    eq(`longest wait (${kind}): no timer record remains for the table after the capped pass`,
      reapplyTimers.has(t.table), false);
  });
})();

// --- A native cell with a link, a superscript, and several text
// pieces restores through the one piece restore, to markup identical to its
// markup before simplification. ---
(function rewrite16_aNativeCellRestoresPieceByPiece() {
  eachRewriteKind(['native'], (kind, page, build) => {
    const t = build([
      [['Total ', { tag: 'a', text: 'note 12' }, ', ', { tag: 'b', text: '9,850' }, ' kg', { tag: 'sup', text: '2' }], '1,234'],
      ['2,468', '3,579'],
    ]);
    const cell = t.cell(0, 0);
    const markupBefore = cell.innerHTML;
    const piecesBefore = t.pieces(0, 0);
    roundTableUnder(t.table, RW_OPTS);
    eq('piece restore (native, precondition): the number outside the link rounds, the link and the superscript hold',
      t.pieces(0, 0).map((p) => p.nodeValue), ['Total ', 'note 12', ', ', '9,900', ' kg', '2']);
    const writesBefore = cell.innerHTMLWrites;
    resetTable(t.table);
    eq('piece restore (native): the markup after the restore matches the markup before simplification',
      cell.innerHTML, markupBefore);
    eq('piece restore (native): the restore writes no markup, so every text piece keeps its node',
      { markupWrites: cell.innerHTMLWrites - writesBefore,
        sameNodes: t.pieces(0, 0).every((p, k) => p === piecesBefore[k]) },
      { markupWrites: 0, sameNodes: true });
  });
})();

// A native cell's rendered text read after another cell's write makes the
// browser lay out the whole table again, once per cell, so a 10,000-cell
// table takes most of a minute to simplify. The pass reads every cell's
// rendered text before its first write and none after.
(function rewriteThePassReadsNoRenderedTextAfterAWrite() {
  eachRewriteKind(['native'], (kind, page, build) => {
    const t = build(RW_ROWS);
    const allPieces = () => [0, 1].flatMap((r) => [0, 1].flatMap((c) => t.pieces(r, c)));
    let readsAfterAWrite = 0;
    for (const r of [0, 1]) {
      for (const c of [0, 1]) {
        const cell = t.cell(r, c);
        Object.defineProperty(cell, 'innerText', {
          get() {
            if (allPieces().some((piece) => piece.writes > 0)) readsAfterAWrite++;
            return cell.textContent;
          },
        });
      }
    }
    roundTableUnder(t.table, RW_OPTS);
    eq('rendered text (native): the first simplification reads no rendered text after a write',
      { readsAfterAWrite, rows: t.rowTexts() },
      { readsAfterAWrite: 0, rows: [['1,200', '5,700'], ['2,500', '3,600']] });
  });
})();

// A grid cell the page redraws with fewer text pieces is a
// rewritten cell. It drops its originals and simplifies fresh, so a restore
// never leaves it unrestorable.
(function rewrite423_aCellRedrawnWithFewerPiecesSimplifiesFresh() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTableUnder(t.table, RW_OPTS);
    t.redraw(0, 0, '8,765');
    page.settle();
    eq(`fewer pieces (${kind}): the redrawn cell simplifies its new value`, t.text(0, 0), '8,800');
    eq(`fewer pieces (${kind}): the stored original is the redrawn value`,
      DR_MODEL.getTableOriginalText(t.table, t.cell(0, 0)), '8,765');
    resetTable(t.table);
    eq(`fewer pieces (${kind}): the restore leaves no cell unrestorable and puts back the redrawn value`,
      { text: t.text(0, 0), simplified: showsSimplified(t.table) },
      { text: '8,765', simplified: false });
  });
})();

// A redraw that changes a cell's count of text pieces but leaves a piece
// showing the extension's written text: the piece matches its stored piece
// by text, not by position, and takes its original back before the record
// drops. The pass then simplifies the cell from its true original, and a
// restore shows it.
(function rewriteACellRedrawnWithAnExtraPieceMatchesByText() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([[[{ tag: 'b', text: '1,613,245' }, ' units'], '5,678'], ['2,468', '3,579']]);
    roundTableUnder(t.table, RW_OPTS);
    eq(`extra piece (${kind}, precondition): the first simplification rounds the bold number`,
      t.text(0, 0), '1,600,000 units');
    t.redraw(0, 0, [{ tag: 'b', text: '1,600,000' }, ' units', { tag: 'i', text: ' est.' }]);
    page.settle();
    const record = DR_MODEL.getTableOriginal(t.table, t.cell(0, 0));
    eq(`extra piece (${kind}): the pass simplifies the cell from its true original`,
      { text: t.text(0, 0), original: DR_MODEL.getTableOriginalText(t.table, t.cell(0, 0)),
        storedTexts: record && record.pieces.map((piece) => piece.text) },
      { text: '1,600,000 units est.', original: '1,613,245 units est.',
        storedTexts: ['1,613,245', ' units', ' est.'] });
    resetTable(t.table);
    eq(`extra piece (${kind}): a restore shows the true original`, t.text(0, 0), '1,613,245 units est.');
  });
})();

// The same redraw with a restore before any pass, and two pieces showing the
// same written text: matching runs in page order, and each stored piece
// matches one live piece at most, so each number gets its own original back.
(function rewriteARestoreMatchesDuplicateWrittenTextInOrder() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,613,245' }, ' to ', { tag: 'b', text: '1,587,002' }], '5,678'],
      ['2,468', '3,579'],
    ]);
    roundTableUnder(t.table, RW_OPTS);
    eq(`duplicate written text (${kind}, precondition): both numbers show the same rounded text`,
      t.text(0, 0), '1,600,000 to 1,600,000');
    t.redraw(0, 0, [{ tag: 'b', text: '1,600,000' }, ' to ', { tag: 'b', text: '1,600,000' },
      { tag: 'i', text: ' est.' }]);
    resetTable(t.table);
    eq(`duplicate written text (${kind}): a restore before any pass puts each original back in order`,
      { simplified: showsSimplified(t.table), text: t.text(0, 0) },
      { simplified: false, text: '1,613,245 to 1,587,002 est.' });
  });
})();

// A restore that arrives before a pass, on a cell the page redrew with fewer
// pieces: the page's text stays and nothing counts unrestorable.
(function rewrite423_aRestoreBeforeAPassOnACellWithFewerPieces() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTableUnder(t.table, RW_OPTS);
    t.redraw(0, 0, '8,765');
    resetTable(t.table);
    eq(`fewer pieces, early restore (${kind}): the page's text stays and no cell is unrestorable`,
      { simplified: showsSimplified(t.table), text: t.text(0, 0), marked: t.cell(0, 0).classList.contains('dr-ext-rounded') },
      { simplified: false, text: '8,765', marked: false });
  });
})();

// =============================================================================
// Placement by digits. A cell that rounds in place
// holds one match per number, measured over its digits. The placement step
// keeps each match whose digits sit in one text piece and leaves the others as
// written; a cell with no match left stays as written. Every case runs on a
// native table and on a grid. Invented values under RW_OPTS: the table's other
// cells hold 2,468, 3,579 and 4,321, so the max magnitude is 3 and
// 5,678 -> 5,700, 1,234 -> 1,200.
// =============================================================================

// The pieces of the cell at (0, 0) after the pass.
const placeCellAfter = (build, rows, opts) => {
  const t = build(rows);
  roundTableUnder(t.table, opts || RW_OPTS);
  return cellPieceTexts(t, 0, 0);
};

// A split number and a whole number in one cell: the whole number rounds and
// the split number stays as written.
(function placement_aWholeNumberRoundsBesideASplitNumber() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    eq(`placement split and whole (${kind}): the whole number rounds and the split number stays`,
      placeCellAfter(build, rowsAroundCell(['1,2', { tag: 'b', text: '34' }, ' to 5,678'])),
      ['1,2', '34', ' to 5,700']);
    eq(`placement whole and split (${kind}): the order of the two numbers does not matter`,
      placeCellAfter(build, rowsAroundCell(['5,678 to 1,2', { tag: 'b', text: '34' }])),
      ['5,700 to 1,2', '34']);
    eq(`placement split only (${kind}): a cell with no whole number stays as written`,
      placeCellAfter(build, rowsAroundCell(['ref 1,2', { tag: 'b', text: '34' }])),
      ['ref 1,2', '34']);
    const t = build(rowsAroundCell(['1,2', { tag: 'b', text: '34' }, ' to 5,678']));
    roundTableUnder(t.table, RW_OPTS);
    eq(`placement split and whole (${kind}): the cell counts as simplified`,
      t.cell(0, 0).classList.contains('dr-ext-rounded'), true);
  });
})();

// A currency sign in its own piece beside the number rounds the digits and
// leaves the sign where it sits.
(function placement_aSignInItsOwnPieceStaysWhereItSits() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    eq(`placement sign piece (${kind}): the digits round and the dollar sign stays in its piece`,
      placeCellAfter(build, rowsAroundCell(['$', '1,234'])), ['$', '1,200']);
    eq(`placement sign piece (${kind}): a sign inside a styled piece stays too`,
      placeCellAfter(build, rowsAroundCell([{ tag: 'b', text: '$' }, { tag: 'i', text: '1,234' }])), ['$', '1,200']);
    eq(`placement sign piece (${kind}): a decimal number after the sign rounds`,
      placeCellAfter(build, rowsAroundCell(['$', '337.91'])), ['$', '300']);
  });
})();

// Numbers on separate lines in separate pieces round one by one.
(function placement_numbersOnSeparateLinesRoundOneByOne() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    eq(`placement lines (${kind}): 1,234 above 5,678 in two pieces rounds both`,
      placeCellAfter(build, rowsAroundCell(['1,234', '\n', '5,678'])), ['1,200', '\n', '5,700']);
    eq(`placement lines (${kind}): 1500 above 1600 in two pieces rounds both`,
      placeCellAfter(build, rowsAroundCell(['1500\n', '1600'])), ['1,500\n', '1,600']);
    eq(`placement lines (${kind}): 125 above 126 in two pieces rounds both`,
      placeCellAfter(build, rowsAroundCell(['125\n', '126'])), ['100\n', '100']);
  });
})();

// Words around numbers: the numbers round under the defaults and under every
// combination of the percent and currency switches. A percent cell stays as
// written with the percent switch off, a currency cell with the currency
// switch off.
(function placement_numbersInsideWordsRoundUnderEverySwitchCombination() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    for (const currency of [true, false]) {
      for (const percent of [true, false]) {
        const opts = Object.assign({}, RW_OPTS, { simplifyMixedCurrency: currency, simplifyMixedPercent: percent });
        const label = `placement words (${kind}, currency switch ${currency ? 'on' : 'off'}, percent switch ${percent ? 'on' : 'off'})`;
        eq(`${label}: a cell of words and plain numbers rounds`,
          placeCellAfter(build, rowsAroundCell('Revenue 1,234 units, up 5,678 units'), opts),
          ['Revenue 1,200 units, up 5,700 units']);
        eq(`${label}: a percent cell ${percent ? 'rounds' : 'stays as written'}`,
          placeCellAfter(build, rowsAroundCell('Up 1,234% on the year'), opts),
          [percent ? 'Up 1,200% on the year' : 'Up 1,234% on the year']);
        eq(`${label}: a currency cell ${currency ? 'rounds' : 'stays as written'}`,
          placeCellAfter(build, rowsAroundCell('Revenue $1,234 total'), opts),
          [currency ? 'Revenue $1,200 total' : 'Revenue $1,234 total']);
      }
    }
    eq(`placement words (${kind}, shipped defaults): words around a number round`,
      placeCellAfter(build, rowsAroundCell('Revenue 1,234 units'), Object.assign({}, DR_DEFAULTS, RW_OPTS)),
      ['Revenue 1,200 units']);
  });
})();

// A number inside a link beside a currency sign outside the link stays.
(function placement_aLinkedNumberBesideASignOutsideTheLinkStays() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    eq(`placement link (${kind}): the sign outside the link and the linked number stay`,
      placeCellAfter(build, rowsAroundCell(['$', { tag: 'a', text: '1,234' }])), ['$', '1,234']);
    eq(`placement link (${kind}): a plain number beside the linked number rounds`,
      placeCellAfter(build, rowsAroundCell(['5,678 and ', { tag: 'a', text: '1,234' }])), ['5,700 and ', '1,234']);
  });
})();

// Both kinds count a split number the same.
(function placement_aSplitNumberCountsTheSameOnBothKinds() {
  for (const [name, spec] of [['split only', ['ref 1,2', { tag: 'b', text: '34' }]],
    ['split and whole', ['1,2', { tag: 'b', text: '34' }, ' to 5,678']]]) {
    eachRewriteKind(RW_KINDS, (kind, page, build) => {
      const t = build(rowsAroundCell(spec));
      eq(`placement split number (${kind}, ${name}): the pass counts one split number`,
        roundTableUnder(t.table, RW_OPTS).leftAsWritten.splitValue, 1);
    });
  }
})();

// =============================================================================
// Placement of dates. Each date in a cell changes on its own, so a date whose
// characters sit in one text piece changes, and a date whose characters sit in
// two text pieces stays as written. Every case runs on a native table and on a
// grid, with invented values; the table's other cells hold 2,468, 3,579 and
// 4,321.
// =============================================================================

const datePlacementOpts = (dateGranularity) => Object.assign({}, RW_OPTS,
  { simplifyDates: true, simplifyTimes: true, dateGranularity, timeGranularity: 'hour' });

// The pieces of the cell at (0, 0) and the pass's result.
const datePlacementAfter = (build, cell, dateGranularity) => {
  const t = build(rowsAroundCell(cell));
  const result = roundTableUnder(t.table, datePlacementOpts(dateGranularity));
  return { pieces: cellPieceTexts(t, 0, 0), text: t.text(0, 0), splitValue: result.leftAsWritten.splitValue };
};

(function datePlacement_aSentenceWithALinkAndAnItalicWord() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const after = datePlacementAfter(build, ['In December 1965, the ', { tag: 'a', text: 'committee' },
      ' met; it ', { tag: 'i', text: 'reported' }, ' in February 1966.'], 'year');
    eq(`date placement (${kind}): "In December 1965, the committee met; it reported in February 1966." at year reads "In 1965, the committee met; it reported in 1966."`,
      after.text, 'In 1965, the committee met; it reported in 1966.');
    eq(`date placement (${kind}): in the same sentence at year, the link "committee" and the italic "reported" keep their text`,
      after.pieces, ['In 1965, the ', 'committee', ' met; it ', 'reported', ' in 1966.']);
    eq(`date placement (${kind}): the same sentence at year counts no split value`, after.splitValue, 0);
  });
})();

(function datePlacement_aSplitDateBesideAWholeDate() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const splitFirst = datePlacementAfter(build,
      [{ tag: 'b', text: '2024-' }, { tag: 'b', text: '03-15' }, ' and 2024-04-20'], 'month');
    eq(`date placement (${kind}): bold "2024-" and bold "03-15" then " and 2024-04-20" at month reads "2024-03-15 and 2024-04"`,
      splitFirst.pieces, ['2024-', '03-15', ' and 2024-04']);
    eq(`date placement (${kind}): bold "2024-" and bold "03-15" then " and 2024-04-20" at month counts one split value`,
      splitFirst.splitValue, 1);
    const wholeFirst = datePlacementAfter(build,
      ['2024-04-20 and ', { tag: 'b', text: '2024-' }, { tag: 'b', text: '03-15' }], 'month');
    eq(`date placement (${kind}): "2024-04-20 and " then bold "2024-" and bold "03-15" at month reads "2024-04 and 2024-03-15"`,
      wholeFirst.pieces, ['2024-04 and ', '2024-', '03-15']);
    eq(`date placement (${kind}): "2024-04-20 and " then bold "2024-" and bold "03-15" at month counts one split value`,
      wholeFirst.splitValue, 1);
    const splitOnly = datePlacementAfter(build, ['Due ', { tag: 'b', text: '2024-' }, '03-15'], 'month');
    eq(`date placement (${kind}): "Due " then bold "2024-" and "03-15" at month stays as written and counts one split value`,
      [splitOnly.pieces, splitOnly.splitValue], [['Due ', '2024-', '03-15'], 1]);
  });
})();

(function datePlacement_leadingSpaces() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    eq(`date placement (${kind}): "   Jun 2020 - Dec 2021" in one piece at year reads "   2020 - 2021"`,
      datePlacementAfter(build, '   Jun 2020 - Dec 2021', 'year').pieces, ['   2020 - 2021']);
    eq(`date placement (${kind}): "  " then "Jun 2020 - " then bold "Dec 2021" at year reads "  ", "2020 - ", "2021"`,
      datePlacementAfter(build, ['  ', 'Jun 2020 - ', { tag: 'b', text: 'Dec 2021' }], 'year').pieces,
      ['  ', '2020 - ', '2021']);
    // The second date starts two characters after the piece boundary in the
    // trimmed text, so a check that left out the leading spaces would find it
    // split.
    const boundaryBefore = datePlacementAfter(build, ['  Jun 2020 - ', { tag: 'b', text: 'Dec 2021' }], 'year');
    eq(`date placement (${kind}): "  Jun 2020 - " then bold "Dec 2021" at year reads "  2020 - ", "2021" and counts no split value`,
      [boundaryBefore.pieces, boundaryBefore.splitValue], [['  2020 - ', '2021'], 0]);
    // The second date ends two characters after the piece boundary, so a
    // check that left out the leading spaces would find it in one piece.
    const boundaryInside = datePlacementAfter(build, ['  Jun 2020 - Dec 20', { tag: 'b', text: '21' }], 'year');
    eq(`date placement (${kind}): "  Jun 2020 - Dec 20" then bold "21" at year reads "  2020 - Dec 20", "21" and counts one split value`,
      [boundaryInside.pieces, boundaryInside.splitValue], [['  2020 - Dec 20', '21'], 1]);
    eq(`date placement (${kind}): "  2024-03-15" in one piece at month reads "  2024-03"`,
      datePlacementAfter(build, '  2024-03-15', 'month').pieces, ['  2024-03']);
  });
})();

(function datePlacement_twoWholeDatesInOneCell() {
  const CASES = [
    ['Jun 2020 - Dec 2021', 'year', '2020 - 2021'],
    ['Jun 2020 - Dec 2021', 'quarter', 'Q2 2020 - Q4 2021'],
    ['Jun 2020 - Dec 2021', 'decade', '2020 - 2020'],
    ['Jun 2020 - Dec 2021', 'month', 'Jun 2020 - Dec 2021'],
    ['2020-06-15 to 2021-12-31', 'month', '2020-06 to 2021-12'],
    ['2020-06-15 to 2021-12-31', 'quarter', '2020 Q2 to 2021 Q4'],
    ['from 7 Jul 1999 until 9 Sep 2001', 'century', 'from 1900 until 2000'],
  ];
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    for (const [cell, granularity, expected] of CASES) {
      eq(`date placement (${kind}): "${cell}" at ${granularity} reads "${expected}"`,
        datePlacementAfter(build, cell, granularity).pieces, [expected]);
    }
  });
})();

(function datePlacement_aDateFollowedByAFootnoteLink() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(rowsAroundCell('placeholder'));
    rwSetChildren(t.cell(0, 0), [rwText('Jun 2020 '), rwEl('sup', {}, [rwEl('a', { href: '#n1' }, [rwText('[1]')])])]);
    roundTableUnder(t.table, datePlacementOpts('year'));
    eq(`date placement (${kind}): "Jun 2020 " then a superscript link "[1]" at year reads "2020 ", "[1]"`,
      cellPieceTexts(t, 0, 0), ['2020 ', '[1]']);
  });
})();

(function datePlacement_aSplitDateThatTheGranularityLeavesAlone() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const after = datePlacementAfter(build, [{ tag: 'b', text: 'Mar ' }, { tag: 'b', text: '2096' }], 'month');
    eq(`date placement (${kind}): bold "Mar " and bold "2096" at month stays as written and counts one split value`,
      [after.pieces, after.splitValue], [['Mar ', '2096'], 1]);
  });
})();

(function datePlacement_aSplitTime() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const split = datePlacementAfter(build, [{ tag: 'b', text: '10:' }, { tag: 'b', text: '47' }], 'year');
    eq(`date placement (${kind}): bold "10:" and bold "47" at hour stays as written and counts one split value`,
      [split.pieces, split.splitValue], [['10:', '47'], 1]);
    const whole = datePlacementAfter(build, ['  ', { tag: 'b', text: '10:47' }], 'year');
    eq(`date placement (${kind}): "  " then bold "10:47" at hour reads "  ", "11:00" and counts no split value`,
      [whole.pieces, whole.splitValue], [['  ', '11:00'], 0]);
  });
})();

// A split all-numeric date beside whole ones in the same column. Read with the
// split date, the column holds a day above 12 in both positions.
(function datePlacement_aSplitAllNumericDateInAColumnOfWholeOnes() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      ['3/4/2024', '2,468'],
      ['3/14/2024', '3,579'],
      [['13/4/', { tag: 'b', text: '2024' }], '4,321'],
    ]);
    const result = roundTableUnder(t.table, datePlacementOpts('month'));
    eq(`date placement (${kind}): a column of "3/4/2024", "3/14/2024", and "13/4/" with bold "2024" at month reads "3/2024", "3/2024", "13/4/2024"`,
      [t.text(0, 0), t.text(1, 0), cellPieceTexts(t, 2, 0)], ['3/2024', '3/2024', ['13/4/', '2024']]);
    eq(`date placement (${kind}): the same column counts one split value`, result.leftAsWritten.splitValue, 1);
    const alone = build([
      ['3/4/2024', '2,468'],
      [['13/4/', { tag: 'b', text: '2024' }], '3,579'],
    ]);
    roundTableUnder(alone.table, datePlacementOpts('month'));
    eq(`date placement (${kind}): a column of "3/4/2024" and "13/4/" with bold "2024" at month stays as written`,
      [alone.text(0, 0), cellPieceTexts(alone, 1, 0)], ['3/4/2024', ['13/4/', '2024']]);
  });
})();

(function datePlacement_aSplitAllNumericDateBesideAWholeDateInTheSameCell() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const numeric = datePlacementAfter(build,
      [{ tag: 'b', text: '3/4/' }, { tag: 'b', text: '2024' }, ' to 5/6/2024'], 'year');
    eq(`date placement (${kind}): bold "3/4/" and bold "2024" then " to 5/6/2024" at year stays as written and counts one split value`,
      [numeric.pieces, numeric.splitValue], [['3/4/', '2024', ' to 5/6/2024'], 1]);
    const written = datePlacementAfter(build,
      [{ tag: 'b', text: '3/4/' }, { tag: 'b', text: '2024' }, ' to June 5, 2024'], 'year');
    eq(`date placement (${kind}): bold "3/4/" and bold "2024" then " to June 5, 2024" at year reads "3/4/", "2024", " to 2024" and counts one split value`,
      [written.pieces, written.splitValue], [['3/4/', '2024', ' to 2024'], 1]);
    const t = build([
      [[{ tag: 'b', text: '3/4/' }, { tag: 'b', text: '2024' }, ' to 5/6/2024'], '2,468'],
      ['3/14/2024', '3,579'],
    ]);
    roundTableUnder(t.table, datePlacementOpts('month'));
    eq(`date placement (${kind}): bold "3/4/" and bold "2024" then " to 5/6/2024" above "3/14/2024" at month reads "3/4/", "2024", " to 5/2024" and "3/2024"`,
      [cellPieceTexts(t, 0, 0), t.text(1, 0)], [['3/4/', '2024', ' to 5/2024'], '3/2024']);
  });
})();
