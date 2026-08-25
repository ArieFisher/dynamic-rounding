# Sprint Plan: Decoupling migration

**Status:** PROPOSED-DRAFT
**Created:** 2026-08-25
**Base branch:** main
**Slug:** decoupling-migration

Converts the internal architecture review (2026-08-22, revised 2026-08-25) into an executable sprint stack. The plan is self-contained; every sprint definition carries the design detail its implementer needs.

## 1. Repo Survey

A monorepo with three implementations of dynamic rounding:

- `chrome-extension/` — a Manifest V3 content-script extension: seven plain scripts sharing one global scope, ordered by `manifest.json`. Layers exist by convention, not by module boundaries. One 12,312-line test file (`tests.js`, 1,229 assertion sites) loads the seven sources by hardcoded name and checks ~20 exact source-text fragments.
- `js/` — the Google Sheets `ROUND_DYNAMIC` custom function (`round_dynamic.js` + `tests.js`).
- `python/` — a Python port (`dynamic_rounding` package, pytest suite).

The three copies of the rounding core have drifted: the extension strips percent signs, normalizes unusual dash characters, and removes floating-point noise; the Sheets copy does none of that. The extension's `core.js` holds four functions no extension code calls (`ROUND_DYNAMIC`, `singleValueMode`, `datasetMode`, `validateOffset`) and restates two settings defaults that belong to `defaults.js`. The classification ladder (first row, percent, currency, quoted, link, footnote, out of range) exists in two copies kept matching by comments.

**Patterns observed:** pure core → DOM adapters → UI layering by file; adapter pattern over native tables vs ARIA grids; a heavy single-file Node test suite with no framework; a merge-time version-bump workflow.

**Platform fact (verified 2026-08-25 against Chrome documentation):** declared content scripts get no module loading; they load as plain scripts, in manifest order, sharing one scope. Each extracted package is therefore a plain script that publishes exactly one named global bundle, with tests enforcing the discipline.

## 2. Repo Conventions

- **Version files:** `chrome-extension/manifest.json` (`version` key, dotted integers) and `python/pyproject.toml` (`version`). The `.github/workflows/bump-version.yml` workflow bumps them at merge, path-filtered. **Sprint branches must not touch version files.**
- **Test commands:** `node chrome-extension/tests.js`; `node js/tests.js`; `cd python && pytest`. CI (`tests.yml`) runs them.
- **Lint / format / build:** none configured. Match surrounding style. The extension loads unpacked; no bundler.
- **File gate:** `scripts/check-files.sh --staged` runs in the pre-commit hook and in CI. New directories under `chrome-extension/` pass; new root paths do not.
- **Branch naming:** `refactor/<label>`, `chore/<label>`, `fix/<label>` per change type. Never `claude/` or `session/`.
- **Commit convention:** Conventional Commits with scope, e.g. `refactor(extension): …`.
- **PR template:** none. PRs are written as human-authored; no AI-attribution footers.

## 3. Design

### 3.1 Packages as namespaced plain scripts

**What:** extracted code lives in `chrome-extension/lib/dr-number/` and `chrome-extension/lib/dr-table/` and `chrome-extension/lib/dr-simplify/`. Each package file publishes exactly one global bundle (`DR_NUMBER`, `DR_TABLE`, `DR_SIMPLIFY`); the manifest lists packages before their consumers. Two tests enforce the discipline: one-name-per-file, and manifest dependency order.

**Why:** Chrome gives declared content scripts no module system (verified; see Repo Survey). The discipline substitutes for imports at zero runtime cost. *Principle: minimize design-time coupling* — consumers name one bundle, not forty globals.

**Alternative rejected:** runtime module loading via dynamic import of web-accessible resources. Adds asynchronous load timing and manifest surface for no gain.

### 3.2 The library stays inside the extension

