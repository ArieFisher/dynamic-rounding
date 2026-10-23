# Dynamic Rounding for Google Sheets

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

This function has two modes depending on the arguments provided.

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

Rounds an entire dataset with set-aware behavior: larger numbers retain more detail.

| A | `=ROUND_DYNAMIC(A1:A4)` |
|---|-------------------------|
| 66,543,210 | 65,000,000 |
| 37,021,373 | 35,000,000 |
| 459,321 | 450,000 |
| 6,543 | 6,500 |

Defaults: `offset_top = -0.5`, `offset_other = matches offset_top`, `num_top = 1`

---

## Offset Reference

Offset is an order-of-magnitude adjustment. Negative = finer precision, positive = coarser.

| Offset | Meaning | 87,054,321 rounds to |
|--------|---------|----------------------|
| 1 | one OoM coarser | 100,000,000 |
| 0.5 | half-step toward the next-larger OoM | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| -0.5 | half-step within the current OoM (default) | 85,000,000 |
| -1 | one OoM finer | 87,000,000 |
| -1.5 | half-step within one OoM finer | 87,000,000 |

**Sign convention for fractional offsets:** The sign of the offset chooses the direction of the half-step. `+0.5` rounds to half of the *next-larger* OoM, `-0.5` to half of the *current* OoM. More generally, the step is `|frac(offset)| × 10^(OoM + ceil(offset))`.

**Floor at the value's OoM:** After rounding, the magnitude of the result is at least `10^floor(log10(|value|))`. A tens-of-millions value can never collapse to `0`, regardless of the requested offset.

**Floor at the integer offset:** A fractional offset whose integer part is 1 or more never rounds finer than the corresponding integer offset. `ROUND_DYNAMIC(87054321, -2.5)` returns 87,100,000 — the `-2` result floors the raw `-2.5` result.

**12 significant digits:** Results are trimmed to 12 significant digits, with ties rounding away from zero. This strips floating-point noise from sub-unit steps and is a real precision loss at fine offsets on large or highly precise inputs.

**Limits:** Offset must be between -20 and 20.

---

## Input Handling

`ROUND_DYNAMIC` sorts each value by its type. A custom function receives a cell's value and nothing about the cell's format, so a currency-formatted 1,234 arrives as the number 1234, and a value typed as text arrives as text.

**Numbers:** A number rounds and returns a number, so other formulas still read it. The result takes the formula cell's format, not the source cell's. A percent-formatted 12.3% arrives as 0.123 and rounds to 0.1, which shows as 10% when the formula cell carries a percent format.

**Text:** Text goes through the classification ladder the Chrome extension reads a table cell with. The digits of each number round in place, and every other character stays where it was typed. The rounded digits are grouped with commas and lose their trailing zeros.
- `"$1,011"` → `"$1,000"`
- `"about 1,234 users"` → `"about 1,000 users"`
- `"1234"` → `"1,000"`
- `"$500.00"` → `"$500"`
- `"12.5%"` → `"15%"` (the percent sign stays, and the number is not scaled)
- `"(1,234)"` → `"(1,000)"` (a bracketed number: the brackets are its minus sign, and they stay)
- `"−1234"` → `"−1,000"` (Unicode dash and minus variants read as a minus sign)
- `"4.91tn"` → `"5tn"` (a unit number: its magnitude suffix stays)
- `"CAD45.67"` → `"CAD45"` (a unit number: its currency code stays)
- `"R47"` → `"R45"` (a currency sign written in letters)
- `"Q3 2020"` → `"Q3 2,000"` (a year inside text rounds)
- `"2020"` → `"2020"` (a bare year typed as text reads as a date, and dates stay)
- `"2024-01-15"` → `"2024-01-15"` (dates and times stay)
- `"416-555-1234"` → `"416-555-1234"` (an identifier shape stays)
- `"Call 416-555-1234 about 1,613,245 units"` → `"Call 416-555-1234 about 1,500,000 units"` (inside text, the identifier shape keeps its digits)
- `"13,63"` → `"13,63"` (a comma counts only in the group shape, so a European decimal comma is not read)
- `"1.234,56"` → `"1.234,56"` (a comma after the decimal dot is not read)

**Currency signs:** Every sign and code in the currency list (`CURRENCIES` in [`lib/dr-number/core.js`](../chrome-extension/lib/dr-number/core.js)), letter signs included. A sign written in letters counts only as its own token, so the rand's "R" counts in "R47" and not in "Revenue". A currency code beside a number makes a unit number, so "CAD45.67" and "1,234 USD" round.

**Identifier shapes:** A phone number, an IP address, a web or email address, an ISBN, a postal code, and digit groups split by spaces outside thousands grouping stay as written.

