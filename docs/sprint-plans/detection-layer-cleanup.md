# Sprint Plan: Detection Layer Cleanup

**Status:** APPROVED
**Created:** 2026-11-10
**Base branch:** main
**Slug:** detection-layer-cleanup

A review of `chrome-extension/lib/dr-table/detect.js` on 2026-11-10 found six
kinds of work: comments the code makes redundant, comments that disagree with
the code, words outside the vocabulary, logic with no effect, one rule written
in several copies, and differences between native tables and grids with no
technical reason. The product manager approved four behavior changes the same
day (§3.1 to §3.4). This plan orders the work from the change with the least
risk to the change with the most: comments, then identifiers, then refactors
the existing suite proves, then the behavior changes.

## 1. Repo Survey

**Languages and shape.** Three platforms share one algorithm: a Google Sheets
library (`js/`), a Python package (`python/`), and a Chrome extension
(`chrome-extension/`). This plan touches the extension alone. The extension is
plain browser JavaScript under Manifest V3 with no build step and no import
statements: the manifest lists the content scripts in dependency order, and
every file declares globals into one shared scope.

**Tests.** One Node suite, `chrome-extension/tests.js`, joins the test pieces
in `chrome-extension/tests/` and runs them as one script. Baseline on `main` at
`45a87fe`: 4,061 passing, 0 failing. `tests/source-checks.js` reads the source
text of the content scripts, so a file move or a rename changes it:

- the manifest load order (lines 122 to 129 and 1293),
- the list of names the `DR_TABLE` object exposes (line 1509),
- a scan that finds named function bodies in `detect.js` (lines 663 to 691),
- the one reader of a row's outside mark (lines 2749 to 2751).

`tests/table-kinds.js` holds the comparison tests, driven by the table kind
pairs list in `docs/design.md`.

**Patterns in place** (`docs/design.md`): ports and adapters. The native-table
adapter and the grid adapter present rows and cells; the controller in
`content.js` runs one simplification pass over them; the detection layer
reports and the callers register.

**The file as it stands**, read in full for this plan at `45a87fe`:

- 2,297 lines, 1,159 of them comment lines. It holds five jobs: the ports, the
  two adapters, the cell read and write (cell object, patch writer, restore,
  record sort), the placement step, and detection (geometry probe, right-click
  resolver, accessibility-artifact filter, data test, shape fingerprint,
  nomination step).
