# Sheets cells handled like extension cells

**Created:** 2026-10-23
**Base branch:** main
**Slug:** sheets-ladder

## Context

The product manager asked what it takes for `=ROUND_DYNAMIC` in Google Sheets to treat cells the way the Chrome extension does (numbers inside text, dates, currency, percentages, unit numbers, identifiers), and whether that is reuse or a second path.

## Answer

Neither trivial nor a full rebuild. The extension's per-cell logic is already free of page and browser code, so Sheets can run the same code. The work is in three places: moving the table-level steps out of the extension's page script into its library, a build step that copies the library into the single Sheets file, and a Sheets input step that sorts each incoming cell by type: text goes through the classification ladder, a number rounds as today, a date object or an empty cell comes back unchanged.

### What reuses as is

- `chrome-extension/lib/dr-number/` (rounding, the number reader, the currency list, dates, times, identifier shapes, unit numbers, bracketed numbers) and `lib/dr-simplify/ladder.js` (`classifyCell`) hold no page or Chrome code. The one runtime dependency is `Intl.NumberFormat`, in the write-back.
- `classifyCell` takes plain inputs; the page-only inputs (`isWholeLink`, `hasSuperscript`, `superscriptRanges`, `digitsSpanPieces`) default to off, which matches a Sheets cell. A null range expression means every cell, so Sheets passes none.

### What must move or be built

1. **The table-level steps live in the page script.** After the ladder classifies every cell, three steps run over the whole table before any write: (a) the column post-pass settles each ambiguous date against its column's format hint, (b) the max magnitude is taken over every number in the dataset, numbers inside extracted cells included, and (c) each cell's numbers round and become patches: the position, the digits replaced, and the digits written. `resolveAmbiguousDates`, `datasetMaxMagnitude`, and `cellPatches` in `chrome-extension/content.js` do these three steps, mixed in with page-piece code. A `refactor/` change moves the page-free part into `lib/dr-simplify` as one table step: classified cells in, patches out. Four parts stay in the page script, because each reads the page: the magnitude freeze a grid keeps across scrolls, the check that a changed date does not straddle two text pieces, the link filter, and the write of patches into text pieces through the cell objects. The extension then calls the shared step, so both platforms share one path.
2. **A text splice for Sheets.** The extension writes patches into text pieces and never into a plain string, so no shared splice exists. The Sheets entry point applies a cell's patches to its text, last patch first so earlier positions hold. A few lines, listed here because it is an addition.
3. **One copy, not two.** The Sheets library is one pasted file. A build script concatenates the library files into the Sheets file, and CI fails when the committed Sheets file differs from the build. Hand-copying the files breaks the single-location rule.
4. **Sheets input step.** A small function at the top of `ROUND_DYNAMIC` that turns each value Sheets passes in into what the shared ladder reads, then turns the result back into a value Sheets writes. A plain number skips the ladder and rounds as today, and comes back as a number so Sheets formulas still read it. A date object passes through unchanged. A boolean or an empty cell passes through. Text goes to the ladder; what comes back is governed by the result-kind constant below. Reason it exists: a custom function receives the cell's value, not its display, and nothing about the cell's format (verified against the custom functions guide 2026-10-23: an argument is the cell's value; the Spreadsheet service is read-only inside a custom function and offers no way to learn the calling cell or the source cell's format):
   - Currency-formatted `$1,234` arrives as `1234`. It already rounds today; the result takes the formula cell's format, not the source cell's.
   - Percent-formatted `12.3%` arrives as `0.123` and rounds to `0.1` (shown as `10%` if the formula cell is percent-formatted). The extension rounds the displayed digits, `12.3%` to `10%`. Same visible result only when the output cell carries the percent format.
   - A date cell arrives as a date object and passes through.
   - Text typed as text (`"about 1,234 users"`, `"4.91tn"`, `"$1,234"` stored as text) arrives as text and rounds through the shared ladder.
5. **The result-kind constant.** One constant in the Sheets settings block states what a text cell that holds one number returns: a pure cell such as `"$1,011"` or `"12.5%"`, and a bracketed number such as `"(1,234)"`. Its two values:
   - `text` (the value now): the cell returns the write-back's text, `"$1,000"`, `"15%"`, `"(1,000)"`. The sign the user typed stays, as it does in the extension.
   - `number`: the cell returns the rounded value, `1000`, `15`, `-1000`, with the sign dropped. This is what Sheets returns today.

   A cell with words or a unit number returns text under both values, since no number can hold it. Verified in the template spreadsheet 2026-10-23: a text result stays text in every cell format (`ISNUMBER` false, `ISTEXT` true); the `+` operator and `VALUE` parse `"$10,000"` when the sign matches the sheet locale and return `#VALUE!` when it does not; `SUM` over a range and charts skip text cells. The constant exists so the product manager can flip the value later without a design change.
