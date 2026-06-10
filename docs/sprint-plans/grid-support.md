# Sprint Plan: Virtualized Data Grid Support

**Created:** 2026-06-10
**Base branch:** main
**Slug:** grid-support

## Context

The dynamic-rounding Chrome extension rounds numbers in native HTML `<table>`
elements. Modern web apps — Databricks SQL, AG Grid dashboards, Azure Data
Studio, AWS Cloudscape — render query results as virtualized data grids built
from `<div role="grid">` containers split into **pinned** (frozen columns) and
**scrollable** panes. These grids are completely invisible to the extension
today.

Research is in `docs/research/databricks-grid-detection.md`. The key structural
facts:

- **Databricks SQL:** `.dg--table-wrapper` wraps `.dg--pinned-grid` +
  `.dg--grid-scroll-container` (both `role="grid"`).
- **AG Grid:** `.ag-pinned-left-cols-container` + `.ag-center-cols-viewport`.
- Grids use `role="grid"` / `role="row"` / `role="gridcell"` ARIA attributes.
- **Virtualization:** only visible rows are in the DOM; nodes are recycled as
  the user scrolls — so there is no single "full table" in the DOM at any time.

Every layer of `content.js` is hard-wired to the `<table>` DOM API, so adding
detection alone is not sufficient. The four sprints below address: discovery,
abstraction, rounding, and virtualization — in dependency order.

## 1. Repo Survey

- Chrome extension (MV3) at `chrome-extension/`: `content.js` (~1800 lines,
  all table logic), `sidebar.js` / `sidebar.html` (options UI), `defaults.js`
  (shared `DR_DEFAULTS`), `tests.js` (~6 k lines, Node test runner).
- Key functions and their DOM coupling:

| Function | Line | Coupling |
|---|---|---|
| `injectTableToggles` | 434 | `querySelectorAll('table')` |
| MutationObserver | 469–494 | `querySelectorAll('table')` |
| right-click handler | 49, 71 | `closest('table')` |
| `isDataTable` | 288 | `.rows`, `.cells` |
| `roundTable` | 740 | `table.rows`, `row.cells`, `cell.tagName !== 'TD'` |
| `resetTable` | 636 | `table.rows` |
| `extractPreviewSamples` | 681 | `table.rows`, `row.cells` |
| `positionToggle` | 261 | `table.getBoundingClientRect()` |

- Test command: `node chrome-extension/tests.js`
- Branch naming: `feature/<label>` (never `claude/`)
- Commit convention: Conventional Commits
- Version bumps: handled by `.github/workflows/bump-version.yml` on merge to
  main; sprint branches must NOT bump versions.

## 2. Design

### D1 — Grid discovery (sprint 1 only)

Extend `injectTableToggles`, the MutationObserver, and the right-click handler
to find ARIA grids alongside native tables.

**Primary selector:** `[role="grid"], [role="table"]`

**Heuristic fallback** (for grids that omit ARIA — see research doc §2):
- Container has ≥ 5 direct children with uniform `offsetHeight > 0`.
- Container or children use `display: grid` or `display: flex`.

**False-positive filter (co-occurrence rule):** only promote a heuristic-
matched container if it has both a "pinned" sibling and a "scrollable" sibling
under the same parent. ARIA-matched grids bypass this filter.

In sprint 1, a discovered grid gets a toggle button and toggle positioning; no
rounding is attempted yet. A sentinel class `dr-ext-grid` is added to the root
element so later sprints can locate it without re-running discovery.

### D2 — TableAdapter abstraction (sprint 2)

Introduce two classes in `content.js`:

```
NativeTableAdapter(tableElement)
  .getRows()        → [{ getCells() → [{ getText(), setText(s), el }] }]
  .getElement()     → the <table> element
  .isVirtualized()  → false

GridAdapter(wrapperElement)
  .getRows()        → visible rows, stitched from pinned + scrollable
  .getElement()     → the wrapper element
  .isVirtualized()  → true
```

`getRows()` for `GridAdapter`: collect `[role="row"]` children from the
scrollable pane; for each, also collect the same-index row from the pinned pane
(if present); merge cells in DOM order (pinned columns first). This stitching is
the interface contract — callers never know they are reading two DOM trees.

