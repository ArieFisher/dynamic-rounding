// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Finding the numbers in a cell's text: the digit run, the unit number, the
 * exclusion, the masked ranges, the bracketed number, and the number span of
 * a pure cell. Reads no page and calls no Chrome.
 *
 * Loaded after lib/dr-number/reader.js, whose currency list, format marks,
 * and group shape build the patterns here at load time.
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
// Rejecting the leading digit is enough to drop the whole run, because every
// later position inside it is itself preceded by a digit.
//
// Dot/comma: stops the scan re-entering a number it just rejected — without
// them "abc1,200" would skip "1,200" and then match the bare "200".
//
// The guard also determines when a leading "-" is a minus sign rather than a
// separator. In "2022-04", "555-1234" or "10-20" the hyphen follows a digit, so
// it is rejected as a sign; the digits after it still match on their own and
// stay positive. Genuine negatives ("down -1,200 units") are preceded by
// whitespace or punctuation and are unaffected. En-dash ranges
// ("₹615.71–623.33 crore") never reach this rule — "-?" matches an ASCII
// hyphen alone — so hyphen-typed ranges behave like en-dash ones.
//
// The run takes every comma and dot that sits between digits, so the number
// shape test in toNumber (reader.js) tests the whole run: "1.234,56" and
// "12.03.2024" come through whole and read as no number, and the text stays
// as written. A pattern that stopped at the first dot would take "1.234" and
// round it.
//
// The run ends in a digit: "\d(?:[\d.,]*\d)?" takes "1,200" whole but stops
// "12," at the "12" and "9,850." at the "9,850". A comma or period that ends
// a number is sentence punctuation ("ref 12, total 9,850."), and every later
// step searches the live text for the match string, so a trailing mark in it
// makes the placement step and the patch step miss a number that is right
// there.
//
// Whitespace between digit groups is a group mark only in the group shape
// (groupShapePattern, reader.js, the one copy the number shape test reads
// too), and only when the whole chain of spaced groups fits it: "1 034 567"
// is one run, and so is "12 345", while "2024 12", "2024 12 345",
// "416 555 1234" and "1 234 5678" stay several numbers, since a chain with a
// group outside the shape is numbers side by side. The lookbehind rejects a
// run that starts after a digit and whitespace, and the lookahead one that
// ends before whitespace and a digit, so a spaced run is the whole chain or
// nothing. A decimal part follows the last group ("1 234 567.50"). The
// spaced run comes first in the alternation, so the first group of a spaced
// run never matches as a plain run.
//
// DIGIT_RUN_PATTERN is the one copy of a number's digit run: the pattern
// that finds a number inside text and the unit-number pattern both read it,
// and the leading-zero identifier shape (identifiers.js) reads the in-text
// pattern to tell a group of a spaced number from a code.
const SPACED_DIGIT_RUN_PATTERN = '(?<!\\d' + GROUP_SPACE_PATTERN + ')' + groupShapePattern(GROUP_SPACE_PATTERN) +
  '(?!' + GROUP_SPACE_CLASS + '*\\d)(?:[.,]\\d+)?';
const DIGIT_RUN_PATTERN = '(?:' + SPACED_DIGIT_RUN_PATTERN + '|\\d(?:[\\d.,]*\\d)?)';
const NUMBER_IN_TEXT_PATTERN = '(?<![\\w.,@])-?' + DIGIT_RUN_PATTERN;
const NUMBER_IN_TEXT_REGEX_GLOBAL = new RegExp(NUMBER_IN_TEXT_PATTERN, 'g');

// The magnitude suffixes that may follow a number. This is the one copy of
// that list: the docs point here instead of restating it. A suffix counts
// in any case ("m", "M", "Bn", "TN"). The currency signs and codes come
// from CURRENCIES in reader.js, which every currency rule reads.
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
  if (!options.simplifyFirstRow && rowIndex === 0) return 'first-row';
  if (!options.simplifyFirstColumn && columnIndex === 0) return 'first-column';
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!options.simplifyMixedPercent && /%/.test(t)) return 'percent';
  if (!options.simplifyMixedCurrency &&
    (CURRENCY_SIGN_RE.test(t) || CURRENCY_CODE_TOKEN_RE.test(t))) return 'currency';
  return null;
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
 * Returns true if [matchStart, matchEnd) overlaps any masked range.
 * @param {{start: number, end: number}[]} maskedRanges
 * @param {number} matchStart
 * @param {number} matchEnd
 * @returns {boolean}
 */
function overlapsMaskedRange(maskedRanges, matchStart, matchEnd) {
  for (const range of maskedRanges) {
    if (matchStart < range.end && matchEnd > range.start) return true;
  }
  return false;
}

// --- The accounting minus sign: a bracket pair around a number ---
// A financial statement writes a negative as "(1,234)". The brackets are the
// minus sign, so the number's own text stays its digits: only the digits
// round, and the brackets stay where the page put them, as a currency sign
// does. FORMAT_MARK_ALTERNATION (reader.js) is the one list of what may stand
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

// A pure cell's leading run: format marks and sign characters, the ASCII
// plus and minus, the dash class toNumber reads as a minus sign, and the
// opening bracket of an accounting minus sign. The trailing run: format
// marks and the closing bracket. Both read the one format-mark list. The
// identifier check (identifiers.js) reads the same two runs to test whether
// a code fills its cell.
const PURE_LEAD_PATTERN = '(?:' + FORMAT_MARK_ALTERNATION + '|[+\\-(]|' + DASH_CLASS + ')*';
const PURE_TRAIL_PATTERN = '(?:' + FORMAT_MARK_ALTERNATION + '|\\))*';
const PURE_LEAD_RE = new RegExp('^' + PURE_LEAD_PATTERN);
const PURE_TRAIL_RE = new RegExp(PURE_TRAIL_PATTERN + '$');

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
