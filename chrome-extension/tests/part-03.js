// ---------------------------------------------------------------------------
// Sprint half-step-floor-chrome: Features 1 (sign-aware half-step),
// 2 (value-OoM floor), 3 (X_FLOOR_THRESHOLD-gated x-floor)
// ---------------------------------------------------------------------------
(function halfStepFloorGrid() {
  // 27-cell grid: {87M, 47M, 17M} x {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}
  const grid = [
    { v: 87054321, expected: { '2': 10000000, '1.5': 100000000, '1': 100000000,
      '0.5': 100000000, '0': 90000000, '-0.5': 85000000, '-1': 87000000,
      '-1.5': 87000000, '-2': 87100000 } },
    { v: 47054321, expected: { '2': 10000000, '1.5': 10000000, '1': 10000000,
      '0.5': 50000000, '0': 50000000, '-0.5': 45000000, '-1': 47000000,
      '-1.5': 47000000, '-2': 47100000 } },
    { v: 17054321, expected: { '2': 10000000, '1.5': 10000000, '1': 10000000,
      '0.5': 10000000, '0': 20000000, '-0.5': 15000000, '-1': 17000000,
      '-1.5': 17000000, '-2': 17100000 } },
  ];
  const offsets = [2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2];
  for (const row of grid) {
    for (const off of offsets) {
      const key = String(off);
      eq(`half-step grid: roundWithOffset(${row.v}, ${off})`,
        roundWithOffset(row.v, off), row.expected[key]);
    }
  }

  // Negative-value sign preservation (spot check)
  eq('half-step grid: sign preserved for negative input',
    roundWithOffset(-87054321, -0.5), -85000000);
  eq('half-step grid: zero short-circuits',
    roundWithOffset(0, 1.5), 0);
})();

(function quarterStepGrid() {
  // Generalized fractional formula: any non-integer offset uses
  // step = f * 10^(current_mag + ceil(offset)) where f = |offset - trunc(offset)|.
  // Quarter-step (f = 0.25) spot checks across 87M / 47M / 17M.
  const cases = [
    [87054321,  0.25,  75000000],
    [87054321, -0.25,  87500000],
    [47054321,  0.25,  50000000],
    [47054321, -0.25,  47500000],
    [17054321,  0.25,  25000000],
    [17054321, -0.25,  17500000],
    // |trunc(offset)| >= X_FLOOR_THRESHOLD triggers the x-floor too.
    [87054321,  1.25, 100000000],  // x-floor at rd(87M, 1) = 100M
    [87054321, -1.25,  87000000],  // very fine step, x-floor at rd(87M, -1) = 87M
  ];
  for (const [v, off, expected] of cases) {
    eq(`quarter-step grid: roundWithOffset(${v}, ${off})`,
      roundWithOffset(v, off), expected);
  }
})();

(function halfStepMonotonicity() {
  // Monotonicity at offsets 1 and 0.5 across [73, 4591, 63538, 162583, 400000]
  const values = [73, 4591, 63538, 162583, 400000];
  for (const off of [1, 0.5]) {
    const out = values.map(v => roundWithOffset(v, off));
    let monotonic = true;
    for (let i = 1; i < out.length; i++) {
      if (out[i] < out[i - 1]) { monotonic = false; break; }
    }
    eq(`monotonicity: non-decreasing at offset=${off} (got ${JSON.stringify(out)})`,
      monotonic, true);
  }
})();

