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

// Also re-flash + re-apply when the user clicks anywhere in the sidebar body,
// so they get a visual confirmation of which table is targeted.
document.body.addEventListener('click', (e) => {
  if (e.target === excludeWordsEl) return; // change handler already fires
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
