# Sprint Plan: Lens Metrics

**Status:** DRAFT — awaiting the product manager's approval
**Created:** 2026-10-19
**Base branch:** main
**Slug:** lens-metrics
**Issue:** #560

Three figures that describe what the lens the lens control shows does to the
active table's dataset: rounding error, distinct values, and significant
digits. The sidebar shows them above the capture marks, they move with the lens
control, and the capture carries them with the pairs behind them. The
vocabulary's Lens metrics section defines each figure; this plan states how the
extension computes and shows them.

## 1. Repo Survey

**Languages and shape.** Three platforms share one algorithm: a Google Sheets
library (`js/`), a Python package (`python/`), and a Chrome extension
(`chrome-extension/`). This plan touches the extension and adds one case table
under `js/`. The extension is plain browser JavaScript under Manifest V3 with
no build step: the manifest lists the content scripts in dependency order and
every file declares globals into one shared scope. The sidebar page loads the
number library through script tags, so the sidebar and the content script run
the same rounding functions in two contexts.

**Tests.** One hand-rolled Node suite, `chrome-extension/tests.js`, joins the
test pieces in `chrome-extension/tests/` and runs them as one script. Baseline
on `main` at the time of writing: 3,976 passing extension assertions, 260
Sheets assertions, 69 documented examples. The rounding algorithm's one
contract across the three platforms is `js/round-dynamic-cases.json`, a case
table every suite runs.

**Where the work lands.** The number library
(`chrome-extension/lib/dr-number/`), the content script's preview-sample
responder (`chrome-extension/content.js`), the sidebar
(`chrome-extension/sidebar.html`, `chrome-extension/sidebar.js`), the capture
state and renderer (`chrome-extension/lib/dr-capture/state.js`,
`chrome-extension/lib/dr-capture/render.js`), one new case table under `js/`,
the manual test page (`docs/test-pages/tables.html`), and the living docs.

**The code as it stands**, checked against `main` for this plan:

- The lens preview's pool is `collectNumericCells` in `content.js`: every number
  the table rounds under its live table settings, pure and extracted cells
  alike, every row, dates and times out, excluded cells out, zero out of the
  pure branch. `extractPreviewSamples` picks a few samples from that pool,
  computes the max magnitude from the pool, and answers the
  `request:previewSamples` topic with `{ samples, maxMag }`. The pool itself
  never leaves the content script.
- The sidebar (`fetchPreviewSamples`) asks for the samples on sidebar open,
  table activation, table switch, and every settings notice, and holds the
  answer in `cachedSamples` and `cachedMaxMag`. It rounds each sample itself
  with `roundWithOffset` and the band's slider value, `topVal` or `botVal`, and
  redraws the bands on every slider move without a new request. `numTop` has no
  sidebar control; the sidebar writes 1.
- `roundCellSetAware(value, num, max_mag, offset_top, offset_other, num_top)`
  in `lib/dr-number/rounding.js` holds the band rule the table uses and loads in
  both contexts.
- The re-apply observer's pass (`runReapplyPass`) rewrites the cells of a table
  that is on when the page changes them, and publishes nothing to the sidebar.
  `state:previewSamplesChanged` is published on sidebar open and on the
  active table's removal alone. After a page loads new data into a table that
  is on, the lens preview shows the old samples until the next sidebar open,
  activation, or settings write.
- The sidebar's half of the capture state (`collectSidebarView`) reads the
  controls and the drawn lens preview text at finish time. `CAPTURE_FORMAT`
  is 9. The capture renderer (`renderSidebarPanel` in `render.js`) draws the
  lens preview rows after the lens control rail, then the status line.
- The capture section in `sidebar.html` sits after the status line: three mark
  buttons, then the hidden remarks form.
- The lens control's stops are -2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1.

## 2. Repo Conventions

- **Version files:**
  - `chrome-extension/manifest.json` — dotted integers in the `version` key
    (2.2.13 today). The merge-time workflow bumps it; sprint branches never
    touch it.
  - `python/pyproject.toml` — semver in the `version` key (0.2.5 today). Same
    rule; no sprint here changes `python/`.
- **Test command:** `node chrome-extension/tests.js && node js/tests.js && node js/doc-tests.js`
- **Gate command:** `scripts/check-files.sh --staged && scripts/check-vocab.sh --staged`,
  run by the pre-commit hook and the repo-hygiene workflow on every pull request.
- **Lint, format, build:** none configured; the extension loads unbuilt.
- **Branch naming:** `feature/<label>`, `fix/<label>`, `refactor/<label>`,
  `chore/<label>`, `docs/<label>`, `plan/<slug>`; never `claude/` or `session/`.
