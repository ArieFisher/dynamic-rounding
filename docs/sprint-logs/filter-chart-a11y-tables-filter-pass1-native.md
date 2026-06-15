# Sprint Log: filter-pass1-native

**Plan:** docs/sprint-plans/filter-chart-a11y-tables.md
**Sprint goal:** Stop Pass 1 from attaching toggles to phantom chart-accessibility tables.
**Date:** 2026-06-15
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Added a single guard at the top of the Pass 1 `forEach` in `injectTableToggles` (`chrome-extension/ui-toggle.js`): `if (isPhantomA11yTable(table)) return;`, short-circuiting before the existing `!tableToggles.has(table)` check and `createToggleForTable`. Pass 2, `findTargetTable`, and the right-click path are untouched. `dom-adapters.js` (the predicate, from the parent branch) unchanged.
- **Tests:** pass — 993 total (976 parent baseline + 17 new). The Pass 1 / `pass1-filter` suite drives the real `injectTableToggles` against a mocked document and asserts: zero toggles for aria-hidden phantom tables and off-screen (`left:-10000px`) phantom tables (each fixture is also a valid 2-column numeric data table, so the guard is provably the sole reason for the skip); exactly one toggle for a real on-screen table; a mixed 5-table run yields toggles only for the 2 real tables; plus orthogonality (isDataTable gate) and duplicate-run dedup edge cases.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Minimal correct guard, placed before `createToggleForTable`, preserves dedup. Pass 2 byte-for-byte unchanged; `dom-adapters.js` diff empty vs parent; no version-file changes; right-click path unfiltered. Tests isolate the guard via explicit `isDataTable`/`isPhantomA11yTable` sanity assertions and count toggles via a real `tableToggles.has` side effect with state reset between runs. Non-blocking: a couple of unused locals in the duplicate-run test (`createCallCount`/`origCreate`) — harmless dead locals worth a future cleanup.

## PR
(opened below — see PR link)
