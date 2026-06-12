# Sprint Log: grid-rounding

**Plan:** docs/sprint-plans/grid-support-v2.md
**Sprint goal:** Implement `GridAdapter.getRows()` with corrected selectors and round visible grid rows via text-node `nodeValue` patching.
**Date:** 2026-06-12
**Result:** Completed (after 1 retry)

## Attempts

### Attempt 1
- **Developer:** Implemented `GridAdapter.getRows()` (scroll container → nullable pinned pane → rows → stitch by `data-row`/`data-index` → cells via `role="cell"`/`.dg--cell`), `findCellTextNode`, and the `nodeValue` `setText` (stores `dataset.drOriginal`, adds `dr-ext-rounded`). Added `resetTable` grid branch and `isDataTable` grid sampling.
- **Tests:** pass (876) — but all grid assertions called the adapter `setText` directly.
- **Reviewer verdict:** BLOCK
- **Reviewer notes:** `roundTable`/`resetTable` never routed grid cells through the `nodeValue` adapter — they used the native `replaceTextPreservingHTML` (reachable `innerHTML` fallback = React reconciler crash) and stored `dataset.originalHtml`, while reset read `drOriginal`. The `nodeValue` `setText` was dead code from the round path; green tests masked the gap.

### Attempt 2
- **Developer:** `roundTable` now computes the adapter once and branches on `adapter.isVirtualized()`. Grid cells write only via `cellObj.setText(formatted)` (pure `nodeValue`, sets `drOriginal`, never `originalHtml`/`innerHTML`/`replaceTextPreservingHTML`/`applyExtractedPatches`). `mode:'extracted'` (mixed-text) cells are skipped on grids (`if (isVirtualized) continue`) as a documented known limitation. Native `<table>` path relocated into the `else` branch, byte-identical.
- **Tests:** pass (895) — test-writer added 4 E2E tests (E2E-GR1..GR4) driving `roundTable`/`resetTable` directly on a div-grid, asserting Text-node identity (`===`), `childNodes.length` unchanged, `drOriginal` set, `originalHtml` unset, and the extracted-skip alongside a pure-numeric round.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:**
  - Grid round/reset fully on the `nodeValue` path; storage keys reconcile (`drOriginal` only).
  - `getText` reads `drOriginal`, so re-rounding is idempotent.
  - `findCellTextNode` patches only the deepest text node — fine for this sprint's pure-numeric/date scope; relevant if future grid work touches multi-text-node cells.
  - `mode:'extracted'` skip on grids is an intentional, documented limitation (mixed-text/`<sup>` cells not rounded on virtualized grids) — mention in the user-facing changelog.
  - No MutationObserver added (correctly deferred to grid-virtualization); `manifest.json` untouched.

## PR
(opened with base refactor/grid-adapter — see PR link)
