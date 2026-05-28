# Sprint Log: offset-semantics-v2 / half-step-floor-js

**Branch:** `feature/half-step-floor-js`
**Plan:** `docs/sprint-plans/offset-semantics-v2.md`
**Date:** 2026-05-28

## Summary

Implemented Features 1, 2, and 3 from the `offset-semantics-v2` plan in
`js/round_dynamic.js`:

1. **Sign-aware half-step (`x.5`) semantics.** Replaced the
   `Math.trunc`/`|frac||1` decomposition with an explicit integer-vs-half-step
   branch:
   - Integer offset: `step = 10^(current_mag + offset)`.
   - Half-step offset: `target_mag = current_mag + ceil(offset)`,
     `step = 0.5 * 10^target_mag`.

   Under the new rule, `+0.5` and `-0.5` no longer produce the same step, so
   ordering is preserved across magnitudes.
2. **Value-OoM floor.** After raw rounding, the result is floored at
   `10^current_mag` so a value never collapses to zero.
3. **Configurable x-floor for half-steps.** Added module-level
   `const X_FLOOR_THRESHOLD = 1;` near the other constants. When
   `|trunc(offset)| >= X_FLOOR_THRESHOLD` and the offset is a half-step,
   the result is also floored at `roundWithOffset(value, trunc(offset))`.

Public signatures (`ROUND_DYNAMIC`, `singleValueMode`, `datasetMode`,
`roundCellSetAware`, `roundWithOffset`) are unchanged. `DEFAULT_OFFSET_TOP`
stays `-0.5`. `EPSILON` is preserved inside the half-step / integer
rounding step.

## Tests

`js/tests.js` was updated:

- Added the 27-cell verification grid
  (`{87M, 47M, 17M} x {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}`).
- Added a monotonicity property test driven by the originating-bug values
  `[73, 4591, 63538, 162583, 400000]` plus a wider mixed range.
- Added a negative-input mirror check.
- Added a threshold-flip block that re-evaluates the source with
  `X_FLOOR_THRESHOLD = 0` in an isolated `Function` sandbox and verifies
  the x-floor now triggers for `+/- 0.5`. Specifically:
  - `rd(17054321, 0.5) -> 20000000`
  - `rd(47054321, 0.5) -> 50000000`
  - `rd(87054321, -0.5) -> 90000000`
- Updated the pre-existing trailing-zeros block and the
  `offset=2 returns 0` block (both relied on the old semantics — Feature 2
  now floors them at the value's own OoM instead of collapsing to 0).
- Replaced the `+0.5 === -0.5` equivalence assertion with an explicit
  distinct-and-greater assertion, since the two are no longer the same step.

`-0.5` behavior is preserved on every existing default-path fixture.

## Test output

```
node js/tests.js
...
✓ 144 passed
✗ 0 failed
```

## Fixup: generalize fraction formula to all non-integer offsets

Replaced the half-step-only branch in `roundWithOffset` with a generalized
fractional formula so any non-integer offset (e.g. `0.25`, `0.75`, `-0.25`,
`1.25`) gets a consistent sign-aware step:

```
target_mag = current_mag + ceil(offset)
f          = |offset - trunc(offset)|        // fractional magnitude in (0,1)
step       = f * 10^target_mag
```

The half-step case `f = 0.5` is a special instance of this rule, so all
existing `+/-0.5` regression tests, the 27-cell verification grid, and the
threshold-flip block continue to pass unchanged. `isInteger` now uses
`Number.isInteger` for clarity. `X_FLOOR_THRESHOLD = 1` and all public
signatures are unchanged.

Tests (`js/tests.js`) gained a new `=== Quarter-step semantics (Feature 1
generalized) ===` block covering `+/-0.25`, `+/-0.75`, and `+/-1.25` across
`{87M, 47M, 17M}`, plus a negative-value mirror and sign-aware sanity
checks. Two pre-existing `0.25` trailing-zero cases were re-anchored to the
new generalized expected values (`1.13, 0.25 → 1` via `floor_oom`;
`1.42, 0.25 → 2.5`) rather than the previous half-step-collapsed behavior.

Total: 158 passed, 0 failed.

## Out of scope (per plan)

- `js/CHANGELOG.md`, `js/README.md`, `js/tests-googlesheets-tab.md`
  (handled by the docs sprint).
- `python/pyproject.toml`, `chrome-extension/manifest.json`
  (handled by CI version-bump on each impl sprint).
