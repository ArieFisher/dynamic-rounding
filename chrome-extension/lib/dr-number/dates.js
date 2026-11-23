// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Finding and simplifying the dates and clock times in a cell's text, and the
 * calendar years an era marker binds. Reads no page and calls no Chrome.
 */

// A month name: the full name, its three-letter short form, or "Sept", with
// an optional dot. A word that only starts like a month ("market") is not one.
const MONTH_NAMES = '(?:january|february|march|april|may|june|july|august|september|october|november|december' +
  '|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?';
// A month name's number, read from its first three letters.
const MONTH_NUMBERS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const monthNumber = (name) => MONTH_NUMBERS[name.slice(0, 3).toLowerCase()];

// Date reading. The reader works on the cell's trimmed text as written, so
// the positions it returns index that same text.
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUPERSCRIPT_TAG = 'SUP';
const FOOTNOTE_MARKERS = '*†‡';
const DATE_NOISE_CLASS = `[\\s${SUPERSCRIPT_DIGITS}${FOOTNOTE_MARKERS}]`;
// A date may touch any non-word character (a label's colon, a footnote
// marker, a superscript digit) but never a letter or digit.
const DATE_START = '(?:^|(?<=[^\\w]))';
const DATE_END = '(?=$|[^\\w])';
// Any digit run in a date may carry an ordinal suffix ("21st", "2020th"). Each
// group captures its suffix, so a cut removes the suffix with its digits, and
// parseInt reads the digits alone.
const ORD = '(?:st|nd|rd|th)?';
const DAY = `(\\d{1,2}${ORD})`;
const MONTH_NUM = `(\\d{2}${ORD})`;
const YEAR = `(\\d{4}${ORD})`;

const isDay = (s) => { const d = parseInt(s, 10); return d >= 1 && d <= 31; };
const isMonth = (s) => { const n = parseInt(s, 10); return n >= 1 && n <= 12; };

// One date with a known reading: its year, its month (1 to 12), whether the
// month stands before the year, its bounds in the text, and the span the month
// granularity removes (null when the date holds no day). The column post-pass
// builds the same shape for an all-numeric date once its column settles.
function knownDate(year, month, monthBeforeYear, start, end, dayCut) {
  return { year, month, monthBeforeYear, start, end, dayCut };
}
const datePart = (m, year, month, monthBeforeYear, dayCut) =>
  knownDate(parseInt(year, 10), month, monthBeforeYear, m.index, m.index + m[0].length, dayCut);

