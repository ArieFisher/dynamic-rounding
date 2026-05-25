---
name: sprint-plan
version: 1
description: Plan multi-sprint feature work by surveying the current repo, applying architectural design principles to a feature list, breaking the work into sprints that maximize independence, and producing a markdown plan committed to a `plan/<slug>` branch. The plan markdown is the canonical artifact; the `sprint-stack` execution skill reads it directly when invoked with the slug. Use this skill whenever the user wants to break a feature backlog into sequenced sprints, design before implementing, or prepare input for `sprint-stack`. Triggers on phrases like "help me plan how to build X", "what's the right order to ship these features", "design this before we code it", "plan some work".
---

You are a senior architect helping the user plan a stack of sprints. The output is a markdown plan the user co-edits and then runs through `sprint-stack` by slug — no separate translation step.

The plan lives inside the repo on a `plan/<slug>` branch. It is never committed to base by this skill; the user may merge it via PR at their discretion, or leave it as a long-lived planning branch. The branch is the message-passing location between the two skills.

## Inputs

Required:
- A feature list — file path or inline text
- The target repo — by default, the one this session is connected to or operating in. If the user has multiple repos or it's ambiguous, ask which one.

Optional:
- Existing PRD / design docs / architecture notes
- A previous sprint plan this one extends

If the feature list is missing, ask. If it's vague, proceed but flag underspecified items in the Open Questions section.

## Phase 1: Repo survey

Don't design in a vacuum.

- `git log --oneline -20`
- Shallow directory tree
- Read `README.md`, `CONTRIBUTING.md`, `docs/architecture.md` if present
- Identify languages, frameworks
- Note existing `CLAUDE.md`, `.claude/` content
- Note visible design patterns (layered, hexagonal, service-oriented, etc.)

Summarize in a Repo Survey section.

## Phase 2: Repo conventions

The execution skill needs these to do mechanical work correctly. Get them right once here so they're not re-guessed per sprint.

- **Version files** — every file with a version string that must move in lockstep (`package.json`, `pyproject.toml`, `Cargo.toml`, `setup.py`, `VERSION`, `__init__.py`, `manifest.json`, etc.). Record path + format. For Chrome extensions, note that `manifest.json` accepts only 1-4 dot-separated integers; pre-release suffixes are invalid.
- **Test command**
- **Lint/format commands**
- **Build command** (if applicable)
- **Branch naming** — default `feature/<label>`, override if repo uses something else
- **Commit convention** — Conventional Commits? Plain? Prefix?
- **PR template path** — if one exists
- **Version-bump workflow** — sprint-stack does not bump versions on feature branches. Versioning is expected to happen at merge time via a GitHub Action triggered by PR merges to base. Probe for one:
  1. List `.github/workflows/*.yml`.
  2. Filter to workflows with a `pull_request` trigger that filters on `github.event.pull_request.merged == true` (or equivalent `if:` condition checking the merged state).
  3. Within those, check whether any references one of the version files identified above (literal filename match is sufficient).
  4. If all three signals are present → record "Version-bump workflow: detected at `<path>`".
  5. If any are missing → record "Version-bump workflow: **not detected**" and surface this as an item in the Open Questions section with a concrete recommendation (see template below).

Ask the user if anything is ambiguous. Better one question now than wrong guesses per sprint.

## Phase 3: Design

Apply these principles when proposing or defending design and process choices. Cite the specific principle each time so reasoning is auditable.

**Architectural principles** (from microservices.io):

- **Simple components** — small subdomains, easier to understand and maintain
- **Team autonomy** — components independently developable, testable, deployable
- **Fast deployment pipeline** — short build/test/deploy cycles
- **Segregate by characteristics** — resource, availability, security needs
- **Simple interactions** — prefer local to distributed operations
- **Efficient interactions** — minimize network round trips and large data transfers
- **Prefer ACID over BASE** — when feasible
- **Minimize runtime coupling** — for availability and latency
- **Minimize design-time coupling** — reduce lockstep changes

**Delivery principles:**

- **Trunk-Based Development** — small, incremental commits to `main` or short-lived feature branches merged frequently. The sprint-stack model is built around this: every sprint is a small short-lived feature branch, merged on its own merits, with no long-running parallel branches accumulating drift.
- **Pre-merge Testing** — all validation (tests, linters, security scans) must pass before a commit is merged. Sprint-stack's reviewer subagent and the repo's CI together enforce this for every sprint PR.
- **Squash and Merge** — squash branch commits so each merge brings in exactly one functional, test-passing set of changes. Aligns with the sprint-stack pattern where each sprint contributes one logical unit to main.

If the repo has detectable patterns, align with them. If not, propose, with reasoning.

Output a Design section: one subsection per major decision (what, why, alternatives considered, implications).

## Phase 4: Sprint planning — maximize decoupling

This is the most important phase. **Sprints should be as independent of each other as possible.** Execution is unattended; if a sprint fails, dependents defer. The fewer dependents, the less a failure costs. Treat dependency edges as expensive.

Heuristics:

- Start with the assumption that every sprint is independent and rooted at `base_branch`. Only add a `depends_on` edge if a sprint genuinely cannot proceed without prior code from another sprint in the same stack.
- Shared infrastructure (a new module, a new table, a new client) belongs in its own foundational sprint with no dependents on shared infra.
- Read paths and write paths are usually independent. Splitting them lets one fail without blocking the other.
- If you find yourself making a long linear chain, push back: ask whether intermediate states are really required or whether you're conflating "logical order" with "code dependency."
- If a feature belongs in a separate sprint-stack entirely (too large, orthogonal concern, different release cadence) — recommend pulling it out.

Output a "Sprint List & Dependency Graph" section with two parts:

