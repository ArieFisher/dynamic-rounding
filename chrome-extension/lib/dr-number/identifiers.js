/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Identifier shapes: text shapes that read as a code rather than a quantity —
 * a phone number, an IP address, a web or email address, an ISBN, a postal
 * code, or digit groups split by whitespace outside thousands grouping.
 *
 * Each shape is one pattern read two ways. matchIdentifierShape tests a
 * cell's whole trimmed text, anchored with `^...$`; classifyCell
 * (lib/dr-simplify/ladder.js) skips the cell (reason: 'identifier') on a
 * match, before the bracketed-number check and after the date and time
 * checks, so a date the date parser reads ("21 June 2020") stays a date. A
 * text in thousands grouping ("1 234 567 890") is a quantity for every shape
 * and never matches. getIdentifierMaskedRanges finds the same shapes inside
 * a cell with words ("Call 416-555-1234 about 1,613,245 units"), and
 * extractSimplifyMatches drops every number inside one, so the identifier
 * stays as written and the other numbers round. Two differences inside text:
 * digit groups split by spaces alone never count there ("in 2024 12 stores"
 * holds two numbers), and an ISBN counts only after the word "ISBN".
 *
 * Every repeat in every pattern matches each character one way only, and a
 * span inside text starts only where a shape can start, so every test runs
 * in time linear in the text's length.
 *
 * Each shape's patterns and test come first; the list and its two lookups
 * close the file, after every pattern they read.
 *
 * Loaded by manifest content_scripts BEFORE lib/dr-number/index.js, which
 * reads every function here into DR_NUMBER as it loads. Nothing here reads
 * another file at load time, and ladder.js calls these functions only while
 * classifying a cell, after every content script has loaded. All symbols land
 * on the shared global scope, the same convention core.js and parsing.js use.
 */

// Where a shape inside text may start and end: not right after a letter, a
// digit, an underscore, or a dot, and not right before a letter, a digit, an
// underscore, or a dot followed by one. So "12416-555-1234" and
// "192.168.0.1.5" hold no shape, and a sentence's closing period after one
// ("call 416-555-1234.") still ends it.
const SPAN_START = '(?<![\\w.])';
const SPAN_END = '(?![\\w]|\\.\\w)';
// A span inside text made of digits, whitespace, and "+" alone is digit
// groups split by spaces, which count only as a whole cell.
const SPACED_DIGITS_ONLY_RE = /^[+\d\s]+$/;

// --- Phone numbers ---
// Two written shapes: digits split by dashes, dots, or spaces in a 3-3-4
// group with an optional leading "1" or "+1" ("416-555-1234", "416.555.1234",
// "416 555-1234", "1-800-555-0199"), or a bracketed area code with the same
// optional lead and an optional space after the bracket ("(416) 555-1234",
// "(416)555-1234", "(416) 555 1234", "+1 (416) 555-1234"). "100-200" is two
// groups, not three, so it is not this shape and keeps rounding as an
// extracted cell.
const PHONE_NUMBER_PATTERN = '\\+?(?:1[-.\\s]?)?\\d{3}[-.\\s]\\d{3}[-.\\s]\\d{4}|(?:\\+?1[-.\\s]?)?\\(\\d{3}\\)\\s?\\d{3}[-.\\s]\\d{4}';
const PHONE_NUMBER_RE = new RegExp(`^(?:${PHONE_NUMBER_PATTERN})$`);
const PHONE_NUMBER_SPAN_RE = new RegExp(`${SPAN_START}(?:${PHONE_NUMBER_PATTERN})${SPAN_END}`, 'g');

function isPhoneNumber(trimmed) {
  return PHONE_NUMBER_RE.test(trimmed);
}

// --- Grouped digits split by whitespace ---
// A digit run split by whitespace reads as thousands grouping only in one
// shape: a first group of 1-3 digits, then one or more groups of exactly 3
// digits, each preceded by whitespace, with an optional decimal part glued to
// the last group ("1 234 567", "12 345.67"). \s matches the narrow no-break
// space (U+202F) and the no-break space (U+00A0) international sites use for
// that grouping, alongside the plain ASCII space. Anything else with
// whitespace between two digits — a first group over 3 digits, a later group
// not exactly 3 — is not that shape, so it reads as an identifier instead of
// a quantity. Whole-cell only: it has no span pattern.
const GROUPED_DIGITS_GENERAL_RE = /^[+-]?\d+(?:\s+\d+)+(?:\.\d+)?$/;
const GROUPED_DIGITS_QUANTITY_RE = /^[+-]?\d{1,3}(?:\s+\d{3})+(?:\.\d+)?$/;

