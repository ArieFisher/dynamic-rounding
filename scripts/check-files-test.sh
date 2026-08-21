#!/usr/bin/env bash
#
# Self-test for scripts/check-files.sh.
#
# The gate is the only thing between a stray file and a public commit, and its
# whole policy sits in one editable block. A broken policy block fails open:
# the gate exits 0 on everything and both the hook and CI report green. These
# cases plant a violation of each rule and require the gate to catch it.
#
# Every case runs in a scratch git repository, so nothing touches the real
# index or working tree. Run it with no arguments; it exits 0 when the gate
# behaves and 1 when any case fails.
#
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
GATE="$here/check-files.sh"

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

# --------------------------------------------------------------------------
# Harness
# --------------------------------------------------------------------------

# A scratch repository holding a copy of the gate at its real path, plus one
# seed commit so --range has a base to diff against.
scratch_repo() {
  local dir
  dir=$(mktemp -d "${TMPDIR:-/tmp}/check-files-test.XXXXXX")
  scratch_dirs+=("$dir")

  git init -q "$dir"
  git -C "$dir" config user.email gate-test@example.invalid
  git -C "$dir" config user.name 'gate test'
  git -C "$dir" config commit.gpgsign false

  mkdir -p "$dir/scripts" "$dir/docs"
  cp "$GATE" "$dir/scripts/check-files.sh"
  printf '# scratch\n' > "$dir/README.md"
  printf '# design\n' > "$dir/docs/design.md"
  git -C "$dir" add README.md docs/design.md scripts/check-files.sh
  git -C "$dir" commit -qm seed

  printf '%s\n' "$dir"
}

record_pass() {
  printf '  ok        %s\n' "$1"
  passed=$((passed + 1))
}

record_fail() {
  printf '  FAILED    %s\n           %s\n' "$1" "$2" >&2
  failed=$((failed + 1))
}

run_gate() {
  local repo=$1; shift
  ( cd "$repo" && bash scripts/check-files.sh "$@" ) 2>&1
}

# assert_blocked NAME REPO OFFENDER [gate args...]
# The gate must exit 1 and name the offending path in its output.
assert_blocked() {
  local name=$1 repo=$2 offender=$3; shift 3
  local out status
  out=$(run_gate "$repo" "$@")
  status=$?

  if [ "$status" -ne 1 ]; then
    record_fail "$name" "gate exited $status, expected 1 (fails open on $offender)"
    return
  fi
  case $out in
    *"$offender"*) record_pass "$name" ;;
    *) record_fail "$name" "gate blocked, but its report never names $offender" ;;
  esac
}

# assert_passes NAME REPO [gate args...]
assert_passes() {
  local name=$1 repo=$2; shift 2
  local out status
  out=$(run_gate "$repo" "$@")
  status=$?

  if [ "$status" -eq 0 ]; then
    record_pass "$name"
  else
    record_fail "$name" "gate exited $status on a legitimate file; output: $out"
  fi
}

# assert_usage NAME REPO [gate args...]
assert_usage() {
  local name=$1 repo=$2; shift 2
  local status
  run_gate "$repo" "$@" >/dev/null
  status=$?

  if [ "$status" -eq 2 ]; then
    record_pass "$name"
  else
    record_fail "$name" "gate exited $status on a misuse, expected 2"
  fi
}

# A credential the gate must catch, assembled at runtime so this file does not
# carry the literal pattern and need an exemption of its own.
planted_secret() {
  printf 'token = "gh%s%s"\n' 'p_' '0123456789abcdefghijklmnopqrstuvwxyz'
}

# The policy lists, read out of the gate so the cases track edits to it.
policy_array() {
  awk -v name="$1" '
    $0 ~ "^" name "=\\(" { inside = 1; next }
    inside && /^\)/       { exit }
    inside {
      gsub(/#.*/, ""); gsub(/^[ \t]+|[ \t]+$/, ""); gsub(/^'\''|'\''$/, "")
      if (length($0)) print
    }
  ' "$GATE"
}

# --------------------------------------------------------------------------
# Cases
# --------------------------------------------------------------------------

echo 'check-files.sh self-test'

# A stray at the repo root is rejected on path. This is the species that
# already reached main once.
repo=$(scratch_repo)
printf 'notes\n' > "$repo/security-audit.md"
git -C "$repo" add security-audit.md
assert_blocked 'root stray rejected on path' "$repo" 'security-audit.md' --staged

# A denied name is rejected even under an allowed directory.
repo=$(scratch_repo)
printf 'scan output\n' > "$repo/docs/toolchain-report.md"
git -C "$repo" add docs/toolchain-report.md
assert_blocked 'denied name rejected under an allowed dir' "$repo" 'docs/toolchain-report.md' --staged

# Denied names are matched on the basename, at any depth.
repo=$(scratch_repo)
mkdir -p "$repo/docs/research"
printf 'scan output\n' > "$repo/docs/research/nested_baseline.md"
git -C "$repo" add docs/research/nested_baseline.md
assert_blocked 'denied name rejected at depth' "$repo" 'docs/research/nested_baseline.md' --staged

# A credential in the contents is rejected even where the path and name pass.
repo=$(scratch_repo)
planted_secret > "$repo/docs/setup.md"
git -C "$repo" add docs/setup.md
assert_blocked 'credential rejected on contents' "$repo" 'docs/setup.md' --staged

