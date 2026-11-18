// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * placeDecision checks a classifyCell decision against the cell's text pieces
 * before the table step and drops a split number, so the number stays out of
 * the max magnitude and the pass counts the cell under split number.
 * flatPatches runs after the table step builds the patches, and moves each
 * patch into flat-text positions for the patch writer. Both read plain
 * values, so neither reads the page.
 */

function pieceSpans(texts) {
  let at = 0;
  return texts.map((text, i) => {
    const span = { i, start: at, text };
    at += text.length;
    return span;
  });
}

function pieceAt(spans, at) {
  return spans.find((span) => span.start <= at && at < span.start + span.text.length) || null;
}

// The text piece that holds every character of [start, start + length), or
// null.
function pieceHolding(spans, start, length) {
  const span = pieceAt(spans, start);
  return span && start + length <= span.start + span.text.length ? span : null;
}

// The range's position in the flat text, through toFlat. converted is false
// when toFlat holds no entry for the range's ends, and the range then keeps
// its classified positions.
function flatRange(layout, start, length) {
  if (!layout.toFlat) return { start, length, converted: false };
  const first = layout.toFlat[start];
  const last = layout.toFlat[start + length - 1];
  if (first === undefined || last === undefined) return { start, length, converted: false };
  return { start: first, length: last + 1 - first, converted: true };
}

/**
 * The text piece that holds every character of a range of the classified
 * text, or null when the range crosses a text piece boundary.
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
 * Move patches measured in the classified text into the flat text of the
 * cell's original text pieces, the positions the patch writer counts in.
 * Where toFlat converts positions, numStr becomes the flat text of the
 * converted range, so a line break the browser collapsed inside a value still
 * matches. A patch whose range toFlat does not convert stays as it is.
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {PieceLayout} layout
 * @returns {{index: number, numStr: string, newNum: string}[]}
 */
function flatPatches(patches, layout) {
  return patches.map((patch) => {
    const range = flatRange(layout, patch.index, patch.numStr.length);
    if (!range.converted) return patch;
    const numStr = layout.original.join('').substring(range.start, range.start + range.length);
    return Object.assign({}, patch, { index: range.start, numStr });
  });
}

/**
 * The placement step: place a classifyCell decision in the cell's text
 * pieces. The patch writer edits one text piece per patch, so a number stands
 * only when its digits sit in one text piece. The function drops a number
 * whose characters cross a text piece boundary (a split number) from the
 * decision, so it stays as written while the cell's other numbers round. When
 * no number remains, the function returns a skip with reason 'split'. Both
 * outcomes carry split: true, which the pass reads to count the cell once
 * under split number, however many split numbers it holds. A date or time
 * passes through; its text piece check runs when its patch is built, because
 * only a changed value needs one. For a cell with no layout, the function
 * returns a skip with reason 'pieces-changed'.
 *
 * @param {object} decision - classifyCell's decision
 * @param {PieceLayout|null} layout
 * @returns {object} the placed decision
 */
function placeDecision(decision, layout) {
  if (!layout) return { mode: 'skip', reason: 'pieces-changed' };
  if (decision.mode !== 'extracted') return decision;
  const inOnePiece = decision.value.matches.filter((m) => layoutPieceHolding(layout, m.index, m.numStr.length));
  if (inOnePiece.length === decision.value.matches.length) return decision;
  if (inOnePiece.length === 0) return { mode: 'skip', reason: 'split', split: true };
  return Object.assign({}, decision, { value: { matches: inOnePiece }, split: true });
}
