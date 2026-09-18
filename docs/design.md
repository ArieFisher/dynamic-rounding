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
| `constants.js` | The settings contract and the detection tuning block, loaded by the content script and the sidebar: each option's name and its default, and every detection tuning value with its two lookup lists |
| `lib/dr-log/` | The log buffer: the last 50 log rows per context, each warn or error row with its stack trace, snapshot into every capture; a row listener receives each row as it lands |
| `lib/dr-number/` | Rounding, parsing, and formatting — the algorithm itself, plus dates and times |
| `lib/dr-table/` | Detection and the table adapters (`NativeTableAdapter`, `GridAdapter`) |
| `lib/dr-simplify/` | The classification ladder: the per-cell verdict (`skip`, `pure`, `date`, `time`, `extracted`) |
| `lib/dr-capture/` | The capture: the state serializer and the capture file renderer |
| `adapters/messaging.js` | The event bus (`DR_BUS`) |
| `app/store.js` | The application model (`DR_STORE`) |
| `ui-toggle.js` | The pillbox view |
| `ui-toast.js` | The toast view |
| `content.js` | The controller |

Outside the content script: `sidebar.html`/`sidebar.js` (the sidebar, a separate extension page) and `background.js` (the service worker that registers the context menu and opens the side panel).

### Layers

Four layers. The dependency direction is the design intent, and two places break it today.

| Layer | Contents |
|-------|----------|
| Core | Parsing, the offsets, the formatting, the classification ladder, the capture renderer, and the log buffer. No Chrome interfaces and no page access. |
| Adapters | The table adapters, the detection ladder, and the event bus. |
| Application model | The page's application state and the table registry. |
| Shell | Three entry points: the content script, the sidebar, and the service worker. |

The number package and the classification ladder stay inside the core. The ladder takes plain cell values and returns its decision as data, and the two checks that need the page — a whole-cell link, and the superscript spans — arrive as plain values the caller computed. The capture's renderer takes the capture state and returns the file as a string.

Two breaks, both worth stating plainly. The capture's state serializer sits beside the pure packages while reading the page and calling both the application model and the adapter factory, so the innermost layer reaches up two layers. And the service worker holds the Chrome calls for its right-click menu items and the side panel's lifetime, while the controller and both views write the page directly, so the adapters layer concentrates page access without holding all of it. Messaging is no longer one of the breaks: every context reaches Chrome's messaging through the event bus alone.

No tool enforces the direction. The extension has no build step and no import statements: every content script declares globals into one shared scope, loaded in the order the manifest lists. The suite exercises the core by evaluating every content script in Node behind stubbed page and Chrome interfaces.

### Patterns

| Pattern | Where | Job |
|---------|-------|-----|
| Ports and adapters | Whole extension | Keeps the algorithm free of Chrome and the page |
| Application model with publishing setters | Content script | One place each field changes |
| Intent and state-change topics | Views to the controller, the model to the controller, and the content script to the sidebar | Decoupling without an open event graph |
| Table adapter | Native tables and grids | One row-and-cell interface over two markups |
| Predicate | The classification ladder | A new exclusion without touching the formatting |
| Registry | The table registry | Per-table storage keyed by the live element |
| Request and reply | The sidebar's four requests | One caller, one answer, on demand, on the event bus |

### State ownership

**The content script holds the model.** Its lifetime matches the page, and it is where the tables are. The application model holds the active table, the settings record, the registry, and the tab's error state. Every read goes through a getter. Every write goes through a setter, and each setter outside the registry publishes the field's whole new value on the event bus.

**Two shapes, kept apart.** The registry keys per-table storage on the live element: each cell's pre-simplification original, the table's form, its last-used options, a virtualized grid's frozen magnitude, and the shape fingerprint the table carried when it registered — its column count, plus its header row's cell texts where it has a header row: an outside row on a grid that groups its data rows, the head section or a leading row of header cells on a native table. The elements themselves cross no context. Two pulls carry plain-value copies of the rest to the sidebar: the capture's state pull carries all of it — each cell's original text, the form, the last-used options, and the frozen magnitude — and the lens preview pull carries a sample of the originals.

**The cell values yield the derived data**, with one deliberate exception. The date format hint, the magnitudes, and the dataset's maximum all come from the values. On a virtualized grid only the visible rows exist, so the maximum magnitude freezes at the first simplification and the registry holds it; recomputing would shift the basis on every scroll.

**The extension reads a cell's original as it simplifies that cell.** Reading every cell of every table on a page at load would cost more than it saves, and a re-injected content script starts with an empty registry in either case.

