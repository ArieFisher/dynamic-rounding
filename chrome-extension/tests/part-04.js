// ---------------------------------------------------------------------------
// Sprint sidebar-tidyup: flat toggle list, new defaults, switch wrappers
// ---------------------------------------------------------------------------

(function sprintSidebarTidyup() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // ── AC1: options section has exactly seven toggle rows in the canonical order ──
  // Parse all toggle-label texts inside #optionsSection.
  // Strategy: extract the optionsSection fragment, then collect every
  // class="toggle-label" span's text content via a simple regex.
  const optionsSectionMatch = sidebarHtml.match(/<div[^>]*id="optionsSection"[^>]*>([\s\S]*?)<\/div>\s*\n\s*<div/);
  // Fallback: grab everything between id="optionsSection"> and the next sibling div
  const optsSectionRaw = (() => {
    const start = sidebarHtml.indexOf('id="optionsSection"');
    if (start === -1) return '';
    const tagEnd = sidebarHtml.indexOf('>', start);
    // Walk forward tracking open/close divs to extract the full container
    let depth = 1;
    let i = tagEnd + 1;
    while (i < sidebarHtml.length && depth > 0) {
      const nextOpen  = sidebarHtml.indexOf('<div', i);
      const nextClose = sidebarHtml.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
      else { depth--; if (depth === 0) { return sidebarHtml.slice(tagEnd + 1, nextClose); } i = nextClose + 6; }
    }
    return '';
  })();

  // Collect label texts in document order
  const labelRe = /class="toggle-label"[^>]*>([\s\S]*?)<\/span>/g;
  const labelTexts = [];
  let lm;
  while ((lm = labelRe.exec(optsSectionRaw)) !== null) {
    labelTexts.push(lm[1].trim());
  }

  const expectedOrder = ['words', 'currencies', 'percentages', 'dates', 'times', 'first row', 'first column'];

  eq('sidebar-tidyup AC1: options section has exactly 7 toggle rows',
    labelTexts.length, 7);

  eq('sidebar-tidyup AC1: toggle rows are in canonical order',
    labelTexts, expectedOrder);

  // ── AC2: forbidden phrases do not appear anywhere in the options section ──

  const forbidden = [
    'Include numbers in cells containing',
    'Exclude:',
    'round to:'
  ];
  for (const phrase of forbidden) {
    eq(`sidebar-tidyup AC2: "${phrase}" absent from options section`,
      optsSectionRaw.includes(phrase), false);
  }

  // Also check the full HTML for the same forbidden phrases (belt-and-braces)
  for (const phrase of forbidden) {
    eq(`sidebar-tidyup AC2 (full HTML): "${phrase}" absent`,
      sidebarHtml.includes(phrase), false);
  }

  // ── AC3: DR_DEFAULTS has the seven expected values ──

  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedCells is true',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedCurrency is true',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedPercent is true',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyDates is true',
    DR_DEFAULTS.simplifyDates, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyTimes is false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyFirstRow is false',
    DR_DEFAULTS.simplifyFirstRow, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyFirstColumn is false',
    DR_DEFAULTS.simplifyFirstColumn, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.dateGranularity is "year"',
    DR_DEFAULTS.dateGranularity, 'year');
  eq('sidebar-tidyup AC3: DR_DEFAULTS.timeGranularity is "hour"',
    DR_DEFAULTS.timeGranularity, 'hour');

  // ── AC4: every option-row checkbox is wrapped in a .switch element ──
  // For each of the seven option inputs by id, verify there is a parent
  // element with class "switch" enclosing the input.
  const optionInputIds = [
    'simplifyMixedCells', 'simplifyMixedCurrency', 'simplifyMixedPercent',
    'simplifyDates', 'simplifyTimes', 'simplifyFirstRow', 'simplifyFirstColumn'
  ];
  for (const id of optionInputIds) {
    // Match <label class="switch"> ... <input ... id="<id>"> ... </label>
    // OR <span class="switch"> ... <input ... id="<id>"> ... </span>
    const switchWrapRe = new RegExp(
      '<(?:label|span)[^>]*class="[^"]*\\bswitch\\b[^"]*"[^>]*>[\\s\\S]{0,300}' +
      '<input[^>]*id="' + id + '"',
      'm'
    );
    eq(`sidebar-tidyup AC4: #${id} is wrapped in a .switch element`,
      switchWrapRe.test(sidebarHtml), true);
  }

  // ── AC5: #timeGranularity <select> lists hour first, minute second ──
  // Extract the <select id="timeGranularity"> element and check option order.
  const timeSelectMatch = sidebarHtml.match(/<select[^>]*id="timeGranularity"[^>]*>([\s\S]*?)<\/select>/);
  const timeSelectHtml = timeSelectMatch ? timeSelectMatch[1] : '';

  const timeOptionRe = /value="([^"]+)"/g;
  const timeOptionValues = [];
  let tom;
  while ((tom = timeOptionRe.exec(timeSelectHtml)) !== null) {
    timeOptionValues.push(tom[1]);
  }

  eq('sidebar-tidyup AC5: #timeGranularity has exactly 2 options',
    timeOptionValues.length, 2);
  eq('sidebar-tidyup AC5: first option is "hour"',
    timeOptionValues[0], 'hour');
  eq('sidebar-tidyup AC5: second option is "minute"',
    timeOptionValues[1], 'minute');
})();

// ---------------------------------------------------------------------------
// Sprint date-tolerant-detection: isDateLike with adjacent text and markers
// ---------------------------------------------------------------------------