(function xFloorThresholdFlip() {
  // Re-eval content.js with X_FLOOR_THRESHOLD = 0 to confirm the x-floor
  // gates on the constant. We sandbox the patched source so the eq()
  // assertions below don't disturb the live extension globals.
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const contentSrc = sourceByName('content.js');
  if (roundingSrc === null || contentSrc === null || coreCode === null ||
      parsingCode === null || detectCode === null || messagingCode === null ||
      storeCode === null || uiToggleCode === null) {
    eq('x-floor flip: source files present in manifest', false, true);
    return;
  }
  const patchedRounding = roundingSrc.replace(
    /const X_FLOOR_THRESHOLD = 1;/,
    'const X_FLOOR_THRESHOLD = 0;'
  );
  eq('x-floor flip: source contains X_FLOOR_THRESHOLD declaration',
    patchedRounding.includes('const X_FLOOR_THRESHOLD = 0;'), true);

  const sandbox = {
    chrome: global.chrome,
    document: global.document,
    window: global.window,
    NodeFilter: global.NodeFilter,
    MutationObserver: global.MutationObserver,
    ResizeObserver: global.ResizeObserver,
    Node: global.Node,
    DR_DEFAULTS: globalThis.DR_DEFAULTS,
  };
  const vm = require('vm');
  const ctx = vm.createContext(sandbox);
  // content.js runs its observer/listener wiring at load and depends on the
  // extracted layers (core/parsing/detect/ui-toggle), so eval them in the
  // same order the manifest loads them before content.js.
  vm.runInContext(
    constantsCode + '\n' + (sourceByName('lib/dr-log/index.js') || '') + '\n' +
    patchedRounding + '\n' + coreCode + '\n' + parsingCode + '\n' +
    detectCode + '\n' + messagingCode + '\n' + storeCode + '\n' +
    uiToggleCode + '\n' + contentSrc +
    '\nthis.__roundWithOffset = roundWithOffset;', ctx);
  const patchedRound = sandbox.__roundWithOffset;

  eq('x-floor flip: rd(17054321, 0.5) === 20000000 with X_FLOOR_THRESHOLD=0',
    patchedRound(17054321, 0.5), 20000000);
  // And confirm the live (X_FLOOR_THRESHOLD=1) implementation does NOT
  // apply the x-floor for the same call.
  eq('x-floor flip: rd(17054321, 0.5) === 10000000 with X_FLOOR_THRESHOLD=1 (default)',
    roundWithOffset(17054321, 0.5), 10000000);
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

// --- Constants vs literals check ---
// Spec (AC §3.5 + last AC bullet): geometry literals must only appear as constant declarations.
// Soft check: the constant names TOGGLE_DOT_PX etc. appear in the CSS template block.

(function morphAC_constantsUsedInCSS() {
  const src = allContentSrc; // toggle geometry now in ui-toggle.js (Phase 2 split)

  // The CSS function body should contain interpolations of the constants, not bare literals.
  // We extract the ensureToggleStyleInjected function body as a rough string.
  const fnStart = src.indexOf('function ensureToggleStyleInjected');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = fnStart !== -1 ? src.slice(fnStart, fnEnd !== -1 ? fnEnd : fnStart + 3000) : '';

  eq('expanding-toggle: TOGGLE_HIT_PAD_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_HIT_PAD_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_DOT_PX'), true);
  eq('expanding-toggle: TOGGLE_PILL_WIDTH_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_PILL_WIDTH_PX'), true);
  eq('expanding-toggle: TOGGLE_PILL_HEIGHT_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_PILL_HEIGHT_PX'), true);
  eq('expanding-toggle: TOGGLE_KNOB_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_KNOB_PX'), true);
  eq('expanding-toggle: TOGGLE_COLOR_ON referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_COLOR_ON'), true);

  // positionToggle body should reference the geometry constants
  const ptStart = src.indexOf('function positionToggle');
  const ptEnd = src.indexOf('\nfunction ', ptStart + 1);
  const ptBody = ptStart !== -1 ? src.slice(ptStart, ptEnd !== -1 ? ptEnd : ptStart + 1000) : '';

  eq('expanding-toggle: TOGGLE_HIT_PAD_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_HIT_PAD_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_OVERLAP_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_OVERLAP_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_OVERHANG_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_OVERHANG_PX'), true);
})();

// =============================================================================
// Sprint sidebar-preview-band: formatStep, collectNumericCells, extractPreviewSamples
// =============================================================================

(function previewBand_formatStep() {
  eq('formatStep: 5000 -> "5k"', formatStep(5000), '5k');
  eq('formatStep: 500 -> "500"', formatStep(500), '500');
  eq('formatStep: 2_500_000 -> "2.5M"', formatStep(2500000), '2.5M');
  eq('formatStep: 1e9 -> "1B"', formatStep(1e9), '1B');
  eq('formatStep: 2.5 -> "2.5"', formatStep(2.5), '2.5');
  eq('formatStep: 0.25 -> "0.25"', formatStep(0.25), '0.25');
  eq('formatStep: 1 -> "1"', formatStep(1), '1');
  eq('formatStep: 0 -> "0"', formatStep(0), '0');
})();

