/**
 * DynamicRounding - Dynamic rounding for readable data sets
 * Version: 0.2.7
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 */

// Constants
const CLEAN_REGEX = /[$€£¥,\s]/g;
const PARENS_REGEX = /^\((.+)\)$/;

// parameters' default values
const DEFAULT_OFFSET_TOP = -0.5; // in all modes, by default, round to the nearest half order of magnitude
const DEFAULT_NUM_TOP = 1; // in dataset-aware modes, by default, round numbers that are in the top 1 order of magnitude to DEFAULT_OFFSET_TOP

// Internal constants
const VALIDATION_LIMIT = 20; // arbitrarily chosen as a 'sane' limit for the order of magnitude offset (i.e. +-20 orders of magnitude)
const EPSILON = 1e-9; // used to handle floating point inaccuracies

/**
 * Declarative rounding by order of magnitude.
 * [MODE 1] single value: =ROUND_DYNAMIC(value, [offset])
 * [MODE 2] dataset: =ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])
 * [INSTRUCTIONS] HTTPS://github.com/ArieFisher/dynamic-rounding
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
 * Rounds a cell with set-aware heuristic.
 * Uses pre-parsed number to avoid redundant parsing.
 */
function roundCellSetAware(value, num, max_mag, offset_top, offset_other, num_top) {
  if (value === "" || value === null) return "";

  if (num === null) return value; // pass through non-numeric
  if (num === 0) return 0;

  const current_mag = Math.floor(Math.log10(Math.abs(num)));

  // Select offset based on proximity to max magnitude
  let offset = offset_other;
  if (max_mag !== null && (max_mag - current_mag) < num_top) {
    offset = offset_top;
  }

  return roundWithOffset(num, offset);
}

/**
 * Rounds a number using the offset model.
 * 
 * offset = OoM offset + optional fraction
 *   0 = current OoM
 *   -1 = one OoM finer
 *   1 = one OoM coarser
 *   0.5 = half of current OoM (same as -0.5)
 *   -1.5 = half of one OoM finer
 */
function roundWithOffset(num, offset) {
  const current_mag = Math.floor(Math.log10(Math.abs(num)));

  // Decompose offset into integer part and fraction
  const oom_offset = Math.trunc(offset);
  // If offset is integer, fraction becomes 0 || 1 (default multiplier)
  const fraction = Math.abs(offset - oom_offset) || 1;

  const target_mag = current_mag + oom_offset;
  const rounding_base = Math.pow(10, target_mag) * fraction;

  // Add epsilon to handle floating point inaccuracies
  return Math.round(num / rounding_base + EPSILON) * rounding_base;
}

/**
 * Attempts to convert a value to a number.
 * Handles formatted strings with commas, currency symbols, etc.
 * Returns the number if successful, null otherwise.
 */
function toNumber(value) {
  if (typeof value === "number") {
    return isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    // Remove common formatting: currency symbols, commas, spaces, parentheses for negatives
    let cleaned = value.trim()
      .replace(CLEAN_REGEX, "")
      .replace(PARENS_REGEX, "-$1"); // (100) -> -100
    const parsed = Number(cleaned);
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