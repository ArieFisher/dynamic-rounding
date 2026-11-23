// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * DynamicRounding lib/dr-number package bundle.
 *
 * Loaded LAST within lib/dr-number, after every other file in it. Those
 * files declare their functions as bare top-level names on the shared global
 * scope, and their callers call those bare names. This file adds a single
 * DR_NUMBER object that groups every top-level function of those files. No
 * file reads DR_NUMBER.x yet.
 *
 * Do not add behavior.
 */

const DR_NUMBER = {
  // rounding.js
  roundWithOffset,
  roundValueSetAware,
  stepForOffset,
  formatStep,
  trimNum,
  findMaxMagnitude,

  // reader.js
  numberFormat,
  groupShapePattern,
  isNumberShape,
  toNumber,

  // settings.js
  lettersToColIndex,
  parseRangeEndpoint,
  parseRangeToken,
  parseRangeExpr,
  isInRanges,
  resolveOffset,
  resolveNumTop,

  // numbers-in-text.js
  matchUnitNumber,
  getExclusionReason,
  getQuoteMaskedRanges,
  overlapsMaskedRange,
  extractNumbersInText,
  bracketSignSpan,
  isBracketedNegative,
  matchBracketedNumber,
  pureNumberSpan,

  // dates.js
  knownDate,
  findDates,
  isAmbiguousDate,
  isDateLike,
  isTimeLike,
  getClockTimeMaskedRanges,
  parseISODateTime,
  isDateTimeLike,
  isClockTimeInRange,
  readTimeCell,
  roundDateText,
  roundClockTime,
  roundTimeText,
  getEraYearMaskedRanges,

  // write-back.js
  formatNumber,

  // identifiers.js
  insideNumberRun,
  matchIdentifierShape,
  getIdentifierMaskedRanges,
  findIdentifiers,
};
