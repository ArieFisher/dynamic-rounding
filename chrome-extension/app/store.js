/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The application model.
 *
 * Owns the fields that used to live as file-level `let` bindings in
 * content.js (written into directly from ui-toggle.js) or, for settings,
 * nowhere at all — content.js used to pull them from the sidebar's live DOM
 * on every sidebar open, via a ten-retry polling loop (see the app-model-
 * settings sprint that replaced it):
 *
 *   - selectedTable   The table the user last targeted — by right-click, or
 *                      by clicking a different table's toggle while the
 *                      sidebar is open. content.js called this
 *                      lastRightClickedTable; sidebar.js's "bound" language
 *                      (setTableBound) names the same idea from the
 *                      sidebar's side. One field, one name: selectedTable.
 *   - sidebarOpen     Whether the side panel is currently open.
 *   - settings        The current rounding options (the sidebar's
 *                      checkboxes/sliders/range expression, flattened to one
 *                      object). Initialized from DR_DEFAULTS so the model
 *                      always holds a valid value, even before the sidebar
 *                      has ever been opened. The sidebar is the only writer
 *                      (via the intent:settingsChanged bus topic); the
 *                      controller applies every new value to the selected
 *                      table by subscribing to the resulting state-change.
 *
 * Reads go through the getters below. The only way to change a field is one
 * of the setter methods, and each setter does exactly two things: update the
 * field, then DR_BUS.publish() the field's whole new value as a
 * state-change. No caller can assign these fields directly — there is
 * nothing to assign; the fields are closed over, not exposed.
 *
 * The store holds no DOM logic and calls no chrome API itself; the one side
 * effect any setter has, beyond updating its own field, is a publish
 * through DR_BUS.
 *
 * Loaded after adapters/messaging.js (DR_BUS) and before ui-toggle.js.
 */

const DR_STORE = (function () {
  let selectedTable = null;
  let sidebarOpen = false;
  let settings = Object.assign({}, DR_DEFAULTS);

  function getSelectedTable() {
    return selectedTable;
  }

  function isSidebarOpen() {
    return sidebarOpen;
  }

  // Returns a fresh copy — callers may not mutate the store's internal
  // settings object by mutating what they read.
  function getSettings() {
    return Object.assign({}, settings);
  }

  // A view that opens or reconnects (the sidebar re-opening, most notably)
  // pulls this instead of trusting a state-change message it may have
  // missed while it was gone — the bus keeps no history, so a missed
  // publish is gone for good from the bus's point of view.
  function getSnapshot() {
    return { selectedTable, sidebarOpen, settings: getSettings() };
  }

  function setSelectedTable(table) {
    selectedTable = table;
    DR_BUS.publish('state:selectedTableChanged', { table: selectedTable });
  }

  function setSidebarOpen(isOpen) {
    sidebarOpen = !!isOpen;
    DR_BUS.publish('state:sidebarOpenChanged', { sidebarOpen });
  }

  function setSettings(newSettings) {
    settings = Object.assign({}, DR_DEFAULTS, newSettings || {});
    DR_BUS.publish('state:settingsChanged', { settings: getSettings() });
  }

  return {
    getSelectedTable,
    isSidebarOpen,
    getSettings,
    getSnapshot,
    setSelectedTable,
    setSidebarOpen,
    setSettings,
  };
})();
