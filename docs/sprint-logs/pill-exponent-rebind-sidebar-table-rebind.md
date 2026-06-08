# Sprint Log: sidebar-table-rebind

**Plan:** docs/sprint-plans/pill-exponent-rebind.md
**Sprint goal:** When the open sidebar is bound to table A and a different table B's per-table toggle is clicked, rebind the sidebar to B with default settings.
**Date:** 2026-06-05
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:**
  - `chrome-extension/content.js`: added module flag `let sidebarOpen = false;` (~line 40), set `true` in the `SIDEBAR_OPENED` handler, set `false` in a new `CLOSE_SIDEBAR` handler (the same broadcast the sidebar itself listens for, dispatched from `background.js:closeSidebarIfOpen()`). In `createToggleForTable`, injected the rebind precondition before `runToggleAction(table)` in BOTH the touch/pen second-tap branch and the mouse/keyboard branch: when `sidebarOpen && lastRightClickedTable && table !== lastRightClickedTable`, set `lastRightClickedTable = table`, dispatch `RESET_SIDEBAR_TO_DEFAULTS` and `PREVIEW_SAMPLES_CHANGED` (both wrapped in try/catch like every other `sendMessage` in the file).
  - `chrome-extension/sidebar.js`: added handler for `RESET_SIDEBAR_TO_DEFAULTS` in the existing `onMessage` block — calls `applyDefaultsToUI()` then `fetchPreviewSamples()`, wrapped in try/catch. Does NOT call `applyNow()` (the toggle on the new table runs its own apply).
- **Tests:** adversarial pass added 23 assertions: AC1–AC3 covered LIVE on both click paths (mouse/keyboard + touch second-tap) by stubbing `chrome.runtime.sendMessage` as a spy and exercising `createToggleForTable` with the existing DOM-stub infrastructure; AC4 covered live for the mouse path; source-level assertions lock in the `sidebarOpen` flag declaration, the open/close flips, both branches' rebind guard, the `lastRightClickedTable = table` reassignment, and `sidebar.js`'s RESET handler shape (calls defaults+preview, does NOT call `applyNow`). Result: **627 passed, 0 failed** (604 baseline + 23 new).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Spec satisfied; no bugs found. Minor non-blocking observation: the 12-line rebind block is duplicated across the two click branches. Extracting a `rebindIfNeeded(table)` helper would be reasonable; left as-is to keep the diff minimal and because the surrounding code already diverges (touch path also schedules `scheduleAutoCollapse()`). Staleness of `sidebarOpen` if the sidebar terminates without dispatching `CLOSE_SIDEBAR` is harmless — `sendMessage` is wrapped in try/catch and the worst case is one spurious rebind event the dead sidebar never receives.

## PR
(opened to main — see PR link in run summary)
