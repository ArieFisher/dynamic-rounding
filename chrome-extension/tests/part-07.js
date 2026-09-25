// ---------------------------------------------------------------------------
// Sprint add-phantom-a11y-predicate: isPhantomA11yTable
// ---------------------------------------------------------------------------
//
// isPhantomA11yTable(table) returns true when ANY of three signals holds:
//   Signal 1 – table or any ancestor has aria-hidden="true"
//   Signal 2 – nearest positioned ancestor (or the table itself) has inline
//               left <= OFFSCREEN_LEFT_PX_THRESHOLD (-9999)
//   Signal 3 – nearest positioned ancestor contains an <svg> with a non-empty
//               aria-label
// Returns false for an ordinary on-screen 2-column numeric table.
//
// Mock-building helpers:
//   makePhantomEl(attrs)  – minimal element node with getAttribute / parentElement / style
//   chainParents(child, ...parents)  – link elements into a parentElement chain
//   makePositionedAncestor(styleProps)  – element with style.position = 'absolute'

// --- AC: DR_DETECTION_SETTINGS.offscreenLeftPx is -9999 ---
(function phantomA11y_threshold_value() {
  eq('isPhantomA11yTable: DR_DETECTION_SETTINGS.offscreenLeftPx === -9999',
    DR_DETECTION_SETTINGS.offscreenLeftPx, -9999);
})();

