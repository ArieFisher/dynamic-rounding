#!/usr/bin/env bash
#
# Gate new prose on retired synonyms.
#
# docs/vocabulary.md retires one synonym per concept; this check stops a
# retired synonym from entering a living doc's new prose. It reads only the
# ADDED lines of markdown files, so historical text is never re-litigated,
# and it skips the records (sprint plans, sprint logs, research notes, the
# changelog) plus the vocabulary itself, which must name the retired words.
#
# Modes:
#   --staged            check lines staged for the next commit (pre-commit hook)
#   --range BASE HEAD   check lines added between two revisions (CI)
#
set -uo pipefail

# --------------------------------------------------------------------------
# Policy
# --------------------------------------------------------------------------

# One pattern per retired synonym, narrowed to its retired sense where the
# bare word has legitimate other senses. Keep in step with the Retired
# synonyms table in docs/vocabulary.md.
RETIRED_PATTERNS=(
  'table toggle'        # say: pillbox
  '\bpill\b'            # say: pillbox
  'undo state'          # say: originals
  'preview band'        # say: lens preview
  'proactive scan'      # say: load-time scan
  'orphaned handle'     # say: dead handle
  '\bfused\b'           # say: coupled
  'what it buys'        # say: benefit
  'dead code'           # say: never-used code
  'selected table'      # say: active table (or bound table)
  'stuck table'         # say: locked / unrestorable table
  '\bapp store\b'       # say: application model
  'entire range|whole range|input range'  # say: dataset ("range expression" and cell ranges keep their names)
)

# Paths the sweep never touches: point-in-time records and the canon itself.
EXEMPT_PATHS='^docs/sprint-logs/|^docs/sprint-plans/|^docs/research/|^js/CHANGELOG\.md$|^docs/vocabulary\.md$'

# --------------------------------------------------------------------------
# Check
# --------------------------------------------------------------------------

failures=0

check_added_lines() {
  local file="$1"
  local diff_cmd=("${@:2}")

  [[ "$file" == *.md ]] || return 0
  if printf '%s' "$file" | grep -qE "$EXEMPT_PATHS"; then return 0; fi

  local added
  added=$("${diff_cmd[@]}" -- "$file" | grep '^+' | grep -v '^+++' || true)
  [[ -n "$added" ]] || return 0

  for pattern in "${RETIRED_PATTERNS[@]}"; do
    local hits
    hits=$(printf '%s\n' "$added" | grep -inE "$pattern" || true)
    if [[ -n "$hits" ]]; then
      printf '  BLOCKED  %s\n           retired synonym /%s/ in new prose — see docs/vocabulary.md:\n' "$file" "$pattern" >&2
      printf '%s\n' "$hits" | sed 's/^/           /' >&2
      failures=$((failures + 1))
    fi
  done
}

mode="${1:-}"
case "$mode" in
  --staged)
    while IFS= read -r file; do
      check_added_lines "$file" git diff --cached --unified=0
    done < <(git diff --cached --name-only --diff-filter=AM)
    ;;
  --range)
    base="${2:?usage: check-vocab.sh --range BASE HEAD}"
    head="${3:?usage: check-vocab.sh --range BASE HEAD}"
    while IFS= read -r file; do
      check_added_lines "$file" git diff --unified=0 "$base" "$head"
    done < <(git diff --name-only --diff-filter=AM "$base" "$head")
    ;;
  *)
    echo "usage: check-vocab.sh --staged | --range BASE HEAD" >&2
    exit 2
    ;;
esac

if (( failures > 0 )); then
  echo "check-vocab: $failures file(s) blocked. Replace the retired synonym with its canonical term (docs/vocabulary.md, Retired synonyms)." >&2
  exit 1
fi
exit 0
