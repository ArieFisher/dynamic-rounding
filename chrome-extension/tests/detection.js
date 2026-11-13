// Finding tables and grids, adapters, text pieces, and patches (lib/dr-table).

// ---------------------------------------------------------------------------
// Numbers inside links
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
      enabled: true, simplifyDates: false, simplifyTimes: false,
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
    // Cell: "Revenue 3000 " + <a>5</a>; the matches count in the pieces' flat
    // text, "Revenue 3000 5", which is what filterLinkMatches reads without a layout.
    const cell = makeLinkCell(['5'], 'Revenue 3000 ');

    eq('AC3: isCellWholeLink is false for mixed cell',
      isCellWholeLink(cell), false);

    const matches = extractNumbersInText(cell._textNodes.map((node) => node.nodeValue).join(''));
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
    const { landed } = writePatches({}, [
      { index: 2, numStr: '100', newNum: '90' },
      { index: 8, numStr: '999', newNum: '1,000' },
    ]);
    eq('patch-honesty: writePatches returns the landed count', landed, 1);
    eq('patch-honesty: an empty patch list lands zero patches',
      writePatches({}, []).landed, 0);
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
// The data test counts a cell when the classification ladder rounds it with
// every switch on and no range expression: a date, a time, a unit number, a
// bracketed number, and a number after words count; a cell whose only digits
// form a phone number does not, and a whole-link cell does not. The test
// reads no table settings, so a table passes or fails the same way whatever
// its switches hold.
// ---------------------------------------------------------------------------

(function isDataTable_dateOnlyColumn() {
  const table = makeIsDataTable([
    ['Date',       'Owner'],
    ['2024-01-15', 'Alice'],
  ]);
  eq('isDataTable: date-only column ("2024-01-15") -> true (a date rounds)',
    isDataTable(table), true);
})();

(function isDataTable_slashDateColumn() {
  const table = makeIsDataTable([
    ['Date',        'Owner'],
    ['15/03/2024',  'Bob'],
  ]);
  eq('isDataTable: slash date column ("15/03/2024") -> true (a date rounds)',
    isDataTable(table), true);
})();

(function isDataTable_timeOnlyColumn() {
  const table = makeIsDataTable([
    ['Time',  'Event'],
    ['09:30', 'Standup'],
  ]);
  eq('isDataTable: time-only column ("09:30") -> true (a time rounds)',
    isDataTable(table), true);
})();

(function isDataTable_unitSuffixColumn() {
  const table = makeIsDataTable([
    ['Weight', 'Item'],
    ['3.5 kg', 'Box'],
  ]);
  eq('isDataTable: unit-suffix column ("3.5 kg") -> true (the number beside the word rounds)',
    isDataTable(table), true);
})();

(function isDataTable_allTextColumn() {
  const table = makeIsDataTable([
    ['Status', 'Owner'],
    ['Open',   'Alice'],
  ]);
  eq('isDataTable: all-text table -> false (no cell holds a value the extension can round)',
    isDataTable(table), false);
})();

(function isDataTable_accountingNegativeColumn() {
  const table = makeIsDataTable([
    ['Amount',   'Item'],
    ['(1,234)',  'Refund'],
  ]);
  eq('isDataTable: accounting-negative cell ("(1,234)") -> true (a bracketed number rounds)',
    isDataTable(table), true);
})();

(function dataTest_aNumberAfterWordsCounts() {
  const table = makeIsDataTable([
    ['Name', 'Note'],
    ['Tami', 'I am 68.5 years old'],
  ]);
  eq('data test: a table whose only number sits after words ("I am 68.5 years old") passes',
    isDataTable(table), true);
})();

(function dataTest_aClockTimeBesideWordsCountsByItsOtherNumber() {
  const table = makeIsDataTable([
    ['Name', 'Seen'],
    ['Tami', 'Seen 3:44 PM (37 minutes ago)'],
  ]);
  eq('data test: a table whose cell holds a clock time and "37 minutes ago" passes',
    isDataTable(table), true);
})();

(function dataTest_aPhoneNumberAloneFails() {
  const table = makeIsDataTable([
    ['Name', 'Phone'],
    ['Tami', '416-555-1234'],
    ['Oren', '(647) 555-0198'],
  ]);
  eq('data test: a table whose only digits form a phone number fails',
    isDataTable(table), false);
})();

(function dataTest_aDateAloneCounts() {
  const table = makeIsDataTable([
    ['Name', 'Joined'],
    ['Tami', 'Nov 3'],
  ]);
  eq('data test: a table whose only number sits in a date ("Nov 3") passes',
    isDataTable(table), true);
})();

(function dataTest_aPureNumberCounts() {
  const table = makeIsDataTable([
    ['Name', 'Sales'],
    ['Tami', '$1,234'],
  ]);
  eq('data test: a table holding a pure cell ("$1,234") passes',
    isDataTable(table), true);
})();

(function dataTest_aWholeLinkCellFails() {
  const linkCell = withTextPiece({
    textContent: '42', innerText: '42',
    querySelectorAll: (sel) => (sel === 'a' ? [{ innerText: '42' }] : []),
  });
  const table = { rows: [
    { cells: [withTextPiece({ textContent: 'Name' }), withTextPiece({ textContent: 'Page' })] },
    { cells: [withTextPiece({ textContent: 'Tami' }), linkCell] },
  ] };
  eq('data test: a table whose only number is a whole-link cell fails',
    isDataTable(table), false);
})();

(function dataTest_readsNoTableSettings() {
  // The shipped defaults hold the Times switch off. The data test reads
  // every switch as on, so a clock time still counts.
  const dates = makeIsDataTable([['Name', 'Joined'], ['Tami', '2026-11-03']]);
  const times = makeIsDataTable([['Name', 'Seen'], ['Tami', '3:44 PM']]);
  eq('data test: a table whose only number sits in an ISO date passes',
    isDataTable(dates), true);
  eq('data test: a table whose only number sits in a clock time passes',
    isDataTable(times), true);
})();

(function dataTest_aGridGivesTheSameResult() {
  eq('data test: a grid whose only number sits after words passes',
    isDataTable(makeGridWrapper([['Name', 'Note'], ['Tami', 'I am 68.5 years old']]).wrapperEl), true);
  eq('data test: a grid whose only digits form a phone number fails',
    isDataTable(makeGridWrapper([['Name', 'Phone'], ['Tami', '416-555-1234']]).wrapperEl), false);
})();

// The geometry probe's numeric step reads the same rule as the data test.
(function geometryProbe_numericStepReadsTheDataTestRule() {
  const makeEl = (texts) => ({
    className: '',
    getAttribute: (name) => (name === 'role' ? 'grid' : null),
    children: texts.map((text) => ({ className: 'row', children: [withTextPiece({ textContent: 'Tami' }), withTextPiece({ textContent: text })] })),
  });
  const gridProbe = { getComputedStyle: () => ({ display: 'grid' }), getOffsetWidth: () => 100 };
  eq('geometry probe: rows whose only number sits after words pass the numeric step',
    looksLikeGrid(makeEl(Array(5).fill('I am 68.5 years old')), { styleProbe: gridProbe }), true);
  eq('geometry probe: rows whose only digits form a phone number fail the numeric step',
    looksLikeGrid(makeEl(Array(5).fill('416-555-1234')), { styleProbe: gridProbe }), false);
})();

// The numeric step reads each cell through the rounding pass's per-cell
// read, so a number inside a link inside words and a number split across
// text pieces count for nothing there, the way they count for nothing in
// the data test. A plain number in the same place passes, so neither
// failure comes from the grid's shape.
(function geometryProbe_numericStepCountsOnlyACellThatRounds() {
  const gridProbe = { getComputedStyle: () => ({ display: 'grid' }), getOffsetWidth: () => 100 };
  const gridOf = (pieces) => rwEl('div', { role: 'grid' }, Array.from({ length: 5 }, () =>
    rwEl('div', {}, [rwEl('div', {}, rwPieces('Tami')), rwEl('div', {}, rwPieces(pieces))])));
  withRewritePage(() => {
    eq('geometry probe: rows whose only number is a plain "42" pass the numeric step',
      looksLikeGrid(gridOf('42'), { styleProbe: gridProbe }), true);
    eq('geometry probe: rows whose only number sits inside a link inside words fail the numeric step',
      looksLikeGrid(gridOf(['see ', { tag: 'a', text: 'page 42' }]), { styleProbe: gridProbe }), false);
    eq('geometry probe: rows whose only number is split as "1" and a bold "23" fail the numeric step',
      looksLikeGrid(gridOf(['1', { tag: 'b', text: '23' }]), { styleProbe: gridProbe }), false);
    eq('geometry probe: rows whose only number is split as "4." and "91" fail the numeric step',
      looksLikeGrid(gridOf(['4.', { tag: 'span', text: '91' }]), { styleProbe: gridProbe }), false);
  });
})();

// The numeric step spends the data test's budget of cell reads, walked row
// by row. Rows of ten cells each: a number at the budget-th cell passes, and
// the same grid with its only number one cell past the budget fails.
(function geometryProbe_numericStepSpendsTheDataTestBudget() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const cols = 10;
  const gridProbe = { getComputedStyle: () => ({ display: 'grid' }), getOffsetWidth: () => 100 };
  const gridWithNumberAt = (position) => ({
    className: '',
    getAttribute: (name) => (name === 'role' ? 'grid' : null),
    children: Array.from({ length: Math.ceil(position / cols) }, (_, r) => ({
      className: 'row',
      children: Array.from({ length: cols }, (__, c) =>
        withTextPiece({ textContent: r * cols + c + 1 === position ? '42' : 'text' })),
    })),
  });
  eq('geometry probe: rows whose only number sits at the budget-th cell pass the numeric step',
    looksLikeGrid(gridWithNumberAt(budget), { styleProbe: gridProbe }), true);
  eq('geometry probe: rows whose only number sits one cell past the budget fail the numeric step',
    looksLikeGrid(gridWithNumberAt(budget + 1), { styleProbe: gridProbe }), false);
})();

(function geometryProbe_columnPlanReadsSpansWithinTheDataTestBudget() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const gridProbe = { getComputedStyle: () => ({ display: 'grid' }), getOffsetWidth: () => 100 };
  let spanReads = 0;
  const grid = {
    className: '',
    getAttribute: (name) => (name === 'role' ? 'grid' : null),
    children: Array.from({ length: budget + 50 }, () => ({
      className: 'row',
      children: [withTextPiece({
        textContent: 'text',
        getAttribute: (name) => { if (name === 'aria-colspan') spanReads++; return null; },
      })],
    })),
  };
  eq('geometry probe: candidate rows holding no number fail the numeric step',
    looksLikeGrid(grid, { styleProbe: gridProbe }), false);
  eq('geometry probe: the column plan reads spans within the data test budget',
    spanReads <= budget, true);
})();

// The removed repetition step passed when the largest first-class-token share
// or the largest child-count share (zero-child entries included) reached the
// floor. The consistent-cell-count step reads the largest non-zero child-count
// share against the same floor, which never exceeds the removed step's share,
// so the removed step rejected nothing. These tests restate it as a pure
// function and show the later step passing implies it passing.
const oldRepetitionStepPasses = (children) => {
  const classFreq = new Map();
  for (const child of children) {
    const cls = (child.className && typeof child.className === 'string')
      ? child.className.trim().split(/\s+/)[0]
      : '';
    classFreq.set(cls, (classFreq.get(cls) || 0) + 1);
  }
  const childCountFreq = new Map();
  for (const child of children) {
    const cc = child.children ? child.children.length : 0;
    childCountFreq.set(cc, (childCountFreq.get(cc) || 0) + 1);
  }
  const floor = children.length * DR_DETECTION_SETTINGS.gridRepetitionShare;
  return Math.max(...classFreq.values()) >= floor || Math.max(...childCountFreq.values()) >= floor;
};
const consistentCellCountStepPasses = (children) =>
  childCountCandidates(children).modalFreq >= children.length * DR_DETECTION_SETTINGS.gridRepetitionShare;

// Ten children make a floor of five. The last case holds a zero-child share
// alone: only the removed step counted zero-child entries.
(function geometryProbe_theRemovedRepetitionStepRejectedNothing() {
  const sameClass = Array(10).fill('row');
  const ownClass = Array.from({ length: 10 }, (_, i) => 'row' + i);
  const repeatedCount = [2, 2, 2, 2, 2, 2, 1, 3, 4, 5];
  const spreadCount = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
  const cases = [
    { name: 'class share and child-count share reach the floor', classes: sameClass, counts: repeatedCount, laterStep: true, removedStep: true, probe: true },
    { name: 'class share reaches the floor, child-count share does not', classes: sameClass, counts: spreadCount, laterStep: false, removedStep: true, probe: false },
    { name: 'child-count share reaches the floor, class share does not', classes: ownClass, counts: repeatedCount, laterStep: true, removedStep: true, probe: true },
    { name: 'neither share reaches the floor', classes: ownClass, counts: spreadCount, laterStep: false, removedStep: false, probe: false },
    { name: 'only the zero-child share reaches the floor', classes: ownClass, counts: [0, 0, 0, 0, 0, 1, 2, 3, 4, 5], laterStep: false, removedStep: true, probe: false },
  ];
  let laterPassedWhereRemovedFailed = 0;
  for (const c of cases) {
    const rows = c.counts.map((count, i) => makeGridRow(Array(count).fill({ text: '5' }), c.classes[i]));
    const container = makeGridContainer(rows, 'flex', 'grid', '');
    const children = Array.from(container.children);
    eq('geometry probe: the consistent-cell-count step reads ' + c.name,
      consistentCellCountStepPasses(children), c.laterStep);
    eq('geometry probe: the removed repetition step read ' + c.name,
      oldRepetitionStepPasses(children), c.removedStep);
    if (consistentCellCountStepPasses(children) && !oldRepetitionStepPasses(children)) laterPassedWhereRemovedFailed++;
    withGridComputedStyle(container, 'flex', function() {
      eq('geometry probe: a grid with the grid role where ' + c.name + ' gives the result the probe gave with the removed step',
        looksLikeGrid(container), c.probe);
    });
  }
  eq('geometry probe: no case passes the consistent-cell-count step and fails the removed repetition step',
    laterPassedWhereRemovedFailed, 0);
})();

