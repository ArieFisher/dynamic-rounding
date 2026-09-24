/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// Constants
// CLEAN_REGEX, PARENS_REGEX, DEFAULT_OFFSET_TOP, DEFAULT_NUM_TOP, and
// VALIDATION_LIMIT live in core.js (loaded ahead of this file); they are used
// here too via shared global scope.

// EPSILON, X_FLOOR_THRESHOLD, roundWithOffset, and roundCellSetAware live in
// rounding.js, loaded by manifest content_scripts ahead of this file. The
// sidebar loads rounding.js separately via a script tag in sidebar.html.

// DR_DEFAULTS is loaded from constants.js (declared first in manifest content_scripts).
// It is shared with sidebar.js so the sidebar UI's initial state and the
// right-click toggle's fallback options come from a single source.

// The capture marker: a saved capture (lib/dr-capture/render.js) stamps
// data-dr-capture on its document element, because the capture is itself a
// page with a real table and — with file access enabled — Chrome injects
// this content script into it. On such a page the controller stands down:
// no contextmenu selection, no load-time scan, no observer, so no table in
// a capture is ever registered, selected, or rounded. A capture must show
// what was captured, never what this extension would do to it. Page rules
// cannot enforce this (a page's Content-Security-Policy does not apply to
// an extension's injected code), so the guard sits here.
const IS_CAPTURE_PAGE = !!(typeof document !== 'undefined' && document.documentElement &&
  document.documentElement.dataset && document.documentElement.dataset.drCapture !== undefined);

let lastRightClickedElement = null;
// The active table lives in DR_STORE now, not as a file-level binding here.
// It may hold a <table> element or a div-based grid root — any element
// carrying class dr-ext-grid or returned by findTargetTable's .handle — so
// every caller that once assumed HTMLTableElement must tolerate any Element.
// A second field beside it held whether the sidebar stood open until the
// 2026-09-14 sidebar-state-removal design retired it (#241).
// ui-toggle.js used to assign the active
// table directly into this file's `let lastRightClickedTable`; it now
// publishes an intent instead (see the DR_BUS.subscribe call below), and
// every read and write in this file goes through DR_STORE's getters and
// setters.

// The controller is the sole subscriber to intent topics. ui-toggle.js
// publishes 'intent:selectTable' instead of writing this file's variables
// directly; this is where that intent turns into a model change.
DR_BUS.subscribe('intent:selectTable', ({ table }) => {
  DR_STORE.setSelectedTable(table);
});

// The bus's first state-change subscriber (see adapters/messaging.js's depth
// guard, issue #240): whenever the model's settings change — regardless of
// source — apply the new value to whichever table is currently selected.
// The sidebar's settings apply reaches the model through the responder below
// (its DR_STORE.setSettings is what triggers this subscriber); this also
// covers any in-context caller that sets settings without going through that
// request.
DR_BUS.subscribe('state:settingsChanged', ({ settings }) => {
  const selected = DR_STORE.getSelectedTable();
  if (selected) {
    applySidebarRounding(selected, settings);
  }
});

// Every row at one of the log module's error levels (warn and error) is an
// extension error: it lands in the model's error state, whose state change
// the toast view (ui-toast.js) draws and the capture carries. Debug and info
// rows stay out. The level list lives in the log module, which uses the same
// list to decide which rows carry a stack trace. The listener lives here and
// not in the log module because the log module loads before the model and
// the bus and reaches neither. A row recorded inside a bus handler publishes
// one level deeper; the toast view never logs, so the chain ends there.
DR_LOG.onRow((row) => {
  if (DR_LOG.ERROR_LEVELS.includes(row.level)) DR_STORE.recordError(row);
});

// The sidebar's settings apply. Record it; the state-change subscriber above
// applies it to the table. The answer's only job is to exist: the sidebar
// reads that someone answered and stays bound.
DR_BUS.respond('request:applySettings', ({ settings }) => {
  DR_STORE.setSettings(settings || DR_DEFAULTS);
  return { ok: true };
});

// ui-toggle.js's click handler reports every committed toggle activation
// (an immediate mouse/keyboard click, or the second tap of a touch/pen
// two-tap) as this one intent. The menu toggle reports the same intent from
// its MENU_CLICKED listener below. This is where that intent turns into one
// controller action, and there is exactly one.
//
// Three branches used to live here (2026-09-14 spec, part one). The first
// read the application model's copy of whether the sidebar stood open, to
// determine whether a press on a different table meant "rebind the sidebar"
// or "turn this table on", and it was the extension's only reader of that
// value. The page could not keep the value true to the sidebar: the service
// worker lost the tab number it needed to send the correction, both on an
// idle restart and on an ordinary close, so a press on a second table
// silently became a rebind for the rest of the page's life (#241). The
// value, its model field, and its state-change topic are all gone, and this
// path reads nothing about the sidebar.
//
// The rules, in the order they matter:
//
//   1. The flip direction comes from the screen BEFORE any write. The
//      settings write below publishes, and that publish applies to the
//      active table, so a direction read afterward would read our own
//      output: a press on a raw table would simplify it, then read
//      "simplified" and write off, and the second apply would reset it —
//      the press would land back where it started.
//   2. Activation precedes the write, so the sidebar receives the new
//      active table before any APPLY_BLOCKED/APPLY_OK for it. The existing
//      suite pins that order.
//   3. Exactly one settings write per press. It carries the flipped enabled
//      and, where the press moved the active table, the cleared range
//      expression (see below). The state-change subscriber above runs the
//      single apply.
//
// The range expression states rows and columns by position, so it describes
// the table it was written for. Carrying it to a second table addresses
// different data, and an expression the parser rejects would stop the press
// before any cell changed, with RANGE_ERROR reaching a sidebar that may
// stand closed. A press that moves the active table therefore clears it. A
// press on the table that is already active keeps it: that table is the one
// the expression describes. #328 replaces the clear with a per-table
// expression.
DR_BUS.subscribe('intent:toggleTable', ({ table: pressedTable }) => {
  // Rule 0: the shape check runs before rule 1's screen read. A press on a
  // table the page has refilled therefore reads the fresh entry's raw form
  // and turns simplification on, where a read of the discarded entry would
  // report a simplification of values no longer on the screen. The press
  // continues on the element the check returns, which is a different element
  // where a new result set moved the registration. A shape change that
  // registers nothing stops the press here.
  const revalidated = revalidateTableShape(pressedTable);
  if (!revalidated.table) return;
  const target = revalidated.table;

  // Rule 1: read the screen first.
  const nextEnabled = !isTableRounded(target);
  // A shape change counts as a move on its own. The fresh entry registered a
  // moment ago and holds nothing, and the range expression states rows and
  // columns by position, so it describes a shape that is gone.
  const moved = revalidated.switched || target !== DR_STORE.getSelectedTable();

  if (moved && !revalidated.switched) {
    // Rule 2. Reported as an intent rather than written here, so one intent
    // stays the single place a table becomes active even when a second
    // intent (toggle) is what triggered it. A shape change published both of
    // these from the check above, so this block covers the ordinary moved
    // press alone.
    DR_BUS.publish('intent:selectTable', { table: target });
    DR_BUS.publish('state:tableSwitched', {});
  }

  // Rule 3: one write. A moved press clears the range expression in the
  // same write, so the clear cannot apply on its own.
  const patch = { enabled: nextEnabled };
  if (moved) patch.rangeExpr = '';
  DR_STORE.setSettings(Object.assign({}, DR_STORE.getSettings(), patch));

  // The sidebar receives the new value once. A moved press already sent
  // TABLE_SWITCHED, and the sidebar's handler for it re-reads the settings
  // record, so a send here would be a second delivery of the same fact. On a
  // locked table it would carry a value the apply then blocks. An unmoved
  // press sends no TABLE_SWITCHED, which leaves this the only path. With the
  // sidebar closed no page receives either send; while the #262 lock holds,
  // the open sidebar routes this one to its stash instead of the forced-ON
  // switch.
  if (!moved) {
    DR_BUS.publish('state:tableEnabledChanged', { enabled: nextEnabled });
  }
});

// The options used for the most recent roundTable() run, the frozen grid
// magnitude basis, the simplified/original flag, and every cell's pre-round
// original now live in DR_STORE's per-table registry entry (app/store.js) —
// not a file-level WeakMap here.

// Grid virtualization re-apply state.
// gridObservers: wrapperEl → MutationObserver watching the scroll container.
// gridReapplyTimers: wrapperEl → pending setTimeout id for the debounced re-apply.
const gridObservers = new WeakMap();
const gridReapplyTimers = new WeakMap();

