#!/usr/bin/env bash
#
# Self-test for scripts/bump-versions.py.
#
# Every case runs in a scratch directory carrying copies of the real version
# files, feeds the script a list of changed paths, and checks which files it
# wrote and the versions they hold. Run with no arguments; exits 0 when the
# script behaves and 1 when any case fails.
#
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
BUMP="$here/bump-versions.py"
ROOT="$here/.."

[ -x "$BUMP" ] || { echo "no executable script at $BUMP" >&2; exit 2; }

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

# Creates a scratch tree with the real version files, then sets the given
# versions on them: scratch_tree PYTHON_VERSION CHROME_VERSION.
scratch_tree() {
  local dir
  dir=$(mktemp -d "${TMPDIR:-/tmp}/bump-versions-test.XXXXXX") || exit 2
  [ -n "$dir" ] || exit 2
  scratch_dirs+=("$dir")
  mkdir -p "$dir/python" "$dir/chrome-extension"
  sed -E "s/^version = \"[0-9.]+\"/version = \"$1\"/" \
    "$ROOT/python/pyproject.toml" > "$dir/python/pyproject.toml"
  sed -E "s/^  \"version\": \"[0-9.]+\"/  \"version\": \"$2\"/" \
    "$ROOT/chrome-extension/manifest.json" > "$dir/chrome-extension/manifest.json"
  printf '%s\n' "$dir"
}

record_pass() { passed=$((passed + 1)); printf '  pass  %s\n' "$1"; }
record_fail() { failed=$((failed + 1)); printf '  FAIL  %s\n        %s\n' "$1" "$2"; }

python_version() { sed -nE 's/^version = "([0-9.]+)"/\1/p' "$1/python/pyproject.toml"; }
chrome_version() { sed -nE 's/^  "version": "([0-9.]+)",?/\1/p' "$1/chrome-extension/manifest.json"; }

# expect NAME DIR MINOR CHANGED WANT_OUTPUT WANT_PYTHON WANT_CHROME
expect() {
  local name=$1 dir=$2 minor=$3 changed=$4 want_out=$5 want_py=$6 want_cr=$7 out
  out=$(cd "$dir" && printf '%s' "$changed" | "$BUMP" "$minor" 2>/dev/null) || {
    record_fail "$name" "script exited non-zero"; return; }
  out=$(printf '%s' "$out" | tr '\n' ' ')
  if [ "$out" != "$want_out" ]; then
    record_fail "$name" "wrote [$out], want [$want_out]"
  elif [ "$(python_version "$dir")" != "$want_py" ]; then
    record_fail "$name" "python version $(python_version "$dir"), want $want_py"
  elif [ "$(chrome_version "$dir")" != "$want_cr" ]; then
    record_fail "$name" "chrome version $(chrome_version "$dir"), want $want_cr"
  else
    record_pass "$name"
  fi
}

echo "bump-versions self-test"

dir=$(scratch_tree 0.2.5 2.2.13)
expect "a python change raises the python patch" "$dir" false \
  $'python/README.md\n' "python/pyproject.toml" 0.2.6 2.2.13

dir=$(scratch_tree 0.2.5 2.2.13)
expect "the minor label raises the minor and resets the patch" "$dir" true \
  $'chrome-extension/content.js\n' "chrome-extension/manifest.json" 0.2.5 2.3.0

dir=$(scratch_tree 0.2.5 2.2.13)
expect "a change to both packages raises both" "$dir" false \
  $'python/x.py\nchrome-extension/x.js\n' \
  "python/pyproject.toml chrome-extension/manifest.json" 0.2.6 2.2.14

dir=$(scratch_tree 0.2.5 2.2.13)
expect "a change outside every package writes nothing" "$dir" false \
  $'docs/design.md\npython-notes.md\n' "" 0.2.5 2.2.13

dir=$(scratch_tree 0.2.5 2.2.13.4)
expect "a fourth version part drops" "$dir" false \
  $'chrome-extension/x.js\n' "chrome-extension/manifest.json" 0.2.5 2.2.14

dir=$(scratch_tree 0.2.5 2.2.13)
before=$(cat "$dir/chrome-extension/manifest.json")
(cd "$dir" && printf 'chrome-extension/x.js\n' | "$BUMP" false >/dev/null 2>&1)
if [ "$(cat "$dir/chrome-extension/manifest.json")" = "${before/\"2.2.13\"/\"2.2.14\"}" ]; then
  record_pass "the bump changes the version and nothing else"
else
  record_fail "the bump changes the version and nothing else" "other bytes changed"
fi

dir=$(scratch_tree 0.2.5 2.2.13)
sed -i '/^version = /d' "$dir/python/pyproject.toml"
if (cd "$dir" && printf 'python/x.py\n' | "$BUMP" false >/dev/null 2>&1); then
  record_fail "a version file with no version line fails" "script exited 0"
else
  record_pass "a version file with no version line fails"
fi

dir=$(scratch_tree 0.2.5 2.2.13)
rm "$dir/chrome-extension/manifest.json"
if (cd "$dir" && printf 'chrome-extension/x.js\n' | "$BUMP" false >/dev/null 2>&1); then
  record_fail "a missing version file fails" "script exited 0"
else
  record_pass "a missing version file fails"
fi

printf '%d passed, %d failed\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
