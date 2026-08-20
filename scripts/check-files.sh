#!/usr/bin/env bash
#
# Gate on files entering the repository.
#
# Two checks: the file belongs to this project, and it carries no credentials.
# Nothing here judges file size — that is a repo-weight question, not a
# relevancy one, and it is tracked separately.
#
# Modes:
#   --staged            check what is staged for the next commit (pre-commit hook)
#   --range BASE HEAD   check files added or renamed between two revisions (CI)
#   --tracked           audit every tracked file (manual sweep)
#
set -uo pipefail

# --------------------------------------------------------------------------
# Policy
# --------------------------------------------------------------------------

# Directories a new file may live in. A path under none of these is rejected,
# which is what stops a stray report or scratch doc at the repo root.
ALLOWED_DIRS=(
  chrome-extension/
  js/
  python/
  docs/
  scripts/
  .github/
  .githooks/
  .agent/rules/
  .agent/skills/
)

# Files that may sit at the repo root, where nothing else may.
ALLOWED_ROOT_FILES=(
  README.md
  CLAUDE.md
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

check_file() {
  local file=$1 rev=$2

  if name_is_denied "$file"; then
    fail "$file" "name matches a denied pattern; this file class does not belong in the repo"
    return
  fi

  if ! path_is_allowed "$file"; then
    fail "$file" "path is outside every project directory; move it under one, or add it to ALLOWED_DIRS / ALLOWED_ROOT_FILES in scripts/check-files.sh"
    return
  fi

  local exempt
  for exempt in "${SECRET_SCAN_EXEMPT[@]}"; do
    [ "$file" = "$exempt" ] && return
  done

  if git show "$rev:$file" 2>/dev/null | grep -IqE "$SECRET_REGEX"; then
    fail "$file" "contents match a credential pattern"
  fi
}

# --------------------------------------------------------------------------
# Entry
# --------------------------------------------------------------------------

case ${1:-} in
  --staged)
    rev=""
    files=$(git diff --cached --name-only --diff-filter=ACR)
    label="staged for commit"
    ;;
  --range)
    [ $# -eq 3 ] || { echo "usage: $0 --range BASE HEAD" >&2; exit 2; }
    rev=$3
    files=$(git diff --name-only --diff-filter=ACR "$2" "$3")
    label="added between $2 and $3"
    ;;
  --tracked)
    rev="HEAD"
    files=$(git ls-files)
    label="tracked in HEAD"
    ;;
  *)
    echo "usage: $0 --staged | --range BASE HEAD | --tracked" >&2
    exit 2
    ;;
esac

[ -z "$files" ] && exit 0

while IFS= read -r file; do
  [ -n "$file" ] && check_file "$file" "$rev"
done <<< "$files"

if [ "$failures" -gt 0 ]; then
  printf '\n%d file(s) %s did not pass the repository file gate.\n' "$failures" "$label" >&2
  printf 'Fix the paths above, or amend the policy block in scripts/check-files.sh if the rule is wrong.\n' >&2
  exit 1
fi

exit 0
