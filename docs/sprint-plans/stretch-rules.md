# Sprint Plan: Each value in a cell takes its own rule

**Status:** APPROVED
**Created:** 2026-11-17 (first draft); replanned 2026-11-25
**Base branch:** main (fc45886)
**Slug:** stretch-rules

## Context

Today the extension gives each cell one type: skip, date, time, or number. A cell holding any date is a date cell, so its numbers never round ("Paid $12,345 on November 09 2026" becomes "Paid $12,345 on 2026"). A date cell also takes one patch over its whole text, so a link or italic piece anywhere in the cell keeps every date in it as written. No document states a product reason for either rule. Both come from how dates were first added in May 2026.

Outcome: every number, date, and time in a cell is its own stretch, with its own switch, patch, and text-piece check. The cell's single type goes away.

This second draft replaces the 2026-11-17 first draft (commit f187257), which is stale:
- Its last-hour time sprint is already on `main`: `roundClockTime` (`chrome-extension/lib/dr-number/dates.js:279`) rounds a last-hour time down. The sprint is dropped.
- Its link step is already on `main`: dates and times inside links and code are held (`readDatesOutsideMarkup`, `chrome-extension/lib/dr-simplify/ladder.js:51`). No separate link filter exists any more.
- `decisionToLegacyInfo` is gone, and its reader list was out of date. Section 1 holds the current list.
- Its overlap order would change single-value results. Under it, the identifier scan claims "07" in "2020-07-21" and an ISO date stops changing (checked: `getIdentifierMaskedRanges("2020-07-21")` returns 5 to 7).

## 1. Repo Survey

- **Languages.** JavaScript for the Chrome extension, the Google Sheets library, and the Claude Code plugin; Python for the separate `python/` package, which reads no dates or times.
- **Pattern.** Pure library layers (number, simplify, table) under one content script. Both table kinds reach the ladder through one cell object, so every change here reaches native tables and grids together.
- **Shared libraries.** `scripts/build-sheets.js` copies the number library, the ladder, and the table step into `js/round_dynamic.js` (Sheets) and `claude-code-plugin/hooks/library.js` (plugin). Sheets runs with dates and times off and both currency and percent switches on.
- **Where the change lands** (all checked on `main` at fc45886):
  - The ladder, `chrome-extension/lib/dr-simplify/ladder.js` (`classifyCell`). It returns one `mode` per cell. Its early returns give a whole-cell ISO date-time, any cell holding a date, and a whole-cell clock time their mode before the number readers run.
  - The date step, `chrome-extension/lib/dr-number/dates.js` (`roundDateText`, loop at `:250-262`).
  - The placement step, `chrome-extension/lib/dr-simplify/placement.js` (`placeClassification`, `:63`). It checks each number for one text piece. A date or time passes through.
  - The table step, `chrome-extension/lib/dr-simplify/table.js` (`classifiedCellPatches`, `:68`). A date or time cell takes one patch over its trimmed text.
  - The content script's date-and-time piece check, `chrome-extension/content.js` (`cellPatches`, `isSplitDateOrTime`, `:831-841`), and the two split counts (`:273-279`, `:865`, `:884`).
- **Readers of `mode`, `reason`, and `pending`** (13, checked with a search over `chrome-extension`, `js/src`, and `claude-code-plugin/hooks`):
  - Column post-pass: `resolveAmbiguousDates` (`table.js:34`), `isAmbiguousDateClassification` (`table.js:27`), `resolveAmbiguousDateClassification` (`ladder.js:235`).
  - `datasetMaxMagnitude` (`table.js:51`) and the lens preview pool `numericPreviewCells` (`content.js:600`).
  - The data test `holdsRoundableCell` (`chrome-extension/lib/dr-table/detect.js:263`).
  - `placeClassification` and `classifiedCellPatches`.
  - `classifyTableCell` (`chrome-extension/lib/dr-table/classify.js:78`), through its "pieces-changed" result.
  - The Sheets input step (`js/src/entry.js:100`, `:124`).
  - The plugin text table step reads none.

## 2. Repo Conventions

