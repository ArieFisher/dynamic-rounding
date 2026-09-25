// The pillbox on each data table (ui-toggle.js).

// --- Sprint range-pulse-border: animation parameters and dispatch ---

// CSS string: capture style.textContent from ensureHighlightStyleInjected().
// We patch document.createElement to intercept the style element before injection.
(function rangePulseCssParams() {
  // Reset the module-level guard so we can trigger injection fresh.
  highlightStyleInjected = false;

  let capturedCss = null;
  const origCreate = document.createElement;
  document.createElement = (tag) => {
    const el = { textContent: null };
    if (tag === 'style') {
      Object.defineProperty(el, 'textContent', {
        set(v) { capturedCss = v; },
        get() { return capturedCss; }
      });
    }
    return el;
  };
  // Stub appendChild so the injection doesn't throw (document.head is undefined in stub).
  const origHead = document.head;
  const origDocEl = document.documentElement;
  document.documentElement = { appendChild: () => {} };

  ensureHighlightStyleInjected();

  // Restore stubs.
  document.createElement = origCreate;
  document.documentElement = origDocEl;
  // Re-set guard so later paths don't re-inject against the real (absent) DOM.
  highlightStyleInjected = true;

  eq('rangePulse CSS: animation duration is 0.6s',
    capturedCss !== null && capturedCss.includes('0.6s'), true);

  // The animation shorthand for .dr-ext-range-pulse should end with iteration-count 2.
  const animLine = capturedCss && (capturedCss.match(/animation:\s*drExtRangePulse[^;]+;/) || [])[0];
  eq('rangePulse CSS: iteration count is 2 (two cycles = ~1.2s total)',
    !!(animLine && /\s2\s*;$/.test(animLine.trim())), true);

  eq('rangePulse CSS: .dr-ext-target-flash class still present (no regression)',
    capturedCss !== null && capturedCss.includes('dr-ext-target-flash'), true);
})();

// Dispatch: flashRangePulse(table, null) must delegate to flashTargetedTable,
// which adds 'dr-ext-target-flash' to table.classList.
(function rangePulseNullRangesDispatch() {
  const classes = new Set();
  const mockTable = {
    classList: {
      remove(cls) { classes.delete(cls); },
      add(cls) { classes.add(cls); }
    },
    offsetWidth: 0,   // accessed via void table.offsetWidth in flashTargetedTable
    rows: []
  };

  flashRangePulse(mockTable, null);

  eq('rangePulse dispatch: null ranges adds dr-ext-target-flash (whole-table path)',
    classes.has('dr-ext-target-flash'), true);
})();

// Dispatch: flashRangePulse(table, ranges) with zero matching cells falls back
// to flashTargetedTable (same class added).
(function rangePulseEmptyCellsFallback() {
  const classes = new Set();
  const mockTable = {
    classList: {
      remove(cls) { classes.delete(cls); },
      add(cls) { classes.add(cls); }
    },
    offsetWidth: 0,
    rows: []  // no rows => no cells => matchedCells.length === 0 => fallback
  };

  // A valid non-null ranges array that can't match anything in an empty table.
  const ranges = [{ colMin: 0, colMax: 2, rowMin: 0, rowMax: 5 }];
  flashRangePulse(mockTable, ranges);

  eq('rangePulse dispatch: non-null ranges with no matching cells falls back to whole-table flash',
    classes.has('dr-ext-target-flash'), true);
})();

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

// =============================================================================
// Sprint expanding-toggle: new AC tests
// =============================================================================

// --- Knob travel derivation ---
// Spec (§3.5): TOGGLE_KNOB_TRAVEL_PX === TOGGLE_PILL_WIDTH_PX - TOGGLE_KNOB_PX - 2*TOGGLE_KNOB_INSET_PX === 12

(function morphAC_knobTravelDerivation() {
  eq('expanding-toggle: TOGGLE_KNOB_TRAVEL_PX equals derived formula',
    TOGGLE_KNOB_TRAVEL_PX, TOGGLE_PILL_WIDTH_PX - TOGGLE_KNOB_PX - 2 * TOGGLE_KNOB_INSET_PX);
  eq('expanding-toggle: TOGGLE_KNOB_TRAVEL_PX equals 12 (default geometry)',
    TOGGLE_KNOB_TRAVEL_PX, 12);
})();

// --- syncSwitchForTable → aria-pressed ---
// Fresh table (no .dr-ext-rounded) → aria-pressed="false"
// After marking cells → aria-pressed="true"
// With drShowingOriginal='true' → aria-pressed="false" even if cells are rounded

(function morphAC_syncSwitch_freshTable() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  const button = injectToggleEntry(table);
  syncSwitchForTable(table);
  eq('expanding-toggle: syncSwitchForTable fresh table → aria-pressed="false"',
    button.getAttribute('aria-pressed'), 'false');
})();

(function morphAC_syncSwitch_roundedTable() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  // Registry record present — see atToggle_syncSwitch_ariaTrueWhenRounded.
  DR_STORE.setTableOriginal(table, table._cells[0], { value: '1,000', pieces: [{ text: '1,000', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'simplified');
  const button = injectToggleEntry(table);
  syncSwitchForTable(table);
  eq('expanding-toggle: syncSwitchForTable rounded table → aria-pressed="true"',
    button.getAttribute('aria-pressed'), 'true');
})();

(function morphAC_syncSwitch_showingOriginal() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
  table._cells[0].classList.add('dr-ext-rounded');
  // Registry record present — see atToggle_syncSwitch_ariaTrueWhenRounded.
  DR_STORE.setTableOriginal(table, table._cells[0], { value: '1,000', pieces: [{ text: '1,000', written: '1,000' }], supRanges: null, linkFilteredIdx: null });
  DR_STORE.setTableAppliedFlag(table, 'original');
  const button = injectToggleEntry(table);
  syncSwitchForTable(table);
  eq('expanding-toggle: syncSwitchForTable appliedFlag=\'original\' (showing originals) with a rounded cell present → aria-pressed="false"',
    button.getAttribute('aria-pressed'), 'false');
})();

// --- Mouse click toggles state ---
// Spec (§3.4 + AC): pointerType 'mouse'/'': intent:toggleTable published, aria-pressed updates.
// We create a real button via createToggleForTable (with DOM stubs).

(function morphAC_mouseClick_togglesState() {
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

  // Fresh (not rounded) table — a mouse click publishes intent:toggleTable → rounds it
  const table = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(table);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Initial state: aria-pressed='false'
  eq('expanding-toggle: mouse click (before): aria-pressed is "false"',
    buttonEl.getAttribute('aria-pressed'), 'false');

  // Simulate pointerdown (mouse) → click
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  withCreateTreeWalker(function() {
    clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
  });

  // After click: should have rounded cells and aria-pressed='true'
  const hasRounded = table._cells.some(c => c.classList.contains('dr-ext-rounded'));
  eq('expanding-toggle: mouse click rounds table cells',
    hasRounded, true);
  eq('expanding-toggle: mouse click updates aria-pressed to "true"',
    buttonEl.getAttribute('aria-pressed'), 'true');
})();

// --- Touch first tap expands, does NOT toggle ---
// Spec (AC): pointerType 'touch' first tap → adds .expanded, aria-pressed unchanged

(function morphAC_touchFirstTap_expandsOnly() {
  const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);
  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Pre-condition: not expanded, aria-pressed='false'
  eq('expanding-toggle: touch first tap (before): aria-pressed is "false"',
    buttonEl.getAttribute('aria-pressed'), 'false');
  eq('expanding-toggle: touch first tap (before): not expanded',
    buttonEl.classList.contains('expanded'), false);

  // Replace setTimeout to prevent actual timer from running
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms) => 99; // no-op, return fake id
  global.clearTimeout = () => {};

  // Simulate pointerdown(touch) + click
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;

  // After first tap: expanded class added, aria-pressed unchanged
  eq('expanding-toggle: touch first tap adds .expanded class',
    buttonEl.classList.contains('expanded'), true);
  eq('expanding-toggle: touch first tap does NOT change aria-pressed',
    buttonEl.getAttribute('aria-pressed'), 'false');
})();

