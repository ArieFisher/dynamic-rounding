#!/usr/bin/env python3
"""Raise the version of each package a merged pull request touched.

Usage: bump-versions.py MINOR < changed-files

  MINOR          "true" raises the minor version and resets the patch to 0;
                 any other value raises the patch.
  changed-files  the paths the merged pull request touched, one per line.

Run from the repository root. Prints each file it wrote, one per line,
for the workflow to stage. Exits non-zero when a version file is missing, holds
no version line, or no longer parses after the write, when a build fails, and
when a changelog is missing or holds no single Unreleased heading.
"""

import datetime
import json
import pathlib
import re
import subprocess
import sys
import tomllib

# One row per package: the directory a change must touch, the version file,
# the pattern whose first group is the version, the parser the written file
# must still pass (None for a file with no parser), the changelog whose
# Unreleased heading becomes the new version's heading (None for no changelog),
# and the build that copies the version file into a generated file (None for
# no build). A build prints each file it wrote, one per line.
PACKAGES = (
    ("python/", "python/pyproject.toml",
     r'^version\s*=\s*"(\d+(?:\.\d+)*)"', tomllib.loads, None, None),
    ("chrome-extension/", "chrome-extension/manifest.json",
     r'^\s*"version"\s*:\s*"(\d+(?:\.\d+)*)"', json.loads, None, None),
    ("js/", "js/src/entry.js",
     r'^ \* \[VERSION\] (\d+(?:\.\d+)*)$', None, "js/CHANGELOG.md",
     ("node", "scripts/build-sheets.js")),
)

UNRELEASED = "## [Unreleased]\n"


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


def release(name, version):
    # Turn the Unreleased heading into the new version's heading, and open a
    # new empty Unreleased section above it.
    path = pathlib.Path(name)
    if not path.exists():
        sys.exit(f"{name}: missing")
    text = path.read_text()
    if text.count(UNRELEASED) != 1:
        sys.exit(f"{name}: no single {UNRELEASED.strip()} heading")
    date = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    path.write_text(text.replace(
        UNRELEASED, f"{UNRELEASED}\n## [{version}] - {date}\n"))


def run_build(name, command):
    # Run the build that copies the new version into its generated file, and
    # return the files it wrote.
    try:
        result = subprocess.run(command, capture_output=True, text=True)
    except OSError as exc:
        sys.exit(f"{name}: the build after the version bump did not start: {exc}")
    if result.returncode != 0:
        sys.exit(f"{name}: the build after the version bump failed: "
                 f"{result.stderr.strip()}")
    return result.stdout.splitlines()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    minor = sys.argv[1] == "true"
    changed = [line.strip() for line in sys.stdin if line.strip()]

    for prefix, name, pattern, parse, changelog, build in PACKAGES:
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
            if parse:
                parse(text)
        except Exception as exc:
            sys.exit(f"{name} no longer parses after the version bump: {exc}")
        path.write_text(text)
        print(f"{name}: bumped to {new}", file=sys.stderr)
        print(name)
        if build:
            for written in run_build(name, build):
                print(written)
        if changelog:
            release(changelog, new)
            print(changelog)


if __name__ == "__main__":
    main()
