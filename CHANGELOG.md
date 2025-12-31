# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.3] - 2024-12-31

### Changed

- Default offset changed from 0 to -0.5 in single mode (now consistent across all modes)
- Simplified JSDoc tooltip with link to full documentation
- Renamed modes: single-value → single, array → dataset, sort-safe → dataset-aware single
- Renamed parameter: grain → offset (and grain_top → offset_top, grain_other → offset_other)
- README substantially rewritten with improved examples

### Added

- Parameter validation: offset values must be between -20 and 20
- `tests.js`: Node.js test suite with 110 tests (run with `node tests.js`)
- `design.md`: technical design doc (replaces spec)

### Removed

- `DynamicRounding_Spec_v2_0.md`: replaced by `design.md`

### Verified

- Dates and times pass through unchanged in all modes

## [0.2.1] - 2024-12-27

### Fixed

- Floating point precision bug where boundary values (e.g., 0.35) could round incorrectly

## [0.2.0] - 2024-12-27

### Changed

- **BREAKING:** New offset model - offset is now an order-of-magnitude offset, not a fraction
  - `0` = current OoM (was `1.0`)
  - `-1` = one OoM finer (was `0.1`)
  - `0.5` = half of current OoM
  - `-1.5` = half of one OoM finer (new capability)
- **BREAKING:** New signatures with three distinct modes:
  - Single: `=ROUND_DYNAMIC(value, [offset])` - default offset=0
  - Dataset: `=ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])` - defaults -0.5, 0, 1
  - Dataset-aware single: `=ROUND_DYNAMIC(value, range, [offset_top], [offset_other], [num_top])`
- Parameter names simplified: `offset_top_order` → `offset_top`, `num_top_orders` → `num_top`

### Removed

- Parameter validation (no guardrails for now)
- Backward compatibility parameter shifting logic

## [0.1.0] - 2024-12-18

### Added

- Initial release
- `ROUND_DYNAMIC` custom function for Google Sheets
- Magnitude-aware rounding with configurable offset
- Dataset-aware rounding
  - Automatic max magnitude detection from input range
  - Finer offset for top magnitude tier, coarser offset for smaller numbers
- Array input/output (spill ranges)
- Handles numbers formatted as text (parses commas, currency symbols, parentheses)
- Non-numeric values pass through unchanged