// --- Touch second tap toggles and refreshes expansion ---
// Spec (AC): second tap on already-expanded → publishes intent:toggleTable, updates aria-pressed

(function morphAC_touchSecondTap_togglesState() {
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

  const t = makeToggleTable([
    [{ tag: 'td', text: 'H1' }, { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);
  t._cells.forEach(c => { c.querySelectorAll = () => []; });

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Suppress timers
  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // First tap: expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  eq('expanding-toggle: touch second tap (setup): .expanded after first tap',
    buttonEl.classList.contains('expanded'), true);

  // Second tap: should toggle state
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  withCreateTreeWalker(function() {
    clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));
  });

  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;

  const hasRounded = t._cells.some(c => c.classList.contains('dr-ext-rounded'));
  eq('expanding-toggle: touch second tap rounds table cells',
    hasRounded, true);
  eq('expanding-toggle: touch second tap updates aria-pressed to "true"',
    buttonEl.getAttribute('aria-pressed'), 'true');
})();

// --- Pen pointer behaves like touch (two-tap flow) ---
// Spec (AC): pointerType 'pen' uses same expand-then-toggle path as 'touch'

(function morphAC_penPointer_behavesLikeTouch() {
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // First tap with pen → should expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'pen', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;

  eq('expanding-toggle: pen first tap adds .expanded class',
    buttonEl.classList.contains('expanded'), true);
  eq('expanding-toggle: pen first tap does NOT change aria-pressed',
    buttonEl.getAttribute('aria-pressed'), 'false');
})();

// --- Auto-collapse timer ---
// Spec (AC): after .expanded is added, PILLBOX_AUTO_COLLAPSE_MS ms later .expanded is removed.
// We fake setTimeout to capture and drain the queued callback synchronously.

(function morphAC_autoCollapse_timer() {
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Capture the scheduled timeout callback
  const pendingTimers = [];
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  global.setTimeout = (fn, ms) => { pendingTimers.push({ fn, ms }); return pendingTimers.length - 1; };
  global.clearTimeout = (id) => { if (pendingTimers[id]) pendingTimers[id].fn = null; };

  // Touch tap → expand
  buttonEl.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', stopPropagation() {} });
  const clickHandlers = buttonEl._listeners['click'] || [];
  clickHandlers.forEach(fn => fn({ stopPropagation() {}, type: 'click' }));

  // Should be expanded now
  eq('expanding-toggle: auto-collapse: .expanded after first touch tap',
    buttonEl.classList.contains('expanded'), true);

  // Drain the captured timer (simulating PILLBOX_AUTO_COLLAPSE_MS passing)
  const timer = pendingTimers[pendingTimers.length - 1];
  const capturedMs = timer ? timer.ms : -1;
  eq('expanding-toggle: auto-collapse: timer duration equals PILLBOX_AUTO_COLLAPSE_MS',
    capturedMs, PILLBOX_AUTO_COLLAPSE_MS);

  if (timer && timer.fn) timer.fn();  // fire the callback

  global.setTimeout = origSetTimeout;
  global.clearTimeout = origClearTimeout;

  eq('expanding-toggle: auto-collapse: .expanded removed after timer fires',
    buttonEl.classList.contains('expanded'), false);
})();

// --- Tap-outside collapse ---
// Spec (AC): pointerdown outside an .expanded button removes .expanded;
//            pointerdown inside preserves .expanded.
// We test via the global document pointerdown listener that createToggleForTable registers.

(function morphAC_tapOutside_collapses() {
  // We need to capture the global 'pointerdown' listener added to document.
  // Reset _globalTapCollapseAdded so createToggleForTable re-registers it on our stub.
  const origTapCollapseAdded = _globalTapCollapseAdded;
  _globalTapCollapseAdded = false;

  const docListeners = {};
  const origDocAddListener = global.document.addEventListener;
  global.document.addEventListener = (evt, fn) => {
    if (!docListeners[evt]) docListeners[evt] = [];
    docListeners[evt].push(fn);
  };

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
      contains(node){return false;},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.document.addEventListener = origDocAddListener;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');

  // Manually mark as expanded
  buttonEl.classList.add('expanded');

  // The global listener relies on document.querySelectorAll('.dr-ext-morph.expanded').
  // We need to stub that for this test.
  const origQSA = global.document.querySelectorAll;
  global.document.querySelectorAll = (sel) => {
    if (sel === '.dr-ext-morph.expanded' && buttonEl.classList.contains('expanded')) {
      return [buttonEl];
    }
    return [];
  };

  // Suppress setTimeout
  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // Fire a pointerdown on an outside target (contains() returns false → should collapse)
  const outsideTarget = { nodeType: 1 };
  const pdHandlers = docListeners['pointerdown'] || [];
  pdHandlers.forEach(fn => fn({ target: outsideTarget }));

  global.document.querySelectorAll = origQSA;
  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;
  _globalTapCollapseAdded = origTapCollapseAdded;

  eq('expanding-toggle: tap-outside collapses .expanded button',
    buttonEl.classList.contains('expanded'), false);
})();

