/**
 * DynamicRounding lib/dr-table package bundle.
 *
 * Loaded LAST within lib/dr-table, after detect.js. detect.js still declares
 * its functions and classes as bare top-level names on the shared global
 * scope (ui-toggle.js and content.js keep consuming those bare names
 * unchanged — this sprint does not migrate any consumer). This file adds one
 * more thing: a single DR_TABLE object that groups every public function and
 * class the package exposes, so future consumers can start depending on
 * DR_TABLE.x instead of the bare name without another move.
 *
 * No logic lives here — this is a pure re-export list. Do not add behavior.
 */

const DR_TABLE = {
  // detect.js
  findCellTextNode,
  NativeTableAdapter,
  GridAdapter,
  makeAdapter,
  getSuperscriptRanges,
  isCellWholeLink,
  filterLinkMatches,
  replaceTextPreservingHTML,
  applyExtractedPatches,
  looksLikeGrid,
  findTargetTable,
  findTables,
  isPhantomA11yTable,
  isDataTable,
};
