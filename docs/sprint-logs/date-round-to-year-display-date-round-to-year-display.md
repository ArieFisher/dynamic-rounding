# Sprint Log: date-round-to-year-display

**Plan:** docs/sprint-plans/date-round-to-year-display.md
**Sprint goal:** Round date cells to a whole year and display only the year, matching the user-described semantics for year / decade / century granularities.
**Date:** 2026-05-27
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Rewrote `roundDateText` per §3.1 algorithm (fractional year + Jul 1 boundary, `Math.round` to base 1/10/100, return 4-digit year string). Added `parseDateLike` for unambiguous shapes (ISO dash/slash, named-month variants, bare year) and `parseAmbiguousNumericDate` for all-numeric `M/D/Y` / `M-D-Y` shapes with 2- and 4-digit year support (50-pivot). Extended the mode-classification pass to tag ambiguous-numeric cells with their raw `{n1, n2, year}` payload, then added a column post-pass between the row loop and the rendering loop that resolves each column's MDY/DMY/MIXED/AMBIGUOUS hint and either rewrites cells with concrete `{month, day, year}` or downgrades them to `mode: 'skip'`. Dropped the `formattedValue === null` half of the dispatch-site guard. Diff: `chrome-extension/content.js | 237 ++++++++++++++++++++++++++-----`.
- **Tests:** pass (chrome-extension: 446, js: 103). Test-writer added ~73 new assertions covering all 9 acceptance-criterion blocks and corrected 7 pre-existing tests that asserted the old `null`-on-no-change contract.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:**
  - MDY-column test is non-discriminating on its own (both interpretations of `03-04-2022` yield 2022); the DMY test using `12-03-2022` is properly discriminating (MDY → Dec → 2023; DMY → Mar → 2022), so the suite as a whole proves the resolver picks the correct side. Consider strengthening the MDY test in a follow-up.
  - Shape `06-21-2020` from the §5 acceptance criteria isn't asserted end-to-end; the implementation handles it correctly (column auto-detect forces MDY when n2=21>12), but a single-row `roundTable` test would close the loop.
  - `isYearValue` is retained as a test-compat helper; harmless but technically dead outside of tests.

## PR
(opened by orchestrator after this log is committed)
