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
| toast | The on-page notice for the newest extension error: one element at the page's bottom right holding the log row's text, removed by a click or after five seconds. A second row replaces the text and restarts the delay, so a warning that repeats shows one toast. |

## Reading a cell

| Term | Meaning |
| --- | --- |
| classification ladder | The ordered rules that determine, cell by cell, whether to simplify and how. |
| mode | The ladder's result for one cell: `skip`, `pure`, `date`, `time`, or `extracted`. |
| pure cell | A cell whose whole text is one number. |
| extracted cell | A cell where numbers are found inside surrounding text and replaced in place, leaving the words alone. |
| unit number | A cell whose whole text is one number with a magnitude suffix after it, a listed currency code before or after it, or both: "4.91tn", "CAD$45.67", "1,234 USD". Its digits round and the suffix and code stay. It rounds on every table kind, whatever the sidebar's "words" setting holds. The suffixes and codes are listed once, in the number parser. |
| stacked cell | A grid cell whose text pieces each hold one whole number or unit number, or nothing but whitespace, a currency sign, a percent sign, or a listed currency code: "125" above "126". Each number rounds in its own piece. A piece that reads as a date or a time makes the cell not stacked. |
| split number | A number whose characters sit across two text pieces: "4." in one and "91" in the next. It stays unchanged. |
| allow list | A list of the characters or words that may touch a number in an extracted cell, so an identifier such as "DT1234" stays unchanged. Not built yet; until it exists, extracted cells stay unchanged on grids. |
| text piece | A run of plain text inside a cell with no HTML tag inside it. A cell may hold several: `<span>$</span><span>337.91</span>` holds two. |
| flat text | The join of a cell's text pieces in page order. A position in the flat text maps to exactly one text piece. |
| rendered text | A cell's text as the browser shows it: runs of spaces and line breaks in the markup collapse to one space, the ends are trimmed, and hidden text is left out. A native table classifies a cell on its rendered text. On a pretty-printed page it is shorter than the flat text, so a position converts between the two before a patch. |
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
| load-time scan | The detection pass that runs when the page loads: native tables first, then elements marked with a grid or table role. A marked grid the scan missed enters on a right-click, which runs the nomination step from the clicked element's chain root. An unmarked grid still enters only on a right-click, through the geometry probe. |
| geometry probe | The check that qualifies an unmarked grid on right-click: five or more repeated rows, a grid or flex layout, at least one numeric cell, and first-column widths that line up. |
| accessibility artifact | A table that exists for screen readers or as a chart's fallback, hidden or drawn off-screen. Detection skips it: no registry entry, no pillbox. |
| native table | A `<table>` element. |
| grid | A table built from generic elements with ARIA roles instead of `<table>`. |
| row group | The wrapper that holds a grid's data rows — the grid analog of a table body. Row discovery uses it to identify the row shape, then takes every matching row across the whole grid; membership in a row group never keeps a row out of rounding — only the first-row and first-column exclusion defaults do that. |
| outside row | In a grid that has at least one row group: a row outside every row group. In a native table: a row in the footer section. A grid with no row group has no outside rows (its groupless rows are orphan rows). An outside row rounds like any other row, and its values stay out of the dataset: they never reach the max magnitude or the lens preview. |
| virtualized grid | A grid that keeps only its visible rows in the page, creating and destroying rows as the user scrolls. |
| vendor grid | A grid built by a known third-party library, recognized by its class names instead of the geometry probe. |
| qualifying element | An element carrying a grid or table role that passes the two guards the nomination step applies: it is not a native table, and it holds no native table other than accessibility artifacts. The data test has not run on it yet. |
| chain root | The outermost qualifying element of a nest: a qualifying element with no qualifying ancestor. |
| containment chain | The qualifying elements nested under a chain root, the root included, that pass the data test, grouped by nesting depth. An element's depth is the count of qualifying ancestors from it up to and including the chain root; the root sits at depth 0. |
| nesting depth | The depth in a containment chain at which the extension registers one table. The detection settings hold it as `nestingDepth`, 1 today. |
| pinned pane | A vendor grid's separate pane of leading columns that stays put while the rest scrolls. Whether its cells count as the table's first columns follows the configured nesting depth: at depth 0 the wrapper registers and the pinned cells are the table's first columns; at the shipped depth 1 the scrolling pane registers alone and the pinned pane stays outside the table. |
| data test | At least two rows, a row with two or more cells, and at least one cell that parses as a number, found within one budget of 1000 cell reads. The read walks every row and cell in document order, on native tables and grids alike, and stops at the first cell that parses as a number. A table that passes is a data table. <br><br>On a native table, the test and rounding share one cell read: the cell's rendered text, falling back to its raw text when the rendered text is empty. A hidden cell rounds like any other cell, and its raw text counts toward the test. A hidden fragment inside a visible cell stays out: that cell's rendered text is not empty, so the fallback never runs. |
| data table | A table that passes the data test.<br><br>Only data tables enter the registry, get a pillbox, and can be bound to the sidebar. |
| pending table | A chain root whose containment chain is empty: no qualifying element of its nest passes the data test, so the nest registers nothing yet. One subtree observer watches the chain root, and a change to the subtree runs the nomination step from the root again, one run per burst of changes inside the grid redraw delay. A re-test that registers an element ends the pending table, and so does a re-test that finds the nest already registered or its configured depth crowded. A re-test that finds the chain still empty counts against the re-test cap, and reaching the cap drops the observer. <br><br>This is what registers a grid that arrives before its rows. |
| re-apply observer | The watcher that detects a virtualized grid redrawing its cells and applies the rounding again. |
| orphan row | A row sitting directly inside a grid with no row group. <br>Detection still finds it. <br>Orphan always means a missing parent, never a missing referent; a handle whose table is gone is a dead handle. <br><br>- Parent: the wrapper element a row normally sits inside, the row group. <br>- Referent: the thing a name or key stands for; a handle's referent is its table<br>- Handle: defined under Parts of the extension. <br><br>two failures: 'orphan' means the wrapper is missing; 'dead' means the referent is missing. |
| literal row number | A row's position counting every row in the table, rows outside a row group included (header and summary rows). <br><br>The first-row exclusion and range expressions number rows this way, so "first row" always means the table's top row. |

