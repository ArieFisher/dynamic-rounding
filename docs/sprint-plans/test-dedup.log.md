# Sprint Stack Run Log: Trim the extension tests without weakening them

Plan: docs/sprint-plans/test-dedup.md
JSON: docs/sprint-plans/test-dedup.json
Base branch: main

## Run 1 — 2026-11-27 16:37 to 20:00 (EST)

The product manager asked mid-run to stack the dependent sprints on unmerged branches in place of the plan's `after-merge` policy, so the run did not stop at a merge. Each pull request opens against `main` and states its merge order.

Models: developer and test-writer on Opus for `planted-bug-script`, `refactor-skill-test-gate`, and `planted-bugs-in-patterns`, Sonnet for `case-table-rule`; every review on Fable.

### Completed
- **case-table-rule** — `docs/case-table-rule` → PR #835, merged.
  - Reviewer: APPROVE (after 0 retries). No test-writer round: prose only.
  - The product manager chose one case table per behavior after review found the rule's boundary ambiguous.
- **planted-bug-script** — `chore/planted-bug-script` → PR #836.
  - Reviewer: APPROVE (after 2 retries). Retry 1 fixed a flaky failure read as a crash and suite runs left going after an interrupt. Retry 2 fixed the same cleanup on a malformed record.
  - The product manager chose a full rerun in the proof after review showed the narrow rerun set could pass a branch that loses a catch. The plan's Decisions Log records it.
  - Tests: pass. Self-test 22 passed; extension suite 4,621 with and without a record path.
- **refactor-skill-test-gate** — `chore/refactor-skill-test-gate` → PR #837, stacked on #836.
  - Reviewer: APPROVE (after 2 retries): the measurement started on passes with no test piece, an exit of the proof had no stated outcome, and a pass over product files ran the proof.
  - No test-writer round: skill text only.
  - Closed unmerged after the run: the product manager chose to keep the trimming out of the refactor skill (Decisions Log, on #839).
- **first-measurement** (spike) — findings in docs/sprint-logs/test-dedup-first-measurement.md, on this branch. Result: Amend, written at the product manager's direction.
- **planted-bugs-in-patterns** (added in the run, after the first measurement, with the product manager's approval) — `chore/planted-bugs-in-patterns` → PR #839, stacked on #836.
  - Reviewer: APPROVE (after 0 retries). Second measurement recorded in the spike findings.

### Waiting
- **tests-that-catch-nothing** — waits on the spike's **Result:** line. The sprint assumed 10 to 30 assertions; the second measurement lists 902 outside the code-text checks, and the findings show the list does not mean those assertions pass whatever the code does.
  - To continue: write the Result line, revise the plan if it says Amend, then re-run `/sprint-stack docs/sprint-plans/test-dedup.json`.
