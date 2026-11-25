// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The table step: the three steps that run over a whole table after the
 * classification ladder has read every cell, and before any write.
 *
 *   1. The column post-pass settles each ambiguous date against its
 *      column's format hint.
 *   2. The max magnitude is the one the caller passes, or else the largest
 *      order of magnitude among the extracted cells' numbers; the step
 *      counts no date or time.
 *   3. Each cell's numbers, dates, and times round and become patches.
 *
 * Core layer: reads no page and calls no Chrome. It depends only on
 * lib/dr-number's bare names and the ladder's pickDateFormatHint and
 * resolveAmbiguousDateClassification, loaded ahead of this file.
 *
 * The step reads one classified cell per cell. A classified cell is any
 * object carrying:
 *   text            the text the ladder classified
 *   classification  the ladder's classification (classifyCell)
 *   columnIndex     the cell's grid column
 * The step copies every other field through untouched, so a caller can carry
 * its own per-cell data beside them.
 */

function isAmbiguousDateClassification(classification) {
  return classification.pending === 'ambiguous-date';
}

// The column post-pass. It groups cells by grid column, so a merged cell
// cannot split one column into two groups that read 7/4/99 as July in one row
// and April in another.
function resolveAmbiguousDates(classifiedCells) {
  const ambiguousDatesByCol = new Map();
  for (const { classification, columnIndex } of classifiedCells) {
    if (!isAmbiguousDateClassification(classification)) continue;
    if (!ambiguousDatesByCol.has(columnIndex)) ambiguousDatesByCol.set(columnIndex, []);
    ambiguousDatesByCol.get(columnIndex).push(...classification.value.dates.filter(isAmbiguousDate));
  }
  const hintByCol = new Map(Array.from(ambiguousDatesByCol,
    ([columnIndex, ambiguousDates]) => [columnIndex, pickDateFormatHint(ambiguousDates)]));
  return classifiedCells.map((classifiedCell) => {
    if (!isAmbiguousDateClassification(classifiedCell.classification)) return classifiedCell;
    const classification = resolveAmbiguousDateClassification(
      classifiedCell.classification, hintByCol.get(classifiedCell.columnIndex));
    return Object.assign({}, classifiedCell, { classification });
  });
}

function datasetMaxMagnitude(classifiedCells, passedMaxMag) {
  if (passedMaxMag != null) return passedMaxMag;
  const allNums = [];
  for (const { classification } of classifiedCells) {
    if (classification.mode === 'extracted') {
      for (const m of classification.value.matches) allNums.push(m.num);
    }
  }
  return findMaxMagnitude([allNums]);
}

// One cell's patches, positioned in the classified text: empty for a skip
// cell or an unchanged value. A date or time cell takes one patch over its
// trimmed text, so the text keeps its own whitespace. An extracted cell takes
// one patch per number whose written digits differ from the match, which
// catches a number that is unchanged but whose display simplifies (e.g.
// "35.0" to "35").
function classifiedCellPatches(classifiedCell, maxMag, settings) {
  const { text, classification } = classifiedCell;
  const { offsetTop, offsetOther, numTop } = settings;
  if (classification.mode === 'date' || classification.mode === 'time') {
    const trimmed = text.trim();
    const lead = text.length - text.trimStart().length;
    const rounded = classification.mode === 'date'
      ? roundDateText(trimmed, settings.dateGranularity, classification.value.dates)
      : roundTimeText(trimmed, settings.timeGranularity);
    if (rounded === null || rounded === trimmed) return [];
    return [{ index: lead, numStr: trimmed, newNum: rounded }];
  }
  if (classification.mode === 'extracted') {
    const patches = [];
    for (const m of classification.value.matches) {
      const rounded = roundValueSetAware(m.num, maxMag, offsetTop, offsetOther, numTop);
      const newNum = formatNumber(rounded, m.numStr);
      if (newNum !== m.numStr) patches.push({ index: m.index, numStr: m.numStr, newNum });
    }
    return patches;
  }
  return [];
}

/**
 * The table step (see the file header). settings holds the resolved
 * offsetTop, offsetOther, and numTop, and the dateGranularity and
 * timeGranularity. When passedMaxMag is neither null nor undefined, the step
 * rounds against it and computes none: the extension passes the table's
 * magnitude freeze, and Sheets the max magnitude over the dataset, number
 * cells included.
 *
 * @returns {{maxMag: number|null,
 *            patchedCells: Array<{classifiedCell: object, patches: object[]}>}}
 *   One patched cell per classified cell, in input order: the classified
 *   cell after the column post-pass, and its patches in the classified text.
 */
function tablePatches(classifiedCells, settings, passedMaxMag) {
  const resolved = resolveAmbiguousDates(classifiedCells);
  const maxMag = datasetMaxMagnitude(resolved, passedMaxMag);
  const patchedCells = resolved.map((classifiedCell) =>
    ({ classifiedCell, patches: classifiedCellPatches(classifiedCell, maxMag, settings) }));
  return { maxMag, patchedCells };
}

// Apply patches to a text, last patch first, so the positions of the earlier
// patches stay valid. For a caller with no page: the extension writes through
// the patch writer, one text piece at a time.
function applyPatches(text, patches) {
  return patches
    .slice()
    .sort((a, b) => b.index - a.index)
    .reduce((out, p) => out.slice(0, p.index) + p.newNum + out.slice(p.index + p.numStr.length), text);
}
