// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The placement step. placeClassification runs before the table step, so a
 * split number stays out of the max magnitude; flatPatches runs after it, to
 * move each patch into flat text positions for the patch writer. Both read
 * plain values, so neither reads the page.
 */

function pieceHolding(spans, start, length) {
  const span = pieceAt(spans, start);
  return span && start + length <= span.start + span.text.length ? span : null;
}

// The range's position in the flat text, through toFlat. converted is false
// when toFlat is null or holds no entry for the range's ends, and the range
// then keeps its classified positions.
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
 * The patch writer edits one text piece per patch, so a number stands only
 * when its characters sit in one text piece. A split number leaves the
 * classification and the cell's other numbers round; the pass reads
 * split: true to count the cell once under split number, however many it
 * holds. A date or time passes through: the pass checks its text piece after
 * the table step builds its patch, because only a changed value needs the
 * check.
 * A null layout means the cell's piece count no longer matches its record
 * (see getPieceLayout in lib/dr-table/cells.js).
 * @returns {object} the placed classification
 */
function placeClassification(classification, layout) {
  if (!layout) return { mode: 'skip', reason: 'pieces-changed' };
  if (classification.mode !== 'extracted') return classification;
  const inOnePiece = classification.value.matches.filter((m) => layoutPieceHolding(layout, m.index, m.numStr.length));
  if (inOnePiece.length === classification.value.matches.length) return classification;
  if (inOnePiece.length === 0) return { mode: 'skip', reason: 'split', split: true };
  return Object.assign({}, classification, { value: { matches: inOnePiece }, split: true });
}
