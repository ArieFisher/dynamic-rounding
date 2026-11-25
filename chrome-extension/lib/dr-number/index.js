// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * DynamicRounding lib/dr-number package bundle.
 *
 * Loaded LAST within lib/dr-number, because the object below reads each name
 * as this file loads. The other files declare their functions as bare
 * top-level names on the shared global scope, and their callers call those
 * bare names. This file adds a single DR_NUMBER object that groups every
 * top-level function declaration of those files. No file reads DR_NUMBER.x
 * yet.
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
  touchesSwitchedOffSign,
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
  isClockTimeInRange,
  readClockTime,
  findClockTimes,
  findISODateTimes,
  roundDate,
  roundClockTime,
  roundTime,
  getEraYearMaskedRanges,

  // write-back.js
  formatNumber,

  // identifiers.js
  insideNumberRun,
  matchIdentifierShape,
  getIdentifierMaskedRanges,
  findIdentifiers,
  isWebOrEmailAddressCell,
};
