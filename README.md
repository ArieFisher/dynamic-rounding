# Dynamic Rounding

*Quickly make data more readable.*

## tl;dr

Numbers can really get in the way of understanding data.  
One of the easiest ways to simplify data is to round to a 'significant digit' or 'order of magnitude' (e.g. 1,234,567 becomes "about 1 million"). This can really help the story emerge.

This tool was built to speed up the moment when a dataset's story clicks into focus.   
With a single command it simplifies the contents of a dataframe, or spreadsheet cell or range.

Today it takes so much fiddling to get the message from data because the tools are 'imperative'. You have to write little programs (or chain together spreadsheet functions).  
In contrast, this approach is 'declarative'. You just ask the custom function to simplify the data and the function will intelligently (dynamically) assess and simplify accordingly.

---

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

---

## Usage

DynamicRounding has three modes:

### Single-value mode

**`=ROUND_DYNAMIC(value)`**

In its simplest form, this function rounds to the nearest order of magnitude.    
In traditional (imperative) rounding, the function parameters have to be customized for every cell depending on its size.

| Formula | how to read the instruction | simplified result |
| :---- | :---- | :---- |
| `=ROUND_DYNAMIC(4321)` | declarative: round to nearest order of magnitude<br>imperative equivalent: round to nearest thousand | 4,000 |
| `=ROUND_DYNAMIC(87654321)` | round to nearest order of magnitude (i.e. ten million) | 90,000,000 |
| `=ROUND_DYNAMIC(87654321, -1)` | round to the next (lower) order of magnitude (i.e. nearest million) | 88,000,000 |
| `=ROUND_DYNAMIC(87654321, 0.5)` | round to the nearest half order of magnitude (i.e. five million) | 90,000,000 |
| `=ROUND_DYNAMIC(87654321, -1.5)` | round to the nearest half of the next lower order of magnitude (i.e. nearest 500k) | 87,500,000 |

### Array mode

**`=ROUND_DYNAMIC(range)`**

Rounds a range with set-aware heuristic. Largest values get finer precision. Don't sort data with this mode.

Defaults: grain_top = -0.5, grain_other = 0, num_top = 1

| A | `=ROUND_DYNAMIC(A1:A3)` |
| :---- | :---- |
| 76,543,210 | 75,000,000 |
| 654,321 | 700,000 |
| 1,234 | 1,000 |

### Sort-safe mode

**`=ROUND_DYNAMIC(value, range)`**

Same as array mode, but per-row. Use absolute references. Safe to sort.

| A | B (formula) |
| :---- | :---- |
| 76,543,210 | `=ROUND_DYNAMIC(A1, $A$1:$A$3)` → 75,000,000 |
| 654,321 | `=ROUND_DYNAMIC(A2, $A$1:$A$3)` → 700,000 |
| 1,234 | `=ROUND_DYNAMIC(A3, $A$1:$A$3)` → 1,000 |

## Grain Reference

Grain is an order-of-magnitude offset. Negative = finer precision, positive = coarser.

| grain | meaning | 87,654,321 rounds to |
| :---- | :---- | :---- |
| 1 | one OoM coarser | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| -1 | one OoM finer | 88,000,000 |
| 0.5 | half of current OoM | 90,000,000 |
| -0.5 | half of current OoM (same) | 90,000,000 |
| -1.5 | half of one OoM finer | 87,500,000 |

Note: Values between -1 and 1 with the same absolute value produce the same result (e.g., 0.5 and -0.5, or 0.3 and -0.3).

## Input Handling

**Numeric casting:** Formatted strings are parsed automatically:

- `"4,428,910.41"` → 4428910.41  
- `"$1,200"` → 1200  
- `"(500)"` → -500 (accounting format)  
- Supports `$, €, £, ¥`

**Non-numeric values:** Pass through unchanged.

## Parameters

### Single-value mode

**`=ROUND_DYNAMIC(value, [grain])`**

| Parameter | Default | Description |
| :---- | :---- | :---- |
| value | required | Value to round |
| [grain] | 0 | OoM offset (see Grain Reference) |

### Array and sort-safe modes

**`=ROUND_DYNAMIC(range, [grain_top], [grain_other], [num_top])`**

**`=ROUND_DYNAMIC(value, range, [grain_top], [grain_other], [num_top])`**

| Parameter | Default | Description |
| :---- | :---- | :---- |
| range | required | Range for rounding and/or magnitude detection |
| [grain_top] | -0.5 | Grain for top magnitude(s) |
| [grain_other] | 0 | Grain for other magnitudes |
| [num_top] | 1 | How many top orders get grain_top |

## License

MIT

## Appendix: Rounding well

Rounding well is surprisingly hard to do well.

1. Round to a reasonable significant digit and the small values vanish altogether.  
2. It can make nearly identical values (e.g. 1.49m and 1.5m) round to a number with a difference of 100%.  
3. It can also make very different numbers look the same (e.g. $1.01m and $1.49m differ by 30% but both round to the same $1m)  
4. It's a lot of work: simplifying a small 5x5 grid takes dozens of formulas and *each one* has to be customized to the value within the cell (depending on its magnitude, charge, if it is a percent…)  
5. Rounding causes a loss of accuracy  
6. Most unforgivably, rounding can distort the story.


### Example data set: holiday revenue

Consider this extremely simple data set showing Holiday revenue by sales channel. **Look at it briefly and guess what story is being told.**

|  | Revenue |
| ----- | :---: |
| Shopify Website | $1,512,720.71 |
| Instagram | $1,397,028.84 |
| Amazon | $1,017,926.02 |
| Affiliate Marketing | $74,201.44 |
|  | **$4,001,877.01** |

Simplifying the data using traditional rounding (to the nearest million) gives this:

|  | traditional rounding |
| ----- | :---: |
| Shopify Website | $2,000,000 |
| Instagram | $1,000,000 |
| Amazon | $1,000,000 |
| Affiliate Marketing | $0 |
|  | **$4.0m** |

*Story: This business has multiple distribution channels, with the website worth as much as the other two channels combined.*  
*To grow, invest in paid advertising.*

Simplifying using dynamic rounding gives this: 

|  | dynamic rounding |
| ----- | :---: |
| Shopify Website | $1,500,000 |
| Instagram | $1,500,000 |
| Amazon | $1,000,000 |
| Affiliate Marketing | $70,000 |
|  | **$4.0m** |

*Story: This is a direct-to-consumer brand as evidenced by the three DTC channels (Instagram, affiliate marketing, Shopify) being worth 3x the traditional online retail channel (3m vs. 1m).*  
*To grow, invest in influencer marketing.*

Note that both approaches in this case had identical accuracy. But notice how traditional rounding obliterated the story.