(function sprintDateTolerance() {

  // --- Acceptance criteria: positive cases ---

  // AC1: ISO date with trailing word
  eq('dateTolerance AC1: isDateLike("2020-03-14 sales") -> true',
    isDateLike('2020-03-14 sales'), true);

  // AC2: Named-month date with trailing superscript digit (footnote ref)
  eq('dateTolerance AC2: isDateLike("March 14, 2024¹") -> true',
    isDateLike('March 14, 2024¹'), true);

  // AC3: Ordinal day in standard month-day-year form
  eq('dateTolerance AC3: isDateLike("Jun 1st, 2020") -> true',
    isDateLike('Jun 1st, 2020'), true);

  // AC4: Day-month-year with ordinal day
  eq('dateTolerance AC4: isDateLike("21st June 2020") -> true',
    isDateLike('21st June 2020'), true);

  // --- Acceptance criteria: negative (false-positive guards) ---

  // AC5: "Sales: 2020" — label before bare year must NOT be a date
  eq('dateTolerance AC5: isDateLike("Sales: 2020") -> false',
    isDateLike('Sales: 2020'), false);

  // AC6: "$2,020.00" — currency amount containing a year-like number
  eq('dateTolerance AC6: isDateLike("$2,020.00") -> false',
    isDateLike('$2,020.00'), false);

  // AC7: "version 2020.1.3" — version string with year-like first component
  eq('dateTolerance AC7: isDateLike("version 2020.1.3") -> false',
    isDateLike('version 2020.1.3'), false);

  // --- Adversarial: multiple superscripts ---
  eq('dateTolerance: multiple superscripts "March 14, 2024¹²" -> true',
    isDateLike('March 14, 2024¹²'), true);

  // --- Adversarial: footnote markers ---
  eq('dateTolerance: footnote asterisk "March 14, 2024*" -> true',
    isDateLike('March 14, 2024*'), true);

  eq('dateTolerance: footnote dagger "March 14, 2024†" -> true',
    isDateLike('March 14, 2024†'), true);

  // --- Adversarial: leading label before full date ---
  eq('dateTolerance: leading label "Date: 2020-03-14" -> true',
    isDateLike('Date: 2020-03-14'), true);

  // --- Adversarial: ordinal in the middle (no comma) ---
  eq('dateTolerance: "June 1st 2020" -> true',
    isDateLike('June 1st 2020'), true);

  // --- Adversarial: bare year remains strict ---

  // "Q4 2020" — adjacent non-date word; bare-year strict anchors must block this
  eq('dateTolerance: bare-year strict "Q4 2020" -> false',
    isDateLike('Q4 2020'), false);

  // "2020 revenue" — trailing word on bare year must also be blocked
  eq('dateTolerance: bare-year strict "2020 revenue" -> false',
    isDateLike('2020 revenue'), false);

  // --- Adversarial: empty / whitespace ---
  eq('dateTolerance: empty string -> false',
    isDateLike(''), false);

  eq('dateTolerance: whitespace only "   " -> false',
    isDateLike('   '), false);

  // --- Regression: plain dates still work after the relaxation ---
  eq('dateTolerance regression: isDateLike("2020-03-14") -> true',
    isDateLike('2020-03-14'), true);

  eq('dateTolerance regression: isDateLike("March 14, 2024") -> true',
    isDateLike('March 14, 2024'), true);

  eq('dateTolerance regression: isDateLike("2020") -> true',
    isDateLike('2020'), true);

})();

// =============================================================================
// Sprint sidebar-table-rebind: createToggleForTable click rebind logic
// =============================================================================
//
// Helper: create a real toggle button via createToggleForTable with DOM stubs,
// then return { buttonEl, sentMessages } so callers can dispatch events and
// inspect chrome.runtime.sendMessage calls.
//
// The caller is responsible for resetting lastRightClickedTable before and
// after each sub-test, and for restoring chrome.runtime.sendMessage.

// ---------------------------------------------------------------------------
// AC1 (mouse path): sidebar open + different table → rebind + RESET dispatched
// ---------------------------------------------------------------------------

(function sidebarRebind_AC1_mouse_differentTable() {
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

  // Capture all sendMessage calls
  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  // Set module state: sidebar open, bound to tableA
  lastRightClickedTable = tableA;

  // Create toggle for tableB and click it (mouse path)
  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  // Capture state before restore
  const reboundToB_mouse = (lastRightClickedTable === tableB);
  const hasRounded_mouse = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));

  // Restore
  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  // 1a. lastRightClickedTable must now be tableB
  eq('rebind AC1 mouse: lastRightClickedTable rebound to tableB',
    reboundToB_mouse, true);

  // 1b. state:tableSwitched dispatched exactly once. Issue #251 renamed the
  // switch message from RESET_SIDEBAR_TO_DEFAULTS: the sidebar's handler now
  // pulls the model's settings, and the old name described the defaults
  // reset that fix removed.
  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('rebind AC1 mouse: state:tableSwitched dispatched exactly once',
    switchCalls.length, 1);

  // 1c. state:previewSamplesChanged NOT dispatched — the state:tableSwitched pull
  // chain already ends in the preview fetch; a second trigger would be a
  // duplicate round-trip.
  const previewCalls = sentMessages.filter(m => m.action === 'state:previewSamplesChanged');
  eq('rebind AC1 mouse: state:previewSamplesChanged not dispatched on a switch',
    previewCalls.length, 0);

  // 1d. The switch apply rounds tableB (the model's enabled is on)
  eq('rebind AC1 mouse: the switch apply rounded tableB',
    hasRounded_mouse, true);
})();

// ---------------------------------------------------------------------------
// AC1 (touch second-tap path): same assertions as mouse
// ---------------------------------------------------------------------------

(function sidebarRebind_AC1_touch_differentTable() {
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

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireTouchSecondTap(buttonB);

  // Capture state before restore
  const reboundToB_touch = (lastRightClickedTable === tableB);
  const hasRounded_touch = tableB._cells.some(c => c.classList.contains('dr-ext-rounded'));

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  eq('rebind AC1 touch: lastRightClickedTable rebound to tableB',
    reboundToB_touch, true);

  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('rebind AC1 touch: state:tableSwitched dispatched exactly once',
    switchCalls.length, 1);

  const previewCalls = sentMessages.filter(m => m.action === 'state:previewSamplesChanged');
  eq('rebind AC1 touch: state:previewSamplesChanged not dispatched on a switch',
    previewCalls.length, 0);

  eq('rebind AC1 touch: the switch apply rounded tableB',
    hasRounded_touch, true);
})();

// ---------------------------------------------------------------------------
// AC2 (mouse path): sidebar open, clicking same table → NO RESET dispatched
// ---------------------------------------------------------------------------

