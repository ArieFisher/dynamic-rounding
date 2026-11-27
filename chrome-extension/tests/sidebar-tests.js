// The sidebar page (sidebar.js, sidebar.html).

// ---------------------------------------------------------------------------
// Source-level assertions: the absence of a sidebar-open name across the
// extension, which no running test can reach. The live tests further down this
// piece load sidebar.js whole and check results.
// ---------------------------------------------------------------------------

(function sidebarStateRemoval_sourceLevel() {
  // The scan covers the whole extension, so it reads the combined
  // content-script source beside sidebar.js, the model, and the service worker.
  const contentSrc = allContentSrc;
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const modelSrc = sourceByName('app/model.js') || '';

  // Whether the sidebar is open: no context holds this value. These four
  // scans pin the absence of the field, the two handler calls that would
  // write it, and the one guard that would read it, so a reintroduction
  // anywhere in the extension fails here rather than at some later symptom.
  //
  // Scanning for the NAMES rather than for a shape is deliberate: a
  // page-held copy of a fact only another context can correct goes stale,
  // and any spelling of that copy brings the defect back. The scan therefore
  // covers the whole extension, service worker and sidebar included, not
  // just the content script.
  const SIDEBAR_STATE_NAMES = /sidebarOpen|isSidebarOpen|setSidebarOpen|state:sidebarOpenChanged/;
  const namesSidebarState = (src) => SIDEBAR_STATE_NAMES.test(src);
  eq('sidebar-state removal: app/model.js declares no sidebar-open field',
    namesSidebarState(modelSrc), false);
  eq('sidebar-state removal: the content-script stack names no sidebar-open value',
    namesSidebarState(contentSrc), false);
  eq('sidebar-state removal: sidebar.js names no sidebar-open value',
    namesSidebarState(sidebarSrc), false);
  eq('sidebar-state removal: background.js names no sidebar-open value',
    namesSidebarState(fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8')), false);
  eq('sidebar-state removal: a reintroduced sidebarOpened field still fails the scan',
    namesSidebarState('let sidebarOpened = false;'), true);
})();

// ---------------------------------------------------------------------------
// --- sidebar.js: formatSample ---
//
// Strategy: extract the real implementation from sidebar.js source via regex
// and eval it in this scope (where numberFormat and groupedNumberText are already available from the
// evaled reader.js / content.js block above).
// This exercises the REAL implementation, not a reimplementation.
// ---------------------------------------------------------------------------
(function sidebarHelperTests() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // Extract the two constants and the function we need from sidebar.js.
  // numberFormat and groupedNumberText are already on globalThis from the content-script eval above.
  const constBlock = sidebarSrc.match(
    /const PREVIEW_DECIMAL_THRESHOLD\s*=.*?;\s*const PREVIEW_MAX_DECIMALS\s*=.*?;/
  );
  const formatSampleFn = sidebarSrc.match(
    /function formatSample\([\s\S]*?\n\}/
  );

  if (!constBlock || !formatSampleFn) {
    // Signal extraction failure clearly — treat as a failed test so CI notices.
    eq('sidebar-extract: able to extract formatSample from sidebar.js',
       false, true);
    return;
  }

  // Eval into a local object using an IIFE so the const declarations bind in
  // function scope (not global) and the compiled function body can hold them.
  // numberFormat and groupedNumberText are passed in from the content scripts the setup runs.
  // Note: string concatenation is used (not a template literal) to avoid any
  // back-tick/interpolation issues with the extracted source text.
  const helperSrc = '(function() {\n' +
    constBlock[0] + '\n' +
    formatSampleFn[0] + '\n' +
    'return { formatSample: formatSample };\n' +
    '})()';
  const helpers = (isolatedFunction(
    'numberFormat', 'groupedNumberText',
    'return ' + helperSrc + ';'
  ))(numberFormat, groupedNumberText);

  const fmtSample = helpers.formatSample;

  // Verify we got a real function, not undefined.
  eq('sidebar-extract: formatSample is a function',
     typeof fmtSample, 'function');

  // -----------------------------------------------------------------
  // original numbers display with thousands commas.
  // -----------------------------------------------------------------
  eq('formatSample(1000000) -> "1,000,000"',
     fmtSample(1000000), '1,000,000');
  eq('formatSample(-1234567) -> "-1,234,567"',
     fmtSample(-1234567), '-1,234,567');
  eq('formatSample(1e21) -> "1,000,000,000,000,000,000,000"',
     fmtSample(1e21), '1,000,000,000,000,000,000,000');
  eq('formatSample(-1e22) -> "-10,000,000,000,000,000,000,000"',
     fmtSample(-1e22), '-10,000,000,000,000,000,000,000');

  // -----------------------------------------------------------------
  // rounded numbers magnitude >= 100 → NO decimals.
  // -----------------------------------------------------------------
  eq('formatSample(100) -> "100" (exactly at boundary, no decimals)',
     fmtSample(100), '100');

  // -----------------------------------------------------------------
  // magnitude < 100 → at most 4 decimals, TRUNCATED.
  // This is the adversarial core: must be truncation, NOT rounding.
  // -----------------------------------------------------------------

  // Negatives below threshold: trunc toward zero (not floor).
  eq('negative: formatSample(-1.7999) -> "-1.7999" (toward zero)',
     fmtSample(-1.7999), '-1.7999');

  // Negative boundary: -100 at threshold → no decimals.
  eq('negative-100: formatSample(-100) -> "-100"',
     fmtSample(-100), '-100');

  // -----------------------------------------------------------------
  // Edge cases: zero, very small numbers, integers.
  // -----------------------------------------------------------------
  eq('edge: formatSample(0) -> "0"',
     fmtSample(0), '0');
  eq('edge: formatSample(0.00001) -> "0" (truncated to 4 places, last digit gone)',
     fmtSample(0.00001), '0');
  eq('edge: formatSample(0.00009999) -> "0" (below 4th decimal place)',
     fmtSample(0.00009999), '0');
  eq('edge: formatSample(0.1234) -> "0.1234" (exactly 4 decimals)',
     fmtSample(0.1234), '0.1234');
  eq('edge: formatSample(0.12345) -> "0.1234" (5th decimal truncated)',
     fmtSample(0.12345), '0.1234');

  // -----------------------------------------------------------------
  // REGRESSION GUARD: formatSample must TRUNCATE, never ROUND.
  // A toFixed() implementation rounds, turning e.g. 1.7999999999 into '1.8'.
  // All cases below would fail under a rounding implementation.
  // -----------------------------------------------------------------

  // Canonical example: deep-9s value, must truncate not round.
  eq('regression-trunc: formatSample(1.7999999999) -> "1.7999" (not "1.8")',
     fmtSample(1.7999999999), '1.7999');

  // Near-integer truncation: 1.999999999 must NOT round up to 2.
  eq('regression-trunc: formatSample(1.999999999) -> "1.9999" (not "2", not "1")',
     fmtSample(1.999999999), '1.9999');

  // 5th decimal truncated, not rounded: 5.12349999999 must NOT become '5.1235'.
  eq('regression-trunc: formatSample(5.12349999999) -> "5.1234" (not "5.1235")',
     fmtSample(5.12349999999), '5.1234');

  // Just below threshold: numeric (not string) 99.99999 must NOT round to 100.
  eq('regression-trunc: formatSample(99.99999) -> "99.9999" (not "100")',
     fmtSample(99.99999), '99.9999');

  // Negative near-integer: -1.999999999 must NOT round to -2.
  eq('regression-trunc: formatSample(-1.999999999) -> "-1.9999" (not "-2")',
     fmtSample(-1.999999999), '-1.9999');

  // Negative just below threshold: numeric -99.99999 must NOT round to -100.
  eq('regression-trunc: formatSample(-99.99999) -> "-99.9999" (not "-100")',
     fmtSample(-99.99999), '-99.9999');

  // Magnitude >= 100 with numeric (not string) input: 1234.56 -> "1,234".
  eq('regression-trunc: formatSample(1234.56) -> "1,234" (numeric input, commas, no decimals)',
     fmtSample(1234.56), '1,234');

  // Numeric 1.5 (not string): trailing zeros stripped, no padding.
  eq('regression-trunc: formatSample(1.5) -> "1.5" (numeric, no padding)',
     fmtSample(1.5), '1.5');

  // Integer 2: no decimals, no commas.
  eq('regression-trunc: formatSample(2) -> "2" (integer, no decimals)',
     fmtSample(2), '2');

  // Negative tiny value: -0.00001 truncates to 0, must NOT produce "-0".
  eq('regression-trunc: formatSample(-0.00001) -> "0" (no negative zero)',
     fmtSample(-0.00001), '0');

  // Adversarial fp-noise: 49.99995 must NOT round to '50'.
  eq('regression-trunc: formatSample(49.99995) -> "49.9999" (fp-noise, not "50")',
     fmtSample(49.99995), '49.9999');
})();

// ---------------------------------------------------------------------------
// Lens preview layout
// order of magnitude labels at each suffix boundary
// the other band's preview lists its samples in the order they arrive
// step labels in both bands' previews
// ---------------------------------------------------------------------------
(function advancedPreviewRedesignTests() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // -------------------------------------------------------------------------
  // Extract formatOomLabel, renderTopPreview, renderOtherPreview, and their
  // helpers from sidebar.js source, and evaluate them against DOM stubs.
  // -------------------------------------------------------------------------
  const constBlock = sidebarSrc.match(
    /const OOM_LABEL_CLASS\s*=[\s\S]*?const STEP_HEADER_CLASS\s*=.*?;/
  );
  const formatOomLabelFn = sidebarSrc.match(
    /function formatOomLabel\([\s\S]*?\n\}/
  );
  const renderOtherPreviewFn = sidebarSrc.match(
    /function renderOtherPreview\([\s\S]*?\n\}/
  );
  const renderTopPreviewFn = sidebarSrc.match(
    /function renderTopPreview\([\s\S]*?\n\}/
  );
  const renderHelperFns = ['appendSampleRow', 'appendLabel'].map((name) =>
    sidebarSrc.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}')));

  if (!constBlock || !formatOomLabelFn || !renderOtherPreviewFn || !renderTopPreviewFn ||
    renderHelperFns.some((m) => !m)) {
    eq('lens preview layout: formatOomLabel, renderOtherPreview, renderTopPreview and their helpers are found in sidebar.js', false, true);
    return;
  }

  // Build a minimal DOM stub sufficient for renderOtherPreview.
  // We collect appended children in order so we can inspect the render sequence.
  function makeEl(tag) {
    const children = [];
    const el = {
      _tag: tag,
      _children: children,
      _classNames: [],
      textContent: '',
      innerHTML: '',
      appendChild(child) { children.push(child); return child; },
      set className(v) { this._classNames.push(v); },
      get className() { return this._classNames[this._classNames.length - 1] || ''; },
    };
    return el;
  }

  // Collect elements appended to the band container in order.
  function makeBandEl() {
    const appended = [];
    return {
      _appended: appended,
      innerHTML: '',
      appendChild(child) { appended.push(child); return child; },
    };
  }

  // Stub document.createElement for the eval scope.
  const stubDocument = {
    createElement(tag) { return makeEl(tag); }
  };

  const renderSrc = '(function(document, formatSample, roundWithOffset, stepForOffset, formatStep, magnitudeOf) {\n' +
    constBlock[0] + '\n' +
    formatOomLabelFn[0] + '\n' +
    renderHelperFns.map((m) => m[0]).join('\n') + '\n' +
    renderTopPreviewFn[0] + '\n' +
    renderOtherPreviewFn[0] + '\n' +
    'return { formatOomLabel: formatOomLabel, renderOtherPreview: renderOtherPreview, renderTopPreview: renderTopPreview };\n' +
    '})';

  let renderHelpers;
  let realFormatSample;
  try {
    // formatSample in sidebar.js depends on numberFormat (lib/dr-number/reader.js) and
    // groupedNumberText (lib/dr-number/write-back.js), already on globalThis.
    const previewConstBlock = sidebarSrc.match(
      /const PREVIEW_DECIMAL_THRESHOLD\s*=.*?;\s*const PREVIEW_MAX_DECIMALS\s*=.*?;/
    );
    const formatSampleFn = sidebarSrc.match(/function formatSample\([\s\S]*?\n\}/);

    const fmtSampleSrc = '(function(numberFormat, groupedNumberText) {\n' +
      previewConstBlock[0] + '\n' +
      formatSampleFn[0] + '\n' +
      'return formatSample;\n' +
      '})(numberFormat, groupedNumberText)';
    realFormatSample = (isolatedFunction('numberFormat', 'groupedNumberText', 'return ' + fmtSampleSrc + ';'))(numberFormat, groupedNumberText);

    renderHelpers = (isolatedFunction(
      'document', 'formatSample', 'roundWithOffset', 'stepForOffset', 'formatStep', 'magnitudeOf',
      'return ' + renderSrc + '(document, formatSample, roundWithOffset, stepForOffset, formatStep, magnitudeOf);'
    ))(stubDocument, realFormatSample, roundWithOffset, stepForOffset, formatStep, magnitudeOf);
  } catch (e) {
    eq('lens preview layout: the sidebar functions evaluate', String(e), '');
    return;
  }

  const fmtOom = renderHelpers.formatOomLabel;
  const realRenderOtherPreview = renderHelpers.renderOtherPreview;
  const realRenderTopPreview = renderHelpers.renderTopPreview;

  // -------------------------------------------------------------------------
  // Exhaustive formatOomLabel mapping for mag = 9,8,7,6,5,4,3,2,1,0,-1,-2
  // Expected values derived from the pattern (10^mag with k/M/B suffix),
  // NOT from reading the implementation.
  // -------------------------------------------------------------------------
  // Suffix boundaries: mag 9 → 1B+, mag 6 → 1M+, mag 3 → 1k+
  eq('oom: mag=9 → "1B+" (1e9 boundary)', fmtOom(9), '1B+');
  eq('oom: mag=8 → "100M+" (within B range, 1e8=100M)', fmtOom(8), '100M+');
  eq('oom: mag=7 → "10M+" (within M range, 1e7=10M)', fmtOom(7), '10M+');
  eq('oom: mag=6 → "1M+" (1e6 boundary)', fmtOom(6), '1M+');
  eq('oom: mag=5 → "100k+" (within k range, 1e5=100k)', fmtOom(5), '100k+');
  eq('oom: mag=4 → "10k+" (within k range, 1e4=10k)', fmtOom(4), '10k+');
  eq('oom: mag=3 → "1k+" (1e3 boundary)', fmtOom(3), '1k+');
  eq('oom: mag=2 → "100+" (1e2, no suffix)', fmtOom(2), '100+');
  eq('oom: mag=1 → "10+" (1e1, no suffix)', fmtOom(1), '10+');
  eq('oom: mag=0 → "1+" (1e0=1, no suffix)', fmtOom(0), '1+');
  eq('oom: mag=-1 → "0.1+" (sub-unit, 1e-1=0.1)', fmtOom(-1), '0.1+');
  eq('oom: mag=-2 → "0.01+" (sub-unit, 1e-2=0.01)', fmtOom(-2), '0.01+');

  // -------------------------------------------------------------------------
  // Lens control stops: the comment beside STOPS in sidebar.js holds why the
  // stops follow the step, not the offset. Read STOPS straight from sidebar.js
  // and assert stepForOffset strictly increases across it for several
  // magnitudes.
  // -------------------------------------------------------------------------
  (function lensControlStops_stepsIncrease() {
    const m = sidebarSrc.match(/const STOPS\s*=\s*\[([^\]]*)\]/);
    if (!m) {
      eq('lens control stops: STOPS array found in sidebar.js', false, true);
      return;
    }
    const STOPS = m[1].split(',').map((s) => parseFloat(s.trim()));
    eq('lens control stops: STOPS has 9 stops', STOPS.length, 9);

    for (const mag of [6, 5, 3, 9]) {
      const oomVal = Math.pow(10, mag);
      let monotonic = true;
      let firstBreak = null;
      for (let i = 1; i < STOPS.length; i++) {
        const prev = stepForOffset(oomVal, STOPS[i - 1]);
        const cur = stepForOffset(oomVal, STOPS[i]);
        if (!(cur > prev)) {
          monotonic = false;
          firstBreak = STOPS[i - 1] + '→' + STOPS[i] + ' (' + prev + '≮' + cur + ')';
          break;
        }
      }
      eq('lens control stops at mag=' + mag + ': steps at 10^mag strictly increase across the lens control\'s stops' +
        (firstBreak ? ' [break at ' + firstBreak + ']' : ''), monotonic, true);
    }

    // Spot-check the exact step sweep at mag 6 against the worked example.
    const expectAtMag6 = [10e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6];
    STOPS.forEach((offset, i) => {
      eq('lens control stops at mag=6: offset ' + offset + ' → step ' + expectAtMag6[i],
        stepForOffset(1e6, offset), expectAtMag6[i]);
    });
  })();

  // -------------------------------------------------------------------------
  // Call renderOtherPreview with rows in the order content.js sends the other
  // band: one sample per order of magnitude, largest first.
  // -------------------------------------------------------------------------
  const rowsDescending = [
    { num: 50000, original: '50,000' },
    { num: 5000,  original: '5,000' },
    { num: 500,   original: '500' },
    { num: 50,    original: '50' },
  ];

  const bandEl = makeBandEl();
  realRenderOtherPreview(bandEl, rowsDescending, -0.5, 4);

  eq('other band of 50,000, 5,000, 500, and 50: 4 rows', bandEl._appended.length, 4);

  function getFromText(rowEl) {
    return rowEl._children[0] ? rowEl._children[0].textContent : '';
  }

  const renderedFromTexts = bandEl._appended.map(getFromText);
  eq('other band of 50,000, 5,000, 500, and 50: rows show 50,000, 5,000, 500, 50 in that order',
    renderedFromTexts, ['50,000', '5,000', '500', '50']);

  // -------------------------------------------------------------------------
  // edge: zero rows
  // -------------------------------------------------------------------------
  const emptyEl = makeBandEl();
  realRenderOtherPreview(emptyEl, [], -0.5, 0);
  eq('edge: empty rows renders nothing', emptyEl._appended.length, 0);

  // -------------------------------------------------------------------------
  // other preview examples carry a brown trailing step label "(5k)" after
  // the rounded number, showing what the example rounds to the nearest of. The
  // row still has three cells (from, arrow, num); the step span lives INSIDE
  // the num span (a 4th grid child would wrap to the next row). The top example
  // keeps its three cells and is prefixed "e.g.".
  // -------------------------------------------------------------------------

  const otherPreviewEl2 = makeBandEl();
  realRenderOtherPreview(otherPreviewEl2, [{ num: 1000, original: '1,000' }], -0.5, 3);
  eq('other band: a preview row has exactly 3 cells (from/arrow/num)',
    otherPreviewEl2._appended[0]._children.length, 3);
  const otherNumSpan = otherPreviewEl2._appended[0]._children[2];
  eq('other band: num span has a nested step-label child',
    otherNumSpan._children.length, 1);
  eq('other band: step-label child has class "step-label"',
    otherNumSpan._children[0] ? otherNumSpan._children[0].className : '', 'step-label');
  eq('other band: step-label text is " (500)"',
    otherNumSpan._children[0] ? otherNumSpan._children[0].textContent : '', ' (500)');

  const topPreviewEl2 = makeBandEl();
  realRenderTopPreview(topPreviewEl2, [{ num: 100000, original: '100,000' }], -0.5, 5);
  const topExamplePair = topPreviewEl2._appended[1];
  eq('top: top example has exactly 3 cells (from/arrow/num, no step)',
    topExamplePair._children.length, 3);
  eq('top: top example "from" is prefixed "e.g."',
    topExamplePair._children[0].textContent, 'e.g. 100,000');
  eq('top: top example num cell has no nested step label',
    topExamplePair._children[2]._children.length, 0);

  // strip: the "from" shows the bare number, not the original
  // surrounding text. renderTopPreview keys off row.num, so a row whose original
  // was "₹2,000 crore" still renders just "e.g. 2,000".
  const stripBandEl = makeBandEl();
  realRenderTopPreview(stripBandEl, [{ num: 2000, original: '₹2,000 crore' }], -0.5, 3);
  eq('strip: top "from" strips surrounding text to bare "e.g. 2,000"',
    stripBandEl._appended[1]._children[0].textContent, 'e.g. 2,000');

  // The top preview renders the step header AND the example as two
  // from|arrow|num rows in the same band container.
  {
    const topWithHdr = makeBandEl();
    realRenderTopPreview(topWithHdr, [{ num: 8584629, original: '8,584,629' }], -0.5, 6);
    eq('top preview appends 2 elements (step header + example)',
      topWithHdr._appended.length, 2);
    const stepHeaderRow = topWithHdr._appended[0];
    const exampleRow = topWithHdr._appended[1];
    eq('first appended element is the step header row (class "row step-header")',
      stepHeaderRow.className, 'row step-header');
    eq('step header row has 3 cells (from/arrow/num)',
      stepHeaderRow._children.length, 3);
    eq('step header "from" is the OoM label "1M+" (maxMag=6)',
      stepHeaderRow._children[0].textContent, '1M+');
    eq('step header "num" starts "nearest "',
      stepHeaderRow._children[2].textContent.indexOf('nearest ') === 0, true);
    eq('second appended element is the example row (class "row example")',
      exampleRow.className, 'row example');
    eq('example row has 3 cells (from/arrow/num)',
      exampleRow._children.length, 3);
    // The two "→" arrows sit in the same (middle) grid column so they align.
    eq('step header arrow is in the middle cell ("→")',
      stepHeaderRow._children[1].textContent, '→');
    eq('example arrow is in the middle cell ("→")',
      exampleRow._children[1].textContent, '→');
  }

  // sidebar.html lays the top preview out on the shared lens-preview grid,
  // with no flex override. The lens preview comment in sidebar.html holds the
  // reason.
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('#topPreview element carries the lens-preview grid class',
    /<div[^>]*id="topPreview"[^>]*class="lens-preview"|<div[^>]*class="lens-preview"[^>]*id="topPreview"/.test(sidebarHtmlSrc), true);
  eq('#topPreview is NOT overridden to display:flex',
    /#topPreview\s*\{[^}]*display:\s*flex/.test(sidebarHtmlSrc), false);
  eq('#topPreview step header cells are blue (#1a73e8)',
    /#topPreview \.step-header \.num\s*\{\s*color:\s*#1a73e8/.test(sidebarHtmlSrc), true);
  eq('.step-label colour rule present in sidebar.html',
    /\.step-label\s*\{\s*color:\s*#b3623d/.test(sidebarHtmlSrc), true);

  // Each row of the other preview holds an oom-label span inside its
  // from-span.
  const oomLabelBandEl = makeBandEl();
  realRenderOtherPreview(oomLabelBandEl, [{ num: 5000, original: '5,000' }], -0.5, 3);
  const fromSpan = oomLabelBandEl._appended[0]._children[0];
  eq('oom-label: from-span has oom-label child appended',
    fromSpan._children.length >= 1, true);
  eq('oom-label: oom-label child has class "oom-label"',
    fromSpan._children[0] ? fromSpan._children[0].className : '', 'oom-label');
  eq('oom-label: oom-label text contains "(1k+)"',
    fromSpan._children[0] ? fromSpan._children[0].textContent.includes('1k+') : false, true);
})();

// ---------------------------------------------------------------------------
// Sidebar unbound state
// Tests for the "no table bound" state in sidebar.js.
//
// The static assertions here read sidebar.html source, which no running test
// reaches; the live tests further down load sidebar.js whole through the
// harness in helpers.js.
//
// – sidebar.html CSS does not dim optionsSection or advancedSection under the
//        unbound class.
// ---------------------------------------------------------------------------

(function sidebarNoTableState() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // -------------------------------------------------------------------------
  // Static source checks (can always be verified without eval)
  // -------------------------------------------------------------------------

  // The stylesheet is out of reach of a running test. Instead of greying the
  // whole sidebar, the sidebar pillbox is flipped off (the running tests
  // below check that).
  eq('unbound: the stylesheet leaves the options section undimmed',
    /body\.unbound\s+#optionsSection/.test(sidebarHtml), false);

  eq('unbound: the stylesheet leaves the advanced section undimmed',
    /body\.unbound\s+#advancedSection/.test(sidebarHtml), false);

  eq('unbound: the stylesheet leaves the sidebar pillbox enabled',
    /body\.unbound\s+\.title-row\s+\.switch/.test(sidebarHtml), false);

  // sidebar.html default #status text is the unbound message.
  eq('unbound: the status line of the page as shipped holds the unbound prompt',
    /id="status"[^>]*>Right-click a table to connect it here\./.test(sidebarHtml), true);

})();

// ---------------------------------------------------------------------------
// stopPosition() mapping and CSS vertical alignment
// ---------------------------------------------------------------------------

(function dotsTickAlignment() {
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // --- Extract stopPosition() from sidebar.js and instantiate it for runtime testing ---
  // We locate the function body with a regex (same pattern used elsewhere for
  // source-level extraction) and wrap it in isolatedFunction so we can call it.
  const pctMatch = sidebarJsSrc.match(/function stopPosition\(v\)\s*\{([\s\S]*?)\n\}/);
  const stopsMatch = sidebarJsSrc.match(/const STOPS\s*=\s*\[([^\]]*)\]/);
  const snapMatch = sidebarJsSrc.match(/function snap\(v\)\s*\{([\s\S]*?)\n\}/);
  if (!pctMatch || !stopsMatch || !snapMatch) {
    failed++;
    failures.push({ name: 'dots-tick: stopPosition(), STOPS, and snap() found in sidebar.js', actual: false, expected: true });
  } else {
    passed++;
    // stopPosition() closes over STOPS and snap(); both come from sidebar.js
    // so the extracted body runs standalone against the real stops.
    const stops = stopsMatch[1].split(',').map((s) => parseFloat(s.trim()));
    const N = stops.length;
    const snapRaw = isolatedFunction('STOPS', 'v', snapMatch[1]);
    const snap = (v) => snapRaw(stops, v);
    const pctRaw = isolatedFunction('STOPS', 'snap', 'v', pctMatch[1]);
    const stopPosition = (v) => pctRaw(stops, snap, v);
    const TOL = 1e-6;

    // Each stop maps to the centre of its grid cell in an N-equal-column grid.
    // Cell k centre = (k + 0.5) / N * 100.
    stops.forEach((v, k) => {
      const expected = (k + 0.5) / N * 100;
      const actual = stopPosition(v);
      const ok = Math.abs(actual - expected) < TOL;
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push({
          name: `dots-tick: stopPosition(${v}) === cell-${k}-centre (${expected.toFixed(6)}%)`,
          actual: actual,
          expected: expected,
        });
      }
    });

    // Key exact values — extremes and the zero stop (index 5 of 9).
    const pctNeg2 = stopPosition(-2);
    const pctZero = stopPosition(0);
    const pctPos1 = stopPosition(1);

    eq('dots-tick: stopPosition(-2) ≈ 5.5556% (1st cell centre)',
      Math.abs(pctNeg2 - 0.5 / N * 100) < TOL, true);
    eq('dots-tick: stopPosition(0) ≈ 61.1111% (6th cell centre, asymmetric range)',
      Math.abs(pctZero - 5.5 / N * 100) < TOL, true);
    eq('dots-tick: stopPosition(1) ≈ 94.4444% (9th cell centre)',
      Math.abs(pctPos1 - 8.5 / N * 100) < TOL, true);

    // the extremes are inset by half a cell, never flush at 0/100.
    // A value-proportional formula would push an end stop to 0 or 100; the
    // index-based formula keeps both ends a half-cell in.
    eq('dots-tick: stopPosition(-2) is NOT 0 (end stop is inset by half a cell)',
      stopPosition(-2) !== 0, true);
    eq('dots-tick: stopPosition(1) is NOT 100 (end stop is inset by half a cell)',
      stopPosition(1) !== 100, true);

    // Monotonic — stopPosition is strictly increasing across all 9 stops.
    let monotonic = true;
    for (let i = 1; i < stops.length; i++) {
      if (stopPosition(stops[i]) <= stopPosition(stops[i - 1])) { monotonic = false; break; }
    }
    eq('dots-tick: stopPosition() is strictly increasing across all 9 stops', monotonic, true);

    // Equal columns — adjacent stops are exactly one cell (100/N %) apart,
    // regardless of the uneven numeric spacing of the stop values.
    let equalCols = true;
    const cell = 100 / N;
    for (let i = 1; i < stops.length; i++) {
      if (Math.abs((stopPosition(stops[i]) - stopPosition(stops[i - 1])) - cell) > TOL) { equalCols = false; break; }
    }
    eq('dots-tick: adjacent stops are one equal column (100/N %) apart', equalCols, true);
  }

  // --- 9-column grid assumption — verify tick markup matches formula ---
  // The stopPosition formula assumes N equal columns. Adversarial check: count the actual
  // tick spans and verify the CSS declares exactly repeat(9, 1fr).
  const tickSpans = (sidebarHtmlSrc.match(/class="t"/g) || []).length;
  eq('dots-tick: .dual-ticks contains exactly 9 tick spans (matches stopPosition() formula)',
    tickSpans, 9);

  eq('dots-tick: .dual-ticks CSS uses repeat(9, 1fr) grid',
    /\.dual-ticks\s*\{[^}]*grid-template-columns\s*:\s*repeat\(9,\s*1fr\)/.test(sidebarHtmlSrc), true);

  // --- Vertical CSS — .dual-ticks uses top: 20px ---
  eq('dots-tick: .dual-ticks CSS top is 20px',
    /\.dual-ticks\s*\{[^}]*top:\s*20px/.test(sidebarHtmlSrc), true);
})();

// ---------------------------------------------------------------------------
// Adversarial: wire-payload shape of the settings apply. The message body is
// {topic, settings}, same field names, same nesting, no extra bus-envelope
// fields, and chrome.tabs.sendMessage receives a THIRD argument, a response
// callback, which the sidebar uses to react to delivery: clear statusEl on
// success, setTableBound(false) when nothing answers (no content script on
// the tab).
// This isolates DR_BUS in its own vm sandbox (app/bus.js has no DOM
// dependency) and pins the call shape directly, independent of sidebar.js's
// heavier DOM requirements.
// ---------------------------------------------------------------------------
(function settingsApply_wirePayload() {
  if (busCode === null) {
    eq('wire payload: app/bus.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');
  const sentCalls = [];
  const sandbox = {
    chrome: {
      tabs: {
        query(q, cb) { cb([{ id: 7 }]); },
        sendMessage(...args) { sentCalls.push(args); },
      },
      runtime: {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + busCode + '\nthis.__DR_BUS = DR_BUS;', sandbox);

  // The settings apply is a request, so the ask is what puts it on the
  // wire. Both verbs build the same envelope through the same tab carrier.
  sandbox.__DR_BUS.request('request:applySettings',
    { settings: { offsetTop: -2, rangeExpr: 'A1:B2' } }, () => {});

  eq('wire payload: exactly one chrome.tabs.sendMessage call for one ask',
    sentCalls.length, 1);
  if (sentCalls.length !== 1) return;

  const [tabId, msg, callback] = sentCalls[0];
  // The topic name itself travels on the wire, in the topic field.
  eq('wire payload: the message topic field holds the topic name',
    msg.topic, 'request:applySettings');
  eq('wire payload: message field names are exactly {topic, settings} — no extra bus-envelope fields',
    Object.keys(msg).sort(), ['topic', 'settings'].sort());
  eq('wire payload: settings of offsetTop -2 and rangeExpr A1:B2 arrive nested in the message unchanged',
    JSON.stringify(msg.settings), JSON.stringify({ offsetTop: -2, rangeExpr: 'A1:B2' }));

  // Pin: the ask passes a response callback
  // (chrome.tabs.sendMessage's 3rd argument), which reflects delivery failure
  // back into the UI (setTableBound(false) when nothing answers) and clears
  // statusEl on success. This only pins the MECHANISM — that the ask passes a
  // callback — not the behavior; see appModelSettings_settingsPublish_
  // deliveryFeedback_behavioral below for the behavioral coverage.
  eq('wire payload: an ask passes a response callback as chrome.tabs.sendMessage\'s third argument',
    typeof callback, 'function');
})();

// ---------------------------------------------------------------------------
// Adversarial (behavioral): the pin above only proves the ask PASSES a
// callback to chrome.tabs.sendMessage — it says nothing about what that
// callback does. This drives sidebar.js's real applyNow() ->
// DR_BUS.request() path end to end and checks two behaviors: a failed
// delivery must unbind the sidebar via setTableBound(false); a successful
// delivery must clear #status.
// ---------------------------------------------------------------------------
(function appModelSettings_settingsPublish_deliveryFeedback_behavioral() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const readerSrc = sourceByName('lib/dr-number/reader.js');
  if (constantsCode === null || roundingSrc === null || readerSrc === null || busCode === null) {
    eq('settings publish delivery: source files (defaults/rounding/reader/bus) present in manifest',
      false, true);
    return;
  }

  // Minimal element stub — same shape as the other sidebar.js eval harnesses
  // in this file (see tableContextmenuActivation_sidebarFlash above).
  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
    };
  }

  // #status and #enabled are the two elements setTableBound touches; capture
  // the exact objects sidebar.js's document.getElementById() hands back so we
  // can read their mutations directly, with no need to export any function.
  const statusEl = makeEl();
  const enabledEl = makeEl();
  enabledEl.checked = true;
  let enabledChangeHandler = null;
  enabledEl.addEventListener = function (type, fn) { if (type === 'change') enabledChangeHandler = fn; };

  const bodyClasses = new Set();
  const captureBody = {
    classList: {
      add(cls) { bodyClasses.add(cls); },
      remove(cls) { bodyClasses.delete(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    addEventListener() {},
    get offsetWidth() { return 0; },
  };

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  // chrome.tabs.query/sendMessage resolve synchronously so the whole chain —
  // sidebar.js's applyNow() -> DR_BUS.request() -> chrome.tabs.sendMessage's
  // own callback -> the sidebar's answer callback — runs deterministically
  // within one call, with queuedLastError picking whether the stub answers
  // with a value or with nothing (matching real sendMessage semantics).
  const sentTabMessages = [];
  let queuedLastError = null;
  const captureChrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      get lastError() { return queuedLastError; },
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      // Chrome hands the callback the responder's value on success, and
      // nothing (with lastError set) when nobody answered. queuedLastError
      // picks which, so one stub covers both directions.
      sendMessage(tabId, msg, cb) {
        sentTabMessages.push(msg);
        if (typeof cb === 'function') cb(queuedLastError ? undefined : { ok: true });
      },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  // sidebar.js's top-level code — including its own change/click listener
  // registrations — resolves `document`/`chrome`/`window` dynamically off
  // the global object every time it runs, not just at eval time. The
  // captured enabledChangeHandler is called below, well after the initial
  // eval, so the stubs must stay installed for that call too — restore the
  // real globals only once every scenario below has run.
  try {
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        readerSrc + '\n' +
        busCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // sidebar.js's module-level settings/preview pull can throw past this
      // point in this stub environment (chrome.tabs.sendMessage's callback
      // gets no real response) — the 'change' listener registers before that
      // runs, so we only need it captured.
    }

    eq('settings publish delivery: sidebar\'s enabled-checkbox change handler was captured',
      typeof enabledChangeHandler, 'function');
    if (typeof enabledChangeHandler !== 'function') return;

    // --- Failure: chrome.runtime.lastError set -> the sidebar shows unbound. ---
    bodyClasses.delete('unbound');
    enabledEl.checked = true;
    statusEl.textContent = '';
    queuedLastError = { message: 'Could not establish connection.' };
    sentTabMessages.length = 0;
    enabledChangeHandler();

    eq('settings publish delivery: one request:applySettings message sent for the change',
      sentTabMessages.length, 1);
    eq('settings publish delivery: failed delivery adds the unbound class',
      bodyClasses.has('unbound'), true);
    eq('settings publish delivery: failed delivery flips the enabled checkbox off',
      enabledEl.checked, false);
    eq('settings publish delivery: failed delivery sets #status to the unbound message',
      statusEl.textContent, 'Right-click a table to connect it here.');

    // --- Success: no lastError -> #status is cleared. ---
    bodyClasses.delete('unbound');
    statusEl.textContent = 'a stale status message';
    queuedLastError = null;
    enabledChangeHandler();

    eq('settings publish delivery: successful delivery clears #status',
      statusEl.textContent, '');
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

// ---------------------------------------------------------------------------
// A pulled enabled:false must survive
// sidebar reopen when the reopen lands on a TABLE THAT IS BOUND. This drives
// sidebar.js's real redrawFromActiveTable() -> drawControls() ->
// setTableBound() path end to end (same eval harness shape as
// appModelSettings_settingsPublish_deliveryFeedback_behavioral above).
//
// The pin: redrawFromActiveTable draws the answer's settings, then calls
// setTableBound(true) because the same answer holds a bound table's samples.
// setTableBound's bound branch must not write the sidebar pillbox, so the
// pulled false survives the reopen.
// ---------------------------------------------------------------------------
(function appModelSettings_pulledEnabledSurvivesReopenOnBoundTable() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const readerSrc = sourceByName('lib/dr-number/reader.js');
  if (constantsCode === null || roundingSrc === null || readerSrc === null || busCode === null) {
    eq('reopen-bound: source files (defaults/rounding/reader/bus) present in manifest',
      false, true);
    return;
  }

  // Same minimal element stub as the other full-sidebar.js eval harnesses in
  // this piece (see appModelSettings_settingsPublish_deliveryFeedback_behavioral).
  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    };
  }

  const statusEl = makeEl();
  const enabledEl = makeEl();

  const bodyClasses = new Set();
  const captureBody = {
    classList: {
      add(cls) { bodyClasses.add(cls); },
      remove(cls) { bodyClasses.delete(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    addEventListener() {},
    get offsetWidth() { return 0; },
  };

  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) {
      if (id === 'status') return statusEl;
      if (id === 'enabled') return enabledEl;
      return makeEl();
    },
    createElement() { return makeEl(); },
  };

  // The model holds enabled:false. request:activeTable answers that pulled
  // settings object beside a non-null samples object, i.e. the reopen landed
  // on a table that is bound. It resolves synchronously so the whole redrawFromActiveTable() path —
  // including sidebar.js's own module-level opening read on load — settles
  // deterministically within the single eval() call below.
  const pulledSettings = Object.assign({}, DR_DEFAULTS, { enabled: false });
  const captureChrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      lastError: null,
    },
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      sendMessage(tabId, msg, cb) {
        if (msg.topic === 'request:activeTable') {
          cb({ settings: pulledSettings, samples: { top: [], other: [] }, maxMag: 0 });
        } else {
          // The settings apply. Chrome hands back the responder's value on
          // success and nothing when nobody answered, which is the fact the
          // sidebar reads to decide bound versus unbound.
          cb(captureChrome.runtime.lastError ? undefined : { ok: true });
        }
      },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = { addEventListener() {}, close() {}, getComputedStyle: () => ({ display: 'block' }) };

  let evalError = null;
  try {
    try {
      eval(
        constantsCode + '\n' +
        roundingSrc + '\n' +
        readerSrc + '\n' +
        busCode + '\n' +
        fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
      );
    } catch (e) {
      // The stubs above let the whole module-level redrawFromActiveTable()
      // path run without throwing. A throw from an unstubbed DOM method is
      // recorded, so this test fails instead of reading enabledEl.checked at
      // its untouched initial value.
      evalError = e;
    }

    eq('reopen-bound: sidebar.js\'s module-level pull ran to completion with no stub gaps',
      evalError, null);
    eq('reopen-bound: the pulled enabled:false survives the reopen when the same answer holds samples (samples !== null)',
      enabledEl.checked, false);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

(function issue251_tableSwitchMirrorsModelSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('switch-pull: source files (defaults/rounding/reader/bus) present in manifest',
      false, true);
    return;
  }
  try {
    eq('switch-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('switch-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Drift the sidebar away from the model: the switch shows on (as a
    // defaults reset would leave it) and the range expression is blank.
    h.enabledEl.checked = true;
    h.rangeExprEl.value = '';

    // The switch message: re-read the model.
    h.dispatch({ topic: 'state:tableSwitched' });
    eq('switch-pull: the sidebar pillbox mirrors the model\'s enabled:false after a switch',
      h.enabledEl.checked, false);
    // The claim here is that the sidebar MIRRORS the application model. A
    // press that moves the active table sends state:tableSwitched and then clears
    // the range expression in its one settings write (2026-09-14 sidebar-
    // state-removal, part one). The send goes out first, and Chrome delivers
    // it after the content script's handler returns, so the pull it triggers
    // reads the cleared expression. What reaches the sidebar through this
    // path after such a press is therefore blank. This test still holds,
    // because it asserts the mirroring and the model fixture above is what
    // it mirrors.
    eq('switch-pull: the range expression mirrors the model after a switch (pull, not defaults reset)',
      h.rangeExprEl.value, 'B2:E8');
  } finally {
    h.restore();
  }
})();

(function issue251_previewRefreshMirrorsModelSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('refresh-pull: source files (defaults/rounding/reader/bus) present in manifest',
      false, true);
    return;
  }
  try {
    eq('refresh-pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    eq('refresh-pull: sidebar onMessage handler was captured', h.hasHandler(), true);
    if (h.evalError !== null || !h.hasHandler()) return;

    // Drift the switch on, then deliver the stale-view signal. A bare
    // preview fetch would end in setTableBound(true) and reset the switch to
    // the shipped default (on) — the model says off.
    h.enabledEl.checked = true;
    h.dispatch({ topic: 'state:previewSamplesChanged' });
    eq('refresh-pull: the sidebar pillbox mirrors the model\'s enabled:false after a preview refresh',
      h.enabledEl.checked, false);
  } finally {
    h.restore();
  }
})();

// ---------------------------------------------------------------------------
// The context-menu toggle must go through the same controller branch a
// table pillbox press uses. The right-click that opens the menu already activates
// the table (the contextmenu handler publishes intent:activateTable), so with the
// sidebar open, the menu toggle on that table must write the table's settings
// and send them (the settings notice). A menu path that simplified the table
// directly would leave the settings and the sidebar stale, and the next
// reopen or switch would re-impose the stale settings. Fresh-eval fixture modeled on the
// double-invocation test above; same minimal grid, real captured handlers.
// ---------------------------------------------------------------------------
(function issue275_menuToggleOnConnectedTableWritesRecord() {
  function makeCell(text) { return withTextPiece({ nodeType: 1, textContent: text, children: [] }); }
  function makeRow(texts) { return { nodeType: 1, className: 'row', children: texts.map(makeCell) }; }
  const rows = [
    makeRow(['A', '100']), makeRow(['B', '200']), makeRow(['C', '300']),
    makeRow(['D', '400']), makeRow(['E', '500']),
  ];
  const gridClassList = (() => {
    const c = [];
    return {
      add(x) { if (!c.includes(x)) c.push(x); },
      remove(x) { const i = c.indexOf(x); if (i >= 0) c.splice(i, 1); },
      contains(x) { return c.includes(x); },
    };
  })();
  const gridEl = {
    nodeType: 1, tagName: 'DIV', className: 'grid-wrapper', children: rows,
    classList: gridClassList, parentElement: null, parentNode: null,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 }; },
  };
  const clickTarget = {
    nodeType: 1, tagName: 'DIV', parentElement: gridEl, parentNode: gridEl,
    closest() { return null; },
  };

  function mockCreateElement(tag) {
    if (tag === 'button') {
      return {
        type: '', className: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
        addEventListener() {}, appendChild() {}, parentElement: null,
      };
    }
    return { className: '', style: {}, textContent: '', appendChild() {}, addEventListener() {} };
  }

  let contextmenuHandler = null;
  // Chrome hands an arriving message to every registered listener: the bus's
  // and the one content.js keeps for the requests.
  const messageListeners = [];
  const fireMessage = (msg) => messageListeners.forEach((fn) => fn(msg, {}, () => {}));
  const captureDoc = {
    addEventListener(type, handler) { if (type === 'contextmenu') contextmenuHandler = handler; },
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild() {}, observe() {} },
    head: { appendChild() {} },
    createElement: mockCreateElement,
  };
  const sentMessages = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { messageListeners.push(fn); } },
      sendMessage(msg) { sentMessages.push(msg); },
    },
  };

  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedGCS = global.getComputedStyle;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.getComputedStyle = () => ({ display: 'flex' });

  try {
    eval(contentScriptBundle + `
      globalThis.__i275_DR_MODEL = DR_MODEL;
    `);
    const model = global.__i275_DR_MODEL;

    eq('menu-toggle record: contextmenu handler was captured', typeof contextmenuHandler, 'function');
    eq('menu-toggle record: the bus registered its message listener', messageListeners.length, 1);
    if (typeof contextmenuHandler !== 'function' || messageListeners.length === 0) return;

    // The right-click that opens the menu: discovers, marks, and CONNECTS
    // the grid — exactly what a real menu use does before intent:menuClicked.
    contextmenuHandler({ target: clickTarget });
    eq('menu-toggle record: the right-click connected the grid',
      model.getActiveTable(), gridEl);

    // The table's settings start at on.
    model.setTableSettings(gridEl, { enabled: true }, 'page');
    eq('menu-toggle record: precondition — the table\'s settings start enabled',
      model.getTableSettings(gridEl).enabled, true);

    sentMessages.length = 0;
    fireMessage({ topic: 'intent:menuClicked' });

    eq('menu-toggle record: the menu toggle on the connected table writes the table\'s off',
      model.getTableSettings(gridEl).enabled, false);
    const notices = sentMessages.filter((m) => m.topic === 'state:settingsChanged');
    eq('menu-toggle record: the menu toggle sends the table\'s settings to the sidebar — off, from a page-side writer',
      notices.map((m) => [m.settings.enabled, m.source]), [[false, 'page']]);
  } finally {
    delete global.__i275_DR_MODEL;
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.getComputedStyle = savedGCS;
  }
})();

