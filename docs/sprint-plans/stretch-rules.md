# Sprint Plan: Each stretch of a cell takes its own rule

**Status:** PROPOSED-DRAFT
**Created:** 2026-11-17
**Base branch:** main (59ea31c)
**Slug:** stretch-rules

## Context

Two defects share one cause: the extension simplifies a cell as one unit.

1. **A date cell takes one patch over its whole text.** When links, italics, or footnote markers split the text into text pieces, no single piece holds that patch, and the cell stays as written. The trigger is a Wikipedia note on a film ban: "In December 1965, … banned the film *Goldfinger*, after … [275] The ban was lifted … in February 1966." Each date sits in one text piece; the whole text does not.
2. **A cell takes one rule.** "Monday, November 09 2026 at 19:54 UTC" takes the date rule alone, so the Times switch leaves 19:54 as written. The same cause leaves the amount in "Paid $12,345 on November 09 2026" unrounded.

This plan replaces closed plan PR #611 (commit c38100e). It starts from current `main` and reuses that plan's six product decisions (section 6).

## 1. Repo Survey

- **Languages.** JavaScript for the Chrome extension and the Google Sheets library; Python for the separate `python/` package, which reads no dates or times (checked: no granularity code in `python/`).
- **Where the change lands.** Three pure files and one content script:
  - The classification ladder, `chrome-extension/lib/dr-simplify/ladder.js` (`classifyCell`). It returns one mode per cell: `skip`, `date`, `time`, or `extracted`. Its early returns give a whole-cell ISO date-time, any cell holding a date, and a whole-cell clock time their mode before the number readers run.
  - The placement step, `lib/dr-simplify/placement.js` (`placeDecision`). It checks each number of an extracted cell for one text piece. A date or time passes through.
  - The table step, `lib/dr-simplify/table.js` (`tablePatches`). A date or time cell takes one patch over its trimmed text; an extracted cell takes one patch per changed number.
  - The content script's date-and-time piece check, `content.js` (`cellPatches`, `isSplitDateOrTime`). It drops a date or time patch that no single text piece holds.
  - The link filter, `lib/dr-table/classify.js` (`finalizeExtractedDecision`, `filterLinkMatches`). It runs on numbers alone.
- **Readers of `mode`** (checked with a search on `main`): the placement step, the link filter, the table step (`decisionToLegacyInfo`, the column post-pass, the max magnitude, the patches), the data test (`holdsRoundableCell` in `lib/dr-table/detect.js`), the lens preview pool (`numericPreviewCells` in `content.js`), the content script's piece check, and the Sheets entry source (`js/src/entry.js`, `textResult`).
- **Shared with Sheets.** The Sheets build (`scripts/build-sheets.js`) copies the number library, the ladder, and the table step into `js/round_dynamic.js`. Sheets runs with dates and times off and both currency and percent switches on.
- **Readers already in place.** `findDates` returns every date with its bounds. `clockTimeRanges` finds every clock time inside text. `parseISODateTime` reads a whole-cell ISO date-time only.
- **Pattern.** Pure library layers (number, simplify, table) under one content script. Both table kinds reach the ladder through one cell object, so every change here reaches native tables and grids together.

## 2. Repo Conventions

- **Version files.** `chrome-extension/manifest.json`, `js/src/entry.js` (its `[VERSION]` line, carried into `js/round_dynamic.js`), `python/pyproject.toml`. `scripts/bump-versions.py` holds the table.
- **Version bump policy.** `merge-workflow`. The bump workflow bumps after each merge; sprint branches never touch version files.
- **Test command.** `node chrome-extension/tests.js && node js/tests.js && node js/doc-tests.js && node scripts/build-sheets.js --check`
- **Gate command.** `scripts/check-files.sh --staged && scripts/check-vocab.sh --staged` (the pre-commit hook runs both).
- **Build command.** `node scripts/build-sheets.js`, then commit `js/round_dynamic.js`.
- **Branch naming.** Change-type prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`, `plan/`.
- **Dependent policy.** `after-merge`. CI runs only on pull requests based on `main`.
- **Base branch writes.** `pull-request`. Never edit `main`.
- **Commit convention.** Conventional Commits.
- **PR rules.** `AGENTS.md`, "Pull requests": the diff test, `## Tested` and `## Manual tests`, a Product section, no attribution.

