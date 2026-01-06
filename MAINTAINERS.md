# Maintainers

## Versioning

JS and Python have independent version numbers:

| Implementation | Current Example | Location |
|----------------|---------|----------|
| JS | 0.2.x | `js/round_dynamic.js` header |
| Python | 0.1.x | `python/pyproject.toml` + `python/dynamic_rounding/__init__.py` |

Bump version only when the implementation changes. Documentation-only changes don't require a version bump.

## Releasing

### JavaScript

1. Update version in `js/round_dynamic.js` header
2. Update `js/CHANGELOG.md`
3. Commit: `git commit -m "JS: Release v0.x.x"`
4. Tag: `git tag js-v0.x.x`
5. Push: `git push && git push --tags`
6. Create GitHub Release from tag (optional)
7. Update template spreadsheet with new code

### Python

1. Update version in both:
   - `python/pyproject.toml`
   - `python/dynamic_rounding/__init__.py` (header and `__version__`)
2. Commit: `git commit -m "Python: Release v0.x.x"`
3. Tag: `git tag py-v0.x.x`
4. Build and upload:
   ```bash
   cd python
   rm -rf dist build *.egg-info
   python3 -m build
   twine upload dist/*
   ```
5. Push: `git push && git push --tags`
6. Create GitHub Release from tag (optional)

## Changelog

Each implementation has its own changelog:
- `js/CHANGELOG.md`
- Python: No separate changelog yet (use GitHub Releases or add `python/CHANGELOG.md` when needed)

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## File Naming Convention

- ALL CAPS for standard repo metadata: README, LICENSE, CHANGELOG, CONTRIBUTING, MAINTAINERS
- lowercase for everything else