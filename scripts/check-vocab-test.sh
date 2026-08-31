#!/usr/bin/env bash
#
# Self-test for scripts/check-vocab.sh.
#
# The vocabulary gate's whole policy sits in one editable block. These cases
# plant a retired synonym and require the gate to catch it, plant clean and
# exempt content and require the gate to pass it, and damage the policy block
# itself and require the gate to refuse. The gate's preflight is what makes
# that last group possible: a broken block used to read as clean prose.
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

# expect_refusal <case name> <replacement RETIRED_PATTERNS line> <message>
# Damages the policy block, stages clean prose, and requires the gate to refuse
# with exit 2. A damaged policy that exits 0 is the failure these cases exist
# to catch: the gate would approve every commit while seeing nothing.
#
# The message argument is what keeps the cases independent. Every preflight
# branch refuses with the same exit code, so a case that checked only the code
# would pass when its own branch was deleted and a later branch caught the
# damage instead. Matching the branch's own words pins each case to one branch.
#
# The replacement travels through the environment, not through `awk -v`, which
# expands escape sequences: a fixture written with \b would reach awk as a
# backspace and quietly stop matching anything.
expect_refusal() {
  local name="$1" replacement="$2" message="$3" dir status output
  dir=$(scratch_repo)
  repl="$replacement" awk '
    /^RETIRED_PATTERNS=\(/ { print ENVIRON["repl"]; skip = 1; next }
    skip && /^\)/          { skip = 0; next }
    skip                   { next }
                           { print }
  ' "$GATE" > "$dir/scripts/check-vocab.sh"
  printf 'Clean prose about the pillbox.\n' > "$dir/docs/design.md"
  git -C "$dir" add docs/design.md
  output=$( (cd "$dir" && bash scripts/check-vocab.sh --staged 2>&1 >/dev/null) )
  status=$?
  if [ "$status" -ne 2 ]; then
    record fail "$name (gate exited $status instead of refusing)"
  elif ! printf '%s' "$output" | grep -qF "$message"; then
    record fail "$name (refused, but not for its own reason: $output)"
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

# Collocations. Each of these four words is banned only in the phrases that
# can carry the retired sense, so every case comes in a pair: the phrase is
# caught, the word's legitimate sense passes.
expect_block "collocation: base as step"            docs/design.md   'Each value snaps to the nearest base.'
expect_pass  "base in its own sense passes"         docs/design.md   'Rebase the topic onto the base branch before review.'
expect_pass  "a longer word is not a match"         docs/design.md   'Measure the pillbox against the nearest baseline.'
expect_pass  "a word ending in the token passes"    docs/design.md   'A stable toggle order keeps the tests green.'
expect_block "an inflected synonym is caught"       docs/design.md   'The table toggles were renamed.'
expect_block "a prefixed synonym is caught"         docs/design.md   'The unselected table keeps its own values.'
expect_block "collocation: store as app model"      docs/design.md   'The panel store holds every table.'
expect_pass  "store in its own sense passes"        docs/design.md   'Store the originals before rounding.'
expect_block "collocation: linked as bound"         docs/design.md   'The sidebar shows the linked table.'
expect_pass  "linked in its own sense passes"       docs/design.md   'The handles sit in a linked list.'
expect_block "collocation: tied as coupled"         docs/design.md   'The switch is tied together with the pillbox.'
expect_pass  "tied in its own sense passes"         docs/design.md   'The release cadence is tied to the academic calendar.'

# Preflight. The gate's own policy block is the one input nothing else checks,
# so each way of breaking it must produce a refusal, not a clean bill.
#
# The malformed fixture keeps a valid pattern that matches the canary. Without
# it the case passes for the wrong reason: a lone bad pattern matches nothing,
# the canary check fires, and the gate refuses whether or not it can tell a
# broken expression from an absent one. The valid pattern satisfies the canary
# so only the malformed check is left to produce the refusal.
expect_refusal "empty pattern list refuses"          'RETIRED_PATTERNS=()' \
               'the retired-synonym list is empty'
expect_refusal "malformed pattern refuses"           "RETIRED_PATTERNS=( '\btable toggle' 'toggle(' )" \
               'is not a valid expression'
expect_refusal "list that misses the canary refuses" "RETIRED_PATTERNS=( 'a-phrase-no-doc-contains' )" \
               'no pattern matches the canary'

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
