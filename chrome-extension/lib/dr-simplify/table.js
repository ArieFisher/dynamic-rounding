// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The table step: the three steps that run over a whole table after the
 * classification ladder has read every cell, and before any write.
 *
 *   1. The column post-pass settles each ambiguous date against its
 *      column's format hint.
 *   2. The max magnitude comes from the numbers of the extracted cells
 *      passed in, since a date or time adds none, unless the caller passes
 *      one.
 *   3. Each cell's numbers, dates, and times round and become patches.
 *
 * Core layer: reads no page and calls no Chrome. It depends only on
 * lib/dr-number's bare names and the ladder's pickDateFormatHint and
 * resolveAmbiguousDateDecision, loaded ahead of this file.
 *
 * The step reads one entry per classified cell. An entry is any object
 * carrying:
 *   text         the classified text (a simplified cell's stored original)
 *   decision     the ladder's decision (classifyCell)
 *   columnIndex  the cell's grid column, by which the column post-pass
 *                groups cells
 * The step copies every other field through untouched, so a caller can carry
 * its own per-cell data beside them.
 */

function isAmbiguousDateDecision(decision) {
  return decision.pending === 'ambiguous-date';
}

// The column post-pass: resolve each ambiguous date against its column's
// format hint. It groups cells by grid column, so a merged cell cannot split
// one column into two groups that read 7/4/99 as July in one row and April in
// another.
function resolveAmbiguousDates(entries) {
  const ambiguousDatesByCol = new Map();
  for (const { decision, columnIndex } of entries) {
    if (!isAmbiguousDateDecision(decision)) continue;
    if (!ambiguousDatesByCol.has(columnIndex)) ambiguousDatesByCol.set(columnIndex, []);
    ambiguousDatesByCol.get(columnIndex).push(...decision.value.dates.filter(isAmbiguousDate));
  }
  const hintByCol = new Map(Array.from(ambiguousDatesByCol,
    ([columnIndex, ambiguousDates]) => [columnIndex, pickDateFormatHint(ambiguousDates)]));
  return entries.map((entry) => {
    if (!isAmbiguousDateDecision(entry.decision)) return entry;
    const decision = resolveAmbiguousDateDecision(entry.decision, hintByCol.get(entry.columnIndex));
    return Object.assign({}, entry, { decision });
  });
}

// passedMaxMag when the caller passes one, else the max magnitude over each
// number of every extracted cell in entries; a date or time cell adds none.
function datasetMaxMagnitude(entries, passedMaxMag) {
  if (passedMaxMag != null) return passedMaxMag;
  const allNums = [];
  for (const { decision } of entries) {
    if (decision.mode === 'extracted') {
      for (const m of decision.value.matches) allNums.push(m.num);
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
function classifiedCellPatches(entry, maxMag, settings) {
  const { text, decision } = entry;
  const { offsetTop, offsetOther, numTop } = settings;
  if (decision.mode === 'date' || decision.mode === 'time') {
    const trimmed = text.trim();
    const lead = text.length - text.trimStart().length;
    const rounded = decision.mode === 'date'
      ? roundDateText(trimmed, settings.dateGranularity, decision.value.dates)
      : roundTimeText(trimmed, settings.timeGranularity);
    if (rounded === null || rounded === trimmed) return [];
    return [{ index: lead, numStr: trimmed, newNum: rounded }];
  }
  if (decision.mode === 'extracted') {
    const patches = [];
    for (const m of decision.value.matches) {
      const rounded = roundValueSetAware(m.num, maxMag, offsetTop, offsetOther, numTop);
      const newNum = formatNumber(rounded, m.numStr);
      if (newNum !== m.numStr) patches.push({ index: m.index, numStr: m.numStr, newNum });
    }
    return patches;
  }
  return [];
}

/**
 * The table step (see the file header).
 *
 * @param {object[]} entries - One entry per classified cell, in page order,
 *   each carrying text, decision, and columnIndex.
 * @param {{offsetTop: number, offsetOther: number, numTop: number,
 *          dateGranularity: string, timeGranularity: string}} settings -
 *   Resolved offsets and num_top, and the date and time granularity.
 * @param {number|null} [passedMaxMag] - A max magnitude the caller holds:
 *   the table's magnitude freeze in the extension, or the max magnitude over
 *   the dataset in Sheets, number cells included. When given, the step
 *   rounds against it and computes none of its own.
 * @returns {{maxMag: number|null,
 *            cells: Array<{entry: object, patches: object[]}>}}
 *   cells holds one result per entry, in input order: the entry after the
 *   column post-pass, and its patches in the classified text.
 */
function tablePatches(entries, settings, passedMaxMag) {
  const resolved = resolveAmbiguousDates(entries);
  const maxMag = datasetMaxMagnitude(resolved, passedMaxMag);
  const cells = resolved.map((entry) =>
    ({ entry, patches: classifiedCellPatches(entry, maxMag, settings) }));
  return { maxMag, cells };
}