(function previewBand_stepForOffset() {
  // offset = 0 on a 5-digit number -> step = 10^4 = 10000
  eq('stepForOffset(27136, 0) = 10000', stepForOffset(27136, 0), 10000);
  // offset = -0.5 on a 5-digit number -> f=0.5, target_mag=4, step = 0.5*1e4
  eq('stepForOffset(27136, -0.5) = 5000', stepForOffset(27136, -0.5), 5000);
  // offset = -1 -> step = 10^(4-1) = 1000
  eq('stepForOffset(27136, -1) = 1000', stepForOffset(27136, -1), 1000);
  // num=0 -> 0
  eq('stepForOffset(0, -0.5) = 0', stepForOffset(0, -0.5), 0);
})();

(function previewBand_collectNumericCells() {
  // Build a small stub table; only the pure-number cells should appear.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell('Header'), thCell('Year')] },
      { cells: [tdCell('Apples'), tdCell('27,136')] },
      { cells: [tdCell('Pears'),  tdCell('4,080')] },
      { cells: [tdCell('Empty'),  tdCell('')] },
      { cells: [tdCell('Word'),   tdCell('hello')] },
    ],
  };
  const cells = collectNumericCells(table);
  eq('collectNumericCells: returns 2 numeric cells', cells.length, 2);
  eq('collectNumericCells: first cell text', cells[0].text, '27,136');
  eq('collectNumericCells: first cell num', cells[0].num, 27136);
  eq('collectNumericCells: second cell num', cells[1].num, 4080);
})();

(function previewBand_extractPreviewSamples_buckets() {
  // 5 cells across 5 distinct magnitudes: 1e7, 1e6, 1e4, 1e2, 1e1.
  // num_top = 1 (DR_DEFAULTS) -> top band picks the highest magnitude only
  // (others differ from max_mag by >= 1). To exercise the 2-row top band,
  // give it two cells at the same top magnitude.
  //
  // The data sits at row >= 1 / column >= 1 behind a TH header row and a TH
  // label column: DR_DEFAULTS.simplifyFirstRow/simplifyFirstColumn are both
  // false, and since sprint merge-ladder the preview now honours that
  // exclusion (see the merge-ladder divergence tests below) the way the
  // engine always did — a row-0/column-0 <td> would be dropped, same as it
  // would be when actually rounding the table.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row1'), tdCell('27,000,000'), tdCell('18,000,000')] }, // both mag 7
      { cells: [thCell('Row2'), tdCell('4,080'),  tdCell('312')] },            // mag 3, 2
      { cells: [thCell('Row3'), tdCell('56')] },                              // mag 1
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples: maxMag is 7', result.maxMag, 7);
  eq('extractPreviewSamples: top band has 2 rows', result.samples.top.length, 2);
  eq('extractPreviewSamples: top[0] is 27M', result.samples.top[0].num, 27000000);
  eq('extractPreviewSamples: top[1] is 18M', result.samples.top[1].num, 18000000);
  eq('extractPreviewSamples: bottom band has 3 rows', result.samples.bottom.length, 3);
  eq('extractPreviewSamples: bottom[0] is 4080', result.samples.bottom[0].num, 4080);
  eq('extractPreviewSamples: bottom[1] is 312', result.samples.bottom[1].num, 312);
  eq('extractPreviewSamples: bottom[2] is 56', result.samples.bottom[2].num, 56);
})();

