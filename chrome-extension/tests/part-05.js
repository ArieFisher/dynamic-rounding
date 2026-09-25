// ---------------------------------------------------------------------------
// Sprint refactor/simplify-naming-unification — Adversarial contract lock-in
// ---------------------------------------------------------------------------

(function simplifyNamingUnification() {

  // -------------------------------------------------------------------------
  // AC1: Renames are total — no old key names survive in any source file.
  // Pattern strings are split across concatenation to prevent self-matching.
  // -------------------------------------------------------------------------
  // Content-script entries are manifest-driven (guarded, no crash on a
  // rename); the other files are not content scripts, so they keep direct
  // reads by their own fixed names. The suite's own text is the joined
  // suite, since no file on disk holds it.
  const contentScriptFileNames = ['constants.js', 'content.js'];
  const directReadFileNames = ['sidebar.html', 'sidebar.js', 'tests.js'];
  const oldKeys = [
    'include' + 'Words',
    'include' + 'Currency',
    'include' + 'Percent',
    'exclude' + 'FirstRow',
    'exclude' + 'FirstColumn',
  ];
  for (const file of contentScriptFileNames) {
    const src = sourceByName(file);
    if (src === null) {
      eq(`AC1: source file ${file} present in manifest`, false, true);
      continue;
    }
    for (const key of oldKeys) {
      eq(`AC1: old key "${key}" absent from ${file}`,
        src.includes(key), false);
    }
  }
  for (const file of directReadFileNames) {
    const src = file === 'tests.js'
      ? SUITE_SOURCE
      : fs.readFileSync(path.join(__dirname, file), 'utf8');
    for (const key of oldKeys) {
      eq(`AC1: old key "${key}" absent from ${file}`,
        src.includes(key), false);
    }
  }

  // -------------------------------------------------------------------------
  // AC2: simplifyFirstRow polarity — four cases.
  // -------------------------------------------------------------------------

  // Case 1: flag true → row 0 IS simplified (not excluded)
  eq('AC2 simplifyFirstRow: true + row 0 → null (row IS simplified)',
    getExclusionReason('1,234', 1, { simplifyFirstRow: true }, 0), null);

  // Case 2: flag false → row 0 excluded
  eq('AC2 simplifyFirstRow: false + row 0 → "firstRow"',
    getExclusionReason('1,234', 1, { simplifyFirstRow: false }, 0), 'firstRow');

  // Case 3: flag unset (undefined) → row 0 excluded (intentional default change)
  eq('AC2 simplifyFirstRow: unset + row 0 → "firstRow" (new default semantics)',
    getExclusionReason('1,234', 1, {}, 0), 'firstRow');

  // Case 4: flag false but row 1 → null (only row 0 is affected)
  eq('AC2 simplifyFirstRow: false + row 1 → null (non-first row unaffected)',
    getExclusionReason('1,234', 1, { simplifyFirstRow: false }, 1), null);

  // -------------------------------------------------------------------------
  // AC3: simplifyFirstColumn polarity — mirror of AC2.
  // -------------------------------------------------------------------------

  // Case 1: flag true → col 0 IS simplified (not excluded)
  eq('AC3 simplifyFirstColumn: true + col 0 → null (col IS simplified)',
    getExclusionReason('1,234', 0, { simplifyFirstColumn: true, simplifyFirstRow: true }, 1), null);

  // Case 2: flag false → col 0 excluded
  eq('AC3 simplifyFirstColumn: false + col 0 → "firstColumn"',
    getExclusionReason('1,234', 0, { simplifyFirstRow: true, simplifyFirstColumn: false }, 1), 'firstColumn');

  // Case 3: flag unset → col 0 excluded (intentional default change)
  eq('AC3 simplifyFirstColumn: unset + col 0 → "firstColumn" (new default semantics)',
    getExclusionReason('1,234', 0, { simplifyFirstRow: true }, 1), 'firstColumn');

  // Case 4: flag false but col 1 → null (only col 0 is affected)
  eq('AC3 simplifyFirstColumn: false + col 1 → null (non-first column unaffected)',
    getExclusionReason('1,234', 1, { simplifyFirstRow: true, simplifyFirstColumn: false }, 1), null);

  // -------------------------------------------------------------------------
  // AC4a: simplifyMixedCurrency polarity.
  // -------------------------------------------------------------------------

  eq('AC4a simplifyMixedCurrency: true + "$1,234" → null (NOT excluded)',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: true }, 1), null);

  eq('AC4a simplifyMixedCurrency: false + "$1,234" → "currency"',
    getExclusionReason('$1,234', 1, { simplifyMixedCurrency: false }, 1), 'currency');

  // -------------------------------------------------------------------------
  // AC4b: simplifyMixedPercent polarity.
  // -------------------------------------------------------------------------

  eq('AC4b simplifyMixedPercent: true + "45%" → null (NOT excluded)',
    getExclusionReason('45%', 1, { simplifyMixedPercent: true }, 1), null);

  eq('AC4b simplifyMixedPercent: false + "45%" → "percent"',
    getExclusionReason('45%', 1, { simplifyMixedPercent: false }, 1), 'percent');

  // -------------------------------------------------------------------------
  // AC5: simplifyMixedCells=false → prose cell with embedded number not touched.
  // Use roundTable with a real mock table.
  // -------------------------------------------------------------------------
  withCreateTreeWalker(function() {
    // Two cells: a large anchor so max_mag is set, and a prose cell.
    const table = makeMockTable([[
      { tag: 'td', text: '8,000,000' },
      { tag: 'td', text: 'about 1,234 widgets' },
    ]]);
    roundTable(table, {
      enabled: true,
      simplifyMixedCells: false,
      simplifyMixedCurrency: false,
      simplifyMixedPercent: false,
      simplifyFirstRow: true,
      simplifyFirstColumn: true,
      simplifyDates: false,
      simplifyTimes: false,
      offsetTop: -0.5, offsetOther: -0.5, numTop: 1, rangeExpr: ''
    });
    const proseCell = table.rows[0].cells[1];
    eq('AC5 simplifyMixedCells=false: prose cell NOT marked as rounded',
      proseCell.classList.contains('dr-ext-rounded'), false);
    eq('AC5 simplifyMixedCells=false: prose cell text unchanged',
      proseCell.innerText, 'about 1,234 widgets');
  });

  // -------------------------------------------------------------------------
  // AC6: DR_DEFAULTS snapshot — all seven new keys with exact default values.
  // -------------------------------------------------------------------------
  eq('AC6 DR_DEFAULTS: simplifyMixedCells = true',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('AC6 DR_DEFAULTS: simplifyMixedCurrency = true',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('AC6 DR_DEFAULTS: simplifyMixedPercent = true',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('AC6 DR_DEFAULTS: simplifyDates = true',
    DR_DEFAULTS.simplifyDates, true);
  eq('AC6 DR_DEFAULTS: simplifyTimes = false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('AC6 DR_DEFAULTS: simplifyFirstRow = false',
    DR_DEFAULTS.simplifyFirstRow, false);
  eq('AC6 DR_DEFAULTS: simplifyFirstColumn = false',
    DR_DEFAULTS.simplifyFirstColumn, false);

  // -------------------------------------------------------------------------
  // AC7: sidebar.html id ↔ setting key parity — each of the seven keys must
  // appear as id="<key>" on a checkbox <input>.
  // -------------------------------------------------------------------------
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sevenKeys = [
    'simplifyMixedCells', 'simplifyMixedCurrency', 'simplifyMixedPercent',
    'simplifyDates', 'simplifyTimes', 'simplifyFirstRow', 'simplifyFirstColumn'
  ];
  for (const key of sevenKeys) {
    // Match <input ... type="checkbox" ... id="<key>"> (or id before type)
    eq(`AC7 sidebar.html: checkbox with id="${key}" present`,
      new RegExp(`<input[^>]*type="checkbox"[^>]*id="${key}"|<input[^>]*id="${key}"[^>]*type="checkbox"`).test(sidebarHtml),
      true);
  }

})();

// =============================================================================
// applyExtractedPatches — unit tests and integration regression tests
// =============================================================================

// ---------------------------------------------------------------------------
// Unit tests for applyExtractedPatches
// ---------------------------------------------------------------------------
(function applyExtractedPatches_unitTests() {

  // AP1: single text node, single patch
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'Revenue 1500 USD' }]);
    applyExtractedPatches(cell, [{ index: 8, numStr: '1500', newNum: '2k' }]);
    eq('AP1: single node patch replaces number', cell._textNodes[0].nodeValue, 'Revenue 2k USD');
  });

  // AP2: two patches in the same node, right-to-left order preserved
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: '1500 and 2500' }]);
    applyExtractedPatches(cell, [
      { index: 0,  numStr: '1500', newNum: '2k' },
      { index: 9,  numStr: '2500', newNum: '3k' },
    ]);
    eq('AP2: two patches in same node', cell._textNodes[0].nodeValue, '2k and 3k');
  });

  // AP3: patch targets a plain node; sup node is untouched
  // cell: "1.5×10"(plain) + "31"(sup) + " m"(plain) + "3"(sup)
  // flat: "1.5×1031 m3", patch "1.5" at index 0 → "2"
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ' m' },
      { text: '3', inSup: true },
    ]);
    applyExtractedPatches(cell, [{ index: 0, numStr: '1.5', newNum: '2' }]);
    eq('AP3: base node updated', cell._textNodes[0].nodeValue, '2×10');
    eq('AP3: sup "31" node untouched', cell._textNodes[1].nodeValue, '31');
    eq('AP3: " m" node untouched',     cell._textNodes[2].nodeValue, ' m');
    eq('AP3: sup "3" node untouched',  cell._textNodes[3].nodeValue, '3');
  });

  // AP4: patch in a later plain node; earlier node untouched
  // cell: "text, "(plain) + "1500"(plain)
  // patch "1500" at index 6
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: 'text, ' },
      { text: '1500' },
    ]);
    applyExtractedPatches(cell, [{ index: 6, numStr: '1500', newNum: '2k' }]);
    eq('AP4: first node untouched', cell._textNodes[0].nodeValue, 'text, ');
    eq('AP4: second node patched',  cell._textNodes[1].nodeValue, '2k');
  });

  // AP5: defensive — wrong numStr at index → node unchanged
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    applyExtractedPatches(cell, [{ index: 4, numStr: '9999', newNum: '10k' }]);
    eq('AP5: wrong numStr → no change', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

  // AP6: empty patches array → no-op
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([{ text: 'abc 1500 def' }]);
    applyExtractedPatches(cell, []);
    eq('AP6: empty patches → unchanged', cell._textNodes[0].nodeValue, 'abc 1500 def');
  });

})();