// ---------------------------------------------------------------------------
// Signal 1: aria-hidden="true" on the table itself
// ---------------------------------------------------------------------------
(function phantomA11y_signal1_selfHidden() {
  const table = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'true' } });
  eq('isPhantomA11yTable: aria-hidden="true" on table itself -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 1: aria-hidden="true" on immediate parent
(function phantomA11y_signal1_parentHidden() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  const parent = makePhantomEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, parent);
  eq('isPhantomA11yTable: aria-hidden="true" on immediate parent -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 1: aria-hidden="true" several ancestors up (nested deeply)
(function phantomA11y_signal1_deepAncestorHidden() {
  const table      = makePhantomEl({ tagName: 'TABLE' });
  const tbody      = makePhantomEl({ tagName: 'TBODY' });
  const innerDiv   = makePhantomEl({ tagName: 'DIV' });
  const middleDiv  = makePhantomEl({ tagName: 'DIV' });
  const outerDiv   = makePhantomEl({ tagName: 'DIV', attrs: { 'aria-hidden': 'true' } });
  chainParents(table, tbody, innerDiv, middleDiv, outerDiv);
  eq('isPhantomA11yTable: aria-hidden="true" several levels up -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: aria-hidden="false" must NOT trigger signal 1
(function phantomA11y_signal1_ariaHiddenFalse() {
  const table  = makePhantomEl({ tagName: 'TABLE', attrs: { 'aria-hidden': 'false' } });
  const parent = makePhantomEl({ tagName: 'DIV',   attrs: { 'aria-hidden': 'false' } });
  chainParents(table, parent);
  eq('isPhantomA11yTable: aria-hidden="false" does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Signal 2: nearest positioned ancestor has inline left <= threshold
// ---------------------------------------------------------------------------

// Signal 2: positioned ancestor with left: -10000px (Kaggle evidence)
(function phantomA11y_signal2_offscreenLeft_minus10000() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-10000px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-10000px -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 2: positioned ancestor at exactly the threshold value (-9999px)
(function phantomA11y_signal2_offscreenLeft_exactThreshold() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9999px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-9999px (at threshold) -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 2: table itself is positioned and off-screen (no separate ancestor)
(function phantomA11y_signal2_tableSelfOffscreen() {
  const table = makePhantomEl({ tagName: 'TABLE', style: { position: 'absolute', left: '-10000px' } });
  eq('isPhantomA11yTable: table itself is positioned with left=-10000px -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: left value just ABOVE threshold (-9998px) must NOT trigger
(function phantomA11y_signal2_leftJustAboveThreshold() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-9998px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-9998px (above threshold) -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: modest off-screen like -100px must NOT trigger signal 2
(function phantomA11y_signal2_modestNegativeLeft() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-100px' });
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor left=-100px (not extreme) -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: non-positioned ancestor with extreme left — should NOT count because the
// ancestor is not positioned; no positioned ancestor found so checkEl = table,
// and table has no extreme left.
(function phantomA11y_signal2_nonPositionedAncestorIgnored() {
  const table   = makePhantomEl({ tagName: 'TABLE' });
  // wrapper has no inline style.position and getComputedStyle returns '' for position
  const wrapper = makePhantomEl({ tagName: 'DIV', style: { left: '-10000px' } });
  chainParents(table, wrapper);
  // No positioned ancestor found → checkEl = table (which has no extreme left)
  eq('isPhantomA11yTable: non-positioned ancestor with extreme left -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Signal 3: nearest positioned ancestor contains <svg> with non-empty aria-label
// ---------------------------------------------------------------------------

// Signal 3: positioned ancestor has querySelectorAll('svg') returning labelled svg
(function phantomA11y_signal3_svgWithAriaLabel() {
  const svg = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': 'Monthly Revenue Chart' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor has svg[aria-label="..."] -> true',
    isPhantomA11yTable(table), true);
})();

// Signal 3: multiple SVGs in ancestor, only one has a label — still triggers
(function phantomA11y_signal3_multipleSvgsOneLabelledOne() {
  const svgNoLabel  = makePhantomEl({ tagName: 'SVG' }); // no aria-label
  const svgLabelled = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': 'Pie Chart' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svgNoLabel; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svgNoLabel, svgLabelled] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: one of two svgs has aria-label -> true',
    isPhantomA11yTable(table), true);
})();

// Edge: svg with EMPTY aria-label must NOT trigger signal 3
(function phantomA11y_signal3_svgEmptyAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': '' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with empty aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: svg with whitespace-only aria-label must NOT trigger signal 3
(function phantomA11y_signal3_svgWhitespaceAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG', attrs: { 'aria-label': '   ' } });
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with whitespace-only aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: svg with NO aria-label attribute at all must NOT trigger signal 3
(function phantomA11y_signal3_svgNoAriaLabel() {
  const svg    = makePhantomEl({ tagName: 'SVG' }); // getAttribute returns null
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor();
  posAnc.querySelector    = function() { return svg; };
  posAnc.querySelectorAll = function(sel) { return sel === 'svg' ? [svg] : []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: svg with no aria-label does NOT trigger -> false',
    isPhantomA11yTable(table), false);
})();

// Edge: no positioned ancestor found at all — signal 3 is skipped entirely (no crash)
(function phantomA11y_signal3_noPosAncestor() {
  const table = makePhantomEl({ tagName: 'TABLE' });
  // No parentElement — predicate must not throw and returns false
  eq('isPhantomA11yTable: no positioned ancestor, no signals -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Negative case: ordinary on-screen 2-column numeric table
// ---------------------------------------------------------------------------
(function phantomA11y_negative_ordinaryTable() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const parent = makePhantomEl({ tagName: 'DIV' });
  chainParents(table, parent);
  // No aria-hidden, no off-screen left, no positioned ancestor → false
  eq('isPhantomA11yTable: ordinary on-screen numeric table -> false',
    isPhantomA11yTable(table), false);
})();

// Negative: positioned ancestor but normal on-screen left (-50px), no svg, no aria-hidden
(function phantomA11y_negative_onscreenPositionedAncestor() {
  const table  = makePhantomEl({ tagName: 'TABLE' });
  const posAnc = makePositionedAncestor({ left: '-50px' });
  posAnc.querySelectorAll = function() { return []; };
  chainParents(table, posAnc);
  eq('isPhantomA11yTable: positioned ancestor with normal left (-50px), no svg -> false',
    isPhantomA11yTable(table), false);
})();

// ---------------------------------------------------------------------------
// Guard: invalid / null input
// ---------------------------------------------------------------------------
(function phantomA11y_nullInput() {
  eq('isPhantomA11yTable: null -> false',
    isPhantomA11yTable(null), false);
})();

(function phantomA11y_noGetAttribute() {
  eq('isPhantomA11yTable: plain object without getAttribute -> false',
    isPhantomA11yTable({}), false);
})();

// --- pass1-filter AC1: phantom tables (aria-hidden ancestor) get NO toggle ---
// Build N=3 phantom tables (aria-hidden parent), all valid data tables.
// After Pass 1 none of them should be in tableToggles.

(function pass1Filter_ariaHiddenPhantoms_zeroToggles() {
  function makeAriaHiddenPhantom() {
    const t = makePass1DataTable();
    // aria-hidden="true" on the immediate parent (Signal 1)
    const hiddenParent = {
      tagName: 'DIV',
      getAttribute: function(name) { return name === 'aria-hidden' ? 'true' : null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = hiddenParent;
    t.parentNode    = null;
    return t;
  }

  const phantoms = [makeAriaHiddenPhantom(), makeAriaHiddenPhantom(), makeAriaHiddenPhantom()];

  // Sanity: each phantom is a valid data table (isDataTable guard is NOT the cause of skip)
  eq('pass1-filter: phantom aria-hidden table satisfies isDataTable (sanity)',
    isDataTable(phantoms[0]), true);
  // Sanity: each phantom is detected as phantom
  eq('pass1-filter: phantom aria-hidden table isPhantomA11yTable is true (sanity)',
    isPhantomA11yTable(phantoms[0]), true);

  runPass1WithTables(phantoms);

  const togglesCreated = phantoms.filter(t => tableToggles.has(t)).length;
  eq('pass1-filter: 3 aria-hidden phantom tables → ZERO toggles created',
    togglesCreated, 0);

  cleanupPass1Tables(phantoms);
})();

// --- pass1-filter AC1: phantom tables (off-screen left) get NO toggle ---
// Build N=2 phantom tables with positioned ancestor left=-10000px.

(function pass1Filter_offscreenLeftPhantoms_zeroToggles() {
  function makeOffscreenPhantom() {
    const t = makePass1DataTable();
    // Positioned ancestor with extreme left (Signal 2)
    const posAnc = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: { position: 'absolute', left: '-10000px' },
      parentElement: null,
      parentNode: null,
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
    };
    t.parentElement = posAnc;
    t.parentNode    = null;
    return t;
  }

  const phantoms = [makeOffscreenPhantom(), makeOffscreenPhantom()];

  // Sanity checks
  eq('pass1-filter: off-screen phantom table satisfies isDataTable (sanity)',
    isDataTable(phantoms[0]), true);
  eq('pass1-filter: off-screen phantom table isPhantomA11yTable is true (sanity)',
    isPhantomA11yTable(phantoms[0]), true);

  runPass1WithTables(phantoms);

  const togglesCreated = phantoms.filter(t => tableToggles.has(t)).length;
  eq('pass1-filter: 2 off-screen phantom tables → ZERO toggles created',
    togglesCreated, 0);

  cleanupPass1Tables(phantoms);
})();

// --- pass1-filter AC2: a normal on-screen table still gets exactly ONE toggle ---

(function pass1Filter_realTable_getsOneToggle() {
  const realTable = makePass1DataTable();
  // No aria-hidden, no positioned ancestor, no svg → isPhantomA11yTable returns false
  const wrapper = {
    tagName: 'DIV',
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
  };
  realTable.parentElement = wrapper;
  realTable.parentNode    = null;

  // Sanity checks
  eq('pass1-filter: real on-screen table satisfies isDataTable (sanity)',
    isDataTable(realTable), true);
  eq('pass1-filter: real on-screen table isPhantomA11yTable is false (sanity)',
    isPhantomA11yTable(realTable), false);

  runPass1WithTables([realTable]);

  eq('pass1-filter: normal on-screen table → exactly ONE toggle created',
    tableToggles.has(realTable), true);

  cleanupPass1Tables([realTable]);
})();

// --- pass1-filter adversarial: mix of phantom + real tables in one Pass 1 run ---
// Only the real tables should get toggles; count equals exactly the number of real tables.

(function pass1Filter_mixedFixture_onlyRealTablesGetToggles() {
  // Two phantom tables (aria-hidden ancestor)
  function makeAriaHiddenPhantom() {
    const t = makePass1DataTable();
    const hiddenParent = {
      tagName: 'DIV',
      getAttribute: function(name) { return name === 'aria-hidden' ? 'true' : null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = hiddenParent;
    t.parentNode    = null;
    return t;
  }

  // One phantom with off-screen left
  function makeOffscreenPhantom() {
    const t = makePass1DataTable();
    const posAnc = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: { position: 'absolute', left: '-10000px' },
      parentElement: null,
      parentNode: null,
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
    };
    t.parentElement = posAnc;
    t.parentNode    = null;
    return t;
  }

  // Two real on-screen tables
  function makeRealTable() {
    const t = makePass1DataTable();
    const wrapper = {
      tagName: 'DIV',
      getAttribute: function() { return null; },
      style: {},
      parentElement: null,
      parentNode: null,
    };
    t.parentElement = wrapper;
    t.parentNode    = null;
    return t;
  }

  const phantom1 = makeAriaHiddenPhantom();
  const phantom2 = makeAriaHiddenPhantom();
  const phantom3 = makeOffscreenPhantom();
  const real1    = makeRealTable();
  const real2    = makeRealTable();

  // Interleave so Pass 1 processes them in mixed order
  const allTables = [phantom1, real1, phantom2, real2, phantom3];

  runPass1WithTables(allTables);

  const phantoms = [phantom1, phantom2, phantom3];
  const reals    = [real1, real2];

  const phantomToggles = phantoms.filter(t => tableToggles.has(t)).length;
  const realToggles    = reals.filter(t => tableToggles.has(t)).length;

  eq('pass1-filter (mix): phantom tables get ZERO toggles',
    phantomToggles, 0);
  eq('pass1-filter (mix): real tables each get a toggle — count equals 2',
    realToggles, 2);
  eq('pass1-filter (mix): total toggles created equals number of real tables',
    tableToggles.has(real1) && tableToggles.has(real2) && !tableToggles.has(phantom1) &&
    !tableToggles.has(phantom2) && !tableToggles.has(phantom3), true);

  cleanupPass1Tables(allTables);
})();

// --- pass1-filter: Pass 1 skips phantom but does NOT skip a non-data real table ---
// (edge: if a real table fails isDataTable, no toggle either — confirm the skip
// here is from isDataTable, not from isPhantomA11yTable)
(function pass1Filter_nonDataRealTable_noToggle() {
  // 1-row table: fails isDataTable (< 2 rows)
  const nonDataTable = {
    tagName: 'TABLE',
    rows: [
      { cells: [
          { tagName: 'TD', innerText: '100', textContent: '100', innerHTML: '100',
            classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
            dataset: {}, title: '', querySelectorAll:()=>[], removeAttribute(){} },
          { tagName: 'TD', innerText: '200', textContent: '200', innerHTML: '200',
            classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
            dataset: {}, title: '', querySelectorAll:()=>[], removeAttribute(){} },
        ]
      },
    ],
    dataset: {},
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getBoundingClientRect: function() { return { top: 10, right: 100, bottom: 50, left: 10 }; },
    classList: { _c:[], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
  };

  // Confirm isPhantomA11yTable is false (skip is NOT from the phantom guard)
  eq('pass1-filter: non-data real table isPhantomA11yTable is false (sanity)',
    isPhantomA11yTable(nonDataTable), false);
  // Confirm isDataTable is false
  eq('pass1-filter: non-data real table isDataTable is false (sanity)',
    isDataTable(nonDataTable), false);

  runPass1WithTables([nonDataTable]);

  eq('pass1-filter: non-data real table gets no toggle (isDataTable gate)',
    tableToggles.has(nonDataTable), false);

  cleanupPass1Tables([nonDataTable]);
})();

// --- pass1-filter: duplicate Pass 1 call does NOT create a second toggle for a real table ---
// (regression guard: tableToggles.has check prevents double-insertion)
(function pass1Filter_duplicateRun_noDoubleToggle() {
  const realTable = makePass1DataTable();
  const wrapper = {
    tagName: 'DIV',
    getAttribute: function() { return null; },
    style: {},
    parentElement: null,
    parentNode: null,
  };
  realTable.parentElement = wrapper;
  realTable.parentNode    = null;

  // First run
  runPass1WithTables([realTable]);
  const afterFirst = tableToggles.has(realTable);

  // Second run — table already in tableToggles; Pass 1 should skip it.
  // We verify the toggle isn't re-inserted: since WeakMap.set overwrites,
  // a re-create would swap the button object, so we check its identity holds.
  const buttonAfterFirst = tableToggles.get(realTable);
  runPass1WithTables([realTable]);
  const buttonAfterSecond = tableToggles.get(realTable);

  eq('pass1-filter: first Pass 1 run creates toggle for real table',
    afterFirst, true);
  eq('pass1-filter: second Pass 1 run does not replace the existing toggle (same object)',
    buttonAfterFirst === buttonAfterSecond, true);

  cleanupPass1Tables([realTable]);
})();

// ---------------------------------------------------------------------------
// Sanity: isPhantomA11yTable round-trip on the embedded-table fixtures
// ---------------------------------------------------------------------------
(function pass2aria_sanity_phantomEmbedded() {
  const phantom = makePhantomEmbeddedTable();
  eq('pass2-aria sanity: isPhantomA11yTable(phantom embedded table) === true',
    isPhantomA11yTable(phantom), true);
})();

(function pass2aria_sanity_realEmbedded() {
  const real = makeRealEmbeddedTable();
  eq('pass2-aria sanity: isPhantomA11yTable(real embedded table) === false',
    isPhantomA11yTable(real), false);
})();

// ---------------------------------------------------------------------------
// AC1: ARIA grid with ONLY phantom tables → Pass 2 adds dr-ext-grid + toggle
// ---------------------------------------------------------------------------
(function pass2aria_AC1_onlyPhantomTables_getsToggle() {
  const phantom1 = makePhantomEmbeddedTable();
  const phantom2 = makePhantomEmbeddedTable();
  const grid = makeAriaGrid([phantom1, phantom2]);

  withToggleDocumentMock(function() {
    // Pass 1 sees no tables; Pass 2 sees our grid.
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid with only phantom tables gets dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), true);
  eq('pass2-aria: grid with only phantom tables gets a toggle registered',
    tableToggles.has(grid), true);
})();

// ---------------------------------------------------------------------------
// AC2: ARIA grid wrapping a REAL table → Pass 2 bows out (no toggle, no class)
// ---------------------------------------------------------------------------
(function pass2aria_AC2_realTable_pass2BowsOut() {
  const realTbl = makeRealEmbeddedTable();
  const grid    = makeAriaGrid([realTbl]);

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid wrapping a real table does NOT get dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), false);
  eq('pass2-aria: grid wrapping a real table does NOT get a toggle',
    tableToggles.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial AC2-mix: grid with phantom + one real → still bows out
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_mixedPhantomAndReal_bowsOut() {
  const phantom = makePhantomEmbeddedTable();
  const real    = makeRealEmbeddedTable();
  const grid    = makeAriaGrid([phantom, real]);

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid with phantom+real table does NOT get dr-ext-grid',
    grid.classList.contains('dr-ext-grid'), false);
  eq('pass2-aria: grid with phantom+real table does NOT get a toggle',
    tableToggles.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial: grid with NO embedded tables → Pass 2 adds class + toggle
// (no embedded tables means .some(!phantom) is false — empty array)
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_noEmbeddedTables_getsToggle() {
  const grid = makeAriaGrid([]);

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: grid with no embedded tables gets dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), true);
  eq('pass2-aria: grid with no embedded tables gets a toggle',
    tableToggles.has(grid), true);
})();

// ---------------------------------------------------------------------------
// Adversarial: grid already carrying dr-ext-grid is skipped (preserved guard)
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_alreadyTagged_skipped() {
  const grid = makeAriaGrid([]);
  grid.classList.add('dr-ext-grid'); // pre-tag it (style hook only, no longer read as state)
  DR_STORE.registerTable(grid); // the actual "already found" signal pass 2 now checks

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [grid];
      return [];
    };

    injectTableToggles();
  });

  // Already tagged → skipped → tableToggles should NOT have a new entry
  // (we can't assert .has() false on a pre-existing toggle since none was injected,
  // but we CAN verify the grid was not re-registered via trackedTables)
  eq('pass2-aria: already-tagged grid is NOT added to trackedTables again',
    tableToggles.has(grid), false);
})();

// ---------------------------------------------------------------------------
// Adversarial: element with tagName=TABLE is skipped by the tagName guard
// (the preserved `if (el.tagName === 'TABLE') return;` fires before the new line)
// ---------------------------------------------------------------------------
(function pass2aria_adversarial_tableTagName_skipped() {
  const phantom = makePhantomEmbeddedTable();
  // Make an ARIA-grid-matching element that is itself a <TABLE>
  const classes = new Set();
  const gridTable = {
    tagName: 'TABLE',    // triggers the early-return guard
    classList: {
      contains(c) { return classes.has(c); },
      add(c)      { classes.add(c); },
      remove(c)   { classes.delete(c); },
    },
    querySelectorAll(sel) {
      return sel === 'table' ? [phantom] : [];
    },
    getBoundingClientRect() { return { top: 0, right: 0, bottom: 0, left: 0 }; },
  };

  withToggleDocumentMock(function() {
    global.document.querySelectorAll = function(sel) {
      if (sel === 'table') return [];
      if (sel === '[role="grid"], [role="table"]') return [gridTable];
      return [];
    };

    injectTableToggles();
  });

  eq('pass2-aria: element with tagName=TABLE is skipped by tagName guard',
    gridTable.classList.contains('dr-ext-grid'), false);
  eq('pass2-aria: element with tagName=TABLE does not get a toggle via Pass 2',
    tableToggles.has(gridTable), false);
})();

// ---------------------------------------------------------------------------
// Sprint observer-phantom-filter (issue #128): MutationObserver added-node path
// applies the SAME phantom filtering as injectTableToggles.
//
// The initial-load fix only touched injectTableToggles(). Kaggle is a React SPA
// that renders its Data Explorer grid AFTER load, so detection runs through the
// MutationObserver added-node handler — extracted here as injectTogglesForAddedNode().
// These tests drive that function directly with element-node stubs.
// ---------------------------------------------------------------------------

// AC1 (the Kaggle case): an added [role="table"] grid whose ONLY embedded
// <table>s are phantom chart a11y tables → gets dr-ext-grid + a toggle.
(function observer_AC1_addedGridOnlyPhantomTables_getsToggle() {
  const phantom1 = makePhantomEmbeddedTable();
  const phantom2 = makePhantomEmbeddedTable();
  const grid = asAddedGridNode(makeAriaGrid([phantom1, phantom2]));

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(grid);
  });

  eq('observer: added grid with only phantom tables gets dr-ext-grid class',
    grid.classList.contains('dr-ext-grid'), true);
  eq('observer: added grid with only phantom tables gets a toggle',
    tableToggles.has(grid), true);
})();

// AC2: an added grid wrapping a REAL table → observer bows out (no class/toggle
// on the grid itself; the real embedded table is owned by Pass 1).
(function observer_AC2_addedGridRealTable_bowsOut() {
  const realTbl = makePass1DataTable(); // non-phantom, has .rows for isDataTable
  const grid = asAddedGridNode(makeAriaGrid([realTbl]));

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(grid);
  });

  eq('observer: added grid wrapping a real table does NOT get dr-ext-grid',
    grid.classList.contains('dr-ext-grid'), false);
  eq('observer: added grid wrapping a real table does NOT get a toggle',
    tableToggles.has(grid), false);

  cleanupPass1Tables([realTbl]);
})();

// AC3: a phantom native <table> reached via querySelectorAll on the added node
// gets NO toggle (Pass 1 phantom skip in the observer path).
(function observer_AC3_addedSubtreePhantomTable_noToggle() {
  const phantom = makePhantomEmbeddedTable();
  const container = {
    nodeType: global.Node.ELEMENT_NODE,
    tagName: 'DIV',
    classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
    matches() { return false; },
    querySelectorAll(sel) { return sel === 'table' ? [phantom] : []; },
  };

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(container);
  });

  eq('observer: phantom <table> in added subtree gets NO toggle',
    tableToggles.has(phantom), false);
})();

// AC4: a real native <table> reached via querySelectorAll on the added node
// DOES get a toggle (Pass 1 survivor in the observer path).
(function observer_AC4_addedSubtreeRealTable_getsToggle() {
  const realTbl = makePass1DataTable();
  const container = {
    nodeType: global.Node.ELEMENT_NODE,
    tagName: 'DIV',
    classList: { _c: [], add(c){this._c.push(c);}, remove(c){this._c=this._c.filter(x=>x!==c);}, contains(c){return this._c.includes(c);} },
    matches() { return false; },
    querySelectorAll(sel) { return sel === 'table' ? [realTbl] : []; },
  };

  withToggleDocumentMock(function() {
    injectTogglesForAddedNode(container);
  });

  eq('observer: real <table> in added subtree gets a toggle',
    tableToggles.has(realTbl), true);

  cleanupPass1Tables([realTbl]);
})();

// ---------------------------------------------------------------------------
// Sprint pending-retest: a grid that arrives before its rows registers when
// the rows arrive.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.4 and the
// pending-retest block in §5; the re-test cap's reasoning in §6.
// ---------------------------------------------------------------------------
//
// The rule these assertions pin, in the specification's words:
//   - A chain root whose containment chain is empty — no qualifying element of
//     its nest passes the data test — becomes a pending table: one debounced
//     subtree observer on the chain root, watching childList, characterData,
//     and subtree.
//   - A change to the subtree runs the nomination step from the root again. A
//     registration clears the pending record and disconnects the observer.
//   - A re-test that still finds the chain empty counts against
//     DR_DETECTION_SETTINGS.pendingRetestCap; reaching the cap drops the observer, the
//     timer, and the count, and records a debug log row.
//   - The pending unit is the chain root, so a nest of several qualifying
//     elements carries one observer.
//
// Every expected value below comes from that statement, never from the
// controller's source.

// The row pairs a database query grid draws once its rows arrive: a row-number
// gutter row in the pinned pane, and an identifier with a count and a rate in
// the scrolling pane. Invented values, one order of magnitude apart.
const PENDING_FILL_ROWS = [
  ['alpha', '7,318,204', '284.51'],
  ['bravo', '551,077', '31.77'],
  ['charlie', '2,140,663', '58.02'],
];

// --- Criterion 1: a container inserted empty and then filled registers ---

(function pendingRetest_AC1_aLoneContainerFilledLaterRegistersAndGainsAPillbox() {
  const lone = makeDgNode('DIV', 'lone-pending-grid', 'grid', []);
  const before = DR_STORE.getRegisteredTables().length;

  eq('pending AC1: the suite holds no pending table before this case',
    pendingRoots.size, 0);

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(lone);
    });

    eq('pending AC1: an empty container registers nothing',
      DR_STORE.hasTable(lone), false);
    eq('pending AC1: an empty container gains no pillbox', tableToggles.has(lone), false);
    eq('pending AC1: an empty container is held as a pending table',
      pendingRoots.has(lone), true);
    eq('pending AC1: the empty container carries one observer', observers.length, 1);

    // The rows arrive, each holding a number.
    PENDING_FILL_ROWS.forEach((cellTexts, i) => appendDgChild(lone, makeDgRow(i, cellTexts)));
    eq('pending AC1: the filled container passes the data test', isDataTable(lone), true);

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending AC1: one mutation schedules one re-test', runPendingRetestTimers(timers), 1);
    });

    eq('pending AC1: the filled container registers', DR_STORE.hasTable(lone), true);
    eq('pending AC1: the filled container gains a pillbox', tableToggles.has(lone), true);
    eq('pending AC1: the registration drops the pending record',
      pendingRoots.has(lone), false);
    eq('pending AC1: the registration disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending AC1: the registration adds exactly one registry entry',
      DR_STORE.getRegisteredTables().length - before, 1);
  });

  forgetRegisteredTable(lone);
})();

(function pendingRetest_AC1_anEmptyDatabaseQueryGridFilledLaterRegistersItsScrollingPane() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const before = DR_STORE.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    eq('pending AC1: an empty database query grid registers nothing',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, false]);
    eq('pending AC1: an empty database query grid holds the wrapper as a pending table',
      pendingRoots.has(grid.wrapperEl), true);
    eq('pending AC1: the empty wrapper carries one observer', observers.length, 1);

    fillDatabaseQueryGrid(grid);

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending AC1: one fill schedules one re-test', runPendingRetestTimers(timers), 1);
    });

    eq('pending AC1: the filled grid registers the scrolling pane alone',
      [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, true]);
    eq('pending AC1: the scrolling pane gains a pillbox',
      tableToggles.has(grid.scrollPaneEl), true);
    eq('pending AC1: the wrapper gains no pillbox', tableToggles.has(grid.wrapperEl), false);
    eq('pending AC1: the pinned pane gains no pillbox',
      tableToggles.has(grid.pinnedPaneEl), false);
    eq('pending AC1: the registration drops the wrapper\'s pending record',
      pendingRoots.has(grid.wrapperEl), false);
    eq('pending AC1: the registration disconnects the wrapper\'s observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending AC1: the fill adds exactly one registry entry',
      DR_STORE.getRegisteredTables().length - before, 1);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- Criterion 2: one observer per pending wrapper ---

(function pendingRetest_AC2_aPendingWrapperCarriesOneObserverForThreeElements() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const extraPaneEl = appendDgChild(grid.wrapperEl,
    makeDgNode('DIV', 'dg--grid-container dg--extra-pane', 'grid', []));

  eq('pending AC2: three role-bearing elements sit under the empty wrapper',
    [grid.pinnedPaneEl, grid.scrollPaneEl, extraPaneEl]
      .map((el) => el.parentElement === grid.wrapperEl), [true, true, true]);
  eq('pending AC2: no element of the empty nest passes the data test',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl, extraPaneEl].map(isDataTable),
    [false, false, false, false]);

  withPendingHarness(function ({ observers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    eq('pending AC2: a nest of four qualifying elements carries one observer',
      observers.length, 1);
    eq('pending AC2: the one observer watches the chain root',
      observers[0] && observers[0].observeCalls.length === 1 &&
        observers[0].observeCalls[0].target === grid.wrapperEl, true);
    eq('pending AC2: the observer watches added nodes, changed text, and the whole subtree',
      observers[0] && observers[0].observeCalls[0].options,
      { childList: true, characterData: true, subtree: true });

    // A second pass over the same empty wrapper holds the record it already
    // has rather than starting a second one.
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });
    eq('pending AC2: a second pass over the same empty wrapper adds no second observer',
      observers.length, 1);
    eq('pending AC2: a second pass leaves one pending root', pendingRoots.size, 1);

    dropPendingTable(grid.wrapperEl);
  });

  eq('pending AC2: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// --- Criterion 3: the re-test cap bounds a container that never passes ---
//
// The container holds rows of text and no number, so every re-test finds the
// chain empty. The debounce is driven once per re-test, the way a subtree that
// churns without loading data drives it.

(function pendingRetest_AC3_aContainerThatNeverPassesStopsAtTheCap() {
  const neverEl = makeDgNode('DIV', 'never-a-data-grid', 'grid', [
    makeDgRow(0, ['alpha', 'north', 'open']),
    makeDgRow(1, ['bravo', 'south', 'open']),
    makeDgRow(2, ['charlie', 'east', 'open']),
  ]);
  eq('pending AC3: a container of text rows never passes the data test',
    isDataTable(neverEl), false);
  eq('pending AC3: the detection settings ship a re-test cap of 100',
    DR_DETECTION_SETTINGS.pendingRetestCap, 100);

  // The log buffer holds the last 50 rows and counts the rows that dropped off
  // the front, so the two together give a running total this case can subtract
  // to find the rows it recorded itself.
  const recordedRows = () => {
    const snapshot = DR_LOG.snapshot();
    return snapshot.dropped + snapshot.entries.length;
  };
  const logRowsBefore = recordedRows();

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(neverEl);
    });

    eq('pending AC3: the container is held as a pending table',
      pendingRoots.has(neverEl), true);
    eq('pending AC3: the held container starts at zero failed re-tests',
      pendingRetestCounts.get(neverEl), 0);

    const observer = observers[0];
    // One short of the cap: the observer stays connected.
    for (let i = 0; i < DR_DETECTION_SETTINGS.pendingRetestCap - 1; i++) {
      if (observer) observer.trigger();
      runPendingRetestTimers(timers);
    }
    eq('pending AC3: one short of the cap the count reads the failed re-tests',
      pendingRetestCounts.get(neverEl), DR_DETECTION_SETTINGS.pendingRetestCap - 1);
    eq('pending AC3: one short of the cap the observer stays connected',
      observer && observer.disconnectCount, 0);
    eq('pending AC3: one short of the cap the container is still pending',
      pendingRoots.has(neverEl), true);

    // The re-test that reaches the cap.
    if (observer) observer.trigger();
    runPendingRetestTimers(timers);

    eq('pending AC3: reaching the cap disconnects the observer',
      observer && observer.disconnectCount, 1);
    eq('pending AC3: reaching the cap drops the pending root',
      pendingRoots.has(neverEl), false);
    eq('pending AC3: reaching the cap drops the failed-re-test count',
      pendingRetestCounts.has(neverEl), false);
    eq('pending AC3: reaching the cap drops the debounce timer',
      pendingRetestTimers.has(neverEl), false);
    eq('pending AC3: reaching the cap leaves the observer map empty for the root',
      pendingObservers.has(neverEl), false);
    eq('pending AC3: the dropped container registers nothing',
      DR_STORE.hasTable(neverEl), false);

    const added = recordedRows() - logRowsBefore;
    const entries = DR_LOG.snapshot().entries;
    const newRows = entries.slice(Math.max(0, entries.length - added));
    eq('pending AC3: the cap cycle records at least one log row', added >= 1, true);
    eq('pending AC3: reaching the cap records a debug log row naming the pending table',
      newRows.some((row) => row.level === 'debug' && /pending table/i.test(row.text)), true);

    // A later mutation on the dropped container costs nothing: no observer
    // remains to run, and the record is gone.
    eq('pending AC3: the dropped container holds no pending record',
      pendingRoots.size, 0);
  });
})();

