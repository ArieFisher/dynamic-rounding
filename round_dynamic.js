/**
 * DynamicRounding - Dynamic rounding for readable data sets
 * Version: 0.2.4
 * https://github.com/ArieFisher/dynamicrounding
 * MIT License
 */

// Constants
const CLEAN_REGEX = /[$€£¥,\s]/g;
const PARENS_REGEX = /^\((.+)\)$/;

// parameters' default values
const DEFAULT_OFFSET_TOP = -0.5;
const DEFAULT_OFFSET_OTHER = 0;
const DEFAULT_NUM_TOP = 1;

/**
 * Declarative rounding by order of magnitude.
 * [MODE 1]: single [MODE 2] dataset [MODE 3] dataset-aware single
 * [INSTRUCTIONS] HTTPS://github.com/ArieFisher/dynamicrounding
 * 
 * @return Rounded values.
 * @customfunction
 */
function ROUND_DYNAMIC(value_or_range, offset_or_range, offset_top, offset_other, num_top) {
  const firstIsArray = Array.isArray(value_or_range);
  const secondIsArray = Array.isArray(offset_or_range);

  if (firstIsArray) {
    // Dataset mode: ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])
    return arrayMode(value_or_range, offset_or_range, offset_top, offset_other);
  } else if (secondIsArray) {
    // Dataset-aware single mode: ROUND_DYNAMIC(value, range, [offset_top], [offset_other], [num_top])
    return sortSafeMode(value_or_range, offset_or_range, offset_top, offset_other, num_top);
  } else {
    // Single mode: ROUND_DYNAMIC(value, [offset])
    return singleValueMode(value_or_range, offset_or_range);
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
 * Dataset mode: rounds a range with dataset-aware heuristic.
 */
function arrayMode(range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? DEFAULT_OFFSET_TOP : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? DEFAULT_OFFSET_OTHER : offset_other;
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
 * Dataset-aware single mode: rounds one value with dataset-aware heuristic based on reference range.
 */
function sortSafeMode(value, ref_range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? DEFAULT_OFFSET_TOP : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? DEFAULT_OFFSET_OTHER : offset_other;
  num_top = (num_top === undefined || num_top === "") ? DEFAULT_NUM_TOP : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  // Normalize ref_range to 2D array
  if (!Array.isArray(ref_range)) {
    ref_range = [[ref_range]];
  } else if (!Array.isArray(ref_range[0])) {
    ref_range = [ref_range];
  }

  // OPTIMIZATION: Parse reference range to numbers once
  const numericRefRange = ref_range.map(row => row.map(cell => toNumber(cell)));

  // Find max magnitude from reference range using pre-parsed numbers
  const max_mag = findMaxMagnitude(numericRefRange);

  // Round the single value
  const num = toNumber(value);
  return roundCellSetAware(value, num, max_mag, offset_top, offset_other, num_top);
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

  // Add epsilon (1e-9) to handle floating point inaccuracies
  return Math.round(num / rounding_base + 1e-9) * rounding_base;
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
  if (offset < -20 || offset > 20) {
    throw new Error(paramName + " must be between -20 and 20, got " + offset);
  }
}