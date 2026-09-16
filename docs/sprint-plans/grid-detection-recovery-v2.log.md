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

## Run 2 — 2026-09-16 09:36 EDT to 2026-09-16 10:40 EDT

Wave 2: the three sprints under detection-constants, which merged as #362 after run 1. Developers on Sonnet for the two S sprints and on Opus for the M sprint; each test-writer on its developer's model; reviewers on Fable. `main` held 2409 / 256 / 67 at the start.

### Completed
- **data-test-budget** — fix/data-test-budget → PR #366 (https://github.com/ArieFisher/dynamic-rounding/pull/366), merged during the run
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (2421 / 256 / 67; the branch adds 12 assertions)
  - Review fixes applied after APPROVE as one chore commit: the retired-name source guard fails closed when the detection layer's source is missing; three comments and one design-doc sentence follow the writing style.
  - Follow-up filed: #367, the header comment above the oldest data-test test block states the retired rule.
  - FYI: the reviewer's mutation runs on a scratch copy confirm each new assertion discriminates: restoring the per-row caps fails three, skipping empty cells fails two, an off-by-one boundary fails one each way.
  - FYI: a budget of 0 fails every table, because the check runs before the first read; the suite pins the value at 1000.
- **capture-detection-values** — feature/capture-detection-values → PR #368 (https://github.com/ArieFisher/dynamic-rounding/pull/368), merged during the run
  - Reviewer: APPROVE (after 0 retries)
  - Tests: pass (2436 / 256 / 67; the branch adds 27 assertions)
  - Review fixes applied after APPROVE as one chore commit: the hostile-value test attacks the scalar and list paths beside the profile paths; four comments state the current shape in place of commit-relative prose; the renderer's header lists the registry and tuning sections.
  - Follow-up filed: #369, the tuning section renderer prints the three value shapes the block holds today and misprints or throws on other plain-value shapes.
  - FYI: the wire composer spreads the serializer's whole state into the state pull's answer, so the tuning field reaches the sidebar with no field pick.
  - FYI: an empty list inside a profile renders as the dash, the same as an absent value; the JSON block holds the exact empty list.
- **grid-nesting-rule** — fix/grid-nesting-rule → PR #372 (https://github.com/ArieFisher/dynamic-rounding/pull/372)
  - Reviewer: APPROVE (after 1 retry). The block: the rule that a plain wrapper between two role-bearing elements adds no nesting depth had no test, and a mutant counting every ancestor passed the suite. The test-writer added a fixture flag and six assertions; the mutant now fails exactly one.
  - Tests: pass (2531 / 256 / 67 after merging `main` with #366 and #368 in; the branch adds 83 assertions)
  - Review fixes applied after APPROVE as one chore commit: a Set replaces the chain-root array and its membership scan; the vocabulary's depth sentence counts up to and including the chain root; five comments and two assertion titles follow the writing style.
  - Follow-ups filed: #373 (product decision: a nest whose chain root fails the data test and whose configured depth holds two data tables registers nothing, and the step's empty result carries three meanings), #374 (the step exposes no chain root for a nest that registered nothing; pending-retest needs one), #375 (three comments still describe the retired ARIA pass), #376 (the native-table guard re-runs per ancestor walk), #377 (a grid element deeper than the walk cap splits its nest).
  - FYI: the step skips a whole nest when any element of it is registered; the retired scan skipped only the registered element and registered every other role-bearing data table beside it. §3.3 specifies the new behavior.
  - FYI: right-click resolves through the geometry probe until right-click-registers lands; on the two-column pinned pane shape it registers the pinned pane beside the wrapper.
  - FYI: the merge of `main` into the branch conflicted in three hunks, resolved by hand: the tuning block's exact-key pin and its two titles (twelve keys now), the design doc's Detection paragraph, and the vocabulary's table rows.

### Blocked
- none

### Deferred
- none

### Waiting (after-merge)
- **pending-retest** — waits on **grid-nesting-rule**, PR #372 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/grid-detection-recovery-v2.json`
- **right-click-registers** — waits on **grid-nesting-rule**, PR #372 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/grid-detection-recovery-v2.json`
- **shape-fingerprint** — waits on **grid-nesting-rule**, PR #372 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/grid-detection-recovery-v2.json`

### Notes
- data-test-budget and grid-nesting-rule each added one key to the tuning block and each extended the suite's exact-key pin on it. The second to reach a pull request took a merge of `main` and a hand resolution of that pin. pending-retest adds a thirteenth key, pendingRetestCap, and extends the same pin.
- Each test-writer placed its assertions beside the feature's existing tests, not at the end of the suite, so the three branches' additions stayed apart; the one suite conflict was the shared pin.
- The pending-retest brief must carry #373 and #374: the step returns nothing for three outcomes it does not distinguish, and it exposes no chain root for a nest that registered nothing. The sprint's design of the pending record depends on both.
- Wave 3 (pending-retest, right-click-registers, shape-fingerprint) all edit the controller; the plan says to merge them in that order and to expect the second and third to need `main` merged in.
- Issue #270, the two-pillbox report, closed on 2026-09-15 before this run; grid-nesting-rule closes #219.
