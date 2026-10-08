# Comment refactor: proposed diff (2026-10-08)

Status: working record for the comment refactor on branch `refactor/comment-cleanup`. It is deleted before the pull request opens.

Related issues: #338 (comments record history and design reasoning), #367 (the data-test block header states a retired rule), #375 (three comments describe the retired ARIA pass; the test page part is covered here).

## Scope

Every comment in every tracked code and configuration file: JavaScript, Python, shell, YAML, TOML, `.gitignore`, the pre-commit hook, and the comments inside the HTML pages.

Excluded, per the request: linter and tooling directives, shebangs, docstrings and JSDoc (`/** ... */` blocks and their continuation lines), license headers, lockfiles, and vendored code.

## Method

- Production source (`chrome-extension/` outside `tests/`, `js/round_dynamic.js`, `python/dynamic_rounding/`, `scripts/`, workflows, `.gitignore`): every comment read in full against the code beside it.
- Test suites (`chrome-extension/tests/`, `js/tests.js`, `python/tests/`): every comment matching a history, vocabulary, or style marker (issue numbers, sprint names, "used to", "now", "no longer", "old", "before the fix", retired synonyms, contractions) read in context and rewritten or kept.
- `docs/slider-choices.html` and `docs/toggle-choices.html` are point-in-time design mockups whose comments name the variants on the page. They are historical records and stay as written.

## Rules applied

