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

function setTableBound(isBound) {
  document.body.classList.toggle(NO_TABLE_CLASS, !isBound);
  if (!isBound) {
    // No active table: there is nothing for rounding to act on, so flip the
    // main toggle to its off state rather than dimming the whole sidebar.
    enabledEl.checked = false;
    statusEl.textContent = NO_TABLE_STATUS_MSG;
  } else {
    // A table is now bound: restore the toggle to the shared default (the
    // per-table state then arrives via TABLE_TOGGLE_STATE / reset).
    enabledEl.checked = DR_DEFAULTS.enabled !== false;
    if (statusEl.textContent === NO_TABLE_STATUS_MSG) {
      statusEl.textContent = '';
    }
  }
  updateDisabledState();
}

const CHECKBOX_TO_SETTING = {
  simplifyMixedCells: 'simplifyMixedCells',
  simplifyMixedCurrency: 'simplifyMixedCurrency',
  simplifyMixedPercent: 'simplifyMixedPercent',
  simplifyFirstRow: 'simplifyFirstRow',
  simplifyFirstColumn: 'simplifyFirstColumn',
  simplifyDates: 'simplifyDates',
  simplifyTimes: 'simplifyTimes'
};

const dateGranularityEl = document.getElementById('dateGranularity');
const timeGranularityEl = document.getElementById('timeGranularity');
const rangeExprEl = document.getElementById('rangeExpr');

// ----- Variant F: linked dual-thumb sliders -----
// Stops are ordered so the *rounding strategy* changes monotonically across the
// track (finest step on the left, coarsest on the right), NOT by offset value.
// stepForOffset is non-monotonic in the offset because half-step offsets
// interleave with the integer ones: e.g. at mag 6 the steps run
//   -2:10k  -1.5:50k  -1:100k  -0.25:250k  -0.5:500k  -0.75:750k
//    0:1M   0.25:2.5M  0.5:5M   0.75:7.5M    1:10M
// Hence -0.25 precedes -0.5 precedes -0.75, and -1 sits right after -1.5.
const STOPS = [-2, -1.5, -1, -0.25, -0.5, -0.75, 0, 0.25, 0.5, 0.75, 1];
const DEFAULT_OFFSET = -0.5;

const sliderBlockEl = document.getElementById('sliderBlock');
const dualWrap = document.getElementById('dualWrap');
const topThumb = document.getElementById('topThumb');
const botThumb = document.getElementById('botThumb');
const trackEl = dualWrap ? dualWrap.querySelector('.dual-track') : null;
const topLabelEl = document.getElementById('topLabel');
const botLabelEl = document.getElementById('botLabel');

let topVal = DEFAULT_OFFSET;
let botVal = DEFAULT_OFFSET;
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
function pct(v) {
  // Map each stop to the centre of its grid cell so thumb centres sit exactly
  // over the tick marks. The stops are unevenly spaced, so we position by the
  // stop's index in STOPS (equal columns) rather than by its numeric value:
  // cell k centre = (k + 0.5) / N of the track width. With N = STOPS.length
  // this places the first stop and last stop at half-cell insets from each end.
  let k = STOPS.indexOf(v);
  if (k === -1) k = STOPS.indexOf(snap(v));
  return (k + 0.5) / STOPS.length * 100;
}
function renderSliders() {
  if (!topThumb || !botThumb) return;
  topThumb.style.left = pct(topVal) + '%';
  botThumb.style.left = pct(botVal) + '%';
  botThumb.classList.toggle('linked', linked);
  if (sliderBlockEl) sliderBlockEl.classList.toggle('linked', linked);
  if (topLabelEl) topLabelEl.textContent = 'largest numbers';
  if (botLabelEl) botLabelEl.textContent = 'all other numbers';
  if (topThumb) topThumb.setAttribute('aria-valuenow', String(topVal));
  if (botThumb) botThumb.setAttribute('aria-valuenow', String(botVal));
  renderPreviewBands();
}