`NativeTableAdapter.getRows()` wraps `table.rows` / `row.cells` exactly as
today. All existing behavior is preserved verbatim.

`roundTable`, `resetTable`, `extractPreviewSamples`, and `isDataTable` are
rewritten to call `adapter.getRows()` instead of `table.rows`. No caller is
changed; the adapter is constructed at the call site based on element type.

### D3 — GridAdapter read/write + visible-row rounding (sprint 3)

Implement `GridAdapter` fully (sprint 2 defines the interface; sprint 3 fills
in the body). Key concerns:

- `getText()` reads `cell.textContent` (grids use no `<td>`; cells are
  `[role="gridcell"]` divs).
- `setText(s)` writes `cell.textContent` and applies `.dr-ext-rounded` just as
  `roundTable` does today — but only to visible (currently-rendered) cells.
- `resetTable` via the adapter clears `.dr-ext-rounded` only from nodes
  currently in the DOM; sprint 4 handles persistence across scroll.

### D4 — Virtualization re-apply observer (sprint 4)

When a grid is rounded, attach a `MutationObserver` to each scroll container
that watches for `childList` changes (row recycling). On each mutation, re-run
the rounding pass for newly-added rows, using the stored `tableOptions`
WeakMap entry for the grid's wrapper element. Unrounded grids get no observer.

The observer is torn down when the toggle is switched off (same path that calls
`resetTable`).

## 3. Sprint List & Dependency Graph

### Sprint List

1. **grid-detection** — Discovery + toggle placement for ARIA grids; no
   rounding. _Depends on:_ none.
2. **grid-adapter** — `NativeTableAdapter` / `GridAdapter` interface;
   refactor `roundTable`, `resetTable`, `extractPreviewSamples`, `isDataTable`
   to use adapters. Existing tests must stay green. _Depends on:_ none (can
   overlap with sprint 1 on a separate branch; merges to main independently).
3. **grid-rounding** — Implement `GridAdapter` body; enable rounding for
   currently-visible grid rows. _Depends on:_ grid-adapter merged to main.
4. **grid-virtualization** — MutationObserver on scroll containers to re-apply
   rounding on row recycle. _Depends on:_ grid-rounding merged to main.

### Dependency Graph

```mermaid
flowchart TD
    base[main]
    s1["grid-detection<br/>Discovery + toggle, no rounding"]
    s2["grid-adapter<br/>TableAdapter abstraction, tests green"]
    s3["grid-rounding<br/>GridAdapter body + visible-row rounding"]
    s4["grid-virtualization<br/>Re-apply on scroll / row recycle"]
    base --> s1
    base --> s2
    s2 --> s3
    s3 --> s4
```

Sprints 1 and 2 are independent of each other (different files, no shared
interface) and can be developed in parallel. Sprint 1 can also merge to main
before sprint 2 — the toggle will appear on grids but do nothing until sprint 3.

## 4. Sprint Definitions

### grid-detection

- **Goal:** Make the extension discover and badge ARIA data grids with the
  existing toggle button. No rounding happens yet; this sprint validates that
  discovery and toggle positioning work on real pages (Databricks, AG Grid).
- **Scope — `chrome-extension/content.js`:**
  - `injectTableToggles` (L434): after the `querySelectorAll('table')` pass,
    add a second pass: `querySelectorAll('[role="grid"], [role="table"]')`,
    deduplicating any native `<table>` that also carries the role. For each
    result, call `createToggleForTable` with a guard that skips elements already
    carrying `dr-ext-grid` (idempotency).
  - Heuristic fallback: extract `findNonStandardTables()` (from research doc §4)
    as a module-level function; call it after the ARIA pass; apply the
    co-occurrence filter (skip if no pinned+scrollable sibling pair detected).
  - MutationObserver (L469–494): mirror both passes in the added-node and
    removed-node branches.
  - Right-click handler (L49, L71): change `closest('table')` to
    `closest('table, [role="grid"], [role="table"], .dg--table-wrapper')`.
  - `createToggleForTable`: add an early guard — if the element is not a
    `<table>`, skip `isDataTable()` (it will fail on `.rows`) and instead use a
    lighter check: does the element contain at least one `[role="gridcell"]` or
    a direct child with `display: flex/grid`? If yes, attach the toggle.
  - Mark discovered grids with `el.classList.add('dr-ext-grid')`.
  - `positionToggle`: already uses `getBoundingClientRect()`, which works for
    any element — no change needed.
