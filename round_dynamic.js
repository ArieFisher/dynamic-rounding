/**
 * DynamicRounding - Dynamic rounding for readable data sets
 * Version: 0.2.1
 * https://github.com/ArieFisher/dynamicrounding
 * MIT License
 */

/**
 * Rounds numbers dynamically based on magnitude.
 * 
 * Three modes:
 * - Single-value: =ROUND_DYNAMIC(value, [grain])
 * - Array: =ROUND_DYNAMIC(range, [grain_top], [grain_other], [num_top])
 * - Sort-safe: =ROUND_DYNAMIC(value, range, [grain_top], [grain_other], [num_top])
 *
 * Grain is an order-of-magnitude offset:
 *   0 = current OoM, -1 = one OoM finer, 1 = one OoM coarser
 *   0.5 or -0.5 = half of current OoM
 *   -1.5 = half of one OoM finer
 *
 * @param {A1|A1:A12} value_or_range Values to round.
 * @param {number|A1:A12} [grain_or_range] Single-value: grain (default 0). Sort-safe: reference range.
 * @param {number} [grain_top] Array/sort-safe: grain for top orders (default -0.5).
 * @param {number} [grain_other] Array/sort-safe: grain for other orders (default 0).
 * @param {number} [num_top] Array/sort-safe: how many top orders get grain_top (default 1).
 * @return Rounded values.
 * @customfunction
 */
function ROUND_DYNAMIC(value_or_range, grain_or_range, grain_top, grain_other, num_top) {
  const firstIsArray = Array.isArray(value_or_range);
  const secondIsArray = Array.isArray(grain_or_range);

  if (firstIsArray) {
    // Array mode: ROUND_DYNAMIC(range, [grain_top], [grain_other], [num_top])
    return arrayMode(value_or_range, grain_or_range, grain_top, grain_other);
  } else if (secondIsArray) {
    // Sort-safe mode: ROUND_DYNAMIC(value, range, [grain_top], [grain_other], [num_top])
    return sortSafeMode(value_or_range, grain_or_range, grain_top, grain_other, num_top);
  } else {
    // Single-value mode: ROUND_DYNAMIC(value, [grain])
    return singleValueMode(value_or_range, grain_or_range);
  }
}

/**
 * Single-value mode: rounds one value based on its own magnitude.
 */
function singleValueMode(value, grain) {
  grain = (grain === undefined || grain === "") ? 0 : grain;
  
  if (value === "" || value === null) return "";
  
  const num = toNumber(value);
  if (num === null) return value; // pass through non-numeric
  if (num === 0) return 0;
  
  return roundWithGrain(num, grain);
}

/**
 * Array mode: rounds a range with set-aware heuristic.
 */
function arrayMode(range, grain_top, grain_other, num_top) {
  grain_top = (grain_top === undefined || grain_top === "") ? -0.5 : grain_top;
  grain_other = (grain_other === undefined || grain_other === "") ? 0 : grain_other;
  num_top = (num_top === undefined || num_top === "") ? 1 : num_top;

  // Normalize to 2D array
  if (!Array.isArray(range[0])) {
    range = [range];
  }

  // Find max magnitude
  const max_mag = findMaxMagnitude(range);

  // Round each cell
  return range.map(row =>
    row.map(cell => roundCellSetAware(cell, max_mag, grain_top, grain_other, num_top))
  );
}

/**
 * Sort-safe mode: rounds one value with set-aware heuristic based on reference range.
 */
function sortSafeMode(value, ref_range, grain_top, grain_other, num_top) {
  grain_top = (grain_top === undefined || grain_top === "") ? -0.5 : grain_top;
  grain_other = (grain_other === undefined || grain_other === "") ? 0 : grain_other;
  num_top = (num_top === undefined || num_top === "") ? 1 : num_top;

  // Normalize ref_range to 2D array
  if (!Array.isArray(ref_range)) {
    ref_range = [[ref_range]];
  } else if (!Array.isArray(ref_range[0])) {
    ref_range = [ref_range];
  }

  // Find max magnitude from reference range
  const max_mag = findMaxMagnitude(ref_range);

  // Round the single value
  return roundCellSetAware(value, max_mag, grain_top, grain_other, num_top);
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
function roundCellSetAware(value, max_mag, grain_top, grain_other, num_top) {
  if (value === "" || value === null) return "";
  
  const num = toNumber(value);
  if (num === null) return value; // pass through non-numeric
  if (num === 0) return 0;

  const current_mag = Math.floor(Math.log10(Math.abs(num)));
  
  // Select grain based on proximity to max magnitude
  let grain = grain_other;
  if (max_mag !== null && (max_mag - current_mag) < num_top) {
    grain = grain_top;
  }

  return roundWithGrain(num, grain);
}

/**
 * Rounds a number using the grain-as-offset model.
 * 
 * grain = OoM offset + optional fraction
 *   0 = current OoM
 *   -1 = one OoM finer
 *   1 = one OoM coarser
 *   0.5 = half of current OoM (same as -0.5)
 *   -1.5 = half of one OoM finer
 */
function roundWithGrain(num, grain) {
  const current_mag = Math.floor(Math.log10(Math.abs(num)));
  
  // Decompose grain into offset and fraction
  const oom_offset = Math.trunc(grain);
  const fraction = Math.abs(grain - oom_offset) || 1;
  
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
