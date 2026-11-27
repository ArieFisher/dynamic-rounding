// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

const enabledEl = document.getElementById('enabled');
const optionsSection = document.getElementById('optionsSection');
const statusEl = document.getElementById('status');

const UNBOUND_CLASS = 'unbound';
const UNBOUND_STATUS_MSG = 'Right-click a table to connect it here.';


// ---- The sidebar serves one tab ----
//
// A content script publishes by broadcast, because the sidebar is an
// extension page and a broadcast is what reaches one. A broadcast holds no
// tab ID, so without a filter a background tab re-simplifying its rows would
// redraw the sidebar against a table the user cannot see. The sidebar serves
// its bound tab alone.
//
// The tabs interface and the event bus arrive as parameters so the whole
// concern runs in the suite with stubs, without the sidebar's page elements.
function createBoundTab(tabsApi, bus) {
  let boundTabId = null;
  let boundWindowId = null;

  // A message with no tab ID came from an extension page.
  function isBoundTabMessage(meta) {
    return boundTabId !== null && !!meta && meta.tabId === boundTabId;
  }

  return {
    // Record the tab the sidebar was opened for, and the window holding it,
    // then run onReady. The order is load-bearing: the read reaches the page,
    // the page publishes back, and a message arriving before the tab ID
    // exists has nothing to be compared against. No tab to bind to leaves the
    // tab ID unset and still runs the read, which falls to the unbound state
    // on its own when nothing answers it.
    resolve(onReady) {
      if (!tabsApi || typeof tabsApi.query !== 'function') {
        onReady();
        return;
      }
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
        // A throw after the query answered came from the read, so it is thrown
        // again: running the read a second time would send its messages
        // twice, and swallowing the throw would hide a broken read behind a
        // working tab lookup. A throw before the answer means the extension
        // context is not available, and the read still runs.
        if (answered) throw e;
        onReady();
      }
    },

    // Subscribe to one of the content script's topics. Every such message
    // passes through here, so the comparison lives in one place rather than
    // at each subscription.
    subscribe(topic, handler) {
      return bus.subscribe(topic, (payload, meta) => {
        if (!isBoundTabMessage(meta)) return;
        handler(payload, meta);
      });
    },

    // null before the lookup answers, and when there was no tab to bind to.
    tabId() {
      return boundTabId;
    },

    // The window the bound tab sits in: null before the lookup answers, and
    // null when the tabs interface reports no window. saveCapture passes this
    // window to the screenshot take, and its front tab is the bound tab by
    // construction — the sidebar closes when that tab leaves the front.
    windowId() {
      return boundWindowId;
    },

    // Close the sidebar when the tab it was opened for leaves the front,
    // reloads or navigates, or closes. Each sidebar listens for its own tab's
    // events, so a sidebar in another window stays open. The service worker
    // holds no tab listener: Chrome empties its variables after an idle spell,
    // and a sidebar opened from Chrome's own side-panel control never reaches
    // it.
    //
    // The activation event fires for every window, and an activation in
    // another window leaves the bound tab in front of its own. A tabs
    // interface reporting no window leaves the comparison on the tab alone.
    //
    // With no tab recorded there is nothing to have left, so nothing closes.
    onLeave(onLeft) {
      if (!tabsApi) return;
      const listen = (event, hasLeft) => {
        if (!event || typeof event.addListener !== 'function') return;
        event.addListener((...args) => {
          if (boundTabId !== null && hasLeft(...args)) onLeft();
        });
      };
      listen(tabsApi.onActivated, (activeInfo) => !!activeInfo &&
        (boundWindowId === null || activeInfo.windowId === boundWindowId) &&
        activeInfo.tabId !== boundTabId);
      listen(tabsApi.onUpdated, (tabId, changeInfo) =>
        tabId === boundTabId && !!changeInfo && changeInfo.status === 'loading');
      listen(tabsApi.onRemoved, (tabId) => tabId === boundTabId);
    },
  };
}

const boundTab = createBoundTab(chrome.tabs, DR_BUS);