// Pending table state, keyed by chain root. A chain root whose chain is empty
// — no element of its nest passes the data test — becomes a pending table:
// the grid arrived before its rows, and the rows may still arrive.
// pendingObservers:   chainRootEl → MutationObserver watching the whole subtree.
// pendingRetestTimers: chainRootEl → pending setTimeout id for the debounced re-test.
// pendingRetestCounts: chainRootEl → failed re-tests so far, against
//                      DR_DETECTION_SETTINGS.pendingRetestCap.
// pendingRoots is the enumerable companion to the three WeakMaps, the way
// trackedTables accompanies the registry: the table observer's removal branch
// walks it to find a pending root inside a removed subtree.
const pendingObservers = new WeakMap();
const pendingRetestTimers = new WeakMap();
const pendingRetestCounts = new WeakMap();
const pendingRoots = new Set();


// findTargetTable() only reports what it found; it never writes the
// dr-ext-grid marker or builds the toggle widget. When it discovers a grid
// root for the first time (found.isNew), this caller does both, exactly as
// findTargetTable used to do internally before the sprint that split
// detection into lib/dr-table.
function markAndToggleIfNewGrid(found) {
  if (found.isNew) {
    found.handle.classList.add('dr-ext-grid');
    createToggleForTable(found.handle);
  }
  return found.handle;
}

// Every findTargetTable() call site passes DR_STORE.hasTable as isSeen —
// detection stays decoupled from the model (see lib/dr-table/detect.js), but
// the controller is exactly where "have we found this" ought to answer from
// the registry rather than the dr-ext-grid marker class.
document.addEventListener('contextmenu', (event) => {
  if (IS_CAPTURE_PAGE) return;
  lastRightClickedElement = event.target;
  const found = findTargetTable(event.target, { isSeen: DR_STORE.hasTable });
  if (found) {
    const table = markAndToggleIfNewGrid(found);
    DR_STORE.setSelectedTable(table);
    DR_LOG.debug("Dynamic Rounding: table activated by right-click.");
    flashTargetedTable(table);
    DR_BUS.publish('state:tableActivated', {});
  }
}, true);

// roundTable (the simplification engine) no longer sends chrome messages
// itself — it returns { applied, rangeStatus: 'ok'|'error', error } and
// leaves messaging to the controller. Every call site sends the same
// RANGE_ERROR/RANGE_OK message the engine used to send, unconditionally,
// so observable messaging is unchanged.
function sendRangeStatusMessage(result) {
  if (result.rangeStatus === 'error') {
    DR_BUS.publish('state:rangeError', { error: result.error });
  } else {
    DR_BUS.publish('state:rangeOk', {});
  }
}

// The menu item reports the same intent a pillbox press reports, so both run
// the one controller path above (issue #275). The right-click that opened the
// menu already made the table active (the contextmenu handler's
// setSelectedTable), so the press lands as an unmoved one: it flips the
// settings record's on/off value and keeps the range expression.
DR_BUS.subscribe('intent:menuClicked', () => {
  if (!lastRightClickedElement) return;
  const found = findTargetTable(lastRightClickedElement, { isSeen: DR_STORE.hasTable });
  if (!found) {
    DR_LOG.debug("Dynamic Rounding: No table found at right-click location.");
    return;
  }
  DR_BUS.publish('intent:toggleTable', { table: markAndToggleIfNewGrid(found) });
});

// Reconnect: pull the model's own selection and settings — the sidebar may be
// reopening after a close, and DR_STORE owns both of record.
DR_BUS.subscribe('state:sidebarOpened', () => {
  const selected = DR_STORE.getSelectedTable();
  if (!selected) {
    DR_LOG.debug("Dynamic Rounding: No table targeted. Right-click a table cell first.");
    return;
  }
  applySidebarRounding(selected, DR_STORE.getSettings());
  // Tell the sidebar its view is stale; it re-reads the model's settings and
  // re-asks for preview samples against the now-current targeted table.
  DR_BUS.publish('state:previewSamplesChanged', {});
});

// The sidebar's three reads of the model. Each answers from the tab's own
// copy — the sidebar holds none of its own, so a close and reopen loses
// nothing.
DR_BUS.respond('request:settings', () => ({ settings: DR_STORE.getSettings() }));

// No selected table answers nulls rather than nothing: the sidebar reads a
// null samples field as the unbound state, and an unanswered request reaches
// it as that same unbound state by a different path.
DR_BUS.respond('request:previewSamples', () => {
  const selected = DR_STORE.getSelectedTable();
  if (!selected) return { samples: null, maxMag: null };
  return extractPreviewSamples(selected);
});

DR_BUS.respond('request:captureState', () => buildCaptureStateResponse());

window.addEventListener('pagehide', () => {
  DR_BUS.publish('state:pageUnloaded', {});
});

function applySidebarRounding(requestedTable, options) {
  // The shape check runs before the reset, so a table the page refilled is
  // discarded and registered fresh rather than reset against originals that
  // belong to cells no longer on the screen. The locked path below sits
  // after this check for the same reason: a locked table whose shape changed
  // is a replaced table, and its lost originals stop mattering once the
  // entry holding them is gone. The apply continues on the element the check
  // returns, which is a different element where a new result set moved the
  // registration. A shape change that registers nothing stops the apply.
  const revalidated = revalidateTableShape(requestedTable);
  if (!revalidated.table) return;
  const table = revalidated.table;

  const opts = Object.assign({}, DR_DEFAULTS, options || {});
  ensureHighlightStyleInjected();
  const unrestorableCount = resetTable(table);
  if (unrestorableCount > 0) {
    // The refusal case: at least one cell's registry original is gone (a content-script re-injection — see
    // restoreTable's KNOWN ACCEPTED COST doc). Running roundTable now would
    // round the already-rounded text, stamp a false "Original: ..." title
    // over the one attribute that still holds the truth, and record the
    // rounded value as the registry original of record. resetTable already
    // left every such cell untouched and the appliedFlag truthful; tell the
    // sidebar why nothing changed and stop. APPLY_OK below clears the
    // notice once an apply works again (a table switch, or the site
    // re-rendered the table with fresh cells).
    DR_LOG.warn("Dynamic Rounding: apply blocked; " + unrestorableCount + " cell(s) unrestorable.");
    DR_BUS.publish('state:applyBlocked', { count: unrestorableCount });
    return;
  }
  DR_BUS.publish('state:applyOk', {});
  if (opts.enabled !== false) {
    const result = roundTable(table, opts);
    sendRangeStatusMessage(result);
    DR_LOG.debug("Dynamic Rounding: apply ran (applied=" + result.applied + ", rangeStatus=" + result.rangeStatus + ").");
    if (table.querySelector('.dr-ext-rounded')) {
      DR_BUS.publish('intent:updateMenuLabel', { title: 'Toggle table' });
    }
  } else {
    DR_LOG.debug("Dynamic Rounding: apply ran with rounding off; table reset.");
    DR_BUS.publish('intent:updateMenuLabel', { title: 'Toggle table' });
  }
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  flashRangePulse(table, rangeParse.error ? null : rangeParse.ranges);
  syncSwitchForTable(table);
}

// The one consumer of the nomination step's per-nest outcomes. Both live
// scanners route their grid pass through here — the load-time scan in the
// pillbox view (injectTableToggles) and the added-node pass below — so the
// pending record and its clearing sit behind the step's outcome and never in
// a caller. The step reports; this is where a report becomes a registration
// or a watch.
//
// The step's results hold grids alone: each scanner's own pass 1 covers native
// <table> elements, and the nomination step's two guards keep a native table
// out of a nest. So no tagName check sits here.
function consumeNominations(results) {
  for (const result of results) consumeNomination(result);
}

// One nest's outcome:
//   'selected'   register the element the step selected and drop any pending
//                record the nest carried.
//   'empty'      no element of the nest passes the data test, so hold the
//                chain root as a pending table and re-test its subtree.
//   'crowded'    a depth holds more than one data table and no shallower
//                depth holds exactly one; the product decision in issue #373
//                registers nothing for such a nest, so no watch holds it.
//   'registered' the nest already holds a registered element, so a second
//                registration would put a second pillbox on one grid.
// A registration through another path — right-click, once that sprint lands —
// leaves the pending record standing until the next re-test returns
// 'registered', which drops it here.
function consumeNomination({ chainRoot, selected, outcome }) {
  if (outcome === 'selected') {
    dropPendingTable(chainRoot);
    selected.classList.add('dr-ext-grid');
    createToggleForTable(selected);
    return;
  }
  if (outcome === 'empty') {
    holdPendingTable(chainRoot);
    return;
  }
  dropPendingTable(chainRoot);
}

