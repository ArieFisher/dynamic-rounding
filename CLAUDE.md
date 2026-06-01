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

## GitHub writes (push, PR, comments)

When the user has provided a PAT in the session, use it directly via the GitHub REST API (`curl` with `Authorization: Bearer <PAT>`) or via a one-shot authenticated git URL (`https://x-access-token:<PAT>@github.com/...`). **Do not try the GitHub MCP server first** — in this environment it consistently returns `403 Resource not accessible by integration` for writes, so attempting it just wastes a round trip and clutters the transcript.

When no PAT is available, MCP is the only path; try it then, and if it 403s, ask the user for a PAT.

The PAT lives in session memory only — never write it to `.git/config`, `~/.git-credentials`, commit messages, or any tracked file.

**Common leak path:** `git push -u <PAT-URL> <branch>` sets the PAT-bearing URL as the branch's upstream and stores it in `.git/config`. Never use `-u` with an authenticated URL. If pushing for the first time on a branch, either: (a) push without `-u`, or (b) run `git remote set-url origin <https-url-without-PAT>` first and then `git push -u origin <branch>`. After any push using an authenticated URL, run `grep -c x-access-token .git/config` — it must return `0`. If non-zero, `git branch --unset-upstream <branch>` and re-check.
