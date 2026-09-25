// Rounding a whole table: roundTable, restore, the re-apply observer, and the lens preview (content.js).

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
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
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
  //
  // The data sits at row >= 1 / column >= 1 behind a TH header row and a TH
  // label column: DR_DEFAULTS.simplifyFirstRow/simplifyFirstColumn are both
  // false, and since sprint merge-ladder the preview now honours that
  // exclusion (see the merge-ladder divergence tests below) the way the
  // engine always did — a row-0/column-0 <td> would be dropped, same as it
  // would be when actually rounding the table.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row1'), tdCell('27,000,000'), tdCell('18,000,000')] }, // both mag 7
      { cells: [thCell('Row2'), tdCell('4,080'),  tdCell('312')] },            // mag 3, 2
      { cells: [thCell('Row3'), tdCell('56')] },                              // mag 1
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

(function previewBand_extractPreviewSamples_onePerOrderOfMagnitude() {
  // The bottom band shows one example per distinct lower order of magnitude,
  // with no cap. Negatives bucket by absolute value. For 1234 / 123 / -12 the
  // preview is three lines: top-band 1k+ (1234) plus bottom-band 100+ (123)
  // and 10+ (|-12|).
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('1234'), tdCell('123'), tdCell('-12')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('onePerOom: maxMag is 3 (1234)', result.maxMag, 3);
  eq('onePerOom: top band is the 1k+ value (1234)', result.samples.top[0].num, 1234);
  eq('onePerOom: bottom band has one row per lower magnitude (2)',
    result.samples.bottom.length, 2);
  eq('onePerOom: bottom[0] is the 100+ value (123)', result.samples.bottom[0].num, 123);
  eq('onePerOom: bottom[1] is the 10+ value, abs of -12', result.samples.bottom[1].num, -12);

  // No cap: five distinct lower magnitudes yield five bottom rows (old code
  // capped the band at 3).
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
  eq('onePerOom: uncapped bottom band has 5 rows (one per lower OoM)',
    deepResult.samples.bottom.length, 5);
  eq('onePerOom: bottom rows are descending by magnitude',
    deepResult.samples.bottom.map(r => r.num), [500000, 40000, 3000, 200, 10]);
})();

(function previewBand_extractPreviewSamples_prefersDemonstrative() {
  // Within a magnitude bucket, an already-round value (250,000,000) would make
  // a useless "X -> X" preview row. extractPreviewSamples should surface a cell
  // that visibly changes under the default offset instead, even when the
  // already-round cell appears first in document order.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      // Top bucket (mag 8): round value first, then a value that changes.
      { cells: [thCell('Top'), tdCell('250,000,000'), tdCell('269,690,569')] },
      // Bottom bucket (mag 5): round value first, then a value that changes.
      { cells: [thCell('Bottom'), tdCell('350,000'), tdCell('235,132')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (demo): top[0] skips already-round 250M',
    result.samples.top[0].num, 269690569);
  eq('extractPreviewSamples (demo): bottom[0] skips already-round 350k',
    result.samples.bottom[0].num, 235132);
})();

(function previewBand_extractPreviewSamples_allRoundFallback() {
  // If every cell in a bucket is already round, fall back to document order
  // rather than dropping the row.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('250,000,000'), tdCell('500,000')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (all-round): top[0] is first cell',
    result.samples.top[0].num, 250000000);
})();

(function previewBand_extractPreviewSamples_largeMagOnly() {
  // All cells in the top magnitude bucket -> bottom band ends up empty.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('18,000,000'), tdCell('45,000,000')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (all-top): top has 2 rows', result.samples.top.length, 2);
  eq('extractPreviewSamples (all-top): bottom is empty', result.samples.bottom.length, 0);
})();

(function previewBand_extractPreviewSamples_emptyTable() {
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  const table = {
    rows: [{ cells: [tdCell('hello'), tdCell('world')] }],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (empty): maxMag null', result.maxMag, null);
  eq('extractPreviewSamples (empty): top length 0', result.samples.top.length, 0);
  eq('extractPreviewSamples (empty): bottom length 0', result.samples.bottom.length, 0);
})();

// ---------------------------------------------------------------------------
// Regression: collectNumericCells must classify a rounded cell's stored
// original text (dataset.originalValue) using ranges/filters measured against
// THAT text, not against the live (already-rounded, differently-offset) cell.
// Reviewer repro: reviewer-sup-stale.js.
// ---------------------------------------------------------------------------

(function previewBand_supStaleRegression() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedCells: true,
      simplifyMixedCurrency: true, simplifyMixedPercent: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
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
    eq('sup-stale regression: cell was actually rounded (registry original.value set)',
      DR_STORE.getTableOriginal(table, cell).value, '1234.5678 kg9');

    const after = collectNumericCells(table, opts);
    eq('sup-stale regression: preview sample set is unchanged after rounding',
      after.map((c) => c.num), before.map((c) => c.num));
  });
})();

(function previewBand_linkedNumberPostRoundRegression() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedCells: true,
      simplifyMixedCurrency: true, simplifyMixedPercent: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
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
    eq('linked-number-post-round regression: cell was actually rounded (registry original.value set)',
      DR_STORE.getTableOriginal(table, cell).value, 'Total 1234.5678 see also 51234.5678');

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
    const table = { rows: [{ cells: [oneCell] }, { cells: [splitCell] }], querySelector: () => null, dataset: {} };
    try {
      roundTable(table, Object.assign(nativeOnePieceOpts(), { simplifyDates: true, dateGranularity: 'year' }));
      eq('native date cell: a date in one piece rounds, and the piece keeps its whitespace',
        oneSegments[0].text, ' 2025 ');
      eq('native date cell: a date across pieces keeps its text',
        splitSegments.map((seg) => seg.text).join('|'), '2024-|09-15');
      eq('native date cell: a date across pieces gets no marker',
        splitCell.classList.contains('dr-ext-rounded'), false);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function nativePureCell_hiddenSortKeyRoundsTheVisibleValue() {
  withReactiveCreateTreeWalker(function () {
    const keyed = [{ text: '000000007002300', inSup: false }, { text: '7,002,300', inSup: false }];
    const repeated = [{ text: '0000004523789', inSup: false }, { text: '4523789', inSup: false }];
    const keyedCell = makeSortKeyCell(keyed, () => keyed[1].text);
    const repeatedCell = makeSortKeyCell(repeated, () => repeated[1].text);
    const table = { rows: [{ cells: [keyedCell] }, { cells: [repeatedCell] }], querySelector: () => null, dataset: {} };
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
      DR_STORE.unregisterTable(table);
    }
  });
})();

// Issues #452 and #461: a native table runs the stacked-cell test, as a grid
// does. A native cell classifies its rendered text, which shows whether two
// pieces sit on separate lines or run together, so a digit beside a digit
// across two pieces reads as two numbers only when the rendered text shows
// a space or a line break between them. Dataset 337.91, 125, 126, so the
// max magnitude is 2.
//   a: a currency sign in its own piece, then the number
//   b: one number per line, with mixed-cell simplification off
//   c: one number that inline styling splits into two pieces ("6,7" plain,
//      "18,245" bold): the rendered text runs them together, so it stays
//   d: a number split after its grouping comma: stays
(function nativeStacked_roundsEachNumberInItsPiece() {
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
    const table = { rows: cells.map((cell) => ({ cells: [cell] })), querySelector: () => null, dataset: {} };
    const rows = [];
    const offRow = DR_LOG.onRow((row) => rows.push(row));
    const opts = Object.assign(nativeOnePieceOpts(), { simplifyMixedCells: false });
    try {
      eq('native stacked: the lens preview pool holds the numbers the pass rounds',
        collectNumericCells(table, opts).map((cell) => cell.num), [337.91, 125, 126]);
      roundTable(table, opts);
      eq('native stacked: a currency sign in its own piece stays and the number rounds',
        a.map((seg) => seg.text), ['$', '350']);
      eq('native stacked: one number per line rounds number by number with mixed-cell simplification off',
        b.map((seg) => seg.text), ['150', '150']);
      eq('native stacked: a number that inline styling splits into two pieces stays unchanged',
        c.map((seg) => seg.text), ['6,7', '18,245']);
      eq('native stacked: a number split after its grouping comma stays unchanged',
        d.map((seg) => seg.text), ['3,406,', '918']);
      eq('native stacked: each split number leaves a debug row',
        rows.filter((row) => row.level === 'debug' && /native cell value split across text pieces/.test(row.text)).length,
        2);
    } finally {
      offRow();
      DR_STORE.unregisterTable(table);
    }
  });
})();