(function morphAC_tapInside_preservesExpanded() {
  // Reset so the listener gets re-registered on our stubbed document.addEventListener
  const origTapCollapseAdded2 = _globalTapCollapseAdded;
  _globalTapCollapseAdded = false;

  const docListeners = {};
  const origDocAddListener = global.document.addEventListener;
  global.document.addEventListener = (evt, fn) => {
    if (!docListeners[evt]) docListeners[evt] = [];
    docListeners[evt].push(fn);
  };

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
      contains(node){return node === this || (this._children && this._children.includes(node));},
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

  const t = makeToggleTable([
    [{ tag: 'td', text: '50000' }, { tag: 'td', text: '100' }],
    [{ tag: 'td', text: '200' },   { tag: 'td', text: '300' }],
  ]);

  createToggleForTable(t);

  global.document.createElement = origCreateEl;
  global.document.body = origDocBody;
  global.document.documentElement = origDocEl;
  global.document.addEventListener = origDocAddListener;
  global.window.scrollX = origScrollX;
  global.window.scrollY = origScrollY;
  toggleStyleInjected = true;

  const buttonEl = appendedToBody.find(e => e._tag === 'button');
  buttonEl.classList.add('expanded');

  const origQSA = global.document.querySelectorAll;
  global.document.querySelectorAll = (sel) => {
    if (sel === '.dr-ext-morph.expanded' && buttonEl.classList.contains('expanded')) {
      return [buttonEl];
    }
    return [];
  };

  const origSetTimeout = global.setTimeout;
  global.setTimeout = () => 99;
  global.clearTimeout = () => {};

  // Fire a pointerdown with target = the button itself (contains returns true)
  const pdHandlers = docListeners['pointerdown'] || [];
  pdHandlers.forEach(fn => fn({ target: buttonEl }));

  global.document.querySelectorAll = origQSA;
  global.setTimeout = origSetTimeout;
  global.clearTimeout = clearTimeout;
  _globalTapCollapseAdded = origTapCollapseAdded2;

  eq('expanding-toggle: tap-inside preserves .expanded on button',
    buttonEl.classList.contains('expanded'), true);
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
// Sanity: isPhantomA11yTable round-trip on the embedded-table fixtures
// ---------------------------------------------------------------------------
(function pass2aria_sanity_phantomEmbedded() {
  const phantom = makePhantomEmbeddedTable();
  eq('pass2-aria sanity: isPhantomA11yTable(phantom embedded table) === true',
    isPhantomA11yTable(phantom), true);
})();

(function pass2aria_sanity_realEmbedded() {
  const real = makeRealEmbeddedTable();
  eq('pass2-aria sanity: isPhantomA11yTable(real embedded table) === false',
    isPhantomA11yTable(real), false);
})();

// ---------------------------------------------------------------------------
// AC1: ARIA grid with ONLY phantom tables → Pass 2 adds dr-ext-grid + toggle
// ---------------------------------------------------------------------------
(function pass2aria_AC1_onlyPhantomTables_getsToggle() {
  const phantom1 = makePhantomEmbeddedTable();
  const phantom2 = makePhantomEmbeddedTable();
  const grid = makeAriaGrid([phantom1, phantom2]);

  withToggleDocumentMock(function() {
    // Pass 1 sees no tables; Pass 2 sees our grid.
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid with only phantom tables gets dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), true);
  eq('pass2-aria: grid with only phantom tables gets a toggle registered',
    tableToggles.has(grid), true);
})();

// ---------------------------------------------------------------------------
// AC2: ARIA grid wrapping a REAL table → Pass 2 bows out (no toggle, no class)
// ---------------------------------------------------------------------------
(function pass2aria_AC2_realTable_pass2BowsOut() {
  const realTbl = makeRealEmbeddedTable();
  const grid    = makeAriaGrid([realTbl]);

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid wrapping a real table does NOT get dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), false);
  eq('pass2-aria: grid wrapping a real table does NOT get a toggle',
    tableToggles.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial AC2-mix: grid with phantom + one real → still bows out
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_mixedPhantomAndReal_bowsOut() {
  const phantom = makePhantomEmbeddedTable();
  const real    = makeRealEmbeddedTable();
  const grid    = makeAriaGrid([phantom, real]);

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid with phantom+real table does NOT get dr-ext-grid',
    grid.classList.contains('dr-ext-grid'), false);
  eq('pass2-aria: grid with phantom+real table does NOT get a toggle',
    tableToggles.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial: grid with NO embedded tables → Pass 2 adds class + toggle
// (no embedded tables means .some(!phantom) is false — empty array)
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_noEmbeddedTables_getsToggle() {
  const grid = makeAriaGrid([]);

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid with no embedded tables gets dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), true);
  eq('pass2-aria: grid with no embedded tables gets a toggle',
    tableToggles.has(grid), true);
})();

// ---------------------------------------------------------------------------
// Adversarial: grid already carrying dr-ext-grid is skipped (preserved guard)
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_alreadyTagged_skipped() {
  const grid = makeAriaGrid([]);
  grid.classList.add('dr-ext-grid'); // pre-tag it (style hook only, no longer read as state)
  DR_STORE.registerTable(grid); // the actual "already found" signal pass 2 now checks

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  // Already tagged → skipped → tableToggles should NOT have a new entry
  // (we can't assert .has() false on a pre-existing toggle since none was injected,
  // but we CAN verify the grid was not re-registered via trackedTables)
  eq('pass2-aria: already-tagged grid is NOT added to trackedTables again',
    tableToggles.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial: element with tagName=TABLE is skipped by the tagName guard
// (the preserved `if (el.tagName === 'TABLE') return;` fires before the new line)
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_tableTagName_skipped() {
  const phantom = makePhantomEmbeddedTable();
  // Make an ARIA-grid-matching element that is itself a <TABLE>
  const classes = new Set();
  const gridTable = {
    tagName: 'TABLE',    // triggers the early-return guard
    classList: {
      contains(c) { return classes.has(c); },
      add(c)      { classes.add(c); },
      remove(c)   { classes.delete(c); },
    },
    querySelectorAll(sel) {
      return sel === 'table' ? [phantom] : [];
    },
    getBoundingClientRect() { return { top: 0, right: 0, bottom: 0, left: 0 }; },
  };

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [gridTable];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: element with tagName=TABLE is skipped by tagName guard',
    gridTable.classList.contains('dr-ext-grid'), false);
  eq('pass2-aria: element with tagName=TABLE does not get a toggle via Pass 2',
    tableToggles.has(gridTable), false);
})();

// ---------------------------------------------------------------------------
// Sprint pillbox-bidirectional-sync: acceptance criteria
//
// AC1: Clicking the table's morph pill while sidebar is open changes
//      enabledEl.checked to match the table's new rounded/unrounded state
//      (sidebar handler updates the checkbox).
//
// AC2: Clicking the sidebar's enabled toggle still updates the table's pill
//      state (existing behaviour unchanged — regression guard).
//
// AC3: Toggling a table that is NOT lastRightClickedTable does NOT send
//      state:tableEnabledChanged (no spurious sidebar update).
//
// AC4: background.js does NOT relay state:tableEnabledChanged when sidebarTabId is null.
//
// AC5: Existing tests pass (covered by running the full suite without --bail).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC1: Clicking the table's morph pill while sidebar is open sends
//      state:tableEnabledChanged to runtime, and sidebar's onMessage handler for
//      state:tableEnabledChanged sets enabledEl.checked = request.enabled.
//
// Unit test strategy:
//   Part A — ui-toggle.js guard: verify state:tableEnabledChanged is sent when
//     the pressed table is the active one.
//   Part B — sidebar.js handler (static): verify the source includes the
//     state:tableEnabledChanged branch that sets enabledEl.checked.
//   Note: actually exercising sidebar.js in Node requires eval'ing it, which
//   demands a full sidebar DOM. We test the handler logic indirectly via Part B
//   static analysis plus the integration guard in Part A.
// ---------------------------------------------------------------------------

(function pillbox_AC1_partA_sendMessageOnActiveTable() {
  // Capture sendMessage calls.
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  // Set state: the table we create below becomes the active one.
  lastRightClickedTable = null;

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'H1' },        { tag: 'td', text: 'H2' }],
    [{ tag: 'td', text: '8,584,629' }, { tag: 'td', text: '286' }],
  ]);

  // Establish this table as the active one, so the press is an unmoved one.
  lastRightClickedTable = table;

  // Click should publish intent:toggleTable (rounding the table) then send state:tableEnabledChanged.
  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;
  // Reset global state
  lastRightClickedTable = null;

  const toggleMsg = sent.find(m => m.action === 'state:tableEnabledChanged');
  eq('AC1 part-A: state:tableEnabledChanged sent when the pressed table is the active one',
    toggleMsg !== undefined, true);
  // After click on a fresh table, it becomes rounded → enabled should be true.
  eq('AC1 part-A: state:tableEnabledChanged.enabled reflects new rounded state (true after first click)',
    toggleMsg && toggleMsg.enabled, true);
})();