(function sidebarRebind_AC2_mouse_sameTable() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  lastRightClickedTable = tableA;

  const buttonA = createToggleWithSpies(tableA);
  fireMouseClick(buttonA);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  // Same-table guard: the switch message must NOT be dispatched
  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('rebind AC2 mouse: state:tableSwitched NOT dispatched for same-table click',
    switchCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// AC2 (touch second-tap path): same table → NO RESET dispatched
// ---------------------------------------------------------------------------

(function sidebarRebind_AC2_touch_sameTable() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '100' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  lastRightClickedTable = tableA;

  const buttonA = createToggleWithSpies(tableA);
  fireTouchSecondTap(buttonA);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('rebind AC2 touch: state:tableSwitched NOT dispatched for same-table click',
    switchCalls.length, 0);
})();

// ---------------------------------------------------------------------------
// AC3 (mouse path): sidebar CLOSED → clicking a different table → NO RESET
// ---------------------------------------------------------------------------

(function sidebarRebind_AC3_mouse_sidebarClosed() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  // Sidebar is CLOSED, lastRightClickedTable is tableA (different from tableB)
  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('press on a different table reports the switch with the sidebar closed (part one: nothing reads that state)',
    switchCalls.length, 1);
})();

// ---------------------------------------------------------------------------
// AC3 (touch second-tap path): sidebar CLOSED → NO RESET
// ---------------------------------------------------------------------------

(function sidebarRebind_AC3_touch_sidebarClosed() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '100' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '2,000,000' }, { tag: 'td', text: '400' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  lastRightClickedTable = tableA;

  const buttonB = createToggleWithSpies(tableB);
  fireTouchSecondTap(buttonB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('second tap on a different table reports the switch with the sidebar closed (part one: nothing reads that state)',
    switchCalls.length, 1);
})();

// ---------------------------------------------------------------------------
// AC4: closing the sidebar leaves a later press unchanged.
//
// This used to pin the opposite: the close flipped a page-held flag to false
// and the flag gated the switch. The 2026-09-14 sidebar-state-removal design
// retired both the flag and the gate (#241), and the close message stops at
// the sidebar page — the content script has no handler for it. The pin that
// carries weight now is that a press after a close behaves exactly like a
// press before one, which is the defect's own cure: a page whose flag went
// stale used to take the rebind path forever.
// ---------------------------------------------------------------------------

