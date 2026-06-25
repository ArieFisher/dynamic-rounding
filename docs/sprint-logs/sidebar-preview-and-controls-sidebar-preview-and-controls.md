# Sprint Log: sidebar-preview-and-controls

**Plan:** docs/sprint-plans/sidebar-preview-and-controls.md
**Sprint goal:** Stop sidebar edits from disabling the controls, make the largest-number/OoM detection recognise numbers embedded in text, and phrase the top-band strategy clause relative to the order of magnitude.
**Date:** 2026-06-25
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** Implemented the three single-region fixes in `chrome-extension/`:
  - `content.js` `APPLY_SIDEBAR_SETTINGS` branch — added a synchronous `sendResponse({ ok: true })` before the branch returns (no `return true`), so a successful apply no longer produces a `lastError` that the sidebar mis-reads as "table gone".
  - `content.js` `collectNumericCells` — after the existing empty / date-like / time-like / bare-year guards, falls back to `extractNumbersInText(trimmed)` when the whole cell is not a pure number, pushing one `{ text: trimmed, num }` entry per extracted value. This aligns the preview's `maxMag` with the live `roundTable` pass for in-text numbers (e.g. `₹2,000 crore`).
  - `sidebar.js` `formatStrategyHeader` — when `step > oomVal`, re-bases the parenthetical clause onto the next decade (`rebasedRatio = ratio / 10`, base label `formatOomLabel(maxMag + 1)` sans `+`); `STRATEGY_RATIO_PHRASES` reduced to the four descriptive entries `{0.1, 0.25, 0.5, 0.75}` with the now-unreachable `{2.5, 5, 7.5, 10}` rows removed. Band label and `nearest <step>` text unchanged.
- **Tests:** pass — `node chrome-extension/tests.js` 1485 passed / 0 failed; `node js/tests.js` 158 passed / 0 failed. The test-writer updated the 10 stale `AC2-ALL` stops to the re-based wording and added AC1 (dynamic listener dispatch asserting `sendResponse({ok:true})` fires and the listener does not `return true`), AC2 (exhaustive `formatStrategyHeader(3, offset)` clause strings + `×`-absence), and AC3 (`extractPreviewSamples` `maxMag === 3` for an in-text `₹2,000 crore` cell alongside a stand-alone `5`, plus a pure-number regression guard).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** All four acceptance criteria met; developer stayed within scope (no js/python, no rounding math, no IPC shape change, no manifest/version bump); code and tests in separate commits with correct prefixes. Two non-blocking notes: (1) commits omit `Co-Authored-By`/session footers — correct per repo git-workflow-policy §4, which forbids them (reviewer's note based on the generic harness default, overridden by repo convention; no action). (2) the in-text fallback passed the raw `text` rather than `trimmed` to `extractNumbersInText` — cosmetic only; fixed forward (bucket-1) and folded into the feature commit, suite still green.

## PR
https://github.com/ArieFisher/dynamic-rounding/pull/168
