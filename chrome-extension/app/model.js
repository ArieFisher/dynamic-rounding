// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The application model: the active table, the error state, and the
 * registry. docs/vocabulary.md defines each.
 *
 * The fields are closed over, so a caller reads them through the getters and
 * changes them only through the setters below. A publishing setter updates
 * its field, then publishes the whole new value through DR_BUS. The model
 * holds no DOM logic and calls no chrome API.
 */

const DR_MODEL = (function () {
  // --- Active table ---
  let activeTable = null;

  function getActiveTable() {
    return activeTable;
  }

  function setActiveTable(table) {
    activeTable = table;
  }

  // --- Table registry ---
  //
  // The Map holds a strong reference to each table, so an entry stays until
  // unregisterTable runs, even after the page removes the table. The content
  // script calls unregisterTable when the page removes or reshapes the table.
  const tableRegistry = new Map();

  function _ensureEntry(table) {
    let entry = tableRegistry.get(table);
    if (!entry) {
      entry = {
        // Each cell's originals, keyed by cell element, one record shape for
        // both kinds (CellRecord in lib/dr-table/cells.js). A WeakMap: nothing
        // enumerates it, and the record of a cell the page removes (a
        // virtualized grid, a re-render) is freed with the cell.
        originals: new WeakMap(),
        // The table settings. null until the first write; getTableSettings
        // reads null as the shipped defaults.
        settings: null,
        // The max magnitude the magnitude freeze holds. resetTable
        // (content.js) clears it to null.
        maxMagnitude: null,
        // The shape fingerprint: { columnCount, headerTexts }, from
        // lib/dr-table's readTableFingerprint. The controller writes it once,
        // when it registers the table. An entry that a first write created
        // holds null, and the controller reads null as nothing to compare
        // against.
        fingerprint: null,
      };
      tableRegistry.set(table, entry);
    }
    return entry;
  }

  // --- Error state ---
  //
  // The rows are bounded so a warning logged on every scroll cannot grow the
  // model for the life of the page; errorCount still increments past the cap
  // so the total stays readable. Rows are plain values, copied on the way in
  // and on the way out.
  const ERROR_ROW_LIMIT = 50;
  const errorRows = [];
  let errorCount = 0;

  function copyErrorRow(row) {
    return { at: row.at, level: row.level, text: row.text, stack: row.stack };
  }

  function getErrorState() {
    return {
      hasError: errorCount > 0,
      count: errorCount,
      rows: errorRows.map(copyErrorRow),
    };
  }

  function recordError(row) {
    errorRows.push(copyErrorRow(row));
    if (errorRows.length > ERROR_ROW_LIMIT) errorRows.shift();
    errorCount++;
    DR_BUS.publish('state:errorRecorded', { errorState: getErrorState() });
  }

  // --- Table registry API ---
  //
  // Only setTableSettings publishes.

  // Every setter below also calls _ensureEntry, so a table can have an entry
  // without registerTable ever running for it.
  function registerTable(table) {
    _ensureEntry(table);
  }

  function unregisterTable(table) {
    tableRegistry.delete(table);
  }

  function hasTable(table) {
    return tableRegistry.has(table);
  }

  function getRegisteredTables() {
    return Array.from(tableRegistry.keys());
  }

  function setTableOriginal(table, cellEl, value) {
    _ensureEntry(table).originals.set(cellEl, value);
  }

  function getTableOriginal(table, cellEl) {
    const entry = tableRegistry.get(table);
    return entry ? entry.originals.get(cellEl) : undefined;
  }

  function hasTableOriginal(table, cellEl) {
    const entry = tableRegistry.get(table);
    return !!entry && entry.originals.has(cellEl);
  }

  // Reads CellRecord.value, the text the pass classified.
  function getTableOriginalText(table, cellEl) {
    const original = getTableOriginal(table, cellEl);
    return original === undefined ? undefined : original.value;
  }

  function deleteTableOriginal(table, cellEl) {
    const entry = tableRegistry.get(table);
    if (entry) entry.originals.delete(cellEl);
  }

  // Every write targets the active table. The settings notice crosses to the
  // sidebar, so it carries plain values alone: the source ('sidebar' for the
  // sidebar's apply, 'page' for every other writer) and a copy of the stored
  // settings.
  //
  // The one place the shipped defaults fill in on a write. settings is a
  // patch: a key it leaves out keeps its stored value.
  function setTableSettings(table, settings, source) {
    const stored = Object.assign({}, getTableSettings(table), settings);
    _ensureEntry(table).settings = stored;
    DR_BUS.publish('state:settingsChanged', { source, settings: Object.assign({}, stored) });
  }

  // A copy, so a caller cannot change the stored settings by changing what
  // it read.
  function getTableSettings(table) {
    const entry = tableRegistry.get(table);
    return Object.assign({}, entry && entry.settings ? entry.settings : DR_DEFAULTS);
  }

  // The on/off value the table pillbox and the sidebar pillbox both show, so
  // the two always agree. The value comes from the table settings alone, not
  // from whether any cell changed.
  function isTableOn(table) {
    return getTableSettings(table).enabled === true;
  }

  function setTableMaxMagnitude(table, maxMagnitude) {
    _ensureEntry(table).maxMagnitude = maxMagnitude;
  }

  function getTableMaxMagnitude(table) {
    const entry = tableRegistry.get(table);
    return entry ? entry.maxMagnitude : null;
  }

  function setTableFingerprint(table, fingerprint) {
    _ensureEntry(table).fingerprint = fingerprint;
  }

  function getTableFingerprint(table) {
    const entry = tableRegistry.get(table);
    return entry ? entry.fingerprint : null;
  }

  return {
    getActiveTable,
    setActiveTable,
    getErrorState,
    recordError,
    registerTable,
    unregisterTable,
    hasTable,
    getRegisteredTables,
    setTableOriginal,
    getTableOriginal,
    getTableOriginalText,
    hasTableOriginal,
    deleteTableOriginal,
    setTableSettings,
    getTableSettings,
    isTableOn,
    setTableMaxMagnitude,
    getTableMaxMagnitude,
    setTableFingerprint,
    getTableFingerprint,
  };
})();
