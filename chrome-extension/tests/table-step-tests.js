// The table step (lib/dr-simplify/table.js): the column post-pass, the max
// magnitude over the dataset, and each cell's patches, run over plain
// classified cells with no page.
//
// The first sections load the number library and lib/dr-simplify alone, in a
// fresh context that holds no page, no browser, no registry, and no log
// buffer, and run the table step there. The later sections run the same cells
// through the one simplification pass on a native table and compare, check a
// date across two text pieces on both table kinds, and check where the table
// step's code lives.

// The table step's settings for every case below: the offsets differ, so a
// cell's band shows in its result.
const TABLE_STEP_SETTINGS = {
  offsetTop: -0.5, offsetOther: -1, numTop: 1,
  dateGranularity: 'month', timeGranularity: 'hour',
};

const TABLE_STEP_LADDER_OPTS = Object.assign({}, DR_DEFAULTS, {
  simplifyFirstRow: true, simplifyFirstColumn: true,
  simplifyDates: true, simplifyTimes: true,
});

// One table, by row and grid column, with invented values. The dataset is
// 8,584,629, 1,234, 5,678, 41.31, and 2,468, so the max magnitude is 6:
//   magnitude 6, top band, step 500,000:  8,584,629 → 8,500,000
//   magnitude 3, other band, step 100:    1,234 → 1,200, 5,678 → 5,700, 2,468 → 2,500
//   magnitude 1, other band, step 1:      41.31 → 41
// Column 2 holds 3/4/2024 and 13/4/2024, so the column reads day-first and
// 3/4/2024 is 3 April. Column 3 holds 3/4/2024 and 3/14/2024, so the column
// reads month-first and 3/4/2024 is 4 March. Each date takes month
// granularity.
const TABLE_STEP_ROWS = [
  [' 8,584,629 ', 'Revenue 1,234 and 5,678 units', '3/4/2024', '3/4/2024'],
  ['pending', '41.31', '13/4/2024', '3/14/2024'],
  ['10:47', '2,468', '3/4/2024', '3/4/2024'],
];

const TABLE_STEP_EXPECTED_ROWS = [
  [' 8,500,000 ', 'Revenue 1,200 and 5,700 units', '4/2024', '3/2024'],
  ['pending', '41', '4/2024', '3/2024'],
  ['11:00', '2,500', '4/2024', '3/2024'],
];

// Load the number library and lib/dr-simplify, in manifest order, into a
// fresh context with nothing on its global scope. extraSource runs after
// them in the same script, so a function it declares replaces the one of the
// same name. Returns null when the manifest lists none of the files.
function loadTableStepAlone(extraSource) {
  const vm = require('vm');
  const files = contentScriptFiles.filter((file) =>
    file.startsWith('lib/dr-number/') || file.startsWith('lib/dr-simplify/'));
  if (!files.includes('lib/dr-simplify/table.js')) return null;
  const context = vm.createContext({});
  const source = files.map((file) => sourceByName(file)).join('\n') + '\n' + (extraSource || '') + `
;({
  tablePatches, classifyCell, applyPatches,
  globals: {
    document: typeof document, window: typeof window, chrome: typeof chrome,
    DR_MODEL: typeof DR_MODEL, DR_LOG: typeof DR_LOG,
  },
});`;
  return { files, api: vm.runInContext(source, context) };
}

// Classify each cell of a table through the ladder alone, as plain
// classified cells: text, classification, and grid column.
function tableStepCells(api, rows) {
  const cells = [];
  rows.forEach((row, rowIndex) => row.forEach((text, columnIndex) => {
    const classification = api.classifyCell({ text, rowIndex, columnIndex, ranges: null }, TABLE_STEP_LADDER_OPTS);
    cells.push({ text, classification, columnIndex });
  }));
  return cells;
}