- A native cell's text read returns rendered text; a grid cell's returns flat
  text (`makeCellObj`'s `reads` argument, `makeGridCellObj`). One `rendered`
  flag carries the difference into `getPieceLayout` and `textPosition`.
- `_hasHeaderRow` tests `adapter instanceof NativeTableAdapter`. The native
  branch reads the head section or a row of `TH` cells; the grid branch reads
  the row's outside mark alone. A grid cell object always reports `tagName:
  'TD'`.
- `nativeCellSpans` reads the `colSpan` and `rowSpan` properties;
  `gridCellSpans` reads `aria-colspan` and `aria-rowspan` alone.
- `GridAdapter.isVirtualized()` returns true for every grid. `content.js`
  reads it in `tableKindPass` to select `GRID_TABLE_PASS` or
  `NATIVE_TABLE_PASS`, and `freezesMaxMagnitude` is true on the grid pass
  alone.
- Three places build rows from cell elements: `NativeTableAdapter.getRows`,
  `GridAdapter.getRows`, and the geometry probe's `probeRows`. The probe's
  copy numbers a cell by read position, with no column plan.
- The native scan runs in three places: pass 1 of `findTables`,
  `injectTablePillboxes` in `ui-pillbox.js`, and
  `injectPillboxesForAddedNode` in `content.js`. Each calls
  `isPhantomA11yTable` itself. No grid path calls it.
- `filterLinkMatches` finds a number's text piece by searching for the
  number's characters. After a write the characters are gone, so the record
  stores `linkFilteredIdx` and `supRanges`, the table step returns
  `linkFilteredIdx`, and `finalizeExtractedDecision` takes
  `staleFilteredIndices`.
- The file computes and stores the page's hover text (`pageHoverText`,
  `originalHoverText`); `content.js` writes and restores the cell's `title`.
- Seven hand-written ancestor walks, three text-piece walks, three
  computations of the piece that holds a position.
- In `looksLikeGrid`, step 3 requires the most common child count to reach
  the repetition floor. That condition implies step 2's, so step 2 and its
  class-frequency count reject nothing.

**Recent history.** #604 moved vocabulary into code comments and #605 into
identifiers across the extension. #609 gave grid cells hover text and kept
hover text the page changed.

**Open issues this plan touches.** #525 (hidden text ahead of a value in a
grid cell) closes with `grid-shown-text`. #399 (the link filter finds a match
by substring) closes with `link-filter-by-position`. #375 and #338 concern
comments; `detect-comments` covers the sites in this file, and each issue
stays open for its other sites. #600, #387, #376, #281, #271, and #256 sit
near this work and stay out (§7).

## 2. Repo Conventions

- **Version files:** `chrome-extension/manifest.json`, dotted integers in the
  `version` key (2.2.27 today). `python/pyproject.toml` and the Sheets version
  line stay untouched; no sprint here changes `python/` or `js/`.
- **Version bump policy:** `merge-workflow`. `.github/workflows/bump-version.yml`
  bumps after each merged pull request. A sprint branch never touches a
  version file.
- **Test command:** `node chrome-extension/tests.js && node js/tests.js && node js/doc-tests.js`
- **Gate command:** `scripts/check-files.sh --staged && scripts/check-vocab.sh --staged`
- **Lint, format, build:** none configured; the extension loads unbuilt.
- **Branch naming:** `feature/`, `fix/`, `refactor/`, `chore/`, `docs/`,
  `plan/`, each with a kebab-case label. Never `claude/` or `session/`.
- **Dependent policy:** `after-merge`. The checks run only on pull requests
  based on `main`, so a dependent sprint branches from `main` after its parent
  merges.
- **Base branch writes:** `pull-request`.
- **Commit convention:** Conventional Commits. A vocabulary change is its own
  `docs:` commit on the sprint branch. No attribution trailer and no
  generated-by line, per `AGENTS.md`.
- **Pull request body:** no template file. `AGENTS.md`, section Pull requests,
  holds the rules: the diff test, `## Tested` with results inline, and
  `## Manual tests` as unchecked boxes that name a test page section.
- **Vocabulary:** `docs/vocabulary.md` is the canon. Read it in full before
  the first tool call.
- **Docs track behavior:** a behavior change updates every living document it
  invalidates on the same branch. Each sprint's dev notes name them.
- **Manual test page:** every behavior sprint names its section of
  `docs/test-pages/tables.html`.
- **Review:** each behavior sprint gets an independent code-reviewer pass
  before its pull request opens.

## 3. Design

### 3.1 Both kinds classify the shown text

**What.** A grid cell's text read returns rendered text with a raw-text
fallback, the read a native cell uses today. The `reads` argument, the
`rendered` flag, `makeGridCellObj`'s own text reads, and the branch in
`textPosition` come out.

**Why.** A reader sees the same cell on both kinds. Hidden text inside a grid
cell reaches classification today and stays out on a native table (#525).
Principle: simple components, one read in place of two.

**Alternatives.** Keep flat text on grids (rejected by the product manager,
2026-11-10). Read flat text on both kinds (rejected: a hidden sort key would
reach classification on native tables too).

**Implications.** A rendered-text read asks the browser for layout. The pass
reads every cell before it writes any, so the reads share one layout. The
re-apply observer's budget is 100 milliseconds for 10,000 cells
(`reapplyCellCap`). Nobody has measured the grid pass under the new read, and
the Node suite has no layout to measure. §6 question 1 holds the measurement;
the sprint does not start without it.

### 3.2 One header-row test, and one read of a cell's facts

**What.** A cell object carries `isHeaderCell`: true for a `TH`, and for an
element with the row-header or column-header role. A row carries `isOutside`
on both kinds: on a native table, a row in the head section; on a grid, a row
outside every row group, as today. One header-row test serves both: the first
row is an outside row, or it holds header cells alone. One span reader serves
both: the element's span property, then the accessibility attribute.

**Why.** `_hasHeaderRow` checks the adapter's class, which the adapter
interface exists to prevent (minimize design-time coupling). A grid whose
first row holds header cells alone, with no row group, gets a fingerprint of
the column count alone, so a swapped table with the same column count keeps
the old table's settings. A grid built from bare `<tr>` and `<td>` elements
with a `colspan` gets no merged cell.

**Alternatives.** Keep the grid test narrow (rejected by the product manager,
2026-11-10). Give each adapter a `hasHeaderRow()` method (rejected: two copies
of one rule).

**Implications.** A grid's header texts join its fingerprint where its first
row holds header cells alone. A grid whose first row is a data row stays as
today. The `tagName` field on the cell object has no other reader and comes
out.

### 3.3 Both kinds freeze the max magnitude

**What.** The first simplification stores the max magnitude as the table's
magnitude freeze on both kinds, and every re-apply pass reads it.
`freezesMaxMagnitude` comes out of the two pass objects.

**Why.** The product manager's choice, 2026-11-10: the kinds behave alike. The
extension cannot tell a virtualized grid from a grid that holds all its rows,
so lifting the freeze on some grids would rest on a guess.

**Alternatives.** Keep the difference (first answer, replaced the same day).
Detect a grid that holds all its rows (rejected: a wrong guess shifts numbers
during a scroll).

**Implications.** One behavior that works today ends: a native table no longer
rounds again when the page writes a larger value. A toggle off and on computes
the max magnitude fresh, as on a grid. The vocabulary rows for magnitude
freeze and re-apply observer, and the design document's "One pass" entry,
describe the old behavior and change on the same branch.

### 3.4 One accessibility-artifact filter, run once, on both kinds

**What.** The filter takes any element. The nomination step's guards and the
geometry probe run it on a grid. The two hand-written native scans in
`ui-pillbox.js` and `content.js` call `findTables`, so the filter runs in one
place.

**Why.** A hidden or off-screen grid registers today and gets a table pillbox
the reader cannot see. Three copies of the native scan each call the filter
(simple interactions, one path).

**Alternatives.** Run two of the three signs on grids (rejected by the product
manager, 2026-11-10).

**Implications.** §6 question 2: the chart sign, as written, also matches a
table that is itself positioned and holds a labelled icon in a cell. Grids are
positioned far more often than native tables. The sprint does not start until
that question has an answer.

### 3.5 The link filter and the superscript check work from position

**What.** A number's position in the classified text identifies its text
piece through the piece layout. The link filter tests whether that piece sits
inside a link. The superscript check lists the pieces inside a `<sup>` and
derives ranges from the original piece texts. Both work on a simplified cell,
because a piece keeps its identity through every write.

**Why.** The substring search picks the wrong piece when a number appears
twice (#399), and it cannot run on a simplified cell, which is why the record
stores two fields and two functions take the stored result. Position removes
the defect and the stored state (simple components).

**Alternatives.** Keep the stored results (rejected: three stores of one
answer). Store piece indexes in place of number positions (rejected: still
stored state).

**Implications.** The record loses `linkFilteredIdx` and `supRanges`. The
table step stops returning `linkFilteredIdx`. A cell where one number appears
both inside and outside a link changes result; that is the fix.

### 3.6 Four files in place of one, and the placement step moves

**What.**

| File | Holds |
| --- | --- |
| `lib/dr-table/cells.js` | text pieces, rendered-to-flat maps, patch writer, restore, record sort, hover text, cell object |
| `lib/dr-table/adapters.js` | ports, span reader, column plan, both adapters, `makeAdapter` |
| `lib/dr-table/classify.js` | whole-link test, link filter, superscript ranges, `classifyTableCell` |
| `lib/dr-table/detect.js` | geometry probe, right-click resolver, artifact filter, data test, shape fingerprint, nomination step |
| `lib/dr-simplify/placement.js` | the placement step and its piece helpers |

**Why.** The file holds five jobs, and its header describes two of them as the
file's purpose. The placement step reads plain values and one callback, the
shape the table step has, so it belongs beside the table step (segregate by
characteristics). The split comes before the behavior sprints so each one
changes a smaller file.

**Alternatives.** Split first (rejected: every text sprint would then conflict
with a moved file). Leave one file (rejected: 800 lines is the stated
ceiling).

**Implications.** The manifest order, `tests/setup.js`, and four checks in
`tests/source-checks.js` change with the move. Function bodies move unchanged.

### 3.7 The cell object holds every cell write

**What.** The cell object's write method writes the text pieces, the record,
the marker class, and the hover text. A new `restore()` method on the cell
object puts back the text pieces and the page's hover text and removes the
marker class. `content.js` calls the two methods.

**Why.** The hover-text rule sits in two files today: this file computes and
stores the page's hover text, and `content.js` writes and restores the
`title`. One rule in one place.

**Alternatives.** Move the computation into `content.js` (rejected: the record
write and the hover-text read share one moment, the first write).

### 3.8 Comments state the truth; no new port

**What.** The file header says every page read goes through a port. Five
reads do not: the text-piece walk, the link filter, the whole-link test, the
native text read, and the hover-text read. `detect-comments` corrects the
header. No sprint adds a port.

**Why.** A port for each read adds code for a caller that does not exist. The
suite already runs these functions against its own page stand-ins.

### 3.9 Vocabulary: change the word only where it carries the retired idea

`detect-comments` and `detect-identifiers` replace a word only in the sense
listed under "Change". Every other use stays.

| Word | Change | Leave |
| --- | --- | --- |
| phantom, a11y | the accessibility artifact | — |
| widget; pillbox alone | the table pillbox | "pillbox view" where it stands for the view file |
| virtual grid | the grid kind as a whole becomes "grid" | "virtualized grid" for a grid that holds only its visible rows; `.dg--virtual-row`, a vendor class |
| found, seen | a table already in the registry becomes "registered" | "a number found inside text"; `found` as a search result variable; "as the classified text saw it" |
| symbol | "currency symbol" becomes "currency sign" | any other symbol |
| text node | the unit of a cell's text becomes "text piece" | the page's node object: the tree walker, `nodeValue`, node identity |
| mixed text | a cell with numbers inside words becomes "extracted cell" | the reason code `'mixed-disabled'`, a code value other files read |
| held, hold | "held back as mixed text" and "the defaults hold them" become "left unsimplified" and "the first-row and first-column exclusions" | a column a merged cell holds, which matches the grid column row; the cell state `'held'`, a code value |
| rounded | the marker-class constant, which also marks dates and times | a number that rounds |
| engine | the controller, or the simplification pass, by the sense of the sentence | — |
| turned read, universe, rediscovery, heads a nest, number extractor | a plain description in canon terms | — |

No sprint adds a vocabulary row for these: each undefined word gives way to a
description in existing terms. The class string `dr-ext-rounded` stays; the
stylesheet and the capture read it.

## 4. Sprint Plan

Every sprint changes the same file, so the order is a chain. Sprints 1 to 7
change no behavior except sprint 5, a defect fix. Sprints 8 to 11 are the
approved behavior changes and form one wave.

| # | Label | Goal | Depends on |
| --- | --- | --- | --- |
| 1 | `detect-comments` | Comments match the code and the vocabulary | none |
| 2 | `detect-identifiers` | Identifiers match the vocabulary | 1 |
| 3 | `detect-unused-logic` | Logic with no effect comes out | 2 |
| 4 | `detect-shared-helpers` | Each repeated rule exists once | 3 |
| 5 | `link-filter-by-position` | Link filter and superscript check work from position | 4 |
| 6 | `cell-object-writes` | The cell object holds every cell write | 5 |
| 7 | `split-table-package` | Four files and the placement step's move | 6 |
| 8 | `grid-shown-text` | Both kinds classify the shown text | 7, §6 question 1 |
| 9 | `header-and-span-parity` | One header-row test, one span reader | 7 |
| 10 | `freeze-both-kinds` | Both kinds freeze the max magnitude | 7 (order only) |
| 11 | `artifact-filter-both-kinds` | One artifact filter on both kinds | 7, §6 question 2 |

**Decoupling.** Sprints 1 to 7 cannot run side by side: each rewrites lines
the next one reads. Sprint 10 touches `content.js` and the documents alone and
has no code dependency; it sits in the last wave by the product manager's
order, least risk first (§6 question 4). Sprints 8, 9, and 11 touch different
functions after the split. Sprints 8 and 9 both change the grid cell object;
the second to merge takes `main` into its branch first.

## 5. Sprint Definitions

### 1. `detect-comments`

- **Branch:** `chore/detect-comments`
- **Goal:** every comment in `detect.js` states what the code does today, in
  canon terms, and no comment restates its code.
- **Scope:** comments in `chrome-extension/lib/dr-table/detect.js` alone.
  - Delete comments that restate the next line.
  - State the "reports only" contract once, in the file header.
  - Correct each disagreement: the header's port claim (§3.8) and its
    "reports only" claim for a file that also writes; the list of four
    functions that consume the adapters; "no `<th>` concept" on the grid cell
    object; "piece indexes" in the text-piece walk; "pinned pane sibling";
    the scroll container's source order; "majority" in the geometry probe;
    "the nomination step (findTables)"; the table filter's parameter list;
    the garbled header sentence.
  - Replace plan labels with the reason they stood for, or delete them:
    "S2/S4", "D1 / S6", "decision D2", "app-model-registry sprint".
  - Apply §3.9 to comment text.
  - Remove personification: "own", "wins", "pick", "cannot beat", "benefit
    of the doubt", "knows how to handle".
- **Out of scope:** any code line; any identifier; comments in other files;
  the step banners in the geometry probe, the artifact filter, and the
  right-click resolver, and the comments on the link filter's stored result
  (sprints 3 to 5 remove the code under them).
- **Acceptance criteria:**
  - `git diff` shows comment lines alone; the suite count stays at the
    baseline.
  - No comment names a function that does not exist in the extension.
  - No word in §3.9's "Change" column remains in a comment in that sense, and
    every use in the "Leave" column stands.
  - Comment lines fall by at least 150.
- **Dependencies:** none
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** keep the comments that state a reason the code cannot: the
  layout cost of a rendered-text read, the in-place text write, the
  held-column rule in the column plan, the memo in `_ownDescendants`. "Kaggle"
  becomes a description of the markup. Run `scripts/check-vocab.sh --range
  origin/main HEAD` before the pull request.

### 2. `detect-identifiers`

- **Branch:** `refactor/detect-identifiers`
- **Goal:** identifiers the file declares match the vocabulary and what the
  code does.
- **Scope:** renames, with every caller, test, `lib/dr-table/index.js`, and
  the `DR_TABLE` name list in `tests/source-checks.js`:
  - `isPhantomA11yTable` → `isAccessibilityArtifact`
  - `opts.tableFilter` → `opts.isArtifact`
  - `opts.isSeen` → `opts.isRegistered`
  - `applyExtractedPatches` → `writePatches`
  - `isVirtualized()` → `isGrid()`
  - `GRID_ROUNDED_CLASS` → `SIMPLIFIED_CLASS` (the class string stays)
  - `symbolPiece` → `signPiece`
- **Out of scope:** `decisionToLegacyInfo` and every identifier another file
  declares; the class string; the reason codes; any logic.
- **Acceptance criteria:**
  - The suite count stays at the baseline.
  - `rg` finds none of the old names in `chrome-extension/` outside
    historical records.
  - Comments that mention a renamed identifier use the new name.
- **Dependencies:** `detect-comments`
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** follow #605's pattern. `README.md` in `chrome-extension/`
  and `docs/design.md` name some of these; update them in the same branch.

### 3. `detect-unused-logic`

- **Branch:** `refactor/detect-unused-logic`
- **Goal:** remove logic that changes no result.
- **Scope:**
  - The geometry probe's step 2 and its class-frequency count;
    `childCountCandidates` stops returning the frequency map.
  - The self-match loop in the grid adapter's scroll-container lookup.
  - The inner condition in the superscript walk that is always true.
  - The `trimmed` field on a classified entry, and the written-piece list
    the patch writer returns, each only where no caller or test reads it.
  - In the artifact filter and the positioned-ancestor walk, read the style
    through the style probe alone; tests that relied on inline style pass a
    probe.
- **Out of scope:** the `try` blocks around selectors; guards for element
  stand-ins in tests.
- **Acceptance criteria:**
  - The suite passes with no test deleted, except a test of a removed field.
  - One new test per removed block states the equivalence it rests on: for
    step 2, a probe input that failed step 2 alone before the change does not
    exist, shown by a table of the four class-share and count-share cases.
- **Dependencies:** `detect-identifiers`
- **Version bump:** patch
- **Complexity:** S
- **Dev notes:** step 2 passes when the largest class share or the largest
  child-count share reaches the floor. Step 3 requires the largest non-zero
  child-count share to reach the floor, which is never larger than the share
  step 2 reads. `README.md` in `chrome-extension/`, near line 163, lists the
  probe's steps; update it. If a test reads `trimmed` or the written-piece
  list, leave that item and say so in the pull request.

### 4. `detect-shared-helpers`

- **Branch:** `refactor/detect-shared-helpers`
- **Goal:** each rule the file repeats exists once.
- **Scope:**
  - One ancestor walk that takes a cap and a stop test; the seven walks call
    it, each with its present cap and stop.
  - The superscript walk and the link filter read pieces through
    `collectTextPieces`.
  - One function for "the piece that holds a flat position"; `pieceHolding`,
    `patchPieceTexts`, and `showsPiecesTogether` call it.
  - One resolver for the option defaults.
  - `chainRootOf` and `_chainRootOf` become one walk with two entry points
    or one function; no two functions share a name stem.
  - The right-click resolver calls `nominateNest` in place of `findTables`.
  - One row builder takes each row's cell elements; both adapters and the
    geometry probe call it. The native adapter reads each row's cells once,
    and `columnPlacement`'s fallback comes out.
  - The step banners in the geometry probe, the artifact filter, and the
    right-click resolver become named functions.
  - The record's shape and the piece layout's shape each get one type
    definition; the three comments that describe the layout point to it.
- **Out of scope:** any change to a walk's cap or stop; the link filter's
  search (sprint 5); file moves (sprint 7).
- **Acceptance criteria:**
  - The suite passes unchanged.
  - `parentElement || parentNode` appears once in the file.
  - `createTreeWalker` appears once in the file.
  - The file is at least 150 lines shorter than at the sprint's start.
- **Dependencies:** `detect-unused-logic`
- **Version bump:** patch
- **Complexity:** L
- **Dev notes:** the probe's cells gain a column plan through the shared
  builder. With no declared span, the plan equals the read position. §6
  question 3 covers the one input where it differs. Two walks have no depth
  cap today (the hidden-mark walk and the positioned-ancestor walk); the page
  tree's depth bounds them, and they keep that bound.

### 5. `link-filter-by-position`

- **Branch:** `fix/link-filter-by-position`
- **Goal:** the link filter and the superscript check find a number's text
  piece by position (§3.5). Closes #399.
- **Scope:** `filterLinkMatches`, `getSuperscriptRanges`,
  `finalizeExtractedDecision`, `classifyTableCell`, the record's fields in
  the cell object, `tablePatches` and its return in
  `lib/dr-simplify/table.js`, `cellPatches` and `writeCell` in `content.js`,
  the record comment in `app/model.js`, and the tests that build a record by
  hand.
- **Out of scope:** #271 (a superscript by style alone); the whole-link test.
- **Acceptance criteria:**
  - A test that fails on `main`: a cell holding the same number once in plain
    text and once inside a link rounds the plain one and keeps the linked one,
    in either order, on both kinds.
  - The record holds `value`, `pieces`, and `pageTitle` alone.
  - `linkFilteredIdx`, `supRanges`, and `staleFilteredIndices` appear nowhere
    in `chrome-extension/` outside historical records.
  - The existing footnote and linked-number tests pass on a simplified cell
    after a re-apply.
- **Dependencies:** `detect-shared-helpers`
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** manual test in sections 7 and 8 of the test page; add the
  repeated-number row to section 8. The design document's "One pass" entry
  lists the record's fields; update it. A cell whose layout is null is a
  rewritten cell and never reaches the filter.

### 6. `cell-object-writes`

- **Branch:** `refactor/cell-object-writes`
- **Goal:** the cell object holds every cell write (§3.7).
- **Scope:** the cell object gains the hover-text write inside its write
  method and a `restore()` method; `writeCell` and the cell-release function
  in `content.js` call them and hold no `title`, class, or text-piece write
  of their own.
- **Out of scope:** any change to when a cell restores or which hover text
  it shows.
- **Acceptance criteria:**
  - The suite passes unchanged, the hover-text tests from #609 included.
  - `content.js` holds no write to a cell's `title` or class list.
- **Dependencies:** `link-filter-by-position`
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** manual test in section 36 of the test page.

### 7. `split-table-package`

- **Branch:** `refactor/split-table-package`
- **Goal:** the layout in §3.6, with function bodies unchanged.
- **Scope:** the five files, `manifest.json`'s content-script list,
  `lib/dr-table/index.js`, `lib/dr-simplify/index.js`, `tests/setup.js`, the
  four checks in `tests/source-checks.js` named in §1, the layer table in
  `docs/design.md`, and the two file references in
  `chrome-extension/README.md`.
- **Out of scope:** any edit inside a moved function; #387 (names missing
  from the `DR_TABLE` object).
- **Acceptance criteria:**
  - The suite passes; the only test edits are file names and load order.
  - No file in `lib/dr-table/` exceeds 800 lines.
  - Each file's header states one job.
  - `git diff -M` reports the moves as renames or pure moves.
- **Dependencies:** `cell-object-writes`
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** the manifest order is load-bearing. `cells.js` loads before
  `adapters.js`, which loads before `classify.js` and `detect.js`;
  `placement.js` loads with the simplification library, after the number
  library. A function calls another at run time, so only top-level reads fix
  the order: `GRID_VENDOR_PROFILES` and `DETECTION_OPTIONS` read globals at
  load.

### 8. `grid-shown-text`

- **Branch:** `fix/grid-shown-text`
- **Goal:** a grid cell classifies its rendered text, as a native cell does
  (§3.1). Closes #525.
- **Scope:** the cell object's text reads, `getPieceLayout`, `textPosition`,
  the grid cell builder, the comment in `content.js` that lists the two
  adapter differences, the hidden-text pair in the design document's table
  kind pairs list, and the vocabulary rows for rendered text and data test.
- **Out of scope:** the capture's displayed-text read beyond what the shared
  read changes.
- **Acceptance criteria:**
  - The comparison test for hidden text inside a visible cell reads `same`.
  - `rendered` as a layout field and `reads` as a cell-object argument appear
    nowhere.
  - The measured grid pass from §6 question 1 is recorded in the pull request
    with its cell count.
- **Dependencies:** `split-table-package`; §6 question 1 answered under 100
  milliseconds.
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** manual test in section 30r; section 23d holds the pass
  measurement. The suite's grid stand-ins hold no rendered text, so the
  raw-text fallback serves them.

### 9. `header-and-span-parity`

- **Branch:** `fix/header-and-span-parity`
- **Goal:** one header-row test and one span reader serve both kinds (§3.2).
- **Scope:** the cell object (`isHeaderCell` in, `tagName` out), the native
  adapter's rows (`isOutside` for a head-section row), `_hasHeaderRow`, the
  span reader, the outside-mark check in `tests/source-checks.js`, the
  vocabulary rows for shape fingerprint, header cell, merged cell, and
  outside row, and the pairs list.
- **Out of scope:** #418; #448; any use of the outside mark beyond the
  fingerprint.
- **Acceptance criteria:**
  - `instanceof` appears nowhere in `lib/dr-table/`.
  - A test that fails on `main`: a grid with a first row of column-header
    cells and no row group carries header texts in its fingerprint, and a
    swap to new header texts with the same column count registers it fresh.
  - A test that fails on `main`: a grid built from bare `<tr>` and `<td>`
    elements with a `colspan` numbers its grid columns as the native table
    with the same markup does.
  - A grid whose first row is a data row keeps a fingerprint of the column
    count alone.
- **Dependencies:** `split-table-package`
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** manual test in section 30f for the header row and section
  14 for the span; if section 14 holds no merged cell, add one row to it.
  The dataset still takes every row; the outside mark feeds the fingerprint
  alone.

### 10. `freeze-both-kinds`

- **Branch:** `feature/freeze-both-kinds`
- **Goal:** both kinds store and read the magnitude freeze (§3.3).
- **Scope:** the two pass objects and the pass in `content.js`, the registry
  comment in `app/model.js`, the tests that pin a native table's fresh max
  magnitude on re-apply, the vocabulary rows for magnitude freeze, re-apply
  observer, and registry, and the design document's "One pass" entry.
- **Out of scope:** #281 (a null max magnitude is never frozen).
- **Acceptance criteria:**
  - `freezesMaxMagnitude` appears nowhere.
  - A comparison test: after the first simplification, the page writes a
    value of a larger order of magnitude into each kind; on both, the other
    cells keep their text and the new value rounds under the top band's
    offset.
  - A toggle off and on computes the max magnitude fresh on both kinds.
- **Dependencies:** `split-table-package`, for order alone.
- **Version bump:** minor
- **Complexity:** S
- **Dev notes:** manual test in section 23b; state in the section what a
  failure looks like: every cell changing when one larger value arrives.

### 11. `artifact-filter-both-kinds`

- **Branch:** `fix/artifact-filter-both-kinds`
- **Goal:** one artifact filter runs once, on both kinds (§3.4).
- **Scope:** the filter, the nomination step's guards, the geometry probe's
  entry, `injectTablePillboxes` in `ui-pillbox.js`,
  `injectPillboxesForAddedNode` in `content.js`, the vocabulary rows for
  accessibility artifact and qualifying element, and the pairs list.
- **Out of scope:** #600; #389.
- **Acceptance criteria:**
  - The filter is called from the detection file alone.
  - A test that fails on `main` for each sign: a grid marked hidden, a grid
    drawn off-screen, and a grid beside a labelled chart each get no registry
    entry.
  - The answer to §6 question 2 holds on both kinds, with a comparison test.
- **Dependencies:** `split-table-package`; §6 question 2 answered.
- **Version bump:** patch
- **Complexity:** M
- **Dev notes:** add grid forms to sections 16a, 16b, and 16c of the test
  page. A pending table whose chain root is an artifact starts no observer.

## 6. Open Questions

1. **The grid pass measurement.** Before sprint 8 starts, someone loads
   section 23d of the test page in Chrome with the grid text read switched to
   rendered text and records the re-apply pass time on a 10,000-cell grid.
   Under 100 milliseconds, the sprint runs. Over it, the plan returns to the
   product manager. Recommendation: the agent session runs the measurement
   through the browser, on a scratch copy of the extension, after sprint 7
   merges.
2. **The chart sign matches a table that holds its own icon.** The third
   sign reads: the nearest positioned ancestor, the table itself included,
   holds an `<svg>` with a label. A table with `position: relative` and a
   labelled icon in one cell therefore counts as an accessibility artifact.
   This is read from the code and not yet reproduced by a test; sprint 11's
   first step reproduces it on `main`. On grids the case is common: most grid
   libraries position the grid, and sort and status icons carry labels.
   Options: (a) the sign ignores an `<svg>` inside the table itself, on both
   kinds (recommended); (b) keep the sign as written and accept that such
   grids never register; (c) drop the chart sign on grids alone, the option
   the product manager declined on 2026-11-10 before this case was known.
3. **The probe's column plan.** After sprint 4, a cell in the geometry
   probe's numeric step carries its grid column in place of its read
   position. The two differ only where an unmarked grid declares a column
   span, and the result differs only where that grid's sole countable values
   are ambiguous dates. Recommendation: accept, since the adapter reads the
   same grid with the plan once it registers.
4. **Wave count.** The chain is seven merges before the behavior wave. Two
   merges can go: sprints 1 and 2 as one pull request, and sprints 3 and 4 as
   one. Recommendation: keep them apart; each is then a pull request the
   suite proves by itself. Sprint 10 can also run in the first wave, since it
   has no code dependency.

## 7. Out of Scope (Separate Sprint-Stack)

- **Bare globals and load order.** The file reads fourteen names other files
  declare. That is the extension's module pattern, and changing it reaches
  every file.
- **Ports for the remaining page reads** (§3.8).
- **#600**, a right-click inside a grid in a native table's cell.
- **#387**, **#376**, **#281**, **#271**, **#256**: each sits beside a sprint
  here and changes something that sprint does not.
- **`decisionToLegacyInfo`**, declared in the simplification library.
- **Guards for element stand-ins** and `try` blocks around selectors, which
  exist for the suite's page stand-ins.

## Simplicity

1. **Size.** Smaller. Removed: about 300 comment lines; the geometry probe's
   step 2; six of seven ancestor walks; two of three text-piece walks; two of
   three row builders; two record fields with their parameter and return
   value; the `reads` argument and the `rendered` flag; the adapter class
   check; `freezesMaxMagnitude`; two hand-written native scans. Added: an
   ancestor-walk helper, a row builder, an options resolver, a `restore()`
   method, `isHeaderCell`, a native row's outside mark, and four file
   headers. Each addition replaces at least two copies of what it holds,
   except `isHeaderCell` and the native outside mark, which implement §3.2.
2. **Duplicates.** The seven walks, three piece walks, three piece lookups,
   three row builders, and three native scans. Sprints 4 and 11 merge them.
   The merges that change no behavior sit in `refactor/` pull requests ahead
   of the behavior sprints.
3. **Removals.** The plan adds no setting and no stored field. The options
   resolver is the one addition that could come out; it stays only if it is
   shorter than the eleven lines it replaces.
4. **Orphans.** `tagName` on the cell object (sprint 9), the frequency map
   (sprint 3), `columnPlacement`'s fallback (sprint 4), `staleFilteredIndices`
   and the table step's `linkFilteredIdx` (sprint 5). Each comes out in the
   sprint that removes its last reader.
5. **Bounds.** The ancestor-walk helper takes a cap. Five callers pass
   `gridWalkDepthCap`, as today. Two pass none and stop at the tree's root,
   as today. The plan adds no wait, retry, or queue. The rendered-text read
   on grids adds layout work inside a pass the cell cap already bounds at
   10,000 cells; §6 question 1 measures it.
6. **Current behavior.** Every statement in §1 comes from the file at
   `45a87fe`. Three are claims a sprint must reproduce on `main` before it
   builds on them: #399's wrong piece (sprint 5), the header-cells-alone grid
   (sprint 9), and the positioned table with a labelled icon (§6 question 2).

## Decisions Log

- 2026-11-10: Initial draft.
- 2026-11-10: Product manager approved §3.1, §3.2, and §3.4, and chose
  "freeze both kinds" for §3.3 in place of the first answer, "keep the freeze
  on every grid".
- 2026-11-10: Product manager approved the plan. §6 questions 1 and 2 have no
  answer yet, so sprints 8 and 11 wait; a run that reaches either one with its
  question unanswered defers that sprint and reports it. Questions 3 and 4
  stand at their recommendations.
