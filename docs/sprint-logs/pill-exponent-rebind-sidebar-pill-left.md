# Sprint Log: sidebar-pill-left

**Plan:** docs/sprint-plans/pill-exponent-rebind.md
**Sprint goal:** Render each sidebar option's toggle switch to the left of its label (checkbox position).
**Date:** 2026-06-05
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** `chrome-extension/sidebar.html` only. Reordered all 7 `#optionsSection` `.toggle-row`s so `<label class="switch">` precedes `.toggle-label`; on the `dates`/`times` rows kept the granularity `<select>` as the last child (switch · label · select). Removed `justify-content: space-between` from `.toggle-row`, relying on `.toggle-label { flex-grow: 1 }` to fill width and push the select right. No element ids changed; master `enabled` switch untouched. No `flex-direction: row-reverse`.
- **Tests:** adversarial source-structure block added (13 assertions): switch-before-label per row, select-after-label on date/time rows, no `row-reverse`, no `space-between`. Result: **617 passed, 0 failed**.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Pure presentation change; verified by source-structure assertions (the Node harness has no live sidebar DOM). Branch is off `main`, so it carries the pre-rename ids `excludeDates`/`excludeTimes`; the `invert-datetime-pills` sprint renames these on its own branch. A merge conflict in `sidebar.html` between the two is expected and is the user's to resolve at merge time (per plan's decoupling note).

## PR
(opened to main — see PR link in run summary)
