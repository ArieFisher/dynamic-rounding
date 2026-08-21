# Contributing

Thanks for your interest in contributing to DynamicRounding.

## Reporting Issues

Open a GitHub issue with:

- What you expected to happen
- What actually happened
- Example input values and parameters that reproduce the problem
- Which implementation (JS or Python) and which mode you're using

## Suggesting Features

Open a GitHub issue describing:

- The use case
- How you'd expect it to work
- Example input/output if applicable

## Development Workflow

Follow [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow). All changes come through Pull Requests.

1. Create a feature branch (`git checkout -b feature/my-description`)
    - *External contributors: fork the repo first.*
2. Enable the repo hooks once per clone: `git config core.hooksPath .githooks`
3. Make and test your changes (see below)
4. Submit a PR with a clear description

### Adding files

Every new file must pass one test: **does this file serve someone using or building DynamicRounding?** Output from your editor, your agent tooling, or a local scan describes your machine, not this project. It stays out.

`scripts/check-files.sh` enforces that. The `pre-commit` hook runs it on what you stage, and the `Repo hygiene` workflow runs it again on every PR. It rejects two things:

- a path outside `chrome-extension/`, `js/`, `python/`, `docs/`, `scripts/`, `.github/`, `.githooks/`, or the short allowlist of root files
- contents matching a credential pattern

Run it yourself any time with `scripts/check-files.sh --staged`, or audit the whole tree with `scripts/check-files.sh --tracked`.

If the gate is wrong about your file, change the policy block at the top of the script in the same PR and say why. Do not reach for `--no-verify`.

The policy block is the whole gate, so a bad edit there makes it pass everything. `bash scripts/check-files-test.sh` plants a violation of each rule in a scratch repository and requires the gate to catch it. Run it after any policy change; `Repo hygiene` runs it too.

Keep scratch work outside the repo. `docs/private/` is git-ignored if you want it nearby.

### Code Style

- Keep it simple and readable
- Add comments for any new parameters (JSDoc for JS, docstrings for Python)
- Maintain backward compatibility with existing signatures

## Testing

### JavaScript (Google Sheets)

Run the test suite:
```bash
cd js
node tests.js
```

Also verify in the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) "Tests" tab.

### Python

Run the test suite:
```bash
cd python
pip install -e ".[dev]"
pytest
```

## Questions

Open an issue. Happy to help.