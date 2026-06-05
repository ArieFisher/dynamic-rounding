# Sprint Plan: Date/Time Pills, Exponent Exclusion & Sidebar Rebind

**Created:** 2026-06-05
**Base branch:** main
**Slug:** pill-exponent-rebind

## 1. Repo Survey

Monorepo with three independent implementations of the Dynamic Rounding algorithm:

- `js/` — Google Sheets Apps Script port (`round_dynamic.js`) plus a Node test harness.
- `python/` — `pip`-installable package (`dynamic_rounding`).
- `chrome-extension/` — Manifest V3 extension. **All four items in this plan target this directory only.**

Chrome-extension files of interest:

- `manifest.json` — version source (1–4 dot-separated integers).
- `background.js` — service worker; owns the context menu and tracks `sidebarTabId` (whether the side panel is open).
- `content.js` (1631 lines) — DOM logic + inlined rounding algorithm. Holds `lastRightClickedTable` (the table the sidebar is "bound" to), the per-table morph-toggle infrastructure (`createToggleForTable`, `tableToggles` WeakMap, `trackedTables` Set), the cell-classification pass (`roundTable`), date/time detection & rounding, and inline-number extraction (`extractNumbersInText`, `NUMBER_IN_TEXT_REGEX_GLOBAL`).
- `defaults.js` — `DR_DEFAULTS`, the single source of truth shared by the content script and the sidebar.
- `sidebar.html` / `sidebar.js` — the side-panel options UI (iOS-style toggle switches per option, two granularity `<select>`s, dual-thumb offset sliders, live preview bands).
- `tests.js` (4213 lines) — Node harness that `eval`s `content.js` against stubbed `document` / `chrome` / `window`.

Languages: vanilla JavaScript, no bundler, no framework. Styles injected via `<style>` tags or inline in `sidebar.html`.

Visible patterns: shared-defaults indirection (`DR_DEFAULTS`), message-passing between background ↔ content ↔ sidebar, WeakMap-keyed per-table state, named char-class/regex constants for date parsing (`SUPERSCRIPT_DIGITS`, `DATE_NOISE_CLASS`, etc.).

## 2. Repo Conventions

- **Version files:**
  - `chrome-extension/manifest.json` — `version` key, 1–4 dot-separated integers (no pre-release suffixes).
  - `python/pyproject.toml` — semver in `version =` line (untouched by this plan).
  - `js/CHANGELOG.md` — informational only (not auto-bumped).
- **Test command:** `node chrome-extension/tests.js`
- **Lint / Format / Build:** none configured.
- **Branch naming:** `fix/<label>` for bug fixes, `feature/<label>` for new functionality (per `CLAUDE.md` / `CONTRIBUTING.md`). **Never** `claude/` or `session/`.
- **Commit convention:** plain prefixed Conventional-Commit style (`fix: …`, `feat: …`, `test: …`, `docs: …`); sprint-stack execution commits use `Sprint <label>: <subject>`.
- **PR template:** none.
- **Version-bump workflow:** **detected** at `.github/workflows/bump-version.yml` — triggers on `pull_request: types: [closed]` to `main`, gated by `github.event.pull_request.merged == true`, and bumps `chrome-extension/manifest.json`'s patch component when files under `chrome-extension/**` change. Sprint commits in this plan **must not** modify `manifest.json`.

## 3. Design

### 3.1 Invert date/time pill semantics (Sprint `invert-datetime-pills`)

**What.** Today the `dates` / `times` rows mean *exclude*. In `content.js` the cell is skipped when `excludeDates`/`excludeTimes` is true (`getExclusionReason`, `content.js:1005-1006`) and date/time *simplification* is only applied when the flag is `false` (`content.js:752`, `761`). Meanwhile `updateDisabledState` (`sidebar.js:262-272`) **enables** the granularity dropdown when the toggle is **on** — i.e. the dropdown is editable precisely when, under current semantics, no simplification happens. The control reads backwards.

