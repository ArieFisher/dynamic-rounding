// The Sheets entry source: the code only the Google Sheets library holds.
// scripts/build-sheets.js joins it after the shared library files it lists,
// so roundWithOffset and roundCellSetAware here come from
// chrome-extension/lib/dr-number/rounding.js.

// Constants
// Format marks dropped before a text reads as a number: currency signs,
// whitespace, and percent signs. A comma stays, so GROUP_SHAPE_REGEX can
// test where it stands.
const CLEAN_REGEX = /[$€£¥\s%]/g;
const PARENS_REGEX = /^\((.+)\)$/;
// The group shape in US style: a first group of one to three digits, then
// comma groups of exactly three. A comma counts only in this shape and only
// before the decimal dot, so "13,63" and "1.234,56" are not numbers. A run
// with no comma goes to Number(). Matches the chrome extension's
// number shape test in lib/dr-number/core.js.
const GROUP_SHAPE_REGEX = /^[+-]?\d{1,3}(?:,\d{3})+$/;
// Unicode dash/minus variants normalized to an ASCII "-" before parsing, so a
// leading unusual dash (e.g. a pasted en dash or minus sign) reads as a
// negative sign instead of failing to parse. Matches the chrome extension's
// lib/dr-number/core.js, the source of truth for this behavior.
const DASH_REGEX = /[‐-―−﹘﹣－]/g;

// parameters' default values
const DEFAULT_OFFSET_TOP = -0.5; // in all modes, by default, round to the nearest half order of magnitude
const DEFAULT_NUM_TOP = 1; // in dataset-aware modes, by default, round numbers that are in the top 1 order of magnitude to DEFAULT_OFFSET_TOP

// Internal constants
const VALIDATION_LIMIT = 20; // arbitrarily chosen as a 'sane' limit for the order of magnitude offset (i.e. +-20 orders of magnitude)

/**
 * Dynamic rounding against each number's order of magnitude.
 * [MODE 1] single value: =ROUND_DYNAMIC(value, [offset])
 * [MODE 2] dataset: =ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])
 * [INSTRUCTIONS] HTTPS://github.com/ArieFisher/dynamic-rounding
 * [VERSION] 0.3.2
 *
 * @param {number|Array} values The value or range of values to round.
 * @param {number} offset_top The OoM offset for the single value, or, the numbers in the largest order of magnitude of a dataset (default -0.5).
 * @param {number} offset_other The OoM offset for other magnitudes in a dataset (defaults to matching offset_top).
 * @param {number} num_top How many top orders of magnitude get offset_top (default 1).
 * @return Simplified data.
 * @customfunction
 */
function ROUND_DYNAMIC(values, offset_top, offset_other, num_top) {
  const firstIsArray = Array.isArray(values);

  if (firstIsArray) {
    // Dataset mode: ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])
    return datasetMode(values, offset_top, offset_other, num_top);
  } else {
    // Single mode: ROUND_DYNAMIC(value, [offset])
    return singleValueMode(values, offset_top);
  }
}

/**
 * Single mode: rounds one value based on its own magnitude.
 */
function singleValueMode(value, offset) {
  offset = (offset === undefined || offset === "") ? DEFAULT_OFFSET_TOP : offset;
  validateOffset(offset, "offset");

  if (value === "" || value === null) return "";

  const num = toNumber(value);
  if (num === null) return value; // pass through non-numeric
  if (num === 0) return 0;

  return roundWithOffset(num, offset);
}

/**
 * Dataset mode: rounds an array of values using a set-aware heuristic.
 * Values near the dataset's maximum magnitude are rounded using offset_top,
 * while smaller values are rounded using offset_other.
 */
function datasetMode(range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? DEFAULT_OFFSET_TOP : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? offset_top : offset_other;
  num_top = (num_top === undefined || num_top === "") ? DEFAULT_NUM_TOP : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  // Normalize to 2D array
  if (!Array.isArray(range[0])) {
    range = [range];
  }

  //Parse range to numbers one time...
  const numericRange = range.map(row => row.map(cell => toNumber(cell)));
  // ... then use to:
  //  a. find max magnitude
  const max_mag = findMaxMagnitude(numericRange);
  //  b. round each cell
  return range.map((row, r) =>
    row.map((cell, c) => roundCellSetAware(cell, numericRange[r][c], max_mag, offset_top, offset_other, num_top))
  );
}

/**
 * Finds the maximum magnitude (order of magnitude) in a 2D array of numbers.
 * Assumes input is already parsed via toNumber().
 */
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

/**
 * The number shape test in US style: true when every comma in the run sits
 * in the group shape before the decimal dot, or the run holds no comma.
 */
function isNumberShape(run) {
  const at = run.indexOf(".");
  const whole = at === -1 ? run : run.slice(0, at);
  const fraction = at === -1 ? "" : run.slice(at + 1);
  if (fraction.includes(",")) return false;
  if (!whole.includes(",")) return true;
  return GROUP_SHAPE_REGEX.test(whole);
}

/**
 * Attempts to convert a value to a number.
 * Handles formatted strings with comma groups, currency symbols, etc.
 * Returns the number if successful, null otherwise.
 */
function toNumber(value) {
  if (typeof value === "number") {
    return isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    // Remove common formatting: currency symbols, spaces, percent signs,
    // parentheses for negatives, and normalize unusual dash/minus characters
    // to an ASCII "-" first so they parse as a sign. Then test the comma
    // groups and drop them.
    const cleaned = value.trim()
      .replace(DASH_REGEX, "-")
      .replace(CLEAN_REGEX, "")
      .replace(PARENS_REGEX, "-$1"); // (100) -> -100
    if (cleaned === "") return null;
    if (!isNumberShape(cleaned)) return null;
    const parsed = Number(cleaned.split(",").join(""));
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Validates that offset is within acceptable range.
 * Throws an error if offset is outside -20 to 20.
 */
function validateOffset(offset, paramName) {
  if (offset < -VALIDATION_LIMIT || offset > VALIDATION_LIMIT) {
    throw new Error(paramName + " must be between -" + VALIDATION_LIMIT + " and " + VALIDATION_LIMIT + ", got " + offset);
  }
}
