# Sprint Stack Run Log: Grid detection recovery, revised

Plan: docs/sprint-plans/grid-detection-recovery-v2.md
JSON: docs/sprint-plans/grid-detection-recovery-v2.json
Base branch: main

Policies: a dependent branches from `main` after its parent merges (`after-merge`); the merge-time workflow bumps versions (`merge-workflow`); every write to `main` goes through a pull request (`pull-request`). Models: reviewers on Fable; developers and test-writers on Sonnet in this run, and from run 2 on Sonnet for S sprints and Opus for M and L sprints.

## Run 1 — 2026-09-16 00:28 EDT to 2026-09-16 01:13 EDT

Wave 1: the two sprints with no dependency. Every other sprint waits on a merge.

### Completed
- **hidden-cells** — chore/hidden-cells → PR #359 (https://github.com/ArieFisher/dynamic-rounding/pull/359), merged during the run
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (2356 / 256 / 67; main held 2342 / 256 / 67 at the start)
  - Review fixes applied after APPROVE as one chore commit: the test header names the two cases the raw-text fallback covers, and the Detection paragraph uses the vocabulary's wording for unmarked grids.
  - Follow-up filed: #360, vocabulary rows for rendered text and raw text, and whether "displayed text" collapses into "rendered text".
  - FYI: the rounding assertion checks that the hidden cell's raw text changed and does not pin the exact simplified string; it still fails when the fallback is dropped.
- **detection-constants** — refactor/detection-constants → PR #362 (https://github.com/ArieFisher/dynamic-rounding/pull/362)
  - Reviewer: APPROVE (after 0 retries). The developer took one extra turn inside the attempt: its first pass failed on first call and not at load, so the vendor-profile list now reads the block at the top level.
  - Tests: pass (2409 / 256 / 67 after merging `main` with #359 in; the branch adds 53 assertions)
  - Review fixes applied after APPROVE as one chore commit: header comments list the values each file reads and the contexts that load it; two assertion titles and one sandbox comment follow the writing style; the vocabulary row describes the block by role and states why it exists.
  - Follow-up filed: #363, the configuration file header lists the service worker among the contexts that load it.
  - FYI: the parity test pins the pre-move values in a second object whose job is to report drift, so a deliberate tuning change is a two-file edit.
  - FYI: the assertion that the block exposes exactly ten keys grows by one with each later sprint that adds a key (data-test-budget, grid-nesting-rule, pending-retest). Their developer briefs must say so.
  - FYI: two untouched test comments still cite the retired child-count name in prose.

### Blocked
- none

### Deferred
- none

### Waiting (after-merge)
- **data-test-budget** — waits on **detection-constants**, PR #362 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/grid-detection-recovery-v2.json`
- **grid-nesting-rule** — waits on **detection-constants**, PR #362 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/grid-detection-recovery-v2.json`
- **capture-detection-values** — waits on **detection-constants**, PR #362 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/grid-detection-recovery-v2.json`
- **pending-retest** — waits on **grid-nesting-rule**, not started
- **right-click-registers** — waits on **grid-nesting-rule**, not started
- **shape-fingerprint** — waits on **grid-nesting-rule**, not started

### Notes
- The plan's baseline of 2,346 extension assertions predates #356, which pruned drifted tests; `main` held 2342 at the start of this run.
- Both wave-1 branches appended tests to the end of the extension suite. The second branch merged `main` in before its pull request opened, with no conflict. Expect the same step for each later wave with more than one sprint.