(function pillbox_AC1_partB_sidebarHandlerStaticAnalysis() {
  // Verify sidebar.js source contains the state:tableEnabledChanged handler that sets enabledEl.checked.
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq("AC1 part-B: sidebar.js subscribes to 'state:tableEnabledChanged'",
    /boundTab\.subscribe\(\s*'state:tableEnabledChanged'/.test(sidebarSrc), true);
  eq('AC1 part-B: sidebar.js puts the reported value on the switch',
    sidebarSrc.includes('enabledEl.checked = enabled'), true);
  eq('AC1 part-B: sidebar.js calls updateDisabledState() after setting checked',
    sidebarSrc.includes('updateDisabledState()'), true);
})();

// ---------------------------------------------------------------------------
// AC2: Clicking the sidebar's enabled toggle still updates the table's pill
//      state (regression guard — existing path unchanged).
//
// The sidebar-to-table path goes through content.js's request:applySettings
// message handler. We test: (a) static guard the handler exists, (b) dynamic
// guard that a press still takes a table through the full round trip.
// ---------------------------------------------------------------------------

(function pillbox_AC2_sidebarToTablePath_regression() {
  // Static guard: content.js must still contain the request:applySettings
  // message handler that triggers rounding when the sidebar changes settings.
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('AC2 regression: source file content.js present in manifest', false, true);
    return;
  }
  eq('AC2 regression: content.js still handles request:applySettings message',
    contentSrc.includes('request:applySettings'), true);

  // Static guard: sidebar.js must still have enabledEl wired up.
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq('AC2 regression: sidebar.js still references enabledEl',
    sidebarSrc.includes('enabledEl'), true);

  // Dynamic guard: a press still takes a table on and back off. This ran
  // against a plain-toggle helper until the 2026-09-14 sidebar-state-removal
  // design retired it (#241); the press itself is the path now, so the intent
  // drives it. DR_DEFAULTS excludes row 0 (firstRow) and col 0 (firstColumn),
  // so only [row1, col1] is processed. Use 12,345, which rounds to 10,000.
  const table = makeToggleTable([
    [{ tag: 'td', text: 'Label' }, { tag: 'td', text: 'Values' }],
    [{ tag: 'td', text: 'Row' },   { tag: 'td', text: '12,345' }],
  ]);
  table._cells.forEach(c => { c.querySelectorAll = () => []; });
  injectToggleEntry(table);

  const savedSelected = DR_STORE.getSelectedTable();
  const savedSettings = DR_STORE.getSettings();
  try {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(Object.assign({}, DR_DEFAULTS, { enabled: false }));
    DR_STORE.setSelectedTable(table);

    const wasRounded = isTableRounded(table);
    withCreateTreeWalker(function() { DR_BUS.publish('intent:toggleTable', { table }); });
    const isNowRounded = isTableRounded(table);

    eq('AC2 regression: a press takes a raw table to simplified',
      !wasRounded && isNowRounded, true);

    withCreateTreeWalker(function() { DR_BUS.publish('intent:toggleTable', { table }); });
    eq('AC2 regression: a second press takes it back to its original values',
      isTableRounded(table), false);
  } finally {
    DR_STORE.setSelectedTable(null);
    DR_STORE.setSettings(savedSettings);
    DR_STORE.setSelectedTable(savedSelected);
  }
})();

// ---------------------------------------------------------------------------
// AC3: Guard branching on lastRightClickedTable.
//
// SPEC says: "Toggling a table that is NOT lastRightClickedTable does not send
// state:tableEnabledChanged (no spurious sidebar update)."
//
// IMPLEMENTATION BEHAVIOUR (found by adversarial test):
// When table !== lastRightClickedTable, the click handler first reassigns
// `lastRightClickedTable = table` (and sends state:tableSwitched), then
// the state:tableEnabledChanged guard re-checks — and now `table === lastRightClickedTable`
// is TRUE, so state:tableEnabledChanged IS sent.
//
// This is a gap between the spec (AC3) and the implementation. The test below
// documents the ACTUAL implementation behaviour so the reviewer can decide
// whether the spec or the code is correct.
// ---------------------------------------------------------------------------

(function pillbox_AC3_wrongTable_reassignsAndSendsState() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };


  const { table: tableA, buttonEl: buttonA } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '1,000,000' }, { tag: 'td', text: '500' }],
  ]);
  const { table: tableB } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '2,000,000' }, { tag: 'td', text: '300' }],
  ]);

  // lastRightClickedTable is tableB; we click tableA's button.
  lastRightClickedTable = tableB;

  fireMouseClick(buttonA);

  const switchMsgs  = sent.filter(m => m.action === 'state:tableSwitched');
  const toggleMsgs  = sent.filter(m => m.action === 'state:tableEnabledChanged');
  const lrc = lastRightClickedTable;

  global.chrome.runtime.sendMessage = origSend;
  lastRightClickedTable = null;

  // Implementation reassigns lastRightClickedTable to the clicked table.
  eq('AC3 impl: clicking non-lastRightClickedTable reassigns lastRightClickedTable',
    lrc === tableA, true);

  // Implementation sends state:tableSwitched for the table switch.
  eq('AC3 impl: clicking non-lastRightClickedTable sends state:tableSwitched',
    switchMsgs.length >= 1, true);

  // The AC3 spec ("toggling a non-selected table sends no state:tableEnabledChanged")
  // is satisfied since issue #251's sync-on-switch: the switch path applies
  // the model to the new table and returns before the same-table
  // state:tableEnabledChanged send, and the panel redraws from the model pull that
  // state:tableSwitched triggers instead.
  eq('AC3: clicking non-lastRightClickedTable sends NO state:tableEnabledChanged (panel redraws from the model pull)',
    toggleMsgs.length, 0);
})();

