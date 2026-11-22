// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The text table step: takes a text and the tables an adapter found in it,
// and returns the text with every table simplified. Each table is one
// dataset. The step holds no engine code and no markdown code, so a caller
// can add a second adapter's tables to the same list.

import { classifyCell, tablePatches, applyPatches } from './library.js';

export function simplifyTables(text, tables, settings) {
  const patches = tables.flatMap((cells) => {
    const classifiedCells = cells.map((cell) =>
      ({ ...cell, classification: classifyCell(cell, settings) }));
    // A patch's index is a position in the cell's text. That index plus the
    // cell's start is its position in the whole text, so applyPatches applies
    // every patch in one call.
    return tablePatches(classifiedCells, settings).patchedCells.flatMap(
      ({ classifiedCell, patches: cellPatches }) =>
        cellPatches.map((patch) => ({ ...patch, index: patch.index + classifiedCell.start })));
  });
  return applyPatches(text, patches);
}
