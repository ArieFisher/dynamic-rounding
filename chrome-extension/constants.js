/**
 * Every shared constant in the extension.
 *
 * The content script loads this file through the manifest's content_scripts,
 * and the sidebar page through a script tag. The service worker does not load
 * it. A constant that more than one component reads belongs here, whatever
 * kind of constant it is — a reader looks in one place.
 *
 * DR_DEFAULTS is the settings contract: every option's name and its default.
 * The application model fills a table's missing settings from it, and the
 * sidebar draws its initial controls from it.
 */
const DR_DEFAULTS = {
  // Off: a table no one has turned on shows the original. The table pillbox,
  // the menu toggle, the menu toggle with sidebar, or the sidebar pillbox
  // turns a table on.
  enabled: false,
  simplifyMixedCurrency: true,
  simplifyMixedPercent: true,
  simplifyFirstRow: false,
  simplifyFirstColumn: false,
  simplifyDates: true,
  simplifyTimes: false,
  dateGranularity: 'year',
  timeGranularity: 'hour',
  // Concrete numbers, never null or blank. numTop has no sidebar control.
  offsetTop: -0.5,
  offsetOther: -0.5,
  numTop: 1,
  rangeExpr: ''
};

/**
 * DR_DETECTION_SETTINGS holds the detection settings: every value that
 * shapes whether an element counts as a table or a grid, every value that
 * sets how soon and how far the extension acts on a page change (the settle
 * delay, the cell cap, the pass target), plus the two lookup lists detection
 * reads (the display values that mark a grid/flex layout, and the known
 * vendor grid profiles). The detection layer and the controller
 * (content.js) read it as a bare global, with no fallback copy.
 */
const DR_DETECTION_SETTINGS = {
  // --- Nomination step ---
  nestingDepth: 1,
  // --- Grid detection ---
  gridMinChildren: 5,
  // The most ancestors any detection walk climbs.
  gridWalkDepthCap: 15,
  gridSampleSize: 10,
  gridAlignmentAgreement: 0.8,
  gridRepetitionShare: 0.5,
  gridDisplayValues: ['grid', 'flex', 'inline-grid', 'inline-flex'],
  // --- Data test ---
  dataTestCellBudget: 1000,
  // --- Vendor grids ---
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
  // --- Re-apply observer ---
  // The observer runs one pass for a burst of page edits inside a simplified
  // table once the edits stop for this long. The content script waits the
  // same before it re-tests a pending table.
  settleDelayMs: 100,
  // A table the page updates more often than the settle delay never goes
  // quiet, so the observer runs a pass once a burst has lasted this long.
  reapplyMaxWaitMs: 1000,
  // In Chrome on the test page, a pass over 10,000 cells took 44 to 57 ms.
  reapplyCellCap: 10000,
  // A pass that runs longer than this writes a debug row with its duration.
  // Such a pass is more than three times slower than the slowest pass
  // measured at the cell cap.
  passTargetMs: 200,
  // --- Pending tables ---
  // Failed re-tests a pending table takes before its subtree observer drops.
  pendingRetestCap: 100,
  // --- Accessibility artifact check ---
  offscreenLeftPx: -9999,
};