// AC3 guard that DOES hold: when lastRightClickedTable is null,
// the early-exit prevents state:tableEnabledChanged from being sent.
(function pillbox_AC3_noLastRightClicked_noMessage() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  lastRightClickedTable = null; // explicitly null

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '200' }],
  ]);

  // lastRightClickedTable remains null; guard `lastRightClickedTable &&` prevents send.
  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;
  lastRightClickedTable = null;

  const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
  eq('AC3 null-guard: null lastRightClickedTable means state:tableEnabledChanged is NOT sent',
    toggleMsgs.length, 0);
})();

// AC3 corollary: when lastRightClickedTable is null (no table right-clicked),
// clicking any morph pill also does NOT send state:tableEnabledChanged.
(function pillbox_AC3_noLastRightClicked_noMessage_corollary() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  lastRightClickedTable = null; // explicitly null

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '5,000,000' }, { tag: 'td', text: '200' }],
  ]);

  // lastRightClickedTable remains null; guard `lastRightClickedTable &&` prevents send.
  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;

  const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
  eq('AC3 corollary: null lastRightClickedTable means state:tableEnabledChanged is NOT sent',
    toggleMsgs.length, 0);
})();

// AC3 corollary 2: a press on the active table publishes the settings
// record's new value, whatever the sidebar is doing. Nothing here reads that.
(function pillbox_AC3_sidebarClosed_noMessage() {
  const sent = [];
  const origSend = global.chrome.runtime.sendMessage;
  global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };

  const { table, buttonEl } = makeRealToggleButton([
    [{ tag: 'td', text: 'ColA' },      { tag: 'td', text: 'ColB' }],
    [{ tag: 'td', text: '3,000,000' }, { tag: 'td', text: '100' }],
  ]);
  lastRightClickedTable = table; // same table, but sidebar is closed

  fireMouseClick(buttonEl);

  global.chrome.runtime.sendMessage = origSend;
  lastRightClickedTable = null;

  const toggleMsgs = sent.filter(m => m.action === 'state:tableEnabledChanged');
  // Contract moved with the panel-state decoupling (issue #272 family): a
  // toggle on the CONNECTED table writes the record and reports it even with
  // the sidebar closed — the controller no longer reads panel visibility.
  // "No spurious sidebar update" still holds because a closed sidebar has no
  // page to receive the message; background additionally gates its relay on
  // sidebarTabId (AC4 below).
  eq('AC3 corollary 2: a press on the active table publishes the settings record once (a closed sidebar has no page to receive it)',
    toggleMsgs.length, 1);
})();

// Sprint table-contextmenu-activation
// ---------------------------------------------------------------------------
// AC1: Right-clicking a table causes flashTargetedTable to run on that table.
// AC2: state:tableActivated onMessage in sidebar.js calls flashSidebarContainer.
// AC3: Right-clicking a non-table element produces NO flash and NO state:tableActivated send.
// AC4: background.js does NOT relay state:tableActivated when sidebarTabId is null.
// ---------------------------------------------------------------------------
//
// Runtime note: the main eval() above registered document.addEventListener with
// the no-op stub, so the contextmenu handler is not capturable from the
// already-evaluated code.  ACs 1 and 3 are therefore verified in two layers:
//   (a) live runtime: call flashTargetedTable() directly and assert its effect
//       (it is in global scope after the eval), confirming that the mechanism
//       the handler uses actually works.
//   (b) source-level: regex-assert that the contextmenu handler in content.js
//       correctly calls flashTargetedTable(table) inside the `if (table)` guard
//       and does NOT call it when there is no table.
// ACs 2 and 4 are pure source-level (sidebar.js / background.js have no eval
// path in this harness).
//
// Additionally, a second eval with a capturing stub is used to exercise the
// contextmenu handler end-to-end for ACs 1 and 3.
// ---------------------------------------------------------------------------