- **Version files.** `chrome-extension/manifest.json`, `claude-code-plugin/.claude-plugin/plugin.json`, `js/src/entry.js` (its `[VERSION]` line, carried into `js/round_dynamic.js`), `python/pyproject.toml`. `scripts/bump-versions.py` holds the table.
- **Version bump policy.** `merge-workflow`. The bump workflow bumps after each merge; sprint branches never touch version files. A `minor` sprint gets the `minor` label before merge.
- **Test command.** `node chrome-extension/tests.js && node js/tests.js && node js/doc-tests.js && node claude-code-plugin/tests.js && node scripts/build-sheets.js --check`
- **Gate command.** `scripts/check-files.sh --staged && scripts/check-vocab.sh --staged` (the pre-commit hook runs both).
- **Build command.** `node scripts/build-sheets.js`, then commit `js/round_dynamic.js` and `claude-code-plugin/hooks/library.js`.
- **Branch naming.** Change-type prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`, `plan/`.
- **Dependent policy.** `after-merge`. CI runs only on pull requests based on `main`.
- **Base branch writes.** `pull-request`. Never edit `main`.
- **Commit convention.** Conventional Commits.
- **PR rules.** `AGENTS.md`, "Pull requests": the diff test, `## Tested` and `## Manual tests`, a Product section, no attribution.

## 3. Design

### 3.1 A cell holds a list of stretches

**What.** `classifyCell` returns `{ stretches, split? }`, the stretches in text order, positions in the classified text:

```
classification = { stretches: Stretch[], split?: true }   // text order; a skipped cell holds []
Stretch = { kind: 'number', start, end, num }
        | { kind: 'date', start, end, ...the date reader's fields }
        | { kind: 'time', start, end, ...the time reader's fields }
```

`mode`, `reason`, and `pending` go. None has a production reader beyond the 13 in section 1; "pending" becomes "a date stretch is ambiguous". A held value is never stored; the ladder still covers its characters so no other reader takes them.

**Why.** An extracted cell already holds a list of numbers, each with its own patch and piece check. Widening that list so an entry may be a date or a time reaches the outcome without a second path (Simple components; Minimize design-time coupling; AGENTS.md "Collapse a path before opening a second one").

**Alternatives.** A date cell that also rounds its times fixes one capture and adds a second time rule. Splitting the text at each date and running the ladder on each part repeats the cell gate and the identifier test, which read the whole cell, so a part cut from a phone number reads wrong.

### 3.2 Reader order (sprint 3)

A reader earlier in the list keeps the characters it claims. A stretch that overlaps a link or code range is held, through one loop that widens today's `readDatesOutsideMarkup` to every reader.

1. Cell gate: range expression, first row, first column, quoted cell. Currency and percent leave the gate.
2. ISO date-time, whole cell or inside words, "T" or space separator: one date stretch and one time stretch. It runs before the date reader, which cannot see a date followed by "T".
3. `findDates` on the text with ISO spans blanked. An impossible date is held over its own characters (decision 9). An ambiguous date the column cannot read holds every date stretch in the cell (decision 5).
4. Clock times, whole cell or inside words, on text with superscripts blanked; AM or PM inside the stretch. A time followed by a decimal fraction is not a time. An impossible time is held. Decision 3's exception applies.
5. Only in a cell with no date or time stretch: today's whole-cell number shapes in today's order (superscript, identifier shape, pure number, unit number).
6. The number reader, masking markup, quotes, identifiers, superscripts, era years, and every date and time span, changed or held. Masks hold numbers only, as today, so a date is never masked.
7. A number is held when a currency sign or code, or a percent sign, touches its digits and the switch is off (decision 12).

Dates and times are read before the masks, so every cell holding one value gives today's result; step 5 runs today's number path unchanged.

### 3.3 ISO separator (sprint 3)

When Times is on, the time stretch covers the separator through the time zone and writes " HH:MM". When Times is off, the date stretch covers the date and separator and writes the rounded date and a space. One `separator` field on the date stretch records it.

## 4. Sprint Plan

| Wave | Sprint | Goal | Depends on |
| --- | --- | --- | --- |
| 1 | `date-placement` | Each date takes its own patch and text-piece check. | none |
| 2 | `stretch-list` | The ladder returns a list of stretches; no output changes. | `date-placement` |
| 3 | `mixed-cell-stretches` | Every value in a cell takes its own rule. | `stretch-list` |

**Why a chain.** Sprint 1 goes first because after sprint 2 every date carries its own bounds, which would split date patches and stop sprint 2 being a pure refactor. Sprints 2 and 3 stay apart because AGENTS.md puts a change with no behavior change in its own `refactor/` pull request, so the existing suite proves it. Each sprint starts only after the one before it merges.

## 5. Sprint Definitions

### Sprint 1: `date-placement`

