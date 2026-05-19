/**
 * DynamicRounding Chrome Extension - Sidebar
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

const excludeWordsEl = document.getElementById('excludeWords');
const statusEl = document.getElementById('status');

function currentSettings() {
  return {
    excludeWords: excludeWordsEl.checked
  };
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

excludeWordsEl.addEventListener('change', () => {
  sendToActiveTab({ action: 'APPLY_SIDEBAR_SETTINGS', settings: currentSettings() });
});
