// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Finding the numbers in a cell's text: the digit run, the unit number, the
 * exclusion, the masked ranges, the bracketed number, and the number span of
 * a pure cell. Reads no page and calls no Chrome.
 *
 * Loaded after lib/dr-number/reader.js, whose currency list, format marks,
 * and group shape build the patterns here at load time.
 */

// Whitespace between digit groups is a group mark only in the group shape
// (groupShapePattern, reader.js, which the number shape test reads too), and
// only when the whole chain of spaced groups fits it: "1 034 567" and
// "12 345" are one run each, while "2024 12", "2024 12 345", "416 555 1234"
// and "1 234 5678" stay several numbers side by side. The lookbehind and the
// lookahead reject a run with a digit across whitespace on either side, so a
// spaced run is the whole chain or nothing. A decimal part may follow the
// last group ("1 234 567.50").
const SPACED_DIGIT_RUN_PATTERN = '(?<!\\d' + GROUP_SPACE_PATTERN + ')' + groupShapePattern(GROUP_SPACE_PATTERN) +
  '(?!' + GROUP_SPACE_CLASS + '*\\d)(?:[.,]\\d+)?';
// The one copy of a number's digit run: the pattern that finds a number
// inside text and the unit-number pattern both read it, and the leading-zero
// identifier shape (identifiers.js) reads the in-text pattern to tell a group
// of a spaced number from a code.
//
// The spaced run comes first in the alternation, so the first group of a
// spaced run never matches as a plain run. The plain run takes every comma
// and dot between digits, so the number shape test in toNumber (reader.js)
// tests the whole run: "1.234,56" and "12.03.2024" read as no number and
// stay as written, where a run that stopped at the first dot would round
// "1.234". The run ends in a digit, because a comma or period after a
// number is sentence punctuation ("ref 12, total 9,850."). In the run, it
// would make "12," read as no number, and the patch for "9,850." would
// replace the period too.
const DIGIT_RUN_PATTERN = '(?:' + SPACED_DIGIT_RUN_PATTERN + '|\\d(?:[\\d.,]*\\d)?)';
// A number inside text starts at a clean boundary: the character before it
// is not a letter, digit, underscore, dot, comma, or "@".
//
// After "@", the digits belong to an at-name or an address ("@2020vision",
// "name@123.example"). After a letter, they belong to an identifier
// ("XR47182913MKB07", "Q3"), and a rounded identifier still looks valid, so
// the damage would go unseen. Every later digit of such a run follows a
// digit, so the whole run drops. After a dot or comma, the scan would
// re-enter a number it just rejected: "abc1,200" would match the "200".
//
// A hyphen after a digit ("2022-04", "555-1234", "10-20") is a separator,
// not a minus sign: the digits after it match on their own and stay
// positive. A minus sign after whitespace or punctuation ("down -1,200
// units") reads as a sign. "-?" takes an ASCII hyphen alone, so a
// hyphen range reads the same as an en-dash range ("₹615.71–623.33 crore").
const NUMBER_IN_TEXT_PATTERN = '(?<![\\w.,@])-?' + DIGIT_RUN_PATTERN;
const NUMBER_IN_TEXT_REGEX_GLOBAL = new RegExp(NUMBER_IN_TEXT_PATTERN, 'g');

// The magnitude suffixes that may follow a number. This is the one copy of
// that list: the docs point here instead of restating it.
const MAGNITUDE_SUFFIXES = ['bn', 'tn', 'k', 'm', 'b', 't'];
const CURRENCY_CODE_ALTERNATION = CURRENCY_CODES.join('|');
const CURRENCY_CODE_TOKEN = '(?<![A-Za-z])(?:' + CURRENCY_CODE_ALTERNATION + ')(?![A-Za-z])';
// Each suffix letter matches either case ("m", "M", "Bn", "TN").
const MAGNITUDE_SUFFIX_ALTERNATION = MAGNITUDE_SUFFIXES
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

