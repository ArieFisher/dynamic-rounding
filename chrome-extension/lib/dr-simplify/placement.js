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
 * each patch inside one piece. It reads plain values and one callback,
 * layout.runsTogether, so it reads no page. It calls pieceSpans and pieceAt
 * from lib/dr-table/cells.js, which load before it.
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

// -1 when the classified text does not hold the character. A layout with no
// toFlat holds no known position (a hidden sort key could hold a stacked
// number).
function textPosition(layout, text, flat) {
  if (!layout.toFlat) return -1;
  return layout.toFlat.findIndex((f, r) => f === flat && !/\s/.test(text[r]));
}

/**
 * Whether the text the browser shows has piece i straight after the
 * character before it, with no space or line break between: false for pieces
 * on separate lines, true for pieces that inline styling splits ("6,7" plain,
 * "18,245" in bold). Text that differs from the pieces in more than whitespace
 * returns true, so the pieces stay unchanged.
 * @param {string} shown - the cell's rendered text
 * @param {string[]} pieces - the cell's live text pieces, in page order
 * @param {number} i
 * @returns {boolean}
 */
function showsPiecesTogether(shown, pieces, i) {
  const toFlat = mapRenderedToFlat(shown, pieces.join(''));
  if (!toFlat) return true;
  const { start } = pieceSpans(pieces)[i];
  const at = toFlat.findIndex((f, r) => f === start && !/\s/.test(shown[r]));
  return at <= 0 || !/\s/.test(shown[at - 1]);
}

// A stacked cell: each text piece holds one whole number or unit number, or
// only whitespace, currency signs, a percent sign, or a currency code. Two
// numbers in one piece ("416 555 1234") or a piece that reads as a date or
// time ("2024" above "2025", because a lone year stays a year) make the cell
// not stacked. Returns matches measured in the join of original, null when not
// stacked, or 'split' when a number sits across two pieces ("4." then "91"; a
// piece starting with "." or "," never reads as a number). A digit beside a
// digit across two pieces reads as two numbers unless runTogether(span) holds
// for the second piece ("6,7" plain, then "18,245" in bold).
function stackedMatches(spans, runTogether) {
  const signPiece = new RegExp('^(?:' + CURRENCY_SIGN_ALTERNATION + '|%)+$');
  const filled = spans.filter((span) => span.text.length > 0);
  for (let k = 1; k < filled.length; k++) {
    const before = filled[k - 1].text;
    if (!/^\d/.test(filled[k].text)) continue;
    if (/[.,]$/.test(before) || (/\d$/.test(before) && runTogether(filled[k]))) return 'split';
  }
  const matches = [];
  for (const span of filled) {
    const trimmed = span.text.trim();
    if (trimmed === '' || signPiece.test(trimmed) || CURRENCY_CODES.includes(trimmed)) continue;
    if (isDateTimeLike(trimmed) || isDateLike(trimmed) || isTimeLike(trimmed)) return null;
    const unit = matchUnitNumber(span.text);
    const found = unit ? [unit] : extractNumbersInText(span.text);
    if (found.length !== 1 || (!unit && toNumber(span.text) === null)) return null;
    matches.push({ numStr: found[0].numStr, num: found[0].num, index: span.start + found[0].index });
  }
  return matches.length > 0 ? matches : null;
}

/**
 * The placement step: place a classifyCell decision in the cell's text
 * pieces. A patch edits one piece, so a decision stands only when the
 * characters it changes sit in one piece. A date or time passes through; its
 * piece check runs when its patch is built, because only a changed value
 * needs one.
 *
 * A decision that crosses a piece boundary, and a cell left unsimplified
 * because the "words" switch is off ('mixed-disabled'), take the stacked-cell
 * test: a stacked cell rounds number by number; a number split across pieces
 * skips with 'split'; any other cell skips with 'pieces'. A cell with no
 * layout skips with 'pieces-changed'. A cell with a <sup> keeps a skip
 * decision, so a footnote marker never rounds as a stacked number.
 *
 * @param {object} decision - classifyCell's decision
 * @param {string} text - the text the decision was classified on
 * @param {PieceLayout|null} layout
 * @param {{hasSuperscript?: boolean}} [opts]
 * @returns {object} the placed decision
 */
function placeDecision(decision, text, layout, opts = {}) {
  if (!layout) return { mode: 'skip', reason: 'pieces-changed' };
  if (opts.hasSuperscript && decision.mode === 'skip') return decision;
  if (decision.mode === 'pure') {
    const lead = text.length - text.trimStart().length;
    if (layoutPieceHolding(layout, lead, text.trim().length)) return decision;
  } else if (decision.mode === 'extracted') {
    if (decision.value.matches.every((m) => layoutPieceHolding(layout, m.index, m.numStr.length))) return decision;
  } else if (!(decision.mode === 'skip' && decision.reason === 'mixed-disabled')) {
    return decision;
  }
  const matches = stackedMatches(pieceSpans(layout.original), (span) => layout.runsTogether(span.i));
  if (matches === 'split') return { mode: 'skip', reason: 'split' };
  if (matches === null) return decision.mode === 'skip' ? decision : { mode: 'skip', reason: 'pieces' };
  // The patch step moves each match back (see flatPatches).
  const placed = matches.map((m) => Object.assign({}, m, { index: textPosition(layout, text, m.index) }));
  if (placed.some((m) => m.index < 0)) return decision.mode === 'skip' ? decision : { mode: 'skip', reason: 'pieces' };
  return { mode: 'extracted', reason: 'stacked', value: { matches: placed } };
}
