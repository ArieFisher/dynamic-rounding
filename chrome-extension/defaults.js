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
 *
 * DR_CROSS_CONTEXT_TOPICS is every cross-context topic name.
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

/**
 * A cross-context topic travels between the extension's three contexts over
 * Chrome messaging. Before this list each name existed only as text, written
 * out again at every publish site and every listener. Nothing compared those
 * copies, so one mistyped character produced a message no listener matched:
 * no error, no log row, and the branch simply never ran. Every publish site
 * and every listener now reads the name from here.
 */
const DR_CROSS_CONTEXT_TOPICS = (function () {
  const NAMES = {
    APPLY_BLOCKED: 'APPLY_BLOCKED',
    APPLY_OK: 'APPLY_OK',
    APPLY_SIDEBAR_SETTINGS: 'APPLY_SIDEBAR_SETTINGS',
    CLOSE_SIDEBAR: 'CLOSE_SIDEBAR',
    GET_CAPTURE_STATE: 'GET_CAPTURE_STATE',
    GET_PREVIEW_SAMPLES: 'GET_PREVIEW_SAMPLES',
    GET_SETTINGS: 'GET_SETTINGS',
    MENU_CLICKED: 'MENU_CLICKED',
    PAGE_UNLOADED: 'PAGE_UNLOADED',
    PREVIEW_SAMPLES_CHANGED: 'PREVIEW_SAMPLES_CHANGED',
    RANGE_ERROR: 'RANGE_ERROR',
    RANGE_OK: 'RANGE_OK',
    SIDEBAR_CLOSED: 'SIDEBAR_CLOSED',
    SIDEBAR_OPENED: 'SIDEBAR_OPENED',
    TABLE_ACTIVATED: 'TABLE_ACTIVATED',
    TABLE_SWITCHED: 'TABLE_SWITCHED',
    TABLE_TOGGLE_STATE: 'TABLE_TOGGLE_STATE',
    UPDATE_MENU_LABEL: 'UPDATE_MENU_LABEL',
  };

  // Reading a misspelled field off a plain object returns undefined, which
  // puts undefined on the wire and reproduces the silent miss this list
  // exists to remove. The proxy turns that read into an error on the spot,
  // matching how the event bus already rejects an unknown topic name.
  return new Proxy(Object.freeze(NAMES), {
    get(target, key) {
      if (typeof key === 'symbol' || key in target) return target[key];
      throw new Error('DR_CROSS_CONTEXT_TOPICS: unknown cross-context topic "' + String(key) + '"');
    },
  });
})();
