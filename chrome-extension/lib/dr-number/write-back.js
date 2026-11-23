// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * The write-back: turning a rounded value back into text. Reads no page and
 * calls no Chrome.
 */

/**
 * The number format every rounded value is written in: en-US, grouped,
 * trailing zeros stripped. It is built once. A toLocaleString call with
 * options builds a new format on every call, which took most of a pass's
 * time: about 15 microseconds a number against well under one for a format
 * built once. formatNumber maps its marks onto the marks the number format
 * function returns.
 */
const GROUPED_NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 10,
  useGrouping: true,
});

/**
 * The one write-back: turn a rounded value into the characters that replace
 * a number's digits in place, on every cell kind. The digits are grouped and
 * written with the marks the number format function (reader.js) returns.
 * Trailing zeros are always stripped, at every magnitude.
 *
 * The characters around the number stay where the page put them, so a minus
 * sign is written only when originalNumStr itself starts with one. A negative
 * whose number holds no minus sign carries its sign outside the patched
 * characters: in the brackets around it (see isBracketedNegative), or in a
 * pure cell's own leading sign (see pureNumberSpan). A minus written here
 * would double that sign ("(-1,200)").
 *
 * @param {number} rounded - The rounded value.
 * @param {string} originalNumStr - The characters the result replaces.
 * @returns {string}
 */
function formatNumber(rounded, originalNumStr) {
  const marks = numberFormat();
  const signed = originalNumStr.startsWith('-') ? rounded : Math.abs(rounded);
  return GROUPED_NUMBER_FORMAT.format(signed)
    .replace(/[,.]/g, (mark) => (mark === ',' ? marks.group : marks.decimal));
}