// A hidden sort key beside a currency sign in its own tag: the rendered text
// ("$7,002,300") differs from the flat text in more than whitespace, and no
// one piece holds it, so no rendered position maps to a piece. A stacked
// number could sit in the hidden text, so the cell stays unchanged and its
// numbers stay out of the lens preview pool.
(function nativeStacked_hiddenSortKeyStaysUnchanged() {
  withReactiveCreateTreeWalker(function () {
    const segs = [{ text: '7002300', inSup: false }, { text: '$', inSup: false }, { text: '7,002,300', inSup: false }];
    const cell = makeSortKeyCell(segs, () => '$7,002,300');
    const table = { rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} };
    try {
      eq('native stacked: a hidden sort key beside a stacked cell keeps its numbers out of the pool',
        collectNumericCells(table, nativeOnePieceOpts()), []);
      roundTable(table, nativeOnePieceOpts());
      eq('native stacked: a hidden sort key beside a stacked cell leaves every piece unchanged',
        segs.map((seg) => seg.text), ['7002300', '$', '7,002,300']);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function nativeWrite_olderWriterIsGone() {
  eq('native write: no loaded source defines or calls the older whole-cell writer',
    /replaceTextPreservingHTML/.test(allContentSrc), false);
  const body = sourceBodyOf(allContentSrc, 'function roundTable(');
  eq('native write: roundTable holds no innerHTML= assignment',
    body.length > 0 && !/innerHTML\s*=(?!=)/.test(body), true);
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
// content.js markAndToggleIfNewGrid — the badge/marker call-site wrapper that
// replaced findTargetTable's old internal mutation. It owns exactly what
// findTargetTable used to do inline: write the dr-ext-grid marker and build
// the toggle widget, but only for a first-time (isNew) discovery.
// ---------------------------------------------------------------------------
(function markAndToggleIfNewGrid_newGridGetsMarkedAndWidget() {
  withFindTargetEnv([], function() {
    const savedToggleStyleInjected = toggleStyleInjected;
    const table = makePass1DataTable();
    table.parentElement = { tagName: 'DIV', getAttribute: () => null, style: {}, parentElement: null, parentNode: null };

    const handleReturned = markAndToggleIfNewGrid({ handle: table, isNew: true });

    eq('markAndToggleIfNewGrid: returns found.handle',
      handleReturned, table);
    eq('markAndToggleIfNewGrid: adds dr-ext-grid to a newly discovered grid',
      table.classList.contains('dr-ext-grid'), true);
    eq('markAndToggleIfNewGrid: builds the toggle widget for a newly discovered grid',
      tableToggles.has(table), true);

    cleanupPass1Tables([table]);
    toggleStyleInjected = savedToggleStyleInjected;
  });
})();

(function markAndToggleIfNewGrid_alreadySeenHandleSkipsMarkAndWidget() {
  withFindTargetEnv([], function() {
    const table = makePass1DataTable();

    markAndToggleIfNewGrid({ handle: table, isNew: false });

    eq('markAndToggleIfNewGrid: does not mark an already-seen handle',
      table.classList.contains('dr-ext-grid'), false);
    eq('markAndToggleIfNewGrid: does not build a widget for an already-seen handle',
      tableToggles.has(table), false);
  });
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

// ---------------------------------------------------------------------------
// A synthetic database-query-shaped vendor grid.
//
// The shape rebuilds docs/test-pages/tables.html §13 with invented values, per
// the repository's regression-fixture convention: a role="table" wrapper
// holding a pinned pane of leading columns beside a scrolling pane of data,
// all under dg-- classes, with rows paired across the panes by data-row. The
// nomination step, the two adapters, and the pillbox builder all read these
// nodes, so each one answers the selector queries, the role read, the class
// list, the parent link, and the text reads those three make.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Grid patch writes (#120). A grid cell's change lands as a patch to the one
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

// A later simplification with an invalid range expression stores its options
// and returns an error without resetting the grid, so the re-apply observer
// from the first simplification still fires. The re-apply reads the stored
// invalid expression and writes nothing, as the first simplification would.
(function gridReapply_underAnInvalidRangeExpression_writesNothing() {
  const { grid, aNumber } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const result = roundTable(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { rangeExpr: 'A:B:C' }));
    eq('grid re-apply invalid range (setup): the second simplification returns the range error',
      result.rangeStatus, 'error');
    aNumber.nodeValue = '8,584,629';
    const writesBefore = aNumber.writes;
    reapplyRounding(grid.wrapperEl);
    eq('grid re-apply invalid range: a piece redrawn to its original is not patched',
      { pieces: pieceTextsOf(a), writes: aNumber.writes },
      { pieces: [' ', '8,584,629', ' '], writes: writesBefore });
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A grid whose first simplification found no dataset holds no magnitude
// freeze (null). The re-apply then computes the max magnitude from the
// visible cells, and only a first simplification stores a freeze, so the
// freeze stays unset for the next re-apply.
(function gridReapply_withNoMagnitudeFreeze_computesTheBasisAndLeavesTheFreezeUnset() {
  const { grid, aNumber } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid re-apply no freeze (setup): the first simplification stores a freeze',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 6);
    DR_STORE.setTableMaxMagnitude(grid.wrapperEl, null);
    aNumber.nodeValue = '8,584,629';
    reapplyRounding(grid.wrapperEl);
    eq('grid re-apply no freeze: a piece redrawn to its original rounds against the visible cells',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);
    eq('grid re-apply no freeze: the re-apply stores no freeze',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), null);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// ---------------------------------------------------------------------------
// Stacked cells and unit numbers on grids (#120). A grid cell's text is its
// flat text. A stacked cell holds whole numbers in separate text pieces, and
// each rounds in its own piece. A unit number's digits change and its suffix
// or currency code stays. Extracted cells stay unchanged on grids.
//
// A synthetic key-statistics grid with invented values. The dataset is
// 338.49, 4.91, 125, 126, 337.91, and 41.31, so the max magnitude is 2:
//   magnitude 2, top band, step 50:    338.49 → 350, 125 → 150, 126 → 150, 337.91 → 350
//   magnitude 1, other band, step 5:   41.31 → 40
//   magnitude 0, other band, step 0.5: 4.91 → 5
// The split number (4.91 across two pieces), the link, and the extracted
// cell stay out of the dataset. Counted as one number, the stacked
// cell's 125126 would raise the max magnitude to 5.
// ---------------------------------------------------------------------------

const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells: true, simplifyDates: true });

// "Revenue 500 units" and "DT1234" now round like any extracted cell (issue
// #120), but both show unchanged pieces here for reasons that have nothing
// to do with the flag removal: 500 already sits on the step this dataset's
// magnitude rounds to, so it formats back to itself, and "DT1234"'s digits
// sit glued to a letter with no separator, so the number extractor never
// finds them at all — on a grid or a native table alike.
(function gridStacked_roundWritesEachNumberInItsPiece() {
  const grid = makeKeyStatsGrid();
  const piecesBefore = grid.cellEls.map(gridCellTextPieces);
  try {
    roundTable(grid.wrapperEl, KEY_STATS_OPTS);
    eq('grid stacked: each cell\'s pieces after the round',
      grid.cellEls.map(pieceTextsOf), [
        ['$350'], ['5tn'],
        [' 150 ', ' 150'], ['$', '350'],
        ['40m'], ['4.', '91', 'tn'],
        ['Revenue 500 units'], ['DT1234'],
        ['7.5m'], ['2024-', '03-15'],
      ]);
    eq('grid stacked: every text piece is the same node object after the round',
      grid.cellEls.every((cell, k) => {
        const after = gridCellTextPieces(cell);
        return after.length === piecesBefore[k].length &&
          after.every((node, n) => node === piecesBefore[k][n]);
      }), true);
    eq('grid stacked: the max magnitude counts the stacked numbers one by one',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);
    eq('grid stacked: a number split across pieces leaves a debug row',
      DR_LOG.snapshot().entries.some(
        (row) => row.level === 'debug' && /split across text pieces/.test(row.text) && /number/.test(row.text)),
      true);
    eq('grid stacked: a date split across pieces leaves a debug row',
      DR_LOG.snapshot().entries.some(
        (row) => row.level === 'debug' && /split across text pieces/.test(row.text) && /date or time/.test(row.text)),
      true);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridStacked_recordAndReset() {
  const grid = makeKeyStatsGrid();
  const [, , stacked, dollar] = grid.cellEls;
  const originalPieces = grid.cellEls.map(pieceTextsOf);
  try {
    roundTable(grid.wrapperEl, KEY_STATS_OPTS);
    eq('grid stacked: the record holds the flat original and each piece\'s original and written text',
      DR_STORE.getTableOriginal(grid.wrapperEl, stacked),
      { value: ' 125  126', pieces: [{ text: ' 125 ', written: ' 150 ' }, { text: ' 126', written: ' 150' }],
        supRanges: null, linkFilteredIdx: [1, 6] });
    eq('grid stacked: an untouched "$" piece holds the same original and written text',
      DR_STORE.getTableOriginal(grid.wrapperEl, dollar).pieces,
      [{ text: '$', written: '$' }, { text: '337.91', written: '350' }]);
    eq('grid stacked: reset restores every cell', resetTable(grid.wrapperEl), 0);
    eq('grid stacked: reset puts every piece back', grid.cellEls.map(pieceTextsOf), originalPieces);
    eq('grid stacked: reset clears every record',
      grid.cellEls.some((cell) => DR_STORE.hasTableOriginal(grid.wrapperEl, cell)), false);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A stacked cell whose first piece gets shorter: a later piece's position
// moves, so the re-apply measures each patch against the live pieces.
(function gridStacked_reapplyAfterAPieceShortened() {
  const grid = makeE2EGridWrapper([['337.91 126']]);
  const [cell] = grid.cellEls;
  const first = makeCountingTextNode('337.91');
  const second = makeCountingTextNode('126');
  setGridCellPieces(cell, [makeElementNode('a1', [first]), makeElementNode('a2', [second])]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid stacked re-apply (setup): both pieces round', pieceTextsOf(cell), ['350', '150']);
    reapplyRounding(grid.wrapperEl);
    eq('grid stacked re-apply: pieces already patched are not written again',
      [first.writes, second.writes], [1, 1]);
    second.nodeValue = '126';
    reapplyRounding(grid.wrapperEl);
    eq('grid stacked re-apply: a later piece redrawn to its original is patched again',
      pieceTextsOf(cell), ['350', '150']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// Stacked-cell edges. Dataset 125, 126, 4.91, so the max magnitude is 2:
// 125 → 150, 126 → 150, 4.91 → 5.
//   a: one number per element with no whitespace between (a digit next to a
//      digit across pieces reads as two numbers)
//   b: a suffix in its own piece
//   c: two numbers in one piece beside a third piece: not stacked
//   d: two unit numbers glued together with no separator, one per piece:
//      only 4.91 rounds. The cell's flat text is one joined string with no
//      piece boundary marker, and the number extractor never starts a match
//      right after a letter, so "41.31" (glued right after "tn") is never
//      found at all; the decision that does survive already fits in one
//      piece, so the piece-aware stacked-cell fallback that would have
//      caught both numbers never runs. A native table hits this identical
//      gap for the same glued shape, for the same reason.
//   e: a number split before its decimal point: unchanged
(function gridStacked_edges() {
  const grid = makeE2EGridWrapper([['125126', '4.91tn', '416 5551234', '4.91tn41.31m', '4.91']]);
  const [a, b, c, d, e] = grid.cellEls;
  setGridCellPieces(e, [makeTextNode('4'), makeElementNode('dec', [makeTextNode('.91')])]);
  setGridCellPieces(a, [makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])]);
  setGridCellPieces(b, [makeTextNode('4.91'), makeElementNode('u', [makeTextNode('tn')])]);
  setGridCellPieces(c, [makeTextNode('416 555'), makeElementNode('x', [makeTextNode('1234')])]);
  setGridCellPieces(d, [makeElementNode('l1', [makeTextNode('4.91tn')]), makeElementNode('l2', [makeTextNode('41.31m')])]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid stacked: one number per element with no whitespace between rounds number by number',
      pieceTextsOf(a), ['150', '150']);
    eq('grid stacked: a suffix in its own piece stays and the digits round', pieceTextsOf(b), ['5', 'tn']);
    eq('grid stacked: two numbers in one piece make the cell not stacked',
      pieceTextsOf(c), ['416 555', '1234']);
    eq('grid stacked: two unit numbers glued with no separator round only the first',
      pieceTextsOf(d), ['5tn', '41.31m']);
    eq('grid stacked: a number split before its decimal point stays unchanged',
      pieceTextsOf(e), ['4', '.91']);
    eq('grid stacked: the max magnitude leaves out the cell that is not stacked',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// The cells of the native stacked test above, on a grid, with mixed-cell
// simplification off (test page section 25). A grid cell's flat text holds
// nothing between pieces, so a digit beside a digit across pieces reads as
// two numbers, and one number that inline styling splits ("6,7" plain,
// "18,245" in bold) rounds as two numbers where a native table leaves it.
(function gridStacked_sameCellsAsTheNativeTable() {
  const grid = makeE2EGridWrapper([['$337.91', '125126', '6,718,245']]);
  const [a, b, c] = grid.cellEls;
  setGridCellPieces(a, [makeElementNode('s', [makeTextNode('$')]), makeElementNode('n', [makeTextNode('337.91')])]);
  setGridCellPieces(b, [makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])]);
  setGridCellPieces(c, [makeTextNode('6,7'), makeElementNode('b', [makeTextNode('18,245')])]);
  try {
    roundTable(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells: false }));
    eq('grid stacked: a currency sign in its own piece stays and the number rounds, as on a native table',
      pieceTextsOf(a), ['$', '350']);
    eq('grid stacked: one number per line rounds with mixed-cell simplification off, as on a native table',
      pieceTextsOf(b), ['150', '150']);
    eq('grid stacked: one number that inline styling splits rounds as two numbers',
      pieceTextsOf(c), ['65', '20,000']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A stacked cell's joined text ("1500 1600") looks like digit groups split by
// whitespace, but its digits sit in several text pieces, so the spaced-digit
// identifier shape does not apply and each number rounds. A one-piece cell
// with the same kind of text stays as written. Dataset 1500, 1600, 45, 46,
// so the max magnitude is 3: 1500 → 1500, 1600 → 1500, 45 → 45, 46 → 45.
(function gridStacked_digitsInSeveralPiecesAreNotOneIdentifier() {
  const grid = makeE2EGridWrapper([['1500 1600', '45 46', '4165 5512']]);
  const [a, b, c] = grid.cellEls;
  setGridCellPieces(a, [makeTextNode(' 1500 '), makeElementNode('br', []), makeTextNode(' 1600')]);
  setGridCellPieces(b, [makeElementNode('l1', [makeTextNode('45')]), makeTextNode(' '),
    makeElementNode('l2', [makeTextNode('46')])]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid stacked: numbers in several pieces round though their join looks like spaced digit groups',
      pieceTextsOf(a), [' 1500 ', ' 1500']);
    eq('grid stacked: two-digit numbers in several pieces round number by number',
      pieceTextsOf(b), ['45', ' ', '45']);
    eq('grid stacked: spaced digit groups in one piece stay as written',
      pieceTextsOf(c), ['4165 5512']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// The link filter holds on a stacked cell: a number inside a link stays, and
// once the cell is rounded the record's kept positions drive the preview.
(function gridStacked_linkFilter() {
  const grid = makeE2EGridWrapper([['125126']]);
  const [cell] = grid.cellEls;
  const plain = makeElementNode('p', [makeTextNode('125')]);
  const anchor = makeElementNode('a', [makeTextNode('126')]);
  anchor.tagName = 'A';
  anchor.innerText = '126';
  setGridCellPieces(cell, [plain, anchor]);
  cell.innerText = '125126';
  cell.querySelectorAll = (sel) => (sel === 'a' ? [anchor] : []);
  cell.contains = (node) => node === anchor || node === plain;
  for (const holder of [plain, anchor]) {
    holder.childNodes[0].parentElement = holder;
    holder.closest = (sel) => (sel === 'a' && holder === anchor ? anchor : null);
  }
  const saved = global.document.createTreeWalker;
  global.document.createTreeWalker = (root) => {
    const nodes = gridCellTextPieces(root);
    return { nextNode() { return nodes.shift() || null; } };
  };
  const pool = () => collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((sample) => sample.num);
  try {
    eq('grid stacked link (setup): the preview leaves out the linked number', pool(), [125]);
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid stacked link: the number inside the link stays', pieceTextsOf(cell), ['150', '126']);
    eq('grid stacked link: the record keeps the position of the number the filter kept',
      DR_STORE.getTableOriginal(grid.wrapperEl, cell).linkFilteredIdx, [0]);
    eq('grid stacked link: the preview after the round reads the kept positions', pool(), [125]);
  } finally {
    if (saved === undefined) delete global.document.createTreeWalker;
    else global.document.createTreeWalker = saved;
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// Cells the stacked check leaves unchanged, and the ones it admits. Dataset
// 4.91, 125, and 126, so the max magnitude is 2.
//   a: a number beside a <sup> footnote, glued together with no separator:
//      the base number rounds and the footnote digits stay, exactly as a
//      native table already rounds this shape (issue #120) — the digit run
//      right after the <sup> is never even a candidate match, since the
//      number extractor never starts a match right after a letter
//   b: a stacked year above a year: each piece reads as a date
//   c: "1," then "234": a number split after its grouping comma
//   d: a listed currency code in its own piece above two numbers
(function gridStacked_cellsTheStackedCheckLeaves() {
  const grid = makeE2EGridWrapper([['4.91T12', '20242025', '1,234', 'CAD125126']]);
  const [a, b, c, d] = grid.cellEls;
  const sup = makeElementNode('sup', [makeTextNode('12')]);
  setGridCellPieces(a, [makeTextNode('4.91T'), sup]);
  a.querySelector = (sel) => (sel === 'sup' ? sup : null);
  setGridCellPieces(b, [makeElementNode('l1', [makeTextNode('2024')]), makeElementNode('l2', [makeTextNode('2025')])]);
  setGridCellPieces(c, [makeTextNode('1,'), makeElementNode('g', [makeTextNode('234')])]);
  setGridCellPieces(d, [makeElementNode('c', [makeTextNode('CAD')]),
    makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])]);
  const opts = Object.assign({}, PATCH_GRID_OPTS, { simplifyDates: true });
  try {
    eq('grid stacked: the lens preview pool keeps the footnote\'s base number, leaves out the years and the split number',
      collectNumericCells(grid.wrapperEl, opts).map((sample) => sample.num).sort((x, y) => x - y), [4.91, 125, 126]);
    roundTable(grid.wrapperEl, opts);
    eq('grid stacked: a cell with a <sup> rounds its base and keeps the exponent', pieceTextsOf(a), ['5T', '12']);
    eq('grid stacked: stacked years stay unchanged', pieceTextsOf(b), ['2024', '2025']);
    eq('grid stacked: a number split after its grouping comma stays unchanged', pieceTextsOf(c), ['1,', '234']);
    eq('grid stacked: a currency code in its own piece stays and the numbers round',
      pieceTextsOf(d), ['CAD', '150', '150']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A grid cell whose <sup> is a real footnote, separated from its base
// number by whitespace rather than glued to it: the base rounds, the
// footnote digit stays, and the mask's ranges land in the record's
// supRanges — the same field a native table's footnote cell stores (see
// prettyPrintedFootnoteStaysMasked) — so a later re-apply and the lens
// preview both read the cell's kept footnote position instead of
// re-measuring the (now rounded, therefore shifted) live text.
(function gridFootnote_supRangesSurviveRecordReapplyAndPreview() {
  const grid = makeE2EGridWrapper([['Revenue 837 units 7']]);
  const [cell] = grid.cellEls;
  const sup = makeElementNode('sup', [makeTextNode('7')]);
  sup.tagName = 'SUP';
  sup.childNodes[0].parentElement = sup;
  const plain = makeTextNode('Revenue 837 units ');
  setGridCellPieces(cell, [plain, sup]);
  cell.querySelector = (sel) => (sel === 'sup' ? sup : null);
  const saved = global.document.createTreeWalker;
  global.document.createTreeWalker = (root) => {
    const nodes = gridCellTextPieces(root);
    return { nextNode() { return nodes.shift() || null; } };
  };
  const pool = () => collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((sample) => sample.num);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid footnote: the base rounds and the footnote digit stays',
      pieceTextsOf(cell), ['Revenue 850 units ', '7']);
    eq('grid footnote: the record stores the mask\'s superscript range',
      DR_STORE.getTableOriginal(grid.wrapperEl, cell).supRanges, [{ start: 18, end: 19 }]);
    reapplyRounding(grid.wrapperEl);
    eq('grid footnote: the record\'s supRanges survive a re-apply',
      DR_STORE.getTableOriginal(grid.wrapperEl, cell).supRanges, [{ start: 18, end: 19 }]);
    eq('grid footnote: the preview after the round reads the base number, not the footnote digit', pool(), [837]);
  } finally {
    if (saved === undefined) delete global.document.createTreeWalker;
    else global.document.createTreeWalker = saved;
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A rounded grid footnote cell whose base piece shrinks: the live piece the
// footnote sits beside is now shorter than it was when the cell first
// classified, so a re-apply that re-measured the superscript mask against
// the LIVE pieces (instead of the record's kept supRanges, the same reuse
// collectNumericCells already applies to its own live re-measure) would
// mask the wrong position in the frozen pre-round text and let the
// footnote round as an ordinary number.
(function gridFootnote_supRangesSurviveAReapplyAfterTheBaseShrinks() {
  const grid = makeE2EGridWrapper([['Revenue 4.91tn units 137']]);
  const [cell] = grid.cellEls;
  const sup = makeElementNode('sup', [makeTextNode('137')]);
  sup.tagName = 'SUP';
  sup.childNodes[0].parentElement = sup;
  const plain = makeTextNode('Revenue 4.91tn units ');
  setGridCellPieces(cell, [plain, sup]);
  cell.querySelector = (sel) => (sel === 'sup' ? sup : null);
  const saved = global.document.createTreeWalker;
  global.document.createTreeWalker = (root) => {
    const nodes = gridCellTextPieces(root);
    return { nextNode() { return nodes.shift() || null; } };
  };
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const afterFirstRound = pieceTextsOf(cell);
    eq('grid footnote re-apply (setup): the base rounds and the footnote holds',
      afterFirstRound[1], '137');
    reapplyRounding(grid.wrapperEl);
    eq('grid footnote re-apply: the footnote stays masked after the base has already shrunk',
      pieceTextsOf(cell), afterFirstRound);
  } finally {
    if (saved === undefined) delete global.document.createTreeWalker;
    else global.document.createTreeWalker = saved;
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A rounded stacked cell that the page redraws with fewer pieces is a
// rewritten cell (#423). Its one remaining piece shows the extension's
// written text for the first stored piece, so it matches that piece by text
// and takes its original back before the record drops: the re-apply then
// simplifies the cell from 125, the lens preview reads 125, and reset puts
// 125 back and counts nothing unrestorable.
(function gridStacked_aRoundedCellThatLostAPiece() {
  const grid = makeE2EGridWrapper([['125126']]);
  const [cell] = grid.cellEls;
  setGridCellPieces(cell, [makeElementNode('l1', [makeTextNode('125')]), makeElementNode('l2', [makeTextNode('126')])]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid stacked (setup): the first simplification writes 150 into the first piece',
      pieceTextsOf(cell)[0], '150');
    setGridCellPieces(cell, [makeElementNode('l1', [makeTextNode('150')])]);
    let threw = null;
    try { reapplyRounding(grid.wrapperEl); } catch (e) { threw = String(e); }
    eq('grid stacked: the re-apply simplifies a cell that lost a piece from the original its written text matches',
      { threw, pieces: pieceTextsOf(cell), original: DR_STORE.getTableOriginalText(grid.wrapperEl, cell) },
      { threw: null, pieces: ['150'], original: '125' });
    eq('grid stacked: the lens preview reads the matched original in a cell that lost a piece',
      collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((c) => c.num), [125]);
    eq('grid stacked: reset counts nothing unrestorable after a cell lost a piece', resetTable(grid.wrapperEl), 0);
    eq('grid stacked: reset puts the matched original back', pieceTextsOf(cell), ['125']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A unit number that is the largest number on the grid sets the frozen max
// magnitude: 5,432.1 has magnitude 3.
(function gridStacked_aUnitNumberJoinsTheDataset() {
  const grid = makeE2EGridWrapper([['4.91', '5,432.1m']]);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid stacked: a unit number joins the dataset', DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 3);
    eq('grid stacked: the unit number keeps its suffix', pieceTextsOf(grid.cellEls[1]), ['5,500m']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridStacked_currencyOffExcludesASymbolInItsOwnPiece() {
  const grid = makeKeyStatsGrid();
  const [, unit, , dollar] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, Object.assign({}, KEY_STATS_OPTS, { simplifyMixedCurrency: false }));
    eq('grid stacked: with the currency setting off, a "$" in its own piece excludes the cell',
      pieceTextsOf(dollar), ['$', '337.91']);
    eq('grid stacked: with the currency setting off, a suffixed number still rounds',
      pieceTextsOf(unit), ['5tn']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// The lens preview lists exactly the numbers the grid rounds: the stacked
// numbers one by one, the unit numbers, the number inside "Revenue 500
// units", and nothing from "DT1234" (its digits sit glued to a letter, so
// the extractor never finds them, on a grid or a native table alike) or the
// split number or the link. It lists the same numbers once the grid is
// rounded, read from the records.
(function gridStacked_lensPreviewMatchesThePage() {
  const grid = makeKeyStatsGrid();
  const nums = () => collectNumericCells(grid.wrapperEl, KEY_STATS_OPTS)
    .map((sample) => sample.num).sort((x, y) => x - y);
  const expected = [4.91, 41.31, 125, 126, 337.91, 338.49, 500];
  try {
    eq('grid stacked: the lens preview pool before the round', nums(), expected);
    roundTable(grid.wrapperEl, KEY_STATS_OPTS);
    eq('grid stacked: the lens preview pool after the round', nums(), expected);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
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

  const adapter = makeAdapter(grid.wrapperEl, { originalsPort: registryOriginalsPort(grid.wrapperEl) });
  const rows = adapter.getRows();

  // Round all cells
  rows.forEach(function(row) {
    row.getCells().forEach(function(c) {
      c.applyPatches([{ index: 0, numStr: c.getText(), newNum: 'ROUNDED' }]);
    });
  });

  // All cells should carry dr-ext-rounded and a registry original
  eq('GR4 (setup): cell 0 is rounded',
    grid.cellEls[0].classList.contains('dr-ext-rounded'), true);
  eq('GR4 (setup): cell 0 registry original is stored original value',
    DR_STORE.getTableOriginalText(grid.wrapperEl, grid.cellEls[0]), '8584629');

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

  eq('GR4: cell 0 registry original cleared after reset',
    DR_STORE.getTableOriginal(grid.wrapperEl, grid.cellEls[0]), undefined);

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
  //
  // A leading header row and label column keep the numeric data off row 0 /
  // column 0: DR_DEFAULTS.simplifyFirstRow/simplifyFirstColumn are both
  // false, and grid cells are always tagName 'TD' (GridAdapter has no <th>
  // concept), so unlike a native table there is no tag-based escape from the
  // exclusion — position is all that matters.
  const grid = makeGridWrapper([
    ['label', 'x', 'y'],
    ['R1', '8584629', '286'],
    ['R2', '9123456', '514'],
    ['R3', '7654321', '432'],
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

// GR6a: the grid read is the cell's flat text: every text piece, joined in
// page order, however deep the pieces sit.
(function gr6a_gridRead_isTheFlatText() {
  const readOf = (cell) => new GridAdapter({})._makeCellObj(cell).getText();
  eq('GR6a: a piece inside nested elements is read',
    readOf(makeElementNode('cell', [makeElementNode('inner', [makeTextNode('42')])])), '42');
  eq('GR6a: a cell with no text piece reads as empty',
    readOf(makeElementNode('cell', [makeElementNode('inner', [])])), '');
  eq('GR6a: a whitespace piece is part of the read',
    readOf(makeElementNode('cell', [makeTextNode('   ')])), '   ');
  eq('GR6a: every piece joins in page order',
    readOf(makeElementNode('cell', [makeTextNode('first'), makeElementNode('b', [makeTextNode('42')])])), 'first42');
})();

// =============================================================================
// E2E grid rounding tests — drive roundTable/resetTable on real div-grid stubs.
// Spec: docs/sprint-plans/grid-support-v2.md §2 D3 + §4 "grid-rounding".
// Regression guard for commit 3404e86: roundTable must write via nodeValue
// (GridAdapter's applyPatches → the registry record), NOT via
// an innerHTML write (which crashes React's reconciler).
// =============================================================================

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

  // The registry original must be recorded for the cell (the patch path).
  eq('E2E-GR1: cell[0] registry original is set to original text',
    DR_STORE.getTableOriginalText(grid.wrapperEl, cell0), originalValue);

  // originalHtml must NOT be set (that is the native-table / extracted path,
  // which records a { html, value, ... } record; a grid record holds its pieces).
  eq('E2E-GR1: cell[0] dataset.originalHtml is NOT set on a grid cell',
    cell0.dataset.originalHtml, undefined);
})();

// ---------------------------------------------------------------------------
// Grid form honesty (#315): the per-cell write reports whether it landed,
// and the table's form counts confirmed writes — the same rule as the
// extracted-cell fix (#301). A grid cell can classify as roundable through
// the whole-text fallback yet hold no text piece for the nodeValue write to
// patch; such a write skips, and a skipped write must not flip the form.
// ---------------------------------------------------------------------------

(function gridApplyPatchesReturnsLanded() {
  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const port = makePort();
  const adapter = new GridAdapter({}, { originalsPort: port });

  const withNode = adapter._makeCellObj(makeGridCellWithTextNode('8584629'));
  eq('grid-honesty: applyPatches returns a landed count when the write lands',
    withNode.applyPatches([{ index: 0, numStr: '8584629', newNum: '8,500,000' }]), 1);

  const bareEl = makeElementNode('', []);
  bareEl.textContent = '8584629';
  const bare = adapter._makeCellObj(bareEl);
  eq('grid-honesty: applyPatches returns zero when the cell has no text piece',
    bare.applyPatches([{ index: 0, numStr: '8584629', newNum: '8,500,000' }]), 0);
  eq('grid-honesty: a skipped write adds no marker and no record',
    { marked: bareEl.classList.contains('dr-ext-rounded'), recorded: port.has(bareEl) },
    { marked: false, recorded: false });
})();

// =============================================================================
// Grid-virtualization re-apply tests
// Spec: docs/sprint-plans/grid-support-v2.md §2 D4 + §4 "grid-virtualization"
// Commit: a65129c added GRID_REAPPLY_DEBOUNCE_MS, reapplyObservers, reapplyTimers,
// computeGridCellRoundedValue, reapplyRounding, observer attachment in roundTable,
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
// GV3: Debounce — N rapid mutations result in reapplyRounding running once.
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

    // Track re-apply call count by spying on reapplyTimers writes inside flush.
    let reapplyCalls = 0;
    const origRAGR = global.reapplyRounding;
    // We can't easily intercept the closure directly; instead count timer fires.
    // Each non-cancelled timer fires reapplyRounding once.
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

    // Trigger once and flush — this runs reapplyRounding.
    obs.trigger([{ type: 'childList' }]);
    const countBefore = pendingTimers.length;  // should be 1

    flushTimers(pendingTimers);

    // reapplyRounding disconnects observer before writes and reconnects after.
    // Its own nodeValue writes must NOT schedule a new debounce timer.
    const countAfter = pendingTimers.length;
    eq('GV4: no new timer scheduled during re-apply (self-trigger loop prevented)',
      countAfter, countBefore);

    // Also assert the observer was disconnected during the write pass and reconnected.
    eq('GV4: observer disconnected at least once during re-apply (write guard)',
      obs.disconnectCount >= 1, true);

    eq('GV4: observer reconnected after re-apply',
      obs.reconnectCount >= 2, true);  // once in roundTable, once in reapplyRounding

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
    eq('GV5 (pre): reapplyObservers has entry for wrapperEl',
      reapplyObservers.has(grid.wrapperEl), true);

    // Reset the table — should disconnect the observer and clear any pending timer.
    resetTable(grid.wrapperEl);

    eq('GV5: reapplyObservers entry removed after resetTable',
      reapplyObservers.has(grid.wrapperEl), false);

    eq('GV5: reapplyTimers entry removed after resetTable',
      reapplyTimers.has(grid.wrapperEl), false);

    // Observer should be disconnected.
    eq('GV5: observer disconnected after resetTable',
      obs.disconnectCount >= 1, true);

    // Now simulate a mutation — the observer callback fires (it's the same object,
    // but it's been disconnected so in the real DOM it would not fire; here we
    // call it manually to prove the debounce logic does NOT schedule a new timer
    // because reapplyObservers / tableOptions no longer has the wrapper).
    const timerCountBefore = pendingTimers.length;
    obs.trigger([{ type: 'childList' }]);
    // The callback still fires (we're calling it directly), but reapplyRounding
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
// GV5b (Regression #cstif9): a press turning simplification off on a
// virtualized grid restores pristine values; a grid re-apply observer must NOT
// re-round them. Before the fix, the observer saw the restore writes'
// characterData mutations and re-rounded the cells ~100ms later, making them
// flash original then snap back to simplified and leaving the recorded form
// disconnected from the DOM.
//
// The off direction used to be a form flip that kept the grid's markers and
// left its observer connected, and the appliedFlag guard inside the re-apply
// was what held the line. The 2026-09-14 sidebar-state-removal design retired
// that flip (#241): off is a reset, which disconnects the observer and clears
// the stored options. The regression is therefore blocked twice over, and this
// test drives a mutation through anyway — the stub calls the callback whether
// or not the observer was disconnected, so the re-apply's own bail is still
// what the assertions read.
// ---------------------------------------------------------------------------
(function gv5b_pressOff_observerDoesNotReRound() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const obs = ctx.capturedObserver;

    // Pre-condition: cells are rounded after roundTable.
    eq('GV5b (pre): cell[0] is rounded after roundTable',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), true);

    // The user presses the grid's pillbox to turn simplification off.
    resetTable(grid.wrapperEl);

    // Flag must be set and originals restored.
    eq('GV5b: appliedFlag is "original" after the press turns simplification off',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'original');
    eq('GV5b: cell[0] text node restored to original',
      grid.cellEls[0].childNodes[0].nodeValue, '8584629');

    // The restore writes fire characterData mutations the observer listens for.
    // Simulate that, then flush the debounce timer.
    obs.trigger([{ type: 'characterData' }]);
    flushTimers(pendingTimers);

    // The cell must STILL show the original value — the re-apply guard bails
    // because drShowingOriginal === 'true'.
    eq('GV5b: cell[0] still original after observer fires (no re-round)',
      grid.cellEls[0].childNodes[0].nodeValue, '8584629');
    eq('GV5b: cell[1] still original after observer fires (no re-round)',
      grid.cellEls[1].childNodes[0].nodeValue, '100');

    // A press back on runs the apply, which re-simplifies from the settings
    // record. setupVirtGrid rounds with the first row and column included; the
    // settings record here carries the same, so the re-simplify reaches the
    // same cells.
    applySidebarRounding(grid.wrapperEl, Object.assign(
      {}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true, enabled: true }));
    eq('GV5b: appliedFlag is "simplified" after the press turns simplification back on',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'simplified');
    eq('GV5b: cell[0] re-simplified after the press turns simplification back on',
      grid.cellEls[0].childNodes[0].nodeValue !== '8584629', true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV6: a native <table> gets the same re-apply observer a grid gets (#421),
// watching the table element itself.
// ---------------------------------------------------------------------------
(function gv6_nativeTable_getsTheReapplyObserver() {
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

    eq('GV6: a native <table> holds a re-apply observer after roundTable',
      reapplyObservers.has(nativeTable), true);
    eq('GV6: the observer watches the native table element itself',
      (reapplyObservers.get(nativeTable) || {}).target === nativeTable, true);
    eq('GV6: one MutationObserver is instantiated for the native table',
      moConstructCount, 1);
    resetTable(nativeTable);

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

    eq('GV7 (pre): reapplyObservers has entry for grid',
      reapplyObservers.has(grid.wrapperEl), true);

    // The removed-node observer path in content.js (the _tableObserver that watches
    // document.body) runs teardownTableEntry when it detects a tracked table was
    // removed from the DOM. In the test harness the _tableObserver is a no-op
    // stub, so the teardown runs directly.
    teardownTableEntry(grid.wrapperEl, 'removed');

    // Assert cleanup.
    eq('GV7: observer disconnected after removed-node teardown',
      obs.disconnectCount >= 1, true);

    eq('GV7: reapplyObservers entry deleted after removed-node teardown',
      reapplyObservers.has(grid.wrapperEl), false);

    eq('GV7: reapplyTimers entry deleted after removed-node teardown',
      reapplyTimers.has(grid.wrapperEl), false);

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
// Sprint observer-phantom-filter (issue #128): MutationObserver added-node path
// applies the SAME phantom filtering as injectTableToggles.
//
// The initial-load fix only touched injectTableToggles(). Kaggle is a React SPA
// that renders its Data Explorer grid AFTER load, so detection runs through the
// MutationObserver added-node handler — extracted here as injectTogglesForAddedNode().
// These tests drive that function directly with element-node stubs.
// ---------------------------------------------------------------------------

// AC1 (the Kaggle case): an added [role="table"] grid whose ONLY embedded
// <table>s are phantom chart a11y tables → gets dr-ext-grid + a toggle.
(function observer_AC1_addedGridOnlyPhantomTables_getsToggle() {
  const phantom1 = makePhantomEmbeddedTable();
  const phantom2 = makePhantomEmbeddedTable();
  const grid = asAddedGridNode(makeAriaGrid([phantom1, phantom2]));

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(grid);
  });

  eq('observer: added grid with only phantom tables gets dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), true);
  eq('observer: added grid with only phantom tables gets a toggle',
    tableToggles.has(grid), true);
})();

// AC2: an added grid wrapping a REAL table → observer bows out (no class/toggle
// on the grid itself; the real embedded table is owned by Pass 1).
(function observer_AC2_addedGridRealTable_bowsOut() {
  const realTbl = makePass1DataTable(); // non-phantom, has .rows for isDataTable
  const grid = asAddedGridNode(makeAriaGrid([realTbl]));

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(grid);
  });

  eq('observer: added grid wrapping a real table does NOT get dr-ext-grid',
    grid.classList.contains('dr-ext-grid'), false);
  eq('observer: added grid wrapping a real table does NOT get a toggle',
    tableToggles.has(grid), false);

  cleanupPass1Tables([realTbl]);
})();

// AC3: a phantom native <table> reached via querySelectorAll on the added node
// gets NO toggle (Pass 1 phantom skip in the observer path).
(function observer_AC3_addedSubtreePhantomTable_noToggle() {
  const phantom = makePhantomEmbeddedTable();
  const container = {
    nodeType: global.Node.ELEMENT_NODE,
    tagName: 'DIV',
    classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
    matches() { return false; },
    querySelectorAll(sel) { return sel === 'table' ? [phantom] : []; },
  };

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(container);
  });

  eq('observer: phantom <table> in added subtree gets NO toggle',
    tableToggles.has(phantom), false);
})();

// AC4: a real native <table> reached via querySelectorAll on the added node
// DOES get a toggle (Pass 1 survivor in the observer path).
(function observer_AC4_addedSubtreeRealTable_getsToggle() {
  const realTbl = makePass1DataTable();
  const container = {
    nodeType: global.Node.ELEMENT_NODE,
    tagName: 'DIV',
    classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
    matches() { return false; },
    querySelectorAll(sel) { return sel === 'table' ? [realTbl] : []; },
  };

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(container);
  });

  eq('observer: real <table> in added subtree gets a toggle',
    tableToggles.has(realTbl), true);

  cleanupPass1Tables([realTbl]);
})();

// Behavior: the header row holds because it is the literal first row; the
// first data row and the summary row round. The first column still holds.
(function gridRowUniverse_headerHolds_dataAndSummaryRound() {
  const g = makeRowgroupRoleGrid(
    ['Region', '999999'],
    [['North', '1482391'], ['South', '918554']],
    ['Total', '2400945']
  );
  const { cells: results } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), Object.assign({}, DR_DEFAULTS), { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  // results are row-major over all rows: [header c0, header c1, r1c0, r1c1, r2c0, r2c1, total c0, total c1]
  eq('row-universe: every cell of every row is classified',
    results.length, 8);
  eq('row-universe: the header row\'s numeric cell holds under the first-row default',
    results[1] && results[1].patches.length, 0);
  eq('row-universe: the first data row rounds under defaults',
    !!(results[3] && results[3].patches.length > 0), true);
  eq('row-universe: the first column of a data row still holds',
    results[2] && results[2].patches.length, 0);
  eq('row-universe: the summary row below the group rounds with the data',
    !!(results[7] && results[7].patches.length > 0), true);
})();

// Behavior: with the rowgroup first (no header row outside), the first data
// row IS the grid's literal first row and holds under the default.
(function gridRowUniverse_groupAtTop_firstDataRowHolds() {
  const g = makeRowgroupRoleGrid(
    null,
    [['1111111', '1482391'], ['2222222', '918554']],
    ['Total', '2400945']
  );
  const { cells: results } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), Object.assign({}, DR_DEFAULTS), { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  eq('row-universe: rowgroup-first grid holds its first data row',
    results[1] && results[1].patches.length, 0);
  eq('row-universe: rowgroup-first grid rounds its second data row',
    !!(results[3] && results[3].patches.length > 0), true);
  eq('row-universe: rowgroup-first grid rounds its summary row',
    !!(results[5] && results[5].patches.length > 0), true);
})();

// Outside rows: a row outside the row group rounds, but its values stay out
// of the dataset — they never feed the max magnitude or the lens preview.
(function gridOutsideRow_staysOutOfDataset() {
  // Total is a magnitude ABOVE the data (7 vs 6): if it fed the basis, the
  // max magnitude would read 7.
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1,482,391'], ['South', '918,554']],
    ['Total', '24,009,450']
  );
  const { cells: results, maxMag } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), Object.assign({}, DR_DEFAULTS), { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  eq('outside-row: the max magnitude comes from the data rows alone',
    maxMag, 6);
  eq('outside-row: the outside row still rounds against that dataset',
    !!(results[7] && results[7].patches.length > 0), true);
})();

// Outside rows: the lens preview pool draws from the dataset only.
(function gridOutsideRow_staysOutOfPreview() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1482391'], ['South', '918554']],
    ['Total', '2400945']
  );
  const cells = collectNumericCells(g.wrapperEl);
  eq('outside-row: lens preview pool includes the first data row value',
    cells.some(function(c) { return c.num === 1482391; }), true);
  eq('outside-row: lens preview pool leaves the outside row value out',
    cells.some(function(c) { return c.num === 2400945; }), false);
})();

// Pin: only the footer section carries the outside mark on native tables.
// A header-section row's td values still feed the dataset — the deliberate
// scope of the outside-row rule (Arie approved footer-only). The offsets are
// pulled apart: with the thead value (magnitude 8) in the basis, the body
// value (magnitude 7) is the other band (nearest 1M → 88,000,000); marking
// THEAD outside would flip it to the top band (nearest 5M → 90,000,000).
(function nativeHeaderRow_staysInDataset() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'td', text: '987,654,321' }],
      [{ tag: 'td', text: '87,654,321' }],
    ]);
    table.rows[0].parentElement = { tagName: 'THEAD' };
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
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

// Pin: when a table's only numbers sit in outside rows, the dataset is empty
// (max magnitude null) and every outside value takes the other-band offset —
// the accepted edge, recorded so the next reader need not re-derive it.
(function gridOutsideRow_emptyDatasetTakesOtherOffset() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', 'n/a']],
    ['Total', '24,009,450']
  );
  const opts = Object.assign({}, DR_DEFAULTS, { offsetTop: -0.5, offsetOther: -1 });
  const { cells: results, maxMag } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), opts, { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  eq('outside-row: a dataset of outside rows alone is empty',
    maxMag, null);
  eq('outside-row: with an empty dataset the outside value takes the other-band offset',
    results[5] && results[5].patches[0] && results[5].patches[0].newNum, '24,000,000');
})();

// Outside rows, native analog: a footer-section row rounds but stays out of
// the dataset. The offsets are pulled apart so the basis is visible in the
// output: with the footer value (magnitude 8) out of the basis, the body
// value (magnitude 7) is the top band and takes offset_top (nearest 5M →
// 90,000,000); if the footer fed the basis, the body value would take
// offset_other (nearest 1M → 88,000,000).
(function nativeFooterRow_staysOutOfDataset() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'td', text: '87,654,321' }],
      [{ tag: 'td', text: '987,654,321' }],
    ]);
    table.rows[1].parentElement = { tagName: 'TFOOT' };
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -1, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    eq('outside-row (native): the body value rounds on the top band — the footer value did not raise the basis',
      table.rows[0].cells[0].innerText, '90,000,000');
    eq('outside-row (native): the footer row still rounds against the dataset',
      table.rows[1].cells[0].innerText, '1,000,000,000');
  });
})();

// -------------------------------------------------------------------------
// AC3 (Bug #1): embedded-in-text numbers feed maxMag.
// A table whose only large values are embedded in mixed-text cells (like
// "₹2,000 crore") must produce maxMag=3 (from 2,000) even when a stand-alone
// small numeric cell (e.g. "5") is also present.
// -------------------------------------------------------------------------
(function ac3_embeddedInTextMaxMag() {
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }

  // The large number is embedded inside prose; the small number is pure-numeric.
  // "₹2,000 crore": toNumber returns null (not a pure number), so
  // extractNumbersInText extracts 2000 → magnitude 3.
  // "5": toNumber returns 5 → magnitude 0.
  //
  // A header row + label column keep the data off row 0 / column 0
  // (DR_DEFAULTS excludes both by default; see the merge-ladder divergence
  // tests below).
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('₹2,000 crore'), tdCell('5')] },
    ],
  };

  const result = extractPreviewSamples(table);

  eq('AC3: maxMag is 3 (from embedded 2,000, not suppressed by stand-alone 5)',
    result.maxMag, 3);

  eq('AC3: top band contains the large embedded number',
    result.samples.top.length >= 1, true);

  eq('AC3: top band num is 2000 (the embedded value)',
    result.samples.top[0] && result.samples.top[0].num, 2000);

  // Complementary: a pure-number table still works as before (regression guard).
  const pureTable = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('286')] },
    ],
  };
  const pureResult = extractPreviewSamples(pureTable);
  eq('AC3-regression: pure-number table maxMag is 7 (27M)',
    pureResult.maxMag, 7);

  // Also verify that collectNumericCells picks up the embedded number from
  // the mixed-text cell, proving the extraction path is exercised.
  const mixedTable = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('Revenue: ₹2,000 crore'), tdCell('5')] },
    ],
  };
  const cells = collectNumericCells(mixedTable);
  // Should find at least 2000 among the collected cells.
  const nums = cells.map(c => c.num);
  eq('AC3-collect: collectNumericCells finds 2000 from embedded text',
    nums.includes(2000), true);
})();

// -------------------------------------------------------------------------
// Issue #4: era-marked years are dates, not offset-rounded numbers.
// eraYearDigitRanges locates each year token bound to an era marker;
// collectNumericCells / extractPreviewSamples must exclude such tokens from
// magnitude detection and the preview examples.
// -------------------------------------------------------------------------
(function eraYearDetection() {
  // The number at [index, index + numStr.length) sits in an era-year range.
  const isEraYear = (text, index, numStr) =>
    overlapsQuoteRange(eraYearDigitRanges(text), index, index + numStr.length);

  // The digit token bound to a marker (either order) is an era year.
  eq('era: "Kalki 2898 AD" → 2898 is an era year',
    isEraYear('Kalki 2898 AD', 'Kalki '.length, '2898'), true);
  eq('era: "500 BC" → 500 is an era year',
    isEraYear('500 BC', 0, '500'), true);
  eq('era: "AD 79" → 79 is an era year',
    isEraYear('AD 79', 'AD '.length, '79'), true);
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
  // These must NOT be read as years (they'd otherwise be excluded from rounding).
  eq('era: "3,420 ad hoc" → "ad" is a word, NOT an era year',
    isEraYear('3,420 ad hoc', 0, '3,420'), false);
  eq('era: "120 bp" (basis points) is NOT an era year',
    isEraYear('120 bp', 0, '120'), false);
  eq('era: "5 ah" is NOT an era year',
    isEraYear('5 ah', 0, '5'), false);
  // Period-punctuated lowercase forms stay unambiguous and DO match.
  eq('era: "79 a.d." (dotted, lowercase) is still an era year',
    isEraYear('79 a.d.', 0, '79'), true);

  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }

  // A header row + label column keep the data off row 0 / column 0
  // throughout this block (DR_DEFAULTS excludes both by default; see the
  // merge-ladder divergence tests below).

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

  // Regression: "~3,420 ad hoc" — "ad" was being read as the AD era marker, so
  // the 3,420 was dropped and the cell never rounded. It must now be collected.
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
  // and no sample row carries the era-year value.
  const result = extractPreviewSamples({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('Kalki 2898 AD'), tdCell('1,050,000,000'), tdCell('500')] },
    ],
  });
  eq('era-samples: maxMag is 9 (from 1.05B, not the 2898 AD year)',
    result.maxMag, 9);
  const sampleNums = result.samples.top.concat(result.samples.bottom).map(r => r.num);
  eq('era-samples: no example row is the 2898 AD year',
    sampleNums.includes(2898), false);
})();

// -------------------------------------------------------------------------
// Issue #2: when a native table is already simplified, collectNumericCells
// reads the stored original (DR_STORE's table registry, app-model-registry
// sprint — this used to be dataset.originalValue) rather than the rounded
// text now showing in the cell.
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
  // A header row + label column keep the cell off row 0 / column 0
  // (DR_DEFAULTS excludes both by default; see the merge-ladder divergence
  // tests below) so this stays a test of the registry original read path,
  // not an incidental first-row/first-column exclusion.
  const labelCell = { tagName: 'TH', innerText: '', textContent: '' };
  const headerCell = { tagName: 'TH', innerText: 'A', textContent: 'A' };
  const rowLabelCell = { tagName: 'TH', innerText: 'Row', textContent: 'Row' };
  const mockTable = {
    rows: [
      { cells: [labelCell, headerCell] },
      { cells: [rowLabelCell, roundedCell] },
    ],
  };
  DR_STORE.setTableOriginal(mockTable, roundedCell, {
    value: '2,794,356', pieces: [{ text: '2,794,356', written: '3,000,000' }], supRanges: null, linkFilteredIdx: null,
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
    DR_STORE.setTableOriginal(table, roundedCell, {
      value: '6,718,245 kg',
      pieces: [{ text: '6,718,245', written: '6,700,000' }, { text: ' kg', written: ' kg' }],
      supRanges: null, linkFilteredIdx: null,
    });
    const liveCell = makeReactiveCell([{ text: '6,7', inSup: false }, { text: '18,245', inSup: false }]);
    const liveTable = { rows: [{ cells: [liveCell] }], dataset: {} };
    try {
      eq('preview simplified native cell: the stored original joins the pool through its stored pieces',
        collectNumericCells(table, opts).map((c) => c.num), [6718245]);
      eq('preview simplified native cell: the same split with no stored original stays out',
        collectNumericCells(liveTable, opts), []);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

// The lens preview writes no log rows: a native value split across text
// pieces, which the simplification pass records with a debug row, leaves
// the log unchanged when the preview classifies it.
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
      roundTable(table, opts);
      eq('preview log rows (control): the simplification pass writes the split row',
        rows.some((row) => row.level === 'debug' && /native cell value split across text pieces/.test(row.text)), true);
    } finally {
      offRow();
      DR_STORE.unregisterTable(table);
    }
  });
})();

