// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The classification ladder: the ordered per-cell rules that determine
 * whether and how a cell simplifies. classifyTableCell (lib/dr-table) calls
 * classifyCell for the rounding pass, the lens preview, and the data test,
 * and the Sheets input step calls it for each text cell.
 *
 * Core layer: reads no page and calls no Chrome. classifyCell takes the
 * cell's text, its row and column, the range list parsed once per table, and
 * the simplification options, and returns its classification as data. In the
 * extension the text is the rendered text (the raw text when the rendered
 * text is empty) or a simplified cell's stored original; in Sheets it is the
 * cell value. Four more values come from the cell's source, and the caller
 * derives them: the markup ranges, the spans of the text that the source
 * marks as a link or as code (getMarkupRanges in lib/dr-table on a page, the
 * markdown adapter in the plugin); whether the cell holds a superscript; the
 * superscript spans in the text classifyCell reads (getSuperscriptRanges);
 * and whether the cell's digits sit in more than one text piece (from the
 * piece layout). The bare names the ladder calls come from the lib/dr-number
 * files, loaded ahead of this file.
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
 * The text with each range blanked to spaces. The blanks keep every position
 * in place, so a position in the result is the same position in the text.
 */
function blankRanges(text, ranges) {
  return ranges.reduce(
    (t, r) => t.slice(0, r.start) + ' '.repeat(r.end - r.start) + t.slice(r.end), text);
}

/**
 * The dates findDates reads from the text, leaving out each date that
 * overlaps a markup range, and the spans of the dates left out. A date only
 * partly inside a link ("<a>Jan 15</a>, 2024") is left out whole. Each round
 * blanks the dates it leaves out, so a date beside them, a bare year
 * included, is read in the next round; every round blanks at least one date,
 * so the rounds end.
 */
function readDatesOutsideMarkup(text, markupRanges) {
  const heldSpans = [];
  let readText = text;
  for (;;) {
    const found = findDates(readText);
    if (!found) return { dates: null, heldSpans };
    const inside = found.filter((d) => overlapsMaskedRange(markupRanges, d.start, d.end));
    if (inside.length === 0) return { dates: found, heldSpans };
    const spans = inside.map((d) => ({ start: d.start, end: d.end }));
    heldSpans.push(...spans);
    readText = blankRanges(readText, spans);
  }
}

/**
 * The masked ranges are one list, so a new kind of text whose numbers stay as
 * written is one more source here. The identifier scan and the clock-time
 * scan read the text with each superscript span blanked, so a footnote marker
 * right after a phone number ("416-555-1234<sup>1</sup>") or a clock time
 * ("18:30<sup>2</sup>") never joins its digits.
 */
function extractSimplifyMatches(text, superscriptRanges, markupRanges = []) {
  const shapeText = blankRanges(text, superscriptRanges);
  const masked = [
    ...markupRanges,
    ...getQuoteMaskedRanges(text),
    ...getIdentifierMaskedRanges(shapeText),
    ...superscriptRanges,
    ...getEraYearMaskedRanges(text),
    ...getClockTimeMaskedRanges(shapeText),
  ];
  return extractNumbersInText(text)
    .filter((m) => !overlapsMaskedRange(masked, m.index, m.index + m.numStr.length));
}

function numberStretch(match) {
  return { kind: 'number', start: match.index, end: match.index + match.numStr.length, num: match.num };
}

/**
 * Classify a single cell and return a classification: { stretches }, the
 * cell's stretches in text order, each with its start and end in text:
 *
 *   { kind: 'number', start, end, num }
 *   { kind: 'date', start, end, ...the date findDates reads (lib/dr-number) }
 *   { kind: 'time', start, end, ...the time readTimeCell reads }
 *
 * A cell holds one kind. A cell that is one number (a pure cell, a bracketed
 * number, or a unit number) holds one number stretch over its digits. The
 * column post-pass settles the day and month of an ambiguous date stretch
 * (isAmbiguousDate).
 * A cell holds no stretch when it is out of range, under an exclusion
 * (getExclusionReason), wholly quoted, an identifier shape, or a one-number
 * cell whose number sits in a markup range; when its date or time switch is
 * off; when it holds an impossible date or time; and when it holds no number.
 * The placement step adds split: true to a classification whose split
 * stretches it removes.
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
  // The markup ranges, then each date or time that overlaps one: its digits
  // stay as written too.
  let held = markupRanges;
  // A cell that is one number gets one number stretch over its digits alone,
  // so the write-back leaves a sign, a bracket, a currency sign, a percent
  // sign, a suffix, or a currency code where the page put it.
  const oneNumber = (match) => (
    overlapsMaskedRange(held, match.index, match.index + match.numStr.length)
      ? { stretches: [] }
      : { stretches: [numberStretch(match)] });

  if (!isInRanges(rowIndex, columnIndex, ranges)) return { stretches: [] };
  if (getExclusionReason(text, columnIndex, options, rowIndex)) return { stretches: [] };
  if (isWholeCellQuoted(trimmed)) return { stretches: [] };

  // A date or a time that overlaps a markup range stays as written, and its
  // digits join the held ranges for the number steps. A clock time, or an
  // ISO date-time with its date kept, follows the "times" switch. Checked
  // before findDates, which would otherwise match the date of a
  // space-separated date-time.
  let dates = null;
  const time = readTimeCell(trimmed);
  if (time) {
    const lead = text.length - text.trimStart().length;
    const span = { start: lead, end: lead + trimmed.length };
    if (!overlapsMaskedRange(markupRanges, span.start, span.end)) {
      if (!options.simplifyTimes || time.impossible) return { stretches: [] };
      return { stretches: [{ kind: 'time', ...time, ...span }] };
    }
    held = [...held, span];
  } else {
    const read = readDatesOutsideMarkup(text, markupRanges);
    dates = read.dates;
    held = [...held, ...read.heldSpans];
  }
  if (dates) {
    if (!options.simplifyDates || dates.some((d) => d.impossible)) return { stretches: [] };
    return { stretches: dates.map((d) => ({ kind: 'date', ...d })) };
  }

  // In a cell with a superscript, the text classifyCell reads joins base and
  // exponent digits ("10<sup>12</sup>" reads "1012"), which is not the text
  // the reader sees. So no whole-cell shape is tested against it, and
  // extraction masks each superscript span.
  if (hasSuperscript) {
    return { stretches: extractSimplifyMatches(text, superscriptRanges, held).map(numberStretch) };
  }

  // An identifier shape reads as a code, not a quantity, so the whole cell
  // stays as written. Checked before the number reader, which also reads a
  // digit run with a leading zero ("0012345678", "(0012345678)") as a number.
  if (matchIdentifierShape(trimmed, digitsSpanPieces)) return { stretches: [] };

  const num = toNumber(text);
  if (num !== null) {
    const span = pureNumberSpan(text);
    return oneNumber({ numStr: span.numStr, num, index: span.index });
  }

  // A unit number ("4.91tn", "CAD45.67") is one number with a suffix or a
  // currency code.
  const unit = matchUnitNumber(text);
  if (unit) return oneNumber(unit);

  return { stretches: extractSimplifyMatches(text, superscriptRanges, held).map(numberStretch) };
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
