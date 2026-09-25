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

// (b) roundTable simplifies a hidden cell and resetTable restores it.
//
// A hidden cell's raw text is the one real text node under it; its rendered
// text stays empty throughout, because rounding a hidden cell does not
// unhide it. textContent and innerHTML share one backing value (the raw
// text, exactly as a real <td> keeps them in sync); innerText is a fixed
// empty string, unrelated to that backing value, modeling the rendered read
// a hidden row keeps regardless of what the underlying text node holds.
function makeHiddenNumericCell(rawText) {
  let raw = rawText;
  return {
    tagName: 'TD',
    innerText: '',
    get textContent() { return raw; },
    set textContent(v) { raw = v; },
    get innerHTML() { return raw; },
    set innerHTML(v) { raw = v; },
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      remove(c) { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
    dataset: {},
    title: '',
    querySelectorAll: () => [],
    removeAttribute() {},
  };
}

// A tree walker over the hidden cell's one real text node: its nodeValue is
// the raw text (textContent), never the (unrelated) rendered read.
function withHiddenCellTreeWalker(cell, fn) {
  global.document.createTreeWalker = function() {
    let done = false;
    return {
      nextNode() {
        if (done) return null;
        done = true;
        return {
          get nodeValue() { return cell.textContent; },
          set nodeValue(v) { cell.textContent = v; },
        };
      },
    };
  };
  try { fn(); } finally { delete global.document.createTreeWalker; }
}

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

// =============================================================================
// One currency list
// =============================================================================
// Every currency rule reads CURRENCIES in lib/dr-number/core.js. These
// assertions drive themselves from that list, so a currency added there is
// covered here without a second list to keep in step.

(function currencies_oneListDrivesEveryRule() {
  if (!Array.isArray(CURRENCIES) || CURRENCIES.length === 0) {
    eq('currencies: the one currency list is present and not empty', false, true);
    return;
  }

  // Every sign the list names reads as a sign: the digits beside it parse.
  for (const { name, signs } of CURRENCIES) {
    for (const sign of signs) {
      eq('currencies: "' + sign + '" (' + name + ') before the digits reads as a number',
        toNumber(sign + '450'), 450);
    }
  }

  // Every code the list names is a currency code, so the currency exclusion
  // and the unit-number reader both admit it.
  const currencyOff = { simplifyFirstRow: true, simplifyFirstColumn: true,
    simplifyMixedPercent: true, simplifyMixedCurrency: false };
  for (const { name, code } of CURRENCIES) {
    eq('currencies: the code ' + code + ' (' + name + ') excludes a cell with the currency setting off',
      getExclusionReason('450 ' + code, 1, currencyOff, 1), 'currency');
  }

  // The data test's numeric probe strips exactly the signs the reader strips.
  // Before the collapse it carried its own shorter list, so a rupee cell read
  // as a number for the reader and as text for the probe.
  for (const sign of CURRENCY_SIGNS) {
    eq('currencies: the numeric probe reads "' + sign + '450" like the number reader does',
      DEFAULT_NUMERIC_PROBE.parse(sign + '450'), 450);
  }

  // The sign-only piece test admits every sign, so a cell that draws its sign
  // in one piece and its digits in another still simplifies.
  for (const sign of CURRENCY_SIGNS) {
    const spans = [{ i: 0, start: 0, text: sign }, { i: 1, start: sign.length, text: '450' }];
    eq('currencies: a cell drawn as "' + sign + '" beside "450" is a stacked cell',
      stackedMatches(spans), [{ numStr: '450', num: 450, index: sign.length }]);
  }
})();

(function currencies_roundingKeepsTheSign() {
  // Before the collapse, restore carried its own four-symbol chain, so a cell
  // marked with any other currency rounded and lost its sign outright.
  for (const { name, signs } of CURRENCIES) {
    for (const sign of signs) {
      eq('currencies: rounding keeps "' + sign + '" (' + name + ')',
        restoreFormatting(500, sign + '450'), sign + '500');
    }
  }
  eq('currencies: a sign after the digits goes back after them',
    restoreFormatting(500, '450 kr'), '500 kr');
  eq('currencies: a sign before the digits keeps its space',
    restoreFormatting(500, '\u20b9 450'), '\u20b9 500');
  eq('currencies: a letter that only looks like a sign gains none',
    restoreFormatting(500, 'Revenue 450'), '500');
  eq('currencies: an accounting negative keeps its brackets and its sign',
    restoreFormatting(-500, '($450)'), '($500)');
})();

(function currencies_letterSignsTakeTheTokenRule() {
  // A sign written in letters counts on the end that carries the letter only
  // when no letter sits against it, the same rule a currency code takes. A
  // sign written as a picture counts anywhere.
  for (const text of ['Revenue', 'Rate', 'Region', 'Fresh', 'Free', 'From', 'krona', 'Crop',
    'R2D2', 'Form 10-K', 'Q4 2024', 'DT1234']) {
    eq('currencies: "' + text + '" does not read as a number',
      toNumber(text), null);
  }
  eq('currencies: a letter sign against the digits still reads ("R45")', toNumber('R45'), 45);
  eq('currencies: a letter sign and a space still read ("kr 45")', toNumber('kr 45'), 45);
  eq('currencies: a two-letter sign against the digits still reads ("Fr45")', toNumber('Fr45'), 45);
  eq('currencies: the longest sign wins ("EC$45")', toNumber('EC$45'), 45);
  eq('currencies: a picture sign after the digits reads ("45€")', toNumber('45€'), 45);
  eq('currencies: a picture sign with a letter left beside it does not read ("a€45")',
    toNumber('a€45'), null);

  // Regression: the currency exclusion once fired on any capital R, so a
  // plain text cell was skipped as currency with the setting off.
  const currencyOff = { simplifyFirstRow: true, simplifyFirstColumn: true,
    simplifyMixedPercent: true, simplifyMixedCurrency: false };
  eq('currencies: "Revenue 45" is not a currency cell',
    getExclusionReason('Revenue 45', 1, currencyOff, 1), null);
  eq('currencies: "Fresh 45" is not a currency cell',
    getExclusionReason('Fresh 45', 1, currencyOff, 1), null);
  eq('currencies: "R 45" is a currency cell',
    getExclusionReason('R 45', 1, currencyOff, 1), 'currency');
})();

(function currencies_noSecondList() {
  // Fail closed on a restated list. A second copy of the signs necessarily
  // carries several currency pictures, so no content script outside core.js
  // may hold more than one distinct picture. The dollar sign stays out of the
  // scan: it is ordinary regular-expression and template syntax. A file that
  // legitimately needs several pictures reads CURRENCY_SIGNS instead.
  const pictures = /[€£¥₹₽₺₣]/g;
  const offenders = [];
  for (const [file, src] of contentScriptSources) {
    if (file === 'lib/dr-number/core.js') continue; // the one list lives here
    const distinct = new Set(src.match(pictures) || []);
    if (distinct.size > 1) offenders.push(file);
  }
  eq('currencies: no content script outside the one list spells out the currency signs',
    offenders, []);
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

// --- Reading the sign ---

eq('bracketed: a bracket pair reads as a minus sign',
  extractNumbersInText('(1,234)'),
  [{ numStr: '1,234', num: -1234, index: 1 }]);

eq('bracketed: a currency sign inside the brackets keeps the minus sign',
  extractNumbersInText('($1,234)'),
  [{ numStr: '1,234', num: -1234, index: 2 }]);

eq('bracketed: a currency sign outside the brackets keeps the minus sign',
  extractNumbersInText('$(1,234)'),
  [{ numStr: '1,234', num: -1234, index: 2 }]);

eq('bracketed: a percent sign inside the brackets keeps the minus sign',
  extractNumbersInText('(12.3%)'),
  [{ numStr: '12.3', num: -12.3, index: 1 }]);

eq('bracketed: a space between the bracket and the number keeps the minus sign',
  extractNumbersInText('( 1,234 )'),
  [{ numStr: '1,234', num: -1234, index: 2 }]);

eq('bracketed: brackets around a number among words read as a minus sign',
  extractNumbersInText('Net loss (1,234) for the year'),
  [{ numStr: '1,234', num: -1234, index: 10 }]);

eq('bracketed: a written minus sign inside brackets is not doubled',
  extractNumbersInText('(-1,234)'),
  [{ numStr: '-1,234', num: -1234, index: 1 }]);

eq('bracketed: brackets holding words leave the number positive',
  extractNumbersInText('(see note 4)'),
  [{ numStr: '4', num: 4, index: 10 }]);

eq('bracketed: a bracket pair followed by digits is an area code, not a minus sign',
  extractNumbersInText('(416) 555-1234').map((m) => m.num),
  [416, 555, 1234]);

eq('bracketed: an unclosed bracket leaves the number positive',
  extractNumbersInText('(1,234').map((m) => m.num), [1234]);

eq('bracketed: an unopened bracket leaves the number positive',
  extractNumbersInText('1,234)').map((m) => m.num), [1234]);

eq('bracketed: the first-number reader takes the same sign',
  extractNumberInText('(1,234)'),
  { numStr: '1,234', num: -1234, index: 1 });

eq('bracketed: the bracket test answers for the number it is given',
  [isBracketedNegative('(1,234)', 1, '1,234'), isBracketedNegative('(see 4)', 5, '4')],
  [true, false]);

// --- Writing the sign back ---

eq('bracketed: the rounded number carries the sign the original text showed',
  formatExtractedNumber(-1200, '1,234'), '1,200');

eq('bracketed: a written minus sign survives rounding',
  formatExtractedNumber(-1200, '-1,234'), '-1,200');

eq('bracketed: the sign rule leaves a positive number alone',
  formatExtractedNumber(1200, '1,234'), '1,200');

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
    placeDecision(decision, text, layout, { stacked: false }).mode, 'extracted');
  eq('bracketed: a bracket in its own text piece still places on a grid',
    placeDecision(decision, text, layout, { stacked: true }).mode, 'extracted');
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

// --- The whole-text match ---

eq('bracketed: a bracket pair holding more than the number is not a whole-text match',
  [
    matchBracketedNumber('(see note 4)'),
    matchBracketedNumber('(1,234) (5,678)'),
    matchBracketedNumber('USD (1,234)'),
  ],
  [null, null, null]);

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

// The worked example from the issue: a label column merged down over two rows,
// and a total row merged across the first two columns.
function makeMergedSpanTable() {
  return makeMockTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }, { tag: 'th', text: 'Q2' }],
    [{ tag: 'td', text: 'West', rowSpan: 2 }, { tag: 'td', text: '1,234' }, { tag: 'td', text: '2,345' }],
    [{ tag: 'td', text: '12,500' }, { tag: 'td', text: '3,210' }],
    [{ tag: 'td', text: 'Total', colSpan: 2 }, { tag: 'td', text: '5,555' }],
  ]);
}