// ---------------------------------------------------------------------------
// Integration regression tests via roundTable
// These reproduce the three Wikipedia bugs.
// ---------------------------------------------------------------------------
(function applyExtractedPatches_regressionTests() {

  const makeSupTable = (cell) => ({
    rows: [{ cells: [cell] }],
    querySelector: () => null,
    dataset: {},
  });

  // RG1: Comma preservation
  // Cell: "1.5×10<sup>31</sup>, more text"
  // flat: "1.5×1031, more text"
  // "1.5" is in the base node; after rounding it shortens.
  // The comma and "more text" node must be untouched.
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ', more text' },
    ]);
    cell.querySelector = (sel) => sel === 'sup' ? { tagName: 'SUP' } : null;
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG1: comma and trailing text preserved',
      cell._textNodes[2].nodeValue, ', more text');
    eq('RG1: sup exponent node untouched',
      cell._textNodes[1].nodeValue, '31');
  });

  // RG2: Superscript digit preserved after rounding
  // Cell: "1.5×10<sup>31</sup> m<sup>3</sup>"
  // flat: "1.5×1031 m3"
  // Rounding "1.5" → shorter string must not corrupt the <sup>3</sup> node.
  withSupCreateTreeWalker(function() {
    const cell = makeExtractedCell([
      { text: '1.5×10' },
      { text: '31', inSup: true },
      { text: ' m' },
      { text: '3', inSup: true },
    ]);
    cell.querySelector = (sel) => sel === 'sup' ? { tagName: 'SUP' } : null;
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG2: sup "3" node still contains "3" after rounding',
      cell._textNodes[3].nodeValue, '3');
    eq('RG2: " m" node still contains " m"',
      cell._textNodes[2].nodeValue, ' m');
  });

  // RG3: Anchor text node intact after rounding an adjacent number
  // Cell structure (flat): "1234 lithium-7"
  // "1234" is in a plain node; "lithium-7" is inside an anchor node.
  // filterLinkMatches excludes "7" (inside anchor), so only "1234" is rounded.
  // 1234 with offsetTop=-0.5 rounds to 1000 (confirmed: step=500, round(1234/500)=2, 2×500=1000).
  // The anchor text node must be exactly "lithium-7" after rounding.
  withSupCreateTreeWalker(function() {
    const anchor = {
      innerText: 'lithium-7',
      textContent: 'lithium-7',
      _isAnchor: true,
    };
    const plainNode = {
      nodeValue: '1234 ',
      parentNode: {},
      parentElement: { closest: () => null },
    };
    const anchorNode = {
      nodeValue: 'lithium-7',
      parentNode: anchor,
      parentElement: { closest: (sel) => sel === 'a' ? anchor : null },
    };
    const cell = {
      innerText: '1234 lithium-7',
      textContent: '1234 lithium-7',
      innerHTML: '1234 lithium-7',
      classList: { _classes: [], add(c) { this._classes.push(c); }, contains(c) { return this._classes.includes(c); } },
      dataset: {},
      title: '',
      tagName: 'TD',
      querySelectorAll: (sel) => sel === 'a' ? [anchor] : [],
      querySelector: () => null,
      contains: (node) => node === anchor,
      _textNodes: [plainNode, anchorNode],
    };
    roundTable(makeSupTable(cell), supTestOpts);
    eq('RG3: anchor text node is intact after rounding adjacent number',
      anchorNode.nodeValue, 'lithium-7');
    eq('RG3: plain node was rounded (1234 → 1000)',
      plainNode.nodeValue, '1000 ');
  });

})();

// =============================================================================
// Grid Detection — looksLikeGrid() and findTargetTable() unit tests
// Sprint: grid-detection  Spec: docs/sprint-plans/grid-support.md §6
// =============================================================================

// ---------------------------------------------------------------------------
// Mock-element helpers for grid detection tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// looksLikeGrid() — PASS cases
// ---------------------------------------------------------------------------

// LG1: Pass — unlabelled div-grid, VARIABLE ROW HEIGHTS (AC2, S2 headline)
// S2 mandates row height is NOT tested. Rows must have differing heights yet
// the function must still return true. Column-0 offsetWidths are uniform (80px)
// so step 6 passes.
(function looksLikeGrid_pass_variableRowHeights() {
  const rows = [
    makeGridRow([{text:'Name',width:80},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:80},{text:'5678'}], 'row', 35),  // taller
    makeGridRow([{text:'Bar baz',width:80},{text:'9012'}], 'row', 50), // even taller
    makeGridRow([{text:'Qux',width:80},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:80},{text:'7890'}], 'row', 80),  // very tall
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — unlabelled, variable row heights',
      looksLikeGrid(container), true);
  });
})();

// LG2: Pass — ARIA short-circuit (role="grid") skips geometry probe
// The geometry probe (step 6) is skipped when role="grid". We prove this by
// making column-0 offsetWidths NON-uniform (all different) — if step 6 ran,
// the 80% alignment check would fail and return false. With the ARIA
// short-circuit the function must still return true.
(function looksLikeGrid_pass_ariaShortCircuit() {
  const rows = [
    makeGridRow([{text:'Col',width:10},{text:'1234'}], 'row', 20),  // width 10
    makeGridRow([{text:'Foo',width:20},{text:'5678'}], 'row', 20),  // width 20
    makeGridRow([{text:'Bar',width:30},{text:'9012'}], 'row', 20),  // width 30
    makeGridRow([{text:'Qux',width:40},{text:'3456'}], 'row', 20),  // width 40
    makeGridRow([{text:'Etc',width:50},{text:'7890'}], 'row', 20),  // width 50
  ];
  // All column-0 widths differ → step 6 would reject; ARIA role must short-circuit before it.
  const container = makeGridContainer(rows, 'flex', 'grid', '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — ARIA role="grid" short-circuits geometry probe (non-uniform widths still accepted)',
      looksLikeGrid(container), true);
  });
})();

// LG3: Pass — database query shape (library class "dg--" short-circuits geometry probe)
// The wrapper contains a pinned pane and a scroll pane as children, but for
// looksLikeGrid we test the wrapper itself: it has ≥5 row-like children,
// repetitive structure, numeric content, and the "dg--" class which short-circuits
// before the geometry probe. Column-0 widths are deliberately non-uniform so that
// if the geometry probe ran it would fail — proving the short-circuit works.
(function looksLikeGrid_pass_databaseQueryClass() {
  const rows = [
    makeGridRow([{text:'Header',width:10},{text:'0'}], 'dg--row', 20),
    makeGridRow([{text:'Foo',width:20},{text:'1234.56'}], 'dg--row', 20),
    makeGridRow([{text:'Bar',width:30},{text:'7890.12'}], 'dg--row', 20),
    makeGridRow([{text:'Baz',width:40},{text:'3456.78'}], 'dg--row', 20),
    makeGridRow([{text:'Qux',width:50},{text:'9012.34'}], 'dg--row', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, 'dg--table-wrapper');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — database query "dg--" class short-circuits geometry probe',
      looksLikeGrid(container), true);
  });
})();

