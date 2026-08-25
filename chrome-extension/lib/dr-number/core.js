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

// Constants owned by the coercion + magnitude layer.
const CLEAN_REGEX = /[$€£¥,\s%]/g;
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
