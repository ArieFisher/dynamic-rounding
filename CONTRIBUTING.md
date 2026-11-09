# Contributing

Thanks for your interest in contributing to DynamicRounding.

[AGENTS.md](AGENTS.md) holds the conventions for every contributor, person or agent: branches, pull requests, file hygiene, writing style, vocabulary, code style, and review. This guide holds what is specific to this repository: its setup and its commit checks.

## Setup

Enable the repository hooks once per clone: `git config core.hooksPath .githooks`. The `pre-commit` hook then runs the two commit checks below on what you stage, and the `Repo hygiene` workflow runs both again on every pull request.

`docs/private/` is git-ignored, for scratch work that has to sit inside the repository.

## Commit checks

### Adding files

`scripts/check-files.sh` rejects three things: a file name on its deny list, a path outside its allowed folders and root files, and contents that match a credential pattern. The policy block at the top of the script holds each list. Run it yourself any time with `scripts/check-files.sh --staged`, or audit the whole tree with `scripts/check-files.sh --tracked`.

A new root markdown file also needs a negation in `.gitignore`, which ignores every other markdown file at the root.

The policy block is the whole gate, so a bad edit there makes it pass everything. `bash scripts/check-files-test.sh` plants a violation of each rule in a scratch repository and requires the gate to catch it. Run it after any policy change; `Repo hygiene` runs it too.

### Vocabulary check

`scripts/check-vocab.sh` reads the Pattern column of the Retired synonyms table in [docs/vocabulary.md](docs/vocabulary.md), and blocks a commit or a pull request when an added line matches a pattern. On a pull request it reads every line the branch added since it left `main`. The script checks:

- only added lines, so an old line that still holds a retired synonym never blocks an unrelated change
- only markdown files
- no historical record, and not the vocabulary itself, which has to spell out the retired synonyms. The exempt-path list near the top of the script holds the exact paths.

A blocked commit prints the file, the pattern it matched, and the line. Replace the retired synonym with the term in the table's Say column. Run the check yourself any time with `scripts/check-vocab.sh --staged`, or on a whole branch with `scripts/check-vocab.sh --range origin/main HEAD`. It exits 0 when every added line is clean, 1 when it blocks a line, and 2 when it cannot run the check at all. The vocabulary states how a new table row takes effect and how to write its pattern.

The table is the whole policy, so a damaged table would let every line through and look the same as clean prose. To stop that, the script tests its pattern list before it reads any change, and exits 2 when it cannot read the table, when the table yields no patterns, when a pattern is not a valid expression, or when no pattern matches a fixed sentence that holds a known retired synonym. `bash scripts/check-vocab-test.sh` plants retired synonyms, clean prose, exempt files, and damaged tables in a scratch repository and requires the right result for each. Run it after any change to the table or the script; `Repo hygiene` runs it too.

## Questions

Open an issue. Happy to help.
