// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The classification layer of the lib/dr-table package: the read that turns a
 * cell object into the ladder's input and its classification
 * (classifyTableCell).
 * Page reads go to the page directly; only the vertical-align check of
 * getSuperscriptRanges reads opts.styleProbe.
 */

/**
 * The {start, end} half-open ranges of the classified text whose text pieces
 * pass isInside. Spans come from the layout's original text pieces, so the
 * ranges hold on a simplified cell, whose current text pieces hold the
 * written text. The layout's text pieces match the cell's current text pieces
 * one for one. With no layout, the cell's current text pieces stand for the
 * original.
 * @returns {{start: number, end: number}[]}
 */
function pieceRanges(cell, layout, isInside) {
  const live = collectTextPieces(cell);
  const spans = pieceSpans(layout ? layout.original : pieceTexts(live));
  const ranges = [];
  for (const span of spans) {
    if (span.text.length === 0) continue;
    if (isInside(live[span.i])) ranges.push({ start: span.start, end: span.start + span.text.length });
  }
  const toFlat = layout ? layout.toFlat : null;
  if (!toFlat) return ranges;
  const classified = [];
  for (const { start, end } of ranges) {
    const isInRange = (at) => at >= start && at < end;
    const first = toFlat.findIndex(isInRange);
    if (first !== -1) classified.push({ start: first, end: toFlat.findLastIndex(isInRange) + 1 });
  }
  return classified;
}

const SUPERSCRIPT_TAG = 'SUP';

/**
 * The ranges of the classified text that sit inside a <sup> element or an
 * element whose computed vertical-align is 'super'.
 * @returns {{start: number, end: number}[]}
 */
function getSuperscriptRanges(cell, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  if (!cell) return [];
  return pieceRanges(cell, opts.layout, (piece) =>
    walkUp(parentOf(piece), Infinity, (ancestor) => ancestor === cell, (ancestor) => {
      if (ancestor.tagName === SUPERSCRIPT_TAG) return true;
      const style = styleProbe.getComputedStyle(ancestor);
      return !!(style && style.verticalAlign === 'super');
    }) !== null);
}

const MARKUP_SELECTORS = ['a', 'code'];

/**
 * The markup ranges: the ranges of the classified text that sit inside an <a>
 * or a <code> element of the cell.
 * @returns {{start: number, end: number}[]}
 */
function getMarkupRanges(cell, layout) {
  if (!cell || typeof cell.querySelectorAll !== 'function') return [];
  const selectors = MARKUP_SELECTORS.filter((selector) =>
    cell.querySelectorAll(selector).length > 0);
  if (selectors.length === 0) return [];
  return pieceRanges(cell, layout, (piece) => selectors.some((selector) => {
    const element = piece.parentElement.closest(selector);
    // closest() searches ancestors past the cell, so without this check every
    // cell inside a link or code element around the table would hold a
    // markup range.
    return !!element && cell.contains(element);
  }));
}

function classifyTableCell(cellObj, rowIndex, opts, ranges) {
  const cell = cellObj.el;
  const text = cellObj.getText();
  const layout = cellObj.getPieceLayout();
  const classifiedCell = (classification) =>
    ({ cellObj, text, classification, layout, columnIndex: cellObj.columnIndex });
  // A null layout means the cell's piece count no longer matches its record
  // (see getPieceLayout in cells.js).
  if (!layout) return classifiedCell({ stretches: [] });
  const superscriptRanges = getSuperscriptRanges(cell, { layout });
  const markupRanges = getMarkupRanges(cell, layout);
  const hasSuperscript = superscriptRanges.length > 0 || !!(cell.querySelector && cell.querySelector('sup'));
  // With digits in more than one text piece, matchIdentifierShape does not
  // count the cell's digit groups as one identifier shape.
  const digitsSpanPieces = layout.original.filter((piece) => /\d/.test(piece)).length > 1;
  const classified = classifyCell({
    text,
    rowIndex,
    columnIndex: cellObj.columnIndex,
    ranges,
    markupRanges,
    hasSuperscript,
    superscriptRanges,
    digitsSpanPieces,
  }, opts);
  return classifiedCell(placeClassification(classified, layout));
}
