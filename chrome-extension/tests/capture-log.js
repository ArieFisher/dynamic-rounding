// The capture, the log buffer, and the toast (lib/dr-capture, lib/dr-log, ui-toast.js).

(function gridPatch_captureCarriesTheRecordValue() {
  const { grid } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const state = collectCaptureState({ store: DR_STORE, adapterFor: (t) => makeAdapter(t) });
    const tableRec = state.tables[DR_STORE.getRegisteredTables().indexOf(grid.wrapperEl)];
    const cellRec = tableRec.cells.find((cell) => cell.row === 0 && cell.col === 0);
    eq('grid patch capture: a patched grid cell carries its original text',
      cellRec.original, ' 8,584,629 ');
    const html = DR_CAPTURE.buildCaptureDocument({
      state: {
        captureFormat: 6,
        meta: { url: 'https://www.example.com/grid', title: 'G', version: '2.1.70',
          platform: 'test', at: '2026-09-22T16:00:00.000Z' },
        mark: 'looks-right', remarks: '', settings: { enabled: true }, detectionSettings: null,
        activeTableIndex: 0, tables: [tableRec], lensPreview: null, fixtureSeed: null,
        sidebarView: null, errorState: { hasError: false, count: 0, rows: [] },
        log: { content: { entries: [], dropped: 0, limit: 50 }, sidebar: { entries: [], dropped: 0, limit: 50 } },
      },
      lockedStatusText: '',
    });
    const originalsTable = (html.split('with the originals')[1] || '').split('</table>')[0];
    eq('grid patch capture: the originals rendering shows the cell\'s original',
      /<td[^>]*>\s*8,584,629\s*<\/td>/.test(originalsTable), true);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// The grid cell's write: it returns how many patches landed, and records the
// cell on a landed patch. The no-piece case sits with the form honesty tests.
(function gridPatch_applyPatchesReturnsAndRecords() {
  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const port = makePort();
  const adapter = new GridAdapter({}, { originalsPort: port });
  if (typeof adapter._makeCellObj(makeElementNode('', [])).applyPatches !== 'function') {
    eq('grid patch write: the grid cell object exposes applyPatches', false, true);
    return;
  }

  const el = makeGridCellWithTextNode('A 100 B 200');
  const cellObj = adapter._makeCellObj(el);
  eq('grid patch write: the write returns its landed count',
    cellObj.applyPatches([
      { index: 2, numStr: '100', newNum: '90' },
      { index: 8, numStr: '999', newNum: '1,000' },
    ]), 1);
  eq('grid patch write: the landed patch changes its piece',
    el.childNodes[0].nodeValue, 'A 90 B 200');
  eq('grid patch write: the first landed write stores the record',
    port.get(el),
    { value: 'A 100 B 200', pieces: [{ text: 'A 100 B 200', written: 'A 90 B 200' }], supRanges: null, linkFilteredIdx: null });

  // A later write counts its patches in the join of the stored originals,
  // keeps each piece's original, and records each piece's new written text.
  // A piece the later write leaves at its original goes back to it.
  const twoEl = makeElementNode('', [makeTextNode('100'), makeTextNode(' 200')]);
  const two = adapter._makeCellObj(twoEl);
  two.applyPatches([{ index: 0, numStr: '100', newNum: '90' }]);
  two.applyPatches([{ index: 4, numStr: '200', newNum: '250' }]);
  eq('grid patch write: a later write records each piece\'s original and its new written text',
    port.get(twoEl).pieces, [{ text: '100', written: '100' }, { text: ' 200', written: ' 250' }]);
  eq('grid patch write: the later write gives each piece its target text',
    twoEl.childNodes.map((node) => node.nodeValue), ['100', ' 250']);
})();

// --- lib/dr-capture: the capture state serializer ---
//
// collectCaptureState() turns the registry into the plain-value capture
// state: every registered table in full detail, plus the bound table's raw
// markup as the fixture seed. Dependencies arrive as parameters with working
// defaults (deps.store, deps.adapterFor), so these tests drive the function
// with stand-ins and no DOM. Locked honesty is pinned here: a cell wearing
// the rounded marker with no stored original serializes as original: null
// and flips the table's locked flag — never a reconstructed value.

(function captureStateSerializer() {
  eq('capture-state: collectCaptureState loads in the content-script bundle',
    typeof globalThis.collectCaptureState, 'function');
  if (typeof globalThis.collectCaptureState !== 'function') return;

  const markerClassList = (marked) => ({ contains: (c) => marked && c === 'dr-ext-rounded' });
  const makeCellEl = (marked) => ({ classList: markerClassList(marked) });

  // A fake store: tables and per-cell originals handed in as Maps.
  const makeFakeStore = (tables, opts) => ({
    getRegisteredTables: () => tables,
    getSelectedTable: () => (opts && opts.selected) || null,
    getSettings: () => ({ enabled: true, offsetTop: -0.5 }),
    getErrorState: () => (opts && opts.errorState) || { hasError: false, count: 0, rows: [] },
    getTableAppliedFlag: (t) => (opts && opts.flags && opts.flags.get(t)) || 'original',
    getTableRoundOptions: (t) => (opts && opts.roundOptions && opts.roundOptions.get(t)) || null,
    getTableMaxMagnitude: (t) => {
      const m = opts && opts.maxMags && opts.maxMags.get(t);
      return m === undefined ? null : m;
    },
    getTableOriginalText: (t, cellEl) =>
      opts && opts.originals ? opts.originals.get(cellEl) : undefined,
  });

  // A fake adapter factory: each table object carries its own row spec.
  const fakeAdapterFor = (table) => ({
    isVirtualized: () => !!table._virtualized,
    getRows: () => table._rows.map((row) => ({
      isOutside: !!row.isOutside,
      // columnIndex and columnSpan are part of the adapter's cell contract
      // (see assignGridColumns); this spec declares no merge, so each cell
      // sits at its read position and covers one column.
      getCells: () => row.cells.map((cell, c) => ({
        el: cell.el,
        tagName: cell.tagName || 'TD',
        columnIndex: c,
        columnSpan: 1,
        getDisplayedText: () => cell.text,
      })),
    })),
  });

  // Table A: native, simplified, one header row + one data row (ragged).
  const a1 = makeCellEl(true);
  const tableA = {
    outerHTML: '<table><tr><td>99,000</td></tr></table>',
    _rows: [
      { cells: [{ el: makeCellEl(false), tagName: 'TH', text: 'Amount' }] },
      { cells: [
        { el: a1, text: '99,000' },
        { el: makeCellEl(false), text: 'n/a' },
      ] },
      { isOutside: true, cells: [{ el: makeCellEl(false), text: 'Total' }] },
    ],
  };
  // Table B: virtualized grid, untouched.
  const tableB = {
    _virtualized: true,
    _rows: [{ cells: [{ el: makeCellEl(false), text: '42' }] }],
  };

  const originals = new Map([[a1, '98,765']]);
  const flags = new Map([[tableA, 'simplified']]);
  const roundOptions = new Map([[tableA, { offsetTop: -1, enabled: true }]]);
  const maxMags = new Map([[tableB, 4]]);
  const store = makeFakeStore([tableA, tableB],
    { selected: tableA, originals, flags, roundOptions, maxMags });

  const state = collectCaptureState({ store, adapterFor: fakeAdapterFor });

  eq('capture-state: the state carries its format version', state.captureFormat, 6);
  eq('capture-state: the settings record is carried verbatim',
    state.settings, { enabled: true, offsetTop: -0.5 });
  eq('capture-state: every registered table is serialized', state.tables.length, 2);
  eq('capture-state: the bound table is found by index', state.activeTableIndex, 0);
  eq('capture-state: the fixture seed is the bound table\'s markup at capture time, verbatim',
    state.fixtureSeed, '<table><tr><td>99,000</td></tr></table>');

  const recA = state.tables[0];
  eq('capture-state: per-table detail (kind, appliedFlag, lastRoundOptions, maxMagnitude, counts)',
    {
      kind: recA.kind, appliedFlag: recA.appliedFlag,
      lastRoundOptions: recA.lastRoundOptions, maxMagnitude: recA.maxMagnitude,
      rowCount: recA.rowCount, columnCount: recA.columnCount,
    },
    {
      kind: 'native', appliedFlag: 'simplified',
      lastRoundOptions: { offsetTop: -1, enabled: true }, maxMagnitude: null,
      rowCount: 3, columnCount: 2,
    });
  eq('capture-state: a header cell serializes with role th',
    recA.cells[0],
    { row: 0, col: 0, role: 'th', isOutside: false, text: 'Amount', original: null, wearsMarker: false });
  eq('capture-state: a simplified cell carries displayed text AND its original',
    recA.cells[1],
    { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765', wearsMarker: true });
  eq('capture-state: a cell with no stored original serializes original: null',
    recA.cells[2].original, null);
  eq('capture-state: an outside row keeps its flag',
    recA.cells[3].isOutside, true);
  eq('capture-state: a marked cell WITH its original does not lock the table',
    recA.locked, false);

  const recB = state.tables[1];
  eq('capture-state: a virtualized grid serializes as kind grid with its frozen magnitude',
    { kind: recB.kind, maxMagnitude: recB.maxMagnitude }, { kind: 'grid', maxMagnitude: 4 });

  // Locked honesty: the marker with no original behind it.
  const lockedCell = makeCellEl(true);
  const tableL = { _rows: [{ cells: [{ el: lockedCell, text: '99,000' }] }] };
  const lockedState = collectCaptureState({
    store: makeFakeStore([tableL], {}),
    adapterFor: fakeAdapterFor,
  });
  eq('capture-state: a rounded marker with no stored original locks the table and stays null',
    { locked: lockedState.tables[0].locked, original: lockedState.tables[0].cells[0].original },
    { locked: true, original: null });

  // Empty registry: an honest nothing.
  const emptyState = collectCaptureState({
    store: makeFakeStore([], {}),
    adapterFor: fakeAdapterFor,
  });
  eq('capture-state: an empty registry serializes as no tables, no focus, no seed',
    { tables: emptyState.tables, activeTableIndex: emptyState.activeTableIndex, fixtureSeed: emptyState.fixtureSeed },
    { tables: [], activeTableIndex: null, fixtureSeed: null });

  // A capture is a bug report: one table whose walk throws must not take
  // the whole capture down. It serializes as an error record instead.
  const throwingAdapterFor = () => ({
    isVirtualized: () => false,
    getRows: () => { throw new Error('hostile walk'); },
  });
  const errState = collectCaptureState({
    store: makeFakeStore([{}, tableB], {}),
    adapterFor: (t) => (t === tableB ? fakeAdapterFor(t) : throwingAdapterFor()),
  });
  eq('capture-state: a table whose walk throws serializes as an error record',
    {
      kind: errState.tables[0].kind,
      cells: errState.tables[0].cells,
      hasError: /hostile walk/.test(errState.tables[0].error),
    },
    { kind: 'unknown', cells: [], hasError: true });
  eq('capture-state: the tables after a throwing one still serialize in full',
    errState.tables[1].cells.length, 1);
})();

// The per-cell marker flag reaches the cell record (#304). The serializer
// already reads the rounded marker to compute the locked pairing; the
// renderer needs it per cell to tell a lost original (marker, original: null)
// from a cell that was never rounded (no marker, original: null).
(function captureStateCarriesMarkerFlag() {
  if (typeof globalThis.collectCaptureState !== 'function') return;

  const markerClassList = (marked) => ({ contains: (c) => marked && c === 'dr-ext-rounded' });
  const makeCellEl = (marked) => ({ classList: markerClassList(marked) });

  const marked = makeCellEl(true);
  const unmarked = makeCellEl(false);
  const lost = makeCellEl(true);
  const table = { _rows: [{ cells: [
    { el: marked, text: '99,000' },
    { el: unmarked, text: 'Amount' },
    { el: lost, text: '99,000' },
  ] }] };
  const store = {
    getRegisteredTables: () => [table],
    getSelectedTable: () => null,
    getSettings: () => ({}),
    getErrorState: () => ({ hasError: false, count: 0, rows: [] }),
    getTableAppliedFlag: () => 'simplified',
    getTableRoundOptions: () => null,
    getTableMaxMagnitude: () => null,
    getTableOriginalText: (t, cellEl) => (cellEl === marked ? '98,765' : undefined),
  };
  const adapterFor = () => ({
    isVirtualized: () => false,
    getRows: () => table._rows.map((row) => ({
      isOutside: false,
      getCells: () => row.cells.map((cell) => ({
        el: cell.el,
        tagName: 'TD',
        getDisplayedText: () => cell.text,
      })),
    })),
  });

  const cells = collectCaptureState({ store, adapterFor }).tables[0].cells;
  eq('capture-state: a marked cell record carries wearsMarker true beside its original',
    { wearsMarker: cells[0].wearsMarker, original: cells[0].original },
    { wearsMarker: true, original: '98,765' });
  eq('capture-state: an unmarked cell record carries wearsMarker false',
    { wearsMarker: cells[1].wearsMarker, original: cells[1].original },
    { wearsMarker: false, original: null });
  eq('capture-state: a lost original keeps the locked pairing readable per cell',
    { wearsMarker: cells[2].wearsMarker, original: cells[2].original },
    { wearsMarker: true, original: null });
})();

// --- lib/dr-capture: the capture file renderer ---
//
// buildCaptureDocument() is a pure string renderer: the whole capture state
// in, one self-contained HTML document out. The safety doctrine (after the
// model extension's, adapted for string assembly): every dynamic value
// passes through one escape on its way in; the file declares a CSP that
// forbids scripts and remote fetches; a hidden pre holds the full state as
// escaped JSON (a script-typed island would let an end-tag in a payload
// break out); and the capture carries the fixture seed twice — visible
// escaped text for reading, JSON for byte-exact trust. These tests attack
// the escaping with hostile payloads and round-trip the island.

(function captureRenderer() {
  eq('capture-render: the DR_CAPTURE package loads in the content-script bundle',
    typeof globalThis.DR_CAPTURE, 'object');
  eq('capture-render: manifest loads the dr-capture package whole and in order',
    contentScriptFiles.indexOf('lib/dr-capture/state.js') !== -1 &&
      contentScriptFiles.indexOf('lib/dr-capture/render.js') ===
        contentScriptFiles.indexOf('lib/dr-capture/state.js') + 1 &&
      contentScriptFiles.indexOf('lib/dr-capture/index.js') ===
        contentScriptFiles.indexOf('lib/dr-capture/render.js') + 1,
    true);
  const sidebarHtmlForCapture = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('capture-render: sidebar.html loads the dr-capture package before sidebar.js',
    ['lib/dr-capture/state.js', 'lib/dr-capture/render.js', 'lib/dr-capture/index.js']
      .every((f) => sidebarHtmlForCapture.indexOf(f) !== -1 &&
        sidebarHtmlForCapture.indexOf(f) < sidebarHtmlForCapture.indexOf('"sidebar.js"')),
    true);
  if (typeof globalThis.DR_CAPTURE !== 'object') return;

  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const filenameFor = DR_CAPTURE.filenameFor;
  const LOCKED_TEXT = 'This table\'s original values are no longer available. Reload the page to change it.';

  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: {
      url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z',
    },
    mark: 'looks-right',
    remarks: 'rounded to 99,000\nbut the page stayed 98,765',
    settings: { enabled: true },
    activeTableIndex: 0,
    tables: [{
      kind: 'native', appliedFlag: 'simplified', lastRoundOptions: { offsetTop: -0.5 },
      maxMagnitude: null, locked: false, rowCount: 2, columnCount: 1,
      cells: [
        { row: 0, col: 0, role: 'th', isOutside: false, text: 'Amount', original: null },
        { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765' },
      ],
    }],
    lensPreview: { samples: { top: [{ original: '98,765', num: 98765 }], bottom: [] }, maxMag: 4 },
    sidebarView: {
      enabled: true,
      switches: { simplifyMixedCells: true, simplifyDates: false },
      dateGranularity: 'year', timeGranularity: 'hour', rangeExpr: '',
      stops: [-2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1],
      topVal: -0.5, botVal: -0.5, coupled: true,
      status: '', noTable: false, locked: false,
      lensPreview: { top: ['98,765'], bottom: [] },
    },
    log: {
      content: {
        entries: [{ at: '2026-09-09T18:00:00.000Z', level: 'debug', text: 'apply ran' }],
        dropped: 0, limit: 50,
      },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
    fixtureSeed: '<table><tr><td>98,765</td></tr></table>',
  }, over || {});

  // Extract and parse the hidden JSON island the way a consuming tool does:
  // take the pre's text, undo the HTML escaping (ampersand last), JSON.parse.
  const islandJson = (docHtml) => {
    const m = docHtml.match(/<pre id="capture-state" hidden>([\s\S]*?)<\/pre>/);
    if (!m) return null;
    return JSON.parse(m[1]
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&'));
  };

  const html = buildCaptureDocument({ state: makeState(), lockedStatusText: LOCKED_TEXT });

// --- The capture rendering places a cell under its own column ---

(function theCaptureRenderingPlacesACellAtItsColumn() {
  // A total row merged across the first two columns: one header row of three
  // cells, then a row holding a label at column 0 and the total at column 2.
  const merged = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: {},
        maxMagnitude: null, locked: false, rowCount: 2, columnCount: 3,
        cells: [
          { row: 0, col: 0, role: 'th', isOutside: false, text: 'Product', original: null },
          { row: 0, col: 1, role: 'th', isOutside: false, text: 'Units', original: null },
          { row: 0, col: 2, role: 'th', isOutside: false, text: 'Revenue', original: null },
          { row: 1, col: 0, role: 'th', isOutside: false, text: 'Total', original: null },
          { row: 1, col: 2, role: 'td', isOutside: false, text: '1,000,000', original: '1,140,043' },
        ],
      }],
    }),
    lockedStatusText: '',
  });
  const rows = merged.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  eq('#330: a cell the state records at a later column renders under that column',
    rows[1], '<tr><th>Total</th><td></td><td class="cap-simplified" ' +
      'title="Original: 1,140,043">1,000,000</td></tr>');
  eq('#330: a row whose cells fill every column renders unchanged',
    rows[0], '<tr><th>Product</th><th>Units</th><th>Revenue</th></tr>');
})();

(function theCaptureRenderingPadsEveryRowToTheTableWidth() {
  // A total row merged across all three columns, and a row the state holds
  // no cell for at all.
  const padded = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: {},
        maxMagnitude: null, locked: false, rowCount: 3, columnCount: 3,
        cells: [
          { row: 0, col: 0, role: 'th', isOutside: false, text: 'Product', original: null },
          { row: 0, col: 1, role: 'th', isOutside: false, text: 'Units', original: null },
          { row: 0, col: 2, role: 'th', isOutside: false, text: 'Revenue', original: null },
          { row: 2, col: 0, role: 'th', isOutside: false, text: 'Total', original: null },
        ],
      }],
    }),
    lockedStatusText: '',
  });
  const rows = padded.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  eq('#330: the columns a merge covers render blank even at the table\'s right edge',
    rows[2], '<tr><th>Total</th><td></td><td></td></tr>');
  eq('#330: a row the state holds no cell for still renders',
    rows[1], '<tr><td></td><td></td><td></td></tr>');
})();

  eq('capture-render: the CSP forbids scripts and remote fetches',
    /http-equiv="Content-Security-Policy"[^>]*script-src 'none'/.test(html) &&
      /img-src data:/.test(html), true);
  // The capture is itself a page with a real table, and with file access
  // enabled Chrome injects the extension's content scripts into it. The
  // document element carries the capture marker so the content script
  // stands down on capture pages — otherwise the extension rounds the
  // capture's own table and the file misreports the evidence it holds.
  eq('capture-render: the document element carries the capture marker',
    /<html lang="en" data-dr-capture="1">/.test(html), true);
  eq('capture-render: the file carries no script element at all',
    html.toLowerCase().includes('<script'), false);
  eq('capture-render: the mark shows as its glyph and is stored as its token',
    html.includes('\u{1F44D}') && islandJson(html).mark, 'looks-right');
  // The visible word is derived from the token, so no second word list exists.
  eq('capture-render: the mark renders its word beside the glyph',
    html.includes('<span>Looks right</span>'), true);
  eq('capture-render: the island carries the remarks under the remarks key and no note key',
    islandJson(html).remarks === 'rounded to 99,000\nbut the page stayed 98,765' &&
      !('note' in islandJson(html)), true);
  eq('capture-render: header facts are present',
    ['https://www.example.com/prices', '2.1.50', 'test-platform', '2026-09-09T18:00:00.000Z']
      .every((s) => html.includes(s)), true);
  eq('capture-render: the remarks render under their label',
    html.includes('Remarks:') && html.includes('rounded to 99,000'), true);
  eq('capture-render: a simplified cell shows its value with the original on hover',
    /<td[^>]*title="Original: 98,765"[^>]*>99,000<\/td>/.test(html), true);
  eq('capture-render: the bound table renders a second time with the originals',
    /with the originals/.test(html) &&
      /<td[^>]*>98,765<\/td>/.test(html), true);
  eq('capture-render: the table renderings state the span limit',
    html.includes('Cell spans are not recorded') &&
      html.includes('the columns it covers render blank'), true);
  eq('capture-render: the likeness shows both thumbs when the lens control is coupled',
    (html.match(/class="cap-thumb/g) || []).length, 2);
  eq('capture-render: the coupled heading names the shared value',
    html.includes('Lens control (coupled, both at -0.5)'), true);
  eq('capture-render: the registry section lists every table with the bound one marked',
    /<h2>Registry<\/h2>/.test(html) &&
      /native[\s\S]{0,120}bound/.test(html), true);
  eq('capture-render: the retired word for the bound table never renders',
    /<b>focused<\/b>/.test(html) || /focused table/.test(html), false);
  eq('capture-render: the seed intro names the bound table and capture time',
    html.includes('bound table’s markup as it stood at capture time'), true);
  eq('capture-render: the footer names the state block without a how-to sentence',
    html.includes('holds the full capture state') &&
      !html.includes('To extract the state'), true);
  eq('capture-render: the island round-trips the whole state',
    islandJson(html).tables[0].cells[1],
    { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765' });

  // Hostile payloads: cell text and title attribute.
  const hostile = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: null,
        maxMagnitude: null, locked: false, rowCount: 1, columnCount: 1,
        cells: [{
          row: 0, col: 0, role: 'td', isOutside: false,
          text: '"><img src=x onerror=alert(1)>',
          original: 'a"b<c>&d\'e',
        }],
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: hostile cell text appears only escaped',
    hostile.includes('<img'), false);
  eq('capture-render: hostile cell text is still readable in its escaped form',
    hostile.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'), true);
  eq('capture-render: a hostile original cannot break out of the title attribute',
    /title="Original: a&quot;b&lt;c&gt;&amp;d&#39;e"/.test(hostile), true);

  // Hostile fixture seed: an end-tag for the island's own pre plus a script
  // element, with a carriage return JSON must carry byte-exact.
  const hostileSeed = '</pre><script>alert(1)</script>\r\n<table><tr><td>1</td></tr></table>';
  const seeded = buildCaptureDocument({
    state: makeState({ fixtureSeed: hostileSeed }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a hostile seed cannot break out of the island or add a script',
    seeded.toLowerCase().includes('<script'), false);
  eq('capture-render: the island returns the hostile seed byte-exact',
    islandJson(seeded).fixtureSeed, hostileSeed);

  // Locked table: the wording arrives as a value (no third copy) and renders.
  const locked = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: null,
        maxMagnitude: null, locked: true, rowCount: 1, columnCount: 1,
        cells: [{ row: 0, col: 0, role: 'td', isOutside: false, text: '99,000', original: null }],
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a locked table renders the locked wording passed in as a value',
    locked.includes('This table&#39;s original values are no longer available'), true);

  // Console section: both contexts labeled; an empty buffer is a finding.
  eq('capture-render: both log sections render, and an empty one says so',
    html.includes('Content script') && html.includes('Sidebar') &&
      html.includes('Nothing was logged.'), true);

  // No table bound: the capture stays honest instead of refusing.
  const unbound = buildCaptureDocument({
    state: makeState({ activeTableIndex: null, tables: [], fixtureSeed: null }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: an unbound capture says no table was bound',
    unbound.includes('No table was bound'), true);
  eq('capture-render: an unbound capture says it carries no fixture seed',
    unbound.includes('No fixture seed'), true);

  // Filename: compact date first (sorts by day), then the source, then the
  // time (a second capture is a new file), then the mark token, so a folder
  // listing shows each file's verdict without opening the file.
  const at = new Date(2026, 8, 9, 14, 5, 6);
  eq('capture-render: the filename is compact-date first, source-slugged, time, then the mark',
    filenameFor({ at, url: 'https://www.example.com/prices', mark: 'looks-right' }),
    'dr-capture-20260909-example-com-140506-looks-right.html');
  // A page opened from disk has no host; its file name stands in for it.
  eq('capture-render: a file URL names the page file without its extension',
    filenameFor({ at, url: 'file:///Users/me/Projects/tables.html', mark: 'not-sure' }),
    'dr-capture-20260909-tables-140506-not-sure.html');
  eq('capture-render: a percent-encoded file name decodes before slugging',
    filenameFor({ at, url: 'file:///Users/me/My%20Table.html', mark: 'looks-wrong' }),
    'dr-capture-20260909-my-table-140506-looks-wrong.html');
  eq('capture-render: a file URL with no file name gets the no-source slug',
    filenameFor({ at, url: 'file:///', mark: 'looks-wrong' }),
    'dr-capture-20260909-no-source-140506-looks-wrong.html');
  eq('capture-render: a capture with no page url gets the no-source slug',
    filenameFor({ at, url: null, mark: 'looks-wrong' }),
    'dr-capture-20260909-no-source-140506-looks-wrong.html');
  eq('capture-render: an unparsable url gets the no-source slug',
    filenameFor({ at, url: 'not a url', mark: 'looks-wrong' }),
    'dr-capture-20260909-no-source-140506-looks-wrong.html');
  eq('capture-render: each mark token ends the name before .html',
    ['looks-right', 'not-sure', 'looks-wrong'].map((mark) =>
      filenameFor({ at, url: 'https://example.com/', mark }).replace(/^.*-140506-/, '')),
    ['looks-right.html', 'not-sure.html', 'looks-wrong.html']);
  // The mark reaches the name through the same reducer as the source, so a
  // value outside the three tokens cannot carry a path separator into it.
  eq('capture-render: a mark outside the three tokens is reduced like the source',
    filenameFor({ at, url: 'https://example.com/', mark: '../x' }),
    'dr-capture-20260909-example-com-140506-x.html');
})();

// --- lib/dr-capture: the file reads top to bottom ---
//
// The header is a header: the title and a small muted list of facts. The
// mark and the remarks share the first section under it. The sidebar
// likeness comes before the bound table, so the file reads in the order a
// reader reconstructs the scene: what the controls said, then what the page
// showed. A thin line separates every top-level section. A reader hint (a
// note) is one size below the table text, italic, and opens with "Note: ",
// so it never reads as content; the lens preview lines are content.
(function captureLayout() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z' },
    mark: 'looks-wrong',
    remarks: 'the total rounded away',
    settings: { enabled: true },
    activeTableIndex: 0,
    tables: [{
      kind: 'native', appliedFlag: 'simplified', lastRoundOptions: { offsetTop: -0.5 },
      maxMagnitude: null, locked: false, rowCount: 2, columnCount: 1,
      cells: [
        { row: 0, col: 0, role: 'th', isOutside: false, text: 'Amount', original: null },
        { row: 1, col: 0, role: 'td', isOutside: false, text: '99,000', original: '98,765' },
      ],
    }],
    lensPreview: null,
    sidebarView: {
      enabled: true, switches: {}, dateGranularity: 'year', timeGranularity: 'hour',
      rangeExpr: '', stops: [-1, 0, 1], topVal: 0, botVal: 0, coupled: true,
      status: '', noTable: false, locked: false,
      lensPreview: { top: ['98,765'], bottom: [] },
    },
    log: {
      content: { entries: [], dropped: 0, limit: 50 },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
    fixtureSeed: '<table><tr><td>98,765</td></tr></table>',
  }, over || {});
  const html = buildCaptureDocument({ state: makeState(), lockedStatusText: '' });
  const header = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));

  // The whole header shape is pinned, so no sentence re-enters it unseen.
  eq('capture-render: the header holds the title and the meta list, and nothing else',
    /^<header><h1>[^<]*<\/h1><dl class="cap-meta">(?:<dt>[^<]*<\/dt><dd>[^<]*<\/dd>)+<\/dl>$/
      .test(header) && html.includes('.cap-meta { font-size: 12px'), true);
  eq('capture-render: the header carries neither the mark nor the remarks',
    header.includes('cap-mark') || header.includes('Remarks:'), false);
  eq('capture-render: the mark and the remarks share one section directly under the header',
    /<\/header><main><section class="cap-remarks"><p class="cap-mark">[\s\S]{0,120}<b>Remarks:<\/b> the total rounded away/
      .test(html), true);
  eq('capture-render: the mark renders its glyph and word in the remarks section',
    /<section class="cap-remarks"><p class="cap-mark">\u{1F44E} <span>Looks wrong<\/span>/u.test(html), true);
  const order = ['<h2>Sidebar</h2>', '<h2>Bound table</h2>', '<h2>Registry</h2>',
    '<h2>Detection settings</h2>', '<h2>Extension logs</h2>', '<h2>Fixture seed</h2>']
    .map((h) => html.indexOf(h));
  eq('capture-render: the file reads sidebar, bound table, registry, detection settings, logs, seed',
    order.every((i, n) => i !== -1 && (n === 0 || i > order[n - 1])), true);
  eq('capture-render: the likeness and the table no longer sit side by side',
    html.includes('cap-visual') || html.includes('Sidebar (rendered open)'), false);
  eq('capture-render: a thin line separates each top-level section',
    html.includes('main > section { border-top: 1px solid #ddd'), true);
  eq('capture-render: a note is one size below the table text, italic, and prefixed',
    html.includes('.cap-note { font-size: 13px; font-style: italic') &&
      html.includes('<p class="cap-note">Note: Hover a dotted cell to see its original.</p>'), true);
  eq('capture-render: every reader hint renders as a note',
    (html.match(/<p class="cap-note">Note: /g) || []).length, 4);
  const unbound = buildCaptureDocument({
    state: makeState({ activeTableIndex: null, tables: [], fixtureSeed: null }),
    lockedStatusText: '',
  });
  eq('capture-render: an unbound capture carries the one note that always applies',
    (unbound.match(/<p class="cap-note">Note: /g) || []).length === 1 &&
      unbound.includes('Note: Service worker rows are not captured.'), true);
  eq('capture-render: lens preview lines are content, not notes',
    /<div class="cap-band">98,765<\/div>/.test(html), true);
  eq('capture-render: an absence is never a note',
    unbound.includes('<p class="cap-empty">No table was bound'), true);
})();

// --- lib/dr-capture: the screenshot section ---
//
// The sidebar takes a screenshot of the bound tab at finish and hands the
// image to the renderer beside the state, never inside it: the state holds
// a small record (taken, format, size) and the JSON island stays small. The
// image reaches the file only as an image data URL; anything else, a failed
// take, or no record at all renders as an absence with its reason.
(function captureScreenshotSection() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z' },
    mark: 'looks-wrong', remarks: '', settings: { enabled: true }, detectionSettings: null,
    activeTableIndex: null, tables: [], lensPreview: null, fixtureSeed: null,
    sidebarView: null, errorState: null,
    log: { content: null, sidebar: { entries: [], dropped: 0, limit: 50 } },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
  }, over || {});
  const islandOf = (docHtml) => {
    const m = docHtml.match(/<pre id="capture-state" hidden>([\s\S]*?)<\/pre>/);
    return m ? m[1] : '';
  };
  const islandJson = (docHtml) => JSON.parse(islandOf(docHtml)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'));

  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==';
  const taken = { taken: true, format: 'jpeg', chars: jpeg.length };
  const html = buildCaptureDocument({
    state: makeState({ screenshot: taken }), lockedStatusText: '', screenshotDataUrl: jpeg,
  });
  eq('capture-render: the screenshot renders as an image from the data URL passed beside the state',
    html.includes('<img class="cap-shot" src="' + jpeg + '"'), true);
  eq('capture-render: the island carries the screenshot record and never the image data',
    islandJson(html).screenshot, taken);
  eq('capture-render: the island holds no image data',
    islandOf(html).includes('data:image'), false);
  const order = ['<h2>Sidebar</h2>', '<h2>Screenshot</h2>', '<h2>Bound table</h2>']
    .map((h) => html.indexOf(h));
  eq('capture-render: the Screenshot section sits between the sidebar likeness and the bound table',
    order.every((i, n) => i !== -1 && (n === 0 || i > order[n - 1])), true);
  eq('capture-render: the screenshot carries a note on what the image shows',
    /<img class="cap-shot"[^>]*>\s*<p class="cap-note">Note: The tab/.test(html), true);

  const failed = buildCaptureDocument({
    state: makeState({ screenshot: { taken: false, reason: 'activeTab was not granted' } }),
    lockedStatusText: '', screenshotDataUrl: null,
  });
  eq('capture-render: a failed screenshot renders as an absence with the reason',
    failed.includes('<p class="cap-empty">No screenshot: activeTab was not granted.</p>') &&
      !failed.includes('<img class="cap-shot"'), true);
  const absent = buildCaptureDocument({ state: makeState(), lockedStatusText: '' });
  eq('capture-render: an absent screenshot record renders as an absence',
    absent.includes('<p class="cap-empty">No screenshot was recorded.</p>') &&
      !absent.includes('<img class="cap-shot"'), true);

  // The image reaches the src attribute only as an image data URL: a
  // scheme, a quote, or an attribute cannot enter through the value.
  const hostile = ['javascript:alert(1)', 'data:text/html;base64,AAAA',
    'data:image/png;base64,AAAA" onerror="alert(1)', ''];
  const hostileOut = hostile.map((value) => buildCaptureDocument({
    state: makeState({ screenshot: taken }), lockedStatusText: '', screenshotDataUrl: value,
  }));
  eq('capture-render: a value outside the image data URL shape never reaches the img src',
    hostileOut.every((out) => !out.includes('<img class="cap-shot"') && !out.includes('onerror') &&
      !out.includes('javascript:') &&
      out.includes('No screenshot: the image data was not an image data URL.')), true);
  eq('capture-render: a png data URL renders like a jpeg one',
    buildCaptureDocument({
      state: makeState({ screenshot: { taken: true, format: 'png', chars: 26 } }),
      lockedStatusText: '', screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    }).includes('<img class="cap-shot" src="data:image/png;base64,iVBORw0KGgo="'), true);
})();

