// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Finding and simplifying the dates and clock times in a cell's text, and the
 * calendar years an era marker binds. Reads no page and calls no Chrome.
 */

// A month name: the full name, its three-letter short form, or "Sept", with
// an optional dot. Each date shape bounds the name with whitespace or the
// date's own edge, so a word that only starts like a month ("market") is not
// one.
const MONTH_NAMES = '(?:january|february|march|april|may|june|july|august|september|october|november|december' +
  '|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?';
const MONTH_NUMBERS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const monthNumber = (name) => MONTH_NUMBERS[name.slice(0, 3).toLowerCase()];

// Date reading. findDates works on the cell's text as written, so the
// positions it returns index that same text.
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const FOOTNOTE_MARKERS = '*†‡';
const DATE_NOISE_CLASS = `[\\s${SUPERSCRIPT_DIGITS}${FOOTNOTE_MARKERS}]`;
// A date may touch any non-word character (a label's colon, a footnote
// marker, a superscript digit) but never a letter, digit, or underscore.
const DATE_START = '(?:^|(?<=[^\\w]))';
const DATE_END = '(?=$|[^\\w])';
// Any digit run in a date may carry an ordinal suffix ("21st", "2020th"). A
// day, month, or year group holds its suffix, so a cut includes the suffix with
// its digits, and parseInt reads the digits alone. The all-numeric shape's
// year group holds the digits alone, because the two-digit pivot reads their
// count.
const ORDINAL_SUFFIX = '(?:st|nd|rd|th)?';
const DAY_DIGITS = `\\d{1,2}${ORDINAL_SUFFIX}`;
const DAY = `(?<day>${DAY_DIGITS})`;
const MONTH_NUM = `(?<month>\\d{2}${ORDINAL_SUFFIX})`;
const YEAR = `(?<year>\\d{4}${ORDINAL_SUFFIX})`;
const MONTH_NAME = `(?<monthName>${MONTH_NAMES})`;

const isDay = (s) => { const d = parseInt(s, 10); return d >= 1 && d <= 31; };
const isMonth = (s) => { const n = parseInt(s, 10); return n >= 1 && n <= 12; };

// One date with a known reading: its year, its month (1 to 12), whether the
// month stands before the year, its bounds in the text, and the span the month
// granularity removes (null when the date holds no day). The column post-pass
// builds the same shape for an all-numeric date once its column settles.
function knownDate(year, month, monthBeforeYear, start, end, dayCut) {
  return { year, month, monthBeforeYear, start, end, dayCut };
}
const knownDateFromMatch = (m, month, monthBeforeYear, dayCut) =>
  knownDate(parseInt(m.groups.year, 10), month, monthBeforeYear, m.index, m.index + m[0].length, dayCut);
const startOf = (m, group) => m.indices.groups[group][0];
const endOf = (m, group) => m.indices.groups[group][1];

