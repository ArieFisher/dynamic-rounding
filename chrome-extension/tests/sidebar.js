// The sidebar page (sidebar.js, sidebar.html).

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

// ---------------------------------------------------------------------------
// --- sidebar.js: truncateDecimals / formatOriginal ---
//
// Strategy: extract the real implementations from sidebar.js source via regex
// and eval them in this scope (where toNumber and formatNumberWithCommas are
// already available from the evaled core.js / content.js block above).
// This exercises the REAL implementation, not a reimplementation.
// ---------------------------------------------------------------------------
(function sidebarHelperTests() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // Extract the two constants and three functions we need from sidebar.js.
  // We pull them as a verbatim block so they reference each other correctly.
  // toNumber and formatNumberWithCommas are already on globalThis from the
  // content-script eval above.
  const constBlock = sidebarSrc.match(
    /const PREVIEW_DECIMAL_THRESHOLD\s*=.*?;\s*const PREVIEW_MAX_DECIMALS\s*=.*?;/
  );
  const fmtCommasFn = sidebarSrc.match(
    /function formatNumberWithCommas\([\s\S]*?\n\}/
  );
  const truncateFn = sidebarSrc.match(
    /function truncateDecimals\([\s\S]*?\n\}/
  );
  const formatOriginalFn = sidebarSrc.match(
    /function formatOriginal\([\s\S]*?\n\}/
  );

  if (!constBlock || !fmtCommasFn || !truncateFn || !formatOriginalFn) {
    // Signal extraction failure clearly — treat as a failed test so CI notices.
    eq('sidebar-extract: able to extract truncateDecimals + formatOriginal from sidebar.js',
       false, true);
    return;
  }

  // Eval into a local object using an IIFE so the const declarations bind in
  // function scope (not global) and the new Function body can hold them.
  // toNumber is passed in from the already-evaled content-script scope.
  // Note: string concatenation is used (not a template literal) to avoid any
  // back-tick/interpolation issues with the extracted source text.
  const helperSrc = '(function() {\n' +
    constBlock[0] + '\n' +
    fmtCommasFn[0] + '\n' +
    truncateFn[0] + '\n' +
    formatOriginalFn[0] + '\n' +
    'return { formatNumberWithCommas: formatNumberWithCommas, truncateDecimals: truncateDecimals, formatOriginal: formatOriginal };\n' +
    '})()';
  const helpers = (new Function(
    'toNumber',
    'return ' + helperSrc + ';'
  ))(toNumber);

  const trunc = helpers.truncateDecimals;
  const fmtOrig = helpers.formatOriginal;

  // Verify we got real functions, not undefined.
  eq('sidebar-extract: truncateDecimals is a function',
     typeof trunc, 'function');
  eq('sidebar-extract: formatOriginal is a function',
     typeof fmtOrig, 'function');

  // -----------------------------------------------------------------
  // Acceptance criterion 1: original numbers display with thousands commas.
  // formatOriginal converts numeric strings to comma-formatted numbers.
  // -----------------------------------------------------------------
  eq('AC1: formatOriginal integer string gets commas (273233 -> "273,233")',
     fmtOrig('273233'), '273,233');
  eq('AC1: formatOriginal large integer number gets commas',
     fmtOrig(1000000), '1,000,000');
  eq('AC1: formatOriginal already-comma string parses and re-formats ("273,233")',
     fmtOrig('273,233'), '273,233');
  eq('AC1: formatOriginal negative large integer gets commas',
     fmtOrig(-1234567), '-1,234,567');

  // -----------------------------------------------------------------
  // Acceptance criterion 2: rounded numbers magnitude >= 100 → NO decimals.
  // truncateDecimals should strip all decimals for |n| >= 100.
  // -----------------------------------------------------------------
  eq('AC2: truncateDecimals(1234.56) -> 1234 (magnitude >= 100, no decimals)',
     trunc(1234.56), 1234);
  eq('AC2: truncateDecimals(100.9999) -> 100 (exactly at threshold, no decimals)',
     trunc(100.9999), 100);
  eq('AC2: truncateDecimals(-1234.56) -> -1234 (negative, magnitude >= 100)',
     trunc(-1234.56), -1234);
  eq('AC2: truncateDecimals(-100.9) -> -100 (negative at threshold)',
     trunc(-100.9), -100);
  eq('AC2: formatOriginal("1234.56") -> "1,234" (magnitude >= 100, commas, no decimals)',
     fmtOrig('1234.56'), '1,234');
  eq('AC2: formatOriginal(100) -> "100" (exactly at boundary, no decimals)',
     fmtOrig(100), '100');

  // -----------------------------------------------------------------
  // Acceptance criterion 3: magnitude < 100 → at most 4 decimals, TRUNCATED.
  // This is the adversarial core: must be truncation, NOT rounding.
  // -----------------------------------------------------------------

  // Key adversarial case: 1.99999 must NOT round up to 2.
  eq('AC3-adversarial: truncateDecimals(1.99999) -> 1.9999 (truncated, not rounded to 2)',
     trunc(1.99999), 1.9999);
  eq('AC3-adversarial: truncateDecimals(1.7999999999) -> 1.7999 (truncated at 4 decimals)',
     trunc(1.7999999999), 1.7999);
  eq('AC3-adversarial: truncateDecimals(1.00005) -> 1 (truncates, not rounds to 1.0001)',
     trunc(1.00005), 1);

  // Boundary: 99.99999 must NOT round to 100, and must stay < threshold, giving 4 dec.
  eq('AC3-boundary-99.99999: truncateDecimals(99.99999) -> 99.9999 (below threshold, truncated)',
     trunc(99.99999), 99.9999);
  eq('AC3-boundary-99.99999: formatOriginal("99.99999") -> "99.9999" (not rounded to 100)',
     fmtOrig('99.99999'), '99.9999');

  // Boundary: exactly 100 — at threshold, no decimals.
  eq('AC3-boundary-100: truncateDecimals(100) -> 100 (integer, no change)',
     trunc(100), 100);
  eq('AC3-boundary-100: truncateDecimals(100.0001) -> 100 (at/above threshold, trunc)',
     trunc(100.0001), 100);

  // Negatives below threshold: trunc toward zero (not floor).
  eq('AC3-negative: truncateDecimals(-1.7999) -> -1.7999 (toward zero, not -1.8)',
     trunc(-1.7999), -1.7999);
  eq('AC3-negative: truncateDecimals(-1.99999) -> -1.9999 (truncated, not -2)',
     trunc(-1.99999), -1.9999);
  eq('AC3-negative: truncateDecimals(-99.99999) -> -99.9999 (negative, below threshold)',
     trunc(-99.99999), -99.9999);
  eq('AC3-negative: formatOriginal("-99.99999") -> "-99.9999" (negative, truncated, not -100)',
     fmtOrig('-99.99999'), '-99.9999');
  eq('AC3-negative: formatOriginal("-1.7999") -> "-1.7999" (toward zero)',
     fmtOrig('-1.7999'), '-1.7999');

  // Negative boundary: -100 at threshold → no decimals.
  eq('AC3-negative-100: truncateDecimals(-100) -> -100',
     trunc(-100), -100);
  eq('AC3-negative-100: formatOriginal("-100") -> "-100"',
     fmtOrig('-100'), '-100');
  eq('AC3-negative-100: truncateDecimals(-100.5) -> -100 (magnitude >= 100, no decimals)',
     trunc(-100.5), -100);

  // Numbers with fewer than 4 decimals are preserved as-is (no padding).
  eq('AC3-fewer-decimals: truncateDecimals(1.5) -> 1.5',
     trunc(1.5), 1.5);
  eq('AC3-fewer-decimals: truncateDecimals(0.1234) -> 0.1234',
     trunc(0.1234), 0.1234);
  eq('AC3-fewer-decimals: formatOriginal("1.5") -> "1.5"',
     fmtOrig('1.5'), '1.5');

  // -----------------------------------------------------------------
  // Comma parsing of original: string with commas should parse and reformat.
  // -----------------------------------------------------------------
  eq('comma-parse: formatOriginal("273,233") -> "273,233" (toNumber strips commas)',
     fmtOrig('273,233'), '273,233');
  eq('comma-parse: formatOriginal("1,234.5678999") -> "1,234" (magnitude >= 100, trunc)',
     fmtOrig('1,234.5678999'), '1,234');
  eq('comma-parse: formatOriginal("99,999") -> "99,999" (magnitude >= 100, no decimals)',
     fmtOrig('99,999'), '99,999');

  // -----------------------------------------------------------------
  // NaN / unparseable fallback: should return the raw string, not "NaN".
  // -----------------------------------------------------------------
  eq('NaN-fallback: formatOriginal("abc") -> "abc" (raw string passthrough)',
     fmtOrig('abc'), 'abc');
  eq('NaN-fallback: formatOriginal("") -> "" (empty string passthrough)',
     fmtOrig(''), '');
  eq('NaN-fallback: formatOriginal(null) -> "null" (null stringified)',
     fmtOrig(null), 'null');
  eq('NaN-fallback: formatOriginal("12abc") -> "12abc" (non-numeric string raw)',
     fmtOrig('12abc'), '12abc');

  // -----------------------------------------------------------------
  // Edge cases: zero, very small numbers, integers.
  // -----------------------------------------------------------------
  eq('edge: truncateDecimals(0) -> 0',
     trunc(0), 0);
  eq('edge: formatOriginal("0") -> "0"',
     fmtOrig('0'), '0');
  eq('edge: formatOriginal(0.00001) -> "0" (truncated to 4 places, last digit gone)',
     fmtOrig(0.00001), '0');
  eq('edge: formatOriginal(0.00009999) -> "0" (below 4th decimal place)',
     fmtOrig(0.00009999), '0');
  eq('edge: formatOriginal(0.1234) -> "0.1234" (exactly 4 decimals)',
     fmtOrig(0.1234), '0.1234');
  eq('edge: formatOriginal(0.12345) -> "0.1234" (5th decimal truncated)',
     fmtOrig(0.12345), '0.1234');

  // -----------------------------------------------------------------
  // REGRESSION GUARD: formatOriginal must TRUNCATE, never ROUND.
  // These assertions pin the production function against the bug where
  // toFixed() was used (which rounds), causing e.g. 1.7999999999 -> '1.8'.
  // All cases below would fail under a rounding implementation.
  // -----------------------------------------------------------------

  // Spec AC3 canonical example: deep-9s value, must truncate not round.
  eq('regression-trunc: formatOriginal(1.7999999999) -> "1.7999" (not "1.8")',
     fmtOrig(1.7999999999), '1.7999');

  // Near-integer truncation: 1.999999999 must NOT round up to 2.
  eq('regression-trunc: formatOriginal(1.999999999) -> "1.9999" (not "2", not "1")',
     fmtOrig(1.999999999), '1.9999');

  // 5th decimal truncated, not rounded: 5.12349999999 must NOT become '5.1235'.
  eq('regression-trunc: formatOriginal(5.12349999999) -> "5.1234" (not "5.1235")',
     fmtOrig(5.12349999999), '5.1234');

  // Just below threshold: numeric (not string) 99.99999 must NOT round to 100.
  eq('regression-trunc: formatOriginal(99.99999) -> "99.9999" (not "100")',
     fmtOrig(99.99999), '99.9999');

  // Negative near-integer: -1.999999999 must NOT round to -2.
  eq('regression-trunc: formatOriginal(-1.999999999) -> "-1.9999" (not "-2")',
     fmtOrig(-1.999999999), '-1.9999');

  // Negative just below threshold: numeric -99.99999 must NOT round to -100.
  eq('regression-trunc: formatOriginal(-99.99999) -> "-99.9999" (not "-100")',
     fmtOrig(-99.99999), '-99.9999');

  // Magnitude >= 100 with numeric (not string) input: 1234.56 -> "1,234".
  eq('regression-trunc: formatOriginal(1234.56) -> "1,234" (numeric input, commas, no decimals)',
     fmtOrig(1234.56), '1,234');

  // Numeric 1.5 (not string): trailing zeros stripped, no padding.
  eq('regression-trunc: formatOriginal(1.5) -> "1.5" (numeric, no padding)',
     fmtOrig(1.5), '1.5');

  // Integer 2: no decimals, no commas.
  eq('regression-trunc: formatOriginal(2) -> "2" (integer, no decimals)',
     fmtOrig(2), '2');

  // Negative tiny value: -0.00001 truncates to 0, must NOT produce "-0".
  eq('regression-trunc: formatOriginal(-0.00001) -> "0" (no negative zero)',
     fmtOrig(-0.00001), '0');

  // Adversarial fp-noise: 49.99995 must NOT round to '50'.
  eq('regression-trunc: formatOriginal(49.99995) -> "49.9999" (fp-noise, not "50")',
     fmtOrig(49.99995), '49.9999');
})();

