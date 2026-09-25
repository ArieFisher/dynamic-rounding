// The event bus, the application model, the controller, and the service worker.

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
    roundTable(table, EXTRACTED_PATCH_OPTS);
    const cell = table.rows[0].cells[0];
    eq('patch-honesty: a cell whose patches all skip gets no marker',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('patch-honesty: a cell whose patches all skip gets no hover text',
      cell.title, '');
    eq('patch-honesty: a cell whose patches all skip stores no original',
      DR_STORE.getTableOriginalText(table, cell), undefined);
    eq('patch-honesty: a table whose only change failed keeps form original',
      DR_STORE.getTableAppliedFlag(table), 'original');
    eq('patch-honesty: the failure leaves a debug row, which raises no toast',
      DR_LOG.snapshot().entries.some(
        (row) => row.level === 'debug' && /cells were left unrounded/.test(row.text)),
      true);
  } finally {
    delete global.document.createTreeWalker;
    DR_STORE.unregisterTable(table);
  }
})();

// Control: the same cell with its number where the patch expects it still
// records in full — the honesty gate never blocks a confirmed change.
(function landedExtractedPatchStillRecords() {
  const table = makeMockTable([[
    { tag: 'td', text: 'Cost: 123,456 per month' },
  ]]);
  try {
    withCreateTreeWalker(function () {
      roundTable(table, EXTRACTED_PATCH_OPTS);
    });
    const cell = table.rows[0].cells[0];
    eq('patch-honesty: a landed patch changes the cell text',
      cell.innerText.includes('123,456'), false);
    eq('patch-honesty: a landed patch stamps the marker and hover text',
      cell.classList.contains('dr-ext-rounded') &&
        cell.title === 'Original: Cost: 123,456 per month',
      true);
    eq('patch-honesty: a landed patch stores the original',
      DR_STORE.getTableOriginalText(table, cell), 'Cost: 123,456 per month');
    eq('patch-honesty: a landed patch flips the form',
      DR_STORE.getTableAppliedFlag(table), 'simplified');
  } finally {
    DR_STORE.unregisterTable(table);
  }
})();

// ---------------------------------------------------------------------------
// Sprint sidebar-settings-pull-and-unified-toggle (v1.12.0)
// ---------------------------------------------------------------------------

(function sprintSidebarPullAndUnifiedToggle() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('sprint-sidebar-pull: source file content.js present in manifest', false, true);
    return;
  }
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // --- Sprint app-model-settings inverted this pull: settings now live in
  // DR_STORE (content-script context), so content.js applies from its own
  // model instead of polling the sidebar, and the sidebar asks content.js
  // for the current value instead of answering that old poll. ---

  eq('pull (inverted): content.js no longer sends GET_SIDEBAR_SETTINGS',
    /chrome\.runtime\.sendMessage\(\s*\{\s*action:\s*['"]GET_SIDEBAR_SETTINGS['"]/.test(contentSrc), false);

  eq('pull (inverted): the ten-retry settings-polling function is gone from content.js',
    /requestSidebarSettingsAndApply/.test(contentSrc), false);

  // No timing-based settings access remains: content.js's only other
  // setTimeout use is the unrelated grid-virtualization re-apply debounce
  // (GRID_REAPPLY_DEBOUNCE_MS), which is not a retry loop and does not
  // reference settings/attempt/GET_SIDEBAR_SETTINGS at all.
  const setTimeoutCalls = contentSrc.match(/setTimeout\([\s\S]{0,120}/g) || [];
  eq('pull (inverted): every remaining setTimeout in content.js is the re-apply debounce, not a settings retry',
    setTimeoutCalls.every((call) => !/attempt|GET_SIDEBAR_SETTINGS|requestSidebarSettingsAndApply/.test(call)),
    true);

  eq('pull (inverted): content.js no longer applies defaults on state:sidebarOpened',
    /state:sidebarOpened[\s\S]{0,200}applySidebarRounding\([^)]*DR_DEFAULTS/.test(contentSrc), false);

  eq('pull (inverted): content.js applies the model\'s own settings on state:sidebarOpened',
    /state:sidebarOpened[\s\S]{0,400}applySidebarRounding\([^)]*DR_STORE\.getSettings\(\)/.test(contentSrc), true);

  eq('pull (inverted): sidebar.js no longer handles GET_SIDEBAR_SETTINGS',
    /GET_SIDEBAR_SETTINGS/.test(sidebarSrc), false);

  eq('pull (inverted): content.js answers request:settings with the model\'s settings',
    /respond\('request:settings'[\s\S]{0,200}DR_STORE\.getSettings\(\)/.test(contentSrc), true);

  eq('pull (inverted): sidebar.js asks request:settings on open',
    /DR_BUS\.request\('request:settings'/.test(sidebarSrc), true);

  // --- Unified rounding path: drop data-rounded-value, cache innerHTML ---

  eq('unified: data-rounded-value attribute no longer written',
    /data-rounded-value|dataset\.roundedValue/.test(contentSrc), false);

  // app-model-registry sprint: native-table originals (html/value/supRanges/
  // linkFilteredIdx) and the per-table round options moved off page
  // attributes / a file-level WeakMap into DR_STORE's table registry — see
  // the "table registry" test section below for the full replacement suite.
  eq('unified (superseded by app-model-registry): dataset.originalHtml is no longer written',
    /dataset\.originalHtml\s*=/.test(contentSrc), false);

  // #421: both kinds record one shape through the registry port, and the
  // native markup copy is gone.
  eq('registry: every cell\'s originals are recorded via DR_STORE.setTableOriginal, through the registry port',
    /set\(cellEl, record\)\s*\{\s*DR_STORE\.setTableOriginal\(table, cellEl, record\);/.test(contentSrc) &&
      !/html:\s*cell\.innerHTML/.test(contentSrc), true);

  eq('unified (superseded by app-model-registry): tableOptions WeakMap no longer declared',
    /const\s+tableOptions\s*=\s*new\s+WeakMap/.test(contentSrc), false);

  eq('registry: round options are recorded via DR_STORE.setTableRoundOptions',
    /DR_STORE\.setTableRoundOptions\(table,\s*opts\)/.test(contentSrc), true);

  eq('unified: the apply re-runs roundTable rather than replaying a cached value',
    // Window sized for the locked-table refusal (issue #262) that sits
    // between the function head and the round call.
    /function applySidebarRounding[\s\S]{0,2200}roundTable\(/.test(contentSrc), true);

  // --- Display simplification: "35.0" → "35" when value unchanged but format would ---

  withCreateTreeWalker(function() {
    // Row contains a large number to anchor max_mag=3 so 35 doesn't get rounded
    // away from itself (35 with offset -0.5 → 35), AND a "35.0" cell that should
    // be re-formatted to "35".
    const table = makeMockTable([[
      { tag: 'td', text: '7984' },
      { tag: 'td', text: '35.0' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[1];
    eq('simplify: "35.0" cell marked as rounded',
      cell.classList.contains('dr-ext-rounded'), true);
    eq('simplify: "35.0" cell text rewritten to "35"',
      cell.innerText, '35');
  });

  // Negative: a cell whose format already matches (e.g. "35" with same opts)
  // should NOT be marked as rounded.
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '7984' },
      { tag: 'td', text: '35' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[1];
    eq('simplify: cell with no format or value change stays unmarked',
      cell.classList.contains('dr-ext-rounded'), false);
  });
})();

// Regression: test page Table 8, "Linked number in text". The cell reads
// "See <a>ref 12</a>, total 9,850". The linked 12 holds and 9,850 rounds,
// with no patch left unlanded. Before the fix the number scan took "12,"
// as the match string: the link filter could not find it in one text node
// (the comma sits in the next node) and kept the linked number, and the
// patch step found "12" where it expected "12," and skipped it, logging
// "1 of 2 extracted-cell patches did not land".
(function linkedReferenceFollowedByComma() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      enabled: true, simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedCells: true, simplifyMixedCurrency: true, simplifyMixedPercent: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
    const segments = [
      { text: 'See ', inSup: false, inAnchor: false },
      { text: 'ref 12', inSup: false, inAnchor: true },
      { text: ', total 9,850', inSup: false, inAnchor: false },
    ];
    const cell = makeReactiveCell(segments);
    const table = { rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} };
    const warnRowsBefore = DR_LOG.snapshot().entries
      .filter((row) => /cells were left unrounded/.test(row.text)).length;
    try {
      roundTable(table, opts);
      eq('table 8 linked reference: the linked 12 holds',
        segments[1].text, 'ref 12');
      eq('table 8 linked reference: the plain 9,850 rounds',
        segments[2].text, ', total 10,000');
      eq('table 8 linked reference: the cell records as simplified',
        cell.classList.contains('dr-ext-rounded'), true);
      // The registry record holds the flat-text index of every match that
      // survived the link filter. Without the fix the linked "12," survived
      // too and this read [8, 18]; the log-row count below can miss that
      // when the 50-row buffer drops an older patch row on the same push.
      eq('table 8 linked reference: only the plain number survives the link filter',
        DR_STORE.getTableOriginal(table, cell).linkFilteredIdx, [18]);
      const warnRowsAfter = DR_LOG.snapshot().entries
        .filter((row) => /cells were left unrounded/.test(row.text)).length;
      eq('table 8 linked reference: no patch is left unlanded',
        warnRowsAfter, warnRowsBefore);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function prettyPrintedExtractedCellRounds() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      enabled: true, simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedCells: true, simplifyMixedCurrency: true, simplifyMixedPercent: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
    const segments = [{ text: '\n            Grew 9,850 units\n          ', inSup: false, inAnchor: false }];
    const cell = makePrettyPrintedCell(segments);
    const table = { rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} };
    const warnRowsBefore = DR_LOG.snapshot().entries
      .filter((row) => /cells were left unrounded/.test(row.text)).length;
    try {
      roundTable(table, opts);
      eq('table 21 line breaks: the number inside words rounds, and the line breaks stay',
        segments[0].text, '\n            Grew 10,000 units\n          ');
      eq('table 21 line breaks: the cell records as simplified',
        cell.classList.contains('dr-ext-rounded'), true);
      eq('table 21 line breaks: the stored original is the rendered text',
        (DR_STORE.getTableOriginal(table, cell) || {}).value, 'Grew 9,850 units');
      const warnRowsAfter = DR_LOG.snapshot().entries
        .filter((row) => /cells were left unrounded/.test(row.text)).length;
      eq('table 21 line breaks: no patch is left unlanded',
        warnRowsAfter, warnRowsBefore);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

// A footnote in a pretty-printed cell: the superscript range counts in flat
// text and converts to rendered positions, so the footnote digit stays
// masked and the quantity beside it rounds.
(function prettyPrintedFootnoteStaysMasked() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      enabled: true, simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedCells: true, simplifyMixedCurrency: true, simplifyMixedPercent: true,
      simplifyDates: false, simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
    const segments = [
      { text: '\n      Total\n      9,850 kg\n      ', inSup: false },
      { text: '7', inSup: true },
      { text: '\n    ', inSup: false },
    ];
    const cell = makePrettyPrintedCell(segments);
    const table = { rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} };
    try {
      roundTable(table, opts);
      eq('pretty-printed footnote: the quantity rounds',
        segments[0].text, '\n      Total\n      10,000 kg\n      ');
      eq('pretty-printed footnote: the footnote digit holds',
        segments[1].text, '7');
      eq('pretty-printed footnote: the stored superscript range counts in the rendered text',
        (DR_STORE.getTableOriginal(table, cell) || {}).supRanges, [{ start: 15, end: 16 }]);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function nativePureCell_prettyPrintedRoundsInItsPiece() {
  withReactiveCreateTreeWalker(function () {
    const segments = [{ text: '\n      4,523,789\n    ', inSup: false }];
    const cell = makePrettyPrintedCell(segments);
    const table = { rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} };
    try {
      roundTable(table, nativeOnePieceOpts());
      eq('native pure cell: a pretty-printed value rounds, and the line breaks stay',
        segments[0].text, '\n      4,500,000\n    ');
      eq('native pure cell: the stored original is the rendered text',
        (DR_STORE.getTableOriginal(table, cell) || {}).value, '4,523,789');
      eq('native pure cell: the cell records as simplified',
        cell.classList.contains('dr-ext-rounded'), true);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function nativePureCell_valueAcrossPiecesStaysUnchanged() {
  withReactiveCreateTreeWalker(function () {
    // "4,523," plain and "789" in bold: one number across two text pieces.
    const segments = [{ text: '4,523,', inSup: false }, { text: '789', inSup: false }];
    const cell = makeReactiveCell(segments);
    const table = { rows: [{ cells: [cell] }], querySelector: () => null, dataset: {} };
    try {
      roundTable(table, nativeOnePieceOpts());
      eq('native pure cell across pieces: the first piece keeps its text',
        segments[0].text, '4,523,');
      eq('native pure cell across pieces: the second piece keeps its text',
        segments[1].text, '789');
      eq('native pure cell across pieces: the cell gets no marker',
        cell.classList.contains('dr-ext-rounded'), false);
      eq('native pure cell across pieces: the cell stores no original',
        DR_STORE.getTableOriginal(table, cell), undefined);
      eq('native pure cell across pieces: a debug row records the skip',
        DR_LOG.snapshot().entries.some((row) => row.level === 'debug' &&
          /native cell value split across text pieces/.test(row.text)), true);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

// ---------------------------------------------------------------------------
// Issue #251 (sync-on-switch): a switch with the sidebar open applies the
// MODEL's settings to the clicked table — the panel then mirrors the model,
// and the table matches what the panel shows. Two cells: a non-default
// offset reaches the new table's rounding pass, and a model holding
// enabled:false leaves the new table unrounded.
// ---------------------------------------------------------------------------

(function issue251_switchAppliesModelToNewTable() {
  const savedSettings = DR_STORE.getSettings();
  DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { offsetTop: -2, offsetOther: -2 }));

  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });
  // The value that must visibly round under offsetTop -2 sits in the SECOND
  // column: the shipped defaults leave the first column alone, and 286 at
  // offset -2 rounds to itself, so a first-column 8,584,629 would let a
  // defaults-run pass hide.
  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '286' }, { tag: 'td', text: '8,584,629' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = () => {};

  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  const rounded = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));
  const usedOpts = DR_STORE.getTableRoundOptions(tableB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;
  DR_STORE.setSettings(savedSettings);

  eq('sync-on-switch: the clicked table is rounded (model enabled is on)',
    rounded, true);
  eq('sync-on-switch: the rounding pass ran with the model\'s offset, not the shipped default',
    usedOpts && usedOpts.offsetTop, -2);
})();

(function issue251_switchRespectsModelEnabledOff() {
  const savedSettings = DR_STORE.getSettings();
  DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));

  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });
  // Values that visibly change under the shipped default offset (see the
  // wire-message test's note: 1,000,000-style values round to themselves
  // and would let a wrongly-run rounding pass hide).
  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = () => {};

  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  const rounded = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));
  const flag = DR_STORE.getTableAppliedFlag(tableB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;
  DR_STORE.setSettings(savedSettings);

  eq('press on a different table simplifies it even where the settings record stands at off (part one: the flip reads the screen)',
    rounded, true);
  eq('press on a different table sets its form to simplified where the record stood at off (part one: the flip reads the screen)',
    flag, 'simplified');
})();

// Switching onto a LOCKED table (issue #262): the clicked table carries a
// dr-ext-rounded cell with no registry original, so the switch apply's
// resetTable refuses. The pin here is the ORDER — state:tableSwitched must leave
// before state:applyBlocked, because the sidebar lifts the PREVIOUS table's lock
// on state:tableSwitched and the new table's state:applyBlocked must land after that
// lift to re-lock the panel. A send moved after the apply would leave a
// stuck table showing an unlocked panel with nothing failing.
//
// The intent is published straight onto the bus: the view refuses clicks on
// a locked pill (issue #263's aria-disabled guard), but a table can become
// unrestorable between pill syncs, so the controller's own entry point must
// hold the order on its own.
(function issue251_switchOntoLockedTablePinsMessageOrder() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });
  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });
  // The unrestorable pairing: rounded class, no DR_STORE original.
  tableB._cells[2].classList.add('dr-ext-rounded');

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  lastRightClickedTable = tableA;

  DR_BUS.publish('intent:toggleTable', { table: tableB });

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  eq('locked-switch: the sequence is state:tableSwitched then state:applyBlocked, nothing else',
    sentMessages.map(m => m.action), ['state:tableSwitched', 'state:applyBlocked']);
  eq('locked-switch: state:applyBlocked carries the unrestorable-cell count',
    sentMessages[1] && sentMessages[1].count, 1);
})();

(function gridPatch_roundWritesEachChangeIntoItsPiece() {
  const { grid } = makePatchGrid();
  const [a, b, c, d] = grid.cellEls;
  const piecesBefore = grid.cellEls.map(gridCellTextPieces);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch: a number between whitespace pieces changes in its own piece',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);
    eq('grid patch: whitespace inside the patched piece stays',
      pieceTextsOf(b), [' 7,500,000 ']);
    eq('grid patch: a number after a piece of its own patches at that piece\'s position',
      pieceTextsOf(c), ['$', '2,000,000']);
    eq('grid patch: a plain one-piece cell rounds as before',
      pieceTextsOf(d), ['1,000,000']);
    eq('grid patch: every text piece is the same node object after the round',
      grid.cellEls.every((cell, k) => {
        const after = gridCellTextPieces(cell);
        return after.length === piecesBefore[k].length &&
          after.every((node, n) => node === piecesBefore[k][n]);
      }), true);
    eq('grid patch: every rounded cell carries the marker class',
      grid.cellEls.every((cell) => cell.classList.contains('dr-ext-rounded')), true);
    eq('grid patch: the landed writes set the form to simplified',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'simplified');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
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
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_recordHoldsTheReadTextAndEachTouchedPiece() {
  const { grid } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch: the record holds the flat text and each piece\'s original and written text',
      DR_STORE.getTableOriginal(grid.wrapperEl, a),
      { value: ' 8,584,629 ',
        pieces: [{ text: ' ', written: ' ' }, { text: '8,584,629', written: '8,500,000' }, { text: ' ', written: ' ' }],
        supRanges: null, linkFilteredIdx: null });
    eq('grid patch: a piece\'s whitespace is part of its stored text',
      DR_STORE.getTableOriginal(grid.wrapperEl, b),
      { value: ' 7,318,204 ', pieces: [{ text: ' 7,318,204 ', written: ' 7,500,000 ' }], supRanges: null, linkFilteredIdx: null });
    eq('grid patch: the plain-text read of a record is its value',
      DR_STORE.getTableOriginalText(grid.wrapperEl, a), ' 8,584,629 ');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_resetPutsEveryPieceBack() {
  const { grid } = makePatchGrid();
  const [a, b, c, d] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const unrestorable = resetTable(grid.wrapperEl);
    eq('grid patch reset: every cell restores', unrestorable, 0);
    eq('grid patch reset: each piece holds its original text again',
      [pieceTextsOf(a), pieceTextsOf(b), pieceTextsOf(c), pieceTextsOf(d)],
      [[' ', '8,584,629', ' '], [' 7,318,204 '], ['$', '2,140,663'], ['1,234,567']]);
    eq('grid patch reset: the records are cleared',
      grid.cellEls.map((cell) => DR_STORE.hasTableOriginal(grid.wrapperEl, cell)),
      [false, false, false, false]);
    eq('grid patch reset: the marker classes are removed',
      grid.cellEls.some((cell) => cell.classList.contains('dr-ext-rounded')), false);
    eq('grid patch reset: the form is original',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'original');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// Issue #423: a cell the page redrew with fewer pieces is a rewritten cell.
// The restore keeps the page's text in it and drops its record and marker,
// so nothing counts unrestorable and the table never locks over it.
(function gridPatch_aCellWithFewerPiecesKeepsThePagesText() {
  const { grid } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    // The page redraws cell a with one piece; the record's pieces no longer
    // line up with the cell's.
    setGridCellPieces(a, [makeTextNode('9,100,000')]);
    const unrestorable = resetTable(grid.wrapperEl);
    eq('grid patch reset: a cell redrawn with fewer pieces counts as restored', unrestorable, 0);
    eq('grid patch reset: the redrawn cell keeps the page\'s text',
      pieceTextsOf(a), ['9,100,000']);
    eq('grid patch reset: the redrawn cell drops its marker and record',
      { marked: a.classList.contains('dr-ext-rounded'), record: DR_STORE.hasTableOriginal(grid.wrapperEl, a) },
      { marked: false, record: false });
    eq('grid patch reset: the other cells restore',
      pieceTextsOf(b), [' 7,318,204 ']);
    eq('grid patch reset: with every cell restored, the form is original',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'original');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_reapplyWritesOnlyWhereTheOriginalStands() {
  const { grid, aNumber } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
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
    // simplifies the page's value fresh (#421).
    b.childNodes[0].nodeValue = ' 7,318,204.5 ';
    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece whose text the page changed simplifies the page\'s value',
      { pieces: pieceTextsOf(b), original: DR_STORE.getTableOriginalText(grid.wrapperEl, b) },
      { pieces: [' 7,500,000 '], original: ' 7,318,204.5 ' });
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
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

// ---------------------------------------------------------------------------
// Sprint pending-retest: a grid that arrives before its rows registers when
// the rows arrive.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.4 and the
// pending-retest block in §5; the re-test cap's reasoning in §6.
// ---------------------------------------------------------------------------
//
// The rule these assertions pin, in the specification's words:
//   - A chain root whose containment chain is empty — no qualifying element of
//     its nest passes the data test — becomes a pending table: one debounced
//     subtree observer on the chain root, watching childList, characterData,
//     and subtree.
//   - A change to the subtree runs the nomination step from the root again. A
//     registration clears the pending record and disconnects the observer.
//   - A re-test that still finds the chain empty counts against
//     DR_DETECTION_SETTINGS.pendingRetestCap; reaching the cap drops the observer, the
//     timer, and the count, and records a debug log row.
//   - The pending unit is the chain root, so a nest of several qualifying
//     elements carries one observer.
//
// Every expected value below comes from that statement, never from the
// controller's source.

// The row pairs a database query grid draws once its rows arrive: a row-number
// gutter row in the pinned pane, and an identifier with a count and a rate in
// the scrolling pane. Invented values, one order of magnitude apart.
const PENDING_FILL_ROWS = [
  ['alpha', '7,318,204', '284.51'],
  ['bravo', '551,077', '31.77'],
  ['charlie', '2,140,663', '58.02'],
];

// --- Criterion 1: a container inserted empty and then filled registers ---

(function pendingRetest_AC1_aLoneContainerFilledLaterRegistersAndGainsAPillbox() {
  const lone = makeDgNode('DIV', 'lone-pending-grid', 'grid', []);
  const before = DR_STORE.getRegisteredTables().length;

  eq('pending AC1: the suite holds no pending table before this case',
    pendingRoots.size, 0);

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(lone);
    });

    eq('pending AC1: an empty container registers nothing',
      DR_STORE.hasTable(lone), false);
    eq('pending AC1: an empty container gains no pillbox', tableToggles.has(lone), false);
    eq('pending AC1: an empty container is held as a pending table',
      pendingRoots.has(lone), true);
    eq('pending AC1: the empty container carries one observer', observers.length, 1);

    // The rows arrive, each holding a number.
    PENDING_FILL_ROWS.forEach((cellTexts, i) => appendDgChild(lone, makeDgRow(i, cellTexts)));
    eq('pending AC1: the filled container passes the data test', isDataTable(lone), true);

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending AC1: one mutation schedules one re-test', runPendingRetestTimers(timers), 1);
    });

    eq('pending AC1: the filled container registers', DR_STORE.hasTable(lone), true);
    eq('pending AC1: the filled container gains a pillbox', tableToggles.has(lone), true);
    eq('pending AC1: the registration drops the pending record',
      pendingRoots.has(lone), false);
    eq('pending AC1: the registration disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending AC1: the registration adds exactly one registry entry',
      DR_STORE.getRegisteredTables().length - before, 1);
  });

  forgetRegisteredTable(lone);
})();

(function pendingRetest_AC1_anEmptyDatabaseQueryGridFilledLaterRegistersItsScrollingPane() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const before = DR_STORE.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    eq('pending AC1: an empty database query grid registers nothing',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, false]);
    eq('pending AC1: an empty database query grid holds the wrapper as a pending table',
      pendingRoots.has(grid.wrapperEl), true);
    eq('pending AC1: the empty wrapper carries one observer', observers.length, 1);

    fillDatabaseQueryGrid(grid);

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending AC1: one fill schedules one re-test', runPendingRetestTimers(timers), 1);
    });

    eq('pending AC1: the filled grid registers the scrolling pane alone',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, true]);
    eq('pending AC1: the scrolling pane gains a pillbox',
      tableToggles.has(grid.scrollPaneEl), true);
    eq('pending AC1: the wrapper gains no pillbox', tableToggles.has(grid.wrapperEl), false);
    eq('pending AC1: the pinned pane gains no pillbox',
      tableToggles.has(grid.pinnedPaneEl), false);
    eq('pending AC1: the registration drops the wrapper\'s pending record',
      pendingRoots.has(grid.wrapperEl), false);
    eq('pending AC1: the registration disconnects the wrapper\'s observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending AC1: the fill adds exactly one registry entry',
      DR_STORE.getRegisteredTables().length - before, 1);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- Criterion 2: one observer per pending wrapper ---