## Acting on a table

| Term | Meaning |
| --- | --- |
| simplify | Apply the full treatment to a table per the current settings: rounding for numbers, granularity for dates and times. |
| form | Whether a table's cells are showing raw or simplified. Values: raw, simplified. |
| apply | The sidebar gesture that pushes the current settings onto a bound table. |
| patch | One replacement inside a text piece: the position in the flat text, the characters to replace, and the new characters. Every cell, on a native table or a grid, changes through patches alone, so every text node the page drew stays in place. |
| patch writer | The write step that applies patches, each inside one text piece. A patch whose characters are not at its position does not land, and the cell stays unchanged. |
| placement step | The step between classification and the patch writer: it checks a cell's classified result against the cell's text pieces. A result whose changed characters sit in one text piece stands. Otherwise a grid cell takes the stacked cell test, and a native table cell stays unchanged. |
| originals | The cell values stored before simplification so the table can be restored. |
| restore | Put the originals back. |
| unrestorable | Originals lost or never captured. The table cannot be restored. |
| locked | The state of a table's controls when the application will not apply simplify settings to it. <br><br>e.g. when its originals are unrestorable, changes do not apply. |
| stash | The sidebar's held copy of the settings record's on/off while the bound table is locked. <br><br>The switch's forced "on" is display only: a save made under the lock carries the stashed value, a settings-record change landing under the lock updates it, and lifting the lock puts it back on the switch. |
| bound | The sidebar's association with one table: the table its controls read from and write to. |
| active | The table user actions target. <br>The most recently right-clicked table, or the most recent table whose pillbox was pressed. The sidebar binds the active table. |
| activate | Make a table active: right-click it, or press its pillbox. |
| range expression | An A1-style expression limiting which cells change. Blank means the whole table. <br><br>It states rows and columns by position, so it describes the table it was written for. A press that moves the active table therefore clears it. |

## Parts of the extension

