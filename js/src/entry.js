// The Sheets entry source: the code only the Google Sheets library holds.
// scripts/build-sheets.js joins it after the shared library files it lists,
// so every other name here (the number reader, the classification ladder,
// the table step, the rounding) comes from chrome-extension/lib.

const DEFAULT_OFFSET_TOP = -0.5;
const DEFAULT_NUM_TOP = 1;

// The result kind: what a text cell that holds one number returns, a pure
// cell ("$1,011", "12.5%") or a bracketed number ("(1,234)").
//   'text'   returns the write-back's text, "$1,000": the typed sign stays.
//   'number' returns the rounded value, 1000: the typed sign goes.
// A cell with words or a unit number returns text under both values.
const RESULT_KIND = 'text';

// The classification ladder's options, fixed: the Sheets function takes no
// switches. Mixed currency and mixed percent round, as the extension's
// defaults do. Dates and times stay as written, so the table
// step never receives a date or a time cell. The first row and the first
// column round, so the whole dataset rounds.
const SHEETS_LADDER_OPTIONS = Object.freeze({
  simplifyFirstRow: true,
  simplifyFirstColumn: true,
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
 * [VERSION] 0.5.21
 *
 * @param {number|Array} values The value or range of values to round.
 * @param {number} offset_top The OoM offset for the single value, or, the numbers in the largest order of magnitude of a dataset (default -0.5).
 * @param {number} offset_other The OoM offset for other magnitudes in a dataset (defaults to matching offset_top).
 * @param {number} num_top How many top orders of magnitude get offset_top (default 1).
 * @return Simplified data.
 * @customfunction
 */
function ROUND_DYNAMIC(values, offset_top, offset_other, num_top) {
  return Array.isArray(values)
    ? datasetMode(values, offset_top, offset_other, num_top)
    : singleValueMode(values, offset_top);
}

function orDefault(value, fallback) {
  return value === undefined || value === "" ? fallback : value;
}

/**
 * Single mode: rounds one value against its own order of magnitude. A text
 * value takes the same path as a one-cell dataset, rounded at the one offset.
 */
function singleValueMode(value, offset) {
  offset = orDefault(offset, DEFAULT_OFFSET_TOP);
  validateOffset(offset, "offset");
  const settings = { offsetTop: offset, offsetOther: offset, numTop: DEFAULT_NUM_TOP };
  return roundValues([[value]], settings)[0][0];
}

/**
 * Dataset mode: rounds a dataset set-aware. Values in the top band round at
 * offset_top, and values in the other band at offset_other.
 */
function datasetMode(dataset, offset_top, offset_other, num_top) {
  offset_top = orDefault(offset_top, DEFAULT_OFFSET_TOP);
  offset_other = orDefault(offset_other, offset_top);
  num_top = orDefault(num_top, DEFAULT_NUM_TOP);
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  if (!Array.isArray(dataset[0])) {
    dataset = [dataset];
  }
  return roundValues(dataset, { offsetTop: offset_top, offsetOther: offset_other, numTop: num_top });
}

/**
 * The Sheets input step: sort each value by its type, round the dataset,
 * and return each cell as a value Sheets writes.
 *   number      a finite one rounds and returns a number; one that is not
 *               finite returns unchanged
 *   text        the classification ladder reads it, the table step rounds
 *               it, and the text returns with its patches applied, or as
 *               a number under the result kind 'number' (see RESULT_KIND)
 *   "" or null  returns ""
 *   anything else (a date, a boolean) returns unchanged
 * The max magnitude spans every number in the dataset: the number cells and
 * every number the ladder reads in a text cell.
 */
function roundValues(dataset, settings) {
  const numberCells = [];
  const textCells = [];
  dataset.forEach((row, r) => row.forEach((value, c) => {
    if (typeof value === "number" && isFinite(value)) {
      numberCells.push({ r, c, num: value, classification: { stretches: [{ kind: "number", num: value }] } });
    } else if (typeof value === "string" && value !== "") {
      const classification = classifyCell({ text: value, rowIndex: r, columnIndex: c, ranges: null },
        SHEETS_LADDER_OPTIONS);
      textCells.push({ r, columnIndex: c, text: value, classification });
    }
  }));
  const maxMag = datasetMaxMagnitude(numberCells.concat(textCells));
  const roundNumber = (num) => roundValueSetAware(num, maxMag,
    settings.offsetTop, settings.offsetOther, settings.numTop);

  const results = dataset.map((row) => row.map((value) => (value === null ? "" : value)));
  for (const { r, c, num } of numberCells) {
    results[r][c] = roundNumber(num);
  }
  const { patchedCells } = tablePatches(textCells, settings, maxMag);
  for (const { classifiedCell, patches } of patchedCells) {
    results[classifiedCell.r][classifiedCell.columnIndex] = textResult(classifiedCell, patches, roundNumber);
  }
  return results;
}

// A text cell's result under the result kind (see RESULT_KIND).
function textResult(classifiedCell, patches, roundNumber) {
  if (RESULT_KIND === "number" && classifiedCell.classification.stretches.some((stretch) => stretch.kind === "number")) {
    const bracketed = matchBracketedNumber(classifiedCell.text);
    const num = bracketed ? bracketed.num : toNumber(classifiedCell.text);
    if (num !== null) return roundNumber(num);
  }
  return applyPatches(classifiedCell.text, patches);
}

function validateOffset(offset, paramName) {
  if (offset < -VALIDATION_LIMIT || offset > VALIDATION_LIMIT) {
    throw new Error(paramName + " must be between -" + VALIDATION_LIMIT + " and " + VALIDATION_LIMIT + ", got " + offset);
  }
}