// Write the status line, or clear it with ''. A message with a source holds
// the line against every write without one until clearStatus() runs for that
// source, because Chrome does not order the content script's range message
// against the answer to a settings apply. The one source is 'range', for a
// range error. Returns whether the line now holds the text.
function writeStatus(text, source) {
  if (source === undefined && statusEl.dataset.source) return false;
  statusEl.textContent = text;
  if (source !== undefined) statusEl.dataset.source = source;
  return true;
}

// Clear the status line when a message from the source holds it. With no
// source, clear any message.
function clearStatus(source) {
  if (source !== undefined && statusEl.dataset.source !== source) return;
  statusEl.textContent = '';
  delete statusEl.dataset.source;
}

// Clear the status line when it shows the text. Each caller's text is written
// with no source, so the line holds no source while it shows that text.
function clearStatusShowing(text) {
  if (statusEl.textContent === text) writeStatus('');
}

function setTableBound(isBound) {
  document.body.classList.toggle(UNBOUND_CLASS, !isBound);
  if (!isBound) {
    // No bound table: there is nothing to simplify, so the sidebar pillbox
    // shows off.
    clearStatus();
    enabledEl.checked = false;
    writeStatus(UNBOUND_STATUS_MSG);
  } else {
    // The sidebar pillbox is not touched here, so binding leaves the value the
    // controls already show.
    clearStatusShowing(UNBOUND_STATUS_MSG);
  }
  updateDisabledState();
}

// Each switch's element id is its setting's name. constants.js holds the rule
// that makes every "simplify" key a switch.
const SWITCH_NAMES = Object.keys(DR_DEFAULTS).filter((key) => key.startsWith('simplify'));

function forEachSwitch(fn) {
  for (const name of SWITCH_NAMES) fn(name, document.getElementById(name));
}

const simplifyDatesEl = document.getElementById('simplifyDates');
const simplifyTimesEl = document.getElementById('simplifyTimes');
const dateGranularityEl = document.getElementById('dateGranularity');
const timeGranularityEl = document.getElementById('timeGranularity');
const rangeExprEl = document.getElementById('rangeExpr');

// ----- Coupled lens control -----
// Stops are ordered so the *step* changes monotonically across the
// track (finest step on the left, coarsest on the right), NOT by offset value.
// stepForOffset is non-monotonic in the offset because half-step offsets
// interleave with the integer ones: e.g. at an order of magnitude of 6 the
// steps run
//   -2:10k  -1.5:50k  -1:100k  -0.25:250k  -0.5:500k
//    0:1M   0.25:2.5M  0.5:5M    1:10M
// Hence -0.25 precedes -0.5.
const STOPS = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];

const lensControlEl = document.getElementById('lensControl');
const topThumb = document.getElementById('topThumb');
const otherThumb = document.getElementById('otherThumb');
const trackEl = document.getElementById('dualWrap').querySelector('.dual-track');

let topVal = DR_DEFAULTS.offsetTop;
let otherVal = DR_DEFAULTS.offsetOther;
let coupled = true;