The packages sit under `chrome-extension/lib/`, not a top-level `packages/` directory. Chrome resolves content-script paths from the extension root, and the file gate allowlists directories. Promotion to top level waits for a second consumer. *Principle: simple components; don't pay distribution cost before two consumers exist.*

### 3.3 Detection reads, callers write

`dr-table` answers "what tables are here?" without touching the page. The toggle-widget build and the marker-class write move to the caller; `tableAt` reports whether a handle is new and the caller decides whether to badge. Ports with working defaults (StyleProbe, NumericProbe, VendorProfiles, doc) let detection run under jsdom. *Principle: simple interactions — queries must not mutate.*

### 3.4 Dead-handle contract

The page removes tables while callers hold handles (single-page navigation, grid row recycling as often as every 100 ms). No handle-taking call throws: reads on a dead handle return null; writes skip removed cells and report written and skipped counts in the receipt; restores of removed cells do nothing. A dead handle never comes back — a redrawn table gets a new handle.

### 3.5 One application model, message-carried state changes

State the logic reads (selected table, sidebar-open flag, settings, the table registry) moves into one application model. A typed event bus over Chrome messaging carries two topic families: intent topics (views publish, controller subscribes) and state-change topics (model publishes, views subscribe). One loop, one direction: view → intent → controller → model → state-change → views. The bus stores nothing.

**Delivery rules** (Chrome messaging drops messages to closed contexts and guarantees no cross-context order): state-change messages carry the whole value for their topic, never a delta; a view that opens or reconnects pulls current state from the model before drawing. Lost or reordered messages are corrected by the next message or the next pull.

### 3.6 Sprint granularity follows file ownership

Most sprints form a chain because the extension's seven scripts share one scope and one manifest: sprints touching the same files must not run in parallel in worktrees. The chain is genuine coupling, not conflated logical order. Two branches run parallel where files are disjoint: the Sheets/Python unification, and the toggle-view split.

## 4. Sprint Plan

| # | Label | Goal | Depends on |
|---|-------|------|------------|
| 1 | `test-harness-manifest` | Tests find sources from the manifest; file moves stop breaking tests | none |
| 2 | `extract-dr-number` | Pure number logic moves to `lib/dr-number/`; discipline tests land | test-harness-manifest |
| 3 | `delete-dead-code` | Remove the four unused core functions and two false comments | extract-dr-number |
| 4 | `unify-rounding-core` | Sheets and Python copies regenerate from the extension copy; shared case table | delete-dead-code |
| 5 | `extract-dr-table` | Detection moves to `lib/dr-table/` with ports; detection stops writing the page | extract-dr-number |
| 6 | `merge-ladder` | One classification ladder in `lib/dr-simplify/` replaces both copies | extract-dr-table |
| 7 | `engine-returns-results` | The simplification engine stops sending Chrome messages | merge-ladder |
| 8 | `app-model-selection` | Application model + event bus; selection and sidebar-open move in | engine-returns-results |
| 9 | `app-model-settings` | Settings move into the model; the ten-retry pull dies; preview reads live settings | app-model-selection |
| 10 | `app-model-registry` | Registry, originals, and applied flag move into the model; marker class becomes style-only | app-model-settings |
| 11 | `toggle-split` | Toggle view splits into drawing and intent reporting; range-flash-on-grid bug fixed | app-model-selection |

Decoupling notes: `unify-rounding-core` (js/, python/) runs parallel to the `extract-dr-table` chain (chrome-extension/). `toggle-split` (ui-toggle.js) runs parallel to `app-model-settings` and `app-model-registry` (sidebar.js, content.js, store). `unify-rounding-core` is a leaf: sprints 1–4 alone remove the copy drift and the dead code — a valid stopping point if later sprints defer.

## 5. Sprint Definitions

### Sprint 1: test-harness-manifest

