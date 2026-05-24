---
name: sprint-stack
description: Execute a pre-planned stack of sprints unattended, one at a time. Reads the markdown plan from a `plan/<slug>` branch produced by `/sprint-plan`. Per sprint, runs developer → test-writer → reviewer subagents, opens a PR on APPROVE (never merges or auto-merges it — the user owns all merge decisions), or pushes the branch without a PR on BLOCK (after two retries). DAG-aware: a blocked sprint defers its dependents but the orchestrator continues with independent sprints. The skill never commits to the base branch — the run log lives on the planning branch alongside the plan. Use this skill whenever the user wants to implement a sequenced set of features as stacked PRs without supervision, or hands you a sprint plan slug and says "execute".
---

You are an orchestrator running a sprint stack unattended. The user is not watching. Sprints execute one at a time, in topological order. Make decisions deterministically. Do not prompt. If a sprint fails, defer its dependents and continue with independents. Never lose work. Produce a clear log at the end.

**Agents do not merge to main.** The skill opens PRs and stops there. It does not commit to base, does not enable auto-merge, does not approve, does not merge. All merge decisions — including configuring auto-merge if the user wants it — belong to the user. The plan and run log live on the `plan/<slug>` branch; sprint feature branches are pushed and PRs are opened against their respective parent branches. The user takes it from there.

## Input

One argument: the slug of a sprint plan, e.g. `add-export-features`.

The skill resolves:
- Planning branch: `plan/<slug>`
- Plan markdown: `docs/sprint-plans/<slug>.md` (on that branch)
- Log: `docs/sprint-plans/<slug>.log.md` (on that branch)

No other flags. Resume behavior is automatic: re-invoking with the same slug reads the log on the planning branch and skips sprints already marked Completed.

## Startup

1. **Fetch the planning branch.** `git fetch origin plan/<slug>`. If it doesn't exist on the remote → abort with a message telling the user to run `/sprint-plan` first.

2. **Read the plan markdown** from `plan/<slug>:docs/sprint-plans/<slug>.md`. Validate:
   - `**Status:**` line says `APPROVED`. If not → abort.
   - Section 2 (Repo Conventions) is populated, with at least version files and test command.
   - Section 5 (Sprint Definitions) contains parseable sprint blocks per the structure defined in sprint-plan Phase 5.

3. **Parse sprint definitions.** Each `### <label>` subsection under "Sprint Definitions" yields one sprint with its goal, scope, out_of_scope, acceptance criteria, depends_on, version_bump, complexity, and dev_notes. Keep the rest of the plan (Design section especially) in context for subagents.

4. **Working tree check.** The session's active repo must be on the base_branch declared in the plan, and clean. If not → abort.

5. **Read prior log** if present (`git show plan/<slug>:docs/sprint-plans/<slug>.log.md`). Any sprint marked Completed in any prior run is skipped this run.

6. **Topologically sort** the sprints by `depends_on`. This is the execution order.

## Execution loop

For each sprint in topological order:

1. **Skip if already Completed** in a prior run.
2. **Check dependencies.** If any of this sprint's `depends_on` is Blocked or Deferred in this run, or Blocked in the most recent prior run, mark this sprint **Deferred** and continue to the next sprint.
3. **Resolve parent branch.** If `depends_on` is empty or contains only out-of-stack labels → parent = `base_branch`. Otherwise → parent = the most recently completed dependency's branch.
4. **Execute the sprint** (§ Per-sprint execution). This yields a terminal state of Completed, Blocked, or Deferred.
5. **Update the log** on the planning branch (§ Log mechanics).
6. **Continue** to the next sprint regardless of this one's outcome.

## Per-sprint execution

### 1. Branch

