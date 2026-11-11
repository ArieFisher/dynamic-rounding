/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The cell layer of the lib/dr-table package: the cell object that both
 * adapters build for every cell, and the text-piece reads and writes under it.
 * Loaded by the manifest's content_scripts before adapters.js.
 *
 * The cell object (makeCellObj, makeGridCellObj) holds every cell write: its
 * applyPatches calls the patch writer, stores the cell's record through the
 * originals port, adds the dr-ext-rounded marker class, and sets the hover
 * text, and its restore() calls restoreTextPieces, removes the marker class,
 * and puts back the page's hover text. The patch writer (writePatches) and
 * restoreTextPieces write cell text in place, through nodeValue.
 *
 * Page reads in this file go to the page directly, with no port: the
 * text-piece walk (collectTextPieces), the rendered-text read of the cell
 * object's runsTogether, and the hover-text read (pageHoverText).
 */

/** Marker class on every cell the extension simplified (numbers, dates, and times), on native tables and grids alike. */
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
 * The hover text the extension gives a simplified cell: "Original: " and the
 * text the cell classified. A different live hover text is the page's.
 * @param {string} value
 * @returns {string}
 */
function originalHoverText(value) {
  return `Original: ${value}`;
}

/**
 * The page's hover text for a cell about to take a write. A cell with no
 * record has it read from the cell, on its first write. On a held cell, a live
 * hover text equal to the extension's hover text leaves the stored text in
 * place, and any other live hover text is the page's newer text, which
 * replaces it.
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
 * The cell object both adapters hand out: one read and one write over the
 * cell's text pieces, reading from the cell's record once the cell is
 * simplified. `reads` holds the differences between the kinds:
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
    // The cell's text pieces as getText() read them, for the placement step and
    // the patch step (the layout's shape is PieceLayout). Returns
    // null when the cell no longer holds as many pieces as its record; the
    // pass sorts that cell as a rewritten cell before it reads a layout.
    // runsTogether reads the cell's rendered text only when the placement step
    // calls it, because a rendered-text read lays out the page.
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
    // Write the patches and return how many landed (see writePatches).
    // A landed write replaces the cell's record (CellRecord) through the
    // originals port, adds the marker class, and sets the cell's hover text
    // to originalHoverText(value). A write that lands nothing changes nothing:
    // with every patch skipped the screen keeps its text, and storing the
    // hover text would record a simplification that never happened.
    // The pass passes opts.value because a native cell's getText() reads
    // rendered text, and a rendered-text read after another cell's write lays
    // out the whole table again: once per cell, a 10,000-cell table takes most
    // of a minute.
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
    // Undo the write on the page: put the originals back into every text piece
    // that still shows its written text (restoreTextPieces), remove the marker
    // class, and put back the hover text the page set (the record's pageTitle)
    // while the cell still shows the extension's own hover text. Hover text
    // the page changed stays. A cell whose page set none ends with no title
    // attribute, because the record holds no difference between an absent
    // attribute and an empty one. The record stays in the originals port;
    // the caller drops it.
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
 * the geometry probe's numeric step both build grid cells through it, so the
 * two read a cell's text the same way. Every write patches text pieces
 * through nodeValue — never textContent/innerHTML/appendChild/removeChild.
 * @param {Element} cellEl
 * @param {{has: Function, get: Function, set: Function}} port
 * @returns {{getText(): string, getPieceLayout(): PieceLayout|null,
 *            applyPatches(patches: object[], opts?: {value?: string}): number,
 *            restore(): void,
 *            getDisplayedText(): string, getRecord(): CellRecord|null, el: Element, tagName: string}}
 */