(function pendingRetest_AC2_aPendingWrapperCarriesOneObserverForThreeElements() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const extraPaneEl = appendDgChild(grid.wrapperEl,
    makeDgNode('DIV', 'dg--grid-container dg--extra-pane', 'grid', []));

  eq('pending AC2: three role-bearing elements sit under the empty wrapper',
    [grid.pinnedPaneEl, grid.scrollPaneEl, extraPaneEl]
      .map((el) => el.parentElement === grid.wrapperEl), [true, true, true]);
  eq('pending AC2: no element of the empty nest passes the data test',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl, extraPaneEl].map(isDataTable),
    [false, false, false, false]);

  withPendingHarness(function ({ observers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    eq('pending AC2: a nest of four qualifying elements carries one observer',
      observers.length, 1);
    eq('pending AC2: the one observer watches the chain root',
      observers[0] && observers[0].observeCalls.length === 1 &&
        observers[0].observeCalls[0].target === grid.wrapperEl, true);
    eq('pending AC2: the observer watches added nodes, changed text, and the whole subtree',
      observers[0] && observers[0].observeCalls[0].options,
      { childList: true, characterData: true, subtree: true });

    // A second pass over the same empty wrapper holds the record it already
    // has rather than starting a second one.
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });
    eq('pending AC2: a second pass over the same empty wrapper adds no second observer',
      observers.length, 1);
    eq('pending AC2: a second pass leaves one pending root', pendingRoots.size, 1);

    dropPendingTable(grid.wrapperEl);
  });

  eq('pending AC2: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// --- Criterion 3: the re-test cap bounds a container that never passes ---
//
// The container holds rows of text and no number, so every re-test finds the
// chain empty. The debounce is driven once per re-test, the way a subtree that
// churns without loading data drives it.

(function pendingRetest_AC3_aContainerThatNeverPassesStopsAtTheCap() {
  const neverEl = makeDgNode('DIV', 'never-a-data-grid', 'grid', [
    makeDgRow(0, ['alpha', 'north', 'open']),
    makeDgRow(1, ['bravo', 'south', 'open']),
    makeDgRow(2, ['charlie', 'east', 'open']),
  ]);
  eq('pending AC3: a container of text rows never passes the data test',
    isDataTable(neverEl), false);
  eq('pending AC3: the detection settings ship a re-test cap of 100',
    DR_DETECTION_SETTINGS.pendingRetestCap, 100);

  // The log buffer holds the last 50 rows and counts the rows that dropped off
  // the front, so the two together give a running total this case can subtract
  // to find the rows it recorded itself.
  const recordedRows = () => {
    const snapshot = DR_LOG.snapshot();
    return snapshot.dropped + snapshot.entries.length;
  };
  const logRowsBefore = recordedRows();

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(neverEl);
    });

    eq('pending AC3: the container is held as a pending table',
      pendingRoots.has(neverEl), true);
    eq('pending AC3: the held container starts at zero failed re-tests',
      pendingRetestCounts.get(neverEl), 0);

    const observer = observers[0];
    // One short of the cap: the observer stays connected.
    for (let i = 0; i < DR_DETECTION_SETTINGS.pendingRetestCap - 1; i++) {
      if (observer) observer.trigger();
      runPendingRetestTimers(timers);
    }
    eq('pending AC3: one short of the cap the count reads the failed re-tests',
      pendingRetestCounts.get(neverEl), DR_DETECTION_SETTINGS.pendingRetestCap - 1);
    eq('pending AC3: one short of the cap the observer stays connected',
      observer && observer.disconnectCount, 0);
    eq('pending AC3: one short of the cap the container is still pending',
      pendingRoots.has(neverEl), true);

    // The re-test that reaches the cap.
    if (observer) observer.trigger();
    runPendingRetestTimers(timers);

    eq('pending AC3: reaching the cap disconnects the observer',
      observer && observer.disconnectCount, 1);
    eq('pending AC3: reaching the cap drops the pending root',
      pendingRoots.has(neverEl), false);
    eq('pending AC3: reaching the cap drops the failed-re-test count',
      pendingRetestCounts.has(neverEl), false);
    eq('pending AC3: reaching the cap drops the debounce timer',
      pendingRetestTimers.has(neverEl), false);
    eq('pending AC3: reaching the cap leaves the observer map empty for the root',
      pendingObservers.has(neverEl), false);
    eq('pending AC3: the dropped container registers nothing',
      DR_STORE.hasTable(neverEl), false);

    const added = recordedRows() - logRowsBefore;
    const entries = DR_LOG.snapshot().entries;
    const newRows = entries.slice(Math.max(0, entries.length - added));
    eq('pending AC3: the cap cycle records at least one log row', added >= 1, true);
    eq('pending AC3: reaching the cap records a debug log row naming the pending table',
      newRows.some((row) => row.level === 'debug' && /pending table/i.test(row.text)), true);

    // A later mutation on the dropped container costs nothing: no observer
    // remains to run, and the record is gone.
    eq('pending AC3: the dropped container holds no pending record',
      pendingRoots.size, 0);
  });
})();

// --- Adversarial: a re-test that finds the nest registered ends the record ---
//
// The vocabulary row states the rule: a re-test that finds the nest already
// registered ends the pending table, as does one that finds its configured
// depth crowded. The registration here goes through the pillbox builder
// directly, which is the route a right-click takes today — the pending record
// stands until the next re-test, and that re-test is what drops it. Without
// this the record outlives the registration: a live observer on a subtree the
// extension already registered, re-testing until it reaches the cap.

(function pendingRetest_aRegisteredRetestEndsThePendingRecord() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const before = DR_STORE.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    eq('pending registered: the empty wrapper is held as a pending table',
      pendingRoots.has(grid.wrapperEl), true);
    eq('pending registered: the empty wrapper carries one observer', observers.length, 1);

    // The rows arrive, and another route registers the scrolling pane before
    // the re-test runs.
    fillDatabaseQueryGrid(grid);
    withToggleDocumentMock(function () {
      createToggleForTable(grid.scrollPaneEl);
    });
    eq('pending registered: the other route registered the scrolling pane',
      DR_STORE.hasTable(grid.scrollPaneEl), true);
    eq('pending registered: the pending record still stands before the re-test',
      pendingRoots.has(grid.wrapperEl), true);

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending registered: one mutation schedules one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending registered: a re-test over a registered nest drops the pending root',
      pendingRoots.has(grid.wrapperEl), false);
    eq('pending registered: a re-test over a registered nest disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending registered: the observer map holds nothing for the wrapper',
      pendingObservers.has(grid.wrapperEl), false);
    eq('pending registered: the failed-re-test count map holds nothing for the wrapper',
      pendingRetestCounts.has(grid.wrapperEl), false);
    eq('pending registered: the debounce timer map holds nothing for the wrapper',
      pendingRetestTimers.has(grid.wrapperEl), false);
    eq('pending registered: the nest holds one registry entry in all',
      DR_STORE.getRegisteredTables().length - before, 1);
    eq('pending registered: the re-test puts no second pillbox on the nest',
      [tableToggles.has(grid.wrapperEl), tableToggles.has(grid.pinnedPaneEl)], [false, false]);
    eq('pending registered: no pending root remains', pendingRoots.size, 0);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- Adversarial: a re-test that finds the depth crowded ends the record ---
//
// A crowded nest registers nothing, by the product decision in issue #373, and
// it registers nothing on every later re-test for the same reason. Holding the
// record would leave an observer re-testing a shape whose answer cannot change
// until the page rebuilds it.

(function pendingRetest_aCrowdedRetestEndsThePendingRecord() {
  const rootEl = makeDgNode('DIV', 'crowded-pending-root', 'table', []);
  const nest = makeCrowdedNest();
  const before = DR_STORE.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(rootEl);
    });

    eq('pending crowded: the empty root is held as a pending table',
      pendingRoots.has(rootEl), true);
    eq('pending crowded: the empty root carries one observer', observers.length, 1);

    // The page draws a row group of text rows and two panes that each pass the
    // data test, which puts two elements at the configured depth.
    nest.rootEl.children.slice().forEach((child) => appendDgChild(rootEl, child));
    eq('pending crowded: the filled root still fails the data test',
      isDataTable(rootEl), false);
    eq('pending crowded: both panes pass the data test',
      [nest.paneAEl, nest.paneBEl].map(isDataTable), [true, true]);
    eq('pending crowded: the filled nest reports the crowded outcome',
      nominateNest(rootEl).outcome, 'crowded');

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending crowded: one mutation schedules one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending crowded: a crowded re-test drops the pending root',
      pendingRoots.has(rootEl), false);
    eq('pending crowded: a crowded re-test disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending crowded: the observer map holds nothing for the root',
      pendingObservers.has(rootEl), false);
    eq('pending crowded: the failed-re-test count map holds nothing for the root',
      pendingRetestCounts.has(rootEl), false);
    eq('pending crowded: the debounce timer map holds nothing for the root',
      pendingRetestTimers.has(rootEl), false);
    eq('pending crowded: a crowded nest registers no element',
      [rootEl, nest.paneAEl, nest.paneBEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, false]);
    eq('pending crowded: a crowded nest gains no pillbox',
      [rootEl, nest.paneAEl, nest.paneBEl].map((el) => tableToggles.has(el)),
      [false, false, false]);
    eq('pending crowded: a crowded nest adds no registry entry',
      DR_STORE.getRegisteredTables().length - before, 0);
    eq('pending crowded: no pending root remains', pendingRoots.size, 0);
  });
})();

// --- Adversarial: the debounce collapses a burst of mutations into one re-test ---

