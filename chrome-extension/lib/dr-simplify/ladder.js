// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The classification ladder: the ordered per-cell rules that determine
 * whether and how a cell simplifies. classifyTableCell (lib/dr-table) calls
 * classifyCell for the rounding pass, the lens preview, and the data test,
 * and the Sheets input step calls it for each text cell.
 *
 * Core layer: reads no page and calls no Chrome. classifyCell takes the
 * cell's text, its row and column, the range list parsed once per table, and
 * the simplification options, and returns its decision as data. In the
 * extension the text is the rendered text (the raw text when the rendered
 * text is empty) or a simplified cell's stored original; in Sheets it is the
 * cell value. Four more values come from the cell's source, and the caller
 * derives them: the markup ranges, the spans of the text that the source
 * marks as a link or as code (getMarkupRanges in lib/dr-table on a page, the
 * markdown adapter in the plugin); whether the cell holds a superscript; the
 * superscript spans in the text classifyCell reads (getSuperscriptRanges);
 * and whether the cell's digits sit in more than one text piece (from the
 * piece layout), so the join of numbers in separate pieces never reads as one
 * spaced identifier. The bare names the ladder calls come from lib/dr-number's
 * core.js, parsing.js, and identifiers.js, loaded ahead of this file.
 */

/**
 * True when trimmedText is a single balanced ASCII double-quoted span
 * spanning the entire cell (e.g. `"12345"`). Such cells are left untouched —
 * quoting is read as "treat this text literally," not as a number to round.
 */
