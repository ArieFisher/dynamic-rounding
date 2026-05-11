/**
 * DynamicRounding Chrome Extension
 * Version: 1.1.0
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dr-action",
    title: "Round table dynamically",
    contexts: ["all"]
  });
});

chrome.contextMenus.onShown.addListener((info, tab) => {
  if (!info.menuIds.includes("dr-action")) return;
  chrome.tabs.sendMessage(tab.id, { action: "GET_MENU_LABEL" }, (response) => {
    if (response && response.title) {
      chrome.contextMenus.update("dr-action", { title: response.title });
      chrome.contextMenus.refresh();
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "dr-action") {
    chrome.tabs.sendMessage(tab.id, { action: "MENU_CLICKED" });
  }
});
