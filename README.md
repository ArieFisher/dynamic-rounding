# Dynamic Rounding

*Quickly make data more readable.*

## tl;dr

Numbers can really get in the way of understanding data.  
One of the easiest ways to understand data is to radically simplify it (e.g. 1,234,567 becomes "about 1 million"). This can really help the story emerge.

This tool was built to speed up the moment when a dataset's story clicks into focus.  
With a single command it simplifies the contents of a dataframe, a spreadsheet cell, or a range.

Today it takes so much fiddling to get the message from data in part because the tools we use are 'imperative'. We have to write little programs (or chain together spreadsheet functions) before we can even start trying to understand the data. This tool lets the user take a 'declarative' approach. The user asks the function to simplify the data and the function intelligently (dynamically) assesses and simplifies accordingly.

In a sense, this tool uses an AI-like interface (the users describes their goal) while delivering a guaranteed result (the function runs existing, tested code).

---

## Installation

**Option A: Make a copy of the template**

1. Open the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4)  
2. File → Make a copy  
3. Use `=ROUND_DYNAMIC(...)` in your copy

**Option B: Add the script manually**

1. In your Google Sheet: Extensions → Apps Script  
2. Copy the contents of [`round_dynamic.js`](http://round_dynamic.js)  
3. Paste and save  
4. Return to your sheet

---

## Usage

This function has three modes depending on the arguments provided.

### Single mode

**`=ROUND_DYNAMIC(value)`**

`=ROUND_DYNAMIC(value, [offset])`

In its simplest form, this function takes a single value and returns a single value rounded to the nearest half order of magnitude.

| Formula | how to read the instruction | simplified result |
| :---- | :---- | :---- |
| `=ROUND_DYNAMIC(4321) =ROUND_DYNAMIC(87654321)` | declarative: round to nearest half order of magnitude imperative equivalent:  \- round to nearest 500 \- round to the nearest 5 million | 4,500 90,000,000 |
| `=ROUND_DYNAMIC(87654321)` | round to nearest half order of magnitude (i.e. five million) | 90,000,000 |
| `=ROUND_DYNAMIC(87654321, 0)` | round to the nearest order of magnitude (i.e. ten million) | 90,000,000 |
| `=ROUND_DYNAMIC(87654321, -1)` | round to the next (lower) order of magnitude (i.e. nearest million) | 88,000,000 |
| `=ROUND_DYNAMIC(87654321, -1.5)` | round to the nearest half of the next lower order of magnitude (i.e. nearest 500k) | 87,500,000 |

### Dataset mode

**`=ROUND_DYNAMIC(range)`**

`=ROUND_DYNAMIC(range,` `[offset for numbers in top order of magnitude],` `[offset for numbers in other orders of magnitude],` `[number of orders of magnitude considered to be "top"]` `)`

This mode takes and returns an entire range of data in a single call (i.e. an array function). In addition, this mode enables *dataset-aware* behaviour: different treatment of different-sized numbers (e.g. to promote readability and minimize information loss).

Defaults: offset\_top \= \-0.5, offset\_other \= 0, num\_top \= 1

| A | `=ROUND_DYNAMIC(A1:A4)` |
| :---: | :---: |
| 66,543,210 | 65,000,000 |
| 37,021,373 | 35,000,000 |
| 459,321 | 500,000 |
| 6,543 | 7,000 |

### Dataset-aware single mode

**`=ROUND_DYNAMIC(value, range)`**

`=ROUND_DYNAMIC(value, range,` `[offset for numbers in top order of magnitude],` `[offset for numbers in other orders of magnitude],` `[number of orders of magnitude considered to be "top"]` `)`

A combination of the two modes: rounds an individual number within the *context* of a set. Returns a single value (and is therefore safe to sort). Can be used on some or all of the range. Can be sorted.

| A | formula → output |
| :---- | :---- |
| 66,543,210 | `=ROUND_DYNAMIC(A1, A$1:A$4) →` 65,000,000 |
| 37,021,373 | `=ROUND_DYNAMIC(A2, A$1:A$4) →` 35,000,000 |
| 459,321 | `=ROUND_DYNAMIC(A3, A$1:A$4) →` 500,000 |
| 6,543 | `=ROUND_DYNAMIC(A4, A$1:A$4) →` 7,000 |

## Understanding Offsets

Offset is an order-of-magnitude adjustment. Negative \= finer precision, positive \= coarser.

| offset | meaning | 87,654,321 rounds to |
| :---- | :---- | :---- |
| 1 | one OoM coarser | 100,000,000 |
| 0 | current OoM | 90,000,000 |
| \-1 | one OoM finer | 88,000,000 |
| 0.5 | half of current OoM | 90,000,000 |
| \-0.5 | half of current OoM (same) | 90,000,000 |
| \-1.5 | half of one OoM finer | 87,500,000 |

Note: Values between \-1 and 1 with the same absolute value produce the same result (e.g., 0.5 and \-0.5, or 0.3 and \-0.3).

**Limits:** Offset must be between \-20 and 20 (i.e. this function can round to the nearest \+-20 orders of magnitude). Values outside this range will throw an error.  This number has been arbitrarily chosen as a spreadsheet sanity limit, but it should be reconsidered when porting to other languages.

## Input Handling

**Numeric casting:** Formatted strings are parsed automatically:

- `"4,428,910.41"` → 4428910.41  
- `"$1,200"` → 1200  
- `"(500)"` → \-500 (accounting format)  
- Supports `$, €, £, ¥`

**Non-numeric values:** Pass through unchanged.

## Parameters

### Single mode

**`=ROUND_DYNAMIC(value, [offset])`**

| Parameter | Default | Description |
| :---- | :---- | :---- |
| value | required | Value to round |
| \[offset\] | \-0.5 | OoM offset (see Offset Reference) |

### Dataset and dataset-aware single modes

**`=ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])`**

**`=ROUND_DYNAMIC(value, range, [offset_top], [offset_other], [num_top])`**

| Parameter | Default | Description |
| :---- | :---- | :---- |
| range | required | Range for rounding and/or magnitude detection |
| \[offset\_top\] | \-0.5 | Offset for top magnitude(s) |
| \[offset\_other\] | 0 | Offset for other magnitudes |
| \[num\_top\] | 1 | How many top orders get offset\_top |

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
| :---- | :---: |
| Shopify Website | $1,512,720.71 |
| Instagram | $1,397,028.84 |
| Amazon | $1,017,926.02 |
| Affiliate Marketing | $74,201.44 |
|  | **$4,001,877.01** |

Simplifying the data using traditional rounding (to the nearest million) gives this:

|  | traditional rounding |
| :---- | :---: |
| Shopify Website | $2,000,000 |
| Instagram | $1,000,000 |
| Amazon | $1,000,000 |
| Affiliate Marketing | $0 |
|  | **$4.0m** |

*Story: This business has multiple distribution channels, with the website worth as much as the other two channels combined.*  
*To grow, invest in paid advertising.*

Simplifying using dynamic rounding gives this:

|  | dynamic rounding |
| :---- | :---: |
| Shopify Website | $1,500,000 |
| Instagram | $1,500,000 |
| Amazon | $1,000,000 |
| Affiliate Marketing | $70,000 |
|  | **$4.0m** |

*Story: This is a direct-to-consumer brand as evidenced by the three DTC channels (Instagram, affiliate marketing, Shopify) being worth 3x the traditional online retail channel (3m vs. 1m).*  
*To grow, invest in influencer marketing.*

In this case both approaches resulted in the same lost precision – but notice how traditional rounding obliterated the story. 