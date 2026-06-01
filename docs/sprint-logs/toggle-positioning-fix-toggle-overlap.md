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

### Attempt 2 — conditional lift (superseded)
- **Developer:** Kept the geometry constants and CSS interpolation. Replaced the shift+clamp with `isStripAboveTableClear()`: `positionToggle` lifts the toggle above the table **only** when `document.elementsFromPoint` under the lifted footprint returns solely the document root, body, or ancestors of the table. Otherwise falls back to the original in-corner placement.
- **Tests:** pass.
- **Reviewer verdict:** APPROVE (strict improvement: no page can regress).
- **Outcome:** Superseded after the user requested that the fallback be gated behind a feature flag, defaulted off — they want to ship the simpler "always lift" behavior first and only enable the safety mechanism if real-world usage shows it's needed.

### Attempt 3 — feature-flagged fallback, default off (implemented)
- **Developer:** Introduced module-level `let LIFT_FALLBACK_ENABLED = false`. When false (default), `positionToggle` unconditionally lifts the toggle above the table — simpler, fixes the most common cases, and re-accepts the risks the plan originally documented as residual (content above the table, off-viewport, sticky headers, container clipping). When true, the conditional-lift behavior from Attempt 2 takes over: `isStripAboveTableClear` is consulted and the in-corner placement is used as a fallback. The probe helper and the strict-improvement logic are retained, just dormant by default. The flag is exposed to the test harness via a `Object.defineProperty` getter/setter (mirroring the existing pattern for `toggleStyleInjected`).
- **Tests:** pass — `node chrome-extension/tests.js` → 501 passed, 0 failed. Default-mode tests cover the unconditional lift, scroll-offset propagation, and that neither blocking content nor a missing `elementsFromPoint` changes placement when the flag is off (guards the gate). Flag-on tests run inside a `withLiftFallback()` `try`/`finally` helper that flips and restores `LIFT_FALLBACK_ENABLED`, covering lift-when-clear (incl. own-label exclusion) and all four fallback paths (content above, lift off viewport top, no `elementsFromPoint`, off-screen probe point). Sanity asserts at the boundaries confirm the flag never leaks across tests.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Default-off matches the user's explicit instruction. The strict-improvement guarantee is preserved as an opt-in: flip the flag and `positionToggle` returns to "never regress a page". No version files touched; no host-page DOM mutations; horizontal anchoring byte-for-byte unchanged; toggle behavior, a11y, observers unchanged. Two acceptance criteria remain manual (Google Docs Word Count dialog; multi-table host page) and cannot be exercised in the CI sandbox.

## PR
(opened — see PR link below)
