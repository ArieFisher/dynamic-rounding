# Sprint Stack Run Log: Decoupling migration

Plan: docs/sprint-plans/decoupling-migration.md
JSON: docs/sprint-plans/decoupling-migration.json
Base branch: main

## Run 1 — 2026-08-25 09:50 EDT to 2026-08-26 02:45 EDT

### Plan adjustment (2026-08-25 15:50 EDT): merge train
Both CI workflows trigger only on pull requests based on `main`, so stacked PRs never ran the required checks, and retargeting after a parent merge fires no workflow event — the checks sat at "Expected". Procedure now: merge the bottom PR with branch deletion (GitHub retargets the child to `main`), then merge `main` into the child branch and push, which fires the checks and clears the out-of-date banner; repeat up the stack. The one real conflict (the Sheets/Python line and the extension line both append test sections) gets resolved inside the update-branch step of whichever line merges second.

### Completed
- **test-harness-manifest** — chore/test-harness-manifest → PR #213 (https://github.com/ArieFisher/dynamic-rounding/pull/213)
  - Reviewer: APPROVE (after 2 retries)
  - Tests: pass (1,441 assertions; rename check green for all seven content-script files)
  - Retry causes: attempt 1 — per-file map lookups by literal key crashed the run on a content-script rename; attempt 2 — two `readFileSync` sites bypassed the map via a `path.join` variable and a literal-array loop, and the self-test regex missed both indirections.
  - Post-approval bucket-1 cleanup: dropped three unused bootstrap source variables.
- **extract-dr-number** — refactor/extract-dr-number → PR #216 (https://github.com/ArieFisher/dynamic-rounding/pull/216), stacked on #213
  - Reviewer: APPROVE (0 retries)
  - Tests: pass (extension 1,451; js 158; python 116); discipline tests mutation-verified
  - Follow-up issues: #214 (bundle test misses arrow consts, forces all functions public), #215 (leak-detector list can drift from manifest)
- **delete-dead-code** — chore/delete-dead-code → PR #218 (https://github.com/ArieFisher/dynamic-rounding/pull/218), stacked on #216
  - Reviewer: APPROVE (0 retries)
  - Tests: pass (extension 1,456; js 158; python 116); deletion locks mutation-verified
  - Deviation from plan: DEFAULT_OFFSET_TOP, DEFAULT_NUM_TOP, VALIDATION_LIMIT kept — verification found live readers; the plan's deletion was conditional on none existing
  - Post-approval bucket-1: corrected three stale load-path comments
  - Follow-up issue: #217 (kept defaults duplicate defaults.js values)
- **extract-dr-table** — refactor/extract-dr-table → PR #222 (https://github.com/ArieFisher/dynamic-rounding/pull/222), stacked on #216
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 1,514; js 158; python 116); double-invocation and no-globals criteria mutation-verified
  - Retry cause: the numeric-probe default delegated to DR_NUMBER.toNumber and flipped detection on date-only, time, unit-suffix, and accounting-negative tables; fixed to the old parseFloat predicate verbatim with six regression assertions
  - Follow-up issues: #219 (findTables unwired), #220 (NodeFilter bare global), #221 (detection vs rounding parse divergence)
- **unify-rounding-core** — fix/unify-rounding-core → PR #226 (https://github.com/ArieFisher/dynamic-rounding/pull/226), stacked on #218
  - Reviewer: APPROVE (after 2 retries)
  - Tests: pass (extension 1,554; js 256; python 214); 98 shared cases, all re-derived independently from extension code
  - Retry causes: retry 1 — Python parsed fullwidth digits JS rejects, and the Python comparator masked the float-noise fix; retry 2 — the first Python noise-strip rounded ties half-to-even where JS rounds away from zero, and the changelog missed two changed input kinds
  - User-visible: Sheets and Python outputs change on the changelog-documented kinds (percent, unicode dashes, float noise, symbol-only strings, >12-significant-digit truncation)
  - Follow-up issues: #223 (Python lacks the non-integer-step re-round, pre-existing), #224 (inf/nan strings crash the pandas path, pre-existing), #225 (shared-case runner hardcodes defaults)
- **merge-ladder** — refactor/merge-ladder → PR #234 (https://github.com/ArieFisher/dynamic-rounding/pull/234)
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 1,687 after merging main; js 256; python 214); engine byte-identical on 16 multi-rule fixtures vs parent
  - Retry cause: preview masks were measured on live post-round text but applied to the stored original; fixed by stashing superscript ranges and surviving link-match indices at round time and replaying them
  - User-visible: the preview band now enforces the same 11 rules as the engine (it previously ignored ranges, first row/column, percent/currency gating, quotes, links, superscripts, and the mixed-cells toggle); each divergence pinned by a test
  - Merge-train notes: PRs #218 and #222 were auto-closed when their base branch was deleted and were recreated as #229 and #230; the extension version moved once for the batch (2.1.42 → 2.1.43, #227) and the duplicate bump PRs #228/#231/#233 were closed; #232 carried the python bump (0.2.1 → 0.2.2)
