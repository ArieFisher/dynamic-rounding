# DynamicRounding Design Doc

**Version:** 2.4

**Platforms:**
- Google Sheets (JavaScript) — see [js/CHANGELOG.md](../js/CHANGELOG.md)
- Python — see [python/pyproject.toml](../python/pyproject.toml)
- Chrome extension — see [chrome-extension/manifest.json](../chrome-extension/manifest.json)

The three platforms share one contract: `js/round-dynamic-cases.json`, a case table that runs in the Sheets suite, the extension suite, and the Python suite, so a rounding change in one platform fails tests in the others until all three agree.

## Features

1. **Declarative Rounding:** Rounds based on an offset from each number's order of magnitude. No need to specify decimal places or rounding units — the function adapts to the input.

2. **Set-Aware Rounding:** When given a dataset, dynamically applies different precision to different orders of magnitude. Larger numbers can retain more detail while smaller numbers are simplified.

3. **Sign-Aware:** Handles negative numbers natively without mathematical errors.

4. **Robust:** Handles empty strings, zeros, nulls, and dates without crashing.
   - *Google Sheets:* Non-numeric values pass through unchanged. Empty/null returns `""`. Dates pass through.
   - *Python:* Non-numeric values pass through unchanged by default. `None` returns `None`.
   - *Chrome extension:* A cell the classification ladder refuses is left untouched. Date cells are actively simplified (to the year by default); time cells are opt-in.

5. **String Parsing:** Formatted strings are parsed automatically, identically on all three platforms:
   - Currency symbols: `$`, `€`, `£`, `¥`
   - Thousands separators: commas, spaces
   - Percent signs: `50%` → 50 (stripped, not scaled)
   - Unicode dash and minus variants: read as a negative sign
   - Accounting negatives: `(500)` → `-500`
   - A string with no digits (`"$"`, `","`) is non-numeric and passes through
   - *Where:* Google Sheets (built in), Python (pandas module), Chrome extension (built in)

6. **Type Preservation (Python):** Returns `int` when the input was `int` and the result is whole, and when the result is whole and under 10; otherwise returns `float`.

7. **Strict Mode (Python):** Use `enforce_numeric=True` to raise `ValueError` for non-numeric input instead of passing through.

8. **Multiple Modes:** Supports single and dataset usage patterns via auto-detection.

## Modes

The user invokes one of two modes by their choice of parameters:

### 1. Single

**`=ROUND_DYNAMIC(value, [offset])`** (Sheets)  
**`round_dynamic(value, offset=...)`** (Python)

Rounds one value based on its own magnitude.

| Parameter | Default |
|-----------|---------|
| offset | -0.5 |

### 2. Dataset

**`=ROUND_DYNAMIC(range, [offset_top], [offset_other], [num_top])`** (Sheets)  
**`round_dynamic([values], offset_top=..., offset_other=..., num_top=...)`** (Python)

Rounds a whole dataset. Applies different offsets to top magnitude(s) vs others.

| Parameter | Default |
|-----------|---------|
| offset_top | -0.5 |
| offset_other | matches offset_top |
| num_top | 1 |


## Offsets

The "declarative" nature of this approach works based on offsets from each value's order of magnitude. This stands in contrast to traditional (imperative) rounding where the user must specify exactly what to round a specific input to.

Offset is an order-of-magnitude adjustment. Negative = finer precision, positive = coarser.

| offset | meaning | 87,054,321 rounds to |
|--------|---------|----------------------|
| 1 | one magnitude coarser | 100,000,000 |
| 0.5 | half-step toward the next-larger magnitude | 100,000,000 |
| 0 | current magnitude | 90,000,000 |
| -0.5 | half-step within the current magnitude | 85,000,000 |
| -1 | one magnitude finer | 87,000,000 |
| -1.5 | half-step within one magnitude finer | 87,000,000 |

Notes:
- The sign of a fractional offset chooses the direction of the half-step: `+0.5` rounds to half of the *next-larger* magnitude's step, `-0.5` to half of the *current* magnitude's step. They are different results by design (the 2026-05-28 release).
- Offsets are limited to -20 to 20. Sheets and Python throw an error for values outside this range; the Chrome extension falls back to the default offset instead.

## Set-Aware Selection

In dataset mode, each value receives either `offset_top` or `offset_other` based on its magnitude relative to the dataset's maximum.

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

**The extension's dataset:** in a table, the max magnitude comes only from cells that are inside the range expression, not excluded (first row, first column, currency, percent), classified as pure number cells, and not in an outside row. An outside row — a grid row outside every row group, or a native table's `<tfoot>` row — rounds against the dataset without joining it: its values never feed the max magnitude or the lens preview. On a virtualized grid the max magnitude freezes when simplification is first applied, so scrolling new rows into view does not shift it.

## Rounding Logic

Given a `value` and an `offset`:

**Variables:**
- `current_mag`: magnitude of the input value
- `target_mag`: the magnitude we're rounding to
- `f`: fractional magnitude of the offset
- `step`: the concrete rounding unit (e.g., 1,000,000 or 500,000)

**Step 1: Find current magnitude**
```
current_mag = floor(log10(abs(value)))
```
Example: For 87,054,321 → `floor(7.94) = 7`

**Step 2: Calculate the step**

For an integer offset:
```
step = 10^(current_mag + offset)
```

For a fractional offset:
```
target_mag = current_mag + ceil(offset)
f          = abs(offset - trunc(offset))
step       = f × 10^target_mag
```
`ceil` makes the step sign-aware: for `offset = -1.5` → `target_mag = 7 + (-1) = 6`, `f = 0.5`, `step = 500,000`; for `offset = +0.5` → `target_mag = 7 + 1 = 8`, `step = 50,000,000`.

