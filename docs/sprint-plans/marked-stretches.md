# Sprint Plan: Marked stretches

**Status:** APPROVED
**Created:** 2026-11-10
**Base branch:** main
**Slug:** marked-stretches

## Context

Two captures of an Outlook security-alert email (2026-11-09) showed that a cell holding a written date and a clock time, "Monday, November 09 2026 at 19:54 UTC", takes the date rule alone: the Times switch leaves "19:54" as written. The classification ladder gives each cell one mode, and only that mode's rule runs. The product manager asked for a plan that replaces the one mode per cell with marked stretches: the ladder marks each stretch of a cell's text as a date, a time, a number, or a protected stretch, and each stretch takes its own rule and its own switch.

## 1. Repo Survey

- **Languages.** JavaScript for the Chrome extension and the Google Sheets library; Python for the separate `python/` package.
- **Where the change lands.** The classification ladder (`chrome-extension/lib/dr-simplify/ladder.js`, `classifyCell`) and the table step (`lib/dr-simplify/table.js`, `tablePatches`) are pure: plain values in, plain data out. Both sit in the Sheets build's library list (`scripts/build-sheets.js`), so one change reaches the extension and Google Sheets together.
- **The readers the ladder calls** sit in `lib/dr-number/`: `findDates` (every date in a text, each with its bounds), `clockTimeRanges` (every clock time inside a text), `parseISODateTime` and `isTimeLike` (whole-cell forms only), `findIdentifiers` (every code, with `fillsCell` and `inText` flags), `extractNumbersInText` (every number run), `eraYearDigitRanges`, and the quote-span reader.
- **Consumers of the ladder's decision**, each reading its `mode` field:
  - the placement step (`placeDecision`, `lib/dr-table/detect.js`), which checks that each changed number sits in one text piece;
  - the data test (`holdsRoundableCell`, same file), which counts a cell whose decision is not skip;
  - the table step: the column post-pass, the max magnitude, and the patches;
  - the content script's date-and-time piece check (`cellPatches`) and its lens preview sample pool (`numericPreviewCells`);
  - the Sheets entry source (`js/src/entry.js`).
- **Pattern.** Pure library layers (number, simplify, table) under one content script. The ladder already moved from three hand-kept copies into one function. The number-run rule collapsed into one in #595.

## 2. Repo Conventions

- **Version files.** `chrome-extension/manifest.json`, `js/src/entry.js` (its `[VERSION]` line, carried into `js/round_dynamic.js` by the Sheets build), `python/pyproject.toml`. `scripts/bump-versions.py` holds the table.
- **Version bump policy.** `merge-workflow`: the `Bump package versions on merge` workflow bumps after each merge. Sprint branches never touch version files.
- **Test command.** `node chrome-extension/tests.js && node js/tests.js && node js/doc-tests.js && node scripts/build-sheets.js --check`.
- **Gate command.** `scripts/check-files.sh --staged && scripts/check-vocab.sh --staged` (the `pre-commit` hook runs both).
- **Build command.** `node scripts/build-sheets.js`, then commit `js/round_dynamic.js`.
- **Branch naming.** Change-type prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`, `plan/`.
- **Dependent policy.** `after-merge`: CI runs only on pull requests based on `main`.
- **Base branch writes.** `pull-request`: never edit `main`.
- **Commit convention.** Conventional Commits.
- **PR rules.** `AGENTS.md`, "Pull requests": the diff test, `## Tested` and `## Manual tests`, a Product section, no attribution.

## 3. Design

### 3.1 A cell holds stretches, and each stretch takes one rule

**What.** `classifyCell` returns a cell-level gate and a list of stretches in text order. A stretch holds its kind, its bounds in the cell's trimmed text, its reader's payload, and, for a stretch that stays as written, its reason.

- **Kinds that change:** number, date, time.
- **Protected kinds,** which stay as written and keep their digits from the number rule: identifier, quoted span, superscript span, era-marked year, impossible date, and a date or time whose switch is off.

The cell-level gate keeps the rules that read the whole cell: the range expression, the first row and the first column, and the whole-link test. Every other rule becomes a rule about one stretch.

**Why.** All four things the mode protects work per stretch: keeping the number rule off digits that are not amounts, the table's scale, the switch for each kind, and the reason a value stays unchanged. The mode applies that protection to the whole cell, so a mixed cell loses every rule but one (Simple components: one rule per stretch kind, with no ladder order deciding which rule wins a cell).

**Alternatives.** A clock time inside a date cell as a special case: it fixes the Outlook cell, leaves "Paid $12,345 on November 09 2026" unrounded, and adds a second rule for times. Rejected under "Collapse a path before opening a second one".

### 3.2 The ladder's order becomes the order for overlapping stretches