// ---------------------------------------------------------------------------
// The settings notice reaches the sidebar, and the sidebar redraws on it.
// The model publishes it after every write, so no writer can leave the
// sidebar showing stale values. A notice carries which side wrote it. On a
// notice that something other than the sidebar wrote, the sidebar redraws its
// controls from the redraw read. On its own notice it leaves the controls as
// they stand, because an echo arriving after a newer keystroke or lens
// control step would overwrite that step.
// ---------------------------------------------------------------------------
const ISSUE328_PAGE_SETTINGS = Object.assign({}, DR_DEFAULTS,
  { enabled: true, rangeExpr: 'C3', offsetTop: 1, offsetOther: 1 });

(function issue328_aPageNoticeForTheActiveTableRedrawsTheSidebar() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('settings notice: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('settings notice: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // The model publishes the notice after its write, so it holds the
    // notice's settings by the time the sidebar reads.
    Object.assign(h.modelSettings, ISSUE328_PAGE_SETTINGS);
    h.tabMessages.length = 0;
    h.dispatch({ topic: 'state:settingsChanged', source: 'page',
      settings: ISSUE328_PAGE_SETTINGS });
    eq('settings notice: the range expression redraws from the model', h.rangeExprEl.value, 'C3');
    eq('settings notice: the switch redraws from the model', h.enabledEl.checked, true);
    eq('settings notice: the lens preview refreshes from the same read',
      h.tabMessages.map((m) => m.topic), ['request:activeTable']);

    h.tabMessages.length = 0;
    h.el('dateGranularity').fire('change');
    const applyMsg = h.tabMessages.find((m) => m.topic === 'request:applySettings');
    eq('settings notice: the next save carries the redrawn lens control',
      applyMsg && [applyMsg.settings.offsetTop, applyMsg.settings.offsetOther], [1, 1]);
  } finally {
    h.restore();
  }
})();