function getExclusionReason(columnIndex, options, rowIndex) {
  if (!options.simplifyFirstRow && rowIndex === 0) return 'first-row';
  if (!options.simplifyFirstColumn && columnIndex === 0) return 'first-column';
  return null;
}

// The {start, end} range of each match of a global regex in the text, or,
// given a group name, of that named group (the regex then needs the d flag).
const matchRanges = (text, re, group) => (typeof text !== 'string' ? [] : Array.from(text.matchAll(re), (m) => {
  const [start, end] = group ? m.indices.groups[group] : [m.index, m.index + m[0].length];
  return { start, end };
}));

/**
 * Returns an array of {start, end} ranges for all balanced ASCII double-quoted spans
 * in the given string. Unbalanced quotes produce no range for the unpaired quote.
 */
function getQuoteMaskedRanges(text) {
  return matchRanges(text, /"[^"]*"/g);
}

function overlapsMaskedRange(maskedRanges, matchStart, matchEnd) {
  return maskedRanges.some((range) => matchStart < range.end && matchEnd > range.start);
}

// --- The bracketed number: "(1,234)" is -1,234 ---
// The brackets stand as the minus sign, so a match holds the digits alone
// and the brackets stay where the page put them. Format marks
// (FORMAT_MARK_ALTERNATION, reader.js) may stand between a bracket and the
// number: "($1,234)" and "(12.3%)" are bracketed numbers.
// The opening pattern is a lookbehind, tested at the number's start alone,
// because the regular expression engine, given the whole text before the
// number, starts a match at every opening bracket in that text: a cell of
// thousands of brackets then takes time that grows with the square of its
// length.
const BRACKET_OPEN_RE = new RegExp('(?<=(\\(' + FORMAT_MARK_ALTERNATION + '*))', 'y');
const BRACKET_CLOSE_RE = new RegExp('^' + FORMAT_MARK_ALTERNATION + '*\\)');
// A digit after the closing bracket, with at most one whitespace character
// or hyphen between, marks a phone number rather than an amount
// ("(416) 555-1234"), so the bracket pair is not a minus sign.
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
 */
function bracketSignSpan(text, index, numStr) {
  if (typeof text !== 'string' || typeof numStr !== 'string') return null;
  if (numStr.startsWith('-')) return null;
  BRACKET_OPEN_RE.lastIndex = index;
  const open = BRACKET_OPEN_RE.exec(text);
  if (!open) return null;
  const after = text.slice(index + numStr.length);
  const close = after.match(BRACKET_CLOSE_RE);
  if (!close) return null;
  if (DIGIT_AFTER_BRACKET_RE.test(after.slice(close[0].length))) return null;
  return { start: index - open[1].length, end: index + numStr.length + close[0].length };
}

/**
 * True when the number at [index, index + numStr.length) in `text` sits in a
 * bracket pair standing as its minus sign.
 */
function isBracketedNegative(text, index, numStr) {
  return bracketSignSpan(text, index, numStr) !== null;
}

