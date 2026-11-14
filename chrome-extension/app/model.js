/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The application model: the active table, the error state, and the
 * registry. docs/vocabulary.md defines each.
 *
 * The fields are closed over, so a caller reads them through the getters and
 * changes them only through the setters below. A publishing setter updates
 * its field, then publishes the whole new value through DR_BUS. The model
 * holds no DOM logic and calls no chrome API.
 *
 * Loaded after constants.js (DR_DEFAULTS) and adapters/messaging.js
 * (DR_BUS), and before ui-pillbox.js.
 */

const DR_MODEL = (function () {
  let activeTable = null;

  // --- Table registry ---
  //
  // The Map holds a strong reference to each table, so an entry stays until
  // unregisterTable runs, even after the page removes the table. The content
  // script calls unregisterTable from its removal observer.
  const tableRegistry = new Map();

  function _ensureEntry(table) {
    let entry = tableRegistry.get(table);
    if (!entry) {
      entry = {
        // Each cell's originals, keyed by cell element, one record shape for
        // both kinds (CellRecord in lib/dr-table/cells.js). A WeakMap, because
        // nothing enumerates a table's originals, and a cell the host recycles
        // out of the page (grid virtualization, a framework re-render) lets
        // its entry go instead of accumulating for the life of the table's
        // registration.
        originals: new WeakMap(),
        // The table's settings: its on/off value and every simplification
        // option, with the shipped defaults filled in. null until the first
        // write, and getTableSettings answers the shipped defaults for null.
        // setTableSettings is the one writer. The sidebar's controls, the
        // apply, the re-apply pass, and the capture read it; a reset of the
        // cells leaves it in place.
        settings: null,
        // The max magnitude stored at the first simplification, so a re-apply
        // pass (a grid's scroll, a value the page writes) cannot shift it.
        // resetTable clears it back to null.
        maxMagnitude: null,
        // The shape fingerprint: { columnCount, headerTexts }, from
        // lib/dr-table's readTableFingerprint. createTablePillbox
        // (ui-pillbox.js) is the one writer. An entry that a first write
        // created holds null until that writer runs, and the controller
        // reads null as nothing to compare against.
        fingerprint: null,
      };
      tableRegistry.set(table, entry);
    }
    return entry;
  }

  function getActiveTable() {
    return activeTable;
  }

  function setActiveTable(table) {
    activeTable = table;
  }

  // --- Error state ---
  //
  // The rows are bounded so a page that logs on every scroll cannot grow the
  // model for the life of the tab; the count keeps counting past the cap so
  // the total stays readable. Rows are plain values (time, level, text,
  // stack trace) copied on the way in and on the way out.
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
  // Only setTableSettings publishes. The rest of the registry is per-table
  // storage that the controller reads synchronously.

  // createTablePillbox (ui-pillbox.js) calls this once per table, and a
  // rediscovery calls it again with no effect. Every setter below also calls
  // _ensureEntry, so a table can have an entry without registerTable ever
  // running for it.
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

  // The registry stores a cell's original as the record documented in
  // _ensureEntry, which carries the original text as value. This read
  // returns that text, or undefined when no original is stored. The
  // capture's state serializer and the shape fingerprint's read are the
  // callers; the cell objects and the controller (content.js) read the record
  // whole.
  function getTableOriginalText(table, cellEl) {
    const original = getTableOriginal(table, cellEl);
    return original === undefined ? undefined : original.value;
  }

  function deleteTableOriginal(table, cellEl) {
    const entry = tableRegistry.get(table);
    if (entry) entry.originals.delete(cellEl);
  }

  // Every writer writes the active table: the sidebar's apply, and a table
  // pillbox press, which makes its table active first. The settings notice
  // crosses to the sidebar, so it carries plain values alone: the source
  // ('sidebar' for the sidebar's apply, 'page' for every other writer) and a
  // copy of the stored settings. The sidebar redraws from a notice whose
  // source is not its own, and the table pillbox view redraws the active
  // table's table pillbox from every notice.
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

  function setTableMaxMagnitude(table, maxMagnitude) {
    _ensureEntry(table).maxMagnitude = maxMagnitude;
  }

  function getTableMaxMagnitude(table) {
    const entry = tableRegistry.get(table);
    return entry ? entry.maxMagnitude : null;
  }

  // The shape fingerprint a table carried when it registered. Plain values
  // only, so the fingerprint stays serializable.
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
    setTableMaxMagnitude,
    getTableMaxMagnitude,
    setTableFingerprint,
    getTableFingerprint,
  };
})();