// ----- Preview band -----
const topBandEl = document.getElementById('topBand');
const botBandEl = document.getElementById('botBand');
const PREVIEW_NUM_TOP = 1;
let cachedSamples = null;
let cachedMaxMag = null;

const PREVIEW_DECIMAL_THRESHOLD = 100;
const PREVIEW_MAX_DECIMALS = 4;

function formatNumberWithCommas(n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const frac = abs - intPart;
  const intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (frac === 0) return sign + intStr;
  const fracStr = String(frac).slice(1).replace(/0+$/, '');
  return sign + intStr + (fracStr === '.' ? '' : fracStr);
}

function truncateDecimals(n) {
  if (Math.abs(n) >= PREVIEW_DECIMAL_THRESHOLD) {
    return Math.trunc(n);
  }
  return Math.trunc(n * Math.pow(10, PREVIEW_MAX_DECIMALS)) / Math.pow(10, PREVIEW_MAX_DECIMALS);
}

function formatOriginal(numOrStr) {
  const parsed = toNumber(numOrStr);
  if (parsed === null || !isFinite(parsed)) return String(numOrStr);
  const sign = parsed < 0 ? '-' : '';
  const abs = Math.abs(parsed);
  if (abs >= PREVIEW_DECIMAL_THRESHOLD) {
    // Integer-only display: reuse formatNumberWithCommas on the truncated integer.
    return formatNumberWithCommas(Math.trunc(parsed));
  }
  // For |n| < 100: use abs.toString() which gives the shortest faithful
  // round-trip decimal representation without rounding. Then truncate (not
  // round) the decimal string to PREVIEW_MAX_DECIMALS digits via string slice.
  const s = abs.toString();
  // If the string is in scientific notation (e.g. 1e-7), the value has no
  // significant digits within 4 decimal places; treat fractional part as empty.
  let intPart, fracStr;
  if (s.indexOf('e') !== -1 || s.indexOf('E') !== -1) {
    intPart = String(Math.trunc(abs));
    fracStr = '';
  } else {
    const dotIdx = s.indexOf('.');
    if (dotIdx === -1) {
      intPart = s;
      fracStr = '';
    } else {
      intPart = s.slice(0, dotIdx);
      // Pure string truncation — no rounding.
      fracStr = s.slice(dotIdx + 1, dotIdx + 1 + PREVIEW_MAX_DECIMALS);
    }
  }
  // Strip trailing zeros so "1.5000" -> "1.5", "1.0000" -> "" (no dot).
  fracStr = fracStr.replace(/0+$/, '');
  // Apply thousands commas to the integer part.
  const intStr = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fracStr === '') {
    // Guard against "-0": sign is only emitted when there is a non-zero result.
    const result = sign + intStr;
    return result === '-0' ? '0' : result;
  }
  return sign + intStr + '.' + fracStr;
}

// CSS class name constants for band colouring.
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
  } else if (val >= 1) {
    str = trimNum(val);
  } else {
    // Sub-integer magnitudes: e.g. mag=-1 → 0.1, mag=-2 → 0.01
    str = trimNum(val);
  }
  return str + '+';
}

/**
 * Build the strategy header string for the top band, e.g.
 * "1M+ → nearest 500k". The descriptive "(i.e. a half of 1M)" clause was
 * removed per issue #1 — the OoM label and step alone convey the strategy.
 */
function formatStrategyHeader(maxMag, offset) {
  const step = stepForOffset(Math.pow(10, maxMag), offset);
  return formatOomLabel(maxMag) + ' → nearest ' + formatStep(step);
}

/**
 * Render the top preview band: the strategy header (blue) and a single worked
 * example ("e.g. <original> → <rounded>", black) share one line, wrapping to
 * two lines only when the sidebar is too narrow to fit both. The example
 * carries no step annotation and shows the bare original number (text stripped
 * per #3).
 */
