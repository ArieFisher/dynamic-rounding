/**
 * DynamicRounding lib/dr-number package bundle.
 *
 * Loaded LAST within lib/dr-number, after rounding.js, core.js, parsing.js,
 * and identifiers.js. Those four files declare their functions as bare
 * top-level names on the shared global scope, and their callers call those
 * bare names. This file adds a single DR_NUMBER object that groups every
 * public function the package exposes. No file reads DR_NUMBER.x yet.
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
  numberFormat,
  groupShapePattern,
  isNumberShape,
  toNumber,

  // parsing.js
  lettersToColIndex,
  parseRangeEndpoint,
  parseRangeToken,
  parseRangeExpr,
  isInRanges,
  resolveOffset,
  resolveNumTop,
  matchUnitNumber,
  getExclusionReason,
  findDates,
  isAmbiguousDate,
  isDateLike,
  isTimeLike,
  clockTimeRanges,
  parseISODateTime,
  isDateTimeLike,
  roundDateText,
  roundISODateTime,
  roundTimeText,
  getQuoteMaskedRanges,
  overlapsQuoteRange,
  extractNumbersInText,
  bracketSignSpan,
  isBracketedNegative,
  matchBracketedNumber,
  eraYearDigitRanges,
  formatNumber,
  pureNumberSpan,

  // identifiers.js
  insideNumberRun,
  matchIdentifierShape,
  getIdentifierMaskedRanges,
  findIdentifiers,
};
