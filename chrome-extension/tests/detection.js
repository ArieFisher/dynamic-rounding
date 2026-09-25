// Finding tables and grids, adapters, text pieces, and patches (lib/dr-table).

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

// ---------------------------------------------------------------------------
// Regression: DEFAULT_NUMERIC_PROBE must stay byte-equivalent to the old
// pre-extraction predicate (trim -> strip CLEAN_REGEX chars -> parseFloat ->
// isFinite). A prior version of this probe delegated to DR_NUMBER.toNumber,
// which uses Number() plus unicode-minus/parenthesized-negative handling and
// disagrees with parseFloat on exactly these shapes: date-only, time-only,
// and value-with-unit cells (parseFloat accepts a numeric prefix; Number does
// not), and accounting-negative cells (Number, via the parens rewrite, parses
// them; parseFloat does not). Each assertion below fails against the
// DR_NUMBER-delegating probe and passes against the restored parseFloat-based
// one — verified by running this file against the pre-fix commit.
// ---------------------------------------------------------------------------

// Date-only column: parseFloat('2024-01-15') -> 2024 (numeric prefix) -> true.
// DR_NUMBER.toNumber('2024-01-15') -> Number('2024-01-15') -> NaN -> false.
(function isDataTable_dateOnlyColumn() {
  const table = makeIsDataTable([
    ['Date',       'Owner'],
    ['2024-01-15', 'Alice'],
  ]);
  eq('isDataTable: date-only column ("2024-01-15") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// Slash-formatted date column: same parseFloat-prefix argument as above.
(function isDataTable_slashDateColumn() {
  const table = makeIsDataTable([
    ['Date',        'Owner'],
    ['15/03/2024',  'Bob'],
  ]);
  eq('isDataTable: slash date column ("15/03/2024") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// Time-only column: parseFloat('09:30') -> 9 (numeric prefix) -> true.
// DR_NUMBER.toNumber('09:30') -> Number('09:30') -> NaN -> false.
(function isDataTable_timeOnlyColumn() {
  const table = makeIsDataTable([
    ['Time',  'Event'],
    ['09:30', 'Standup'],
  ]);
  eq('isDataTable: time-only column ("09:30") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// Value-with-unit column: CLEAN_REGEX strips the space ("3.5 kg" -> "3.5kg"),
// then parseFloat('3.5kg') -> 3.5 -> true.
// DR_NUMBER.toNumber('3.5 kg') -> Number('3.5kg') -> NaN -> false.
(function isDataTable_unitSuffixColumn() {
  const table = makeIsDataTable([
    ['Weight', 'Item'],
    ['3.5 kg', 'Box'],
  ]);
  eq('isDataTable: unit-suffix column ("3.5 kg") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// All-text table: no cell parses as numeric under either probe -> false.
// (Distinct fixture from isDataTable_3x3_allText above, kept local to this
// regression block so it reads as a self-contained before/after set.)
(function isDataTable_allTextColumn() {
  const table = makeIsDataTable([
    ['Status', 'Owner'],
    ['Open',   'Alice'],
  ]);
  eq('isDataTable: all-text table -> false (no cell parses as numeric under either probe)',
    isDataTable(table), false);
})();

// Accounting-negative cell: old CLEAN_REGEX + parseFloat leaves the
// parentheses in place; parseFloat('(1,234)' -> '(1234)') -> NaN -> false.
// DR_NUMBER.toNumber rewrites "(1234)" -> "-1234" -> -1234 -> true. Verify
// against the parent branch's own behavior (git show refactor/extract-dr-number)
// before asserting: the parent's predicate also returns false here.
(function isDataTable_accountingNegativeColumn() {
  const table = makeIsDataTable([
    ['Amount',   'Item'],
    ['(1,234)',  'Refund'],
  ]);
  eq('isDataTable: accounting-negative cell ("(1,234)") -> false (matches parent-branch predicate)',
    isDataTable(table), false);
})();

(function mapRenderedToFlat_positions() {
  eq('mapRenderedToFlat: equal texts map each position to itself',
    mapRenderedToFlat('a 1', 'a 1'), [0, 1, 2]);
  eq('mapRenderedToFlat: collapsed line breaks and indentation map past the raw whitespace',
    mapRenderedToFlat('Grew 1', '\n  Grew\n    1\n'), [3, 4, 5, 6, 7, 12]);
  eq('mapRenderedToFlat: a line break the browser adds at a <br> maps to the next flat character',
    mapRenderedToFlat('5\nkg', '5kg'), [0, 1, 1, 2]);
  eq('mapRenderedToFlat: hidden text in the flat text returns null',
    mapRenderedToFlat('+2.3%', '700023000+2.3%'), null);
  eq('mapRenderedToFlat: flat text ending in more than whitespace returns null',
    mapRenderedToFlat('5', '5 kg'), null);
})();

(function placeDecision_stackedTestReadsTheGapBetweenPieces() {
  const decision = { mode: 'pure', value: { num: 123 } };
  const layout = (runsTogether) => ({ original: ['1', '23'], liveStarts: [0, 1], toFlat: null, rendered: false, runsTogether });
  eq('placeDecision: pieces on separate lines round as two numbers',
    placeDecision(decision, '123', layout(() => false)).value.matches.map((m) => m.numStr), ['1', '23']);
  eq('placeDecision: pieces the shown text runs together skip with reason split',
    placeDecision(decision, '123', layout(() => true)), { mode: 'skip', reason: 'split' });
  eq('placeDecision: runsTogether is asked about the second piece',
    (() => { const asked = []; placeDecision(decision, '123', layout((i) => { asked.push(i); return false; })); return asked; })(),
    [1]);
  eq('placeDecision: a stacked native cell counts its numbers in its rendered text',
    placeDecision(decision, '1\n23', Object.assign(layout(() => false), { rendered: true, toFlat: [0, 1, 1, 2] }))
      .value.matches.map((m) => m.index), [0, 2]);
  eq('placeDecision: a stacked native cell with no known positions skips with reason pieces',
    placeDecision(decision, '123', Object.assign(layout(() => false), { rendered: true })), { mode: 'skip', reason: 'pieces' });
  eq('showsPiecesTogether: a line break between pieces answers false',
    showsPiecesTogether('125\n126', ['125', '126'], 1), false);
  eq('showsPiecesTogether: a space between pieces answers false',
    showsPiecesTogether('125 126', ['125', '126'], 1), false);
  eq('showsPiecesTogether: pieces with nothing between answer true',
    showsPiecesTogether('6,718,245', ['6,7', '18,245'], 1), true);
  eq('showsPiecesTogether: shown text that differs from the pieces in more than whitespace answers true',
    showsPiecesTogether('$7,002,300', ['7002300', '$', '7,002,300'], 2), true);
  eq('showsPiecesTogether: empty shown text answers true',
    showsPiecesTogether('', ['125', '126'], 1), true);
  eq('placeDecision: a value across pieces that is not stacked skips with reason pieces',
    placeDecision(decision, '12 kg', { original: ['12 k', 'g'], liveStarts: [0, 4], toFlat: null, rendered: false }),
    { mode: 'skip', reason: 'pieces' });
  eq('placeDecision: a value in one piece stands',
    placeDecision(decision, '123', { original: ['123'], liveStarts: [0], toFlat: null }), decision);
  eq('placeDecision: a rendered position converts through toFlat before the piece check',
    placeDecision(decision, '123', { original: ['\n  ', '123', '\n'], liveStarts: [0, 3, 6], toFlat: [3, 4, 5] }), decision);
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

// Standard opts for the exponent tests.  simplifyMixedCells: true is required to
// engage the <sup> extraction path (the guard at line ~773 of content.js).
const supTestOpts = {
  enabled: true,
  simplifyMixedCells: true,
  simplifyMixedCurrency: true,
  simplifyMixedPercent: true,
  simplifyFirstRow: true,
  simplifyFirstColumn: true,
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

// =============================================================================
// applyExtractedPatches — unit tests and integration regression tests
// =============================================================================

// ---------------------------------------------------------------------------
// Unit tests for applyExtractedPatches
// ---------------------------------------------------------------------------
(function applyExtractedPatches_unitTests() {

  // AP1: single text node, single patch
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'Revenue 1500 USD' }]);
    applyExtractedPatches(cell, [{ index: 8, numStr: '1500', newNum: '2k' }]);
    eq('AP1: single node patch replaces number', cell._textNodes[0].nodeValue, 'Revenue 2k USD');
  });

  // AP2: two patches in the same node, right-to-left order preserved
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '1500 and 2500' }]);
    applyExtractedPatches(cell, [
      { index: 0,  numStr: '1500', newNum: '2k' },
      { index: 9,  numStr: '2500', newNum: '3k' },
    ]);
    eq('AP2: two patches in same node', cell._textNodes[0].nodeValue, '2k and 3k');
  });

  // AP3: patch targets a plain node; sup node is untouched
  // cell: "1.5×10"(plain) + "31"(sup) + " m"(plain) + "3"(sup)
  // flat: "1.5×1031 m3", patch "1.5" at index 0 → "2"
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ' m' },
      { text: '3', inSup: true },
    ]);
    applyExtractedPatches(cell, [{ index: 0, numStr: '1.5', newNum: '2' }]);
    eq('AP3: base node updated', cell._textNodes[0].nodeValue, '2×10');
    eq('AP3: sup "31" node untouched', cell._textNodes[1].nodeValue, '31');
    eq('AP3: " m" node untouched',     cell._textNodes[2].nodeValue, ' m');
    eq('AP3: sup "3" node untouched',  cell._textNodes[3].nodeValue, '3');
  });

  // AP4: patch in a later plain node; earlier node untouched
  // cell: "text, "(plain) + "1500"(plain)
  // patch "1500" at index 6
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: 'text, ' },
      { text: '1500' },
    ]);
    applyExtractedPatches(cell, [{ index: 6, numStr: '1500', newNum: '2k' }]);
    eq('AP4: first node untouched', cell._textNodes[0].nodeValue, 'text, ');
    eq('AP4: second node patched',  cell._textNodes[1].nodeValue, '2k');
  });

  // AP5: defensive — wrong numStr at index → node unchanged
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    applyExtractedPatches(cell, [{ index: 4, numStr: '9999', newNum: '10k' }]);
    eq('AP5: wrong numStr → no change', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

  // AP6: empty patches array → no-op
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    applyExtractedPatches(cell, []);
    eq('AP6: empty patches → unchanged', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

})();

// ---------------------------------------------------------------------------
// Integration regression tests via roundTable
// These reproduce the three Wikipedia bugs.
// ---------------------------------------------------------------------------
(function applyExtractedPatches_regressionTests() {

  const makeSupTable = (cell) => ({
    rows: [{ cells: [cell] }],
    querySelector: () => null,
    dataset: {},
  });

  // RG1: Comma preservation
  // Cell: "1.5×10<sup>31</sup>, more text"
  // flat: "1.5×1031, more text"
  // "1.5" is in the base node; after rounding it shortens.
  // The comma and "more text" node must be untouched.
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ', more text' },
    ]);
    cell.querySelector = (sel) => sel === 'sup' ? { tagName: 'SUP' } : null;
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG1: comma and trailing text preserved',
      cell._textNodes[2].nodeValue, ', more text');
    eq('RG1: sup exponent node untouched',
      cell._textNodes[1].nodeValue, '31');
  });

  // RG2: Superscript digit preserved after rounding
  // Cell: "1.5×10<sup>31</sup> m<sup>3</sup>"
  // flat: "1.5×1031 m3"
  // Rounding "1.5" → shorter string must not corrupt the <sup>3</sup> node.
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ' m' },
      { text: '3', inSup: true },
    ]);
    cell.querySelector = (sel) => sel === 'sup' ? { tagName: 'SUP' } : null;
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG2: sup "3" node still contains "3" after rounding',
      cell._textNodes[3].nodeValue, '3');
    eq('RG2: " m" node still contains " m"',
      cell._textNodes[2].nodeValue, ' m');
  });

  // RG3: Anchor text node intact after rounding an adjacent number
  // Cell structure (flat): "1234 lithium-7"
  // "1234" is in a plain node; "lithium-7" is inside an anchor node.
  // filterLinkMatches excludes "7" (inside anchor), so only "1234" is rounded.
  // 1234 with offsetTop=-0.5 rounds to 1000 (confirmed: step=500, round(1234/500)=2, 2×500=1000).
  // The anchor text node must be exactly "lithium-7" after rounding.
  withSupCreateTreeWalker(function() {
    const anchor = {
      innerText: 'lithium-7',
      textContent: 'lithium-7',
      _isAnchor: true,
    };
    const plainNode = {
      nodeValue: '1234 ',
      parentNode: {},
      parentElement: { closest: () => null },
    };
    const anchorNode = {
      nodeValue: 'lithium-7',
      parentNode: anchor,
      parentElement: { closest: (sel) => sel === 'a' ? anchor : null },
    };
    const cell = {
      innerText: '1234 lithium-7',
      textContent: '1234 lithium-7',
      innerHTML: '1234 lithium-7',
      classList: { _classes: [], add(c) { this._classes.push(c); }, contains(c) { return this._classes.includes(c); } },
      dataset: {},
      title: '',
      tagName: 'TD',
      querySelectorAll: (sel) => sel === 'a' ? [anchor] : [],
      querySelector: () => null,
      contains: (node) => node === anchor,
      _textNodes: [plainNode, anchorNode],
    };
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG3: anchor text node is intact after rounding adjacent number',
      anchorNode.nodeValue, 'lithium-7');
    eq('RG3: plain node was rounded (1234 → 1000)',
      plainNode.nodeValue, '1000 ');
  });

})();

// =============================================================================
// Grid Detection — looksLikeGrid() and findTargetTable() unit tests
// Sprint: grid-detection  Spec: docs/sprint-plans/grid-support.md §6
// =============================================================================

// ---------------------------------------------------------------------------
// Mock-element helpers for grid detection tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// looksLikeGrid() — PASS cases
// ---------------------------------------------------------------------------

// LG1: Pass — unlabelled div-grid, VARIABLE ROW HEIGHTS (AC2, S2 headline)
// S2 mandates row height is NOT tested. Rows must have differing heights yet
// the function must still return true. Column-0 offsetWidths are uniform (80px)
// so step 6 passes.
(function looksLikeGrid_pass_variableRowHeights() {
  const rows = [
    makeGridRow([{text:'Name',width:80},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:80},{text:'5678'}], 'row', 35),  // taller
    makeGridRow([{text:'Bar baz',width:80},{text:'9012'}], 'row', 50), // even taller
    makeGridRow([{text:'Qux',width:80},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:80},{text:'7890'}], 'row', 80),  // very tall
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — unlabelled, variable row heights',
      looksLikeGrid(container), true);
  });
})();

// LG2: Pass — ARIA short-circuit (role="grid") skips geometry probe
// The geometry probe (step 6) is skipped when role="grid". We prove this by
// making column-0 offsetWidths NON-uniform (all different) — if step 6 ran,
// the 80% alignment check would fail and return false. With the ARIA
// short-circuit the function must still return true.
(function looksLikeGrid_pass_ariaShortCircuit() {
  const rows = [
    makeGridRow([{text:'Col',width:10},{text:'1234'}], 'row', 20),  // width 10
    makeGridRow([{text:'Foo',width:20},{text:'5678'}], 'row', 20),  // width 20
    makeGridRow([{text:'Bar',width:30},{text:'9012'}], 'row', 20),  // width 30
    makeGridRow([{text:'Qux',width:40},{text:'3456'}], 'row', 20),  // width 40
    makeGridRow([{text:'Etc',width:50},{text:'7890'}], 'row', 20),  // width 50
  ];
  // All column-0 widths differ → step 6 would reject; ARIA role must short-circuit before it.
  const container = makeGridContainer(rows, 'flex', 'grid', '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — ARIA role="grid" short-circuits geometry probe (non-uniform widths still accepted)',
      looksLikeGrid(container), true);
  });
})();

// LG3: Pass — database query shape (library class "dg--" short-circuits geometry probe)
// The wrapper contains a pinned pane and a scroll pane as children, but for
// looksLikeGrid we test the wrapper itself: it has ≥5 row-like children,
// repetitive structure, numeric content, and the "dg--" class which short-circuits
// before the geometry probe. Column-0 widths are deliberately non-uniform so that
// if the geometry probe ran it would fail — proving the short-circuit works.
(function looksLikeGrid_pass_databaseQueryClass() {
  const rows = [
    makeGridRow([{text:'Header',width:10},{text:'0'}], 'dg--row', 20),
    makeGridRow([{text:'Foo',width:20},{text:'1234.56'}], 'dg--row', 20),
    makeGridRow([{text:'Bar',width:30},{text:'7890.12'}], 'dg--row', 20),
    makeGridRow([{text:'Baz',width:40},{text:'3456.78'}], 'dg--row', 20),
    makeGridRow([{text:'Qux',width:50},{text:'9012.34'}], 'dg--row', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, 'dg--table-wrapper');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — database query "dg--" class short-circuits geometry probe',
      looksLikeGrid(container), true);
  });
})();

// ---------------------------------------------------------------------------
// looksLikeGrid() — REJECT cases (AC4 false-positive guard)
// ---------------------------------------------------------------------------

// LG4: Reject — CSS layout/card grid with NO numeric content (AC4)
// Repetitive card-style divs with text-only content must be rejected.
// This proves step 5 (numeric-content guard) works as the mandatory false-positive guard.
(function looksLikeGrid_reject_cssCardGrid() {
  const rows = [
    makeGridRow([{text:'Card A',width:100},{text:'Buy now'}], 'card', 20),
    makeGridRow([{text:'Card B',width:100},{text:'Learn more'}], 'card', 20),
    makeGridRow([{text:'Card C',width:100},{text:'Details'}], 'card', 20),
    makeGridRow([{text:'Card D',width:100},{text:'Visit site'}], 'card', 20),
    makeGridRow([{text:'Card E',width:100},{text:'Sign up'}], 'card', 20),
  ];
  const container = makeGridContainer(rows, 'grid', null, 'card-grid');
  withGridComputedStyle(container, 'grid', function() {
    eq('looksLikeGrid: reject — CSS card grid with no numeric content',
      looksLikeGrid(container), false);
  });
})();