(function sidebarRebind_AC4_closeChangesNothingForALaterPress() {
  const tableA = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  tableA._cells.forEach(c => { c.querySelectorAll = () => []; });

  const tableB = makeToggleTable([
    [{ tag: 'td', text: 'H' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
  ]);
  tableB._cells.forEach(c => { c.querySelectorAll = () => []; });

  lastRightClickedTable = tableA;

  // The close reaches the sidebar page alone now, so there is nothing to
  // deliver here — the content script registers no branch for it. That
  // absence is asserted at the source, next to the other retirements.
  eq('rebind AC4: the content script registers no branch for the close message',
    /intent:closeSidebar/.test(sourceByName('content.js') || ''), false);

  // A press on a different table afterwards: the switch goes out, exactly as
  // it would have before the close.
  const sentMessages = [];
  const origSendMessage = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sentMessages.push(msg); };

  const buttonB = createToggleWithSpies(tableB);
  fireMouseClick(buttonB);

  global.chrome.runtime.sendMessage = origSendMessage;
  lastRightClickedTable = null;

  const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
  eq('after CLOSE_SIDEBAR, a press on a different table still reports the switch (part one: nothing reads that state)',
    switchCalls.length, 1);
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

// ---------------------------------------------------------------------------
// Source-level assertions (supplementary): verify structural invariants that
// cover both click branches and the sidebar.js handler in a single pass.
// These complement the live tests above and are an accepted fallback pattern
// for aspects that the Node harness cannot exercise at runtime.
// ---------------------------------------------------------------------------

(function sidebarRebind_sourceLevel() {
  // Click-handler rebind logic now spans content.js + ui-toggle.js (Phase 2);
  // scan the combined content-script source. Sprint app-model-selection moved
  // the active-table reference into DR_STORE (app/store.js) — ui-toggle.js
  // publishes an intent instead of writing content.js's variables directly, and
  // content.js's own writes go through DR_STORE's setters instead of a bare
  // assignment. These assertions were updated in that sprint to check the new
  // structure instead of the old direct-assignment one.
  const contentSrc = allContentSrc;
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const storeSrc = sourceByName('app/store.js') || '';

  // Whether the sidebar is open: retired by the 2026-09-14 sidebar-state-
  // removal design (#241). These four scans pinned the field, the two
  // handler calls that wrote it, and the one guard that read it; each now
  // pins its absence, in the same place, so a reintroduction anywhere in the
  // extension fails here rather than at some later symptom.
  //
  // Scanning for the NAMES rather than for a shape is deliberate: the defect
  // was a page-held copy of a fact only another context could correct, and
  // any spelling of that copy brings the defect back. The scan therefore
  // covers the whole extension, service worker and sidebar included, not
  // just the content script.
  const SIDEBAR_STATE_NAMES = /sidebarOpen|isSidebarOpen|setSidebarOpen|state:sidebarOpenChanged/;
  // The bus topic for "the sidebar was opened" (#325) shares the scan's
  // prefix and is a different thing: an event that happened, named once, not
  // a stored answer to "is it open". Its exact spelling is struck from the
  // source before the scan, so every other name carrying the prefix — a bare
  // sidebarOpened field included — still fails here.
  const SIDEBAR_OPENED_TOPIC = /state:sidebarOpened/g;
  const namesSidebarState = (src) => SIDEBAR_STATE_NAMES.test(src.replace(SIDEBAR_OPENED_TOPIC, ''));
  eq('sidebar-state removal: app/store.js declares no sidebar-open field',
    namesSidebarState(storeSrc), false);
  eq('sidebar-state removal: the content-script stack names no sidebar-open value',
    namesSidebarState(contentSrc), false);
  eq('sidebar-state removal: sidebar.js names no sidebar-open value',
    namesSidebarState(sidebarSrc), false);
  eq('sidebar-state removal: background.js names no sidebar-open value',
    namesSidebarState(fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8')), false);
  // The struck spelling is the topic name alone: a bare field carrying it
  // still trips the scan.
  eq('sidebar-state removal: a reintroduced sidebarOpened field still fails the scan',
    namesSidebarState('let sidebarOpened = false;'), true);
  eq('sidebar-state removal: the bus registers no sidebar-open topic',
    Object.prototype.hasOwnProperty.call(DR_BUS.TOPICS, 'state:sidebarOpenChanged'), false);

  // state:sidebarOpened survives — it still triggers the reconnect apply — but it
  // records nothing about the sidebar. CLOSE_SIDEBAR goes to the sidebar page
  // alone, so the content script carries no branch for it at all.
  eq('sidebar-state removal: state:sidebarOpened still runs the reconnect apply',
    /state:sidebarOpened[\s\S]{0,400}applySidebarRounding/.test(contentSrc), true);
  // The topic moved onto the bus (#325), so the needle is its bus name: a
  // reintroduced subscription in the content script is what this catches.
  eq('sidebar-state removal: content.js registers no branch for the close message',
    /intent:closeSidebar/.test(sourceByName('content.js') || ''), false);

  // The merged press path: one settings write, and no read of any sidebar
  // value. The behavioral pins live in the part-one block further down; this
  // one holds the line at the source, so a reintroduced guard fails here.
  // The handler names the element it acts on `target`: the shape-fingerprint
  // check ahead of the screen read returns the pressed table on a match and
  // the freshly registered element on a mismatch, and the flip direction
  // comes from whichever one the press continues on.
  eq('sidebar-state removal: the intent:toggleTable handler reads the screen for its flip direction',
    /intent:toggleTable'[\s\S]{0,1200}!isTableRounded\(target\)/.test(contentSrc), true);

  // content.js: sprint toggle-split consolidated the mouse and touch click
  // branches' controller logic (which used to each carry their own switch
  // send) into one intent:toggleTable subscriber in content.js, so the
  // literal now appears once, not per branch. Issue #251 renamed the switch
  // message from RESET_SIDEBAR_TO_DEFAULTS to state:tableSwitched — the sidebar's
  // handler pulls the model's settings instead of resetting to defaults.
  const switchCount = (contentSrc.match(/state:tableSwitched/g) || []).length;
  eq('rebind source: state:tableSwitched is dispatched from the shared intent:toggleTable handler (>= 1 occurrence)',
    switchCount >= 1, true);
  eq('rebind source: the RESET_SIDEBAR_TO_DEFAULTS message is gone from the content-script source',
    /RESET_SIDEBAR_TO_DEFAULTS/.test(contentSrc), false);

  // content.js: the intent:toggleTable handler's rebind branch publishes the
  // select-table intent instead of assigning DR_STORE's field directly —
  // sprint toggle-split moved this call out of ui-toggle.js along with the
  // rest of the rebind logic, but it stays a published intent rather than a
  // direct DR_STORE.setSelectedTable() call, keeping one place ("select
  // this table") for any caller of that concern, controller included.
  eq('rebind source: intent:toggleTable publishes intent:selectTable in the rebind block instead of writing DR_STORE directly',
    /DR_BUS\.publish\(\s*'intent:selectTable'/.test(contentSrc), true);
  eq('rebind source: no file assigns lastRightClickedTable directly anymore',
    /\blastRightClickedTable\s*=[^=]/.test(sourceByName('ui-toggle.js') || '') ||
    /\blastRightClickedTable\s*=[^=]/.test(sourceByName('content.js') || ''),
    false);

  // sidebar.js: the state:tableSwitched subscriber re-reads the model's
  // settings (issue #251) instead of resetting the controls to the shipped
  // defaults. The block is isolated to the subscriber's own body, so the
  // negative pins below cover the whole handler and nothing beyond it.
  const switchHandlerMatch = sidebarSrc.match(
    /boundTab\.subscribe\(\s*'state:tableSwitched'[^)]*\)\s*=>\s*\{([\s\S]*?)\n\}\);/);
  const switchHandlerBlock = switchHandlerMatch ? switchHandlerMatch[1] : '';
  eq('rebind source: sidebar.js state:tableSwitched handler block was isolated (sanity check on the scan itself)',
    switchHandlerBlock.length > 0, true);
  eq('rebind source: sidebar.js state:tableSwitched handler calls pullSettingsAndApplyToUI()',
    /pullSettingsAndApplyToUI\(\)/.test(switchHandlerBlock), true);

  // sidebar.js: state:tableSwitched handler does NOT reset the controls to the
  // shipped defaults — that reset is what desynced the panel from the model.
  eq('rebind source: sidebar.js state:tableSwitched handler does NOT call applyDefaultsToUI()',
    /applyDefaultsToUI\s*\(\)/.test(switchHandlerBlock), false);

  // sidebar.js: state:tableSwitched handler does NOT auto-apply settings
  // (must NOT call applyNow() inside the handler)
  eq('rebind source: sidebar.js state:tableSwitched handler does NOT call applyNow()',
    /applyNow\s*\(\)/.test(switchHandlerBlock), false);
})();

// =============================================================================
// Sprint sidebar-pill-left: toggle switch appears left of label in every row
// =============================================================================
//
// Acceptance criteria:
//   AC1. In every option row the switch (<label class="switch">) comes before
//        the .toggle-label text node — verified by comparing indexOf positions
//        of the checkbox <input> vs <span class="toggle-label"> within each row.
//   AC2. On the dates/times rows the <select id="dateGranularity"> /
//        <select id="timeGranularity"> is the last element — its index appears
//        AFTER the .toggle-label in the row substring.
//   AC3. sidebar.html does NOT contain "row-reverse" anywhere.
//   AC4. The .toggle-row CSS block does NOT contain "justify-content: space-between".

(function sidebarPillLeft() {
  const sidebarPath = path.join(__dirname, 'sidebar.html');
  const sidebarHtml = fs.readFileSync(sidebarPath, 'utf8');

  // Helper: extract the substring of sidebarHtml that covers the .toggle-row
  // whose checkbox has the given id. We find the opening <div class="toggle-row">
  // that contains id="<rowId>" and slice up to the matching </div>.
  function getRowSubstring(rowId) {
    // Find the checkbox input for this id within the full source.
    const inputPattern = new RegExp('id=["\']' + rowId + '["\']');
    const inputIdx = sidebarHtml.search(inputPattern);
    if (inputIdx === -1) return null;

    // Walk backwards to the nearest <div class="toggle-row"> opening tag.
    const beforeInput = sidebarHtml.slice(0, inputIdx);
    const divStart = beforeInput.lastIndexOf('<div class="toggle-row">');
    if (divStart === -1) return null;

    // Walk forwards to find the matching closing </div>.
    // We look for the first </div> that closes the outermost .toggle-row div.
    const fromDiv = sidebarHtml.slice(divStart);
    // Scan for the first </div> after the opening tag (these rows have no nested divs).
    const closeIdx = fromDiv.indexOf('</div>');
    if (closeIdx === -1) return null;

    return fromDiv.slice(0, closeIdx + '</div>'.length);
  }

  // --- AC1: switch appears before .toggle-label in each option row ---
  // Rows to check: simplifyMixedCells, simplifyFirstColumn (simple), simplifyDates, simplifyTimes.
  const simpleRows = ['simplifyMixedCells', 'simplifyFirstColumn'];
  for (const id of simpleRows) {
    const row = getRowSubstring(id);
    eq(`sidebar-pill-left AC1: row "${id}" exists in sidebar.html`,
      row !== null, true);
    if (row !== null) {
      const inputIdx = row.search(new RegExp('id=["\']' + id + '["\']'));
      const labelIdx = row.indexOf('<span class="toggle-label">');
      eq(`sidebar-pill-left AC1: switch input comes before .toggle-label in row "${id}"`,
        inputIdx < labelIdx, true);
    }
  }

  // Also check the date and time rows (they have a <select> too).
  const complexRows = ['simplifyDates', 'simplifyTimes'];
  for (const id of complexRows) {
    const row = getRowSubstring(id);
    eq(`sidebar-pill-left AC1: row "${id}" exists in sidebar.html`,
      row !== null, true);
    if (row !== null) {
      const inputIdx = row.search(new RegExp('id=["\']' + id + '["\']'));
      const labelIdx = row.indexOf('<span class="toggle-label">');
      eq(`sidebar-pill-left AC1: switch input comes before .toggle-label in row "${id}"`,
        inputIdx < labelIdx, true);
    }
  }

  // --- AC2: <select> is the last element (after .toggle-label) in dates/times rows ---
  const selectPairs = [
    { rowId: 'simplifyDates',  selectId: 'dateGranularity' },
    { rowId: 'simplifyTimes',  selectId: 'timeGranularity' },
  ];
  for (const { rowId, selectId } of selectPairs) {
    const row = getRowSubstring(rowId);
    if (row !== null) {
      const labelIdx  = row.indexOf('<span class="toggle-label">');
      const selectIdx = row.search(new RegExp('<select[^>]*id=["\']' + selectId + '["\']'));
      eq(`sidebar-pill-left AC2: <select id="${selectId}"> appears after .toggle-label in row`,
        selectIdx > labelIdx, true);
    }
  }

  // --- AC3: sidebar.html does not use row-reverse ---
  eq('sidebar-pill-left AC3: sidebar.html does not contain "row-reverse"',
    sidebarHtml.includes('row-reverse'), false);

  // --- AC4: .toggle-row CSS block does not use justify-content: space-between ---
  // Find the .toggle-row block by locating ".toggle-row {" and scanning to the closing "}".
  const toggleRowBlockStart = sidebarHtml.indexOf('.toggle-row {');
  eq('sidebar-pill-left AC4: .toggle-row CSS block is present in sidebar.html',
    toggleRowBlockStart !== -1, true);
  if (toggleRowBlockStart !== -1) {
    const fromBlock = sidebarHtml.slice(toggleRowBlockStart);
    const blockClose = fromBlock.indexOf('}');
    const toggleRowBlock = blockClose !== -1 ? fromBlock.slice(0, blockClose + 1) : fromBlock.slice(0, 200);
    eq('sidebar-pill-left AC4: .toggle-row CSS block does not contain "justify-content: space-between"',
      toggleRowBlock.includes('justify-content: space-between'), false);
  }
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
// AC1: Whole-cell exponent cell — 10<sup>12</sup> → innerText "1012"
// The exponent digits "12" must NOT be altered after roundTable runs.
// ---------------------------------------------------------------------------
(function supAC1_wholeCellExponent() {
  withSupCreateTreeWalker(function() {
    // "10<sup>12</sup>" → flattened innerText "1012"
    // segments: "10" (plain) + "12" (in <sup>)
    const cell = makeSuperscriptCell([
      { text: '10', inSup: false },
      { text: '12', inSup: true },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    // The exponent "12" must not have been touched — cell.innerText must still
    // contain "12" at the sup position (indices 2..4 of the flattened text).
    const supNode = cell._textNodes[1];
    eq('sup AC1: exponent text node "12" is unchanged after roundTable',
      supNode.nodeValue, '12');
  });
})();

// ---------------------------------------------------------------------------
// AC2a: "20 × 10<sup>15</sup>" — the "15" exponent must not be rounded.
// ---------------------------------------------------------------------------
(function supAC2a_positiveExponent() {
  withSupCreateTreeWalker(function() {
    // innerText: "20 × 1015" (7 + 2 chars)
    const cell = makeSuperscriptCell([
      { text: '20 × 10', inSup: false },
      { text: '15', inSup: true },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2a: exponent "15" in "20 × 10<sup>15</sup>" is unchanged',
      supNode.nodeValue, '15');
  });
})();

// ---------------------------------------------------------------------------
// AC2b: "20 × 10<sup>−12</sup> s" — unicode-minus negative exponent preserved.
// ---------------------------------------------------------------------------
(function supAC2b_negativeExponentWithUnit() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '20 × 10', inSup: false },
      { text: '−12', inSup: true },   // "−12"
      { text: ' s', inSup: false },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2b: exponent "−12" in "20 × 10<sup>−12</sup> s" is unchanged',
      supNode.nodeValue, '−12');
  });
})();

// ---------------------------------------------------------------------------
// AC2c: "~ 10<sup>−32</sup> sec" — the "−32" exponent must not be rounded.
// ---------------------------------------------------------------------------
(function supAC2c_negativeExponentTildeForm() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '~ 10', inSup: false },
      { text: '−32', inSup: true },   // "−32"
      { text: ' sec', inSup: false },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2c: exponent "−32" in "~ 10<sup>−32</sup> sec" is unchanged',
      supNode.nodeValue, '−32');
  });
})();

