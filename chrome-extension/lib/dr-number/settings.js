// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Reading the setting values a user writes (the range expression, the
 * offsets, and num_top) and testing whether a cell lies inside the range
 * expression. Reads no page and calls no Chrome.
 */

// The largest offset, either way, that a setting value may hold.
const VALIDATION_LIMIT = 20;

function lettersToColIndex(letters) {
  const up = letters.toUpperCase();
  let n = 0;
  for (let i = 0; i < up.length; i++) {
    const code = up.charCodeAt(i);
    if (code < 65 || code > 90) return null;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseRangeEndpoint(token) {
  const m = token.trim().match(/^([A-Za-z]+)?(\d+)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const col = m[1] ? lettersToColIndex(m[1]) : null;
  const row = m[2] ? parseInt(m[2], 10) - 1 : null;
  if (m[2] && (row < 0 || !isFinite(row))) return null;
  return { col, row };
}

function parseRangeToken(token) {
  const parts = token.split(':');
  if (parts.length > 2) return null;
  const left = parseRangeEndpoint(parts[0]);
  const right = parseRangeEndpoint(parts[parts.length - 1]);
  if (!left || !right) return null;
  // An endpoint with no column or no row leaves that side open: the left side
  // from the first column or row, the right side to the last.
  const leftCol = left.col ?? 0;
  const rightCol = right.col ?? Infinity;
  const leftRow = left.row ?? 0;
  const rightRow = right.row ?? Infinity;
  return {
    colMin: Math.min(leftCol, rightCol),
    colMax: Math.max(leftCol, rightCol),
    rowMin: Math.min(leftRow, rightRow),
    rowMax: Math.max(leftRow, rightRow)
  };
}

function parseRangeExpr(expr) {
  if (typeof expr !== 'string') return { ranges: null };
  const stripped = expr.trim().replace(/^\{/, '').replace(/\}$/, '');
  const tokens = stripped.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { ranges: null }; // null = whole table
  const ranges = [];
  for (const token of tokens) {
    const range = parseRangeToken(token);
    if (!range) return { error: `Invalid range: "${token}"` };
    ranges.push(range);
  }
  return { ranges };
}

function isInRanges(rowIndex, columnIndex, ranges) {
  if (!ranges) return true;
  for (const range of ranges) {
    if (rowIndex >= range.rowMin && rowIndex <= range.rowMax &&
        columnIndex >= range.colMin && columnIndex <= range.colMax) {
      return true;
    }
  }
  return false;
}

function resolveOffset(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(num)) return fallback;
  if (num < -VALIDATION_LIMIT || num > VALIDATION_LIMIT) return fallback;
  return num;
}

function resolveNumTop(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  if (!isFinite(num) || num < 1) return fallback;
  return Math.floor(num);
}