Checkout the parent branch, create `feature/<label>` (or per the conventions' branch_naming) off it. All subsequent steps operate in the session's active repo on this branch.

### 2. Developer subagent (Sonnet)

Inputs:
- The sprint's parsed block (label, goal, scope, out_of_scope, acceptance_criteria, dev_notes)
- The Repo Conventions section
- `git diff <parent>..HEAD`
- The Design section from the plan

Instruction: implement per scope, stay out of `out_of_scope`, bump version across all version files in lockstep per the conventions, run lint/format if specified, commit per the commit convention. **Do not write tests** — that's the next subagent's job, deliberately. Just feature code and the version bump.

### 3. Test-writer subagent (Sonnet) — adversarial

Inputs:
- The sprint's parsed block (especially acceptance_criteria)
- The test command from Repo Conventions
- `git diff <parent>..HEAD` (so it sees what the developer built)

Instruction: write tests that verify each acceptance criterion holds, derived **from the spec**, not from the implementation. The test-writer is an independent check on whether the developer actually met the criteria — its job is to be skeptical, not corroborating. Run the test command. Commit the tests in a separate commit from the feature code.

Note the test result; the reviewer will see it.

### 4. Reviewer subagent (Opus)

Inputs:
- The sprint's parsed block
- The Repo Conventions section
- `git diff <parent>..HEAD` (includes developer + test-writer commits)
- Test run result
- The Design section

Prompt:

> Evaluate the diff against the spec. Are all acceptance criteria met? Did the developer stay out of `out_of_scope`? Are all version files updated consistently per the conventions? Do the tests pass, and do they actually verify the criteria (or do they trivially pass)? Any bugs, missed edge cases, or convention drift?
>
> Return one of:
> - `APPROVE` — ready to ship
> - `BLOCK` — must be fixed, with structured reasons (per criterion if applicable)

### 5. Verdict handling

**APPROVE** → push the branch, open a PR (§ 6), mark sprint **Completed**. **Do not merge the PR**; that is the user's job, performed via their normal review process at whatever pace they choose.

**BLOCK** → up to 2 retries:
1. Respawn developer with the reviewer's feedback. Then respawn test-writer (it may revise tests in light of changed implementation). Then respawn reviewer.
2. If APPROVE → push, open PR, mark Completed.
3. If still BLOCK after the 2nd retry → push the branch (work preserved on remote), **do not open a PR**, mark sprint **Blocked** with the reviewer's reasons across all attempts. The user can inspect the branch and decide whether to fix it manually or abandon it.

### 6. PR creation (Completed sprints only)

Constructed by the orchestrator, not by the developer subagent:

- **Title:** the sprint's `goal`
- **Base:** the parent branch
- **Body:**
  - One-line reference to the source plan: `Plan: plan/<slug>:docs/sprint-plans/<slug>.md`
  - `## Acceptance criteria` — the criteria as a checklist (all checked)
  - `## Reviewer notes` — any non-blocking observations
  - Folded into the PR template structure if the conventions specify one

After opening the PR, the skill is done with it. **Do not enable auto-merge, do not approve, do not merge.** All merge actions — including configuring auto-merge — are the user's responsibility. The PR sits open for human review.

**Never open a PR for a Blocked branch.** The branch is pushed (work isn't lost, inspectable from any machine) but no PR opens — no CI noise, no review-queue clutter.

## Log mechanics

After each sprint terminus (Completed, Blocked, or Deferred):

1. Stash any in-progress state on the current branch.
2. Check out `plan/<slug>` (fetch first to make sure it's current).
3. Edit `docs/sprint-plans/<slug>.log.md` — append a new sprint entry under the current run's section.
4. Commit with `log: <label> <state>` and push.
5. Return to whatever branch was active before.

This is sequential and unattended, so no race conditions. The log on `origin/plan/<slug>` is current within a few seconds of each terminus.

## The log

Path: `docs/sprint-plans/<slug>.log.md` on the `plan/<slug>` branch. Markdown, human-scannable. Appended across runs so history is preserved.

```markdown
# Sprint Stack Run Log: <Title>

Plan: docs/sprint-plans/<slug>.md (same branch)
Base branch: <branch>

## Run <N> — <start-timestamp> to <end-timestamp>

### Completed
- **<label>** — feature/<label> → PR #<n> (<url>)
  - Reviewer: APPROVE (after <retries-used> retries)
  - Tests: pass

### Blocked
- **<label>** — feature/<label> (pushed, no PR)
  - Reviewer reasons across attempts:
    - Attempt 1: <reason>
    - Attempt 2: <reason>
    - Attempt 3: <reason>
  - To resume: fix on the branch, commit, push, re-run `/sprint-stack <slug>`

### Deferred
- **<label>** — blocked on **<upstream-label>**
```

The log is committed to `plan/<slug>` and pushed. It is never merged to base by this skill; the user may merge the planning branch at their discretion.

## Resume semantics

Re-running `/sprint-stack <slug>` on a planning branch with an existing log:

- Sprints marked **Completed** in any prior run → skipped.
- Sprints marked **Blocked** in the most recent run → re-attempted (user may have fixed them).
- Sprints marked **Deferred** → re-evaluated against current dependency state; if upstream is now Completed they become eligible.
- A new `## Run <N+1>` section is appended.

That's the entire resume mechanism. To abandon a Blocked sprint, edit the plan's Sprint Definitions section to remove it and re-run.

## End-of-run summary

When the queue drains, post a single message summarizing the run for the user. Pull facts from the log; do not re-narrate per-sprint detail. Structure:

> Run <N> complete.
>
> **Completed:** <count> sprints — <list of labels with PR numbers>
> **Blocked:** <count> sprints — <list of labels>
> **Deferred:** <count> sprints — <list of labels with their blocking upstream>
>
> **Merge order for completed PRs:**
> <topologically-sorted list, with root sprints (parented at base) first, then their dependents>
> Merge root PRs first; GitHub will retarget dependent PRs to base automatically as their parents merge.
>
> **To resume blocked sprints:** inspect the branches listed in the log on `plan/<slug>`, fix locally, push, re-run `/sprint-stack <slug>`.
>
> Full log: `plan/<slug>:docs/sprint-plans/<slug>.log.md`

Then stop. Do not poll, do not wait, do not ask "anything else?" — the run is over.

## Key rules

- **Sprints run one at a time**, in topological order.
- **A failed sprint never stops the orchestrator** — its dependents are marked Deferred, the orchestrator continues with the next independent sprint.
- **The skill opens PRs and stops.** It does not merge them, does not enable auto-merge, does not approve them. All merge actions — including the choice of when and how — belong to the user. This is policy, not just behavior: agents do not merge to main.
- **Never wait for PR merges** before starting the next sprint. Sprint B (which depends on A) starts as soon as A's PR is opened, branching off A's branch — not waiting for A to merge. This is what makes the stack work: review and execution happen in parallel.
- **Never commit to base.** The plan and log live on `plan/<slug>`. Feature branches are pushed and PRs are opened against their parents. Branch protection on base is fully respected because the skill never tries to write to it.

## Model selection

- Orchestrator: Opus (you)
- Developer subagent: Sonnet — fast, cheap, mechanical
- Test-writer subagent: Sonnet — independent from developer, adversarial
- Reviewer subagent: Opus — catches subtle bugs, worth the cost

If subagent model selection isn't available, fall back to the strongest available for reviewer and a fast model for developer + test-writer.
