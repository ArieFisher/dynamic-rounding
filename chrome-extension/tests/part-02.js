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

// --- auto-table-toggle ---
//
// Adversarial tests for the per-table toggle switch sprint.
// We call the new pure/semi-pure functions directly after eval.
// MutationObserver and ResizeObserver are stubbed as no-ops so the top-level
// initialisation code in content.js does not throw at eval time.

// Stub constructors so the module-level MutationObserver / ResizeObserver usage
// at content.js load time does not throw in Node. The stubs are injected BEFORE
// the eval, but since we patch globalThis here (after the eval), we need to work
// around the fact the eval already ran. In practice the guards in content.js
// (`if (typeof MutationObserver !== 'undefined')`) check the global at eval time.
// The eval has already run successfully (MutationObserver was undefined → guarded).
// These stubs are only needed for any test that directly calls createToggleForTable,
// which itself calls `new ResizeObserver(...)`. We therefore stub ResizeObserver
// on globalThis before those tests run.
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} };
global.Node = { ELEMENT_NODE: 1 };

// --- Helpers ---

// --- AC5: isTableRounded returns false for a fresh table ---

(function atToggle_isTableRounded_freshTable() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  eq('auto-table-toggle: isTableRounded(fresh table) is false',
    isTableRounded(table), false);
})();

// --- AC5: isTableRounded returns true after roundTable marks cells ---

(function atToggle_isTableRounded_afterRound() {
  // Directly inject the rounded class AND set the registry's appliedFlag to
  // simulate a rounded table (don't run the full roundTable pipeline which
  // requires tree walkers etc.) — isTableRounded reads DR_STORE's appliedFlag
  // (app-model-registry sprint), not the class, so both are set here the way
  // roundTable itself would leave them.
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  DR_STORE.setTableAppliedFlag(table, 'simplified');
  eq('auto-table-toggle: isTableRounded(table with .dr-ext-rounded cell) is true',
    isTableRounded(table), true);
})();

// --- AC5: isTableRounded returns false when appliedFlag !== 'simplified' ---
// (the restore path sets this before it rewrites cells)

(function atToggle_isTableRounded_showingOriginal() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  DR_STORE.setTableAppliedFlag(table, 'original');
  eq('auto-table-toggle: isTableRounded is false when appliedFlag is "original"',
    isTableRounded(table), false);
})();

// --- AC5: isTableRounded after the reset restores originals ---
// A form flip used to take a table back to its original values while keeping
// its simplified markers and stored originals in place. The 2026-09-14
// sidebar-state-removal design retired that flip (#241): turning
// simplification off resets the table outright. This pins the reset against
// the same three observables the flip was pinned against, plus the two the
// flip left behind — the marker and the stored original.

