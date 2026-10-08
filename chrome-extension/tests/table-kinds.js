// =============================================================================
// #524: table kind pairs. A native table and a grid are one product, so each
// table feature a page can use must give the same result in its native form
// and in its grid form. The design doc's "Table kind pairs" table is the one
// list of pairs: each row names a feature, its two forms, and its state. Each
// pair the list marks tested has a comparison test here, which draws the same
// values once as a native table and once as a grid, runs detection and the
// simplification on both, and compares what each one shows.
//
// A comparison checks three things: both tables are found or both are
// missed, the same cells change, and each changed cell reads the same text on
// both. Cells line up by row and grid column, so a feature that moves a cell
// on one kind shows as a difference. Each pair runs under the shipped
// defaults, and again with the first-row and first-column switches on and
// the top band rounding finer than the other band. The second run shows a
// difference the two exclusions hide, and a difference in the dataset: under
// the shipped defaults both bands round at the same offset, so the max
// magnitude changes no result.
//
// Invented values. The body values sit at magnitude 3 and the totals at
// magnitude 4, so a total that joins the dataset on one kind and stays out
// of it on the other changes how the body rounds.
// =============================================================================

const TK_STATES = ['same', 'different', 'not yet tested', 'no pair'];
const TK_TESTED_STATES = ['same', 'different'];

// Read the list from the design doc. Every failure to find it returns null,
// so a renamed heading or a reshaped row fails the run rather than leaving
// nothing to compare.
function tkReadPairList() {
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const lines = designMd.split('\n');
  const start = lines.findIndex((line) => line.trim() === '### Table kind pairs');
  if (start === -1) return null;
  const header = lines.findIndex((line, i) => i > start && line.startsWith('| Key |'));
  if (header === -1) return null;
  const columns = lines[header].split('|').slice(1, -1).map((cell) => cell.trim());
  const rows = [];
  for (let i = header + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i].split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== columns.length) return null;
    const row = {};
    columns.forEach((name, c) => { row[name] = cells[c]; });
    const key = /^`([a-z-]+)`$/.exec(row.Key);
    if (!key) return null;
    rows.push({ key: key[1], state: row.State, note: row.Note });
  }
  return rows.length > 0 ? rows : null;
}

// Common rows. A header row, two body rows, and a total row. The header
// pairs draw a header row whose last cell holds a count at magnitude 4, so a
// header row that joins the dataset on one kind and stays out of it on the
// other changes how the body rounds; every other pair draws the plain header
// row, so its own feature is the only thing that differs.
const TK_HEADER = [{ pieces: 'Region', header: 'col' }, { pieces: '2023', header: 'col' }, { pieces: '2024', header: 'col' }];
const TK_COUNTED_HEADER = TK_HEADER.concat([{ pieces: 'Target 25,000', header: 'col' }]);
const TK_COUNTED_BODY = [['North', '4,821', '9,187', '1,234'], ['South', '2,734', '6,051', '5,678']];
const TK_BODY = [['North', '4,821', '9,187'], ['South', '2,734', '6,051']];
const TK_TOTAL = ['Total', '17,555', '15,238'];
const tkLabelled = (rows) => rows.map(([label, ...values]) => [{ pieces: label, header: 'row' }].concat(values));

// One entry per tested pair: the sections both kinds draw, and the drawing
// options. A grid draws a section with grouped set inside a row group.
const TK_PAIRS = {
  'data-cell': {
    sections: [{ part: 'body', rows: TK_BODY, grouped: true }],
    opts: { gridRole: 'table', cellRole: 'cell' },
  },
  'grid-cell': {
    sections: [{ part: 'body', rows: TK_BODY, grouped: true }],
    opts: { gridRole: 'grid', cellRole: 'gridcell' },
  },
  'ungrouped-rows': {
    sections: [{ part: 'bare', rows: TK_BODY }],
  },
  'column-header': {
    sections: [{ part: 'head', rows: [TK_COUNTED_HEADER] }, { part: 'body', rows: TK_COUNTED_BODY, grouped: true }],
  },
  'head-group': {
    sections: [{ part: 'head', rows: [TK_COUNTED_HEADER], grouped: true }, { part: 'body', rows: TK_COUNTED_BODY, grouped: true }],
  },
  'header-row-in-body': {
    sections: [{ part: 'bare', rows: [TK_COUNTED_HEADER].concat(TK_COUNTED_BODY) }],
  },
  'row-header': {
    sections: [{ part: 'head', rows: [TK_HEADER] }, { part: 'body', rows: tkLabelled(TK_BODY), grouped: true }],
  },
  'corner-cell': {
    sections: [
      { part: 'head', rows: [[''].concat(TK_HEADER.slice(1))] },
      { part: 'body', rows: tkLabelled(TK_BODY), grouped: true },
    ],
  },
  'body-groups': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: TK_BODY.slice(0, 1), grouped: true },
      { part: 'body', rows: TK_BODY.slice(1), grouped: true },
    ],
  },
  'footer-row': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: TK_BODY, grouped: true },
      { part: 'foot', rows: [TK_TOTAL] },
    ],
  },
  'footer-group': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: TK_BODY, grouped: true },
      { part: 'foot', rows: [TK_TOTAL], grouped: true },
    ],
  },
  'merged-across': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: TK_BODY.concat([[{ pieces: 'Both regions', colSpan: 2 }, '15,238']]), grouped: true },
    ],
  },
  'merged-down': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: [[{ pieces: 'North', rowSpan: 2 }, '4,821', '9,187'], ['2,734', '6,051'], ['South', '3,906', '1,478']], grouped: true },
    ],
  },
  'caption': {
    sections: [{ part: 'head', rows: [TK_HEADER] }, { part: 'body', rows: TK_BODY, grouped: true }],
    opts: { caption: 'Units sold, 2023 to 2024: 45,678 in all' },
  },
  'hidden-row': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: TK_BODY.concat([{ cells: ['West', '17,555', '15,238'], hidden: true }]), grouped: true },
    ],
  },
  'hidden-cell': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: [TK_BODY[0], ['South', '2,734', { pieces: '17,555', hidden: true }]], grouped: true },
    ],
  },
  'hidden-fragment': {
    sections: [
      { part: 'head', rows: [TK_HEADER] },
      { part: 'body', rows: [TK_BODY[0], ['South', [{ tag: 'span', text: '000000002734', hidden: true }, '2,734'], '6,051']], grouped: true },
    ],
  },
};

