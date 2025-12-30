# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.2] - 2024-12-30

### Added

- Parameter validation: grain values must be between -20 and 20
- `tests.js`: Node.js test suite (run with `node tests.js`)

### Verified

- Dates and times pass through unchanged in all modes

## [0.2.1] - 2024-12-27

### Fixed

- Floating point precision bug where boundary values (e.g., 0.35) could round incorrectly

## [0.2.0] - 2024-12-27

### Changed

- **BREAKING:** New grain model - grain is now an order-of-magnitude offset, not a fraction
  - `0` = current OoM (was `1.0`)
  - `-1` = one OoM finer (was `0.1`)
  - `0.5` = half of current OoM
  - `-1.5` = half of one OoM finer (new capability)
- **BREAKING:** New signatures with three distinct modes:
  - Single-value: `=ROUND_DYNAMIC(value, [grain])` - default grain=0
  - Array: `=ROUND_DYNAMIC(range, [grain_top], [grain_other], [num_top])` - defaults -0.5, 0, 1
  - Sort-safe: `=ROUND_DYNAMIC(value, range, [grain_top], [grain_other], [num_top])`
- Parameter names simplified: `grain_top_order` → `grain_top`, `num_top_orders` → `num_top`

### Removed

- Parameter validation (no guardrails for now)
- Backward compatibility parameter shifting logic

## [0.1.0] - 2024-12-18

### Added

- Initial release
- `ROUND_DYNAMIC` custom function for Google Sheets
- Magnitude-aware rounding with configurable grain
- Dataset-aware rounding
  - Automatic max magnitude detection from input range
  - Finer grain for top magnitude tier, coarser grain for smaller numbers
- Array input/output (spill ranges)
- Handles numbers formatted as text (parses commas, currency symbols, parentheses)
- Non-numeric values pass through unchanged