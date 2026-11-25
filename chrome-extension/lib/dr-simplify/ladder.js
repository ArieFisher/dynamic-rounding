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
 * Every date and time in the text. Each reader reads the text with the spans
 * of the readers before it blanked, so a reader earlier in the list keeps
 * the characters it reads: an ISO date-time first, because findDates reads no
 * date followed by "T"; then findDates; then clock times, on the text with
 * each superscript span blanked too, so a footnote marker right after a time
 * ("18:30<sup>2</sup>") never joins its digits.
 */
function readDatesAndTimes(text, superscriptRanges) {
  const isoPairs = findISODateTimes(text);
  const dateText = blankRanges(text, isoPairs.map(({ date, time }) => ({ start: date.start, end: time.end })));
  const dates = findDates(dateText) || [];
  const times = findClockTimes(blankRanges(dateText, [...dates, ...superscriptRanges]));
  return { isoPairs, dates, times };
}

const valuesRead = ({ isoPairs, dates, times }) =>
  [...isoPairs.flatMap(({ date, time }) => [date, time]), ...dates, ...times];

/**
 * The dates and times the text holds outside every markup range, and the
 * spans of the ones left out. A value only partly inside a link
 * ("<a>Jan 15</a>, 2024") is left out whole. Each round blanks the values it
 * leaves out, so a value beside them, a bare year included, is read in the
 * next round. Every round blanks at least one value, so the rounds end within
 * the cell's count of values.
 */
function readOutsideMarkup(text, superscriptRanges, markupRanges) {
  let heldSpans = [];
  let readText = text;
  for (;;) {
    const read = readDatesAndTimes(readText, superscriptRanges);
    const inside = valuesRead(read).filter((v) => overlapsMaskedRange(markupRanges, v.start, v.end));
    if (inside.length === 0) return { read, heldSpans };
    const spans = inside.map((v) => ({ start: v.start, end: v.end }));
    heldSpans = [...heldSpans, ...spans];
    readText = blankRanges(readText, spans);
  }
}

/**
 * The date and time stretches among the values read, each under its own
 * switch. An impossible date or time, a time followed by a decimal fraction,
 * and a clock time with no AM/PM in a cell that holds a clock time with one
 * ("12:45" in "12:45 - 1:30 PM") are held. When an ISO date-time's date
 * changes and its time is held, the date stretch covers the separator too,
 * and its separator field holds the separator's span, so the table step
 * writes a space in its place.
 */
function dateTimeStretches({ isoPairs, dates, times }, options) {
  const isDateChanged = (d) => options.simplifyDates && !d.impossible;
  const isTimeChanged = (t) => options.simplifyTimes && !t.impossible && !t.hasFraction;
  const hasMeridiemTime = times.some((t) => t.meridiem);
  const isoStretches = isoPairs.flatMap(({ date, time }) => {
    const timeStretches = isTimeChanged(time) ? [{ kind: 'time', ...time }] : [];
    if (!isDateChanged(date)) return timeStretches;
    if (timeStretches.length > 0) return [{ kind: 'date', ...date }, ...timeStretches];
    const separator = { start: date.end, end: date.end + 1 };
    return [{ kind: 'date', ...date, end: separator.end, separator }];
  });
  return [
    ...isoStretches,
    ...dates.filter(isDateChanged).map((d) => ({ kind: 'date', ...d })),
    ...times.filter((t) => isTimeChanged(t) && (t.meridiem || !hasMeridiemTime)).map((t) => ({ kind: 'time', ...t })),
  ];
}

/**
 * The masked ranges are one list, so a new kind of text whose numbers stay as
 * written is one more source here. The identifier scan reads the text with
 * each superscript span blanked, so a footnote marker right after a phone
 * number ("416-555-1234<sup>1</sup>") never joins its digits. heldRanges
 * holds the markup ranges and the span of every date and time.
 */
function extractSimplifyMatches(text, superscriptRanges, heldRanges = []) {
  const shapeText = blankRanges(text, superscriptRanges);
  const masked = [
    ...heldRanges,
    ...getQuoteMaskedRanges(text),
    ...getIdentifierMaskedRanges(shapeText),
    ...superscriptRanges,
    ...getEraYearMaskedRanges(text),
  ];
  return extractNumbersInText(text)
    .filter((m) => !overlapsMaskedRange(masked, m.index, m.index + m.numStr.length));
}

