// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The text table step. tables holds one list of cells per table, and each
// table is one dataset. A cell is { text, rowIndex, columnIndex, start,
// markupRanges }, where start is the position of the cell's text in the whole
// text, and markupRanges holds the cell's markup ranges as positions in its
// text. A cell carries no kind flag, and the step holds no engine code and no
// markdown code, so a caller can add a second adapter's tables to the same
// list.

import { classifyCell, tablePatches, applyPatches } from './library.js';

export function simplifyTables(text, tables, settings) {
  return applyPatches(text, tables.flatMap((cells) => {
    const entries = cells.map((cell) =>
      ({ ...cell, decision: classifyCell(cell, settings) }));
    return tablePatches(entries, settings).cells.flatMap(({ entry, patches }) =>
      // A patch's index is a position in the cell's text. That index plus the
      // cell's start is its position in the whole text, so applyPatches
      // applies every patch in one call.
      patches.map((patch) => ({ ...patch, index: patch.index + entry.start })));
  }));
}
