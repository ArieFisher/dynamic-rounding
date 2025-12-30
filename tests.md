# Tests

Run the test suite:

```bash
node tests.js
```

## Coverage

The test suite (`tests.js`) covers:

- **Single-value mode**: grain variations, various magnitudes, edge cases, string parsing
- **Array mode**: default parameters, custom parameters, decimals, mixed data types
- **Sort-safe mode**: same cases as array mode, per-value
- **Date/time handling**: dates pass through unchanged in all modes
- **Boundary cases**: magnitude transitions, precision limits, negative numbers
- **Parameter validation**: grain must be between -20 and 20
- **Edge cases**: undefined, NaN, Infinity, booleans, empty arrays, 1D/2D arrays

## Quick Reference

| Input | grain | Expected |
|-------|-------|----------|
| 87,654,321 | 0 | 90,000,000 |
| 87,654,321 | -1 | 88,000,000 |
| 87,654,321 | -1.5 | 87,500,000 |
| 87,654,321 | 1 | 100,000,000 |
| 4,308,910 | -0.5 | 4,500,000 |
| 0.35 | 0 | 0.4 |
| 0.35 | -0.5 | 0.35 |