- **engine-returns-results** — refactor/engine-returns-results → PR #238 (https://github.com/ArieFisher/dynamic-rounding/pull/238)
  - Reviewer: APPROVE (0 retries)
  - Tests: pass (extension 1,706; js 256; python 214); message sequences execution-diffed byte-identical against the parent
  - Follow-up issues: #236 (applied field has no reader), #237 (widen the static lock, pin the other two call sites)
- **app-model-selection** — refactor/app-model-selection → PR #242 (https://github.com/ArieFisher/dynamic-rounding/pull/242)
  - Reviewer: APPROVE after 1 fix round (the parent-equivalence pin shelled out to git show for the parent ref, which fails in shallow CI checkouts and permanently after branch deletion; sequences frozen as literals, verified in a single-branch depth-1 clone)
  - Tests: pass (extension 1,737; js 256; python 214)
  - Agent stalls: the developer stalled twice and the first test-writer three times (backgrounded commands); a fresh test-writer with commit-as-you-go instructions completed, and the orchestrator committed its staged final work
  - Follow-up issues: #240 (bus reentrancy guard due with the first state-change subscriber), #241 (stale background.js comment)
- **toggle-split** — refactor/toggle-split → PR #247 (https://github.com/ArieFisher/dynamic-rounding/pull/247)
  - Reviewer: APPROVE (0 retries)
  - Tests: pass (extension 1,753; js 256; python 214); eight-cell guard-matrix pin byte-identical to parent, independently re-run by the reviewer against the parent tree
  - Bug fixed with a test: the range flash threw a TypeError on div-based grids; it now enumerates cells through the table adapter, geometry on native tables verified unchanged
  - Post-approval bucket-1: corrected two comments that called the old failure a silent no-op (it threw)
  - Follow-up issues: #244 (widen the view-call scan), #245 (rounded flag still in the DOM), #246 (controller reaches into view registries)
- **app-model-settings** — refactor/app-model-settings → PR #252 (https://github.com/ArieFisher/dynamic-rounding/pull/252)
  - Reviewer: APPROVE (after 2 retries)
  - Tests: pass (extension 1,806 after merging main; js 256; python 214); settings flow pinned end to end through the real message path
  - Retry causes: retry 1 — the bus relay dropped the response callback, silently removing the sidebar's delivery-failure feedback; retry 2 — the pulled enabled value was clobbered on reopen by the bound-state default reset, leaving the checkbox ON over a raw table
  - Also landed: the bus reentrancy guard (#240 closed by this sprint)
  - Follow-up issues: #249 (no-active-tab feedback gone), #250 (pin subscriber-throw recovery), #251 (live-rebind still assumes default enabled, pre-existing)
- **app-model-registry** — refactor/app-model-registry → PR #258 (https://github.com/ArieFisher/dynamic-rounding/pull/258)
  - Reviewer: APPROVE (after 1 retry)
  - Tests: pass (extension 1,868; js 256; python 214); registry lifecycle pinned under DOM churn, grid recycling, and script re-injection
  - Retry cause: after a content-script re-injection, a reset or toggle stripped markers, destroyed the surviving title original, and stamped a false one; fixed so an unrestorable reset leaves cells untouched, reports its count, and keeps the truthful simplified flag
  - Deliberate behavior changes, pinned: the grid magnitude basis is now genuinely frozen at first sight (it previously recomputed per scroll); unrestorable resets degrade honestly
  - Closes #245 (rounded flag read from the model); the second raced bump batch collapsed to one bump (2.1.43 → 2.1.44 via #235, duplicates #239/#243/#248/#253 closed)
  - Follow-up issues: #254 (sidebar apply path ignores the unrestorable count, highest priority), #255 (widen the marker-read lock), #256 (vestigial dr-ext-grid writes), #257 (freeze vs peek round-trip)

### Run summary
All eleven sprints completed and merged (PRs #213, #216, #229, #226, #230, #234, #238, #242, #247, #252, #258). Reviewer verdicts: five APPROVE on the first pass, six after one or two block-and-fix rounds; every block was a real defect caught before merge. Twenty-two follow-up issues filed. The extension suite grew from 1,438 to 1,868 assertions; the shared rounding case table (98 cases) runs against all three implementations.