(function pendingRetest_twoMutationsInsideTheDelayScheduleOneRetest() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    const observer = observers[0];
    if (observer) observer.trigger();
    if (observer) observer.trigger();

    const scheduled = timers.filter((t) => t.ms === DR_DETECTION_SETTINGS.gridRedrawDelayMs);
    eq('pending debounce: two mutations schedule two timers and cancel the first',
      scheduled.map((t) => t.cancelled), [true, false]);
    eq('pending debounce: the delay is the grid redraw delay',
      scheduled.every((t) => t.ms === DR_DETECTION_SETTINGS.gridRedrawDelayMs), true);

    fillDatabaseQueryGrid(grid);
    withToggleDocumentMock(function () {
      eq('pending debounce: two mutations inside the delay run one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending debounce: the one re-test registers the scrolling pane',
      DR_STORE.hasTable(grid.scrollPaneEl), true);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
  eq('pending debounce: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection: the application model (app/store.js, DR_STORE)
// and the typed event bus (adapters/messaging.js, DR_BUS). The selected
// table and the sidebar-open flag moved out of content.js's file-level lets
// into DR_STORE; ui-toggle.js reports an intent through DR_BUS instead of
// writing content.js's variables directly.
// ---------------------------------------------------------------------------
(function appModelSelection_storeAndBus() {
  const busSrc = sourceByName('adapters/messaging.js');
  const storeSrc = sourceByName('app/store.js');
  if (busSrc === null || storeSrc === null) {
    eq('app-model-selection: adapters/messaging.js and app/store.js are present in the manifest', false, true);
    return;
  }

  // --- (a) discipline: one top-level declaration per file, like the lib
  // packages' index.js bundles. ---
  const topLevelDecls = (src) => src.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('adapters/messaging.js: exactly one top-level declaration in the file',
    topLevelDecls(busSrc).length, 1);
  eq('adapters/messaging.js: the sole top-level declaration is DR_BUS',
    /^const DR_BUS\b/m.test(busSrc), true);
  eq('app/store.js: exactly one top-level declaration in the file',
    topLevelDecls(storeSrc).length, 1);
  eq('app/store.js: the sole top-level declaration is DR_STORE',
    /^const DR_STORE\b/m.test(storeSrc), true);

  // --- (a) discipline: DR_BUS.TOPICS enumerates every topic with a family,
  // and no topic falls outside the two families. ---
  // Issue #325 added the third family, request: a topic whose one responder
  // returns an answer to the publisher.
  const KNOWN_FAMILIES = ['intent', 'state-change', 'request'];
  const topics = DR_BUS.TOPICS;
  const topicNames = Object.keys(topics);
  eq('DR_BUS.TOPICS: at least one topic is registered',
    topicNames.length > 0, true);
  eq('DR_BUS.TOPICS: every topic belongs to one of the three known families',
    topicNames.every((t) => KNOWN_FAMILIES.includes(topics[t].family)), true);
  eq('DR_BUS.TOPICS: enumerates exactly the expected topics',
    topicNames.slice().sort(),
    ['intent:selectTable', 'intent:toggleTable', 'state:selectedTableChanged',
     'state:settingsChanged',
     // The model's error state, published to the toast view in the same context.
     'state:errorRecorded',
     // The sidebar's four requests, each answered by the tab's content script.
     'request:applySettings', 'request:settings', 'request:previewSamples',
     'request:captureState',
     // The service worker's four, plus the two it receives (#325).
     'intent:menuClicked', 'state:sidebarOpened', 'intent:closeSidebar',
     'state:sidebarClosed', 'state:pageUnloaded', 'intent:updateMenuLabel',
     // The content script's eight reports to the sidebar.
     'state:tableActivated', 'state:tableSwitched', 'state:tableEnabledChanged',
     'state:rangeError', 'state:rangeOk', 'state:applyBlocked', 'state:applyOk',
     'state:previewSamplesChanged'].sort());

  // Every moved topic, each with the family and route the topic table states.
  // A route is the one fact that determines which contexts a publish reaches,
  // so a wrong one here delivers to the wrong audience in silence.
  const WORKER_TOPICS = {
    'intent:menuClicked': ['intent', 'tab'],
    'state:sidebarOpened': ['state-change', 'tab'],
    'intent:closeSidebar': ['intent', 'extension-pages'],
    'state:sidebarClosed': ['state-change', 'extension-pages'],
    'state:pageUnloaded': ['state-change', 'extension-pages'],
    'intent:updateMenuLabel': ['intent', 'extension-pages'],
    // The content script's eight reports. Every one broadcasts: the content
    // script holds no tabs interface, and the sidebar is an extension page.
    'state:tableActivated': ['state-change', 'extension-pages'],
    'state:tableSwitched': ['state-change', 'extension-pages'],
    'state:tableEnabledChanged': ['state-change', 'extension-pages'],
    'state:rangeError': ['state-change', 'extension-pages'],
    'state:rangeOk': ['state-change', 'extension-pages'],
    'state:applyBlocked': ['state-change', 'extension-pages'],
    'state:applyOk': ['state-change', 'extension-pages'],
    'state:previewSamplesChanged': ['state-change', 'extension-pages'],
  };
  for (const name of Object.keys(WORKER_TOPICS)) {
    const [family, route] = WORKER_TOPICS[name];
    eq('DR_BUS.TOPICS: ' + name + ' is in the ' + family + ' family',
      topics[name] && topics[name].family, family);
    eq('DR_BUS.TOPICS: ' + name + ' carries the ' + route + ' route',
      topics[name] && topics[name].route, route);
  }
  eq('DR_BUS.TOPICS: intent:selectTable is in the intent family',
    topics['intent:selectTable'].family, 'intent');
  // Sprint toggle-split: the toggle view's click handler changes no table
  // itself — it publishes intent:toggleTable, and content.js (the sole
  // subscriber) determines what a committed toggle does.
  eq('DR_BUS.TOPICS: intent:toggleTable is in the intent family',
    topics['intent:toggleTable'].family, 'intent');
  eq('DR_BUS.TOPICS: state:selectedTableChanged is in the state-change family',
    topics['state:selectedTableChanged'].family, 'state-change');
  // The sidebar's settings apply. It carried the intent family and the
  // request:applySettings name on the wire until issue #325; the content
  // script always answered it, and the sidebar always read whether anyone
  // answered to decide bound versus unbound, so it is a request.
  eq('DR_BUS.TOPICS: request:applySettings is in the request family',
    topics['request:applySettings'].family, 'request');
  eq('DR_BUS.TOPICS: state:settingsChanged is in the state-change family',
    topics['state:settingsChanged'].family, 'state-change');
  eq('DR_BUS.TOPICS: request:applySettings routes to one tab\'s content script (cross-context: sidebar page -> content script)',
    topics['request:applySettings'].route, 'tab');
  eq('DR_BUS.TOPICS: state:settingsChanged has no route (same-context: model -> controller only)',
    topics['state:settingsChanged'].route, null);

  // Publishing to an unregistered topic is rejected rather than silently
  // dropped, so the registry stays authoritative rather than aspirational.
  let unknownTopicThrew = null;
  try {
    DR_BUS.publish('not:a:real:topic', {});
  } catch (e) {
    unknownTopicThrew = e.message;
  }
  eq('DR_BUS.publish: an unregistered topic throws instead of publishing silently',
    typeof unknownTopicThrew, 'string');

  // --- (b) publishing the intent changes the model and emits the
  // resulting state-change with the whole new value. ---
  const originalSelected = DR_STORE.getSelectedTable();
  try {
    const fakeTable = { __fake: 'table-A' };
    let stateChangePayload = 'NOT_CALLED';
    const unsubscribe = DR_BUS.subscribe('state:selectedTableChanged', (payload) => {
      stateChangePayload = payload;
    });
    try {
      DR_BUS.publish('intent:selectTable', { table: fakeTable });
    } finally {
      unsubscribe();
    }
    eq('intent:selectTable: publishing the intent updates DR_STORE.getSelectedTable()',
      DR_STORE.getSelectedTable(), fakeTable);
    eq('intent:selectTable: the resulting state-change fires exactly once, carrying the whole new value',
      stateChangePayload, { table: fakeTable });
  } finally {
    DR_STORE.setSelectedTable(originalSelected);
  }

  // --- (c) reconnect: closing and reopening the sidebar must pull the
  // model's current snapshot, not depend on a state-change message the
  // sidebar could have missed while it was gone (the bus keeps no history). ---
  const savedSelected = DR_STORE.getSelectedTable();
  try {
    const reconnectTable = { __fake: 'table-B' };
    DR_STORE.setSelectedTable(reconnectTable);

    // No message is replayed here on purpose — a reconnecting view pulls,
    // it does not listen for what it missed. The store carried a third
    // field, "the sidebar is open", until the 2026-09-14 sidebar-state-
    // removal design retired it (#241); what a reopen pulls is the
    // selection and the settings.
    const snapshot = DR_STORE.getSnapshot();
    eq('reconnect: getSnapshot returns the selection to a reconnecting view',
      snapshot.selectedTable, reconnectTable);
    eq('reconnect: the snapshot carries the settings alongside the selection',
      snapshot.settings, DR_STORE.getSettings());
    eq('reconnect: the snapshot carries no sidebar-open field — the model holds none',
      Object.prototype.hasOwnProperty.call(snapshot, 'sidebarOpen'), false);
    eq('reconnect: the model exposes no reader for a sidebar-open value',
      typeof DR_STORE.isSidebarOpen, 'undefined');
    eq('reconnect: the model exposes no writer for a sidebar-open value',
      typeof DR_STORE.setSidebarOpen, 'undefined');
    eq('reconnect: selectedTable survives for the reopening view to pull',
      DR_STORE.getSelectedTable(), reconnectTable);
  } finally {
    DR_STORE.setSelectedTable(savedSelected);
  }

  // --- (d) no file writes another file's variables: build the list of
  // identifiers content.js declares at its top level, then confirm
  // ui-toggle.js contains no assignment to any of them. ---
  const contentSrcForScan = sourceByName('content.js');
  const uiToggleSrcForScan = sourceByName('ui-toggle.js');
  const topLevelBindingNames = (src) => {
    const names = [];
    const re = /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
    let match;
    while ((match = re.exec(src))) names.push(match[1]);
    return names;
  };
  const contentTopLevelNames = topLevelBindingNames(contentSrcForScan);
  eq('static scan: content.js still declares its usual top-level bindings (sanity check on the scan itself)',
    contentTopLevelNames.includes('lastRightClickedElement') && contentTopLevelNames.includes('reapplyObservers'),
    true);
  eq('static scan: content.js no longer declares lastRightClickedTable at top level',
    contentTopLevelNames.includes('lastRightClickedTable'),
    false);
  const crossFileWrites = contentTopLevelNames.filter((name) => {
    const assignRe = new RegExp('\\b' + name + '\\s*=[^=]');
    return assignRe.test(uiToggleSrcForScan);
  });
  eq("static scan: ui-toggle.js assigns none of content.js's top-level bindings",
    crossFileWrites, []);

  // --- (e) hardening: the scan above only catches writes to content.js's
  // SURVIVING top-level bindings. It has a blind spot — a name that moved OUT
  // of content.js into DR_STORE (selectedTable) is invisible to
  // that scan once it is gone from content.js's own declaration list, so a
  // file that reintroduces a bare assignment to that name (exactly the old
  // anti-pattern this sprint removed) would slip through undetected. Close
  // that gap by scanning for writes to DR_STORE's own private field names,
  // read directly from app/store.js rather than from content.js.
  //
  // The field declarations sit one level inside the IIFE (2-space indent);
  // anchoring on that indentation (rather than a bare \b(?:let|const) scan
  // anywhere in the file) is what keeps this from also matching the `const
  // entry = ...` locals declared inside the table-registry getters/setters
  // (app-model-registry sprint) — those are per-call temporaries, not fields.
  const storeFieldNames = Array.from(storeSrc.matchAll(/^ {2}(?:let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm))
    .map((m) => m[1])
    .filter((name) => name !== 'DR_STORE');
  eq('static scan: app/store.js declares its seven private fields (sanity check on the scan itself)',
    storeFieldNames.slice().sort(),
    ['ERROR_ROW_LIMIT', 'errorCount', 'errorRows',
     'registeredTables', 'selectedTable', 'settings', 'tableRegistry'].sort());
  const storeFieldWrites = storeFieldNames.filter((name) => {
    const assignRe = new RegExp('\\b' + name + '\\s*=[^=]');
    return assignRe.test(uiToggleSrcForScan) || assignRe.test(contentSrcForScan);
  });
  eq("static scan (hardened): neither ui-toggle.js nor content.js assigns DR_STORE's private field names directly",
    storeFieldWrites, []);
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split: publishing intent:toggleTable is content.js's only
// path to running a press — prove the wiring end to end (mirrors the
// intent:selectTable behavioral pin in the app-model-selection block above).
// ---------------------------------------------------------------------------
(function toggleSplit_intentToggleTableRunsThePress() {
  // DR_DEFAULTS excludes row 0 (firstRow) and col 0 (firstColumn) — use a
  // 2x2 table so [row1, col1] is processed.
  const table = makeToggleTable([
    [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
    [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
  ]);
  injectToggleEntry(table);

  // The press writes the settings record and moves the active table now
  // (2026-09-14 sidebar-state-removal, part one), where the retired
  // plain-toggle path wrote neither. Both are shared model state, so this
  // test saves and restores them rather than leaving them for whatever runs
  // next.
  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  try {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    DR_STORE.setSelectedTable(table);

    const wasRounded = isTableRounded(table);
    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table });
    });
    const isNowRounded = isTableRounded(table);

    eq('toggle-split: publishing intent:toggleTable runs the press (table becomes simplified)',
      !wasRounded && isNowRounded, true);

    // A second press takes it back off, through the same path and the same
    // intent.
    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table });
    });
    eq('toggle-split: publishing intent:toggleTable again takes the table back to its original values',
      isTableRounded(table), false);
  } finally {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split: KNOWN BUG FIX — flashRangePulse used to read
// table.rows/row.cells directly, which only exist on native <table>
// elements. On a div-based grid Array.from(undefined) threw a TypeError,
// aborting the caller mid-flow (reverting the fix crashes this suite rather
// than failing an assertion). flashRangePulse now enumerates cells through the same TableAdapter
// (makeAdapter) the rounding engine and preview already use, so a grid's
// cells are found the same way a native table's are. This test fails
// without the fix: matchedCells.length would be 0 for the grid case below,
// and the (missing/whole-grid) fallback flash would not carry the
// range-restricted geometry asserted here.
// ---------------------------------------------------------------------------
(function toggleSplit_rangeFlashWorksOnGrids() {
  // 2x2 div-based grid (no ARIA roles, no vendor classes — the plain
  // fallback shape GridAdapter already supports elsewhere in this suite).
  const grid = makeGridWrapper([
    ['1,000,000', '500'],
    ['2,000,000', '750'],
  ]);

  // Distinct bounding rects per cell (document order: row0/col0, row0/col1,
  // row1/col0, row1/col1) so the union rect proves WHICH cells were matched
  // (column 1 only) rather than the whole grid or nothing at all.
  const rects = [
    { top: 0,  left: 0,   right: 100, bottom: 20 },
    { top: 0,  left: 100, right: 200, bottom: 20 },
    { top: 20, left: 0,   right: 100, bottom: 40 },
    { top: 20, left: 100, right: 200, bottom: 40 },
  ];
  grid.cellEls.forEach((cell, i) => { cell.getBoundingClientRect = () => rects[i]; });

  // Intercept the overlay div flashRangePulse creates and appends.
  const origCreateElement = global.document.createElement;
  const origBody = global.document.body;
  const origSetTimeout = global.setTimeout;
  let overlay = null;
  global.document.createElement = (tag) => {
    const el = { style: {}, addEventListener() {} };
    if (tag === 'div') overlay = el;
    return el;
  };
  const appended = [];
  global.document.body = { appendChild(el) { appended.push(el); } };
  global.setTimeout = () => 0; // avoid a real pending 1.5s cleanup timer

  // Range expression equivalent to selecting column B only (both rows) —
  // a partial range, so a whole-grid fallback would be visibly wrong.
  const ranges = [{ colMin: 1, colMax: 1, rowMin: 0, rowMax: 1 }];
  flashRangePulse(grid.wrapperEl, ranges);

  global.document.createElement = origCreateElement;
  global.document.body = origBody;
  global.setTimeout = origSetTimeout;

  eq('range-flash grid: an overlay is appended to document.body (not silently skipped)',
    appended.length, 1);
  eq('range-flash grid: the overlay carries the range-pulse class',
    overlay && overlay.className, 'dr-ext-range-pulse');
  eq('range-flash grid: the overlay is sized/positioned to the union of the matched grid cells (col 1 only), not the whole grid or nothing',
    overlay && { top: overlay.style.top, left: overlay.style.left, width: overlay.style.width, height: overlay.style.height },
    { top: '0px', left: '100px', width: '100px', height: '40px' });
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split (adversarial hardening): CLICK-HANDLER PARENT-EQUIVALENCE
// PIN across the full guard matrix. The consolidation claims that collapsing
// ui-toggle.js's two inlined click branches (mouse/keyboard, touch second-tap)
// down to one `DR_BUS.publish('intent:toggleTable', { table })` line each,
// with content.js's new intent:toggleTable subscriber running the same
// guarded body both branches used to run inline, produces the identical
// observable chrome.runtime.sendMessage sequence as before. This pin proves
// that claim across {same table, different table} x {sidebar open, closed},
// for both click branches — not just that a guard's boolean outcome matches
// (the AC1-AC4 rebind tests above already cover that), but that the ORDER
// and full contents of every dispatched message are unchanged.
//
// The expected sequences below are LITERALS captured by running the REAL
// click handler from both this sprint's parent (refactor/app-model-selection,
// the last commit with the guard/dispatch logic inlined per click branch in
// ui-toggle.js) and HEAD against this same fixture and harness, and verified
// byte-identical at review time. Frozen here rather than re-derived via
// `git show` at test-run time, matching the rationale in commit 394afa7: a
// shallow checkout or CI runner may not have the parent ref available.
// ---------------------------------------------------------------------------
(function toggleSplit_parentEquivalence_toggleClickSequences() {
  // Keyed by sameTable — mouse and touch second-tap produce the identical
  // sequence per cell, since both branches publish to the same handler. That
  // equality is itself part of what this pin proves: see the per-mode
  // assertions below, which check mouse and touch against the same literal.
  //
  // The matrix used to carry a second dimension, whether the sidebar stood
  // open, and four cells. The 2026-09-14 sidebar-state-removal design
  // retired the value that dimension varied (#241), and with it the branch
  // that read it — a press means one thing now, so the two surviving cells
  // are the whole matrix.
  const EXPECTED_SEQUENCES = {
    // A press on the ACTIVE table. Issue #272 put the settings-record write
    // at the front of this path: the press calls DR_STORE.setSettings with
    // the flipped enabled, the state-change subscriber runs the apply, and
    // the apply's own state:applyOk leads the sequence. state:tableEnabledChanged then
    // carries the settings record's new value, because no switch went out to
    // carry it. Byte-identical to the frozen parent capture for this cell.
    'true': [
      { action: 'state:applyOk' },
      { action: 'state:rangeOk' },
      { action: 'intent:updateMenuLabel', title: 'Toggle table' },
      { action: 'state:tableEnabledChanged', enabled: true },
    ],
    // A press on a table that is NOT the active one. Issue #251 made this
    // path sync the pressed table to the settings record in place of
    // simplifying it with the shipped defaults. The sidebar-state removal
    // then made it the only meaning such a press has, whatever the sidebar
    // is doing.
    //
    // state:tableSwitched leads so the sidebar lifts the previous table's lock
    // before this table's own state:applyBlocked/state:applyOk lands. No
    // state:previewSamplesChanged — the sidebar's pull chain ends in the preview
    // fetch. No state:tableEnabledChanged — the switch's own handler re-reads the
    // settings record, so a send here would deliver one fact twice.
    'false': [
      { action: 'state:tableSwitched' },
      { action: 'state:applyOk' },
      { action: 'state:rangeOk' },
      { action: 'intent:updateMenuLabel', title: 'Toggle table' },
    ],
  };

  // sameTable=true reuses the SAME table object for both "which table is
  // active" and "which table gets pressed" — the unmoved press. sameTable=
  // false makes a different table active than the one pressed — the press
  // that moves the active table, which must publish the switch.
  function runToggleClickFixture(mode, sameTable) {
    const clicked = makeToggleTable([
      [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    clicked._cells.forEach(c => { c.querySelectorAll = () => []; });

    let selected = clicked;
    if (!sameTable) {
      selected = makeToggleTable([
        [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'Col2' }],
        [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
      ]);
      selected._cells.forEach(c => { c.querySelectorAll = () => []; });
    }

    const sentMessages = [];
    const origSendMessage = global.chrome.runtime.sendMessage;
    global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

    lastRightClickedTable = selected;

    const buttonEl = createToggleWithSpies(clicked);
    if (mode === 'mouse') fireMouseClick(buttonEl);
    else fireTouchSecondTap(buttonEl);

    global.chrome.runtime.sendMessage = origSendMessage;
    lastRightClickedTable = null;

    return sentMessages;
  }

  for (const sameTable of [true, false]) {
    const expected = EXPECTED_SEQUENCES[String(sameTable)];
    for (const mode of ['mouse', 'touch']) {
      const seq = runToggleClickFixture(mode, sameTable);
      eq(`toggle click sequence (${mode}, sameTable=${sameTable}): sendMessage sequence matches the frozen literal`,
        seq, expected);
    }
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection (adversarial hardening): statelessness. The bus
// keeps no last-value cache and no delivery history (see adapters/messaging.js
// header) — a subscriber that attaches AFTER a publish must never see that
// publish, unlike an EventEmitter with replay or a BehaviorSubject.
// ---------------------------------------------------------------------------
(function appModelSelection_busIsStateless_lateSubscriberMissesPastPublish() {
  const topic = 'state:selectedTableChanged';
  const fakeTable = { __fake: 'stateless-check' };
  const savedSelected = DR_STORE.getSelectedTable();
  try {
    // Publish BEFORE any subscriber attaches — nothing is listening yet.
    DR_BUS.publish(topic, { table: fakeTable });

    let received = 'NOT_CALLED';
    const unsubscribe = DR_BUS.subscribe(topic, (payload) => { received = payload; });
    try {
      eq('DR_BUS statelessness: a subscriber that attaches after a publish never receives that publish',
        received, 'NOT_CALLED');
    } finally {
      unsubscribe();
    }
  } finally {
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// ---------------------------------------------------------------------------
// Sprint app-model-selection (adversarial hardening): reentrancy. Same-context
// delivery is synchronous (see adapters/messaging.js header), so a subscribed
// handler may itself call DR_BUS.publish() for a different topic before
// returning. A two-topic cycle — A's handler publishes B; B's handler
// increments a counter and, guarded to do so only once, publishes A back —
// must settle without an infinite loop or a stack overflow.
// ---------------------------------------------------------------------------
(function appModelSelection_busReentrancy_twoTopicCycleSettles() {
  // The second topic was state:sidebarOpenChanged until the 2026-09-14
  // sidebar-state-removal design retired it (#241). state:settingsChanged
  // takes its place: the controller subscribes to it in production, and that
  // subscriber applies to whichever table is active, so the fixture clears
  // the active table first and the production handler no-ops. What the test
  // measures — the bus's own delivery under a nested publish — is unchanged.
  const TOPIC_A = 'state:selectedTableChanged';
  const TOPIC_B = 'state:settingsChanged';
  const savedSelected = DR_STORE.getSelectedTable();
  DR_STORE.setSelectedTable(null);
  let counter = 0;

  const unsubA = DR_BUS.subscribe(TOPIC_A, () => {
    DR_BUS.publish(TOPIC_B, { settings: DR_STORE.getSettings() }); // A's handler always publishes B
  });
  const unsubB = DR_BUS.subscribe(TOPIC_B, () => {
    counter++;
    if (counter === 1) {
      DR_BUS.publish(TOPIC_A, { table: null }); // guarded to bounce back to A only once
    }
  });

  let threw = null;
  try {
    DR_BUS.publish(TOPIC_A, { table: null }); // kick off the cycle
  } catch (e) {
    threw = e.message;
  } finally {
    unsubA();
    unsubB();
    DR_STORE.setSelectedTable(savedSelected);
  }

  eq('DR_BUS reentrancy: a guarded two-topic publish cycle completes without throwing (no infinite loop/stack overflow)',
    threw, null);
  eq('DR_BUS reentrancy: B fires exactly twice (initial A->B hop, then one guarded bounce back through A)',
    counter, 2);
})();

// =============================================================================
// Sprint app-model-registry: the registry of found tables, per-cell originals,
// and the simplified/original flag live in DR_STORE; the dr-ext-grid marker
// class becomes a style hook only.
// =============================================================================

// --- (a) One restore path: a native table and a grid restore through the
// same restoreTable() call. ---
(function registrySprint_oneRestorePathForBothKinds() {
  withCreateTreeWalker(function () {
    // Native table: header row (excluded) + one data row.
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    roundTable(table, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: false, simplifyFirstColumn: true }));
    const nativeCell = table._cells[1];
    eq('registry restore: native cell is rounded before restore',
      nativeCell.classList.contains('dr-ext-rounded'), true);

    restoreTable(table, false);
    eq('registry restore: native cell HTML restored via the shared restoreTable() call',
      nativeCell.innerHTML, '8,584,629');
    eq('registry restore: native cell no longer carries dr-ext-rounded',
      nativeCell.classList.contains('dr-ext-rounded'), false);
  });

  // Grid: the SAME restoreTable() function, dispatching internally on kind.
  const grid = makeE2EGridWrapper([['8584629', '286']]);
  roundTable(grid.wrapperEl, Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true }));
  const gridCell = grid.cellEls[0];
  eq('registry restore: grid cell is rounded before restore',
    gridCell.classList.contains('dr-ext-rounded'), true);

  restoreTable(grid.wrapperEl, false);
  eq('registry restore: grid cell text node restored via the same restoreTable() call',
    gridCell.childNodes[0].nodeValue, '8584629');
  eq('registry restore: grid cell no longer carries dr-ext-rounded',
    gridCell.classList.contains('dr-ext-rounded'), false);
})();

// --- (b) The re-apply observer works from model state: a simulated grid
// redraw re-applies rounding correctly with every page attribute this cell
// might have carried stripped away first. ---
(function registrySprint_reapplyFromModelStateOnly() {
  let ctx;
  try {
    ctx = setupVirtGrid([
      ['8584629', '100'],
      ['1234567', '200'],
    ]);
    const { grid, pendingTimers } = ctx;
    const cell0 = grid.cellEls[0];
    const roundedValue = cell0.childNodes[0].nodeValue;
    const originalValue = DR_STORE.getTableOriginalText(grid.wrapperEl, cell0);

    // Strip every page attribute a pre-registry build would have relied on —
    // the re-apply must work from DR_STORE alone.
    cell0.dataset = {};
    grid.wrapperEl.dataset = {};

    // Simulate a redraw reverting the sort (framework rewrites the text node
    // back to the original; node identity and the dr-ext-rounded class survive).
    cell0.childNodes[0].nodeValue = originalValue;

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: cell0.childNodes[0] }]);
    flushTimers(pendingTimers);

    eq('registry reapply: cell re-rounded after redraw with no page attributes present',
      cell0.childNodes[0].nodeValue, roundedValue);
  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// --- (e) A full simplify → off → simplify cycle returns the cell to the
// exact original text and then to the exact same simplified text.
//
// The off step used to keep the registry's stored original and re-round from
// it. The 2026-09-14 sidebar-state-removal design retired that form flip
// (#241): off resets, which clears the record, and the re-simplify reads the
// restored cell and writes a fresh record. The assertions read what the user
// sees, which is unchanged. The record's lifetime changes with it. ---
(function registrySprint_originalsSurviveOffAndOnCycle() {
  withCreateTreeWalker(function () {
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    injectToggleEntry(table);
    const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: false, simplifyFirstColumn: true });
    const cell = table._cells[1];
    // withCreateTreeWalker's fake tree walker writes rounded text through
    // innerText/textContent (mirroring the DOM's own child-node/serialization
    // relationship, which a plain mock object does not have for free) — link
    // all three properties to one backing value so a write through any of
    // them (the round path via the walker, the restore path via a direct
    // innerHTML assignment) is visible through all three, the way a real
    // <td> keeps them in sync.
    let _text = cell.innerHTML;
    Object.defineProperties(cell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });

    roundTable(table, opts);
    const roundedText = cell.textContent;
    eq('registry cycle: cell rounds away from the original text',
      roundedText !== '8,584,629', true);

    resetTable(table); // the press that turns simplification off
    eq('registry cycle: cell shows the exact original text after the off press',
      cell.textContent, '8,584,629');
    eq('registry cycle: isTableRounded is false while the original text shows',
      isTableRounded(table), false);
    eq('registry cycle: the off press clears the stored original, where the form flip kept it',
      DR_STORE.hasTableOriginal(table, cell), false);

    roundTable(table, opts); // the press that turns it back on
    eq('registry cycle: cell is simplified again after the on press',
      cell.textContent, roundedText);
    eq('registry cycle: isTableRounded is true again after the on press',
      isTableRounded(table), true);
    eq('registry cycle: the on press writes a fresh stored original from the restored text',
      DR_STORE.getTableOriginalText(table, cell), '8,584,629');
  });
})();

// --- (f) Grid magnitude basis freeze: DELIBERATE BEHAVIOR CHANGE from the
// parent branch (refactor/app-model-settings), where computeGridRoundedValues
// took no frozenMaxMag parameter and reapplyRounding recomputed max_mag
// from whatever was visible on every scroll re-apply. HEAD's roundTable
// freezes max_mag on first sight into DR_STORE.setTableMaxMagnitude and every
// later reapplyRounding reuses that frozen value (see the frozenMaxMag
// entry in the pass settings header above simplifyTableCells in content.js).
// offsetTop/offsetOther are
// deliberately set apart so a magnitude-driven bucket flip is visible in the
// formatted output, not just in the stored number. ---
(function registrySprint_gridMagnitudeFrozenAtFirstSight() {
  let ctx;
  try {
    const opts = { offsetTop: -1, offsetOther: 0, numTop: 1 };
    // Sole visible row at first sight: magnitude 2 (555) — freezes max_mag at 2.
    ctx = setupVirtGrid([['555']], opts);
    const { grid, pendingTimers } = ctx;
    const cell555 = grid.cellEls[0];

    eq('magnitude freeze: 555 rounds via offsetTop (max_mag=2, within numTop of itself)',
      cell555.childNodes[0].nodeValue, '560');
    eq('magnitude freeze: DR_STORE freezes maxMagnitude at 2 on first sight',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);

    // Simulate scroll bringing a magnitude-9 row into view alongside the
    // still-visible 555 row — appended to the wrapper's children, the
    // fallback _getRowEls path this unlabelled-grid shape uses.
    const hugeCell = makeGridCellWithTextNode('5000000000');
    const hugeRow = makeElementNode('row', [hugeCell]);
    hugeRow.dataset = { row: '1' };
    hugeRow.children = [hugeCell];
    grid.wrapperEl.children.push(hugeRow);

    const obs = ctx.capturedObserver;
    obs.trigger([{ type: 'characterData', target: cell555.childNodes[0] }]);
    flushTimers(pendingTimers);

    // If the basis recomputed from the now-visible magnitude-9 row (the
    // parent's behavior), 555 would fall out of the top bucket and round to
    // "600" (offsetOther) instead. HEAD must keep "560".
    eq('magnitude freeze: after a scroll-triggered reapply exposing a magnitude-9 row, 555 KEEPS the magnitude-2 basis ("560"), not a recomputed magnitude-9 basis ("600")',
      cell555.childNodes[0].nodeValue, '560');
    eq('magnitude freeze: DR_STORE.getTableMaxMagnitude never shifts off the frozen value',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);
  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// --- (f) continued: an off-and-back-on round trip clears the frozen basis
// (resetTable sets maxMagnitude back to null) and re-freezes fresh from
// whatever is visible at the moment of the second press — it does NOT
// preserve the basis established by the first round. This is the registry's
// actual behavior (#257), documented here so a reviewer can judge whether
// "frozen at first sight" was meant to survive a round trip.
//
// The round trip used to run through a form flip that kept the table's
// markers. The 2026-09-14 sidebar-state-removal design retired that flip
// (#241) in favor of a reset, and both clear the frozen basis the same way,
// so the behavior under test is unchanged — only the driver is. ---
(function registrySprint_offAndOnRoundTripReFreezesRatherThanPreserving() {
  let ctx;
  try {
    const opts = { offsetTop: -1, offsetOther: 0, numTop: 1 };
    ctx = setupVirtGrid([['555']], opts);
    const { grid } = ctx;
    const cell555 = grid.cellEls[0];

    eq('toggle round trip: initial freeze is at max_mag=2 ("560")',
      cell555.childNodes[0].nodeValue, '560');
    eq('toggle round trip: DR_STORE holds the frozen basis before any toggle',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 2);

    // Scroll in a magnitude-9 row BEFORE the off press, so the "first sight"
    // the re-round sees on the second press is the magnitude-9 view, not the
    // original magnitude-2 view.
    const hugeCell = makeGridCellWithTextNode('5000000000');
    const hugeRow = makeElementNode('row', [hugeCell]);
    hugeRow.dataset = { row: '1' };
    hugeRow.children = [hugeCell];
    grid.wrapperEl.children.push(hugeRow);

    const applyOpts = Object.assign(
      {}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true }, opts);

    applySidebarRounding(grid.wrapperEl, Object.assign({}, applyOpts, { enabled: false }));
    eq('round trip: the off press clears the display back to "555"',
      cell555.childNodes[0].nodeValue, '555');
    eq('round trip: the off press clears the frozen basis',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), null);

    applySidebarRounding(grid.wrapperEl, Object.assign({}, applyOpts, { enabled: true }));
    eq('round trip: DR_STORE re-freezes from the now-visible magnitude-9 row (9), not the original magnitude-2 basis',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 9);
    // Under the re-frozen (9) basis, current_mag(555)=2, max_mag-current_mag=7
    // >= numTop(1), so 555 now takes offsetOther ("600") — a DIFFERENT
    // rendered value than the original round produced ("560"), purely
    // because of what happened to be visible at the second press.
    eq('round trip: 555 renders differently after the round trip than its original round ("600", not "560")',
      cell555.childNodes[0].nodeValue, '600');
  } finally {
    if (ctx) {
      global.MutationObserver = ctx.origMO;
      global.setTimeout = ctx.origSetTimeout;
      global.clearTimeout = ctx.origClearTimeout;
    }
  }
})();

// --- (g) state:tableEnabledChanged sequence: isTableRounded (claim 4 — now reading
// DR_STORE's appliedFlag instead of a dr-ext-rounded/dataset.drShowingOriginal
// pair) must report correctly to the sidebar across a full round -> peek-
// original -> peek-back cycle, not just a single toggle. The pillbox-sprint
// AC1 test above pins one click; the toggle-split parent-equivalence guard
// matrix pins one intent:toggleTable dispatch. Neither exercises the 3-step
// peek cycle this sprint's registry model actually has to get right. ---
(function registrySprint_tableToggleStateAcrossPeekCycle() {
  const savedSelected = DR_STORE.getSelectedTable();
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  try {
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
    ]);
    injectToggleEntry(table);
    DR_STORE.setSelectedTable(table);

    // makeToggleTableCell gives innerHTML/innerText/textContent as three
    // INDEPENDENT properties. A real <td>'s innerHTML/innerText/textContent
    // all derive from the same child-node tree, so writing one (restoreTable's
    // `cell.innerHTML = original.html`) is immediately visible through the
    // others (roundTable's re-classification reads getText() -> innerText).
    // Without this link the mock desyncs after the peek-original restore:
    // innerHTML goes back to '12,345' but innerText stays on the stale
    // rounded string, so the round-trip's re-round misclassifies the cell as
    // already-rounded and skips it — a fixture artifact, not a product bug
    // (see the identical link in registrySprint_originalsSurviveToggleCycle
    // above, needed for the same reason on the 2-toggle case).
    const dataCell = table._cells[3]; // row1/col1: 'Row' | '12,345'
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table }); // round
      DR_BUS.publish('intent:toggleTable', { table }); // peek original
      DR_BUS.publish('intent:toggleTable', { table }); // peek back
    });

    const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
    eq('toggle-state cycle: exactly one state:tableEnabledChanged per dispatch (3 total)',
      toggleMsgs.length, 3);
    eq('toggle-state cycle: enabled sequence is true (rounded), false (peek original), true (peek back)',
      toggleMsgs.map(m => m.enabled), [true, false, true]);
    eq('toggle-state cycle: isTableRounded agrees with the last reported state',
      isTableRounded(table), true);
  } finally {
    global.chrome.runtime.sendMessage = origSend;
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// --- (h) WeakMap/Set lockstep, part 1: a table re-added after removal (the
// SAME element reference, as a virtualized-DOM library recycling a detached
// node back into the tree would do) must come back with a FRESH registry
// entry, not the previous round's leftover state. unregisterTable deletes
// the WeakMap entry outright, so a later registerTable (via _ensureEntry)
// can only build a brand-new entry — this pins that no per-cell original,
// appliedFlag, round options, or frozen magnitude survives the round trip. ---
(function registrySprint_reregisterAfterUnregisterGetsFreshEntry() {
  const table = { tagName: 'TABLE' }; // identity is all that matters here
  const cell = { tagName: 'TD' };

  DR_STORE.registerTable(table);
  DR_STORE.setTableOriginal(table, cell, { value: '8,584,629', pieces: [{ text: '8,584,629', written: '8,584,629' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');
  DR_STORE.setTableRoundOptions(table, { offsetTop: -1 });
  DR_STORE.setTableMaxMagnitude(table, 7);

  eq('re-register: table is rounded with state before removal (pre-condition)',
    DR_STORE.getTableAppliedFlag(table), 'simplified');

  // Simulate the removed-node observer's cleanup: unregisterTable is the
  // ONLY registry call it makes (content.js's removedNodes loop).
  DR_STORE.unregisterTable(table);

  eq('re-register: hasTable is false immediately after unregisterTable',
    DR_STORE.hasTable(table), false);

  // The SAME table reference comes back (e.g. a virtualized list recycling
  // the detached DOM node into view again). registerTable is idempotent /
  // "found again" — it must not resurrect the old entry.
  DR_STORE.registerTable(table);

  eq('re-register: appliedFlag resets to "original" (not the leftover "simplified")',
    DR_STORE.getTableAppliedFlag(table), 'original');
  eq('re-register: the old per-cell original does NOT leak through (hasTableOriginal is false)',
    DR_STORE.hasTableOriginal(table, cell), false);
  eq('re-register: getTableOriginal for the old cell reference is undefined, not the stale record',
    DR_STORE.getTableOriginal(table, cell), undefined);
  eq('re-register: lastRoundOptions resets to null (not the leftover options object)',
    DR_STORE.getTableRoundOptions(table), null);
  eq('re-register: maxMagnitude resets to null (not the leftover frozen value)',
    DR_STORE.getTableMaxMagnitude(table), null);
})();

// --- Sprint shape-fingerprint: the registry's fingerprint field. The entry
// carries the shape the table had when it registered, and the pillbox view's
// builder is its one writer. Spec: the shape-fingerprint block in
// docs/sprint-plans/grid-detection-recovery-v2.md §5, and the shape
// fingerprint row in docs/vocabulary.md. ---
(function shapeFingerprint_theRegistryHoldsAFingerprintPerTable() {
  const table = { tagName: 'TABLE' }; // identity is all that matters here

  eq('fingerprint registry: an unregistered table carries no fingerprint',
    DR_STORE.getTableFingerprint(table), null);

  DR_STORE.registerTable(table);
  eq('fingerprint registry: registerTable on its own records no fingerprint',
    DR_STORE.getTableFingerprint(table), null);

  const recorded = { columnCount: 3, headerTexts: ['Region', 'Q1', 'Q2'] };
  DR_STORE.setTableFingerprint(table, recorded);
  eq('fingerprint registry: the recorded fingerprint reads back whole',
    DR_STORE.getTableFingerprint(table), recorded);
  eq('fingerprint registry: the recorded fingerprint is plain values',
    JSON.parse(JSON.stringify(DR_STORE.getTableFingerprint(table))), recorded);

  DR_STORE.unregisterTable(table);
  eq('fingerprint registry: unregisterTable drops the fingerprint with the entry',
    DR_STORE.getTableFingerprint(table), null);

  DR_STORE.registerTable(table);
  eq('fingerprint registry: a re-registration starts with no fingerprint',
    DR_STORE.getTableFingerprint(table), null);
  DR_STORE.unregisterTable(table);
})();

// The pillbox view's builder records the shape after it registers the table,
// on a grid and on a native table alike.
(function shapeFingerprint_registrationRecordsTheTablesShape() {
  const grouped = makeScrollingRowgroupGrid(['Region', 'Q1'], [
    ['North', '1,482,391'], ['South', '918,554'],
  ]);
  withToggleDocumentMock(function () { createToggleForTable(grouped.wrapperEl); });
  eq('fingerprint registry: registering a grid with a row group records its header row',
    DR_STORE.getTableFingerprint(grouped.wrapperEl),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  forgetRegisteredTable(grouped.wrapperEl);

  const grid = makeDatabaseQueryGrid();
  withToggleDocumentMock(function () { createToggleForTable(grid.scrollPaneEl); });
  eq('fingerprint registry: registering a groupless grid records its column count alone',
    DR_STORE.getTableFingerprint(grid.scrollPaneEl),
    { columnCount: 3, headerTexts: null });
  forgetRegisteredTable(grid.scrollPaneEl);

  const nativeTable = makeToggleTable([
    [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
    [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
  ]);
  withToggleDocumentMock(function () { createToggleForTable(nativeTable); });
  eq('fingerprint registry: registering a native table records its header row',
    DR_STORE.getTableFingerprint(nativeTable),
    { columnCount: 2, headerTexts: ['Region', 'Q1'] });
  forgetRegisteredTable(nativeTable);
})();

// --- (h) WeakMap/Set lockstep, part 2: the removed-node MutationObserver
// callback must find and unregister a table when the removedNodes entry is
// an ANCESTOR of the table, not the table itself — the real production
// callback (content.js's `_tableObserver`), not GV7's manual re-
// implementation of its cleanup steps. Exercised by re-evaluating the
// content-script bundle with a capturing MutationObserver installed first
// (mirrors appModelSelection_parentEquivalence_contextmenuSelectionFlow's
// runContextmenuFixture technique above), so `_tableObserver`'s real
// constructor closure is the one under test. ---
(function registrySprint_ancestorRemovalUnregistersDescendantTable() {
  const capturedInstances = [];
  class CapturingTableObserverMO {
    constructor(cb) { this._cb = cb; this.disconnectCalled = false; capturedInstances.push(this); }
    observe(target, opts) { this._target = target; this._opts = opts; }
    disconnect() { this.disconnectCalled = true; }
  }

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete', // else-branch runs synchronously: injectTableToggles() + observe()
    body: { appendChild() {} },
  };
  const captureChrome = {
    runtime: { onMessage: { addListener() {} }, sendMessage() {} },
  };
  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
  };
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  global.MutationObserver = CapturingTableObserverMO;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };

  try {
    // Expose this eval's own DR_STORE/tableToggles/trackedTables bindings
    // (distinct instances from the file-level ones the rest of the suite
    // uses) onto globalThis so this function can drive and inspect them
    // after eval() returns — same trick the top-of-file eval already uses.
    eval(contentScriptBundle + `
      globalThis.__rt_DR_STORE = DR_STORE;
      globalThis.__rt_tableToggles = tableToggles;
      globalThis.__rt_trackedTables = trackedTables;
    `);

    eq('ancestor removal: exactly one MutationObserver constructed (the _tableObserver watching document.body)',
      capturedInstances.length, 1);
    const tableObserver = capturedInstances[0];
    eq('ancestor removal: _tableObserver.observe was called with document.body',
      tableObserver._target === captureDoc.body, true);

    const freshDR_STORE = global.__rt_DR_STORE;
    const freshTableToggles = global.__rt_tableToggles;
    const freshTrackedTables = global.__rt_trackedTables;

    // A table nested under a container — the removedNodes record will carry
    // the CONTAINER, never the table directly (e.g. a host page detaching a
    // wrapping <div> that happens to hold the table, not the table itself).
    const table = { tagName: 'TABLE', nodeType: 1 };
    const removedButtons = [];
    const button = { parentElement: { removeChild(b) { removedButtons.push(b); } } };
    freshTableToggles.set(table, button);
    freshTrackedTables.add(table);
    freshDR_STORE.registerTable(table);

    eq('ancestor removal (pre): table is registered before the removal fires',
      freshDR_STORE.hasTable(table), true);

    const container = {
      nodeType: 1,
      // The only DOM relationship the real removal loop consults: does this
      // removed node CONTAIN the tracked table (a real Node.contains check
      // on a real ancestor, stubbed here to report the containment we set up).
      contains(el) { return el === table; },
    };

    // Fire the REAL captured callback — table itself is absent from
    // removedNodes; only its ancestor container is.
    tableObserver._cb([{ addedNodes: [], removedNodes: [container] }]);

    eq('ancestor removal: DR_STORE.hasTable is false after the ancestor-only removal record',
      freshDR_STORE.hasTable(table), false);
    eq('ancestor removal: trackedTables no longer has the table',
      freshTrackedTables.has(table), false);
    eq('ancestor removal: the table\'s toggle button was removed from its parent',
      removedButtons.includes(button), true);

    // A DIRECT removedNodes entry (the table itself, not an ancestor) must
    // also still work — the `table === node` half of the containment check.
    const table2 = { tagName: 'TABLE', nodeType: 1 };
    freshTableToggles.set(table2, { parentElement: { removeChild() {} } });
    freshTrackedTables.add(table2);
    freshDR_STORE.registerTable(table2);
    tableObserver._cb([{ addedNodes: [], removedNodes: [table2] }]);
    eq('direct removal: DR_STORE.hasTable is false when the table itself is the removedNodes entry',
      freshDR_STORE.hasTable(table2), false);
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
  }
})();

// --- Sprint shape-fingerprint: the teardown both the removal observer and the
// mismatch path run. One function discards a table's registration and every
// per-table resource the extension holds beside it: the pillbox, the resize
// observer, a virtualized grid's re-apply observer and its pending timer, the
// view's tracked-table list, and the registry entry. `reason` reaches the
// debug row. Spec: the shape-fingerprint block in
// docs/sprint-plans/grid-detection-recovery-v2.md §5. ---

(function shapeFingerprint_theTeardownDiscardsTheEntryAndEveryResourceBesideIt() {
  const grid = makeDatabaseQueryGrid();
  const resizeObservers = [];
  const savedResizeObserver = global.ResizeObserver;
  const clearedTimers = [];
  const savedClearTimeout = global.clearTimeout;
  let gridObserverDisconnects = 0;
  global.ResizeObserver = class {
    constructor() { this.disconnected = false; resizeObservers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() { this.disconnected = true; }
  };
  global.clearTimeout = function (id) { clearedTimers.push(id); return savedClearTimeout(id); };

  try {
    const removedPillboxes = registerFingerprintedTable(grid.scrollPaneEl);
    reapplyObservers.set(grid.scrollPaneEl, { observer: { disconnect() { gridObserverDisconnects++; } }, target: grid.scrollPaneEl });
    const pendingTimer = setTimeout(function () {}, 10000);
    reapplyTimers.set(grid.scrollPaneEl, pendingTimer);

    eq('fingerprint teardown: the grid registers and tracks before the teardown (precondition)',
      DR_STORE.hasTable(grid.scrollPaneEl) && trackedTables.has(grid.scrollPaneEl), true);

    teardownTableEntry(grid.scrollPaneEl, 'replaced');

    eq('fingerprint teardown: the pillbox comes off the page', removedPillboxes.length, 1);
    eq('fingerprint teardown: the resize observer disconnects',
      resizeObservers.length === 1 && resizeObservers[0].disconnected, true);
    eq('fingerprint teardown: the pending re-apply timer is cleared',
      clearedTimers.includes(pendingTimer), true);
    eq('fingerprint teardown: the timer record goes with it',
      reapplyTimers.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the re-apply observer disconnects', gridObserverDisconnects, 1);
    eq('fingerprint teardown: the re-apply observer record goes with it',
      reapplyObservers.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the view stops tracking the table',
      trackedTables.has(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the registry entry is gone',
      DR_STORE.hasTable(grid.scrollPaneEl), false);
    eq('fingerprint teardown: the fingerprint goes with the entry',
      DR_STORE.getTableFingerprint(grid.scrollPaneEl), null);
    eq('fingerprint teardown: the teardown records a row naming its reason',
      recentLogRows().some((text) => /replaced table unregistered/.test(text)), true);
  } finally {
    global.ResizeObserver = savedResizeObserver;
    global.clearTimeout = savedClearTimeout;
    forgetRegisteredTable(grid.scrollPaneEl);
  }
})();

// --- Sprint pending-retest, criterion 4: a pending container removed from the
// page leaves no observer and no timer.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md, the pending-retest
// block in §5 — "The removal branch of the table observer drops a pending
// root's observer and timer."
//
// A pending table holds no registry entry, so the registry sweep above passes
// over it; the pending sweep is the only thing that reaches it. The real
// `_tableObserver` callback runs here, captured the same way the ancestor-
// removal case above captures it: the content-script bundle is re-evaluated
// with a capturing MutationObserver installed first, so the observer under
// test is the production one and not a re-implementation of its steps. ---
(function pendingRetest_AC4_removalDropsTheObserverAndTheTimer() {
  const capturedInstances = [];
  class CapturingRemovalMO {
    constructor(cb) { this._cb = cb; this.disconnectCount = 0; capturedInstances.push(this); }
    observe(target, options) { this._target = target; this._options = options; }
    disconnect() { this.disconnectCount++; }
  }

  const timers = [];
  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {} },
  };
  const captureChrome = { runtime: { onMessage: { addListener() {} }, sendMessage() {} } };
  const saved = {
    document: global.document, chrome: global.chrome, window: global.window,
    MutationObserver: global.MutationObserver, ResizeObserver: global.ResizeObserver,
    Node: global.Node, NodeFilter: global.NodeFilter,
    setTimeout: global.setTimeout, clearTimeout: global.clearTimeout,
  };
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  global.MutationObserver = CapturingRemovalMO;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_TEXT: 4 };
  global.setTimeout = function (callback, ms) {
    timers.push({ callback, ms, cancelled: false });
    return timers.length - 1;
  };
  global.clearTimeout = function (id) {
    if (id !== undefined && id !== null && timers[id]) timers[id].cancelled = true;
  };

  try {
    eval(contentScriptBundle + `
      globalThis.__pending_pendingRoots = pendingRoots;
      globalThis.__pending_pendingObservers = pendingObservers;
      globalThis.__pending_pendingRetestTimers = pendingRetestTimers;
      globalThis.__pending_holdPendingTable = holdPendingTable;
    `);

    eq('pending AC4: exactly one observer stands after the load (the table observer)',
      capturedInstances.length, 1);
    const tableObserver = capturedInstances[0];
    const freshPendingRoots = global.__pending_pendingRoots;
    const holdPending = global.__pending_holdPendingTable;

    // Case 1: the removed node is an ancestor of the pending root.
    const root = { nodeType: 1, tagName: 'DIV' };
    holdPending(root);
    eq('pending AC4 (pre): the root is held as a pending table',
      freshPendingRoots.has(root), true);
    eq('pending AC4 (pre): holding the root builds one more observer',
      capturedInstances.length, 2);
    const pendingObserver = capturedInstances[1];

    // One mutation on the subtree schedules the debounced re-test.
    pendingObserver._cb([], pendingObserver);
    eq('pending AC4 (pre): the mutation schedules one re-test timer',
      timers.filter((t) => !t.cancelled).length, 1);

    const ancestor = { nodeType: 1, contains: (el) => el === root };
    tableObserver._cb([{ addedNodes: [], removedNodes: [ancestor] }]);

    eq('pending AC4: removing an ancestor disconnects the pending observer',
      pendingObserver.disconnectCount, 1);
    eq('pending AC4: removing an ancestor cancels the scheduled re-test timer',
      timers.filter((t) => !t.cancelled).length, 0);
    eq('pending AC4: removing an ancestor drops the pending root',
      freshPendingRoots.has(root), false);
    eq('pending AC4: no pending root remains after the ancestor removal',
      freshPendingRoots.size, 0);

    // Case 2: the removed node is the pending root itself.
    const rootItself = { nodeType: 1, tagName: 'DIV' };
    holdPending(rootItself);
    const secondObserver = capturedInstances[2];
    secondObserver._cb([], secondObserver);
    const scheduledForSecond = timers.filter((t) => !t.cancelled).length;
    eq('pending AC4 (pre): the second root schedules one re-test timer',
      scheduledForSecond, 1);

    tableObserver._cb([{ addedNodes: [], removedNodes: [rootItself] }]);

    eq('pending AC4: removing the pending root itself disconnects its observer',
      secondObserver.disconnectCount, 1);
    eq('pending AC4: removing the pending root itself cancels its re-test timer',
      timers.filter((t) => !t.cancelled).length, 0);
    eq('pending AC4: removing the pending root itself drops the pending root',
      freshPendingRoots.has(rootItself), false);
    eq('pending AC4: the pending observer map holds nothing for either root',
      [global.__pending_pendingObservers.has(root),
        global.__pending_pendingObservers.has(rootItself)], [false, false]);
    eq('pending AC4: the pending timer map holds nothing for either root',
      [global.__pending_pendingRetestTimers.has(root),
        global.__pending_pendingRetestTimers.has(rootItself)], [false, false]);
  } finally {
    global.document = saved.document; global.chrome = saved.chrome; global.window = saved.window;
    global.MutationObserver = saved.MutationObserver; global.ResizeObserver = saved.ResizeObserver;
    global.Node = saved.Node; global.NodeFilter = saved.NodeFilter;
    global.setTimeout = saved.setTimeout; global.clearTimeout = saved.clearTimeout;
    delete global.__pending_pendingRoots;
    delete global.__pending_pendingObservers;
    delete global.__pending_pendingRetestTimers;
    delete global.__pending_holdPendingTable;
  }
})();

// ---------------------------------------------------------------------------
// A pillbox press on the active table writes the settings record
// (DR_STORE.settings.enabled), not just the table's cells and the sidebar's
// switch. Issue #272, leak 1: content.js's same-table intent:toggleTable
// branch used to simplify the table and send state:tableEnabledChanged
// without calling setSettings, so any later pull (a sidebar reopen or a table
// switch) showed the record's stale enabled over the table's truth, and a
// reopen-style apply silently re-rounded a table the user had toggled off.
//
// One press path covers the sidebar open and the sidebar closed alike. An
// earlier gate read sidebar visibility to pick between the record path and a
// direct one, so a press made with the sidebar closed changed the page without
// changing the record, and the next open re-imposed the stale record. The
// 2026-09-14 sidebar-state-removal design retired that gate, so this one test
// covers both cases. state:tableEnabledChanged goes out either way: the
// controller publishes the record, a closed sidebar has no page to receive it,
// and background.js gates its own relay (the AC4 guard).
// ---------------------------------------------------------------------------
(function issue272_sameTablePillToggleWritesRecord() {
  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  try {
    // Known starting record: enabled on, everything else shipped defaults.
    // Reset with nothing selected so the state-change subscriber no-ops.
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: true }));

    const table = makeToggleTable([
      [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
      [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
    ]);
    injectToggleEntry(table);
    DR_STORE.setSelectedTable(table);

    // Same innerHTML/innerText/textContent link as the toggle-state cycle
    // test above — restoreTable writes innerHTML, the re-round reads
    // innerText, and a real <td> derives both from one child-node tree.
    const dataCell = table._cells[3]; // row1/col1: 'Row' | '12,345'
    let _text = dataCell.innerHTML;
    Object.defineProperties(dataCell, {
      innerHTML: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      innerText: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
      textContent: { get() { return _text; }, set(v) { _text = v; }, configurable: true },
    });

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table }); // pill: turn rounding on
    });
    eq('leak-1: the first pill toggle rounds the connected table',
      isTableRounded(table), true);
    eq('leak-1: the record follows the pill — enabled true after toggle-on',
      DR_STORE.getSettings().enabled, true);

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table }); // pill: turn rounding off
    });
    eq('leak-1: the second pill toggle restores the table to originals',
      isTableRounded(table), false);
    eq('leak-1: the record follows the pill — enabled false after toggle-off',
      DR_STORE.getSettings().enabled, false);

    // The reopen path (state:sidebarOpened runs this same apply) must honor the
    // record the pill just wrote — not silently re-round the table.
    withCreateTreeWalker(function () {
      applySidebarRounding(table, DR_STORE.getSettings());
    });
    eq('leak-1: a reopen-style apply honors the record — the table stays on originals',
      isTableRounded(table), false);

    const toggleMsgs = sent.filter((m) => m.action === 'state:tableEnabledChanged');
    eq('leak-1: one state:tableEnabledChanged per pill toggle, reporting the record — true then false',
      toggleMsgs.map((m) => m.enabled), [true, false]);
  } finally {
    global.chrome.runtime.sendMessage = origSend;
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// A press on a table that is NOT the active one moves the active table to it
// and writes the settings record. This pinned the opposite, because a third
// press path handled that case: the press kept the active table where it was
// and left the settings record alone. The 2026-09-14 sidebar-state-removal
// design retired that path (#241). A press means one thing, so it makes the
// pressed table active and writes the settings record, whatever the sidebar
// is doing.
(function pressOnInactiveTableMovesTheActiveTableAndWritesTheRecord() {
  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  try {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: true }));

    const active = makeToggleTable([
      [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'V' }],
      [{ tag: 'td', text: 'R' }, { tag: 'td', text: '1,000,000' }],
    ]);
    injectToggleEntry(active);
    const other = makeToggleTable([
      [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'V' }],
      [{ tag: 'td', text: 'R' }, { tag: 'td', text: '12,345' }],
    ]);
    injectToggleEntry(other);
    DR_STORE.setSelectedTable(active);

    withCreateTreeWalker(function () {
      DR_BUS.publish('intent:toggleTable', { table: other });
    });
    eq('press on an inactive table: the pressed table simplifies',
      isTableRounded(other), true);
    eq('press on an inactive table: the settings record follows the press',
      DR_STORE.getSettings().enabled, true);
    eq('press on an inactive table: the pressed table becomes the active one',
      DR_STORE.getSelectedTable(), other);
    eq('press on an inactive table: the table that was active is left as it was',
      isTableRounded(active), false);
  } finally {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// --- The defect's own symptom. The settings record stands at off and the
// press lands on a table that is not the active one. Before the fix this took
// the rebind path and applied the settings record, which at off changed no
// numbers. The user pressed an on/off control and nothing moved. ---
(function partOne_pressOnInactiveTableSimplifiesEvenWithTheRecordOff() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_STORE.setSelectedTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: a press on an inactive table simplifies it with the settings record at off',
      isTableRounded(pressed), true);
    eq('part one: the settings record follows that press to on',
      DR_STORE.getSettings().enabled, true);
    eq('part one: the press publishes the switch',
      sent.filter((m) => m.action === 'state:tableSwitched').length, 1);
  });
})();