(function atToggle_isTableRounded_afterReset() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  // Simulate a post-roundTable state: cell has rounded class + a registry
  // original record (app-model-registry sprint — this used to be
  // cell.dataset.originalHtml), and the registry's appliedFlag is
  // 'simplified'.
  const cell = table._cells[0];
  cell.classList.add('dr-ext-rounded');
  DR_STORE.setTableOriginal(table, cell, { value: '1,000', pieces: [{ text: '1,000', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');
  cell.innerHTML = '1,000';
  // Also need to stub the innerHTML setter so the restore can write it
  Object.defineProperty(cell, 'innerHTML', {
    get() { return this._html !== undefined ? this._html : cell.textContent; },
    set(v) { this._html = v; },
    configurable: true,
  });

  // Inject toggle entry (proper button stub) so syncSwitchForTable doesn't crash
  injectToggleEntry(table);

  resetTable(table);

  eq('auto-table-toggle: after the reset, isTableRounded is false',
    isTableRounded(table), false);
  eq('auto-table-toggle: after the reset, appliedFlag is "original"',
    DR_STORE.getTableAppliedFlag(table), 'original');
  eq('auto-table-toggle: the reset clears the simplified marker, where the form flip kept it',
    cell.classList.contains('dr-ext-rounded'), false);
  eq('auto-table-toggle: the reset clears the stored original, where the form flip kept it',
    DR_STORE.hasTableOriginal(table, cell), false);
})();

// --- AC6: syncSwitchForTable sets aria-pressed on the button to match isTableRounded ---

(function atToggle_syncSwitch_ariaFalseWhenNotRounded() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  button.setAttribute('aria-pressed', 'true'); // pre-set to true to confirm it gets corrected

  syncSwitchForTable(table);
  eq('auto-table-toggle: syncSwitchForTable sets aria-pressed="false" on fresh table',
    button.getAttribute('aria-pressed'), 'false');
})();

(function atToggle_syncSwitch_ariaTrueWhenRounded() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  button.setAttribute('aria-pressed', 'false'); // pre-set to false to confirm it gets corrected

  // Mark table as rounded. A registry record accompanies the marker:
  // production rounded/showing-original states always carry one (roundTable
  // writes it; the keepEntry restore preserves it). A marker WITHOUT a
  // record is the locked re-injection state (issue #262), tested in the
  // re-injection suite.
  table._cells[0].classList.add('dr-ext-rounded');
  DR_STORE.setTableOriginal(table, table._cells[0], { value: '1,000', pieces: [{ text: '1,000', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');

  syncSwitchForTable(table);
  eq('auto-table-toggle: syncSwitchForTable sets aria-pressed="true" on rounded table',
    button.getAttribute('aria-pressed'), 'true');
})();

(function atToggle_syncSwitch_ariaFalseWhenShowingOriginal() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  table._cells[0].classList.add('dr-ext-rounded');
  // Registry record present — see atToggle_syncSwitch_ariaTrueWhenRounded.
  DR_STORE.setTableOriginal(table, table._cells[0], { value: '1,000', pieces: [{ text: '1,000', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'original');
  button.setAttribute('aria-pressed', 'true');

  syncSwitchForTable(table);
  eq('auto-table-toggle: syncSwitchForTable sets aria-pressed="false" when showingOriginal=true',
    button.getAttribute('aria-pressed'), 'false');
})();

// --- AC6: syncSwitchForTable is a no-op when no toggle registered ---

(function atToggle_syncSwitch_noEntryIsNoop() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  // No injectToggleEntry call — tableToggles has no entry for this table.
  // Should not throw.
  let threw = false;
  try { syncSwitchForTable(table); } catch (e) { threw = true; }
  eq('auto-table-toggle: syncSwitchForTable does not throw when no toggle registered',
    threw, false);
})();

// --- DOM shape: createToggleForTable creates the new morph button structure ---
// Spec (§3.6 + AC): button.dr-ext-morph > span.dr-ext-morph-visible > span.dr-ext-morph-knob
// The button must have type="button", aria-pressed="false", and an aria-label.

(function atToggle_createToggle_domShape() {
  const createdElements = [];
  const appendedChildren = [];

  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;

  global.document.createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const el = {
      _tag: tag,
      type: '',
      className: '',
      style: {},
      _children: [],
      _listeners: listeners,
      dataset: {},
      parentElement: null,
      textContent: '',
      appendChild(child) {
        this._children.push(child);
        child.parentElement = this;
        return child;
      },
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      removeAttribute(name) { delete attrs[name]; },
      classList: (() => {
        const c = [];
        return {
          _c: c,
          add(x)     { if (!c.includes(x)) c.push(x); },
          remove(x)  { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
          contains(x){ return c.includes(x); },
          toggle(x, f) {
            const has = c.includes(x);
            const want = f === undefined ? !has : f;
            if (want && !has) c.push(x);
            else if (!want && has) c.splice(c.indexOf(x), 1);
            return want;
          },
        };
      })(),
      contains() { return false; },
    };
    createdElements.push(el);
    return el;
  };

  global.document.body = {
    appendChild(child) {
      appendedChildren.push(child);
      child.parentElement = global.document.body;
    }
  };
  global.document.documentElement = { appendChild() {} };

  // Reset the module-level flag so injection runs
  toggleStyleInjected = false;
  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },  { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(table);

  // Restore
  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  // The button element should have been created and appended to body
  const buttonEl = appendedChildren.find(e => e._tag === 'button');
  eq('auto-table-toggle: createToggleForTable appends a <button> to document.body',
    buttonEl !== undefined, true);

  // Must have class dr-ext-morph
  eq('auto-table-toggle: createToggleForTable creates a <button class="dr-ext-morph">',
    buttonEl ? buttonEl.className === 'dr-ext-morph' : false, true);

  // Must have type="button"
  eq('auto-table-toggle: createToggleForTable button has type="button"',
    buttonEl ? buttonEl.type === 'button' : false, true);

  // aria-pressed initially "false"
  eq('auto-table-toggle: createToggleForTable button has aria-pressed="false" initially',
    buttonEl ? buttonEl.getAttribute('aria-pressed') : null, 'false');

  // Must have aria-label (accessible name)
  const ariaLabel = buttonEl ? buttonEl.getAttribute('aria-label') : null;
  eq('auto-table-toggle: createToggleForTable button has non-empty aria-label',
    typeof ariaLabel === 'string' && ariaLabel.length > 0, true);

  // aria-label must mention rounding (case-insensitive)
  eq('auto-table-toggle: createToggleForTable aria-label mentions rounding',
    ariaLabel ? ariaLabel.toLowerCase().includes('round') : false, true);

  // First child of button must be span.dr-ext-morph-visible
  const visibleEl = buttonEl ? buttonEl._children[0] : null;
  eq('auto-table-toggle: button first child is <span class="dr-ext-morph-visible">',
    visibleEl ? (visibleEl._tag === 'span' && visibleEl.className === 'dr-ext-morph-visible') : false, true);

  // First child of visible must be span.dr-ext-morph-knob
  const knobEl = visibleEl ? visibleEl._children[0] : null;
  eq('auto-table-toggle: visible first child is <span class="dr-ext-morph-knob">',
    knobEl ? (knobEl._tag === 'span' && knobEl.className === 'dr-ext-morph-knob') : false, true);

  // tableToggles must now contain this table
  eq('auto-table-toggle: createToggleForTable registers table in tableToggles',
    tableToggles.has(table), true);
})();

// --- Anchor geometry (rest state, scroll=0) ---
// Spec (§3.2): wrapper left/top place the visible's bottom-right at
//   visible.bottom = rect.top  + scrollY + TOGGLE_DOT_OVERLAP_PX
//   visible.right  = rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX
// With justify-content: flex-end + padding: TOGGLE_HIT_PAD_PX, the visible sits
// inside the wrapper's content box on both axes, so its right edge is
// wrapper.right - padding (not wrapper.right). The wrapper offsets are therefore:
//   wrapperLeft = (rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX
//   wrapperTop  = (rect.top   + scrollY + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX
// (Note: this corrects a math error in the merged plan §3.6, which double-counted
// padding on the horizontal axis. See sprint log for the deviation.)
// All arithmetic is done in terms of the exposed globalThis constants.

(function atToggle_positionToggle_anchorGeometry_noScroll() {
  const tableRect = { top: 100, right: 500, bottom: 200, left: 100, width: 400, height: 100 };
  const table = { getBoundingClientRect() { return tableRect; } };
  const buttonEl = { style: {} };

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  positionToggle(table, buttonEl);

  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;

  const left = parseFloat(buttonEl.style.left);
  const top  = parseFloat(buttonEl.style.top);

  const expectedLeft = (tableRect.right + 0 + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;
  const expectedTop  = (tableRect.top   + 0 + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;

  eq('positionToggle: wrapper left matches anchor formula (scroll=0)',
    left, expectedLeft);
  eq('positionToggle: wrapper top matches anchor formula (scroll=0)',
    top, expectedTop);

  // Cross-check: derive the visible's bottom-right edges from the wrapper offset
  // and assert they sit at the spec-defined anchor. visible.right (document) =
  // wrapper.left + (wrapper width) - padding-right = wrapper.left + DOT + PAD.
  // visible.bottom (document) = wrapper.top + padding-top + DOT.
  const visibleRight  = left + TOGGLE_DOT_PX + TOGGLE_HIT_PAD_PX;
  const visibleBottom = top  + TOGGLE_HIT_PAD_PX + TOGGLE_DOT_PX;
  eq('positionToggle: visible.right sits TOGGLE_DOT_OVERHANG_PX past table right edge',
    visibleRight, tableRect.right + TOGGLE_DOT_OVERHANG_PX);
  eq('positionToggle: visible.bottom sits TOGGLE_DOT_OVERLAP_PX below table top edge',
    visibleBottom, tableRect.top + TOGGLE_DOT_OVERLAP_PX);
})();

// --- Anchor geometry with non-zero scroll ---
// scrollX=200, scrollY=300 should shift both axes accordingly.

(function atToggle_positionToggle_anchorGeometry_withScroll() {
  const tableRect = { top: 100, right: 500, bottom: 200, left: 100, width: 400, height: 100 };
  const table = { getBoundingClientRect() { return tableRect; } };
  const buttonEl = { style: {} };

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 200;
  global.window.scrollY = 300;

  positionToggle(table, buttonEl);

  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;

  const left = parseFloat(buttonEl.style.left);
  const top  = parseFloat(buttonEl.style.top);

  const expectedLeft = (tableRect.right + 200 + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;
  const expectedTop  = (tableRect.top   + 300 + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX;

  eq('positionToggle: wrapper left includes scrollX offset',
    left, expectedLeft);
  eq('positionToggle: wrapper top includes scrollY offset',
    top, expectedTop);
})();

// --- AC3 / AC4: the two directions of a press ---
// A press on a raw table simplifies it; a press on a simplified table resets
// it. These two ran against a plain-toggle helper that chose between the
// directions itself; the 2026-09-14 sidebar-state-removal design retired the
// helper along with the third press path it served (#241), so each direction
// is driven here through the call the surviving path makes.
// We verify the outcome on the table rather than inspecting private calls.

(function atToggle_press_onFreshTable() {
  // Use withCreateTreeWalker so roundTable can traverse cells.
  withCreateTreeWalker(function() {
    // Two-row table: row 0 is the header (excluded by default: DR_DEFAULTS.simplifyFirstRow=false),
    // row 1 has large numbers that WILL be rounded.
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    // Must have querySelectorAll on individual cells (used by roundTable → filterLinkMatches)
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    // Register a checkbox so syncSwitchForTable doesn't crash
    const input = injectToggleEntry(table);

    applySidebarRounding(table, Object.assign({}, DR_DEFAULTS, { enabled: true }));

    // After a press turning simplification on, at least one cell is simplified
    const hasRounded = table._cells.some(c => c.classList.contains('dr-ext-rounded'));
    eq('auto-table-toggle: a press on a raw table simplifies its cells (AC3)',
      hasRounded, true);
    // aria-pressed should now reflect the simplified state
    eq('auto-table-toggle: aria-pressed="true" after a press turns simplification on',
      input.getAttribute('aria-pressed'), 'true');
  });
})();

(function atToggle_press_offRestoresOriginal() {
  // Simulate a table that is already rounded: has .dr-ext-rounded cells.
  const table = makeToggleTable([{ tag: 'td', text: '8,500,000' }]);
  const cell = table._cells[0];
  cell.classList.add('dr-ext-rounded');
  DR_STORE.setTableOriginal(table, cell, { value: '8,584,629', pieces: [{ text: '8,584,629', written: '8,584,629' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');

  // The cell's innerHTML property needs to be writable
  let htmlVal = cell.innerHTML;
  Object.defineProperty(cell, 'innerHTML', {
    get() { return htmlVal; },
    set(v) { htmlVal = v; },
    configurable: true,
  });

  const input = injectToggleEntry(table);

  resetTable(table);

  // After turning simplification off: appliedFlag must be 'original' (AC4)
  eq('auto-table-toggle: a press on a simplified table sets appliedFlag=original (AC4)',
    DR_STORE.getTableAppliedFlag(table), 'original');
  // aria-pressed should be "false" — the table shows its original values
  eq('auto-table-toggle: aria-pressed="false" after a press turns simplification off',
    input.getAttribute('aria-pressed'), 'false');
})();

// --- AC5: isTableRounded sequence: false → true → false via full toggle cycle ---

(function atToggle_isTableRounded_fullCycle() {
  withCreateTreeWalker(function() {
    // Two-row table: row 0 is excluded by default (DR_DEFAULTS.simplifyFirstRow=false), row 1 has
    // large numbers that WILL be rounded so the test exercises the true → false transition.
    const table = makeToggleTable([
      [{ tag: 'td', text: 'Header' }],
      [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
    ]);
    table._cells.forEach(c => { c.querySelectorAll = () => []; });
    const input = injectToggleEntry(table);

    // 1. Initially false
    eq('auto-table-toggle: isTableRounded is false before roundTable',
      isTableRounded(table), false);

    // 2. After roundTable → true (if any cell changed)
    roundTable(table, Object.assign({}, DR_DEFAULTS));
    const afterRound = isTableRounded(table);
    // Note: roundTable may or may not mark cells depending on inputs.
    // We accept that: if it DID mark cells, it must be true; otherwise still false.
    // Either way isTableRounded must equal whether any cell has .dr-ext-rounded AND
    // drShowingOriginal is not 'true'.
    const expectedAfterRound = table.querySelector('.dr-ext-rounded') !== null
                                && table.dataset.drShowingOriginal !== 'true';
    eq('auto-table-toggle: isTableRounded after roundTable matches .dr-ext-rounded presence',
      afterRound, expectedAfterRound);

    // 3. After the reset → false
    if (table.querySelector('.dr-ext-rounded')) {
      // Set up innerHTML writability on rounded cells
      table.querySelectorAll('.dr-ext-rounded').forEach(cell => {
        if (!Object.getOwnPropertyDescriptor(cell, 'innerHTML') ||
            !Object.getOwnPropertyDescriptor(cell, 'innerHTML').set) {
          let v = cell.innerHTML;
          Object.defineProperty(cell, 'innerHTML', {
            get() { return v; }, set(x) { v = x; }, configurable: true
          });
        }
      });
      resetTable(table);
      eq('auto-table-toggle: isTableRounded is false after the reset (AC5)',
        isTableRounded(table), false);
    }
  });
})();

// --- Static analysis: all new functions are defined ---

(function atToggle_staticAnalysis() {
  eq('auto-table-toggle: isTableRounded is defined',
    typeof isTableRounded, 'function');
  eq('auto-table-toggle: syncSwitchForTable is defined',
    typeof syncSwitchForTable, 'function');
  eq('auto-table-toggle: positionToggle is defined',
    typeof positionToggle, 'function');
  eq('auto-table-toggle: createToggleForTable is defined',
    typeof createToggleForTable, 'function');
  eq('auto-table-toggle: resetTable is defined',
    typeof resetTable, 'function');
  eq('auto-table-toggle: tableToggles WeakMap is defined',
    tableToggles instanceof WeakMap, true);
  eq('auto-table-toggle: trackedTables Set is defined',
    trackedTables instanceof Set, true);
})();

// --- Regression guard: content.js declares the new infrastructure ---

(function atToggle_contentJsDeclarations() {
  // Toggle widget infrastructure lives in ui-toggle.js after the Phase 2 split;
  // scan the combined content-script source so the contract is location-agnostic.
  const src = allContentSrc;
  eq('auto-table-toggle: declares tableToggles WeakMap',
    /const\s+tableToggles\s*=\s*new\s+WeakMap/.test(src), true);
  eq('auto-table-toggle: declares trackedTables Set',
    /const\s+trackedTables\s*=\s*new\s+Set/.test(src), true);
  eq('auto-table-toggle: defines isTableRounded',
    /function\s+isTableRounded\b/.test(src), true);
  eq('auto-table-toggle: defines syncSwitchForTable',
    /function\s+syncSwitchForTable\b/.test(src), true);
  eq('auto-table-toggle: defines positionToggle',
    /function\s+positionToggle\b/.test(src), true);
  eq('auto-table-toggle: defines createToggleForTable',
    /function\s+createToggleForTable\b/.test(src), true);
  eq('auto-table-toggle: defines injectTableToggles',
    /function\s+injectTableToggles\b/.test(src), true);
  // The toggle button must use the new dr-ext-morph CSS class
  eq('auto-table-toggle: toggle uses dr-ext-morph CSS class',
    src.includes('dr-ext-morph'), true);
})();

// =============================================================================
// Sprint accessibility-pass tests
// =============================================================================

// --- accessibility AC1: aria-label on toggle button ---
// Spec (AC): the <button class="dr-ext-morph"> has an aria-label (or accessible name)
// describing its purpose (mentioning rounding).

(function accessibilityAC1_ariaLabel() {
  const createdElements = [];
  const appendedToBody = [];

  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;

  global.document.createElement = (tag) => {
    const attrs = {};
    const el = {
      _tag: tag,
      type: '',
      className: '',
      style: {},
      _children: [],
      _listeners: {},
      dataset: {},
      parentElement: null,
      textContent: '',
      classList: {
        _c: [], add(c){ if(!this._c.includes(c)) this._c.push(c); },
        remove(c){ this._c = this._c.filter(x=>x!==c); },
        contains(c){ return this._c.includes(c); },
        toggle(c, f) {
          const has = this._c.includes(c);
          const want = f === undefined ? !has : f;
          if (want && !has) this._c.push(c);
          else if (!want && has) this._c = this._c.filter(x=>x!==c);
          return want;
        },
      },
      appendChild(child) {
        this._children.push(child);
        child.parentElement = this;
        return child;
      },
      addEventListener(evt, fn) {
        if (!this._listeners[evt]) this._listeners[evt] = [];
        this._listeners[evt].push(fn);
      },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      removeAttribute(name) { delete attrs[name]; },
      contains() { return false; },
    };
    createdElements.push(el);
    return el;
  };

  global.document.body = {
    appendChild(child) {
      appendedToBody.push(child);
      child.parentElement = global.document.body;
    }
  };
  global.document.documentElement = { appendChild() {} };
  toggleStyleInjected = false;

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);
  createToggleForTable(table);

  // Restore
  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  // The button should have been appended to body
  const buttonEl = appendedToBody.find(e => e._tag === 'button');
  const ariaLabel = buttonEl ? buttonEl.getAttribute('aria-label') : null;

  eq('accessibility AC1: toggle button has an aria-label attribute',
    typeof ariaLabel === 'string' && ariaLabel.length > 0, true);

  eq('accessibility AC1: toggle button aria-label mentions rounding',
    ariaLabel ? ariaLabel.toLowerCase().includes('round') : false, true);
})();

// --- accessibility AC2: CSS contains :focus-visible with outline and !important ---
// Spec: the CSS string injected by ensureToggleStyleInjected contains a
//       :focus-visible rule with `outline` and `!important`.

(function accessibilityAC2_focusVisibleCSS() {
  const src = allContentSrc; // toggle CSS now in ui-toggle.js (Phase 2 split)

  eq('accessibility AC2: content.js CSS contains :focus-visible selector',
    src.includes(':focus-visible'), true);

  // Verify that some :focus-visible rule contains outline and !important.
  // The CSS template in content.js uses ${…} interpolation, so we search
  // for a line that contains both ':focus-visible' and 'outline' and '!important'
  // (they may be on the same line in the source, possibly spanning a template expression).
  const lines = src.split('\n');
  const focusOutlineLine = lines.find(l =>
    l.includes(':focus-visible') && l.includes('outline'));
  const focusImportantLine = lines.find(l =>
    l.includes(':focus-visible') && l.includes('!important'));

  eq('accessibility AC2: :focus-visible rule contains outline property',
    focusOutlineLine !== undefined, true);

  eq('accessibility AC2: :focus-visible rule uses !important',
    focusImportantLine !== undefined, true);
})();

// --- accessibility AC3: button click handler updates aria-pressed (mouse path) ---
// Spec (§3.4): for a <button>, Space/Enter are native. The click handler must
// update aria-pressed when pointerType is 'mouse' or ''.
// We use createToggleForTable (with DOM stubs) to get real event listeners,
// then simulate pointerdown→click on a table that has rounded cells.

(function accessibilityAC3_buttonClickTogglesState() {
  const appendedToBody = [];
  const origCreateEl = global.document.createElement;
  const origDocBody = global.document.body;
  const origDocEl = global.document.documentElement;

  global.document.createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const el = {
      _tag: tag, type: '', className: '', style: {}, _children: [], _listeners: listeners,
      dataset: {}, parentElement: null, textContent: '',
      classList: (() => {
        const c = [];
        return {
          _c: c, add(x){if(!c.includes(x))c.push(x);}, remove(x){const i=c.indexOf(x);if(i>=0)c.splice(i,1);},
          contains(x){return c.includes(x);},
          toggle(x,f){const has=c.includes(x);const want=f===undefined?!has:f;if(want&&!has)c.push(x);else if(!want&&has)c.splice(c.indexOf(x),1);return want;},
        };
      })(),
      appendChild(ch){this._children.push(ch);ch.parentElement=this;return ch;},
      addEventListener(evt,fn){if(!listeners[evt])listeners[evt]=[];listeners[evt].push(fn);},
      setAttribute(n,v){attrs[n]=v;}, getAttribute(n){return Object.prototype.hasOwnProperty.call(attrs,n)?attrs[n]:null;}, removeAttribute(n){delete attrs[n];},
      contains(){return false;},
      dispatchEvent(evt){(listeners[evt.type]||[]).forEach(fn=>fn(evt));},
    };
    return el;
  };

  global.document.body = {
    appendChild(child) { appendedToBody.push(child); child.parentElement = global.document.body; }
  };
  global.document.documentElement = { appendChild() {} };
  toggleStyleInjected = false;

  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(table);

  // Restore
  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Simulate pointerdown with mouse type
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse', stopPropagation() {} });

  // Pre-condition: the table shows rounded cells, so the press restores the
  // originals and syncSwitchForTable ends at aria-pressed="false".
  table._cells[0].classList.add('dr-ext-rounded');
  const cell = table._cells[0];
  let htmlVal = cell.innerHTML || '50000';
  Object.defineProperty(cell, 'innerHTML', {
    get(){return htmlVal;}, set(v){htmlVal=v;}, configurable: true
  });
  // Registry-backed setup (app-model-registry sprint): restoreTable reads
  // the pre-round original from DR_STORE, not a dataset attribute, so the
  // fixture must register one for the cell to be genuinely restorable — a
  // dr-ext-rounded class with no registry entry is the unrestorable case
  // (see the content-script re-injection tests), which is a different
  // scenario than the one this test means to exercise.
  DR_STORE.setTableOriginal(table, cell, { value: '50000', pieces: [{ text: '50000', written: '50000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');

  // Fire click via handlers
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  // After click: table shows originals (appliedFlag 'original' in DR_STORE), aria-pressed='false'
  eq('accessibility AC3: button click (mouse, was-rounded) sets aria-pressed="false"',
    buttonEl.getAttribute('aria-pressed'), 'false');
})();

// ---------------------------------------------------------------------------
// Sprint offscreen-hidden-table-suppression: visibility gate in positionToggle
// ---------------------------------------------------------------------------
//
// positionToggle now hides the toggle label (labelEl.style.display = 'none')
// when the table is offscreen or invisible, and shows it (labelEl.style.display = '')
// when the table is normally visible.
//
// All four tests stub window.getComputedStyle (and/or the rect) then restore
// the original before returning, so surrounding tests are unaffected.

// AC1: display:none (computed style) → labelEl.style.display === 'none'
(function visGate_displayNone() {
  const origGetComputedStyle = global.window.getComputedStyle;
  global.window.getComputedStyle = () => ({ display: 'none', visibility: 'visible' });

  const table = {
    getBoundingClientRect() { return { width: 400, height: 200, top: 100, right: 500, bottom: 300, left: 100 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  global.window.getComputedStyle = origGetComputedStyle;

  eq('visGate: display:none table → labelEl.style.display is "none"',
    labelEl.style.display, 'none');
})();

// AC2: visibility:hidden (computed style) → labelEl.style.display === 'none'
(function visGate_visibilityHidden() {
  const origGetComputedStyle = global.window.getComputedStyle;
  global.window.getComputedStyle = () => ({ display: 'block', visibility: 'hidden' });

  const table = {
    getBoundingClientRect() { return { width: 400, height: 200, top: 100, right: 500, bottom: 300, left: 100 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  global.window.getComputedStyle = origGetComputedStyle;

  eq('visGate: visibility:hidden table → labelEl.style.display is "none"',
    labelEl.style.display, 'none');
})();

// AC3: zero-area bounding rect → labelEl.style.display === 'none'
(function visGate_zeroAreaRect() {
  // No need to override getComputedStyle — default stub returns visible style.
  const table = {
    getBoundingClientRect() { return { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  eq('visGate: zero-area rect table → labelEl.style.display is "none"',
    labelEl.style.display, 'none');
})();

// AC4: normal rect + no hiding → labelEl.style.display === '' (visible)
(function visGate_normalVisible() {
  // Default getComputedStyle stub returns display:block / visibility:visible.
  const origScrollX = global.window.scrollX;
  const origScrollY = global.window.scrollY;
  global.window.scrollX = 0;
  global.window.scrollY = 0;

  const table = {
    getBoundingClientRect() { return { width: 400, height: 200, top: 100, right: 500, bottom: 300, left: 100 }; },
  };
  const labelEl = { style: {} };

  positionToggle(table, labelEl);

  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;

  eq('visGate: normal visible table → labelEl.style.display is "" (shown)',
    labelEl.style.display, '');
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
// Regression: DEFAULT_NUMERIC_PROBE must stay byte-equivalent to the old
// pre-extraction predicate (trim -> strip CLEAN_REGEX chars -> parseFloat ->
// isFinite). A prior version of this probe delegated to DR_NUMBER.toNumber,
// which uses Number() plus unicode-minus/parenthesized-negative handling and
// disagrees with parseFloat on exactly these shapes: date-only, time-only,
// and value-with-unit cells (parseFloat accepts a numeric prefix; Number does
// not), and accounting-negative cells (Number, via the parens rewrite, parses
// them; parseFloat does not). Each assertion below fails against the
// DR_NUMBER-delegating probe and passes against the restored parseFloat-based
// one — verified by running this file against the pre-fix commit.
// ---------------------------------------------------------------------------

// Date-only column: parseFloat('2024-01-15') -> 2024 (numeric prefix) -> true.
// DR_NUMBER.toNumber('2024-01-15') -> Number('2024-01-15') -> NaN -> false.
(function isDataTable_dateOnlyColumn() {
  const table = makeIsDataTable([
    ['Date',       'Owner'],
    ['2024-01-15', 'Alice'],
  ]);
  eq('isDataTable: date-only column ("2024-01-15") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// Slash-formatted date column: same parseFloat-prefix argument as above.
(function isDataTable_slashDateColumn() {
  const table = makeIsDataTable([
    ['Date',        'Owner'],
    ['15/03/2024',  'Bob'],
  ]);
  eq('isDataTable: slash date column ("15/03/2024") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// Time-only column: parseFloat('09:30') -> 9 (numeric prefix) -> true.
// DR_NUMBER.toNumber('09:30') -> Number('09:30') -> NaN -> false.
(function isDataTable_timeOnlyColumn() {
  const table = makeIsDataTable([
    ['Time',  'Event'],
    ['09:30', 'Standup'],
  ]);
  eq('isDataTable: time-only column ("09:30") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// Value-with-unit column: CLEAN_REGEX strips the space ("3.5 kg" -> "3.5kg"),
// then parseFloat('3.5kg') -> 3.5 -> true.
// DR_NUMBER.toNumber('3.5 kg') -> Number('3.5kg') -> NaN -> false.
(function isDataTable_unitSuffixColumn() {
  const table = makeIsDataTable([
    ['Weight', 'Item'],
    ['3.5 kg', 'Box'],
  ]);
  eq('isDataTable: unit-suffix column ("3.5 kg") -> true (matches old parseFloat predicate)',
    isDataTable(table), true);
})();

// All-text table: no cell parses as numeric under either probe -> false.
// (Distinct fixture from isDataTable_3x3_allText above, kept local to this
// regression block so it reads as a self-contained before/after set.)
(function isDataTable_allTextColumn() {
  const table = makeIsDataTable([
    ['Status', 'Owner'],
    ['Open',   'Alice'],
  ]);
  eq('isDataTable: all-text table -> false (no cell parses as numeric under either probe)',
    isDataTable(table), false);
})();

// Accounting-negative cell: old CLEAN_REGEX + parseFloat leaves the
// parentheses in place; parseFloat('(1,234)' -> '(1234)') -> NaN -> false.
// DR_NUMBER.toNumber rewrites "(1234)" -> "-1234" -> -1234 -> true. Verify
// against the parent branch's own behavior (git show refactor/extract-dr-number)
// before asserting: the parent's predicate also returns false here.
(function isDataTable_accountingNegativeColumn() {
  const table = makeIsDataTable([
    ['Amount',   'Item'],
    ['(1,234)',  'Refund'],
  ]);
  eq('isDataTable: accounting-negative cell ("(1,234)") -> false (matches parent-branch predicate)',
    isDataTable(table), false);
})();

// --- Sprint trim-trailing-zeros (chrome-extension): whole-number short-circuit ---

// restoreFormatting drops trailing zeros for whole-number results under 10
eq('restoreFormatting: whole number 1 from "1.04" -> "1"',
  restoreFormatting(1, '1.04'), '1');
eq('restoreFormatting: whole number 2 from "1.5" -> "2"',
  restoreFormatting(2, '1.5'), '2');
eq('restoreFormatting: 0 from "0.04" -> "0"',
  restoreFormatting(0, '0.04'), '0');
eq('restoreFormatting: negative whole number -5 from "-5.2" -> "-5"',
  restoreFormatting(-5, '-5.2'), '-5');

// Fractional results in the <10 band still keep their decimals
eq('restoreFormatting: 1.5 from "1.4" -> "1.5"',
  restoreFormatting(1.5, '1.4'), '1.5');
eq('restoreFormatting: 1.25 from "1.234" -> "1.25" (trailing zeros stripped)',
  restoreFormatting(1.25, '1.234'), '1.25');

// Trim plays nicely with format affixes
eq('restoreFormatting: whole number with percent -> "1%"',
  restoreFormatting(1, '1.04%'), '1%');
eq('restoreFormatting: whole number with currency -> "$2"',
  restoreFormatting(2, '$1.99'), '$2');
eq('restoreFormatting: whole negative in parens -> "(3)"',
  restoreFormatting(-3, '(2.85)'), '(3)');

// formatExtractedNumber trims trailing zeros for whole-number rounded results
eq('formatExtractedNumber: whole number 1 from "1.04" -> "1"',
  formatExtractedNumber(1, '1.04'), '1');
eq('formatExtractedNumber: whole number with floorDecimals=2 still trimmed',
  formatExtractedNumber(1, '1.04', 2), '1');

// =============================================================================
// Sprint date-round-to-year-display tests
// =============================================================================

// ---------------------------------------------------------------------------
// AC1: Worked-examples table
// Each row: [input, granularity, expected-year-string]
// ---------------------------------------------------------------------------
(function dateRoundWorkedExamples() {
  const cases = [
    // input              granularity  expected
    ['Jun 21, 2020',      'year',      '2020'],
    ['Jun 21, 2020',      'decade',    '2020'],
    ['Jun 21, 2020',      'century',   '2000'],
    ['Dec 21, 2020',      'year',      '2021'],
    ['Dec 21, 2020',      'decade',    '2020'],
    ['Dec 21, 2020',      'century',   '2000'],
    ['Jun 21, 2025',      'year',      '2025'],
    ['Jun 21, 2025',      'decade',    '2030'],
    ['Jun 21, 2025',      'century',   '2000'],
    ['Apr 11, 2026',      'year',      '2026'],
    ['Apr 11, 2026',      'decade',    '2030'],
    ['Apr 11, 2026',      'century',   '2000'],
    ['May 9, 2026',       'year',      '2026'],
    ['May 9, 2026',       'decade',    '2030'],
    ['May 9, 2026',       'century',   '2000'],
    ['Jun 30, 2024',      'year',      '2024'],
    ['Jun 30, 2024',      'decade',    '2020'],
    ['Jun 30, 2024',      'century',   '2000'],
    ['Jul 1, 2024',       'year',      '2025'],
    ['Jul 1, 2024',       'decade',    '2020'],
    ['Jul 1, 2024',       'century',   '2000'],
    ['1975',              'year',      '1975'],
    ['1975',              'decade',    '1980'],
    ['1975',              'century',   '2000'],
  ];

  for (const [input, gran, expected] of cases) {
    eq(`worked-example: "${input}" at ${gran} -> "${expected}"`,
      roundDateText(input, gran), expected);
  }
})();

// ---------------------------------------------------------------------------
// AC2: Shape equivalence — same logical date, different textual forms
// All forms of Jun 21, 2020 must round identically.
// ---------------------------------------------------------------------------
(function dateRoundShapeEquivalence() {
  const shapes = [
    'Jun 21, 2020',
    '2020/06/21',
    '2020-06-21',
    '2020 June 21',
    '21 June 2020',
  ];
  // Note: '06-21-2020' is an ambiguous numeric date (handled by column auto-detect,
  // not directly by roundDateText which only handles unambiguous shapes via parseDateLike).
  // It is tested end-to-end via roundTable below — a single-row column with n2=21>12
  // forces MDY → June 21 → identical rounding to the other shapes.

  for (const shape of shapes) {
    eq(`shape-equiv: "${shape}" year -> "2020"`,   roundDateText(shape, 'year'),    '2020');
    eq(`shape-equiv: "${shape}" decade -> "2020"`, roundDateText(shape, 'decade'),  '2020');
    eq(`shape-equiv: "${shape}" century -> "2000"`,roundDateText(shape, 'century'), '2000');
  }

  // End-to-end check for the ambiguous-numeric form: '06-21-2020' via roundTable.
  withCreateTreeWalker(function() {
    function runDateCell(text, gran) {
      const tbl = makeMockTable([[{ tag: 'td', text }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: gran,
      });
      return tbl.rows[0].cells[0].innerText;
    }
    eq('shape-equiv (via roundTable): "06-21-2020" year -> "2020"',    runDateCell('06-21-2020', 'year'),    '2020');
    eq('shape-equiv (via roundTable): "06-21-2020" decade -> "2020"',  runDateCell('06-21-2020', 'decade'),  '2020');
    eq('shape-equiv (via roundTable): "06-21-2020" century -> "2000"', runDateCell('06-21-2020', 'century'), '2000');
  });
})();

// ---------------------------------------------------------------------------
// AC3: Two-digit-year US dates via parseAmbiguousNumericDate + roundTable pipeline.
// We test via roundTable since roundDateText only handles unambiguous (parseDateLike) shapes.
// ---------------------------------------------------------------------------
(function dateRoundTwoDigitYear() {
  // 3/14/24 → 2024-03-14 (yy=24 < 50 → 2024). MDY forced since n2=14 > 12.
  // year granularity → 2024, decade → 2020, century → 2000.
  withCreateTreeWalker(function() {
    function twoDigitTable(cellText, gran) {
      const tbl = makeMockTable([[{ tag: 'td', text: cellText }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: gran,
      });
      return tbl.rows[0].cells[0].innerText;
    }

    // 3/14/24 → MDY forced (14 > 12) → 2024-03-14
    eq('two-digit-year: 3/14/24 year -> "2024"',   twoDigitTable('3/14/24', 'year'),    '2024');
    eq('two-digit-year: 3/14/24 decade -> "2020"', twoDigitTable('3/14/24', 'decade'),  '2020');
    eq('two-digit-year: 3/14/24 century -> "2000"',twoDigitTable('3/14/24', 'century'), '2000');

    // 3/14/75 → MDY forced (14 > 12) → 1975-03-14 (yy=75 >= 50 → 1975)
    eq('two-digit-year: 3/14/75 year -> "1975"',   twoDigitTable('3/14/75', 'year'),    '1975');
    eq('two-digit-year: 3/14/75 decade -> "1980"', twoDigitTable('3/14/75', 'decade'),  '1980');
    eq('two-digit-year: 3/14/75 century -> "2000"',twoDigitTable('3/14/75', 'century'), '2000');
  });
})();

// ---------------------------------------------------------------------------
// AC4: roundDateText returns a 4-digit year string for pure date cells and
// prefilled date objects. Test via prefilled date objects (bypassing text parsing).
// ---------------------------------------------------------------------------
(function dateRoundReturnType() {
  // Boundary: Dec 31 → fractional = year + 0.5 (month=12 >= 7)
  const decDates = [
    { year: 2020, month: 12, day: 31 },
    { year: 1975, month: 6,  day: 1  },
    { year: 2000, month: 1,  day: 1  },
    { year: 2099, month: 7,  day: 1  },
  ];
  for (const d of decDates) {
    const label = `${d.year}-${d.month}-${d.day}`;
    for (const gran of ['year', 'decade', 'century']) {
      const result = roundDateText('irrelevant', gran, d);
      eq(`roundDateText always returns string: prefilled ${label} at ${gran}`,
        typeof result === 'string' && /^\d{4}$/.test(result), true);
    }
  }
})();

// ---------------------------------------------------------------------------
// AC5: Column-level MDY/DMY auto-detect via roundTable pipeline.
// ---------------------------------------------------------------------------
(function dateRoundColumnAutoDetect() {
  withCreateTreeWalker(function() {

    // Helper: run roundTable with simplifyDates:true and return cell text array.
    function runDateTable(rowsSpec, gran) {
      const tbl = makeMockTable(rowsSpec);
      // Add querySelectorAll stub to all cells
      for (const row of tbl.rows) {
        for (const cell of row.cells) {
          cell.querySelectorAll = () => [];
        }
      }
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: gran,
      });
      return tbl.rows.map(row => row.cells.map(c => c.innerText));
    }

    // --- MDY column (discriminating) ---
    // '04/13/2022' forces MDY (n2=13 > 12). The sibling '12-03-2022' is discriminating:
    //   under MDY → Dec 3, fractional=2022.5, year rounds to 2023.
    //   under DMY → Mar 12, fractional=2022.0, year rounds to 2022.
    // If the column resolver picks MDY (as it should), the sibling rounds to 2023.
    const mdyResult = runDateTable([
      [{ tag: 'td', text: '04/13/2022' }],
      [{ tag: 'td', text: '12-03-2022' }],
    ], 'year');
    eq('MDY column: 04/13/2022 rounds to 2022', mdyResult[0][0], '2022');
    eq('MDY column: 12-03-2022 resolved as MDY (Dec 3 → year 2023, not DMY Mar 12 → 2022)',
      mdyResult[1][0], '2023');

    // --- DMY column ---
    // '13/04/2022' forces DMY (n1=13 > 12). '12-08-2022' under DMY = Aug 12 = 2022.
    // Under MDY, '12-08-2022' = Dec 8 → year rounds to 2023 (Dec → fractional=2022.5 → round → 2023).
    // Under DMY, '12-08-2022' = Aug 12 → year rounds to 2022 (Aug → fractional=2022.5 → round → 2023).
    // Hmm, let's recalculate: Aug → month=8 >= 7 → fractional=2022.5, Math.round(2022.5) = 2023.
    // And Dec → month=12 >= 7 → fractional=2022.5, same result. Both give 2023 at year granularity.
    // Better disambiguation: use a month < 7 for DMY path.
    // '12-03-2022': DMY → month=3 < 7 → fractional=2022.0 → year=2022.
    //               MDY → month=12 >= 7 → fractional=2022.5 → year=2023.
    const dmyResult = runDateTable([
      [{ tag: 'td', text: '13/04/2022' }],  // n1=13 forces DMY
      [{ tag: 'td', text: '12-03-2022' }],  // DMY: day=12, month=Mar → 2022; MDY: month=Dec → 2023
    ], 'year');
    eq('DMY column: 13/04/2022 rounds to 2022', dmyResult[0][0], '2022');
    eq('DMY column: 12-03-2022 resolved as DMY (Mar 12 → year 2022, not MDY Dec 12 → 2023)',
      dmyResult[1][0], '2022');

    // --- Ambiguous column ---
    // Column where ALL cells have both components <= 12. Cannot auto-detect → mode:'skip'.
    // Cell text must be unchanged.
    const ambigResult = runDateTable([
      [{ tag: 'td', text: '03-04-2022' }],
      [{ tag: 'td', text: '05-06-2023' }],
    ], 'year');
    eq('ambiguous column: 03-04-2022 left unchanged (mode:skip)',
      ambigResult[0][0], '03-04-2022');
    eq('ambiguous column: 05-06-2023 left unchanged (mode:skip)',
      ambigResult[1][0], '05-06-2023');
  });
})();

// ---------------------------------------------------------------------------
// AC6: Non-date strings pass through unchanged.
// ---------------------------------------------------------------------------
(function dateRoundNonDatePassthrough() {
  withCreateTreeWalker(function() {
    function runSingleCell(text) {
      const tbl = makeMockTable([[{ tag: 'td', text }]]);
      tbl.rows[0].cells[0].querySelectorAll = () => [];
      roundTable(tbl, {
        enabled: true, simplifyDates: true, simplifyTimes: false,
        simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
        simplifyMixedCells: false, simplifyFirstRow: true,
        offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
        rangeExpr: '',
        dateGranularity: 'decade',
      });
      return tbl.rows[0].cells[0].innerText;
    }

    eq('non-date passthrough: "hello" stays unchanged', runSingleCell('hello'), 'hello');
    // "14 March" has no year → isDateLike returns false → treated as a word-embedded number
    // simplifyMixedCells=false in our setup, so it skips non-numeric text.
    // Let's just verify it doesn't get the rounded class.
    const tbl = makeMockTable([[{ tag: 'td', text: '14 March' }]]);
    tbl.rows[0].cells[0].querySelectorAll = () => [];
    roundTable(tbl, {
      enabled: true, simplifyDates: true, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      simplifyMixedCells: false, simplifyFirstRow: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: '',
      dateGranularity: 'decade',
    });
    eq('non-date passthrough: "14 March" cell not rounded (no year)',
      tbl.rows[0].cells[0].classList.contains('dr-ext-rounded'), false);
  });
})();

// ---------------------------------------------------------------------------
// AC7: Bare-year no-op short-circuit — "2020" at decade granularity.
// roundDateText returns "2020", originalValue is "2020" → formattedValue === originalValue
// → roundTable skips it (no DOM rewrite, no dr-ext-rounded class).
// ---------------------------------------------------------------------------
(function dateRoundBareYearNoOp() {
  // roundDateText itself returns "2020" for both inputs (2020 at decade is 2020).
  eq('bare-year no-op: roundDateText("2020", "decade") returns "2020"',
    roundDateText('2020', 'decade'), '2020');

  // Via roundTable: the cell should NOT get the rounded class.
  withCreateTreeWalker(function() {
    const tbl = makeMockTable([[{ tag: 'td', text: '2020' }]]);
    tbl.rows[0].cells[0].querySelectorAll = () => [];
    roundTable(tbl, {
      enabled: true, simplifyDates: true, simplifyTimes: false,
      simplifyFirstColumn: true, simplifyMixedPercent: false, simplifyMixedCurrency: false,
      simplifyMixedCells: false, simplifyFirstRow: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1,
      rangeExpr: '',
      dateGranularity: 'decade',
    });
    eq('bare-year no-op: "2020" at decade not marked as rounded (short-circuit)',
      tbl.rows[0].cells[0].classList.contains('dr-ext-rounded'), false);
  });
})();

// ---------------------------------------------------------------------------
// AC8: isDateLike accepts newly added shapes.
// ---------------------------------------------------------------------------
(function dateRoundIsDateLikeNewShapes() {
  eq('isDateLike: "2020/07/21" (ISO slash) -> true',  isDateLike('2020/07/21'), true);
  eq('isDateLike: "2020 June 21" (Year Month Day) -> true', isDateLike('2020 June 21'), true);
  eq('isDateLike: "3/14/24" (two-digit year) -> true', isDateLike('3/14/24'), true);
  eq('isDateLike: "06/21/2020" (MDY slash) -> true',  isDateLike('06/21/2020'), true);
  eq('isDateLike: "21 June 2020" (DMY named) -> true', isDateLike('21 June 2020'), true);
})();

// ---------------------------------------------------------------------------
// AC9: Boundary semantics — Jun 30 rounds down, Jul 1 rounds up.
// ---------------------------------------------------------------------------
(function dateRoundBoundarySemantics() {
  // Jun 30: month=6 < 7 → fractional = 2024.0 → round → 2024 (year)
  eq('boundary: Jun 30, 2024 year -> 2024', roundDateText('Jun 30, 2024', 'year'), '2024');
  // Jul 1: month=7 >= 7 → fractional = 2024.5 → round → 2025 (year)
  eq('boundary: Jul 1, 2024 year -> 2025', roundDateText('Jul 1, 2024', 'year'), '2025');

  // Jun 30 decade: fractional=2024.0 → 2024/10=202.4 → round→202 → *10=2020
  eq('boundary: Jun 30, 2024 decade -> 2020', roundDateText('Jun 30, 2024', 'decade'), '2020');
  // Jul 1 decade: fractional=2024.5 → 2024.5/10=202.45 → round→202 → *10=2020
  eq('boundary: Jul 1, 2024 decade -> 2020', roundDateText('Jul 1, 2024', 'decade'), '2020');

  // Jun 21, 2025 decade: fractional=2025.0 → 2025/10=202.5 → round→203 (banker's rounds to 202 or 203?)
  // Math.round(202.5) = 203 in JS → 2030
  eq('boundary: Jun 21, 2025 decade -> 2030', roundDateText('Jun 21, 2025', 'decade'), '2030');
})();

// ---------------------------------------------------------------------------
// Additional: static analysis — new functions exist in content.js
// ---------------------------------------------------------------------------
(function dateRoundStaticAnalysis() {
  const src = allContentSrc; // date parsing now in parsing.js (Phase 2 split)

  eq('static: parseDateLike is defined in content.js',
    /function\s+parseDateLike\b/.test(src), true);
  eq('static: parseAmbiguousNumericDate is defined in content.js',
    /function\s+parseAmbiguousNumericDate\b/.test(src), true);
  eq('static: roundDateText uses String() conversion for year (no null return for parsed dates)',
    // The function must use String() to convert the rounded year.
    // Uses "return text" as fallback for unparseable input.
    /function roundDateText[\s\S]{0,900}String\(new Date\(/.test(src), true);
})();

