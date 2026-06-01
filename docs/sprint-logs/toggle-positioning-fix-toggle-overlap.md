# Sprint Log: fix-toggle-overlap

**Plan:** docs/sprint-plans/toggle-positioning.md
**Sprint goal:** Stop the per-table toggle from overlapping the first row of its table by positioning it above the table edge, and consolidate the toggle's geometry into named constants.
**Date:** 2026-06-01
**Result:** Completed

## Design divergence from the merged plan

The merged plan (§3.2–3.3) specifies an *unconditional* upward shift with a `Math.max(scrollY, …)` clamp, explicitly accepting residual risks (overlap with content above the table, container clipping, sticky-header coverage) as "best-efforts".

After the plan merged, the user clarified that for this task "best-efforts" means **strict improvement with zero introduced risk** — solve most of the problem most of the time, but never make any page worse than it is today. The clamp approach fails that bar because it can newly overlap a heading/caption that sits above a table.

This sprint therefore implements a **conditional lift** instead, which the plan does not describe. The plan is immutable once merged (per the sprint workflow), so the divergence is recorded here rather than by editing the plan. A follow-up plan amendment can capture it if desired.

## Attempts

### Attempt 1 — unconditional shift + clamp (superseded)
- **Developer:** Shifted the toggle up by its full height with a `Math.max(scrollY, …)` clamp; extracted toggle-geometry constants.
- **Tests:** pass.
- **Reviewer verdict:** APPROVE (against the plan as written).
- **Outcome:** Superseded after the user clarified the zero-introduced-risk requirement (see above). The clamp can regress pages that have content directly above a table.

### Attempt 2 — conditional lift (implemented)
- **Developer:** In `chrome-extension/content.js`, kept the extracted geometry constants (`TOGGLE_WIDTH_PX`, `TOGGLE_HEIGHT_PX`, `TOGGLE_KNOB_PX`, `TOGGLE_KNOB_INSET_PX`, `TOGGLE_EDGE_GAP_PX`, derived `TOGGLE_KNOB_TRAVEL_PX`) and the CSS interpolation. Replaced the shift+clamp with `isStripAboveTableClear()`: `positionToggle` lifts the toggle into the strip above the table **only** when `document.elementsFromPoint` under the lifted footprint returns solely the document root, body, or ancestors of the table. Content above the table, a point off the viewport, an off-screen probe (empty hit-test), or the absence of `elementsFromPoint` all fall back to the original in-corner placement. Horizontal anchoring is byte-for-byte unchanged.
- **Tests:** pass — `node chrome-extension/tests.js` → 496 passed, 0 failed. Covers: lift when clear (incl. scroll offsets and own-label exclusion); and the strict-improvement fallbacks (content above, lift off viewport top, no `elementsFromPoint`, off-screen probe point).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Strict improvement confirmed — every fallback path reproduces today's exact placement (`rect.top - TOGGLE_EDGE_GAP_PX`), so no page regresses. No version files touched; no host-page DOM mutations; toggle behavior, accessibility wiring, and observer plumbing unchanged. Two acceptance criteria remain manual (Google Docs Word Count dialog; multi-table host page) and cannot be exercised in the CI sandbox. Perf note: the lift path adds up to three `elementsFromPoint` hit-tests per table per reposition (scroll/resize); negligible for typical table counts, worth revisiting only on table-heavy pages with rapid scrolling.

## PR
(opened — see PR link below)