// --- Exactly one settings write per press, and the flip direction comes from
// the screen as it stood BEFORE that write. A press on a raw table with the
// settings record already at on is the case that catches a second write: read
// the direction after a first write and the press simplifies, reads
// "simplified", writes off, and the second apply returns the table to where
// it started. ---
(function partOne_onePressOneWriteReadingTheScreenFirst() {
  runPressFixture(({ resetWrites, writes }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: true }));
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_STORE.setSelectedTable(active);
    resetWrites();

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: a press makes exactly one settings write',
      writes(), 1);
    eq('part one: a press on a raw table with the settings record at on leaves the table simplified',
      isTableRounded(pressed), true);
    eq('part one: the settings record stands at on afterwards',
      DR_STORE.getSettings().enabled, true);
  });
})();

// --- The settings record's change is what applies, and the values it carries
// are what the table gets. The offset seeded below differs from the shipped
// default, so a pass run against the defaults fails this. ---
(function partOne_pressAppliesTheRecordsCurrentValues() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, {
      enabled: false, offsetTop: -2, offsetOther: -2,
    }));
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('8,584,629');
    DR_STORE.setSelectedTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    const usedOpts = DR_STORE.getTableRoundOptions(pressed);
    eq('part one: turning simplification on uses the settings record\'s offset',
      usedOpts && usedOpts.offsetTop, -2);
  });
})();