- **Commit convention:** Conventional Commits. A vocabulary change lands as its
  own `docs:` commit on the sprint branch. No attribution trailer and no
  generated-by line, per `AGENTS.md`.
- **PR template:** none as a file; `AGENTS.md`, section Pull requests, states
  the body rules: the diff test, `## Tested` with results inline, and
  `## Manual tests` as unchecked boxes that name the test page section.
- **Dependent policy:** `after-merge`. This plan has one sprint and no
  dependent.
- **Version bump policy:** `merge-workflow`.
- **Base branch writes:** `pull-request`.
- **Vocabulary:** `docs/vocabulary.md` is the canon. The Lens metrics section
  landed with this plan; the sprint updates the capture state entry when the
  capture gains the figures.
- **Regression fixtures:** synthetic and minimized.
- **Docs track behavior:** the sprint's dev notes name the living docs it
  updates.
- **Manual test page:** the sprint adds a section to `docs/test-pages/tables.html`
  and names it in the pull request.

## 3. Design

### 3.1 One module from pairs to figures

A new file in the number library, `lib/dr-number/metrics.js`, exports pure
functions over a list of pairs, each `{ original, simplified }` as numbers:

- `roundingError(pairs)` — the sum of `|original - simplified|` over the sum of
  `|original|`, as a fraction; `null` when the denominator is zero.
- `distinctValues(values)` — the count of distinct numbers in a list, by
  numeric value.
- `significantDigits(value)` — the count for one number, read from the
  number's shortest exact decimal text with the sign, the decimal mark, leading
  zeros, and trailing zeros left out; 0 counts as 1.
- `meanSignificantDigits(values)` — the mean over a list.
- `lensMetrics(pairs)` — the three figures in one record:
  `{ roundingError, distinctValues: { original, simplified },
  significantDigits: { original, simplified }, count }`.

The module reads no settings, no table, no page, and no bus, and never calls
the rounding functions. Which values join the list, and how each one was
rounded, is the caller's business. That boundary is what lets the sidebar, the
capture, and a later spreadsheet or Python function use the same module.

### 3.2 The contract across platforms

A case table, `js/lens-metrics-cases.json`, beside the rounding case table:
each case holds an original list, a simplified list, and the three expected
figures. The first cases are the nine values from the product manager's
spreadsheet at offsets 0, -0.5, and -0.25 (rounding error 13.2%, 4.3%, 2.2%;
distinct values 9 → 4, 5, 7; significant digits 7.0 → 1.0, 1.7, 2.3), plus
cases for an empty list, a list of zeros, negatives, decimals, and a value
already round. The extension suite runs it now. A later Sheets or Python copy
of the module runs the same table, and nothing else ties the copies together,
as with the rounding algorithm.

### 3.3 The sidebar computes from the pool

The `request:previewSamples` answer gains a `numbers` field: the pool's numeric
values, in document order. The responder already has the pool in hand when it
picks the samples, so this is a wider answer on the one request, not a second
request. The sidebar holds it beside `cachedSamples`.

On every redraw of the lens preview (`renderPreviewBands`), the sidebar builds
the pairs: for each number, the simplified value is
`roundCellSetAware(number, number, cachedMaxMag, topVal, botVal, 1)`, the
shared band rule under the slider's live values. It passes the pairs to
`lensMetrics` and draws the three rows. The figures move with the slider as the
bands do, whether the table is on or off, and the sidebar sends no request while
dragging.

### 3.4 Three rows above the capture marks

A `metricsSection` in `sidebar.html` between the status line and the capture
section, three rows of label and value:

```
rounding error        4.3%
distinct values       9 → 5
significant digits    7.0 → 1.7
```

Rounding error shows one decimal place as a percentage. Distinct values shows
two integers. Significant digits shows two figures with one decimal place. An
unbound sidebar, or a pool with no numbers, shows the three values blank, as
the lens preview is blank.

### 3.5 The capture carries the figures and the pairs

`collectSidebarView` adds a `lensMetrics` field: the figures as `lensMetrics`
returns them, and the pairs the figures came from, so a reader can recompute
every figure from the file. `CAPTURE_FORMAT` becomes 10. The capture renderer
draws the three rows under the lens preview rows in the sidebar likeness; the
pairs stay in the JSON island alone. An unbound capture carries `null`.

### 3.6 The re-apply pass tells the sidebar