// On an HTML table a unit number rounds with the words setting off; only its
// digits change. Dataset: 4.91 (magnitude 0) and 45.67 (magnitude 1), so
// 45.67 takes the top band (step 5) and 4.91 the other band (step 0.5).
(function nativeTable_unitNumbersRoundWithWordsOff() {
  withCreateTreeWalker(function () {
    const table = makeMockTable([[
      { tag: 'td', text: '4.91tn' }, { tag: 'td', text: 'CAD45.67m' }, { tag: 'td', text: 'DT1234' },
    ]]);
    roundTable(table, Object.assign({}, DR_DEFAULTS, {
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedCells: false,
    }));
    eq('HTML table: unit numbers round with the words setting off and an identifier stays',
      table.rows[0].cells.map((cell) => cell.innerText), ['5tn', 'CAD45m', 'DT1234']);
  });
})();

// --- 3. Divergence tests: merged (engine-wins) preview behavior ---
//
// Every fixture below hides its numeric data behind a TH header row and a TH
// label column so the first-row/first-column rule (itself one of the
// divergences, tested explicitly first) doesn't confound the others.

(function mergeLadderDivergence_outOfRange() {
  // OLD preview copy: collectNumericCells never parsed rangeExpr or checked
  // isInRanges — every numeric cell was sampled regardless of the sidebar's
  // range restriction. The merged ladder now applies isInRanges exactly like
  // the engine.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('123'), tdCell('456')] },
    ],
  };
  eq('merge-ladder divergence (no range restriction): both columns are sampled',
    collectNumericCells(table).map((c) => c.num).sort(), [123, 456]);
  eq('merge-ladder divergence (out-of-range): a rangeExpr restricts the sample to the in-range column',
    collectNumericCells(table, { rangeExpr: 'B:B' }).map((c) => c.num), [123]);
  eq('merge-ladder divergence (invalid range): an invalid range expression yields no samples, matching the engine which rounds nothing',
    collectNumericCells(table, { rangeExpr: 'not a range' }).length, 0);
})();

