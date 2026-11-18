// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The classification layer of the lib/dr-table package: the read that turns a
 * cell object into the ladder's input and its decision (classifyTableCell).
 * Page reads go to the page directly; only the vertical-align check of
 * getSuperscriptRanges reads opts.styleProbe.
 */

/**
 * The {start, end} half-open ranges of the classified text that sit inside a
 * <sup> element or an element whose computed vertical-align is 'super'. Spans
 * come from the layout's original text pieces, so the ranges hold on a
 * simplified cell, whose current text pieces hold the written text. The
 * layout's text pieces match the cell's current text pieces one for one. With
 * no layout, the cell's current text pieces stand for the original.
 * @returns {{start: number, end: number}[]}
 */
function getSuperscriptRanges(cell, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  if (!cell) return [];
  const live = collectTextPieces(cell);
  const spans = pieceSpans(opts.layout ? opts.layout.original : pieceTexts(live));
  const ranges = [];
  for (const span of spans) {
    if (span.text.length === 0) continue;
    const isSup = walkUp(parentOf(live[span.i]), Infinity, (ancestor) => ancestor === cell, (ancestor) => {
      if (ancestor.tagName === SUPERSCRIPT_TAG) return true;
      const style = styleProbe.getComputedStyle(ancestor);
      return !!(style && style.verticalAlign === 'super');
    }) !== null;
    if (isSup) ranges.push({ start: span.start, end: span.start + span.text.length });
  }
  const toFlat = opts.layout ? opts.layout.toFlat : null;
  if (!toFlat) return ranges;
  const classified = [];
  for (const { start, end } of ranges) {
    const isInside = (at) => at >= start && at < end;
    const first = toFlat.findIndex(isInside);
    if (first !== -1) classified.push({ start: first, end: toFlat.findLastIndex(isInside) + 1 });
  }
  return classified;
}

function cellAnchors(cell) {
  if (typeof cell.querySelectorAll !== 'function') return [];
  return [...(cell.querySelectorAll('a') || [])];
}

// Whether the cell's rendered text lies entirely inside <a> elements (e.g. a
// linked page number).
function isCellWholeLink(cell) {
  const anchors = cellAnchors(cell);
  if (anchors.length === 0) return false;
  const cellText = (cell.innerText || '').trim();
  if (!cellText) return false;
  const anchorText = anchors.map(a => (a.innerText || '').trim()).join('').trim();
  return anchorText === cellText;
}

/**
 * Drops the matches that sit inside an <a> descendant of the cell. A match's
 * index is a position in the classified text. A text piece keeps its identity
 * through every write, so the test holds on a simplified cell. A match that no
 * single text piece holds stays here; the placement step drops such a match
 * before this filter runs.
 */
function filterLinkMatches(cell, matches, layout) {
  if (!matches || matches.length === 0) return matches;
  if (cellAnchors(cell).length === 0) return matches;

  const pieces = collectTextPieces(cell);
  return matches.filter((match) => {
    const held = layoutPieceHolding(layout, match.index, match.numStr.length);
    const piece = held && pieces[held.i];
    const anchor = piece && piece.parentElement && piece.parentElement.closest('a');
    return !(anchor && cell.contains(anchor));
  });
}

// classifyCell (lib/dr-simplify) reads only text, which holds no <a> element,
// so the link filter runs here, after the ladder and the placement step. Each
// of the three keeps or drops a match on that match alone, so their order does
// not change which matches remain. placeDecision returns a skip for a cell
// with no layout, so an extracted decision always arrives with one.
function finalizeExtractedDecision(decision, cell, layout) {
  if (decision.mode !== 'extracted') return decision;
  const filtered = filterLinkMatches(cell, decision.value.matches, layout);
  if (filtered.length === 0) return { mode: 'skip', reason: decision.reason };
  return { mode: 'extracted', reason: decision.reason, value: { matches: filtered } };
}

// classifyTableCell writes nothing: the pass counts a split number
// (entry.split) afterward.
//
// For a simplified cell, the function classifies the stored original
// rather than the written text; getSuperscriptRanges and filterLinkMatches
// locate each number's text piece through the layout, so both work on the
// cell's current text pieces too.
// isWholeLink stays a live read: rounding never adds or removes an <a>, so the
// anchor text and the cell text move together.
function classifyTableCell(cellObj, rowIndex, opts, ranges) {
  const cell = cellObj.el;
  const text = cellObj.getText();
  const layout = cellObj.getPieceLayout();
  const superscriptRanges = layout ? getSuperscriptRanges(cell, { layout }) : [];
  const hasSuperscript = superscriptRanges.length > 0 || !!(cell.querySelector && cell.querySelector('sup'));
  // The join of numbers that sit in separate pieces is not one spaced
  // identifier (see matchIdentifierShape).
  const digitsSpanPieces = !!layout && layout.original.filter((piece) => /\d/.test(piece)).length > 1;
  const classified = classifyCell({
    text,
    rowIndex,
    columnIndex: cellObj.columnIndex,
    ranges,
    isWholeLink: isCellWholeLink(cell),
    hasSuperscript,
    superscriptRanges,
    digitsSpanPieces,
  }, opts);
  const placed = placeDecision(classified, layout);
  return {
    cellObj,
    text,
    info: decisionToLegacyInfo(finalizeExtractedDecision(placed, cell, layout)),
    split: !!placed.split,
    layout,
    columnIndex: cellObj.columnIndex,
  };
}
