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
  - Criterion missed: the detection file is 2,122 lines against a target of 1,958. Its code is 64 lines shorter; the doc comments AGENTS.md requires on the twelve new functions add more than that. The target also counted two items the sprint left out: the options resolver, which would have added lines, and the right-click resolver change below. The product manager decides whether to accept the miss.
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

### Blocked

None.

### Deferred

- **grid-shown-text** — waits on an answer to the plan's §6 question 1.
- **artifact-filter-both-kinds** — waits on an answer to the plan's §6 question 2.

### Change to the dependent policy

After #613 merged, the product manager replaced the plan's after-merge policy. Every later sprint stacks as commits on one branch, `feature/detection-layer-cleanup`, and one pull request at the end merges the stack. After each sprint the orchestrator pushes the branch and starts the Tests and Repo hygiene workflows on it by hand, since both start on their own only for `main` and pull requests into `main`.
