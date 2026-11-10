# Vocabulary

One term per concept, across every platform and every document. Use the [Retired synonyms](#retired-synonyms) table to standardize language.

## Numbers and rounding

| Term | Meaning |
| --- | --- |
| order of magnitude | The power of ten of a value's size: `floor(log10(abs(value)))`.<br><br>e.g. 112 and -969 have an order of magnitude of 2. |
| offset | How far from a value's own order of magnitude to round.<br><br>offset=0 is the value's own order of magnitude.<br>Negative means finer (e.g. -1 means the next smaller order of magnitude).<br>Positive means coarser (e.g. 1 means the next larger order of magnitude). |
| step | The **concrete unit** a value is rounded to. <br><br>e.g. An offset of -0.5 on a value with an order of magnitude of 7 gives a **step = 5,000,000;** <br>the sidebar shows it as "**nearest 5M**".  |
| set-aware | Rounded against the whole dataset.<br><br>Numbers in the **largest** orders of magnitude of a dataset can round differently from the rest. |
| max magnitude | In set-aware simplification: the largest order of magnitude among the numbers in a dataset. |
| top band | In set-aware simplification: the orders of magnitude within `num_top` of the max magnitude. The sidebar label for them is "largest numbers". By default the max magnitude alone. |
| other band | Every order of magnitude outside the top band.<br><br>The sidebar label for them is "all other numbers". |
| magnitude freeze | On a virtualized grid, max magnitude is fixed based on the content in the table when simplification is first applied. Scrolling new rows into view does not shift the max magnitude, even when the new rows hold values of a larger order of magnitude. <br><br>A native table has no magnitude freeze: the content script computes its max magnitude again on every pass, and rounds the whole table again when the page writes or adds a larger value. A grid holds only its visible rows, so the extension cannot tell a changed value from a row scrolled into view. |
| pass-through | Non-numeric input returned unchanged. |

## Parameters

| Parameter | Description |
| --- | --- |
| value | The number or the set of numbers to round. |
| dataset | In set-aware: the values the max magnitude comes from. In the extension, it holds every row of a table, header, body, and total alike, on a native table and a grid. The Sheets function takes it as a cell range; the Python function takes it as the `data` list. |
| offset | Order-of-magnitude adjustment (single mode). |
| offset_top | Order-of-magnitude adjustment for the top band. |
| offset_other | Order-of-magnitude adjustment for the other band. |
| num_top | How many orders of magnitude below the max magnitude still count as the top band. |
| enforce_numeric | Python only. If `True`, raises `ValueError` for non-numeric input. |

## Lens metrics

Figures that describe what one lens does to one dataset. Each one reads a list of pairs, an original value beside its simplified value, and nothing else: no settings, no table, no page. Which values join the list, and how each one was simplified, is the caller's business. In the extension the list is the dataset, each value simplified as the table would simplify it under the lens the lens control shows.

| Term | Meaning |
| --- | --- |
| lens metrics | The three figures the sidebar shows for the active table under the lens the lens control shows: rounding error, distinct values, and significant digits. They describe the lens, so they change with the lens control whether the table is on or off, and the capture carries them. Not built yet; `docs/sprint-plans/lens-metrics.md` holds the plan. |
| rounding error | How far a dataset's simplified values sit from its originals, as one share: the sum of each value's absolute difference between original and simplified, divided by the sum of the absolute originals. 4.3% means the simplified values sit 4.3% of the dataset's size away from the originals. In the sum, each value counts in proportion to its size, so the largest values make up most of the figure. The mean rounding error is the same sum divided by the count of values; the sidebar shows the share alone. |
| distinct values | The count of different values in a dataset, by value: 20 and 20.0 are one value, 20 and -20 are two. The sidebar shows original and simplified side by side, 9 → 5: the count falls under a lens when values round to the same result. It can fall only where two values share an order of magnitude, so on a dataset with low crowding it stays near the original count under every lens. |
| significant digits | Of one value: its digits with the trailing zeros dropped, the sign, the decimal mark, and leading zeros ignored. 4,250,000 has 3, 4,000,000 has 1, 0.0625 has 3, and 0 counts as 1. The metric is the mean over a dataset, shown original and simplified side by side, 7.0 → 1.7: how much of each number a reader must read. It falls as a lens coarsens, and it changes where distinct values do not: 4,250,000 and 4,000,000 are each one distinct value, with three digits against one. |
| crowding | A property of a dataset, not of a lens: the count of values divided by the count of orders of magnitude that hold at least one value. Nine values across two orders of magnitude give 4.5; nine values across five give 1.8. Above 1, at least two values share an order of magnitude, so distinct values can change on that dataset. Nothing displays it. |

## UI Elements

| Term | Meaning |
| --- | --- |
| table pillbox | The on/off control on a data table. |
| sidebar pillbox | The on/off control at the top of the sidebar, beside its title. It shows and writes the active table's on/off value. |
| toggle | Verb: to change a table's on/off value. As a noun it is the act ("a toggle or apply"), never the on-table control — that control is the table pillbox. The one control named "toggle" is the menu toggle below, a menu item. |
| switch | An on/off control in the sidebar for one simplification option, such as words, dates, or first column. The sidebar's on/off control for the whole table is the sidebar pillbox. |
| menu toggle | The "Toggle table" item in the extension's right-click menu. Toggles the active table. |
| pulse | A brief highlight flashed over the cells a toggle or apply changed, as visual feedback. <br><br>It covers the range expression's cells; with a blank range expression it covers the whole table. |
| lens | A simplified data set with different assumptions (parameters). |
| lens control | The sidebar control at the top of the sidebar, under the title, where the user can change `offset_top` and `offset_other`. |
| lens preview | Sample values from several orders of magnitude, before and after simplification. |
| sample | One value shown in the lens preview. |
| toast | The on-page notice for the newest extension error: one element at the page's bottom right holding the log row's text, removed by a click or after five seconds. For a second row, the toast view replaces the text and restarts the delay, so a repeated warning produces one toast. |

## Reading a cell

| Term | Meaning |
| --- | --- |
| classification ladder | The ordered rules by which the extension determines, cell by cell, whether to simplify and how. |
| mode | The ladder's result for one cell: `skip`, `pure`, `date`, `time`, or `extracted`. |
| pure cell | A cell whose whole text is one number. |
| extracted cell | A cell where numbers are found inside surrounding text and replaced in place, leaving the words alone. |
| currency list | The one list of the currencies the extension and the Sheets library read: each row gives a currency's written signs and its ISO code. The code for every currency rule reads it: reading a cell as a number, the currency exclusion, the sign-only piece test, and the number span, whose text the write-back replaces without the sign. A sign written in letters counts only as its own token, so the rand's "R" counts in "R45" and not in "Revenue". |
| format mark | A character that sits beside a number without belonging to it: a currency sign, a percent sign, whitespace. Whitespace between two digits is a group mark, not a format mark. The one list sits beside the currency list, and the code for every rule that steps past a mark to reach a number reads it: stripping the marks before the number reader converts a text, testing what stands between a bracket and the number, and finding a pure cell's number span. A bracketed number's brackets are its minus sign, not format marks. |
| number reader | The step that turns a cell's text, or a number found inside text, into a value. It strips the format marks, keeps the whitespace between digits as a group mark, reads the brackets and dashes as a minus sign, runs the number shape test, and converts the run, or returns no number. |
| group mark | The character between groups of three digits in a large number: the comma in "1,234,567", the space in "1 234 567". |
| decimal mark | The character before a number's fraction: the dot in "13.63". In US style the dot is the only decimal mark. |
| group shape | A first group of one to three digits, then groups of exactly three. "1,234,567" and "1 234" have it; "1,234,56" and "13,63" do not. |
| number shape test | The number reader's rule for group marks, a comma in US style or whitespace: a group mark may appear only in the group shape and only before the decimal mark, and a run holds one kind of group mark, so "1,234", "1,234.56" and "1 234 567" pass and "13,63", "987,5", "1,234,56", "1.234,56" and "416 555 1234" are not numbers. The number reader converts a run with no group mark, and gets no number from a run with a second dot ("1.234.567", "12.03.2024"). It reads its marks from the number format function. The rule holds on all three platforms, and the code that finds a number inside text uses the same group shape, so "Revenue 1 034 567 units" holds one number and "In 2024 12 stores opened" holds two. |
| number format function | The one function that returns the marks a number uses: a group mark and a decimal mark. It returns US style, a comma and a dot. The number shape test reads it for the shape to accept, and the write-back reads it for the marks to write. |
| write-back | The step that turns a rounded value back into text. One path covers every cell: the number's digits alone change, in place, grouped with the marks the number format function returns, and every character around them stays where the page put it. "up 12345 units" becomes "up 10,000 units"; "1 234 567" becomes "1,000,000". |
| number span | The part of a pure cell's text the write-back replaces: the text with its leading format marks and sign characters (a plus, a minus or dash, an opening bracket) and its trailing format marks (and a closing bracket) left out. "$ 1,234" has the number span "1,234", so the sign and its gap stay. |
| bracketed number | A number whose minus sign is written as the brackets around it, the accounting form: "(1,234)" is -1,234. The brackets hold nothing but the number and its own format marks, so "($1,234)" and "(12.3%)" are bracketed numbers and "(see note 4)" is not. Its digits alone round and the brackets stay where the page put them, so a bracket in its own text piece never stops the cell from rounding. A bracket pair followed by a digit is a phone number's area code, not a minus sign. It rounds on every table kind, with the "words" switch on or off. |
| unit number | A cell whose whole text is one number with a magnitude suffix after it, a listed currency code before or after it, or both: "4.91tn", "CAD$45.67", "1,234 USD". Its digits round and the suffix and code stay. It rounds on every table kind, with the "words" switch on or off. The codes come from the currency list; the suffixes are listed once, in the number library. |
| stacked cell | A table cell whose text pieces each hold one whole number or unit number, or nothing but whitespace, a currency sign, a percent sign, or a listed currency code: "125" above "126". Each number rounds in its own piece. A cell with a piece that is a date or a time is not stacked. Two pieces with no space or line break between them in the rendered text hold one number split across them. |
| split number | A number whose characters sit across two text pieces: "4." in one and "91" in the next. It stays unchanged. |
| allow list | A list of the characters or words that may touch a number in an extracted cell, so an identifier such as "DT1234" stays unchanged. Not built yet; until it exists, the extension rounds every number it finds in an extracted cell outside an identifier shape, on every table kind. |
| at-name | A name written after "@", such as a social media name ("@2020vision") or the name part of an email address. A number right after "@" belongs to the at-name and never rounds, in any cell. |
| identifier shape | A text pattern that identifies a thing: a phone number ("416-555-1234", "(416) 555-1234"), an IP address ("192.168.0.1"), a web or email address, an ISBN ("ISBN 978-0-306-40615-7"), a postal code ("M5V 2T6", "90210-1234"), a digit run with a leading zero ("0012345678", "02134"), or digit groups split by whitespace outside thousands grouping ("416 555 1234"). A cell holding one, alone or with only a currency sign, a percent sign, a sign, or brackets around it ("$ 4165 5512", "(416-555-1234)"), stays as written on every table kind, with the "words" switch on or off. Inside an extracted cell, a shape keeps its digits and the cell's other numbers round: "Call 416-555-1234 about 1,613,245 units" keeps the phone number. Two shapes count only as a whole cell: digit groups split by spaces alone, and an ISBN without the word "ISBN". The shapes are listed once, in the number library. |
| clock time | A time of day written as hours and minutes, seconds optional: "14:29", "3:45 PM", "14:29:30". A cell holding one clock time and nothing else follows the "times" switch. A clock time inside a cell with words or a second time ("9:45 - 11:45 AM") keeps its digits with the "times" switch on or off, and the cell's other numbers round. The shape is listed once, in the number library. |
| text piece | A run of plain text inside a cell with no HTML tag inside it. A cell may hold several: `<span>$</span><span>337.91</span>` holds two. |
| flat text | The join of a cell's text pieces in page order. A position in the flat text maps to exactly one text piece. |
| rendered text | A cell's text as the browser shows it: runs of spaces and line breaks in the markup collapse to one space, the ends are trimmed, and hidden text is left out. The extension classifies a native table's cell on its rendered text. On a pretty-printed page the rendered text is shorter than the flat text, so the extension converts a position between the two before a patch. |
| exclusion | A settings-driven reason to skip a cell: first row, first column, currency, or percent. |
| merged cell | One cell covering two or more rows or columns of the table. On a native table the markup holds the span; on a grid the accessibility attributes hold it. |
| grid column | The column a cell is laid out in, counted from the left. The code for every rule that gates a cell by column — the exclusions, the range expression, the dataset behind the max magnitude, the column post-pass, and the capture state — reads this one number. It is not the cell's position in the row read: a merged cell earlier in the table holds columns that the cells after it skip, so the two differ on every row a merge covers. |
| quoted cell | A cell wrapped in double quotes. The extension leaves it unsimplified, as a direct quote. |
| ambiguous date | An all-numeric date readable two ways: 7/4/99 may be July 4 or April 7. |
| format hint | The column-level result for ambiguous dates: `month-first`, `day-first`, `mixed`, or `ambiguous`. <br><br>Under mixed or ambiguous, the column stays unchanged. |
| column post-pass | A second pass for any cell whose reading depends on its whole column. Dates are the only case today. |
| granularity | How coarse a date or time becomes: <br>- dates: month, quarter, year, decade, century<br>- times: minute, hour<br><br>The extension drops a date's parts finer than the granularity, so the result stays within the date's own month, quarter, year, decade, or century: December 13, 2096 becomes "December 2096", "Q4 2096", "2096", "2090", or "2000". At month the extension drops the day and keeps the date's own style ("2096-12-13" becomes "2096-12"); a date with no day stays as written. At quarter the date becomes its quarter and full year, with the quarter on the side of the year where the month stood ("2096-12-13" becomes "2096 Q4", "7/4/99" becomes "Q3 1999"); a date with no month stays as written. Every date in a cell changes, and words around them stay: "Jun 2020 - Dec 2020" becomes "2020 - 2020" at year. |
| impossible date | Text in a date shape that matches no real date: a month outside 1 to 12 or a day outside 1 to 31, as in "2020-13-45". The cell holding one stays as written. |

## Tables on the page

| Term | Meaning |
| --- | --- |
| detection | Finding the tables on a page. |
| load-time scan | The detection pass that runs when the page loads: native tables first, then elements marked with a grid or table role. On a right-click, the content script runs the nomination step from the clicked element's chain root, which adds a marked grid the scan missed. The content script adds an unmarked grid on a right-click alone, through the geometry probe. |
| geometry probe | The check that qualifies an unmarked grid on right-click: five or more repeated rows or columns, a grid or flex layout, at least one cell the data test counts, and first cells that line up. On a row-first grid the first cells of the rows share a width; on a column-first grid the first cells of the columns share a height. |
| row-first grid | A grid built from generic elements whose children are its rows, stacked one under the next, each holding its cells. The extension treats as row-first every grid whose rows it finds by role, by vendor class, or as `<tr>` elements, and every grid the direction reader does not find column-first. |
| column-first grid | A grid built from generic elements whose children are its columns, side by side, each holding one item per row, as on a pricing page that lists each plan as a column. The extension reads it as rows: row r holds the r-th item of every column, in column order, and a cell's grid column is its column's position. The direction reader tells it from a row-first grid. |
| direction reader | The function that tells a row-first grid from a column-first grid. It compares the boxes of the first two children that draw a box, among at most as many children as `gridColumnWidthSample` in the detection settings allows (10 today). When the second box has the same top and a larger left, the grid is column-first. Every other case is row-first: fewer than two boxes within the cap, a hidden child or a `display: contents` row that draws no box, and a style probe with no box function. The geometry probe and the grid adapter call the one function, so both get one direction for one grid. On a column-first grid the grid adapter builds each row from the r-th item of every column that holds the most common item count. A row built this way holds its cells and no row element. |
| accessibility artifact | A table that exists for screen readers or as a chart's fallback, hidden or drawn off-screen. Detection skips it: no registry entry, no table pillbox. |
| native table | A `<table>` element. |
| header cell | A cell the page marks as a header: a `<th>` on a native table, or an element with the row-header or column-header role on a grid. It rounds like any other cell, and the first-row and first-column exclusions apply to it by position, whatever tag the page gave it. The shape fingerprint holds a header row's text from the originals, so a header cell the extension simplified still matches the text the page drew. On a grid, an element with the row-header role or the column-header role is a cell beside the cell role and the grid-cell role, in document order, and rounds under the same two exclusions. |
| grid | A table built from generic elements with ARIA roles instead of `<table>`. |
| table feature | One piece of table markup the HTML standard or the accessibility standard defines: a header cell, a row label, a row group, a footer row, a merged cell, a caption, a hidden row. |
| pair | One table feature in its native form beside its grid form, e.g. a `<th scope="row">` beside an element with the row-header role. The design document's table kind pairs list holds every pair with its state: same, different, not yet tested, or no pair, for a feature with one form only. |
| row group | The wrapper that holds a grid's data rows — the grid analog of a table body. Row discovery uses it to identify the row shape, then takes every matching row across the whole grid. A row stays out of rounding and out of the dataset only under the first-row and first-column exclusions. |
| outside row | In a grid that has at least one row group: a row outside every row group. A grid with no row group has no outside rows (its groupless rows are orphan rows). An outside row rounds like any other row, and its values count in the dataset like any other row's. Only the shape fingerprint uses it: a grid whose first row is an outside row has a header row. |
| virtualized grid | A grid that keeps only its visible rows in the page, creating and destroying rows as the user scrolls. |
| vendor grid | A grid built by a known third-party library, which the extension recognizes by its class names. |
| qualifying element | An element carrying a grid or table role that passes the two guards the nomination step applies: it is not a native table, and it holds no native table other than accessibility artifacts. The data test has not run on it yet. A qualifying element inside an element carrying a cell role is the root of a nest of its own. |
| chain root | The outermost qualifying element of a nest: a qualifying element with no qualifying ancestor below the nearest element carrying a cell role. A grid inside a cell of another grid is its own chain root, so it registers beside the grid around it, the way a native table inside a cell does. |
| containment chain | The qualifying elements nested under a chain root, the root included, that pass the data test, grouped by nesting depth. A qualifying element that a cell separates from the chain root belongs to its own nest, not to this chain. An element's depth is the count of qualifying ancestors from it up to and including the chain root; the root sits at depth 0. |
| nesting depth | The depth in a containment chain at which the extension registers one table. The detection settings hold it as `nestingDepth`, 1 today. The count ends at a cell, so a grid inside a cell does not raise the depth of the grid around it. |
| pinned pane | A vendor grid's separate pane of leading columns that stays put while the rest scrolls. Whether its cells count as the table's first columns follows the configured nesting depth: at depth 0 the wrapper registers and the pinned cells are the table's first columns; at the shipped depth 1 the scrolling pane registers alone and the pinned pane stays outside the table. |
| data test | At least two rows, a row with two or more cells, and at least one cell holding a value the extension can round, found within one budget of 1000 cell reads. Each cell goes through the per-cell read the rounding pass runs — the classification ladder, the placement step, and the link filter — with every switch on and no range expression, so the test reads no table settings. A cell counts when that read's mode is anything but `skip`. A pure cell, a date, a time, a unit number, a bracketed number, a stacked cell, and a number after words ("I am 68.5 years old") each count. A cell holding only an identifier shape, such as a phone number, does not count toward the test, and neither does a cell whose whole text is a link, a number inside a link, or a split number. An ambiguous date counts only when the column post-pass settles its column's format hint as `month-first` or `day-first`. The post-pass reads only the dates within the budget, so the post-pass never reads a day above 12 that sits past the budget. The test walks every row and cell in document order, on native tables and grids alike, and stops at the first cell that counts. The geometry probe's numeric step runs the same read under the same budget. A table that passes is a data table. <br><br>On a native table, the test and rounding share one cell read: the cell's rendered text, falling back to its raw text when the rendered text is empty. A hidden cell rounds like any other cell, and its raw text counts toward the test. A hidden fragment inside a visible cell stays out: that cell's rendered text is not empty, so the fallback never runs. |
| data table | A table that passes the data test: a table holding at least one value the extension can round.<br><br>Only data tables enter the registry, get a table pillbox, and can be bound to the sidebar. |
| register | Of a table: to enter the registry. "The table registers" means the content script adds the table to the registry, as "the value rounds" means the extension rounds the value. A table that registers fresh enters as a new table, with the shipped defaults and in raw form. |
| pending table | A chain root whose containment chain is empty: no qualifying element of its nest passes the data test, so the nest registers nothing yet. One subtree observer watches the chain root and, after a change to the subtree, runs the nomination step from the root again, one run per burst of changes inside the grid redraw delay. The pending table ends when a re-test registers an element, finds the nest already registered, or finds its configured depth already full. A re-test that finds the chain still empty counts against the re-test cap, and at the cap the content script drops the observer.<br><br>A pending table is how the extension registers a grid that draws its rows after the grid itself. |
| re-apply observer | The watcher that detects a page change inside a table that is on (a virtualized grid redrawing its cells, a page rewriting a value or adding a row) and applies the rounding again, on native tables and grids alike. It runs no pass for the extension's own writes, collapses a burst of page edits into one pass, and stops for a table above the cell cap. |
| cell cap | The most cells one pass of the re-apply observer reads: a native table's cells, a grid's visible cells. The detection settings hold it as `reapplyCellCap`, 10,000 today, low enough to keep a pass under 100 milliseconds. Above it the content script writes nothing in that pass, the observer stops for that table, and the observer writes one debug row for the stop, with no toast. The first simplification has no cell cap. |
| orphan row | A row sitting directly inside a grid with no row group. <br>Detection still finds it. <br>Orphan always means a missing parent, never a missing referent; a handle whose table is gone is a dead handle. <br><br>- Parent: the wrapper element a row normally sits inside, the row group. <br>- Referent: the thing a name or key stands for; a handle's referent is its table<br>- Handle: defined under Parts of the extension. <br><br>two failures: 'orphan' means the wrapper is missing; 'dead' means the referent is missing. |
| literal row number | A row's position counting every row in the table, rows outside a row group included (header and summary rows). <br><br>The extension numbers rows this way for the first-row exclusion and for range expressions, so "first row" always means the table's top row. |
| page area | A box on a page that holds part of its content and scrolls on its own, apart from the window, such as a chat column or a results panel. It cuts off what sits past its edges. A table pillbox shows only while its table's top-right corner sits inside every page area around the table. |

## Acting on a table

| Term | Meaning |
| --- | --- |
| simplify | Apply the full treatment to a table under its table settings: rounding for numbers, granularity for dates and times. |
| form | Whether a table's cells are showing raw or simplified. Values: raw, simplified. |
| apply | Write the sidebar's values to the bound table's table settings, through a sidebar gesture. |
| patch | One replacement inside a text piece: the position in the flat text, the characters to replace, and the new characters. Every cell, on a native table or a grid, changes through patches alone, so every text piece the page drew stays in place. |
| patch writer | The write step that applies patches, each inside one text piece. It applies a cell's patches to the cell's originals and writes each text piece whose text differs from the result. The patch writer skips a patch whose characters are not at its position in the originals. |
| placement step | The step between classification and the patch writer: it checks a cell's classified result against the cell's text pieces. The step keeps a result whose changed characters sit in one text piece, and runs the stacked cell test on any other cell. |
| table step | The three steps that run over a whole table after every cell is classified and before any write: the column post-pass, the max magnitude over the dataset (or a frozen one the caller passes), and each cell's patches. It reads plain classified cells and settings and holds no page code, so a caller with no page runs it unchanged. The caller keeps the parts that read the page: the magnitude freeze, the check that a changed date or time sits in one text piece, the link filter, and the patch writer. |
| originals | The cell values stored before simplification so the table can be restored. A cell's originals hold each text piece's text. |
| written text | The text the extension last wrote into a text piece, stored beside the piece's original. On each pass the content script compares each piece's text with its original and its written text, to tell a cell that still shows the extension's text from a rewritten cell. |
| rewritten cell | A simplified cell whose text the page changed: a text piece shows neither its original nor its written text, or the cell holds a different count of text pieces. On a pass, the content script puts the originals back into the pieces that still show written text, drops the cell's originals, and simplifies the cell again from the page's text. When the count of text pieces changed, a piece matches its stored piece by written text, in page order, instead of by position. |
| restore | Put the originals back into every text piece that still shows its written text. A text piece the page rewrote keeps the page's text, so the content script never restores a number the page no longer shows. |
| unrestorable | Originals lost or never captured. The table cannot be restored. |
| bound | The sidebar's association with one table: the table whose table settings its controls read from and write to. |
| active | The table user actions target. <br>The most recently right-clicked table, or the most recent table whose table pillbox was pressed. The sidebar binds the active table, and the controller writes a sidebar change to the active table's table settings. A table whose registry entry is discarded stops being active: the page removed it, or reshaped it into something that no longer counts as a table. The page then has no active table until the next right-click or press. |
| activate | Make a table active: right-click it, or press its table pillbox. |
| range expression | An A1-style expression limiting which cells change. Blank means the whole table. <br><br>It holds rows and columns by position, so it fits only the table it was written for. Each table holds its own range expression in its table settings. A table the page gives new headers or columns registers fresh under the shipped defaults, so its range expression starts blank. |

## Parts of the extension

| Term | Meaning |
| --- | --- |
| context | One running, isolated instance of extension code, with its own memory. No context reads another context's variables and no context calls another context's functions; messages are the only way in or out. <br><br>Three kinds run: the **content script**, the **sidebar**, and the **service worker**. The running count is larger than three — the content script runs a separate context in every tab. |
| tab | One browser tab. The content script runs one context in each tab, so the application state of a page belongs to that tab alone. The service worker is common to every tab. |
| bound tab | The tab the sidebar was opened for. The sidebar serves that tab alone: it acts on messages from that tab and drops messages from every other one, and it closes itself when that tab stops being the tab in front. The service worker holds a separate tab number, which it uses to close the sidebar for that tab. |
| content script | The extension code Chrome injects into each web page. One context per tab. |
| re-injection | Injecting the content script into tabs that are already open. |
| sidebar | The extension's control panel page. Its own context. |
| service worker | The extension's background context. One instance for the whole browser, common to every tab. It creates the right-click menu items, opens the sidebar, and records which tab the sidebar was opened for. Chrome shuts it down after an idle period and starts it again on the next message, so a restart begins with its variables empty. |
| component | One part of the extension with one job and a boundary: it reaches other parts only through defined channels — topics or calls — and its insides can change without any other part changing. <br><br>e.g. The sidebar view, the controller, and the application model |
| view | A component that draws application state on a screen and publishes a user gesture as an intent topic. <br><br>e.g. the table pillbox, the sidebar's controls <br><br>A view holds no application state of record. The sidebar is the standing exception: its controls carry working values until a publish. |
| controller | The one component that subscribes to the intent topics and turns each one into a write to the application model or a simplification of a table. |
| application model | The one component that holds **application state**. Every other component reads from it or requests a change; none keeps its own copy.<br><br>- Application settings: each table's table settings, in the registry.<br>- Current page state: registry, the active table, etc. |
| table settings | One table's settings object, held in its registry entry: the on/off value and every simplification option. A table with none uses the shipped defaults. <br><br>Every writer goes through it — the sidebar pillbox, a table pillbox press (sidebar open or closed), the sidebar's controls, any logic. The controller simplifies the table again after each change, and the view redraws from the write. The sidebar reads and writes the active table's table settings. A table whose data the page replaces keeps its table settings. A table the page gives new headers or columns is a new table: it registers fresh. |
| registry | The application model's list of the tables found on the current page, with the details held for each: the cell originals, the form, the table settings, a virtualized grid's frozen max magnitude, and the shape fingerprint. |
| shape fingerprint | The column count, and the header row's cell texts where the table has a header row, recorded for a table when it enters the registry. Before every action on a registered table, the controller compares the table's current shape against it. A mismatch means the page replaced the table's content with a different shape, so the controller discards the entry and the table registers fresh. The column count is the widest row's cell count. A grid has a header row where it groups its data rows and its first row is an outside row; a native table has one where its first row sits in the head section or holds header cells alone. For a table with no header row, the fingerprint holds the column count alone, because the first row of a grid that groups nothing is a data row the grid redraws on every scroll. The row count stays out for the same reason: a virtualized grid changes its drawn row count on every scroll. |
| handle | An opaque key standing for a live table on the page, like a coat-check ticket. The caller holds it and passes it back to act on that table. A **dead handle** stands for a table no longer in the page. |
| contract | An agreement between components about names and values: which settings exist, what each is called, and what its default is. A contract holds the names and values that no one component may change alone. |
| detection settings | The one object holding every value that determines whether an element counts as a table or a grid, and the two lookup lists detection reads, beside the settings contract in the configuration file. The detection layer and the controller read it as a bare global with no local fallback copy, so a change is one edit in one place and a missing object fails at load. The table pillbox auto-collapse delay stays in the table pillbox view: the view alone reads it, and detection does not use it. The capture holds the detection settings in force at capture time. |
| event bus | A component that carries **messages** between components on named **topics**, inside one **context** and across contexts. <br><br>A publisher sends to a named topic; every subscriber to that topic receives it.<br><br>Publisher and subscribers hold no reference to each other.<br><br>Delivery inside the publishing context is immediate: the publishing line continues once every subscriber finishes. A topic carried inside one context can carry a live page element; a topic that crosses contexts carries **plain-value** data only. |
| topic | One named 'channel' on the event bus. Multiple components can publish to it, and multiple subscribers can receive it. <br><br>Every topic is recorded on one shared list, with its family and its **route**. Publishing a name that is not on the list fails at that moment. |
| publish | Send a message on a named topic. |
| publisher | The component that publishes on a topic. It holds no reference to any subscriber. |
| subscriber | A component registered to receive one topic. A topic has zero or more. |
| request topic | A **topic** whose one **responder** returns a **plain-value** answer to the publisher. With no responder, the request fails immediately, with no waiting period. |
| responder | The one function a **context** registers to answer a **request topic**. Exactly one per request topic; a second registration fails at that moment. |
| route | A **topic**'s record of which carrier reaches its audience: the extension's pages, one tab's content script, or neither, meaning the publishing **context** alone. A route holds the carrier alone. |
| cross-context topic | A **topic** whose **route** reaches another **context**. The event bus carries it, over Chrome's messaging. <br><br>Same shape as any topic: the publisher supplies a name rather than a destination, and holds no reference to any subscriber. Two differences:<br>- It carries **plain-value** data only, never a live page element.<br>- Delivery to the other context is not immediate. A **request topic**'s answer arrives later; a one-way publish returns without waiting.<br><br>The event bus delivers it to the publishing context's own subscribers first, then to the other context. No intent or request topic pairs that way: a context that both publishes and receives one would run its own handler on the way out. A state-change topic may, because a view in the model's own context redraws from it, as the table pillbox view does from the settings notice. |
| intent topic | A topic carrying **what the user did** ("toggle this table"). A request with no authority — the controller subscriber determines what actually changes. |
| state-change topic | A topic carrying what changed in the application model.  |
| settings notice | The state-change topic the application model publishes after every write of a table's table settings. Every write targets the active table. Its plain-value payload holds the writer's source ('sidebar' or 'page') and the table's whole settings. The sidebar redraws from a notice the content script wrote, and skips its own. The table pillbox view redraws the active table's pillbox from every notice. |
| plain-value | Data made only of text, numbers, booleans, and plain lists and objects — no live page elements, no functions. |
| snapshot | A plain-value copy of a table and its metadata:<br>- each cell's text, position, and role <br>- the table's kind and its row and column counts. <br><br>Snapshot is at one moment and it does not update itself.  |
| port | The abstractions of services used by the business logic (e.g. if the database gets changed, the abstraction keeps that out of the logic.). |
| adapter | A component that presents one shape of thing through a shared interface, so a caller works against the interface alone. In the design document, the extension's adapters form a layer of the same name. <br><br>e.g. the native-table adapter and the grid adapter both present rows and cells, over markup with nothing in common |
| marker class | A CSS class the extension adds to page elements it has processed so the extension can easily target that element later. |
| page attribute | A named value written onto an HTML element in the page. |
| extension error | A warn or error row the extension records in its log buffer. Every failure the extension records today is a warn row, and Chrome's extension error page lists warn output beside errors. The log buffer never holds an uncaught exception, so an uncaught exception is not one. |
| error state | The application model's record of extension errors on the current page: whether one has been recorded, how many, and the last 50 rows with their stack traces. The controller writes it from the row listener, the toast view redraws from its state-change topic, and the capture carries it. It never clears within a page's life, and it is empty again after a reload. |
| toast view | The view that draws the toast. It subscribes to the error state's state-change topic and never logs, because the error state's state-change topic would carry a row it recorded back to it. |
| row listener | A function the log buffer calls with a copy of each log row as it lands. The controller registers one to write warn and error rows into the error state. Not a subscriber: the log buffer loads before the event bus and the application model and reaches neither. |
| stack trace | The list of calls active when a log row was recorded, starting at the caller of the log call. Warn and error rows carry one; debug and info rows carry none. Cut at the same bound as row text. |

## Capture

| Term | Meaning |
| --- | --- |
| capture | A bug report written as one self-contained HTML file: the mark and remarks, a likeness of the sidebar, a screenshot of the bound tab, the bound table's rendering, both contexts' log rows, the fixture seed, and the capture state as machine-readable JSON. In the file, the browser runs no scripts and fetches nothing remote, so the file is safe to attach anywhere. |
| mark | The verdict a capture carries: looks-right, not-sure, or looks-wrong, shown as "Looks right", "Not sure", "Looks wrong". One of three buttons in the sidebar's capture section; the sidebar opens the remarks form when the user presses one. The token ends the capture file name. |
| remarks | The capture's one free-text field, labeled Remarks. Its placeholder text follows the mark: for a looks-wrong capture it lists expected, observed, and cause (if known); for a not-sure capture it lists suggestions, questions, or remarks. Blank remarks save as blank. |
| note | A reader hint in the capture file: a sentence or two in italics, one size below the table text, opening with "Note: ", stating a limit of what the file shows (the hover reveal, unrecorded cell spans, missing service worker rows, the seed's escaping). One helper renders every note, so the prefix and the style sit in one place. An absence is never a note: it renders as an absence sentence, highlighted. Lens preview lines are content, never notes. |
| finish | The explicit gesture that writes the capture file — the "Save capture" button. Nothing saves without that press. |
| capture file name | `dr-capture-YYYYMMDD-<source>-HHMMSS-<mark>.html`. The source is the page's host with `www.` dropped; for a page opened from disk it is the page file's name without its extension; it is `no-source` when the page has no address or the address does not parse. The mark token closes the name, so a folder listing shows each file's verdict without opening the file. |
| capture state | The plain-value record embedded in the capture: full registry detail for every table with its table settings, the detection settings in force at capture time, the lens preview samples, the sidebar view state, the log rows with their stack traces, the error state, the screenshot record (taken, format, chars; never the image), the page and extension metadata, and the fixture seed. Carries a one-integer format version so a later tool can read old captures. |
| screenshot | The image of the bound tab's visible area the sidebar takes at finish, as JPEG, carried in the capture's Screenshot section between the sidebar likeness and the bound table. The take runs through chrome.tabs.captureVisibleTab under the activeTab grant Chrome gives for the tab on the right-click menu item; a sidebar opened from Chrome's own side-panel control has no grant. The capture state holds a record alone (taken, format, chars), never the image data, so the JSON island stays small. When the take fails, the sidebar records the reason, saves the capture, and shows that absence in the section. |
| log buffer | A per-context list of the last 50 log rows the extension recorded, with a count of rows dropped past the cap. A warn or error row carries its stack trace. Each row also goes to the console, so devtools output is unchanged, and to every row listener. |
| state pull | The one request the sidebar sends for the page-side half of a capture. When the state pull fails, the sidebar still saves the capture: the sidebar half is present, and the page half renders as an absence. |
| fixture seed | The bound table's markup as it stood at capture time — form included, so a seed taken from a simplified table rebuilds in simplified form. Carried verbatim in the capture state, and escaped for reading in the visible file, so a regression fixture can be rebuilt from it. |
| capture marker | The page attribute the saved capture carries on its document element. The content script does nothing on any page carrying it, so a capture shows what was captured, never what the extension would do to it. |

## Working terms

Terms for reviews, plans, and discussion.

| Term | Meaning |
| --- | --- |
| coupled | Two parts that cannot change independently. |
| load-bearing | Behavior depends on it. Removing a load-bearing item changes function, not only appearance. |
| guard comment | A comment that flags a hidden dependency in nearby code for future editors. |
| never used | Code no caller reaches. |
| living document | A document that describes the current system and must track it: the READMEs, the design document, this vocabulary, the agent instructions. The author of a behavior change updates the living documents it invalidates, in the same branch. |
| historical record | A document that describes a moment: sprint plans and logs, research notes, changelog entries. Never rewritten — a superseded or completed record gets a status marker pointing forward. |
| test piece | One file of the extension's test suite, in the tests folder beside the runner. A piece does not run alone: it depends on the setup and helpers other pieces define. |
| order list | The runner's one list of test pieces, in run order. The runner stops with an error when a piece in the folder is missing from the list, or a listed piece is missing from the folder. |
| joined suite | The text of every test piece, in order-list order, run as one script in one shared scope. A function one piece defines is callable from every piece, and the state one piece leaves stays in scope for the pieces after it. The checks that scan the suite's own text read the joined suite. |
| comparison test | A test that draws the same values once as a native table and once as a grid, runs detection and the simplification on both, and checks that both are found or both are missed, that the same cells change, and that each changed cell reads the same text. Each tested pair has one. |
| cost | What a change uses up (units may be: lines, risk, review time, runtime, etc.) |
| benefit | What the user or the maintainer gains from a change. |
| help card | The box Google Sheets shows while a user types `=ROUND_DYNAMIC(`. Sheets builds it from the function's JSDoc: the description lines, including the `[VERSION]` line, and one line per parameter. |
| bump workflow | The automation that runs after every merged pull request, raises the version of each package the pull request touched, and merges the version-bump pull request itself. One table in its script lists the packages, their version files, and the build each version file feeds. |
| Sheets build | The script that writes the Sheets library, the one file a user pastes into Apps Script, by joining the license header, the shared library files it lists, and the Sheets entry source: the code only Sheets holds, `ROUND_DYNAMIC` and its help card among it. Its list is the one list of shared files the Sheets library holds. The committed Sheets library is its output, and its check fails the tests on any pull request whose committed file differs from the build. |
| Sheets entry source | The hand-written source of the code only Sheets holds: `ROUND_DYNAMIC`, its help card text, the `[VERSION]` line, the default offsets, the fixed settings, the result kind, and the Sheets input step. The Sheets build joins it last, after the shared library files. A change to the Sheets function is an edit to this source followed by a rebuild. |
| Sheets input step | The step at the top of `ROUND_DYNAMIC` that sorts each value Sheets passes in by its type. A number rounds as a number and comes back as a number. A date, a boolean, and an empty cell come back unchanged. Text goes through the classification ladder and the table step, and the step applies the cell's patches to the text, last patch first so the earlier positions hold. It exists because a custom function receives a cell's value and nothing about the cell's format: a currency-formatted 1,234 arrives as the number 1234, and a cell typed as text arrives as text. |
| result kind | What a text cell that holds one number returns in Sheets: a pure cell such as "$1,011" or "12.5%", or a bracketed number such as "(1,234)". One constant in the Sheets entry source holds it. `text`, the value today, returns the write-back's text ("$1,000", "15%", "(1,000)"), so the sign the user typed stays. `number` returns the rounded value (1000, 15, -1000) and drops the sign. `ROUND_DYNAMIC` returns text for a cell with words or a unit number under both values, because no single number stands for the cell. A text result stays text in every cell format: Sheets formulas that sum a range skip it. |

## Retired synonyms

The Example column shows the canonical term in a sentence. The Pattern column
holds the expression `scripts/check-vocab.sh` greps for in new prose. This table
is that gate's only list: a pattern added here takes effect on the next commit,
and a row with no pattern is left to the human sweep.

| Say | Not | Example | Pattern |
| --- | --- | --- | --- |
| active | selected | The active table is the one the right-click menu acts on. | `selected table` |
| step | base | An offset of -0.5 on a value with an order of magnitude of 7 gives a step of 5,000,000. | `rounding base\b\|\bbase unit\b\|nearest base\b` |
| application model | store, app store | The registry exists only in the application model; every other component reads it from there. | `\bapp store\b\|\b(state\|panel\|settings\|table) store\b` |
| bound | linked; focused (the capture's table) | The sidebar's controls read from the bound table. | `\blinked (table\|state\|cell\|range)\b\|is linked to the (table\|sidebar\|panel\|switch\|pillbox\|state)\b\|\bfocused (table\|one\|error record)\b` |
| table pillbox | pillbox (alone), table toggle, pill, toggle (the control) | Only data tables get a table pillbox. | `\btable toggle\|\bpill\b` |
| sidebar pillbox | main switch, the switch (the sidebar's on/off control for the whole table) | The sidebar pillbox shows the active table's on/off value. | `\bmain switch` |
| originals | undo state, raw values ("raw form" stays) | Restore puts the originals back into the cells. | `\bundo state` |
| never used (of code) | dead | No caller reaches the helper, so it is never used. | `\bdead code` |
| dead handle | orphaned handle | A dead handle stands for a table no longer in the page. | `\borphaned handle` |
| coupled | fused, tied | The sidebar view is coupled to the active table's table settings. | `\bfused\b\|tightly tied\|tied together\|\btied to the (table\|panel\|pillbox\|toggle\|sidebar\|switch\|state)\b` |
| benefit | "what it buys" | The gate's benefit is having a single vocabulary across every living document. | `what it buys` |
| lens preview | preview band | The lens preview shows samples from several orders of magnitude, before and after simplification. | `\bpreview band` |
| table settings | settings record | The sidebar pillbox writes to the active table's table settings, and the table re-simplifies from them. | `\bsettings record\b\|\bsettings records\b` |
| unrestorable | stuck | A table whose originals were never captured is unrestorable. | `stuck table` |
| load-time scan | proactive scan | The load-time scan finds native tables first, then elements with a grid role. | `\bproactive scan` |
| dataset | range (the set of values; "range expression" stays) | In set-aware simplification the max magnitude comes from the dataset. | `\bentire range\|\bwhole range\|\binput range` |
| form | state (of a table's raw/simplified values) | A table's form is raw or simplified. | — |
| cross-context topic | wire action | A cross-context topic carries plain-value data only. | `\bwire action` |
| sidebar | panel | Chrome opens the sidebar as a side panel. | `\bthe panel\b\|\bpanel is open\b\|\bpanel open\b\|\bpanel state\b` |
| publish | report | A view publishes an intent; the application model publishes a state change. | — |
| remarks | note (the capture's free-text field) | The placeholder text of the remarks follows the mark. | `\bmark and note\b\|\bnote form\b\|\bnote field\b\|the capture.s note` |
| detection settings | tuning block, detection tuning | The capture holds the detection settings in force at capture time. | `\btuning block\|\bdetection tuning` |
| order of magnitude | OoM; magnitude (alone; "max magnitude", "magnitude freeze", and "magnitude suffix" stay) | An offset of -1 rounds to the next smaller order of magnitude. | `\bOoMs?\b` |
| living document | living doc, design doc | Every living document uses the vocabulary. | `\bliving docs?\b\|\bdesign docs?\b` |
| direction reader | direction read | The direction reader tells a row-first grid from a column-first grid. | `\bdirection read\b` |

### Writing a pattern

Word boundaries go on the edges that need them, one edge at a time.

- Front: add `\b` when a real word ends in the pattern's first token, so "stable toggle" and "confused" do not read as findings. Leave the front open where the prefixed form is the same mistake — "unselected table" and "unstuck table" are worth catching.
- Back: add `\b` only when a longer word starting with the pattern is legitimate prose ("pillbox", "baseline", "storefront"). Leaving the back open is what catches "table toggles" and "undo states".
- Write a `|` inside a pattern as `\|`, so the pattern survives the table cell.

Four retired words carry legitimate other senses, so each is narrowed to the
phrases that can only mean the retired thing. The bare word stays legal: "base
branch", "store the value", "linked list", "tied to the academic calendar".
Coverage is partial by design, and a phrasing no pattern lists reaches the human
sweep. A pattern broad enough to fire on clean prose teaches people to stop
trusting the gate.

Rejected, each for blocking real prose this repo writes: "a base of 10" (number
bases, next to log10), "the extension store" and "publish to the store" (the
Chrome Web Store), a bare "is linked to the" (an issue linked to a PR), and a
bare "panel's" (Chrome's own side panel, whose close event this repository
describes).

Two rows have no pattern on purpose. "state" keeps senses this vocabulary
defines, among them the error state. "report" carries the capture
section's own phrasing — a capture is a bug report — so any pattern sparing
that phrase would catch almost nothing.