(function issue328_theSidebarSkipsItsOwnNotices() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('settings notice skip: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('settings notice skip: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    Object.assign(h.modelSettings, ISSUE328_PAGE_SETTINGS);
    h.tabMessages.length = 0;
    h.dispatch({ topic: 'state:settingsChanged', source: 'sidebar',
      settings: ISSUE328_PAGE_SETTINGS });
    eq('settings notice skip: the sidebar\'s own write redraws no control', h.rangeExprEl.value, 'B2:E8');
    eq('settings notice skip: the sidebar\'s own write refreshes the lens preview',
      h.tabMessages.map((m) => m.topic), ['request:activeTable']);
  } finally {
    h.restore();
  }
})();

// A right-click makes another table active, so the controls must describe
// that table: the sidebar reads its settings and lens preview.
(function issue328_rightClickActivationPullsTheSettings() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('activation pull: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('activation pull: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.rangeExprEl.value = '';
    h.enabledEl.checked = true;
    h.tabMessages.length = 0;
    h.dispatch({ topic: 'state:tableActivated' });
    eq('activation pull: a right-click activation sends one read of the active table',
      h.tabMessages.map((m) => m.topic), ['request:activeTable']);
    eq('activation pull: the controls describe the newly active table',
      [h.rangeExprEl.value, h.enabledEl.checked], ['B2:E8', false]);
  } finally {
    h.restore();
  }
})();