// The date shapes findDates reads; on two matches at the same position the
// earlier shape wins. Each regex carries the d flag, so a match holds its
// groups' positions. `read` returns the date, or null for a date that cannot
// exist (month 13, day 45). A dayCut is the day with its ordinal suffix and
// the one separator between it and the rest of the date.
const DATE_SHAPES = [
  { // ISO dash: 2020-07-21 → cut "-21"
    re: new RegExp(`${DATE_START}${YEAR}-${MONTH_NUM}-${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isMonth(m[2]) && isDay(m[3])
      ? datePart(m, m[1], parseInt(m[2], 10), false, { start: m.indices[2][1], end: m.indices[0][1] }) : null),
  },
  { // ISO slash: 2020/07/21 → cut "/21"
    re: new RegExp(`${DATE_START}${YEAR}\\/${MONTH_NUM}\\/${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isMonth(m[2]) && isDay(m[3])
      ? datePart(m, m[1], parseInt(m[2], 10), false, { start: m.indices[2][1], end: m.indices[0][1] }) : null),
  },
  { // Month DD, YYYY: June 21, 2020 → cut "21, "
    re: new RegExp(`${DATE_START}(${MONTH_NAMES})\\s+${DAY},?\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m[2])
      ? datePart(m, m[3], monthNumber(m[1]), true, { start: m.indices[2][0], end: m.indices[3][0] }) : null),
  },
  { // DD Month YYYY: 21 June 2020 → cut "21 "
    re: new RegExp(`${DATE_START}${DAY}\\s+(${MONTH_NAMES})\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m[1])
      ? datePart(m, m[3], monthNumber(m[2]), true, { start: m.indices[1][0], end: m.indices[2][0] }) : null),
  },
  { // YYYY Month DD: 2020 June 21 → cut " 21"
    re: new RegExp(`${DATE_START}${YEAR}\\s+(${MONTH_NAMES})\\s+${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m[3])
      ? datePart(m, m[1], monthNumber(m[2]), false, { start: m.indices[2][1], end: m.indices[0][1] }) : null),
  },
  { // Month YYYY: Jun 2020
    re: new RegExp(`${DATE_START}(${MONTH_NAMES})\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => datePart(m, m[2], monthNumber(m[1]), true, null),
  },
  { // All numeric: N1/N2/Y or N1-N2-Y, with a 2- or 4-digit year. Which part
    // is the day depends on the column (see the column post-pass), so the
    // date carries both cuts: a part and the separator after it.
    // 2-digit-year pivot: yy < 50 → 2000+yy, else 1900+yy.
    re: new RegExp(`${DATE_START}(\\d{1,2}${ORD})[\\/\\-](\\d{1,2}${ORD})[\\/\\-](\\d{2,4})${ORD}${DATE_END}`, 'gid'),
    read: (m) => {
      const n1 = parseInt(m[1], 10);
      const n2 = parseInt(m[2], 10);
      if (!isDay(m[1]) || !isDay(m[2]) || Math.min(n1, n2) > 12) return null;
      let year = parseInt(m[3], 10);
      if (m[3].length === 2) year = year < 50 ? 2000 + year : 1900 + year;
      return {
        year, n1, n2,
        start: m.index,
        end: m.index + m[0].length,
        n1Cut: { start: m.indices[1][0], end: m.indices[2][0] },
        n2Cut: { start: m.indices[2][0], end: m.indices[3][0] },
      };
    },
  },
];

// Bare year: 2020 (1900–2099), the whole cell apart from footnote noise.
// Strict anchors avoid false positives: "Sales: 2020", "$2,020.00", and
// "version 2020.1.3" are not dates.
const BARE_YEAR_RE = new RegExp(`^${DATE_NOISE_CLASS}*${YEAR}${DATE_NOISE_CLASS}*$`, 'id');

/**
 * Find every date in a trimmed cell text, left to right. Supported shapes:
 *   ISO dash:      2020-07-21
 *   ISO slash:     2020/07/21
 *   Named-month:   June 21, 2020 / Jun 21st, 2020 / 21 June 2020 / 2020 June 21 / Jun 2020
 *   All numeric:   7/21/2020 / 21-07-20 (read by the column post-pass)
 *   Bare year:     2020, as the whole cell
 * Each date is one of:
 *   - a date with a known reading: { year, month, monthBeforeYear, start, end, dayCut }
 *     (a bare year holds month null and no monthBeforeYear)
 *   - an all-numeric date: { year, n1, n2, start, end, n1Cut, n2Cut }
 *     (see isAmbiguousDate)
 *   - a date that cannot exist ("2020-13-45"): { impossible: true, start, end }
 * start and end bound the date in the text.
 * @returns {object[]|null} the dates, or null when the text holds none.
 */
function findDates(text) {
  if (typeof text !== 'string') return null;
  const found = [];
  DATE_SHAPES.forEach((shape, rank) => {
    for (const m of text.matchAll(shape.re)) found.push({ m, rank, shape });
  });
  found.sort((a, b) => a.m.index - b.m.index || a.rank - b.rank);
  const dates = [];
  let readTo = 0;
  for (const { m, shape } of found) {
    if (m.index < readTo) continue;
    readTo = m.index + m[0].length;
    dates.push(shape.read(m) || { impossible: true, start: m.index, end: readTo });
  }
  if (dates.length > 0) return dates;
  const bare = BARE_YEAR_RE.exec(text);
  if (bare) {
    const y = parseInt(bare[1], 10);
    if (y >= 1900 && y <= 2099) {
      return [{ year: y, month: null, start: bare.indices[1][0], end: bare.indices[1][1], dayCut: null }];
    }
  }
  return null;
}

// True for an all-numeric date whose day the column post-pass has yet to pick.
function isAmbiguousDate(date) {
  return date.n1 !== undefined;
}

function isDateLike(text) {
  return findDates(text) !== null;
}

// The one clock-time shape: HH:MM or HH:MM:SS. A whole-cell time adds an
// optional AM/PM; a time inside text is the same digits with no digit or
// colon on either side, so "123:45" and "16:9" never read as times. The
// groups hold the hour, the minutes, and the seconds, and roundTimeText
// reads them with the AM/PM group after them.
const CLOCK_TIME_SOURCE = '(\\d{1,2}):(\\d{2})(?::(\\d{2}))?';
const WHOLE_CELL_TIME_RE = new RegExp('^' + CLOCK_TIME_SOURCE + '(\\s*[ap]\\.?m\\.?)?$', 'i');
const CLOCK_TIME_IN_TEXT_RE = new RegExp('(?<![\\d:])' + CLOCK_TIME_SOURCE + '(?![\\d:])', 'g');

function isTimeLike(text) {
  return WHOLE_CELL_TIME_RE.test(text);
}

/**
 * Return {start, end} ranges (offsets into `text`) of every clock time inside
 * the text ("9:45 - 11:45 AM" holds two). Each range covers the digits and
 * colons alone; an AM/PM holds no digit to mask.
 */
function clockTimeRanges(text) {
  if (typeof text !== 'string') return [];
  return Array.from(text.matchAll(CLOCK_TIME_IN_TEXT_RE),
    (m) => ({ start: m.index, end: m.index + m[0].length }));
}

/**
 * Parse an ISO 8601 date-time string into its wall-clock components.
 * Accepts "YYYY-MM-DDTHH:MM[:SS[.fff]][Z|±HH[:]MM]"; the date/time separator
 * may be "T" or a single space. The fraction of a second and the timezone
 * offset are recognised but discarded; a missing seconds field reads as 0.
 * @returns {{year:number, month:number, day:number, hour:number, minute:number, second:number}|null}
 */
function parseISODateTime(text) {
  if (typeof text !== 'string') return null;
  const m = text.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = m[6] ? parseInt(m[6], 10) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute, second };
}