function renderTopBand(el, rows, offset) {
  if (!el) return;
  el.innerHTML = '';
  if (!rows || rows.length === 0) return;

  // Strategy header, e.g. "1M+ → nearest 250k". Kept whole (nowrap) so it never
  // breaks mid-phrase; the flex container wraps it as a unit beside the example.
  if (cachedMaxMag !== null && cachedMaxMag !== undefined) {
    const headerEl = document.createElement('span');
    headerEl.className = STRATEGY_CLASS;
    headerEl.textContent = formatStrategyHeader(cachedMaxMag, offset);
    el.appendChild(headerEl);
  }

  // Single example (PREVIEW_NUM_TOP = 1), grouped in one nowrap span so the
  // whole "e.g. … → …" wraps to the next line as a unit when space is tight.
  const row = rows[0];
  const example = document.createElement('span');
  example.className = 'example';

  const from = document.createElement('span');
  from.className = 'from';
  // Bare original number (text stripped per #3), prefixed "e.g." per #1.
  from.textContent = 'e.g. ' + formatOriginal(row.num);
  example.appendChild(from);

  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '→';
  example.appendChild(arrow);

  const numEl = document.createElement('span');
  numEl.className = 'num';
  numEl.textContent = formatOriginal(roundWithOffset(row.num, offset));
  example.appendChild(numEl);

  el.appendChild(example);
}

/**
 * Render the bottom preview band: rows sorted DESCENDING by magnitude, each
 * showing the bare original number with its OoM label (kept per the issue #3
 * decision — strip the largest band, keep the tag for the other numbers). A
 * brown trailing step annotation — "(5k)" — follows the rounded number to show
 * what each example rounds to the nearest of.
 */
function renderBotBand(el, rows, offset, maxMag) {
  if (!el) return;
  el.innerHTML = '';
  if (!rows || rows.length === 0) return;

  // Sort descending by OoM magnitude so higher-magnitude rows appear first.
  const sorted = rows.slice().sort((a, b) => {
    const magA = a.num !== 0 ? Math.floor(Math.log10(Math.abs(a.num))) : -Infinity;
    const magB = b.num !== 0 ? Math.floor(Math.log10(Math.abs(b.num))) : -Infinity;
    return magB - magA;
  });

  for (const row of sorted) {
    const pair = document.createElement('div');
    pair.className = 'pair';

    // "from" cell: "266,453 (100k+)" where the OoM label is brown. The bare
    // original number is shown (surrounding text stripped per #3).
    const from = document.createElement('span');
    from.className = 'from';
    from.textContent = formatOriginal(row.num);
    if (row.num !== 0) {
      const mag = Math.floor(Math.log10(Math.abs(row.num)));
      const oomSpan = document.createElement('span');
      oomSpan.className = OOM_LABEL_CLASS;
      oomSpan.textContent = ' (' + formatOomLabel(mag) + ')';
      from.appendChild(oomSpan);
    }
    pair.appendChild(from);

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    pair.appendChild(arrow);

    const numEl = document.createElement('span');
    numEl.className = 'num';
    numEl.textContent = formatOriginal(roundWithOffset(row.num, offset));
    // "(5k)" brown step label: the value this example rounds to the nearest of.
    if (row.num !== 0) {
      const stepEl = document.createElement('span');
      stepEl.className = STEP_LABEL_CLASS;
      stepEl.textContent = ' (' + formatStep(stepForOffset(row.num, offset)) + ')';
      numEl.appendChild(stepEl);
    }
    pair.appendChild(numEl);

    el.appendChild(pair);
  }
}

function renderPreviewBands() {
  if (!topBandEl || !botBandEl) return;
  if (!cachedSamples) {
    topBandEl.innerHTML = '';
    botBandEl.innerHTML = '';
    return;
  }
  renderTopBand(topBandEl, cachedSamples.top, topVal);
  renderBotBand(botBandEl, cachedSamples.bottom, botVal, cachedMaxMag);
}

