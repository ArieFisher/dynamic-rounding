/**
 * DynamicRounding lib/dr-simplify package bundle.
 *
 * DR_SIMPLIFY groups every top-level function of placement.js, ladder.js, and
 * table.js. This file reads their names as it loads, so it loads after them.
 * The content script and the Sheets library call the bare names; no file
 * reads DR_SIMPLIFY.x yet. Do not add behavior.
 */

const DR_SIMPLIFY = {
  // placement.js
  pieceHolding,
  flatRange,
  layoutPieceHolding,
  flatPatches,
  placeDecision,
  // ladder.js
  isWholeCellQuoted,
  filterMaskedMatches,
  extractSimplifyMatches,
  classifyCell,
  pickDateFormatHint,
  resolveAmbiguousDateDecision,
  // table.js
  decisionToLegacyInfo,
  resolveAmbiguousDates,
  datasetMaxMagnitude,
  classifiedCellPatches,
  tablePatches,
};