function isDateTimeLike(text) {
  return parseISODateTime(text) !== null;
}

/**
 * Simplify every date in a cell's text to the requested granularity by
 * dropping the parts finer than it. Only the dates change; text around them
 * stays.
 *   'month'   → removes the day and its separator, keeping the cell's own
 *               style: "Dec 13, 2096" → "Dec 2096", "2096-12-13" → "2096-12".
 *               A date with no day stays as written.
 *   'quarter' → replaces the date with its quarter and full year, on the
 *               side of the year where the month stood: "Dec 13, 2096" →
 *               "Q4 2096", "2096-12-13" → "2096 Q4". A date with no month
 *               stays as written.
 *   'year'    → the year: 2096.
 *   'decade'  → the first year of its decade: 2090.
 *   'century' → the first year of its century: 2000.
 *
 * @param {string} text          - The cell's trimmed text.
 * @param {string} granularity   - 'month' | 'quarter' | 'year' | 'decade' | 'century'.
 * @param {{year:number, month:number|null, monthBeforeYear?:boolean, start:number, end:number,
 *   dayCut:{start:number,end:number}|null}[]} [dates]
 *   The dates the classification pass read from this text, each with a known
 *   reading, in text order. If omitted, findDates is called, and text holding
 *   an all-numeric or impossible date is returned unchanged.
 * @returns {string}
 */
