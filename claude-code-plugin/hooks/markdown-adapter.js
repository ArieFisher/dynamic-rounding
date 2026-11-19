// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The markdown adapter: presents the markdown tables in a text as cells.
// markdownTables returns one list of cells per table. A cell is
// { text, rowIndex, columnIndex, start }, where start is the position of the
// cell's text in the whole text. A cell carries no kind flag, so the text
// table step works the same on any adapter's cells.

const FENCE = /^\s*(`{3,}|~{3,})/;
// Matched against a trimmed line. With the outer whitespace in the pattern,
// the match time grows with the square of a long run of spaces.
const SEPARATOR_ROW = /^(?=.*\|)\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

const isSeparatorRow = (line) => SEPARATOR_ROW.test(line.trim());

function fenceParts(line) {
  const match = FENCE.exec(line);
  return match === null ? null : { fence: match[1], rest: line.slice(match[0].length) };
}

// The opening fence on a line, or null. A line with a backtick after its
// backtick fence is inline code, and holds no opening fence.
function openingFence(line) {
  const parts = fenceParts(line);
  if (parts === null) return null;
  return parts.fence[0] === '`' && parts.rest.includes('`') ? null : parts.fence;
}

// A fenced code block ends at a fence of its opening fence's character, at
// least as long, with nothing after it. Any other fence line is a line of the
// block, so a block can hold a shorter fence or one of the other character.
function isClosingFence(line, fence) {
  const parts = fenceParts(line);
  return parts !== null && parts.fence[0] === fence[0]
    && parts.fence.length >= fence.length && parts.rest.trim() === '';
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
  const isRow = (entry) => entry !== undefined && entry.line.includes('|') && openingFence(entry.line) === null;
  const tables = [];
  // The opening fence of the fenced code block the walk is inside, or null.
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    if (fence !== null) {
      if (isClosingFence(lines[i].line, fence)) fence = null;
      continue;
    }
    fence = openingFence(lines[i].line);
    const isHeaderRow = isRow(lines[i])
      && lines[i + 1] !== undefined && isSeparatorRow(lines[i + 1].line);
    if (!isHeaderRow) continue;

    const rows = [lines[i]];
    for (let j = i + 2; isRow(lines[j]); j++) rows.push(lines[j]);
    tables.push(rows.flatMap(rowCells));
    // Step past the separator row and the body rows.
    i += rows.length;
  }
  return tables;
}
