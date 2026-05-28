# Sprint log: half-step-floor-chrome

**Plan:** `docs/sprint-plans/offset-semantics-v2.md`
**Branch:** `feature/half-step-floor-chrome`
**Date:** 2026-05-28

## Summary

Implemented Features 1+2+3 of the offset-semantics-v2 plan in
`chrome-extension/content.js`, mirroring the spec the JS and Python sprints
use. Public signatures (`ROUND_DYNAMIC`, `singleValueMode`, `datasetMode`,
`roundCellSetAware`, `roundTable`) are unchanged.

### Feature 1 — sign-aware half-step
`roundWithOffset` now branches on `Number.isInteger(offset)`:

- integer offset: `step = 10^(current_mag + offset)`
- half-step offset: `target_mag = current_mag + ceil(offset)`, `step = 0.5 * 10^target_mag`

`ceil(-0.5) = 0`, `ceil(+0.5) = 1`, so `-0.5` keeps its legacy meaning while
`+0.5`, `+1.5`, ... finally express "half of the next-coarser OoM step".

### Feature 2 — value-OoM floor
After raw rounding, the absolute result is floored at `10^current_mag` so a
single tens-of-millions value can no longer collapse to 0. Sign is reapplied
at the end.

### Feature 3 — module-level `X_FLOOR_THRESHOLD`
Added `const X_FLOOR_THRESHOLD = 1;` to the content.js constants block
(alongside `EPSILON`, `VALIDATION_LIMIT`, `DEFAULT_OFFSET_TOP`). When the
offset is half-step and `|trunc(offset)| >= X_FLOOR_THRESHOLD`, the result is
also floored at `roundWithOffset(|num|, trunc(offset))`. Not exposed via any
public function signature — flipping the threshold is a one-line edit.

### Other changes
- `num === 0` short-circuits inside `roundWithOffset` (callers already guard,
  but the recursive x-floor branch needs it too).
- Final `Math.round` short-circuit now triggers on `result >= 10 || result % 1 === 0`,
  matching the spec; this is wider than the prior `Math.abs(rounded) >= 10`
  condition and clears trailing-float noise for whole-number results below 10.

## Tests

`node chrome-extension/tests.js` — **480 passed, 0 failed** (446 prior + 34 new).

New coverage in `chrome-extension/tests.js`:
- 27-cell grid for `{87M, 47M, 17M} x {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}`
- sign-preservation + zero short-circuit spot checks
- monotonicity on `[73, 4591, 63538, 162583, 400000]` at offsets `1` and `0.5`
- threshold-flip: a `vm`-sandboxed re-eval of `content.js` with the constant
  patched to `0` confirms `rd(17054321, 0.5) === 20000000`, and the live
  (default) implementation returns `10000000` for the same call.

All pre-existing `-0.5` regression tests pass unchanged — the default-path
behavior is identical to v0.2.x.

## Out of scope (per plan)

- `chrome-extension/manifest.json` (CI bump handles)
- `chrome-extension/README.md`, `defaults.js`, `sidebar.html` (docs sprint)
- Public function signatures
