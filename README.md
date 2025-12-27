# DynamicRounding

_Dynamic rounding to make data sets more readable._

## tl;dr
I built this to speed up the moment when a dataset's story clicks into focus. 

It fills gaps that require too much fiddling (time and complexity) when using existing tools.  

Starting with Google Sheets, then will implement in Python for dataframes.

Sharing it for anyone who might find it useful.


## What It Does

DynamicRounding simplifies data sets so people can understand them faster.

### Problem 1: Fixed rounding destroys small values

Traditional rounding uses a fixed threshold. Round to the nearest $10,000 and your small values vanish. DynamicRounding adjusts the rounding threshold based on each number's magnitude.

| Cloud Bill | Rounded to $10,000 | DynamicRounding |
|------------|-------------------|-----------------|
| $4,428,910 | $4,430,000 | $4,500,000 |
| $1,510 | $0 | $1,500 |

### Problem 2: Whole-magnitude rounding is too coarse

Rounding to the nearest million makes similar values look very different. DynamicRounding lets you round to fractions of magnitude (halves, quarters, tenths) instead of whole orders.

| Value | Round to nearest million | DynamicRounding |
|-------|-------------------------|-----------------|
| $4.49m | $4m | $4.5m |
| $4.51m | $5m | $4.5m |

### Problem 3: Rounding can make data more readable but less accurate

DynamicRounding uses a heuristic to promote both readability *and* accuracy. It defaults to a finer grain (quarter order of magnitude) for the largest values (preserving accuracy) and coarser grain for all other values (improving readability).

Users can override the defaults with their own heuristic.

### Bonus: It's an array function

Round an entire dataset with one formula: `=ROUND_DYNAMIC(A1:A100)`

### Input Handling

**Numeric casting:** Formatted strings are parsed automatically:
- `"4,428,910.41"` → 4428910.41
- `"$1,200"` → 1200
- `"(500)"` → -500 (accounting format)
- Supports $, €, £, ¥

**Non-numeric values:** Pass through unchanged. This means you can apply the function to a range that includes labels, headers, or mixed content without errors.

## Installation

**Option A: Copy the template** (recommended)

1. Open the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4)
2. File → Make a copy
3. Use `=ROUND_DYNAMIC(...)` in your copy

**Option B: Add the script manually**

1. In your Google Sheet: Extensions → Apps Script
2. Copy the contents of [`round_dynamic.js`](round_dynamic.js)
3. Paste and save
4. Return to your sheet

## Usage

### Array mode (simplest)

```
=ROUND_DYNAMIC(A1:A12)
```

Returns all rounded values at once. Don't sort data with this mode.

### Sort-safe mode

```
=ROUND_DYNAMIC(A2, $A$2:$A$12)
```

Use in each row with absolute reference to the full range. Drag down. Safe to sort.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| value | required | Values to round (cell or range) |
| ref_range | optional | Reference range for magnitude detection (use absolute refs for sort-safe) |
| grain_top | 0.25 | Precision for largest magnitude (quarters) |
| grain_other | 0.5 | Precision for other magnitudes (halves) |
| num_top_orders | 1 | How many top magnitudes get finer grain |

### Examples

```
=ROUND_DYNAMIC(A1:A12)                         # Array mode, all defaults
=ROUND_DYNAMIC(A2, $A$2:$A$12)                 # Sort-safe mode
=ROUND_DYNAMIC(A1:A12, , 0.5)                  # Halves for top tier
=ROUND_DYNAMIC(A1:A12, , 0.25, 0.5, 2)         # Top 2 magnitudes get finer grain
```

## License

MIT