// ---------------------------------------------------------------------------
// looksLikeGrid() — REJECT cases (AC4 false-positive guard)
// ---------------------------------------------------------------------------

// LG4: Reject — CSS layout/card grid with NO numeric content (AC4)
// Repetitive card-style divs with text-only content must be rejected.
// This proves step 5 (numeric-content guard) works as the mandatory false-positive guard.
(function looksLikeGrid_reject_cssCardGrid() {
  const rows = [
    makeGridRow([{text:'Card A',width:100},{text:'Buy now'}], 'card', 20),
    makeGridRow([{text:'Card B',width:100},{text:'Learn more'}], 'card', 20),
    makeGridRow([{text:'Card C',width:100},{text:'Details'}], 'card', 20),
    makeGridRow([{text:'Card D',width:100},{text:'Visit site'}], 'card', 20),
    makeGridRow([{text:'Card E',width:100},{text:'Sign up'}], 'card', 20),
  ];
  const container = makeGridContainer(rows, 'grid', null, 'card-grid');
  withGridComputedStyle(container, 'grid', function() {
    eq('looksLikeGrid: reject — CSS card grid with no numeric content',
      looksLikeGrid(container), false);
  });
})();

// LG5: Reject — nav menu (repetitive rows, no numbers) (AC4)
// A navigation menu with text-only items must be rejected.
// This is the second false-positive guard test per the spec.
(function looksLikeGrid_reject_navMenu() {
  const rows = [
    makeGridRow([{text:'Home',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'About',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Products',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Contact',width:100},{text:''}], 'nav-item', 20),
    makeGridRow([{text:'Blog',width:100},{text:''}], 'nav-item', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, 'nav-menu');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — nav menu with no numeric content',
      looksLikeGrid(container), false);
  });
})();

// LG6: Reject — too few children (< GRID_MIN_CHILDREN = 5)
(function looksLikeGrid_reject_tooFewChildren() {
  const rows = [
    makeGridRow([{text:'Foo',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Baz',width:100},{text:'9012'}], 'row', 20),
    // only 3 rows — fewer than GRID_MIN_CHILDREN (5)
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — fewer than 5 children',
      looksLikeGrid(container), false);
  });
})();

// LG7: Reject — display is not grid/flex (step 4)
(function looksLikeGrid_reject_blockDisplay() {
  const rows = [
    makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
  ];
  const container = makeGridContainer(rows, 'block', null, '');
  withGridComputedStyle(container, 'block', function() {
    eq('looksLikeGrid: reject — display:block (not grid/flex)',
      looksLikeGrid(container), false);
  });
})();

// LG8: Reject — non-uniform column-0 widths (step 6) when no short-circuit
// Proves the geometry probe rejects grids where column widths are misaligned.
// All widths differ so < 80% match → rejected.
(function looksLikeGrid_reject_nonUniformColumnWidths() {
  const rows = [
    makeGridRow([{text:'Name',width:10},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:20},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:30},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:40},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:50},{text:'7890'}], 'row', 20),
  ];
  // No role, no library class → step 6 runs and must reject.
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: reject — non-uniform column-0 widths (step 6)',
      looksLikeGrid(container), false);
  });
})();

// LG9: Pass — column-0 widths are uniform (80% threshold satisfied)
// Exactly matching widths → step 6 passes.
(function looksLikeGrid_pass_uniformColumnWidths() {
  const rows = [
    makeGridRow([{text:'Name',width:100},{text:'1234'}], 'row', 20),
    makeGridRow([{text:'Foo',width:100},{text:'5678'}], 'row', 20),
    makeGridRow([{text:'Bar',width:100},{text:'9012'}], 'row', 20),
    makeGridRow([{text:'Qux',width:100},{text:'3456'}], 'row', 20),
    makeGridRow([{text:'Etc',width:100},{text:'7890'}], 'row', 20),
  ];
  const container = makeGridContainer(rows, 'flex', null, '');
  withGridComputedStyle(container, 'flex', function() {
    eq('looksLikeGrid: pass — uniform column-0 widths',
      looksLikeGrid(container), true);
  });
})();

// ---------------------------------------------------------------------------
// findTargetTable() walk-up tests
// ---------------------------------------------------------------------------

// FT1: findTargetTable — returns OUTERMOST matching ancestor (S6), not inner pane
// Build three nested containers: innermost → middle → outer.
// Both innermost and outer pass looksLikeGrid (both have numeric content, flex,
// uniform col-0 widths). Middle also passes. The walk-up must keep going as long
// as the parent passes and return the OUTERMOST (outer), not innermost.
(function findTargetTable_returnsOutermostAncestor() {
  withFindTargetEnv([], function() {
    // inner, middle, outer all pass looksLikeGrid
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    const inner  = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const middle = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer  = makeWalkEl({ display: 'flex', rows: makeRows5() });

    // Wire up parent chain: inner → middle → outer → (body = stop)
    inner.parentElement  = middle;
    inner.parentNode     = middle;
    middle.parentElement = outer;
    middle.parentNode    = outer;
    outer.parentElement  = document.body;
    outer.parentNode     = document.body;

    // The click target is inner itself (not in any <table>, no dr-ext-grid yet).
    // Adjust closest() on inner to use the real chain.
    inner.closest = function(sel) {
      if (sel === 'table') return null;
      if (sel === '.dr-ext-grid') return null;
      return null;
    };

    const result = findTargetTable(inner);

    eq('findTargetTable: returns outermost ancestor (S6), not inner pane',
      result.handle, outer);
  });
})();

// FT2: findTargetTable — does NOT overshoot to <body> and respects depth cap
// A chain of 3 containers where only the first two pass looksLikeGrid;
// the third fails. The walk must stop at the second (outermost passing) container,
// not continue to body.
(function findTargetTable_stopsAtFailingParent() {
  withFindTargetEnv([], function() {
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    // Text-only rows: will fail looksLikeGrid at step 5 (no numeric content)
    const noNumericRows = [
      makeGridRow([{text:'Alpha',width:100},{text:'Foo'}], 'row', 20),
      makeGridRow([{text:'Beta',width:100},{text:'Bar'}], 'row', 20),
      makeGridRow([{text:'Gamma',width:100},{text:'Baz'}], 'row', 20),
      makeGridRow([{text:'Delta',width:100},{text:'Qux'}], 'row', 20),
      makeGridRow([{text:'Epsilon',width:100},{text:'Quux'}], 'row', 20),
    ];

    const inner    = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outerOk  = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const failsLLG = makeWalkEl({ display: 'flex', rows: noNumericRows });

    inner.parentElement    = outerOk;
    inner.parentNode       = outerOk;
    outerOk.parentElement  = failsLLG;
    outerOk.parentNode     = failsLLG;
    failsLLG.parentElement = document.body;
    failsLLG.parentNode    = document.body;

    inner.closest = function(sel) { return null; };

    const result = findTargetTable(inner);

    // Must return outerOk, not failsLLG or body
    eq('findTargetTable: stops at failing parent, returns outermost passing container',
      result.handle, outerOk);

    // Must NOT return the body sentinel or the failing container
    eq('findTargetTable: does not return failing container',
      result.handle === failsLLG, false);
  });
})();

// FT3: findTargetTable — prefers native <table> ancestor over grid heuristic
// When the element has a <table> ancestor, closest('table') must be returned
// immediately without engaging the looksLikeGrid walk-up (AC1).
(function findTargetTable_prefersNativeTable() {
  withFindTargetEnv([], function() {
    const tableEl = { tagName: 'TABLE', rows: [], dataset: {} };

    // A click target that has a <table> ancestor.
    const clickTarget = {
      tagName: 'TD',
      nodeType: 1,
      parentElement: tableEl,
      parentNode: tableEl,
      closest: function(sel) {
        if (sel === 'table') return tableEl;
        return null;
      },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: prefers native <table> ancestor over grid heuristic',
      result.handle, tableEl);
    // A bare <table> ancestor is a case the caller already knows how to
    // handle (it never gets the dr-ext-grid marker); isNew is always false.
    eq('findTargetTable: native <table> ancestor reports isNew: false',
      result.isNew, false);
  });
})();

