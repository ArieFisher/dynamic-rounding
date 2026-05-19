/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dr-action",
    title: "Round table dynamically",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "dr-action-sidebar",
    title: "Round table dynamically (with options)...",
    contexts: ["all"]
  });
});

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "dr-action") {
    chrome.tabs.sendMessage(tab.id, { action: "MENU_CLICKED" });
    return;
  }

  if (info.menuItemId === "dr-action-sidebar") {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (e) {
      console.warn("Dynamic Rounding: failed to open side panel", e);
    }
    chrome.tabs.sendMessage(tab.id, { action: "SIDEBAR_OPENED" });
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "UPDATE_MENU_LABEL") {
    chrome.contextMenus.update("dr-action", { title: request.title });
  }
});