## 3. Design

### 3.1 Designs compared

| Design | Fixes problem 1 | Fixes problem 2 | Fixes "Paid $12,345 on November 09 2026" | New rules |
| --- | --- | --- | --- | --- |
| A. Each stretch takes its own rule, switch, and piece check (the candidate) | yes | yes | yes | none: the number, date, and time rules each reach every stretch of their kind |
| B. A date cell also simplifies its clock times | no | yes | no | a second time rule, inside the date rule |
| C. Per-date patches only | yes | no | no | none |
| D. Split the text at each date and time, then run the existing ladder on each part | yes | yes | yes | none, but each part repeats the cell gate and the identifier test, which reads the whole cell |

**Recommendation: A.** C is A's first step and ships on its own as sprint 1. B fixes one capture and adds a second rule for times, which "Collapse a path before opening a second one" rules out. D reaches A's result with more moving parts: a part cut from the middle of a phone number or a quoted span reads wrong.

A is built by widening the existing number path, not by adding a parallel one. An extracted cell already holds a list of numbers, each with its own patch and its own piece check. A widens that list so an entry may be a number, a date, or a time (Simple components; Minimize design-time coupling).

### 3.2 A cell holds stretches

**What.** `classifyCell` returns a cell gate and a list of stretches in text order.

- **The cell gate** keeps the rules that read the whole cell: the range expression, the first row, the first column, and the quoted cell.
- **A stretch** holds its kind (number, date, or time), its bounds in the cell's text, its reader's payload, and a reason when it stays as written (its switch is off, an ambiguous date the column post-pass leaves unresolved, a currency or percent sign under its switch, a split stretch, a link).
- **Protected text** stays a mask, as today: an identifier shape, a quoted span, a superscript span, an era-marked year, an impossible date. Masked characters join no stretch.

**Why.** Every protection the mode gives works per stretch. The mode applies each protection to the whole cell, so a mixed cell loses every rule but one.

### 3.3 Overlap order

When two readers claim the same characters, the earlier reader in this list keeps them: quoted span, superscript span, identifier shape, ISO date-time, date, clock time, era-marked year, number. This order is the ladder's order today, so a cell that is one date, one time, one identifier, or one number gives the same result as today (Minimize design-time coupling).

### 3.4 One placement rule for every stretch

**What.** The placement step checks every stretch that may change, number, date, or time alike: it must sit in one text piece and outside a link. A stretch that fails stays as written; the cell's other stretches still change. The content script's separate date-and-time check goes.

**Why.** Today two piece checks exist, one for numbers and one for dates and times, and only the number check runs per value. One check in one place removes problem 1 (Simple interactions).

**Implications (decided 2026-11-17).**
- A date or time inside a link stays as written, as a number inside a link does. A cell that is one linked date stops simplifying.
- A split date stops counting in the data test, as a split number does today.
- The "split date or time" count in the settings change row now counts a split date whose granularity would leave it unchanged, as the "split number" count already counts a split number whose rounding would leave it unchanged.

### 3.5 Every clock time follows the Times switch (decided 2026-11-17)

A clock time inside words follows the Times switch, as a lone clock time does. This replaces the PR #581 rule that a clock time inside text stays as written.

One exception: a clock time with no AM or PM, in a cell that holds an AM or PM clock time elsewhere, stays as written, because its half of the day is unknown. Without the exception, "12:45 - 1:30 PM" would read 12:45 on the 24-hour clock and become "13:00 - 2:00 PM". This is the same rule as an unresolved ambiguous date: a value whose reading is unsure stays as written.