(function tableStep_loadsWithNoPage() {
  const loaded = loadTableStepAlone();
  eq('table step alone: the manifest lists lib/dr-simplify/table.js', loaded !== null, true);
  if (loaded === null) return;
  eq('table step alone: only the number library and lib/dr-simplify load',
    loaded.files.every((file) => /^lib\/dr-(number|simplify)\//.test(file)), true);
  eq('table step alone: the context holds no page, browser, registry, or log buffer',
    loaded.api.globals,
    { document: 'undefined', window: 'undefined', chrome: 'undefined', DR_MODEL: 'undefined', DR_LOG: 'undefined' });
})();

(function tableStep_patchesForEachStretchKind() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const result = api.tablePatches(tableStepCells(api, TABLE_STEP_ROWS), TABLE_STEP_SETTINGS);
  const at = (r, c) => result.patchedCells[r * TABLE_STEP_ROWS[0].length + c];
  eq('table step alone: the max magnitude comes from every number in the dataset, extracted cells included',
    result.maxMag, 6);
  eq('table step alone: one result per cell, in input order',
    result.patchedCells.map((cell) => cell.classifiedCell.text), TABLE_STEP_ROWS.flat());
  eq('table step alone: a pure cell takes one patch over its number span, after its leading whitespace',
    at(0, 0).patches,
    [{ index: 1, numStr: '8,584,629', newNum: '8,500,000' }]);
  eq('table step alone: an extracted cell with two numbers takes one patch per number, each in the other band',
    at(0, 1).patches,
    [{ index: 8, numStr: '1,234', newNum: '1,200' }, { index: 18, numStr: '5,678', newNum: '5,700' }]);
  eq('table step alone: the column post-pass reads an ambiguous date day-first in a day-first column',
    [at(0, 2).patches, at(2, 2).patches],
    [[{ index: 0, numStr: '3/4/2024', newNum: '4/2024' }], [{ index: 0, numStr: '3/4/2024', newNum: '4/2024' }]]);
  eq('table step alone: the column post-pass reads the same date month-first in a month-first column',
    [at(0, 3).patches, at(2, 3).patches],
    [[{ index: 0, numStr: '3/4/2024', newNum: '3/2024' }], [{ index: 0, numStr: '3/4/2024', newNum: '3/2024' }]]);
  eq('table step alone: the column post-pass gives each ambiguous date in the classified cell its month',
    [at(0, 2).classifiedCell.classification.stretches.map((s) => [s.month, 'n1' in s]),
      at(0, 3).classifiedCell.classification.stretches.map((s) => [s.month, 'n1' in s])],
    [[[4, false]], [[3, false]]]);
  eq('table step alone: "pending", a cell with no stretch, takes no patch',
    { stretches: at(1, 0).classifiedCell.classification.stretches, patches: at(1, 0).patches },
    { stretches: [], patches: [] });
  eq('table step alone: "10:47" takes one patch, "10:47" to "11:00"',
    at(2, 0).patches, [{ index: 0, numStr: '10:47', newNum: '11:00' }]);
  eq('table step alone: each cell\'s text with its patches applied',
    result.patchedCells.map(({ classifiedCell: { text }, patches }) =>
      (patches.every((p) => text.slice(p.index, p.index + p.numStr.length) === p.numStr)
        ? api.applyPatches(text, patches) : 'patch missed')),
    TABLE_STEP_EXPECTED_ROWS.flat());
})();

(function tableStep_spaceGroupedNumberInsideWordsIsOnePatch() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  eq('table step alone: a space-grouped number inside words takes one patch, written with commas',
    api.tablePatches(tableStepCells(api, [['Revenue 1 034 567 units']]), TABLE_STEP_SETTINGS).patchedCells[0].patches,
    [{ index: 8, numStr: '1 034 567', newNum: '1,000,000' }]);
})();

(function tableStep_dateAfterLeadingSpaces() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, [['  2024-03-15 ']]);
  eq('table step alone: "  2024-03-15 " at month takes one patch at 2 that writes "2024-03"',
    api.tablePatches(cells, TABLE_STEP_SETTINGS).patchedCells[0].patches,
    [{ index: 2, numStr: '2024-03-15', newNum: '2024-03' }]);
})();