**Six places hold state outside the model.** The service worker keeps the tab number the sidebar opened for, and Chrome empties its variables after an idle spell. The sidebar keeps its own control values, its cached lens samples, its capture mark, the on/off value it stashes while a table is locked, and the tab it was opened for, with the window holding it, and it builds the settings record from its own controls on each change. The sidebar's tab number and the service worker's are two facts, not one fact stored twice: the worker's is the tab it watches from outside, and the sidebar's is the page it serves — the reports it acts on and the switch it closes itself on. One controller branch reads a marker class off the page to decide whether a table is simplified, where the model holds that form as a field. The controller also keeps the last right-clicked element, which the menu item acts on, a grid's re-apply observer and its timer, and each pending table's subtree observer, its re-test timer, and its count of failed re-tests. The pillbox view keeps its own map of pillboxes, its set of tracked tables, and its resize observers. The toast view keeps its one element and its hide timer. The spec dated 2026-09-14 retires the service worker's tab number in its second part.

**Nothing persists.** There is no storage permission. The settings record starts as the shipped defaults on every page load and dies with the page, so the model initializes synchronously and the first simplification needs no waiting step. Each tab is independent, and no change crosses tabs.

**One settings record per page.** There are no per-table settings, so the settings record describes the active table and no other. Issue #328 carries that limit.

### Flow

Three producers reach one controller, and all three publish on the event bus. A pillbox press publishes an intent topic. The right-click menu item publishes an intent topic from the service worker, which the controller subscribes to in the tab the click happened in. The sidebar's controls publish a request, which the controller answers. The controller writes the application model, and the model publishes the change.

Redrawing runs two ways. Direct calls from the controller redraw the pillbox. The sidebar records the tab it was opened for, pulls current values from that tab, and after that redraws on the state-change topics it subscribes to. It serves that one tab: a report reaching it from any other tab is dropped, because a content script reports by broadcast and a broadcast names no tab. It also closes itself once that tab stops being the tab in front. The service worker closes it on the ordinary route and misses two: an idle restart empties the tab number the worker compares against, and a sidebar opened from Chrome's own side-panel control never sets it. The sidebar's own close covers those, so a tab switch ends one way whichever route it takes, and the close rule sits in two places until the second part of the 2026-09-14 spec collapses it to one. The state-change topic for the active table has no subscriber at all; the third part of the 2026-09-14 spec gives it one.

There is no single reduce step and no enumerated action list. The model has one setter per field, and each publishes its own state change.

Tables carry no identifier. A topic inside the content script carries the live element, and a cross-context topic carries plain values only, so no message outside the tab addresses a particular table: a cross-context topic concerning a table means the active one.

**Messages.** The event bus carries three topic families, and its own topic table is the one place a topic name is written. Intent topics carry what the user did (`intent:toggleTable`, `intent:menuClicked`) — requests with no authority, for the controller to act on. State-change topics carry what changed (`state:settingsChanged`, `state:applyBlocked`); the controller subscribes to one, the toast view to one, and the sidebar to eight. Request topics carry a question whose one responder returns an answer. The sidebar publishes all four and the content script answers all four: the sidebar's settings apply (`request:applySettings`), and its reads of the settings, the lens samples, and the capture state. Each topic also carries a route stating which carrier reaches its audience: the extension's pages, one tab's content script, or neither, meaning the publishing context alone. The publish call is the same whichever route a topic carries, which is the point of the route: a caller states the topic, never the carrier.

**Detection.** The load-time scan makes two passes: native `<table>` elements (minus accessibility artifacts), then the nomination step over the elements marked `role="grid"` or `role="table"`. The pass that watches for nodes added later runs the same step, so a page and a subtree added to it register the same element. The step registers one table per nest of role-bearing elements: it builds a containment chain from the nested elements that pass the data test and takes the element at the configured nesting depth, 1 today. A depth holding more than one element falls back outward to the nearest shallower depth holding exactly one. A chain shorter than the configured depth clamps to its innermost element. A nest whose chain is empty — no element of it passes the data test — leaves a pending table: one subtree observer on the chain root runs the step again after each change to the subtree, one run per burst of changes inside the grid redraw delay, until the nest registers, a re-test finds the nest registered or its depth crowded, or the count of failed re-tests reaches the cap in the tuning block. That is what registers a grid arriving before its rows. A right-click resolves in four steps: the nearest native `<table>`, then the nearest already-registered ancestor, then the nomination step run from the chain root of the nest the clicked element sits in, and last the geometry probe — a cheap-first ladder ending in a column-width sample, short-circuited by an ARIA role or a known vendor class (`dg--`, `ag-`). The third step registers a marked grid the scan missed, and it returns the element at the configured nesting depth, so a click in a vendor grid's row-number gutter resolves the scrolling pane beside it; a nest that resolves nothing falls through to the probe. Unmarked grids enter at the fourth step alone. Whatever passes then faces the data test (at least two rows, a row with two or more cells, and one cell that parses as a number within one budget of 1000 cell reads; the test spends the budget in document order, on native tables and grids alike, and stops at the first number). Only a data table enters the registry and gets a pillbox. The shape check is one more caller of the same step: every action on a registered table compares the table's shape against the fingerprint the registry recorded, and a mismatch restores the raw text, discards the entry, and re-runs the step from the nest's chain root, because a new result set can change which element of the nest passes the data test. On a native table, the data test and rounding share one cell read: the cell's rendered text, falling back to its raw text when the rendered text is empty. A hidden cell's raw text counts toward the test and toward the lens preview, and the cell rounds like any other cell. A hidden fragment inside a visible cell stays out: that cell's rendered text is not empty, so the fallback never runs.

