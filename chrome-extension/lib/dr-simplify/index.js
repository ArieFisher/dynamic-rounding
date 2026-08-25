/**
 * DynamicRounding lib/dr-simplify package bundle.
 *
 * Loaded LAST within lib/dr-simplify, after ladder.js. ladder.js still
 * declares its functions as bare top-level names on the shared global scope
 * (content.js keeps consuming those bare names unchanged — this sprint does
 * not migrate any consumer). This file adds one more thing: a single
 * DR_SIMPLIFY object that groups every public function the package exposes,
 * so future consumers can start depending on DR_SIMPLIFY.x instead of the
 * bare name without another move.
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
};