// The same table with every merge written out: the reading each consumer must
// agree with.
function makeUnmergedSpanTable() {
  return makeMockTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }, { tag: 'th', text: 'Q2' }],
    [{ tag: 'td', text: 'West' }, { tag: 'td', text: '1,234' }, { tag: 'td', text: '2,345' }],
    [{ tag: 'td', text: 'West' }, { tag: 'td', text: '12,500' }, { tag: 'td', text: '3,210' }],
  ]);
}

// Declare merges on a grid the way a page does, through the accessibility
// attributes. Every cell answers the attribute read, as a page element does;
// only the cells named here answer with a span.
function declareGridSpans(grid, spansByCellIndex) {
  grid.cellEls.forEach(function (cellEl, idx) {
    const spans = spansByCellIndex[idx] || {};
    cellEl.getAttribute = function (name) {
      if (name === 'aria-colspan') return spans.colSpan ? String(spans.colSpan) : null;
      if (name === 'aria-rowspan') return spans.rowSpan ? String(spans.rowSpan) : null;
      return null;
    };
  });
  return grid;
}

function adapterColumnsOf(el) {
  return makeAdapter(el).getRows().map((row) => row.getCells().map((cell) => cell.columnIndex));
}

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

// --- The range pulse frames the cells the engine rounds ---

