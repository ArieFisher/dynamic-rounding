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

## Run 3 — 2026-09-16 12:04 EDT to 2026-09-16 19:58 EDT

Wave 3: the three sprints under grid-nesting-rule, which merged as #372 after run 2. Developers and test-writers on Opus (two M sprints, one L); reviewers on Fable. `main` held 2531 / 256 / 67 at the start. The product manager paused the wave at 11:07 and released it at 11:58; a spend limit stopped the run from 12:18 to 14:31 and again from 16:57 to 19:31, with every developer's and test-writer's work committed and nothing lost.

### Completed
- **right-click-registers** — fix/right-click-registers → PR #384 (https://github.com/ArieFisher/dynamic-rounding/pull/384), merged during the run after `main` with #386 was merged into it
  - Reviewer: APPROVE (after 1 retry). The block: the rule that an empty nomination falls through to the geometry probe had no test, and a mutant returning null after an empty nomination passed the suite. The test-writer added a single-column nest that fails the data test and passes the probe; the mutant now fails its three outcome assertions.
  - Tests: pass (2621 / 256 / 67 at approval; 2755 / 256 / 67 after `main` with #386 merged in; the branch adds 90 assertions)
  - The merge of `main` conflicted in the README's detection point and the design doc's Detection paragraph, both of which pending-retest had also extended, and the auto-merge kept two copies of the identical chain-root walk and of its suite exposure; all four resolved by hand before the push.
  - Review fixes applied after APPROVE as one chore commit: the unreachable native-table filter on the step's results goes; two comments and one assertion title state what the code and the proof establish.
  - Follow-up filed: #385, a role-marked single-column grid fails the data test and still becomes the active table on right-click with no registry entry; identical on `main`.
  - FYI: the route admits a marked grid under the data test alone, where the geometry probe's five-row floor applied before; this follows from D1.
  - FYI: the sibling-pane case of #382 resolves nothing on the repository's own fixture, because the probe rejects the one-column gutter pane.
  - FYI: a first registration through right-click runs the data test twice on the selected element, once in the step and once in the pillbox build.
- **pending-retest** — fix/pending-retest → PR #386 (https://github.com/ArieFisher/dynamic-rounding/pull/386), merged during the run
  - Reviewer: APPROVE (after 1 retry). The block: the rule that a re-test finding the nest registered or its depth crowded ends the pending record had no test; two mutants that leave the record standing passed the suite. The test-writer added one case per outcome.
  - Tests: pass (2665 / 256 / 67; the branch adds 134 assertions)
  - Review fixes applied after APPROVE as one chore commit: the three living-doc sentences state the redraw delay that bounds the re-test rate; the design doc names all three ends of a pending table; the doc pin on the cap matches the cap sentence alone; two comments follow the writing style.
  - Follow-ups filed: #387 (the package export object omits the two nomination functions), #388 (a right-click registration leaves a pending table's watch standing until the page next changes; lands after #384 and #386 merge), #389 (the load-time scan's grid pass calls the controller from the pillbox view; judgement call).
  - FYI: the step now reports one result per nest with an outcome kind (#374's scope); the page-wide function both scanners called keeps its signature and composes it, so #219's "no production caller" holds again for that function in substance.
  - FYI: a crowded re-test ends the pending record for good, per #373; a nest that goes empty, then crowded, then back to one data table at depth 1 registers only through a right-click.
  - FYI: the tuning block's exact-key pin moved from twelve to thirteen keys with the new cap.
- **shape-fingerprint** — fix/shape-fingerprint → PR #392 (https://github.com/ArieFisher/dynamic-rounding/pull/392), open at the end of the run; it merges last and carries `main` through #391
  - Reviewer: APPROVE (after 0 retries). Three reviewers ran: the spend limit stopped the first at 16:57, the second stalled at the harness's ten-minute cap while reading the whole diff in one pass, and the third read the diff per file and the suite in blocks of three hundred lines and returned the verdict.
  - Tests: pass (2673 / 256 / 67 at approval; 2897 / 256 / 67 after `main` through #391 merged in; the branch adds 142 assertions)
  - The test-writer's first pass committed six failing assertions on purpose: three for the scroll on a groupless grid, which the header-row rule under Notes resolved, and three for the added-column lock, which the restore before the teardown resolved. The test-writer revised ten stale assertions after the two fixes.
  - The merge of `main` conflicted at two insertion points in the suite and in the design doc's Detection paragraph, and the auto-merge kept two copies of the identical chain-root walk and of its suite exposure; all resolved by hand before the push.
  - Review fixes applied after APPROVE as one chore commit: the reader's header comment and two type annotations state the header-row condition and the null case; four comments and one vocabulary sentence follow the writing style.
  - Follow-ups filed: #393 (no press-path test proves the fingerprint reads a simplified header cell through its original; a mutant dropping the originals port from the controller survives the suite), #394 (a grid registered through the geometry probe has no re-registration route on a mismatch; product fork between registering the table itself directly and accepting the right-click recovery), #395 (a nest empty at action time is discarded in place of becoming a pending table; the mismatch path calls the page-wide function that keeps only the selected outcome).
  - FYI: the comparison walks every drawn row and cell once per action, so an action at most doubles its own walk.
  - FYI: a fingerprint is one snapshot; a redraw caught with zero rows reads as a shape change and registers nothing, so the entry goes.
  - FYI: a native table whose page rewrites a header text on sort trips on the next action and continues from raw; the press path clears the range expression and the apply path keeps it (#328 reworks the expression).
  - FYI: the teardown leaves the grid style class and the pillbox map entry on the discarded element; both are inert.
  - FYI: the native originals port returns the parsed number string, not the whole cell text, so a mixed header cell inside a range compares different after simplification.

### Blocked
- none

### Deferred
- none

### Waiting (after-merge)
- none. The plan's eight sprints are all Completed or merged after this run.

### Notes
- Product decision during the run (shape-fingerprint): header texts count in the fingerprint only when the table has a real header row (a row outside the scrolling row groups on a grid; the head section or a first row of header cells on a native table); a table with neither is fingerprinted by its column count alone. D7 as written tripped on every scroll of a groupless virtualized grid and locked the table. The accepted cost: a same-width result swap on a table with no header row keeps the old entry.
- In-scope defect found by a test-writer (shape-fingerprint): a discard on a table in simplified form dropped the originals behind surviving cells and locked the table; the mismatch path now restores before the teardown.
- Merge order: #386 and #384 merged during the run, in that order, each after `main` was merged into it. #392 is the last of the wave and carries `main` through #391, so its checks run against the current base.
- Test-writers running in parallel overwrote one shared scratch path for mutant copies; later briefs named a branch-specific path. The mutant runs themselves were rebuilt and are sound.
- Two reviewer verdicts turned on an untested load-bearing rule each, found by mutation; both test-writers had reported every criterion covered. Mutation runs stay in every reviewer brief.
- A reviewer that reads a large diff in one pass stalls at the harness's ten-minute cap; the brief now asks for the diff per file and the suite in blocks of three hundred lines.
