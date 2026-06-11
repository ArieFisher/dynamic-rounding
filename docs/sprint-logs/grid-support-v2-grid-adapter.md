# Sprint Log: grid-adapter

**Plan:** docs/sprint-plans/grid-support-v2.md
**Sprint goal:** Refactor the rounding engine onto a `TableAdapter` interface.
**Date:** 2026-06-11
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Added `NativeTableAdapter`, `GridAdapter` (stub `getRows() → []`), and a `makeAdapter(el)` factory to `content.js`. Refactored `isDataTable`, `roundTable`, `resetTable`, and `extractPreviewSamples` (via `collectNumericCells`) to consume the adapter read API (`makeAdapter(el).getRows()` / `row.getCells()` / `getText()`) instead of touching `.rows`/`.cells` directly. `roundTable` early-returns when `getRows()` is empty (clean `GridAdapter` stub path). Native write/restore path unchanged (writes via `cellObj.el`, stores `dataset.originalHtml`, restores in `resetTable`). Confirmed no `role="gridcell"` / `data-row-index` literals remain. `manifest.json` untouched.
- **Tests:** pass — `node chrome-extension/tests.js` → Passed: 825, Failed: 0 (804 pre-existing + 21 new). Test-writer added a `NativeTableAdapter` round-trip test, a 3×3 cell-count test, a `GridAdapter` stub-properties test, a `roundTable`-on-grid no-throw test, and a source-scan for stale selectors.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:**
  - Native rounding is behavior-identical: the refactor changes only the *read* layer; the write/restore path and storage key are unchanged.
  - `NativeTableAdapter.setText` is currently dead code (native path writes via `cellObj.el` per spec); harmless — it uses the same `dataset.originalHtml` key.
  - Minor, practically-unreachable edge case: a 0-row native table now hits the empty-rows early return, skipping the trailing `syncSwitchForTable`. `roundTable` is always `isDataTable`-gated (≥2 rows), so unreached in practice.
  - The selector "correction" was a no-op in practice — the legacy `role="gridcell"` / `data-row-index` literals never existed on `main` (grid-detection used the correct `role="grid"`/`role="table"`). Matches the plan's "no behavioral risk" characterization.
  - Non-blocking test gap: AC2 ("behavior-identical native rounding") is verified at the adapter read layer; a dedicated `roundTable`→`resetTable` round-trip through the adapter could pin it more directly. Worth adding opportunistically in grid-rounding.

## PR
(opened to main — see PR link)
