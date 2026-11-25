#!/usr/bin/env bash
#
# Gate on files entering the repository.
#
# Two checks: the file belongs to this project, and it carries no credentials.
# Nothing here checks file size — that is a repository-weight question, not a
# relevancy one, and it is tracked separately.
#
# Modes:
#   --staged            check what is staged for the next commit (pre-commit hook)
#   --range BASE HEAD   check files changed between two revisions (CI)
#   --tracked           audit every file committed in HEAD (manual sweep)
#
set -uo pipefail

# --------------------------------------------------------------------------
# Policy
# --------------------------------------------------------------------------

# Directories a new file may live in. A path under none of these is rejected,
# which is what stops a stray report or scratch doc at the repository root.
ALLOWED_DIRS=(
  chrome-extension/
  claude-code-plugin/
  .claude-plugin/
  js/
  python/
  docs/
  scripts/
  .github/
  .githooks/
  .agent/rules/
  .agent/skills/
  .claude/agents/
)

# Files that may sit at the repository root, where nothing else may.
ALLOWED_ROOT_FILES=(
  README.md
  CLAUDE.md
  AGENTS.md
  CONTRIBUTING.md
  MAINTAINERS.md
  LICENSE
  .gitignore
)

# Names that never belong, wherever they appear. The first two entries are the
# species that already reached main once: a tool's scan output.
DENY_GLOBS=(
  '*-baseline.md'
  '*_baseline.md'
  '*-report.md'
  '*_report.md'
  '.env'
  '.env.*'
  '*.env'
  '*.pem'
  '*.key'
  '*.p12'
  '*.pfx'
  'id_rsa*'
  '.DS_Store'
  '*.log'
)

SECRET_REGEX='sk-ant-|ghp_|gho_|ghu_|ghs_|github_pat_|AKIA[0-9A-Z]{16}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{35}'

# Files exempt from the credential scan because describing a credential pattern
# is their job. Keep this list to files whose whole purpose is the pattern.
SECRET_SCAN_EXEMPT=(
  'scripts/check-files.sh'
)

# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

failures=0

fail() {
  printf '  BLOCKED  %s\n           %s\n' "$1" "$2" >&2
  failures=$((failures + 1))
}

path_is_allowed() {
  local file=$1 dir root

  for dir in "${ALLOWED_DIRS[@]}"; do
    case $file in "$dir"*) return 0 ;; esac
  done

  for root in "${ALLOWED_ROOT_FILES[@]}"; do
    [ "$file" = "$root" ] && return 0
  done

  return 1
}

name_is_denied() {
  local base=${1##*/} glob
  for glob in "${DENY_GLOBS[@]}"; do
    # shellcheck disable=SC2254 -- glob is a pattern on purpose
    case $base in $glob) return 0 ;; esac
  done
  return 1
}

# A gate that cannot read what it checks must stop, not pass: exit 0 on a git
# failure would look the same as a clean change.
cannot_inspect() {
  echo "check-files: $1 — refusing to pass without inspecting" >&2
  exit 2
}

# The deny list and the credential scan apply to every file the change touches.
# The path rule applies only to added, copied, and renamed files (status A, C,
# or R), so an edit to a file that is already tracked does not need a move.
check_file() {
  local file=$1 rev=$2 status=$3

  if name_is_denied "$file"; then
    fail "$file" "name matches a denied pattern; this file class does not belong in the repo"
    return
  fi

  if [ "$status" != M ] && ! path_is_allowed "$file"; then
    fail "$file" "path is outside every project directory; move it under one, or add it to ALLOWED_DIRS / ALLOWED_ROOT_FILES in scripts/check-files.sh"
    return
  fi

  local exempt
  for exempt in "${SECRET_SCAN_EXEMPT[@]}"; do
    [ "$file" = "$exempt" ] && return
  done

  local blob="$rev:$file"
  git -C "$repo_root" cat-file -e "$blob" 2>/dev/null || cannot_inspect "cannot read $blob"
  # Process substitution, not a pipe: under pipefail, grep -q closing the pipe
  # early would turn a match into a failed pipeline and hide the credential.
  if grep -IqE "$SECRET_REGEX" < <(git -C "$repo_root" cat-file blob "$blob"); then
    fail "$file" "contents match a credential pattern"
  fi
}

# --------------------------------------------------------------------------
# Entry
# --------------------------------------------------------------------------

repo_root=$(git rev-parse --show-toplevel) || cannot_inspect "not inside a git repository"

# Each line of $entries is "<status><TAB><path>"; a rename's or copy's line also
# holds the old path, and the last field is the new one. Every git call runs
# from the repository root, so the paths do not depend on the current folder.
case ${1:-} in
  --staged)
    rev=""
    entries=$(git -C "$repo_root" diff --cached --name-status --diff-filter=ACMR) \
      || cannot_inspect "git diff --cached failed"
    label="staged for commit"
    ;;
  --range)
    [ $# -eq 3 ] || { echo "usage: $0 --range BASE HEAD" >&2; exit 2; }
    for revision in "$2" "$3"; do
      git -C "$repo_root" rev-parse --verify --quiet "$revision^{commit}" > /dev/null \
        || cannot_inspect "revision '$revision' does not resolve to a commit"
    done
    rev=$3
    entries=$(git -C "$repo_root" diff --name-status --diff-filter=ACMR "$2" "$3") \
      || cannot_inspect "git diff $2 $3 failed"
    label="changed between $2 and $3"
    ;;
  --tracked)
    # List HEAD, not the index, because each file's contents are read from HEAD.
    rev="HEAD"
    entries=$(git -C "$repo_root" ls-tree -r --name-only HEAD | awk '{ print "A\t" $0 }') \
      || cannot_inspect "git ls-tree HEAD failed"
    label="tracked in HEAD"
    ;;
  *)
    echo "usage: $0 --staged | --range BASE HEAD | --tracked" >&2
    exit 2
    ;;
esac

[ -z "$entries" ] && exit 0

while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  status=${entry:0:1}
  file=${entry##*$'\t'}
  check_file "$file" "$rev" "$status"
done <<< "$entries"

if [ "$failures" -gt 0 ]; then
  printf '\n%d file(s) %s did not pass the repository file gate.\n' "$failures" "$label" >&2
  printf 'Fix the paths above, or amend the policy block in scripts/check-files.sh if the rule is wrong.\n' >&2
  exit 1
fi

exit 0
