# Vocabulary

One term per concept, across every platform and every document. Use the [Retired synonyms](#retired-synonyms) table to standardize language.

## Numbers and rounding

| Term               | Meaning                                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| order of magnitude | Define first then abbreviate as `OoM` or `magnitude`.  <br><br>`floor(log10(abs(value)))`   <br>e.g. 112 and -969 have OoM=2                                                                                                               |
| offset             | How far from a value's own magnitude to round. <br><br>offset=0 is the number's order of magnitude.  <br>Negative means finer (e.g. -1 means the next smaller OoM).  <br>Positive means coarser (e.g 1 means the next OoM)                |
| step               | The **concrete unit** a value is rounded to.   <br><br>e.g. An offset of -0.5 on a magnitude-7 value gives a **step = 5,000,000;** <br>the sidebar shows it as "**nearest 5M**".  <br>                                                    |
| set-aware          | Simplified in consideration of the whole dataset.  <br><br>Gives the option to simplify numbers differently if they are the **largest** OoM in a set or the smaller OoM numbers.<br>                                                      |
| max magnitude      | In set-aware simplification: the largest magnitude of numbers in a set.                                                                                                                                                                   |
| top band           | In set-aware simplification: the OoMs within `num_top` of the max magnitude.  The sidebar calls them "largest numbers".  By default the max magnitude alone.<br>                                     |
| other band         | Every OoM not in the top band of magnitudes.<br><br>The sidebar calls them "all other numbers".                                                                                                                                            |
| magnitude freeze   | On a virtualized grid, max magnitude is fixed based on the content in the table when simplification is first applied.  Scrolling new rows into view does not shift the max magnitude, even if the new data contains bigger OoM numbers.<br> |
| pass-through       | Non-numeric input returned unchanged.                                                                                                                                                                                                     |

## Parameters

| Parameter       | Description                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| value           | The number or the set of numbers to round.                                     |
| range           | In set-aware: The range of values for context (i.e. to find a 'max magnitude') |
| offset          | Magnitude adjustment (single mode).                                            |
| offset_top      | Magnitude adjustment for the top band.                                         |
| offset_other    | Magnitude adjustment for the other band.                                       |
| num_top         | How many magnitudes below max magnitude still count as the top band.           |
| enforce_numeric | Python only. If `True`, raises `ValueError` for non-numeric input.             |

## UI Elements
| Term         | Meaning                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| table toggle | An on/off control on a data table.                                                                                   |
| switch       | An on/off control in the sidebar.<br><br>                                                                            |
| menu toggle  | The "Toggle readable data" item in the extension's right-click menu. Toggles the active table.                       |
| pulse        | A brief highlight flashed over the cells a toggle or apply touched, as visual feedback.  <br><br>It covers the range expression's cells; a blank range expression pulses the whole table.<br> |
| lens         | A simplified data set with different assumptions (parameters).                                                       |
| lens control | The sidebar control (under 'advanced' as of this writing) where the user can change `offset_top` and `offset_other`. |
| lens preview | Shows sample values from different OoM before and after simplification.                                              |
| sample       | One value shown in the lens preview.                                                                                 |


## Reading a cell

| Term                  | Meaning                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| classification ladder | The ordered rules that decide, cell by cell, whether to simplify and how.                                                                                                |
| mode                  | The ladder's verdict for one cell: `skip`, `pure`, `date`, `time`, or `extracted`.                                                                                       |
| pure cell             | A cell whose whole text is one number.                                                                                                                                   |
| extracted cell        | A cell where numbers are found inside surrounding text and replaced in place, leaving the words alone.                                                                   |
| exclusion             | A settings-driven reason to skip a cell: first row, first column, currency, or percent.                                                                                  |
| quoted cell           | A cell wrapped in double quotes. This application reads it as a direct quote and does not simplify it.<br>                                                   |
| ambiguous date        | An all-numeric date readable two ways: 7/4/99 may be July 4 or April 7.                                                                                                  |
| format hint           | The column-level verdict on ambiguous dates: `month-first`, `day-first`, `mixed`, or `ambiguous`.   <br><br>Mixed and ambiguous refuse the column rather than guess.<br> |
| column post-pass      | A second pass that settles any cell whose reading depends on evidence from its whole column. As of this writing, dates are the only instance.                            |
| granularity           | How coarse a date or time becomes: <br>- dates: year, decade, century, etc.<br>- times: minute, hour, etc.                                                               |
| half-year carry       | The equivalent of 'rounding' a date.<br>e.g. A date in July or later 'rounds' up to the next year.                                                                       |

## Tables on the page

| Term              | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| detection         | Finding the tables on a page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| native table      | A `<table>` element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| grid              | A table built from generic elements with ARIA roles instead of `<table>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| virtualized grid  | A grid that keeps only its visible rows in the page, creating and destroying rows as the user scrolls.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| data table        | A table becomes a '**data table**' when it has  at least two rows, a row with two or more cells, and at least one cell that parses as a number.<br><br>Only data tables enter the registry, get a toggle, and can be bound to the sidebar.<br>                                                                                                                                                                                                                                                                                                   |
| re-apply observer | The watcher that notices a virtualized grid redrawing its cells and applies the rounding again.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| orphan row        | A row sitting directly inside a grid with no row-group wrapper. <br>Detection still finds it.  <br>Orphan always means a missing parent, never a missing referent; a handle whose table is gone is a dead handle.  <br><br>- Parent: the wrapper element a row normally sits inside, the row group. <br>- Referent: the thing a name or key stands for; a handle's referent is its table<br>- Handle:  defined under Parts of the extension. <br><br>two failures: 'orphan' means the wrapper is missing; 'dead' means the referent is missing. |

## Acting on a table

| Term             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| simplify         | Apply the full treatment to a table per the current settings: rounding for numbers, granularity for dates and times.                                                                                                                                                                                                                                                                                                               |
| apply            | The sidebar gesture that pushes the current settings onto a bound table.                                                                                                                                                                                                                                                                                                                                                           |
| originals        | The cell values stored before simplification so the table can be restored.                                                                                                                                                                                                                                                                                                                                                         |
| restore          | Put the originals back.                                                                                                                                                                                                                                                                                                                                                                                                            |
| unrestorable     | Originals lost or never captured. The table cannot go back.                                                                                                                                                                                                                                                                                                                                                                        |
| locked           | The state of a table's controls when the application will refuse to apply simplify settings to it.  <br><br>e.g. when its originals are unrestorable, changes  are refused.<br>                                                                                                                                                                                                                                                    |
| stash            | The sidebar's held copy of the settings record's on/off while the bound table is locked.  <br><br>The switch's forced "on" is display only: a save made under the lock carries the stashed value, a settings-record change landing under the lock updates it, and lifting the lock puts it back on the switch.<br>                                                                                                                |
| bound            | The sidebar's association with one table: the table its controls read from and write to.                                                                                                                                                                                                                                                                                                                                           |
| active           | The table user actions target. <br>The most recently right-clicked table, and, while the sidebar is open, the bound table.                                                                                                                                                                                                                                                                                                         |
| range expression | An A1-style expression limiting which cells are touched. Blank means the whole table.                                                                                                                                                                                                                                                                                                                                              |



## Parts of the extension

| Term               | Meaning                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| content script     | The extension code Chrome injects into each web page.                                                                                                                                                                                                                                         |
| re-injection       | Installing the content scripts into tabs that are already open.                                                                                                                                                                                                                               |
| sidebar            | The extension's control panel page.                                                                                                                                                                                                                                                           |
| component          | One part of the extension with one job and a boundary: it talks to other parts only through defined channels — topics or calls — and its insides can change without the others knowing. <br><br>e.g. The sidebar view, the controller, and the application model                        |
| application model  | The one component that owns **application state**.  Every other component reads from it or asks it to change; none keeps its own copy.<br><br>- Application settings:  whether the sidebar is open, the current settings, etc.<br>- Current page state:  registry, the active table, etc.<br> |
| settings record    | The application model's one settings object for the page: the on/off value and every simplification option.  <br><br>Every writer goes through it — the switch, a toggle on the active table (sidebar open or closed), any logic.  The active table is re-simplified from its changes; the write causes the view change, never the reverse.<br>                                              |
| registry           | The application model's list of the tables found on the current page, with what it knows about each (e.g. number of columns, etc.)                                                                                                                                                            |
| handle             | An opaque key standing for a live table on the page, like a coat-check ticket. The caller holds it and passes it back to act on that table. A **dead handle** names a table the page has removed.                                                                                             |
| contract           | An agreement between components about names and values: which settings exist, what each is called, and what its default is.   A contract marks what must not change in one component alone.<br>                                                                                               |
| event bus          | A component that carries **messages** between components on named **topics**. <br><br>A publisher sends to a named topic; every subscriber to that topic receives it.<br><br>Publisher and subscribers do not know of each other.                                                             |
| topic              | One named 'channel' on the event bus.  Multiple components can publish to it, and multiple subscribers can read from it.                                                                                                                                                                      |
| intent topic       | A topic carrying **what the user did** ("toggle this table"). A request with no authority — the controller subscriber decides what actually changes.                                                                                                                                          |
| state-change topic | A topic carrying what changed in the application model. <br>                                                                                                                                                                                                                                  |
| plain-value        | Data made only of text, numbers, booleans, and plain lists and objects — no  live page elements, no functions.                                                                                                                                                                                |
| snapshot           | A plain-value copy of a table and its metadata:<br>- each cell's text, position, and role <br>- the table's kind and its row and column counts. <br><br>Snapshot is at one moment and it does not update itself. <br>                                                                         |
| port               | The abstractions of services used by the business logic (e.g. if the database gets changed, the abstraction hides that from the logic.).<br>                                                                                                                                                  |
| marker class       | A CSS class the extension adds to page elements it has processed so the extension can easily target that element later.<br>                                                                                                                                                                   |
| page attribute     | A named value written onto an HTML element in the page.                                                                                                                                                                                                                                       |

## Working terms

Terms for reviews, plans, and discussion.

| Term          | Meaning                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| coupled       | Two parts that cannot change independently.                                                 |
| load-bearing  | Behavior depends on it. Removing a load-bearing item changes function, not only appearance. |
| guard comment | A comment that warns future editors of a hidden dependency in nearby code.                  |
| never used    | Code no caller reaches.                                                                     |
| cost          | What a change spends (units may be: lines, risk, review time, runtime, etc.)                |
| benefit       | What a change earns the user or the maintainer.                                             |


## Retired synonyms

| Say                  | Not              |
| -------------------- | ---------------- |
| active               | selected         |
| step                 | base             |
| application model    | store, app store |
| bound                | linked           |
| table toggle         | pill             |
| originals            | undo state       |
| never used (of code) | dead             |
| dead handle          | orphaned handle  |
| coupled              | fused, tied      |
| benefit              | "what it buys"   |
| lens preview         | preview band     |
| settings record      | record           |
| unrestorable         | stuck            |