(function mergeLadderDivergence_firstRow() {
  // OLD preview copy: walked every <td> with no row/column awareness — a
  // numeric header-row <td> was sampled like any other cell. The merged
  // ladder applies getExclusionReason's first-row rule exactly like the
  // engine, whose DR_DEFAULTS ships simplifyFirstRow: false.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [tdCell('label'), tdCell('777')] }, // row 0
      { cells: [tdCell('label'), tdCell('888')] }, // row 1
    ],
  };
  eq('merge-ladder divergence (first-row): the row-0 numeric cell is excluded even though its column is not first',
    collectNumericCells(table).map((c) => c.num), [888]);
})();

(function mergeLadderDivergence_firstColumn() {
  // Same rule, isolated to the column axis (DR_DEFAULTS ships
  // simplifyFirstColumn: false too).
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [tdCell('999'), tdCell('999')] },  // row 0 — excluded by first-row regardless
      { cells: [tdCell('111'), tdCell('222')] },  // row 1: column 0 vs column 1
    ],
  };
  eq('merge-ladder divergence (first-column): the column-0 numeric cell is excluded even in a non-first row',
    collectNumericCells(table).map((c) => c.num), [222]);
})();

(function mergeLadderDivergence_percentGating() {
  // OLD preview copy: never checked simplifyMixedPercent — a percent cell was
  // always sampled as a pure number, even with the sidebar's percent toggle
  // off. The merged ladder applies getExclusionReason's percent rule.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('50%')] },
    ],
  };
  eq('merge-ladder divergence (percent on): percent cell is sampled',
    collectNumericCells(table, { simplifyMixedPercent: true }).map((c) => c.num), [50]);
  eq('merge-ladder divergence (percent off): percent cell is excluded from samples',
    collectNumericCells(table, { simplifyMixedPercent: false }).length, 0);
})();