- **Branch:** `chore/test-harness-manifest`
- **Goal:** the test harness locates content-script sources from `manifest.json` instead of seven hardcoded filenames, and source-text assertions check the concatenated source.
- **Scope:** `chrome-extension/tests.js` only. Replace the seven named `readFileSync` calls with a read of the manifest's `content_scripts[].js` list, concatenated in manifest order into one evaluated source and one combined text for fragment assertions. Point the ~20 source-text assertions (`src.includes(...)`-style) at the combined text.
- **Out of scope:** any change to source files; any assertion deletion beyond mechanical retargeting.
- **Acceptance criteria:**
  - `grep -c "readFileSync.*'\(defaults\|rounding\|core\|parsing\|dom-adapters\|ui-toggle\|content\)\.js'" chrome-extension/tests.js` returns 0.
  - The suite passes with the same assertion count as before the change (1,229).
  - Renaming a content-script file in a scratch copy (updating only the manifest) leaves source loading intact.
- **Version bump:** patch (workflow-managed; do not touch version files)
- **Complexity:** M
- **Dev notes:** `background.js` and the sidebar files are not content scripts; derive their paths from the manifest's `background` and `side_panel` keys where the tests read them. Keep the eval-in-shared-scope model and the existing global stubs unchanged.

### Sprint 2: extract-dr-number

- **Branch:** `refactor/extract-dr-number`
- **Goal:** the pure number logic (parsing, rounding, formatting, date/time parse and round, max magnitude, step-for-offset) moves into `chrome-extension/lib/dr-number/` with no logic changes.
- **Scope:** move `parsing.js`, `rounding.js`, and `core.js` content into `lib/dr-number/` files that together publish one global bundle `DR_NUMBER`; update `manifest.json` script order and `sidebar.html` script tags; retarget the test file's republishing block. Add two discipline tests: (a) evaluating each package file in isolation adds exactly one name to the shared scope; (b) the manifest lists `lib/` packages before non-package scripts.
- **Out of scope:** deleting anything; merging formatters; behavior changes of any kind.
- **Acceptance criteria:**
  - All three test suites pass; extension assertion count does not drop.
  - `defaults.js`, `dom-adapters.js`, `ui-toggle.js`, `content.js` are unmoved.
  - The two discipline tests exist and pass.
- **Version bump:** patch (workflow-managed)
- **Complexity:** M
- **Dev notes:** pure moves only — if a change is tempting, leave a code comment out of it and note it in the PR body instead. The sidebar loads scripts via `sidebar.html`, not the manifest; update both.

### Sprint 3: delete-dead-code

- **Branch:** `chore/delete-dead-code`
- **Goal:** remove the extension's never-used public entry point, two modes, and validator, and correct the two comments that describe the code falsely.
- **Scope:** in `lib/dr-number/`: delete `ROUND_DYNAMIC`, `singleValueMode`, `datasetMode`, `validateOffset`, and the two restated defaults (`DEFAULT_OFFSET_TOP`, `DEFAULT_NUM_TOP`) that only those functions read. Fix the header comment claiming both contexts call the same entry point, and the second false comment identified with it. Remove republish lines and tests that only exercise deleted code.
- **Out of scope:** `js/round_dynamic.js` — the Sheets copy keeps its own entry point; any logic change to surviving functions.
- **Acceptance criteria:**
  - The named functions and constants appear nowhere in `chrome-extension/` sources.
  - `findMaxMagnitude` and `toNumber` survive unchanged (extension code calls them).
  - All suites pass.
- **Version bump:** patch (workflow-managed)
- **Complexity:** S
- **Dev notes:** deletion order matters to the tests — remove the republish lines in the same commit as the functions or the eval fails loudly.

### Sprint 4: unify-rounding-core

