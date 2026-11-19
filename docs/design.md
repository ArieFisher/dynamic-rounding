# Design

This document holds the shape of DynamicRounding and the reasons behind it, for someone about to change the code: the parts, the decisions, and the rules that must stay true. Each rule comes with its reason, so an editor can tell when the reason no longer holds.

The details sit elsewhere. The code holds how each part works. The [vocabulary](vocabulary.md) holds each term and its exact rule. The [capability map](capability-map.md) holds which platform runs which part. Each platform's README holds what a user sees.

## The idea

A reader of a table needs the size of each number more than its last digits. DynamicRounding rounds each number against its own order of magnitude. The offset is how far from that order of magnitude to round, so one setting fits 87 and 87 million, and the user never counts decimal places.

In set-aware rounding, the max magnitude comes from the whole dataset, and the numbers in the top band, the largest orders of magnitude, can round at a different offset from the numbers in the other band.

## The parts

Four platforms run the product: the Chrome extension, the Claude Code plugin, Google Sheets, and Python. Each platform's code falls into five groups, and each group name here has the capability map's meaning.

| Group | What it holds |
| --- | --- |
| Core | The code that determines what each cell becomes: the settings contract, the classification ladder, the table step, and the rounding of numbers, dates, and times |
| Output format | The write-back, which turns a rounded number back into text |
| Adapters | The code between one source and the core: the input adapter, which finds a table and lists its cells, and the output writer, which applies each cell's patches |
| Application | How the user starts, stops, and adjusts simplification, the state kept between actions, and how the parts exchange messages |
| Support | Diagnostics and the build |

The source is what a platform reads its tables from: a web page, a reply block's text, a cell range, or Python values. [How a cell moves through the core](capability-map.md#how-a-cell-moves-through-the-core) is in the capability map.

- **The core and the write-back read no source.** They take plain values, the cell list, and return plain values: each cell's mode and patches. They hold no page code, no Chrome call, no markdown code, and no spreadsheet code. Why: one copy runs on three platforms, and the test suites run it in Node with no browser.
- **The input adapter passes a fact only the source holds to the core as a plain value.** The extension's input adapter finds three such facts: whether the whole cell is a link, where each superscript sits, and whether a number's digits sit in more than one text piece. Why: the same as above.
- **A patch changes only what simplifies.** For a number, the patch changes the digits; for a date or a time, the date or time text. Every other character stays where the source put it. Why: signs, units, words, and the page's markup carry meaning and layout that the code cannot rebuild.
- **A platform changes what the core does through settings alone.** The extension and the plugin pass the settings contract, and Sheets passes fixed settings. The core holds no check for which platform runs it. Why: a branch per platform inside the core would be a second path, and the two would drift.

No tool checks the first rule directly. The Sheets and plugin suites run the core in Node with no page, so a page call in the core fails them only where a test reaches it. The extension has no build step and no import statements: its content scripts share one scope, loaded in the order the manifest lists, so nothing stops one file from calling another. A reviewer checks the rest.

The extension's folder names predate the groups. The event bus sits in a folder named adapters, though it belongs to Application, and the library folder holds core, adapter, and support code side by side.

## How the code is shared

- **The core has one copy.** The extension loads the shared library files as they are. The Sheets build joins them with the Sheets entry source into the one file a user pastes into Apps Script. The same build writes the plugin library: the same files and the settings contract, with one export line. CI fails when a committed built file differs from the build. Why: a rule fixed once is fixed on three platforms.
- **The plugin library is a built copy.** The engine loads ES modules only, and an installed plugin holds a copy of its own folder alone. The shared files are content scripts, which cannot hold an export line, so the build writes a module copy into the plugin's folder.
- **Python runs its own copy, held to one case table.** Python is a different language, so it shares a specification, not code. The shared case table is that specification. The Sheets, extension, and Python suites each run it, so the suites fail on a rounding change made on one platform until all three give the same results. The plugin runs the extension's files unchanged, so the extension suite's run covers the plugin. Each row holds what the number reader returns, and a row with text input also holds what Sheets returns under each result kind. Python reads a string only as one whole number, and that gap is a refactor target in the capability map.

## Rounding

