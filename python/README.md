# Dynamic Rounding (Python)

Dynamic rounding for readable data - rounds based on order of magnitude.

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

# Single value - rounds to nearest half order of magnitude
round_dynamic(86543210)        # → 85,000,000
round_dynamic(4321)            # → 4,500

# Custom offset
round_dynamic(87654321, offset=0)     # → 90,000,000 (nearest 10M)
round_dynamic(87654321, offset=-1)    # → 88,000,000 (nearest 1M)
round_dynamic(87654321, offset=-1.5)  # → 87,500,000 (nearest 500K)

# Dataset - larger values get finer precision
round_dynamic([4428910, 983321, 42109])
# → [4,500,000, 1,000,000, 40,000]
```

### With pandas

```python
from dynamic_rounding.pandas import round_dynamic_series

# Single mode - each value based on its own magnitude
round_dynamic_series(df['revenue'])

# Dataset mode - considers the full series for context
round_dynamic_series(df['revenue'], offset_top=-0.5, offset_other=0)
```

## API

### `round_dynamic(data, offset=None, offset_top=None, offset_other=None, num_top=1)`

**Single mode** (when `data` is a number):
- `data`: Number to round
- `offset`: OoM adjustment (default: -0.5)

**Dataset mode** (when `data` is a list):
- `data`: List of numbers to round
- `offset_top`: OoM adjustment for top magnitude(s) (default: -0.5)
- `offset_other`: OoM adjustment for other magnitudes (default: 0)
- `num_top`: How many top orders get `offset_top` (default: 1)

### Offset values

| Offset | Meaning | 87,654,321 rounds to |
|--------|---------|----------------------|
| 1 | one OoM coarser | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| -0.5 | half of current OoM | 90,000,000 |
| -1 | one OoM finer | 88,000,000 |
| -1.5 | half of one OoM finer | 87,500,000 |

## Development

```bash
cd python
pip install -e ".[dev]"
pytest
```

## License

MIT

## See Also

- [Google Sheets version](https://github.com/ArieFisher/dynamic-rounding/tree/main/js) - Use `=ROUND_DYNAMIC()` in spreadsheets
- [Design doc](https://github.com/ArieFisher/dynamic-rounding/blob/main/design.md) - Algorithm details