// ---------------------------------------------------------------------------
// AC2d: "6 × 10<sup>9</sup>" — the "9" exponent must not be rounded.
// ---------------------------------------------------------------------------
(function supAC2d_singleDigitExponent() {
  withSupCreateTreeWalker(function() {
    const cell = makeSuperscriptCell([
      { text: '6 × 10', inSup: false },
      { text: '9', inSup: true },
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    const supNode = cell._textNodes[1];
    eq('sup AC2d: exponent "9" in "6 × 10<sup>9</sup>" is unchanged',
      supNode.nodeValue, '9');
  });
})();

// ---------------------------------------------------------------------------
// AC3: Mixed cell — exponent protected, non-exponent number still eligible.
//
// Cell: "From inflation (~ 10<sup>−32</sup> sec) – 1234 ka"
// The "1234" is not inside <sup> so it goes through the normal extraction path.
// We use 1234 (magnitude 3) with default offsetTop=-0.5 which at max_mag=3
// should round 1234 → ~1000 (or similar). The key assertion is:
//   (a) the "−32" exponent node is unchanged, AND
//   (b) the "1234" text node IS modified (i.e. rounded/simplified).
// ---------------------------------------------------------------------------
(function supAC3_mixedCellExponentProtectedNonExponentRounded() {
  withSupCreateTreeWalker(function() {
    // segments: prefix, exponent (sup), suffix with large number
    const cell = makeSuperscriptCell([
      { text: 'From inflation (~ 10', inSup: false },
      { text: '−32', inSup: true },             // "−32"
      { text: ' sec) – 1234 ka', inSup: false }, // "– 1234 ka"
    ]);

    const table = {
      rows: [{ cells: [cell] }],
      querySelector: () => null,
      dataset: {},
    };

    roundTable(table, supTestOpts);

    // The exponent node must be untouched
    const supNode = cell._textNodes[1];
    eq('sup AC3: exponent "−32" in mixed cell is unchanged',
      supNode.nodeValue, '−32');

    // The non-exponent part must have been processed — assert the cell was
    // marked as rounded (dr-ext-rounded), which only happens when formattedValue
    // differs from originalValue (i.e. "1234" was simplified).
    eq('sup AC3: mixed cell is marked dr-ext-rounded (non-exponent 1234 was simplified)',
      cell.classList.contains('dr-ext-rounded'), true);
  });
})();

// ---------------------------------------------------------------------------
// Sprint invert-datetime-pills: simplifyDates / simplifyTimes boolean wiring
//
// Acceptance criteria verified here:
//   AC1: simplifyDates=true  → date cell IS rounded (dr-ext-rounded added, text changed)
//   AC2: simplifyDates=false → date cell is left UNCHANGED (no class, same text)
//   AC3: simplifyTimes=true  → time cell IS simplified (dr-ext-rounded added, text changed)
//   AC4: simplifyTimes=false → time cell is left UNCHANGED
//   AC5: sidebar.js updateDisabledState wires dateGranularity.disabled to !simplifyDates
//        and timeGranularity.disabled to !simplifyTimes (static source analysis only —
//        the test harness has no sidebar DOM path so live execution is not possible).
// ---------------------------------------------------------------------------

// --- AC1: simplifyDates=true → date cell is rounded ---
// Use a bare year "2018" with decade granularity: roundDateText("2018","decade")="2020",
// so the cell text must change and dr-ext-rounded must be added.
(function invertPills_AC1_simplifyDatesTrue() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC1: simplifyDates=true — date cell gets dr-ext-rounded class',
      cell.classList.contains('dr-ext-rounded'), true);
    eq('invert-pills AC1: simplifyDates=true — date cell text is changed (2018→2020)',
      cell.innerText, '2020');
  });
})();

