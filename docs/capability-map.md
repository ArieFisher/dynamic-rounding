# Capability map

What DynamicRounding does, grouped by kind, and how each platform does it. The [design document](design.md) holds the system's shape and the reasons behind it.

**Legend:** **shared**: the platform runs the one shared library · **own**: the platform runs its own copy · **—**: the platform does not use it · **⚑**: refactor target

| Group | Capability | What it does | Extension | Plugin | Sheets | Python |
| --- | --- | --- | --- | --- | --- | --- |
| Core | Settings contract | Setting names and default values | shared | shared | own, fixed | own |
| | Classification ladder | One cell at a time: number shapes, format and group marks, identifier shapes, dates and times | shared | shared | shared | own, pandas module only: a whole string read as one number ⚑ |
| | Table step | The whole table at once: the max magnitude, and the column post-pass for ambiguous dates | shared | shared | shared | own, max magnitude only ⚑ |
| | Simplify numbers | Round a plain number against its order of magnitude | shared | shared | shared | own ⚑ |
| | Simplify dates and times | Drop the parts of a date or time finer than the granularity, e.g. day to year | shared ⚑ | shared ⚑ | shared ⚑ | — ⚑ |
| Output format | Write-back | Turn a rounded number back into text: US group marks, trailing zeros trimmed, the characters around the digits left as written | shared ⚑ | shared ⚑ | shared ⚑ | — (returns numbers) |
| Adapters | Input adapter | Find the table and list its cells, each with its position, its value, and the facts its text does not show (e.g. a footnote mark, a whole-cell link) | detection, then the native-table adapter or the grid adapter | markdown adapter | Sheets input step: the cell range passed to the formula | a value, a list, or a pandas series |
| | Output writer | Apply each cell's patches at the cell's place in the source | patch writer: edits the page's text pieces | text table step: rewrites the markdown text | returns cell values | returns values or a series |
| Application | Interaction | How the user starts, stops, and adjusts simplification | right-click, table pillbox, sidebar | toggle command, status entry | formula call | function call |
| | Visual feedback | Show the user what changed | pulse | — | — | — |
| | State | What is true now, kept between user actions | application model: each table's table settings, the bound table | on/off value, held by the engine | none | none |
| | Inter-component communication | How parts exchange events and requests, e.g. an event bus | event bus over Chrome messaging: intent, state-change, and request topics | — | — | — |
| Support | Diagnostics | Record what happened, for a bug report | capture, log buffer | — | — | — |
| | Build and packaging | Turn the source into what each platform installs or loads | loaded as is, no build step | plugin library, written by the Sheets build | Sheets library, written by the Sheets build | Python package |

## Refactor targets

⚑ marks a place where the code does not match the decoupled design. Every ⚑ sits in the core or the output format group. The adapters and the application group differ by platform by design.

**Python runs its own copy of the core.** The shared case table runs in the Python suite, so Python must give the same rounding results; see [How the code is shared](design.md#how-the-code-is-shared). Python is a different language, so sharing the core means one specification and one set of test cases that both copies pass.

- Classification ladder: the pandas module reads a whole string as one number, so "today I ate 1,234 hotdogs" stays as written.
- Simplify numbers: Python holds its own rounding.
- Simplify dates and times: Python has none.
- Table step: Python finds the max magnitude but has no column post-pass.

**Two jobs sit in one function in the shared code.**

- Simplify dates and times: one function rounds a date and writes its text. A time keeps the two jobs apart, as a number does: the clock-time rule returns the rounded hour and minute, and a second function writes the text. As with the write-back, no platform can replace that second function.
- Write-back: the table step calls the write-back directly, so no platform can supply its own. Proposed: the rounding returns the number and how the original was written, and the write-back becomes a default that each platform can replace.

## How a cell moves through the core

1. **Input adapter.** Lists the table's cells. The core reads only that list, never a page, markdown, or a spreadsheet.
2. **Classification ladder.** Reads one cell and gives it a mode: skip, date, time, or extracted. For an extracted cell it records each number's position and value.
3. **Table step.** Runs the column post-pass, finds the max magnitude, and builds each cell's patches.
4. **Simplify.** A number goes to the rounding as a plain number (1234 in, 1000 out), then to the write-back, which writes "1,000". A date goes to one function that rounds it and rewrites its text. A time goes to the clock-time rule, then to a function that writes its text.
5. **Output writer.** Applies each patch at its place in the source and leaves every other character as written.

### What the input adapter lists

Each cell holds:

- its full text, e.g. "today I ate 1,234 hotdogs", not only the number
- its row and its column
- the facts its text does not show

The core needs the full text for two reasons. The classification ladder tells a number from an identifier by the characters around the digits: in "call 416-555-1234" the digits are a phone number and stay as written. And each patch holds a position in the text, so the output writer changes only the digits.

The code for three rules reads the row and column: the range expression, the first-row and first-column exclusions, and the column post-pass.

Only the extension adds facts the text does not show, because only a page holds them:

- whether the whole cell is a link
- where each superscript sits, e.g. a footnote mark
- whether the cell's digits sit in more than one text piece

With them, the core skips a link, keeps a footnote mark out of a number, and does not read numbers in separate text pieces as one identifier.

| Platform | How the input adapter lists the cells |
| --- | --- |
| Extension | Detection finds the table. The adapter reads each cell's rendered text and counts its row and column. |
| Plugin | The markdown adapter splits each table line at its column dividers and records each cell's position in the text. |
| Sheets | The cell range arrives as a grid. The Sheets input step sends a number cell straight to the rounding, past the classification ladder. |
| Python | The values arrive as a value, a list, or a pandas series. |

### The column post-pass

A date such as 03/04/2025 reads as March 4 or April 3, and one cell cannot settle it. The column post-pass reads the other dates in the same column. When one of them has only one reading, e.g. 25/04/2025, the column post-pass applies that reading to the whole column. It is the only column-level rule today.

### What the write-back writes

A number goes in and a number comes out, so the platform formats it. Text goes in and text comes out: the write-back changes only the digits.

| Input | Output |
| --- | --- |
| a number cell in Sheets | a number; the spreadsheet's cell format displays it |
| 1234 | 1,000 |
| $1234 | $1,000 |
| $1,234.00 | $1,000 |
| today I ate 1,234 hotdogs | today I ate 1,000 hotdogs |

The write-back applies one style to every number. It always adds US group marks, so "1234" gains a comma it never had, and it trims trailing zeros.