function roundDateText(text, granularity, dates) {
  const list = dates || findDates(text);
  if (!list || list.some((d) => d.impossible || isAmbiguousDate(d))) return text;
  const step = granularity === 'century' ? 100 : granularity === 'decade' ? 10 : 1;
  let out = text;
  // Right to left, so each edit leaves the positions of the dates before it.
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    if (granularity === 'month') {
      if (d.dayCut) out = out.slice(0, d.dayCut.start) + out.slice(d.dayCut.end);
    } else if (granularity === 'quarter') {
      if (!d.month) continue;
      const q = 'Q' + Math.ceil(d.month / 3);
      out = out.slice(0, d.start) + (d.monthBeforeYear ? q + ' ' + d.year : d.year + ' ' + q) + out.slice(d.end);
    } else {
      out = out.slice(0, d.start) + String(Math.floor(d.year / step) * step) + out.slice(d.end);
    }
  }
  return out;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const TIME_STEP_SECONDS = { minute: SECONDS_PER_MINUTE, hour: SECONDS_PER_HOUR };

/**
 * The one rounding rule for a time of day, read by every clock time and ISO
 * date-time. The time rounds to the nearest hour or minute, half up. A time in
 * the last hour of the clock goes down at hour, and a time in its last minute
 * goes down at minute, so no time passes midnight. The last hour is an hour of
 * 23, or an hour of 11 as written with PM or, off the twenty-four hour clock,
 * with no AM/PM. The seconds drop.
 *
 * The hour arrives as written: isPm is true or false with an AM/PM and absent
 * without, and isTwentyFourHour is true for an ISO date-time, which is always
 * on the twenty-four hour clock. The result gives the hour in the convention
 * it came in, or null for a part out of range or an unknown granularity.
 */
function roundClockTime({ hour, minute, second, isPm, isTwentyFourHour }, granularity) {
  const step = TIME_STEP_SECONDS[granularity];
  const hasMeridiem = typeof isPm === 'boolean';
  const hourInRange = hasMeridiem ? hour >= 1 && hour <= 12 : hour >= 0 && hour <= 23;
  if (!step || !hourInRange || minute > 59 || second > 59) return null;
  const hour24 = hasMeridiem ? (hour % 12) + (isPm ? 12 : 0) : hour;
  const isLastHour = hour24 === 23 || (!hasMeridiem && !isTwentyFourHour && hour === 11);
  const isLastStep = isLastHour && (granularity === 'hour' || minute === 59);
  const total = hour24 * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE + second;
  const down = total - (total % step);
  const rounded = !isLastStep && total - down >= step / 2 ? down + step : down;
  const roundedHour = Math.floor(rounded / SECONDS_PER_HOUR);
  const roundedMinute = (rounded % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE;
  if (!hasMeridiem) return { hour: roundedHour, minute: roundedMinute, isPm: null };
  return { hour: roundedHour % 12 || 12, minute: roundedMinute, isPm: roundedHour >= 12 };
}

/**
 * Simplify a cell holding one clock time or one ISO date-time per the time
 * granularity, through roundClockTime. A clock time keeps its AM/PM style and
 * its hour padding: "11:59:30 a.m." becomes "12:00 p.m." at minute. An ISO
 * date-time keeps its date and becomes "YYYY-MM-DD HH:MM". Returns null when
 * the text holds neither or the result equals the text.
 */
function roundTimeText(text, granularity) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const pad = (n) => String(n).padStart(2, '0');
  const dt = parseISODateTime(trimmed);
  const m = dt ? null : trimmed.match(WHOLE_CELL_TIME_RE);
  if (!dt && !m) return null;
  const meridiem = m ? m[4] || '' : '';
  const time = dt ? { ...dt, isTwentyFourHour: true } : {
    hour: parseInt(m[1], 10), minute: parseInt(m[2], 10), second: m[3] ? parseInt(m[3], 10) : 0,
    isPm: meridiem ? /p/i.test(meridiem) : undefined,
  };
  const rounded = roundClockTime(time, granularity);
  if (!rounded) return null;
  let result;
  if (dt) {
    result = `${dt.year}-${pad(dt.month)}-${pad(dt.day)} ${pad(rounded.hour)}:${pad(rounded.minute)}`;
  } else {
    const hour = !meridiem && m[1].length === 2 ? pad(rounded.hour) : String(rounded.hour);
    // Swap the a/p letter alone, so the suffix keeps its case, dots, and spacing.
    const suffix = rounded.isPm ? meridiem.replace(/a/i, (c) => (c === 'A' ? 'P' : 'p'))
      : meridiem.replace(/p/i, (c) => (c === 'P' ? 'A' : 'a'));
    result = `${hour}:${pad(rounded.minute)}${suffix}`;
  }
  return result === trimmed ? null : result;
}

