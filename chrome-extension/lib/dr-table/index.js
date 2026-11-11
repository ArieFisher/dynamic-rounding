/**
 * DynamicRounding lib/dr-table package bundle.
 *
 * Loaded LAST within lib/dr-table. The other files declare their functions as
 * bare top-level names, which ui-pillbox.js and content.js read. This file
 * adds a single DR_TABLE object that groups every public function and class,
 * so a consumer can depend on DR_TABLE.x instead. No file reads DR_TABLE.x yet.
 *
 * No logic lives here — this is a pure re-export list. Do not add behavior.
 */

const DR_TABLE = {
  // cells.js
  collectTextPieces,
  mapRenderedToFlat,
  writePatches,
  restoreTextPieces,
  sortCellByRecord,
  // adapters.js
  NativeTableAdapter,
  GridAdapter,
  makeAdapter,
  // classify.js
  getSuperscriptRanges,
  isCellWholeLink,
  filterLinkMatches,
  classifyTableCell,
  // detect.js
  looksLikeGrid,
  findTargetTable,
  findTables,
  scanTables,
  registrableTables,
  chainRootOf,
  isAccessibilityArtifact,
  isDataTable,
  readTableFingerprint,
  sameTableFingerprint,
};