/**
 * True when trimmed is a whole cell of digit groups split by whitespace
 * ("4165 5512", "44 20 7946 0958") with its digits in one text piece.
 * matchIdentifierShape has already turned away the thousands-grouping shape
 * ("1 234 567", "12 345.67"), which keeps rounding as a pure cell. A grid's
 * stacked cell ("1500" above "1600") joins its pieces with whitespace, and
 * that join is several numbers, not one spaced identifier.
 */
function isGroupedDigitIdentifier(trimmed, digitsSpanPieces) {
  return !digitsSpanPieces && GROUPED_DIGITS_GENERAL_RE.test(trimmed);
}

// --- IP addresses ---
// IPv4: four dot-separated groups, each 0-255. "192.5" and "1.5" are two
// groups, not four, so they are not this shape and keep rounding as plain
// numbers. IPv6: hex groups joined by colons, with "::" standing for one run
// of zero groups. The time check earlier in the ladder already reads a plain
// "12:30:45" as a time, so the whole-cell test only ever sees what that
// check left behind, and inside text no IPv6 shape short of eight groups
// matches without a "::".
const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_PATTERN = `${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}`;
// The eight standard IPv6 group shapes (full form, and every placement of one
// "::" run), each built from bounded repeats of a fixed hex-group-plus-colon
// atom — no group repeats another repeating group, so matching stays linear.
const IPV6_PATTERN = '(?:' + [
  '(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}',
  '(?:[0-9a-fA-F]{1,4}:){1,7}:',
  '(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}',
  '(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}',
  '(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}',
  '(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}',
  '(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}',
  '[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}',
  ':(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)',
].join('|') + ')';
const IP_ADDRESS_PATTERN = `${IPV4_PATTERN}|${IPV6_PATTERN}`;
const IP_ADDRESS_RE = new RegExp(`^(?:${IP_ADDRESS_PATTERN})$`);
const IP_ADDRESS_SPAN_RE = new RegExp(`${SPAN_START}(?:${IP_ADDRESS_PATTERN})${SPAN_END}`, 'g');

function isIpAddress(trimmed) {
  return IP_ADDRESS_RE.test(trimmed);
}

// --- Web and email addresses ---
// A URL prefix (http://, https://, www.) followed by anything non-blank, or
// a bare name@domain.tld shape. The domain's labels exclude the dot that
// joins them, so each character has one place to match. Inside text, an
// email address starts only after whitespace or at the text's start: its
// name part takes any non-blank character, so a start at every punctuation
// mark of a long unbroken string would read that string again from each one.
const WEB_PATTERN = 'https?:\\/\\/\\S+|www\\.\\S+';
const EMAIL_PATTERN = '[^\\s@]+@[^\\s@.]+(?:\\.[^\\s@.]+)+';
const WEB_OR_EMAIL_RE = new RegExp(`^(?:${WEB_PATTERN}|${EMAIL_PATTERN})$`, 'i');
const WEB_OR_EMAIL_SPAN_RE = new RegExp(`${SPAN_START}(?:${WEB_PATTERN})|(?<!\\S)(?:${EMAIL_PATTERN})`, 'gi');

function isWebOrEmailAddress(trimmed) {
  return WEB_OR_EMAIL_RE.test(trimmed);
}

// --- ISBN-10 and ISBN-13 ---
// An optional "ISBN" word (with an optional "-10"/"-13" and an optional
// colon), then the digits with at most one dash or space between any two: 13
// digits starting 978 or 979 (ISBN-13), or 9 digits and a final digit or X
// (ISBN-10). Counting digits with an optional separator between each, rather
// than one pattern per grouping, covers every real grouping style
// (registration-group and publisher-prefix lengths vary by country and
// imprint) without hardcoding one. Without the "ISBN" word the digits must
// carry a dash or a space, the way an ISBN is printed: a bare 10- or
// 13-digit run ("1234567890") is a quantity written without thousands
// commas, and keeps rounding. Inside text the word is required.
// The colon takes the whitespace before it, so a run of whitespace after the
// word has one way to match.
const ISBN_PREFIX_PATTERN = 'isbn(?:-1[03])?(?:\\s*:)?\\s*';
const ISBN_BODY_PATTERN = '97[89](?:[- ]?\\d){10}|\\d(?:[- ]?\\d){8}[- ]?[\\dX]';
const ISBN_RE = new RegExp(`^(${ISBN_PREFIX_PATTERN})?(?:${ISBN_BODY_PATTERN})$`, 'i');
const ISBN_SPAN_RE = new RegExp(`${SPAN_START}${ISBN_PREFIX_PATTERN}(?:${ISBN_BODY_PATTERN})${SPAN_END}`, 'gi');

