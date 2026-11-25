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
  if (ranges.length === 0) return text;
  // One array of the text's characters, not one copy of the text per range:
  // a cell holding thousands of dates would otherwise copy its text thousands
  // of times.
  const blanked = text.split('');
  ranges.forEach((r) => blanked.fill(' ', r.start, r.end));
  return blanked.join('');
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
 * Every date and time in the text (readDatesAndTimes), with isHeld: true on
 * each one that overlaps a markup range. A value only partly inside a link
 * ("<a>Jan 15</a>, 2024") is held whole. A held value keeps its place in its
 * ISO date-time and among the cell's clock times, so the rules that read the
 * values together still see it (dateTimeStretches).
 *
 * findDates reads a bare year only when the text holds nothing else, so a
 * year beside a held date ("<a>2023-01-01</a> 2024") reads only once the held
 * values are blanked. That second read runs once: a bare year fills the text,
 * so no third value can follow it.
 */
function readOutsideMarkup(text, superscriptRanges, markupRanges) {
  const isInMarkup = (v) => overlapsMaskedRange(markupRanges, v.start, v.end);
  const mark = (v) => (isInMarkup(v) ? { ...v, isHeld: true } : v);
  const read = readDatesAndTimes(text, superscriptRanges);
  const values = valuesRead(read);
  const heldValues = values.filter(isInMarkup);
  const datesBesideHeld = heldValues.length === 0 ? [] : (findDates(blankRanges(text, heldValues)) || [])
    .filter((d) => !overlapsMaskedRange(values, d.start, d.end));
  return {
    isoPairs: read.isoPairs.map(({ date, time }) => ({ date: mark(date), time: mark(time) })),
    dates: [...read.dates, ...datesBesideHeld].map(mark),
    times: read.times.map(mark),
  };
}

/**
 * The date and time stretches among the values read, each under its own
 * switch. A value in a markup range, an impossible date or time, a time
 * followed by a decimal fraction, and a clock time with no AM/PM in a cell
 * that holds a clock time with one ("12:45" in "12:45 - 1:30 PM") are held. A
 * held clock time with an AM/PM still counts for that last rule. When an ISO
 * date-time's date changes and its time is held, the date stretch covers the
 * separator too, and its separator field holds the separator's span, so the
 * table step writes a space in its place.
 */
function dateTimeStretches({ isoPairs, dates, times }, options) {
  const isDateChanged = (d) => options.simplifyDates && !d.isHeld && !d.impossible;
  const isTimeChanged = (t) => options.simplifyTimes && !t.isHeld && !t.impossible && !t.hasFraction;
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
 * number ("416-555-1234<sup>1</sup>") never joins its digits. classifyCell
 * holds, after this step, every number that overlaps a markup range, a date,
 * or a time.
 */
function extractSimplifyMatches(text, superscriptRanges) {
  const shapeText = blankRanges(text, superscriptRanges);
  const masked = [
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
function readNumberCell(text, input) {
  const { superscriptRanges = [], hasSuperscript = false, digitsSpanPieces = false } = input;
  // In a cell with a superscript, the text classifyCell reads joins base and
  // exponent digits ("10<sup>12</sup>" reads "1012"), which is not the text
  // the reader sees. So no whole-cell shape is tested against it, and
  // extraction masks each superscript span.
  if (hasSuperscript) return extractSimplifyMatches(text, superscriptRanges);

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

  return extractSimplifyMatches(text, superscriptRanges);
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
 * (getExclusionReason), wholly quoted, a web or email address, or an
 * identifier shape. A value is
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
  // A web or email address that fills the cell holds before any date or time
  // is read: its path or query may hold one ("https://example.com/2020-07-21/
  // post"), and a changed date or time breaks the address.
  if (isWebOrEmailAddressCell(text.trim())) return { stretches: [] };

  const read = readOutsideMarkup(text, superscriptRanges, markupRanges);
  const dateTimeSpans = valuesRead(read);
  const heldRanges = [...markupRanges, ...dateTimeSpans];
  const numbers = dateTimeSpans.length > 0
    ? extractSimplifyMatches(text, superscriptRanges)
    : readNumberCell(text, input);
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