function snap(v) {
  let best = STOPS[0];
  let bestDist = Infinity;
  for (const s of STOPS) {
    const d = Math.abs(s - v);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}
// The track position of a stop, as a percentage of the track width: the
// centre of its column. Every stop has a column of equal width, one per tick,
// because the stop values are unevenly spaced. A value off the stops counts as
// its nearest stop.
function stopPosition(v) {
  const k = STOPS.indexOf(snap(v));
  return (k + 0.5) / STOPS.length * 100;
}

// The stop whose column holds a point on the track. The ratio is the point's
// distance from the track's left end, as a share of the track width.
function stopAtRatio(ratio) {
  return stopAt(Math.floor(ratio * STOPS.length));
}

// An index past either end takes that end's stop.
function stopAt(k) {
  return STOPS[Math.max(0, Math.min(STOPS.length - 1, k))];
}

function renderLensControl() {
  topThumb.style.left = stopPosition(topVal) + '%';
  otherThumb.style.left = stopPosition(otherVal) + '%';
  otherThumb.classList.toggle('coupled', coupled);
  lensControlEl.classList.toggle('coupled', coupled);
  topThumb.setAttribute('aria-valuenow', String(topVal));
  otherThumb.setAttribute('aria-valuenow', String(otherVal));
  renderLensPreview();
}

// ----- Lens preview -----
const topPreviewEl = document.getElementById('topPreview');
const otherPreviewEl = document.getElementById('otherPreview');
let cachedSamples = null;
let cachedMaxMag = null;

const PREVIEW_DECIMAL_THRESHOLD = 100;
const PREVIEW_MAX_DECIMALS = 4;

// A value at or above PREVIEW_DECIMAL_THRESHOLD shows no decimals; a smaller
// one shows at most PREVIEW_MAX_DECIMALS. Both cut digits off, never round.
function formatSample(num) {
  const abs = Math.abs(num);
  const marks = numberFormat();
  const intStr = groupedNumberText(Math.trunc(abs));
  // toString() gives the shortest decimal that reads back as the same value,
  // so cutting its text truncates without rounding. A value it writes in
  // exponent form, such as 1e-7, holds no digit within the decimals shown.
  const text = abs.toString();
  const dot = text.indexOf('.');
  const fracStr = abs < PREVIEW_DECIMAL_THRESHOLD && dot !== -1 && !/e/i.test(text)
    ? text.slice(dot + 1, dot + 1 + PREVIEW_MAX_DECIMALS).replace(/0+$/, '')
    : '';
  // A negative value that truncates to 0 shows "0", never "-0".
  const sign = num < 0 && (intStr !== '0' || fracStr !== '') ? '-' : '';
  return sign + intStr + (fracStr === '' ? '' : marks.decimal + fracStr);
}

const OOM_LABEL_CLASS = 'oom-label';
const STEP_LABEL_CLASS = 'step-label';
const STEP_HEADER_CLASS = 'step-header';

// e.g. mag=5 → "100k+", mag=3 → "1k+", mag=0 → "1+", mag=-1 → "0.1+"
function formatOomLabel(mag) {
  return formatStep(Math.pow(10, mag)) + '+';
}

// Append one row to a lens preview element: a from cell, an arrow cell, and a
// num cell. Returns the from and num cells, for a label to go inside.
function appendSampleRow(el, className, fromText, numText) {
  const row = document.createElement('div');
  row.className = className;
  const cells = {};
  for (const [cellClass, text] of [['from', fromText], ['arrow', '→'], ['num', numText]]) {
    const cell = document.createElement('span');
    cell.className = cellClass;
    cell.textContent = text;
    row.appendChild(cell);
    cells[cellClass] = cell;
  }
  el.appendChild(row);
  return cells;
}

// The step header on the first line, and one worked example on the second.
// The content script sends a max magnitude whenever it sends a sample.
function renderTopPreview(el, rows, offset, maxMag) {
  el.innerHTML = '';
  if (!rows || rows.length === 0) return;

  const step = stepForOffset(Math.pow(10, maxMag), offset);
  appendSampleRow(el, 'row ' + STEP_HEADER_CLASS,
    formatOomLabel(maxMag), 'nearest ' + formatStep(step));
  const num = rows[0].num;
  appendSampleRow(el, 'row example',
    'e.g. ' + formatSample(num), formatSample(roundWithOffset(num, offset)));
}

// One line per sample: the sample with its order of magnitude label, then the
// rounded value with the step it rounds to, e.g. "5,234 (1k+) → 5,000 (500)".
function renderOtherPreview(el, rows, offset) {
  el.innerHTML = '';
  if (!rows || rows.length === 0) return;

  for (const { num } of rows) {
    const cells = appendSampleRow(el, 'row',
      formatSample(num), formatSample(roundWithOffset(num, offset)));
    appendLabel(cells.from, OOM_LABEL_CLASS, formatOomLabel(magnitudeOf(num)));
    appendLabel(cells.num, STEP_LABEL_CLASS, formatStep(stepForOffset(num, offset)));
  }
}

// Append a bracketed label, such as " (100k+)", to a lens preview cell.
function appendLabel(cell, className, text) {
  const label = document.createElement('span');
  label.className = className;
  label.textContent = ' (' + text + ')';
  cell.appendChild(label);
}

function renderLensPreview() {
  renderTopPreview(topPreviewEl, cachedSamples && cachedSamples.top, topVal, cachedMaxMag);
  renderOtherPreview(otherPreviewEl, cachedSamples && cachedSamples.bottom, otherVal);
}

// Redraw the sidebar from one read of the active table. With no answer, which
// means no content script on the tab, the sidebar shows the shipped defaults,
// unbound. The bound state follows the samples alone, and it is set after the
// controls, because an unbound sidebar shows its sidebar pillbox off whatever
// the settings hold.
//
// keepControls leaves the controls as they stand. It is set for the echo of
// the sidebar's own write, whose settings are older than a keystroke or lens
// control move made after that write.
function redrawFromActiveTable(keepControls) {
  DR_BUS.request('request:activeTable', {}, (answer) => {
    cachedSamples = answer ? answer.samples : null;
    cachedMaxMag = answer ? answer.maxMag : null;
    if (keepControls) renderLensPreview();
    else drawControls(answer ? answer.settings : null);
    setTableBound(cachedSamples !== null);
  }, { tabId: boundTab.tabId() });
}

function decouple() {
  if (coupled) {
    coupled = false;
    renderLensControl();
  }
}
function recoupleIfMatched() {
  if (!coupled && otherVal === topVal) {
    coupled = true;
    renderLensControl();
  }
}

// Move the 'top' or 'other' thumb to a stop, then redraw and apply. While the
// lens control is coupled, a move of the top thumb moves the other thumb with
// it.
function setThumbValue(which, stop) {
  if (which === 'top') {
    if (topVal === stop && (!coupled || otherVal === stop)) return;
    topVal = stop;
    if (coupled) otherVal = stop;
  } else {
    if (otherVal === stop) return;
    otherVal = stop;
  }
  renderLensControl();
  applyNow();
}

function startDrag(which) {
  return function (e) {
    if (e.cancelable) e.preventDefault();
    if (which === 'other') decouple();
    const rect = trackEl.getBoundingClientRect();
    const target = which === 'top' ? topThumb : otherThumb;
    if (target.setPointerCapture && e.pointerId !== undefined) {
      try { target.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function move(ev) {
      setThumbValue(which, stopAtRatio((ev.clientX - rect.left) / rect.width));
    }
    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      recoupleIfMatched();
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    move(e);
  };
}

function moveThumbByKey(which, delta) {
  const cur = which === 'top' ? topVal : otherVal;
  const next = stopAt(STOPS.indexOf(cur) + delta);
  if (which === 'other') decouple();
  setThumbValue(which, next);
  recoupleIfMatched();
}

function thumbKeyHandler(which) {
  return (e) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1;
    if (delta === 0) return;
    e.preventDefault();
    moveThumbByKey(which, delta);
  };
}

for (const [which, thumb] of [['top', topThumb], ['other', otherThumb]]) {
  thumb.addEventListener('pointerdown', startDrag(which));
  thumb.addEventListener('keydown', thumbKeyHandler(which));
}

// The values the controls hold. The settings payload and the capture's
// sidebar snapshot both read them here.
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
  // sidebar control; it carries the shipped default.
  return Object.assign({ enabled: controls.enabled }, controls.switches, {
    dateGranularity: controls.dateGranularity,
    timeGranularity: controls.timeGranularity,
    offsetTop: topVal,
    offsetOther: otherVal,
    numTop: DR_DEFAULTS.numTop,
    rangeExpr: controls.rangeExpr,
  });
}

function updateDisabledState() {
  optionsSection.classList.toggle('disabled', !enabledEl.checked);
  // Granularity dropdown only matters when the row's switch is on.
  dateGranularityEl.disabled = !simplifyDatesEl.checked;
  timeGranularityEl.disabled = !simplifyTimesEl.checked;
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
  }, { tabId: boundTab.tabId() });
}

