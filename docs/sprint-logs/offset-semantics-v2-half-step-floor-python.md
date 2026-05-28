# Sprint log — half-step-floor-python

Sprint plan: `docs/sprint-plans/offset-semantics-v2.md` (offset-semantics-v2, sprint `half-step-floor-python`).

## Scope delivered

- **Feature 1 — Sign-aware half-step semantics.** `_round_with_offset` now computes `target_mag = current_mag + ceil(offset)` and `step = 0.5 * 10^target_mag` for any non-integer offset, so `+0.5` rounds to the next coarser half (`87,054,321 → 100,000,000`) while `-0.5` preserves legacy behavior (`87,054,321 → 85,000,000`).
- **Feature 2 — Value-OoM floor.** After the raw round we take `max(raw, 10^current_mag)`, preventing a positive value from collapsing past its own order of magnitude (e.g. `17,054,321 @ +0.5` no longer falls below `10^7`).
- **Feature 3 — `X_FLOOR_THRESHOLD` constant.** New module-level constant (default `1`) gating an x-floor: for half-step offsets where `|trunc(offset)| >= X_FLOOR_THRESHOLD`, the result is additionally floored by the integer-offset result at `trunc(offset)`. Setting `X_FLOOR_THRESHOLD = 0` opts in to the x-floor for `±0.5` as well.

Public function signatures unchanged. `_preserve_type` is applied after the floor logic on the final result, exactly as before.

## Files touched

- `python/dynamic_rounding/__init__.py` — added `X_FLOOR_THRESHOLD`, rewrote `_round_with_offset` per spec.
- `python/tests/test_core.py` —
  - Added `TestOffsetGrid` (27-cell parametrized grid from spec).
  - Added `TestMonotonicity` (sorted-list ordering for `offset=1`, `0.5`, `-0.5`).
  - Added `TestXFloorThreshold` including the `monkeypatch.setattr` flip test.
  - Added `TestNegativeHalfRegression` to lock in unchanged `-0.5` behavior.
  - Updated legacy tests that asserted the old buggy behavior (sign-agnostic `±0.5` symmetry, the `-1.5` example, and `TrailingZeros` cases that relied on `+0.5 == -0.5`). All such fixtures were either flipped to negative offsets (preserving their original intent) or rewritten to assert the new sign-aware values.
  - Updated `test_version_exists` to match the current `0.1.4` package version (pre-existing baseline failure).

Not touched (out of scope per plan): `python/pyproject.toml`, `python/README.md`.

## Verification

`cd python && python -m pytest tests/`

- Baseline (main): 43 passed, 1 skipped, 1 pre-existing fail (`test_version_exists` asserted `0.1.3` but pyproject is `0.1.4`).
- After sprint: **83 passed, 1 skipped, 0 failed.**
- 27/27 cells in the verification grid pass.
- Monotonicity verified across `offset ∈ {1, 0.5, -0.5}` on `[73, 4591, 63538, 162583, 400000]`.
- Threshold-flip test confirms `X_FLOOR_THRESHOLD = 0` makes `round_dynamic(17054321, offset=0.5) == 20000000`.

## Caveats

- This is a **breaking change** for callers passing positive non-integer offsets (`+0.5`, `+1.5`, …); their results now differ from the previous (buggy) behavior. The sprint plan acknowledges this and routes the version bump (`0.1.x → 0.2.0`) through the release sprint.
- The legacy `TestOffsetSymmetry` class was renamed to `TestOffsetSignDirection` and inverted to assert the new asymmetry, since the old symmetry was itself the bug being fixed.
- A handful of `TrailingZeros` tests originally used `offset=0.25` to exercise a quarter-step path. The new semantics treat *every* non-integer offset as a half-step, so the one test that depended on an actual 0.25-step (`(1.13, 0.25) → 1.25`) was dropped; the surviving test was rewritten to verify the half-step path with `offset=-0.25`.

## Fixup — generalize fraction formula to all non-integer offsets

Reviewer noted that the original implementation collapsed every non-integer offset to a half-step. `_round_with_offset` now uses the general fractional formula:

```
target_mag = current_mag + ceil(offset)
f          = abs(offset - trunc(offset))   # fractional magnitude in (0, 1)
step       = f * 10**target_mag
```

This recovers genuine quarter-step (and arbitrary fractional) behavior while keeping `±0.5` byte-identical to the previous half-step path (since `f = 0.5`). The value-OoM floor and `X_FLOOR_THRESHOLD`-gated x-floor still apply for any non-integer offset.

### Added tests

- `TestQuarterStep` — parametrized grid covering `±0.25` and `±1.25` against the value triplet `(87054321, 47054321, 17054321)`, plus the recomputed legacy small-value case `(1.13, 0.25) → 1` (under formula B: step = 2.5 → raw = 0 → value-OoM floor lifts to 1).

### Verification

- After fixup: **92 passed, 1 skipped, 0 failed** (`python -m pytest python/tests/`).
- All 27 grid cells, all `-0.5` regression cases, all monotonicity cases, and the threshold-flip test still pass — the change is additive for half-steps and only introduces new behavior for non-half fractional offsets.
