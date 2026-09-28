# Open issue review

> **Status (2026-09-26): record.** A point-in-time review of every open GitHub issue. Each entry recommends an action and edits nothing on GitHub. Entries append in the order their reviews complete.

Each entry uses the same headings in the same order: closable, updates, capability, files, complexity, simplicity, refactor, effort, and urgency. Effort runs S (under a day), M (1–3 days), L (about a week), XL (more than a week). Urgency runs P0 (drop other work) to P3 (when convenient).

## #207 — [no-op] file sizes

**Summary:** #207 · [no-op] file sizes · update then keep · S · P3

### Can it be closed
No. `docs/media/dynamic_rounding_demo6.mov` is still tracked on main at 25,642,590 bytes. It is the largest tracked file by a factor of about 70, and the local pack measures 26.07 MiB. The gate framing is obsolete. `scripts/check-files.sh` holds no size check and no `GRANDFATHERED` list, and its header states that file size is tracked separately. No file in the repository references the video: README, docs, and the extension contain no link to it.

### Can it be updated
Yes. The body describes a size gate and a grandfathering exemption that no longer exist, and the owner comment corrects this. A rewrite should cover these points:
- **Problem:** one unreferenced demo video makes up most of the repository's weight. Every checkout downloads it, including the depth-1 checkout in `tests.yml`. The full-history checkouts in `repo-hygiene.yml` and `bump-version.yml` also download old blobs of deleted media.
- **Options:** (1) delete the file from the tree now. This removes the cost for shallow checkouts at no rewrite cost, since nothing links to the file. (2) Host the video as a release asset and link it from the README. (3) Rewrite history, or move media to Git LFS, to reclaim the full-history cost. Either path breaks existing clones and forks. (4) Take no action.
- **Urgency:** low.
- **Title:** drop "[no-op]" and name the repository weight.
- **Vocabulary:** the issue uses no retired synonym from docs/vocabulary.md. "Gate" and "grandfathered" name a mechanism that no longer exists, so the rewrite drops them.

### New capability
For the user: none. The video becomes reachable only if option 2 adds a link.
For the developer or tester: faster clones and CI checkouts. Option 1 cuts about 25 MiB from each depth-1 checkout.

### Files
- `docs/media/dynamic_rounding_demo6.mov`
- `README.md` (only if option 2 adds a link)
- `.github/workflows/tests.yml`, `repo-hygiene.yml`, `bump-version.yml` (checkout depth, no edit needed)

### Complexity
Option 1 removes one binary file and adds no state, path, setting, or special case. Option 3 adds Git LFS configuration (`.gitattributes`) and an LFS step on every checkout. Net verdict: removes for options 1 and 2; adds for option 3.

### Simplicity
- Size: option 1 deletes one 25 MiB file and adds nothing.
- Duplicates: none; no code touches media.
- Removals: the video itself; nothing reads it.
- Orphans: the video has no reader today, so deleting it removes an orphan.
- Bounds: none involved.
- Current behavior: the 25.6 MiB size holds. The gate and exemption claims do not match main; the owner comment already retracts them.

### Refactor
(a) Deleting the unreferenced file replaces most of the work without a history rewrite. (b) Not applicable. (c) A history rewrite can wait until one happens for another reason, as option 3 of the issue states.

### Effort
S: a one-file deletion. A history rewrite would add coordination but little engineering.

### Urgency
P3. The issue has no user or correctness impact and blocks no other work. The only cost is developer friction from checkout time.

## #157 — [follow-up] Remove dead-code truncateDecimals (superseded by formatOriginal string-slice path)

**Summary:** #157 · [follow-up] Remove dead-code truncateDecimals (superseded by formatOriginal string-slice path) · update then keep · S · P3

### Can it be closed
No. On main (`2b0696f`), `truncateDecimals` in `chrome-extension/sidebar.js:272` has no production caller. `renderBand` and the top-band render call `formatOriginal` at lines 401, 411, 444 and 461. The helper survives only through `sidebarHelperTests` in `chrome-extension/tests/sidebar.js:125-296`: an extraction guard (`truncateFn`) and 21 `trunc(...)` assertions. No closed issue or merged pull request removes it.

### Can it be updated
Yes. The issue and its comment point to `chrome-extension/tests.js`. The tests now sit in `chrome-extension/tests/sidebar.js`, and `tests.js` is only the runner. Vocabulary: "dead code" is retired, and the canonical term is "never used". "preview-number" should read "lens preview sample". "Truncation" and "float-based" are not in the vocabulary and can stay as plain words.

A rewrite should say this. The lens preview trims samples by slicing the number's text in `formatOriginal`. A second helper trims arithmetically, and nothing in the product calls it. The arithmetic path gives wrong results: `truncateDecimals(0.0003)` returns `0.0002`. That result rules out routing the live path through the helper. The recommended option is to delete the helper, its extraction guard and its assertions. Before deleting, rewrite the helper-only cases that have no `formatOriginal` twin (1.99999, 1.00005, 100.9999, 100.0001, -100.9, -100.5, -1234.56) as `fmtOrig` assertions. Resolve this with #202 items 2 and 3 in one sweep.

### New capability
For the user: none. The lens preview output stays the same.
For the developer or tester: the code keeps one trimming path, and the suite tests only code the product runs.

### Files
- `chrome-extension/sidebar.js` (`truncateDecimals`, `PREVIEW_DECIMAL_THRESHOLD`, `PREVIEW_MAX_DECIMALS`, `formatOriginal`)
- `chrome-extension/tests/sidebar.js` (`sidebarHelperTests`)

### Complexity
The change removes one function, one duplicate path and one extraction guard. It adds no state, option or special case. Net verdict: removes.

### Simplicity
- **Size:** removes 6 production lines and about 45 test lines, and adds about 7 converted `fmtOrig` assertions.
- **Duplicates:** passes through the duplicated trimming logic in `truncateDecimals` and `formatOriginal`, and deletes the copy that is never used.
- **Removals:** adds nothing.
- **Orphans:** both constants stay in use inside `formatOriginal`. The removal leaves nothing without a reader.
- **Bounds:** none. The change holds no walk, wait, retry or queue.
- **Current behavior:** confirmed on main. The helper has no production caller, and the float defect reproduces for 0.0003.

### Refactor
(a) The deletion itself does the work. It changes no behavior, so it can land as a `refactor/` pull request, and the existing suite (3638 passing) proves it. (c) The same pull request could also cover #202 item 3 (`formatStrategyHeader`, `chrome-extension/tests/number.js:1767`) and item 2, because each needs the same decision to delete the copy that is never used.

### Effort
S: one function and one test block, with no behavior change.

### Urgency
P3. Users see no effect and nothing waits on it. The risk is a developer wiring the float helper back into the product.

## #202 — [follow-up] Dead code analysis

**Summary:** #202 · [follow-up] Dead code analysis · update then keep · S · P3

### Can it be closed
No, but it can be narrowed. Item 4 is resolved: `NATIVE_TABLE_PASS.watchedElement` in `content.js:1056` calls `NativeTableAdapter.getElement`. `GridAdapter.getElement` is kept for interface symmetry across the two table kinds. Items 1, 2, 3 and 5 still hold on main. Item 1 is now the bus topic `intent:updateMenuLabel`. `content.js:337,341` publishes the title "Toggle table", and `background.js:15-19` creates the menu item with that same title, so the update still sets the title the item already has.

### Can it be updated
The rewrite should list four items: the menu toggle's label update, which re-sets an unchanged title; the single-number extraction helper and its regex, which only tests use; the lens preview strategy-line helper, which copies the inline path in `renderTopBand`; and the ignored `floorDecimals` parameter. Drop item 4. Fold in #157 (`truncateDecimals`), because both issues ask the same delete-or-adopt question. Vocabulary: "dead code" becomes "never used"; "menu label" becomes "the menu toggle's title"; "preview band" becomes "lens preview". Update item 1's facts: the topic is `intent:updateMenuLabel`, and its tests now live in `tests/messaging-model.js` (topic registry and two expected sequences) and in `adapters/messaging.js:162`.

### New capability
For the user: none. For the developer or tester: fewer functions with no production caller, and one path each for label, extraction, and strategy-line rendering.

### Files
`chrome-extension/content.js`, `chrome-extension/background.js`, `chrome-extension/adapters/messaging.js`, `chrome-extension/lib/dr-number/parsing.js`, `chrome-extension/lib/dr-number/index.js`, `chrome-extension/sidebar.js`, `chrome-extension/tests/number.js`, `chrome-extension/tests/messaging-model.js`, `chrome-extension/tests/source-checks.js`, `chrome-extension/tests/sidebar.js`.

### Complexity
Removes one bus topic and its subscriber, one branch pair in `applyTable`, two functions, one regex, one computed field, and one ignored parameter on two formatters. Net verdict: removes.

### Simplicity
- Size: the code shrinks by about 50 production lines and a few dozen test assertions.
- Duplicates: `formatStrategyHeader` duplicates `renderTopBand`, and `truncateDecimals` duplicates `formatOriginal`.
- Removals: every item can come out without losing a requirement.
- Orphans: removing `floorDecimals` orphans `decimalCount`, so remove both together.
- Bounds: none.
- Current behavior: items 1, 2, 3 and 5 reproduce on main. Item 4 no longer reproduces.

### Refactor
(a) Deleting the duplicates replaces the work. (c) Another option routes `renderTopBand` through `formatStrategyHeader` so that one function builds the strategy line, and the tests would then cover the live path. Each item fits a `refactor/` pull request, because no behavior changes.

### Effort
S: deletions plus edits to the matching test blocks.

### Urgency
P3: no user impact and no correctness risk. It adds only minor reader friction, and it blocks no other work.

## #116 — Toolbar-icon open has no target for unlabelled div-grids (no prior right-click)

**Summary:** #116 · Toolbar-icon open has no target for unlabelled div-grids (no prior right-click) · close · M · P3

### Can it be closed
Yes. Its premise is obsolete. PR #29 removed the toolbar action on 2026-05-22, three weeks before this issue was filed, and `chrome-extension/manifest.json` declares no `action` today. The `state:sidebarOpened` subscriber in `content.js` is the only place that logs "No table targeted", and that log is a debug row. `background.js` publishes the topic only from the "Toggle and open sidebar" menu item, and that item requires a right-click. A sidebar opened from Chrome's own side-panel control shows "Right-click a table to connect it here." The instruction works on hosts that suppress the page menu: the capture-phase `contextmenu` listener still activates the table, adds a pillbox to a new unmarked grid, and flashes it.

### Can it be updated
Only if the owner wants unmarked grids to get a pillbox without a right-click. A rewrite would say this: an unmarked grid enters only on a right-click, through the geometry probe, so it has no pillbox before one. The options are hover tracking, or a geometry probe capped by element count that runs when the sidebar opens unbound. Vocabulary: "div-grid" → unmarked grid; "labelled" → marked; "target" → active table; "panel" → sidebar; "badge", "dot" → pillbox; "proactively badged" → found by the load-time scan ("proactive scan" is retired); "structural walk" → geometry probe; "toolbar icon" → Chrome's side-panel control.

A separate defect needs its own issue. The sidebar's `state:tableActivated` subscriber (`sidebar.js`) only flashes the sidebar. A right-click while the sidebar is open therefore does not pull settings or preview samples, because `state:selectedTableChanged` stays inside the page. This comes from reading the code and was not reproduced.

### New capability
For the user: the sidebar binds an unmarked grid without a right-click. For the developer or tester: none.

### Files
`chrome-extension/content.js`, `chrome-extension/lib/dr-table/detect.js`, `chrome-extension/sidebar.js`, `chrome-extension/ui-toggle.js`.

### Complexity
Hover tracking adds a page-wide listener, a stored element, and a way for a table to become active without a gesture. A capped probe adds a scan path, a cap setting in the detection settings, and a special case for an unbound sidebar. Net: adds.

### Simplicity
- Size: code grows. No requirement stands behind the growth, because the toolbar entry is gone.
- Duplicates: the probe would copy the right-click path's `findTargetTable` plus `markAndToggleIfNewGrid`.
- Removals: every step in both options can come out, because a right-click already covers the case.
- Orphans: none today.
- Bounds: a probe needs a cap on elements walked, which the issue leaves unstated.
- Current behavior: the toolbar claim and the `content.js:110` reference do not match main.

### Refactor
(c) Route `state:tableActivated` through the same sidebar pull as `state:tableSwitched`. A right-click with the sidebar open then binds the table, which removes the practical need for this issue.

### Effort
M: either option touches detection cost, the pillbox view, and activation rules on both table kinds.

### Urgency
P3: the right-click path works on every host, and no work is blocked.

## #217 — [follow-up] core.js restates two settings defaults that also live in defaults.js

**Summary:** #217 · [follow-up] core.js restates two settings defaults that also live in defaults.js · update then keep · S · P3

### Can it be closed
No. The duplicate is still on `main`. `chrome-extension/lib/dr-number/core.js:94-95` declares `DEFAULT_OFFSET_TOP = -0.5` and `DEFAULT_NUM_TOP = 1`. `DR_DEFAULTS` in `chrome-extension/constants.js` holds `offsetTop: -0.5` and `numTop: 1`. The only reader of the two core.js constants is `resolveRoundingSettings` in `chrome-extension/content.js:1096-1104`. No merged pull request removes them. The application model sprint named in the issue as the fix's home has merged without this change.

### Can it be updated
Yes. Corrections for the rewrite:
- The file is `constants.js`. No `defaults.js` exists.
- The user impact is narrower than the issue states. Every caller merges `DR_DEFAULTS` into the options first, so the core.js fallback applies only when a stored offset or top-band count is blank, not a number, or outside `VALIDATION_LIMIT`. If the two copies drift, only those invalid values round against the stale default.
- Vocabulary: `DR_DEFAULTS` is the settings contract. "Defaults record" also reads as settings record, the retired short form "record". Say "content script" for "page code". "App-model" breaks the diction rule. Say "application model".

A rewrite should say this: the content script's rounding fallback holds its own copy of two values from the settings contract, and the fix points that fallback at the contract and deletes the copy. Fold #225 into this issue. Once core.js holds no defaults, the test runner reads `DR_DEFAULTS` directly and its private copy goes in the same change.

### New capability
For the user: none, since rounding does not change. For the developer or tester: the default offset and top-band count change in one place, and the shared-case runner tests against the shipped values.