**What.** When two readers claim the same characters, the earlier one in this list keeps them: quoted span, superscript span, identifier, ISO date-time, date, clock time, era-marked year, number. The readers then mark the rest of the text.

**Why.** It keeps every whole-cell result the ladder gives today. A cell that is one date today becomes one date stretch, one clock time becomes one time stretch, and one identifier becomes one protected stretch with no change left to make (Minimize design-time coupling: the existing precedence carries over unchanged).

### 3.3 Mode-free consumers

**What.**
- The placement step checks each changed stretch, number, date, or time alike, for one text piece. The content script's separate date-and-time check then has no work left, so it goes.
- The data test counts a cell holding any stretch that changes.
- The max magnitude reads number stretches from every cell.
- The lens preview reads number stretches.
- The table step builds one patch per changed stretch.
- The Sheets entry source splices those patches, as it does for extracted cells today.

**Why.** Every consumer reads the same list, so no consumer keeps a branch per mode (Simple interactions).

### 3.4 "Pure" becomes a property of the stretch list

**What.** A cell whose one stretch is a number, with only format marks or a unit around it, rounds whatever the numbers-inside-text switch holds, as a pure cell, unit number, or bracketed number does today. A number stretch that shares its cell with words or with another stretch follows the numbers-inside-text switch. A date or time stretch follows its own switch alone, as today.

**Why.** It keeps the meaning of the numbers-inside-text switch.

## 4. Sprint Plan

1. **`stretch-shape`**: the ladder returns stretches; every consumer reads them. No behavior change. Dependencies: none.
2. **`mixed-cell-stretches`**: the ladder marks every stretch in a mixed cell, and each stretch takes its own rule and switch. Dependencies: `stretch-shape`.
3. **`last-hour-times`**: a time in the last hour of the clock rounds down to the hour. Dependencies: none.

`last-hour-times` changes only the hour arithmetic inside the time rule, so it runs in the first wave beside `stretch-shape`. Both touch `roundTimeText`: `stretch-shape` adds bounds to its input and `last-hour-times` changes its hour step. Whichever merges second merges `main` into its branch and keeps both changes.

The edge between sprints 1 and 2 is real. Sprint 2 changes behavior through the shape sprint 1 introduces, and the repository rule under "Test a plan for simplicity" puts a merge that changes no behavior in its own `refactor/` pull request first, so the existing suite proves it. Splitting sprint 2 by stretch kind (dates first, times later) would build one rule for one kind and leave the other to catch up, which "Collapse a path before opening a second one" forbids.

## 5. Sprint Definitions

### Sprint 1: `stretch-shape`

- **Branch:** `refactor/stretch-shape`
- **Goal:** Replace the one mode per cell with a cell-level gate and a list of stretches, with every result unchanged.
- **Scope:**
  - `classifyCell` returns `{ gate, stretches }`. Today's modes map one to one: a pure cell, unit number, or bracketed number gives one number stretch; an extracted cell gives its number stretches; a date cell gives its date stretches; a time cell gives one time stretch. The masked ranges that `extractSimplifyMatches` reads become protected stretches.
  - `roundTimeText` takes a stretch's bounds and rounds the clock time inside them, so a time stretch inside text can round. In this sprint the ladder emits only whole-cell time stretches.
  - Move every consumer in section 3.3 onto the stretch list, and the Sheets entry source with them. Remove `decisionToLegacyInfo`.
  - Add "stretch" to `docs/vocabulary.md` in its own `docs:` commit. Mark "mode" as retired in favor of it, and update the "pure cell" and "extracted cell" rows to define each as a stretch list.
  - Update `docs/design.md`'s description of the ladder.
- **Out of scope:** any change to what a cell becomes; marking a second stretch kind inside a cell that has one today.
- **Acceptance criteria:**
  - All four suites pass with no change to any expected value. Test edits only rename fields or read the new shape.
  - No reader of `mode` or `decisionToLegacyInfo` remains anywhere in `chrome-extension/` or `js/src/`.
  - The date-and-time piece check runs in the placement step, and its debug row text stays the same.
  - `js/round_dynamic.js` matches the build.
- **Dependencies:** none.
- **Complexity:** L.
- **Dev notes:**
  - The data test calls the same classification as the rounding pass (`classifyTableCell`). The piece check that moves into placement must leave the data test's count unchanged: a date or time that crosses two pieces still counts there today, so the moved check only drops the patch and still counts the stretch.
  - Keep the ambiguous-date pending flag on the date stretch, so the column post-pass reads it as before.
  - The skip reasons in the ladder's doc comment become stretch reasons or gate reasons. Keep every reason string that a debug row prints.

### Sprint 2: `mixed-cell-stretches`