// FT4: findTargetTable — returns null when nothing found
// A click target with no grid ancestors and no <table> ancestor.
(function findTargetTable_returnsNullWhenNothing() {
  withFindTargetEnv([], function() {
    // Text-only rows fail looksLikeGrid (step 5 — no numeric content)
    const noNumericRows = [
      makeGridRow([{text:'Alpha',width:100},{text:'Foo'}], 'row', 20),
      makeGridRow([{text:'Beta',width:100},{text:'Bar'}], 'row', 20),
      makeGridRow([{text:'Gamma',width:100},{text:'Baz'}], 'row', 20),
      makeGridRow([{text:'Delta',width:100},{text:'Qux'}], 'row', 20),
      makeGridRow([{text:'Epsilon',width:100},{text:'Quux'}], 'row', 20),
    ];

    const parent = makeWalkEl({ display: 'flex', rows: noNumericRows });
    parent.parentElement = document.body;
    parent.parentNode    = document.body;

    const clickTarget = {
      tagName: 'DIV',
      nodeType: 1,
      parentElement: parent,
      parentNode: parent,
      closest: function(sel) { return null; },
    };

    const result = findTargetTable(clickTarget);

    eq('findTargetTable: returns null when no grid or table found',
      result, null);
  });
})();

// FT5: findTargetTable — returns already-found ancestor without re-walking
// If an ancestor is already known per opts.isSeen (app-model-registry sprint
// replaced the closest('.dr-ext-grid') read with an injected isSeen check —
// see lib/dr-table/detect.js), it must be returned immediately without
// calling looksLikeGrid again.
(function findTargetTable_returnsAlreadyTaggedGrid() {
  withFindTargetEnv([], function() {
    const existingGrid = makeWalkEl({ display: 'flex' });

    const clickTarget = {
      tagName: 'DIV',
      nodeType: 1,
      parentElement: existingGrid,
      parentNode: existingGrid,
      closest: function(sel) { return null; },
    };

    const seen = new Set([existingGrid]);
    const result = findTargetTable(clickTarget, { isSeen: (el) => seen.has(el) });

    eq('findTargetTable: returns already-found ancestor immediately',
      result.handle, existingGrid);
    // Already found — the caller has already handled this one; isNew is false.
    eq('findTargetTable: already-found ancestor reports isNew: false',
      result.isNew, false);
  });
})();

// FT6: findTargetTable — REPORTS a new grid via { handle, isNew: true } and
// does not mark it itself (sprint extract-dr-table: detection moved to
// lib/dr-table and now only reports; the caller — content.js's
// markAndToggleIfNewGrid — owns the dr-ext-grid write and the widget build).
// This test used to assert findTargetTable itself added the class (AC2 under
// the old contract); it is reworked here to assert the new split instead:
// findTargetTable must resolve the new grid AND must leave it unmarked.
(function findTargetTable_reportsNewGridWithoutMarking() {
  withFindTargetEnv([], function() {
    const makeRows5 = () => [
      makeGridRow([{text:'A',width:100},{text:'100'}], 'row', 20),
      makeGridRow([{text:'B',width:100},{text:'200'}], 'row', 20),
      makeGridRow([{text:'C',width:100},{text:'300'}], 'row', 20),
      makeGridRow([{text:'D',width:100},{text:'400'}], 'row', 20),
      makeGridRow([{text:'E',width:100},{text:'500'}], 'row', 20),
    ];

    const inner = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer = makeWalkEl({ display: 'flex', rows: makeRows5() });

    inner.parentElement = outer;
    inner.parentNode    = outer;
    outer.parentElement = document.body;
    outer.parentNode    = document.body;

    inner.closest = function(sel) { return null; };

    const result = findTargetTable(inner);

    eq('findTargetTable: resolves the new grid to the outermost element',
      result.handle, outer);
    eq('findTargetTable: reports isNew: true for a not-yet-marked grid',
      result.isNew, true);
    eq('findTargetTable: does NOT write the dr-ext-grid marker itself (reports only)',
      outer.classList.contains('dr-ext-grid'), false);
  });
})();

// ---------------------------------------------------------------------------
// Sprint right-click-registers: the nomination step runs from the clicked
// element's chain root.
// Spec: docs/sprint-plans/grid-detection-recovery-v2.md §3.5 and the
// right-click-registers block in §5; decision D1.
// ---------------------------------------------------------------------------
//
// The route these assertions pin, in the specification's words:
//   - A right-click resolves in four steps: the nearest native table, the
//     nearest already-registered ancestor, the nomination step run from the
//     chain root of the nest the clicked element sits in, and the geometry
//     probe.
//   - The third step returns the element the configured nesting depth
//     selects. That element can be a sibling of the clicked element, so a
//     click in a database query grid's row-number gutter resolves the
//     scrolling pane beside it.
//   - A nest that resolves nothing falls through to the geometry probe
//     unchanged.
//   - findTargetTable reports: it registers nothing and writes no marker.
//
// Every expected value below comes from that statement, never from the
// detection layer's source. The fixture is makeDatabaseQueryGrid (defined
// with the grid fixtures further down this file; a top-level function
// declaration, so it is in scope here).

// --- AC1: a click in the scrolling pane resolves the scrolling pane ---

(function rightClickRegisters_AC1_aClickInTheScrollingPaneResolvesIt() {
  const grid = makeDatabaseQueryGrid();
  const styleProbe = makeCountingStyleProbe();
  const result = findTargetTable(grid.scrollRowEls[2].children[1],
    { isSeen: () => false, styleProbe });

  eq('findTargetTable AC1: a click in the scrolling pane resolves the scrolling pane',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC1: the scrolling pane resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC1: the resolution reads no layout, so the geometry probe did not produce it',
    styleProbe.calls, 0);
  eq('findTargetTable AC1: the resolution writes no grid marker class',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
      .map((el) => el.classList.contains('dr-ext-grid')), [false, false, false]);
  eq('findTargetTable AC1: the resolution adds no registry entry',
    [grid.wrapperEl, grid.pinnedPaneEl, grid.scrollPaneEl]
      .map((el) => DR_STORE.hasTable(el)), [false, false, false]);
})();

// --- AC1: a click on the nest's own layers resolves the scrolling pane ---
//
// A right-click inside the grid lands on whatever sits under the pointer, and
// the gaps between the panes belong to the nest's plain layers. The geometry
// probe walks ancestors of the clicked element and stops at the first one that
// fails its row-count gate, so a click on a layer whose only child is another
// layer resolves nothing through it. The nomination step runs from the chain
// root instead, which covers every layer of the nest.

(function rightClickRegisters_AC1_aClickOnTheNestsOwnLayersResolvesTheScrollingPane() {
  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  const paneRowResult = findTargetTable(plain.paneParentEl, { isSeen: () => false });
  eq('findTargetTable AC1: a click on the plain layer between the panes resolves the scrolling pane',
    paneRowResult !== null && paneRowResult.handle === plain.scrollPaneEl, true);

  const grid = makeDatabaseQueryGrid();
  const wrapperResult = findTargetTable(grid.wrapperEl, { isSeen: () => false });
  eq('findTargetTable AC1: a click on the wrapper itself resolves the scrolling pane',
    wrapperResult !== null && wrapperResult.handle === grid.scrollPaneEl, true);
})();

// --- AC2: a click in the row-number gutter resolves the scrolling pane ---

(function rightClickRegisters_AC2_aClickInTheRowNumberGutterResolvesTheScrollingPane() {
  const grid = makeDatabaseQueryGrid();
  const gutterCell = grid.pinnedRowEls[0].children[0];

  eq('findTargetTable AC2: the clicked gutter cell holds a row number',
    /^\d+$/.test(gutterCell.textContent), true);

  const styleProbe = makeCountingStyleProbe();
  const result = findTargetTable(gutterCell, { isSeen: () => false, styleProbe });

  eq('findTargetTable AC2: a click in the row-number gutter resolves the scrolling pane beside it',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC2: the gutter resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC2: the gutter resolution reports neither the pinned pane nor the wrapper',
    result !== null &&
      (result.handle === grid.pinnedPaneEl || result.handle === grid.wrapperEl), false);
  eq('findTargetTable AC2: the gutter resolution reads no layout, so the geometry probe did not produce it',
    styleProbe.calls, 0);

  // The layout counter is a live probe: the geometry probe does read layout
  // when a case reaches it, so the zero above stands for a route that stopped
  // earlier rather than for a port nothing ever calls.
  const roleLessProbe = makeCountingStyleProbe();
  const roleLess = makeDgNode('DIV', 'plain-host', null,
    [0, 1, 2, 3, 4, 5].map((i) => makeDgRow(i, ['north', '4,281,905', '17.40'])));
  findTargetTable(roleLess.children[0].children[0],
    { isSeen: () => false, styleProbe: roleLessProbe });
  eq('findTargetTable AC2: a role-less tree does reach the geometry probe and read layout',
    roleLessProbe.calls > 0, true);
})();

