/**
 * Single source of truth for sidebar UI defaults and content-script fallback.
 * Loaded by both the content script (via manifest content_scripts) and the
 * sidebar page (via <script src>). Editing values here changes both the
 * sidebar's initial checkbox/dropdown state and the right-click toggle's
 * default behavior so they stay in lockstep.
 */
const DR_DEFAULTS = {
  enabled: true,
  includeWords: true,
  includeCurrency: true,
  includePercent: true,
  excludeFirstRow: false,
  excludeFirstColumn: false,
  simplifyDates: true,
  simplifyTimes: false,
  dateGranularity: 'decade',
  timeGranularity: 'hour',
  // Concrete numeric defaults (Variant F UI always sends concrete numbers, never
  // null/blank). num_top is no longer surfaced in the UI but stays here as the
  // contract with content.js / the right-click toggle.
  offsetTop: -0.5,
  offsetOther: -0.5,
  numTop: 1,
  rangeExpr: ''
};