// 1024 x 32 + 4096 x 64 = 294,912 inputs (child-count vectors of length 5 and
// 6 over {0, 1, 2, 3}, crossed with first class tokens "a" and "b"). The cap
// keeps the loop under a second. A second token in each class string checks
// that only the first token groups children.
(function geometryProbe_everyBoundedInputPassingTheLaterStepPassesTheRemovedStep() {
  const countValues = [0, 1, 2, 3];
  let checked = 0;
  let laterPasses = 0;
  let removedOnly = 0;
  const violations = [];
  for (const length of [5, 6]) {
    for (let countCode = 0; countCode < Math.pow(countValues.length, length); countCode++) {
      for (let classCode = 0; classCode < Math.pow(2, length); classCode++) {
        const children = Array.from({ length }, (_, i) => ({
          className: (((classCode >> i) & 1) ? 'b' : 'a') + ' s' + i,
          children: { length: countValues[Math.floor(countCode / Math.pow(countValues.length, i)) % countValues.length] },
        }));
        const later = consistentCellCountStepPasses(children);
        const removed = oldRepetitionStepPasses(children);
        checked++;
        if (later) laterPasses++;
        if (removed && !later) removedOnly++;
        if (later && !removed && violations.length < 3) violations.push(children.map((c) => c.className + ':' + c.children.length));
      }
    }
  }
  eq('geometry probe: the bounded loop checks 294,912 inputs', checked, 294912);
  eq('geometry probe: no bounded input passes the consistent-cell-count step and fails the removed repetition step',
    violations, []);
  eq('geometry probe: the bounded loop holds inputs that pass the consistent-cell-count step (the check is not empty)',
    laterPasses > 0, true);
  eq('geometry probe: the bounded loop holds inputs that pass only the removed repetition step (the check can fail)',
    removedOnly > 0, true);
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

(function placeDecision_keepsTheNumbersThatSitInOnePiece() {
  const match = (numStr, index) => ({ numStr, num: Number(numStr), index });
  const extracted = (...matches) => ({ mode: 'extracted', reason: 'simplify', value: { matches } });
  const layout = (original, toFlat) => ({ original, toFlat });
  eq('placeDecision: pieces on separate lines keep both numbers',
    placeDecision(extracted(match('1', 0), match('23', 2)), layout(['1', '23'], [0, 1, 1, 2])), extracted(match('1', 0), match('23', 2)));
  eq('placeDecision: a number across two pieces skips with reason split',
    placeDecision(extracted(match('123', 0)), layout(['1', '23'], [0, 1, 2])), { mode: 'skip', reason: 'split', split: true });
  eq('placeDecision: a split number leaves the cell\'s other numbers',
    placeDecision(extracted(match('123', 0), match('45', 4)), layout(['1', '23 ', '45'], [0, 1, 2, 3, 4, 5])),
    Object.assign(extracted(match('45', 4)), { split: true }));
  eq('placeDecision: a number in one piece stands',
    placeDecision(extracted(match('123', 0)), layout(['123'], null)), extracted(match('123', 0)));
  eq('placeDecision: a rendered position converts through toFlat before the piece check',
    placeDecision(extracted(match('123', 0)), layout(['\n  ', '123', '\n'], [3, 4, 5])), extracted(match('123', 0)));
})();

// ---------------------------------------------------------------------------
// <sup>-aware number masking
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

// Standard opts for the exponent tests.
const supTestOpts = {
  enabled: true,
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
// writePatches — unit tests and integration regression tests
// =============================================================================

// ---------------------------------------------------------------------------
// Unit tests for writePatches
// ---------------------------------------------------------------------------
(function applyExtractedPatches_unitTests() {

  // AP1: single text node, single patch
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'Revenue 1500 USD' }]);
    writePatches(cell, [{ index: 8, numStr: '1500', newNum: '2k' }]);
    eq('AP1: single node patch replaces number', cell._textNodes[0].nodeValue, 'Revenue 2k USD');
  });

  // AP2: two patches in the same node, right-to-left order preserved
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '1500 and 2500' }]);
    writePatches(cell, [
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
    writePatches(cell, [{ index: 0, numStr: '1.5', newNum: '2' }]);
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
    writePatches(cell, [{ index: 6, numStr: '1500', newNum: '2k' }]);
    eq('AP4: first node untouched', cell._textNodes[0].nodeValue, 'text, ');
    eq('AP4: second node patched',  cell._textNodes[1].nodeValue, '2k');
  });

  // AP5: defensive — wrong numStr at index → node unchanged
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    writePatches(cell, [{ index: 4, numStr: '9999', newNum: '10k' }]);
    eq('AP5: wrong numStr → no change', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

  // AP6: empty patches array → no-op
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    writePatches(cell, []);
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
    eq('RG3: plain node was rounded (1234 → 1,000)',
      plainNode.nodeValue, '1,000 ');
  });

})();

// =============================================================================
// Grid Detection — looksLikeGrid() and findTargetTable() unit tests
// Spec: docs/sprint-plans/grid-support.md §6
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
// so the alignment step passes.
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
// The alignment step is skipped when role="grid". We prove this by
// making column-0 offsetWidths NON-uniform (all different) — if the alignment step ran,
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
  // All column-0 widths differ → the alignment step would reject; ARIA role must short-circuit before it.
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
// This proves the numeric-content step works as the mandatory false-positive guard.
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

// LG7: Reject — display is not grid/flex (layout step)
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

// LG8: Reject — non-uniform column-0 widths (alignment step) when no short-circuit
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
  // No role, no library class → the alignment step runs and must reject.
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — non-uniform column-0 widths (alignment step)',
      looksLikeGrid(container), false);
  });
})();

// LG9: Pass — column-0 widths are uniform (80% threshold satisfied)
// Exactly matching widths → the alignment step passes.
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

    // Text-only rows: will fail looksLikeGrid at the numeric-content step (no numeric content)
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
    // Text-only rows fail looksLikeGrid (numeric-content step — no numeric content)
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

// FT5: findTargetTable — returns registered ancestor without re-walking
// If an ancestor is already registered per opts.isRegistered (see
// lib/dr-table/detect.js), it must be returned immediately without calling
// looksLikeGrid again.
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
    const result = findTargetTable(clickTarget, { isRegistered: (el) => seen.has(el) });

    eq('findTargetTable: returns registered ancestor immediately',
      result.handle, existingGrid);
    // Already found — the caller has already handled this one; isNew is false.
    eq('findTargetTable: registered ancestor reports isNew: false',
      result.isNew, false);
  });
})();

// FT6: findTargetTable — returns a new grid via { handle, isNew: true } and
// does not mark it itself; the caller — content.js's markAndAddTablePillboxIfNewGrid —
// writes dr-ext-grid and builds the table pillbox. findTargetTable must resolve the
// new grid AND must leave it unmarked.
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
// Right-click registration: the nomination step runs from the clicked
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
    { isRegistered: () => false, styleProbe });

  eq('findTargetTable AC1: a click in the scrolling pane resolves the scrolling pane',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC1: the scrolling pane resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC1: the resolution reads no layout, so the geometry probe did not produce it',
    styleProbe.layoutReads, 0);
  eq('findTargetTable AC1: the resolution writes no grid marker class',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
      .map((el) => el.classList.contains('dr-ext-grid')), [false, false, false]);
  eq('findTargetTable AC1: the resolution adds no registry entry',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
      .map((el) => DR_MODEL.hasTable(el)), [false, false, false]);
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
  const paneRowResult = findTargetTable(plain.paneParentEl, { isRegistered: () => false });
  eq('findTargetTable AC1: a click on the plain layer between the panes resolves the scrolling pane',
    paneRowResult !== null && paneRowResult.handle === plain.scrollPaneEl, true);

  const grid = makeDatabaseQueryGrid();
  const wrapperResult = findTargetTable(grid.wrapperEl, { isRegistered: () => false });
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
  const result = findTargetTable(gutterCell, { isRegistered: () => false, styleProbe });

  eq('findTargetTable AC2: a click in the row-number gutter resolves the scrolling pane beside it',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC2: the gutter resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC2: the gutter resolution reports neither the pinned pane nor the wrapper',
    result !== null &&
      (result.handle === grid.pinnedPaneEl || result.handle === grid.wrapperEl), false);
  eq('findTargetTable AC2: the gutter resolution reads no layout, so the geometry probe did not produce it',
    styleProbe.layoutReads, 0);

  // The layout counter is a live probe: the geometry probe does read layout
  // when a case reaches it, so the zero above stands for a route that stopped
  // earlier rather than for a port nothing ever calls.
  const roleLessProbe = makeCountingStyleProbe();
  const roleLess = makeDgNode('DIV', 'plain-host', null,
    [0, 1, 2, 3, 4, 5].map((i) => makeDgRow(i, ['north', '4,281,905', '17.40'])));
  findTargetTable(roleLess.children[0].children[0],
    { isRegistered: () => false, styleProbe: roleLessProbe });
  eq('findTargetTable AC2: a role-less tree does reach the geometry probe and read layout',
    roleLessProbe.layoutReads > 0, true);
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
    findTargetTable(oneCell.children[0].children[0], { isRegistered: () => false }), null);
  eq('findTargetTable AC3: a click inside the two-rows-no-number element resolves nothing',
    findTargetTable(noNumber.children[0].children[0], { isRegistered: () => false }), null);
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
    { isRegistered: () => false, styleProbe });

  eq('findTargetTable AC3: an empty nomination falls through and the probe resolves the nest',
    result !== null && result.handle === nest, true);
  eq('findTargetTable AC3: the fall-through resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC3: the fall-through resolution reads layout, so the geometry probe produced it',
    styleProbe.layoutReads > 0, true);
})();

// --- AC4: a registered table resolves at the registry route ---
//
// The proof goes through the ports the resolver takes, not through the
// source text: opts.isRegistered records the elements the resolver asked the
// registry about, and isNew reports which route resolved the click. The
// registry route reports isNew false; the nomination step reports isNew
// true. The last pair of assertions runs the same click with nothing
// registered, so the isNew false above stands for the registry route rather
// than for a resolver that never reports a new table.

(function rightClickRegisters_AC4_aRegisteredTableResolvesAtTheRegistryRoute() {
  const grid = makeDatabaseQueryGrid();
  const cell = grid.scrollRowEls[3].children[1];

  const asked = [];
  const result = findTargetTable(cell, {
    isRegistered: (el) => { asked.push(el); return el === grid.scrollPaneEl; },
  });

  eq('findTargetTable AC4: a click inside a registered scrolling pane resolves it',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: the registry route reports isNew false',
    result !== null && result.isNew, false);
  eq('findTargetTable AC4: the registry walk stops at the scrolling pane',
    asked.length > 0 && asked[asked.length - 1] === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: no step asks the registry about the wrapper',
    asked.includes(grid.wrapperEl), false);

  const freshResult = findTargetTable(cell, { isRegistered: () => false });
  eq('findTargetTable AC4: the same click with nothing registered reaches the nomination step',
    freshResult !== null && freshResult.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: and that resolution reports isNew true',
    freshResult !== null && freshResult.isNew, true);
})();

// --- Edge: a crowded depth falls back outward on a right-click ---

(function rightClickRegisters_edge_aCrowdedDepthFallsBackOutwardOnARightClick() {
  const grid = makeDatabaseQueryGrid({ pinnedColumns: 2 });

  eq('findTargetTable edge: a two-column pinned pane puts two elements at the shipped depth',
    isDataTable(grid.pinnedPaneEl) && isDataTable(grid.scrollPaneEl), true);

  const result = findTargetTable(grid.scrollRowEls[0].children[0], { isRegistered: () => false });
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
// TableAdapter abstraction
// AC2 — NativeTableAdapter round-trip test
// AC3 — GridAdapter stub no-throw test
// AC4 — source scan: no data-row-index literal in content.js
// ---------------------------------------------------------------------------

// TA1: NativeTableAdapter round-trip
// Build a native table element, wrap it with makeAdapter(), walk the adapter
// API (getRows → getCells → getText) and assert values match what was put in.
// Also assert isGrid() === false and getElement() returns the element.
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

  eq('NativeTableAdapter: isGrid() === false',
    adapter.isGrid(), false);

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

// TA1b: a native cell writes only through applyPatches, which patches each
// text piece in place and records the original. A writer that assigns a
// cell's textContent or innerHTML flattens the markup of a mixed cell and
// skips that record, so the restore and the sidebar preview read the rounded
// text as the original. A writer added to this class must patch text pieces
// in place and record the original, as applyPatches does.
(function nativeTableAdapter_hasNoSetText() {
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
// isGrid() === true, getRows() === [], getElement() returns the element.
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

  eq('GridAdapter: isGrid() === true',
    adapter.isGrid(), true);

  eq('GridAdapter: getRows() returns empty array (stub)',
    adapter.getRows().length, 0);
})();

// TA4: roundTable on a grid element (non-TABLE) — must not throw
// The stub path: GridAdapter.getRows() → [] causes roundTable to return early.
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
})();

// The writer groups patches by piece, writes each touched piece once, and
// returns the landed count with each touched piece's text before and after.
(function applyExtractedPatchesReturnsTouchedPieces() {
  const cell = makeElementNode('', [makeTextNode('A 100 B 200'), makeTextNode(' C 300')]);
  const [first, second] = cell.childNodes;
  // The pieces walk runs with no tree walker in this suite's document.
  let result;
  try {
    result = writePatches(cell, [
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
    writePatches(cell, []), { landed: 0, pieces: [] });
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

  eq('GR1: isGrid() === true',
    adapter.isGrid(), true);

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
  const bodies = ['function makeCellObj(', 'function writePatches(', 'function restoreTextPieces(']
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

  // Directly call makeCellObj to get a cell object for our empty cell
  const cellObj = makeCellObj(emptyCell, adapter.originalsPort);

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
// writePatches → nodeValue =), NOT cell.innerHTML = … which destroys
// React fiber identity.
//
// Source-level assertion: the cell object both kinds share, the patch
// writer, the piece restore, and the controller's restore hold no
// innerHTML= assignment. A native restore writes text pieces too, so no
// write path on either kind assigns markup.
//
// This test encodes the hard rule:
//   "The grid write must be nodeValue-only."
(function gr6j_gridWrite_sourceGuard_noInnerHTML() {
  const src = allContentSrc;
  const bodies = ['function makeCellObj(', 'function writePatches(', 'function restoreTextPieces(',
    'function restoreTable(', 'function releaseCell(']
    .map((signature) => sourceBodyOf(src, signature));

  eq('GR6j: the write path has no innerHTML= assignment',
    bodies.every((body) => body.length > 0 && !/innerHTML\s*=(?!=)/.test(body)), true);

  // The cell object writes through the patch writer, and the patch writer
  // writes through nodeValue (the only permitted write).
  eq('GR6j: applyPatches writes through the patch writer, which assigns nodeValue',
    /writePatches\(/.test(bodies[0]) && /\.nodeValue\s*=(?!=)/.test(bodies[1]), true);
})();

// ---------------------------------------------------------------------------
// Accessibility artifact predicate: isAccessibilityArtifact
// ---------------------------------------------------------------------------
//
// isAccessibilityArtifact(table) returns true when EITHER signal holds:
//   Signal 1 – table or any ancestor has aria-hidden="true"
//   Signal 2 – nearest positioned ancestor (or the table itself) has
//               left <= OFFSCREEN_LEFT_PX_THRESHOLD (-9999)
// Returns false for an ordinary on-screen 2-column numeric table.
//
// Mock-building helpers:
//   makeStubEl(attrs)  – minimal element node with getAttribute / parentElement / style
//   chainParents(child, ...parents)  – link elements into a parentElement chain
//   makePositionedAncestor(styleProps)  – element with style.position = 'absolute'

// ---------------------------------------------------------------------------
// Signal 1: aria-hidden="true" on the table itself
// ---------------------------------------------------------------------------
(function accessibilityArtifact_signal1_selfHidden() {
  const table = makeStubEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
  eq('isAccessibilityArtifact: aria-hidden="true" on table itself -> true',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), true);
})();

// Signal 1: aria-hidden="true" on immediate parent
(function accessibilityArtifact_signal1_parentHidden() {
  const table = makeStubEl({ tagName: 'TABLE' });
  const parent = makeStubEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, parent);
  eq('isAccessibilityArtifact: aria-hidden="true" on immediate parent -> true',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), true);
})();

// Signal 1: aria-hidden="true" several ancestors up (nested deeply)
(function accessibilityArtifact_signal1_deepAncestorHidden() {
  const table      = makeStubEl({ tagName: 'TABLE' });
  const tbody      = makeStubEl({ tagName: 'TBODY' });
  const innerDiv   = makeStubEl({ tagName: 'DIV' });
  const middleDiv  = makeStubEl({ tagName: 'DIV' });
  const outerDiv   = makeStubEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, tbody, innerDiv, middleDiv, outerDiv);
  eq('isAccessibilityArtifact: aria-hidden="true" several levels up -> true',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), true);
})();

// Edge: aria-hidden="false" must NOT trigger signal 1
(function accessibilityArtifact_signal1_ariaHiddenFalse() {
  const table  = makeStubEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'false' } });
  const parent = makeStubEl({ tagName: 'DIV',   attrs: { 'aria-hidden': 'false' } });
  chainParents(table, parent);
  eq('isAccessibilityArtifact: aria-hidden="false" does NOT trigger -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// ---------------------------------------------------------------------------
// Signal 2: nearest positioned ancestor has inline left <= threshold
// ---------------------------------------------------------------------------

// Signal 2: positioned ancestor with left: -10000px (Kaggle evidence)
(function accessibilityArtifact_signal2_offscreenLeft_minus10000() {
  const table  = makeStubEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-10000px' });
  chainParents(table, posAnc);
  eq('isAccessibilityArtifact: positioned ancestor left=-10000px -> true',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), true);
})();

// Signal 2: positioned ancestor at exactly the threshold value (-9999px)
(function accessibilityArtifact_signal2_offscreenLeft_exactThreshold() {
  const table  = makeStubEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9999px' });
  chainParents(table, posAnc);
  eq('isAccessibilityArtifact: positioned ancestor left=-9999px (at threshold) -> true',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), true);
})();

