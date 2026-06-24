# Sprint Log: table-contextmenu-activation

**Plan:** docs/sprint-plans/sidebar-ux-sprint.md
**Sprint goal:** When the user right-clicks on a table, flash the table border to indicate it is now the active table; if the sidebar is currently open, flash the sidebar border too.
**Date:** 2026-06-23
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Added `ACTION_TABLE_ACTIVATED` constant; `contextmenu` handler in content.js now calls `flashTargetedTable(table)` and sends `TABLE_ACTIVATED`, both guarded by `if (table)`. background.js relays `TABLE_ACTIVATED` to the sidebar tab only when `sidebarTabId !== null`. sidebar.js adds a `TABLE_ACTIVATED` handler calling `flashSidebarContainer()` (toggles `dr-sidebar-flash` on body, cleaned up on animationend). sidebar.html adds `@keyframes drSidebarFlash` (inset box-shadow, rgba(66,133,244,0.45), 0.6s) and `.dr-sidebar-flash`.
- **Tests:** pass — 1045 passed, 0 failed (17 new). Behavioral coverage of AC1–AC3 plus background relay null/open branches via eval + capturing stubs.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All criteria met, in scope, version files untouched, tests genuinely behavioral.

## PR
(see PR link in stack summary)

## Reviewer notes (non-blocking)
- AC4 "relay fires when open" assertion runs in an async `.then()` with a swallowed `.catch`; null-guard + source checks still cover the guard, but the positive case could be a coverage gap. Consider awaiting it.
- sidebar.js onMessage was restructured from standalone `if` to `if/else if`; prior branches (CLOSE_SIDEBAR, GET_SIDEBAR_SETTINGS sendResponse) preserved, no async-response regression.
