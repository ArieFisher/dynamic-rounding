/**
 * DynamicRounding lib/dr-table package bundle.
 *
 * Loaded LAST within lib/dr-table, after cells.js, adapters.js, classify.js,
 * and detect.js. Those files still declare their functions and classes as
 * bare top-level names on the shared global scope (ui-pillbox.js and
 * content.js keep consuming those bare names unchanged — this sprint does not
 * migrate any consumer). This file adds one more thing: a single DR_TABLE
 * object that groups every public function and class the package exposes, so
 * future consumers can start depending on DR_TABLE.x instead of the bare name
 * without another move.
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