- **Scope — `chrome-extension/tests.js`:**
  - Add unit tests for `findNonStandardTables()` against synthetic DOM fixtures:
    a passing case (ARIA grid), a passing heuristic case (pinned+scrollable),
    a rejected heuristic case (no co-occurrence), and a layout-grid false
    positive (single-pane CSS grid, no sibling pair).
- **Out of scope:** Any actual rounding of grid contents. The toggle's click
  handler will fire but `roundTable` will no-op (`.rows` is undefined on a
  div) — that is acceptable for this sprint.
- **Acceptance criteria:**
  - On a page with `<div role="grid">`, the extension injects a toggle button
    correctly positioned at the grid's top-right corner.
  - Right-clicking a cell inside a `[role="grid"]` sets `lastRightClickedTable`
    to the grid wrapper.
  - No toggle appears on a plain CSS layout grid lacking the co-occurrence of
    pinned + scrollable containers.
  - `node chrome-extension/tests.js` passes.
- **Depends on:** none
- **Complexity:** S
- **Dev notes:**
  - Do not rename `lastRightClickedTable` — the variable's type widens to
    "table or grid wrapper" but the name change is cosmetic and would touch too
    many call sites. Document the widened contract in a brief comment.
  - Do not bump `manifest.json` version.

---

### grid-adapter

- **Goal:** Refactor the rounding engine to operate on a `TableAdapter`
  interface rather than raw `<table>` DOM. `NativeTableAdapter` must be
  behavior-identical to today — all existing tests stay green. `GridAdapter`
  defines the interface contract but its body is a stub (sprint 3 fills it in).
- **Scope — `chrome-extension/content.js`:**
  - Define `NativeTableAdapter` class at module level (near `isDataTable`):
    - `constructor(el)` — stores `this.el = el`.
    - `getElement()` — returns `this.el`.
    - `isVirtualized()` — returns `false`.
    - `getRows()` — returns `Array.from(el.rows).map(row => ({ getCells: () =>
      Array.from(row.cells).map(cell => ({ getText: () => cell.innerText ||
      cell.textContent, setText: (s) => { /* existing write logic */ },
      el: cell, tagName: cell.tagName })) }))`.
  - Define `GridAdapter` class stub:
    - `constructor(el)` — stores `this.el = el`.
    - `getElement()` — returns `this.el`.
    - `isVirtualized()` — returns `true`.
    - `getRows()` — returns `[]` (stub; sprint 3 implements).
  - Add `makeAdapter(el)` factory: returns `new NativeTableAdapter(el)` if
    `el.tagName === 'TABLE'`, else `new GridAdapter(el)`.
  - Rewrite `isDataTable(table)`: accept an adapter (or element — wrap in
    `makeAdapter` if an element is passed). Replace `.rows` / `.cells` access
    with `adapter.getRows()` / `row.getCells()`.
  - Rewrite `roundTable(table, options)`: call `makeAdapter(table)` at the top;
    replace all `table.rows` / `row.cells` / `cell.tagName` access with adapter
    calls. Return early if `adapter.getRows().length === 0` (handles the stub).
  - Rewrite `resetTable(table)`: replace `table.rows` access with
    `makeAdapter(table).getRows()`.
  - Rewrite `extractPreviewSamples(table)`: same.
  - The `tableOptions` WeakMap key remains the raw element (not the adapter) —
    adapters are ephemeral per-call, elements are stable.
- **Scope — `chrome-extension/tests.js`:**
  - All existing tests must pass unchanged. Add two adapter unit tests:
    `NativeTableAdapter` round-trips `getText`/`setText` correctly;
    `GridAdapter` stub `getRows()` returns `[]` without throwing.
- **Out of scope:** `GridAdapter.getRows()` implementation (sprint 3). Any
  changes to `sidebar.js`, `defaults.js`, or the toggle UI.