// --- AC3: a role-bearing element that fails the data test resolves nothing ---

(function rightClickRegisters_AC3_aRoleBearingElementThatFailsTheDataTestResolvesNothing() {
  const oneCell = makeRoleBearingNest([makeDgRow(0, ['17'])]);
  const noNumber = makeRoleBearingNest([
    makeDgRow(0, ['north', 'alpha']),
    makeDgRow(1, ['south', 'bravo']),
  ]);

  eq('findTargetTable AC3: one row of one cell fails the data test',
    isDataTable(oneCell), false);
  eq('findTargetTable AC3: two rows with no number fail the data test',
    isDataTable(noNumber), false);
  eq('findTargetTable AC3: the one-row-one-cell element is a chain root (sanity)',
    chainRootOf(oneCell.children[0].children[0]) === oneCell, true);
  eq('findTargetTable AC3: the two-rows-no-number element is a chain root (sanity)',
    chainRootOf(noNumber.children[0].children[0]) === noNumber, true);

  eq('findTargetTable AC3: a click inside the one-row-one-cell element resolves nothing',
    findTargetTable(oneCell.children[0].children[0], { isSeen: () => false }), null);
  eq('findTargetTable AC3: a click inside the two-rows-no-number element resolves nothing',
    findTargetTable(noNumber.children[0].children[0], { isSeen: () => false }), null);
})();

// --- AC3: an empty nomination falls through to the geometry probe ---
//
// The two cases above resolve nothing because the geometry probe rejects them
// as well, so they say nothing about which step produced the null. This case
// separates the two steps: six rows of one numeric cell each fail the data
// test at the two-cell gate, which leaves the nomination empty, and clear the
// geometry probe's ladder (six repeated children sharing a class, a flex
// display, a numeric cell, and a grid role short-circuiting the column-width
// sample). The route therefore has to hand the element on rather than end the
// resolution, and the layout counter records the probe producing the answer.

(function rightClickRegisters_AC3_anEmptyNominationFallsThroughToTheGeometryProbe() {
  const nest = makeRoleBearingNest(
    [0, 1, 2, 3, 4, 5].map((i) => makeDgRow(i, ['4,281,905'])));
  const styleProbe = makeCountingStyleProbe();

  eq('findTargetTable AC3: a single-column nest fails the data test, so the nomination is empty',
    isDataTable(nest), false);
  eq('findTargetTable AC3: the clicked cell still sits in that nest',
    chainRootOf(nest.children[0].children[0]) === nest, true);

  const result = findTargetTable(nest.children[0].children[0],
    { isSeen: () => false, styleProbe });

  eq('findTargetTable AC3: an empty nomination falls through and the probe resolves the nest',
    result !== null && result.handle === nest, true);
  eq('findTargetTable AC3: the fall-through resolution reports isNew',
    result !== null && result.isNew, true);
  eq('findTargetTable AC3: the fall-through resolution reads layout, so the geometry probe produced it',
    styleProbe.calls > 0, true);
})();

// --- AC4: a registered table resolves at the registry route ---
//
// The proof goes through the ports the resolver takes, not through the
// source text: opts.numericProbe counts the data-test reads the nomination
// step would spend, so a zero count shows the step spent none, and
// opts.isSeen records the elements the resolver asked the registry about.
// The last pair of assertions runs the same click with nothing registered,
// so the zero count above stands for "the step spent no read" rather than
// "the probe is inert".

(function rightClickRegisters_AC4_aRegisteredTableResolvesAtTheRegistryRoute() {
  const grid = makeDatabaseQueryGrid();
  const cell = grid.scrollRowEls[3].children[1];

  const asked = [];
  const registryProbe = makeCountingNumericProbe();
  const result = findTargetTable(cell, {
    isSeen: (el) => { asked.push(el); return el === grid.scrollPaneEl; },
    numericProbe: registryProbe,
  });

  eq('findTargetTable AC4: a click inside a registered scrolling pane resolves it',
    result !== null && result.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: the registry route reports isNew false',
    result !== null && result.isNew, false);
  eq('findTargetTable AC4: the registry route spends no data-test read',
    registryProbe.calls, 0);
  eq('findTargetTable AC4: the registry walk stops at the scrolling pane',
    asked.length > 0 && asked[asked.length - 1] === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: no step asks the registry about the wrapper',
    asked.includes(grid.wrapperEl), false);

  const freshProbe = makeCountingNumericProbe();
  const freshResult = findTargetTable(cell, { isSeen: () => false, numericProbe: freshProbe });
  eq('findTargetTable AC4: the same click with nothing registered reaches the nomination step',
    freshResult !== null && freshResult.handle === grid.scrollPaneEl, true);
  eq('findTargetTable AC4: and that resolution does spend data-test reads',
    freshProbe.calls > 0, true);
})();

// --- Edge: a crowded depth falls back outward on a right-click ---

(function rightClickRegisters_edge_aCrowdedDepthFallsBackOutwardOnARightClick() {
  const grid = makeDatabaseQueryGrid({ pinnedColumns: 2 });

  eq('findTargetTable edge: a two-column pinned pane puts two elements at the shipped depth',
    isDataTable(grid.pinnedPaneEl) && isDataTable(grid.scrollPaneEl), true);

  const result = findTargetTable(grid.scrollRowEls[0].children[0], { isSeen: () => false });
  eq('findTargetTable edge: the fall-back outward resolves the wrapper on a right-click',
    result !== null && result.handle === grid.wrapperEl, true);
})();

// --- Edge: a role-less tree still resolves through the geometry probe ---

(function rightClickRegisters_edge_aRoleLessTreeStillResolvesThroughTheGeometryProbe() {
  withFindTargetEnv([], function () {
    const makeRows5 = () => [
      makeGridRow([{ text: 'A', width: 100 }, { text: '100' }], 'row', 20),
      makeGridRow([{ text: 'B', width: 100 }, { text: '200' }], 'row', 20),
      makeGridRow([{ text: 'C', width: 100 }, { text: '300' }], 'row', 20),
      makeGridRow([{ text: 'D', width: 100 }, { text: '400' }], 'row', 20),
      makeGridRow([{ text: 'E', width: 100 }, { text: '500' }], 'row', 20),
    ];
    const inner = makeWalkEl({ display: 'flex', rows: makeRows5() });
    const outer = makeWalkEl({ display: 'flex', rows: makeRows5() });
    inner.parentElement = outer;
    inner.parentNode = outer;
    outer.parentElement = document.body;
    outer.parentNode = document.body;
    inner.closest = function () { return null; };

    eq('findTargetTable edge: a role-less tree has no chain root',
      chainRootOf(inner), null);

    const result = findTargetTable(inner);
    eq('findTargetTable edge: a role-less tree still resolves to the outermost geometry-probe match',
      result !== null && result.handle === outer, true);
    eq('findTargetTable edge: that geometry-probe resolution still reports isNew',
      result !== null && result.isNew, true);
  });
})();

// --- chainRootOf: the nest an arbitrary clicked element sits in ---

(function rightClickRegisters_chainRootOfResolvesTheNestOfAnArbitraryElement() {
  const grid = makeDatabaseQueryGrid();
  const plain = makeDatabaseQueryGrid({ plainWrapper: true });
  const roleLess = makeDgNode('DIV', 'plain-host', null, [makeDgRow(0, ['north', '4,281,905'])]);

  eq('chainRootOf: a null element returns null', chainRootOf(null), null);
  eq('chainRootOf: a role-less tree returns null',
    chainRootOf(roleLess.children[0].children[0]), null);
  eq('chainRootOf: a cell in the scrolling pane returns the wrapper',
    chainRootOf(grid.scrollRowEls[0].children[0]) === grid.wrapperEl, true);
  eq('chainRootOf: a cell in the pinned pane returns the wrapper',
    chainRootOf(grid.pinnedRowEls[0].children[0]) === grid.wrapperEl, true);
  eq('chainRootOf: a plain layer between the wrapper and the panes still returns the wrapper',
    chainRootOf(plain.scrollRowEls[0].children[0]) === plain.wrapperEl, true);
})();

// --- AC6: the living docs state the route ---

