# Dynamic Rounding (Python)

Dynamic rounding for readable data — rounds based on order of magnitude.

## Installation

```bash
pip install dynamic-rounding
```

With pandas support:
```bash
pip install dynamic-rounding[pandas]
```

## Quick Start

### Basic usage (no dependencies)

```python
from dynamic_rounding import round_dynamic

# Single value — rounds to nearest half order of magnitude
round_dynamic(87054321)          # → 85000000
round_dynamic(4321)              # → 4500

# Custom offset
round_dynamic(87054321, offset=0)     # → 90000000 (nearest 10M)
round_dynamic(87054321, offset=-1)    # → 87000000 (nearest 1M)
round_dynamic(87054321, offset=-1.5)  # → 87000000 (nearest 500K)

# Dataset — larger values get finer precision
round_dynamic([4428910, 983321, 42109])
# → [4500000, 1000000, 40000]
```

### With pandas

```python
from dynamic_rounding.pandas import round_dynamic_series
import pandas as pd

# Single mode — each value rounds on its own magnitude
round_dynamic_series(df['revenue'])

# Dataset mode — engaged by passing offset_top and/or offset_other;
# the max magnitude comes from the whole series
round_dynamic_series(df['revenue'], offset_top=-0.5, offset_other=-1)

# Parses formatted strings automatically
s = pd.Series(["$1,200", "(500)", "4,428,910.41"])
round_dynamic_series(s)  # → [1000.0, -500.0, 4500000.0]
```

## Features

- **Type preservation:** Returns `int` when the input was `int` and the result is whole, and also when the result is whole and under 10 (trimming a trailing `.0`)
- **None handling:** `None` input returns `None` (not 0)
- **Pass-through:** Non-numeric values pass through unchanged by default
- **String parsing (pandas):** Parses `$`, `€`, `£`, `¥`, commas, spaces, percent signs (`"50%"` → 50), Unicode dash and minus variants, and `(500)` → `-500`. A string with no digits (`"$"`) passes through, and strings with non-ASCII digits pass through for parity with the JS implementations

## API

### `round_dynamic(data, offset=None, offset_top=None, offset_other=None, num_top=1, enforce_numeric=False)`

**Single mode** (when `data` is a number):
- `data`: Number to round
- `offset`: OoM adjustment (default: -0.5)
- `enforce_numeric`: If `True`, raises `ValueError` for non-numeric input

**Dataset mode** (when `data` is a list or tuple):
- `data`: List of numbers to round
- `offset_top`: OoM adjustment for top magnitude(s) (default: -0.5)
- `offset_other`: OoM adjustment for other magnitudes (defaults to matching `offset_top`)
- `num_top`: How many top orders get `offset_top` (default: 1)
- `enforce_numeric`: If `True`, raises `ValueError` for non-numeric values in list

### `round_dynamic_series(series, offset=None, offset_top=None, offset_other=None, num_top=1, enforce_numeric=False)`

Same parameters as `round_dynamic`, but operates on a pandas Series.

- Parses formatted strings automatically (currency, commas, accounting negatives)
- Returns a new Series (original unchanged)

### Offset values

| Offset | Meaning | 87,054,321 rounds to |
|--------|---------|----------------------|
| 1 | one OoM coarser | 100,000,000 |
| 0.5 | half-step toward the next-larger OoM | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| -0.5 | half-step within the current OoM (default) | 85,000,000 |
| -1 | one OoM finer | 87,000,000 |
| -1.5 | half-step within one OoM finer | 87,000,000 |

**Sign convention for fractional offsets:** The sign of the offset chooses the direction of the half-step. `+0.5` rounds to half of the *next-larger* OoM, `-0.5` to half of the *current* OoM. More generally, the step is `|frac(offset)| * 10 ** (OoM + ceil(offset))`.

**Floor at the value's OoM:** After rounding, the magnitude of the result is at least `10 ** floor(log10(abs(value)))` — so a tens-of-millions value can never collapse to `0`.

**Floor at the integer offset:** A fractional offset whose integer part is 1 or more never rounds finer than the corresponding integer offset. `round_dynamic(87054321, offset=-2.5)` returns `87100000` — the `-2` result floors the raw `-2.5` result.

**12 significant digits:** Results are trimmed to 12 significant digits, with ties rounding away from zero. `round_dynamic(1234567890123, offset=-12)` returns `1234567890120`.

**Limits:** Offset must be between -20 and 20; values outside that raise `ValueError`.

## Development

```bash
cd python
pip install -e ".[dev]"
python3 -m pytest tests/ -v
```

## License

MIT

## See Also

- [Google Sheets version](https://github.com/ArieFisher/dynamic-rounding/tree/main/js) — Use `=ROUND_DYNAMIC()` in spreadsheets
- [Design doc](https://github.com/ArieFisher/dynamic-rounding/blob/main/docs/design.md) — Algorithm details
