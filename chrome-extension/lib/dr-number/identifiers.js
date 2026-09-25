/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Identifier shapes: whole-cell text shapes that read as a code rather than a
 * quantity — a phone number, an IP address, a web or email address, an ISBN,
 * a postal code, or digit groups split by whitespace outside thousands
 * grouping. classifyCell (lib/dr-simplify/ladder.js) checks a cell's whole
 * trimmed text against this one list and skips the cell (reason:
 * 'identifier') on a match, before the bracketed-number check and after the
 * date and time checks, so a date the date parser reads ("21 June 2020")
 * stays a date. A text in thousands grouping ("1 234 567 890") is a quantity
 * for every shape and never matches. A cell with words around a matching
 * shape ("Call 416-555-1234") never matches: every pattern is anchored to the
 * whole trimmed text with `^...$`, and no repeat in any pattern can match the
 * same character two ways, so every test runs in time linear in the cell's
 * length.
 *
 * The list and its lookup come first; each shape's test and patterns follow
 * below. The tests are function declarations, so the list can name them
 * before their definitions, and the patterns they read are defined before
 * any cell is classified.
 *
 * Loaded by manifest content_scripts BEFORE lib/dr-number/index.js, which
 * reads every function here into DR_NUMBER as it loads. Nothing here reads
 * another file at load time, and ladder.js calls matchIdentifierShape only
 * while classifying a cell, after every content script has loaded. All
 * symbols land on the shared global scope, the same convention core.js and
 * parsing.js use.
 */

// The one list of identifier shapes. Each entry names the shape and carries
// the test for it, read by matchIdentifierShape alone — classifyCell holds no
// separate copy, and a new shape is one more entry here. Every test takes the
// trimmed text and whether the cell's digits span several text pieces. Phone
// numbers come before grouped digits so "416 555 1234" takes the phone name.
const IDENTIFIER_SHAPES = [
  { name: 'phone-number', test: isPhoneNumber },
  { name: 'grouped-digits', test: isGroupedDigitIdentifier },
  { name: 'ip-address', test: isIpAddress },
  { name: 'web-or-email-address', test: isWebOrEmailAddress },
  { name: 'isbn', test: isIsbnShape },
  { name: 'postal-code', test: isPostalCode },
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

// --- Phone numbers ---
// Two written shapes: digits split by dashes, dots, or spaces in a 3-3-4
// group with an optional leading "1" or "+1" ("416-555-1234", "416.555.1234",
// "416 555-1234", "1-800-555-0199"), or a bracketed area code with the same
// optional lead and an optional space after the bracket ("(416) 555-1234",
// "(416)555-1234", "(416) 555 1234", "+1 (416) 555-1234"). "100-200" is two
// groups, not three, so it is not this shape and keeps rounding as an
// extracted cell.
const PHONE_NUMBER_RE = /^(?:\+?(?:1[-.\s]?)?\d{3}[-.\s]\d{3}[-.\s]\d{4}|(?:\+?1[-.\s]?)?\(\d{3}\)\s?\d{3}[-.\s]\d{4})$/;

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
// a quantity.
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
// "12:30:45" as a time, so this pattern only ever sees what that check left
// behind.
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
const IP_ADDRESS_RE = new RegExp(`^(?:${IPV4_PATTERN}|${IPV6_PATTERN})$`);

function isIpAddress(trimmed) {
  return IP_ADDRESS_RE.test(trimmed);
}

// --- Web and email addresses ---
// A URL prefix (http://, https://, www.) followed by anything non-blank, or
// a bare name@domain.tld shape. The domain's labels exclude the dot that
// joins them, so each character has one place to match and the test stays
// linear on a long unbroken string.
const WEB_OR_EMAIL_RE = /^(?:https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+)$/i;

function isWebOrEmailAddress(trimmed) {
  return WEB_OR_EMAIL_RE.test(trimmed);
}

// --- ISBN-10 and ISBN-13 ---
// An optional "ISBN" word (with an optional "-10"/"-13" and an optional
// colon), then the digits with dashes or spaces between them, ending in a
// digit or, for ISBN-10 only, the letter X. The check strips the optional
// prefix and any dashes or spaces, then counts what is left: 13 digits
// starting 978 or 979 is ISBN-13, 9 digits plus a final digit or X is
// ISBN-10. Checking the digit count this way, rather than one regex per
// grouping, covers every real grouping style (registration-group and
// publisher-prefix lengths vary by country and imprint) without hardcoding
// one. Without the "ISBN" word the digits must carry a dash or a space, the
// way an ISBN is printed: a bare 10- or 13-digit run ("1234567890") is a
// quantity written without thousands commas, and keeps rounding.
const ISBN_PREFIX_RE = /^isbn(?:-1[03])?\s*:?\s*/i;
const ISBN_BODY_RE = /^\d(?:[\d\- ]*[\dXx])?$/;
const ISBN_SEPARATOR_RE = /[-\s]/;

/**
 * True when trimmed is a whole cell holding an ISBN-10 or ISBN-13: with the
 * leading "ISBN" word and any separators, or without the word and with at
 * least one dash or space between its digits.
 */
function isIsbnShape(trimmed) {
  const rest = trimmed.replace(ISBN_PREFIX_RE, '');
  if (!ISBN_BODY_RE.test(rest)) return false;
  if (rest === trimmed && !ISBN_SEPARATOR_RE.test(rest)) return false;
  const digitsOnly = rest.replace(/[-\s]/g, '');
  return /^97[89]\d{10}$/.test(digitsOnly) || /^\d{9}[\dXx]$/.test(digitsOnly);
}

// --- Postal codes ---
// Canadian (letter-digit-letter, digit-letter-digit: "M5V 2T6"), UK (one or
// two letters, a digit, an optional letter or digit, digit, two letters:
// "SW1A 1AA", "M1 1AE"), and US ZIP+4 (five digits, a dash, four digits:
// "90210-1234"). A bare five-digit ZIP ("90210") matches none of these and
// keeps rounding as a plain number.
const POSTAL_CODE_RE = new RegExp(
  '^(?:' + [
    '[A-Za-z]\\d[A-Za-z]\\s?\\d[A-Za-z]\\d',
    '[A-Za-z]{1,2}\\d[A-Za-z\\d]?\\s?\\d[A-Za-z]{2}',
    '\\d{5}-\\d{4}',
  ].join('|') + ')$'
);

function isPostalCode(trimmed) {
  return POSTAL_CODE_RE.test(trimmed);
}