/**
 * True when trimmed is a whole cell holding an ISBN-10 or ISBN-13: with the
 * leading "ISBN" word and any separators, or without the word and with at
 * least one dash or space between its digits.
 */
function isIsbnShape(trimmed) {
  const match = ISBN_RE.exec(trimmed);
  return match !== null && (match[1] !== undefined || /[- ]/.test(trimmed));
}

// --- Postal codes ---
// Canadian (letter-digit-letter, digit-letter-digit: "M5V 2T6"), UK (one or
// two letters, a digit, an optional letter or digit, digit, two letters:
// "SW1A 1AA", "M1 1AE"), and US ZIP+4 (five digits, a dash, four digits:
// "90210-1234"). A bare five-digit ZIP ("90210") matches none of these and
// keeps rounding as a plain number.
const POSTAL_CODE_PATTERN = [
  '[A-Za-z]\\d[A-Za-z]\\s?\\d[A-Za-z]\\d',
  '[A-Za-z]{1,2}\\d[A-Za-z\\d]?\\s?\\d[A-Za-z]{2}',
  '\\d{5}-\\d{4}',
].join('|');
const POSTAL_CODE_RE = new RegExp(`^(?:${POSTAL_CODE_PATTERN})$`);
const POSTAL_CODE_SPAN_RE = new RegExp(`${SPAN_START}(?:${POSTAL_CODE_PATTERN})${SPAN_END}`, 'g');

function isPostalCode(trimmed) {
  return POSTAL_CODE_RE.test(trimmed);
}

// The one list of identifier shapes. Each entry names the shape, carries its
// whole-cell test, and carries its span pattern for text with words, or null
// when the shape counts only as a whole cell. matchIdentifierShape and
// getIdentifierMaskedRanges read it alone — classifyCell and
// extractSimplifyMatches hold no separate copy, and a new shape is one more
// entry here. Every test takes the trimmed text and whether the cell's digits
// span several text pieces. Phone numbers come before grouped digits so
// "416 555 1234" takes the phone name.
const IDENTIFIER_SHAPES = [
  { name: 'phone-number', test: isPhoneNumber, span: PHONE_NUMBER_SPAN_RE },
  { name: 'grouped-digits', test: isGroupedDigitIdentifier, span: null },
  { name: 'ip-address', test: isIpAddress, span: IP_ADDRESS_SPAN_RE },
  { name: 'web-or-email-address', test: isWebOrEmailAddress, span: WEB_OR_EMAIL_SPAN_RE },
  { name: 'isbn', test: isIsbnShape, span: ISBN_SPAN_RE },
  { name: 'postal-code', test: isPostalCode, span: POSTAL_CODE_SPAN_RE },
];

/**
 * The name of the identifier shape trimmed's whole text matches, or null. A
 * text in thousands grouping is a quantity and matches no shape, so a ten- or
 * thirteen-digit value written "1 234 567 890" never reads as an ISBN.
 * @param {string} trimmed - already-trimmed cell text
 * @param {boolean} [digitsSpanPieces] - true when the cell's digits sit in
 *   more than one text piece
 * @returns {string|null}
 */
function matchIdentifierShape(trimmed, digitsSpanPieces = false) {
  if (GROUPED_DIGITS_QUANTITY_RE.test(trimmed)) return null;
  const shape = IDENTIFIER_SHAPES.find((s) => s.test(trimmed, digitsSpanPieces));
  return shape ? shape.name : null;
}

/**
 * The {start, end} ranges of every identifier shape inside text, in the same
 * flat-text positions extractNumbersInText reports. Ranges from different
 * shapes may overlap; extractSimplifyMatches drops a number that touches
 * any.
 * @param {string} text
 * @returns {{start: number, end: number}[]}
 */
function getIdentifierMaskedRanges(text) {
  if (typeof text !== 'string') return [];
  const ranges = [];
  for (const shape of IDENTIFIER_SHAPES) {
    if (!shape.span) continue;
    for (const match of text.matchAll(shape.span)) {
      if (SPACED_DIGITS_ONLY_RE.test(match[0])) continue;
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}
