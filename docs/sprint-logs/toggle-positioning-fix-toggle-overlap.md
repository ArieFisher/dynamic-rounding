# Sprint Log: fix-toggle-overlap

**Plan:** docs/sprint-plans/toggle-positioning.md
**Sprint goal:** Stop the per-table toggle from overlapping the first row of its table by positioning it above the table edge (best-efforts, with a clamp to keep it on-screen), and consolidate the toggle's geometry into named constants.
**Date:** 2026-06-01
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** In `chrome-extension/content.js`, introduced module-level toggle-geometry constants (`TOGGLE_WIDTH_PX=36`, `TOGGLE_HEIGHT_PX=20`, `TOGGLE_KNOB_PX=14`, `TOGGLE_KNOB_INSET_PX=3`, `TOGGLE_EDGE_GAP_PX=2`, and the derived `TOGGLE_KNOB_TRAVEL_PX=16`). Converted the `ensureToggleStyleInjected` CSS template to interpolate these constants, replacing the hard-coded `36/20/14/3/16`. Rewrote `positionToggle` so `top = Math.max(scrollY, rect.top + scrollY - TOGGLE_HEIGHT_PX - TOGGLE_EDGE_GAP_PX)` — placing the toggle fully above the table with a clamp to the scroll line — and expressed `left` via the constants (value unchanged).
- **Tests:** pass — `node chrome-extension/tests.js` → 493 passed, 0 failed. Updated the two `positionToggle` tests that encoded the old row-1-overlapping placement; added coverage for the above-table bottom-edge gap, the viewport-top clamp (at `scrollY=0` and `scrollY=500`), and the derived knob-travel constant. Exposed the geometry constants from the test harness.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All automated acceptance criteria met. Horizontal anchoring is byte-for-byte unchanged (`rect.right + scrollX - 36 + 2`). No version files touched; no host-page DOM mutations; toggle behavior, accessibility wiring, and the observer plumbing are unchanged. The two manual acceptance criteria (Google Docs Word Count dialog; multi-table host page) cannot be exercised in the CI sandbox and remain to be verified manually when loading the unpacked extension. Residual risks documented in plan §3.3 (overlap with content above the table, container clipping, sticky-header coverage) are accepted as best-efforts and were intentionally not addressed.

## PR
(opened — see PR link below)
