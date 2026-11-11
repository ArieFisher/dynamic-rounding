/**
 * DynamicRounding lib/dr-table package bundle.
 *
 * Loaded LAST within lib/dr-table, after cells.js, adapters.js, classify.js,
 * and detect.js. Those files declare their functions and classes as bare
 * top-level names on the shared global scope, and ui-pillbox.js and
 * content.js read those bare names. This file adds one more thing: a single
 * DR_TABLE object that groups every public function and class the package
 * exposes, so a consumer can depend on DR_TABLE.x instead of the bare name.
 * No file reads DR_TABLE.x yet.
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
  chainRootOf,
  isAccessibilityArtifact,
  isDataTable,
  readTableFingerprint,
  sameTableFingerprint,
};