(function tableContextmenuActivation_sourceLevel() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('table-activation source: source file content.js present in manifest', false, true);
    return;
  }
  const bgSrc      = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // AC1 (source): contextmenu handler calls flashTargetedTable(table) inside
  // the `if (found)` guard. Sprint extract-dr-table: findTargetTable now
  // reports { handle, isNew } instead of the table itself, so the handler
  // guards on `found` and derives `table` from markAndToggleIfNewGrid(found)
  // before flashing it.
  // Pattern: `if (found) { ... flashTargetedTable(table) ...` within the handler.
  eq('table-activation AC1 source: contextmenu handler calls flashTargetedTable(table)',
    /if\s*\(\s*found\s*\)[\s\S]{0,300}flashTargetedTable\(\s*table\s*\)/.test(contentSrc),
    true);

  // AC1 (source): the call to flashTargetedTable is inside the `if (found)` block
  // — it cannot appear BEFORE the guard.
  // We verify that flashTargetedTable does NOT appear before the first `if (found)`.
  const contextmenuMatch = contentSrc.match(/document\.addEventListener\s*\(\s*['"]contextmenu['"][\s\S]*?\}\s*,\s*true\s*\)/);
  const handlerSrc = contextmenuMatch ? contextmenuMatch[0] : '';
  const flashIndex = handlerSrc.indexOf('flashTargetedTable');
  const guardIndex = handlerSrc.indexOf('if (found)');
  eq('table-activation AC1 source: flashTargetedTable appears after if(found) guard in handler',
    flashIndex !== -1 && guardIndex !== -1 && flashIndex > guardIndex,
    true);

  // AC3 (source): state:tableActivated sendMessage is inside the `if (found)` block,
  // meaning a non-table right-click cannot trigger it.
  const sendMsgIndex = handlerSrc.indexOf('state:tableActivated');
  eq('table-activation AC3 source: state:tableActivated send is inside if(found) guard',
    sendMsgIndex !== -1 && sendMsgIndex > guardIndex,
    true);

  // AC2 (source): sidebar.js state:tableActivated handler calls flashSidebarContainer().
  eq('table-activation AC2 source: sidebar.js state:tableActivated handler calls flashSidebarContainer()',
    /state:tableActivated[\s\S]{0,120}flashSidebarContainer\s*\(\s*\)/.test(sidebarSrc),
    true);

  // AC2 (source): flashSidebarContainer adds the dr-sidebar-flash class to document.body.
  eq('table-activation AC2 source: flashSidebarContainer adds dr-sidebar-flash class',
    /flashSidebarContainer[\s\S]{0,300}classList\.add\s*\(\s*SIDEBAR_FLASH_CLASS\s*\)/.test(sidebarSrc),
    true);

  // AC4 (source): the worker neither publishes nor subscribes to the activation
  // report. The sidebar receives it straight from the content script over the
  // broadcast carrier, so the old relay only ever delivered it to a content
  // script with no handler. Runtime coverage lives in backgroundMessageRouting.
  eq('table-activation AC4 source: the worker does not publish the activation report',
    /publish\(\s*'state:tableActivated'/.test(bgSrc), false);
  eq('table-activation AC4 source: the worker does not subscribe to it either',
    /subscribe\(\s*'state:tableActivated'/.test(bgSrc), false);

  // AC4 (source): content.js reaches the sidebar directly, without the worker.
  // The topic's route is what decides that, so the route is the thing to pin.
  eq('table-activation AC4 source: content.js publishes the activation report',
    /DR_BUS\.publish\(\s*'state:tableActivated'/.test(contentSrc), true);
  eq('table-activation AC4 source: and its route reaches every extension page, the sidebar included',
    DR_BUS.TOPICS['state:tableActivated'].route, 'extension-pages');
})();

// ---------------------------------------------------------------------------
// AC1 + AC3 runtime: re-eval with a capturing document.addEventListener stub
// so the contextmenu handler can be invoked directly.
// ---------------------------------------------------------------------------
(function tableContextmenuActivation_runtime() {
  let capturedHandler = null;
  const captureDoc = {
    addEventListener(type, handler) {
      if (type === 'contextmenu') capturedHandler = handler;
    },
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };

  // Track calls to chrome.runtime.sendMessage.
  const sentMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage(msg) { sentMessages.push(msg); },
    },
  };

  // Run a fresh isolated eval of the content scripts with capturing stubs.
  // We shadow global.document and global.chrome temporarily so the module-level
  // registration picks them up.  We restore them AFTER the handler has been
  // exercised, because the handler references global.chrome at call time (not
  // via a closure snapshot), so the stubs must remain active during the call.
  const savedDoc    = global.document;
  const savedChrome = global.chrome;
  global.document = captureDoc;
  global.chrome   = captureChrome;

  try {
    // Eval content scripts; the contextmenu listener is registered against captureDoc.
    // contentScriptBundle is already the manifest-order concatenation of all
    // content scripts (see the bootstrap section above).
    eval(contentScriptBundle);

    eq('table-activation runtime: contextmenu handler was captured',
      typeof capturedHandler, 'function');

    if (typeof capturedHandler !== 'function') {
      eq('table-activation AC1 runtime: handler capture required (skipped)', false, true);
      eq('table-activation AC3 runtime: handler capture required (skipped)', false, true);
      return;
    }

    // --- AC1: right-clicking a table flashes that table AND sends state:tableActivated ---
    const flashedClasses = [];
    const mockTable = {
      tagName: 'TABLE',
      classList: {
        remove(cls) { },
        add(cls) { flashedClasses.push(cls); },
        contains() { return false; },
      },
      get offsetWidth() { return 0; },
      rows: [],
      dataset: {},
      // findTargetTable uses el.closest('table') (lowercase) to find the table ancestor.
      closest(sel) { return sel === 'table' ? this : null; },
      matches(sel) { return false; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    sentMessages.length = 0;
    capturedHandler({ target: mockTable });

    eq('table-activation AC1 runtime: flashTargetedTable adds dr-ext-target-flash to the table',
      flashedClasses.includes('dr-ext-target-flash'),
      true);

    eq('table-activation AC1 runtime: state:tableActivated sent when right-clicking a table',
      sentMessages.some(m => m.action === 'state:tableActivated'),
      true);

    // --- AC3: right-clicking a non-table element — no flash, no state:tableActivated ---
    const nonTableTarget = {
      tagName: 'SPAN',
      classList: { contains() { return false; } },
      closest(sel) { return null; },
      matches(sel) { return false; },
      parentElement: null,
    };
    sentMessages.length = 0;
    capturedHandler({ target: nonTableTarget });

    eq('table-activation AC3 runtime: no state:tableActivated sent when right-clicking non-table',
      sentMessages.some(m => m.action === 'state:tableActivated'),
      false);

  } finally {
    // Restore globals after all handler calls are done.
    global.document = savedDoc;
    global.chrome   = savedChrome;
  }
})();

// ---------------------------------------------------------------------------
// Sprint extract-dr-table (adversarial hardening): end-to-end double-invocation
// coverage through the REAL captured content.js listeners — not a direct call
// to markAndToggleIfNewGrid with a hand-built {handle, isNew} object (that is
// already covered above, but only exercises the wrapper in isolation).
//
// Before this sprint, findTargetTable itself wrote the dr-ext-grid marker
// inline, so a table seen twice never grew a second widget. That guard now
// lives across two calls (findTargetTable reports isNew; the caller's
// markAndToggleIfNewGrid marks+builds only when isNew). This test proves the
// split still reproduces the old guarantee end-to-end: firing the actual
// captured 'contextmenu' listener twice on the same never-before-seen grid,
// and then firing the actual captured 'intent:menuClicked' onMessage listener
// against that same target, builds exactly one toggle widget.
// ---------------------------------------------------------------------------
(function doubleInvocation_contextmenuAndMenuClicked_noDuplicateWidget() {
  // A minimal div-based "grid" using the same ARIA-free, querySelectorAll-less
  // fallback shape GridAdapter already supports (repetitive children): no
  // real Text nodes, so GridAdapter's applyPatches() finds nothing to patch and
  // safely no-ops. This fixture only needs to prove marker/widget bookkeeping,
  // not actual cell rewriting (covered elsewhere).
  function makeCell(text) { return { nodeType: 1, textContent: text, children: [] }; }
  function makeRow(texts) { return { nodeType: 1, className: 'row', children: texts.map(makeCell) }; }
  const rows = [
    makeRow(['A', '100']), makeRow(['B', '200']), makeRow(['C', '300']),
    makeRow(['D', '400']), makeRow(['E', '500']),
  ];
  const gridClassList = (() => {
    const c = [];
    return {
      _c: c,
      add(x) { if (!c.includes(x)) c.push(x); },
      remove(x) { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
      contains(x) { return c.includes(x); },
    };
  })();
  const gridEl = {
    nodeType: 1, tagName: 'DIV', className: 'grid-wrapper', children: rows,
    classList: gridClassList, parentElement: null, parentNode: null,
    // applySidebarRounding calls table.querySelector(...) directly, with no `&&`
    // guard, so this must exist (returning "not already rounded"), and
    // syncSwitchForTable's lock check scans querySelectorAll the same way
    // (returning "no rounded cells").
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 }; },
  };
  const clickTarget = {
    nodeType: 1, tagName: 'DIV', parentElement: gridEl, parentNode: gridEl,
    closest(sel) { return null; }, // first right-click: no <table>/.dr-ext-grid ancestor yet
  };

  let buttonCreateCount = 0;
  function mockCreateElement(tag) {
    if (tag === 'button') {
      buttonCreateCount++;
      return {
        type: '', className: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
        addEventListener() {}, appendChild() {}, parentElement: null,
      };
    }
    return { className: '', style: {}, textContent: '', appendChild() {} };
  }

  let contextmenuHandler = null;
  // Chrome hands an arriving message to every registered listener. The bus
  // registers one and content.js keeps one for the requests, so a stub that
  // held only the last registration would drop the bus's.
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
  // findTargetTable's walk-up (case 3) calls looksLikeGrid, which reads layout
  // via the bare `getComputedStyle` global (not the window.getComputedStyle
  // stub set up once at the top of this file). Provide a flex display so the
  // fixture clears looksLikeGrid's layout gate.
  global.getComputedStyle = () => ({ display: 'flex' });

  try {
    eval(contentScriptBundle);

    eq('double-invocation: contextmenu handler was captured', typeof contextmenuHandler, 'function');
    eq('double-invocation: the bus registered its message listener', messageListeners.length, 1);
    if (typeof contextmenuHandler !== 'function' || messageListeners.length === 0) return;

    // --- First right-click: new grid discovered via walk-up -> marked + widget built ---
    contextmenuHandler({ target: clickTarget });

    eq('double-invocation: first contextmenu marks the grid with dr-ext-grid',
      gridEl.classList.contains('dr-ext-grid'), true);
    eq('double-invocation: first contextmenu builds exactly one toggle widget',
      buttonCreateCount, 1);

    // --- Second right-click on the SAME target: findTargetTable now resolves
    // this grid via case 2 (closest('.dr-ext-grid')), since it is already
    // marked -- the replacement for the old inline-write re-entry guard. ---
    clickTarget.closest = function(sel) { return sel === '.dr-ext-grid' ? gridEl : null; };
    contextmenuHandler({ target: clickTarget });

    eq('double-invocation: second contextmenu on the same grid builds NO second widget',
      buttonCreateCount, 1);

    // --- intent:menuClicked dispatch against the same last-right-clicked element:
    // must reuse the existing widget too, not build another. ---
    const beforeMenuClick = sentMessages.length;
    fireMessage({ action: 'intent:menuClicked' });

    eq('double-invocation: intent:menuClicked on an already-marked grid builds NO widget',
      buttonCreateCount, 1);
    // Exact sequence, not presence. The right-click above CONNECTED this
    // grid, and the panel-state decoupling (issue #272 family) makes a
    // toggle on the connected table take the record path with the sidebar
    // closed too: state:applyOk from the apply, state:rangeOk from the round, then the
    // record report. No intent:updateMenuLabel here only because this minimal
    // grid's querySelector always returns null, so the enabled branch's
    // conditional send is skipped — a fixture artifact, not contract.
    eq('double-invocation: a sidebar-closed intent:menuClicked on the connected grid takes the record path',
      sentMessages.slice(beforeMenuClick).map((m) => m.action),
      ['state:applyOk', 'state:rangeOk', 'state:tableEnabledChanged']);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.getComputedStyle = savedGCS;
  }
})();

// ---------------------------------------------------------------------------
// Sprint right-click-registers (controller level): the right-click handler
// registers what the new route resolves and makes it active.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.5 and the
// right-click-registers block in §5; decision D1.
// ---------------------------------------------------------------------------
//
// The resolver half of these criteria sits with the findTargetTable tests
// further up this file. "Registers" and "makes it active" are controller
// facts, so they run through the real captured contextmenu listener against a
// fresh evaluation of the content scripts, and read that evaluation's own
// application model and pillbox bookkeeping.
//
// The MutationObserver stub is capturing rather than no-op so the observer
// counts around one right-click are readable: this branch carries no pending
// table and no subtree observer, and the criterion is that the route needs
// neither.

// --- AC1: a right-click in the scrolling pane registers it and makes it active ---

(function rightClickRegisters_AC1_runtime_scrollingPaneRegistersAndBecomesActive() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click AC1 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    eq('right-click AC1 runtime: no scan registered the nest before the click',
      ctx.store.getRegisteredTables().length, 0);

    ctx.contextmenuHandler({ target: grid.scrollRowEls[2].children[1] });

    eq('right-click AC1 runtime: the scrolling pane enters the registry',
      ctx.store.hasTable(grid.scrollPaneEl), true);
    eq('right-click AC1 runtime: the scrolling pane becomes the active table',
      ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
    eq('right-click AC1 runtime: the registry holds the scrolling pane alone',
      ctx.store.getRegisteredTables().map((el) => el === grid.scrollPaneEl), [true]);
    eq('right-click AC1 runtime: the scrolling pane carries a pillbox',
      ctx.tableToggles.has(grid.scrollPaneEl), true);
    eq('right-click AC1 runtime: the pinned pane carries no pillbox',
      ctx.tableToggles.has(grid.pinnedPaneEl), false);
    eq('right-click AC1 runtime: the wrapper carries no pillbox',
      ctx.tableToggles.has(grid.wrapperEl), false);
    eq('right-click AC1 runtime: the grid marker class lands on the scrolling pane alone',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
        .map((el) => el.classList.contains('dr-ext-grid')), [false, false, true]);
    eq('right-click AC1 runtime: the click reports the table as activated',
      ctx.sentMessages.some((m) => m.action === 'state:tableActivated'), true);
  });
})();

// --- AC1: a right-click on the nest's own layers registers the scrolling pane ---

(function rightClickRegisters_AC1_runtime_aClickOnAPlainLayerRegistersTheScrollingPane() {
  withRightClickSandbox(function (ctx) {
    const plain = makeDatabaseQueryGrid({ plainWrapper: true });

    eq('right-click AC1 runtime: the contextmenu handler was captured (plain layer)',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: plain.paneParentEl });

    eq('right-click AC1 runtime: a click on the plain layer between the panes registers the scrolling pane',
      ctx.store.hasTable(plain.scrollPaneEl), true);
    eq('right-click AC1 runtime: that click makes the scrolling pane active',
      ctx.store.getSelectedTable() === plain.scrollPaneEl, true);
    eq('right-click AC1 runtime: that click puts a pillbox on the scrolling pane',
      ctx.tableToggles.has(plain.scrollPaneEl), true);
    eq('right-click AC1 runtime: that click puts no pillbox on the plain layer or the wrapper',
      [plain.paneParentEl, plain.wrapperEl].map((el) => ctx.tableToggles.has(el)), [false, false]);
  });
})();

