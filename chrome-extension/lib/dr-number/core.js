/**
 * DynamicRounding domain core (coercion + magnitude helpers).
 *
 * Read by three scripts, each AFTER rounding.js: the content script (page
 * context, via manifest content_scripts), the sidebar (extension side-panel
 * context, via <script> tag), and the Google Sheets library, which
 * scripts/build-sheets.js writes by joining this file with the rest of the
 * shared library and the Sheets entry source. Must remain framework-free and
 * side-effect-free: no chrome.*, no DOM access, no Node module code. All
 * symbols land on the global scope of whichever script holds this file, so
 * the extension and the Sheets library share one currency list, one
 * findMaxMagnitude, and one toNumber.
 *
 * The arithmetic primitives (roundWithOffset, roundCellSetAware) live in
 * rounding.js, which must load before this file.
 */

// The one currency list. Each row gives a currency's written signs and its
// ISO code, and every currency rule in the extension reads this list: the
// signs stripped before a text reads as a number, the signs a unit number
// may carry, the placement step's sign-only piece test, and the currency
// exclusion. Nothing restates it.
//
// A sign counts exactly as written, and the longest sign wins, so "EC$"
// reads as one sign rather than a letter pair beside a dollar sign. A code
// counts only in upper case and only as its own token, so "CADENCE" and
// "usd" do not. A sign written in letters takes that same token rule on
// whichever end carries the letter, so the rand's "R" counts in "R45" and
// not in "Revenue", and the krone's "kr" counts in "kr45" and not in
// "krona". A sign written as a picture counts anywhere.
// Several currencies share a sign, and one currency may carry several;
// both collapse to one entry in the derived lists below.
const CURRENCIES = [
  { name: 'Euro',                       signs: ['€'],             code: 'EUR' },
  { name: 'United States dollar',       signs: ['$'],             code: 'USD' },
  { name: 'Sterling',                   signs: ['£'],             code: 'GBP' },
  { name: 'Japanese yen',               signs: ['¥'],             code: 'JPY' },
  { name: 'Australian dollar',          signs: ['$'],             code: 'AUD' },
  { name: 'Eastern Caribbean dollar',   signs: ['EC$'],           code: 'XCD' },
  { name: 'West African CFA franc',     signs: ['Fr', 'F.CFA'],   code: 'XOF' },
  { name: 'New Zealand dollar',         signs: ['$'],             code: 'NZD' },
  { name: 'Norwegian krone',            signs: ['kr'],            code: 'NOK' },
  { name: 'Central African CFA franc',  signs: ['Fr', 'F.CFA'],   code: 'XAF' },
  { name: 'South African rand',         signs: ['R'],             code: 'ZAR' },
  { name: 'CFP franc',                  signs: ['₣', 'F', 'Fr'],  code: 'XPF' },
  { name: 'Chilean peso',               signs: ['$'],             code: 'CLP' },
  { name: 'Danish krone',               signs: ['kr'],            code: 'DKK' },
  { name: 'Indian rupee',               signs: ['₹'],             code: 'INR' },
  { name: 'Russian ruble',              signs: ['₽'],             code: 'RUB' },
  { name: 'Turkish lira',               signs: ['₺'],             code: 'TRY' },
  { name: 'Swiss franc',                signs: ['Fr'],            code: 'CHF' },
  { name: 'Brunei dollar',              signs: ['B$'],            code: 'BND' },
  { name: 'Singapore dollar',           signs: ['$', 'S$'],       code: 'SGD' },
  { name: 'Caribbean guilder',          signs: ['Cg', 'XCG'],     code: 'XCG' },
  { name: 'Saint Helena pound',         signs: ['£'],             code: 'SHP' },
  { name: 'Falkland Islands pound',     signs: ['£'],             code: 'FKP' },
  { name: 'Canadian dollar',            signs: [],                code: 'CAD' },
  { name: 'Chinese yuan',               signs: ['¥'],             code: 'CNY' },
  { name: 'Hong Kong dollar',           signs: [],                code: 'HKD' },
  { name: 'Mexican peso',               signs: [],                code: 'MXN' },
  { name: 'Brazilian real',             signs: [],                code: 'BRL' },
  { name: 'South Korean won',           signs: [],                code: 'KRW' },
];

// Derived from CURRENCIES, in one place, so a new row reaches every rule.
// Signs sort longest first: an alternation takes the first branch that
// matches, so "EC$" must be offered before "$".
const CURRENCY_CODES = Array.from(new Set(CURRENCIES.map((c) => c.code)));
const CURRENCY_SIGNS = Array.from(new Set(CURRENCIES.flatMap((c) => c.signs)))
  .sort((a, b) => b.length - a.length);
const CURRENCY_SIGN_ALTERNATION = CURRENCY_SIGNS
  .map((sign) => {
    const escaped = sign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before = /^[A-Za-z]/.test(sign) ? '(?<![A-Za-z])' : '';
    const after = /[A-Za-z]$/.test(sign) ? '(?![A-Za-z])' : '';
    return before + escaped + after;
  })
  .join('|');
// One currency sign, anywhere in a text.
const CURRENCY_SIGN_RE = new RegExp(CURRENCY_SIGN_ALTERNATION);

