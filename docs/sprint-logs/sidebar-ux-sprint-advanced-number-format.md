# Sprint Log: advanced-number-format

**Plan:** docs/sprint-plans/sidebar-ux-sprint.md
**Sprint goal:** In the advanced preview bands, apply thousands separators to the original number, and truncate (not round) decimals: no decimals for |n| >= 100, otherwise at most 4 decimal places.
**Date:** 2026-06-23
**Result:** Completed (approved on attempt 3)

## Attempts

### Attempt 1
- **Developer:** Added `PREVIEW_DECIMAL_THRESHOLD`/`PREVIEW_MAX_DECIMALS`, `truncateDecimals`, `formatOriginal`; wired into `renderBand`.
- **Tests:** test-writer (extracting the real helpers from source) caught 2 genuine failures — fp-noise: truncating to a float like `99.9999` (IEEE-754 `99.99989999…`) then formatting exposed all the noise digits.
- **Verdict:** BLOCK (fp-noise).

### Attempt 2
- **Developer:** Rewrote `formatOriginal` to string-level formatting and routed both `from` and `numEl` through it.
- **Reviewer verdict:** BLOCK — the new approach used `toFixed`+guard digits, which **rounds**: `formatOriginal(1.7999999999)` → `'1.8'` (spec requires `'1.7999'`). The earlier test asserted that example only against `truncateDecimals` (clean float math), not the production `formatOriginal`, so it slipped through.

### Attempt 3
- **Developer:** Replaced the `<100` branch with `abs.toString()` (shortest round-trip decimal) + pure string-slice truncation of the fractional part (no `toFixed`, no float subtraction), trailing-zero strip, negative-zero guard, scientific-notation→empty-fraction special case.
- **Tests:** test-writer added 11 direct `formatOriginal` regression assertions (production path). 1082 passed, 0 failed.
- **Reviewer verdict:** APPROVE — independently verified ~40 adversarial cases (truncation not rounding, negatives, boundaries, sub-threshold→0, comma formatting, unparseable→raw). Both render paths confirmed routing through `formatOriginal`; `formatNumberWithCommas` unchanged for other callers.

## PR
(see PR link in stack summary)

## Reviewer notes (non-blocking)
- `truncateDecimals` is now dead in production (kept only for its own tests). Filed as follow-up issue #157 to remove it (or mark it test-only) so the live truncation path is unambiguous.
