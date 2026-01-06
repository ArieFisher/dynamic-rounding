# Dynamic Rounding for Google Sheets

**Version 0.2.4**

*Quickly make data more readable.*

This is a custom function for Google Sheets that rounds numbers *declaratively* — you describe the precision you want, and the function adapts to each value's magnitude.

## Installation

**Option A: Copy the template**

1. Open the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4)
2. File → Make a copy
3. Use `=ROUND_DYNAMIC(...)` in your copy

**Option B: Add manually**

1. In your Google Sheet: Extensions → Apps Script
2. Copy the contents of [`round_dynamic.js`](./round_dynamic.js)
3. Paste and save
4. Return to your sheet

---

## Usage

This function has three modes depending on the arguments provided.

### Single mode

**`=ROUND_DYNAMIC(value, [offset])`**

Rounds a single value to the nearest half order of magnitude (default).

| Formula | Result |
|---------|--------|
| `=ROUND_DYNAMIC(4321)` | 4,500 |
| `=ROUND_DYNAMIC(87054321)` | 85,000,000 |
| `=ROUND_DYNAMIC(87054321, 0)` | 90,000,000 |
| `=ROUND_DYNAMIC(87054321, -1)` | 87,000,000 |
| `=ROUND_DYNAMIC(87054321, -1.5)` | 87,000,000 |

### Dataset mode

**`=ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])`**

Rounds an entire range with dataset-aware behavior: larger numbers retain more detail.

| A | `=ROUND_DYNAMIC(A1:A4)` |
|---|-------------------------|
| 66,543,210 | 65,000,000 |
| 37,021,373 | 35,000,000 |
| 459,321 | 500,000 |
| 6,543 | 7,000 |

Defaults: `offset_top = -0.5`, `offset_other = 0`, `num_top = 1`

### Dataset-aware single mode

**`=ROUND_DYNAMIC(value, range, [offset_top], [offset_other], [num_top])`**

Rounds one value within the context of a range.

| A | Formula → Result |
|---|------------------|
| 66,543,210 | `=ROUND_DYNAMIC(A1, A$1:A$4)` → 65,000,000 |
| 37,021,373 | `=ROUND_DYNAMIC(A2, A$1:A$4)` → 35,000,000 |
| 459,321 | `=ROUND_DYNAMIC(A3, A$1:A$4)` → 500,000 |
| 6,543 | `=ROUND_DYNAMIC(A4, A$1:A$4)` → 7,000 |

---

## Offset Reference

Offset is an order-of-magnitude adjustment. Negative = finer precision, positive = coarser.

| Offset | Meaning | 87,054,321 rounds to |
|--------|---------|----------------------|
| 1 | one OoM coarser | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| -0.5 | half of current OoM | 85,000,000 |
| -1 | one OoM finer | 87,000,000 |
| -1.5 | half of one OoM finer | 87,000,000 |

**Note:** Values between -1 and 1 with the same absolute value produce the same result (e.g., 0.5 and -0.5).

**Limits:** Offset must be between -20 and 20.

---

## Input Handling

**Numeric casting:** Formatted strings are parsed automatically:
- `"4,428,910.41"` → 4428910.41
- `"$1,200"` → 1200
- `"(500)"` → -500 (accounting format)
- Supports `$`, `€`, `£`, `¥`

**Non-numeric values:** Pass through unchanged.

**Empty/null values:** Return empty string.

---

## Parameters

### Single mode

| Parameter | Default | Description |
|-----------|---------|-------------|
| value | required | Value to round |
| offset | -0.5 | OoM offset |

### Dataset modes

| Parameter | Default | Description |
|-----------|---------|-------------|
| range | required | Range for rounding and/or magnitude detection |
| offset_top | -0.5 | Offset for top magnitude(s) |
| offset_other | 0 | Offset for other magnitudes |
| num_top | 1 | How many top orders get offset_top |

---

## Testing

Run the test suite:

```bash
node tests.js
```

The test suite covers:
- Single mode: offset variations, magnitudes, string parsing
- Dataset mode: default/custom parameters, mixed data types
- Dataset-aware single mode: per-value context
- Date/time handling: dates pass through unchanged
- Parameter validation: offset must be between -20 and 20
- Edge cases: undefined, NaN, Infinity, booleans, empty arrays

---

## See Also

- [Design Doc](../docs/design.md) — Algorithm and concepts
- [Python version](../python/) — `pip install dynamic-rounding`
- [Changelog](./CHANGELOG.md)

## License

MIT
