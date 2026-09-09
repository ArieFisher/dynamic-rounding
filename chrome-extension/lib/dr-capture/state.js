/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * DynamicRounding lib/dr-capture package: the capture state serializer.
 *
 * collectCaptureState() turns the application model's registry into the
 * plain-value capture state: for every registered table, its kind, applied
 * flag, last-used rounding options, frozen magnitude, locked state, row and
 * column counts, and every present cell's position, role, displayed text,
 * and original. The focused table also contributes its raw markup verbatim —
 * the fixture seed, the one piece of markup a capture carries.
 *
 * Dependencies arrive as parameters with working defaults, the same pattern
 * as GridAdapter's originals port: deps.store is the application model,
 * deps.adapterFor builds the row/cell adapter for one table. Tests hand in
 * stand-ins; the production call site (content.js) passes nothing. Cell
 * reads go only through the adapter's displayed-text read and the model's
 * plain-original-text read, so this file holds no adapter-kind and no
 * storage-shape knowledge.
 *
 * The state records absence honestly: a cell wearing the rounded marker with
 * no stored original serializes as original: null and flips the table's
 * locked flag — the same pairing tableHasUnrestorableCells (ui-toggle.js)
 * reads, produced only by a content-script re-injection — and the serializer
 * never reconstructs a value. A virtualized grid contributes only the rows
 * present in the DOM at capture time; the state carries its frozen
 * magnitude as part of the evidence.
 *
 * captureFormat is the state's format version, one integer, so a future
 * tool that parses capture files can tell old formats apart.
 */

const CAPTURE_FORMAT = 1;

function collectCaptureState(deps) {
  const store = (deps && deps.store) || DR_STORE;
  const adapterFor = (deps && deps.adapterFor) || function (table) { return makeAdapter(table); };

  const registered = store.getRegisteredTables();
  const selected = store.getSelectedTable();
  let activeTableIndex = null;

  function serializeTable(table) {
    const adapter = adapterFor(table);
    const rows = adapter.getRows();
    let columnCount = 0;
    let locked = false;
    const cells = [];
    for (let r = 0; r < rows.length; r++) {
      const rowCells = rows[r].getCells();
      if (rowCells.length > columnCount) columnCount = rowCells.length;
      const isOutside = !!rows[r].isOutside;
      for (let c = 0; c < rowCells.length; c++) {
        const cellObj = rowCells[c];
        const originalText = store.getTableOriginalText(table, cellObj.el);
        const original = originalText === undefined ? null : originalText;
        // GRID_ROUNDED_CLASS (lib/dr-table/detect.js) marks every rounded
        // cell, native and grid alike. The marker with no original behind it
        // is the locked pairing.
        const wearsMarker = !!(cellObj.el && cellObj.el.classList &&
          cellObj.el.classList.contains(GRID_ROUNDED_CLASS));
        if (wearsMarker && original === null) locked = true;
        cells.push({
          row: r,
          col: c,
          role: cellObj.tagName === 'TH' ? 'th' : 'td',
          isOutside,
          text: cellObj.getDisplayedText(),
          original,
          // Per cell, so the renderer can tell a lost original (marker,
          // original: null) from a cell that was never rounded (no marker,
          // original: null) without repeating the pairing logic.
          wearsMarker,
        });
      }
    }
    return {
      kind: adapter.isVirtualized() ? 'grid' : 'native',
      appliedFlag: store.getTableAppliedFlag(table),
      lastRoundOptions: store.getTableRoundOptions(table),
      maxMagnitude: store.getTableMaxMagnitude(table),
      locked,
      rowCount: rows.length,
      columnCount,
      cells,
    };
  }

  const tables = registered.map(function (table, index) {
    if (selected !== null && table === selected) activeTableIndex = index;
    try {
      return serializeTable(table);
    } catch (e) {
      // A capture is a bug report; one table whose walk throws must not take
      // the whole capture down. The failure itself is evidence — record it.
      return {
        kind: 'unknown',
        appliedFlag: null,
        lastRoundOptions: null,
        maxMagnitude: null,
        locked: false,
        rowCount: null,
        columnCount: null,
        cells: [],
        error: String(e && e.message ? e.message : e),
      };
    }
  });

  return {
    captureFormat: CAPTURE_FORMAT,
    settings: store.getSettings(),
    activeTableIndex,
    tables,
    fixtureSeed: selected && typeof selected.outerHTML === 'string' ? selected.outerHTML : null,
  };
}
