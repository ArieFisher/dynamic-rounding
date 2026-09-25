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
//      gap for the same glued shape, since it takes no stacked-cell test
//      either — parity, not a grid-specific regression.
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

// GR6e: the registry original is stored ONCE; a second write against the
// patched piece lands nothing and leaves the stored original in place.
// A re-round starts from restored text: every apply resets the table first.
(function gr6e_drOriginal_storedOnce() {
  const grid = makeGridWrapper([['12345']]);
  const adapter = makeAdapter(grid.wrapperEl, { originalsPort: registryOriginalsPort(grid.wrapperEl) });
  const cellObj = adapter.getRows()[0].getCells()[0];

  // First write: original should be stored
  cellObj.applyPatches([{ index: 0, numStr: '12345', newNum: '12000' }]);
  eq('GR6e: registry original stored on first write',
    DR_STORE.getTableOriginalText(grid.wrapperEl, grid.cellEls[0]), '12345');

  // Second write, against the piece's patched text: the piece no longer
  // shows its stored original, so nothing lands.
  eq('GR6e: a second write into the patched piece lands nothing',
    cellObj.applyPatches([{ index: 0, numStr: '12000', newNum: '10000' }]), 0);
  eq('GR6e: registry original NOT overwritten on second write',
    DR_STORE.getTableOriginalText(grid.wrapperEl, grid.cellEls[0]), '12345');
  eq('GR6e: nodeValue keeps the first write',
    grid.cellEls[0].childNodes[0].nodeValue, '12000');
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

(function e2e_gridFormCountsConfirmedWrites() {
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
  ]);
  // The page redraws every cell between classification and the write:
  // roundTable stores the frozen max magnitude between the two, so the
  // redraw runs there. Each patch then finds other characters at its
  // position, and every write skips.
  const setMaxMagnitude = DR_STORE.setTableMaxMagnitude;
  DR_STORE.setTableMaxMagnitude = function (table, value) {
    for (const cell of grid.cellEls) cell.childNodes[0].nodeValue = '1';
    return setMaxMagnitude.call(DR_STORE, table, value);
  };
  try {
    const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
    roundTable(grid.wrapperEl, opts);
    eq('grid-honesty: a write that lands nothing adds no marker through roundTable',
      grid.cellEls[0].classList.contains('dr-ext-rounded'), false);
    eq('grid-honesty: a grid whose every write skipped keeps form original',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'original');
    eq('grid-honesty: the skipped writes leave a debug row, which raises no toast',
      DR_LOG.snapshot().entries.some(
        (row) => row.level === 'debug' && /cells were left unrounded/.test(row.text)),
      true);
  } finally {
    DR_STORE.setTableMaxMagnitude = setMaxMagnitude;
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// ---------------------------------------------------------------------------
// E2E-GR2: resetTable after roundTable — Text node restored in place, class
// removed, drOriginal cleared, childNodes.length still unchanged.
// ---------------------------------------------------------------------------
(function e2e_gr2_resetTable_restoresNodeValue() {
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
  ]);

  const cell0 = grid.cellEls[0];
  const textNodeBefore = cell0.childNodes[0];
  const childCountBefore = cell0.childNodes.length;
  const originalValue = textNodeBefore.nodeValue;  // '8584629'

  // Round first — use simplifyFirstRow+Column:true so row/col 0 are not excluded.
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
  roundTable(grid.wrapperEl, opts);

  // Confirm the cell is rounded before we reset (pre-condition).
  eq('E2E-GR2 (pre): cell[0] is rounded before resetTable',
    cell0.classList.contains('dr-ext-rounded'), true);

  // Now reset.
  resetTable(grid.wrapperEl);

  // nodeValue must be back to the original on the SAME Text node.
  eq('E2E-GR2: Text node nodeValue restored to original value',
    textNodeBefore.nodeValue, originalValue);

  // The SAME node object must still be in childNodes[0].
  eq('E2E-GR2: Text node identity preserved through reset (same reference)',
    cell0.childNodes[0] === textNodeBefore, true);

  // dr-ext-rounded class must be removed.
  eq('E2E-GR2: dr-ext-rounded removed after resetTable',
    cell0.classList.contains('dr-ext-rounded'), false);

  // The registry original must be cleared.
  eq('E2E-GR2: registry original cleared after resetTable',
    DR_STORE.getTableOriginal(grid.wrapperEl, cell0), undefined);

  // childNodes.length still unchanged (no innerHTML write at any point).
  eq('E2E-GR2: childNodes.length unchanged throughout (no innerHTML write)',
    cell0.childNodes.length, childCountBefore);
})();

// ---------------------------------------------------------------------------
// E2E-GR3 (Negative guard): after roundTable on a grid, NO cell has
// dataset.originalHtml set. Locks in that grids never take the native write path.
// ---------------------------------------------------------------------------
(function e2e_gr3_noOriginalHtmlOnGridCells() {
  const grid = makeE2EGridWrapper([
    ['8584629', '286'],
    ['1234567', '99'],
    ['7654321', '55'],
  ]);

  // simplifyFirstRow:true ensures all rows are processed (maximal coverage).
  roundTable(grid.wrapperEl, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true }));

  const anyHasOriginalHtml = grid.cellEls.some(function(c) {
    return c.dataset.originalHtml !== undefined;
  });

  eq('E2E-GR3: no grid cell has dataset.originalHtml after roundTable (native path locked out)',
    anyHasOriginalHtml, false);
})();

