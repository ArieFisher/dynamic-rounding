# Sprint Log: sidebar-no-table-state

**Plan:** docs/sprint-plans/sidebar-ux-sprint.md
**Sprint goal:** When no table is bound to the sidebar, show a clearer message and disable the slider (and options) so the user can't interact with controls that have no effect.
**Date:** 2026-06-23
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** sidebar.js adds `NO_TABLE_CLASS='no-table'`, `NO_TABLE_STATUS_MSG='Right-click a table to connect it here.'`, and `setTableBound(isBound)` toggling `body.no-table` + status message. Called `setTableBound(false)` on init; `fetchPreviewSamples` callback calls `setTableBound(response.samples !== null)`; the runtime-error branch in `sendToActiveTab` now calls `setTableBound(false)` (old literal removed). sidebar.html adds `body.no-table` CSS dimming `#optionsSection`/`#advancedSection` (opacity 0.4, pointer-events:none), a prominent `#status`, and the new default status text.
- **Tests:** pass — 1049 passed, 0 failed (21 new). Static structural guards + behavioral `setTableBound` checks.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Verified AC2 end-to-end — binding flows through `SIDEBAR_OPENED` → `PREVIEW_SAMPLES_CHANGED` → `fetchPreviewSamples` → `setTableBound`; live rebind to a different table also routes through `PREVIEW_SAMPLES_CHANGED` (ui-toggle.js). The test-writer's "no TABLE_BOUND handler" gap is by-design, not a defect.

## PR
(see PR link in stack summary)

## Reviewer notes (non-blocking)
- The behavioral test for `setTableBound` reimplements the function body in a template string rather than extracting it from sidebar.js, so it can drift if the implementation changes — a general limitation of unit-testing DOM code in node here (static regexes pin the call sites). Worth tightening if the harness gains a way to source the function body.
- `setTableBound(true)` only clears `#status` when it holds the no-table message, so an unrelated status (e.g. range error) survives a bind — intended and tested.
