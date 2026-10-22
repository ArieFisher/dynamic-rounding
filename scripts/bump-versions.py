#!/usr/bin/env python3
"""Raise the version of each package a merged pull request touched.

Usage: bump-versions.py MINOR < changed-files

  MINOR          "true" raises the minor version and resets the patch to 0;
                 any other value raises the patch.
  changed-files  the paths the merged pull request touched, one per line.

Run from the repository root. Prints each version file it wrote, one per line,
for the workflow to stage. Exits non-zero when a version file is missing, holds
no version line, or no longer parses after the write.
"""

import json
import pathlib
import re
import sys
import tomllib

# One row per package: the directory a change must touch, the version file,
# the pattern whose first group is the version, and the parser the written
# file must still pass.
PACKAGES = (
    ("python/", "python/pyproject.toml",
     r'^version\s*=\s*"(\d+(?:\.\d+)*)"', tomllib.loads),
    ("chrome-extension/", "chrome-extension/manifest.json",
     r'^\s*"version"\s*:\s*"(\d+(?:\.\d+)*)"', json.loads),
)


def bump(version, minor):
    # Pad to three parts; a fourth part drops on every bump.
    parts = [int(x) for x in version.split(".")]
    parts += [0] * (3 - len(parts))
    if minor:
        parts[1] += 1
        parts[2] = 0
    else:
        parts[2] += 1
    return ".".join(str(x) for x in parts[:3])


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    minor = sys.argv[1] == "true"
    changed = [line.strip() for line in sys.stdin if line.strip()]

    for prefix, name, pattern, parse in PACKAGES:
        if not any(path.startswith(prefix) for path in changed):
            continue
        path = pathlib.Path(name)
        if not path.exists():
            sys.exit(f"{name}: missing")
        text = path.read_text()
        match = re.search(pattern, text, re.MULTILINE)
        if not match:
            sys.exit(f"{name}: no version line")
        new = bump(match.group(1), minor)
        text = text[:match.start(1)] + new + text[match.end(1):]
        try:
            parse(text)
        except Exception as exc:
            sys.exit(f"{name} no longer parses after the version bump: {exc}")
        path.write_text(text)
        print(f"{name}: bumped to {new}", file=sys.stderr)
        print(name)


if __name__ == "__main__":
    main()