// Hold a chain root as a pending table, or count a re-test that failed again.
//
// The first 'empty' outcome for a root starts the record: one debounced
// subtree observer, and a count of 0. Every later 'empty' outcome for the
// same root is a failed re-test and counts against DR_DETECTION_SETTINGS.pendingRetestCap;
// reaching the cap drops the observer, the timer, and the count, so a region
// that never holds data costs a bounded amount of processing.
//
// One observer per chain root, whatever the number of qualifying elements
// under it: the nomination step keys its results by chain root, so a nest of
// three role-bearing elements produces one outcome and one watch.
function holdPendingTable(chainRoot) {
  if (pendingRoots.has(chainRoot)) {
    const count = (pendingRetestCounts.get(chainRoot) || 0) + 1;
    pendingRetestCounts.set(chainRoot, count);
    if (count >= DR_DETECTION_SETTINGS.pendingRetestCap) {
      dropPendingTable(chainRoot);
      DR_LOG.debug("Dynamic Rounding: pending table dropped after " + count + " failed re-tests.");
    }
    return;
  }
  if (typeof MutationObserver === 'undefined') return;
  // childList and characterData both, subtree wide: rows arrive as added
  // nodes, and a cell filled in place changes text alone. The debounce copies
  // the re-apply observer's: each mutation cancels the pending timer and
  // schedules a fresh one, so a burst of rows costs one re-test.
  const observer = new MutationObserver(() => {
    const pending = pendingRetestTimers.get(chainRoot);
    if (pending !== undefined) clearTimeout(pending);
    const timerId = setTimeout(() => {
      pendingRetestTimers.delete(chainRoot);
      retestPendingTable(chainRoot);
    }, DR_DETECTION_SETTINGS.gridRedrawDelayMs);
    pendingRetestTimers.set(chainRoot, timerId);
  });
  observer.observe(chainRoot, { childList: true, characterData: true, subtree: true });
  pendingObservers.set(chainRoot, observer);
  pendingRetestCounts.set(chainRoot, 0);
  pendingRoots.add(chainRoot);
}

// Re-run the nomination step from a pending root and consume the outcome
// through the same function the scanners use, so a re-test that passes
// registers exactly what the load-time scan would have registered.
function retestPendingTable(chainRoot) {
  consumeNomination(nominateNest(chainRoot, { isSeen: DR_STORE.hasTable }));
}

// Drop a pending record whole: the debounce timer, the subtree observer, the
// failed-re-test count, and the root's membership in the enumerable set.
// Safe on a root that holds no record.
function dropPendingTable(chainRoot) {
  const timerId = pendingRetestTimers.get(chainRoot);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    pendingRetestTimers.delete(chainRoot);
  }
  const observer = pendingObservers.get(chainRoot);
  if (observer) {
    observer.disconnect();
    pendingObservers.delete(chainRoot);
  }
  pendingRetestCounts.delete(chainRoot);
  pendingRoots.delete(chainRoot);
}

// Detect and attach toggles for tables and grids inside (or equal to) a node
// added to the page. Pass 1 covers native <table> elements, skipping the
// accessibility artifacts issue #128 calls out, so a dynamically rendered
// single-page-application grid is found and an off-screen chart fallback is
// not. Pass 2 hands the grids to the nomination step in the detection layer
// (nominateNests), which lists the added node itself when it carries a grid or
// table role, walks out to the node's chain root, and reports one outcome per
// nest — the same step the load-time scan runs. The walk out matters here: a
// node added inside a wrapper already in the page re-evaluates the whole nest
// rather than registering itself, and it is the route by which a pending
// table registers once its rows arrive.
// Extracted as a named function so the detection is unit-testable
// independently of the live MutationObserver wiring below.
function injectTogglesForAddedNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  // Pass 1: native <table> elements; phantom a11y tables are skipped.
  if (node.tagName === 'TABLE' && !DR_STORE.hasTable(node) && !isPhantomA11yTable(node)) {
    createToggleForTable(node);
  }
  if (typeof node.querySelectorAll === 'function') {
    node.querySelectorAll('table').forEach(table => {
      if (!DR_STORE.hasTable(table) && !isPhantomA11yTable(table)) {
        createToggleForTable(table);
      }
    });
  }
  // Pass 2: the nomination step, consumed above.
  consumeNominations(nominateNests(node, { isSeen: DR_STORE.hasTable }));
}

// The shape fingerprint's read options for one table: the registry's stored
// pre-simplification text per cell. The recording site (createToggleForTable)
// passes the same thing, so a header cell the extension itself simplified
// still reads as the text the registry recorded, and the extension's own
// writes never read as a page change.
function fingerprintReadOpts(table) {
  return { originalText: (cellEl) => DR_STORE.getTableOriginalText(table, cellEl) };
}

// Check a registered table's shape against the fingerprint the registry
// recorded, and recover when the two differ. Every action on a registered
// table runs this first, and acts on the element it returns.
//
// A match returns the same table and changes nothing.
//
// A mismatch means the page put different content in this element — a new
// result set, a different column set — so the entry describes data no longer
// on the screen: its cell originals belong to cells that are gone, and its
// form reports a simplification of values no one can see. The entry is
// discarded whole, and the nomination step re-runs from the nest's chain
// root, because a new result set can change which element of the nest passes
// the data test: a pinned pane that now holds two columns puts two elements
// at the configured depth, and the edge rule falls back to the wrapper. The
// fresh registration can therefore land on a different element than the one
// the action named. The fresh element becomes active through the same intent
// a moved press publishes, and the table-switched topic carries the move to
// the sidebar.
//
// The switch publishes even where the fresh registration lands on the same
// element: the entry is new either way, with no originals and a raw form, and
// the sidebar re-reads the settings record on that topic.
//
// A table with no recorded fingerprint compares against nothing and returns
// as a match. Only a first write through the registry's setters creates such
// an entry, never createToggleForTable, and discarding an entry over a
// reading that never happened would throw away originals for no finding.
//
// Nothing registering — the whole nest fails the data test — returns null,
// and the caller stops. The discarded table was the active one in that case
// too, so the active table clears: it may not point at an element the
// registry no longer holds.
//
// @returns {{table: Element|null, switched: boolean}}
function revalidateTableShape(table) {
  const recorded = DR_STORE.getTableFingerprint(table);
  if (!recorded) return { table, switched: false };
  if (sameTableFingerprint(recorded, readTableFingerprint(table, fingerprintReadOpts(table)))) {
    return { table, switched: false };
  }

  DR_LOG.debug("Dynamic Rounding: table shape changed; re-running detection.");

  // The order is restore, tear down, re-nominate, register, activate,
  // publish.
  //
  // The restore runs first, against the old entry while it still holds the
  // originals. A page that widens a table and leaves the rest of each row in
  // place leaves the extension's own simplified text on those surviving
  // cells, with its marker class on them. Discarding the entry first would
  // drop the originals behind that text: the fresh registration would read
  // the simplified values as the cells' own, the apply would report every
  // one of them unrestorable, and the table would stand locked with no route
  // back. Restoring first puts raw text in every surviving cell, so the
  // fresh registration records its fingerprint over raw text and simplifies
  // from there. A cell whose original is gone stays as it is, the same as
  // any other restore. The originals go back into the cells and nowhere
  // else, so none of them reaches the fresh entry.
  resetTable(table);
  teardownTableEntry(table, 'replaced');

  // findTables on a <table> root returns that table in pass 1, so one call
  // covers a native table and a grid alike.
  const root = table.tagName === 'TABLE' ? table : (chainRootOf(table) || table);
  let fresh = null;
  for (const { handle, isNew } of findTables(root, { isSeen: DR_STORE.hasTable })) {
    if (!isNew) continue;
    if (handle.tagName !== 'TABLE') handle.classList.add('dr-ext-grid');
    createToggleForTable(handle);
    // createToggleForTable registers only what passes the data test, so the
    // registry is what reports whether this element registered.
    if (!fresh && DR_STORE.hasTable(handle)) fresh = handle;
  }

  if (!fresh) {
    DR_LOG.debug("Dynamic Rounding: no table registered after the shape change.");
    if (DR_STORE.getSelectedTable() === table) DR_BUS.publish('intent:selectTable', { table: null });
    return { table: null, switched: false };
  }

  DR_BUS.publish('intent:selectTable', { table: fresh });
  DR_BUS.publish('state:tableSwitched', {});
  return { table: fresh, switched: true };
}

// Discard one table's registration and every per-table resource the
// extension holds beside it: the pillbox, the resize observer that keeps the
// pillbox positioned, a virtualized grid's re-apply observer and its pending
// debounce timer, the view's tracked-table list, and the registry entry with
// the cell originals and the form inside it. Two callers reach this: the
// removal observer, for a table the page took out; and the shape-fingerprint
// mismatch path, for a table whose shape no longer matches the one the
// registry recorded. `reason` names which, and reaches the debug row.
//
// The grid observer and its timer tear down here so a grid removed from the
// page cannot re-apply rounding after it leaves.
function teardownTableEntry(table, reason) {
  const button = tableToggles.get(table);
  if (button && button.parentElement) {
    button.parentElement.removeChild(button);
  }
  const ro = tableResizeObservers.get(table);
  if (ro) {
    ro.disconnect();
  }
  const pendingTimer = gridReapplyTimers.get(table);
  if (pendingTimer !== undefined) {
    clearTimeout(pendingTimer);
    gridReapplyTimers.delete(table);
  }
  const gridObs = gridObservers.get(table);
  if (gridObs) {
    gridObs.disconnect();
    gridObservers.delete(table);
  }
  trackedTables.delete(table);
  DR_STORE.unregisterTable(table);
  DR_LOG.debug("Dynamic Rounding: " + reason + " table unregistered.");
}

