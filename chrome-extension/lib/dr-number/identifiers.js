/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Identifier shapes: text shapes that read as a code rather than a quantity —
 * a phone number, an IP address, a web or email address, an ISBN, a postal
 * code, a digit run with a leading zero, or digit groups split by whitespace
 * outside thousands grouping.
 *
 * One check finds every code in a cell: findIdentifiers searches the cell's
 * text once for every shape and records, for each code it finds, whether the
 * code fills the cell. A code fills the cell when nothing stands around it
 * but the format marks, signs, and brackets the pure number span steps past
 * (PURE_LEAD_PATTERN and PURE_TRAIL_PATTERN in parsing.js), so "(416)
 * 555-1234" and "$ 416-555-1234" fill their cells. A text in thousands
 * grouping ("1 234 567 890") is a quantity, and no code fills it.
 *
 * The ladder reads the one result two ways. matchIdentifierShape returns the
 * name of a code that fills the cell, and classifyCell
 * (lib/dr-simplify/ladder.js) skips that cell (reason: 'identifier'), after
 * the date and time checks, so a date the date parser reads ("21 June 2020")
 * stays a date, and before the bracketed-number check. getIdentifierMaskedRanges
 * returns the codes that count inside a cell with words ("Call 416-555-1234
 * about 1,613,245 units"), and extractSimplifyMatches drops every number
 * inside one, so the code stays as written and the other numbers round.
 *
 * Some codes count only when they fill the cell, because inside a sentence
 * the same characters are as likely to be several numbers: digit groups
 * split by spaces alone ("in 2024 12 stores" holds two numbers), and an ISBN
 * without the word "ISBN".
 *
 * Every repeat in every pattern matches each character one way only, a code
 * inside text starts only where a shape can start, and every test of the
 * text around a code is anchored at both ends, so every test runs in time
 * linear in the text's length.
 *
 * Each shape's pattern comes first; the list, the one search, and its two
 * readings close the file.
 *
 * Loaded by manifest content_scripts AFTER lib/dr-number/parsing.js, whose
 * two patterns build the fill tests here at load time, and BEFORE
 * lib/dr-number/index.js, which reads every function here into DR_NUMBER as
 * it loads. The Sheets build joins the files in the same order. All symbols
 * land on the shared global scope, the same convention core.js and
 * parsing.js use.
 */

// Where a shape inside text may start and end: not right after a letter, a
// digit, an underscore, or a dot, and not right before a letter, a digit, an
// underscore, or a dot followed by one. So "12416-555-1234" and
// "192.168.0.1.5" hold no shape, and a sentence's closing period after one
// ("call 416-555-1234.") still ends it.
const SPAN_START = '(?<![\\w.])';
const SPAN_END = '(?![\\w]|\\.\\w)';
// A code made of digits, whitespace, and "+" alone, with at least one
// whitespace, is digit groups split by spaces, which count only when they
// fill the cell. A digit run with a leading zero holds no whitespace, so it
// counts inside text.
const SPACED_DIGITS_ONLY_RE = /^(?=.*\s)[+\d\s]+$/;

// A code found anywhere inside text between the edges above.
const spanRe = (pattern, flags = '') => new RegExp(`${SPAN_START}(?:${pattern})${SPAN_END}`, `${flags}g`);
// The text before and after a code that fills its cell, and a pattern that
// fills the cell on its own.
const CELL_LEAD_RE = new RegExp(`^${PURE_LEAD_PATTERN}$`);
const CELL_TRAIL_RE = new RegExp(`^${PURE_TRAIL_PATTERN}$`);
const fillingRe = (pattern, flags = '') => new RegExp(`^${PURE_LEAD_PATTERN}(?:${pattern})${PURE_TRAIL_PATTERN}$`, flags);

// --- Phone numbers ---
// Two written shapes: digits split by dashes, dots, or spaces in a 3-3-4
// group with an optional leading "1" or "+1" ("416-555-1234", "416.555.1234",
// "416 555-1234", "1-800-555-0199"), or a bracketed area code with the same
// optional lead and an optional space after the bracket ("(416) 555-1234",
// "(416)555-1234", "(416) 555 1234", "+1 (416) 555-1234"). "100-200" is two
// groups, not three, so it is not this shape and keeps rounding as an
// extracted cell.
const PHONE_NUMBER_PATTERN = '\\+?(?:1[-.\\s]?)?\\d{3}[-.\\s]\\d{3}[-.\\s]\\d{4}|(?:\\+?1[-.\\s]?)?\\(\\d{3}\\)\\s?\\d{3}[-.\\s]\\d{4}';

// --- Grouped digits split by whitespace ---
// A digit run split by whitespace reads as thousands grouping only in the
// group shape (groupShapePattern, core.js, the one copy the number shape
// test reads too), with an optional decimal part glued to the last group
// ("1 234 567", "12 345.67"). Anything else with whitespace between two
// digits — a first group over 3 digits, a later group not exactly 3 — is not
// that shape, so it reads as an identifier instead of a quantity. It counts
// only when it fills the cell, and only when the cell's digits sit in one
// text piece: a grid's stacked cell ("1500" above "1600") joins its pieces
// with whitespace, and that join is several numbers, not one spaced
// identifier.
const GROUPED_DIGITS_RE = fillingRe('\\d+(?:\\s+\\d+)+(?:\\.\\d+)?');
const GROUPED_DIGITS_QUANTITY_RE = fillingRe(groupShapePattern(GROUP_SPACE_PATTERN) + '(?:\\.\\d+)?');

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

// --- Web and email addresses ---
// A URL prefix (http://, https://, www.) followed by anything non-blank, or
// a bare name@domain.tld shape. The domain's labels exclude the dot that
// joins them, so each character has one place to match. An email address
// starts only after whitespace or at the text's start: its name part takes
// any non-blank character, so inside text a start at every punctuation mark
// of a long unbroken string would read that string again from each one. A
// whole cell starts at the text's start, so that edge never narrows it.
const WEB_PATTERN = 'https?:\\/\\/\\S+|www\\.\\S+';
const EMAIL_PATTERN = '[^\\s@]+@[^\\s@.]+(?:\\.[^\\s@.]+)+';
const WEB_OR_EMAIL_PATTERN = `${WEB_PATTERN}|(?<!\\S)(?:${EMAIL_PATTERN})`;

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
// commas, and keeps rounding. An ISBN with the word counts anywhere; one
// without it counts only when it fills the cell.
// The colon takes the whitespace before it, so a run of whitespace after the
// word has one way to match.
const ISBN_PREFIX_PATTERN = 'isbn(?:-1[03])?(?:\\s*:)?\\s*';
const ISBN_BODY_PATTERN = '97[89](?:[- ]?\\d){10}|\\d(?:[- ]?\\d){8}[- ]?[\\dX]';
const ISBN_WITHOUT_WORD_RE = fillingRe(`(${ISBN_BODY_PATTERN})`, 'i');

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

// --- Leading zero ---
// A digit run that starts with "0" followed by another digit: "007",
// "01234", "0012345678". A quantity is not written with a leading zero, and
// a code, an account number, or a US ZIP code in New England ("02134")
// often is. "0", "0.5", and "0.0625" are not this shape, since a decimal
// mark follows their zero. The run carries no group mark and no decimal
// mark: a run followed by a comma or a dot and a digit ("0123.45",
// "012,345") is not this shape. A sentence's comma or period after the run
// ("ID 0000123, late") still ends it. A run that is one group of a larger
// number ("034" in "1,034" or "1 034 567") is not a code either: the shape
// is groupOfNumber, so findIdentifiers drops a match that sits inside a
// longer number run.
const LEADING_ZERO_PATTERN = '0\\d+(?![.,]\\d)';

/**
 * True when [start, end) sits inside a longer run the pattern that finds a
 * number inside text (parsing.js) takes as one number, so the characters
 * are one group of that number. That pattern is the one place that states
 * what one number spans, so a group of a space-grouped or comma-grouped
 * number is never read a second way here.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function insideNumberRun(text, start, end) {
  for (const run of text.matchAll(NUMBER_IN_TEXT_REGEX_GLOBAL)) {
    // The run's digits alone: its minus sign is not a group ("-0123").
    const runStart = run.index + (run[0].startsWith('-') ? 1 : 0);
    const runEnd = run.index + run[0].length;
    if (runStart <= start && end <= runEnd && runEnd - runStart > end - start) return true;
  }
  return false;
}

// The one list of identifier shapes. Each entry holds the shape's name, its
// pattern for a code anywhere in the text, and, for a shape with a form that
// counts only when it fills the cell, a test of the whole text for that form.
// The test takes the text and whether the cell's digits span several text
// pieces. A shape marked groupOfNumber drops a match that is one group of a
// longer number run. findIdentifiers reads the list alone, and a new shape
// is one more entry here. Phone numbers come before grouped digits so
// "416 555 1234" takes the phone name.
const IDENTIFIER_SHAPES = [
  { name: 'phone-number', span: spanRe(PHONE_NUMBER_PATTERN) },
  { name: 'grouped-digits', fillsOnly: (text, digitsSpanPieces) => !digitsSpanPieces && GROUPED_DIGITS_RE.test(text) },
  { name: 'ip-address', span: spanRe(IP_ADDRESS_PATTERN) },
  { name: 'web-or-email-address', span: spanRe(WEB_OR_EMAIL_PATTERN, 'i') },
  {
    name: 'isbn',
    span: spanRe(`${ISBN_PREFIX_PATTERN}(?:${ISBN_BODY_PATTERN})`, 'i'),
    fillsOnly: (text) => /[- ]/.test((ISBN_WITHOUT_WORD_RE.exec(text) || [])[1] || ''),
  },
  { name: 'postal-code', span: spanRe(POSTAL_CODE_PATTERN) },
  { name: 'leading-zero', span: spanRe(LEADING_ZERO_PATTERN), groupOfNumber: true },
];

/**
 * Every code in text, in list order: its shape's name, its {start, end} in
 * the flat-text positions extractNumbersInText reports, whether it fills the
 * cell, and whether it counts inside a cell with words. Codes from different
 * shapes may overlap.
 * @param {string} text
 * @param {boolean} [digitsSpanPieces] - true when the cell's digits sit in
 *   more than one text piece
 * @returns {{name: string, start: number, end: number, fillsCell: boolean, inText: boolean}[]}
 */
function findIdentifiers(text, digitsSpanPieces = false) {
  if (typeof text !== 'string') return [];
  const quantity = GROUPED_DIGITS_QUANTITY_RE.test(text);
  const codes = [];
  for (const shape of IDENTIFIER_SHAPES) {
    for (const match of shape.span ? text.matchAll(shape.span) : []) {
      const start = match.index;
      const end = start + match[0].length;
      if (shape.groupOfNumber && insideNumberRun(text, start, end)) continue;
      const fillsCell = !quantity
        && CELL_LEAD_RE.test(text.slice(0, start)) && CELL_TRAIL_RE.test(text.slice(end));
      codes.push({ name: shape.name, start, end, fillsCell, inText: !SPACED_DIGITS_ONLY_RE.test(match[0]) });
    }
    if (shape.fillsOnly && !quantity && shape.fillsOnly(text, digitsSpanPieces)) {
      codes.push({ name: shape.name, start: 0, end: text.length, fillsCell: true, inText: false });
    }
  }
  return codes;
}

/**
 * The name of the first code that fills the cell, or null. A text in
 * thousands grouping is a quantity, so a ten- or thirteen-digit value
 * written "1 234 567 890" never reads as an ISBN.
 * @param {string} text - cell text
 * @param {boolean} [digitsSpanPieces] - true when the cell's digits sit in
 *   more than one text piece
 * @returns {string|null}
 */
function matchIdentifierShape(text, digitsSpanPieces = false) {
  const code = findIdentifiers(text, digitsSpanPieces).find((c) => c.fillsCell);
  return code ? code.name : null;
}

/**
 * The {start, end} ranges of every code that counts inside a cell with
 * words. extractSimplifyMatches drops a number that touches any.
 * @param {string} text
 * @returns {{start: number, end: number}[]}
 */
function getIdentifierMaskedRanges(text) {
  return findIdentifiers(text).filter((c) => c.inText).map(({ start, end }) => ({ start, end }));
}
