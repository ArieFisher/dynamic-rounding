/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Pure parsing/formatting helpers (no chrome.*, no DOM mutation).
 *
 * Loaded by manifest content_scripts AFTER core.js and BEFORE the DOM/UI
 * modules. Covers range-expression parsing, date/time detection + rounding,
 * in-text number extraction, and pure-numeric formatting. All symbols land on
 * the shared global scope consumed by content.js.
 */

// A digit run only counts as a quantity when it starts at a clean boundary: the
// preceding character must not be a letter, digit, dot, comma, or "@".
//
// "@": a number right after it belongs to an at-name or an address
// ("@2020vision", "name@123.example"), not a quantity.
//
// Letters: digits welded to letters belong to an identifier, not a measurement
// ("XR47182913MKB07", "MKB07", "Q3"). Mining them produces a rounded value that
// still looks like a valid identifier, so the corruption is undetectable.
// Refusing the leading digit is enough to drop the whole run, because every
// later position inside it is itself preceded by a digit.
//
// Dot/comma: stops the scan re-entering a number it just refused — without
// them "abc1,200" would skip "1,200" and then match the bare "200".
//
// The guard also decides when a leading "-" is a minus sign rather than a
// separator. In "2022-04", "555-1234" or "10-20" the hyphen follows a digit, so
// it is rejected as a sign; the digits after it still match on their own and
// stay positive. Genuine negatives ("down -1,200 units") are preceded by
// whitespace or punctuation and are unaffected. Note that en-dash ranges
// ("₹615.71–623.33 crore") never relied on this — "-?" only ever matched an
// ASCII hyphen — so hyphen-typed ranges now behave like en-dash ones.
//
// The run takes every comma and dot that sits between digits, so the number
// shape test in toNumber (core.js) judges the whole run: "1.234,56" and
// "12.03.2024" come through whole and read as no number, and the text stays
// as written. A pattern that stopped at the first dot would take "1.234" and
// round it.
//
// The run ends in a digit: "\d(?:[\d.,]*\d)?" takes "1,200" whole but stops
// "12," at the "12" and "9,850." at the "9,850". A comma or period that ends
// a number is sentence punctuation ("ref 12, total 9,850."), and every later
// step searches the live text for the match string, so a trailing mark in it
// makes the link filter and the patch step miss a number that is right there.
//
// DIGIT_RUN_PATTERN is the one copy of a number's digit run: the pattern
// that finds a number inside text and the unit-number pattern both read it.
const DIGIT_RUN_PATTERN = '\\d(?:[\\d.,]*\\d)?';
const NUMBER_IN_TEXT_PATTERN = '(?<![\\w.,@])-?' + DIGIT_RUN_PATTERN;
const NUMBER_IN_TEXT_REGEX = new RegExp(NUMBER_IN_TEXT_PATTERN);
const NUMBER_IN_TEXT_REGEX_GLOBAL = new RegExp(NUMBER_IN_TEXT_PATTERN, 'g');