// --- AC2: simplifyDates=false → date cell is left unchanged ---
// Same "2018" cell, same decade granularity, but simplifyDates=false.
// The cell must NOT be rounded — text stays "2018", no class added.
(function invertPills_AC2_simplifyDatesFalse() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC2: simplifyDates=false — date cell does NOT get dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC2: simplifyDates=false — date cell text is unchanged',
      cell.innerText, '2018');
  });
})();

// AC1/AC2 parity check with ISO date "2024-03-14" (decade granularity → "2020")
(function invertPills_AC1_AC2_isoDate() {
  withCreateTreeWalker(function() {
    // simplifyDates=true branch
    const tableOn = makeMockTable([[{ tag: 'td', text: '2024-03-14' }]]);
    roundTable(tableOn, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOn = tableOn.rows[0].cells[0];
    eq('invert-pills AC1 (ISO date): simplifyDates=true — ISO date rounded',
      cellOn.classList.contains('dr-ext-rounded'), true);
  });

  withCreateTreeWalker(function() {
    // simplifyDates=false branch — same input
    const tableOff = makeMockTable([[{ tag: 'td', text: '2024-03-14' }]]);
    roundTable(tableOff, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOff = tableOff.rows[0].cells[0];
    eq('invert-pills AC2 (ISO date): simplifyDates=false — ISO date NOT rounded',
      cellOff.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC2 (ISO date): simplifyDates=false — ISO date text unchanged',
      cellOff.innerText, '2024-03-14');
  });
})();

// --- AC3: simplifyTimes=true → time cell IS simplified ---
// "14:30" with hour granularity → roundTimeText returns "15:00" (half-hour rounds up).
(function invertPills_AC3_simplifyTimesTrue() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC3: simplifyTimes=true — time cell gets dr-ext-rounded class',
      cell.classList.contains('dr-ext-rounded'), true);
    eq('invert-pills AC3: simplifyTimes=true — time cell text is changed (14:30→15:00)',
      cell.innerText, '15:00');
  });
})();

// --- AC4: simplifyTimes=false → time cell is left UNCHANGED ---
// Same "14:30" cell; with simplifyTimes=false the cell must stay as-is.
(function invertPills_AC4_simplifyTimesFalse() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    const cell = table.rows[0].cells[0];
    eq('invert-pills AC4: simplifyTimes=false — time cell does NOT get dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC4: simplifyTimes=false — time cell text is unchanged',
      cell.innerText, '14:30');
  });
})();