(function rightClickRegisters_AC6_theLivingDocsStateTheRoute() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const extensionReadme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

  const loadTimeScanRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*load-time scan\s*\|/i.test(line)) || '';
  eq('right-click AC6: docs/vocabulary.md keeps a load-time scan row',
    loadTimeScanRow !== '', true);
  eq('right-click AC6: that row states a marked grid the scan missed enters on a right-click',
    /right-click/i.test(loadTimeScanRow) && /missed/i.test(loadTimeScanRow), true);
  eq('right-click AC6: that row names the nomination step and the chain root',
    /nomination step/i.test(loadTimeScanRow) && /chain root/i.test(loadTimeScanRow), true);
  eq('right-click AC6: that row keeps the geometry probe as the unmarked grid route',
    /unmarked grid/i.test(loadTimeScanRow) && /geometry probe/i.test(loadTimeScanRow), true);

  const detectionParagraph = designMd.split('\n')
    .find((line) => /^\*\*Detection\.\*\*/.test(line)) || '';
  eq('right-click AC6: docs/design.md keeps a Detection paragraph',
    detectionParagraph !== '', true);
  eq('right-click AC6: the Detection paragraph states the right-click route',
    /right-click/i.test(detectionParagraph) &&
      /nomination step/i.test(detectionParagraph) &&
      /chain root/i.test(detectionParagraph), true);
  eq('right-click AC6: the Detection paragraph states the gutter outcome',
    /gutter[\s\S]{0,120}scrolling pane/i.test(detectionParagraph), true);

  const readmeDetectionPoint = extensionReadme.split('\n')
    .find((line) => /^1\. \*\*Detection runs on demand/.test(line)) || '';
  eq('right-click AC6: chrome-extension/README.md keeps its first detection point',
    readmeDetectionPoint !== '', true);
  eq('right-click AC6: that point states the right-click route',
    /right-click/i.test(readmeDetectionPoint) &&
      /nomination step/i.test(readmeDetectionPoint) &&
      /chain root/i.test(readmeDetectionPoint), true);
})();

// ---------------------------------------------------------------------------
// content.js markAndToggleIfNewGrid — the badge/marker call-site wrapper that
// replaced findTargetTable's old internal mutation. It owns exactly what
// findTargetTable used to do inline: write the dr-ext-grid marker and build
// the toggle widget, but only for a first-time (isNew) discovery.
// ---------------------------------------------------------------------------
(function markAndToggleIfNewGrid_newGridGetsMarkedAndWidget() {
  withFindTargetEnv([], function() {
    const savedToggleStyleInjected = toggleStyleInjected;
    const table = makePass1DataTable();
    table.parentElement = { tagName: 'DIV', getAttribute: () => null, style: {}, parentElement: null, parentNode: null };

    const handleReturned = markAndToggleIfNewGrid({ handle: table, isNew: true });

    eq('markAndToggleIfNewGrid: returns found.handle',
      handleReturned, table);
    eq('markAndToggleIfNewGrid: adds dr-ext-grid to a newly discovered grid',
      table.classList.contains('dr-ext-grid'), true);
    eq('markAndToggleIfNewGrid: builds the toggle widget for a newly discovered grid',
      tableToggles.has(table), true);

    cleanupPass1Tables([table]);
    toggleStyleInjected = savedToggleStyleInjected;
  });
})();

(function markAndToggleIfNewGrid_alreadySeenHandleSkipsMarkAndWidget() {
  withFindTargetEnv([], function() {
    const table = makePass1DataTable();

    markAndToggleIfNewGrid({ handle: table, isNew: false });

    eq('markAndToggleIfNewGrid: does not mark an already-seen handle',
      table.classList.contains('dr-ext-grid'), false);
    eq('markAndToggleIfNewGrid: does not build a widget for an already-seen handle',
      tableToggles.has(table), false);
  });
})();

// ---------------------------------------------------------------------------
// Sprint grid-adapter: TableAdapter abstraction
// AC2 — NativeTableAdapter round-trip test
// AC3 — GridAdapter stub no-throw test
// AC4 — source scan: no role="gridcell" or data-row-index literals in content.js
// ---------------------------------------------------------------------------

// TA1: NativeTableAdapter round-trip
// Build a native table element, wrap it with makeAdapter(), walk the adapter
// API (getRows → getCells → getText) and assert values match what was put in.
// Also assert isVirtualized() === false and getElement() returns the element.
(function nativeTableAdapter_roundTrip() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: '1,234' }, { tag: 'td', text: '5,678' }],
    [{ tag: 'td', text: '9,012' }, { tag: 'td', text: '3,456' }],
  ]);

  const adapter = makeAdapter(tableEl);

  eq('NativeTableAdapter: makeAdapter returns NativeTableAdapter for TABLE element',
    adapter instanceof NativeTableAdapter, true);

  eq('NativeTableAdapter: getElement() returns the original element',
    adapter.getElement(), tableEl);

  eq('NativeTableAdapter: isVirtualized() === false',
    adapter.isVirtualized(), false);

  const rows = adapter.getRows();
  eq('NativeTableAdapter: getRows() returns 2 rows',
    rows.length, 2);

  const cells0 = rows[0].getCells();
  eq('NativeTableAdapter: row 0 has 2 cells',
    cells0.length, 2);

  eq('NativeTableAdapter: row 0 cell 0 getText() returns "1,234"',
    cells0[0].getText(), '1,234');

  eq('NativeTableAdapter: row 0 cell 1 getText() returns "5,678"',
    cells0[1].getText(), '5,678');

  const cells1 = rows[1].getCells();
  eq('NativeTableAdapter: row 1 cell 0 getText() returns "9,012"',
    cells1[0].getText(), '9,012');

  eq('NativeTableAdapter: row 1 cell 1 getText() returns "3,456"',
    cells1[1].getText(), '3,456');

  // Each cell object must expose .el pointing back to the DOM cell element
  eq('NativeTableAdapter: cell .el is the underlying DOM cell',
    cells0[0].el, tableEl.rows[0].cells[0]);
})();

// TA1b: NativeTableAdapter cells expose NO setText — deliberate absence guard.
// The native path writes cells directly in roundTable so it can preserve markup
// in mixed cells and stash both originalHtml and originalValue. A setText here
// would be reached by any future code that drives both adapters through one
// loop; a textContent-based one would flatten mixed cells and skip
// originalValue, silently feeding the sidebar preview its own rounded output.
// Absent, that future code fails at the call site instead. This test keeps the
// absence deliberate rather than incidental — if you are adding setText back,
// it must preserve markup and stash BOTH dataset keys, and this guard must be
// rewritten to assert that, not simply deleted.
(function nativeTableAdapter_hasNoSetText() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: '1,234' }],
  ]);
  const cell = makeAdapter(tableEl).getRows()[0].getCells()[0];

  eq('TA1b: native adapter cell exposes no setText',
    cell.setText, undefined);
  // applyPatches is the grid cell's write, the name such a loop reaches now.
  eq('TA1b: native adapter cell exposes no applyPatches',
    cell.applyPatches, undefined);

  // Source scan: nothing in the class may assign textContent/innerHTML on a
  // cell. Catches a setText re-added under a different name.
  if (detectCode === null) {
    eq('TA1b: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const start = detectCode.indexOf('class NativeTableAdapter');
  const rest = detectCode.slice(start);
  const classBody = rest.slice(0, rest.indexOf('\n}\n'));

  eq('TA1b (setup): NativeTableAdapter class body located',
    start >= 0 && classBody.length > 0, true);

  eq('TA1b: NativeTableAdapter class body has no textContent= assignment',
    /textContent\s*=[^=]/.test(classBody), false);

  eq('TA1b: NativeTableAdapter class body has no innerHTML= assignment',
    /innerHTML\s*=[^=]/.test(classBody), false);
})();

// TA2: NativeTableAdapter — cell count matches table structure
// A 3-row × 3-column table round-trips with correct row and cell counts.
(function nativeTableAdapter_3x3() {
  const tableEl = makeNativeTableEl([
    [{ tag: 'td', text: 'a' }, { tag: 'td', text: 'b' }, { tag: 'td', text: 'c' }],
    [{ tag: 'td', text: '1' }, { tag: 'td', text: '2' }, { tag: 'td', text: '3' }],
    [{ tag: 'td', text: 'x' }, { tag: 'td', text: 'y' }, { tag: 'td', text: 'z' }],
  ]);

  const adapter = makeAdapter(tableEl);
  const rows = adapter.getRows();

  eq('NativeTableAdapter: 3×3 table — getRows() returns 3 rows',
    rows.length, 3);

  eq('NativeTableAdapter: 3×3 table — row 1 has 3 cells',
    rows[1].getCells().length, 3);

  eq('NativeTableAdapter: 3×3 table — row 2 cell 2 text is "z"',
    rows[2].getCells()[2].getText(), 'z');
})();

