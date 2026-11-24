// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * DynamicRounding lib/dr-table package bundle.
 *
 * Loaded LAST within lib/dr-table. The other files declare their functions as
 * bare top-level names, and their callers call those bare names. This file
 * adds a single DR_TABLE object that groups every public function and class,
 * so a consumer can depend on DR_TABLE.x instead. No file reads DR_TABLE.x yet.
 *
 * Do not add behavior.
 */

const DR_TABLE = {
  // cells.js
  makeCellObj,
  collectTextPieces,
  mapRenderedToFlat,
  writePatches,
  restoreTextPieces,
  sortCellByRecord,
  // adapters.js
  NativeTableAdapter,
  GridAdapter,
  makeAdapter,
  // classify.js
  getSuperscriptRanges,
  getMarkupRanges,
  classifyTableCell,
  // detect.js
  looksLikeGrid,
  findTargetTable,
  findTables,
  scanTables,
  chainRootOf,
  nominateNest,
  isAccessibilityArtifact,
  isDataTable,
  readTableFingerprint,
  sameTableFingerprint,
};
