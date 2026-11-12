/**
 * DynamicRounding Chrome Extension - Sidebar
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

const enabledEl = document.getElementById('enabled');
const optionsSection = document.getElementById('optionsSection');
const statusEl = document.getElementById('status');

const NO_TABLE_CLASS = 'no-table';
const NO_TABLE_STATUS_MSG = 'Right-click a table to connect it here.';


// ---- The sidebar serves one tab ----
//
// A content script publishes by broadcast, because the sidebar is an
// extension page and a broadcast is what reaches one. A broadcast names no
// tab, so without a filter a background tab re-simplifying its rows would
// redraw the sidebar against a table the user cannot see.
//
// The bound tab is the tab the sidebar was opened for, and the sidebar serves
// that tab alone. It is a separate fact from the tab number the service
// worker holds: the worker's number answers which tab to close the sidebar
// for, and this one answers which tab the sidebar is showing.
//
// The tabs interface and the bus arrive as parameters so the whole concern
// runs in the suite with stubs, without the sidebar's page elements.
function createBoundTab(tabsApi, bus) {
  let boundTabId = null;
  let boundWindowId = null;

  // A message belongs to the bound tab only when the two numbers match. A
  // message carrying no tab came from an extension page rather than a content
  // script, and belongs to no tab at all. A message arriving before resolve()
  // records the tab is dropped.
  function ownsReport(meta) {
    return boundTabId !== null && !!meta && meta.tabId === boundTabId;
  }

  return {
    // Record the tab the sidebar was opened for, and the window holding it,
    // then run onReady. The order is load-bearing: the read reaches the page,
    // the page publishes back, and a message arriving before the tab number
    // exists has nothing to be compared against. No tab to bind to leaves the
    // number unset and still runs the read, which falls to the unbound state
    // on its own when nothing answers it.
    resolve(onReady) {
      if (!tabsApi || typeof tabsApi.query !== 'function') {
        onReady();
        return;
      }
      // The catch covers a query that throws before answering. Once it has
      // answered, a throw from the read itself is the read's own, and running
      // the read a second time would send its messages twice.
      let answered = false;
      try {
        tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
          answered = true;
          if (tabs && tabs[0] && typeof tabs[0].id === 'number') {
            boundTabId = tabs[0].id;
            if (typeof tabs[0].windowId === 'number') boundWindowId = tabs[0].windowId;
          }
          onReady();
        });
      } catch (e) {
        // A throw after the query answered came from the read, not from the
        // query, so it belongs to the read and travels on. Swallowing it here
        // would hide a broken read behind a working tab lookup.
        if (answered) throw e;
        // extension context may not be available; harmless.
        onReady();
      }
    },

    // Subscribe to one of the content script's topics. Every such message
    // passes through here, so the comparison lives in one place rather than
    // at each subscription.
    subscribe(topic, handler) {
      return bus.subscribe(topic, (payload, meta) => {
        if (!ownsReport(meta)) return;
        handler(payload, meta);
      });
    },

    // The window the bound tab sits in: null before the lookup answers, and
    // null when the tabs interface reports no window. The screenshot take
    // passes this window, whose front tab is the bound tab by construction —
    // the sidebar closes when that tab leaves the front.
    windowId() {
      return boundWindowId;
    },

    // Close the sidebar when the tab it was opened for stops being the one in
    // front. The service worker closes it on the ordinary route and misses
    // two: an idle restart empties the tab number it compares against, and a
    // sidebar opened from Chrome's own side-panel control never sets it. On
    // those routes the sidebar would otherwise survive the switch and keep
    // showing controls for a page the user left. Closing here gives a tab
    // switch one outcome, whichever route it takes.
    //
    // A side panel belongs to one browser window, and the activation event
    // fires for every window. An activation in another window leaves the
    // bound tab where it was — still the front tab of its own window — so it
    // is passed over. A tabs interface reporting no window leaves the
    // comparison on the tab alone.
    //
    // With no tab recorded there is nothing to have left, so nothing closes.
    onSwitchAway(onLeft) {
      if (!tabsApi || !tabsApi.onActivated ||
          typeof tabsApi.onActivated.addListener !== 'function') return;
      tabsApi.onActivated.addListener((activeInfo) => {
        if (!activeInfo || boundTabId === null) return;
        if (boundWindowId !== null && activeInfo.windowId !== boundWindowId) return;
        if (activeInfo.tabId === boundTabId) return;
        onLeft();
      });
    },
  };
}

const boundTab = createBoundTab(chrome.tabs, DR_BUS);

/**
 * Write the status line. A message with a source holds the line against
 * every write without one until clearStatus() runs for that source, because
 * Chrome does not order the content script's range message against the
 * answer to a settings apply.
 * @param {string} text - The message, or '' to clear the line.
 * @param {string} [source] - The source of the message, 'range' for a range error; omitted for a message with no source.
 * @returns {boolean} Whether the line now holds the text.
 */
