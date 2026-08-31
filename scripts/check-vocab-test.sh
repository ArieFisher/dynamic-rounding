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
  dir=$(mktemp -d "${TMPDIR:-/tmp}/check-vocab-test.XXXXXX") || exit 2
  [ -n "$dir" ] || exit 2
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

# A rename-plus-edit must not slip past the filter: git reports it as R, and a
# renamed living doc is the edit most likely to reintroduce old vocabulary.
dir=$(scratch_repo)
printf 'Clean prose about the pillbox.\n' > "$dir/docs/design.md"
git -C "$dir" add docs/design.md
git -C "$dir" commit -qm seed-doc
git -C "$dir" mv docs/design.md docs/renamed.md
printf 'Clean prose about the pillbox.\nThe table toggle turns rounding on.\n' > "$dir/docs/renamed.md"
git -C "$dir" add docs/renamed.md
if (cd "$dir" && scripts/check-vocab.sh --staged >/dev/null 2>&1); then
  record fail "rename-plus-edit is caught (gate passed it)"
else
  record pass "rename-plus-edit is caught"
fi

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

# --range with only the base branch containing a synonym: lines this branch
# never wrote must not block it (three-dot semantics).
dir=$(scratch_repo)
printf 'The table toggle turns rounding on.\n' > "$dir/docs/design.md"
git -C "$dir" add docs/design.md
git -C "$dir" commit -qm base-owns-synonym
git -C "$dir" checkout -qb topic
printf 'A clean line about the pillbox.\n' > "$dir/docs/other.md"
git -C "$dir" add docs/other.md
git -C "$dir" commit -qm clean-topic
git -C "$dir" checkout -q -
printf 'The pillbox turns rounding on.\n' > "$dir/docs/design.md"
git -C "$dir" add docs/design.md
git -C "$dir" commit -qm base-cleans-itself
mainhead=$(git -C "$dir" rev-parse HEAD)
if (cd "$dir" && scripts/check-vocab.sh --range "$mainhead" topic >/dev/null 2>&1); then
  record pass "--range ignores base-branch lines the topic never wrote"
else
  record fail "--range ignores base-branch lines the topic never wrote (gate blocked them)"
fi

# A revision git cannot resolve must fail the gate, not pass it.
dir=$(scratch_repo)
if (cd "$dir" && scripts/check-vocab.sh --range deadbeef HEAD >/dev/null 2>&1); then
  record fail "unresolvable revision fails closed (gate passed without inspecting)"
else
  record pass "unresolvable revision fails closed"
fi

echo "check-vocab self-test: $passed passed, $failed failed"
[ "$failed" -eq 0 ] || exit 1
exit 0