(function tableStep_leadingWhitespaceStaysAsWritten() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const row = ['  12,345', '  Jun 15, 2020', '  14:29'];
  const result = api.tablePatches(tableStepCells(api, [row]), TABLE_STEP_SETTINGS);
  eq('table step alone: "  12,345", "  Jun 15, 2020", and "  14:29" each take one patch at 2',
    result.patchedCells.map((cell) => cell.patches),
    [[{ index: 2, numStr: '12,345', newNum: '10,000' }],
      [{ index: 2, numStr: 'Jun 15, 2020', newNum: 'Jun 2020' }],
      [{ index: 2, numStr: '14:29', newNum: '14:00' }]]);
  eq('table step alone: "  12,345", "  Jun 15, 2020", and "  14:29" read "  10,000", "  Jun 2020", and "  14:00"',
    result.patchedCells.map((cell) => api.applyPatches(cell.classifiedCell.text, cell.patches)),
    ['  10,000', '  Jun 2020', '  14:00']);
})();

// --- The column post-pass ---
//
// A column of all-numeric dates reads month-first when one date's second
// number is above 12, and day-first when one date's first number is.

(function pickDateFormatHint_readsTheColumn() {
  eq('pickDateFormatHint: n1 > 12 only -> day-first', pickDateFormatHint([{ n1: 25, n2: 4 }]), 'day-first');
  eq('pickDateFormatHint: n2 > 12 only -> month-first', pickDateFormatHint([{ n1: 3, n2: 25 }]), 'month-first');
  eq('pickDateFormatHint: both > 12 across the column -> mixed',
    pickDateFormatHint([{ n1: 25, n2: 4 }, { n1: 3, n2: 25 }]), 'mixed');
  eq('pickDateFormatHint: neither > 12 -> ambiguous', pickDateFormatHint([{ n1: 3, n2: 4 }]), 'ambiguous');
})();

(function columnPostPass_settlesEachAmbiguousDate() {
  const column = (texts) => texts.map((text, rowIndex) => ({
    text, columnIndex: 0, classification: classifyCell({ text, rowIndex, columnIndex: 0, ranges: null }, TABLE_STEP_LADDER_OPTS),
  }));
  const stretchesOf = (cells) => cells.map((cell) => cell.classification.stretches);
  eq('column post-pass: "03/04/2020" above "03/14/2020" reads as 4 March',
    stretchesOf(resolveAmbiguousDates(column(['03/04/2020', '03/14/2020'])))[0],
    [{ kind: 'date', year: 2020, month: 3, monthBeforeYear: true, start: 0, end: 10, dayCut: { start: 3, end: 6 } }]);
  eq('column post-pass: "03/04/2020" above "13/04/2020" reads as 3 April',
    stretchesOf(resolveAmbiguousDates(column(['03/04/2020', '13/04/2020'])))[0],
    [{ kind: 'date', year: 2020, month: 4, monthBeforeYear: true, start: 0, end: 10, dayCut: { start: 0, end: 3 } }]);
  eq('column post-pass: "03/04/2020", "13/04/2020", and "03/14/2020" in one column each hold no stretch',
    stretchesOf(resolveAmbiguousDates(column(['03/04/2020', '13/04/2020', '03/14/2020']))), [[], [], []]);
  eq('column post-pass: "03/04/2020" above "05/06/2021" each hold no stretch',
    stretchesOf(resolveAmbiguousDates(column(['03/04/2020', '05/06/2021']))), [[], []]);

  const withDateText = column(['03/04/2020 and 2021-05-06', '03/14/2020']);
  const isoDate = withDateText[0].classification.stretches[1];
  const settled = resolveAmbiguousDates(withDateText)[0].classification.stretches;
  eq('column post-pass: "03/04/2020 and 2021-05-06" above "03/14/2020" reads the first date as March and keeps the second as read',
    [settled.map((s) => [s.kind, s.month, s.start, s.end]), settled[1]],
    [[['date', 3, 0, 10], ['date', 5, 15, 25]], isoDate]);

  const split = column(['03/04/2020 and 7/8/2021', '13/04/2020', '03/14/2020']).map((cell, k) => (k === 0
    ? Object.assign({}, cell, { classification: Object.assign({}, cell.classification, { split: true }) }) : cell));
  eq('column post-pass: a split cell in a column whose dates read both ways holds no stretch and stays split',
    resolveAmbiguousDates(split)[0].classification, { stretches: [], split: true });

  const numberCell = { text: '1,234', columnIndex: 0,
    classification: classifyCell({ text: '1,234', rowIndex: 1, columnIndex: 0, ranges: null }, TABLE_STEP_LADDER_OPTS) };
  eq('column post-pass: "1,234" in a column of dates that read both ways keeps its number stretch',
    resolveAmbiguousDates(column(['03/04/2020', '13/04/2020', '03/14/2020']).concat([numberCell]))[3], numberCell);
})();

