/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

importScripts('constants.js');

let sidebarTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dr-action",
    title: "Toggle readable data",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "dr-action-sidebar",
    title: "Round table dynamically (with options)...",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "dr-action") {
    chrome.tabs.sendMessage(tab.id, { action: DR_CROSS_CONTEXT_TOPICS.MENU_CLICKED });
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
    chrome.tabs.sendMessage(tab.id, { action: DR_CROSS_CONTEXT_TOPICS.SIDEBAR_OPENED });
  }
});

function closeSidebarIfOpen() {
  // One leg, aimed at the sidebar page: the broadcast reaches every extension
  // page, and the sidebar closes itself on it. A second leg used to go to the
  // content script through its tab, so the page could clear its own copy of
  // "the sidebar is open" — the 2026-09-14 sidebar-state-removal design
  // retired that copy along with everything that read it (#241), and the
  // content script has no handler for this message now.
  chrome.runtime.sendMessage({ action: DR_CROSS_CONTEXT_TOPICS.CLOSE_SIDEBAR }).catch(() => {});
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
  if (request.action === DR_CROSS_CONTEXT_TOPICS.UPDATE_MENU_LABEL) {
    chrome.contextMenus.update("dr-action", { title: request.title });
    return;
  }

  if (request.action === DR_CROSS_CONTEXT_TOPICS.PAGE_UNLOADED) {
    if (sender.tab && sender.tab.id === sidebarTabId) {
      closeSidebarIfOpen();
    }
    return;
  }

  if (request.action === DR_CROSS_CONTEXT_TOPICS.SIDEBAR_CLOSED) {
    sidebarTabId = null;
    return;
  }

  if (request.action === DR_CROSS_CONTEXT_TOPICS.TABLE_TOGGLE_STATE) {
    if (sidebarTabId !== null) {
      chrome.runtime.sendMessage({ action: DR_CROSS_CONTEXT_TOPICS.TABLE_TOGGLE_STATE, enabled: request.enabled });
    }
    return;
  }

  // TABLE_ACTIVATED needs no relay. content.js sends it with
  // runtime.sendMessage, which the side panel already receives directly.
  // Forwarding it to sidebarTabId aimed it at the content script, which has no
  // handler for that action.
});