// --- Adversarial: a re-test that finds the nest registered ends the record ---
//
// The vocabulary row states the rule: a re-test that finds the nest already
// registered ends the pending table, as does one that finds its configured
// depth crowded. The registration here goes through the pillbox builder
// directly, which is the route a right-click takes today — the pending record
// stands until the next re-test, and that re-test is what drops it. Without
// this the record outlives the registration: a live observer on a subtree the
// extension already registered, re-testing until it reaches the cap.

(function pendingRetest_aRegisteredRetestEndsThePendingRecord() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });
  const before = DR_STORE.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    eq('pending registered: the empty wrapper is held as a pending table',
      pendingRoots.has(grid.wrapperEl), true);
    eq('pending registered: the empty wrapper carries one observer', observers.length, 1);

    // The rows arrive, and another route registers the scrolling pane before
    // the re-test runs.
    fillDatabaseQueryGrid(grid);
    withToggleDocumentMock(function () {
      createToggleForTable(grid.scrollPaneEl);
    });
    eq('pending registered: the other route registered the scrolling pane',
      DR_STORE.hasTable(grid.scrollPaneEl), true);
    eq('pending registered: the pending record still stands before the re-test',
      pendingRoots.has(grid.wrapperEl), true);

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending registered: one mutation schedules one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending registered: a re-test over a registered nest drops the pending root',
      pendingRoots.has(grid.wrapperEl), false);
    eq('pending registered: a re-test over a registered nest disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending registered: the observer map holds nothing for the wrapper',
      pendingObservers.has(grid.wrapperEl), false);
    eq('pending registered: the failed-re-test count map holds nothing for the wrapper',
      pendingRetestCounts.has(grid.wrapperEl), false);
    eq('pending registered: the debounce timer map holds nothing for the wrapper',
      pendingRetestTimers.has(grid.wrapperEl), false);
    eq('pending registered: the nest holds one registry entry in all',
      DR_STORE.getRegisteredTables().length - before, 1);
    eq('pending registered: the re-test puts no second pillbox on the nest',
      [tableToggles.has(grid.wrapperEl), tableToggles.has(grid.pinnedPaneEl)], [false, false]);
    eq('pending registered: no pending root remains', pendingRoots.size, 0);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
})();

