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

const NUMBER_IN_TEXT_REGEX = /-?\d[\d,]*(?:\.\d+)?/;
const NUMBER_IN_TEXT_REGEX_GLOBAL = /-?\d[\d,]*(?:\.\d+)?/g;

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

function getExclusionReason(text, columnIndex, options, rowIndex) {
  if (!options.simplifyFirstRow && rowIndex === 0) return 'firstRow';
  if (!options.simplifyFirstColumn && columnIndex === 0) return 'firstColumn';
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!options.simplifyMixedPercent && /%/.test(t)) return 'percent';
  if (!options.simplifyMixedCurrency && /[$€£¥₹]/.test(t)) return 'currency';
  return null;
}

const MONTH_NAMES = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

// Regex constants for date candidate normalization
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUPERSCRIPT_TAG = 'SUP';
const FOOTNOTE_MARKERS = '*†‡';
const DATE_NOISE_CLASS = `[\\s${SUPERSCRIPT_DIGITS}${FOOTNOTE_MARKERS}]`;
const LEADING_DATE_NOISE_RE = new RegExp(`^${DATE_NOISE_CLASS}+`);
const TRAILING_DATE_NOISE_RE = new RegExp(`${DATE_NOISE_CLASS}+$`);
const ORDINAL_SUFFIX_RE = /(\d+)(st|nd|rd|th)/gi;

// Map lowercase month abbreviation/name prefix → 1-based month number
const MONTH_NAME_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

/**
 * Resolve a matched month-name token (e.g. "June", "jun.", "Jul") to a 1-based month number.
 * Returns null if not recognised.
 */
function resolveMonthName(token) {
  const t = token.toLowerCase().replace(/[.\s]/g, '');
  // Try exact key first, then 3-letter prefix
  if (MONTH_NAME_MAP[t] !== undefined) return MONTH_NAME_MAP[t];
  const prefix3 = t.slice(0, 4); // "sept" is 4 chars
  if (MONTH_NAME_MAP[prefix3] !== undefined) return MONTH_NAME_MAP[prefix3];
  const prefix3s = t.slice(0, 3);
  if (MONTH_NAME_MAP[prefix3s] !== undefined) return MONTH_NAME_MAP[prefix3s];
  return null;
}

/**
 * Normalize a trimmed date candidate by stripping leading/trailing superscript digits,
 * footnote markers, and reducing ordinal suffixes (1st→1, 2nd→2, etc.) to bare numbers.
 * Collapses and trims whitespace at the end.
 */
