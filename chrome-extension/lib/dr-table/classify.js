/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The classification layer of the lib/dr-table package: the read that turns a
 * cell object into the ladder's input and its decision (classifyTableCell),
 * with the link filter (isCellWholeLink, filterLinkMatches) and the
 * superscript ranges (getSuperscriptRanges) it applies. Loaded by the
 * manifest's content_scripts after adapters.js and before detect.js.
 *
 * Page reads in this file go to the page directly, with no port: the link
 * filter (filterLinkMatches), the whole-link test (isCellWholeLink), and the
 * ancestor walk (walkUp) that getSuperscriptRanges runs. The vertical-align
 * check of getSuperscriptRanges reads opts.styleProbe.
 */

/**
 * The ancestor walk every walk up the tree calls: visits `start`, then each
 * node above it, and returns the first node `found` reports, or null. The walk
 * ends before a node `stopAt` reports, after `cap` nodes, and at the tree's
 * top. `found` may keep state.
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
 * <sup> element or an element whose computed vertical-align is 'super'. The
 * function lists the text pieces inside one, finds each piece's span in the
 * join of the layout's original piece texts, and converts the span through
 * layout.toFlat into positions of the classified text, so the ranges hold on
 * a simplified cell, whose live pieces hold the written text. A range with no
 * classified character drops out. The vertical-align check reads
 * opts.styleProbe, so the function runs when getComputedStyle is absent.
 *
 * With no layout, the cell's live pieces stand for the original and the
 * ranges count in the live flat text.
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

/**
 * Whether the cell's visible text lies entirely inside <a> elements (e.g. a
 * linked page number). Reads innerText directly, with no port.
 */
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
 * Drops the matches from extractNumbersInText that sit inside an <a>
 * descendant of the cell. A match's position in the classified text identifies
 * its text piece through the layout (layoutPieceHolding), and the match drops
 * when that piece has an <a> ancestor inside the cell. A piece keeps its
 * identity through every write, so the test holds on a simplified cell. A
 * match that no single piece holds stays: the placement step sends no such
 * match here, and the patch writer skips one.
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

// The link filter's step of an extracted decision. classifyCell
// (lib/dr-simplify) applies every text-only filter to an extracted cell's
// candidate matches (quote spans, superscript spans, era years) but reads
// only text, which holds no <a> element, so filterLinkMatches above drops the
// matches inside links here. Each filter is an independent per-match
// predicate, so running this one after the ladder's filters gives the same
// final set as running all of them together (see the lib/dr-simplify/ladder.js
// header). If filtering empties the match list, the cell becomes a skip.
// The layout is the cell's own (cellObj.getPieceLayout()). placeDecision
// returns a skip for a cell with no layout, so an extracted decision always
// arrives here with one.
/** @param {PieceLayout} layout - the cell's piece layout (cellObj.getPieceLayout()) */
function finalizeExtractedDecision(decision, cell, layout) {
  if (decision.mode !== 'extracted') return decision;
  const filtered = filterLinkMatches(cell, decision.value.matches, layout);
  if (filtered.length === 0) return { mode: 'skip', reason: decision.reason };
  return { mode: 'extracted', reason: decision.reason, value: { matches: filtered } };
}

// Classify one cell: the ladder, then the placement step. isCellWholeLink and
// the superscript ranges are page reads the pure ladder cannot make, so they
// pass in as plain data (see the lib/dr-simplify/ladder.js header). The step
// reads the page and writes nothing: the pass writes the debug row for a split
// value (entry.placedReason) after classification.
//
// A simplified cell classifies its stored original rather than the rounded
// text now showing, on either kind: the cell object's getText()
// and getPieceLayout() answer from its record. The pass and the lens
// preview read alike. The superscript ranges and the link filter locate each
// number's text piece by the number's position in that text, through the
// layout, so both read the live cell's pieces on a simplified cell too.
// isWholeLink stays a live read: rounding patches the values of text pieces and
// never adds or removes an <a>, so the anchor text and the cell text move
// together, and a whole-link cell never rounds in the first place.
// A cell with no layout is a rewritten cell. placeDecision returns a skip for
// it, so its superscript ranges and its link filter never matter.
function classifyTableCell(cellObj, rowIndex, opts, ranges) {
  const cell = cellObj.el;
  const text = cellObj.getText();
  const layout = cellObj.getPieceLayout();
  const hasSuperscript = !!(cell.querySelector && cell.querySelector('sup'));
  const superscriptRanges = hasSuperscript && layout ? getSuperscriptRanges(cell, { layout }) : [];
  // A stacked cell's pieces each hold a number, and its joined text is not
  // one spaced identifier (see matchIdentifierShape).
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
  const placed = placeDecision(classified, text, layout, { hasSuperscript });
  return {
    cellObj,
    text,
    trimmed: typeof text === 'string' ? text.trim() : '',
    info: decisionToLegacyInfo(finalizeExtractedDecision(placed, cell, layout)),
    placedReason: placed.reason,
    layout,
    col: cellObj.columnIndex,
  };
}
