# Sprint Log: half-step-floor-docs

**Date:** 2026-05-28
**Branch:** `feature/half-step-floor-docs`
**Plan:** `docs/sprint-plans/offset-semantics-v2.md`
**Depends on (merged):** `half-step-floor-js` (#69), `half-step-floor-python` (#70), `half-step-floor-chrome` (#68)

## Goal

Update all user-facing documentation to reflect the new offset semantics shipped by the three implementation sprints — sign-aware fractional offsets (Feature 1), value-OoM floor (Feature 2), and the internal `X_FLOOR_THRESHOLD`-gated x-floor (Feature 3).

## Per-file changes

### `README.md` (root)

- "Declarating a lens" parameter table: dropped the "imperative-vs-declarative" framing for the `+1.5 = 500M` row (the post-floor result is 100M, not 500M, so showing 500M would mis-document the function); added a `+0.5 → 100,000,000` row to make the new sign convention visible; updated the `=ROUND(87654321/...)` formula to use `A1` consistently.
- Added a paragraph after the table explaining the sign convention for fractional offsets: `step = |frac(offset)| × 10^(OoM + ceil(offset))`.
- Added a new "Floor at the value's order of magnitude" subsection with the `=round_dynamic(87054321, 2) → 10,000,000` example.
- Added a "Backward compatibility" subsection flagging the break for callers that pass positive non-integer offsets, and reassuring default-path callers that nothing changes.

### `js/README.md`

- Replaced the Offset Reference table's `+0.5` reference and removed the now-incorrect note "Values between -1 and 1 with the same absolute value produce the same result". Added a `0.5 → 100,000,000` row.
- Added the sign-convention and value-OoM-floor explanations beneath the table.

### `js/CHANGELOG.md`

- Added `## [0.3.0] - 2026-05-28` section above `[0.2.5]` with `### Changed` (Feature 1, marked Breaking), `### Added` (Feature 2 + Feature 3), and `### Internal` (note on `X_FLOOR_THRESHOLD`). Did not document the threshold in user-facing prose per plan §5 dev notes.

### `js/tests-googlesheets-tab.md`

- Row 10 (`87654321, -1.5`): updated expected from `87,500,000` to `88,000,000`. The new Feature 3 floor (`rd(87654321, -1) = 88,000,000`) raises the result above the bare half-step value of `87,500,000`.
- All other cells use `(default)` (`-0.5`), integer offsets, or values whose result is unaffected — verified via direct evaluation of `roundWithOffset` against the new `js/round_dynamic.js`.

### `chrome-extension/README.md`

- Added a short "Offset semantics" section noting the new sign-aware fractional offsets + value-OoM floor and linking back to the root README for the full parameter table.

### `python/dynamic_rounding/__init__.py`

- Rewrote the `_round_with_offset` docstring: replaced the stale `0.5 = half of current OoM (same as -0.5)` line with a sign-aware breakdown of `-0.5 / +0.5 / -1.5 / +1.5` against the `87M` reference value, and clarified the Feature 3 floor language ("a fractional offset never rounds finer than the corresponding integer offset would").
- Did not change the `round_dynamic` Examples block (all four `>>>` examples — `87654321`, `87654321 offset=-1`, the dataset, and `"hello"` — were re-verified to produce exactly the documented output under the new implementation).

### `python/README.md`

- Offset Reference table: added a `0.5 → 100,000,000` row and rewrote the `-0.5` row label ("half-step within the current OoM (default)").
- Added the sign-convention and value-OoM-floor notes beneath the table.

## Documented-value surprises

- **Root README `+1.5` would have been wrong.** I initially drafted a row showing `=round_dynamic(A1, 1.5) → 500,000,000` (the bare half-step). Verification against `roundWithOffset(87054321, 1.5)` returned `100,000,000` because Feature 3 floors the result at `rd(87054321, 1) = 100M`. Dropped the row rather than ship a misleading marketing table.
- **`js/tests-googlesheets-tab.md` row 10** had to move from `87,500,000` to `88,000,000` for the same Feature 3 reason (the only cell in the file that needed updating).

## Verification

- Every parameter-table cell in root README, `js/README.md`, `python/README.md`, and `python/dynamic_rounding/__init__.py` was checked by directly calling `roundWithOffset` / `round_dynamic` on the documented input and comparing the actual output.
- `node js/tests.js` → 158/0.
- `node chrome-extension/tests.js` → 488/0.
- `python -m pytest python/tests` → 92 passed, 1 skipped.
- "Adaptive precision" example in root README (`(-0.5, 0)`) re-verified to produce its existing documented column unchanged.

## Out of scope (per plan)

- No `python/pyproject.toml` or `chrome-extension/manifest.json` edits — version bumps are handled by the post-merge CI and the manual major-bump retag described in plan §3.4 / Open Question #1.
- `X_FLOOR_THRESHOLD` is not documented in any user-facing prose (only mentioned in the `js/CHANGELOG.md` `### Internal` block), per plan §5 dev notes.