### Files
- `chrome-extension/lib/dr-number/core.js`
- `chrome-extension/content.js` (`resolveRoundingSettings`, header comments at lines 9 and 1539)
- `chrome-extension/constants.js`
- `chrome-extension/tests/number.js` (lines 2403-2418, #225)

### Complexity
The change removes two constants and one test-local copy of each. It adds no state, path, or option. Net verdict: removes.

### Simplicity
- Size: removes four constant lines and two stale comments, and changes two fallback arguments to `DR_DEFAULTS.offsetTop` and `DR_DEFAULTS.numTop`.
- Duplicates: passes through the core.js copy and the tests/number.js copy of the same two values. It removes both.
- Removals: the change adds nothing.
- Orphans: once `resolveRoundingSettings` reads `DR_DEFAULTS`, the two core.js constants have no reader. Delete them in the same change.
- Bounds: none.
- Current behavior: the duplication reproduces on `main`. The claimed user impact holds only for invalid stored values.

### Refactor
(a) The change is itself a refactor with no behavior change, so it fits a `refactor/` pull request. `DR_DEFAULTS` is already loaded ahead of core.js in both the manifest and `sidebar.html`. `js/round_dynamic.js` keeps its own constants because the Sheets add-on cannot load `constants.js`, and `docs/design.md` still documents those.

### Effort
S: two argument changes, four deleted lines, and a test edit. The existing suite proves the change.

### Urgency
P3: no current defect and no security risk. The change guards against drift and blocks no other work.

## #214 — [follow-up] dr-number bundle test forces every top-level function public and misses arrow-function consts

**Summary:** #214 · [follow-up] dr-number bundle test forces every top-level function public and misses arrow-function consts · update then keep · S · P3

### Can it be closed
No. On main, `drNumberBundleMatchesSourceDeclarations` in `chrome-extension/tests/source-checks.js` matches only `^function name` and requires `DR_NUMBER` keys to equal that set. `drSimplifyBundleMatchesSourceDeclarations` applies the same rule to `DR_SIMPLIFY`. No merged pull request changes either check. The suite passes (3638/0).

### Can it be updated
Yes. The defect reproduces with one correction. `identifiers.js` already holds two private arrow helpers, `wholeCellRe` and `spanRe`. They stay private only because the check skips arrow consts. Twelve `DR_NUMBER` entries have no reader outside the number library and the tests, among them `lettersToColIndex`, `bracketSignSpan`, and `isIsbnShape`. `DR_TABLE` has no check derived from the source, so `detect.js` keeps private helpers, two of them prefixed `_` (`_parsePx`, `_nearestPositionedAncestor`).

A rewrite should name all three packages and give two options:
1. Mark private helpers with a leading underscore. One shared extractor then reads function declarations and arrow consts, skips names with the underscore, and checks all three bundles.
2. Keep only the hand-copied lists, as `DR_TABLE` does now. A new function that no one adds to `index.js` then passes the tests unnoticed.

Recommend option 1. No retired synonyms appear in the issue. "Number library" matches the term docs/vocabulary.md uses. "Bundle", "public surface", and "helper" have no vocabulary entry, and the issue defines the last two inline.

### New capability
For the user: none.
For the developer or tester: a package can hold private helpers in either declaration style. All three bundles follow one checked rule for what is public.

### Files
- `chrome-extension/tests/source-checks.js`
- `chrome-extension/lib/dr-number/index.js`, `identifiers.js`, `parsing.js`
- `chrome-extension/lib/dr-simplify/index.js`, `ladder.js`
- `chrome-extension/lib/dr-table/index.js`, `detect.js`

### Complexity
Adds one naming rule, which is a special case. Removes the duplicated `FUNCTION_DECL_RE` extraction and the gap between the checks on `DR_TABLE` and on the other two bundles. Net: neutral.

### Simplicity
- Size: the tests shrink to one extractor, and `index.js` loses up to twelve entries.
- Duplicates: `FUNCTION_DECL_RE` appears twice (lines 1662 and 2048). Merge it first.
- Removals: the hand-copied `EXPECTED_DR_NUMBER_NAMES` list repeats the derived check and can come out.
- Orphans: a helper removed from `DR_NUMBER` still has callers inside the package. Tests that read it through `DR_NUMBER` need updating.
- Bounds: none. The extraction reads a fixed set of files.
- Current behavior: both claims reproduce. The arrow gap already hides two private helpers.

### Refactor
(b) Before the change, a `refactor/` pull request moves the extraction into one helper that checks `DR_NUMBER` and `DR_SIMPLIFY`. (c) Later work extends that helper to `DR_TABLE` so the three packages follow one rule.

### Effort
S: a regex and one helper in the tests, some renames, and removed bundle entries.

### Urgency
P3: no user impact and no correctness risk. It adds small developer friction and blocks nothing.

## #215 — [follow-up] leak detector's file list can drift from the manifest

**Summary:** #215 · [follow-up] leak detector's file list can drift from the manifest · update then keep · S · P3

### Can it be closed
No. The drift has already happened on main. `CONTENT_SCRIPT_FILES` in `manifestDrivenSourceLoading` (chrome-extension/tests/source-checks.js:1451) lists 14 files. `manifest.content_scripts[0].js` lists 19. Five files are missing from the hand list: `lib/dr-log/index.js`, `lib/dr-number/identifiers.js`, and the three `lib/dr-capture/*.js` files. If a test reads one of those five files by a literal name, the check does not catch it. No closed issue or merged pull request covers this. The suite passes (3638/0).

### Can it be updated
Yes. The issue describes the check wrongly. It tests nothing about scripts leaking variables into the page. The check scans the joined suite for content-script filename literals passed to `readFileSync` or `path.join`. The rewrite should say:
- Problem: the filename check builds its pattern from a hand list that is now missing five content scripts.
- Fix: build the pattern from `contentScriptFiles` (setup.js:59) and delete the hand list. This is better than the requested set-equality assertion because it leaves no second list to maintain.
- Related drift point: the hard-coded count of 19 and its sprint-by-sprint comment (source-checks.js:1533–1553).

Vocabulary: "leak detector" is not a vocabulary term. Call it "the filename-literal check in the source checks". "Script files" becomes "content scripts". "Test suite" becomes "joined suite" where the scan is meant. The issue uses no retired synonyms.

### New capability
For the user: none.
For the developer or tester: the check covers every content script the manifest lists, with no list to keep in step.

### Files
- chrome-extension/tests/source-checks.js (`manifestDrivenSourceLoading`)
- chrome-extension/tests/setup.js (`contentScriptFiles`)
- chrome-extension/manifest.json

### Complexity
Deriving the pattern from the manifest removes one duplicated list and the special case that someone must remember to update it. The requested assertion instead adds one check and keeps both lists. Net verdict: removes (derive); adds (assert).

### Simplicity
- Size: 8 lines removed and about 1 line changed.
- Duplicates: `CONTENT_SCRIPT_FILES` duplicates `contentScriptFiles`. Merge them.
- Removals: the count assertion can be replaced with a non-empty check, and its history comment can go.
- Orphans: once derived, `CONTENT_SCRIPT_FILES` has no reader. Remove it.
- Bounds: none. The scan walks the fixed joined suite text.
- Current behavior: confirmed. The hand list is missing 5 of the 19 manifest entries. No current test line reads one of those five files by a literal name, so the derived pattern passes today.

### Refactor
(a) It replaces the work. `const literalAlternation = contentScriptFiles.join('|')…` in place of the hand list is itself the fix. (c) In the same `refactor/` pull request, replace `length === 19` with a lower bound, or with an equality check against the files present on disk, to remove the second drift point.

### Effort
S: a one-line source change, a deleted list, and one suite run.

### Urgency
P3. No user impact. The gap weakens one test guard, and no violation exists today. No other work depends on it.

## #220 — [follow-up] NodeFilter is an unguarded bare global in getSuperscriptRanges

**Summary:** #220 · [follow-up] NodeFilter is an unguarded bare global in getSuperscriptRanges · update then keep · S · P3

### Can it be closed
No. The defect reproduces on `main`. `getSuperscriptRanges` in `chrome-extension/lib/dr-table/detect.js:642` takes `doc` through `opts.doc` but reads `NodeFilter.SHOW_TEXT` as a bare global. A test loaded the manifest scripts through `detect.js` into a `vm` context that has no `NodeFilter` and passed a stub `doc`. The call threw `ReferenceError: NodeFilter is not defined`. No closed issue or merged pull request fixes it. Pull requests #222 and #230 introduced the ports and left this read in place.

### Can it be updated
Yes. The issue understates the scope and gets one fact wrong.
- Scope: `detect.js` reads the bare `NodeFilter` at three sites: `getSuperscriptRanges` (642), `filterLinkMatches` (711), and `collectTextPieces` (751). `filterLinkMatches` also reads the bare `document` with no guard.
- Fact: `getSuperscriptRanges` is on the live rounding path. `classifyTableCell` in `content.js:1136` calls it for every cell that contains a `<sup>`. The extension does not crash because the browser defines `NodeFilter`. Detection does not call it.
- Vocabulary: "port" and "bare global" match docs/vocabulary.md. The issue uses no retired synonyms. The vocabulary does not define "embedder". The rewrite should say "a caller outside the extension".
- A rewrite should say: the detection layer routes its environment reads through ports, but three text-node walks still read the page's `NodeFilter` directly, and one walk also reads the page's `document` directly. A caller outside the extension with no such globals gets an exception instead of a safe default. Fix: add one module constant for SHOW_TEXT with the value 4 as the fallback, the same pattern as `DR_TABLE_ELEMENT_NODE` at line 48, and route `filterLinkMatches` through the same guarded walk.

### New capability
For the user: none. Extension behavior does not change.
For the developer or tester: `lib/dr-table` runs in a bare Node or `vm` context without a `NodeFilter` stub. Test harnesses can then drop their `NodeFilter: { SHOW_TEXT: 4 }` stubs for these paths.

### Files
- `chrome-extension/lib/dr-table/detect.js`
- `chrome-extension/tests/detection.js` (superscript tests at 320–401)
- `chrome-extension/tests/helpers.js`, `chrome-extension/tests/setup.js` (NodeFilter stubs)

### Complexity
Adds one module constant. Removes three bare-global reads and one unguarded `document` read. Removes one duplicate walk if `filterLinkMatches` reuses `collectTextPieces`. Net verdict: removes.

### Simplicity
- Size: the code shrinks or stays the same size. One constant replaces three bare reads.
- Duplicates: all three functions build their own text-node walk. `filterLinkMatches` rebuilds the list that `collectTextPieces` already returns.
- Removals: the change adds nothing that can come out.
- Orphans: none in the source. Some test `NodeFilter` stubs may no longer be needed.
- Bounds: nothing unbounded. Each walk covers one cell's subtree.
- Current behavior: the ReferenceError reproduces. The issue's "off the live path" does not match the code.

### Refactor
(b) Precede the fix with a `refactor/` pull request. First, `filterLinkMatches` calls `collectTextPieces`. That removes one walk site and the unguarded `document` read. Second, `collectTextPieces` takes an optional `opts.doc`, so `getSuperscriptRanges` can collect its nodes through it too. That leaves one walk site that reads SHOW_TEXT. The second step changes one behavior: with no `createTreeWalker`, `getSuperscriptRanges` would return real ranges from the child-node fallback instead of `[]`. The test at `tests/detection.js:381` pins the current `[]`. That step needs a product choice, or it stays out of the refactor.

### Effort
S: one constant, a few call-site edits, and a small `vm` test.

### Urgency
P3. No user sees the defect, it creates no correctness or security risk, and it blocks no other work. It matters only when a caller outside the extension uses `lib/dr-table`.

## #221 — [follow-up] detection and rounding parse numbers differently

**Summary:** #221 · [follow-up] detection and rounding parse numbers differently · update then keep · M · P3

### Can it be closed
No. The split still reproduces on main. `DEFAULT_NUMERIC_PROBE` in `chrome-extension/lib/dr-table/detect.js` strips format marks and commas, then runs `parseFloat`. It returns null for "(1,234)" and "−1,234". It returns 416 for "416-555-1234", 4165551234 for "416 555 1234", 192.168 for "192.168.0.1", and 3.5 for "3.5 kg". `tests/detection.js` asserts this behavior on purpose. No merged pull request changes it.

### Can it be updated
Yes. The premise is out of date. Rounding no longer depends on `toNumber` alone. It runs the classification ladder (`classifyCell` in `lib/dr-simplify/ladder.js`), which already rounds dates, times, unit numbers, bracketed numbers, and extracted cells. The mismatches that remain:
- The data test accepts identifier shapes, which the ladder skips.
- The data test rejects bracketed numbers and unicode minus signs, which the ladder rounds.
- The data test rejects extracted cells whose text does not start with a digit ("about 1,200 units").
- The data test ignores settings. A table of "3.5 kg" cells gets a pillbox even when the "words" setting is off and nothing rounds.

A rewrite should compare the data test's numeric probe with the classification ladder and list those four cases. It should also put one product choice to the product manager: settings-independent detection (every ladder option on) or settings-aware detection.

Vocabulary: "rounding control" and "toggle" (the control) become pillbox. "Accounting-style negatives" becomes bracketed number. "Rounding pass" becomes classification ladder. "Numeric enough" becomes passes the data test. "3.5 kg" is an extracted cell, not a unit number. "Decides" personifies detection.

### New capability
For the user: a table gets a pillbox exactly when simplifying it would change a cell. A table of phone numbers gets none. A table of only bracketed numbers gets one.
For the developer or tester: one number-reading rule to test. `tests/detection.js` lines 150–230 turn into assertions that detection matches the ladder.

### Files
`chrome-extension/lib/dr-table/detect.js`, `chrome-extension/lib/dr-simplify/ladder.js`, `chrome-extension/lib/dr-number/core.js`, `chrome-extension/lib/dr-number/identifiers.js`, `chrome-extension/tests/detection.js`, `docs/test-pages/tables.html`, `docs/vocabulary.md` (data test, currency list), `docs/design.md`.

### Complexity
Removes one parse path (the `parseFloat` probe). Adds no state. A settings-aware choice would add a dependency from detection on the settings record, which is a new path. Net: removes, if detection stays settings-independent.

### Simplicity
- Size: shrinks. The probe body and its long rationale comment go away.
- Duplicates: the probe and `toNumber` both read `CLEAN_REGEX` and parse separately. Merge them.
- Removals: the `opts.numericProbe` port stays, because tests inject counting probes through it.
- Orphans: the "deliberately does NOT delegate" comment and the regression block's framing lose their reason.
- Bounds: the existing 1000-read budget covers the walk. The ladder costs more per cell but stays inside that cap.
- Current behavior: the issue's "detection accepts what rounding rejects" holds only for identifier shapes and settings-disabled cells. Dates, times, and "3.5 kg" now round too.

### Refactor
(b) First, in a `refactor/` pull request, expose one "would the ladder simplify this cell" predicate from `lib/dr-simplify`, with all options on. (a) Then point `DEFAULT_NUMERIC_PROBE` at that predicate, which does the whole job.

### Effort
M: the code change is small. Fixtures, a new manual test page section, and doc updates take the rest.

### Urgency
P3: edge-case tables show a pillbox that does nothing, or show none. There is no correctness or security risk, and no other work waits on this.

## #223 — [follow-up] Python lacks the integer re-round on non-integer steps

**Summary:** #223 · [follow-up] Python lacks the integer re-round on non-integer steps · update then keep · S · P2

### Can it be closed
No. The defect reproduces on `main`. `roundWithOffset` in `js/round_dynamic.js` and in `chrome-extension/lib/dr-number/rounding.js` still snaps any result of 10 or more to a whole number. `_round_with_offset` in `python/dynamic_rounding/__init__.py` has no such rule. With offset -1.75, 603.84 gives 608 in JavaScript and 607.5 in Python. No merged pull request touches the rule, and #226 left it in place.

### Can it be updated
Yes. The issue says the gap appears only with fractional steps, and that is too narrow. The gap appears whenever the step is below 1 and the result is 10 or more, and integer offsets reach that case too. With offset -4, 1234.5678 gives 1235 in JavaScript and 1234.6 in Python. With offset -2.5, 12.34 gives 12 in JavaScript. That result ignores the 0.05 step the offset asks for. The snap works like a float cleanup, but `toPrecision(12)` already strips float noise, so the snap only drops precision the user asked for. A rewrite should offer two options and ask for a product choice: (1) port the snap to Python, or (2) remove the snap from both JavaScript copies. Either option adds shared cases with a step below 1 and a result of 10 or more. For vocabulary: "shared cases" is not a defined term, so describe it as the one table of inputs and outputs every rounding core must match. "Re-round" is not defined either, so define it in the issue or describe the rule by what it does. "Step" matches the vocabulary.

### New capability
For the user: the same call gives the same number in Python, Sheets, and the extension. For the developer or tester: the shared cases cover sub-unit steps on results of 10 or more.

### Files
- `python/dynamic_rounding/__init__.py`
- `js/round_dynamic.js`
- `chrome-extension/lib/dr-number/rounding.js`
- `js/round-dynamic-cases.json`
- `python/tests/test_round_dynamic_cases.py`
- `docs/design.md`

### Complexity
Option 1 adds one branch to Python, so the net verdict is adds. Option 2 removes one branch from each JavaScript copy, so the net verdict is removes.

### Simplicity
- Size: option 1 adds about 2 lines, and option 2 removes about 6 lines.
- Duplicates: `roundWithOffset` exists in two JavaScript copies, and the Python port is a third.
- Removals: the snap can come out because `toPrecision(12)` already does its noise cleanup.
- Orphans: neither option leaves anything with no reader.
- Bounds: nothing unbounded.
- Current behavior: 603.84 at -1.75 gives 608 in JavaScript and 607.5 in Python, confirmed on `main`.

### Refactor
(b) Loading the extension's `rounding.js` into `js/round_dynamic.js`, or generating one from the other, would leave one JavaScript copy to edit before the Python change. (c) Removing the snap collapses a branch and makes the result follow the step that the lens preview displays.

### Effort
S: one branch in one or two places, plus a few shared cases.

### Urgency
P2: shipped surfaces give different numbers for the same input. No work is blocked, and the default offset never reaches the case.

## #224 — [follow-up] inf/nan strings crash round_dynamic_series

**Summary:** #224 · [follow-up] inf/nan strings crash round_dynamic_series · update then keep · S · P2

### Can it be closed
No. The defect reproduces on `main`. `_parse_number` in `python/dynamic_rounding/pandas.py` calls `math.isfinite` in its numeric branch only. Its string branch returns `float(cleaned)` unchecked. For "inf", "-inf", "Infinity", "infinity", "1e999", "$inf" and "(inf)", `math.log10` and `_round_with_offset` raise `OverflowError`. For "nan" and "NaN" they raise `ValueError`. `js/round_dynamic.js` `toNumber` checks `isFinite` on the parsed string, so the JavaScript library returns all of these inputs unchanged. `round_dynamic()` in `python/dynamic_rounding/__init__.py` parses no strings and is safe. PR #226 surfaced the defect and did not fix it.

### Can it be updated
Yes, on scope and vocabulary.
- The issue limits the crash to set-aware calls. `_single_mode_series` crashes too. The set-aware path fails even earlier, in `_find_max_magnitude_series`, before any cell is rounded.
- "Dataset mode" becomes "set-aware" (`docs/vocabulary.md`). Code identifiers such as `_dataset_mode_series` keep their names.
- "Passes through untouched" becomes "pass-through".
- "Poisoned cell" has no entry in `docs/vocabulary.md`. Say "a cell holding a non-finite string".
- "Single-value function" becomes `round_dynamic()`.

A rewrite should say the following. `round_dynamic_series` raises on any string that parses to an infinite or not-a-number value, in both single and set-aware calls, and the whole call fails. The fix adds the finite check to the string branch so these strings become pass-through. It also adds a group to `js/round-dynamic-cases.json`, modeled on the existing "Unicode digits pass through unchanged" group. That group should cover "inf", "Infinity", "nan", "1e999" and "(inf)", with single and set-aware params.

### New capability
For the user: a cell holding a non-finite string returns unchanged, and the rest of the series rounds. Python and JavaScript agree on this input.
For the developer or tester: the shared case table pins non-finite strings across the Python library, the Google Sheets function and the extension (`chrome-extension/tests/number.js`).

### Files
- `python/dynamic_rounding/pandas.py`
- `js/round-dynamic-cases.json`
- `python/tests/test_round_dynamic_cases.py` (no change expected)

### Complexity
The change adds no states, paths, configuration options or abstractions. It adds one finite check in an existing branch and removes an asymmetry between the numeric and string branches. Net: neutral.

### Simplicity
- Size: the change adds one condition and about eight case rows and removes nothing.
- Duplicates: the `round_value` closures in `_single_mode_series` and `_dataset_mode_series` duplicate each other. A fix inside `_parse_number` covers both closures and `_find_max_magnitude_series` at once.
- Removals: nothing the change adds can come out.
- Orphans: none.
- Bounds: nothing unbounded.
- Current behavior: the issue's crash claim matches the code. The claim that only set-aware calls crash does not match.

### Refactor
(c) Restructure `_parse_number` so both branches produce a float and share one final `math.isfinite` check. That leaves one guard for both input types. (b) Merging the two `round_value` closures is a separate `refactor/` pull request and is not required.

### Effort
S: a one-line guard plus table rows. The pattern follows the existing `isascii()` fix.

### Urgency
P2. A crash aborts a whole call for Python users on unusual input, and the Python and JavaScript libraries disagree on that input. The input is rare, there is no security exposure, and no other work is blocked.

## #225 — [follow-up] shared-case runner hardcodes the extension defaults

**Summary:** #225 · [follow-up] shared-case runner hardcodes the extension defaults · merge into #217 · S · P3

### Can it be closed
No. The defect is still present on main (7036cd4). `sharedCaseTable()` now sits in `chrome-extension/tests/number.js:2398`. It still declares `SHARED_DEFAULT_OFFSET = -0.5` and `SHARED_DEFAULT_NUM_TOP = 1` (lines 2408–2409), and no check compares them with `DEFAULT_OFFSET_TOP`/`DEFAULT_NUM_TOP` in `lib/dr-number/core.js:94–95` or with `DR_DEFAULTS` in `constants.js`. No merged pull request touches these constants. The suite passes (3638/0).

### Can it be updated
Four paths are stale. The runner has moved from `chrome-extension/tests.js` to the test piece `tests/number.js`. #217 refers to `defaults.js`, and that file is now `constants.js`. The shared table runs against three copies of dynamic rounding (extension, `js/`, `python/`), and the issue counts only two. The suggested regex over `sourceByName('lib/dr-number/core.js')` also has a simpler neighbor. `setup.js` already exposes `DR_DEFAULTS` as a global, and it exposes `CAPTURE_FORMAT` the same way "to pin against the source of truth instead of a literal".

On vocabulary, the issue uses no retired synonym. A rewrite should use "contract" or "settings contract" for `DR_DEFAULTS`, and "test piece" for `tests/number.js`. It should replace "product defaults" with "the defaults in the settings contract".

A rewrite should say: the shared case runner in the test piece holds its own copy of the `offset_top` and `num_top` defaults. Once #217 removes the copy in the number library, the runner reads `DR_DEFAULTS.offsetTop` and `DR_DEFAULTS.numTop`. The fix belongs in the same pull request as #217.

### New capability
For the user: none.
For the developer or tester: a change to a default in the settings contract reaches the shared case runner, and a mismatch fails the suite.

### Files
- `chrome-extension/tests/number.js` (`sharedCaseTable`)
- `chrome-extension/lib/dr-number/core.js`
- `chrome-extension/constants.js`
- `chrome-extension/tests/setup.js`

### Complexity
The change removes two test constants and their comment. It adds no state, path, option, or abstraction. Net: removes.

### Simplicity
- **Size:** smaller. Two constants and a five-line comment go, and two global reads replace them.
- **Duplicates:** the change passes through the triple copy of the defaults (core.js, constants.js, test). #217 merges the first two.
- **Removals:** everything added is two reads of `DR_DEFAULTS`, and nothing further can come out.
- **Orphans:** the comment at lines 2403–2407 loses its subject and goes in the same change.
- **Bounds:** none. The walk covers a fixed JSON table.
- **Current behavior:** the issue's statement matches the code, except the file path.

### Refactor
(b) #217 precedes the fix, because it deletes the core.js constants and makes `DR_DEFAULTS` the one source. (a) Once #217 lands, pointing the runner at `DR_DEFAULTS` is a two-line edit. That edit replaces the regex approach, so this issue belongs inside #217.

### Effort
S. The change edits two lines in one test piece and deletes a comment.

### Urgency
P3. Users see nothing, and the gap exists only in the tests. A default change would pass the shared cases against stale values. No other work waits on it.

## #236 — [follow-up] the roundTable result's applied field has no reader

**Summary:** #236 · [follow-up] the roundTable result's applied field has no reader · merge into #202 · S · P3

### Can it be closed
Not as written, but the issue's risk no longer exists. `roundTable` (`chrome-extension/content.js:1501`) still returns `applied`. On main, the only readers are one debug log line (`content.js:335`) and one test (`chrome-extension/tests/rounding-pass.js:3445`). The application model now stores the "did any cell change" fact as the registry's form (`DR_STORE.setTableAppliedFlag`, set from `landedCells > 0`). The marker-class check at `content.js:336` guards `intent:updateMenuLabel`. That topic always sends "Toggle table", which is the title `background.js:18` gives the menu item at creation. The two facts can still diverge, but the divergence has no effect on the product. #202 item 1 already covers that no-op title update.

### Can it be updated
A rewrite should say this: the engine returns a "pass ran" field that only a debug log and one test read. The menu toggle's title update reads the marker class, and it sets the title the item already has. Options: drop the field, or keep it as log detail only. Also remove the title update under #202. Urgency: low. Vocabulary: "dead reporting" becomes "never used"; "menu-label logic" becomes "the menu toggle's title update"; "app-model sprints" becomes "application model"; "applied flag" becomes the table's "form"; the `dr-ext-rounded` class is a "marker class". "Engine result" has no entry in docs/vocabulary.md. Write it as "the value the simplification pass returns".

### New capability
For the user: none. For the developer or tester: one fewer return field to keep, and the model's form becomes the only record of whether a pass changed cells.

### Files
`chrome-extension/content.js` (`roundTable`, `applySidebarRounding`, `resimplifyReplacedTable`), `chrome-extension/tests/rounding-pass.js`, `chrome-extension/background.js`, `chrome-extension/adapters/messaging.js:162`.

### Complexity
Dropping `applied` removes one returned field and one test assertion. Dropping the title update under #202 removes a branch, a marker-class query, and a topic. Net: removes.

### Simplicity
- **Size:** the code shrinks by three return fields, one log fragment, and one assertion, and nothing is added.
- **Duplicates:** the marker-class query and the registry form hold the same fact in two places.
- **Removals:** the field and the menu title branch can both come out without losing a requirement.
- **Orphans:** after #202 removes it, `intent:updateMenuLabel` and its `background.js:78` subscriber have no publisher. Remove both.
- **Bounds:** nothing unbounded.
- **Current behavior:** confirmed on main. `applied` has no production reader, and the title update sets an unchanged title.

### Refactor
(a) One `refactor/` pull request resolves this issue and #202 item 1 together. It removes `applied`, the marker-class branch at `content.js:336-342`, and the `intent:updateMenuLabel` topic. The existing suite proves it after the one assertion at `rounding-pass.js:3445` is removed.

### Effort
S: a few lines across three files, with no behavior change.

### Urgency
P3. Users see no effect, the change carries no correctness risk, and no other work waits on it.

## #237 — [follow-up] widen the engine-messaging locks

**Summary:** #237 · [follow-up] widen the engine-messaging locks · update then keep · S · P3

### Can it be closed
Half of it can. The message-pin half no longer applies. #241 removed `runToggleAction` and `toggleOriginalValues`. A pillbox press now writes the settings record, and the `state:settingsChanged` subscriber runs `applySidebarRounding`, which is the only path to `roundTable`. Two tests now pin the message sequences: `engineReturnsResults_rangeStatusMessageSequence` in `tests/source-checks.js` covers the apply, and `toggleSplit_parentEquivalence_toggleClickSequences` in `tests/messaging-model.js` covers a press on the active table and a press on another table.

The scan half is still partly open. `content.js` holds no `chrome.` reference, because all its messaging goes through `DR_BUS`. The whole-file test `contentPublishesThroughBus` checks only for `chrome.runtime.sendMessage`. The engine scan still checks five named functions for `chrome.`, and that check can no longer fail. No test stops an engine function from calling `DR_BUS.publish`.

### Can it be updated
A rewrite should drop the pin work and restate the boundary in current terms. The simplification pass returns results, and the controller publishes topics on the event bus. The change has two parts:
- Assert that no content-script file except `adapters/messaging.js` contains `chrome.`.
- Assert that the engine functions contain no `DR_BUS.publish`, or replace the named list with a marked controller boundary in `content.js`. No such marker exists today, and the controller and engine code are interleaved in the file.

Vocabulary changes:
- "coordinator" becomes "controller".
- "talk to the browser" becomes "publish a cross-context topic".
- "engine" becomes "the simplification pass", or it gets a definition in `docs/vocabulary.md`.
- "user flows" becomes "pillbox press, menu toggle, apply".

The issue uses no retired synonym from the table.

### New capability
For the user: none.
For the developer or tester: a test fails when engine code publishes on the bus or when content-script code calls Chrome directly.

### Files
- `chrome-extension/tests/source-checks.js` (`engineFunctions_sourceScan_noChromeCalls`, `contentPublishesThroughBus`)
- `chrome-extension/content.js`
- `chrome-extension/manifest.json` (the content-script list)

### Complexity
The change removes one special case, the five-name list whose `chrome.` check can no longer fail. It adds one file-wide assertion and one assertion that the engine does not publish. A boundary marker would add a comment convention. Net: neutral.

### Simplicity
- **Size:** A few lines of assertions replace a brace-matching scan whose check cannot fail.
- **Duplicates:** The engine scan and `contentPublishesThroughBus` both check `content.js` for `chrome` calls. Merge them.
- **Removals:** The `chrome.` check inside `ENGINE_FNS` can go.
- **Orphans:** `extractFunctionBody` loses its reader in the engine scan unless the publish check reuses it.
- **Bounds:** None. The scans read a fixed set of files.
- **Current behavior:** `content.js` has zero `chrome.` references, and both press cells and the apply have pinned sequences. The claim that two flows are unpinned no longer holds on `main`.

### Refactor
(a) Widening `contentPublishesThroughBus` to reject any `chrome.` in content-script files replaces the scan half. Changing `ENGINE_FNS` to test for `DR_BUS.publish` covers the rest.

### Effort
S: the change is test-only and confined to one test file.

### Urgency
P3: users see no effect, nothing depends on it, and the current code already respects the boundary.

## #246 — [follow-up] the controller reaches into the toggle view's registries

**Summary:** #246 · [follow-up] the controller reaches into the toggle view's registries · update then keep · S · P3

### Can it be closed
No. On `main`, `teardownTableEntry` in `chrome-extension/content.js` (lines 599–612) still reads `tableToggles`, `tableResizeObservers`, and `trackedTables`, which `chrome-extension/ui-toggle.js` declares (lines 54–60). No merged pull request moves this reach. Open issue #389 covers a separate reach between the same two files, from the pillbox view into the controller.

### Can it be updated
Yes. The finding still holds, but the issue describes the call site wrongly. The code now sits in one shared teardown function with two callers: the removal observer and the shape-fingerprint mismatch path. It is no longer inline in the mutation observer. Vocabulary fixes:
- "toggle view" and "toggle widget" become "pillbox view". "Toggle" names the act, and the control is the pillbox.
- "registries" becomes "bookkeeping maps". "Registry" names only the application model's table list.
- "private records" becomes "maps". "Record" is a retired synonym for settings record.
- "the layer that decides" breaks the personification rule. Use "the component that turns intents into writes".

A rewrite should say this: the controller's per-table teardown removes the pillbox, disconnects the pillbox's resize observer, and drops the table from the scroll-reposition list by reading three pillbox-view maps directly. The fix is one pillbox-view function, e.g. `removeToggleForTable(table)`, that the teardown calls. The controller then keeps `unwatchTable` and `DR_STORE.unregisterTable`.

### New capability
For the user: none.
For the developer or tester: the pillbox view can change its bookkeeping without any controller edit. Teardown of pillbox state becomes testable as one call.

### Files
- `chrome-extension/content.js` (`teardownTableEntry`)
- `chrome-extension/ui-toggle.js` (maps, `createToggleForTable`)
- `chrome-extension/tests/pillbox.js`
- `chrome-extension/tests/rounding-pass.js`

### Complexity
Adds one function, the pillbox-view teardown entry point. It removes one cross-component read of three maps. It adds no states, settings, or special cases. Net verdict: neutral.

### Simplicity
- **Size:** about 10 lines move between files and one function is added, so the size stays about the same.
- **Duplicates:** `createToggleForTable` writes the three maps. The new entry point is its exact inverse, so the two belong side by side.
- **Removals:** nothing to remove. All three cleanup steps are needed.
- **Orphans:** none. Tests read `tableToggles` through the joined suite, and those reads keep working.
- **Bounds:** none. The teardown touches one table.
- **Current behavior:** the reach reproduces on `main`. The "mutation-observer teardown" location is out of date.

### Refactor
(b) This change can come first, as a behavior-free `refactor/` pull request. It pairs with #389: together they make the pillbox view and the controller meet only through defined calls. Doing both in one pass also covers `createToggleForTable` calling `DR_STORE.registerTable` from the view, which is the same boundary question.

### Effort
S. One function moves across a file boundary, and the existing suite covers the behavior.

### Urgency
P3. There is no user impact, no correctness risk, and nothing is blocked. It only causes developer friction when someone edits the pillbox view's bookkeeping.

## #249 — [follow-up] the no-active-tab status message is gone from the settings send path

**Summary:** #249 · [follow-up] the no-active-tab status message is gone from the settings send path · close · S · P3

### Can it be closed
Yes. The silent failure no longer reproduces on `main`. The apply became a request topic (`request:applySettings`) in the #325 work (PR #347), and the delivery-outcome callback `onDelivery` is gone from the bus. A test in `chrome-extension/tests/messaging-model.js` pins its removal. When the tab query returns no tab, `sendToTab` in `chrome-extension/adapters/messaging.js` passes `undefined` to the reply callback right away. `applyNow` in `chrome-extension/sidebar.js` then calls `setTableBound(false)`. That call turns the switch off and writes "Right-click a table to connect it here." to the status line. A missing content script and a missing responder take the same path. The user therefore sees the unbound state and never believes the settings applied. The issue already carries the `wontfix` label.

### Can it be updated
No rewrite is needed if the issue closes. A rewrite would need these vocabulary fixes. "Panel" is a retired synonym: use sidebar. "Bus relay" and "internal channel" should read event bus and request topic. "Active tab" should read bound tab, or active when it means the table. "Settings send path" should read apply. "Report" in the sense of the bus sending a message is retired: use publish, or say the request goes unanswered. The only remaining request would be a separate status text for "no tab" versus "no content script". Both cases mean no bound table, so one message fits both.

### New capability
For the user: none beyond today's behavior. An apply with nothing to receive it already shows the unbound state. For the developer or tester: none.

### Files
`chrome-extension/adapters/messaging.js` (`sendToTab`, `request`), `chrome-extension/sidebar.js` (`applyNow`, `setTableBound`), `chrome-extension/tests/messaging-model.js`, `chrome-extension/tests/sidebar.js`.

### Complexity
The original proposal adds a third reply outcome ("no tab") to the bus and a second status message to the sidebar. The present code returns one outcome, which is the absence of an answer. Net verdict for the proposal: adds. Closing the issue changes nothing.

### Simplicity
- Size: no change is needed. The proposal would grow the bus reply shape.
- Duplicates: none. The request path already has one reply shape.
- Removals: the proposed "no tab" outcome can come out, because the unbound state already covers it.
- Orphans: none. `onDelivery` is fully removed.
- Bounds: none. The absence of an answer arrives with no wait.
- Current behavior: the issue's claim no longer matches `main`. The no-tab case now shows the no-table status message.

### Refactor
(a) Done already. Collapsing the delivery callback into the request path (#325, PR #347) replaced the work.

### Effort
S: closing only. The code needs no change.

### Urgency
P3. No user impact remains. Nothing depends on this issue.

## #244 — [follow-up] widen the toggle-view call scan to an allowlist

**Summary:** #244 · [follow-up] widen the toggle-view call scan to an allowlist · update then keep · S · P3

### Can it be closed
No. The scan in `chrome-extension/tests/source-checks.js` (`toggleSplit_viewCallsNoControllerFunctionDirectly`) still holds a hand-written list. The two names the issue cites exist nowhere in the code today. After #241 the list holds three real controller functions: `applySidebarRounding`, `resetTable`, `roundTable`. The issue says the widened scan passes on today's code. That is false on `main`. `injectTableToggles` in `ui-toggle.js` calls `consumeNominations` in `content.js`, so a scan built from every top-level function in `content.js` fails as soon as it lands. #389 tracks that call.

### Can it be updated
A rewrite should say this:
- **Problem:** the check that keeps the pillbox view from calling the controller directly tests three named functions. A direct call to any other controller function passes.
- **Solution options:** (a) build the forbidden set from the top-level function names in `content.js`, read from the source file itself, with an empty exception list. This depends on #389 path (a), which moves the load-time scan's grid pass into the controller. (b) Build the same set with `consumeNominations` as the one listed exception, which matches #389 path (b). The same scan can cover `ui-toast.js`, the toast view. It calls no controller function today.
- **Urgency:** low. It depends on the #389 decision.
- **Vocabulary:**
  - "toggle view" is retired: "toggle" is not the control. Use "pillbox view".
  - "coordinator" becomes "controller".
  - "display layer" becomes "view".
  - "allowlist" is misleading. The permitted set is empty, so the check is a forbidden set derived from the source. Describe it that way.

### New capability
For the user: none.
For the developer or tester: any new direct call from a view to a controller function fails the suite, whatever its name.

### Files
- `chrome-extension/tests/source-checks.js`
- `chrome-extension/content.js`
- `chrome-extension/ui-toggle.js`
- `chrome-extension/ui-toast.js`

### Complexity
The change removes one hand-kept list, `FORBIDDEN_CONTROLLER_CALLS`. It adds a parse of `content.js` and possibly an exception list. Net: neutral.

### Simplicity
- **Size:** roughly equal. A regex parse replaces a three-name array.
- **Duplicates:** `topLevelBindingNames` in `tests/messaging-model.js` already parses `content.js` top-level names. Share that helper.
- **Removals:** the "every forbidden name is real" sanity check becomes a check that the parse found at least one name.
- **Orphans:** `FORBIDDEN_CONTROLLER_CALLS` loses its only reader. Remove it.
- **Bounds:** none. The scan reads two fixed files.
- **Current behavior:** the "passes on today's code" claim does not hold. `consumeNominations` is called at `ui-toggle.js:384`.

### Refactor
(b) precede: resolve #389 path (a) first. That removes the one exception and leaves the scan with no special case. #246 is the mirror breach (the controller reads the view's registries). A scan in that direction can follow the same pattern.

### Effort
S. The change is one test block and a shared parse helper.

### Urgency
P3. The check affects tests only, users see nothing, nothing waits on it, and it waits on the #389 decision.

## #250 — [follow-up] pin the depth counter's recovery when a subscriber throws

**Summary:** #250 · [follow-up] pin the depth counter's recovery when a subscriber throws · update then keep · S · P3

### Can it be closed
No. `publish()` in `chrome-extension/adapters/messaging.js` raises `publishDepth` and lowers it in a `finally`. `deliverLocally()` catches nothing, so a subscriber's error reaches that `finally`. A node run on main threw from a subscriber 25 times, which is more than `MAX_PUBLISH_DEPTH` (20). The next publish then ran without error, so the product behaves correctly. Two tests cover the counter's recovery: `appModelSettings_busReentrancy_unguardedCycleTerminatesSafely` in `tests/sidebar.js` covers the depth-cap error, and `busDepthGuardCoversResponders` in `tests/messaging-model.js` covers a responder cycle. No test covers a subscriber error. No merged pull request covers it.

### Can it be updated
Yes. The vocabulary already matches the canon: event bus, subscriber, publish. The rewrite should also name the depth counter as the bus's count of nested publishes, and "responder" for the request path. The rewrite should state one test-design constraint. A single error followed by a single publish proves nothing, because a counter that leaks one level stays under the cap of 20. The test must make the subscriber throw more times than the cap allows, on the same bus, and then assert that a later publish does not throw. It should build its bus with `makeBusSandbox()`, so the shared bus stays clean. Optionally, the same test can cover a responder that throws, which is also untested. Urgency stays low.

### New capability
For the user: none. For the developer or tester: a test that turns red when an edit breaks the counter's recovery after a subscriber error.

### Files
- `chrome-extension/tests/messaging-model.js` (new test beside `busDepthGuardCoversResponders`)
- `chrome-extension/tests/helpers.js` (`makeBusSandbox`, reused unchanged)
- `chrome-extension/adapters/messaging.js` (code under test, unchanged)

### Complexity
It adds one test function and no product states, paths, options, abstractions, or special cases. Net: neutral.

### Simplicity
- Size: adds one test of about 20 lines and no product code.
- Duplicates: the new test repeats the recovery assertion from the two existing tests. A shared helper that asserts recovery could replace all three.
- Removals: nothing to remove.
- Orphans: none.
- Bounds: the throw loop needs a cap. The value is `MAX_PUBLISH_DEPTH + 1` (21), the fewest throws that expose a leak of one level. The loop stops when it reaches that count.
- Current behavior: the issue's claim matches main. The `finally` covers the subscriber error, and the subscriber case has no test.

### Refactor
(b) Before or with the work, a helper such as `assertBusDepthRecovers(bus)` could publish more times than the cap allows, and the three recovery checks could share it. That removes the repeated recovery assertions. (a) and (c) do not apply.

### Effort
S: one test in the existing sandbox, with no product change.

### Urgency
P3: a test gap only. There is no user impact, no correctness or security risk today, and no other work waits on it.

## #255 — [follow-up] widen the marker-read static lock

**Summary:** #255 · [follow-up] widen the marker-read static lock · merge into #256 · S · P3

### Can it be closed
No. The gap still exists on main. `registrySprint_noMarkerClassReadLock` in `chrome-extension/tests/source-checks.js` (around line 2325) matches two patterns only: `classList.contains('dr-ext-grid')` and `.closest('.dr-ext-grid')`. A `querySelector`, `matches`, or `getElementsByClassName` read passes the check. The check also scans three files only (`content.js`, `ui-toggle.js`, `lib/dr-table/detect.js`). The other content-script files listed in `manifest.json`, including `app/store.js`, go unscanned. No merged pull request after #258 changes the check.

### Can it be updated
Yes. "Marker" should be "marker class", the canonical term in docs/vocabulary.md. "Tables it manages" should be "data tables in the registry". "Static lock" is not in the vocabulary. "Source check" matches the file name. The issue refers to "the one place allowed to write it", but `content.js` has three write sites (lines 216, 378, 568). #256 counts four, and main now has three. A rewrite should say this: the source check catches two read forms in three files, and the fix is to fail on any appearance of the class string outside a `classList.add` call, in every content-script file. Then #256 settles the writes. If #256 removes them, the check becomes "the class string appears nowhere in production source" and needs no exception for writes.

### New capability
For the user: none. For the developer or tester: every read form of the marker class fails the suite, in every content-script file.

### Files
- `chrome-extension/tests/source-checks.js` (the check)
- `chrome-extension/tests/setup.js` (`sourceByName`, `contentScriptFiles`)
- `chrome-extension/content.js` (write sites, if #256 removes them)

### Complexity
It removes the list of read patterns and the hand-picked file list. It adds one pattern and a scan over all content-script files. If #256 drops the writes, the exception for `classList.add` also goes. Net: removes.

### Simplicity
- Size: the check shrinks from two regexes to one. The file list becomes the manifest list.
- Duplicates: the file list duplicates `contentScriptFiles` in `tests/setup.js`. The fix should reuse that list.
- Removals: if #256 removes the writes, the `classList.add` exception comes out.
- Orphans: the marker class has three writers and no reader, and no stylesheet uses it. #256 covers this.
- Bounds: none. The check runs over a fixed file list.
- Current behavior: confirmed. The two-pattern regex and the three-file scan are on main.

### Refactor
(a) If #256 deletes the three writes, the widened check reduces to "no `dr-ext-grid` in production source", a one-line test. That change replaces most of this issue. (c) The check should iterate `contentScriptFiles` from `tests/setup.js` so that new files are scanned automatically.

### Effort
S. The change covers one test function and, if merged with #256, three deleted lines in `content.js`.

### Urgency
P3. The check covers test coverage only. No code reads the marker class today, so no user impact follows and no other work waits on it.

## #256 — [follow-up] dr-ext-grid is written in four places and read by nothing

**Summary:** #256 · [follow-up] dr-ext-grid is written in four places and read by nothing · update then keep · S · P3

### Can it be closed
No. The defect still exists on main. `chrome-extension/content.js` adds `dr-ext-grid` in three places: `markAndToggleIfNewGrid` (line 216), `consumeNomination` (line 378), and the re-registration loop (line 568). No production script, stylesheet, or page reads the class. The only reads are test stubs in `chrome-extension/tests/helpers.js` and `tests/pillbox.js`. No merged pull request removes the writes.

### Can it be updated
Yes. The count is wrong: the writes number three, not four. A rewrite should say that the extension adds a marker class to each grid it registers, that no code and no style rule reads that class since the registry moved into the application model, and that the fix is to remove the three writes, the test assertions on the class, and the static lock that bans reads of it. The styling option should be dropped, because no requirement asks for a style on grids. Vocabulary: "marker" should be "marker class". "Orphan" is misused: in the vocabulary, orphan means a missing parent. The canonical term here is "never used", or "has no reader". "Tables it manages" should be "tables in the registry". #255 widens the static lock on this same class. Removing the writes makes #255 obsolete, so #255 should close into this issue.

### New capability
For the user: none. For the developer or tester: one fewer page attribute to trace. The test fixtures lose their dependence on a class with no reader.

### Files
- `chrome-extension/content.js`
- `chrome-extension/tests/source-checks.js` (the static lock at line 2324)
- `chrome-extension/tests/pillbox.js`, `tests/rounding-pass.js`, `tests/detection.js`, `tests/helpers.js`
- Stale comments in `chrome-extension/ui-toggle.js`, `chrome-extension/app/store.js`, and `chrome-extension/lib/dr-table/detect.js`

### Complexity
It removes three page writes, one static lock test, a stub branch for `closest('.dr-ext-grid')`, and several class assertions. It adds nothing. Net: removes.

### Simplicity
- Size: The code shrinks. The change deletes three lines from `content.js` and the lock and assertions from the tests.
- Duplicates: The change passes through three registration paths that repeat "add class, then `createToggleForTable`". Removing the class leaves only the `createToggleForTable` call in each path.
- Removals: The static lock in `source-checks.js` and the `.dr-ext-grid` branch of the `closest` stub come out with the writes.
- Orphans: `markAndToggleIfNewGrid` shrinks to one call on `isNew`. It can fold into its callers or be renamed.
- Bounds: The change holds nothing unbounded.
- Current behavior: No code reads the class, so the claim holds. The count of four is wrong: main has three writes.

### Refactor
(b) A small refactor can come first. The three registration paths can share one "register a newly found element" helper around `createToggleForTable`. With the class gone, `markAndToggleIfNewGrid` can become that helper. (a) Deleting the writes also replaces #255 entirely.

### Effort
S. The change deletes three lines, one test block, and the class assertions, and rewords the comments that mention the class.

### Urgency
P3. The change has no user impact, no correctness risk, and no security risk. The developer friction is minor, and no other work waits on it.

## #257 — [follow-up] the magnitude freeze does not survive a peek round-trip

**Summary:** #257 · [follow-up] the magnitude freeze does not survive a peek round-trip · close · S · P3

### Can it be closed
Yes. The issue already carries the `wontfix` label. On `main`, every apply and every toggle runs `resetTable`, which sets the max magnitude to null (`chrome-extension/content.js:759`). `roundTable` then passes `frozenMaxMag: null` with `writes: 'first'` and stores a new magnitude freeze (content.js:1327, 1531). `docs/specs/2026-09-14-sidebar-state-removal.md` lists this re-freeze under "What does not change". The test `registrySprint_offAndOnRoundTripReFreezesRatherThanPreserving` (`chrome-extension/tests/messaging-model.js:2166`) pins the behavior, and the suite passes (3638 passed, 0 failed). The issue's second question is already settled: a settings change goes through the same reset, so it also re-freezes. The vocabulary defines the freeze as fixed "when simplification is first applied", and each apply counts as a new simplification. Closing the issue keeps grids closer to native tables, which compute their max magnitude again on every pass.

### Can it be updated
Only if it stays open. "Peek" is not in the vocabulary. The canonical wording is a form round trip, meaning a toggle to raw form and back. "Original numbers" becomes raw form. "Coarseness" becomes max magnitude. "Toggling to originals" becomes a toggle to raw form. "Re-round" becomes apply or re-simplify. A rewrite would say that a form round trip on a virtualized grid computes the magnitude freeze again from the visible rows. It would then ask whether the freeze should persist across form round trips and applies.

### New capability
User: none. Developer or tester: closing removes an open question that the test comment at messaging-model.js:2155–2160 points to.

### Files
`chrome-extension/content.js` (`resetTable`, `roundTable`, `applySidebarRounding`), `chrome-extension/tests/messaging-model.js`, `docs/vocabulary.md`, `docs/specs/2026-09-14-sidebar-state-removal.md`.

### Complexity
Keeping the freeze across a round trip adds a stored state that outlives the reset. It also adds a path that separates a toggle from an apply and a special case in `resetTable`. Net verdict for closing: neutral. Net verdict for implementing: adds.

### Simplicity
- Size: closing changes no code, and implementing adds a conditional clear.
- Duplicates: none. Toggle and apply share one path through `applySidebarRounding`.
- Removals: the "so a reviewer can judge" wording in the test comment can come out once the issue closes.
- Orphans: none.
- Bounds: none involved.
- Current behavior: the issue's claims match `main` and reproduce in the pinned test.

### Refactor
(a) Not applicable. (b) Not applicable. (c) After closing, reword the test comment at messaging-model.js:2155–2165 and the spec bullet to state the re-freeze as intended behavior, removing the open-question framing.

### Effort
S: closing plus a comment edit.

### Urgency
P3: there are no wrong values, no security risk, and nothing blocked. The behavior is deterministic and tested.

## #266 — re-inject content scripts into open tabs on update

**Summary:** #266 · re-inject content scripts into open tabs on update · update then keep · M · P3

### Can it be closed
No. The gap is still there on `main`. In `chrome-extension/background.js`, `runtime.onInstalled` only creates the two right-click menu items. No code calls `chrome.scripting.executeScript`. `manifest.json` requests `scripting` and has no `host_permissions`. No closed issue or merged pull request covers re-injection. PR #263 handles the locked state once a fresh content script reaches a stale page, and it adds no way to put that script there. The owner labeled the issue `wontfix` ("skip for now"). That label parks the work and leaves the defect in place.

### Can it be updated
Yes. The rewrite needs these vocabulary changes:
- "pill" becomes **pillbox**.
- "page code" becomes **content script**.
- "restart" and "update" become an extension reload or update.
- The requested change is **re-injection**, which is already a vocabulary term.
- "context menu" becomes the **right-click menu**, or the **menu toggle** for the item.
- "orphaned pill" misuses **orphan**, which means a missing parent. Say "the old content script's pillbox" instead.
- "dead copy" and "dead menus" conflict with **dead handle** and with the retired "dead" for code. Say "no longer responds".
- "persist table state" becomes **persist originals**.

The rewrite should say three things:
1. After a reload, open tabs keep a pillbox that no longer responds, and the menu toggle and sidebar requests fail until the user reloads the page.
2. The fix is re-injection on install or update, reading the script list from `chrome.runtime.getManifest().content_scripts`. It skips tabs that already run a live content script and removes the old instance's pillbox on native tables and grids alike.
3. Two alternatives remain: persist originals so the table is never locked, or have the old instance detect its lost connection and remove its own pillboxes.

### New capability
For the user: the menu toggle, the sidebar and the locked pillbox work in open tabs right after an update, with no page reload.
For the developer or tester: reloading the unpacked extension no longer requires reloading every test page.

### Files
- `chrome-extension/background.js`
- `chrome-extension/manifest.json`
- `chrome-extension/content.js` (guard against a second injection)
- `chrome-extension/ui-toggle.js` (removal of the old pillbox)
- `chrome-extension/tests/rounding-pass.js`

### Complexity
The change adds:
- a path: injection on install or update
- a special case: a guard against a second injection
- a special case: cleanup of the old pillbox
- possibly a configuration option: `host_permissions`

It removes nothing. Net: adds.

### Simplicity
- **Size:** the code grows by about 40 lines across the service worker and the content script, and nothing is removed.
- **Duplicates:** listing the scripts again in `background.js` would copy the manifest list, so read it from `getManifest()` instead.
- **Removals:** a global flag checked by `executeScript` can replace the ping message.
- **Orphans:** none.
- **Bounds:** the walk covers the open tabs once, catches each failure (`chrome://` pages, the Web Store) and never retries.
- **Current behavior:** confirmed from the code. Only a live Chrome can reproduce it, not the node suite.

### Refactor
(a) Persisting originals (the value `title` already holds) would make re-injected tables restorable. That would remove the locked path in `applySidebarRounding` and the `dr-ext-morph-locked` pillbox, and it would replace the need for this work.
(b) Nothing needs to come first.
(c) Having the old instance remove its own pillboxes when it detects the lost connection keeps the cleanup inside `ui-toggle.js`.

### Effort
M. The code is small. Checking the permission prompt, the second-injection behavior and the old pillbox cleanup by hand in Chrome takes the time.

### Urgency
P3. After an update the product looks present and does nothing until the user reloads the page. No data is lost, nothing is a security risk, and no other work waits on this.

## #271 — [follow-up] superscript masking triggers on the sup element only

**Summary:** #271 · [follow-up] superscript masking triggers on the sup element only · update then keep · S · P3

### Can it be closed
No. The gate still exists. `classifyTableCell` in `chrome-extension/content.js` sets `hasSuperscript` from `cell.querySelector('sup')`. It computes superscript ranges only when that check is true. The issue names three call sites, and PRs #437, #454, and #456 merged them into this one function, which serves both table kinds and the lens preview. The outcome the issue describes no longer reproduces on `main`. `toNumber("4,0962")` returns 40962, so the ladder returns a pure decision. The placement step then finds the characters spread over two text pieces that the rendered text runs together, so `stackedMatches` returns `'split'` and the cell stays unchanged. No wrong number rounds and no hover text is written. The remaining defect is a missed rounding: the base number 4,096 stays unrounded, while a `<sup>` cell rounds its base number.

### Can it be updated
A rewrite should state the current defect: a CSS-styled superscript skips as a split number, while a `<sup>` superscript masks the exponent and rounds the base number. Name the one gate in the shared classification step. Remove the "silently corrupted values" consequence and lower the priority. The fix has two options: derive `hasSuperscript` from a non-empty `getSuperscriptRanges` result for every cell, or widen the gate to any cell that has element children. Vocabulary: "flattened text" is retired in favor of **flat text**. "Superscript masking" is not in `docs/vocabulary.md`, so a rewrite either defines it on the same branch or describes it in plain words. Use **text piece**, **split number**, and **placement step** where they apply.

### New capability
For the user: a number with a CSS-styled exponent or footnote marker rounds its base value on both table kinds. For the developer or tester: one superscript test covers both markup forms, and `docs/test-pages/tables.html` gets the styled fixture in its superscript section.

### Files
`chrome-extension/content.js` (`classifyTableCell`, `patchEntry` supRanges), `chrome-extension/lib/dr-table/detect.js` (`getSuperscriptRanges`), `chrome-extension/lib/dr-simplify/ladder.js` (the `hasSuperscript` parameter documentation), `chrome-extension/tests/detection.js`, `chrome-extension/tests/rounding-pass.js`, `chrome-extension/tests/helpers.js`, `docs/test-pages/tables.html`.

### Complexity
The fix removes a special case: the `sup` check that duplicates half of the detection inside `getSuperscriptRanges`. It adds no state, option, or path. Net: removes.

### Simplicity
- Size: one line changes and the separate gate goes away.
- Duplicates: the `sup` test exists both in the gate and in `getSuperscriptRanges`, and the change merges the two.
- Removals: `hasSuperscript` can become `superscriptRanges.length > 0`.
- Orphans: none. The ladder documentation for `hasSuperscript` needs rewording.
- Bounds: the style probe calls `getComputedStyle` for each ancestor of each text piece in every cell. The cell cap (10,000) bounds re-apply passes, and the first simplification has no cap.
- Current behavior: the issue's wrong-number outcome does not reproduce. The split-skip outcome does.

### Refactor
(b) Derive `hasSuperscript` from the measured ranges before changing any behavior. With that change the gate and the style probe read one source. (c) Pass `styleProbe` through `classifyTableCell` so the tests stub the styled case directly.

### Effort
S. The change is one line plus tests and one new section on the manual test page.

### Urgency
P3. The defect now leaves a number unrounded and never writes a wrong value. No other work depends on it.

## #277 — [follow-up] the first toggle on a stuck table writes the opposite intent into the record

**Summary:** #277 · [follow-up] the first toggle on a stuck table writes the opposite intent into the record · update then keep · S · P3

### Can it be closed
No. The defect still exists on main. After re-injection, `getTableAppliedFlag` (chrome-extension/app/store.js:293) returns the entry default `'original'`. As a result, `isTableRounded` (chrome-extension/ui-toggle.js:67) returns false for a table that still shows simplified text. The `intent:toggleTable` subscriber (chrome-extension/content.js:141) computes `nextEnabled = !isTableRounded(target)` and writes `enabled: true`. `resetTable` (content.js:762) pins the flag to `'simplified'` only after the first apply is blocked. The test at chrome-extension/tests/rounding-pass.js:3679 asserts this mismatch as current behavior. No merged pull request addresses it.

### Can it be updated
Yes. The title and body use retired terms. Replacements: "stuck table" becomes unrestorable table (the check-vocab gate blocks this term), "record" becomes settings record, "pill" becomes pillbox, "panel" becomes sidebar, "state" (of a table) becomes form, "refused apply" becomes blocked apply, "extension reload" becomes re-injection, and "bookkeeping" becomes the registry entry's form. A rewrite should say the following. After re-injection, an unrestorable table's registry entry records raw form while the table shows simplified form. The first menu toggle therefore writes "on" into the settings record when the user asked for "off". A rewrite should also drop the option of reading the flip direction from the settings record. The settings record holds one on/off value for the whole page, so a press that moves the active table would read the previous table's value. The remaining path records simplified form at registration when marked cells have no originals.

### New capability
For the user: none visible. The sidebar stash and the switch receive the value the user asked for. For the developer or tester: the registry form and the capture state's `appliedFlag` match the screen from registration onward.

### Files
chrome-extension/ui-toggle.js (`createToggleForTable`, `tableHasUnrestorableCells`, `isTableRounded`), chrome-extension/app/store.js, chrome-extension/content.js, chrome-extension/tests/rounding-pass.js (re-injection block near line 3640).

### Complexity
Registration adds one write: when `tableHasUnrestorableCells` is true, set the form to simplified. That write removes the one-toggle span during which the form disagrees with the screen. No new state, option, or path. Net: neutral.

### Simplicity
- Size: adds one conditional of about 2 lines at registration and flips one test assertion.
- Duplicates: `syncSwitchForTable` and `isTableRounded` read unrestorability separately. The fix makes the flag the one reader.
- Removals: none are needed.
- Orphans: none.
- Bounds: `tableHasUnrestorableCells` walks only marked cells and already runs at registration. No new walk.
- Current behavior: reproduced. rounding-pass.js:3679 asserts `isTableRounded` false after re-injection.

### Refactor
(c) Set the form at registration inside `createToggleForTable`, which already calls `syncSwitchForTable`. The locked branch of `syncSwitchForTable` then matches `isTableRounded`, and its forced `aria-pressed='true'` could collapse into the ordinary read.

### Effort
S: one conditional write plus updating the re-injection test to expect the corrected form and a correct first toggle.

### Urgency
P3: one entry point, unrestorable tables only, the second toggle corrects the value, and no visible symptom. Nothing blocks on it.

## #281 — [follow-up] a null max magnitude is never frozen on virtualized grids

**Summary:** #281 · [follow-up] a null max magnitude is never frozen on virtualized grids · update then keep · S · P3

### Can it be closed
No. The defect is still on `main`. `simplifyTableCells` in `chrome-extension/content.js` (line 1326) reads a stored `null` as "no freeze" and computes the max magnitude again. The first pass stores `null` when `datasetMaxMagnitude` finds no non-zero number outside the outside rows. No merged pull request changes this. #257 is a separate, `wontfix` question about restore.

### Can it be updated
Vocabulary fixes: "magnitude basis" and "basis" become **max magnitude**. "Window" becomes **visible rows**. "In-group numbers" becomes numbers in rows inside a **row group**. "Peek round-trip" becomes a **restore** followed by a new simplify.

A rewrite should state three things:
- **More ways in.** An empty dataset has more causes than outside rows. The visible rows can hold only zeros, or their numbers can all sit in cells that an **exclusion** or the **range expression** skips.
- **Concrete harm.** A `null` max magnitude sends every value to `offset_other`. When larger numbers scroll into view, the next pass computes a real max magnitude, and the cells in the top band switch to `offset_top`. The same table then rounds two ways in one session.
- **Product choice.** (a) Freeze `null` itself, which keeps `offset_other` on every cell until a restore. (b) Freeze the first non-null max magnitude the grid produces, which allows one shift.

### New capability
For the user: rounding on a grid stays fixed while the user scrolls, in every case.
For the developer or tester: the store tells "not frozen" apart from "frozen with no magnitude".

### Files
- `chrome-extension/content.js` (`simplifyTableCells`, `resetTable`, `roundTable` comment)
- `chrome-extension/app/store.js` (`maxMagnitude` default, `getTableMaxMagnitude`)
- `chrome-extension/lib/dr-capture/state.js`
- `chrome-extension/tests/messaging-model.js`
- `docs/test-pages/tables.html`

### Complexity
Option (a) adds a second "not yet frozen" value next to `null`, one state. Option (b) adds a branch that writes the freeze on a re-apply pass, one path. Net: adds.

### Simplicity
- Size: a few lines change in the pass and the store, plus one test.
- Duplicates: none. The freeze has one reader and one writer.
- Removals: option (a) needs no new field if `undefined` stands for "not frozen".
- Orphans: none.
- Bounds: none. The change adds no walk, wait, or retry.
- Current behavior: the issue matches the code. The stored `null` and the recompute are confirmed on `main`.

### Refactor
(c) One change improves the solution: store the freeze as one value with a separate "frozen" flag, and have `resetTable` clear both. A single test of the flag then replaces the `null`/`undefined` test in the pass and the `frozenMaxMag` rule in the pass-settings comment. No refactor replaces the work.

### Effort
S: a single-branch change in one pass, plus a test and a test-page section for a grid whose visible rows hold numbers only in outside rows.

### Urgency
P3: narrow detection conditions, no data loss, and no other work blocked. The shift changes the numbers a user sees during a scroll.

## #283 — [follow-up] rename the Sheets range parameter to dataset

**Summary:** #283 · [follow-up] rename the Sheets range parameter to dataset · update then keep · S · P3

### Can it be closed
No. On `main`, `range` still names the set of values in four places: the `[MODE 2]` usage line of the `ROUND_DYNAMIC` JSDoc and the inline comment in `js/round_dynamic.js`, the local parameter of `datasetMode(range, …)` (which also carries `numericRange`), the dataset-mode signature and parameter table in `js/README.md`, and the Sheets signature in `docs/design.md`. No merged pull request covers the rename.

### Can it be updated
Yes. The issue misstates the code. The Sheets function's parameter is already `values`, both in the signature and in `@param`, and the formula autocomplete shows that name. The retired word appears in the help-card description line (`=ROUND_DYNAMIC(range, …)`), in the `@param` description ("range of values"), in a private helper's parameter, and in two living docs.

A rewrite should say this: the help card and the docs use the retired sense of "range" for the dataset. The fix changes that text to "dataset" and renames the private helper's parameter to `dataset`. The rewrite should also settle one product choice: keep the parameter as `values`, or rename it to `dataset` so that the autocomplete matches the vocabulary. Either choice keeps positional calls working. Python names the same parameter `data`, and `docs/design.md` writes `[values]` for Python, so a single name across platforms is a second question the rewrite should raise. Vocabulary: "range" (the set of values) is retired, and "dataset" is canonical. "Cell range" and "range expression" keep their names. The rewrite should also drop the claim that the rename changes the autocomplete parameter name, because that name is `values` today.

### New capability
For the user: the Sheets help card uses the same term as the docs. For the developer or tester: the source and the docs use one name for the dataset, and a vocabulary sweep of the source finds no retired sense.

### Files
`js/round_dynamic.js`, `js/README.md`, `docs/design.md`, `js/CHANGELOG.md`, and the template spreadsheet (outside the repository).

### Complexity
The change renames text and one local identifier. It adds no states, paths, options, abstractions, or special cases. Net: neutral.

### Simplicity
- Size: the line count stays the same, and only words change.
- Duplicates: the dataset-mode signature appears in `js/README.md` and in `docs/design.md`. Both need the same edit.
- Removals: nothing to remove.
- Orphans: none.
- Bounds: none.
- Current behavior: the issue's statement that the parameter is named `range` does not match the code, because the parameter is `values`.

### Refactor
(c) Choose one parameter name for Sheets and Python, `dataset` or `values`, instead of `values` plus `data`. This is a separate decision and should not block this text fix.

### Effort
S. The change edits text in three files plus a changelog entry, and the template spreadsheet needs a manual re-copy.

### Urgency
P3. Nothing computes differently. The only effect is inconsistent terms between the help card and the docs, and no other work depends on this issue.

## #284 — [follow-up] decide the version-bump and tagging policy

**Summary:** #284 · [follow-up] decide the version-bump and tagging policy · update then keep · S · P3

### Can it be closed
No. On main, `.github/workflows/bump-version.yml` still bumps the patch version on every merged pull request that touches `python/**` or `chrome-extension/**`, with no exclusion for docs or tests. The remote carries only the tags `js-v0.2.4`, `py-v0.1.2`, and `v0.1.0`. `MAINTAINERS.md` ("How versions move") already documents the bump behavior. Its "Tags" section already states a tagging rule: tag only when cutting a GitHub Release. That rule partly settles question 2. No closed issue or merged pull request supersedes this one. #206 covered a different step of the workflow.

### Can it be updated
Yes. All factual claims match main. A rewrite should:
- Treat question 2 as answered by the existing `MAINTAINERS.md` rule, and ask only whether to add tagging to the bump workflow.
- State that question 1 also covers test-only changes. `chrome-extension/tests/` and `python/tests/` fall inside the filter, so a test-only change bumps the version too.
- Note that the Chrome extension ships as load-unpacked from main. A bump on a docs change therefore affects no store listing, which supports the low priority.

Vocabulary: no retired synonym appears. "Bump workflow" is not in `docs/vocabulary.md`. It needs no entry because it names one workflow. The text breaks the writing style: the contraction "don't" and the abbreviations "PR" and "JS" should become "do not", "pull request", and "JavaScript".

### New capability
For the user: the version number moves only when shipped code changes. For the developer or tester: fewer automated bump pull requests. On main, 38 of the last 127 non-merge commits since 2026-08-01 are bump commits. Tags would also give a fixed pointer to each release.

### Files
`.github/workflows/bump-version.yml`, `MAINTAINERS.md`.

### Complexity
A docs and tests exclusion adds negated patterns to the `dorny/paths-filter` filters. It also needs the `predicate-quantifier: every` option, which adds one configuration option. Tag creation in the workflow adds one step and one new artifact kind. Keeping current behavior and closing the tagging question adds nothing. Net: adds, by a small amount, if either change is taken. Neutral otherwise.

### Simplicity
- Size: a filter change adds about four lines of YAML and removes none.
- Duplicates: none. The workflow is the only thing that bumps versions.
- Removals: the `MAINTAINERS.md` "Tags" paragraph could shrink to one rule once the decision is made.
- Orphans: none.
- Bounds: the workflow already caps its merge wait at 40 checks, 15 seconds apart. The change adds no new unbounded step.
- Current behavior: both defects reproduce on main.

### Refactor
(a) No refactor replaces the decision. (b) None needs to precede it. (c) One improvement: split each filter into a code pattern and exclusion patterns (`!**/*.md`, `!**/tests/**`). That keeps one filter block as the single place that defines "shipped code".

### Effort
S: one product decision, one workflow edit, and one `MAINTAINERS.md` edit.

### Urgency
P3: the only cost is version inflation and extra bump pull requests. No correctness, security, or blocking impact.

## #285 — [follow-up] carry the pillbox rename into the extension's code identifiers

**Summary:** #285 · [follow-up] carry the pillbox rename into the extension's code identifiers · update then keep · S · P3

### Can it be closed
No. On `main`, `chrome-extension/ui-toggle.js` still defines `TOGGLE_PILL_WIDTH_PX` and `TOGGLE_PILL_HEIGHT_PX`. `tests/setup.js`, `tests/pillbox.js` and `tests/source-checks.js` read both constants. "Pill" also still names the control in comments in `ui-toggle.js` (lines 43, 93, 180, 334), in `lib/dr-capture/render.js:595`, and in tests and test titles in `tests/messaging-model.js` (439–440, 2689–2745) and `tests/rounding-pass.js` (3584, 3755–3770). Some of the work is already done: the test file is named `tests/pillbox.js`, and the comments in `content.js`, `detect.js` and the test helpers say "pillbox". The docs half of the issue is fixed.

### Can it be updated
Yes. A rewrite should list only the identifiers and comments that remain, as given above. It should also make two scope decisions.
- **Toggle as the control's name.** The vocabulary retires "toggle" as a name for the control, but the code still uses it for the pillbox: `tableToggles`, `injectTableToggles`, `ensureToggleStyleInjected`, `LOCKED_TOGGLE_TITLE`, the `TOGGLE_*` geometry constants, and the file name `ui-toggle.js`. About 125 references in the scripts, plus the file lists in `manifest.json`, point at these. Options: rename them in this issue, or leave them out and file a separate issue.
- **Pill as the sidebar control's name.** `tests/sidebar.js` ("main pill") and the `invertPills_*` tests in `tests/rounding-pass.js` use "pill" for the sidebar switch. The canonical term for that control is **switch**.

The `dr-ext-morph*` classes stay as they are. The comment at `ui-toggle.js:53` ("the morph button") should say "the pillbox button".

Vocabulary: pill → **pillbox**. Table toggle, and toggle used as a noun for the control → **pillbox**. Pill used for the sidebar control → **switch**.

### New capability
For the user: none. For the developer or tester: the names in the code match `docs/vocabulary.md`, so a search for "pillbox" finds the control's code.

### Files
- `chrome-extension/ui-toggle.js`
- `chrome-extension/tests/setup.js`, `tests/pillbox.js`, `tests/source-checks.js`, `tests/messaging-model.js`, `tests/rounding-pass.js`, `tests/sidebar.js`
- `chrome-extension/lib/dr-capture/render.js`
- If the file is renamed: `chrome-extension/manifest.json`, plus every script that loads `ui-toggle.js`

### Complexity
Changes only names: it adds and removes no states, paths, options, abstractions or special cases. Net verdict: neutral.

### Simplicity
- **Size:** the code stays the same size. Only names and comment text change.
- **Duplicates:** `tests/setup.js` copies the two constants onto `globalThis`. The rename passes through that copy, so both places change.
- **Removals:** nothing to remove.
- **Orphans:** none, as long as `tests/source-checks.js` looks for the new constant names.
- **Bounds:** none.
- **Current behavior:** the issue says "pill" still appears in the code, and it does. The line saying no living doc mentions "pillbox" is out of date.

### Refactor
(a) Yes: the rename is itself the refactor, and it belongs in one `refactor/` pull request. (b) No preceding work is needed. (c) Renaming the "toggle" identifiers and `ui-toggle.js` in the same pull request would finish the vocabulary change in the code in one pass.

### Effort
S: the change is mechanical renames and comment edits, and the existing test suite proves it.

### Urgency
P3: the change removes naming debt only. It fixes no wrong result or user-facing behavior and blocks no other work.

## #287 — [follow-up] harden the file gate like the vocabulary gate

**Summary:** #287 · [follow-up] harden the file gate like the vocabulary gate · update then keep · S · P3

### Can it be closed
No. All three gaps reproduce on `main`. `scripts/check-files.sh` `--range` runs `git diff ... "$2" "$3"` with two dots. `scripts/check-files.sh --range deadbeef HEAD` prints a git `fatal` message and exits 0. `scripts/check-files-test.sh` `scratch_repo` calls `mktemp -d` with no guard. `scripts/check-vocab.sh` and `scripts/check-vocab-test.sh` already use the fixed forms: `base...head`, `|| exit 2` on the diff capture, and `mktemp ... || exit 2` followed by `[ -n "$dir" ]`. No merged pull request touches `check-files.sh`.

### Can it be updated
Yes. The rewrite should make these points:
- Two-dot scope. `--diff-filter=ACR` drops files the base branch added. A file the base branch deleted or renamed after the fork appears as an addition, so the gate can block a pull request on a file it never added.
- Git failures. The capture ignores git failures in all three modes (`--staged`, `--range`, `--tracked`). The `git show "$rev:$file" 2>/dev/null` in `check_file` also hides a failed read, which skips the credential scan without an error.
- Scratch directory. `scratch_repo` has no guard on `mktemp`.
- Fix. Use three dots, exit 2 on any failed capture or blob read, guard `mktemp`, and add one self-test case for each fix.

Vocabulary: "file gate" and "fail open" do not appear in `docs/vocabulary.md`. Define both in a `docs:` commit, or use "fail closed" from AGENTS.md. "reports green" and "reports success" use "report", a retired synonym for "publish". The exit status is the fact, so write "exits 0". Write "pull request" in place of "PR" and "repository" in place of "repo".

### New capability
For the user: none.
For the developer or tester: the file gate stops with exit 2 on a git failure. It judges a long-lived pull request only on the files that pull request added.

### Files
- `scripts/check-files.sh`
- `scripts/check-files-test.sh`
- `.github/workflows/repo-hygiene.yml` (reference only)

### Complexity
The fix adds one error exit per capture, one error exit on the blob read, and one `mktemp` guard. The three-dot change adds nothing. Net: neutral.

### Simplicity
- Size: about 10 lines added to the gate and about 30 test lines. No code is removed.
- Duplicates: the range computation, the git-failure exit, and the `scratch_repo` harness each exist in both gates.
- Removals: none. Each addition closes one reproduced gap.
- Orphans: none.
- Bounds: none. The gate walks a finite file list.
- Current behavior: all three claims match `main`. The two-dot claim is narrower than the issue states (see above).

### Refactor
(b) precede, and (c) improve the solution. This issue is the result "Collapse a path before opening a second one" names as the one to avoid: a pull request that brings one gate in line with the other. Two refactors fit:
- A shared `scripts/lib/diff-range.sh` that builds the three-dot range and exits 2 on a git failure. Both gates source it.
- A shared self-test harness holding `scratch_repo`, `record_pass`, `record_fail`, and the guarded `mktemp`. Both test scripts source it.

After these land, a future hardening reaches both gates in one change.

### Effort
S. Three small edits and three test cases copy shapes that already work in the vocabulary gate.

### Urgency
P3. Each gap needs a bad revision, a shallow clone, or a long-lived pull request across a base-branch deletion. CI runs `fetch-depth: 0`. No other work depends on this issue.

## #293 — [follow-up] stamp a version in the Sheets library header via the bump workflow

**Summary:** #293 · [follow-up] stamp a version in the Sheets library header via the bump workflow · update then keep · S · P3

### Can it be closed
No. On main, `js/round_dynamic.js` has a header with no version string. `.github/workflows/bump-version.yml` filters and stamps only `python/**` and `chrome-extension/**`. `MAINTAINERS.md` states that the JS file carries no version line and that the JS version moves only through release entries in `js/CHANGELOG.md`. No merged pull request addresses this.

### Can it be updated
Yes. The problem statement is accurate. The rewrite should add one conflict: under `MAINTAINERS.md`, the JS version is set by changelog releases. The stamp therefore needs one of two sources, and choosing between them is a product decision:
1. The workflow bumps a patch on every merge that touches `js/**`, as it does for the other two packages. This replaces the changelog-driven JS series and needs a `MAINTAINERS.md` edit.
2. A hygiene check requires the header version to equal the newest release heading in `js/CHANGELOG.md`. This keeps today's policy. It cannot tell unreleased main code from the last release: fixes in `[Unreleased]` since 0.3.0 would carry the 0.3.0 label.
Option 1 detects drift in more cases. The issue depends on #284's decision on docs-only bumps. Vocabulary: no retired synonyms appear. "Sheets library file" is not a defined term. docs/vocabulary.md uses "the Sheets function", so the rewrite should say "the Sheets function's script file".

### New capability
For the user: none directly. The template spreadsheet displays which script version it runs.
For the developer or tester: one glance at the pasted header tells a stale script apart from a data-entry mistake in the Tests tab.

### Files
- `js/round_dynamic.js`
- `.github/workflows/bump-version.yml`
- `MAINTAINERS.md`
- `js/tests-googlesheets-tab.md`, if the Tests tab shows the version
- `scripts/` hygiene check (option 2 only)

### Complexity
Adds a version line and either a third bump step with a `js` path filter or a new hygiene check. It removes the undocumented "JS has no automation" exception. Net: adds.

### Simplicity
- Size: grows by one header line plus about 15 workflow lines, for the stated diagnosis requirement.
- Duplicates: the Python and Chrome bump steps each copy the patch-increment logic. A JS step would make a third copy.
- Removals: a separate custom function that returns the version adds nothing a header comment does not already provide. Leave it out.
- Orphans: the "carries no version line" row in `MAINTAINERS.md` becomes false. Edit it in the same change.
- Bounds: nothing unbounded.
- Current behavior: every claim matches main.

### Refactor
(b) Before this change, merge the two bump steps into one step driven by a table of (path filter, file, version pattern). Put that in its own `refactor/` pull request, and make the verify step read the same table. JS then becomes one more row in that table and adds no third step.

### Effort
S: one header line, one table row or check, and doc edits.

### Urgency
P3. No user-facing behavior and no correctness risk. It reduces a recurring maintainer diagnosis cost. The #284 policy decision should come first.

## #289 — [follow-up] open the bump PR with a trusted identity so its checks run unheld

**Summary:** #289 · [follow-up] open the bump PR with a trusted identity so its checks run unheld · close · S · P3

### Can it be closed
Yes. The defect no longer reproduces. Recent bump PRs (#470 to #485) run their Tests and Repo hygiene checks within a minute of creation. For example, on #485 `test` and `file-gate` succeeded at 22:32. The bump run for #482 (36158085290) waited, merged its own PR as #483, and succeeded. `.github/workflows/bump-version.yml` still creates the PR with `GITHUB_TOKEN`, so GitHub stopped holding these checks without any repository change.

A separate defect appears in the failed bump runs (36197066666, 36156951111, 36152483013, 36147686468). The maintainer merged the bump PR while the wait loop was polling. `mergeStateStatus` then read `UNKNOWN`, which the loop does not handle. The run waited out the 10-minute deadline and failed on a PR that was already merged. A new issue should cover this defect.

### Can it be updated
Only if the checks start being held again. Vocabulary: "bump PR", "bump workflow", and "default token" are not in docs/vocabulary.md, and none of them is a retired synonym. A replacement issue would say this: the bump workflow's wait loop keeps polling after the PR is merged and reports failure. It should read the PR `state` and exit with success on `MERGED`. AGENTS.md "Merge train" says "Never enable auto-merge. I own every merge decision." The workflow's self-merge conflicts with that rule, and #284 is the place to decide it.

The issue's proposed PAT fix also carries an unflagged hazard. The `if:` guard skips PRs by author `github-actions[bot]`. A PR opened with a PAT carries the owner's login, so a human merge of that PR would start another bump in a loop. Any trusted-identity change must guard on the `chore/version-bump-pr-` head branch instead.

### New capability
For the user: none. For the developer or tester: none now. The follow-up fix removes a false failure on each bump run that a human merge races.

### Files
.github/workflows/bump-version.yml; MAINTAINERS.md (bump workflow paragraph); AGENTS.md (Merge train).

### Complexity
Closing adds nothing. The proposed PAT change adds a repository secret, a second credential path, and a changed author guard. Net verdict for the proposal: adds. Net verdict for the follow-up `MERGED` exit: neutral, one case arm.

### Simplicity
- Size: closing leaves the code unchanged. The follow-up adds one case arm.
- Duplicates: the author guard and the branch-name prefix both identify a bump PR.
- Removals: the PAT secret goes away once the checks run unheld.
- Orphans: none.
- Bounds: the wait holds a cap of 40 polls at 15 seconds (10 minutes), and the run fails when the cap is reached.
- Current behavior: the held-checks claim no longer matches. The `UNKNOWN`-after-merge timeout reproduces.

### Refactor
(b) Settle #284 first. If bumps stop merging themselves, the wait loop and this issue both go away.

### Effort
S. Closing takes no work, and the `MERGED` exit takes a few lines.

### Urgency
P3. No user impact. The false failures create minor developer friction and block no other work.

## #295 — [follow-up] run capture-derived fixtures as regression tests

**Summary:** #295 · [follow-up] run capture-derived fixtures as regression tests · update then keep · M · P3

### Can it be closed
No. `main` holds no fixture folder and no replay step. The order list in `chrome-extension/tests.js` names twelve test pieces, and none of them loads markup from a file. The only fixture-seed tests, in `tests/capture-log.js`, check that the capture carries the seed. No closed issue or merged pull request after #294 covers a runner.

### Can it be updated
Yes. The vocabulary needs these fixes:
- "focused table" is a retired synonym. The canonical term is **bound table**.
- The issue calls the seed the table's "raw markup". This is wrong. The **fixture seed** holds the markup as it stood at capture time, form included, so a seed from a simplified table rebuilds in simplified form.
- **regression fixture** has no entry in `docs/vocabulary.md`. A rewrite defines it there.

A rewrite should state three facts:
1. The suite runs in plain Node with hand-built mock elements (`rwEl`, `makeNativeTableEl` in `tests/helpers.js`). The repository has no package manifest and no HTML parser.
2. Path (a) therefore needs one of two things: a small markup parser that builds the existing mock elements, or the repository's first npm dependency (e.g. jsdom).
3. The seed covers native tables and grids alike, so the runner must replay both table kinds.

It should keep path (b) as the zero-cost option. Priority stays medium-low.

### New capability
For the user: none directly. A fixed rounding defect stays fixed.
For the developer or tester: a defect from a capture becomes a test by committing a synthetic markup file, its settings, and the expected output. No mock needs writing by hand.

### Files
- `chrome-extension/tests.js`
- a new test piece, e.g. `chrome-extension/tests/fixtures.js`, plus a fixture folder
- `chrome-extension/tests/helpers.js`
- `chrome-extension/lib/dr-capture/state.js`
- `.github/workflows/tests.yml`
- `AGENTS.md` ("Regression fixtures")
- `docs/vocabulary.md`

### Complexity
Path (a) adds three things: a markup parser or a dependency, a fixture file format, and one test piece. It removes none. The dependency option also adds a manifest and a lockfile, which need root allowlist negations under `scripts/check-files.sh`. Net: adds. Path (b) is neutral.

### Simplicity
- Size: the code grows by a parser, a loader, and a comparison step, all serving the replay requirement.
- Duplicates: `makeNativeTableEl`, `makeToggleTable`, and `rwEl` build overlapping mock elements. A parser should emit one of them, not a fourth.
- Removals: the stored settings can shrink to the options that differ from the defaults.
- Orphans: none.
- Bounds: the fixture count and file size are uncapped. Cap the file size, e.g. 50 KB, and fail the run above it.
- Current behavior: the claims match `main`. The seed is `outerHTML` (`state.js:148`), and no replay exists.

### Refactor
(b) Before the runner, collapse the mock table builders in `tests/helpers.js` onto `rwEl`, in a `refactor/` pull request. A markup parser then has one element shape to emit, for native tables and grids alike. (c) `js/doc-tests.js` already replays data pairs, and its pattern can serve as the fixture loader.

### Effort
M: a parser for the table subset, the fixture format, and the grid and native coverage fit in two to three days.

### Urgency
P3. No user-facing defect, and no work waits on this. The benefit grows only as captures lead to fixes.

## #296 — [follow-up] service-worker log rows are not captured

**Summary:** #296 · [follow-up] service-worker log rows are not captured · close · S · P3

### Can it be closed
The gap still exists on `main`. `chrome-extension/background.js` does not load `lib/dr-log/index.js`. Its one log call is the `console.warn` for a failed side panel open, at line 42. `lib/dr-capture/render.js:576` still renders the note "Service worker rows are not captured." No merged pull request changes any of this.

Close it anyway, as an accepted gap. The capture already states the absence. The one row the service worker logs is recorded when the sidebar fails to open, so no sidebar is open at that moment to take a capture. Chrome also empties the service worker's variables after an idle period, so a buffer held in memory there would lose its rows before most captures.

### Can it be updated
Update only if the issue stays open. Vocabulary fixes:
- "background context" becomes "service worker".
- "owns" and "decide" are personification. Use "creates the right-click menu items" and "opens the sidebar".
- "log snapshot" clashes with **snapshot**, which vocabulary defines as a copy of a table. Say "the log buffer's rows".

A rewrite should say three things:
- The service worker holds no log buffer, so a capture carries no rows from it.
- The capture's note records that absence.
- The two options are a buffer in the service worker, pulled by the sidebar when the user saves a capture, or accepting the gap.

It should also state two limits. The event bus routes requests to one tab's content script only. An idle restart clears an in-memory buffer.

### New capability
For the user: a capture that shows why the sidebar failed to open, when a capture can be taken at all.
For the developer or tester: the service worker's rows appear in the capture's Extension logs section beside the content script and sidebar rows.

### Files
- `chrome-extension/background.js`
- `chrome-extension/lib/dr-log/index.js`
- `chrome-extension/adapters/messaging.js` (a request route to the service worker)
- `chrome-extension/sidebar.js` (`assembleAndSaveCapture`, `saveCapture`)
- `chrome-extension/lib/dr-capture/render.js`
- `chrome-extension/lib/dr-capture/state.js` (format version)
- `docs/vocabulary.md` (the **note** and **capture** rows)

### Complexity
Building it adds:
- a third log buffer
- a new request topic
- a request route on the bus that reaches extension pages
- a third wait in the sidebar's save step
- a third log section in the capture and a bump to the capture state's format version
- persistence through `chrome.storage.session`, if rows must survive an idle restart

It removes one note. Net verdict: adds.

### Simplicity
- Size: the code grows by a buffer, a route, a topic, and a render section, all to capture one warn row.
- Duplicates: the sidebar's save step already waits on two answers. A third answer extends that wait instead of repeating it.
- Removals: closing the issue removes all of this work, and the capture's existing note already states the gap.
- Orphans: none. Building it removes the "not captured" note.
- Bounds: the log buffer already caps rows at 50 and text at 2000 characters. The new request needs the same immediate absence answer that tab requests get.
- Current behavior: the issue's statements match `main`.

### Refactor
(a) Nothing replaces the work. (b) A prior `refactor/` change could widen the bus's `request` to support the extension-pages route. The issue does not require it. (c) Wrapping `console.warn` in `DR_LOG.warn` in the service worker would put its rows in Chrome's extension error page the same way as the other contexts. That is low value without a way to pull the rows into a capture.

### Effort
S if closed. M if built, because of the new bus route, the state format bump, and the tests.

### Urgency
P3. One rarely hit warn row is at stake. Nothing is at risk for correctness or security, and nothing is blocked.

## #297 — [follow-up] locked-table captures could carry the hover text as best-effort originals

**Summary:** #297 · [follow-up] locked-table captures could carry the hover text as best-effort originals · close · S · P3

### Can it be closed
Yes. The capture already carries the evidence the issue asks for. `collectCaptureState` in `chrome-extension/lib/dr-capture/state.js` stores the bound table's `outerHTML` as the fixture seed, and that markup holds every native cell's `title="Original: …"` attribute verbatim. `tests/capture-log.js` near line 393 shows a seed with that attribute. Grids never write hover text (`GRID_TABLE_PASS.hoverText: false` in `content.js`), so the proposed field could only ever fill on native tables. No code in the extension calls `chrome.scripting` or re-injects content scripts, so the unrestorable state comes only from an outside re-injection.

### Can it be updated
If kept, a rewrite should use these terms:
- "unrestorable" in place of the issue's "locked" for lost originals. "Locked" names the state of the table's controls.
- "the controller skips the apply" in place of "refuses", which personifies the code.
- "hover text" is not in `docs/vocabulary.md`. Define it there, or call it the cell's title attribute.
- "honesty rule" is not a vocabulary term.

The rewrite should say this: an unrestorable native cell records `original: null`, and its title attribute still holds the pre-simplification value. The fixture seed already carries that attribute for the bound table. The open question is whether to copy it into a separate per-cell field for all tables. Grids have no such attribute.

### New capability
For the user: none beyond what the fixture seed shows today.
For the developer or tester: unrestorable cells in unbound tables get a readable hint.

### Files
`chrome-extension/lib/dr-capture/state.js`, `chrome-extension/lib/dr-capture/render.js`, `chrome-extension/content.js` (`writeCell`, `restoreTable` doc), `chrome-extension/tests/capture-log.js`.

### Complexity
The change adds a per-cell field, a native-only source path, a render branch, and a capture format bump to 7. It also adds a difference between table kinds. Verdict: adds.

### Simplicity
- Size: the code grows by one field, one read, and one render branch. Its only requirement is a hint the seed already holds.
- Duplicates: the new field would repeat the fixture seed's title attributes.
- Removals: the whole field can come out without losing a requirement.
- Orphans: none today. The change leaves none.
- Bounds: none. The walk is the existing cell loop.
- Current behavior: the issue's claims hold. An unrestorable cell serializes `original: null` with `wearsMarker: true` and keeps its title. The issue leaves out that the seed already carries the title and that grids carry none.

### Refactor
(a) None needed. The render step could point readers to the fixture seed for an unrestorable cell's title. That would be a one-line note in `renderBoundTable` with no new state field.

### Effort
S: one field and one render branch, or a note, plus tests.

### Urgency
P3: rare state with no in-extension trigger, no correctness or security risk, and no work blocked by it.

## #298 — [follow-up] disclose an unreachable page on the capture form, before finish

**Summary:** #298 · [follow-up] disclose an unreachable page on the capture form, before finish · update then keep · S · P3

### Can it be closed
No. When the form opens, `refreshCaptureSizeNote` in `chrome-extension/sidebar.js` (lines 890–906) runs one `request:captureState` pull, and it returns early on a missing answer ("A failed pull here shows no note"). At finish, `saveCapture` logs a warn row and saves with the page half missing. The capture file shows that gap as absence sentences (`lib/dr-capture/render.js`, e.g. line 559). No merged pull request changes this. #294 and #316 left the form-time disclosure open.

### Can it be updated
Yes. Vocabulary fixes:
- "capture state pull" becomes **state pull**.
- "note form" is a retired synonym. It becomes the **remarks form**.
- "active tab" becomes **bound tab**, because the sidebar serves the bound tab.
- "page's state" becomes **the page half of the capture**.
- "unreachable" has no entry in the vocabulary. Define it in `docs/vocabulary.md`, or write "no content script answers on the bound tab".

A rewrite should say this:
- **Problem:** the form already runs a state pull when it opens, but a failed pull shows nothing. The user learns that the page half is missing only after opening the file.
- **Change:** when that pull gets no answer, show one line on the form saying the capture will hold the sidebar half only. Finish stays enabled.
- **Urgency:** low.

### New capability
For the user: before pressing finish, the user sees that the page half will be missing. No save-and-open cycle is needed to find out.
For the developer or tester: fewer captures that look broken from restricted pages, and one glue test to cover the new line.

### Files
- `chrome-extension/sidebar.js` (`refreshCaptureSizeNote`)
- `chrome-extension/sidebar.html` (`#captureSizeNote`)
- `chrome-extension/tests/sidebar.js` (`captureSizeNoteGlue`)

### Complexity
The change adds one branch (the missing answer) and one user-visible string. It adds no new request, state, setting, or element. The size warning and the new line never show together, because one needs an answer and the other needs a missing answer, so both fit in the one note element. Net: adds, slightly.

### Simplicity
- **Size:** about five added lines. The early return becomes a branch that writes the line.
- **Duplicates:** the form-time and finish-time state pulls both exist today. The finish pull is kept fresh on purpose, so no merge applies.
- **Removals:** nothing added can come out.
- **Orphans:** the comment "A failed pull here shows no note" must change. No code is left without a reader.
- **Bounds:** none. A request with no receiver answers at once (`adapters/messaging.js` `request`).
- **Current behavior:** matches the code. A failed pull saves with the page half shown as absence sentences, and the form shows no line for it.

### Refactor
(a) No. (b) No. (c) Rename `captureSizeNote` and `refreshCaptureSizeNote` to a general form-note name, because the element would then carry two kinds of message.

### Effort
S: one branch, one string, and one test in an existing glue block.

### Urgency
P3. The fix is for clarity only. Captures still save correctly, no correctness or security risk exists, and no other work waits on it. The manual test runs on a restricted page such as the Chrome Web Store, and `docs/test-pages/tables.html` has no section that covers it.

## #299 — [follow-up] give the sidebar a view model so tests execute its logic

**Summary:** #299 · [follow-up] give the sidebar a view model so tests execute its logic · update then keep · L · P3

### Can it be closed
No. No merged pull request adds a view model. `chrome-extension/sidebar.js` (1148 lines) holds its view state in module variables (`topVal`, `botVal`, `linked`, `lockStashedEnabled`, `cachedSamples`, `cachedMaxMag`, `captureMark`) and in control values. `collectSidebarView()` reads live controls at finish, as the issue states.

### Can it be updated
Yes. One claim is out of date. The suite already runs `sidebar.js`: `makeIssue251SidebarHarness()` in `tests/helpers.js` evaluates the whole file against mock controls and a mock `chrome`, and nine tests in `tests/sidebar.js` use it. Other tests pull single functions out of the file text with `new Function`. About 60 checks still search the file text. A rewrite should say that sidebar tests depend on a hand-built mock of every control, that wiring checks search the file text, and that no single object holds the sidebar view state.

Vocabulary: "view model" and "source-text assertion" have no entry in docs/vocabulary.md. A view model also conflicts with the "view" entry, which calls the sidebar the standing exception that carries working values. Add both terms, and keep "view model" distinct from **application model**. Use **sidebar view state** (the capture state field), **finish**, and **capture**. The code variable `linked` uses a retired synonym of **coupled**.

### New capability
For the user: none directly.
For the developer or tester: sidebar behavior tests call plain functions on one state object, with no mock controls. The capture reads that object with one call.

### Files
`chrome-extension/sidebar.js`, `chrome-extension/sidebar.html`, `chrome-extension/tests/sidebar.js`, `chrome-extension/tests/helpers.js`, `chrome-extension/tests/number.js`, `chrome-extension/tests/capture-log.js`, `docs/vocabulary.md`.

### Complexity
Adds one abstraction, the view model object. Removes seven scattered module variables, the control reads in `collectSidebarView`, and the function-extraction tests. Net: neutral.

### Simplicity
- Size: the new object's code roughly offsets the scattered state and the extraction tests it replaces.
- Duplicates: the view state sits in module variables and is read back from controls in `collectSidebarView`, so it exists twice.
- Removals: `collectSidebarView` reduces to returning the model, and most of the harness mock controls come out.
- Orphans: the `new Function` extraction helpers in `tests/number.js` and `tests/sidebar.js` lose their readers.
- Bounds: none. The lens preview samples are already capped where they are produced.
- Current behavior: "never executed by the suite" does not match `main`. The live harness exists and all 3638 tests pass.

### Refactor
(b) Do this first: rename `linked` to `coupled`, and move `topVal`, `botVal`, `coupled`, and `lockStashedEnabled` into one object while `collectSidebarView` still reads it. This change alters no behavior and goes in its own `refactor/` pull request. (a) The work itself is the refactor, so no refactor can replace it.

### Effort
L: 1148 lines of control wiring to split, and about 60 text-search checks to convert or retire.

### Urgency
P3: tech debt with no user impact, and no other work waits on it. The existing harness already covers the riskiest paths, table switching and apply.

## #300 — [follow-up] move the two shape-aware originals readers onto the model's plain-text read

**Summary:** #300 · [follow-up] move the two shape-aware originals readers onto the model's plain-text read · close · S · P3

### Can it be closed
Yes. The issue is obsolete. Both table kinds now store one originals record, `{ value, pieces, supRanges, linkFilteredIdx }`, and one writer produces it: `applyPatches` in `chrome-extension/lib/dr-table/detect.js`. The comment on `_ensureEntry` in `chrome-extension/app/store.js` documents that shape. The restore now runs `releaseCell` in `chrome-extension/content.js`, which reads `record.pieces` for both kinds. The lens preview reads the record through `classifyTableCell` and takes only `record.supRanges`. Neither reader contains a string-versus-record branch. That branch now exists in one place only: `getTableOriginalText` in `store.js`. The per-piece work in commits c88c316 and b47de75 (PR #422) removed the second shape.

Three leftovers remain from the two-shape era:
- `getTableOriginalText` still returns a plain-string original as itself. No production code stores a string, so only the test `capturePlainOriginalTextRead` in `chrome-extension/tests/messaging-model.js` reaches that branch.
- The test header comment at `messaging-model.js` lines 3575–3578 still says the registry stores "two shapes".
- The `store.js` comment line "A plain string reads back as itself" describes the same dead branch.

### Can it be updated
No rewrite is needed. If the leftovers get their own issue, it should say that `getTableOriginalText` should return `record.value` alone and the string test case and the stale comments should go. The issue's own terms need these changes against docs/vocabulary.md:
- "shape" (the stored format) collides with "shape fingerprint". Say "originals record".
- "record" is a retired synonym of "settings record". Say "originals".
- "model" should be "application model".
- "restore path" should be "restore".

### New capability
For the user: none. For the developer or tester: none beyond the leftovers above, which remove one dead branch and one misleading test case.

### Files
- `chrome-extension/app/store.js` (`getTableOriginalText`)
- `chrome-extension/tests/messaging-model.js` (`capturePlainOriginalTextRead`, lines 3575–3578)
- `chrome-extension/content.js` (`releaseCell`, `classifyTableCell`), for reference only

### Complexity
The leftover cleanup removes one special case: the plain-string path in `getTableOriginalText`. It adds nothing. Net: removes.

### Simplicity
- **Size:** The code gets smaller: one ternary and one test assertion go.
- **Duplicates:** None remain. The branch the issue names is already collapsed.
- **Removals:** The plain-string fallback and its test case can go without losing a requirement.
- **Orphans:** The string branch has no production reader. It is an orphan path.
- **Bounds:** Nothing unbounded.
- **Current behavior:** The issue's claim of three branching readers does not reproduce on `main`. Only one exists.

### Refactor
(a) The per-piece originals refactor (PR #422 and c88c316) already replaced the requested work. (b) Nothing needs to come first. (c) Dropping the string fallback makes `getTableOriginalText` a one-field read of the one record shape.

### Effort
S: a two-line code change, one test edit, and two comment edits.

### Urgency
P3: no user impact and no correctness risk. The only cost is a dead branch and a stale comment that can mislead a developer about the stored format.

## #311 — Protection from prompt injection for captures.

**Summary:** #311 · Protection from prompt injection for captures. · update then keep · M · P2

### Can it be closed
No. No closed issue or merged pull request addresses it. On main, `lib/dr-capture/render.js` guards the file itself with a script-blocking Content-Security-Policy and `escapeHtml`. No section labels page-derived text as recorded data, and nothing scans that text. A search for "instruction", "untrusted", and "provenance" in `lib/dr-capture` finds nothing.

### Can it be updated
Yes. The body and the first comment contradict each other. The body neutralizes flagged spans. The comment's non-goal forbids any change to page text. Neutralizing a span breaks the fixture seed's byte-exact JSON copy (point 4 of the render.js doctrine) and the rule that a capture records page content honestly. A rewrite should say that flagged spans are marked and left unaltered. It should also fold the comment's options (a standing label on each page-derived section, author tags in the capture state behind a format bump from 6 to 7, a line of guidance for readers, a rule for #295) into the body as a labels layer that any scanning path builds on. The rewrite should state that nothing automated reads captures today. The term "focused table" in #295 is a retired synonym, and the canonical term is bound table. Prompt injection, agent, scanner, and page-derived text have no entry in docs/vocabulary.md, so adopting them needs new rows. "Model-assisted simplify" names a feature the repository does not have.

### New capability
For the user: a capture that marks page text as data before the user pastes it into an AI tool. For the developer or tester: a scanning interface (text in; verdict, score, and matched spans out) that #295's runner and later features can call.

### Files
`chrome-extension/lib/dr-capture/render.js`, `chrome-extension/lib/dr-capture/state.js`, `chrome-extension/sidebar.js`, a new `chrome-extension/lib/dr-scan/`, `chrome-extension/tests/capture-log.js`, `chrome-extension/README.md`, `docs/design.md`, `docs/vocabulary.md`.

### Complexity
The change adds a package, an interface, a vendored library or a rule list, a new state field for author tags, a format version step, and a marked-span rendering path. The labels-only path adds one helper and one state field. Net: adds.

### Simplicity
- Size: the code grows by the scanner and the labels. Page-text safety for agent readers is the requirement.
- Duplicates: page text enters through `renderCapTable`, `renderCaptureHeader`, `renderCaptureLogs`, and `renderFixtureSeed`, each handled separately. One wrapper should label all four.
- Removals: the aggregate score can come out, because a mark needs only the spans.
- Orphans: none.
- Bounds: a scan walks every present cell of every table and has no cap. It needs a character cap tied to `CAPTURE_SIZE_WARN_CHARS`, and past the cap the capture records that scanning stopped.
- Current behavior: the inert file and the missing labels match main. No code supports "an agent reads every capture".

### Refactor
(b) Before the scanner, add one `renderPageSection` helper, modeled on `renderNote`, that wraps every page-derived section with a standing label. That helper delivers the labels path alone (a), and a scanner's span marks later go through the same helper (c).

### Effort
M: vendoring a library, the format bump, and hostile-payload tests take two to three days. The labels path alone is S.

### Urgency
P2: no automated reader of captures exists yet. The labels should land before #295's runner, which reads captures.

## #328 — [follow-up] one settings record cannot describe two simplified tables on one page

**Summary:** #328 · [follow-up] one settings record cannot describe two simplified tables on one page · update then keep · L · P2

### Can it be closed
No. `DR_STORE` still holds one `settings` object per page in `chrome-extension/app/store.js`. The `state:settingsChanged` subscriber in `content.js` applies that object to the active table alone. The registry entry keeps a second copy per table as `lastRoundOptions`. A pillbox press that moves the active table clears `rangeExpr`, and a code comment there points to #328 as the replacement. `docs/design.md` ("One settings record per page") already documents the limit, so option 3 has shipped.

### Can it be updated
Yes. The issue says "the record" and "the record's values" several times. "Record" is a retired synonym, so a rewrite uses "settings record". "One resolution step decides" personifies the step. Use "determines". "Simplified values" should read "the table's simplified form". Every other term matches `docs/vocabulary.md`.

A rewrite should cover the following points:
- Option 3 is done.
- A pillbox press that moves the active table clears the range expression. This is the stopgap for the problem.
- A right-click activation still carries the range expression into the apply that runs when the sidebar opens.
- The lens preview reads the page-wide settings record.
- The on/off value interacts with the lock's stash.

It should offer two options:
- Per-table settings, with the settings record as the default a newly activated table inherits.
- The same scheme applied to only the offsets and the range expression.

Urgency stays medium.

### New capability
For the user: two tables on one page can each carry their own simplification, and the sidebar shows the settings of the table the user activated.
For the developer or tester: each table has one answer for its options, with no clear-on-move special cases.

### Files
- `chrome-extension/app/store.js`
- `chrome-extension/content.js` (`intent:toggleTable`, the contextmenu handler, `resimplifyReplacedTable`, `extractPreviewSamples`, `request:settings`)
- `chrome-extension/sidebar.js`
- `chrome-extension/lib/dr-capture/state.js`
- `chrome-extension/constants.js`
- `docs/design.md`
- `docs/vocabulary.md`

### Complexity
Option 1 adds a resolution step and an inheritance rule. It removes three things:
- the separate `lastRoundOptions` copy, once the per-table settings take its place
- the range-expression clear on a moved press
- the clear in `resimplifyReplacedTable`

Net for option 1: neutral. Option 2 splits the settings in two, which adds a special case. Net for option 2: adds.

### Simplicity
- **Size:** Option 1 promotes `lastRoundOptions` to per-table settings and deletes two clear branches. The code stays about the same size.
- **Duplicates:** `settings` and `lastRoundOptions` both answer "what options apply to this table". The change should merge them first.
- **Removals:** A moved press no longer needs `patch.rangeExpr = ''`, and a replaced table no longer needs its `rangeExpr: ''` clear.
- **Orphans:** After the merge, `setTableRoundOptions` and `getTableRoundOptions` have no reader unless they are renamed into the new accessors.
- **Bounds:** The change adds nothing unbounded. It adds one entry per registered table, and the table count is bounded already.
- **Current behavior:** The claims reproduce on `main`. A second table's press rewrites `enabled`, while the first table stays simplified with its own `lastRoundOptions`.

### Refactor
Option (b), a refactor that precedes the work: a `refactor/` pull request makes the registry's `lastRoundOptions` the one per-table options field, and `roundTable` and the re-apply pass read it. The feature then makes `request:settings` and `request:applySettings` read and write the active table's field. The settings record becomes the default for a table with no field yet.

### Effort
L: the change touches the controller, the application model, the sidebar's sync on table switch, the lock's stash, the capture state, and many pinned tests.

### Urgency
P2. Nothing is broken, `docs/design.md` documents the limit, and no work is blocked. It does block the side-by-side table case the issue expects soon.

## #336 — [follow-up] the extension README lists a range expression the sidebar does not show

**Summary:** #336 · [follow-up] the extension README lists a range expression the sidebar does not show · update then keep · S · P3

### Can it be closed
No. The defect reproduces on main (059432e). `chrome-extension/README.md:3` still lists "a range expression" among the sidebar settings. `chrome-extension/sidebar.html:411` still declares `rangeSection` with `hidden`, and no script removes the attribute. `chrome-extension/tests/source-checks.js:157-164` asserts that the section stays hidden. No merged pull request or closed issue restores the control.

### Can it be updated
The issue calls line 3 the only user-facing gap. That is wrong. `README.md:55` tells the reader to use the range expression to leave out a column of five-digit postal codes, and no control exists to do that. A rewrite should cover both lines, drop the range expression from the line 3 list, and replace the line 55 advice with a currently reachable option, or remove it. Line 11 describes what a press does to the range expression, and that behavior is still accurate.

Vocabulary fixes for the rewrite:
- "Exclusions" covers only first row, first column, currency, and percent. Date, time, and word handling are separate settings.
- "the extension's settings" becomes the settings record.
- "bug capture" becomes capture.
- "control panel" becomes sidebar.
- "Range" as a proper noun becomes the range expression.

The rewrite should keep path 1: correct the README now, and restore the lines in the change that shows the control again.

### New capability
For the user: the README describes only controls the sidebar shows.
For the developer or tester: nothing new. The manual test gap for the rule that clears the range expression stays until the control returns.

### Files
- `chrome-extension/README.md` (lines 3 and 55)
- `chrome-extension/sidebar.html` (reference only)
- `chrome-extension/tests/source-checks.js` (reference only)

### Complexity
The change is documentation only. It adds and removes no states, paths, options, abstractions, or special cases. Net: neutral.

### Simplicity
- Size: removes one list item and one sentence of advice. No code changes.
- Duplicates: none. The range expression claims appear only in this README.
- Removals: nothing is added, so nothing can come out.
- Orphans: none. `rangeExpr` stays a live field of the settings record.
- Bounds: none held.
- Current behavior: the defect reproduces. The claim that line 3 is the only gap does not match the code, because line 55 is a second one.

### Refactor
(a) Showing the control again would replace this work. That is a feature change and belongs in its own issue. (b) Nothing needs to precede the edit. (c) The issue has no follow-up that tracks showing the control again. Opening one would give the README restoration and the manual test a home.

### Effort
S: two README lines.

### Urgency
P3. A reader looks for a control that is not there. The edit carries no correctness, security, or testing risk, and no other work depends on it.

## #338 — Comments record history and design reasoning instead of current behavior

**Summary:** #338 · Comments record history and design reasoning instead of current behavior · update then keep · M · P3

### Can it be closed
No. The blocker is gone: #325 closed on 2026-09-15 through PR #347. Every example the issue gives is still on main. In `chrome-extension/app/store.js`, the "Before this sprint" registry block (line 69), the case for WeakMap over WeakRef (lines 83–99), and the header paragraph on the retired sidebar-open field (lines 40–45) are all present. The comment's stale all-capitals topic names (`APPLY_OK`, `TABLE_SWITCHED`, `RANGE_ERROR`, `MENU_CLICKED`, `TABLE_TOGGLE_STATE`) match no string in code. They remain in `content.js`, `sidebar.js`, `ui-toggle.js`, and `sidebar.html`. Twelve extension comment lines outside tests still mention a sprint.

### Can it be updated
Yes. Remove the dependency on #325 and the choice between two paths, since #325 has merged. Put the stale topic names from the comment into the body. A rewrite should state one test for every comment: keep a line only if it states a current constraint the code cannot show, and remove narration of earlier code and arguments for settled choices. It should cover the extension's comments first and the living docs second. It should also propose a rule in AGENTS.md, since no rule on comment content exists and the same drift will return without one. Vocabulary: the comment's "side panel" should read **sidebar**, and "cross-context messages" should read **cross-context topics**. "Messages moved onto the event bus" should read "topics moved onto the event bus". Keep sprint logs as the pointer for history. They are historical records under AGENTS.md.

### New capability
For the user: none.
For the developer or tester: shorter comments that match the code, and no topic names that no code uses.

### Files
`chrome-extension/app/store.js`, `chrome-extension/content.js`, `chrome-extension/sidebar.js`, `chrome-extension/sidebar.html`, `chrome-extension/ui-toggle.js`, `chrome-extension/background.js`, `chrome-extension/lib/dr-table/detect.js`, `chrome-extension/adapters/messaging.js`, the living docs listed in AGENTS.md, and AGENTS.md itself for the new rule.

### Complexity
Removes prose only: no states, paths, options, or abstractions change. An AGENTS.md rule adds one convention. Net verdict: removes.

### Simplicity
- Size: comment lines shrink and code stays the same.
- Duplicates: history comments repeat the git history and the sprint logs.
- Removals: the pass adds nothing to remove.
- Orphans: stale topic names are orphaned references. Remove them.
- Bounds: none.
- Current behavior: every cited example reproduces on main.

### Refactor
(a) No refactor replaces the sweep. (b) None needs to come first. (c) Add a `scripts/check-vocab.sh`-style check that flags retired topic names or "Before this sprint" phrasing. It would hold the sweep's result.

### Effort
M. About 3,200 comment lines across six large extension files need reading line by line.

### Urgency
P3. Nothing blocks on it and user impact is zero. Developer friction grows with each refactor, and the stale topic names mislead anyone reading the messaging code.

## #329 — A range whose ends simplify to the same value prints that value twice

**Summary:** #329 · A range whose ends simplify to the same value prints that value twice · update then keep · S · P2

### Can it be closed
No. The defect reproduces on main. The extracted branch of `cellPatches` in `chrome-extension/content.js` rounds each match on its own and never compares one result with the next. Run through the library, `245–250` at offset -0.5 gives `250–250`. The issue's table for `230–245` matches the code at steps 100, 50, 25 and 10. No closed issue or merged pull request covers it.

### Can it be updated
Yes. A rewrite should cover these points:
- **Terms.** "range cell" is not in `docs/vocabulary.md`, and it clashes with "range expression" and with the retired sense of "range" (canonical: dataset). Coin a new term, for example "dash pair", and define it in the vocabulary as a kind of extracted cell. Replace "the lens is coarse enough" with "the offset is coarse enough". "Capture" and "step" are canonical.
- **Where it applies.** The shape exists only in extracted cells, so it rounds only while the sidebar's "words" setting is on.
- **Restore.** The originals hold each text piece's text, not the cell's whole text. A restore works through written text, so the collapse leaves restore unaffected. A test should confirm this.
- **When to collapse.** Collapse only when the source ends differ. A source `3–3` stays as written.
- **What counts as the join.** The text between the two numbers holds a hyphen, en dash or em dash, plus whitespace and format marks, so `$245–$250` becomes `$250`. The footnote in the capture stays: `250[b]`.
- **Both table kinds.** Both kinds share `cellPatches`, so the change reaches both.
- **Manual test.** Add a `245–250` row to section 6 of `docs/test-pages/tables.html`.

### New capability
For the user: a dash pair whose ends land on one step shows one value.
For the developer or tester: one tested rule for joined numbers in an extracted cell.

### Files
- `chrome-extension/content.js` (`cellPatches`)
- `chrome-extension/lib/dr-number/parsing.js` (list of join characters)
- `chrome-extension/tests/rounding-pass.js`
- `chrome-extension/tests/number.js`
- `docs/test-pages/tables.html`
- `docs/vocabulary.md`

### Complexity
The change adds one special case in the extracted patch step, one list of join characters and one vocabulary term. It adds no settings and no states. Net: adds.

### Simplicity
- **Size:** one helper of about 15 lines, plus tests. Nothing is removed.
- **Duplicates:** `cellPatches` is the single patch step for both table kinds, so no duplicate path is involved.
- **Removals:** add no setting to turn the collapse on or off.
- **Orphans:** none.
- **Bounds:** the walk covers one cell's matches and is bounded by the cell's text.
- **Current behavior:** the doubling reproduces. The claim that the originals hold the whole cell text is imprecise.

### Refactor
(c) Put the pair detection in `dr-number` as a function that returns the span to drop. `cellPatches` then emits one patch, `245–250` to `250`, inside one text piece. No refactor has to come first.

### Effort
S: one branch in the shared patch step, plus tests and a row on the test page.

### Urgency
P2: the defect damages credibility on a common shape in published tables. No data is lost, restore is unaffected, and no other work is blocked.

## #349 — [follow-up] the sidebar reads from its own tab and writes to whichever tab is in front

**Summary:** #349 · [follow-up] the sidebar reads from its own tab and writes to whichever tab is in front · update then keep · S · P3

### Can it be closed
No. On `main`, `createBoundTab` in `chrome-extension/sidebar.js` filters incoming topics by `boundTabId`. `request()` in `chrome-extension/adapters/messaging.js` still passes `null` options to `sendToTab`, and `sendToTab` then looks up the front tab with `chrome.tabs.query({ active: true, currentWindow: true })`. All four request topics resolve this way. No merged pull request passes a tab number on requests. PR #350 made the sidebar close on a switch away, so the defect now lives only in the short gap before that close runs.

### Can it be updated
Yes. The body describes an "away message" that PR #350 removed, and the second comment narrows the scope by hand. A rewrite should say this: the sidebar filters incoming topics by the bound tab and sends its four request topics to the front tab. The two tabs match only because the sidebar closes on a switch away. The fix passes the bound tab's number on every request, so the bound tab holds in both directions as a stated rule. A request sent before the bound tab is known, or sent to a closed tab, answers undefined, and the sidebar shows its unbound state. Priority: Low.

Vocabulary fixes:
- "report" → publish or state-change topic
- "page code" → content script
- "question" → request topic
- "settings write" → apply (`request:applySettings`)
- "sidebar's settings page" → sidebar
- "front tab" is not defined in the vocabulary. The rewrite should define it once, or use "active tab" in the browser's own sense and keep it distinct from the vocabulary's active table.

### New capability
For the user: none visible. An apply always reaches the page the sidebar was opened for.
For the developer or tester: one rule states the sidebar's target tab in both directions, and a stubbed test can check it without timing a tab switch.

### Files
- `chrome-extension/adapters/messaging.js`: `request`, `sendToTab`
- `chrome-extension/sidebar.js`: `createBoundTab`, and the request call sites at lines 492, 647, 838, 898 and 1109
- `chrome-extension/tests/messaging-model.js`
- `chrome-extension/tests/sidebar.js`

### Complexity
- Adds one options argument to `request()`.
- Adds one accessor on the bound-tab unit, beside the existing `windowId()`.
- Removes the front-tab lookup branch in `sendToTab`. Once every caller passes a tab number, that branch has no reader.

Net: neutral to removes.

### Simplicity
- Size: adds a parameter and an accessor. Removes the query fallback in `sendToTab`.
- Duplicates: `resolve()` and `sendToTab` each run the same front-tab query. After the change, only `resolve()` runs it.
- Removals: a tab-routed send with no tab number can answer undefined, so no fallback path is needed.
- Orphans: the query branch in `sendToTab` has no reader afterwards. Remove it in the same change.
- Bounds: none. Each request sends one message, with no retry.
- Current behavior: confirmed on `main` (`request()` at line 386 passes `null` options). The stray-click scenario in comment 1 no longer reproduces, because the sidebar closes on a switch away.

### Refactor
(c) Keep one tab-routed send path: every caller supplies the tab number, and a missing number answers undefined for a request and throws for a publish. This path serves the service worker and the sidebar alike.

The source-scan tests at `tests/messaging-model.js:4289` and `tests/sidebar.js:1680` match the literal call text `request('<topic>'`. They need to match the new call shape.

### Effort
S: one parameter, five call sites, one branch removed, and stubbed tests.

### Urgency
P3. No user reaches the gap in ordinary use. This is a correctness rule that currently holds only because the sidebar closes on a switch away, and no other work waits on it.

## #363 — [follow-up] the configuration file header lists the service worker among its loaders

**Summary:** #363 · [follow-up] the configuration file header lists the service worker among its loaders · update then keep · S · P3

### Can it be closed
No. The defect still exists on main. Lines 4–6 of `chrome-extension/constants.js` say all three contexts load the file, and they name `importScripts` in `background.js` as the service worker's route. `background.js` line 11 loads only `adapters/messaging.js`, and its comment says the settings contract no longer reaches that context. The file has two loaders: `manifest.json` `content_scripts` and `sidebar.html` line 467. `docs/design.md` line 205 already names just those two, so `constants.js` is the only place that still makes the old claim. No open or merged pull request touches the sentence.

### Can it be updated
Yes, for vocabulary. The body uses "tuning block", which is a retired synonym for **detection settings**, and the vocabulary gate blocks that pattern in new prose. "Control panel page" leans toward the retired "panel". The canonical term is **sidebar**, defined as "the extension's control panel page", so the definition line can stay. The rewrite should say this: the configuration file's header lists the service worker as a loader. The service worker loads only the event bus. The header should list the content script and the sidebar as the two loaders. One more fix fits the same edit: lines 11–12 of the header use "the right-click toggle". The canonical term is **menu toggle**. "Stay in lockstep" is fine as written. Priority stays low.

### New capability
For the user: none. For the developer or tester: the header of the configuration file matches the actual loaders, so nobody adds a constant for the service worker and finds it undefined at run time.

### Files
- `chrome-extension/constants.js` (header comment, lines 4–12)
- `chrome-extension/background.js` (reference only)
- `docs/design.md` line 205 (already correct)

### Complexity
The change edits a comment only. It adds and removes no states, paths, options, abstractions, or special cases. Net: neutral.

### Simplicity
- **Size:** The header loses one clause and the code is unchanged.
- **Duplicates:** The file's loaders are stated in three places: the `constants.js` header, the `background.js` comment, and `design.md` line 205. The `design.md` row is the canonical statement.
- **Removals:** The loader list in the header can shrink to "the content script and the sidebar", or it can go and point to `design.md`.
- **Orphans:** None. Nothing reads the comment.
- **Bounds:** None. The change adds nothing unbounded.
- **Current behavior:** The claim checks out on main. `background.js` line 11 imports only `adapters/messaging.js`.

### Refactor
(c) Remove the loader list from the header and keep the list only in `design.md`. This follows "Group like concepts into a single location". A comment in `adapters/messaging.js` at line 104 also says "All three contexts load it", which is true of that file, so it needs no change.

### Effort
S. The fix is one comment edit with no test impact.

### Urgency
P3. The issue is documentation inside the code, has no user impact, and blocks no other work. The only cost is a small risk that a developer gets misled.

## #360 — [follow-up] give rendered text and raw text vocabulary rows and settle displayed text

**Summary:** #360 · [follow-up] give rendered text and raw text vocabulary rows and settle displayed text · update then keep · S · P3

### Can it be closed
Only in part. Commit e265247 added the "rendered text" row to docs/vocabulary.md. "Displayed text" never appeared in docs/vocabulary.md, so the issue's claim about the capture entries does not hold. Two gaps remain. "Raw text" has no row, and chrome-extension/README.md:121, docs/design.md:276 and the data test row all use it. The capture code still names its read `getDisplayedText` and `displayedText` (detect.js:247, 266, 356, 541; dr-capture/state.js:95; the tests).

### Can it be updated
Yes. "Raw text" in the sense of `textContent` is the canonical term **flat text**, because `textContent` joins every text node in page order, and so does `collectTextPieces`. "Raw text" also carries a second sense, the raw form: design.md:276 says "restores the raw text", and "raw values" is already a retired synonym for **originals**. "Displayed text" is rendered text on a native table and flat text on a grid, so option 1 in the issue would mislabel grids. A rewrite should say:
- Replace "raw text" with "flat text" in the three living docs, and with "originals" wherever it means the raw form.
- Add a retired-synonym row: say "flat text", not "raw text".
- Remove "displayed text" from the capture code and its tests, and rename the read to what it returns on each kind.
- Drop options 2 and 3.

### New capability
For the user: none.
For the developer or tester: one name per cell read, and the vocabulary gate catches "raw text".

### Files
docs/vocabulary.md, docs/design.md, chrome-extension/README.md, chrome-extension/lib/dr-table/detect.js, chrome-extension/lib/dr-capture/state.js, chrome-extension/lib/dr-capture/render.js, chrome-extension/tests/messaging-model.js, chrome-extension/tests/capture-log.js.

### Complexity
Adds one retired-synonym row. Removes one term from the docs ("raw text") and one read from each adapter (`displayedText`). Net: removes.

### Simplicity
- Size: the code shrinks. Two read closures go and one vocabulary row comes in.
- Duplicates: `reads.displayedText` returns the same text as `reads.liveText` on both kinds (detect.js:356 and 532–541).
- Removals: the `displayedText` field comes out with no loss.
- Orphans: once the field goes, `getDisplayedText` can return `liveText()` or be removed, with its callers switched to one read.
- Bounds: none.
- Current behavior: the rendered text row exists, and the vocabulary's capture entries do not say "displayed text". The issue states both wrongly.

### Refactor
(b) First, a `refactor/` pull request removes the `displayedText` field from `makeCellObj` and serves the capture from `liveText`. The existing capture-read tests at messaging-model.js:3580–3652 prove it. The docs sweep follows it.

### Effort
S: a docs sweep, one retired-synonym row, and a small rename.

### Urgency
P3: docs and naming only, with no user impact. No other work is blocked.

## #346 — [follow-up] the control panel's unanswered-question rules are pinned by text, not by outcome

**Summary:** #346 · [follow-up] the control panel's unanswered-question rules are pinned by text, not by outcome · update then keep · S · P2

### Can it be closed
No. No merged pull request drives these paths. On `main`, three unanswered branches in `chrome-extension/sidebar.js` have no behavior test. `pullSettingsAndApplyToUI` calls `applyDefaultsToUI` (line 840). `fetchPreviewSamples` calls `setTableBound(false)` (line 496). `saveCapture` saves with a null page half (lines 1109–1112). The only checks on them are the text searches at `tests/sidebar.js:402` and `:1694`. The suite passes, 3638 of 3638.

### Can it be updated
Yes. A rewrite should state four corrections:
- A sidebar harness already exists: `makeIssue251SidebarHarness` in `tests/helpers.js:2279` runs all of `sidebar.js`. It returns no answer only to the settings apply, through its single `lastError` switch.
- The `unbind-locked` test already covers the unbind in `applyNow` by outcome. The gap is limited to the settings pull, the lens preview pull, and the state pull.
- Since #409, finish waits for the state pull and the screenshot through a counter of two.
- The test paths moved in #477.

A rewrite should also say that #299 does not block this work.

Vocabulary: "control panel" is **sidebar**. "Ask" is a **request topic** to the content script's **responder**. "Unanswered" means no responder answered. "Preview bands" is a retired synonym for **lens preview**. "Unconnected state" is the **unbound** sidebar. "Page's half" is the **state pull** result. "Finish button" is **finish**. "Shipped defaults" and "text scan" have no entry in docs/vocabulary.md. Use "the settings contract's defaults", and add a term for a check that searches source text.

### New capability
For the user: none directly.
For the developer or tester: a change that breaks any of the three fallbacks turns the suite red.

### Files
`chrome-extension/tests/helpers.js`, `chrome-extension/tests/sidebar.js`, `chrome-extension/sidebar.js` (read only), `chrome-extension/tests/number.js`.

### Complexity
The work adds a harness setting that selects which request topics go unanswered, and three outcome tests. It removes two text-search checks. It adds no product states or paths. Net: neutral.

### Simplicity
- Size: about three tests and one harness setting added, two text searches removed.
- Duplicates: `tests/number.js:2709–2722` repeats the harness's mock `chrome` and its `lastError` switch.
- Removals: the per-topic setting replaces the global `lastError` switch.
- Orphans: the regexes at `tests/sidebar.js:402` and `:1694` lose their purpose, so both checks go.
- Bounds: none. The capture counter is fixed at two.
- Current behavior: all three rules hold on `main`. The claim that no harness exists and the claim that the apply unbind is untested do not match `main`.

### Refactor
(b) First, in a `refactor/` pull request: replace the harness's `lastError` switch with a per-topic set of unanswered topics, merge the copy in `tests/number.js`, and rename the harness to a name without the issue number. The capture test also needs `captureVisibleTab` and file-save stubs and the capture package source. (a) The #299 view model does not replace this work, because the request callbacks remain wiring code that a test has to run.

### Effort
S: the harness exists, and the work is one setting, a few stubs, and three tests.

### Urgency
P2: no user impact today. The capture path changes often (#402–#409), and a lost unanswered save would go unreported. No other work waits on this.

## #351 — [follow-up] a tab switch in a second window closes the sidebar in the first

**Summary:** #351 · [follow-up] a tab switch in a second window closes the sidebar in the first · update then keep · S · P3

### Can it be closed
No. On `main`, the `chrome.tabs.onActivated` listener in `chrome-extension/background.js:72-76` compares the tab alone. A switch in any window publishes `intent:closeSidebar`, and that topic goes to every extension page (`ROUTE_EXTENSION_PAGES`). `sidebar.js:700` closes on it. The sidebar's own `onSwitchAway` (`sidebar.js:118-126`) skips any switch in another window, so the two rules disagree. No merged pull request touches this.

### Can it be updated
Yes. The issue ties the fix to part two of `docs/specs/2026-09-14-sidebar-state-removal.md`. The spec's addendum has since changed part two, and part two now waits on open product questions. The sidebar already closes itself on a switch in its own window, by either entry route. Deleting the worker's switch listener therefore fixes the defect with no dependency on part two. A rewrite should say:
- the defect, stated with the tab and the window;
- one recommended fix: remove the worker's switch leg;
- the part-two dependency is gone.

It should also record an adjacent case. Tab reload, tab close, and page unload still broadcast the close, so a reload in window A also closes a sidebar in window B.

Vocabulary:
- "report" (the browser's event) is the retired synonym of "publish". Say "event".
- "Activation" collides with table activation (`state:tableActivated`). Say "tab switch".
- "settings page" should read "sidebar" (the control panel page).
- Rewrite these phrases, which fail the personification rule: "the sidebar decides", "comes to the opposite answer", "the worker learned".

### New capability
For the user: a sidebar stays open while the user works in another window. For the developer or tester: one rule governs a tab switch, and it lives in the sidebar.

### Files
- `chrome-extension/background.js`
- `chrome-extension/sidebar.js` (`createBoundTab`, reference only)
- `chrome-extension/tests/source-checks.js` (bg routing tests near line 1330 trigger the close through `listeners.activated`)

### Complexity
Removing the worker's switch listener removes one path and one duplicated rule. The alternative fix, recording the window in the worker, adds one stored field. Net: removes.

### Simplicity
- Size: about five lines removed; test triggers move to `onRemoved`.
- Duplicates: the switch rule exists twice, in `background.js:72` and `sidebar.js:118`. The change deletes one copy.
- Removals: nothing is added.
- Orphans: `sidebarTabId` keeps three readers (`onUpdated`, `onRemoved`, `state:pageUnloaded`), so none is orphaned.
- Bounds: none.
- Current behavior: the code confirms the defect on `main`. The issue's reliance on part two is out of date.

### Refactor
(a) Deleting the worker's `onActivated` listener is the whole fix. (c) Later, the remaining broadcast triggers could carry the bound tab so that only the matching sidebar closes, which settles the two-window reload case.

### Effort
S: one listener removed and three test triggers moved.

### Urgency
P3: an interruption with no data loss, confined to users who work in two windows. No other work is blocked.

## #369 — [follow-up] the capture's tuning section prints three value shapes and fails on others

**Summary:** #369 · [follow-up] the capture's tuning section prints three value shapes and fails on others · update then keep · S · P3

### Can it be closed
No. On `main`, `renderDetectionSettingsRows` in `chrome-extension/lib/dr-capture/render.js` still has the defect. A node run against it reproduces all three failures. A bare object prints `[object Object]`. A nested or mixed list prints index keys such as `0: x; 1: y`. A profile list with a `null` after an object throws `Cannot convert undefined or null to object`, and `sidebar.js:1073` then shows "Capture failed; nothing was saved." No merged pull request touches this. `DR_DETECTION_SETTINGS` in `chrome-extension/constants.js` holds no value with these shapes today.

### Can it be updated
Yes. The code facts are still true, but the names are out of date. Vocabulary fixes:
- "tuning block" becomes **detection settings**.
- "tuning section" becomes the capture's Detection settings section.
- "tuning value" becomes a detection setting.
- "plain value" becomes **plain-value**.
- "hidden JSON block" becomes the **capture state**.
- "the sidebar reports" becomes "the sidebar shows", because "report" is retired as a synonym for publish.
- The original finding names `renderTuningValue` and `renderTuningRows`. Those functions are now `renderSettingValue` and `renderDetectionSettingsRows`.

The rewrite should say this: the Detection settings section branches on the shape of each value. Any other plain-value shape prints wrong or stops the save. The capture state still holds the exact value. The rewrite should keep options (a) and (b), and add a depth cap to option (a).

### New capability
For the user: every capture saves, whatever the detection settings hold. For the developer or tester: a nested detection setting, such as a per-vendor override, prints correctly with no renderer change.

### Files
- `chrome-extension/lib/dr-capture/render.js` (`renderSettingValue`, `renderDetectionSettingsRows`)
- `chrome-extension/tests/capture-log.js`
- `chrome-extension/constants.js` (read only)

### Complexity
Option (a) removes the `isProfileList` special case and merges the two helpers into one walker, but it adds recursion. Verdict: removes. Option (b) adds one fallback path and keeps both branches. Verdict: adds.

### Simplicity
- Size: option (a) replaces about 25 lines with one walker of similar size. Option (b) adds about 3 lines.
- Duplicates: `renderSettingValue` and the profile branch each walk a list their own way. Option (a) merges them.
- Removals: option (a) removes the first-item shape test.
- Orphans: option (a) leaves `renderSettingValue` with no caller, so the same change removes it.
- Bounds: option (a) walks to any depth. It needs a cap, e.g. depth 3, with a fallback to escaped JSON text when the walk reaches the cap. `JSON.parse(JSON.stringify(...))` in `state.js:145` already rules out cycles.
- Current behavior: all three stated failures reproduce on `main`.

### Refactor
(c) Merging `renderSettingValue` and the profile branch into one recursive renderer is the fix itself, and it simplifies the section. Wrapping the rows in a try/catch that falls back to escaped JSON would also keep one bad value from blocking the save.

### Effort
S: one function in one file, plus tests for the three shapes.

### Urgency
P3: no current value triggers the defect. The first change that adds a nested detection setting has to carry the fix, or every capture breaks.

## #375 — [follow-up] three comments still describe the retired ARIA pass

**Summary:** #375 · [follow-up] three comments still describe the retired ARIA pass · update then keep · S · P3

### Can it be closed
No. All three stale comments stand on main. `chrome-extension/lib/dr-table/detect.js:46` still describes `GRID_ARIA_SELECTOR` as the selector "for the cheap load-time ARIA pass". The selector now feeds the qualifying-element guard and the nomination step (`findTables`) at lines 1703, 1872, and 1932. The §15 comment in `docs/test-pages/tables.html` has moved to line 1060. It still says native-table and ARIA passes re-check an added subtree, while `content.js:566` runs `findTables` on the added root. The header of `chrome-extension/ui-toggle.js`, lines 9–13, still gives the file as the home of `looksLikeGrid`, `findTargetTable`, and `isDataTable`. All three functions are defined in `detect.js`, at lines 1199, 1315, and 1515. No merged pull request touches these lines.

### Can it be updated
Yes. The line reference for the test page is out of date (1034 is now 1060). The `ui-toggle.js` header also uses retired terms that the issue leaves out. "toggle widget" should be pillbox. "selection" should be the active table. "store" in the prose should be the application model. The §15 comment says "mutation observer" where the canonical term is detection of added nodes. "Nomination step" appears in `docs/vocabulary.md` but has no row of its own. The rewrite can use it as is, or define it in the same branch. "ARIA pass" is a retired name with no entry in the vocabulary. A rewrite should say:
- Three comments describe a detection shape that no longer exists.
- Each should name the nomination step and the detection layer.
- The `ui-toggle.js` header should also switch to pillbox, active table, and application model.
- No user impact.

### New capability
For the user: none. For the developer or tester: the comments match where detection lives and how a grid enters the registry.

### Files
- `chrome-extension/lib/dr-table/detect.js`
- `chrome-extension/ui-toggle.js`
- `docs/test-pages/tables.html`
- `docs/vocabulary.md` (only if the nomination step gets a row)

### Complexity
Comments only. No states, paths, options, abstractions, or special cases change. Net verdict: neutral.

### Simplicity
- Size: three comment blocks get rewritten and no code changes.
- Duplicates: none. The one selector constant already feeds every role check.
- Removals: the `ui-toggle.js` header can drop its detection paragraph entirely.
- Orphans: none are left behind. The retired pass left no leftover code.
- Bounds: nothing unbounded.
- Current behavior: every claim reproduces on main. Only the test-page line number is out of date.

### Refactor
(a) None. (b) None needed. (c) Shortening the `ui-toggle.js` header to cover only the pillbox view, and dropping its "before the sprint" history, would remove stale content that the issue does not cover.

### Effort
S: three comment edits in one `docs:` commit.

### Urgency
P3. No user, correctness, or security impact, and no other work waits on it. The only cost is a wrong picture for the next reader of detection.

## #367 — [follow-up] the oldest data-test test block's header states the retired rule

**Summary:** #367 · [follow-up] the oldest data-test test block's header states the retired rule · update then keep · S · P3

### Can it be closed
No. The stale header still exists on main, but it has moved. The test-file split (67d3d83, 970feeb) moved the comment to `chrome-extension/tests/helpers.js:333-341`, above `makeIsDataTable`. The tests it introduces now live in `chrome-extension/tests/detection.js:94` onward. The comment still gives the numeric step as "CLEAN_REGEX stripped + parseFloat + isFinite" and still leaves out the budget of 1000 cell reads (`DR_DETECTION_SETTINGS.dataTestCellBudget`). No closed issue or merged pull request covers it.

### Can it be updated
Yes. The cited location `chrome-extension/tests.js:3134-3140` no longer exists. A rewrite should give the path in `tests/helpers.js` and should note that the header is now separated from its tests, which are in `tests/detection.js`. It should say that the comment describes the numeric step as a regex strip followed by float parsing, while `isDataTable` hands each cell to the numeric probe. It should also say that the comment leaves out the budget of cell reads. The recommended option is to delete the bullets and keep one line in `detection.js`, above the first `isDataTable_*` test, that points to the data test entry in `docs/vocabulary.md`. The header at `detection.js:2313` already describes the budget. Vocabulary: "data test", "data table", "numeric probe", and "budget of cell reads" all match current use. "numeric probe" appears only as a phrase inside the currency list entry and has no entry of its own. The code's word "heuristic" and the sprint label "layout-table-exclusion" are not vocabulary terms. The retired synonyms table has no row for either. The rewrite should use "data test".

### New capability
For the user: none. For the developer or tester: the test comments state the data test in one place, which matches the code.

### Files
- `chrome-extension/tests/helpers.js` (lines 333-341)
- `chrome-extension/tests/detection.js` (line 94 and the header at 2313)
- `docs/vocabulary.md` (data test entry, read only)

### Complexity
The change removes a second statement of the data test rule. It adds no state, path, option, or abstraction. Net: removes.

### Simplicity
- **Size:** about eight comment lines come out and one pointer line goes in.
- **Duplicates:** the rule is stated in the vocabulary, in the `isDataTable` body comment, in the header at `detection.js:2313`, and in this stale header. The change removes the stale copy.
- **Removals:** the "Sprint layout-table-exclusion" label can come out as well, since it records history only.
- **Orphans:** none. `makeIsDataTable` keeps its readers in `detection.js`.
- **Bounds:** none held.
- **Current behavior:** the drift reproduces on main at the new path. The claim about the old path no longer matches.

### Refactor
(c) An optional `refactor/` sweep could replace every "Sprint <name>" banner in `tests/helpers.js` with a line naming the behavior it covers. `helpers.js` holds at least five such banners (lines 334, 1434, 1589, and others) that now sit away from their tests. This fix can ship alone.

### Effort
S: comment edit in two test files, no code change.

### Urgency
P3: no user, correctness, or security impact. The stale comment affects only a reader of the test helpers, and it blocks no other work.

## #374 — [follow-up] the nomination step exposes no chain root for a nest that registers nothing

**Summary:** #374 · [follow-up] the nomination step exposes no chain root for a nest that registers nothing · close · S · P3

### Can it be closed
Yes. Pull request #386 shipped the requested surface, and the design matches the scope comment. `chrome-extension/lib/dr-table/detect.js` defines a public `nominateNest(chainRoot, opts)`. It returns `{ chainRoot, selected, outcome, chainSize }`, with the outcome kinds `selected`, `empty`, `crowded`, and `registered`. `nominateNests` composes it once per chain root, and `findTables` keeps only the `selected` outcomes. A public `chainRootOf(el)` wraps the private `_chainRootOf` walk. The controller in `chrome-extension/content.js` (`consumeNomination`) reads the `empty` outcome to hold a pending table, and no file outside `detect.js` calls `_chainRootOf` or `_depthInChain`. The test suite passes, 3638 of 3638, and it includes `nominateNest` cases in `chrome-extension/tests/detection.js`.

A small gap remains: the `DR_TABLE` re-export list in `chrome-extension/lib/dr-table/index.js` holds `chainRootOf` but leaves out `nominateNest` and `nominateNests`. Every consumer reads the bare global names, so nothing breaks today.

### Can it be updated
No rewrite is needed. The issue predates the vocabulary: it calls the pending table "a planned state" and a chain root "the outermost role-bearing element". `docs/vocabulary.md` now defines chain root as the outermost qualifying element, and it defines pending table, containment chain, and nesting depth. The issue uses no retired synonym. A closing comment should cite #386 and name the two missing re-exports, filed as a separate follow-up if wanted.

### New capability
For the user: a grid that arrives before its rows registers when the rows arrive (#386). For the developer or tester: one per-nest call reports why a nest registered nothing. Tests can assert the outcome kind directly.

### Files
- `chrome-extension/lib/dr-table/detect.js`
- `chrome-extension/lib/dr-table/index.js`
- `chrome-extension/content.js`
- `chrome-extension/ui-toggle.js`
- `chrome-extension/tests/detection.js`

### Complexity
Already shipped. The change added one public function, one outcome field with four values, and one public wrapper. Both live scanners share one path through `nominateNests`. Net: neutral.

### Simplicity
- Size: the code on main already holds the change; nothing remains to add.
- Duplicates: none. `chainRootOf` delegates to `_chainRootOf`, and both scanners call `nominateNests`.
- Removals: none. Each outcome kind has a reader in `consumeNomination` or in `findTables`.
- Orphans: `nominateNest` and `nominateNests` are missing from `DR_TABLE`. No function is left without a reader.
- Bounds: `chainRootOf` stops at `DR_DETECTION_SETTINGS.gridWalkDepthCap`, and the pending re-test has a cap.
- Current behavior: the defect does not reproduce on main. The chain root and outcome are both public.

### Refactor
(a) Not applicable. (b) Not applicable. (c) Add `nominateNest` and `nominateNests` to the `DR_TABLE` list in `index.js` so the bundle matches the public surface.

### Effort
S: closing takes no code. The optional re-export fix is two lines.

### Urgency
P3: already fixed. The re-export gap has no effect on users and blocks no work.

## #376 — [follow-up] the nomination step re-runs the native-table guard on each ancestor walk

**Summary:** #376 · [follow-up] the nomination step re-runs the native-table guard on each ancestor walk · update then keep · S · P3

### Can it be closed
No. The repetition is still on `main`. `_passesAriaGuards` in `chrome-extension/lib/dr-table/detect.js` runs `querySelectorAll('table')` and then `isPhantomA11yTable` on each nested table. It runs in four places: the qualifying filter in `nominateNests`, the nest filter in `nominateNest`, and once for each ancestor that `_chainRootOf` and `_depthInChain` pass through `_isQualifyingAncestor`. No merged pull request adds a memo.

### Can it be updated
Yes. The mechanism is correct and three corrections apply:
- The cost per call is larger than the issue states. Each accessibility artifact inside an element costs an ancestor walk and a computed-style read, so a repeated guard repeats those reads as well.
- The memo must cover the standalone entry points too. The pending-table re-test calls `nominateNest` directly, and the right-click path calls `chainRootOf`.
- Vocabulary: "native-table guard" is not a term. Write "the two guards that make a qualifying element". Replace "role-bearing grid elements" with "elements carrying a grid or table role". "the native-table pass keeps ownership" personifies the pass. Write "pass 1 registers that table". The terms "nest", "chain root", "load-time scan", and "nesting depth" match the canon.

A rewrite should say this: every walk tests the same element against both guards again, so a scan with nested grids repeats subtree queries and style reads. A lookup scoped to one call removes the repeats and changes no behavior. Priority stays low.

### New capability
For the user: none. The load-time scan and the added-node pass run faster only on pages with deep nests.
For the developer or tester: each call tests each element once, which makes the guard cost of a scan easier to reason about.

### Files
- `chrome-extension/lib/dr-table/detect.js`: `_passesAriaGuards`, `_isQualifyingAncestor`, `_chainRootOf`, `_depthInChain`, `chainRootOf`, `nominateNest`, `nominateNests`
- `chrome-extension/tests/detection.js`

### Complexity
The change adds one cached value, a map from element to guard result. It adds no configuration option and no branch. It adds one thing to thread through the call, either a map in `opts` or a wrapped guard. Net: neutral.

### Simplicity
- Size: about 10 added lines. Nothing comes out unless the depth refactor below lands.
- Duplicates: `chainRootOf` and `_chainRootOf` walk the same ancestors. `nominateNest` guards the nest elements again after `nominateNests` has already guarded them.
- Removals: the map is the only addition, and it cannot come out without losing the requirement.
- Orphans: none.
- Bounds: `gridWalkDepthCap` (15) caps each walk. The map lives for one call, so its size is capped by the elements that call walks.
- Current behavior: the repetition reproduces from the code on `main`. The count of nine queries on the fixture was not re-run.

### Refactor
(c) `_depthInChain` can count ancestors that are members of the nest it already built, in place of `_isQualifyingAncestor`. That change removes the guard calls from the depth walk and needs no memo there. The memo then covers only `_chainRootOf`. (b) Merging `chainRootOf` and `_chainRootOf` into one walk can come first as a `refactor/` pull request.

### Effort
S: one function family in one file, and the existing detection suite proves the change.

### Urgency
P3: no defect, no user report, and no work blocked. Walk depth is already capped. The issue is developer-facing tech debt.

## #377 — [follow-up] a grid element deeper than the walk cap splits its nest

**Summary:** #377 · [follow-up] a grid element deeper than the walk cap splits its nest · update then keep · S · P3

### Can it be closed
No. The defect still holds on `main`. In `chrome-extension/lib/dr-table/detect.js`, `_chainRootOf` checks only ancestors 1 to 15 levels up (`gridWalkDepthCap`, 15). `_depthInChain` stops at the same count and returns -1. A qualifying element 16 or more levels below its chain root therefore heads its own nest in `nominateNests`, and `nominateNest` on the outer chain root drops it. The `'registered'` check in `nominateNest` looks only downward, so both nests register. No merged pull request touches these walks.

### Can it be updated
Vocabulary: "tuning block" becomes **detection settings**. "role-bearing grid element" becomes **qualifying element**. "outer wrapper" becomes **chain root**. "walk cap" has no entry, so the rewrite names the setting `gridWalkDepthCap` directly. A rewrite should say this: the chain-root walk and the depth count stop after 15 levels, so a qualifying element deeper than that below its chain root forms a second nest, and one grid gets two pillboxes. The options should be (a) a separate larger setting, (b) no count, stopping at the chain root or the document body, or (c) accept the edge case. Recommend (b), built on native `closest` hops.

### New capability
For the user: a grid with a deep wrapper structure gets one pillbox.
For the developer or tester: one ancestor walk rule for nests, and a test that pins nests deeper than 15 levels.

### Files
- `chrome-extension/lib/dr-table/detect.js` (`_chainRootOf`, `_depthInChain`, `chainRootOf`)
- `chrome-extension/constants.js`
- `chrome-extension/tests/detection.js`
- `docs/test-pages/tables.html` (new section for a deep nest)

### Complexity
Option (a) adds a setting. Option (b) removes the step counter from two walks and adds no state. Net for (b): removes.

### Simplicity
- Size: (b) shrinks the code, because two counted loops become `closest` hops.
- Duplicates: the change passes through five hand-written ancestor walks: `_chainRootOf`, `_depthInChain`, `chainRootOf`, and two in `findTargetTable`.
- Removals: (b) needs no new setting. The setting that (a) adds can be dropped with no requirement lost.
- Orphans: none. `gridWalkDepthCap` keeps its readers in `findTargetTable` and in the first loop of `chainRootOf`.
- Bounds: document depth bounds the walk, and each `closest` hop reaches the next element that carries a role. The count of those ancestors caps the guard checks, and the walk stops at the document body.
- Current behavior: the code confirms the split at a distance of 16 or more levels. Building the stub tree in the test suite would reproduce it.

### Refactor
(b) The refactor comes first: one helper yields the qualifying ancestors of an element through `parentElement.closest(GRID_ARIA_SELECTOR)` filtered by `_passesAriaGuards`. `_chainRootOf` and `_depthInChain` both read it. This collapses two walks into one and removes the cap from both, which fixes the issue.

### Effort
S: two functions in one file change, plus one stub-tree test and one test page section.

### Urgency
P3: no shipped vendor profile nests this deep, and the defect only adds a second pillbox with no data loss. No other work depends on it.

## #382 — [follow-up] a right-click in a sibling pane of a registered nest registers a second table

**Summary:** #382 · [follow-up] a right-click in a sibling pane of a registered nest registers a second table · update then keep · S · P2

### Can it be closed
No. The defect reproduces on main. In `findTargetTable` (chrome-extension/lib/dr-table/detect.js), step 3 gets nothing back because `nominateNest` returns outcome `registered` with `selected: null`. The call then falls through to the geometry probe. With a flex style probe, a right-click on a pinned-pane cell of `makeDatabaseQueryGrid` returns the pinned pane with `isNew: true` while the scrolling pane is registered. This happens for one pinned column and for two. With two columns the pinned pane passes the data test and gets a second pillbox. With one column `createToggleForTable` skips the pillbox. The right-click still makes the pinned pane active, and the menu toggle then acts on it. Section 13 of docs/test-pages/tables.html has the one-column shape. Pull requests #372 and #384 left this path open, and the step 3 comment points at this issue.

### Can it be updated
Yes. The priority line says no live page shows the shape. That is out of date, because section 13 of the manual test page shows it. Replace "gutter" and "data pane" with pinned pane and scrolling pane. "Nest" and "registry route" are not in docs/vocabulary.md. Use chain root, qualifying element, and containment chain. Do not use "selects" for the nomination step, because "selected table" is a retired synonym for active table. A rewrite should say: a right-click in the pinned pane of a registered grid resolves the grid's registered table. Two cases need their outcomes stated. A two-column pane gets a second pillbox. A one-column pane becomes the active table and takes the menu toggle.

### New capability
For the user: a right-click anywhere in a registered grid activates that grid's one table, and the menu toggle acts on the scrolling pane.
For the developer or tester: a detection test with the scrolling pane registered, and a manual check on section 13.

### Files
chrome-extension/lib/dr-table/detect.js (`findTargetTable`, `nominateNest`), chrome-extension/content.js (contextmenu handler, `intent:menuClicked`), chrome-extension/tests/detection.js, chrome-extension/tests/pillbox.js.

### Complexity
It adds one result field: `nominateNest` also returns the registered element it finds. It removes a special case: the `registered` outcome no longer falls through to the geometry probe. Net: neutral.

### Simplicity
- Size: adds one field and one return. It removes the `findTables` detour if step 3 calls `nominateNest` directly.
- Duplicates: step 2 walks ancestors to find a registered element and step 3 walks the nest to find one. They overlap for grids inside a nest.
- Removals: step 2 stays. It covers grids that the geometry probe registered, which have no chain root.
- Orphans: none. The step 3 comment that cites #382 needs a rewrite.
- Bounds: none new. `nominateNest` already searches the nest with `querySelectorAll`, and step 3 reuses that search.
- Current behavior: reproduced as described. The one-column case differs from the issue: it gets no pillbox, but the pane becomes the active table.

### Refactor
(b) Precede the fix: have step 3 call `nominateNest(chainRoot)` directly in place of `findTables(chainRoot)[0]`. The code comment already says pass 1 returns nothing there. (c) Then change `nest.some(isSeen)` to `nest.find(isSeen)` and return the element it finds with `isNew: false`. The `crowded` outcome still falls through to the geometry probe. That belongs in a separate issue.

### Effort
S. The fix is a return value and one branch in a single function, plus two tests.

### Urgency
P2. The manual test page shows it. The menu toggle acts on the wrong element and nothing reports the error. Nothing depends on this fix.

## #383 — A four-digit count between 1900 and 2099 simplifies to itself as a year

**Summary:** #383 · A four-digit count between 1900 and 2099 simplifies to itself as a year · update then keep · M · P2

### Can it be closed
No. The defect reproduces on `main` (4427b07). `parseDateLike` in `chrome-extension/lib/dr-number/parsing.js:316-319` still accepts `/^(\d{4})$/` for 1900–2099. `isDateLike("2078")` returns true, `roundDateText("2078","year")` returns "2078", and `roundWithOffset(2078,-0.5)` returns 2000. No closed issue or merged pull request covers the defect.

### Can it be updated
Yes. The mechanism is correct, and three details are stale or missing:
- The no-op check now sits in `cellPatches` in `chrome-extension/content.js` (`rounded === trimmed`). The `formattedValue === originalValue` dispatch site the issue cites is gone.
- At decade granularity the same cell changes: 2078 becomes 2080 and gets the marker class, a wrong change the user can see. The rewrite should state this second symptom.
- A cell read as a year stays out of the max magnitude. A `2078` piece also stops a cell from counting as a stacked cell (`stackedMatches` in `chrome-extension/lib/dr-table/detect.js:1118`).

Vocabulary: "marker" becomes "marker class". "Ask the column for evidence" becomes "a column post-pass for bare years". "Reading" is fine. The issue uses no retired synonyms. A rewrite should present path 1 as a second instance of the column post-pass, add the decade symptom, and move path 3 to its own issue, because it covers every date no-op.

### New capability
For the user: a count, price, or identifier in 1900–2099 rounds like the numbers around it. A real year column still simplifies as dates.
For the developer or tester: one column post-pass step that handles more than one kind of pending decision, plus fixtures for a bare-year column and a count column.

### Files
- `chrome-extension/lib/dr-number/parsing.js` (`parseDateLike`, `isDateLike`)
- `chrome-extension/lib/dr-simplify/ladder.js` (`classifyCell`, pending decisions)
- `chrome-extension/content.js` (`resolveAmbiguousDates`, `decisionToLegacyInfo`, `cellPatches`)
- `chrome-extension/lib/dr-table/detect.js` (`stackedMatches`)
- `chrome-extension/tests/number.js`, `tests/ladder.js`, `docs/vocabulary.md` (the column post-pass entry)

### Complexity
Path 1 adds one pending state (`bare-year`) and one resolver branch in the column post-pass. It reuses the post-pass path that already exists. A header signal would add another path on top. Path 3 adds a marker class and a log row for unchanged cells, a new special case. Net: adds.

### Simplicity
- Size: grows by one pending kind and one resolver; the requirement is the column evidence rule.
- Duplicates: `resolveAmbiguousDates` hardcodes the ambiguous-date check; merge it into a general pending resolver first.
- Removals: the header signal can go. Another date in the same grid column is enough.
- Orphans: none, since `isDateLike` keeps its callers.
- Bounds: the post-pass walks the entries already classified, which the cell cap bounds. It adds no new walk.
- Current behavior: the issue's claims match the code, except for the moved no-op check.

### Refactor
(b) Precede the fix with a `refactor/` pull request that turns `resolveAmbiguousDates` into a column post-pass over any `pending` decision, with no behavior change. (c) With that in place, the bare-year rule becomes a small ladder return plus a resolver that falls back to `pure` when the column holds no other date. The same fallback serves `stackedMatches`.

### Effort
M: one refactor pull request plus a fix touching the ladder, the post-pass, stacked-cell detection, and tests.

### Urgency
P2: ordinary data gets a wrong result that the user cannot trace, and turning date simplification off works around it. No other work is blocked.

## #387 — [follow-up] the detection package's export object omits the nomination step's public functions

**Summary:** #387 · [follow-up] the detection package's export object omits the nomination step's public functions · update then keep · S · P3

### Can it be closed
No. `chainRootOf` now sits in `DR_TABLE` and in `EXPECTED_DR_TABLE_NAMES`. `nominateNest` and `nominateNests` are still absent from both. `content.js` (lines 434 and 482) and `ui-toggle.js` (line 384) call them as bare names. No merged pull request adds them.

### Can it be updated
Yes. The count drops from three names to two, because `chainRootOf` already joined. The pin lives in `chrome-extension/tests/source-checks.js`. The original finding names `tests.js`, which is out of date. Option (b) rests on a false premise. No context reads `DR_TABLE`: only the content scripts load `lib/dr-table`, and the sidebar is a separate context that cannot reach it. The only reader is the test suite. The header comment in `index.js` also still says "this sprint does not migrate any consumer", which is out of date.

A rewrite should say this: the bundle lists the detection package's public functions and holds every one except the two nomination functions. It should offer two paths. Path (a) adds both names to the bundle and the pin. Path (b) cuts the comment's claim down to "a re-export list with no production reader". It should link #214, because deriving the list from the source would stop the list from falling behind again.

Vocabulary: "export object" and "detection package" are not defined terms. Use "bundle" (the term `docs/sprint-plans/decoupling-migration.md` uses) and "detection layer". "Nomination step" and "chain root" match the canon. "Scanners" should become "load-time scan and right-click path". No retired synonyms appear.

### New capability
For the user: none.
For the developer or tester: the bundle lists the whole public detection surface, so a reader finds the load-time scan's entry point in one place.

### Files
- `chrome-extension/lib/dr-table/index.js`
- `chrome-extension/tests/source-checks.js` (`drTableBundleIsPublished`)
- `chrome-extension/lib/dr-table/detect.js` (read only)

### Complexity
Path (a) adds two list entries and two pin entries. It adds no state, path, option, or abstraction. Net: neutral.

### Simplicity
- Size: four added lines on path (a); comment lines only on path (b).
- Duplicates: the hand-written pin copies the bundle list. #214 covers collapsing that copy into a check derived from the source.
- Removals: none.
- Orphans: `DR_TABLE` has no production reader. The whole bundle is a candidate for removal if no migration is planned.
- Bounds: none.
- Current behavior: confirmed for two of the three names. The claim about `chainRootOf` and the pin's path are out of date.

### Refactor
(a) Deleting `DR_TABLE` and its pin would replace the work, since no consumer reads it. That is a product choice. (b) #214's check derived from the source could come first and make the pin automatic. (c) Once #214 lands, a naming rule (the `_` prefix for private functions) lets the check cover `DR_TABLE`, `DR_NUMBER`, and `DR_SIMPLIFY` alike.

### Effort
S: two names in two lists, or a comment edit.

### Urgency
P3: the stale comment misleads readers only. No user sees a difference, nothing is at risk, and no work is blocked.

## #389 — [follow-up] the load-time scan's grid pass calls the controller from the pillbox view

**Summary:** #389 · [follow-up] the load-time scan's grid pass calls the controller from the pillbox view · update then keep · S · P3

### Can it be closed
No. On `main`, `injectTableToggles` in `chrome-extension/ui-toggle.js` (line 384) calls `consumeNominations` in `chrome-extension/content.js` (line 358). No merged pull request changes this. The design doc's Patterns table (`docs/design.md`, line 242) still routes views to the controller through intent topics alone. The scan in `tests/source-checks.js` (`toggleSplit_viewCallsNoControllerFunctionDirectly`) misses the call because its forbidden list holds only three names.

### Can it be updated
Yes. The vocabulary holds. "Load-time scan", "controller", "intent topic", "pending table", and "nomination step" all match `docs/vocabulary.md`. "Consumer" is not a defined term. A rewrite should describe the controller function by its role. The rewrite should also correct four points:
- The suite calls the scan by name at eight sites: six in `tests/pillbox.js`, one in `tests/detection.js`, and one in `tests/helpers.js` (`runPass1WithTables`). `tests/source-checks.js` line 222 also asserts that `injectTableToggles` exists.
- The controller's startup code (`content.js`, lines 655 and 661) calls the view's scan, and that scan calls back into the controller. The loop runs in both directions.
- The load-time scan does the same work as `injectTogglesForAddedNode` with the document as its node. Both run a native pass and then `consumeNominations(nominateNests(...))`. This adds option (c): widen the added-node pass to accept the document, delete `injectTableToggles`, and let the controller run the whole scan.
- The rewrite should name #244 as dependent work. Its full-allowlist scan fails until this call is gone.

Urgency is low. No user-visible behavior changes.

### New capability
For the user: none.
For the developer or tester: one scan function covers both the page load and added subtrees. The view calls no controller function. #244 can build its forbidden list from every function in `content.js` with no exceptions.

### Files
- `chrome-extension/ui-toggle.js`
- `chrome-extension/content.js`
- `chrome-extension/tests/pillbox.js`
- `chrome-extension/tests/detection.js`
- `chrome-extension/tests/helpers.js`
- `chrome-extension/tests/source-checks.js`
- `chrome-extension/tests/setup.js`
- `docs/design.md`

### Complexity
Option (c) removes one function, one duplicated native pass, one caller of `consumeNominations`, and the view-to-controller path. It adds one widened guard in `injectTogglesForAddedNode` so the function accepts a document node. Net: removes. Option (a) is neutral. Option (b) adds one documented exception.

### Simplicity
- Size: option (c) removes `injectTableToggles` and its native pass, about 12 lines. It adds one guard condition.
- Duplicates: the native pass and the nomination call appear in both scans. Merge them first.
- Removals: the separate load-time scan function and its test export in `setup.js` come out.
- Orphans: `source-checks.js` line 222 and the comment block above `injectTableToggles` lose their subject. Remove both.
- Bounds: none added. The existing data-test budget and pending re-test cap apply unchanged.
- Current behavior: the direct call reproduces on `main` at `ui-toggle.js:384`.

### Refactor
(a) The collapse in option (c) replaces the work. It is a `refactor/` pull request with no behavior change, and the existing suite proves it once the eight test sites call the added-node pass with the mocked document.

### Effort
S: one function merge plus re-pointed test call sites.

### Urgency
P3. No user impact and no correctness risk. It blocks #244's exception-free scan and leaves one design-doc rule unmet.

## #385 — [follow-up] a role-marked single-column grid becomes the active table with no registry entry on right-click

**Summary:** #385 · [follow-up] a role-marked single-column grid becomes the active table with no registry entry on right-click · update then keep · S · P3

### Can it be closed
No. The defect still happens on `main`. `findTargetTable` in `chrome-extension/lib/dr-table/detect.js` falls through to `looksLikeGrid`. That function accepts a grid role at its short-circuit after steps 1–5, and single-cell rows pass those steps. The contextmenu handler in `chrome-extension/content.js` then calls `DR_STORE.setSelectedTable` and publishes `state:tableActivated` without checking `DR_STORE.hasTable`. `createToggleForTable` in `chrome-extension/ui-toggle.js` returns at `isDataTable`, so `registerTable` never runs. The AC3 fall-through test in `chrome-extension/tests/detection.js` asserts that the probe resolves this nest. No closed issue or merged pull request fixes it.

### Can it be updated
The vocabulary is current. "Role-marked" should read "carrying a grid or table role". The issue's definition of the geometry probe should match docs/vocabulary.md: five or more repeated rows, a grid or flex layout, a numeric cell, and aligned first-column widths.

A rewrite should state three more facts:
- The same gap reaches an unmarked single-column flex grid, because the probe accepts that shape too.
- It reaches a native table that fails the data test, because resolution step 1 returns any enclosing native table.
- The marker class stays on an element that never registers.

The rewrite should recommend path (b): a table becomes active only when the registry holds it. That one check covers both table kinds and every resolution route.

### New capability
For the user: a right-click on a table that fails the data test leaves the active table unchanged, so the menu toggle and the sidebar act only on tables with a pillbox. For the developer or tester: one invariant to test, "the active table is always registered."

### Files
- `chrome-extension/content.js` (contextmenu handler, `markAndToggleIfNewGrid`, `intent:menuClicked`)
- `chrome-extension/ui-toggle.js` (`createToggleForTable`)
- `chrome-extension/lib/dr-table/detect.js` (`looksLikeGrid`, `findTargetTable`)
- `chrome-extension/tests/detection.js`, `chrome-extension/tests/pillbox.js`

### Complexity
Path (b) adds one guard (`hasTable` before activation). It removes one state: an active table with no registry entry. Moving the marker-class write behind registration also removes a marked element that has no entry. Path (a) adds a special case inside the probe and covers role-carrying grids alone. Net: removes.

### Simplicity
- Size: about five lines added in `content.js` and no lines removed. The code has one fewer reachable state.
- Duplicates: the contextmenu and `intent:menuClicked` handlers both run `findTargetTable` then `markAndToggleIfNewGrid`. One shared helper is a candidate to merge first.
- Removals: path (b) needs no new setting or field.
- Orphans: the marker class on an unregistered element has no reader. Write it only after registration.
- Bounds: nothing unbounded.
- Current behavior: every claim in the issue matches the code. The issue omits the native-table and unmarked-grid cases.

### Refactor
(b) precede: merge the two handlers' resolve, mark, and build sequence into one controller function that returns a table only when the registry holds it. The activation guard then sits in one place and covers the menu path too. (c) improve: move `classList.add('dr-ext-grid')` into the registration step so the marker and the registry entry cannot disagree.

### Effort
S: one guard and one moved line in the controller, plus updated expectations in the AC3 and table-activation tests.

### Urgency
P3: no live report shows the shape, and the impact is a menu toggle or sidebar bound to an inert table. The correctness risk is low, and no other work depends on this fix.

## #388 — [follow-up] a right-click registration leaves a pending table's watch standing until the page next changes

**Summary:** #388 · [follow-up] a right-click registration leaves a pending table's watch standing until the page next changes · update then keep · S · P3

### Can it be closed
No. #384 and #386 are merged, and the defect remains on main. The `contextmenu` handler and the `intent:menuClicked` subscriber in `chrome-extension/content.js` both register through `markAndToggleIfNewGrid`. That function calls `createToggleForTable` and never calls `dropPendingTable`. The comment above `consumeNomination` and the test `pendingRetest_aRegisteredRetestEndsThePendingRecord` in `tests/messaging-model.js` both describe the gap as accepted behavior. The observer stays idle only when the nest starts to pass the data test with no childList or characterData change. One example is a page that adds `role="row"` to rows that already exist. After any other change, a re-test that is already scheduled finds the nest registered and drops the pending table.

### Can it be updated
Yes. The sprint context ("once both merge", "sibling branches") is out of date. Vocabulary fixes:
- "Pending record": `record` is a retired synonym of settings record. Say "the pending table's observer, timer, and count", or "ends the pending table".
- "Live scans": say "the load-time scan and the added-node pass".
- "Consumer" and "nest" have no vocabulary row. Either define them or name `consumeNomination`.
- "Reports the outcome": `report` is a retired synonym of publish. Say "returns the outcome".

A rewrite should say this: the two right-click routes register without ending the pending table of the element's chain root. The observer stays until the subtree changes, and in the rare case where nothing changes it stays until the page unloads. The fix drops the pending table when a right-click registers. Routing through `consumeNomination` needs `findTargetTable` to return a nomination outcome, and the geometry-probe step has no such outcome. A direct drop in the shared registration helper is the smaller fix.

### New capability
For the user: none visible. One fewer idle observer.
For the developer or tester: one rule holds on every route, that a registration ends its nest's pending table. There is also one test for it.

### Files
- `chrome-extension/content.js`: `markAndToggleIfNewGrid`, `consumeNomination`, and the fingerprint-mismatch registration loop
- `chrome-extension/lib/dr-table/detect.js`: `chainRootOf`
- `chrome-extension/tests/messaging-model.js`

### Complexity
The fix adds one call and removes one special case: a registration that leaves a pending table standing. It also removes the stale comment in `consumeNomination`. Net: removes.

### Simplicity
- Size: adds one line, `dropPendingTable(chainRootOf(handle))`, and one test. Removes a comment paragraph.
- Duplicates: "mark the grid and build its pillbox" is written three times: `consumeNomination` for `'selected'`, `markAndToggleIfNewGrid`, and the fingerprint-mismatch loop.
- Removals: nothing added can come out.
- Orphans: none. The existing adversarial test becomes a test of the re-test path alone and needs its comment reworded.
- Bounds: none new. The existing re-test cap of 100 still applies.
- Current behavior: confirmed from the code. The full suite passes (3638 checks), and no test checks that a right-click drops the pending table.

### Refactor
(b) precede it. Merge the three registration sites into one `registerGrid(handle)` that adds `dr-ext-grid`, calls `createToggleForTable`, and drops the pending table for `chainRootOf(handle)`. Do this in a `refactor/` pull request. The fix then lives in one place and reaches every route, the mismatch path included.

### Effort
S: a one-line fix, or a small helper merge, plus one test.

### Urgency
P3. The cost is bounded memory, with no wrong output, and the trigger is rare. Nothing else is blocked.

## #394 — [follow-up] A grid registered through the geometry probe loses its entry and pillbox on a shape change, with a right-click as the only route back

**Summary:** #394 · A grid registered through the geometry probe loses its entry and pillbox on a shape change · update then keep · S · P2

### Can it be closed
No. The defect is still present on main. In `revalidateTableShape` (`chrome-extension/content.js`), a grid's root is `chainRootOf(table) || table`. For an unmarked grid, `chainRootOf` returns null. A test in `tests/detection.js` covers this: "a role-less tree returns null". `findTables(table)` then returns nothing, because the grid holds no native table and no qualifying element. The function takes the "no table registered after the shape change" branch. No merged pull request after #392 changes this path.

### Can it be updated
Yes. The issue lists only the pillbox press. Two more callers reach the same branch: the menu toggle, and the re-apply observer in `runReapplyPass`. On a simplified unmarked grid, a page refill therefore removes the pillbox with no press at all. A rewrite should name all three entry points.

Vocabulary: "role marks" should become "grid or table role". "Nomination step", "chain root", "nest", "geometry probe", "registry", "shape fingerprint" and "data test" match docs/vocabulary.md. "Registry entry" is fine as a phrase. The rewrite should drop the historical comparison with the behavior before the shape check.

Solution options: Path A registers the discarded element itself again when the nomination step registers nothing. The data test still gates the registration. Path B keeps the loss and documents the right-click recovery in docs/design.md. Path A makes an unmarked grid behave like a native table, which already registers itself again through pass 1 of `findTables`. "Table kinds behave alike" therefore favors Path A.

### New capability
For the user: an unmarked grid keeps its pillbox and simplifies again after the page changes its result set.
For the developer or tester: a test for the mismatch path on an unmarked grid, covering both the press and the re-apply observer.

### Files
- `chrome-extension/content.js` (`revalidateTableShape`)
- `chrome-extension/lib/dr-table/detect.js` (`findTables`, `chainRootOf`)
- `chrome-extension/tests/messaging-model.js`
- `docs/design.md`

### Complexity
Path A adds one fallback path in `revalidateTableShape`. It removes one special case: the unmarked grid no longer loses its entry for good. Net: neutral.

### Simplicity
- Size: about one branch and one test are added. Nothing is removed.
- Duplicates: the per-handle marking and registration loop in `revalidateTableShape` duplicates the loop in `markAndToggleIfNewGrid`.
- Removals: the fallback cannot come out without losing the requirement.
- Orphans: none.
- Bounds: none added. The data test keeps its budget of 1000 cell reads.
- Current behavior: the issue's account matches the code. The press, the menu toggle and the observer all reach the empty branch.

### Refactor
(c) Build the fallback into the candidate list: use the handles from `findTables(root)`, and use `[table]` when that list is empty. One loop then covers a native table, a marked grid and an unmarked grid. The loop can reuse `markAndToggleIfNewGrid` in place of its inline marking.

### Effort
S: one fallback in one function, plus one test using the existing role-less fixture.

### Urgency
P2: a silent loss of the pillbox on a narrow class of grids, reachable from a page refill without any user action. It carries no correctness risk to values and blocks no other work.

## #393 — [follow-up] No press-path test proves the fingerprint reads a simplified header cell through its original

**Summary:** #393 · [follow-up] No press-path test proves the fingerprint reads a simplified header cell through its original · update then keep · S · P3

### Can it be closed
No. The gap still exists on `main`. I ran the issue's mutant in memory: `fingerprintReadOpts` in `chrome-extension/content.js` returned `{}` for the run, and all 3638 tests passed. The only test that uses the originals port is the reader-level test `shapeFingerprint_theOriginalsPortReadsPastTheExtensionsOwnWrites` in `chrome-extension/tests/detection.js`. No controller test simplifies a header row and then presses.

### Can it be updated
Yes. Two statements in the issue are now wrong:
- The issue refers to "both comparison sites". The press and the apply now share one comparison, `revalidateTableShape`, which calls `fingerprintReadOpts` at a single call site.
- The suite count is now 3638.

Vocabulary fixes:
- "original-text port" becomes "originals port".
- "first-row skip" becomes "first-row exclusion".
- "table switch" becomes "the table-switched topic".
- "shape check" becomes "the shape fingerprint comparison".
- "press path" has no entry in docs/vocabulary.md. Replace it with "a pillbox press".

A rewrite should say the following. The shape fingerprint comparison reads each header cell through the originals port, so the extension's own simplification of a header row does not count as a shape change. No press test exercises that rule. The requested test registers a grid that groups its data rows, with the header row as an outside row. It simplifies the header row, either through a range expression that covers row 1 or with the first-row exclusion off. It then presses the pillbox again and asserts three things: the entry keeps its recorded fingerprint, the entry keeps its originals, and the table-switched topic is not published. The test belongs with the `shapeFingerprint_criterion*` tests in `chrome-extension/tests/messaging-model.js`. That is Path A, one rule per test.

### New capability
For the user: none.
For the developer or tester: a failing test catches any later change that drops the originals port from the comparison. No manual test is needed because the change touches tests only.

### Files
- `chrome-extension/tests/messaging-model.js`
- `chrome-extension/content.js` (`fingerprintReadOpts`, `revalidateTableShape`)
- `chrome-extension/ui-toggle.js` (the recording site, `createToggleForTable`)

### Complexity
The change adds one test and no states, paths, options, abstractions, or special cases. Net: neutral.

### Simplicity
- **Size:** adds one test of about 30 lines, modeled on `shapeFingerprint_criterion1a_aRedrawnRowGroupKeepsTheEntry`.
- **Duplicates:** `ui-toggle.js` builds its own copy of the port lambda instead of calling `fingerprintReadOpts`.
- **Removals:** the port at the recording site reads nothing, because a table that is registering holds no originals yet.
- **Orphans:** none.
- **Bounds:** none.
- **Current behavior:** the mutant survives on `main`. The comment in `ui-toggle.js` refers to "the two comparison sites", but only one exists now.

### Refactor
(c) Before or with the test, the port could live in one place. Either the recording site calls a single shared helper, or it drops the port, since the port reads nothing at registration. Either way, the stale "two comparison sites" comment in `ui-toggle.js` gets corrected. Nothing in a refactor could replace the test itself.

### Effort
S: one test that reuses the existing helpers `runPressFixture`, `makeScrollingRowgroupGrid`, and `registerFingerprintedTable`.

### Urgency
P3. The behavior is correct today and no other work waits on this. The risk is a later regression: a grid would discard its entry on every press whenever its header row is simplified.

## #395 — [follow-up] A grid emptied at action time is discarded in place of becoming a pending table

**Summary:** #395 · A grid emptied at action time is discarded in place of becoming a pending table · update then keep · S · P2

### Can it be closed
No. On `main`, `revalidateTableShape` in `chrome-extension/content.js` still calls `findTables`. That function drops every outcome except `'selected'`, so an `'empty'` nest produces no pending table. No merged pull request or open pull request changes this code path.

### Can it be updated
Yes. The defect reaches three callers, and the issue names only the pillbox press. The other two are the sidebar apply (`applySidebarRounding`) and the re-apply observer (`runReapplyPass`). A redraw of a simplified grid can empty the grid and reach the re-apply observer with no user action. The trigger also needs the shape fingerprint to change. A grid that keeps its header row keeps its column count, so the comparison finds no mismatch.

Vocabulary fixes:
- "role-marked" becomes "qualifying element".
- The issue defines a pending table as a grid. The vocabulary defines it as a chain root whose containment chain is empty.
- "shape check" and "mismatch path" become "the shape fingerprint comparison" and "a mismatch".
- "reports" (the step returns a value and publishes nothing) becomes "returns an outcome".
- "selected" in prose risks the retired "selected table" (canonical: active). Write it as the `'selected'` outcome, in code form.
- "added-node scan" and "consumer" are not vocabulary terms. Name `injectTogglesForAddedNode` and `consumeNomination` in code form.

A rewrite should say this. A mismatch discards the entry and runs the nomination step again from the chain root. When the containment chain is empty, the chain root becomes a pending table, the same result the load-time scan gives. A native table registers directly. Path B is weaker. Right-click recovers the grid through `findTargetTable`, but no user can see the lost pillbox.

### New capability
For the user: a grid whose rows are replaced during an action or a re-apply pass gets its pillbox back when the rows arrive.
For the developer or tester: one outcome handler serves every nomination caller on grids.

### Files
- `chrome-extension/content.js`: `revalidateTableShape`, `consumeNomination`
- `chrome-extension/lib/dr-table/detect.js`: `findTables`, `nominateNest`
- `chrome-extension/tests/detection.js`
- `chrome-extension/tests/setup.js`

### Complexity
The change removes one path that reads the step's outcome. It adds a return value to `consumeNomination`, which is the registered element or null. It also moves the native-table branch into an explicit `tagName` check. The change adds no new states or settings. Net: removes.

### Simplicity
- **Size:** smaller. The `findTables` loop and its `isNew` filter go, and one `consumeNomination` call replaces them.
- **Duplicates:** the change passes through two readers of the same outcome, `consumeNomination` and the `findTables` pass 2.
- **Removals:** nothing added can come out.
- **Orphans:** none. `findTargetTable` and `index.js` still read `findTables`. The comment on line 48 of `constants.js` goes stale.
- **Bounds:** the re-test cap bounds the pending table: `pendingRetestCap` of 100, with the observer dropped at the cap.
- **Current behavior:** the code matches the issue for grids. Two corrections: the trigger needs a fingerprint change, and the re-apply observer is a second trigger.

### Refactor
(b) A `refactor/` pull request can go first. It makes `consumeNomination` return the element it registered, with no change in behavior. (c) The right-click path (`findTargetTable` through `findTables`) drops `'empty'` the same way. Routing it through `consumeNomination` afterward would leave `findTables` with no live reader.

### Effort
S: one function reroutes to an existing handler, plus one jsdom test that empties a grid, fires the check, and refills the grid.

### Urgency
P2: the window is short and the page stays correct. The pillbox stays lost until the user right-clicks, and no signal reports the loss.

## #399 — [follow-up] Link filter locates a match by substring, not by its flat-text position

**Summary:** #399 · [follow-up] Link filter locates a match by substring, not by its flat-text position · update then keep · S · P3

### Can it be closed
No. The defect reproduces on main. `filterLinkMatches` in `chrome-extension/lib/dr-table/detect.js` returned both matches for "12 items, see page " + `<a>12</a>`, so the linked 12 rounds. The fallback that keeps a number when its digits cross text pieces is still present. No merged pull request touches the filter after #108.

### Can it be updated
The problem statement holds. One claim needs a correction: on a native table, classification records each match's position in the rendered text, not in the flat text. The placement step and `flatPatches` convert that position through the layout's `toFlat`. A rewrite should say that the link filter must convert a position the same way, through `layoutPieceHolding`, and not read `match.index` directly. The filter also skips whitespace-only pieces, while the patch writer counts every piece. Path 1 stays the recommendation, with a match that no piece holds dropped (fail closed). Path 2 keeps the fail-open fallback and should be removed from the issue.

Vocabulary: no retired synonym appears. "Patch step" becomes **patch writer**. "Flat-text position" becomes **position in the flat text**. "Number scan" becomes **classification**. The issue's definition of **text piece** ("split where markup changes") should match docs/vocabulary.md ("a run of plain text with no HTML tag inside it").

### New capability
For the user: a linked number keeps its value even when the same digits appear unlinked in the same cell, on both table kinds.
For the developer or tester: the link filter and the patch writer find a number's text piece the same way, so a test fixture needs one position per match and no substring setup.

### Files
- `chrome-extension/lib/dr-table/detect.js` (`filterLinkMatches`, `layoutPieceHolding`, `applyPatches` record)
- `chrome-extension/content.js` (`finalizeExtractedDecision`, `classifyTableCell`, `cellPatches`, `writeCell`)
- `chrome-extension/tests/helpers.js` (`makeLinkCell`), `tests/detection.js`, `tests/number.js`, `tests/source-checks.js`

### Complexity
The change removes the substring search, the anchor-text fallback, the `linkFilteredIdx` field on each cell's originals, and the `staleFilteredIndices` path. A simplified cell's layout holds the original pieces and matches the live piece count, so the live piece at the same index has the same link ancestry. It adds a `layout` argument to the filter. Net verdict: removes.

### Simplicity
- Size: smaller. The substring search, the fallback, and the stored index set come out.
- Duplicates: the filter duplicates the patch writer's piece lookup. Reuse `layoutPieceHolding` instead.
- Removals: `linkFilteredIdx` and `staleFilteredIndices` come out with no loss of a requirement.
- Orphans: the `linkFilteredIdx` returns from `cellPatches` and its `writeCell` argument lose their reader. Remove them in the same change.
- Bounds: the change holds one walk over a cell's text pieces, bounded by the cell's own size.
- Current behavior: the issue's statements match the code, except the rendered-text position on native tables noted above.

### Refactor
(c) Run the link filter inside `placeDecision` or next to it, where the layout already exists, and keep the patch writer's lookup as the only piece lookup. This removes the second classification read in `finalizeExtractedDecision` and the stored copy of the filter's result.

### Effort
S. One function rewrite, one stored field removed, and the test fixtures updated.

### Urgency
P3. The defect is rare and silent, and no live page shows it. No other work is blocked. The field removal lowers the friction of the next change to extracted cells.

## #406 — [follow-up] hold the remarks preview-text keys to the mark tokens

**Summary:** #406 · [follow-up] hold the remarks preview-text keys to the mark tokens · keep as is · S · P3

### Can it be closed
No. The gap still exists on main. `CAPTURE_REMARKS_HINTS` in `chrome-extension/sidebar.js:864` is still a third copy of the mark tokens. `renderCaptureMarks` still falls back to `|| ''` (line 879). `captureGlyphCopiesMatch` in `chrome-extension/tests/sidebar.js:1710` compares only the `data-mark` buttons in `sidebar.html` with `CAPTURE_MARK_GLYPHS`. The test "the remarks preview text follows the mark" (line 1674) checks two of the preview strings and never checks a key. The keys match today (`looks-right`, `not-sure`, `looks-wrong`). No merged pull request touches this.

### Can it be updated
The issue is accurate. Its terms (mark, mark token, preview text, remarks) are canonical in docs/vocabulary.md, and it uses no retired synonym. The word "placeholder" and the phrase "hint keys" in the quoted finding are code names, not glossary terms. A rewrite needs one addition: the sidebar test harness evaluates `sidebar.js` inside a local `eval`, so `CAPTURE_REMARKS_HINTS` is not a global. The test must parse the preview-text table's keys from the source text, as the `data-mark` pin already does, or the harness must expose the table.

### New capability
For the user: none. For the developer or tester: a renamed or added mark token that misses the preview-text table fails the extension suite.

### Files
- `chrome-extension/sidebar.js` (`CAPTURE_REMARKS_HINTS`, `renderCaptureMarks`)
- `chrome-extension/lib/dr-capture/render.js` (`CAPTURE_MARK_GLYPHS`)
- `chrome-extension/tests/sidebar.js` (`captureGlyphCopiesMatch`)
- `chrome-extension/tests/setup.js` (exposes `CAPTURE_MARK_GLYPHS`)

### Complexity
The test option adds one assertion and changes no runtime state, path, or option. The alternative option removes one copy of the token list but adds a cross-file dependency from `sidebar.js` on a renderer constant. Net verdict: neutral.

### Simplicity
- Size: adds about eight test lines and no runtime code.
- Duplicates: three token lists (`sidebar.html`, `sidebar.js`, `render.js`). The pin covers two of them.
- Removals: none. The one assertion is the whole change.
- Orphans: none.
- Bounds: none. The regex runs over one fixed object literal.
- Current behavior: confirmed. A drifted key produces an empty preview text, and no test fails.

### Refactor
(c) Put the new assertion inside `captureGlyphCopiesMatch` instead of a new block, so one pin holds all three copies. A larger option is to move the preview texts into the `dr-capture` package as one mark table (token, glyph, preview text) exported through `DR_CAPTURE`. That removes the third copy but puts sidebar wording in the renderer package. It is not worth doing for this issue alone.

### Effort
S: one source-text assertion added to an existing test block.

### Urgency
P3: no user impact today and no correctness risk. It guards against a future rename. It blocks no other work and fits with the next capture change.

## #401 — [follow-up] Uncaught exceptions never reach the error state

**Summary:** #401 · [follow-up] Uncaught exceptions never reach the error state · update then keep · S · P3

### Can it be closed
No. `deliverLocally` in `chrome-extension/adapters/messaging.js` calls each subscriber with no try/catch. The responder path has no try/catch either. No content script file registers a window `error` or `unhandledrejection` listener. The only writer of the error state is the row listener in `content.js`, so a thrown exception never reaches it. PR #402 shipped the feature this issue was split from, and no later change covers the gap.

### Can it be updated
Yes. "Bus boundary" and "depth guard" are not in `docs/vocabulary.md`. A rewrite should define both there, or describe them as "the point where the event bus calls a subscriber or responder" and "the event bus's publish depth cap (`MAX_PUBLISH_DEPTH`, 20)". "Handler" should read subscriber or responder. "Menu click" should read menu toggle. "Reporting script" names nothing that exists, so a rewrite should drop it. "Extension error" and "error state" match the canon.

The rewrite should add one fact. The re-apply observer, the pending table observer, and the timers in `content.js` and `ui-toggle.js` never pass through the event bus, so neither path 1 nor path 2 covers a throw inside them. It should add a fourth path: a window `error` listener in the content script that records an error row. That listener leaves the bus unchanged and needs no depth guard exemption. Before choosing it, test whether Chrome passes an exception thrown in a `chrome.runtime.onMessage` responder to that listener. Priority stays low, because no throwing defect is known.

### New capability
For the user: a crash shows a toast. For the developer or tester: the capture holds the exception's message and stack trace.

### Files
`chrome-extension/adapters/messaging.js`, `chrome-extension/content.js`, `chrome-extension/app/store.js`, `chrome-extension/lib/dr-log/index.js`, `chrome-extension/tests/sidebar.js`, `chrome-extension/tests/messaging-model.js`, `docs/vocabulary.md`.

### Complexity
Path 1 adds a catch path, a pass-through special case for `DR_BUS:` errors, and a delivery behavior change: later subscribers run after an earlier one fails. Path 4 adds one listener and no special case. Net: adds.

### Simplicity
- Size: the code grows by one catch or one listener, about 15 lines, for the requirement that every failure reaches the error state.
- Duplicates: the depth check and its throw appear twice, in `publish()` and in the responder path of `messaging.js`.
- Removals: path 4 drops the depth guard exemption and the test change entirely.
- Orphans: none.
- Bounds: a caught throw inside the toast view's `state:errorRecorded` subscriber would record a row that publishes again. The depth cap stops it at 20. The plan should skip the catch on that topic.
- Current behavior: every statement matches `main`. The depth guard test sits in `tests/sidebar.js`.

### Refactor
(b) If path 1 is chosen, first merge the two depth checks into one helper in a `refactor/` pull request. (c) Path 4 improves the solution: it covers observers and timers, and it keeps the bus unchanged.

### Effort
S: one listener or one catch, a vocabulary entry, and two tests.

### Urgency
P3: no throwing defect is known. The change blocks no other work and carries no correctness or security risk. The only cost is tester friction when a crash occurs.

## #418 — [follow-up] The first-row exclusion skips the first data row of a table with no header row

**Summary:** #418 · [follow-up] The first-row exclusion skips the first data row of a table with no header row · update then keep · M · P2

### Can it be closed
No. The defect reproduces on `main`. `getExclusionReason` in `chrome-extension/lib/dr-number/parsing.js` returns `firstRow` on `rowIndex === 0` alone. `_hasHeaderRow` in `chrome-extension/lib/dr-table/detect.js` is private, and only `readTableFingerprint` reads it. No merged pull request changes this. PR #280 made literal row numbering the rule on purpose, so path 1 reverses a recorded product choice.

### Can it be updated
Yes. Add three facts:
- A native table never rounds a `<th>` cell (`tableDataCells`). On a native table, the exclusion therefore matters only for a first row of `<td>` cells. Under path 1, a header row written in `<td>` cells outside a head section counts as header-less. Its year titles ("2023") would then round.
- A grid that groups nothing counts as header-less, header row included. Test page section 13 expects its first row to stay under the default, so that expectation changes. Reading `role="columnheader"` cells as a header row would narrow this risk.
- Path 1 needs a product choice between these risks, so it goes to the product manager.

Vocabulary:
- "rides" fails the personification rule. Replace it with "reuses".
- "header row" has no entry in `docs/vocabulary.md`, yet the shape fingerprint entry uses it. Define it on the same branch.
- No retired synonyms appear.

### New capability
For the user: a header-less statistics box rounds its top row under the default settings.
For the developer or tester: one header-row reading serves the fingerprint and the exclusion, on both table kinds.

### Files
- `chrome-extension/lib/dr-number/parsing.js`
- `chrome-extension/lib/dr-simplify/ladder.js`
- `chrome-extension/lib/dr-table/detect.js`
- `chrome-extension/content.js` (`classifyTableCell`, `tableDataCells`)
- `docs/vocabulary.md` (literal row number, exclusion)
- `docs/test-pages/tables.html` (sections 10, 13, and a new header-less section)
- `chrome-extension/tests/ladder.js`, `chrome-extension/tests/rounding-pass.js`

### Complexity
The change adds one input to the ladder (whether the table has a header row) and one condition to the first-row exclusion. It turns `_hasHeaderRow` from a private helper into a shared reader and couples the exclusion to detection. It removes nothing. Net: adds.

### Simplicity
- Size: the code grows by one per-table flag and one condition, and both serve the requirement that the top row of a header-less table rounds.
- Duplicates: the ladder reads row position and the fingerprint reads header shape as two separate notions of "first row". Merge them into one reader.
- Removals: the fingerprint's `readsHeader` and the new flag compute the same value. Compute it once per table.
- Orphans: none.
- Bounds: nothing unbounded. The reader inspects one row.
- Current behavior: the issue matches the code. Its claim that a header on a grid that groups nothing "never enters the table" is wrong. Such a grid's header row is an orphan row and enters the table.

### Refactor
(b) Export one `hasHeaderRow(adapter, rows)` reader from `detect.js` first, in a `refactor/` pull request, with the fingerprint as its only caller. The feature then passes the reader's result into `classifyCell`. (c) Reading `role="columnheader"` cells in that reader improves both the fingerprint and the exclusion on grids.

### Effort
M: the code change is small. Picking the header rule for each table kind, updating the test page, and testing both kinds take one to three days.

### Urgency
P2: an unrounded cell beside rounded ones reads as a miss, and the sidebar switch offers a workaround. There is no correctness risk to page data, no security risk, and no other work waits on it.

## #420 — Tables inside an embedded frame

**Summary:** #420 · Tables inside an embedded frame · keep as is · M · P1

### Can it be closed
No. The defect still exists on `main`. `chrome-extension/manifest.json` declares one `content_scripts` entry with no `all_frames` key, so Chrome injects the content script into the top frame only. No code on `main` reads `frameId`. `background.js` drops `info.frameId` in `chrome.contextMenus.onClicked`. `sendToTab` in `adapters/messaging.js` calls `chrome.tabs.sendMessage(tabId, message, cb)` with no frame option. No closed issue or merged pull request covers frames.

### Can it be updated
The body already follows the AGENTS.md issue order and uses current terms: content script, pillbox, activate, registry, service worker, route, state pull, load-time scan, looks-wrong capture. It contains no retired synonyms. It needs two small corrections:
- The issue's definition of route leaves out the third carrier that `docs/vocabulary.md` lists, "neither" (the publishing context alone).
- "frame", "top frame", and "bound frame" are new concepts, and `docs/vocabulary.md` does not define them. The fix branch adds them and changes the `content script` row from one context per tab to one context per frame.

Path 2 depends on the `scripting` permission. The manifest already declares it, and no code on `main` calls `chrome.scripting` yet. Open issue #266 (re-inject content scripts into open tabs) needs the same injection call. Path 1 or path 2 is urgent. Path 3 is a stopgap.

### New capability
For the user: a table drawn inside an embedded frame, such as a claude.ai artifact or the SEC Inline XBRL Viewer, gets a pillbox and activates on right-click.
For the developer or tester: captures from pages with frames record the table, and the bus delivers each tab-routed topic to exactly one frame, so a request receives exactly one answer.

### Files
`chrome-extension/manifest.json`, `chrome-extension/background.js`, `chrome-extension/adapters/messaging.js`, `chrome-extension/content.js`, `chrome-extension/sidebar.js`, `chrome-extension/lib/dr-capture/state.js`, `docs/vocabulary.md`, `docs/design.md`, `chrome-extension/README.md`, `docs/test-pages/tables.html` (the fix needs a new section with a table inside a frame).

### Complexity
Paths 1 and 2 add one state (the bound frame beside the bound tab), one routing input (the frame number on each tab-routed send), and one capture field. Path 2 also adds an injection path in the service worker, and the pillbox view gains a first-gesture special case. Path 3 adds nothing. Net verdict: adds.

### Simplicity
- Size: The code grows by a frame number through the bus, the service worker, and the capture state. The frame requirement needs each addition.
- Duplicates: `sendToTab` is the only tab carrier, so frame routing lands in one place.
- Removals: path 1 needs no injection code. Path 2 needs no manifest change.
- Orphans: none. Path 2 gives the unused `scripting` permission its first caller.
- Bounds: path 1 runs a load-time scan in every frame, advertising frames included, with no cap. The plan needs a cap on frame size or depth, or the plan uses path 2.
- Current behavior: confirmed on `main`. The manifest has no `all_frames` key, and no send carries a frame number.

### Refactor
(b) First, make `sendToTab` take a target of tab plus optional frame. Ship that change with no behavior change before either fix. (c) Build the single injection helper that path 2 and #266 both need.

### Effort
M. The routing change is small, and the bound-frame design and the capture record add one to two days.

### Urgency
P1. Two of the three latest looks-wrong captures come from this cause. The SEC viewer is a core use of the extension. The failure shows no message to the user.

## #428 — [follow-up] A unit number with a space after its currency sign stays unchanged

**Summary:** #428 · [follow-up] A unit number with a space after its currency sign stays unchanged · update then keep · S · P3

### Can it be closed
No. The defect reproduces on main. `matchUnitNumber("$ 4.91tn")` and `matchUnitNumber("€ 12m")` return null, and `matchUnitNumber("$4.91tn")` returns a match. `toNumber("$ 4.91")` returns 4.91. `toNumber("$ 4.91tn")` returns null. `UNIT_NUMBER_RE` in `chrome-extension/lib/dr-number/parsing.js` puts ` ?` after the code alternative only. The lone `SIGN_GROUP` alternative has no optional space. No closed issue or merged pull request covers this gap.

### Can it be updated
Yes, to fix the vocabulary. The mechanism and the options are correct.
- "HTML table" becomes "native table".
- "symbol" and "sign" become "currency sign".
- "number reader" becomes "number parser" (`toNumber`).
- "table kind", "unit number", "pure cell", "extracted cell", and "words setting" match `docs/vocabulary.md`.

None of these words is on the retired-synonym list. A rewrite should say:
- A unit number with one space between a lone currency sign and the number matches no shape, so it stays unchanged on both table kinds when the "words" setting is off.
- The same text with a currency code, as in "CAD 45.67" or "CAD$ 4.91", already allows that space.
- Option 1 allows one optional space after a lone currency sign. Option 2 leaves the behavior as it is.
- Recommend option 1.
- "$ CAD 4.91" fails too. A sign, then a space, then a code is a separate shape and stays out of scope.

### New capability
For the user: "$ 4.91tn" and "€ 12m" round on native tables and grids alike, whatever the "words" setting holds.
For the developer or tester: the unit-number shape states one spacing rule for every prefix.

### Files
- `chrome-extension/lib/dr-number/parsing.js` (`UNIT_NUMBER_RE` and its comment)
- `chrome-extension/tests/number.js` (the `matchUnitNumber_shapes` test)
- `chrome-extension/lib/dr-simplify/ladder.js` and `chrome-extension/lib/dr-table/detect.js` (callers, no change)
- `docs/vocabulary.md` (the unit number entry, one example)

### Complexity
The change adds one optional space to the prefix and no new state, path, setting, or abstraction. It removes the special case where a lone currency sign takes no space. Net: neutral.

### Simplicity
- Size: one regex token and one comment clause change. Two test cases are added.
- Duplicates: the two prefix alternatives both end before the number, so they can share one trailing ` ?`.
- Removals: nothing added can come out.
- Orphans: none.
- Bounds: the change adds no walk, wait, retry, count, or queue.
- Current behavior: the issue's claims match main, and the node run above reproduces the defect.

### Refactor
Option (c): collapse the prefix to `(?:SIGN_GROUP?(?<codeBefore>…)SIGN_GROUP?|SIGN_GROUP) ?`, so one space rule covers both alternatives. The fix is this collapse. A separate refactor pull request is not needed.

### Effort
S. The fix is one regex edit, a comment edit, and unit tests. `formatRoundedValue` already puts back the space after a currency sign.

### Urgency
P3. The gap shows only with one spacing and damages no page content. No other work depends on it.

## #445 — [follow-up] A bracketed negative carrying a unit loses its sign

**Summary:** #445 · [follow-up] A bracketed negative carrying a unit loses its sign · update then keep · S · P3

### Can it be closed
No. The defect reproduces on main. With the words setting off, `classifyCell` skips "(1.2m)", "(1,234 USD)", "(CAD 1,234)" and "($1.2m)" with `mixed-disabled`. With it on, it returns an extracted match whose `num` is positive. No merged pull request covers this, and #444 left it as it was. #428 is related because it also edits `UNIT_NUMBER_RE`, but it describes a different gap.

### Can it be updated
Yes. Two claims are wrong. The sign does not change the max magnitude, because `findMaxMagnitude` and the lens preview buckets both use `Math.abs`. It also does not change the rounded figure, because `roundWithOffset` gives the same result for either sign. The real effects are two. With the words setting off, these cells stay unchanged, which breaks the vocabulary rule that a unit number rounds whatever the words setting holds. The lens preview example shows the value as a positive. A rewrite should give these two effects and the options: (1) let `matchBracketedNumber` accept a unit number inside the bracket pair and apply the sign there; (2) add currency codes and suffixes to the characters the bracket test steps over; (3) document the gap. Option 2 either widens `FORMAT_MARK_ALTERNATION`, which turns "1,234 USD" into a pure cell through `CLEAN_REGEX`, or it needs a second list, which breaks the vocabulary's one-list rule for format marks. The recommendation is option 1. On vocabulary: "stays raw" should read "stays unchanged" ("raw values" is a retired synonym of "originals"). "Table's shared scale" should read "max magnitude". "Bracket test" and "unit-number test" should read "bracketed number" and "unit number". "Behaviour" should read "behavior".

### New capability
For the user: an accounting-form amount with a suffix or currency code rounds with the words setting off, and the lens preview shows it as negative. For the developer or tester: one bracket rule covers both plain numbers and unit numbers, and `tests/number.js` and `tests/ladder.js` hold cases for the bracketed unit forms.

### Files
- chrome-extension/lib/dr-number/parsing.js (`matchBracketedNumber`, `matchUnitNumber`, `bracketSignSpan`)
- chrome-extension/lib/dr-simplify/ladder.js (`classifyCell`)
- chrome-extension/lib/dr-table/detect.js (`stackedMatches`)
- docs/vocabulary.md (bracketed number, unit number)
- chrome-extension/tests/number.js, chrome-extension/tests/ladder.js

### Complexity
Option 1 adds one branch in `matchBracketedNumber` that hands the text inside the brackets to `matchUnitNumber`. It removes one special case: a unit number that depends on the words setting. It adds no setting, state, or abstraction. Net: neutral.

### Simplicity
- Size: adds about ten lines plus tests and removes none.
- Duplicates: the new branch reuses `bracketSignSpan`, `FORMAT_MARKS_ONLY_RE` and `UNIT_NUMBER_RE`. #428 edits the same regex.
- Removals: nothing new to remove. Option 1 avoids option 2's second list.
- Orphans: none.
- Bounds: nothing unbounded. Each call runs one regex on one cell's text.
- Current behavior: the skip and the positive sign reproduce. The claims about the max magnitude and the table's scale do not match the code.

### Refactor
(c) Make `matchBracketedNumber` call `matchUnitNumber` on the text inside the bracket pair, so one bracket rule covers both shapes and `classifyCell` keeps one bracketed branch. Doing #428 in the same pull request or just before it keeps the `UNIT_NUMBER_RE` edits together.

### Effort
S: one parser branch, tests, and two vocabulary entries.

### Urgency
P3. The words setting is on by default, so the page shows correct figures. The defect is the unchanged cells with the setting off and a wrong sign in the lens preview example. Nothing is blocked on it.

## #459 — [follow-up] A partly rounded cell leaves no debug row

**Summary:** #459 · [follow-up] A partly rounded cell leaves no debug row · update then keep · S · P3

### Can it be closed
No. The defect still exists on main. `writeTableCells` in `chrome-extension/content.js` (lines 1353–1354) counts a cell in `landedCells` when any of its patches lands, and in `missedCells` only when none lands. A cell where some patches land and others miss increments `landedCells`, and `unroundedCellsRow` never counts it. `applyPatches` in `chrome-extension/lib/dr-table/detect.js` returns the landed count, so `writeTableCells` already holds the number needed to detect a partial landing (`landed < flat.length`). No closed issue or merged pull request addresses it.

### Can it be updated
Yes. The problem statement is accurate. The line reference moved to `content.js:1353-1354`.
- Vocabulary: "patch", "native table", "grid", "extracted cell", "log buffer", and "capture" match docs/vocabulary.md. "Debug row" has no vocabulary entry. Define it as a debug-level log row, or use "debug log row". "The extension's log" is the "log buffer". "Raises nothing on screen" means "raises no toast". "Half-rounded" is not a vocabulary term, so say "partly rounded cell" throughout.
- A rewrite should say this: the first simplification writes one debug row that counts the cells where no patch landed. A cell where only some patches landed goes uncounted, so a capture of that cell carries no trace. Recommend path 1: one row that counts the missed cells and the partly rounded cells. Path 2 adds an uncapped number of rows to a log buffer that holds 50, and those rows push out other rows.
- Urgency stays low.

### New capability
For the user: none visible. For the developer or tester: a capture of a partly rounded cell shows that a patch missed, so the defect can be diagnosed without a manual reproduction.

### Files
- `chrome-extension/content.js` (`writeTableCells`, `simplifyTableCells`, `unroundedCellsRow`)
- `chrome-extension/tests/messaging-model.js` (tests matching `cells were left unrounded`)

### Complexity
Path 1 adds one counter (`partlyCells`) and one clause in the row text. It adds no state, configuration, or path. Path 2 adds one row per cell. Net: adds, slightly.

### Simplicity
- Size: adds about five lines (counter, return field, row wording) to support the partial-landing trace.
- Duplicates: none. Both table kinds use one `writeTableCells` loop and one row function.
- Removals: path 1 can leave out the cell position. The count alone is enough to prompt a capture review.
- Orphans: none. Every test regex that reads the row text must match the new wording.
- Bounds: path 1 writes one row per first simplification. Path 2 has no cap and needs one.
- Current behavior: confirmed by reading the code. The issue's statement matches main.

### Refactor
(a) No. (b) No. (c) Return one `{landed, missed, partly}` tally from `writeTableCells` in place of two separate counters. The row function then takes the tally, and the applied flag in `content.js:1530` reads the same object.

### Effort
S: one counter, one wording change, and one test with a cell whose second patch misses.

### Urgency
P3. The gap affects only diagnosis, a partly missed cell is rare, and no other work depends on it.

## #448 — [follow-up] An open-ended row merge holds its column past its own section

**Summary:** #448 · [follow-up] An open-ended row merge holds its column past its own section · update then keep · S · P3

### Can it be closed
No. On `main`, `normalizeSpan(raw, Infinity)` in `nativeCellSpans` and `gridCellSpans` maps a zero row span to `Infinity`, and `assignGridColumns` never clears that hold. A node run of the walk on a first-row cell with row span `Infinity` returns columns `[[0,1],[1,2],[1,2]]`, so every later row shifts by one. No merged pull request or closed issue covers this, and no test exercises a zero row span.

### Can it be updated
The problem, options, and priority hold. The rewrite should call the cell a merged cell with a zero row span, and state that the walk holds its grid column to the end of the table. The standards end it at the end of the head section, body section, footer section, or row group. "Section" and "open-ended cover" are not in docs/vocabulary.md. Use "head section", "body section", "footer section", and "row group", or add "section" as a defined term. "Column number" becomes "grid column", and "foot" becomes "footer section". No retired synonym appears. Add one uniform mechanism to path 1: each row carries a section key, taken from its parent element on a native table and from its enclosing row group element on a grid, and the walk clears every hold where the key changes. The browser check also covers a counted row span that reaches past its section, because the same reset clips that case too.

### New capability
For the user: a native table or grid with a zero row span in its head section rounds at the correct step. For the developer or tester: a walk fixture with section boundaries, and a test for a zero row span on both table kinds.

### Files
- chrome-extension/lib/dr-table/detect.js (`assignGridColumns`, `NativeTableAdapter.getRows`, `GridAdapter.getRows`, `GridAdapter._getRowEntries`)
- chrome-extension/tests/detection.js

### Complexity
Adds one per-row section key, one input to `assignGridColumns`, and one reset branch. Removes nothing. Net: adds, by a small amount.

### Simplicity
- Size: about 15 added lines for one requirement, which is the section-bounded hold. Nothing is removed.
- Duplicates: the native parent test `(row.parentElement || row.parentNode)` appears in `NativeTableAdapter.getRows` and `_hasHeaderRow`. Merge it first.
- Removals: none. The key replaces no existing field.
- Orphans: none left.
- Bounds: the walk holds no unbounded loop. A reset caps the hold at the section's row count.
- Current behavior: the issue's account matches the code, and the defect reproduces on `main`.

### Refactor
(b) Before the fix, a `refactor/` change extracts one row-section helper that both adapters call, and `_hasHeaderRow` and the native footer-section test use it. (c) With that helper in place, the native `isOutside` reads as "section is the footer section", so both table kinds derive `isOutside` from the same key.

### Effort
S. The walk change and the adapter keys are small. The browser confirmation and the fixtures for both table kinds fill most of the day.

### Urgency
P3. The trigger is rare and published tables use counted spans. Nothing else waits on this fix, and the fault gives a wrong step with no security exposure.

## #446 — [follow-up] The telephone test fires on a footnote marker and on a line break

**Summary:** #446 · [follow-up] The telephone test fires on a footnote marker and on a line break · update then keep · S · P3

### Can it be closed
No. Both defects reproduce on `main` when the sidebar's "words" setting is on. `classifyCell` on "(1,234)1" with a superscript range `{7,8}` returns `num: 1234`. `classifyCell` on "(1,234)\n5,678" also returns `num: 1234`. `placeDecision` keeps that result because each match sits in one text piece, so the stacked cell test never runs. With "words" off, the footnote cell skips, and the line-break cell reaches `stackedMatches`, which reads each piece alone and returns −1,234. No merged pull request touches `DIGIT_AFTER_BRACKET_RE` after #444.

### Can it be updated
Yes. "Classifier" becomes "classification ladder". "Bracket test" and "telephone test" should say "the telephone check on a bracketed number". The issue's definition of "flat text" differs from docs/vocabulary.md, which defines it as the join of text pieces. A native table classifies on rendered text, where a line break reads as a space. The rewrite should limit both defects to cells with "words" on. It should drop the claim about the shared scale: `findMaxMagnitude` and `extractPreviewSamples` take `Math.abs`, so the sign changes only the lens preview sample. The options stay the same: pass the superscript ranges into `bracketSignSpan`, or require the area-code shape (exactly three digits, no grouping) before the telephone check applies. The second option fixes both cases without new parameters.

### New capability
For the user: a footnoted or stacked bracketed number shows as a negative in the lens preview. For the developer or tester: `bracketSignSpan` matches the area-code shape `PHONE_NUMBER_PATTERN` already uses.

### Files
- chrome-extension/lib/dr-number/parsing.js (`DIGIT_AFTER_BRACKET_RE`, `bracketSignSpan`)
- chrome-extension/lib/dr-number/identifiers.js
- chrome-extension/lib/dr-simplify/ladder.js
- chrome-extension/tests/number.js
- chrome-extension/tests/ladder.js

### Complexity
Area-code option: one condition on an existing regex, with no new state or parameters. Neutral. Threading option: adds a superscript-range parameter to `extractNumbersInText`, `isBracketedNegative`, `bracketSignSpan`, and `stackedMatches`. Adds.

### Simplicity
- Size: the area-code option adds about one line to one regex.
- Duplicates: the area-code shape exists twice, in `PHONE_NUMBER_PATTERN` and in `DIGIT_AFTER_BRACKET_RE`. One shared fragment would merge them.
- Removals: the threading option adds parameters that the area-code option makes unnecessary.
- Orphans: neither option leaves code with no reader.
- Bounds: none. Each option makes one regex test per match.
- Current behavior: both defects reproduce only with "words" on. The scale claim does not match the code.

### Refactor
(b) Precede: a `refactor/` pull request can move the three-digit area-code fragment next to `PHONE_NUMBER_PATTERN` so both readers use it. (c) The fix then uses that fragment in `bracketSignSpan`.

### Effort
S: one regex change plus tests for the footnote, line-break, and "(416) 555-1234" cases.

### Urgency
P3: the page shows the right figure, the scale is unaffected, and only a lens preview sample shows the wrong sign. No other work depends on it.

## #460 — [follow-up] A simplified grid cell shows no hover text

**Summary:** #460 · [follow-up] A simplified grid cell shows no hover text · update then keep · S · P2

### Can it be closed
No. On `main`, `GRID_TABLE_PASS.hoverText` is `false` and `NATIVE_TABLE_PASS.hoverText` is `true` in `chrome-extension/content.js`. `writeCell` writes `title="Original: …"` only when the setting is `true`, and `releaseCell` removes `title` under the same condition. No closed issue or merged pull request changes this.

### Can it be updated
Yes. The vocabulary terms are correct: native table, grid, restore, originals. "Hover text" has no vocabulary entry. It needs one, and the rewrite should use it consistently. The rewrite should also report a native defect that the issue leaves out. `writeCell` overwrites any `title` the page set, and `releaseCell` removes `title` outright, so a restore on a native table deletes the page's own hover text. The cell record in `lib/dr-table/detect.js` holds no copy of it. The rewrite should state one rule for both table kinds: the pass stores the page's `title` in the cell's originals, writes hover text, and the restore puts back exactly what the page had. The code shows no forced reason for the difference between kinds. The re-apply observer watches only `childList` and `characterData`, so writing `title` triggers no pass, and a recycled grid cell becomes a rewritten cell, which `releaseCell` clears.

### New capability
For the user: hovering shows the original value on every simplified table, and a restore keeps the page's own hover text. For the developer or tester: one fewer difference between the table kinds, and a test that checks the page's `title` survives a restore.

### Files
- `chrome-extension/content.js` (`NATIVE_TABLE_PASS`, `GRID_TABLE_PASS`, `writeCell`, `releaseCell`, the kind comment block)
- `chrome-extension/lib/dr-table/detect.js` (`applyPatches` record)
- `chrome-extension/tests/rounding-pass.js`
- `docs/design.md` (line 294, list of differences between kinds)
- `docs/vocabulary.md`

### Complexity
The change removes the `hoverText` setting and the two branches that read it. It adds one stored field, the page's `title`, to the cell record. Net: removes.

### Simplicity
- Size: adds one record field and its restore, and removes one kind setting and two conditionals.
- Duplicates: none. Both kinds already share `writeCell` and `releaseCell`.
- Removals: once both values are `true`, the `hoverText` setting serves no purpose and comes out.
- Orphans: the `hoverText` documentation lines in `content.js` and `docs/design.md` have no reader after the change. Remove them.
- Bounds: none added. The work is one attribute per written cell.
- Current behavior: the grid omission holds on `main`. The loss of the page's native `title` also holds on `main`, and the issue does not state it.

### Refactor
(b) Remove the `hoverText` setting first, so both kinds follow one path. Then add the saved page `title` to the cell record. Together these (c) fix the native restore defect.

### Effort
S: one setting removed, one record field, two tests.

### Urgency
P2: users see the difference on every simplified grid, and a restore deletes the page's own native `title`. It creates no security risk and blocks no other work.

## #462 — [follow-up] The first simplification has no cell cap

**Summary:** #462 · [follow-up] The first simplification has no cell cap · update then keep · S · P3

### Can it be closed
No. `roundTable` in `chrome-extension/content.js` calls `simplifyTableCells` with `writes: 'first'` and no `cellCap`. That pass reads every data cell, whatever the table's size. The vocabulary's "cell cap" row and `docs/design.md` state this limit. No document gives a reason for it, so path 3 is still open. No closed issue or merged pull request covers it.

### Can it be updated
Yes. The rewrite should make these points:
- The cell cap is the most cells one pass of the re-apply observer reads. The issue says "processes"; vocabulary.md says "reads".
- The issue names only the pillbox as the trigger. Every apply runs the same uncapped pass: the pillbox, the menu toggle, a sidebar apply, and a settings record change. Each one resets the table and simplifies it again. A user who changes a lens control on a large table pays the full cost again on each change.
- Path 1 needs little new code. The pass already accepts `cellCap` and returns `overCap`.
- Path 2 has a limit. Classification, the column post-pass, and the max magnitude need every cell before the first write, so only the patch-and-write loop can run in batches.
- "Rounds every cell" becomes "simplifies every cell". "Leave the table raw" is correct: raw is a form.
- The 211 ms figure comes from #458. It is not reproduced here.

### New capability
For the user: a press on a very large table no longer freezes the page. Under path 1, the page shows a notice explaining why nothing changed.
For the developer or tester: one cap covers every pass. That needs a new section in `docs/test-pages/tables.html` with a table above 10,000 cells.

### Files
- `chrome-extension/content.js` (`roundTable`, `simplifyTableCells`, `watchTable`, `logAboveCellCap`)
- `chrome-extension/constants.js` (`reapplyCellCap`)
- sidebar notice files, for path 1's product choice
- `docs/design.md`, `docs/vocabulary.md`, `docs/test-pages/tables.html`

### Complexity
- Path 1 adds one outcome: a table above the cap stays raw, with a notice. It removes the separate cap check in `watchTable`. Net: neutral.
- Path 2 adds an in-progress state, asynchronous writes, and races with a press, a restore, and the observer attach. Net: adds.
- Path 3 changes no code. Net: neutral.

### Simplicity
- **Size:** Path 1 adds one argument and a notice, and removes one check. Path 2 grows the code.
- **Duplicates:** `watchTable` and `simplifyTableCells` each compare the cell count with `reapplyCellCap`.
- **Removals:** Path 1 can reuse `reapplyCellCap`, so it needs no second setting.
- **Orphans:** Under path 1, the cap branch in `watchTable` loses its purpose and goes in the same change.
- **Bounds:** The first pass, `resetTable`, and `restoreTable` read every marked cell. With the first pass capped, marked cells never exceed the cap.
- **Current behavior:** The first pass is uncapped on `main`, and every apply runs it again.

### Refactor
(b) and (c). First, a `refactor/` change: `roundTable` reads `overCap` from the first pass, and the `watchTable` count check goes. Path 1 then becomes one argument plus the product notice.

### Effort
S. The cap mechanism exists, and only the notice needs a product decision.

### Urgency
P3. Tables above 10,000 cells are rare on the target pages. The cost is a delay, with no wrong values and no security risk. No other work depends on it.

## #468 — Split the extension test file into pieces joined before each run

**Summary:** #468 · Split the extension test file into pieces joined before each run · close · S · P3

### Can it be closed
Yes. Steps 1 and 2 are merged. Pull request #469 cut the file into pieces. A second pull request moved every helper function into `chrome-extension/tests/helpers.js`, and #477 regrouped the sections by area. `chrome-extension/tests.js` now holds a 92-line runner with one order list (`PIECES`). The runner stops with an error on an empty list, a duplicate entry, an unlisted piece, or a missing piece. It maps crash lines back to pieces and passes the joined text as `SUITE_SOURCE` to the checks that scan the suite's own text. Twelve pieces live in `chrome-extension/tests/`. `fireMouseClick` has one definition, at `helpers.js:2023`. `CONTRIBUTING.md:82` states where a new test goes. The capture renderer comment at `lib/dr-capture/render.js:28` points at `tests/capture-log.js`. On main the suite passes 3,638 checks with 0 failures. Step 3 is optional, and the issue plans it as separate issues. No such issue exists.

### Can it be updated
No update is needed. Close the issue with a comment that links #469 and #477. The issue's own terms map to canonical ones: "pieces" is **test piece**, "join" is **joined suite**, and "order list" is **order list**. "Shared setup" and "helper" are the contents of `setup.js` and `helpers.js`. The issue uses no retired synonym. If step 3 is still wanted, file it as a new issue: make each test piece pass when run alone by removing the state one piece leaves for the next, e.g. registry entries and the pillbox highlight-style mark that #477 found.

### New capability
For the user: none. The change alters no extension behavior.
For the developer or tester: tests sit in one test piece per area and helpers sit in one piece. The runner reports a crash by piece and line. Parallel branches collide less often.

### Files
`chrome-extension/tests.js`, `chrome-extension/tests/*.js`, `CONTRIBUTING.md`, `chrome-extension/lib/dr-capture/render.js`.

### Complexity
Delivered: the change adds one abstraction (the order list and runner) and one path (the crash-line mapping). It removes the duplicate helper. Closing the issue adds nothing. Net: neutral.

### Simplicity
- Size: closing changes no code. The runner is 92 lines, near the planned 40 plus comments.
- Duplicates: the duplicate `fireMouseClick` was removed and no duplicate remains.
- Removals: none. Each runner guard implements a stated requirement.
- Orphans: none. The render comment and `CONTRIBUTING.md` point at the pieces.
- Bounds: the runner reads one folder, bounded by the order list.
- Current behavior: the issue's description of one 28,000-line file no longer matches main.

### Refactor
(a) None needed, because the work is done. (b) Not applicable. (c) Step 3 could let one piece run alone. It needs its own issue, because the value record showed that pieces depend on run order.

### Effort
S: closing the issue and, optionally, filing step 3 as a new issue.

### Urgency
P3. The work shipped, nothing is blocked, and the open issue only clutters the backlog.

## #464 — [follow-up] The Sheets and Python libraries round a phone number written with spaces

**Summary:** #464 · [follow-up] The Sheets and Python libraries round a phone number written with spaces · update then keep · S · P3

### Can it be closed
No. The defect reproduces on main. `toNumber("416 555 1234")` in `js/round_dynamic.js` returns 4165551234, and `ROUND_DYNAMIC` returns 4000000000. `_parse_number` in `python/dynamic_rounding/pandas.py` returns 4165551234.0. Both `CLEAN_REGEX` patterns contain `\s`. No merged pull request changes either parser. PR #466 is closed and did not change them.

### Can it be updated
The rewrite should use these vocabulary terms. "Identifier shape" is canonical. The vocabulary defines the shape as digit groups split by whitespace, where the issue says spaces. "Number cleaning" has no vocabulary entry, so the rewrite should describe the step directly. For the unchanged result, the canonical term is "pass-through". The vocabulary calls the products "the Sheets function" and "the Python function".

A rewrite should say:
- Both functions strip all whitespace before parsing, so a whole cell of whitespace-split digit groups outside thousands grouping parses as one number.
- Option 1 applies the extension's thousands-grouping test, `GROUPED_DIGITS_QUANTITY_RE` in `chrome-extension/lib/dr-number/identifiers.js`, after currency and percent removal. Any other whitespace between digits becomes pass-through.
- Option 2 documents the current behavior. `js/README.md` line 91 already documents "1 200" reading as 1200.
- The rewrite should also name one constraint. The shared case table (`js/round-dynamic-cases.json`) runs through the extension's `toNumber` in `core.js`, which also strips whitespace. A shared case for "416 555 1234" fails there unless the extension's `toNumber` gets the same rule.

### New capability
For the user: a phone number column stays as written in Sheets and pandas, which matches the extension.
For the developer or tester: shared cases that cover spaced identifiers and thousands grouping, run across all three copies.

### Files
- js/round_dynamic.js (`CLEAN_REGEX`, `toNumber`)
- python/dynamic_rounding/pandas.py (`CLEAN_REGEX`, `_parse_number`)
- chrome-extension/lib/dr-number/core.js (`toNumber`)
- chrome-extension/lib/dr-number/identifiers.js
- js/round-dynamic-cases.json, js/README.md, python/README.md

### Complexity
Option 1 adds one regex and one branch to each parser, which is one new special case, and adds no configuration. Option 2 adds nothing. Net verdict: adds (small).

### Simplicity
- Size: Option 1 adds about four lines per parser, and each line implements identifier-shape parity.
- Duplicates: three `toNumber` copies and three `CLEAN_REGEX` copies. The rule enters all three together.
- Removals: none of the additions can come out without losing the requirement.
- Orphans: none.
- Bounds: the regexes are anchored and linear, and no walk, wait, or retry is involved.
- Current behavior: the issue's claims match main. The libraries read whole cells only, and "416-555-1234" already parses to null.

### Refactor
(b) Precede the work: move the thousands-grouping test into `toNumber` in `core.js` first, in a `refactor/` pull request, so all three `toNumber` copies can take one rule and the shared case table can prove it. (c) After that move, the whole-cell branch of `isGroupedDigitIdentifier` may duplicate the parser's rule. Review it for collapse.

### Effort
S: one regex per parser, a few shared cases, and two README lines.

### Urgency
P3: user impact is low, the change carries no security risk, blocks no other work, and a user applies the rounding only to cells chosen on purpose.