- **Branch:** `fix/unify-rounding-core`
- **Goal:** the three copies of the rounding core agree, with the extension copy as the source of truth; one shared table of test cases runs against all three.
- **Scope:** bring `js/round_dynamic.js` and the Python package up to the extension's behavior: percent-sign stripping, unusual-dash normalization, floating-point noise removal. Add a shared case table `js/round-dynamic-cases.json` (input, parameters, expected output) consumed by `js/tests.js`, the Python test suite, and `chrome-extension/tests.js`. Add a changelog entry in `js/CHANGELOG.md` naming the two input kinds whose output changes — percent inputs and sub-unit steps — with a before-and-after example of each.
- **Out of scope:** extension behavior changes; API signature changes in any copy.
- **Acceptance criteria:**
  - The shared case table exists and all three suites load and pass it.
  - Sheets output changes only on percent inputs and sub-unit steps; the changelog entry documents both with examples.
  - All suites pass.
- **Version bump:** patch (workflow-managed; the workflow bumps python and extension independently by path)
- **Complexity:** L
- **Dev notes:** this is the only sprint where a user can see numbers change. Audit the Python copy's drift while writing the case table; if Python behavior changes in ways beyond the two named input kinds, list them in the PR body and extend the changelog. Keep the case table out of the Python sdist if the packaging config would otherwise ship it.

### Sprint 5: extract-dr-table

- **Branch:** `refactor/extract-dr-table`
- **Goal:** table detection moves into `chrome-extension/lib/dr-table/` (bundle `DR_TABLE`), runs under jsdom, and stops changing the page.
- **Scope:** move detection from `dom-adapters.js` into the package. Two behavior changes: (1) finding a table no longer builds the toggle widget or writes the marker class — `tableAt` returns `{ handle, isNew }` and the caller badges; (2) the off-screen accessibility-table filter becomes an optional predicate the extension passes in (current behavior preserved for the extension). Four ports, each with a working default so `findTables(document)` needs no configuration: StyleProbe (layout reads, replacing the guarded ones), NumericProbe (the extension passes the real dr-number parser), VendorProfiles (Databricks and AG Grid selector lists as data), doc (the page document, passed in). Existing adapter objects serve as handles. Dead-handle rule from the design: no handle-taking call throws; a dead handle answers null/no-op.
- **Out of scope:** the snapshot read/write/restore layer (arrives with a second consumer); ladder or engine changes; any change to what tables are detected (behavior-identical detection, side effects removed).
- **Acceptance criteria:**
  - A new test runs `findTables` under jsdom with no Chrome globals stubbed.
  - Detection code contains no widget construction and no marker-class write; the marker class is written only by the caller.
  - Vendor selectors live in a data structure in one file, not inline in detection logic.
  - All suites pass; detection results on the existing test fixtures are unchanged.
- **Version bump:** patch (workflow-managed)
- **Complexity:** L
- **Dev notes:** the marker class stays in the page as a style hook written by the caller — this sprint moves the writer, not the class. The re-badge decision from `isNew` must reproduce today's badging exactly; a table seen twice gets no second widget.

### Sprint 6: merge-ladder

- **Branch:** `refactor/merge-ladder`
- **Goal:** one classification ladder in `chrome-extension/lib/dr-simplify/` (bundle `DR_SIMPLIFY`) replaces the two copies kept matching by comments.
- **Scope:** extract the ladder (first row, percent, currency, quoted text, link, footnote marker, out of range) into a pure package depending only on `DR_NUMBER`. It takes plain cell values, never page elements, and returns decisions as data — each planned cell carries `{mode, value, reason}`. Both former call sites (the engine and the preview-sample extractor) call the shared ladder. Delete the sidebar's duplicate formatters in favor of dr-number's. Range validation returns a result value instead of sending a message.
- **Out of scope:** live-settings wiring for the preview (arrives in app-model-settings); engine messaging changes.
- **Acceptance criteria:**
  - One ladder implementation; the comments promising the copies match are gone because the copies are gone.
  - Every divergence found between the two copies is either preserved deliberately (documented in the PR body with a test) or fixed (with a test).
  - The sidebar's local formatters are deleted; it calls dr-number's.
  - All suites pass.
