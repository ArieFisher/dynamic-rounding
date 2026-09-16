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
 * DR_TUNING is the detection tuning block: every value and lookup list that
 * shapes what detection finds.
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
 * DR_TUNING is the detection tuning block: every value that shapes whether
 * an element counts as a table or a grid, plus the two lookup lists
 * detection reads (the display values that mark a grid/flex layout, and the
 * known vendor grid profiles). The detection layer (lib/dr-table/detect.js),
 * the pillbox view (ui-toggle.js), and the controller (content.js) read it
 * as a bare global, with no fallback copy of any value in any of the three.
 */
const DR_TUNING = {
  // --- Grid geometry probe (lib/dr-table/detect.js: looksLikeGrid) ---
  gridMinChildren: 5,
  gridWalkDepthCap: 15,
  gridColumnWidthSample: 10,
  gridColumnWidthAgreement: 0.8,
  gridRepetitionShare: 0.5,
  gridDisplayValues: ['grid', 'flex', 'inline-grid', 'inline-flex'],
  // --- Vendor grids (lib/dr-table/detect.js: GridAdapter) ---
  vendorProfiles: [
    {
      name: 'databricks',
      classToken: 'dg--',
      scrollContainerSelectors: ['.dg--grid-scroll-container', '.dg--grid-container'],
      pinnedPaneSelectors: ['.dg--pinned-grid'],
    },
    {
      name: 'ag-grid',
      classToken: 'ag-',
      scrollContainerSelectors: ['.ag-center-cols-viewport'],
      pinnedPaneSelectors: ['.ag-pinned-left-cols-container'],
    },
  ],
  // --- Virtualized-grid redraw (content.js) ---
  gridRedrawDelayMs: 100,
  // --- Accessibility artifact check (lib/dr-table/detect.js: isPhantomA11yTable) ---
  offscreenLeftPx: -9999,
  // --- Pillbox view (ui-toggle.js) ---
  pillboxAutoCollapseMs: 3000,
};
