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
    statusEl.textContent = NO_TABLE_STATUS_MSG;
  } else if (statusEl.textContent === NO_TABLE_STATUS_MSG) {
    statusEl.textContent = '';
  }
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
const STOPS = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
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
  // Map -1 → 0%, +1 → 100%.
  return ((v + 1) / 2) * 100;
}
function fmtOffset(o) {
  let s = o.toFixed(2).replace(/\.?0+$/, '');
  if (s === '-0') s = '0';
  return s.replace('-', '−');
}
function renderSliders() {
  if (!topThumb || !botThumb) return;
  topThumb.style.left = pct(topVal) + '%';
  botThumb.style.left = pct(botVal) + '%';
  botThumb.classList.toggle('linked', linked);
  if (sliderBlockEl) sliderBlockEl.classList.toggle('linked', linked);
  if (topLabelEl) topLabelEl.textContent = 'largest numbers: ' + fmtOffset(topVal);
  if (botLabelEl) botLabelEl.textContent = 'all other numbers: ' + fmtOffset(botVal);
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

function renderBand(el, rows, offset) {
  if (!el) return;
  if (!rows || rows.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '';
  for (const row of rows) {
    const pair = document.createElement('div');
    pair.className = 'pair';

    const from = document.createElement('span');
    from.className = 'from';
    from.textContent = row.original;
    pair.appendChild(from);

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    pair.appendChild(arrow);

    const numEl = document.createElement('span');
    numEl.className = 'num';
    const rounded = roundWithOffset(row.num, offset);
    numEl.textContent = formatNumberWithCommas(rounded);
    pair.appendChild(numEl);

    const stepEl = document.createElement('span');
    stepEl.className = 'step';
    stepEl.textContent = '(' + formatStep(stepForOffset(row.num, offset)) + ')';
    pair.appendChild(stepEl);

    el.appendChild(pair);
  }
}

function renderPreviewBands() {
  if (!topBandEl || !botBandEl) return;
  if (!cachedSamples) {
    renderBand(topBandEl, null);
    renderBand(botBandEl, null);
    return;
  }
  renderBand(topBandEl, cachedSamples.top, topVal);
  renderBand(botBandEl, cachedSamples.bottom, botVal);
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
      const raw = ratio * 2 - 1;
      const snapped = snap(raw);
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