if (typeof MutationObserver !== 'undefined' && !IS_CAPTURE_PAGE) {
  ensureScrollResizeListeners();

  // MutationObserver to watch for dynamically added/removed tables and grids
  const _tableObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        injectTogglesForAddedNode(node);
      }
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // Find every table/grid this removed subtree contains by walking
        // DR_STORE's registered tables (the enumerable companion to its
        // WeakMap registry) instead of querying for the dr-ext-grid marker
        // class — the registry is the single "have we found this" answer
        // now, and it covers native tables too, so one loop replaces the
        // old tagName check + two separate querySelectorAll passes.
        for (const table of DR_STORE.getRegisteredTables()) {
          const contained = table === node ||
            (typeof node.contains === 'function' && node.contains(table));
          if (!contained) continue;
          teardownTableEntry(table, 'removed');
        }
        // The same sweep over the pending roots. A pending table holds no
        // registry entry, so the loop above passes over it; without this one
        // its subtree observer and debounce timer would outlive the element.
        for (const chainRoot of pendingRoots) {
          const contained = chainRoot === node ||
            (typeof node.contains === 'function' && node.contains(chainRoot));
          if (!contained) continue;
          dropPendingTable(chainRoot);
          DR_LOG.debug("Dynamic Rounding: removed pending table dropped.");
        }
      }
    }
  });

  // Start injecting toggles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectTableToggles();
      if (document.body) {
        _tableObserver.observe(document.body, { childList: true, subtree: true });
      }
    });
  } else {
    injectTableToggles();
    if (document.body) {
      _tableObserver.observe(document.body, { childList: true, subtree: true });
    }
  }
}

// --- End per-table toggle switch infrastructure ---

// registryOriginalsPort adapts DR_STORE's per-table registry entry to the
// OriginalsPort interface GridAdapter expects (see lib/dr-table/detect.js) —
// the one place a grid's per-cell originals leave the page (they used to be
// dataset.drOriginal) and enter the application model. Every makeAdapter()
// call below that touches a grid's cell text passes this so read and write
// go through the same store a native cell's write uses directly. It
// carries the grid cell's whole record (see applyPatches in detect.js).
function registryOriginalsPort(table) {
  return {
    has(cellEl) { return DR_STORE.hasTableOriginal(table, cellEl); },
    get(cellEl) { return DR_STORE.getTableOriginal(table, cellEl); },
    set(cellEl, record) { DR_STORE.setTableOriginal(table, cellEl, record); },
  };
}

// Restore a table's rounded cells to their pre-round originals, reading from
// DR_STORE's registry instead of page attributes (dataset.originalValue/
// originalHtml/drOriginal used to carry this, with two separately-written
// restore branches). Dispatches once on table kind — native tables restore
// via innerHTML, grids by putting each stored piece's text back into the
// piece at its index — so the caller sees exactly one restore path
// regardless of which write model applies underneath.
//
// keepEntry: false (resetTable's full teardown) clears the dr-ext-rounded
// marker and the stored original per cell — a genuinely fresh state. true
// restores the display and keeps both, so a later pass finds these same
// cells again.
//
// NO CALLER PASSES true TODAY. The form flip that showed a table's originals
// while keeping its markers was the only one, and the 2026-09-14 sidebar-
// state-removal design retired it: a press that turns simplification off now
// resets the table outright. The branch stays because removing it changes
// this function's signature and its one caller's call, which is its own
// change rather than part of this one; #332 carries it.
//
// KNOWN ACCEPTED COST: registry-held originals do not survive Chrome
// re-injecting the content script, which page attributes did (a reload of
// the content script is a fresh DR_STORE, so re-detection just rebuilds the
// registry from the current DOM instead of resuming from stale data — the
// sprint judged that an acceptable trade for a single restore path).
//
// A cell with no registry entry (the accepted-cost case above) is left
// completely untouched: its dr-ext-rounded marker, its title (the last
// surviving copy of the true original, if the write path is still what set
// it), and its displayed text all stay exactly as they were. Clearing any
// of those for a cell that was NOT actually restored would claim a recovery
// that did not happen and destroy data that was still recoverable by eye
// even though the registry could no longer recover it programmatically.
// A grid cell that no longer holds a piece at every index its record stores
// counts the same way and stays the same way: the page redrew it with fewer
// pieces, so its originals have nowhere to go.
// Returns the count of cells left unrestored, so a caller can tell a
// genuine restore from a no-op one.
function restoreTable(table, keepEntry) {
  const roundedCells = table.querySelectorAll('.dr-ext-rounded');
  if (roundedCells.length === 0) return 0;
  const isGrid = makeAdapter(table).isVirtualized();
  let unrestorableCount = 0;
  for (const cell of roundedCells) {
    const original = DR_STORE.getTableOriginal(table, cell);
    if (original === undefined) {
      unrestorableCount++;
      continue;
    }
    if (isGrid) {
      if (!restoreTextPieces(cell, original.pieces)) {
        unrestorableCount++;
        continue;
      }
    } else {
      cell.innerHTML = original.html;
    }
    cell.removeAttribute('title');
    if (!keepEntry) {
      cell.classList.remove('dr-ext-rounded'); // === GRID_ROUNDED_CLASS
      DR_STORE.deleteTableOriginal(table, cell);
    }
  }
  return unrestorableCount;
}

// Returns the count of cells restoreTable could not restore (see its doc).
// A non-zero count means the screen still shows rounded text for at least
// one cell, so appliedFlag is left at 'simplified' — the truthful state —
// instead of 'original', which would claim a clean reset that did not
// happen for every cell.
function resetTable(table) {
  // --- Grid virtualization teardown (must happen BEFORE cell restore) ---
  // Clear any pending debounce timer so a queued re-apply cannot fire after reset.
  const pendingTimer = gridReapplyTimers.get(table);
  if (pendingTimer !== undefined) {
    clearTimeout(pendingTimer);
    gridReapplyTimers.delete(table);
  }
  // Disconnect the scroll/sort observer so it stops watching the scroll container.
  const gridObserver = gridObservers.get(table);
  if (gridObserver) {
    gridObserver.disconnect();
    gridObservers.delete(table);
  }
  // Also clear the stored options and frozen magnitude basis so
  // reapplyGridRounding (if somehow still in-flight) bails out harmlessly,
  // and so the next roundTable() call re-freezes fresh.
  DR_STORE.setTableRoundOptions(table, null);
  DR_STORE.setTableMaxMagnitude(table, null);

  const unrestorableCount = restoreTable(table, false);
  DR_STORE.setTableAppliedFlag(table, unrestorableCount > 0 ? 'simplified' : 'original');
  syncSwitchForTable(table);
  return unrestorableCount;
}

// --- Shared adapters between the classification ladder (lib/dr-simplify)
// and this file's DOM-touching call sites ---

// classifyCell (lib/dr-simplify) applies every text-only filter to a mixed-
// text cell's candidate matches (quote spans, superscript spans, era years)
// but cannot filter out numbers embedded inside an <a> element itself — that
// needs lib/dr-table's filterLinkMatches, which walks real text nodes. Since
// every one of these filters is an independent per-match predicate, running
// this one after the ladder's own filters yields the same final set as
// running all of them together (see lib/dr-simplify/ladder.js header). If
// filtering empties the match list, the cell downgrades to skip.
// staleFilteredIndices: when the caller is classifying a cell's *stored*
// pre-round text (the registry record's value — see DR_STORE.getTableOriginal)
// rather than the live cell, the live text no longer contains the original
// numStr values, so filterLinkMatches' substring search against live text
// nodes cannot locate them (and its fallback silently keeps everything,
// dropping the link filter with no signal). The simplification pass already
// ran filterLinkMatches once, against the live text, at the moment it
// rounded the cell; the caller passes the surviving match indices from that
// run here (see the registry record's linkFilteredIdx, stored by each kind's
// writeCell in the simplification pass) so the same filter outcome applies
// instead of being silently skipped.
function finalizeExtractedDecision(decision, cell, staleFilteredIndices) {
  if (decision.mode !== 'extracted') return decision;
  const filtered = staleFilteredIndices
    ? decision.value.matches.filter((m) => staleFilteredIndices.has(m.index))
    : filterLinkMatches(cell, decision.value.matches);
  if (filtered.length === 0) return { mode: 'skip', reason: decision.reason };
  return { mode: 'extracted', reason: decision.reason, value: { matches: filtered } };
}