**Result kind:** A text cell that holds one number returns text: a pure cell such as `"$1,011"` or `"12.5%"`, and a bracketed number such as `"(1,234)"`. The sign the user typed stays, as it does in the Chrome extension. A text result stays text in every cell format: `ISNUMBER` returns FALSE, and `SUM` over a range and charts skip it. The `+` operator and `VALUE` read `"$10,000"` when the sign matches the sheet's locale and return `#VALUE!` when it does not. To get a number back, enter the value as a number. The constant `RESULT_KIND` in the Sheets library holds this choice. Its other value, `'number'`, returns the rounded value (1000, 15, -1000) and drops the sign. A cell with words or a unit number returns text under both values.

**Fixed settings:** Numbers inside text, currency, and percent round. Dates and times stay as written. The first row and the first column round, so the whole dataset rounds. No formula parameter changes these.

**Dataset mode:** The max magnitude spans every number in the range: each number cell, and each number read inside a text cell.

**Commas:** A comma groups thousands only in the group shape: a first group of one to three digits, then groups of exactly three, all before the decimal dot. `"1,234"` and `"1,234.56"` read as numbers. Any other comma leaves that run unread, so `"987,5"` and `"1,234,56"` pass through unchanged. The dot is the only decimal mark.

**Text with no number:** Passes through unchanged. A string with no digits at all — a lone currency symbol or separator like `"$"` or `","` — also passes through instead of reading as `0`.

**Dates and booleans:** A date cell and a boolean pass through unchanged.

**Empty/null values:** Return empty string.

---

## Parameters

### Single mode

| Parameter | Default | Description |
|-----------|---------|-------------|
| value | required | Value to round |
| offset | -0.5 | OoM offset |

### Dataset mode

| Parameter | Default | Description |
|-----------|---------|-------------|
| range | required | The dataset: the values to round, and the source of the max magnitude |
| offset_top | -0.5 | Offset for top magnitude(s) |
| offset_other | matches offset_top | Offset for other magnitudes |
| num_top | 1 | How many top orders get offset_top |

---

## Building

`round_dynamic.js` is generated: do not edit it by hand. The Sheets build joins three sources into it: the license header and the Sheets entry source in [`src/`](./src/), and the shared library files the build script lists, which live in the Chrome extension's library: the rounding arithmetic, the number reader, the classification ladder, and the table step. The entry source holds `ROUND_DYNAMIC`, its help card text, the `[VERSION]` line, the fixed settings, the result kind, and the step that sorts each value by its type. Edit a source, then rebuild from the repository root and commit the rebuilt file:

```bash
node scripts/build-sheets.js
```

`node scripts/build-sheets.js --check` exits with an error when the committed `round_dynamic.js` differs from the build. CI runs it on every pull request and fails the run when a source changed without a rebuild.

## Testing

Run the test suite:

```bash
node tests.js
```

The test suite (282 tests) covers:
- Single mode: offset variations, magnitudes, text cells
- Dataset mode: default/custom parameters, mixed data types
- Date/time handling: dates pass through unchanged
- Parameter validation: offset must be between -20 and 20
- Edge cases: undefined, NaN, Infinity, booleans, empty arrays
- Half-step, quarter-step, and floor semantics, including the `X_FLOOR_THRESHOLD` flip
- The shared case table (`round-dynamic-cases.json`) — the cross-platform contract that also runs against the Chrome extension and the Python port

---

## Note: decimal precision in Sheets

For a number cell, `ROUND_DYNAMIC` returns a numeric value. Google Sheets custom functions cannot set a cell's number format from within the function itself — that capability is reserved for bound scripts and installable triggers, not for custom functions called from a cell formula.

As a result, if your offset parameter implies a specific number of decimal places, you may need to manually set the cell's number format to display the intended precision.

**How to set the format:** select the output cells, then go to Format → Number → Custom number format and enter the desired pattern.

| Formula | Recommended format |
|---|---|
| `=ROUND_DYNAMIC(A1:A10, 0.5)` | `0.0` or `0.0%` to show the one decimal place implied by offset 0.5 |
| `=ROUND_DYNAMIC(A1:A10, 0.25)` | `0.00` or `0.00%` to show the two decimal places implied by offset 0.25 |

The Chrome extension has no such constraint: it writes plain numbers with trailing zeros trimmed, so no minimum decimal count applies.

---

## See Also

- [Design Doc](../docs/design.md) — Algorithm and concepts
- [Python version](../python/) — `pip install dynamic-rounding`
- [Changelog](./CHANGELOG.md)

## License

MIT