// --- AC2: a right-click in the row-number gutter registers the scrolling pane ---

(function rightClickRegisters_AC2_runtime_gutterRegistersTheScrollingPane() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click AC2 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: grid.pinnedRowEls[0].children[0] });

    eq('right-click AC2 runtime: a click in the row-number gutter registers the scrolling pane',
      ctx.store.hasTable(grid.scrollPaneEl), true);
    eq('right-click AC2 runtime: the scrolling pane becomes the active table',
      ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
    eq('right-click AC2 runtime: the pinned pane stays out of the registry',
      ctx.store.hasTable(grid.pinnedPaneEl), false);
    eq('right-click AC2 runtime: the wrapper stays out of the registry',
      ctx.store.hasTable(grid.wrapperEl), false);
    eq('right-click AC2 runtime: the scrolling pane carries a pillbox',
      ctx.tableToggles.has(grid.scrollPaneEl), true);
    eq('right-click AC2 runtime: the pinned pane carries no pillbox',
      ctx.tableToggles.has(grid.pinnedPaneEl), false);
    eq('right-click AC2 runtime: the wrapper carries no pillbox',
      ctx.tableToggles.has(grid.wrapperEl), false);
  });
})();

// --- AC3: a role-bearing element that fails the data test registers nothing ---

(function rightClickRegisters_AC3_runtime_aFailedDataTestRegistersNothing() {
  withRightClickSandbox(function (ctx) {
    const oneCell = makeRoleBearingNest([makeDgRow(0, ['17'])]);
    const noNumber = makeRoleBearingNest([
      makeDgRow(0, ['north', 'alpha']),
      makeDgRow(1, ['south', 'bravo']),
    ]);

    eq('right-click AC3 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: oneCell.children[0].children[0] });

    eq('right-click AC3 runtime: a click in the one-row-one-cell element registers nothing',
      ctx.store.getRegisteredTables().length, 0);
    eq('right-click AC3 runtime: a click in the one-row-one-cell element leaves no active table',
      ctx.store.getSelectedTable(), null);
    eq('right-click AC3 runtime: the one-row-one-cell element gets no pillbox',
      ctx.tableToggles.has(oneCell), false);

    ctx.contextmenuHandler({ target: noNumber.children[0].children[0] });

    eq('right-click AC3 runtime: a click in the two-rows-no-number element registers nothing',
      ctx.store.getRegisteredTables().length, 0);
    eq('right-click AC3 runtime: a click in the two-rows-no-number element leaves no active table',
      ctx.store.getSelectedTable(), null);
    eq('right-click AC3 runtime: the two-rows-no-number element gets no pillbox',
      ctx.tableToggles.has(noNumber), false);
    eq('right-click AC3 runtime: neither click reports a table as activated',
      ctx.sentMessages.some((m) => m.action === 'state:tableActivated'), false);
  });
})();

// --- AC5: the route needs no pending observer ---

(function rightClickRegisters_AC5_runtime_theRouteInstallsNoObserver() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click AC5 runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    // The content scripts build one observer at load, over the document body,
    // for removed subtrees. Everything after this line is the right-click.
    const observersAtLoad = ctx.constructedObservers.length;
    const observeCallsAtLoad = ctx.observeCalls.length;

    ctx.contextmenuHandler({ target: grid.pinnedRowEls[1].children[0] });

    eq('right-click AC5 runtime: the resolution and registration construct no observer',
      ctx.constructedObservers.length - observersAtLoad, 0);
    eq('right-click AC5 runtime: the resolution and registration call observe no times',
      ctx.observeCalls.length - observeCallsAtLoad, 0);
    eq('right-click AC5 runtime: no observer watches any element of the nest',
      ctx.observeCalls.some((call) =>
        call.target === grid.wrapperEl ||
        call.target === grid.pinnedPaneEl ||
        call.target === grid.scrollPaneEl), false);
    eq('right-click AC5 runtime: the registration still happened without one',
      ctx.store.hasTable(grid.scrollPaneEl) &&
        ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
  });
})();