(function theRangePulseFramesTheGridColumn() {
  const table = makeMergedSpanTable();
  // Column 1 sits at 100-200, column 2 at 200-300, so the overlay's geometry
  // says which cell matched. The row merged down covers column 0, so the two
  // cells of the third row are grid columns 1 and 2.
  const shifted = table.rows[2].cells;
  shifted[0].getBoundingClientRect = () => ({ top: 40, left: 100, right: 200, bottom: 60 });
  shifted[1].getBoundingClientRect = () => ({ top: 40, left: 200, right: 300, bottom: 60 });

  const origCreateElement = global.document.createElement;
  const origBody = global.document.body;
  const origSetTimeout = global.setTimeout;
  let overlay = null;
  global.document.createElement = (tag) => {
    const el = { style: {}, addEventListener() {} };
    if (tag === 'div') overlay = el;
    return el;
  };
  global.document.body = { appendChild() {} };
  global.setTimeout = () => 0;

  try {
    // Column B of the third row alone: the cell the engine rounds there.
    flashRangePulse(table, [{ rowMin: 2, rowMax: 2, colMin: 1, colMax: 1 }]);
  } finally {
    global.document.createElement = origCreateElement;
    global.document.body = origBody;
    global.setTimeout = origSetTimeout;
  }

  eq('#330: the range pulse frames the cell at the grid column, not at the read position',
    overlay && { left: overlay.style.left, width: overlay.style.width },
    { left: '100px', width: '100px' });
})();