function fetchPreviewSamples() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_PREVIEW_SAMPLES' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        cachedSamples = null;
        cachedMaxMag = null;
        setTableBound(false);
      } else {
        cachedSamples = response.samples;
        cachedMaxMag = response.maxMag;
        setTableBound(response.samples !== null);
      }
      renderPreviewBands();
    });
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

function startDrag(which) {
  return function (e) {
    if (!trackEl) return;
    if (e.cancelable) e.preventDefault();
    if (which === 'bot' && linked) decouple();
    const rect = trackEl.getBoundingClientRect();
    const target = which === 'top' ? topThumb : botThumb;
    if (target && target.setPointerCapture && e.pointerId !== undefined) {
      try { target.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function move(ev) {
      const clientX = ev.clientX !== undefined
        ? ev.clientX
        : (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      // Equal columns: the track is divided into STOPS.length cells; the cell
      // the pointer is over selects its stop. Mirrors pct()'s index geometry.
      const idx = Math.max(0, Math.min(STOPS.length - 1, Math.floor(ratio * STOPS.length)));
      const snapped = STOPS[idx];
      if (which === 'top') {
        if (topVal === snapped && (!linked || botVal === snapped)) return;
        topVal = snapped;
        if (linked) botVal = snapped;
      } else {
        if (botVal === snapped) return;
        botVal = snapped;
      }
      renderSliders();
      applyNow();
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
  const arr = STOPS;
  const cur = which === 'top' ? topVal : botVal;
  const idx = Math.max(0, Math.min(arr.length - 1, arr.indexOf(cur) + delta));
  const next = arr[idx];
  if (which === 'top') {
    if (topVal === next && (!linked || botVal === next)) return;
    topVal = next;
    if (linked) botVal = next;
  } else {
    if (linked) decouple();
    if (botVal === next) return;
    botVal = next;
  }
  renderSliders();
  applyNow();
  relinkIfMatched();
}

if (topThumb) {
  topThumb.addEventListener('pointerdown', startDrag('top'));
  topThumb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); keyboardStep('top', 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); keyboardStep('top', -1); }
  });
}
if (botThumb) {
  botThumb.addEventListener('pointerdown', startDrag('bot'));
  botThumb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); keyboardStep('bot', 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); keyboardStep('bot', -1); }
  });
}

function currentSettings() {
  const settings = { enabled: enabledEl.checked };
  for (const id in CHECKBOX_TO_SETTING) {
    const el = document.getElementById(id);
    if (el) settings[CHECKBOX_TO_SETTING[id]] = el.checked;
  }
  if (dateGranularityEl) settings.dateGranularity = dateGranularityEl.value;
  if (timeGranularityEl) settings.timeGranularity = timeGranularityEl.value;
  // Always emit concrete numbers — never null/blank — so content.js never falls
  // back to the "offset_other inherits from offset_top" branch (the original
  // bleed bug). num_top is no longer surfaced in the UI; pin it to 1.
  settings.offsetTop = topVal;
  settings.offsetOther = botVal;
  settings.numTop = 1;
  settings.rangeExpr = rangeExprEl ? rangeExprEl.value : '';
  return settings;
}

function updateDisabledState() {
  optionsSection.classList.toggle('disabled', !enabledEl.checked);
  // Granularity dropdown only matters when the row's toggle is on
  // (i.e. that type's cells are bucketed by the selected granularity).
  if (dateGranularityEl) {
    dateGranularityEl.disabled = !document.getElementById('simplifyDates').checked;
  }
  if (timeGranularityEl) {
    timeGranularityEl.disabled = !document.getElementById('simplifyTimes').checked;
  }
}

function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      statusEl.textContent = 'No active tab.';
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, message, () => {
      if (chrome.runtime.lastError) {
        setTableBound(false);
      } else {
        statusEl.textContent = '';
      }
    });
  });
}