// --- Adversarial: a re-test that finds the depth crowded ends the record ---
//
// A crowded nest registers nothing, by the product decision in issue #373, and
// it registers nothing on every later re-test for the same reason. Holding the
// record would leave an observer re-testing a shape whose answer cannot change
// until the page rebuilds it.

(function pendingRetest_aCrowdedRetestEndsThePendingRecord() {
  const rootEl = makeDgNode('DIV', 'crowded-pending-root', 'table', []);
  const nest = makeCrowdedNest();
  const before = DR_STORE.getRegisteredTables().length;

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(rootEl);
    });

    eq('pending crowded: the empty root is held as a pending table',
      pendingRoots.has(rootEl), true);
    eq('pending crowded: the empty root carries one observer', observers.length, 1);

    // The page draws a row group of text rows and two panes that each pass the
    // data test, which puts two elements at the configured depth.
    nest.rootEl.children.slice().forEach((child) => appendDgChild(rootEl, child));
    eq('pending crowded: the filled root still fails the data test',
      isDataTable(rootEl), false);
    eq('pending crowded: both panes pass the data test',
      [nest.paneAEl, nest.paneBEl].map(isDataTable), [true, true]);
    eq('pending crowded: the filled nest reports the crowded outcome',
      nominateNest(rootEl).outcome, 'crowded');

    withToggleDocumentMock(function () {
      if (observers[0]) observers[0].trigger();
      eq('pending crowded: one mutation schedules one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending crowded: a crowded re-test drops the pending root',
      pendingRoots.has(rootEl), false);
    eq('pending crowded: a crowded re-test disconnects the observer',
      observers[0] && observers[0].disconnectCount, 1);
    eq('pending crowded: the observer map holds nothing for the root',
      pendingObservers.has(rootEl), false);
    eq('pending crowded: the failed-re-test count map holds nothing for the root',
      pendingRetestCounts.has(rootEl), false);
    eq('pending crowded: the debounce timer map holds nothing for the root',
      pendingRetestTimers.has(rootEl), false);
    eq('pending crowded: a crowded nest registers no element',
      [rootEl, nest.paneAEl, nest.paneBEl].map((el) => DR_STORE.hasTable(el)),
      [false, false, false]);
    eq('pending crowded: a crowded nest gains no pillbox',
      [rootEl, nest.paneAEl, nest.paneBEl].map((el) => tableToggles.has(el)),
      [false, false, false]);
    eq('pending crowded: a crowded nest adds no registry entry',
      DR_STORE.getRegisteredTables().length - before, 0);
    eq('pending crowded: no pending root remains', pendingRoots.size, 0);
  });
})();