// --- The capture state records the grid width ---

(function theCaptureStateRecordsTheGridWidth() {
  // Every row holds a merge, so no row's cell count reaches the table's
  // width: counting the widest row answers 2 where the table is 3 columns.
  const table = makeMockTable([
    [{ tag: 'th', text: 'Quarters', colSpan: 2 }, { tag: 'th', text: 'Year' }],
    [{ tag: 'td', text: 'West', rowSpan: 2 }, { tag: 'td', text: '1,234', colSpan: 2 }],
    [{ tag: 'td', text: '3,210', colSpan: 2 }],
  ]);
  DR_STORE.registerTable(table);
  try {
    const state = collectCaptureState({ store: DR_STORE, adapterFor: (t) => makeAdapter(t) });
    const record = state.tables[DR_STORE.getRegisteredTables().indexOf(table)];
    eq('#330: the capture state counts the grid width, not the widest row read',
      record.columnCount, 3);
    eq('#330: the capture state records each cell at its grid column',
      record.cells.filter((cell) => cell.row === 0).map((cell) => cell.col), [0, 2]);
  } finally {
    DR_STORE.unregisterTable(table);
  }
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

// The observers the page model reports to. The harness clears the list.
const rwObservers = [];
let rwDeliveringToObserver = false;

class RewriteObserver {
  constructor(callback) { this.callback = callback; this.target = null; this.queue = []; }
  observe(target) {
    this.target = target;
    if (!rwObservers.includes(this)) rwObservers.push(this);
  }
  disconnect() {
    this.target = null;
    this.queue = [];
    const at = rwObservers.indexOf(this);
    if (at >= 0) rwObservers.splice(at, 1);
  }
}

function rwRecordMutation(node) {
  for (const observer of rwObservers) {
    for (let at = node; at; at = at.parentNode) {
      if (at === observer.target) { observer.queue.push({ target: node }); break; }
    }
  }
}

function rwDeliverMutations() {
  for (const observer of rwObservers.slice()) {
    if (observer.queue.length === 0) continue;
    const records = observer.queue;
    observer.queue = [];
    rwDeliveringToObserver = true;
    try { observer.callback(records, observer); } finally { rwDeliveringToObserver = false; }
  }
}

function rwText(value) {
  let current = value;
  const node = {
    nodeType: 3, childNodes: null, parentNode: null, parentElement: null, writes: 0,
    get nodeValue() { return current; },
    set nodeValue(v) { current = v; node.writes++; rwRecordMutation(node); },
  };
  return node;
}

function rwTextNodesOf(root) {
  const found = [];
  (function visit(node) {
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) found.push(child);
      else visit(child);
    }
  })(root);
  return found;
}

function rwSerialize(node) {
  if (node.nodeType === 3) return node.nodeValue;
  const tag = node.tagName.toLowerCase();
  return '<' + tag + '>' + node.childNodes.map(rwSerialize).join('') + '</' + tag + '>';
}

function rwClone(node) {
  if (node.nodeType === 3) return rwText(node.nodeValue);
  return rwEl(node.tagName, node._attrs, node.childNodes.map(rwClone));
}

function rwSetChildren(el, children) {
  el.childNodes = children;
  for (const child of children) { child.parentNode = el; child.parentElement = el; }
  rwRecordMutation(el);
}

