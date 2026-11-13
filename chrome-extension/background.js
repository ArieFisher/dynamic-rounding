/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// The bus and the log module, for its row format: no constant in
// constants.js reaches this context. The worker's one row goes to the
// console, so its log buffer stays empty.
importScripts('lib/dr-log/index.js', 'adapters/messaging.js');

let boundTabId = null;

// One fixed label serves every table on the page, so nothing updates it.
// Chrome's documentation does not state whether an earlier version's menu
// items survive an update, so the worker removes every item before it
// creates its own: an item under a former id would otherwise stay in the menu.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "dr-menu-toggle",
      title: "Simplify",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "dr-menu-toggle-sidebar",
      title: "Simplify and open sidebar",
      contexts: ["all"]
    });
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
    // The menu toggle with sidebar does both things its title states: the
    // same toggle the menu toggle publishes, then the sidebar-opened topic.
    // The toggle goes first, so the sidebar's re-read on open reads the
    // toggled settings.
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
    DR_BUS.publish('state:sidebarOpened', {}, { tabId: tab.id });
  }
});

function closeSidebarIfOpen() {
  // The broadcast reaches every extension page, and the sidebar closes itself
  // on it. The content script has no subscriber for this topic.
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

// meta.tabId is the tab the content script sent from. The worker acts only
// when that tab is the bound tab; without the number,
// any page unload in any tab would close the sidebar.
DR_BUS.subscribe('state:pageUnloaded', (payload, meta) => {
  if (meta.tabId !== null && meta.tabId === boundTabId) {
    closeSidebarIfOpen();
  }
});

DR_BUS.subscribe('state:sidebarClosed', () => {
  boundTabId = null;
});

// The settings notice and the table-activation topic need no relay here. The
// content script broadcasts each to every extension page, so its one publish
// reaches the sidebar.