(function mergeLadderDivergence_currencyGating() {
  // Same rule, currency symbols.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('$100')] },
    ],
  };
  eq('merge-ladder divergence (currency on): currency cell is sampled',
    collectNumericCells(table, { simplifyMixedCurrency: true }).map((c) => c.num), [100]);
  eq('merge-ladder divergence (currency off): currency cell is excluded from samples',
    collectNumericCells(table, { simplifyMixedCurrency: false }).length, 0);
})();

(function mergeLadderDivergence_quotedCell() {
  // OLD preview copy had no whole-cell-quote check — toNumber('"12345"')
  // fails (quotes aren't stripped), so it fell into the mixed-text fallback
  // and extractNumbersInText happily found "12345" inside the quotes,
  // sampling a cell the engine treats as literal text and never touches.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('"12345"')] },
    ],
  };
  eq('merge-ladder divergence (quoted cell): a whole-cell-quoted number is excluded from samples',
    collectNumericCells(table).length, 0);
})();

(function mergeLadderDivergence_quotedNumberInMixedText() {
  // OLD preview copy's mixed-text fallback never applied quote masking —
  // 'Product "42" ships in 10 days' would surface 42 (a quoted, literal
  // value) as a would-change sample alongside the real number 10.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('Product "42" ships in 10 days')] },
    ],
  };
  eq('merge-ladder divergence (quoted number in mixed text): only the unquoted number is sampled',
    collectNumericCells(table).map((c) => c.num), [10]);
})();

(function mergeLadderDivergence_wholeCellLink() {
  // OLD preview copy never called isCellWholeLink — a pure numeric cell whose
  // entire visible text is a hyperlink (e.g. a linked page number) was
  // sampled like any other pure number, even though the engine leaves it
  // untouched.
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const linkCell = makeLinkCell(['42'], null);
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), linkCell] },
    ],
  };
  eq('merge-ladder divergence (whole-cell link): a whole-cell-link number is excluded from samples',
    collectNumericCells(table).length, 0);
})();

(function mergeLadderDivergence_mixedTextLinkedNumber() {
  // OLD preview copy's mixed-text fallback never applied filterLinkMatches —
  // "<text> 42" with "42" wrapped in <a> would surface 42 as a sample the
  // engine never touches (filterLinkMatches drops it).
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const mixedLinkCell = makeLinkCell(['42'], 'See page for details');
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), mixedLinkCell] },
    ],
  };
  withLinkCreateTreeWalker(() => {
    eq('merge-ladder divergence (linked number in mixed text): a number inside <a> is excluded from samples',
      collectNumericCells(table).length, 0);
  });
})();

(function mergeLadderDivergence_superscriptMasking() {
  // OLD preview copy never checked cell.querySelector('sup') — a whole-cell
  // exponent like "10<sup>12</sup>" (flattened innerText "1012") was parsed
  // as the single pure number 1012, a wrong value the engine never produces
  // (the engine masks the exponent and, finding nothing left to round,
  // leaves the cell untouched entirely).
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
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
    eq('merge-ladder divergence (superscript exponent): a whole-cell exponent is excluded, not misread as 1012',
      collectNumericCells(table).length, 0);
  });
})();

(function mergeLadderDivergence_mixedCellsOption() {
  // OLD preview copy's mixed-text fallback ran unconditionally — it never
  // checked opts.simplifyMixedCells, so turning that sidebar toggle off had
  // no effect on the preview even though the engine would leave every mixed
  // cell untouched.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A')] },
      { cells: [thCell('Row'), tdCell('Revenue: 5,000 units')] },
    ],
  };
  eq('merge-ladder divergence (mixed cells on): embedded number is sampled',
    collectNumericCells(table, { simplifyMixedCells: true }).map((c) => c.num), [5000]);
  eq('merge-ladder divergence (mixed cells off): embedded number is excluded from samples',
    collectNumericCells(table, { simplifyMixedCells: false }).length, 0);
})();

(function mergeLadderParity_datesAndTimesStillExcludedFromPreview() {
  // Deliberate, UNCHANGED scope restriction (not a divergence fix): the
  // preview band is about numeric magnitude/offset, so mode:'date' and
  // mode:'time' decisions from the ladder are excluded from the sample pool
  // even though the ladder classifies them and the engine would simplify
  // them. The old preview copy also excluded dates/times (via its own
  // isDateLike/isTimeLike/isDateTimeLike checks) — this is parity, not a fix.
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('2020-01-01'), tdCell('3:45 PM')] },
    ],
  };
  eq('merge-ladder parity (dates/times): date and time cells are still excluded from preview samples',
    collectNumericCells(table, { simplifyTimes: true }).length, 0);
})();

