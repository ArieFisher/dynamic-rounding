/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

importScripts('lib/dr-log/index.js', 'adapters/messaging.js');

// Every context "all" covers except "action", the toolbar icon's menu: no
// table sits under the pointer there, and a click on the icon opens the
// sidebar.
const PAGE_MENU_CONTEXTS = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];

chrome.runtime.onInstalled.addListener(() => {
  // Versions before 1.7.1 stored true here, and Chrome may still hold it.
  // With true, Chrome opens the sidebar itself on an icon click, which grants
  // no tab permission, so the screenshot fails.
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e) => {
      DR_LOG.warn(DR_LOG.formatRow('error', { step: 'icon click setting', error: DR_LOG.errorType(e) }));
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
 * Opens the sidebar on a tab and tells the tab. Chrome
 * grants the tab permission the screenshot needs, and accepts the open, only
 * as a direct response to the user's click, so a caller runs this before
 * any await of its own.
 * @param {number} tabId The tab the user clicked in.
 */
async function openSidebarOnTab(tabId) {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch (e) {
    DR_LOG.warn(DR_LOG.formatRow('error', { step: 'open sidebar', error: DR_LOG.errorType(e) }));
  }
  DR_BUS.publish('state:sidebarOpened', {}, { tabId });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const isToggleWithSidebar = info.menuItemId === "dr-menu-toggle-sidebar";
  if (info.menuItemId !== "dr-menu-toggle" && !isToggleWithSidebar) return;

  // The user right-clicked in this tab. Without a tab number the bus sends
  // to the tab in front of the current window, which can be a different
  // tab, so the publish passes this tab's number. The toggle goes before the
  // sidebar-opened topic, so the sidebar's redraw read on opening returns the
  // toggled settings.
  DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
  if (isToggleWithSidebar) openSidebarOnTab(tab.id);
});

// No table sits under the pointer on the toolbar icon, so its click opens
// the sidebar with no toggle.
chrome.action.onClicked.addListener((tab) => {
  openSidebarOnTab(tab.id);
});