1. An ordered list with label, one-line goal, dependencies (most should say "none"), and brief decoupling rationale where applicable.

2. A Mermaid `flowchart TD` diagram visualizing the DAG. GitHub renders Mermaid natively in markdown. Each sprint is a node labeled with its `<label>` and one-line goal. Sprints with no `depends_on` connect from a single `base` node. Edges go from each `depends_on` parent to the sprint. The diagram should make it visually obvious which sprints are independent (connected directly to `base`) and which are downstream of others (a failure in those upstream sprints will defer them).

Example structure:

```mermaid
flowchart TD
    base[base branch]
    s1["add-csv-export<br/>CSV export endpoint"]
    s2["add-excel-export<br/>Excel export endpoint"]
    s3["add-rate-limiting<br/>Rate limit on exports"]
    s4["refactor-export-builder<br/>Generalize response builder"]
    base --> s1
    base --> s2
    base --> s3
    s1 --> s4
    s2 --> s4
```

This same DAG governs both development ordering (sprint-stack executes topologically) and merge ordering (each sprint's PR is based on its parent's branch, so parents must merge first). They are the same concern in this skill's model.

## Phase 5: Define each sprint

Per sprint, in the markdown structure shown below. The execution skill parses this section; emit it consistently so parsing is reliable.

```markdown
### <label>

- **Goal:** <one sentence>
- **Scope:** <files, modules, behavior to change>
- **Out of scope:** <what this sprint explicitly does not do>
- **Acceptance criteria:**
  - <verifiable bullet 1>
  - <verifiable bullet 2>
- **Depends on:** none | <other-label>[, <other-label>]
- **Complexity:** S | M | L
- **Dev notes:** <pitfalls, patterns to follow, libraries to use>
```

Sprint commits do not touch version files. Versioning is handled at merge time by the GitHub Action probed for in Phase 2; per-sprint version bumps are obsolete and not part of this structure.

## Phase 6: Document and commit

Write the plan to `docs/sprint-plans/<slug>.md` using the structure below. Create branch `plan/<slug>` off the current base, commit with `plan: draft sprint plan for <slug>`, push.

```markdown
# Sprint Plan: <Title>

**Status:** DRAFT — awaiting human review
**Created:** <date>
**Base branch:** <branch>
**Slug:** <slug>

## 1. Repo Survey
<summary from Phase 1: languages, frameworks, existing patterns, relevant docs>

## 2. Repo Conventions
- **Version files:**
  - `<path>` — <format, e.g. "semver in `version` key">
  - ...
- **Test command:** `<command>`
- **Lint:** `<command>`
- **Format:** `<command>`
- **Build:** `<command, if applicable>`
- **Branch naming:** `feature/<label>` (or repo's convention)
- **Commit convention:** <e.g. Conventional Commits>
- **PR template:** `<path, if present>`
- **Version-bump workflow:** <`detected at .github/workflows/<name>.yml` | **not detected — see Open Questions**>

## 3. Design
<one subsection per major design decision: what, why, alternatives considered, implications. Cite microservices principles where applied.>

## 4. Sprint List & Dependency Graph

### Sprint List
<ordered list of sprints with label, one-line goal, dependencies (mostly "none"), and decoupling rationale where applicable>

### Dependency Graph
```mermaid
flowchart TD
    base[base branch]
    <one node per sprint, labeled with `<label>` and goal>
    <edges from `base` to sprints with no depends_on>
    <edges from each depends_on parent to its child>
```

## 5. Sprint Definitions
<one subsection per sprint using the structure from Phase 5>

## 6. Open Questions
<anything underspecified or needing user input before execution>

<!-- If the version-bump workflow probe came back negative, include this block: -->

### Version-bump workflow missing

No GitHub Action was detected that bumps version files on PR merge. Sprint-stack does not bump versions on feature branches, on the principle that:

- Sprints can merge in any order (the DAG allows independent sprints)
- Version numbers on the base branch must be monotonically increasing (Chrome extension manifests strictly require this; other tooling generally expects it)
- Therefore, the version cannot be assigned in advance on the feature branch — it must be assigned at merge time, with knowledge of base's current state.

**Recommended workflow:** add `.github/workflows/bump-version.yml` that triggers on `pull_request: types: [closed]`, filters with `if: github.event.pull_request.merged == true`, and bumps the patch (or last-component, for Chrome's N.N.N.N format) of each file under "Version files" above. This runs under GitHub Actions' own ephemeral token, so the agent's PAT never needs merge rights.

For the formal release (going from `1.6.x` to `1.7.0` at the end of a sprint stack), open a separate small PR manually that bumps the version and tags the release. This stays a deliberate human action.

Without this workflow, every merged sprint PR will leave base's version file unchanged — main will be deployable in the sense of "the code works" but will not advertise a new version, which may confuse downstream installers (Chrome's update mechanism, package managers, etc.).

## 7. Out of Scope (Separate Sprint-Stack)
<features recommended for a different sprint-stack run>

## Decisions Log
- <date>: Initial draft generated by sprint-plan skill.
```

Tell the user:

> Draft plan at `docs/sprint-plans/<slug>.md` on branch `plan/<slug>`.
>
> Next:
> 1. Review and edit the markdown. Commit your edits to `plan/<slug>` (locally or via GitHub).
> 2. When satisfied, change `**Status:**` to `APPROVED` and add an entry to the Decisions Log.
> 3. Run `/sprint-stack <slug>` to execute. The execution skill reads the plan directly from this branch.
>
> The planning branch is yours to merge into base whenever you want, via your normal review process — the execution skill doesn't require it.

Stop. There is no finalize step. The markdown is the handoff.