- **Branch:** `feature/mixed-cell-stretches`
- **Goal:** Mark every date, time, number, and protected stretch in a cell, so each stretch takes its own rule and switch.
- **Scope:**
  - The ladder runs every reader over the cell's text with the overlap order in section 3.2, and stops at the first whole-cell match no longer.
  - A clock time inside text becomes a time stretch when the Times switch is on, with its AM or PM suffix inside the stretch. It stays a protected stretch when the switch is off, as today.
  - A number in a cell that holds a date or time now rounds under the numbers-inside-text switch.
  - Decisions 1, 2, 3, and 6 in section 6 apply: the ISO date-time split, the ambiguous date held per stretch, the currency and percent switches held per number stretch, and each ISO stretch following its own switch. The results table under decision 6 becomes test rows. `getExclusionReason` loses its percent and currency branches, and the number stretch reader holds back a number whose span carries the sign or code.
  - Docs:
    - `docs/design.md` and `chrome-extension/README.md` describe mixed cells.
    - `js/README.md` and `js/tests-googlesheets-tab.md` list the Sheets change: dates and times are off in Sheets, so a date's digits stay protected and a number beside it now rounds.
    - `docs/test-pages/tables.html` gets a new section, because no section holds a cell that mixes kinds. One table holds a written date with a clock time, a date with a currency amount, a date with a plain number, a clock time with a number, and an ISO date-time with a number. Each row states its expected result.
- **Out of scope:**
  - The Outlook swap that loses a table's originals ("Monday, 2026" rounding to "2,000"). A separate fix covers it: carry the record to the replacing element.
  - Python, which reads no dates or times.
  - The detection and rounding split in #221.
- **Acceptance criteria:**
  - With dates at year and times at hour:
    - "Monday, November 09 2026 at 19:54 UTC" becomes "Monday, 2026 at 20:00 UTC".
    - "Paid $12,345 on November 09 2026" rounds the amount and shows the year.
    - "2026-11-09T19:54 12,345" becomes "2026 20:00 12,000"; no digit of the date or time rounds as a number.
    - "2026-11-09T19:54" becomes "2026 20:00".
  - With the currency switch off, "Paid $12,345 on November 09 2026" keeps the amount and shows the year.
  - With an unresolved all-numeric date, "03/04/2026: 12,345" keeps the date and rounds the number.
  - A cell that is one date, one clock time, one identifier, or one number gives the same result as on `main`. The existing expected values prove it. ISO date-time expected values change under decision 1, and the pull request lists each one.
  - The max magnitude counts a number that shares a cell with a date.
  - The test page's new section lists each mixed shape with its expected result, and `js/round-dynamic-cases.json` gains rows for the same shapes so the Sheets and extension suites run them.
- **Dependencies:** `stretch-shape`.
- **Version bump:** minor (a visible change on pages and in Sheets).
- **Complexity:** L.
- **Dev notes:**
  - `findDates` already returns bounds and `clockTimeRanges` already finds times inside text. The new work is the overlap pass and the span time rounder's use.
  - An impossible date must become a protected stretch, so its digits never round as numbers.
  - `findDates` finds no date in "2026-11-09T19:54" today, because its date end test rejects the letter T after the day. The ISO date-time reader marks both stretches itself, from `parseISODateTime`'s groups widened to a search inside text, and the date stretch rounds through `roundDateText`.
  - Each changed stretch needs its own piece check. A date in one piece and a time in another both change; a stretch that crosses pieces stays as written with its debug row, and the other stretches still change.

### Sprint 3: `last-hour-times`

- **Branch:** `fix/last-hour-times`
- **Goal:** At hour level, a time in the last hour of the clock rounds down to the hour, so no rounded time moves past midnight or past the date beside it.
- **Scope:**
  - In `roundTimeText`, an hour of 23, an hour of 11 with PM, or an hour of 11 with no AM or PM rounds down to ":00" whatever its minutes. Every other hour rounds as today.
  - `roundISODateTime` applies the same rule in place of its clamp to 23:59.
  - Docs that state hour rounding: `docs/design.md`, `chrome-extension/README.md`, and the sidebar help card if it states it.
  - The test page's time section gets rows for 23:45, 11:45 PM, and 11:45, each with its expected result.
- **Out of scope:** times inside text (sprint 2); minute granularity.
- **Acceptance criteria:**
  - 23:45 becomes 23:00, 11:45 PM becomes 11:00 PM, 11:45 becomes 11:00, and "2026-11-09 23:45" becomes "2026-11-09 23:00".
  - 22:45 still becomes 23:00, and 10:45 PM still becomes 11:00 PM.
  - 11:45 AM becomes 12:00 PM (decision 5 in section 6).
- **Dependencies:** none.
- **Complexity:** S.
- **Dev notes:** Sheets keeps times off, so this sprint changes nothing in Sheets. The rule reads the hour as written, before any 12-hour conversion, so 11 PM and 23 meet one test.

