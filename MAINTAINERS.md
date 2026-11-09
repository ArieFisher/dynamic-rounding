# Maintainers

[AGENTS.md](AGENTS.md) holds the conventions for every contributor, the test suites, and how versions move. [CONTRIBUTING.md](CONTRIBUTING.md) holds this repository's setup and commit checks. This guide holds this repository's release steps and changelog.

## Releasing

### Chrome extension

Merging to `main` is the release. Distribution is load-unpacked from the repo; there is no store listing to update.

### JavaScript (Google Sheets)

The bump workflow has already moved the version line and the changelog heading by merge time. Update the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) with the new `js/round_dynamic.js`.

### Python

The bump workflow has already moved `python/pyproject.toml` by merge time. To publish to PyPI:

```bash
cd python
rm -rf dist build *.egg-info
python3 -m build
twine upload dist/*
```

### Tags

The repo carries tags through `js-v0.2.4`, `py-v0.1.2`, and `v0.1.0`. Releases since the bump automation are untagged; create a tag only when cutting a GitHub Release.

## Changelog

- `js/CHANGELOG.md` is the only changelog, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- Python has none; PyPI release history and git history serve.
- The Chrome extension has none; its version moves with every merged PR that touches it.