const TK_SETTINGS = [
  { name: 'the shipped defaults', opts: Object.assign({}, DR_DEFAULTS) },
  { name: 'both switches on and a finer top band',
    opts: Object.assign({}, DR_DEFAULTS, {
      simplifyFirstRow: true, simplifyFirstColumn: true, offsetTop: -1, offsetOther: 0,
    }) },
];

// Every cell of a table, by row and grid column, with the text it holds.
function tkCellTexts(table) {
  const cells = [];
  makeAdapter(table).getRows().forEach((row, r) => {
    for (const cell of row.getCells()) cells.push({ at: `${r}:${cell.columnIndex}`, text: cell.el.textContent });
  });
  return cells;
}

// One kind's reading of one pair under one settings object: whether
// detection finds a data table, and each cell's text before and after the
// simplification.
function tkRead(kind, pair, settings) {
  let reading = null;
  withRewritePage(() => {
    const { table } = rwDrawTable(kind, pair.sections, pair.opts);
    const root = rwEl('div', {}, [table]);
    const handle = findTables(root).map((found) => found.handle).find((el) => isDataTable(el)) || null;
    if (!handle) { reading = { found: false }; return; }
    const before = tkCellTexts(handle);
    try {
      roundTableUnder(handle, settings);
      const after = tkCellTexts(handle);
      reading = {
        found: true,
        cells: after.map((cell, i) => ({
          at: cell.at, text: cell.text, changed: !before[i] || before[i].text !== cell.text,
        })),
      };
    } finally {
      resetTable(handle);
      forgetRegisteredTable(handle);
    }
  });
  return reading;
}

// The differences between the two kinds' readings, one line each. An empty
// list means the pair gives the same result.
function tkCompare(native, grid) {
  if (native.found !== grid.found) {
    return [`native ${native.found ? 'found' : 'missed'}, grid ${grid.found ? 'found' : 'missed'}`];
  }
  if (!native.found) return [];
  const differences = [];
  const gridAt = new Map(grid.cells.map((cell) => [cell.at, cell]));
  const nativeAt = new Map(native.cells.map((cell) => [cell.at, cell]));
  for (const cell of native.cells) {
    const other = gridAt.get(cell.at);
    if (!other) differences.push(`${cell.at}: grid has no cell`);
    else if (cell.changed !== other.changed || cell.text !== other.text) {
      differences.push(`${cell.at}: native "${cell.text}"${cell.changed ? ' (changed)' : ''}, grid "${other.text}"${other.changed ? ' (changed)' : ''}`);
    }
  }
  for (const cell of grid.cells) {
    if (!nativeAt.has(cell.at)) differences.push(`${cell.at}: native has no cell`);
  }
  return differences;
}

(function tablekinds_thePairListParses() {
  const list = tkReadPairList();
  eq('#524 the design doc holds the table kind pairs list', list !== null, true);
  if (!list) return;
  eq('#524 every pair in the list carries a known state',
    list.filter((row) => !TK_STATES.includes(row.state)).map((row) => row.key), []);
  eq('#524 every key in the list is unique',
    list.map((row) => row.key).filter((key, i, keys) => keys.indexOf(key) !== i), []);
  eq('#524 every pair the list marks tested has a comparison test',
    list.filter((row) => TK_TESTED_STATES.includes(row.state) && !TK_PAIRS[row.key]).map((row) => row.key), []);
  eq('#524 every comparison test has a pair the list marks tested',
    Object.keys(TK_PAIRS).filter((key) => !list.some((row) => row.key === key && TK_TESTED_STATES.includes(row.state))), []);
  eq('#524 every pair the list marks different links an issue or states what forces it',
    list.filter((row) => row.state === 'different' && !/#\d+|^Forced: \S/.test(row.note)).map((row) => row.key), []);
  eq('#524 every pair the list marks not yet tested or no pair carries a note',
    list.filter((row) => ['not yet tested', 'no pair'].includes(row.state) && !row.note).map((row) => row.key), []);
})();

(function tablekinds_eachPairMatchesItsRecordedState() {
  const list = tkReadPairList() || [];
  for (const row of list) {
    const pair = TK_PAIRS[row.key];
    if (!pair || !TK_TESTED_STATES.includes(row.state)) continue;
    const differences = [];
    for (const settings of TK_SETTINGS) {
      const native = tkRead('native', pair, settings.opts);
      const grid = tkRead('grid', pair, settings.opts);
      eq(`#524 ${row.key} under ${settings.name}: the native table is a data table, so the comparison is not vacuous`,
        native.found, true);
      differences.push(...tkCompare(native, grid).map((line) => `${settings.name}: ${line}`));
    }
    if (row.state === 'same') {
      eq(`#524 ${row.key}: the native table and the grid give the same result`, differences, []);
    } else {
      eq(`#524 ${row.key}: the recorded difference still shows; a fix updates the list to same`,
        differences.length > 0, true);
    }
  }
})();