`runReapplyPass` publishes `state:previewSamplesChanged` after its pass when
the table is the active one. The sidebar then re-reads the active table's
settings and the pool, and redraws the lens preview and the metrics. The
observer already collapses a burst of page edits into one pass, so the sidebar
re-reads once per burst. This closes the lens preview's staleness in the same
change, because the two share the one path. The product manager approved this
on 2026-10-19 over leaving the figures stale. The cost is one extra read of the
active table per burst while the sidebar is open: the content script walks the
cells through the classification step again to answer the pool request. If a
large virtualized grid scrolled without pause shows that cost, the pass can
attach the numbers it already classified to the message instead, so the
sidebar re-reads nothing; the sprint measures first and changes that only on a
measured cost.

### 3.7 The decisions on record

- The figures describe the lens the lens control shows, not the pass that ran.
  They move with the slider before the table is on.
- The pool is the dataset: every number the table rounds under its live table
  settings. A switch that changes the pool changes the figures; an excluded
  header year, an identifier shape, a date, a quoted cell stay out as they stay
  out of the rounding.
- Distinct values and significant digits show the original beside the
  simplified, because the original is the baseline. Rounding error is one
  figure.
- Crowding is defined and not displayed.
- On a virtualized grid the pool is the visible rows, as for the lens preview.
  The sidebar computes the max magnitude from the pool, so after a scroll that
  brings larger numbers into view, the sidebar's figures and the table's
  rounding rest on different max magnitudes. The lens preview has this property
  today; reading the registry's frozen magnitude in the sidebar is a separate
  change (§7).

## 3b. Simplicity

1. **Size.** The code grows. Additions, each against its requirement: the
   metrics module (the figures); the `numbers` field on the preview answer (the
   figures need the pool, which the responder already has); three rows in the
   sidebar and the code that fills them (the display); the `lensMetrics` field
   in the capture's sidebar view, its rendering, and the format bump (the
   capture carries the figures and the pairs); the case table and its runner
   (the cross-platform contract); one publish in the re-apply pass (§3.6); one
   test page section. Nothing comes out.
2. **Duplicates.** None opened. The sidebar already rounds the preview samples
   with the shared library and the slider's values; the metrics round the pool
   through the same library's set-aware function, which holds the band rule the
   table uses. One request carries samples and pool. The lens preview's refresh
   path carries the metrics' refresh.
3. **Removals.** The original baseline on the distinct and digit rows could go,
   leaving one figure each; the product manager asked for the baseline, so it
   stays. The pairs in the capture could go, leaving the figures; the product
   manager asked for the tracing information, so they stay. Nothing else is
   removable without losing a requirement.
4. **Orphans.** None. Every new field has a reader: the sidebar rows or the
   capture renderer. `crowding` has no code; it is a vocabulary term alone.
5. **Bounds.** The pool is bounded by the cells the classification step walks:
   a native table's cells, a grid's visible cells. The first simplification has
   no cell cap, so the pool has none; a cap belongs on the pass, not on the
   metrics, so both describe the same table. The answer carries the pool once
   per settings write, not per slider move; a native table of 100,000 cells
   sends 100,000 numbers, a few megabytes, which Chrome's messaging carries.
   The metrics over 100,000 pairs compute in a few milliseconds. The capture's
   pairs sit beside the originals the registry already carries, so the JSON
   island at most doubles its numeric part.
6. **Current behavior.** Verified against `main`: the pool, the sample picking,
   the sidebar's local rounding, the refresh events, the silent re-apply pass,
   and the capture format of 9 are as §1 states.

## 4. Sprint List & Dependency Graph

### Sprint List

| Sprint | Branch | Depends on | Complexity |
| --- | --- | --- | --- |
| lens-metrics | `feature/lens-metrics` | none | M |

### Dependency Graph

One sprint, no dependents.

## 5. Sprint Definitions

### lens-metrics

- **Goal:** The sidebar shows rounding error, distinct values, and significant
  digits for the active table under the lens the lens control shows, the
  figures move with the lens control and with the page's data, and the capture
  carries the figures and the pairs behind them.