function lettersToColIndex(letters) {
  const up = letters.toUpperCase();
  let n = 0;
  for (let i = 0; i < up.length; i++) {
    const code = up.charCodeAt(i);
    if (code < 65 || code > 90) return null;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseRangeEndpoint(token) {
  const m = token.trim().match(/^([A-Za-z]+)?(\d+)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const col = m[1] ? lettersToColIndex(m[1]) : null;
  if (m[1] && col === null) return null;
  const row = m[2] ? parseInt(m[2], 10) - 1 : null;
  if (m[2] && (row < 0 || !isFinite(row))) return null;
  return { col, row };
}

function parseRangeToken(token) {
  const t = token.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const parts = t.split(':');
    if (parts.length !== 2) return null;
    const l = parseRangeEndpoint(parts[0]);
    const r = parseRangeEndpoint(parts[1]);
    if (!l || !r) return null;
    // Open-ended semantics: left-null = unbounded below (0), right-null = unbounded above (Infinity).
    const lcol = l.col === null ? 0 : l.col;
    const rcol = r.col === null ? Infinity : r.col;
    const lrow = l.row === null ? 0 : l.row;
    const rrow = r.row === null ? Infinity : r.row;
    return {
      colMin: Math.min(lcol, rcol),
      colMax: Math.max(lcol, rcol),
      rowMin: Math.min(lrow, rrow),
      rowMax: Math.max(lrow, rrow)
    };
  }
  const e = parseRangeEndpoint(t);
  if (!e) return null;
  return {
    colMin: e.col ?? 0,
    colMax: e.col ?? Infinity,
    rowMin: e.row ?? 0,
    rowMax: e.row ?? Infinity
  };
}

function parseRangeExpr(expr) {
  if (typeof expr !== 'string') return { ranges: null };
  const trimmed = expr.trim();
  if (!trimmed) return { ranges: null }; // null = whole table
  const stripped = trimmed.replace(/^\{/, '').replace(/\}$/, '');
  const tokens = stripped.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { ranges: null };
  const ranges = [];
  for (const tok of tokens) {
    const r = parseRangeToken(tok);
    if (!r) return { error: `Invalid range: "${tok}"` };
    ranges.push(r);
  }
  return { ranges };
}

function isInRanges(r, c, ranges) {
  if (!ranges) return true;
  for (const range of ranges) {
    if (r >= range.rowMin && r <= range.rowMax &&
        c >= range.colMin && c <= range.colMax) {
      return true;
    }
  }
  return false;
}

function resolveOffset(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(num)) return fallback;
  if (num < -VALIDATION_LIMIT || num > VALIDATION_LIMIT) return fallback;
  return num;
}

function resolveNumTop(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  if (!isFinite(num) || num < 1) return fallback;
  return Math.floor(num);
}

// The magnitude suffixes that may follow a number. This is the one copy of
// that list: the docs point here instead of restating it. A suffix counts
// in any case ("m", "M", "Bn", "TN"). The currency signs and codes come
// from CURRENCIES in core.js, which every currency rule reads.
const MAGNITUDE_SUFFIXES = ['bn', 'tn', 'k', 'm', 'b', 't'];
const CURRENCY_CODE_ALTERNATION = CURRENCY_CODES.join('|');
const CURRENCY_CODE_TOKEN_RE = new RegExp('(?<![A-Za-z])(?:' + CURRENCY_CODE_ALTERNATION + ')(?![A-Za-z])');
// Each suffix letter matches either case; longer suffixes come first so
// "bn" wins over "b".
const MAGNITUDE_SUFFIX_ALTERNATION = MAGNITUDE_SUFFIXES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((suffix) => suffix.split('').map((ch) => '[' + ch.toLowerCase() + ch.toUpperCase() + ']').join(''))
  .join('|');
// A whole trimmed text of: an optional prefix (a code with a symbol on
// either side or none, then one optional space; or a symbol alone), the
// number, an optional suffix after one optional space, and an optional code
// after one optional space. matchUnitNumber adds the two rules a regular
// expression states badly: a code on one side only, and a code or a suffix
// present.
const SIGN_GROUP = '(?:' + CURRENCY_SIGN_ALTERNATION + ')';
const UNIT_NUMBER_RE = new RegExp(
  '^(?<pre>' + SIGN_GROUP + '?(?<codeBefore>' + CURRENCY_CODE_ALTERNATION + ')' +
    SIGN_GROUP + '? ?|' + SIGN_GROUP + ')?' +
  '(?<num>-?' + DIGIT_RUN_PATTERN + ')' +
  '(?: ?(?<suffix>' + MAGNITUDE_SUFFIX_ALTERNATION + '))?' +
  '(?: ?(?<codeAfter>' + CURRENCY_CODE_ALTERNATION + '))?$'
);

/**
 * Match a unit number: a text that is one number with a magnitude suffix
 * after it, a listed currency code before or after it, or both ("4.91tn",
 * "CAD$45.67", "1,234 USD", "CAD45.67m"). Returns the number's digits, value,
 * and position in `text` as given, the same shape as extractNumbersInText's
 * matches, or null. An identifier such as "DT1234" is not a unit number,
 * because its letters are neither a listed code nor a suffix.
 * @param {string} text
 * @returns {{numStr: string, num: number, index: number}|null}
 */
function matchUnitNumber(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const m = UNIT_NUMBER_RE.exec(trimmed);
  if (!m) return null;
  const { pre, codeBefore, num: numStr, suffix, codeAfter } = m.groups;
  if (codeBefore && codeAfter) return null;
  if (!codeBefore && !codeAfter && !suffix) return null;
  const num = toNumber(numStr);
  if (num === null || num === 0) return null;
  const lead = text.length - text.trimStart().length;
  return { numStr, num, index: lead + (pre || '').length };
}

function getExclusionReason(text, columnIndex, options, rowIndex) {
  if (!options.simplifyFirstRow && rowIndex === 0) return 'firstRow';
  if (!options.simplifyFirstColumn && columnIndex === 0) return 'firstColumn';
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!options.simplifyMixedPercent && /%/.test(t)) return 'percent';
  if (!options.simplifyMixedCurrency &&
    (CURRENCY_SIGN_RE.test(t) || CURRENCY_CODE_TOKEN_RE.test(t))) return 'currency';
  return null;
}

