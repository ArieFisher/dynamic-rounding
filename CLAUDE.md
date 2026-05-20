# Project conventions for Claude

## Versioning
- Bump at least the patch version (`x.y.Z`) on every commit.
- Keep these three in sync on each bump:
  - `chrome-extension/manifest.json` `version` field
  - `chrome-extension/content.js` header `Version:` comment
  - `chrome-extension/background.js` header `Version:` comment

## Authorship
- Commit author/committer: `ArieFisher <ariefisher1@gmail.com>`.
- Never list Claude as author or contributor.
- Never include "claude" in branch names; use `feature/<short-name>` etc.
