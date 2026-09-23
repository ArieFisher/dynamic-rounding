# Dynamic Rounding - Chrome Extension

This extension applies the `ROUND_DYNAMIC` algorithm to tables on any website. Every data table it finds gets an on-page on/off control (the pillbox); a right-click context menu toggles the active table; and a side panel (the sidebar) holds the full settings — offsets, date and time handling, exclusions, a range expression — with a lens preview showing sample values before and after. Dates simplify to the year by default; times are opt-in.

## What a pillbox press does

A press makes the pressed table the active one and flips its form from what the screen shows: a raw table simplifies, a simplified table goes back to its original values. It writes the settings record once, and the settings record's change is what reaches the table, so the pillbox, the sidebar's switch, and the right-click menu item all act through one path.

Two consequences follow. Turning simplification on uses the settings record's current values, which a sidebar session may have changed since the last press. Turning it off resets the table: the simplified markers and the stored originals go, and a later press simplifies again from scratch.

A press that moves the active table also clears the range expression. An expression states rows and columns by position, so it describes the table someone wrote it for, and carrying it to a second table would address different data there. A press on the table that is already active keeps the expression.

A press on a locked table publishes nothing. A table locks when its original values are lost, which happens when a content script re-injection empties the registry. The right-click menu item is the one way to act on such a table.

## The sidebar serves one tab

The sidebar opens beside one tab and serves that tab for as long as it is open. It acts on what that tab's page reports and drops what any other tab reports, so a table changing in a background tab never moves the sidebar's controls or locks them against a page the user cannot see.

A tab switch closes the sidebar. The service worker closes it whenever the user leaves the tab it was opened for, and the sidebar closes itself on the switches the worker misses: an idle restart empties the tab number the worker compares against, and a sidebar opened from Chrome's own side-panel control never sets it. Those switches used to leave the sidebar open, showing controls for a page the user had left.

## Offset semantics

The extension uses the same offset model as the rest of the project. As of the `2026-05-28` release, the meaning of fractional offsets is sign-aware: `+0.5` rounds toward half of the next-larger order of magnitude, and `-0.5` rounds toward half of the current order. The result is also floored at the value's own order of magnitude so a large number can never collapse to zero. One platform difference: an out-of-range offset does not throw here — the extension falls back to the default instead. See the [Sheets README](../js/README.md#offset-reference) for the full offset reference and parameter table.

## Unit numbers

A unit number is a cell whose whole text is one number with a magnitude suffix after it, a listed currency code before or after it, or both: "4.91tn", "41.31m", "5.2 Bn", "CAD45.67", "CAD$45.67", "$CAD45.67", "45.67 CAD", "CAD45.67m". Only the digits round, so "CAD45.67m" becomes "CAD45m" and "4.91tn" becomes "5tn". A unit number rounds on HTML tables and grids alike, whatever the sidebar's "words" setting holds.

- The suffixes are k, m, b, t, bn, and tn, in any case, directly after the number or after one space.
- A currency code counts only in upper case and only as its own word, so "CADENCE" and "usd" do not. A currency sign written in letters takes the same rule on whichever end carries the letter, so the rand's "R" counts in "R45" and not in "Revenue". A sign written as a picture counts wherever it sits.
- Every currency the extension reads — its signs and its code together — is listed once, in `lib/dr-number/core.js`. Reading a cell as a number, the currency exclusion, the sign-only piece test, the data test's numeric probe, and putting the sign back after rounding all read that one list. The magnitude suffixes are listed once, in `lib/dr-number/parsing.js`.
- With the currency setting off, a cell holding a listed code stays unchanged, the same as a cell holding "$".
- A unit number counts as its shown digits in the max magnitude: "4.91tn" counts as 4.91.
- Letters that are neither a suffix nor a listed code make the cell something else: "DT1234" and "cust15" are identifiers and never round as unit numbers.

## Bracketed numbers

A financial statement writes a negative as a bracket pair: "(1,234)" is −1,234. The extension reads that pair as the number's minus sign, so the cell rounds by the value it states and joins the table's max magnitude with the right sign. Only the digits change and the brackets stay where the page put them, so "(1,234)" becomes "(1,000)" and "$(1,234)" becomes "$(1,000)". This holds on HTML tables and grids alike, whatever the sidebar's "words" setting holds.