// A month name: the full name, its three-letter short form, or "Sept", with
// an optional dot. A word that only starts like a month ("market") is not one.
const MONTH_NAMES = '(?:january|february|march|april|may|june|july|august|september|october|november|december' +
  '|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?';

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

// One date with a known reading: its bounds in the text, its year, and the
// span the month granularity removes (null when the date holds no day).
const datePart = (m, year, dayCut) => (
  { year: parseInt(year, 10), start: m.index, end: m.index + m[0].length, dayCut });

// The date shapes findDates reads; on two matches at the same position the
// earlier shape wins. Each regex carries the d flag, so a match holds its
// groups' positions. `read` returns the date, or null for a date that cannot
// exist (month 13, day 45). A dayCut is the day with its ordinal suffix and
// the one separator between it and the rest of the date.
const DATE_SHAPES = [
  { // ISO dash: 2020-07-21 → cut "-21"
    re: new RegExp(`${DATE_START}${YEAR}-${MONTH_NUM}-${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isMonth(m[2]) && isDay(m[3])
      ? datePart(m, m[1], { start: m.indices[2][1], end: m.indices[0][1] }) : null),
  },
  { // ISO slash: 2020/07/21 → cut "/21"
    re: new RegExp(`${DATE_START}${YEAR}\\/${MONTH_NUM}\\/${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isMonth(m[2]) && isDay(m[3])
      ? datePart(m, m[1], { start: m.indices[2][1], end: m.indices[0][1] }) : null),
  },
  { // Month DD, YYYY: June 21, 2020 → cut "21, "
    re: new RegExp(`${DATE_START}(${MONTH_NAMES})\\s+${DAY},?\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m[2])
      ? datePart(m, m[3], { start: m.indices[2][0], end: m.indices[3][0] }) : null),
  },
  { // DD Month YYYY: 21 June 2020 → cut "21 "
    re: new RegExp(`${DATE_START}${DAY}\\s+(${MONTH_NAMES})\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m[1])
      ? datePart(m, m[3], { start: m.indices[1][0], end: m.indices[2][0] }) : null),
  },
  { // YYYY Month DD: 2020 June 21 → cut " 21"
    re: new RegExp(`${DATE_START}${YEAR}\\s+(${MONTH_NAMES})\\s+${DAY}${DATE_END}`, 'gid'),
    read: (m) => (isDay(m[3])
      ? datePart(m, m[1], { start: m.indices[2][1], end: m.indices[0][1] }) : null),
  },
  { // Month YYYY: Jun 2020
    re: new RegExp(`${DATE_START}(${MONTH_NAMES})\\s+${YEAR}${DATE_END}`, 'gid'),
    read: (m) => datePart(m, m[2], null),
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
 *   - a date with a known reading: { year, start, end, dayCut }
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
      return [{ year: y, start: bare.indices[1][0], end: bare.indices[1][1], dayCut: null }];
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

function isTimeLike(text) {
  // HH:MM or HH:MM:SS, optional AM/PM
  return /^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i.test(text);
}

/**
 * Parse an ISO 8601 date-time string into its wall-clock components.
 * Accepts "YYYY-MM-DDTHH:MM[:SS[.fff]][Z|±HH[:]MM]"; the date/time separator
 * may be "T" or a single space. Seconds, fractional seconds, and the timezone
 * offset are recognised but discarded — simplification keeps only the
 * wall-clock date plus HH:MM.
 * @returns {{year:number, month:number, day:number, hour:number, minute:number}|null}
 */
function parseISODateTime(text) {
  if (typeof text !== 'string') return null;
  const m = text.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
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
 *   'year'    → the year: 2096.
 *   'decade'  → the first year of its decade: 2090.
 *   'century' → the first year of its century: 2000.
 *
 * @param {string} text          - The cell's trimmed text.
 * @param {string} granularity   - 'month' | 'year' | 'decade' | 'century'.
 * @param {{year:number, start:number, end:number, dayCut:{start:number,end:number}|null}[]} [dates]
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
    } else {
      out = out.slice(0, d.start) + String(Math.floor(d.year / step) * step) + out.slice(d.end);
    }
  }
  return out;
}

