// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The cell layer of the lib/dr-table package: the cell object, which both
 * adapters build for every cell and the controller builds for a cell it
 * releases, and the text-piece reads and writes under it.
 * Every cell write goes through the cell object. Text is written in place,
 * through nodeValue, so <sup>, <a>, and every other node keep their identity.
 */

const SIMPLIFIED_CLASS = 'dr-ext-rounded';

/**
 * A simplified cell's record, stored through the originals port. applyPatches
 * replaces it after each write that lands a patch, so the written text never
 * goes stale.
 *
 * @typedef {object} CellRecord
 * @property {string} value - the text the pass classified (see applyPatches)
 * @property {{text: string, written: string}[]} pieces - one entry per text
 *   piece, in page order: text, its original; written, its text after this write
 * @property {string} pageTitle - the cell's hover text as the page set it; ''
 *   when the page set none (see pageHoverText)
 */

/**
 * The layout of a cell's text pieces, from the cell object's getPieceLayout().
 *
 * @typedef {object} PieceLayout
 * @property {string[]} original - each piece's original text: the record's
 *   stored text for a cell with a record, else the live text
 * @property {number[]|null} toFlat - for each position of the classified text,
 *   its position in the join of original. A position with no known
 *   counterpart has no entry. Null when the classified text differs from the
 *   pieces in more than whitespace and no single piece holds the value.
 */

function originalHoverText(value) {
  return `Original: ${value}`;
}

/**
 * The page's hover text for a cell about to take a write (see
 * CellRecord.pageTitle).
 * @returns {string}
 */
function pageHoverText(cellEl, record) {
  const live = cellEl.title || '';
  if (!record) return live;
  return live === originalHoverText(record.value) ? record.pageTitle : live;
}

function isHeaderCellEl(cellEl) {
  if (cellEl.tagName === 'TH') return true;
  const role = typeof cellEl.getAttribute === 'function' ? cellEl.getAttribute('role') : null;
  return role === 'rowheader' || role === 'columnheader';
}

/**
 * The cell object for a cell of either table kind. getDisplayedText reads the
 * rendered text, falling back to the raw text where the rendered text is empty
 * or the context lays out nothing. getText returns the record's stored text
 * for a cell with a record, else the same read.
 * @returns {{getText(): string, getPieceLayout(): PieceLayout|null,
 *            applyPatches(patches: object[], opts: {value: string}): number,
 *            restore(): void,
 *            getDisplayedText(): string, el: Element, isHeaderCell: boolean}}
 */
function makeCellObj(cellEl, port) {
  const shownText = () => cellEl.innerText || cellEl.textContent || '';
  const recordOf = () => port.get(cellEl) || null;
  const getText = () => {
    const record = recordOf();
    return record ? record.value : shownText();
  };
  return {
    el: cellEl,
    isHeaderCell: isHeaderCellEl(cellEl),
    getText,
    getDisplayedText: shownText,
    // Null when the cell no longer holds as many pieces as its record. A
    // caller that runs no sort first, such as the lens preview, can get null;
    // the pass releases such a cell before it reads a layout.
    getPieceLayout() {
      const live = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const record = recordOf();
      if (record && record.pieces.length !== live.length) return null;
      const original = record ? record.pieces.map((piece) => piece.text) : live;
      const text = getText();
      const toFlat = mapRenderedToFlat(text, original.join('')) || mapValueToPiece(text, original);
      return { original, toFlat };
    },
    // Returns how many patches landed. applyPatches stores no record when no
    // patch lands: the cell's text stays as it was, and storing the hover text
    // would record a simplification that never happened.
    // The caller passes the text it classified as value, because the browser
    // lays out the whole table again when a cell's rendered text is read after
    // another cell's write: once per cell, a 10,000-cell table takes most of a
    // minute.
    applyPatches(patches, { value }) {
      const record = recordOf();
      const original = record
        ? record.pieces.map((piece) => piece.text)
        : collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const { landed, texts } = writePatches(cellEl, patches, original);
      if (landed === 0) return 0;
      port.set(cellEl, {
        value,
        pieces: original.map((text, i) => ({ text, written: texts[i] })),
        pageTitle: pageHoverText(cellEl, record),
      });
      if (cellEl.classList) cellEl.classList.add(SIMPLIFIED_CLASS);
      cellEl.title = originalHoverText(value);
      return landed;
    },
    // A cell whose page set no hover text ends with no title attribute: the
    // record holds no difference between an absent attribute and an empty
    // one. The caller drops the record.
    restore() {
      const record = recordOf();
      if (!record) return;
      restoreTextPieces(cellEl, record.pieces);
      if (cellEl.classList) cellEl.classList.remove(SIMPLIFIED_CLASS);
      if (cellEl.title !== originalHoverText(record.value)) return;
      if (record.pageTitle) cellEl.title = record.pageTitle;
      else cellEl.removeAttribute('title');
    },
  };
}

/**
 * The cell's text pieces in page order: every Text node under the cell,
 * whitespace-only and empty ones included. The walk falls back to child nodes
 * where no tree walker exists (a plain Node context).
 * @returns {Text[]}
 */
function collectTextPieces(cell) {
  const pieces = [];
  const walker = typeof document !== 'undefined'
    ? document.createTreeWalker?.(cell, NodeFilter.SHOW_TEXT) : null;
  if (walker) {
    let node;
    while ((node = walker.nextNode())) pieces.push(node);
    return pieces;
  }
  (function visit(node) {
    const kids = node.childNodes || [];
    for (let k = 0; k < kids.length; k++) {
      if (kids[k].nodeType === 3) pieces.push(kids[k]);
      else visit(kids[k]);
    }
  })(cell);
  return pieces;
}