// AC3/AC4 parity check with "3:45 PM" (hour granularity → "4:00 PM")
(function invertPills_AC3_AC4_twelveHour() {
  withCreateTreeWalker(function() {
    // simplifyTimes=true
    const tableOn = makeMockTable([[{ tag: 'td', text: '3:45 PM' }]]);
    roundTable(tableOn, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOn = tableOn.rows[0].cells[0];
    eq('invert-pills AC3 (12-hr): simplifyTimes=true — "3:45 PM" rounded',
      cellOn.classList.contains('dr-ext-rounded'), true);
    eq('invert-pills AC3 (12-hr): simplifyTimes=true — text changed to "4:00 PM"',
      cellOn.innerText, '4:00 PM');
  });

  withCreateTreeWalker(function() {
    // simplifyTimes=false — same input must be untouched
    const tableOff = makeMockTable([[{ tag: 'td', text: '3:45 PM' }]]);
    roundTable(tableOff, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cellOff = tableOff.rows[0].cells[0];
    eq('invert-pills AC4 (12-hr): simplifyTimes=false — "3:45 PM" NOT rounded',
      cellOff.classList.contains('dr-ext-rounded'), false);
    eq('invert-pills AC4 (12-hr): simplifyTimes=false — text unchanged',
      cellOff.innerText, '3:45 PM');
  });
})();

// --- AC5: sidebar.js updateDisabledState wires granularity dropdowns to toggles ---
// The harness has no live sidebar DOM, so we verify via static source analysis.
// We assert:
//   (a) updateDisabledState references dateGranularity.disabled and !simplifyDates
//   (b) updateDisabledState references timeGranularity.disabled and !simplifyTimes
// This proves the boolean is wired the correct way round in the sidebar source.
(function invertPills_AC5_sidebarDisabledStateStaticAnalysis() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // dateGranularity.disabled must be set to !simplifyDates (true when OFF, false when ON)
  eq('invert-pills AC5: sidebar.js sets dateGranularity.disabled = !simplifyDates',
    /dateGranularityEl\.disabled\s*=\s*!document\.getElementById\(['"]simplifyDates['"]\)\.checked/.test(sidebarSrc),
    true);

  // timeGranularity.disabled must be set to !simplifyTimes
  eq('invert-pills AC5: sidebar.js sets timeGranularity.disabled = !simplifyTimes',
    /timeGranularityEl\.disabled\s*=\s*!document\.getElementById\(['"]simplifyTimes['"]\)\.checked/.test(sidebarSrc),
    true);

  // updateDisabledState function must still exist (not deleted or renamed)
  eq('invert-pills AC5: sidebar.js defines updateDisabledState',
    /function updateDisabledState\b/.test(sidebarSrc), true);
})();

// --- Old keys (excludeDates / excludeTimes) must be absent from content.js and constants.js ---
// These were renamed to simplifyDates/simplifyTimes in this sprint.
// If the old names are still present as property assignments or conditions, the
// inversion is incomplete and rounding behaviour would be controlled by the wrong key.
(function invertPills_oldKeysAbsent() {
  const contentSrc = sourceByName('content.js');
  // Sprint merge-ladder moved the simplifyDates/simplifyTimes option reads
  // (and every other classification-ladder rule) out of content.js and into
  // lib/dr-simplify/ladder.js; content.js now only calls classifyCell.
  const ladderSrc = sourceByName('lib/dr-simplify/ladder.js');
  if (contentSrc === null || constantsCode === null || ladderSrc === null) {
    eq('invert-pills regression: source files present in manifest', false, true);
    return;
  }
  const sidebarSrc  = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // "excludeDates" and "excludeTimes" must not appear as identifiers in any of these files.
  eq('invert-pills regression: content.js does not reference excludeDates',
    /\bexcludeDates\b/.test(contentSrc), false);
  eq('invert-pills regression: content.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(contentSrc), false);
  eq('invert-pills regression: constants.js does not reference excludeDates',
    /\bexcludeDates\b/.test(constantsCode), false);
  eq('invert-pills regression: constants.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(constantsCode), false);
  eq('invert-pills regression: sidebar.js does not reference excludeDates',
    /\bexcludeDates\b/.test(sidebarSrc), false);
  eq('invert-pills regression: sidebar.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(sidebarSrc), false);
  eq('invert-pills regression: lib/dr-simplify/ladder.js does not reference excludeDates',
    /\bexcludeDates\b/.test(ladderSrc), false);
  eq('invert-pills regression: lib/dr-simplify/ladder.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(ladderSrc), false);

  // Conversely, simplifyDates and simplifyTimes MUST appear in each file.
  // content.js references them only transitively now (via opts passed to
  // classifyCell) — the ladder is the actual point of use.
  eq('invert-pills regression: lib/dr-simplify/ladder.js references simplifyDates',
    /\bsimplifyDates\b/.test(ladderSrc), true);
  eq('invert-pills regression: lib/dr-simplify/ladder.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(ladderSrc), true);
  eq('invert-pills regression: constants.js references simplifyDates',
    /\bsimplifyDates\b/.test(constantsCode), true);
  eq('invert-pills regression: constants.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(constantsCode), true);
  eq('invert-pills regression: sidebar.js references simplifyDates',
    /\bsimplifyDates\b/.test(sidebarSrc), true);
  eq('invert-pills regression: sidebar.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(sidebarSrc), true);
})();

// ---------------------------------------------------------------------------
// Sprint invert-datetime-pills: adversarial tests
//
// These tests are written from the SPEC, not the implementation.
// Adversarial focus: prove the boolean polarity is correct (true=simplify,
// false=leave alone) across a wider set of inputs and combinations that the
// developer's own tests did not exercise.
// ---------------------------------------------------------------------------

// --- ADV-AC1: century granularity also works when simplifyDates=true ---
// A different granularity than the developer tested (decade) to ensure the
// boolean wiring is not granularity-specific.
(function invertPills_adv_AC1_century() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'century', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC1 (century): simplifyDates=true — 2018 rounded to 2000',
      cell.innerText, '2000');
    eq('ADV AC1 (century): simplifyDates=true — cell gets dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), true);
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

// --- ADV-AC2: century granularity, simplifyDates=false — year must NOT be rounded ---
// Adversarial: if the implementation only guards the decade path, century would leak.
(function invertPills_adv_AC2_century() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'century', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC2 (century): simplifyDates=false — cell does NOT get dr-ext-rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC2 (century): simplifyDates=false — text unchanged (2018)',
      cell.innerText, '2018');
  });
})();

// --- ADV-AC2: mixed table — date cell left alone while numeric cell rounds ---
// A date-like year appears alongside a large number.
// simplifyDates=false: the year must not be rounded even though max_mag is
// computed from the real number in the same table.
(function invertPills_adv_AC2_mixedTable() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '8,584,629' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    eq('ADV AC2 (mixed): simplifyDates=false — date cell NOT rounded even with large sibling',
      dateCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC2 (mixed): simplifyDates=false — date cell text unchanged (2018)',
      dateCell.innerText, '2018');
    // Numeric cell SHOULD still be rounded (control: proves roundTable ran)
    const numCell = table.rows[0].cells[1];
    eq('ADV AC2 (mixed): numeric sibling 8,584,629 IS rounded (control)',
      numCell.classList.contains('dr-ext-rounded'), true);
  });
})();

// --- ADV-AC3/AC4: isolation — simplifyTimes=true with simplifyDates=false ---
// Time cell must be simplified; a date cell in the same row must be left alone.
// This catches any incorrect coupling between the two boolean flags.
(function invertPills_adv_AC3_timesOnDatesOff() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
      { tag: 'td', text: '2018' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const timeCell = table.rows[0].cells[0];
    const dateCell = table.rows[0].cells[1];
    eq('ADV AC3/AC4 isolation: simplifyTimes=true — time cell IS rounded',
      timeCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV AC3/AC4 isolation: simplifyTimes=true — time cell text changed (14:30→15:00)',
      timeCell.innerText, '15:00');
    eq('ADV AC3/AC4 isolation: simplifyDates=false — date cell NOT rounded',
      dateCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC3/AC4 isolation: simplifyDates=false — date cell text unchanged (2018)',
      dateCell.innerText, '2018');
  });
})();

// --- ADV-AC1/AC4: isolation — simplifyDates=true with simplifyTimes=false ---
// Date cell must be simplified; a time cell in the same row must be left alone.
(function invertPills_adv_AC1_datesOnTimesOff() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    const timeCell = table.rows[0].cells[1];
    eq('ADV AC1/AC4 isolation: simplifyDates=true — date cell IS rounded',
      dateCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV AC1/AC4 isolation: simplifyDates=true — date cell text changed (2018→2020)',
      dateCell.innerText, '2020');
    eq('ADV AC4/AC1 isolation: simplifyTimes=false — time cell NOT rounded',
      timeCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC4/AC1 isolation: simplifyTimes=false — time cell text unchanged (14:30)',
      timeCell.innerText, '14:30');
  });
})();

// --- ADV-AC4: time cell with simplifyTimes=false is not treated as a pure number ---
// "14:30" is not parseable by toNumber (returns null), so with simplifyTimes=false
// AND simplifyMixedCells=false, the cell must be fully skipped.
// Adversarial: confirm there is no fallthrough that rounds the time as a numeric value.
// (Note: simplifyMixedCells=true would extract 14 and 30 independently — that is a separate
// feature path. Here we test the pure numeric exclusion path only.)
(function invertPills_adv_AC4_timeNotTreatedAsNumber() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const cell = table.rows[0].cells[0];
    eq('ADV AC4: 14:30 with simplifyTimes=false and simplifyMixedCells=false — not rounded',
      cell.classList.contains('dr-ext-rounded'), false);
    eq('ADV AC4: 14:30 with simplifyTimes=false and simplifyMixedCells=false — text unchanged',
      cell.innerText, '14:30');
  });
})();

