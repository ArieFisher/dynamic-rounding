// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The markdown adapter: presents the markdown tables in a text as cells.
// markdownTables returns one list of cells per table. A cell is
// { text, rowIndex, columnIndex, start }, where start is the position of the
// cell's text in the whole text. A cell carries no kind flag, so the text
// table step works the same on any adapter's cells.

const FENCE = /^\s*(```|~~~)/;
const SEPARATOR_ROW = /^(?=.*\|)\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

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

// The header row is row 0 and the separator row presents no cells. A fence
// line opens or closes a fenced code block, and an unclosed fence covers the
// rest of the text. A table inside one is not a markdown table.
export function markdownTables(text) {
  const lines = linesWithStart(text);
  const isRow = (entry) => entry !== undefined && entry.line.includes('|') && !FENCE.test(entry.line);
  const tables = [];
  let isInFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i].line)) isInFence = !isInFence;
    const isHeaderRow = !isInFence && isRow(lines[i])
      && lines[i + 1] !== undefined && SEPARATOR_ROW.test(lines[i + 1].line);
    if (!isHeaderRow) continue;

    const rows = [lines[i]];
    for (let j = i + 2; isRow(lines[j]); j++) rows.push(lines[j]);
    tables.push(rows.flatMap(rowCells));
    // Step past the separator row and the body rows.
    i += rows.length;
  }
  return tables;
}