function normalizeDateCandidate(text) {
  let s = text;
  // Strip leading/trailing superscript digits and footnote markers
  s = s.replace(LEADING_DATE_NOISE_RE, '').replace(TRAILING_DATE_NOISE_RE, '');
  // Replace ordinal suffixes: "1st" → "1", "21st" → "21", etc.
  s = s.replace(ORDINAL_SUFFIX_RE, '$1');
  // Collapse internal whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Parse an unambiguous date-like string into {year, month, day}.
 * Returns null for all-numeric N1/N2/Y or N1-N2-Y shapes (handled by parseAmbiguousNumericDate).
 * Supported shapes:
 *   ISO dash:      2020-07-21
 *   ISO slash:     2020/07/21
 *   Named-month:   June 21, 2020 / Jun 21, 2020 / 21 June 2020 / 2020 June 21 / Jun 2020
 *   Bare year:     2020
 * Adjacent non-date characters (trailing words, leading labels, footnote superscripts,
 * ordinal suffixes) are tolerated via normalizeDateCandidate + relaxed anchors.
 */
function parseDateLike(text) {
  if (typeof text !== 'string') return null;
  const t = normalizeDateCandidate(text.trim());

  // ISO dash: YYYY-MM-DD (must be 4-digit year first to avoid ambiguous N1-N2-Y)
  // Boundary-aware: allow surrounding non-word chars but not word chars
  const isoDash = t.match(/(?:^|(?<=[^\w]))(\d{4})-(\d{2})-(\d{2})(?=$|[^\w])/);
  if (isoDash) {
    return { year: parseInt(isoDash[1], 10), month: parseInt(isoDash[2], 10), day: parseInt(isoDash[3], 10), raw: isoDash[0] };
  }

  // ISO slash: YYYY/MM/DD
  const isoSlash = t.match(/(?:^|(?<=[^\w]))(\d{4})\/(\d{2})\/(\d{2})(?=$|[^\w])/);
  if (isoSlash) {
    return { year: parseInt(isoSlash[1], 10), month: parseInt(isoSlash[2], 10), day: parseInt(isoSlash[3], 10), raw: isoSlash[0] };
  }

  // Named-month forms (case-insensitive): Month DD, YYYY
  const mnRe = new RegExp(`(?:^|(?<=[^\\w]))(${MONTH_NAMES})\\s+(\\d{1,2}),?\\s+(\\d{4})(?=$|[^\\w])`, 'i');
  const mnMatch = t.match(mnRe);
  if (mnMatch) {
    const month = resolveMonthName(mnMatch[1]);
    if (month !== null) return { year: parseInt(mnMatch[3], 10), month, day: parseInt(mnMatch[2], 10), raw: mnMatch[0] };
  }

  // Day Month Year: 21 June 2020
  const dmyRe = new RegExp(`(?:^|(?<=[^\\w]))(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})(?=$|[^\\w])`, 'i');
  const dmyMatch = t.match(dmyRe);
  if (dmyMatch) {
    const month = resolveMonthName(dmyMatch[2]);
    if (month !== null) return { year: parseInt(dmyMatch[3], 10), month, day: parseInt(dmyMatch[1], 10), raw: dmyMatch[0] };
  }

  // Year Month Day: 2020 June 21
  const ymdRe = new RegExp(`(?:^|(?<=[^\\w]))(\\d{4})\\s+(${MONTH_NAMES})\\s+(\\d{1,2})(?=$|[^\\w])`, 'i');
  const ymdMatch = t.match(ymdRe);
  if (ymdMatch) {
    const month = resolveMonthName(ymdMatch[2]);
    if (month !== null) return { year: parseInt(ymdMatch[1], 10), month, day: parseInt(ymdMatch[3], 10), raw: ymdMatch[0] };
  }

  // Month Year: Jun 2020
  const myRe = new RegExp(`(?:^|(?<=[^\\w]))(${MONTH_NAMES})\\s+(\\d{4})(?=$|[^\\w])`, 'i');
  const myMatch = t.match(myRe);
  if (myMatch) {
    const month = resolveMonthName(myMatch[1]);
    if (month !== null) return { year: parseInt(myMatch[2], 10), month, day: 1, raw: myMatch[0] };
  }

  // Bare year: 2020 (1900–2099) — STRICT anchors preserved to avoid false positives
  // "Sales: 2020", "$2,020.00", "version 2020.1.3" must all return false
  const bareYear = t.match(/^(\d{4})$/);
  if (bareYear) {
    const y = parseInt(bareYear[1], 10);
    if (y >= 1900 && y <= 2099) return { year: y, month: 1, day: 1, raw: bareYear[0] };
  }

  return null;
}

/**
 * Parse an all-numeric ambiguous date: N1/N2/Y or N1-N2-Y.
 * Supports 4-digit and 2-digit years. 2-digit-year pivot: yy < 50 → 2000+yy, else 1900+yy.
 * Adjacent non-date characters are tolerated via normalizeDateCandidate + relaxed anchors.
 * Returns {n1, n2, year} or null.
 */
function parseAmbiguousNumericDate(text) {
  if (typeof text !== 'string') return null;
  const t = normalizeDateCandidate(text.trim());
  // N1/N2/Y or N1-N2-Y (but not YYYY-MM-DD or YYYY/MM/DD which are unambiguous)
  // Boundary-aware: allow surrounding non-word chars but not word chars
  const m = t.match(/(?:^|(?<=[^\w]))(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?=$|[^\w])/);
  if (!m) return null;
  const n1 = parseInt(m[1], 10);
  const n2 = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (m[3].length === 2) {
    year = year < 50 ? 2000 + year : 1900 + year;
  }
  return { n1, n2, year };
}

function isDateLike(text) {
  return parseDateLike(text) !== null || parseAmbiguousNumericDate(text) !== null;
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
 * Round a date cell to the requested granularity and return a year-only string.
 *
 * @param {string} text          - Original cell text.
 * @param {string} granularity   - 'year' | 'decade' | 'century'.
 * @param {{month: number, day: number, year: number}} [prefilled]
 *   Pre-resolved date from the classification pass. If omitted, parseDateLike is called.
 * @returns {string} Always returns a string (the rounded year as digits).
 */
function roundDateText(text, granularity, prefilled) {
  const parsed = parseDateLike(text);
  const date = parsed || prefilled;
  if (!date) return text; // fallback: shouldn't happen for mode:'date' cells

  const { year, month } = date;

  // fractional = year + 0.5 if month >= 7, else year + 0
  const fractional = year + (month >= 7 ? 0.5 : 0);

  let roundedYear;
  if (granularity === 'decade') {
    roundedYear = Math.round(fractional / 10) * 10;
  } else if (granularity === 'century') {
    roundedYear = Math.round(fractional / 100) * 100;
  } else {
    // 'year' or default
    roundedYear = Math.round(fractional);
  }

  const roundedYearStr = String(new Date(roundedYear, 0, 1).getFullYear());

  // When the cell has surrounding text (e.g. "Payment Disbursed on: 2025-04-02"),
  // replace only the matched date portion rather than the entire cell value.
  if (parsed && parsed.raw) {
    const rawIdx = text.indexOf(parsed.raw);
    if (rawIdx >= 0) {
      return text.slice(0, rawIdx) + roundedYearStr + text.slice(rawIdx + parsed.raw.length);
    }
  }
  return roundedYearStr;
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

function extractNumberInText(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(NUMBER_IN_TEXT_REGEX);
  if (!match) return null;
  const numStr = match[0];
  const num = toNumber(numStr);
  if (num === null || num === 0) return null;
  return { numStr, num, index: match.index };
}

function extractNumbersInText(text) {
  if (typeof text !== 'string') return [];
  const matches = [];
  const re = new RegExp(NUMBER_IN_TEXT_REGEX_GLOBAL.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = toNumber(m[0]);
    if (num !== null && num !== 0) {
      matches.push({ numStr: m[0], num, index: m.index });
    }
  }
  return matches;
}

// --- Era-marked calendar years (e.g. "2898 AD", "500 BC", "AD 79", "1200 CE") ---
// A number bound to an era marker is a calendar year — a date — so it must be
// rounded by date logic (decade/century), never by the numeric offset. These
// helpers locate such year tokens so they can be excluded from numeric magnitude
// detection, numeric rounding, and the sidebar preview examples (issue #4).
const ERA_MARKER = '(?:A\\.?D\\.?|B\\.?C\\.?E\\.?|B\\.?C\\.?|C\\.?E\\.?|A\\.?H\\.?|B\\.?P\\.?)';
// "<year> <era>": the digits are not part of a larger number (no leading digit
// or decimal point) and the era marker is a standalone token (not followed by a
// letter, so "ADELAIDE" / "ADD" never match).
const ERA_YEAR_AFTER_RE = new RegExp('(?<![\\d.])(\\d[\\d,]*)\\s*' + ERA_MARKER + '(?![A-Za-z])', 'gi');
// "<era> <year>": e.g. "AD 79". Era marker preceded by a non-letter boundary.
const ERA_YEAR_BEFORE_RE = new RegExp('(?<![A-Za-z])' + ERA_MARKER + '\\s+(\\d[\\d,]*)', 'gi');

/**
 * Return {start, end} ranges (offsets into `text`) of every digit run that
 * forms a calendar year bound to an era marker, in either order ("2898 AD" or
 * "AD 79").
 */
function eraYearDigitRanges(text) {
  if (typeof text !== 'string') return [];
  const ranges = [];
  let m;
  const after = new RegExp(ERA_YEAR_AFTER_RE.source, 'gi');
  while ((m = after.exec(text)) !== null) {
    const start = m.index + m[0].indexOf(m[1]);
    ranges.push({ start, end: start + m[1].length });
  }
  const before = new RegExp(ERA_YEAR_BEFORE_RE.source, 'gi');
  while ((m = before.exec(text)) !== null) {
    const start = m.index + m[0].lastIndexOf(m[1]);
    ranges.push({ start, end: start + m[1].length });
  }
  return ranges;
}

/**
 * True if the number occurrence [index, index + numStr.length) in `text` is a
 * calendar year bound to an era marker (and therefore a date, not a numeric
 * value to be offset-rounded).
 */
function isEraYear(text, index, numStr) {
  if (typeof text !== 'string' || typeof numStr !== 'string') return false;
  const end = index + numStr.length;
  for (const r of eraYearDigitRanges(text)) {
    if (index < r.end && end > r.start) return true;
  }
  return false;
}

/**
 * Returns the number of fractional digits in n's string representation.
 * Sign is stripped before counting. null/undefined/NaN all return 0.
 * Examples: decimalCount(0.5) → 1, decimalCount(-0.25) → 2, decimalCount(1) → 0.
 */
function decimalCount(n) {
  if (n === null || n === undefined || (typeof n === 'number' && isNaN(n))) return 0;
  const s = String(Math.abs(n));
  const dot = s.indexOf('.');
  if (dot === -1) return 0;
  return s.length - dot - 1;
}

/**
 * Format a rounded number extracted from inline text for display.
 *
 * Band rule for minimumFractionDigits:
 *   |rounded| < 10  → use Math.max(decimals, floorDecimals)
 *     The <10 band covers small values such as percentages/fractions where
 *     the offset's own decimal precision is meaningful to the reader.
 *   |rounded| >= 10 → zero decimals (existing short-circuit unchanged).
 *     Large magnitudes are already rounded to integer multiples of a coarse
 *     base, so decimal places would be spurious.
 *
 * @param {number} rounded       - The rounded numeric value.
 * @param {string} originalNumStr - The original number string (for comma/decimal detection).
 * @param {number} [floorDecimals=0] - Minimum decimal places from the offset's own precision.
 */
function formatExtractedNumber(rounded, originalNumStr, floorDecimals = 0) {
  const hasCommas = originalNumStr.includes(',');
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
    useGrouping: hasCommas
  });
}

/**
 * Restore the formatting of a pure-numeric cell after rounding.
 *
 * Band rule for minimumFractionDigits (mirrors formatExtractedNumber):
 *   |roundedValue| < 10  → use Math.max(decimals, floorDecimals)
 *   |roundedValue| >= 10 → zero decimals (short-circuit, unchanged)
 *
 * @param {number} roundedValue   - The rounded numeric value.
 * @param {string} originalString - Original cell text (for symbol/format detection).
 * @param {number} [floorDecimals=0] - Minimum decimal places from the offset's precision.
 */
function restoreFormatting(roundedValue, originalString, floorDecimals = 0) {
  let result;
  const originalTrimmed = originalString.trim();

  result = roundedValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10
  });

  // Handle percent
  if (originalTrimmed.includes('%')) {
    result += '%';
  }

  // Handle plus
  if (originalTrimmed.includes('+') && roundedValue > 0) {
    result = '+' + result;
  }

  // Handle currency
  if (originalTrimmed.includes('$')) {
    result = '$' + result;
  } else if (originalTrimmed.includes('€')) {
    result = '€' + result;
  } else if (originalTrimmed.includes('£')) {
    result = '£' + result;
  } else if (originalTrimmed.includes('¥')) {
    result = '¥' + result;
  }

  // Handle parens
  if (roundedValue < 0 && /^\(.*?\)$/.test(originalTrimmed)) {
    result = '(' + result.replace('-', '') + ')';
  }
  
  return result;
}
