# Product Specification: DynamicRounding

**Version:** 2.0

**Status:** Draft

## 1. Executive Summary

DynamicRounding is a rounding utility designed to aid data storytelling by promoting human readability. DynamicRounding dynamically adjusts how much it rounds according to the number's order of magnitude. This ensures that massive numbers ($350,938,102.47) and tiny decimals ($0.035) are represented with consistent visual logic.


## 2. Problem Statement

* **Standard Rounding** is too rigid. Rounding to the nearest million might be fine for a $300M figure, but it obliterates detail on a $1.4M figure.
* **Significant Digit Rounding** is often too granular (e.g., $326,509,631 rounding to $330,000,000 instead of a "cleaner" $350,000,000).

## 3. Functional Requirements

1. **Magnitude-Based Logic:** Rounding grain must change based on the power of 10 of the input.
2. **Hybrid Precision:** Support a "Sliding Scale" where the largest numbers in a set use finer grain than smaller numbers.
3. **Sign-Awareness:** Must handle negative numbers natively without mathematical errors.
4. **Robustness:** Handle non-numeric cells, empty strings, and zeros without crashing.
5. **Multiple Modes:** Support single-value, array, and sort-safe usage patterns.

## 4. Grain Model

Grain is expressed as an order-of-magnitude offset. Negative values mean finer precision, positive values mean coarser.

| grain | meaning | 87,654,321 rounds to |
|-------|---------|---------------------|
| 1 | one OoM coarser | 100,000,000 (nearest 100M) |
| 0 | current OoM | 90,000,000 (nearest 10M) |
| -1 | one OoM finer | 88,000,000 (nearest 1M) |
| 0.5 | half of current OoM | 90,000,000 (nearest 5M) |
| -0.5 | half of current OoM | 90,000,000 (same as 0.5) |
| -1.5 | half of one OoM finer | 87,500,000 (nearest 500K) |

Note: Values between -1 and 1 with the same absolute value produce the same result (e.g., 0.5 and -0.5, or 0.3 and -0.3).

### Rounding Logic

1. Identify the current magnitude: `current_mag = floor(log10(|x|))`
2. Decompose grain into offset and fraction:
   - `oom_offset = trunc(grain)`
   - `fraction = abs(grain - oom_offset)` or 1 if zero
3. Calculate target magnitude: `target_mag = current_mag + oom_offset`
4. Calculate rounding base: `base = 10^target_mag × fraction`
5. Round: `result = round(x / base) × base`

## 5. Google Sheets Implementation

### Three Modes

#### Single-Value Mode

```
=ROUND_DYNAMIC(value, [grain])
```

Rounds one value based on its own magnitude. Default grain = 0.

| Parameter | Default | Description |
|-----------|---------|-------------|
| value | required | Value to round |
| [grain] | 0 | OoM offset |

#### Array Mode

```
=ROUND_DYNAMIC(range, [grain_top], [grain_other], [num_top])
```

Rounds a range with set-aware heuristic. Largest values get finer precision.

| Parameter | Default | Description |
|-----------|---------|-------------|
| range | required | Values to round |
| [grain_top] | -0.5 | Grain for top magnitude(s) |
| [grain_other] | 0 | Grain for other magnitudes |
| [num_top] | 1 | How many top orders get grain_top |

#### Sort-Safe Mode

```
=ROUND_DYNAMIC(value, range, [grain_top], [grain_other], [num_top])
```

Same as array mode, but returns single value. Use absolute references for range.

| Parameter | Default | Description |
|-----------|---------|-------------|
| value | required | Single value to round |
| range | required | Reference range for magnitude detection |
| [grain_top] | -0.5 | Grain for top magnitude(s) |
| [grain_other] | 0 | Grain for other magnitudes |
| [num_top] | 1 | How many top orders get grain_top |

### Mode Detection

The function auto-detects mode based on parameter types:

| First param | Second param | Mode |
|-------------|--------------|------|
| array | — | Array mode |
| value | array | Sort-safe mode |
| value | number or empty | Single-value mode |

### Input Handling

* **Numeric casting:** Formatted strings are parsed automatically (commas, currency symbols, parentheses for negatives)
* **Non-numeric values:** Pass through unchanged
* **Empty cells:** Return empty string
* **Zero:** Returns zero

### Deployment

Custom function via Apps Script bound to a spreadsheet:

1. In Google Sheet: Extensions → Apps Script
2. Paste the implementation code
3. Save and return to sheet
4. Use as `=ROUND_DYNAMIC(A1)` or `=ROUND_DYNAMIC(A1:A12)`

---

## Appendix A: Example Usage

### Single-Value Mode

| Formula | 87,654,321 rounds to |
|---------|---------------------|
| `=ROUND_DYNAMIC(A1)` | 90,000,000 |
| `=ROUND_DYNAMIC(A1, -1)` | 88,000,000 |
| `=ROUND_DYNAMIC(A1, -1.5)` | 87,500,000 |

### Array Mode

| A | B: `=ROUND_DYNAMIC(A1:A3)` |
|---|---------------------------|
| 76,543,210 | 75,000,000 |
| 654,321 | 700,000 |
| 1,234 | 1,000 |

### Sort-Safe Mode

| A | B (formula) |
|---|-------------|
| 76,543,210 | `=ROUND_DYNAMIC(A1, $A$1:$A$3)` → 75,000,000 |
| 654,321 | `=ROUND_DYNAMIC(A2, $A$1:$A$3)` → 700,000 |
| 1,234 | `=ROUND_DYNAMIC(A3, $A$1:$A$3)` → 1,000 |


## Appendix B: The Story in Data

If your data looks like this…

| Service Name | Cost ($) |
| :---- | :---- |
| Cloud CDN | 4,428,910.41 |
| Cloud Storage | 3,892,105.59 |
| BigQuery | 824,479.02 |
| Cloud Load Balancing | 1,011,204.89 |
| Firestore | 983,321.11 |
| Cloud Dataproc | 84,211.00 |
| Cloud Run | 42,109.45 |
| Cloud Pub/Sub | 31,550.00 |
| Cloud Dataflow | 1,210.44 |
| Cloud Spanner | 412.10 |
| Persistent Disk | 67.44 |
| Compute Engine | 42.66 |

It is nearly impossible to understand the story. It is fully obscured by the specificity of the numbers.

Here are 5 stories told by this data:

* **Inverted compute ratio**: Compute Engine is practically zero ($43) while CDN is $4.4M. This is a "store and serve" operation, not a "compute and transform" one.
* **Fully serverless architecture**: Near-zero Compute Engine + Cloud Run for app logic means they've avoided traditional VMs entirely.
* **Read-heavy workload**: The CDN-to-compute ratio suggests users consume far more than they create. Think streaming, gaming asset delivery, or software distribution.
* **Analytics as afterthought**: BigQuery at $824K is substantial but dwarfed by delivery costs - they analyze behavior but don't do heavy data transformation (Dataflow and Dataproc are negligible).
* **Firestore for state**: Nearly $1M suggests a large user base with app metadata, preferences, or session data - but not transactional workloads (Spanner is basically unused).
