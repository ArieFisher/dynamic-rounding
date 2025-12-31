/**
 * DynamicRounding - Dynamic rounding for readable data sets
 * Version: 0.2.3
 * https://github.com/ArieFisher/dynamicrounding
 * MIT License
 */

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
  offset = (offset === undefined || offset === "") ? -0.5 : offset;
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
  offset_top = (offset_top === undefined || offset_top === "") ? -0.5 : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? 0 : offset_other;
  num_top = (num_top === undefined || num_top === "") ? 1 : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  // Normalize to 2D array
  if (!Array.isArray(range[0])) {
    range = [range];
  }

  // Find max magnitude
  const max_mag = findMaxMagnitude(range);

  // Round each cell
  return range.map(row =>
    row.map(cell => roundCellSetAware(cell, max_mag, offset_top, offset_other, num_top))
  );
}

/**
 * Dataset-aware single mode: rounds one value with dataset-aware heuristic based on reference range.
 */
function sortSafeMode(value, ref_range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? -0.5 : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? 0 : offset_other;
  num_top = (num_top === undefined || num_top === "") ? 1 : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  // Normalize ref_range to 2D array
  if (!Array.isArray(ref_range)) {
    ref_range = [[ref_range]];
  } else if (!Array.isArray(ref_range[0])) {
    ref_range = [ref_range];
  }

  // Find max magnitude from reference range
  const max_mag = findMaxMagnitude(ref_range);

  // Round the single value
  return roundCellSetAware(value, max_mag, offset_top, offset_other, num_top);
}

/**
 * Finds the maximum magnitude (order of magnitude) in a 2D array.
 */
function findMaxMagnitude(range) {
  let max_mag = null;
  for (let row of range) {
    for (let cell of row) {
      const num = toNumber(cell);
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
 */
function roundCellSetAware(value, max_mag, offset_top, offset_other, num_top) {
  if (value === "" || value === null) return "";

  const num = toNumber(value);
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
  const fraction = Math.abs(offset - oom_offset) || 1;

  const target_mag = current_mag + oom_offset;
  const rounding_base = Math.pow(10, target_mag) * fraction;

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
      .replace(/[$€£¥,\s]/g, "")
      .replace(/^\((.+)\)$/, "-$1"); // (100) -> -100
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