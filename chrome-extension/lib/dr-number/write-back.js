// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * The write-back: turning a rounded value back into text. Reads no page and
 * calls no Chrome.
 */

/**
 * The Intl formatter every rounded value is written with. It is built once,
 * because a toLocaleString call with options builds a new formatter on every
 * call, which took most of a pass's time. useGrouping stays explicit because
 * its default, "auto", groups by the locale's own rule.
 */
const GROUPED_NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 10,
  useGrouping: true,
});

/**
 * The result replaces a number's digits in place, for every cell. Its marks
 * are the ones the number format function (reader.js) returns.
 *
 * The characters around the number stay where the source put them, so a minus
 * sign is written only when originalNumStr itself starts with one. A negative
 * whose number holds no minus sign carries its sign outside the patched
 * characters: in the brackets around it (see isBracketedNegative), or in a
 * pure cell's own leading sign (see pureNumberSpan). A minus written here
 * would double that sign ("(-1,200)").
 */
function formatNumber(rounded, originalNumStr) {
  const marks = numberFormat();
  const signed = originalNumStr.startsWith('-') ? rounded : Math.abs(rounded);
  return GROUPED_NUMBER_FORMAT.format(signed)
    .replace(/[,.]/g, (mark) => (mark === ',' ? marks.group : marks.decimal));
}