// --- Adversarial: the debounce collapses a burst of mutations into one re-test ---

(function pendingRetest_twoMutationsInsideTheDelayScheduleOneRetest() {
  const grid = makeDatabaseQueryGrid({ rows: 0 });

  withPendingHarness(function ({ observers, timers }) {
    withToggleDocumentMock(function () {
      injectTogglesForAddedNode(grid.wrapperEl);
    });

    const observer = observers[0];
    if (observer) observer.trigger();
    if (observer) observer.trigger();

    const scheduled = timers.filter((t) => t.ms === DR_DETECTION_SETTINGS.gridRedrawDelayMs);
    eq('pending debounce: two mutations schedule two timers and cancel the first',
      scheduled.map((t) => t.cancelled), [true, false]);
    eq('pending debounce: the delay is the grid redraw delay',
      scheduled.every((t) => t.ms === DR_DETECTION_SETTINGS.gridRedrawDelayMs), true);

    fillDatabaseQueryGrid(grid);
    withToggleDocumentMock(function () {
      eq('pending debounce: two mutations inside the delay run one re-test',
        runPendingRetestTimers(timers), 1);
    });

    eq('pending debounce: the one re-test registers the scrolling pane',
      DR_STORE.hasTable(grid.scrollPaneEl), true);
  });

  forgetRegisteredTable(grid.scrollPaneEl);
  eq('pending debounce: the case leaves no pending table behind', pendingRoots.size, 0);
})();