// --- Adversarial: a second right-click in the same nest adds no second entry ---

(function rightClickRegisters_runtime_aSecondClickAddsNoSecondRegistration() {
  withRightClickSandbox(function (ctx) {
    const grid = makeDatabaseQueryGrid();

    eq('right-click runtime: the contextmenu handler was captured',
      typeof ctx.contextmenuHandler, 'function');
    if (typeof ctx.contextmenuHandler !== 'function') return;

    ctx.contextmenuHandler({ target: grid.scrollRowEls[0].children[1] });
    const afterFirst = ctx.store.getRegisteredTables().length;
    ctx.contextmenuHandler({ target: grid.scrollRowEls[4].children[2] });

    eq('right-click runtime: the first click registers one table', afterFirst, 1);
    eq('right-click runtime: a second click in the registered pane adds no entry',
      ctx.store.getRegisteredTables().length, 1);
    eq('right-click runtime: the active table stays the scrolling pane',
      ctx.store.getSelectedTable() === grid.scrollPaneEl, true);
  });
})();

// AC1 (live): flashTargetedTable (already in global scope from the main eval)
// adds 'dr-ext-target-flash' to the passed table's classList.
(function tableContextmenuActivation_flashFn() {
  const addedClasses = [];
  const mockTable = {
    classList: {
      remove() {},
      add(cls) { addedClasses.push(cls); },
    },
    get offsetWidth() { return 0; },
  };

  flashTargetedTable(mockTable);

  eq('table-activation AC1 live: flashTargetedTable adds dr-ext-target-flash class',
    addedClasses.includes('dr-ext-target-flash'),
    true);
})();

// ---------------------------------------------------------------------------
// Sprint grid-first-row-literal: the range pulse numbers rows the same way
// the engine gates them — by literal row number — so on a rowgroup grid the
// pulse frames the rows the engine actually touches, not the rows one slot
// below them.
// ---------------------------------------------------------------------------
(function gridLiteralNumbering_rangePulseFramesEngineRows() {
  // Table-10 shape: header row outside the rowgroup, two data rows inside.
  // The data rows are literal rows 2 and 3 (indices 1 and 2).
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1482391'], ['South', '918554']],
    null
  );

  // Distinct rects per data row so the overlay geometry proves WHICH row
  // matched: first data row at 0–20, second at 20–40.
  const rowRects = [
    { top: 0,  left: 0, right: 200, bottom: 20 },
    { top: 20, left: 0, right: 200, bottom: 40 },
  ];
  g.dataRowEls.forEach(function(rowEl, i) {
    rowEl.children.forEach(function(cell) {
      cell.getBoundingClientRect = function() { return rowRects[i]; };
    });
  });

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

  // Range naming literal row 2 only (index 1) — the first data row, the one
  // the engine rounds first under the shipped defaults.
  flashRangePulse(g.wrapperEl, [{ rowMin: 1, rowMax: 1, colMin: 0, colMax: 1 }]);

  global.document.createElement = origCreateElement;
  global.document.body = origBody;
  global.setTimeout = origSetTimeout;

  eq('range-pulse literal: the overlay frames the FIRST data row (literal row 2), matching the engine',
    overlay && { top: overlay.style.top, height: overlay.style.height },
    { top: '0px', height: '20px' });
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
