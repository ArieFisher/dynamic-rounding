/**
 * DynamicRounding Chrome Extension
 * Version: 1.3.1
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

let sidebarTabId = null;

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
    sidebarTabId = tab.id;
    chrome.tabs.sendMessage(tab.id, { action: "SIDEBAR_OPENED" });
  }
});

function closeSidebarIfOpen() {
  chrome.runtime.sendMessage({ action: "CLOSE_SIDEBAR" }).catch(() => {});
  sidebarTabId = null;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === sidebarTabId && changeInfo.status === "loading") {
    closeSidebarIfOpen();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === sidebarTabId) {
    closeSidebarIfOpen();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (sidebarTabId !== null && activeInfo.tabId !== sidebarTabId) {
    closeSidebarIfOpen();
  }
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === "UPDATE_MENU_LABEL") {
    chrome.contextMenus.update("dr-action", { title: request.title });
    return;
  }

  if (request.action === "PAGE_UNLOADED") {
    if (sender.tab && sender.tab.id === sidebarTabId) {
      closeSidebarIfOpen();
    }
    return;
  }

  if (request.action === "SIDEBAR_CLOSED") {
    sidebarTabId = null;
    return;
  }
});