6. **Settings.** Fixed in the Sheets entry point, with no user override this iteration. Numbers inside text, mixed currency, and mixed percent: on (extension defaults). Dates and times: off, so date and time text passes through. First row and first column: rounded, i.e. not excluded (the extension excludes them by default; Sheets rounds the whole dataset today). Offsets keep today's formula parameters. The result-kind constant: `text`.
7. **Runtime check: passed (2026-10-23).** The shared library depends on four JavaScript features: regular expression lookbehind, named capture groups, the `d` flag with `match.indices`, and `Intl.NumberFormat`. A test script run in a new Apps Script project with the V8 runtime logged the expected value for all four: `lookbehind: true`, `named groups: 12`, `d flag: [[2,4],[2,4]]`, `Intl: 1,234,567.5`. The library runs in Apps Script unchanged.
8. **Contract.** `js/round-dynamic-cases.json` is read by three suites (Sheets, extension, Python), and each reads `expected` as the rounded number, so that field keeps its meaning. Each text-input row gains a second field holding the Sheets text result under the `text` value of the constant; the Sheets suite reads the field that matches the constant, and the other two suites keep reading `expected`. New rows cover numbers inside text, unit numbers, bracketed numbers, and identifier shapes, plus date and time text that passes through, so the Sheets and extension suites run the same rows.

### Behavior changes in Sheets

Each follows from the settings above and matches the extension. Listed so the docs name them.

- A text cell that holds one number returns text, not a number (the result-kind constant).
- A year inside text rounds: `"Q3 2020"` becomes `"Q3 2,000"`, as it does in the extension with dates on or off. A bare year typed as text (`"2020"`) stays, because the date rule reads it and dates are off. A year typed as a number rounds to `2000`, as today.
- The currency list widens from four signs to the full list, letter signs included, and a currency code beside a number reads as a unit number: `"R47"` and `"CAD45.67"` round. The README line naming the four signs changes.

## Decisions

- A text cell that holds one number returns text; the result-kind constant governs it and holds `text` for now.
- Dates and times: off; date cells and date text pass through.
- Switches: fixed, no override (see Settings).
- Python: out of scope; its docs state the narrower behavior.
- Format copy: set aside. A custom function cannot read the source cell's format, and a text result does not carry a format into the destination cell.
- Cost accepted: the pasted Sheets file grows from about 270 to about 1,800 lines.

## Simplicity

1. **Size.** Sheets file grows (generated). Hand-written code shrinks: the Sheets library's own `toNumber`, `isNumberShape`, `roundWithOffset`, `roundCellSetAware`, and `findMaxMagnitude` copies go away. Additions: one build script (requirement: one copy), one Sheets input step (requirement: typed values), one text splice (requirement: the extension writes into text pieces, Sheets into a string), one result-kind constant (requirement: a product choice held open), one shared table step (requirement: one path).
2. **Duplicates.** The rounding core exists twice today (Sheets file and extension library), and the two number readers differ: the Sheets copy strips four currency signs, the library strips the currency list. The refactor removes the Sheets copy.
3. **Removals.** No new stored field. No new formula parameters. With dates off, the column post-pass runs in the shared step but finds nothing in Sheets; it stays because the extension needs it.
4. **Orphans.** The Sheets library's private helpers become unused and are removed in the same change. Every constant the Sheets file declares twice with the library (`EPSILON`, `X_FLOOR_THRESHOLD`, `VALIDATION_LIMIT`, `CLEAN_REGEX`, `DASH_REGEX`, `PARENS_REGEX`) goes with them, so the built file declares each once.
5. **Bounds.** None new; a Sheets dataset is bounded by Sheets.
6. **Current behavior.** Verified from code: Sheets reads numeric text (`"$1,234"`, `"(1234)"`, `"12.5%"`) as a number and returns a number with the sign dropped; other text and date objects pass through. The README documents this under numeric casting, and about forty shared case rows expect it. The extension rounds numbers inside text and simplifies dates to the year.

## Sequence

1. `refactor/` pull request: move the table step into the extension library; extension suite proves no behavior change.
2. `chore/` pull request: build script and CI check that generate the Sheets file from the library.
3. `feature/` pull request: Sheets input step, text splice, result-kind constant, product choices applied, case table extended, docs updated: `js/README.md` (numeric casting, the currency-sign line, the result kind, the behavior changes above), `docs/design.md`, `js/tests-googlesheets-tab.md`. `docs/test-pages/tables.html` does not apply to Sheets.

## Verification

- `node chrome-extension/tests.js` and `node js/tests.js` green after each step.
- `node js/doc-tests.js` green.
- Paste the built file into the template spreadsheet and check by hand: text with numbers rounds and comes back as text, unit numbers and bracketed numbers round, phone numbers and dates stay, first row and first column round, plain numbers still return numbers, and `"$1,011"` returns `"$1,000"`.
