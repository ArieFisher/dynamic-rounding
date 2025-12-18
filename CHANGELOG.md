# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2025-12-18

### Added

- Initial release
- `ROUND_DYNAMIC` custom function for Google Sheets
- Magnitude-aware rounding with configurable grain
- Dataset-aware rounding
  - Automatic max magnitude detection from input range
  - Finer grain for top magnitude tier (for accuracy) and coarser grain for smaller numbers (for readability)
- Signature
  - Optional parameters: grain_top, grain_other, num_top_orders
  - Parameter validation with descriptive error messages
  - Backward compatible signature (ref_range is optional)
- Range values
  - Handles numbers formatted as text (parses commas, currency symbols, parentheses for negatives)
  - Non-numeric values pass through unchanged
- Modes
  - Array input/output (spill ranges)
  - Separate reference range parameter allows sorting on the range
