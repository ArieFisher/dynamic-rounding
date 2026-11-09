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

### Vocabulary check

[docs/vocabulary.md](docs/vocabulary.md) holds one term per concept. Its Retired synonyms table lists the words each term replaces, and the Pattern column of each row holds an expression that matches the retired synonym.

`scripts/check-vocab.sh` reads that table and blocks a commit or a pull request when an added line matches a pattern. The `pre-commit` hook runs it on what you stage, and the `Repo hygiene` workflow runs it on every line the pull request adds since its branch left `main`. The script checks:

- only added lines, so an old line that still holds a retired synonym never blocks an unrelated change
- only markdown files
- no historical record, and not the vocabulary itself, which has to spell out the retired synonyms. The exempt-path list near the top of the script holds the exact paths.

A blocked commit prints the file, the pattern it matched, and the line. Replace the retired synonym with the term in the table's Say column. Run the check yourself any time with `scripts/check-vocab.sh --staged`, or on a whole branch with `scripts/check-vocab.sh --range origin/main HEAD`. It exits 0 when every added line is clean, 1 when it blocks a line, and 2 when it cannot run the check at all.

To retire a word, add a row to the table with a pattern. The script reads the new row on the next commit. Reviewers catch the retired synonyms whose rows hold no pattern. [Writing a pattern](docs/vocabulary.md#writing-a-pattern) explains how to narrow a pattern so it matches the retired sense and leaves the word's other senses alone.

The table is the whole policy, so a damaged table would let every line through and look the same as clean prose. To stop that, the script tests its pattern list before it reads any change, and exits 2 when it cannot read the table, when the table yields no patterns, when a pattern is not a valid expression, or when no pattern matches a fixed sentence that holds a known retired synonym. `bash scripts/check-vocab-test.sh` plants retired synonyms, clean prose, exempt files, and damaged tables in a scratch repository and requires the right result for each. Run it after any change to the table or the script; `Repo hygiene` runs it too.

### Code Style

- Keep it simple and readable
- Add comments for any new parameters (JSDoc for JS, docstrings for Python)
- Maintain backward compatibility with existing signatures
- Use the canonical terms from [docs/vocabulary.md](docs/vocabulary.md) in comments, test names, commit messages, and PR text; its Retired synonyms table lists the words to avoid

## Testing

### JavaScript (Google Sheets)

`js/round_dynamic.js` is generated, so never edit it by hand. Edit its sources, `js/src/` and the shared library files the build script lists, then rebuild it from the repository root and commit the result:
```bash
node scripts/build-sheets.js
```
CI runs `node scripts/build-sheets.js --check` and fails when the committed file differs from the build. The shared library files are part of the Sheets library, so rebuild after a change to one of them as well.

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

The tests live in pieces under `chrome-extension/tests/`, and `tests.js` joins them in its order list and runs them as one script, so every piece reads the setup in `setup.js` and the helper functions in `helpers.js`. A new helper function goes in `helpers.js`. Each other piece holds the tests for one area of the extension, named on its first line: number reading, the classification ladder, detection, the rounding pass, the table kind pairs, the pillbox, the sidebar, messaging and the application model, capture and the log, and checks that read source files or docs as text. Add a test to the piece for the area it tests. A new piece goes in the order list, and the run stops with an error on a piece missing from the list or a listed piece missing from the folder.

### Python

Run the test suite:
```bash
cd python
pip install -e ".[dev]"
pytest
```

## Questions

Open an issue. Happy to help.