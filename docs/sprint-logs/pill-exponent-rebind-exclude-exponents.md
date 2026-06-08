# Sprint Log: exclude-exponents

**Plan:** docs/sprint-plans/pill-exponent-rebind.md
**Sprint goal:** Skip exponent numbers (digits inside `<sup>`) during inline-number simplification so values like `10^12`, `6×10^9`, `~ 10^−32 sec` pass through unchanged.
**Date:** 2026-06-05
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** In `chrome-extension/content.js`: new helper `getSuperscriptRanges(cell)` (walks descendant text nodes via `document.createTreeWalker`, marking ranges whose ancestor chain contains a `<sup>` or `getComputedStyle(...).verticalAlign === 'super'`, guarded against missing `getComputedStyle`/`createTreeWalker` for the Node harness); new named constant `SUPERSCRIPT_TAG = 'SUP'` next to `SUPERSCRIPT_DIGITS`. Wired the mask into the inline-extraction branch (mirroring the existing quote-mask filter exactly) and added an intercept in the would-be `mode: 'pure'` branch: when `cell.querySelector('sup')` is truthy the cell is routed through the inline path so the exponent mask applies, preventing whole-cell `10<sup>12</sup>` (flattened to `"1012"`) from being numerically rounded.
- **Tests:** adversarial pass added 10 IIFE blocks / 20 assertions across all four ACs (whole-cell exponent, `N × 10^M` with positive and unicode-minus negative exponents, mixed cell with non-`<sup>` number still simplified, direct unit tests of `getSuperscriptRanges` returning correct `{start,end}` ranges and `[]` for the empty cases). Result: **624 passed, 0 failed** (604 baseline + 20 new).
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Implementation mirrors the established `getQuoteMaskedRanges`/`overlapsQuoteRange` pattern, keeping the skip surgical — the mantissa/base outside the `<sup>` remains roundable. Both code paths a `<sup>`-bearing cell can take (inline-extraction and would-be-pure) are guarded. Tests use a new `makeSuperscriptCell` helper modeled on the existing `linkCell` harness pattern; ranges asserted directly against the flattened-text indices.

## PR
(opened to main — see PR link in run summary)