// ---------------------------------------------------------------------------
// One redraw read: the controls, the bound state, and the lens preview all
// come from one answer to one request.
// ---------------------------------------------------------------------------
const SINGLE_READ_SAMPLES = {
  top: [{ original: '4,236,000', num: 4236000 }],
  other: [{ original: '8,120', num: 8120 }],
};

(function singleRead_aRedrawSendsOneRequestAndDrawsFromItsAnswer() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('single read: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('single read: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    answerActiveTableRead(h, {
      settings: Object.assign({}, DR_DEFAULTS, { enabled: true, rangeExpr: 'C3' }),
      samples: SINGLE_READ_SAMPLES,
      maxMag: 6,
    });
    const otherRows = recordAppendedChildren(h.el('otherPreview'));
    h.tabMessages.length = 0;
    h.dispatch({ topic: 'state:tableSwitched' });
    eq('single read: a redraw sends exactly one request, the read of the active table',
      h.tabMessages.map((m) => m.topic), ['request:activeTable']);
    eq('single read: the controls come from the answer\'s settings',
      [h.rangeExprEl.value, h.enabledEl.checked], ['C3', true]);
    eq('single read: the bound state comes from the answer\'s samples',
      h.bodyClasses.has('unbound'), false);
    eq('single read: the lens preview draws the answer\'s samples',
      otherRows.length, SINGLE_READ_SAMPLES.other.length);

    answerActiveTableRead(h, { settings: DR_DEFAULTS, samples: null, maxMag: null });
    h.tabMessages.length = 0;
    h.dispatch({ topic: 'state:tableSwitched' });
    eq('single read: an answer with null samples redraws the sidebar unbound',
      [h.bodyClasses.has('unbound'), h.enabledEl.checked], [true, false]);
  } finally {
    h.restore();
  }
})();

