// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT
/**
 * Every shared constant in the extension.
 *
 * The content script loads this file through the manifest's content_scripts,
 * and the sidebar page through a script tag. The service worker does not load
 * it. The Sheets build copies the whole file into the plugin library, and the
 * plugin simplifies under DR_DEFAULTS. A constant that more than one component
 * reads belongs here, whatever kind of constant it is — a reader looks in one
 * place.
 *
 * DR_DEFAULTS is the settings contract: every option's name and its default.
 * Every key that starts with "simplify" is a switch: the data test turns each
 * one on (lib/dr-table/detect.js), and the sidebar draws one control for each.
 */
const DR_DEFAULTS = {
  // Off: a table no one has turned on shows the original.
  enabled: false,
  simplifyMixedCurrency: true,
  simplifyMixedPercent: true,
  simplifyFirstRow: false,
  simplifyFirstColumn: false,
  simplifyDates: true,
  simplifyTimes: false,
  dateGranularity: 'year',
  timeGranularity: 'hour',
  offsetTop: -0.5,
  offsetOther: -0.5,
  numTop: 1,
  rangeExpr: ''
};

/**
 * The detection settings. docs/vocabulary.md defines what they hold. Every
 * reader reads DR_DETECTION_SETTINGS as a bare global, with no fallback copy.
 */
const DR_DETECTION_SETTINGS = {
  // --- Nomination step ---
  // At 1, the nomination step registers a vendor grid's scrolling pane and
  // leaves the pinned pane, which holds the row-number column, outside the
  // table. The first-column exclusion then reaches the first data column, and
  // a range expression counts that column as column A. A pinned pane that
  // holds real data stays outside the table at this depth.
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
  // Known third-party grid libraries. looksLikeGrid skips its alignment step
  // for an element whose class holds a `classToken`. GridAdapter finds its
  // scroll container and pinned pane through `scrollContainerSelectors` and
  // `pinnedPaneSelectors`.
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
  // The re-apply observer writes a debug row with a pass's duration when the
  // pass runs longer than this. Such a pass is more than three times slower
  // than the slowest pass measured at the cell cap.
  passTargetMs: 200,
  // --- Pending tables ---
  // Failed re-tests a pending table takes before the content script drops its
  // subtree observer. A re-test runs only after a subtree change and the
  // settle delay, so the count grows only while the subtree keeps changing,
  // and each re-test reads at most the data test's cell budget. At the fastest
  // rate, 100 re-tests take about ten seconds and half a second of processing.
  // Under a lower cap, a table whose query is slow stays unregistered when its
  // loading state keeps changing the subtree.
  pendingRetestCap: 100,
  // The most pending tables of both kinds on one page at once. A page that
  // draws its data tables before their rows holds a few; a page laid out with
  // tables, such as an email client, can hold hundreds that never pass the
  // data test. 50 is an estimate between the two: room for the first, and no
  // watch on every layout table of the second. Past it, a table that fails the
  // data test is not watched.
  pendingTableCap: 50,
  // --- Accessibility artifact check ---
  offscreenLeftPx: -9999,
};