// --- Turning off resets. The form flip this replaced kept the simplified
// markers and the stored originals, which left the settings record at off
// while the table kept its simplified bookkeeping. ---
(function partOne_pressOffResetsTheTable() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const table = makePressTable('12,345');
    DR_STORE.setSelectedTable(table);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('part one: the first press simplifies the active table (precondition)',
      isTableRounded(table), true);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });

    eq('part one: after an off press the settings record stands at off',
      DR_STORE.getSettings().enabled, false);
    eq('part one: after an off press no cell carries the simplified marker',
      table._cells.some((c) => c.classList.contains('dr-ext-rounded')), false);
    eq('part one: after an off press no cell has a stored original',
      table._cells.some((c) => DR_STORE.hasTableOriginal(table, c)), false);
  });
})();

// --- The range expression states rows and columns by position, so it
// describes the table it was written for. A press that moves the active table
// clears it; a press on the table that is already active keeps it. ---
(function partOne_movedPressClearsTheRangeExpression() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false, rangeExpr: 'B2' }));
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_STORE.setSelectedTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: a press that moves the active table clears the range expression',
      DR_STORE.getSettings().rangeExpr, '');
  });
})();

// --- The same clear must happen where the held expression fails to parse.
// Without it the press stops before any cell changes and the error reaches a
// sidebar that may stand closed, which leaves the press looking inert. ---
(function partOne_movedPressClearsAnUnparsableRangeExpression() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false, rangeExpr: '1a' }));
    const active = makePressTable('1,000,000');
    const pressed = makePressTable('12,345');
    DR_STORE.setSelectedTable(active);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table: pressed }); });

    eq('part one: a moved press clears a range expression the parser rejects',
      DR_STORE.getSettings().rangeExpr, '');
    eq('part one: that press simplifies the whole pressed table',
      isTableRounded(pressed), true);
  });
})();

(function partOne_unmovedPressKeepsTheRangeExpression() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false, rangeExpr: 'B2' }));
    const table = makePressTable('12,345');
    DR_STORE.setSelectedTable(table);

    withCreateTreeWalker(() => { DR_BUS.publish('intent:toggleTable', { table }); });

    eq('part one: a press on the already-active table keeps the range expression',
      DR_STORE.getSettings().rangeExpr, 'B2');
  });
})();

// --- A right-click activation writes no settings, so the numbers on a
// right-clicked table stay as they are. Today's code satisfies this, and the
// test stands as a regression guard on the clear's placement: move the clear
// onto activation and this fails, because every settings write publishes and
// the controller applies to the active table on every publish. ---
(function partOne_activationWritesNoSettings() {
  runPressFixture(({ resetWrites, writes }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: true, rangeExpr: 'B2' }));
    const table = makePressTable('12,345');
    resetWrites();

    withCreateTreeWalker(() => { DR_BUS.publish('intent:selectTable', { table }); });

    eq('part one: a right-click activation makes no settings write',
      writes(), 0);
    eq('part one: a right-click activation leaves the range expression alone',
      DR_STORE.getSettings().rangeExpr, 'B2');
    eq('part one: a right-click activation changes no numbers on the table',
      isTableRounded(table), false);
    eq('part one: the activation still moves the active table',
      DR_STORE.getSelectedTable(), table);
  });
})();

// ---------------------------------------------------------------------------
// Sprint shape-fingerprint: the comparison at the two controller entry points
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.6 and the
// shape-fingerprint block in §5; decision D7 in
// docs/sprint-plans/grid-detection-recovery.md.
// ---------------------------------------------------------------------------
//
// The rule these assertions pin, in the specification's words:
//   - Every action on a registered table compares the table's current shape
//     against the fingerprint the registry recorded, before it acts.
//   - A match changes nothing.
//   - A mismatch discards the entry whole, re-runs the nomination step from
//     the nest's chain root, registers the result, makes it active, and
//     publishes the table-switched topic. The fresh registration can land on
//     a different element than the one the action named.
//   - Nothing registering stops the action. The active table clears when the
//     discarded table was the active one.
//   - A table with no recorded fingerprint compares against nothing and
//     counts as a match.
//   - A shape change on a press counts as a move, so the press clears the
//     range expression in its one settings write.
//
// Every expected value below comes from that statement, never from the
// controller's source.