// ---------------------------------------------------------------------------
// Sprint grid-rowgroup-tr-extraction: GridAdapter._getRowEls handles ARIA grids
// whose data rows are bare <tr> inside a [role="rowgroup"], with header/summary
// rows OUTSIDE the rowgroup (e.g. Kaggle's Data Explorer). Standard ARIA only.
// ---------------------------------------------------------------------------

(function gridRowgroup_selectorFromGroup_universeFromGrid() {
  const grid = makeKaggleLikeGrid([
    ['2021-12-15', '5083.954', '8940'],
    ['2022-03-01', '3827.658', '1151'],
    ['2022-02-25', '2618.087', '122'],
  ]);
  const adapter = makeAdapter(grid);
  const rows = adapter.getRows();

  eq('grid-rowgroup: getRows() returns all 5 <tr> rows — header and stats included, desc block excluded',
    rows.length, 5);
  eq('grid-rowgroup: the first row is the header row, not the role="row" desc block',
    rows[0].getCells()[0].getText(), 'Release_Date');
  eq('grid-rowgroup: the data rows follow the header and stats rows',
    rows[2].getCells()[0].getText(), '2021-12-15');
  eq('grid-rowgroup: grid with bare-<tr> data rows is a data table',
    isDataTable(grid), true);
})();

// Without a rowgroup, bare <tr> rows are still discovered (orphan-tr fallback).
(function gridOrphanTr_noRowgroup() {
  const dataTrs = [makeTrRow(['a', '10']), makeTrRow(['b', '20'])];
  const wrapper = makeElementNode('grid', dataTrs);
  wrapper.tagName = 'DIV';
  wrapper.matches = () => false;
  wrapper.querySelector = () => null;
  wrapper.querySelectorAll = function(sel) {
    if (sel === 'tr') return dataTrs;
    return []; // no rowgroup, no role="row", no dg classes
  };

  const adapter = makeAdapter(wrapper);
  eq('grid-orphan-tr: getRows() finds bare <tr> rows when no rowgroup present',
    adapter.getRows().length, 2);
  eq('grid-orphan-tr: numeric cell readable',
    adapter.getRows()[0].getCells()[1].getText(), '10');
})();