// One element. innerHTML reads the markup, and a write of markup the element
// served before puts a fresh copy of those nodes in, the way the browser
// parses markup into new nodes.
function rwEl(tagName, attrs, children) {
  const classes = new Set();
  const snapshots = new Map();
  const el = {
    nodeType: 1, tagName: String(tagName).toUpperCase(), childNodes: [],
    parentNode: null, parentElement: null, dataset: {}, style: {}, title: '',
    _attrs: Object.assign({}, attrs || {}), innerHTMLWrites: 0,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    get className() { return Array.from(classes).join(' '); },
    get children() { return el.childNodes.filter((node) => node.nodeType === 1); },
    get textContent() { return rwTextNodesOf(el).map((node) => node.nodeValue).join(''); },
    get innerText() { return el.textContent; },
    get innerHTML() {
      const markup = el.childNodes.map(rwSerialize).join('');
      snapshots.set(markup, el.childNodes.map(rwClone));
      return markup;
    },
    set innerHTML(markup) {
      el.innerHTMLWrites++;
      const nodes = snapshots.get(markup);
      rwSetChildren(el, nodes ? nodes.map(rwClone) : [rwText(markup)]);
    },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(el._attrs, name) ? el._attrs[name] : null; },
    setAttribute(name, value) { el._attrs[name] = String(value); },
    removeAttribute(name) { delete el._attrs[name]; if (name === 'title') el.title = ''; },
    matches(selector) { return dgNodeMatches(el, selector); },
    querySelector(selector) { return dgDescendantsMatching(el, selector)[0] || null; },
    querySelectorAll(selector) { return dgDescendantsMatching(el, selector); },
    contains(other) {
      for (let at = other; at; at = at.parentNode) if (at === el) return true;
      return false;
    },
    closest(selector) {
      for (let at = el; at && at.nodeType === 1; at = at.parentNode) if (dgNodeMatches(at, selector)) return at;
      return null;
    },
    getBoundingClientRect() { return { top: 10, left: 10, right: 410, bottom: 210, width: 400, height: 200 }; },
  };
  if (el.tagName === 'TABLE') {
    Object.defineProperty(el, 'rows', { get() { return dgDescendantsMatching(el, 'tr'); } });
  }
  if (el.tagName === 'TR') {
    Object.defineProperty(el, 'cells', {
      get() { return el.children.filter((c) => c.tagName === 'TD' || c.tagName === 'TH'); },
    });
  }
  rwSetChildren(el, children || []);
  return el;
}

// A cell's contents: a string is one text piece; an array lists pieces, each
// a string for a bare text piece or { tag, text } for a piece inside its own
// element.
function rwPieces(spec) {
  const items = Array.isArray(spec) ? spec : [spec];
  return items.map((item) => (typeof item === 'string'
    ? rwText(item)
    : rwEl(item.tag, {}, [rwText(item.text)])));
}

/**
 * Draw one table of either kind from the same rows. A native table holds a
 * head section for the header and a body for the rows; a grid holds its
 * header row outside a row group and its data rows inside it, or its data
 * rows alone with no header.
 *
 * @param {'native'|'grid'} kind
 * @param {Array<Array<string|Array>>} rows
 * @param {{header?: string[]}} [opts]
 */
function rwBuildTable(kind, rows, opts) {
  const header = (opts && opts.header) || null;
  const isNative = kind === 'native';
  const makeCell = (spec) => rwEl(isNative ? 'td' : 'div', isNative ? {} : { role: 'cell' }, rwPieces(spec));
  const makeRow = (specs) => rwEl(isNative ? 'tr' : 'div', isNative ? {} : { role: 'row' }, specs.map(makeCell));
  const dataRows = rows.map(makeRow);
  let body;
  let table;
  if (isNative) {
    body = rwEl('tbody', {}, dataRows);
    const head = header
      ? [rwEl('thead', {}, [rwEl('tr', {}, header.map((text) => rwEl('th', {}, [rwText(text)])))])]
      : [];
    table = rwEl('table', {}, head.concat([body]));
  } else {
    const headerRow = header
      ? [rwEl('div', { role: 'row' }, header.map((text) => rwEl('div', { role: 'columnheader' }, [rwText(text)])))]
      : [];
    body = header ? rwEl('div', { role: 'rowgroup' }, dataRows) : null;
    table = rwEl('div', { role: 'grid' }, header ? headerRow.concat([body]) : dataRows);
    if (!header) body = table;
  }
  const rowEl = (r) => body.children[r];
  const cell = (r, c) => rowEl(r).children[c];
  return {
    kind, table,
    cell,
    pieces: (r, c) => rwTextNodesOf(cell(r, c)),
    text: (r, c) => cell(r, c).textContent,
    // The page writes a new text into one piece of a cell, in place.
    write: (r, c, text, k) => { rwTextNodesOf(cell(r, c))[k || 0].nodeValue = text; },
    // The page redraws a cell's contents with new pieces, in place.
    redraw: (r, c, spec) => rwSetChildren(cell(r, c), rwPieces(spec)),
    addRow: (specs) => rwSetChildren(body, body.childNodes.concat([makeRow(specs)])),
    headerWrite: (c, text) => {
      const headerCells = isNative ? table.rows[0].cells : table.children[0].children;
      rwTextNodesOf(headerCells[c])[0].nodeValue = text;
    },
    rowTexts: () => body.children.map((row) => row.children.map((c) => c.textContent)),
  };
}