/**
 * Simplify an already-parsed ISO 8601 date-time per the time granularity,
 * preserving the date. Returns "YYYY-MM-DD HH:MM" ('minute') or the hour-rounded
 * "YYYY-MM-DD HH:00" ('hour', round-half-up). The date is never changed: when
 * rounding up the final hour would cross midnight, the time is clamped to 23:59
 * on the same day instead of rolling into the next day.
 * The original seconds, milliseconds, and timezone offset are dropped.
 */
function roundISODateTime(dt, granularity) {
  let { year, month, day, hour, minute } = dt;
  if (granularity === 'hour') {
    if (minute >= 30) {
      if (hour === 23) {
        // Rounding up would advance the date; clamp to the last minute of the
        // same day instead.
        minute = 59;
      } else {
        hour += 1;
        minute = 0;
      }
    } else {
      minute = 0;
    }
  }
  const pad = n => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function roundTimeText(text, granularity) {
  if (typeof text !== 'string') return null;

  // ISO 8601 date-time cells follow the time instruction but keep their date.
  // Unlike a bare clock time, 'minute' granularity is not a no-op here: it still
  // normalises the cell to "YYYY-MM-DD HH:MM" (dropping seconds/ms/offset).
  const dt = parseISODateTime(text);
  if (dt) return roundISODateTime(dt, granularity);

  if (granularity === 'minute' || !granularity) return null;
  if (granularity !== 'hour') return null;
  const trimmed = text.trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[ap]\.?m\.?)?$/i);
  if (!m) return null;
  const origHourStr = m[1];
  const origHour = parseInt(origHourStr, 10);
  const minutes = parseInt(m[2], 10);
  const seconds = m[3] ? parseInt(m[3], 10) : 0;
  const ampmRaw = m[4] || '';
  const has12HourSuffix = ampmRaw !== '';
  const isPm = has12HourSuffix && /p/i.test(ampmRaw);

  // Round up if at or past the half-hour mark.
  const roundUp = minutes > 30 || (minutes === 30 && seconds >= 0) || (minutes === 29 && seconds >= 30);

  let hour24;
  if (has12HourSuffix) {
    // 12-hour clock: 12 AM = 0, 1-11 AM = 1-11, 12 PM = 12, 1-11 PM = 13-23.
    hour24 = (origHour % 12) + (isPm ? 12 : 0);
  } else {
    hour24 = origHour;
  }
  if (roundUp) hour24 = (hour24 + 1) % 24;
  else hour24 = hour24 % 24;

  let displayHour;
  let displayAmpm = '';
  if (has12HourSuffix) {
    const newIsPm = hour24 >= 12;
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    displayHour = String(h12);
    // Preserve the original AM/PM token style ("AM", "am", "a.m.", " PM", etc.)
    // by swapping the a/p letter but keeping the rest of the original suffix.
    displayAmpm = newIsPm ? ampmRaw.replace(/a/i, c => c === 'A' ? 'P' : 'p')
                          : ampmRaw.replace(/p/i, c => c === 'P' ? 'A' : 'a');
  } else {
    displayHour = origHourStr.length === 2
      ? String(hour24).padStart(2, '0')
      : String(hour24);
  }

  let result = `${displayHour}:00`;
  if (m[3]) result += ':00';
  result += displayAmpm;
  return result === trimmed ? null : result;
}

