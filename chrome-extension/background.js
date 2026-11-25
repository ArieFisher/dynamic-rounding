// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

importScripts('lib/dr-log/index.js', 'app/bus.js');

// Every right-click place but the toolbar icon's own menu, where no table
// sits under the pointer.
const PAGE_MENU_CONTEXTS = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];

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

// Chrome accepts the open only as a direct response to the user's click, so a
// caller runs this before any await of its own.
async function openSidebarOnTab(tabId) {
  try {
    await chrome.sidePanel.open({ tabId });
  } catch (e) {
    DR_LOG.warnError('open sidebar', e);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
  if (info.menuItemId === "dr-menu-toggle-sidebar") openSidebarOnTab(tab.id);
});

chrome.action.onClicked.addListener((tab) => {
  openSidebarOnTab(tab.id);
});
