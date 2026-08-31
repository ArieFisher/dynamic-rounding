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

# One pattern per retired synonym whose retired sense a grep can isolate,
# narrowed where the bare word has legitimate other senses. One row of the
# Retired synonyms table stays deliberately uncovered: "record" looks the same
# in its retired sense and in "historical record", a term these conventions
# lean on, so the human sweep owns it. Keep in step with docs/vocabulary.md.
#
# Word boundaries, per edge, when adding a pattern:
#   Front: add \b when a real word ends in the pattern's first token, so
#     "stable toggle" and "confused" do not read as findings. Leave the front
#     open where the prefixed form is the same mistake — "unselected table" and
#     "unstuck table" are worth catching.
#   Back: add \b only when a longer word starting with the pattern is
#     legitimate prose ("pillbox", "baseline", "storefront"). Leaving it open
#     is what catches "table toggles" and "undo states".
RETIRED_PATTERNS=(
  '\btable toggle'      # say: pillbox
  '\bpill\b'            # say: pillbox
  '\bundo state'        # say: originals
  '\bpreview band'      # say: lens preview
  '\bproactive scan'    # say: load-time scan
  '\borphaned handle'   # say: dead handle
  '\bfused\b'           # say: coupled
  'what it buys'        # say: benefit
  '\bdead code'         # say: never-used code
  'selected table'      # say: active table (or bound table) — front open on purpose: "unselected"
  'stuck table'         # say: locked / unrestorable table — front open on purpose: "unstuck"
  '\bapp store\b'       # say: application model
  '\bentire range|\bwhole range|\binput range'  # say: dataset ("range expression" and cell ranges keep their names)

  # Collocations. Four retired words carry legitimate other senses, so each is
  # narrowed to phrases that can only mean the retired thing. The bare word
  # stays legal: "base branch", "store the value", "linked list", "tied to the
  # academic calendar". Coverage is partial by design: a phrasing not listed
  # here reaches the human sweep. That is the trade — a pattern broad enough to
  # fire on clean prose teaches people to stop trusting the gate.
  #
  # Deliberately absent, each rejected for blocking real prose this repo writes:
  # "a base of 10" (number bases, next to log10), "the extension store" and
  # "publish to the store" (the Chrome Web Store), and a bare "is linked to the"
  # (an issue linked to a PR). The qualified forms below carry the load.
  'rounding base\b|\bbase unit\b|nearest base\b'  # say: step
  '\b(state|panel|settings|table) store\b'  # say: application model ("app store" has its own row above)
  '\blinked (table|state|cell|range)\b|is linked to the (table|sidebar|panel|switch|pillbox|state)\b'  # say: bound
  'tightly tied|tied together|\btied to the (table|panel|pillbox|toggle|sidebar|switch|state)\b'  # say: coupled
)

# Paths the sweep never touches: point-in-time records and the canon itself.
# Note on renames: a file moved OUT of an exempt path re-reads as all-new
# prose. A historical record is never rewritten to satisfy this gate — extend
# this list to cover the record's new home instead.
EXEMPT_PATHS='^docs/sprint-logs/|^docs/sprint-plans/|^docs/research/|^js/CHANGELOG\.md$|^docs/vocabulary\.md$'

# --------------------------------------------------------------------------
# Preflight
# --------------------------------------------------------------------------

# The pattern list is the whole policy, and an empty or broken list reports the
# same silence as clean prose. These checks turn that silence into a refusal,
# on every run of the gate rather than only when the self-test runs in CI.

# A sentence the gate must be able to see. It belongs to no living doc, so a
# real change never carries it. When the pattern it matches retires, point the
# canary at another one.
#
# It matches exactly one pattern, and that pattern opens with \b. So the canary
# also proves the search command honors word boundaries — the one feature these
# patterns depend on that differs between grep implementations. A grep that
# read \b as a literal would fail preflight instead of quietly under-blocking.
CANARY='The table toggle turns rounding on.'

# grep answers three ways: 0 found, 1 not found, 2 the pattern is broken.
# Reading 2 as "not found" is how a malformed pattern disables itself without a
# word, so the status travels back to every caller intact.
match_pattern() {
  local pattern="$1" text="$2"
  printf '%s\n' "$text" | grep -iE "$pattern"
}

preflight() {
  if (( ${#RETIRED_PATTERNS[@]} == 0 )); then
    echo "check-vocab: the retired-synonym list is empty — refusing to pass without inspecting" >&2
    exit 2
  fi

  local pattern status canary_seen=0
  for pattern in "${RETIRED_PATTERNS[@]}"; do
    match_pattern "$pattern" "$CANARY" >/dev/null
    status=$?
    if (( status > 1 )); then
      printf 'check-vocab: /%s/ is not a valid expression — refusing to pass without inspecting\n' "$pattern" >&2
      exit 2
    fi
    (( status == 0 )) && canary_seen=1
  done

  if (( canary_seen == 0 )); then
    echo "check-vocab: no pattern matches the canary — the gate cannot see a known violation" >&2
    exit 2
  fi
}

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
  added=$("${diff_cmd[@]}" -- "$file" | grep '^+' | grep -vE '^\+\+\+ (b/|/dev/null)' || true)
  [[ -n "$added" ]] || return 0

  for pattern in "${RETIRED_PATTERNS[@]}"; do
    # Guard: preflight already compiled every pattern with this same grep, and
    # a pattern's validity does not depend on the text searched. So the only
    # answers left here are found and not-found, and swallowing the status is
    # safe. Removing the preflight canary loop would make that untrue.
    local hits
    hits=$(match_pattern "$pattern" "$added" || true)
    if [[ -n "$hits" ]]; then
      printf '  BLOCKED  %s\n           retired synonym /%s/ in new prose — see docs/vocabulary.md:\n' "$file" "$pattern" >&2
      printf '%s\n' "$hits" | sed 's/^/           /' >&2
      failures=$((failures + 1))
    fi
  done
}

# Prove the policy works before trusting a verdict from it.
preflight

# The file list is captured in the main shell so a git failure is observable:
# a gate that cannot diff must not report success. Renames count (R): a
# renamed-and-edited living doc is the edit most likely to reintroduce old
# vocabulary; git prints a rename's destination path, which is the one to scan.
mode="${1:-}"
case "$mode" in
  --staged)
    diff_args=(--cached)
    ;;
  --range)
    base="${2:?usage: check-vocab.sh --range BASE HEAD}"
    head="${3:?usage: check-vocab.sh --range BASE HEAD}"
    # Three dots: only lines this branch added since the merge base. Two dots
    # would re-present the branch's older copy of any line the base branch
    # rewrote after the fork as an "addition" this branch never made.
    diff_args=("$base...$head")
    ;;
  *)
    echo "usage: check-vocab.sh --staged | --range BASE HEAD" >&2
    exit 2
    ;;
esac

changed=$(git diff --name-only --diff-filter=ACMR "${diff_args[@]}") || {
  echo "check-vocab: git diff failed for '${diff_args[*]}' — refusing to pass without inspecting" >&2
  exit 2
}

# Prefixes pinned so the '+++ b/…' header filter holds under any local git
# config (diff.noprefix, diff.mnemonicPrefix).
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  check_added_lines "$file" git diff --unified=0 --src-prefix=a/ --dst-prefix=b/ "${diff_args[@]}"
done <<< "$changed"

if (( failures > 0 )); then
  echo "check-vocab: $failures finding(s) blocked. Replace the retired synonym with its canonical term (docs/vocabulary.md, Retired synonyms)." >&2
  exit 1
fi
exit 0
