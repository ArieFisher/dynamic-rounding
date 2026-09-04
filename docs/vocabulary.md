# Vocabulary

One term per concept, across every platform and every document. Use the [Retired synonyms](#retired-synonyms) table to standardize language.

## Numbers and rounding

| Term | Meaning |
| --- | --- |
| order of magnitude | Define first then abbreviate as `OoM` or `magnitude`. <br><br>`floor(log10(abs(value)))` <br>e.g. 112 and -969 have OoM=2 |
| offset | How far from a value's own magnitude to round. <br><br>offset=0 is the number's order of magnitude. <br>Negative means finer (e.g. -1 means the next smaller OoM). <br>Positive means coarser (e.g 1 means the next OoM) |
| step | The **concrete unit** a value is rounded to. <br><br>e.g. An offset of -0.5 on a magnitude-7 value gives a **step = 5,000,000;** <br>the sidebar shows it as "**nearest 5M**".  |
| set-aware | Simplified in consideration of the whole dataset. <br><br>Numbers in the **largest** OoM of a set can be simplified differently from the smaller OoM numbers. |
| max magnitude | In set-aware simplification: the largest magnitude of numbers in a set. |
| top band | In set-aware simplification: the OoMs within `num_top` of the max magnitude. The sidebar label for them is "largest numbers". By default the max magnitude alone. |
| other band | Every OoM not in the top band of magnitudes.<br><br>The sidebar label for them is "all other numbers". |
| magnitude freeze | On a virtualized grid, max magnitude is fixed based on the content in the table when simplification is first applied. Scrolling new rows into view does not shift the max magnitude, even if the new data contains bigger OoM numbers. |
| pass-through | Non-numeric input returned unchanged. |

## Parameters

| Parameter | Description |
| --- | --- |
| value | The number or the set of numbers to round. |
| dataset | In set-aware: the values the max magnitude comes from. An outside row rounds against the dataset; its own values stay out of it. The Sheets function takes it as a cell range; the Python function takes it as the `data` list. |
| offset | Magnitude adjustment (single mode). |
| offset_top | Magnitude adjustment for the top band. |
| offset_other | Magnitude adjustment for the other band. |
| num_top | How many magnitudes below max magnitude still count as the top band. |
| enforce_numeric | Python only. If `True`, raises `ValueError` for non-numeric input. |

## UI Elements

| Term | Meaning |
| --- | --- |
| pillbox | The on/off control on a data table. |
| toggle | Verb: to change a table's state. As a noun it is the act ("a toggle or apply"), never the on-table control — that control is the pillbox. The one control named "toggle" is the menu toggle below, a menu item. |
| switch | An on/off control in the sidebar. |
| menu toggle | The "Toggle readable data" item in the extension's right-click menu. Toggles the active table. |
| pulse | A brief highlight flashed over the cells a toggle or apply changed, as visual feedback. <br><br>It covers the range expression's cells; with a blank range expression it covers the whole table. |
| lens | A simplified data set with different assumptions (parameters). |
| lens control | The sidebar control (under 'advanced' as of this writing) where the user can change `offset_top` and `offset_other`. |
| lens preview | Sample values from different OoM, before and after simplification. |
| sample | One value shown in the lens preview. |

## Reading a cell

| Term | Meaning |
| --- | --- |
| classification ladder | The ordered rules that determine, cell by cell, whether to simplify and how. |
| mode | The ladder's result for one cell: `skip`, `pure`, `date`, `time`, or `extracted`. |
| pure cell | A cell whose whole text is one number. |
| extracted cell | A cell where numbers are found inside surrounding text and replaced in place, leaving the words alone. |
| exclusion | A settings-driven reason to skip a cell: first row, first column, currency, or percent. |
| quoted cell | A cell wrapped in double quotes. The application treats it as a direct quote and leaves it unsimplified. |
| ambiguous date | An all-numeric date readable two ways: 7/4/99 may be July 4 or April 7. |
| format hint | The column-level result for ambiguous dates: `month-first`, `day-first`, `mixed`, or `ambiguous`. <br><br>Mixed and ambiguous leave the column unchanged rather than assume a reading. |
| column post-pass | A second pass for any cell whose reading depends on its whole column. As of this writing, dates are the only instance. |
| granularity | How coarse a date or time becomes: <br>- dates: year, decade, century, etc.<br>- times: minute, hour, etc. |
| half-year carry | The equivalent of 'rounding' a date.<br>e.g. A date in July or later 'rounds' up to the next year. |

## Tables on the page

| Term | Meaning |
| --- | --- |
| detection | Finding the tables on a page. |
| load-time scan | The detection pass that runs when the page loads: native tables first, then elements marked with a grid or table role. Unmarked grids enter only on a right-click. |
| geometry probe | The check that qualifies an unmarked grid on right-click: five or more repeated rows, a grid or flex layout, at least one numeric cell, and first-column widths that line up. |
| accessibility artifact | A table that exists for screen readers or as a chart's fallback, hidden or drawn off-screen. Detection skips it: no registry entry, no pillbox. |
| native table | A `<table>` element. |
| grid | A table built from generic elements with ARIA roles instead of `<table>`. |
| row group | The wrapper that holds a grid's data rows — the grid analog of a table body. Row discovery uses it to identify the row shape, then takes every matching row across the whole grid; membership in a row group never keeps a row out of rounding — only the first-row and first-column exclusion defaults do that. |
| outside row | In a grid that has at least one row group: a row outside every row group. In a native table: a row in the footer section. A grid with no row group has no outside rows (its groupless rows are orphan rows). An outside row rounds like any other row, and its values stay out of the dataset: they never reach the max magnitude or the lens preview. |
| virtualized grid | A grid that keeps only its visible rows in the page, creating and destroying rows as the user scrolls. |
| vendor grid | A grid built by a known third-party library, recognized by its class names instead of the geometry probe. |
| pinned pane | A vendor grid's separate pane of leading columns that stays put while the rest scrolls. Its cells count as the table's first columns. |
| data test | At least two rows, a row with two or more cells, and at least one cell that parses as a number. A table that passes is a data table. |
| data table | A table that passes the data test.<br><br>Only data tables enter the registry, get a pillbox, and can be bound to the sidebar. |
| re-apply observer | The watcher that detects a virtualized grid redrawing its cells and applies the rounding again. |
| orphan row | A row sitting directly inside a grid with no row group. <br>Detection still finds it. <br>Orphan always means a missing parent, never a missing referent; a handle whose table is gone is a dead handle. <br><br>- Parent: the wrapper element a row normally sits inside, the row group. <br>- Referent: the thing a name or key stands for; a handle's referent is its table<br>- Handle: defined under Parts of the extension. <br><br>two failures: 'orphan' means the wrapper is missing; 'dead' means the referent is missing. |
| literal row number | A row's position counting every row in the table, rows outside a row group included (header and summary rows). <br><br>The first-row exclusion and range expressions number rows this way, so "first row" always means the table's top row. |

## Acting on a table

| Term | Meaning |
| --- | --- |
| simplify | Apply the full treatment to a table per the current settings: rounding for numbers, granularity for dates and times. |
| form | Whether a table's cells are showing raw or simplified. Values: raw, simplified. |
| apply | The sidebar gesture that pushes the current settings onto a bound table. |
| originals | The cell values stored before simplification so the table can be restored. |
| restore | Put the originals back. |
| unrestorable | Originals lost or never captured. The table cannot be restored. |
| locked | The state of a table's controls when the application will not apply simplify settings to it. <br><br>e.g. when its originals are unrestorable, changes do not apply. |
| stash | The sidebar's held copy of the settings record's on/off while the bound table is locked. <br><br>The switch's forced "on" is display only: a save made under the lock carries the stashed value, a settings-record change landing under the lock updates it, and lifting the lock puts it back on the switch. |
| bound | The sidebar's association with one table: the table its controls read from and write to. |
| active | The table user actions target. <br>The most recently right-clicked table, and, while the sidebar is open, the bound table. |
| activate | Make a table active: right-click it, or bind it while the sidebar is open. |
| range expression | An A1-style expression limiting which cells change. Blank means the whole table. |

## Parts of the extension

| Term | Meaning |
| --- | --- |
| content script | The extension code Chrome injects into each web page. |
| re-injection | Installing the content scripts into tabs that are already open. |
| sidebar | The extension's control panel page. |
| component | One part of the extension with one job and a boundary: it reaches other parts only through defined channels — topics or calls — and its insides can change without any other part changing. <br><br>e.g. The sidebar view, the controller, and the application model |
| application model | The one component that holds **application state**. Every other component reads from it or requests a change; none keeps its own copy.<br><br>- Application settings: whether the sidebar is open, the current settings, etc.<br>- Current page state: registry, the active table, etc. |
| settings record | The application model's one settings object for the page: the on/off value and every simplification option. <br><br>Every writer goes through it — the switch, a toggle on the active table (sidebar open or closed), any logic. The active table is re-simplified from its changes; the write causes the view change, never the reverse. |
| registry | The application model's list of the tables found on the current page, with the details held for each (e.g. number of columns, etc.) |
| handle | An opaque key standing for a live table on the page, like a coat-check ticket. The caller holds it and passes it back to act on that table. A **dead handle** stands for a table no longer in the page. |
| contract | An agreement between components about names and values: which settings exist, what each is called, and what its default is. A contract marks what must not change in one component alone. |
| event bus | A component that carries **messages** between components on named **topics**. <br><br>A publisher sends to a named topic; every subscriber to that topic receives it.<br><br>Publisher and subscribers hold no reference to each other. |
| topic | One named 'channel' on the event bus. Multiple components can publish to it, and multiple subscribers can read from it. |
| intent topic | A topic carrying **what the user did** ("toggle this table"). A request with no authority — the controller subscriber determines what actually changes. |
| state-change topic | A topic carrying what changed in the application model.  |
| plain-value | Data made only of text, numbers, booleans, and plain lists and objects — no live page elements, no functions. |
| snapshot | A plain-value copy of a table and its metadata:<br>- each cell's text, position, and role <br>- the table's kind and its row and column counts. <br><br>Snapshot is at one moment and it does not update itself.  |
| port | The abstractions of services used by the business logic (e.g. if the database gets changed, the abstraction keeps that out of the logic.). |
| marker class | A CSS class the extension adds to page elements it has processed so the extension can easily target that element later. |
| page attribute | A named value written onto an HTML element in the page. |

## Working terms

Terms for reviews, plans, and discussion.

| Term | Meaning |
| --- | --- |
| coupled | Two parts that cannot change independently. |
| load-bearing | Behavior depends on it. Removing a load-bearing item changes function, not only appearance. |
| guard comment | A comment that flags a hidden dependency in nearby code for future editors. |
| never used | Code no caller reaches. |
| living doc | A doc that describes the current system and must track it: the READMEs, the design doc, this vocabulary, the agent instructions. A behavior change updates the living docs it invalidates in the same branch. |
| historical record | A doc that describes a moment: sprint plans and logs, research notes, changelog entries. Never rewritten — a superseded or completed record gets a status marker pointing forward. |
| cost | What a change uses up (units may be: lines, risk, review time, runtime, etc.) |
| benefit | What the user or the maintainer gains from a change. |

## Retired synonyms

The Example column shows the canonical term in a sentence.

| Say | Not | Example |
| --- | --- | --- |
| active | selected | The active table is the one the right-click menu acts on. |
| step | base | An offset of -0.5 on a magnitude-7 value gives a step of 5,000,000. |
| application model | store, app store | The registry exists only in the application model; every other component reads it from there. |
| bound | linked | The sidebar's controls read from the bound table. |
| pillbox | table toggle, pill, toggle (the control) | Only data tables get a pillbox. |
| originals | undo state | Restore puts the originals back into the cells. |
| never used (of code) | dead | No caller reaches the helper, so it is never used. |
| dead handle | orphaned handle | A dead handle stands for a table no longer in the page. |
| coupled | fused, tied | The sidebar view is coupled to the settings record. |
| benefit | "what it buys" | The gate's benefit is having a single vocabulary across every living doc. |
| lens preview | preview band | The lens preview shows samples from several magnitudes, before and after simplification. |
| settings record | record | The switch writes to the settings record, and the active table re-simplifies from it. |
| unrestorable | stuck | A table whose originals were never captured is unrestorable. |
| load-time scan | proactive scan | The load-time scan finds native tables first, then elements with a grid role. |
| dataset | range (the set of values; "range expression" stays) | In set-aware simplification the max magnitude comes from the dataset. |
| form | state (of a table's raw/simplified values) | A table's form is raw or simplified. |
| originals | raw values ("raw form" stays) | Restore puts the originals back into the cells. |
