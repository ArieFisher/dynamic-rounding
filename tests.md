# Test Cases

Test cases for `ROUND_DYNAMIC` v0.2.x.

## Single-Value Mode

Formula: `=ROUND_DYNAMIC(value, [grain])`

### Grain Variations

Test value: 87,654,321

| Value | [grain] | Expected | Notes |
|-------|---------|----------|-------|
| 87,654,321 | | 90,000,000 | Default grain=0, current OoM |
| 87,654,321 | 0 | 90,000,000 | Current OoM (nearest 10M) |
| 87,654,321 | 1 | 100,000,000 | One OoM up (nearest 100M) |
| 87,654,321 | -1 | 88,000,000 | One OoM down (nearest 1M) |
| 87,654,321 | -2 | 87,700,000 | Two OoM down (nearest 100K) |
| 87,654,321 | 0.5 | 90,000,000 | Half of current OoM (nearest 5M) |
| 87,654,321 | -0.5 | 90,000,000 | Same as 0.5 |
| 87,654,321 | -1.5 | 87,500,000 | Half of one OoM down (nearest 500K) |
| 87,654,321 | -2.5 | 87,650,000 | Half of two OoM down (nearest 50K) |

### Various Magnitudes

| Value | [grain] | Expected | Notes |
|-------|---------|----------|-------|
| 4,308,910 | 0 | 4,000,000 | Millions |
| 4,308,910 | -0.5 | 4,500,000 | Nearest 500K |
| 42,109 | 0 | 40,000 | Ten thousands |
| 42,109 | -0.5 | 42,500 | Nearest 5K |
| 1,234 | 0 | 1,000 | Thousands |
| 0.35 | 0 | 0.4 | Decimals |
| 0.35 | -0.5 | 0.35 | Nearest 0.05 |

### Edge Cases

| Value | [grain] | Expected | Notes |
|-------|---------|----------|-------|
| 0 | | 0 | Zero unchanged |
| | | | Empty returns empty |
| Cloud CDN | | Cloud CDN | Non-numeric passed through |
| -4,308,910 | 0 | -4,000,000 | Negative, sign preserved |
| -42.66 | 0 | -40 | Negative decimal |

### String Parsing

| Value | [grain] | Expected | Notes |
|-------|---------|----------|-------|
| $1,234.56 | 0 | 1,000 | Currency parsed |
| 1,234,567 | 0 | 1,000,000 | Commas parsed |
| (500) | 0 | -500 | Accounting format parsed |
| €1.234 | 0 | 1,000 | Euro parsed |

## Array Mode

Formula: `=ROUND_DYNAMIC(range, [grain_top], [grain_other], [num_top])`

### GCP Invoice Dataset (defaults)

Dataset max magnitude = 6

| Value | [grain_top] | [grain_other] | [num_top] | Expected | Notes |
|-------|-------------|---------------|-----------|----------|-------|
| $4,308,910.41 | | | | 4,500,000 | Mag 6, grain_top=-0.5 |
| 3,892,105.59 | | | | 4,000,000 | Mag 6, grain_top=-0.5 |
| $1,011,204.89 | | | | 1,000,000 | Mag 6, grain_top=-0.5 |
| $983,321.11 | | | | 1,000,000 | Mag 5, grain_other=0 |
| $824,479.02 | | | | 800,000 | Mag 5, grain_other=0 |
| $84,211 | | | | 80,000 | Mag 4, grain_other=0 |
| $42,109.45 | | | | 40,000 | Mag 4, grain_other=0 |
| $21,550.20 | | | | 20,000 | Mag 4, grain_other=0 |
| $1,510.44 | | | | 2,000 | Mag 3, grain_other=0 |
| 1,127.10 | | | | 1,000 | Mag 3, grain_other=0 |
| $67.44 | | | | 70 | Mag 1, grain_other=0 |
| $42.66 | | | | 40 | Mag 1, grain_other=0 |

### Custom Parameters

Using value 4,256,910 in dataset where max magnitude = 6

| Value | [grain_top] | [grain_other] | [num_top] | Expected | Notes |
|-------|-------------|---------------|-----------|----------|-------|
| 4,256,910 | -0.5 | 0 | 1 | 4,500,000 | Default |
| 4,256,910 | 0 | 0 | 1 | 4,000,000 | Coarser top |
| 4,256,910 | -1 | 0 | 1 | 4,300,000 | Finer top |
| 4,256,910 | -1.5 | 0 | 1 | 4,250,000 | Half of finer |
| 4,256,910 | -0.5 | -1 | 1 | 4,500,000 | Finer other (no effect on top) |
| 4,256,910 | -0.5 | 0 | 2 | 4,500,000 | Extend top to 2 orders |

### Decimals Dataset

Dataset max magnitude = -1

| Value | [grain_top] | [grain_other] | [num_top] | Expected | Notes |
|-------|-------------|---------------|-----------|----------|-------|
| 0.35 | | | | 0.35 | Mag -1, grain_top=-0.5 |
| 0.12 | | | | 0.10 | Mag -1, grain_top=-0.5 |
| 0.047 | | | | 0.05 | Mag -2, grain_other=0 |
| 0.0083 | | | | 0.008 | Mag -3, grain_other=0 |

## Sort-Safe Mode

Formula: `=ROUND_DYNAMIC(value, range, [grain_top], [grain_other], [num_top])`

### Basic Verification

Using GCP invoice dataset as range:

| Value | [range] | [grain_top] | [grain_other] | [num_top] | Expected | Notes |
|-------|---------|-------------|---------------|-----------|----------|-------|
| $4,308,910.41 | $A$1:$A$12 | | | | 4,500,000 | Same as array mode |
| $42.66 | $A$1:$A$12 | | | | 40 | Same as array mode |

Verify:
- Returns single value (not array)
- Sorting data doesn't break formulas
- All rows use same max magnitude reference