(function singleRead_anEchoKeepsANewerControlAndRefreshesTheLensPreview() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('echo keeps control: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('echo keeps control: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // The user types a range expression, which sends a write, then types
    // more before the write's notice arrives. The model still holds the
    // first value when the sidebar reads.
    h.rangeExprEl.value = 'C3';
    h.rangeExprEl.fire('input');
    answerActiveTableRead(h, {
      settings: Object.assign({}, DR_DEFAULTS, { rangeExpr: 'C3' }),
      samples: SINGLE_READ_SAMPLES,
      maxMag: 6,
    });
    h.rangeExprEl.value = 'C3:D9';
    const otherRows = recordAppendedChildren(h.el('otherPreview'));
    h.tabMessages.length = 0;
    h.dispatch({ topic: 'state:settingsChanged', source: 'sidebar',
      settings: Object.assign({}, DR_DEFAULTS, { rangeExpr: 'C3' }) });
    eq('echo keeps control: the sidebar\'s own notice leaves the newer range expression',
      h.rangeExprEl.value, 'C3:D9');
    eq('echo keeps control: the sidebar\'s own notice still reads the active table',
      h.tabMessages.map((m) => m.topic), ['request:activeTable']);
    eq('echo keeps control: the lens preview redraws from the read',
      otherRows.length, SINGLE_READ_SAMPLES.other.length);
  } finally {
    h.restore();
  }
})();

