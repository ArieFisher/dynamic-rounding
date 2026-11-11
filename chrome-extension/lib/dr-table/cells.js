/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The cell layer of the lib/dr-table package: the cell object that both
 * adapters build for every cell, and the text-piece reads and writes under it.
 * Every cell write goes through the cell object. Text is written in place,
 * through nodeValue, so <sup>, <a>, and every other node keep their identity.
 */

const SIMPLIFIED_CLASS = 'dr-ext-rounded';

/**
 * A simplified cell's record, stored through the originals port. A landed
 * write replaces it, so the written text never goes stale; a write that lands
 * nothing stores nothing.
 *
 * @typedef {object} CellRecord
 * @property {string} value - the text the cell classified: opts.value, the
 *   text the pass read before its first write, else getText()
 * @property {{text: string, written: string}[]} pieces - one entry per text
 *   piece, in page order: text, its original; written, its text after this write
 * @property {string} pageTitle - the cell's hover text as the page set it,
 *   read on the first write and carried through every later write (the
 *   extension's hover text never replaces it), except that a held cell whose
 *   hover text the page changed takes the new text; '' when the page set none
 */

/**
 * The hover text the extension gives a simplified cell. A different live hover
 * text is the page's.
 * @param {string} value
 * @returns {string}
 */
function originalHoverText(value) {
  return `Original: ${value}`;
}

/**
 * The page's hover text for a cell about to take a write. On a held cell, a
 * live hover text other than the extension's is the page's newer text.
 * @param {Element} cellEl
 * @param {CellRecord|null} record
 * @returns {string}
 */
function pageHoverText(cellEl, record) {
  const live = cellEl.title || '';
  if (!record) return live;
  return live === originalHoverText(record.value) ? (record.pageTitle || '') : live;
}

/**
 * The cell object both adapters hand out. `reads` holds the differences
 * between the kinds:
 *   tagName          the cell's tag; a grid cell reads as a data cell
 *   liveText()       the text the cell classifies when it has no record: a
 *                    native cell's rendered text, a grid cell's flat text
 *   displayedText()  the text the screen shows now, for the capture
 *   rendered         whether liveText() is rendered text, so the piece layout
 *                    converts its positions to flat-text positions
 * @param {Element} cellEl
 * @param {{has: Function, get: Function, set: Function}} port
 * @param {{tagName: string, liveText: () => string, displayedText: () => string, rendered: boolean}} reads
 */
function makeCellObj(cellEl, port, reads) {
  const recordOf = () => (port.has(cellEl) ? port.get(cellEl) : null);
  const getText = () => {
    const record = recordOf();
    return record ? record.value : reads.liveText();
  };
  return {
    el: cellEl,
    tagName: reads.tagName,
    getRecord: recordOf,
    getText,
    getDisplayedText: reads.displayedText,
    // Null when the cell no longer holds as many pieces as its record; the
    // pass sorts that cell as rewritten before it reads a layout.
    // runsTogether reads rendered text only when called, because that read
    // lays out the page.
    getPieceLayout() {
      const live = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const record = recordOf();
      if (record && record.pieces.length !== live.length) return null;
      const original = record ? record.pieces.map((piece) => piece.text) : live;
      const runsTogether = (i) => showsPiecesTogether(cellEl.innerText || cellEl.textContent || '', live, i);
      if (!reads.rendered) return { original, toFlat: null, rendered: false, runsTogether };
      const text = getText();
      const toFlat = mapRenderedToFlat(text, original.join('')) || mapValueToPiece(text, original);
      return { original, toFlat, rendered: true, runsTogether };
    },
    // A write that lands nothing changes nothing: with every patch skipped the
    // screen keeps its text, and storing the hover text would record a
    // simplification that never happened.
    // The pass passes opts.value because a rendered-text read after another
    // cell's write lays out the whole table again: once per cell, a 10,000-cell
    // table takes most of a minute.
    /**
     * @param {object[]} patches - the cell's patches, in flat-text positions
     * @param {{value?: string}} [opts] - value: the text the pass classified;
     *   defaults to getText()
     * @returns {number} how many patches landed
     */
    applyPatches(patches, opts = {}) {
      const record = recordOf();
      const value = opts.value !== undefined ? opts.value : getText();
      const original = record
        ? record.pieces.map((piece) => piece.text)
        : collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      const { landed } = writePatches(cellEl, patches, original);
      if (landed === 0) return 0;
      const written = collectTextPieces(cellEl).map((piece) => piece.nodeValue);
      port.set(cellEl, {
        value,
        pieces: original.map((text, i) => ({ text, written: written[i] })),
        pageTitle: pageHoverText(cellEl, record),
      });
      if (cellEl.classList) cellEl.classList.add(SIMPLIFIED_CLASS);
      cellEl.title = originalHoverText(value);
      return landed;
    },
    // Hover text the page changed stays. A cell whose page set none ends with
    // no title attribute: the record holds no difference between an absent
    // attribute and an empty one. The caller drops the record.
    restore() {
      const record = recordOf();
      if (record) restoreTextPieces(cellEl, record.pieces);
      if (cellEl.classList) cellEl.classList.remove(SIMPLIFIED_CLASS);
      if (record && cellEl.title !== originalHoverText(record.value)) return;
      if (record && record.pageTitle) cellEl.title = record.pageTitle;
      else cellEl.removeAttribute('title');
    },
  };
}

