# Sprint Log: date-tolerant-detection

**Plan:** docs/sprint-plans/sidebar-tidyup-and-date-tolerance.md
**Sprint goal:** Recognize dates in cells that contain adjacent non-date characters (trailing words, leading labels, footnote superscripts, ordinal suffixes).
**Date:** 2026-06-05
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Added module-level constants near `MONTH_NAMES` (`SUPERSCRIPT_DIGITS_RE`, `FOOTNOTE_MARKERS_RE`, `ORDINAL_SUFFIX_RE`) plus a `normalizeDateCandidate` helper that strips leading/trailing superscript digits and footnote markers and reduces ordinal day suffixes (`1st` → `1`). Both `parseDateLike` and `parseAmbiguousNumericDate` now normalize first, then match with boundary-aware patterns `(?:^|(?<=[^\w]))…(?=$|[^\w])` instead of `^…$` — except the bare-year branch (`^(\d{4})$`), which stays strict to guard against false-positives on prices/IDs/version numbers. Commit `3049894`.
- **Tests:** pass — 578 passed, 0 failed. Test-writer added 22 assertions covering all 7 acceptance criteria plus adversarial cases: multi-superscript, asterisk/dagger footnotes, leading "Date:" label, ordinal-no-comma, bare-year-strict negatives, empty/whitespace, and plain-date regressions. Commit `911e4d9`.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All AC met; out-of-scope check clean (only `content.js` and `tests.js` touched; `roundTable` per-column resolver and time-detection paths untouched); bare-year regex confirmed unchanged in the diff; `normalizeDateCandidate` is idempotent and safe on empty/whitespace input. Minor follow-up nit: `SUPERSCRIPT_DIGITS_RE` and `FOOTNOTE_MARKERS_RE` are declared but the implementation ended up using inline character classes for the strip step — non-blocking but worth a cleanup pass later.

## PR
(opened below)
