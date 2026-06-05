/**
 * DynamicRounding Chrome Extension - Sidebar
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

const enabledEl = document.getElementById('enabled');
const optionsSection = document.getElementById('optionsSection');
const statusEl = document.getElementById('status');

const CHECKBOX_TO_SETTING = {
  includeWords: 'includeWords',
  includeCurrency: 'includeCurrency',
  includePercent: 'includePercent',
  excludeFirstRow: 'excludeFirstRow',
  excludeFirstColumn: 'excludeFirstColumn',
  excludeDates: 'excludeDates',
  excludeTimes: 'excludeTimes'
};

const dateGranularityEl = document.getElementById('dateGranularity');
const timeGranularityEl = document.getElementById('timeGranularity');
const rangeExprEl = document.getElementById('rangeExpr');

// ----- Variant F: linked dual-thumb sliders -----
const STOPS = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
const DEFAULT_OFFSET = -0.5;

const dualWrap = document.getElementById('dualWrap');
const topThumb = document.getElementById('topThumb');
const botThumb = document.getElementById('botThumb');
const trackEl = dualWrap ? dualWrap.querySelector('.dual-track') : null;
const topReadout = document.getElementById('topReadout');
const botReadout = document.getElementById('botReadout');

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
  if (topReadout) topReadout.textContent = fmtOffset(topVal);
  if (botReadout) botReadout.textContent = fmtOffset(botVal);
  if (topThumb) topThumb.setAttribute('aria-valuenow', String(topVal));
  if (botThumb) botThumb.setAttribute('aria-valuenow', String(botVal));
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
  // Granularity dropdown only matters when the corresponding exclusion is off
  // (i.e. that type's cells will round).
  if (dateGranularityEl) {
    dateGranularityEl.disabled = document.getElementById('excludeDates').checked;
  }
  if (timeGranularityEl) {
    timeGranularityEl.disabled = document.getElementById('excludeTimes').checked;
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
        statusEl.textContent = 'Right-click a table first, then reopen the sidebar.';
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CLOSE_SIDEBAR') {
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

// Defensively clear rangeExpr so browser autofill can never leak a stale value
// into a hidden field and silently constrain content.js output.
if (rangeExprEl) rangeExprEl.value = '';

updateDisabledState();
