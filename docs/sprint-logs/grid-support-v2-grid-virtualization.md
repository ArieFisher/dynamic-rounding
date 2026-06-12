# Sprint Log: grid-virtualization

**Plan:** docs/sprint-plans/grid-support-v2.md
**Sprint goal:** Keep a rounded grid rounded as the user scrolls and sorts — re-apply rounding to recycled/reverted cells via a debounced `childList`+`characterData` MutationObserver.
**Date:** 2026-06-12
**Result:** Completed (after 1 retry)

## Attempts

### Attempt 1
- **Developer:** Added `GRID_REAPPLY_DEBOUNCE_MS = 100`, `gridObservers`/`gridReapplyTimers` WeakMaps, a re-apply pass, and a grid-only MutationObserver (`childList`+`characterData`, debounced via `setTimeout`) attached after the initial round; teardown in `resetTable` and the removed-node observer; disconnect-before-write / reconnect guard.
- **Tests:** pass (924) — GV1–GV7 (recycle, sort-revert, debounce, no-self-loop, reset teardown, native-no-observer, removed-grid teardown), via capturing MutationObserver + setTimeout stubs.
- **Reviewer verdict:** BLOCK
- **Reviewer notes:** `reapplyGridRounding` diverged from the initial `roundTable` pass — it skipped the exclusion gates (`isInRanges`, `getExclusionReason` → firstRow/firstColumn/percent/currency) and recomputed `max_mag` over an unfiltered set. On sort/recycle it would round cells the user excluded or produce a different value. The GV1–GV7 fixtures disabled every divergent gate (`simplifyFirstRow/Column:true`, plain integers), so the gap was untested.

### Attempt 2
- **Developer:** Extracted `computeGridRoundedValues(wrapperEl, opts)` as the single shared classify+compute path. BOTH the initial `roundTable` grid write pass and `reapplyGridRounding` now call it, so they cannot diverge. It applies the full gate set (`isInRanges`, `getExclusionReason`, whole-cell-quote, date/time, link/`<sup>`, `mode:'extracted'` skip-on-grid) and computes `max_mag`/`ranges` over the same filtered (in-range, non-excluded, pure-numeric) set. Excluded/out-of-range cells return `targetValue: null` and are never written by either pass. The stale `computeGridCellRoundedValue` was removed. Disconnect guard / debounce / teardown / native path preserved.
- **Tests:** pass (948) — added GV8 (firstRow/firstColumn exclusion honored on re-apply) and GV9 (percent/currency exclusion honored), each asserting the excluded cell is NOT re-rounded after a sort-revert while an in-range data cell IS. Both would fail against the pre-fix re-apply.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:**
  - Single shared path confirmed; initial-pass value == reapply target by construction; no second grid rounding implementation remains.
  - Disconnect-before-write/reconnect guard, 100ms debounce, grid-only observer (native `<table>` gets none), reset + removed-node teardown all intact; grid writes `nodeValue`-only.
  - `mode:'extracted'` still skipped on grids (deferred, tracked in issue #120) — not newly implemented here.
  - Minor (non-blocking): `computeGridRoundedValues` builds the scroll container twice per re-apply and reaches a `_`-prefixed adapter method from outside the class — could cache; not load-bearing.

## PR
(opened against main — see PR link)
