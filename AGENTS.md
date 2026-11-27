# Repository conventions for agents
 
These conventions apply to every contributor, person or agent, whatever tool runs the agent. Read this file in full before your first tool call, and read `CONTRIBUTING.md` (setup and commit checks) and `MAINTAINERS.md` (release steps and changelog) before your first change.
 
**This file is the only copy.** Claude Code reads it through `CLAUDE.md`, and Antigravity through `.agent/rules/`. Never restate a rule from here in another file; see [Group like concepts into a single location](#group-like-concepts-into-a-single-location).
 
Rules group by reader: the contributor guide for everyone, the maintainer guide for whoever merges and releases, and the agents section for agents only. A new rule goes in the section for the reader it governs. Delete the headings marked "(this repository)" to reuse the file in another project.
 
## Contributor guide
 
### Vocabulary
 
`docs/vocabulary.md` is the term canon: one term per concept, across every platform and document.
 
- Read it in full when starting a branch. Use its terms in everything you write, from code to pull request text. Never vary word choice for style.
- **At every commit**, sweep the change's **new** lines: replace each retired synonym with its canonical term, and define each new concept in `docs/vocabulary.md` on the same branch.
### Group like concepts into a single location
 
A list, a rule, or an explanation belongs in exactly one place. Two copies drift apart silently: whoever edits one does not know the other exists, nothing fails, and enforcement falls behind the canon. This covers allowlists, error codes, supported-version tables, feature flags, code-comment reasons, and these conventions.
 
- Code that enforces something a document states parses that document. Put the machine form beside the human form — a column, a fenced block, a front-matter key.
- Fail closed: when the parse returns nothing, because of a missing file, a renamed heading, or a reshaped row, the check exits with an error. "Found nothing" and "nothing to enforce" look identical from outside.
- Never add a "keep in step with X" comment. Remove the duplicate instead.
- Write a reason, or a note for the next editor of a piece of code, once: in a comment beside that code. This covers review findings, warnings about a test, and constraints on how the code may change. Every other place holds only a pointer to that comment.
### Collapse a path before opening a second one
 
Before adding a second code path — a new adapter, a new branch for a new surface, a new writer — check whether the existing path can widen to cover both cases. That refactor is the default answer.
 
- When the paths cannot collapse, build their shared rule once and ship it to every path in the same change.
- When one path cannot run the rule yet, hold it back from every path. A pull request whose whole point is bringing one path in line with another is the outcome to avoid.
A rule staggered across paths drifts apart like a duplicated list.
 
### Test a plan for simplicity before it is final
 
Every plan — sprint plan, scope document, or plan written in chat — is final only after a section titled "Simplicity" answers these questions. Answer each from the code, not from the plan's account of it.
 
1. **Size.** Is the code after the change simpler than before? Name what the change adds and removes. When the code grows, list each addition and the requirement it implements.
2. **Duplicates.** Which duplicated code does the change pass through? Each is a candidate to merge first, under [Collapse a path before opening a second one](#collapse-a-path-before-opening-a-second-one). A merge that changes no behavior goes in its own `refactor/` pull request, ahead of the change that needs it, so the existing suite proves it.
3. **Removals.** Can any step, stored field, setting, or branch the plan adds come out without losing a requirement?
4. **Orphans.** Does the change leave a function, field, or path with no reader? Remove it in the same change.
5. **Bounds.** Does the plan hold anything unbounded: a walk over page content, a wait, a retry, a count, a queue? Each gets a cap with a stated value, a reason for the value, and the behavior at the cap.
6. **Current behavior.** Does every statement about how the code behaves today match the code? A defect the plan describes must be reproducible on `main`.
Update the plan for any answer that leads to a change. When an answer needs a product choice, put the options to me.
 
### Table kinds behave alike
 
A native table and a grid are one product: a reader never learns which markup drew a table. Every rule reaches both kinds with the same result, unless one kind's code can do something the other's cannot.
 
- A change reaching both kinds is this rule holding. Never report it to me as a consequence.
- A change that leaves the kinds behaving differently goes to me with the reason it is forced, under [Surface a consequence only when it would change my decision](#chat).
### Versions
 
Always take the newest release of an action, tool, or runtime. Read its breaking-change notes to confirm the jump, not to justify avoiding it. Report anything left behind, including a runtime whose newest line is ahead of the newest long-term-support line.
 
### Adding files
 
This repository is public. Stage a new file only if it serves someone using or building DynamicRounding. A local toolchain report, an agent scan, a session journal, or a scratch note never does.
 
- **Never** `git add .` **or** `git add -A`. Stage paths by name.
- **Write scratch output to the session scratchpad**, not the repository.
- **Never pass** `-f` **to** `git add` or `--no-verify` to a commit. If a check blocks a file that belongs, change the check's policy in the same change and say why in the pull request.
- Name standard repository metadata files in capitals (README, LICENSE, CHANGELOG, CONTRIBUTING, MAINTAINERS, AGENTS, CLAUDE) and every other file in lowercase.
### Code style
 
- Keep code simple and readable.
- Type-hint every new Python parameter and return value. Write no JavaScript per-parameter doc comments, except on `ROUND_DYNAMIC`, whose JSDoc Google Sheets reads to build the help card.
- A comment holds only what the code cannot show: a reason, a constraint, or a fact about the page or an outside caller. Never restate what the code does; the restatement goes false when the code changes. First judge whether a clearer name or a smaller function removes the need.
- A test name holds the input and the expected result, never the mechanism. A test group heading holds the behavior its tests check. A mechanism in a name goes false when the mechanism changes, and the test still passes.
- Tests that check one behavior of one function under one setup, and differ only by input and expected result, share one case table, one row per case. Each behavior holds its own case table under its own test group heading. Tests that check event order, a sequence of steps, or code text stay separate.
### Regression fixtures
 
A capture from the extension holds real page content. Commit only a minimized synthetic copy: the failing structure rebuilt with invented values that still reproduce the defect. A raw capture never enters the repository.
 
### The manual test page
 
`docs/test-pages/test-tables-1.html` holds one table per shape the extension handles, each with its expected result. It is the page I load to check a change by hand, and the only place a manual test of the extension can name.
 
- **Every change that adds a kind of test names the table to test it on.** Run every test that can run automatically, in the suites or on the page in a headless browser, and report it under `## Tested`. Give me the section number, in the pull request's manual tests and in chat, only for a test that cannot.
- A change to a shape the page already holds points at its section. A change that turns on a shape the page lacks, such as merged cells, adds a section in the same branch. The measure is whether the shape matters to someone using the extension, not the size of the change.
- A section's tester's notes, closed by default, state what the table holds and what to expect. Where a pass looks like nothing happened, they state what a failure looks like, in the present tense. They never state what a setting does to the table, what the extension did before a change, or the issue behind a fixture. A row whose result waits on an open design decision links to that decision's issue. A row label carries "rounds" or "held" only when that row is the exception to the section's expectation.
- **A section can also be a puzzle**: a question for any reader about the story the table tells once simplified, with panels for the data patterns and the story that the reader opens or hides at will. The puzzle never states what a setting does to the table.
- **A manual test of the Claude Code plugin runs on the plugin test prompt** in `claude-code-plugin/README.md`, on the table the prompt makes the model write, with the expected text under it. When a change turns on a shape that table lacks, add the shape in the same branch.
### Docs track behavior
 
Living documents: `README.md`, `CONTRIBUTING.md`, `MAINTAINERS.md`, `chrome-extension/README.md`, `claude-code-plugin/README.md`, `docs/capability-map.md`, `docs/design.md`, `docs/table-kind-pairs.md`, `docs/test-pages/test-tables-1.html`, `docs/vocabulary.md`, `js/README.md`, `js/tests-googlesheets-tab.md`, `python/README.md`, the `.agent/` instruction files, and this file. Sprint plans and logs, research notes, and released `js/CHANGELOG.md` entries are historical records: mark them, never rewrite them.
 
- A pull request that changes behavior updates every living document it invalidates, in the same branch, or says "No doc impact" in the body.
- Whoever changes code (a name, a value, a condition, or what it does) searches the repository in the same commit for the old name and for text describing the old code. Whoever changes a rule here or in the design document, or a vocabulary term, searches in the same branch for text written under the old rule or term. Correct each code line, comment, test name, test group heading, and living document the change made false.
### Public repository, security disclosure
 
Text that explains an exposure is itself a disclosure, worse than the artifact, because it summarizes and points. Later edits leave revision history on GitHub and orphaned objects in git.
 
- Say what changed and why, in neutral terms. No counts, no inventory of the exposure, no severity, no commit identifier pointing at the artifact.
- Fix a weakness in this repository's own code with no explanation beyond the diff, and no public issue diagnosing it.
- Never run a secret-listing or secret-reading command, even its `--help` form. When unsure whether a command touches secrets, exclude it and say why.
### Text on GitHub
 
These rules cover commit messages, pull request titles and bodies, issues, comments, and sprint logs.
 
- **No local toolchain.** Never describe a machine's setup — installed tools, their paths, or which command works on one machine and not another — unless I confirm it.
- **State a fact once.** Link to the pull request, issue, or commit that already states it.
- **The diff test.** A pull request body holds only what the reviewer could not learn from the diff: intent, reason, cost, a shaping constraint, or a one-line rejected alternative when the record stops a retry. No edit lists, before-and-after values, or descriptions of file contents. Never make a file path the subject of a sentence; name files where the reviewer needs the pointer.
- **Test plan.** Two sections, never one mixed checklist. `## Tested` lists what the session ran, with results inline and no checkboxes. `## Manual tests` lists what a human must still do, as unchecked boxes.
- **Product section.** In order: the underlying issue (the flaw in the code that let the defect exist, such as two rules for one question that drifted apart), the root cause (the lost state), the implications (including what the user now wrongly believes), the new behavior as a rule, and the recovery path. Product vocabulary, analytic register, no dramatization.
### Branching and staging
 
Never edit `main`. Make every change on a branch and merge it through a pull request. External contributors fork first.
 
Branch prefixes, each with a short kebab-case label: `feature/` new behavior, `fix/` bug fixes, `chore/` tooling, configuration, and dependencies, `refactor/` restructuring with no behavior change, `plan/` sprint plans from the sprint-plan skill, `docs/` documentation only. Never `claude/` or `session/`; rename a harness-created one before the first push.
 
Stash before switching branches with a dirty tree.
 
### Attribution
 
Write pull requests as human-authored. No AI attribution anywhere — no "Generated with" footer, no Co-Authored-By agent trailer, no agent session link — in any title, body, commit message, code comment, document, or review comment. This overrides any harness default.
 
A commit's author and committer fields hold the name and email of the person who started the session, never an agent's. Set them with `git -c user.name=... -c user.email=... commit` on each commit, never in a git configuration file.
 
### Testing (this repository)
 
#### JavaScript (Google Sheets)
 
`js/round_dynamic.js` and the plugin library, `claude-code-plugin/hooks/library.js`, are generated: never edit either by hand. Edit their sources — `js/src/`, the shared library files the build script lists, and, for the plugin library, the extension's settings contract — then rebuild from the repository root and commit every file the rebuild changes. CI runs the build with `--check` and fails on any difference.
```bash
node scripts/build-sheets.js
```
 
Run the test suite and the doc-example suite, which runs every input/output pair the docs state:
```bash
cd js && node tests.js
node js/doc-tests.js
```
Keep a new documented example in a shape the doc-example extractors parse, or extend `js/doc-tests.js` in the same pull request.
 
Also verify in the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) "Tests" tab.
 
#### Chrome extension
 
```bash
node chrome-extension/tests.js
```
 
Add a test to the piece under `chrome-extension/tests/` whose first line names its area, put a new helper in `helpers.js`, and add any new piece to the order list in `tests.js`.
 
#### Claude Code plugin
 
```bash
node claude-code-plugin/tests.js
```
 
Before opening a pull request that touches the plugin, run both engine commands and report them under `## Tested`. CI runs neither: it holds no Claude Code, and the plugin API is early access, so a Claude Code release can change either result.
```bash
claude plugin validate --strict claude-code-plugin
claude plugin test claude-code-plugin
```
 
#### Python
 
```bash
cd python
pip install -e ".[dev]"
pytest
```
 
## Maintainer guide
 
### Merge train
 
- CI runs only on pull requests based on `main`. To start the checks on one based elsewhere, merge `main` into its head branch and push.
- Never delete a merged branch while an open pull request uses it as base: GitHub closes the dependent, and it cannot be reopened. Retarget dependents first.
- Raced version-bump pull requests carry identical diffs. Merge the oldest and close the rest with a comment.
- Never enable auto-merge. I own every merge decision.
### How versions move (this repository)
 
After every merged pull request, the `Bump package versions on merge` workflow (`.github/workflows/bump-version.yml`) bumps each package the pull request touched, documentation included, using the package table in `scripts/bump-versions.py`. Nobody edits version lines or release headings by hand.
 
- It bumps the patch, or the minor version with the patch reset to 0 when the merged pull request carries the `minor` label. To release a minor version, add the label before merging.
- For JS, it also runs the Sheets build and turns the `## [Unreleased]` heading in `js/CHANGELOG.md` into the new version's heading.
- The plugin's version file is its manifest, `claude-code-plugin/.claude-plugin/plugin.json`. No build follows its bump; the plugin library holds no version.
- A change to a shared library file touches the Sheets file and plugin library through the rebuild, so it bumps the extension, the Sheets library, and the plugin.
- The workflow opens a bump pull request titled `chore(version): bump after #NNN`, with the token [MAINTAINERS.md](MAINTAINERS.md#bump-workflow-token) describes, waits for the required checks, merges it, and deletes the bump branch.
## Agents
 
### My role
 
I am the product manager and do not write the code. Lead with the mechanism in plain words, name the trade-off, and give a recommendation. Keep file names, commands, and symbol names out of chat unless I ask; full deliverables such as pull request bodies still name them where that helps the reader.
 
### Writing style
 
These rules govern all prose: chat, documents, and GitHub text.
 
- **Form:** short, plain, declarative sentences in active voice. Not epigrammatic, not aphoristic.
- **No personification.** Two tests, each with examples rather than a full list:
  - *The verb* names an operation, never a stance. Pass: holds, determines, skips, detects, flags, stands for, contains, parses, publishes, reads. Fail: own, know, decide, refuse, notice, warn, name, pick, rides, waits, speaks. "The script reads the file" passes; "the check refuses" fails.
  - *The subject* of an action verb (runs, reads, writes, checks, sends) is the part that performs it: the script, the build, the hook, the content script, or the person. A measure, score, result, document, label, term, or event performs nothing. A state verb (holds, contains, stands for) takes any subject. "A press reads the setting" fails; "the press handler reads the setting" passes.
  Similes are fine. Replace a metaphor with its plain meaning: "the press handler reads the table's on/off value and writes the opposite value", never "a press picks its direction".
- **Full words:** no contractions or abbreviations except i.e., e.g., etc., FYI, and TL;DR. Write "application", not "app".
- **Checked claims:** say whether and how each claim was checked. Mark guesses and estimates as such.
### Chat
 
- **TL;DR first.** Conclusion, then support.
- **Answer only what was asked.** A narrow question gets the answer and stops: no options, offers, framing, detail lists, or restated reasoning.
- **Explain ideas, not instructions.** State the problem, the change, and why the change removes the problem. A de-jargonized instruction is still an instruction.
- **Surface a consequence only when it would change my decision**: when it breaks something that works today, changes what a user sees on a page or a cell type I did not name, or needs a product choice. Do not flag a consequence that follows directly from the change I asked for. Put each flagged change to me before implementing, never after.
- **No unrequested scope.** Build the rule I asked for, not the adjacent one. A related concern becomes a separate issue.
### Review findings
 
Route every review finding to exactly one place. Never leave an actionable item as a note for me to remember and re-instruct.
 
1. **Trivial and in-scope: fix now.** Trivial means no behavior change, and the green existing suite proves it. Two kinds qualify:
   - A change to files and lines already in the diff.
   - A correction to a false comment, test name, or test group heading in any file, when the edit changes only that text. Correct it to match the code, checked by reading the code. Delete it only when the code no longer needs it.

   Apply the fix, re-run the tests, and mention it in one line.
2. **In-scope behavior bug: fix now, with a test that fails without the fix.** Deferring it ships it.
3. **Actionable and out-of-scope: open a GitHub issue.** This covers anything that changes behavior outside the diff, spans untouched files (except a bucket 1 correction), needs a judgement call, or grows the diff. Search open issues first and comment on a match rather than refiling. Title prefix `[follow-up]`; label `follow-up`, plus `tech-debt` if apt; the body links the pull request and quotes the finding. Link the issues in the pull request's Reviewer notes section.
4. **FYI, no action: one line** in the sprint log or the pull request notes.
Behavior-changing pull requests get an independent code-reviewer pass before I merge; re-review through the same reviewer so it keeps its context. When a finding forces a product fork, put the options to me.
 
For sprint-stack: the reviewer subagent returns APPROVE or BLOCK and edits no files. A bucket-2 finding forces BLOCK; the orchestrator applies the fix and the test, then re-runs review. After APPROVE, the orchestrator commits bucket-1 fixes as a small `chore(...)` or `refactor(...)` commit, opens bucket-3 issues, writes the log, and opens the pull request.
 
### Issues
 
Explain any issue, defect, or review finding in this order:
 
1. **TL;DR.** Defect or clutter, user impact, and the decision to make.
2. **Vocabulary.** Each term of art in one plain line, before its first use.
3. **The problem.** What exists and why it is wrong. Describe code by its role, with no file paths or symbol names.
4. **The change requested.** The fix, framed as paths to choose.
5. **The consequence of doing nothing.** Who pays the cost and how.
6. **Priority.** A plain call with its reason.
In a GitHub issue this goes on top, with the original engineering finding below an "Original finding" divider.
 
### GitHub access model
 
github.com is the source of truth for branch, pull request, and `main` state.
 
- Use `gh` first for issues, pull requests, and API reads. Ask me for a personal access token only after `gh` fails, and verify it returns the right login before first use.
- Diagnose which layer blocked a call before re-sending. A 403 with an HTML "Access Denied" body comes from a network security layer, not GitHub: stop and ask me.
- **Token hygiene.** A token lives in session memory only: never in `.git/config`, `~/.git-credentials`, a commit message, a git URL, or a tracked file. `git push -u <token-URL> <branch>` stores the token as the upstream; after any push involving a token, check `.git/config` and unset the upstream if it landed.
| | Cloud session | Local checkout |
|---|---|---|
| `origin` | A proxy mirror of GitHub; can lag or diverge. | GitHub itself. |
| Authentication | The proxies use the connected GitHub App and ignore pasted tokens, so an invalid token in a proxied command can appear to work. | The stored login of the person at the machine; a pasted token works. |
| Verify a token | `curl --noproxy '*' -H "Authorization: Bearer <token>" https://api.github.com/user` | `GH_TOKEN=<token> gh api user --jq .login` |
| Push | `git push origin <branch>`, then confirm arrival with the anonymous branches read below. | When the login has expired (`gh` returns 401, or `git push` reports "could not read Username"), pass `GH_TOKEN` on each command and push with `GH_TOKEN=<token> git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin <branch>`. |
| `gh pr create` returns 403 | `curl --noproxy '*' -H "Authorization: Bearer <token>" https://api.github.com/repos/<owner>/<repo>/pulls -d '{"title": "...", "head": "<branch>", "base": "main", "body": "..."}'` | For a GraphQL `HTTP 403 Forbidden`: `GH_TOKEN=<token> gh api repos/<owner>/<repo>/pulls -X POST -f base=main -f head=<branch> -f "title=..." -F body=@<file>`. Seen on 2026-11-18 and 2026-11-24 with a fine-grained token holding pull request write permission; REST succeeded with the same token. |
 
Cloud session only: the GitHub MCP server and proxied `curl` fail on writes with `403 Resource not accessible by integration`. Anonymous `curl --noproxy '*' https://api.github.com/repos/<owner>/<repo>/branches` reaches real GitHub for branches, pull requests, commits, compare, and events, but omits merge settings; read those with `gh api`.
 