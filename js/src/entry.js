// The Sheets entry source: the code only the Google Sheets library holds.
// scripts/build-sheets.js joins it after the shared library files it lists,
// so every other name here (the number reader, the classification ladder,
// the table step, the rounding) comes from chrome-extension/lib.

// parameters' default values
const DEFAULT_OFFSET_TOP = -0.5; // in all modes, by default, round to the nearest half order of magnitude
const DEFAULT_NUM_TOP = 1; // in dataset-aware modes, by default, round numbers that are in the top 1 order of magnitude to DEFAULT_OFFSET_TOP

// Settings
// The result kind: what a text cell that holds one number returns, a pure
// cell ("$1,011", "12.5%") or a bracketed number ("(1,234)").
//   'text'   returns the write-back's text, "$1,000": the typed sign stays.
//   'number' returns the rounded value, 1000: the typed sign goes.
// A cell with words or a unit number returns text under both values.
const RESULT_KIND = 'text';

// The classification ladder's options, fixed: the Sheets function takes no
// switches. Numbers inside text, mixed currency, and mixed percent round, as
// the extension's defaults do. Dates and times stay as written, so the table
// step never receives a date or a time cell. The first row and the first
// column round, so the whole dataset rounds.
const SHEETS_LADDER_OPTIONS = Object.freeze({
  simplifyFirstRow: true,
  simplifyFirstColumn: true,
  simplifyMixedCells: true,
  simplifyMixedCurrency: true,
  simplifyMixedPercent: true,
  simplifyDates: false,
  simplifyTimes: false,
});

/**
 * Dynamic rounding against each number's order of magnitude.
 * [MODE 1] single value: =ROUND_DYNAMIC(value, [offset])
 * [MODE 2] dataset: =ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])
 * [INSTRUCTIONS] HTTPS://github.com/ArieFisher/dynamic-rounding
 * [VERSION] 0.3.4
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
 * Single mode: rounds one value based on its own magnitude. A text value
 * takes the same path as a one-cell dataset, rounded at the one offset.
 */
function singleValueMode(value, offset) {
  offset = (offset === undefined || offset === "") ? DEFAULT_OFFSET_TOP : offset;
  validateOffset(offset, "offset");
  const settings = { offsetTop: offset, offsetOther: offset, numTop: DEFAULT_NUM_TOP };
  return roundValues([[value]], settings)[0][0];
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
  return roundValues(range, { offsetTop: offset_top, offsetOther: offset_other, numTop: num_top });
}

/**
 * The Sheets input step: sort each value by its type, round the dataset,
 * and return each cell as a value Sheets writes.
 *   number      a finite one rounds and returns a number; one that is not
 *               finite returns unchanged
 *   text        the classification ladder reads it, the table step rounds
 *               it, and the text returns with its patches applied
 *   "" or null  returns ""
 *   anything else (a date, a boolean) returns unchanged
 * The max magnitude spans every number in the range: the number cells and
 * every number the ladder reads in a text cell.
 */
function roundValues(range, settings) {
  const numberEntries = [];
  const textEntries = [];
  range.forEach((row, r) => row.forEach((value, c) => {
    if (typeof value === "number" && isFinite(value)) {
      numberEntries.push({ r, c, info: { mode: "pure", num: value } });
    } else if (typeof value === "string" && value !== "") {
      const decision = classifyCell({ text: value, rowIndex: r, columnIndex: c, ranges: null },
        SHEETS_LADDER_OPTIONS);
      textEntries.push({ r, c, text: value, col: c, info: decisionToLegacyInfo(decision) });
    }
  }));
  const maxMag = datasetMaxMagnitude(numberEntries.concat(textEntries));
  const roundNumber = (num) => roundCellSetAware(num, num, maxMag,
    settings.offsetTop, settings.offsetOther, settings.numTop);

  const results = new Map();
  for (const { r, c, info } of numberEntries) {
    results.set(r + "," + c, roundNumber(info.num));
  }
  for (const { entry, patches } of tablePatches(textEntries, settings, maxMag).cells) {
    results.set(entry.r + "," + entry.c, textResult(entry, patches, roundNumber));
  }
  return range.map((row, r) => row.map((value, c) => {
    const key = r + "," + c;
    if (results.has(key)) return results.get(key);
    return value === "" || value === null ? "" : value;
  }));
}

/**
 * A text cell's result under the result kind. Under 'number', a pure cell or
 * a bracketed number returns its rounded value; every other text cell
 * returns its text with the patches applied.
 */
function textResult(entry, patches, roundNumber) {
  if (RESULT_KIND === "number") {
    if (entry.info.mode === "pure") return roundNumber(entry.info.num);
    const bracketed = entry.info.mode === "extracted" ? matchBracketedNumber(entry.text) : null;
    if (bracketed) return roundNumber(bracketed.num);
  }
  return applyPatches(entry.text, patches);
}

/**
 * Apply a cell's patches to its text, last patch first, so each earlier
 * patch's position still counts into the text as the ladder read it.
 */
function applyPatches(text, patches) {
  return patches
    .slice()
    .sort((a, b) => b.index - a.index)
    .reduce((out, p) => out.slice(0, p.index) + p.newNum + out.slice(p.index + p.numStr.length), text);
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