// --- lib/dr-capture: the renderer keeps the state's absences (#304) ---
//
// The state records three kinds of absence honestly; the page a human reads
// must present each as an absence, never as something it is not: a lost
// original never becomes a substituted value, an error record never becomes
// an empty table, a missing log snapshot never becomes an empty buffer. The
// glyph lookup resolves only the three mark words, so a hostile mark cannot
// pull a prototype property into the document.
(function captureRendererAbsenceHonesty() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;
  const LOCKED_TEXT = 'This table\'s original values are no longer available. Reload the page to change it.';

  const makeState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/prices', title: 'Prices',
      version: '2.1.50', platform: 'test-platform', at: '2026-09-09T18:00:00.000Z' },
    mark: 'looks-wrong',
    remarks: '',
    settings: { enabled: true },
    activeTableIndex: 0,
    tables: [],
    lensPreview: null,
    sidebarView: null,
    log: {
      content: { entries: [], dropped: 0, limit: 50 },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
    page: { url: 'https://www.example.com/prices', title: 'Prices' },
    fixtureSeed: null,
  }, over || {});

  // A locked table: the marker with no original behind it. The originals view
  // renders the absence, never the displayed (rounded) value.
  const locked = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'native', appliedFlag: 'simplified', lastRoundOptions: null,
        maxMagnitude: null, locked: true, rowCount: 1, columnCount: 2,
        cells: [
          { row: 0, col: 0, role: 'td', isOutside: false,
            text: '99,000', original: null, wearsMarker: true },
          { row: 0, col: 1, role: 'td', isOutside: false,
            text: 'n/a', original: null, wearsMarker: false },
        ],
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  // The originals table alone: from its heading to its closing tag. The JSON
  // island later in the document carries the displayed value by design.
  const originalsTable = (locked.split('with the originals')[1] || '').split('</table>')[0];
  eq('capture-render: a lost original renders as lost, never as the displayed value',
    /original lost/.test(originalsTable) && !originalsTable.includes('99,000'), true);
  eq('capture-render: a never-rounded cell still shows its text in the originals view',
    originalsTable.includes('n/a'), true);

  // An error record on the bound table: a failure notice, not an empty table.
  const failed = buildCaptureDocument({
    state: makeState({
      tables: [{
        kind: 'unknown', appliedFlag: null, lastRoundOptions: null,
        maxMagnitude: null, locked: false, rowCount: null, columnCount: null,
        cells: [], error: 'hostile walk',
      }],
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  const boundHalf = failed.split('<h2>Registry')[0];
  eq('capture-render: an error record on the bound table renders as a failure notice with its error text',
    /serialization[\s\S]{0,40}failed/i.test(boundHalf) && boundHalf.includes('hostile walk'),
    true);
  eq('capture-render: an error record on the bound table renders no table and no null counts',
    failed.includes('<table class="cap-table">') || failed.includes('null row(s)'), false);

  // A missing log snapshot (the state pull failed) is distinct from an empty
  // buffer: the sidebar half here IS an empty buffer and keeps its sentence.
  const pullFailed = buildCaptureDocument({
    state: makeState({
      log: { content: null, sidebar: { entries: [], dropped: 0, limit: 50 } },
    }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a missing log snapshot renders as a failed state pull',
    pullFailed.includes('state pull failed'), true);
  eq('capture-render: an empty buffer keeps its own sentence beside a failed pull',
    pullFailed.includes('Nothing was logged.'), true);

  // The glyph lookup resolves only the three mark words: a prototype property
  // name must not reach the document as a glyph.
  const hostileMark = buildCaptureDocument({
    state: makeState({ mark: 'constructor' }),
    lockedStatusText: LOCKED_TEXT,
  });
  eq('capture-render: a mark outside the three words resolves no glyph',
    hostileMark.includes('[native code]'), false);
  eq('capture-render: the hostile mark word still renders escaped as text',
    hostileMark.includes('<span>constructor</span>'), true);
})();

// --- lib/dr-capture: the size warning (#306) ---
//
// A capture has no size bound — the full-detail default is deliberate — so
// the form shows an estimate before the save when the pulled state is
// large. The estimate reads the serialized state's length; the file runs
// about four times that, because it carries the same content about four
// times (two table renderings, the JSON island, the visible seed).

(function captureSizeWarningHelper() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const sizeWarning = DR_CAPTURE.sizeWarning;
  const has = typeof sizeWarning === 'function';

  const small = { tables: [{ cells: [{ text: '99,000' }] }] };
  eq('capture-size: an ordinary state gets no warning',
    has ? sizeWarning(small) : 'missing', null);

  // 2,000,000 serialized characters estimate an 8 MB file.
  const big = { filler: 'x'.repeat(2 * 1000 * 1000) };
  eq('capture-size: a large state gets a warning that says the estimated size',
    has ? sizeWarning(big) : 'missing',
    'This capture will be large: about 8 MB.');

  // Just under the threshold (a 4 MB estimate): still no warning.
  const nearlyBig = { filler: 'x'.repeat(999 * 1000) };
  eq('capture-size: a state just under the threshold gets no warning',
    has ? sizeWarning(nearlyBig) : 'missing', null);
})();

// The header once stated what the file holds (#310). The product owner
// retired the line as stating the obvious; this pin keeps it out.
(function captureHeaderCarriesNoCaveat() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const html = DR_CAPTURE.buildCaptureDocument({
    state: {
      captureFormat: 6,
      meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
      mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
      tables: [], lensPreview: null, sidebarView: null,
      log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
    },
    lockedStatusText: '',
  });
  eq('capture-header: the header carries no share caveat',
    html.includes('Share it as you would share the page.'), false);
})();

// --- lib/dr-capture: the detection settings in force at capture time (D8) ---
//
// The capture state gains a detectionSettings field: a plain copy of DR_DETECTION_SETTINGS taken at
// capture time, so a capture shows the detection values that were in force.

// Criterion 1: collectCaptureState carries every key of the detection settings,
// the format version moves to 2, and the copy is plain and detached — a
// mutation on the returned copy must never reach DR_DETECTION_SETTINGS itself.
(function captureStateCarriesDetectionSettings() {
  eq('capture-settings: collectCaptureState loads in the content-script bundle',
    typeof globalThis.collectCaptureState, 'function');
  if (typeof globalThis.collectCaptureState !== 'function') return;

  const makeFakeStore = () => ({
    getRegisteredTables: () => [],
    getSelectedTable: () => null,
    getSettings: () => ({}),
    getErrorState: () => ({ hasError: false, count: 0, rows: [] }),
    getTableAppliedFlag: () => 'original',
    getTableRoundOptions: () => null,
    getTableMaxMagnitude: () => null,
    getTableOriginalText: () => undefined,
  });
  const fakeAdapterFor = () => ({ isVirtualized: () => false, getRows: () => [] });

  const state = collectCaptureState({ store: makeFakeStore(), adapterFor: fakeAdapterFor });

  eq('capture-settings: the capture state carries every key of the detection settings, with the values in force',
    state.detectionSettings, DR_DETECTION_SETTINGS);
  eq('capture-settings: the state\'s captureFormat equals CAPTURE_FORMAT',
    state.captureFormat, CAPTURE_FORMAT);
  eq('capture-settings: CAPTURE_FORMAT is 6',
    CAPTURE_FORMAT, 6);
  eq('capture-settings: the returned copy is not the same object as DR_DETECTION_SETTINGS',
    state.detectionSettings !== DR_DETECTION_SETTINGS, true);

  // Adversarial: mutate the returned copy and confirm the live block holds.
  const originalDisplayValuesLength = DR_DETECTION_SETTINGS.gridDisplayValues.length;
  const originalMinChildren = DR_DETECTION_SETTINGS.gridMinChildren;
  const originalFirstVendorName = DR_DETECTION_SETTINGS.vendorProfiles[0].name;

  state.detectionSettings.gridDisplayValues.push('mutated-by-test');
  state.detectionSettings.gridMinChildren = 999999;
  state.detectionSettings.vendorProfiles[0].name = 'mutated-by-test';

  eq('capture-settings: pushing onto the returned copy\'s list leaves DR_DETECTION_SETTINGS\'s list unchanged',
    DR_DETECTION_SETTINGS.gridDisplayValues.length, originalDisplayValuesLength);
  eq('capture-settings: changing a scalar on the returned copy leaves DR_DETECTION_SETTINGS\'s scalar unchanged',
    DR_DETECTION_SETTINGS.gridMinChildren, originalMinChildren);
  eq('capture-settings: changing a nested profile field on the returned copy leaves DR_DETECTION_SETTINGS\'s profile unchanged',
    DR_DETECTION_SETTINGS.vendorProfiles[0].name, originalFirstVendorName);
})();

// Criterion 2: the rendered file shows the detection settings in its visible
// half — a scalar, every item of a display-value list, and a vendor
// profile's name and selector — and a hostile value in a profile field
// reaches the visible half only in its escaped form.
(function captureDetectionSettingsSectionRendersValues() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;

  const baseState = (detectionSettings) => ({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
    mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
    tables: [], lensPreview: null, sidebarView: null,
    log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
    detectionSettings,
  });
  const visibleHalf = (html) => html.slice(0, html.indexOf('id="capture-state"'));

  const settings = {
    exampleScalarSetting: 4242,
    exampleDisplayValues: ['north-list-value', 'south-list-value'],
    exampleVendorProfiles: [{
      name: 'north-vendor',
      classToken: 'nv--',
      scrollContainerSelectors: ['.nv--scroll-container'],
      pinnedPaneSelectors: ['.nv--pinned-pane'],
    }],
  };
  const visible = visibleHalf(buildCaptureDocument({ state: baseState(settings), lockedStatusText: '' }));

  eq('capture-settings: a scalar detection setting renders in the visible half',
    visible.includes('4242'), true);
  eq('capture-settings: every item of a display-value list renders in the visible half',
    visible.includes('north-list-value') && visible.includes('south-list-value'), true);
  eq('capture-settings: a vendor profile\'s name renders in the visible half',
    visible.includes('north-vendor'), true);
  eq('capture-settings: a vendor profile\'s selector renders in the visible half',
    visible.includes('.nv--scroll-container'), true);

  // Hostile half: a profile name and a selector each carrying <script>, a
  // double quote, and an ampersand must reach the visible half escaped only.
  const hostileSettings = {
    exampleScalarSetting: 'one<script>alert(3)</script>"&',
    exampleDisplayValues: ['.list<script>alert(4)</script>"&item'],
    exampleVendorProfiles: [{
      name: 'north<script>alert(1)</script>"&vendor',
      classToken: 'nv--',
      scrollContainerSelectors: ['.nv--<script>alert(2)</script>"&pane'],
      pinnedPaneSelectors: [],
    }],
  };
  const hostileVisible = visibleHalf(
    buildCaptureDocument({ state: baseState(hostileSettings), lockedStatusText: '' }));

  eq('capture-settings: a hostile profile field never renders a literal script tag in the visible half',
    hostileVisible.toLowerCase().includes('<script>'), false);
  eq('capture-settings: a hostile profile field renders its angle brackets escaped',
    hostileVisible.includes('&lt;script&gt;') && hostileVisible.includes('&lt;/script&gt;'), true);
  eq('capture-settings: a hostile profile field renders its double quote escaped',
    hostileVisible.includes('&quot;'), true);
  eq('capture-settings: a hostile profile field renders its ampersand escaped',
    hostileVisible.includes('&amp;'), true);
})();

// Criterion 3: a state with no detectionSettings field (null, or the key absent) does
// not throw, renders the absence placeholder in the detection settings section, and the
// header still states the format version — the capture still saves. The
// sidebar side: assembleAndSaveCapture's fallback state carries
// detectionSettings: null, so a failed state pull renders the absence honestly rather
// than losing the field.
(function captureDetectionSettingsAbsenceHonesty() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const buildCaptureDocument = DR_CAPTURE.buildCaptureDocument;

  const baseState = (over) => Object.assign({
    captureFormat: 6,
    meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
    mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
    tables: [], lensPreview: null, sidebarView: null,
    log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
  }, over || {});
  const visibleHalf = (html) => html.slice(0, html.indexOf('id="capture-state"'));

  let threwWithNull = false;
  let htmlWithNull = '';
  try {
    htmlWithNull = buildCaptureDocument({ state: baseState({ detectionSettings: null }), lockedStatusText: '' });
  } catch (e) {
    threwWithNull = true;
  }
  eq('capture-settings: a null detectionSettings field does not throw while building the document',
    threwWithNull, false);

  const stateWithAbsentSettings = baseState({});
  delete stateWithAbsentSettings.detectionSettings;
  let threwWithAbsent = false;
  let htmlWithAbsent = '';
  try {
    htmlWithAbsent = buildCaptureDocument({ state: stateWithAbsentSettings, lockedStatusText: '' });
  } catch (e) {
    threwWithAbsent = true;
  }
  eq('capture-settings: a state with the detectionSettings field absent does not throw while building the document',
    threwWithAbsent, false);

  eq('capture-settings: a null detectionSettings field renders the absence placeholder in the detection settings section',
    /<h2>Detection settings<\/h2>[\s\S]{0,80}—/.test(visibleHalf(htmlWithNull)), true);
  eq('capture-settings: an absent detectionSettings field renders the absence placeholder in the detection settings section',
    /<h2>Detection settings<\/h2>[\s\S]{0,80}—/.test(visibleHalf(htmlWithAbsent)), true);
  eq('capture-settings: the format version still prints in the header when detectionSettings is absent',
    /<dt>Capture format<\/dt><dd>6<\/dd>/.test(visibleHalf(htmlWithAbsent)), true);

  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const fnStart = sidebarJsSrc.indexOf('function assembleAndSaveCapture');
  const fnBody = fnStart === -1 ? '' : sidebarJsSrc.slice(fnStart, sidebarJsSrc.indexOf('\nfunction ', fnStart + 1));
  eq('capture-settings: assembleAndSaveCapture\'s fallback state carries detectionSettings: null',
    fnStart !== -1 && /detectionSettings:\s*null/.test(fnBody), true);
})();

