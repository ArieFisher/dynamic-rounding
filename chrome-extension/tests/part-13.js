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

