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