// ---------------------------------------------------------------------------
// Sprint grid-first-row-literal: a rowgroup picks the row shape, not the row
// set. The rows found inside it decide the winning selector; the row list is
// then the whole grid's matches for that selector, so header and summary rows
// outside the group are rows like any other. Only the shipped first-row and
// first-column defaults hold rows: the header row holds because it is the
// grid's literal first row, and a Total row below the group rounds with the
// data. Before this, rowgroup scoping dropped the outside rows entirely and
// the first-row default held the first DATA row — the grid's second literal
// row.
// ---------------------------------------------------------------------------

// Row universe: role="row" grid with a header row before the group and a
// summary row after it — all four rows come back, in document order.
(function gridRowUniverse_roleRows() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['1111111', '1482391'], ['2222222', '918554']],
    ['Total', '2400945']
  );
  const rows = makeAdapter(g.wrapperEl).getRows();
  const firstCellText = function(row) {
    return row ? row.getCells()[0].getText() : '(missing row)';
  };
  eq('row-universe: header, data, and summary rows all count as rows',
    rows.length, 4);
  eq('row-universe: the header row is the grid\'s first row',
    firstCellText(rows[0]), 'Region');
  eq('row-universe: the summary row is the grid\'s last row',
    firstCellText(rows[3]), 'Total');
})();

// Row universe: two rowgroups with rows outside and between them — every
// row of the winning shape comes back, in document order.
(function gridRowUniverse_twoRowgroups() {
  function makeRoleRow(cellTexts) {
    const cellEls = cellTexts.map(makeGridCellWithTextNode);
    const row = makeElementNode('g-row', cellEls);
    row.children = cellEls;
    row.querySelectorAll = function(sel) {
      return sel === '[role="cell"]' ? cellEls : [];
    };
    return row;
  }
  const header = makeRoleRow(['Region', 'Q1']);
  const a1 = makeRoleRow(['North', '100']);
  const a2 = makeRoleRow(['South', '200']);
  const sep = makeRoleRow(['Subtotal', '300']);
  const b1 = makeRoleRow(['West', '400']);

  const groupA = makeElementNode('', [a1, a2]);
  groupA.querySelectorAll = (sel) => (sel === '[role="row"]' ? [a1, a2] : []);
  const groupB = makeElementNode('', [b1]);
  groupB.querySelectorAll = (sel) => (sel === '[role="row"]' ? [b1] : []);

  const wrapper = makeElementNode('aria-grid', [header, groupA, sep, groupB]);
  wrapper.tagName = 'DIV';
  wrapper.matches = () => false;
  wrapper.querySelector = () => null;
  wrapper.querySelectorAll = function(sel) {
    if (sel === '[role="rowgroup"]') return [groupA, groupB];
    if (sel === '[role="row"]') return [header, a1, a2, sep, b1]; // document order
    return [];
  };

  const rows = makeAdapter(wrapper).getRows();
  eq('row-universe: two rowgroups — all five rows come back in document order',
    rows.map(function(r) { return r.getCells()[0].getText(); }).join(','),
    'Region,North,South,Subtotal,West');
})();

// Detection: the row universe now starts at the header row, and a wide
// header of text labels must not exhaust the data-test sample before the
// scan reaches a data row (review finding: a six-column sales grid whose
// data rows lead with four text cells lost its pillbox).
(function gridRowUniverse_isDataTable_wideHeader() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Country', 'Segment', 'Channel', 'Units', 'Revenue'],
    [['North', 'Canada', 'Retail', 'Web', '120', '1482391']],
    null
  );
  eq('row-universe: a grouped grid with a wide text header still passes the data test',
    isDataTable(g.wrapperEl), true);
})();

// ---------------------------------------------------------------------------
// Sprint data-test-budget: the data test spends one budget of
// DR_DETECTION_SETTINGS.dataTestCellBudget cell reads, walked in document order and
// stopped at the first number, on native tables and grids alike. It replaces
// the retired per-row sample on grids and the retired unbounded scan on
// native tables. isDataTable and DR_DETECTION_SETTINGS.dataTestCellBudget live in
// chrome-extension/lib/dr-table/detect.js and chrome-extension/constants.js.
// ---------------------------------------------------------------------------

// AC1: a grid whose first data row leads with eleven text cells before its
// first number. Under the retired ten-cell-per-row sample this grid failed
// the data test, because the sample never reached the twelfth cell. The
// budget walks every cell in document order, so the number still falls
// inside it.
(function dataTestBudget_grid_numberInTwelfthColumnPasses() {
  const header = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const firstDataRow = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', '42'];
  const g = makeRowgroupRoleGrid(header, [firstDataRow], null);
  eq('data test: a grid whose first number sits in the twelfth column of its first data row passes',
    isDataTable(g.wrapperEl), true);
})();

// AC2: a native table large enough to cross the budget. The budget reads
// cells in document order, header row included, and stops at the first
// number. A table with no number inside the budget fails; the same table
// with a number at the budget-th cell passes; the same table with its only
// number one cell past the budget fails.
(function dataTestBudget_nativeTable_boundary() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const cols = 101;
  const rows = Math.ceil((budget + 1) / cols);

  eq('data test: DR_DETECTION_SETTINGS.dataTestCellBudget is 1000',
    budget, 1000);

  const noNumberTable = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, null));
  eq('data test: a native table holding no number within the budget of cell reads fails',
    isDataTable(noNumberTable), false);

  const atBudgetTable = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, budget));
  eq('data test: the same table with a number at the budget-th cell passes',
    isDataTable(atBudgetTable), true);

  const pastBudgetTable = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, budget + 1));
  eq('data test: the same table with its only number one cell past the budget fails',
    isDataTable(pastBudgetTable), false);
})();

// AC3: a native table of three rows by two cells with one number still
// passes. The budget does not disturb a table well inside it.
(function dataTestBudget_smallNativeTablePasses() {
  const table = makeNativeTableEl([
    [{ tag: 'td', text: 'Name' }, { tag: 'td', text: 'Role' }],
    [{ tag: 'td', text: 'Alice' }, { tag: 'td', text: 'Eng' }],
    [{ tag: 'td', text: 'Bob' }, { tag: 'td', text: '42' }],
  ]);
  eq('data test: a three-row, two-cell native table with one number passes',
    isDataTable(table), true);
})();

// Goal, native tables: the retired rule left native tables unbounded, so a
// number far past 1000 cells would have passed. The budget applies to native tables and
// grids alike, so this table fails.
(function dataTestBudget_nativeTable_farPastBudgetFails() {
  const budget = DR_DETECTION_SETTINGS.dataTestCellBudget;
  const cols = 100;
  const rows = Math.ceil((budget * 3) / cols);
  const totalCells = rows * cols;
  const table = makeNativeTableEl(buildBudgetTableRowsSpec(rows, cols, totalCells));
  eq('data test: a native table whose only number sits far past the cell budget fails',
    isDataTable(table), false);
})();

