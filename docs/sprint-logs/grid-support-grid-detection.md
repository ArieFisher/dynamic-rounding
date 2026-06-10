# Sprint Log: grid-detection

**Plan:** docs/sprint-plans/grid-support.md
**Sprint goal:** Discover data grids and badge them with the existing toggle dot. Proactive cheap pass for native/ARIA grids on page load; lazy right-click structural walk-up for unlabelled div-grids. No rounding this sprint.
**Date:** 2026-06-10
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Added module-level `looksLikeGrid(el)` (cheap-first ladder: child count ≥ `GRID_MIN_CHILDREN` → repetitive structure → consistent cell count → grid/flex layout → mandatory numeric-content guard → column-width geometry probe last, bounded to `GRID_COL_WIDTH_SAMPLE`; ARIA `role`/library-class short-circuit before the geometry probe; row height never tested per S2). Added `findTargetTable(el)` (native `<table>` → existing `.dr-ext-grid` → walk-up returning the outermost consecutive `looksLikeGrid` match per S6, depth cap `GRID_WALK_DEPTH_CAP`, stop at `<body>`; tags new matches `dr-ext-grid` and calls `createToggleForTable`). Added a proactive `[role="grid"], [role="table"]` cheap pass to `injectTableToggles` and mirrored it (plus grid-removal cleanup) in the MutationObserver. Right-click handlers now call `findTargetTable`. `createToggleForTable` gates non-table elements on `looksLikeGrid` instead of `isDataTable`. `lastRightClickedTable` kept (widened-contract comment added). Constants: `GRID_MIN_CHILDREN`=5, `GRID_WALK_DEPTH_CAP`=15, `GRID_COL_WIDTH_SAMPLE`=10, plus `GRID_DISPLAY_VALUES`, `GRID_LIBRARY_CLASS_TOKENS`, `GRID_ARIA_SELECTOR`. No version bump.
- **Tests:** pass — 804 passed, 0 failed. 16 new adversarial tests: `looksLikeGrid` (LG1–LG9: variable-row-height headline, ARIA + library-class short-circuits proven by accepting non-uniform widths, card-grid/nav-menu numeric-guard rejections, geometry accept/reject) and `findTargetTable` (FT1–FT6: outermost-match walk-up, stops before `<body>`, native-table precedence, null, already-tagged, class marking). One additive test-harness helper to expose `getComputedStyle` to the eval'd module; no production changes from the test-writer.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All five acceptance criteria met; design matches D1/S1–S6; scope clean (no rounding, no adapter, no sidebar/defaults, no version bump); tests genuinely exercise each criterion. The `getComputedStyle` "undefined in Node" item is a resolved test-harness artifact, not a production concern (in-browser it resolves to `window.getComputedStyle`, and the call is guarded by `typeof`/try-catch). Non-blocking observations: the geometry `widths.length < 2 → return true` fall-through is lenient by design (consistent with S4); step-2/3 thresholds and the grid/flex `display` gate are within design latitude for this sprint.

## PR
(opened to main — see PR link in summary)