// --- Era-marked calendar years (e.g. "2898 AD", "500 BC", "AD 79", "1200 CE") ---
// A number bound to an era marker is a calendar year — a date — so it must be
// rounded by date logic (decade/century), never by the numeric offset. These
// helpers locate such year tokens so they can be excluded from numeric magnitude
// detection, numeric rounding, and the lens preview samples.
// Period-less markers must be UPPERCASE. Bare lowercase forms ("ad", "bp",
// "ah", "ce", "bc") collide with ordinary English words and abbreviations
// ("ad hoc", "120 bp" basis points, "ah") and must not be read as years.
// Conventionally written eras are uppercase (AD, BC, CE, BCE, AH, BP), so this
// keeps real years matching while dropping the word collisions. BCE precedes BC
// so the longer marker wins the alternation.
const ERA_MARKER_UPPER = '(?:AD|BCE|BC|CE|AH|BP)';
// Period-punctuated forms are unambiguous, so they stay case-insensitive
// ("A.D.", "a.d.", "B.C.E.", …). Each requires at least its first period, so a
// bare uppercase form is matched only by ERA_MARKER_UPPER above.
const ERA_MARKER_DOTTED = '(?:[Aa]\\.[Dd]\\.?|[Bb]\\.[Cc]\\.[Ee]\\.?|[Bb]\\.[Cc]\\.?|[Cc]\\.[Ee]\\.?|[Aa]\\.[Hh]\\.?|[Bb]\\.[Pp]\\.?)';
const ERA_MARKER = '(?:' + ERA_MARKER_UPPER + '|' + ERA_MARKER_DOTTED + ')';
// "<year> <era>": the digits are not part of a larger number (no leading digit
// or decimal point) and the era marker is a standalone token (not followed by a
// letter, so "ADELAIDE" / "ADD" never match). Case-sensitive ('g', not 'gi') so
// the uppercase-only requirement on period-less markers holds.
const ERA_YEAR_AFTER_RE = new RegExp('(?<![\\d.])(\\d[\\d,]*)\\s*' + ERA_MARKER + '(?![A-Za-z])', 'g');
// "<era> <year>": e.g. "AD 79". Era marker preceded by a non-letter boundary.
const ERA_YEAR_BEFORE_RE = new RegExp('(?<![A-Za-z])' + ERA_MARKER + '\\s+(\\d[\\d,]*)', 'g');

/**
 * Return {start, end} ranges (offsets into `text`) of every digit run that
 * forms a calendar year bound to an era marker, in either order ("2898 AD" or
 * "AD 79").
 */
function eraYearDigitRanges(text) {
  if (typeof text !== 'string') return [];
  const ranges = [];
  let m;
  const after = new RegExp(ERA_YEAR_AFTER_RE.source, 'g');
  while ((m = after.exec(text)) !== null) {
    const start = m.index + m[0].indexOf(m[1]);
    ranges.push({ start, end: start + m[1].length });
  }
  const before = new RegExp(ERA_YEAR_BEFORE_RE.source, 'g');
  while ((m = before.exec(text)) !== null) {
    const start = m.index + m[0].lastIndexOf(m[1]);
    ranges.push({ start, end: start + m[1].length });
  }
  return ranges;
}