// TA3: GridAdapter stub — makeAdapter on a non-TABLE element returns GridAdapter
// isVirtualized() === true, getRows() === [], getElement() returns the element.
(function gridAdapter_stub_properties() {
  const divEl = {
    tagName: 'DIV',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      contains(c) { return this._c.includes(c); },
    },
  };

  const adapter = makeAdapter(divEl);

  eq('GridAdapter: makeAdapter on DIV returns GridAdapter',
    adapter instanceof GridAdapter, true);

  eq('GridAdapter: getElement() returns the div element',
    adapter.getElement(), divEl);

  eq('GridAdapter: isVirtualized() === true',
    adapter.isVirtualized(), true);

  eq('GridAdapter: getRows() returns empty array (stub)',
    adapter.getRows().length, 0);
})();

// TA4: roundTable on a grid element (non-TABLE) — must not throw, must be a no-op
// The stub path: GridAdapter.getRows() → [] causes roundTable to return early.
// No .dr-ext-rounded cells should appear; no exception thrown.
(function gridAdapter_stub_noThrow() {
  const divEl = {
    tagName: 'DIV',
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      contains(c) { return this._c.includes(c); },
    },
  };

  let threw = false;
  try {
    roundTable(divEl, Object.assign({}, DR_DEFAULTS));
  } catch (e) {
    threw = true;
  }

  eq('GridAdapter stub: roundTable on grid element does not throw',
    threw, false);

  // The element should have no .dr-ext-rounded cells since it was a no-op
  eq('GridAdapter stub: roundTable on grid element is a no-op (querySelector returns null)',
    divEl.querySelector('.dr-ext-rounded'), null);
})();

// TA5: source-scan — no role="gridcell" or data-row-index literals in content.js
// Per AC4 of the grid-adapter sprint, these stale Sprint 1 selectors must have
// been replaced by role="cell" / data-row / data-index.
(function sourceNoLegacySelectors() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('grid-adapter AC4: source file content.js present in manifest', false, true);
    return;
  }

  eq('grid-adapter AC4: no role="gridcell" literal remains in content.js',
    contentSrc.includes('role="gridcell"'), false);

  eq('grid-adapter AC4: no data-row-index literal remains in content.js',
    contentSrc.includes('data-row-index'), false);
})();

// =============================================================================
// Sprint grid-rounding tests
// Spec: docs/sprint-plans/grid-support-v2.md §2 D3 + §4 "grid-rounding"
// =============================================================================

// ---------------------------------------------------------------------------
// DOM-stub helpers for grid cells that contain real Text nodes (nodeType 3).
//
// findCellTextNode does a depth-first walk that checks node.nodeType,
// node.nodeValue, and iterates node.childNodes. We build minimal objects that
// satisfy exactly those interfaces — no jsdom required.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// A synthetic database-query-shaped vendor grid.
//
// The shape rebuilds docs/test-pages/tables.html §13 with invented values, per
// the repository's regression-fixture convention: a role="table" wrapper
// holding a pinned pane of leading columns beside a scrolling pane of data,
// all under dg-- classes, with rows paired across the panes by data-row. The
// nomination step, the two adapters, and the pillbox builder all read these
// nodes, so each one answers the selector queries, the role read, the class
// list, the parent link, and the text reads those three make.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Grid patch writes (#120). A grid cell's change lands as a patch to the one
// text piece that holds the changed characters, and the cell's originals
// record holds each touched piece's text by piece index.
//
// Invented values at one magnitude, so each rounded value is derived by hand:
// under the defaults every number sits in the top band, and an offset of -0.5
// on magnitude 6 rounds to a step of 500,000.
//   8,584,629 → 8,500,000    7,318,204 → 7,500,000
//   2,140,663 → 2,000,000    1,234,567 → 1,000,000
// ---------------------------------------------------------------------------

const PATCH_GRID_OPTS = Object.assign({}, DR_DEFAULTS, { simplifyFirstRow: true, simplifyFirstColumn: true });

const pieceTextsOf = (cell) => gridCellTextPieces(cell).map((node) => node.nodeValue);

