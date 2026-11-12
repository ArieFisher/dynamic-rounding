/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The classification layer of the lib/dr-table package: the read that turns a
 * cell object into the ladder's input and its decision (classifyTableCell).
 * Page reads go to the page directly; only the vertical-align check of
 * getSuperscriptRanges reads opts.styleProbe.
 */

/**
 * The ancestor walk: the first node from `start` upward that `found` reports,
 * or null. The walk ends before a node `stopAt` reports, after `cap` nodes,
 * and at the tree's top.
 * @param {Node|null} start
 * @param {number} cap - most nodes visited (the walk then returns null):
 *   gridWalkDepthCap, or Infinity for the tree's top alone
 * @param {((node: Node) => boolean)|null} stopAt - null stops nowhere
 * @param {(node: Node) => boolean} found
 * @returns {Node|null}
 */
function walkUp(start, cap, stopAt, found) {
  let node = start;
  for (let depth = 0; node && depth < cap && !(stopAt && stopAt(node)); depth++) {
    if (found(node)) return node;
    node = parentOf(node);
  }
  return null;
}

/**
 * The {start, end} half-open ranges of the classified text that sit inside a
 * <sup> element or an element whose computed vertical-align is 'super'. Spans
 * come from the layout's original piece texts, so the ranges hold on a
 * simplified cell, whose live pieces hold the written text. With no layout,
 * the live pieces stand for the original.
 * @param {Element} cell
 * @param {{styleProbe?: object, layout?: PieceLayout}} [opts] - layout: the
 *   cell's piece layout (see PieceLayout); its pieces match the live pieces
 *   one for one
 * @returns {{start: number, end: number}[]}
 */
function getSuperscriptRanges(cell, opts = {}) {
  const styleProbe = opts.styleProbe || DEFAULT_STYLE_PROBE;
  if (!cell) return [];
  const live = collectTextPieces(cell);
  const spans = pieceSpans(opts.layout ? opts.layout.original : live.map((node) => node.nodeValue || ''));
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
    const inside = [];
    toFlat.forEach((at, i) => { if (at >= start && at < end) inside.push(i); });
    if (inside.length > 0) classified.push({ start: inside[0], end: inside[inside.length - 1] + 1 });
  }
  return classified;
}

// Whether the cell's visible text lies entirely inside <a> elements (e.g. a
// linked page number).
function isCellWholeLink(cell) {
  if (typeof cell.querySelectorAll !== 'function') return false;
  const anchors = cell.querySelectorAll('a');
  if (!anchors || anchors.length === 0) return false;
  const cellText = (cell.innerText || '').trim();
  if (!cellText) return false;
  const anchorText = [...anchors].map(a => (a.innerText || '').trim()).join('').trim();
  return anchorText === cellText;
}

/**
 * Drops the matches that sit inside an <a> descendant of the cell. A piece
 * keeps its identity through every write, so the test holds on a simplified
 * cell. A match that no single piece holds stays: the patch writer skips it.
 * @param {Element} cell
 * @param {{index: number, numStr: string}[]} matches - positions in the classified text
 * @param {PieceLayout} [layout] - the cell's piece layout; with none, the
 *   cell's live pieces stand for the original and positions count in the live
 *   flat text
 */
function filterLinkMatches(cell, matches, layout) {
  if (!matches || matches.length === 0) return matches;
  if (typeof cell.querySelectorAll !== 'function') return matches;
  const anchors = cell.querySelectorAll('a');
  if (!anchors || anchors.length === 0) return matches;

  const pieces = collectTextPieces(cell);
  const placement = layout || { original: pieces.map((piece) => piece.nodeValue), toFlat: null };
  return matches.filter((match) => {
    const held = layoutPieceHolding(placement, match.index, match.numStr.length);
    const piece = held && pieces[held.i];
    const anchor = piece && piece.parentElement && piece.parentElement.closest('a');
    return !(anchor && cell.contains(anchor));
  });
}

// classifyCell (lib/dr-simplify) reads only text, which holds no <a> element,
// so the link filter runs here. Each filter is an independent per-match
// predicate, so running this one after the ladder's gives the same final set
// (see the lib/dr-simplify/ladder.js header). placeDecision returns a skip for
// a cell with no layout, so an extracted decision always arrives with one.
/** @param {PieceLayout} layout - the cell's piece layout (cellObj.getPieceLayout()) */
function finalizeExtractedDecision(decision, cell, layout) {
  if (decision.mode !== 'extracted') return decision;
  const filtered = filterLinkMatches(cell, decision.value.matches, layout);
  if (filtered.length === 0) return { mode: 'skip', reason: decision.reason };
  return { mode: 'extracted', reason: decision.reason, value: { matches: filtered } };
}

// The page reads the pure ladder cannot make pass in as plain data (see the
// lib/dr-simplify/ladder.js header). This writes nothing: the pass counts a
// split number (entry.split) afterward.
//
// A simplified cell classifies its stored original rather than the rounded
// text now showing; the superscript ranges and the link filter locate each
// number's piece through the layout, so both read the live pieces too.
// isWholeLink stays a live read: rounding never adds or removes an <a>, so the
// anchor text and the cell text move together.
// A cell with no layout is a rewritten cell; placeDecision skips it.
function classifyTableCell(cellObj, rowIndex, opts, ranges) {
  const cell = cellObj.el;
  const text = cellObj.getText();
  const layout = cellObj.getPieceLayout();
  const hasSuperscript = !!(cell.querySelector && cell.querySelector('sup'));
  const superscriptRanges = hasSuperscript && layout ? getSuperscriptRanges(cell, { layout }) : [];
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
    trimmed: typeof text === 'string' ? text.trim() : '',
    info: decisionToLegacyInfo(finalizeExtractedDecision(placed, cell, layout)),
    split: !!placed.split,
    layout,
    col: cellObj.columnIndex,
  };
}