// Criterion 5: the detection settings section sits in the visible half under its own
// heading, ahead of the hidden capture-state JSON block, so a reader finds
// it while scanning the file rather than only in the JSON.
(function captureDetectionSettingsHeadingPrecedesStateBlock() {
  if (typeof globalThis.DR_CAPTURE !== 'object') return;
  const html = DR_CAPTURE.buildCaptureDocument({
    state: {
      captureFormat: 6,
      meta: { url: 'https://www.example.com/x', title: 'X', version: 'v', platform: 'p', at: 't' },
      mark: 'looks-right', remarks: '', settings: {}, activeTableIndex: null,
      tables: [], lensPreview: null, sidebarView: null,
      log: { content: null, sidebar: null }, page: null, fixtureSeed: null,
      detectionSettings: { exampleScalarSetting: 1 },
    },
    lockedStatusText: '',
  });
  const headingMatch = /<h2>Detection settings<\/h2>/.exec(html);
  const stateBlockIndex = html.indexOf('id="capture-state"');
  eq('capture-settings: the visible half carries the Detection settings heading',
    headingMatch !== null, true);
  eq('capture-settings: the detection settings heading sits before the hidden capture-state block',
    headingMatch !== null && stateBlockIndex !== -1 && headingMatch.index < stateBlockIndex, true);
})();