# The secret scan reads the staged blob, not the working tree.
repo=$(scratch_repo)
planted_secret > "$repo/docs/setup.md"
git -C "$repo" add docs/setup.md
printf 'clean now\n' > "$repo/docs/setup.md"
assert_blocked 'credential rejected from the staged blob' "$repo" 'docs/setup.md' --staged

# The exemption covers the gate itself, which carries the patterns by trade.
repo=$(scratch_repo)
git -C "$repo" -c core.fileMode=false add scripts/check-files.sh
printf '\n# touched\n' >> "$repo/scripts/check-files.sh"
git -C "$repo" add scripts/check-files.sh
assert_passes 'exempt file passes the secret scan' "$repo" --staged

# The exemption is one path, not a neighbourhood: the same content elsewhere
# under scripts/ is still rejected.
repo=$(scratch_repo)
cp "$GATE" "$repo/scripts/check-files-copy.sh"
git -C "$repo" add scripts/check-files-copy.sh
assert_blocked 'exemption does not extend to a neighbour' "$repo" 'scripts/check-files-copy.sh' --staged

# A legitimate file under every entry in ALLOWED_DIRS passes, in one run.
repo=$(scratch_repo)
staged=()
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  mkdir -p "$repo/$dir"
  printf 'content\n' > "$repo/${dir}sample.md"
  staged+=("${dir}sample.md")
done < <(policy_array ALLOWED_DIRS)
if [ "${#staged[@]}" -eq 0 ]; then
  record_fail 'allowed dirs parsed from policy' 'ALLOWED_DIRS read out of the gate is empty'
else
  git -C "$repo" add -- "${staged[@]}"
  assert_passes "legitimate file passes under each of ${#staged[@]} allowed dirs" "$repo" --staged
fi

# Every entry in ALLOWED_ROOT_FILES passes at the root.
repo=$(scratch_repo)
staged=()
while IFS= read -r root; do
  [ -n "$root" ] || continue
  printf 'content\n' > "$repo/$root"
  staged+=("$root")
done < <(policy_array ALLOWED_ROOT_FILES)
if [ "${#staged[@]}" -eq 0 ]; then
  record_fail 'allowed root files parsed from policy' 'ALLOWED_ROOT_FILES read out of the gate is empty'
else
  git -C "$repo" add -f -- "${staged[@]}"
  assert_passes "allowed root file passes for each of ${#staged[@]} entries" "$repo" --staged
fi

# Nothing staged is not a failure.
repo=$(scratch_repo)
assert_passes 'empty stage passes' "$repo" --staged

# --range catches a stray added between two revisions.
repo=$(scratch_repo)
base=$(git -C "$repo" rev-parse HEAD)
printf 'notes\n' > "$repo/stray.md"
git -C "$repo" add -f stray.md
git -C "$repo" commit -qm 'add stray'
head=$(git -C "$repo" rev-parse HEAD)
assert_blocked '--range rejects a stray added in the range' "$repo" 'stray.md' --range "$base" "$head"

# --range reads contents at HEAD, so a committed credential is caught.
repo=$(scratch_repo)
base=$(git -C "$repo" rev-parse HEAD)
planted_secret > "$repo/docs/setup.md"
git -C "$repo" add docs/setup.md
git -C "$repo" commit -qm 'add setup'
head=$(git -C "$repo" rev-parse HEAD)
assert_blocked '--range rejects a committed credential' "$repo" 'docs/setup.md' --range "$base" "$head"

# A rename into a denied name is an R in the diff, and is caught.
repo=$(scratch_repo)
base=$(git -C "$repo" rev-parse HEAD)
git -C "$repo" mv docs/design.md docs/design-report.md
git -C "$repo" commit -qm 'rename design doc'
head=$(git -C "$repo" rev-parse HEAD)
assert_blocked '--range rejects a rename into a denied name' "$repo" 'docs/design-report.md' --range "$base" "$head"

# A range that adds nothing passes.
repo=$(scratch_repo)
base=$(git -C "$repo" rev-parse HEAD)
printf '# design, revised\n' > "$repo/docs/design.md"
git -C "$repo" commit -qam 'edit design doc'
head=$(git -C "$repo" rev-parse HEAD)
assert_passes '--range passes when the range adds nothing' "$repo" --range "$base" "$head"

# --tracked finds a stray that is already committed.
repo=$(scratch_repo)
printf 'notes\n' > "$repo/leftover.md"
git -C "$repo" add -f leftover.md
git -C "$repo" commit -qm 'add leftover'
assert_blocked '--tracked finds a committed stray' "$repo" 'leftover.md' --tracked

# --tracked passes on a clean tree.
repo=$(scratch_repo)
assert_passes '--tracked passes on a clean tree' "$repo" --tracked

# Misuse exits 2, so a mistyped CI invocation cannot read as a pass.
repo=$(scratch_repo)
assert_usage 'no mode exits 2' "$repo"
assert_usage 'unknown mode exits 2' "$repo" --everything
assert_usage 'short --range exits 2' "$repo" --range HEAD

# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

printf '\n%d passed, %d failed\n' "$passed" "$failed"

if [ "$failed" -gt 0 ]; then
  printf 'The file gate does not enforce its own policy. Fix scripts/check-files.sh.\n' >&2
  exit 1
fi

exit 0
