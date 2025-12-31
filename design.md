# DynamicRounding Design Doc

**Version:** 2.1

## Features

1. **Declarative Rounding:** Rounds based on an offset from each number's order of magnitude. No need to specify decimal places or rounding units - the function adapts to the input.
2. **Set-Aware Rounding:** When given a dataset, dynamically applies different precision to different orders of magnitude. Larger numbers can retain more detail while smaller numbers are simplified.
3. **Sign-Aware:** Handles negative numbers natively without mathematical errors.
4. **Robust:** Handles non-numeric cells, empty strings, zeros, and dates without crashing. Non-numeric values pass through unchanged.
5. **Multiple Modes:** Supports single, dataset, and dataset-aware single usage patterns via auto-detection.

## Modes

The user invokes one of three modes by their choice of parameters:

### 1. Single

**`=ROUND_DYNAMIC(value, [offset])`**

Rounds one value based on its own magnitude.

| Parameter | Default |
|-----------|---------|
| offset | -0.5 |

### 2. Dataset

**`=ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])`**

Rounds a range. Applies different offsets to top magnitude(s) vs others.

| Parameter | Default |
|-----------|---------|
| offset_top | -0.5 |
| offset_other | 0 |
| num_top | 1 |

### 3. Dataset-aware single

**`=ROUND_DYNAMIC(value, range, [offset_top], [offset_other], [num_top])`**

Same logic as dataset mode, but for one value within context of a range. Safe to sort.

| Parameter | Default |
|-----------|---------|
| offset_top | -0.5 |
| offset_other | 0 |
| num_top | 1 |

## Offsets

The "declarative" nature of this approach works based on offsets from each value's order of magnitude. This stands in contrast to traditional (imperative) rounding where the user must specify exactly what to round a specific input to.

Offset is an order-of-magnitude adjustment. Negative = finer precision, positive = coarser.

| offset | meaning | 87,654,321 rounds to |
|--------|---------|----------------------|
| 1 | one OoM coarser | nearest hundred million |
| 0 | current OoM | nearest ten million |
| -0.5 | half of current OoM | nearest 5 million |
| -1 | one OoM finer | nearest million |
| -1.5 | half of one OoM finer | nearest half-million |

Notes:
- Values between -1 and 1 with the same absolute value produce the same result (e.g., 0.5 and -0.5).
- Offsets are limited to -20 to 20. Values outside this range throw an error.

## Set-Aware Selection

In dataset and dataset-aware single modes, each value receives either `offset_top` or `offset_other` based on its magnitude relative to the dataset's maximum.

**Step 1: Find maximum magnitude in dataset**
```
max_mag = max(floor(log10(abs(value)))) for all numeric values
```

**Step 2: For each value, select offset**
```
if (max_mag - current_mag) < num_top:
    use offset_top
else:
    use offset_other
```

Example with `num_top = 1`:

| Value | Magnitude | max_mag - current_mag | Offset used |
|-------|-----------|----------------------|-------------|
| 4,428,910 | 6 | 0 | offset_top |
| 983,321 | 5 | 1 | offset_other |
| 42,109 | 4 | 2 | offset_other |

The selected offset is then passed to the rounding logic.

## Rounding Logic

Given a `value` and an `offset`:

**Variables:**
- `current_mag`: magnitude of the input value
- `oom_offset`: integer part of offset
- `fraction`: fractional part of offset (or 1 if offset is a whole number)
- `target_mag`: the magnitude we're rounding to
- `base`: the actual rounding unit (e.g., 1,000,000 or 500,000)

**Step 1: Find current magnitude**
```
current_mag = floor(log10(abs(value)))
```
Example: For 87,654,321 → `floor(7.94) = 7`

**Step 2: Decompose offset**
```
oom_offset = trunc(offset)
fraction = abs(offset - oom_offset), or 1 if zero
```
The integer part shifts the magnitude. The fractional part creates half-step rounding.

Example: For `offset = -1.5` → `oom_offset = -1`, `fraction = 0.5`

**Step 3: Calculate target magnitude**
```
target_mag = current_mag + oom_offset
```
Example: `7 + (-1) = 6`

**Step 4: Calculate rounding base**
```
base = 10^target_mag × fraction
```
Example: `10^6 × 0.5 = 500,000`

**Step 5: Round**
```
result = round(value / base) × base
```
Example: `round(87654321 / 500000) × 500000 = 175 × 500000 = 87,500,000`

## Vocabulary

### Core Concepts

| Term | Definition |
|------|------------|
| Order of magnitude (OoM) | The power of 10 of a number. E.g., 87,654,321 has OoM 7 (10^7 = 10,000,000). |
| Magnitude | Shorthand for order of magnitude. Calculated as `floor(log10(abs(value)))`. |
| Offset | How many orders of magnitude to shift when rounding. Negative = finer, positive = coarser. |

### Parameters

| Parameter | Description |
|-----------|-------------|
| value | The number to round. |
| range | The range of values (for rounding or context). |
| offset | OoM adjustment (single mode). |
| offset_top | OoM adjustment for top magnitude(s). |
| offset_other | OoM adjustment for other magnitudes. |
| num_top | How many top orders of magnitude get `offset_top`. |