// Constants of the coercion and magnitude layer.
// The one format-mark list: a character that sits beside a number without
// belonging to it — a currency sign, a percent sign, and whitespace. The
// signs come from CURRENCIES above, so a new row reaches this list too.
// Every rule that steps past a mark to reach a number reads this one source:
// the clean-up before a text reads as a number, the test for what stands
// between a bracket and the number, and the pure number span
// (lib/dr-number/parsing.js).
// A bracket is not a format mark: it is the number's minus sign, and adding
// it here would strip it before PARENS_REGEX below could read it.
const FORMAT_MARK_ALTERNATION = '(?:' + CURRENCY_SIGN_ALTERNATION + '|[\\s%])';
// Everything dropped from a text before it reads as a number: the format
// marks, except whitespace between two digits. That whitespace is a group
// mark ("1 234 567"), not a format mark, so it stays, as a comma does, for
// the number shape test below to test where it stands.
const CLEAN_REGEX = new RegExp('(?!(?<=\\d\\s*)\\s(?=\\s*\\d))' + FORMAT_MARK_ALTERNATION, 'g');
const PARENS_REGEX = /^\((.+)\)$/;
// The characters toNumber reads as a minus sign: every dash and minus
// variant, each normalized to an ASCII "-" before the conversion. The pure
// number span (lib/dr-number/parsing.js) steps past the same class.
const DASH_CLASS = '[‐-―−﹘﹣－]';
const DASH_REGEX = new RegExp(DASH_CLASS, 'g');
const VALIDATION_LIMIT = 20;

function findMaxMagnitude(numericRange) {
  let max_mag = null;
  for (let row of numericRange) {
    for (let num of row) {
      if (num !== null && num !== 0 && isFinite(num)) {
        const mag = Math.floor(Math.log10(Math.abs(num)));
        if (max_mag === null || mag > max_mag) {
          max_mag = mag;
        }
      }
    }
  }
  return max_mag;
}

// roundCellSetAware and roundWithOffset live in rounding.js.

// The marks a number uses: US style, a comma between groups of three digits
// and a dot before the fraction. Frozen, so no caller can change the marks
// another caller reads.
const US_NUMBER_FORMAT = Object.freeze({ group: ',', decimal: '.' });

/**
 * The number format function: the one place that states which marks a
 * number uses. The number shape test reads it to know which shape to accept,
 * and the write-back reads it to know which marks to write. It returns US
 * style for now.
 * @returns {{group: string, decimal: string}}
 */
function numberFormat() {
  return US_NUMBER_FORMAT;
}

// Whitespace standing as a group mark between two digit groups ("1 234 567").
// The class covers the narrow no-break space (U+202F) and the no-break space
// (U+00A0) pages use for that grouping, alongside the plain space. A line
// break is no group mark: the browser shows the digits on two lines, which
// read as two numbers ("125" above "126").
const GROUP_SPACE_PATTERN = '[^\\S\\r\\n]+';

/**
 * The group shape for one group mark: a first group of one to three digits,
 * then groups of exactly three, each after the mark. This is the one copy of
 * the shape. The number shape test reads it with the number format's group
 * mark and with whitespace; the pattern that finds a number inside text
 * (parsing.js) and the spaced-digit identifier shape (identifiers.js) read
 * it with whitespace.
 * @param {string} markPattern - the group mark, as a regular expression source
 * @returns {string}
 */
function groupShapePattern(markPattern) {
  return '\\d{1,3}(?:' + markPattern + '\\d{3})+';
}

// The group-shape test for each group mark, built once: toNumber runs on
// every cell of every pass. The cache holds one entry for the number
// format's mark and one for whitespace; it grows by one entry for each
// distinct group mark a later format returns, never with page content.
const GROUP_SHAPE_CACHE = new Map();
const GROUP_SPACE_RE = /\s/;

/**
 * The number shape test. A group mark, the number format's mark or
 * whitespace, may appear only in the group shape and only before the decimal
 * mark, and a run holds one kind of group mark. A run with no group mark
 * passes, and the conversion judges it as before, so ".300", "5." and
 * "1.2E+05" still read as numbers and a second dot still fails there. `run`
 * is a text with its format marks stripped, its dashes normalized, and its
 * brackets turned into a minus sign.
 * @param {string} run
 * @param {{group: string, decimal: string}} marks
 * @returns {boolean}
 */
function isNumberShape(run, marks) {
  const at = run.indexOf(marks.decimal);
  const whole = at === -1 ? run : run.slice(0, at);
  const fraction = at === -1 ? '' : run.slice(at + marks.decimal.length);
  if (fraction.includes(marks.group) || GROUP_SPACE_RE.test(fraction)) return false;
  const hasGroupMark = whole.includes(marks.group);
  const hasGroupSpace = GROUP_SPACE_RE.test(whole);
  if (!hasGroupMark && !hasGroupSpace) return true;
  if (hasGroupMark && hasGroupSpace) return false;
  const mark = hasGroupMark ? marks.group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : GROUP_SPACE_PATTERN;
  if (!GROUP_SHAPE_CACHE.has(mark)) {
    GROUP_SHAPE_CACHE.set(mark, new RegExp('^[+-]?' + groupShapePattern(mark) + '$'));
  }
  return GROUP_SHAPE_CACHE.get(mark).test(whole);
}

function toNumber(value) {
  if (typeof value === "number") {
    return isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const marks = numberFormat();
    const cleaned = value.trim()
      .replace(DASH_REGEX, "-")
      .replace(CLEAN_REGEX, "")
      .replace(PARENS_REGEX, "-$1");
    if (cleaned === "") return null;
    if (!isNumberShape(cleaned, marks)) return null;
    const ungrouped = cleaned.split(marks.group).join("").replace(/\s+/g, "");
    const plain = marks.decimal === "." ? ungrouped : ungrouped.split(marks.decimal).join(".");
    const parsed = Number(plain);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}