// --- ADV: DR_DEFAULTS has correct polarity ---
// simplifyDates must default to true (simplify by default).
// simplifyTimes must default to false (do not simplify by default).
// This is the direct spec requirement for the "inverted" rename: the default
// behavior (dates simplified, times not) must be encoded correctly.
(function invertPills_adv_defaults() {
  eq('ADV defaults: DR_DEFAULTS.simplifyDates is true (dates simplified by default)',
    DR_DEFAULTS.simplifyDates, true);
  eq('ADV defaults: DR_DEFAULTS.simplifyTimes is false (times not simplified by default)',
    DR_DEFAULTS.simplifyTimes, false);
  // Old keys must be absent from DR_DEFAULTS
  eq('ADV defaults: DR_DEFAULTS has no excludeDates key',
    Object.prototype.hasOwnProperty.call(DR_DEFAULTS, 'excludeDates'), false);
  eq('ADV defaults: DR_DEFAULTS has no excludeTimes key',
    Object.prototype.hasOwnProperty.call(DR_DEFAULTS, 'excludeTimes'), false);
})();

// --- ADV-AC1/AC3: both simplifyDates=true and simplifyTimes=true — both simplified ---
// Confirm both flags can be active simultaneously without one suppressing the other.
(function invertPills_adv_bothTrue() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: true, simplifyTimes: true,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    const timeCell = table.rows[0].cells[1];
    eq('ADV both=true: date cell IS rounded (2018→2020)',
      dateCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV both=true: date cell text changed to 2020',
      dateCell.innerText, '2020');
    eq('ADV both=true: time cell IS rounded (14:30→15:00)',
      timeCell.classList.contains('dr-ext-rounded'), true);
    eq('ADV both=true: time cell text changed to 15:00',
      timeCell.innerText, '15:00');
  });
})();

// --- ADV-AC2/AC4: both simplifyDates=false and simplifyTimes=false — neither simplified ---
// The fully-off state: no date or time cell gets rounded.
(function invertPills_adv_bothFalse() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([[
      { tag: 'td', text: '2018' },
      { tag: 'td', text: '14:30' },
    ]]);
    roundTable(table, {
      enabled: true, simplifyMixedCells: false, simplifyMixedCurrency: false, simplifyMixedPercent: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyDates: false, simplifyTimes: false,
      dateGranularity: 'decade', timeGranularity: 'hour',
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const dateCell = table.rows[0].cells[0];
    const timeCell = table.rows[0].cells[1];
    eq('ADV both=false: date cell NOT rounded',
      dateCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV both=false: date cell text unchanged (2018)',
      dateCell.innerText, '2018');
    eq('ADV both=false: time cell NOT rounded',
      timeCell.classList.contains('dr-ext-rounded'), false);
    eq('ADV both=false: time cell text unchanged (14:30)',
      timeCell.innerText, '14:30');
  });
})();