## 4. Sprint Plan

| Wave | Sprint | Goal | Depends on |
| --- | --- | --- | --- |
| 1 | `date-placement` | Each date takes its own patch, and every date and time takes the placement step's piece check and link rule. Fixes problem 1. | none |
| 1 | `last-hour-times` | A time in the last hour of the clock simplifies down to the hour. | none |
| 2 | `stretch-list` | The ladder returns a cell gate and a list of stretches; every result stays the same. | `date-placement` |
| 3 | `mixed-cell-stretches` | Every stretch in a cell takes its own rule and switch. Fixes problem 2. | `stretch-list`, `last-hour-times` |

**Why this order.**
- `date-placement` ships problem 1 on its own, small. It also removes the contradiction in plan #611, whose no-behavior-change sprint gave each date its own patch, which changes the trigger cell. After `date-placement` merges, per-date patches are today's behavior, so `stretch-list` can be a true refactor.
- `stretch-list` exists because `AGENTS.md` puts a merge that changes no behavior in its own `refactor/` pull request ahead of the change that needs it, so the existing suite proves the reshaping.
- `last-hour-times` touches only the hour arithmetic, so it runs beside `date-placement`. `mixed-cell-stretches` lists it as a dependency because its acceptance rows for times beside dates read the last-hour rule; under `after-merge` it merges in wave 1, so the edge costs no wait.
- Splitting `mixed-cell-stretches` by kind (dates first, times later) would build one rule for one kind and leave the other to catch up, which "Collapse a path before opening a second one" rules out.

## 5. Sprint Definitions

### Sprint 1: `date-placement`

- **Branch:** `fix/date-placement`
- **Goal:** Each date in a cell takes its own patch, and every date and time takes the placement step's piece check and link rule, the same rules a number takes.
- **Scope:**
  - The table step builds one patch per changed date: the date's bounds in the cell's text, replaced by that date at the granularity. A time cell keeps its one patch over its trimmed text; it holds one time.
  - Split the per-date step out of `roundDateText` so the table step and `roundDateText` call one function.
  - The placement step checks each date's bounds and a time cell's trimmed text for one text piece. A split date leaves the decision and the cell's other dates still change; a decision left with no date skips. Placement marks which kind split, so the settings change row keeps its two counts and their text.
  - The link filter runs over dates and times as it runs over numbers.
  - Remove the content script's `cellPatches` and `isSplitDateOrTime`.
  - Docs: `docs/vocabulary.md` ("placement step", "left as written", "granularity" where it states that every date in a cell changes) in its own `docs:` commit; `docs/design.md`'s placement description; `chrome-extension/README.md` if it states the date piece rule.
  - Test page `docs/test-pages/test-tables-1.html`: section 25 gains rows for a sentence whose two dates each sit in one text piece between a link and an italic piece (both dates simplify), and a date split across two tags beside a whole date (the split date stays, the whole date simplifies). Section 8 gains a row for a linked date (stays as written).
- **Out of scope:** a second kind of stretch in a cell; any change to which cells hold a date.
- **Acceptance criteria:**
  - A synthetic copy of the trigger cell (invented sentence, a link piece and an italic piece, two month-and-year dates each in one piece) simplifies both dates at year on both table kinds, and the settings change row counts no split date.
  - A cell with one date split across two tags and one whole date simplifies the whole date and keeps the split one; the row counts one split date or time.
  - A cell that is one linked date stays as written; a date inside a link inside a sentence stays while the sentence's other date simplifies.
  - The data test returns false for a table whose only date sits across two pieces.
  - The Sheets suite and the doc-example suite pass with no changed expected value.
