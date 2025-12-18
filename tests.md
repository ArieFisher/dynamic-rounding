# Test Cases

Test cases for `ROUND_DYNAMIC`. All tests assume default parameters unless noted.

**Important:** Each dataset section must be tested as a single range (e.g., `=ROUND_DYNAMIC(A1:A10)`), not as individual cells. The function detects max magnitude from the entire range.

## Basic Rounding

Dataset: GCP invoice (max magnitude = 6)

| Input | Expected | Notes |
|-------|----------|-------|
| 4,428,910.41 | 4,500,000 | Top magnitude, grain=0.25 |
| 3,892,105.59 | 4,000,000 | Top magnitude, grain=0.25 |
| 824,479.02 | 800,000 | Magnitude 5, grain=0.5 |
| 1,011,204.89 | 1,000,000 | Magnitude 6, grain=0.25 |
| 84,211.00 | 85,000 | Magnitude 4, grain=0.5 |
| 42,109.45 | 40,000 | Magnitude 4, grain=0.5 |
| 1,210.44 | 1,000 | Magnitude 3, grain=0.5 |
| 412.10 | 400 | Magnitude 2, grain=0.5 |
| 67.44 | 65 | Magnitude 1, grain=0.5 |
| 42.66 | 45 | Magnitude 1, grain=0.5 |

## Decimals

Dataset: small decimals (max magnitude = -1)

| Input | Expected | Notes |
|-------|----------|-------|
| 0.35 | 0.35 | Top magnitude, grain=0.25 |
| 0.12 | 0.125 | Top magnitude, grain=0.25 |
| 0.047 | 0.045 | Magnitude -2, grain=0.5 |
| 0.0083 | 0.0085 | Magnitude -3, grain=0.5 (may display as 0.009) |

## Percentages

Dataset: percentage values (max magnitude = 2)

| Input | Expected | Notes |
|-------|----------|-------|
| 132% | 125% | Top magnitude, grain=0.25 |
| 102% | 100% | Top magnitude, grain=0.25 |
| 76% | 75% | Magnitude 1, grain=0.5 |
| 43% | 45% | Magnitude 1, grain=0.5 |
| 7% | 7% | Magnitude 0, grain=0.5 |

## Negative Numbers

Test within GCP invoice dataset (max magnitude = 6):

| Input | Expected | Notes |
|-------|----------|-------|
| -4,428,910 | -4,500,000 | Sign preserved, top magnitude |
| -42.66 | -45 | Sign preserved, magnitude 1 |

Test parsing of accounting format (standalone):

| Input | Expected | Notes |
|-------|----------|-------|
| (500) | -500 | Accounting format parsed, rounds to itself |

## Edge Cases

| Input | Expected | Notes |
|-------|----------|-------|
| 0 | 0 | Zero unchanged |
| "" | "" | Empty string unchanged |
| "Cloud CDN" | "Cloud CDN" | Non-numeric passed through |

Test string parsing within GCP invoice dataset (max magnitude = 6):

| Input | Expected | Notes |
|-------|----------|-------|
| "$1,234.56" | 1,000 | Currency parsed, magnitude 3, grain=0.5 |
| "1,234,567" | 1,250,000 | Commas parsed, magnitude 6, grain=0.25 |

## Parameter Variations

Using value 4,256,910 in a dataset where max magnitude = 6:

| grain_top | grain_other | Expected | Notes |
|-----------|-------------|----------|-------|
| 0.25 | 0.5 | 4,250,000 | Default |
| 0.5 | 0.5 | 4,500,000 | Coarser top |
| 0.1 | 0.5 | 4,300,000 | Finer top |
| 1 | 1 | 4,000,000 | Whole magnitude |

## Sort-Safe Mode

Formula: `=ROUND_DYNAMIC(A2, $A$2:$A$12)`

- Verify returns single value (not array)
- Verify sorting data doesn't break formulas
- Verify all rows use same max magnitude reference

## Parameter Validation

| Input | Expected | Notes |
|-------|----------|-------|
| `grain_top = 2` | #ERROR: grain_top must be between 0 and 1 | Rejected |
| `grain_top = 0` | #ERROR: grain_top must be greater than 0 | Rejected |
| `grain_top = -0.5` | #ERROR: grain_top must be greater than 0 | Rejected |
| `grain_top = "0.5"` | #ERROR: grain_top must be a number | Rejected (strings not accepted) |
| `grain_top = "abc"` | #ERROR: grain_top must be a number | Rejected |
| `grain_other = 0` | #ERROR: grain_other must be greater than 0 | Rejected |
| `grain_other = "0.5"` | #ERROR: grain_other must be a number | Rejected (strings not accepted) |
| `num_top_orders = 0` | #ERROR: num_top_orders must be a positive integer | Rejected |
| `num_top_orders = 1.5` | #ERROR: num_top_orders must be a positive integer | Rejected |
| `num_top_orders = "2"` | #ERROR: num_top_orders must be a number | Rejected (strings not accepted) |