- **Version bump:** patch (workflow-managed)
- **Complexity:** L
- **Dev notes:** medium behavior risk by design — each place the copies quietly disagreed is a latent bug that surfaces here. Diff the two copies rule by rule before writing code; write a failing test per divergence first.

### Sprint 7: engine-returns-results

- **Branch:** `refactor/engine-returns-results`
- **Goal:** the simplification engine stops sending Chrome extension messages; it returns a result and the controller does the messaging.
- **Scope:** `content.js` engine paths that call `chrome.runtime.sendMessage` from inside computation. The engine returns result values; the controller sends whatever messages the results require.
- **Out of scope:** the event bus (next sprint); any change to message payloads observed by the sidebar or background.
- **Acceptance criteria:**
  - No `chrome.*` call remains inside the engine's computation paths.
  - A test runs the engine end-to-end with no Chrome stub present.
  - Observable messaging behavior is unchanged (same messages, same payloads, sent by the controller).
- **Version bump:** patch (workflow-managed)
- **Complexity:** S
- **Dev notes:** this is the step that lets the engine run outside Chrome. Keep the diff small; resist relocating the engine while touching it.

### Sprint 8: app-model-selection

- **Branch:** `refactor/app-model-selection`
- **Goal:** an application model and a typed event bus exist; the selected table and the sidebar-open flag live in the model; the toggle view reports intents instead of writing another file's variables.
- **Scope:** new `chrome-extension/app/store.js` (the application model) and `chrome-extension/adapters/messaging.js` (the event bus over Chrome messaging). Two topic families only: intent topics (toggle, select, sidebar-open — views publish, controller is sole subscriber) and state-change topics (model publishes after changing; views subscribe and redraw from the model). Move the two file-level variables the toggle view writes from outside (`content.js`'s last-right-clicked table and sidebar-open flag) into the model. Delivery rules: state-change messages carry the whole value for their topic; a view that opens or reconnects pulls current state from the model before drawing; the bus stores nothing.
- **Out of scope:** settings (next sprint); registry and originals (sprint after); `bound`/`selected` unification lands here — they are one field, the selected table identifier ("bound" means "selected while the sidebar is open").
- **Acceptance criteria:**
  - No file writes another file's variables; `content.js` file-level selection state is gone.
  - Intent and state-change topics are typed and enumerated in one place; a test publishes each intent and asserts the model change and the state-change message.
  - A test simulates a reconnecting view and asserts it pulls current state rather than depending on missed messages.
  - All suites pass; user-visible behavior unchanged.
- **Version bump:** patch (workflow-managed)
- **Complexity:** L
- **Dev notes:** the bus spans page script, sidebar, and background over Chrome messaging, which drops messages to closed contexts and guarantees no cross-context order — the two delivery rules absorb both; never add a message-history or last-value replay to the bus.

### Sprint 9: app-model-settings

- **Branch:** `refactor/app-model-settings`
- **Goal:** settings live in the application model; the ten-retry cross-process settings pull is deleted; the preview band reads live settings.
- **Scope:** settings move into the model with the sidebar as a view of them (checkboxes and sliders publish settings-change intents; the model publishes the new settings; subscribers redraw). Delete the controller's retry loop (ten tries at 50 ms with default fallback). Point the preview-sample extractor at live settings from the model, fixing the preview-band-versus-table mismatch.
- **Out of scope:** registry and originals; toggle view changes.
- **Acceptance criteria:**
  - The retry loop is gone; no timing-based settings access remains.
  - A test moves a slider and asserts the preview band and the table round from the same settings values.
  - Settings survive a sidebar close and reopen (pulled from the model on open).
  - All suites pass.
- **Version bump:** patch (workflow-managed)
- **Complexity:** M
- **Dev notes:** settings persistence across page loads stays wherever it lives today (extension storage); the model is the in-session owner, storage is its backing.

### Sprint 10: app-model-registry

- **Branch:** `refactor/app-model-registry`
- **Goal:** the registry of found tables, the original values, and the simplified/original flag live in the application model; the marker class becomes a style hook only.
- **Scope:** collapse the three stores of "tables found" (weak map, set, marker class read-back) into one registry in the model; registry entries let go of removed tables on their own. Originals move from three page attributes into the registry entry, keyed by cell reference, merging the two restore paths. The simplified/original flag moves from a page attribute into the registry entry; the re-apply observer and the view read the model, and the nine-line guard comment protecting the shared page attribute is deleted along with the sharing. No code queries the marker class as state.
- **Out of scope:** removing the marker class from the page (it stays for styling); any detection change.
- **Acceptance criteria:**
  - `grep` finds no read of the marker class outside CSS and the code that writes it for styling.
  - One restore path; a test restores a native table and a grid through the same call.
  - The re-apply observer works from model state: a simulated grid redraw re-applies rounding without reading page attributes.
  - The guard comment is gone because the guarded sharing is gone.
  - All suites pass.
- **Version bump:** patch (workflow-managed)
- **Complexity:** L
- **Dev notes:** the largest behavior-risk sprint. Known accepted cost: originals in the model do not survive Chrome re-injecting the content script, which page attributes did; the design accepts this (re-injection re-detects and the model rebuilds). Freeze the magnitude basis on first sight for virtualized grids so scrolling cannot change the rounding basis — a stability-over-representativeness trade the design makes deliberately.

### Sprint 11: toggle-split

- **Branch:** `refactor/toggle-split`
- **Goal:** the toggle code splits into drawing (render from model state) and reporting (publish intents), and the range-flash bug on grids is fixed.
- **Scope:** `ui-toggle.js` splits into a view that renders from state-change subscriptions and publishes intents, and nothing else — controller logic it holds today moves to the controller. Fix the bug found in review: the range flash assumes a native table and silently does nothing on grids; make it work on grids, with a new test that fails without the fix.
- **Out of scope:** visual changes; sidebar changes.
- **Acceptance criteria:**
  - The toggle view holds no state the logic reads and calls no browser interfaces beyond rendering.
  - A test asserts the range flash fires on a grid fixture.
  - All suites pass; toggle appearance and behavior otherwise unchanged.
- **Version bump:** patch (workflow-managed)
- **Complexity:** M
- **Dev notes:** depends only on app-model-selection; runs parallel to the settings and registry sprints (disjoint files).

## 6. Open Questions

1. **Shared case table location.** Proposed `js/round-dynamic-cases.json`, read by all three suites via relative path. Alternative: `docs/` (wrong home for test data) or per-suite copies (recreates the drift). Confirm during sprint 4 review.
2. **Python drift extent.** Unknown until the case table exists. If Python output changes beyond percent inputs and sub-unit steps, the sprint 4 PR body must list every change and the reviewer decides whether a minor (not patch) bump is warranted.
3. **Formatter merge depth.** Sprint 6 deletes the sidebar's duplicate formatters. If the diff shows the three formatters encode deliberate display differences, preserve them behind explicit parameters and record the decision in the PR body.
4. **Unattended halt after sprint 4.** Sprints 1–4 are the documented stopping point (drift, dead code, and false comments removed). The stack encodes this: sprint 4 is a leaf, so a halt or failure downstream strands nothing.

## 7. Out of Scope (Separate Sprint-Stack)

- **Package promotion to a top-level `packages/` directory.** Waits for a second consumer (copy-minimal-md). Moving twice beats guessing once.
- **The full table snapshot layer** — snapshot reads with roles and logical coordinates, character-range masks, write receipts. Built for the second consumer; the current engine does not need it.
- **Event-bus session replay tooling.** The design enables it (record intents, replay against a fresh model); building it is separate work.

## Decisions Log

- 2026-08-25: Initial draft generated by the sprint-plan skill from the internal architecture review (2026-08-22, revised 2026-08-25).