/**
 * Build one grid cell's cell object (see makeCellObj). The grid adapter and
 * the geometry probe's numeric step both use it, so the two read a cell's text
 * the same way.
 * @param {Element} cellEl
 * @param {{has: Function, get: Function, set: Function}} port
 * @returns {{getText(): string, getPieceLayout(): PieceLayout|null,
 *            applyPatches(patches: object[], opts?: {value?: string}): number,
 *            restore(): void,
 *            getDisplayedText(): string, getRecord(): CellRecord|null, el: Element, tagName: string}}
 */
function makeGridCellObj(cellEl, port) {
  return makeCellObj(cellEl, port, {
    // The page marks a grid's header cell by role and puts its header row
    // outside every row group (_hasHeaderRow), so tagName is never 'TH'.
    tagName: 'TD',
    // The flat text: the coordinate space every patch position counts in.
    liveText() {
      const pieces = collectTextPieces(cellEl);
      if (pieces.length === 0) return cellEl.textContent || '';
      return pieces.map((piece) => piece.nodeValue).join('');
    },
    displayedText() { return cellEl.textContent || ''; },
    rendered: false,
  });
}

/**
 * The cell's text pieces in page order: every Text node under the cell,
 * whitespace-only and empty ones included. The walk falls back to child nodes
 * where no tree walker exists (a plain Node context).
 * @param {Element} cell
 * @returns {Text[]}
 */
function collectTextPieces(cell) {
  const pieces = [];
  const walker = typeof document !== 'undefined'
    ? document.createTreeWalker?.(cell, NodeFilter.SHOW_TEXT, null, false) : null;
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
 * @param {string} rendered
 * @param {string} flat
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
 * @param {string} rendered
 * @param {string[]} pieces
 * @returns {number[]|null}
 */
function mapValueToPiece(rendered, pieces) {
  const value = rendered.trim();
  if (value === '') return null;
  let candidates = pieces.map((text, i) => i).filter((i) => pieces[i].trim() === value);
  if (candidates.length !== 1) {
    candidates = pieces.map((text, i) => i).filter((i) => {
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
 * of a cell. Each index is a position in the cell's flat text. `original`,
 * when given, lists each piece's original text; without it the live pieces
 * serve. A patch is skipped when no piece holds its position or numStr is not
 * at that position. With no patch landed, or with a piece count that differs
 * from `original`, nothing is written. The caller records the cell as
 * simplified only on a landed count above zero.
 *
 * @param {Element} cell
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @param {string[]} [original]
 * @returns {{landed: number, pieces: {i: number, before: string, after: string}[]}}
 */
function writePatches(cell, patches, original) {
  if (!patches || patches.length === 0) return { landed: 0, pieces: [] };
  const pieces = collectTextPieces(cell);
  const live = pieces.map((piece) => piece.nodeValue);
  const from = original || live;
  if (from.length !== live.length) return { landed: 0, pieces: [] };
  const { texts, landed } = patchPieceTexts(from, patches);
  if (landed === 0) return { landed: 0, pieces: [] };
  const touched = [];
  texts.forEach((after, i) => {
    if (live[i] === after) return;
    pieces[i].nodeValue = after;
    touched.push({ i, before: live[i], after });
  });
  return { landed, pieces: touched };
}

/**
 * Each piece's text with its patches applied, and how many patches landed.
 * Patches apply right to left, so an earlier position is unaffected by a change
 * at a later one.
 * @param {string[]} texts
 * @param {{index: number, numStr: string, newNum: string}[]} patches
 * @returns {{texts: string[], landed: number}}
 */
function patchPieceTexts(texts, patches) {
  const spans = pieceSpans(texts);
  const byPiece = new Map();
  for (const patch of patches) {
    const span = pieceAt(spans, patch.index);
    if (!span) continue;
    if (!byPiece.has(span.i)) byPiece.set(span.i, []);
    byPiece.get(span.i).push(patch);
  }
  const out = texts.slice();
  let landed = 0;
  for (const [i, piecePatches] of byPiece) {
    let after = texts[i];
    for (const { index, numStr, newNum } of piecePatches.slice().sort((x, y) => y.index - x.index)) {
      const at = index - spans[i].start;
      if (after.substring(at, at + numStr.length) !== numStr) continue;
      after = after.substring(0, at) + newNum + after.substring(at + numStr.length);
      landed++;
    }
    out[i] = after;
  }
  return { texts: out, landed };
}

/**
 * Sort a cell by its record, the first step of every pass and every restore:
 *   'fresh'      the cell holds no record.
 *   'held'       the cell holds as many text pieces as its record, and each
 *                piece shows its original or its written text.
 *   'rewritten'  anything else: a piece holds text that is neither, or the
 *                piece count changed.
 * @param {Element} cell
 * @param {CellRecord|null|undefined} record
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
 * @param {Element} cell
 * @param {{text: string, written: string}[]} storedPieces
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

/**
 * The layout of a cell's text pieces, returned by the cell object's
 * getPieceLayout(). With no known counterpart for a rendered position, the
 * position stands, and a patch that misses there does not land.
 *
 * @typedef {object} PieceLayout
 * @property {string[]} original - each piece's text as the classified text saw it
 * @property {number[]|null} toFlat - for each position of the classified
 *   text, its position in the join of original; null when the positions count
 *   alike, and no entry for a position with no known counterpart
 * @property {boolean} rendered - whether the classified text is rendered
 *   text: true for a native cell, false for a grid cell
 * @property {(i: number) => boolean} runsTogether - whether the text the
 *   browser shows has piece i straight after piece i - 1 (see showsPiecesTogether)
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