(function previewBand_extractPreviewSamples_onePerOrderOfMagnitude() {
  // The bottom band shows one example per distinct lower order of magnitude,
  // with no cap. Negatives bucket by absolute value. For 1234 / 123 / -12 the
  // preview is three lines: top-band 1k+ (1234) plus bottom-band 100+ (123)
  // and 10+ (|-12|).
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('1234'), tdCell('123'), tdCell('-12')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('onePerOom: maxMag is 3 (1234)', result.maxMag, 3);
  eq('onePerOom: top band is the 1k+ value (1234)', result.samples.top[0].num, 1234);
  eq('onePerOom: bottom band has one row per lower magnitude (2)',
    result.samples.bottom.length, 2);
  eq('onePerOom: bottom[0] is the 100+ value (123)', result.samples.bottom[0].num, 123);
  eq('onePerOom: bottom[1] is the 10+ value, abs of -12', result.samples.bottom[1].num, -12);

  // No cap: five distinct lower magnitudes yield five bottom rows (old code
  // capped the band at 3).
  const deep = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C'), thCell('D'), thCell('E'), thCell('F')] },
      { cells: [thCell('Row'),
        tdCell('7,000,000'),                                  // mag 6 -> top
        tdCell('500,000'), tdCell('40,000'), tdCell('3,000'), // mags 5,4,3
        tdCell('200'), tdCell('10'),                          // mags 2,1
      ] },
    ],
  };
  const deepResult = extractPreviewSamples(deep);
  eq('onePerOom: uncapped bottom band has 5 rows (one per lower OoM)',
    deepResult.samples.bottom.length, 5);
  eq('onePerOom: bottom rows are descending by magnitude',
    deepResult.samples.bottom.map(r => r.num), [500000, 40000, 3000, 200, 10]);
})();

(function previewBand_extractPreviewSamples_prefersDemonstrative() {
  // Within a magnitude bucket, an already-round value (250,000,000) would make
  // a useless "X -> X" preview row. extractPreviewSamples should surface a cell
  // that visibly changes under the default offset instead, even when the
  // already-round cell appears first in document order.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      // Top bucket (mag 8): round value first, then a value that changes.
      { cells: [thCell('Top'), tdCell('250,000,000'), tdCell('269,690,569')] },
      // Bottom bucket (mag 5): round value first, then a value that changes.
      { cells: [thCell('Bottom'), tdCell('350,000'), tdCell('235,132')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (demo): top[0] skips already-round 250M',
    result.samples.top[0].num, 269690569);
  eq('extractPreviewSamples (demo): bottom[0] skips already-round 350k',
    result.samples.bottom[0].num, 235132);
})();

(function previewBand_extractPreviewSamples_allRoundFallback() {
  // If every cell in a bucket is already round, fall back to document order
  // rather than dropping the row.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('250,000,000'), tdCell('500,000')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (all-round): top[0] is first cell',
    result.samples.top[0].num, 250000000);
})();

(function previewBand_extractPreviewSamples_largeMagOnly() {
  // All cells in the top magnitude bucket -> bottom band ends up empty.
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('18,000,000'), tdCell('45,000,000')] },
    ],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (all-top): top has 2 rows', result.samples.top.length, 2);
  eq('extractPreviewSamples (all-top): bottom is empty', result.samples.bottom.length, 0);
})();

(function previewBand_extractPreviewSamples_emptyTable() {
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  const table = {
    rows: [{ cells: [tdCell('hello'), tdCell('world')] }],
  };
  const result = extractPreviewSamples(table);
  eq('extractPreviewSamples (empty): maxMag null', result.maxMag, null);
  eq('extractPreviewSamples (empty): top length 0', result.samples.top.length, 0);
  eq('extractPreviewSamples (empty): bottom length 0', result.samples.bottom.length, 0);
})();

// ---------------------------------------------------------------------------
// Regression: collectNumericCells must classify a rounded cell's stored
// original text (dataset.originalValue) using ranges/filters measured against
// THAT text, not against the live (already-rounded, differently-offset) cell.
// Reviewer repro: reviewer-sup-stale.js.
// ---------------------------------------------------------------------------