// --- 4. Engine-path equivalence pin ---
//
// The divergence tests above pin the PREVIEW path against the merged ladder.
// They say nothing about the ENGINE path (roundTable's native-table loop),
// which is what actually writes values into a page. Before this sprint the
// native loop carried its own inline copy of every rule below; classifyCell
// now makes every one of those decisions instead. A single fixture that
// exercises several rules together, with the exact applied cell text pinned,
// catches a future change to the ladder's shared logic (rule order,
// max_mag interaction, formatting) that a per-rule unit test run in
// isolation would not: rules here interact through one shared max_mag pass
// and one shared column post-pass, same as on a real page.
//
// These values were captured by running this exact fixture through
// roundTable on both this branch and its pre-ladder parent branch (the two
// hand-kept-in-sync copies), confirming byte-identical output. This test
// pins that already-verified behavior against future drift; it does not
// re-derive it.
(function mergeLadderEnginePin_multiRuleNativeTable() {
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
    const opts = {
      enabled: true, simplifyFirstRow: false, simplifyFirstColumn: false,
      simplifyMixedPercent: true, simplifyMixedCurrency: true,
      simplifyDates: true, simplifyTimes: true, simplifyMixedCells: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
      dateGranularity: 'month', timeGranularity: 'hour',
    };
    roundTable(table, opts);
    const applied = table.rows.map((row) => row.cells.map((c) => c.textContent));
    eq('merge-ladder engine pin: multi-rule fixture applies the exact pinned values',
      applied, [
        ['', 'A', 'B', 'C', 'D', 'E', 'F'],
        ['Row', '25,000,000', '4,000', '50%', '$1,000,000', '"98765"', '2020'],
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

  // A cell with words holds its phone number and rounds its count (issue #465).
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
    DR_STORE.unregisterTable(grid.wrapperEl);
  }

  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const previewTable = {
    rows: [
      { cells: [thCell(''), ...identifiers.map(() => thCell('A')), thCell('B')] },
      { cells: [thCell('Row'), ...identifiers.map(tdCell), tdCell(quantity)] },
    ],
  };
  eq('identifier shape (sidebar preview): only the quantity is sampled',
    collectNumericCells(previewTable).map((c) => c.num), [1613245]);
})();

// ---------------------------------------------------------------------------
// Sprint engine-returns-results: the engine runs end-to-end with NO `chrome`
// global present at all — not even a stub. This loads the real content-script
// bundle in a vm sandbox that never defines `chrome`. The only top-level
// statement in content.js that unconditionally touches chrome — registering
// the runtime message listener, controller wiring unrelated to the engine —
// is neutralized to a no-op so the module can load; every other chrome.*
// reference in content.js lives inside a function body this test never calls.
// If roundTable (or anything it reaches) touched chrome, loading or calling
// it here would throw ReferenceError: chrome is not defined.
// ---------------------------------------------------------------------------
(function engineRunsWithNoChromeGlobal() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('no-chrome e2e: source file content.js present in manifest', false, true);
    return;
  }

  eq('no-chrome e2e: content.js registers no Chrome message listener of its own',
    contentSrc.split('chrome.runtime.onMessage.addListener(').length - 1, 0);
  // No patch needed: every remaining chrome.* reference in content.js sits
  // inside a function body this test never calls. Loading the file unpatched
  // is a stronger check than loading a patched copy.
  const noChromeContentSrc = contentSrc;

  // Sandbox has NO `chrome` property whatsoever — only the DOM/browser
  // primitives the engine's non-controller code paths actually touch
  // (document.createTreeWalker via collectTextPieces, NodeFilter).
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
  // Load the content scripts in manifest order (same order contentScriptBundle
  // uses), substituting the neutralized content.js source for the real one.
  const bundle = contentScriptFiles
    .map((file) => (file === 'content.js' ? noChromeContentSrc : contentScriptSources.get(file)))
    .join('\n');

  let threw = null;
  try {
    vm.runInContext(bundle + '\nthis.__roundTable = roundTable;', ctx);
  } catch (e) {
    threw = e.message;
  }
  eq('no-chrome e2e: the engine bundle loads with no `chrome` global defined anywhere',
    threw, null);
  eq('no-chrome e2e: `chrome` is genuinely absent from the sandbox',
    'chrome' in sandbox, false);
  if (threw !== null || typeof sandbox.__roundTable !== 'function') return;

  const table = makeMockTable([[{ tag: 'td', text: '1,234,567' }]]);
  let callThrew = null;
  let result;
  try {
    result = sandbox.__roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      // The fixture's only row is row 0 — simplifyFirstRow/Column must be true
      // or getExclusionReason would exclude the only cell under test.
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    });
  } catch (e) {
    callThrew = e.message;
  }

  eq('no-chrome e2e: calling roundTable on a fixture does not throw with no chrome global present',
    callThrew, null);
  eq('no-chrome e2e: roundTable returns rangeStatus "ok"',
    result && result.rangeStatus, 'ok');
  eq('no-chrome e2e: roundTable returns applied: true',
    result && result.applied, true);
  eq('no-chrome e2e: roundTable actually rounded the fixture cell',
    table.rows[0].cells[0].classList.contains('dr-ext-rounded'), true);
})();

// --- (i) Off-and-on round trip under grid row recycling: round -> off press
// -> the host virtualization library recycles ONE cell (same row, a
// genuinely NEW element takes that grid position — the documented "element
// replaced" pattern, distinct from this extension's own nodeValue-patch-in-
// place write model) -> on press.
//
// The off step used to be a form flip that kept every marker and stored
// original in place. The 2026-09-14 sidebar-state-removal design retired it
// (#241): off resets, which restores every cell still in the grid and drops
// its record. The recycling scenario is unchanged — a brand-new element was
// never in the registry either way — and the last assertion below moves with
// the change: the recycled-away cell's record is dropped at the off press
// rather than surviving until the element is collectible.
//
// Uses a live-scanning querySelectorAll (walks wrapper.children -> row
// .children each call) instead of makeE2EGridWrapper's snapshot list, so
// the recycled cell is genuinely undiscoverable via '.dr-ext-rounded' the
// way a real detached-and-replaced DOM node would be — makeE2EGridWrapper's
// fixed `allCells` array would otherwise still "see" the old cell and mask
// the scenario this test exists to exercise. ---
(function registrySprint_offAndOnRoundTripUnderGridRecycling() {
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

  const cellA = grid.cellEls[0]; // will be recycled away
  const cellSurvivor = grid.cellEls[1]; // stays in place across the whole cycle

  eq('recycling: both cells round on the initial pass (pre-condition)',
    cellA.classList.contains('dr-ext-rounded') && cellSurvivor.classList.contains('dr-ext-rounded'), true);

  resetTable(grid.wrapperEl); // the press that turns simplification off
  eq('recycling: the off press restores cellA\'s display text',
    cellA.childNodes[0].nodeValue, '87654321');

  // Simulate the host grid recycling row 0's first cell: a brand-new element
  // (never seen by this extension) occupies that position; cellA is no
  // longer reachable from the table at all.
  const cellB = makeGridCellWithTextNode('99999999');
  grid.rowEls[0].children = [cellB, cellSurvivor];

  roundTable(grid.wrapperEl, opts); // the press that turns it back on

  // Functional correctness: the recycled cell is treated as any other live
  // cell on the re-round — it rounds fresh from ITS OWN content, not
  // corrupted and not skipped. This matches what the parent (dataset-based)
  // branch would also do on the same scenario: a genuinely new element has
  // no dataset either, so both designs re-detect it from scratch. FAITHFUL
  // MATCH, not a regression.
  eq('recycling: the recycled cell (cellB) is picked up and rounded on the on press, not skipped',
    cellB.classList.contains('dr-ext-rounded'), true);
  eq('recycling: the recycled cell\'s rounded value differs from its own live text',
    cellB.childNodes[0].nodeValue !== '99999999', true);
  eq('recycling: the surviving cell also re-rounds correctly on the on press',
    cellSurvivor.classList.contains('dr-ext-rounded'), true);

  // The registry's per-table `originals` is a WeakMap keyed by cell element
  // (app/store.js). cellA was still in the grid at the off press, so the
  // restore visited it and dropped its record there — before the recycling
  // took the element out of the grid. Nothing is keyed to a cell the grid no
  // longer holds, and a cell the restore never reaches is collectible once
  // the page stops referencing it.
  eq('recycling: the off press drops the recycled-away cell\'s registry original',
    DR_STORE.hasTableOriginal(grid.wrapperEl, cellA), false);
})();