// Signal 2: table itself is positioned and off-screen (no separate ancestor)
(function accessibilityArtifact_signal2_tableSelfOffscreen() {
  const table = makeStubEl({ tagName: 'TABLE', style: { position: 'absolute', left: '-10000px' } });
  eq('isAccessibilityArtifact: table itself is positioned with left=-10000px -> true',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), true);
})();

// Edge: left value just ABOVE threshold (-9998px) must NOT trigger
(function accessibilityArtifact_signal2_leftJustAboveThreshold() {
  const table  = makeStubEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9998px' });
  chainParents(table, posAnc);
  eq('isAccessibilityArtifact: positioned ancestor left=-9998px (above threshold) -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// Edge: modest off-screen like -100px must NOT trigger signal 2
(function accessibilityArtifact_signal2_modestNegativeLeft() {
  const table  = makeStubEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-100px' });
  chainParents(table, posAnc);
  eq('isAccessibilityArtifact: positioned ancestor left=-100px (not extreme) -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// Edge: non-positioned ancestor with extreme left — should NOT count because the
// ancestor is not positioned; no positioned ancestor found so checkEl = table,
// and table has no extreme left.
(function accessibilityArtifact_signal2_nonPositionedAncestorIgnored() {
  const table   = makeStubEl({ tagName: 'TABLE' });
  // wrapper has no inline style.position and getComputedStyle returns '' for position
  const wrapper = makeStubEl({ tagName: 'DIV', style: { left: '-10000px' } });
  chainParents(table, wrapper);
  // No positioned ancestor found → checkEl = table (which has no extreme left)
  eq('isAccessibilityArtifact: non-positioned ancestor with extreme left -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// Edge: no positioned ancestor found at all — no crash
(function accessibilityArtifact_noPosAncestor() {
  const table = makeStubEl({ tagName: 'TABLE' });
  // No parentElement — predicate must not throw and returns false
  eq('isAccessibilityArtifact: no positioned ancestor, no signals -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// ---------------------------------------------------------------------------
// Negative case: ordinary on-screen 2-column numeric table
// ---------------------------------------------------------------------------
(function accessibilityArtifact_negative_ordinaryTable() {
  const table  = makeStubEl({ tagName: 'TABLE' });
  const parent = makeStubEl({ tagName: 'DIV' });
  chainParents(table, parent);
  // No aria-hidden, no off-screen left, no positioned ancestor → false
  eq('isAccessibilityArtifact: ordinary on-screen numeric table -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// Negative: positioned ancestor but normal on-screen left (-50px), no aria-hidden
(function accessibilityArtifact_negative_onscreenPositionedAncestor() {
  const table  = makeStubEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-50px' });
  posAnc.querySelectorAll = function() { return []; };
  chainParents(table, posAnc);
  eq('isAccessibilityArtifact: positioned ancestor with normal left (-50px) -> false',
    isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
})();

// ---------------------------------------------------------------------------
// Guard: invalid / null input
// ---------------------------------------------------------------------------
(function accessibilityArtifact_nullInput() {
  eq('isAccessibilityArtifact: null -> false',
    isAccessibilityArtifact(null), false);
})();

(function accessibilityArtifact_noGetAttribute() {
  eq('isAccessibilityArtifact: plain object without getAttribute -> false',
    isAccessibilityArtifact({}), false);
})();

// --- pass1-filter AC1: accessibility artifacts (aria-hidden ancestor) get NO table pillbox ---
// Build N=3 accessibility artifacts (aria-hidden parent), all valid data tables.
// After Pass 1 none of them should be in tablePillboxes.

(function pass1Filter_ariaHiddenArtifacts_zeroTablePillboxes() {
  function makeAriaHiddenArtifact() {
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

  const artifacts = [makeAriaHiddenArtifact(), makeAriaHiddenArtifact(), makeAriaHiddenArtifact()];

  // Sanity: each artifact is a valid data table (isDataTable guard is NOT the cause of skip)
  eq('pass1-filter: aria-hidden accessibility artifact satisfies isDataTable (sanity)',
    isDataTable(artifacts[0]), true);
  // Sanity: each artifact is detected as an artifact
  eq('pass1-filter: aria-hidden accessibility artifact isAccessibilityArtifact is true (sanity)',
    isAccessibilityArtifact(artifacts[0], { styleProbe: inlineStyleProbe }), true);

  runPass1WithTables(artifacts);

  const togglesCreated = artifacts.filter(t => tablePillboxes.has(t)).length;
  eq('pass1-filter: 3 aria-hidden accessibility artifacts → ZERO table pillboxes created',
    togglesCreated, 0);

  cleanupPass1Tables(artifacts);
})();

// --- pass1-filter AC1: accessibility artifacts (off-screen left) get NO table pillbox ---
// Build N=2 accessibility artifacts with positioned ancestor left=-10000px.

(function pass1Filter_offscreenLeftArtifacts_zeroTablePillboxes() {
  function makeOffscreenArtifact() {
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

  const artifacts = [makeOffscreenArtifact(), makeOffscreenArtifact()];

  // Sanity checks
  eq('pass1-filter: off-screen accessibility artifact satisfies isDataTable (sanity)',
    isDataTable(artifacts[0]), true);
  eq('pass1-filter: off-screen accessibility artifact isAccessibilityArtifact is true (sanity)',
    isAccessibilityArtifact(artifacts[0], { styleProbe: inlineStyleProbe }), true);

  runPass1WithTables(artifacts);

  const togglesCreated = artifacts.filter(t => tablePillboxes.has(t)).length;
  eq('pass1-filter: 2 off-screen accessibility artifacts → ZERO table pillboxes created',
    togglesCreated, 0);

  cleanupPass1Tables(artifacts);
})();

// --- pass1-filter AC2: a normal on-screen table still gets exactly ONE table pillbox ---

(function pass1Filter_realTable_getsOneTablePillbox() {
  const realTable = makePass1DataTable();
  // No aria-hidden, no positioned ancestor → isAccessibilityArtifact returns false
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
  eq('pass1-filter: real on-screen table isAccessibilityArtifact is false (sanity)',
    isAccessibilityArtifact(realTable, { styleProbe: inlineStyleProbe }), false);

  runPass1WithTables([realTable]);

  eq('pass1-filter: normal on-screen table → exactly ONE table pillbox created',
    tablePillboxes.has(realTable), true);

  cleanupPass1Tables([realTable]);
})();

// --- pass1-filter adversarial: mix of artifacts + real tables in one Pass 1 run ---
// Only the real tables should get table pillboxes; count equals exactly the number of real tables.

(function pass1Filter_mixedFixture_onlyRealTablesGetTablePillboxes() {
  // Two accessibility artifacts (aria-hidden ancestor)
  function makeAriaHiddenArtifact() {
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

  // One artifact with off-screen left
  function makeOffscreenArtifact() {
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

  const artifact1 = makeAriaHiddenArtifact();
  const artifact2 = makeAriaHiddenArtifact();
  const artifact3 = makeOffscreenArtifact();
  const real1    = makeRealTable();
  const real2    = makeRealTable();

  // Interleave so Pass 1 processes them in mixed order
  const allTables = [artifact1, real1, artifact2, real2, artifact3];

  runPass1WithTables(allTables);

  const artifacts = [artifact1, artifact2, artifact3];
  const reals    = [real1, real2];

  const artifactTablePillboxes = artifacts.filter(t => tablePillboxes.has(t)).length;
  const realTablePillboxes    = reals.filter(t => tablePillboxes.has(t)).length;

  eq('pass1-filter (mix): accessibility artifacts get ZERO table pillboxes',
    artifactTablePillboxes, 0);
  eq('pass1-filter (mix): real tables each get a table pillbox — count equals 2',
    realTablePillboxes, 2);
  eq('pass1-filter (mix): total table pillboxes created equals number of real tables',
    tablePillboxes.has(real1) && tablePillboxes.has(real2) && !tablePillboxes.has(artifact1) &&
    !tablePillboxes.has(artifact2) && !tablePillboxes.has(artifact3), true);

  cleanupPass1Tables(allTables);
})();

// --- pass1-filter: Pass 1 skips artifacts but does NOT skip a non-data real table ---
// (edge: if a real table fails isDataTable, no table pillbox either — confirm the skip
// here is from isDataTable, not from isAccessibilityArtifact)
(function pass1Filter_nonDataRealTable_noTablePillbox() {
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

  // Confirm isAccessibilityArtifact is false (skip is NOT from the artifact guard)
  eq('pass1-filter: non-data real table isAccessibilityArtifact is false (sanity)',
    isAccessibilityArtifact(nonDataTable), false);
  // Confirm isDataTable is false
  eq('pass1-filter: non-data real table isDataTable is false (sanity)',
    isDataTable(nonDataTable), false);

  runPass1WithTables([nonDataTable]);

  eq('pass1-filter: non-data real table gets no table pillbox (isDataTable gate)',
    tablePillboxes.has(nonDataTable), false);

  cleanupPass1Tables([nonDataTable]);
})();

// --- pass1-filter: duplicate Pass 1 call does NOT create a second table pillbox for a real table ---
// (regression guard: tablePillboxes.has check prevents double-insertion)
(function pass1Filter_duplicateRun_noDoubleTablePillbox() {
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
  const afterFirst = tablePillboxes.has(realTable);

  // Second run — table already in tablePillboxes; Pass 1 should skip it.
  // We verify the table pillbox is not re-inserted: since WeakMap.set overwrites,
  // a re-create would swap the button object, so we check its identity holds.
  const buttonAfterFirst = tablePillboxes.get(realTable);
  runPass1WithTables([realTable]);
  const buttonAfterSecond = tablePillboxes.get(realTable);

  eq('pass1-filter: first Pass 1 run creates a table pillbox for the real table',
    afterFirst, true);
  eq('pass1-filter: second Pass 1 run does not replace the existing table pillbox (same object)',
    buttonAfterFirst === buttonAfterSecond, true);

  cleanupPass1Tables([realTable]);
})();

// ---------------------------------------------------------------------------
// GridAdapter._getRowEls handles ARIA grids
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
// A rowgroup picks the row shape, not the row
// set. The rows found inside it determine the winning selector; the row list is
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
      return sel === GRID_CELL_SELECTOR ? cellEls : [];
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

// #513: a row label carrying the row-header role beside cell-role elements
// is a cell, so it counts as column A the way a native table's row header
// does. The grid is the order-summary shape with invented values.
(function gridHeaderRoles_rowHeaderLabelIsColumnA() {
  const g = rwBuildLabelledGrid();
  const rows = makeAdapter(g.table).getRows();
  const texts = rows.map((row) => row.getCells().map((cell) => cell.getText().trim()));
  eq('#513: every body row reads two cells, the label first',
    texts.slice(1).map((row) => row.length), [2, 2, 2, 2, 2]);
  eq('#513: the label column holds the visible labels, tooltip text included under the nested label',
    texts.slice(1).map((row) => row[0]),
    ['Subtotal · 2 items', 'Shipping', 'DutiesShipped from another country.', 'Taxes', 'Total']);
  eq('#513: the amount column holds the amounts',
    texts.slice(1).map((row) => row[1]),
    ['$48.60', '$12.00', '$7.35', '$9.84', 'CAD$77.79']);
  eq('#513: the header row still reads its two column headers',
    texts[0], ['Item', 'Amount']);
})();

// #513: a header row that holds a cell-role corner beside column-header
// elements reads every one of them, in document order.
(function gridHeaderRoles_cornerCellBesideColumnHeaders() {
  const headerRow = rwEl('div', { role: 'row' }, [
    rwEl('div', { role: 'cell' }, [rwText('')]),
    rwEl('div', { role: 'columnheader' }, [rwText('Q1')]),
    rwEl('div', { role: 'columnheader' }, [rwText('Q2')]),
  ]);
  const dataRow = rwEl('div', { role: 'row' }, [
    rwEl('div', { role: 'rowheader' }, [rwText('North')]),
    rwEl('div', { role: 'cell' }, [rwText('1,482,391')]),
    rwEl('div', { role: 'cell' }, [rwText('918,554')]),
  ]);
  const table = rwEl('div', { role: 'grid' }, [headerRow, rwEl('div', { role: 'rowgroup' }, [dataRow])]);
  const rows = makeAdapter(table).getRows();
  eq('#513: the corner cell and both column headers come back as three cells',
    rows[0].getCells().map((cell) => cell.getText()), ['', 'Q1', 'Q2']);
  eq('#513: the data row reads label and two amounts',
    rows[1].getCells().map((cell) => cell.getText()), ['North', '1,482,391', '918,554']);
})();

// #513: an interactive grid tags its values with the grid-cell role. A row
// label with the row-header role beside them reads with every value, and
// the grid still passes the data test.
(function gridHeaderRoles_rowHeaderBesideGridCells() {
  const headerRow = rwEl('div', { role: 'row' }, [
    rwEl('div', { role: 'columnheader' }, [rwText('Region')]),
    rwEl('div', { role: 'columnheader' }, [rwText('Q1')]),
  ]);
  const dataRow = (label, value) => rwEl('div', { role: 'row' }, [
    rwEl('div', { role: 'rowheader' }, [rwText(label)]),
    rwEl('div', { role: 'gridcell' }, [rwText(value)]),
  ]);
  const group = rwEl('div', { role: 'rowgroup' }, [dataRow('North', '1,482,391'), dataRow('South', '918,554')]);
  const table = rwEl('div', { role: 'grid' }, [headerRow, group]);
  const rows = makeAdapter(table).getRows();
  eq('#513 grid cells: each row reads its label and its value',
    rows.map((row) => row.getCells().map((cell) => cell.getText())),
    [['Region', 'Q1'], ['North', '1,482,391'], ['South', '918,554']]);
  eq('#513 grid cells: the grid passes the data test', isDataTable(table), true);
})();

// Detection: the row universe starts at the header row, and a wide header
// of text labels must not exhaust the data-test budget before the scan
// reaches a data row (a six-column sales grid whose data rows lead with four
// text cells keeps its table pillbox).
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
// The data test spends one budget of
// DR_DETECTION_SETTINGS.dataTestCellBudget cell reads, walked in document order and
// stopped at the first number, on native tables and grids alike.
// isDataTable and DR_DETECTION_SETTINGS.dataTestCellBudget live in
// chrome-extension/lib/dr-table/detect.js and chrome-extension/constants.js.
// ---------------------------------------------------------------------------

// AC1: a grid whose first data row leads with eleven text cells before its
// first number. The budget walks every cell in document order, so the
// number still falls inside it.
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

// Goal, native tables: the budget applies to native tables and grids alike,
// so a table whose first number sits far past 1000 cells fails.
(function dataTestBudget_nativeTable_farPastBudgetFails() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const cols = 100;
  const rows = Math.ceil((budget * 3) / cols);
  const totalCells = rows * cols;
  const table = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, totalCells));
  eq('data test: a native table whose only number sits far past the cell budget fails',
    isDataTable(table), false);
})();

// The detection layer and the files it reads, in manifest order:
// constants.js for DR_DETECTION_SETTINGS and the settings contract, the
// number library for the cell read, and the classification ladder and the
// table step, which the data test runs through the rounding pass's per-cell
// read (classifyTableCell) and the column post-pass. Each is framework-free,
// so the sandboxes below carry no browser dependency.
const detectionSandboxCode = [
  constantsCode, coreCode, parsingCode, sourceByName('lib/dr-number/identifiers.js'),
  detectCode, ladderCode, sourceByName('lib/dr-simplify/table.js'),
].join('\n');

// jsdom-less criterion: detect.js is evaluated with the files it reads —
// constants.js, the number library, and the classification ladder — and
// nothing else, in a vm context with no
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
      { cells: [withTextPiece({ textContent: 'Name' }), withTextPiece({ textContent: '100' })] },
      { cells: [withTextPiece({ textContent: 'Foo' }),  withTextPiece({ textContent: '200' })] },
    ],
  };
  const fakeDoc = {
    querySelectorAll(sel) {
      if (sel === 'table') return [fakeTable];
      return [];
    },
  };

  // The sandbox carries ONLY fakeDoc/fakeTable and whatever the files in
  // detectionSandboxCode declare — no window, no getComputedStyle, no
  // chrome, no document global.
  const sandbox = { fakeDoc, fakeTable, results: null, threw: null };
  const ctx = vm.createContext(sandbox);

  vm.runInContext(
    detectionSandboxCode + `
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

// The detection settings' expected values, written out as literals, so the
// pin catches a change to any value. Key order matches constants.js's DR_DETECTION_SETTINGS
// declaration, so the JSON.stringify-based eq() comparison below is not
// order-sensitive noise.
const PRE_MOVE_DETECTION_SETTINGS = {
  nestingDepth: 1,
  gridMinChildren: 5,
  gridWalkDepthCap: 15,
  gridSampleSize: 10,
  gridAlignmentAgreement: 0.8,
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
  settleDelayMs: 100,
  reapplyMaxWaitMs: 1000,
  reapplyCellCap: 10000,
  passTargetMs: 200,
  pendingRetestCap: 100,
  offscreenLeftPx: -9999,
};

// jsdom-less criterion, extended: one vm sandbox with no
// chrome/window/getComputedStyle evaluates the detection layer and the
// files it reads (detectionSandboxCode above). The test pins DR_DETECTION_SETTINGS's values against PRE_MOVE_DETECTION_SETTINGS above and runs
// looksLikeGrid, findTargetTable, isAccessibilityArtifact, and isDataTable against
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
    detectionSandboxCode + `
    try {
      outcomes.settingsKeys = Object.keys(DR_DETECTION_SETTINGS).sort();
      outcomes.settings = DR_DETECTION_SETTINGS;

      function makeCell(text, width) { return { textContent: text, offsetWidth: width, childNodes: [{ nodeType: 3, nodeValue: text }] }; }
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

      // --- gridRepetitionShare (the consistent-cell-count step): a share below the 0.5 floor
      // fails (3-of-8 sharing a child count); a share
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

      // --- gridSampleSize + gridAlignmentAgreement (alignment step): the
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

      // --- offscreenLeftPx (isAccessibilityArtifact signal 2): at the threshold
      // and beyond it counts as off-screen; just inside it does not ---
      const offscreenProbe = { styleProbe: { getComputedStyle: (el) => el.style } };
      const offscreenTable = (left) => ({ getAttribute: () => null, style: { position: 'static', left: left + 'px' } });
      outcomes.offscreenAtThresholdIsArtifact = isAccessibilityArtifact(offscreenTable(-9999), offscreenProbe);
      outcomes.offscreenBeyondThresholdIsArtifact = isAccessibilityArtifact(offscreenTable(-10000), offscreenProbe);
      outcomes.offscreenInsideThresholdIsNotArtifact = isAccessibilityArtifact(offscreenTable(-9998), offscreenProbe);

      // --- isDataTable: no collateral breakage from the load-order change ---
      outcomes.isDataTableStillFindsANumericTable = isDataTable({
        tagName: 'TABLE',
        rows: [
          { cells: [makeCell('Name'), makeCell('100')] },
          { cells: [makeCell('Foo'),  makeCell('200')] },
        ],
      });
    } catch (e) {
      threw = e.message;
    }
    `,
    ctx
  );

  eq('detection settings: the combined sandbox does not throw', sandbox.threw, null);
  eq('detection settings: DR_DETECTION_SETTINGS exposes exactly fifteen keys, the nine pre-move keys plus nestingDepth, dataTestCellBudget, pendingRetestCap, reapplyMaxWaitMs, reapplyCellCap, and passTargetMs',
    sandbox.outcomes.settingsKeys, Object.keys(PRE_MOVE_DETECTION_SETTINGS).sort());
  eq('detection settings: DR_DETECTION_SETTINGS carries every pre-move value unchanged, plus nestingDepth at 1, dataTestCellBudget at 1000, pendingRetestCap at 100, reapplyMaxWaitMs at 1000, reapplyCellCap at 10000, and passTargetMs at 200',
    sandbox.outcomes.settings, PRE_MOVE_DETECTION_SETTINGS);
  eq('detection settings: looksLikeGrid rejects 4 children (below gridMinChildren)',
    sandbox.outcomes.minChildrenBelowFails, false);
  eq('detection settings: looksLikeGrid accepts 5 children (at gridMinChildren)',
    sandbox.outcomes.minChildrenAtPasses, true);
  eq('detection settings: looksLikeGrid rejects a 3-of-8 share (below gridRepetitionShare)',
    sandbox.outcomes.repetitionBelowFloorFails, false);
  eq('detection settings: looksLikeGrid accepts a 5-of-10 share (at gridRepetitionShare)',
    sandbox.outcomes.repetitionAtFloorPasses, true);
  eq('detection settings: looksLikeGrid accepts an 8-of-10 sampled-width agreement (at gridAlignmentAgreement, within gridSampleSize)',
    sandbox.outcomes.widthAgreementAtThresholdPasses, true);
  eq('detection settings: looksLikeGrid rejects a 7-of-10 sampled-width agreement (below gridAlignmentAgreement)',
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
  eq('detection settings: isAccessibilityArtifact treats offscreenLeftPx itself as off-screen',
    sandbox.outcomes.offscreenAtThresholdIsArtifact, true);
  eq('detection settings: isAccessibilityArtifact treats a value beyond offscreenLeftPx as off-screen',
    sandbox.outcomes.offscreenBeyondThresholdIsArtifact, true);
  eq('detection settings: isAccessibilityArtifact treats a value inside offscreenLeftPx as on-screen',
    sandbox.outcomes.offscreenInsideThresholdIsNotArtifact, false);
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

// findTables' isArtifact: default (isAccessibilityArtifact) drops an accessibility
// artifact; a pass-through filter keeps it. reuses makePass1DataTable / the
// aria-hidden artifact shape from the pass1-filter suite above.
(function findTables_tableFilterDefaultVsPassThrough() {
  const artifactTable = makePass1DataTable();
  const hiddenParent = {
    tagName: 'DIV',
    getAttribute: (name) => (name === 'aria-hidden' ? 'true' : null),
    style: {},
    parentElement: null,
    parentNode: null,
  };
  artifactTable.parentElement = hiddenParent;
  artifactTable.parentNode = null;

  const root = {
    tagName: 'BODY',
    querySelectorAll(sel) {
      return sel === 'table' ? [artifactTable] : [];
    },
  };

  eq('findTables: sanity — the fixture is both a valid data table and an accessibility artifact',
    isDataTable(artifactTable) && isAccessibilityArtifact(artifactTable), true);
  eq('findTables: default isArtifact (isAccessibilityArtifact) drops an accessibility artifact',
    findTables(root).length, 0);
  eq('findTables: a pass-through isArtifact keeps the accessibility artifact',
    findTables(root, { isArtifact: () => false }).length, 1);
})();

// =============================================================================
// One registration per grid, at the configured depth
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

(function gridNesting_AC6_loadTimeScanBuildsOneTablePillbox() {
  const grid = makeDatabaseQueryGrid();
  const before = DR_MODEL.getRegisteredTables().length;

  withTablePillboxDocumentMock(function () {
    // What a page holding the fixture hands the two passes: no native table,
    // and the three role-bearing elements in document order.
    global.document.querySelectorAll = function (sel) {
      if (sel === 'table') return [];
      if (sel === GRID_ARIA_SELECTOR_TEXT) {
        return [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl];
      }
      return [];
    };
    injectTablePillboxes();
  });

  const added = DR_MODEL.getRegisteredTables().slice(before);
  eq('nesting AC6: the load-time scan on the fixture adds one registry entry', added.length, 1);
  eq('nesting AC6: the registered element is the scrolling pane',
    added.length === 1 && added[0] === grid.scrollPaneEl, true);
  eq('nesting AC6: the scrolling pane carries one table pillbox',
    tablePillboxes.has(grid.scrollPaneEl), true);
  eq('nesting AC6: the wrapper carries no table pillbox', tablePillboxes.has(grid.wrapperEl), false);
  eq('nesting AC6: the pinned pane carries no table pillbox', tablePillboxes.has(grid.pinnedPaneEl), false);

  forgetRegisteredTable(grid.scrollPaneEl);
})();

(function gridNesting_AC6_addedNodePassBuildsOneTablePillbox() {
  const grid = makeDatabaseQueryGrid();
  const before = DR_MODEL.getRegisteredTables().length;

  withTablePillboxDocumentMock(function () {
    injectTablePillboxesForAddedNode(grid.wrapperEl);
  });

  const added = DR_MODEL.getRegisteredTables().slice(before);
  eq('nesting AC6: the added-node pass on the fixture adds one registry entry', added.length, 1);
  eq('nesting AC6: the added-node pass registers the scrolling pane',
    added.length === 1 && added[0] === grid.scrollPaneEl, true);
  eq('nesting AC6: the added-node pass puts one table pillbox on the scrolling pane',
    tablePillboxes.has(grid.scrollPaneEl), true);
  eq('nesting AC6: the added-node pass puts no table pillbox on the wrapper',
    tablePillboxes.has(grid.wrapperEl), false);
  eq('nesting AC6: the added-node pass puts no table pillbox on the pinned pane',
    tablePillboxes.has(grid.pinnedPaneEl), false);

  // A node added inside a nest that already holds a registered element adds
  // no second registration.
  const beforeRediscovery = DR_MODEL.getRegisteredTables().length;
  withTablePillboxDocumentMock(function () {
    injectTablePillboxesForAddedNode(grid.scrollPaneEl);
  });
  eq('nesting AC6: a node added inside a registered nest adds no registry entry',
    DR_MODEL.getRegisteredTables().length, beforeRediscovery);

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- Adversarial: a rediscovery reports nothing for a registered nest ---

(function gridNesting_rediscoveryIsIdempotent() {
  const grid = makeDatabaseQueryGrid();
  eq('nesting: a nest whose scrolling pane is registered reports nothing',
    findTables(grid.wrapperEl, { isRegistered: (el) => el === grid.scrollPaneEl }).length, 0);
  eq('nesting: a nest whose wrapper is registered reports nothing',
    findTables(grid.wrapperEl, { isRegistered: (el) => el === grid.wrapperEl }).length, 0);
  eq('nesting: a nest whose pinned pane is registered reports nothing',
    findTables(grid.wrapperEl, { isRegistered: (el) => el === grid.pinnedPaneEl }).length, 0);
  eq('nesting: a nest holding no registered element still reports the scrolling pane',
    findTables(grid.wrapperEl, { isRegistered: () => false }).map((r) => r.handle === grid.scrollPaneEl),
    [true]);
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
    isAccessibilityArtifact(nativeTable), false);
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
  const before = DR_MODEL.getRegisteredTables().length;

  findTables(makeNestingHost([grid.wrapperEl]));

  eq('nesting: the nomination step adds no registry entry',
    DR_MODEL.getRegisteredTables().length, before);
  eq('nesting: the nomination step registers no element of the nest',
    nestElements.map((el) => DR_MODEL.hasTable(el)), [false, false, false]);
  eq('nesting: the nomination step writes no grid marker class',
    nestElements.map((el) => el.classList.contains('dr-ext-grid')), [false, false, false]);
})();

// =============================================================================
// The shape fingerprint: the reader, the comparison, and the chain-root walk
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

// The three native-table forms. A native table's adapter carries no
// outside-row mark, so the head section is read from the row.
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

// The header-row test is one rule on both kinds: the first row sits in the head
// section or outside every row group, or it holds header cells alone and the
// table groups its rows. A native table always groups its rows. A grid with no
// row group keeps the column count alone, because a virtualized grid can
// scroll its first row away.
(function shapeFingerprint_aFirstRowOfHeaderCellsAloneCarriesHeaderTextsOnATableThatGroupsItsRows() {
  const headerRow = (header, texts) => texts.map((pieces) => ({ pieces, header }));
  const draw = (kind, grouped, firstRow) => rwDrawTable(kind, [
    { part: grouped ? 'body' : 'bare', grouped, rows: [firstRow, ['North', '1,482,391'], ['South', '918,554']] },
  ]).table;
  for (const kind of ['native', 'grid']) {
    for (const grouped of [false, true]) {
      const groups = kind === 'native' || grouped;
      const label = `${kind}, ${grouped ? 'with' : 'no'} row group`;
      for (const header of ['col', 'row']) {
        eq(`header row (${label}, ${header} header cells): a first row of header cells alone ${groups ? 'carries the header texts' : 'carries the column count alone'}`,
          readTableFingerprint(draw(kind, grouped, headerRow(header, ['Region', 'Q1']))),
          { columnCount: 2, headerTexts: groups ? ['Region', 'Q1'] : null });
        eq(`header row (${label}, ${header} header cells): new header texts at the same column count compare ${groups ? 'different' : 'the same'}`,
          sameTableFingerprint(
            readTableFingerprint(draw(kind, grouped, headerRow(header, ['Region', 'Q1']))),
            readTableFingerprint(draw(kind, grouped, headerRow(header, ['Region', 'Q2'])))), !groups);
      }
      eq(`header row (${label}): a first row holding a data cell beside a header cell carries the column count alone`,
        readTableFingerprint(draw(kind, grouped, [{ pieces: 'Region', header: 'col' }, 'Q1'])),
        { columnCount: 2, headerTexts: null });
      eq(`header row (${label}): a first row of data cells carries the column count alone`,
        readTableFingerprint(draw(kind, grouped, ['Region', 'Q1'])),
        { columnCount: 2, headerTexts: null });
      eq(`header row (${label}): new data texts in the first row at the same column count compare the same`,
        sameTableFingerprint(
          readTableFingerprint(draw(kind, grouped, ['Region', 'Q1'])),
          readTableFingerprint(draw(kind, grouped, ['Area', 'Q2']))), true);
    }
  }
})();

// A native table whose header cells sit in a head section or in the body reads
// header texts; one data cell in the first row reads the column count alone.
(function shapeFingerprint_aNativeTablesThreeHeaderRowFormsReadThroughOneTest() {
  const cols = (texts) => texts.map((pieces) => ({ pieces, header: 'col' }));
  const body = { part: 'body', rows: [['North', '1,482,391']], grouped: true };
  eq('header row native: a first row in a head section carries the header texts',
    readTableFingerprint(rwDrawTable('native', [{ part: 'head', rows: [cols(['Region', 'Q1'])] }, body]).table),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  eq('header row native: a first row of header cells alone in a body section carries the header texts',
    readTableFingerprint(rwDrawTable('native', [{ part: 'body', rows: [cols(['Region', 'Q1']), ['North', '1,482,391']] }]).table),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  eq('header row native: a first row in a body section holding a data cell carries the column count alone',
    readTableFingerprint(rwDrawTable('native', [{ part: 'body', rows: [[{ pieces: 'Region', header: 'col' }, 'Q1'], ['North', '1,482,391']] }]).table),
    { columnCount: 2, headerTexts: null });
})();

// A cell with a colspan numbers the columns after it the same way on a native
// table and on a grid of bare <tr> and <td> elements with no table element.
(function columnPlacement_aGridOfBareRowsAndCellsNumbersItsColumnsLikeTheNativeTable() {
  const shapes = [
    { name: 'a colspan across two columns', rows: [
      [{ text: 'Both', colSpan: 2 }, { text: 'C' }],
      [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
    ], expected: [[[0, 2], [2, 1]], [[0, 1], [1, 1], [2, 1]]] },
    { name: 'a rowspan down two rows', rows: [
      [{ text: 'A', rowSpan: 2 }, { text: 'B' }],
      [{ text: 'C' }],
    ], expected: [[[0, 1], [1, 1]], [[1, 1]]] },
    { name: 'a colspan of three beside a data cell', rows: [
      [{ text: 'Wide', tag: 'th', colSpan: 3 }, { text: '1,482,391' }],
      [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
    ], expected: [[[0, 3], [3, 1]], [[0, 1], [1, 1], [2, 1], [3, 1]]] },
  ];
  for (const { name, rows, expected } of shapes) {
    const native = readColumnPlacement(drawBareMarkupTable('native', rows));
    const grid = readColumnPlacement(drawBareMarkupTable('grid', rows));
    eq(`column placement, ${name}: the native table numbers the columns by the span`, native, expected);
    eq(`column placement, ${name}: the grid of bare rows and cells numbers the columns as the native table does`,
      grid, native);
  }
})();

// One span reader: the element's span property first, then the accessibility
// attribute. A grid cell of generic elements holds no property.
(function columnPlacement_aCellsSpanReadsTheHtmlAttributeThenTheAccessibilityAttribute() {
  const cellOf = (props, attrs) => {
    const el = rwEl('div', attrs, [rwText('x')]);
    Object.assign(el, props);
    el.hasAttribute = (name) => el.getAttribute(name) !== null;
    return el;
  };
  const rowOf = (cellEls) => rwEl('div', { role: 'row' }, cellEls);
  const placementOf = (rowEls) => readColumnPlacement(rwEl('div', { role: 'grid' }, rowEls));

  eq('span reader: a cell holding the colSpan property and aria-colspan reads the property',
    placementOf([rowOf([cellOf({ colSpan: 3 }, { colspan: '3', 'aria-colspan': '2' }), cellOf({}, {})])])[0],
    [[0, 3], [3, 1]]);
  eq('span reader: a td whose colSpan property is 1 with no colspan attribute reads aria-colspan',
    placementOf([rowOf([cellOf({ colSpan: 1 }, { 'aria-colspan': '2' }), cellOf({}, {})])])[0],
    [[0, 2], [2, 1]]);
  eq('span reader: a cell holding the aria-colspan attribute alone reads the attribute',
    placementOf([rowOf([cellOf({}, { 'aria-colspan': '2' }), cellOf({}, {})])])[0],
    [[0, 2], [2, 1]]);
  eq('span reader: a cell holding neither spans one column',
    placementOf([rowOf([cellOf({}, {}), cellOf({}, {})])])[0],
    [[0, 1], [1, 1]]);

  // A rowSpan reaches the next row as a held column.
  const downFrom = (props, attrs) => placementOf([
    rowOf([cellOf(props, attrs), cellOf({}, {})]),
    rowOf([cellOf({}, {})]),
  ])[1];
  eq('span reader: a cell holding the rowSpan property and aria-rowspan reads the property',
    downFrom({ rowSpan: 2 }, { rowspan: '2', 'aria-rowspan': '1' }), [[1, 1]]);
  eq('span reader: a td whose rowSpan property is 1 with no rowspan attribute reads aria-rowspan',
    downFrom({ rowSpan: 1 }, { 'aria-rowspan': '2' }), [[1, 1]]);
  eq('span reader: a cell holding the aria-rowspan attribute alone reads the attribute',
    downFrom({}, { 'aria-rowspan': '2' }), [[1, 1]]);
  eq('span reader: a cell holding neither leaves the next row at the first column',
    downFrom({}, {}), [[0, 1]]);
})();

// Every row joins the dataset, and the shape fingerprint still reads a
// grid's header row from the outside-row mark. One drawing per kind: a header
// row in a head section (a grid draws it outside every row group), body rows
// in a body section (a grid draws them in a row group), and a total row in a
// footer section (a grid draws it after the row group, outside it). A total
// row outside every group carries the same mark as the header row, so the
// reading takes the first row alone. Invented values.
(function shapeFingerprint_theHeaderRowReadHoldsWithEveryRowInTheDataset() {
  const draw = (kind, withHead) => rwDrawTable(kind, (withHead
    ? [{ part: 'head', rows: [[{ pieces: 'Region', header: 'col' }, { pieces: 'Q1', header: 'col' }]] }]
    : []).concat([
    { part: 'body', rows: [['North', '1,482,391'], ['South', '918,554']], grouped: true },
    { part: 'foot', rows: [['Total', '2,400,945']] },
  ])).table;
  for (const kind of ['native', 'grid']) {
    eq(`fingerprint reader (${kind}): a table with a header row, grouped body rows, and a total row carries the header row's texts`,
      readTableFingerprint(draw(kind, true)), { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  }
  for (const kind of ['native', 'grid']) {
    eq(`fingerprint reader (${kind}): a table whose first row is a body row and whose total row is last carries no header texts`,
      readTableFingerprint(draw(kind, false)), { columnCount: 2, headerTexts: null });
  }
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
  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  eq('fingerprint chain root: a plain layer inside the wrapper leaves the chain root the wrapper',
    chainRootOf(plain.scrollPaneEl) === plain.wrapperEl, true);

  eq('fingerprint chain root: an element in no nest has none',
    chainRootOf(makeNestingHost([])) === null, true);
})();

// =============================================================================
// Pending tables: the nomination step returns one nest at a time
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
  const result = nominateNest(grid.wrapperEl, { isRegistered: (el) => el === grid.scrollPaneEl });

  eq('nomination: a nest holding a seen element reports the registered outcome',
    result.outcome, 'registered');
  eq('nomination: the registered outcome selects nothing', result.selected, null);
  eq('nomination: the registered outcome reports a chain size of zero', result.chainSize, 0);
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

// =============================================================================
// A cell bounds a nest
// Spec: docs/sprint-plans/grid-reading-gaps.md §3.2 and the grid-in-cell-nest
// block in §5; issue #527.
// =============================================================================
//
// The rule these assertions pin, in the specification's words:
//   - A walk upward from a qualifying element ends at the first element
//     carrying a cell role, so a grid inside a cell is its own chain root.
//   - The nest's membership test uses the same stop, so a grid inside a cell
//     never counts as a member of the outer grid's nest, and the outer nest's
//     already-registered check never reads the inner grid.
//   - A vendor grid's panes sit outside any cell, so the nesting depth still
//     picks the scrolling pane there.
//   - A right-click inside the inner grid resolves the inner grid, and a
//     right-click in another cell of the outer grid resolves the outer grid.
//   - Each grid reads its own rows and cells and leaves out the other's.
//
// Every expected value below comes from that statement, never from the
// detection layer's source. Invented values.

// The inner table: two body rows of a label beside a number.
const CN_INNER = {
  sections: [{ part: 'body', rows: [['Q1', '1,234'], ['Q2', '3,587']], grouped: true }],
};

// A table whose first body row's last cell holds `nested`, drawn in the
// pair's grid form unless `kind` names the native form.
function cnSections(nested) {
  return [
    { part: 'head', rows: [[
      { pieces: 'Region', header: 'col' }, { pieces: '2023', header: 'col' },
      { pieces: 'By quarter', header: 'col' },
    ]] },
    { part: 'body', rows: [
      ['North', '4,821', { pieces: [], nested }],
      ['South', '2,734', ''],
    ], grouped: true },
  ];
}

// A host holding one outer grid with a grid inside one of its cells. The
// outer grid carries `outerRole`, the inner grid `innerRole`.
function cnGridInCell(outerRole, innerRole) {
  const inner = Object.assign({}, CN_INNER, { opts: { gridRole: innerRole || 'grid' } });
  const outer = rwDrawTable('grid', cnSections(inner), { gridRole: outerRole || 'grid' }).table;
  const host = rwEl('div', {}, [outer]);
  const innerEl = outer.querySelectorAll(GRID_ARIA_SELECTOR_TEXT)[0];
  const rowsOf = (gridEl) => dgDescendantsMatching(gridEl, '[role="row"]');
  return {
    host, outer, inner: innerEl,
    // The outer grid's North row cell holding the inner grid, its South row
    // number cell, and the inner grid's second-row number cell.
    holdingCell: rowsOf(outer)[1].children[2],
    outerSouthCell: rowsOf(outer).filter((row) => !innerEl.contains(row))[2].children[1],
    innerCell: rowsOf(innerEl)[1].children[1],
  };
}

// The texts of every cell a table reads through its adapter, row by row.
function cnAdapterTexts(tableEl) {
  return makeAdapter(tableEl).getRows().map((row) => row.getCells().map((cell) => cell.getText()));
}

// The cell elements a table reads through its adapter.
function cnAdapterCellEls(tableEl) {
  return makeAdapter(tableEl).getRows().flatMap((row) => row.getCells().map((cell) => cell.el));
}

// --- Detection: both grids register ---

(function cellNest_aGridInsideACellRegistersBesideTheGridAroundIt() {
  const page = cnGridInCell();

  eq('cell nest: the fixture puts the inner grid inside a cell of the outer grid (sanity)',
    page.inner.parentElement === page.holdingCell && page.holdingCell.getAttribute('role') === 'cell', true);
  eq('cell nest: both grids pass the data test (sanity)',
    [isDataTable(page.outer), isDataTable(page.inner)], [true, true]);

  const handles = findTables(page.host).map((r) => r.handle);
  eq('cell nest: a page holding a grid inside a cell of another grid reports two tables',
    handles.length, 2);
  eq('cell nest: the two tables are the outer grid and the inner grid, in document order',
    handles.length === 2 && handles[0] === page.outer && handles[1] === page.inner, true);

  eq('cell nest: the inner grid is its own chain root',
    chainRootOf(page.inner) === page.inner, true);
  eq('cell nest: a cell of the inner grid sits in the inner grid\'s nest',
    chainRootOf(page.innerCell) === page.inner, true);
  eq('cell nest: a cell of the outer grid sits in the outer grid\'s nest',
    chainRootOf(page.outerSouthCell) === page.outer, true);

  const outerResult = nominateNest(page.outer);
  eq('cell nest: the outer nest selects the outer grid', outerResult.selected === page.outer, true);
  eq('cell nest: the outer nest\'s chain holds the outer grid alone', outerResult.chainSize, 1);
  const innerResult = nominateNest(page.inner);
  eq('cell nest: the inner nest selects the inner grid', innerResult.selected === page.inner, true);
  eq('cell nest: the inner nest\'s chain holds the inner grid alone', innerResult.chainSize, 1);

  const results = nominateNests(page.host);
  eq('cell nest: the nomination step reports one result per grid',
    results.map((r) => [r.chainRoot === page.outer || r.chainRoot === page.inner, r.outcome]),
    [[true, 'selected'], [true, 'selected']]);
})();

// --- Right-click: each grid resolves itself ---

(function cellNest_aRightClickResolvesTheGridItLandsIn() {
  const page = cnGridInCell();
  const fresh = { isRegistered: () => false };

  const inInner = findTargetTable(page.innerCell, fresh);
  eq('cell nest: a right-click inside the inner grid resolves the inner grid',
    inInner !== null && inInner.handle === page.inner, true);
  eq('cell nest: that resolution reports isNew', inInner !== null && inInner.isNew, true);

  const inOuter = findTargetTable(page.outerSouthCell, fresh);
  eq('cell nest: a right-click in another cell of the outer grid resolves the outer grid',
    inOuter !== null && inOuter.handle === page.outer, true);

  const onHoldingCell = findTargetTable(page.holdingCell, fresh);
  eq('cell nest: a right-click on the cell holding the inner grid, outside the inner grid, resolves the outer grid',
    onHoldingCell !== null && onHoldingCell.handle === page.outer, true);

  const registered = new Set([page.outer, page.inner]);
  const both = { isRegistered: (el) => registered.has(el) };
  const inInnerRegistered = findTargetTable(page.innerCell, both);
  eq('cell nest: with both grids registered, a right-click inside the inner grid resolves the inner grid',
    inInnerRegistered !== null && inInnerRegistered.handle === page.inner && !inInnerRegistered.isNew, true);
  const inOuterRegistered = findTargetTable(page.outerSouthCell, both);
  eq('cell nest: with both grids registered, a right-click in another cell of the outer grid resolves the outer grid',
    inOuterRegistered !== null && inOuterRegistered.handle === page.outer && !inOuterRegistered.isNew, true);
})();

// --- A second run registers nothing new ---
//
// The nest's already-registered check reads only the nest's own members. A
// check that read every qualifying element under the chain root would find a
// registered inner grid and leave the outer grid unregistered.

(function cellNest_aSecondRunRegistersNothingNew() {
  const page = cnGridInCell();

  const both = new Set([page.outer, page.inner]);
  eq('cell nest: with both grids registered, every nest reports the registered outcome',
    nominateNests(page.host, { isRegistered: (el) => both.has(el) }).map((r) => r.outcome),
    ['registered', 'registered']);
  eq('cell nest: with both grids registered, a second run reports no table',
    findTables(page.host, { isRegistered: (el) => both.has(el) }).length, 0);

  const innerOnly = findTables(page.host, { isRegistered: (el) => el === page.inner });
  eq('cell nest: a registered inner grid leaves the outer grid to register',
    innerOnly.map((r) => r.handle === page.outer), [true]);
  const outerOnly = findTables(page.host, { isRegistered: (el) => el === page.outer });
  eq('cell nest: a registered outer grid leaves the inner grid to register',
    outerOnly.map((r) => r.handle === page.inner), [true]);
})();

(function cellNest_theLoadTimeScanRegistersBothGridsOnce() {
  const page = cnGridInCell();
  const before = DR_MODEL.getRegisteredTables().length;
  const runScan = () => withTablePillboxDocumentMock(function () {
    global.document.querySelectorAll = function (sel) {
      if (sel === GRID_ARIA_SELECTOR_TEXT) return page.host.querySelectorAll(sel);
      return [];
    };
    injectTablePillboxes();
  });

  try {
    runScan();
    const added = DR_MODEL.getRegisteredTables().slice(before);
    eq('cell nest: the load-time scan adds two registry entries', added.length, 2);
    eq('cell nest: the load-time scan registers the outer grid and the inner grid',
      [added.includes(page.outer), added.includes(page.inner)], [true, true]);
    eq('cell nest: each grid carries a table pillbox',
      [tablePillboxes.has(page.outer), tablePillboxes.has(page.inner)], [true, true]);

    const afterFirst = DR_MODEL.getRegisteredTables().length;
    runScan();
    eq('cell nest: a second load-time scan adds no registry entry',
      DR_MODEL.getRegisteredTables().length, afterFirst);
  } finally {
    forgetRegisteredTable(page.outer);
    forgetRegisteredTable(page.inner);
  }
})();

// --- The database query shape: the depth rule holds outside cells ---

(function cellNest_theDatabaseQueryShapeInsideACellStillRegistersItsScrollingPane() {
  const grid = makeDatabaseQueryGrid();
  const outer = rwDrawTable('grid', [
    { part: 'body', rows: [['North', '4,821', ''], ['South', '2,734', '6,051']], grouped: true },
  ]).table;
  const holdingCell = dgDescendantsMatching(outer, '[role="row"]')[0].children[2];
  rwSetChildren(holdingCell, [grid.wrapperEl]);
  const host = rwEl('div', {}, [outer]);

  const handles = findTables(host).map((r) => r.handle);
  eq('cell nest: an outer grid holding the database query shape in a cell reports two tables',
    handles.length, 2);
  eq('cell nest: the outer grid registers',
    handles.includes(outer), true);
  eq('cell nest: the database query shape inside the cell registers its scrolling pane',
    handles.includes(grid.scrollPaneEl), true);
  eq('cell nest: neither the wrapper nor the pinned pane registers',
    handles.includes(grid.wrapperEl) || handles.includes(grid.pinnedPaneEl), false);
  eq('cell nest: a right-click in the scrolling pane resolves the scrolling pane',
    findTargetTable(grid.scrollRowEls[1].children[1], { isRegistered: () => false }).handle === grid.scrollPaneEl,
    true);
})();

// A cell role on an ancestor of the chain root, with no grid around it, ends
// the walk above the nest and leaves the nest as it is.
(function cellNest_aCellRoleAboveTheChainRootLeavesTheNestAsItIs() {
  const grid = makeDatabaseQueryGrid();
  const strayCell = rwEl('div', { role: 'cell' }, [grid.wrapperEl]);
  rwEl('div', {}, [strayCell]);

  eq('cell nest: a cell role above the wrapper leaves the wrapper the chain root',
    chainRootOf(grid.scrollRowEls[0].children[0]) === grid.wrapperEl, true);
  eq('cell nest: a cell role above the wrapper still selects the scrolling pane at the configured depth',
    findTables(strayCell).map((r) => r.handle === grid.scrollPaneEl), [true]);
  const result = nominateNest(grid.wrapperEl);
  eq('cell nest: the nest still holds the wrapper and the scrolling pane in its chain',
    [result.outcome, result.chainSize], ['selected', 2]);
  eq('cell nest: depth 0 still selects the wrapper',
    findTables(strayCell, { nestingDepth: 0 }).map((r) => r.handle === grid.wrapperEl), [true]);

  const lone = makeLoneGrid();
  rwEl('div', { role: 'gridcell' }, [lone]);
  eq('cell nest: a lone grid under a grid-cell role is its own chain root',
    chainRootOf(lone.children[0].children[0]) === lone, true);
})();

// --- Three levels of nesting ---

(function cellNest_threeLevelsRegisterThreeTables() {
  const innermostSpec = Object.assign({}, CN_INNER);
  const middleSpec = {
    sections: [{ part: 'body', rows: [
      ['Q1', '1,234', { pieces: [], nested: innermostSpec }],
      ['Q2', '3,587', '9,016'],
    ], grouped: true }],
  };
  const outer = rwDrawTable('grid', cnSections(middleSpec)).table;
  const host = rwEl('div', {}, [outer]);
  const [middle, innermost] = outer.querySelectorAll(GRID_ARIA_SELECTOR_TEXT);
  const rowsOf = (gridEl) => dgDescendantsMatching(gridEl, '[role="row"]');
  const ownRows = (gridEl, nestedEl) => rowsOf(gridEl).filter((row) => !nestedEl || !nestedEl.contains(row));

  eq('cell nest: the fixture nests three grids, each inside a cell of the one around it (sanity)',
    [middle.parentElement.getAttribute('role'), innermost.parentElement.getAttribute('role')], ['cell', 'cell']);

  const handles = findTables(host).map((r) => r.handle);
  eq('cell nest: three nested grids report three tables', handles.length, 3);
  eq('cell nest: the three tables are the three grids, outermost first',
    handles.length === 3 && handles[0] === outer && handles[1] === middle && handles[2] === innermost, true);

  const fresh = { isRegistered: () => false };
  eq('cell nest: a right-click in the innermost grid resolves the innermost grid',
    findTargetTable(rowsOf(innermost)[0].children[1], fresh).handle === innermost, true);
  eq('cell nest: a right-click in another cell of the middle grid resolves the middle grid',
    findTargetTable(ownRows(middle, innermost)[1].children[2], fresh).handle === middle, true);
  eq('cell nest: a right-click in another cell of the outer grid resolves the outer grid',
    findTargetTable(ownRows(outer, middle)[2].children[1], fresh).handle === outer, true);

  eq('cell nest: the outer grid reads its own three rows',
    cnAdapterTexts(outer).map((row) => row.slice(0, 2)), [['Region', '2023'], ['North', '4,821'], ['South', '2,734']]);
  eq('cell nest: the middle grid reads its own two rows',
    cnAdapterTexts(middle).map((row) => row.slice(0, 2)), [['Q1', '1,234'], ['Q2', '3,587']]);
  eq('cell nest: the innermost grid reads its own two rows',
    cnAdapterTexts(innermost), [['Q1', '1,234'], ['Q2', '3,587']]);
  eq('cell nest: no cell the outer grid reads sits inside the middle grid',
    cnAdapterCellEls(outer).some((el) => middle.contains(el)), false);
  eq('cell nest: no cell the middle grid reads sits inside the innermost grid',
    cnAdapterCellEls(middle).some((el) => innermost.contains(el)), false);

  const all = new Set([outer, middle, innermost]);
  eq('cell nest: with all three grids registered, a second run reports no table',
    findTables(host, { isRegistered: (el) => all.has(el) }).length, 0);
})();

// --- A grid inside a cell of a native table ---
//
// A native cell carries no cell role, so the walk up from the grid passes
// through it and the grid stays its own chain root. Both tables register.
// The right-click route for this shape stays out: its first step returns the
// nearest native table, and the plan leaves the mixed-kind case open.

(function cellNest_aGridInsideANativeCellRegistersBesideTheNativeTable() {
  const nativeTable = rwDrawTable('native', cnSections(undefined)).table;
  const grid = rwDrawTable('grid', CN_INNER.sections).table;
  const holdingCell = nativeTable.rows[1].cells[2];
  rwSetChildren(holdingCell, [grid]);
  const host = rwEl('div', {}, [nativeTable]);

  const handles = findTables(host).map((r) => r.handle);
  eq('cell nest: a native table holding a grid in a cell reports two tables', handles.length, 2);
  eq('cell nest: the native table reports first and the grid second',
    handles.length === 2 && handles[0] === nativeTable && handles[1] === grid, true);
  eq('cell nest: the grid inside the native cell is its own chain root',
    chainRootOf(grid) === grid, true);
  eq('cell nest: the native table reads its own three rows',
    cnAdapterTexts(nativeTable).map((row) => row.slice(0, 2)),
    [['Region', '2023'], ['North', '4,821'], ['South', '2,734']]);
  eq('cell nest: the grid inside the native cell reads its own two rows',
    cnAdapterTexts(grid), [['Q1', '1,234'], ['Q2', '3,587']]);
})();

// =============================================================================
// The grid adapter reads its own rows and cells
// =============================================================================
//
// A grid's rows, row groups, cells, and scrolling pane are its own when no
// element carrying a cell role sits between them and the grid. Whatever sits
// inside one of the grid's cells belongs to the table nested there.

(function cellNest_theOuterGridReadsOnlyItsOwnCells() {
  for (const [outerRole, innerRole] of [['grid', 'grid'], ['table', 'table'], ['table', 'grid']]) {
    const page = cnGridInCell(outerRole, innerRole);
    const label = `an outer ${outerRole} role holding an inner ${innerRole} role`;

    eq(`cell nest adapter, ${label}: the outer grid reads its three own rows`,
      cnAdapterTexts(page.outer).length, 3);
    eq(`cell nest adapter, ${label}: the outer grid reads its own cell texts`,
      cnAdapterTexts(page.outer).map((row) => row.slice(0, 2)),
      [['Region', '2023'], ['North', '4,821'], ['South', '2,734']]);
    eq(`cell nest adapter, ${label}: each outer row reads three cells`,
      makeAdapter(page.outer).getRows().map((row) => row.getCells().length), [3, 3, 3]);
    eq(`cell nest adapter, ${label}: no cell the outer grid reads sits inside the inner grid`,
      cnAdapterCellEls(page.outer).some((el) => page.inner.contains(el)), false);
    eq(`cell nest adapter, ${label}: the outer grid reads the cell holding the inner grid as one cell`,
      cnAdapterCellEls(page.outer).includes(page.holdingCell), true);
    eq(`cell nest adapter, ${label}: the inner grid reads its own two rows`,
      cnAdapterTexts(page.inner), [['Q1', '1,234'], ['Q2', '3,587']]);
    eq(`cell nest adapter, ${label}: every cell the inner grid reads sits inside the inner grid`,
      cnAdapterCellEls(page.inner).every((el) => page.inner.contains(el) && el !== page.inner), true);
  }
})();

// A grid with no nesting reads every row and cell as before.
(function cellNest_anOrdinaryGridReadsAsBefore() {
  const grid = rwDrawTable('grid', [
    { part: 'head', rows: [[{ pieces: 'Region', header: 'col' }, { pieces: '2023', header: 'col' }, { pieces: '2024', header: 'col' }]] },
    { part: 'body', rows: [[{ pieces: 'North', header: 'row' }, '4,821', '9,187'], ['South', '2,734', '6,051']], grouped: true },
    { part: 'foot', rows: [['Total', '7,555', '15,238']] },
  ]).table;
  rwEl('div', {}, [grid]);

  eq('cell nest adapter: an ordinary grid reads every row and cell',
    cnAdapterTexts(grid),
    [['Region', '2023', '2024'], ['North', '4,821', '9,187'], ['South', '2,734', '6,051'], ['Total', '7,555', '15,238']]);
  eq('cell nest adapter: an ordinary grid reads every cell element it holds',
    cnAdapterCellEls(grid).length, dgDescendantsMatching(grid, GRID_CELL_SELECTOR).length);

  const queryGrid = makeDatabaseQueryGrid();
  eq('cell nest adapter: the database query wrapper still stitches the pinned gutter first',
    cnAdapterTexts(queryGrid.wrapperEl)[0], ['1', 'alpha', '7,318,204', '284.51']);
})();

// The read of a grid's own rows and cells resolves each element between a
// match and the grid once per query, so the role checks it runs grow with the
// size of the tree. Each element's `matches` counts its calls; the bound is a
// fixed multiple of the element count.
(function cellNest_ownDescendantsWorkGrowsLinearlyWithTheTree() {
  const PER_ELEMENT_BOUND = 20;
  const row = (n) => rwEl('div', { role: 'row' }, [
    rwEl('div', { role: 'cell' }, [rwText(`Item ${n}`)]),
    rwEl('div', { role: 'cell' }, [rwText(String(1000 + n))]),
  ]);
  const rowsOf = (count) => Array.from({ length: count }, (_, n) => row(n));
  // Wrap `inner` in `levels` elements, each built by `wrap`.
  const nestIn = (levels, wrap, inner) => Array.from({ length: levels })
    .reduce((children) => [wrap(children)], inner);
  // Count every `matches` call on every element of the tree.
  const countMatches = (root) => {
    const counter = { calls: 0, elements: 0 };
    (function visit(el) {
      counter.elements++;
      const original = el.matches;
      el.matches = (selector) => { counter.calls++; return original(selector); };
      el.children.forEach(visit);
    })(root);
    return counter;
  };

  const cases = [
    { name: 'plain elements above the rows', rows: 500,
      grid: rwEl('div', { role: 'grid' }, nestIn(200, (children) => rwEl('div', {}, children), rowsOf(500))) },
    { name: 'row groups nested in row groups above the rows', rows: 300,
      grid: rwEl('div', { role: 'grid' }, nestIn(60, (children) => rwEl('div', { role: 'rowgroup' }, children), rowsOf(300))) },
  ];
  for (const { name, rows, grid } of cases) {
    rwEl('div', {}, [grid]);
    const counter = countMatches(grid);
    const read = makeAdapter(grid).getRows().map((r) => r.getCells().length);
    eq(`cell nest adapter, ${name}: the grid reads every row`, read.length, rows);
    eq(`cell nest adapter, ${name}: each row reads its two cells`, read.every((count) => count === 2), true);
    eq(`cell nest adapter, ${name}: the role checks grow with the size of the tree`,
      counter.calls < PER_ELEMENT_BOUND * counter.elements, true);
  }
})();

// ---------------------------------------------------------------------------
// Contextmenu activation pin. The contextmenu handler in content.js calls
// DR_MODEL.setActiveTable(table). The expected message sequence below is a
// literal, so the pin holds on main and in shallow CI checkouts.
// ---------------------------------------------------------------------------
(function appModelSelection_parentEquivalence_contextmenuSelectionFlow() {
  // One sequence: the contextmenu handler reads nothing about the sidebar.
  const PARENT_EXPECTED_SEQUENCE = [{ topic: 'state:tableActivated' }];

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
  // DR_MODEL — even though those bindings are not reachable from outside
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
// Hidden cells: the data test and the engine read a hidden cell's raw
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
    return withTextPiece({ tagName: 'TD', innerText: '', textContent: rawText });
  }
  const artifactTable = makeStubEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
  artifactTable.rows = [
    { cells: [hiddenNumericCell('1'), hiddenNumericCell('2')] },
    { cells: [hiddenNumericCell('3'), hiddenNumericCell('45230')] },
  ];

  eq('hidden cells: the accessibility artifact\'s hidden numeric cells would otherwise pass the data test',
    isDataTable(artifactTable), true);
  eq('hidden cells: isAccessibilityArtifact flags the artifact',
    isAccessibilityArtifact(artifactTable), true);

  // findTables is where detection combines the two: its default isArtifact
  // is isAccessibilityArtifact, applied before any candidate is kept.
  const root = makeStubEl({ tagName: 'DIV' });
  root.querySelectorAll = (sel) => (sel === 'table' ? [artifactTable] : []);
  eq('hidden cells: detection skips the accessibility artifact despite its hidden numeric cells',
    findTables(root).length, 0);

  // Control: the identical row shape, minus the accessibility signal, is a
  // real candidate — isolating the guard as the reason for the exclusion
  // above, not some unrelated property of the mock.
  const onScreenTable = makeStubEl({ tagName: 'TABLE' });
  onScreenTable.rows = artifactTable.rows;
  const wrapper = makeStubEl({ tagName: 'DIV' });
  chainParents(onScreenTable, wrapper);
  const root2 = makeStubEl({ tagName: 'DIV' });
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
  eq('bracketed: a bracket in its own text piece still places',
    placeDecision(decision, layout).mode, 'extracted');
})();

// ---------------------------------------------------------------------------
// A merged cell shifts the columns after it
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

// =============================================================================
// Column-first grids (issue #511)
// Spec: docs/sprint-plans/grid-reading-gaps.md §3.3 and the column-first-grid
// sprint. A column-first grid's children are columns drawn side by side; a
// row-first grid's children are rows drawn one below another. The direction
// read takes the boxes of the first two children that draw a box, among at
// most gridSampleSize children: the same top with a larger left reads
// column-first, and anything else reads row-first.
// =============================================================================

// Run fn with the bare getComputedStyle reading each element's own display,
// the read the default style probe makes in a page.
function withElementDisplays(fn) {
  const saved = global.getComputedStyle;
  global.getComputedStyle = (el) => ({ display: (el && el._display) || 'block', visibility: 'visible' });
  try { fn(); } finally { global.getComputedStyle = saved; }
}

// --- The probe and the right-click ---

(function columnFirst_theProbePassesTheGridWithAWiderLabelColumn() {
  const plan = makeColumnFirstGrid(planGridColumns());
  withElementDisplays(() => {
    eq('column-first: a column-first grid with no role and a wider label column passes the geometry probe',
      looksLikeGrid(plan.gridEl), true);
  });
})();

(function columnFirst_theWalkUpResolvesTheWholeGrid() {
  const plan = makeColumnFirstGrid(planGridColumns());
  withFindTargetEnv([], () => {
    plan.gridEl.parentElement = global.document.body;
    const found = findTargetTable(plan.spanAt(1, 1), { isRegistered: () => false });
    eq('column-first: a right-click walk from a value resolves the whole grid',
      !!found && found.handle === plan.gridEl, true);
    eq('column-first: the walk resolves no single column',
      !!found && plan.columnEls.includes(found.handle), false);
  });
})();

(function columnFirst_aRightClickRegistersTheGrid() {
  withRightClickSandbox(function (ctx) {
    const plan = makeColumnFirstGrid(planGridColumns());
    plan.gridEl.parentElement = global.document.body;
    eq('column-first right-click: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: plan.spanAt(5, 1) });

    eq('column-first right-click: the grid enters the registry',
      ctx.model.hasTable(plan.gridEl), true);
    eq('column-first right-click: the grid becomes the active table',
      ctx.model.getActiveTable() === plan.gridEl, true);
    eq('column-first right-click: the registry holds the grid alone',
      ctx.model.getRegisteredTables().map((el) => el === plan.gridEl), [true]);
    eq('column-first right-click: the grid carries a table pillbox',
      ctx.tablePillboxes.has(plan.gridEl), true);
    eq('column-first right-click: no column carries a table pillbox',
      plan.columnEls.some((column) => ctx.tablePillboxes.has(column)), false);
  });
})();

// --- The turned read ---

(function columnFirst_theAdapterReadsRowsAsRows() {
  const columns = planGridColumns();
  const plan = makeColumnFirstGrid(columns);
  const rows = makeAdapter(plan.gridEl).getRows();
  eq('column-first read: seven columns of five items read as five rows',
    rows.length, 5);
  eq('column-first read: every row holds seven cells',
    rows.map((row) => row.getCells().length), [7, 7, 7, 7, 7]);
  eq('column-first read: row r holds the r-th item of every column, in column order',
    adapterRowTexts(makeAdapter(plan.gridEl)),
    columns[0].map((_, r) => columns.map((column) => column[r])));
  eq('column-first read: each cell is the item element itself',
    rows[2].getCells().map((cell) => cell.el === plan.itemEls[cell.columnIndex][2]),
    [true, true, true, true, true, true, true]);
  eq('column-first read: each cell\'s grid column is its column\'s position',
    rows.map((row) => row.getCells().map((cell) => cell.columnIndex)),
    [0, 1, 2, 3, 4].map(() => [0, 1, 2, 3, 4, 5, 6]));
  eq('column-first read: no turned row is an outside row',
    rows.map((row) => row.isOutside), [false, false, false, false, false]);
})();

(function columnFirst_aRangeNamingColumnBReachesTheSecondColumn() {
  const plan = makeColumnFirstGrid(planGridColumns());
  const before = planGridColumns();
  try {
    roundTableUnder(plan.gridEl, Object.assign({}, DR_DEFAULTS, { rangeExpr: 'B2:B5' }));
    eq('column-first range: B2:B5 changes the Free plan\'s credits',
      plan.textAt(1, 1) !== '12,500', true);
    const others = [];
    before.forEach((column, c) => column.forEach((text, r) => {
      if (c === 1) return;
      if (plan.textAt(c, r) !== text) others.push(`${c},${r}`);
    }));
    eq('column-first range: B2:B5 leaves every item outside the second column as written',
      others, []);
    eq('column-first range: B2:B5 leaves the Free plan\'s name as written',
      plan.textAt(1, 0), 'Free');
  } finally {
    DR_MODEL.unregisterTable(plan.gridEl);
  }
})();

(function columnFirst_theDefaultsRoundTheBodyAndHoldTheLabels() {
  const plan = makeColumnFirstGrid(planGridColumns());
  const before = planGridColumns();
  try {
    roundTableUnder(plan.gridEl, DR_DEFAULTS);
    eq('column-first defaults: 1,962,800 shows 2,000,000',
      plan.textAt(5, 1), '2,000,000');
    eq('column-first defaults: the label column stays as written',
      before[0].map((_, r) => plan.textAt(0, r)), before[0]);
    eq('column-first defaults: the plan names stay as written',
      before.map((_, c) => plan.textAt(c, 0)), before.map((column) => column[0]));
  } finally {
    DR_MODEL.unregisterTable(plan.gridEl);
  }
})();

// A label column that carries numbers, so the first-column switch shows on it.
function numericLabelColumns() {
  return [
    ['Code', '4,812,377', '3,906,154', '2,775,031', '1,648,902'],
    ['North', '8,584,629', '7,318,204', '2,140,663', '1,234,567'],
    ['South', '6,431,708', '5,902,113', '3,377,250', '2,861,449'],
    ['East', '9,104,236', '4,417,852', '1,906,374', '3,520,618'],
    ['West', '7,763,091', '6,285,940', '4,049,517', '2,318,775'],
  ];
}

(function columnFirst_theFirstColumnSwitchGovernsTheLabelColumn() {
  const columns = numericLabelColumns();
  const held = makeColumnFirstGrid(numericLabelColumns());
  try {
    roundTableUnder(held.gridEl, Object.assign({}, DR_DEFAULTS, { simplifyFirstColumn: false }));
    eq('column-first first column off: the label column\'s values stay as written',
      [1, 2, 3, 4].map((r) => held.textAt(0, r)), columns[0].slice(1));
    eq('column-first first column off: every data column\'s values change',
      [1, 2, 3, 4].every((c) => [1, 2, 3, 4].every((r) => held.textAt(c, r) !== columns[c][r])), true);
  } finally {
    DR_MODEL.unregisterTable(held.gridEl);
  }
  const released = makeColumnFirstGrid(numericLabelColumns());
  try {
    roundTableUnder(released.gridEl, Object.assign({}, DR_DEFAULTS, { simplifyFirstColumn: true }));
    eq('column-first first column on: the label column\'s values change',
      [1, 2, 3, 4].map((r) => released.textAt(0, r) !== columns[0][r]), [true, true, true, true]);
    eq('column-first first column on: 4,812,377 in the label column shows 5,000,000',
      released.textAt(0, 1), '5,000,000');
  } finally {
    DR_MODEL.unregisterTable(released.gridEl);
  }
})();

// --- The turned read feeds every consumer through the adapter ---

(function columnFirst_theDataTestReadsTheTurnedGrid() {
  const plan = makeColumnFirstGrid(planGridColumns());
  eq('column-first consumers: the data test passes the grid', isDataTable(plan.gridEl), true);
})();

(function columnFirst_theLensPreviewPoolReadsTheTurnedGrid() {
  const plan = makeColumnFirstGrid(planGridColumns());
  eq('column-first consumers: the lens preview pool under B2:B5 holds the Free plan\'s values',
    collectNumericCells(plan.gridEl, { rangeExpr: 'B2:B5' }).map((cell) => cell.num), [12500, 4, 18]);
  eq('column-first consumers: the lens preview pool under C2 holds the Starter plan\'s credits',
    collectNumericCells(plan.gridEl, { rangeExpr: 'C2' }).map((cell) => cell.num), [36200]);
})();

(function columnFirst_theCaptureReadsTheTurnedGrid() {
  const plan = makeColumnFirstGrid(planGridColumns());
  try {
    roundTableUnder(plan.gridEl, Object.assign({}, DR_DEFAULTS, { rangeExpr: 'B2:B5' }));
    const state = collectCaptureState({ model: DR_MODEL });
    const tableRec = state.tables[DR_MODEL.getRegisteredTables().indexOf(plan.gridEl)];
    eq('column-first capture: the grid records five rows', tableRec && tableRec.rowCount, 5);
    eq('column-first capture: the grid records seven columns', tableRec && tableRec.columnCount, 7);
    const at = (r, c) => tableRec.cells.find((cell) => cell.row === r && cell.col === c);
    eq('column-first capture: row 0 column 1 holds the Free plan\'s name',
      at(0, 1) && at(0, 1).text, 'Free');
    eq('column-first capture: row 1 column 0 holds the credits label',
      at(1, 0) && at(1, 0).text, 'Credits per month');
    eq('column-first capture: row 1 column 1 records the Free plan\'s original credits',
      at(1, 1) && at(1, 1).original, '12,500');
    eq('column-first capture: row 1 column 2 records no original',
      at(1, 2) && at(1, 2).original, null);
  } finally {
    DR_MODEL.unregisterTable(plan.gridEl);
  }
})();

// --- Row-first grids read the same ---

(function rowFirst_section12GridReadsAsRows() {
  const rows = unmarkedGridRows();
  const grid = makeRowFirstGrid(rows);
  withElementDisplays(() => {
    eq('row-first: section 12\'s grid passes the geometry probe', looksLikeGrid(grid.gridEl), true);
  });
  eq('row-first: section 12\'s grid reads as seven rows of four cells, row by row',
    adapterRowTexts(makeAdapter(grid.gridEl)), rows);
  eq('row-first: each row of section 12\'s grid keeps its row element\'s cells',
    makeAdapter(grid.gridEl).getRows()[3].getCells().map((cell) => cell.el === grid.cellAt(3, cell.columnIndex)),
    [true, true, true, true]);
})();

(function rowFirst_section12GridRegistersOnRightClick() {
  withRightClickSandbox(function (ctx) {
    const grid = makeRowFirstGrid(unmarkedGridRows());
    grid.gridEl.parentElement = global.document.body;
    if (typeof ctx.contextmenuHandler !== 'function') {
      eq('row-first right-click: the contextmenu handler was captured', typeof ctx.contextmenuHandler, 'function');
      return;
    }
    ctx.contextmenuHandler({ target: grid.cellAt(2, 1) });
    eq('row-first right-click: section 12\'s grid enters the registry as the active table',
      ctx.model.hasTable(grid.gridEl) && ctx.model.getActiveTable() === grid.gridEl, true);
  });
})();

(function rowFirst_contentsRowsReadAsRows() {
  const rows = unmarkedGridRows();
  const grid = makeRowFirstGrid(rows, { contentsRows: true });
  eq('row-first contents rows: rows that draw no box read row by row',
    adapterRowTexts(makeAdapter(grid.gridEl)), rows);
  withElementDisplays(() => {
    eq('row-first contents rows: the grid passes the geometry probe', looksLikeGrid(grid.gridEl), true);
  });
})();

// --- The alignment step on a column-first grid ---

(function columnFirst_firstCellsThatDoNotLineUpFailTheProbe() {
  const ragged = makeColumnFirstGrid(planGridColumns(), { firstItemHeights: [40, 64, 28, 52, 90, 36, 71] });
  const even = makeColumnFirstGrid(planGridColumns(), { firstItemHeights: [40, 40, 40, 40, 40, 40, 40] });
  withElementDisplays(() => {
    eq('column-first alignment: side-by-side children whose first cells do not line up fail the probe',
      looksLikeGrid(ragged.gridEl), false);
    eq('column-first alignment: the same children with first cells that line up pass the probe',
      looksLikeGrid(even.gridEl), true);
  });
})();

// --- The direction reader skips a child with no box ---

(function columnFirst_theDirectionReadSkipsAHiddenSecondChild() {
  const plan = makeColumnFirstGrid(planGridColumns(), { hiddenColumns: [1] });
  eq('column-first hidden child: a hidden second column leaves the read column-first, by the third column\'s box',
    makeAdapter(plan.gridEl).getRows().length, 5);
  eq('column-first hidden child: row 1 opens with the credits label',
    adapterRowTexts(makeAdapter(plan.gridEl))[1][0], 'Credits per month');
})();

(function columnFirst_theDirectionReadSkipsAHiddenFirstChild() {
  const plan = makeColumnFirstGrid(planGridColumns(), { hiddenColumns: [0] });
  eq('column-first hidden child: a hidden first column leaves the read column-first, by the next two boxes',
    makeAdapter(plan.gridEl).getRows().length, 5);
})();

(function rowFirst_aHiddenSecondRowReadsByTheNextRowBelow() {
  const rows = unmarkedGridRows();
  const grid = makeRowFirstGrid(rows);
  grid.rowEls[1].getBoundingClientRect = () => makeNoBoxRect();
  eq('row-first hidden child: a hidden second row leaves the read row-first, by the third row\'s box',
    adapterRowTexts(makeAdapter(grid.gridEl)), rows);
})();

// --- A probe without the box member ---

(function columnFirst_aProbeWithoutTheBoxMemberReadsRowFirst() {
  const plan = makeColumnFirstGrid(planGridColumns());
  const probe = makeBoxlessStyleProbe();
  const rows = makeAdapter(plan.gridEl, { styleProbe: probe }).getRows();
  eq('no box member: the adapter reads each column as a row',
    rows.length, 7);
  eq('no box member: the first row holds the label column\'s items',
    rows[0].getCells().map((cell) => cell.getText()), planGridColumns()[0]);
  eq('no box member: the geometry probe measures widths, and the wider label column fails it',
    looksLikeGrid(plan.gridEl, { styleProbe: probe }), false);
  eq('no box member: the data test reads the grid row-first and still finds a number',
    isDataTable(plan.gridEl, { styleProbe: probe }), true);
})();

// --- The direction reader's cap ---

// Twelve children of two cells each. Only the children at the positions in
// `boxed` draw a box, side by side on one top.
function makeSparselyBoxedGrid(boxed) {
  const children = [];
  for (let i = 0; i < 12; i++) {
    const at = boxed.indexOf(i);
    const rect = at >= 0 ? makeBoxRect(100, 200 * at, 200, 80) : makeNoBoxRect();
    const cells = [`Item ${i}`, String(100 + i)].map((text) => makeBoxedNode('cell', [makeTextNode(text)], rect));
    children.push(makeBoxedNode('child', cells, rect));
  }
  const gridEl = makeBoxedNode('sparse-grid', children, makeBoxRect(100, 0, 400, 80));
  gridEl._display = 'grid';
  return gridEl;
}

(function directionReader_inspectsAtMostTheSampleCap() {
  const cap = DR_DETECTION_SETTINGS.gridSampleSize;
  const gridEl = makeSparselyBoxedGrid([cap, cap + 1]);
  const probe = makeCountingBoxProbe();
  const rows = makeAdapter(gridEl, { styleProbe: probe }).getRows();
  eq('direction reader cap: the read inspects at most gridSampleSize children',
    probe.boxReads.length <= cap, true);
  eq('direction reader cap: the read inspects no child past the cap',
    probe.boxReads.some((el) => gridEl.children.indexOf(el) >= cap), false);
  eq('direction reader cap: with no box inside the cap the read answers row-first',
    rows.length, 12);
})();

(function directionReader_oneBoxInsideTheCapReadsRowFirst() {
  const cap = DR_DETECTION_SETTINGS.gridSampleSize;
  const gridEl = makeSparselyBoxedGrid([cap - 1, cap]);
  eq('direction reader cap: one box inside the cap answers row-first',
    makeAdapter(gridEl, { styleProbe: makeCountingBoxProbe() }).getRows().length, 12);
})();

(function directionReader_twoBoxesInsideTheCapReadColumnFirst() {
  const cap = DR_DETECTION_SETTINGS.gridSampleSize;
  const gridEl = makeSparselyBoxedGrid([cap - 2, cap - 1]);
  const probe = makeCountingBoxProbe();
  const rows = makeAdapter(gridEl, { styleProbe: probe }).getRows();
  eq('direction reader cap: two side-by-side boxes as the last two children inside the cap read column-first',
    rows.map((row) => row.getCells().length), [12, 12]);
  eq('direction reader cap: the read stops at the second box',
    probe.boxReads.length, cap);
})();

// --- Edge cases ---

(function columnFirst_aColumnWithADifferentItemCountStaysOut() {
  const columns = planGridColumns();
  columns[2] = columns[2].slice(0, 4);
  const plan = makeColumnFirstGrid(columns);
  const texts = adapterRowTexts(makeAdapter(plan.gridEl));
  eq('column-first unequal counts: rows come from the five-item columns',
    texts.length, 5);
  eq('column-first unequal counts: every row holds one cell per five-item column',
    texts.map((row) => row.length), [6, 6, 6, 6, 6]);
  eq('column-first unequal counts: the four-item column stays out of every row',
    texts.some((row) => row.includes('Starter') || row.includes('36,200')), false);
  eq('column-first unequal counts: row 1 reads the five-item columns in order',
    texts[1], ['Credits per month', '12,500', '118,400', '547,300', '1,962,800', '7,214,600']);
})();

(function columnFirst_aSingleChildReadsAsOneRow() {
  const plan = makeColumnFirstGrid([planGridColumns()[1]]);
  const rows = makeAdapter(plan.gridEl).getRows();
  eq('single child: a grid with one child reads row-first as one row', rows.length, 1);
  withElementDisplays(() => {
    eq('single child: the geometry probe rejects a grid with one child', looksLikeGrid(plan.gridEl), false);
  });
})();

(function columnFirst_equalWidthCardsReadAsColumns() {
  const cards = [['Basic', '9'], ['Plus', '19'], ['Team', '49'], ['Office', '99'], ['Enterprise', '249']];
  const grid = makeColumnFirstGrid(cards, { labelWidth: 160, columnWidth: 160 });
  withElementDisplays(() => {
    eq('cards: five equal-width cards that carry a number pass the geometry probe',
      looksLikeGrid(grid.gridEl), true);
  });
  eq('cards: five equal-width cards read as columns, two rows of five cells',
    adapterRowTexts(makeAdapter(grid.gridEl)),
    [['Basic', 'Plus', 'Team', 'Office', 'Enterprise'], ['9', '19', '49', '99', '249']]);
})();

// A grid element that matches a selector itself resolves to itself when no
// descendant matches; a matching descendant resolves ahead of it.
(function gridAdapter_scrollContainerOfAnElementThatMatchesASelectorItself() {
  const matchesEverySelector = () => true;
  const alone = { matches: matchesEverySelector, querySelectorAll: () => [] };
  eq('grid adapter: a grid element that matches a scroll-container selector itself resolves to itself',
    new GridAdapter(alone)._getScrollContainer() === alone, true);

  const inner = { parentElement: null, parentNode: null };
  const outer = {
    matches: matchesEverySelector,
    querySelectorAll: (sel) => (sel === '[role="grid"]' ? [inner] : []),
  };
  inner.parentElement = outer;
  eq('grid adapter: a matching descendant resolves ahead of a grid element that matches a selector itself',
    new GridAdapter(outer)._getScrollContainer() === inner, true);
})();

(function superscriptWalk_aComputedSuperscriptOnAnAncestorCounts() {
  const probeOf = (superEl) => ({
    getComputedStyle: (el) => ({ verticalAlign: el === superEl ? 'super' : 'baseline' }),
  });
  const build = () => {
    const cell = { tagName: 'TD' };
    const outerSpan = { tagName: 'SPAN', parentNode: cell, parentElement: cell };
    const innerSpan = { tagName: 'SPAN', parentNode: outerSpan, parentElement: outerSpan };
    cell._textNodes = [
      { nodeValue: '10', parentNode: cell, parentElement: cell },
      { nodeValue: '12', parentNode: innerSpan, parentElement: innerSpan },
    ];
    return { cell, outerSpan, innerSpan };
  };
  withSupCreateTreeWalker(function() {
    const own = build();
    eq('superscript walk: a computed superscript on the text\'s own parent gives one range',
      getSuperscriptRanges(own.cell, { styleProbe: probeOf(own.innerSpan) }), [{ start: 2, end: 4 }]);
    const far = build();
    eq('superscript walk: a computed superscript two ancestors above the text gives one range',
      getSuperscriptRanges(far.cell, { styleProbe: probeOf(far.outerSpan) }), [{ start: 2, end: 4 }]);
    const none = build();
    eq('superscript walk: no computed superscript on any ancestor gives no range',
      getSuperscriptRanges(none.cell, { styleProbe: probeOf(null) }), []);
  });
})();

// An inline style the probe does not report has no effect.
(function accessibilityArtifact_readsPositionAndLeftThroughTheStyleProbe() {
  const probeOf = (styles) => ({
    getComputedStyle: (el) => Object.assign({ position: 'static', left: '0px' }, styles.get(el)),
  });
  const offscreen = { position: 'absolute', left: '-10000px' };

  const inlineOnly = makeStubEl({ tagName: 'TABLE', style: offscreen });
  eq('artifact filter: an inline off-screen style the style probe does not report gives false',
    isAccessibilityArtifact(inlineOnly, { styleProbe: probeOf(new Map()) }), false);

  const probedOnly = makeStubEl({ tagName: 'TABLE', style: { position: 'static', left: '0px' } });
  eq('artifact filter: an off-screen style only the style probe reports gives true',
    isAccessibilityArtifact(probedOnly, { styleProbe: probeOf(new Map([[probedOnly, offscreen]])) }), true);

  const table = makeStubEl({ tagName: 'TABLE' });
  const inlineAncestor = makeStubEl({ style: offscreen });
  chainParents(table, inlineAncestor);
  eq('artifact filter: an ancestor with an inline positioned off-screen style the style probe does not report gives false',
    isAccessibilityArtifact(table, { styleProbe: probeOf(new Map()) }), false);

  const probedTable = makeStubEl({ tagName: 'TABLE' });
  const probedAncestor = makeStubEl({ style: { position: 'static', left: '0px' } });
  chainParents(probedTable, probedAncestor);
  eq('artifact filter: an ancestor the style probe reports as positioned and off-screen gives true',
    isAccessibilityArtifact(probedTable, { styleProbe: probeOf(new Map([[probedAncestor, offscreen]])) }), true);
})();

// ---------------------------------------------------------------------------
// One accessibility-artifact filter on both table kinds
// ---------------------------------------------------------------------------
//
// Fixtures: AF_ARTIFACT_FORMS and AF_VISIBLE_FORMS in helpers.js. Each case
// asserts the registry and the table pillbox together (afRegistered), through
// the load-time scan and through the right-click.

// A grid in any artifact form gets no registry entry, no table pillbox, and
// no right-click resolution. The visible forms are the control: the same
// grid registers.
(function artifactFilter_aGridInAnArtifactFormIsSkippedOnBothPaths() {
  for (const role of ['grid', 'table']) {
    for (const form of AF_ARTIFACT_FORMS) {
      const grid = afTable('grid', role);
      const page = afPage([form.place(grid)]);
      const probe = makeArtifactStyleProbe();
      afScan(page);
      eq(`artifact filter, ${role} role, ${form.name}: the load-time scan registers nothing and draws no table pillbox`,
        afRegistered(page).length, 0);
      afForget(page);
      eq(`artifact filter, ${role} role, ${form.name}: findTables lists nothing`,
        findTables(page, { styleProbe: probe }).length, 0);
      eq(`artifact filter, ${role} role, ${form.name}: the right-click resolves nothing`,
        afRightClick(page, grid) === null, true);
      eq(`artifact filter, ${role} role, ${form.name}: the right-click path registers nothing`,
        afRegistered(page).length, 0);
    }
    for (const form of AF_VISIBLE_FORMS) {
      const grid = afTable('grid', role);
      const page = afPage([form.place(grid)]);
      afScan(page);
      eq(`artifact filter, ${role} role, ${form.name}: the load-time scan registers the grid`,
        afSame(afRegistered(page), [grid]), true);
      afForget(page);
      const resolved = afRightClick(page, grid);
      eq(`artifact filter, ${role} role, ${form.name}: the right-click resolves the grid as new`,
        resolved && [resolved.handle === grid, resolved.isNew], [true, true]);
      afForget(page);
    }
  }
})();

// The native table gets the same verdict from the same forms.
(function artifactFilter_aNativeTableInAnArtifactFormIsSkipped() {
  for (const form of AF_ARTIFACT_FORMS) {
    const table = afTable('native');
    const page = afPage([form.place(table)]);
    afScan(page);
    eq(`artifact filter, native, ${form.name}: the load-time scan registers nothing`,
      afRegistered(page).length, 0);
    eq(`artifact filter, native, ${form.name}: findTables lists nothing`,
      findTables(page, { styleProbe: inlineStyleProbe }).length, 0);
    afForget(page);
  }
  for (const form of AF_VISIBLE_FORMS) {
    const table = afTable('native');
    const page = afPage([form.place(table)]);
    afScan(page);
    eq(`artifact filter, native, ${form.name}: the load-time scan registers the table`,
      afSame(afRegistered(page), [table]), true);
    afForget(page);
  }
})();

// An added node goes through the same filter on both kinds.
(function artifactFilter_anAddedNodeInAnArtifactFormIsSkipped() {
  for (const kind of ['native', 'grid']) {
    for (const form of AF_ARTIFACT_FORMS) {
      const table = afTable(kind);
      const page = afPage([form.place(table)]);
      afAddNode(page);
      eq(`artifact filter, added node, ${kind}, ${form.name}: nothing registers`,
        afRegistered(page).length, 0);
      afForget(page);
    }
    const table = afTable(kind);
    const page = afPage([table]);
    afAddNode(page);
    eq(`artifact filter, added node, ${kind}, no marks: the table registers`, afSame(afRegistered(page), [table]), true);
    afForget(page);
  }
})();

// The geometry probe rejects an unmarked grid at its entry: it reads no
// layout, and the role short-circuit does not rescue a marked grid.
(function artifactFilter_theGeometryProbeRejectsAnArtifactAtItsEntry() {
  const unmarkedGrid = (role) => makeGridContainer([
    makeGridRow([{ text: 'Name', width: 80 }, { text: '1234' }], 'row', 20),
    makeGridRow([{ text: 'Foo', width: 80 }, { text: '5678' }], 'row', 20),
    makeGridRow([{ text: 'Bar', width: 80 }, { text: '9012' }], 'row', 20),
    makeGridRow([{ text: 'Qux', width: 80 }, { text: '3456' }], 'row', 20),
    makeGridRow([{ text: 'Etc', width: 80 }, { text: '7890' }], 'row', 20),
  ], 'flex', role, '');
  const withMarks = (el, attrs, style) => {
    const role = el.getAttribute('role');
    el.getAttribute = (name) => (name === 'role' ? role : (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null));
    el.style = style || {};
    return el;
  };
  for (const role of [null, 'grid']) {
    const label = role ? 'a role-bearing grid' : 'an unmarked grid';
    const control = makeArtifactStyleProbe();
    eq(`geometry probe, ${label}: a grid with no marks passes (the cases below reject it for the marks alone)`,
      looksLikeGrid(unmarkedGrid(role), { styleProbe: control }), true);
    eq(`geometry probe, ${label}: the pass reads layout, so the zero reads below stand for an entry rejection`,
      control.layoutReads > 0, true);

    const hiddenSelf = withMarks(unmarkedGrid(role), { 'aria-hidden': 'true' });
    const probeSelf = makeArtifactStyleProbe();
    eq(`geometry probe, ${label}: aria-hidden on the grid is rejected`,
      looksLikeGrid(hiddenSelf, { styleProbe: probeSelf }), false);
    eq(`geometry probe, ${label}: aria-hidden on the grid reads no layout`, probeSelf.layoutReads, 0);

    const hiddenAncestor = withMarks(unmarkedGrid(role), {});
    const outer = makeStubEl({ attrs: { 'aria-hidden': 'true' } });
    chainParents(hiddenAncestor, makeStubEl(), outer);
    const probeAncestor = makeArtifactStyleProbe();
    eq(`geometry probe, ${label}: aria-hidden on an ancestor is rejected`,
      looksLikeGrid(hiddenAncestor, { styleProbe: probeAncestor }), false);
    eq(`geometry probe, ${label}: aria-hidden on an ancestor reads no layout`, probeAncestor.layoutReads, 0);

    const offscreenSelf = withMarks(unmarkedGrid(role), {}, { position: 'absolute', left: AF_OFFSCREEN_LEFT });
    const probeOffscreen = makeArtifactStyleProbe();
    eq(`geometry probe, ${label}: a positioned grid drawn off-screen is rejected`,
      looksLikeGrid(offscreenSelf, { styleProbe: probeOffscreen }), false);
    eq(`geometry probe, ${label}: the off-screen grid reads no layout`, probeOffscreen.layoutReads, 0);

    const offscreenAncestor = withMarks(unmarkedGrid(role), {});
    chainParents(offscreenAncestor, makePositionedAncestor({ left: AF_OFFSCREEN_LEFT }));
    const probeBox = makeArtifactStyleProbe();
    eq(`geometry probe, ${label}: a grid inside an off-screen positioned box is rejected`,
      looksLikeGrid(offscreenAncestor, { styleProbe: probeBox }), false);
    eq(`geometry probe, ${label}: the grid inside the off-screen box reads no layout`, probeBox.layoutReads, 0);
  }
})();

// The right-click reaches the geometry probe for a grid with no role; the
// probe's entry rejection holds on that route too.
(function artifactFilter_aRoleLessHiddenGridResolvesNothingOnARightClick() {
  const rows = ['a', 'b', 'c', 'd', 'e'].map((label) => makeGridRow([{ text: label, width: 80 }, { text: '1234' }], 'row', 20));
  const container = makeGridContainer(rows, 'flex', null, '');
  rows.forEach((row) => { row.parentElement = container; row.parentNode = container; });
  rows[0].children[1].parentElement = rows[0];
  const hidden = { 'aria-hidden': 'true' };
  container.getAttribute = (name) => (hidden[name] === undefined ? null : hidden[name]);
  const body = { nodeType: 1, tagName: 'BODY', parentElement: null, parentNode: null, getAttribute: () => null };
  container.parentElement = body;
  container.parentNode = body;
  const click = rows[0].children[1];
  eq('artifact filter: a click inside a hidden role-less grid resolves nothing',
    findTargetTable(click, { doc: { body }, isRegistered: () => false, styleProbe: makeArtifactStyleProbe() }) === null, true);
  hidden['aria-hidden'] = 'false';
  const resolved = findTargetTable(click, { doc: { body }, isRegistered: () => false, styleProbe: makeArtifactStyleProbe() });
  eq('artifact filter: the same click resolves the grid once it is not hidden (control)',
    resolved && resolved.handle === container, true);
})();

// The chart check is gone: a labelled svg beside or inside a positioned table
// changes nothing, on both kinds.
(function artifactFilter_aLabelledSvgNoLongerMakesATableAnArtifact() {
  const labelled = () => rwEl('svg', { 'aria-label': 'Sorted ascending' }, []);
  const holdsSvgInACell = (table) => {
    const cell = table.querySelectorAll('td')[0] || table.querySelectorAll('[role="cell"]')[0];
    rwSetChildren(cell, cell.childNodes.concat([labelled()]));
    return table;
  };
  const cases = [
    { name: 'a positioned table holding a labelled svg in a cell',
      build: (kind) => { const t = holdsSvgInACell(afTable(kind)); afMark(t, {}, { position: 'relative' }); return [t, [t]]; } },
    { name: 'a table beside a labelled svg in a positioned box',
      build: (kind) => { const t = afTable(kind); return [t, [afBox([t, labelled()], {}, { position: 'relative' })]]; } },
    { name: 'a table in a positioned box that holds a labelled svg further down',
      build: (kind) => { const t = afTable(kind); return [t, [afBox([afBox([t]), afBox([labelled()])], {}, { position: 'absolute', left: '0px' })]]; } },
  ];
  for (const kind of ['native', 'grid']) {
    for (const { name, build } of cases) {
      const [table, children] = build(kind);
      const page = afPage(children);
      eq(`artifact filter, ${kind}: ${name} is not an accessibility artifact`,
        isAccessibilityArtifact(table, { styleProbe: inlineStyleProbe }), false);
      afScan(page);
      eq(`artifact filter, ${kind}: ${name} registers on the load-time scan`, afSame(afRegistered(page), [table]), true);
      afForget(page);
      eq(`artifact filter, ${kind}: ${name} is listed by findTables`,
        afSame(findTables(page, { styleProbe: inlineStyleProbe }).map((found) => found.handle), [table]), true);
    }
  }
})();

// Native behavior stays as it was: an added table holding a data table
// registers both, and the load-time scan registers the data tables in
// document order, leaving the artifacts out.
(function artifactFilter_nativeBehaviorIsUnchanged() {
  const outer = rwDrawTable('native', [
    { part: 'head', rows: [[{ pieces: 'Region', header: 'col' }, { pieces: '2023', header: 'col' }, { pieces: 'By quarter', header: 'col' }]] },
    { part: 'body', rows: [['North', '4,821', { pieces: [], nested: {
      sections: [{ part: 'body', rows: [['Q1', '1,234'], ['Q2', '3,587']], grouped: true }],
    } }], ['South', '2,734', '']], grouped: true },
  ]).table;
  const inner = outer.querySelectorAll('table')[0];
  const addedPage = afPage([outer]);
  afAddNode(outer);
  eq('native added node: a table holding a nested data table registers both, outer first',
    afSame(afCandidates(addedPage).filter((el) => DR_MODEL.hasTable(el)), [outer, inner]), true);
  eq('native added node: both gain a table pillbox', [outer, inner].map((el) => tablePillboxes.has(el)), [true, true]);
  afForget(addedPage);

  const first = afTable('native');
  const hiddenOne = afMark(afTable('native'), { 'aria-hidden': 'true' });
  const second = afTable('native');
  const offscreenOne = afBox([afTable('native')], {}, { position: 'absolute', left: AF_OFFSCREEN_LEFT });
  const third = afBox([afTable('native')], { 'aria-hidden': 'false' });
  const page = afPage([first, hiddenOne, second, offscreenOne, third]);
  const order = [];
  const savedCreate = createTablePillbox;
  createTablePillbox = function (table) { order.push(table); return savedCreate.apply(this, arguments); };
  try { afScan(page); } finally { createTablePillbox = savedCreate; }
  eq('native load-time scan: the data tables register in document order and the artifacts stay out',
    afSame(order, [first, second, third.querySelectorAll('table')[0]]), true);
  eq('native load-time scan: findTables lists the same tables in the same order',
    afSame(findTables(page, { styleProbe: inlineStyleProbe }).map((found) => found.handle), order), true);
  afForget(page);
})();

// A right-click inside a table resolves by one rule on both kinds: a table in
// an artifact form resolves nothing, and a table that stays on the page
// resolves.
(function artifactFilter_aRightClickResolvesByOneRuleOnBothKinds() {
  for (const kind of ['native', 'grid']) {
    for (const form of AF_ARTIFACT_FORMS) {
      const table = afTable(kind);
      const page = afPage([form.place(table)]);
      eq(`artifact filter, right-click, ${kind}, ${form.name}: resolves nothing`,
        afRightClick(page, table) === null, true);
    }
    for (const form of AF_VISIBLE_FORMS) {
      const table = afTable(kind);
      const page = afPage([form.place(table)]);
      const resolved = afRightClick(page, table);
      eq(`artifact filter, right-click, ${kind}, ${form.name}: resolves the table`,
        resolved !== null && resolved.handle === table, true);
      afForget(page);
    }
  }
})();

(function artifactFilter_anArtifactInsideAVisibleTableCellResolvesTheOuterTable() {
  for (const kind of ['native', 'grid']) {
    const inner = afMark(afTable(kind), { 'aria-hidden': 'true' });
    const outer = rwEl('table', {}, [rwEl('tbody', {}, [rwEl('tr', {}, [rwEl('td', {}, [inner])])])]);
    const page = afPage([outer]);
    const resolved = afRightClick(page, inner);
    eq(`artifact filter, right-click, ${kind} artifact in a native table cell: resolves the outer table`,
      resolved !== null && resolved.handle === outer, true);
  }
})();