/**
 * Returns an array of {start, end} ranges for all balanced ASCII double-quoted spans
 * in the given string. Unbalanced quotes produce no range for the unpaired quote.
 * @param {string} text
 * @returns {{start: number, end: number}[]}
 */
function getQuoteMaskedRanges(text) {
  if (typeof text !== 'string') return [];
  const ranges = [];
  const re = /"([^"]*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

/**
 * Returns true if [matchStart, matchEnd) overlaps any range in maskedRanges.
 * @param {{start: number, end: number}[]} maskedRanges
 * @param {number} matchStart
 * @param {number} matchEnd
 * @returns {boolean}
 */
function overlapsQuoteRange(maskedRanges, matchStart, matchEnd) {
  for (const range of maskedRanges) {
    if (matchStart < range.end && matchEnd > range.start) return true;
  }
  return false;
}

// --- The accounting minus sign: a bracket pair around a number ---
// A financial statement writes a negative as "(1,234)". The brackets are the
// minus sign, so the number's own text stays its digits: only the digits
// round, and the brackets stay where the page put them, as a currency sign
// does. FORMAT_MARK_ALTERNATION (core.js) is the one list of what may stand
// between a bracket and the number — a currency sign, a percent sign,
// whitespace — so "$(1,234)", "($1,234)" and "(12.3%)" all read as negatives
// while "(see note 4)" does not.
const BRACKET_OPEN_RE = new RegExp('\\(' + FORMAT_MARK_ALTERNATION + '*$');
const BRACKET_CLOSE_RE = new RegExp('^' + FORMAT_MARK_ALTERNATION + '*\\)');
// A digit right after the closing bracket, with at most one space or hyphen
// between, marks a telephone number rather than an amount ("(416) 555-1234").
// Such a bracket pair is not a minus sign.
const DIGIT_AFTER_BRACKET_RE = /^[\s-]?\d/;
// A whole text made of format marks alone, or empty.
const FORMAT_MARKS_ONLY_RE = new RegExp('^' + FORMAT_MARK_ALTERNATION + '*$');

/**
 * The span of the bracket pair standing as the minus sign of the number at
 * [index, index + numStr.length) in `text`, as {start, end} offsets covering
 * the brackets themselves, or null when the number carries no such pair. The
 * pair must hold nothing but that number and its own format marks. A number
 * that already carries a written minus sign never takes one, so "(-1,234)" is
 * read once rather than twice.
 * @param {string} text
 * @param {number} index
 * @param {string} numStr
 * @returns {{start: number, end: number}|null}
 */
function bracketSignSpan(text, index, numStr) {
  if (typeof text !== 'string' || typeof numStr !== 'string') return null;
  if (numStr.startsWith('-')) return null;
  const open = text.slice(0, index).match(BRACKET_OPEN_RE);
  if (!open) return null;
  const after = text.slice(index + numStr.length);
  const close = after.match(BRACKET_CLOSE_RE);
  if (!close) return null;
  if (DIGIT_AFTER_BRACKET_RE.test(after.slice(close[0].length))) return null;
  return { start: index - open[0].length, end: index + numStr.length + close[0].length };
}

