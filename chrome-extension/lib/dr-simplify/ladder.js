/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The classification ladder: the ordered per-cell decision rules that decide
 * whether and how a cell simplifies. Before this file, the ladder existed as
 * two hand-kept-in-sync copies — the engine's per-cell loop in content.js
 * (duplicated again between the native-<table> path and the virtualized-grid
 * path, which documented itself as needing to match the native path "EXACTLY")
 * and a third, much thinner copy in the sidebar preview-sample extractor that
 * skipped most of the rules outright. All three now call classifyCell below.
 *
 * PURE: classifyCell takes plain cell values (text, row/column position,
 * a pre-parsed range list, and a handful of caller-computed booleans/ranges
 * standing in for the few checks that inherently need the DOM — whole-cell
 * link, and superscript/footnote position) plus a plain options bag. It never
 * touches a page element and returns its decision as data. It depends only on
 * DR_NUMBER's bare names (parsing/rounding), loaded ahead of this file.
 *
 * DOM-only work the ladder deliberately does NOT do: isCellWholeLink and
 * getSuperscriptRanges (both in lib/dr-table) require walking real text
 * nodes, so callers compute isWholeLink/hasSuperscript/superscriptRanges once
 * per cell and pass them in as plain data. filterLinkMatches (also
 * lib/dr-table) has the same requirement for the individual numbers inside a
 * mixed-text cell; since filters are independent per-match predicates, their
 * order never changes the result, so a caller that produces 'extracted'
 * matches is expected to run filterLinkMatches over decision.value.matches
 * afterward and, if that empties the list, downgrade the decision to
 * { mode: 'skip', reason: decision.reason } itself. That single downgrade
 * check has exactly one call site (the native-table path — grids never
 * reach 'extracted', see allowExtracted below) so it is not a second copy of
 * ladder logic.
 */

/**
 * True when trimmedText is a single balanced ASCII double-quoted span
 * spanning the entire cell (e.g. `"12345"`). Such cells are left untouched —
 * quoting is read as "treat this text literally," not as a number to round.
 */
