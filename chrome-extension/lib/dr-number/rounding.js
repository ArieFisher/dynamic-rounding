// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * DynamicRounding shared rounding helpers: the one copy of the rounding
 * arithmetic. docs/design.md "How the code is shared" lists where it loads,
 * and its rules "The core and the write-back read no source" and "The plugin
 * library is a built copy" state what it may hold. All symbols land on the
 * global scope of whichever script holds this file.
 */

// Through floating-point error, absnum / step can be just below a
// value ending in .5 (1.15 / 0.1 is 11.499999999999998). Without this addition, 1.15 at offset
// -1 returns 1.1, not 1.2.
const EPSILON = 1e-9;
// The smallest abs(trunc(offset)) at which the x-floor applies to a
// fractional offset.
const X_FLOOR_THRESHOLD = 1;

function magnitudeOf(num) {
  return Math.floor(Math.log10(Math.abs(num)));
}

function roundWithOffset(num, offset) {
  if (num === 0) return 0;

  const sign = num < 0 ? -1 : 1;
  const absnum = Math.abs(num);
  const current_mag = magnitudeOf(absnum);
  const step = stepForOffset(absnum, offset);

  const raw = Math.round(absnum / step + EPSILON) * step;
  const floor_oom = Math.pow(10, current_mag);
  let result = Math.max(raw, floor_oom);

  const x_int = Math.trunc(offset);
  if (!Number.isInteger(offset) && Math.abs(x_int) >= X_FLOOR_THRESHOLD) {
    const floor_x = roundWithOffset(absnum, x_int);
    result = Math.max(result, floor_x);
  }

  if (result >= 10) {
    result = Math.round(result);
  }

  // docs/design.md "Results hold at most 12 significant digits".
  result = Number(result.toPrecision(12));

  return sign * result;
}

function roundValueSetAware(num, max_mag, offset_top, offset_other, num_top) {
  const current_mag = magnitudeOf(num);

  let offset = offset_other;
  if (max_mag !== null && (max_mag - current_mag) < num_top) {
    offset = offset_top;
  }

  return roundWithOffset(num, offset);
}

// The step roundWithOffset rounds num to under offset.
function stepForOffset(num, offset) {
  if (num === 0) return 0;
  const current_mag = magnitudeOf(num);
  if (Number.isInteger(offset)) {
    return Math.pow(10, current_mag + offset);
  }
  const f = Math.abs(offset - Math.trunc(offset));
  return f * Math.pow(10, current_mag + Math.ceil(offset));
}

// A step, or the power of ten in an order of magnitude label, as the lens
// preview shows it.
function formatStep(step) {
  if (!isFinite(step)) return "0";
  const abs = Math.abs(step);
  if (abs >= 1e9) return trimNum(step / 1e9) + "B";
  if (abs >= 1e6) return trimNum(step / 1e6) + "M";
  if (abs >= 1e3) return trimNum(step / 1e3) + "k";
  return trimNum(step);
}

function trimNum(n) {
  return String(Math.round(n * 1000) / 1000);
}

function findMaxMagnitude(dataset) {
  let max_mag = null;
  for (const row of dataset) {
    for (const num of row) {
      if (num !== null && num !== 0 && isFinite(num)) {
        const mag = magnitudeOf(num);
        if (max_mag === null || mag > max_mag) {
          max_mag = mag;
        }
      }
    }
  }
  return max_mag;
}
