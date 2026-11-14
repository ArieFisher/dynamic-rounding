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
// table sits under the pointer there, and a click on the icon opens the
// sidebar.
const PAGE_MENU_CONTEXTS = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];

// One fixed label serves every table on the page, so nothing updates it.
chrome.runtime.onInstalled.addListener(() => {
  // Versions before 1.7.1 stored true here, and Chrome may still hold it.
  // With true, Chrome opens the sidebar itself on an icon click, which grants
  // no tab permission, so the screenshot fails.
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e) => {
      console.warn(DR_LOG.formatRow('error', { step: 'icon click setting', error: DR_LOG.errorType(e) }));
    });
  }
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

/**
 * Opens the sidebar on a tab, binds it there, and tells the tab. Chrome
 * grants the tab permission the screenshot needs, and accepts the open, only
 * as a direct response to the user's click, so a caller runs this before
 * any await of its own.
 * @param {number} tabId The tab the user clicked in.
 * @param {boolean} [toggleFirst=false] Whether to publish the menu toggle's
 *   intent before the sidebar-opened topic.
 */
async function openSidebarOnTab(tabId, toggleFirst = false) {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch (e) {
    console.warn(DR_LOG.formatRow('error', { step: 'open sidebar', error: DR_LOG.errorType(e) }));
  }
  boundTabId = tabId;
  // The toggle goes first, so the sidebar's redraw read on opening returns
  // the toggled settings.
  if (toggleFirst) DR_BUS.publish('intent:menuClicked', {}, { tabId });
  DR_BUS.publish('state:sidebarOpened', {}, { tabId });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "dr-menu-toggle") {
    // The user right-clicked in this tab. Without a tab number the bus sends
    // to the tab in front of the current window, which can be a different
    // tab, so the publish passes this tab's number.
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
    return;
  }

  if (info.menuItemId === "dr-menu-toggle-sidebar") {
    openSidebarOnTab(tab.id, true);
  }
});

// No table sits under the pointer on the toolbar icon, so its click opens
// the sidebar with no toggle.
chrome.action.onClicked.addListener((tab) => {
  openSidebarOnTab(tab.id);
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