// Adapts a classifyCell decision to the { mode, num, ambiguous, month, day,
// year, matches } shape the one simplification pass below reads in its
// column post-pass, its max magnitude, and its patch step, on both table
// kinds.
function decisionToLegacyInfo(decision) {
  if (decision.mode === 'pure') return { mode: 'pure', num: decision.value.num };
  if (decision.mode === 'extracted') return { mode: 'extracted', matches: decision.value.matches };
  if (decision.mode === 'date') {
    return decision.pending === 'ambiguous-date'
      ? { mode: 'date', ambiguous: decision.value.ambiguous }
      : { mode: 'date', month: decision.value.month, day: decision.value.day, year: decision.value.year };
  }
  if (decision.mode === 'time') return { mode: 'time' };
  return { mode: 'skip' };
}

// --- Preview-band sample extraction (consumed by sidebar via IPC) ---

// Walk every <td> in the table and return its trimmed text + parsed number,
// via the same classification ladder (lib/dr-simplify) the engine uses, so a
// cell only appears here if the engine would actually change it. Restricted
// to mode:'pure' and mode:'extracted' decisions — this preview band is about
// numeric magnitude/offset, not date/time granularity, so mode:'date' and
// mode:'time' decisions are deliberately left out of the sample pool even
// though the ladder classifies them.
//
// options defaults to DR_DEFAULTS when the caller passes none (tests exercise
// the ladder's option-gated rules directly this way); the real call site,
// extractPreviewSamples below, passes the model's live settings so the
// preview band classifies cells exactly as roundTable will.
function collectNumericCells(table, options) {
  const opts = Object.assign({}, DR_DEFAULTS, options || {});
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  // An invalid range expression makes the engine round nothing at all
  // (roundTable returns before touching any cell); mirror that here instead
  // of falling back to "whole table".
  if (rangeParse.error) return [];
  const ranges = rangeParse.ranges;

  const out = [];
  const adapter = makeAdapter(table, { originalsPort: registryOriginalsPort(table) });
  // A cell classifies as roundTable classifies it — each decision placed in
  // the cell's text pieces — so the preview lists only numbers the table
  // rounds.
  const isGrid = adapter.isVirtualized();
  const rows = adapter.getRows();
  for (let r = 0; r < rows.length; r++) {
    // Outside rows never feed the preview pool — the lens preview shows the
    // dataset, and an outside row rounds against it without joining it.
    if (rows[r].isOutside) continue;
    const cells = rows[r].getCells();
    for (let c = 0; c < cells.length; c++) {
      const cellObj = cells[c];
      if (cellObj.tagName !== 'TD') continue;
      // Issue #2: when the table is already simplified, read the stored original
      // rather than the rounded text now showing in the cell. A rounded native
      // cell holds a { html, value, supRanges, linkFilteredIdx } record in the
      // registry, and a rounded grid cell a { value, pieces, supRanges,
      // linkFilteredIdx } record; value is the pre-round text either way. A
      // record whose supRanges or linkFilteredIdx is null falls back to the
      // live reads below.
      const cellEl = cellObj.el;
      const storedRecord = cellEl ? DR_STORE.getTableOriginal(table, cellEl) : undefined;
      const usingStoredOriginal = !!storedRecord && typeof storedRecord === 'object';
      const storedOriginal = usingStoredOriginal ? storedRecord.value : undefined;
      const text = usingStoredOriginal ? storedOriginal : cellObj.getText();
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) continue;

      const hasSuperscript = !!(cellEl && cellEl.querySelector && cellEl.querySelector('sup'));
      // A rounded cell's <sup>-bearing text is stale: text above is the
      // pre-round original, but rounding shortens the live text elsewhere in
      // the cell, so re-measuring ranges against the LIVE element would index
      // the wrong characters in the original string (see recordSupRanges in
      // the simplification pass, which stores the registry record's
      // supRanges against this exact text before the write). isWholeLink is
      // not similarly stale:
      // rounding only patches text-node values, never adds or removes <a>
      // elements, and the whole-link check compares live anchor text to live
      // cell text — both move together, so it stays correct read live. A
      // cell that WAS a whole link would have been skipped (never rounded),
      // so a rounded cell reaching here was never a whole link to begin with.
      let superscriptRanges = [];
      if (hasSuperscript) {
        if (usingStoredOriginal && storedRecord.supRanges) {
          superscriptRanges = storedRecord.supRanges;
        } else {
          superscriptRanges = getSuperscriptRanges(cellEl, { text });
        }
      }
      // Likewise, the link filter's live-text substring search cannot locate
      // the original numStr once the cell is rounded; reuse the match indices
      // the simplification pass already kept (the registry record's linkFilteredIdx)
      // instead of re-deriving from the (now mismatched) live text.
      let staleFilteredIndices = null;
      if (usingStoredOriginal && storedRecord.linkFilteredIdx) {
        staleFilteredIndices = new Set(storedRecord.linkFilteredIdx);
      }
      const classified = classifyCell({
        text,
        rowIndex: r,
        columnIndex: cellObj.columnIndex,
        ranges,
        isWholeLink: !!(cellEl && isCellWholeLink(cellEl)),
        hasSuperscript,
        superscriptRanges,
      }, opts);
      // A rounded native cell passed the placement step when it was written,
      // and its live pieces now hold the rounded text, so it skips the step.
      // A grid layout carries the record's stored piece text, so a grid cell
      // is placed either way.
      const placed = (isGrid || !usingStoredOriginal)
        ? placeDecision(classified, text, cellObj.getPieceLayout(), { hasSuperscript, stacked: isGrid })
        : classified;
      const decision = finalizeExtractedDecision(placed, cellEl, staleFilteredIndices);

      if (decision.mode === 'pure') {
        const { num } = decision.value;
        if (num !== 0 && isFinite(num)) out.push({ text: trimmed, num });
      } else if (decision.mode === 'extracted') {
        for (const { num: extractedNum } of decision.value.matches) {
          out.push({ text: trimmed, num: extractedNum });
        }
      }
      // mode:'date'/'time'/'skip' are not numeric-preview material — see the
      // function comment above.
    }
  }
  return out;
}

// Pick up to 2 large-magnitude + 3 smaller-magnitude representative samples
// for the sidebar preview band. Bucketed by magnitude (floor(log10|num|)) so
// the band shows the actual offset_top vs offset_other split that
// roundCellSetAware will apply to the table.
function extractPreviewSamples(table) {
  // Live settings, not shipped defaults — otherwise the preview band and the
  // table disagree the moment the sidebar's slider or checkboxes diverge
  // from DR_DEFAULTS (issue this sprint fixes).
  const liveSettings = DR_STORE.getSettings();
  const cells = collectNumericCells(table, liveSettings);
  if (cells.length === 0) {
    return { samples: { top: [], bottom: [] }, maxMag: null };
  }
  const numTop = liveSettings.numTop || 1;
  const topOffset = typeof liveSettings.offsetTop === 'number' ? liveSettings.offsetTop : -0.5;
  const otherOffset = typeof liveSettings.offsetOther === 'number' ? liveSettings.offsetOther : -0.5;

  // Reorder a magnitude bucket so cells that visibly *change* under the band's
  // default offset come first. Picking the raw document-order cell can land on
  // an already-round value (e.g. 250,000,000 → 250,000,000), making the preview
  // row look like rounding does nothing. Array.prototype.sort is stable, so
  // cells with the same "demonstrates rounding" verdict keep document order.
  const demoFirst = (bucket, offset) => bucket.slice().sort((a, b) => {
    const ca = roundWithOffset(a.num, offset) !== a.num ? 0 : 1;
    const cb = roundWithOffset(b.num, offset) !== b.num ? 0 : 1;
    return ca - cb;
  });

  const byMag = new Map();
  let maxMag = null;
  for (const c of cells) {
    const mag = Math.floor(Math.log10(Math.abs(c.num)));
    if (maxMag === null || mag > maxMag) maxMag = mag;
    if (!byMag.has(mag)) byMag.set(mag, []);
    byMag.get(mag).push(c);
  }

  // Top band: cells whose magnitude is within numTop of maxMag (i.e. cells
  // that roundCellSetAware will route to offset_top). Pick up to 2; prefer
  // distinct magnitudes.
  const topMags = Array.from(byMag.keys())
    .filter(m => (maxMag - m) < numTop)
    .sort((a, b) => b - a);
  const top = [];
  for (const m of topMags) {
    if (top.length >= 2) break;
    top.push(demoFirst(byMag.get(m), topOffset)[0]);
  }
  if (top.length < 2 && topMags.length > 0) {
    // Same magnitude has multiple cells — fill from the top bucket.
    const bucket = demoFirst(byMag.get(topMags[0]), topOffset);
    for (let i = 1; i < bucket.length && top.length < 2; i++) {
      top.push(bucket[i]);
    }
  }

  // Bottom band: one representative per remaining (lower) order of magnitude,
  // descending. Every distinct magnitude present gets its own example — there
  // is no cap — so e.g. a dataset of 1234 / 123 / -12 yields a top-band 1k+
  // line plus bottom-band 100+ and 10+ lines. Magnitude is floor(log10|num|),
  // so negatives bucket by their absolute value.
  const bottomMags = Array.from(byMag.keys())
    .filter(m => (maxMag - m) >= numTop)
    .sort((a, b) => b - a);
  const bottom = [];
  for (const m of bottomMags) {
    bottom.push(demoFirst(byMag.get(m), otherOffset)[0]);
  }

  const toRow = c => ({ original: c.text, num: c.num });
  return {
    samples: { top: top.map(toRow), bottom: bottom.map(toRow) },
    maxMag,
  };
}

