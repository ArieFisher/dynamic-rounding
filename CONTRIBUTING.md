# Contributing

Thanks for your interest in contributing to DynamicRounding.

## Reporting Issues

Open a GitHub issue with:

- What you expected to happen
- What actually happened
- Example input values and parameters that reproduce the problem
- Which implementation (JS, Python, or the Chrome extension) and which mode you're using

## Suggesting Features

Open a GitHub issue describing:

- The use case
- How you'd expect it to work
- Example input/output if applicable

## Development Workflow

Follow [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow). All changes come through Pull Requests.

1. Create a branch named by change type: `feature/`, `fix/`, `chore/`, `refactor/`, or `docs/`, plus a short kebab-case description (e.g. `fix/grid-first-row`)
    - *External contributors: fork the repo first.*
2. Enable the repo hooks once per clone: `git config core.hooksPath .githooks`
3. Make and test your changes (see below)
4. Update the docs your change invalidates — the documented examples run against the library in CI (`node js/doc-tests.js`)
5. Submit a PR with a clear description

### Adding files

Every new file must pass one test: **does this file serve someone using or building DynamicRounding?** Output from your editor, your agent tooling, or a local scan describes your machine, not this project. It stays out.

`scripts/check-files.sh` enforces that. The `pre-commit` hook runs it on what you stage, and the `Repo hygiene` workflow runs it again on every PR. It rejects three things:

- a name on the deny list, wherever it appears: scan and report output (`*-report.md`, `*-baseline.md` and their underscore twins), env files, key material, `.DS_Store`, `*.log`
- a path outside `chrome-extension/`, `js/`, `python/`, `docs/`, `scripts/`, `.github/`, `.githooks/`, `.agent/rules/`, `.agent/skills/`, or the short allowlist of root files
- contents matching a credential pattern

Run it yourself any time with `scripts/check-files.sh --staged`, or audit the whole tree with `scripts/check-files.sh --tracked`.

If the gate is wrong about your file, change the policy block at the top of the script in the same PR and say why. Do not reach for `--no-verify`.

The policy block is the whole gate, so a bad edit there makes it pass everything. `bash scripts/check-files-test.sh` plants a violation of each rule in a scratch repository and requires the gate to catch it. Run it after any policy change; `Repo hygiene` runs it too.

Keep scratch work outside the repo. `docs/private/` is git-ignored if you want it nearby.

### Code Style

- Keep it simple and readable
- Add comments for any new parameters (JSDoc for JS, docstrings for Python)
- Maintain backward compatibility with existing signatures
- Use the canonical terms from [docs/vocabulary.md](docs/vocabulary.md) in comments, test names, commit messages, and PR text; its Retired synonyms table lists the words to avoid

## Testing

### JavaScript (Google Sheets)

Run the test suite:
```bash
cd js
node tests.js
```

Run the doc-example suite — it executes every input/output pair the docs state against the library:
```bash
node js/doc-tests.js
```

Also verify in the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) "Tests" tab.

### Chrome extension

Run the test suite — the repo's largest, and part of CI on every PR:
```bash
node chrome-extension/tests.js
```

### Python

Run the test suite:
```bash
cd python
pip install -e ".[dev]"
pytest
```

## Questions

Open an issue. Happy to help.