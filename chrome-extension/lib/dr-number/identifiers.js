/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Identifier shapes: whole-cell text shapes that read as a code rather than a
 * quantity — a phone number, an IP address, a web or email address, an ISBN,
 * or a postal code. classifyCell (lib/dr-simplify/ladder.js) checks a cell's
 * whole trimmed text against this one list and skips the cell (reason:
 * 'identifier') on a match, before the bracketed-number check and after the
 * date and time checks, so a date written with spaces still reads as a date
 * first. A cell with words around a matching shape ("Call 416-555-1234")
 * never reaches this list: every pattern is anchored to the whole trimmed
 * text with `^...$`, and no repeat in any pattern can match the same
 * character two ways, so every match runs in time linear in the cell's
 * length.
 *
 * Loaded by manifest content_scripts AFTER core.js and parsing.js and BEFORE
 * lib/dr-simplify/ladder.js. All symbols land on the shared global scope
 * consumed by ladder.js, the same convention core.js and parsing.js use.
 */

// --- Grouped digits split by whitespace ---
// A digit run split by whitespace reads as thousands grouping only in one
// shape: a first group of 1-3 digits, then one or more groups of exactly 3
// digits, each preceded by whitespace, with an optional decimal part glued to
// the last group ("1 234 567", "12 345.67"). \s matches the narrow no-break
// space (U+202F) and the no-break space (U+00A0) international sites use for
// that grouping, alongside the plain ASCII space. Anything else with
// whitespace between two digits — a first group over 3 digits, a later group
// not exactly 3, a phone number's area code and exchange — is not that shape,
// so it reads as an identifier instead of a quantity.
const GROUPED_DIGITS_GENERAL_RE = /^[+-]?\d+(?:\s+\d+)+(?:\.\d+)?$/;
const GROUPED_DIGITS_QUANTITY_RE = /^[+-]?\d{1,3}(?:\s+\d{3})+(?:\.\d+)?$/;

/**
 * True when trimmed is a whole cell of digit groups split by whitespace that
 * is not the thousands-grouping shape ("416 555 1234", "+1 416 555 1234",
 * "4165 5512"). A cell that is the thousands-grouping shape itself ("1 234
 * 567", "12 345.67") is a quantity and returns false, so it keeps rounding as
 * a pure cell — the whitespace is a format mark CLEAN_REGEX (core.js) already
 * strips before the text reads as a number.
 */
function isGroupedDigitIdentifier(trimmed) {
  return GROUPED_DIGITS_GENERAL_RE.test(trimmed) && !GROUPED_DIGITS_QUANTITY_RE.test(trimmed);
}

// --- Phone numbers ---
// Two written shapes: digits split by dashes or dots in a 3-3-4 group with an
// optional leading "1" or a "+" country code ("416-555-1234", "416.555.1234",
// "1-800-555-0199"), or a bracketed area code ("(416) 555-1234"). "100-200"
// is two groups, not three, so it is not this shape and keeps rounding as an
// extracted cell.
const PHONE_NUMBER_RE = /^(?:\+?(?:1[-.]?)?\d{3}[-.]\d{3}[-.]\d{4}|\(\d{3}\)\s?\d{3}[-.]\d{4})$/;

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

// --- Web and email addresses ---
// A URL prefix (http://, https://, www.) followed by anything non-blank, or
// a bare name@domain.tld shape. The domain's labels exclude the dot that
// joins them, so each character has one place to match and the test stays
// linear on a long unbroken string.
const WEB_OR_EMAIL_RE = /^(?:https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+)$/i;

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

// The one list of identifier shapes. Each entry names the shape and carries
// either an anchored `pattern` (a RegExp tested against the whole trimmed
// cell text) or a `test` predicate built the same way from anchored patterns,
// for the two shapes ("grouped-digits", "isbn") a single regex cannot decide
// alone. A new shape is one more entry here, read by matchIdentifierShape
// alone — classifyCell holds no separate copy.
const IDENTIFIER_SHAPES = [
  { name: 'grouped-digits', test: isGroupedDigitIdentifier },
  { name: 'phone-number', pattern: PHONE_NUMBER_RE },
  { name: 'ip-address', pattern: IP_ADDRESS_RE },
  { name: 'web-or-email-address', pattern: WEB_OR_EMAIL_RE },
  { name: 'isbn', test: isIsbnShape },
  { name: 'postal-code', pattern: POSTAL_CODE_RE },
];

/**
 * The name of the identifier shape trimmed's whole text matches, or null.
 * @param {string} trimmed - already-trimmed cell text
 * @returns {string|null}
 */
function matchIdentifierShape(trimmed) {
  if (typeof trimmed !== 'string' || trimmed === '') return null;
  for (const shape of IDENTIFIER_SHAPES) {
    const matched = shape.pattern ? shape.pattern.test(trimmed) : shape.test(trimmed);
    if (matched) return shape.name;
  }
  return null;
}
