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
 * Reads go through the getters below. The only way to change selectedTable,
 * sidebarOpen, or settings is one of the setter methods, and each setter
 * does exactly two things: update the field, then DR_BUS.publish() the
 * field's whole new value as a state-change. No caller can assign these
 * fields directly — there is nothing to assign; the fields are closed over,
 * not exposed.
 *
 * The table registry (app-model-registry sprint) is a fourth field with a
 * different shape and a different update contract — see the section below.
 *
 * The store holds no DOM logic and calls no chrome API itself; the one side
 * effect any of the three scalar setters has, beyond updating its own
 * field, is a publish through DR_BUS.
 *
 * Loaded after adapters/messaging.js (DR_BUS) and before ui-toggle.js.
 */

const DR_STORE = (function () {
  let selectedTable = null;
  let sidebarOpen = false;
  let settings = Object.assign({}, DR_DEFAULTS);

  // --- Table registry ---
  //
  // Before this sprint, "which tables/grids has the extension found" lived
  // in three places at once: a WeakMap and a Set in ui-toggle.js
  // (tableToggles, trackedTables), and the dr-ext-grid marker class read
  // back with classList.contains/closest wherever a caller needed to know
  // "have I already handled this element" (ui-toggle.js, content.js,
  // lib/dr-table/detect.js's findTargetTable). Per-table rounding state
  // (the original values a cell had before rounding, the simplified/
  // original flag, the last-used round options, and — for virtualized grids
  // — the frozen magnitude basis) lived on page attributes
  // (dataset.originalValue/originalHtml/drOriginal/drSupRanges/
  // drLinkFilteredIdx/drShowingOriginal) and in two more file-level WeakMaps
  // in content.js (tableOptions, plus the grid observer/timer maps). This
  // registry is the single place all of that now lives.
  //
  // Shape: WeakMap<table, entry>. A plain WeakMap, not a Map, is the right
  // primitive for the entries themselves — a table removed from the page
  // without an explicit unregisterTable() call (a bug, or a host page that
  // detaches a node some other way) still lets its entry go instead of
  // leaking for the life of the tab. WeakMap cannot be enumerated, and
  // content.js's removal observer needs enumeration — it walks a removed
  // subtree looking for tables it was tracking. (ui-toggle.js's own
  // scroll/resize repositioning does NOT read this Set; it iterates its own
  // trackedTables Set instead — see ui-toggle.js.) Rather than a
  // WeakRef-based companion (which needs its own periodic sweep to reclaim
  // dead refs, and this codebase has no such sweep loop anywhere), the
  // enumerable companion here is a plain Set kept in exact lockstep with the
  // WeakMap by registerTable/unregisterTable — the same two call sites that
  // already tear down this table's other per-table resources (gridObservers,
  // gridReapplyTimers, tableResizeObservers), so no new leak surface is
  // introduced beyond what those call sites already had to get right.
  const tableRegistry = new WeakMap();
  const registeredTables = new Set();

  function _ensureEntry(table) {
    let entry = tableRegistry.get(table);
    if (!entry) {
      entry = {
        // Per-cell pre-round original, keyed by cell element. A grid cell's
        // value is the plain original text (nodeValue patching, one string);
        // a native cell's value is a record — { html, value, supRanges,
        // linkFilteredIdx } — because the native write path preserves
        // mixed-content markup and needs all four to classify and restore a
        // cell correctly. restoreTable (content.js) and collectNumericCells
        // (content.js) are the two readers, and both already know which
        // shape to expect from which kind of table. A WeakMap, not a Map,
        // for the same reason tableRegistry itself is one: nothing
        // enumerates a table's originals (only .get/.set/.has/.delete by a
        // specific cell), so there is no companion Set to keep in lockstep
        // here, and a cell recycled out of the page by the host (grid
        // virtualization, a framework re-render) lets its entry go instead
        // of accumulating for the life of the table's registration.
        originals: new WeakMap(),
        // 'original' | 'simplified' — replaces dataset.drShowingOriginal.
        // 'original' covers both "never rounded" and "rounded, currently
        // showing originals"; isTableRounded (ui-toggle.js) is exactly
        // appliedFlag === 'simplified'.
        appliedFlag: 'original',
        // The options object the most recent roundTable() call used —
        // replaces content.js's tableOptions WeakMap. toggleOriginalValues
        // reads this to re-round with the same parameters instead of a
        // stale cached value.
        lastRoundOptions: null,
        // Virtualized-grid magnitude basis, frozen on first round so a
        // scroll-triggered re-apply cannot shift it. null until roundTable
        // freezes it; resetTable clears it back to null.
        maxMagnitude: null,
      };
      tableRegistry.set(table, entry);
      registeredTables.add(table);
    }
    return entry;
  }

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

  // --- Table registry API ---
  //
  // No bus publish here: nothing in the app subscribes to "a table was
  // found" or "a cell's original changed" as an event — the DOM itself is
  // the view for a table's contents, and the view already redraws it
  // directly (roundTable/restoreTable write the cells they change). Unlike
  // selectedTable/sidebarOpen/settings, the registry is per-table storage
  // consulted synchronously by the controller, not application-level state
  // a view redraws itself from.

  // registerTable: the "found" moment as far as the toggle UI is concerned —
  // called once, from ui-toggle.js's createToggleForTable, idempotent so a
  // rediscovery (e.g. injectTogglesForAddedNode revisiting a node) is a
  // no-op. It is NOT the only path to a table having a registry entry:
  // setTableOriginal, setTableAppliedFlag, setTableRoundOptions, and
  // setTableMaxMagnitude below all call the same _ensureEntry and will
  // silently create one on first write if registerTable never ran for that
  // table.
  function registerTable(table) {
    _ensureEntry(table);
  }

  function unregisterTable(table) {
    tableRegistry.delete(table);
    registeredTables.delete(table);
  }

  // hasTable: the one check every former dr-ext-grid class read or
  // tableToggles.has() "have I already handled this element" check now
  // goes through.
  function hasTable(table) {
    return tableRegistry.has(table);
  }

  // getRegisteredTables: the enumerable companion's one reader —
  // content.js's removed-subtree cleanup, which needs to iterate every
  // found table. (ui-toggle.js's scroll/resize repositioning iterates its
  // own trackedTables Set instead; it does not read this.)
  function getRegisteredTables() {
    return Array.from(registeredTables);
  }

  function setTableOriginal(table, cellRef, value) {
    _ensureEntry(table).originals.set(cellRef, value);
  }

  function getTableOriginal(table, cellRef) {
    const entry = tableRegistry.get(table);
    return entry ? entry.originals.get(cellRef) : undefined;
  }

  function hasTableOriginal(table, cellRef) {
    const entry = tableRegistry.get(table);
    return !!entry && entry.originals.has(cellRef);
  }

  function deleteTableOriginal(table, cellRef) {
    const entry = tableRegistry.get(table);
    if (entry) entry.originals.delete(cellRef);
  }

  function setTableAppliedFlag(table, flag) {
    _ensureEntry(table).appliedFlag = flag;
  }

  // Defaults to 'original' with no entry — a table never registered has
  // never been rounded, same as isTableRounded's old "no .dr-ext-rounded
  // cell found" default.
  function getTableAppliedFlag(table) {
    const entry = tableRegistry.get(table);
    return entry ? entry.appliedFlag : 'original';
  }

  function setTableRoundOptions(table, opts) {
    _ensureEntry(table).lastRoundOptions = opts;
  }

  function getTableRoundOptions(table) {
    const entry = tableRegistry.get(table);
    return entry ? entry.lastRoundOptions : null;
  }

  function setTableMaxMagnitude(table, mag) {
    _ensureEntry(table).maxMagnitude = mag;
  }

  function getTableMaxMagnitude(table) {
    const entry = tableRegistry.get(table);
    return entry ? entry.maxMagnitude : null;
  }

  return {
    getSelectedTable,
    isSidebarOpen,
    getSettings,
    getSnapshot,
    setSelectedTable,
    setSidebarOpen,
    setSettings,
    registerTable,
    unregisterTable,
    hasTable,
    getRegisteredTables,
    setTableOriginal,
    getTableOriginal,
    hasTableOriginal,
    deleteTableOriginal,
    setTableAppliedFlag,
    getTableAppliedFlag,
    setTableRoundOptions,
    getTableRoundOptions,
    setTableMaxMagnitude,
    getTableMaxMagnitude,
  };
})();