// The date shapes findDates reads; on two matches at the same position the
// earlier shape wins. Each regex carries the d flag, so a match holds its
// groups' positions. `read` returns the date, or null for an impossible date
// (month 13, day 45). A dayCut is the day with its ordinal suffix and
// the one separator between it and the rest of the date.
const DATE_SHAPES = [
  { // ISO, one separator twice: 2020-07-21 → cut "-21", 2020/07/21 → cut "/21"
    re: new RegExp(`${DATE_START}${YEAR}(?<separator>[-\\/])${MONTH_NUM}\\k<separator>${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isMonth(m.groups.month) && isDay(m.groups.day)
      ? knownDateFromMatch(m, parseInt(m.groups.month, 10), false,
        { start: endOf(m, 'month'), end: endOf(m, 'day') })
      : null),
  },
  { // Month DD, YYYY: June 21, 2020 → cut "21, "
    re: new RegExp(`${DATE_START}${MONTH_NAME}\\s+${DAY},?\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m.groups.day)
      ? knownDateFromMatch(m, monthNumber(m.groups.monthName), true,
        { start: startOf(m, 'day'), end: startOf(m, 'year') })
      : null),
  },
  { // DD Month YYYY: 21 June 2020 → cut "21 "
    re: new RegExp(`${DATE_START}${DAY}\\s+${MONTH_NAME}\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m.groups.day)
      ? knownDateFromMatch(m, monthNumber(m.groups.monthName), true,
        { start: startOf(m, 'day'), end: startOf(m, 'monthName') })
      : null),
  },
  { // YYYY Month DD: 2020 June 21 → cut " 21"
    re: new RegExp(`${DATE_START}${YEAR}\\s+${MONTH_NAME}\\s+${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m.groups.day)
      ? knownDateFromMatch(m, monthNumber(m.groups.monthName), false,
        { start: endOf(m, 'monthName'), end: endOf(m, 'day') })
      : null),
  },
  { // Month YYYY: Jun 2020
    re: new RegExp(`${DATE_START}${MONTH_NAME}\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => knownDateFromMatch(m, monthNumber(m.groups.monthName), true, null),
  },
  { // All numeric: N1/N2/Y or N1-N2-Y, with a 2- or 4-digit year. Which part
    // is the day depends on the column (see the column post-pass), so the
    // date carries both cuts: a part and the separator after it.
    // 2-digit-year pivot: yy < 50 → 2000+yy, else 1900+yy.
    re: new RegExp(`${DATE_START}(?<n1>${DAY_DIGITS})[\\/\\-](?<n2>${DAY_DIGITS})[\\/\\-]` +
      `(?<year>\\d{2,4})${ORDINAL_SUFFIX}${DATE_END}`, 'gid'),
    read: (m) => {
      const n1 = parseInt(m.groups.n1, 10);
      const n2 = parseInt(m.groups.n2, 10);
      if (!isDay(m.groups.n1) || !isDay(m.groups.n2) || Math.min(n1, n2) > 12) return null;
      let year = parseInt(m.groups.year, 10);
      if (m.groups.year.length === 2) year = year < 50 ? 2000 + year : 1900 + year;
      return {
        year, n1, n2,
        start: m.index,
        end: m.index + m[0].length,
        n1Cut: { start: startOf(m, 'n1'), end: startOf(m, 'n2') },
        n2Cut: { start: startOf(m, 'n2'), end: startOf(m, 'year') },
      };
    },
  },
];

// Bare year: 2020 (1900–2099), the whole cell apart from footnote noise.
// Strict anchors avoid false positives: "Sales: 2020", "$2,020.00", and
// "version 2020.1.3" are not dates.
const BARE_YEAR_RE = new RegExp(`^${DATE_NOISE_CLASS}*${YEAR}${DATE_NOISE_CLASS}*$`, 'id');

/**
 * Find every date in a cell's text, left to right: each match of a shape
 * in DATE_SHAPES, or else a bare year as the whole cell. Each date is a date
 * with a known reading (see knownDate; a bare year holds month null and no
 * monthBeforeYear), an all-numeric date (see the all-numeric shape), or an
 * impossible date ("2020-13-45"): { impossible: true, start, end }.
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
    const y = parseInt(bare.groups.year, 10);
    if (y >= 1900 && y <= 2099) {
      return [knownDate(y, null, undefined, startOf(bare, 'year'), endOf(bare, 'year'), null)];
    }
  }
  return null;
}

// True for an all-numeric date whose day the column post-pass has yet to pick.
function isAmbiguousDate(date) {
  return date.n1 !== undefined;
}

// The one clock-time shape: HH:MM or HH:MM:SS, with no digit or colon on
// either side, so "123:45" and "16:9" never read as times.
const CLOCK_TIME_SOURCE = '(?<![\\d:])(?<hour>\\d{1,2}):(?<minute>\\d{2})(?::(?<second>\\d{2}))?(?![\\d:])';
// An AM/PM, after optional whitespace, as its own token.
const MERIDIEM_SOURCE = '\\s*[aApP]\\.?[mM]\\.?(?![A-Za-z])';
// A clock time takes the AM/PM after it into its own characters.
const CLOCK_TIME_RE = new RegExp(CLOCK_TIME_SOURCE + '(?<meridiem>' + MERIDIEM_SOURCE + ')?', 'g');
// A clock time followed by a decimal fraction ("Lap 3:43.13") is a race time
// or a duration in tenths, not a time of day.
const FRACTION_AFTER_RE = /^\.\d/;
// An ISO date-time: a date, "T" or one space, and a clock time, with a
// fraction of a second after the seconds only and an optional time zone. A
// date followed by a twelve-hour time ("2026-11-09 7:30 PM") is a date and a
// clock time, not an ISO date-time.
const ISO_DATE_TIME_RE = new RegExp('(?<!\\w)(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})[T ]' +
  CLOCK_TIME_SOURCE + '(?:(?<=:\\d{2}:\\d{2})\\.\\d{1,9})?(?:Z|[+-]\\d{2}:?\\d{2})?' +
  '(?![\\w:]|\\.\\d|' + MERIDIEM_SOURCE + ')', 'gd');

// The one range check for a time's parts: an hour of 1 to 12 with an AM/PM or
// 0 to 23 without, and minutes and seconds of 0 to 59.
function isClockTimeInRange(hour, minute, second, hasMeridiem) {
  const hourInRange = hasMeridiem ? hour >= 1 && hour <= 12 : hour >= 0 && hour <= 23;
  return hourInRange && minute <= 59 && second <= 59;
}

// One time from a match of a pattern holding CLOCK_TIME_SOURCE, over
// [start, end): its hour as written (hourText), hour, minute, second, and its
// AM/PM as written (meridiem, '' for none). A time with a part out of range
// ("24:00", "10:00:75") is { impossible: true, start, end }.
function readClockTime(groups, start, end, meridiem) {
  const time = {
    start,
    end,
    hourText: groups.hour,
    hour: parseInt(groups.hour, 10),
    minute: parseInt(groups.minute, 10),
    second: groups.second ? parseInt(groups.second, 10) : 0,
    meridiem,
  };
  return isClockTimeInRange(time.hour, time.minute, time.second, meridiem !== '')
    ? time : { impossible: true, start, end };
}

/**
 * Find every clock time in the text, left to right ("9:45 - 11:45 AM" holds
 * two). Each is a time (see readClockTime), an impossible time, or
 * { hasFraction: true, start, end } for a time followed by a decimal
 * fraction. Each span covers the time's digits and colons and its AM/PM.
 */
function findClockTimes(text) {
  return Array.from(text.matchAll(CLOCK_TIME_RE), (m) => {
    const start = m.index;
    const end = start + m[0].length;
    if (FRACTION_AFTER_RE.test(text.slice(end))) return { hasFraction: true, start, end };
    return readClockTime(m.groups, start, end, m.groups.meridiem || '');
  });
}

/**
 * Find every ISO date-time in the text, left to right, as a date and a time.
 * The date spans "YYYY-MM-DD" and is a date with a known reading (see
 * knownDate) or an impossible date. The time spans the separator through the
 * time zone and is a time (see readClockTime) on the twenty-four hour clock
 * (isTwentyFourHour), or an impossible time.
 * @returns {{date: object, time: object}[]}
 */
function findISODateTimes(text) {
  return Array.from(text.matchAll(ISO_DATE_TIME_RE), (m) => {
    const { year, month, day } = m.groups;
    const dateEnd = endOf(m, 'day');
    const date = isMonth(month) && isDay(day)
      ? knownDate(parseInt(year, 10), parseInt(month, 10), false, m.index, dateEnd,
        { start: endOf(m, 'month'), end: dateEnd })
      : { impossible: true, start: m.index, end: dateEnd };
    const time = readClockTime(m.groups, dateEnd, m.index + m[0].length, '');
    return { date, time: time.impossible ? time : { ...time, isTwentyFourHour: true } };
  });
}

/**
 * The new text of one date with a known reading (see knownDate), simplified
 * to the granularity. The date's bounds and its dayCut index text, so the
 * month granularity keeps the date's own characters around the cut. A date
 * the granularity leaves alone (no day at month, no month at quarter) comes
 * back as written.
 */
function roundDate(text, date, granularity) {
  const written = text.slice(date.start, date.end);
  if (granularity === 'month') {
    if (!date.dayCut) return written;
    return text.slice(date.start, date.dayCut.start) + text.slice(date.dayCut.end, date.end);
  }
  if (granularity === 'quarter') {
    if (!date.month) return written;
    const q = 'Q' + Math.ceil(date.month / 3);
    return date.monthBeforeYear ? q + ' ' + date.year : date.year + ' ' + q;
  }
  const step = granularity === 'century' ? 100 : granularity === 'decade' ? 10 : 1;
  return String(Math.floor(date.year / step) * step);
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const TIME_STEP_SECONDS = { minute: SECONDS_PER_MINUTE, hour: SECONDS_PER_HOUR };

/**
 * The one rounding rule for a time of day: every clock time and ISO date-time
 * rounds through it.
 *
 * The hour arrives as written: isPm is true or false with an AM/PM and absent
 * without, and isTwentyFourHour is true for an ISO date-time, which is always
 * on the twenty-four hour clock. The result gives the hour in the convention
 * it came in, or null for a part out of range or an unknown granularity.
 */
function roundClockTime({ hour, minute, second, isPm, isTwentyFourHour }, granularity) {
  const step = TIME_STEP_SECONDS[granularity];
  const hasMeridiem = typeof isPm === 'boolean';
  if (!step || !isClockTimeInRange(hour, minute, second, hasMeridiem)) return null;
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
 * The new text of one time (see findClockTimes and findISODateTimes), rounded
 * to the granularity through roundClockTime, or null when it cannot round. A
 * clock time keeps its AM/PM style and its hour padding: "11:59:30 a.m."
 * becomes "12:00 p.m." at minute. An ISO date-time's time spans its
 * separator, so it becomes " HH:MM".
 */
function roundTime(time, granularity) {
  const pad = (n) => String(n).padStart(2, '0');
  const { hourText, hour, minute, second, meridiem, isTwentyFourHour } = time;
  const isPm = meridiem ? /p/i.test(meridiem) : undefined;
  const rounded = roundClockTime({ hour, minute, second, isPm, isTwentyFourHour }, granularity);
  if (!rounded) return null;
  if (isTwentyFourHour) return ` ${pad(rounded.hour)}:${pad(rounded.minute)}`;
  const roundedHour = !meridiem && hourText.length === 2 ? pad(rounded.hour) : String(rounded.hour);
  // Swap the a/p letter alone, so the suffix keeps its case, dots, and spacing.
  const suffix = rounded.isPm ? meridiem.replace(/a/i, (c) => (c === 'A' ? 'P' : 'p'))
    : meridiem.replace(/p/i, (c) => (c === 'P' ? 'A' : 'a'));
  return `${roundedHour}:${pad(rounded.minute)}${suffix}`;
}

// --- Era-marked calendar years (e.g. "2898 AD", "500 BC", "AD 79", "1200 CE") ---
// A number bound to an era marker is a calendar year. Its digits form a masked
// range, so they stay as written, the cell's other numbers round, and the year
// stays out of the max magnitude and the lens preview samples.
// getEraYearMaskedRanges locates such years.
// A marker with no period must be uppercase: its lowercase forms are ordinary
// words and abbreviations ("ad hoc", "120 bp" basis points, "ah"). BCE precedes
// BC so the longer marker wins the alternation.
const ERA_MARKER_UPPER = '(?:AD|BCE|BC|CE|AH|BP)';
// A marker with periods matches in any case ("A.D.", "a.d.", "B.C.E."). Each
// form requires at least its first period, so a marker with no period matches
// ERA_MARKER_UPPER alone.
const ERA_MARKER_DOTTED = '(?:[Aa]\\.[Dd]\\.?|[Bb]\\.[Cc]\\.[Ee]\\.?|[Bb]\\.[Cc]\\.?|[Cc]\\.[Ee]\\.?|[Aa]\\.[Hh]\\.?|[Bb]\\.[Pp]\\.?)';
const ERA_MARKER = '(?:' + ERA_MARKER_UPPER + '|' + ERA_MARKER_DOTTED + ')';
// Both orders take the same rules: the space between the year and the era
// marker is optional, the digits are not part of a larger number (no digit or
// decimal mark on the side away from the marker), and the era marker is a
// standalone token (no letter on its far side, so "ADELAIDE", "ADD", and
// "DEAD" never match). No 'i' flag, for ERA_MARKER_UPPER.
// "<year> <era>": "2898 AD".
const ERA_YEAR_AFTER_RE = new RegExp('(?<![\\d.])(?<year>\\d[\\d,]*)\\s*' + ERA_MARKER + '(?![A-Za-z])', 'gd');
// "<era> <year>": "AD 79".
const ERA_YEAR_BEFORE_RE = new RegExp('(?<![A-Za-z])' + ERA_MARKER + '\\s*(?<year>\\d[\\d,]*)(?![\\d,]*(?:\\d|\\.\\d))', 'gd');

/**
 * Return {start, end} ranges (offsets into `text`) of every digit run that
 * forms a calendar year bound to an era marker, in either order ("2898 AD" or
 * "AD 79").
 */
function getEraYearMaskedRanges(text) {
  return [ERA_YEAR_AFTER_RE, ERA_YEAR_BEFORE_RE].flatMap((re) => matchRanges(text, re, 'year'));
}