**Step 3: Round**
```
raw = round(abs(value) / step + epsilon) × step
```
Example: `round(87054321 / 500000 + 1e-9) × 500000 = 174 × 500000 = 87,000,000`

**Step 4: Apply the floors**
```
result = max(raw, 10^current_mag)
```
The value-OoM floor: a result never collapses below the value's own magnitude, so a tens-of-millions value can never round to 0.

For a fractional offset whose integer part is at least `X_FLOOR_THRESHOLD` (1):
```
result = max(result, round_with_offset(abs(value), trunc(offset)))
```
The x-floor: a fractional offset never rounds finer than the corresponding integer offset. Example: `87054321` at `-2.5` returns `87,100,000` (the `-2` result), not `87,050,000`.

**Step 5: Clean up and restore the sign**

The result is trimmed to 12 significant digits (ties round away from zero) — this strips floating-point noise from sub-unit steps and is a real precision loss at fine offsets on large or highly precise inputs. Whole results, and any result of 10 or more, return as integers. The input's sign is then restored.

## Implementation Details

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `EPSILON` | 1e-9 | Added to rounding to handle floating-point precision edge cases |
| `VALIDATION_LIMIT` | 20 | Offset must be between -20 and 20 |
| `DEFAULT_OFFSET_TOP` | -0.5 | Default offset for both modes (`offset_other` defaults to matching it) |
| `DEFAULT_NUM_TOP` | 1 | Default width of the top band |
| `X_FLOOR_THRESHOLD` | 1 | Minimum `abs(trunc(offset))` at which the x-floor applies |

### Platform Differences

| Behavior | Google Sheets | Python | Chrome extension |
|----------|---------------|--------|------------------|
| Non-numeric input | Pass through | Pass through (or error if `enforce_numeric=True`) | Cell left untouched |
| Null/empty input | Returns `""` | Returns `None` | Cell left untouched |
| String parsing | Built-in | Pandas module only | Built-in |
| Out-of-range offset | Throws | Raises `ValueError` | Falls back to the default |
| Dates | Pass through | Pass through | Simplified to the year by default; times opt-in |
| Type preservation | N/A (Sheets handles types) | int → int when result is whole | Writes text; trailing zeros trimmed |

### Performance Optimization

For dataset operations, the code pre-parses the entire dataset into a numeric array (or `null`) *before* calculating magnitude or rounding. This avoids running the expensive parsing/regex logic twice for every cell.

## Chrome Extension Architecture

The extension is the largest consumer of the algorithm and carries its own component architecture (the 2026-08 decoupling migration). The manifest loads the content-script packages in dependency order:

| Package | Job |
|---------|-----|
| `defaults.js` | The settings contract: every option's name and default, shared by the content script and the sidebar |
| `lib/dr-number/` | Rounding, parsing, and formatting — the algorithm itself, plus dates and times |
| `lib/dr-table/` | Detection and the table adapters (`NativeTableAdapter`, `GridAdapter`) |
| `lib/dr-simplify/` | The classification ladder: the per-cell verdict (`skip`, `pure`, `date`, `time`, `extracted`) |
| `adapters/messaging.js` | The event bus (`DR_BUS`) |
| `app/store.js` | The application model (`DR_STORE`) |
| `ui-toggle.js` | The pillbox view |
| `content.js` | The controller |

Outside the content script: `sidebar.html`/`sidebar.js` (the sidebar, a separate extension page) and `background.js` (the service worker that registers the context menu and opens the side panel).

**State.** The application model owns all application state: the active table, whether the sidebar is open, the settings record, and the registry of tables found on the page. Every read goes through its getters; every write goes through a setter, which publishes the field's whole new value on the bus. No component keeps its own copy, and nothing uses the page as memory.

**Messages.** The event bus carries two topic families and only two. Intent topics report what the user did (`intent:selectTable`, `intent:toggleTable`, `intent:settingsChanged`) — requests with no authority, consumed by the controller. State-change topics report what the model changed (`state:selectedTableChanged`, `state:sidebarOpenChanged`, `state:settingsChanged`) — views subscribe to redraw. A topic that must cross extension contexts (the sidebar is not part of the tab's content script) carries a wire action over `chrome.runtime`/`chrome.tabs` messaging; the publish call is the same either way.

**Detection.** The load-time scan makes two passes: native `<table>` elements (minus accessibility artifacts), then elements marked `role="grid"` or `role="table"`. Unmarked grids wait for a right-click, which runs the geometry probe — a cheap-first ladder ending in a column-width sample, short-circuited by an ARIA role or a known vendor class (`dg--`, `ag-`). Whatever passes then faces the data test (at least two rows, a row with two or more cells, one cell that parses as a number — sampled per row on virtualized grids). Only a data table enters the registry and gets a pillbox.

**Rounding a table.** The controller walks the adapter's rows, runs the classification ladder per cell, and writes per the adapter's write model: cross-node text replacement on native tables (preserving the markup inside a cell), in-place `nodeValue` patches on grids (framework-owned nodes must keep their identity, so mixed-text cells are skipped on grids). Originals are stored so the table can be restored. On virtualized grids, the re-apply observer — a debounced mutation observer — re-rounds rows that scroll into view and cells a sort redraws, under the frozen max magnitude.

## Vocabulary

The project vocabulary — core terms, parameters, and the terms for tables, cells, and the extension — lives in [vocabulary.md](./vocabulary.md).
