#!/usr/bin/env bash
#
# Self-test for scripts/check-vocab.sh.
#
# The vocabulary gate's whole policy sits in one editable block, and a broken
# block fails open. These cases plant a retired synonym and require the gate
# to catch it, plant clean and exempt content and require the gate to pass it.
#
# Every case runs in a scratch git repository. Run with no arguments; exits 0
# when the gate behaves and 1 when any case fails.
#
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
GATE="$here/check-vocab.sh"

[ -x "$GATE" ] || { echo "no executable gate at $GATE" >&2; exit 2; }

passed=0
failed=0
scratch_dirs=()

cleanup() {
  local dir
  for dir in ${scratch_dirs+"${scratch_dirs[@]}"}; do
    rm -rf "$dir"
  done
}
trap cleanup EXIT

scratch_repo() {
  local dir
  dir=$(mktemp -d "${TMPDIR:-/tmp}/check-vocab-test.XXXXXX")
  scratch_dirs+=("$dir")

  git init -q "$dir"
  git -C "$dir" config user.email gate-test@example.invalid
  git -C "$dir" config user.name 'gate test'
  git -C "$dir" config commit.gpgsign false

  mkdir -p "$dir/scripts" "$dir/docs/sprint-logs"
  cp "$GATE" "$dir/scripts/check-vocab.sh"
  printf '# scratch\n' > "$dir/README.md"
  git -C "$dir" add README.md scripts/check-vocab.sh
  git -C "$dir" commit -qm seed

  printf '%s\n' "$dir"
}

record() {
  if [ "$1" = pass ]; then
    printf '  ok        %s\n' "$2"; passed=$((passed + 1))
  else
    printf '  FAILED    %s\n' "$2" >&2; failed=$((failed + 1))
  fi
}

# expect_block <case name> <relative path> <content>
expect_block() {
  local name="$1" file="$2" content="$3" dir
  dir=$(scratch_repo)
  mkdir -p "$dir/$(dirname "$file")"
  printf '%s\n' "$content" > "$dir/$file"
  git -C "$dir" add "$file"
  if (cd "$dir" && scripts/check-vocab.sh --staged >/dev/null 2>&1); then
    record fail "$name (gate passed a planted violation)"
  else
    record pass "$name"
  fi
}

# expect_pass <case name> <relative path> <content>
expect_pass() {
  local name="$1" file="$2" content="$3" dir
  dir=$(scratch_repo)
  mkdir -p "$dir/$(dirname "$file")"
  printf '%s\n' "$content" > "$dir/$file"
  git -C "$dir" add "$file"
  if (cd "$dir" && scripts/check-vocab.sh --staged >/dev/null 2>&1); then
    record pass "$name"
  else
    record fail "$name (gate blocked clean content)"
  fi
}

echo "check-vocab self-test"

expect_block "retired synonym in a living doc"      docs/design.md   'The table toggle turns rounding on.'
expect_block "narrowed sense caught"                README.md        'This rounds the entire range at once.'
expect_block "word-boundary pattern caught"         docs/notes.md    'Click the pill to toggle.'
expect_pass  "canonical prose passes"               docs/design.md   'The pillbox turns rounding on for the dataset.'
expect_pass  "allowed sense passes"                 docs/design.md   'A blank range expression covers the whole table; offsets outside the range throw.'
expect_pass  "record path exempt"                   docs/sprint-logs/old-log.md 'The table toggle was renamed later.'
expect_pass  "non-markdown file exempt"             scripts/notes.txt 'the table toggle lives here'

# --range mode: a committed violation between two revisions is caught.
dir=$(scratch_repo)
base=$(git -C "$dir" rev-parse HEAD)
printf 'The undo state is kept.\n' > "$dir/docs/design.md"
git -C "$dir" add docs/design.md
git -C "$dir" commit -qm violation
head=$(git -C "$dir" rev-parse HEAD)
if (cd "$dir" && scripts/check-vocab.sh --range "$base" "$head" >/dev/null 2>&1); then
  record fail "--range catches a committed violation (gate passed it)"
else
  record pass "--range catches a committed violation"
fi

echo "check-vocab self-test: $passed passed, $failed failed"
[ "$failed" -eq 0 ] || exit 1
exit 0
