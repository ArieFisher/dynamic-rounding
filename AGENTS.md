# Repository conventions for agents

These conventions apply to every agent working in this repository, whatever tool or surface runs it.

**This file is the only copy.** Claude Code reads `CLAUDE.md`, which imports this file. Antigravity reads `.agent/rules/`, which points here. Read it in full before your first tool call, and never restate a rule from here in another file. See [Group like concepts into a single location](#group-like-concepts-into-a-single-location).

Rules group by the surface they govern. The groups follow the order of work on one change: communication, design, repository content, GitHub. A new rule goes in the group whose surface it governs.

## Communication

### My role

I am the product manager and do not write the code. Lead with the mechanism in plain words, name the trade-off, and give a recommendation. Keep file names, commands, and symbol names out of chat unless I ask for them. Full deliverables such as pull request bodies still name files and symbols wherever that helps the reader.

### Writing style

These rules govern all prose: **chat**, **documents**, and **GitHub** (pull request titles and bodies, issues, commit messages, logs).

- **Form:** plain declarative sentences in active voice. Not epigrammatic, not aphoristic.
- **Structure:** no antithesis. Present each point on its own, without a contrasting counterpart.
- **Imagery:** no personification. The test: a part's verb names an operation the part performs, never a stance it takes. Operations pass: holds, determines, skips, detects, flags, stands for, contains, parses, publishes. Verbs of intent, awareness, or choice fail: own, know, decide, refuse, notice, warn, name — examples, not the whole list; "rides", "waits", and "speaks" fail the same test. Boundary: "the script reads the file" passes because reading is the operation; "the check refuses" fails because refusal is a stance. Similes are fine.
- **Diction:** plain English, Saxon words, technical terms preserved. No contractions and no abbreviations, except i.e., e.g., etc., FYI, and TL;DR. Write "application", not "app".
- **Tone:** laconic. Cut qualifiers, hedging, and introductory fluff.
- **Voice:** high information density. Facts in active voice, no passive voice, no filler sentences.
- **Concision:** cut filler, hedging, qualifiers, and repetition. Keep mechanisms, scopes, and reasons: say what a rule does, what it covers, and why it exists, even when a shorter sentence could imply it. The test is one pass — a first-time reader never re-reads a sentence or asks what a term covers. When in doubt, spend the extra sentence.
- **Conclusions only:** report findings, not the process that produced them. No dead ends, no counts of discarded items, no self-audit narrative.

### Vocabulary

`docs/vocabulary.md` is the term canon: one term per concept, across every platform and every document.

- Read it in full when starting a branch. Use the vocabulary when writing any prose (e.g. code comments, test names, the commit message, issue and pull request text, etc.). Never vary word choice for style.
- **At every commit**, sweep the change's **new** prose and:
  - *retired synonyms*: Replace a retired synonym with its canonical term.
  - *new concepts*: Define new concepts in `docs/vocabulary.md` on the same branch, as its own `docs:` commit.
- Additionally, both the pre-commit hook and CI run `scripts/check-vocab.sh` which blocks a commit when a line **added** to a markdown file contains a retired synonym (historical records and vocabulary.md are exempt).

### Chat

- **TL;DR first.** Conclusion, then support.
- **Answer only what was asked.** A narrow question gets the answer and stops. No options, no offers, no extra framing.
- **Explain ideas, not instructions.** State the problem, the change, and why the change removes the problem. Do not merely strip out the jargon: a de-jargonized instruction is still an instruction.
- **Surface unconsidered consequences.** Before implementing, list every behavior change the edit causes beyond the one I named. Put each unnamed one to me first, and never ship it and mention it after.
- **No unrequested scope.** Build the rule I asked for, not the adjacent one. A related concern becomes a separate issue, never a quiet addition.

## Design

### Group like concepts into a single location

A list belongs in exactly one place. Two copies drift apart and nothing reports the drift: whoever edits one will not know the other exists, nothing fails, and enforcement falls behind the canon.

- Code that enforces something a document states reads that document. It holds no separate copy.
- Put the machine form beside the human form — a column, a fenced block, a front-matter key — and parse it.
- Never add a "keep in step with X" comment: it marks a duplicate that will drift. Remove the duplicate.
- Fail closed when the parse returns nothing. On a missing file, a renamed heading, or a reshaped row, the check must exit with an error, because "found nothing" and "nothing to enforce" look identical from outside.

Applies to allowlists, error codes, supported-version tables, feature flags, and these conventions.

### Versions

Always take the newest release of an action, tool, or runtime. Read its breaking-change notes to confirm the jump, not to justify avoiding it. Report anything left behind, including a runtime whose newest line is ahead of the newest long-term-support line.

## Repository content

### Adding files

This repository is public. Before staging a new file, answer this: does it serve someone using or building DynamicRounding? A report about a local toolchain, an agent scan, a session journal, or a scratch note is always no. One such file reached `main` once already.

- **Never** `git add .` **or** `git add -A`**.** Stage the paths you meant to change, by name.
- **Write scratch output to the session scratchpad**, not the repository. `docs/private/` is git-ignored if it has to live here.
- **Never pass** `-f` **to** `git add` to defeat `.gitignore`, and never `--no-verify` to skip the pre-commit gate. If a rule blocks a file that belongs, change the policy block in `scripts/check-files.sh` in the same change and say why in the pull request.
- New root-level files need a `.gitignore` negation, added deliberately. The root is an allowlist.

Run `scripts/check-files.sh --staged` before committing. It is the same check the hook and CI run.

### Docs track behavior

Living docs: `README.md`, `CONTRIBUTING.md`, `MAINTAINERS.md`, `chrome-extension/README.md`, `docs/design.md`, `docs/vocabulary.md`, `js/README.md`, `js/tests-googlesheets-tab.md`, `python/README.md`, the `.agent/` instruction files, and this file. Sprint plans and logs, research notes, and released `js/CHANGELOG.md` entries are historical records. Mark them, never rewrite them.

- A pull request that changes behavior updates every living doc its change invalidates, in the same branch. If none apply, write "No doc impact" in the body.
- Documented input and output examples are under test. `node js/doc-tests.js` runs every pair the docs state against the library, locally and in CI. Keep a new example in a shape the extractors parse, or extend `js/doc-tests.js` in the same pull request.

### Public repository, security disclosure

A pull request body, commit message, or issue that explains an exposure is itself a disclosure, and a worse one than the artifact, because it summarizes and points.

- Say what changed and why, in neutral terms. No counts, no inventory of the exposure, no severity, no commit identifier pointing at the artifact.
- For a weakness in this repository's own code, ship the fix with no explanation beyond the diff. Do not file a public issue diagnosing it.
- Editing later leaves revision history on GitHub and orphaned objects in git.

Never run a secret-listing or secret-reading command, including its `--help` form. When unsure whether a command touches secrets, exclude it and say why.

## GitHub

### Branching and staging

Never edit `main`. Make every change on a branch and merge it through a pull request.

Branch prefixes, each with a short kebab-case label: `feature/` new behavior, `fix/` bug fixes, `chore/` tooling, configuration, and dependencies, `refactor/` internal restructuring with no behavior change, `plan/` sprint plans from the sprint-plan skill, `docs/` documentation only. Never `claude/` or `session/`. If the harness created one, rename it before the first push.

Stash before switching branches with a dirty tree.

### Review findings

Route every review finding to exactly one place. Never leave an actionable item as a non-blocking note for me to remember and re-instruct.

1. **Trivial and in-scope: fix now.** Apply the fix in the same change, re-run the test command, and mention it in one line. Trivial means all of these: no behavior change; touches only files and lines already in the diff; the existing suite staying green proves it.
2. **In-scope behavior bug: fix now, with a test.** A defect in what the current diff does never routes to an issue, because deferring it ships it. Add a test that fails without the fix.
3. **Actionable and out-of-scope: open a GitHub issue.** This covers anything that changes behavior outside the diff, spans untouched files, needs a judgement call, or grows the diff. Title prefix `[follow-up]`. The body links the pull request and quotes the finding. Label `follow-up`, plus `tech-debt` if apt. Search open issues first and comment on an existing one rather than refiling. The pull request body's Reviewer notes section links the issues.
4. **FYI, no action: one line** in the sprint log or the pull request notes. No issue.

Behavior-changing pull requests get an independent code-reviewer pass before I merge. Re-review through the same reviewer so it keeps its context. When a finding forces a product fork, put the options to me instead of picking one.

For sprint-stack: the reviewer subagent returns APPROVE or BLOCK and edits no files. A bucket-2 finding forces BLOCK; the orchestrator applies the fix and the test, then re-runs review. After APPROVE it applies bucket-1 fixes as a small `chore(...)` or `refactor(...)` commit, opens bucket-3 issues, writes the log, and opens the pull request.

### Pull requests

Write them as human-authored. No "Generated with" footer, no `Co-Authored-By` agent trailer, and no AI-attribution line anywhere: not in a title, a body, a commit message, a code comment, a document, or a review comment. An agent session link counts as attribution. This overrides any harness default.

**The diff test:** a sentence belongs in the body only if the reviewer could not write it themselves by reading the diff.

- Things that are not typically visible in a diff can be included, e.g. intent, reason, cost, a constraint that shaped the code, a rejected alternative, etc.
- Things that can be understood by reading the diff should be excluded, e.g. an edit list, a before-and-after value, a description of what a file now contains.
- Never make a file path the subject of a sentence. Name files where the reviewer needs the pointer.
- One exception to conclusions-only: record a rejected alternative in one line when the record stops a retry.

Split the test plan into two named sections. `## Tested` lists what the session ran, with results inline and no checkboxes. `## Manual tests` lists what a human must still do, as unchecked boxes. Never one mixed checklist.

A Product section leads with the root cause: the lost state. Then the implications, including what the user now wrongly believes. Then the new behavior as a rule. Then the recovery path. Product vocabulary only. Analytic register, no dramatization.

### Issues

Explain any issue, defect, or review finding in this order:

1. **TL;DR.** Defect or clutter, user impact, and the decision to make.
2. **Vocabulary.** Each term of art in one line, in plain words, before it is used.
3. **The problem.** What exists and why it is wrong. No file paths and no symbol names — describe a code artifact by its role.
4. **The change requested.** The fix, framed as paths to choose.
5. **The consequence of doing nothing.** Who pays the cost and how.
6. **Priority.** A plain call with its reason.

In a GitHub issue this section goes on top, with the original engineering finding preserved at the bottom under an "Original finding" divider.

### GitHub access model

- The `origin` remote is a proxy mirror of GitHub and can lag or diverge. github.com is the source of truth for branch, pull request, and `main` state.
- The HTTPS and git proxies authenticate through the connected GitHub App and ignore pasted tokens. A token in a command changes nothing, so an invalid token can appear to work.
- `gh` succeeds for issues, pull requests, and API reads under App auth. Use it first, and ask for a personal access token only after `gh` itself fails.
- Verify a token before first use: `curl --noproxy '*' -H "Authorization: Bearer <token>" https://api.github.com/user` must return the right login.
- The GitHub MCP server and raw proxy `curl` still fail on writes with `403 Resource not accessible by integration`.
- Anonymous `curl --noproxy '*' https://api.github.com/repos/<owner>/<repo>/branches` reaches real GitHub directly and is fine for branches, pull requests, commits, compare, and events. It omits repository merge settings entirely, so read those with `gh api`.
- Diagnose which layer gates a blocked call before re-sending anything.

**Token hygiene.** A personal access token lives in session memory only. Never write it to `.git/config`, `~/.git-credentials`, a commit message, a git URL, or any tracked file. `git push -u <token-URL> <branch>` stores the token as the branch upstream. After any push involving one, check `.git/config` for it and unset the upstream if it landed.

### Merge train

- CI runs only on pull requests based on `main`. A pull request based on another branch never runs its required checks and stays blocked. Merge `main` into the head branch and push to start them.
- Never delete a merged branch while an open pull request uses it as base. GitHub closes the dependent outright, and no one can reopen a closed pull request whose base is gone. Retarget dependents first.
- Raced version-bump pull requests collapse to one per batch, each carrying the identical diff. Merge the oldest and close the duplicates with a comment.
- Never enable auto-merge. I own every merge decision.
