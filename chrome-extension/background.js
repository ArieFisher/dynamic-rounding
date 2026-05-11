/**
 * DynamicRounding Chrome Extension
 * Version: 1.1.0
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "round-table",
    title: "Round table dynamically",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "show-original",
    title: "Show original values",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "round-table") {
    chrome.tabs.sendMessage(tab.id, { action: "ROUND_TABLE" });
  } else if (info.menuItemId === "show-original") {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_ORIGINAL" });
  }
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === "UPDATE_TOGGLE_LABEL") {
    chrome.contextMenus.update("show-original", { title: request.title });
  }
});