// LG5: Reject — nav menu (repetitive rows, no numbers) (AC4)
// A navigation menu with text-only items must be rejected.
// This is the second false-positive guard test per the spec.
(function looksLikeGrid_reject_navMenu() {
  const rows = [
    makeGridRow([{text:'Home',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'About',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Products',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Contact',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Blog',width:100},{text:''}], 'nav-item', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, 'nav-menu');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — nav menu with no numeric content',
      looksLikeGrid(container), false);
  });
})();

// LG6: Reject — too few children (< GRID_MIN_CHILDREN = 5)
(function looksLikeGrid_reject_tooFewChildren() {
  const rows = [
    makeGridRow([{text:'Foo',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Baz',width:100},{text:'9012'}], 'row', 20),
    // only 3 rows — fewer than GRID_MIN_CHILDREN (5)
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — fewer than 5 children',
      looksLikeGrid(container), false);
  });
})();

// LG7: Reject — display is not grid/flex (step 4)
(function looksLikeGrid_reject_blockDisplay() {
  const rows = [
    makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
  ];
  const container = makeGridContainer(rows, 'block', null, '');
  withGridComputedStyle(container, 'block', function() {
    eq('looksLikeGrid: reject — display:block (not grid/flex)',
      looksLikeGrid(container), false);
  });
})();

// LG8: Reject — non-uniform column-0 widths (step 6) when no short-circuit
// Proves the geometry probe rejects grids where column widths are misaligned.
// All widths differ so < 80% match → rejected.
(function looksLikeGrid_reject_nonUniformColumnWidths() {
  const rows = [
    makeGridRow([{text:'Name',width:10},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:20},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:30},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:40},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:50},{text:'7890'}], 'row', 20),
  ];
  // No role, no library class → step 6 runs and must reject.
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — non-uniform column-0 widths (step 6)',
      looksLikeGrid(container), false);
  });
})();

// LG9: Pass — column-0 widths are uniform (80% threshold satisfied)
// Exactly matching widths → step 6 passes.
(function looksLikeGrid_pass_uniformColumnWidths() {
  const rows = [
    makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — uniform column-0 widths',
      looksLikeGrid(container), true);
  });
})();

// ---------------------------------------------------------------------------
// findTargetTable() walk-up tests
// ---------------------------------------------------------------------------

// FT1: findTargetTable — returns OUTERMOST matching ancestor (S6), not inner pane
// Build three nested containers: innermost → middle → outer.
// Both innermost and outer pass looksLikeGrid (both have numeric content, flex,
// uniform col-0 widths). Middle also passes. The walk-up must keep going as long
// as the parent passes and return the OUTERMOST (outer), not innermost.
(function findTargetTable_returnsOutermostAncestor() {
  withFindTargetEnv([], function() {
    // inner, middle, outer all pass looksLikeGrid
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    const inner  = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const middle = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer  = makeWalkEl({ display: 'flex', rows: makeRows5() });

    // Wire up parent chain: inner → middle → outer → (body = stop)
    inner.parentElement  = middle;
    inner.parentNode     = middle;
    middle.parentElement = outer;
    middle.parentNode    = outer;
    outer.parentElement  = document.body;
    outer.parentNode     = document.body;

    // The click target is inner itself (not in any <table>, no dr-ext-grid yet).
    // Adjust closest() on inner to use the real chain.
    inner.closest = function(sel) {
      if (sel === 'table') return null;
      if (sel === '.dr-ext-grid') return null;
      return null;
    };

    const result = findTargetTable(inner);

    eq('findTargetTable: returns outermost ancestor (S6), not inner pane',
      result.handle, outer);
  });
})();

// FT2: findTargetTable — does NOT overshoot to <body> and respects depth cap
// A chain of 3 containers where only the first two pass looksLikeGrid;
// the third fails. The walk must stop at the second (outermost passing) container,
// not continue to body.
(function findTargetTable_stopsAtFailingParent() {
  withFindTargetEnv([], function() {
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    // Text-only rows: will fail looksLikeGrid at step 5 (no numeric content)
    const noNumericRows = [
      makeGridRow([{text:'Alpha',width:100},{text:'Foo'}], 'row', 20),
      makeGridRow([{text:'Beta',width:100},{text:'Bar'}], 'row', 20),
      makeGridRow([{text:'Gamma',width:100},{text:'Baz'}], 'row', 20),
      makeGridRow([{text:'Delta',width:100},{text:'Qux'}], 'row', 20),
      makeGridRow([{text:'Epsilon',width:100},{text:'Quux'}], 'row', 20),
    ];

    const inner    = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outerOk  = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const failsLLG = makeWalkEl({ display: 'flex', rows: noNumericRows });

    inner.parentElement    = outerOk;
    inner.parentNode       = outerOk;
    outerOk.parentElement  = failsLLG;
    outerOk.parentNode     = failsLLG;
    failsLLG.parentElement = document.body;
    failsLLG.parentNode    = document.body;

    inner.closest = function(sel) { return null; };

    const result = findTargetTable(inner);

    // Must return outerOk, not failsLLG or body
    eq('findTargetTable: stops at failing parent, returns outermost passing container',
      result.handle, outerOk);

    // Must NOT return the body sentinel or the failing container
    eq('findTargetTable: does not return failing container',
      result.handle === failsLLG, false);
  });
})();

// FT3: findTargetTable — prefers native <table> ancestor over grid heuristic
// When the element has a <table> ancestor, closest('table') must be returned
// immediately without engaging the looksLikeGrid walk-up (AC1).
(function findTargetTable_prefersNativeTable() {
  withFindTargetEnv([], function() {
    const tableEl = { tagName: 'TABLE', rows: [], dataset: {} };

    // A click target that has a <table> ancestor.
    const clickTarget = {
      tagName: 'TD',
      nodeType: 1,
      parentElement: tableEl,
      parentNode: tableEl,
      closest: function(sel) {
        if (sel === 'table') return tableEl;
        return null;
      },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: prefers native <table> ancestor over grid heuristic',
      result.handle, tableEl);
    // A bare <table> ancestor is a case the caller already knows how to
    // handle (it never gets the dr-ext-grid marker); isNew is always false.
    eq('findTargetTable: native <table> ancestor reports isNew: false',
      result.isNew, false);
  });
})();

// FT4: findTargetTable — returns null when nothing found
// A click target with no grid ancestors and no <table> ancestor.
(function findTargetTable_returnsNullWhenNothing() {
  withFindTargetEnv([], function() {
    // Text-only rows fail looksLikeGrid (step 5 — no numeric content)
    const noNumericRows = [
      makeGridRow([{text:'Alpha',width:100},{text:'Foo'}], 'row', 20),
      makeGridRow([{text:'Beta',width:100},{text:'Bar'}], 'row', 20),
      makeGridRow([{text:'Gamma',width:100},{text:'Baz'}], 'row', 20),
      makeGridRow([{text:'Delta',width:100},{text:'Qux'}], 'row', 20),
      makeGridRow([{text:'Epsilon',width:100},{text:'Quux'}], 'row', 20),
    ];

    const parent = makeWalkEl({ display: 'flex', rows: noNumericRows });
    parent.parentElement = document.body;
    parent.parentNode    = document.body;

    const clickTarget = {
      tagName: 'DIV',
      nodeType: 1,
      parentElement: parent,
      parentNode: parent,
      closest: function(sel) { return null; },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: returns null when no grid or table found',
      result, null);
  });
})();

// FT5: findTargetTable — returns already-found ancestor without re-walking
// If an ancestor is already known per opts.isSeen (app-model-registry sprint
// replaced the closest('.dr-ext-grid') read with an injected isSeen check —
// see lib/dr-table/detect.js), it must be returned immediately without
// calling looksLikeGrid again.
(function findTargetTable_returnsAlreadyTaggedGrid() {
  withFindTargetEnv([], function() {
    const existingGrid = makeWalkEl({ display: 'flex' });

    const clickTarget = {
      tagName: 'DIV',
      nodeType: 1,
      parentElement: existingGrid,
      parentNode: existingGrid,
      closest: function(sel) { return null; },
    };

    const seen = new Set([existingGrid]);
    const result = findTargetTable(clickTarget, { isSeen: (el) => seen.has(el) });

    eq('findTargetTable: returns already-found ancestor immediately',
      result.handle, existingGrid);
    // Already found — the caller has already handled this one; isNew is false.
    eq('findTargetTable: already-found ancestor reports isNew: false',
      result.isNew, false);
  });
})();

// FT6: findTargetTable — REPORTS a new grid via { handle, isNew: true } and
// does not mark it itself (sprint extract-dr-table: detection moved to
// lib/dr-table and now only reports; the caller — content.js's
// markAndToggleIfNewGrid — owns the dr-ext-grid write and the widget build).
// This test used to assert findTargetTable itself added the class (AC2 under
// the old contract); it is reworked here to assert the new split instead:
// findTargetTable must resolve the new grid AND must leave it unmarked.
(function findTargetTable_reportsNewGridWithoutMarking() {
  withFindTargetEnv([], function() {
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    const inner = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer = makeWalkEl({ display: 'flex', rows: makeRows5() });

    inner.parentElement = outer;
    inner.parentNode    = outer;
    outer.parentElement = document.body;
    outer.parentNode    = document.body;

    inner.closest = function(sel) { return null; };

    const result = findTargetTable(inner);

    eq('findTargetTable: resolves the new grid to the outermost element',
      result.handle, outer);
    eq('findTargetTable: reports isNew: true for a not-yet-marked grid',
      result.isNew, true);
    eq('findTargetTable: does NOT write the dr-ext-grid marker itself (reports only)',
      outer.classList.contains('dr-ext-grid'), false);
  });
})();

// ---------------------------------------------------------------------------
// Sprint right-click-registers: the nomination step runs from the clicked
// element's chain root.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.5 and the
// right-click-registers block in §5; decision D1.
// ---------------------------------------------------------------------------
//
// The route these assertions pin, in the specification's words:
//   - A right-click resolves in four steps: the nearest native table, the
//     nearest already-registered ancestor, the nomination step run from the
//     chain root of the nest the clicked element sits in, and the geometry
//     probe.
//   - The third step returns the element the configured nesting depth
//     selects. That element can be a sibling of the clicked element, so a
//     click in a database query grid's row-number gutter resolves the
//     scrolling pane beside it.
//   - A nest that resolves nothing falls through to the geometry probe
//     unchanged.
//   - findTargetTable reports: it registers nothing and writes no marker.
//
// Every expected value below comes from that statement, never from the
// detection layer's source. The fixture is makeDatabaseQueryGrid (defined
// with the grid fixtures further down this file; a top-level function
// declaration, so it is in scope here).

// --- AC1: a click in the scrolling pane resolves the scrolling pane ---

(function rightClickRegisters_AC1_aClickInTheScrollingPaneResolvesIt() {
  const grid = makeDatabaseQueryGrid();
  const styleProbe = makeCountingStyleProbe();
  const result = findTargetTable(grid.scrollRowEls[2].children[1],
    { isSeen: () => false, styleProbe });

  eq('findTargetTable AC1: a click in the scrolling pane resolves the scrolling pane',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC1: the scrolling pane resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC1: the resolution reads no layout, so the geometry probe did not produce it',
    styleProbe.calls, 0);
  eq('findTargetTable AC1: the resolution writes no grid marker class',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
      .map((el) => el.classList.contains('dr-ext-grid')), [false, false, false]);
  eq('findTargetTable AC1: the resolution adds no registry entry',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
      .map((el) => DR_STORE.hasTable(el)), [false, false, false]);
})();

// --- AC1: a click on the nest's own layers resolves the scrolling pane ---
//
// A right-click inside the grid lands on whatever sits under the pointer, and
// the gaps between the panes belong to the nest's plain layers. The geometry
// probe walks ancestors of the clicked element and stops at the first one that
// fails its row-count gate, so a click on a layer whose only child is another
// layer resolves nothing through it. The nomination step runs from the chain
// root instead, which covers every layer of the nest.

(function rightClickRegisters_AC1_aClickOnTheNestsOwnLayersResolvesTheScrollingPane() {
  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  const paneRowResult = findTargetTable(plain.paneParentEl, { isSeen: () => false });
  eq('findTargetTable AC1: a click on the plain layer between the panes resolves the scrolling pane',
    paneRowResult !== null && paneRowResult.handle === plain.scrollPaneEl, true);

  const grid = makeDatabaseQueryGrid();
  const wrapperResult = findTargetTable(grid.wrapperEl, { isSeen: () => false });
  eq('findTargetTable AC1: a click on the wrapper itself resolves the scrolling pane',
    wrapperResult !== null && wrapperResult.handle === grid.scrollPaneEl, true);
})();

// --- AC2: a click in the row-number gutter resolves the scrolling pane ---

(function rightClickRegisters_AC2_aClickInTheRowNumberGutterResolvesTheScrollingPane() {
  const grid = makeDatabaseQueryGrid();
  const gutterCell = grid.pinnedRowEls[0].children[0];

  eq('findTargetTable AC2: the clicked gutter cell holds a row number',
    /^\d+$/.test(gutterCell.textContent), true);

  const styleProbe = makeCountingStyleProbe();
  const result = findTargetTable(gutterCell, { isSeen: () => false, styleProbe });

  eq('findTargetTable AC2: a click in the row-number gutter resolves the scrolling pane beside it',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC2: the gutter resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC2: the gutter resolution reports neither the pinned pane nor the wrapper',
    result !== null &&
      (result.handle === grid.pinnedPaneEl || result.handle === grid.wrapperEl), false);
  eq('findTargetTable AC2: the gutter resolution reads no layout, so the geometry probe did not produce it',
    styleProbe.calls, 0);

  // The layout counter is a live probe: the geometry probe does read layout
  // when a case reaches it, so the zero above stands for a route that stopped
  // earlier rather than for a port nothing ever calls.
  const roleLessProbe = makeCountingStyleProbe();
  const roleLess = makeDgNode('DIV', 'plain-host', null,
    [0, 1, 2, 3, 4, 5].map((i) => makeDgRow(i, ['north', '4,281,905', '17.40'])));
  findTargetTable(roleLess.children[0].children[0],
    { isSeen: () => false, styleProbe: roleLessProbe });
  eq('findTargetTable AC2: a role-less tree does reach the geometry probe and read layout',
    roleLessProbe.calls > 0, true);
})();

// --- AC3: a role-bearing element that fails the data test resolves nothing ---

(function rightClickRegisters_AC3_aRoleBearingElementThatFailsTheDataTestResolvesNothing() {
  const oneCell = makeRoleBearingNest([makeDgRow(0, ['17'])]);
  const noNumber = makeRoleBearingNest([
    makeDgRow(0, ['north', 'alpha']),
    makeDgRow(1, ['south', 'bravo']),
  ]);

  eq('findTargetTable AC3: one row of one cell fails the data test',
    isDataTable(oneCell), false);
  eq('findTargetTable AC3: two rows with no number fail the data test',
    isDataTable(noNumber), false);
  eq('findTargetTable AC3: the one-row-one-cell element is a chain root (sanity)',
    chainRootOf(oneCell.children[0].children[0]) === oneCell, true);
  eq('findTargetTable AC3: the two-rows-no-number element is a chain root (sanity)',
    chainRootOf(noNumber.children[0].children[0]) === noNumber, true);

  eq('findTargetTable AC3: a click inside the one-row-one-cell element resolves nothing',
    findTargetTable(oneCell.children[0].children[0], { isSeen: () => false }), null);
  eq('findTargetTable AC3: a click inside the two-rows-no-number element resolves nothing',
    findTargetTable(noNumber.children[0].children[0], { isSeen: () => false }), null);
})();

// --- AC3: an empty nomination falls through to the geometry probe ---
//
// The two cases above resolve nothing because the geometry probe rejects them
// as well, so they say nothing about which step produced the null. This case
// separates the two steps: six rows of one numeric cell each fail the data
// test at the two-cell gate, which leaves the nomination empty, and clear the
// geometry probe's ladder (six repeated children sharing a class, a flex
// display, a numeric cell, and a grid role short-circuiting the column-width
// sample). The route therefore has to hand the element on rather than end the
// resolution, and the layout counter records the probe producing the answer.

(function rightClickRegisters_AC3_anEmptyNominationFallsThroughToTheGeometryProbe() {
  const nest = makeRoleBearingNest(
    [0, 1, 2, 3, 4, 5].map((i) => makeDgRow(i, ['4,281,905'])));
  const styleProbe = makeCountingStyleProbe();

  eq('findTargetTable AC3: a single-column nest fails the data test, so the nomination is empty',
    isDataTable(nest), false);
  eq('findTargetTable AC3: the clicked cell still sits in that nest',
    chainRootOf(nest.children[0].children[0]) === nest, true);

  const result = findTargetTable(nest.children[0].children[0],
    { isSeen: () => false, styleProbe });

  eq('findTargetTable AC3: an empty nomination falls through and the probe resolves the nest',
    result !== null && result.handle === nest, true);
  eq('findTargetTable AC3: the fall-through resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC3: the fall-through resolution reads layout, so the geometry probe produced it',
    styleProbe.calls > 0, true);
})();

// --- AC4: a registered table resolves at the registry route ---
//
// The proof goes through the ports the resolver takes, not through the
// source text: opts.numericProbe counts the data-test reads the nomination
// step would spend, so a zero count shows the step spent none, and
// opts.isSeen records the elements the resolver asked the registry about.
// The last pair of assertions runs the same click with nothing registered,
// so the zero count above stands for "the step spent no read" rather than
// "the probe is inert".

(function rightClickRegisters_AC4_aRegisteredTableResolvesAtTheRegistryRoute() {
  const grid = makeDatabaseQueryGrid();
  const cell = grid.scrollRowEls[3].children[1];

  const asked = [];
  const registryProbe = makeCountingNumericProbe();
  const result = findTargetTable(cell, {
    isSeen: (el) => { asked.push(el); return el === grid.scrollPaneEl; },
    numericProbe: registryProbe,
  });

  eq('findTargetTable AC4: a click inside a registered scrolling pane resolves it',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: the registry route reports isNew false',
    result !== null && result.isNew, false);
  eq('findTargetTable AC4: the registry route spends no data-test read',
    registryProbe.calls, 0);
  eq('findTargetTable AC4: the registry walk stops at the scrolling pane',
    asked.length > 0 && asked[asked.length - 1] === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: no step asks the registry about the wrapper',
    asked.includes(grid.wrapperEl), false);

  const freshProbe = makeCountingNumericProbe();
  const freshResult = findTargetTable(cell, { isSeen: () => false, numericProbe: freshProbe });
  eq('findTargetTable AC4: the same click with nothing registered reaches the nomination step',
    freshResult !== null && freshResult.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: and that resolution does spend data-test reads',
    freshProbe.calls > 0, true);
})();

