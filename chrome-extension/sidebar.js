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
  excludeWords: 'excludeWords',
  excludeDates: 'excludeDates',
  excludeTimes: 'excludeTimes',
  excludeFirstColumn: 'excludeFirstColumn',
  excludePercent: 'excludePercent',
  excludeCurrency: 'excludeCurrency'
};

const dateGranularityEl = document.getElementById('dateGranularity');
const timeGranularityEl = document.getElementById('timeGranularity');

function currentSettings() {
  const settings = { enabled: enabledEl.checked };
  for (const id in CHECKBOX_TO_SETTING) {
    const el = document.getElementById(id);
    if (el) settings[CHECKBOX_TO_SETTING[id]] = el.checked;
  }
  if (dateGranularityEl) settings.dateGranularity = dateGranularityEl.value;
  if (timeGranularityEl) settings.timeGranularity = timeGranularityEl.value;
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

document.body.addEventListener('click', (e) => {
  if (e.target.matches('input[type="checkbox"], select, option')) return;
  applyNow();
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'CLOSE_SIDEBAR') {
    window.close();
  }
});

window.addEventListener('unload', () => {
  try {
    chrome.runtime.sendMessage({ action: 'SIDEBAR_CLOSED' });
  } catch (e) {
    // extension context may already be gone
  }
});

updateDisabledState();
