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
 * DR_DETECTION_SETTINGS holds the detection settings: every value and
 * lookup list that shapes what detection finds.
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
 * DR_DETECTION_SETTINGS holds the detection settings: every value that
 * shapes whether an element counts as a table or a grid, plus the two lookup
 * lists detection reads (the display values that mark a grid/flex layout,
 * and the known vendor grid profiles). The detection layer
 * (lib/dr-table/detect.js) and the controller (content.js) read it as a bare
 * global, with no fallback copy of any value in either. The pillbox
 * auto-collapse delay lives in the pillbox view, not here: the view alone
 * reads it, and it shapes nothing detection finds.
 */
const DR_DETECTION_SETTINGS = {
  // --- Nomination step (lib/dr-table/detect.js: findTables) ---
  nestingDepth: 1,
  // --- Grid geometry probe (lib/dr-table/detect.js: looksLikeGrid) ---
  gridMinChildren: 5,
  gridWalkDepthCap: 15,
  gridColumnWidthSample: 10,
  gridColumnWidthAgreement: 0.8,
  gridRepetitionShare: 0.5,
  gridDisplayValues: ['grid', 'flex', 'inline-grid', 'inline-flex'],
  // --- Data test (lib/dr-table/detect.js: isDataTable) ---
  dataTestCellBudget: 1000,
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
  // --- Re-apply observer (content.js) ---
  // A burst of page edits inside a simplified table runs one pass once the
  // edits stop for this long. The pending-table re-test below waits the same.
  gridRedrawDelayMs: 100,
  // The longest a burst waits for its pass. A table the page updates more
  // often than the redraw delay never goes quiet, so a pass runs once the
  // burst has lasted this long: at most one pass a second.
  reapplyMaxWaitMs: 1000,
  // The most cells a pass reads: a native table's cells, a grid's visible
  // cells. Ten times the data test's cell budget, e.g. 1,000 rows of 10
  // columns. The value holds a pass under 100 ms: in Chrome on the test page
  // a pass over 10,000 cells took 44 to 57 ms. Above it the pass writes
  // nothing, the table's re-apply observer stops, and one debug row records
  // the stop; a table above it at its first simplification never attaches
  // the observer.
  reapplyCellCap: 10000,
  // --- Pending tables (content.js) ---
  // Failed re-tests a pending table takes before its subtree observer drops.
  // A re-test runs only after a subtree change and the redraw delay above, so
  // the count grows under sustained churn alone.
  pendingRetestCap: 100,
  // --- Accessibility artifact check (lib/dr-table/detect.js: isPhantomA11yTable) ---
  offscreenLeftPx: -9999,
};
