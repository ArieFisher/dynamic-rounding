// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The markdown adapter: presents the markdown tables in a text as cells.
// markdownTables returns one list of cells per table. A cell is
// { text, rowIndex, columnIndex, start }, where start is the position of the
// cell's text in the whole text. A cell carries no kind flag, so the text
// table step works the same on any adapter's cells.

const FENCE = /^(\s*)(`{3,}|~{3,})/;
// Four columns: the indentation at which markdown reads a line as code, and
// the width a tab counts for.
const CODE_INDENT = 4;
// Matched against a trimmed line. With the outer whitespace in the pattern,
// the match time grows with the square of a long run of spaces.
const SEPARATOR_ROW = /^(?=.*\|)\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

const isSeparatorRow = (entry) => entry !== undefined && SEPARATOR_ROW.test(entry.line.trim());
const isRow = (entry) => entry !== undefined && entry.line.includes('|') && openingFence(entry.line) === null;

function fenceParts(line) {
  const match = FENCE.exec(line);
  if (match === null) return null;
  const [whole, indent, fence] = match;
  const columns = [...indent].reduce((sum, character) => sum + (character === '\t' ? CODE_INDENT : 1), 0);
  return { fence, columns, rest: line.slice(whole.length) };
}

// A line with a backtick after its backtick fence is inline code, and holds no
// opening fence. The indentation has no limit here, because a fence inside a
// list item sits as deep as the item's text.
function openingFence(line) {
  const parts = fenceParts(line);
  if (parts === null) return null;
  return parts.fence[0] === '`' && parts.rest.includes('`') ? null : parts;
}

// A fence line that fails this test is a line of the block, so a block can
// hold a shorter fence, one of the other character, or an indented one.
function isClosingFence(line, opening) {
  const parts = fenceParts(line);
  return parts !== null && parts.fence[0] === opening.fence[0]
    && parts.fence.length >= opening.fence.length && parts.rest.trim() === ''
    && parts.columns - opening.columns < CODE_INDENT;
}

function linesWithStart(text) {
  let start = 0;
  return text.split('\n').map((line) => {
    const entry = { line, start };
    start += line.length + 1;
    return entry;
  });
}

function rowCells({ line, start }, rowIndex) {
  const pieces = [];
  let pieceStart = 0;
  for (let i = 0; i <= line.length; i++) {
    // A backslash keeps the character after it in the cell, so "\|" splits
    // no cell. A backslash that ends the line has no character to keep.
    if (line[i] === '\\' && i + 1 < line.length) {
      i++;
    } else if (i === line.length || line[i] === '|') {
      pieces.push({ text: line.slice(pieceStart, i), start: start + pieceStart });
      pieceStart = i + 1;
    }
  }
  // The outer pipes are optional: a blank piece before the first pipe or
  // after the last one is no cell.
  const isOutside = (piece) => piece.text.trim() === '';
  return pieces
    .slice(isOutside(pieces[0]) ? 1 : 0, isOutside(pieces.at(-1)) ? -1 : undefined)
    .map((piece, columnIndex) => ({ ...piece, rowIndex, columnIndex }));
}

// The header row is row 0 and the separator row presents no cells. A table
// inside a fenced code block is not a markdown table, and an unclosed fence
// covers the rest of the text.
export function markdownTables(text) {
  const lines = linesWithStart(text);
  const tables = [];
  // The opening fence of the fenced code block the walk is inside, or null.
  let opening = null;
  for (let i = 0; i < lines.length; i++) {
    if (opening !== null) {
      if (isClosingFence(lines[i].line, opening)) opening = null;
      continue;
    }
    opening = openingFence(lines[i].line);
    const isHeaderRow = isRow(lines[i]) && isSeparatorRow(lines[i + 1]);
    if (!isHeaderRow) continue;

    const rows = [lines[i]];
    let j = i + 2;
    for (; isRow(lines[j]); j++) rows.push(lines[j]);
    tables.push(rows.flatMap(rowCells));
    i = j - 1;
  }
  return tables;
}