function makeGridCellObj(cellEl, port) {
  return makeCellObj(cellEl, port, {
    // A grid cell reads as a data cell. The page marks a grid's header cell by
    // role (GRID_CELL_SELECTOR) and puts its header row outside every row group
    // (_hasHeaderRow), so tagName is never 'TH'.
    tagName: 'TD',
    // The cell's flat text: the join of its text pieces in page order, the
    // coordinate space every patch position counts in. A cell with no text
    // piece reads its textContent.
    liveText() {
      const pieces = collectTextPieces(cellEl);
      if (pieces.length === 0) return cellEl.textContent || '';
      return pieces.map((piece) => piece.nodeValue).join('');
    },
    // The cell's live textContent, for the capture; it never reads the record.
    displayedText() { return cellEl.textContent || ''; },
    rendered: false,
  });
}

/**
 * The cell's text pieces in page order: every Text node under the cell,
 * whitespace-only and empty ones included. A patch position counts over the
 * join of these pieces (the cell's flat text), and the cell's record holds one
 * entry per piece, in this order. The function walks with the page's tree
 * walker when one exists, else walks child nodes depth-first, which visits the
 * same nodes in the same order.
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
 * browser collapses runs of spaces and line breaks in the markup to one space,
 * trims the ends, and adds a line break at a <br> or a block boundary, so a
 * pretty-printed cell's rendered text is shorter than its flat text before a
 * number. Returns an array holding, for each rendered position, its flat
 * position, or null when the two texts differ in anything but whitespace
 * (hidden text inside the cell, a CSS text transform), so the caller keeps
 * rendered positions as they are.
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
 * Where a cell's trimmed rendered text sits in its flat text, for a cell
 * whose two texts differ in more than whitespace: a hidden sort key ahead of
 * the value ("000000007002300" hidden, then "7,002,300"). The value sits in
 * the one piece whose trimmed text equals it, or else in the one piece that
 * holds it exactly once. Returns an array holding, for each rendered
 * position of the value, its flat position, with no entry for any other
 * rendered position, or null when no single piece qualifies.
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
 * of a cell. Each index is a position in the cell's flat text (flatPatches moves a
 * classified position there).
 *
 * `original`, when given, lists each piece's original text in page order, and
 * the patch positions count in the join of those texts; without it the live
 * pieces serve as the originals. Each piece's target text is its original with
 * its patches applied right to left, so an earlier position is unaffected by a
 * change at a later one. A patch is skipped when no piece holds its position
 * or numStr is not at that position.
 *
 * Every piece whose live text differs from its target takes the target,
 * written once through nodeValue; no node is added, removed, or replaced, so
 * <sup>, <a>, and every other node keep their identity. With no patch landed,
 * or with a cell that no longer holds one piece per original, nothing is
 * written.
 *
 * Returns the count of patches that landed, and each written piece's text
 * before and after the write. The caller records the cell as simplified only
 * on a landed count above zero, because a skipped patch leaves the screen
 * unchanged.
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
 * The patch positions count in the join of the texts; see
 * writePatches.
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
 * Put a cell's original text back into every text piece that still shows
 * the extension's written text, through nodeValue like the patch writer. A
 * piece the page rewrote keeps the page's text, so this never writes a
 * number the page no longer shows.
 *
 * With the piece count unchanged, each piece pairs with the stored piece at
 * its position. With the count changed, each live piece pairs with a stored
 * piece by text, in page order and at most once per stored piece: a live piece
 * whose text equals a stored piece's written text takes that piece's original,
 * and any other live piece keeps its text.
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
 * The layout of a cell's text pieces, which the cell object's
 * getPieceLayout() returns and the placement step and the patch step read.
 *
 * toFlat converts a native cell's rendered positions through
 * mapRenderedToFlat and, for a hidden sort key ahead of the value, maps the
 * trimmed rendered text to the one piece that holds it (mapValueToPiece).
 * With no such piece the rendered positions stand, and a patch that misses
 * there does not land.
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

// Each piece's text with its index and its start in the join of the texts.
function pieceSpans(texts) {
  let at = 0;
  return texts.map((text, i) => {
    const span = { i, start: at, text };
    at += text.length;
    return span;
  });
}

// The piece that holds the character at a position of the join of the spans'
// texts, or null. The one lookup of a piece by position.
function pieceAt(spans, at) {
  return spans.find((span) => span.start <= at && at < span.start + span.text.length) || null;
}
