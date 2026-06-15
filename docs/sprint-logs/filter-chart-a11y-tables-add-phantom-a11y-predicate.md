# Sprint Log: add-phantom-a11y-predicate

**Plan:** docs/sprint-plans/filter-chart-a11y-tables.md
**Sprint goal:** Add a pure, unit-tested predicate that recognizes off-screen / aria-hidden / SVG-chart-fallback `<table>`s, without changing any detection behavior yet.
**Date:** 2026-06-15
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Added `OFFSCREEN_LEFT_PX_THRESHOLD = -9999` named constant and `isPhantomA11yTable(table)` to `chrome-extension/dom-adapters.js` (with private helpers `_nearestPositionedAncestor` and `_parsePx`). Predicate returns `true` on OR-of-signals: self-or-ancestor `aria-hidden="true"`; nearest positioned ancestor (or table) with inline/computed `left <= OFFSCREEN_LEFT_PX_THRESHOLD`; nearest positioned ancestor containing an `<svg>` with a non-empty `aria-label`. Inline `style.left` is read first (computed `left` is unavailable in the Node harness), guarded like existing computed-style reads. Exposed both symbols on `globalThis` in tests.js alongside `isDataTable`. No detection wiring (out of scope).
- **Tests:** pass — 976 total (955 baseline + 21 new). Covers each signal independently, the negative on-screen case, and adversarial negatives (aria-hidden="false", just-above-threshold left, empty/whitespace/absent svg aria-label, non-positioned ancestor, null/garbage input).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All three signals correct and independent; off-screen uses `<=` against the named constant; SVG anchored to nearest positioned ancestor; defensive against null/garbage; out-of-scope files (`ui-toggle.js`, passes, `findTargetTable`, version files) untouched; predicate defined but not yet wired (no behavior change, as scoped). Non-blocking: inline-style reliance for the off-screen signal warrants a real-browser smoke test when the predicate is consumed downstream.

## PR
(opened below — see PR link)
