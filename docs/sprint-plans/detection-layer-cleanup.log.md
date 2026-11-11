# Sprint Stack Run Log: Detection Layer Cleanup

Plan: docs/sprint-plans/detection-layer-cleanup.md
JSON: docs/sprint-plans/detection-layer-cleanup.json
Base branch: main

## Run 1 — 2026-11-10

### Completed

- **detect-comments** — chore/detect-comments → PR #613 (https://github.com/ArieFisher/dynamic-rounding/pull/613)
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,061; library 827; documented examples 90)
  - The sprint changes comment text alone, so the test-writer step added no test. The orchestrator checked the criteria directly: the file with comments stripped matches `main`, and comment lines fall from 1,159 to 1,008.
  - The first review blocked on four rewritten comments that stated something the code does not do. After APPROVE, the orchestrator applied one bucket-1 fix, a comment reflow, as its own `chore(detect)` commit.
  - Follow-up: #614.

- **detect-identifiers** — commits on feature/detection-layer-cleanup (no pull request of its own)
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (extension 4,061; library 827; documented examples 90)
  - The sprint renames identifiers alone, so the test-writer step added no test. After APPROVE, the review's bucket-1 fixes (comment reflow and canon test names) went in as their own `chore(detect)` commit.
  - Follow-up: #616.

- **detect-unused-logic** — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,090; library 827; documented examples 90)
  - The `trimmed` field stays, because the content script reads it. The patch writer's written-piece list stays, because a test reads it; no production code reads it.
  - The first review blocked on comments the removal left false: a docblock that still described an inline-style read, and test comments that named the geometry probe's steps by their old numbers. Test comments now name the steps.
  - FYI: the artifact filter now reads position through the style probe alone. On an attached table this matches the old read; a detached table with inline positioning no longer reads as an accessibility artifact.

- **detect-shared-helpers** — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,092; library 827; documented examples 90)
  - Left: the right-click resolver keeps calling `findTables`. `nominateNest` covers the clicked element's own nest alone, so the swap stops a click from reaching a grid nested in another cell of an outer grid whose own nest yields nothing. That is a behavior change; #617 holds the decision.
  - The first review blocked on a lost bound: the shared row builder made the geometry probe read the spans of every candidate row. The probe now reads no more rows than the data test's cell budget, and a test pins it.
  - Follow-up: #617.

- **link-filter-by-position** — commits on feature/detection-layer-cleanup; closes #399
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (extension 4,123; library 827; documented examples 90)
  - The new tests for a repeated number, plain and linked in either order on both table kinds, fail on the pre-sprint code and pass now.
  - One test came out: it asserted only the removed stored link result.
  - A match that no single text piece holds stays in the list, where #399 asked for it to drop. The placement step sends no such match to the filter, and the patch writer skips one, so no result changes.
  - The Sheets build changed comments and the table step's internal return shape alone; a Sheets user sees no difference.
  - Follow-up: #618.

- **cell-object-writes** — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (extension 4,123; library 827; documented examples 90)
  - The sprint changes no behavior and the suite passes unchanged, so the test-writer step added no test. The review confirmed that the restore method's four outcomes are the old cell-release branches, which the existing restore and hover-text tests reach.

- **split-table-package** — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (extension 4,123; library 827; documented examples 90)
  - Git cannot pair the moves as renames, because the detection file keeps its name. A scratch script compared every top-level declaration, doc comment included, before and after: 77 each, none lost, duplicated, or changed.
  - The placement step's three exported names moved from `DR_TABLE` to `DR_SIMPLIFY`, because the placement file loads with the simplification library, after `DR_TABLE` is built. No code outside the tests read them through either object.
  - After APPROVE, comments in other files that named the old file for a moved symbol were pointed at the new files, as their own `chore(table)` commit.

- **freeze-both-kinds** — commits on feature/detection-layer-cleanup; the final pull request carries the `minor` label
  - Reviewer: APPROVE (after 2 retries)
  - Tests: pass (extension 4,143; library 827; documented examples 90)
  - The new comparison test fails on the pre-sprint code for native tables and passes on both kinds now.
  - The product manager added two changes the review surfaced: the lens preview reads the table's magnitude freeze, and the sidebar refreshes the lens preview after its own settings write, so the preview matches the cells after a settings change computes the max magnitude fresh.

- **header-and-span-parity** — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,203; library 827; documented examples 90)
  - The first review blocked on the span reader: a `td` reports a span of 1 with no `colspan` attribute, so reading the property first dropped a grid cell's `aria-colspan`. The reader now takes the HTML attribute when the element carries one, else the accessibility attribute.
  - Product manager's choice: a first row of header cells alone counts as a header row only on a table that groups its rows. A grid that groups nothing keeps the column count alone, because a virtualized grid can scroll its first row away and the table would then register fresh.

- **artifact-filter-both-kinds** — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,474; library 827; documented examples 90)
  - Product manager's choices: the chart check is removed; the hidden and off-screen checks run on both kinds through one filter in the detection file.
  - The right-click resolver keeps its native-table route, because unscanned native tables, a table in a grid cell, and #600 depend on it; the route now passes through the same filter, and skips an artifact for the table around it.
  - Follow-up: #619.
- **Added: one-table-scan (sprint 12)** — the load-time scan, the added-node pass, and `findTables` each keep their own table search; the product manager asked for one scan function they all call, as its own sprint.

- **grid-shown-text** — commits on feature/detection-layer-cleanup; closes #525
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,473; library 827; documented examples 90)
  - Measured re-apply pass on a 10,000-cell grid, headless Chromium in a container: median about 172 ms with the rendered-text read, about 175 ms with the flat-text read, about 173 ms on a native table of the same size. The product manager set the pass budget to 200 ms.
  - Both kinds now share one cell object and one text read. Stacked years on separate lines round on both kinds, as native tables already did; #620 holds the fix.
  - Follow-up: #620.

- **one-table-scan** (sprint 12) — commits on feature/detection-layer-cleanup
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (extension 4,473; library 827; documented examples 90)
  - The load-time scan, the added-node pass, and `findTables` call one scan function, which holds the one native-table query and the one call to the nomination step.

- **remove-words-switch** (sprint 13) — feature/remove-words-switch, after #621 merged
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 4,512; library 834; documented examples 90; Python 227)
  - Product manager's choices: the words switch and the stacked-cell test are removed; a number is placed by its digits; a number that crosses two text pieces stays as written by itself; a line break never groups digits, on every platform. The percentages and currencies switches stay.
  - The first review blocked on the Python package, which still grouped digits across a line break.

### Blocked

None.

### Deferred

None.

### Change to the dependent policy

After #613 merged, the product manager replaced the plan's after-merge policy. Every later sprint stacks as commits on one branch, `feature/detection-layer-cleanup`, and one pull request at the end merges the stack. After each sprint the orchestrator pushes the branch and starts the Tests and Repo hygiene workflows on it by hand, since both start on their own only for `main` and pull requests into `main`.