// ---------------------------------------------------------------------------
// E2E-GR4: mode:'extracted' skip on grids — mixed-text cell is left unrounded;
// pure-numeric cell IS rounded. Known limitation: grids skip extracted cells
// (innerHTML incompatible with nodeValue-only write model).
// ---------------------------------------------------------------------------
(function e2e_gr4_extractedModeSkippedOnGrid() {
  // Two rows so simplifyFirstRow:false (default) doesn't exclude everything.
  // Row 0: skipped (simplifyFirstRow:false).
  // Row 1: mixed-text cell → extracted mode → skipped on grid;
  //        pure-numeric cell → pure mode → rounded.
  const grid = makeE2EGridWrapper([
    ['placeholder', '0'],             // row 0: excluded by simplifyFirstRow:false
    ['abc 1234567 def', '9876543'],   // row 1: exercised
  ]);

  // cellEls[2] = row1/col0 (mixed), cellEls[3] = row1/col1 (numeric)
  const mixedCell   = grid.cellEls[2];
  const numericCell = grid.cellEls[3];

  const mixedTextBefore   = mixedCell.childNodes[0].nodeValue;
  const numericTextBefore = numericCell.childNodes[0].nodeValue;

  // Use opts with simplifyMixedCells:true so mixed cells are classified as extracted,
  // and simplifyFirstRow:false (default) so row 0 is excluded (standard behaviour).
  const opts = Object.assign({}, DR_DEFAULTS, { simplifyMixedCells: true });
  roundTable(grid.wrapperEl, opts);

  // Mixed cell must be UNROUNDED (extracted path skipped on virtualized grid).
  eq('E2E-GR4: mixed-text cell NOT rounded on grid (extracted mode skipped)',
    mixedCell.classList.contains('dr-ext-rounded'), false);

  eq('E2E-GR4: mixed-text cell text node unchanged',
    mixedCell.childNodes[0].nodeValue, mixedTextBefore);

  // Pure-numeric cell must be rounded.
  eq('E2E-GR4: pure-numeric cell IS rounded on grid',
    numericCell.classList.contains('dr-ext-rounded'), true);

  eq('E2E-GR4: pure-numeric cell text changed from original',
    numericCell.childNodes[0].nodeValue !== numericTextBefore, true);

  // Registry original set on numeric, not on mixed.
  eq('E2E-GR4: registry original set on pure-numeric cell',
    DR_STORE.getTableOriginalText(grid.wrapperEl, numericCell), numericTextBefore);

  eq('E2E-GR4: registry original NOT set on mixed-text cell',
    DR_STORE.getTableOriginal(grid.wrapperEl, mixedCell), undefined);
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
// GV2: Sort revert (characterData) — the headline test.
// Round a grid; rewrite a rounded cell's text node back to its original value
// (simulating an in-place sort: same Text node, class .dr-ext-rounded retained).
// Trigger observer + debounce; assert cell is re-rounded.
// ---------------------------------------------------------------------------
(function gv2_sortRevert_cellReRounded() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;

    // cell[0] is a big numeric cell — it should be rounded.
    const cell0 = grid.cellEls[0];
    eq('GV2 (pre): cell[0] carries dr-ext-rounded after initial roundTable',
      cell0.classList.contains('dr-ext-rounded'), true);

    const tn0 = cell0.childNodes[0];
    const roundedValue = tn0.nodeValue;   // e.g. '8600000'
    const originalValue = DR_STORE.getTableOriginalText(grid.wrapperEl, cell0);  // e.g. '8584629'

    eq('GV2 (pre): roundedValue differs from original',
      roundedValue !== originalValue, true);

    // Simulate an in-place sort: framework rewrites text node back to original
    // but the cell KEEPS our .dr-ext-rounded class (node identity preserved).
    tn0.nodeValue = originalValue;
    // Class is still present (as in real sort behaviour).
    eq('GV2 (pre): class still present after sort-revert (simulated)',
      cell0.classList.contains('dr-ext-rounded'), true);

    // Trigger characterData mutation.
    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn0 }]);

    // Flush the debounce timer.
    flushTimers(pendingTimers);

    // The cell must be re-rounded: its text node value must equal the rounded value again.
    eq('GV2: cell[0] text node value re-rounded after sort-revert + re-apply',
      cell0.childNodes[0].nodeValue, roundedValue);

    eq('GV2: cell[0] still carries dr-ext-rounded after re-apply',
      cell0.classList.contains('dr-ext-rounded'), true);

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
// GV8: Exclusion-gate parity — re-apply HONORS firstRow / firstColumn gates.
//
// Regression guard for the BLOCK: before the fix, reapplyRounding recomputed
// max_mag over an unfiltered cell set and wrote excluded cells.  After the fix
// (computeGridRoundedValues shared path), excluded cells get no patches and
// are never written.
//
// Grid layout (2 rows × 2 cols):
//   row 0:  'Header'     '999999'     ← row 0 excluded by simplifyFirstRow:false
//   row 1:  '12345678'   '87654321'   ← row 1 data; col 0 excluded by simplifyFirstColumn:false
//
// Round with simplifyFirstRow:false, simplifyFirstColumn:false (the real defaults).
// After initial roundTable:
//   - cellEls[0] (row0,col0) = excluded (firstRow)   → NOT rounded
//   - cellEls[1] (row0,col1) = excluded (firstRow)   → NOT rounded
//   - cellEls[2] (row1,col0) = excluded (firstColumn)→ NOT rounded
//   - cellEls[3] (row1,col1) = in-range numeric      → IS rounded
//
// Then simulate a sort-revert on cellEls[3] (revert text to original).
// Trigger observer + flush.
// Assert:
//   - cellEls[0] still NOT rounded (text unchanged, no dr-ext-rounded)
//   - cellEls[2] still NOT rounded (text unchanged, no dr-ext-rounded)
//   - cellEls[3] IS re-rounded (text equals initial rounded value)
// ---------------------------------------------------------------------------
(function gv8_reapply_honorsExclusionGates_firstRowFirstColumn() {
  let ctx;
  try {
    ctx = setupVirtGrid(
      [
        ['Header', '999999'],
        ['12345678', '87654321'],
      ],
      // Override the setupVirtGrid defaults: exclusions must be ON (false = exclude).
      { simplifyFirstRow: false, simplifyFirstColumn: false }
    );
    const { grid, pendingTimers } = ctx;

    // cellEls layout (row-major): [row0col0, row0col1, row1col0, row1col1]
    const cell_r0c0 = grid.cellEls[0];  // 'Header'    — excluded firstRow
    const cell_r0c1 = grid.cellEls[1];  // '999999'    — excluded firstRow
    const cell_r1c0 = grid.cellEls[2];  // '12345678'  — excluded firstColumn
    const cell_r1c1 = grid.cellEls[3];  // '87654321'  — should be rounded

    // --- Pre-conditions after initial roundTable ---
    eq('GV8 (pre): row-0 col-0 is NOT rounded by initial pass (firstRow excluded)',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV8 (pre): row-0 col-1 is NOT rounded by initial pass (firstRow excluded)',
      cell_r0c1.classList.contains('dr-ext-rounded'), false);

    eq('GV8 (pre): row-1 col-0 is NOT rounded by initial pass (firstColumn excluded)',
      cell_r1c0.classList.contains('dr-ext-rounded'), false);

    eq('GV8 (pre): row-1 col-1 IS rounded by initial pass (in-range data cell)',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

    // Capture the rounded value so we can verify re-apply restores it.
    const tn_r1c1 = cell_r1c1.childNodes[0];
    const roundedValue_r1c1 = tn_r1c1.nodeValue;
    const originalValue_r1c1 = DR_STORE.getTableOriginalText(grid.wrapperEl, cell_r1c1);  // '87654321'

    eq('GV8 (pre): row-1 col-1 rounded value differs from original',
      roundedValue_r1c1 !== originalValue_r1c1, true);

    // Simulate a sort-revert on the in-range cell: framework rewrites the text
    // node back to the original value (node identity preserved, class retained).
    tn_r1c1.nodeValue = originalValue_r1c1;

    eq('GV8 (pre): row-1 col-1 class still present after sort-revert',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

    // Trigger observer and flush debounce.
    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn_r1c1 }]);
    flushTimers(pendingTimers);

    // --- Post-conditions: excluded cells must NOT be rounded ---
    eq('GV8: row-0 col-0 text unchanged after re-apply (firstRow exclusion honored)',
      cell_r0c0.childNodes[0].nodeValue, 'Header');

    eq('GV8: row-0 col-0 does NOT carry dr-ext-rounded after re-apply',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV8: row-1 col-0 text unchanged after re-apply (firstColumn exclusion honored)',
      cell_r1c0.childNodes[0].nodeValue, '12345678');

    eq('GV8: row-1 col-0 does NOT carry dr-ext-rounded after re-apply',
      cell_r1c0.classList.contains('dr-ext-rounded'), false);

    // --- Post-condition: the in-range data cell MUST be re-rounded ---
    eq('GV8: row-1 col-1 re-rounded after sort-revert + re-apply',
      cell_r1c1.childNodes[0].nodeValue, roundedValue_r1c1);

    eq('GV8: row-1 col-1 still carries dr-ext-rounded after re-apply',
      cell_r1c1.classList.contains('dr-ext-rounded'), true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// ---------------------------------------------------------------------------
// GV9: Exclusion-gate parity — re-apply HONORS percent / currency gates.
//
// Grid layout (2 rows × 2 cols):
//   row 0:  '75%'        '50%'        ← % cells excluded by simplifyMixedPercent:false
//   row 1:  '12345678'   '$9,999,999' ← col 1 currency excluded by simplifyMixedCurrency:false
//
// Round with simplifyFirstRow:true, simplifyFirstColumn:true (skip those gates),
// simplifyMixedPercent:false, simplifyMixedCurrency:false.
//
// After initial roundTable:
//   - cellEls[0] (row0,col0) = % excluded  → NOT rounded
//   - cellEls[1] (row0,col1) = % excluded  → NOT rounded
//   - cellEls[2] (row1,col0) = plain int   → IS rounded
//   - cellEls[3] (row1,col1) = $ excluded  → NOT rounded
//
// Simulate sort-revert on cellEls[2]; trigger observer + flush.
// Assert:
//   - cellEls[0] and cellEls[1] still NOT rounded (percent exclusion honored)
//   - cellEls[3] still NOT rounded (currency exclusion honored)
//   - cellEls[2] IS re-rounded (plain numeric, in-range)
// ---------------------------------------------------------------------------
(function gv9_reapply_honorsExclusionGates_percentCurrency() {
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

    const cell_r0c0 = grid.cellEls[0];  // '75%'       — excluded percent
    const cell_r0c1 = grid.cellEls[1];  // '50%'       — excluded percent
    const cell_r1c0 = grid.cellEls[2];  // '12345678'  — should be rounded
    const cell_r1c1 = grid.cellEls[3];  // '$9999999'  — excluded currency

    // --- Pre-conditions after initial roundTable ---
    eq('GV9 (pre): row-0 col-0 (75%) is NOT rounded by initial pass (percent excluded)',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV9 (pre): row-0 col-1 (50%) is NOT rounded by initial pass (percent excluded)',
      cell_r0c1.classList.contains('dr-ext-rounded'), false);

    eq('GV9 (pre): row-1 col-0 IS rounded by initial pass (plain numeric)',
      cell_r1c0.classList.contains('dr-ext-rounded'), true);

    eq('GV9 (pre): row-1 col-1 ($9999999) is NOT rounded by initial pass (currency excluded)',
      cell_r1c1.classList.contains('dr-ext-rounded'), false);

    // Capture the rounded value for re-apply verification.
    const tn_r1c0 = cell_r1c0.childNodes[0];
    const roundedValue_r1c0 = tn_r1c0.nodeValue;
    const originalValue_r1c0 = DR_STORE.getTableOriginalText(grid.wrapperEl, cell_r1c0);

    eq('GV9 (pre): row-1 col-0 rounded value differs from original',
      roundedValue_r1c0 !== originalValue_r1c0, true);

    // Simulate sort-revert on the plain numeric cell.
    tn_r1c0.nodeValue = originalValue_r1c0;

    // Trigger observer and flush debounce.
    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: tn_r1c0 }]);
    flushTimers(pendingTimers);

    // --- Post-conditions: excluded cells must NOT be rounded ---
    eq('GV9: row-0 col-0 text unchanged after re-apply (percent exclusion honored)',
      cell_r0c0.childNodes[0].nodeValue, '75%');

    eq('GV9: row-0 col-0 does NOT carry dr-ext-rounded after re-apply',
      cell_r0c0.classList.contains('dr-ext-rounded'), false);

    eq('GV9: row-0 col-1 text unchanged after re-apply (percent exclusion honored)',
      cell_r0c1.childNodes[0].nodeValue, '50%');

    eq('GV9: row-1 col-1 text unchanged after re-apply (currency exclusion honored)',
      cell_r1c1.childNodes[0].nodeValue, '$9999999');

    eq('GV9: row-1 col-1 does NOT carry dr-ext-rounded after re-apply',
      cell_r1c1.classList.contains('dr-ext-rounded'), false);

    // --- Post-condition: the plain numeric cell MUST be re-rounded ---
    eq('GV9: row-1 col-0 re-rounded after sort-revert + re-apply',
      cell_r1c0.childNodes[0].nodeValue, roundedValue_r1c0);

    eq('GV9: row-1 col-0 still carries dr-ext-rounded after re-apply',
      cell_r1c0.classList.contains('dr-ext-rounded'), true);

  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