// Source guard: the retired per-row and per-grid sample constants carry no
// definition anywhere in the detection layer.
(function dataTestBudget_retiredSampleConstantsGone() {
  if (detectCode === null) {
    eq('data test: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const retiredNames = ['GRID_IS_DATA_TABLE_CELL_SAMPLE', 'GRID_IS_DATA_TABLE_ROW_SAMPLE'];
  for (const name of retiredNames) {
    const definitionPattern = new RegExp(`\\b(const|let|var)\\s+${name}\\b`);
    eq(`data test: the detection layer carries no definition of the retired ${name}`,
      definitionPattern.test(detectCode), false);
  }
})();

// AC4: the three living docs each state the 1000-cell budget, per AGENTS.md's
// rule that a behavior-invalidating change updates every living doc it
// invalidates in the same branch.
(function dataTestBudget_livingDocsStateTheBudget() {
  const readmeMd = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  // The pattern matches a reworded sentence and fails on a sentence with no
  // budget: the digits 1000 must sit within 80 characters of either
  // "data test" or "cell read(s)".
  const statesBudget = (text) =>
    /1000[\s\S]{0,80}(data test|cell reads?)|(data test|cell reads?)[\s\S]{0,80}1000/i.test(text);
  eq('living docs: chrome-extension/README.md states the 1000-cell budget',
    statesBudget(readmeMd), true);
  eq('living docs: docs/design.md states the 1000-cell budget',
    statesBudget(designMd), true);
  eq('living docs: docs/vocabulary.md states the 1000-cell budget',
    statesBudget(vocabularyMd), true);
})();

// Behavior: the header row holds because it is the literal first row; the
// first data row and the summary row round. The first column still holds.
(function gridRowUniverse_headerHolds_dataAndSummaryRound() {
  const g = makeRowgroupRoleGrid(
    ['Region', '999999'],
    [['North', '1482391'], ['South', '918554']],
    ['Total', '2400945']
  );
  const { cells: results } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), Object.assign({}, DR_DEFAULTS), { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  // results are row-major over all rows: [header c0, header c1, r1c0, r1c1, r2c0, r2c1, total c0, total c1]
  eq('row-universe: every cell of every row is classified',
    results.length, 8);
  eq('row-universe: the header row\'s numeric cell holds under the first-row default',
    results[1] && results[1].patches.length, 0);
  eq('row-universe: the first data row rounds under defaults',
    !!(results[3] && results[3].patches.length > 0), true);
  eq('row-universe: the first column of a data row still holds',
    results[2] && results[2].patches.length, 0);
  eq('row-universe: the summary row below the group rounds with the data',
    !!(results[7] && results[7].patches.length > 0), true);
})();

// Behavior: with the rowgroup first (no header row outside), the first data
// row IS the grid's literal first row and holds under the default.
(function gridRowUniverse_groupAtTop_firstDataRowHolds() {
  const g = makeRowgroupRoleGrid(
    null,
    [['1111111', '1482391'], ['2222222', '918554']],
    ['Total', '2400945']
  );
  const { cells: results } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), Object.assign({}, DR_DEFAULTS), { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  eq('row-universe: rowgroup-first grid holds its first data row',
    results[1] && results[1].patches.length, 0);
  eq('row-universe: rowgroup-first grid rounds its second data row',
    !!(results[3] && results[3].patches.length > 0), true);
  eq('row-universe: rowgroup-first grid rounds its summary row',
    !!(results[5] && results[5].patches.length > 0), true);
})();

// Outside rows: a row outside the row group rounds, but its values stay out
// of the dataset — they never feed the max magnitude or the lens preview.
(function gridOutsideRow_staysOutOfDataset() {
  // Total is a magnitude ABOVE the data (7 vs 6): if it fed the basis, the
  // max magnitude would read 7.
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1,482,391'], ['South', '918,554']],
    ['Total', '24,009,450']
  );
  const { cells: results, maxMag } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), Object.assign({}, DR_DEFAULTS), { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  eq('outside-row: the max magnitude comes from the data rows alone',
    maxMag, 6);
  eq('outside-row: the outside row still rounds against that dataset',
    !!(results[7] && results[7].patches.length > 0), true);
})();

// Outside rows: the lens preview pool draws from the dataset only.
(function gridOutsideRow_staysOutOfPreview() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', '1482391'], ['South', '918554']],
    ['Total', '2400945']
  );
  const cells = collectNumericCells(g.wrapperEl);
  eq('outside-row: lens preview pool includes the first data row value',
    cells.some(function(c) { return c.num === 1482391; }), true);
  eq('outside-row: lens preview pool leaves the outside row value out',
    cells.some(function(c) { return c.num === 2400945; }), false);
})();

// Pin: only the footer section carries the outside mark on native tables.
// A header-section row's td values still feed the dataset — the deliberate
// scope of the outside-row rule (Arie approved footer-only). The offsets are
// pulled apart: with the thead value (magnitude 8) in the basis, the body
// value (magnitude 7) is the other band (nearest 1M → 88,000,000); marking
// THEAD outside would flip it to the top band (nearest 5M → 90,000,000).
(function nativeHeaderRow_staysInDataset() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'td', text: '987,654,321' }],
      [{ tag: 'td', text: '87,654,321' }],
    ]);
    table.rows[0].parentElement = { tagName: 'THEAD' };
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -1, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    eq('outside-row (native): a header-section value still feeds the dataset',
      table.rows[1].cells[0].innerText, '88,000,000');
  });
})();

// Pin: when a table's only numbers sit in outside rows, the dataset is empty
// (max magnitude null) and every outside value takes the other-band offset —
// the accepted edge, recorded so the next reader need not re-derive it.
(function gridOutsideRow_emptyDatasetTakesOtherOffset() {
  const g = makeRowgroupRoleGrid(
    ['Region', 'Q1'],
    [['North', 'n/a']],
    ['Total', '24,009,450']
  );
  const opts = Object.assign({}, DR_DEFAULTS, { offsetTop: -0.5, offsetOther: -1 });
  const { cells: results, maxMag } = simplifyTableCells(g.wrapperEl, registryAdapter(g.wrapperEl).getRows(), opts, { kind: GRID_TABLE_PASS, frozenMaxMag: null, writes: 'none' });
  eq('outside-row: a dataset of outside rows alone is empty',
    maxMag, null);
  eq('outside-row: with an empty dataset the outside value takes the other-band offset',
    results[5] && results[5].patches[0] && results[5].patches[0].newNum, '24,000,000');
})();

// Outside rows, native analog: a footer-section row rounds but stays out of
// the dataset. The offsets are pulled apart so the basis is visible in the
// output: with the footer value (magnitude 8) out of the basis, the body
// value (magnitude 7) is the top band and takes offset_top (nearest 5M →
// 90,000,000); if the footer fed the basis, the body value would take
// offset_other (nearest 1M → 88,000,000).
(function nativeFooterRow_staysOutOfDataset() {
  withCreateTreeWalker(function() {
    const table = makeMockTable([
      [{ tag: 'td', text: '87,654,321' }],
      [{ tag: 'td', text: '987,654,321' }],
    ]);
    table.rows[1].parentElement = { tagName: 'TFOOT' };
    const opts = {
      enabled: true, simplifyMixedCells: false, simplifyDates: false, simplifyTimes: false,
      simplifyFirstRow: true, simplifyFirstColumn: true,
      simplifyMixedPercent: false, simplifyMixedCurrency: false,
      offsetTop: -0.5, offsetOther: -1, numTop: 1,
      rangeExpr: ''
    };
    roundTable(table, opts);
    eq('outside-row (native): the body value rounds on the top band — the footer value did not raise the basis',
      table.rows[0].cells[0].innerText, '90,000,000');
    eq('outside-row (native): the footer row still rounds against the dataset',
      table.rows[1].cells[0].innerText, '1,000,000,000');
  });
})();