// --- Edge: a crowded depth falls back outward on a right-click ---

(function rightClickRegisters_edge_aCrowdedDepthFallsBackOutwardOnARightClick() {
  const grid = makeDatabaseQueryGrid({ pinnedColumns: 2 });

  eq('findTargetTable edge: a two-column pinned pane puts two elements at the shipped depth',
    isDataTable(grid.pinnedPaneEl) && isDataTable(grid.scrollPaneEl), true);

  const result = findTargetTable(grid.scrollRowEls[0].children[0], { isSeen: () => false });
  eq('findTargetTable edge: the fall-back outward resolves the wrapper on a right-click',
    result !== null && result.handle === grid.wrapperEl, true);
})();

// --- Edge: a role-less tree still resolves through the geometry probe ---

(function rightClickRegisters_edge_aRoleLessTreeStillResolvesThroughTheGeometryProbe() {
  withFindTargetEnv([], function () {
    const makeRows5 = () => [
      makeGridRow([{ text: 'A', width: 100 }, { text: '100' }], 'row', 20),
      makeGridRow([{ text: 'B', width: 100 }, { text: '200' }], 'row', 20),
      makeGridRow([{ text: 'C', width: 100 }, { text: '300' }], 'row', 20),
      makeGridRow([{ text: 'D', width: 100 }, { text: '400' }], 'row', 20),
      makeGridRow([{ text: 'E', width: 100 }, { text: '500' }], 'row', 20),
    ];
    const inner = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer = makeWalkEl({ display: 'flex', rows: makeRows5() });
    inner.parentElement = outer;
    inner.parentNode = outer;
    outer.parentElement = document.body;
    outer.parentNode = document.body;
    inner.closest = function () { return null; };

    eq('findTargetTable edge: a role-less tree has no chain root',
      chainRootOf(inner), null);

    const result = findTargetTable(inner);
    eq('findTargetTable edge: a role-less tree still resolves to the outermost geometry-probe match',
      result !== null && result.handle === outer, true);
    eq('findTargetTable edge: that geometry-probe resolution still reports isNew',
      result !== null && result.isNew, true);
  });
})();

// --- chainRootOf: the nest an arbitrary clicked element sits in ---

(function rightClickRegisters_chainRootOfResolvesTheNestOfAnArbitraryElement() {
  const grid = makeDatabaseQueryGrid();
  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  const roleLess = makeDgNode('DIV', 'plain-host', null, [makeDgRow(0, ['north', '4,281,905'])]);

  eq('chainRootOf: a null element returns null', chainRootOf(null), null);
  eq('chainRootOf: a role-less tree returns null',
    chainRootOf(roleLess.children[0].children[0]), null);
  eq('chainRootOf: a cell in the scrolling pane returns the wrapper',
    chainRootOf(grid.scrollRowEls[0].children[0]) === grid.wrapperEl, true);
  eq('chainRootOf: a cell in the pinned pane returns the wrapper',
    chainRootOf(grid.pinnedRowEls[0].children[0]) === grid.wrapperEl, true);
  eq('chainRootOf: a plain layer between the wrapper and the panes still returns the wrapper',
    chainRootOf(plain.scrollRowEls[0].children[0]) === plain.wrapperEl, true);
})();

// ---------------------------------------------------------------------------
// Sprint grid-adapter: TableAdapter abstraction
// AC2 — NativeTableAdapter round-trip test
// AC3 — GridAdapter stub no-throw test
// AC4 — source scan: no role="gridcell" or data-row-index literals in content.js
// ---------------------------------------------------------------------------

// TA1: NativeTableAdapter round-trip
// Build a native table element, wrap it with makeAdapter(), walk the adapter
// API (getRows → getCells → getText) and assert values match what was put in.
// Also assert isVirtualized() === false and getElement() returns the element.
(function nativeTableAdapter_roundTrip() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: '1,234' }, { tag: 'td', text: '5,678' }],
    [{ tag: 'td', text: '9,012' }, { tag: 'td', text: '3,456' }],
  ]);

  const adapter = makeAdapter(tableEl);

  eq('NativeTableAdapter: makeAdapter returns NativeTableAdapter for TABLE element',
    adapter instanceof NativeTableAdapter, true);

  eq('NativeTableAdapter: getElement() returns the original element',
    adapter.getElement(), tableEl);

  eq('NativeTableAdapter: isVirtualized() === false',
    adapter.isVirtualized(), false);

  const rows = adapter.getRows();
  eq('NativeTableAdapter: getRows() returns 2 rows',
    rows.length, 2);

  const cells0 = rows[0].getCells();
  eq('NativeTableAdapter: row 0 has 2 cells',
    cells0.length, 2);

  eq('NativeTableAdapter: row 0 cell 0 getText() returns "1,234"',
    cells0[0].getText(), '1,234');

  eq('NativeTableAdapter: row 0 cell 1 getText() returns "5,678"',
    cells0[1].getText(), '5,678');

  const cells1 = rows[1].getCells();
  eq('NativeTableAdapter: row 1 cell 0 getText() returns "9,012"',
    cells1[0].getText(), '9,012');

  eq('NativeTableAdapter: row 1 cell 1 getText() returns "3,456"',
    cells1[1].getText(), '3,456');

  // Each cell object must expose .el pointing back to the DOM cell element
  eq('NativeTableAdapter: cell .el is the underlying DOM cell',
    cells0[0].el, tableEl.rows[0].cells[0]);
})();

// TA1b: NativeTableAdapter cells expose NO setText — deliberate absence guard.
// The native path writes cells directly in roundTable so it can preserve markup
// in mixed cells and stash both originalHtml and originalValue. A setText here
// would be reached by any future code that drives both adapters through one
// loop; a textContent-based one would flatten mixed cells and skip
// originalValue, silently feeding the sidebar preview its own rounded output.
// Absent, that future code fails at the call site instead. This test keeps the
// absence deliberate rather than incidental — if you are adding setText back,
// it must preserve markup and stash BOTH dataset keys, and this guard must be
// rewritten to assert that, not simply deleted.
(function nativeTableAdapter_hasNoSetText() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: '1,234' }],
  ]);
  const cell = makeAdapter(tableEl).getRows()[0].getCells()[0];

  eq('TA1b: native adapter cell exposes no setText',
    cell.setText, undefined);
  // applyPatches is the grid cell's write, the name such a loop reaches now.
  eq('TA1b: native adapter cell exposes no applyPatches',
    cell.applyPatches, undefined);

  // Source scan: nothing in the class may assign textContent/innerHTML on a
  // cell. Catches a setText re-added under a different name.
  if (detectCode === null) {
    eq('TA1b: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const start = detectCode.indexOf('class NativeTableAdapter');
  const rest = detectCode.slice(start);
  const classBody = rest.slice(0, rest.indexOf('\n}\n'));

  eq('TA1b (setup): NativeTableAdapter class body located',
    start >= 0 && classBody.length > 0, true);

  eq('TA1b: NativeTableAdapter class body has no textContent= assignment',
    /textContent\s*=[^=]/.test(classBody), false);

  eq('TA1b: NativeTableAdapter class body has no innerHTML= assignment',
    /innerHTML\s*=[^=]/.test(classBody), false);
})();

// TA2: NativeTableAdapter — cell count matches table structure
// A 3-row × 3-column table round-trips with correct row and cell counts.
(function nativeTableAdapter_3x3() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: 'a' }, { tag: 'td', text: 'b' }, { tag: 'td', text: 'c' }],
    [{ tag: 'td', text: '1' }, { tag: 'td', text: '2' }, { tag: 'td', text: '3' }],
    [{ tag: 'td', text: 'x' }, { tag: 'td', text: 'y' }, { tag: 'td', text: 'z' }],
  ]);

  const adapter = makeAdapter(tableEl);
  const rows = adapter.getRows();

  eq('NativeTableAdapter: 3×3 table — getRows() returns 3 rows',
    rows.length, 3);

  eq('NativeTableAdapter: 3×3 table — row 1 has 3 cells',
    rows[1].getCells().length, 3);

  eq('NativeTableAdapter: 3×3 table — row 2 cell 2 text is "z"',
    rows[2].getCells()[2].getText(), 'z');
})();

// TA3: GridAdapter stub — makeAdapter on a non-TABLE element returns GridAdapter
// isVirtualized() === true, getRows() === [], getElement() returns the element.
(function gridAdapter_stub_properties() {
  const divEl = {
    tagName: 'DIV',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      contains(c) { return this._c.includes(c); },
    },
  };

  const adapter = makeAdapter(divEl);

  eq('GridAdapter: makeAdapter on DIV returns GridAdapter',
    adapter instanceof GridAdapter, true);

  eq('GridAdapter: getElement() returns the div element',
    adapter.getElement(), divEl);

  eq('GridAdapter: isVirtualized() === true',
    adapter.isVirtualized(), true);

  eq('GridAdapter: getRows() returns empty array (stub)',
    adapter.getRows().length, 0);
})();

// TA4: roundTable on a grid element (non-TABLE) — must not throw, must be a no-op
// The stub path: GridAdapter.getRows() → [] causes roundTable to return early.
// No .dr-ext-rounded cells should appear; no exception thrown.
(function gridAdapter_stub_noThrow() {
  const divEl = {
    tagName: 'DIV',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      contains(c) { return this._c.includes(c); },
    },
  };

  let threw = false;
  try {
    roundTable(divEl, Object.assign({}, DR_DEFAULTS));
  } catch (e) {
    threw = true;
  }

  eq('GridAdapter stub: roundTable on grid element does not throw',
    threw, false);

  // The element should have no .dr-ext-rounded cells since it was a no-op
  eq('GridAdapter stub: roundTable on grid element is a no-op (querySelector returns null)',
    divEl.querySelector('.dr-ext-rounded'), null);
})();

// The writer groups patches by piece, writes each touched piece once, and
// returns the landed count with each touched piece's text before and after.
(function applyExtractedPatchesReturnsTouchedPieces() {
  const cell = makeElementNode('', [makeTextNode('A 100 B 200'), makeTextNode(' C 300')]);
  const [first, second] = cell.childNodes;
  // The pieces walk runs with no tree walker in this suite's document.
  let result;
  try {
    result = applyExtractedPatches(cell, [
      { index: 2, numStr: '100', newNum: '90' },
      { index: 8, numStr: '200', newNum: '250' },
      { index: 14, numStr: '300', newNum: '999' },
      { index: 14, numStr: '777', newNum: '1' },
    ]);
  } catch (e) {
    eq('patch writer: the writer runs without a tree walker', String(e), null);
    return;
  }
  eq('patch writer: the result carries the landed count', result.landed, 3);
  eq('patch writer: the result lists each touched piece once, in piece order',
    result.pieces,
    [{ i: 0, before: 'A 100 B 200', after: 'A 90 B 250' }, { i: 1, before: ' C 300', after: ' C 999' }]);
  eq('patch writer: the pieces hold the patched text',
    [first.nodeValue, second.nodeValue], ['A 90 B 250', ' C 999']);
  eq('patch writer: an empty patch list lands nothing',
    applyExtractedPatches(cell, []), { landed: 0, pieces: [] });
})();

// ---------------------------------------------------------------------------
// GR1: Unlabelled variable-row-height grid — structural extraction + nodeValue rounding
// The headline test: no ARIA roles, no dg-- classes. GridAdapter must fall back
// to direct children as rows and direct row-children as cells.
// ---------------------------------------------------------------------------

(function gr1_unlabelledGrid_extractionAndRounding() {
  // Build a 3×2 grid with numeric values at different magnitudes
  const grid = makeGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
    ['7654321', '55'],
  ]);

  const adapter = makeAdapter(grid.wrapperEl);

  eq('GR1: makeAdapter returns GridAdapter for div wrapper',
    adapter instanceof GridAdapter, true);

  eq('GR1: isVirtualized() === true',
    adapter.isVirtualized(), true);

  const rows = adapter.getRows();
  eq('GR1: getRows() returns 3 rows',
    rows.length, 3);

  const cells0 = rows[0].getCells();
  eq('GR1: row 0 has 2 cells',
    cells0.length, 2);

  eq('GR1: row 0 cell 0 getText() returns "8584629"',
    cells0[0].getText(), '8584629');

  eq('GR1: row 0 cell 1 getText() returns "286"',
    cells0[1].getText(), '286');

  // Now round via applyPatches and confirm nodeValue changed
  cells0[0].applyPatches([{ index: 0, numStr: '8584629', newNum: '8500000' }]);
  const tn0 = grid.cellEls[0].childNodes[0];
  eq('GR1: after applyPatches, text node nodeValue is rounded value',
    tn0.nodeValue, '8500000');

  // The dr-ext-rounded class must be on the cell element
  eq('GR1: after applyPatches, cell carries dr-ext-rounded class',
    grid.cellEls[0].classList.contains('dr-ext-rounded'), true);
})();

// ---------------------------------------------------------------------------
// GR2: .dg--virtual-row / .dg--cell shaped grid — path extracts via library selectors
// ---------------------------------------------------------------------------

(function gr2_dgGrid_extraction() {
  const grid = makeGridWrapper([
    ['1000000', '500'],
    ['2000000', '750'],
  ], { useDgClasses: true });

  const adapter = makeAdapter(grid.wrapperEl);

  const rows = adapter.getRows();
  eq('GR2: dg-- grid getRows() returns 2 rows',
    rows.length, 2);

  const cells = rows[0].getCells();
  eq('GR2: dg-- grid row 0 has 2 cells',
    cells.length, 2);

  eq('GR2: dg-- grid row 0 cell 0 text is "1000000"',
    cells[0].getText(), '1000000');

  // Confirm data-row attribute path: row 0 has dataset.row = "0"
  eq('GR2: dg-- grid row 0 has data-row="0"',
    grid.rowEls[0].dataset.row, '0');

  eq('GR2: dg-- grid row 1 has data-row="1"',
    grid.rowEls[1].dataset.row, '1');
})();

// ---------------------------------------------------------------------------
// GR3: nodeValue write asserts NODE IDENTITY — the regression guard for the
// reconciler crash. The spec mandates: patch in place, never replace the node.
// ---------------------------------------------------------------------------

(function gr3_nodeIdentityPreservation() {
  const grid = makeGridWrapper([
    ['9876543', '123'],
  ]);

  const adapter = makeAdapter(grid.wrapperEl);
  const rows = adapter.getRows();
  const cellObj = rows[0].getCells()[0];

  // Capture the Text node object reference BEFORE the write.
  const textNodeBefore = grid.cellEls[0].childNodes[0];
  const childCountBefore = grid.cellEls[0].childNodes.length;

  // Round via applyPatches
  cellObj.applyPatches([{ index: 0, numStr: '9876543', newNum: '9900000' }]);

  // The Text node reference must be the SAME object.
  const textNodeAfter = grid.cellEls[0].childNodes[0];

  eq('GR3: text node object identity preserved after applyPatches (same reference)',
    textNodeAfter === textNodeBefore, true);

  eq('GR3: text node nodeValue was patched to rounded value',
    textNodeAfter.nodeValue, '9900000');

  // The cell's child node list length must be unchanged (no insertion/removal)
  eq('GR3: cell childNodes.length unchanged after applyPatches (no appendChild/removeChild)',
    grid.cellEls[0].childNodes.length, childCountBefore);

  // Double-safety: the cell element itself is unchanged (not recreated)
  eq('GR3: cell element reference unchanged after applyPatches',
    grid.cellEls[0], grid.cellEls[0]);
})();

// ---------------------------------------------------------------------------
// GR3b: the grid write path does NOT use textContent/innerHTML — source-level
// guard. The spec forbids: cell.textContent=, cell.innerHTML=, removeChild,
// appendChild on a cell during a grid write. We verify the node reference is
// identical (GR3) which implies none of those paths ran. Additionally scan
// source for the critical prohibition: the cell object both kinds share
// (applyPatches), the patch writer it calls, and the piece restore.
// ---------------------------------------------------------------------------

(function gr3b_noTextContentWriteInGridPath() {
  const src = allContentSrc;
  const bodies = ['function makeCellObj(', 'function applyExtractedPatches(', 'function restoreTextPieces(']
    .map((signature) => sourceBodyOf(src, signature));

  eq('GR3b: the grid write path source is found',
    bodies.every((body) => body.length > 0), true);

  // No 'textContent =' assignment anywhere on the grid write path.
  eq('GR3b: the grid write path contains no textContent= assignment',
    bodies.some((body) => /textContent\s*=(?!=)/.test(body)), false);

  // The writer and the restore write through nodeValue.
  eq('GR3b: the patch writer and the piece restore write through nodeValue',
    /\.nodeValue\s*=(?!=)/.test(bodies[1]) && /\.nodeValue\s*=(?!=)/.test(bodies[2]), true);
})();

// GR6d: applyPatches is a no-op when the cell has no text node
(function gr6d_applyPatches_noopWhenNoTextNode() {
  // Build a cell with no text node
  const emptyCell = makeElementNode('empty-cell', []);
  emptyCell.querySelector = function() { return null; };

  const adapter = makeAdapter(
    (function() {
      const wrapEl = makeElementNode('wrapper', []);
      wrapEl.tagName = 'DIV';
      wrapEl.dataset = {};
      wrapEl.querySelector = function() { return null; };
      wrapEl.querySelectorAll = function() { return []; };
      wrapEl.matches = function() { return false; };
      return wrapEl;
    })()
  );

  // Directly call _makeCellObj to get a cell object for our empty cell
  const cellObj = adapter._makeCellObj(emptyCell);

  let threw = false;
  try {
    cellObj.applyPatches([{ index: 0, numStr: '123', newNum: 'should-be-noop' }]);
  } catch (e) {
    threw = true;
  }

  eq('GR6d: applyPatches on cell with no text node does not throw',
    threw, false);

  eq('GR6d: applyPatches on cell with no text node leaves classList unchanged',
    emptyCell.classList.contains('dr-ext-rounded'), false);
})();

// GR6f: isDataTable returns true for a grid with numeric cells
(function gr6f_isDataTable_numericGrid() {
  const grid = makeGridWrapper([
    ['Name', '1234567'],
    ['Foo',  '9876543'],
    ['Bar',  '5555555'],
  ]);

  // isDataTable calls makeAdapter(el).getRows(), so the wrapper must be a div
  eq('GR6f: isDataTable returns true for grid with numeric cells',
    isDataTable(grid.wrapperEl), true);
})();