// --- Capture state (consumed by the sidebar over request:captureState) ---

// The whole page-side half of a capture, in one response: the serialized
// registry (lib/dr-capture/state.js), plus what only this context holds —
// the page's own address and title, the lens preview for the bound table,
// and this context's log rows. Composed in a named function so the suite
// drives it directly (the bus's own message listener is a no-op stub there);
// the responder above only returns it.
//
// The cell-count row is recorded BEFORE the log snapshot is taken, so an
// oversized capture carries its own size evidence inside itself.
function buildCaptureStateResponse() {
  const state = collectCaptureState();
  const selected = DR_STORE.getSelectedTable();
  const cellCounts = state.tables.map(function (t) { return t.cells.length; });
  DR_LOG.debug('Dynamic Rounding: capture state collected (' + state.tables.length +
    ' table(s), cells per table: [' + cellCounts.join(', ') + ']).');
  // The serializer guards per table; this walk of the bound table is the one
  // step after it that can throw, and an unguarded throw here would discard
  // the whole page-side half — the serialized registry, the fixture seed,
  // and the log rows. On a throw: null, a warn row (taken into the snapshot
  // below), and the rest of the response stands.
  let lensPreview = null;
  if (selected) {
    try {
      lensPreview = extractPreviewSamples(selected);
    } catch (e) {
      DR_LOG.warn('Dynamic Rounding: lens preview extraction failed during capture (' +
        String(e && e.message ? e.message : e) + ').');
    }
  }
  return Object.assign({
    page: {
      url: typeof location !== 'undefined' ? location.href : null,
      title: (typeof document !== 'undefined' && typeof document.title === 'string')
        ? document.title : null,
    },
    lensPreview: lensPreview,
    log: DR_LOG.snapshot(),
  }, state);
}

// --- The one simplification pass ---
//
// Every simplification of a table runs simplifyTableCells below, on both
// table kinds: the first simplification of a native table (roundTable), the
// first simplification of a grid (roundTable), and the grid re-apply
// (reapplyGridRounding). The pass classifies every <td> through the
// classification ladder (lib/dr-simplify) and the placement step
// (placeDecision in lib/dr-table), resolves ambiguous dates per column,
// finds the max magnitude over the dataset, builds each cell's patches, and
// writes each changed cell through the patch writer, cell by cell in page
// order. A rule added to the pass reaches both table kinds at once.
//
// The adapters (lib/dr-table/detect.js) hold two differences between the
// kinds before the pass starts. getText() returns a native cell's rendered
// text, and a grid cell's flat text (its record's stored value once
// rounded). getPieceLayout()'s toFlat converts a native cell's rendered
// positions to flat positions, which livePatches reads; a grid cell's
// positions need no conversion, so its toFlat is null.
//
// Every other difference is a field of the kind object the caller passes,
// NATIVE_TABLE_PASS or GRID_TABLE_PASS:
//   stacked              whether the placement step runs the stacked-cell
//                        test. Grids only: a native cell's inline styling
//                        splits one number across two pieces ("1" plain,
//                        "23" in bold), which the test reads as two numbers.
//   splitReason, splitRow  the placement result that writes a debug row, and
//                        that row's text: a native value that crosses a
//                        piece boundary ('pieces'), a grid number split
//                        across two pieces ('split').
//   dateSplitRow         the debug row for a changed date or time whose text
//                        crosses a piece boundary.
//   superscriptRanges(table, cell, text)  the exponent ranges the ladder
//                        masks, for a cell holding a <sup>. The native kind
//                        measures them live, converted to the rendered text.
//                        The grid kind reads a rounded cell's stored ranges
//                        from its record, because its live text has shrunk
//                        or grown around the <sup> since.
//   recordSupRanges(entry)  the supRanges a written cell's record stores.
//                        The native kind measures every extracted cell live,
//                        before its write, so a vertical-align:super element
//                        with no <sup> counts. The grid kind stores the
//                        ranges the cell classified with, for an extracted
//                        cell with a <sup>, and null otherwise.
//   writeCell(table, entry, patches, linkFilteredIdx, supRanges)  writes
//                        one cell's live patches and returns how many
//                        landed. A native write stores the cell's
//                        { html, value, supRanges, linkFilteredIdx } record,
//                        its hover text, and the marker class in this file,
//                        and writes a warn row for each cell with a patch
//                        that did not land. A grid write goes through the
//                        cell object's applyPatches, which stores the
//                        { value, pieces, supRanges, linkFilteredIdx } record
//                        through the originals port and adds the marker
//                        class, with no hover text.
//   freezesMaxMagnitude  whether the first simplification stores the max
//                        magnitude as the table's magnitude freeze.
//   missedWritesRow(count)  the warn row the first simplification writes
//                        for the cells whose write landed nothing, or null
//                        when writeCell writes a row for each cell itself.
//
// The pass settings beside the kind:
//   frozenMaxMag  the max magnitude to use instead of computing it from the
//                 cells; null or undefined computes it. The grid re-apply
//                 passes the table's magnitude freeze.
//   writes        'first' writes every changed cell, stores a grid's max
//                 magnitude as its magnitude freeze, and writes the kind's
//                 missed-writes row. 'reapply' writes every changed cell and
//                 nothing else. 'none' writes nothing and returns each
//                 cell's patches (computeGridRoundedValues).
//
// A cell's writes follow its patches in the same loop, so a native table's
// debug and warn rows keep their page order. The patch step reads only what
// classification captured, never the page, so a write to one cell leaves the
// patches of the cells after it unchanged.

const NATIVE_TABLE_PASS = {
  stacked: false,
  splitReason: 'pieces',
  splitRow: 'Dynamic Rounding: a native cell value split across text pieces stays unchanged.',
  dateSplitRow: 'Dynamic Rounding: a native cell date or time split across text pieces stays unchanged.',
  superscriptRanges(table, cell, text) {
    return getSuperscriptRanges(cell, { text });
  },
  recordSupRanges(entry) {
    return entry.info.mode === 'extracted'
      ? getSuperscriptRanges(entry.cellObj.el, { text: entry.text })
      : null;
  },
  // The record holds the pristine HTML, the superscript ranges, and the
  // surviving (link-filtered) match indices, all measured against the
  // pre-round text before applyExtractedPatches changes it, and it is stored
  // only after a patch confirms the cell changed. collectNumericCells reads
  // the record back instead of re-measuring the rounded live element against
  // the stored original text; see finalizeExtractedDecision.
  writeCell(table, entry, patches, linkFilteredIdx, supRanges) {
    const cell = entry.cellObj.el;
    const originalRecord = { html: cell.innerHTML, value: entry.text, supRanges, linkFilteredIdx };
    const { landed } = applyExtractedPatches(cell, patches);
    if (landed < patches.length) {
      DR_LOG.warn('Dynamic Rounding: ' + (patches.length - landed) + ' of ' +
        patches.length + ' cell patches did not land.');
    }
    // Record only a confirmed change: with every patch skipped the screen
    // keeps its text, and storing the original, the hover text, or the
    // marker would record a simplification that never happened.
    if (landed === 0) return 0;
    DR_STORE.setTableOriginal(table, cell, originalRecord);
    cell.title = `Original: ${entry.text}`;
    cell.classList.add('dr-ext-rounded');
    return landed;
  },
  freezesMaxMagnitude: false,
  missedWritesRow: null,
};

const GRID_TABLE_PASS = {
  stacked: true,
  splitReason: 'split',
  splitRow: 'Dynamic Rounding: a grid cell number split across text pieces stays unchanged.',
  dateSplitRow: 'Dynamic Rounding: a grid cell date or time split across text pieces stays unchanged.',
  // A grid cell classifies its flat text, so getSuperscriptRanges takes no
  // `text` opt. collectNumericCells applies the same stored-ranges guard to
  // its own re-measure.
  superscriptRanges(table, cell) {
    const storedRecord = DR_STORE.getTableOriginal(table, cell);
    return (storedRecord && storedRecord.supRanges)
      ? storedRecord.supRanges
      : getSuperscriptRanges(cell);
  },
  // The ranges count in the cell's pre-round flat text, the same coordinate
  // space as the record's value.
  recordSupRanges(entry) {
    return (entry.info.mode === 'extracted' && entry.hasSuperscript) ? entry.superscriptRanges : null;
  },
  // A rounded cell's patches come from its stored original, so they land
  // only where the original still stands: a piece already patched is not
  // written again, a piece the framework redrew to its original is patched
  // again, and a piece the page rewrote keeps the page's text. applyPatches
  // stores the cell's record on its first landed write.
  writeCell(table, entry, patches, linkFilteredIdx, supRanges) {
    return entry.cellObj.applyPatches(patches, linkFilteredIdx, supRanges);
  },
  freezesMaxMagnitude: true,
  missedWritesRow(count) {
    return 'Dynamic Rounding: ' + count + ' grid cell write(s) did not land.';
  },
};