/**
 * Where each character of a cell's rendered text sits in its flat text. The
 * browser collapses whitespace runs and adds line breaks at a <br> or block
 * boundary, so a pretty-printed cell's rendered text is shorter than its flat
 * text. Returns null when the texts differ in more than whitespace (hidden
 * text, a CSS text transform).
 * @returns {number[]|null}
 */
function mapRenderedToFlat(rendered, flat) {
  const isSpace = (ch) => /\s/.test(ch);
  const toFlat = [];
  let j = 0;
  for (let i = 0; i < rendered.length;) {
    if (j < flat.length && rendered[i] === flat[j]) {
      toFlat.push(j++);
      i++;
    } else if (isSpace(rendered[i])) {
      toFlat.push(j < flat.length && isSpace(flat[j]) ? j++ : j);
      i++;
    } else if (j < flat.length && isSpace(flat[j])) {
      j++;
    } else {
      return null;
    }
  }
  return flat.substring(j).trim() === '' ? toFlat : null;
}

/**
 * Where a cell's trimmed rendered text sits in its flat text, for a cell with
 * a hidden sort key ahead of the value ("000000007002300" hidden, then
 * "7,002,300"). The value sits in the one piece whose trimmed text equals it,
 * else in the one piece that holds it exactly once; null when no single piece
 * qualifies.
 * @returns {number[]|null}
 */
function mapValueToPiece(rendered, pieces) {
  const value = rendered.trim();
  if (value === '') return null;
  const indexes = pieces.map((_, i) => i);
  let candidates = indexes.filter((i) => pieces[i].trim() === value);
  if (candidates.length !== 1) {
    candidates = indexes.filter((i) => {
      const at = pieces[i].indexOf(value);
      return at >= 0 && pieces[i].indexOf(value, at + 1) < 0;
    });
  }
  if (candidates.length !== 1) return null;
  const i = candidates[0];
  let flatStart = pieces[i].indexOf(value);
  for (let k = 0; k < i; k++) flatStart += pieces[k].length;
  const lead = rendered.length - rendered.trimStart().length;
  const toFlat = [];
  for (let k = 0; k < value.length; k++) toFlat[lead + k] = flatStart + k;
  return toFlat;
}

/**
 * The patch writer: applies patches {index, numStr, newNum} to the text pieces
 * of a cell. `original` lists each piece's original text, and each index is a
 * position in their join. A patch is skipped when no piece holds its position
 * or numStr is not at that position. With no patch landed, or with a piece
 * count that differs from `original`, nothing is written.
 * @returns {{landed: number, texts: string[]}} the landed count, and each
 *   piece's text after the call
 */
function writePatches(cell, patches, original) {
  const pieces = collectTextPieces(cell);
  const live = pieces.map((piece) => piece.nodeValue);
  if (original.length !== live.length) return { landed: 0, texts: live };
  const { texts, landed } = patchPieceTexts(original, patches);
  if (landed === 0) return { landed: 0, texts: live };
  texts.forEach((after, i) => {
    if (live[i] !== after) pieces[i].nodeValue = after;
  });
  return { landed, texts };
}

/**
 * Each piece's text with its patches applied, and how many patches landed.
 * Patches apply right to left, so an earlier position is unaffected by a change
 * at a later one.
 * @returns {{texts: string[], landed: number}}
 */
function patchPieceTexts(texts, patches) {
  const spans = pieceSpans(texts);
  const out = texts.slice();
  let landed = 0;
  for (const { index, numStr, newNum } of patches.slice().sort((x, y) => y.index - x.index)) {
    const span = pieceAt(spans, index);
    if (!span) continue;
    const text = out[span.i];
    const at = index - span.start;
    if (text.substring(at, at + numStr.length) !== numStr) continue;
    out[span.i] = text.substring(0, at) + newNum + text.substring(at + numStr.length);
    landed++;
  }
  return { texts: out, landed };
}

/**
 * Sort a cell by its record, the first step of every pass:
 *   'fresh'      the cell holds no record.
 *   'held'       the cell holds as many text pieces as its record, and each
 *                piece shows its original or its written text.
 *   'rewritten'  anything else: a piece holds text that is neither, or the
 *                piece count changed.
 * @returns {'fresh'|'held'|'rewritten'}
 */
function sortCellByRecord(cell, record) {
  if (!record) return 'fresh';
  const live = collectTextPieces(cell).map((piece) => piece.nodeValue);
  if (live.length !== record.pieces.length) return 'rewritten';
  return record.pieces.every((piece, i) => live[i] === piece.text || live[i] === piece.written)
    ? 'held'
    : 'rewritten';
}

/**
 * Put a cell's original text back into every text piece that still shows the
 * extension's written text. A piece the page rewrote keeps the page's text.
 * With the piece count changed, live pieces pair with stored pieces by text,
 * in page order and at most once per stored piece.
 */
function restoreTextPieces(cell, storedPieces) {
  const pieces = collectTextPieces(cell);
  if (pieces.length === storedPieces.length) {
    storedPieces.forEach((piece, i) => {
      if (piece.text !== piece.written && pieces[i].nodeValue === piece.written) pieces[i].nodeValue = piece.text;
    });
    return;
  }
  const written = storedPieces.filter((piece) => piece.text !== piece.written);
  let next = 0;
  for (const live of pieces) {
    const at = written.findIndex((piece, k) => k >= next && piece.written === live.nodeValue);
    if (at < 0) continue;
    live.nodeValue = written[at].text;
    next = at + 1;
  }
}