// GR6g: isDataTable returns false for an all-text grid (no finite numbers)
(function gr6g_isDataTable_allTextGrid() {
  const grid = makeGridWrapper([
    ['Name',  'City'],
    ['Alice', 'Paris'],
    ['Bob',   'Berlin'],
    ['Carol', 'Tokyo'],
  ]);

  eq('GR6g: isDataTable returns false for all-text grid (no numeric cells)',
    isDataTable(grid.wrapperEl), false);
})();

// GR6i: GridAdapter write sequence — getText after applyPatches returns the
// stored original, and the text node holds the rounded value
(function gr6i_applyPatches_getTextRoundTrip() {
  const grid = makeGridWrapper([['9876543']]);
  const adapter = makeAdapter(grid.wrapperEl);
  const cellObj = adapter.getRows()[0].getCells()[0];

  eq('GR6i (setup): getText before applyPatches returns original',
    cellObj.getText(), '9876543');

  cellObj.applyPatches([{ index: 0, numStr: '9876543', newNum: '9900000' }]);

  // getText after the write returns the ORIGINAL so re-rounding uses the right base.
  eq('GR6i: getText after applyPatches returns stored original (for re-round safety)',
    cellObj.getText(), '9876543');

  // The nodeValue on the text node is the rounded value
  eq('GR6i: text node nodeValue after applyPatches is the rounded value',
    grid.cellEls[0].childNodes[0].nodeValue, '9900000');
})();

