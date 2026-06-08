# Sprint Log: simplify-naming-unification

**Plan:** `/root/.claude/plans/simplify-is-fine-parsed-parasol.md`
**Sprint goal:** Rename the remaining five sidebar option keys to a unified positive-framed `simplify*` form, inverting boolean polarity for the two `excludeFirst*` keys so every toggle reads as "selected = simplify this category."
**Date:** 2026-06-08
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Renamed five keys across `defaults.js`, `sidebar.html`, `sidebar.js`, `content.js`, and `tests.js`:
  - Straight rename (polarity unchanged): `includeWords` → `simplifyMixedCells`, `includeCurrency` → `simplifyMixedCurrency`, `includePercent` → `simplifyMixedPercent`.
  - Polarity-inverting rename: `excludeFirstRow` → `simplifyFirstRow`, `excludeFirstColumn` → `simplifyFirstColumn` (the two reads in `getExclusionReason`, ~lines 1069–1070, became `if (!options.simplifyFirst*)` — same observable boolean, opposite name).
  - Defaults preserved literally (`simplifyFirstRow: false`, `simplifyFirstColumn: false`) — an INTENTIONAL behavior change confirmed with the user in plan mode: first row / first column are no longer simplified by default. ~20 existing roundTable integration tests had `excludeFirstRow: false` (= first row simplified); these were updated to `simplifyFirstRow: true` to preserve their original intent. Stale typo keys (`excludeWords` / `excludePercent` / `excludeCurrency`) in the `exclusionFirstColumn` fixture were removed. Comments referencing the old defaults (~lines 2201–2202, 2255–2256) were rewritten.
- **Tests:** adversarial contract lock-in added 53 assertions across 7 ACs: source-level grep guard for the 5 old keys across all 5 files (25), `simplifyFirstRow` polarity (4) and `simplifyFirstColumn` polarity (4) including the new "unset = not simplified" default semantics, `simplifyMixedCurrency` / `simplifyMixedPercent` polarity (4), a `roundTable` integration check that `simplifyMixedCells: false` leaves `"about 1,234 widgets"` untouched (2), `DR_DEFAULTS` snapshot of all 7 keys (7), and `sidebar.html` id↔key parity for the 7 checkboxes (7). Result: **772 passed, 0 failed** (719 baseline + 53 new).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All polarities correct; the intentional default-behavior change is locked in by the unset-flag test cases. The grep-guard patterns are split as concatenated strings (`'include' + 'Words'` etc.) so the assertions don't self-match in `tests.js`.

## PR
(opened to main — see PR link in run summary)