(function gridPatch_roundWritesEachChangeIntoItsPiece() {
  const { grid } = makePatchGrid();
  const [a, b, c, d] = grid.cellEls;
  const piecesBefore = grid.cellEls.map(gridCellTextPieces);
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch: a number between whitespace pieces changes in its own piece',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);
    eq('grid patch: whitespace inside the patched piece stays',
      pieceTextsOf(b), [' 7,500,000 ']);
    eq('grid patch: a number after a piece of its own patches at that piece\'s position',
      pieceTextsOf(c), ['$', '2,000,000']);
    eq('grid patch: a plain one-piece cell rounds as before',
      pieceTextsOf(d), ['1,000,000']);
    eq('grid patch: every text piece is the same node object after the round',
      grid.cellEls.every((cell, k) => {
        const after = gridCellTextPieces(cell);
        return after.length === piecesBefore[k].length &&
          after.every((node, n) => node === piecesBefore[k][n]);
      }), true);
    eq('grid patch: every rounded cell carries the marker class',
      grid.cellEls.every((cell) => cell.classList.contains('dr-ext-rounded')), true);
    eq('grid patch: the landed writes set the form to simplified',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'simplified');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A date piece with whitespace around it: the date's own text is replaced and
// the piece's whitespace stays once. Year granularity: 2024-03-15 → 2024.
(function gridPatch_aPaddedDatePieceKeepsItsWhitespaceOnce() {
  const grid = makeE2EGridWrapper([[' 2024-03-15 ']]);
  try {
    roundTable(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { simplifyDates: true, dateGranularity: 'year' }));
    eq('grid patch: a padded date piece keeps its whitespace once',
      pieceTextsOf(grid.cellEls[0]), [' 2024 ']);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_recordHoldsTheReadTextAndEachTouchedPiece() {
  const { grid } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch: the record holds the flat text and each piece\'s original and written text',
      DR_STORE.getTableOriginal(grid.wrapperEl, a),
      { value: ' 8,584,629 ',
        pieces: [{ text: ' ', written: ' ' }, { text: '8,584,629', written: '8,500,000' }, { text: ' ', written: ' ' }],
        supRanges: null, linkFilteredIdx: null });
    eq('grid patch: a piece\'s whitespace is part of its stored text',
      DR_STORE.getTableOriginal(grid.wrapperEl, b),
      { value: ' 7,318,204 ', pieces: [{ text: ' 7,318,204 ', written: ' 7,500,000 ' }], supRanges: null, linkFilteredIdx: null });
    eq('grid patch: the plain-text read of a record is its value',
      DR_STORE.getTableOriginalText(grid.wrapperEl, a), ' 8,584,629 ');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_resetPutsEveryPieceBack() {
  const { grid } = makePatchGrid();
  const [a, b, c, d] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const unrestorable = resetTable(grid.wrapperEl);
    eq('grid patch reset: every cell restores', unrestorable, 0);
    eq('grid patch reset: each piece holds its original text again',
      [pieceTextsOf(a), pieceTextsOf(b), pieceTextsOf(c), pieceTextsOf(d)],
      [[' ', '8,584,629', ' '], [' 7,318,204 '], ['$', '2,140,663'], ['1,234,567']]);
    eq('grid patch reset: the records are cleared',
      grid.cellEls.map((cell) => DR_STORE.hasTableOriginal(grid.wrapperEl, cell)),
      [false, false, false, false]);
    eq('grid patch reset: the marker classes are removed',
      grid.cellEls.some((cell) => cell.classList.contains('dr-ext-rounded')), false);
    eq('grid patch reset: the form is original',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'original');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// Issue #423: a cell the page redrew with fewer pieces is a rewritten cell.
// The restore keeps the page's text in it and drops its record and marker,
// so nothing counts unrestorable and the table never locks over it.
(function gridPatch_aCellWithFewerPiecesKeepsThePagesText() {
  const { grid } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    // The page redraws cell a with one piece; the record's pieces no longer
    // line up with the cell's.
    setGridCellPieces(a, [makeTextNode('9,100,000')]);
    const unrestorable = resetTable(grid.wrapperEl);
    eq('grid patch reset: a cell redrawn with fewer pieces counts as restored', unrestorable, 0);
    eq('grid patch reset: the redrawn cell keeps the page\'s text',
      pieceTextsOf(a), ['9,100,000']);
    eq('grid patch reset: the redrawn cell drops its marker and record',
      { marked: a.classList.contains('dr-ext-rounded'), record: DR_STORE.hasTableOriginal(grid.wrapperEl, a) },
      { marked: false, record: false });
    eq('grid patch reset: the other cells restore',
      pieceTextsOf(b), [' 7,318,204 ']);
    eq('grid patch reset: with every cell restored, the form is original',
      DR_STORE.getTableAppliedFlag(grid.wrapperEl), 'original');
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_reapplyWritesOnlyWhereTheOriginalStands() {
  const { grid, aNumber } = makePatchGrid();
  const [a, b] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid patch re-apply (setup): the round wrote the number piece once', aNumber.writes, 1);

    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece already patched is not written again', aNumber.writes, 1);

    // The page redraws the piece with its original text.
    aNumber.nodeValue = '8,584,629';
    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece redrawn to its original is patched again',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);

    // The page changes the piece's text in place. The piece shows neither
    // its original nor its written text, so the cell is a rewritten cell and
    // simplifies the page's value fresh (#421).
    b.childNodes[0].nodeValue = ' 7,318,204.5 ';
    reapplyRounding(grid.wrapperEl);
    eq('grid patch re-apply: a piece whose text the page changed simplifies the page\'s value',
      { pieces: pieceTextsOf(b), original: DR_STORE.getTableOriginalText(grid.wrapperEl, b) },
      { pieces: [' 7,500,000 '], original: ' 7,318,204.5 ' });
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A later simplification with an invalid range expression stores its options
// and returns an error without resetting the grid, so the re-apply observer
// from the first simplification still fires. The re-apply reads the stored
// invalid expression and writes nothing, as the first simplification would.
(function gridReapply_underAnInvalidRangeExpression_writesNothing() {
  const { grid, aNumber } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const result = roundTable(grid.wrapperEl, Object.assign({}, PATCH_GRID_OPTS, { rangeExpr: 'A:B:C' }));
    eq('grid re-apply invalid range (setup): the second simplification returns the range error',
      result.rangeStatus, 'error');
    aNumber.nodeValue = '8,584,629';
    const writesBefore = aNumber.writes;
    reapplyRounding(grid.wrapperEl);
    eq('grid re-apply invalid range: a piece redrawn to its original is not patched',
      { pieces: pieceTextsOf(a), writes: aNumber.writes },
      { pieces: [' ', '8,584,629', ' '], writes: writesBefore });
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// A grid whose first simplification found no dataset holds no magnitude
// freeze (null). The re-apply then computes the max magnitude from the
// visible cells, and only a first simplification stores a freeze, so the
// freeze stays unset for the next re-apply.
(function gridReapply_withNoMagnitudeFreeze_computesTheBasisAndLeavesTheFreezeUnset() {
  const { grid, aNumber } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    eq('grid re-apply no freeze (setup): the first simplification stores a freeze',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), 6);
    DR_STORE.setTableMaxMagnitude(grid.wrapperEl, null);
    aNumber.nodeValue = '8,584,629';
    reapplyRounding(grid.wrapperEl);
    eq('grid re-apply no freeze: a piece redrawn to its original rounds against the visible cells',
      pieceTextsOf(a), [' ', '8,500,000', ' ']);
    eq('grid re-apply no freeze: the re-apply stores no freeze',
      DR_STORE.getTableMaxMagnitude(grid.wrapperEl), null);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

(function gridPatch_captureCarriesTheRecordValue() {
  const { grid } = makePatchGrid();
  const [a] = grid.cellEls;
  try {
    roundTable(grid.wrapperEl, PATCH_GRID_OPTS);
    const state = collectCaptureState({ store: DR_STORE, adapterFor: (t) => makeAdapter(t) });
    const tableRec = state.tables[DR_STORE.getRegisteredTables().indexOf(grid.wrapperEl)];
    const cellRec = tableRec.cells.find((cell) => cell.row === 0 && cell.col === 0);
    eq('grid patch capture: a patched grid cell carries its original text',
      cellRec.original, ' 8,584,629 ');
    const html = DR_CAPTURE.buildCaptureDocument({
      state: {
        captureFormat: 6,
        meta: { url: 'https://www.example.com/grid', title: 'G', version: '2.1.70',
          platform: 'test', at: '2026-09-22T16:00:00.000Z' },
        mark: 'looks-right', remarks: '', settings: { enabled: true }, detectionSettings: null,
        activeTableIndex: 0, tables: [tableRec], lensPreview: null, fixtureSeed: null,
        sidebarView: null, errorState: { hasError: false, count: 0, rows: [] },
        log: { content: { entries: [], dropped: 0, limit: 50 }, sidebar: { entries: [], dropped: 0, limit: 50 } },
      },
      lockedStatusText: '',
    });
    const originalsTable = (html.split('with the originals')[1] || '').split('</table>')[0];
    eq('grid patch capture: the originals rendering shows the cell\'s original',
      /<td[^>]*>\s*8,584,629\s*<\/td>/.test(originalsTable), true);
  } finally {
    DR_STORE.unregisterTable(grid.wrapperEl);
  }
})();

// The grid cell's write: it returns how many patches landed, and records the
// cell on a landed patch. The no-piece case sits with the form honesty tests.
(function gridPatch_applyPatchesReturnsAndRecords() {
  const makePort = () => {
    const m = new Map();
    return { has: (k) => m.has(k), get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
  };
  const port = makePort();
  const adapter = new GridAdapter({}, { originalsPort: port });
  if (typeof adapter._makeCellObj(makeElementNode('', [])).applyPatches !== 'function') {
    eq('grid patch write: the grid cell object exposes applyPatches', false, true);
    return;
  }

  const el = makeGridCellWithTextNode('A 100 B 200');
  const cellObj = adapter._makeCellObj(el);
  eq('grid patch write: the write returns its landed count',
    cellObj.applyPatches([
      { index: 2, numStr: '100', newNum: '90' },
      { index: 8, numStr: '999', newNum: '1,000' },
    ]), 1);
  eq('grid patch write: the landed patch changes its piece',
    el.childNodes[0].nodeValue, 'A 90 B 200');
  eq('grid patch write: the first landed write stores the record',
    port.get(el),
    { value: 'A 100 B 200', pieces: [{ text: 'A 100 B 200', written: 'A 90 B 200' }], supRanges: null, linkFilteredIdx: null });

  // A later write counts its patches in the join of the stored originals,
  // keeps each piece's original, and records each piece's new written text.
  // A piece the later write leaves at its original goes back to it.
  const twoEl = makeElementNode('', [makeTextNode('100'), makeTextNode(' 200')]);
  const two = adapter._makeCellObj(twoEl);
  two.applyPatches([{ index: 0, numStr: '100', newNum: '90' }]);
  two.applyPatches([{ index: 4, numStr: '200', newNum: '250' }]);
  eq('grid patch write: a later write records each piece\'s original and its new written text',
    port.get(twoEl).pieces, [{ text: '100', written: '100' }, { text: ' 200', written: ' 250' }]);
  eq('grid patch write: the later write gives each piece its target text',
    twoEl.childNodes.map((node) => node.nodeValue), ['100', ' 250']);
})();

// The writer groups patches by piece, writes each touched piece once, and
// returns the landed count with each touched piece's text before and after.
(function applyExtractedPatchesReturnsTouchedPieces() {
  const cell = makeElementNode('', [makeTextNode('A 100 B 200'), makeTextNode(' C 300')]);
  const [first, second] = cell.childNodes;
  // The pieces walk runs with no tree walker in this suite's document.
  let result;
  try {
    result = applyExtractedPatches(cell, [
      { index: 2, numStr: '100', newNum: '90' },
      { index: 8, numStr: '200', newNum: '250' },
      { index: 14, numStr: '300', newNum: '999' },
      { index: 14, numStr: '777', newNum: '1' },
    ]);
  } catch (e) {
    eq('patch writer: the writer runs without a tree walker', String(e), null);
    return;
  }
  eq('patch writer: the result carries the landed count', result.landed, 3);
  eq('patch writer: the result lists each touched piece once, in piece order',
    result.pieces,
    [{ i: 0, before: 'A 100 B 200', after: 'A 90 B 250' }, { i: 1, before: ' C 300', after: ' C 999' }]);
  eq('patch writer: the pieces hold the patched text',
    [first.nodeValue, second.nodeValue], ['A 90 B 250', ' C 999']);
  eq('patch writer: an empty patch list lands nothing',
    applyExtractedPatches(cell, []), { landed: 0, pieces: [] });
})();