// A sidebar whose tab has sent no answer yet shows the unbound state from
// load, and an answer without samples brings the state back.
(function unbound_aSidebarThatNoPageAnswersShowsThePromptWithOptionsDisabled() {
  const h = makeIssue251SidebarHarness({ pageAnswers: false });
  if (!h) {
    eq('unbound: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('unbound: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    eq('unbound: a sidebar opened with no page answer carries the unbound class',
      h.bodyClasses.has('unbound'), true);
    eq('unbound: a sidebar opened with no page answer shows the unbound prompt',
      h.statusEl.textContent, 'Right-click a table to connect it here.');
    eq('unbound: a sidebar opened with no page answer disables its options',
      h.el('optionsSection').classList.contains('disabled'), true);

    answerActiveTableRead(h, {
      settings: Object.assign({}, DR_DEFAULTS, { enabled: true }),
      samples: SINGLE_READ_SAMPLES,
      maxMag: 6,
    });
    h.dispatch({ topic: 'state:tableSwitched' });
    eq('unbound: an answer holding samples and enabled:true clears the class, the prompt, and the disabled options',
      [h.bodyClasses.has('unbound'), h.statusEl.textContent, h.enabledEl.checked,
        h.el('optionsSection').classList.contains('disabled')],
      [false, '', true, false]);

    answerActiveTableRead(h, {
      settings: Object.assign({}, DR_DEFAULTS, { enabled: true }),
      samples: null,
      maxMag: null,
    });
    h.dispatch({ topic: 'state:tableSwitched' });
    eq('unbound: an answer with null samples and enabled:true shows the prompt, the sidebar pillbox off, and the options disabled',
      [h.bodyClasses.has('unbound'), h.statusEl.textContent, h.enabledEl.checked,
        h.el('optionsSection').classList.contains('disabled')],
      [true, 'Right-click a table to connect it here.', false, true]);
  } finally {
    h.restore();
  }
})();

// The lens control's thumbs sit at the centre of their stops' columns.
(function lensControl_anAnswerWithOffsetsPlacesEachThumbAtItsStopColumn() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lens thumbs: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('lens thumbs: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    answerActiveTableRead(h, {
      settings: Object.assign({}, DR_DEFAULTS, { offsetTop: -2, offsetOther: 1 }),
      samples: SINGLE_READ_SAMPLES,
      maxMag: 6,
    });
    h.dispatch({ topic: 'state:tableSwitched' });
    const COLUMN_COUNT = 9;
    eq('lens thumbs: offsets -2 and 1 place the top thumb in the first column and the other thumb in the last',
      [h.el('topThumb').style.left, h.el('otherThumb').style.left],
      [(0.5 / COLUMN_COUNT * 100) + '%', (8.5 / COLUMN_COUNT * 100) + '%']);
  } finally {
    h.restore();
  }
})();

(function captureSizeNoteGlue() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  eq('capture-size: the form holds a hidden size note',
    /<div[^>]*id="captureSizeNote"[^>]*hidden/.test(sidebarHtmlSrc), true);
  eq('capture-size: opening the form measures the pulled state',
    sidebarJsSrc.includes('DR_CAPTURE.sizeWarning(') &&
      sidebarJsSrc.includes('captureSizeNote'), true);
  eq('capture-size: a failed save reports on the status line',
    sidebarJsSrc.includes('Capture failed'), true);
})();

// --- sidebar: the capture's log rows ---
//
// Opening the form, pressing finish, and a save that completes write no row:
// the capture they produce holds its mark, its state, and itself. A failed
// step writes one warn row naming the step and, for a thrown Error, its type.
// Every step here settles at once, so each press runs to its end in the call.
(function captureLogRows() {
  const h = makeIssue251SidebarHarness({ captureMarks: ['looks-wrong'] });
  if (!h) {
    eq('capture rows: source files present in manifest', false, true);
    return;
  }
  const lastLevel = () => DR_LOG.copyBuffer().rows.slice(-1)[0].level;
  try {
    eq('capture rows: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;
    eq('capture rows: a table switch writes one row',
      logRowsDuring(() => h.dispatch({ topic: 'state:tableSwitched' })),
      ['Dynamic Rounding: table switch']);
    eq('capture rows: opening the form writes no row',
      logRowsDuring(() => h.captureMarkEls[0].fire('click')), []);

    // The page answers the state pull, the tab takes the screenshot, and the
    // page body takes the download link. The suite's log buffer also feeds
    // the toast view, which draws a warn row's toast on this document.
    h.chromeMock.runtime.getManifest = () => ({ version: '0.0.0' });
    global.document.head = { appendChild() {} };
    h.chromeMock.tabs.captureVisibleTab = () => ({ then(ok) { ok('data:image/jpeg;base64,AAAA'); } });
    global.document.body.appendChild = () => {};
    global.document.createElement = () => ({ click() {}, remove() {}, setAttribute() {}, addEventListener() {} });
    eq('capture rows: pressing finish and a completed save write no row',
      logRowsDuring(() => h.el('captureSave').fire('click')), []);

    h.captureMarkEls[0].fire('click');
    const answerTab = h.chromeMock.tabs.sendMessage;
    h.chromeMock.tabs.sendMessage = (tabId, msg, cb) =>
      (msg.topic === 'request:captureState' ? cb(undefined) : answerTab(tabId, msg, cb));
    eq('capture rows: an unanswered state pull writes one warn row naming the step',
      [logRowsDuring(() => h.el('captureSave').fire('click')), lastLevel()],
      [['Dynamic Rounding: error · step: state pull'], 'warn']);
    h.chromeMock.tabs.sendMessage = answerTab;

    // A page body with no append makes the save throw a TypeError.
    h.captureMarkEls[0].fire('click');
    delete global.document.body.appendChild;
    eq('capture rows: a save that throws writes one warn row naming the step and the error type',
      [logRowsDuring(() => h.el('captureSave').fire('click')), lastLevel()],
      [['Dynamic Rounding: error · step: capture save · error: TypeError'], 'warn']);
  } finally {
    h.restore();
  }
})();

// --- sidebar: section order ---
//
// The lens control sits first, under the title. The switches sit inside the
// Advanced section, which starts closed. The capture section carries no title.

(function sidebarSectionOrder() {
  const html = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const body = html.slice(html.indexOf('<body>'));
  const at = (marker) => body.indexOf(marker);
  const advancedOpen = at('id="advancedSection"');
  const advancedClose = at('</details>');

  eq('section order: the lens control precedes the Advanced section',
    at('id="lensSection"') !== -1 && at('id="lensControl"') > at('id="lensSection"') &&
      at('id="lensControl"') < advancedOpen,
    true);
  eq('section order: the switches sit inside the Advanced section',
    at('id="optionsSection"') > advancedOpen && at('id="simplifyFirstColumn"') < advancedClose,
    true);
  eq('section order: the Advanced section starts closed',
    /<details[^>]*id="advancedSection"[^>]*>/.exec(body)[0].includes(' open'), false);
  eq('section order: the switches still dim when the sidebar pillbox is off',
    /#optionsSection\.disabled\s*\{[^}]*opacity/.test(html), true);
  eq('section order: the capture section carries no section title',
    /id="captureSection"[^>]*>\s*<div class="capture-marks"/.test(body), true);
})();

// sidebar.html id ↔ setting key parity — each of the six switch keys must
// appear as id="<key>" on a checkbox <input>.
(function sidebarSwitchKeysHaveCheckboxes() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const optionKeys = [
    'simplifyMixedCurrency', 'simplifyMixedPercent',
    'simplifyDates', 'simplifyTimes', 'simplifyFirstRow', 'simplifyFirstColumn'
  ];
  for (const key of optionKeys) {
    eq(`sidebar.html: checkbox with id="${key}" present`,
      new RegExp(`<input[^>]*type="checkbox"[^>]*id="${key}"|<input[^>]*id="${key}"[^>]*type="checkbox"`).test(sidebarHtml),
      true);
  }
})();

// --- sidebar: the capture section and its glue ---
//
// These tests pin the markup and the glue's load-bearing seams: the three
// mark buttons, the form that nothing saves without, the one save path, and
// the state pull.

(function captureSidebarSection() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  eq('capture-ui: sidebar.html carries the capture section with three mark buttons',
    sidebarHtmlSrc.includes('id="captureSection"') &&
      ['data-mark="looks-right"', 'data-mark="not-sure"', 'data-mark="looks-wrong"']
        .every((m) => sidebarHtmlSrc.includes(m)),
    true);
  eq('capture-ui: the remarks form starts hidden and holds one remarks field and both buttons',
    /<div[^>]*id="captureForm"[^>]*hidden/.test(sidebarHtmlSrc) &&
      ['id="captureRemarks"', 'id="captureSave"', 'id="captureCancel"']
        .every((id) => sidebarHtmlSrc.includes(id)) &&
      !sidebarHtmlSrc.includes('id="captureExpected"'),
    true);
  eq('capture-ui: the remarks placeholder text follows the mark',
    ['Suggestions / questions / remarks', 'expected / observed / cause (if known)']
      .every((hint) => sidebarJsSrc.includes(hint)) &&
      /placeholder/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the glue asks for the capture state over request:captureState',
    sidebarJsSrc.includes("DR_BUS.request('request:captureState'"), true);
  eq('capture-ui: exactly one save path creates the blob URL',
    (sidebarJsSrc.match(/createObjectURL/g) || []).length, 1);
  eq('capture-ui: nothing saves without a pressed mark',
    /function saveCapture\(\)[\s\S]{0,200}if \(captureMark === null\) return;/.test(sidebarJsSrc),
    true);
  eq('capture-ui: the filename carries the mark',
    /DR_CAPTURE\.filenameFor\(\{[^}]*mark: mark/.test(sidebarJsSrc), true);
  eq('capture-ui: the sidebar\'s own log buffer copy travels beside the content script\'s',
    /sidebar: DR_LOG\.copyBuffer\(\)/.test(sidebarJsSrc), true);
  const saveBody = (sidebarJsSrc.match(/function saveCapture\(\)[\s\S]*?\n\}/) || [''])[0];
  eq('capture-ui: finish takes the screenshot beside the state pull and the save waits for both',
    saveBody.includes("DR_BUS.request('request:captureState'") &&
      saveBody.includes('takeCaptureScreenshot(chrome.tabs, boundTab.windowId()') &&
      (saveBody.match(/assembleAndSaveCapture\(/g) || []).length === 1, true);
  eq('capture-ui: the renderer receives the image beside the state, never inside it',
    /buildCaptureDocument\(\{[\s\S]{0,200}screenshotDataUrl:/.test(sidebarJsSrc) &&
      /state\.screenshot = /.test(sidebarJsSrc) &&
      !/state\.screenshotDataUrl/.test(sidebarJsSrc), true);
})();

// The mark glyphs live in two machine copies — the sidebar's buttons
// and the renderer's map — and one copy cannot read the other (static
// markup against a content-script constant). This pin holds them together:
// a glyph change that lands in one place fails here, naming the other.
(function captureGlyphCopiesMatch() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  const buttonGlyphs = {};
  const buttonRe = /data-mark="([a-z-]+)"[^>]*>([^<]+)</g;
  let m;
  while ((m = buttonRe.exec(sidebarHtmlSrc)) !== null) {
    buttonGlyphs[m[1]] = m[2].replace(/&#(\d+);/g,
      (_, code) => String.fromCodePoint(Number(code)));
  }
  eq('capture-glyphs: the sidebar buttons and the renderer map carry the same three glyphs',
    buttonGlyphs, CAPTURE_MARK_GLYPHS);
  // The button title is the mark's word for the sidebar; the renderer derives
  // the same word from the token, so the two surfaces stay in step.
  const buttonTitles = {};
  const titleRe = /data-mark="([a-z-]+)"[^>]*title="([^"]+)"/g;
  while ((m = titleRe.exec(sidebarHtmlSrc)) !== null) buttonTitles[m[1]] = m[2];
  const rendererLabels = {};
  Object.keys(CAPTURE_MARK_GLYPHS).forEach((token) => {
    rendererLabels[token] = DR_CAPTURE.markLabel(token);
  });
  eq('capture-glyphs: the sidebar button titles match the renderer\'s mark words',
    buttonTitles, rendererLabels);
  eq('capture-glyphs: a token outside the three renders as itself',
    DR_CAPTURE.markLabel('constructor'), 'constructor');
})();

