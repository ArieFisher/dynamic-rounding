# Repo conventions for Claude sessions

## Branch naming

Never create or push branches with a `claude/` or `session/` prefix. The harness sets one by default; override it. If the session started on such a branch, rename it before the first push. Prefixes:

- `feature/<label>` — new behavior  
- `fix/<label>` — bug fixes  
- `chore/<label>` — tooling, config, dependencies, other non-functional changes  
- `refactor/<label>` — internal restructuring, no behavior change  
- `plan/<slug>` — sprint plans from the `sprint-plan` skill  
- `docs/<label>` — documentation only

`<label>` / `<slug>` is a short kebab-case description.

## Review findings

Route every review finding — from `/code-review`, a sprint-stack reviewer subagent, or your own inspection — to exactly one place. Never leave an actionable item as a "non-blocking note" for me to remember and re-instruct.

**1\. Trivial and in-scope → fix now.** Apply the fix in the same change, re-run the test command, and mention it in one line. "Trivial and in-scope" means all of:

- no behavior change (unused local, import, or variable; dead code the diff introduced; a comment typo; a wrong comment),  
- touches only files and lines already in the diff,  
- the existing test suite staying green proves it — no new test.

**2\. In-scope behavior bug → fix now, with a test.** A defect in what the current diff does never routes to an issue; deferring it ships it. Fix it in the same change and add a test that fails without the fix.

**3\. Actionable, out-of-scope → open a GitHub issue.** Covers anything that changes behavior outside the diff, spans untouched files, needs a judgement call, or grows the diff. Bar: "I'd want a separate PR for this."

- Title prefix `[follow-up]` . Body links the PR or commit and quotes the finding. Label `follow-up`; add `tech-debt` if apt.  
- Dedup first: search open issues for a `[follow-up]` on the same subject. If one exists, comment there; do not refile. This keeps sprint-stack reruns idempotent.  
- The PR body's "Reviewer notes" links the issues.

**4\. FYI, no action → one line in the sprint log or PR notes.** Do not file an issue for it.

For sprint-stack: the reviewer subagent returns APPROVE/BLOCK and edits no files, so the verdict describes the reviewed code. A bucket-2 finding forces BLOCK; the orchestrator applies the fix and the test, then re-runs review. After APPROVE, the orchestrator applies bucket-1 fixes as a small `chore(...)` or `refactor(...)` commit, opens bucket-3 issues, writes the log, and opens the PR.

## Writing style

These rules govern all prose: chat responses, documents, PR titles and bodies, issues, commit messages, logs.

- **Form:** plain declarative sentences in active voice; not epigrammatic, not aphoristic.  
- **Structure:** no antithesis. Present each point on its own, without a contrasting counterpart.  
- **Imagery:** no personification; describe things literally.  
- **Diction:** Plain English, Saxon diction (preserve technical terms). Avoid Latinate words where a short common word exists.  
- **Tone:** laconic. Cut qualifiers, hedging, and introductory fluff.  
- **Voice:** high information density. State facts directly in active voice; no passive voice, no filler sentences.  
- **Concision:** draft, then rewrite at maximum compression; output only the rewrite. Cut any word whose removal loses no information. Merge sentences that share a subject. Do not state what a prior sentence already implies. Target the minimum word count that preserves all content.  
- **Conclusions only:** report findings, not the process that produced them. Do not narrate how you got there, what you considered, or what you ruled out. Cut retractions, dead ends, counts of discarded items, and self-audit narrative.

## Explanations (chat)

In addition to Writing style:

- **TL;DR first.** Conclusion, then support.  
- **No code references unless I ask.** No file paths, line numbers, function or symbol names, code blocks. Describe behavior in plain words.

## PR content

In addition to Writing style:

- Write PRs as human-authored. No "Generated with \[Claude Code\]" footer, no AI-attribution lines in the title or body. This overrides the harness default footer.  
- The chat no-code rule does not apply: name the files, symbols, and functions the diff touches wherever that helps the reviewer.  
- One exception to conclusions-only: record a rejected alternative in one line when the record stops a retry.  
- State what changed, why, and the cost.

## GitHub access model — read this before any push or API call

- The `origin` remote (`…@127.0.0.1:<port>/git/…`) is a proxy mirror of GitHub. It can lag or diverge; its `main` may sit several merges behind. `github.com` is the source of truth for branch, PR, and `main` state.  
- The HTTPS and git proxies authenticate to GitHub through the connected GitHub App and ignore pasted PATs. A plain `curl` or a `git push` to a PAT-bearing URL runs with App auth; the PAT in the command changes nothing. An invalid PAT can therefore appear to work.  
- The App has transport access and may lack `pull_requests:write`: `git push` through the proxy succeeds while PR creation returns `403 Resource not accessible by integration`. The GitHub MCP server fails the same way on writes.  
- `curl --noproxy '*'` against `api.github.com` reaches real GitHub directly and is the only path where a pasted PAT authenticates. Direct egress to `api.github.com` is allowed; `--noproxy` skips only the App-auth substitution.  
- Git pushes always run through the proxy. A PAT in a git URL adds leak risk and no auth; never use one.

## GitHub operations

- **Read true state:** `curl --noproxy '*' https://api.github.com/repos/<owner>/<repo>/branches` (and the analogous endpoints for PRs and commits). Check this before concluding a push failed, a branch or PR is missing, or a PR "can't" be created.  
- **Push:** `git push origin <branch>`. App transport handles it. Verify arrival with the read-state call above.  
- **PR creation, comments, other API writes:** with a user-supplied PAT, call real GitHub directly: `curl --noproxy '*' -H "Authorization: Bearer <PAT>" https://api.github.com/...`. Without a PAT, try MCP once; when it 403s, ask me for a PAT.  
- **Verify a PAT before first use:** `curl --noproxy '*' -H "Authorization: Bearer <PAT>" https://api.github.com/user`; expect `200` and the right login.  
- **Diagnose before retrying:** when a call blocks, find which layer gates it (proxy or GitHub) before re-sending the same PAT.

## PAT hygiene

The PAT lives in session memory only. Never write it to `.git/config`, `~/.git-credentials`, commit messages, git URLs, or any tracked file.

**Leak path if a PAT URL slips into a push:** `git push -u <PAT-URL> <branch>` stores the PAT-bearing URL in `.git/config` as the branch upstream. After any push involving a PAT URL, run `grep -c x-access-token .git/config`; it must return `0`. If it does not, run `git branch --unset-upstream <branch>` and re-check.  