- **Acceptance criteria:**
  - `node chrome-extension/tests.js` passes with zero regressions.
  - Rounding a native `<table>` produces byte-identical results to the
    pre-refactor build (verified by the existing test suite).
  - `roundTable` called on a `[role="grid"]` element returns without throwing
    (stub path).
- **Depends on:** none
- **Complexity:** M
- **Dev notes:**
  - The adapter is constructed fresh on each `roundTable` / `resetTable` call —
    no caching. Grids change their row count on scroll; a cached adapter would
    return stale rows.
  - Keep `NativeTableAdapter.getRows()` implementation as a thin wrapper around
    the existing logic — do not simplify or restructure the row/cell iteration.
    The goal is zero behavior change, not cleanup.
  - Do not bump `manifest.json` version.

---

### grid-rounding

- **Goal:** Implement `GridAdapter.getRows()` so that rounding, reset, and
  preview-sample extraction work on the currently-visible rows of a data grid.
- **Scope — `chrome-extension/content.js`:**
  - Implement `GridAdapter.getRows()`:
    1. Find the scrollable pane: `this.el.querySelector('[role="grid"]:not(.dg--pinned-grid), .dg--grid-scroll-container, .ag-center-cols-viewport')` — fall back to `this.el` if no match.
    2. Find the pinned pane: `this.el.querySelector('.dg--pinned-grid, .ag-pinned-left-cols-container')` — may be `null`.
    3. Collect scrollable rows: `Array.from(scrollPane.querySelectorAll(':scope > [role="row"], :scope > * > [role="row"]'))` (one level of indirection for some grid libraries).
    4. For each scrollable row at index `i`, collect pinned row at the same index (if pinned pane exists): match by `data-row-index` attribute if present, otherwise by DOM index.
    5. Return row objects: `{ getCells: () => [...pinnedCells, ...scrollableCells].map(cell => ({ getText: () => cell.textContent, setText: (s) => { cell.textContent = s; cell.classList.add('dr-ext-rounded'); cell.dataset.drOriginal = cell.dataset.drOriginal || cell.textContent; }, el: cell, tagName: 'TD' /* normalized */ })) }`.
  - `setText` in `GridAdapter` must store the original value in
    `cell.dataset.drOriginal` before overwriting (for reset), mirroring how
    `NativeTableAdapter` stores it.
  - `resetTable` via `GridAdapter`: clear `.dr-ext-rounded`, restore
    `cell.textContent` from `cell.dataset.drOriginal`, delete
    `cell.dataset.drOriginal`.
  - `isDataTable` via `GridAdapter`: sample up to 10 cells from `getRows()`;
    return `true` if any contains a finite parseable number.
  - Update `createToggleForTable` grid path (from sprint 1): now that
    `getRows()` works, replace the stub check with `isDataTable(makeAdapter(el))`.
- **Scope — `chrome-extension/tests.js`:**
  - Add tests with synthetic ARIA grid DOM fixtures:
    - A simple `role="grid"` with two visible `role="row"` children and
      `role="gridcell"` cells containing numbers: rounding applies.
    - A grid with a pinned pane: cell stitching produces correct column order.
    - `resetTable` on a rounded grid restores original values.
    - `extractPreviewSamples` on a grid returns the expected sample structure.
- **Out of scope:** Re-applying rounding on scroll / row recycle (sprint 4).
  The rounding state is lost when rows leave the viewport — that is acceptable
  and documented as a known limitation until sprint 4.
- **Acceptance criteria:**
  - Right-clicking a cell in a Databricks SQL result grid and choosing "Apply
    rounding" visibly rounds the numbers in all currently-visible cells.
  - Toggling off restores original values.
  - `node chrome-extension/tests.js` passes.
- **Depends on:** grid-adapter merged to main
- **Complexity:** M
- **Dev notes:**
  - The pinned/scrollable stitching by DOM index is fragile if the two panes
    have different row counts (e.g., header rows in one but not the other). Use
    `data-row-index` matching when available; log a `console.debug` warning and
    fall back to index matching otherwise.
  - Do not attempt to scroll-trigger additional row rendering — only round what
    is visible.
  - Do not bump `manifest.json` version.

---

### grid-virtualization

- **Goal:** Keep a rounded grid rounded as the user scrolls: re-apply (or
  un-apply) rounding to rows that are recycled into the viewport.