- The brackets may hold nothing but the number and its own format marks — a currency sign, a percent sign, whitespace — so "($1,234)", "$(1,234)" and "(12.3%)" are bracketed numbers and "(see note 4)" is not.
- A bracket may sit in its own piece of the page's markup, apart from the digits. Because only the digits are replaced, such a cell rounds like any other.
- A number that already carries a written minus sign keeps it: "(-1,234)" reads as −1,234 once, not twice.
- A bracket pair followed by a digit is a telephone area code, not a minus sign, so "(416) 555-1234" stays positive.
- Brackets are format marks in the one list in `lib/dr-number/core.js`, beside the currency signs, so every rule that steps past a mark to reach a number reads the same source.

## Extension errors

Every warning or error the extension records on a page shows as a toast at the page's bottom right: the row's text, for five seconds or until a click. A second row replaces the first, so a warning that repeats on every scroll shows one toast. The tab keeps its error state for the life of the page: whether an error was recorded, how many, and the last 50 rows with their stack traces. A reload starts clean. The capture carries that state, and each log row's stack trace sits under the row in the capture file, folded.

## Capture

The sidebar's capture section writes a bug report as one self-contained HTML file. Press one of the three mark buttons (👍 Looks right, 🤔 Not sure, 👎 Looks wrong), write the remarks — the box's preview text follows the mark, and a looks-wrong capture prompts for expected, observed, and cause — and press "Save capture"; nothing saves without that press. The file lands in the browser's downloads through a plain link download, so the extension needs no extra permission. Its name carries the day, the page's host (or the page file's name for a page opened from disk), the time, and the mark: `dr-capture-20260917-tables-171510-looks-wrong.html`. On a heavy page, the form shows the estimated size of the file before the save, and a failed save reports on the status line.

One capture holds, in reading order: the mark and remarks; a likeness of the sidebar as it stood; a screenshot of the bound tab's visible area, taken under the activeTab grant the right-click menu item gives (without the grant the section says so and the file still saves); the bound table rendered twice — as displayed, with originals revealed on hover, and again with the originals themselves; a registry list of every table found, the bound one marked; the detection settings in force at capture time; the log rows of both extension contexts, each warning or error row with its stack trace folded under it, each frame in the short form Chrome's extension error page uses (the extension's own log buffer — the page's console is never read); the tab's error state; the bound table's markup as it stood at capture time, as the fixture seed; and the whole capture state as machine-readable JSON in a hidden block. A thin line separates the sections, and a sentence or two about how to read the file render as a note: smaller, italic, opening with "Note:". The file declares a Content-Security-Policy that forbids scripts and remote fetches, so it is safe to attach anywhere.

The capture records absence honestly. With no table bound, the state says so and the capture still saves. On a locked table (originals lost to a re-injection), cells record no originals and the locked wording appears — values are never reconstructed. A virtualized grid contributes the rows present at capture time, with its frozen max magnitude as part of the evidence.

A capture page is exempt from the extension's own detection. The saved file is itself a page with a real table, and with file access enabled the content script runs on it; the file therefore carries a capture marker (a page attribute on its document element), and the content script stands down on any page carrying it — no controls, no selection, no rounding. A capture shows what was captured, never what the extension would do to it.

## Architecture Notes

### Safe DOM Text Replacement (The "Wikipedia Problem")

When updating numbers in an HTML table, a naive approach is to read `cell.innerText`, perform the rounding, and write back `cell.innerText = new_value`. However, this approach destroys any child HTML tags within the `<td>`.

During the development of this extension, we encountered a specific edge case common on data-heavy sites like Wikipedia. When extracting text and attempting to inject the rounded values back into the DOM, we found that tables often use **multiple invisible blocks or spans** to construct a single visual number. 

#### Why Sites Do This:
1. **Decimal Alignment:** To ensure that numbers align perfectly on their decimal points, a site might wrap the integer part, the decimal point, and the fractional part in separate `<span>` elements with specific CSS widths, visibilities, or text alignments.
   *Example:* `<span>+2</span><span style="visibility:hidden">.</span><span>5%</span>`
2. **Hidden Sort Keys:** Tables often embed machine-readable sort values directly alongside the visual text using `display: none` or hidden spans so that the table sorts correctly when a user clicks the column header.
   *Example:* `<span class="sortkey" style="display:none">700023000</span>+2.3%`

#### The Solution: One Patch Inside One Text Piece
Overwriting a cell's `innerText` wipes out these structural spans. Column widths break, padding goes, and text colors reset, because the alignment spans and their CSS classes are gone.

The extension never rewrites a cell's markup. Every cell, on a native table or a grid, takes three steps:
1. **Classify.** The classification ladder reads the cell's text and determines what to change.
2. **Place.** The placement step checks each change against the cell's text pieces. A change whose characters sit in one text piece stands.
3. **Patch.** The patch writer replaces those characters inside that one text piece, through `nodeValue`. No element is added, removed, or replaced.

A value whose characters cross a piece boundary, such as the decimal-alignment example above, stays unchanged. On a native table the skip leaves a debug log row. On a grid the cell first takes the stacked cell test (see below).

### Data Grids vs. HTML Tables

Not every "table" on the modern web is an HTML `<table>`. Many data-heavy apps render results as a **data grid** — a tabular UI built from plain `<div>` containers, usually **virtualized** (only the visible rows exist in the DOM; nodes are recycled as you scroll). Real-world examples:

- **Database query result grids** — components prefixed `dg--` (`.dg--virtual-row`, `.dg--cell`).
- **AG Grid** (financial dashboards) — `.ag-center-cols-viewport` + a pinned `.ag-pinned-left-cols-container`.
- **AWS Console** — the **Cloudscape** design system (`awsui` / `.awsui-table-wrapper`).
- **Azure Data Studio / VS Code** — SlickGrid / Monaco grid (`monaco-workbench`).

The extension abstracts both shapes behind a `TableAdapter` interface (`lib/dr-table/detect.js`), chosen by `makeAdapter(el)`:

- **`NativeTableAdapter`** (`<table>` elements) — reads `.rows`/`.cells` and classifies each cell on its rendered text. Writes go through the patch writer, as on a grid; restore puts back the cell's saved HTML.
- **`GridAdapter`** (`<div>`-based grids, `isVirtualized() === true`) — stitches each row from the pinned pane and the scrollable pane and exposes the same row/cell API.

#### Rows, row groups, and outside rows

Row discovery uses a grid's row groups (`role="rowgroup"`, the ARIA analog of `<tbody>`) to pick the row shape, then takes every matching row across the whole grid, in document order. A row's position in that list is its literal row number, so "first row" always means the grid's top row — the first-row exclusion and range expressions count header and summary rows like any other.

A row outside every row group — or, on a native table, a `<tfoot>` row — is an outside row: it rounds like any other row, but its values stay out of the dataset. They never feed the max magnitude or the lens preview.

On virtualized grids, the max magnitude freezes when simplification is first applied (the magnitude freeze). The data test spends one budget of 1000 cell reads, in document order, stopping at the first number; the budget applies on native tables and grids alike.

On a native table, the data test and rounding share one cell read: the cell's rendered text, falling back to its raw text when the rendered text is empty. A hidden cell rounds like any other cell, and its raw text counts toward the test; a hidden fragment inside a visible cell — the hidden sort key above — stays out, because that cell's rendered text is not empty and the fallback never runs.

A native table cell is classified on its rendered text and patched in its flat text. The two differ on a pretty-printed page: the browser collapses the line breaks and indentation of the markup to one space in the rendered text, and the flat text keeps them. Each value position, number position, and superscript position converts between the two texts, so "Grew 1,200 units" or "4,523,789" written across several lines of markup rounds and keeps its line breaks. When the two texts differ in more than whitespace, such as a cell holding a hidden sort key, the value goes to the one text piece whose trimmed text equals it, or else the one piece that holds it exactly once, so the visible "7,002,300" rounds and the hidden sort key keeps its text. With no such piece the cell keeps its rendered positions; a patch that misses there does not land, and the cell stays unchanged with a warn log row.

#### Why every write is a patch

A framework-managed grid cell **cannot** be rewritten: React (and similar) hold a fiber reference to the cell's text node, so replacing it (`innerHTML =`, `textContent =`, `removeChild`/`appendChild`) crashes the host application's reconciler on the next re-render (observed: a `removeChild NotFoundError` that tore down the results panel on column resize). Writes therefore patch the existing text node **in place** (`textNode.nodeValue = …`), preserving the node identity the framework tracks. Native tables use the same patch writer, so one write rule covers every table kind. Restore differs by kind: a native cell gets back its saved HTML, and a grid cell gets back each patched piece's saved text.

A native table cell takes no stacked cell test. Inline styling splits one number across pieces ("1" plain, "23" in bold), and the test reads a digit beside a digit across pieces as two numbers. So a native value across pieces stays unchanged.

A grid cell reads as its flat text: every text piece, joined in page order. Each change is a patch to the one text piece that holds the changed characters, and the cell's originals hold each patched piece's text, so restore puts every piece back. Three rules follow from the piece layout:

- A **stacked cell** rounds number by number: "125" above "126" becomes "150" above "150", and a "$" in its own piece beside "337.91" stays while the number becomes "350". Two numbers in one piece, even with a space between them, make the cell not stacked, so it stays unchanged. So does a piece that reads as a date or a time: "2024" above "2025" stays, as a lone "2024" does.
- A **split number** stays unchanged, with a debug log row: "4." in one piece and "91" in the next. A date or time split across pieces stays unchanged the same way.
- **Extracted cells** round on a grid exactly as they already round on a native table: a number inside surrounding words rounds in place, and a grid cell with a `<sup>` rounds its base number while the mask keeps the exponent unchanged. The lens preview lists these numbers on both table kinds. A unit number is always an extracted cell for this rule too: "4.91tn" becomes "5tn" on a grid.

Because virtualized grids recycle rows on scroll and rewrite cells in place on sort, a debounced `MutationObserver` (watching both `childList` and `characterData`) re-applies rounding to rows that scroll into view and cells that a sort reverts.

### Data Grids vs. CSS Layout Grids

A `display: grid` / `flex` container is not necessarily a *data* grid — it might be a nav menu, a card layout, or a photo gallery. The extension deliberately gives these no pillbox and no rounding. Two things keep them out:

1. **Detection runs on demand, narrowly.** The load-time scan makes two passes: every native `<table>` (minus accessibility artifacts — hidden tables that exist for screen readers or as a chart's fallback), then the nomination step over the elements marked `role="grid"` or `role="table"`. The step registers one table per nest of role-bearing elements: it builds a containment chain from the nested elements that pass the data test and takes the element at the configured nesting depth (`nestingDepth` in the detection settings, 1 today — the first inner layer, so a vendor grid's scrolling pane registers and its pinned row-number gutter stays outside the table). A depth holding more than one element falls back outward to the nearest shallower depth holding exactly one. A chain shorter than the configured depth clamps to its innermost element. The pass that watches for nodes added later runs the same step. A nest whose chain is empty — no element of it passes the data test, the shape a grid takes when it draws before its rows load — leaves a pending table: one subtree observer on the chain root runs the step again after each change to the subtree, one run per burst of changes inside the grid redraw delay, so the grid registers when its rows arrive, with no right-click. A re-test that still finds the chain empty counts against `pendingRetestCap` in the detection settings (100 today), and reaching the cap drops the observer. A **right-click** resolves in four steps (`findTargetTable`): the nearest native `<table>`, then the nearest already-registered ancestor, then the nomination step run from the chain root of the nest the clicked element sits in, and last the geometry probe (the walk up calling `looksLikeGrid`). The third step registers a marked grid the load-time scan missed and returns the element at the configured nesting depth, so a right-click in a vendor grid's row-number gutter registers the scrolling pane beside it; a nest that resolves nothing falls through to the probe. An unmarked `<div>` structure is only ever evaluated at that fourth step; a known vendor class (`dg--`, `ag-`) only short-circuits that probe's geometry step, it does not get scanned at load time on its own.
2. **`looksLikeGrid` (`lib/dr-table/detect.js`) applies a cheap-first ladder**, and a layout grid fails at least one rung:
   - ≥ N repetitive children sharing a class or child-shape (rejects ad-hoc layouts);
   - a consistent modal cell count across rows;
   - `display: grid`/`flex` (necessary, never sufficient on its own);
   - **at least one cell that parses as a finite number** — the decisive filter: nav menus, card grids, and galleries have no numeric cells and are rejected here;
   - column-width alignment (sampled column-0 cells must have matching widths) unless short-circuited by an ARIA role or library class.

Even past detection, rounding only writes cells the classification ladder admits: cells whose text parses as a number, unit numbers, stacked cells on grids, date cells (on by default, simplified to the year), time cells (opt-in), and — on native tables — mixed-text cells where a number sits inside surrounding words. A non-numeric layout grid contains none of these, so it produces no changes regardless.

**Caveat (by design):** a CSS layout grid that genuinely contains aligned numeric columns *will* qualify — at that point it is functionally a data grid, which is exactly the content a user would want rounded.