| Term | Meaning |
| --- | --- |
| context | One running, isolated instance of extension code, with its own memory. No context reads another context's variables and no context calls another context's functions; messages are the only route in or out. <br><br>Three kinds run: the **content script**, the **sidebar**, and the **service worker**. The running count is larger than three — the content script runs a separate context in every tab. |
| tab | One browser tab. The content script runs one context in each tab, so the application state of a page belongs to that tab alone and reaches no other tab. The service worker is common to every tab. |
| bound tab | The tab the sidebar was opened for. The sidebar serves that tab alone: it acts on reports from that tab and drops reports from every other one, and it closes itself when that tab stops being the tab in front. A separate fact from the tab number the service worker holds, which answers which tab to close the sidebar for. |
| content script | The extension code Chrome injects into each web page. One context per tab. |
| re-injection | Installing the content scripts into tabs that are already open. |
| sidebar | The extension's control panel page. Its own context. |
| service worker | The extension's background context. One instance for the whole browser, common to every tab. It creates the right-click menu items, opens the sidebar, and records which tab the sidebar was opened for. Chrome shuts it down after an idle period and starts it again on the next message, so a restart begins with its variables empty. |
| component | One part of the extension with one job and a boundary: it reaches other parts only through defined channels — topics or calls — and its insides can change without any other part changing. <br><br>e.g. The sidebar view, the controller, and the application model |
| view | A component that draws application state on a screen and publishes a user gesture as an intent topic. <br><br>e.g. the pillbox, the sidebar's controls <br><br>A view holds no application state of record. The sidebar is the standing exception: its controls carry working values until a publish, and it stashes the on/off value while a table is locked. |
| controller | The one component that subscribes to the intent topics and turns each one into a write to the application model or a simplification of a table. |
| application model | The one component that holds **application state**. Every other component reads from it or requests a change; none keeps its own copy.<br><br>- Application settings: the settings record.<br>- Current page state: registry, the active table, etc. |
| settings record | The application model's one settings object for the page: the on/off value and every simplification option. <br><br>Every writer goes through it — the switch, a toggle on the active table (sidebar open or closed), any logic. The active table is re-simplified from its changes; the write causes the view change, never the reverse. |
| registry | The application model's list of the tables found on the current page, with the details held for each: the cell originals, the form, the last simplification options, a virtualized grid's frozen max magnitude, and the shape fingerprint. |
| shape fingerprint | The column count, and the header row's cell texts where the table has a header row, recorded for a table when it enters the registry. Every action on a registered table compares the table's current shape against it first. A mismatch means the page replaced the table's content with a different shape, so the controller discards the entry and the table registers fresh. The column count is the widest row's cell count. A grid has a header row where it groups its data rows and its first row is an outside row; a native table has one where its first row sits in the head section or holds header cells alone. A table with no header row carries the column count alone, because the first row of a grid that groups nothing is a data row that every scroll redraws. The row count stays out for the same reason: a virtualized grid changes its drawn row count on every scroll. |
| handle | An opaque key standing for a live table on the page, like a coat-check ticket. The caller holds it and passes it back to act on that table. A **dead handle** stands for a table no longer in the page. |
| contract | An agreement between components about names and values: which settings exist, what each is called, and what its default is. A contract marks what must not change in one component alone. |
| detection settings | The one object holding every value that shapes whether an element counts as a table or a grid, and the two lookup lists detection reads, beside the settings contract in the configuration file. The detection layer and the controller read it as a bare global with no local fallback copy, so a change is one edit in one place and a missing object fails at load. The pillbox auto-collapse delay stays in the pillbox view: the view alone reads it, and it shapes nothing detection finds. The capture prints the detection settings in force at capture time. |
| event bus | A component that carries **messages** between components on named **topics**, inside one **context** and across contexts. <br><br>A publisher sends to a named topic; every subscriber to that topic receives it.<br><br>Publisher and subscribers hold no reference to each other.<br><br>Delivery inside the publishing context is immediate: the publishing line continues once every subscriber finishes. A topic carried inside one context can carry a live page element; a topic that crosses contexts carries **plain-value** data only. |
| topic | One named 'channel' on the event bus. Multiple components can publish to it, and multiple subscribers can read from it. <br><br>Every topic is recorded on one shared list, with its family and its **route**. Publishing a name that is not on the list fails at that moment. |
| publish | Send a message on a named topic. |
| publisher | The component that publishes on a topic. It holds no reference to any subscriber. |
| subscriber | A component registered to receive one topic. A topic has zero or more. |
| request topic | A **topic** whose one **responder** returns a **plain-value** answer to the publisher. The absence of a responder reaches the publisher immediately, with no waiting period. |
| responder | The one function a **context** registers to answer a **request topic**. Exactly one per request topic; a second registration fails at that moment. |
| route | A **topic**'s record of which carrier reaches its audience: the extension's pages, one tab's content script, or neither, meaning the publishing **context** alone. A route states carrier choice, never subscriber identity. |
| cross-context topic | A **topic** whose **route** reaches another **context**. The event bus carries it, over Chrome's messaging. <br><br>Same shape as any topic: the publisher supplies a name rather than a destination, and holds no reference to any subscriber. Two differences:<br>- It carries **plain-value** data only, never a live page element.<br>- Delivery to the other context is not immediate. A **request topic**'s answer arrives later; a one-way publish returns without waiting.<br><br>It reaches the publishing context's own subscribers first, then the other context. No topic pairs that way today: a context that both publishes and receives one topic would run its own handler on the way out. |
| intent topic | A topic carrying **what the user did** ("toggle this table"). A request with no authority — the controller subscriber determines what actually changes. |
| state-change topic | A topic carrying what changed in the application model.  |
| plain-value | Data made only of text, numbers, booleans, and plain lists and objects — no live page elements, no functions. |
| snapshot | A plain-value copy of a table and its metadata:<br>- each cell's text, position, and role <br>- the table's kind and its row and column counts. <br><br>Snapshot is at one moment and it does not update itself.  |
| port | The abstractions of services used by the business logic (e.g. if the database gets changed, the abstraction keeps that out of the logic.). |
| adapter | A component that presents one shape of thing through a shared interface, so a caller works against the interface and never against the shape. The design doc groups the extension's adapters into a layer of the same name. <br><br>e.g. the native-table adapter and the grid adapter both present rows and cells, over markup with nothing in common |
| marker class | A CSS class the extension adds to page elements it has processed so the extension can easily target that element later. |
| page attribute | A named value written onto an HTML element in the page. |
| extension error | A warn or error row the extension records in its log buffer. Every failure the extension records today is a warn row, and Chrome's extension error page lists warn output beside errors. An uncaught exception never reaches the log buffer and is not one. |
| error state | The application model's record of extension errors on the current page: whether one has been recorded, how many, and the last 50 rows with their stack traces. The controller writes it from the row listener, the toast view redraws from its state-change topic, and the capture carries it. It never clears within a page's life; a reload starts clean. |
| toast view | The view that draws the toast. It subscribes to the error state's state-change topic and never logs, because a row it recorded would publish back to it. |
| row listener | A function the log buffer calls with a copy of each log row as it lands. The controller registers one to write warn and error rows into the error state. Not a subscriber: the log buffer loads before the event bus and the application model and reaches neither. |
| stack trace | The list of calls active when a log row was recorded, starting at the caller of the log call. Warn and error rows carry one; debug and info rows carry none. Cut at the same bound as row text. |