- **Branch:** `fix/date-placement`
- **Goal:** Each date in a cell takes its own patch and its own text-piece check.
- **Scope:**
  - `dates.js`: move the body of the `roundDateText` loop (`:250-262`) into `roundDate(date, granularity)`, which returns one date's new text. `roundDateText` loses its last production reader and goes. The number tests keep their expected strings through one helper in the test file.
  - `table.js` `classifiedCellPatches` (`:68`): a date cell gives one patch per changed date, at `lead + date.start`. A time cell keeps its one patch; it holds one time.
  - `placement.js` `placeClassification` (`:63`): keep only the dates that sit in one text piece; a time cell's trimmed text gets the same check. A cell left with no date skips. Placement runs before the column post-pass, so decision 10 follows with no extra code.
  - `content.js`: remove `cellPatches` and `isSplitDateOrTime` (`:831-841`), and merge the two split counts into one count of split values (decision 11, `:273-279`, `:865`, `:884`).
  - Rebuild `js/round_dynamic.js` and `claude-code-plugin/hooks/library.js`.
  - Docs: vocabulary "placement step" and "left as written" (`docs:` commit); `docs/design.md` placement text. Test page section 25 gains the two split-date rows and the footnote-link row.
- **Out of scope:** a second kind of value in a cell; any change to which cells hold a date.
- **Acceptance criteria:**
  - A synthetic sentence with a link piece and an italic piece, holding "December 1965" and "February 1966" each in one piece, becomes "In 1965, … in 1966." on both table kinds.
  - A date split across two tags beside a whole date at month: the split date stays, the whole date becomes "2024-04", and the debug row counts one split value.
  - A cell with leading spaces patches at the right position.
  - The data test returns false for a table whose only date is split.
  - Sheets, doc-example, and plugin suites pass with no edits.
- **Dependencies:** none.
- **Version bump:** patch.
- **Complexity:** M.
- **Dev notes:**
  - Output changes only in cells with a split date or time. The per-date patches add up to the old whole-cell patch on every other cell, since dates never overlap and patches apply from the end of the text. Sheets and the plugin give identical output.
  - One common case changes on Wikipedia: "Jun 2020" followed by a footnote link now becomes "2020 [1]". The test page's footnote-link row states it.
  - Date bounds index the trimmed text; placement and patches count in the classified text, so add the leading whitespace length.
  - Regression fixtures are synthetic. The capture in `docs/private` never enters the repository.

### Sprint 2: `stretch-list`

- **Branch:** `refactor/stretch-list`
- **Goal:** The ladder returns a list of stretches (section 3.1) in place of one mode, with every result unchanged.
- **Scope:**
  - `classifyCell` returns the shape in section 3.1. The early returns stay, so a cell still holds one kind.
  - Move the 13 readers in section 1:
    - Column post-pass: `resolveAmbiguousDates` maps over date stretches; `isAmbiguousDateClassification` and `resolveAmbiguousDateClassification` fold into it.
    - `datasetMaxMagnitude` and `numericPreviewCells`: number stretches only.
    - `holdsRoundableCell`: any stretch.
    - `placeClassification`: one filter over every stretch.
    - `classifiedCellPatches`: one loop, one branch per kind.
    - `classifyTableCell`: "pieces-changed" returns an empty list.
    - Sheets input step: the number-cell classification becomes one number stretch; `textResult` checks for a number stretch.
    - Plugin text table step: no change.
  - Docs (`docs:` commit): add "stretch" to the vocabulary; retire "mode"; restate "classification", "classified cell", "pure cell", "extracted cell". `docs/design.md:27`, `docs/capability-map.md`.
- **Out of scope:** any change to what a cell becomes.
- **Acceptance criteria:**
  - No expected output changes in any suite or the build check.
  - Assertions on `mode` or `reason` become assertions on stretches or on output (about 50 in the ladder tests, 15 in detection, 8 in the table step, 4 in the rounding pass).
  - No reader of `mode`, `reason`, or `pending` is left in `chrome-extension/`, `js/src/`, or `claude-code-plugin/hooks/`.
  - `js/round_dynamic.js` and `claude-code-plugin/hooks/library.js` match the build.
- **Dependencies:** `date-placement`.
- **Version bump:** patch.
- **Complexity:** L.
- **Dev notes:** Every skip reason a debug row prints keeps its text; if a debug row reads `reason`, derive the text from the stretch list or the placement result, not from a stored field.

### Sprint 3: `mixed-cell-stretches`

