# Dynamic Rounding

*Quickly make data more readable.*

[![Python 0.1.2](https://img.shields.io/badge/Python-0.1.2-blue)](./python/)
[![Google Sheets 0.2.4](https://img.shields.io/badge/Google%20Sheets-0.2.4-green)](./js/)

Numbers can really get in the way of understanding data. One of the easiest ways to simplify data is to round to an order of magnitude (e.g., 1,234,567 becomes "about 1 million"). This can really help the story emerge.

This tool rounds numbers *declaratively* — you describe the precision you want, and the function adapts to each value's magnitude.

## Implementations

| Platform | Location | Install |
|----------|----------|---------|
| Google Sheets | [`js/`](./js/) | [Copy template](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) |
| Python | [`python/`](./python/) | `pip install dynamic-rounding` |

## Quick Examples

### Google Sheets

```
=ROUND_DYNAMIC(87054321)        → 85,000,000
=ROUND_DYNAMIC(A1:A10)          → rounds entire range with set-aware precision
```

### Python

```python
from dynamic_rounding import round_dynamic

# Single value
round_dynamic(87054321)                    # → 85,000,000

# Dataset - larger values get finer precision
round_dynamic([4428910, 983321, 42109])    # → [4,500,000, 1,000,000, 40,000]
```

### Python with pandas

```python
from dynamic_rounding.pandas import round_dynamic_series

# Rounds entire Series with set-aware precision
round_dynamic_series(df['revenue'])

# Parses formatted strings automatically
# "$1,200" → 1200, "(500)" → -500
```

## Features

1. **Declarative Rounding:** Specify an offset from each number's order of magnitude. No need to calculate decimal places.
2. **Set-Aware Rounding:** When given a dataset, larger numbers retain more detail while smaller numbers are simplified.
3. **Sign-Aware:** Handles negative numbers correctly.
4. **Robust:** Non-numeric values pass through unchanged. Nulls, zeros, and dates don't crash.
5. **String Parsing:** Automatically parses `$1,200`, `(500)`, and other formatted strings.
6. **Type Preservation (Python):** Returns `int` when input was `int` and result is whole.

## Offset Reference

| Offset | Meaning | 87,054,321 rounds to |
|--------|---------|----------------------|
| 1 | one OoM coarser | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| -0.5 | half of current OoM (default) | 85,000,000 |
| -1 | one OoM finer | 87,000,000 |
| -1.5 | half of one OoM finer | 87,000,000 |

## Documentation

- [Design Doc](./docs/design.md) — Algorithm and concepts
- [Google Sheets README](./js/README.md) — Full Sheets documentation
- [Python README](./python/README.md) — Full Python documentation

## License

MIT