(function previewBand_supStaleRegression() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedCells: true,
      simplifyMixedCurrency: true, simplifyMixedPercent: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
    // "1234.5678 kg" + <sup>"9"</sup> -> flattened "1234.5678 kg9". The
    // footnote digit sits after a decimal number that rounding shortens
    // (e.g. "1234.5678" -> "1000"), shifting where "9" lands in the live text.
    const segsFor = () => ([
      { text: '1234.5678 kg', inSup: false },
      { text: '9', inSup: true },
    ]);
    const otherCell = () => makeReactiveCell([{ text: '99999', inSup: false }]);

    const beforeTable = { rows: [{ cells: [makeReactiveCell(segsFor()), otherCell()] }], dataset: {} };
    const before = collectNumericCells(beforeTable, opts);
    eq('sup-stale regression: pre-round preview finds a numeric sample in the sup cell',
      before.length > 0, true);

    const cell = makeReactiveCell(segsFor());
    const table = { rows: [{ cells: [cell, otherCell()] }], dataset: {} };
    roundTable(table, opts);
    eq('sup-stale regression: cell was actually rounded (registry original.value set)',
      DR_STORE.getTableOriginal(table, cell).value, '1234.5678 kg9');

    const after = collectNumericCells(table, opts);
    eq('sup-stale regression: preview sample set is unchanged after rounding',
      after.map((c) => c.num), before.map((c) => c.num));
  });
})();