- **Branch:** `feature/mixed-cell-stretches`
- **Goal:** Every number, date, and time in a cell takes its own rule and switch.
- **Scope:**
  - The ladder runs the readers in section 3.2's order, in place of the early returns. ISO separator as in section 3.3.
  - Remove, with their exports and tests: `readTimeCell`, the whole-cell time and ISO patterns, `roundTimeText` (replaced by one per-stretch time step on `roundClockTime`), `getClockTimeMaskedRanges`, `parseISODateTime`, `isTimeLike`, `isDateTimeLike`, `isDateLike`, the early returns, and the currency and percent branches of `getExclusionReason`.
  - `js/round-dynamic-cases.json` gains mixed rows so the Sheets, extension, and Python suites run them.
  - Docs: vocabulary "clock time", "masked range", "exclusion", "impossible date", "granularity" (`docs:` commit); `docs/design.md:29`, `:53`; `docs/capability-map.md`; `chrome-extension/README.md`; `js/README.md` and `js/tests-googlesheets-tab.md` (a number beside a date now rounds in Sheets); the plugin test prompt's table gains a cell with a date beside a number.
  - Test page: section 4 (times inside words, ISO), section 2 (currency and percent), sections 9 and 35, and a new section "Cells that mix dates, times, and numbers" unless section 34a already holds those shapes.
- **Out of scope:** the weekday left beside a simplified written date; the quarter's year that reads as a number; the Outlook table swap; Python dates and times (section 7).
- **Acceptance criteria:** every row of this table, dates at year, times at hour, currency and percent switches on, unless stated. "Today" was checked on `main` (fc45886).

  | Input (settings) | Today | After |
  | --- | --- | --- |
  | Paid $12,345 on November 09 2026 | Paid $12,345 on 2026 | Paid $10,000 on 2026 |
  | same, currency off | unchanged | Paid $12,345 on 2026 |
  | same, Dates off | unchanged | Paid $10,000 on November 09 2026 |
  | Monday, November 09 2026 at 19:54 UTC | Monday, 2026 at 19:54 UTC | Monday, 2026 at 20:00 UTC |
  | Meeting at 19:54 | unchanged | Meeting at 20:00 |
  | 19:54 — 12,345 units | 19:54 — 10,000 units | 20:00 — 10,000 units |
  | 12:45 - 1:30 PM | unchanged | 12:45 - 2:00 PM |
  | 2026-11-09T19:54:00Z | 2026-11-09 20:00 | 2026 20:00, plus every row of the ISO results table (section 6) |
  | Deployed 2026-11-09T19:54:00Z, 12,345 users | Deployed 2,000-10-9T19:54:00Z, 10,000 users | Deployed 2026 20:00, 10,000 users |
  | same, in Sheets | damaged as above | Deployed 2026-11-09T19:54:00Z, 10,000 users |
  | 03/04/2026: 12,345, column unreadable | unchanged | 03/04/2026: 10,000 |
  | 1999-13-45 and Jun 2020, 12,345 | unchanged | 1999-13-45 and 2020, 10,000 |
  | Sold 5% on Jun 2020, percent off | unchanged | Sold 5% on 2020 |
  | Revenue (USD) 12,345, currency off | unchanged | Revenue (USD) 10,000 |
  | Lap 3:43.13; Meeting at 24:00 | unchanged | unchanged |
  | Jun 2020 - Dec 2020; 2020-07-21 at month; 02134; $1,234 | as today | as today |

- **Dependencies:** `stretch-list`.
- **Version bump:** minor (a visible change on pages, in Sheets, and in the plugin).
- **Complexity:** L.
- **Dev notes:**
  - Changes a reader sees beyond the named examples, each following from a decision; the pull request states them:
    - With the default settings (Dates on, Times off), an ISO date-time now changes its date: "2026-11-09T19:54:00Z" becomes "2026 19:54:00Z" (decision 4). The plugin uses the same defaults.
    - A number beside a date now counts toward the table's largest value, on all three platforms, and joins the lens preview pool (decision 2).
    - In Sheets, where dates and times are off, a number beside a date now rounds (decision 2).
    - A duration inside words, such as "Duration 1:45:30", now rounds with Times on, as a whole-cell duration already does (decision 3).
  - Kept as today: a date inside a quoted span inside words still changes; a race time such as "Lap 3:43.13" stays as written; a quoted cell, an identifier shape, the first row and column, and the range expression still hold the whole cell.
  - `findDates` finds no date in "2026-11-09T19:54" because its date end test rejects the letter T; the ISO reader (step 2) runs first and blanks its span.

## 6. Decisions and Open Questions

### Carried, made 2026-11-10 and 2026-11-17