// ---------------------------------------------------------------------------
// Sprint sidebar-no-table-state
// Tests for the "no table bound" state in sidebar.js.
//
// sidebar.js cannot be eval'd wholesale without a full browser DOM, but we
// can:
//   (a) eval just the setTableBound function with minimal stubs, and
//   (b) read sidebar.js / sidebar.html source for static assertions.
//
// AC1 – init state: body gets no-table class, #status reads the prompt message.
// AC2 – bound state: setTableBound(true) removes no-table; also check that
//        state:previewSamplesChanged triggers the settings pull whose chain ends
//        in fetchPreviewSamples (the only live-rebind path) — note this means
//        the sidebar does NOT listen for a separate SET_TABLE_BOUND message;
//        see gap note below.
// AC3 – old error string is gone from sidebar.js.
// AC4 – sidebar.html CSS disables optionsSection/advancedSection when no-table.
// ---------------------------------------------------------------------------

(function sprintSidebarNoTableState() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // -------------------------------------------------------------------------
  // Static source checks (can always be verified without eval)
  // -------------------------------------------------------------------------

  // AC3: old error string must be gone.
  eq('no-table AC3: old error string absent from sidebar.js',
    sidebarSrc.includes('Right-click a table first, then reopen the sidebar.'), false);

  // AC1 (static): NO_TABLE_CLASS and NO_TABLE_STATUS_MSG are defined.
  eq('no-table AC1: NO_TABLE_CLASS constant defined in sidebar.js',
    /const NO_TABLE_CLASS\s*=\s*['"]no-table['"]/.test(sidebarSrc), true);

  eq('no-table AC1: NO_TABLE_STATUS_MSG constant defined in sidebar.js',
    /const NO_TABLE_STATUS_MSG\s*=\s*['"]Right-click a table to connect it here\.['"]/.test(sidebarSrc), true);

  // AC1 (static): setTableBound(false) is called on init.
  eq('no-table AC1: setTableBound(false) called at module level (init)',
    /setTableBound\(false\)/.test(sidebarSrc), true);

  // AC2 (static): setTableBound(true) path exists (answer.samples !== null branch).
  eq('no-table AC2: setTableBound called with answer.samples !== null',
    /setTableBound\(answer\.samples\s*!==\s*null\)/.test(sidebarSrc), true);

  // AC2 gap check: the sidebar handles state:previewSamplesChanged by calling
  // pullSettingsAndApplyToUI() (issue #251: every refresh re-reads the
  // model's settings first; its chain ends in fetchPreviewSamples, which
  // calls setTableBound inside its callback). There is NO direct
  // setTableBound call in the state:previewSamplesChanged handler, and no
  // separate runtime message that calls setTableBound(true) synchronously.
  // The sidebar has no push-style binding message. We assert the handler
  // exists and starts the pull chain, then flag the architectural gap as a
  // note.
  eq('no-table AC2: state:previewSamplesChanged handler calls pullSettingsAndApplyToUI',
    /state:previewSamplesChanged[\s\S]{0,300}pullSettingsAndApplyToUI\(\)/.test(sidebarSrc), true);

  // GAP NOTE: The sidebar does not handle a dedicated "TABLE_BOUND" push message.
  // If content.js ever fails to send state:previewSamplesChanged after a new right-click
  // (e.g. in error paths), the sidebar state will not update. There is no direct
  // setTableBound(true) call reachable from state:previewSamplesChanged — the binding
  // happens inside the fetchPreviewSamples callback only when the tab responds.
  // This gap is architectural and cannot be covered by a unit test without a
  // full browser environment; flagged here for reviewer awareness.

  // AC4 (static): the no-table state must NOT dim/disable the sidebar sections.
  // Behaviour changed — instead of greying the whole sidebar, the main toggle is
  // flipped off (covered by the behavioural tests below). Guard against the old
  // dimming rules being reintroduced.
  eq('no-table AC4: sidebar.html does NOT dim #optionsSection under body.no-table',
    /body\.no-table\s+#optionsSection/.test(sidebarHtml), false);

  eq('no-table AC4: sidebar.html does NOT dim #advancedSection under body.no-table',
    /body\.no-table\s+#advancedSection/.test(sidebarHtml), false);

  eq('no-table AC4: sidebar.html does NOT disable the title-row pill under body.no-table',
    /body\.no-table\s+\.title-row\s+\.switch/.test(sidebarHtml), false);

  // AC1 (static): sidebar.html default #status text is the no-table message.
  eq('no-table AC1: sidebar.html default #status text is the no-table message',
    /id="status"[^>]*>Right-click a table to connect it here\./.test(sidebarHtml), true);

  // -------------------------------------------------------------------------
  // Behavioral unit tests via eval of setTableBound with minimal DOM stubs.
  // We extract just the two constants and the function body from sidebar.js
  // source, then eval them with a fake document.body.classList and statusEl.
  // -------------------------------------------------------------------------
  (function setTableBoundBehavioural() {
    // Minimal classList stub.
    function makeClassList() {
      const classes = new Set();
      return {
        toggle(cls, force) {
          if (force === undefined) {
            if (classes.has(cls)) classes.delete(cls); else classes.add(cls);
          } else if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
        },
        has(cls) { return classes.has(cls); },
        add(cls) { classes.add(cls); },
        remove(cls) { classes.delete(cls); },
      };
    }

    // Build stub environment for each sub-test.
    function makeEnv(initialStatus, initialChecked) {
      const classList = makeClassList();
      const statusEl = { textContent: initialStatus !== undefined ? initialStatus : '', dataset: {} };
      const enabledEl = { checked: initialChecked !== undefined ? initialChecked : true, disabled: false };
      const fakeDoc = { body: { classList } };
      const DR_DEFAULTS = { enabled: true };
      let updateDisabledCalls = 0;
      function updateDisabledState() { updateDisabledCalls++; }

      // Extract constants + function from sidebar source, then eval in closure.
      // We pull the relevant declarations and avoid running the rest of
      // sidebar.js (which needs getElementById, chrome.tabs, etc.).
      // Keep this copy in step with the real setTableBound in sidebar.js.
      const snippet = `
        const NO_TABLE_CLASS = 'no-table';
        const NO_TABLE_STATUS_MSG = 'Right-click a table to connect it here.';
        function setTableBound(isBound) {
          document.body.classList.toggle(NO_TABLE_CLASS, !isBound);
          if (!isBound) {
            document.body.classList.remove('table-locked');
            enabledEl.disabled = false;
            delete statusEl.dataset.source;
            enabledEl.checked = false;
            statusEl.textContent = NO_TABLE_STATUS_MSG;
          } else {
            if (statusEl.textContent === NO_TABLE_STATUS_MSG) {
              statusEl.textContent = '';
            }
          }
          updateDisabledState();
        }
      `;
      // Use a function wrapper so the closure vars resolve from the params.
      const fn = new Function(
        'document', 'statusEl', 'enabledEl', 'DR_DEFAULTS', 'updateDisabledState',
        snippet + '\nreturn setTableBound;');
      const setTableBound = fn(fakeDoc, statusEl, enabledEl, DR_DEFAULTS, updateDisabledState);
      return {
        classList, statusEl, enabledEl, setTableBound,
        getUpdateDisabledCalls: () => updateDisabledCalls,
      };
    }

    // AC1a: setTableBound(false) → body gets 'no-table' class.
    {
      const { classList, setTableBound } = makeEnv();
      setTableBound(false);
      eq('no-table AC1b: setTableBound(false) adds no-table class to body',
        classList.has('no-table'), true);
    }

    // AC1b: setTableBound(false) → #status text = NO_TABLE_STATUS_MSG.
    {
      const { statusEl, setTableBound } = makeEnv();
      setTableBound(false);
      eq('no-table AC1c: setTableBound(false) sets status to no-table message',
        statusEl.textContent, 'Right-click a table to connect it here.');
    }

    // AC2a: setTableBound(true) → 'no-table' class removed.
    {
      const { classList, setTableBound } = makeEnv();
      setTableBound(false); // init
      setTableBound(true);
      eq('no-table AC2a: setTableBound(true) removes no-table class',
        classList.has('no-table'), false);
    }

    // AC2b: setTableBound(true) when status was the no-table message → status cleared.
    {
      const { statusEl, setTableBound } = makeEnv('Right-click a table to connect it here.');
      setTableBound(true);
      eq('no-table AC2b: setTableBound(true) clears status when it held no-table message',
        statusEl.textContent, '');
    }

    // AC2c: setTableBound(true) when status holds a DIFFERENT message → status preserved.
    // (E.g. a state:rangeError message should not be wiped by a table bind event.)
    {
      const { statusEl, setTableBound } = makeEnv('Invalid range expression.');
      setTableBound(true);
      eq('no-table AC2c: setTableBound(true) does not overwrite an unrelated status message',
        statusEl.textContent, 'Invalid range expression.');
    }

    // AC2 gap — live rebind: calling setTableBound(false) then setTableBound(true)
    // in sequence correctly toggles state (simulates the state:previewSamplesChanged
    // round-trip where fetchPreviewSamples resolves with non-null samples).
    {
      const { classList, statusEl, setTableBound } = makeEnv();
      setTableBound(false); // init (no table)
      setTableBound(true);  // user right-clicked a table; fetchPreviewSamples resolved
      eq('no-table AC2-live: body loses no-table after live rebind',
        classList.has('no-table'), false);
      eq('no-table AC2-live: status cleared after live rebind',
        statusEl.textContent, '');
    }

    // AC2 gap — the REVERSE: bound → unbound (table navigated away).
    {
      const { classList, statusEl, setTableBound } = makeEnv();
      setTableBound(true);  // table was bound
      setTableBound(false); // table gone (runtime error or null samples)
      eq('no-table AC2-reverse: body gets no-table when table removed',
        classList.has('no-table'), true);
      eq('no-table AC2-reverse: status message restored when table removed',
        statusEl.textContent, 'Right-click a table to connect it here.');
    }

    // Toggle-off behaviour: setTableBound(false) flips the main pill to off
    // (rather than dimming the sidebar) and runs updateDisabledState.
    {
      const { enabledEl, setTableBound, getUpdateDisabledCalls } = makeEnv(undefined, true);
      setTableBound(false);
      eq('no-table toggle: setTableBound(false) turns the main pill off',
        enabledEl.checked, false);
      eq('no-table toggle: setTableBound(false) calls updateDisabledState',
        getUpdateDisabledCalls() >= 1, true);
    }

    // Bind leaves the pill alone (issue #251): the settings apply that runs
    // before the bind resolves — applySettingsToUI on a pull, or
    // applyDefaultsToUI on the pull's fallback — is the pill's only writer
    // for the bound state. A bind that reset the pill to the shipped default
    // is what desynced the panel from the model.
    {
      const { enabledEl, setTableBound } = makeEnv(undefined, true);
      setTableBound(false);      // init: no table yet → pill off
      enabledEl.checked = false; // the model pull applied enabled:false
      setTableBound(true);       // table resolved → bind must not touch it
      eq('no-table toggle: setTableBound(true) leaves the pill to the pulled value on bind',
        enabledEl.checked, false);
    }

    // Static guard: the real setTableBound flips enabledEl.checked off and runs
    // updateDisabledState (not just a class toggle). Isolate the function's own
    // body (rather than scanning from the first "setTableBound" text match
    // anywhere in the file) so a coincidental match elsewhere — e.g. an
    // unrelated setTableBound(...) call sitting near an unrelated
    // updateDisabledState() call in some other function — cannot pass this
    // for the wrong reason.
    const setTableBoundFnMatch = sidebarSrc.match(/function setTableBound\([\s\S]*?\n}/);
    const setTableBoundFnBody = setTableBoundFnMatch ? setTableBoundFnMatch[0] : '';
    eq('no-table toggle: sidebar.js setTableBound function body was isolated (sanity check on the scan itself)',
      setTableBoundFnBody.length > 0, true);
    eq('no-table toggle: sidebar.js setTableBound sets enabledEl.checked = false when unbound',
      /enabledEl\.checked\s*=\s*false/.test(setTableBoundFnBody), true);
    eq('no-table toggle: sidebar.js setTableBound calls updateDisabledState',
      /updateDisabledState\(\)/.test(setTableBoundFnBody), true);
    // Issue #251: the bound branch must not reset the pill to the shipped
    // default — the model (or the pull's explicit defaults fallback) is the
    // pill's only source once a table is bound.
    eq('no-table toggle: sidebar.js setTableBound no longer references DR_DEFAULTS anywhere (issue #251)',
      /DR_DEFAULTS/.test(setTableBoundFnBody), false);

    // AC2 gap — ADVERSARIAL: verify that the sidebar does NOT have a runtime
    // message handler that directly calls setTableBound(true) when a table is
    // right-clicked. The only live-rebind path is state:previewSamplesChanged →
    // fetchPreviewSamples → callback. This means if content.js sends no message,
    // the sidebar stays stale. We document this by asserting that no
    // "contextMenus" or "TABLE_BOUND" message handler exists in sidebar.js.
    eq('no-table AC2-gap: sidebar.js has no direct TABLE_BOUND message handler',
      /action\s*===\s*['"]TABLE_BOUND['"]/.test(sidebarSrc), false);
    // (Gap: the sidebar depends entirely on state:previewSamplesChanged being sent
    // by content.js after every right-click. If content.js omits that message
    // in any code path, the no-table class will not be removed. This cannot be
    // unit-tested in Node without a full browser environment.)
  })();
})();

// ---------------------------------------------------------------------------
// Sprint dots-tick-alignment: pct() mapping and CSS vertical alignment
// ---------------------------------------------------------------------------

(function sprintDotsTickAlignment() {
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // --- Extract pct() from sidebar.js and instantiate it for runtime testing ---
  // We locate the function body with a regex (same pattern used elsewhere for
  // source-level extraction) and wrap it in a new Function so we can call it.
  const pctMatch = sidebarJsSrc.match(/function pct\(v\)\s*\{([\s\S]*?)\n\}/);
  if (!pctMatch) {
    failed++;
    failures.push({ name: 'dots-tick: pct() function found in sidebar.js', actual: false, expected: true });
  } else {
    passed++;
    // The 9 stops in strategy-monotonic order (k=0..8), mirroring STOPS:
    const stops = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
    const N = stops.length;
    // pct() now closes over STOPS and snap(); supply both so the extracted body
    // runs standalone. snap() is the nearest-stop fallback for non-stop inputs.
    const snap = (v) => stops.reduce((b, s) => Math.abs(s - v) < Math.abs(b - v) ? s : b, stops[0]);
    const pctRaw = new Function('STOPS', 'snap', 'v', pctMatch[1]);
    const pct = (v) => pctRaw(stops, snap, v);
    const TOL = 1e-6;

    // AC1a: Each stop maps to the centre of its grid cell in an N-equal-column grid.
    // Cell k centre = (k + 0.5) / N * 100.
    stops.forEach((v, k) => {
      const expected = (k + 0.5) / N * 100;
      const actual = pct(v);
      const ok = Math.abs(actual - expected) < TOL;
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push({
          name: `dots-tick: pct(${v}) === cell-${k}-centre (${expected.toFixed(6)}%)`,
          actual: actual,
          expected: expected,
        });
      }
    });

    // AC1b: Key exact values — extremes and the zero stop (index 5 of 9).
    const pctNeg2 = pct(-2);
    const pctZero = pct(0);
    const pctPos1 = pct(1);

    eq('dots-tick: pct(-2) ≈ 5.5556% (1st cell centre)',
      Math.abs(pctNeg2 - 0.5 / N * 100) < TOL, true);
    eq('dots-tick: pct(0) ≈ 61.1111% (6th cell centre, asymmetric range)',
      Math.abs(pctZero - 5.5 / N * 100) < TOL, true);
    eq('dots-tick: pct(1) ≈ 94.4444% (9th cell centre)',
      Math.abs(pctPos1 - 8.5 / N * 100) < TOL, true);

    // AC1c: the extremes are inset by half a cell, never flush at 0/100.
    // A value-proportional formula would push an end stop to 0 or 100; the
    // index-based formula keeps both ends a half-cell in.
    eq('dots-tick: pct(-2) is NOT 0 (end stop is inset by half a cell)',
      pct(-2) !== 0, true);
    eq('dots-tick: pct(1) is NOT 100 (end stop is inset by half a cell)',
      pct(1) !== 100, true);

    // AC2: Monotonic — pct is strictly increasing across all 9 stops.
    let monotonic = true;
    for (let i = 1; i < stops.length; i++) {
      if (pct(stops[i]) <= pct(stops[i - 1])) { monotonic = false; break; }
    }
    eq('dots-tick: pct() is strictly increasing across all 9 stops', monotonic, true);

    // AC3: Equal columns — adjacent stops are exactly one cell (100/N %) apart,
    // regardless of the uneven numeric spacing of the stop values.
    let equalCols = true;
    const cell = 100 / N;
    for (let i = 1; i < stops.length; i++) {
      if (Math.abs((pct(stops[i]) - pct(stops[i - 1])) - cell) > TOL) { equalCols = false; break; }
    }
    eq('dots-tick: adjacent stops are one equal column (100/N %) apart', equalCols, true);
  }

  // --- AC4: 9-column grid assumption — verify tick markup matches formula ---
  // The pct formula assumes N equal columns. Adversarial check: count the actual
  // tick spans and verify the CSS declares exactly repeat(9, 1fr).
  const tickSpans = (sidebarHtmlSrc.match(/class="t"/g) || []).length;
  eq('dots-tick: .dual-ticks contains exactly 9 tick spans (matches pct() formula)',
    tickSpans, 9);

  eq('dots-tick: .dual-ticks CSS uses repeat(9, 1fr) grid',
    /\.dual-ticks\s*\{[^}]*grid-template-columns\s*:\s*repeat\(9,\s*1fr\)/.test(sidebarHtmlSrc), true);

  // --- AC5: Vertical CSS — .dual-ticks uses top: 20px (not 22px) ---
  eq('dots-tick: .dual-ticks CSS top is 20px',
    /\.dual-ticks\s*\{[^}]*top:\s*20px/.test(sidebarHtmlSrc), true);

  eq('dots-tick: .dual-ticks CSS top is NOT 22px (old value)',
    /\.dual-ticks\s*\{[^}]*top:\s*22px/.test(sidebarHtmlSrc), false);

  // --- AC6: pct() is only used for thumb positioning (not for fill/label/other) ---
  // Adversarial: if pct() were wired to a range-fill width or label position, the
  // non-0/100 extremes would produce a visually broken fill. Verify here that all
  // pct() call sites in sidebar.js are limited to style.left on thumbs.
  // Use a negative lookbehind to exclude the function definition itself.
  const pctCallSites = sidebarJsSrc.match(/(?<!function )pct\([^)]+\)/g) || [];
  // Every call site should appear only inside thumb left-position assignments.
  // We check there are exactly 2 call sites (topThumb and botThumb style.left).
  eq('dots-tick: pct() is called exactly twice in sidebar.js (both thumb style.left)',
    pctCallSites.length, 2);

  // Both call sites must be inside a style.left assignment.
  const thumbLeftPattern = /\.style\.left\s*=\s*pct\(/g;
  const thumbLeftMatches = (sidebarJsSrc.match(thumbLeftPattern) || []).length;
  eq('dots-tick: both pct() calls are style.left assignments (not fill/label)',
    thumbLeftMatches, 2);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings (issue #240): the depth guard itself. The cycle
// above is self-limiting (a caller-side counter stops it after one bounce);
// this one is NOT — neither handler has a stop condition, so without the
// bus's own guard this would recurse until the real call stack overflows.
// ---------------------------------------------------------------------------
(function appModelSettings_busReentrancy_unguardedCycleTerminatesSafely() {
  const TOPIC_A = 'state:selectedTableChanged';
  const TOPIC_B = 'state:settingsChanged';
  const savedSelected = DR_STORE.getSelectedTable();
  DR_STORE.setSelectedTable(null); // see the note on the guarded cycle above

  const unsubA = DR_BUS.subscribe(TOPIC_A, () => { DR_BUS.publish(TOPIC_B, { settings: DR_STORE.getSettings() }); });
  const unsubB = DR_BUS.subscribe(TOPIC_B, () => { DR_BUS.publish(TOPIC_A, { table: null }); });

  let threw = null;
  try {
    DR_BUS.publish(TOPIC_A, { table: null });
  } catch (e) {
    threw = e.message;
  } finally {
    unsubA();
    unsubB();
    DR_STORE.setSelectedTable(savedSelected);
  }

  eq('DR_BUS reentrancy (unguarded cycle): publish() throws a catchable error instead of crashing with a real stack overflow',
    typeof threw, 'string');
  eq('DR_BUS reentrancy (unguarded cycle): the thrown error names the depth guard, not a raw engine stack-overflow error',
    /publish depth exceeded/.test(threw || ''), true);

  // The guard must reset cleanly — every nested publish() decrements the
  // depth counter in a finally as the exception unwinds — so an unrelated
  // publish afterward must behave normally, not still read as "deep".
  let secondThrew = null;
  const unsubCheck = DR_BUS.subscribe(TOPIC_A, () => {});
  try {
    DR_BUS.publish(TOPIC_A, { table: null });
  } catch (e) {
    secondThrew = e.message;
  } finally {
    unsubCheck();
  }
  eq('DR_BUS reentrancy (unguarded cycle): the depth counter recovers — a later unrelated publish does not throw',
    secondThrew, null);
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, adversarial: wire-payload parity with the parent
// branch's sendToActiveTab (refactor/app-model-selection, before this sprint
// inverted the transport). The message body itself is unchanged — {action,
// settings}, same field names, same nesting, no extra bus-envelope fields —
// but sendToActiveTab always passed chrome.tabs.sendMessage a THIRD argument,
// a response callback, and used it to react to delivery: clear statusEl on
// success, setTableBound(false) on chrome.runtime.lastError (no content
// script on the tab). adapters/messaging.js's publish() relay calls
// chrome.tabs.sendMessage with only two arguments — no callback — so that
// reaction is silently gone for the settings-apply path: a real Chrome would
// also log an "Unchecked runtime.lastError" warning on every failed delivery.
// This isolates DR_BUS in its own vm sandbox (messaging.js has no DOM
// dependency) and pins the call shape directly, independent of sidebar.js's
// heavier DOM requirements.
// ---------------------------------------------------------------------------
(function appModelSettings_wirePayload_parityWithParentSendToActiveTab() {
  if (messagingCode === null) {
    eq('wire payload: adapters/messaging.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const sentCalls = [];
  const sandbox = {
    chrome: {
      tabs: {
        query(q, cb) { cb([{ id: 7 }]); },
        sendMessage(...args) { sentCalls.push(args); },
      },
      runtime: {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\nthis.__DR_BUS = DR_BUS;', sandbox);

  // The settings apply is a request (#325), so the ask is what puts it on the
  // wire. Both verbs build the same envelope through the same tab carrier, so
  // this still pins the shape the old sendToActiveTab sent.
  sandbox.__DR_BUS.request('request:applySettings',
    { settings: { offsetTop: -2, rangeExpr: 'A1:B2' } }, () => {});

  eq('wire payload: exactly one chrome.tabs.sendMessage call for one ask',
    sentCalls.length, 1);
  if (sentCalls.length !== 1) return;

  const [tabId, msg, callback] = sentCalls[0];
  // Issue #325 put the topic name itself on the wire, in the same action field
  // the transport already used. The name changed; the field and the envelope
  // shape did not.
  eq('wire payload: message action is the topic name',
    msg.action, 'request:applySettings');
  eq('wire payload: message field names are exactly {action, settings} — no extra bus-envelope fields',
    Object.keys(msg).sort(), ['action', 'settings'].sort());
  eq('wire payload: settings payload is nested exactly as sendToActiveTab sent it, unchanged',
    JSON.stringify(msg.settings), JSON.stringify({ offsetTop: -2, rangeExpr: 'A1:B2' }));

  // ADVERSARIAL regression pin (see PR notes): the parent's sendToActiveTab
  // always passed a response callback (chrome.tabs.sendMessage's 3rd
  // argument) and used it to reflect delivery failure back into the UI
  // (setTableBound(false) on chrome.runtime.lastError) and to clear statusEl
  // on success. This only pins the MECHANISM — that publish() still passes a
  // callback — not the behavior; see appModelSettings_settingsPublish_
  // deliveryFeedback_behavioral below for the behavioral coverage.
  eq('wire payload: the ask passes a response callback to chrome.tabs.sendMessage, matching sendToActiveTab\'s delivery-failure handling (regression — see PR notes)',
    typeof callback, 'function');
})();

// ---------------------------------------------------------------------------
// Sprint app-model-settings, adversarial fix (behavioral): the pin above only
// proves publish() PASSES a callback to chrome.tabs.sendMessage — it says
// nothing about what that callback does. This drives sidebar.js's real
// applyNow() -> DR_BUS.publish() path end to end and checks the two
// behaviors refactor/app-model-selection's sendToActiveTab had: a failed
// delivery (chrome.runtime.lastError) must unbind the sidebar via
// setTableBound(false); a successful delivery must clear #status.
// ---------------------------------------------------------------------------
(function appModelSettings_settingsPublish_deliveryFeedback_behavioral() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('settings publish delivery: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }

  // Minimal element stub — same shape as the other sidebar.js eval harnesses
  // in this file (see tableContextmenuActivation_sidebarFlash above).
  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
    };
  }

  // #status and #enabled are the two elements setTableBound touches; capture
  // the exact objects sidebar.js's document.getElementById() hands back so we
  // can read their mutations directly, with no need to export any function.
  const statusEl = makeEl();
  const enabledEl = makeEl();
  enabledEl.checked = true;
  let enabledChangeHandler = null;
  enabledEl.addEventListener = function (type, fn) { if (type === 'change') enabledChangeHandler = fn; };

  const bodyClasses = new Set();
  const captureBody = {
    classList: {
      add(cls) { bodyClasses.add(cls); },
      remove(cls) { bodyClasses.delete(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    addEventListener() {},
    get offsetWidth() { return 0; },
  };

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  // chrome.tabs.query/sendMessage resolve synchronously so the whole chain —
  // sidebar.js's applyNow() -> DR_BUS.request() -> chrome.tabs.sendMessage's
  // own callback -> the sidebar's answer callback — runs deterministically
  // within one call, with queuedLastError picking whether the stub answers
  // with a value or with nothing (matching real sendMessage semantics).
  const sentTabMessages = [];
  let queuedLastError = null;
  const captureChrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      get lastError() { return queuedLastError; },
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      // Chrome hands the callback the responder's value on success, and
      // nothing (with lastError set) when nobody answered. queuedLastError
      // picks which, so one stub covers both directions.
      sendMessage(tabId, msg, cb) {
        sentTabMessages.push(msg);
        if (typeof cb === 'function') cb(queuedLastError ? undefined : { ok: true });
      },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  // sidebar.js's top-level code — including its own change/click listener
  // registrations — resolves `document`/`chrome`/`window` dynamically off
  // the global object every time it runs, not just at eval time. The
  // captured enabledChangeHandler is called below, well after the initial
  // eval, so the stubs must stay installed for that call too — restore the
  // real globals only once every scenario below has run.
  try {
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        coreSrc + '\n' +
        messagingCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // sidebar.js's module-level settings/preview pull can throw past this
      // point in this stub environment (chrome.tabs.sendMessage's callback
      // gets no real response) — the 'change' listener registers before that
      // runs, so we only need it captured.
    }

    eq('settings publish delivery: sidebar\'s enabled-checkbox change handler was captured',
      typeof enabledChangeHandler, 'function');
    if (typeof enabledChangeHandler !== 'function') return;

    // --- Failure: chrome.runtime.lastError set -> setTableBound(false) ran. ---
    bodyClasses.delete('no-table');
    enabledEl.checked = true;
    statusEl.textContent = '';
    queuedLastError = { message: 'Could not establish connection.' };
    sentTabMessages.length = 0;
    enabledChangeHandler();

    eq('settings publish delivery: one request:applySettings message sent for the change',
      sentTabMessages.length, 1);
    eq('settings publish delivery: failed delivery adds the no-table class (setTableBound(false) ran)',
      bodyClasses.has('no-table'), true);
    eq('settings publish delivery: failed delivery flips the enabled checkbox off (setTableBound(false) ran)',
      enabledEl.checked, false);
    eq('settings publish delivery: failed delivery sets #status to the no-table message (setTableBound(false) ran)',
      statusEl.textContent, 'Right-click a table to connect it here.');

    // --- Success: no lastError -> #status is cleared. ---
    bodyClasses.delete('no-table');
    statusEl.textContent = 'a stale status message';
    queuedLastError = null;
    enabledChangeHandler();

    eq('settings publish delivery: successful delivery clears #status',
      statusEl.textContent, '');
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

// ---------------------------------------------------------------------------
// Issue #254 (sidebar side): the state:applyBlocked / state:applyOk notice lifecycle.
// The content script refuses a sidebar apply on a table whose registry
// originals did not survive re-injection (see the re-injection suite's
// scenario C) and sends state:applyBlocked; every non-refused apply sends
// state:applyOk. This drives sidebar.js's real onMessage handler and applyNow's
// real delivery callback, in the same eval harness as the delivery-feedback
// test above, and pins:
//   - state:applyBlocked shows the user-visible notice in #status (source-tagged);
//   - the notice survives applyNow's delivery-success clear — Chrome does
//     not guarantee whether the response callback or the content script's
//     status message lands first, so the clear must skip sourced messages;
//   - state:applyOk clears the notice, and ONLY the notice (a range error's
//     source tag is not its to clear), mirroring state:rangeOk;
//   - an unsourced stale status still clears on delivery success (the
//     behavior the delivery-feedback test above pins is preserved).
// ---------------------------------------------------------------------------
(function sidebarApplyBlocked_noticeLifecycle() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('apply-blocked notice: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }

  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
    };
  }

  const statusEl = makeEl();
  const enabledEl = makeEl();
  enabledEl.checked = true;
  let enabledChangeHandler = null;
  enabledEl.addEventListener = function (type, fn) { if (type === 'change') enabledChangeHandler = fn; };

  const bodyClasses = new Set();
  const captureBody = {
    classList: {
      add(cls) { bodyClasses.add(cls); },
      remove(cls) { bodyClasses.delete(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    addEventListener() {},
    get offsetWidth() { return 0; },
  };

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  let onMessageHandler = null;
  let queuedLastError = null;
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { onMessageHandler = fn; } },
      sendMessage() {},
      get lastError() { return queuedLastError; },
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      sendMessage(tabId, msg, cb) { if (typeof cb === 'function') cb(queuedLastError ? undefined : { ok: true }); },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  try {
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        coreSrc + '\n' +
        messagingCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // sidebar.js's module-level settings/preview pull can throw past this
      // point in this stub environment — both the onMessage listener and the
      // 'change' listener register before that runs.
    }

    eq('apply-blocked notice: sidebar onMessage handler was captured',
      typeof onMessageHandler, 'function');
    eq('apply-blocked notice: sidebar\'s enabled-checkbox change handler was captured',
      typeof enabledChangeHandler, 'function');
    if (typeof onMessageHandler !== 'function' || typeof enabledChangeHandler !== 'function') return;

    // --- state:applyBlocked shows the notice, tagged with its source. ---
    statusEl.textContent = '';
    delete statusEl.dataset.source;
    onMessageHandler({ action: 'state:applyBlocked', count: 3 }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:applyBlocked sets the user-visible notice in #status',
      statusEl.textContent,
      'This table\'s original values are no longer available. Reload the page, then apply settings again.');
    eq('apply-blocked notice: the notice is tagged with its source',
      statusEl.dataset.source, 'blocked');

    // --- The notice survives applyNow's delivery-success clear. ---
    enabledChangeHandler();
    eq('apply-blocked notice: a delivery-success clear does NOT wipe the notice (message/response ordering is not guaranteed)',
      statusEl.textContent,
      'This table\'s original values are no longer available. Reload the page, then apply settings again.');

    // --- state:rangeOk does not clear it either (source mismatch). ---
    onMessageHandler({ action: 'state:rangeOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:rangeOk leaves the blocked notice alone',
      statusEl.textContent,
      'This table\'s original values are no longer available. Reload the page, then apply settings again.');

    // --- state:applyOk clears it. ---
    onMessageHandler({ action: 'state:applyOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:applyOk clears the notice',
      statusEl.textContent, '');
    eq('apply-blocked notice: state:applyOk removes the source tag',
      statusEl.dataset.source, undefined);

    // --- state:applyOk leaves a range error alone (source mismatch, mirroring
    // state:rangeOk's own guard). ---
    onMessageHandler({ action: 'state:rangeError', error: 'Invalid range expression.' }, FROM_SIDEBAR_TAB, () => {});
    onMessageHandler({ action: 'state:applyOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('apply-blocked notice: state:applyOk leaves a range error alone',
      statusEl.textContent, 'Invalid range expression.');
    onMessageHandler({ action: 'state:rangeOk' }, FROM_SIDEBAR_TAB, () => {});

    // --- An unsourced stale status still clears on delivery success — the
    // delivery-feedback behavior pinned above is preserved. ---
    statusEl.textContent = 'a stale status message';
    delete statusEl.dataset.source;
    enabledChangeHandler();
    eq('apply-blocked notice: an unsourced stale status still clears on delivery success',
      statusEl.textContent, '');

    // --- Issue #262: state:applyBlocked also locks the panel. The connected
    // table is stuck showing simplified values, so the main toggle must
    // show ON (the truth) and stop accepting input, and the settings area
    // dims via body.table-locked. state:applyOk, a table switch
    // (state:tableSwitched), and unbinding (delivery failure →
    // setTableBound(false)) each lift the lock. ---
    enabledEl.checked = false;
    enabledEl.disabled = false;
    onMessageHandler({ action: 'state:applyBlocked', count: 1 }, FROM_SIDEBAR_TAB, () => {});
    eq('sidebar lock: state:applyBlocked adds body.table-locked',
      bodyClasses.has('table-locked'), true);
    eq('sidebar lock: state:applyBlocked forces the main toggle ON — the table IS simplified',
      enabledEl.checked, true);
    eq('sidebar lock: state:applyBlocked disables the main toggle',
      enabledEl.disabled, true);

    onMessageHandler({ action: 'state:applyOk' }, FROM_SIDEBAR_TAB, () => {});
    eq('sidebar lock: state:applyOk lifts the lock',
      bodyClasses.has('table-locked'), false);
    eq('sidebar lock: state:applyOk re-enables the main toggle',
      enabledEl.disabled, false);

    onMessageHandler({ action: 'state:applyBlocked', count: 1 }, FROM_SIDEBAR_TAB, () => {});
    onMessageHandler({ action: 'state:tableSwitched' }, FROM_SIDEBAR_TAB, () => {});
    eq('sidebar lock: a table switch (state:tableSwitched) lifts the lock',
      bodyClasses.has('table-locked'), false);
    eq('sidebar lock: a table switch re-enables the main toggle',
      enabledEl.disabled, false);

    onMessageHandler({ action: 'state:applyBlocked', count: 1 }, FROM_SIDEBAR_TAB, () => {});
    queuedLastError = { message: 'Could not establish connection.' };
    enabledChangeHandler();
    queuedLastError = null;
    eq('sidebar lock: unbinding (delivery failure) lifts the lock',
      bodyClasses.has('table-locked'), false);
    eq('sidebar lock: unbinding re-enables the main toggle for the no-table state',
      enabledEl.disabled, false);
    eq('sidebar lock: unbinding drops the stale source tag — the no-table message it writes is unsourced',
      statusEl.dataset.source, undefined);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

(function issue251_tableSwitchMirrorsModelSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('switch-pull: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('switch-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('switch-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Drift the panel away from the model: the pill shows on (as the old
    // defaults reset left it), the range expression is blank, and the
    // previous table's apply left the panel locked.
    h.enabledEl.checked = true;
    h.rangeExprEl.value = '';
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    eq('switch-pull: precondition — the previous table\'s state:applyBlocked locked the panel',
      h.bodyClasses.has('table-locked'), true);

    // The switch message: lift the lock, re-read the model.
    h.dispatch({ action: 'state:tableSwitched' });
    eq('switch-pull: a table switch lifts the lock',
      h.bodyClasses.has('table-locked'), false);
    eq('switch-pull: a table switch re-enables the main toggle',
      h.enabledEl.disabled, false);
    eq('switch-pull: the main toggle mirrors the model\'s enabled:false after a switch',
      h.enabledEl.checked, false);
    // The claim here is that the sidebar MIRRORS the application model. A
    // press that moves the active table sends state:tableSwitched and then clears
    // the range expression in its one settings write (2026-09-14 sidebar-
    // state-removal, part one). The send goes out first, and Chrome delivers
    // it after the content script's handler returns, so the pull it triggers
    // reads the cleared expression. What reaches the sidebar through this
    // path after such a press is therefore blank. This test still holds,
    // because it asserts the mirroring and the model fixture above is what
    // it mirrors.
    eq('switch-pull: the range expression mirrors the model after a switch (pull, not defaults reset)',
      h.rangeExprEl.value, 'B2:E8');
  } finally {
    h.restore();
  }
})();

(function issue251_previewRefreshMirrorsModelSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('refresh-pull: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('refresh-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('refresh-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Drift the pill on, then deliver the stale-view signal. The old bare
    // preview fetch ended in setTableBound(true), which reset the pill to
    // the shipped default (on) — the model says off.
    h.enabledEl.checked = true;
    h.dispatch({ action: 'state:previewSamplesChanged' });
    eq('refresh-pull: the main toggle mirrors the model\'s enabled:false after a preview refresh',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function issue251_lockOutlivesAPullResolvingUnderIt() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-vs-pull: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-vs-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('lock-vs-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Issue #262's lock forces the main toggle ON + disabled (the bound
    // table is stuck simplified). A settings pull that resolves while the
    // lock is displayed — a reconnect refresh whose apply just re-blocked —
    // must not write the model's enabled:false over the lock's forced ON.
    // Ordering here mirrors the wire: state:applyBlocked lands, then the
    // stale-view refresh runs its pull.
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    eq('lock-vs-pull: precondition — state:applyBlocked locked the panel',
      h.bodyClasses.has('table-locked'), true);

    h.dispatch({ action: 'state:previewSamplesChanged' });
    eq('lock-vs-pull: the pull leaves the locked toggle ON — the table IS simplified',
      h.enabledEl.checked, true);
    eq('lock-vs-pull: the pull leaves the locked toggle disabled',
      h.enabledEl.disabled, true);
    eq('lock-vs-pull: the lock itself survives the pull',
      h.bodyClasses.has('table-locked'), true);
  } finally {
    h.restore();
  }
})();

// ---------------------------------------------------------------------------
// Issue #275: the context-menu toggle must go through the same controller
// branch a pill click uses. The right-click that opens the menu already
// connects the table (the contextmenu handler calls setSelectedTable), so
// with the sidebar open, "Toggle table" on that table must write the
// record and report it (state:tableEnabledChanged) — the #272 contract. Before the
// fix, intent:menuClicked simplified the table directly: the page changed,
// the settings record and the sidebar both went stale, and the next reopen or switch
// re-imposed the stale record. Fresh-eval fixture modeled on the
// double-invocation test above; same minimal grid, real captured handlers.
// ---------------------------------------------------------------------------
(function issue275_menuToggleOnConnectedTableWritesRecord() {
  function makeCell(text) { return { nodeType: 1, textContent: text, children: [] }; }
  function makeRow(texts) { return { nodeType: 1, className: 'row', children: texts.map(makeCell) }; }
  const rows = [
    makeRow(['A', '100']), makeRow(['B', '200']), makeRow(['C', '300']),
    makeRow(['D', '400']), makeRow(['E', '500']),
  ];
  const gridClassList = (() => {
    const c = [];
    return {
      add(x) { if (!c.includes(x)) c.push(x); },
      remove(x) { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
      contains(x) { return c.includes(x); },
    };
  })();
  const gridEl = {
    nodeType: 1, tagName: 'DIV', className: 'grid-wrapper', children: rows,
    classList: gridClassList, parentElement: null, parentNode: null,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 }; },
  };
  const clickTarget = {
    nodeType: 1, tagName: 'DIV', parentElement: gridEl, parentNode: gridEl,
    closest() { return null; },
  };

  function mockCreateElement(tag) {
    if (tag === 'button') {
      return {
        type: '', className: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
        addEventListener() {}, appendChild() {}, parentElement: null,
      };
    }
    return { className: '', style: {}, textContent: '', appendChild() {}, addEventListener() {} };
  }

  let contextmenuHandler = null;
  // Chrome hands an arriving message to every registered listener: the bus's
  // and the one content.js keeps for the requests.
  const messageListeners = [];
  const fireMessage = (msg) => messageListeners.forEach((fn) => fn(msg, {}, () => {}));
  const captureDoc = {
    addEventListener(type, handler) { if (type === 'contextmenu') contextmenuHandler = handler; },
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {}, observe() {} },
    head: { appendChild() {} },
    createElement: mockCreateElement,
  };
  const sentMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { messageListeners.push(fn); } },
      sendMessage(msg) { sentMessages.push(msg); },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedGCS = global.getComputedStyle;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.getComputedStyle = () => ({ display: 'flex' });

  try {
    eval(contentScriptBundle + `
      globalThis.__i275_DR_STORE = DR_STORE;
    `);
    const store = global.__i275_DR_STORE;

    eq('menu-toggle record: contextmenu handler was captured', typeof contextmenuHandler, 'function');
    eq('menu-toggle record: the bus registered its message listener', messageListeners.length, 1);
    if (typeof contextmenuHandler !== 'function' || messageListeners.length === 0) return;

    // The right-click that opens the menu: discovers, marks, and CONNECTS
    // the grid — exactly what a real menu use does before intent:menuClicked.
    contextmenuHandler({ target: clickTarget });
    eq('menu-toggle record: the right-click connected the grid',
      store.getSelectedTable(), gridEl);

    // The settings record starts at on, the table showing simplified values.
    store.setTableAppliedFlag(gridEl, 'simplified');
    eq('menu-toggle record: precondition — the record starts enabled',
      store.getSettings().enabled, true);

    sentMessages.length = 0;
    fireMessage({ action: 'intent:menuClicked' });

    eq('menu-toggle record: the menu toggle on the connected table writes the record\'s off',
      store.getSettings().enabled, false);
    const toggleMsgs = sentMessages.filter((m) => m.action === 'state:tableEnabledChanged');
    eq('menu-toggle record: the menu toggle reports the record to the panel — off',
      toggleMsgs.map((m) => m.enabled), [false]);
  } finally {
    delete global.__i275_DR_STORE;
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.getComputedStyle = savedGCS;
  }
})();

// ---------------------------------------------------------------------------
// Issue #272, leak 2: the #262 lock's forced ON must be display-only. The
// panel stashes the record's enabled when the lock engages, every save under
// the lock writes the stashed value (the sliders stay usable while locked),
// record changes landing under the lock update the stash, and lifting the
// lock puts the stashed value back on the switch. Before the fix, a save
// under the lock wrote the forced ON into the record — silently discarding
// the user's off — and the forced ON outlived the lock until the next pull.
// ---------------------------------------------------------------------------
(function issue272_saveUnderLockWritesTheRecordsEnabled() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-save: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-save: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // The module-level pull mirrored the model: enabled off.
    eq('lock-save: precondition — the switch mirrors the model\'s off',
      h.enabledEl.checked, false);
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    eq('lock-save: precondition — the lock forces the switch on',
      h.enabledEl.checked, true);

    // A save while locked — the granularity control's change listener runs
    // the same applyNow a slider drag ends in.
    h.tabMessages.length = 0;
    h.el('dateGranularity').fire('change');
    const applyMsg = h.tabMessages.find((m) => m.action === 'request:applySettings');
    eq('lock-save: the save reaches the wire', applyMsg !== undefined, true);
    eq('lock-save: a save under the lock writes the record\'s off — not the forced on',
      applyMsg && applyMsg.settings.enabled, false);
  } finally {
    h.restore();
  }
})();

(function issue272_lockLiftRestoresTheRecordsEnabled() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-lift: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-lift: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    h.dispatch({ action: 'state:applyOk' });
    eq('lock-lift: state:applyOk lifts the lock',
      h.bodyClasses.has('table-locked'), false);
    eq('lock-lift: state:applyOk re-enables the switch', h.enabledEl.disabled, false);
    eq('lock-lift: the switch returns to the record\'s off — the forced ON does not outlive the lock',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function issue272_recordChangesUnderLockAreDisplayOnlyAndTracked() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('locked toggle-state: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('locked toggle-state: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    h.dispatch({ action: 'state:tableEnabledChanged', enabled: false });
    eq('locked toggle-state: the switch stays forced on while locked — the record change is display-only',
      h.enabledEl.checked, true);
    h.dispatch({ action: 'state:tableEnabledChanged', enabled: true });
    h.dispatch({ action: 'state:applyOk' });
    eq('locked toggle-state: the lift shows the record\'s latest value (on)',
      h.enabledEl.checked, true);

    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    h.dispatch({ action: 'state:tableEnabledChanged', enabled: false });
    h.dispatch({ action: 'state:applyOk' });
    eq('locked toggle-state: the lift shows the record\'s latest value (off)',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

// A re-lock while already locked must keep the stash — never capture the
// forced ON. The real sequence: a save under the lock re-applies on the
// content side, the stuck table blocks again, and a second state:applyBlocked
// lands while the switch is already forced on. Without the engage-guard the
// stash becomes true and the next save writes the forced ON into the record
// — leak 2 verbatim, one message later.
(function issue272_reLockKeepsTheStash() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('re-lock: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('re-lock: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.dispatch({ action: 'state:applyBlocked', count: 1 }); // stash = model's off
    h.dispatch({ action: 'state:applyBlocked', count: 1 }); // re-lock: stash must survive
    h.tabMessages.length = 0;
    h.el('dateGranularity').fire('change');
    const applyMsg = h.tabMessages.find((m) => m.action === 'request:applySettings');
    eq('re-lock: a save after a second state:applyBlocked still writes the record\'s off',
      applyMsg && applyMsg.settings.enabled, false);
    h.dispatch({ action: 'state:applyOk' });
    eq('re-lock: the lift still shows the record\'s off',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

// Unbinding while locked (a save whose delivery fails runs setTableBound(false))
// must drop the stash with the lock. Without the clear, the stash outlives the
// lock and the next state:applyOk restores a stale ON over the no-table off.
(function issue272_unbindWhileLockedDropsTheStash() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('unbind-locked: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('unbind-locked: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // Drift the switch on, then lock — the stash captures the drifted on.
    h.enabledEl.checked = true;
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    // A save whose delivery fails: nothing answers applyNow's request, and it
    // unbinds the panel (setTableBound(false)) — lock and stash both go.
    h.chromeMock.runtime.lastError = { message: 'no receiving end' };
    h.el('dateGranularity').fire('change');
    h.chromeMock.runtime.lastError = null;
    eq('unbind-locked: the failed delivery unbinds and lifts the lock',
      h.bodyClasses.has('table-locked'), false);
    eq('unbind-locked: the no-table state forces the switch off',
      h.enabledEl.checked, false);
    h.dispatch({ action: 'state:applyOk' });
    eq('unbind-locked: a later state:applyOk does not resurrect the pre-unbind stash',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function issue272_pullUnderLockTracksTheRecord() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lock-pull-stash: source files (defaults/rounding/core/messaging) present in manifest',
      false, true);
    return;
  }
  try {
    eq('lock-pull-stash: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // Drift the switch on, then lock — the stash captures the drifted on.
    h.enabledEl.checked = true;
    h.dispatch({ action: 'state:applyBlocked', count: 1 });
    // A pull resolving under the lock reads the model's enabled:false. The
    // display must not change (pinned by the #251 lock-vs-pull test above);
    // the stash must track it so the lift shows the model, not the value
    // stashed at lock time.
    h.dispatch({ action: 'state:previewSamplesChanged' });
    eq('lock-pull-stash: the pull leaves the locked switch on (display-only)',
      h.enabledEl.checked, true);
    h.dispatch({ action: 'state:applyOk' });
    eq('lock-pull-stash: the lift shows the model\'s off from the pull, not the pre-lock drift',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

(function captureSizeNoteGlue() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  eq('capture-size: the form holds a hidden size note',
    /<div[^>]*id="captureSizeNote"[^>]*hidden/.test(sidebarHtmlSrc), true);
  eq('capture-size: opening the form measures the pulled state through the package helper',
    sidebarJsSrc.includes('DR_CAPTURE.sizeWarning(') &&
      sidebarJsSrc.includes('captureSizeNote'), true);
  eq('capture-size: a failed save reports on the status line and is logged',
    sidebarJsSrc.includes('Capture failed') &&
      /DR_LOG\.warn\([^)]*save failed/.test(sidebarJsSrc), true);
})();

// --- sidebar: the capture section and its glue ---
//
// The suite never executes sidebar.js (it is asserted as source text — the
// established style for sidebar wiring), so these tests pin the markup and
// the glue's load-bearing seams: the three mark buttons, the form that
// nothing saves without, the one save path, and the state pull.

(function captureSidebarSection() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  eq('capture-ui: sidebar.html carries the capture section with three mark buttons',
    sidebarHtmlSrc.includes('id="captureSection"') &&
      ['data-mark="looks-right"', 'data-mark="not-sure"', 'data-mark="looks-wrong"']
        .every((m) => sidebarHtmlSrc.includes(m)),
    true);
  eq('capture-ui: the remarks form starts hidden and holds one remarks field and both buttons',
    /<div[^>]*id="captureForm"[^>]*hidden/.test(sidebarHtmlSrc) &&
      ['id="captureRemarks"', 'id="captureSave"', 'id="captureCancel"']
        .every((id) => sidebarHtmlSrc.includes(id)) &&
      !sidebarHtmlSrc.includes('id="captureExpected"'),
    true);
  eq('capture-ui: the remarks preview text follows the mark',
    ['Suggestions / questions / remarks', 'expected / observed / cause (if known)']
      .every((hint) => sidebarJsSrc.includes(hint)) &&
      /placeholder/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the glue asks for the capture state over request:captureState',
    sidebarJsSrc.includes("DR_BUS.request('request:captureState'"), true);
  eq('capture-ui: exactly one save path creates the blob URL',
    (sidebarJsSrc.match(/createObjectURL/g) || []).length, 1);
  eq('capture-ui: nothing saves without a pressed mark',
    /function saveCapture\(\)[\s\S]{0,200}if \(captureMark === null\) return;/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the renderer receives the locked wording as a value, not a copy',
    /buildCaptureDocument\(\{[\s\S]{0,120}lockedStatusText: APPLY_BLOCKED_STATUS_MSG/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the filename comes from the package helper and carries the mark',
    /DR_CAPTURE\.filenameFor\(\{[^}]*mark: mark/.test(sidebarJsSrc), true);
  eq('capture-ui: the sidebar\'s own log snapshot travels beside the content script\'s',
    /sidebar: DR_LOG\.snapshot\(\)/.test(sidebarJsSrc), true);
  eq('capture-ui: an unanswered state request still saves and records the failure',
    /DR_LOG\.warn\([^)]*went unanswered/.test(sidebarJsSrc), true);
  const saveBody = (sidebarJsSrc.match(/function saveCapture\(\)[\s\S]*?\n\}/) || [''])[0];
  eq('capture-ui: finish takes the screenshot beside the state pull and the save waits for both',
    saveBody.includes("DR_BUS.request('request:captureState'") &&
      saveBody.includes('takeCaptureScreenshot(chrome.tabs, boundTab.windowId()') &&
      (saveBody.match(/assembleAndSaveCapture\(/g) || []).length === 1, true);
  eq('capture-ui: the renderer receives the image beside the state, never inside it',
    /buildCaptureDocument\(\{[\s\S]{0,200}screenshotDataUrl:/.test(sidebarJsSrc) &&
      /state\.screenshot = /.test(sidebarJsSrc) &&
      !/state\.screenshotDataUrl/.test(sidebarJsSrc), true);
})();

// #308: the mark glyphs live in two machine copies — the sidebar's buttons
// and the renderer's map — and one copy cannot read the other (static
// markup against a content-script constant). This pin holds them together:
// a glyph change that lands in one place fails here, naming the other.
(function captureGlyphCopiesMatch() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const buttonGlyphs = {};
  const buttonRe = /data-mark="([a-z-]+)"[^>]*>([^<]+)</g;
  let m;
  while ((m = buttonRe.exec(sidebarHtmlSrc)) !== null) {
    buttonGlyphs[m[1]] = m[2].replace(/&#(\d+);/g,
      (_, code) => String.fromCodePoint(Number(code)));
  }
  eq('capture-glyphs: the sidebar buttons and the renderer map carry the same three glyphs',
    buttonGlyphs, CAPTURE_MARK_GLYPHS);
  // The button title is the mark's word for the sidebar; the renderer derives
  // the same word from the token, so the two surfaces stay in step.
  const buttonTitles = {};
  const titleRe = /data-mark="([a-z-]+)"[^>]*title="([^"]+)"/g;
  while ((m = titleRe.exec(sidebarHtmlSrc)) !== null) buttonTitles[m[1]] = m[2];
  const rendererLabels = {};
  Object.keys(CAPTURE_MARK_GLYPHS).forEach((token) => {
    rendererLabels[token] = DR_CAPTURE.markLabel(token);
  });
  eq('capture-glyphs: the sidebar button titles match the renderer\'s mark words',
    buttonTitles, rendererLabels);
  eq('capture-glyphs: a token outside the three renders as itself',
    DR_CAPTURE.markLabel('constructor'), 'constructor');
})();

// --- The sidebar serves one tab (issue #343) --------------------------------
//
// A content script reports by broadcast, and a broadcast reaches the sidebar
// whatever tab it came from. The sidebar acted on every report it received,
// so a background tab re-simplifying its rows redrew the sidebar and a
// blocked apply there locked it against a table the user could not see.
//
// createBoundTab holds the whole concern and takes its tabs interface and its
// bus as parameters, so this section drives the real source with stubs
// instead of scanning it.
(function boundTabSection() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const factory = sidebarSrc.match(/function createBoundTab\([\s\S]*?\n\}/);

  eq('bound tab: createBoundTab extracted from sidebar.js', !!factory, true);
  if (!factory) return;

  const createBoundTab = (new Function('return ' + factory[0] + ';'))();
  eq('bound tab: createBoundTab is a function', typeof createBoundTab, 'function');

  // A bus stub recording every subscription, so a test can deliver a report
  // on a topic with any sending tab it likes.
  function makeBus() {
    const handlers = new Map();
    return {
      subscribe(topic, handler) {
        if (!handlers.has(topic)) handlers.set(topic, []);
        handlers.get(topic).push(handler);
        return () => {};
      },
      // Deliver as the bus does: the payload, and beside it the facts the
      // carrier supplied rather than the publisher.
      deliver(topic, payload, tabId) {
        for (const h of (handlers.get(topic) || [])) h(payload, { tabId });
      },
      topicCount() { return handlers.size; },
    };
  }

  // A tabs stub. queryResult is what chrome.tabs.query answers with. An
  // activation names a window, and defaults to the window the bound tab sits
  // in, so a test that names none is switching tabs inside that window.
  function makeTabs(queryResult) {
    const listeners = [];
    const homeWindow = queryResult && queryResult[0] ? queryResult[0].windowId : undefined;
    return {
      query(q, cb) { cb(queryResult); },
      onActivated: { addListener: (fn) => { listeners.push(fn); } },
      activate(tabId, windowId) {
        const inWindow = windowId === undefined ? homeWindow : windowId;
        for (const fn of listeners) fn({ tabId, windowId: inWindow });
      },
      listenerCount() { return listeners.length; },
    };
  }

  const OWN_TAB = 11;
  const OTHER_TAB = 12;
  const OWN_WINDOW = 3;
  const OTHER_WINDOW = 4;

  // --- The opening read runs after the tab is recorded, never before ---
  (function resolveOrdering() {
    const order = [];
    const tabs = {
      query(q, cb) { order.push('query'); cb([{ id: OWN_TAB, windowId: OWN_WINDOW }]); },
      onActivated: { addListener: () => {} },
    };
    const bus = makeBus();
    const boundTab = createBoundTab(tabs, bus);
    const seen = [];
    boundTab.subscribe('state:applyOk', () => { seen.push('report'); });
    boundTab.resolve(() => { order.push('opening read'); });

    eq('bound tab: the opening read runs after the tab lookup',
      order, ['query', 'opening read']);

    // The recorded tab is read through the only thing that uses it.
    bus.deliver('state:applyOk', {}, OWN_TAB);
    eq('bound tab: resolve records the tab the sidebar was opened for',
      seen, ['report']);
  })();

  // --- The window the bound tab sits in, for the screenshot ---
  (function windowIdAccessor() {
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), makeBus());
    const before = boundTab.windowId();
    boundTab.resolve(() => {});
    eq('bound tab: windowId() answers null before the lookup and the window after it',
      [before, boundTab.windowId()], [null, OWN_WINDOW]);
    const noWindow = createBoundTab({ query: (q, cb) => cb([{ id: OWN_TAB }]) }, makeBus());
    noWindow.resolve(() => {});
    eq('bound tab: windowId() stays null when the tabs interface reports no window',
      noWindow.windowId(), null);
  })();

  // No tab to bind to: the sidebar still runs its opening read, which falls
  // to the unbound state on its own when nothing answers.
  (function resolveWithNoActiveTab() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([]), bus);
    const seen = [];
    boundTab.subscribe('state:applyOk', () => { seen.push('report'); });
    let ran = false;
    boundTab.resolve(() => { ran = true; });

    eq('bound tab: no active tab still runs the opening read', ran, true);

    bus.deliver('state:applyOk', {}, OWN_TAB);
    eq('bound tab: with no tab recorded every report is dropped', seen, []);
  })();

  // --- A report is acted on only when it came from the bound tab ---
  (function reportsAreFiltered() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), bus);
    boundTab.resolve(() => {});

    const seen = [];
    boundTab.subscribe('state:applyBlocked', (payload) => { seen.push(payload); });

    bus.deliver('state:applyBlocked', { from: 'own' }, OWN_TAB);
    eq('bound tab: a report from the bound tab reaches its handler',
      seen, [{ from: 'own' }]);

    bus.deliver('state:applyBlocked', { from: 'other' }, OTHER_TAB);
    eq('bound tab: a report from another tab is dropped',
      seen, [{ from: 'own' }]);

    // An extension page has no tab. Nothing a content script sends looks
    // like this, and a report that does belongs to no tab at all.
    bus.deliver('state:applyBlocked', { from: 'an extension page' }, null);
    eq('bound tab: a report carrying no tab is dropped',
      seen, [{ from: 'own' }]);
  })();

  // The window between the sidebar opening and its tab lookup answering.
  // Nothing can be compared yet, so nothing is acted on; the opening read
  // that follows carries the current truth.
  (function reportsBeforeTheTabResolves() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), bus);
    const seen = [];
    boundTab.subscribe('state:previewSamplesChanged', (payload) => { seen.push(payload); });

    bus.deliver('state:previewSamplesChanged', { early: true }, OWN_TAB);
    eq('bound tab: a report arriving before the tab lookup answers is dropped',
      seen, []);

    boundTab.resolve(() => {});
    bus.deliver('state:previewSamplesChanged', { early: false }, OWN_TAB);
    eq('bound tab: reports are acted on once the tab lookup has answered',
      seen, [{ early: false }]);
  })();

  // --- Leaving the bound tab ---
  //
  // The service worker closes the sidebar when the tab it was opened for
  // stops being the front tab, and misses two routes: an idle restart empties
  // the tab number it compares against, and a sidebar opened from Chrome's
  // own side-panel control never sets it. On those routes the sidebar used to
  // survive the switch and keep showing controls for a page the user had
  // left. It closes itself now, so a tab switch has one outcome.
  (function closesOnSwitchAway() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onSwitchAway(() => { closes++; });

    tabs.activate(OWN_TAB);
    eq('bound tab: staying on the bound tab does not close the sidebar', closes, 0);

    tabs.activate(OTHER_TAB);
    eq('bound tab: switching to another tab closes the sidebar', closes, 1);
  })();

  // A side panel belongs to one browser window, and the activation event
  // fires for every window. An activation in a second window leaves the bound
  // tab where it was — still the front tab of its own window — so closing on
  // it would take the sidebar away from a user who never left its page.
  (function activationInAnotherWindow() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onSwitchAway(() => { closes++; });

    tabs.activate(OTHER_TAB, OTHER_WINDOW);
    eq('bound tab: an activation in another window does not close the sidebar', closes, 0);

    tabs.activate(OTHER_TAB, OWN_WINDOW);
    eq('bound tab: an activation in the bound tab\'s own window closes it', closes, 1);
  })();

  // With no tab recorded there is nothing to have left, and closing on the
  // next switch would take the sidebar away for a reason it cannot state.
  (function noBoundTabNeverCloses() {
    const tabs = makeTabs([]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onSwitchAway(() => { closes++; });

    tabs.activate(OTHER_TAB);
    eq('bound tab: with no tab recorded a switch does not close the sidebar', closes, 0);
  })();

  // A tabs interface with no activation event must not throw. The sidebar
  // then never closes itself, which is its behavior before this change.
  (function noActivationEvent() {
    const bus = makeBus();
    const boundTab = createBoundTab({ query: (q, cb) => cb([{ id: OWN_TAB }]) }, bus);
    boundTab.resolve(() => {});

    let threw = false;
    try { boundTab.onSwitchAway(() => {}); } catch (e) { threw = true; }
    eq('bound tab: a tabs interface with no activation event does not throw', threw, false);

    // Reports still reach the sidebar; only the self-close is missing.
    const seen = [];
    boundTab.subscribe('state:applyOk', () => { seen.push('report'); });
    bus.deliver('state:applyOk', {}, OWN_TAB);
    eq('bound tab: reports still reach the sidebar with no activation event',
      seen, ['report']);
  })();

  // --- Every content-script report goes through the gate ---
  //
  // The list is derived, never restated: a topic qualifies when the bus lists
  // it, the content script publishes it, and the sidebar subscribes it. A
  // topic added later joins this check with no edit here. The count assertion
  // makes the scan fail closed, so a regex that matches nothing cannot read
  // as a pass.
  (function everyContentReportIsGated() {
    const contentSrc = sourceByName('content.js');
    eq('bound tab: the content script source is readable (fails closed on a rename)',
      typeof contentSrc, 'string');
    if (typeof contentSrc !== 'string') return;
    const publishes = (src, topic) => new RegExp("publish\\(\\s*'" + topic + "'").test(src);
    const gated = (src, topic) => new RegExp("boundTab\\.subscribe\\(\\s*'" + topic + "'").test(src);
    const ungated = (src, topic) => new RegExp("DR_BUS\\.subscribe\\(\\s*'" + topic + "'").test(src);

    const contentReports = Object.keys(DR_BUS.TOPICS).filter((topic) =>
      publishes(contentSrc, topic) && (gated(sidebarSrc, topic) || ungated(sidebarSrc, topic)));

    eq('bound tab: the scan found content-script reports the sidebar subscribes (fails closed on an empty list)',
      contentReports.length > 0, true);
    eq('bound tab: every content-script report the sidebar subscribes goes through the bound-tab gate',
      contentReports.filter((topic) => ungated(sidebarSrc, topic)), []);

    // The service worker's close carries no tab, so gating it would drop it.
    eq('bound tab: the close message stays off the gate',
      ungated(sidebarSrc, 'intent:closeSidebar'), true);
  })();
})();
