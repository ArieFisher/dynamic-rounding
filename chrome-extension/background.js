/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// The bus alone: no constant in constants.js reaches this context.
importScripts('adapters/messaging.js');

let sidebarTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dr-action",
    title: "Toggle table",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "dr-action-sidebar",
    title: "Toggle and open sidebar",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "dr-action") {
    // The right-click happened in the menu-click tab. The bus's active-tab
    // lookup can return a different tab, so the publish passes the tab number.
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
    // The item does both things its title states: the same toggle "Toggle
    // table" publishes, then the sidebar-opened topic. The toggle goes first,
    // so the sidebar's re-read on open reads the toggled settings.
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
    DR_BUS.publish('state:sidebarOpened', {}, { tabId: tab.id });
  }
});

function closeSidebarIfOpen() {
  // The broadcast reaches every extension page, and the sidebar closes itself
  // on it. The content script has no subscriber for this topic.
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

// The on/off topic and the table-activation topic need no relay here. The
// content script broadcasts each to every extension page, so its one publish
// reaches the sidebar.