- **The offset counts from the value's own order of magnitude.** Why: one offset fits every size of number in a column, and a count of decimal places cannot.
- **The sign of a fractional offset stands for the direction of the half-step.** An offset of +0.5 rounds to half the step of the next larger order of magnitude, and -0.5 to half the step of the value's own. Why: before the 2026-05-28 release the function returned the same result for both, so the sign carried no meaning.
- **A result never falls below the value's own order of magnitude.** Why: without this floor a value could round to 0, or a smaller value could show larger than a bigger one.
- **At a fractional offset above 1 in size, the result is never smaller than the result at the integer offset nearer zero.** Why: at a coarse offset the step can grow past the value, and the value then drops to its own order of magnitude. Without this floor, 87,054,321 at +1.5 would return 10,000,000, below its +1 result of 100,000,000. The floor holds at fine offsets as well: at -2.5 the same value returns the -2 result, 87,100,000, not 87,050,000.
- **Results hold at most 12 significant digits.** Why: floating-point arithmetic on a step below 1 is inexact, as 11 × 0.1 gives 1.1000000000000001. The cost is a real loss of precision at fine offsets on large inputs.

## Reading a cell

- **One classification ladder reads every text cell, on every platform that reads text.** The extension, the plugin, and Sheets run the same ladder. Why: two readers of one cell would drift apart.
- **When a reading is in doubt, the text stays as written.** An identifier shape, a split number, an impossible date, an ambiguous date the column post-pass cannot settle, and a number the number shape test rejects, such as "13,63", all stay as written. Why: a reader loses a little time on an unrounded number, and a reader misreads a wrongly rounded one.
- **One number format function holds the marks.** It returns a comma and a dot, US style, and both the number shape test and the write-back read it. Why: the code that reads a number and the code that writes it then use the same marks.

## Tables in the extension

