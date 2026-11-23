// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Reading the setting values a user writes: the range expression, the
 * offsets, and num_top. Reads no page and calls no Chrome.
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
  if (m[1] && col === null) return null;
  const row = m[2] ? parseInt(m[2], 10) - 1 : null;
  if (m[2] && (row < 0 || !isFinite(row))) return null;
  return { col, row };
}

function parseRangeToken(token) {
  const t = token.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const parts = t.split(':');
    if (parts.length !== 2) return null;
    const l = parseRangeEndpoint(parts[0]);
    const r = parseRangeEndpoint(parts[1]);
    if (!l || !r) return null;
    // Open-ended semantics: left-null = unbounded below (0), right-null = unbounded above (Infinity).
    const lcol = l.col === null ? 0 : l.col;
    const rcol = r.col === null ? Infinity : r.col;
    const lrow = l.row === null ? 0 : l.row;
    const rrow = r.row === null ? Infinity : r.row;
    return {
      colMin: Math.min(lcol, rcol),
      colMax: Math.max(lcol, rcol),
      rowMin: Math.min(lrow, rrow),
      rowMax: Math.max(lrow, rrow)
    };
  }
  const e = parseRangeEndpoint(t);
  if (!e) return null;
  return {
    colMin: e.col ?? 0,
    colMax: e.col ?? Infinity,
    rowMin: e.row ?? 0,
    rowMax: e.row ?? Infinity
  };
}

function parseRangeExpr(expr) {
  if (typeof expr !== 'string') return { ranges: null };
  const trimmed = expr.trim();
  if (!trimmed) return { ranges: null }; // null = whole table
  const stripped = trimmed.replace(/^\{/, '').replace(/\}$/, '');
  const tokens = stripped.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { ranges: null };
  const ranges = [];
  for (const tok of tokens) {
    const r = parseRangeToken(tok);
    if (!r) return { error: `Invalid range: "${tok}"` };
    ranges.push(r);
  }
  return { ranges };
}

function isInRanges(r, c, ranges) {
  if (!ranges) return true;
  for (const range of ranges) {
    if (r >= range.rowMin && r <= range.rowMax &&
        c >= range.colMin && c <= range.colMax) {
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
