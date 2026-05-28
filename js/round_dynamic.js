/**
 * DynamicRounding - Dynamic rounding for readable data sets
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
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
const X_FLOOR_THRESHOLD = 1; // for half-step offsets x.5, also floor at roundWithOffset(value, trunc(offset)) when |trunc(offset)| >= this threshold

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
 * Integer offsets:
 *   step = 10^(current_mag + offset)
 *     0  = current OoM
 *    -1  = one OoM finer
 *     1  = one OoM coarser
 *
 * Non-integer (fractional) offsets, generalized:
 *   target_mag = current_mag + ceil(offset)
 *   f          = |offset - trunc(offset)|        (fractional magnitude in (0,1))
 *   step       = f * 10^target_mag
 *
 * This yields a sign-aware step for any fractional offset:
 *    -0.5 → step = 0.5 * 10^current_mag       (half of current OoM step)
 *    +0.5 → step = 0.5 * 10^(current_mag+1)   (half of next-coarser OoM step)
 *    +0.25 → step = 0.25 * 10^(current_mag+1)
 *    -0.25 → step = 0.25 * 10^current_mag
 *    +1.25 → step = 0.25 * 10^(current_mag+2)
 *    -1.25 → step = 0.25 * 10^(current_mag-1)
 *
 * After rounding, the result magnitude is floored at 10^current_mag so a
 * value never collapses to zero (Feature 2). For non-integer offsets whose
 * integer part is large enough (|trunc(offset)| >= X_FLOOR_THRESHOLD), the
 * result is also floored at roundWithOffset(value, trunc(offset)) to
 * preserve ordering across magnitudes (Feature 3).
 */
function roundWithOffset(num, offset) {
  if (num === 0) return 0;

  const sign = num < 0 ? -1 : 1;
  const absnum = Math.abs(num);
  const current_mag = Math.floor(Math.log10(absnum));

  const isInteger = Number.isInteger(offset);

  let target_mag, step;
  if (isInteger) {
    target_mag = current_mag + offset;
    step = Math.pow(10, target_mag);
  } else {
    target_mag = current_mag + Math.ceil(offset);
    const f = Math.abs(offset - Math.trunc(offset));
    step = f * Math.pow(10, target_mag);
  }

  // Add epsilon to handle floating point inaccuracies
  const raw = Math.round(absnum / step + EPSILON) * step;

  // Feature 2: floor result at the value's own order of magnitude.
  const floor_oom = Math.pow(10, current_mag);
  let result = Math.max(raw, floor_oom);

  // Feature 3: for non-integer offsets, also floor at the integer-offset result
  // when the integer part is large enough.
  if (!isInteger && Math.abs(Math.trunc(offset)) >= X_FLOOR_THRESHOLD) {
    const x_int = Math.trunc(offset);
    const floor_x = Math.abs(roundWithOffset(absnum, x_int));
    result = Math.max(result, floor_x);
  }

  // Re-apply the float-cleanup the previous implementation did.
  if (result >= 10 || result % 1 === 0) {
    result = Math.round(result);
  }

  return sign * result;
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