// --- Criterion: scrolling a virtualized grid, which changes the drawn row
// count, does not trip the fingerprint. Shape one: a grid that groups its data
// rows, with the header row outside the group. A scroll replaces the group's
// rows and leaves the header row alone. ---

(function shapeFingerprint_criterion1a_aRedrawnRowGroupKeepsTheEntry() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const g = makeScrollingRowgroupGrid(['Region', 'Q1'], [
      ['North', '1,482,391'], ['South', '918,554'], ['East', '55,120'],
    ]);
    registerFingerprintedTable(g.wrapperEl);
    DR_STORE.setSelectedTable(g.wrapperEl);
    const recorded = DR_STORE.getTableFingerprint(g.wrapperEl);
    const scrolledAwayCell = g.dataRowEls()[0].children[1];
    DR_STORE.setTableOriginal(g.wrapperEl, scrolledAwayCell, '1,482,391');

    // The scroll: a different set of rows, and fewer of them.
    g.redraw([['West', '7,314'], ['Inland', '2,905']]);

    sent.length = 0;
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: g.wrapperEl });
    });

    eq('fingerprint scroll: a redrawn row group leaves the recorded fingerprint in place',
      DR_STORE.getTableFingerprint(g.wrapperEl) === recorded, true);
    eq('fingerprint scroll: a redrawn row group publishes no table switch',
      sent.filter((m) => m.action === 'state:tableSwitched').length, 0);
    eq('fingerprint scroll: a redrawn row group keeps the entry\'s originals',
      DR_STORE.hasTableOriginal(g.wrapperEl, scrolledAwayCell), true);

    forgetRegisteredTable(g.wrapperEl);
  });
})();

// Shape two: a database query grid groups no rows, so its first row is a data
// row. The criterion holds here because the reading leaves that row's text
// out: the pane's fingerprint is its column count, which a scroll keeps.

(function shapeFingerprint_criterion1b_aRedrawnGrouplessPaneKeepsTheEntry() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);
    const recorded = DR_STORE.getTableFingerprint(grid.scrollPaneEl);
    const scrolledAwayCell = grid.scrollRowEls[0].children[1];
    DR_STORE.setTableOriginal(grid.scrollPaneEl, scrolledAwayCell, '7,318,204');

    // The scroll: the pane draws a different, shorter set of rows at the same
    // column count.
    dgReplacePaneRows(grid.scrollPaneEl, [
      makeDgRow(6, ['golf', '44,190', '12.08']),
      makeDgRow(7, ['hotel', '9,715', '4.33']),
    ]);

    sent.length = 0;
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint scroll: a redrawn groupless pane leaves the recorded fingerprint in place',
      DR_STORE.getTableFingerprint(grid.scrollPaneEl) === recorded, true);
    eq('fingerprint scroll: a redrawn groupless pane publishes no table switch',
      sent.filter((m) => m.action === 'state:tableSwitched').length, 0);
    eq('fingerprint scroll: a redrawn groupless pane keeps the entry\'s originals',
      DR_STORE.hasTableOriginal(grid.scrollPaneEl, scrolledAwayCell), true);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- What each shape reads on: a grid that groups its data rows compares its
// header row's texts, and a grid that groups nothing compares its column count
// alone. ---

(function shapeFingerprint_aGroupedGridsHeaderTextChangeTripsTheCheck() {
  runPressFixture(() => {
    const g = makeScrollingRowgroupGrid(['Region', 'Q1'], [
      ['North', '1,482,391'], ['South', '918,554'],
    ]);
    const removedPillboxes = registerFingerprintedTable(g.wrapperEl);
    DR_STORE.setSelectedTable(g.wrapperEl);

    g.headerRow.children[1].childNodes[0].nodeValue = 'Q2';

    let outcome = null;
    withToggleDocumentMock(function () { outcome = revalidateTableShape(g.wrapperEl); });

    eq('fingerprint grouped header: a header text change reports a switch',
      outcome.switched, true);
    eq('fingerprint grouped header: the grid registers fresh',
      outcome.table === g.wrapperEl, true);
    eq('fingerprint grouped header: the discard takes the old pillbox off the page',
      removedPillboxes.length, 1);
    eq('fingerprint grouped header: the fresh fingerprint carries the new header text',
      DR_STORE.getTableFingerprint(g.wrapperEl),
      { columnCount: 2, headerTexts: ['Region', 'Q2'] });

    forgetRegisteredTable(g.wrapperEl);
  });
})();

(function shapeFingerprint_aGrouplessGridsFirstRowTextDoesNotTripTheCheck() {
  runPressFixture(() => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);
    const recorded = DR_STORE.getTableFingerprint(grid.scrollPaneEl);

    dgReplaceRowCells(grid.scrollRowEls[0], ['golf', '44,190', '12.08']);
    let held = null;
    withToggleDocumentMock(function () { held = revalidateTableShape(grid.scrollPaneEl); });
    eq('fingerprint groupless: a first-row text change reports no switch', held.switched, false);
    eq('fingerprint groupless: the recorded fingerprint stays in place',
      DR_STORE.getTableFingerprint(grid.scrollPaneEl) === recorded, true);

    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 17)));
    let switched = null;
    withToggleDocumentMock(function () { switched = revalidateTableShape(grid.scrollPaneEl); });
    eq('fingerprint groupless: a column count change reports a switch', switched.switched, true);
    eq('fingerprint groupless: the fresh fingerprint carries the new column count',
      DR_STORE.getTableFingerprint(grid.scrollPaneEl).columnCount, 4);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- Criterion: changing the column set trips the fingerprint. The entry is
// discarded, and a pillbox press afterwards simplifies from a raw state. ---

// Shape one: the page redraws its rows one column wider, so every cell of the
// new result set is a fresh element carrying raw text.

(function shapeFingerprint_criterion2_aRedrawnWiderResultSetPressesFromRaw() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    const removedPillboxes = registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);
    const countCell = grid.scrollRowEls[1].children[1];

    // The first press simplifies, so the entry holds originals and a
    // simplified form before the page changes anything.
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    eq('fingerprint column change: the first press simplifies the pane (precondition)',
      isTableRounded(grid.scrollPaneEl), true);
    eq('fingerprint column change: that press stored originals (precondition)',
      DR_STORE.hasTableOriginal(grid.scrollPaneEl, countCell), true);

    // The page returns a result set one column wider.
    const measures = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const counts = ['7,318,204', '551,077', '2,140,663', '73,915', '10,428', '3,906'];
    const rates = ['284.51', '31.77', '58.02', '7.44', '2.19', '0.63'];
    const added = ['6,204,118', '412,905', '88,340', '9,127', '1,006', '771'];
    grid.scrollRowEls.forEach((rowEl, i) =>
      dgReplaceRowCells(rowEl, [measures[i], counts[i], rates[i], added[i]]));
    const addedCell = grid.scrollRowEls[1].children[3];

    sent.length = 0;
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint column change: the discard takes the old pillbox off the page',
      removedPillboxes.length, 1);
    eq('fingerprint column change: the pane registers fresh',
      DR_STORE.hasTable(grid.scrollPaneEl), true);
    eq('fingerprint column change: the fresh registration records the new column count',
      DR_STORE.getTableFingerprint(grid.scrollPaneEl).columnCount, 4);
    eq('fingerprint column change: the press after the change turns simplification on',
      DR_STORE.getSettings().enabled, true);
    eq('fingerprint column change: the press reports no apply block',
      sent.filter((m) => m.action === 'state:applyBlocked').length, 0);
    eq('fingerprint column change: the fresh entry\'s form is simplified',
      isTableRounded(grid.scrollPaneEl), true);
    eq('fingerprint column change: the fresh entry\'s originals carry the new column\'s text',
      DR_STORE.getTableOriginalText(grid.scrollPaneEl, addedCell), '412,905');

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// Shape two: the page adds one cell to every row and leaves the rows' other
// cells in place. Those cells still carry the extension's own simplified text
// and its marker class, and the discard drops the originals that back them.

(function shapeFingerprint_criterion2_anAddedColumnOverSurvivingCellsPressesFromRaw() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);
    const countCell = grid.scrollRowEls[1].children[1];

    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    eq('fingerprint added column: the first press simplifies the pane (precondition)',
      isTableRounded(grid.scrollPaneEl), true);

    const added = ['6,204,118', '412,905', '88,340', '9,127', '1,006', '771'];
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, added[i]));
    const addedCell = grid.scrollRowEls[1].children[3];

    sent.length = 0;
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint added column: the pane registers fresh',
      DR_STORE.hasTable(grid.scrollPaneEl), true);
    eq('fingerprint added column: the press reports no apply block',
      sent.filter((m) => m.action === 'state:applyBlocked').length, 0);
    eq('fingerprint added column: the fresh entry\'s originals carry the new column\'s text',
      DR_STORE.getTableOriginalText(grid.scrollPaneEl, addedCell), '412,905');
    eq('fingerprint added column: the fresh entry\'s originals carry a surviving cell\'s raw text',
      DR_STORE.getTableOriginalText(grid.scrollPaneEl, countCell), '551,077');

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// The restore runs before the discard, against the old entry while it still
// holds the originals, so a surviving cell reads raw at the moment the fresh
// entry records.
(function shapeFingerprint_theDiscardRestoresTheSurvivingCellsFirst() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);

    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    const countCell = grid.scrollRowEls[1].children[1];
    eq('fingerprint restore: the press simplified the count column (precondition)',
      countCell.childNodes[0].nodeValue !== '551,077', true);

    const added = ['6,204,118', '412,905', '88,340', '9,127', '1,006', '771'];
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, added[i]));

    let outcome = null;
    withToggleDocumentMock(function () { outcome = revalidateTableShape(grid.scrollPaneEl); });

    eq('fingerprint restore: the check reports a switch', outcome.switched, true);
    eq('fingerprint restore: a surviving cell reads its raw text once the fresh entry records',
      countCell.childNodes[0].nodeValue, '551,077');
    eq('fingerprint restore: that cell carries no simplified marker',
      countCell.classList.contains('dr-ext-rounded'), false);
    eq('fingerprint restore: the fresh entry holds no original for that cell',
      DR_STORE.hasTableOriginal(grid.scrollPaneEl, countCell), false);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- Criterion: a discarded entry's originals never reach the fresh entry. ---

(function shapeFingerprint_criterion3_aDiscardedEntrysOriginalsStayBehind() {
  runPressFixture(() => {
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);
    const sentinelCell = grid.scrollRowEls[2].children[1];
    DR_STORE.setTableOriginal(grid.scrollPaneEl, sentinelCell, '2,140,663');
    DR_STORE.setTableAppliedFlag(grid.scrollPaneEl, 'simplified');
    eq('fingerprint originals: the entry holds the sentinel original (precondition)',
      DR_STORE.hasTableOriginal(grid.scrollPaneEl, sentinelCell), true);

    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 1000)));

    let outcome = null;
    withToggleDocumentMock(function () { outcome = revalidateTableShape(grid.scrollPaneEl); });

    eq('fingerprint originals: the check reports a switch', outcome.switched, true);
    eq('fingerprint originals: the fresh registration lands on the same pane',
      outcome.table === grid.scrollPaneEl, true);
    eq('fingerprint originals: the sentinel original does not reach the fresh entry',
      DR_STORE.hasTableOriginal(grid.scrollPaneEl, sentinelCell), false);
    eq('fingerprint originals: the fresh entry holds an original for no cell of the grid',
      grid.scrollRowEls.some((rowEl) =>
        rowEl.children.some((cellEl) => DR_STORE.hasTableOriginal(grid.scrollPaneEl, cellEl))),
      false);
    eq('fingerprint originals: the fresh entry\'s form is raw',
      isTableRounded(grid.scrollPaneEl), false);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- Criterion: on a database query grid whose new result makes the pinned
// pane pass the data test, the fresh registration lands on the wrapper, the
// wrapper is active, and the old pane holds no pillbox. ---

(function shapeFingerprint_criterion4_aNewResultSetMovesTheRegistrationOutward() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    withToggleDocumentMock(function () { injectTogglesForAddedNode(grid.wrapperEl); });
    eq('fingerprint move: the page registers the scrolling pane alone (precondition)',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, true]);
    const removedPillboxes = trackPillboxDetach(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);

    // The new result set: the pinned pane gains a second column, which makes
    // it pass the data test, and the scrolling pane comes back two columns
    // wide. Two elements then sit at the configured depth, and the edge rule
    // falls back outward to the wrapper.
    const labels = ['north', 'south', 'east', 'west', 'inland', 'coastal'];
    const measures = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const counts = ['7,318,204', '551,077', '2,140,663', '73,915', '10,428', '3,906'];
    grid.pinnedRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, labels[i]));
    grid.scrollRowEls.forEach((rowEl, i) => dgReplaceRowCells(rowEl, [measures[i], counts[i]]));

    sent.length = 0;
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint move: the fresh registration lands on the wrapper',
      DR_STORE.hasTable(grid.wrapperEl), true);
    eq('fingerprint move: the wrapper becomes the active table',
      DR_STORE.getSelectedTable() === grid.wrapperEl, true);
    eq('fingerprint move: the discarded pane holds no registry entry',
      DR_STORE.hasTable(grid.scrollPaneEl), false);
    eq('fingerprint move: the discarded pane\'s pillbox comes off the page',
      removedPillboxes.length, 1);
    eq('fingerprint move: the wrapper carries a pillbox',
      tableToggles.has(grid.wrapperEl), true);
    eq('fingerprint move: the move publishes one table switch',
      sent.filter((m) => m.action === 'state:tableSwitched').length, 1);

    forgetRegisteredTable(grid.wrapperEl);
  });
})();

// --- Criterion: a native table's fingerprint trips when its header row's text
// changes, and holds when a data cell's text changes. ---

(function shapeFingerprint_criterion5_aNativeTablesHeaderTextTripsTheFingerprint() {
  runPressFixture(() => {
    const table = makeToggleTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
      [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    ]);
    const removedPillboxes = registerFingerprintedTable(table);
    DR_STORE.setSelectedTable(table);
    eq('fingerprint native: registration records the header row (precondition)',
      DR_STORE.getTableFingerprint(table), { columnCount: 2, headerTexts: ['Region', 'Q1'] });

    // A data cell's text changes and the header row's does not.
    table.rows[1].cells[1].innerText = '918,554';
    table.rows[1].cells[1].textContent = '918,554';
    let held = null;
    withToggleDocumentMock(function () { held = revalidateTableShape(table); });
    eq('fingerprint native: a data cell change reports no switch', held.switched, false);
    eq('fingerprint native: a data cell change returns the same table',
      held.table === table, true);
    eq('fingerprint native: a data cell change takes no pillbox off the page',
      removedPillboxes.length, 0);

    // The header row's text changes.
    table.rows[0].cells[1].innerText = 'Q2';
    table.rows[0].cells[1].textContent = 'Q2';
    let switched = null;
    withToggleDocumentMock(function () { switched = revalidateTableShape(table); });
    eq('fingerprint native: a header text change reports a switch', switched.switched, true);
    eq('fingerprint native: the native table registers fresh', switched.table === table, true);
    eq('fingerprint native: the discard takes the old pillbox off the page',
      removedPillboxes.length, 1);
    eq('fingerprint native: the fresh fingerprint carries the new header text',
      DR_STORE.getTableFingerprint(table), { columnCount: 2, headerTexts: ['Region', 'Q2'] });

    forgetRegisteredTable(table);
  });
})();

// --- A table with no recorded fingerprint compares against nothing. Only a
// first write through the registry's setters creates such an entry. ---

(function shapeFingerprint_anUnrecordedFingerprintCountsAsAMatch() {
  runPressFixture(() => {
    const table = makeToggleTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
      [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    ]);
    const cell = table.rows[1].cells[1];
    DR_STORE.setTableOriginal(table, cell,
      { value: '1,482,391', pieces: [{ text: '1,482,391', written: '1,482,391' }], supRanges: null, linkFilteredIdx: null });
    eq('fingerprint unrecorded: the entry carries no fingerprint (precondition)',
      DR_STORE.getTableFingerprint(table), null);

    const outcome = revalidateTableShape(table);
    eq('fingerprint unrecorded: the check reports no switch', outcome.switched, false);
    eq('fingerprint unrecorded: the check returns the same table', outcome.table === table, true);
    eq('fingerprint unrecorded: the entry\'s originals stay',
      DR_STORE.hasTableOriginal(table, cell), true);
    DR_STORE.unregisterTable(table);
  });
})();

// --- Nothing registering stops the action. The page returns a narrower result
// set holding no number, so the column count trips the check and every element
// of the nest then fails the data test. ---

(function shapeFingerprint_nothingRegisteringStopsThePressAndClearsTheActiveTable() {
  runPressFixture(({ writes, resetWrites }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);

    emptyTheDatabaseQueryGridOfNumbers(grid);

    resetWrites();
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint recovery: no element of the nest holds a registry entry',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, false]);
    eq('fingerprint recovery: the discarded table was active, so the active table clears',
      DR_STORE.getSelectedTable() === null, true);
    eq('fingerprint recovery: the press stops, so it makes no settings write', writes(), 0);
    eq('fingerprint recovery: the empty recovery records a debug row',
      recentLogRows().some((text) => /no table registered after the shape change/.test(text)),
      true);
  });
})();

(function shapeFingerprint_nothingRegisteringLeavesAnotherActiveTableAlone() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const other = makePressTable('1,000,000');
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(other);

    emptyTheDatabaseQueryGridOfNumbers(grid);

    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint recovery: a discarded table that was not active leaves the active table alone',
      DR_STORE.getSelectedTable() === other, true);
  });
})();

// The restore runs before the discard on this path too: the page reads raw
// after a recovery that registers nothing. The narrowing keeps each row's
// simplified cell, so the surviving text is the extension's own until the
// restore puts the original back, and no entry remains to restore from after.
(function shapeFingerprint_theNothingRegisteringPathLeavesThePageReadingRaw() {
  runPressFixture(() => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);

    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });
    const countCell = grid.scrollRowEls[1].children[1];
    eq('fingerprint restore: the press simplified the count column (precondition)',
      countCell.childNodes[0].nodeValue !== '551,077', true);

    // The page narrows every row to its count cell and empties the pinned
    // rows, so no row of the nest holds two cells and nothing registers.
    grid.pinnedRowEls.forEach((rowEl) => dgKeepRowCells(rowEl, []));
    grid.scrollRowEls.forEach((rowEl) => dgKeepRowCells(rowEl, [1]));

    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint restore: the nest holds no registry entry after the recovery',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, false]);
    eq('fingerprint restore: the surviving cell reads its raw text',
      countCell.childNodes[0].nodeValue, '551,077');
    eq('fingerprint restore: the surviving cell carries no simplified marker',
      countCell.classList.contains('dr-ext-rounded'), false);
  });
})();

// --- A shape change on a press counts as a move: the range expression states
// rows and columns by position, so it describes a shape that is gone. ---

(function shapeFingerprint_aShapeChangeOnAPressCountsAsAMove() {
  runPressFixture(({ sent, writes, resetWrites }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false, rangeExpr: 'B2' }));
    const grid = makeDatabaseQueryGrid();
    registerFingerprintedTable(grid.scrollPaneEl);
    DR_STORE.setSelectedTable(grid.scrollPaneEl);
    grid.scrollRowEls.forEach((rowEl, i) => dgAppendRowCell(rowEl, String((i + 1) * 101)));

    sent.length = 0;
    resetWrites();
    withToggleDocumentMock(function () {
      DR_BUS.publish('intent:toggleTable', { table: grid.scrollPaneEl });
    });

    eq('fingerprint move: a shape change clears the range expression',
      DR_STORE.getSettings().rangeExpr, '');
    eq('fingerprint move: a shape change still makes exactly one settings write', writes(), 1);
    eq('fingerprint move: a shape change publishes the table switch once',
      sent.filter((m) => m.action === 'state:tableSwitched').length, 1);
    eq('fingerprint move: a shape change publishes no enabled-changed report',
      sent.filter((m) => m.action === 'state:tableEnabledChanged').length, 0);

    forgetRegisteredTable(grid.scrollPaneEl);
  });
})();