## Capture

| Term | Meaning |
| --- | --- |
| capture | A bug report written as one self-contained HTML file: the mark and remarks, a likeness of the sidebar, a screenshot of the bound tab, the bound table's rendering, both contexts' log rows, the fixture seed, and the capture state as machine-readable JSON. The file allows no scripts and no remote fetches, so it is safe to attach anywhere. |
| mark | The verdict a capture carries: looks-right, not-sure, or looks-wrong, shown as "Looks right", "Not sure", "Looks wrong". One of three buttons in the sidebar's capture section; pressing one opens the remarks form. The token ends the capture file name. |
| remarks | The capture's one free-text field, labeled Remarks. Its preview text follows the mark: a looks-wrong capture prompts for expected, observed, and cause (if known); a not-sure capture prompts for suggestions, questions, or remarks. Blank remarks save as blank. |
| note | A reader hint in the capture file: a sentence or two in italics, one size below the table text, opening with "Note: ", stating a limit of what the file shows (the hover reveal, unrecorded cell spans, missing service worker rows, the seed's escaping). One helper renders every note, so the prefix and the style live in one place. An absence is never a note: it renders as an absence sentence, highlighted. Lens preview lines are content, never notes. |
| finish | The explicit gesture that writes the capture file — the "Save capture" button. Nothing saves without that press. |
| capture file name | `dr-capture-YYYYMMDD-<source>-HHMMSS-<mark>.html`. The source is the page's host with `www.` dropped; for a page opened from disk it is the page file's name without its extension; it is `no-source` when the page has no address or the address does not parse. The mark token closes the name, so a folder listing shows each file's verdict without opening the file. |
| capture state | The plain-value record embedded in the capture: full registry detail for every table, the settings record, the detection settings in force at capture time, the lens preview samples, the sidebar view state, the log rows with their stack traces, the error state, the screenshot record (taken, format, chars; never the image), the page and extension metadata, and the fixture seed. Carries a one-integer format version so a later tool can read old captures. |
| screenshot | The image of the bound tab's visible area the sidebar takes at finish, as JPEG, carried in the capture's Screenshot section between the sidebar likeness and the bound table. The take runs through chrome.tabs.captureVisibleTab under the activeTab grant the right-click menu item gives for the tab; a sidebar opened from Chrome's own side-panel control has no grant. The capture state holds a record alone (taken, format, chars), never the image data, so the JSON island stays small. A failed take records its reason, the save goes ahead, and the section shows that absence. |
| log buffer | A per-context list of the last 50 log rows the extension recorded, with a count of rows dropped past the cap. A warn or error row carries its stack trace. Each row also goes to the console, so devtools output is unchanged, and to every row listener. |
| state pull | The one request the sidebar sends for the page-side half of a capture. A failed state pull still saves the capture: the sidebar half is present, and the page half renders as an absence. |
| fixture seed | The bound table's markup as it stood at capture time — form included, so a seed taken from a simplified table rebuilds in simplified form. Carried verbatim in the capture state, and escaped for reading in the visible file, so a regression fixture can be rebuilt from it. |
| capture marker | The page attribute the saved capture carries on its document element. The content script stands down on any page carrying it, so a capture shows what was captured, never what the extension would do to it. |

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

The Example column shows the canonical term in a sentence. The Pattern column
holds the expression `scripts/check-vocab.sh` greps for in new prose. This table
is that gate's only list: a pattern added here takes effect on the next commit,
and a row with no pattern is left to the human sweep.

| Say | Not | Example | Pattern |
| --- | --- | --- | --- |
| active | selected | The active table is the one the right-click menu acts on. | `selected table` |
| step | base | An offset of -0.5 on a magnitude-7 value gives a step of 5,000,000. | `rounding base\b\|\bbase unit\b\|nearest base\b` |
| application model | store, app store | The registry exists only in the application model; every other component reads it from there. | `\bapp store\b\|\b(state\|panel\|settings\|table) store\b` |
| bound | linked; focused (the capture's table) | The sidebar's controls read from the bound table. | `\blinked (table\|state\|cell\|range)\b\|is linked to the (table\|sidebar\|panel\|switch\|pillbox\|state)\b\|\bfocused (table\|one\|error record)\b` |
| pillbox | table toggle, pill, toggle (the control) | Only data tables get a pillbox. | `\btable toggle\|\bpill\b` |
| originals | undo state, raw values ("raw form" stays) | Restore puts the originals back into the cells. | `\bundo state` |
| never used (of code) | dead | No caller reaches the helper, so it is never used. | `\bdead code` |
| dead handle | orphaned handle | A dead handle stands for a table no longer in the page. | `\borphaned handle` |
| coupled | fused, tied | The sidebar view is coupled to the settings record. | `\bfused\b\|tightly tied\|tied together\|\btied to the (table\|panel\|pillbox\|toggle\|sidebar\|switch\|state)\b` |
| benefit | "what it buys" | The gate's benefit is having a single vocabulary across every living doc. | `what it buys` |
| lens preview | preview band | The lens preview shows samples from several magnitudes, before and after simplification. | `\bpreview band` |
| settings record | record | The switch writes to the settings record, and the active table re-simplifies from it. | — |
| unrestorable | stuck | A table whose originals were never captured is unrestorable. | `stuck table` |
| load-time scan | proactive scan | The load-time scan finds native tables first, then elements with a grid role. | `\bproactive scan` |
| dataset | range (the set of values; "range expression" stays) | In set-aware simplification the max magnitude comes from the dataset. | `\bentire range\|\bwhole range\|\binput range` |
| form | state (of a table's raw/simplified values) | A table's form is raw or simplified. | — |
| cross-context topic | wire action | A cross-context topic carries plain-value data only. | `\bwire action` |
| sidebar | panel | Chrome opens the sidebar as a side panel. | `\bthe panel\b\|\bpanel is open\b\|\bpanel open\b\|\bpanel state\b` |
| publish | report | A view publishes an intent; the application model publishes a state change. | — |
| remarks | note (the capture's free-text field) | The preview text of the remarks follows the mark. | `\bmark and note\b\|\bnote form\b\|\bnote field\b\|the capture.s note` |
| detection settings | tuning block, detection tuning | The capture prints the detection settings in force at capture time. | `\btuning block\|\bdetection tuning` |

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

Three rows have no pattern on purpose. "record" reads the same in its retired
sense and in "historical record", a term these conventions lean on. "state"
keeps senses this vocabulary defines, among them a locked table's state.
"report" carries the capture section's own phrasing — a capture is a bug report
— so any pattern sparing that phrase would catch almost nothing.
