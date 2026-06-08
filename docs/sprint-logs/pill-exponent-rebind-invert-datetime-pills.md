# Sprint Log: invert-datetime-pills

**Plan:** docs/sprint-plans/pill-exponent-rebind.md
**Sprint goal:** Make the `dates`/`times` sidebar toggles mean "simplify this type (and enable its granularity dropdown)" instead of "exclude it."
**Date:** 2026-06-05
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Renamed `excludeDates`/`excludeTimes` → `simplifyDates`/`simplifyTimes` across `defaults.js` (new defaults `simplifyDates: true`, `simplifyTimes: false`), `sidebar.html` (checkbox ids), `sidebar.js` (`CHECKBOX_TO_SETTING` + `updateDisabledState`), and `content.js` (classification branches inverted to truthy `simplify*`; date/time exclusion branches removed from `getExclusionReason`). Renamed stale key references in `tests.js`.
- **Tests:** adversarial pass added 9 blocks / 20 assertions covering the four toggle-polarity criteria. Result: 10 failures.
- **Reviewer verdict:** BLOCK
- **Reviewer notes:** Removing the date/time branches from `getExclusionReason` while only simplifying on a truthy flag left a gap: with `simplifyDates: false` a date-like cell (e.g. bare year `"2018"`) fell through to the numeric branch and was rounded to `"2,000"`. Date/time cells must be skipped when their toggle is off, never treated as plain numbers.

### Attempt 2
- **Developer (orchestrator fix):** In `content.js` `roundTable`, detect date-like / time-like cells *unconditionally*; simplify when the toggle is on, otherwise push `mode: 'skip'`. Guarantees date/time cells never reach numeric rounding regardless of toggle state.
- **Tests:** `node chrome-extension/tests.js` → **663 passed, 0 failed** (including all adversarial cases from attempt 1).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** AC5 (sidebar dropdown disabled-state) is verified by static source assertion only — the Node harness has no live sidebar DOM. Acceptable; matches the existing sidebar test convention.

## PR
(opened to main — see PR link in run summary)
