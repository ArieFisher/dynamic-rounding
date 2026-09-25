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
 * check lives in one caller-side function, which the native-table path, the
 * grid path, and the preview-sample extractor all call, so it is not a
 * second copy of ladder logic.
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
 * Drop any match overlapping a masked range (a quote span, an identifier
 * span, a superscript span, or an era-marked year, all in the same flat-text
 * coordinate space extractNumbersInText uses). A no-op when ranges is empty.
 */
function filterMaskedMatches(matches, ranges) {
  if (!ranges || ranges.length === 0) return matches;
  return matches.filter((m) => !overlapsQuoteRange(ranges, m.index, m.index + m.numStr.length));
}

/**
 * Every text-only filter mode:'extracted' applies before a caller's DOM-only
 * link filter: pull numbers out of `text` and drop each one inside a masked
 * range — a quoted span, an identifier span ("Call 416-555-1234"; see
 * getIdentifierMaskedRanges in lib/dr-number/identifiers.js), a superscript
 * span, or an era-marked year (issue #4 — "2898 AD" is a date, not a
 * quantity). The masked ranges are one list, so a new kind of text whose
 * numbers stay as written is one more source here. superscriptRanges is
 * caller-supplied plain data (see file header); pass [] when the cell
 * carries no <sup>. The identifier scan reads the text with each superscript
 * span blanked to spaces, so a footnote marker right after a phone number
 * ("416-555-1234<sup>1</sup>") never joins its digits; the blanks keep every
 * position in place.
 */
function extractSimplifyMatches(text, superscriptRanges) {
  const superscripts = superscriptRanges || [];
  const shapeText = superscripts.reduce(
    (t, r) => t.slice(0, r.start) + ' '.repeat(r.end - r.start) + t.slice(r.end), text);
  const masked = [
    ...getQuoteMaskedRanges(text),
    ...getIdentifierMaskedRanges(shapeText),
    ...superscripts,
    ...eraYearDigitRanges(text),
  ];
  return filterMaskedMatches(extractNumbersInText(text), masked);
}

/**
 * Classify a single cell and return a decision: { mode, reason, value?,
 * pending? }.
 *
 *   mode: 'skip' | 'pure' | 'date' | 'time' | 'extracted'
 *   reason: one of the ladder's rule names — 'out-of-range', 'first-row',
 *     'first-column', 'percent', 'currency', 'quoted', 'identifier', 'link',
 *     'footnote', 'dates-disabled', 'times-disabled', 'mixed-disabled',
 *     'no-number', 'ambiguous-date', 'simplify' for a cell that rounds, or
 *     'unit' for a unit number (see matchUnitNumber in lib/dr-number), which
 *     rounds.
 *   value: mode-specific payload —
 *     'pure' → { num }
 *     'date' (resolved) → { month, day, year }
 *     'date' (needs the column post-pass) → { ambiguous: { n1, n2, year } },
 *       plus pending: 'ambiguous-date'
 *     'extracted' → { matches } — matches still need a caller-side
 *       filterLinkMatches pass; see file header. A unit number holds one
 *       match.
 *
 * @param {object} input
 * @param {string} input.text - raw cell text (as returned by the adapter)
 * @param {number} input.rowIndex
 * @param {number} input.columnIndex
 * @param {Array|null} input.ranges - parseRangeExpr(...).ranges (already parsed once per table)
 * @param {boolean} [input.isWholeLink] - isCellWholeLink(cell) result
 * @param {boolean} [input.hasSuperscript] - !!cell.querySelector('sup')
 * @param {{start:number,end:number}[]} [input.superscriptRanges] - getSuperscriptRanges(cell) result
 * @param {boolean} [input.digitsSpanPieces] - true when the cell's digits sit
 *   in more than one text piece (see matchIdentifierShape)
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
    digitsSpanPieces = false,
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
  // Fail closed: any non-null exclusion reason this ladder does not recognize
  // still skips the cell, instead of silently falling through to simplify it.
  if (exclusion) return { mode: 'skip', reason: 'excluded' };

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

  // An identifier shape (a phone number, an IP address, a web or email
  // address, an ISBN, a postal code, or a digit run split by whitespace that
  // is not thousands grouping) reads as a code, not a quantity, so the whole
  // cell stays as written. Checked after the date and time checks above, so
  // a date the date parser reads ("21 June 2020") stays a date, and before
  // the bracketed-number check below, since a phone number's bracketed area
  // code ("(416) 555-1234") is not that bracket's minus sign.
  // matchIdentifierShape (lib/dr-number/identifiers.js) holds the one list of
  // shapes; this is the one place that reads it. digitsSpanPieces comes from
  // the caller's piece layout, so a stacked cell's join of several numbers
  // never reads as one spaced identifier. A cell with a <sup> takes the
  // footnote path below instead: its flattened text joins base and exponent
  // digits ("20 10<sup>15</sup>" reads "20 1015"), which is not the text the
  // reader sees, so no shape is tested against it.
  if (!hasSuperscript && matchIdentifierShape(trimmed, digitsSpanPieces)) {
    return { mode: 'skip', reason: 'identifier' };
  }

  // A bracketed number ("(1,234)", "$(1,234)") is one number whose minus sign
  // is written as the brackets around it. Its digits alone change, which is
  // the extracted write, so the brackets stay where the page put them — and a
  // page that gives a bracket its own text piece no longer holds the cell
  // back, because the placement step then measures the digits alone. It
  // rounds whatever the words setting holds, as a pure cell does. A cell with
  // a <sup> takes the footnote path below instead, so its exponent stays
  // masked; extractSimplifyMatches reads the same bracket sign there.
  const bracketed = hasSuperscript ? null : matchBracketedNumber(text);
  if (bracketed) {
    if (isWholeLink) return { mode: 'skip', reason: 'link' };
    return { mode: 'extracted', reason: 'simplify', value: { matches: [bracketed] } };
  }

  const num = toNumber(text);
  if (num !== null) {
    if (isWholeLink) return { mode: 'skip', reason: 'link' };

    if (hasSuperscript) {
      // The cell contains a <sup> element: the flattened text mixes base and
      // exponent digits (e.g. "10<sup>12</sup>" -> "1012"). Route through
      // extraction so superscript masking can protect the exponent, instead
      // of rounding the flattened (wrong) number.
      if (!options.simplifyMixedCells) {
        return { mode: 'skip', reason: 'footnote' };
      }
      const matches = extractSimplifyMatches(text, superscriptRanges);
      if (matches.length === 0) return { mode: 'skip', reason: 'footnote' };
      return { mode: 'extracted', reason: 'footnote', value: { matches } };
    }

    return { mode: 'pure', reason: 'simplify', value: { num } };
  }

  // A unit number ("4.91tn", "CAD45.67") is one number with a suffix or a
  // currency code, so it rounds like a pure cell whatever the words setting
  // holds. Its digits alone change, which is the extracted write, so it
  // takes mode:'extracted' with its one match. A cell with a <sup> takes the
  // footnote path above instead, so its exponent stays masked.
  const unit = hasSuperscript ? null : matchUnitNumber(text);
  if (unit) {
    if (isWholeLink) return { mode: 'skip', reason: 'link' };
    return { mode: 'extracted', reason: 'unit', value: { matches: [unit] } };
  }

  if (!options.simplifyMixedCells) {
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