1. Each date takes its own patch and its own text-piece check. A split date stays as written; the cell's other values still change.
2. A number in a cell holding a date rounds. Each value follows its own switch.
3. Every clock time follows the Times switch, inside words too. Exception: a clock time with no AM or PM, in a cell holding an AM or PM clock time, stays as written ("12:45 - 1:30 PM" becomes "12:45 - 2:00 PM").
4. An ISO date-time splits into a date stretch (Dates switch) and a time stretch (Times switch), as a whole cell or inside words. The separator becomes a space when either stretch changes.
5. An unresolved ambiguous date holds back that cell's date stretches. The cell's numbers and times still change.
6. The currency and percent switches hold back only a number stretch.
7. A split date stops counting in the data test, as a split number does.

ISO date-time results, "2026-11-09T19:54:00Z" unless the row names another value:

| Dates | Times | Result |
| --- | --- | --- |
| year | hour | 2026 20:00 |
| year | off | 2026 19:54:00Z |
| month | off | 2026-11 19:54:00Z |
| off | hour | 2026-11-09 20:00 |
| off | off | 2026-11-09T19:54:00Z |
| month | hour | 2026-11 20:00 |
| quarter | minute | 2026 Q4 19:54 |
| decade | hour | 2020 20:00 |
| year | hour, value 2026-11-09T23:45 | 2026 23:00 |
| year | off, value 2026-11-09 19:54 | 2026 19:54 |

### Made 2026-11-25

8. Times are in scope. The damaged timestamp inside words is fixed by sprint 3.
9. An impossible date holds only its own characters. The cell's other values still change.
10. A split ambiguous date takes no part in its column's month-first or day-first reading.
11. The debug row's "split number" and "split date or time" counts merge into one count of split values.
12. A currency sign or code, or a percent sign, holds a number only when it touches the digits: "$12,345", "12,345 USD", "5%". "Revenue (USD) 12,345" rounds with the currency switch off.

### Open

None.

## 7. Out of Scope (Separate Sprint-Stack)

- The weekday left beside a simplified written date ("Monday, 2026").
- "Q1 2020 12,345" becomes "Q1 2,000 10,000" today; the year in a quarter reads as a number. Candidate issue, drafted for the product manager's approval.
- The Outlook table swap.
- Python reads no dates or times.

## Simplicity

1. **Size.** Removed: the content script's piece check, `mode`, `reason`, `pending`, the leading-whitespace arithmetic, the early returns, two whole-cell patterns, `roundDateText`, `roundTimeText`, `readTimeCell`, `getClockTimeMaskedRanges`, four helpers only tests read, and the cell-wide currency and percent exclusions. Added, each for a decision: `roundDate` (1), the date branch in placement (1), the ISO reader inside words (4, 8), the AM or PM exception (3), the touching-sign test (12), the `separator` field (4), one hold loop for every reader (2). Expected net: smaller (an estimate; each pull request measures it).
2. **Duplicates.** Two piece checks merge in sprint 1. The date loop and the per-date step become one function in sprint 1. In sprint 3: the whole-cell and inside-words clock-time patterns, the two ISO entry points, and the two markup holds.
3. **Removals.** No new setting. Held values and the gate are not stored. `separator` is the one new field, and decision 4's outputs need it.
4. **Orphans.** Each removal lands in the sprint that takes away its last reader, with its export and its tests.
5. **Bounds.** No new walk over the page, wait, or retry. Each reader makes one pass over one cell's text. Each round of the hold loop blanks at least one stretch, so the loop ends within the cell's stretch count. Existing caps still bound the cells: the data test's 1,000-cell budget and the pass's cell cap.
6. **Current behavior.** Every "Today" cell in sprint 3's table was run on `main` (fc45886) through the generated plugin library. The identifier claim, the race-time claim, and the quoted-date claim were run again on 2026-11-25.

## Verification

Each sprint runs the test command in section 2. Sprint 2 must pass with no changed expected output. Sprints 1 and 3 report every changed expected value in the pull request. Plugin changes also run `claude plugin validate --strict claude-code-plugin` and `claude plugin test claude-code-plugin`. Manual tests name the test page sections above; the product manager runs them on native tables and grids. Each pull request gets an independent code-reviewer pass before merge. Before each sprint, the developer re-checks the line references and "Today" results against current `main` and reports any that no longer hold before writing code.

## Decisions Log

- 2026-11-17: Initial draft generated by the sprint-plan skill (f187257).
- 2026-11-25: Replanned against `main` at fc45886. The last-hour sprint and the link step were dropped as already on `main`. Decisions 8 to 12 made; the plan approved by the product manager.