- **Scope — `chrome-extension/content.js`:**
  - Add `gridObservers: WeakMap<Element, MutationObserver>` at module level
    (parallel to `tableToggles`).
  - In `roundTable`, after applying rounding, check `adapter.isVirtualized()`.
    If `true`:
    1. Find the scroll container element (same query as `GridAdapter.getRows()`,
       step 1).
    2. Create a `MutationObserver` that, on each `childList` mutation, calls a
       helper `reapplyGridRounding(wrapperEl)`.
    3. `reapplyGridRounding`: re-runs `roundTable(wrapperEl, tableOptions.get(wrapperEl))`
       but only processes rows that do **not** already have `.dr-ext-rounded`
       cells — avoids double-rounding already-visible rows.
    4. `observe(scrollContainer, { childList: true, subtree: true })`.
    5. Store in `gridObservers.set(wrapperEl, observer)`.
  - In `resetTable`, if `adapter.isVirtualized()` and `gridObservers.has(el)`:
    disconnect and delete the observer before clearing cells.
  - In the MutationObserver that watches for removed tables (L493): also check
    `gridObservers` for the removed element and disconnect.
- **Scope — `chrome-extension/tests.js`:**
  - Synthetic test: create a grid wrapper, round it, simulate row recycling via
    `appendChild` of a new `role="row"` child, verify `reapplyGridRounding` is
    called and the new row is rounded.
  - Verify that after `resetTable`, appending a new row does NOT trigger
    rounding (observer disconnected).
- **Out of scope:** Handling horizontal scroll (new columns entering the
  viewport) — column virtualization is rare and adds significant complexity;
  defer to a follow-up sprint.
- **Acceptance criteria:**
  - In a Databricks SQL result, scrolling down after rounding causes newly-
    visible rows to be rounded automatically.
  - Turning off rounding stops re-application.
  - No observable performance regression on pages with native `<table>` elements
    (the observer is never attached to non-virtualized tables).
  - `node chrome-extension/tests.js` passes.
- **Depends on:** grid-rounding merged to main
- **Complexity:** M
- **Dev notes:**
  - `reapplyGridRounding` must be debounced (e.g., 50 ms `requestAnimationFrame`
    or `setTimeout`) — grids can fire dozens of DOM mutations in a single scroll
    tick and we don't want to re-run rounding synchronously for each one.
  - The `subtree: true` option is necessary because grids often wrap rows in an
    intermediate container. Monitor observed mutation counts in practice; if the
    observer is too noisy, narrow to `childList: true` without `subtree` and
    instead watch only direct children of the scroll container.
  - Do not bump `manifest.json` version.

## 5. Open Questions

- **Synchronized-scroll verification:** The research doc flags this as
  unresolved. Before sprint 3 ships, manually verify on a live Databricks page
  that scrolling the scrollable pane does move the pinned pane in sync (it
  almost certainly does, but the stitching logic in `GridAdapter.getRows()`
  depends on row index alignment being maintained at all times).
- **AG Grid and Cloudscape selectors:** The sprint 3 `GridAdapter` selector
  list covers Databricks and AG Grid. AWS Cloudscape (`.awsui-table-wrapper`)
  and Azure Data Studio have not been tested. Add their selectors before sprint
  3 ships if a test environment is available.
- **Column virtualization:** Some grids (especially wide ones) also virtualize
  columns — cells outside the horizontal viewport are not rendered. Sprint 4
  does not address this. If it becomes a user report, it warrants a sprint 5.
- **Right-click targeting depth:** `closest('[role="grid"]')` walks up from the
  clicked cell. If the grid library wraps cells in extra divs, the walk may
  overshoot to a parent grid. Add a depth limit or prefer the closest match.

## 6. Out of Scope (Separate Sprint-Stack)

- Column virtualization (horizontal scroll recycling).
- Google Sheets / Excel Online (these use canvas rendering in some browsers, not
  DOM nodes — a fundamentally different approach is needed).
- Python / `js/` sibling implementations — grid support is browser-only.

## Decisions Log

- 2026-06-10: Initial draft. Sprints 1 and 2 are independent; 3 depends on 2;
  4 depends on 3.