**Rounding a table.** The controller walks the adapter's rows, runs the classification ladder per cell, and writes per the adapter's write model: cross-node text replacement on native tables (preserving the markup inside a cell), in-place `nodeValue` patches on grids (framework-owned nodes must keep their identity, so mixed-text cells are skipped on grids). Originals are stored so the table can be restored. On virtualized grids, the re-apply observer — a debounced mutation observer — re-rounds rows that scroll into view and cells a sort redraws, under the frozen max magnitude.

**Extension errors.** Every warn or error row the content script records is an extension error. The log buffer hands the row to the controller's row listener, the controller writes it into the model's error state, and the model publishes the change. The toast view draws the newest row's text on the page for five seconds, and the capture carries the error state and each row's stack trace. The listener sits in the controller because the log buffer loads before the model and the bus and reaches neither. An uncaught exception never reaches the log buffer, so it stays outside this path.

**Capture.** The sidebar's capture section writes a bug report as one inert, self-contained HTML file: the mark and remarks, the bound table as displayed and again with the originals, a likeness of the sidebar, a registry list of every table found, the tuning block in force at capture time, both contexts' log rows (a per-context log buffer holds the last 50, each warn or error row with its stack trace folded under it), the tab's error state, the fixture seed, and the whole capture state as JSON under a one-integer format version. The content script serializes the registry through the adapters' displayed-text read and the model's plain-original-text read; the sidebar pulls that over one cross-context topic, adds its own view state at finish time, renders the file through the capture package, and saves it with a plain link download — no extra permission. The file forbids scripts and remote fetches through its own Content-Security-Policy, and it records absence honestly: an unbound state, a locked table's lost originals, and a serialization failure all appear as what they are, never as reconstructed values. The file also carries a capture marker on its document element, and the controller stands down on any page carrying it — a page's own policy cannot block an extension's injected code, so without the marker the extension would round the capture's own table when the saved file is opened.

### Reuse across platforms

The algorithm exists three times — the Sheets library, the Python package, and the extension's number package — and one shared case table runs in all three suites, so a change in one platform fails the other two until the three agree. That case table is the whole of the contract holding the three together. The Python library ships as a package; the Sheets library is pasted into a spreadsheet; the extension has no build step and no package file, so no tool guards its internal boundaries.

### Decisions

- **The active table is the last one the user right-clicked, or the last one whose pillbox the user pressed.** Hovering changes nothing.
- **A pillbox press means one thing and makes one settings write.** It makes the pressed table active and flips the settings record's on/off value, reading the direction from the screen before that write. A press that moves the active table clears the range expression in the same write, because an expression states rows and columns by position and so describes the table it was written for. The settings record's change is what applies, so the pillbox, the sidebar's switch, and the right-click menu item all reach the table by one path. The press read a page-held copy of whether the sidebar stood open until the 2026-09-14 spec retired that copy. Only the service worker could correct it, and the correction needed a tab number that an idle restart and an ordinary sidebar close both cleared.
- **An apply restores the table before simplifying it again**, so a settings change produces a fresh pass. The grid's re-apply observer takes a different route: it recomputes under the frozen magnitude and writes each cell whose text differs, reading the originals through the adapter's port.
- **The grid path computes before it writes.** One function produces every visible cell's target value and leaves an empty result for a cell it does not change, so the first pass and the scroll re-apply share one path and cannot diverge. The native path runs in phases — classify every cell, resolve ambiguous dates per column, find the maximum magnitude — and then computes and writes each value in one loop inside the controller.
- **The extension patches a grid cell's text node in place.** A framework holds a reference to that node, so replacing it tears down the host application on its next redraw.
- **Two messaging primitives carry every message.** A publish that returns nothing, and a request that returns one answer. Both run on the event bus, and so does every topic. A topic's route determines which contexts a publish reaches: the extension's pages, one tab's content script, or neither, meaning the publishing context alone.
- **The service worker is a router and two entry points.** It holds one fact today, the tab number the sidebar opened for, which the 2026-09-14 spec retires.

## Vocabulary

The project vocabulary — core terms, parameters, and the terms for tables, cells, and the extension — lives in [vocabulary.md](./vocabulary.md).
