/**
 * DynamicRounding lib/dr-simplify package bundle.
 *
 * Loaded LAST within lib/dr-simplify, after ladder.js and table.js. Both
 * declare their functions as bare top-level names on the shared global
 * scope, and content.js calls those bare names. This file adds one more
 * thing: a single DR_SIMPLIFY object that groups every public function the
 * package exposes, so a consumer can depend on DR_SIMPLIFY.x instead of the
 * bare name.
 *
 * No logic lives here — this is a pure re-export list. Do not add behavior.
 */

const DR_SIMPLIFY = {
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