function isWholeCellQuoted(trimmedText) {
  return trimmedText.startsWith('"') && trimmedText.endsWith('"') &&
    (trimmedText.match(/"/g) || []).length === 2;
}

/**
 * Drop any match overlapping a masked range (quote spans or superscript
 * spans, both in the same flat-text coordinate space extractNumbersInText
 * uses). A no-op when ranges is empty.
 */
function filterMaskedMatches(matches, ranges) {
  if (!ranges || ranges.length === 0) return matches;
  return matches.filter((m) => !overlapsQuoteRange(ranges, m.index, m.index + m.numStr.length));
}

/**
 * Every text-only filter mode:'extracted' applies before a caller's DOM-only
 * link filter: pull numbers out of `text`, mask anything inside a quoted
 * span or a superscript span, then drop era-marked years (issue #4 — "2898
 * AD" is a date, not a quantity). superscriptRanges is caller-supplied plain
 * data (see file header); pass [] when the cell carries no <sup>.
 */
function extractSimplifyMatches(text, superscriptRanges) {
  let matches = extractNumbersInText(text);
  matches = filterMaskedMatches(matches, getQuoteMaskedRanges(text));
  matches = filterMaskedMatches(matches, superscriptRanges);
  matches = matches.filter((m) => !isEraYear(text, m.index, m.numStr));
  return matches;
}

/**
 * Classify a single cell and return a decision: { mode, reason, value?,
 * pending? }.
 *
 *   mode: 'skip' | 'pure' | 'date' | 'time' | 'extracted'
 *   reason: one of the ladder's rule names — 'out-of-range', 'first-row',
 *     'first-column', 'percent', 'currency', 'quoted', 'link', 'footnote',
 *     'dates-disabled', 'times-disabled', 'mixed-disabled', 'no-number',
 *     'ambiguous-date', or 'simplify' for a cell that rounds.
 *   value: mode-specific payload —
 *     'pure' → { num }
 *     'date' (resolved) → { month, day, year }
 *     'date' (needs the column post-pass) → { ambiguous: { n1, n2, year } },
 *       plus pending: 'ambiguous-date'
 *     'extracted' → { matches } — matches still need a caller-side
 *       filterLinkMatches pass; see file header.
 *
 * @param {object} input
 * @param {string} input.text - raw cell text (as returned by the adapter)
 * @param {number} input.rowIndex
 * @param {number} input.columnIndex
 * @param {Array|null} input.ranges - parseRangeExpr(...).ranges (already parsed once per table)
 * @param {boolean} [input.isWholeLink] - isCellWholeLink(cell) result
 * @param {boolean} [input.hasSuperscript] - !!cell.querySelector('sup')
 * @param {{start:number,end:number}[]} [input.superscriptRanges] - getSuperscriptRanges(cell) result
 * @param {boolean} [input.allowExtracted=true] - false on the grid path, which
 *   cannot patch multi-node HTML (issue #120) and so never enters mode:'extracted'
 * @param {object} options - resolved rounding options (simplifyFirstRow,
 *   simplifyFirstColumn, simplifyMixedPercent, simplifyMixedCurrency,
 *   simplifyDates, simplifyTimes, simplifyMixedCells)
 * @returns {{mode: string, reason: string, value?: object, pending?: string}}
 */
function classifyCell(input, options) {
  const {
    text,
    rowIndex,
    columnIndex,
    ranges,
    isWholeLink = false,
    hasSuperscript = false,
    superscriptRanges = [],
    allowExtracted = true,
  } = input;
  const trimmed = typeof text === 'string' ? text.trim() : '';

  if (!isInRanges(rowIndex, columnIndex, ranges)) {
    return { mode: 'skip', reason: 'out-of-range' };
  }

  const exclusion = getExclusionReason(text, columnIndex, options, rowIndex);
  if (exclusion === 'firstRow') return { mode: 'skip', reason: 'first-row' };
  if (exclusion === 'firstColumn') return { mode: 'skip', reason: 'first-column' };
  if (exclusion === 'percent') return { mode: 'skip', reason: 'percent' };
  if (exclusion === 'currency') return { mode: 'skip', reason: 'currency' };

  if (isWholeCellQuoted(trimmed)) {
    return { mode: 'skip', reason: 'quoted' };
  }

  if (isDateTimeLike(trimmed)) {
    // ISO date-time follows the time instruction (date preserved). Checked
    // before isDateLike, which would otherwise match a space-separated form.
    return options.simplifyTimes
      ? { mode: 'time', reason: 'simplify' }
      : { mode: 'skip', reason: 'times-disabled' };
  }

  if (isDateLike(trimmed)) {
    if (!options.simplifyDates) return { mode: 'skip', reason: 'dates-disabled' };
    const ambiguous = parseAmbiguousNumericDate(trimmed);
    if (ambiguous !== null) {
      return { mode: 'date', reason: 'simplify', pending: 'ambiguous-date', value: { ambiguous } };
    }
    const parsed = parseDateLike(trimmed);
    return { mode: 'date', reason: 'simplify', value: { month: parsed.month, day: parsed.day, year: parsed.year } };
  }

  if (isTimeLike(trimmed)) {
    return options.simplifyTimes
      ? { mode: 'time', reason: 'simplify' }
      : { mode: 'skip', reason: 'times-disabled' };
  }

  const num = toNumber(text);
  if (num !== null) {
    if (isWholeLink) return { mode: 'skip', reason: 'link' };

    if (hasSuperscript) {
      // The cell contains a <sup> element: the flattened text mixes base and
      // exponent digits (e.g. "10<sup>12</sup>" -> "1012"). Route through
      // extraction so superscript masking can protect the exponent, instead
      // of rounding the flattened (wrong) number.
      if (!options.simplifyMixedCells || !allowExtracted) {
        return { mode: 'skip', reason: 'footnote' };
      }
      const matches = extractSimplifyMatches(text, superscriptRanges);
      if (matches.length === 0) return { mode: 'skip', reason: 'footnote' };
      return { mode: 'extracted', reason: 'footnote', value: { matches } };
    }

    return { mode: 'pure', reason: 'simplify', value: { num } };
  }

  if (!options.simplifyMixedCells || !allowExtracted) {
    return { mode: 'skip', reason: 'mixed-disabled' };
  }
  const matches = extractSimplifyMatches(text, superscriptRanges);
  if (matches.length === 0) return { mode: 'skip', reason: 'no-number' };
  return { mode: 'extracted', reason: 'simplify', value: { matches } };
}

/**
 * Decide how to read a column's ambiguous N1/N2/Y dates (e.g. "03/04/2020"),
 * given every ambiguous date's {n1, n2} found in that column. Any n > 12 in
 * one position rules out that position being the month, so a lone violator
 * pins the whole column's format; violators on both sides make the column
 * unsafe to guess ('MIXED'); no violator leaves it genuinely ambiguous
 * ('AMBIGUOUS').
 *
 * @param {{n1: number, n2: number}[]} ambiguousList
 * @returns {'MDY'|'DMY'|'MIXED'|'AMBIGUOUS'}
 */
function pickDateFormatHint(ambiguousList) {
  let hasN1gt12 = false;
  let hasN2gt12 = false;
  for (const { n1, n2 } of ambiguousList) {
    if (n1 > 12) hasN1gt12 = true;
    if (n2 > 12) hasN2gt12 = true;
  }
  if (hasN1gt12 && !hasN2gt12) return 'DMY'; // n1 is day, n2 is month
  if (hasN2gt12 && !hasN1gt12) return 'MDY'; // n1 is month, n2 is day
  if (hasN1gt12 && hasN2gt12) return 'MIXED';
  return 'AMBIGUOUS';
}

/**
 * Turn a pending ambiguous-date decision (classifyCell's pending:
 * 'ambiguous-date') into its final decision, given the column's format hint
 * from pickDateFormatHint. MDY/DMY resolve to a concrete date; MIXED/
 * AMBIGUOUS cannot be read safely and downgrade to skip.
 *
 * @param {{value: {ambiguous: {n1:number, n2:number, year:number}}}} decision
 * @param {'MDY'|'DMY'|'MIXED'|'AMBIGUOUS'} hint
 * @returns {{mode: string, reason: string, value?: object}}
 */
function resolveAmbiguousDateDecision(decision, hint) {
  const { ambiguous } = decision.value;
  if (hint === 'MDY') {
    return { mode: 'date', reason: 'simplify', value: { month: ambiguous.n1, day: ambiguous.n2, year: ambiguous.year } };
  }
  if (hint === 'DMY') {
    return { mode: 'date', reason: 'simplify', value: { month: ambiguous.n2, day: ambiguous.n1, year: ambiguous.year } };
  }
  return { mode: 'skip', reason: 'ambiguous-date' };
}
