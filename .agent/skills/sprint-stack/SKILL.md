---
name: sprint-stack
version: 2
description: Execute a pre-planned stack of sprints unattended, one at a time. Reads the markdown plan from main (produced by `/sprint-plan` and merged). Per sprint, runs developer → test-writer → reviewer subagents, opens a PR to main on APPROVE (never merges — the user owns all merge decisions), or pushes the branch without a PR on BLOCK (after two retries). DAG-aware: a blocked sprint defers its dependents but the orchestrator continues with independent sprints. Each sprint's log is committed to its feature branch and merged to main with the sprint PR. Never creates session or `claude/` branches. Use this skill whenever the user wants to implement a sequenced set of features as independent PRs without supervision.
---

You are an orchestrator running a sprint stack unattended. The user is not watching. Sprints execute one at a time, in topological order. Make decisions deterministically. Do not prompt. If a sprint fails, defer its dependents and continue with independents. Never lose work. Produce a clear log at the end.

**Agents do not merge to main.** The skill opens PRs and stops there. It does not commit to base, does not enable auto-merge, does not approve, does not merge. All merge decisions belong to the user.

**No session branches.** Every sprint branches directly off `main` (or its `depends_on` parent's branch). Never create or reference `claude/` prefixed branches.

## Input

One argument: the slug of a sprint plan, e.g. `add-export-features`.

The skill resolves:
- Plan markdown: `docs/sprint-plans/<slug>.md` on `main`
- Per-sprint log: `docs/sprint-logs/<slug>-<label>.md` on each sprint's feature branch

No other flags. Resume behavior is automatic: re-invoking with the same slug checks which `feature/<label>` branches already have open or merged PRs and skips those sprints.

## Startup

1. **Read the plan** from `main:docs/sprint-plans/<slug>.md`. If not present → abort, tell user to run `/sprint-plan <slug>` and merge the plan PR first.

2. **Validate the plan:**
   - Section 2 (Repo Conventions) is populated, with at least version files and test command.
   - Section 5 (Sprint Definitions) contains parseable sprint blocks.

3. **Parse sprint definitions.** Each `### <label>` subsection under "Sprint Definitions" yields one sprint with its goal, scope, out_of_scope, acceptance criteria, depends_on, complexity, and dev_notes. Keep the Design section in context for subagents.

4. **Working tree check.** The session's active repo must be on `main` and clean. If not → abort.

5. **Push-auth precheck.** Sprint-stack pushes many branches and opens many PRs; confirm write access up front so a mid-run failure doesn't strand work on local branches. Run:

   ```
   git push --dry-run origin HEAD:refs/heads/__sprint_stack_auth_check 2>&1
   ```

   If the output contains `403` or `denied` (e.g. `Permission to <repo> denied`, `Resource not accessible by integration`), ask the user for a fine-grained GitHub PAT with `contents: write` and `pull-requests: write` on this repo:

   > I can't push to this repo from the current session (got 403 from the remote). Paste a GitHub PAT with `contents: write` and `pull-requests: write` on `<owner>/<repo>` and I'll use it for every push and PR in this run. The token stays in this session only.

   When the user provides a token, hold it in session memory only — do **not** write it to `.git/config`, `~/.git-credentials`, or any committed file. For each push, use a one-shot authenticated URL:

   ```
   git push "https://x-access-token:<TOKEN>@github.com/<owner>/<repo>.git" <branch>
   ```

   For PR creation, pass it via `GH_TOKEN=<TOKEN> gh pr create ...` (or the equivalent for whatever GitHub client is in use). If the dry-run push succeeds, proceed normally — no token needed.

6. **Check prior progress** by listing branches and open/merged PRs matching `feature/<label>` for each sprint in this stack. Any sprint whose PR is already merged → skip. Any with an open PR → skip (already submitted for review).

7. **Topologically sort** the sprints by `depends_on`. This is the execution order.

## Execution loop

For each sprint in topological order:

1. **Skip if already merged or PR open** (checked at startup).
2. **Check dependencies.** If any of this sprint's `depends_on` is Blocked or Deferred in this run, mark this sprint **Deferred** and continue.
3. **Resolve parent branch.** If `depends_on` is empty or contains only out-of-stack labels → parent = `main`. Otherwise → parent = the most recently completed dependency's `feature/<label>` branch.
4. **Execute the sprint** (§ Per-sprint execution). Yields Completed, Blocked, or Deferred.
5. **Continue** to the next sprint regardless of outcome.

## Per-sprint execution

**Versioning.** Sprint commits contain feature code, tests, and the sprint log only. They never modify version files. Versioning is handled at merge time by the GitHub Action identified in the plan's Repo Conventions.

### 1. Branch

Checkout the parent branch. Create `feature/<label>` off it. Never use `claude/` or `session/` as a prefix. All subsequent steps operate on this branch.

### 2. Developer subagent (Sonnet)

Inputs:
- The sprint's parsed block (label, goal, scope, out_of_scope, acceptance_criteria, dev_notes)
- The Repo Conventions section
- `git diff <parent>..HEAD`
- The Design section from the plan

Instruction: implement per scope, stay out of `out_of_scope`, run lint/format if specified, commit per the commit convention. **Do not write tests** — that's the next subagent's job. **Do not modify version files.**

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

**APPROVE** → write the sprint log (§ Log), commit it to the feature branch, push, open a PR (§ 6), mark sprint **Completed**. Do not merge.

**BLOCK** → up to 2 retries:
1. Respawn developer with reviewer feedback. Respawn test-writer. Respawn reviewer.
2. If APPROVE → write log, commit, push, open PR, mark Completed.
3. If still BLOCK after 2nd retry → write log with all reviewer feedback, commit to the branch, push. **Do not open a PR.** Mark sprint **Blocked**. The user can inspect the branch and decide whether to fix it manually or abandon it.

### 6. PR creation (Completed sprints only)

- **Title:** the sprint's `goal`
- **Base:** the parent branch (`main` for independent sprints, `feature/<parent-label>` for dependents)
- **Body:**
  - `Plan: docs/sprint-plans/<slug>.md`
  - `## Acceptance criteria` — the criteria as a checklist (all checked)
  - `## Reviewer notes` — any non-blocking observations

Do not enable auto-merge, do not approve, do not merge.

**Never open a PR for a Blocked branch.** Push the branch so work is preserved, but no PR.

## Log

Each sprint writes its own log to `docs/sprint-logs/<slug>-<label>.md` on the feature branch. It merges to main with the sprint PR. No shared log file; no coordination between sprints needed.

```markdown
# Sprint Log: <label>

**Plan:** docs/sprint-plans/<slug>.md
**Sprint goal:** <goal>
**Date:** <timestamp>
**Result:** Completed | Blocked

## Attempts

### Attempt <N>
- **Developer:** <summary of what was implemented>
- **Tests:** pass | fail — <summary>
- **Reviewer verdict:** APPROVE | BLOCK
- **Reviewer notes:** <notes>

## PR
<url> (if Completed)

## Reviewer feedback (if Blocked)
<all feedback across attempts>
```

## Resume semantics

Re-running `/sprint-stack <slug>`:

- Sprints with a merged PR → skipped.
- Sprints with an open PR → skipped (already submitted).
- Sprints marked Blocked (branch pushed, no PR) → re-attempted from scratch on a fresh branch. The old blocked branch can be deleted after the new one is pushed.
- Sprints marked Deferred → re-evaluated; if upstream is now Completed they become eligible.

## End-of-run summary

When the queue drains, post a single message:

> Run complete.
>
> **Completed:** <count> — <label> → PR #<n>, <label> → PR #<n>, ...
> **Blocked:** <count> — <label> (branch: feature/<label>), ...
> **Deferred:** <count> — <label> (waiting on <upstream>), ...
>
> **Merge order:** Root sprints (based on main) can merge in any order. Dependent sprints re-target main automatically after their parent merges.
>
> **To resume blocked sprints:** fix on the branch, commit, push, re-run `/sprint-stack <slug>`.

Then stop.

## Key rules

- **Sprints run one at a time**, in topological order.
- **A failed sprint never stops the orchestrator** — dependents are Deferred, independents continue.
- **The skill opens PRs and stops.** Merge decisions belong to the user.
- **Never wait for PR merges.** Sprint B (depending on A) branches off A's feature branch immediately after A's PR opens — not after it merges.
- **Never commit to main.** Feature branches are pushed; PRs are opened. Branch protection on main is fully respected.
- **Never use `claude/` or `session/` branch prefixes.** Feature branches are `feature/<label>`.

## Model selection

- Orchestrator: Opus (you)
- Developer subagent: Sonnet
- Test-writer subagent: Sonnet
- Reviewer subagent: Opus

Fall back to strongest available if model selection isn't available.