(function tableStep_unchangedValuesTakeNoPatch() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, [['8,500,000', '2096', 'Mar 2096']]);
  eq('table step alone: a number on its step, and a date with no day, take no patch',
    api.tablePatches(cells, TABLE_STEP_SETTINGS).patchedCells.map((cell) => cell.patches), [[], [], []]);
  eq('table step alone: a pure cell whose display simplifies takes a patch',
    api.tablePatches(tableStepCells(api, [['35.0']]), TABLE_STEP_SETTINGS).patchedCells[0].patches,
    [{ index: 0, numStr: '35.0', newNum: '35' }]);
})();

(function tableStep_leavesItsInputUnchanged() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, TABLE_STEP_ROWS).map((cell) => Object.assign({ carried: cell.columnIndex }, cell));
  const before = JSON.stringify(cells);
  const result = api.tablePatches(cells, TABLE_STEP_SETTINGS);
  eq('table step alone: the classified cells passed in stay unchanged', JSON.stringify(cells), before);
  eq('table step alone: every other field of a cell passes through to its classified cell',
    result.patchedCells.every((cell, k) => cell.classifiedCell.carried === cells[k].columnIndex), true);
})();

// --- A frozen max magnitude. ---

(function tableStep_roundsAgainstAFrozenMaxMagnitude() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, TABLE_STEP_ROWS);
  const frozen = api.tablePatches(cells, TABLE_STEP_SETTINGS, 7);
  eq('table step, frozen max magnitude: the step returns the frozen max magnitude', frozen.maxMag, 7);
  eq('table step, frozen max magnitude: a magnitude-6 number rounds in the other band against it',
    frozen.patchedCells[0].patches, [{ index: 1, numStr: '8,584,629', newNum: '8,600,000' }]);
  const frozenZero = api.tablePatches(cells, TABLE_STEP_SETTINGS, 0);
  eq('table step, frozen max magnitude: a frozen max magnitude of 0 stands', frozenZero.maxMag, 0);
  eq('table step, frozen max magnitude: no frozen max magnitude computes one from the dataset',
    [api.tablePatches(cells, TABLE_STEP_SETTINGS, null).maxMag,
      api.tablePatches(cells, TABLE_STEP_SETTINGS, undefined).maxMag], [6, 6]);
})();

(function tableStep_frozenMaxMagnitudeComputesNone() {
  // A stub declared after the real one replaces it in the same scope, so a
  // call to it throws.
  const loaded = loadTableStepAlone(
    'function findMaxMagnitude() { throw new Error("the table step computed a max magnitude"); }\n');
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, TABLE_STEP_ROWS);
  const run = (frozenMaxMag) => {
    try { return api.tablePatches(cells, TABLE_STEP_SETTINGS, frozenMaxMag).maxMag; } catch (e) { return String(e.message); }
  };
  eq('table step, frozen max magnitude: with no frozen value the step computes one',
    run(null), 'the table step computed a max magnitude');
  eq('table step, frozen max magnitude: with a frozen value the step computes none', run(6), 6);
})();

// --- The table step's patches are the patches the extension writes. ---

(function tableStep_matchesTheNativePass() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const step = loaded.api.tablePatches(tableStepCells(loaded.api, TABLE_STEP_ROWS), TABLE_STEP_SETTINGS);
  const stepTexts = step.patchedCells.map((cell) => loaded.api.applyPatches(cell.classifiedCell.text, cell.patches));
  const passOpts = Object.assign({}, TABLE_STEP_LADDER_OPTS, TABLE_STEP_SETTINGS);
  eachRewriteKind(['native'], (kind, page, build) => {
    const t = build(TABLE_STEP_ROWS);
    roundTableUnder(t.table, passOpts);
    eq('table step vs native pass: the pass writes the expected text into each cell',
      t.rowTexts(), TABLE_STEP_EXPECTED_ROWS);
    eq('table step vs native pass: the table step alone gives each cell the text the pass writes',
      stepTexts, t.rowTexts().flat());
  });
})();

// --- A date across two text pieces stays as written. ---
//
// The pass counts the cell as a split value. A date that sits in one piece
// beside a whitespace piece rounds.