1. History out: sprint names, issue and commit references used as provenance, "used to", "before the fix", "now", retired designs and field names. A reference to an open product decision stays (#382, #491).
2. Restatement out where a comment only repeats the line below it; kept where it marks a section or a non-obvious step.
3. A comment that guards against a past defect keeps the guard, stated in the present or conditional tense.
4. Accuracy fixes where a comment no longer matches the code (examples: `content.js` named constants it never uses; `rounding.js` said "significant digits" for a decimal-place round; the sidebar's tab-switch comment sat above the wrong method; the lens preview sample count; the version-bump step said a 4th version component drops on a patch bump alone; `setup.js` named a function that no longer exists).
5. Vocabulary: pill and toggle (the control) to pillbox, panel to sidebar, report to publish or message, selected table to active table, phantom and a11y to accessibility artifact, base to step.
6. Style: no contractions, no abbreviations outside the allowed list ("PR" and "repo" spelled out), no stance verbs for code (refuse, decide, judge, own, name).

## Out of scope: excluded comment types that carry the same defects

JSDoc blocks were excluded from this pass. Several hold history or stale facts and need the same treatment in a follow-up:

- `chrome-extension/app/store.js` file header (retired fields, sprint names, #241, #328).
- `chrome-extension/adapters/messaging.js` file header (the retired capability sniff).
- `chrome-extension/lib/dr-simplify/ladder.js` file header ("Before this file, the ladder existed as two copies").
- `chrome-extension/lib/dr-{number,table,simplify}/index.js` headers ("this sprint does not migrate any consumer").
- `chrome-extension/constants.js` header lists the service worker among its loaders (#363).
- `chrome-extension/lib/dr-table/detect.js`: the NumericProbe block ("a port of the predicate detection used before the extraction") and the `GRID_ARIA_SELECTOR` one-liner ("load-time ARIA pass", #375).
- `chrome-extension/ui-toggle.js`: the file header (names the file as the home of the detection predicates, #375) and the `flashRangePulse` block ("used to throw").
- `chrome-extension/sidebar.js`: `formatStrategyHeader`, `renderTopBand`, and `renderBotBand` blocks cite issues #1 and #3 as history.

## Proposed diff

The independent review was skipped at the product manager's direction: the reviewer model was out of usage credits. Every hunk below is applied as proposed.

### `.github/workflows/bump-version.yml`

#### H001

```diff
@@ -80,5 +80,5 @@ jobs:
           else:
               parts[2] += 1
-          # If there's a 4th component from earlier runs, drop it on patch bump.
+          # A 4th component, if present, drops on every bump.
           mf["version"] = ".".join(str(x) for x in parts[:3])
           p.write_text(json.dumps(mf, indent=2) + "\n")
```

Reviewer: none. Reconciliation: applied as proposed.

#### H002

```diff
@@ -124,12 +124,12 @@ jobs:
             --base main \
             --head "$BUMP_BRANCH")
-          # main requires the PR checks to pass, and they take a minute or two
-          # from PR creation, so wait for GitHub's merge-state verdict before
+          # main requires the pull request checks to pass, and they take a minute
+          # or two from pull request creation, so wait for GitHub's merge-state verdict before
           # merging. CLEAN, HAS_HOOKS, and UNSTABLE all mean the merge will be
           # accepted. DIRTY (a conflict) and BEHIND (main advanced past the
           # bump) are terminal, so they end the run at once. BLOCKED covers
           # pending and failed checks alike, so a failed check waits out the
-          # deadline. On timeout, leave the PR and the branch for a human, as
-          # on any other refusal.
+          # deadline. On timeout, leave the pull request and the branch for a
+          # human, as on any other failed merge.
           READY=""
           for attempt in $(seq 1 40); do
```

Reviewer: none. Reconciliation: applied as proposed.

### `.gitignore`

#### H003

```diff
@@ -24,5 +24,5 @@ docs/private/
 
 # Root-level markdown is an allowlist. Every stray that reached this repo was a
-# root .md: a scan report, a scratch design doc, a generated PR message. To add
+# root .md: a scan report, a scratch design doc, a generated pull request message. To add
 # a root document on purpose, add a negation below.
 /*.md
```

Reviewer: none. Reconciliation: applied as proposed.

#### H004

```diff
@@ -34,5 +34,5 @@ docs/private/
 
 # Agent and tool output. Reports about the local toolchain describe the
-# developer's machine, not this project, and belong nowhere near a public repo.
+# developer's machine, not this project, and belong nowhere near a public repository.
 *-baseline.md
 *_baseline.md
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/adapters/messaging.js`

#### H005

```diff
@@ -137,5 +137,5 @@ const DR_BUS = (function () {
     // The settings apply is a request rather than a one-way publish: the
     // content script writes the active table's settings and answers, and the
-    // sidebar reads whether anyone answered at all to decide bound versus
+    // sidebar reads whether anyone answered at all to determine bound versus
     // unbound. The answer's value is never read. The other three read the
     // model: the active table's settings, its preview samples, and the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H006

```diff
@@ -146,7 +146,6 @@ const DR_BUS = (function () {
     'request:captureState': { family: REQUEST, route: ROUTE_TAB },
     // The service worker's four topics. The two it publishes to a tab carry
-    // an explicit tab number: the menu-click tab and the sidebar's tab are
-    // each the worker's to name, and neither is guaranteed to be the active
-    // one at the moment of the send.
+    // an explicit tab number: neither the menu-click tab nor the sidebar's tab
+    // is guaranteed to be the active tab at the moment of the send.
     'intent:menuClicked': { family: INTENT, route: ROUTE_TAB },
     'state:sidebarOpened': { family: STATE_CHANGE, route: ROUTE_TAB },
```

Reviewer: none. Reconciliation: applied as proposed.

#### H007

```diff
@@ -157,5 +156,5 @@ const DR_BUS = (function () {
     'state:pageUnloaded': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
     'intent:updateMenuLabel': { family: INTENT, route: ROUTE_EXTENSION_PAGES },
-    // The content script's reports to the sidebar. Every one takes the
+    // The content script's topics for the sidebar. Every one takes the
     // broadcast carrier: the content script holds no tabs interface, and the
     // sidebar is an extension page.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H008

```diff
@@ -198,5 +197,5 @@ const DR_BUS = (function () {
   // worker checks against the tab the sidebar was opened for. The bus passes
   // that one number and keeps Chrome's record out of its own contract. A
-  // same-context publish reports null, and so does a message from an extension
+  // same-context publish carries null, and so does a message from an extension
   // page — neither has a tab.
   function senderTabId(sender) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H009

```diff
@@ -225,5 +224,5 @@ const DR_BUS = (function () {
   // synchronous (see the header), so that nested publish() runs on top of
   // this one's still-live stack frame. A cycle with no caller-side guard
-  // would recurse until the real call stack overflows (issue #240). This
+  // would recurse until the real call stack overflows. This
   // cap allows any legitimate shallow chain (the deepest in production, the
   // intent:selectTable -> state:selectedTableChanged hop, reaches 2; a
```

Reviewer: none. Reconciliation: applied as proposed.

#### H010

```diff
@@ -234,8 +233,4 @@ const DR_BUS = (function () {
   let publishDepth = 0;
 
-  // The route determines the carrier. Before this, publish() tested which
-  // Chrome interface existed in the publishing context and inferred the
-  // carrier from that, and a topic whose audience did not match the inference
-  // had no way to record the mismatch.
   function relay(topic, payload, route, opts) {
     const message = Object.assign({ action: topic }, payload);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H011

```diff
@@ -264,6 +259,5 @@ const DR_BUS = (function () {
   // opts.tabId where it holds one — only the service worker does, for the
   // menu-click tab and the sidebar's tab, neither guaranteed to be active.
-  // Otherwise the bus queries the active tab, which is the lookup the sidebar
-  // repeated before each of its own sends.
+  // Otherwise the bus queries the active tab.
   //
   // onReply, when given, receives the responder's answer, or undefined when
```

Reviewer: none. Reconciliation: applied as proposed.

#### H012

```diff
@@ -318,6 +312,6 @@ const DR_BUS = (function () {
     // to put one: it would send the message, the responder would answer, and
     // the answer would go nowhere, with nothing logged and nothing failed.
-    // request() and respond() each reject a topic of the wrong family already;
-    // this is the third pairing (#340).
+    // request() and respond() each reject a topic of the wrong family; this
+    // check covers publish().
     if (TOPICS[topic].family === REQUEST) {
       throw new Error('DR_BUS: publish() cannot carry a request-family topic; "' +
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/app/store.js`

#### H013

```diff
@@ -65,34 +65,13 @@ const DR_STORE = (function () {
   // --- Table registry ---
   //
-  // Before this sprint, "which tables/grids has the extension found" lived
-  // in three places at once: a WeakMap and a Set in ui-toggle.js
-  // (tableToggles, trackedTables), and the dr-ext-grid marker class read
-  // back with classList.contains/closest wherever a caller needed to know
-  // "have I already handled this element" (ui-toggle.js, content.js,
-  // lib/dr-table/detect.js's findTargetTable). Per-table rounding state
-  // (the original values a cell had before rounding, the simplified/
-  // original flag, the last-used round options, and — for virtualized grids
-  // — the frozen magnitude basis) lived on page attributes
-  // (dataset.originalValue/originalHtml/drOriginal/drSupRanges/
-  // drLinkFilteredIdx/drShowingOriginal) and in two more file-level WeakMaps
-  // in content.js (tableOptions, plus the grid observer/timer maps). This
-  // registry is the single place all of that now lives.
-  //
-  // Shape: WeakMap<table, entry>. A plain WeakMap, not a Map, is the right
-  // primitive for the entries themselves — a table removed from the page
-  // without an explicit unregisterTable() call (a bug, or a host page that
-  // detaches a node some other way) still lets its entry go instead of
-  // leaking for the life of the tab. WeakMap cannot be enumerated, and
-  // content.js's removal observer needs enumeration — it walks a removed
-  // subtree looking for tables it was tracking. (ui-toggle.js's own
-  // scroll/resize repositioning does NOT read this Set; it iterates its own
-  // trackedTables Set instead — see ui-toggle.js.) Rather than a
-  // WeakRef-based companion (which needs its own periodic sweep to reclaim
-  // dead refs, and this codebase has no such sweep loop anywhere), the
-  // enumerable companion here is a plain Set kept in exact lockstep with the
-  // WeakMap by registerTable/unregisterTable — the same two call sites that
-  // already tear down this table's other per-table resources (the re-apply
-  // observer and its timer, tableResizeObservers), so no new leak surface is
-  // introduced beyond what those call sites already had to get right.
+  // Shape: WeakMap<table, entry>. A table removed from the page without an
+  // unregisterTable() call (a host page that detaches a node some other way)
+  // still lets its entry go instead of leaking for the life of the tab. A
+  // WeakMap cannot be enumerated, and content.js's removal observer walks a
+  // removed subtree for registered tables, so a plain Set holds the same
+  // tables. registerTable and unregisterTable write both, at the call sites
+  // that tear down the table's other per-table resources (the re-apply
+  // observer and its timer, tableResizeObservers). ui-toggle.js's scroll and
+  // resize repositioning iterates its own trackedTables Set, not this one.
   const tableRegistry = new WeakMap();
   const registeredTables = new Set();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H014

```diff
@@ -110,16 +89,12 @@ const DR_STORE = (function () {
         // lib/dr-table/detect.js). The cell objects' reads, the pass's cell
         // sort, and the one piece restore (releaseCell in content.js) are
-        // the readers. A WeakMap, not a Map,
-        // for the same reason tableRegistry itself is one: nothing
-        // enumerates a table's originals (only .get/.set/.has/.delete by a
-        // specific cell), so there is no companion Set to keep in lockstep
-        // here, and a cell recycled out of the page by the host (grid
-        // virtualization, a framework re-render) lets its entry go instead
-        // of accumulating for the life of the table's registration.
+        // the readers. A WeakMap with no companion Set: nothing enumerates a
+        // table's originals, and a cell the host recycles out of the page
+        // (grid virtualization, a framework re-render) lets its entry go
+        // instead of accumulating for the life of the table's registration.
         originals: new WeakMap(),
-        // 'original' | 'simplified' — replaces dataset.drShowingOriginal.
-        // 'original' covers both "never rounded" and "rounded, currently
-        // showing originals"; isTableRounded (ui-toggle.js) is exactly
-        // appliedFlag === 'simplified'.
+        // The table's form: 'original' | 'simplified'. 'original' covers both
+        // "never rounded" and "rounded, currently showing originals";
+        // isTableRounded (ui-toggle.js) is exactly appliedFlag === 'simplified'.
         appliedFlag: 'original',
         // The table's settings: its on/off value and every simplification
```

Reviewer: none. Reconciliation: applied as proposed.

#### H015

```diff
@@ -203,5 +178,5 @@ const DR_STORE = (function () {
   //
   // One bus publish here, from setTableSettings: the sidebar draws a table's
-  // settings. Nothing in the app subscribes to "a table was found" or "a
+  // settings. Nothing in the application subscribes to "a table was found" or "a
   // cell's original changed" as an event — the DOM itself is the view for a
   // table's contents, and the view already redraws it directly
```

Reviewer: none. Reconciliation: applied as proposed.

#### H016

```diff
@@ -227,7 +202,6 @@ const DR_STORE = (function () {
   }
 
-  // hasTable: the one check every former dr-ext-grid class read or
-  // tableToggles.has() "have I already handled this element" check now
-  // goes through.
+  // hasTable: the one check for "has the extension already handled this
+  // element".
   function hasTable(table) {
     return tableRegistry.has(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H017

```diff
@@ -277,7 +251,6 @@ const DR_STORE = (function () {
   }
 
-  // Defaults to 'original' with no entry — a table never registered has
-  // never been rounded, same as isTableRounded's old "no .dr-ext-rounded
-  // cell found" default.
+  // Defaults to 'original' with no entry: a table never registered has never
+  // been rounded.
   function getTableAppliedFlag(table) {
     const entry = tableRegistry.get(table);
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/background.js`

#### H018

```diff
@@ -6,7 +6,5 @@
  */
 
-// The bus, and nothing else. The settings contract in constants.js was loaded
-// here for the shared topic-name list alone, and the bus holds the topic table
-// now; no other constant in that file reaches this context.
+// The bus alone: no constant in constants.js reaches this context.
 importScripts('adapters/messaging.js');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H019

```diff
@@ -28,6 +26,6 @@ chrome.runtime.onInstalled.addListener(() => {
 chrome.contextMenus.onClicked.addListener(async (info, tab) => {
   if (info.menuItemId === "dr-action") {
-    // The menu-click tab is the one the right-click happened in, which the
-    // bus's active-tab lookup would only find by accident. Name it.
+    // The right-click happened in the menu-click tab. The bus's active-tab
+    // lookup can return a different tab, so the publish passes the tab number.
     DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
     return;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H020

```diff
@@ -44,6 +42,6 @@ chrome.contextMenus.onClicked.addListener(async (info, tab) => {
     sidebarTabId = tab.id;
     // The item does both things its title states: the same toggle "Toggle
-    // table" sends, then the sidebar-opened report. The toggle goes first, so
-    // the sidebar's re-read on open reads the toggled settings.
+    // table" publishes, then the sidebar-opened topic. The toggle goes first,
+    // so the sidebar's re-read on open reads the toggled settings.
     DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
     DR_BUS.publish('state:sidebarOpened', {}, { tabId: tab.id });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H021

```diff
@@ -52,10 +50,6 @@ chrome.contextMenus.onClicked.addListener(async (info, tab) => {
 
 function closeSidebarIfOpen() {
-  // One leg, aimed at the sidebar page: the broadcast reaches every extension
-  // page, and the sidebar closes itself on it. A second leg used to go to the
-  // content script through its tab, so the page could clear its own copy of
-  // "the sidebar is open" — the 2026-09-14 sidebar-state-removal design
-  // retired that copy along with everything that read it (#241), and the
-  // content script has no subscriber for this topic now.
+  // The broadcast reaches every extension page, and the sidebar closes itself
+  // on it. The content script has no subscriber for this topic.
   DR_BUS.publish('intent:closeSidebar', {});
   sidebarTabId = null;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H022

```diff
@@ -97,8 +91,5 @@ DR_BUS.subscribe('state:sidebarClosed', () => {
 });
 
-// The on/off report needs no relay here. The content script's single publish
-// already reaches the sidebar, so the re-send this worker used to make was a
-// second delivery of one fact.
-//
-// The table-activation report needs no relay either. The content script
-// broadcasts it to every extension page, which is where the sidebar reads it.
+// The on/off topic and the table-activation topic need no relay here. The
+// content script broadcasts each to every extension page, so its one publish
+// reaches the sidebar.
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/constants.js`

#### H023

```diff
@@ -29,7 +29,7 @@ const DR_DEFAULTS = {
   dateGranularity: 'year',
   timeGranularity: 'hour',
-  // Concrete numeric defaults (Variant F UI always sends concrete numbers, never
-  // null/blank). num_top is no longer surfaced in the UI but stays here as the
-  // contract with content.js / the right-click toggle.
+  // Concrete numbers, never null or blank: the sidebar always sends numbers.
+  // numTop has no sidebar control; it stays here as the contract with
+  // content.js and the right-click toggle.
   offsetTop: -0.5,
   offsetOther: -0.5,
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/content.js`

#### H024

```diff
@@ -6,11 +6,7 @@
  */
 
-// Constants
-// CLEAN_REGEX, PARENS_REGEX, and VALIDATION_LIMIT live in core.js (loaded ahead of this file); they are used
-// here too via shared global scope.
-
-// EPSILON, X_FLOOR_THRESHOLD, roundWithOffset, and roundCellSetAware live in
-// rounding.js, loaded by manifest content_scripts ahead of this file. The
-// sidebar loads rounding.js separately via a script tag in sidebar.html.
+// roundWithOffset and roundCellSetAware live in rounding.js, loaded by
+// manifest content_scripts ahead of this file. The sidebar loads rounding.js
+// separately via a script tag in sidebar.html.
 
 // DR_DEFAULTS is loaded from constants.js (declared first in manifest content_scripts).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H025

```diff
@@ -22,6 +18,6 @@
 // page with a real table and — with file access enabled — Chrome injects
 // this content script into it. On such a page the controller stands down:
-// no contextmenu selection, no load-time scan, no observer, so no table in
-// a capture is ever registered, selected, or rounded. A capture must show
+// no right-click activation, no load-time scan, no observer, so no table in
+// a capture is ever registered, activated, or rounded. A capture must show
 // what was captured, never what this extension would do to it. Page rules
 // cannot enforce this (a page's Content-Security-Policy does not apply to
```

Reviewer: none. Reconciliation: applied as proposed.

#### H026

```diff
@@ -31,19 +27,10 @@ const IS_CAPTURE_PAGE = !!(typeof document !== 'undefined' && document.documentE
 
 let lastRightClickedElement = null;
-// The active table lives in DR_STORE now, not as a file-level binding here.
-// It may hold a <table> element or a div-based grid root — any element
-// carrying class dr-ext-grid or returned by findTargetTable's .handle — so
-// every caller that once assumed HTMLTableElement must tolerate any Element.
-// A second field beside it held whether the sidebar stood open until the
-// 2026-09-14 sidebar-state-removal design retired it (#241).
-// ui-toggle.js used to assign the active
-// table directly into this file's `let lastRightClickedTable`; it now
-// publishes an intent instead (see the DR_BUS.subscribe call below), and
-// every read and write in this file goes through DR_STORE's getters and
-// setters.
-
-// The controller is the sole subscriber to intent topics. ui-toggle.js
-// publishes 'intent:selectTable' instead of writing this file's variables
-// directly; this is where that intent turns into a model change.
+// The active table lives in DR_STORE. It may hold a <table> element or a
+// div-based grid root — any element carrying class dr-ext-grid or returned by
+// findTargetTable's .handle — so every caller must accept any Element.
+
+// The controller is the sole subscriber to intent topics. This is where the
+// activate intent turns into a model change.
 DR_BUS.subscribe('intent:selectTable', ({ table }) => {
   DR_STORE.setSelectedTable(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H027

```diff
@@ -67,5 +54,5 @@ function writeTableSettings(table, patch, source) {
 // the toast view (ui-toast.js) draws and the capture carries. Debug and info
 // rows stay out. The level list lives in the log module, which uses the same
-// list to decide which rows carry a stack trace. The listener lives here and
+// list to determine which rows carry a stack trace. The listener lives here and
 // not in the log module because the log module loads before the model and
 // the bus and reaches neither. A row recorded inside a bus handler publishes
```

Reviewer: none. Reconciliation: applied as proposed.

#### H028

```diff
@@ -76,10 +63,10 @@ DR_LOG.onRow((row) => {
 
 // The sidebar's settings apply: write the active table's settings and apply
-// them. The sidebar leaves the on/off value out while the #262 lock forces its
+// them. The sidebar leaves the on/off value out while the lock forces its
 // switch on, and the merge keeps the table's own value then. The shape check
 // runs before the write, so a change landing on a table the page refilled
 // writes the fresh registration, and a shape change that registers nothing
-// stops the write. With no table active nothing is written. The answer's only
-// job is to exist: the sidebar reads that someone answered and stays bound.
+// stops the write. With no table active nothing is written. The answer carries
+// no data: the sidebar reads that someone answered and stays bound.
 DR_BUS.respond('request:applySettings', ({ settings }) => {
   const active = DR_STORE.getSelectedTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H029

```diff
@@ -89,20 +76,9 @@ DR_BUS.respond('request:applySettings', ({ settings }) => {
 });
 
-// ui-toggle.js's click handler reports every committed toggle activation
+// ui-toggle.js's click handler publishes every committed toggle activation
 // (an immediate mouse/keyboard click, or the second tap of a touch/pen
-// two-tap) as this one intent. The menu toggle reports the same intent from
-// its MENU_CLICKED listener below. This is where that intent turns into one
-// controller action, and there is exactly one.
-//
-// Three branches used to live here (2026-09-14 spec, part one). The first
-// read the application model's copy of whether the sidebar stood open, to
-// determine whether a press on a different table meant "rebind the sidebar"
-// or "turn this table on", and it was the extension's only reader of that
-// value. The page could not keep the value true to the sidebar: the service
-// worker lost the tab number it needed to send the correction, both on an
-// idle restart and on an ordinary close, so a press on a second table
-// silently became a rebind for the rest of the page's life (#241). The
-// value, its model field, and its state-change topic are all gone, and this
-// path reads nothing about the sidebar.
+// two-tap) as this one intent. The menu toggle publishes the same intent from
+// its intent:menuClicked subscriber below. This is where that intent turns
+// into one controller action, and there is exactly one.
 //
 // The rules, in the order they matter:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H030

```diff
@@ -110,5 +86,5 @@ DR_BUS.respond('request:applySettings', ({ settings }) => {
 //   1. The flip direction comes from the screen BEFORE any write. The
 //      settings write below applies to the table, so a direction read
-//      afterward would read our own output: a press on a raw table would
+//      afterward would read the write's own output: a press on a raw table would
 //      simplify it, then read "simplified" and write off, and the second
 //      apply would reset it — the press would land back where it started.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H031

```diff
@@ -125,5 +101,5 @@ DR_BUS.subscribe('intent:toggleTable', ({ table: pressedTable }) => {
   // table the page has refilled therefore reads the fresh entry's raw form
   // and turns simplification on, where a read of the discarded entry would
-  // report a simplification of values no longer on the screen. The press
+  // find a simplification of values no longer on the screen. The press
   // continues on the element the check returns, which is a different element
   // where a new result set moved the registration. A shape change that
```

Reviewer: none. Reconciliation: applied as proposed.

#### H032

```diff
@@ -137,5 +113,5 @@ DR_BUS.subscribe('intent:toggleTable', ({ table: pressedTable }) => {
 
   if (!revalidated.switched && target !== DR_STORE.getSelectedTable()) {
-    // Rule 2. Reported as an intent rather than written here, so one intent
+    // Rule 2. Published as an intent rather than written here, so one intent
     // stays the single place a table becomes active even when a second
     // intent (toggle) is what triggered it. A shape change published both of
```

Reviewer: none. Reconciliation: applied as proposed.

#### H033

```diff
@@ -150,8 +126,4 @@ DR_BUS.subscribe('intent:toggleTable', ({ table: pressedTable }) => {
 });
 
-// Each table's settings, the frozen grid magnitude basis, the simplified/original flag, and every cell's pre-round
-// original now live in DR_STORE's per-table registry entry (app/store.js) —
-// not a file-level WeakMap here.
-
 // Re-apply observer state, one entry per simplified table of either kind
 // (see watchTable).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H034

```diff
@@ -182,9 +154,7 @@ const pendingRoots = new Set();
 
 
-// findTargetTable() only reports what it found; it never writes the
-// dr-ext-grid marker or builds the toggle widget. When it discovers a grid
-// root for the first time (found.isNew), this caller does both, exactly as
-// findTargetTable used to do internally before the sprint that split
-// detection into lib/dr-table.
+// findTargetTable() only returns what it found; it never writes the
+// dr-ext-grid marker or builds the pillbox. When it finds a grid root for the
+// first time (found.isNew), this caller does both.
 function markAndToggleIfNewGrid(found) {
   if (found.isNew) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H035

```diff
@@ -195,8 +165,7 @@ function markAndToggleIfNewGrid(found) {
 }
 
-// Every findTargetTable() call site passes DR_STORE.hasTable as isSeen —
-// detection stays decoupled from the model (see lib/dr-table/detect.js), but
-// the controller is exactly where "have we found this" ought to answer from
-// the registry rather than the dr-ext-grid marker class.
+// Every findTargetTable() call site passes DR_STORE.hasTable as isSeen:
+// detection stays decoupled from the model (see lib/dr-table/detect.js), and
+// the controller answers "found already" from the registry.
 document.addEventListener('contextmenu', (event) => {
   if (IS_CAPTURE_PAGE) return;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H036

```diff
@@ -212,9 +181,7 @@ document.addEventListener('contextmenu', (event) => {
 }, true);
 
-// roundTable (the simplification engine) no longer sends chrome messages
-// itself — it returns { applied, rangeStatus: 'ok'|'error', error } and
-// leaves messaging to the controller. Every call site sends the same
-// RANGE_ERROR/RANGE_OK message the engine used to send, unconditionally,
-// so observable messaging is unchanged.
+// roundTable (the simplification engine) publishes nothing itself: it returns
+// { applied, rangeStatus: 'ok'|'error', error }, and its call site publishes
+// the range status through this function.
 function sendRangeStatusMessage(result) {
   if (result.rangeStatus === 'error') {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H037

```diff
@@ -225,6 +192,6 @@ function sendRangeStatusMessage(result) {
 }
 
-// The menu item reports the same intent a pillbox press reports, so both run
-// the one controller path above (issue #275). The right-click that opened the
+// The menu item publishes the same intent a pillbox press publishes, so both
+// run the one controller path above. The right-click that opened the
 // menu already made the table active (the contextmenu handler's
 // setSelectedTable), so the press lands as an unmoved one: it flips the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H038

```diff
@@ -261,5 +228,5 @@ DR_BUS.subscribe('state:sidebarOpened', () => {
 // table active, the model answers the shipped defaults. It also answers
 // whether the active table is locked, so a sidebar that missed the one-time
-// report after an apply still shows the lock on its next read (#500).
+// notice after an apply still shows the lock on its next read.
 DR_BUS.respond('request:settings', () => {
   const selected = DR_STORE.getSelectedTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H039

```diff
@@ -270,5 +237,5 @@ DR_BUS.respond('request:settings', () => {
 });
 
-// No selected table answers nulls rather than nothing: the sidebar reads a
+// No active table answers nulls rather than nothing: the sidebar reads a
 // null samples field as the unbound state, and an unanswered request reaches
 // it as that same unbound state by a different path.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H040

```diff
@@ -299,5 +266,5 @@ function applySidebarRounding(table) {
   const unrestorableCount = resetTable(table);
   if (unrestorableCount > 0) {
-    // The refusal case: at least one cell's registry original is gone (a content-script re-injection — see
+    // The blocked case: at least one cell's registry original is gone (a content-script re-injection — see
     // restoreTable's KNOWN ACCEPTED COST doc). Running roundTable now would
     // round the already-rounded text, stamp a false "Original: ..." title
```

Reviewer: none. Reconciliation: applied as proposed.

#### H041

```diff
@@ -333,6 +300,6 @@ function applySidebarRounding(table) {
 // pillbox view (injectTableToggles) and the added-node pass below — so the
 // pending record and its clearing sit behind the step's outcome and never in
-// a caller. The step reports; this is where a report becomes a registration
-// or a watch.
+// a caller. The step returns outcomes; this is where an outcome becomes a
+// registration or a watch.
 //
 // The step's results hold grids alone: each scanner's own pass 1 covers native
```

Reviewer: none. Reconciliation: applied as proposed.

#### H042

```diff
@@ -353,6 +320,6 @@ function consumeNominations(results) {
 //   'registered' the nest already holds a registered element, so a second
 //                registration would put a second pillbox on one grid.
-// A registration through another path — right-click, once that sprint lands —
-// leaves the pending record standing until the next re-test returns
+// A registration through another path (a right-click) leaves the pending
+// record standing until the next re-test returns
 // 'registered', which drops it here.
 function consumeNomination({ chainRoot, selected, outcome }) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H043

```diff
@@ -436,11 +403,11 @@ function dropPendingTable(chainRoot) {
 }
 
-// Detect and attach toggles for tables and grids inside (or equal to) a node
-// added to the page. Pass 1 covers native <table> elements, skipping the
-// accessibility artifacts issue #128 calls out, so a dynamically rendered
+// Detect and attach pillboxes for tables and grids inside (or equal to) a node
+// added to the page. Pass 1 covers native <table> elements, skipping
+// accessibility artifacts, so a dynamically rendered
 // single-page-application grid is found and an off-screen chart fallback is
 // not. Pass 2 hands the grids to the nomination step in the detection layer
 // (nominateNests), which lists the added node itself when it carries a grid or
-// table role, walks out to the node's chain root, and reports one outcome per
+// table role, walks out to the node's chain root, and returns one outcome per
 // nest — the same step the load-time scan runs. The walk out matters here: a
 // node added inside a wrapper already in the page re-evaluates the whole nest
```

Reviewer: none. Reconciliation: applied as proposed.

#### H044

```diff
@@ -451,5 +418,5 @@ function dropPendingTable(chainRoot) {
 function injectTogglesForAddedNode(node) {
   if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
-  // Pass 1: native <table> elements; phantom a11y tables are skipped.
+  // Pass 1: native <table> elements; accessibility artifacts are skipped.
   if (node.tagName === 'TABLE' && !DR_STORE.hasTable(node) && !isPhantomA11yTable(node)) {
     createToggleForTable(node);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H045

```diff
@@ -484,5 +451,5 @@ function fingerprintReadOpts(table) {
 // result set, a different column set — so the entry describes data no longer
 // on the screen: its cell originals belong to cells that are gone, and its
-// form reports a simplification of values no one can see. The entry is
+// form records a simplification of values no longer on the screen. The entry is
 // discarded whole, and the nomination step re-runs from the nest's chain
 // root, because a new result set can change which element of the nest passes
```

Reviewer: none. Reconciliation: applied as proposed.

#### H046

```diff
@@ -537,5 +504,5 @@ function revalidateTableShape(table, opts = {}) {
   // cells, with its marker class on them. Discarding the entry first would
   // drop the originals behind that text: the fresh registration would read
-  // the simplified values as the cells' own, the apply would report every
+  // the simplified values as the cells' own, the apply would count every
   // one of them unrestorable, and the table would stand locked with no route
   // back. Restoring first puts raw text in every surviving cell, so the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H047

```diff
@@ -556,5 +523,5 @@ function revalidateTableShape(table, opts = {}) {
     createToggleForTable(handle);
     // createToggleForTable registers only what passes the data test, so the
-    // registry is what reports whether this element registered.
+    // registry records whether this element registered.
     if (!fresh && DR_STORE.hasTable(handle)) fresh = handle;
   }
```

Reviewer: none. Reconciliation: applied as proposed.

#### H048

```diff
@@ -586,5 +553,5 @@ function revalidateTableShape(table, opts = {}) {
 // A discarded active table stops being active, and the sidebar re-reads: it
 // finds no active table and shows the no-table state, where it would
-// otherwise describe an entry that is gone (#506). A shape change that
+// otherwise describe an entry that is gone. A shape change that
 // registers a fresh table makes that table active right after, and the
 // sidebar's read, which lands after this handler finishes, reads it.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H049

```diff
@@ -620,10 +587,7 @@ if (typeof MutationObserver !== 'undefined' && !IS_CAPTURE_PAGE) {
       for (const node of mutation.removedNodes) {
         if (node.nodeType !== Node.ELEMENT_NODE) continue;
-        // Find every table/grid this removed subtree contains by walking
-        // DR_STORE's registered tables (the enumerable companion to its
-        // WeakMap registry) instead of querying for the dr-ext-grid marker
-        // class — the registry is the single "have we found this" answer
-        // now, and it covers native tables too, so one loop replaces the
-        // old tagName check + two separate querySelectorAll passes.
+        // Find every registered table or grid this removed subtree contains
+        // by walking DR_STORE's registered tables (the enumerable companion
+        // to its WeakMap registry), which cover both table kinds.
         for (const table of DR_STORE.getRegisteredTables()) {
           const contained = table === node ||
```

Reviewer: none. Reconciliation: applied as proposed.

#### H050

```diff
@@ -646,5 +610,5 @@ if (typeof MutationObserver !== 'undefined' && !IS_CAPTURE_PAGE) {
   });
 
-  // Start injecting toggles
+  // Start the load-time scan
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', () => {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H051

```diff
@@ -662,13 +626,12 @@ if (typeof MutationObserver !== 'undefined' && !IS_CAPTURE_PAGE) {
 }
 
-// --- End per-table toggle switch infrastructure ---
+// --- End per-table pillbox infrastructure ---
 
 // registryOriginalsPort adapts DR_STORE's per-table registry entry to the
 // OriginalsPort interface both adapters expect (see lib/dr-table/detect.js)
-// — the one place a cell's record leaves the page (grid records used to be
-// dataset.drOriginal) and enters the application model. Every makeAdapter()
-// call below that reads or writes a simplified cell passes this, so every
-// read and every write goes through the same store. It carries the cell's
-// whole record (see applyPatches in detect.js).
+// — the one place a cell's record leaves the page and enters the application
+// model. Every makeAdapter() call below that reads or writes a simplified
+// cell passes this, so every read and every write goes through the registry.
+// It carries the cell's whole record (see applyPatches in detect.js).
 function registryOriginalsPort(table) {
   return {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H052

```diff
@@ -680,6 +643,5 @@ function registryOriginalsPort(table) {
 
 // Restore a table's simplified cells to their originals, reading from
-// DR_STORE's registry instead of page attributes (dataset.originalValue/
-// originalHtml/drOriginal used to carry this). One piece restore serves
+// DR_STORE's registry. One piece restore serves
 // both table kinds: each marked cell goes through releaseCell, which puts
 // the original text back into every text piece that still shows the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H053

```diff
@@ -697,8 +659,7 @@ function registryOriginalsPort(table) {
 //
 // KNOWN ACCEPTED COST: registry-held originals do not survive Chrome
-// re-injecting the content script, which page attributes did (a reload of
-// the content script is a fresh DR_STORE, so re-detection just rebuilds the
-// registry from the current DOM instead of resuming from stale data — the
-// sprint judged that an acceptable trade for a single restore path).
+// re-injecting the content script. A re-injected content script starts a
+// fresh DR_STORE, so re-detection rebuilds the registry from the current
+// DOM. The cost is accepted in exchange for a single restore path.
 //
 // A cell with no registry entry (the accepted-cost case above) is left
```

Reviewer: none. Reconciliation: applied as proposed.

#### H054

```diff
@@ -805,5 +766,5 @@ function decisionToLegacyInfo(decision) {
 }
 
-// --- Preview-band sample extraction (consumed by sidebar via IPC) ---
+// --- Lens preview sample extraction (read by the sidebar over request:previewSamples) ---
 
 // The lens preview's sample pool: each number the table rounds in its
```

Reviewer: none. Reconciliation: applied as proposed.

#### H055

```diff
@@ -846,11 +807,11 @@ function collectNumericCells(table, options) {
 }
 
-// Pick up to 2 large-magnitude + 3 smaller-magnitude representative samples
-// for the sidebar preview band. Bucketed by magnitude (floor(log10|num|)) so
-// the band shows the actual offset_top vs offset_other split that
-// roundCellSetAware will apply to the table.
+// Pick up to 2 top-band samples and one sample per other-band magnitude for
+// the lens preview. Bucketed by magnitude (floor(log10|num|)) so the lens
+// preview shows the offset_top and offset_other split that roundCellSetAware
+// applies to the table.
 function extractPreviewSamples(table) {
-  // The table's own settings, not shipped defaults — otherwise the preview
-  // band and the table disagree the moment the sidebar's slider or
+  // The table's own settings, not shipped defaults — otherwise the lens
+  // preview and the table disagree the moment the sidebar's slider or
   // checkboxes diverge from DR_DEFAULTS.
   const liveSettings = DR_STORE.getTableSettings(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H056

```diff
@@ -864,5 +825,5 @@ function extractPreviewSamples(table) {
 
   // Reorder a magnitude bucket so cells that visibly *change* under the band's
-  // default offset come first. Picking the raw document-order cell can land on
+  // offset come first. Picking the raw document-order cell can land on
   // an already-round value (e.g. 250,000,000 → 250,000,000), making the preview
   // row look like rounding does nothing. Array.prototype.sort is stable, so
```

Reviewer: none. Reconciliation: applied as proposed.

#### H057

```diff
@@ -1102,5 +1063,5 @@ function resolveRoundingSettings(opts) {
 //
 // A simplified cell classifies its stored original rather than the rounded
-// text now showing (issue #2), on either kind: the cell object's getText()
+// text now showing, on either kind: the cell object's getText()
 // and getPieceLayout() answer from its record. The pass and the lens
 // preview read alike. Each read below measured against that text takes the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H058

```diff
@@ -1485,6 +1446,5 @@ function roundTable(table, options) {
   const adapter = registryAdapter(table);
   const adapterRows = adapter.getRows();
-  // Clean stub path: if the adapter returns no rows (e.g. GridAdapter stub),
-  // return early without throwing.
+  // A table with no rows returns early without throwing.
   if (adapterRows.length === 0) return { applied: false, rangeStatus: 'ok' };
   const kind = tableKindPass(adapter);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H059

```diff
@@ -1499,5 +1459,5 @@ function roundTable(table, options) {
   // settings change) freezes again from its own first sight rather than
   // reusing a stale value. A cell whose patches all skipped never counts
-  // toward the form (#301, #315).
+  // toward the form.
   const { landedCells, cellCount } = simplifyTableCells(table, adapterRows, opts, {
     kind,
```

Reviewer: none. Reconciliation: applied as proposed.

#### H060

```diff
@@ -1514,6 +1474,5 @@ function roundTable(table, options) {
 }
 
-// findMaxMagnitude and toNumber (plus VALIDATION_LIMIT, CLEAN_REGEX,
-// PARENS_REGEX) live in core.js, loaded by
-// manifest content_scripts ahead of this file. The sidebar loads core.js
-// separately via a script tag in sidebar.html.
+// findMaxMagnitude lives in core.js, loaded by manifest content_scripts ahead
+// of this file. The sidebar loads core.js separately via a script tag in
+// sidebar.html.
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-capture/render.js`

#### H061

```diff
@@ -352,5 +352,5 @@ function renderBoundTable(state, lockedStatusText) {
     // The state records each cell's column but not how far a merge reaches,
     // so both renderings and the JSON place every cell in its own slot and
-    // leave the rest of a merge blank (#309's named limit).
+    // leave the rest of a merge blank.
     renderNote('Cell spans are not recorded: a merged cell renders in the ' +
       'column it starts at, and the columns it covers render blank, here ' +
```

Reviewer: none. Reconciliation: applied as proposed.

#### H062

```diff
@@ -413,5 +413,5 @@ function renderDetectionSettingsRows(settings) {
 }
 
-// The detection settings in force at capture time (D8): every key of
+// The detection settings in force at capture time: every key of
 // state.detectionSettings with its value, so a looks-wrong capture shows
 // the values detection ran under. A failed state pull leaves
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-number/core.js`

#### H063

```diff
@@ -26,5 +26,5 @@
 // whichever end carries the letter, so the rand's "R" counts in "R45" and
 // not in "Revenue", and the krone's "kr" counts in "kr45" and not in
-// "krona". A sign written as a picture counts anywhere, as it always has.
+// "krona". A sign written as a picture counts anywhere.
 // Several currencies share a sign, and one currency may carry several;
 // both collapse to one entry in the derived lists below.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H064

```diff
@@ -78,5 +78,5 @@ const CURRENCY_SIGN_ALTERNATION = CURRENCY_SIGNS
 const CURRENCY_SIGN_RE = new RegExp(CURRENCY_SIGN_ALTERNATION);
 
-// Constants owned by the coercion + magnitude layer.
+// Constants of the coercion and magnitude layer.
 // The one format-mark list: a character that sits beside a number without
 // belonging to it — a currency sign, a percent sign, and whitespace. The
```

Reviewer: none. Reconciliation: applied as proposed.

#### H065

```diff
@@ -90,5 +90,5 @@ const CURRENCY_SIGN_RE = new RegExp(CURRENCY_SIGN_ALTERNATION);
 const FORMAT_MARK_ALTERNATION = '(?:' + CURRENCY_SIGN_ALTERNATION + '|[\\s%])';
 // Everything dropped from a text before it reads as a number: the format
-// marks alone. A group mark stays, so the number shape test below can judge
+// marks alone. A group mark stays, so the number shape test below can test
 // where it stands.
 const CLEAN_REGEX = new RegExp(FORMAT_MARK_ALTERNATION, 'g');
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-number/identifiers.js`

#### H066

```diff
@@ -166,5 +166,5 @@ const POSTAL_CODE_PATTERN = [
 ].join('|');
 
-// The one list of identifier shapes. Each entry names the shape and carries
+// The one list of identifier shapes. Each entry holds the shape's name and
 // its whole-cell test — a pattern anchored to the whole cell, or a function
 // for a shape with a rule beyond its pattern — and its span pattern for text
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-number/parsing.js`

#### H067

```diff
@@ -24,20 +24,20 @@
 // ("XR47182913MKB07", "MKB07", "Q3"). Mining them produces a rounded value that
 // still looks like a valid identifier, so the corruption is undetectable.
-// Refusing the leading digit is enough to drop the whole run, because every
+// Rejecting the leading digit is enough to drop the whole run, because every
 // later position inside it is itself preceded by a digit.
 //
-// Dot/comma: stops the scan re-entering a number it just refused — without
+// Dot/comma: stops the scan re-entering a number it just rejected — without
 // them "abc1,200" would skip "1,200" and then match the bare "200".
 //
-// The guard also decides when a leading "-" is a minus sign rather than a
+// The guard also determines when a leading "-" is a minus sign rather than a
 // separator. In "2022-04", "555-1234" or "10-20" the hyphen follows a digit, so
 // it is rejected as a sign; the digits after it still match on their own and
 // stay positive. Genuine negatives ("down -1,200 units") are preceded by
-// whitespace or punctuation and are unaffected. Note that en-dash ranges
-// ("₹615.71–623.33 crore") never relied on this — "-?" only ever matched an
-// ASCII hyphen — so hyphen-typed ranges now behave like en-dash ones.
+// whitespace or punctuation and are unaffected. En-dash ranges
+// ("₹615.71–623.33 crore") never reach this rule — "-?" matches an ASCII
+// hyphen alone — so hyphen-typed ranges behave like en-dash ones.
 //
 // The run takes every comma and dot that sits between digits, so the number
-// shape test in toNumber (core.js) judges the whole run: "1.234,56" and
+// shape test in toNumber (core.js) tests the whole run: "1.234,56" and
 // "12.03.2024" come through whole and read as no number, and the text stays
 // as written. A pattern that stopped at the first dot would take "1.234" and
```

Reviewer: none. Reconciliation: applied as proposed.

#### H068

```diff
@@ -648,5 +648,5 @@ function matchBracketedNumber(text) {
 // rounded by date logic (decade/century), never by the numeric offset. These
 // helpers locate such year tokens so they can be excluded from numeric magnitude
-// detection, numeric rounding, and the sidebar preview examples (issue #4).
+// detection, numeric rounding, and the lens preview samples.
 // Period-less markers must be UPPERCASE. Bare lowercase forms ("ad", "bp",
 // "ah", "ce", "bc") collide with ordinary English words and abbreviations
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-number/rounding.js`

#### H069

```diff
@@ -103,6 +103,6 @@ function formatStep(step) {
 
 function trimNum(n) {
-  // Up to 3 significant digits, but avoid scientific notation for the values
-  // formatStep actually produces (steps are powers of 10 or half-decades).
+  // Up to 3 decimal places, but avoid scientific notation for the values
+  // formatStep produces (steps are 1, 2.5, or 5 times a power of 10).
   const rounded = Math.round(n * 1000) / 1000;
   let s = String(rounded);
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-simplify/ladder.js`

#### H070

```diff
@@ -197,5 +197,5 @@ function classifyCell(input, options) {
   // is written as the brackets around it. Its digits alone change, which is
   // the extracted write, so the brackets stay where the page put them — and a
-  // page that gives a bracket its own text piece no longer holds the cell
+  // page that gives a bracket its own text piece does not hold the cell
   // back, because the placement step then measures the digits alone. It
   // rounds whatever the words setting holds, as a pure cell does. A cell with
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/lib/dr-table/detect.js`

#### H071

```diff
@@ -51,6 +51,6 @@ const DR_TABLE_ELEMENT_NODE = (typeof Node !== 'undefined' && Node.ELEMENT_NODE)
 // --- Ports: pluggable defaults for environment-sensitive reads ---
 // Each accepts an optional `opts` bag on the calling function; every default
-// below mirrors this file's pre-port behavior exactly when the real browser
-// globals are present, and degrades to a safe, working default when they are
+// below reads the real browser globals when they are present, and degrades
+// to a safe, working default when they are
 // not — that degradation, not a thrown error, is what lets detection run
 // standalone (a Node script, a unit test, a future non-extension host).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H072

```diff
@@ -591,5 +591,5 @@ class GridAdapter {
     // A grid declares a merge through the accessibility attributes, the only
     // spans its markup carries; a grid that declares none numbers its columns
-    // by read position, as it did before this rule (issue #330).
+    // by read position.
     const plan = assignGridColumns(
       rowCellEls.map((cellEls) => cellEls.map(gridCellSpans)));
```

Reviewer: none. Reconciliation: applied as proposed.

#### H073

```diff
@@ -1190,5 +1190,5 @@ function placeDecision(decision, text, layout, opts = {}) {
 // Decide whether an element is a roundable table/grid. Grouped with the adapters
 // because they read DOM shape and lean on the GRID_* constants and makeAdapter
-// defined above. Consumed by the toggle UI (ui-toggle.js) and the engine.
+// defined above. Consumed by the pillbox view (ui-toggle.js) and the engine.
 
 /**
```

Reviewer: none. Reconciliation: applied as proposed.

#### H074

```diff
@@ -1398,7 +1398,4 @@ function findTargetTable(el, opts = {}) {
 }
 
-// Left-offset threshold (px) below which an element is treated as
-// deliberately off-screen hidden: DR_DETECTION_SETTINGS.offscreenLeftPx.
-
 /**
  * Return the nearest *positioned* ancestor of `el` (or `el` itself if it is
```

Reviewer: none. Reconciliation: applied as proposed.

#### H075

```diff
@@ -1479,5 +1476,5 @@ function isPhantomA11yTable(table, opts = {}) {
     }
     node = node.parentElement || node.parentNode || null;
-    // Stop at document root (no parentElement means we've left the element tree)
+    // Stop at document root (no parentElement means the walk has left the element tree)
     if (node && typeof node.tagName === 'undefined') break;
   }
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/sidebar.html`

#### H076

```diff
@@ -24,5 +24,5 @@
       margin: 0;
     }
-    /* iOS-style toggle */
+    /* iOS-style switch */
     .switch {
       position: relative;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H077

```diff
@@ -115,5 +115,5 @@
       user-select: none;
     }
-    /* ----- Variant F: linked dual sliders ----- */
+    /* ----- Linked dual sliders ----- */
     .slider-block {
       display: flex;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H078

```diff
@@ -176,7 +176,7 @@
     .dual-thumb.bot.linked { background: #c48a6a; }
     .dual-thumb:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
-    /* Preview band: 2 samples above slider, 3 below (variant F).
-       Grid + display:contents pairs so the "→" column aligns vertically
-       and the whole band is centered horizontally under the slider. */
+    /* Lens preview: grid + display:contents pairs so the "→" column aligns
+       vertically and the whole band is centered horizontally under the
+       slider. */
     .results-band {
       display: grid;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H079

```diff
@@ -245,7 +245,7 @@
       color: #5f6368;
     }
-    /* Locked table (issue #262): the connected table is stuck showing
-       simplified values (see content.js's APPLY_BLOCKED). The settings area
-       and the main toggle dim and stop accepting input; #status carries the
+    /* Locked table: the bound table is unrestorable and shows simplified
+       values (see content.js's state:applyBlocked). The settings area and the
+       main switch dim and stop accepting input; #status carries the
        explanation. */
     body.table-locked #optionsSection,
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/sidebar.js`

#### H080

```diff
@@ -12,23 +12,22 @@ const statusEl = document.getElementById('status');
 const NO_TABLE_CLASS = 'no-table';
 const NO_TABLE_STATUS_MSG = 'Right-click a table to connect it here.';
-// Shown when the content script refuses an apply because the table's
+// Shown when the content script blocks an apply because the table's
 // registry originals did not survive a content-script re-injection (the
-// APPLY_BLOCKED message — see content.js's applySidebarRounding guard).
+// state:applyBlocked topic — see content.js's applySidebarRounding guard).
 const APPLY_BLOCKED_STATUS_MSG = 'This table\'s original values are no longer available. Reload the page, then apply settings again.';
 
 
-// ---- The sidebar serves one tab (issue #343) ----
+// ---- The sidebar serves one tab ----
 //
-// A content script reports by broadcast, because the sidebar is an extension
-// page and a broadcast is what reaches one. A broadcast names no tab, so the
-// sidebar acted on every report it received: a background tab re-simplifying
-// its rows redrew the sidebar, and a blocked apply there locked it against a
-// table the user could not see, under a notice naming no page.
+// A content script publishes by broadcast, because the sidebar is an
+// extension page and a broadcast is what reaches one. A broadcast names no
+// tab, so without a filter a background tab re-simplifying its rows would
+// redraw the sidebar, and a blocked apply there would lock it against a table
+// the user cannot see.
 //
 // The bound tab is the tab the sidebar was opened for, and the sidebar serves
-// that tab alone. It is a second, separate fact from the tab number the
-// service worker holds, not one fact stored twice: the worker's answers which
-// tab to close the sidebar for, and this one answers which tab the sidebar is
-// showing.
+// that tab alone. It is a separate fact from the tab number the service
+// worker holds: the worker's number answers which tab to close the sidebar
+// for, and this one answers which tab the sidebar is showing.
 //
 // The tabs interface and the bus arrive as parameters so the whole concern
```

Reviewer: none. Reconciliation: applied as proposed.

#### H081

```diff
@@ -38,8 +37,8 @@ function createBoundTab(tabsApi, bus) {
   let boundWindowId = null;
 
-  // A report belongs to the bound tab only when the two numbers match. A
-  // report carrying no tab came from an extension page rather than a content
+  // A message belongs to the bound tab only when the two numbers match. A
+  // message carrying no tab came from an extension page rather than a content
   // script, and belongs to no tab at all. Before the lookup answers there is
-  // nothing to compare against, so a report arriving in that window is
+  // nothing to compare against, so a message arriving in that window is
   // dropped; resolve() runs the sidebar's opening read afterwards, and that
   // read carries the current truth.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H082

```diff
@@ -51,5 +50,5 @@ function createBoundTab(tabsApi, bus) {
     // Record the tab the sidebar was opened for, and the window holding it,
     // then run onReady. The order is load-bearing: the read reaches the page,
-    // the page reports back, and a report arriving before the tab number
+    // the page publishes back, and a message arriving before the tab number
     // exists has nothing to be compared against. No tab to bind to leaves the
     // number unset and still runs the read, which falls to the unbound state
```

Reviewer: none. Reconciliation: applied as proposed.

#### H083

```diff
@@ -83,5 +82,5 @@ function createBoundTab(tabsApi, bus) {
     },
 
-    // Subscribe to one of the content script's reports. Every such report
+    // Subscribe to one of the content script's topics. Every such message
     // passes through here, so the comparison lives in one place rather than
     // at each of the eight subscriptions.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H084

```diff
@@ -93,11 +92,19 @@ function createBoundTab(tabsApi, bus) {
     },
 
+    // The window the bound tab sits in: null before the lookup answers, and
+    // null when the tabs interface reports no window. The screenshot take
+    // passes this window, whose front tab is the bound tab by construction —
+    // the sidebar closes when that tab leaves the front.
+    windowId() {
+      return boundWindowId;
+    },
+
     // Close the sidebar when the tab it was opened for stops being the one in
     // front. The service worker closes it on the ordinary route and misses
     // two: an idle restart empties the tab number it compares against, and a
     // sidebar opened from Chrome's own side-panel control never sets it. On
-    // those routes the sidebar survived the switch and kept showing controls
-    // for a page the user had left. Closing here gives a tab switch one
-    // outcome, whichever route it takes.
+    // those routes the sidebar would otherwise survive the switch and keep
+    // showing controls for a page the user left. Closing here gives a tab
+    // switch one outcome, whichever route it takes.
     //
     // A side panel belongs to one browser window, and the activation event
```

Reviewer: none. Reconciliation: applied as proposed.

#### H085

```diff
@@ -107,12 +114,4 @@ function createBoundTab(tabsApi, bus) {
     // comparison on the tab alone.
     //
-    // The window the bound tab sits in: null before the lookup answers, and
-    // null when the tabs interface reports no window. The screenshot take
-    // passes this window, whose front tab is the bound tab by construction —
-    // the sidebar closes when that tab leaves the front.
-    windowId() {
-      return boundWindowId;
-    },
-
     // With no tab recorded there is nothing to have left, so nothing closes.
     onSwitchAway(onLeft) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H086

```diff
@@ -136,6 +135,6 @@ function setTableBound(isBound) {
   if (!isBound) {
     // No active table: there is nothing for rounding to act on, so flip the
-    // main toggle to its off state rather than dimming the whole sidebar.
-    // Any lock belonged to the table that just went away (issue #262), and
+    // main switch to its off state rather than dimming the whole sidebar.
+    // Any lock belonged to the table that just went away, and
     // the message written below is unsourced — drop a stale source tag so
     // applyNow's delivery-success clear can still collect it.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H087

```diff
@@ -146,6 +145,6 @@ function setTableBound(isBound) {
     statusEl.textContent = NO_TABLE_STATUS_MSG;
   } else {
-    // A table is now bound. The main toggle is not touched here: the model
-    // is its source (issue #251) — applySettingsToUI on a pull, or
+    // A table is now bound. The main switch is not touched here: the model
+    // is its source — applySettingsToUI on a pull, or
     // applyDefaultsToUI on the pull's fallback, has already set it, and a
     // bind must not reset it to the shipped default.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H088

```diff
@@ -171,5 +170,5 @@ const timeGranularityEl = document.getElementById('timeGranularity');
 const rangeExprEl = document.getElementById('rangeExpr');
 
-// ----- Variant F: linked dual-thumb sliders -----
+// ----- Linked dual-thumb sliders -----
 // Stops are ordered so the *rounding strategy* changes monotonically across the
 // track (finest step on the left, coarsest on the right), NOT by offset value.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H089

```diff
@@ -226,5 +225,5 @@ function renderSliders() {
 }
 
-// ----- Preview band -----
+// ----- Lens preview -----
 const topBandEl = document.getElementById('topBand');
 const botBandEl = document.getElementById('botBand');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H090

```diff
@@ -375,5 +374,5 @@ function renderTopBand(el, rows, offset) {
   const from = document.createElement('span');
   from.className = 'from';
-  // Bare original number (text stripped per #3), prefixed "e.g." per #1.
+  // Bare original number, prefixed "e.g.".
   from.textContent = 'e.g. ' + formatOriginal(row.num);
   example.appendChild(from);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H091

```diff
@@ -416,5 +415,5 @@ function renderBotBand(el, rows, offset, maxMag) {
 
     // "from" cell: "266,453 (100k+)" where the OoM label is brown. The bare
-    // original number is shown (surrounding text stripped per #3).
+    // original number is shown, without its surrounding text.
     const from = document.createElement('span');
     from.className = 'from';
```

Reviewer: none. Reconciliation: applied as proposed.

#### H092

```diff
@@ -461,8 +460,8 @@ function renderPreviewBands() {
 }
 
-// Refreshes the preview bands from the selected table; the bound/unbound
+// Refreshes the lens preview from the active table; the bound/unbound
 // state is a side effect of the response (samples !== null means bound).
-// The main toggle is not written on the bound path: setTableBound(true)
-// leaves it to the settings apply that ran before this call (issue #251),
+// The main switch is not written on the bound path: setTableBound(true)
+// leaves it to the settings apply that ran before this call,
 // so no pulled value needs threading back in after the bind resolves.
 function fetchPreviewSamples() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H093

```diff
@@ -573,9 +572,8 @@ if (botThumb) {
 
 function currentSettings() {
-  // A disabled switch shows no value of the table's: under the #262 lock it
+  // A disabled switch shows no value of the table's: under the lock it
   // shows a forced ON that is display only, until a settings read answering
   // unlocked lands. A save then (the sliders stay usable) leaves the on/off
-  // value out, and the content script's merge keeps the table's own value
-  // (issue #272).
+  // value out, and the content script's merge keeps the table's own value.
   const settings = {};
   if (!enabledEl.disabled) settings.enabled = enabledEl.checked;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H094

```diff
@@ -587,6 +585,6 @@ function currentSettings() {
   if (timeGranularityEl) settings.timeGranularity = timeGranularityEl.value;
   // Always emit concrete numbers — never null/blank — so content.js never falls
-  // back to the "offset_other inherits from offset_top" branch (the original
-  // bleed bug). num_top is no longer surfaced in the UI; pin it to 1.
+  // back to the "offset_other inherits from offset_top" branch. numTop has no
+  // sidebar control; pin it to 1.
   settings.offsetTop = topVal;
   settings.offsetOther = botVal;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H095

```diff
@@ -598,6 +596,6 @@ function currentSettings() {
 function updateDisabledState() {
   optionsSection.classList.toggle('disabled', !enabledEl.checked);
-  // Granularity dropdown only matters when the row's toggle is on
-  // (i.e. that type's cells are bucketed by the selected granularity).
+  // Granularity dropdown only matters when the row's switch is on
+  // (i.e. that type's cells are bucketed by the chosen granularity).
   if (dateGranularityEl) {
     dateGranularityEl.disabled = !document.getElementById('simplifyDates').checked;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H096

```diff
@@ -615,6 +613,5 @@ function updateDisabledState() {
 // The answer's value is never read — only whether one arrived. Nothing
 // answering means no content script on the tab, which is exactly the unbound
-// state. That is the same fact chrome.runtime.lastError carried before issue
-// #325, reaching the same callback by the bus's one reply path.
+// state.
 //
 // On an answer, clear only an unsourced stale message (the no-table reminder).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H097

```diff
@@ -648,5 +645,5 @@ if (dateGranularityEl) dateGranularityEl.addEventListener('change', applyNow);
 if (timeGranularityEl) timeGranularityEl.addEventListener('change', applyNow);
 
-// Apply on any range-expression keystroke (the previous live-update behavior).
+// Apply on any range-expression keystroke.
 if (rangeExprEl) rangeExprEl.addEventListener('input', applyNow);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H098

```diff
@@ -712,15 +709,14 @@ boundTab.subscribe('state:applyBlocked', () => {
 });
 
-// The lock reaches the sidebar two ways: the report after a blocked apply,
-// and the settings read's answer (#500). Both run this one step.
+// The lock reaches the sidebar two ways: the notice after a blocked apply,
+// and the settings read's answer. Both run this one step.
 function showLock() {
   statusEl.textContent = APPLY_BLOCKED_STATUS_MSG;
   statusEl.dataset.source = 'blocked';
-  // Issue #262: the connected table is stuck showing simplified values.
-  // Show that truth and stop accepting input: main toggle ON and
+  // The bound table is unrestorable and shows simplified values.
+  // Show that truth and stop accepting input: main switch ON and
   // disabled, settings area dimmed via body.table-locked (sidebar.html).
   // The forced ON is display only: the table's on/off value stays in the
-  // application model, and a save leaves the disabled switch out (issue
-  // #272).
+  // application model, and a save leaves the disabled switch out.
   document.body.classList.add('table-locked');
   enabledEl.checked = true;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H099

```diff
@@ -748,6 +744,6 @@ boundTab.subscribe('state:applyOk', () => {
 boundTab.subscribe('state:previewSamplesChanged', () => {
   // Stale view: re-read the active table's settings, then the previews (the
-  // pull chain ends in fetchPreviewSamples). A bare preview fetch here used
-  // to reset the main toggle to the shipped default (issue #251).
+  // pull chain ends in fetchPreviewSamples). A bare preview fetch here would
+  // reset the main switch to the shipped default.
   pullSettingsAndApplyToUI();
 });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H100

```diff
@@ -758,6 +754,5 @@ boundTab.subscribe('state:tableSwitched', () => {
   // read answers the new table's lock state with its settings, so the lock
   // lifts or stays by what the new table holds. The sidebar mirrors the new
-  // active table's settings (issue #251); it does not reset to the shipped
-  // defaults.
+  // active table's settings; it does not reset to the shipped defaults.
   try {
     pullSettingsAndApplyToUI();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H101

```diff
@@ -777,5 +772,5 @@ window.addEventListener('unload', () => {
 function applySettingsToUI(settings) {
   const s = Object.assign({}, DR_DEFAULTS, settings || {});
-  // The #262 lock forces the main toggle ON + disabled while the bound
+  // The lock forces the main switch ON + disabled while the bound
   // table's originals are unrestorable. A settings notice or a read answering
   // locked must not write the table's on/off value over that forced ON; a
```

Reviewer: none. Reconciliation: applied as proposed.

#### H102

```diff
@@ -805,5 +800,5 @@ function applySettingsToUI(settings) {
 
 // Seed the UI from the shared defaults so the sidebar and content.js never
-// drift apart even before a table has ever been selected (this file's own
+// drift apart even before a table has ever been activated (this file's own
 // fallback when the live pull below fails).
 function applyDefaultsToUI() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H103

```diff
@@ -814,13 +809,13 @@ function applyDefaultsToUI() {
 // refresh: pull the active table's settings from content.js (the one holder
 // of settings) rather than resetting to shipped defaults — neither a
-// close/reopen nor a switch may lose what the user configured (issue #251).
+// close/reopen nor a switch may lose what the user configured.
 // No active tab, no content script yet, or no response at all falls back to
-// defaults, same as before this pull existed.
+// defaults.
 //
-// The answer also carries whether the active table is locked (#500). The
+// The answer also carries whether the active table is locked. The
 // sidebar sets or lifts the lock from it before the settings reach the
 // controls, so the switch shows the lock's forced ON or the table's own
 // value. The read is the lock's route in whenever the sidebar asks: on
-// start, on a right-click, on a table switch. The report after a blocked
+// start, on a right-click, on a table switch. The notice after a blocked
 // apply covers a lock that arrives while the sidebar is open.
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H104

```diff
@@ -1047,8 +1042,7 @@ function assembleAndSaveCapture(mark, remarks, pageState, shot) {
     sidebar: DR_LOG.snapshot(),
   };
-  // A failure while building or saving the file used to surface as the
-  // finish button doing nothing. It now reports on the status line and is
-  // logged; the form stays open with the typed remarks, so a retry costs
-  // nothing.
+  // A failure while building or saving the file shows on the status line
+  // and is logged; the form stays open with the typed remarks, so a retry
+  // costs nothing.
   try {
     const html = DR_CAPTURE.buildCaptureDocument({
```

Reviewer: none. Reconciliation: applied as proposed.

#### H105

```diff
@@ -1124,11 +1118,11 @@ if (rangeExprEl) rangeExprEl.value = '';
 
 // Record the tab this sidebar was opened for, then make the opening read.
-// The order is load-bearing: the read reaches the page, the page reports
-// back, and a report arriving before the tab number exists has nothing to be
-// compared against and is dropped.
+// The order is load-bearing: the read reaches the page, the page publishes
+// back, and a message arriving before the tab number exists has nothing to
+// be compared against and is dropped.
 //
-// Pulls live settings, then (see above) pulls preview samples for whichever
-// table the user has right-clicked. If no table was targeted, content.js
-// returns nulls and the bands render the prompt.
+// Pulls live settings, then (see above) pulls preview samples for the active
+// table. With no active table, content.js returns nulls and the sidebar
+// shows the no-table prompt.
 boundTab.resolve(() => {
   pullSettingsAndApplyToUI();
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/capture-log.js`

#### H106

```diff
@@ -231,5 +231,5 @@
 })();
 
-// The per-cell marker flag reaches the cell record (#304). The serializer
+// The per-cell marker flag reaches the cell record. The serializer
 // already reads the rounded marker to compute the locked pairing; the
 // renderer needs it per cell to tell a lost original (marker, original: null)
```

Reviewer: none. Reconciliation: applied as proposed.

#### H107

```diff
@@ -728,5 +728,5 @@
 })();
 
-// --- lib/dr-capture: the renderer keeps the state's absences (#304) ---
+// --- lib/dr-capture: the renderer keeps the state's absences ---
 //
 // The state records three kinds of absence honestly; the page a human reads
```

Reviewer: none. Reconciliation: applied as proposed.

#### H108

```diff
@@ -827,5 +827,5 @@
 })();
 
-// --- lib/dr-capture: the size warning (#306) ---
+// --- lib/dr-capture: the size warning ---
 //
 // A capture has no size bound — the full-detail default is deliberate — so
```

Reviewer: none. Reconciliation: applied as proposed.

#### H109

```diff
@@ -856,6 +856,6 @@
 })();
 
-// The header once stated what the file holds (#310). The product owner
-// retired the line as stating the obvious; this pin keeps it out.
+// The header carries no line stating what the file holds, which would state
+// the obvious. This pin keeps it out.
 (function captureHeaderCarriesNoCaveat() {
   if (typeof globalThis.DR_CAPTURE !== 'object') return;
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/detection.js`

#### H110

```diff
@@ -2,5 +2,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint exclude-numbers-in-links
+// Numbers inside links
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H111

```diff
@@ -148,14 +148,12 @@
 
 // ---------------------------------------------------------------------------
-// Regression: DEFAULT_NUMERIC_PROBE must stay byte-equivalent to the old
-// pre-extraction predicate (trim -> strip format marks and commas -> parseFloat ->
-// isFinite). A prior version of this probe delegated to DR_NUMBER.toNumber,
-// which uses Number() plus unicode-minus/parenthesized-negative handling and
-// disagrees with parseFloat on exactly these shapes: date-only, time-only,
-// and value-with-unit cells (parseFloat accepts a numeric prefix; Number does
-// not), and accounting-negative cells (Number, via the parens rewrite, parses
-// them; parseFloat does not). Each assertion below fails against the
-// DR_NUMBER-delegating probe and passes against the restored parseFloat-based
-// one — verified by running this file against the pre-fix commit.
+// DEFAULT_NUMERIC_PROBE must stay the parseFloat predicate (trim -> strip
+// format marks and commas -> parseFloat -> isFinite). DR_NUMBER.toNumber
+// uses Number() plus unicode-minus/bracketed-negative handling and disagrees
+// with parseFloat on exactly these shapes: date-only, time-only, and
+// value-with-unit cells (parseFloat accepts a numeric prefix; Number does
+// not), and accounting-negative cells (Number, via the bracket rewrite,
+// parses them; parseFloat does not). Each assertion below fails against a
+// probe that delegates to DR_NUMBER.toNumber.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H112

```diff
@@ -278,5 +276,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint exclude-exponents: <sup>-aware number masking
+// <sup>-aware number masking
 // ---------------------------------------------------------------------------
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H113

```diff
@@ -571,5 +569,5 @@ const supTestOpts = {
 // =============================================================================
 // Grid Detection — looksLikeGrid() and findTargetTable() unit tests
-// Sprint: grid-detection  Spec: docs/sprint-plans/grid-support.md §6
+// Spec: docs/sprint-plans/grid-support.md §6
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H114

```diff
@@ -908,8 +906,7 @@ const supTestOpts = {
 
 // FT5: findTargetTable — returns already-found ancestor without re-walking
-// If an ancestor is already known per opts.isSeen (app-model-registry sprint
-// replaced the closest('.dr-ext-grid') read with an injected isSeen check —
-// see lib/dr-table/detect.js), it must be returned immediately without
-// calling looksLikeGrid again.
+// If an ancestor is already known per opts.isSeen (see
+// lib/dr-table/detect.js), it must be returned immediately without calling
+// looksLikeGrid again.
 (function findTargetTable_returnsAlreadyTaggedGrid() {
   withFindTargetEnv([], function() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H115

```diff
@@ -935,11 +932,8 @@ const supTestOpts = {
 })();
 
-// FT6: findTargetTable — REPORTS a new grid via { handle, isNew: true } and
-// does not mark it itself (sprint extract-dr-table: detection moved to
-// lib/dr-table and now only reports; the caller — content.js's
-// markAndToggleIfNewGrid — owns the dr-ext-grid write and the widget build).
-// This test used to assert findTargetTable itself added the class (AC2 under
-// the old contract); it is reworked here to assert the new split instead:
-// findTargetTable must resolve the new grid AND must leave it unmarked.
+// FT6: findTargetTable — returns a new grid via { handle, isNew: true } and
+// does not mark it itself; the caller — content.js's markAndToggleIfNewGrid —
+// writes dr-ext-grid and builds the pillbox. findTargetTable must resolve the
+// new grid AND must leave it unmarked.
 (function findTargetTable_reportsNewGridWithoutMarking() {
   withFindTargetEnv([], function() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H116

```diff
@@ -974,5 +968,5 @@ const supTestOpts = {
 
 // ---------------------------------------------------------------------------
-// Sprint right-click-registers: the nomination step runs from the clicked
+// Right-click registration: the nomination step runs from the clicked
 // element's chain root.
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.5 and the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H117

```diff
@@ -1233,5 +1227,5 @@ const supTestOpts = {
 
 // ---------------------------------------------------------------------------
-// Sprint grid-adapter: TableAdapter abstraction
+// TableAdapter abstraction
 // AC2 — NativeTableAdapter round-trip test
 // AC3 — GridAdapter stub no-throw test
```

Reviewer: none. Reconciliation: applied as proposed.

#### H118

```diff
@@ -1304,5 +1298,5 @@ const supTestOpts = {
   eq('TA1b: native adapter cell exposes no setText',
     cell.setText, undefined);
-  // applyPatches is the grid cell's write, the name such a loop reaches now.
+  // applyPatches is the grid cell's write, the name such a loop would reach.
   eq('TA1b: native adapter cell exposes no applyPatches',
     cell.applyPatches, undefined);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H119

```diff
@@ -1671,8 +1665,8 @@ const supTestOpts = {
 // Source-level assertion: the cell object both kinds share, the patch
 // writer, the piece restore, and the controller's restore hold no
-// innerHTML= assignment. Since #421 a native restore writes text pieces too,
-// so no write path on either kind assigns markup.
+// innerHTML= assignment. A native restore writes text pieces too, so no
+// write path on either kind assigns markup.
 //
-// This test encodes the hard rule from the sprint brief:
+// This test encodes the hard rule:
 //   "The grid write must be nodeValue-only."
 (function gr6j_gridWrite_sourceGuard_noInnerHTML() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H120

```diff
@@ -1692,5 +1686,5 @@ const supTestOpts = {
 
 // ---------------------------------------------------------------------------
-// Sprint add-phantom-a11y-predicate: isPhantomA11yTable
+// Accessibility artifact predicate: isPhantomA11yTable
 // ---------------------------------------------------------------------------
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H121

```diff
@@ -1921,6 +1915,6 @@ const supTestOpts = {
 })();
 
-// --- pass1-filter AC1: phantom tables (aria-hidden ancestor) get NO toggle ---
-// Build N=3 phantom tables (aria-hidden parent), all valid data tables.
+// --- pass1-filter AC1: accessibility artifacts (aria-hidden ancestor) get NO pillbox ---
+// Build N=3 accessibility artifacts (aria-hidden parent), all valid data tables.
 // After Pass 1 none of them should be in tableToggles.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H122

```diff
@@ -1943,8 +1937,8 @@ const supTestOpts = {
   const phantoms = [makeAriaHiddenPhantom(), makeAriaHiddenPhantom(), makeAriaHiddenPhantom()];
 
-  // Sanity: each phantom is a valid data table (isDataTable guard is NOT the cause of skip)
+  // Sanity: each artifact is a valid data table (isDataTable guard is NOT the cause of skip)
   eq('pass1-filter: phantom aria-hidden table satisfies isDataTable (sanity)',
     isDataTable(phantoms[0]), true);
-  // Sanity: each phantom is detected as phantom
+  // Sanity: each artifact is detected as an artifact
   eq('pass1-filter: phantom aria-hidden table isPhantomA11yTable is true (sanity)',
     isPhantomA11yTable(phantoms[0]), true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H123

```diff
@@ -1959,6 +1953,6 @@ const supTestOpts = {
 })();
 
-// --- pass1-filter AC1: phantom tables (off-screen left) get NO toggle ---
-// Build N=2 phantom tables with positioned ancestor left=-10000px.
+// --- pass1-filter AC1: accessibility artifacts (off-screen left) get NO pillbox ---
+// Build N=2 accessibility artifacts with positioned ancestor left=-10000px.
 
 (function pass1Filter_offscreenLeftPhantoms_zeroToggles() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H124

```diff
@@ -2026,9 +2020,9 @@ const supTestOpts = {
 })();
 
-// --- pass1-filter adversarial: mix of phantom + real tables in one Pass 1 run ---
+// --- pass1-filter adversarial: mix of artifacts + real tables in one Pass 1 run ---
 // Only the real tables should get toggles; count equals exactly the number of real tables.
 
 (function pass1Filter_mixedFixture_onlyRealTablesGetToggles() {
-  // Two phantom tables (aria-hidden ancestor)
+  // Two accessibility artifacts (aria-hidden ancestor)
   function makeAriaHiddenPhantom() {
     const t = makePass1DataTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H125

```diff
@@ -2045,5 +2039,5 @@ const supTestOpts = {
   }
 
-  // One phantom with off-screen left
+  // One artifact with off-screen left
   function makeOffscreenPhantom() {
     const t = makePass1DataTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H126

```diff
@@ -2105,5 +2099,5 @@ const supTestOpts = {
 })();
 
-// --- pass1-filter: Pass 1 skips phantom but does NOT skip a non-data real table ---
+// --- pass1-filter: Pass 1 skips artifacts but does NOT skip a non-data real table ---
 // (edge: if a real table fails isDataTable, no toggle either — confirm the skip
 // here is from isDataTable, not from isPhantomA11yTable)
```

Reviewer: none. Reconciliation: applied as proposed.

#### H127

```diff
@@ -2134,5 +2128,5 @@ const supTestOpts = {
   };
 
-  // Confirm isPhantomA11yTable is false (skip is NOT from the phantom guard)
+  // Confirm isPhantomA11yTable is false (skip is NOT from the artifact guard)
   eq('pass1-filter: non-data real table isPhantomA11yTable is false (sanity)',
     isPhantomA11yTable(nonDataTable), false);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H128

```diff
@@ -2168,5 +2162,5 @@ const supTestOpts = {
 
   // Second run — table already in tableToggles; Pass 1 should skip it.
-  // We verify the toggle isn't re-inserted: since WeakMap.set overwrites,
+  // We verify the toggle is not re-inserted: since WeakMap.set overwrites,
   // a re-create would swap the button object, so we check its identity holds.
   const buttonAfterFirst = tableToggles.get(realTable);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H129

```diff
@@ -2183,5 +2177,5 @@ const supTestOpts = {
 
 // ---------------------------------------------------------------------------
-// Sprint grid-rowgroup-tr-extraction: GridAdapter._getRowEls handles ARIA grids
+// GridAdapter._getRowEls handles ARIA grids
 // whose data rows are bare <tr> inside a [role="rowgroup"], with header/summary
 // rows OUTSIDE the rowgroup (e.g. Kaggle's Data Explorer). Standard ARIA only.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H130

```diff
@@ -2227,6 +2221,6 @@ const supTestOpts = {
 
 // ---------------------------------------------------------------------------
-// Sprint grid-first-row-literal: a rowgroup picks the row shape, not the row
-// set. The rows found inside it decide the winning selector; the row list is
+// A rowgroup picks the row shape, not the row
+// set. The rows found inside it determine the winning selector; the row list is
 // then the whole grid's matches for that selector, so header and summary rows
 // outside the group are rows like any other. Only the shipped first-row and
```

Reviewer: none. Reconciliation: applied as proposed.

#### H131

```diff
@@ -2297,8 +2291,8 @@ const supTestOpts = {
 })();
 
-// Detection: the row universe now starts at the header row, and a wide
-// header of text labels must not exhaust the data-test sample before the
-// scan reaches a data row (review finding: a six-column sales grid whose
-// data rows lead with four text cells lost its pillbox).
+// Detection: the row universe starts at the header row, and a wide header
+// of text labels must not exhaust the data-test budget before the scan
+// reaches a data row (a six-column sales grid whose data rows lead with four
+// text cells keeps its pillbox).
 (function gridRowUniverse_isDataTable_wideHeader() {
   const g = makeRowgroupRoleGrid(
```

Reviewer: none. Reconciliation: applied as proposed.

#### H132

```diff
@@ -2312,17 +2306,14 @@ const supTestOpts = {
 
 // ---------------------------------------------------------------------------
-// Sprint data-test-budget: the data test spends one budget of
+// The data test spends one budget of
 // DR_DETECTION_SETTINGS.dataTestCellBudget cell reads, walked in document order and
-// stopped at the first number, on native tables and grids alike. It replaces
-// the retired per-row sample on grids and the retired unbounded scan on
-// native tables. isDataTable and DR_DETECTION_SETTINGS.dataTestCellBudget live in
+// stopped at the first number, on native tables and grids alike.
+// isDataTable and DR_DETECTION_SETTINGS.dataTestCellBudget live in
 // chrome-extension/lib/dr-table/detect.js and chrome-extension/constants.js.
 // ---------------------------------------------------------------------------
 
 // AC1: a grid whose first data row leads with eleven text cells before its
-// first number. Under the retired ten-cell-per-row sample this grid failed
-// the data test, because the sample never reached the twelfth cell. The
-// budget walks every cell in document order, so the number still falls
-// inside it.
+// first number. The budget walks every cell in document order, so the
+// number still falls inside it.
 (function dataTestBudget_grid_numberInTwelfthColumnPasses() {
   const header = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
```

Reviewer: none. Reconciliation: applied as proposed.

#### H133

```diff
@@ -2371,7 +2362,6 @@ const supTestOpts = {
 })();
 
-// Goal, native tables: the retired rule left native tables unbounded, so a
-// number far past 1000 cells would have passed. The budget applies to native tables and
-// grids alike, so this table fails.
+// Goal, native tables: the budget applies to native tables and grids alike,
+// so a table whose first number sits far past 1000 cells fails.
 (function dataTestBudget_nativeTable_farPastBudgetFails() {
   const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H134

```diff
@@ -2449,16 +2439,6 @@ const supTestOpts = {
 })();
 
-// The detection settings' expected contents. Nine values are the pre-move
-// ones, hand-copied from origin/main's lib/dr-table/detect.js (read via
-// `git show origin/main:chrome-extension/lib/dr-table/detect.js`) and the
-// design doc's key table; the detection-constants sprint moved them and
-// changed none of them. A tenth moved value, the pillbox auto-collapse
-// delay, went back to the pillbox view as its own constant: the view alone
-// reads it, and it shapes nothing detection finds. Three keys have no
-// pre-move value: nestingDepth, the
-// nomination step's configured depth from the grid-nesting-rule sprint;
-// dataTestCellBudget, the data test's cell budget from the data-test-budget
-// sprint; and pendingRetestCap, a pending table's re-test cap from the
-// pending-retest sprint. Key order matches constants.js's DR_DETECTION_SETTINGS
+// The detection settings' expected values, written out as literals, so the
+// pin catches a change to any value. Key order matches constants.js's DR_DETECTION_SETTINGS
 // declaration, so the JSON.stringify-based eq() comparison below is not
 // order-sensitive noise.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H135

```diff
@@ -2689,7 +2669,7 @@ const PRE_MOVE_DETECTION_SETTINGS = {
 })();
 
-// findTables' tableFilter: default (isPhantomA11yTable) drops a phantom a11y
-// table; a pass-through filter keeps it. reuses makePass1DataTable / the
-// aria-hidden phantom shape from the pass1-filter suite above.
+// findTables' tableFilter: default (isPhantomA11yTable) drops an accessibility
+// artifact; a pass-through filter keeps it. reuses makePass1DataTable / the
+// aria-hidden artifact shape from the pass1-filter suite above.
 (function findTables_tableFilterDefaultVsPassThrough() {
   const phantomTable = makePass1DataTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H136

```diff
@@ -2720,5 +2700,5 @@ const PRE_MOVE_DETECTION_SETTINGS = {
 
 // =============================================================================
-// Sprint grid-nesting-rule: one registration per grid, at the configured depth
+// One registration per grid, at the configured depth
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.3 and the
 // grid-nesting-rule block in §5; decision D2 in
```

Reviewer: none. Reconciliation: applied as proposed.

#### H137

```diff
@@ -3063,5 +3043,5 @@ const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';
 
 // =============================================================================
-// Sprint shape-fingerprint: the reader, the comparison, and the chain-root walk
+// The shape fingerprint: the reader, the comparison, and the chain-root walk
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.6 and the
 // shape-fingerprint block in §5; decision D7 in
```

Reviewer: none. Reconciliation: applied as proposed.

#### H138

```diff
@@ -3273,5 +3253,5 @@ const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';
 
 // =============================================================================
-// Sprint pending-retest: the nomination step reports one nest at a time
+// Pending tables: the nomination step returns one nest at a time
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.3 and §3.4.
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H139

```diff
@@ -3379,21 +3359,10 @@ const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-selection (adversarial hardening): parent-equivalence pin.
-// The contextmenu handler in content.js is the one call site both branches
-// implement: the pre-model code wrote a bare `lastRightClickedTable = table`
-// file-level let; HEAD calls DR_STORE.setSelectedTable(table) instead. The
-// expected sendMessage sequences below are LITERALS captured from the parent
-// branch (refactor/engine-returns-results, commit 35a5f52) by running its
-// real contextmenu listener in this same harness, and were verified
-// byte-identical to HEAD's output at review time. Freezing them keeps this
-// pin alive on main and in shallow CI checkouts, where the parent ref does
-// not exist for `git show`.
+// Contextmenu activation pin. The contextmenu handler in content.js calls
+// DR_STORE.setSelectedTable(table). The expected message sequence below is a
+// literal, so the pin holds on main and in shallow CI checkouts.
 // ---------------------------------------------------------------------------
 (function appModelSelection_parentEquivalence_contextmenuSelectionFlow() {
-  // One sequence. This ran twice, once with the page's copy of "the sidebar
-  // is open" set each way, and produced the identical sequence both times,
-  // because the contextmenu handler never read that value. The 2026-09-14
-  // sidebar-state-removal design retired the value (#241), so the two runs
-  // collapse into one.
+  // One sequence: the contextmenu handler reads nothing about the sidebar.
   const PARENT_EXPECTED_SEQUENCE = [{ action: 'state:tableActivated' }];
```

Reviewer: none. Reconciliation: applied as proposed.

#### H140

```diff
@@ -3469,5 +3438,5 @@ const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';
 
 // ---------------------------------------------------------------------------
-// Sprint hidden-cells: the data test and the engine read a hidden cell's raw
+// Hidden cells: the data test and the engine read a hidden cell's raw
 // text, and a hidden fragment inside a visible cell stays out of the read.
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H141

```diff
@@ -3655,5 +3624,5 @@ const GRID_ARIA_SELECTOR_TEXT = '[role="grid"], [role="table"]';
 
 // ---------------------------------------------------------------------------
-// Issue #330: a merged cell shifts the columns after it
+// A merged cell shifts the columns after it
 //
 // A cell's column number is its grid column — the column the browser lays the
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/helpers.js`

#### H142

```diff
@@ -51,6 +51,6 @@ function makeMockTable(rowsSpec, querySelectorResult) {
 
 // Simplify a table under the given settings the way the apply does: the
-// settings land on the table first, so the re-apply pass reads them back
-// (issue #328). roundTable alone writes no settings.
+// settings land on the table first, so the re-apply pass reads them back.
+// roundTable alone writes no settings.
 function roundTableUnder(table, opts) {
   DR_STORE.setTableSettings(table, opts, 'page');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H143

```diff
@@ -148,5 +148,5 @@ function makeLinkCell(anchors, outsideText) {
     querySelectorAll: (sel) => sel === 'a' ? anchorObjs : [],
     contains: (node) => anchorObjs.includes(node),
-    // classList / dataset stubs so makeMockTable-level code won't crash
+    // classList / dataset stubs so makeMockTable-level code will not crash
     classList: {
       _classes: [],
```

Reviewer: none. Reconciliation: applied as proposed.

#### H144

```diff
@@ -340,11 +340,8 @@ function makeMockButton() {
 
 // ---------------------------------------------------------------------------
-// Sprint layout-table-exclusion: isDataTable heuristic
+// isDataTable: the data test
 // ---------------------------------------------------------------------------
 //
-// isDataTable(table) returns true iff:
-//   - table.rows.length >= 2
-//   - at least one row has cells.length >= 2
-//   - at least one cell has numeric textContent (format marks and commas stripped + parseFloat + isFinite)
+// isDataTable(table) runs the data test; docs/vocabulary.md states the rule.
 //
 // Helper: build a minimal table stub for isDataTable.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H145

```diff
@@ -419,5 +416,5 @@ function withReactiveCreateTreeWalker(fn) {
 }
 
-// Issue #403, test page Table 21. A cell whose markup carries line breaks
+// Test page Table 21. A cell whose markup carries line breaks
 // and indentation around its text: the browser collapses them in the
 // rendered text the classifier reads, and the patch step counts positions in
```

Reviewer: none. Reconciliation: applied as proposed.

#### H146

```diff
@@ -433,5 +430,5 @@ function makePrettyPrintedCell(segments) {
 }
 
-// Issue #430: a native table's pure, date, and time cells take the same
+// A native table's pure, date, and time cells take the same
 // three steps as every other cell — classify, place, patch. A value whose
 // characters sit in one text piece rounds through the patch writer, with its
```

Reviewer: none. Reconciliation: applied as proposed.

#### H147

```diff
@@ -1302,5 +1299,5 @@ function makeE2EGridWrapper(rowData) {
   };
 
-  // Override wrapper querySelector so isTableRounded / syncSwitchForTable don't throw.
+  // Override wrapper querySelector so isTableRounded / syncSwitchForTable do not throw.
   grid.wrapperEl.querySelector = function(sel) {
     if (sel === '.dr-ext-rounded') {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H148

```diff
@@ -1440,5 +1437,5 @@ function makeOnScreenTable() {
 
 // =============================================================================
-// Sprint filter-pass1-native: Pass 1 guard skips phantom a11y tables
+// Pass 1 guard skips accessibility artifacts
 // =============================================================================
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H149

```diff
@@ -1447,5 +1444,5 @@ function makeOnScreenTable() {
 // createToggleForTable(table) only for the survivors.
 //
-// A toggle was created iff tableToggles.has(table) becomes true afterwards.
+// A pillbox was created iff tableToggles.has(table) becomes true afterwards.
 //
 // For each test we:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H150

```diff
@@ -1455,8 +1452,8 @@ function makeOnScreenTable() {
 //      createToggleForTable can run without errors.
 //   3. Reset tableToggles / trackedTables for each run by deleting entries we
-//      added (WeakMap doesn't expose a clear(), so we track which table objects
+//      added (WeakMap does not expose a clear(), so we track which table objects
 //      we inserted and delete them by re-using the objects).
 //
-// CRITICAL: phantom tables must pass isDataTable() so the only reason they
+// CRITICAL: accessibility artifacts must pass isDataTable() so the only reason they
 // would be skipped is the isPhantomA11yTable guard, not the isDataTable gate.
 // Real on-screen tables must fail isPhantomA11yTable but pass isDataTable.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H151

```diff
@@ -1513,5 +1510,5 @@ function makePass1DataTable(opts) {
 // Run injectTableToggles() with a controlled list of tables returned by
 // document.querySelectorAll('table'). Stubs away document.createElement and
-// document.body.appendChild so createToggleForTable doesn't throw in Node.
+// document.body.appendChild so createToggleForTable does not throw in Node.
 // Restores all globals afterwards. Returns { tables } (same array for inspection).
 function runPass1WithTables(tables) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H152

```diff
@@ -1566,5 +1563,5 @@ function runPass1WithTables(tables) {
   global.document.documentElement = { appendChild() {} };
 
-  // Reset toggleStyleInjected so ensureToggleStyleInjected doesn't try document.head
+  // Reset toggleStyleInjected so ensureToggleStyleInjected does not try document.head
   const origToggleStyleInjected = toggleStyleInjected;
   toggleStyleInjected = true; // skip style injection (would need document.head)
```

Reviewer: none. Reconciliation: applied as proposed.

#### H153

```diff
@@ -1584,5 +1581,5 @@ function runPass1WithTables(tables) {
 
 // Helper: clean up tableToggles / trackedTables for a list of table objects so
-// they don't pollute subsequent tests.
+// they do not pollute subsequent tests.
 function cleanupPass1Tables(tables) {
   for (const t of tables) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H154

```diff
@@ -1595,11 +1592,11 @@ function cleanupPass1Tables(tables) {
 
 // ---------------------------------------------------------------------------
-// Sprint loosen-pass2-aria: Pass 2 phantom-table gate in injectTableToggles
+// Pass 2 accessibility artifact guard in injectTableToggles
 // ---------------------------------------------------------------------------
 //
-// The spec change: Pass 2 now skips an ARIA grid ONLY when it contains at
-// least one REAL (non-phantom) <table>.  A grid that contains only phantom
-// a11y tables (aria-hidden, offscreen, or svg-chart-wrapped) must be picked up
-// by Pass 2 and get a toggle.
+// Pass 2 (the nomination step) skips an ARIA grid ONLY when it contains at
+// least one REAL <table>, one that is not an accessibility artifact. A grid
+// that contains only accessibility artifacts (aria-hidden, offscreen, or
+// svg-chart-wrapped) must be picked up by Pass 2 and get a pillbox.
 //
 // Helper: build a minimal ARIA grid element (div with role="grid" or role="table")
```

Reviewer: none. Reconciliation: applied as proposed.

#### H155

```diff
@@ -1659,5 +1656,5 @@ function makeAriaGrid(embeddedTables) {
 }
 
-// Helper: build a minimal phantom embedded table (aria-hidden on self → isPhantomA11yTable true)
+// Helper: build a minimal embedded accessibility artifact (aria-hidden on self → isPhantomA11yTable true)
 function makePhantomEmbeddedTable() {
   return makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H156

```diff
@@ -2277,11 +2274,11 @@ function makeCrowdedNest() {
 
 // ---------------------------------------------------------------------------
-// Issue #251: the sidebar mirrors the model's settings on any table switch.
+// The sidebar mirrors the model's settings on any table switch.
 // A shared harness (same eval shape as the reopen-bound test above, plus an
 // onMessage capture and a rangeExpr capture) drives sidebar.js's real
 // onMessage handler. The model holds enabled:false and a non-default
-// rangeExpr; each scenario first drifts the controls away from the model —
-// exactly what the old code left behind — then delivers the message under
-// test and asserts the panel snapped back to the model.
+// rangeExpr; each scenario first drifts the controls away from the model,
+// then delivers the message under test and asserts the sidebar snapped back
+// to the model.
 // ---------------------------------------------------------------------------
 function makeIssue251SidebarHarness() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H157

```diff
@@ -2300,5 +2297,5 @@ function makeIssue251SidebarHarness() {
       },
       // fire: drive a captured listener the way a real control event would —
-      // lets a test trigger sidebar.js's applyNow path (issue #272 tests).
+      // lets a test trigger sidebar.js's applyNow path.
       fire(type, evt) { (listeners[type] || []).forEach((fn) => fn(evt)); },
       removeEventListener() {},
```

Reviewer: none. Reconciliation: applied as proposed.

#### H158

```diff
@@ -2334,5 +2331,5 @@ function makeIssue251SidebarHarness() {
   // Memoized: sidebar.js grabs each control once at module level and attaches
   // listeners to it; a test must be able to reach that SAME element (via
-  // el(id) on the returned harness) to fire those listeners (issue #272).
+  // el(id) on the returned harness) to fire those listeners.
   const elsById = { status: statusEl, enabled: enabledEl, rangeExpr: rangeExprEl };
   const captureDoc = {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H159

```diff
@@ -2350,7 +2347,7 @@ function makeIssue251SidebarHarness() {
   // The model's settings differ from the shipped defaults on two controls,
   // so a handler that pulls is distinguishable from one that resets: after
-  // any refresh the panel must show enabled:false and rangeExpr 'B2:E8'.
+  // any refresh the sidebar must show enabled:false and rangeExpr 'B2:E8'.
   const modelSettings = Object.assign({}, DR_DEFAULTS, { enabled: false, rangeExpr: 'B2:E8' });
-  // The lock state the settings read answers with (#500); a test that
+  // The lock state the settings read answers with; a test that
   // changes it changes the next answer.
   const readAnswer = { locked: false };
```

Reviewer: none. Reconciliation: applied as proposed.

#### H160

```diff
@@ -2446,18 +2443,10 @@ function recentLogRows() {
 
 // ===========================================================================
-// One meaning for a pillbox press (2026-09-14 sidebar-state-removal, part one)
+// One meaning for a pillbox press
 // ===========================================================================
 //
-// A press made three different things happen, and which one it made happen
-// turned on a value the page could not keep true: whether the sidebar stood
-// open. Only the service worker could correct that value, and the correction
-// needed a tab number the service worker lost on an idle restart and on an
-// ordinary sidebar close. Once the value went stale, a press on a second
-// table silently became "move the sidebar here" for the rest of the page's
-// life. With the page-wide on/off value at off, such a press changed
-// no numbers at all, so the pillbox read as intermittent (#241).
-//
-// The rule now: a press makes the pressed table active and flips its form
-// from what the screen shows, writing the table's settings once.
+// The rule: a press makes the pressed table active and flips its form from
+// what the screen shows, writing the table's settings once. The press reads
+// nothing about the sidebar.
 //
 // A helper, because every case below needs the same two things reset: the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H161

```diff
@@ -2532,5 +2521,5 @@ function makeIsolatedModel() {
 
 // ---------------------------------------------------------------------------
-// Issue #325 — every cross-context topic on the event bus.
+// Every cross-context topic on the event bus.
 //
 // A shared sandbox harness for the bus tests below. adapters/messaging.js has
```

Reviewer: none. Reconciliation: applied as proposed.

#### H162

```diff
@@ -2631,5 +2620,5 @@ function withHiddenCellTreeWalker(cell, fn) {
 }
 
-// The worked example from the issue: a label column merged down over two rows,
+// A label column merged down over two rows,
 // and a total row merged across the first two columns.
 function makeMergedSpanTable() {
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/ladder.js`

#### H163

```diff
@@ -202,5 +202,5 @@
 })();
 
-// --- Identifier shapes (issue #426) ---
+// --- Identifier shapes ---
 //
 // A cell whose whole text is an identifier shape (a phone number, an IP
```

Reviewer: none. Reconciliation: applied as proposed.

#### H164

```diff
@@ -263,5 +263,5 @@ const IDENTIFIER_NEAR_MISSES = [
 })();
 
-// --- Identifier shapes inside text (issue #465) ---
+// --- Identifier shapes inside text ---
 //
 // Inside an extracted cell, a span matching an identifier shape holds its
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/messaging-model.js`

#### H165

```diff
@@ -65,5 +65,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint sidebar-settings-pull-and-unified-toggle (v1.12.0)
+// Sidebar settings pull and unified toggle
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H166

```diff
@@ -76,8 +76,7 @@
   const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
 
-  // --- Sprint app-model-settings inverted this pull: settings now live in
-  // DR_STORE (content-script context), so content.js applies from its own
-  // model instead of polling the sidebar, and the sidebar asks content.js
-  // for the current value instead of answering that old poll. ---
+  // --- Settings live in DR_STORE (content-script context), so content.js
+  // applies from its own model, and the sidebar asks content.js for the
+  // current value. ---
 
   eq('pull (inverted): content.js no longer sends GET_SIDEBAR_SETTINGS',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H167

```diff
@@ -117,13 +116,12 @@
     /data-rounded-value|dataset\.roundedValue/.test(contentSrc), false);
 
-  // app-model-registry sprint: native-table originals (html/value/supRanges/
-  // linkFilteredIdx) and the per-table round options moved off page
-  // attributes / a file-level WeakMap into DR_STORE's table registry — see
-  // the "table registry" test section below for the full replacement suite.
+  // Native-table originals (value/supRanges/linkFilteredIdx) and the
+  // per-table settings live in DR_STORE's table registry — see the "table
+  // registry" test section below for the full suite.
   eq('unified (superseded by app-model-registry): dataset.originalHtml is no longer written',
     /dataset\.originalHtml\s*=/.test(contentSrc), false);
 
-  // #421: both kinds record one shape through the registry port, and the
-  // native markup copy is gone.
+  // Both kinds record one shape through the registry port, with no markup
+  // copy.
   eq('registry: every cell\'s originals are recorded via DR_STORE.setTableOriginal, through the registry port',
     /set\(cellEl, record\)\s*\{\s*DR_STORE\.setTableOriginal\(table, cellEl, record\);/.test(contentSrc) &&
```

Reviewer: none. Reconciliation: applied as proposed.

#### H168

```diff
@@ -139,5 +137,5 @@
 
   eq('unified: the apply re-runs roundTable rather than replaying a cached value',
-    // Window sized for the locked-table refusal (issue #262) that sits
+    // Window sized for the locked-table refusal that sits
     // between the function head and the round call.
     /function applySidebarRounding[\s\S]{0,2200}roundTable\(/.test(contentSrc), true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H169

```diff
@@ -146,5 +144,5 @@
 
   withCreateTreeWalker(function() {
-    // Row contains a large number to anchor max_mag=3 so 35 doesn't get rounded
+    // Row contains a large number to anchor max_mag=3 so 35 does not get rounded
     // away from itself (35 with offset -0.5 → 35), AND a "35.0" cell that should
     // be re-formatted to "35".
```

Reviewer: none. Reconciliation: applied as proposed.

#### H170

```diff
@@ -191,6 +189,6 @@
 // Regression: test page Table 8, "Linked number in text". The cell reads
 // "See <a>ref 12</a>, total 9,850". The linked 12 holds and 9,850 rounds,
-// with no patch left unlanded. Before the fix the number scan took "12,"
-// as the match string: the link filter could not find it in one text node
+// with no patch left unlanded. A number scan that took "12," as the match
+// string would break both steps: the link filter could not find it in one text node
 // (the comma sits in the next node) and kept the linked number, and the
 // patch step found "12" where it expected "12," and skipped it, logging
```

Reviewer: none. Reconciliation: applied as proposed.

#### H171

```diff
@@ -222,6 +220,6 @@
         cell.classList.contains('dr-ext-rounded'), true);
       // The registry record holds the flat-text index of every match that
-      // survived the link filter. Without the fix the linked "12," survived
-      // too and this read [8, 18]; the log-row count below can miss that
+      // survived the link filter. A scan that kept the linked "12," would
+      // read [8, 18]; the log-row count below can miss that
       // when the 50-row buffer drops an older patch row on the same push.
       eq('table 8 linked reference: only the plain number survives the link filter',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H172

```diff
@@ -345,6 +343,6 @@
 
 // ---------------------------------------------------------------------------
-// Issue #251 (sync-on-switch): a switch with the sidebar open applies the
-// clicked table's own settings in the model (issue #328) — the sidebar then
+// Sync on switch: a switch with the sidebar open applies the
+// clicked table's own settings in the model — the sidebar then
 // mirrors them, and the table matches what the sidebar shows. Two cells: a
 // non-default offset reaches the new table's rounding pass, and a table
```

Reviewer: none. Reconciliation: applied as proposed.

#### H173

```diff
@@ -425,15 +423,15 @@
 })();
 
-// Switching onto a LOCKED table (issue #262): the clicked table carries a
+// Switching onto a LOCKED table: the clicked table carries a
 // dr-ext-rounded cell with no registry original, so the switch apply's
 // resetTable refuses. The pin here is the ORDER — state:tableSwitched must leave
 // before state:applyBlocked, because the sidebar lifts the PREVIOUS table's lock
 // on state:tableSwitched and the new table's state:applyBlocked must land after that
-// lift to re-lock the panel. A send moved after the apply would leave a
-// stuck table showing an unlocked panel with nothing failing.
+// lift to re-lock the sidebar. A send moved after the apply would leave a
+// unrestorable table showing an unlocked sidebar with nothing failing.
 //
-// The intent is published straight onto the bus: the view refuses clicks on
-// a locked pill (issue #263's aria-disabled guard), but a table can become
-// unrestorable between pill syncs, so the controller's own entry point must
+// The intent is published straight onto the bus: the view ignores clicks on
+// a locked pillbox (its aria-disabled guard), but a table can become
+// unrestorable between pillbox syncs, so the controller's own entry point must
 // hold the order on its own.
 (function issue251_switchOntoLockedTablePinsMessageOrder() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H174

```diff
@@ -552,5 +550,5 @@
 })();
 
-// Issue #423: a cell the page redrew with fewer pieces is a rewritten cell.
+// A cell the page redrew with fewer pieces is a rewritten cell.
 // The restore keeps the page's text in it and drops its record and marker,
 // so nothing counts unrestorable and the table never locks over it.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H175

```diff
@@ -597,5 +595,5 @@
     // The page changes the piece's text in place. The piece shows neither
     // its original nor its written text, so the cell is a rewritten cell and
-    // simplifies the page's value fresh (#421).
+    // simplifies the page's value fresh.
     b.childNodes[0].nodeValue = ' 7,318,204.5 ';
     reapplyRounding(grid.wrapperEl);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H176

```diff
@@ -736,5 +734,5 @@
 // ---------------------------------------------------------------------------
 (function e2e_gr4_extractedModeSkippedOnGrid() {
-  // Two rows so simplifyFirstRow:false (default) doesn't exclude everything.
+  // Two rows so simplifyFirstRow:false (default) does not exclude everything.
   // Row 0: skipped (simplifyFirstRow:false).
   // Row 1: mixed-text cell → extracted mode → skipped on grid;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H177

```diff
@@ -839,8 +837,6 @@
 // GV8: Exclusion-gate parity — re-apply HONORS firstRow / firstColumn gates.
 //
-// Regression guard for the BLOCK: before the fix, reapplyRounding recomputed
-// max_mag over an unfiltered cell set and wrote excluded cells.  After the fix
-// (computeGridRoundedValues shared path), excluded cells get no patches and
-// are never written.
+// Excluded cells get no patches and are never written by reapplyRounding,
+// and the max magnitude comes from the filtered cell set.
 //
 // Grid layout (2 rows × 2 cols):
```

Reviewer: none. Reconciliation: applied as proposed.

#### H178

```diff
@@ -1049,5 +1045,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint pending-retest: a grid that arrives before its rows registers when
+// A grid that arrives before its rows registers when
 // the rows arrive.
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.4 and the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H179

```diff
@@ -1350,5 +1346,5 @@ const PENDING_FILL_ROWS = [
 // --- Adversarial: a re-test that finds the depth crowded ends the record ---
 //
-// A crowded nest registers nothing, by the product decision in issue #373, and
+// A crowded nest registers nothing, by product decision, and
 // it registers nothing on every later re-test for the same reason. Holding the
 // record would leave an observer re-testing a shape whose answer cannot change
```

Reviewer: none. Reconciliation: applied as proposed.

#### H180

```diff
@@ -1442,5 +1438,5 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-selection: the application model (app/store.js, DR_STORE)
+// The application model (app/store.js, DR_STORE)
 // and the typed event bus (adapters/messaging.js, DR_BUS). The selected
 // table and the sidebar-open flag moved out of content.js's file-level lets
```

Reviewer: none. Reconciliation: applied as proposed.

#### H181

```diff
@@ -1470,6 +1466,6 @@ const PENDING_FILL_ROWS = [
   // --- (a) discipline: DR_BUS.TOPICS enumerates every topic with a family,
   // and no topic falls outside the two families. ---
-  // Issue #325 added the third family, request: a topic whose one responder
-  // returns an answer to the publisher.
+  // The third family, request: a topic whose one responder returns an
+  // answer to the publisher.
   const KNOWN_FAMILIES = ['intent', 'state-change', 'request'];
   const topics = DR_BUS.TOPICS;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H182

```diff
@@ -1487,9 +1483,9 @@ const PENDING_FILL_ROWS = [
      'request:applySettings', 'request:settings', 'request:previewSamples',
      'request:captureState',
-     // The service worker's four, plus the two it receives (#325).
+     // The service worker's four, plus the two it receives.
      'intent:menuClicked', 'state:sidebarOpened', 'intent:closeSidebar',
      'state:sidebarClosed', 'state:pageUnloaded', 'intent:updateMenuLabel',
      // The content script's eight reports to the sidebar, the settings
-     // notice among them (issue #328).
+     // notice among them.
      'state:settingsChanged', 'state:tableActivated', 'state:tableSwitched',
      'state:rangeError', 'state:rangeOk', 'state:applyBlocked', 'state:applyOk',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H183

```diff
@@ -1526,5 +1522,5 @@ const PENDING_FILL_ROWS = [
   eq('DR_BUS.TOPICS: intent:selectTable is in the intent family',
     topics['intent:selectTable'].family, 'intent');
-  // Sprint toggle-split: the toggle view's click handler changes no table
+  // The toggle view's click handler changes no table
   // itself — it publishes intent:toggleTable, and content.js (the sole
   // subscriber) determines what a committed toggle does.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H184

```diff
@@ -1533,8 +1529,7 @@ const PENDING_FILL_ROWS = [
   eq('DR_BUS.TOPICS: state:selectedTableChanged is in the state-change family',
     topics['state:selectedTableChanged'].family, 'state-change');
-  // The sidebar's settings apply. It carried the intent family and the
-  // request:applySettings name on the wire until issue #325; the content
-  // script always answered it, and the sidebar always read whether anyone
-  // answered to decide bound versus unbound, so it is a request.
+  // The sidebar's settings apply. The content script answers it, and the
+  // sidebar reads whether anyone answered to determine bound versus unbound,
+  // so it is a request.
   eq('DR_BUS.TOPICS: request:applySettings is in the request family',
     topics['request:applySettings'].family, 'request');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H185

```diff
@@ -1584,8 +1579,6 @@ const PENDING_FILL_ROWS = [
 
     // No message is replayed here on purpose — a reconnecting view pulls,
-    // it does not listen for what it missed. The store carried a third
-    // field, "the sidebar is open", until the 2026-09-14 sidebar-state-
-    // removal design retired it (#241); what a reopen pulls is the
-    // selection. The settings live on each table (issue #328), so the
+    // it does not listen for what it missed. What a reopen pulls is the
+    // active table. The settings live on each table, so the
     // snapshot carries no page-wide settings.
     const snapshot = DR_STORE.getSnapshot();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H186

```diff
@@ -1635,7 +1628,6 @@ const PENDING_FILL_ROWS = [
   // SURVIVING top-level bindings. It has a blind spot — a name that moved OUT
   // of content.js into DR_STORE (selectedTable) is invisible to
-  // that scan once it is gone from content.js's own declaration list, so a
-  // file that reintroduces a bare assignment to that name (exactly the old
-  // anti-pattern this sprint removed) would slip through undetected. Close
+  // that scan, so a file that reintroduces a bare assignment to that name
+  // would slip through undetected. Close
   // that gap by scanning for writes to DR_STORE's own private field names,
   // read directly from app/store.js rather than from content.js.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H187

```diff
@@ -1645,5 +1637,5 @@ const PENDING_FILL_ROWS = [
   // anywhere in the file) is what keeps this from also matching the `const
   // entry = ...` locals declared inside the table-registry getters/setters
-  // (app-model-registry sprint) — those are per-call temporaries, not fields.
+  // — those are per-call temporaries, not fields.
   const storeFieldNames = Array.from(storeSrc.matchAll(/^ {2}(?:let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm))
     .map((m) => m[1])
```

Reviewer: none. Reconciliation: applied as proposed.

#### H188

```diff
@@ -1662,5 +1654,5 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint toggle-split: publishing intent:toggleTable is content.js's only
+// Publishing intent:toggleTable is content.js's only
 // path to running a press — prove the wiring end to end (mirrors the
 // intent:selectTable behavioral pin in the app-model-selection block above).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H189

```diff
@@ -1675,7 +1667,5 @@ const PENDING_FILL_ROWS = [
   injectToggleEntry(table);
 
-  // The press writes the table's settings and moves the active table now
-  // (2026-09-14 sidebar-state-removal, part one), where the retired
-  // plain-toggle path wrote neither. The active table is shared model
+  // The press writes the table's settings and moves the active table. The active table is shared model
   // state, so this test saves and restores it rather than leaving it for
   // whatever runs next.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H190

```diff
@@ -1708,14 +1698,10 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint toggle-split: KNOWN BUG FIX — flashRangePulse used to read
-// table.rows/row.cells directly, which only exist on native <table>
-// elements. On a div-based grid Array.from(undefined) threw a TypeError,
-// aborting the caller mid-flow (reverting the fix crashes this suite rather
-// than failing an assertion). flashRangePulse now enumerates cells through the same TableAdapter
-// (makeAdapter) the rounding engine and preview already use, so a grid's
-// cells are found the same way a native table's are. This test fails
-// without the fix: matchedCells.length would be 0 for the grid case below,
-// and the (missing/whole-grid) fallback flash would not carry the
-// range-restricted geometry asserted here.
+// flashRangePulse enumerates cells through the same TableAdapter
+// (makeAdapter) the rounding engine and preview use, so a grid's cells are
+// found the same way a native table's are. Reading table.rows/row.cells
+// directly, which only exist on native <table> elements, would throw a
+// TypeError on a div-based grid and crash this suite rather than fail an
+// assertion.
 // ---------------------------------------------------------------------------
 (function toggleSplit_rangeFlashWorksOnGrids() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H191

```diff
@@ -1771,23 +1757,15 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint toggle-split (adversarial hardening): CLICK-HANDLER PARENT-EQUIVALENCE
-// PIN across the full guard matrix. The consolidation claims that collapsing
-// ui-toggle.js's two inlined click branches (mouse/keyboard, touch second-tap)
-// down to one `DR_BUS.publish('intent:toggleTable', { table })` line each,
-// with content.js's new intent:toggleTable subscriber running the same
-// guarded body both branches used to run inline, produces the identical
-// observable chrome.runtime.sendMessage sequence as before. This pin proves
-// that claim across {same table, different table} x {sidebar open, closed},
-// for both click branches — not just that a guard's boolean outcome matches
-// (the AC1-AC4 rebind tests above already cover that), but that the ORDER
-// and full contents of every dispatched message are unchanged.
+// CLICK-HANDLER PARENT-EQUIVALENCE
+// PIN across the full guard matrix. ui-toggle.js's two click branches
+// (mouse/keyboard, touch second-tap) each publish one
+// `DR_BUS.publish('intent:toggleTable', { table })`, and content.js's
+// intent:toggleTable subscriber runs the press. This pin checks
+// {same table, different table} for both click branches — not just that a
+// guard's boolean outcome matches (the AC1-AC4 rebind tests above already
+// cover that), but the ORDER and full contents of every dispatched message.
 //
-// The expected sequences below are LITERALS captured by running the REAL
-// click handler from both this sprint's parent (refactor/app-model-selection,
-// the last commit with the guard/dispatch logic inlined per click branch in
-// ui-toggle.js) and HEAD against this same fixture and harness, and verified
-// byte-identical at review time. Frozen here rather than re-derived via
-// `git show` at test-run time, matching the rationale in commit 394afa7: a
-// shallow checkout or CI runner may not have the parent ref available.
+// The expected sequences below are LITERALS, so the pin holds in a shallow
+// checkout or CI runner.
 // ---------------------------------------------------------------------------
 (function toggleSplit_parentEquivalence_toggleClickSequences() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H192

```diff
@@ -1797,13 +1775,9 @@ const PENDING_FILL_ROWS = [
   // assertions below, which check mouse and touch against the same literal.
   //
-  // The matrix used to carry a second dimension, whether the sidebar stood
-  // open, and four cells. The 2026-09-14 sidebar-state-removal design
-  // retired the value that dimension varied (#241), and with it the branch
-  // that read it — a press means one thing now, so the two surviving cells
-  // are the whole matrix.
+  // A press reads nothing about the sidebar, so these two cells are the
+  // whole matrix.
   const EXPECTED_SEQUENCES = {
-    // A press on the ACTIVE table. Issue #272 put the settings write at the
-    // front of this path, and issue #328 put it on the pressed table: the
-    // write's settings notice leads the sequence, carrying the flipped
+    // A press on the ACTIVE table. The settings write comes first and lands
+    // on the pressed table: the write's settings notice leads the sequence, carrying the flipped
     // enabled to the sidebar, and the apply that follows sends its own
     // state:applyOk.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H193

```diff
@@ -1815,9 +1789,6 @@ const PENDING_FILL_ROWS = [
       { action: 'intent:updateMenuLabel', title: 'Toggle table' },
     ],
-    // A press on a table that is NOT the active one. Issue #251 made this
-    // path apply settings to the pressed table in place of simplifying it
-    // with the shipped defaults, and issue #328 made those the pressed
-    // table's own. The sidebar-state removal made it the only meaning such a
-    // press has, whatever the sidebar is doing.
+    // A press on a table that is NOT the active one applies the pressed
+    // table's own settings to it, whatever the sidebar is doing.
     //
     // state:tableSwitched leads so the sidebar lifts the previous table's lock
```

Reviewer: none. Reconciliation: applied as proposed.

#### H194

```diff
@@ -1883,5 +1854,5 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-selection (adversarial hardening): statelessness. The bus
+// Statelessness. The bus
 // keeps no last-value cache and no delivery history (see adapters/messaging.js
 // header) — a subscriber that attaches AFTER a publish must never see that
```

Reviewer: none. Reconciliation: applied as proposed.

#### H195

```diff
@@ -1910,5 +1881,5 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-selection (adversarial hardening): reentrancy. Same-context
+// Reentrancy. Same-context
 // delivery is synchronous (see adapters/messaging.js header), so a subscribed
 // handler may itself call DR_BUS.publish() for a different topic before
```

Reviewer: none. Reconciliation: applied as proposed.

#### H196

```diff
@@ -1918,9 +1889,7 @@ const PENDING_FILL_ROWS = [
 // ---------------------------------------------------------------------------
 (function appModelSelection_busReentrancy_twoTopicCycleSettles() {
-  // The second topic was state:sidebarOpenChanged until the 2026-09-14
-  // sidebar-state-removal design retired it (#241). state:settingsChanged
-  // takes its place: the content script holds no subscriber of its own for
-  // it (issue #328), so only the fixture's handlers run here. What the test
-  // measures — the bus's own delivery under a nested publish — is unchanged.
+  // The second topic is state:settingsChanged: the content script holds no
+  // subscriber of its own for it, so only the fixture's handlers run here.
+  // The test measures the bus's own delivery under a nested publish.
   const TOPIC_A = 'state:selectedTableChanged';
   const TOPIC_B = 'state:settingsChanged';
```

Reviewer: none. Reconciliation: applied as proposed.

#### H197

```diff
@@ -1957,5 +1926,5 @@ const PENDING_FILL_ROWS = [
 
 // =============================================================================
-// Sprint app-model-registry: the registry of found tables, per-cell originals,
+// The registry of found tables, per-cell originals,
 // and the simplified/original flag live in DR_STORE; the dr-ext-grid marker
 // class becomes a style hook only.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H198

```diff
@@ -2040,9 +2009,7 @@ const PENDING_FILL_ROWS = [
 // exact original text and then to the exact same simplified text.
 //
-// The off step used to keep the registry's stored original and re-round from
-// it. The 2026-09-14 sidebar-state-removal design retired that form flip
-// (#241): off resets, which clears the record, and the re-simplify reads the
+// Off resets, which clears the record, and the re-simplify reads the
 // restored cell and writes a fresh record. The assertions read what the user
-// sees, which is unchanged. The record's lifetime changes with it. ---
+// sees. ---
 (function registrySprint_originalsSurviveOffAndOnCycle() {
   withCreateTreeWalker(function () {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H199

```diff
@@ -2092,8 +2059,5 @@ const PENDING_FILL_ROWS = [
 })();
 
-// --- (f) Grid magnitude basis freeze: DELIBERATE BEHAVIOR CHANGE from the
-// parent branch (refactor/app-model-settings), where computeGridRoundedValues
-// took no frozenMaxMag parameter and reapplyRounding recomputed max_mag
-// from whatever was visible on every scroll re-apply. HEAD's roundTable
+// --- (f) Grid magnitude basis freeze: roundTable
 // freezes max_mag on first sight into DR_STORE.setTableMaxMagnitude and every
 // later reapplyRounding reuses that frozen value (see the frozenMaxMag
```

Reviewer: none. Reconciliation: applied as proposed.

#### H200

```diff
@@ -2149,11 +2113,8 @@ const PENDING_FILL_ROWS = [
 // whatever is visible at the moment of the second press — it does NOT
 // preserve the basis established by the first round. This is the registry's
-// actual behavior (#257), documented here so a reviewer can judge whether
+// actual behavior, documented here so a reviewer can judge whether
 // "frozen at first sight" was meant to survive a round trip.
 //
-// The round trip used to run through a form flip that kept the table's
-// markers. The 2026-09-14 sidebar-state-removal design retired that flip
-// (#241) in favor of a reset, and both clear the frozen basis the same way,
-// so the behavior under test is unchanged — only the driver is. ---
+// The round trip runs through a reset, which clears the frozen basis. ---
 (function registrySprint_offAndOnRoundTripReFreezesRatherThanPreserving() {
   let ctx;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H201

```diff
@@ -2207,11 +2168,9 @@ const PENDING_FILL_ROWS = [
 })();
 
-// --- (g) settings notice sequence: isTableRounded (claim 4 — now reading
-// DR_STORE's appliedFlag instead of a dr-ext-rounded/dataset.drShowingOriginal
-// pair) must report correctly to the sidebar across a full round -> peek-
-// original -> peek-back cycle, not just a single toggle. The pillbox-sprint
-// AC1 test above pins one click; the toggle-split parent-equivalence guard
-// matrix pins one intent:toggleTable dispatch. Neither exercises the 3-step
-// peek cycle this sprint's registry model actually has to get right. ---
+// --- (g) settings notice sequence: isTableRounded (reading DR_STORE's
+// appliedFlag) must report correctly to the sidebar across a full round ->
+// peek-original -> peek-back cycle, not just a single toggle. The pillbox
+// AC1 test above pins one click; the guard matrix pins one
+// intent:toggleTable dispatch. Neither exercises the 3-step peek cycle. ---
 (function registrySprint_tableToggleStateAcrossPeekCycle() {
   const savedSelected = DR_STORE.getSelectedTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H202

```diff
@@ -2310,5 +2269,5 @@ const PENDING_FILL_ROWS = [
 })();
 
-// --- Sprint shape-fingerprint: the registry's fingerprint field. The entry
+// --- The registry's fingerprint field. The entry
 // carries the shape the table had when it registered, and the pillbox view's
 // builder is its one writer. Spec: the shape-fingerprint block in
```

Reviewer: none. Reconciliation: applied as proposed.

#### H203

```diff
@@ -2480,5 +2439,5 @@ const PENDING_FILL_ROWS = [
 })();
 
-// Issue #506: the page removing the active table clears the active table and
+// The page removing the active table clears the active table and
 // tells the sidebar to re-read, so the sidebar shows the no-table state
 // instead of describing a table that is gone. Removing any other table leaves
```

Reviewer: none. Reconciliation: applied as proposed.

#### H204

```diff
@@ -2548,5 +2507,5 @@ const PENDING_FILL_ROWS = [
 })();
 
-// --- Sprint shape-fingerprint: the teardown both the removal observer and the
+// --- The teardown both the removal observer and the
 // mismatch path run. One function discards a table's registration and every
 // per-table resource the extension holds beside it: the pillbox, the resize
```

Reviewer: none. Reconciliation: applied as proposed.

#### H205

```diff
@@ -2607,5 +2566,5 @@ const PENDING_FILL_ROWS = [
 })();
 
-// --- Sprint pending-retest, criterion 4: a pending container removed from the
+// --- Criterion 4: a pending container removed from the
 // page leaves no observer and no timer.
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md, the pending-retest
```

Reviewer: none. Reconciliation: applied as proposed.

#### H206

```diff
@@ -2733,16 +2692,10 @@ const PENDING_FILL_ROWS = [
 // ---------------------------------------------------------------------------
 // A pillbox press on the active table writes the table's settings (its
-// enabled), not just the table's cells and the sidebar's switch. Issue #272,
-// leak 1: content.js's same-table intent:toggleTable branch used to simplify
-// the table and send the sidebar its on/off value without writing the
-// settings, so any later pull (a sidebar reopen or a table switch) showed a
-// stale enabled over the table's truth, and a reopen-style apply silently
-// re-rounded a table the user had toggled off.
+// enabled), not just the table's cells and the sidebar's switch. A press
+// that changed the cells without writing the settings would leave any later
+// pull (a sidebar reopen or a table switch) showing a stale enabled over the
+// table's truth.
 //
-// One press path covers the sidebar open and the sidebar closed alike. An
-// earlier gate read sidebar visibility to pick between the settings path and
-// a direct one, so a press made with the sidebar closed changed the page
-// without changing the settings, and the next open re-imposed the stale
-// settings. The 2026-09-14 sidebar-state-removal design retired that gate, so
+// One press path covers the sidebar open and the sidebar closed alike, so
 // this one test covers both cases. The settings notice goes out either way: a
 // closed sidebar has no page to receive it.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H207

```diff
@@ -2774,5 +2727,5 @@ const PENDING_FILL_ROWS = [
 
     withCreateTreeWalker(function () {
-      DR_BUS.publish('intent:toggleTable', { table }); // pill: turn rounding on
+      DR_BUS.publish('intent:toggleTable', { table }); // pillbox: turn rounding on
     });
     eq('leak-1: the first pill toggle rounds the connected table',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H208

```diff
@@ -2782,5 +2735,5 @@ const PENDING_FILL_ROWS = [
 
     withCreateTreeWalker(function () {
-      DR_BUS.publish('intent:toggleTable', { table }); // pill: turn rounding off
+      DR_BUS.publish('intent:toggleTable', { table }); // pillbox: turn rounding off
     });
     eq('leak-1: the second pill toggle restores the table to originals',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H209

```diff
@@ -2807,9 +2760,7 @@ const PENDING_FILL_ROWS = [
 
 // A press on a table that is NOT the active one moves the active table to it
-// and writes the pressed table's settings. This pinned the opposite, because a
-// third press path handled that case: the press kept the active table where
-// it was and left the settings alone. The 2026-09-14 sidebar-state-removal
-// design retired that path (#241). A press means one thing, so it makes the
-// pressed table active and writes its settings, whatever the sidebar is doing.
+// and writes the pressed table's settings. A press means one thing, so it
+// makes the pressed table active and writes its settings, whatever the
+// sidebar is doing.
 (function pressOnInactiveTableMovesTheActiveTableAndWritesItsSettings() {
   runPressFixture(() => {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H210

```diff
@@ -2832,8 +2783,8 @@ const PENDING_FILL_ROWS = [
 })();
 
-// --- The defect's own symptom. The pressed table's settings stand at off and
-// the press lands on a table that is not the active one. Before the fix this
-// took the rebind path and applied the settings, which at off changed no
-// numbers. The user pressed an on/off control and nothing moved. ---
+// --- The pressed table's settings stand at off and the press lands on a
+// table that is not the active one. The press must turn the table on: a press
+// that only re-applied the settings at off would change no numbers, and the
+// user would press an on/off control and see nothing move. ---
 (function partOne_pressOnInactiveTableSimplifiesEvenWithItsSettingsOff() {
   runPressFixture(({ sent }) => {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H211

```diff
@@ -2921,5 +2872,5 @@ const PENDING_FILL_ROWS = [
 
 // --- A range expression the parser rejects stops the apply before any cell
-// changes. Each table holds its own expression (issue #328), so a moved press
+// changes. Each table holds its own expression, so a moved press
 // applies the pressed table's own, and an unparsable expression on another
 // table never reaches it. ---
```

Reviewer: none. Reconciliation: applied as proposed.

#### H212

```diff
@@ -2976,10 +2927,7 @@ const PENDING_FILL_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Issue #328: each table's own settings are the only settings.
+// Each table's own settings are the only settings.
 //
-// The application model held one page-wide set of settings beside each
-// table's settings. The sidebar read and wrote the page-wide set, so it could
-// describe settings that did not produce the table on the screen, and going
-// back to a table could not bring back its settings. The rule now: every
+// The rule: every
 // sidebar change writes the active table's settings, the settings read answers
 // with them, and a table with none starts from the shipped defaults.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H213

```diff
@@ -2998,5 +2946,5 @@ function issue328SettingsOf(table) {
 }
 
-// The issue's five steps: simplify A heavy, make B active and change it to
+// Five steps: simplify A heavy, make B active and change it to
 // light, make A active again, then change A.
 (function issue328_twoTablesKeepTheirOwnSettings() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H214

```diff
@@ -3150,5 +3098,5 @@ function issue328SettingsOf(table) {
 
 // The settings read carries the active table's lock state, so the sidebar
-// learns the lock whenever it reads (#500). A table is locked while a cell
+// learns the lock whenever it reads. A table is locked while a cell
 // shows the simplified marker and the registry holds no original for it. The
 // read changes nothing on the page.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H215

```diff
@@ -3252,5 +3200,5 @@ function issue328SettingsOf(table) {
 
 // ---------------------------------------------------------------------------
-// Sprint shape-fingerprint: the comparison at the two controller entry points
+// The comparison at the two controller entry points
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.6 and the
 // shape-fingerprint block in §5; decision D7 in
```

Reviewer: none. Reconciliation: applied as proposed.

#### H216

```diff
@@ -3271,5 +3219,5 @@ function issue328SettingsOf(table) {
 //     counts as a match.
 //   - The fresh table is a new table: it reads the shipped defaults and shows
-//     raw (issue #328).
+//     raw.
 //
 // Every expected value below comes from that statement, never from the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H217

```diff
@@ -3964,6 +3912,6 @@ function issue328SettingsOf(table) {
 // in separate nodes — displays all of them. findCellTextNode answers with one
 // deepest text node (the write path's patch target); the displayed-text read
-// answers with the cell's whole text, matching the native read. Regression
-// for #303: "1,234<span>%</span>" recorded text: "%".
+// answers with the cell's whole text, matching the native read:
+// "1,234<span>%</span>" must not record the text "%".
 (function captureDisplayedTextReadsWholeCell() {
   const makePort = () => {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H218

```diff
@@ -4086,5 +4034,5 @@ function issue328SettingsOf(table) {
 // --- capture follow-ups: the pull guard, the glyph pin, the header line ---
 
-// #305: the serializer guards per table; the response composer's
+// The serializer guards per table; the response composer's
 // lens-preview step is the one step after it that walks the bound table.
 // Unguarded, a throw there discards the whole page-side half — the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H219

```diff
@@ -4208,8 +4156,7 @@ function issue328SettingsOf(table) {
 // The bus's topic table is the one declaration of every topic name.
 //
-// A name written out again at a call site is the defect the shared list was
-// built to remove: one mistyped character produced a message no listener
-// matched, with no error and no log row. The list retired into the bus's
-// table, and the bus builds every wire message itself, so no context file
+// A name written out again at a call site risks a mistyped character, which
+// produces a message no listener matches, with no error and no log row. The
+// bus builds every wire message itself from its table, so no context file
 // needs a name of its own. These pin both halves.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H220

```diff
@@ -4244,5 +4191,5 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 1: the topic table carries a route ---
+// --- The topic table carries a route ---
 (function busTableCarriesRoute() {
   const VALID_ROUTES = [null, 'extension-pages', 'tab'];
```

Reviewer: none. Reconciliation: applied as proposed.

#### H221

```diff
@@ -4265,11 +4212,11 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 1: the route picks the carrier, not the publishing context ---
+// --- The route picks the carrier, not the publishing context ---
 (function busRoutePicksCarrier() {
-  // The old transport sniff inferred the carrier from which Chrome interface
-  // the publishing context held. The route no longer lets it.
+  // The carrier never follows from which Chrome interface the publishing
+  // context holds.
 
   // A tab-routed topic with no explicit tab number: the bus runs the active-tab
-  // lookup the sidebar used to repeat before each of its own sends. The payload
+  // lookup. The payload
   // here is the bus's contract under test, not the topic's production payload —
   // the menu click carries none.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H222

```diff
@@ -4314,6 +4261,6 @@ function issue328SettingsOf(table) {
 
   // An extension-pages publish from a context with no chrome.tabs reaches its
-  // audience: that carrier needs none. This is the case the sniff got wrong —
-  // it read the absent interface as a reason to pick the other carrier.
+  // audience: that carrier needs none. An absent interface is no reason to
+  // pick the other carrier.
   const g = makeBusSandbox({ noTabs: true });
   g.bus.publish('state:pageUnloaded', {});
```

Reviewer: none. Reconciliation: applied as proposed.

#### H223

```diff
@@ -4328,10 +4275,10 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #340: publish() refuses a request topic rather than dropping its answer ---
+// --- publish() throws on a request topic rather than dropping its answer ---
 //
-// The ask refuses a topic recorded one-way and the answering registration
-// refuses a topic recorded as a question. The one-way send had no matching
-// refusal: handed a question it sent the message, the responder answered, and
-// the answer went nowhere, with nothing logged and nothing failed.
+// The ask throws on a topic recorded one-way and the answering registration
+// throws on a topic recorded as a question. The one-way send throws too:
+// handed a question, it would send the message, the responder would answer,
+// and the answer would go nowhere, with nothing logged and nothing failed.
 (function busPublishRefusesRequestTopic() {
   const a = makeBusSandbox();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H224

```diff
@@ -4348,5 +4295,5 @@ function issue328SettingsOf(table) {
     a.sent.pages.length + a.sent.tabs.length, 0);
 
-  // The two siblings, unchanged: each of the three pairings now refuses.
+  // The two siblings: each of the three pairings throws.
   const b = makeBusSandbox();
   let askThrew = false;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H225

```diff
@@ -4358,12 +4305,11 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 2: a subscriber learns the sending tab ---
+// --- A subscriber learns the sending tab ---
 //
 // The service worker's page-unload handler reads the sending tab's number off
 // Chrome's sender record and acts only when that tab is the one the sidebar
-// was opened for. The bus handed subscribers the payload alone, and a payload
-// cannot carry the number — a content script does not hold its own. Without
-// this argument, moving that topic onto the bus would close the sidebar on a
-// page unload in any tab.
+// was opened for. A payload cannot carry the number — a content script does
+// not hold its own. Without this argument, the bus would close the sidebar
+// on a page unload in any tab.
 (function busSubscriberReceivesSenderTab() {
   const a = makeBusSandbox();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H226

```diff
@@ -4399,5 +4345,5 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 3: request and respond ---
+// --- Request and respond ---
 (function busRequestReplyRoundTrip() {
   // The asking side: the answer chrome hands back reaches the callback.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H227

```diff
@@ -4556,10 +4502,8 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 5: the settings apply is a request, not a publish ---
+// --- The settings apply is a request, not a publish ---
 //
-// It always carried a reply. The sidebar never read the reply's value, only
-// whether anyone answered, and the bus served that through a second reply
-// shape — a delivery-outcome callback beside the answer path. Two reply shapes
-// in one component is the clutter issue #325 exists to remove.
+// The sidebar never reads the reply's value, only whether anyone answered,
+// and the bus serves that through its one reply path.
 (function settingsApplyUsesRequestPath() {
   const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H228

```diff
@@ -4599,10 +4543,9 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 12: one mechanism, one topic list ---
+// --- One mechanism, one topic list ---
 //
-// The end state of the move. Two delivery mechanisms carried the eighteen
-// cross-context topics; one carries all of them now. These pin the four facts
-// that make that true, so a new raw send or a second listener fails here
-// rather than reintroducing the split.
+// One delivery mechanism carries every cross-context topic. These pin the
+// four facts that make that true, so a new raw send or a second listener
+// fails here.
 (function oneMechanismRemains() {
   const contentSrc = sourceByName('content.js');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H229

```diff
@@ -4639,8 +4582,8 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325 Task 12: the moved responders answer through the bus ---
+// --- The responders answer through the bus ---
 //
 // The preview-samples branch carries a rule the source assertions above
-// cannot see: with no table selected it answers a pair of nulls rather than
+// cannot see: with no table active it answers a pair of nulls rather than
 // nothing, because the sidebar reads a null samples field as the unbound
 // state. This drives the content script's own bus listener the way Chrome
```

Reviewer: none. Reconciliation: applied as proposed.

#### H230

```diff
@@ -4699,11 +4642,10 @@ function issue328SettingsOf(table) {
 })();
 
-// --- #325: a moved topic is deliverable inside the context that publishes it ---
+// --- A cross-context topic is deliverable inside the context that publishes it ---
 //
 // publish() hands the topic to same-context subscribers before it reaches the
 // carrier. Every topic here crosses contexts, so one context publishing a topic
-// it also subscribes to would run its own handler on the way out — a delivery
-// the old inline listeners could not make, because a context never received its
-// own send. No topic pairs that way today, and this fails at the commit if one
+// it also subscribes to would run its own handler on the way out. No topic
+// pairs that way today, and this fails at the commit if one
 // starts to.
 (function noContextPublishesWhatItSubscribes() {
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/number.js`

#### H231

```diff
@@ -310,5 +310,5 @@ eq('extract: comma after the first number is left out of the match',
 })();
 
-// --- Splice safety: rounding doesn't affect later match indices because we go right-to-left ---
+// --- Splice safety: rounding does not affect later match indices because we go right-to-left ---
 (function spliceSafety() {
   // Numbers that change length when rounded: 8,584,629 (9 chars) -> 8,500,000 (9 chars, same).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H232

```diff
@@ -359,5 +359,5 @@ eq('pure cell write: parens-negative preserved',
   writePureCell(-500, '(523)'), '(500)');
 
-// --- Sprint A: exclusion checkboxes ---
+// --- Exclusion checkboxes ---
 
 eq('isDateLike: bare 4-digit year', isDateLike('2018'), true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H233

```diff
@@ -409,5 +409,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 
 (function exclusionDates() {
-  // Dates/times are no longer exclusion reasons — getExclusionReason never returns
+  // Dates and times are not exclusion reasons — getExclusionReason never returns
   // 'dates' or 'times' regardless of simplifyDates/simplifyTimes setting.
   const opts = { simplifyDates: true };
```

Reviewer: none. Reconciliation: applied as proposed.

#### H234

```diff
@@ -421,5 +421,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 
 (function exclusionTimes() {
-  // Times are no longer an exclusion reason — simplifyTimes only controls the
+  // Times are not an exclusion reason — simplifyTimes only controls the
   // classification pass, not getExclusionReason.
   eq('exclude: time cell with simplifyTimes=true is NOT excluded (returns null)',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H235

```diff
@@ -453,5 +453,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 })();
 
-// --- Sprint sidebar-restructure: simplifyFirstRow ---
+// --- simplifyFirstRow ---
 
 (function simplifyFirstRowTests() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H236

```diff
@@ -473,5 +473,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 })();
 
-// --- Sprint sidebar-restructure: simplifyMixedCells semantics ---
+// --- simplifyMixedCells semantics ---
 
 (function simplifyMixedCellsTests() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H237

```diff
@@ -511,5 +511,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 })();
 
-// --- Sprint sidebar-restructure: simplifyMixedPercent / simplifyMixedCurrency round-trip ---
+// --- simplifyMixedPercent / simplifyMixedCurrency round-trip ---
 
 (function simplifyMixedPercentRoundTrip() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H238

```diff
@@ -529,5 +529,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 
 // First-match-wins priority: firstRow beats firstColumn beats percent beats currency
-// (dates/times are no longer exclusion reasons)
+// (dates and times are not exclusion reasons)
 (function exclusionPriority() {
   const opts = {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H239

```diff
@@ -543,5 +543,5 @@ eq('isTimeLike: 12345 -> false', isTimeLike('12345'), false);
 })();
 
-// --- Sprint B: per-type granularity ---
+// --- Per-type granularity ---
 
 // Date granularity
```

Reviewer: none. Reconciliation: applied as proposed.

#### H240

```diff
@@ -638,5 +638,5 @@ eq('findDates: "13/13/2020" is impossible', findDates('13/13/2020')[0].impossibl
 eq('roundDateText: "2020-13-45" stays as written', roundDateText('2020-13-45', 'year'), '2020-13-45');
 
-// The issue's worked example: every granularity cuts, none rounds.
+// A worked example: every granularity cuts, none rounds.
 eq('roundDateText: December 13, 2096 at year -> 2096',
   roundDateText('December 13, 2096', 'year'), '2096');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H241

```diff
@@ -732,5 +732,5 @@ eq('roundTimeText: ISO datetime minute is idempotent on space form',
   roundTimeText('2025-11-26 16:16', 'minute'), '2025-11-26 16:16');
 
-// --- Sprint C: advanced parameter resolvers ---
+// --- Advanced parameter resolvers ---
 
 eq('resolveOffset: null -> fallback', resolveOffset(null, -0.5), -0.5);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H242

```diff
@@ -785,5 +785,5 @@ eq('resolveNumTop: 2.7 floored to 2',
 })();
 
-// --- Sprint G: range selector ---
+// --- Range selector ---
 
 // lettersToColIndex
```

Reviewer: none. Reconciliation: applied as proposed.

#### H243

```diff
@@ -912,13 +912,5 @@ eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
 })();
 
-// NOTE: End-to-end investigation (sprint partial-range-fix attempt 2) confirmed the parser
-// is correct — parseRangeExpr("D:E") correctly yields {colMin:3,colMax:4,...}. The actual
-// highlight-on-wrong-columns symptom reported by the user (D:E rounds the wrong data columns)
-// is caused by an off-by-one in the DOM cell-index mapping: rows[r].cells includes the
-// <th scope="row"> row-header at c=0, so the user's column letter D (index 3) resolves to the
-// 3rd DOM cell, which is the *3rd data column*, not the 4th. That bug is tracked and fixed by
-// this sprint (`first-col-is-a`) — column-letter → DOM-index mapping skips row-header <th>s.
-
-// --- Sprint partial-range-fix: adversarial parser regression tests ---
+// --- Adversarial range parser tests ---
 
 // Primary bug report: f4:g8 (lowercase partial-range)
```

Reviewer: none. Reconciliation: applied as proposed.

#### H244

```diff
@@ -976,5 +968,5 @@ eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
 })();
 
-// Regression guard: previously-working shapes must still pass
+// Regression guard: the basic shapes still pass
 (function sprint_regression_A() {
   const r = parseRangeExpr('A');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H245

```diff
@@ -1028,5 +1020,5 @@ eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
 // The implementation reads cell.innerText (which browsers exclude hidden text from).
 // We model this by making cell.innerText = '+2.3%' only (hidden span excluded).
-// toNumber('+2.3%') -> null (percent), and with simplifyMixedPercent unset it's excluded entirely.
+// toNumber('+2.3%') -> null (percent), and with simplifyMixedPercent unset it is excluded entirely.
 // The large hidden number 700023000 must NOT appear in any extracted matches.
 (function ac4_hiddenSortkeyNotExtracted() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H246

```diff
@@ -1073,5 +1065,5 @@ eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
 
 // ---------------------------------------------------------------------------
-// Sprint exclude-numbers-in-quotes
+// Numbers inside quotes
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H247

```diff
@@ -1178,5 +1170,5 @@ eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
 (function quoteRegressionGuards() {
   // 5a. cell.innerText || cell.textContent is the read source (static analysis).
-  // Lives in the NativeTableAdapter (lib/dr-table/detect.js) after the Phase 2 split.
+  // Lives in the NativeTableAdapter (lib/dr-table/detect.js).
   const contentSrc = allContentSrc;
   eq('regression: read source is cell.innerText || cell.textContent',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H248

```diff
@@ -1204,13 +1196,13 @@ eq('parseRangeExpr: "A5:A2" auto-swaps to A2:A5',
     passed++;
   }
-  // The content scripts MUST define getQuoteMaskedRanges (now in parsing.js)
+  // The content scripts MUST define getQuoteMaskedRanges (in parsing.js)
   eq('regression: content scripts define getQuoteMaskedRanges',
     contentSrc.includes('function getQuoteMaskedRanges('), true);
-  // ...and overlapsQuoteRange (now in parsing.js)
+  // ...and overlapsQuoteRange (in parsing.js)
   eq('regression: content scripts define overlapsQuoteRange',
     contentSrc.includes('function overlapsQuoteRange('), true);
 })();
 
-// --- Sprint decimal-precision-display: trailing zeros ---
+// --- Trailing zeros ---
 
 // trailing zeros always stripped regardless of the original decimal count
```

Reviewer: none. Reconciliation: applied as proposed.

#### H249

```diff
@@ -1232,5 +1224,5 @@ eq('formatNumber: |rounded|>=10 writes no decimals',
   formatNumber(12, '12'), '12');
 
-// --- Sprint trim-trailing-zeros (chrome-extension): whole-number short-circuit ---
+// --- Whole-number short-circuit ---
 
 // a pure cell write drops trailing zeros for whole-number results under 10
```

Reviewer: none. Reconciliation: applied as proposed.

#### H250

```diff
@@ -1268,5 +1260,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
 // =============================================================================
-// Sprint date-round-to-year-display tests
+// Date rounding to year display tests
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H251

```diff
@@ -1422,5 +1414,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 // ---------------------------------------------------------------------------
 (function dateRoundStaticAnalysis() {
-  const src = allContentSrc; // date parsing now in parsing.js (Phase 2 split)
+  const src = allContentSrc; // date parsing lives in parsing.js
 
   eq('static: findDates is defined in content.js',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H252

```diff
@@ -1429,6 +1421,6 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
 // ---------------------------------------------------------------------------
-// Sprint half-step-floor-chrome: Features 1 (sign-aware half-step),
-// 2 (value-OoM floor), 3 (X_FLOOR_THRESHOLD-gated x-floor)
+// Sign-aware half-step, value-OoM floor, and the X_FLOOR_THRESHOLD-gated
+// x-floor
 // ---------------------------------------------------------------------------
 (function halfStepFloorGrid() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H253

```diff
@@ -1499,5 +1491,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
   // Re-eval content.js with X_FLOOR_THRESHOLD = 0 to confirm the x-floor
   // gates on the constant. We sandbox the patched source so the eq()
-  // assertions below don't disturb the live extension globals.
+  // assertions below do not disturb the live extension globals.
   const roundingSrc = sourceByName('lib/dr-number/rounding.js');
   const contentSrc = sourceByName('content.js');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H254

```diff
@@ -1547,5 +1539,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
 // ---------------------------------------------------------------------------
-// Sprint date-tolerant-detection: isDateLike with adjacent text and markers
+// IsDateLike with adjacent text and markers
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H255

```diff
@@ -1633,5 +1625,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
 // ---------------------------------------------------------------------------
-// Sprint refactor/simplify-naming-unification — Adversarial contract lock-in
+// Simplify naming — adversarial contract lock-in
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H256

```diff
@@ -1801,5 +1793,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
 // ---------------------------------------------------------------------------
-// Sprint advanced-preview-redesign
+// Lens preview layout
 // AC1: formatOomLabel exhaustive suffix-boundary check
 // AC2: formatStrategyHeader structure + "(i.e. …)" clause correctness
```

Reviewer: none. Reconciliation: applied as proposed.

#### H257

```diff
@@ -1877,7 +1869,7 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
   // -------------------------------------------------------------------------
-  // AC2: formatStrategyHeader structure. Per issue #1 the descriptive
-  // "(i.e. a half of 1M)" clause was removed — the header is now exactly
-  // "<oomLabel> → nearest <stepLabel>" with no clause, for every stop.
+  // AC2: formatStrategyHeader structure. The header is exactly
+  // "<oomLabel> → nearest <stepLabel>" with no "(i.e. …)" clause, for every
+  // stop.
   // We derive the expected step independently via stepForOffset/formatStep.
   // -------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H258

```diff
@@ -2180,5 +2172,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
     topExamplePair._children[2]._children.length, 0);
 
-  // AC4-strip (issue #3): the "from" shows the bare number, not the original
+  // AC4-strip: the "from" shows the bare number, not the original
   // surrounding text. renderTopBand keys off row.num, so a row whose original
   // was "₹2,000 crore" still renders just "e.g. 2,000".
```

Reviewer: none. Reconciliation: applied as proposed.

#### H259

```diff
@@ -2256,5 +2248,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
   // AC4d: oom-label span is still appended inside the from-span for non-zero
-  // rows of the bottom band (kept per the issue #3 decision).
+  // rows of the bottom band.
   const oomLabelBandEl = makeBandEl();
   realRenderBotBand(oomLabelBandEl, [{ num: 5000, original: '5,000' }], -0.5, 3);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H260

```diff
@@ -2283,5 +2275,5 @@ eq('formatNumber: whole number 1 from "1.04" -> "1"',
 
 // -------------------------------------------------------------------------
-// AC2: formatStrategyHeader — exhaustive mag=3 (1k+) table. Per issue #1 the
+// AC2: formatStrategyHeader — exhaustive mag=3 (1k+) table. The
 // header is exactly "<oomLabel> → nearest <stepLabel>" for every offset stop,
 // with no "(i.e. …)" clause and no "×" multiplier.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H261

```diff
@@ -2467,5 +2459,5 @@ const LADDER_OPTS = {
 
 // ---------------------------------------------------------------------------
-// Settings live in DR_STORE, one set per table (issue #328): a table with none
+// Settings live in DR_STORE, one set per table: a table with none
 // reads as the shipped defaults, setTableSettings stores the whole settings
 // with the defaults filled in and publishes the whole new value, and
```

Reviewer: none. Reconciliation: applied as proposed.

#### H262

```diff
@@ -2504,8 +2496,7 @@ const LADDER_OPTS = {
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings, AC2: the preview band and the table must round
-// the same cell to the same value once a setting changes — the bug this
-// sprint fixes was extractPreviewSamples reading DR_DEFAULTS while roundTable
-// read the model, so they disagreed the moment a slider moved off default.
+// AC2: the lens preview and the table must round the same cell to the same
+// value once a setting changes: extractPreviewSamples and roundTable both
+// read the table's settings.
 // ---------------------------------------------------------------------------
 (function appModelSettings_previewAndTableAgreeOnLiveSettings() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H263

```diff
@@ -2568,7 +2559,7 @@ const LADDER_OPTS = {
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings, AC5: settings survive a sidebar close and
+// AC5: settings survive a sidebar close and
 // reopen — pulled from the model (request:settings), not reset to DR_DEFAULTS.
-// The settings live on the active table (issue #328), so the reopen's read
+// The settings live on the active table, so the reopen's read
 // answers that table's settings.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H264

```diff
@@ -2607,5 +2598,5 @@ const LADDER_OPTS = {
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings, bucket-2 fix: a pulled enabled:false must survive
+// A pulled enabled:false must survive
 // sidebar reopen when the reopen lands on a TABLE THAT IS BOUND. This drives
 // sidebar.js's real pullSettingsAndApplyToUI() -> applySettingsToUI() ->
```

Reviewer: none. Reconciliation: applied as proposed.

#### H265

```diff
@@ -2613,14 +2604,9 @@ const LADDER_OPTS = {
 // appModelSettings_settingsPublish_deliveryFeedback_behavioral above).
 //
-// The bug (as found): pullSettingsAndApplyToUI applied the pulled settings
-// (correctly setting enabledEl.checked = false), then called
-// fetchPreviewSamples(), whose response callback called setTableBound(true)
-// once request:previewSamples resolved with a bound table — and setTableBound's
-// bound branch unconditionally did `enabledEl.checked = DR_DEFAULTS.enabled
-// !== false`, which is true, clobbering the pulled false. Sprint 9 patched
-// it by threading the pulled settings through fetchPreviewSamples; issue
-// #251 then removed the bound branch's default write entirely, which made
-// the threading unnecessary. This test stays as the regression pin either
-// way: a pulled enabled:false must survive the reopen.
+// The pin: pullSettingsAndApplyToUI applies the pulled settings, then calls
+// fetchPreviewSamples(), whose response callback calls setTableBound(true)
+// once request:previewSamples resolves with a bound table. setTableBound's
+// bound branch must not write the main switch, so the pulled false survives
+// the reopen.
 // ---------------------------------------------------------------------------
 (function appModelSettings_pulledEnabledSurvivesReopenOnBoundTable() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H266

```diff
@@ -2750,5 +2736,5 @@ const LADDER_OPTS = {
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings, adversarial: the full wire path, not the store
+// Adversarial: the full wire path, not the store
 // directly. appModelSettings_previewAndTableAgreeOnLiveSettings (above) calls
 // DR_STORE.setTableSettings() straight from the test — it never exercises
```

Reviewer: none. Reconciliation: applied as proposed.

#### H267

```diff
@@ -2955,7 +2941,6 @@ const LADDER_OPTS = {
 
 (function currencies_roundingKeepsTheSign() {
-  // Before the collapse, the write-back carried its own four-symbol chain, so
-  // a cell marked with any other currency rounded and lost its sign outright.
-  // The pure number span now steps past every sign the one list names.
+  // The pure number span steps past every sign the one list names, so a cell
+  // marked with any listed currency keeps its sign.
   for (const { name, signs } of CURRENCIES) {
     for (const sign of signs) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H268

```diff
@@ -2991,6 +2976,6 @@ const LADDER_OPTS = {
     toNumber('a€45'), null);
 
-  // Regression: the currency exclusion once fired on any capital R, so a
-  // plain text cell was skipped as currency with the setting off.
+  // The currency exclusion must not fire on a capital R inside a word, so a
+  // plain text cell is not skipped as currency with the setting off.
   const currencyOff = { simplifyFirstRow: true, simplifyFirstColumn: true,
     simplifyMixedPercent: true, simplifyMixedCurrency: false };
```

Reviewer: none. Reconciliation: applied as proposed.

#### H269

```diff
@@ -3076,10 +3061,9 @@ eq('bracketed: a bracket pair holding more than the number is not a whole-text m
   [null, null, null]);
 
-// --- Decimal comma: strict US reading (issue #487) ---
+// --- Decimal comma: strict US reading ---
 // The number format function returns the marks a number uses, US style for
 // now. The number shape test accepts a group mark only in the group shape
 // and only before the decimal mark. A run with no group mark goes to the
-// conversion as before, so a second dot still fails there. Before this
-// change the clean-up deleted every comma, so "13,63€" read as 1363.
+// conversion, so a second dot still fails there.
 
 eq('number format function: returns the US marks',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H270

```diff
@@ -3125,6 +3109,6 @@ eq('number reader: US-style values read as before',
 
 // Inside text, the digit run takes every comma and dot between digits, so
-// the number shape test judges the whole run. Before this change the
-// pattern took "1.234" from "1.234,56" and "12.03" from "12.03.2024".
+// the number shape test tests the whole run. A pattern that stopped at the
+// first dot would take "1.234" from "1.234,56" and "12.03" from "12.03.2024".
 eq('decimal comma in text: "13,63€ (includes 2,37€ VAT)" holds no number',
   extractNumbersInText('13,63€ (includes 2,37€ VAT)'), []);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H271

```diff
@@ -3163,5 +3147,5 @@ eq('decimal comma: "1,234.56 EUR" is a unit number, as before',
 })();
 
-// --- One write-back path (issue #487) ---
+// --- One write-back path ---
 // Every number is patched in place, digits only, grouped with the marks the
 // number format function returns. A pure cell's number span leaves out its
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/pillbox.js`

#### H272

```diff
@@ -1,5 +1,5 @@
 // The pillbox on each data table (ui-toggle.js).
 
-// --- Sprint range-pulse-border: animation parameters and dispatch ---
+// --- Animation parameters and dispatch ---
 
 // CSS string: capture style.textContent from ensureHighlightStyleInjected().
```

Reviewer: none. Reconciliation: applied as proposed.

#### H273

```diff
@@ -21,5 +21,5 @@
     return el;
   };
-  // Stub appendChild so the injection doesn't throw (document.head is undefined in stub).
+  // Stub appendChild so the injection does not throw (document.head is undefined in stub).
   const origHead = document.head;
   const origDocEl = document.documentElement;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H274

```diff
@@ -31,5 +31,5 @@
   document.createElement = origCreate;
   document.documentElement = origDocEl;
-  // Re-set guard so later paths don't re-inject against the real (absent) DOM.
+  // Re-set guard so later paths do not re-inject against the real (absent) DOM.
   highlightStyleInjected = true;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H275

```diff
@@ -78,5 +78,5 @@
   };
 
-  // A valid non-null ranges array that can't match anything in an empty table.
+  // A valid non-null ranges array that cannot match anything in an empty table.
   const ranges = [{ colMin: 0, colMax: 2, rowMin: 0, rowMax: 5 }];
   flashRangePulse(mockTable, ranges);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H276

```diff
@@ -100,7 +100,7 @@
 (function atToggle_isTableRounded_afterRound() {
   // Directly inject the rounded class AND set the registry's appliedFlag to
-  // simulate a rounded table (don't run the full roundTable pipeline which
-  // requires tree walkers etc.) — isTableRounded reads DR_STORE's appliedFlag
-  // (app-model-registry sprint), not the class, so both are set here the way
+  // simulate a rounded table (do not run the full roundTable pipeline which
+  // requires tree walkers etc.) — isTableRounded reads DR_STORE's appliedFlag,
+  // not the class, so both are set here the way
   // roundTable itself would leave them.
   const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H277

```diff
@@ -123,17 +123,12 @@
 
 // --- AC5: isTableRounded after the reset restores originals ---
-// A form flip used to take a table back to its original values while keeping
-// its simplified markers and stored originals in place. The 2026-09-14
-// sidebar-state-removal design retired that flip (#241): turning
-// simplification off resets the table outright. This pins the reset against
-// the same three observables the flip was pinned against, plus the two the
-// flip left behind — the marker and the stored original.
+// Turning simplification off resets the table outright. This pins the reset
+// against three observables, plus the marker and the stored original, which
+// the reset clears.
 
 (function atToggle_isTableRounded_afterReset() {
   const table = makeToggleTable([{ tag: 'td', text: '1,000' }]);
   // Simulate a post-roundTable state: cell has rounded class + a registry
-  // original record (app-model-registry sprint — this used to be
-  // cell.dataset.originalHtml), and the registry's appliedFlag is
-  // 'simplified'.
+  // original record, and the registry's appliedFlag is 'simplified'.
   const cell = table._cells[0];
   cell.classList.add('dr-ext-rounded');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H278

```diff
@@ -148,5 +143,5 @@
   });
 
-  // Inject toggle entry (proper button stub) so syncSwitchForTable doesn't crash
+  // Inject toggle entry (proper button stub) so syncSwitchForTable does not crash
   injectToggleEntry(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H279

```diff
@@ -183,5 +178,5 @@
   // production rounded/showing-original states always carry one (roundTable
   // writes it; the keepEntry restore preserves it). A marker WITHOUT a
-  // record is the locked re-injection state (issue #262), tested in the
+  // record is the locked re-injection state, tested in the
   // re-injection suite.
   table._cells[0].classList.add('dr-ext-rounded');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H280

```diff
@@ -361,6 +356,5 @@
 //   wrapperLeft = (rect.right + scrollX + TOGGLE_DOT_OVERHANG_PX) - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX
 //   wrapperTop  = (rect.top   + scrollY + TOGGLE_DOT_OVERLAP_PX)  - TOGGLE_DOT_PX - TOGGLE_HIT_PAD_PX
-// (Note: this corrects a math error in the merged plan §3.6, which double-counted
-// padding on the horizontal axis. See sprint log for the deviation.)
+// One padding term per axis, not two.
 // All arithmetic is done in terms of the exposed globalThis constants.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H281

```diff
@@ -435,8 +429,5 @@
 // --- AC3 / AC4: the two directions of a press ---
 // A press on a raw table simplifies it; a press on a simplified table resets
-// it. These two ran against a plain-toggle helper that chose between the
-// directions itself; the 2026-09-14 sidebar-state-removal design retired the
-// helper along with the third press path it served (#241), so each direction
-// is driven here through the call the surviving path makes.
+// it. Each direction is driven here through the call the press path makes.
 // We verify the outcome on the table rather than inspecting private calls.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H282

```diff
@@ -452,5 +443,5 @@
     // Must have querySelectorAll on individual cells (used by roundTable → filterLinkMatches)
     table._cells.forEach(c => { c.querySelectorAll = () => []; });
-    // Register a checkbox so syncSwitchForTable doesn't crash
+    // Register a checkbox so syncSwitchForTable does not crash
     const input = injectToggleEntry(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H283

```diff
@@ -545,5 +536,5 @@
 
 // =============================================================================
-// Sprint accessibility-pass tests
+// Accessibility tests
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H284

```diff
@@ -718,5 +709,5 @@
     get(){return htmlVal;}, set(v){htmlVal=v;}, configurable: true
   });
-  // Registry-backed setup (app-model-registry sprint): restoreTable reads
+  // Registry-backed setup: restoreTable reads
   // the pre-round original from DR_STORE, not a dataset attribute, so the
   // fixture must register one for the cell to be genuinely restorable — a
```

Reviewer: none. Reconciliation: applied as proposed.

#### H285

```diff
@@ -737,8 +728,8 @@
 
 // ---------------------------------------------------------------------------
-// Sprint offscreen-hidden-table-suppression: visibility gate in positionToggle
+// Visibility gate in positionToggle
 // ---------------------------------------------------------------------------
 //
-// positionToggle now hides the toggle label (labelEl.style.display = 'none')
+// positionToggle hides the toggle label (labelEl.style.display = 'none')
 // when the table is offscreen or invisible, and shows it (labelEl.style.display = '')
 // when the table is normally visible.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H286

```diff
@@ -820,5 +811,5 @@
 
 // =============================================================================
-// Sprint expanding-toggle: new AC tests
+// New AC tests
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H287

```diff
@@ -1494,5 +1485,5 @@
 
 // =============================================================================
-// Sprint sidebar-table-rebind: createToggleForTable click rebind logic
+// CreateToggleForTable click rebind logic
 // =============================================================================
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H288

```diff
@@ -1541,12 +1532,10 @@
   lastRightClickedTable = null;
 
-  // 1a. lastRightClickedTable must now be tableB
+  // 1a. lastRightClickedTable must be tableB
   eq('rebind AC1 mouse: lastRightClickedTable rebound to tableB',
     reboundToB_mouse, true);
 
-  // 1b. state:tableSwitched dispatched exactly once. Issue #251 renamed the
-  // switch message from RESET_SIDEBAR_TO_DEFAULTS: the sidebar's handler now
-  // pulls the model's settings, and the old name described the defaults
-  // reset that fix removed.
+  // 1b. state:tableSwitched dispatched exactly once. The sidebar's handler
+  // pulls the model's settings.
   const switchCalls = sentMessages.filter(m => m.action === 'state:tableSwitched');
   eq('rebind AC1 mouse: state:tableSwitched dispatched exactly once',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H289

```diff
@@ -1742,11 +1731,7 @@
 // AC4: closing the sidebar leaves a later press unchanged.
 //
-// This used to pin the opposite: the close flipped a page-held flag to false
-// and the flag gated the switch. The 2026-09-14 sidebar-state-removal design
-// retired both the flag and the gate (#241), and the close message stops at
-// the sidebar page — the content script has no handler for it. The pin that
-// carries weight now is that a press after a close behaves exactly like a
-// press before one, which is the defect's own cure: a page whose flag went
-// stale used to take the rebind path forever.
+// The close message stops at the sidebar page — the content script has no
+// handler for it. A press after a close behaves exactly like a press before
+// one: the press reads nothing about the sidebar.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H290

```diff
@@ -1766,5 +1751,5 @@
   lastRightClickedTable = tableA;
 
-  // The close reaches the sidebar page alone now, so there is nothing to
+  // The close reaches the sidebar page alone, so there is nothing to
   // deliver here — the content script registers no branch for it. That
   // absence is asserted at the source, next to the other retirements.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H291

```diff
@@ -1805,5 +1790,5 @@
 
 // ---------------------------------------------------------------------------
-// AC1: ARIA grid with ONLY phantom tables → Pass 2 adds dr-ext-grid + toggle
+// AC1: ARIA grid with ONLY accessibility artifacts → Pass 2 adds dr-ext-grid + pillbox
 // ---------------------------------------------------------------------------
 (function pass2aria_AC1_onlyPhantomTables_getsToggle() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H292

```diff
@@ -1853,5 +1838,5 @@
 
 // ---------------------------------------------------------------------------
-// Adversarial AC2-mix: grid with phantom + one real → still bows out
+// Adversarial AC2-mix: grid with an artifact + one real table → still skipped
 // ---------------------------------------------------------------------------
 (function pass2aria_adversarial_mixedPhantomAndReal_bowsOut() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H293

```diff
@@ -1878,5 +1863,5 @@
 // ---------------------------------------------------------------------------
 // Adversarial: grid with NO embedded tables → Pass 2 adds class + toggle
-// (no embedded tables means .some(!phantom) is false — empty array)
+// (no embedded tables means .some(!artifact) is false — empty array)
 // ---------------------------------------------------------------------------
 (function pass2aria_adversarial_noEmbeddedTables_getsToggle() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H294

```diff
@@ -1904,6 +1889,6 @@
 (function pass2aria_adversarial_alreadyTagged_skipped() {
   const grid = makeAriaGrid([]);
-  grid.classList.add('dr-ext-grid'); // pre-tag it (style hook only, no longer read as state)
-  DR_STORE.registerTable(grid); // the actual "already found" signal pass 2 now checks
+  grid.classList.add('dr-ext-grid'); // pre-tag it (style hook only, not read as state)
+  DR_STORE.registerTable(grid); // the "already found" signal pass 2 checks
 
   withToggleDocumentMock(function() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H295

```diff
@@ -1918,5 +1903,5 @@
 
   // Already tagged → skipped → tableToggles should NOT have a new entry
-  // (we can't assert .has() false on a pre-existing toggle since none was injected,
+  // (we cannot assert .has() false on a pre-existing toggle since none was injected,
   // but we CAN verify the grid was not re-registered via trackedTables)
   eq('pass2-aria: already-tagged grid is NOT added to trackedTables again',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H296

```diff
@@ -1962,12 +1947,12 @@
 
 // ---------------------------------------------------------------------------
-// Sprint pillbox-bidirectional-sync: acceptance criteria
+// Acceptance criteria
 //
-// AC1: Clicking the table's morph pill while sidebar is open changes
+// AC1: Clicking the table's pillbox while sidebar is open changes
 //      enabledEl.checked to match the table's new rounded/unrounded state
 //      (sidebar handler updates the checkbox).
 //
-// AC2: Clicking the sidebar's enabled toggle still updates the table's pill
-//      state (existing behaviour unchanged — regression guard).
+// AC2: Clicking the sidebar's enabled switch still updates the table's pillbox
+//      state (regression guard).
 //
 // AC3: Toggling a table that is NOT lastRightClickedTable sends no spurious
```

Reviewer: none. Reconciliation: applied as proposed.

#### H297

```diff
@@ -1979,5 +1964,5 @@
 // ---------------------------------------------------------------------------
 // AC1: Clicking the table's pillbox while sidebar is open sends the
-//      settings notice for the active table (issue #328), and the sidebar's
+//      settings notice for the active table, and the sidebar's
 //      handler for it redraws the switch from the notice's settings.
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H298

```diff
@@ -2036,6 +2021,6 @@
 
 // ---------------------------------------------------------------------------
-// AC2: Clicking the sidebar's enabled toggle still updates the table's pill
-//      state (regression guard — existing path unchanged).
+// AC2: Clicking the sidebar's enabled switch still updates the table's pillbox
+//      state (regression guard).
 //
 // The sidebar-to-table path goes through content.js's request:applySettings
```

Reviewer: none. Reconciliation: applied as proposed.

#### H299

```diff
@@ -2060,7 +2045,5 @@
     sidebarSrc.includes('enabledEl'), true);
 
-  // Dynamic guard: a press still takes a table on and back off. This ran
-  // against a plain-toggle helper until the 2026-09-14 sidebar-state-removal
-  // design retired it (#241); the press itself is the path now, so the intent
+  // Dynamic guard: a press still takes a table on and back off; the intent
   // drives it. DR_DEFAULTS excludes row 0 (firstRow) and col 0 (firstColumn),
   // so only [row1, col1] is processed. Use 12,345, which rounds to 10,000.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H300

```diff
@@ -2100,5 +2083,5 @@
 // makes the pressed table active and sends state:tableSwitched first, so the
 // settings notice that follows marks the active table, and the sidebar
-// redraws from it for the table it now describes (issue #328).
+// redraws from it for the table it now describes.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H301

```diff
@@ -2190,5 +2173,5 @@
 })();
 
-// Sprint table-contextmenu-activation
+// Right-click activation
 // ---------------------------------------------------------------------------
 // AC1: Right-clicking a table causes flashTargetedTable to run on that table.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H302

```diff
@@ -2224,6 +2207,5 @@
 
   // AC1 (source): contextmenu handler calls flashTargetedTable(table) inside
-  // the `if (found)` guard. Sprint extract-dr-table: findTargetTable now
-  // reports { handle, isNew } instead of the table itself, so the handler
+  // the `if (found)` guard. findTargetTable returns { handle, isNew }, so the handler
   // guards on `found` and derives `table` from markAndToggleIfNewGrid(found)
   // before flashing it.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H303

```diff
@@ -2262,7 +2244,6 @@
 
   // AC4 (source): the worker neither publishes nor subscribes to the activation
-  // report. The sidebar receives it straight from the content script over the
-  // broadcast carrier, so the old relay only ever delivered it to a content
-  // script with no handler. Runtime coverage lives in backgroundMessageRouting.
+  // topic. The sidebar receives it straight from the content script over the
+  // broadcast carrier. Runtime coverage lives in backgroundMessageRouting.
   eq('table-activation AC4 source: the worker does not publish the activation report',
     /publish\(\s*'state:tableActivated'/.test(bgSrc), false);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H304

```diff
@@ -2379,14 +2360,12 @@
 
 // ---------------------------------------------------------------------------
-// Sprint extract-dr-table (adversarial hardening): end-to-end double-invocation
+// End-to-end double-invocation
 // coverage through the REAL captured content.js listeners — not a direct call
 // to markAndToggleIfNewGrid with a hand-built {handle, isNew} object (that is
 // already covered above, but only exercises the wrapper in isolation).
 //
-// Before this sprint, findTargetTable itself wrote the dr-ext-grid marker
-// inline, so a table seen twice never grew a second widget. That guard now
-// lives across two calls (findTargetTable reports isNew; the caller's
-// markAndToggleIfNewGrid marks+builds only when isNew). This test proves the
-// split still reproduces the old guarantee end-to-end: firing the actual
+// The guard against a second pillbox lives across two calls (findTargetTable
+// returns isNew; the caller's markAndToggleIfNewGrid marks+builds only when
+// isNew). This test proves the guard end-to-end: firing the actual
 // captured 'contextmenu' listener twice on the same never-before-seen grid,
 // and then firing the actual captured 'intent:menuClicked' onMessage listener
```

Reviewer: none. Reconciliation: applied as proposed.

#### H305

```diff
@@ -2492,7 +2471,7 @@
       buttonCreateCount, 1);
 
-    // --- Second right-click on the SAME target: findTargetTable now resolves
-    // this grid via case 2 (closest('.dr-ext-grid')), since it is already
-    // marked -- the replacement for the old inline-write re-entry guard. ---
+    // --- Second right-click on the SAME target: findTargetTable resolves
+    // this grid via case 2 (the opts.isSeen walk-up), since it is already
+    // registered. ---
     clickTarget.closest = function(sel) { return sel === '.dr-ext-grid' ? gridEl : null; };
     contextmenuHandler({ target: clickTarget });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H306

```diff
@@ -2509,5 +2488,5 @@
       buttonCreateCount, 1);
     // Exact sequence, not presence. The right-click above CONNECTED this
-    // grid, and the panel-state decoupling (issue #272 family) makes a
+    // grid, and the press path, which reads nothing about the sidebar, makes a
     // toggle on the connected table take the settings path with the sidebar
     // closed too: the table's settings notice from the write, then
```

Reviewer: none. Reconciliation: applied as proposed.

#### H307

```diff
@@ -2527,5 +2506,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint right-click-registers (controller level): the right-click handler
+// The right-click handler
 // registers what the new route resolves and makes it active.
 // Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.5 and the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H308

```diff
@@ -2741,5 +2720,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint grid-first-row-literal: the range pulse numbers rows the same way
+// The range pulse numbers rows the same way
 // the engine gates them — by literal row number — so on a rowgroup grid the
 // pulse frames the rows the engine actually touches, not the rows one slot
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/rounding-pass.js`

#### H309

```diff
@@ -2,5 +2,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint first-col-is-a: pin column-index behavior for tables with <th> cells
+// Pin column-index behavior for tables with <th> cells
 //
 // Column index is the cell's position in its row, counting <th> cells:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H310

```diff
@@ -18,5 +18,5 @@
 
 // roundTable calls document.createTreeWalker (via collectTextPieces).
-// We need to stub that too so the "apply rounding" path doesn't crash.
+// We need to stub that too so the "apply rounding" path does not crash.
 // Stub createTreeWalker to return a walker that finds the cell's single text node.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H311

```diff
@@ -79,7 +79,6 @@
 
 // --- Test 3: simplifyFirstColumn gates the <th>, not the leading <td> ---
-// Regression: selecting "first column" used to enable the *second* rendered
-// column, because only <td> cells were counted and the <th> was invisible to
-// the column index. The <th> is the first column, so the leading <td> (column
+// The <th> counts toward the column index, so "first column" means the <th>,
+// not the second rendered column. The <th> is the first column, so the leading <td> (column
 // B) is rounded regardless of the toggle, and the <th> holds a name, so it stays raw.
 (function simplifyFirstColumn_withRowHeader() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H312

```diff
@@ -244,5 +243,5 @@ const SEAT_ROWS = [
 })();
 
-// --- 3b. Era-marked years are not parameter-rounded by roundTable (issue #4) ---
+// --- 3b. Era-marked years are not parameter-rounded by roundTable ---
 
 (function eraYearNotParameterRounded() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H313

```diff
@@ -272,5 +271,5 @@ const SEAT_ROWS = [
 })();
 
-// --- 3c. A silently failed extracted patch records nothing (#301) ---
+// --- 3c. A silently failed extracted patch records nothing ---
 //
 // The patch step skips silently when the number is not at its flat-text
```

Reviewer: none. Reconciliation: applied as proposed.

#### H314

```diff
@@ -461,5 +460,5 @@ const SEAT_ROWS = [
     // "14 March" has no year → isDateLike returns false → treated as a word-embedded number
     // simplifyMixedCells=false in our setup, so it skips non-numeric text.
-    // Let's just verify it doesn't get the rounded class.
+    // Let us just verify it does not get the rounded class.
     const tbl = makeMockTable([[{ tag: 'td', text: '14 March' }]]);
     tbl.rows[0].cells[0].querySelectorAll = () => [];
```

Reviewer: none. Reconciliation: applied as proposed.

#### H315

```diff
@@ -478,5 +477,5 @@ const SEAT_ROWS = [
 
 // =============================================================================
-// Sprint sidebar-preview-band: formatStep, collectNumericCells, extractPreviewSamples
+// FormatStep, collectNumericCells, extractPreviewSamples
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H316

```diff
@@ -535,7 +534,6 @@ const SEAT_ROWS = [
   // The data sits at row >= 1 / column >= 1 behind a TH header row and a TH
   // label column: DR_DEFAULTS.simplifyFirstRow/simplifyFirstColumn are both
-  // false, and since sprint merge-ladder the preview now honours that
-  // exclusion (see the merge-ladder divergence tests below) the way the
-  // engine always did — a row-0/column-0 <td> would be dropped, same as it
+  // false, and the preview honours that exclusion (see the merge-ladder
+  // divergence tests below) the way the engine does — a row-0/column-0 <td> would be dropped, same as it
   // would be when actually rounding the table.
   function tdCell(text) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H317

```diff
@@ -589,6 +587,5 @@ const SEAT_ROWS = [
   eq('onePerOom: bottom[1] is the 10+ value, abs of -12', result.samples.bottom[1].num, -12);
 
-  // No cap: five distinct lower magnitudes yield five bottom rows (old code
-  // capped the band at 3).
+  // No cap: five distinct lower magnitudes yield five bottom rows.
   const deep = {
     rows: [
```

Reviewer: none. Reconciliation: applied as proposed.

#### H318

```diff
@@ -806,5 +803,5 @@ const SEAT_ROWS = [
 })();
 
-// Issues #452 and #461: a native table runs the stacked-cell test, as a grid
+// A native table runs the stacked-cell test, as a grid
 // does. A native cell classifies its rendered text, which shows whether two
 // pieces sit on separate lines or run together, so a digit beside a digit
```

Reviewer: none. Reconciliation: applied as proposed.

#### H319

```diff
@@ -1054,5 +1051,5 @@ const SEAT_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint invert-datetime-pills: simplifyDates / simplifyTimes boolean wiring
+// SimplifyDates / simplifyTimes boolean wiring
 //
 // Acceptance criteria verified here:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H320

```diff
@@ -1237,5 +1234,5 @@ const SEAT_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Sprint invert-datetime-pills: adversarial tests
+// Adversarial tests
 //
 // These tests are written from the SPEC, not the implementation.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H321

```diff
@@ -1476,8 +1473,7 @@ const SEAT_ROWS = [
 
 // ---------------------------------------------------------------------------
-// content.js markAndToggleIfNewGrid — the badge/marker call-site wrapper that
-// replaced findTargetTable's old internal mutation. It owns exactly what
-// findTargetTable used to do inline: write the dr-ext-grid marker and build
-// the toggle widget, but only for a first-time (isNew) discovery.
+// content.js markAndToggleIfNewGrid — the marker call-site wrapper. It
+// writes the dr-ext-grid marker and builds the pillbox, but only for a
+// first-time (isNew) discovery.
 // ---------------------------------------------------------------------------
 (function markAndToggleIfNewGrid_newGridGetsMarkedAndWidget() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H322

```diff
@@ -1515,5 +1511,5 @@ const SEAT_ROWS = [
 
 // =============================================================================
-// Sprint grid-rounding tests
+// Grid rounding tests
 // Spec: docs/sprint-plans/grid-support-v2.md §2 D3 + §4 "grid-rounding"
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H323

```diff
@@ -1540,5 +1536,5 @@ const SEAT_ROWS = [
 
 // ---------------------------------------------------------------------------
-// Grid patch writes (#120). A grid cell's change lands as a patch to the one
+// Grid patch writes. A grid cell's change lands as a patch to the one
 // text piece that holds the changed characters, and the cell's originals
 // record holds each touched piece's text by piece index.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H324

```diff
@@ -1602,5 +1598,5 @@ const pieceTextsOf = (cell) => gridCellTextPieces(cell).map((node) => node.nodeV
 
 // ---------------------------------------------------------------------------
-// Stacked cells and unit numbers on grids (#120). A grid cell's text is its
+// Stacked cells and unit numbers on grids. A grid cell's text is its
 // flat text. A stacked cell holds whole numbers in separate text pieces, and
 // each rounds in its own piece. A unit number's digits change and its suffix
```

Reviewer: none. Reconciliation: applied as proposed.

#### H325

```diff
@@ -1619,7 +1615,6 @@ const pieceTextsOf = (cell) => gridCellTextPieces(cell).map((node) => node.nodeV
 const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells: true, simplifyDates: true });
 
-// "Revenue 500 units" and "DT1234" now round like any extracted cell (issue
-// #120), but both show unchanged pieces here for reasons that have nothing
-// to do with the flag removal: 500 already sits on the step this dataset's
+// "Revenue 500 units" and "DT1234" round like any extracted cell, but both
+// show unchanged pieces here: 500 already sits on the step this dataset's
 // magnitude rounds to, so it formats back to itself, and "DT1234"'s digits
 // sit glued to a letter with no separator, so the number extractor never
```

Reviewer: none. Reconciliation: applied as proposed.

#### H326

```diff
@@ -1750,5 +1745,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 // two pieces from the cell's rendered text, as a native table does, so one
 // number that inline styling splits ("6,7" plain, "18,245" in bold) stays
-// unchanged (issue #479). Before, the grid rounded it to "65" and "20,000".
+// unchanged. Before, the grid rounded it to "65" and "20,000".
 (function gridStacked_sameCellsAsTheNativeTable() {
   const grid = makeE2EGridWrapper([['$337.91', '125126', '6,718,245']]);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H327

```diff
@@ -1839,5 +1834,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 //   a: a number beside a <sup> footnote, glued together with no separator:
 //      the base number rounds and the footnote digits stay, exactly as a
-//      native table already rounds this shape (issue #120) — the digit run
+//      native table already rounds this shape — the digit run
 //      right after the <sup> is never even a candidate match, since the
 //      number extractor never starts a match right after a letter
```

Reviewer: none. Reconciliation: applied as proposed.

#### H328

```diff
@@ -1946,5 +1941,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // A rounded stacked cell that the page redraws with fewer pieces is a
-// rewritten cell (#423). Its one remaining piece shows the extension's
+// rewritten cell. Its one remaining piece shows the extension's
 // written text for the first stored piece, so it matches that piece by text
 // and takes its original back before the record drops: the re-apply then
```

Reviewer: none. Reconciliation: applied as proposed.

#### H329

```diff
@@ -2221,7 +2216,7 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // ---------------------------------------------------------------------------
-// Grid form honesty (#315): the per-cell write reports whether it landed,
+// Grid form honesty: the per-cell write reports whether it landed,
 // and the table's form counts confirmed writes — the same rule as the
-// extracted-cell fix (#301). A grid cell can classify as roundable through
+// extracted-cell fix. A grid cell can classify as roundable through
 // the whole-text fallback yet hold no text piece for the nodeValue write to
 // patch; such a write skips, and a skipped write must not flip the form.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H330

```diff
@@ -2366,5 +2361,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
     let reapplyCalls = 0;
     const origRAGR = global.reapplyRounding;
-    // We can't easily intercept the closure directly; instead count timer fires.
+    // We cannot easily intercept the closure directly; instead count timer fires.
     // Each non-cancelled timer fires reapplyRounding once.
     flushTimers(pendingTimers);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H331

```diff
@@ -2458,12 +2453,12 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
       obs.disconnectCount >= 1, true);
 
-    // Now simulate a mutation — the observer callback fires (it's the same object,
-    // but it's been disconnected so in the real DOM it would not fire; here we
+    // Now simulate a mutation — the observer callback fires (it is the same object,
+    // but it has been disconnected so in the real DOM it would not fire; here we
     // call it manually to prove the debounce logic does NOT schedule a new timer
-    // because reapplyObservers / tableOptions no longer has the wrapper).
+    // because reapplyObservers no longer has the wrapper).
     const timerCountBefore = pendingTimers.length;
     obs.trigger([{ type: 'childList' }]);
-    // The callback still fires (we're calling it directly), but reapplyRounding
-    // will bail harmlessly because tableOptions no longer has the wrapper.
+    // The callback still fires (we are calling it directly), but reapplyRounding
+    // will bail harmlessly because reapplyObservers no longer has the wrapper.
     // The debounce timer IS still scheduled by the closure (the closure holds wrapperEl).
     // Flush it and confirm no rounding occurred.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H332

```diff
@@ -2488,16 +2483,12 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // ---------------------------------------------------------------------------
-// GV5b (Regression #cstif9): a press turning simplification off on a
-// virtualized grid restores pristine values; a grid re-apply observer must NOT
-// re-round them. Before the fix, the observer saw the restore writes'
-// characterData mutations and re-rounded the cells ~100ms later, making them
-// flash original then snap back to simplified and leaving the recorded form
-// disconnected from the DOM.
+// GV5b: a press turning simplification off on a virtualized grid restores
+// pristine values; a grid re-apply observer must NOT re-round them. An
+// observer that saw the restore writes' characterData mutations would
+// re-round the cells ~100ms later, making them flash original then snap back
+// to simplified and leaving the recorded form disconnected from the DOM.
 //
-// The off direction used to be a form flip that kept the grid's markers and
-// left its observer connected, and the appliedFlag guard inside the re-apply
-// was what held the line. The 2026-09-14 sidebar-state-removal design retired
-// that flip (#241): off is a reset, which disconnects the observer and clears
-// the stored options. The regression is therefore blocked twice over, and this
+// Off is a reset, which disconnects the observer and clears the stored
+// options, and the appliedFlag guard inside the re-apply also bails. This
 // test drives a mutation through anyway — the stub calls the callback whether
 // or not the observer was disconnected, so the re-apply's own bail is still
```

Reviewer: none. Reconciliation: applied as proposed.

#### H333

```diff
@@ -2561,5 +2552,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // ---------------------------------------------------------------------------
-// GV6: a native <table> gets the same re-apply observer a grid gets (#421),
+// GV6: a native <table> gets the same re-apply observer a grid gets,
 // watching the table element itself.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H334

```diff
@@ -2667,9 +2658,9 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // ---------------------------------------------------------------------------
-// Sprint observer-phantom-filter (issue #128): MutationObserver added-node path
-// applies the SAME phantom filtering as injectTableToggles.
+// MutationObserver added-node path
+// applies the SAME accessibility artifact filter as injectTableToggles.
 //
-// The initial-load fix only touched injectTableToggles(). Kaggle is a React SPA
-// that renders its Data Explorer grid AFTER load, so detection runs through the
+// Kaggle is a React single-page application that renders its Data Explorer
+// grid AFTER load, so detection runs through the
 // MutationObserver added-node handler — extracted here as injectTogglesForAddedNode().
 // These tests drive that function directly with element-node stubs.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H335

```diff
@@ -2677,5 +2668,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // AC1 (the Kaggle case): an added [role="table"] grid whose ONLY embedded
-// <table>s are phantom chart a11y tables → gets dr-ext-grid + a toggle.
+// <table>s are chart accessibility artifacts → gets dr-ext-grid + a pillbox.
 (function observer_AC1_addedGridOnlyPhantomTables_getsToggle() {
   const phantom1 = makePhantomEmbeddedTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H336

```diff
@@ -2696,5 +2687,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 // on the grid itself; the real embedded table is owned by Pass 1).
 (function observer_AC2_addedGridRealTable_bowsOut() {
-  const realTbl = makePass1DataTable(); // non-phantom, has .rows for isDataTable
+  const realTbl = makePass1DataTable(); // not an artifact, has .rows for isDataTable
   const grid = asAddedGridNode(makeAriaGrid([realTbl]));
```

Reviewer: none. Reconciliation: applied as proposed.

#### H337

```diff
@@ -2711,6 +2702,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 })();
 
-// AC3: a phantom native <table> reached via querySelectorAll on the added node
-// gets NO toggle (Pass 1 phantom skip in the observer path).
+// AC3: an accessibility artifact <table> reached via querySelectorAll on the
+// added node gets NO pillbox (Pass 1 artifact skip in the observer path).
 (function observer_AC3_addedSubtreePhantomTable_noToggle() {
   const phantom = makePhantomEmbeddedTable();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H338

```diff
@@ -2961,5 +2952,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // -------------------------------------------------------------------------
-// Issue #4: era-marked years are dates, not offset-rounded numbers.
+// Era-marked years are dates, not offset-rounded numbers.
 // eraYearDigitRanges locates each year token bound to an era marker;
 // collectNumericCells / extractPreviewSamples must exclude such tokens from
```

Reviewer: none. Reconciliation: applied as proposed.

#### H339

```diff
@@ -3028,6 +3019,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
     nums.includes(1050000000), true);
 
-  // Regression: "~3,420 ad hoc" — "ad" was being read as the AD era marker, so
-  // the 3,420 was dropped and the cell never rounded. It must now be collected.
+  // "~3,420 ad hoc": a lowercase "ad" is not the AD era marker, so the 3,420
+  // must be collected.
   const adHocCells = collectNumericCells({
     rows: [
```

Reviewer: none. Reconciliation: applied as proposed.

#### H340

```diff
@@ -3058,8 +3049,7 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // -------------------------------------------------------------------------
-// Issue #2: when a native table is already simplified, collectNumericCells
-// reads the stored original (DR_STORE's table registry, app-model-registry
-// sprint — this used to be dataset.originalValue) rather than the rounded
-// text now showing in the cell.
+// When a native table is already simplified, collectNumericCells reads the
+// stored original (DR_STORE's table registry) rather than the rounded text
+// showing in the cell.
 // -------------------------------------------------------------------------
 (function originalValueOnSimplifiedTable() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H341

```diff
@@ -3169,11 +3159,9 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 // Every fixture below hides its numeric data behind a TH header row and a TH
 // label column so the first-row/first-column rule (itself one of the
-// divergences, tested explicitly first) doesn't confound the others.
+// divergences, tested explicitly first) does not confound the others.
 
 (function mergeLadderDivergence_outOfRange() {
-  // OLD preview copy: collectNumericCells never parsed rangeExpr or checked
-  // isInRanges — every numeric cell was sampled regardless of the sidebar's
-  // range restriction. The merged ladder now applies isInRanges exactly like
-  // the engine.
+  // The preview honours the sidebar's range restriction: the merged ladder
+  // applies isInRanges exactly like the engine.
   function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
   function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
```

Reviewer: none. Reconciliation: applied as proposed.

#### H342

```diff
@@ -3193,7 +3181,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 (function mergeLadderDivergence_firstRow() {
-  // OLD preview copy: walked every <td> with no row/column awareness — a
-  // numeric header-row <td> was sampled like any other cell. The merged
-  // ladder applies getExclusionReason's first-row rule exactly like the
+  // A numeric header-row <td> is not sampled: the merged ladder applies
+  // getExclusionReason's first-row rule exactly like the
   // engine, whose DR_DEFAULTS ships simplifyFirstRow: false.
   function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
```

Reviewer: none. Reconciliation: applied as proposed.

#### H343

```diff
@@ -3223,7 +3210,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 (function mergeLadderDivergence_percentGating() {
-  // OLD preview copy: never checked simplifyMixedPercent — a percent cell was
-  // always sampled as a pure number, even with the sidebar's percent toggle
-  // off. The merged ladder applies getExclusionReason's percent rule.
+  // With the sidebar's percent switch off, a percent cell is not sampled: the
+  // merged ladder applies getExclusionReason's percent rule.
   function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
   function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
```

Reviewer: none. Reconciliation: applied as proposed.

#### H344

```diff
@@ -3258,5 +3244,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 (function mergeLadderDivergence_quotedCell() {
   // OLD preview copy had no whole-cell-quote check — toNumber('"12345"')
-  // fails (quotes aren't stripped), so it fell into the mixed-text fallback
+  // fails (quotes are not stripped), so it fell into the mixed-text fallback
   // and extractNumbersInText happily found "12345" inside the quotes,
   // sampling a cell the engine treats as literal text and never touches.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H345

```diff
@@ -3290,7 +3276,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 (function mergeLadderDivergence_wholeCellLink() {
-  // OLD preview copy never called isCellWholeLink — a pure numeric cell whose
-  // entire visible text is a hyperlink (e.g. a linked page number) was
-  // sampled like any other pure number, even though the engine leaves it
+  // A pure numeric cell whose entire visible text is a hyperlink (e.g. a
+  // linked page number) is not sampled, because the engine leaves it
   // untouched.
   function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
```

Reviewer: none. Reconciliation: applied as proposed.

#### H346

```diff
@@ -3325,9 +3310,8 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 (function mergeLadderDivergence_superscriptMasking() {
-  // OLD preview copy never checked cell.querySelector('sup') — a whole-cell
-  // exponent like "10<sup>12</sup>" (flattened innerText "1012") was parsed
-  // as the single pure number 1012, a wrong value the engine never produces
-  // (the engine masks the exponent and, finding nothing left to round,
-  // leaves the cell untouched entirely).
+  // A whole-cell exponent like "10<sup>12</sup>" (flattened innerText
+  // "1012") must not be sampled as the single pure number 1012, a wrong value
+  // the engine never produces (the engine masks the exponent and, finding
+  // nothing left to round, leaves the cell untouched entirely).
   function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
   withSupCreateTreeWalker(() => {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H347

```diff
@@ -3368,9 +3352,8 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 (function mergeLadderParity_datesAndTimesStillExcludedFromPreview() {
   // Deliberate, UNCHANGED scope restriction (not a divergence fix): the
-  // preview band is about numeric magnitude/offset, so mode:'date' and
+  // lens preview is about numeric magnitude/offset, so mode:'date' and
   // mode:'time' decisions from the ladder are excluded from the sample pool
   // even though the ladder classifies them and the engine would simplify
-  // them. The old preview copy also excluded dates/times (via its own
-  // isDateLike/isTimeLike/isDateTimeLike checks) — this is parity, not a fix.
+  // them.
   function tdCell(text) { return withTextPiece({ tagName: 'TD', innerText: text, textContent: text }); }
   function thCell(text) { return withTextPiece({ tagName: 'TH', innerText: text, textContent: text }); }
```

Reviewer: none. Reconciliation: applied as proposed.

#### H348

```diff
@@ -3389,7 +3372,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 // The divergence tests above pin the PREVIEW path against the merged ladder.
 // They say nothing about the ENGINE path (roundTable's native-table loop),
-// which is what actually writes values into a page. Before this sprint the
-// native loop carried its own inline copy of every rule below; classifyCell
-// now makes every one of those decisions instead. A single fixture that
+// which is what actually writes values into a page; classifyCell makes every
+// one of those decisions there too. A single fixture that
 // exercises several rules together, with the exact applied cell text pinned,
 // catches a future change to the ladder's shared logic (rule order,
```

Reviewer: none. Reconciliation: applied as proposed.

#### H349

```diff
@@ -3447,5 +3429,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
   const opts = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });
 
-  // A cell with words holds its phone number and rounds its count (issue #465).
+  // A cell with words holds its phone number and rounds its count.
   const inText = 'Call 416-555-1234 about 1,613,245 units';
   const inTextRounded = 'Call 416-555-1234 about 1,500,000 units';
```

Reviewer: none. Reconciliation: applied as proposed.

#### H350

```diff
@@ -3479,7 +3461,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 })();
 
-// Issue #487: a cart totals table in European style, minimized and
-// synthetic. Before the change the clean-up deleted every comma, so "7,42€"
-// read as 742 and rounded to "700€". Every cell now stays as written on
+// A cart totals table in European style, minimized and synthetic. "7,42€"
+// must not read as 742 and round to "700€". Every cell stays as written on
 // both table kinds, and the pass writes its usual debug row.
 (function decimalComma_cartTableStaysAsWritten() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H351

```diff
@@ -3518,8 +3499,8 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 })();
 
-// Issue #487: one write-back path. Every number is patched in place, digits
-// only, grouped with US marks, and the characters around it stay where the
-// page put them. Before the change a number inside words kept no group mark
-// ("up 10000 units") while a pure cell was rebuilt with an ASCII minus sign.
+// One write-back path. Every number is patched in place, digits only,
+// grouped with US marks, and the characters around it stay where the page
+// put them: a number inside words gets its group mark ("up 10,000 units"),
+// and a pure cell keeps its own minus sign.
 (function oneWriteBackPath_onEveryTableKind() {
   const cells = ['up 12345 units', '$12345', '(1,234)', '+5%', '$ 1,234', '1 234 567', '35.0', '−1,234'];
```

Reviewer: none. Reconciliation: applied as proposed.

#### H352

```diff
@@ -3545,5 +3526,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // ---------------------------------------------------------------------------
-// Sprint engine-returns-results: the engine runs end-to-end with NO `chrome`
+// The engine runs end-to-end with NO `chrome`
 // global present at all — not even a stub. This loads the real content-script
 // bundle in a vm sandbox that never defines `chrome`. The only top-level
```

Reviewer: none. Reconciliation: applied as proposed.

#### H353

```diff
@@ -3649,11 +3630,8 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 // place write model) -> on press.
 //
-// The off step used to be a form flip that kept every marker and stored
-// original in place. The 2026-09-14 sidebar-state-removal design retired it
-// (#241): off resets, which restores every cell still in the grid and drops
-// its record. The recycling scenario is unchanged — a brand-new element was
-// never in the registry either way — and the last assertion below moves with
-// the change: the recycled-away cell's record is dropped at the off press
-// rather than surviving until the element is collectible.
+// Off resets, which restores every cell still in the grid and drops its
+// record. A brand-new element was never in the registry, and the last
+// assertion below pins that the recycled-away cell's record is dropped at
+// the off press rather than surviving until the element is collectible.
 //
 // Uses a live-scanning querySelectorAll (walks wrapper.children -> row
```

Reviewer: none. Reconciliation: applied as proposed.

#### H354

```diff
@@ -3737,5 +3715,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 // own (empty) registry — that half of the KNOWN ACCEPTED COST comment on
 // restoreTable (content.js) holds. What this test pins is the consequence
-// the sprint did NOT accept: an unrestorable cell must be left exactly as
+// that is NOT accepted: an unrestorable cell must be left exactly as
 // found — marker, title, and text untouched — instead of resetTable
 // stripping the marker and title off a cell it could not actually restore,
```

Reviewer: none. Reconciliation: applied as proposed.

#### H355

```diff
@@ -3775,6 +3753,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
   const { table: table2, dataCell: dataCell2 } = makeReinjectionFixtureTable('67,890');
   const { table: table3, dataCell: dataCell3 } = makeReinjectionFixtureTable('54,321');
-  // Scenario D fixtures (issue #262): table5 is rounded by instance 1 and
-  // then untouched — the pill's wrong-on-arrival case. table6 starts
+  // Scenario D fixtures: table5 is rounded by instance 1 and
+  // then untouched — the pillbox's wrong-on-arrival case. table6 starts
   // unrounded and is later rounded BY instance 2 itself — the sanity case
   // proving the lock keys on missing registry records, not on "rounded".
```

Reviewer: none. Reconciliation: applied as proposed.

#### H356

```diff
@@ -3881,6 +3859,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
     // --- Scenario A: the user's most natural recovery action is "reset"
     // (or an equivalent toggle-to-original click). Drive the SAME
-    // production primitive (resetTable) the sprint's own restoreTable
-    // KNOWN ACCEPTED COST comment discusses. ---
+    // production primitive (resetTable) the restoreTable KNOWN ACCEPTED COST
+    // comment discusses. ---
     const unrestorableCount = global.__ri2_resetTable(table1);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H357

```diff
@@ -3896,6 +3874,6 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
       global.__ri2_DR_STORE.getTableAppliedFlag(table1), 'simplified');
 
-    // --- Scenario B: the toggle-click path (not covered before this fix) —
-    // drives the exact wiring a real click on the toggle switch uses
+    // --- Scenario B: the pillbox-press path —
+    // drives the exact wiring a real press on the pillbox uses
     // (ui-toggle.js's click handler publishes this same intent), end to
     // end through content.js's intent:toggleTable subscriber, the settings
```

Reviewer: none. Reconciliation: applied as proposed.

#### H358

```diff
@@ -3912,12 +3890,12 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
       dataCell2.innerText, roundedText2);
 
-    // --- Scenario C (issue #254): the sidebar apply path — the one other
+    // --- Scenario C: the sidebar apply path — the one other
     // resetTable caller. Drives the real wiring end to end: a sidebar
     // settings change reaches the request:applySettings responder, which
     // writes the active table's settings and calls applySidebarRounding on
-    // it. Before the fix this ran roundTable over the already-rounded text — stamping
-    // a false "Original: <rounded value>" title over the surviving truth
-    // and recording the rounded value as the registry original of record.
-    // It must refuse instead, and tell the sidebar why nothing changed.
+    // it. Running roundTable over the already-rounded text would stamp a
+    // false "Original: <rounded value>" title over the surviving truth and
+    // record the rounded value as the registry original of record. The apply
+    // must block instead, and tell the sidebar why nothing changed.
     //
     // The new settings must DIFFER from the ones instance 1 rounded with:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H359

```diff
@@ -3951,12 +3929,12 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
       sentMessages.some((m) => m.action === 'state:rangeOk' || m.action === 'state:rangeError'), false);
 
-    // --- Scenario D (issue #262): the on-page pill on a locked table. A
+    // --- Scenario D: the on-page pillbox on a locked table. A
     // table is locked when it shows cells wearing dr-ext-rounded that the
-    // registry has no record for — the post-re-injection state. The pill
-    // must render selected AND locked on arrival (before any interaction):
+    // registry has no record for — the post-re-injection state. The pillbox
+    // must render pressed AND locked on arrival (before any interaction):
     // aria-pressed 'true' because the screen shows simplified text,
     // aria-disabled 'true' plus a hover title because nothing here can
     // change it. A table instance 2 rounded ITSELF (registry records
-    // present) must stay a normal, unlocked pill — the lock keys on
+    // present) must stay a normal, unlocked pillbox — the lock keys on
     // missing records, not on "rounded". ---
     const stub5 = makeMockButton();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H360

```diff
@@ -3990,11 +3968,9 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
       stub6.classList.contains('dr-ext-morph-locked'), false);
 
-    // --- Scenario E (issue #262): toggle clicks on a locked table must not
-    // oscillate the pillbox. Before the fix, alternating clicks flipped
-    // appliedFlag between 'simplified' and 'original' (both restore branches
-    // no-op on cells without registry records), so the pillbox toggled
-    // visually while the table never changed, and the on/off notice of the time
-    // carried enabled:false to the sidebar under a visibly simplified
-    // table. ---
+    // --- Scenario E: toggle clicks on a locked table must not
+    // oscillate the pillbox. Alternating clicks must not flip appliedFlag
+    // between 'simplified' and 'original' (both restore branches no-op on
+    // cells without registry records), which would toggle the pillbox
+    // visually while the table never changed. ---
     const stub2 = makeMockButton();
     global.__ri2_tableToggles.set(table2, stub2);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H361

```diff
@@ -4020,6 +3996,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
     const notices = sentMessages.filter((m) => m.action === 'state:settingsChanged');
-    // Issue #272 changed this contract, and issue #328 kept it: the settings
-    // notice carries the table's settings — the value the click wrote — not
+    // The settings notice carries the table's settings — the value the click wrote — not
     // the locked table's display state. Each click asks to turn the table
     // off, because the screen shows it simplified, so the table's settings
```

Reviewer: none. Reconciliation: applied as proposed.

#### H362

```diff
@@ -4156,5 +4131,5 @@ const KEY_STATS_OPTS = Object.assign({}, PATCH_GRID_OPTS, { simplifyMixedCells:
 
 // =============================================================================
-// Issue #421: cells the page rewrites
+// Cells the page rewrites
 //
 // While a table is simplified, the page can write a new value into a cell. A
```

Reviewer: none. Reconciliation: applied as proposed.

#### H363

```diff
@@ -4536,5 +4511,5 @@ const RW_CAP_ROW = /more than the .* the extension follows/;
 })();
 
-// Issue #423: a grid cell the page redraws with fewer text pieces is a
+// A grid cell the page redraws with fewer text pieces is a
 // rewritten cell. It drops its originals and simplifies fresh, so a restore
 // never stops on it and the table never locks over it.
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/setup.js`

#### H364

```diff
@@ -67,5 +67,5 @@ global.Node = { ELEMENT_NODE: 1 };
 // them together here, and re-expose DR_DEFAULTS on globalThis so test
 // assertions outside the eval can read it.
-// We also expose the per-table toggle infrastructure declared with const/let
+// We also expose the per-table pillbox infrastructure declared with const/let
 // inside the eval'd code so the auto-table-toggle test section can access them.
 const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
```

Reviewer: none. Reconciliation: applied as proposed.

#### H365

```diff
@@ -101,6 +101,6 @@ const messagingCode = sourceByName('adapters/messaging.js');
 const storeCode = sourceByName('app/store.js');
 const uiToggleCode = sourceByName('ui-toggle.js');
-// Combined source for "source-includes" assertions that no longer care which
-// content-script file a symbol physically lives in after the Phase 2 split.
+// Combined source for "source-includes" assertions that do not care which
+// content-script file holds a symbol.
 const allContentSrc = contentScriptBundle;
 eval(contentScriptBundle + `
```

Reviewer: none. Reconciliation: applied as proposed.

#### H366

```diff
@@ -122,5 +122,5 @@ globalThis.DR_CAPTURE = DR_CAPTURE;
 // the sidebar's buttons.
 globalThis.CAPTURE_MARK_GLYPHS = CAPTURE_MARK_GLYPHS;
-// Expose toggle infrastructure for tests
+// Expose pillbox infrastructure for tests
 globalThis.tableToggles = tableToggles;
 globalThis.trackedTables = trackedTables;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H367

```diff
@@ -157,5 +157,5 @@ globalThis.eraYearDigitRanges = eraYearDigitRanges;
 globalThis.formatStep = formatStep;
 globalThis.stepForOffset = stepForOffset;
-// Expose new toggle geometry constants (all are const, so direct assignment works)
+// Expose the pillbox geometry constants (all are const, so direct assignment works)
 globalThis.TOGGLE_DOT_PX = TOGGLE_DOT_PX;
 globalThis.TOGGLE_PILL_WIDTH_PX = TOGGLE_PILL_WIDTH_PX;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H368

```diff
@@ -176,13 +176,7 @@ Object.defineProperty(globalThis, '_globalTapCollapseAdded', {
   configurable: true,
 });
-// lastRightClickedTable no longer exists as a binding in content.js (sprint
-// app-model-selection moved it into DR_STORE) — this shim keeps every
-// existing test working unmodified by proxying the old name onto the
-// store's getter/setter pair, exactly like the toggleStyleInjected/
+// lastRightClickedTable proxies the active table onto DR_STORE's
+// getter/setter pair, exactly like the toggleStyleInjected/
 // _globalTapCollapseAdded shims above proxy onto their own file-level lets.
-//
-// A second shim proxied a sidebarOpen field beside it. The 2026-09-14
-// sidebar-state-removal design retired that field (#241), so the shim and
-// every assignment to it are gone from this file.
 Object.defineProperty(globalThis, 'lastRightClickedTable', {
   get() { return DR_STORE.getSelectedTable(); },
```

Reviewer: none. Reconciliation: applied as proposed.

#### H369

```diff
@@ -230,5 +224,5 @@ globalThis.reapplyTimers = reapplyTimers;
 globalThis.GRID_REAPPLY_DEBOUNCE_MS = DR_DETECTION_SETTINGS.gridRedrawDelayMs;
 // Expose the nomination step (lib/dr-table/detect.js) for the nesting and
-// pending-table suites. The step reports outcomes findTables drops, so the
+// pending-table suites. The step returns outcomes findTables drops, so the
 // suites read them here rather than through findTables.
 globalThis.chainRootOf = chainRootOf;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H370

```diff
@@ -236,5 +230,5 @@ globalThis.nominateNest = nominateNest;
 globalThis.nominateNests = nominateNests;
 // Expose the controller's pending-table state and the three functions that
-// hold, re-test, and drop a pending record (sprint pending-retest). The
+// hold, re-test, and drop a pending record. The
 // content-script bundle evaluates in its own scope, so the pending suite
 // reaches these names only through this list.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H371

```diff
@@ -247,13 +241,12 @@ globalThis.pendingObservers = pendingObservers;
 globalThis.pendingRetestTimers = pendingRetestTimers;
 globalThis.pendingRetestCounts = pendingRetestCounts;
-// Expose phantom a11y predicate and its threshold constant for tests
+// Expose the accessibility artifact predicate and its threshold constant for tests
 globalThis.isPhantomA11yTable = isPhantomA11yTable;
 globalThis.OFFSCREEN_LEFT_PX_THRESHOLD = DR_DETECTION_SETTINGS.offscreenLeftPx;
-// Expose content.js's badge/marker call-site wrapper (sprint extract-dr-table)
-// for direct unit testing.
+// Expose content.js's marker call-site wrapper for direct unit testing.
 globalThis.markAndToggleIfNewGrid = markAndToggleIfNewGrid;
-// Expose the DR_STORE-backed originals port (app-model-registry sprint) so
-// grid-adapter tests can build an adapter the same way roundTable/
-// collectNumericCells/computeGridRoundedValues do in production — a plain
+// Expose the DR_STORE-backed originals port so grid-adapter tests can build
+// an adapter the same way roundTable and collectNumericCells do in
+// production (registryAdapter) — a plain
 // makeAdapter(el) with no opts uses lib/dr-table's private default port
 // instead, which is invisible to DR_STORE and would make a test's setup
```

Reviewer: none. Reconciliation: applied as proposed.

#### H372

```diff
@@ -261,8 +254,6 @@ globalThis.markAndToggleIfNewGrid = markAndToggleIfNewGrid;
 globalThis.registryOriginalsPort = registryOriginalsPort;
 globalThis.restoreTable = restoreTable;
-// resetTable is the one way off simplified since the 2026-09-14 sidebar-
-// state-removal design retired the form flip that kept a table's markers
-// (#241). Tests that used to reach the original values through that flip
-// call this instead.
+// resetTable is the one way back to raw, so tests reach the original values
+// through it.
 globalThis.resetTable = resetTable;
 globalThis.applySidebarRounding = applySidebarRounding;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H373

```diff
@@ -284,19 +275,13 @@ function eq(name, actual, expected) {
 
 // The tab every sidebar harness below binds to. The sidebar records the tab
-// it was opened for and acts only on reports from that tab (issue #343), so
-// a harness's tab-query stub and the sender it dispatches reports from have
+// it was opened for and acts only on messages from that tab, so a
+// harness's tab-query stub and the sender it dispatches messages from have
 // to name one number. Both read it here so they cannot drift.
 const SIDEBAR_HARNESS_TAB = 42;
 const FROM_SIDEBAR_TAB = { tab: { id: SIDEBAR_HARNESS_TAB } };
 
-// Stub constructors so the module-level MutationObserver / ResizeObserver usage
-// at content.js load time does not throw in Node. The stubs are injected BEFORE
-// the eval, but since we patch globalThis here (after the eval), we need to work
-// around the fact the eval already ran. In practice the guards in content.js
-// (`if (typeof MutationObserver !== 'undefined')`) check the global at eval time.
-// The eval has already run successfully (MutationObserver was undefined → guarded).
-// These stubs are only needed for any test that directly calls createToggleForTable,
-// which itself calls `new ResizeObserver(...)`. We therefore stub ResizeObserver
-// on globalThis before those tests run.
+// The same observer stubs as above, installed again after the eval. Every
+// test that calls createToggleForTable, which constructs a ResizeObserver,
+// reads these.
 global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
 global.MutationObserver = class { observe() {} disconnect() {} };
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/sidebar.js`

#### H374

```diff
@@ -9,28 +9,24 @@
 
 (function sidebarRebind_sourceLevel() {
-  // Click-handler rebind logic now spans content.js + ui-toggle.js (Phase 2);
-  // scan the combined content-script source. Sprint app-model-selection moved
-  // the active-table reference into DR_STORE (app/store.js) — ui-toggle.js
-  // publishes an intent instead of writing content.js's variables directly, and
-  // content.js's own writes go through DR_STORE's setters instead of a bare
-  // assignment. These assertions were updated in that sprint to check the new
-  // structure instead of the old direct-assignment one.
+  // Click-handler rebind logic spans content.js + ui-toggle.js; scan the
+  // combined content-script source. The active-table reference lives in
+  // DR_STORE (app/store.js): ui-toggle.js publishes an intent, and content.js's
+  // own writes go through DR_STORE's setters.
   const contentSrc = allContentSrc;
   const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
   const storeSrc = sourceByName('app/store.js') || '';
 
-  // Whether the sidebar is open: retired by the 2026-09-14 sidebar-state-
-  // removal design (#241). These four scans pinned the field, the two
-  // handler calls that wrote it, and the one guard that read it; each now
-  // pins its absence, in the same place, so a reintroduction anywhere in the
-  // extension fails here rather than at some later symptom.
+  // Whether the sidebar is open: no context holds this value. These four
+  // scans pin the absence of the field, the two handler calls that would
+  // write it, and the one guard that would read it, so a reintroduction
+  // anywhere in the extension fails here rather than at some later symptom.
   //
-  // Scanning for the NAMES rather than for a shape is deliberate: the defect
-  // was a page-held copy of a fact only another context could correct, and
-  // any spelling of that copy brings the defect back. The scan therefore
+  // Scanning for the NAMES rather than for a shape is deliberate: a
+  // page-held copy of a fact only another context can correct goes stale,
+  // and any spelling of that copy brings the defect back. The scan therefore
   // covers the whole extension, service worker and sidebar included, not
   // just the content script.
   const SIDEBAR_STATE_NAMES = /sidebarOpen|isSidebarOpen|setSidebarOpen|state:sidebarOpenChanged/;
-  // The bus topic for "the sidebar was opened" (#325) shares the scan's
+  // The bus topic for "the sidebar was opened" shares the scan's
   // prefix and is a different thing: an event that happened, named once, not
   // a stored answer to "is it open". Its exact spelling is struck from the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H375

```diff
@@ -60,5 +56,5 @@
   eq('sidebar-state removal: state:sidebarOpened still tells the sidebar to re-read',
     /state:sidebarOpened[\s\S]{0,700}state:previewSamplesChanged/.test(contentSrc), true);
-  // The topic moved onto the bus (#325), so the needle is its bus name: a
+  // The topic moved onto the bus, so the needle is its bus name: a
   // reintroduced subscription in the content script is what this catches.
   eq('sidebar-state removal: content.js registers no branch for the close message',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H376

```diff
@@ -75,10 +71,8 @@
     /intent:toggleTable'[\s\S]{0,1200}!isTableRounded\(target\)/.test(contentSrc), true);
 
-  // content.js: sprint toggle-split consolidated the mouse and touch click
-  // branches' controller logic (which used to each carry their own switch
-  // send) into one intent:toggleTable subscriber in content.js, so the
-  // literal now appears once, not per branch. Issue #251 renamed the switch
-  // message from RESET_SIDEBAR_TO_DEFAULTS to state:tableSwitched — the sidebar's
-  // handler pulls the model's settings instead of resetting to defaults.
+  // content.js: the mouse and touch click branches share one
+  // intent:toggleTable subscriber in content.js, so the literal appears once,
+  // not per branch. On state:tableSwitched the sidebar's handler pulls the
+  // model's settings instead of resetting to defaults.
   const switchCount = (contentSrc.match(/state:tableSwitched/g) || []).length;
   eq('rebind source: state:tableSwitched is dispatched from the shared intent:toggleTable handler (>= 1 occurrence)',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H377

```diff
@@ -88,7 +82,6 @@
 
   // content.js: the intent:toggleTable handler's rebind branch publishes the
-  // select-table intent instead of assigning DR_STORE's field directly —
-  // sprint toggle-split moved this call out of ui-toggle.js along with the
-  // rest of the rebind logic, but it stays a published intent rather than a
+  // select-table intent instead of assigning DR_STORE's field directly. It
+  // stays a published intent rather than a
   // direct DR_STORE.setSelectedTable() call, keeping one place ("select
   // this table") for any caller of that concern, controller included.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H378

```diff
@@ -101,5 +94,5 @@
 
   // sidebar.js: the state:tableSwitched subscriber re-reads the model's
-  // settings (issue #251) instead of resetting the controls to the shipped
+  // settings instead of resetting the controls to the shipped
   // defaults. The block is isolated to the subscriber's own body, so the
   // negative pins below cover the whole handler and nothing beyond it.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H379

```diff
@@ -117,5 +110,5 @@
 
   // sidebar.js: state:tableSwitched handler does NOT reset the controls to the
-  // shipped defaults — that reset is what desynced the panel from the model.
+  // shipped defaults — that reset is what desynced the sidebar from the model.
   eq('rebind source: sidebar.js state:tableSwitched handler does NOT call applyDefaultsToUI()',
     /applyDefaultsToUI\s*\(\)/.test(switchHandlerBlock), false);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H380

```diff
@@ -311,6 +304,5 @@
   // -----------------------------------------------------------------
   // REGRESSION GUARD: formatOriginal must TRUNCATE, never ROUND.
-  // These assertions pin the production function against the bug where
-  // toFixed() was used (which rounds), causing e.g. 1.7999999999 -> '1.8'.
+  // A toFixed() implementation rounds, turning e.g. 1.7999999999 into '1.8'.
   // All cases below would fail under a rounding implementation.
   // -----------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H381

```diff
@@ -362,5 +354,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint sidebar-no-table-state
+// Sidebar no-table state
 // Tests for the "no table bound" state in sidebar.js.
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H382

```diff
@@ -408,5 +400,5 @@
 
   // AC2 gap check: the sidebar handles state:previewSamplesChanged by calling
-  // pullSettingsAndApplyToUI() (issue #251: every refresh re-reads the
+  // pullSettingsAndApplyToUI() (every refresh re-reads the
   // model's settings first; its chain ends in fetchPreviewSamples, which
   // calls setTableBound inside its callback). There is NO direct
```

Reviewer: none. Reconciliation: applied as proposed.

#### H383

```diff
@@ -428,7 +420,7 @@
 
   // AC4 (static): the no-table state must NOT dim/disable the sidebar sections.
-  // Behaviour changed — instead of greying the whole sidebar, the main toggle is
-  // flipped off (covered by the behavioural tests below). Guard against the old
-  // dimming rules being reintroduced.
+  // Instead of greying the whole sidebar, the main switch is flipped off
+  // (covered by the behavioural tests below). Guard against dimming rules
+  // being reintroduced.
   eq('no-table AC4: sidebar.html does NOT dim #optionsSection under body.no-table',
     /body\.no-table\s+#optionsSection/.test(sidebarHtml), false);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H384

```diff
@@ -579,5 +571,5 @@
     }
 
-    // Toggle-off behaviour: setTableBound(false) flips the main pill to off
+    // Toggle-off behaviour: setTableBound(false) flips the main switch to off
     // (rather than dimming the sidebar) and runs updateDisabledState.
     {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H385

```diff
@@ -590,12 +582,12 @@
     }
 
-    // Bind leaves the pill alone (issue #251): the settings apply that runs
+    // Bind leaves the switch alone: the settings apply that runs
     // before the bind resolves — applySettingsToUI on a pull, or
-    // applyDefaultsToUI on the pull's fallback — is the pill's only writer
-    // for the bound state. A bind that reset the pill to the shipped default
-    // is what desynced the panel from the model.
+    // applyDefaultsToUI on the pull's fallback — is the switch's only writer
+    // for the bound state. A bind that reset the switch to the shipped default
+    // would desync the sidebar from the model.
     {
       const { enabledEl, setTableBound } = makeEnv(undefined, true);
-      setTableBound(false);      // init: no table yet → pill off
+      setTableBound(false);      // init: no table yet → switch off
       enabledEl.checked = false; // the model pull applied enabled:false
       setTableBound(true);       // table resolved → bind must not touch it
```

Reviewer: none. Reconciliation: applied as proposed.

#### H386

```diff
@@ -619,7 +611,7 @@
     eq('no-table toggle: sidebar.js setTableBound calls updateDisabledState',
       /updateDisabledState\(\)/.test(setTableBoundFnBody), true);
-    // Issue #251: the bound branch must not reset the pill to the shipped
+    // The bound branch must not reset the switch to the shipped
     // default — the model (or the pull's explicit defaults fallback) is the
-    // pill's only source once a table is bound.
+    // switch's only source once a table is bound.
     eq('no-table toggle: sidebar.js setTableBound no longer references DR_DEFAULTS anywhere (issue #251)',
       /DR_DEFAULTS/.test(setTableBoundFnBody), false);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H387

```diff
@@ -641,5 +633,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint dots-tick-alignment: pct() mapping and CSS vertical alignment
+// Pct() mapping and CSS vertical alignment
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H388

```diff
@@ -660,5 +652,5 @@
     const stops = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
     const N = stops.length;
-    // pct() now closes over STOPS and snap(); supply both so the extracted body
+    // pct() closes over STOPS and snap(); supply both so the extracted body
     // runs standalone. snap() is the nearest-stop fallback for non-stop inputs.
     const snap = (v) => stops.reduce((b, s) => Math.abs(s - v) < Math.abs(b - v) ? s : b, stops[0]);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H389

```diff
@@ -758,5 +750,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings (issue #240): the depth guard itself. The cycle
+// The depth guard itself. The cycle
 // above is self-limiting (a caller-side counter stops it after one bounce);
 // this one is NOT — neither handler has a stop condition, so without the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H390

```diff
@@ -805,15 +797,10 @@
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings, adversarial: wire-payload parity with the parent
-// branch's sendToActiveTab (refactor/app-model-selection, before this sprint
-// inverted the transport). The message body itself is unchanged — {action,
-// settings}, same field names, same nesting, no extra bus-envelope fields —
-// but sendToActiveTab always passed chrome.tabs.sendMessage a THIRD argument,
-// a response callback, and used it to react to delivery: clear statusEl on
-// success, setTableBound(false) on chrome.runtime.lastError (no content
-// script on the tab). adapters/messaging.js's publish() relay calls
-// chrome.tabs.sendMessage with only two arguments — no callback — so that
-// reaction is silently gone for the settings-apply path: a real Chrome would
-// also log an "Unchecked runtime.lastError" warning on every failed delivery.
+// Adversarial: wire-payload shape of the settings apply. The message body is
+// {action, settings}, same field names, same nesting, no extra bus-envelope
+// fields, and chrome.tabs.sendMessage receives a THIRD argument, a response
+// callback, which the sidebar uses to react to delivery: clear statusEl on
+// success, setTableBound(false) when nothing answers (no content script on
+// the tab).
 // This isolates DR_BUS in its own vm sandbox (messaging.js has no DOM
 // dependency) and pins the call shape directly, independent of sidebar.js's
```

Reviewer: none. Reconciliation: applied as proposed.

#### H391

```diff
@@ -839,7 +826,6 @@
   vm.runInContext(constantsCode + '\n' + messagingCode + '\nthis.__DR_BUS = DR_BUS;', sandbox);
 
-  // The settings apply is a request (#325), so the ask is what puts it on the
-  // wire. Both verbs build the same envelope through the same tab carrier, so
-  // this still pins the shape the old sendToActiveTab sent.
+  // The settings apply is a request, so the ask is what puts it on the
+  // wire. Both verbs build the same envelope through the same tab carrier.
   sandbox.__DR_BUS.request('request:applySettings',
     { settings: { offsetTop: -2, rangeExpr: 'A1:B2' } }, () => {});
```

Reviewer: none. Reconciliation: applied as proposed.

#### H392

```diff
@@ -850,7 +836,5 @@
 
   const [tabId, msg, callback] = sentCalls[0];
-  // Issue #325 put the topic name itself on the wire, in the same action field
-  // the transport already used. The name changed; the field and the envelope
-  // shape did not.
+  // The topic name itself travels on the wire, in the action field.
   eq('wire payload: message action is the topic name',
     msg.action, 'request:applySettings');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H393

```diff
@@ -860,9 +844,8 @@
     JSON.stringify(msg.settings), JSON.stringify({ offsetTop: -2, rangeExpr: 'A1:B2' }));
 
-  // ADVERSARIAL regression pin (see PR notes): the parent's sendToActiveTab
-  // always passed a response callback (chrome.tabs.sendMessage's 3rd
-  // argument) and used it to reflect delivery failure back into the UI
-  // (setTableBound(false) on chrome.runtime.lastError) and to clear statusEl
-  // on success. This only pins the MECHANISM — that publish() still passes a
+  // ADVERSARIAL pin: the ask passes a response callback
+  // (chrome.tabs.sendMessage's 3rd argument), which reflects delivery failure
+  // back into the UI (setTableBound(false) when nothing answers) and clears
+  // statusEl on success. This only pins the MECHANISM — that the ask passes a
   // callback — not the behavior; see appModelSettings_settingsPublish_
   // deliveryFeedback_behavioral below for the behavioral coverage.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H394

```diff
@@ -872,11 +855,10 @@
 
 // ---------------------------------------------------------------------------
-// Sprint app-model-settings, adversarial fix (behavioral): the pin above only
-// proves publish() PASSES a callback to chrome.tabs.sendMessage — it says
-// nothing about what that callback does. This drives sidebar.js's real
-// applyNow() -> DR_BUS.publish() path end to end and checks the two
-// behaviors refactor/app-model-selection's sendToActiveTab had: a failed
-// delivery (chrome.runtime.lastError) must unbind the sidebar via
-// setTableBound(false); a successful delivery must clear #status.
+// Adversarial (behavioral): the pin above only proves the ask PASSES a
+// callback to chrome.tabs.sendMessage — it says nothing about what that
+// callback does. This drives sidebar.js's real applyNow() ->
+// DR_BUS.request() path end to end and checks two behaviors: a failed
+// delivery must unbind the sidebar via setTableBound(false); a successful
+// delivery must clear #status.
 // ---------------------------------------------------------------------------
 (function appModelSettings_settingsPublish_deliveryFeedback_behavioral() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H395

```diff
@@ -1031,6 +1013,6 @@
 
 // ---------------------------------------------------------------------------
-// Issue #254 (sidebar side): the state:applyBlocked / state:applyOk notice lifecycle.
-// The content script refuses a sidebar apply on a table whose registry
+// Sidebar side: the state:applyBlocked / state:applyOk notice lifecycle.
+// The content script blocks a sidebar apply on a table whose registry
 // originals did not survive re-injection (see the re-injection suite's
 // scenario C) and sends state:applyBlocked; every non-refused apply sends
```

Reviewer: none. Reconciliation: applied as proposed.

#### H396

```diff
@@ -1119,5 +1101,5 @@
         if (queuedLastError) cb(undefined);
         // The settings read answers the way the page does: settings, and
-        // the lock state, unlocked once an apply has worked (#500).
+        // the lock state, unlocked once an apply has worked.
         else if (msg.action === 'request:settings') cb({ settings: {}, locked: false });
         else cb({ ok: true });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H397

```diff
@@ -1199,6 +1181,6 @@
       statusEl.textContent, '');
 
-    // --- Issue #262: state:applyBlocked also locks the panel. The connected
-    // table is stuck showing simplified values, so the main toggle must
+    // --- state:applyBlocked also locks the sidebar. The bound table is
+    // unrestorable and shows simplified values, so the main switch must
     // show ON (the truth) and stop accepting input, and the settings area
     // dims via body.table-locked. state:applyOk, a table switch
```

Reviewer: none. Reconciliation: applied as proposed.

#### H398

```diff
@@ -1257,7 +1239,7 @@
     if (h.evalError !== null || !h.hasHandler()) return;
 
-    // Drift the panel away from the model: the pill shows on (as the old
-    // defaults reset left it), the range expression is blank, and the
-    // previous table's apply left the panel locked.
+    // Drift the sidebar away from the model: the switch shows on (as a
+    // defaults reset would leave it), the range expression is blank, and the
+    // previous table's apply left the sidebar locked.
     h.enabledEl.checked = true;
     h.rangeExprEl.value = '';
```

Reviewer: none. Reconciliation: applied as proposed.

#### H399

```diff
@@ -1302,6 +1284,6 @@
     if (h.evalError !== null || !h.hasHandler()) return;
 
-    // Drift the pill on, then deliver the stale-view signal. The old bare
-    // preview fetch ended in setTableBound(true), which reset the pill to
+    // Drift the switch on, then deliver the stale-view signal. A bare
+    // preview fetch would end in setTableBound(true) and reset the switch to
     // the shipped default (on) — the model says off.
     h.enabledEl.checked = true;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H400

```diff
@@ -1326,6 +1308,6 @@
     if (h.evalError !== null || !h.hasHandler()) return;
 
-    // Issue #262's lock forces the main toggle ON + disabled (the bound
-    // table is stuck simplified). A settings pull that resolves while the
+    // The lock forces the main switch ON + disabled (the bound table is
+    // unrestorable and shows simplified values). A settings pull that resolves while the
     // lock is displayed — a table switch's pull whose apply just re-blocked —
     // must not write the model's enabled:false over the lock's forced ON.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H401

```diff
@@ -1336,5 +1318,5 @@
       h.bodyClasses.has('table-locked'), true);
 
-    // The table is still locked, so the page's read answers locked (#500).
+    // The table is still locked, so the page's read answers locked.
     h.readAnswer.locked = true;
     h.dispatch({ action: 'state:previewSamplesChanged' });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H402

```diff
@@ -1350,6 +1332,6 @@
 })();
 
-// Issue #500: the lock reaches the sidebar through the settings read, so a
-// sidebar that missed the one-time "blocked" report still shows the lock.
+// The lock reaches the sidebar through the settings read, so a sidebar that
+// missed the one-time "blocked" notice still shows the lock.
 // Case 2: the sidebar opens on a locked table, and its opening read answers
 // locked.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H403

```diff
@@ -1411,12 +1393,11 @@
 
 // ---------------------------------------------------------------------------
-// Issue #275: the context-menu toggle must go through the same controller
-// branch a pill click uses. The right-click that opens the menu already
-// connects the table (the contextmenu handler calls setSelectedTable), so
-// with the sidebar open, "Toggle table" on that table must write the
-// table's settings and send them (the settings notice, issue #328) — the
-// #272 contract. Before the fix, intent:menuClicked simplified the table
-// directly: the page changed, the settings and the sidebar both went stale,
-// and the next reopen or switch re-imposed the stale settings. Fresh-eval fixture modeled on the
+// The context-menu toggle must go through the same controller branch a
+// pillbox press uses. The right-click that opens the menu already activates
+// the table (the contextmenu handler calls setSelectedTable), so with the
+// sidebar open, "Toggle table" on that table must write the table's settings
+// and send them (the settings notice). A menu path that simplified the table
+// directly would leave the settings and the sidebar stale, and the next
+// reopen or switch would re-impose the stale settings. Fresh-eval fixture modeled on the
 // double-invocation test above; same minimal grid, real captured handlers.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H404

```diff
@@ -1527,11 +1508,9 @@
 
 // ---------------------------------------------------------------------------
-// Issue #272, leak 2: the #262 lock's forced ON must be display-only. Before
-// the fix, a save under the lock wrote the forced ON into the settings —
-// silently discarding the user's off — and the forced ON outlived the lock
-// until the next pull. The sidebar held a copy of the on/off value under the
-// lock to guard this until issue #328 moved the value onto the table in the
-// application model; the issue328 lock tests below pin the save, the lift,
-// and a notice under the lock. These two keep the lock's edges.
+// The lock's forced ON must be display-only. A save under the lock that
+// wrote the forced ON into the settings would silently discard the user's
+// off, and the forced ON would outlive the lock until the next pull. The
+// issue328 lock tests below pin the save, the lift, and a notice under the
+// lock. These two keep the lock's edges.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H405

```diff
@@ -1570,5 +1549,5 @@
 
 // A pull resolving under the lock reads the table's enabled:false. The display
-// must not change (pinned by the #251 lock-vs-pull test above), and the lift
+// must not change (pinned by the lock-vs-pull test above), and the lift
 // shows the table's value, not the value the switch showed before the lock.
 (function issue272_pullUnderLockLeavesTheLiftToTheTable() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H406

```diff
@@ -1585,5 +1564,5 @@
     h.enabledEl.checked = true;
     h.dispatch({ action: 'state:applyBlocked', count: 1 });
-    // The table is still locked, so the read answers locked (#500).
+    // The table is still locked, so the read answers locked.
     h.readAnswer.locked = true;
     h.dispatch({ action: 'state:previewSamplesChanged' });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H407

```diff
@@ -1601,8 +1580,7 @@
 
 // ---------------------------------------------------------------------------
-// Issue #328: the settings notice reaches the sidebar, and the sidebar
-// redraws from it. The content script sent narrower notices by hand, one per
-// kind of change, so a writer that sent none left the sidebar showing stale
-// values. A notice carries whether its table is the active one and which side
+// The settings notice reaches the sidebar, and the sidebar redraws from it.
+// The model publishes it after every write, so no writer can leave the
+// sidebar showing stale values. A notice carries whether its table is the active one and which side
 // wrote it. The sidebar redraws from a notice for the active table that
 // something other than the sidebar wrote. It skips its own writes, because an
```

Reviewer: none. Reconciliation: applied as proposed.

#### H408

```diff
@@ -1690,10 +1668,10 @@ const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
 
 // ---------------------------------------------------------------------------
-// Issue #328 with the #262 lock: the lock forces the switch on and disables
+// The settings notice with the lock: the lock forces the switch on and disables
 // it. The on/off value lives on the table in the application model, so a save
 // under the lock leaves the on/off value out, and the table's value stands.
 // Lifting the lock reads the table's settings back and puts its on/off value
 // on the switch. Until that read answers the switch stays disabled, so a save
-// in the gap carries no leftover forced on (#272's hazard).
+// in the gap carries no leftover forced on.
 // ---------------------------------------------------------------------------
 (function issue328_aSaveUnderTheLockLeavesTheOnOffValueOut() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H409

```diff
@@ -1749,5 +1727,5 @@ const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
     h.tabMessages.length = 0;
     h.dispatch({ action: 'state:applyOk' });
-    // The read's answer carries the lock state (#500), so the lock holds
+    // The read's answer carries the lock state, so the lock holds
     // until the answer lands.
     eq('lock lift: the lock holds until the read answers', h.bodyClasses.has('table-locked'), true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H410

```diff
@@ -1876,5 +1854,5 @@ const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
 })();
 
-// #308: the mark glyphs live in two machine copies — the sidebar's buttons
+// The mark glyphs live in two machine copies — the sidebar's buttons
 // and the renderer's map — and one copy cannot read the other (static
 // markup against a content-script constant). This pin holds them together:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H411

```diff
@@ -1906,5 +1884,5 @@ const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
 })();
 
-// --- The sidebar serves one tab (issue #343) --------------------------------
+// --- The sidebar serves one tab --------------------------------
 //
 // A content script reports by broadcast, and a broadcast reaches the sidebar
```

Reviewer: none. Reconciliation: applied as proposed.

#### H412

```diff
@@ -2066,7 +2044,6 @@ const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
   // stops being the front tab, and misses two routes: an idle restart empties
   // the tab number it compares against, and a sidebar opened from Chrome's
-  // own side-panel control never sets it. On those routes the sidebar used to
-  // survive the switch and keep showing controls for a page the user had
-  // left. It closes itself now, so a tab switch has one outcome.
+  // own side-panel control never sets it. On those routes the sidebar closes
+  // itself, so a tab switch has one outcome.
   (function closesOnSwitchAway() {
     const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H413

```diff
@@ -2118,5 +2095,5 @@ const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
 
   // A tabs interface with no activation event must not throw. The sidebar
-  // then never closes itself, which is its behavior before this change.
+  // then never closes itself.
   (function noActivationEvent() {
     const bus = makeBus();
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/tests/source-checks.js`

#### H414

```diff
@@ -1,5 +1,5 @@
 // Checks that read source files, the manifest, bundles, or the living docs as text.
 
-// --- Sprint icon-no-sidebar: manifest + background invariants ---
+// --- Manifest + background invariants ---
 // NOTE: These are static-analysis proxies only. Whether the toolbar icon
 // actually disappears in Chrome, and whether the context menu visually works,
```

Reviewer: none. Reconciliation: applied as proposed.

#### H415

```diff
@@ -17,5 +17,5 @@
     Object.prototype.hasOwnProperty.call(manifest, 'action'), false);
 
-  // 2. "side_panel" must still be present — the panel itself must remain registered.
+  // 2. "side_panel" must still be present — the sidebar itself must remain registered.
   eq('manifest: "side_panel" key still present',
     Object.prototype.hasOwnProperty.call(manifest, 'side_panel'), true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H416

```diff
@@ -45,9 +45,7 @@
 })();
 
-// --- AC6: scope guard removed — was a git-diff-based assertion that
-// presumed a single-commit sprint and breaks in a stacked-PR world.
-// The content-based regression guards in the quote and decimal blocks
-// (which assert no sibling files contain new identifiers) cover the same
-// intent without depending on git history shape.
+// --- AC6: the content-based regression guards in the quote and decimal
+// blocks (which assert no sibling files contain new identifiers) cover scope
+// without depending on git history shape.
 
 // --- Static analysis: link-aware functions are defined and exported ---
```

Reviewer: none. Reconciliation: applied as proposed.

#### H417

```diff
@@ -70,5 +68,5 @@
 })();
 
-// --- Sprint decimal-precision-display: regression guards ---
+// --- Regression guards ---
 
 (function sprintRegressionGuards() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H418

```diff
@@ -98,5 +96,5 @@
 })();
 
-// --- Sprint sidebar-defaults-and-layout ---
+// --- Sidebar defaults and layout ---
 
 (function sprintSidebarDefaultsAndLayout() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H419

```diff
@@ -116,5 +114,5 @@
   }
 
-  // AC1/AC2: Sidebar UI defaults now live in constants.js (single source of
+  // AC1/AC2: Sidebar UI defaults live in constants.js (single source of
   // truth shared with content.js). The HTML must NOT hard-code checked /
   // selected attributes — they would shadow the JS-applied defaults.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H420

```diff
@@ -152,7 +150,4 @@
     ]), true);
 
-  // AC3: (sidebar-tidyup) the old "section-heading" with "Include numbers in cells containing:"
-  // was removed in the sidebar-tidyup sprint — no replacement test needed here.
-
   // AC4a: rangeSection div has "hidden" attribute.
   eq('sidebar-defaults: rangeSection has hidden attribute',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H421

```diff
@@ -164,5 +159,5 @@
     sidebarHtml.includes('id="rangeSection"'), true);
 
-  // AC5: parseRangeExpr is still defined (now in parsing.js after Phase 2 split).
+  // AC5: parseRangeExpr is defined (in parsing.js).
   eq('sidebar-defaults: content scripts still define parseRangeExpr',
     /function parseRangeExpr\b/.test(allContentSrc), true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H422

```diff
@@ -205,5 +200,5 @@
 
 (function atToggle_contentJsDeclarations() {
-  // Toggle widget infrastructure lives in ui-toggle.js after the Phase 2 split;
+  // Pillbox infrastructure lives in ui-toggle.js;
   // scan the combined content-script source so the contract is location-agnostic.
   const src = allContentSrc;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H423

```diff
@@ -232,5 +227,5 @@
 
 (function accessibilityAC2_focusVisibleCSS() {
-  const src = allContentSrc; // toggle CSS now in ui-toggle.js (Phase 2 split)
+  const src = allContentSrc; // pillbox CSS lives in ui-toggle.js
 
   eq('accessibility AC2: content.js CSS contains :focus-visible selector',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H424

```diff
@@ -259,5 +254,5 @@
 
 (function morphAC_constantsUsedInCSS() {
-  const src = allContentSrc; // toggle geometry now in ui-toggle.js (Phase 2 split)
+  const src = allContentSrc; // pillbox geometry lives in ui-toggle.js
 
   // The CSS function body should contain interpolations of the constants, not bare literals.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H425

```diff
@@ -341,7 +336,6 @@
   eq('sidebar.html does not load content-only ui-toast.js', sidebarHtml.includes('ui-toast.js'), false);
 
-  // NOTE: the main bootstrap eval() (the setup piece) no longer concatenates
-  // coreCode/parsingCode/detectCode/uiToggleCode/code directly — it evals
-  // the manifest-driven contentScriptBundle instead (see the
+  // NOTE: the main bootstrap eval() (the setup piece) evals the
+  // manifest-driven contentScriptBundle (see the
   // manifestDrivenSourceLoading self-test below for that ordering guarantee).
   // This assertion instead checks that later per-layer eval sites in the suite
```

Reviewer: none. Reconciliation: applied as proposed.

#### H426

```diff
@@ -364,5 +358,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint sidebar-tidyup: flat toggle list, new defaults, switch wrappers
+// Flat toggle list, new defaults, switch wrappers
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H427

```diff
@@ -488,5 +482,5 @@
 
 // =============================================================================
-// Sprint sidebar-pill-left: toggle switch appears left of label in every row
+// Toggle switch appears left of label in every row
 // =============================================================================
 //
```

Reviewer: none. Reconciliation: applied as proposed.

#### H428

```diff
@@ -616,12 +610,12 @@
 
 // --- Old keys (excludeDates / excludeTimes) must be absent from content.js and constants.js ---
-// These were renamed to simplifyDates/simplifyTimes in this sprint.
-// If the old names are still present as property assignments or conditions, the
+// The keys are simplifyDates/simplifyTimes.
+// If the old names are present as property assignments or conditions, the
 // inversion is incomplete and rounding behaviour would be controlled by the wrong key.
 (function invertPills_oldKeysAbsent() {
   const contentSrc = sourceByName('content.js');
-  // Sprint merge-ladder moved the simplifyDates/simplifyTimes option reads
-  // (and every other classification-ladder rule) out of content.js and into
-  // lib/dr-simplify/ladder.js; content.js now only calls classifyCell.
+  // The simplifyDates/simplifyTimes option reads (and every other
+  // classification-ladder rule) live in lib/dr-simplify/ladder.js; content.js
+  // only calls classifyCell.
   const ladderSrc = sourceByName('lib/dr-simplify/ladder.js');
   if (contentSrc === null || constantsCode === null || ladderSrc === null) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H429

```diff
@@ -650,5 +644,5 @@
 
   // Conversely, simplifyDates and simplifyTimes MUST appear in each file.
-  // content.js references them only transitively now (via opts passed to
+  // content.js references them only transitively (via opts passed to
   // classifyCell) — the ladder is the actual point of use.
   eq('invert-pills regression: lib/dr-simplify/ladder.js references simplifyDates',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H430

```diff
@@ -706,6 +700,5 @@
 
 // TA5: source-scan — no role="gridcell" or data-row-index literals in content.js
-// Per AC4 of the grid-adapter sprint, these stale Sprint 1 selectors must have
-// been replaced by role="cell" / data-row / data-index.
+// The adapters read role="cell" / data-row / data-index instead.
 (function sourceNoLegacySelectors() {
   const contentSrc = sourceByName('content.js');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H431

```diff
@@ -761,5 +754,5 @@
 //
 // background.js runs in a service-worker context without the DOM and module
-// system our harness uses, so we can't eval() it directly alongside the content
+// system our harness uses, so we cannot eval() it directly alongside the content
 // scripts. Instead we test the guard at two levels:
 //   (a) Static analysis: the source contains the null-guard exactly as specced.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H432

```diff
@@ -768,11 +761,10 @@
 // ---------------------------------------------------------------------------
 
-// --- #325 Task 8: the settings notice reaches the sidebar exactly once ---
+// --- The settings notice reaches the sidebar exactly once ---
 //
 // The content script broadcasts the settings notice to every extension page,
-// which already includes the open sidebar. The worker used to receive the
-// on/off report (retired under #328 for the settings notice) and send it
-// again, so the sidebar redrew twice on one fact. The relay is gone, and with
-// it the guard it needed: one publisher, one delivery.
+// which already includes the open sidebar. A worker relay would deliver it
+// twice, so the sidebar would redraw twice on one fact: one publisher, one
+// delivery.
 (function onOffReportDeliveredOnce() {
   const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H433

```diff
@@ -786,5 +778,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint extract-dr-table (adversarial hardening): static purity scan.
+// Static purity scan.
 // Detection functions (findTargetTable, findTables, looksLikeGrid, isDataTable,
 // isPhantomA11yTable) must never write to the page — no classList.add,
```

Reviewer: none. Reconciliation: applied as proposed.

#### H434

```diff
@@ -846,6 +838,6 @@
       add(cls)    { bodyClasses.add(cls); },
       contains(cls) { return bodyClasses.has(cls); },
-      // The sidebar's opening read runs after the tab lookup now, and it
-      // reaches this on the way (issue #343). Without it the eval stops
+      // The sidebar's opening read runs after the tab lookup, and it
+      // reaches this on the way. Without it the eval stops
       // before the lookup and the sidebar binds to no tab.
       toggle(cls, force) {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H435

```diff
@@ -883,9 +875,9 @@
       // The sidebar tags its status message with a source and clears the tag
       // again. Without this the eval stops there, before the tab lookup the
-      // opening read now runs behind (issue #343).
+      // opening read runs behind.
       dataset: {},
       closest()  { return null; },
-      // A right-click activation now reads the settings back and redraws the
-      // controls (issue #328), and the redraw sets the lens control's
+      // A right-click activation reads the settings back and redraws the
+      // controls, and the redraw sets the lens control's
       // attributes.
       setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
```

Reviewer: none. Reconciliation: applied as proposed.

#### H436

```diff
@@ -914,6 +906,6 @@
       sendMessage: () => {},
     },
-    // The sidebar records the tab it was opened for and acts only on reports
-    // from that tab (issue #343), so this harness answers with one. No
+    // The sidebar records the tab it was opened for and acts only on messages
+    // from that tab, so this harness answers with one. No
     // sendMessage: the opening read then goes unanswered and the sidebar
     // falls to its unbound state, which is what this section already assumed.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H437

```diff
@@ -987,10 +979,9 @@
 })();
 
-// AC4 (runtime): the worker relays no activation report into a tab, whether or
-// not it holds a sidebar tab number. The relay retired before #325; what #325
-// changes is where the claim is read from — the worker holds no message
-// listener of its own now, so the listener under test is the bus's, and the
-// worker's own subscriptions are the only thing that could act on an arriving
-// topic. It subscribes to no activation report, so nothing does.
+// AC4 (runtime): the worker relays no activation topic into a tab, whether or
+// not it holds a sidebar tab number. The worker holds no message listener of
+// its own, so the listener under test is the bus's, and the worker's own
+// subscriptions are the only thing that could act on an arriving topic. It
+// subscribes to no activation topic, so nothing does.
 (function tableContextmenuActivation_backgroundRelay() {
   const sentTabMessages = [];
```

Reviewer: none. Reconciliation: applied as proposed.

#### H438

```diff
@@ -1066,12 +1057,12 @@
 
 // ---------------------------------------------------------------------------
-// END Sprint table-contextmenu-activation tests
+// END right-click activation tests
 // ---------------------------------------------------------------------------
 
-// Sprint advanced-lower-dot-brown: linked-state bot thumb/label colour change
+// Linked-state bot thumb/label colour change
 // AC1. Linked-state bot thumb background is #c48a6a (brown), NOT grey #9aa0a6.
 // AC2. Decoupled-state bot thumb is still #b3623d (unchanged).
 // AC3. Linked-state bot LABEL color matches the linked thumb (same hex #c48a6a).
-// AC4. Old grey #9aa0a6 no longer appears for either of these two rules.
+// AC4. Grey #9aa0a6 appears in neither of these two rules.
 // AC5. The linked brown (#c48a6a) is lighter than the decoupled brown (#b3623d).
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H439

```diff
@@ -1085,5 +1076,5 @@
 
   // --- AC1 (negative): .dual-thumb.bot.linked does NOT use grey #9aa0a6 ---
-  // Extract the specific rule so we don't false-positive on other rules.
+  // Extract the specific rule so we do not false-positive on other rules.
   const linkedThumbRuleMatch = sidebarHtml.match(/\.dual-thumb\.bot\.linked\s*\{[^}]*\}/);
   const linkedThumbRule = linkedThumbRuleMatch ? linkedThumbRuleMatch[0] : '';
```

Reviewer: none. Reconciliation: applied as proposed.

#### H440

```diff
@@ -1115,5 +1106,5 @@
     linkedLabelHex, linkedThumbHex);
 
-  // --- AC4: Old grey #9aa0a6 no longer appears in either of these two rules ---
+  // --- AC4: Grey #9aa0a6 appears in neither of these two rules ---
   // (linked thumb rule checked above; now check the linked label rule)
   const linkedLabelRuleMatch = sidebarHtml.match(/#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*\}/);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H441

```diff
@@ -1141,8 +1132,8 @@
 
 // ---------------------------------------------------------------------------
-// Sprint sidebar-preview-and-controls
-// AC1 (Bug #2): request:applySettings sends a synchronous response
-// AC2 (Bug #3): formatStrategyHeader re-basing — mag=3 exhaustive table
-// AC3 (Bug #1): embedded-in-text numbers feed maxMag
+// Sidebar lens preview and controls
+// AC1: request:applySettings sends a synchronous response
+// AC2: formatStrategyHeader re-basing — mag=3 exhaustive table
+// AC3: embedded-in-text numbers feed maxMag
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H442

```diff
@@ -1248,8 +1239,7 @@
     return;
   }
-  // The branch became a responder in issue #325. A responder answers by
-  // returning, so the acknowledgement now reads as a return of the answer
-  // rather than a sendResponse call. The behavior it guards is unchanged: the
-  // asker must receive something, because receiving nothing is what unbinds
+  // The branch is a responder. A responder answers by returning, so the
+  // acknowledgement reads as a return of the answer rather than a
+  // sendResponse call. The asker must receive something, because receiving nothing is what unbinds
   // the sidebar.
   eq('AC1-src: the request:applySettings responder returns an answer',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H443

```diff
@@ -1267,12 +1257,9 @@
 // follow, and both are asserted at runtime rather than by source regex:
 //
-//   1. Closing the sidebar notifies the sidebar page alone. A second send,
-//      aimed at the tab, used to tell the content script to clear its own
-//      copy of "the sidebar is open". The 2026-09-14 sidebar-state-removal
-//      design retired that copy (#241), and the content script registers no
-//      branch for this message, so the tab-directed send would deliver to
-//      nothing.
+//   1. Closing the sidebar notifies the sidebar page alone. The content
+//      script registers no branch for this message, so a tab-directed send
+//      would deliver to nothing.
 //   2. state:tableActivated must not be relayed into the tab. content.js already
-//      sends it with runtime.sendMessage, which the panel receives directly.
+//      sends it with runtime.sendMessage, which the sidebar receives directly.
 //      Relaying it to sidebarTabId delivers it to a content script that has no
 //      handler for that action.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H444

```diff
@@ -1287,5 +1274,5 @@
   // synchronously, letting us assert without async plumbing.
   //
-  // The worker runs on the bus (#325), so the bus source goes into the same
+  // The worker runs on the bus, so the bus source goes into the same
   // function scope ahead of it, standing in for the importScripts the browser
   // runs. The stub's chrome interfaces follow Chrome's callback contract, which
```

Reviewer: none. Reconciliation: applied as proposed.

#### H445

```diff
@@ -1392,5 +1379,5 @@
 
     // A removed tab: the close must not surface an error. The broadcast is
-    // all that goes out now, and the stub rejects it, so this pins the
+    // all that goes out, and the stub rejects it, so this pins the
     // service worker's own catch.
     const goneCtx = loadBackground({ closeSidebarUnreceived: true });
```

Reviewer: none. Reconciliation: applied as proposed.

#### H446

```diff
@@ -1426,5 +1413,5 @@
     // guard comparing the two alone would match nothing against nothing and
     // broadcast the close. An idle restart reaches this state: Chrome clears
-    // the worker's variables while the panel stays open.
+    // the worker's variables while the sidebar stays open.
     unload({});
     eq('page unload: an extension page closes nothing while no sidebar is open', closes(), 0);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H447

```diff
@@ -1476,5 +1463,5 @@
   // anywhere in the suite, whether directly (`readFileSync('content.js')`,
   // or `path.join(__dirname, 'content.js')` assigned to a path variable
-  // that's read next) or indirectly (a hardcoded array mixing content-script
+  // that is read next) or indirectly (a hardcoded array mixing content-script
   // names with other names, later iterated by a loop that reads via
   // readFileSync/path.join). A loop-variable read fed by the manifest itself
```

Reviewer: none. Reconciliation: applied as proposed.

#### H448

```diff
@@ -1483,5 +1470,5 @@
   // Guarded lookups (sourceByName(...), contentScriptSources.get(...)) and
   // eq()/comment text that merely name a file are not reads and are stripped
-  // first so they can't hide a real violation or false-positive one.
+  // first so they cannot hide a real violation or false-positive one.
   const testsSelfSource = SUITE_SOURCE;
   const literalAlternation = CONTENT_SCRIPT_FILES.join('|').replace(/\./g, '\\.');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H449

```diff
@@ -1550,18 +1537,4 @@
   // NOTE: this count changes when a content-script package is added to or
   // removed from manifest.json; update it alongside the manifest edit.
-  // Sprint extract-dr-number replaced rounding.js/core.js/parsing.js with the
-  // four-file lib/dr-number package (rounding.js, core.js, parsing.js,
-  // index.js), raising the count from 7 to 8. Sprint extract-dr-table then
-  // replaced dom-adapters.js with the two-file lib/dr-table package
-  // (detect.js, index.js), raising the count from 8 to 9. Sprint merge-ladder
-  // then added the two-file lib/dr-simplify package (ladder.js, index.js),
-  // raising the count from 9 to 11. Sprint app-model-selection then added
-  // adapters/messaging.js and app/store.js, raising the count from 11 to 13.
-  // The capture feature then added the log buffer (lib/dr-log/index.js) and
-  // the three-file lib/dr-capture package (state.js, render.js, index.js),
-  // raising the count from 13 to 17. The error-surfacing feature then added
-  // the toast view (ui-toast.js), raising the count from 17 to 18. The
-  // identifier shapes (lib/dr-number/identifiers.js) then raised it from 18
-  // to 19.
   eq('manifest-driven loading: manifest content_scripts[0].js lists exactly 19 files today',
     manifest.content_scripts[0].js.length, 19);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H450

```diff
@@ -1569,7 +1542,7 @@
 
 // ---------------------------------------------------------------------------
-// Sprint extract-dr-number: the pure number-logic package now lives under
-// lib/dr-number/ (rounding.js, core.js, parsing.js, index.js). These two
-// tests are the discipline checks the sprint calls for: (a) index.js's only
+// The pure number-logic package lives under
+// lib/dr-number/ (rounding.js, core.js, parsing.js, identifiers.js,
+// index.js). These two tests are the package discipline checks: (a) index.js's only
 // job — assigning every public function onto one DR_NUMBER bundle — actually
 // happened, and (b) every lib/ content script the manifest lists loads before
```

Reviewer: none. Reconciliation: applied as proposed.

#### H451

```diff
@@ -1606,8 +1579,7 @@
 
 // ---------------------------------------------------------------------------
-// Sprint delete-dead-code removed ROUND_DYNAMIC, singleValueMode, datasetMode,
-// and validateOffset from core.js as unreachable: nothing in the extension
-// ever called ROUND_DYNAMIC or the two mode functions it dispatched to, and
-// validateOffset only existed to serve them. These typeof checks read the
+// ROUND_DYNAMIC, singleValueMode, datasetMode, and validateOffset belong to
+// the Sheets library, not the extension: nothing in the extension calls
+// them. These typeof checks read the
 // bare names the main eval's function declarations leave in this module's
 // scope (the same sloppy-mode leak DR_NUMBER's helpers rely on before their
```

Reviewer: none. Reconciliation: applied as proposed.

#### H452

```diff
@@ -1689,5 +1661,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint extract-dr-table: table detection now lives under lib/dr-table/
+// Table detection lives under lib/dr-table/
 // (detect.js, index.js), mirroring the lib/dr-number package structure and
 // discipline checks above. Four groups of tests:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H453

```diff
@@ -1699,5 +1671,5 @@
 //   2. The jsdom-less criterion: detection runs with no Chrome globals at all.
 //   3. VendorProfiles: a custom list replaces (not merges with) the default.
-//   4. findTables' tableFilter: default drops a phantom a11y table; a
+//   4. findTables' tableFilter: default drops a accessibility artifacts; a
 //      pass-through filter keeps it.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H454

```diff
@@ -1751,8 +1723,8 @@
 
 // ---------------------------------------------------------------------------
-// Sprint detection-constants: every detection setting and both lookup
-// lists now have one home, the detection settings (DR_DETECTION_SETTINGS, in
-// the configuration file constants.js), with no behavior change. The
-// pillbox auto-collapse delay, once beside them, lives in the pillbox view
+// Every detection setting and both lookup
+// lists have one home, the detection settings (DR_DETECTION_SETTINGS, in
+// the configuration file constants.js). The
+// pillbox auto-collapse delay lives in the pillbox view
 // (ui-toggle.js) as its own constant: the view alone reads it. Four groups
 // of tests:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H455

```diff
@@ -2038,14 +2010,10 @@
 
 // =============================================================================
-// Sprint merge-ladder: lib/dr-simplify classification ladder
+// Lib/dr-simplify classification ladder
 // =============================================================================
 //
-// Before this sprint the classification ladder existed as two hand-kept-in-
-// sync copies: the engine's per-cell loop in content.js (itself duplicated
-// between the native-<table> path and computeGridRoundedValues, which
-// documented itself as needing to match the native path "EXACTLY") and a much
-// thinner copy in the sidebar preview-sample extractor (collectNumericCells /
-// extractPreviewSamples) that skipped most of the rules outright. All three
-// now call classifyCell (lib/dr-simplify/ladder.js).
+// The engine's per-cell pass in content.js and the lens preview extractor
+// (collectNumericCells / extractPreviewSamples) both call classifyCell
+// (lib/dr-simplify/ladder.js).
 //
 // This section has three parts:
```

Reviewer: none. Reconciliation: applied as proposed.

#### H456

```diff
@@ -2053,7 +2021,6 @@
 //   2. classifyCell unit tests — one per ladder rule, exercised directly with
 //      plain data (no DOM), matching the file's PURE contract.
-//   3. Divergence tests — the preview extractor used to skip almost every
-//      rule below; each test pins the MERGED (engine-wins) behavior and
-//      documents what the old preview copy did instead.
+//   3. Divergence tests — each test pins the MERGED (engine-wins) behavior
+//      the lens preview extractor follows.
 
 // --- 1. Package discipline ---
```

Reviewer: none. Reconciliation: applied as proposed.

#### H457

```diff
@@ -2088,5 +2055,5 @@
 
 // ---------------------------------------------------------------------------
-// Sprint engine-returns-results: static purity scan.
+// Static purity scan.
 // The simplification engine (roundTable, the one simplification pass —
 // simplifyTableCells, classifyTableCell, cellPatches — and
```

Reviewer: none. Reconciliation: applied as proposed.

#### H458

```diff
@@ -2133,23 +2100,16 @@
 
 // ---------------------------------------------------------------------------
-// Sprint engine-returns-results: pin the exact state:rangeOk/state:rangeError message
+// Pin the exact state:rangeOk/state:rangeError message
 // sequence for one full apply (applySidebarRounding -> roundTable ->
 // sendRangeStatusMessage -> chrome.runtime.sendMessage).
 //
-// The flow used to start at a plain-toggle helper, which the 2026-09-14
-// sidebar-state-removal design retired (#241). The apply is the one path to
-// roundTable now, so it drives the flow here. It leads with its own state:applyOk,
-// which the retired helper never sent; the state:rangeOk/state:rangeError and
-// intent:updateMenuLabel tail is byte-identical to the frozen capture.
+// The apply is the one path to roundTable, so it drives the flow here. It
+// leads with its own state:applyOk, then the state:rangeOk/state:rangeError
+// and intent:updateMenuLabel tail.
 //
-// Before this sprint, roundTable sent state:rangeError/state:rangeOk itself. Now the
-// engine returns { applied, rangeStatus, error } and the controller sends the
-// message. The two expected sequences below (one per range-validity branch)
-// were verified byte-for-byte against content.js as it stood at commit
-// 4340bd1 (the refactor/merge-ladder tip this sprint branched from) by
-// running that commit's real content.js through this same vm harness and
-// diffing the captured chrome.runtime.sendMessage sequence against the one
-// captured here. They were identical. This test pins that verified sequence
-// so a future change cannot silently drop or duplicate a message.
+// The engine returns { applied, rangeStatus, error } and the controller
+// sends the message. The two expected sequences below (one per
+// range-validity branch) are literals, so a future change cannot silently
+// drop or duplicate a message.
 // ---------------------------------------------------------------------------
 (function engineReturnsResults_rangeStatusMessageSequence() {
```

Reviewer: none. Reconciliation: applied as proposed.

#### H459

```diff
@@ -2285,13 +2245,10 @@
 
 // ---------------------------------------------------------------------------
-// Sprint toggle-split: ui-toggle.js splits into drawing (render from state,
+// Ui-toggle.js splits into drawing (render from state,
 // hold only view-transient state) and publishing (intents on DR_BUS in place
-// of calls into the controller). The click handler used to call the
-// controller's plain-toggle helper straight from the view.
+// of calls into the controller).
 //
-// The forbidden list named that helper and the form-flip helper it reached
-// until the 2026-09-14 sidebar-state-removal design retired both (#241). A
-// list of names that exist nowhere cannot fail, so the list now names the
-// controller entry points that DO exist: a view calling any of these reaches
+// A list of names that exist nowhere cannot fail, so the forbidden list
+// names the controller entry points that DO exist: a view calling any of these reaches
 // past the intent and around the one press path.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H460

```diff
@@ -2323,7 +2280,7 @@
 
 // ---------------------------------------------------------------------------
-// Issue #262 (static): the locked presentation exists in the stylesheets.
+// The locked presentation exists in the stylesheets (static).
 // body.table-locked must dim and mute the settings area and the title-row
-// switch in sidebar.html; the on-page pill's locked look lives in
+// switch in sidebar.html; the on-page pillbox's locked look lives in
 // ui-toggle.js's injected style.
 // ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H461

```diff
@@ -2357,6 +2314,5 @@
     }
     // Strip line comments and block comments before scanning, so a comment
-    // that merely mentions the old pattern (documenting the sprint's own
-    // removal of it) cannot trip the lock.
+    // that merely mentions the pattern cannot trip the lock.
     const withoutComments = src
       .replace(/\/\*[\s\S]*?\*\//g, '')
```

Reviewer: none. Reconciliation: applied as proposed.

#### H462

```diff
@@ -2368,6 +2324,6 @@
 })();
 
-// --- (d) The shared-ownership guard comment is gone from content.js — the
-// flag it warned about no longer has two independent writers to coordinate. ---
+// --- (d) The shared-ownership guard comment is absent from content.js — the
+// flag it warned about has no two independent writers to coordinate. ---
 (function registrySprint_guardCommentRemoved() {
   const contentSrc = sourceByName('content.js');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H463

```diff
@@ -2759,5 +2715,5 @@
 })();
 
-// --- #325 Task 8: the service worker runs on the bus ---
+// --- The service worker runs on the bus ---
 (function workerRunsOnBus() {
   const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H464

```diff
@@ -2776,5 +2732,5 @@
 })();
 
-// --- #325 Task 9: the content script publishes through the bus ---
+// --- The content script publishes through the bus ---
 (function contentPublishesThroughBus() {
   const contentSrc = sourceByName('content.js');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H465

```diff
@@ -2801,5 +2757,5 @@
 })();
 
-// --- #325 Task 10: the sidebar subscribes instead of listening ---
+// --- The sidebar subscribes instead of listening ---
 (function sidebarSubscribesThroughBus() {
   const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
```

Reviewer: none. Reconciliation: applied as proposed.

#### H466

```diff
@@ -2816,5 +2772,5 @@
 })();
 
-// --- The sidebar's one-tab rule, driven end to end (issue #343) -------------
+// --- The sidebar's one-tab rule, driven end to end -------------
 //
 // The section above drives the unit directly, so it passes whether or not the
```

Reviewer: none. Reconciliation: applied as proposed.

#### H467

```diff
@@ -2941,5 +2897,5 @@
 
     // Between opening and binding. Nothing may go out to a page yet: the
-    // sidebar has no tab to compare an answer or a report against, and an
+    // sidebar has no tab to compare an answer or a message against, and an
     // activation arriving now would have nothing to compare either.
     eq('bound tab wiring: the sidebar asked which tab it was opened for',
```

Reviewer: none. Reconciliation: applied as proposed.

### `chrome-extension/ui-toggle.js`

#### H468

```diff
@@ -41,5 +41,5 @@ const TOGGLE_DOT_OVERHANG_PX = 2;
 const TOGGLE_COLOR_ON = '#3d85c6';
 const TOGGLE_COLOR_OFF = '#cccccc';
-// Hover text for a locked pill — see tableHasUnrestorableCells. Wording
+// Hover text for a locked pillbox — see tableHasUnrestorableCells. Wording
 // mirrors sidebar.js's APPLY_BLOCKED_STATUS_MSG.
 const LOCKED_TOGGLE_TITLE = 'This table\'s original values are no longer available. Reload the page to change it.';
```

Reviewer: none. Reconciliation: applied as proposed.

#### H469

```diff
@@ -49,5 +49,5 @@ const LOCKED_TOGGLE_TITLE = 'This table\'s original values are no longer availab
 const PILLBOX_AUTO_COLLAPSE_MS = 3000;
 
-// --- Per-table toggle switch infrastructure ---
+// --- Per-table pillbox infrastructure ---
 
 /** WeakMap from HTMLTableElement → HTMLButtonElement (the morph button) */
```

Reviewer: none. Reconciliation: applied as proposed.

#### H470

```diff
@@ -60,20 +60,17 @@ const trackedTables = new Set();
 const tableResizeObservers = new WeakMap();
 
-// isTableRounded used to read two page states directly: whether any cell
-// carried the dr-ext-rounded class, and whether table.dataset.drShowingOriginal
-// was 'true' (issue #245). Both now live in DR_STORE's per-table registry
-// entry as a single appliedFlag — 'simplified' only when roundTable actually
-// changed a cell and the table isn't currently showing originals.
+// The registry entry's appliedFlag is 'simplified' only when roundTable
+// changed a cell and the table is not showing originals.
 function isTableRounded(table) {
   return DR_STORE.getTableAppliedFlag(table) === 'simplified';
 }
 
-// A locked table (issue #262) shows cells wearing dr-ext-rounded that
-// DR_STORE has no original for. Only a content-script re-injection produces
-// that pairing (see restoreTable's KNOWN ACCEPTED COST comment in
-// content.js): the class survives in the page, the registry did not. Such a
-// table is stuck showing simplified text — nothing in this instance can
-// restore it, and re-rounding would destroy the title attribute's surviving
-// originals — so every control over it renders locked. Evaluated live on
+// A locked table shows cells wearing dr-ext-rounded that DR_STORE has no
+// original for. Only a content-script re-injection produces that pairing
+// (see restoreTable's KNOWN ACCEPTED COST comment in content.js): the class
+// survives in the page, the registry did not. Such a table is unrestorable —
+// nothing in this instance can restore it, and re-rounding would destroy the
+// title attribute's surviving originals — so every control over it renders
+// locked. Evaluated live on
 // each sync: if the site re-renders the table with fresh cells, the marker
 // class disappears with the old cells and the lock lifts by itself.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H471

```diff
@@ -99,5 +96,5 @@ function syncSwitchForTable(table) {
     // The screen shows simplified text (pressed) and no control here can
     // change that (disabled) — see tableHasUnrestorableCells. Log the
-    // transition only, not every sync of an already-locked pill.
+    // transition only, not every sync of an already-locked pillbox.
     if (!button.classList.contains('dr-ext-morph-locked')) {
       DR_LOG.warn("Dynamic Rounding: table locked; its original values are no longer available.");
```

Reviewer: none. Reconciliation: applied as proposed.

#### H472

```diff
@@ -186,5 +183,5 @@ function ensureToggleStyleInjected() {
     }
     .dr-ext-morph:focus-visible { outline: 2px solid ${TOGGLE_COLOR_ON}!important; outline-offset: 2px; }
-    /* Locked pill (issue #262): dimmed dot, no expand, no knob, explaining
+    /* Locked pillbox: dimmed dot, no expand, no knob, explaining
        cursor. These rules sit last so they win the equal-specificity race
        against the hover/expanded/focus-visible rules above. */
```

Reviewer: none. Reconciliation: applied as proposed.

#### H473

```diff
@@ -233,7 +230,6 @@ let _globalTapCollapseAdded = false;
 
 function createToggleForTable(table) {
-  // For native <table> elements use isDataTable() (via NativeTableAdapter).
-  // For div-based grid roots use isDataTable() via GridAdapter now that getRows() is implemented.
-  // looksLikeGrid() is no longer used here — it remains available for findTargetTable walk-up.
+  // isDataTable() reads native tables through NativeTableAdapter and grids
+  // through GridAdapter.
   if (!isDataTable(table)) return;
   ensureToggleStyleInjected();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H474

```diff
@@ -298,5 +294,5 @@ function createToggleForTable(table) {
         scheduleAutoCollapse();
       } else {
-        // Second tap: report the toggle intent, refresh collapse timer
+        // Second tap: publish the toggle intent, refresh collapse timer
         DR_BUS.publish('intent:toggleTable', { table });
         scheduleAutoCollapse();
```

Reviewer: none. Reconciliation: applied as proposed.

#### H475

```diff
@@ -316,8 +312,6 @@ function createToggleForTable(table) {
   button.addEventListener('mousedown', (e) => e.stopPropagation());
 
-  // Store button in WeakMap and table in tracked set (view-only bookkeeping —
-  // the button element itself, and the reposition-on-scroll list). The
-  // "found" registration these two used to also stand in for now goes
-  // through DR_STORE's table registry, the one place that concept lives.
+  // View-only bookkeeping: the button element, and the reposition-on-scroll
+  // list. DR_STORE's table registry holds the "found" registration.
   tableToggles.set(table, button);
   trackedTables.add(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H476

```diff
@@ -340,5 +334,5 @@ function createToggleForTable(table) {
   // uses. On a fresh table this keeps aria-pressed 'false' exactly as set
   // above; on a re-injected page whose table still wears rounded markers
-  // (see tableHasUnrestorableCells) the pill must arrive locked-and-selected
+  // (see tableHasUnrestorableCells) the pillbox must arrive locked and pressed
   // instead of claiming an unrounded table.
   syncSwitchForTable(table);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H477

```diff
@@ -368,5 +362,5 @@ function createToggleForTable(table) {
 // The load-time scan. Pass 1 covers native <table> elements. Pass 2 hands the
 // grids to the nomination step in the detection layer (nominateNests), which
-// reports one outcome per nest — the same step the added-node pass in
+// returns one outcome per nest — the same step the added-node pass in
 // content.js runs, so one page and one added subtree register the same
 // element. This view holds no scan of its own.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H478

```diff
@@ -380,5 +374,5 @@ function createToggleForTable(table) {
 // every content script has loaded.
 function injectTableToggles() {
-  // Pass 1: native <table> elements; phantom a11y tables are skipped.
+  // Pass 1: native <table> elements; accessibility artifacts are skipped.
   document.querySelectorAll('table').forEach(table => {
     if (isPhantomA11yTable(table)) return;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H479

```diff
@@ -388,6 +382,6 @@ function injectTableToggles() {
   });
   // Pass 2: the nomination step. createToggleForTable re-runs the data test
-  // the step already ran; this view accepts the second read so detection keeps
-  // reporting and this view keeps registering.
+  // the step already ran; this view accepts the second read so the detection
+  // layer only nominates and this view alone registers.
   consumeNominations(nominateNests(document, { isSeen: DR_STORE.hasTable }));
 }
```

Reviewer: none. Reconciliation: applied as proposed.

### `docs/test-pages/tables.html`

#### H480

```diff
@@ -451,5 +451,5 @@
         Due 3/9/2021                  -> Due 2021    -> Due 3/2021
         3/9/2021 11:59                -> 2021 11:59  -> 3/2021 11:59
-      A column carrying evidence for both readings is refused rather than guessed.
+      A column carrying evidence for both readings stays unchanged rather than guessed.
 
       Clock times round to the hour at the half-hour mark, and the original
```

Reviewer: none. Reconciliation: applied as proposed.

#### H481

```diff
@@ -631,5 +631,5 @@
 
     <!--
-      Accounting negative   (1,234,567)  -> reads as a negative, comes back in parens
+      Accounting negative   (1,234,567)  -> reads as a negative, comes back in brackets
       Unicode minus         −8,700       -> reads as a negative; the rounded value
                                             comes back with an ASCII hyphen
```

Reviewer: none. Reconciliation: applied as proposed.

#### H482

```diff
@@ -875,8 +875,8 @@
         year:  25/04/2020 -> 2020,     03/04/2021 -> 2021,     07/08/2020 -> 2020
         month: 25/04/2020 -> 04/2020,  03/04/2021 -> 04/2021,  07/08/2020 -> 08/2020
-      Ambiguous only: no cell settles the reading, so the column is refused and
-      every cell holds.
+      Ambiguous only: no cell settles the reading, so the column stays
+      unchanged and every cell holds.
       Conflicting: 25/04/2021 says day-first, 04/25/2021 says month-first. The
-      column is refused rather than guessed.
+      column stays unchanged rather than guessed.
     -->
     <table>
```

Reviewer: none. Reconciliation: applied as proposed.

#### H483

```diff
@@ -918,5 +918,5 @@
       The load-time scan picks up any role="grid" or role="table" element that
       passes the data test. The row group picks the row shape: the rows found
-      inside it decide the selector, and every match across the whole grid
+      inside it determine the selector, and every match across the whole grid
       counts as a row, so the header and Total rows are rows like any other.
       Grid cells have no th concept: every cell is data. The header row holds
```

Reviewer: none. Reconciliation: applied as proposed.

#### H484

```diff
@@ -1206,6 +1206,6 @@
     <!--
       Exercises the mutation observer: nodes added after the initial scan are
-      re-checked with the same native-table and ARIA passes, including the
-      phantom filtering.
+      re-checked with the same native-table pass and nomination step as the
+      load-time scan, including the accessibility artifact filter.
     -->
     <button type="button" id="add-table-btn">Add a table</button>
```

Reviewer: none. Reconciliation: applied as proposed.

#### H485

```diff
@@ -1248,5 +1248,5 @@
     <h3>16a. Marked hidden for assistive technology</h3>
     <p class="expect">The table is left visible here on purpose.</p>
-    <!-- aria-hidden on the table itself, or any ancestor, is a phantom signal. -->
+    <!-- aria-hidden on the table itself, or any ancestor, marks an accessibility artifact. -->
     <table aria-hidden="true">
       <tr>
```

Reviewer: none. Reconciliation: applied as proposed.

#### H486

```diff
@@ -1295,5 +1295,5 @@
     <!--
       A table sharing a positioned ancestor with a labeled SVG is read as the
-      chart's accessibility fallback and refused.
+      chart's accessibility fallback and skipped.
     -->
     <div style="position: relative; border: 1px dashed #cccccc; padding: 12px;">
```

Reviewer: none. Reconciliation: applied as proposed.

#### H487

```diff
@@ -1512,5 +1512,5 @@ TSLA,75,"248.09","18,606.75"
 
     <!--
-      2026        -> a header merged across two columns; headers never round
+      2026        -> a header merged across two columns; the first row, so it stays raw
       Total       -> merged across the first two columns
       1,140,043   -> the total's own cell, column C
```

Reviewer: none. Reconciliation: applied as proposed.

### `js/doc-tests.js`

#### H488

```diff
@@ -161,5 +161,5 @@ function extractCastingBullets(doc, text) {
 
 // --- Extractor 4: the Google Sheets test-tab spec -------------------------
-// Every `| =IF(...) | ... |` row names an input, an optional offset, and an
+// Every `| =IF(...) | ... |` row holds an input, an optional offset, and an
 // expected value; the sheet built from this doc must agree with the library.
 function extractSheetsTab(doc, text) {
```

Reviewer: none. Reconciliation: applied as proposed.

### `js/round_dynamic.js`

#### H489

```diff
@@ -9,5 +9,5 @@
 // Format marks dropped before a text reads as a number: currency signs,
 // whitespace, and percent signs. A comma stays, so GROUP_SHAPE_REGEX can
-// judge where it stands.
+// test where it stands.
 const CLEAN_REGEX = /[$€£¥\s%]/g;
 const PARENS_REGEX = /^\((.+)\)$/;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H490

```diff
@@ -15,5 +15,5 @@ const PARENS_REGEX = /^\((.+)\)$/;
 // comma groups of exactly three. A comma counts only in this shape and only
 // before the decimal dot, so "13,63" and "1.234,56" are not numbers. A run
-// with no comma goes to Number() as before. Matches the chrome extension's
+// with no comma goes to Number(). Matches the chrome extension's
 // number shape test in lib/dr-number/core.js.
 const GROUP_SHAPE_REGEX = /^[+-]?\d{1,3}(?:,\d{3})+$/;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H491

```diff
@@ -194,10 +194,10 @@ function roundWithOffset(num, offset) {
   const raw = Math.round(absnum / step + EPSILON) * step;
 
-  // Feature 2: floor result at the value's own order of magnitude.
+  // Floor the result at the value's own order of magnitude.
   const floor_oom = Math.pow(10, current_mag);
   let result = Math.max(raw, floor_oom);
 
-  // Feature 3: for non-integer offsets, also floor at the integer-offset result
-  // when the integer part is large enough.
+  // For non-integer offsets, also floor at the integer-offset result when the
+  // integer part is large enough.
   if (!isInteger && Math.abs(Math.trunc(offset)) >= X_FLOOR_THRESHOLD) {
     const x_int = Math.trunc(offset);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H492

```diff
@@ -206,5 +206,5 @@ function roundWithOffset(num, offset) {
   }
 
-  // Re-apply the float-cleanup the previous implementation did.
+  // Round away float noise on a result of 10 or more and on a whole result.
   if (result >= 10 || result % 1 === 0) {
     result = Math.round(result);
```

Reviewer: none. Reconciliation: applied as proposed.

### `js/tests.js`

#### H493

```diff
@@ -96,12 +96,12 @@ test('87654321, offset=1', ROUND_DYNAMIC(87654321, 1), 100000000);
 test('87654321, offset=-1', ROUND_DYNAMIC(87654321, -1), 88000000);
 test('87654321, offset=-2', ROUND_DYNAMIC(87654321, -2), 87700000);
-// +0.5 under new semantics: step = 0.5 * 10^(cm+1). For 87654321 (cm=7), step=5e7.
+// +0.5: step = 0.5 * 10^(cm+1). For 87654321 (cm=7), step=5e7.
 // raw = round(87654321/5e7)*5e7 = round(1.75)*5e7 = 2*5e7 = 1e8. floor_oom=1e7. result=1e8.
 // |trunc(0.5)|=0 < X_FLOOR_THRESHOLD=1, so x-floor is skipped.
 test('87654321, offset=0.5', ROUND_DYNAMIC(87654321, 0.5), 100000000);
-// -0.5 preserves prior behavior: step = 0.5 * 10^cm = 5e6.
+// -0.5: step = 0.5 * 10^cm = 5e6.
 // raw = round(87654321/5e6)*5e6 = 18*5e6 = 90000000. floor_oom=1e7. result=90000000.
 test('87654321, offset=-0.5', ROUND_DYNAMIC(87654321, -0.5), 90000000);
-// -1.5: step = 0.5 * 10^(cm-1) = 500000. raw=87500000. floor_oom=1e7. x-floor (x_int=-1): rd(v,-1)=87700000? cm=7, step=1e6, raw=round(87.654)*1e6=88e6. So floor_x=88M. result=max(87.5M, 88M)=88M.
+// -1.5: step = 0.5 * 10^(cm-1) = 500000. raw=87500000. floor_oom=1e7. x-floor (x_int=-1): rd(v,-1) has cm=7, step=1e6, raw=round(87.654)*1e6=88e6, so floor_x=88M. result=max(87.5M, 88M)=88M.
 test('87654321, offset=-1.5', ROUND_DYNAMIC(87654321, -1.5), 88000000);
 // -2.5: step = 0.5 * 10^(cm-2) = 50000. raw = round(87654321/50000)*50000 = 1753*50000 = 87650000. x-floor x_int=-2: rd(v,-2)=87700000 (step=1e5, round(876.54)=877, 877*1e5=87700000). result=max(87650000, 87700000)=87700000.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H494

```diff
@@ -121,5 +121,5 @@ test('0.047, offset=0', ROUND_DYNAMIC(0.047, 0), 0.05);
 test('0.0083, offset=0', ROUND_DYNAMIC(0.0083, 0), 0.008);
 
-// Default offset (now -0.5)
+// Default offset (-0.5)
 test('4308910, default', ROUND_DYNAMIC(4308910), 4500000);
 test('0.35, default', ROUND_DYNAMIC(0.35), 0.35);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H495

```diff
@@ -166,5 +166,5 @@ const gcpData = [
 // Mag 6 gets offset=-0.5, others get offset=-0.5
 testArray('GCP defaults', ROUND_DYNAMIC(gcpData), [
-    [4500000],   // mag 6, offset=-0.5, base=500k
+    [4500000],   // mag 6, offset=-0.5, step=500k
     [4000000],   // mag 6, offset=-0.5
     [1000000],   // mag 6, offset=-0.5
```

Reviewer: none. Reconciliation: applied as proposed.

#### H496

```diff
@@ -197,7 +197,7 @@ testArray('GCP offset_other fallback', ROUND_DYNAMIC(gcpData, -1), [
 
 // offset_top=-1, offset_other=0, num_top=1
-// Mag 6 gets offset=-1 (base=100k), others get offset=0
+// Mag 6 gets offset=-1 (step=100k), others get offset=0
 testArray('GCP offset_top=-1', ROUND_DYNAMIC(gcpData, -1, 0, 1), [
-    [4400000],   // mag 6, offset=-1, base=100k
+    [4400000],   // mag 6, offset=-1, step=100k
     [3900000],
     [1000000],
```

Reviewer: none. Reconciliation: applied as proposed.

#### H497

```diff
@@ -219,12 +219,12 @@ testArray('GCP offset_other=-1', ROUND_DYNAMIC(gcpData, -0.5, -1, 1), [
     [4000000],
     [1000000],
-    [980000],    // mag 5, offset=-1, base=10k
+    [980000],    // mag 5, offset=-1, step=10k
     [820000],
-    [84000],     // mag 4, offset=-1, base=1k
+    [84000],     // mag 4, offset=-1, step=1k
     [42000],
     [22000],
-    [1500],      // mag 3, offset=-1, base=100
+    [1500],      // mag 3, offset=-1, step=100
     [1100],
-    [67],        // mag 1, offset=-1, base=1
+    [67],        // mag 1, offset=-1, step=1
     [43]
 ]);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H498

```diff
@@ -236,5 +236,5 @@ testArray('GCP num_top=2', ROUND_DYNAMIC(gcpData, -0.5, 0, 2), [
     [4000000],
     [1000000],
-    [1000000],   // mag 5, offset=-0.5, base=50k
+    [1000000],   // mag 5, offset=-0.5, step=50k
     [800000],    // mag 5, offset=-0.5
     [80000],     // mag 4, offset=0
```

Reviewer: none. Reconciliation: applied as proposed.

#### H499

```diff
@@ -258,8 +258,8 @@ const decimalsData = [
 // Mag -1 gets offset=-0.5, others get offset=-0.5
 testArray('Decimals defaults', ROUND_DYNAMIC(decimalsData), [
-    [0.35],      // mag -1, offset=-0.5, base=0.05
+    [0.35],      // mag -1, offset=-0.5, step=0.05
     [0.10],      // mag -1, offset=-0.5
-    [0.045],      // mag -2, offset=-0.5, base=0.005
-    [0.0085]      // mag -3, offset=-0.5, base=0.0005
+    [0.045],      // mag -2, offset=-0.5, step=0.005
+    [0.0085]      // mag -3, offset=-0.5, step=0.0005
 ]);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H500

```diff
@@ -345,5 +345,5 @@ test('999999999, offset=0', ROUND_DYNAMIC(999999999, 0), 1000000000);
 test('1000000001, offset=0', ROUND_DYNAMIC(1000000001, 0), 1000000000);
 
-// Sign-aware half-step: +0.5 and -0.5 are now distinct steps (Feature 1).
+// Sign-aware half-step: +0.5 and -0.5 are distinct steps.
 // +0.5 → step at next-coarser OoM; -0.5 → step at current OoM.
 test('87654321 offset=+0.5 distinct from -0.5',
```

Reviewer: none. Reconciliation: applied as proposed.

#### H501

```diff
@@ -356,5 +356,5 @@ test('-999, offset=0', ROUND_DYNAMIC(-999, 0), -1000);
 test('-1001, offset=0', ROUND_DYNAMIC(-1001, 0), -1000);
 
-// Floating point edge case (the epsilon fix) - tests offset=0 specifically
+// Floating point edge case (EPSILON) - tests offset=0 specifically
 test('0.35 rounds to 0.4 not 0.3', ROUND_DYNAMIC(0.35, 0), 0.4);
 test('0.45 rounds to 0.5', ROUND_DYNAMIC(0.45, 0), 0.5);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H502

```diff
@@ -376,5 +376,5 @@ testThrows('offset=100 throws', () => ROUND_DYNAMIC(1000, 100), 'offset must be
 testThrows('offset=-100 throws', () => ROUND_DYNAMIC(1000, -100), 'offset must be between -20 and 20');
 
-// Large offsets no longer collapse to 0 — Feature 2 floors at value's own OoM.
+// Large offsets floor at the value's own OoM instead of collapsing to 0.
 // 9999 has cm=3 → floor_oom=1000; raw rounds to 0; result = max(0, 1000) = 1000.
 test('offset=2 floors at value OoM', ROUND_DYNAMIC(9999, 2), 1000);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H503

```diff
@@ -422,6 +422,6 @@ console.log('=== Trailing Zeros (|result| < 10) ===\n');
 
 // Whole-number results between -10 and 10 must be integers (no trailing zeros).
-// Under new semantics, +0.5 steps at the NEXT-coarser OoM, and Feature 2 floors
-// at the value's own OoM, so for v in [1,10) most +0.5 / +0.25 calls land at 1.
+// +0.5 steps at the NEXT-coarser OoM, and the result floors at the value's
+// own OoM, so for v in [1,10) most +0.5 / +0.25 calls land at 1.
 test('1.13 offset=0.5 → integer 1', ROUND_DYNAMIC(1.13, 0.5) === 1, true);
 test('1.76 offset=0.5 → integer 1 (floor_oom)', ROUND_DYNAMIC(1.76, 0.5) === 1, true);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H504

```diff
@@ -430,5 +430,5 @@ test('1.0 offset=0.25 → integer 1', ROUND_DYNAMIC(1.0, 0.25) === 1, true);
 test('negative -1.13 offset=0.5 → integer -1', ROUND_DYNAMIC(-1.13, 0.5) === -1, true);
 
-// -0.5 (and other negative half-steps) preserves prior trailing-zero / float behavior.
+// -0.5 (and other negative half-steps) keep a fractional result as a float.
 test('1.42 offset=-0.5 → 1.5 (float)', ROUND_DYNAMIC(1.42, -0.5), 1.5);
 test('1.32 offset=-0.5 → 1.5 (float)', ROUND_DYNAMIC(1.32, -0.5), 1.5);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H505

```diff
@@ -477,10 +477,10 @@ testArray('2D multi-column', ROUND_DYNAMIC(multiColumn), [
 
 // =============================================================================
-// HALF-STEP + FLOOR SEMANTICS (Features 1, 2, 3)
+// HALF-STEP + FLOOR SEMANTICS
 // =============================================================================
 
 console.log('=== Half-step + Floor Semantics ===\n');
 
-// 27-cell verification grid from the sprint plan:
+// 27-cell verification grid:
 // {87,054,321; 47,054,321; 17,054,321} × {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}
 const gridCases = [
```

Reviewer: none. Reconciliation: applied as proposed.

#### H506

```diff
@@ -522,5 +522,4 @@ for (const [v, off, expected] of gridCases) {
 
 // Monotonicity property: for sorted input, output is non-decreasing.
-// (This is the fundamental property the originating bug violated.)
 function assertMonotonic(label, values, offset) {
     const sorted = [...values].sort((a, b) => a - b);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H507

```diff
@@ -536,5 +535,5 @@ function assertMonotonic(label, values, offset) {
 }
 
-// Originating-bug inputs from sprint plan.
+// Inputs spread across five magnitudes, from 73 to 400,000.
 const originatingValues = [73, 4591, 63538, 162583, 400000];
 assertMonotonic('originating', originatingValues, 1);
```

Reviewer: none. Reconciliation: applied as proposed.

#### H508

```diff
@@ -573,5 +572,5 @@ console.log('=== X_FLOOR_THRESHOLD flip ===\n');
         return;
     }
-    // Isolate via a Function so the new const doesn't collide with the outer scope.
+    // Isolate via a Function so the new const does not collide with the outer scope.
     const sandbox = new Function(patched + '; return { ROUND_DYNAMIC: ROUND_DYNAMIC, roundWithOffset: roundWithOffset };')();
     const RD = sandbox.ROUND_DYNAMIC;
```

Reviewer: none. Reconciliation: applied as proposed.

#### H509

```diff
@@ -581,5 +580,5 @@ console.log('=== X_FLOOR_THRESHOLD flip ===\n');
     // And rd(47054321, 0.5) should still be 50M (x-floor at rd(v,0)=50M matches raw).
     test('threshold=0: rd(47054321, 0.5) → 50M', RD(47054321, 0.5), 50000000);
-    // -0.5 with threshold=0 now floors at rd(v, 0): rd(87054321, -0.5) raw=85M, x-floor=90M.
+    // -0.5 with threshold=0 floors at rd(v, 0): rd(87054321, -0.5) raw=85M, x-floor=90M.
     test('threshold=0: rd(87054321, -0.5) → 90M', RD(87054321, -0.5), 90000000);
     // Sanity: default-threshold (1) behavior of rd(17054321, 0.5) is 10M (no x-floor).
```

Reviewer: none. Reconciliation: applied as proposed.

#### H510

```diff
@@ -588,5 +587,5 @@ console.log('=== X_FLOOR_THRESHOLD flip ===\n');
 
 // =============================================================================
-// QUARTER-STEP SEMANTICS (Feature 1 generalized)
+// QUARTER-STEP SEMANTICS
 // =============================================================================
```

Reviewer: none. Reconciliation: applied as proposed.

#### H511

```diff
@@ -597,6 +596,6 @@ console.log('=== Quarter-step semantics (Feature 1 generalized) ===\n');
 //   f          = |offset - trunc(offset)|
 //   step       = f * 10^target_mag
-// Then floor at floor_oom = 10^current_mag (Feature 2) and at
-// rd(value, trunc(offset)) when |trunc(offset)| >= X_FLOOR_THRESHOLD (Feature 3).
+// Then floor at floor_oom = 10^current_mag and at
+// rd(value, trunc(offset)) when |trunc(offset)| >= X_FLOOR_THRESHOLD.
 const quarterCases = [
     // [value, offset, expected]
```

Reviewer: none. Reconciliation: applied as proposed.

### `python/dynamic_rounding/__init__.py`

#### H512

```diff
@@ -215,9 +215,9 @@ def _round_with_offset(value: float, offset: float) -> float:
 
     raw = round(absval / step + EPSILON) * step
-    floor_oom = 10 ** current_mag  # Feature 2: value-OoM floor
+    floor_oom = 10 ** current_mag  # value-OoM floor
 
     result = max(raw, floor_oom)
 
-    # Feature 3: x-floor for fractional offsets with large integer part
+    # x-floor for fractional offsets with a large integer part
     if not float(offset).is_integer():
         x_int = math.trunc(offset)
```

Reviewer: none. Reconciliation: applied as proposed.

### `python/dynamic_rounding/pandas.py`

#### H513

```diff
@@ -25,5 +25,5 @@ from . import _round_with_offset, _validate_offset, _preserve_type, DEFAULT_OFFS
 # Format marks dropped before a text reads as a number: currency signs,
 # whitespace, and percent signs. A comma stays, so GROUP_SHAPE_REGEX can
-# judge where it stands.
+# test where it stands.
 CLEAN_REGEX = re.compile(r'[$€£¥\s%]')
 PARENS_REGEX = re.compile(r'^\((.+)\)$')
```

Reviewer: none. Reconciliation: applied as proposed.

#### H514

```diff
@@ -31,5 +31,5 @@ PARENS_REGEX = re.compile(r'^\((.+)\)$')
 # comma groups of exactly three. A comma counts only in this shape and only
 # before the decimal dot, so "13,63" and "1.234,56" are not numbers. A run
-# with no comma goes to float() as before. [0-9] rather than \d, because \d
+# with no comma goes to float(). [0-9] rather than \d, because \d
 # matches non-ASCII digits in Python.
 GROUP_SHAPE_REGEX = re.compile(r'^[+-]?[0-9]{1,3}(?:,[0-9]{3})+$')
```

Reviewer: none. Reconciliation: applied as proposed.

#### H515

```diff
@@ -90,5 +90,5 @@ def _parse_number(value) -> Optional[float]:
         # numeric value, but JS's Number() does not. Reject non-ASCII strings
         # here so this parser passes them through unchanged, matching the
-        # chrome extension and js/round_dynamic.js (the source of truth).
+        # chrome extension (the source of truth) and js/round_dynamic.js.
         if not cleaned.isascii():
             return None
```

Reviewer: none. Reconciliation: applied as proposed.

### `python/tests/test_core.py`

#### H516

```diff
@@ -27,5 +27,5 @@ class TestSingleMode:
     
     def test_offset_negative_one_point_five(self):
-        # Offset -1.5 under new sign-aware semantics with the x-floor (Feature 3):
+        # Offset -1.5 with the x-floor:
         # the half-step result (87_500_000) is floored by the integer-offset
         # result at trunc(-1.5) = -1, which yields 88_000_000. So the x-floor
```

Reviewer: none. Reconciliation: applied as proposed.

#### H517

```diff
@@ -191,5 +191,5 @@ class TestOffsetSignDirection:
 
     def test_negative_half_keeps_legacy_behavior(self):
-        # -0.5 preserves the default behavior used historically.
+        # -0.5 is the default offset.
         assert round_dynamic(87654321, offset=-0.5) == 90000000
```

Reviewer: none. Reconciliation: applied as proposed.

#### H518

```diff
@@ -247,6 +247,6 @@ class TestTrailingZeros:
 
 # ---------------------------------------------------------------------------
-# Sprint half-step-floor-python: Features 1 (sign-aware half-step),
-# 2 (value-OoM floor), and 3 (X_FLOOR_THRESHOLD-gated x-floor).
+# Sign-aware half-step, value-OoM floor, and the X_FLOOR_THRESHOLD-gated
+# x-floor.
 # ---------------------------------------------------------------------------
```

Reviewer: none. Reconciliation: applied as proposed.

#### H519

```diff
@@ -340,5 +340,5 @@ class TestQuarterStep:
         (87054321,  1.25, 100000000),   # x-floor at rd(87M, 1) = 100M
         (87054321, -1.25,  87000000),   # step 250K; x-floor at rd(87M, -1) = 87M
-        # Previously-dropped small-value quarter-step, recomputed under formula B:
+        # Small-value quarter-step:
         # OoM=0, target_mag=1, f=0.25, step=2.5; round(1.13/2.5)=0 -> floored to 10^0 = 1.
         (1.13, 0.25, 1),
```

Reviewer: none. Reconciliation: applied as proposed.

### `scripts/check-files-test.sh`

#### H520

```diff
@@ -142,5 +142,5 @@ policy_array() {
 echo 'check-files.sh self-test'
 
-# A stray at the repo root is rejected on path. This is the species that
+# A stray at the repository root is rejected on path. This is the species that
 # already reached main once.
 repo=$(scratch_repo)
```

Reviewer: none. Reconciliation: applied as proposed.

### `scripts/check-files.sh`

#### H521

```diff
@@ -4,5 +4,5 @@
 #
 # Two checks: the file belongs to this project, and it carries no credentials.
-# Nothing here judges file size — that is a repo-weight question, not a
+# Nothing here checks file size — that is a repository-weight question, not a
 # relevancy one, and it is tracked separately.
 #
```

Reviewer: none. Reconciliation: applied as proposed.

#### H522

```diff
@@ -19,5 +19,5 @@ set -uo pipefail
 
 # Directories a new file may live in. A path under none of these is rejected,
-# which is what stops a stray report or scratch doc at the repo root.
+# which is what stops a stray report or scratch doc at the repository root.
 ALLOWED_DIRS=(
   chrome-extension/
```

Reviewer: none. Reconciliation: applied as proposed.

#### H523

```diff
@@ -32,5 +32,5 @@ ALLOWED_DIRS=(
 )
 
-# Files that may sit at the repo root, where nothing else may.
+# Files that may sit at the repository root, where nothing else may.
 ALLOWED_ROOT_FILES=(
   README.md
```

Reviewer: none. Reconciliation: applied as proposed.

### `scripts/check-vocab-test.sh`

#### H524

```diff
@@ -6,7 +6,7 @@
 # docs/vocabulary.md. These cases plant a retired synonym and require the gate
 # to catch it, plant clean and exempt content and require the gate to pass it,
-# and damage that table and require the gate to refuse. The gate's preflight is
-# what makes the last group possible: a broken policy used to read as clean
-# prose.
+# and damage that table and require the gate to fail. The gate's preflight is
+# what makes the last group possible: without it a broken policy would read as
+# clean prose.
 #
 # Every case runs in a scratch git repository carrying a copy of the real
```

Reviewer: none. Reconciliation: applied as proposed.

#### H525

```diff
@@ -80,10 +80,10 @@ expect_block() {
 # expect_refusal <case name> <replacement table rows> <message>
 # Replaces the vocabulary with a Retired synonyms table built from the given
-# rows, stages clean prose, and requires the gate to refuse with exit 2. A
+# rows, stages clean prose, and requires the gate to fail with exit 2. A
 # damaged policy that exits 0 is the failure these cases exist to catch: the
 # gate would approve every commit while seeing nothing.
 #
 # The message argument is what keeps the cases independent. Every preflight
-# branch refuses with the same exit code, so a case that checked only the code
+# branch fails with the same exit code, so a case that checked only the code
 # would pass when its own branch was deleted and a later branch caught the
 # damage instead. Matching the branch's own words pins each case to one branch.
```

Reviewer: none. Reconciliation: applied as proposed.

#### H526

```diff
@@ -164,11 +164,11 @@ expect_pass  "tied in its own sense passes"         docs/design.md   'The releas
 
 # Preflight. The Retired synonyms table is the one input nothing else checks,
-# so each way of breaking it must produce a refusal, not a clean bill.
+# so each way of breaking it must produce a failure, not a clean bill.
 #
 # The malformed fixture keeps a valid pattern that matches the canary. Without
 # it the case passes for the wrong reason: a lone bad pattern matches nothing,
-# the canary check fires, and the gate refuses whether or not it can tell a
+# the canary check fires, and the gate fails whether or not it can tell a
 # broken expression from an absent one. The valid pattern satisfies the canary
-# so only the malformed check is left to produce the refusal.
+# so only the malformed check is left to produce the failure.
 canary_row='| pillbox | table toggle | Only data tables get a pillbox. | `\btable toggle` |'
```

Reviewer: none. Reconciliation: applied as proposed.

### `scripts/check-vocab.sh`

#### H527

```diff
@@ -22,5 +22,5 @@ set -uo pipefail
 # column is the repository's only list of retired synonyms, and this script
 # keeps no second copy. A row whose Pattern cell is not a backtick-wrapped
-# expression carries no pattern, and the human sweep owns that row.
+# expression carries no pattern, and that row is left to the human sweep.
 #
 # How to write a pattern — word boundaries per edge, the collocation rule, and
```

Reviewer: none. Reconciliation: applied as proposed.

#### H528

```diff
@@ -85,8 +85,8 @@ EXEMPT_PATHS='^docs/sprint-logs/|^docs/sprint-plans/|^docs/research/|^js/CHANGEL
 
 # The pattern list is the whole policy, and an empty or broken list reports the
-# same silence as clean prose. These checks turn that silence into a refusal,
+# same silence as clean prose. These checks turn that silence into a failure,
 # on every run of the gate rather than only when the self-test runs in CI. The
-# list now arrives from a markdown table, so a renamed heading or a reshaped
-# row lands here too: it reads as an empty list, and the gate refuses.
+# list comes from a markdown table, so a renamed heading or a reshaped row
+# lands here too: it reads as an empty list, and the gate fails.
 
 # A sentence the gate must be able to see. It belongs to no living doc, so a
```

Reviewer: none. Reconciliation: applied as proposed.
