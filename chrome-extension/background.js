/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

importScripts('constants.js', 'adapters/messaging.js');

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
    // The menu-click tab is the one the right-click happened in, which the
    // bus's active-tab lookup would only find by accident. Name it.
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
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
    DR_BUS.publish('state:sidebarOpened', {}, { tabId: tab.id });
  }
});

function closeSidebarIfOpen() {
  // One leg, aimed at the sidebar page: the broadcast reaches every extension
  // page, and the sidebar closes itself on it. A second leg used to go to the
  // content script through its tab, so the page could clear its own copy of
  // "the sidebar is open" — the 2026-09-14 sidebar-state-removal design
  // retired that copy along with everything that read it (#241), and the
  // content script has no subscriber for this topic now.
  DR_BUS.publish('intent:closeSidebar', {});
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

DR_BUS.subscribe('intent:updateMenuLabel', ({ title }) => {
  chrome.contextMenus.update("dr-action", { title });
});

// meta.tabId is the tab the content script sent from. The worker acts only
// when that tab is the one the sidebar was opened for; without the number,
// any page unload in any tab would close the sidebar.
DR_BUS.subscribe('state:pageUnloaded', (payload, meta) => {
  if (meta.tabId !== null && meta.tabId === sidebarTabId) {
    closeSidebarIfOpen();
  }
});

DR_BUS.subscribe('state:sidebarClosed', () => {
  sidebarTabId = null;
});

// The on/off report needs no relay here. The content script's single publish
// already reaches the sidebar, so the re-send this worker used to make was a
// second delivery of one fact.
//
// The table-activation report needs no relay either. The content script
// broadcasts it to every extension page, which is where the sidebar reads it.
