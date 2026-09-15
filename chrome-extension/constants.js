/**
 * Every shared constant in the extension.
 *
 * All three contexts load this file: the content script via manifest
 * content_scripts, the sidebar page via <script src>, and the service worker
 * via importScripts at the top of background.js. A constant that more than one
 * component reads belongs here, whatever kind of constant it is — a reader
 * looks in one place.
 *
 * DR_DEFAULTS is the settings contract: every option's name and its default.
 * Editing a value here changes both the sidebar's initial control state and the
 * right-click toggle's default behavior, so the two stay in lockstep.
 */
const DR_DEFAULTS = {
  enabled: true,
  simplifyMixedCells: true,
  simplifyMixedCurrency: true,
  simplifyMixedPercent: true,
  simplifyFirstRow: false,
  simplifyFirstColumn: false,
  simplifyDates: true,
  simplifyTimes: false,
  dateGranularity: 'year',
  timeGranularity: 'hour',
  // Concrete numeric defaults (Variant F UI always sends concrete numbers, never
  // null/blank). num_top is no longer surfaced in the UI but stays here as the
  // contract with content.js / the right-click toggle.
  offsetTop: -0.5,
  offsetOther: -0.5,
  numTop: 1,
  rangeExpr: ''
};
