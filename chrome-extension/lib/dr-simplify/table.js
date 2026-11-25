// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The table step: the three steps that run over a whole table after the
 * classification ladder has read every cell, and before any write.
 *
 *   1. The column post-pass settles each ambiguous date against its
 *      column's format hint.
 *   2. The max magnitude is the one the caller passes, or else the largest
 *      order of magnitude among the number stretches; the step counts no
 *      date or time.
 *   3. Each cell's numbers, dates, and times round and become patches.
 *
 * Core layer: reads no page and calls no Chrome. It depends only on
 * lib/dr-number's bare names and the ladder's pickDateFormatHint, loaded
 * ahead of this file.
 *
 * The step reads one classified cell per cell. A classified cell is any
 * object carrying:
 *   text            the text the ladder classified
 *   classification  the ladder's classification (classifyCell)
 *   columnIndex     the cell's grid column
 * The step copies every other field through untouched, so a caller can carry
 * its own per-cell data beside them.
 */

// A classification that waits for the column post-pass: the data test reads
// it too, to hold such a cell until the post-pass settles its column.
function isAmbiguousDateClassification(classification) {
  return classification.stretches.some((stretch) => stretch.kind === 'date' && isAmbiguousDate(stretch));
}

// The column post-pass. It groups cells by grid column, so a merged cell
// cannot split one column into two groups that read 7/4/99 as July in one row
// and April in another. A month-first or day-first hint gives each ambiguous
// date stretch its day and month. A mixed or ambiguous column cannot be read
// safely, so the post-pass empties the stretch list of each of its cells,
// and a cell never changes some of its dates and holds others.
function resolveAmbiguousDates(classifiedCells) {
  const ambiguousDatesByCol = new Map();
  for (const { classification, columnIndex } of classifiedCells) {
    if (!isAmbiguousDateClassification(classification)) continue;
    if (!ambiguousDatesByCol.has(columnIndex)) ambiguousDatesByCol.set(columnIndex, []);
    ambiguousDatesByCol.get(columnIndex).push(...classification.stretches.filter(isAmbiguousDate));
  }
  const hintByCol = new Map(Array.from(ambiguousDatesByCol,
    ([columnIndex, ambiguousDates]) => [columnIndex, pickDateFormatHint(ambiguousDates)]));
  return classifiedCells.map((classifiedCell) => {
    const { classification, columnIndex } = classifiedCell;
    if (!isAmbiguousDateClassification(classification)) return classifiedCell;
    const hint = hintByCol.get(columnIndex);
    const stretches = hint === 'month-first' || hint === 'day-first'
      ? classification.stretches.map((s) => (isAmbiguousDate(s) ? readAmbiguousDate(s, hint === 'month-first') : s))
      : [];
    return Object.assign({}, classifiedCell, { classification: Object.assign({}, classification, { stretches }) });
  });
}

function readAmbiguousDate(stretch, isMonthFirst) {
  const { year, n1, n2, start, end, n1Cut, n2Cut } = stretch;
  return { kind: 'date', ...knownDate(year, isMonthFirst ? n1 : n2, true, start, end, isMonthFirst ? n2Cut : n1Cut) };
}

function datasetMaxMagnitude(classifiedCells, passedMaxMag) {
  if (passedMaxMag != null) return passedMaxMag;
  const allNums = classifiedCells.flatMap(({ classification }) => classification.stretches
    .filter((stretch) => stretch.kind === 'number').map((stretch) => stretch.num));
  return findMaxMagnitude([allNums]);
}

// One stretch's new text: a number rounds against the max magnitude, and a
// date or a time to its granularity. null for a time the step cannot round.
function roundStretch(text, stretch, written, maxMag, settings) {
  if (stretch.kind === 'date') return roundDate(text, stretch, settings.dateGranularity);
  if (stretch.kind === 'time') return roundTimeText(written, settings.timeGranularity);
  const { offsetTop, offsetOther, numTop } = settings;
  return formatNumber(roundValueSetAware(stretch.num, maxMag, offsetTop, offsetOther, numTop), written);
}

// One cell's patches, positioned in the classified text: one patch per
// stretch whose new text differs from its written text, so a cell with no
// stretch takes none. The comparison also catches a number that is unchanged
// but whose display simplifies (e.g. "35.0" to "35").
function classifiedCellPatches(classifiedCell, maxMag, settings) {
  const { text, classification } = classifiedCell;
  return classification.stretches.flatMap((stretch) => {
    const numStr = text.slice(stretch.start, stretch.end);
    const newNum = roundStretch(text, stretch, numStr, maxMag, settings);
    return newNum === null || newNum === numStr ? [] : [{ index: stretch.start, numStr, newNum }];
  });
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