// The offsets, the top-band count, and the decimal floor, resolved once for
// the whole table. The decimal floor reflects the precision the offsets
// imply (e.g. offset 0.25 gives 2 decimals).
function resolveRoundingSettings(opts) {
  const offsetTop = resolveOffset(opts.offsetTop, DEFAULT_OFFSET_TOP);
  const offsetOther = resolveOffset(opts.offsetOther, offsetTop);
  return {
    offsetTop,
    offsetOther,
    numTop: resolveNumTop(opts.numTop, DEFAULT_NUM_TOP),
    floorDecimals: Math.max(decimalCount(offsetTop), decimalCount(offsetOther)),
  };
}

// Classify one <td>: the ladder, then the placement step. isCellWholeLink
// and the superscript ranges are DOM-only checks the pure ladder cannot
// perform itself (see lib/dr-simplify/ladder.js header), so they pass in as
// plain data. The link filter reads the live pieces. A rounded grid cell's
// kept numbers differ from the live text only in the pieces an earlier write
// patched, and a patch never lands there again, so the live read serves
// here; the lens preview reads the record's kept positions.
function classifyTableCell(table, cellObj, rowIndex, isOutside, opts, ranges, kind) {
  const cell = cellObj.el;
  const text = cellObj.getText();
  const layout = cellObj.getPieceLayout();
  const hasSuperscript = !!(cell.querySelector && cell.querySelector('sup'));
  const superscriptRanges = hasSuperscript ? kind.superscriptRanges(table, cell, text) : [];
  const placed = placeDecision(classifyCell({
    text,
    rowIndex,
    columnIndex: cellObj.columnIndex,
    ranges,
    isWholeLink: isCellWholeLink(cell),
    hasSuperscript,
    superscriptRanges,
  }, opts), text, layout, { hasSuperscript, stacked: kind.stacked });
  if (placed.reason === kind.splitReason) DR_LOG.debug(kind.splitRow);
  return {
    cellObj,
    text,
    trimmed: typeof text === 'string' ? text.trim() : '',
    info: decisionToLegacyInfo(finalizeExtractedDecision(placed, cell)),
    layout,
    col: cellObj.columnIndex,
    isOutside,
    hasSuperscript,
    superscriptRanges,
  };
}

// Classify every <td> of every row, in page order. A <th> is never rounded,
// but it still holds its column: the column index is the column the browser
// lays the cell out in (the adapter's reading, see assignGridColumns). A
// <th scope="row"> IS the table's first column as rendered, so in such a
// table the leading <td> is column B: "first column" (and range "A") target
// the header column, not the first data cell after it. An outside row rounds
// like any other; its entries carry isOutside so its values stay out of the
// dataset.
function classifyTableCells(table, adapterRows, opts, ranges, kind) {
  const entries = [];
  for (let r = 0; r < adapterRows.length; r++) {
    const isOutside = !!adapterRows[r].isOutside;
    for (const cellObj of adapterRows[r].getCells()) {
      if (cellObj.tagName !== 'TD') continue;
      entries.push(classifyTableCell(table, cellObj, r, isOutside, opts, ranges, kind));
    }
  }
  return entries;
}

// The column post-pass: resolve each ambiguous numeric date against its
// column's format hint. Grouping runs on the grid column each cell carries,
// so one visual column settles one reading for all of its cells — a merge
// inside the table cannot split a column into two groups that read 7/4/99 as
// July in one row and April in another.
function resolveAmbiguousDates(entries) {
  const isAmbiguous = (info) => info.mode === 'date' && !!info.ambiguous;
  const readingsByCol = new Map();
  for (const { info, col } of entries) {
    if (!isAmbiguous(info)) continue;
    if (!readingsByCol.has(col)) readingsByCol.set(col, []);
    readingsByCol.get(col).push(info.ambiguous);
  }
  const hintByCol = new Map(Array.from(readingsByCol, ([col, readings]) => [col, pickDateFormatHint(readings)]));
  return entries.map((entry) => {
    if (!isAmbiguous(entry.info)) return entry;
    const pendingDecision = { value: { ambiguous: entry.info.ambiguous } };
    const info = decisionToLegacyInfo(resolveAmbiguousDateDecision(pendingDecision, hintByCol.get(entry.col)));
    return Object.assign({}, entry, { info });
  });
}

// The max magnitude over the dataset: every pure cell's number and each
// number of an extracted cell, outside rows left out — they round against
// the dataset without joining it.
function datasetMaxMagnitude(entries) {
  const allNums = [];
  for (const { info, isOutside } of entries) {
    if (isOutside) continue;
    if (info.mode === 'pure') allNums.push(info.num);
    else if (info.mode === 'extracted') {
      for (const m of info.matches) allNums.push(m.num);
    }
  }
  return findMaxMagnitude([allNums]);
}

// One cell's patches, positioned in the text the cell classified: empty for a
// skip cell, an unchanged value, or a changed date or time that crosses a
// piece boundary. A pure, date, or time cell takes one patch: its trimmed
// text, replaced whole, while the piece keeps its own whitespace. A pure
// cell compares its formatted output to the trimmed text, which catches a
// number that is unchanged but whose display simplifies (e.g. "35.0" to
// "35"). An extracted cell — a unit number, a stacked cell, or numbers
// inside words, links, or a <sup> — takes one patch per changed number, and
// linkFilteredIdx holds the positions of the numbers the link filter kept.
function cellPatches(entry, maxMag, opts, rounding, kind) {
  const { text, trimmed, info, layout } = entry;
  const { offsetTop, offsetOther, numTop, floorDecimals } = rounding;
  const lead = typeof text === 'string' ? text.length - text.trimStart().length : 0;
  if (info.mode === 'date' || info.mode === 'time') {
    const prefilled = (info.month !== undefined)
      ? { month: info.month, day: info.day, year: info.year }
      : undefined;
    const rounded = info.mode === 'date'
      ? roundDateText(trimmed, opts.dateGranularity, prefilled)
      : roundTimeText(trimmed, opts.timeGranularity);
    if (rounded === null || rounded === trimmed) return { patches: [], linkFilteredIdx: null };
    if (!layoutPieceHolding(layout, lead, trimmed.length)) {
      DR_LOG.debug(kind.dateSplitRow);
      return { patches: [], linkFilteredIdx: null };
    }
    return { patches: [{ index: lead, numStr: trimmed, newNum: rounded }], linkFilteredIdx: null };
  }
  if (info.mode === 'pure') {
    const roundedValue = roundCellSetAware(info.num, info.num, maxMag, offsetTop, offsetOther, numTop);
    const formatted = restoreFormatting(roundedValue, text, floorDecimals);
    const patches = formatted === trimmed ? [] : [{ index: lead, numStr: trimmed, newNum: formatted }];
    return { patches, linkFilteredIdx: null };
  }
  if (info.mode === 'extracted') {
    const patches = [];
    for (const m of info.matches) {
      const rounded = roundCellSetAware(m.num, m.num, maxMag, offsetTop, offsetOther, numTop);
      const newNum = formatExtractedNumber(rounded, m.numStr, floorDecimals);
      if (newNum !== m.numStr) patches.push({ index: m.index, numStr: m.numStr, newNum });
    }
    return { patches, linkFilteredIdx: info.matches.map((m) => m.index) };
  }
  return { patches: [], linkFilteredIdx: null };
}

/**
 * The one simplification pass (see the section header above).
 *
 * @param {Element} table - The table or grid wrapper (key into DR_STORE's registry).
 * @param {object[]} adapterRows - The adapter's rows, as getRows() read them.
 * @param {object} opts - Fully-resolved rounding options.
 * @param {{kind: object, frozenMaxMag?: number|null, writes: 'first'|'reapply'|'none'}} pass
 * @returns {{cells: Array<{entry: object, patches: object[], linkFilteredIdx: number[]|null}>,
 *            maxMag: number|null, landedCells: number, missedCells: number}}
 *   cells holds every <td> in page order with its live patches (empty means
 *   leave the cell unchanged). landedCells counts the written cells with a
 *   landed patch, missedCells the written cells with none. An invalid range
 *   expression or a table with no rows returns no cells and writes nothing.
 */
