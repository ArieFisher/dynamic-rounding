# Sprint Log: sidebar-tidyup

**Plan:** docs/sprint-plans/sidebar-tidyup-and-date-tolerance.md
**Sprint goal:** Flatten the sidebar options into a single ordered list of toggle-style switches with the user's new defaults.
**Date:** 2026-06-05
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Replaced the two `<div class="exclusion-group">` blocks in `sidebar.html` with a single flat container of seven `.toggle-row` items in the order words → currencies → percentages → dates → times → first row → first column. Each row uses the existing `.switch`/`.slider` pattern from the title-row enable switch. Removed both section headings and both "round to:" labels. Reordered `#timeGranularity` options so `hour` is first. Updated `defaults.js`: `excludeTimes`, `excludeFirstRow`, `excludeFirstColumn` → `false`; `timeGranularity` → `'hour'`. Pruned now-unused CSS selectors. Commit `eb866fa`.
- **Tests:** pass — 585 passed, 0 failed. Test-writer added 28 assertions covering all five acceptance criteria (row order via deep-equals, forbidden-phrase absence in scoped options section, all nine `DR_DEFAULTS` values, switch-wrapping per input, time-granularity option order) and fixed two stale assertions inherited from main. Commit `92717bf`.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All acceptance criteria met. Out-of-scope check clean: only `defaults.js`, `sidebar.html`, `tests.js` touched; `manifest.json` and `content.js` untouched; only the four named keys in `DR_DEFAULTS` changed. `sidebar.js` still drives the new DOM correctly (IDs unchanged). Pre-existing inversion in the `<select>.disabled` wiring (granularity disabled when checkbox is on) is noted but predates this sprint and is out of scope.

## PR
(opened below)
