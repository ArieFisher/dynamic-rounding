/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

importScripts('lib/dr-log/index.js', 'adapters/messaging.js');

// Every context "all" covers except "action", the toolbar icon's menu: no
// table sits under the pointer there, and a click on the toolbar icon opens
// the sidebar.
const PAGE_MENU_CONTEXTS = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];

chrome.runtime.onInstalled.addListener(() => {
  // Versions before 1.7.1 stored true here, and Chrome may still hold it.
  // With true, Chrome opens the sidebar itself on a toolbar icon click, which
  // gives no activeTab grant, so the screenshot fails.
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e) => {
      DR_LOG.warnError('icon click setting', e);
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
 * Opens the sidebar for a tab and tells the tab's content script. Chrome
 * gives the activeTab grant the screenshot needs, and accepts the open, only
 * as a direct response to the user's click, so a caller runs this before
 * any await of its own.
 */
async function openSidebarOnTab(tabId) {
  try {
    await chrome.sidePanel.open({ tabId });
  } catch (e) {
    DR_LOG.warnError('open sidebar', e);
  }
  DR_BUS.publish('state:sidebarOpened', {}, { tabId });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // The toggle goes before the sidebar-opened topic, so the redraw read that
  // topic triggers returns the toggled settings.
  DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
  if (info.menuItemId === "dr-menu-toggle-sidebar") openSidebarOnTab(tab.id);
});

chrome.action.onClicked.addListener((tab) => {
  openSidebarOnTab(tab.id);
});
