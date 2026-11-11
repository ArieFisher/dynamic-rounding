/**
 * DynamicRounding lib/dr-simplify package bundle.
 *
 * Loaded LAST within lib/dr-simplify, after placement.js, ladder.js, and
 * table.js, which declare their functions as bare top-level names that
 * content.js calls. This file adds a single DR_SIMPLIFY object that groups every public function the
 * package exposes, so a consumer can depend on DR_SIMPLIFY.x instead of the
 * bare name.
 *
 * No logic lives here — this is a pure re-export list. Do not add behavior.
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