function onCheckedChange() {
  updateDisabledState();
  applyNow();
}

enabledEl.addEventListener('change', onCheckedChange);
forEachSwitch((name, el) => { el.addEventListener('change', onCheckedChange); });

dateGranularityEl.addEventListener('change', applyNow);
timeGranularityEl.addEventListener('change', applyNow);

rangeExprEl.addEventListener('input', applyNow);

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

boundTab.subscribe('state:tableActivated', () => {
  flashSidebarContainer();
  redrawFromActiveTable();
});

boundTab.subscribe('state:settingsChanged', ({ source }) => {
  redrawFromActiveTable(source === 'sidebar');
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
  redrawFromActiveTable();
});

boundTab.subscribe('state:tableSwitched', () => {
  DR_LOG.debug(DR_LOG.formatRow('table switch'));
  redrawFromActiveTable();
});

// Draw every control from a settings object. A field the settings lack takes
// the shipped default.
function drawControls(settings) {
  const s = Object.assign({}, DR_DEFAULTS, settings || {});
  enabledEl.checked = s.enabled;
  forEachSwitch((name, el) => { el.checked = !!s[name]; });
  dateGranularityEl.value = s.dateGranularity;
  timeGranularityEl.value = s.timeGranularity;
  topVal = snap(s.offsetTop);
  otherVal = snap(s.offsetOther);
  coupled = (topVal === otherVal);
  renderLensControl();
  rangeExprEl.value = s.rangeExpr;
}

