# Maintainers

## Versioning

Three artifacts carry independent version numbers:

| Artifact | Series | Where the version lives |
|----------|--------|-------------------------|
| Chrome extension | 2.2.x | `chrome-extension/manifest.json` |
| Python | 0.2.x | `python/pyproject.toml` — the package reads it back at runtime via `importlib.metadata` |
| JS (Google Sheets) | 0.3.x | `js/src/entry.js` — the `[VERSION]` line in the `ROUND_DYNAMIC` JSDoc, which the Sheets help card shows. The Sheets build copies it into the generated `js/round_dynamic.js` |

## How versions move

The `Bump package versions on merge` workflow (`.github/workflows/bump-version.yml`) runs after every merged PR. `scripts/bump-versions.py` holds the table of packages and their version files. If the PR touched `python/**`, `chrome-extension/**`, or `js/**` — documentation included — it bumps the patch of the matching version file, or the minor version when the merged PR carries the `minor` label (the patch then resets to 0), opens a bump PR titled `chore(version): bump after #NNN`, waits for the required checks, merges it, and deletes the bump branch. For JS it also runs the Sheets build (`node scripts/build-sheets.js`), so the version-bump PR carries a `js/round_dynamic.js` that matches the build, and turns the `## [Unreleased]` heading in `js/CHANGELOG.md` into the new version's heading. Nobody edits those version lines or release headings by hand. To release a minor version, add the `minor` label to the PR before merging it.

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

## File Naming Convention

- ALL CAPS for standard repo metadata: README, LICENSE, CHANGELOG, CONTRIBUTING, MAINTAINERS, CLAUDE
- lowercase for everything else
- The repo root is an allowlist: `scripts/check-files.sh` rejects any new root file not named in its policy block