- **Branch:** `feature/lens-metrics` off `main`.
- **Scope:** `chrome-extension/lib/dr-number/metrics.js` (new) and its script
  tags in `sidebar.html` and the manifest's content script list.
  `js/lens-metrics-cases.json` (new) and a test piece that runs it.
  `content.js`: `numbers` on the `request:previewSamples` answer; the publish
  in `runReapplyPass`. `sidebar.html` and `sidebar.js`: the metrics section,
  the pairs and the rows in `renderPreviewBands`, the `lensMetrics` field in
  `collectSidebarView`. `lib/dr-capture/state.js`: `CAPTURE_FORMAT` 10 and the
  format note. `lib/dr-capture/render.js`: the three rows in the sidebar
  likeness. Tests in `chrome-extension/tests/`: the module against the case
  table, the answer's `numbers` field, the sidebar's pairs under the band rule,
  the rows' text, the capture field and format pin, the re-apply publish.
  Living docs: the capture state entry and the lens metrics entry in
  `docs/vocabulary.md`; the sidebar and capture paragraphs in
  `chrome-extension/README.md`; the capture section of `docs/design.md`;
  `docs/test-pages/tables.html`, new section 34.
- **Out of scope:** A spreadsheet or Python metrics function. Reading the
  registry's frozen magnitude in the sidebar. A refresh for an off table whose
  page loads new data. Crowding in any display. A cell cap on the pool.
- **Acceptance criteria:**
  - The module returns the case table's figures for every case, and the suite
    fails when a case's figure changes.
  - On the nine values from the product manager's spreadsheet, the sidebar
    shows 13.2% / 9 → 4 / 7.0 → 1.0 at offset 0, 4.3% / 9 → 5 / 7.0 → 1.7 at
    -0.5, and 2.2% / 9 → 7 / 7.0 → 2.3 at -0.25, with the table on and with it
    off.
  - A slider move redraws the rows with no request to the content script; a
    settings write re-reads the pool.
  - With the top and other offsets apart, a number in the other band rounds
    under the other offset in the pairs, shown by a test that fails when the
    sidebar rounds every number under the top offset.
  - A page edit inside a table that is on redraws the lens preview and the
    rows once per burst.
  - An unbound sidebar shows blank values; a capture taken then carries
    `null`; a capture taken bound carries the figures and the pairs, and the
    format pins read 10.
  - The living docs and section 34 state the rule; the suites pass.
- **Depends on:** none
- **Complexity:** M
- **Dev notes:** The suite pins the capture format as a literal at many sites;
  each moves to 10. `significantDigits` must read the number's shortest exact
  text (`Number.prototype.toString`) and handle the exponent form for very
  small and very large values; a float such as 1.1000000000000001 never reaches
  it, because the rounding functions already strip float noise with
  `toPrecision(12)` and the originals come from parsed text. Section 34 holds
  the nine values as one native table and the expected figures at the three
  offsets; a failure reads as a figure that differs from the stated one. The
  vocabulary's capture state entry gains the figures and pairs on this branch
  as its own `docs:` commit.

## 6. Open Questions

Product calls, each with the recommendation the plan assumes:

1. **Staleness after the page loads new data.** Decided 2026-10-19: §3.6, the
   re-apply pass tells the sidebar, which also fixes the lens preview. The
   alternative, figures stale until the next sidebar open or slider move as the
   lens preview is today, was put to the product manager and not taken.
2. **An empty pool** (dates only, or a range that leaves nothing in): blank
   values, as the lens preview is blank. Recommended.
3. **Zero** in a cell with words joins the pool: one digit, no error
   contribution, one distinct value. Recommended.
4. **A tiny error:** one decimal place shows 0.04% as 0.0%. Recommended.
5. **A grid that scrolls:** the figures follow the visible rows under §3.6.
   The alternative, freezing the figures at the first pass, would describe rows
   no longer on the screen. Recommended: follow the visible rows.

## 7. Out of Scope

- A `=LENS_METRICS(original_range, simplified_range)` function for Google
  Sheets, and a Python function, each a copy of the module run against the
  case table. Separate changes once the extension's module and the case table
  land.
- The sidebar reading a virtualized grid's frozen magnitude from the registry
  so its figures match the table's rounding after a scroll. The lens preview
  has the same gap today.
- A refresh for a table that is off: it has no observer, so new data on an off
  table refreshes nothing until the next sidebar open or slider move.

## Decisions Log

- 2026-10-19: Names chosen: rounding error (the relative form), distinct
  values, significant digits; crowding defined and not displayed; merge group
  size dropped as a corollary of distinct values.
- 2026-10-19: The figures describe the lens the lens control shows, computed
  in the sidebar from the pool, whether the table is on or off.
- 2026-10-19: The capture carries the figures and the pairs behind them.
- 2026-10-19: The metrics module takes pairs alone, so every surface uses it
  without coupling; a case table under `js/` is the contract across platforms.
- 2026-10-19: The re-apply pass tells the sidebar the pool changed (§3.6),
  approved by the product manager after the cost was put to him: one extra
  classification walk per burst while the sidebar is open, measured before any
  change to push the pool instead.