// --- The sidebar serves one tab --------------------------------
//
// The comment on createBoundTab in sidebar.js holds the reason the sidebar
// drops a message from any other tab, and the reason it takes its tabs
// interface and its event bus as parameters.
(function boundTabSection() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const factory = sidebarSrc.match(/function createBoundTab\([\s\S]*?\n\}/);

  eq('bound tab: createBoundTab extracted from sidebar.js', !!factory, true);
  if (!factory) return;

  const createBoundTab = (isolatedFunction('return ' + factory[0] + ';'))();
  eq('bound tab: createBoundTab is a function', typeof createBoundTab, 'function');

  // A bus stub recording every subscription, so a test can deliver a message
  // on a topic with any sending tab it likes.
  function makeBus() {
    const handlers = new Map();
    return {
      subscribe(topic, handler) {
        if (!handlers.has(topic)) handlers.set(topic, []);
        handlers.get(topic).push(handler);
        return () => {};
      },
      // Deliver as the bus does: the payload, and beside it the facts the
      // carrier supplied rather than the publisher.
      deliver(topic, payload, tabId) {
        for (const h of (handlers.get(topic) || [])) h(payload, { tabId });
      },
      topicCount() { return handlers.size; },
    };
  }

  // A tabs stub. queryResult is what chrome.tabs.query answers with. An
  // activation names a window, and defaults to the window the bound tab sits
  // in, so a test that names none is switching tabs inside that window.
  function makeTabs(queryResult) {
    const listeners = [];
    const updateListeners = [];
    const removeListeners = [];
    const homeWindow = queryResult && queryResult[0] ? queryResult[0].windowId : undefined;
    return {
      query(q, cb) { cb(queryResult); },
      onActivated: { addListener: (fn) => { listeners.push(fn); } },
      onUpdated: { addListener: (fn) => { updateListeners.push(fn); } },
      onRemoved: { addListener: (fn) => { removeListeners.push(fn); } },
      activate(tabId, windowId) {
        const inWindow = windowId === undefined ? homeWindow : windowId;
        for (const fn of listeners) fn({ tabId, windowId: inWindow });
      },
      update(tabId, status) {
        for (const fn of updateListeners) fn(tabId, { status });
      },
      remove(tabId) {
        for (const fn of removeListeners) fn(tabId, { windowId: homeWindow, isWindowClosing: false });
      },
      listenerCount() { return listeners.length; },
    };
  }

  const OWN_TAB = 11;
  const OTHER_TAB = 12;
  const OWN_WINDOW = 3;
  const OTHER_WINDOW = 4;

  // --- The opening read runs after the tab is recorded, never before ---
  (function resolveOrdering() {
    const order = [];
    const tabs = {
      query(q, cb) { order.push('query'); cb([{ id: OWN_TAB, windowId: OWN_WINDOW }]); },
      onActivated: { addListener: () => {} },
    };
    const bus = makeBus();
    const boundTab = createBoundTab(tabs, bus);
    const seen = [];
    boundTab.subscribe('state:rangeOk', () => { seen.push('message'); });
    boundTab.resolve(() => { order.push('opening read'); });

    eq('bound tab: the opening read runs after the tab lookup',
      order, ['query', 'opening read']);

    // The recorded tab is read through the only thing that uses it.
    bus.deliver('state:rangeOk', {}, OWN_TAB);
    eq('bound tab: resolve records the tab the sidebar was opened for',
      seen, ['message']);
  })();

  // --- The window the bound tab sits in, for the screenshot ---
  (function windowIdAccessor() {
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), makeBus());
    const before = boundTab.windowId();
    boundTab.resolve(() => {});
    eq('bound tab: windowId() answers null before the lookup and the window after it',
      [before, boundTab.windowId()], [null, OWN_WINDOW]);
    const noWindow = createBoundTab({ query: (q, cb) => cb([{ id: OWN_TAB }]) }, makeBus());
    noWindow.resolve(() => {});
    eq('bound tab: windowId() stays null when the tabs interface reports no window',
      noWindow.windowId(), null);
  })();

  // --- The tab ID the sidebar's requests address ---
  (function tabIdAccessor() {
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), makeBus());
    const before = boundTab.tabId();
    boundTab.resolve(() => {});
    eq('bound tab: tabId() answers null before the lookup and the bound tab after it',
      [before, boundTab.tabId()], [null, OWN_TAB]);
    const noTab = createBoundTab(makeTabs([]), makeBus());
    noTab.resolve(() => {});
    eq('bound tab: tabId() stays null when there is no tab to bind to',
      noTab.tabId(), null);

    // Every request the sidebar sends addresses the bound tab.
    const calls = sidebarSrc.match(/DR_BUS\.request\('[^']+'[\s\S]*?\n  \}[^\n]*\);/g) || [];
    eq('bound tab: the sidebar sends at least one request (fails closed on a lost match)',
      calls.length > 0, true);
    eq('bound tab: every sidebar request passes the bound tab ID',
      calls.length === (sidebarSrc.match(/DR_BUS\.request\(/g) || []).length &&
        calls.every((call) => call.endsWith('}, { tabId: boundTab.tabId() });')), true);
  })();

  // No tab to bind to: the sidebar still runs its opening read, which falls
  // to the unbound state on its own when nothing answers.
  (function resolveWithNoActiveTab() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([]), bus);
    const seen = [];
    boundTab.subscribe('state:rangeOk', () => { seen.push('message'); });
    let ran = false;
    boundTab.resolve(() => { ran = true; });

    eq('bound tab: no active tab still runs the opening read', ran, true);

    bus.deliver('state:rangeOk', {}, OWN_TAB);
    eq('bound tab: with no tab recorded every message is dropped', seen, []);
  })();

  // --- A message is acted on only when it came from the bound tab ---
  (function messagesAreFiltered() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), bus);
    boundTab.resolve(() => {});

    const seen = [];
    boundTab.subscribe('state:rangeError', (payload) => { seen.push(payload); });

    bus.deliver('state:rangeError', { from: 'own' }, OWN_TAB);
    eq('bound tab: a message from the bound tab reaches its handler',
      seen, [{ from: 'own' }]);

    bus.deliver('state:rangeError', { from: 'other' }, OTHER_TAB);
    eq('bound tab: a message from another tab is dropped',
      seen, [{ from: 'own' }]);

    // An extension page has no tab. Nothing a content script sends looks
    // like this, and a message that does belongs to no tab at all.
    bus.deliver('state:rangeError', { from: 'an extension page' }, null);
    eq('bound tab: a message carrying no tab is dropped',
      seen, [{ from: 'own' }]);
  })();

  // The window between the sidebar opening and its tab lookup answering.
  // Nothing can be compared yet, so nothing is acted on; the opening read
  // that follows carries the current truth.
  (function messagesBeforeTheTabResolves() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), bus);
    const seen = [];
    boundTab.subscribe('state:previewSamplesChanged', (payload) => { seen.push(payload); });

    bus.deliver('state:previewSamplesChanged', { early: true }, OWN_TAB);
    eq('bound tab: a message arriving before the tab lookup answers is dropped',
      seen, []);

    boundTab.resolve(() => {});
    bus.deliver('state:previewSamplesChanged', { early: false }, OWN_TAB);
    eq('bound tab: messages are acted on once the tab lookup has answered',
      seen, [{ early: false }]);
  })();

  // --- Leaving the bound tab ---
  //
  // The sidebar's own listeners are the one close path on a tab switch, a
  // reload, and a tab close: the service worker holds no tab listener.
  (function closesOnSwitchAway() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onLeave(() => { closes++; });

    tabs.activate(OWN_TAB);
    eq('bound tab: staying on the bound tab does not close the sidebar', closes, 0);

    tabs.activate(OTHER_TAB);
    eq('bound tab: switching to another tab closes the sidebar', closes, 1);
  })();

  // A side panel belongs to one browser window, and the activation event
  // fires for every window. An activation in a second window leaves the bound
  // tab where it was — still the front tab of its own window — so closing on
  // it would take the sidebar away from a user who never left its page.
  (function activationInAnotherWindow() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onLeave(() => { closes++; });

    tabs.activate(OTHER_TAB, OTHER_WINDOW);
    eq('bound tab: an activation in another window does not close the sidebar', closes, 0);

    tabs.activate(OTHER_TAB, OWN_WINDOW);
    eq('bound tab: an activation in the bound tab\'s own window closes it', closes, 1);
  })();

  // Each sidebar listens for its own bound tab's events, so a reload in one
  // window never closes a sidebar in another.
  (function closesOnReload() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onLeave(() => { closes++; });

    tabs.update(OTHER_TAB, 'loading');
    eq('bound tab: another tab starting to load does not close the sidebar', closes, 0);

    tabs.update(OWN_TAB, 'complete');
    eq('bound tab: the bound tab finishing a load does not close the sidebar', closes, 0);

    tabs.update(OWN_TAB, 'loading');
    eq('bound tab: the bound tab starting to load closes the sidebar', closes, 1);
  })();

  (function closesOnRemoval() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onLeave(() => { closes++; });

    tabs.remove(OTHER_TAB);
    eq('bound tab: removing another tab does not close the sidebar', closes, 0);

    tabs.remove(OWN_TAB);
    eq('bound tab: removing the bound tab closes the sidebar', closes, 1);
  })();

  // With no tab recorded there is nothing to have left, and closing on the
  // next switch would take the sidebar away for a reason it cannot state.
  (function noBoundTabNeverCloses() {
    const tabs = makeTabs([]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onLeave(() => { closes++; });

    tabs.activate(OTHER_TAB);
    eq('bound tab: with no tab recorded a switch does not close the sidebar', closes, 0);
  })();

  // A tabs interface with no activation event must not throw. The sidebar
  // then never closes itself.
  (function noActivationEvent() {
    const bus = makeBus();
    const boundTab = createBoundTab({ query: (q, cb) => cb([{ id: OWN_TAB }]) }, bus);
    boundTab.resolve(() => {});

    let threw = false;
    try { boundTab.onLeave(() => {}); } catch (e) { threw = true; }
    eq('bound tab: a tabs interface with no activation event does not throw', threw, false);

    // Messages still reach the sidebar; only the self-close is missing.
    const seen = [];
    boundTab.subscribe('state:rangeOk', () => { seen.push('message'); });
    bus.deliver('state:rangeOk', {}, OWN_TAB);
    eq('bound tab: messages still reach the sidebar with no activation event',
      seen, ['message']);
  })();

  // --- Every content-script message goes through the gate ---
  //
  // The list is derived, never restated: a topic qualifies when the bus lists
  // it, the content script publishes it, and the sidebar subscribes it. A
  // topic added later joins this check with no edit here. The count assertion
  // makes the scan fail closed, so a regex that matches nothing cannot read
  // as a pass.
  (function everyContentMessageIsGated() {
    const contentSrc = sourceByName('content.js');
    eq('bound tab: the content script source is readable (fails closed on a rename)',
      typeof contentSrc, 'string');
    if (typeof contentSrc !== 'string') return;
    const publishes = (src, topic) => new RegExp("publish\\(\\s*'" + topic + "'").test(src);
    const gated = (src, topic) => new RegExp("boundTab\\.subscribe\\(\\s*'" + topic + "'").test(src);
    const ungated = (src, topic) => new RegExp("DR_BUS\\.subscribe\\(\\s*'" + topic + "'").test(src);

    const contentMessages = Object.keys(DR_BUS.TOPICS).filter((topic) =>
      publishes(contentSrc, topic) && (gated(sidebarSrc, topic) || ungated(sidebarSrc, topic)));

    eq('bound tab: the scan found content-script messages the sidebar subscribes (fails closed on an empty list)',
      contentMessages.length > 0, true);
    eq('bound tab: every content-script message the sidebar subscribes goes through the bound-tab gate',
      contentMessages.filter((topic) => ungated(sidebarSrc, topic)), []);
  })();
})();

