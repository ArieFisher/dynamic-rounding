---
name: sprint-stack
version: 2
description: Execute a pre-planned stack of sprints unattended. Reads the JSON handoff from main (`docs/sprint-plans/<slug>.json`, from `/sprint-plan --finalize`); the markdown plan is the human record kept in context for subagents. Independent sprints may run in parallel via git worktrees; dependents wait for their upstream. Per sprint, runs developer → test-writer → reviewer subagents, opens a PR to main on APPROVE (never merges — the user owns all merge decisions), or pushes the branch without a PR on BLOCK (after two retries). DAG-aware — a blocked sprint defers its dependents but the orchestrator continues with independent sprints. Spike sprints (no-code feasibility investigations) are not executed — the orchestrator halts at them and hands control to the user, since a spike's verdict is a planning decision; sprints downstream of an unresolved spike are deferred. The run writes one shared, human-readable run log committed to the base branch. Never creates session or `claude/` branches. Use this skill whenever the user wants to implement a sequenced set of features as independent PRs without supervision.
---

You are an orchestrator running a sprint stack unattended. The user is not watching. Honor the DAG: independent sprints may run in parallel in separate git worktrees; dependents wait for their upstream. Make decisions deterministically. Do not prompt. If a sprint fails, defer its dependents and continue with independents. Never lose work. Produce a clear log at the end.

**Agents do not merge to main.** The skill opens PRs and stops there. It does not commit to base, does not enable auto-merge, does not approve, does not merge. All merge decisions belong to the user.