function writeStatus(text, source) {
  if (source === undefined && statusEl.dataset.source) return false;
  statusEl.textContent = text;
  if (source !== undefined) statusEl.dataset.source = source;
  return true;
}

/**
 * Clear the status line when a message from the source holds it.
 * @param {string} [source] - The source of the message to clear; omitted to clear any message.
 */
function clearStatus(source) {
  if (source !== undefined && statusEl.dataset.source !== source) return;
  statusEl.textContent = '';
  delete statusEl.dataset.source;
}

function setTableBound(isBound) {
  document.body.classList.toggle(NO_TABLE_CLASS, !isBound);
  if (!isBound) {
    // No active table: there is nothing for rounding to act on, so flip the
    // sidebar pillbox to its off state rather than dimming the whole sidebar.
    clearStatus();
    enabledEl.checked = false;
    writeStatus(NO_TABLE_STATUS_MSG);
  } else {
    // A table is now bound. The sidebar pillbox is not touched here: the
    // settings pull has already set it from the model or the shipped
    // defaults, and a bind must not reset it.
    if (statusEl.textContent === NO_TABLE_STATUS_MSG) {
      statusEl.textContent = '';
    }
  }
  updateDisabledState();
}

// Each switch's element id is its setting's name. The order is the order of
// the switch keys in the settings payload.
const SWITCH_NAMES = [
  'simplifyMixedCurrency',
  'simplifyMixedPercent',
  'simplifyFirstRow',
  'simplifyFirstColumn',
  'simplifyDates',
  'simplifyTimes',
];

/**
 * Run a function on each switch.
 * @param {function(string, HTMLInputElement): void} fn - Called with the switch's setting name and its checkbox.
 */
function forEachSwitch(fn) {
  for (const name of SWITCH_NAMES) fn(name, document.getElementById(name));
}

const dateGranularityEl = document.getElementById('dateGranularity');
const timeGranularityEl = document.getElementById('timeGranularity');
const rangeExprEl = document.getElementById('rangeExpr');

// ----- Linked dual-thumb sliders -----
// Stops are ordered so the *rounding strategy* changes monotonically across the
// track (finest step on the left, coarsest on the right), NOT by offset value.
// stepForOffset is non-monotonic in the offset because half-step offsets
// interleave with the integer ones: e.g. at mag 6 the steps run
//   -2:10k  -1.5:50k  -1:100k  -0.25:250k  -0.5:500k
//    0:1M   0.25:2.5M  0.5:5M    1:10M
// Hence -0.25 precedes -0.5, and -1 sits right after -1.5.
const STOPS = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];

const sliderBlockEl = document.getElementById('sliderBlock');
const topThumb = document.getElementById('topThumb');
const botThumb = document.getElementById('botThumb');
const trackEl = document.getElementById('dualWrap').querySelector('.dual-track');

let topVal = DR_DEFAULTS.offsetTop;
let botVal = DR_DEFAULTS.offsetTop;
let linked = true;