// ---------------------------------------------------------------------------
// Two key lists leave the sidebar and have readers elsewhere: the settings the
// sidebar sends, read against the settings contract, and the capture's sidebar
// snapshot, read by the capture renderer. Each expected list is derived from its
// reader, so a renamed key fails here and a new key needs no edit here.
// ---------------------------------------------------------------------------
(function sidebarKeysMatchTheirReaders() {
  const h = makeIssue251SidebarHarness({ captureMarks: ['looks-wrong'] });
  const renderSrc = sourceByName('lib/dr-capture/render.js');
  if (!h || typeof renderSrc !== 'string') {
    eq('sidebar snapshot keys: the sidebar harness and the capture renderer source are available', false, true);
    return;
  }
  const savedBuild = DR_CAPTURE.buildCaptureDocument;
  const savedWarn = DR_LOG.warn;
  try {
    eq('sidebar snapshot keys: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.enabledEl.fire('change');
    const applies = h.tabMessages.filter((msg) => msg.topic === 'request:applySettings');
    eq('settings keys: a sidebar pillbox change sends one settings request', applies.length, 1);
    if (applies.length !== 1) return;
    eq('settings keys: the sent settings hold exactly the settings contract\'s keys',
      Object.keys(applies[0].settings).sort(), Object.keys(DR_DEFAULTS).sort());

    let sidebarSnapshot = null;
    DR_CAPTURE.buildCaptureDocument = (input) => {
      sidebarSnapshot = input.state.sidebarSnapshot;
      throw new Error('stop before the file save');
    };
    h.chromeMock.runtime.getManifest = () => ({ version: '0' });
    // The stub tab takes no screenshot and the stub renderer throws, and each
    // writes a warn row the suite's row listener would draw as a toast.
    DR_LOG.warn = () => {};
    h.captureMarkEls[0].fire('click');
    h.el('captureSave').fire('click');
    eq('sidebar snapshot keys: the finish press hands the renderer a sidebar snapshot',
      sidebarSnapshot !== null && typeof sidebarSnapshot === 'object', true);
    if (!sidebarSnapshot) return;

    const readKeys = (pattern) => Array.from(new Set(
      Array.from(renderSrc.matchAll(pattern), (match) => match[1]))).sort();
    const snapshotKeysRead = readKeys(/\bsidebarSnapshot\.(\w+)/g);
    const lensKeysRead = readKeys(/\blens\.(\w+)/g);
    eq('sidebar snapshot keys: the scan found keys the renderer reads (fails closed on an empty list)',
      snapshotKeysRead.length > 0 && lensKeysRead.length > 0, true);
    eq('sidebar snapshot keys: the sidebar snapshot holds every key the renderer reads',
      snapshotKeysRead.filter((key) => !(key in sidebarSnapshot)), []);
    eq('sidebar snapshot keys: the sidebar snapshot\'s lens preview holds every key the renderer reads',
      lensKeysRead.filter((key) => !(key in (sidebarSnapshot.lensPreview || {}))), []);
    eq('sidebar snapshot: a finish on a sidebar bound to a table records bound as true',
      sidebarSnapshot.bound, true);

    answerActiveTableRead(h, { settings: DR_DEFAULTS, samples: null, maxMag: null });
    h.dispatch({ topic: 'state:tableSwitched' });
    sidebarSnapshot = null;
    // The stub renderer's throw leaves the form open with its mark set.
    h.el('captureSave').fire('click');
    eq('sidebar snapshot: a finish on an unbound sidebar records bound as false',
      sidebarSnapshot && sidebarSnapshot.bound, false);
  } finally {
    DR_CAPTURE.buildCaptureDocument = savedBuild;
    DR_LOG.warn = savedWarn;
    h.restore();
  }
})();

// ---------------------------------------------------------------------------
// A click on the sidebar sends a settings write only through a control's own
// change or input handler. Chrome dispatches a click on a switch's label to
// the body with the label as its target, then dispatches a second click on
// the input and fires the input's change; the change alone carries the write.
// ---------------------------------------------------------------------------
const SIDEBAR_UNBOUND_PROMPT = 'Right-click a table to connect it here.';

(function sidebarBodyClickSendsNoSettingsWrite() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('body click: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('body click: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    h.tabMessages.length = 0;
    h.fireBody('click', { target: sidebarEventTarget('SPAN') });
    eq('body click: a click on the sidebar outside any control sends no settings write',
      h.tabMessages.filter((m) => m.topic === 'request:applySettings').length, 0);
  } finally {
    h.restore();
  }
})();

(function sidebarSwitchLabelClickSendsOneSettingsWrite() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('label click: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('label click: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    const input = sidebarEventTarget('INPUT', h.el('simplifyDates'));
    h.tabMessages.length = 0;
    h.fireBody('click', { target: sidebarEventTarget('LABEL') });
    input.checked = !input.checked;
    h.fireBody('click', { target: input });
    input.fire('change');
    eq('label click: a click on a switch\'s label sends one settings write, from the change',
      h.tabMessages.filter((m) => m.topic === 'request:applySettings').length, 1);
  } finally {
    h.restore();
  }
})();

(function sidebarBodyClickKeepsTheUnboundPrompt() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('unbound body click: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('unbound body click: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    // A content script with no active table answers every read with the
    // shipped defaults and null samples, and answers a settings write.
    const answerWrite = h.chromeMock.tabs.sendMessage;
    h.chromeMock.tabs.sendMessage = (tabId, msg, cb) => {
      if (msg.topic === 'request:applySettings') return answerWrite(tabId, msg, cb);
      h.tabMessages.push(msg);
      cb({ settings: DR_DEFAULTS, samples: null, maxMag: null });
    };
    h.dispatch({ topic: 'state:tableSwitched' });
    eq('unbound body click: precondition — the status line shows the unbound prompt',
      h.statusEl.textContent, SIDEBAR_UNBOUND_PROMPT);

    h.fireBody('click', { target: sidebarEventTarget('SPAN') });
    eq('unbound body click: a click on the body leaves the unbound prompt on the status line',
      h.statusEl.textContent, SIDEBAR_UNBOUND_PROMPT);
  } finally {
    h.restore();
  }
})();

(function lensControlKeyboardRecoupling() {
  const h = makeIssue251SidebarHarness();
  if (!h) {
    eq('lens keyboard: source files (defaults/rounding/reader/bus) present in manifest', false, true);
    return;
  }
  try {
    eq('lens keyboard: sidebar.js loaded with no stub gaps', h.evalError, null);
    if (h.evalError !== null) return;

    const topThumb = h.el('topThumb');
    const otherThumb = h.el('otherThumb');
    const press = (thumb, key) => thumb.fire('keydown', { key, preventDefault() {} });
    const writeCount = () => h.tabMessages.filter((m) => m.topic === 'request:applySettings').length;

    for (let i = 0; i < 12; i++) press(topThumb, 'ArrowLeft');
    eq('lens keyboard: both thumbs rest at the low end after the top thumb is pressed left',
      otherThumb.style.left, topThumb.style.left);
    eq('lens keyboard: the thumbs rest on the first stop after the top thumb is pressed left',
      topThumb.style.left, (0.5 / 9 * 100) + '%');

    press(otherThumb, 'ArrowLeft');
    press(topThumb, 'ArrowRight');
    eq('lens keyboard: after the other thumb is pressed left at the low end, the top thumb moves it too',
      otherThumb.style.left, topThumb.style.left);

    const before = writeCount();
    press(otherThumb, 'ArrowLeft');
    const beforeRematch = writeCount();
    press(otherThumb, 'ArrowRight');
    eq('lens keyboard: one press of the other thumb sends one settings write',
      beforeRematch - before, 1);
    eq('lens keyboard: a press that brings the other thumb level with the top thumb sends one settings write',
      writeCount() - beforeRematch, 1);
  } finally {
    h.restore();
  }
})();
