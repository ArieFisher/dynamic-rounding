// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The text table step: takes a text and the tables an adapter found in it,
// and returns the text with every table simplified. Each table is one
// dataset. The step holds no engine code and no markdown code, so a caller
// adds a second adapter's tables to the same list.

import { classifyCell, tablePatches, applyPatches } from './library.js';

export function simplifyTables(text, tables, settings) {
  const patches = tables.flatMap((cells) => {
    const entries = cells.map((cell) =>
      ({ ...cell, decision: classifyCell({ ...cell, ranges: null }, settings) }));
    // A patch counts its position in the cell's text. The cell's start moves
    // it to its position in the whole text, so one call applies every patch.
    return tablePatches(entries, settings).cells.flatMap(({ entry, patches: cellPatches }) =>
      cellPatches.map((patch) => ({ ...patch, index: patch.index + entry.start })));
  });
  return applyPatches(text, patches);
}