// ----- Capture (the bug-report file) -----
// Three marks; pressing one unfolds the remarks form; the finish press alone
// writes the capture file. The capture stays available with no table bound —
// an empty registry is exactly what a "found no table" report must show.

const captureFormEl = document.getElementById('captureForm');
const captureMarkEls = Array.from(document.querySelectorAll('.capture-mark'));
const captureRemarksEl = document.getElementById('captureRemarks');
const captureSaveEl = document.getElementById('captureSave');
const captureCancelEl = document.getElementById('captureCancel');
const captureSizeNoteEl = document.getElementById('captureSizeNote');

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

// Typed remarks survive a fold, so an accidental cancel loses nothing; a
// completed save clears them.
function foldCaptureForm() {
  captureMark = null;
  renderCaptureMarks();
}

// Each mark press that leaves the form open pulls the capture state, only to
// measure it: a heavy page renders a file in the tens of megabytes, and the
// person about to press finish reads the size estimate before the save, not
// after. The finish press pulls fresh; this response is never reused. A
// failed pull here shows no note — finish logs its own pull failure.
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
  }, { tabId: boundTab.tabId() });
}

for (const el of captureMarkEls) {
  el.addEventListener('click', () => {
    captureMark = el.dataset.mark === captureMark ? null : el.dataset.mark;
    if (captureMark !== null) refreshCaptureSizeNote();
    renderCaptureMarks();
  });
}

captureCancelEl.addEventListener('click', foldCaptureForm);

