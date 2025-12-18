/**
 * DynamicRounding - Dynamic rounding for readable data sets
 * https://github.com/ArieFisher/dynamicrounding
 * MIT License
 */

/**
 * Rounds numbers dynamically based on magnitude, with finer grain for top-tier values.
 * Numeric strings are parsed and rounded. Non-numeric values pass through unchanged.
 *
 * @param {A1:A12} value Values to round. Can be a single cell or range.
 * @param {A1:A12} ref_range Optional. Reference range for max magnitude detection. Use absolute refs ($A$1:$A$12) for sort-safe per-cell formulas. If omitted, uses value range.
 * @param {.25} grain_top The biggest numbers will round to this fraction of the top magnitude. Default 0.25 (quarter-magnitude) for accuracy.
 * @param {.5} grain_other All other numbers will round to this fraction of their magnitude. Default 0.5 (half-magnitude for readability).
 * @param {1} num_top_orders How many of the top orders of magnitude get grain_top. Default 1.
 * @return {number[]} Rounded values (numbers rounded, non-numeric passed through).
 * @customfunction
 */
function ROUND_DYNAMIC(value, ref_range, grain_top, grain_other, num_top_orders) {
  // Detect if ref_range is actually grain_top (backward compatibility)
  // If second param is a number, shift parameters
  if (typeof ref_range === "number") {
    num_top_orders = grain_other;
    grain_other = grain_top;
    grain_top = ref_range;
    ref_range = null;
  }

  // Defaults
  grain_top = (grain_top === undefined || grain_top === "") ? 0.25 : grain_top;
  grain_other = (grain_other === undefined || grain_other === "") ? 0.5 : grain_other;
  num_top_orders = (num_top_orders === undefined || num_top_orders === "") ? 1 : num_top_orders;

  // Validate parameters
  const validation = validateParams(grain_top, grain_other, num_top_orders);
  if (validation.error) {
    return validation.error;
  }
  grain_top = validation.grain_top;
  grain_other = validation.grain_other;
  num_top_orders = validation.num_top_orders;

  // Normalize value to 2D array
  if (!Array.isArray(value)) {
    value = [[value]];
  } else if (!Array.isArray(value[0])) {
    value = [value];
  }

  // Use ref_range for magnitude detection if provided, otherwise use value
  let mag_source = ref_range || value;
  if (!Array.isArray(mag_source)) {
    mag_source = [[mag_source]];
  } else if (!Array.isArray(mag_source[0])) {
    mag_source = [mag_source];
  }

  // Find max magnitude across reference range
  let max_magnitude = null;
  for (let row of mag_source) {
    for (let cell of row) {
      const num = toNumber(cell);
      if (num !== null && num !== 0 && isFinite(num)) {
        const exp = Math.floor(Math.log10(Math.abs(num)));
        if (max_magnitude === null || exp > max_magnitude) {
          max_magnitude = exp;
        }
      }
    }
  }

  // Round each cell
  const result = value.map(row =>
    row.map(cell => roundCell(cell, grain_top, grain_other, num_top_orders, max_magnitude))
  );

  return result;
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
 * Validates and parses parameters.
 * Returns object with parsed values or error message.
 */
function validateParams(grain_top, grain_other, num_top_orders) {
  // Validate grain_top
  if (typeof grain_top !== "number") {
    return { error: "#ERROR: grain_top must be a number, got: " + grain_top };
  }
  if (grain_top <= 0) {
    return { error: "#ERROR: grain_top must be greater than 0, got: " + grain_top };
  }
  if (grain_top > 1) {
    return { error: "#ERROR: grain_top must be between 0 and 1, got: " + grain_top };
  }

  // Validate grain_other
  if (typeof grain_other !== "number") {
    return { error: "#ERROR: grain_other must be a number, got: " + grain_other };
  }
  if (grain_other <= 0) {
    return { error: "#ERROR: grain_other must be greater than 0, got: " + grain_other };
  }
  if (grain_other > 1) {
    return { error: "#ERROR: grain_other must be between 0 and 1, got: " + grain_other };
  }

  // Validate num_top_orders
  if (typeof num_top_orders !== "number") {
    return { error: "#ERROR: num_top_orders must be a number, got: " + num_top_orders };
  }
  if (num_top_orders < 1 || !Number.isInteger(num_top_orders)) {
    return { error: "#ERROR: num_top_orders must be a positive integer, got: " + num_top_orders };
  }

  return { grain_top: grain_top, grain_other: grain_other, num_top_orders: num_top_orders };
}

/**
 * Rounds a single value using magnitude-aware logic.
 */
function roundCell(value, grain_top, grain_other, num_top_orders, max_magnitude) {
  // Handle empty
  if (value === "" || value === null) {
    return "";
  }
  
  // Attempt to parse as number
  const num = toNumber(value);
  if (num === null) {
    return value; // Pass through non-numeric unchanged
  }
  if (num === 0) {
    return 0;
  }

  const abs_val = Math.abs(num);
  const current_exponent = Math.floor(Math.log10(abs_val));

  // Select grain based on proximity to max magnitude
  let grain = grain_other;
  if (max_magnitude !== null && (max_magnitude - current_exponent) < num_top_orders) {
    grain = grain_top;
  }

  const magnitude = Math.pow(10, current_exponent);
  const rounding_base = grain * magnitude;
  
  return Math.sign(num) * Math.round(abs_val / rounding_base) * rounding_base;
}