/**
 * Run one case against the page model: the observer stand-in, a fake clock
 * for every timer, and a tree walker over the model's text nodes.
 * page.advance(ms) delivers queued mutation records and runs every timer due
 * inside the window, in due order. page.passes() counts the re-apply timers
 * that ran: timers an observer callback scheduled.
 */
function withRewritePage(fn) {
  const saved = {
    MutationObserver: global.MutationObserver,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    now: Date.now,
    walker: global.document.createTreeWalker,
    createElement: global.document.createElement,
  };
  // No element factory, so the toast view draws nothing for the cap's
  // warning rows; the shape-change case supplies its own for the pillbox.
  delete global.document.createElement;
  const clock = { now: 5000000 };
  const timers = [];
  global.MutationObserver = RewriteObserver;
  global.setTimeout = (callback, ms) => {
    timers.push({ callback, due: clock.now + (ms || 0), cancelled: false, ran: false,
      fromObserver: rwDeliveringToObserver });
    return timers.length - 1;
  };
  global.clearTimeout = (id) => { if (timers[id]) timers[id].cancelled = true; };
  Date.now = () => clock.now;
  global.document.createTreeWalker = (root) => {
    const nodes = rwTextNodesOf(root);
    return { nextNode: () => nodes.shift() || null };
  };
  const page = {
    advance(ms) {
      const until = clock.now + ms;
      for (let guard = 0; guard < 100; guard++) {
        rwDeliverMutations();
        const due = timers.filter((t) => !t.cancelled && !t.ran && t.due <= until)
          .sort((a, b) => a.due - b.due)[0];
        if (!due) break;
        clock.now = Math.max(clock.now, due.due);
        due.ran = true;
        due.callback();
      }
      clock.now = until;
    },
    settle() { page.advance(3000); },
    passes: () => timers.filter((t) => t.ran && t.fromObserver).length,
    pendingPasses: () => timers.filter((t) => !t.ran && !t.cancelled && t.fromObserver).length,
    now: () => clock.now,
  };
  try {
    fn(page);
  } finally {
    global.MutationObserver = saved.MutationObserver;
    global.setTimeout = saved.setTimeout;
    global.clearTimeout = saved.clearTimeout;
    Date.now = saved.now;
    if (saved.walker === undefined) delete global.document.createTreeWalker;
    else global.document.createTreeWalker = saved.walker;
    if (saved.createElement !== undefined) global.document.createElement = saved.createElement;
    rwObservers.length = 0;
  }
}

// Run one case on each table kind, with the table's registry entry and
// every re-apply resource cleared afterwards.
function eachRewriteKind(kinds, run) {
  for (const kind of kinds) {
    withRewritePage((page) => {
      const tables = [];
      const build = (rows, opts) => { const t = rwBuildTable(kind, rows, opts); tables.push(t.table); return t; };
      try {
        run(kind, page, build);
      } catch (e) {
        eq(`#421 a case on the ${kind} kind runs without an exception`, String((e && e.stack) || e), null);
      } finally {
        for (const table of tables) {
          resetTable(table);
          forgetRegisteredTable(table);
        }
      }
    });
  }
}

// Every log row from here on, kept whole: the log's own buffer drops old
// rows, and a pass writes a debug row of its own.
const rwLogged = [];
DR_LOG.onRow((row) => rwLogged.push(row));
const rwRows = (level, pattern) => rwLogged
  .filter((row) => row.level === level && pattern.test(row.text)).length;
const RW_CAP_ROW = /more than the .* the extension follows/;
const RW_UNROUNDED_ROW = /cells were left unrounded/;

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