// --- capture: the error state and the stack traces travel in the capture ---
//
// The capture state carries the model's error state, and each log row's
// stack trace renders under the row, folded, so a reader opens the trace
// only for the row in question. Format 3 marks both additions. The sidebar's
// fallback state, used when the page half never arrives, carries the new
// field as an absence, like every other page-side field.

(function captureCarriesErrorState() {
  if (typeof globalThis.collectCaptureState !== 'function' ||
      typeof globalThis.DR_CAPTURE !== 'object') return;
  const errorState = {
    hasError: true, count: 1,
    rows: [{ at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'probe', stack: '    at roundTable' }],
  };
  const fakeStore = {
    getRegisteredTables: () => [],
    getSelectedTable: () => null,
    getSettings: () => ({ enabled: true }),
    getErrorState: () => errorState,
  };
  const state = collectCaptureState({ store: fakeStore, adapterFor: () => null });
  eq('capture-state: the state carries the model\'s error state', state.errorState, errorState);
  eq('capture-state: format 6 renames the detection settings key',
    state.captureFormat, 6);

  const renderState = {
    captureFormat: 6,
    meta: { url: 'https://www.example.com/p', title: 'P', version: '2.1.70',
      platform: 'test', at: '2026-09-17T16:00:00.000Z' },
    mark: 'looks-wrong', remarks: '', settings: { enabled: true }, detectionSettings: null,
    activeTableIndex: null, tables: [], lensPreview: null, fixtureSeed: null,
    sidebarView: { enabled: true, switches: {}, dateGranularity: 'year', timeGranularity: 'hour',
      rangeExpr: '', stops: [0], topVal: 0, botVal: 0, coupled: true, status: '',
      noTable: true, locked: false, lensPreview: { top: [], bottom: [] } },
    errorState: errorState,
    log: {
      content: {
        entries: [
          { at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'traced row',
            stack: '    at roundTable (chrome-extension://' + 'a'.repeat(32) +
              '/content.js:1523:18)\n    at <script>alert(1)</script>' },
          { at: '2026-09-17T16:00:01.000Z', level: 'debug', text: 'plain row', stack: null },
        ],
        dropped: 0, limit: 50,
      },
      sidebar: { entries: [], dropped: 0, limit: 50 },
    },
  };
  const html = DR_CAPTURE.buildCaptureDocument({ state: renderState, lockedStatusText: '' });
  const visible = html.slice(0, html.indexOf('id="capture-state"'));
  eq('capture-render: a row\'s stack trace renders under the row, folded, each frame in the short form',
    /traced row[\s\S]{0,200}<details[\s\S]{0,200}content\.js:1523:18 \(roundTable\)/.test(visible) &&
      !visible.includes('chrome-extension://'), true);
  eq('capture-render: a row with no stack trace renders no fold',
    (visible.match(/<details/g) || []).length, 1);
  eq('capture-render: a hostile stack trace reaches the visible half escaped only',
    visible.includes('&lt;script&gt;alert(1)&lt;/script&gt;') &&
      !visible.toLowerCase().includes('<script'), true);
  // The island's text, unescaped (ampersand last), parsed back.
  const island = html.match(/<pre id="capture-state" hidden>([\s\S]*?)<\/pre>/);
  const islandState = island ? JSON.parse(island[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')) : null;
  eq('capture-render: the island carries the stack trace byte-exact',
    islandState && islandState.log.content.entries[0].stack,
    renderState.log.content.entries[0].stack);
  eq('capture-render: the island carries the error state',
    islandState && islandState.errorState, errorState);

  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const fnStart = sidebarJsSrc.indexOf('function assembleAndSaveCapture');
  const fnBody = fnStart === -1 ? '' :
    sidebarJsSrc.slice(fnStart, sidebarJsSrc.indexOf('\nfunction ', fnStart + 1));
  eq('capture: assembleAndSaveCapture\'s fallback state carries errorState: null',
    fnStart !== -1 && /errorState:\s*null/.test(fnBody), true);
})();

// --- lib/dr-capture: stack frames print in the short form ---
//
// V8 writes a frame as "at fn (origin/path:line:col)" or, with no name, as
// "at origin/path:line:col". The capture prints each frame the way Chrome's
// extension error page does: path:line:col (fn), the extension's own origin
// dropped, an unnamed frame marked as an anonymous function. A line outside
// either shape prints as it is, so nothing is lost; the JSON island keeps
// the raw string byte-exact either way.
(function captureTraceShortForm() {
  if (typeof globalThis.DR_CAPTURE !== 'object' ||
      typeof DR_CAPTURE.formatStackFrame !== 'function') {
    eq('capture-trace: the package exposes the frame formatter',
      typeof globalThis.DR_CAPTURE === 'object' && typeof DR_CAPTURE.formatStackFrame, 'function');
    return;
  }
  const origin = 'chrome-extension://' + 'abcdefghijklmnopabcdefghijklmnop' + '/';
  const f = DR_CAPTURE.formatStackFrame;
  eq('capture-trace: a named frame renders as path:line:col (name)',
    f('    at roundTable (' + origin + 'content.js:1523:18)'), 'content.js:1523:18 (roundTable)');
  eq('capture-trace: an unnamed frame renders as an anonymous function',
    f('    at ' + origin + 'adapters/messaging.js:399:9'),
    'adapters/messaging.js:399:9 (anonymous function)');
  eq('capture-trace: an Object.<anonymous> frame keeps its function part',
    f('    at Object.<anonymous> (' + origin + 'x.js:1:2)'), 'x.js:1:2 (Object.<anonymous>)');
  eq('capture-trace: an async frame keeps the async prefix',
    f('    at async fetchIt (' + origin + 'y.js:3:4)'), 'y.js:3:4 (async fetchIt)');
  eq('capture-trace: a constructor frame keeps the new prefix',
    f('    at new Foo (' + origin + 'z.js:5:6)'), 'z.js:5:6 (new Foo)');
  eq('capture-trace: a frame from another origin keeps its URL',
    f('    at run (https://example.com/app.js:7:8)'), 'https://example.com/app.js:7:8 (run)');
  // V8 also writes frames with no location — a built-in, a promise
  // combinator — and a cut frame; each prints as it is.
  const passThrough = ['Error', '<script>alert(1)</script>', '',
    '    at new Promise (<anonymous>)', '    at Array.forEach (<anonymous>)',
    '    at async Promise.all (index 0)', '    at roundTable (' + origin + 'content.js:15'];
  eq('capture-trace: a line outside the frame shape prints as it is',
    passThrough.map(f), passThrough);
})();
