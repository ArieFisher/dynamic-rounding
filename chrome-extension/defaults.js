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
  excludeFirstRow: true,
  excludeFirstColumn: true,
  excludeDates: true,
  excludeTimes: true,
  dateGranularity: 'decade',
  timeGranularity: 'minute',
  offsetTop: null,
  offsetOther: null,
  numTop: null,
  rangeExpr: ''
};