(function tableStep_dateAcrossTwoPiecesStaysUnchanged() {
  const passOpts = Object.assign({}, TABLE_STEP_LADDER_OPTS, TABLE_STEP_SETTINGS);
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build([
      [[{ tag: 'b', text: '2024-' }, { tag: 'b', text: '03-15' }], '1,234'],
      ['2024-04-20', '5,678'],
      [[{ tag: 'b', text: '2024-05-10' }, ' '], '2,468'],
    ]);
    const result = roundTableUnder(t.table, passOpts);
    eq(`table step, date across two pieces (${kind}): each piece keeps its text`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['2024-', '03-15']);
    eq(`table step, date across two pieces (${kind}): the pass counts one split value`,
      result.leftAsWritten.splitValue, 1);
    eq(`table step, date across two pieces (${kind}): a date in one piece rounds`,
      t.text(1, 0), '2024-04');
    eq(`table step, date across two pieces (${kind}): a date in one piece beside a whitespace piece rounds`,
      t.pieces(2, 0).map((p) => p.nodeValue), ['2024-05', ' ']);
    eq(`table step, date across two pieces (${kind}): the numbers in the table round`,
      [t.text(0, 1), t.text(1, 1), t.text(2, 1)], ['1,000', '5,500', '2,500']);
  });
})();

// --- Where the table step lives. ---

(function tableStep_sourceHoldsNoPageCode() {
  const src = sourceByName('lib/dr-simplify/table.js');
  eq('table step source: lib/dr-simplify/table.js is present', src !== null, true);
  if (src === null) return;
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const PAGE_NAMES = /\b(document|window|chrome|globalThis|DR_MODEL|DR_LOG|DR_BUS|Node|NodeFilter|MutationObserver|querySelector\w*|createTreeWalker|getComputedStyle|innerText|textContent|nodeValue|childNodes|parentNode|parentElement|layout|layoutPieceHolding|cellObj|el)\b/g;
  eq('table step source: the code names no page, browser, registry, or log buffer, and no text piece',
    [...new Set(code.match(PAGE_NAMES) || [])], []);
})();

(function tableStep_oneDefinitionOfEachRule() {
  const contentSrc = sourceByName('content.js');
  const DECL = (name) => new RegExp(`^\\s*function\\s+${name}\\s*\\(`, 'm');
  const TABLE_STEP_FUNCTIONS = ['pickDateFormatHint', 'isAmbiguousDateClassification', 'resolveAmbiguousDates',
    'datasetMaxMagnitude', 'classifiedCellPatches', 'tablePatches', 'applyPatches'];
  // Every hand-written JavaScript file the extension and the Sheets library
  // ship, outside the tests. The Sheets library itself is skipped: the Sheets
  // build writes it from these files, so it holds a copy of table.js by
  // construction, and the build check fails on any difference.
  const roots = [__dirname, path.join(__dirname, '..', 'js')];
  const GENERATED_NOTICE = '// Generated by the Sheets build: do not edit this file.';
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'tests' && entry.name !== 'node_modules') walk(full);
      } else if (entry.name.endsWith('.js') && !/tests?\.js$|doc-tests\.js$/.test(entry.name)
        && !fs.readFileSync(full, 'utf8').includes(GENERATED_NOTICE)) {
        files.push(full);
      }
    }
  };
  roots.forEach(walk);
  eq('table step source: the walk finds the extension\'s content script', files.some((f) => f.endsWith('content.js')), true);
  const declaredIn = (name) => files.filter((file) => DECL(name).test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(path.join(__dirname, '..'), file));
  eq('table step source: each function in lib/dr-simplify/table.js has one declaration in the repository',
    TABLE_STEP_FUNCTIONS.map((name) => [name, declaredIn(name)]),
    TABLE_STEP_FUNCTIONS.map((name) => [name, ['chrome-extension/lib/dr-simplify/table.js']]));
  eq('table step source: content.js calls no column post-pass or max magnitude rule outside the table step',
    [...new Set((contentSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      .match(/\b(pickDateFormatHint|resolveAmbiguousDates|findMaxMagnitude|roundDate|roundTime|pureNumberSpan)\s*\(/g) || []))], []);
})();
