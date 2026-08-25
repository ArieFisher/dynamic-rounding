/**
 * DynamicRounding lib/dr-number package bundle.
 *
 * Loaded LAST within lib/dr-number, after rounding.js, core.js, and
 * parsing.js. Those three files still declare their functions as bare
 * top-level names on the shared global scope (content.js and sidebar.js
 * keep consuming those bare names unchanged — this sprint does not migrate
 * any consumer). This file adds one more thing:
 * a single DR_NUMBER object that groups every public function the package
 * exposes, so future consumers can start depending on DR_NUMBER.x instead of
 * the bare name without another move.
 *
 * No logic lives here — this is a pure re-export list. Do not add behavior.
 */

const DR_NUMBER = {
  // rounding.js
  roundWithOffset,
  roundCellSetAware,
  stepForOffset,
  formatStep,
  trimNum,

  // core.js
  findMaxMagnitude,
  toNumber,

  // parsing.js
  lettersToColIndex,
  parseRangeEndpoint,
  parseRangeToken,
  parseRangeExpr,
  isInRanges,
  resolveOffset,
  resolveNumTop,
  getExclusionReason,
  resolveMonthName,
  normalizeDateCandidate,
  parseDateLike,
  parseAmbiguousNumericDate,
  isDateLike,
  isTimeLike,
  parseISODateTime,
  isDateTimeLike,
  roundDateText,
  roundISODateTime,
  roundTimeText,
  getQuoteMaskedRanges,
  overlapsQuoteRange,
  extractNumberInText,
  extractNumbersInText,
  eraYearDigitRanges,
  isEraYear,
  decimalCount,
  formatExtractedNumber,
  restoreFormatting,
};