function applyNow() {
  sendToActiveTab({ action: 'APPLY_SIDEBAR_SETTINGS', settings: currentSettings() });
}

enabledEl.addEventListener('change', () => {
  updateDisabledState();
  applyNow();
});

for (const id in CHECKBOX_TO_SETTING) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => {
    updateDisabledState();
    applyNow();
  });
}

if (dateGranularityEl) dateGranularityEl.addEventListener('change', applyNow);
if (timeGranularityEl) timeGranularityEl.addEventListener('change', applyNow);

// Apply on any range-expression keystroke (the previous live-update behavior).
if (rangeExprEl) rangeExprEl.addEventListener('input', applyNow);

document.body.addEventListener('click', (e) => {
  if (e.target.matches('input, select, option, summary')) return;
  if (e.target.closest && e.target.closest('.dual-wrap')) return;
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TABLE_ACTIVATED') {
    flashSidebarContainer();
  } else if (request.action === 'CLOSE_SIDEBAR') {
    window.close();
  } else if (request.action === 'GET_SIDEBAR_SETTINGS') {
    sendResponse({ settings: currentSettings() });
  } else if (request.action === 'RANGE_ERROR') {
    statusEl.textContent = request.error || 'Invalid range expression.';
    statusEl.dataset.source = 'range';
    if (rangeExprEl) rangeExprEl.classList.add('invalid');
  } else if (request.action === 'RANGE_OK') {
    if (rangeExprEl) rangeExprEl.classList.remove('invalid');
    if (statusEl.dataset.source === 'range') {
      statusEl.textContent = '';
      delete statusEl.dataset.source;
    }
  } else if (request.action === 'PREVIEW_SAMPLES_CHANGED') {
    fetchPreviewSamples();
  } else if (request.action === 'RESET_SIDEBAR_TO_DEFAULTS') {
    try {
      applyDefaultsToUI();
      fetchPreviewSamples();
    } catch (e) {
      // sidebar may be in teardown; harmless
    }
  } else if (request.action === 'TABLE_TOGGLE_STATE') {
    enabledEl.checked = request.enabled;
    updateDisabledState();
  }
});

window.addEventListener('unload', () => {
  try {
    chrome.runtime.sendMessage({ action: 'SIDEBAR_CLOSED' });
  } catch (e) {
    // extension context may already be gone
  }
});

// Seed the UI from the shared defaults so the sidebar and content.js never
// drift apart. Editing defaults.js updates both at once.
function applyDefaultsToUI() {
  enabledEl.checked = DR_DEFAULTS.enabled !== false;
  for (const id in CHECKBOX_TO_SETTING) {
    const el = document.getElementById(id);
    if (el) el.checked = !!DR_DEFAULTS[CHECKBOX_TO_SETTING[id]];
  }
  if (dateGranularityEl && DR_DEFAULTS.dateGranularity) {
    dateGranularityEl.value = DR_DEFAULTS.dateGranularity;
  }
  if (timeGranularityEl && DR_DEFAULTS.timeGranularity) {
    timeGranularityEl.value = DR_DEFAULTS.timeGranularity;
  }
  topVal = snap(typeof DR_DEFAULTS.offsetTop === 'number' ? DR_DEFAULTS.offsetTop : DEFAULT_OFFSET);
  botVal = topVal;
  linked = true;
  renderSliders();
}
applyDefaultsToUI();

// Default to unbound until fetchPreviewSamples resolves.
setTableBound(false);

// Pull samples from whichever table the user has right-clicked. If no table
// was targeted, content.js returns nulls and the bands render the prompt.
fetchPreviewSamples();

// Defensively clear rangeExpr so browser autofill can never leak a stale value
// into a hidden field and silently constrain content.js output.
if (rangeExprEl) rangeExprEl.value = '';

updateDisabledState();