// --- The second entry point: the apply. The shape check runs before the
// reset, so a locked table whose content the page replaced registers fresh and
// the apply proceeds. ---

(function shapeFingerprint_aLockedTableWhoseShapeChangedRegistersFresh() {
  runPressFixture(({ sent }) => {
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: true }));
    const table = makeToggleTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q1' }],
      [{ tag: 'td', text: 'North' }, { tag: 'td', text: '1,482,391' }],
    ]);
    // The unrestorable pairing: a cell wearing the simplified marker that the
    // registry holds no original for.
    table._cells[3].classList.add('dr-ext-rounded');
    const removedPillboxes = registerFingerprintedTable(table);
    DR_STORE.setSelectedTable(table);

    sent.length = 0;
    withCreateTreeWalker(function () {
      withToggleDocumentMock(function () {
        applySidebarRounding(table, DR_STORE.getSettings());
      });
    });
    eq('fingerprint lock: the locked table blocks the apply before the change (precondition)',
      sent.filter((m) => m.action === 'state:applyBlocked').length, 1);

    // The page replaces the result: fresh cells, and a different header text.
    const replacement = makeToggleTable([
      [{ tag: 'th', text: 'Region' }, { tag: 'th', text: 'Q2' }],
      [{ tag: 'td', text: 'South' }, { tag: 'td', text: '918,554' }],
    ]);
    table.rows = replacement.rows;
    table._cells = replacement._cells;

    sent.length = 0;
    withCreateTreeWalker(function () {
      withToggleDocumentMock(function () {
        applySidebarRounding(table, DR_STORE.getSettings());
      });
    });

    eq('fingerprint lock: the replaced table publishes no apply block',
      sent.filter((m) => m.action === 'state:applyBlocked').length, 0);
    eq('fingerprint lock: the replaced table registers fresh',
      DR_STORE.hasTable(table), true);
    eq('fingerprint lock: the fresh fingerprint carries the new header text',
      DR_STORE.getTableFingerprint(table), { columnCount: 2, headerTexts: ['Region', 'Q2'] });
    eq('fingerprint lock: the discard takes the old pillbox off the page',
      removedPillboxes.length, 1);
    eq('fingerprint lock: the apply reports success',
      sent.filter((m) => m.action === 'state:applyOk').length, 1);
    eq('fingerprint lock: the apply publishes one table switch',
      sent.filter((m) => m.action === 'state:tableSwitched').length, 1);

    forgetRegisteredTable(table);
  });
})();

// --- capture: the displayed-text read and the plain-original-text read ---
//
// The capture records what the screen shows AND what each cell held before.
// Two reads serve it. (1) Adapter cells gain getDisplayedText(): the live
// rendered text, never the originals port — on a rounded grid getText()
// answers with the ORIGINAL (the engine's contract; see the port-preferring
// read in GridAdapter._makeCellObj), so a capture reading getText() would
// lie about the screen. (2) The registry stores a cell's original in two
// shapes (grid: { value, pieces, ... }; native: { html, value, ... });
// DR_STORE.getTableOriginalText() resolves the difference in one place and
// returns plain text for either kind, or undefined when nothing is stored.

(function captureDisplayedTextRead() {
  // Native cell: the displayed text is the live text — the same read
  // getText() uses, because the native write path never shadows it.
  const nativeCellEl = { tagName: 'TD', innerText: '1,234', textContent: '1,234' };
  const nativeStub = {
    rows: [{ parentElement: { tagName: 'TBODY' }, cells: [nativeCellEl] }],
  };
  const nativeCell = new NativeTableAdapter(nativeStub).getRows()[0].getCells()[0];
  eq('capture-reads: a native cell\'s displayed text is its live text',
    typeof nativeCell.getDisplayedText === 'function'
      ? nativeCell.getDisplayedText() : null,
    '1,234');

  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const makeGridCellEl = (text) => ({
    nodeType: 1,
    childNodes: [{ nodeType: 3, nodeValue: text }],
    classList: { add() {}, contains() { return false; } },
    // Like the DOM: textContent derives from the child nodes, so a
    // patch through nodeValue shows up in the whole-cell read.
    get textContent() { return this.childNodes[0].nodeValue; },
  });
  const adapter = new GridAdapter({}, { originalsPort: makePort() });

  // Grid cell, unrounded: displayed text equals the engine's read.
  const fresh = adapter._makeCellObj(makeGridCellEl('98,765'));
  eq('capture-reads: an unrounded grid cell\'s displayed text equals its engine text',
    typeof fresh.getDisplayedText === 'function'
      ? { displayed: fresh.getDisplayedText(), engine: fresh.getText() } : null,
    { displayed: '98,765', engine: '98,765' });

  // Grid cell, rounded: the engine's read answers with the original through
  // the port; the displayed read answers with what the screen shows now.
  const rounded = adapter._makeCellObj(makeGridCellEl('98,765'));
  rounded.applyPatches([{ index: 0, numStr: '98,765', newNum: '99,000' }]);
  eq('capture-reads: a rounded grid cell keeps engine text = original, displayed text = live',
    typeof rounded.getDisplayedText === 'function'
      ? { engine: rounded.getText(), displayed: rounded.getDisplayedText() } : null,
    { engine: '98,765', displayed: '99,000' });
})();

// A grid cell that builds its text from several pieces — a number and a unit
// in separate nodes — displays all of them. findCellTextNode answers with one
// deepest text node (the write path's patch target); the displayed-text read
// answers with the cell's whole text, matching the native read. Regression
// for #303: "1,234<span>%</span>" recorded text: "%".
(function captureDisplayedTextReadsWholeCell() {
  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const adapter = new GridAdapter({}, { originalsPort: makePort() });
  const textNode = (text) => ({ nodeType: 3, nodeValue: text });
  const span = (text) => ({ nodeType: 1, childNodes: [textNode(text)] });
  const makePiecedCellEl = (children, wholeText) => ({
    nodeType: 1,
    childNodes: children,
    classList: { add() {}, contains() { return false; } },
    textContent: wholeText,
  });

  const numberThenUnit = adapter._makeCellObj(
    makePiecedCellEl([textNode('1,234'), span('%')], '1,234%'));
  eq('capture-reads: a grid cell of number-then-unit pieces displays the whole text',
    numberThenUnit.getDisplayedText(), '1,234%');

  const unitThenNumber = adapter._makeCellObj(
    makePiecedCellEl([span('$'), textNode('1,234')], '$1,234'));
  eq('capture-reads: a grid cell of unit-then-number pieces displays the whole text',
    unitThenNumber.getDisplayedText(), '$1,234');
})();

