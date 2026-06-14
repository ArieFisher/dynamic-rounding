/**
 * DynamicRounding domain core (dispatch + coercion layer).
 *
 * Loaded by both content.js (page context, via manifest content_scripts) and
 * sidebar.js (extension side-panel context, via <script> tag), AFTER rounding.js
 * and BEFORE content.js. Must remain framework-free and side-effect-free: no
 * chrome.*, no DOM access. All symbols land on the global object of whichever
 * script loads this file, so both contexts call the same ROUND_DYNAMIC the
 * standalone js/round_dynamic.js implements.
 *
 * The arithmetic primitives (roundWithOffset, roundCellSetAware) live in
 * rounding.js, which must load before this file.
 */

// Constants owned by the core dispatch/coercion layer.
const CLEAN_REGEX = /[$€£¥,\s%]/g;
const PARENS_REGEX = /^\((.+)\)$/;
const DEFAULT_OFFSET_TOP = -0.5;
const DEFAULT_NUM_TOP = 1;
const VALIDATION_LIMIT = 20;

function ROUND_DYNAMIC(values, offset_top, offset_other, num_top) {
  const firstIsArray = Array.isArray(values);

  if (firstIsArray) {
    return datasetMode(values, offset_top, offset_other, num_top);
  } else {
    return singleValueMode(values, offset_top);
  }
}

function singleValueMode(value, offset) {
  offset = (offset === undefined || offset === "") ? DEFAULT_OFFSET_TOP : offset;
  validateOffset(offset, "offset");

  if (value === "" || value === null) return "";

  const num = toNumber(value);
  if (num === null) return value;
  if (num === 0) return 0;

  return roundWithOffset(num, offset);
}

function datasetMode(range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? DEFAULT_OFFSET_TOP : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? offset_top : offset_other;
  num_top = (num_top === undefined || num_top === "") ? DEFAULT_NUM_TOP : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  if (!Array.isArray(range[0])) {
    range = [range];
  }

  const numericRange = range.map(row => row.map(cell => toNumber(cell)));
  const max_mag = findMaxMagnitude(numericRange);

  return range.map((row, r) =>
    row.map((cell, c) => roundCellSetAware(cell, numericRange[r][c], max_mag, offset_top, offset_other, num_top))
  );
}

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
    const parsed = Number(cleaned);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateOffset(offset, paramName) {
  if (offset < -VALIDATION_LIMIT || offset > VALIDATION_LIMIT) {
    throw new Error(paramName + " must be between -" + VALIDATION_LIMIT + " and " + VALIDATION_LIMIT + ", got " + offset);
  }
}
