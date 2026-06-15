# Sprint Log: loosen-pass2-aria

**Plan:** docs/sprint-plans/filter-chart-a11y-tables.md
**Sprint goal:** Let the ARIA pass auto-detect a real `role="table"`/`role="grid"` grid that embeds only phantom chart tables.
**Date:** 2026-06-15
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Replaced the bare Pass 2 early-return `if (el.querySelector('table')) return;` in `injectTableToggles` (`chrome-extension/ui-toggle.js`) with `if (Array.from(el.querySelectorAll('table')).some(t => !isPhantomA11yTable(t))) return;`. Pass 2 now bows out only when the ARIA element contains at least one real (non-phantom) `<table>`. The two preceding guards (`dr-ext-grid` class check, `tagName === 'TABLE'`) and the `classList.add('dr-ext-grid')` + `createToggleForTable(el)` body are preserved unchanged. Pass 1, `dom-adapters.js` (predicate from parent branch), and the right-click path untouched.
- **Tests:** pass — 989 total (976 parent baseline + 13 new). The `loosen-pass2-aria` suite drives the real `injectTableToggles` against a mocked document and asserts: a grid embedding only phantom tables gets `dr-ext-grid` + a toggle (AC1); a grid wrapping a real on-screen table still bows out, no class and no toggle (AC2, no-double-toggle); a mixed phantom+real grid bows out; a no-table pure ARIA grid proceeds; the already-tagged and `tagName==='TABLE'` guards still skip. AC1 and AC2 grids share the same numeric-row fixture, so AC2's negative assertions are non-vacuous (the grid genuinely would qualify but for the real embedded table).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Logic direction correct (bows out iff ≥1 non-phantom table; all-phantom and empty both proceed). Out-of-scope (Pass 1, dom-adapters.js, version files, right-click) untouched. Tests sanity-check fixture phantom-ness, use a real `tableToggles` observable, and isolate state via fresh per-test grids + global restoration. Non-blocking: Pass 2 comment now means "non-phantom" rather than literally "native"; the selector-string mock would silently no-op if `GRID_ARIA_SELECTOR` were reformatted (brittleness, not a correctness issue).

## PR
(opened below — see PR link)
