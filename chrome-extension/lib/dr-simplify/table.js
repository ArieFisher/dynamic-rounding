/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The table step: the three steps that run over a whole table after the
 * classification ladder has read every cell, and before any write.
 *
 *   1. The column post-pass settles each ambiguous date against its
 *      column's format hint.
 *   2. The max magnitude comes from every number in the dataset, the
 *      numbers inside extracted cells included, unless the caller passes a
 *      frozen one.
 *   3. Each cell's numbers, dates, and times round and become patches.
 *
 * PURE: the step reads plain classified cells and plain settings and returns
 * data. It holds no reference to the page, a text piece, the registry, the
 * log buffer, or the browser. It depends only on DR_NUMBER's bare names and
 * the ladder's pickDateFormatHint and resolveAmbiguousDateDecision, loaded
 * ahead of this file.
 *
 * A classified cell is any object carrying:
 *   text  the text the cell classified (a simplified cell's stored original)
 *   info  the decisionToLegacyInfo shape of the ladder's decision
 *   col   the cell's grid column, which groups the column post-pass
 * The step copies every other field through untouched, so a caller can carry
 * its own per-cell data beside them.
 *
 * Page work stays with the caller: the magnitude freeze a grid keeps across
 * scrolls, the check that a changed date or time does not straddle two text
 * pieces, the link filter, and the write of patches into text pieces. A date
 * or time cell's patch covers its trimmed text, so the patch's index and the
 * length of its numStr are the span the caller's straddle check reads.
 */

// Adapts a classifyCell decision to the { mode, num, dates, ambiguous,
// matches } shape the table step reads in its column post-pass, its max
// magnitude, and its patches.
function decisionToLegacyInfo(decision) {
  if (decision.mode === 'pure') return { mode: 'pure', num: decision.value.num };
  if (decision.mode === 'extracted') return { mode: 'extracted', matches: decision.value.matches };
  if (decision.mode === 'date') {
    return { mode: 'date', dates: decision.value.dates, ambiguous: decision.pending === 'ambiguous-date' };
  }
  if (decision.mode === 'time') return { mode: 'time' };
  return { mode: 'skip' };
}

// The column post-pass: resolve each ambiguous numeric date against its
// column's format hint. Every all-numeric date in the column counts, the
// second date of a cell included. Grouping runs on the grid column each cell carries,
// so one visual column settles one reading for all of its cells — a merge
// inside the table cannot split a column into two groups that read 7/4/99 as
// July in one row and April in another.
function resolveAmbiguousDates(entries) {
  const isAmbiguous = (info) => info.mode === 'date' && info.ambiguous;
  const readingsByCol = new Map();
  for (const { info, col } of entries) {
    if (!isAmbiguous(info)) continue;
    if (!readingsByCol.has(col)) readingsByCol.set(col, []);
    readingsByCol.get(col).push(...info.dates.filter(isAmbiguousDate));
  }
  const hintByCol = new Map(Array.from(readingsByCol, ([col, readings]) => [col, pickDateFormatHint(readings)]));
  return entries.map((entry) => {
    if (!isAmbiguous(entry.info)) return entry;
    const pendingDecision = { value: { dates: entry.info.dates } };
    const info = decisionToLegacyInfo(resolveAmbiguousDateDecision(pendingDecision, hintByCol.get(entry.col)));
    return Object.assign({}, entry, { info });
  });
}

// The max magnitude over the dataset: every pure cell's number and each
// number of an extracted cell, from every row of the table.
function datasetMaxMagnitude(entries) {
  const allNums = [];
  for (const { info } of entries) {
    if (info.mode === 'pure') allNums.push(info.num);
    else if (info.mode === 'extracted') {
      for (const m of info.matches) allNums.push(m.num);
    }
  }
  return findMaxMagnitude([allNums]);
}

// One cell's patches, positioned in the text the cell classified: empty for a
// skip cell or an unchanged value. A date or time cell takes one patch: its
// trimmed text, replaced whole, so the text keeps its own whitespace. Every
// number takes the one write-back, formatNumber, patched in place. A pure
// cell takes one patch over its number span (pureNumberSpan), so its sign,
// currency sign, and percent sign stay where the page put them; the patch
// compares the written digits to the span, which catches a number that is
// unchanged but whose display simplifies (e.g. "35.0" to "35"). An extracted
// cell — a unit number, a stacked cell, or numbers inside words, links, or a
// <sup> — takes one patch per changed number, and linkFilteredIdx holds the
// positions of the numbers the link filter kept.
function classifiedCellPatches(entry, maxMag, settings) {
  const { text, info } = entry;
  const { offsetTop, offsetOther, numTop } = settings;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  const lead = typeof text === 'string' ? text.length - text.trimStart().length : 0;
  if (info.mode === 'date' || info.mode === 'time') {
    const rounded = info.mode === 'date'
      ? roundDateText(trimmed, settings.dateGranularity, info.dates)
      : roundTimeText(trimmed, settings.timeGranularity);
    if (rounded === null || rounded === trimmed) return { patches: [], linkFilteredIdx: null };
    return { patches: [{ index: lead, numStr: trimmed, newNum: rounded }], linkFilteredIdx: null };
  }
  if (info.mode === 'pure') {
    const roundedValue = roundCellSetAware(info.num, info.num, maxMag, offsetTop, offsetOther, numTop);
    const span = pureNumberSpan(text);
    const newNum = formatNumber(roundedValue, span.numStr);
    const patches = newNum === span.numStr ? [] : [{ index: span.index, numStr: span.numStr, newNum }];
    return { patches, linkFilteredIdx: null };
  }
  if (info.mode === 'extracted') {
    const patches = [];
    for (const m of info.matches) {
      const rounded = roundCellSetAware(m.num, m.num, maxMag, offsetTop, offsetOther, numTop);
      const newNum = formatNumber(rounded, m.numStr);
      if (newNum !== m.numStr) patches.push({ index: m.index, numStr: m.numStr, newNum });
    }
    return { patches, linkFilteredIdx: info.matches.map((m) => m.index) };
  }
  return { patches: [], linkFilteredIdx: null };
}

/**
 * The table step (see the file header).
 *
 * @param {object[]} entries - Classified cells in page order, each carrying
 *   text, info, and col.
 * @param {{offsetTop: number, offsetOther: number, numTop: number,
 *          dateGranularity: string, timeGranularity: string}} settings -
 *   Resolved offsets and top-band count, and the date and time granularity.
 * @param {number|null} [frozenMaxMag] - A frozen max magnitude. When given,
 *   the step rounds against it and computes none of its own.
 * @returns {{maxMag: number|null,
 *            cells: Array<{entry: object, patches: object[], linkFilteredIdx: number[]|null}>}}
 *   cells holds every cell in input order: the entry after the column
 *   post-pass, and its patches in the text it classified.
 */
function tablePatches(entries, settings, frozenMaxMag) {
  const resolved = resolveAmbiguousDates(entries);
  const maxMag = (frozenMaxMag !== undefined && frozenMaxMag !== null)
    ? frozenMaxMag
    : datasetMaxMagnitude(resolved);
  const cells = resolved.map((entry) =>
    Object.assign({ entry }, classifiedCellPatches(entry, maxMag, settings)));
  return { maxMag, cells };
}
