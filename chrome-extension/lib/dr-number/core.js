/**
 * DynamicRounding domain core (coercion + magnitude helpers).
 *
 * Loaded by both content.js (page context, via manifest content_scripts) and
 * sidebar.js (extension side-panel context, via <script> tag), AFTER rounding.js
 * and BEFORE content.js. Must remain framework-free and side-effect-free: no
 * chrome.*, no DOM access. All symbols land on the global object of whichever
 * script loads this file, so both contexts share the same findMaxMagnitude and
 * toNumber. This is the extension's own copy; the standalone js/round_dynamic.js
 * implements a separate, unrelated entry point for Google Sheets.
 *
 * The arithmetic primitives (roundWithOffset, roundCellSetAware) live in
 * rounding.js, which must load before this file.
 */

// The one currency list. Each row gives a currency's written signs and its
// ISO code, and every currency rule in the extension reads this list: the
// signs stripped before a text reads as a number, the signs a unit number
// may carry, the placement step's sign-only piece test, the currency
// exclusion, and the data test's numeric probe. Nothing restates it.
//
// A sign counts exactly as written, and the longest sign wins, so "EC$"
// reads as one sign rather than a letter pair beside a dollar sign. A code
// counts only in upper case and only as its own token, so "CADENCE" and
// "usd" do not. A sign written in letters takes that same token rule on
// whichever end carries the letter, so the rand's "R" counts in "R45" and
// not in "Revenue", and the krone's "kr" counts in "kr45" and not in
// "krona". A sign written as a picture counts anywhere, as it always has.
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

// Constants owned by the coercion + magnitude layer.
// Everything dropped from a text before it reads as a number: a currency
// sign, a thousands comma, whitespace, and a percent sign.
const CLEAN_REGEX = new RegExp('(?:' + CURRENCY_SIGN_ALTERNATION + '|[,\\s%])', 'g');
const PARENS_REGEX = /^\((.+)\)$/;
const DEFAULT_OFFSET_TOP = -0.5;
const DEFAULT_NUM_TOP = 1;
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

function toNumber(value) {
  if (typeof value === "number") {
    return isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    let cleaned = value.trim()
      .replace(/[‐-―−﹘﹣－]/g, "-")
      .replace(CLEAN_REGEX, "")
      .replace(PARENS_REGEX, "-$1");
    if (cleaned === "") return null;
    const parsed = Number(cleaned);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}
