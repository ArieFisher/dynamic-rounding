/**
 * DynamicRounding shared rounding helpers
 *
 * Loaded by both content.js (page context, via manifest content_scripts) and
 * sidebar.js (extension side-panel context, via <script> tag). Must remain
 * framework-free and side-effect-free: no chrome.*, no DOM access. All
 * symbols land on the global object of whichever script loads this file.
 */

const EPSILON = 1e-9;
// Threshold for the "no-coarser-than-x" floor in half-step rounding. When the
// integer part of a half-step offset has |trunc(offset)| >= X_FLOOR_THRESHOLD,
// the result is also floored at roundWithOffset(|num|, trunc(offset)).
const X_FLOOR_THRESHOLD = 1;

function roundWithOffset(num, offset) {
  if (num === 0) return 0;

  const sign = num < 0 ? -1 : 1;
  const absnum = Math.abs(num);
  const current_mag = Math.floor(Math.log10(absnum));

  let target_mag;
  let step;
  if (Number.isInteger(offset)) {
    target_mag = current_mag + offset;
    step = Math.pow(10, target_mag);
  } else {
    target_mag = current_mag + Math.ceil(offset);
    const f = Math.abs(offset - Math.trunc(offset));
    step = f * Math.pow(10, target_mag);
  }

  const raw = Math.round(absnum / step + EPSILON) * step;
  const floor_oom = Math.pow(10, current_mag);
  let result = Math.max(raw, floor_oom);

  if (!Number.isInteger(offset) && Math.abs(Math.trunc(offset)) >= X_FLOOR_THRESHOLD) {
    const x_int = Math.trunc(offset);
    const floor_x = roundWithOffset(absnum, x_int);
    result = Math.max(result, floor_x);
  }

  if (result >= 10 || result % 1 === 0) {
    result = Math.round(result);
  }

  // Strip IEEE-754 float noise from sub-unit steps (e.g. 11 * 0.1 = 1.1000…01).
  result = Number(result.toPrecision(12));

  return sign * result;
}

function roundCellSetAware(value, num, max_mag, offset_top, offset_other, num_top) {
  if (value === "" || value === null) return "";

  if (num === null) return value;
  if (num === 0) return 0;

  const current_mag = Math.floor(Math.log10(Math.abs(num)));

  let offset = offset_other;
  if (max_mag !== null && (max_mag - current_mag) < num_top) {
    offset = offset_top;
  }

  return roundWithOffset(num, offset);
}

/**
 * Compute the step that roundWithOffset would use for the given num + offset.
 * Used by the sidebar preview band to render "(5k)" / "(0.25)" alongside the
 * rounded value, without duplicating the rounding formula.
 */
function stepForOffset(num, offset) {
  if (num === 0) return 0;
  const current_mag = Math.floor(Math.log10(Math.abs(num)));
  if (Number.isInteger(offset)) {
    return Math.pow(10, current_mag + offset);
  }
  const f = Math.abs(offset - Math.trunc(offset));
  return f * Math.pow(10, current_mag + Math.ceil(offset));
}

/**
 * Human-readable step label for the preview band.
 *   5000     -> "5k"
 *   500      -> "500"
 *   2500000  -> "2.5M"
 *   2.5      -> "2.5"
 *   0.25     -> "0.25"
 */
function formatStep(step) {
  if (!isFinite(step) || step === 0) return "0";
  const abs = Math.abs(step);
  if (abs >= 1e9) return trimNum(step / 1e9) + "B";
  if (abs >= 1e6) return trimNum(step / 1e6) + "M";
  if (abs >= 1e3) return trimNum(step / 1e3) + "k";
  if (abs >= 1) return trimNum(step);
  // Sub-integer: show as a decimal, dropping any trailing zeros.
  return trimNum(step);
}

function trimNum(n) {
  // Up to 3 significant digits, but avoid scientific notation for the values
  // formatStep actually produces (steps are powers of 10 or half-decades).
  const rounded = Math.round(n * 1000) / 1000;
  let s = String(rounded);
  if (s.indexOf("e") !== -1) {
    s = rounded.toFixed(10);
  }
  // Trim trailing zeros after a decimal point.
  if (s.indexOf(".") !== -1) {
    s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return s;
}