/**
 * True when the number at [index, index + numStr.length) in `text` sits in a
 * bracket pair standing as its minus sign.
 * @param {string} text
 * @param {number} index
 * @param {string} numStr
 * @returns {boolean}
 */
function isBracketedNegative(text, index, numStr) {
  return bracketSignSpan(text, index, numStr) !== null;
}

function extractNumberInText(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(NUMBER_IN_TEXT_REGEX);
  if (!match) return null;
  const numStr = match[0];
  const num = toNumber(numStr);
  if (num === null || num === 0) return null;
  const signed = isBracketedNegative(text, match.index, numStr) ? -num : num;
  return { numStr, num: signed, index: match.index };
}

function extractNumbersInText(text) {
  if (typeof text !== 'string') return [];
  const matches = [];
  const re = new RegExp(NUMBER_IN_TEXT_REGEX_GLOBAL.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = toNumber(m[0]);
    if (num !== null && num !== 0) {
      const signed = isBracketedNegative(text, m.index, m[0]) ? -num : num;
      matches.push({ numStr: m[0], num: signed, index: m.index });
    }
  }
  return matches;
}

/**
 * Match a whole text that is one number wrapped in a bracket pair standing as
 * its minus sign ("(1,234)", "$(1,234)", "(12.3%)"). Returns that number as a
 * match in the same shape as extractNumbersInText's, its value negative and
 * its numStr the digits alone, or null. The text must hold exactly one
 * number, and nothing but format marks may stand outside the bracket pair, so
 * "(see note 4)", "(1,234) (5,678)" and "USD (1,234)" are not matches.
 * @param {string} text
 * @returns {{numStr: string, num: number, index: number}|null}
 */
function matchBracketedNumber(text) {
  if (typeof text !== 'string') return null;
  const matches = extractNumbersInText(text);
  if (matches.length !== 1) return null;
  const match = matches[0];
  const span = bracketSignSpan(text, match.index, match.numStr);
  if (!span) return null;
  if (!FORMAT_MARKS_ONLY_RE.test(text.slice(0, span.start))) return null;
  if (!FORMAT_MARKS_ONLY_RE.test(text.slice(span.end))) return null;
  return match;
}

// --- Era-marked calendar years (e.g. "2898 AD", "500 BC", "AD 79", "1200 CE") ---
// A number bound to an era marker is a calendar year — a date — so it must be
// rounded by date logic (decade/century), never by the numeric offset. These
// helpers locate such year tokens so they can be excluded from numeric magnitude
// detection, numeric rounding, and the sidebar preview examples (issue #4).
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
 * written with the marks the number format function (core.js) returns.
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

// A pure cell's leading run: format marks and sign characters, the ASCII
// plus and minus, the dash class toNumber reads as a minus sign, and the
// opening bracket of an accounting minus sign. The trailing run: format
// marks and the closing bracket. Both read the one format-mark list.
const PURE_LEAD_RE = new RegExp('^(?:' + FORMAT_MARK_ALTERNATION + '|[+\\-(]|' + DASH_CLASS + ')*');
const PURE_TRAIL_RE = new RegExp('(?:' + FORMAT_MARK_ALTERNATION + '|\\))*$');

/**
 * The number span of a pure cell: its text with the leading run of format
 * marks and sign characters and the trailing run of format marks left out.
 * The write-back patches this span alone, so a sign, a currency sign and its
 * gap, a percent sign, and a plus stay where the page put them. The span
 * never starts with a minus sign, so the write-back writes the absolute
 * value and the kept sign carries the negative. index counts into `text` as
 * given, untrimmed.
 * @param {string} text
 * @returns {{numStr: string, index: number}}
 */
function pureNumberSpan(text) {
  const index = PURE_LEAD_RE.exec(text)[0].length;
  const rest = text.slice(index);
  const trail = PURE_TRAIL_RE.exec(rest)[0].length;
  return { numStr: rest.slice(0, rest.length - trail), index };
}