function extractNumbersInText(text) {
  if (typeof text !== 'string') return [];
  const matches = [];
  for (const m of text.matchAll(NUMBER_IN_TEXT_REGEX_GLOBAL)) {
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
 */
function matchBracketedNumber(text) {
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
// opening bracket of a bracketed number. The trailing run: format
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
 * never starts with a minus sign (see formatNumber for why). index counts
 * into `text` as given, untrimmed.
 */
function pureNumberSpan(text) {
  const index = PURE_LEAD_RE.exec(text)[0].length;
  const rest = text.slice(index);
  const trail = PURE_TRAIL_RE.exec(rest)[0].length;
  return { numStr: rest.slice(0, rest.length - trail), index };
}

// A currency sign or code, or a percent sign, belongs to the number whose
// digits it touches: "$12,345", "12,345 USD", "5%". It touches when nothing
// stands between it and the digits but the marks a number carries: before
// the digits, the pure cell's leading run (format marks, a plus or minus
// sign, an opening bracket: "$-1,234", "$(1,234)"); after them, a magnitude
// suffix as a unit number carries it ("45.67 m CAD"), then the pure cell's
// trailing run ("(12.3)%"). A range of two numbers shares the sign on one of
// its ends, so the sign touches both, and the far end carries the same marks:
// "12–18%", "$12m–18m", "12 – $18", "(12) to (18)%". A sign elsewhere in the
// cell belongs to no number, so "Revenue (USD) 12,345" holds none.
const CURRENCY_TOKEN = '(?:' + CURRENCY_SIGN_ALTERNATION + '|' + CURRENCY_CODE_TOKEN + ')';
const SUFFIX_AFTER_DIGITS = '(?: ?(?:' + MAGNITUDE_SUFFIX_ALTERNATION + '))?';
// A number with the marks it carries on either side.
const MARKED_NUMBER = PURE_LEAD_PATTERN + DIGIT_RUN_PATTERN + SUFFIX_AFTER_DIGITS + PURE_TRAIL_PATTERN;
// The trailing and leading runs on either side already match whitespace, so
// the join holds none of its own. With a second place for the same whitespace,
// the regular expression engine tests every split of the run on a failed
// match, in time that grows with the cube of the run's length.
const RANGE_JOIN = '(?:-|' + DASH_CLASS + '|\\sto(?=\\s))';
// The sign before the digits: in the number's own leading run, or before the
// range's far end, or after it (that end's trailing run then holds the sign).
const signBeforeDigitsRe = (sign) => new RegExp(sign +
  '(?:(?:' + MARKED_NUMBER + '|' + PURE_TRAIL_PATTERN + ')' + RANGE_JOIN + ')?' + PURE_LEAD_PATTERN + '$');
// The sign after the digits: in the number's own trailing run, or after the
// range's far end, or before it (that end's leading run then holds the sign).
const signAfterDigitsRe = (sign) => new RegExp('^' + SUFFIX_AFTER_DIGITS + PURE_TRAIL_PATTERN +
  '(?:' + RANGE_JOIN + '(?:' + MARKED_NUMBER + '|' + PURE_LEAD_PATTERN + '))?' + sign);
const CURRENCY_BEFORE_RE = signBeforeDigitsRe(CURRENCY_TOKEN);
const CURRENCY_AFTER_RE = signAfterDigitsRe(CURRENCY_TOKEN);
const PERCENT_AFTER_RE = signAfterDigitsRe('%');
// A pure cell whose trailing run stops short of its end ("45%.", "1,234 kr.")
// holds its sign inside its number span, so a sign there touches too.
const CURRENCY_INSIDE_RE = new RegExp(CURRENCY_TOKEN);
// The most characters before a number that the sign check reads. A sign that
// touches a number sits across whitespace and marks, with at most the far end
// of a range between ("$12m – 18"), and 24 holds that in the ranges tables
// write. Reading the cell's whole prefix for each number took time that grows
// with the square of the cell's length. A sign farther back than the limit
// counts as touching nothing, so the number rounds.
const SIGN_LOOKBACK_CHARS = 24;

/**
 * True when a currency sign or code touches the number's digits and the
 * currency switch is off, or a percent sign touches them and the percent
 * switch is off. `match` is a number in the shape extractNumbersInText
 * returns, positioned in `text`.
 */
function touchesSwitchedOffSign(text, match, options) {
  const before = text.slice(Math.max(0, match.index - SIGN_LOOKBACK_CHARS), match.index);
  const after = text.slice(match.index + match.numStr.length);
  if (!options.simplifyMixedCurrency && (CURRENCY_BEFORE_RE.test(before) || CURRENCY_AFTER_RE.test(after) ||
    CURRENCY_INSIDE_RE.test(match.numStr))) return true;
  return !options.simplifyMixedPercent && (PERCENT_AFTER_RE.test(after) || match.numStr.includes('%'));
}