(function capturePlainOriginalTextRead() {
  const has = typeof DR_STORE.getTableOriginalText === 'function';
  const table = {};
  const gridCell = {};
  const nativeCell = {};
  const stringCell = {};
  DR_STORE.setTableOriginal(table, gridCell,
    { value: '98,765', pieces: [{ text: '98,765', written: '100,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableOriginal(table, nativeCell,
    { value: '1,234', pieces: [{ text: '1,234', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableOriginal(table, stringCell, '55,000');
  eq('capture-reads: a grid original (record) reads back as its value field',
    has ? DR_STORE.getTableOriginalText(table, gridCell) : null, '98,765');
  eq('capture-reads: a plain-string original reads back as itself',
    has ? DR_STORE.getTableOriginalText(table, stringCell) : null, '55,000');
  eq('capture-reads: a native original (record) reads back as its value field',
    has ? DR_STORE.getTableOriginalText(table, nativeCell) : null, '1,234');
  eq('capture-reads: a cell with no stored original reads back undefined',
    has ? DR_STORE.getTableOriginalText(table, {}) : null, undefined);
  DR_STORE.unregisterTable(table);
})();

// --- content.js: the request:captureState topic ---
//
// The sidebar asks for the whole page-side half of a capture in one request.
// The answer is composed by buildCaptureStateResponse() — a named function
// the suite drives directly, because the bus's own listener is a no-op stub
// here (the established equivalent-path pattern, see the intent:closeSidebar
// note above). A source assertion pins that the responder exists and routes
// through it.

(function captureWireAction() {
  eq('capture-wire: buildCaptureStateResponse loads in the content-script bundle',
    typeof globalThis.buildCaptureStateResponse, 'function');
  eq('capture-wire: the responder answers request:captureState through buildCaptureStateResponse',
    /respond\('request:captureState'[\s\S]{0,200}buildCaptureStateResponse\(\)/.test(sourceByName('content.js') || ''),
    true);
  if (typeof globalThis.buildCaptureStateResponse !== 'function') return;

  // The shared DR_STORE still holds stub tables registered by earlier test
  // sections (the suite never unregisters them), so these assertions are
  // relative: no absolute table counts, and the focus assertions pin MY
  // table through activeTableIndex.
  const prevSelected = DR_STORE.getSelectedTable();

  // With no table bound: no lens preview, no seed, no focus — and the page
  // field and log snapshot still present.
  DR_STORE.setSelectedTable(null);
  const unboundResponse = buildCaptureStateResponse();
  eq('capture-wire: no table bound still answers with an honest unbound state',
    {
      captureFormat: unboundResponse.captureFormat,
      activeTableIndex: unboundResponse.activeTableIndex,
      fixtureSeed: unboundResponse.fixtureSeed,
      lensPreview: unboundResponse.lensPreview,
      tablesIsArray: Array.isArray(unboundResponse.tables),
    },
    { captureFormat: 6, activeTableIndex: null, fixtureSeed: null, lensPreview: null, tablesIsArray: true });
  eq('capture-wire: the response carries this context\'s log snapshot',
    Array.isArray(unboundResponse.log.entries) && unboundResponse.log.limit, 50);
  eq('capture-wire: collecting logs its own row, and that row lands in the capture',
    /capture state collected/.test(unboundResponse.log.entries.slice(-1)[0].text), true);
  eq('capture-wire: the page field exists even where location does not',
    'url' in unboundResponse.page && 'title' in unboundResponse.page, true);

  // With a real stub table registered and selected.
  const table = makeToggleTable([
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  table.outerHTML = '<table><tr><td>8,584,629</td><td>286</td></tr></table>';
  DR_STORE.registerTable(table);
  DR_STORE.setSelectedTable(table);
  try {
    const response = buildCaptureStateResponse();
    const mine = response.tables[response.activeTableIndex];
    eq('capture-wire: the bound table serializes in full and is the focus',
      {
        bound: response.activeTableIndex !== null,
        kind: mine.kind,
        cellTexts: mine.cells.map((c) => c.text),
      },
      { bound: true, kind: 'native', cellTexts: ['8,584,629', '286'] });
    eq('capture-wire: the fixture seed is the bound table\'s markup',
      response.fixtureSeed, '<table><tr><td>8,584,629</td><td>286</td></tr></table>');
    eq('capture-wire: the capture carries the lens preview',
      !!response.lensPreview && Array.isArray(response.lensPreview.samples.top), true);
  } finally {
    DR_STORE.setSelectedTable(prevSelected);
    DR_STORE.unregisterTable(table);
  }
})();

// --- capture follow-ups: the pull guard, the glyph pin, the header line ---

// #305: the serializer guards per table; the response composer's
// lens-preview step is the one step after it that walks the bound table.
// Unguarded, a throw there discards the whole page-side half — the
// serialized registry, the fixture seed, and the log rows.
(function capturePullSurvivesThrowingPreview() {
  if (typeof globalThis.buildCaptureStateResponse !== 'function') return;
  const prevSelected = DR_STORE.getSelectedTable();
  const throwing = {
    get rows() { throw new Error('hostile preview walk'); },
  };
  DR_STORE.registerTable(throwing);
  DR_STORE.setSelectedTable(throwing);
  let response = null;
  let threw = false;
  try {
    response = buildCaptureStateResponse();
  } catch (e) {
    threw = true;
  } finally {
    DR_STORE.setSelectedTable(prevSelected);
    DR_STORE.unregisterTable(throwing);
  }
  eq('capture-wire: a throwing lens preview keeps the page-side half',
    {
      threw,
      tablesIsArray: !!response && Array.isArray(response.tables),
      lensPreview: response ? response.lensPreview : 'response lost',
      hasLog: !!(response && response.log),
    },
    { threw: false, tablesIsArray: true, lensPreview: null, hasLog: true });
  eq('capture-wire: the discarded lens preview leaves a warn row',
    DR_LOG.snapshot().entries.some(
      (row) => row.level === 'warn' && /lens preview/.test(row.text)),
    true);
})();

// --- app model: the error state ---
//
// The tab's error state: whether an extension error has been recorded on
// this page, how many, and the last rows with their stack traces. The
// controller writes it from the log buffer's row listener, the toast view
// redraws from its state change, and the capture carries it. It never clears
// within a page's life; a reload starts clean because nothing persists.
//
// The live model is a singleton every earlier test has written to, so these
// tests build a fresh one: the settings contract, the bus, and the model,
// evaluated together in their own context.

(function appModelErrorState() {
  const { store, bus } = makeIsolatedModel();
  const empty = { hasError: false, count: 0, rows: [] };
  eq('error state: a fresh model holds no error', store.getErrorState(), empty);
  eq('error state: the snapshot a reconnecting view pulls carries the error state',
    store.getSnapshot().errorState, empty);

  const published = [];
  bus.subscribe('state:errorRecorded', (payload) => { published.push(payload); });
  const row = { at: '2026-09-17T16:00:00.000Z', level: 'warn', text: 'probe row', stack: 'at probe' };
  store.recordError(row);
  eq('error state: recording a row sets the indicator and the count',
    { hasError: store.getErrorState().hasError, count: store.getErrorState().count },
    { hasError: true, count: 1 });
  eq('error state: the recorded row keeps its time, level, text, and stack trace',
    store.getErrorState().rows[0], row);
  eq('error state: recording publishes the whole error state as a state change',
    published, [{ errorState: { hasError: true, count: 1, rows: [row] } }]);

  const read = store.getErrorState();
  read.rows[0].text = 'mutated';
  read.rows.push({});
  eq('error state: the getter returns copies', store.getErrorState().rows, [row]);

  for (let i = 0; i < 60; i++) {
    store.recordError({ at: 'x', level: 'warn', text: 'row ' + i, stack: null });
  }
  eq('error state: the rows hold at most 50 while the count keeps counting',
    { rows: store.getErrorState().rows.length, count: store.getErrorState().count },
    { rows: 50, count: 61 });
  eq('error state: the newest row survives the cap',
    store.getErrorState().rows[49].text, 'row 59');

  eq('bus: state:errorRecorded is a same-context state-change topic',
    DR_BUS.TOPICS['state:errorRecorded'], { family: 'state-change', route: null });
})();

// --- controller: the log buffer feeds the error state ---
//
// Every warn or error row the content script records is an extension error:
// the controller's row listener writes it into the model's error state, and
// debug and info rows stay out. Every failure the extension records today is
// a warn row, and the extension error page lists warn output beside errors.
// These run against the live model and log buffer, so every count is
// relative.

(function controllerRoutesErrorRows() {
  const before = DR_STORE.getErrorState().count;
  const origError = console.error;
  console.error = () => {};
  try {
    DR_LOG.warn('controller error probe');
    const afterWarn = DR_STORE.getErrorState();
    eq('controller: a warn row lands in the model\'s error state',
      { count: afterWarn.count, hasError: afterWarn.hasError,
        text: afterWarn.rows.slice(-1)[0] && afterWarn.rows.slice(-1)[0].text },
      { count: before + 1, hasError: true, text: 'controller error probe' });
    eq('controller: the recorded row carries the stack trace of the call that logged it',
      /controllerRoutesErrorRows/.test((afterWarn.rows.slice(-1)[0] || {}).stack || ''), true);
    DR_LOG.error('controller error-level probe');
    eq('controller: an error row lands in the model\'s error state',
      DR_STORE.getErrorState().count, before + 2);
    DR_LOG.debug('controller debug probe');
    DR_LOG.info('controller info probe');
    eq('controller: debug and info rows stay out of the error state',
      DR_STORE.getErrorState().count, before + 2);
  } finally {
    console.error = origError;
  }
})();

// ---------------------------------------------------------------------------
// The bus's topic table is the one declaration of every topic name.
//
// A name written out again at a call site is the defect the shared list was
// built to remove: one mistyped character produced a message no listener
// matched, with no error and no log row. The list retired into the bus's
// table, and the bus builds every wire message itself, so no context file
// needs a name of its own. These pin both halves.
// ---------------------------------------------------------------------------

(function theBusHoldsEveryTopicName() {
  const contextFiles = {
    'content.js': sourceByName('content.js') || '',
    'ui-toggle.js': uiToggleCode || '',
    'ui-toast.js': sourceByName('ui-toast.js') || '',
    'app/store.js': storeCode || '',
    'sidebar.js': fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8'),
    'background.js': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };

  // The bus is the only file that puts an action field on a message. A
  // context file writing one is reaching around the topic table.
  for (const [name, src] of Object.entries(contextFiles)) {
    const literals = (src.match(/action(?::|\s*===)\s*['"][A-Za-z][A-Za-z0-9_:]*['"]/g) || []);
    eq(`one topic list: ${name} builds no wire message of its own`, literals, []);
  }

  // Every name in the table is reachable: it appears in at least one context
  // file. A name left behind after its last use is clutter the next reader
  // has to rule out.
  const allContextSrc = Object.values(contextFiles).join('\n');
  const declared = Object.keys(DR_BUS.TOPICS);
  eq('one topic list: the scan has topics to check (fails closed on an empty table)',
    declared.length > 0, true);
  const unused = declared.filter((topic) => !allContextSrc.includes("'" + topic + "'"));
  eq('one topic list: every declared topic is used by at least one context file',
    unused, []);
})();

// --- #325 Task 1: the topic table carries a route ---
(function busTableCarriesRoute() {
  const VALID_ROUTES = [null, 'extension-pages', 'tab'];
  let allHaveFamily = true;
  let allHaveValidRoute = true;
  let noWireAction = true;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (typeof entry.family !== 'string' || entry.family.length === 0) allHaveFamily = false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'route')) { allHaveValidRoute = false; }
    else if (VALID_ROUTES.indexOf(entry.route) === -1) { allHaveValidRoute = false; }
    if (Object.prototype.hasOwnProperty.call(entry, 'wireAction')) noWireAction = false;
  }
  eq('bus table: every topic carries a non-empty family', allHaveFamily, true);
  eq('bus table: every topic carries a route drawn from the three valid values',
    allHaveValidRoute, true);
  eq('bus table: the table is not empty (fails closed on a lost table)',
    Object.keys(DR_BUS.TOPICS).length > 0, true);
  eq('bus table: no topic carries the retired wireAction field', noWireAction, true);
})();

// --- #325 Task 1: the route picks the carrier, not the publishing context ---
(function busRoutePicksCarrier() {
  // The old transport sniff inferred the carrier from which Chrome interface
  // the publishing context held. The route no longer lets it.

  // A tab-routed topic with no explicit tab number: the bus runs the active-tab
  // lookup the sidebar used to repeat before each of its own sends. The payload
  // here is the bus's contract under test, not the topic's production payload —
  // the menu click carries none.
  const b = makeBusSandbox();
  b.bus.publish('intent:menuClicked', { probe: 1 });
  eq('bus route: a tab topic queries the active tab once', b.sent.queries, 1);
  eq('bus route: and sends to that tab', b.sent.tabs.length, 1);
  eq('bus route: aimed at the tab the query answered with',
    b.sent.tabs.length === 1 ? b.sent.tabs[0].tabId : null, 7);
  eq('bus route: the topic name itself is the name on the wire',
    b.sent.tabs.length === 1 ? b.sent.tabs[0].msg.action : null, 'intent:menuClicked');
  eq('bus route: the message carries the payload beside the name, nothing else',
    b.sent.tabs.length === 1 ? Object.keys(b.sent.tabs[0].msg).sort().join(',') : null,
    'action,probe');

  // An explicit tab number skips the lookup. Only the service worker holds a
  // tab number, and it holds it for a tab that may not be the active one.
  const c = makeBusSandbox();
  c.bus.publish('intent:menuClicked', {}, { tabId: 42 });
  eq('bus route: an explicit tab number skips the active-tab lookup', c.sent.queries, 0);
  eq('bus route: and addresses the tab the caller named',
    c.sent.tabs.length === 1 ? c.sent.tabs[0].tabId : null, 42);

  // A tab-routed publish from a context with no chrome.tabs cannot reach its
  // audience. Returning quietly would reproduce the silent miss the topic
  // table exists to remove.
  const d = makeBusSandbox({ noTabs: true });
  let threw = false;
  try { d.bus.publish('intent:menuClicked', {}); } catch (e) { threw = true; }
  eq('bus route: a tab topic published where chrome.tabs is absent throws', threw, true);

  // The extension-pages route takes the other carrier: the broadcast that
  // reaches the service worker and the open sidebar, and never a content
  // script. It needs no tab number, so it runs no active-tab lookup.
  const f = makeBusSandbox();
  f.bus.publish('intent:closeSidebar', {});
  eq('bus route: an extension-pages topic broadcasts once', f.sent.pages.length, 1);
  eq('bus route: and sends into no tab', f.sent.tabs.length, 0);
  eq('bus route: and runs no active-tab lookup', f.sent.queries, 0);
  eq('bus route: the broadcast carries the topic name on the wire',
    f.sent.pages.length === 1 ? f.sent.pages[0].action : null, 'intent:closeSidebar');

  // An extension-pages publish from a context with no chrome.tabs reaches its
  // audience: that carrier needs none. This is the case the sniff got wrong —
  // it read the absent interface as a reason to pick the other carrier.
  const g = makeBusSandbox({ noTabs: true });
  g.bus.publish('state:pageUnloaded', {});
  eq('bus route: an extension-pages topic sends from a context with no chrome.tabs',
    g.sent.pages.length, 1);

  // A same-context topic sends nothing either way.
  const e = makeBusSandbox();
  e.bus.publish('intent:selectTable', { table: null });
  eq('bus route: a route-less topic makes no wire send',
    e.sent.pages.length + e.sent.tabs.length, 0);
})();

// --- #340: publish() refuses a request topic rather than dropping its answer ---
//
// The ask refuses a topic recorded one-way and the answering registration
// refuses a topic recorded as a question. The one-way send had no matching
// refusal: handed a question it sent the message, the responder answered, and
// the answer went nowhere, with nothing logged and nothing failed.
(function busPublishRefusesRequestTopic() {
  const a = makeBusSandbox();
  let message = '';
  try {
    a.bus.publish('request:applySettings', { settings: {} });
  } catch (e) {
    message = e.message;
  }
  eq('one-way guard: publishing a request topic throws', message.length > 0, true);
  eq('one-way guard: the error names the topic and points at request()',
    message.includes('request:applySettings') && message.includes('request()'), true);
  eq('one-way guard: and nothing goes out on either carrier',
    a.sent.pages.length + a.sent.tabs.length, 0);

  // The two siblings, unchanged: each of the three pairings now refuses.
  const b = makeBusSandbox();
  let askThrew = false;
  try { b.bus.request('intent:menuClicked', {}, () => {}); } catch (e) { askThrew = true; }
  eq('one-way guard: request() still refuses a one-way topic', askThrew, true);
  let respondThrew = false;
  try { b.bus.respond('intent:menuClicked', () => {}); } catch (e) { respondThrew = true; }
  eq('one-way guard: respond() still refuses a one-way topic', respondThrew, true);
})();

// --- #325 Task 2: a subscriber learns the sending tab ---
//
// The service worker's page-unload handler reads the sending tab's number off
// Chrome's sender record and acts only when that tab is the one the sidebar
// was opened for. The bus handed subscribers the payload alone, and a payload
// cannot carry the number — a content script does not hold its own. Without
// this argument, moving that topic onto the bus would close the sidebar on a
// page unload in any tab.
(function busSubscriberReceivesSenderTab() {
  const a = makeBusSandbox();
  const sameContext = [];
  a.bus.subscribe('state:settingsChanged', (payload, meta) => { sameContext.push(meta); });
  a.bus.publish('state:settingsChanged', { settings: {} });
  eq('bus meta: a same-context publish reports no sending tab',
    sameContext.length === 1 && sameContext[0] && sameContext[0].tabId === null, true);

  const b = makeBusSandbox();
  const fromTab = [];
  b.bus.subscribe('state:settingsChanged', (payload, meta) => { fromTab.push(meta); });
  b.fire({ action: 'state:settingsChanged', settings: {} }, { tab: { id: 77 } });
  eq('bus meta: a wire message from a content script reports its tab number',
    fromTab.length === 1 && fromTab[0].tabId === 77, true);

  const c = makeBusSandbox();
  const fromPage = [];
  c.bus.subscribe('state:settingsChanged', (payload, meta) => { fromPage.push(meta); });
  c.fire({ action: 'state:settingsChanged', settings: {} }, {});
  eq('bus meta: a wire message from an extension page reports no tab number',
    fromPage.length === 1 && fromPage[0].tabId === null, true);

  // The payload stays exactly what the publisher sent. The tab number rides
  // beside it, never inside it, so no handler can mistake it for data the
  // publisher chose.
  const d = makeBusSandbox();
  let seenPayload = null;
  d.bus.subscribe('state:settingsChanged', (payload) => { seenPayload = payload; });
  d.fire({ action: 'state:settingsChanged', settings: { k: 1 } }, { tab: { id: 5 } });
  eq('bus meta: the tab number stays out of the payload',
    seenPayload === null ? null : Object.keys(seenPayload).sort().join(','), 'settings');
})();

// --- #325 Task 3: request and respond ---
(function busRequestReplyRoundTrip() {
  // The asking side: the answer chrome hands back reaches the callback.
  const a = makeBusSandbox({ reply: { settings: { k: 9 } } });
  let answer = 'untouched';
  a.bus.request('request:applySettings', { settings: {} }, (x) => { answer = x; });
  eq('bus request: the answer reaches the asker',
    answer && answer.settings ? answer.settings.k : null, 9);

  // The answering side: a responder's return value goes to Chrome's reply
  // callback, unwrapped.
  const b = makeBusSandbox();
  b.bus.respond('request:applySettings', (payload) => ({ echoed: payload.n }));
  let replied = 'untouched';
  b.fire({ action: 'request:applySettings', n: 5 }, { tab: { id: 3 } }, (r) => { replied = r; });
  eq('bus request: the responder\'s return value is what the asker receives',
    replied && replied.echoed, 5);

  // A responder reads the carrier's facts the same way a subscriber does.
  const c = makeBusSandbox();
  let responderMeta = null;
  c.bus.respond('request:applySettings', (payload, meta) => { responderMeta = meta; return {}; });
  c.fire({ action: 'request:applySettings' }, { tab: { id: 11 } }, () => {});
  eq('bus request: a responder receives the sending tab too',
    responderMeta ? responderMeta.tabId : null, 11);
})();

(function busRequestAbsentResponder() {
  // Three ways nothing answers. Each must reach the callback with undefined,
  // immediately — the sidebar's fallback to shipped defaults and to the
  // unbound state has always depended on the absence arriving at once, with no
  // waiting period.
  const noTab = makeBusSandbox({ noActiveTab: true });
  let a = 'untouched';
  let aCalled = false;
  noTab.bus.request('request:applySettings', {}, (x) => { aCalled = true; a = x; });
  eq('bus request: no active tab answers undefined', aCalled && a === undefined, true);

  const noScript = makeBusSandbox({ throwOnSend: true });
  let b = 'untouched';
  let bCalled = false;
  noScript.bus.request('request:applySettings', {}, (x) => { bCalled = true; b = x; });
  eq('bus request: no content script on the tab answers undefined',
    bCalled && b === undefined, true);

  const noResponder = makeBusSandbox();
  let c = 'untouched';
  let cCalled = false;
  noResponder.bus.request('request:applySettings', {}, (x) => { cCalled = true; c = x; });
  eq('bus request: no responder registered answers undefined',
    cCalled && c === undefined, true);

  // A context with no chrome.tabs cannot ask at all. publish() throws there,
  // because a lost one-way message is a silent miss; request() answers
  // undefined instead, because the asker already handles an unanswered ask and
  // that is exactly what this is.
  const noTabs = makeBusSandbox({ noTabs: true });
  let d = 'untouched';
  noTabs.bus.request('request:applySettings', {}, (x) => { d = x; });
  eq('bus request: a context with no chrome.tabs answers undefined', d, undefined);
})();

(function busRequestDeliversToOneContextOnly() {
  // A request addresses exactly one context, the tab's, so it never runs the
  // publishing context's own subscribers the way publish() does.
  const s = makeBusSandbox();
  let localRan = false;
  s.bus.subscribe('request:applySettings', () => { localRan = true; });
  s.bus.request('request:applySettings', {}, () => {});
  eq('bus request: a request does not deliver to same-context subscribers', localRan, false);

  // An arriving request with no responder in THIS context stays silent.
  // Answering undefined would close the asker's callback on behalf of a
  // context holding no answer.
  const t = makeBusSandbox();
  let answered = false;
  t.fire({ action: 'request:applySettings' }, { tab: { id: 1 } }, () => { answered = true; });
  eq('bus request: an arriving request with no local responder sends no reply',
    answered, false);
})();

(function busOneResponderPerTopic() {
  const s = makeBusSandbox();
  s.bus.respond('request:applySettings', () => 1);
  let threw = false;
  try { s.bus.respond('request:applySettings', () => 2); } catch (e) { threw = true; }
  eq('bus request: a second responder for one topic throws', threw, true);
})();

(function busRequestFamilyGuards() {
  const s = makeBusSandbox();
  let respondThrew = false;
  try { s.bus.respond('state:settingsChanged', () => 1); } catch (e) { respondThrew = true; }
  eq('bus request: respond on a non-request topic throws', respondThrew, true);

  let requestThrew = false;
  try { s.bus.request('state:settingsChanged', {}, () => {}); } catch (e) { requestThrew = true; }
  eq('bus request: request on a non-request topic throws', requestThrew, true);

  let unknownThrew = false;
  try { s.bus.respond('not:a:topic', () => 1); } catch (e) { unknownThrew = true; }
  eq('bus request: respond on an unknown topic throws', unknownThrew, true);
})();

(function busRequestFamilyImpliesTabRoute() {
  // A request addresses exactly one context. Any other route on a request
  // entry is a table mistake, and this fails closed on it.
  let allTabRouted = true;
  let requestCount = 0;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (entry.family !== 'request') continue;
    requestCount++;
    if (entry.route !== 'tab') allTabRouted = false;
  }
  eq('bus table: at least one request topic exists (fails closed on a lost table)',
    requestCount > 0, true);
  eq('bus table: every request-family topic carries route "tab"', allTabRouted, true);
})();

(function busDepthGuardCoversResponders() {
  // A responder runs on the same depth counter a subscriber does, so an
  // unguarded cycle reached through a responder becomes a clear error rather
  // than a real stack overflow.
  //
  // The cycle goes responder -> responder, never through publish(). A cycle
  // that passed through a subscriber would be caught by publish()'s own
  // counter, and this test would stay green with the listener's guard deleted.
  const s = makeBusSandbox();
  s.bus.respond('request:applySettings', () => {
    s.fire({ action: 'request:applySettings' }, { tab: { id: 1 } }, () => {});
    return {};
  });
  let message = null;
  try {
    s.fire({ action: 'request:applySettings' }, { tab: { id: 1 } }, () => {});
  } catch (e) {
    message = e.message;
  }
  eq('bus request: the depth guard covers a cycle that runs only through responders',
    /depth exceeded/.test(message || ''), true);
  eq('bus request: the error says it happened while responding',
    /while responding to "request:applySettings"/.test(message || ''), true);

  // The counter unwinds on the way out, so a later publish on the SAME bus
  // behaves normally rather than still reading as deep. A fresh bus would
  // prove nothing here.
  let secondThrew = null;
  try {
    s.bus.publish('intent:selectTable', { table: null });
  } catch (e) {
    secondThrew = e.message;
  }
  eq('bus request: the depth counter recovers on the same bus after a responder cycle',
    secondThrew, null);
})();

// --- #325 Task 5: the settings apply is a request, not a publish ---
//
// It always carried a reply. The sidebar never read the reply's value, only
// whether anyone answered, and the bus served that through a second reply
// shape — a delivery-outcome callback beside the answer path. Two reply shapes
// in one component is the clutter issue #325 exists to remove.
(function settingsApplyUsesRequestPath() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const contentSrc = sourceByName('content.js');
  const busSrc = sourceByName('adapters/messaging.js');

  eq('settings apply: the sidebar asks through request()',
    /DR_BUS\.request\(\s*'request:applySettings'/.test(sidebarSrc), true);
  eq('settings apply: the sidebar no longer publishes it one-way',
    /DR_BUS\.publish\(\s*'request:applySettings'/.test(sidebarSrc), false);
  eq('settings apply: the content script answers through respond()',
    /DR_BUS\.respond\(\s*'request:applySettings'/.test(contentSrc), true);
  eq('settings apply: the delivery-outcome callback retires from the bus',
    busSrc.includes('onDelivery'), false);
  eq('settings apply: the sidebar keeps no delivery-outcome callback',
    sidebarSrc.includes('onDelivery'), false);

  // The unbind-on-no-answer rule is the load-bearing one. Drive it through the
  // bus rather than through the source text: an unanswered request must reach
  // the callback with nothing, which is what makes the sidebar unbind.
  const s = makeBusSandbox({ throwOnSend: true });
  let sawNothing = false;
  s.bus.request('request:applySettings', { settings: {} }, (answer) => {
    sawNothing = answer === undefined;
  });
  eq('settings apply: an unanswered apply reaches the asker with nothing, which is what unbinds the sidebar',
    sawNothing, true);

  // And the answered case stays distinguishable from it.
  const t = makeBusSandbox({ reply: { ok: true } });
  let sawAnswer = false;
  t.bus.request('request:applySettings', { settings: {} }, (answer) => {
    sawAnswer = !!(answer && answer.ok);
  });
  eq('settings apply: an answered apply is distinguishable from an unanswered one',
    sawAnswer, true);
})();

// --- #325 Task 12: one mechanism, one topic list ---
//
// The end state of the move. Two delivery mechanisms carried the eighteen
// cross-context topics; one carries all of them now. These pin the four facts
// that make that true, so a new raw send or a second listener fails here
// rather than reintroducing the split.
(function oneMechanismRemains() {
  const contentSrc = sourceByName('content.js');
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  const constantsSrc = sourceByName('constants.js');

  eq('one mechanism: the constants file holds no cross-context topic list',
    constantsSrc.includes('DR_CROSS_CONTEXT_TOPICS'), false);
  eq('one mechanism: the content script holds no Chrome message listener',
    contentSrc.includes('chrome.runtime.onMessage.addListener'), false);
  eq('one mechanism: the sidebar makes no raw tab send',
    sidebarSrc.includes('chrome.tabs.sendMessage'), false);
  eq('one mechanism: the sidebar runs no active-tab lookup of its own',
    sidebarSrc.includes('chrome.tabs.query'), false);
  eq('one mechanism: the worker holds no Chrome message listener',
    bgSrc.includes('chrome.runtime.onMessage.addListener'), false);

  for (const topic of ['request:settings', 'request:previewSamples', 'request:captureState']) {
    eq('one mechanism: the content script answers ' + topic,
      contentSrc.includes("respond('" + topic + "'"), true);
    eq('one mechanism: the sidebar asks ' + topic,
      sidebarSrc.includes("request('" + topic + "'"), true);
  }

  // Every topic name follows the bus's one naming style.
  let allNamed = true;
  for (const topic in DR_BUS.TOPICS) {
    if (!/^(intent|state|request):[a-z][A-Za-z]*$/.test(topic)) allNamed = false;
  }
  eq('one mechanism: every topic name follows the family:name style', allNamed, true);
  eq('one mechanism: the table holds all eighteen cross-context topics plus the five same-context ones',
    Object.keys(DR_BUS.TOPICS).length, 23);
})();

// --- #325 Task 12: the moved responders answer through the bus ---
//
// The preview-samples branch carries a rule the source assertions above
// cannot see: with no table selected it answers a pair of nulls rather than
// nothing, because the sidebar reads a null samples field as the unbound
// state. This drives the content script's own bus listener the way Chrome
// does, in an isolated eval so the shared-scope model stays untouched.
(function movedRespondersAnswerThroughTheBus() {
  const capturedListeners = [];
  function fire(message) {
    let answer;
    for (const fn of capturedListeners) fn(message, {}, (r) => { answer = r; });
    return answer;
  }

  const saved = { chrome: global.chrome, document: global.document, window: global.window };
  global.chrome = {
    runtime: {
      onMessage: { addListener(fn) { capturedListeners.push(fn); } },
      sendMessage: () => {},
      lastError: null,
    },
  };
  global.document = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };
  global.window = {
    addEventListener: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  try {
    eval(contentScriptBundle);
  } catch (e) {
    // Module-level code may fail in the stub environment; the bus's listener
    // registers before any dynamic code runs.
  } finally {
    global.chrome = saved.chrome;
    global.document = saved.document;
    global.window = saved.window;
  }

  eq('moved responders: the bus listener was captured', capturedListeners.length, 1);
  if (capturedListeners.length === 0) return;

  // Nothing has been right-clicked in this isolated model.
  eq('moved responders: no selected table answers a pair of nulls, not nothing',
    fire({ action: 'request:previewSamples' }), { samples: null, maxMag: null });

  const captureAnswer = fire({ action: 'request:captureState' });
  eq('moved responders: the capture state answers an object',
    captureAnswer !== null && typeof captureAnswer === 'object', true);

  const settingsAnswer = fire({ action: 'request:settings' });
  eq('moved responders: the settings answer carries the model\'s record',
    !!(settingsAnswer && settingsAnswer.settings), true);
})();

// --- #325: a moved topic is deliverable inside the context that publishes it ---
//
// publish() hands the topic to same-context subscribers before it reaches the
// carrier. Every topic here crosses contexts, so one context publishing a topic
// it also subscribes to would run its own handler on the way out — a delivery
// the old inline listeners could not make, because a context never received its
// own send. No topic pairs that way today, and this fails at the commit if one
// starts to.
(function noContextPublishesWhatItSubscribes() {
  // Keyed by context, not by file: the content script's context loads
  // ui-toggle.js and app/store.js into the same scope as content.js, so a
  // publish in one and a subscription in another is the same loopback.
  const SOURCES = {
    'the content script': [sourceByName('content.js'), sourceByName('ui-toggle.js'),
      sourceByName('app/store.js')].map((src) => src || '').join('\n'),
    'the sidebar': fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8'),
    'the service worker': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };
  const CROSSING = Object.keys(DR_BUS.TOPICS).filter((t) => DR_BUS.TOPICS[t].route !== null);
  eq('one direction: the scan has cross-context topics to check (fails closed on an empty table)',
    CROSSING.length > 0, true);
  const bothEnds = [];
  const callsWith = (verb, topic) => new RegExp(verb + "\\(\\s*'" + topic + "'");
  for (const [context, src] of Object.entries(SOURCES)) {
    for (const topic of CROSSING) {
      const publishes = callsWith('publish', topic).test(src);
      const receives = callsWith('subscribe', topic).test(src) ||
        callsWith('respond', topic).test(src);
      if (publishes && receives) bothEnds.push(context + ' -> ' + topic);
    }
  }
  eq('one direction: no context both publishes and receives the same crossing topic',
    bothEnds, []);
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

const RW_UNROUNDED_ROW = /cells were left unrounded/;

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