// --- Test 10: a shape change during a pass. The table re-detects and
// simplifies; the active table changes only when the changed table was the
// active one. ---
(function rewrite10_aShapeChangeDuringAPassReDetects() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const header = ['Region', 'Q1', 'Q2'];
    const rows = [['North', '1,234', '5,678'], ['South', '2,468', '3,579']];
    const active = build(rows, { header });
    const other = build(rows, { header });
    const savedSelected = DR_STORE.getSelectedTable();
    const savedSettings = DR_STORE.getSettings();
    let switches = 0;
    const unsubscribe = DR_BUS.subscribe('state:tableSwitched', () => { switches++; });
    try {
      withToggleDocumentMock(() => {
        createToggleForTable(active.table);
        createToggleForTable(other.table);
        DR_STORE.setSelectedTable(null);
        DR_STORE.setSettings(Object.assign({}, RW_OPTS, { simplifyFirstRow: false }));
        DR_STORE.setSelectedTable(active.table);
        applySidebarRounding(active.table, DR_STORE.getSettings());
        roundTable(other.table, Object.assign({}, RW_OPTS, { simplifyFirstRow: false }));

        other.headerWrite(2, 'Q3');
        page.settle();
        eq(`#421 shape change (${kind}): a change on the inactive table leaves the active table alone`,
          { selected: DR_STORE.getSelectedTable() === active.table, switches }, { selected: true, switches: 0 });
        eq(`#421 shape change (${kind}): the changed table registers fresh with the new header`,
          (DR_STORE.getTableFingerprint(other.table) || {}).headerTexts, ['Region', 'Q1', 'Q3']);
        eq(`#421 shape change (${kind}): the changed table simplifies again`,
          { rounded: isTableRounded(other.table), texts: other.rowTexts() },
          { rounded: true, texts: [['North', '1,200', '5,700'], ['South', '2,500', '3,600']] });

        active.headerWrite(2, 'Q3');
        page.settle();
        eq(`#421 shape change (${kind}): a change on the active table moves the active table to the fresh entry`,
          { selected: DR_STORE.getSelectedTable() === active.table, switches }, { selected: true, switches: 1 });
        eq(`#421 shape change (${kind}): the active table simplifies again`,
          { rounded: isTableRounded(active.table), texts: active.rowTexts() },
          { rounded: true, texts: [['North', '1,200', '5,700'], ['South', '2,500', '3,600']] });
      });
    } finally {
      unsubscribe();
      DR_STORE.setSelectedTable(null);
      DR_STORE.setSettings(savedSettings);
      DR_STORE.setSelectedTable(savedSelected);
    }
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

// A cell left unrounded writes one debug row at the first simplification
// alone, on both table kinds, so a table the page keeps changing writes no
// row on every pass, and no row raises a toast. The native cell's rendered
// text differs from its one piece in more than whitespace; the grid cell's
// text changes between classification and the write. Either way no number
// sits where the pass expects it.
(function rewriteUnroundedCellsRowBelongsToTheFirstSimplification() {
  eachRewriteKind(RW_KINDS, (kind, page, build) => {
    const t = build(RW_ROWS);
    let restoreMagnitude = null;
    if (kind === 'native') {
      t.redraw(1, 1, '3,578');
      Object.defineProperty(t.cell(1, 1), 'innerText', { get: () => '3,579' });
    } else {
      const setMaxMagnitude = DR_STORE.setTableMaxMagnitude;
      DR_STORE.setTableMaxMagnitude = function (table, value) {
        t.pieces(1, 1)[0].nodeValue = '3,578';
        return setMaxMagnitude.call(DR_STORE, table, value);
      };
      restoreMagnitude = () => { DR_STORE.setTableMaxMagnitude = setMaxMagnitude; };
    }
    const before = rwRows('debug', RW_UNROUNDED_ROW);
    try {
      roundTable(t.table, RW_OPTS);
    } finally {
      if (restoreMagnitude) restoreMagnitude();
    }
    eq(`#421 unrounded cells (${kind}): the first simplification writes one debug row with the counts`,
      rwLogged.filter((row) => row.level === 'debug' && RW_UNROUNDED_ROW.test(row.text)).slice(before)
        .map((row) => row.text),
      ['Dynamic Rounding: 1 of 4 cells were left unrounded because the text they show did not match the text they hold.']);
    t.write(0, 0, '4,321');
    page.settle();
    eq(`#421 unrounded cells (${kind}): a later pass writes no further row, and no row is a warn row`,
      { rows: rwRows('debug', RW_UNROUNDED_ROW) - before, warns: rwRows('warn', RW_UNROUNDED_ROW),
        simplified: t.text(0, 0) },
      { rows: 1, warns: 0, simplified: '4,300' });
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