function isWholeCellQuoted(trimmedText) {
  return trimmedText.startsWith('"') && trimmedText.endsWith('"') &&
    (trimmedText.match(/"/g) || []).length === 2;
}

/**
 * The masked ranges are one list, so a new kind of text whose numbers stay as
 * written is one more source here. The identifier scan and the clock-time
 * scan read the text with each superscript span blanked to spaces, so a
 * footnote marker right after a phone number ("416-555-1234<sup>1</sup>") or
 * a clock time ("18:30<sup>2</sup>") never joins its digits; the blanks keep
 * every position in place.
 */
function extractSimplifyMatches(text, superscriptRanges, markupRanges = []) {
  const shapeText = superscriptRanges.reduce(
    (t, r) => t.slice(0, r.start) + ' '.repeat(r.end - r.start) + t.slice(r.end), text);
  const masked = [
    ...markupRanges,
    ...getQuoteMaskedRanges(text),
    ...getIdentifierMaskedRanges(shapeText),
    ...superscriptRanges,
    ...eraYearDigitRanges(text),
    ...clockTimeRanges(shapeText),
  ];
  return extractNumbersInText(text)
    .filter((m) => !overlapsMaskedRange(masked, m.index, m.index + m.numStr.length));
}

/**
 * Classify a single cell and return a decision: { mode, reason, value?,
 * pending? }.
 *
 *   mode: 'skip' | 'date' | 'time' | 'extracted'
 *   reason: the rule that gave the mode. For a skip: 'out-of-range', the
 *     exclusion getExclusionReason returns ('first-row', 'first-column',
 *     'percent', 'currency'), 'quoted', 'times-disabled', 'dates-disabled',
 *     'impossible-date', 'identifier', 'markup', or 'no-number'. 'superscript'
 *     marks a cell with a superscript whose text the number reader reads as one
 *     number, skipped or extracted. 'unit' marks a unit number, and
 *     'simplify' every other cell that simplifies.
 *   value: mode-specific payload —
 *     'date' (resolved) → { dates }, each date with a known reading — see
 *       findDates in lib/dr-number
 *     'date' (needs the column post-pass) → { dates }, at least one of them
 *       all-numeric (isAmbiguousDate), plus pending: 'ambiguous-date'
 *     'extracted' → { matches }. A cell that is one number (a pure cell, a
 *       bracketed number, or a unit number) holds one match.
 */
function classifyCell(input, options) {
  const {
    text,
    rowIndex,
    columnIndex,
    ranges,
    markupRanges = [],
    hasSuperscript = false,
    superscriptRanges = [],
    digitsSpanPieces = false,
  } = input;
  const trimmed = text.trim();
  // A cell that is one number gets one match over its digits alone, so the
  // write-back leaves a sign, a bracket, a currency sign, a percent sign, a
  // suffix, or a currency code where the page put it.
  const oneNumber = (match, reason) => (
    overlapsMaskedRange(markupRanges, match.index, match.index + match.numStr.length)
      ? { mode: 'skip', reason: 'markup' }
      : { mode: 'extracted', reason, value: { matches: [match] } });

  if (!isInRanges(rowIndex, columnIndex, ranges)) {
    return { mode: 'skip', reason: 'out-of-range' };
  }

  const exclusion = getExclusionReason(text, columnIndex, options, rowIndex);
  if (exclusion) return { mode: 'skip', reason: exclusion };

  if (isWholeCellQuoted(trimmed)) {
    return { mode: 'skip', reason: 'quoted' };
  }

  // A clock time, or an ISO date-time with its date kept, follows the "times"
  // switch. Checked before findDates, which would otherwise match the date of
  // a space-separated date-time.
  if (isDateTimeLike(trimmed) || isTimeLike(trimmed)) {
    return options.simplifyTimes
      ? { mode: 'time', reason: 'simplify' }
      : { mode: 'skip', reason: 'times-disabled' };
  }

  const dates = findDates(trimmed);
  if (dates) {
    if (!options.simplifyDates) return { mode: 'skip', reason: 'dates-disabled' };
    if (dates.some((d) => d.impossible)) return { mode: 'skip', reason: 'impossible-date' };
    if (dates.some(isAmbiguousDate)) {
      return { mode: 'date', reason: 'simplify', pending: 'ambiguous-date', value: { dates } };
    }
    return { mode: 'date', reason: 'simplify', value: { dates } };
  }

  // In a cell with a superscript, the text classifyCell reads joins base and
  // exponent digits ("10<sup>12</sup>" reads "1012"), which is not the text
  // the reader sees. So no whole-cell shape is tested against it, and
  // extraction masks each superscript span.
  if (hasSuperscript) {
    const isNumber = toNumber(text) !== null;
    const matches = extractSimplifyMatches(text, superscriptRanges, markupRanges);
    if (matches.length === 0) return { mode: 'skip', reason: isNumber ? 'superscript' : 'no-number' };
    return { mode: 'extracted', reason: isNumber ? 'superscript' : 'simplify', value: { matches } };
  }

  // An identifier shape reads as a code, not a quantity, so the whole cell
  // stays as written. Checked before the number reader, which also reads a
  // digit run with a leading zero ("0012345678", "(0012345678)") as a number.
  if (matchIdentifierShape(trimmed, digitsSpanPieces)) {
    return { mode: 'skip', reason: 'identifier' };
  }

  const num = toNumber(text);
  if (num !== null) {
    const span = pureNumberSpan(text);
    return oneNumber({ numStr: span.numStr, num, index: span.index }, 'simplify');
  }

  // A unit number ("4.91tn", "CAD45.67") is one number with a suffix or a
  // currency code.
  const unit = matchUnitNumber(text);
  if (unit) return oneNumber(unit, 'unit');

  const matches = extractSimplifyMatches(text, superscriptRanges, markupRanges);
  if (matches.length === 0) return { mode: 'skip', reason: 'no-number' };
  return { mode: 'extracted', reason: 'simplify', value: { matches } };
}

/**
 * Decide how to read a column's ambiguous N1/N2/Y dates (e.g. "03/04/2020"),
 * given every ambiguous date's {n1, n2} found in that column. Any n > 12 in
 * one position rules out that position being the month, so a lone violator
 * pins the whole column's format ('month-first' or 'day-first'); violators on
 * both sides make the column unsafe to guess ('mixed'); no violator leaves it
 * genuinely ambiguous ('ambiguous').
 */
function pickDateFormatHint(ambiguousList) {
  let hasN1gt12 = false;
  let hasN2gt12 = false;
  for (const { n1, n2 } of ambiguousList) {
    if (n1 > 12) hasN1gt12 = true;
    if (n2 > 12) hasN2gt12 = true;
  }
  if (hasN1gt12 && !hasN2gt12) return 'day-first';
  if (hasN2gt12 && !hasN1gt12) return 'month-first';
  if (hasN1gt12 && hasN2gt12) return 'mixed';
  return 'ambiguous';
}

/**
 * Turn a pending ambiguous-date decision (classifyCell's pending:
 * 'ambiguous-date') into its final decision, given the column's format hint
 * from pickDateFormatHint. month-first and day-first give each all-numeric
 * date of the cell its day and month; mixed and ambiguous cannot be read
 * safely and downgrade the whole cell to skip, so a cell never changes some
 * of its dates and holds others.
 */
function resolveAmbiguousDateDecision(decision, hint) {
  if (hint !== 'month-first' && hint !== 'day-first') return { mode: 'skip', reason: 'ambiguous-date' };
  const isMonthFirst = hint === 'month-first';
  const dates = decision.value.dates.map((d) => (isAmbiguousDate(d)
    ? knownDate(d.year, isMonthFirst ? d.n1 : d.n2, true, d.start, d.end, isMonthFirst ? d.n2Cut : d.n1Cut)
    : d));
  return { mode: 'date', reason: 'simplify', value: { dates } };
}
