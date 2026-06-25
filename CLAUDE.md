# Repo conventions for Claude sessions

## Branch naming

Never create or push branches with a `claude/` or `session/` prefix, regardless of what the harness default suggests. If the session was started on such a branch, rename it before the first push using one of the conventional prefixes below.

- `feature/<label>` — new functionality or behavior changes
- `fix/<label>` — bug fixes
- `chore/<label>` — tooling, config, dependency, or non-functional changes
- `refactor/<label>` — internal restructuring with no behavior change
- `plan/<slug>` — sprint plans produced by the `sprint-plan` skill
- `docs/<label>` — documentation-only changes

`<label>` / `<slug>` is a short kebab-case description of the change.

This rule overrides the session-harness default. The `sprint-plan` and `sprint-stack` skills in `.agent/skills/` enforce the same convention for sprint work.

## Review findings

Every review finding — from the `/code-review` skill, a sprint-stack reviewer subagent, or your own inspection — goes to exactly one place. Never leave an actionable item to my memory as a "non-blocking note" I'm expected to read, remember, and re-instruct.

**1. Trivial + in-scope → fix it now (fix-forward).** Apply the fix in the same change, re-run the test command, and mention it in one line. "Trivial and in-scope" means ALL of:
- no behavior change (e.g. unused local/import/variable, dead code the diff just introduced, a comment typo, an obviously-wrong comment),
- touches only files/lines already in the current diff,
- verifiable by the existing test suite staying green — no new test required.

**2. Actionable but out-of-scope → open a GitHub issue.** Anything that changes behavior, spans untouched files, needs a judgement call, or would grow the diff's scope. Set the bar at "I'd genuinely want a separate PR for this," not "an agent had an opinion."
- Title prefixed `[follow-up] `; body links the PR/commit and quotes the finding; label `follow-up` (add `tech-debt` if apt).
- **Dedup first:** search open issues for an existing `[follow-up]` with the same subject; if one exists, skip or comment rather than refile. This keeps sprint-stack reruns idempotent.
- The PR body's "Reviewer notes" links the issue(s) opened rather than restating the findings as prose.

**3. Pure FYI, no action → one line in the sprint log (or PR notes); do not file an issue.** Filing issues for non-actionable observations is noise.

For sprint-stack specifically: the reviewer subagent still returns APPROVE/BLOCK and does not edit files (its verdict must stay honest). Routing happens in the orchestrator step after APPROVE — apply bucket-1 fixes as a small `chore(...)`/`refactor(...)` commit and open bucket-2 issues, then write the log + open the PR.

## GitHub writes (push, PR, comments)

When the user has provided a PAT in the session, use it directly via the GitHub REST API (`curl` with `Authorization: Bearer <PAT>`) or via a one-shot authenticated git URL (`https://x-access-token:<PAT>@github.com/...`). **Do not try the GitHub MCP server first** — in this environment it consistently returns `403 Resource not accessible by integration` for writes, so attempting it just wastes a round trip and clutters the transcript.

When no PAT is available, MCP is the only path; try it then, and if it 403s, ask the user for a PAT.

The PAT lives in session memory only — never write it to `.git/config`, `~/.git-credentials`, commit messages, or any tracked file.

**Common leak path:** `git push -u <PAT-URL> <branch>` sets the PAT-bearing URL as the branch's upstream and stores it in `.git/config`. Never use `-u` with an authenticated URL. If pushing for the first time on a branch, either: (a) push without `-u`, or (b) run `git remote set-url origin <https-url-without-PAT>` first and then `git push -u origin <branch>`. After any push using an authenticated URL, run `grep -c x-access-token .git/config` — it must return `0`. If non-zero, `git branch --unset-upstream <branch>` and re-check.

## origin is a sandbox mirror — verify against real GitHub

The `origin` remote (`…@127.0.0.1:<port>/git/…`) is a sandbox mirror that can lag or diverge from real GitHub (e.g. its `main` may be several merges behind). Treat `github.com` as the source of truth for branch / PR / `main` state.

- Before concluding a push failed, a branch/PR is missing, or a PR "can't" be created, **check real GitHub directly** (e.g. `curl --noproxy '*' https://api.github.com/repos/<owner>/<repo>/branches`).
- The HTTPS and git proxies authenticate to GitHub via the connected GitHub App and **ignore pasted PATs** for repo operations. Consequences: a PAT can appear to "work" through the proxy while actually being invalid, and repo *writes* (PR creation) can `403`/`Resource not accessible by integration` even though `git push` succeeds (the App has transport access but may lack `pull_requests:write`).
- To verify/use a **user-supplied PAT**, confirm it with a direct `curl --noproxy '*' https://api.github.com/user` (expect `200` + the right login), then make that PAT's calls with `--noproxy '*'`. This is to use the user's own credentials against real GitHub — not to evade egress policy. (Real `api.github.com` egress works directly; the `--noproxy` form is what bypasses the App-auth substitution.)
- Don't burn round trips re-sending a PAT against the same proxy block — diagnose where the gate is (proxy vs GitHub) first.