/**
 * The numbers of a cell that holds no date or time, read through the
 * whole-cell shapes first. A cell that is one number (a pure cell, a
 * bracketed number, or a unit number) gives one match over its digits alone,
 * so the write-back leaves a sign, a bracket, a currency sign, a percent
 * sign, a suffix, or a currency code where the page put it.
 */
function readNumberCell(text, input, heldRanges) {
  const { superscriptRanges = [], hasSuperscript = false, digitsSpanPieces = false } = input;
  // In a cell with a superscript, the text classifyCell reads joins base and
  // exponent digits ("10<sup>12</sup>" reads "1012"), which is not the text
  // the reader sees. So no whole-cell shape is tested against it, and
  // extraction masks each superscript span.
  if (hasSuperscript) return extractSimplifyMatches(text, superscriptRanges, heldRanges);

  // An identifier shape reads as a code, not a quantity, so the whole cell
  // stays as written. Checked before the number reader, which also reads a
  // digit run with a leading zero ("0012345678", "(0012345678)") as a number.
  if (matchIdentifierShape(text.trim(), digitsSpanPieces)) return [];

  const num = toNumber(text);
  if (num !== null) {
    const span = pureNumberSpan(text);
    return [{ numStr: span.numStr, num, index: span.index }];
  }

  // A unit number ("4.91tn", "CAD45.67") is one number with a suffix or a
  // currency code.
  const unit = matchUnitNumber(text);
  if (unit) return [unit];

  return extractSimplifyMatches(text, superscriptRanges, heldRanges);
}

function numberStretch(match) {
  return { kind: 'number', start: match.index, end: match.index + match.numStr.length, num: match.num };
}

/**
 * Classify a single cell and return a classification: { stretches }, the
 * cell's stretches in text order, each with its start and end in text:
 *
 *   { kind: 'number', start, end, num }
 *   { kind: 'date', start, end, ...the date findDates or findISODateTimes
 *     reads, and separator (see dateTimeStretches) }
 *   { kind: 'time', start, end, ...the time findClockTimes or
 *     findISODateTimes reads }
 *
 * Every number, date, and time in a cell is its own stretch under its own
 * switch. A value held stays as written and takes no stretch, and the
 * readers after it never read its characters. The column post-pass settles
 * the day and month of an ambiguous date stretch (isAmbiguousDate).
 *
 * A cell holds no stretch when it is out of range, under an exclusion
 * (getExclusionReason), wholly quoted, or an identifier shape. A value is
 * held when it overlaps a markup range or its switch is off. A date or time
 * is also held when it is impossible (see dateTimeStretches), and a number
 * when a currency or percent sign whose switch is off touches its digits
 * (touchesSwitchedOffSign). The placement step adds split: true to a
 * classification whose split stretches it removes.
 */
function classifyCell(input, options) {
  const { text, rowIndex, columnIndex, ranges, markupRanges = [], superscriptRanges = [] } = input;

  if (!isInRanges(rowIndex, columnIndex, ranges)) return { stretches: [] };
  if (getExclusionReason(columnIndex, options, rowIndex)) return { stretches: [] };
  if (isWholeCellQuoted(text.trim())) return { stretches: [] };

  const { read, heldSpans } = readOutsideMarkup(text, superscriptRanges, markupRanges);
  const dateTimeSpans = [...valuesRead(read), ...heldSpans];
  const heldRanges = [...markupRanges, ...dateTimeSpans];
  const numbers = dateTimeSpans.length > 0
    ? extractSimplifyMatches(text, superscriptRanges, heldRanges)
    : readNumberCell(text, input, heldRanges);
  const numberStretches = numbers
    .filter((m) => !overlapsMaskedRange(heldRanges, m.index, m.index + m.numStr.length))
    .filter((m) => !touchesSwitchedOffSign(text, m, options))
    .map(numberStretch);
  const stretches = [...dateTimeStretches(read, options), ...numberStretches]
    .sort((a, b) => a.start - b.start);
  return { stretches };
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