- **A native table and a grid give the same result.** [Table kinds behave alike](../AGENTS.md#table-kinds-behave-alike) holds the rule, and the [table kind pairs](table-kind-pairs.md) list holds each table feature in its two forms. The content script runs one pass, one cell read, one patch writer, and one restore for both kinds. The only setting that differs is which element the re-apply observer watches. Why: a rule added to the one pass holds on both kinds, and the first simplification and a re-apply pass cannot diverge.
- **Every write is a patch inside one text piece.** The patch writer edits the text of a text node the page drew, and never adds, removes, or replaces a node. Why: page authors split one number across several elements for alignment and hide sort keys beside it, so the layout breaks when a whole cell is rewritten. A framework also holds references to the text nodes it drew, so the page breaks on the framework's next redraw when one is replaced; one page's results panel crashed this way on a column resize. A number split across text pieces stays as written.
- **The content script never restores a number the page no longer shows.** It puts an original back only into a text piece that still shows the extension's written text. Why: the page may have changed the value since.
- **Every column rule reads the grid column.** The table adapter counts each cell's grid column once per table, through the merged cells. The code for the exclusions, the range expression, the dataset, and the column post-pass reads it. Why: without it, every cell after a merged cell would land on the wrong column.
- **Position counts, not markup.** The first-row and first-column exclusions apply by position, whatever tag the page gave a cell. Every row joins the dataset, whether it sits in a head, body, or footer section. Why: the two table kinds mark these sections differently, so each kind would get a different result under a rule read from the markup.
- **The max magnitude freezes at the first simplification.** The content script does not compute it again when rows scroll into view or the page writes a larger value. A settings change, or a toggle off and on, computes it again. Why: a virtualized grid holds only its visible rows, so a fresh max magnitude would shift on every scroll. The extension cannot tell a virtualized grid from any other grid, so every grid freezes, and a native table freezes as well so the kinds behave alike.
- **The re-apply observer follows page changes.** After a page change on a table that is on, it runs the pass again. A cell the page left alone takes no write, and a cell the page rewrote simplifies from its new text. Why: virtualized grids reuse rows as the user scrolls, and live pages rewrite values.
- **A table whose shape changes is a new table.** Before every action, the controller compares the table's shape with the shape fingerprint it recorded. On a mismatch it restores the originals, and the table registers fresh with the shipped defaults. Why: the table settings hold a range expression by position, which fits only the shape it was written for.

## Detection in the extension

- **Only a data table gets a table pillbox.** The data test passes a table only when it holds a value the extension can round, and it reads each cell through the pass's own per-cell read. Why: a menu or a card layout must never show a table pillbox, and with one shared read, the test and the pass give the same answer for each cell.
- **Detection stays narrow.** The load-time scan reads native tables and elements marked with a grid or table role. The content script adds an unmarked grid only on a right-click, through the geometry probe. Why: a menu or a gallery built on a layout grid looks like a grid to the code, so the content script reads one only after the user right-clicks it.
- **The content script registers one table per nest.** It registers the element at the nesting depth the detection settings hold. A table inside a cell is a table of its own. Why: a vendor grid wraps its scrolling pane in several marked elements, and the user sees one table.
- **A table that loads late still registers.** A table that fails the data test because its rows or numbers have not arrived becomes a pending table, and the content script tests it again after its content changes. Why: many pages draw a table before they fetch its data.
- **Every walk, wait, and count has a cap.** The caps sit in the detection settings, one object: the data test's cell budget, the geometry probe's walk and sample, the longest wait for a burst of page edits, the cell cap, the re-test cap, and the pending table cap. At a cap the content script stops that walk, wait, or count, and shows no toast. Why: the content script runs on every page, including pages with thousands of tables or cells.

## State and messages in the extension

- **The application model is the one holder of application state.** It sits in the content script and holds the registry, each table's table settings, the active table, and the error state. Every write goes through a setter, and the setter of each field a view draws publishes the change. Why: the content script lives as long as the page and runs where the tables are, and with one holder, no copy can drift.
- **Each table holds its own settings, and nothing persists.** A table's settings start as the shipped defaults when it registers and end with the page. The extension holds no storage permission. Why: a range expression fits one table only. With no storage to wait on, the first simplification starts at once, and each tab stays independent.
- **Every user action targets the active table.** The active table is the last one the user right-clicked, or the last one whose table pillbox the user pressed. Hover changes nothing. Tables carry no identifier across contexts, so a cross-context topic about a table stands for the active one. Why: a page element cannot cross contexts, and an identifier for one would be a second record to keep in step with the page.
- **Every action takes one path.** A view, or the service worker for the right-click menu, publishes an intent topic or a request. The controller handles it and writes the application model. The model publishes a state-change topic, and each view redraws from it. Why: each field changes in one place, so every view shows the same value. The press handler reads the table's on/off value and writes the opposite value, so the table pillbox and the sidebar pillbox always show the same value. An earlier press handler read a page-held copy of whether the sidebar was open; that copy drifted, and only the service worker could correct it.
- **Every message goes through the event bus.** Two calls carry every message: a publish, which returns nothing, and a request, which returns one answer from one responder. One list holds every topic with its family and its route, and a caller passes the topic name, never the Chrome call that carries it. A cross-context topic carries plain values only. Why: Chrome reaches the extension's pages and a tab's content script through different calls, and the route holds that choice in one place.
- **The sidebar serves its bound tab alone.** It drops messages from other tabs, and it closes when its tab leaves the front of its window, reloads, navigates, or closes. Why: a content script publishes by broadcast, a broadcast holds no tab ID, and the sidebar's controls show one tab's table.
- **The service worker holds no state.** Why: Chrome empties its variables after an idle spell.

## Errors and the capture

- **The user sees every extension error.** The log buffer passes each warn or error row to the controller's row listener, the model records it, and the toast view shows it. The row listener exists because the log buffer loads before the event bus and the model. An uncaught exception stays outside this path.
- **A capture is one inert file.** The browser runs no script and fetches nothing remote in the file, under the file's own content policy, so the file is safe to attach anywhere. The file records an absence as an absence, never as a rebuilt value. Why: a capture is evidence, and a rebuilt value would hide the defect.
- **The content script does nothing on a capture.** The capture carries the capture marker, and the content script does nothing on a page that carries it. Why: Chrome does not apply a page's own content policy to an extension's injected code, so without the marker the extension would round the capture's own table.

## The Claude Code plugin

- **The plugin adds no rounding code.** Its markdown adapter lists each markdown table's cells. Its text table step runs them through the classification ladder and the table step under the settings contract's defaults. Its hooks module holds the toggle command, the status entry, and the drawing hook.
- **The plugin stores nothing.** The engine keeps each reply block's originals and the on/off value, and the drawing hook returns the simplified text while the value is on. Why: the engine already holds both, so a second copy could only drift.

## Google Sheets

- **The Sheets input step sorts each value by type.** The function returns a number for a number cell and text for a text cell, and text goes through the classification ladder. Why: a custom function receives a cell's value and nothing about its format, so a currency-formatted 1,234 arrives as the number 1234. Other formulas can read a number result.
- **For a text cell that holds one number, the function returns text.** The result kind holds this choice. Why: the sign the user typed stays, as it does in the extension. The cost: Sheets skips a text result in a formula that sums a range.
- **Sheets rounds the whole dataset.** Under its fixed settings, the first row, the first column, currency, and percent round, and dates and times stay as written. Why: the Sheets function takes no switches, and the user chooses the cell range it reads.