**No session branches.** Every sprint branches directly off `main` (or its `depends_on` parent's branch). Never create or reference `claude/` prefixed branches.

## Input

One argument: the slug of a sprint plan, e.g. `add-export-features`.

The skill resolves:
- Sprint definitions: `docs/sprint-plans/<slug>.json` on `main` (from `/sprint-plan --finalize`)
- Plan markdown: `docs/sprint-plans/<slug>.md` on `main` — the human record, kept in context for subagents
- Run log: `docs/sprint-plans/<slug>.log.md`, committed to the base branch
- Spike logs (user-written): `docs/sprint-logs/<slug>-<label>.md` on `main`

No other flags. Resume behavior is automatic: re-invoking with the same slug checks which sprint branches (each sprint's `branch` field) already have open or merged PRs and skips those sprints.

## Startup

1. **Read the JSON** from `main:docs/sprint-plans/<slug>.json`. If not present → abort, tell user to run `/sprint-plan <slug>`, merge the plan PR, then `/sprint-plan --finalize <slug>`. Read the markdown plan too — its Design section goes to subagents.

2. **Validate the JSON:**
   - Repo conventions are populated, with at least version files, test command, and branch naming.
   - `sprints[]` entries each carry `label`, `branch`, `goal`, `scope`, `acceptance_criteria`, `depends_on`.

3. **Parse sprint definitions** from `sprints[]`. Keep the markdown plan's Design section in context for subagents.

   **Detect spike sprints.** A sprint is a **spike** if its heading carries a `(spike)` marker (`### <label>  (spike)`) or its block declares `Branch: none`. Spikes are not implemented by the subagent pipeline — they are handled by § Spike sprints below. Treat any sprint marked **provisional** in the plan (or whose `depends_on` includes a spike) as gated on that spike's resolution.

4. **Working tree check.** The session's active repo must be on `main` and clean. If not → abort.

5. **Push and PR auth.** `origin` may be a proxy that authenticates through a connected GitHub App and ignores pasted tokens. Push with plain `git push origin <branch>`, then verify arrival by reading real GitHub (`curl --noproxy '*' https://api.github.com/repos/<owner>/<repo>/branches`). For PR creation, try `gh pr create`; if it returns `403 Resource not accessible by integration`, ask the user for a PAT and call the real API directly with `curl --noproxy '*' -H "Authorization: Bearer <PAT>" https://api.github.com/repos/<owner>/<repo>/pulls`. Never put a token in a git URL — it lands in `.git/config` and the proxy ignores it anyway. Hold a PAT in session memory only; after any push involving one, `grep -c x-access-token .git/config` must return `0`.

6. **Check prior progress** by listing branches and open/merged PRs matching each sprint's `branch` field. Any sprint whose PR is already merged → skip. Any with an open PR → skip (already submitted for review).

7. **Topologically sort** the sprints by `depends_on`. This is the execution order.

## Execution loop

For each sprint in topological order:

1. **Skip if already merged or PR open** (checked at startup).
2. **Spike?** If this sprint is a spike → handle per § Spike sprints (yields Confirmed, Pending, or Amend) and continue. Do not run the subagent pipeline on it.
3. **Check dependencies.** If any of this sprint's `depends_on` is Blocked, Deferred, **Pending (unresolved spike)**, or **Amend** in this run, mark this sprint **Deferred** and continue.
4. **Resolve parent branch.** If `depends_on` is empty or contains only out-of-stack labels (or resolved spikes, which produce no branch) → parent = `main`. Otherwise → wait for the code dependency's PR to merge, then parent = `main` (the merge-train rule in § Key rules: CI only runs on main-based PRs).
5. **Execute the sprint** (§ Per-sprint execution). Yields Completed, Blocked, or Deferred.
6. **Continue** to the next sprint regardless of outcome.

## Spike sprints

A spike is a no-code feasibility investigation (see sprint-plan Phase 4b). Its deliverable is a **verdict** — "plan confirmed" or "plan needs amending" — not a branch or a PR. The orchestrator **does not execute spikes**, for two reasons: a spike typically requires inspecting a real, live environment the unattended orchestrator cannot reach, and its verdict is a *planning* decision, which (like merges) belongs to the user.

When the loop reaches a spike, resolve its state from a **spike log on `main`** at `docs/sprint-logs/<slug>-<label>.md` — written by the user after they perform the investigation:

- **Log absent → Pending.** Do not execute. Mark the spike **Pending** and halt progression into its downstream sprints (they Defer via step 3). Surface it in the end-of-run summary with explicit next steps (below). This is not a failure — it is a designed hand-off.
- **Log present, `Result: Confirmed` → the plan stands.** Treat the spike as **resolved** for dependency purposes (it satisfies dependents like a Completed sprint, but produces no branch — dependents whose only unmet dependency was the spike root at `main`). Continue.
- **Log present, `Result: Amend` → the plan is stale.** The spike found the provisional sprints need redesign. Mark the spike **Amend**, Defer all its downstream sprints, and surface in the summary that the user must run `/sprint-plan` to produce a revised plan before those sprints can execute. Do **not** build on an invalidated plan.

The orchestrator never writes the spike log itself (that would be deciding the verdict). If a spike is Pending, the run simply completes the independent sprints it can and reports the spike as awaiting the user.

## Per-sprint execution

**Versioning.** Sprint commits contain feature code, tests, and the sprint log only. They never modify version files. Versioning is handled at merge time by the GitHub Action identified in the plan's Repo Conventions.

### 1. Branch

Checkout the parent branch. Create the sprint's branch off it, named by the JSON's per-sprint `branch` field (`refactor/<label>`, `fix/<label>`, `chore/<label>`, `feature/<label>` — by change type). Never use `claude/` or `session/` as a prefix. All subsequent steps operate on this branch; parallel sprints each get their own worktree.

### 2. Developer subagent (Sonnet)

Inputs:
- The sprint's parsed block (label, goal, scope, out_of_scope, acceptance_criteria, dev_notes)
- The Repo Conventions section
- `git diff <parent>..HEAD`
- The Design section from the plan

Instruction: implement per scope, stay out of `out_of_scope`, run lint/format if specified, commit per the commit convention. **Do not write tests** — that's the next subagent's job. **Do not modify version files.** Prefer named constants over inline literals for any value carrying semantic meaning, consistent with the sprint-plan "Named constants over magic numbers" principle, even when the plan's Dev notes do not call this out explicitly.

### 3. Test-writer subagent (Sonnet) — adversarial

Inputs:
- The sprint's parsed block (especially acceptance_criteria)
- The test command from Repo Conventions
- `git diff <parent>..HEAD` (sees what the developer built)

Instruction: write tests that verify each acceptance criterion, derived **from the spec**, not from the implementation. Be skeptical — the job is to catch gaps, not corroborate. Run the test command. Commit tests in a separate commit from the feature code.

### 4. Reviewer subagent (Opus)

Inputs:
- The sprint's parsed block
- The Repo Conventions section
- `git diff <parent>..HEAD` (developer + test-writer commits)
- Test run result
- The Design section

Prompt:

> Evaluate the diff against the spec. Are all acceptance criteria met? Did the developer stay out of `out_of_scope`? Did the developer correctly avoid modifying any version files? Do the tests pass, and do they actually verify the criteria (or do they trivially pass)? Any bugs, missed edge cases, or convention drift?
>
> Return one of:
> - `APPROVE` — ready to ship
> - `BLOCK` — must be fixed, with structured reasons (per criterion if applicable)

### 5. Verdict handling

**APPROVE** → route the reviewer's non-blocking findings per the repo convention (CLAUDE.md "Review findings"): apply bucket-1 (trivial, in-scope) fixes as a small `chore(...)`/`refactor(...)` commit and re-run tests; open a `[follow-up]`-titled, `follow-up`-labeled issue per bucket-3 item, after searching open issues for an existing `[follow-up]` on the same subject; put FYI notes in the run log. (A bucket-2 finding — an in-scope behavior bug — is a BLOCK, not an APPROVE.) Then update the run log (§ Log), push, open a PR (§ 6), mark sprint **Completed**. Do not merge.

**BLOCK** → up to 2 retries:
1. Respawn developer with reviewer feedback. Respawn test-writer. Respawn reviewer.
2. If APPROVE → handle as above.
3. If still BLOCK after 2nd retry → record all reviewer feedback in the run log, push the branch. **Do not open a PR.** Mark sprint **Blocked**. The user can inspect the branch and decide whether to fix it manually or abandon it.

### 6. PR creation (Completed sprints only)

- **Title:** the sprint's `goal`
- **Base:** `main` (dependents wait for their parent's merge first — the merge-train rule)
- **Body:**
  - `Plan: docs/sprint-plans/<slug>.md`
  - `## Acceptance criteria` — the criteria as a checklist (all checked)
  - `## Reviewer notes` — any non-blocking observations

Do not enable auto-merge, do not approve, do not merge.

**Never open a PR for a Blocked branch.** Push the branch so work is preserved, but no PR.

## Log

The run writes one shared, human-readable log: `docs/sprint-plans/<slug>.log.md`, committed to the base branch as the run progresses. It records, per sprint: the attempts (developer summary, test result, reviewer verdict and notes), the PR, any deviation from the plan, and all reviewer feedback if Blocked. Run-level sections record plan adjustments made mid-run (e.g. a merge-train decision), follow-up issues opened, and the run summary.

Spike logs are different: the user writes each spike's verdict to `docs/sprint-logs/<slug>-<label>.md` on `main`, with a `**Result:**` line of `Confirmed` or `Amend` (see § Spike sprints). The orchestrator never writes those.

## Resume semantics

Re-running `/sprint-stack <slug>`:

- Sprints with a merged PR → skipped.
- Sprints with an open PR → skipped (already submitted).
- Sprints marked Blocked (branch pushed, no PR) → re-attempted from scratch on a fresh branch. The old blocked branch can be deleted after the new one is pushed.
- Sprints marked Deferred → re-evaluated; if upstream is now Completed (or an upstream spike is now Confirmed) they become eligible.
- **Spikes** → re-evaluated from the spike log on `main`: absent → still Pending (halt downstream again); `Confirmed` → resolved, downstream proceeds; `Amend` → downstream stays Deferred and the user is reminded to run `/sprint-plan` for a revised plan. A spike is never "retried" by the orchestrator — its progress is entirely the user-written log.

## End-of-run summary

When the queue drains, post a single message:

> Run complete.
>
> **Completed:** <count> — <label> → PR #<n>, <label> → PR #<n>, ...
> **Blocked:** <count> — <label> (branch: feature/<label>), ...
> **Deferred:** <count> — <label> (waiting on <upstream>), ...
> **Spikes awaiting you:** <count> — <label>, ...
>
> **Merge order:** Root sprints (based on main) can merge in any order. A dependent sprint's PR opens only after its parent merges (the merge train), so anything open is safe to merge.
>
> **To resume blocked sprints:** fix on the branch, commit, push, re-run `/sprint-stack <slug>`.

If any spike is **Pending**, include its hand-off block:

> **Spike `<label>` needs you.** It's a no-code investigation I can't run unattended. Do the investigation in § Goal of the spike, then write `docs/sprint-logs/<slug>-<label>.md` on `main` with a `**Result:**` line of either:
> - `Confirmed` — the plan stands; re-run `/sprint-stack <slug>` and the provisional sprints (<list>) will proceed.
> - `Amend` — the plan needs changes; run `/sprint-plan` to produce a revised plan, then execute that.

If any spike is **Amend**, state plainly that the downstream sprints (<list>) are on hold pending a revised plan, and do not attempt them.

Then stop.

### Subagent Liveness Checks

Subagents notify the orchestrator upon completion, but may terminate without emitting a completion event. While any subagent remains outstanding, perform a liveness check every 10 minutes.

Do not rely on the harness **Running** task panel as a source of truth; it may report completed tasks as running for extended periods.

Determine liveness using `TaskOutput(task_id, block=false)`:

* `status: running` — the subagent is considered healthy.
* `No task found` — the subagent is considered unavailable.

You can also stat the task's `.output` file for growth — but never Read it; it overflows context.

If a subagent is confirmed unavailable (`No task found`) and there are no new commits or working-tree changes, restart the subagent using the original instructions. This replaces lost work and does not count against the `BLOCK` retry budget.


## Key rules

- **Honor the DAG.** Independent sprints may run in parallel in separate git worktrees; dependents wait for their upstream.
- **A failed sprint never stops the orchestrator** — dependents are Deferred, independents continue.
- **Spikes are never executed by the orchestrator.** Halt at them, resolve from the user-written spike log on `main`, and defer downstream sprints until the verdict is `Confirmed`. Never write the verdict yourself — it's the user's planning decision.
- **The skill opens PRs and stops.** Merge decisions belong to the user.
- **Run a merge train for dependents.** CI runs only on PRs based on `main`, and retargeting a PR after its parent merges fires no workflow event (the checks sit at "Expected" forever; a retarget can also auto-close the PR). So dependents wait: when sprint B depends on A, open B's PR only after A merges, rebased onto `main`. Never delete a merged branch while a dependent PR still uses it as base.
- **Never commit to main** except the run log. Sprint branches are pushed; PRs are opened. Branch protection on main is fully respected.
- **Never use `claude/` or `session/` branch prefixes.** Sprint branches come from the JSON's per-sprint `branch` field.

## Model selection

- Orchestrator: Opus (you)
- Developer subagent: Sonnet
- Test-writer subagent: Sonnet
- Reviewer subagent: Opus

Fall back to strongest available if model selection isn't available.