// An anchor, not chrome.downloads: that permission gates the API, and the
// download attribute is honored for a blob made on an extension page. The
// delayed revoke gives the browser time to read the blob.
function saveCaptureFile(filename, html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// The sidebar snapshot: what the sidebar view showed at finish, read from this
// page's controls and variables.
function collectSidebarSnapshot() {
  return Object.assign(readControls(), {
    stops: STOPS.slice(),
    topVal: topVal,
    botVal: otherVal,
    coupled: coupled,
    status: statusEl.textContent,
    noTable: document.body.classList.contains(UNBOUND_CLASS),
    lensPreview: {
      top: Array.from(topPreviewEl.children).map((n) => n.textContent),
      bottom: Array.from(otherPreviewEl.children).map((n) => n.textContent),
    },
  });
}

// JPEG at this quality keeps table text legible and holds a laptop viewport
// near a few hundred kilobytes; PNG runs three to six times larger on a
// text-heavy page.
const CAPTURE_SCREENSHOT_QUALITY = 85;

// The bound tab's visible area as one image data URL, for the capture. The
// tabs interface arrives as a parameter so the suite drives this with a
// stub. chrome.tabs.captureVisibleTab runs from extension pages, and Chrome
// settles its promise on every documented failure (no grant, quota,
// protected page), so no timer guards it.
function takeCaptureScreenshot(tabsApi, windowId, done) {
  const fail = (reason) => {
    const text = reason && reason.message ? reason.message : String(reason);
    DR_LOG.warnError('screenshot', reason);
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

const CAPTURE_SAVED_STATUS_MSG = 'Capture saved.';

// One capture state from the page's half (the request:captureState answer,
// or null when the pull failed), this page's half, and the screenshot take's
// answer. The image passes to the renderer beside the state, never inside
// it (see renderScreenshotSection in lib/dr-capture/render.js).
function assembleAndSaveCapture(mark, remarks, pageState, shot) {
  const at = new Date();
  const state = Object.assign(DR_CAPTURE.emptyPageHalf(), pageState || {});
  state.meta = {
    url: state.page ? state.page.url : null,
    title: state.page ? state.page.title : null,
    version: chrome.runtime.getManifest().version,
    platform: navigator.userAgent,
    at: at.toISOString(),
  };
  state.mark = mark;
  state.remarks = remarks;
  state.screenshot = shot.record;
  state.sidebarSnapshot = collectSidebarSnapshot();
  // The two contexts' rows stay in separate lists, so a reader sees which
  // context wrote each row.
  state.log = {
    content: pageState ? pageState.log || null : null,
    sidebar: DR_LOG.copyBuffer(),
  };
  // A failure while building or saving the file shows on the status line
  // and is logged; the form stays open with the typed remarks, so a retry
  // costs nothing.
  try {
    const html = DR_CAPTURE.buildCaptureDocument({
      state: state,
      screenshotDataUrl: shot.dataUrl,
    });
    saveCaptureFile(DR_CAPTURE.filenameFor({ at: at, url: state.meta.url, mark: mark }), html);
  } catch (e) {
    DR_LOG.warnError('capture save', e);
    writeStatus('Capture failed; nothing was saved.');
    return;
  }
  foldCaptureForm();
  captureRemarksEl.value = '';
  if (writeStatus(CAPTURE_SAVED_STATUS_MSG)) {
    setTimeout(() => clearStatusShowing(CAPTURE_SAVED_STATUS_MSG), 2500);
  }
}

// The state pull and the screenshot take run side by side; the save runs
// once both have answered, whichever answers first. A failure of either never
// blocks the save; each answer is a fact the capture holds: a pull with no
// answer saves with the page half as an absence, a take that fails saves with
// the reason in the record.
function saveCapture() {
  if (captureMark === null) return;
  const mark = captureMark;
  const remarks = captureRemarksEl.value;
  let pageAnswer = null;
  let shot = null;
  let pending = 2;
  const settle = () => {
    pending -= 1;
    if (pending === 0) assembleAndSaveCapture(mark, remarks, pageAnswer, shot);
  };
  DR_BUS.request('request:captureState', {}, (answer) => {
    if (!answer) DR_LOG.warnError('state pull');
    pageAnswer = answer || null;
    settle();
  }, { tabId: boundTab.tabId() });
  takeCaptureScreenshot(chrome.tabs, boundTab.windowId(), (result) => {
    shot = result;
    settle();
  });
}

captureSaveEl.addEventListener('click', saveCapture);
renderCaptureMarks();

setTableBound(false);

// Defensively clear rangeExpr so browser autofill can never leak a stale
// value into a hidden field before the redraw read below (which sets it
// from the model) resolves.
rangeExprEl.value = '';

boundTab.resolve(() => {
  redrawFromActiveTable();
  boundTab.onLeave(() => { window.close(); });
});
