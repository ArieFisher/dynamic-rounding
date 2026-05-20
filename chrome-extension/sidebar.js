/**
 * DynamicRounding Chrome Extension - Sidebar
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

const enabledEl = document.getElementById('enabled');
const excludeWordsEl = document.getElementById('excludeWords');
const optionsSection = document.getElementById('optionsSection');
const statusEl = document.getElementById('status');

function currentSettings() {
  return {
    enabled: enabledEl.checked,
    excludeWords: excludeWordsEl.checked
  };
}

function updateDisabledState() {
  optionsSection.classList.toggle('disabled', !enabledEl.checked);
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

enabledEl.addEventListener('change', () => {
  updateDisabledState();
  sendToActiveTab({ action: 'APPLY_SIDEBAR_SETTINGS', settings: currentSettings() });
});

excludeWordsEl.addEventListener('change', () => {
  sendToActiveTab({ action: 'APPLY_SIDEBAR_SETTINGS', settings: currentSettings() });
});

document.body.addEventListener('click', (e) => {
  if (e.target === enabledEl || e.target === excludeWordsEl) return;
  sendToActiveTab({ action: 'APPLY_SIDEBAR_SETTINGS', settings: currentSettings() });
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