## Simplicity

1. **Size.** The code shrinks or stays level.
   - *Removed:*
     - the mode field and its adapter (`decisionToLegacyInfo`);
     - the per-mode branches in the placement step, the table step, the data test, the lens preview, and the Sheets entry source;
     - the content script's separate date-and-time piece check;
     - the ladder's early returns for a whole-cell date, time, or identifier, which become overlap order.
   - *Added:* one overlap pass that merges the readers' stretches (requirement: every rule reaches every part of a cell), and bounds on `roundTimeText` (requirement: a time inside text rounds).
2. **Duplicates.**
   - Two piece checks, one for numbers in the placement step and one for dates and times in the content script, merge in sprint 1.
   - The whole-cell time pattern and the in-text time pattern already share one clock-time source.
   - Identifiers already come from one finder (`findIdentifiers`) with two flags.
   - The number run collapsed in #595.
3. **Removals.** The plan adds no setting, no stored field, and no switch. The stretch reason replaces the cell reason and holds the same strings.
4. **Orphans.** `decisionToLegacyInfo` goes in sprint 1. `isTimeLike` and `isDateTimeLike` lose their ladder callers in sprint 2; remove each one with no other reader in the same change. `dateSplitRow` moves with the piece check, and nothing else reads it.
5. **Bounds.** No new loop over page content and no new wait. Each reader makes one pass over one cell's text with a regular expression, as the extracted path does today, so a cell's stretch count stays at or below its character count. The existing caps bound the cells: the data test's cell budget (1,000) and the re-apply pass's cell cap (10,000).
6. **Current behavior.** The results below came from running `classifyCell` on `main` at 6c33764, with every switch on:
   - "Monday, November 09 2026 at 19:54 UTC" gives mode date; at year it becomes "Monday, 2026 at 19:54 UTC".
   - "Paid $12,345 on November 09 2026" gives mode date; the amount stays.
   - "19:54 — 12,345 units" gives mode extracted; 12,345 rounds and the time stays as written.
   - "2026-11-09T19:54 12,345" gives mode extracted, with 2026, 11, 09, and 12,345 as numbers.
   - "Meeting at 19:54" gives skip, reason no-number.

## 6. Decisions and Open Questions

### Decided (2026-11-10)

1. **ISO date-time splits into a date stretch and a time stretch.** The date stretch follows the Dates switch and its granularity, and the time stretch follows the Times switch and its granularity. The time stretch covers the separator through the time zone offset and writes a space and "HH:MM", as the ISO rule does today, so "2026-11-09T19:54:00Z" becomes "2026 20:00" at year and hour.
2. **An unresolved ambiguous date holds back that cell's date stretches alone.** The cell's other stretches still change.
3. **The currency and percent switches hold back only the number stretch beside the sign.** A number stretch holds back when a currency sign, a currency code, or a percent sign sits inside its number span (the sign or code beside its digits, as the number span reads it). The rest of the cell's stretches change.
4. **A time in the last hour of the clock rounds down to the hour.** At hour level, 23:xx becomes 23:00, 11:xx PM becomes 11:00 PM, and 11:xx with no AM or PM becomes 11:00. The rule covers every time the time rule rounds: a whole-cell clock time, a time inside text, and the time of an ISO date-time. It replaces the ISO rule's clamp to 23:59 and the whole-cell rule's roll to 00:00 or 12:00, so no time ever moves past the date beside it or past midnight. Sprint `last-hour-times` builds it.

5. **11:xx AM rounds as any other morning time.** At hour level, 11:45 AM becomes 12:00 PM.
6. **An ISO date-time's two stretches follow their own switches, also when one of them stays as written.** A time stretch that stays as written keeps its seconds and offset as written. The separator between date and time becomes a space whenever either stretch changes, and stays as written only while both stay as written. With the shipped defaults (dates at year, times off), "2026-11-09T19:54:00Z" becomes "2026 19:54:00Z".

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

## 7. Out of Scope (Separate Sprint-Stack)

- Carrying a table's record to an element the page swaps in (the Outlook capture's lost sidebar link and "2,000").
- #221, which reconciles the data test's number reading with the rounding pass's.

## Decisions Log

- 2026-11-10: Initial draft generated by the sprint-plan skill.
- 2026-11-10: The product manager decided the ISO date-time split, the ambiguous date held per stretch, the currency and percent switches held per number stretch, and the last-hour rule. Sprint `last-hour-times` added.
- 2026-11-10: The product manager decided that 11:xx AM rounds as any other morning time, and that an ISO date-time's two stretches follow their own switches when one stays as written.
- 2026-11-10: The product manager decided that an ISO date-time's separator becomes a space whenever either stretch changes.
- 2026-11-10: The product manager approved the plan.