- **Dependencies:** none.
- **Version bump:** patch.
- **Complexity:** M.
- **Dev notes:**
  - Date bounds index the trimmed text; placement and patches count in the classified text, so add the leading whitespace length.
  - An ambiguous date that splits leaves the column post-pass's readings. That is intended: a split date never changes, so it should not settle its column.
  - Regression fixtures are synthetic. The capture in `docs/private` never enters the repository.

### Sprint 2: `last-hour-times`

- **Branch:** `fix/last-hour-times`
- **Goal:** At hour granularity, a time in the last hour of the clock simplifies down to the hour, so no time moves past midnight or past the date beside it.
- **Scope:**
  - In `roundTimeText`, an hour of 23, an hour of 11 with PM, or an hour of 11 with no AM or PM simplifies to ":00" whatever its minutes. Every other hour simplifies as today.
  - `roundISODateTime` applies the same rule in place of its clamp to 23:59.
  - Docs that state hour granularity: `docs/vocabulary.md` "granularity" if needed, `docs/design.md`, `chrome-extension/README.md`, and the sidebar help card if it states it.
  - Test page section 4 gains rows for 23:45, 11:45 PM, and 11:45, each with its expected result.
- **Out of scope:** clock times inside text (sprint 4); minute granularity.
- **Acceptance criteria:**
  - 23:45 becomes 23:00, 11:45 PM becomes 11:00 PM, 11:45 becomes 11:00, and "2026-11-09 23:45" becomes "2026-11-09 23:00".
  - 22:45 still becomes 23:00, and 10:45 PM still becomes 11:00 PM.
  - 11:45 AM becomes 12:00 PM.
- **Dependencies:** none.
- **Version bump:** patch.
- **Complexity:** S.
- **Dev notes:** The rule reads the hour as written, before any 12-hour conversion, so 11 PM and 23 meet one test. Sheets keeps times off, so nothing changes in Sheets.

### Sprint 3: `stretch-list`

- **Branch:** `refactor/stretch-list`
- **Goal:** Replace the one mode per cell with a cell gate and a list of stretches, with every result unchanged.
- **Scope:**
  - `classifyCell` returns `{ gate, stretches }`. Today's modes map one to one: a pure cell, a unit number, or a bracketed number gives one number stretch; an extracted cell gives its number stretches; a date cell gives its date stretches; a time cell gives one time stretch. The early returns stay, so no cell yet holds two kinds.
  - Move every reader of `mode` (section 1) onto the stretch list: placement, the link filter, the table step, the data test, the lens preview pool, and the Sheets entry source. Remove `decisionToLegacyInfo`.
  - Add "stretch" to `docs/vocabulary.md` in its own `docs:` commit. Retire "mode" in its favor, and redefine "pure cell" and "extracted cell" as stretch lists.
  - Update `docs/design.md`'s description of the ladder.
- **Out of scope:** any change to what a cell becomes.
- **Acceptance criteria:**
  - All four suites pass with no change to any expected value. Test edits only read the new shape.
  - No reader of `mode` or `decisionToLegacyInfo` remains in `chrome-extension/` or `js/src/`.
  - Every skip reason a debug row prints keeps its text.
  - `js/round_dynamic.js` matches the build.
- **Dependencies:** `date-placement`.
- **Version bump:** patch.
- **Complexity:** L.
- **Dev notes:**
  - Keep the ambiguous-date pending flag on each date stretch, so the column post-pass reads it as before.
  - The whole-link test in the ladder and the link filter now cover the same cells for numbers. Check whether the link filter alone gives every current result; if it does, remove the whole-link test in this sprint, since the existing suite proves it.

### Sprint 4: `mixed-cell-stretches`