function simplifyTableCells(table, adapterRows, opts, pass) {
  const { kind, writes } = pass;
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  if (rangeParse.error || adapterRows.length === 0) {
    return { cells: [], maxMag: null, landedCells: 0, missedCells: 0 };
  }
  const rounding = resolveRoundingSettings(opts);
  const entries = resolveAmbiguousDates(classifyTableCells(table, adapterRows, opts, rangeParse.ranges, kind));
  const frozen = pass.frozenMaxMag;
  const maxMag = (frozen !== undefined && frozen !== null) ? frozen : datasetMaxMagnitude(entries);
  if (writes === 'first' && kind.freezesMaxMagnitude) DR_STORE.setTableMaxMagnitude(table, maxMag);

  const cells = [];
  let landedCells = 0;
  let missedCells = 0;
  for (const entry of entries) {
    const { patches, linkFilteredIdx } = cellPatches(entry, maxMag, opts, rounding, kind);
    const live = livePatches(patches, entry.layout);
    cells.push({ entry, patches: live, linkFilteredIdx });
    if (writes === 'none' || live.length === 0) continue;
    if (kind.writeCell(table, entry, live, linkFilteredIdx, kind.recordSupRanges(entry)) > 0) {
      landedCells++;
    } else {
      missedCells++;
    }
  }
  if (writes === 'first' && kind.missedWritesRow && missedCells > 0) {
    DR_LOG.warn(kind.missedWritesRow(missedCells));
  }
  return { cells, maxMag, landedCells, missedCells };
}

// A grid's rows, read through the registry-backed originals port.
function gridRows(wrapperEl) {
  return makeAdapter(wrapperEl, { originalsPort: registryOriginalsPort(wrapperEl) }).getRows();
}

/**
 * The one simplification pass over a grid with writes off: every visible
 * <td>'s patches and the max magnitude, with the page left unchanged. The
 * suite reads a grid's planned patches through it.
 *
 * @param {Element} wrapperEl - The grid wrapper element.
 * @param {object}  opts      - Fully-resolved rounding options.
 * @param {number|null} [frozenMaxMag] - The max magnitude to use instead of
 *   computing it from the visible cells; see the pass settings above.
 * @returns {{results: Array<{cellObj: object, patches: object[], linkFilteredIdx: number[]|null, supRanges: object[]|null}>, maxMag: number|null}}
 *   patches is the list the cell's applyPatches writes; an empty list means
 *   leave the cell unchanged. supRanges is the record's supRanges the write
 *   would store.
 */
function computeGridRoundedValues(wrapperEl, opts, frozenMaxMag) {
  const { cells, maxMag } = simplifyTableCells(wrapperEl, gridRows(wrapperEl), opts,
    { kind: GRID_TABLE_PASS, frozenMaxMag, writes: 'none' });
  const results = cells.map(({ entry, patches, linkFilteredIdx }) => ({
    cellObj: entry.cellObj,
    patches,
    linkFilteredIdx,
    supRanges: GRID_TABLE_PASS.recordSupRanges(entry),
  }));
  return { results, maxMag };
}

/**
 * Re-apply grid rounding to all currently-visible cells of `wrapperEl`.
 * Called by the debounced MutationObserver after scroll or sort events.
 *
 * Runs the one simplification pass, the same pass as the first
 * simplification in `roundTable`, under the table's magnitude freeze, so a
 * re-apply produces the result the first simplification would for any given
 * visible DOM state and opts: the range expression, the exclusions, quoted
 * cells, dates and times, whole-link cells, and <sup> handling all apply.
 *
 * Guards against infinite re-triggering by disconnecting the grid's observer
 * for the duration of the write pass and reconnecting after.
 *
 * @param {Element} wrapperEl - The grid wrapper element (key into DR_STORE's table registry).
 */
function reapplyGridRounding(wrapperEl) {
  // Clear the stored timer reference (it has already fired).
  gridReapplyTimers.delete(wrapperEl);

  const observer = gridObservers.get(wrapperEl);

  // Disconnect FIRST — our own nodeValue writes fire characterData mutations;
  // without this guard we enter an infinite re-apply loop.
  if (observer) observer.disconnect();

  const opts = DR_STORE.getTableRoundOptions(wrapperEl);
  if (!opts) {
    // Table has been reset/removed — reconnect (no-op write) and bail.
    if (observer) {
      const scrollContainer = new GridAdapter(wrapperEl)._getScrollContainer();
      observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
    }
    return;
  }

  // Bail without writing while the table is showing originals (DR_STORE's
  // appliedFlag, set by the restore path before it rewrites cells) —
  // otherwise this re-apply would fight it. Reconnect so a later press back
  // to simplified still triggers re-applies.
  if (DR_STORE.getTableAppliedFlag(wrapperEl) !== 'simplified') {
    if (observer) {
      const scrollContainer = new GridAdapter(wrapperEl)._getScrollContainer();
      observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
    }
    return;
  }

  DR_LOG.debug("Dynamic Rounding: grid re-apply fired.");

  // The magnitude freeze keeps a scroll from shifting the rounding basis.
  simplifyTableCells(wrapperEl, gridRows(wrapperEl), opts, {
    kind: GRID_TABLE_PASS,
    frozenMaxMag: DR_STORE.getTableMaxMagnitude(wrapperEl),
    writes: 'reapply',
  });

  // Reconnect the observer after the write pass.
  if (observer) {
    const scrollContainer = new GridAdapter(wrapperEl)._getScrollContainer();
    observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
  }
}

function roundTable(table, options) {
  const opts = Object.assign({}, DR_DEFAULTS, options || {});
  DR_STORE.setTableRoundOptions(table, opts);
  const rangeParse = parseRangeExpr(opts.rangeExpr);
  if (rangeParse.error) {
    return { applied: false, rangeStatus: 'error', error: rangeParse.error };
  }
  const adapter = makeAdapter(table, { originalsPort: registryOriginalsPort(table) });
  const adapterRows = adapter.getRows();
  // Clean stub path: if the adapter returns no rows (e.g. GridAdapter stub),
  // return early without throwing.
  if (adapterRows.length === 0) return { applied: false, rangeStatus: 'ok' };
  const isVirtualized = adapter.isVirtualized();

  // The one simplification pass, on either table kind. A grid's first
  // simplification computes the max magnitude from what is visible right
  // now and stores it as the magnitude freeze, so every later
  // reapplyGridRounding (scroll/sort) reuses it instead of recomputing —
  // otherwise a scroll that changes which rows are visible could shift the
  // rounding basis mid-session. resetTable clears the freeze back to null,
  // so a fresh roundTable() call (e.g. re-rounding after settings change)
  // freezes again from its own first sight rather than reusing a stale
  // value. A cell whose patches all skipped never counts toward the form
  // (#301, #315).
  const { landedCells } = simplifyTableCells(table, adapterRows, opts, {
    kind: isVirtualized ? GRID_TABLE_PASS : NATIVE_TABLE_PASS,
    frozenMaxMag: null,
    writes: 'first',
  });
  DR_STORE.setTableAppliedFlag(table, landedCells > 0 ? 'simplified' : 'original');
  syncSwitchForTable(table);

  // Attach the scroll/sort re-apply observer AFTER the first simplification
  // so our own nodeValue writes above do not immediately re-trigger it.
  if (isVirtualized && typeof MutationObserver !== 'undefined') {
    // Disconnect any stale observer (e.g. roundTable called twice on same grid).
    const staleObserver = gridObservers.get(table);
    if (staleObserver) staleObserver.disconnect();

    // Clear any pending debounce timer from a previous observer.
    const staleTimer = gridReapplyTimers.get(table);
    if (staleTimer !== undefined) {
      clearTimeout(staleTimer);
      gridReapplyTimers.delete(table);
    }

    const scrollContainer = adapter._getScrollContainer();
    const wrapperEl = table; // alias for clarity inside the closure

    const observer = new MutationObserver(() => {
      // Cancel any pending debounce timer for this grid and schedule a fresh one.
      const pending = gridReapplyTimers.get(wrapperEl);
      if (pending !== undefined) clearTimeout(pending);

      const timerId = setTimeout(() => {
        reapplyGridRounding(wrapperEl);
      }, DR_DETECTION_SETTINGS.gridRedrawDelayMs);

      gridReapplyTimers.set(wrapperEl, timerId);
    });

    observer.observe(scrollContainer, { childList: true, characterData: true, subtree: true });
    gridObservers.set(wrapperEl, observer);
  }
  return { applied: true, rangeStatus: 'ok' };
}

// findMaxMagnitude and toNumber (plus DEFAULT_OFFSET_TOP, DEFAULT_NUM_TOP,
// VALIDATION_LIMIT, CLEAN_REGEX, PARENS_REGEX) live in core.js, loaded by
// manifest content_scripts ahead of this file. The sidebar loads core.js
// separately via a script tag in sidebar.html.