// --- (j) Content-script re-injection: DR_STORE lives in the content script's
// JS heap, which a re-injection (extension reload/update while a tab stays
// open) throws away and rebuilds from scratch — the live PAGE DOM survives
// untouched (classes, text, everything the OLD script instance wrote stay
// exactly as they were). The bundle is eval'd TWICE here against the SAME
// fixture tables/document, each eval producing its own independent DR_STORE
// (direct eval gives let/const their own lexical environment per call — the
// same mechanism runContextmenuFixture above already relies on), to model
// exactly that: instance 1 rounds the tables; instance 2 (fresh registry,
// same already-rounded DOM) is what a real re-injected script would face.
//
// A re-injected instance still cannot recover the true original from its
// own (empty) registry — that half of the KNOWN ACCEPTED COST comment on
// restoreTable (content.js) holds. What this test pins is the consequence
// the sprint did NOT accept: an unrestorable cell must be left exactly as
// found — marker, title, and text untouched — instead of resetTable
// stripping the marker and title off a cell it could not actually restore,
// and instead of a restore followed by a re-run of roundTable over
// already-rounded text, stamping a FALSE "Original: ..." title over the
// one attribute that still held the truth. Scenario A drives resetTable
// directly (the "reset" recovery action); scenario B drives the actual
// toggle-click wiring end to end. ---
(function registrySprint_reinjectionUnrestorableResetStaysTruthful() {
  function makeReinjectionFixtureTable(dataText) {
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: dataText }],
    ]);
    // Link innerHTML/innerText/textContent to one backing value on the data
    // cell, matching a real <td>'s single-node-tree-backed semantics (same
    // fix angle (f)'s test needed, for the same reason: restoreTable writes
    // innerHTML only, and getText()/the fake tree walker below read innerText).
    const dataCell = table._cells[3];
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });
    // A real removeAttribute('title') clears the title. makeToggleTableCell's
    // default stub is a no-op, which would hide exactly the bug this test
    // exists to catch — an implementation that unconditionally strips the
    // title would otherwise leave dataCell.title looking untouched.
    dataCell.removeAttribute = function (name) {
      if (name === 'title') this.title = '';
    };
    return { table, dataCell };
  }

  const { table: table1, dataCell: dataCell1 } = makeReinjectionFixtureTable('12,345');
  const { table: table2, dataCell: dataCell2 } = makeReinjectionFixtureTable('67,890');
  const { table: table3, dataCell: dataCell3 } = makeReinjectionFixtureTable('54,321');
  // Scenario D fixtures (issue #262): table5 is rounded by instance 1 and
  // then untouched — the pill's wrong-on-arrival case. table6 starts
  // unrounded and is later rounded BY instance 2 itself — the sanity case
  // proving the lock keys on missing registry records, not on "rounded".
  const { table: table5, dataCell: dataCell5 } = makeReinjectionFixtureTable('9,876');
  const { table: table6 } = makeReinjectionFixtureTable('8,765');
  const trueOriginal1 = '12,345';
  const trueOriginal2 = '67,890';
  const trueOriginal3 = '54,321';

  // A minimal document shared by every eval'd instance below — this is the
  // "live page" that persists across the simulated re-injection.
  // createTreeWalker mirrors withCreateTreeWalker's single-fake-text-node
  // approach, reading and writing through the SAME linked innerText/
  // innerHTML property. createElement/head back ensureHighlightStyleInjected,
  // which scenario B (the real click path) exercises for real.
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
      globalThis.__ri1_isTableRounded = isTableRounded;
    `);
    global.__ri1_roundTable(table1, DR_DEFAULTS);
    global.__ri1_roundTable(table2, DR_DEFAULTS);
    global.__ri1_roundTable(table3, DR_DEFAULTS);
    global.__ri1_roundTable(table5, DR_DEFAULTS);
    const roundedText1 = dataCell1.innerText;
    const roundedTitle1 = dataCell1.title;
    const roundedText2 = dataCell2.innerText;
    const roundedTitle2 = dataCell2.title;
    const roundedText3 = dataCell3.innerText;
    const roundedTitle3 = dataCell3.title;

    eq('re-injection (pre): instance 1 actually rounded the sidebar-scenario cell away from the true original',
      roundedText3 !== trueOriginal3, true);
    eq('re-injection (pre): the sidebar-scenario cell\'s title holds the true original',
      roundedTitle3, `Original: ${trueOriginal3}`);

    eq('re-injection (pre): instance 1 actually rounded the cell away from the true original',
      roundedText1 !== trueOriginal1, true);
    eq('re-injection (pre): instance 1 reports the table as rounded',
      global.__ri1_isTableRounded(table1), true);
    eq('re-injection (pre): the title attribute holds the true original',
      roundedTitle1, `Original: ${trueOriginal1}`);

    // --- Instance 2: simulates re-injection. The DOM is untouched (both
    // data cells still show their rounded text, still carry
    // dr-ext-rounded) but this eval's DR_STORE is BRAND NEW — instance 1's
    // registry (and its stored true originals) is unreachable garbage now,
    // exactly as a real content-script reload would leave it. ---
    eval(contentScriptBundle + `
      globalThis.__ri2_isTableRounded = isTableRounded;
      globalThis.__ri2_resetTable = resetTable;
      globalThis.__ri2_DR_STORE = DR_STORE;
      globalThis.__ri2_DR_BUS = DR_BUS;
      globalThis.__ri2_roundTable = roundTable;
      globalThis.__ri2_syncSwitchForTable = syncSwitchForTable;
      globalThis.__ri2_tableToggles = tableToggles;
    `);

    eq('re-injection: a fresh instance reports the table as NOT rounded, despite the DOM still showing rounded text — a state/display mismatch the moment re-injection happens',
      global.__ri2_isTableRounded(table1), false);

    // --- Scenario A: the user's most natural recovery action is "reset"
    // (or an equivalent toggle-to-original click). Drive the SAME
    // production primitive (resetTable) the sprint's own restoreTable
    // KNOWN ACCEPTED COST comment discusses. ---
    const unrestorableCount = global.__ri2_resetTable(table1);

    eq('re-injection reset: resetTable reports the one cell it could not restore',
      unrestorableCount, 1);
    eq('re-injection reset: the dr-ext-rounded marker SURVIVES — the screen still shows rounded text, so the marker must stay truthful instead of claiming a clean reset that did not happen',
      dataCell1.classList.contains('dr-ext-rounded'), true);
    eq('re-injection reset: the title attribute SURVIVES — it is the last remaining copy of the true original and must not be stripped when nothing was actually restored',
      dataCell1.title, roundedTitle1);
    eq('re-injection reset: the displayed text is unchanged — not falsely "restored"',
      dataCell1.innerText, roundedText1);
    eq('re-injection reset: appliedFlag stays \'simplified\' — the truthful state, since the screen still shows rounded text',
      global.__ri2_DR_STORE.getTableAppliedFlag(table1), 'simplified');

    // --- Scenario B: the toggle-click path (not covered before this fix) —
    // drives the exact wiring a real click on the toggle switch uses
    // (ui-toggle.js's click handler publishes this same intent), end to
    // end through content.js's intent:toggleTable subscriber, the settings
    // write it makes, and the apply that follows. One click on a
    // re-injected, already-rounded table must not double-round the text or
    // stamp a false title over it. ---
    global.__ri2_DR_BUS.publish('intent:toggleTable', { table: table2 });

    eq('re-injection click path: one click after re-injection does not strip the dr-ext-rounded marker',
      dataCell2.classList.contains('dr-ext-rounded'), true);
    eq('re-injection click path: one click does not rewrite the title with a false original (no double-round)',
      dataCell2.title, roundedTitle2);
    eq('re-injection click path: one click leaves the displayed text unchanged',
      dataCell2.innerText, roundedText2);

    // --- Scenario C (issue #254): the sidebar apply path — the one other
    // resetTable caller. Drives the real wiring end to end: a sidebar
    // settings change lands as DR_STORE.setSettings (the
    // request:applySettings listener), whose state:settingsChanged
    // subscriber calls applySidebarRounding on the selected table. Before
    // the fix this ran roundTable over the already-rounded text — stamping
    // a false "Original: <rounded value>" title over the surviving truth
    // and recording the rounded value as the registry original of record.
    // It must refuse instead, and tell the sidebar why nothing changed.
    //
    // The new settings must DIFFER from the ones instance 1 rounded with:
    // re-rounding under identical settings is a value-preserving no-op the
    // engine skips, which would hide the title-stamping this test exists
    // to catch. offsetTop 1 re-rounds instance 1's '55,000' to '100,000',
    // so an unguarded apply visibly rewrites the cell and its title. ---
    const sentMessages = [];
    global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };
    global.__ri2_DR_STORE.setSelectedTable(table3);
    global.__ri2_DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { offsetTop: 1 }));

    eq('re-injection sidebar apply: the dr-ext-rounded marker survives',
      dataCell3.classList.contains('dr-ext-rounded'), true);
    eq('re-injection sidebar apply: the title still holds the TRUE original — not a re-stamped "Original: <rounded value>"',
      dataCell3.title, roundedTitle3);
    eq('re-injection sidebar apply: the displayed text is unchanged (no double-round)',
      dataCell3.innerText, roundedText3);
    eq('re-injection sidebar apply: appliedFlag stays \'simplified\' — the screen still shows rounded text',
      global.__ri2_DR_STORE.getTableAppliedFlag(table3), 'simplified');
    eq('re-injection sidebar apply: the registry records NO original for the unrestorable cell — a rounded value must not become the original of record',
      global.__ri2_DR_STORE.getTableOriginal(table3, dataCell3), undefined);
    eq('re-injection sidebar apply: exactly one state:applyBlocked notice is sent',
      sentMessages.filter((m) => m.action === 'state:applyBlocked').length, 1);
    eq('re-injection sidebar apply: the state:applyBlocked notice carries the unrestorable-cell count',
      (sentMessages.find((m) => m.action === 'state:applyBlocked') || {}).count, 1);
    eq('re-injection sidebar apply: no state:applyOk — the apply was refused',
      sentMessages.some((m) => m.action === 'state:applyOk'), false);
    eq('re-injection sidebar apply: no state:rangeOk/state:rangeError — roundTable never ran',
      sentMessages.some((m) => m.action === 'state:rangeOk' || m.action === 'state:rangeError'), false);

    // --- Scenario D (issue #262): the on-page pill on a locked table. A
    // table is locked when it shows cells wearing dr-ext-rounded that the
    // registry has no record for — the post-re-injection state. The pill
    // must render selected AND locked on arrival (before any interaction):
    // aria-pressed 'true' because the screen shows simplified text,
    // aria-disabled 'true' plus a hover title because nothing here can
    // change it. A table instance 2 rounded ITSELF (registry records
    // present) must stay a normal, unlocked pill — the lock keys on
    // missing records, not on "rounded". ---
    const stub5 = makeMockButton();
    global.__ri2_tableToggles.set(table5, stub5);
    global.__ri2_syncSwitchForTable(table5);

    eq('re-injection pill: locked table renders selected on arrival (screen shows simplified text)',
      stub5.getAttribute('aria-pressed'), 'true');
    eq('re-injection pill: locked table renders aria-disabled',
      stub5.getAttribute('aria-disabled'), 'true');
    eq('re-injection pill: locked table carries the locked marker class',
      stub5.classList.contains('dr-ext-morph-locked'), true);
    eq('re-injection pill: locked table explains itself on hover',
      typeof stub5.title === 'string' && stub5.title.includes('Reload the page'), true);

    const stub6 = makeMockButton();
    global.__ri2_tableToggles.set(table6, stub6);
    global.__ri2_syncSwitchForTable(table6);
    eq('re-injection pill: an unrounded table renders unselected',
      stub6.getAttribute('aria-pressed'), 'false');
    eq('re-injection pill: an unrounded table is not locked',
      stub6.getAttribute('aria-disabled'), null);

    global.__ri2_roundTable(table6, DR_DEFAULTS);
    global.__ri2_syncSwitchForTable(table6);
    eq('re-injection pill: a table THIS instance rounded renders selected',
      stub6.getAttribute('aria-pressed'), 'true');
    eq('re-injection pill: a table THIS instance rounded is NOT locked — its registry records exist',
      stub6.getAttribute('aria-disabled'), null);
    eq('re-injection pill: a table THIS instance rounded carries no locked class',
      stub6.classList.contains('dr-ext-morph-locked'), false);

    // --- Scenario E (issue #262): toggle clicks on a locked table must not
    // oscillate the pillbox. Before the fix, alternating clicks flipped
    // appliedFlag between 'simplified' and 'original' (both restore branches
    // no-op on cells without registry records), so the pillbox toggled
    // visually while the table never changed, and state:tableEnabledChanged
    // carried enabled:false to the sidebar under a visibly simplified
    // table. ---
    const stub2 = makeMockButton();
    global.__ri2_tableToggles.set(table2, stub2);
    sentMessages.length = 0;

    global.__ri2_DR_BUS.publish('intent:toggleTable', { table: table2 });
    eq('re-injection toggle click 1: appliedFlag stays \'simplified\' — the truthful state',
      global.__ri2_DR_STORE.getTableAppliedFlag(table2), 'simplified');
    eq('re-injection toggle click 1: the pill stays selected',
      stub2.getAttribute('aria-pressed'), 'true');

    global.__ri2_DR_BUS.publish('intent:toggleTable', { table: table2 });
    eq('re-injection toggle click 2: appliedFlag still \'simplified\' — no oscillation',
      global.__ri2_DR_STORE.getTableAppliedFlag(table2), 'simplified');
    eq('re-injection toggle click 2: the pill still selected — no oscillation',
      stub2.getAttribute('aria-pressed'), 'true');
    eq('re-injection toggle clicks: the pill is locked',
      stub2.getAttribute('aria-disabled'), 'true');
    eq('re-injection toggle clicks: displayed text never changed',
      dataCell2.innerText, roundedText2);
    eq('re-injection toggle clicks: the title still holds the true original',
      dataCell2.title, roundedTitle2);

    const toggleStates = sentMessages.filter((m) => m.action === 'state:tableEnabledChanged');
    // Issue #272 changed this contract: state:tableEnabledChanged reports the RECORD's
    // enabled — the value the click wrote — not the stuck table's display
    // state. The first click is a rebind (table3 was selected) and sends no
    // toggle-state; the second click asks to turn the stuck table off, so the
    // record and the message both go false. The panel guards its own display:
    // under the #262 lock (this table's state:applyBlocked lands first) the forced
    // ON is display-only and the record's value goes to the lock's stash —
    // pinned by the issue272 sidebar-harness tests below.
    eq('re-injection toggle clicks: state:tableEnabledChanged reports the record — off, as the click asked',
      toggleStates.map((m) => m.enabled), [false]);
    eq('re-injection toggle clicks: the record holds the user\'s off, even though the stuck table cannot change',
      global.__ri2_DR_STORE.getSettings().enabled, false);
    const actionSeq = sentMessages.map((m) => m.action);
    eq('re-injection toggle clicks: the blocked click\'s state:applyBlocked precedes its toggle-state — the panel locks before the record value lands in its stash',
      actionSeq.lastIndexOf('state:applyBlocked') !== -1 &&
      actionSeq.indexOf('state:tableEnabledChanged') !== -1 &&
      actionSeq.lastIndexOf('state:applyBlocked') < actionSeq.indexOf('state:tableEnabledChanged'), true);
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
    roundTable({ rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} }, supTestOpts);
    eq('bracketed: the digits round and the brackets stay in their own pieces',
      cell._textNodes.map((n) => n.nodeValue), ['(', '1,000', ')']);
  });
})();

(function bracketedCellKeepsItsCurrencySign() {
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '$(1,234)' }]);
    roundTable({ rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} }, supTestOpts);
    eq('bracketed: a currency sign outside the brackets stays put',
      cell._textNodes[0].nodeValue, '$(1,000)');
  });
})();

// --- The sign reaches the max magnitude ---

(function bracketedNumberSetsTheMaxMagnitude() {
  withSupCreateTreeWalker(function() {
    const big = makeExtractedCell([{ text: '(12,345)' }]);
    const small = makeExtractedCell([{ text: '678' }]);
    const table = { rows: [{ cells: [big, small] }], querySelector: () => null, dataset: {} };
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
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function bracketedStackedGridCellRoundsWithWordsOff() {
  const grid = makeE2EGridWrapper([['4.91', '(125)(126)']]);
  const stacked = grid.cellEls[1];
  setGridCellPieces(stacked, [makeTextNode('(125)'), makeTextNode('(126)')]);
  try {
    roundTable(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells: false }));
    eq('bracketed: a stacked grid cell of bracketed numbers rounds with the words setting off',
      gridCellTextPieces(stacked).map((node) => node.nodeValue), ['(150)', '(150)']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// --- The lens preview carries the sign ---

(function bracketedNumberReachesTheLensPreviewAsNegative() {
  const grid = makeE2EGridWrapper([['4.91', '(5,432.1)']]);
  const bracketed = grid.cellEls[1];
  setGridCellPieces(bracketed, [makeTextNode('('), makeTextNode('5,432.1'), makeTextNode(')')]);
  try {
    eq('bracketed: the lens preview pool reads the raw cell as a negative',
      collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((cell) => cell.num), [4.91, -5432.1]);
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('bracketed: the lens preview pool still reads it as a negative once rounded',
      collectNumericCells(grid.wrapperEl, PATCH_GRID_OPTS).map((cell) => cell.num), [4.91, -5432.1]);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// --- The first-column exclusion falls on the label column ---

(function theFirstColumnExclusionFollowsTheGridColumn() {
  withCreateTreeWalker(function () {
    const table = makeMergedSpanTable();
    roundTable(table, Object.assign({}, DR_DEFAULTS));
    eq('#330: the cell after a downward merge is not read as the first column',
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
    eq('#330: the merged table rounds its first data row like the unmerged one',
      textsOf(merged, 1), textsOf(unmerged, 1));
    eq('#330: the merged table rounds its second data row like the unmerged one',
      textsOf(merged, 2), textsOf(unmerged, 2).slice(1));
  });
})();

// =============================================================================
// Issue #421: cells the page rewrites
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
// rows, and a pass writes a debug row of its own.
const rwLogged = [];

DR_LOG.onRow((row) => rwLogged.push(row));

const rwRows = (level, pattern) => rwLogged
  .filter((row) => row.level === level && pattern.test(row.text)).length;

const RW_CAP_ROW = /more than the .* the extension follows/;

// --- Test 1: a cell the extension holds, unchanged: the pass writes nothing. ---
(function rewrite01_aHeldCellTakesNoWrite() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    const held = t.pieces(0, 1)[0];
    const writesBefore = held.writes;
    t.write(1, 0, '4,321');
    page.settle();
    eq(`#421 held cell (${kind}): the pass ran on the page edit elsewhere in the table`,
      t.text(1, 0), '4,300');
    eq(`#421 held cell (${kind}): the pass writes nothing into a held cell`,
      { text: t.text(0, 1), writes: held.writes - writesBefore }, { text: '5,700', writes: 0 });
  });
})();

// --- Test 2: a piece the page redrew to its original takes the patch again. ---
(function rewrite02_aPieceRedrawnToItsOriginalTakesThePatchAgain() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    t.write(0, 0, '1,234');
    page.settle();
    eq(`#421 redraw (${kind}): a piece redrawn to its original shows the simplified value again`,
      t.text(0, 0), '1,200');
    eq(`#421 redraw (${kind}): the stored original stays the original`,
      DR_STORE.getTableOriginalText(t.table, t.cell(0, 0)), '1,234');
  });
})();

// --- Test 3: a native table gains a row with a larger value. The cells the
// extension holds take the new rounding, and their stored originals stay the
// true originals. ---
(function rewrite03_aNativeTableThatGainsALargerValueRoundsAgain() {
  eachRewriteKind(['native'], (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    eq('#421 larger value (native, precondition): the first simplification rounds at magnitude 3',
      t.rowTexts(), [['1,200', '5,700'], ['2,500', '3,600']]);
    t.addRow(['98,765', '1,111']);
    page.settle();
    eq('#421 larger value (native): every cell takes the rounding of the new max magnitude',
      t.rowTexts(), [['1,000', '6,000'], ['2,000', '4,000'], ['99,000', '1,000']]);
    eq('#421 larger value (native): the stored originals stay the true originals',
      [t.cell(0, 0), t.cell(0, 1), t.cell(1, 0), t.cell(1, 1)]
        .map((cell) => DR_STORE.getTableOriginalText(t.table, cell)),
      ['1,234', '5,678', '2,468', '3,579']);
  });
})();