The fix inverts the meaning so that **toggle on = simplify this type, and its granularity dropdown becomes editable**; toggle off = leave cells untouched.

**Why.** Aligns the control's affordance (an editable granularity dropdown) with its effect (simplification at that granularity). *Simple components / minimize design-time coupling* — one consistent mental model instead of two contradictory ones.

**Decision — rename the keys, don't just flip the boolean.** Leaving a key named `excludeDates` whose `true` value means "simplify" is a landmine for every future reader. Rename the settings to `simplifyDates` / `simplifyTimes` everywhere: `defaults.js`, `sidebar.js` (`CHECKBOX_TO_SETTING` + the `excludeDates`/`excludeTimes` reads), `sidebar.html` (checkbox `id`s), `content.js` (the three read sites above), and `tests.js`. These keys are passed live via messages and seeded from `DR_DEFAULTS` on each sidebar open — there is **no** persisted `chrome.storage` of the old key names — so the rename is safe with no migration shim.

**Default behaviour.** Per user direction (2026-06-05): **dates simplified by default, times not.** New `DR_DEFAULTS`: `simplifyDates: true, simplifyTimes: false`. This is an intentional behaviour change from today (today's defaults leave dates alone and simplify times) — keep it bundled with the rename so users see one coherent flip rather than two.

**Alternatives considered.** (a) Flip the boolean meaning while keeping the `exclude*` names — rejected: permanently confusing. (b) Flip the `updateDisabledState` direction instead of the cell logic — rejected: that would make the dropdown editable when *excluding*, doubling down on the wrong model.

**Implications.** `getExclusionReason` no longer carries date/time logic; the date/time branches in the classification pass switch from `=== false` to truthy `simplify*` checks. Tests referencing the old keys must be renamed.

### 3.2 Move the option toggle to the left of its label (Sprint `sidebar-pill-left`)

**What.** In each `.toggle-row` the label text sits left and the iOS switch sits right (`sidebar.html:251-308`, with `justify-content: space-between` and `.toggle-label { flex-grow: 1 }`). Move the switch to the **left**, where a checkbox would normally sit, with the label to its right.

**Why.** Matches the conventional checkbox-then-label reading order the request asks for. Pure presentation.

**Decision.** CSS/markup-only. Reorder each row so the `<label class="switch">` precedes the `.toggle-label`, and adjust the flex rule (drop `space-between`, give the label `flex-grow` so the row still fills width, add a small gap). The granularity `<select>` for the `dates`/`times` rows stays on the right. No `sidebar.js` change — element `id`s are unchanged, so all wiring (`getElementById`, `CHECKBOX_TO_SETTING`) keeps working.

**Alternatives considered.** Reverse the flex container with `flex-direction: row-reverse` — rejected: it would also flip the granularity dropdown to the wrong side and invert DOM/tab order vs. visual order (an a11y trap). Explicit reordering is clearer.

**Implications.** Fully independent of every other sprint — touches only `sidebar.html`.

### 3.3 Exclude exponent numbers from simplification (Sprint `exclude-exponents`)

**What.** Numbers that are exponents must pass through untouched. From the Chronology-of-the-universe table the user is targeting, exponents are rendered as HTML `<sup>` elements — e.g. `20 × 10<sup>−12</sup> s`, `20 × 10<sup>15</sup>`, `10<sup>12</sup>`, `6 × 10<sup>9</sup>`. The "raw" caret notation in the original task description was shorthand; the live pages do not contain `^` characters.

This matters for detection: the cell's `innerText` flattens `10<sup>15</sup>` to `1015` with no character-level boundary, so a text-only look-behind (caret/sign) cannot see the exponent. **Detection has to consult the DOM** — specifically, which text spans inside the cell are inside a `<sup>` element.

The simplification happens in `extractNumbersInText` (`content.js:1285-1297`) via `NUMBER_IN_TEXT_REGEX_GLOBAL = /-?\d[\d,]*(?:\.\d+)?/g` (`content.js:12`). The exponent digits (e.g. `12`, `15`, `9`, `−32`) are being matched and rounded like ordinary inline numbers. The mantissa base (`10`, `20`, `6`) must still be eligible — only digits sitting inside a `<sup>` get excluded.

**Why.** Exponents are positional notation, not magnitudes to coarsen; rounding them corrupts the value's meaning (and produces nonsense like `1,^000`). *Robustness* — the extension already guards dates/quotes/links; exponents are the same class of "don't touch."

**Decision — DOM-aware exclusion via a per-cell "exponent text-index mask."** Before the inline pass extracts numbers, walk the cell's descendants and compute the set of `innerText` index ranges that originate from inside a `<sup>` element (or any ancestor with `vertical-align: super`, to catch CSS-styled cases). Pass that mask alongside the text to `extractNumbersInText`; drop any match whose `[index, index+numStr.length)` overlaps the mask.

Implementation outline in `content.js`:

1. New helper `getSuperscriptRanges(cell)` — walks the cell's text nodes in document order, accumulating offsets into the same string that `innerText`/`textContent` yields, and records `[start, end)` for every text node whose ancestor chain includes a `<sup>` (or `getComputedStyle(...).verticalAlign === 'super'`). Returns an array of `{start, end}` ranges, mirroring the shape of the existing `getQuoteMaskedRanges` plumbing (`content.js` ~line 776) so the call-site pattern is familiar.
2. In the cell-classification pass (`content.js:772-783`), call `getSuperscriptRanges(cell)` once per cell and pass the result to `extractNumbersInText`.
3. `extractNumbersInText` gains an optional `superRanges` parameter and filters matches with the existing `overlapsQuoteRange` helper (or a sibling `overlapsRange`) — reuse the pattern rather than duplicating range-overlap logic.
4. New named constant `SUPERSCRIPT_TAG = 'SUP'` near the existing `SUPERSCRIPT_DIGITS` constant, so the tag check is auditable.

Also keep a cheap text-level fallback for pages that pre-render unicode superscripts directly into the cell text (e.g. `10⁻³²`): the regex won't match unicode-superscript digits anyway, so no extra work is needed there.

**Alternatives considered.** (a) Caret-only text look-behind — rejected: the real pages don't contain `^`, so this would miss every example in the screenshot. (b) Bake a negative-look-behind into `NUMBER_IN_TEXT_REGEX_GLOBAL` — rejected: still text-only, and folding it into the shared regex risks affecting the pure-number and date paths. (c) Strip `<sup>` spans from the cell's HTML before extraction — rejected: it would mutate the cell, and the existing right-to-left splice in `roundTable` relies on indices into the original text.

**Implications.** Touches `content.js` (one new helper, one new constant, one extra arg to `extractNumbersInText`) and `tests.js` (add `<sup>`-bearing cell fixtures: `10<sup>12</sup>`, `20 × 10<sup>−12</sup> s`, `6 × 10<sup>9</sup>`, plus a control cell where a non-superscript number on the same row still simplifies — e.g. the `45 ka` from the row mixing prose and exponents). Independent of the other three sprints.

### 3.4 Rebind the open sidebar when a different table is toggled (Sprint `sidebar-table-rebind`)

**What.** The sidebar is "bound" to `lastRightClickedTable`. When the sidebar is open and the user clicks the per-table morph toggle on a **different** table, the sidebar should switch its binding to that newly toggled table and reset to **default** settings.

**Why.** Keeps the visible options in sync with whatever table the user is now acting on, instead of silently applying the old table's settings or leaving the sidebar stale. *Minimize runtime coupling* between which table is active and what the panel shows.

**Decision.**
- **Track sidebar-open state in `content.js`.** Add a module flag `sidebarOpen`, set `true` on the `SIDEBAR_OPENED` message and `false` on `CLOSE_SIDEBAR`/`SIDEBAR_CLOSED`-equivalent. (Background already tracks `sidebarTabId`; the content script needs its own view to decide whether to rebind.)
- **In the toggle path** (`createToggleForTable`'s click handler / `runToggleAction`), when `sidebarOpen && table !== lastRightClickedTable`: set `lastRightClickedTable = table`, tell the sidebar to reset its UI to defaults, then run the normal toggle/apply against the new table.
- **Reset the sidebar UI to defaults.** Add a `RESET_SIDEBAR_TO_DEFAULTS` message handled in `sidebar.js` that calls the existing `applyDefaultsToUI()` and `fetchPreviewSamples()`. Reuse the existing `PREVIEW_SAMPLES_CHANGED` plumbing so the preview bands re-pull against the new table.

**Alternatives considered.** (a) Rebind on right-click only (status quo) — rejected: the request is specifically about the *toggle* action. (b) Preserve the previous table's settings on rebind — rejected: the request explicitly says "with the default settings."

**Implications.** Touches `content.js` (open-state flag + toggle handler) and `sidebar.js` (reset handler). Logically independent of the other three; shares files with Sprints 3.1 (sidebar.js/content.js) and 3.3 (content.js) but in different regions, so no `depends_on` edge is warranted.

### 3.5 Named constants

Per the delivery principle, new literals that carry cross-call-site meaning get names:

- `SUPERSCRIPT_TAG = 'SUP'` — `content.js` (Sprint `exclude-exponents`), near `SUPERSCRIPT_DIGITS`.
- `RESET_SIDEBAR_TO_DEFAULTS` — message-action string used in both `content.js` and `sidebar.js` (Sprint `sidebar-table-rebind`); define once and reuse. (Existing action strings are inline literals shared by convention; follow that same convention but keep the name consistent across both files.)

## 4. Sprint List & Dependency Graph

### Sprint List

1. **`invert-datetime-pills`** — Flip date/time controls so toggle-on simplifies and enables the granularity dropdown; rename `exclude*` → `simplify*`. *Depends on: none.*
2. **`sidebar-pill-left`** — Move each option's toggle switch left of its label in the sidebar. *Depends on: none.* (CSS/markup-only; the most isolated sprint.)
3. **`exclude-exponents`** — Skip exponent numbers (caret/superscript) during inline-number simplification. *Depends on: none.*
4. **`sidebar-table-rebind`** — When the open sidebar's bound table differs from a just-toggled table, rebind to the new table with default settings. *Depends on: none.*

All four are rooted at `main`. They were deliberately kept independent: 1 and 4 both touch `sidebar.js`/`content.js` and 3 touches `content.js`, but in non-overlapping regions, so no dependency edge is justified — if any one fails, the others still merge on their own merits (*team autonomy*, *minimize design-time coupling*).

### Dependency Graph

```mermaid
flowchart TD
    base[main]
    s1["invert-datetime-pills<br/>toggle-on = simplify date/time"]
    s2["sidebar-pill-left<br/>switch left of label"]
    s3["exclude-exponents<br/>skip exponent numbers"]
    s4["sidebar-table-rebind<br/>rebind sidebar on other-table toggle"]
    base --> s1
    base --> s2
    base --> s3
    base --> s4
```

## 5. Sprint Definitions

### invert-datetime-pills

- **Goal:** Make the `dates`/`times` sidebar toggles mean "simplify this type (dropdown editable)" instead of "exclude it."
- **Scope:**
  - `defaults.js` — rename `excludeDates`→`simplifyDates`, `excludeTimes`→`simplifyTimes`; new defaults `simplifyDates: true`, `simplifyTimes: false`.
  - `sidebar.html` — rename checkbox `id`s `excludeDates`→`simplifyDates`, `excludeTimes`→`simplifyTimes`.
  - `sidebar.js` — update `CHECKBOX_TO_SETTING` and the two `getElementById('excludeDates'/'excludeTimes')` reads in `updateDisabledState`; verify the dropdown-enable direction now reads correctly (enabled when toggle on).
  - `content.js` — `getExclusionReason` drops the date/time branches (lines 1005-1006); the classification pass (lines 752, 761) switches to `opts.simplifyDates && isDateLike(...)` / `opts.simplifyTimes && isTimeLike(...)`.
  - `tests.js` — rename old keys in fixtures/assertions; add a test asserting that a date cell **is** simplified when `simplifyDates: true` and **is not** when `false` (and the symmetric time case).
- **Out of scope:** Changing the set of granularity options; any default-behaviour change beyond the rename-preserving mapping (see Open Questions); the pill's visual position (that's `sidebar-pill-left`).
- **Acceptance criteria:**
  - With `simplifyDates: true`, a `YYYY-MM-DD` cell is rounded to the chosen granularity; the `dateGranularity` `<select>` is enabled.
  - With `simplifyDates: false`, the same cell is unchanged and the dropdown is disabled. Symmetric for times.
  - No occurrence of `excludeDates`/`excludeTimes` remains in `chrome-extension/` or `tests.js`.
  - `node chrome-extension/tests.js` passes.
- **Depends on:** none
- **Complexity:** M
- **Dev notes:** No `chrome.storage` migration needed (keys are transient). Watch the inverted comparison: old code applied simplification on `=== false`; new code applies on truthy `simplify*`. Keep `getExclusionReason` returning `null` for date/time (they're no longer an exclusion reason).

### sidebar-pill-left

- **Goal:** Render each option's toggle switch to the left of its label, checkbox-style.
- **Scope:** `sidebar.html` only — reorder each `.toggle-row` so `<label class="switch">` precedes `.toggle-label`, and update the `.toggle-row` flex rule (remove `justify-content: space-between`, keep `.toggle-label { flex-grow: 1 }` and the gap so the row still fills width). For the `dates`/`times` rows, keep the granularity `<select>` on the far right (switch · label · …spacer… · select).
- **Out of scope:** Any `sidebar.js` change; renaming `id`s; the top title-row master switch (it stays where it is unless trivially consistent).
- **Acceptance criteria:**
  - In all option rows the switch appears left of the label.
  - On the `dates`/`times` rows the granularity dropdown remains right-aligned.
  - Element `id`s are unchanged; toggling still applies (manual load-unpacked check) and `node chrome-extension/tests.js` still passes.
- **Depends on:** none
- **Complexity:** S
- **Dev notes:** Avoid `flex-direction: row-reverse` (breaks select placement and DOM/visual order for a11y). Reorder the actual elements.

### exclude-exponents

- **Goal:** Leave exponent numbers untouched during inline-number simplification.
- **Scope:**
  - `content.js` — add helper `getSuperscriptRanges(cell)` that walks the cell's text nodes and returns `[start, end)` index ranges (against the same string `extractNumbersInText` sees) for runs whose ancestor chain includes a `<sup>` or `getComputedStyle(...).verticalAlign === 'super'`. Extend `extractNumbersInText` with an optional `superRanges` arg and filter matches using the existing `overlapsQuoteRange`-style pattern. In the cell-classification pass (`content.js:772-783`), compute the ranges once per cell and pass them in. Add `SUPERSCRIPT_TAG = 'SUP'` near `SUPERSCRIPT_DIGITS`.
  - `tests.js` — add `<sup>`-bearing cell fixtures (`10<sup>12</sup>`, `20 × 10<sup>−12</sup> s`, `6 × 10<sup>9</sup>`, `~ 10<sup>−32</sup> sec`) asserting unchanged output; include a control row proving an inline non-superscript number on the same page (e.g. `45 ka`) is still simplified. The stubbed `document` in `tests.js` already creates real DOM nodes via the existing harness — verify the test-side `getComputedStyle`/ancestor walk works against it; if not, gate the CSS check behind `typeof getComputedStyle === 'function'` and rely on the tag check in tests.
- **Out of scope:** Rewriting `NUMBER_IN_TEXT_REGEX_GLOBAL`; changing pure-number-cell or date handling; rendering superscripts (display untouched); the caret-text `10^15` syntax — confirmed not present in target pages.
- **Acceptance criteria:**
  - On the Chronology-of-the-universe table, `10<sup>12</sup>`, `20 × 10<sup>15</sup>`, `20 × 10<sup>−12</sup> s`, `6 × 10<sup>9</sup>`, and `~ 10<sup>−32</sup> sec` are unchanged after simplification.
  - The base (`10`, `20`, `6`) remains eligible — i.e. nothing widens the skip to the whole `N × 10^M` group.
  - A normal inline number on the same row (e.g. `45 ka`) is still simplified.
  - `node chrome-extension/tests.js` passes.
- **Depends on:** none
- **Complexity:** M
- **Dev notes:** The text-index walk must mirror however `extractNumbersInText` reads cell text — at the call site that's the cell's `text` (from `innerText || textContent`, `content.js:736`). Walk text nodes in document order, advancing a cursor, and check `node.parentElement.closest('sup')` for membership. Don't over-broaden the skip to the whole `N × 10^M` group.

### sidebar-table-rebind

- **Goal:** When the open sidebar is bound to one table and a different table's toggle is clicked, rebind the sidebar to the new table with default settings.
- **Scope:**
  - `content.js` — add `sidebarOpen` flag set `true` on `SIDEBAR_OPENED`, `false` on `CLOSE_SIDEBAR` (and any sidebar-closed signal the content script can observe). In the morph-toggle click path (`createToggleForTable` / `runToggleAction`), when `sidebarOpen && table !== lastRightClickedTable`: set `lastRightClickedTable = table`, post `RESET_SIDEBAR_TO_DEFAULTS`, then run the toggle/apply against the new table. Reuse `PREVIEW_SAMPLES_CHANGED`.
  - `sidebar.js` — handle `RESET_SIDEBAR_TO_DEFAULTS` by calling `applyDefaultsToUI()` then `fetchPreviewSamples()`.
- **Out of scope:** Preserving the previous table's settings on rebind (request says use defaults); rebinding on right-click (already works); multi-table simultaneous binding.
- **Acceptance criteria:**
  - With the sidebar open on table A, clicking table B's toggle rebinds the sidebar to B, resets all controls to `DR_DEFAULTS`, and the preview bands re-pull from B.
  - Toggling table A's own toggle while bound to A does **not** reset the sidebar.
  - With the sidebar closed, toggle behaviour is unchanged.
  - `node chrome-extension/tests.js` passes.
- **Depends on:** none
- **Complexity:** M
- **Dev notes:** `content.js` has no sidebar-open flag today — add one rather than round-tripping to the background. Define the `RESET_SIDEBAR_TO_DEFAULTS` action string consistently in both files. Guard the rebind with `table !== lastRightClickedTable` so same-table toggles are untouched.

## 6. Open Questions

None outstanding. Decisions confirmed 2026-06-05:

- **Defaults:** `simplifyDates: true`, `simplifyTimes: false`. Folded into the `invert-datetime-pills` sprint above.
- **Exponent notation:** real pages render exponents as HTML `<sup>` elements; caret (`^`) text is not in scope. The `exclude-exponents` sprint above uses DOM-aware detection.
- **Master switch:** the top-level `enabled` switch in the title row stays right-aligned. `sidebar-pill-left` touches the per-option rows only.

## 7. Out of Scope (Separate Sprint-Stack)

- No cross-platform (`js/`, `python/`) changes — all four items are Chrome-extension-only.
- Broader exponent/scientific-notation *rendering* (e.g. normalizing `1e9` ↔ `10^9`) is a distinct concern.

## Decisions Log

- 2026-06-05: Initial draft generated by sprint-plan skill.
- 2026-06-05: Per user — `simplifyDates`/`simplifyTimes` defaults set to `true`/`false`; exponent detection moved from caret-text to DOM `<sup>` walk; master switch position unchanged.