function snap(v) {
  let best = STOPS[0];
  let bestDist = Infinity;
  for (const s of STOPS) {
    const d = Math.abs(s - v);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}
/**
 * The track position of a stop: the centre of its column, as a percentage of
 * the track width. Every stop has a column of equal width, one per tick,
 * because the stop values are unevenly spaced.
 * @param {number} v - An offset; a value off the stops counts as its nearest stop.
 * @returns {number} The position, from 0 to 100.
 */
function stopPosition(v) {
  let k = STOPS.indexOf(v);
  if (k === -1) k = STOPS.indexOf(snap(v));
  return (k + 0.5) / STOPS.length * 100;
}

/**
 * The stop whose column holds a point on the track.
 * @param {number} ratio - The point's distance from the track's left end, as a share of the track width, from 0 to 1.
 * @returns {number} The stop.
 */
function stopAtRatio(ratio) {
  return STOPS[Math.max(0, Math.min(STOPS.length - 1, Math.floor(ratio * STOPS.length)))];
}

function renderSliders() {
  topThumb.style.left = stopPosition(topVal) + '%';
  botThumb.style.left = stopPosition(botVal) + '%';
  botThumb.classList.toggle('linked', linked);
  sliderBlockEl.classList.toggle('linked', linked);
  topThumb.setAttribute('aria-valuenow', String(topVal));
  botThumb.setAttribute('aria-valuenow', String(botVal));
  renderPreviewBands();
}

// ----- Lens preview -----
const topBandEl = document.getElementById('topBand');
const botBandEl = document.getElementById('botBand');
let cachedSamples = null;
let cachedMaxMag = null;

const PREVIEW_DECIMAL_THRESHOLD = 100;
const PREVIEW_MAX_DECIMALS = 4;

// A value at or above PREVIEW_DECIMAL_THRESHOLD shows no decimals; a smaller
// one shows at most PREVIEW_MAX_DECIMALS. Both cut digits off, never round.
function formatOriginal(numOrStr) {
  const parsed = toNumber(numOrStr);
  if (parsed === null || !isFinite(parsed)) return String(numOrStr);
  const abs = Math.abs(parsed);
  const intStr = String(Math.trunc(abs)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // toString() gives the shortest decimal that reads back as the same value,
  // so cutting its text truncates without rounding. A value it writes in
  // exponent form, such as 1e-7, holds no digit within the decimals shown.
  const text = abs.toString();
  const dot = text.indexOf('.');
  const fracStr = abs < PREVIEW_DECIMAL_THRESHOLD && dot !== -1 && !/e/i.test(text)
    ? text.slice(dot + 1, dot + 1 + PREVIEW_MAX_DECIMALS).replace(/0+$/, '')
    : '';
  // A negative value that truncates to 0 shows "0", never "-0".
  const sign = parsed < 0 && (intStr !== '0' || fracStr !== '') ? '-' : '';
  return sign + intStr + (fracStr === '' ? '' : '.' + fracStr);
}

const OOM_LABEL_CLASS = 'oom-label';
const STEP_LABEL_CLASS = 'step-label';
const STRATEGY_CLASS = 'strategy';

/**
 * Return a human-readable OoM label for a given magnitude (floor(log10(|n|))).
 * Examples: mag=5 → "100k+", mag=3 → "1k+", mag=0 → "1+", mag=-1 → "0.1+"
 */
function formatOomLabel(mag) {
  const val = Math.pow(10, mag);
  let str;
  if (val >= 1e9) {
    str = trimNum(val / 1e9) + 'B';
  } else if (val >= 1e6) {
    str = trimNum(val / 1e6) + 'M';
  } else if (val >= 1e3) {
    str = trimNum(val / 1e3) + 'k';
  } else {
    // Includes sub-integer magnitudes: mag=-1 → 0.1, mag=-2 → 0.01
    str = trimNum(val);
  }
  return str + '+';
}

/**
 * @param {number} n - A sample value.
 * @returns {number} The value's order of magnitude, or -Infinity for 0.
 */
function magnitudeOf(n) {
  return n !== 0 ? Math.floor(Math.log10(Math.abs(n))) : -Infinity;
}

/**
 * Append one row to a lens preview element: a from cell, an arrow cell, and a
 * num cell, which the element's three-column grid lines up with every other
 * row.
 * @param {Element} el - The lens preview element that receives the row.
 * @param {string} className - The row's class attribute.
 * @param {string} fromText - The from cell's text.
 * @param {string} numText - The num cell's text.
 * @returns {{from: Element, num: Element}} The from and num cells, for a label to go inside.
 */
function appendSampleRow(el, className, fromText, numText) {
  const pair = document.createElement('div');
  pair.className = className;
  const cells = {};
  for (const [cellClass, text] of [['from', fromText], ['arrow', '→'], ['num', numText]]) {
    const cell = document.createElement('span');
    cell.className = cellClass;
    cell.textContent = text;
    pair.appendChild(cell);
    cells[cellClass] = cell;
  }
  el.appendChild(pair);
  return cells;
}

/**
 * Render the top of the lens preview on two lines: the strategy header (blue) on the
 * first line and a single worked example ("e.g. <original> → <rounded>", black)
 * on the second. Both lines are laid out as from|arrow|num pairs in the shared
 * 3-column grid so their "→" arrows line up vertically. The example carries no
 * step annotation and shows the bare original number.
 */
function renderTopBand(el, rows, offset) {
  if (!el) return;
  el.innerHTML = '';
  if (!rows || rows.length === 0) return;

  if (cachedMaxMag !== null && cachedMaxMag !== undefined) {
    const step = stepForOffset(Math.pow(10, cachedMaxMag), offset);
    appendSampleRow(el, 'pair ' + STRATEGY_CLASS,
      formatOomLabel(cachedMaxMag), 'nearest ' + formatStep(step));
  }
  const num = rows[0].num;
  appendSampleRow(el, 'pair example',
    'e.g. ' + formatOriginal(num), formatOriginal(roundWithOffset(num, offset)));
}

/**
 * Render the lens preview's sample rows: rows sorted DESCENDING by magnitude, each
 * showing the bare original number with its OoM label. A brown trailing step
 * annotation — "(5k)" — follows the rounded number to show what each example
 * rounds to the nearest of.
 */
function renderBotBand(el, rows, offset) {
  if (!el) return;
  el.innerHTML = '';
  if (!rows || rows.length === 0) return;

  const sorted = rows.slice().sort((a, b) => magnitudeOf(b.num) - magnitudeOf(a.num));
  for (const { num } of sorted) {
    const cells = appendSampleRow(el, 'pair',
      formatOriginal(num), formatOriginal(roundWithOffset(num, offset)));
    if (num === 0) continue;
    appendLabel(cells.from, OOM_LABEL_CLASS, formatOomLabel(magnitudeOf(num)));
    appendLabel(cells.num, STEP_LABEL_CLASS, formatStep(stepForOffset(num, offset)));
  }
}

/**
 * Append a bracketed label, such as " (100k+)", to a lens preview cell.
 * @param {Element} cell - The cell that receives the label.
 * @param {string} className - The label's class attribute.
 * @param {string} text - The label's text, without the brackets.
 */
function appendLabel(cell, className, text) {
  const label = document.createElement('span');
  label.className = className;
  label.textContent = ' (' + text + ')';
  cell.appendChild(label);
}

function renderPreviewBands() {
  if (!cachedSamples) {
    topBandEl.innerHTML = '';
    botBandEl.innerHTML = '';
    return;
  }
  renderTopBand(topBandEl, cachedSamples.top, topVal);
  renderBotBand(botBandEl, cachedSamples.bottom, botVal);
}

// Refreshes the lens preview from the active table; the bound/unbound
// state is a side effect of the response (samples !== null means bound).
// The sidebar pillbox is not written on the bound path: setTableBound(true)
// leaves it to the settings apply that ran before this call,
// so no pulled value needs threading back in after the bind resolves.
function fetchPreviewSamples() {
  DR_BUS.request('request:previewSamples', {}, (answer) => {
    cachedSamples = answer ? answer.samples : null;
    cachedMaxMag = answer ? answer.maxMag : null;
    setTableBound(cachedSamples !== null);
    renderPreviewBands();
  });
}

function decouple() {
  if (linked) {
    linked = false;
    renderSliders();
  }
}
function relinkIfMatched() {
  if (!linked && botVal === topVal) {
    linked = true;
    renderSliders();
    applyNow();
  }
}

/**
 * Move one thumb to a stop, then redraw and apply. While the lens control is
 * coupled, a move of the top thumb moves the bot thumb with it.
 * @param {string} which - 'top' or 'bot': the thumb to move.
 * @param {number} stop - The stop to move it to.
 * @returns {boolean} Whether a value changed.
 */
function setThumbValue(which, stop) {
  if (which === 'top') {
    if (topVal === stop && (!linked || botVal === stop)) return false;
    topVal = stop;
    if (linked) botVal = stop;
  } else {
    if (botVal === stop) return false;
    botVal = stop;
  }
  renderSliders();
  applyNow();
  return true;
}

function startDrag(which) {
  return function (e) {
    if (e.cancelable) e.preventDefault();
    if (which === 'bot' && linked) decouple();
    const rect = trackEl.getBoundingClientRect();
    const target = which === 'top' ? topThumb : botThumb;
    if (target.setPointerCapture && e.pointerId !== undefined) {
      try { target.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function move(ev) {
      const clientX = ev.clientX !== undefined
        ? ev.clientX
        : (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
      setThumbValue(which, stopAtRatio(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))));
    }
    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      relinkIfMatched();
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    move(e);
  };
}

function keyboardStep(which, delta) {
  const cur = which === 'top' ? topVal : botVal;
  const next = STOPS[Math.max(0, Math.min(STOPS.length - 1, STOPS.indexOf(cur) + delta))];
  if (which === 'bot' && linked) decouple();
  if (setThumbValue(which, next)) relinkIfMatched();
}

/**
 * @param {string} which - 'top' or 'bot': the thumb that receives the key presses.
 * @returns {function(KeyboardEvent): void} The thumb's keydown handler.
 */
function thumbKeyHandler(which) {
  return (e) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1;
    if (delta === 0) return;
    e.preventDefault();
    keyboardStep(which, delta);
  };
}

for (const [which, thumb] of [['top', topThumb], ['bot', botThumb]]) {
  thumb.addEventListener('pointerdown', startDrag(which));
  thumb.addEventListener('keydown', thumbKeyHandler(which));
}

// The values the controls hold. The settings payload and the capture's
// sidebar view both read them here.
function readControls() {
  const switches = {};
  forEachSwitch((name, el) => { switches[name] = el.checked; });
  return {
    enabled: enabledEl.checked,
    switches: switches,
    dateGranularity: dateGranularityEl.value,
    timeGranularity: timeGranularityEl.value,
    rangeExpr: rangeExprEl.value,
  };
}

function currentSettings() {
  const controls = readControls();
  // Always emit concrete numbers — never null/blank — so content.js never falls
  // back to the "offset_other inherits from offset_top" branch. numTop has no
  // sidebar control; pin it to 1.
  return Object.assign({ enabled: controls.enabled }, controls.switches, {
    dateGranularity: controls.dateGranularity,
    timeGranularity: controls.timeGranularity,
    offsetTop: topVal,
    offsetOther: botVal,
    numTop: 1,
    rangeExpr: controls.rangeExpr,
  });
}

function updateDisabledState() {
  optionsSection.classList.toggle('disabled', !enabledEl.checked);
  // Granularity dropdown only matters when the row's switch is on
  // (i.e. that type's cells are bucketed by the chosen granularity).
  dateGranularityEl.disabled = !document.getElementById('simplifyDates').checked;
  timeGranularityEl.disabled = !document.getElementById('simplifyTimes').checked;
}

// Cross-context: this page and content.js are separate extension contexts, so
// the settings change travels as a request rather than a direct write to the
// model. The content script writes it to the active table's settings and
// answers.
//
// The answer's value is never read — only whether one arrived. Nothing
// answering means no content script on the tab, which is exactly the unbound
// state.
function applyNow() {
  DR_BUS.request('request:applySettings', { settings: currentSettings() }, (answer) => {
    if (!answer) {
      setTableBound(false);
    } else {
      writeStatus('');
    }
  });
}

enabledEl.addEventListener('change', () => {
  updateDisabledState();
  applyNow();
});

forEachSwitch((name, el) => {
  el.addEventListener('change', () => {
    updateDisabledState();
    applyNow();
  });
});

dateGranularityEl.addEventListener('change', applyNow);
timeGranularityEl.addEventListener('change', applyNow);

rangeExprEl.addEventListener('input', applyNow);

document.body.addEventListener('click', (e) => {
  if (e.target.matches('input, select, option, summary')) return;
  if (e.target.closest && e.target.closest('.dual-wrap')) return;
  // Capture interactions are not settings changes: a mark press, a keystroke
  // in the remarks, or the finish button must not send a settings apply.
  if (e.target.closest && e.target.closest('#captureSection')) return;
  applyNow();
});

const SIDEBAR_FLASH_CLASS = 'dr-sidebar-flash';

function flashSidebarContainer() {
  document.body.classList.remove(SIDEBAR_FLASH_CLASS);
  // Force reflow so the animation restarts if triggered again immediately.
  void document.body.offsetWidth;
  document.body.classList.add(SIDEBAR_FLASH_CLASS);
  document.body.addEventListener('animationend', () => {
    document.body.classList.remove(SIDEBAR_FLASH_CLASS);
  }, { once: true });
}

// A right-click made a table active, so the controls must describe that
// table: read its settings, then its lens preview.
boundTab.subscribe('state:tableActivated', () => {
  flashSidebarContainer();
  pullSettingsAndApplyToUI();
});

// An echo of the sidebar's own write would overwrite a newer keystroke or
// slider step.
boundTab.subscribe('state:settingsChanged', ({ source, settings }) => {
  if (source !== 'sidebar') applySettingsToUI(settings);
  fetchPreviewSamples();
});

DR_BUS.subscribe('intent:closeSidebar', () => {
  window.close();
});

boundTab.subscribe('state:rangeError', ({ error }) => {
  writeStatus(error || 'Invalid range expression.', 'range');
  rangeExprEl.classList.add('invalid');
});

boundTab.subscribe('state:rangeOk', () => {
  rangeExprEl.classList.remove('invalid');
  clearStatus('range');
});

boundTab.subscribe('state:previewSamplesChanged', () => {
  // Stale view: re-read the active table's settings, then the previews (the
  // pull chain ends in fetchPreviewSamples). A bare preview fetch here would
  // reset the sidebar pillbox to the shipped default.
  pullSettingsAndApplyToUI();
});

boundTab.subscribe('state:tableSwitched', () => {
  DR_LOG.debug('Dynamic Rounding: table switch received.');
  // A table switch: the sidebar mirrors the new active table's settings; it
  // does not reset to the shipped defaults.
  try {
    pullSettingsAndApplyToUI();
  } catch (e) {
    // sidebar may be in teardown; harmless
  }
});

window.addEventListener('unload', () => {
  DR_BUS.publish('state:sidebarClosed', {});
});

// Populate every control from a settings object. DR_DEFAULTS, a pulled copy
// of the active table's settings, and a settings notice share this one path
// so the sidebar and content.js can never drift apart no matter which one
// supplied the values.
function applySettingsToUI(settings) {
  const s = Object.assign({}, DR_DEFAULTS, settings || {});
  enabledEl.checked = s.enabled !== false;
  forEachSwitch((name, el) => { el.checked = !!s[name]; });
  if (s.dateGranularity) dateGranularityEl.value = s.dateGranularity;
  if (s.timeGranularity) timeGranularityEl.value = s.timeGranularity;
  topVal = snap(typeof s.offsetTop === 'number' ? s.offsetTop : DR_DEFAULTS.offsetTop);
  botVal = snap(typeof s.offsetOther === 'number' ? s.offsetOther : topVal);
  linked = (topVal === botVal);
  renderSliders();
  rangeExprEl.value = typeof s.rangeExpr === 'string' ? s.rangeExpr : '';
}

// Pull the active table's settings from content.js (the one holder of
// settings) rather than resetting to shipped defaults: neither a
// close/reopen nor a switch may lose what the user configured.
// No active tab, no content script yet, or no response at all falls back to
// defaults.
//
// fetchPreviewSamples runs only after the pull settles (success or fallback),
// never in parallel with it: fetchPreviewSamples's own setTableBound call is
// what forces enabledEl back off when no table is bound, and that must stay
// the last word — racing it against this pull could let a pulled "enabled:
// true" win the UI over an actual no-table state.
function pullSettingsAndApplyToUI() {
  DR_BUS.request('request:settings', {}, (answer) => {
    applySettingsToUI(answer ? answer.settings : null);
    fetchPreviewSamples();
  });
}

// ----- Capture (the bug-report file) -----
// Three marks; pressing one unfolds the remarks form; the finish button is the
// only thing that saves. The capture stays available with no table bound —
// an empty registry is exactly what a "found no table" report must show —
// and a failed state pull still saves, with the failure recorded as a row.

const captureFormEl = document.getElementById('captureForm');
const captureMarkEls = Array.from(document.querySelectorAll('.capture-mark'));
const captureRemarksEl = document.getElementById('captureRemarks');
const captureSaveEl = document.getElementById('captureSave');
const captureCancelEl = document.getElementById('captureCancel');
const captureSizeNoteEl = document.getElementById('captureSizeNote');

// The one remarks field's preview text follows the mark: looks wrong
// prompts for the fixture loop's three facts, not sure prompts loosely,
// looks right needs only remarks.
const CAPTURE_REMARKS_HINTS = {
  'looks-right': 'Remarks',
  'not-sure': 'Suggestions / questions / remarks',
  'looks-wrong': 'expected / observed / cause (if known)',
};

// The pressed mark, as its bare word — null while the form is folded.
let captureMark = null;

function renderCaptureMarks() {
  for (const el of captureMarkEls) {
    el.setAttribute('aria-pressed', el.dataset.mark === captureMark ? 'true' : 'false');
  }
  captureFormEl.hidden = captureMark === null;
  if (captureMark !== null) {
    captureRemarksEl.placeholder = CAPTURE_REMARKS_HINTS[captureMark] || '';
  }
}

// Folds the form and clears the mark. Typed remarks survive a fold, so
// an accidental cancel loses nothing; a completed save clears it below.
function foldCaptureForm() {
  captureMark = null;
  renderCaptureMarks();
}

// Opening the form pulls the capture state once, only to measure it: a
// heavy page renders a file in the tens of megabytes, and the person about
// to press finish reads the size estimate before the save, not after. The
// finish press pulls fresh; this response is never reused. A failed pull
// here shows no note — finish logs its own pull failure.
function refreshCaptureSizeNote() {
  captureSizeNoteEl.hidden = true;
  DR_BUS.request('request:captureState', {}, (answer) => {
    if (!answer) return;
    const warning = DR_CAPTURE.sizeWarning(answer);
    // The mark re-check drops an answer that lands after the form folded.
    if (warning !== null && captureMark !== null) {
      captureSizeNoteEl.textContent = warning;
      captureSizeNoteEl.hidden = false;
    }
  });
}

for (const el of captureMarkEls) {
  el.addEventListener('click', () => {
    // Re-pressing the lit mark folds the form (same-mark toggle).
    captureMark = el.dataset.mark === captureMark ? null : el.dataset.mark;
    if (captureMark !== null) {
      DR_LOG.debug('Dynamic Rounding: capture form opened (' + captureMark + ').');
      refreshCaptureSizeNote();
    }
    renderCaptureMarks();
  });
}

captureCancelEl.addEventListener('click', foldCaptureForm);

// An anchor, not chrome.downloads: that permission gates the API, and the
// download attribute is honored for a blob made on an extension page — the
// model extension's proven save path. The delayed revoke gives the browser
// time to read the blob.
function saveCaptureFile(opts) {
  const url = URL.createObjectURL(new Blob([opts.html], { type: 'text/html' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = opts.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// The sidebar's own half of the capture state: every control's value, the
// lens control positions, and what the status line said — read at finish
// time from this page's live controls and variables. Sidebar view state has
// no model by existing design, so this is evidence-taking, not a second
// store of record.
function collectSidebarView() {
  return Object.assign(readControls(), {
    stops: STOPS.slice(),
    topVal: topVal,
    botVal: botVal,
    coupled: linked,
    status: statusEl.textContent,
    noTable: document.body.classList.contains(NO_TABLE_CLASS),
    lensPreview: {
      top: Array.from(topBandEl.children).map((n) => n.textContent),
      bottom: Array.from(botBandEl.children).map((n) => n.textContent),
    },
  });
}

// JPEG at this quality keeps table text legible and holds a laptop viewport
// near a few hundred kilobytes; PNG runs three to six times larger on a
// text-heavy page.
const CAPTURE_SCREENSHOT_QUALITY = 85;

// The bound tab's visible area as one image data URL, for the capture. The
// tabs interface arrives as a parameter so the suite drives this with a
// stub. chrome.tabs.captureVisibleTab needs the activeTab grant, which the
// right-click menu item that opened the sidebar gives for that tab and a
// navigation takes away; it runs from extension pages, and Chrome settles
// its promise on every documented failure (no grant, quota, protected
// page), so no timer guards it. Every route calls done exactly once: with
// the image and a taken record, or with no image and a record that holds the
// reason. A failure here never blocks the save; it is one more fact the
// capture records.
function takeCaptureScreenshot(tabsApi, windowId, done) {
  const fail = (reason) => {
    const text = reason && reason.message ? reason.message : String(reason);
    DR_LOG.warn('Dynamic Rounding: screenshot failed (' + text + ').');
    done({ dataUrl: null, record: { taken: false, reason: text } });
  };
  if (!tabsApi || typeof tabsApi.captureVisibleTab !== 'function') {
    fail('the tabs interface offers no capture');
    return;
  }
  const options = { format: 'jpeg', quality: CAPTURE_SCREENSHOT_QUALITY };
  const args = typeof windowId === 'number' ? [windowId, options] : [options];
  let pending;
  try {
    pending = tabsApi.captureVisibleTab.apply(tabsApi, args);
  } catch (e) {
    fail(e);
    return;
  }
  if (!pending || typeof pending.then !== 'function') {
    fail('the capture returned no promise');
    return;
  }
  pending.then((dataUrl) => {
    if (typeof dataUrl !== 'string' || dataUrl === '') {
      fail('the capture returned no image');
      return;
    }
    done({ dataUrl: dataUrl, record: { taken: true, format: 'jpeg', chars: dataUrl.length } });
  }, fail);
}

// One capture state from the page's half (the request:captureState answer,
// or null when the pull failed), this page's half, and the screenshot take's
// answer. CAPTURE_FORMAT comes from lib/dr-capture/state.js, loaded by this
// page too, so the fallback carries the same version the serializer stamps.
// The image passes to the renderer beside the state, never inside it: the
// state holds the take's record alone, so the JSON island stays small.
const CAPTURE_SAVED_STATUS_MSG = 'Capture saved.';

function assembleAndSaveCapture(mark, remarks, pageState, shot) {
  const at = new Date();
  const state = Object.assign({
    captureFormat: CAPTURE_FORMAT,
    page: null,
    detectionSettings: null,
    activeTableIndex: null,
    tables: [],
    lensPreview: null,
    fixtureSeed: null,
    errorState: null,
    log: null,
  }, pageState || {});
  state.meta = {
    url: state.page ? state.page.url : null,
    title: state.page ? state.page.title : null,
    version: chrome.runtime.getManifest().version,
    platform: navigator.userAgent,
    at: at.toISOString(),
  };
  state.mark = mark;
  state.remarks = remarks;
  state.screenshot = shot && shot.record
    ? shot.record
    : { taken: false, reason: 'no screenshot was attempted' };
  state.sidebarView = collectSidebarView();
  // Provenance is evidence: the two contexts' rows stay in separate lists.
  state.log = {
    content: pageState ? pageState.log || null : null,
    sidebar: DR_LOG.snapshot(),
  };
  // A failure while building or saving the file shows on the status line
  // and is logged; the form stays open with the typed remarks, so a retry
  // costs nothing.
  try {
    const html = DR_CAPTURE.buildCaptureDocument({
      state: state,
      screenshotDataUrl: shot ? shot.dataUrl : null,
    });
    saveCaptureFile({
      filename: DR_CAPTURE.filenameFor({ at: at, url: state.meta.url, mark: mark }),
      html: html,
    });
  } catch (e) {
    DR_LOG.warn('Dynamic Rounding: capture save failed (' +
      (e && e.message ? e.message : e) + ').');
    writeStatus('Capture failed; nothing was saved.');
    return;
  }
  DR_LOG.debug('Dynamic Rounding: capture saved.');
  foldCaptureForm();
  captureRemarksEl.value = '';
  if (writeStatus(CAPTURE_SAVED_STATUS_MSG)) {
    setTimeout(() => {
      if (statusEl.textContent === CAPTURE_SAVED_STATUS_MSG) writeStatus('');
    }, 2500);
  }
}

// The state pull and the screenshot take run side by side; the save runs
// once both have answered, whichever answers first. Each answer is a fact
// the capture records: a pull that never answers saves with the page half
// as an absence, a take that fails saves with the reason in the record.
function saveCapture() {
  if (captureMark === null) return;
  const mark = captureMark;
  const remarks = captureRemarksEl.value;
  DR_LOG.debug('Dynamic Rounding: finish pressed; asking for capture state.');
  let pageAnswer = null;
  let shot = null;
  let pending = 2;
  const settle = () => {
    pending -= 1;
    if (pending === 0) assembleAndSaveCapture(mark, remarks, pageAnswer, shot);
  };
  DR_BUS.request('request:captureState', {}, (answer) => {
    if (!answer) DR_LOG.warn('Dynamic Rounding: capture state request went unanswered.');
    pageAnswer = answer || null;
    settle();
  });
  takeCaptureScreenshot(chrome.tabs, boundTab.windowId(), (result) => {
    shot = result;
    settle();
  });
}

captureSaveEl.addEventListener('click', saveCapture);
renderCaptureMarks();

setTableBound(false);

// Defensively clear rangeExpr so browser autofill can never leak a stale
// value into a hidden field before the settings pull below (which sets it
// from the model) resolves.
rangeExprEl.value = '';

// The opening read pulls live settings, then the preview samples for the
// active table. With no active table, content.js returns nulls and the
// sidebar shows the no-table prompt.
boundTab.resolve(() => {
  pullSettingsAndApplyToUI();
  // Registered after the tab lookup, for the reason resolve() states. The
  // service worker closes the sidebar on most tab switches; this covers the
  // switches it misses, so every switch ends the same way.
  boundTab.onSwitchAway(() => { window.close(); });
});

updateDisabledState();