(function previewBand_linkedNumberPostRoundRegression() {
  withReactiveCreateTreeWalker(function () {
    const opts = {
      simplifyFirstRow: true, simplifyFirstColumn: true, simplifyMixedCells: true,
      simplifyMixedCurrency: true, simplifyMixedPercent: true,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: '',
    };
    // Plain "1234.5678" (should round) plus a link whose OWN number,
    // "51234.5678", contains the plain number's digits as a substring. Once
    // rounding shortens the plain occurrence away, a live-text substring
    // search for "1234.5678" spuriously matches inside the linked node
    // instead, wrongly excluding the still-valid plain match.
    const segsFor = () => ([
      { text: 'Total 1234.5678 see also ', inSup: false, inAnchor: false },
      { text: '51234.5678', inSup: false, inAnchor: true },
    ]);
    const otherCell = () => makeReactiveCell([{ text: '99999', inSup: false }]);

    const beforeTable = { rows: [{ cells: [makeReactiveCell(segsFor()), otherCell()] }], dataset: {} };
    const before = collectNumericCells(beforeTable, opts);
    eq('linked-number-post-round regression: pre-round preview keeps the plain (non-linked) number',
      before.some((c) => c.num === 1234.5678), true);

    const cell = makeReactiveCell(segsFor());
    const table = { rows: [{ cells: [cell, otherCell()] }], dataset: {} };
    roundTable(table, opts);
    eq('linked-number-post-round regression: cell was actually rounded (registry original.value set)',
      DR_STORE.getTableOriginal(table, cell).value, 'Total 1234.5678 see also 51234.5678');

    const after = collectNumericCells(table, opts);
    eq('linked-number-post-round regression: preview sample set is unchanged after rounding',
      after.map((c) => c.num), before.map((c) => c.num));
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

(function mapRenderedToFlat_positions() {
  eq('mapRenderedToFlat: equal texts map each position to itself',
    mapRenderedToFlat('a 1', 'a 1'), [0, 1, 2]);
  eq('mapRenderedToFlat: collapsed line breaks and indentation map past the raw whitespace',
    mapRenderedToFlat('Grew 1', '\n  Grew\n    1\n'), [3, 4, 5, 6, 7, 12]);
  eq('mapRenderedToFlat: a line break the browser adds at a <br> maps to the next flat character',
    mapRenderedToFlat('5\nkg', '5kg'), [0, 1, 1, 2]);
  eq('mapRenderedToFlat: hidden text in the flat text returns null',
    mapRenderedToFlat('+2.3%', '700023000+2.3%'), null);
  eq('mapRenderedToFlat: flat text ending in more than whitespace returns null',
    mapRenderedToFlat('5', '5 kg'), null);
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

(function nativeDateCell_roundsInItsPieceAndSkipsAcrossPieces() {
  withReactiveCreateTreeWalker(function () {
    const oneSegments = [{ text: ' 2024-09-15 ', inSup: false }];
    const splitSegments = [{ text: '2024-', inSup: false }, { text: '09-15', inSup: false }];
    const oneCell = makeReactiveCell(oneSegments);
    const splitCell = makeReactiveCell(splitSegments);
    const table = { rows: [{ cells: [oneCell] }, { cells: [splitCell] }], querySelector: () => null, dataset: {} };
    try {
      roundTable(table, Object.assign(nativeOnePieceOpts(), { simplifyDates: true, dateGranularity: 'year' }));
      eq('native date cell: a date in one piece rounds, and the piece keeps its whitespace',
        oneSegments[0].text, ' 2025 ');
      eq('native date cell: a date across pieces keeps its text',
        splitSegments.map((seg) => seg.text).join('|'), '2024-|09-15');
      eq('native date cell: a date across pieces gets no marker',
        splitCell.classList.contains('dr-ext-rounded'), false);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function nativePureCell_hiddenSortKeyRoundsTheVisibleValue() {
  withReactiveCreateTreeWalker(function () {
    const keyed = [{ text: '000000007002300', inSup: false }, { text: '7,002,300', inSup: false }];
    const repeated = [{ text: '0000004523789', inSup: false }, { text: '4523789', inSup: false }];
    const keyedCell = makeSortKeyCell(keyed, () => keyed[1].text);
    const repeatedCell = makeSortKeyCell(repeated, () => repeated[1].text);
    const table = { rows: [{ cells: [keyedCell] }, { cells: [repeatedCell] }], querySelector: () => null, dataset: {} };
    try {
      roundTable(table, nativeOnePieceOpts());
      eq('native sort-key cell: the visible value rounds',
        keyed[1].text, '7,000,000');
      eq('native sort-key cell: the hidden sort key keeps its text',
        keyed[0].text, '000000007002300');
      eq('native sort-key cell: a sort key that also holds the digits keeps its text, and the visible value rounds',
        repeated.map((seg) => seg.text).join('|'), '0000004523789|4,500,000');
      eq('native sort-key cell: the cells record as simplified',
        keyedCell.classList.contains('dr-ext-rounded') && repeatedCell.classList.contains('dr-ext-rounded'), true);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

(function placeDecision_stackedTestRunsOnlyWhenAsked() {
  const layout = { original: ['1', '23'], liveStarts: [0, 1], toFlat: null };
  const decision = { mode: 'pure', value: { num: 123 } };
  eq('placeDecision: without the stacked-cell test, a value across pieces skips with reason pieces',
    placeDecision(decision, '123', layout), { mode: 'skip', reason: 'pieces' });
  eq('placeDecision: with the stacked-cell test, each piece rounds as its own number',
    placeDecision(decision, '123', layout, { stacked: true }).value.matches.map((m) => m.numStr), ['1', '23']);
  eq('placeDecision: a value in one piece stands',
    placeDecision(decision, '123', { original: ['123'], liveStarts: [0], toFlat: null }), decision);
  eq('placeDecision: a rendered position converts through toFlat before the piece check',
    placeDecision(decision, '123', { original: ['\n  ', '123', '\n'], liveStarts: [0, 3, 6], toFlat: [3, 4, 5] }), decision);
})();

(function nativeWrite_olderWriterIsGone() {
  eq('native write: no loaded source defines or calls the older whole-cell writer',
    /replaceTextPreservingHTML/.test(allContentSrc), false);
  const body = sourceBodyOf(allContentSrc, 'function roundTable(');
  eq('native write: roundTable holds no innerHTML= assignment',
    body.length > 0 && !/innerHTML\s*=(?!=)/.test(body), true);
})();

(function previewBand_manifestLoadsRoundingJs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  eq('manifest content_scripts loads lib/dr-number/rounding.js between constants.js and content.js',
    manifest.content_scripts[0].js[2], 'lib/dr-number/rounding.js');
})();

// The extracted layers (the lib/dr-number package: rounding.js, core.js,
// parsing.js, index.js; the lib/dr-table package: detect.js, index.js; plus
// ui-toggle.js) must all load AFTER constants.js and BEFORE content.js —
// content.js runs last because it holds the only load-time-executing code
// (listeners and the MutationObserver wiring). This ordering is duplicated in
// three places (manifest content_scripts, sidebar.html, and this harness's
// eval concatenation); they must stay in lockstep.
(function layerLoadOrderAcrossEntryPoints() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts[0].js;
  const after = (a, b) => js.indexOf(a) > -1 && js.indexOf(b) > -1 && js.indexOf(a) < js.indexOf(b);
  eq('manifest: rounding.js < core.js < parsing.js < dr-number index.js < detect.js < dr-table index.js < ladder.js < dr-simplify index.js < messaging.js < store.js < ui-toggle.js < ui-toast.js < content.js',
    after('lib/dr-number/rounding.js', 'lib/dr-number/core.js') &&
    after('lib/dr-number/core.js', 'lib/dr-number/parsing.js') &&
    after('lib/dr-number/parsing.js', 'lib/dr-number/index.js') &&
    after('lib/dr-number/index.js', 'lib/dr-table/detect.js') &&
    after('lib/dr-table/detect.js', 'lib/dr-table/index.js') &&
    after('lib/dr-table/index.js', 'lib/dr-simplify/ladder.js') &&
    after('lib/dr-simplify/ladder.js', 'lib/dr-simplify/index.js') &&
    after('lib/dr-simplify/index.js', 'adapters/messaging.js') &&
    after('adapters/messaging.js', 'app/store.js') &&
    after('app/store.js', 'ui-toggle.js') &&
    after('ui-toggle.js', 'ui-toast.js') &&
    after('ui-toast.js', 'content.js'), true);
  eq('manifest: content.js loads last', js[js.length - 1], 'content.js');

  // The sidebar deliberately does NOT load the content-only layers — it only
  // needs the pure domain (defaults, rounding, core).
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('sidebar.html loads lib/dr-number/core.js after lib/dr-number/rounding.js and before sidebar.js',
    /lib\/dr-number\/rounding\.js[\s\S]*lib\/dr-number\/core\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
  eq('sidebar.html does not load content-only lib/dr-number/parsing.js', sidebarHtml.includes('lib/dr-number/parsing.js'), false);
  eq('sidebar.html does not load content-only lib/dr-number/index.js', sidebarHtml.includes('lib/dr-number/index.js'), false);
  eq('sidebar.html does not load content-only lib/dr-table/detect.js', sidebarHtml.includes('lib/dr-table/detect.js'), false);
  eq('sidebar.html does not load content-only lib/dr-table/index.js', sidebarHtml.includes('lib/dr-table/index.js'), false);
  eq('sidebar.html does not load content-only lib/dr-simplify/ladder.js', sidebarHtml.includes('lib/dr-simplify/ladder.js'), false);
  eq('sidebar.html does not load content-only lib/dr-simplify/index.js', sidebarHtml.includes('lib/dr-simplify/index.js'), false);
  eq('sidebar.html does not load content-only ui-toggle.js', sidebarHtml.includes('ui-toggle.js'), false);
  eq('sidebar.html does not load content-only ui-toast.js', sidebarHtml.includes('ui-toast.js'), false);

  // NOTE: the main bootstrap eval() (the setup piece) no longer concatenates
  // coreCode/parsingCode/detectCode/uiToggleCode/code directly — it evals
  // the manifest-driven contentScriptBundle instead (see the
  // manifestDrivenSourceLoading self-test below for that ordering guarantee).
  // This assertion instead checks that later per-layer eval sites in the suite
  // (e.g. the x-floor sandbox concatenation) still reference those variables
  // in layer order, since a few sections still build their own eval string
  // from the individual layer sources.
  const testsSource = SUITE_SOURCE;
  eq('tests.js: per-layer eval sites reference core→parsing→detect→ui-toggle→content in layer order',
    /coreCode[\s\S]*parsingCode[\s\S]*detectCode[\s\S]*uiToggleCode[\s\S]*code\b/.test(
      testsSource.slice(testsSource.indexOf('eval('))), true);
})();

(function previewBand_sidebarHtmlHasBands() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('sidebar.html has #topBand', /<div[^>]*id="topBand"/.test(sidebarHtml), true);
  eq('sidebar.html has #botBand', /<div[^>]*id="botBand"/.test(sidebarHtml), true);
  eq('sidebar.html loads lib/dr-number/rounding.js before sidebar.js',
    /lib\/dr-number\/rounding\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
})();

