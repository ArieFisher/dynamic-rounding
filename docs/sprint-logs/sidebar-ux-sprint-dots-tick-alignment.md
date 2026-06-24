# Sprint Log: dots-tick-alignment

**Plan:** docs/sprint-plans/sidebar-ux-sprint.md
**Sprint goal:** The slider dot/thumb positions align exactly over the corresponding tick marks.
**Date:** 2026-06-23
**Result:** Completed (approved on attempt 2)

## Attempts

### Attempt 1
- **Developer:** Vertical — `.dual-ticks` `top: 22px` → `20px` (tick centre now 26px = thumb centre). Horizontal — changed `pct(v)` to map the 9 STOPs to the 9 grid-cell centres (`repeat(9,1fr)` grid).
- **Tests:** test-writer (extracting the real `pct` from source) caught an off-by-one — the formula used `+ 1` instead of `+ 0.5`, giving `pct(-1)=11.11%`, `pct(1)=100%` instead of the cell centres `5.5556%`/`94.4444%`. 14 tests failed. The developer's own comment contradicted the code.
- **Verdict:** BLOCK (off-by-one).

### Attempt 2
- **Developer:** Changed `+ 1` → `+ 0.5` in `pct()` and aligned the comment. Vertical change retained.
- **Tests:** pass — 1051 passed, 0 failed.
- **Reviewer verdict:** APPROVE — independently verified all 9 stops land on grid-cell centres (`pct(0)===50`, symmetry `pct(-v)+pct(v)===100`); vertical geometry exact (tick centre 20+6 = 26px = thumb centre); `pct()` used only for the two thumb `style.left` assignments (no range-fill/label inconsistency); drag/snap uses its own linear pixel→value inverse, unaffected by pct's changed range.

## PR
(see PR link in stack summary)

## Reviewer notes (non-blocking)
- A test asserts `pct()` is called exactly twice — tight coupling that a future third use would trip. FYI.
- The centre tick (nth-child(5)) is 14px vs 12px and top-anchored, so its centre is at 27px not 26px — purely cosmetic and pre-existing; tick-height changes are out of scope.
