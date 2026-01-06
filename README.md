# Dynamic Rounding

*Quickly make data more readable.*

Numbers can really get in the way of understanding data. One of the easiest ways to simplify data is to round to an order of magnitude (e.g., 1,234,567 becomes "about 1 million"). This can really help the story emerge.

This tool rounds numbers *declaratively* - you describe the precision you want, and the function adapts to each value's magnitude.

## Implementations

| Platform | Location | Install |
|----------|----------|---------|
| Google Sheets | [`js/`](./js/) | [Copy template](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) |
| Python | [`python/`](./python/) | `pip install dynamic-rounding` |

## Quick Examples

### Google Sheets

```
=ROUND_DYNAMIC(87654321)        → 90,000,000
=ROUND_DYNAMIC(A1:A10)          → rounds entire range
```

### Python

```python
from dynamic_rounding import round_dynamic

round_dynamic(87654321)                    # → 90,000,000
round_dynamic([4428910, 983321, 42109])    # → [4,500,000, 1,000,000, 40,000]
```

## Features

1. **Declarative Rounding:** Specify an offset from each number's order of magnitude. No need to calculate decimal places.
2. **Set-Aware Rounding:** When given a dataset, larger numbers retain more detail while smaller numbers are simplified.
3. **Sign-Aware:** Handles negative numbers correctly.
4. **Robust:** Non-numeric values pass through unchanged.

## Documentation

- [Design Doc](./design.md) - Algorithm and concepts
- [Google Sheets README](./js/README.md) - Full Sheets documentation
- [Python README](./python/README.md) - Full Python documentation

## License

MIT