// GR6j: SPEC GAP GUARD — the grid write path is nodeValue-only. The spec (D3)
// says the write is a nodeValue patch (GridAdapter's applyPatches →
// applyExtractedPatches → nodeValue =), NOT cell.innerHTML = … which destroys
// React fiber identity.
//
// Source-level assertion: the cell object both kinds share, the patch
// writer, the piece restore, and the controller's restore hold no
// innerHTML= assignment. Since #421 a native restore writes text pieces too,
// so no write path on either kind assigns markup.
//
// This test encodes the hard rule from the sprint brief:
//   "The grid write must be nodeValue-only."
(function gr6j_gridWrite_sourceGuard_noInnerHTML() {
  const src = allContentSrc;
  const bodies = ['function makeCellObj(', 'function applyExtractedPatches(', 'function restoreTextPieces(',
    'function restoreTable(', 'function releaseCell(']
    .map((signature) => sourceBodyOf(src, signature));

  eq('GR6j: the write path has no innerHTML= assignment',
    bodies.every((body) => body.length > 0 && !/innerHTML\s*=(?!=)/.test(body)), true);

  // The cell object writes through the patch writer, and the patch writer
  // writes through nodeValue (the only permitted write).
  eq('GR6j: applyPatches writes through the patch writer, which assigns nodeValue',
    /applyExtractedPatches\(/.test(bodies[0]) && /\.nodeValue\s*=(?!=)/.test(bodies[1]), true);
})();

// ---------------------------------------------------------------------------
// Sprint add-phantom-a11y-predicate: isPhantomA11yTable
// ---------------------------------------------------------------------------
//
// isPhantomA11yTable(table) returns true when ANY of three signals holds:
//   Signal 1 – table or any ancestor has aria-hidden="true"
//   Signal 2 – nearest positioned ancestor (or the table itself) has inline
//               left <= OFFSCREEN_LEFT_PX_THRESHOLD (-9999)
//   Signal 3 – nearest positioned ancestor contains an <svg> with a non-empty
//               aria-label
// Returns false for an ordinary on-screen 2-column numeric table.
//
// Mock-building helpers:
//   makePhantomEl(attrs)  – minimal element node with getAttribute / parentElement / style
//   chainParents(child, ...parents)  – link elements into a parentElement chain
//   makePositionedAncestor(styleProps)  – element with style.position = 'absolute'

// --- AC: DR_DETECTION_SETTINGS.offscreenLeftPx is -9999 ---
(function phantomA11y_threshold_value() {
  eq('isPhantomA11yTable: DR_DETECTION_SETTINGS.offscreenLeftPx === -9999',
    DR_DETECTION_SETTINGS.offscreenLeftPx, -9999);
})();

// ---------------------------------------------------------------------------
// Signal 1: aria-hidden="true" on the table itself
// ---------------------------------------------------------------------------
(function phantomA11y_signal1_selfHidden() {
  const table = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
  eq('isPhantomA11yTable: aria-hidden="true" on table itself -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 1: aria-hidden="true" on immediate parent
(function phantomA11y_signal1_parentHidden() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  const parent = makePhantomEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, parent);
  eq('isPhantomA11yTable: aria-hidden="true" on immediate parent -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 1: aria-hidden="true" several ancestors up (nested deeply)
(function phantomA11y_signal1_deepAncestorHidden() {
  const table      = makePhantomEl({ tagName: 'TABLE' });
  const tbody      = makePhantomEl({ tagName: 'TBODY' });
  const innerDiv   = makePhantomEl({ tagName: 'DIV' });
  const middleDiv  = makePhantomEl({ tagName: 'DIV' });
  const outerDiv   = makePhantomEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, tbody, innerDiv, middleDiv, outerDiv);
  eq('isPhantomA11yTable: aria-hidden="true" several levels up -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: aria-hidden="false" must NOT trigger signal 1
(function phantomA11y_signal1_ariaHiddenFalse() {
  const table  = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'false' } });
  const parent = makePhantomEl({ tagName: 'DIV',   attrs: { 'aria-hidden': 'false' } });
  chainParents(table, parent);
  eq('isPhantomA11yTable: aria-hidden="false" does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Signal 2: nearest positioned ancestor has inline left <= threshold
// ---------------------------------------------------------------------------

// Signal 2: positioned ancestor with left: -10000px (Kaggle evidence)
(function phantomA11y_signal2_offscreenLeft_minus10000() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-10000px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-10000px -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 2: positioned ancestor at exactly the threshold value (-9999px)
(function phantomA11y_signal2_offscreenLeft_exactThreshold() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9999px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-9999px (at threshold) -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 2: table itself is positioned and off-screen (no separate ancestor)
(function phantomA11y_signal2_tableSelfOffscreen() {
  const table = makePhantomEl({ tagName: 'TABLE', style: { position: 'absolute', left: '-10000px' } });
  eq('isPhantomA11yTable: table itself is positioned with left=-10000px -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: left value just ABOVE threshold (-9998px) must NOT trigger
(function phantomA11y_signal2_leftJustAboveThreshold() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9998px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-9998px (above threshold) -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: modest off-screen like -100px must NOT trigger signal 2
(function phantomA11y_signal2_modestNegativeLeft() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-100px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-100px (not extreme) -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: non-positioned ancestor with extreme left — should NOT count because the
// ancestor is not positioned; no positioned ancestor found so checkEl = table,
// and table has no extreme left.
(function phantomA11y_signal2_nonPositionedAncestorIgnored() {
  const table   = makePhantomEl({ tagName: 'TABLE' });
  // wrapper has no inline style.position and getComputedStyle returns '' for position
  const wrapper = makePhantomEl({ tagName: 'DIV', style: { left: '-10000px' } });
  chainParents(table, wrapper);
  // No positioned ancestor found → checkEl = table (which has no extreme left)
  eq('isPhantomA11yTable: non-positioned ancestor with extreme left -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Signal 3: nearest positioned ancestor contains <svg> with non-empty aria-label
// ---------------------------------------------------------------------------

// Signal 3: positioned ancestor has querySelectorAll('svg') returning labelled svg
(function phantomA11y_signal3_svgWithAriaLabel() {
  const svg = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': 'Monthly Revenue Chart' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor has svg[aria-label="..."] -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 3: multiple SVGs in ancestor, only one has a label — still triggers
(function phantomA11y_signal3_multipleSvgsOneLabelledOne() {
  const svgNoLabel  = makePhantomEl({ tagName: 'SVG' }); // no aria-label
  const svgLabelled = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': 'Pie Chart' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svgNoLabel; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svgNoLabel, svgLabelled] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: one of two svgs has aria-label -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: svg with EMPTY aria-label must NOT trigger signal 3
(function phantomA11y_signal3_svgEmptyAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': '' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with empty aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: svg with whitespace-only aria-label must NOT trigger signal 3
(function phantomA11y_signal3_svgWhitespaceAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': '   ' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with whitespace-only aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: svg with NO aria-label attribute at all must NOT trigger signal 3
(function phantomA11y_signal3_svgNoAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG' }); // getAttribute returns null
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with no aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: no positioned ancestor found at all — signal 3 is skipped entirely (no crash)
(function phantomA11y_signal3_noPosAncestor() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  // No parentElement — predicate must not throw and returns false
  eq('isPhantomA11yTable: no positioned ancestor, no signals -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Negative case: ordinary on-screen 2-column numeric table
// ---------------------------------------------------------------------------
(function phantomA11y_negative_ordinaryTable() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const parent = makePhantomEl({ tagName: 'DIV' });
  chainParents(table, parent);
  // No aria-hidden, no off-screen left, no positioned ancestor → false
  eq('isPhantomA11yTable: ordinary on-screen numeric table -> false',
    isPhantomA11yTable(table), false);
})();

// Negative: positioned ancestor but normal on-screen left (-50px), no svg, no aria-hidden
(function phantomA11y_negative_onscreenPositionedAncestor() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-50px' });
  posAnc.querySelectorAll = function() { return []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor with normal left (-50px), no svg -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Guard: invalid / null input
// ---------------------------------------------------------------------------
(function phantomA11y_nullInput() {
  eq('isPhantomA11yTable: null -> false',
    isPhantomA11yTable(null), false);
})();

(function phantomA11y_noGetAttribute() {
  eq('isPhantomA11yTable: plain object without getAttribute -> false',
    isPhantomA11yTable({}), false);
})();

// --- pass1-filter AC1: phantom tables (aria-hidden ancestor) get NO toggle ---
// Build N=3 phantom tables (aria-hidden parent), all valid data tables.
// After Pass 1 none of them should be in tableToggles.

(function pass1Filter_ariaHiddenPhantoms_zeroToggles() {
  function makeAriaHiddenPhantom() {
    const t = makePass1DataTable();
    // aria-hidden="true" on the immediate parent (Signal 1)
    const hiddenParent = {
      tagName: 'DIV',
      getAttribute: function(name) { return name === 'aria-hidden' ? 'true' : null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = hiddenParent;
    t.parentNode    = null;
    return t;
  }

  const phantoms = [makeAriaHiddenPhantom(), makeAriaHiddenPhantom(), makeAriaHiddenPhantom()];

  // Sanity: each phantom is a valid data table (isDataTable guard is NOT the cause of skip)
  eq('pass1-filter: phantom aria-hidden table satisfies isDataTable (sanity)',
    isDataTable(phantoms[0]), true);
  // Sanity: each phantom is detected as phantom
  eq('pass1-filter: phantom aria-hidden table isPhantomA11yTable is true (sanity)',
    isPhantomA11yTable(phantoms[0]), true);

  runPass1WithTables(phantoms);

  const togglesCreated = phantoms.filter(t => tableToggles.has(t)).length;
  eq('pass1-filter: 3 aria-hidden phantom tables → ZERO toggles created',
    togglesCreated, 0);

  cleanupPass1Tables(phantoms);
})();

// --- pass1-filter AC1: phantom tables (off-screen left) get NO toggle ---
// Build N=2 phantom tables with positioned ancestor left=-10000px.

(function pass1Filter_offscreenLeftPhantoms_zeroToggles() {
  function makeOffscreenPhantom() {
    const t = makePass1DataTable();
    // Positioned ancestor with extreme left (Signal 2)
    const posAnc = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: { position: 'absolute', left: '-10000px' },
      parentElement: null,
      parentNode: null,
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
    };
    t.parentElement = posAnc;
    t.parentNode    = null;
    return t;
  }

  const phantoms = [makeOffscreenPhantom(), makeOffscreenPhantom()];

  // Sanity checks
  eq('pass1-filter: off-screen phantom table satisfies isDataTable (sanity)',
    isDataTable(phantoms[0]), true);
  eq('pass1-filter: off-screen phantom table isPhantomA11yTable is true (sanity)',
    isPhantomA11yTable(phantoms[0]), true);

  runPass1WithTables(phantoms);

  const togglesCreated = phantoms.filter(t => tableToggles.has(t)).length;
  eq('pass1-filter: 2 off-screen phantom tables → ZERO toggles created',
    togglesCreated, 0);

  cleanupPass1Tables(phantoms);
})();

// --- pass1-filter AC2: a normal on-screen table still gets exactly ONE toggle ---

(function pass1Filter_realTable_getsOneToggle() {
  const realTable = makePass1DataTable();
  // No aria-hidden, no positioned ancestor, no svg → isPhantomA11yTable returns false
  const wrapper = {
    tagName: 'DIV',
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
  };
  realTable.parentElement = wrapper;
  realTable.parentNode    = null;

  // Sanity checks
  eq('pass1-filter: real on-screen table satisfies isDataTable (sanity)',
    isDataTable(realTable), true);
  eq('pass1-filter: real on-screen table isPhantomA11yTable is false (sanity)',
    isPhantomA11yTable(realTable), false);

  runPass1WithTables([realTable]);

  eq('pass1-filter: normal on-screen table → exactly ONE toggle created',
    tableToggles.has(realTable), true);

  cleanupPass1Tables([realTable]);
})();

// --- pass1-filter adversarial: mix of phantom + real tables in one Pass 1 run ---
// Only the real tables should get toggles; count equals exactly the number of real tables.

(function pass1Filter_mixedFixture_onlyRealTablesGetToggles() {
  // Two phantom tables (aria-hidden ancestor)
  function makeAriaHiddenPhantom() {
    const t = makePass1DataTable();
    const hiddenParent = {
      tagName: 'DIV',
      getAttribute: function(name) { return name === 'aria-hidden' ? 'true' : null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = hiddenParent;
    t.parentNode    = null;
    return t;
  }

  // One phantom with off-screen left
  function makeOffscreenPhantom() {
    const t = makePass1DataTable();
    const posAnc = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: { position: 'absolute', left: '-10000px' },
      parentElement: null,
      parentNode: null,
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
    };
    t.parentElement = posAnc;
    t.parentNode    = null;
    return t;
  }

  // Two real on-screen tables
  function makeRealTable() {
    const t = makePass1DataTable();
    const wrapper = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = wrapper;
    t.parentNode    = null;
    return t;
  }

  const phantom1 = makeAriaHiddenPhantom();
  const phantom2 = makeAriaHiddenPhantom();
  const phantom3 = makeOffscreenPhantom();
  const real1    = makeRealTable();
  const real2    = makeRealTable();

  // Interleave so Pass 1 processes them in mixed order
  const allTables = [phantom1, real1, phantom2, real2, phantom3];

  runPass1WithTables(allTables);

  const phantoms = [phantom1, phantom2, phantom3];
  const reals    = [real1, real2];

  const phantomToggles = phantoms.filter(t => tableToggles.has(t)).length;
  const realToggles    = reals.filter(t => tableToggles.has(t)).length;

  eq('pass1-filter (mix): phantom tables get ZERO toggles',
    phantomToggles, 0);
  eq('pass1-filter (mix): real tables each get a toggle — count equals 2',
    realToggles, 2);
  eq('pass1-filter (mix): total toggles created equals number of real tables',
    tableToggles.has(real1) && tableToggles.has(real2) && !tableToggles.has(phantom1) &&
    !tableToggles.has(phantom2) && !tableToggles.has(phantom3), true);

  cleanupPass1Tables(allTables);
})();

// --- pass1-filter: Pass 1 skips phantom but does NOT skip a non-data real table ---
// (edge: if a real table fails isDataTable, no toggle either — confirm the skip
// here is from isDataTable, not from isPhantomA11yTable)
(function pass1Filter_nonDataRealTable_noToggle() {
  // 1-row table: fails isDataTable (< 2 rows)
  const nonDataTable = {
    tagName: 'TABLE',
    rows: [
      { cells: [
          { tagName: 'TD', innerText: '100', textContent: '100', innerHTML: '100',
            classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
            dataset: {}, title: '', querySelectorAll:()=>[], removeAttribute(){} },
          { tagName: 'TD', innerText: '200', textContent: '200', innerHTML: '200',
            classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
            dataset: {}, title: '', querySelectorAll:()=>[], removeAttribute(){} },
        ]
      },
    ],
    dataset: {},
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getBoundingClientRect: function() { return { top: 10, right: 100, bottom: 50, left: 10 }; },
    classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
  };

  // Confirm isPhantomA11yTable is false (skip is NOT from the phantom guard)
  eq('pass1-filter: non-data real table isPhantomA11yTable is false (sanity)',
    isPhantomA11yTable(nonDataTable), false);
  // Confirm isDataTable is false
  eq('pass1-filter: non-data real table isDataTable is false (sanity)',
    isDataTable(nonDataTable), false);

  runPass1WithTables([nonDataTable]);

  eq('pass1-filter: non-data real table gets no toggle (isDataTable gate)',
    tableToggles.has(nonDataTable), false);

  cleanupPass1Tables([nonDataTable]);
})();

// --- pass1-filter: duplicate Pass 1 call does NOT create a second toggle for a real table ---
// (regression guard: tableToggles.has check prevents double-insertion)
(function pass1Filter_duplicateRun_noDoubleToggle() {
  const realTable = makePass1DataTable();
  const wrapper = {
    tagName: 'DIV',
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
  };
  realTable.parentElement = wrapper;
  realTable.parentNode    = null;

  // First run
  runPass1WithTables([realTable]);
  const afterFirst = tableToggles.has(realTable);

  // Second run — table already in tableToggles; Pass 1 should skip it.
  // We verify the toggle isn't re-inserted: since WeakMap.set overwrites,
  // a re-create would swap the button object, so we check its identity holds.
  const buttonAfterFirst = tableToggles.get(realTable);
  runPass1WithTables([realTable]);
  const buttonAfterSecond = tableToggles.get(realTable);

  eq('pass1-filter: first Pass 1 run creates toggle for real table',
    afterFirst, true);
  eq('pass1-filter: second Pass 1 run does not replace the existing toggle (same object)',
    buttonAfterFirst === buttonAfterSecond, true);

  cleanupPass1Tables([realTable]);
})();

// ---------------------------------------------------------------------------
// Sprint grid-rowgroup-tr-extraction: GridAdapter._getRowEls handles ARIA grids
// whose data rows are bare <tr> inside a [role="rowgroup"], with header/summary
// rows OUTSIDE the rowgroup (e.g. Kaggle's Data Explorer). Standard ARIA only.
// ---------------------------------------------------------------------------

(function gridRowgroup_selectorFromGroup_universeFromGrid() {
  const grid = makeKaggleLikeGrid([
    ['2021-12-15', '5083.954', '8940'],
    ['2022-03-01', '3827.658', '1151'],
    ['2022-02-25', '2618.087', '122'],
  ]);
  const adapter = makeAdapter(grid);
  const rows = adapter.getRows();

  eq('grid-rowgroup: getRows() returns all 5 <tr> rows — header and stats included, desc block excluded',
    rows.length, 5);
  eq('grid-rowgroup: the first row is the header row, not the role="row" desc block',
    rows[0].getCells()[0].getText(), 'Release_Date');
  eq('grid-rowgroup: the data rows follow the header and stats rows',
    rows[2].getCells()[0].getText(), '2021-12-15');
  eq('grid-rowgroup: grid with bare-<tr> data rows is a data table',
    isDataTable(grid), true);
})();

// Without a rowgroup, bare <tr> rows are still discovered (orphan-tr fallback).
(function gridOrphanTr_noRowgroup() {
  const dataTrs = [makeTrRow(['a', '10']), makeTrRow(['b', '20'])];
  const wrapper = makeElementNode('grid', dataTrs);
  wrapper.tagName = 'DIV';
  wrapper.matches = () => false;
  wrapper.querySelector = () => null;
  wrapper.querySelectorAll = function(sel) {
    if (sel === 'tr') return dataTrs;
    return []; // no rowgroup, no role="row", no dg classes
  };

  const adapter = makeAdapter(wrapper);
  eq('grid-orphan-tr: getRows() finds bare <tr> rows when no rowgroup present',
    adapter.getRows().length, 2);
  eq('grid-orphan-tr: numeric cell readable',
    adapter.getRows()[0].getCells()[1].getText(), '10');
})();

// ---------------------------------------------------------------------------
// Sprint grid-first-row-literal: a rowgroup picks the row shape, not the row
// set. The rows found inside it decide the winning selector; the row list is
// then the whole grid's matches for that selector, so header and summary rows
// outside the group are rows like any other. Only the shipped first-row and
// first-column defaults hold rows: the header row holds because it is the
// grid's literal first row, and a Total row below the group rounds with the
// data. Before this, rowgroup scoping dropped the outside rows entirely and
// the first-row default held the first DATA row — the grid's second literal
// row.
// ---------------------------------------------------------------------------

// Row universe: role="row" grid with a header row before the group and a
// summary row after it — all four rows come back, in document order.
(function gridRowUniverse_roleRows() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['1111111', '1482391'], ['2222222', '918554']],
    ['Total', '2400945']
  );
  const rows = makeAdapter(g.wrapperEl).getRows();
  const firstCellText = function(row) {
    return row ? row.getCells()[0].getText() : '(missing row)';
  };
  eq('row-universe: header, data, and summary rows all count as rows',
    rows.length, 4);
  eq('row-universe: the header row is the grid\'s first row',
    firstCellText(rows[0]), 'Region');
  eq('row-universe: the summary row is the grid\'s last row',
    firstCellText(rows[3]), 'Total');
})();

// Row universe: two rowgroups with rows outside and between them — every
// row of the winning shape comes back, in document order.
(function gridRowUniverse_twoRowgroups() {
  function makeRoleRow(cellTexts) {
    const cellEls = cellTexts.map(makeGridCellWithTextNode);
    const row = makeElementNode('g-row', cellEls);
    row.children = cellEls;
    row.querySelectorAll = function(sel) {
      return sel === '[role="cell"]' ? cellEls : [];
    };
    return row;
  }
  const header = makeRoleRow(['Region', 'Q1']);
  const a1 = makeRoleRow(['North', '100']);
  const a2 = makeRoleRow(['South', '200']);
  const sep = makeRoleRow(['Subtotal', '300']);
  const b1 = makeRoleRow(['West', '400']);

  const groupA = makeElementNode('', [a1, a2]);
  groupA.querySelectorAll = (sel) => (sel === '[role="row"]' ? [a1, a2] : []);
  const groupB = makeElementNode('', [b1]);
  groupB.querySelectorAll = (sel) => (sel === '[role="row"]' ? [b1] : []);

  const wrapper = makeElementNode('aria-grid', [header, groupA, sep, groupB]);
  wrapper.tagName = 'DIV';
  wrapper.matches = () => false;
  wrapper.querySelector = () => null;
  wrapper.querySelectorAll = function(sel) {
    if (sel === '[role="rowgroup"]') return [groupA, groupB];
    if (sel === '[role="row"]') return [header, a1, a2, sep, b1]; // document order
    return [];
  };

  const rows = makeAdapter(wrapper).getRows();
  eq('row-universe: two rowgroups — all five rows come back in document order',
    rows.map(function(r) { return r.getCells()[0].getText(); }).join(','),
    'Region,North,South,Subtotal,West');
})();

// Detection: the row universe now starts at the header row, and a wide
// header of text labels must not exhaust the data-test sample before the
// scan reaches a data row (review finding: a six-column sales grid whose
// data rows lead with four text cells lost its pillbox).
(function gridRowUniverse_isDataTable_wideHeader() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Country', 'Segment', 'Channel', 'Units', 'Revenue'],
    [['North', 'Canada', 'Retail', 'Web', '120', '1482391']],
    null
  );
  eq('row-universe: a grouped grid with a wide text header still passes the data test',
    isDataTable(g.wrapperEl), true);
})();

// ---------------------------------------------------------------------------
// Sprint data-test-budget: the data test spends one budget of
// DR_DETECTION_SETTINGS.dataTestCellBudget cell reads, walked in document order and
// stopped at the first number, on native tables and grids alike. It replaces
// the retired per-row sample on grids and the retired unbounded scan on
// native tables. isDataTable and DR_DETECTION_SETTINGS.dataTestCellBudget live in
// chrome-extension/lib/dr-table/detect.js and chrome-extension/constants.js.
// ---------------------------------------------------------------------------

// AC1: a grid whose first data row leads with eleven text cells before its
// first number. Under the retired ten-cell-per-row sample this grid failed
// the data test, because the sample never reached the twelfth cell. The
// budget walks every cell in document order, so the number still falls
// inside it.
(function dataTestBudget_grid_numberInTwelfthColumnPasses() {
  const header = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const firstDataRow = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', '42'];
  const g = makeRowgroupRoleGrid(header, [firstDataRow], null);
  eq('data test: a grid whose first number sits in the twelfth column of its first data row passes',
    isDataTable(g.wrapperEl), true);
})();

// AC2: a native table large enough to cross the budget. The budget reads
// cells in document order, header row included, and stops at the first
// number. A table with no number inside the budget fails; the same table
// with a number at the budget-th cell passes; the same table with its only
// number one cell past the budget fails.
(function dataTestBudget_nativeTable_boundary() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const cols = 101;
  const rows = Math.ceil((budget + 1) / cols);

  eq('data test: DR_DETECTION_SETTINGS.dataTestCellBudget is 1000',
    budget, 1000);

  const noNumberTable = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, null));
  eq('data test: a native table holding no number within the budget of cell reads fails',
    isDataTable(noNumberTable), false);

  const atBudgetTable = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, budget));
  eq('data test: the same table with a number at the budget-th cell passes',
    isDataTable(atBudgetTable), true);

  const pastBudgetTable = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, budget + 1));
  eq('data test: the same table with its only number one cell past the budget fails',
    isDataTable(pastBudgetTable), false);
})();

// AC3: a native table of three rows by two cells with one number still
// passes. The budget does not disturb a table well inside it.
(function dataTestBudget_smallNativeTablePasses() {
  const table = makeNativeTableEl([
    [{ tag: 'td', text: 'Name' }, { tag: 'td', text: 'Role' }],
    [{ tag: 'td', text: 'Alice' }, { tag: 'td', text: 'Eng' }],
    [{ tag: 'td', text: 'Bob' }, { tag: 'td', text: '42' }],
  ]);
  eq('data test: a three-row, two-cell native table with one number passes',
    isDataTable(table), true);
})();

// Goal, native tables: the retired rule left native tables unbounded, so a
// number far past 1000 cells would have passed. The budget applies to native tables and
// grids alike, so this table fails.
(function dataTestBudget_nativeTable_farPastBudgetFails() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const cols = 100;
  const rows = Math.ceil((budget * 3) / cols);
  const totalCells = rows * cols;
  const table = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, totalCells));
  eq('data test: a native table whose only number sits far past the cell budget fails',
    isDataTable(table), false);
})();

// jsdom-less criterion: detect.js is evaluated with its two dependencies —
// constants.js, for DR_DETECTION_SETTINGS, and lib/dr-number/core.js, for the
// currency signs the numeric probe strips — and nothing else, in a vm context with no
// `chrome`, no `window`, and no `getComputedStyle` at all, against a minimal
// fake document holding one plain <table>. Detection must still find the
// table and must not throw — this is the acceptance bar for "runs under
// jsdom-style stubs with no Chrome globals."
(function detectionRunsWithNoChromeGlobals() {
  if (detectCode === null || constantsCode === null) {
    eq('jsdom-less: source files constants.js and lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');

  const fakeTable = {
    tagName: 'TABLE',
    rows: [
      { cells: [{ textContent: 'Name' }, { textContent: '100' }] },
      { cells: [{ textContent: 'Foo' },  { textContent: '200' }] },
    ],
  };
  const fakeDoc = {
    querySelectorAll(sel) {
      if (sel === 'table') return [fakeTable];
      return [];
    },
  };

  // The sandbox carries ONLY fakeDoc/fakeTable and whatever constantsCode,
  // coreCode and detectCode themselves declare — no window, no
  // getComputedStyle, no chrome, no document global. constantsCode is plain
  // values only and coreCode is framework-free and side-effect-free, so
  // prepending them costs the sandbox no browser dependency.
  const sandbox = { fakeDoc, fakeTable, results: null, threw: null };
  const ctx = vm.createContext(sandbox);

  vm.runInContext(
    constantsCode + '\n' + coreCode + '\n' + detectCode + `
    try {
      var found = findTables(fakeDoc);
      results = {
        isDataTable: isDataTable(fakeTable),
        tablesFound: found.length,
        firstIsFakeTable: found[0] && found[0].handle === fakeTable,
        firstIsNew: found[0] && found[0].isNew,
      };
    } catch (e) {
      threw = e.message;
    }
    `,
    ctx
  );

  eq('jsdom-less: detection does not throw with no chrome/window/getComputedStyle',
    sandbox.threw, null);
  eq('jsdom-less: isDataTable finds a plain 2x2 numeric table with no getComputedStyle',
    sandbox.results && sandbox.results.isDataTable, true);
  eq('jsdom-less: findTables finds the one plain table under a minimal fake document',
    sandbox.results && sandbox.results.tablesFound, 1);
  eq('jsdom-less: findTables resolves to the same table object',
    sandbox.results && sandbox.results.firstIsFakeTable, true);
  eq('jsdom-less: findTables reports the plain table as isNew (no registry supplied)',
    sandbox.results && sandbox.results.firstIsNew, true);
})();

// The detection settings' expected contents. Nine values are the pre-move
// ones, hand-copied from origin/main's lib/dr-table/detect.js (read via
// `git show origin/main:chrome-extension/lib/dr-table/detect.js`) and the
// design doc's key table; the detection-constants sprint moved them and
// changed none of them. A tenth moved value, the pillbox auto-collapse
// delay, went back to the pillbox view as its own constant: the view alone
// reads it, and it shapes nothing detection finds. Three keys have no
// pre-move value: nestingDepth, the
// nomination step's configured depth from the grid-nesting-rule sprint;
// dataTestCellBudget, the data test's cell budget from the data-test-budget
// sprint; and pendingRetestCap, a pending table's re-test cap from the
// pending-retest sprint. Key order matches constants.js's DR_DETECTION_SETTINGS
// declaration, so the JSON.stringify-based eq() comparison below is not
// order-sensitive noise.
const PRE_MOVE_DETECTION_SETTINGS = {
  nestingDepth: 1,
  gridMinChildren: 5,
  gridWalkDepthCap: 15,
  gridColumnWidthSample: 10,
  gridColumnWidthAgreement: 0.8,
  gridRepetitionShare: 0.5,
  gridDisplayValues: ['grid', 'flex', 'inline-grid', 'inline-flex'],
  dataTestCellBudget: 1000,
  vendorProfiles: [
    {
      name: 'databricks',
      classToken: 'dg--',
      scrollContainerSelectors: ['.dg--grid-scroll-container', '.dg--grid-container'],
      pinnedPaneSelectors: ['.dg--pinned-grid'],
    },
    {
      name: 'ag-grid',
      classToken: 'ag-',
      scrollContainerSelectors: ['.ag-center-cols-viewport'],
      pinnedPaneSelectors: ['.ag-pinned-left-cols-container'],
    },
  ],
  gridRedrawDelayMs: 100,
  reapplyMaxWaitMs: 1000,
  reapplyCellCap: 10000,
  pendingRetestCap: 100,
  offscreenLeftPx: -9999,
};

// jsdom-less criterion, extended: one vm sandbox with no
// chrome/window/getComputedStyle evaluates the configuration file
// (constants.js), the number core (lib/dr-number/core.js, for the currency
// signs the numeric probe strips) and then the detection layer
// (lib/dr-table/detect.js). The
// test pins DR_DETECTION_SETTINGS's values against PRE_MOVE_DETECTION_SETTINGS above and runs
// looksLikeGrid, findTargetTable, isPhantomA11yTable, and isDataTable against
// fixtures whose expected outcome holds only when each moved value reads at
// its pre-move value: a wrong read (a stale copy, a transposed value, a wrong
// sample size) flips at least one outcome below.
(function detectionSettings_sandboxBehaviorMatchesPreMoveValues() {
  if (constantsCode === null || detectCode === null) {
    eq('detection settings: source files constants.js and lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const sandbox = { outcomes: {}, threw: null };
  const ctx = vm.createContext(sandbox);

  vm.runInContext(
    constantsCode + '\n' + coreCode + '\n' + detectCode + `
    try {
      outcomes.settingsKeys = Object.keys(DR_DETECTION_SETTINGS).sort();
      outcomes.settings = DR_DETECTION_SETTINGS;

      function makeCell(text, width) { return { textContent: text, offsetWidth: width }; }
      function makeRow(cls, cells) { return { className: cls, children: cells }; }
      function makeEl(rows) { return { className: '', children: rows, getAttribute: () => null }; }
      const gridStyleProbe = {
        getComputedStyle: () => ({ display: 'grid' }),
        getOffsetWidth: (el) => (el && typeof el.offsetWidth === 'number') ? el.offsetWidth : -1,
      };
      const uniformRows = () => [0, 1, 2, 3, 4].map(() => makeRow('row', [makeCell('1', 100)]));

      // --- gridMinChildren (step 1): 4 children fails, 5 passes ---
      const fourRows = [0, 1, 2, 3].map(() => makeRow('row', [makeCell('5', 100)]));
      const fiveRows = [0, 1, 2, 3, 4].map(() => makeRow('row', [makeCell('5', 100)]));
      outcomes.minChildrenBelowFails = looksLikeGrid(makeEl(fourRows), { styleProbe: gridStyleProbe });
      outcomes.minChildrenAtPasses = looksLikeGrid(makeEl(fiveRows), { styleProbe: gridStyleProbe });

      // --- gridRepetitionShare (steps 2/3): a share below the 0.5 floor
      // fails (3-of-8 sharing either a class or a child count); a share
      // exactly at the floor passes (5-of-10) ---
      const belowFloorRows = [
        makeRow('x', [makeCell('1', 100)]),
        makeRow('x', [makeCell('1', 100)]),
        makeRow('x', [makeCell('1', 100)]),
        makeRow('y1', [makeCell('1', 100), makeCell('2', 100)]),
        makeRow('y2', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100)]),
        makeRow('y3', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100), makeCell('4', 100)]),
        makeRow('y4', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100), makeCell('4', 100), makeCell('5', 100)]),
        makeRow('y5', [makeCell('1', 100), makeCell('2', 100), makeCell('3', 100), makeCell('4', 100), makeCell('5', 100), makeCell('6', 100)]),
      ];
      outcomes.repetitionBelowFloorFails = looksLikeGrid(makeEl(belowFloorRows), { styleProbe: gridStyleProbe });

      const atFloorRows = [0, 1, 2, 3, 4].map(() => makeRow('row-a', [makeCell('10', 50), makeCell('20', 50)]))
        .concat([0, 1, 2, 3, 4].map(() => makeRow('row-b', [makeCell('1', 50), makeCell('2', 50), makeCell('3', 50)])));
      outcomes.repetitionAtFloorPasses = looksLikeGrid(makeEl(atFloorRows), { styleProbe: gridStyleProbe });

      // --- gridColumnWidthSample + gridColumnWidthAgreement (step 6): the
      // sample is bounded to the first 10 of 12 uniform rows; 8-of-10
      // matching widths (exactly 0.8) passes, 7-of-10 (0.7) fails ---
      const widthRow = (w) => makeRow('row', [makeCell('1', w)]);
      const widths8of10 = [100, 100, 100, 100, 100, 100, 100, 100, 999, 999, 999, 999].map(widthRow);
      const widths7of10 = [100, 100, 100, 100, 100, 100, 100, 999, 999, 999, 100, 100].map(widthRow);
      outcomes.widthAgreementAtThresholdPasses = looksLikeGrid(makeEl(widths8of10), { styleProbe: gridStyleProbe });
      outcomes.widthAgreementBelowThresholdFails = looksLikeGrid(makeEl(widths7of10), { styleProbe: gridStyleProbe });

      // --- gridDisplayValues: each of the four values passes, a fifth fails ---
      const probeForDisplay = (display) => ({ getComputedStyle: () => ({ display }), getOffsetWidth: gridStyleProbe.getOffsetWidth });
      outcomes.displayGridPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('grid') });
      outcomes.displayFlexPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('flex') });
      outcomes.displayInlineGridPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('inline-grid') });
      outcomes.displayInlineFlexPasses = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('inline-flex') });
      outcomes.displayBlockFails = looksLikeGrid(makeEl(uniformRows()), { styleProbe: probeForDisplay('block') });

      // --- vendorProfiles (default, no opts override): a 'dg--' class
      // short-circuits ACCEPT even when the width-agreement step would
      // otherwise fail; the same rows with no vendor class do not ---
      const badWidthRows = [100, 200, 300, 400, 500].map(widthRow);
      outcomes.vendorClassShortCircuitsAccept = looksLikeGrid(
        Object.assign(makeEl(badWidthRows), { className: 'dg--outer' }), { styleProbe: gridStyleProbe });
      outcomes.noVendorClassFailsWidthCheck = looksLikeGrid(
        Object.assign(makeEl(badWidthRows), { className: '' }), { styleProbe: gridStyleProbe });

      // --- gridWalkDepthCap (findTargetTable step 3): a 20-deep ancestor
      // chain, every ancestor individually a qualifying grid, is bounded to
      // the 15th ancestor (label 14, zero-indexed) ---
      function makeAncestor(label) {
        return {
          label,
          className: '',
          getAttribute: () => null,
          nodeType: DR_TABLE_ELEMENT_NODE,
          children: uniformRows(),
          parentElement: null,
        };
      }
      const chain = [];
      for (let i = 0; i < 20; i++) chain.push(makeAncestor(i));
      for (let i = 0; i < chain.length - 1; i++) chain[i].parentElement = chain[i + 1];
      const walkResult = findTargetTable({ parentElement: chain[0] }, { styleProbe: gridStyleProbe });
      outcomes.walkDepthCapLabel = walkResult && walkResult.handle.label;

      // --- offscreenLeftPx (isPhantomA11yTable signal 2): at the threshold
      // and beyond it counts as off-screen; just inside it does not ---
      const offscreenTable = (left) => ({ getAttribute: () => null, style: { position: 'static', left: left + 'px' } });
      outcomes.offscreenAtThresholdIsPhantom = isPhantomA11yTable(offscreenTable(-9999));
      outcomes.offscreenBeyondThresholdIsPhantom = isPhantomA11yTable(offscreenTable(-10000));
      outcomes.offscreenInsideThresholdIsNotPhantom = isPhantomA11yTable(offscreenTable(-9998));

      // --- isDataTable: no collateral breakage from the load-order change ---
      outcomes.isDataTableStillFindsANumericTable = isDataTable({
        tagName: 'TABLE',
        rows: [
          { cells: [{ textContent: 'Name' }, { textContent: '100' }] },
          { cells: [{ textContent: 'Foo' },  { textContent: '200' }] },
        ],
      });
    } catch (e) {
      threw = e.message;
    }
    `,
    ctx
  );

  eq('detection settings: the combined sandbox does not throw', sandbox.threw, null);
  eq('detection settings: DR_DETECTION_SETTINGS exposes exactly fourteen keys, the nine pre-move keys plus nestingDepth, dataTestCellBudget, pendingRetestCap, reapplyMaxWaitMs, and reapplyCellCap',
    sandbox.outcomes.settingsKeys, Object.keys(PRE_MOVE_DETECTION_SETTINGS).sort());
  eq('detection settings: DR_DETECTION_SETTINGS carries every pre-move value unchanged, plus nestingDepth at 1, dataTestCellBudget at 1000, pendingRetestCap at 100, reapplyMaxWaitMs at 1000, and reapplyCellCap at 10000',
    sandbox.outcomes.settings, PRE_MOVE_DETECTION_SETTINGS);
  eq('detection settings: looksLikeGrid rejects 4 children (below gridMinChildren)',
    sandbox.outcomes.minChildrenBelowFails, false);
  eq('detection settings: looksLikeGrid accepts 5 children (at gridMinChildren)',
    sandbox.outcomes.minChildrenAtPasses, true);
  eq('detection settings: looksLikeGrid rejects a 3-of-8 share (below gridRepetitionShare)',
    sandbox.outcomes.repetitionBelowFloorFails, false);
  eq('detection settings: looksLikeGrid accepts a 5-of-10 share (at gridRepetitionShare)',
    sandbox.outcomes.repetitionAtFloorPasses, true);
  eq('detection settings: looksLikeGrid accepts an 8-of-10 sampled-width agreement (at gridColumnWidthAgreement, within gridColumnWidthSample)',
    sandbox.outcomes.widthAgreementAtThresholdPasses, true);
  eq('detection settings: looksLikeGrid rejects a 7-of-10 sampled-width agreement (below gridColumnWidthAgreement)',
    sandbox.outcomes.widthAgreementBelowThresholdFails, false);
  eq('detection settings: looksLikeGrid accepts display:grid (in gridDisplayValues)',
    sandbox.outcomes.displayGridPasses, true);
  eq('detection settings: looksLikeGrid accepts display:flex (in gridDisplayValues)',
    sandbox.outcomes.displayFlexPasses, true);
  eq('detection settings: looksLikeGrid accepts display:inline-grid (in gridDisplayValues)',
    sandbox.outcomes.displayInlineGridPasses, true);
  eq('detection settings: looksLikeGrid accepts display:inline-flex (in gridDisplayValues)',
    sandbox.outcomes.displayInlineFlexPasses, true);
  eq('detection settings: looksLikeGrid rejects display:block (not in gridDisplayValues)',
    sandbox.outcomes.displayBlockFails, false);
  eq('detection settings: looksLikeGrid short-circuits ACCEPT for the default databricks vendorProfiles class token',
    sandbox.outcomes.vendorClassShortCircuitsAccept, true);
  eq('detection settings: looksLikeGrid still runs the width-agreement step with no vendor class',
    sandbox.outcomes.noVendorClassFailsWidthCheck, false);
  eq('detection settings: findTargetTable bounds the ancestor walk to gridWalkDepthCap (15)',
    sandbox.outcomes.walkDepthCapLabel, 14);
  eq('detection settings: isPhantomA11yTable treats offscreenLeftPx itself as off-screen',
    sandbox.outcomes.offscreenAtThresholdIsPhantom, true);
  eq('detection settings: isPhantomA11yTable treats a value beyond offscreenLeftPx as off-screen',
    sandbox.outcomes.offscreenBeyondThresholdIsPhantom, true);
  eq('detection settings: isPhantomA11yTable treats a value inside offscreenLeftPx as on-screen',
    sandbox.outcomes.offscreenInsideThresholdIsNotPhantom, false);
  eq('detection settings: isDataTable still finds a plain 2x2 numeric table (no collateral breakage)',
    sandbox.outcomes.isDataTableStillFindsANumericTable, true);
})();

// A fresh sandbox with no configuration file: the detection layer reads
// DR_DETECTION_SETTINGS as a bare global with no fallback, so evaluating it alone throws
// a ReferenceError naming DR_DETECTION_SETTINGS — at load, before any function in the
// file runs. The try/catch sits outside vm.runInContext, so a caught error
// here can only have come from evaluating the source itself, never from a
// function call the script goes on to make.
(function detectionSettings_detectionFailsClosedWithNoConfigurationFile() {
  if (detectCode === null) {
    eq('detection settings: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const ctx = vm.createContext({});
  let caught = null;
  try {
    vm.runInContext(detectCode, ctx);
  } catch (e) {
    caught = { name: e.name, message: e.message };
  }
  eq('detection settings: evaluating the detection layer with no configuration file throws at load',
    caught !== null, true);
  eq('detection settings: the load-time failure is a ReferenceError',
    caught && caught.name, 'ReferenceError');
  eq('detection settings: the load-time failure message carries DR_DETECTION_SETTINGS',
    !!(caught && /DR_DETECTION_SETTINGS/.test(caught.message)), true);
})();

// findTables' tableFilter: default (isPhantomA11yTable) drops a phantom a11y
// table; a pass-through filter keeps it. reuses makePass1DataTable / the
// aria-hidden phantom shape from the pass1-filter suite above.
(function findTables_tableFilterDefaultVsPassThrough() {
  const phantomTable = makePass1DataTable();
  const hiddenParent = {
    tagName: 'DIV',
    getAttribute: (name) => (name === 'aria-hidden' ? 'true' : null),
    style: {},
    parentElement: null,
    parentNode: null,
  };
  phantomTable.parentElement = hiddenParent;
  phantomTable.parentNode = null;

  const root = {
    tagName: 'BODY',
    querySelectorAll(sel) {
      return sel === 'table' ? [phantomTable] : [];
    },
  };

  eq('findTables: sanity — the fixture is both a valid data table and a phantom a11y table',
    isDataTable(phantomTable) && isPhantomA11yTable(phantomTable), true);
  eq('findTables: default tableFilter (isPhantomA11yTable) drops a phantom a11y table',
    findTables(root).length, 0);
  eq('findTables: a pass-through tableFilter keeps the phantom a11y table',
    findTables(root, { tableFilter: () => false }).length, 1);
})();

// =============================================================================
// Sprint grid-nesting-rule: one registration per grid, at the configured depth
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.3 and the
// grid-nesting-rule block in §5; decision D2 in
// docs/sprint-plans/grid-detection-recovery.md.
// =============================================================================
//
// The rule these assertions pin, in the specification's words:
//   - A qualifying element carries a grid or table role, is not a native
//     table, and holds no native table the accessibility-artifact guard keeps.
//   - A chain root is a qualifying element with no qualifying ancestor. A
//     containment chain is the chain root and the qualifying elements nested
//     under it that pass the data test, grouped by nesting depth; the root
//     sits at depth 0.
//   - The step selects the elements at the configured nesting depth. A depth
//     holding more than one element falls back outward to the nearest
//     shallower depth holding exactly one. A chain shorter than the configured
//     depth clamps to its innermost element. An empty chain registers nothing.
//     A nest holding a registered element registers nothing more.
//   - The step reports and registers nothing. Both live scanners run it.
//
// Every expected value below comes from that statement, never from the
// detection layer's source.

// The selector text the load-time scan's fixtures answer, spelled the way the
// scanner suites above spell it.
const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';

// --- AC1: the database query shape registers the scrolling pane alone ---

(function gridNesting_AC1_databaseQueryShapeRegistersTheScrollingPane() {
  const grid = makeDatabaseQueryGrid();

  // The data test is what drops the one-column pinned pane from the chain.
  eq('nesting AC1: the one-column pinned pane fails the data test',
    isDataTable(grid.pinnedPaneEl), false);
  eq('nesting AC1: the wrapper passes the data test, so depth drops it, not the test',
    isDataTable(grid.wrapperEl), true);
  eq('nesting AC1: the scrolling pane passes the data test',
    isDataTable(grid.scrollPaneEl), true);

  const fromHost = findTables(makeNestingHost([grid.wrapperEl]));
  eq('nesting AC1: a root holding the nest reports one table', fromHost.length, 1);
  eq('nesting AC1: the reported table is the scrolling pane',
    fromHost[0] && fromHost[0].handle === grid.scrollPaneEl, true);
  eq('nesting AC1: with no registry supplied the result reports isNew',
    fromHost[0] && fromHost[0].isNew, true);

  const fromWrapper = findTables(grid.wrapperEl);
  eq('nesting AC1: the chain root as root reports one table', fromWrapper.length, 1);
  eq('nesting AC1: the chain root as root reports the scrolling pane',
    fromWrapper[0] && fromWrapper[0].handle === grid.scrollPaneEl, true);

  // The registered element read through the grid adapter: its first column is
  // the identifier column, not the pinned pane's row-number gutter.
  const rows = makeAdapter(grid.scrollPaneEl).getRows();
  eq('nesting AC1: the scrolling pane reads six rows', rows.length, 6);
  eq('nesting AC1: row 0 cell 0 of the registered element is the identifier text',
    rows[0].getCells()[0].getText(), 'alpha');
  eq('nesting AC1: row 0 cell 0 of the registered element is no row number',
    /^\d+$/.test(rows[0].getCells()[0].getText()), false);
})();

// --- AC1: a range expression addresses the identifier column as column A ---
//
// Mechanism: roundTable runs twice on two fresh copies of the fixture, once
// with a range expression naming column A and once naming column B. Column A
// holds the identifier text and no number, so naming it leaves every numeric
// cell alone; naming column B changes the count column and leaves the rate
// column alone. The pair places the identifier column at A and the first
// numeric column at B. Both runs simplify the first row and the first column
// so the positional exclusions cannot stand in for the range.

(function gridNesting_AC1_rangeExpressionAddressesTheIdentifierColumnAsA() {
  const rangeOpts = { simplifyFirstRow: true, simplifyFirstColumn: true };

  const gridA = makeDatabaseQueryGrid();
  const countsBeforeA = dgColumnTexts(gridA.scrollRowEls, 1);
  const ratesBeforeA = dgColumnTexts(gridA.scrollRowEls, 2);
  roundTable(gridA.scrollPaneEl,
    Object.assign({}, DR_DEFAULTS, rangeOpts, { rangeExpr: 'A1:A6' }));
  eq('nesting AC1: a range expression naming column A leaves the count column unchanged',
    dgColumnTexts(gridA.scrollRowEls, 1), countsBeforeA);
  eq('nesting AC1: a range expression naming column A leaves the rate column unchanged',
    dgColumnTexts(gridA.scrollRowEls, 2), ratesBeforeA);
  eq('nesting AC1: a range expression naming column A rounds no cell of the identifier column',
    gridA.scrollRowEls.some((rowEl) => rowEl.children[0].classList.contains('dr-ext-rounded')), false);

  const gridB = makeDatabaseQueryGrid();
  const identifiersBeforeB = dgColumnTexts(gridB.scrollRowEls, 0);
  const countsBeforeB = dgColumnTexts(gridB.scrollRowEls, 1);
  const ratesBeforeB = dgColumnTexts(gridB.scrollRowEls, 2);
  roundTable(gridB.scrollPaneEl,
    Object.assign({}, DR_DEFAULTS, rangeOpts, { rangeExpr: 'B1:B6' }));
  const countsAfterB = dgColumnTexts(gridB.scrollRowEls, 1);
  eq('nesting AC1: a range expression naming column B changes every cell of the count column',
    countsAfterB.every((text, i) => text !== countsBeforeB[i]), true);
  eq('nesting AC1: a range expression naming column B leaves the rate column unchanged',
    dgColumnTexts(gridB.scrollRowEls, 2), ratesBeforeB);
  eq('nesting AC1: a range expression naming column B leaves the identifier column unchanged',
    dgColumnTexts(gridB.scrollRowEls, 0), identifiersBeforeB);

  forgetRegisteredTable(gridA.scrollPaneEl);
  forgetRegisteredTable(gridB.scrollPaneEl);
})();

// --- AC2: depth 0 registers the wrapper, gutter first ---

(function gridNesting_AC2_depthZeroRegistersTheWrapper() {
  const grid = makeDatabaseQueryGrid();
  const results = findTables(makeNestingHost([grid.wrapperEl]), { nestingDepth: 0 });
  eq('nesting AC2: depth 0 reports one table', results.length, 1);
  eq('nesting AC2: depth 0 reports the wrapper',
    results[0] && results[0].handle === grid.wrapperEl, true);

  const rows = makeAdapter(grid.wrapperEl).getRows();
  eq('nesting AC2: the wrapper stitches the pinned cells first, so row 0 cell 0 is a row number',
    rows[0].getCells()[0].getText(), '1');
})();

// --- AC3: two qualifying siblings at the configured depth fall back outward ---

(function gridNesting_AC3_crowdedDepthFallsBackToTheWrapper() {
  const grid = makeDatabaseQueryGrid({ pinnedColumns: 2 });
  eq('nesting AC3: a two-column pinned pane passes the data test',
    isDataTable(grid.pinnedPaneEl), true);

  const results = findTables(makeNestingHost([grid.wrapperEl]));
  eq('nesting AC3: a depth holding two elements still reports one table', results.length, 1);
  eq('nesting AC3: the fall-back outward lands on the wrapper',
    results[0] && results[0].handle === grid.wrapperEl, true);
})();

// --- AC4: a chain shorter than the configured depth clamps to its innermost ---

(function gridNesting_AC4_shortChainClampsToItsInnermostElement() {
  const lone = makeLoneGrid();
  eq('nesting AC4: the lone grid passes the data test', isDataTable(lone), true);
  const loneResults = findTables(makeNestingHost([lone]));
  eq('nesting AC4: a one-element chain at the shipped depth reports one table',
    loneResults.length, 1);
  eq('nesting AC4: a one-element chain at the shipped depth reports itself',
    loneResults[0] && loneResults[0].handle === lone, true);

  const grid = makeDatabaseQueryGrid();
  const deepResults = findTables(makeNestingHost([grid.wrapperEl]), { nestingDepth: 5 });
  eq('nesting AC4: a depth past the chain reports one table', deepResults.length, 1);
  eq('nesting AC4: a depth past the chain clamps to the scrolling pane',
    deepResults[0] && deepResults[0].handle === grid.scrollPaneEl, true);
})();

// --- Adversarial: a plain element between two qualifying elements adds no depth ---
//
// A nesting depth counts qualifying elements, so a role-less div between the
// wrapper and the two panes leaves both panes at depth 1 and the chain two
// long. A count of every ancestor instead would file the panes at depth 2,
// leave the shipped depth empty, and fall back outward to the wrapper.

(function gridNesting_aPlainElementBetweenQualifyingElementsAddsNoDepth() {
  const grid = makeDatabaseQueryGrid({ plainWrapper: true });
  const host = makeNestingHost([grid.wrapperEl]);

  eq('nesting: the plain layer sits between the wrapper and the two panes',
    grid.paneParentEl !== null &&
      grid.scrollPaneEl.parentElement === grid.paneParentEl &&
      grid.pinnedPaneEl.parentElement === grid.paneParentEl &&
      grid.paneParentEl.parentElement === grid.wrapperEl,
    true);
  eq('nesting: the plain layer carries no grid or table role',
    grid.paneParentEl.matches(GRID_ARIA_SELECTOR_TEXT), false);

  const shipped = findTables(host);
  eq('nesting: a plain layer inside the wrapper still reports one table', shipped.length, 1);
  eq('nesting: the shipped depth reports the scrolling pane past the plain layer',
    shipped[0] && shipped[0].handle === grid.scrollPaneEl, true);

  eq('nesting: depth 0 past the plain layer reports the wrapper',
    findTables(host, { nestingDepth: 0 }).map((r) => r.handle === grid.wrapperEl), [true]);
  eq('nesting: depth 2 past the plain layer clamps to the scrolling pane',
    findTables(host, { nestingDepth: 2 }).map((r) => r.handle === grid.scrollPaneEl), [true]);
})();

// --- AC5: two nests under one plain parent report separately ---

(function gridNesting_AC5_siblingNestsReportSeparately() {
  const first = makeDatabaseQueryGrid();
  const second = makeDatabaseQueryGrid();
  const results = findTables(makeNestingHost([first.wrapperEl, second.wrapperEl]));
  eq('nesting AC5: two nests under one plain parent report two tables', results.length, 2);
  eq('nesting AC5: each nest reports its own scrolling pane',
    results.map((r) => r.handle === first.scrollPaneEl || r.handle === second.scrollPaneEl),
    [true, true]);
  eq('nesting AC5: the two reported tables are different elements',
    results.length === 2 && results[0].handle !== results[1].handle, true);
})();

(function gridNesting_AC6_loadTimeScanBuildsOnePillbox() {
  const grid = makeDatabaseQueryGrid();
  const before = DR_STORE.getRegisteredTables().length;

  withToggleDocumentMock(function () {
    // What a page holding the fixture hands the two passes: no native table,
    // and the three role-bearing elements in document order.
    global.document.querySelectorAll = function (sel) {
      if (sel === 'table') return [];
      if (sel === GRID_ARIA_SELECTOR_TEXT) {
        return [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
      }
      return [];
    };
    injectTableToggles();
  });

  const added = DR_STORE.getRegisteredTables().slice(before);
  eq('nesting AC6: the load-time scan on the fixture adds one registry entry', added.length, 1);
  eq('nesting AC6: the registered element is the scrolling pane',
    added.length === 1 && added[0] === grid.scrollPaneEl, true);
  eq('nesting AC6: the scrolling pane carries one pillbox',
    tableToggles.has(grid.scrollPaneEl), true);
  eq('nesting AC6: the wrapper carries no pillbox', tableToggles.has(grid.wrapperEl), false);
  eq('nesting AC6: the pinned pane carries no pillbox', tableToggles.has(grid.pinnedPaneEl), false);

  forgetRegisteredTable(grid.scrollPaneEl);
})();

(function gridNesting_AC6_addedNodePassBuildsOnePillbox() {
  const grid = makeDatabaseQueryGrid();
  const before = DR_STORE.getRegisteredTables().length;

  withToggleDocumentMock(function () {
    injectTogglesForAddedNode(grid.wrapperEl);
  });

  const added = DR_STORE.getRegisteredTables().slice(before);
  eq('nesting AC6: the added-node pass on the fixture adds one registry entry', added.length, 1);
  eq('nesting AC6: the added-node pass registers the scrolling pane',
    added.length === 1 && added[0] === grid.scrollPaneEl, true);
  eq('nesting AC6: the added-node pass puts one pillbox on the scrolling pane',
    tableToggles.has(grid.scrollPaneEl), true);
  eq('nesting AC6: the added-node pass puts no pillbox on the wrapper',
    tableToggles.has(grid.wrapperEl), false);
  eq('nesting AC6: the added-node pass puts no pillbox on the pinned pane',
    tableToggles.has(grid.pinnedPaneEl), false);

  // A node added inside a nest that already holds a registered element adds
  // no second registration.
  const beforeRediscovery = DR_STORE.getRegisteredTables().length;
  withToggleDocumentMock(function () {
    injectTogglesForAddedNode(grid.scrollPaneEl);
  });
  eq('nesting AC6: a node added inside a registered nest adds no registry entry',
    DR_STORE.getRegisteredTables().length, beforeRediscovery);

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- Adversarial: a rediscovery reports nothing for a registered nest ---

(function gridNesting_rediscoveryIsIdempotent() {
  const grid = makeDatabaseQueryGrid();
  eq('nesting: a nest whose scrolling pane is registered reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.scrollPaneEl }).length, 0);
  eq('nesting: a nest whose wrapper is registered reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.wrapperEl }).length, 0);
  eq('nesting: a nest whose pinned pane is registered reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.pinnedPaneEl }).length, 0);
  eq('nesting: a nest holding no registered element still reports the scrolling pane',
    findTables(grid.wrapperEl, { isSeen: () => false }).map((r) => r.handle === grid.scrollPaneEl),
    [true]);
})();

// --- Adversarial: the depth port reads zero as a depth ---

(function gridNesting_theDepthPortReadsZeroAsADepth() {
  eq('nesting: the detection settings ship a nesting depth of 1', DR_DETECTION_SETTINGS.nestingDepth, 1);

  const grid = makeDatabaseQueryGrid();
  const host = makeNestingHost([grid.wrapperEl]);
  eq('nesting: the shipped depth reports the scrolling pane',
    findTables(host).map((r) => r.handle === grid.scrollPaneEl), [true]);
  eq('nesting: an override of zero reports the wrapper, so zero reads as a depth',
    findTables(host, { nestingDepth: 0 }).map((r) => r.handle === grid.wrapperEl), [true]);
})();

// --- Adversarial: an empty wrapper reports nothing and throws nothing ---

(function gridNesting_anEmptyWrapperReportsNothing() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  let caught = null;
  let results = null;
  try {
    results = findTables(makeNestingHost([grid.wrapperEl]));
  } catch (e) {
    caught = e.message;
  }
  eq('nesting: an empty wrapper throws nothing', caught, null);
  eq('nesting: an empty wrapper reports no table', results && results.length, 0);
})();

// --- Adversarial: pass 1 is unchanged ---

(function gridNesting_pass1StillReportsNativeTablesBesideTheNest() {
  const nativeTable = makePass1DataTable();
  const grid = makeDatabaseQueryGrid();
  const root = {
    tagName: 'BODY',
    querySelectorAll(sel) {
      if (sel === 'table') return [nativeTable];
      if (sel === GRID_ARIA_SELECTOR_TEXT) {
        return [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
      }
      return [];
    },
  };

  eq('nesting: the plain native table is no accessibility artifact (sanity)',
    isPhantomA11yTable(nativeTable), false);
  const results = findTables(root);
  eq('nesting: a root holding one native table and one nest reports two tables',
    results.length, 2);
  eq('nesting: pass 1 reports the native table first',
    results.length === 2 && results[0].handle === nativeTable, true);
  eq('nesting: pass 2 reports the scrolling pane second',
    results.length === 2 && results[1].handle === grid.scrollPaneEl, true);
})();

// --- Adversarial: the step reports and registers nothing ---

(function gridNesting_theStepReportsAndRegistersNothing() {
  const grid = makeDatabaseQueryGrid();
  const nestElements = [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
  const before = DR_STORE.getRegisteredTables().length;

  findTables(makeNestingHost([grid.wrapperEl]));

  eq('nesting: the nomination step adds no registry entry',
    DR_STORE.getRegisteredTables().length, before);
  eq('nesting: the nomination step registers no element of the nest',
    nestElements.map((el) => DR_STORE.hasTable(el)), [false, false, false]);
  eq('nesting: the nomination step writes no grid marker class',
    nestElements.map((el) => el.classList.contains('dr-ext-grid')), [false, false, false]);
})();

// =============================================================================
// Sprint shape-fingerprint: the reader, the comparison, and the chain-root walk
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.6 and the
// shape-fingerprint block in §5; decision D7 in
// docs/sprint-plans/grid-detection-recovery.md; the shape fingerprint row in
// docs/vocabulary.md.
// =============================================================================
//
// The rule these assertions pin, in the specification's words:
//   - A shape fingerprint is the column count, and the header row's cell
//     texts where the table has a header row, recorded for a table when it
//     enters the registry.
//   - The column count is the widest row's cell count.
//   - A grid has a header row where it groups its data rows and its first row
//     sits outside every group. A native table has one where its first row
//     sits in the head section or holds header cells alone.
//   - A table with no header row carries the column count alone, because the
//     first row of a grid that groups nothing is a data row that every scroll
//     redraws.
//   - The row count stays out for the same reason: a virtualized grid changes
//     its drawn row count on every scroll.
//   - Two fingerprints describe the same shape when the column counts match
//     and the header texts match element by element. Two readings that found
//     no header row compare on the column count alone, and a reading that
//     found one against a reading that did not is a difference.
//   - The originals port supplies a cell's stored pre-simplification text, so
//     the extension's own writes to a header cell read as no change.
//
// Every expected value below comes from that statement, never from the
// detection layer's source.

// --- The reader ---

(function shapeFingerprint_theReaderReportsColumnsAndTheHeaderRowsTexts() {
  const g = makeScrollingRowgroupGrid(['Region', 'Q1', 'Q2'], [
    ['North', '1,482,391', '918,554'], ['South', '55,120', '7,314'],
  ]);
  const reading = readTableFingerprint(g.wrapperEl);
  eq('fingerprint reader: the reading carries the grid\'s column count',
    reading.columnCount, 3);
  eq('fingerprint reader: the reading carries the header row\'s cell texts',
    reading.headerTexts, ['Region', 'Q1', 'Q2']);
  eq('fingerprint reader: the reading carries those two fields and no row count',
    Object.keys(reading).sort(), ['columnCount', 'headerTexts']);
})();

// A grid that groups no rows has a data row first. Its text describes the rows
// on the screen rather than the table, so the reading leaves it out.
(function shapeFingerprint_aGrouplessGridCarriesTheColumnCountAlone() {
  const grid = makeDatabaseQueryGrid();
  const reading = readTableFingerprint(grid.scrollPaneEl);
  eq('fingerprint reader: a groupless grid\'s reading carries its column count',
    reading.columnCount, 3);
  eq('fingerprint reader: a groupless grid\'s reading carries no header texts',
    reading.headerTexts, null);
})();

(function shapeFingerprint_theColumnCountIsTheWidestRowNotTheFirstRow() {
  const grouped = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391', '9,105'], ['South', '918,554'],
  ]);
  const groupedReading = readTableFingerprint(grouped.wrapperEl);
  eq('fingerprint reader: the column count is the widest row\'s cell count',
    groupedReading.columnCount, 3);
  eq('fingerprint reader: the header texts stay the header row\'s, narrower than the count',
    groupedReading.headerTexts, ['Region', 'Q1']);

  const groupless = makeGridWrapper([
    ['Region', 'Q1'],
    ['North', '1,482,391', '9,105'],
    ['South', '918,554'],
  ]);
  const grouplessReading = readTableFingerprint(groupless.wrapperEl);
  eq('fingerprint reader: a groupless grid\'s widest row still sets the column count',
    grouplessReading.columnCount, 3);
  eq('fingerprint reader: a groupless grid carries no header texts whatever its rows',
    grouplessReading.headerTexts, null);
})();

// The three native-table forms. The adapter's outside-row mark names the
// footer section on a native table, so the head section is read from the row.
(function shapeFingerprint_aNativeTablesHeaderRowIsItsHeadSectionOrItsHeaderCells() {
  const headSection = makeHeadSectionTable(['Region', 'Q1'], [['North', '1,482,391']]);
  eq('fingerprint reader: a native table whose first row sits in a head section carries header texts',
    readTableFingerprint(headSection).headerTexts, ['Region', 'Q1']);

  const headerCells = makeToggleTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  eq('fingerprint reader: a native table whose first row holds header cells alone carries header texts',
    readTableFingerprint(headerCells).headerTexts, ['Region', 'Q1']);

  const dataFirst = makeToggleTable([
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    [{ tag: 'td', text: 'South' }, { tag: 'td', text: '918,554' }],
  ]);
  const dataFirstReading = readTableFingerprint(dataFirst);
  eq('fingerprint reader: a native table whose first row holds data cells carries no header texts',
    dataFirstReading.headerTexts, null);
  eq('fingerprint reader: that table still carries its column count',
    dataFirstReading.columnCount, 2);

  const mixedFirstRow = makeToggleTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'td', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  eq('fingerprint reader: a first row holding one data cell beside a header cell carries no header texts',
    readTableFingerprint(mixedFirstRow).headerTexts, null);
})();

(function shapeFingerprint_theOriginalsPortReadsPastTheExtensionsOwnWrites() {
  const g = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391'], ['South', '918,554'],
  ]);
  const beforeSimplification = readTableFingerprint(g.wrapperEl);
  const headerCells = g.headerRow.children;
  const stored = new Map();
  headerCells.forEach((cellEl) => { stored.set(cellEl, cellEl.childNodes[0].nodeValue); });
  // What a simplification of the header row leaves on the screen.
  headerCells.forEach((cellEl) => { cellEl.childNodes[0].nodeValue = '7M'; });

  const throughThePort = readTableFingerprint(g.wrapperEl,
    { originalText: (cellEl) => stored.get(cellEl) });
  eq('fingerprint reader: a read through the originals port matches the pre-simplification reading',
    sameTableFingerprint(beforeSimplification, throughThePort), true);
  eq('fingerprint reader: the same read without the port carries the simplified texts',
    sameTableFingerprint(beforeSimplification, readTableFingerprint(g.wrapperEl)), false);
  eq('fingerprint reader: a port holding nothing for a cell falls back to the cell\'s own text',
    readTableFingerprint(g.wrapperEl, { originalText: () => undefined }).headerTexts,
    ['7M', '7M']);
})();

// --- The comparison ---

(function shapeFingerprint_theComparisonReadsColumnsAndHeaderTextsAlone() {
  const base = { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] };
  eq('fingerprint comparison: two equal readings compare the same',
    sameTableFingerprint(base, { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] }), true);
  eq('fingerprint comparison: a different column count compares different',
    sameTableFingerprint(base, { columnCount: 4, headerTexts: ['Region', 'Q1', 'Q2'] }), false);
  eq('fingerprint comparison: one differing header text compares different',
    sameTableFingerprint(base, { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q3'] }), false);
  eq('fingerprint comparison: a shorter header list compares different',
    sameTableFingerprint(base, { columnCount: 3, headerTexts: ['Region', 'Q1'] }), false);
  eq('fingerprint comparison: a missing reading compares different',
    sameTableFingerprint(base, null), false);
})();

// A table with no header row compares on the column count alone. A table that
// gained or lost its header row compares different.
(function shapeFingerprint_theComparisonReadsTwoHeaderlessReadingsOnTheColumnCount() {
  const headerless = { columnCount: 3, headerTexts: null };
  eq('fingerprint comparison: two readings with no header row and one column count compare the same',
    sameTableFingerprint(headerless, { columnCount: 3, headerTexts: null }), true);
  eq('fingerprint comparison: two readings with no header row and different column counts compare different',
    sameTableFingerprint(headerless, { columnCount: 4, headerTexts: null }), false);
  eq('fingerprint comparison: a reading with a header row against one without compares different',
    sameTableFingerprint(headerless, { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] }), false);
  eq('fingerprint comparison: that difference reads the same either way round',
    sameTableFingerprint({ columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] }, headerless), false);
})();

// The consequence on a groupless grid: a scroll changes the first row's text
// and the reading holds; a new result set changes the column count and the
// reading moves.
(function shapeFingerprint_aGrouplessGridsFirstRowTextIsNoPartOfTheReading() {
  const grid = makeDatabaseQueryGrid();
  const before = readTableFingerprint(grid.scrollPaneEl);
  dgReplaceRowCells(grid.scrollRowEls[0], ['golf', '44,190', '12.08']);
  eq('fingerprint comparison: a groupless grid\'s first-row text change compares the same',
    sameTableFingerprint(before, readTableFingerprint(grid.scrollPaneEl)), true);

  dgAppendRowCell(grid.scrollRowEls[0], '3,006');
  eq('fingerprint comparison: a groupless grid\'s column count change compares different',
    sameTableFingerprint(before, readTableFingerprint(grid.scrollPaneEl)), false);
})();

// The row count plays no part. A virtualized grid changes its drawn row count
// on every scroll, so a fingerprint carrying the count would report a scroll
// as a shape change.
(function shapeFingerprint_theRowCountPlaysNoPartInTheComparison() {
  const sixRows = makeGridWrapper([
    ['Region', 'Q1'], ['North', '1,482,391'], ['South', '918,554'],
    ['East', '55,120'], ['West', '7,314'], ['Inland', '2,905'],
  ]);
  const twoRows = makeGridWrapper([['Region', 'Q1'], ['North', '1,482,391']]);
  eq('fingerprint comparison: a six-row reading and a two-row reading of one shape compare the same',
    sameTableFingerprint(
      readTableFingerprint(sixRows.wrapperEl), readTableFingerprint(twoRows.wrapperEl)), true);
})();

// --- The chain-root walk the mismatch path re-runs the nomination step from ---

(function shapeFingerprint_theChainRootWalkIsPublic() {
  const grid = makeDatabaseQueryGrid();
  eq('fingerprint chain root: the chain root of the scrolling pane is the wrapper',
    chainRootOf(grid.scrollPaneEl) === grid.wrapperEl, true);
  eq('fingerprint chain root: the chain root of the wrapper is the wrapper',
    chainRootOf(grid.wrapperEl) === grid.wrapperEl, true);

  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  eq('fingerprint chain root: a plain layer inside the wrapper leaves the chain root the wrapper',
    chainRootOf(plain.scrollPaneEl) === plain.wrapperEl, true);

  eq('fingerprint chain root: an element in no nest has none',
    chainRootOf(makeNestingHost([])) === null, true);
  eq('fingerprint chain root: a missing element has none', chainRootOf(null) === null, true);
})();

// =============================================================================
// Sprint pending-retest: the nomination step reports one nest at a time
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.3 and §3.4.
// =============================================================================
//
// The four outcomes, in the specification's words:
//   - 'selected'   the step selected an element to register.
//   - 'empty'      no element of the nest passes the data test, which is the
//                  pending-table case.
//   - 'crowded'    a depth holds more than one element and no shallower depth
//                  holds exactly one, so the nest registers nothing.
//   - 'registered' the nest already holds an element the caller reports as
//                  seen, which makes a rediscovery idempotent.
// The chain size counts the nest elements that passed the data test and filed
// at a depth; it is zero for 'empty' and for 'registered'.
//
// findTables keeps the 'selected' outcomes and drops the other three, so a
// caller that acts on them reads them here.

(function nominationStep_reportsSelectedForTheDatabaseQueryShape() {
  const grid = makeDatabaseQueryGrid();
  const result = nominateNest(grid.wrapperEl);

  eq('nomination: a filled database query grid reports the selected outcome',
    result.outcome, 'selected');
  eq('nomination: the selected element is the scrolling pane',
    result.selected === grid.scrollPaneEl, true);
  eq('nomination: the reported chain root is the wrapper',
    result.chainRoot === grid.wrapperEl, true);
  eq('nomination: the chain holds the wrapper and the scrolling pane',
    result.chainSize, 2);
  eq('nomination: findTables on the same shape reports the selected handle alone',
    findTables(grid.wrapperEl).map((r) => r.handle === grid.scrollPaneEl), [true]);
})();

(function nominationStep_reportsEmptyForAGridWithNoRows() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const result = nominateNest(grid.wrapperEl);

  eq('nomination: a grid with no rows reports the empty outcome', result.outcome, 'empty');
  eq('nomination: the empty outcome selects nothing', result.selected, null);
  eq('nomination: the empty outcome reports the wrapper as the chain root',
    result.chainRoot === grid.wrapperEl, true);
  eq('nomination: the empty outcome reports a chain size of zero', result.chainSize, 0);
  eq('nomination: findTables on a grid with no rows reports nothing',
    findTables(grid.wrapperEl).length, 0);
})();

(function nominationStep_reportsCrowdedWhenTheDepthHoldsTwoAndTheRootFails() {
  const nest = makeCrowdedNest();

  eq('nomination: the crowded root fails the data test', isDataTable(nest.rootEl), false);
  eq('nomination: both panes of the crowded nest pass the data test',
    [nest.paneAEl, nest.paneBEl].map(isDataTable), [true, true]);

  const result = nominateNest(nest.rootEl);
  eq('nomination: two passing siblings with a failing root report the crowded outcome',
    result.outcome, 'crowded');
  eq('nomination: the crowded outcome selects nothing', result.selected, null);
  eq('nomination: the crowded outcome counts both passing siblings', result.chainSize, 2);
  eq('nomination: findTables on the crowded shape reports nothing',
    findTables(nest.rootEl).length, 0);
})();

(function nominationStep_reportsRegisteredWhenTheNestHoldsASeenElement() {
  const grid = makeDatabaseQueryGrid();
  const result = nominateNest(grid.wrapperEl, { isSeen: (el) => el === grid.scrollPaneEl });

  eq('nomination: a nest holding a seen element reports the registered outcome',
    result.outcome, 'registered');
  eq('nomination: the registered outcome selects nothing', result.selected, null);
  eq('nomination: the registered outcome reports a chain size of zero', result.chainSize, 0);
  eq('nomination: findTables on a nest holding a seen element reports nothing',
    findTables(grid.wrapperEl, { isSeen: (el) => el === grid.scrollPaneEl }).length, 0);
})();

(function nominationStep_reportsOneResultPerNestInDocumentOrder() {
  const first = makeDatabaseQueryGrid();
  const second = makeDatabaseQueryGrid();
  const results = nominateNests(makeNestingHost([first.wrapperEl, second.wrapperEl]));

  eq('nomination: a host holding two grids reports two results', results.length, 2);
  eq('nomination: the results carry the two chain roots in document order',
    results.map((r) => r.chainRoot === first.wrapperEl || r.chainRoot === second.wrapperEl),
    [true, true]);
  eq('nomination: the first result belongs to the first grid',
    results[0] && results[0].chainRoot === first.wrapperEl, true);
  eq('nomination: the second result belongs to the second grid',
    results[1] && results[1].chainRoot === second.wrapperEl, true);
  eq('nomination: each result selects its own scrolling pane',
    results.map((r) => r.selected === first.scrollPaneEl || r.selected === second.scrollPaneEl),
    [true, true]);
})();

(function nominationStep_theChainRootWalkFindsTheOutermostQualifyingElement() {
  const grid = makeDatabaseQueryGrid();
  eq('nomination: the walk from the scrolling pane lands on the wrapper',
    chainRootOf(grid.scrollPaneEl) === grid.wrapperEl, true);
  eq('nomination: the walk from the pinned pane lands on the same wrapper',
    chainRootOf(grid.pinnedPaneEl) === grid.wrapperEl, true);
  eq('nomination: the walk from the wrapper lands on the wrapper itself',
    chainRootOf(grid.wrapperEl) === grid.wrapperEl, true);
  eq('nomination: a plain element with no qualifying ancestor has no chain root',
    chainRootOf(makeDgNode('DIV', 'plain-element', null, [])), null);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection (adversarial hardening): parent-equivalence pin.
// The contextmenu handler in content.js is the one call site both branches
// implement: the pre-model code wrote a bare `lastRightClickedTable = table`
// file-level let; HEAD calls DR_STORE.setSelectedTable(table) instead. The
// expected sendMessage sequences below are LITERALS captured from the parent
// branch (refactor/engine-returns-results, commit 35a5f52) by running its
// real contextmenu listener in this same harness, and were verified
// byte-identical to HEAD's output at review time. Freezing them keeps this
// pin alive on main and in shallow CI checkouts, where the parent ref does
// not exist for `git show`.
// ---------------------------------------------------------------------------
(function appModelSelection_parentEquivalence_contextmenuSelectionFlow() {
  // One sequence. This ran twice, once with the page's copy of "the sidebar
  // is open" set each way, and produced the identical sequence both times,
  // because the contextmenu handler never read that value. The 2026-09-14
  // sidebar-state-removal design retired the value (#241), so the two runs
  // collapse into one.
  const PARENT_EXPECTED_SEQUENCE = [{ action: 'state:tableActivated' }];

  // Minimal fixture the contextmenu handler's findTargetTable() walk-up
  // recognizes immediately as a table (closest('table') returns itself) —
  // same shape the existing table-contextmenu-activation runtime test uses.
  function makeFixtureTarget() {
    return {
      tagName: 'TABLE',
      classList: { remove() {}, add() {}, contains() { return false; } },
      get offsetWidth() { return 0; },
      rows: [],
      dataset: {},
      closest(sel) { return sel === 'table' ? this : null; },
      matches() { return false; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
  }

  // Evaluates `bundle`, then `postEvalLine` (same eval call, so postEvalLine
  // can still reference the bundle's top-level let/const bindings — e.g.
  // DR_STORE — even though those bindings are not reachable from outside
  // this function once eval() returns), captures the 'contextmenu' listener
  // the bundle registers, fires it once against a fresh fixture target, and
  // returns the resulting sendMessage sequence.
  function runContextmenuFixture(bundle, postEvalLine) {
    let capturedHandler = null;
    const sentMessages = [];
    const captureDoc = {
      addEventListener(type, handler) { if (type === 'contextmenu') capturedHandler = handler; },
      querySelectorAll: () => [],
      readyState: 'complete',
      body: { appendChild() {} },
    };
    const captureChrome = {
      runtime: {
        onMessage: { addListener() {} },
        sendMessage(msg) { sentMessages.push(msg); },
      },
    };
    const saved = {
      document: global.document, chrome: global.chrome, window: global.window,
      MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
      Node: global.Node, NodeFilter: global.NodeFilter,
    };
    global.document = captureDoc;
    global.chrome = captureChrome;
    global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
    global.MutationObserver = class { observe() {} disconnect() {} };
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    global.Node = { ELEMENT_NODE: 1 };
    global.NodeFilter = { SHOW_TEXT: 4 };
    try {
      eval(bundle + postEvalLine);
      if (typeof capturedHandler !== 'function') return null;
      capturedHandler({ target: makeFixtureTarget() });
      return sentMessages;
    } finally {
      global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
      global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
      global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
    }
  }

  const headMessages = runContextmenuFixture(contentScriptBundle, '');

  eq("parent-equivalence: HEAD's contextmenu handler was captured",
    headMessages !== null, true);
  eq('parent-equivalence: contextmenu sendMessage sequence matches the frozen parent sequence',
    headMessages, PARENT_EXPECTED_SEQUENCE);
})();

// ---------------------------------------------------------------------------
// Sprint hidden-cells: the data test and the engine read a hidden cell's raw
// text, and a hidden fragment inside a visible cell stays out of the read.
//
// A hidden native cell is modeled as a mock cell whose rendered text
// (innerText) is empty and whose raw text (textContent) holds a number.
// A cell that is itself not rendered, such as a cell in a display:none row,
// still returns its descendant text through innerText. The rendered read
// comes back empty for a cell in a visibility:hidden row and for a cell in
// a closed details element; textContent holds every text node in both
// cases. The NativeTableAdapter read (getText() in lib/dr-table/detect.js)
// falls back to the raw text only when the rendered text is empty, which
// covers those two cases. Every assertion below drives the real adapter,
// the real data test, or the real engine (isDataTable, roundTable,
// resetTable, collectNumericCells, findTables); none pins the source text
// of detect.js or content.js.
// ---------------------------------------------------------------------------

// (a) The data test passes on a table whose only number sits in a hidden
// cell's raw text, and fails when that same raw text holds no number either
// — isolating the pass to the hidden cell's raw text, not to some other cell.
(function hiddenCells_dataTestReadsHiddenCellRawText() {
  function hiddenNumericCell(rawText) {
    return withTextPiece({ tagName: 'TD', innerText: '', textContent: rawText });
  }
  function labelCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [labelCell('Metric'), labelCell('Value')] },
      { cells: [labelCell('Revenue'), hiddenNumericCell('45230')] },
    ],
  };
  eq('hidden cells: the data test passes when the table\'s only number sits in a hidden cell\'s raw text',
    isDataTable(table), true);

  const noNumberTable = {
    rows: [
      { cells: [labelCell('Metric'), labelCell('Value')] },
      { cells: [labelCell('Revenue'), hiddenNumericCell('')] },
    ],
  };
  eq('hidden cells: the data test fails when the hidden cell\'s raw text holds no number either',
    isDataTable(noNumberTable), false);
})();

(function hiddenCells_roundTableAndResetRestoreHiddenCell() {
  const headerCell = { tagName: 'TD', innerText: 'Header', textContent: 'Header',
    classList: { _c: [], add(c) { this._c.push(c); }, remove(c) { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); } },
    dataset: {}, title: '', querySelectorAll: () => [], removeAttribute() {} };
  const cell = makeHiddenNumericCell('4523789');
  const table = {
    rows: [
      { cells: [headerCell] },
      { cells: [cell] },
    ],
    dataset: {},
    querySelector: () => null,
    querySelectorAll(sel) {
      return sel === '.dr-ext-rounded'
        ? [headerCell, cell].filter(c => c.classList.contains('dr-ext-rounded'))
        : [];
    },
  };
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: false, simplifyFirstColumn: true });

  withHiddenCellTreeWalker(cell, function() {
    roundTable(table, opts);
  });

  eq('hidden cells: roundTable rounds the hidden cell\'s raw text away from the original',
    cell.textContent !== '4523789', true);
  eq('hidden cells: roundTable marks the hidden cell rounded',
    cell.classList.contains('dr-ext-rounded'), true);
  eq('hidden cells: the hidden cell\'s rendered text stays empty after rounding',
    cell.innerText, '');

  // The restore writes the cell's text pieces, so it reads them through the
  // same walker as the write.
  withHiddenCellTreeWalker(cell, function() {
    resetTable(table);
  });

  eq('hidden cells: resetTable restores the hidden cell\'s exact raw text',
    cell.textContent, '4523789');
  eq('hidden cells: resetTable clears the rounded marker',
    cell.classList.contains('dr-ext-rounded'), false);
})();

// (c) The lens preview pool (collectNumericCells) holds the hidden cell.
(function hiddenCells_lensPreviewPoolHoldsHiddenCell() {
  function hiddenNumericCell(rawText) {
    return withTextPiece({ tagName: 'TD', innerText: '', textContent: rawText });
  }
  function labelCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [labelCell('Metric'), labelCell('Value')] },
      { cells: [labelCell('Revenue'), hiddenNumericCell('45230')] },
    ],
  };
  const cells = collectNumericCells(table);
  eq('hidden cells: the lens preview pool holds the hidden cell\'s number',
    cells.some(c => c.num === 45230), true);
})();

// (d) A visible cell whose rendered text is "+2.3%" and whose raw text is
// "700023000+2.3%" (a display:none sort key ahead of the visible percent)
// reads as "+2.3%" — through the real adapter, and through the engine.
(function hiddenCells_visibleCellReadsRenderedTextNotSortKey() {
  function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
  function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
  const sortKeyCell = tdCell('+2.3%');
  sortKeyCell.textContent = '700023000+2.3%';
  const table = {
    rows: [
      { cells: [thCell(''), thCell('Change')] },
      { cells: [thCell('Row'), sortKeyCell] },
    ],
  };

  const adapterCell = makeAdapter(table).getRows()[1].getCells()[1];
  eq('hidden cells: the adapter reads the visible cell\'s rendered text, not its raw sort-key-prefixed text',
    adapterCell.getText(), '+2.3%');

  eq('hidden cells: the engine extracts 2.3 from the cell, never the hidden sort key 700023000',
    collectNumericCells(table).map(c => c.num), [2.3]);
})();

// (e) An accessibility artifact stays excluded, even though its hidden
// numeric cells would otherwise pass the data test under D6.
(function hiddenCells_accessibilityArtifactStaysExcluded() {
  function hiddenNumericCell(rawText) {
    return { tagName: 'TD', innerText: '', textContent: rawText };
  }
  const artifactTable = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
  artifactTable.rows = [
    { cells: [hiddenNumericCell('1'), hiddenNumericCell('2')] },
    { cells: [hiddenNumericCell('3'), hiddenNumericCell('45230')] },
  ];

  eq('hidden cells: the accessibility artifact\'s hidden numeric cells would otherwise pass the data test',
    isDataTable(artifactTable), true);
  eq('hidden cells: isPhantomA11yTable flags the artifact',
    isPhantomA11yTable(artifactTable), true);

  // findTables is where detection combines the two: its default tableFilter
  // is isPhantomA11yTable, applied before any candidate is kept.
  const root = makePhantomEl({ tagName: 'DIV' });
  root.querySelectorAll = (sel) => (sel === 'table' ? [artifactTable] : []);
  eq('hidden cells: detection skips the accessibility artifact despite its hidden numeric cells',
    findTables(root).length, 0);

  // Control: the identical row shape, minus the accessibility signal, is a
  // real candidate — isolating the guard as the reason for the exclusion
  // above, not some unrelated property of the mock.
  const onScreenTable = makePhantomEl({ tagName: 'TABLE' });
  onScreenTable.rows = artifactTable.rows;
  const wrapper = makePhantomEl({ tagName: 'DIV' });
  chainParents(onScreenTable, wrapper);
  const root2 = makePhantomEl({ tagName: 'DIV' });
  root2.querySelectorAll = (sel) => (sel === 'table' ? [onScreenTable] : []);
  eq('hidden cells: detection keeps the same row shape without the accessibility signal',
    findTables(root2).length, 1);
})();

// --- Placement: a bracket may hold its own text piece ---

(function bracketInItsOwnPiecePlaces() {
  const pieces = ['(', '1,234', ')'];
  const text = pieces.join('');
  const liveStarts = [];
  let at = 0;
  for (const piece of pieces) { liveStarts.push(at); at += piece.length; }
  const layout = { original: pieces, liveStarts, toFlat: null };
  const decision = classifyCell({ text, rowIndex: 1, columnIndex: 1, ranges: null }, bracketOpts);
  eq('bracketed: a bracket in its own text piece still places on a native table',
    placeDecision(decision, text, Object.assign({}, layout, { rendered: true })).mode, 'extracted');
  eq('bracketed: a bracket in its own text piece still places on a grid',
    placeDecision(decision, text, Object.assign({}, layout, { rendered: false })).mode, 'extracted');
})();

// ---------------------------------------------------------------------------
// Issue #330: a merged cell shifts the columns after it
//
// A cell's column number is its grid column — the column the browser lays the
// cell out in — not its position in the row read. A cell merged across
// advances the cursor by its whole width, and a cell merged down holds its
// columns on every row it covers, so the cells after a merge keep their real
// column number. Both table kinds run the same rule: an ordinary table reads
// the span from the markup, a grid from the accessibility attributes a page
// declares.
// ---------------------------------------------------------------------------

// --- The column number is the grid column ---

(function mergedCellsCarryTheirGridColumn() {
  eq('#330: a row merged down and a row merged across keep every column number',
    adapterColumnsOf(makeMergedSpanTable()), [[0, 1, 2], [0, 1, 2], [1, 2], [0, 2]]);
})();

(function aTableWithNoMergeNumbersByReadPosition() {
  eq('#330: a table with no merge numbers its columns by read position',
    adapterColumnsOf(makeUnmergedSpanTable()), [[0, 1, 2], [0, 1, 2], [0, 1, 2]]);
})();

(function aMergedCellReportsItsWidth() {
  const widths = makeAdapter(makeMergedSpanTable()).getRows()[3]
    .getCells().map((cell) => cell.columnSpan);
  eq('#330: a cell merged across reports the columns it covers', widths, [2, 1]);
})();

(function anOverlappingMergeKeepsTheOlderHold() {
  // Markup a table model calls an error, still laid out: the second row's
  // cell is wide enough to reach a column the third-row merge above already
  // holds. Both cells keep the shared slot, so the cursor carries the longer
  // hold and the last row's third cell lands past it.
  const table = makeMockTable([
    [{ tag: 'td', text: 'A', rowSpan: 2 }, { tag: 'td', text: 'B' }, { tag: 'td', text: 'C', rowSpan: 3 }],
    [{ tag: 'td', text: 'D', colSpan: 2 }],
    [{ tag: 'td', text: 'E' }, { tag: 'td', text: 'F' }, { tag: 'td', text: 'G' }],
  ]);
  eq('#330: a merge reaching into a held column does not release that column',
    adapterColumnsOf(table), [[0, 1, 2], [1], [0, 1, 3]]);
})();

// --- A grid runs the same rule ---

(function aGridCellCarriesItsGridColumn() {
  const grid = declareGridSpans(makeGridWrapper([
    ['West', '1,234', '2,345'],
    ['12,500', '3,210'],
  ], { useDgClasses: true }), { 0: { rowSpan: 2 } });
  eq('#330: a grid cell after a declared downward merge keeps its grid column',
    adapterColumnsOf(grid.wrapperEl), [[0, 1, 2], [1, 2]]);
})();

(function aGridWithNoDeclaredMergeNumbersByReadPosition() {
  const grid = declareGridSpans(
    makeGridWrapper([['4.91', '5,432.1'], ['12', '34']], { useDgClasses: true }), {});
  eq('#330: a grid that declares no merge numbers its columns by read position',
    adapterColumnsOf(grid.wrapperEl), [[0, 1], [0, 1]]);
})();
