/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// The worker's one row goes to the console, so its log buffer stays empty.
importScripts('lib/dr-log/index.js', 'adapters/messaging.js');

let boundTabId = null;

// Every context "all" covers except "action", the toolbar icon's menu: no
// table sits under the pointer there, and Chrome's own item there opens the
// sidebar.
const PAGE_MENU_CONTEXTS = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];

// One fixed label serves every table on the page, so nothing updates it.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dr-menu-toggle",
    title: "Simplify",
    contexts: PAGE_MENU_CONTEXTS
  });
  chrome.contextMenus.create({
    id: "dr-menu-toggle-sidebar",
    title: "Simplify and open sidebar",
    contexts: PAGE_MENU_CONTEXTS
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "dr-menu-toggle") {
    // The user right-clicked in this tab. Without a tab number the bus sends
    // to the tab in front of the current window, which can be a different
    // tab, so the publish passes this tab's number.
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
    return;
  }

  if (info.menuItemId === "dr-menu-toggle-sidebar") {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (e) {
      console.warn(DR_LOG.formatRow('error', { step: 'open sidebar', error: DR_LOG.errorType(e) }));
    }
    boundTabId = tab.id;
    // The toggle goes first, so the sidebar's redraw read on opening returns
    // the toggled settings.
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
    DR_BUS.publish('state:sidebarOpened', {}, { tabId: tab.id });
  }
});

function closeSidebarIfOpen() {
  // The broadcast reaches every extension page, and the sidebar closes itself
  // on it.
  DR_BUS.publish('state:boundTabLeft', {});
  boundTabId = null;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === boundTabId && changeInfo.status === "loading") {
    closeSidebarIfOpen();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === boundTabId) {
    closeSidebarIfOpen();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (boundTabId !== null && activeInfo.tabId !== boundTabId) {
    closeSidebarIfOpen();
  }
});

// Without the tab check, a page unload in any tab would close the sidebar.
DR_BUS.subscribe('state:pageUnloaded', (payload, meta) => {
  if (meta.tabId !== null && meta.tabId === boundTabId) {
    closeSidebarIfOpen();
  }
});

DR_BUS.subscribe('state:sidebarClosed', () => {
  boundTabId = null;
});