- **Branch:** `feature/mixed-cell-stretches`
- **Goal:** The ladder marks every date, time, and number stretch in a cell, so each takes its own rule and switch.
- **Scope:**
  - The ladder runs every reader over the cell's text with the overlap order in section 3.3, in place of the early returns.
  - A clock time inside text becomes a time stretch, its AM or PM inside the stretch, and follows the Times switch. The exception in section 3.5 applies.
  - A number in a cell that holds a date or time rounds.
  - Decisions 1, 2, 3, and 6 in section 6 apply. The results table under decision 6 becomes test rows. `getExclusionReason` loses its currency and percent branches; the number reader holds back a number whose number span carries the sign or code.
  - Docs:
    - `docs/vocabulary.md` "clock time" (section 3.5), "exclusion" (currency and percent move to the number stretch), in a `docs:` commit.
    - `docs/design.md` and `chrome-extension/README.md` describe mixed cells.
    - `js/README.md` and `js/tests-googlesheets-tab.md` state the Sheets change: dates and times are off in Sheets, so a date's digits stay protected and a number beside the date now rounds.
    - Test page: a new section, "Cells that mix dates, times, and numbers", since no section holds such a cell. One table holds a written date with a clock time, a date with a currency amount, a date with a plain number, a clock time inside words, a clock-time range with a shared PM, and an ISO date-time with a number. Each row states its expected result. Section 4's text about the cell with two clock times changes to match section 3.5.
- **Out of scope:**
  - The weekday left behind when a written date simplifies ("Monday, 2026"). It happens on `main` today; a separate issue covers it if wanted.
  - The Outlook table swap that loses a table's originals.
  - Python, which reads no dates or times.
- **Acceptance criteria:**
  - With dates at year and times at hour:
    - "Monday, November 09 2026 at 19:54 UTC" becomes "Monday, 2026 at 20:00 UTC".
    - "Paid $12,345 on November 09 2026" rounds the amount and shows "2026".
    - "Meeting at 19:54" becomes "Meeting at 20:00".
    - "12:45 - 1:30 PM" keeps 12:45 and shows "2:00 PM".
    - "2026-11-09T19:54:00Z" becomes "2026 20:00".
  - With the currency switch off, "Paid $12,345 on November 09 2026" keeps the amount and shows "2026".
  - With an unresolved ambiguous date, "03/04/2026: 12,345" keeps the date and rounds the number.
  - A cell that is one date, one clock time, one identifier, or one number gives the same result as on `main`. ISO date-time results change under decision 6, and the pull request lists each changed expected value.
  - The max magnitude counts a number that shares a cell with a date.
  - `js/round-dynamic-cases.json` gains rows for the mixed shapes, so the Sheets and extension suites run them.
- **Dependencies:** `stretch-list`, `last-hour-times`.
- **Version bump:** minor (a visible change on pages and in Sheets).
- **Complexity:** L.
- **Dev notes:**
  - `findDates` finds no date in "2026-11-09T19:54" because its date end test rejects the letter T. The ISO date-time reader marks both stretches itself from `parseISODateTime`'s groups, widened to a search inside text.
  - An impossible date stays a mask, so its digits never round as numbers.
  - `isTimeLike` and `isDateTimeLike` lose their ladder callers; remove each one left with no reader.

## Simplicity

1. **Size.** The code after sprint 4 is expected to be smaller than today (an estimate; the sprints measure it).
   - *Removed:* the mode field and `decisionToLegacyInfo`; the per-mode branches in placement, the link filter, the table step, the data test, the lens preview pool, and the Sheets entry source; the content script's date-and-time piece check; the ladder's early returns for a date, a time, and an ISO date-time; the cell-level currency and percent exclusions.
   - *Added:* an overlap pass that merges the readers' stretches (requirement: every rule reaches every part of a cell); a time reader for times inside text with bounds (requirement: every clock time follows Times); the per-date step out of `roundDateText` (requirement: each date takes its own patch); the last-hour rule (decision 4).
