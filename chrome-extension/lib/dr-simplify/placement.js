/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The placement step: every cell takes three steps (classify, place, patch).
 * Placement checks a classifyCell decision against the cell's text pieces
 * before any patch is built, so the patch writer (lib/dr-table/cells.js) writes
 * each patch inside one piece. It reads plain values, so it reads no page. It
 * calls pieceSpans and pieceAt from lib/dr-table/cells.js, which load before
 * it.
 */

// The piece that holds every character of [start, start + length), or null.
function pieceHolding(spans, start, length) {
  const span = pieceAt(spans, start);
  return span && start + length <= span.start + span.text.length ? span : null;
}

// converted is false when toFlat holds no entry for the range, which then
// keeps its classified positions.
function flatRange(layout, start, length) {
  if (!layout.toFlat || length === 0) return { start, length, converted: false };
  const first = layout.toFlat[start];
  const last = layout.toFlat[start + length - 1];
  if (first === undefined || last === undefined) return { start, length, converted: false };
  return { start: first, length: last + 1 - first, converted: true };
}

/**
 * The piece that holds every character of a range of the classified text,
 * or null when the range crosses a piece boundary.
 * @param {PieceLayout} layout
 * @param {number} start
 * @param {number} length
 * @returns {{i: number, start: number, text: string}|null}
 */
function layoutPieceHolding(layout, start, length) {
  const range = flatRange(layout, start, length);
  return pieceHolding(pieceSpans(layout.original), range.start, range.length);
}

/**
 * Move patches measured in the classified text into the join of the cell's
 * original pieces, the positions the patch writer counts in. Where toFlat
 * converts positions, numStr becomes the flat text of the converted range, so
 * a line break the browser collapsed inside a value still matches. A patch
 * whose position no piece holds stays as it is, and does not land.
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {PieceLayout} layout
 * @returns {{index: number, numStr: string, newNum: string}[]}
 */
function flatPatches(patches, layout) {
  if (patches.length === 0) return patches;
  const spans = pieceSpans(layout.original);
  const flat = layout.original.join('');
  return patches.map((patch) => {
    const range = flatRange(layout, patch.index, patch.numStr.length);
    if (!pieceHolding(spans, range.start, 1)) return patch;
    const numStr = range.converted ? flat.substring(range.start, range.start + range.length) : patch.numStr;
    return Object.assign({}, patch, { index: range.start, numStr });
  });
}

/**
 * The placement step: place a classifyCell decision in the cell's text
 * pieces. A patch edits one piece, so a number stands only when its digits sit
 * in one piece. A number whose characters cross a piece boundary (a split
 * number) leaves the decision and stays as written; the cell's other numbers
 * round. A decision left with no number skips with 'split'. Both outcomes
 * carry split: true, which the pass reads to write the debug row. A date or
 * time passes through; its piece check runs when its patch is built, because
 * only a changed value needs one. A cell with no layout skips with
 * 'pieces-changed'.
 *
 * @param {object} decision - classifyCell's decision
 * @param {PieceLayout|null} layout
 * @returns {object} the placed decision
 */
function placeDecision(decision, layout) {
  if (!layout) return { mode: 'skip', reason: 'pieces-changed' };
  if (decision.mode !== 'extracted') return decision;
  const held = decision.value.matches.filter((m) => layoutPieceHolding(layout, m.index, m.numStr.length));
  if (held.length === decision.value.matches.length) return decision;
  if (held.length === 0) return { mode: 'skip', reason: 'split', split: true };
  return Object.assign({}, decision, { value: { matches: held }, split: true });
}