// --- Test 4: the page writes a new number. The cell simplifies it, and a
// restore puts back the new number. ---
(function rewrite04_aNewNumberSimplifiesAndRestoresToItself() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    t.write(0, 0, '4,321');
    page.settle();
    eq(`#421 new number (${kind}): the cell simplifies the page's new value`, t.text(0, 0), '4,300');
    eq(`#421 new number (${kind}): the stored original is the page's new value`,
      DR_STORE.getTableOriginalText(t.table, t.cell(0, 0)), '4,321');
    resetTable(t.table);
    eq(`#421 new number (${kind}): a restore puts back the page's new value`, t.text(0, 0), '4,321');
  });
})();

// --- Test 5: the page writes a number that needs no rounding. The marker and
// the stored originals go, and a restore leaves the page's number. ---
(function rewrite05_anAlreadyRoundNumberReleasesTheCell() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    t.write(0, 0, '100');
    page.settle();
    eq(`#421 round number (${kind}): the cell shows the page's number`, t.text(0, 0), '100');
    eq(`#421 round number (${kind}): the marker and the stored originals go`,
      { marked: t.cell(0, 0).classList.contains('dr-ext-rounded'),
        stored: DR_STORE.hasTableOriginal(t.table, t.cell(0, 0)) },
      { marked: false, stored: false });
    resetTable(t.table);
    eq(`#421 round number (${kind}): a restore leaves the page's number`, t.text(0, 0), '100');
  });
})();

// --- Test 6: the page writes text that is not a number. The cell is
// released, its hover text goes, and the page's text stays. ---
(function rewrite06_aWordReleasesTheCell() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    t.write(0, 0, 'pending');
    page.settle();
    eq(`#421 word (${kind}): the cell is released and keeps the page's text`,
      { text: t.text(0, 0), marked: t.cell(0, 0).classList.contains('dr-ext-rounded'),
        stored: DR_STORE.hasTableOriginal(t.table, t.cell(0, 0)), title: t.cell(0, 0).title },
      { text: 'pending', marked: false, stored: false, title: '' });
    resetTable(t.table);
    eq(`#421 word (${kind}): a restore leaves the page's text`, t.text(0, 0), 'pending');
  });
})();

// --- Test 7: the page rewrites one piece of a cell with several pieces. The
// other pieces show their original text again before the cell simplifies
// fresh, so the stored originals hold no text the extension wrote. ---
(function rewrite07_onePieceOfSeveralRewritten() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTable(t.table, RW_OPTS);
    eq(`#421 one piece (${kind}, precondition): both numbers of the cell round`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['1,200', ' to ', '5,700']);
    t.write(0, 0, '2,222', 0);
    page.settle();
    eq(`#421 one piece (${kind}): the cell simplifies the page's new value and its other piece`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['2,200', ' to ', '5,700']);
    eq(`#421 one piece (${kind}): the stored originals hold no extension-written text`,
      ((DR_STORE.getTableOriginal(t.table, t.cell(0, 0)) || {}).pieces || []).map((p) => p.text),
      ['2,222', ' to ', '5,678']);
  });
})();

// --- Test 8: a grid value above the frozen scale. The magnitude freeze
// stays, and the value takes the largest-value rounding. ---
(function rewrite08_aGridValueAboveTheFrozenScale() {
  eachRewriteKind(['grid'], (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    t.write(0, 0, '98,765');
    page.settle();
    eq('#421 above the freeze (grid): the value takes the largest-value rounding',
      t.text(0, 0), '99,000');
    eq('#421 above the freeze (grid): the magnitude freeze stays',
      DR_STORE.getTableMaxMagnitude(t.table), 3);
    eq('#421 above the freeze (grid): the other cells keep their rounding',
      t.rowTexts(), [['99,000', '5,700'], ['2,500', '3,600']]);
  });
})();

// --- Test 9: a grid that reuses its cell elements for other rows on scroll.
// Each reused cell simplifies the new row's value, and a restore puts back
// that value, never the previous row's. ---
(function rewrite09_aReusedGridCellShowsItsNewRow() {
  eachRewriteKind(['grid'], (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    const scrolled = [['4,321', '8,765'], ['6,543', '7,654']];
    scrolled.forEach((row, r) => row.forEach((text, c) => t.write(r, c, text)));
    page.settle();
    eq('#421 reused cells (grid): every reused cell simplifies the new row\'s value',
      t.rowTexts(), [['4,300', '8,800'], ['6,500', '7,700']]);
    resetTable(t.table);
    eq('#421 reused cells (grid): a restore puts back the new rows\' values',
      t.rowTexts(), scrolled);
  });
})();

// --- Test 11: the extension's own writes, a restore included, run no pass,
// and a burst of page edits runs one pass. ---
(function rewrite11_ownWritesRunNoPassAndABurstRunsOne() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    page.settle();
    eq(`#421 own writes (${kind}): the first simplification runs no pass`, page.passes(), 0);
    t.write(0, 0, '4,321');
    t.write(0, 1, '8,765');
    t.write(1, 0, '6,543');
    page.settle();
    eq(`#421 own writes (${kind}): a burst of page edits runs one pass`,
      { passes: page.passes(), texts: t.rowTexts() },
      { passes: 1, texts: [['4,300', '8,800'], ['6,500', '3,600']] });
    page.settle();
    eq(`#421 own writes (${kind}): the pass's own writes run no further pass`, page.passes(), 1);
    resetTable(t.table);
    page.settle();
    eq(`#421 own writes (${kind}): a restore runs no pass`, page.passes(), 1);
  });
})();

// --- Test 12: an added row simplifies, on each kind. ---
(function rewrite12_anAddedRowSimplifies() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    t.addRow(['4,321', '8,765']);
    page.settle();
    eq(`#421 added row (${kind}): the added row simplifies`,
      t.rowTexts()[2], ['4,300', '8,800']);
  });
})();

// --- Test 13: a restore before any pass has run, after the page rewrote one
// piece of a cell. The page's text stays, and the untouched pieces show
// their originals. ---
(function rewrite13_aRestoreBeforeAnyPassKeepsThePagesText() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTable(t.table, RW_OPTS);
    t.write(0, 0, '2,222', 0);
    t.write(1, 1, '9,999');
    resetTable(t.table);
    eq(`#421 early restore (${kind}): the rewritten piece keeps the page's text, and the untouched piece shows its original`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['2,222', ' to ', '5,678']);
    eq(`#421 early restore (${kind}): a cell the page rewrote whole keeps the page's text`,
      t.text(1, 1), '9,999');
    eq(`#421 early restore (${kind}): the cells the extension held show their originals`,
      [t.text(0, 1), t.text(1, 0)], ['2,468', '3,579']);
    eq(`#421 early restore (${kind}): every cell restores, so the form is raw`,
      DR_STORE.getTableAppliedFlag(t.table), 'original');
  });
})();

// --- Test 14: the cell cap. A table one cell over the cap writes nothing,
// its watcher stops, and one warning row records it. A table at the cap runs
// its pass. A table over the cap at its first simplification never attaches
// a watcher. ---
(function rewrite14_theCellCap() {
  const savedCap = DR_DETECTION_SETTINGS.reapplyCellCap;
  DR_DETECTION_SETTINGS.reapplyCellCap = 4;
  try {
    eachRewriteKind(RW_KINDS, (kind, page, build) => {
      const t = build(RW_ROWS);
      roundTable(t.table, RW_OPTS);
      t.write(0, 0, '4,321');
      page.settle();
      eq(`#421 cell cap (${kind}): a table at the cap runs its pass`, t.text(0, 0), '4,300');

      const rowsBefore = rwRows('debug', RW_CAP_ROW);
      t.addRow(['8,765']);
      t.write(0, 1, '6,543');
      page.settle();
      eq(`#421 cell cap (${kind}): a pass over the cap writes nothing`,
        [t.text(0, 1), t.rowTexts()[2][0]], ['6,543', '8,765']);
      eq(`#421 cell cap (${kind}): one debug row records the stop`, rwRows('debug', RW_CAP_ROW) - rowsBefore, 1);
      t.write(1, 0, '7,654');
      page.settle();
      eq(`#421 cell cap (${kind}): the stopped watcher runs no later pass`, t.text(1, 0), '7,654');

      const big = build(RW_ROWS.concat([['9,876']]));
      const rowsAtFirst = rwRows('debug', RW_CAP_ROW);
      roundTable(big.table, RW_OPTS);
      eq(`#421 cell cap (${kind}): the first simplification over the cap still simplifies`,
        big.text(2, 0), '9,900');
      eq(`#421 cell cap (${kind}): the first simplification over the cap records one debug row`,
        rwRows('debug', RW_CAP_ROW) - rowsAtFirst, 1);
      eq(`#421 cell cap (${kind}): the cap writes no warn row, so it raises no toast`,
        rwRows('warn', RW_CAP_ROW), 0);
      big.write(0, 0, '4,321');
      page.settle();
      eq(`#421 cell cap (${kind}): a table over the cap at its first simplification runs no pass`,
        big.text(0, 0), '4,321');
    });
  } finally {
    DR_DETECTION_SETTINGS.reapplyCellCap = savedCap;
  }
})();

// --- Test 15: page edits arriving faster than the redraw delay. A pass runs
// once the burst reaches the longest wait. ---
(function rewrite15_aBurstThatNeverGoesQuietStillRunsAPass() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    roundTable(t.table, RW_OPTS);
    const start = page.now();
    let firstPassAt = null;
    for (let step = 0; step < 20; step++) {
      t.write(1, 1, step % 2 === 0 ? '4,321' : '4,322');
      page.advance(50);
      if (firstPassAt === null && page.passes() > 0) firstPassAt = page.now() - start;
    }
    eq(`#421 longest wait (${kind}): a pass runs within the longest wait of the burst's start`,
      firstPassAt !== null && firstPassAt <= 1000, true);
    eq(`#421 longest wait (${kind}): that pass simplifies the page's value`, t.text(1, 1), '4,300');
  });
})();

// --- Test 16: a native cell with a link, a superscript, and several text
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
    roundTable(t.table, RW_OPTS);
    eq('#421 piece restore (native, precondition): the number outside the link rounds, the link and the superscript hold',
      t.pieces(0, 0).map((p) => p.nodeValue), ['Total ', 'note 12', ', ', '9,900', ' kg', '2']);
    const writesBefore = cell.innerHTMLWrites;
    resetTable(t.table);
    eq('#421 piece restore (native): the markup after the restore matches the markup before simplification',
      cell.innerHTML, markupBefore);
    eq('#421 piece restore (native): the restore writes no markup, so every text piece keeps its node',
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
    roundTable(t.table, RW_OPTS);
    eq('#421 rendered text (native): the first simplification reads no rendered text after a write',
      { readsAfterAWrite, rows: t.rowTexts() },
      { readsAfterAWrite: 0, rows: [['1,200', '5,700'], ['2,500', '3,600']] });
  });
})();

// Issue #423: a grid cell the page redraws with fewer text pieces is a
// rewritten cell. It drops its originals and simplifies fresh, so a restore
// never stops on it and the table never locks over it.
(function rewrite423_aCellRedrawnWithFewerPiecesSimplifiesFresh() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '1,234' }, ' to ', { tag: 'b', text: '5,678' }], '2,468'],
      ['3,579', '4,321'],
    ]);
    roundTable(t.table, RW_OPTS);
    t.redraw(0, 0, '8,765');
    page.settle();
    eq(`#423 fewer pieces (${kind}): the redrawn cell simplifies its new value`, t.text(0, 0), '8,800');
    eq(`#423 fewer pieces (${kind}): the stored original is the redrawn value`,
      DR_STORE.getTableOriginalText(t.table, t.cell(0, 0)), '8,765');
    const unrestorable = resetTable(t.table);
    eq(`#423 fewer pieces (${kind}): the restore counts no cell unrestorable and puts back the redrawn value`,
      { unrestorable, text: t.text(0, 0), form: DR_STORE.getTableAppliedFlag(t.table) },
      { unrestorable: 0, text: '8,765', form: 'original' });
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
    roundTable(t.table, RW_OPTS);
    eq(`#421 extra piece (${kind}, precondition): the first simplification rounds the bold number`,
      t.text(0, 0), '1,600,000 units');
    t.redraw(0, 0, [{ tag: 'b', text: '1,600,000' }, ' units', { tag: 'i', text: ' est.' }]);
    page.settle();
    const record = DR_STORE.getTableOriginal(t.table, t.cell(0, 0));
    eq(`#421 extra piece (${kind}): the pass simplifies the cell from its true original`,
      { text: t.text(0, 0), original: DR_STORE.getTableOriginalText(t.table, t.cell(0, 0)),
        storedTexts: record && record.pieces.map((piece) => piece.text) },
      { text: '1,600,000 units est.', original: '1,613,245 units est.',
        storedTexts: ['1,613,245', ' units', ' est.'] });
    resetTable(t.table);
    eq(`#421 extra piece (${kind}): a restore shows the true original`, t.text(0, 0), '1,613,245 units est.');
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
    roundTable(t.table, RW_OPTS);
    eq(`#421 duplicate written text (${kind}, precondition): both numbers show the same rounded text`,
      t.text(0, 0), '1,600,000 to 1,600,000');
    t.redraw(0, 0, [{ tag: 'b', text: '1,600,000' }, ' to ', { tag: 'b', text: '1,600,000' },
      { tag: 'i', text: ' est.' }]);
    const unrestorable = resetTable(t.table);
    eq(`#421 duplicate written text (${kind}): a restore before any pass puts each original back in order`,
      { unrestorable, text: t.text(0, 0) }, { unrestorable: 0, text: '1,613,245 to 1,587,002 est.' });
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
    roundTable(t.table, RW_OPTS);
    t.redraw(0, 0, '8,765');
    const unrestorable = resetTable(t.table);
    eq(`#423 fewer pieces, early restore (${kind}): the page's text stays and nothing counts unrestorable`,
      { unrestorable, text: t.text(0, 0), marked: t.cell(0, 0).classList.contains('dr-ext-rounded') },
      { unrestorable: 0, text: '8,765', marked: false });
  });
})();