2. **Duplicates.** Two piece checks merge in sprint 1. Two link checks (the whole-link test and the link filter) are checked for a merge in sprint 3. The whole-cell and in-text time patterns already share one clock-time source.
3. **Removals.** The plan adds no setting, no stored field, and no switch. The stretch reason replaces the cell reason and keeps its strings.
4. **Orphans.** `cellPatches` and `isSplitDateOrTime` go in sprint 1; `decisionToLegacyInfo` in sprint 3; `isTimeLike` and `isDateTimeLike` in sprint 4 if no reader is left.
5. **Bounds.** No new walk over page content, no new wait, no retry. Each reader makes one regular-expression pass over one cell's text, so a cell holds at most as many stretches as characters. The existing caps bound the cells: the data test's cell budget (1,000) and the re-apply pass's cell cap.
6. **Current behavior.** Checked on `main` at 59ea31c by running the real pass on mock native tables and grids (dates at year, times at hour where on). Both table kinds gave the same results.
   - "Monday, November 09 2026 at 19:54 UTC" becomes "Monday, 2026 at 19:54 UTC" with Times on, and stays as written with dates off and Times on.
   - A sentence with an italic piece and a link piece, holding "December 1965" and "February 1966" each in one piece, stays as written; the settings change row counts one split date or time. The same text in one piece becomes "In 1965, … in 1966."
   - "Paid $12,345 on November 09 2026" becomes "Paid $12,345 on 2026". With the currency switch off the whole cell stays as written.
   - "19:54 — 12,345 units" becomes "19:54 — 10,000 units". "Meeting at 19:54" stays as written.
   - A cell that is one linked "June 21, 2020" becomes "2020"; "Sold 12,345 units" with the number in a link stays as written.
   - "2026-11-09T19:54:00Z" becomes "2026-11-09 20:00"; "23:45" becomes "00:00".
   - The data test returns true for a table whose only value is a date split across two pieces, and false for one whose only value is a split number.

## 6. Decisions and Open Questions

### Carried from plan #611 (decided 2026-11-10)

1. **ISO date-time splits into a date stretch and a time stretch.** The date stretch follows the Dates switch and its granularity, and the time stretch follows the Times switch and its granularity. The time stretch covers the separator through the time zone offset and writes a space and "HH:MM", so "2026-11-09T19:54:00Z" becomes "2026 20:00" at year and hour.
2. **An unresolved ambiguous date holds back that cell's date stretches alone.** The cell's other stretches still change.
3. **The currency and percent switches hold back only the number stretch beside the sign.** A number stretch holds back when a currency sign, a currency code, or a percent sign sits inside its number span. The rest of the cell's stretches change.
4. **A time in the last hour of the clock simplifies down to the hour.** At hour granularity, 23:xx becomes 23:00, 11:xx PM becomes 11:00 PM, and 11:xx with no AM or PM becomes 11:00. It covers a whole-cell clock time, a time inside text, and the time of an ISO date-time, and replaces the ISO rule's clamp to 23:59.
5. **11:xx AM simplifies as any other morning time.** At hour granularity, 11:45 AM becomes 12:00 PM.
6. **An ISO date-time's two stretches follow their own switches, also when one stays as written.** A time stretch that stays as written keeps its seconds and offset. The separator becomes a space whenever either stretch changes, and stays as written only while both stay as written.

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
| year | hour, value "Deployed 2026-11-09T19:54:00Z, 12,345 users" | Deployed 2026 20:00, then 12,345 rounded as a number, then " users" |

### Decided 2026-11-17

7. **Every clock time follows the Times switch,** with the exception in section 3.5. Replaces the PR #581 rule.
8. **One link rule.** A date or time inside a link stays as written, as a number does. A cell that is one linked date stops simplifying.
9. **A split date stops counting in the data test,** as a split number does.

### Open

None.

## 7. Out of Scope (Separate Sprint-Stack)

- The weekday left beside a simplified written date ("Monday, 2026").
- Carrying a table's record to an element the page swaps in (the Outlook captures).

## Decisions Log

- 2026-11-17: Initial draft generated by the sprint-plan skill. Decisions 1 to 6 carried from plan #611; decisions 7 to 9 made by the product manager in this session.
