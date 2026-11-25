# Sprint Stack Run Log: Each value in a cell takes its own rule

Plan: docs/sprint-plans/stretch-rules.md
JSON: docs/sprint-plans/stretch-rules.json
Base branch: main

## Run 1 — 2026-11-25 12:14 to 2026-11-25 13:05 (wave 1)

Before the sprint, the line references and the "today" results for sprint 1 were checked against `main` at fc45886. All held.

### Completed
- **date-placement** — fix/date-placement → PR #790 (https://github.com/ArieFisher/dynamic-rounding/pull/790)
  - Developer and test-writer on Opus (complexity M); reviewer on Fable.
  - Reviewer: APPROVE (after 0 retries). Five small findings fixed in one `chore:` commit and one reworded commit message.
  - Tests: pass. Extension 4,586, Sheets 834, doc examples 78, plugin 58; build check clean.
  - FYI: a bare year with a footnote marker in its own tag now changes; a time whose AM or PM sits in its own tag no longer counts toward the data test.

### Waiting (after-merge only)
- **stretch-list** — waits on **date-placement**, PR #790 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/stretch-rules.json`
- **mixed-cell-stretches** — waits on **stretch-list**

## Run 2 — 2026-11-25 13:05 to 2026-11-25 13:55 (wave 2)

Before the sprint, sprint 2's line references and reader list were checked against `main` at 03008f9. Three line references had moved: `classifiedCellPatches` to `table.js:69`, `placeClassification` to `placement.js:76`, and `numericPreviewCells` to `content.js:599`. The data test also calls the ambiguous-date check directly, which the reader list left out. Three vocabulary rows ("classification ladder", "data test", "core") and `chrome-extension/README.md` also used "mode" and were outside the plan's docs list. The test-assertion counts differed from the plan's estimates. None needed a product decision. `main` gained #792 during the run and was merged into the branch.

### Completed
- **stretch-list** — refactor/stretch-list → PR #793 (https://github.com/ArieFisher/dynamic-rounding/pull/793)
  - Developer and test-writer on Opus (complexity L); reviewer on Fable.
  - Reviewer: APPROVE (after 0 retries). Four small findings fixed in one `refactor:` commit, which the same reviewer approved.
  - Tests: pass. Extension 4,611, Sheets 836, doc examples 78, plugin 58; build check clean. No expected output changed.
  - Two separate comparisons of `main`'s library against the branch's found 0 differences.
  - The ambiguous-date check stays one shared function, because the data test calls it too; the plan had folded it into the column post-pass.
  - `claude plugin test` was not run: Claude Code had hooks modules switched off in that process.

### Waiting (after-merge only)
- **mixed-cell-stretches** — waits on **stretch-list**, PR #793 open
  - To continue: merge the PR, then re-run `/sprint-stack docs/sprint-plans/stretch-rules.json`
