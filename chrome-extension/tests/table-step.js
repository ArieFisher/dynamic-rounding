// The table step (lib/dr-simplify/table.js): the column post-pass, the max
// magnitude over the dataset, and each cell's patches, run over plain
// classified cells with no page.
//
// The first sections load the number library and lib/dr-simplify alone, in a
// fresh context that holds no page, no browser, no registry, and no log
// buffer, and run the table step there. The later sections run the same cells
// through the one simplification pass on a native table and compare.

// The table step's settings for every case below: the offsets differ, so a
// cell's band shows in its result.
const TABLE_STEP_SETTINGS = {
  offsetTop: -0.5, offsetOther: -1, numTop: 1,
  dateGranularity: 'month', timeGranularity: 'hour',
};

const TABLE_STEP_LADDER_OPTS = Object.assign({}, DR_DEFAULTS, {
  simplifyFirstRow: true, simplifyFirstColumn: true,
  simplifyMixedCells: true, simplifyDates: true, simplifyTimes: true,
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
  tablePatches, classifyCell, decisionToLegacyInfo,
  globals: {
    document: typeof document, window: typeof window, chrome: typeof chrome,
    DR_STORE: typeof DR_STORE, DR_LOG: typeof DR_LOG,
  },
});`;
  return { files, api: vm.runInContext(source, context) };
}

// Classify each cell of a table through the ladder alone, as plain
// classified cells: text, info, and grid column.
function tableStepCells(api, rows) {
  const cells = [];
  rows.forEach((row, rowIndex) => row.forEach((text, columnIndex) => {
    const decision = api.classifyCell({ text, rowIndex, columnIndex, ranges: null }, TABLE_STEP_LADDER_OPTS);
    cells.push({ text, info: api.decisionToLegacyInfo(decision), col: columnIndex });
  }));
  return cells;
}

// A text with its patches applied, right to left so each patch keeps the
// position of the ones before it.
function applyTableStepPatches(text, patches) {
  return patches.slice().sort((a, b) => b.index - a.index).reduce((out, p) =>
    (out.slice(p.index, p.index + p.numStr.length) === p.numStr
      ? out.slice(0, p.index) + p.newNum + out.slice(p.index + p.numStr.length)
      : out + ' [patch missed at ' + p.index + ']'), text);
}

(function tableStep_loadsWithNoPage() {
  const loaded = loadTableStepAlone();
  eq('table step alone: the manifest lists lib/dr-simplify/table.js', loaded !== null, true);
  if (loaded === null) return;
  eq('table step alone: only the number library and lib/dr-simplify load',
    loaded.files.every((file) => /^lib\/dr-(number|simplify)\//.test(file)), true);
  eq('table step alone: the context holds no page, browser, registry, or log buffer',
    loaded.api.globals,
    { document: 'undefined', window: 'undefined', chrome: 'undefined', DR_STORE: 'undefined', DR_LOG: 'undefined' });
})();

(function tableStep_patchesForEachMode() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const result = api.tablePatches(tableStepCells(api, TABLE_STEP_ROWS), TABLE_STEP_SETTINGS);
  const at = (r, c) => result.cells[r * TABLE_STEP_ROWS[0].length + c];
  eq('table step alone: the max magnitude comes from every number in the dataset, extracted cells included',
    result.maxMag, 6);
  eq('table step alone: one result per cell, in input order',
    result.cells.map((cell) => cell.entry.text), TABLE_STEP_ROWS.flat());
  eq('table step alone: a pure cell takes one patch over its number span, after its leading whitespace',
    { patches: at(0, 0).patches, linkFilteredIdx: at(0, 0).linkFilteredIdx },
    { patches: [{ index: 1, numStr: '8,584,629', newNum: '8,500,000' }], linkFilteredIdx: null });
  eq('table step alone: an extracted cell with two numbers takes one patch per number, each in the other band',
    { patches: at(0, 1).patches, linkFilteredIdx: at(0, 1).linkFilteredIdx },
    { patches: [{ index: 8, numStr: '1,234', newNum: '1,200' }, { index: 18, numStr: '5,678', newNum: '5,700' }],
      linkFilteredIdx: [8, 18] });
  eq('table step alone: an extracted cell lists every number position for the link filter, a number with no change included',
    api.tablePatches([{ text: 'from 41 to 1,234', col: 0,
      info: api.decisionToLegacyInfo(api.classifyCell(
        { text: 'from 41 to 1,234', rowIndex: 1, columnIndex: 1, ranges: null }, TABLE_STEP_LADDER_OPTS)) }],
    TABLE_STEP_SETTINGS).cells[0].linkFilteredIdx,
    [5, 11]);
  eq('table step alone: the column post-pass reads an ambiguous date day-first in a day-first column',
    [at(0, 2).patches, at(2, 2).patches],
    [[{ index: 0, numStr: '3/4/2024', newNum: '4/2024' }], [{ index: 0, numStr: '3/4/2024', newNum: '4/2024' }]]);
  eq('table step alone: the column post-pass reads the same date month-first in a month-first column',
    [at(0, 3).patches, at(2, 3).patches],
    [[{ index: 0, numStr: '3/4/2024', newNum: '3/2024' }], [{ index: 0, numStr: '3/4/2024', newNum: '3/2024' }]]);
  eq('table step alone: the column post-pass settles the ambiguous dates in the cell entry',
    [at(0, 2).entry.info.ambiguous, at(0, 3).entry.info.ambiguous], [false, false]);
  eq('table step alone: a skip cell takes no patch',
    { mode: at(1, 0).entry.info.mode, patches: at(1, 0).patches, linkFilteredIdx: at(1, 0).linkFilteredIdx },
    { mode: 'skip', patches: [], linkFilteredIdx: null });
  eq('table step alone: a time cell takes one patch over its trimmed text',
    at(2, 0).patches, [{ index: 0, numStr: '10:47', newNum: '11:00' }]);
  eq('table step alone: each cell\'s text with its patches applied',
    result.cells.map((cell) => applyTableStepPatches(cell.entry.text, cell.patches)),
    TABLE_STEP_EXPECTED_ROWS.flat());
})();

(function tableStep_dateSpanIsTheTrimmedText() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, [['  2024-03-15 ']]);
  eq('table step alone: a date cell\'s patch covers its trimmed text, at the end of its leading whitespace',
    api.tablePatches(cells, TABLE_STEP_SETTINGS).cells[0].patches,
    [{ index: 2, numStr: '2024-03-15', newNum: '2024-03' }]);
})();

(function tableStep_unchangedValuesTakeNoPatch() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, [['8,500,000', '2096', 'Mar 2096']]);
  eq('table step alone: a number on its step, and a date with no day, take no patch',
    api.tablePatches(cells, TABLE_STEP_SETTINGS).cells.map((cell) => cell.patches), [[], [], []]);
  eq('table step alone: a pure cell whose display simplifies takes a patch',
    api.tablePatches(tableStepCells(api, [['35.0']]), TABLE_STEP_SETTINGS).cells[0].patches,
    [{ index: 0, numStr: '35.0', newNum: '35' }]);
})();

(function tableStep_leavesItsInputUnchanged() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, TABLE_STEP_ROWS).map((cell) => Object.assign({ carried: cell.col }, cell));
  const before = JSON.stringify(cells);
  const result = api.tablePatches(cells, TABLE_STEP_SETTINGS);
  eq('table step alone: the classified cells passed in stay unchanged', JSON.stringify(cells), before);
  eq('table step alone: every other field of a cell passes through to its entry',
    result.cells.every((cell, k) => cell.entry.carried === cells[k].col), true);
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
    frozen.cells[0].patches, [{ index: 1, numStr: '8,584,629', newNum: '8,600,000' }]);
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
    'function datasetMaxMagnitude() { throw new Error("the table step computed a max magnitude"); }\n' +
    'function findMaxMagnitude() { throw new Error("the table step computed a max magnitude"); }\n');
  if (loaded === null) return;
  const { api } = loaded;
  const cells = tableStepCells(api, TABLE_STEP_ROWS);
  const run = (frozenMaxMag) => {
    try { return api.tablePatches(cells, TABLE_STEP_SETTINGS, frozenMaxMag).maxMag; } catch (e) { return String(e.message); }
  };
  eq('table step, frozen max magnitude: with no frozen value the step computes one (the stub runs)',
    run(null), 'the table step computed a max magnitude');
  eq('table step, frozen max magnitude: with a frozen value the step computes none', run(6), 6);
})();

// --- The table step's patches are the patches the extension writes. ---

(function tableStep_matchesTheNativePass() {
  const loaded = loadTableStepAlone();
  if (loaded === null) return;
  const step = loaded.api.tablePatches(tableStepCells(loaded.api, TABLE_STEP_ROWS), TABLE_STEP_SETTINGS);
  const stepTexts = step.cells.map((cell) => applyTableStepPatches(cell.entry.text, cell.patches));
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

// --- The check that a changed date or time sits in one text piece. ---
//
// The table step returns a date or time cell's patch over its trimmed text;
// the pass drops the patch when no single text piece holds that span, and
// writes the kind's debug row. A date that sits in one piece beside a
// whitespace piece rounds.

const TABLE_STEP_DATE_SPLIT_ROW = /date or time split across text pieces stays unchanged/;

(function tableStep_dateAcrossTwoPiecesStaysUnchanged() {
  const passOpts = Object.assign({}, TABLE_STEP_LADDER_OPTS, TABLE_STEP_SETTINGS);
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const rowsBefore = rwRows('debug', TABLE_STEP_DATE_SPLIT_ROW);
    const t = build([
      [[{ tag: 'b', text: '2024-' }, { tag: 'b', text: '03-15' }], '1,234'],
      ['2024-04-20', '5,678'],
      [[{ tag: 'b', text: '2024-05-10' }, ' '], '2,468'],
    ]);
    roundTableUnder(t.table, passOpts);
    eq(`table step, date across two pieces (${kind}): each piece keeps its text`,
      t.pieces(0, 0).map((p) => p.nodeValue), ['2024-', '03-15']);
    eq(`table step, date across two pieces (${kind}): one debug row records the date left unchanged`,
      rwRows('debug', TABLE_STEP_DATE_SPLIT_ROW) - rowsBefore, 1);
    eq(`table step, date across two pieces (${kind}): the debug row names the table kind`,
      rwLogged.filter((row) => row.level === 'debug' && TABLE_STEP_DATE_SPLIT_ROW.test(row.text))
        .slice(-1).map((row) => row.text.includes(`a ${kind} cell date`)), [true]);
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
  const PAGE_NAMES = /\b(document|window|chrome|globalThis|DR_STORE|DR_LOG|DR_BUS|Node|NodeFilter|MutationObserver|querySelector\w*|createTreeWalker|getComputedStyle|innerText|textContent|nodeValue|childNodes|parentNode|parentElement|layout|layoutPieceHolding|cellObj|el)\b/g;
  eq('table step source: the code names no page, browser, registry, or log buffer, and no text piece',
    [...new Set(code.match(PAGE_NAMES) || [])], []);
})();

(function tableStep_oneDefinitionOfEachRule() {
  const contentSrc = sourceByName('content.js');
  const DECL = (name) => new RegExp(`^\\s*function\\s+${name}\\s*\\(`, 'm');
  const MOVED = ['decisionToLegacyInfo', 'resolveAmbiguousDates', 'datasetMaxMagnitude',
    'classifiedCellPatches', 'tablePatches'];
  eq('table step source: content.js declares none of the table step\'s functions',
    MOVED.filter((name) => DECL(name).test(contentSrc)), []);
  // Every JavaScript file the extension and the Sheets library ship, outside
  // the tests.
  const roots = [__dirname, path.join(__dirname, '..', 'js')];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'tests' && entry.name !== 'node_modules') walk(full);
      } else if (entry.name.endsWith('.js') && !/tests?\.js$|doc-tests\.js$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  roots.forEach(walk);
  eq('table step source: the walk finds the extension\'s content script', files.some((f) => f.endsWith('content.js')), true);
  const declaredIn = (name) => files.filter((file) => DECL(name).test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(path.join(__dirname, '..'), file));
  eq('table step source: each table step function has one declaration in the repository',
    MOVED.map((name) => [name, declaredIn(name)]),
    MOVED.map((name) => [name, ['chrome-extension/lib/dr-simplify/table.js']]));
  // The page-free part of a cell's patches: content.js's cellPatches holds
  // none of the rounding or formatting calls the table step makes.
  const body = sourceBodyOf(contentSrc, 'function cellPatches(');
  eq('table step source: content.js declares cellPatches', body !== '', true);
  const ROUNDING_CALLS = /\b(roundCellSetAware|formatNumber|roundDateText|roundTimeText|pureNumberSpan|findMaxMagnitude|pickDateFormatHint|resolveAmbiguousDateDecision)\s*\(/g;
  eq('table step source: content.js\'s cellPatches makes no rounding or formatting call',
    (body || '').match(ROUNDING_CALLS) || [], []);
  eq('table step source: content.js calls no column post-pass or max magnitude rule outside the table step',
    [...new Set((contentSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      .match(/\b(pickDateFormatHint|resolveAmbiguousDateDecision|findMaxMagnitude|roundDateText|roundTimeText|pureNumberSpan)\s*\(/g) || []))], []);
})();
