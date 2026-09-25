// ---------------------------------------------------------------------------
// Sprint advanced-preview-redesign
// AC1: formatOomLabel exhaustive suffix-boundary check
// AC2: formatStrategyHeader structure + "(i.e. …)" clause correctness
// AC3: renderBotBand DESCENDING sort (real DOM-stub eval)
// AC4: step-label CSS classes (step top / step bot)
// Adversarial: sort-mutation side-effect check
// ---------------------------------------------------------------------------
(function advancedPreviewRedesignTests() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // -------------------------------------------------------------------------
  // Extract formatOomLabel and formatStrategyHeader from sidebar.js source.
  // They depend on trimNum (from rounding.js), stepForOffset and formatStep
  // (also rounding.js).  We pass them as parameters to new Function.
  // -------------------------------------------------------------------------
  const constBlock = sidebarSrc.match(
    /const OOM_LABEL_CLASS\s*=[\s\S]*?const STRATEGY_CLASS\s*=.*?;/
  );
  const formatOomLabelFn = sidebarSrc.match(
    /function formatOomLabel\([\s\S]*?\n\}/
  );
  const formatStrategyHeaderFn = sidebarSrc.match(
    /function formatStrategyHeader\([\s\S]*?\n\}/
  );

  if (!constBlock || !formatOomLabelFn || !formatStrategyHeaderFn) {
    eq('sidebar-ap-extract: able to extract formatOomLabel + formatStrategyHeader', false, true);
    return;
  }

  // Build a helper bundle: rounding helpers + sidebar functions.
  // stepForOffset, formatStep, trimNum come from rounding.js (already evaled
  // into the test scope's globalThis; we pass them in to avoid scope issues).
  const apHelperSrc = '(function(trimNum, stepForOffset, formatStep) {\n' +
    constBlock[0] + '\n' +
    formatOomLabelFn[0] + '\n' +
    formatStrategyHeaderFn[0] + '\n' +
    'return { formatOomLabel: formatOomLabel, formatStrategyHeader: formatStrategyHeader };\n' +
    '})(trimNum, stepForOffset, formatStep)';

  let apHelpers;
  try {
    apHelpers = (new Function('trimNum', 'stepForOffset', 'formatStep',
      'return ' + apHelperSrc + ';'
    ))(trimNum, stepForOffset, formatStep);
  } catch (e) {
    eq('sidebar-ap-extract: new Function eval succeeded', false, true);
    return;
  }

  const fmtOom = apHelpers.formatOomLabel;
  const fmtHdr = apHelpers.formatStrategyHeader;

  eq('ap-extract: formatOomLabel is a function', typeof fmtOom, 'function');
  eq('ap-extract: formatStrategyHeader is a function', typeof fmtHdr, 'function');

  // -------------------------------------------------------------------------
  // AC1: Exhaustive formatOomLabel mapping for mag = 9,8,7,6,5,4,3,2,1,0,-1,-2
  // Expected values derived from the spec pattern (10^mag with k/M/B suffix),
  // NOT from reading the implementation.
  // -------------------------------------------------------------------------
  // Suffix boundaries: mag 9 → 1B+, mag 6 → 1M+, mag 3 → 1k+
  eq('AC1-oom: mag=9 → "1B+" (1e9 boundary)', fmtOom(9), '1B+');
  eq('AC1-oom: mag=8 → "100M+" (within B range, 1e8=100M)', fmtOom(8), '100M+');
  eq('AC1-oom: mag=7 → "10M+" (within M range, 1e7=10M)', fmtOom(7), '10M+');
  eq('AC1-oom: mag=6 → "1M+" (1e6 boundary)', fmtOom(6), '1M+');
  eq('AC1-oom: mag=5 → "100k+" (within k range, 1e5=100k)', fmtOom(5), '100k+');
  eq('AC1-oom: mag=4 → "10k+" (within k range, 1e4=10k)', fmtOom(4), '10k+');
  eq('AC1-oom: mag=3 → "1k+" (1e3 boundary)', fmtOom(3), '1k+');
  eq('AC1-oom: mag=2 → "100+" (1e2, no suffix)', fmtOom(2), '100+');
  eq('AC1-oom: mag=1 → "10+" (1e1, no suffix)', fmtOom(1), '10+');
  eq('AC1-oom: mag=0 → "1+" (1e0=1, no suffix)', fmtOom(0), '1+');
  eq('AC1-oom: mag=-1 → "0.1+" (sub-unit, 1e-1=0.1)', fmtOom(-1), '0.1+');
  eq('AC1-oom: mag=-2 → "0.01+" (sub-unit, 1e-2=0.01)', fmtOom(-2), '0.01+');

  // -------------------------------------------------------------------------
  // AC2: formatStrategyHeader structure. Per issue #1 the descriptive
  // "(i.e. a half of 1M)" clause was removed — the header is now exactly
  // "<oomLabel> → nearest <stepLabel>" with no clause, for every stop.
  // We derive the expected step independently via stepForOffset/formatStep.
  // -------------------------------------------------------------------------

  // Scenario A: maxMag=5, offset=-0.5 → step=50k.
  (function hdrScenarioA() {
    const maxMag = 5; const offset = -0.5;
    const oomVal = Math.pow(10, maxMag);        // 100000
    const stepLabel = formatStep(stepForOffset(oomVal, offset)); // '50k'
    const header = fmtHdr(maxMag, offset);
    eq('AC2-A: header is exactly "100k+ → nearest 50k"',
      header, '100k+ → nearest ' + stepLabel);
    eq('AC2-A: header has no "(i.e." clause', header.includes('(i.e.'), false);
  })();

  // Scenario B: maxMag=3, offset=-0.5 → step=500.
  (function hdrScenarioB() {
    const maxMag = 3; const offset = -0.5;
    const stepLabel = formatStep(stepForOffset(Math.pow(10, maxMag), offset)); // '500'
    const header = fmtHdr(maxMag, offset);
    eq('AC2-B: header is exactly "1k+ → nearest 500"',
      header, '1k+ → nearest ' + stepLabel);
    eq('AC2-B: header has no clause', header.includes('(i.e.'), false);
  })();

  // -------------------------------------------------------------------------
  // AC2-ALL-STOPS: All 11 slider stops × 2 maxMag values. The header is always
  // exactly "<oomLabel> → nearest <stepLabel>" with the step derived from the
  // real stepForOffset/formatStep, and never contains a "(i.e." clause or a
  // "×" multiplier.
  // -------------------------------------------------------------------------
  (function hdrAllStops() {
    const stops = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
    const testMags = [6, 5]; // 1M and 100k

    for (const mag of testMags) {
      const oomVal = Math.pow(10, mag);
      const oomLabel = fmtOom(mag);
      for (const offset of stops) {
        const tag = 'AC2-ALL mag=' + mag + ' offset=' + offset;
        const stepLabel = formatStep(stepForOffset(oomVal, offset));
        const header = fmtHdr(mag, offset);
        eq(tag + ': header is exactly "' + oomLabel + ' → nearest ' + stepLabel + '"',
          header, oomLabel + ' → nearest ' + stepLabel);
        eq(tag + ': no "(i.e." clause', header.includes('(i.e.'), false);
        eq(tag + ': no "×" multiplier', header.includes('×'), false);
      }
    }
  })();

  // -------------------------------------------------------------------------
  // AC2-STRATEGY-MONOTONIC: the slider stops must be ordered so the resulting
  // rounding STEP changes in a single direction across the track. This is the
  // whole point of the stop ordering: stepForOffset is non-monotonic in the
  // offset value (half-steps interleave with integer steps), so the array order
  // — not numeric sort — is what guarantees a one-directional strategy sweep.
  // Read STOPS straight from sidebar.js and assert step() is strictly
  // increasing across it for several magnitudes.
  // -------------------------------------------------------------------------
  (function strategyMonotonic() {
    const src = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
    const m = src.match(/const STOPS\s*=\s*\[([^\]]*)\]/);
    if (!m) {
      eq('AC2-mono: STOPS array found in sidebar.js', false, true);
      return;
    }
    const STOPS = m[1].split(',').map((s) => parseFloat(s.trim()));
    eq('AC2-mono: STOPS has 9 stops', STOPS.length, 9);

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
      eq('AC2-mono mag=' + mag + ': step() strictly increases across STOPS' +
        (firstBreak ? ' [break at ' + firstBreak + ']' : ''), monotonic, true);
    }

    // Spot-check the exact step sweep at mag 6 against the worked example.
    const expectAtMag6 = [10e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6];
    STOPS.forEach((offset, i) => {
      eq('AC2-mono mag=6: offset ' + offset + ' → step ' + expectAtMag6[i],
        stepForOffset(1e6, offset), expectAtMag6[i]);
    });
  })();

  // -------------------------------------------------------------------------
  // AC3: renderBotBand DESCENDING sort by magnitude.
  // Extract renderBotBand from sidebar.js, provide DOM stubs, call with rows
  // in ASCENDING order, assert rendered order is DESCENDING.
  // Also check for sort-mutation side-effect on the caller's array.
  // -------------------------------------------------------------------------
  const renderBotBandFn = sidebarSrc.match(
    /function renderBotBand\([\s\S]*?\n\}/
  );
  const renderTopBandFn = sidebarSrc.match(
    /function renderTopBand\([\s\S]*?\n\}/
  );

  if (!renderBotBandFn || !renderTopBandFn) {
    eq('sidebar-ap-extract: able to extract renderBotBand + renderTopBand', false, true);
    return;
  }

  // Build a minimal DOM stub sufficient for renderBotBand.
  // We collect appended children in order so we can inspect the render sequence.
  function makeEl(tag) {
    const children = [];
    const el = {
      _tag: tag,
      _children: children,
      _classNames: [],
      className: '',
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

  // Extract the sidebar consts and render functions + their helpers.
  // We need: STEP_CLASS_TOP/BOT, OOM_LABEL_CLASS, STRATEGY_CLASS,
  //          formatOomLabel, formatStrategyHeader, renderTopBand, renderBotBand.
  // External deps we pass in: formatOriginal, roundWithOffset, stepForOffset,
  //                            formatStep, cachedMaxMag (null = no strategy header).
  const renderSrc = '(function(document, formatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, cachedMaxMag) {\n' +
    constBlock[0] + '\n' +
    formatOomLabelFn[0] + '\n' +
    formatStrategyHeaderFn[0] + '\n' +
    renderTopBandFn[0] + '\n' +
    renderBotBandFn[0] + '\n' +
    'return { renderBotBand: renderBotBand, renderTopBand: renderTopBand };\n' +
    '})';

  let renderHelpers;
  let realFormatOriginal;
  try {
    // We need formatOriginal from the already-evaled sidebar helpers.
    // However, formatOriginal in sidebar.js depends on toNumber (from content.js,
    // already on globalThis). Extract it from sidebar.js source.
    const sidebarConstBlock2 = sidebarSrc.match(
      /const PREVIEW_DECIMAL_THRESHOLD\s*=.*?;\s*const PREVIEW_MAX_DECIMALS\s*=.*?;/
    );
    const fmtCommasFn2 = sidebarSrc.match(/function formatNumberWithCommas\([\s\S]*?\n\}/);
    const formatOriginalFn2 = sidebarSrc.match(/function formatOriginal\([\s\S]*?\n\}/);

    const fmtOrigSrc = '(function(toNumber) {\n' +
      sidebarConstBlock2[0] + '\n' +
      fmtCommasFn2[0] + '\n' +
      formatOriginalFn2[0] + '\n' +
      'return formatOriginal;\n' +
      '})(toNumber)';
    realFormatOriginal = (new Function('toNumber', 'return ' + fmtOrigSrc + ';'))(toNumber);

    renderHelpers = (new Function(
      'document', 'formatOriginal', 'roundWithOffset', 'stepForOffset',
      'formatStep', 'trimNum', 'cachedMaxMag',
      'return ' + renderSrc + '(document, formatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, cachedMaxMag);'
    ))(stubDocument, realFormatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, null);
  } catch (e) {
    eq('sidebar-ap-extract: renderBotBand eval succeeded', String(e), '');
    return;
  }

  const realRenderBotBand = renderHelpers.renderBotBand;
  const realRenderTopBand = renderHelpers.renderTopBand;

  eq('ap-extract: renderBotBand is a function', typeof realRenderBotBand, 'function');
  eq('ap-extract: renderTopBand is a function', typeof realRenderTopBand, 'function');

  // Rows fed in ASCENDING magnitude order: 50 (mag=1), 500 (mag=2), 5000 (mag=3), 50000 (mag=4)
  const rowsAscending = [
    { num: 50,    original: '50' },
    { num: 500,   original: '500' },
    { num: 5000,  original: '5,000' },
    { num: 50000, original: '50,000' },
  ];
  // Deep-copy original array reference so we can check mutation.
  const originalArray = rowsAscending.slice();

  const bandEl = makeBandEl();
  realRenderBotBand(bandEl, rowsAscending, -0.5, 4);

  // The band container should have 4 "pair" div children.
  eq('AC3-sort: renderBotBand appended 4 pair elements', bandEl._appended.length, 4);

  // Each pair div contains children: from-span, arrow-span, num-span, step-span.
  // The from-span's textContent reflects the original number.
  // We can extract the rendered order by reading from-span textContent on each pair.
  function getFromText(pairEl) {
    // first child is the "from" span
    return pairEl._children[0] ? pairEl._children[0].textContent : '';
  }

  const renderedFromTexts = bandEl._appended.map(getFromText);
  // Expected descending order: 50,000 first, then 5,000, 500, 50
  eq('AC3-sort: first rendered row is highest magnitude (50,000)',
    renderedFromTexts[0], '50,000');
  eq('AC3-sort: second rendered row is next (5,000)',
    renderedFromTexts[1], '5,000');
  eq('AC3-sort: third rendered row (500)',
    renderedFromTexts[2], '500');
  eq('AC3-sort: fourth rendered row is lowest magnitude (50)',
    renderedFromTexts[3], '50');

  // -------------------------------------------------------------------------
  // Adversarial: sort-mutation check.
  // renderBotBand uses rows.slice().sort(...) which must NOT mutate the caller's
  // array. If it sorts in place, cachedSamples would be corrupted across renders.
  // -------------------------------------------------------------------------
  eq('AC3-mutation: renderBotBand does NOT mutate caller rows[0] (still 50 after render)',
    rowsAscending[0].num, 50);
  eq('AC3-mutation: renderBotBand does NOT mutate caller rows[3] (still 50000 after render)',
    rowsAscending[3].num, 50000);
  // Belt-and-suspenders: the entire original order is preserved.
  const originalNums = originalArray.map(r => r.num);
  const afterNums = rowsAscending.map(r => r.num);
  eq('AC3-mutation: full array order unchanged after renderBotBand',
    afterNums, originalNums);

  // -------------------------------------------------------------------------
  // AC3-edge: zero rows and null el guard
  // -------------------------------------------------------------------------
  const emptyEl = makeBandEl();
  realRenderBotBand(emptyEl, [], -0.5, 0);
  eq('AC3-edge: empty rows renders nothing', emptyEl._appended.length, 0);

  realRenderBotBand(null, rowsAscending, -0.5, 4); // should not throw
  eq('AC3-edge: null el is a no-op (no throw)', true, true);

  // -------------------------------------------------------------------------
  // AC4: bottom-band examples carry a brown trailing step label "(5k)" after
  // the rounded number, showing what the example rounds to the nearest of. The
  // pair still has three cells (from, arrow, num); the step span lives INSIDE
  // the num span (a 4th grid child would wrap to the next row). The top example
  // keeps its three cells and is prefixed "e.g.".
  // -------------------------------------------------------------------------

  // AC4a: bottom band pair has 3 cells (from/arrow/num); the brown step label
  // is nested in the num span, not a 4th grid child.
  const botBandEl2 = makeBandEl();
  realRenderBotBand(botBandEl2, [{ num: 1000, original: '1,000' }], -0.5, 3);
  eq('AC4-bot: bottom example pair has exactly 3 cells (from/arrow/num)',
    botBandEl2._appended[0]._children.length, 3);
  const botNumSpan = botBandEl2._appended[0]._children[2];
  eq('AC4-bot: num span has a nested step-label child',
    botNumSpan._children.length, 1);
  eq('AC4-bot: step-label child has class "step-label"',
    botNumSpan._children[0] ? botNumSpan._children[0].className : '', 'step-label');
  // 1,000 at offset -0.5 rounds to the nearest 500 → label "(500)".
  eq('AC4-bot: step-label text is " (500)"',
    botNumSpan._children[0] ? botNumSpan._children[0].textContent : '', ' (500)');

  // AC4a-zero: a zero row gets no step label (avoids "(0)").
  const botZeroEl = makeBandEl();
  realRenderBotBand(botZeroEl, [{ num: 0, original: '0' }], -0.5, 3);
  const zeroNumSpan = botZeroEl._appended[0]._children[2];
  eq('AC4-bot-zero: zero row num span has no step-label child',
    zeroNumSpan._children.length, 0);

  // AC4b: top band example pair is prefixed "e.g." and has no step label.
  // renderTopBand with cachedMaxMag=null skips the strategy header, so the only
  // appended element is the example.
  const topBandEl2 = makeBandEl();
  realRenderTopBand(topBandEl2, [{ num: 100000, original: '100,000' }], -0.5);
  eq('AC4-top: top band appended exactly one element (no header)',
    topBandEl2._appended.length, 1);
  const topExamplePair = topBandEl2._appended[0];
  eq('AC4-top: top example has exactly 3 cells (from/arrow/num, no step)',
    topExamplePair._children.length, 3);
  eq('AC4-top: top example "from" is prefixed "e.g."',
    topExamplePair._children[0].textContent, 'e.g. 100,000');
  // Top-band num cell carries no nested step label.
  eq('AC4-top: top example num cell has no nested step label',
    topExamplePair._children[2]._children.length, 0);

  // AC4-strip (issue #3): the "from" shows the bare number, not the original
  // surrounding text. renderTopBand keys off row.num, so a row whose original
  // was "₹2,000 crore" still renders just "e.g. 2,000".
  const stripBandEl = makeBandEl();
  realRenderTopBand(stripBandEl, [{ num: 2000, original: '₹2,000 crore' }], -0.5);
  eq('AC4-strip: top "from" strips surrounding text to bare "e.g. 2,000"',
    stripBandEl._appended[0]._children[0].textContent, 'e.g. 2,000');

  // AC4c: source-level constant values are correct (structural). The step-class
  // constants were removed; the OoM-label and strategy classes remain.
  eq('AC4-src: STEP_CLASS_TOP constant removed from source',
    /const STEP_CLASS_TOP\b/.test(sidebarSrc), false);
  eq('AC4-src: STEP_CLASS_BOT constant removed from source',
    /const STEP_CLASS_BOT\b/.test(sidebarSrc), false);
  eq('AC4-src: OOM_LABEL_CLASS constant is "oom-label" in source',
    /const OOM_LABEL_CLASS\s*=\s*['"]oom-label['"]/.test(sidebarSrc), true);
  eq('AC4-src: STRATEGY_CLASS constant is "strategy" in source',
    /const STRATEGY_CLASS\s*=\s*['"]strategy['"]/.test(sidebarSrc), true);
  eq('AC4-src: STEP_LABEL_CLASS constant is "step-label" in source',
    /const STEP_LABEL_CLASS\s*=\s*['"]step-label['"]/.test(sidebarSrc), true);

  // AC4e: when cachedMaxMag is set, the top band renders the strategy line AND
  // the example as two from|arrow|num pairs in the same band container (the
  // #topBand grid lays them on two lines with their "→" arrows aligned in the
  // middle column). Rebuild the render helpers with a non-null cachedMaxMag to
  // exercise the header path.
  let renderHelpersWithMag;
  try {
    renderHelpersWithMag = (new Function(
      'document', 'formatOriginal', 'roundWithOffset', 'stepForOffset',
      'formatStep', 'trimNum', 'cachedMaxMag',
      'return ' + renderSrc + '(document, formatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, cachedMaxMag);'
    ))(stubDocument, realFormatOriginal, roundWithOffset, stepForOffset, formatStep, trimNum, 6);
  } catch (e) {
    eq('AC4e: renderTopBand (cachedMaxMag=6) eval succeeded', String(e), '');
  }
  if (renderHelpersWithMag) {
    const topWithHdr = makeBandEl();
    renderHelpersWithMag.renderTopBand(topWithHdr, [{ num: 8584629, original: '8,584,629' }], -0.5);
    eq('AC4e: top band appends 2 elements (strategy line + example)',
      topWithHdr._appended.length, 2);
    const stratPair = topWithHdr._appended[0];
    const examplePair = topWithHdr._appended[1];
    eq('AC4e: first appended element is the strategy pair (class "pair strategy")',
      stratPair.className, 'pair strategy');
    eq('AC4e: strategy pair has 3 cells (from/arrow/num)',
      stratPair._children.length, 3);
    eq('AC4e: strategy "from" is the OoM label "1M+" (maxMag=6)',
      stratPair._children[0].textContent, '1M+');
    eq('AC4e: strategy "num" starts "nearest "',
      stratPair._children[2].textContent.indexOf('nearest ') === 0, true);
    eq('AC4e: second appended element is the example pair (class "pair example")',
      examplePair.className, 'pair example');
    eq('AC4e: example pair has 3 cells (from/arrow/num)',
      examplePair._children.length, 3);
    // The two "→" arrows sit in the same (middle) grid column so they align.
    eq('AC4e: strategy arrow is in the middle cell ("→")',
      stratPair._children[1].textContent, '→');
    eq('AC4e: example arrow is in the middle cell ("→")',
      examplePair._children[1].textContent, '→');
  }

  // AC4f: sidebar.html lays the top band out on the shared results-band grid
  // (no flex override), so the strategy line and the example line stack and
  // their "→" arrows align in the middle column. The strategy cells are blue.
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('AC4f: #topBand element carries the results-band grid class',
    /<div[^>]*id="topBand"[^>]*class="results-band"|<div[^>]*class="results-band"[^>]*id="topBand"/.test(sidebarHtmlSrc), true);
  eq('AC4f: #topBand is NOT overridden to display:flex',
    /#topBand\s*\{[^}]*display:\s*flex/.test(sidebarHtmlSrc), false);
  eq('AC4f: #topBand strategy cells are blue (#1a73e8)',
    /#topBand \.strategy \.num\s*\{\s*color:\s*#1a73e8/.test(sidebarHtmlSrc), true);
  eq('AC4f: .step-label colour rule present in sidebar.html',
    /\.step-label\s*\{\s*color:\s*#b3623d/.test(sidebarHtmlSrc), true);

  // AC4d: oom-label span is still appended inside the from-span for non-zero
  // rows of the bottom band (kept per the issue #3 decision).
  const oomLabelBandEl = makeBandEl();
  realRenderBotBand(oomLabelBandEl, [{ num: 5000, original: '5,000' }], -0.5, 3);
  const fromSpan = oomLabelBandEl._appended[0]._children[0];
  eq('AC4-oom-label: from-span has oom-label child appended',
    fromSpan._children.length >= 1, true);
  eq('AC4-oom-label: oom-label child has class "oom-label"',
    fromSpan._children[0] ? fromSpan._children[0].className : '', 'oom-label');
  eq('AC4-oom-label: oom-label text contains "(1k+)"',
    fromSpan._children[0] ? fromSpan._children[0].textContent.includes('1k+') : false, true);

  // -------------------------------------------------------------------------
  // AC5: renderBand removed, renderTopBand + renderBotBand present in source
  // -------------------------------------------------------------------------
  eq('AC5-structure: renderBand is removed from sidebar.js source',
    /function renderBand\b/.test(sidebarSrc), false);
  eq('AC5-structure: renderTopBand is defined in sidebar.js source',
    /function renderTopBand\b/.test(sidebarSrc), true);
  eq('AC5-structure: renderBotBand is defined in sidebar.js source',
    /function renderBotBand\b/.test(sidebarSrc), true);
  eq('AC5-structure: renderPreviewBands calls renderTopBand',
    /renderTopBand\(/.test(sidebarSrc), true);
  eq('AC5-structure: renderPreviewBands calls renderBotBand',
    /renderBotBand\(/.test(sidebarSrc), true);
})();


// ---------------------------------------------------------------------------
// Sprint sidebar-no-table-state
// Tests for the "no table bound" state in sidebar.js.
//
// sidebar.js cannot be eval'd wholesale without a full browser DOM, but we
// can:
//   (a) eval just the setTableBound function with minimal stubs, and
//   (b) read sidebar.js / sidebar.html source for static assertions.
//
// AC1 – init state: body gets no-table class, #status reads the prompt message.
// AC2 – bound state: setTableBound(true) removes no-table; also check that
//        state:previewSamplesChanged triggers the settings pull whose chain ends
//        in fetchPreviewSamples (the only live-rebind path) — note this means
//        the sidebar does NOT listen for a separate SET_TABLE_BOUND message;
//        see gap note below.
// AC3 – old error string is gone from sidebar.js.
// AC4 – sidebar.html CSS disables optionsSection/advancedSection when no-table.
// ---------------------------------------------------------------------------

(function sprintSidebarNoTableState() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // -------------------------------------------------------------------------
  // Static source checks (can always be verified without eval)
  // -------------------------------------------------------------------------

  // AC3: old error string must be gone.
  eq('no-table AC3: old error string absent from sidebar.js',
    sidebarSrc.includes('Right-click a table first, then reopen the sidebar.'), false);

  // AC1 (static): NO_TABLE_CLASS and NO_TABLE_STATUS_MSG are defined.
  eq('no-table AC1: NO_TABLE_CLASS constant defined in sidebar.js',
    /const NO_TABLE_CLASS\s*=\s*['"]no-table['"]/.test(sidebarSrc), true);

  eq('no-table AC1: NO_TABLE_STATUS_MSG constant defined in sidebar.js',
    /const NO_TABLE_STATUS_MSG\s*=\s*['"]Right-click a table to connect it here\.['"]/.test(sidebarSrc), true);

  // AC1 (static): setTableBound(false) is called on init.
  eq('no-table AC1: setTableBound(false) called at module level (init)',
    /setTableBound\(false\)/.test(sidebarSrc), true);

  // AC2 (static): setTableBound(true) path exists (answer.samples !== null branch).
  eq('no-table AC2: setTableBound called with answer.samples !== null',
    /setTableBound\(answer\.samples\s*!==\s*null\)/.test(sidebarSrc), true);

  // AC2 gap check: the sidebar handles state:previewSamplesChanged by calling
  // pullSettingsAndApplyToUI() (issue #251: every refresh re-reads the
  // model's settings first; its chain ends in fetchPreviewSamples, which
  // calls setTableBound inside its callback). There is NO direct
  // setTableBound call in the state:previewSamplesChanged handler, and no
  // separate runtime message that calls setTableBound(true) synchronously.
  // The sidebar has no push-style binding message. We assert the handler
  // exists and starts the pull chain, then flag the architectural gap as a
  // note.
  eq('no-table AC2: state:previewSamplesChanged handler calls pullSettingsAndApplyToUI',
    /state:previewSamplesChanged[\s\S]{0,300}pullSettingsAndApplyToUI\(\)/.test(sidebarSrc), true);

  // GAP NOTE: The sidebar does not handle a dedicated "TABLE_BOUND" push message.
  // If content.js ever fails to send state:previewSamplesChanged after a new right-click
  // (e.g. in error paths), the sidebar state will not update. There is no direct
  // setTableBound(true) call reachable from state:previewSamplesChanged — the binding
  // happens inside the fetchPreviewSamples callback only when the tab responds.
  // This gap is architectural and cannot be covered by a unit test without a
  // full browser environment; flagged here for reviewer awareness.

  // AC4 (static): the no-table state must NOT dim/disable the sidebar sections.
  // Behaviour changed — instead of greying the whole sidebar, the main toggle is
  // flipped off (covered by the behavioural tests below). Guard against the old
  // dimming rules being reintroduced.
  eq('no-table AC4: sidebar.html does NOT dim #optionsSection under body.no-table',
    /body\.no-table\s+#optionsSection/.test(sidebarHtml), false);

  eq('no-table AC4: sidebar.html does NOT dim #advancedSection under body.no-table',
    /body\.no-table\s+#advancedSection/.test(sidebarHtml), false);

  eq('no-table AC4: sidebar.html does NOT disable the title-row pill under body.no-table',
    /body\.no-table\s+\.title-row\s+\.switch/.test(sidebarHtml), false);

  // AC1 (static): sidebar.html default #status text is the no-table message.
  eq('no-table AC1: sidebar.html default #status text is the no-table message',
    /id="status"[^>]*>Right-click a table to connect it here\./.test(sidebarHtml), true);

  // -------------------------------------------------------------------------
  // Behavioral unit tests via eval of setTableBound with minimal DOM stubs.
  // We extract just the two constants and the function body from sidebar.js
  // source, then eval them with a fake document.body.classList and statusEl.
  // -------------------------------------------------------------------------
  (function setTableBoundBehavioural() {
    // Minimal classList stub.
    function makeClassList() {
      const classes = new Set();
      return {
        toggle(cls, force) {
          if (force === undefined) {
            if (classes.has(cls)) classes.delete(cls); else classes.add(cls);
          } else if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
        },
        has(cls) { return classes.has(cls); },
        add(cls) { classes.add(cls); },
        remove(cls) { classes.delete(cls); },
      };
    }

    // Build stub environment for each sub-test.
    function makeEnv(initialStatus, initialChecked) {
      const classList = makeClassList();
      const statusEl = { textContent: initialStatus !== undefined ? initialStatus : '', dataset: {} };
      const enabledEl = { checked: initialChecked !== undefined ? initialChecked : true, disabled: false };
      const fakeDoc = { body: { classList } };
      const DR_DEFAULTS = { enabled: true };
      let updateDisabledCalls = 0;
      function updateDisabledState() { updateDisabledCalls++; }

      // Extract constants + function from sidebar source, then eval in closure.
      // We pull the relevant declarations and avoid running the rest of
      // sidebar.js (which needs getElementById, chrome.tabs, etc.).
      // Keep this copy in step with the real setTableBound in sidebar.js.
      const snippet = `
        const NO_TABLE_CLASS = 'no-table';
        const NO_TABLE_STATUS_MSG = 'Right-click a table to connect it here.';
        function setTableBound(isBound) {
          document.body.classList.toggle(NO_TABLE_CLASS, !isBound);
          if (!isBound) {
            document.body.classList.remove('table-locked');
            enabledEl.disabled = false;
            delete statusEl.dataset.source;
            enabledEl.checked = false;
            statusEl.textContent = NO_TABLE_STATUS_MSG;
          } else {
            if (statusEl.textContent === NO_TABLE_STATUS_MSG) {
              statusEl.textContent = '';
            }
          }
          updateDisabledState();
        }
      `;
      // Use a function wrapper so the closure vars resolve from the params.
      const fn = new Function(
        'document', 'statusEl', 'enabledEl', 'DR_DEFAULTS', 'updateDisabledState',
        snippet + '\nreturn setTableBound;');
      const setTableBound = fn(fakeDoc, statusEl, enabledEl, DR_DEFAULTS, updateDisabledState);
      return {
        classList, statusEl, enabledEl, setTableBound,
        getUpdateDisabledCalls: () => updateDisabledCalls,
      };
    }

    // AC1a: setTableBound(false) → body gets 'no-table' class.
    {
      const { classList, setTableBound } = makeEnv();
      setTableBound(false);
      eq('no-table AC1b: setTableBound(false) adds no-table class to body',
        classList.has('no-table'), true);
    }

    // AC1b: setTableBound(false) → #status text = NO_TABLE_STATUS_MSG.
    {
      const { statusEl, setTableBound } = makeEnv();
      setTableBound(false);
      eq('no-table AC1c: setTableBound(false) sets status to no-table message',
        statusEl.textContent, 'Right-click a table to connect it here.');
    }

    // AC2a: setTableBound(true) → 'no-table' class removed.
    {
      const { classList, setTableBound } = makeEnv();
      setTableBound(false); // init
      setTableBound(true);
      eq('no-table AC2a: setTableBound(true) removes no-table class',
        classList.has('no-table'), false);
    }

    // AC2b: setTableBound(true) when status was the no-table message → status cleared.
    {
      const { statusEl, setTableBound } = makeEnv('Right-click a table to connect it here.');
      setTableBound(true);
      eq('no-table AC2b: setTableBound(true) clears status when it held no-table message',
        statusEl.textContent, '');
    }

    // AC2c: setTableBound(true) when status holds a DIFFERENT message → status preserved.
    // (E.g. a state:rangeError message should not be wiped by a table bind event.)
    {
      const { statusEl, setTableBound } = makeEnv('Invalid range expression.');
      setTableBound(true);
      eq('no-table AC2c: setTableBound(true) does not overwrite an unrelated status message',
        statusEl.textContent, 'Invalid range expression.');
    }

    // AC2 gap — live rebind: calling setTableBound(false) then setTableBound(true)
    // in sequence correctly toggles state (simulates the state:previewSamplesChanged
    // round-trip where fetchPreviewSamples resolves with non-null samples).
    {
      const { classList, statusEl, setTableBound } = makeEnv();
      setTableBound(false); // init (no table)
      setTableBound(true);  // user right-clicked a table; fetchPreviewSamples resolved
      eq('no-table AC2-live: body loses no-table after live rebind',
        classList.has('no-table'), false);
      eq('no-table AC2-live: status cleared after live rebind',
        statusEl.textContent, '');
    }

    // AC2 gap — the REVERSE: bound → unbound (table navigated away).
    {
      const { classList, statusEl, setTableBound } = makeEnv();
      setTableBound(true);  // table was bound
      setTableBound(false); // table gone (runtime error or null samples)
      eq('no-table AC2-reverse: body gets no-table when table removed',
        classList.has('no-table'), true);
      eq('no-table AC2-reverse: status message restored when table removed',
        statusEl.textContent, 'Right-click a table to connect it here.');
    }

    // Toggle-off behaviour: setTableBound(false) flips the main pill to off
    // (rather than dimming the sidebar) and runs updateDisabledState.
    {
      const { enabledEl, setTableBound, getUpdateDisabledCalls } = makeEnv(undefined, true);
      setTableBound(false);
      eq('no-table toggle: setTableBound(false) turns the main pill off',
        enabledEl.checked, false);
      eq('no-table toggle: setTableBound(false) calls updateDisabledState',
        getUpdateDisabledCalls() >= 1, true);
    }

    // Bind leaves the pill alone (issue #251): the settings apply that runs
    // before the bind resolves — applySettingsToUI on a pull, or
    // applyDefaultsToUI on the pull's fallback — is the pill's only writer
    // for the bound state. A bind that reset the pill to the shipped default
    // is what desynced the panel from the model.
    {
      const { enabledEl, setTableBound } = makeEnv(undefined, true);
      setTableBound(false);      // init: no table yet → pill off
      enabledEl.checked = false; // the model pull applied enabled:false
      setTableBound(true);       // table resolved → bind must not touch it
      eq('no-table toggle: setTableBound(true) leaves the pill to the pulled value on bind',
        enabledEl.checked, false);
    }

    // Static guard: the real setTableBound flips enabledEl.checked off and runs
    // updateDisabledState (not just a class toggle). Isolate the function's own
    // body (rather than scanning from the first "setTableBound" text match
    // anywhere in the file) so a coincidental match elsewhere — e.g. an
    // unrelated setTableBound(...) call sitting near an unrelated
    // updateDisabledState() call in some other function — cannot pass this
    // for the wrong reason.
    const setTableBoundFnMatch = sidebarSrc.match(/function setTableBound\([\s\S]*?\n}/);
    const setTableBoundFnBody = setTableBoundFnMatch ? setTableBoundFnMatch[0] : '';
    eq('no-table toggle: sidebar.js setTableBound function body was isolated (sanity check on the scan itself)',
      setTableBoundFnBody.length > 0, true);
    eq('no-table toggle: sidebar.js setTableBound sets enabledEl.checked = false when unbound',
      /enabledEl\.checked\s*=\s*false/.test(setTableBoundFnBody), true);
    eq('no-table toggle: sidebar.js setTableBound calls updateDisabledState',
      /updateDisabledState\(\)/.test(setTableBoundFnBody), true);
    // Issue #251: the bound branch must not reset the pill to the shipped
    // default — the model (or the pull's explicit defaults fallback) is the
    // pill's only source once a table is bound.
    eq('no-table toggle: sidebar.js setTableBound no longer references DR_DEFAULTS anywhere (issue #251)',
      /DR_DEFAULTS/.test(setTableBoundFnBody), false);

    // AC2 gap — ADVERSARIAL: verify that the sidebar does NOT have a runtime
    // message handler that directly calls setTableBound(true) when a table is
    // right-clicked. The only live-rebind path is state:previewSamplesChanged →
    // fetchPreviewSamples → callback. This means if content.js sends no message,
    // the sidebar stays stale. We document this by asserting that no
    // "contextMenus" or "TABLE_BOUND" message handler exists in sidebar.js.
    eq('no-table AC2-gap: sidebar.js has no direct TABLE_BOUND message handler',
      /action\s*===\s*['"]TABLE_BOUND['"]/.test(sidebarSrc), false);
    // (Gap: the sidebar depends entirely on state:previewSamplesChanged being sent
    // by content.js after every right-click. If content.js omits that message
    // in any code path, the no-table class will not be removed. This cannot be
    // unit-tested in Node without a full browser environment.)
  })();
})();


// ---------------------------------------------------------------------------
// Sprint dots-tick-alignment: pct() mapping and CSS vertical alignment
// ---------------------------------------------------------------------------

(function sprintDotsTickAlignment() {
  const sidebarJsSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // --- Extract pct() from sidebar.js and instantiate it for runtime testing ---
  // We locate the function body with a regex (same pattern used elsewhere for
  // source-level extraction) and wrap it in a new Function so we can call it.
  const pctMatch = sidebarJsSrc.match(/function pct\(v\)\s*\{([\s\S]*?)\n\}/);
  if (!pctMatch) {
    failed++;
    failures.push({ name: 'dots-tick: pct() function found in sidebar.js', actual: false, expected: true });
  } else {
    passed++;
    // The 9 stops in strategy-monotonic order (k=0..8), mirroring STOPS:
    const stops = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
    const N = stops.length;
    // pct() now closes over STOPS and snap(); supply both so the extracted body
    // runs standalone. snap() is the nearest-stop fallback for non-stop inputs.
    const snap = (v) => stops.reduce((b, s) => Math.abs(s - v) < Math.abs(b - v) ? s : b, stops[0]);
    const pctRaw = new Function('STOPS', 'snap', 'v', pctMatch[1]);
    const pct = (v) => pctRaw(stops, snap, v);
    const TOL = 1e-6;

    // AC1a: Each stop maps to the centre of its grid cell in an N-equal-column grid.
    // Cell k centre = (k + 0.5) / N * 100.
    stops.forEach((v, k) => {
      const expected = (k + 0.5) / N * 100;
      const actual = pct(v);
      const ok = Math.abs(actual - expected) < TOL;
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push({
          name: `dots-tick: pct(${v}) === cell-${k}-centre (${expected.toFixed(6)}%)`,
          actual: actual,
          expected: expected,
        });
      }
    });

    // AC1b: Key exact values — extremes and the zero stop (index 5 of 9).
    const pctNeg2 = pct(-2);
    const pctZero = pct(0);
    const pctPos1 = pct(1);

    eq('dots-tick: pct(-2) ≈ 5.5556% (1st cell centre)',
      Math.abs(pctNeg2 - 0.5 / N * 100) < TOL, true);
    eq('dots-tick: pct(0) ≈ 61.1111% (6th cell centre, asymmetric range)',
      Math.abs(pctZero - 5.5 / N * 100) < TOL, true);
    eq('dots-tick: pct(1) ≈ 94.4444% (9th cell centre)',
      Math.abs(pctPos1 - 8.5 / N * 100) < TOL, true);

    // AC1c: the extremes are inset by half a cell, never flush at 0/100.
    // A value-proportional formula would push an end stop to 0 or 100; the
    // index-based formula keeps both ends a half-cell in.
    eq('dots-tick: pct(-2) is NOT 0 (end stop is inset by half a cell)',
      pct(-2) !== 0, true);
    eq('dots-tick: pct(1) is NOT 100 (end stop is inset by half a cell)',
      pct(1) !== 100, true);

    // AC2: Monotonic — pct is strictly increasing across all 9 stops.
    let monotonic = true;
    for (let i = 1; i < stops.length; i++) {
      if (pct(stops[i]) <= pct(stops[i - 1])) { monotonic = false; break; }
    }
    eq('dots-tick: pct() is strictly increasing across all 9 stops', monotonic, true);

    // AC3: Equal columns — adjacent stops are exactly one cell (100/N %) apart,
    // regardless of the uneven numeric spacing of the stop values.
    let equalCols = true;
    const cell = 100 / N;
    for (let i = 1; i < stops.length; i++) {
      if (Math.abs((pct(stops[i]) - pct(stops[i - 1])) - cell) > TOL) { equalCols = false; break; }
    }
    eq('dots-tick: adjacent stops are one equal column (100/N %) apart', equalCols, true);
  }

  // --- AC4: 9-column grid assumption — verify tick markup matches formula ---
  // The pct formula assumes N equal columns. Adversarial check: count the actual
  // tick spans and verify the CSS declares exactly repeat(9, 1fr).
  const tickSpans = (sidebarHtmlSrc.match(/class="t"/g) || []).length;
  eq('dots-tick: .dual-ticks contains exactly 9 tick spans (matches pct() formula)',
    tickSpans, 9);

  eq('dots-tick: .dual-ticks CSS uses repeat(9, 1fr) grid',
    /\.dual-ticks\s*\{[^}]*grid-template-columns\s*:\s*repeat\(9,\s*1fr\)/.test(sidebarHtmlSrc), true);

  // --- AC5: Vertical CSS — .dual-ticks uses top: 20px (not 22px) ---
  eq('dots-tick: .dual-ticks CSS top is 20px',
    /\.dual-ticks\s*\{[^}]*top:\s*20px/.test(sidebarHtmlSrc), true);

  eq('dots-tick: .dual-ticks CSS top is NOT 22px (old value)',
    /\.dual-ticks\s*\{[^}]*top:\s*22px/.test(sidebarHtmlSrc), false);

  // --- AC6: pct() is only used for thumb positioning (not for fill/label/other) ---
  // Adversarial: if pct() were wired to a range-fill width or label position, the
  // non-0/100 extremes would produce a visually broken fill. Verify here that all
  // pct() call sites in sidebar.js are limited to style.left on thumbs.
  // Use a negative lookbehind to exclude the function definition itself.
  const pctCallSites = sidebarJsSrc.match(/(?<!function )pct\([^)]+\)/g) || [];
  // Every call site should appear only inside thumb left-position assignments.
  // We check there are exactly 2 call sites (topThumb and botThumb style.left).
  eq('dots-tick: pct() is called exactly twice in sidebar.js (both thumb style.left)',
    pctCallSites.length, 2);

  // Both call sites must be inside a style.left assignment.
  const thumbLeftPattern = /\.style\.left\s*=\s*pct\(/g;
  const thumbLeftMatches = (sidebarJsSrc.match(thumbLeftPattern) || []).length;
  eq('dots-tick: both pct() calls are style.left assignments (not fill/label)',
    thumbLeftMatches, 2);
})();


// ---------------------------------------------------------------------------
// Sprint sidebar-preview-and-controls
// AC1 (Bug #2): request:applySettings sends a synchronous response
// AC2 (Bug #3): formatStrategyHeader re-basing — mag=3 exhaustive table
// AC3 (Bug #1): embedded-in-text numbers feed maxMag
// ---------------------------------------------------------------------------

// -------------------------------------------------------------------------
// AC1: request:applySettings is acknowledged (sendResponse fires synchronously)
//
// The content.js onMessage listener was registered at module-eval time against
// a no-op stub. To capture the real listener we re-eval the full content-script
// stack with a capturing chrome stub in an isolated scope, then dispatch the
// message and verify the sendResponse callback fires.
// -------------------------------------------------------------------------
(function ac1_applySidebarSettings() {
  // Chrome hands an arriving message to every registered listener, so collect
  // them all and fan out the same way. The bundle registers one today, the
  // bus's; keeping only the last registration would silently skip whichever
  // listener registers first should a second one ever appear.
  const capturedListeners = [];
  function capturedListener(req, sender, respond) {
    // Chrome keeps the reply port open when ANY listener returns true, and
    // closes it otherwise. Returning nothing here would make the
    // synchronous-answer assertions below unfalsifiable.
    let keepOpen = false;
    for (const fn of capturedListeners) {
      if (fn(req, sender, respond || function () {}) === true) keepOpen = true;
    }
    return keepOpen;
  }
  const captureChrome = {
    runtime: {
      onMessage: {
        addListener(fn) { capturedListeners.push(fn); }
      },
      sendMessage: () => {},
      lastError: null,
    },
  };
  const captureDoc = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };
  const captureWindow = {
    addEventListener: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };

  const savedChrome = global.chrome;
  const savedDoc    = global.document;
  const savedWindow = global.window;
  global.chrome   = captureChrome;
  global.document = captureDoc;
  global.window   = captureWindow;

  try {
    // contentScriptBundle is already the manifest-order concatenation of all
    // content scripts (see the bootstrap section above).
    eval(contentScriptBundle);
  } catch (e) {
    // content.js module-level code may fail in the stub environment; the
    // onMessage listener registers before any dynamic code runs, so we
    // only need the addListener call to have fired.
  } finally {
    global.chrome   = savedChrome;
    global.document = savedDoc;
    global.window   = savedWindow;
  }

  eq('AC1: content.js onMessage listener was captured',
    capturedListeners.length > 0, true);

  if (capturedListeners.length === 0) return;

  // Dispatch request:applySettings and verify sendResponse is called.
  let sendResponseCalledWith = undefined;
  let sendResponseCallCount  = 0;
  function fakeSendResponse(val) {
    sendResponseCallCount++;
    sendResponseCalledWith = val;
  }

  const returnValue = capturedListener(
    { action: 'request:applySettings', settings: {} },
    {},
    fakeSendResponse
  );

  eq('AC1: sendResponse was called for request:applySettings',
    sendResponseCallCount, 1);

  eq('AC1: sendResponse called with {ok:true}',
    sendResponseCalledWith && sendResponseCalledWith.ok, true);

  // The branch must NOT return true (that would leave the message port open
  // for an async response that will never arrive).
  eq('AC1: request:applySettings branch does NOT return true (synchronous)',
    returnValue === true, false);

  // Source-level belt-and-suspenders: the branch contains a sendResponse( call.
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('AC1-src: source file content.js present in manifest', false, true);
    return;
  }
  // The branch became a responder in issue #325. A responder answers by
  // returning, so the acknowledgement now reads as a return of the answer
  // rather than a sendResponse call. The behavior it guards is unchanged: the
  // asker must receive something, because receiving nothing is what unbinds
  // the sidebar.
  eq('AC1-src: the request:applySettings responder returns an answer',
    /DR_BUS\.respond\(\s*'request:applySettings'[\s\S]{0,300}return \{/.test(contentSrc), true);
  eq('AC1-src: no inline branch answers it any more',
    /request:applySettings[\s\S]{0,200}sendResponse\(/.test(contentSrc), false);
})();

// -------------------------------------------------------------------------
// AC2: formatStrategyHeader — exhaustive mag=3 (1k+) table. Per issue #1 the
// header is exactly "<oomLabel> → nearest <stepLabel>" for every offset stop,
// with no "(i.e. …)" clause and no "×" multiplier.
// -------------------------------------------------------------------------
(function ac2_mag3_exhaustiveTable() {
  const sidebarSrc  = fs.readFileSync(path.join(__dirname, 'sidebar.js'),  'utf8');
  const constBlock  = sidebarSrc.match(/const OOM_LABEL_CLASS\s*=[\s\S]*?const STRATEGY_CLASS\s*=.*?;/);
  const fmtOomFn    = sidebarSrc.match(/function formatOomLabel\([\s\S]*?\n\}/);
  const fmtHdrFn    = sidebarSrc.match(/function formatStrategyHeader\([\s\S]*?\n\}/);

  if (!constBlock || !fmtOomFn || !fmtHdrFn) {
    eq('AC2-mag3-extract: able to extract formatOomLabel + formatStrategyHeader', false, true);
    return;
  }

  const helperSrc = '(function(trimNum, stepForOffset, formatStep) {\n' +
    constBlock[0] + '\n' + fmtOomFn[0] + '\n' + fmtHdrFn[0] + '\n' +
    'return { formatOomLabel: formatOomLabel, formatStrategyHeader: formatStrategyHeader };\n' +
    '})(trimNum, stepForOffset, formatStep)';

  let helpers;
  try {
    helpers = (new Function('trimNum', 'stepForOffset', 'formatStep',
      'return ' + helperSrc + ';'
    ))(trimNum, stepForOffset, formatStep);
  } catch (e) {
    eq('AC2-mag3-eval: new Function eval succeeded', String(e), '');
    return;
  }

  const fmtOom = helpers.formatOomLabel;
  const fmtHdr = helpers.formatStrategyHeader;

  const mag = 3;
  const oomVal   = Math.pow(10, mag);  // 1000
  const oomLabel = fmtOom(mag);        // "1k+"

  eq('AC2-mag3: oomLabel is "1k+"', oomLabel, '1k+');

  const offsets = [-2, -1.5, -1, -0.25, -0.5, 0, 0.25, 0.5, 1];
  for (const offset of offsets) {
    const tag     = 'AC2-mag3 offset=' + offset;
    const stepLbl = formatStep(stepForOffset(oomVal, offset));
    const header  = fmtHdr(mag, offset);

    eq(tag + ': header is exactly "' + oomLabel + ' → nearest ' + stepLbl + '"',
      header, oomLabel + ' → nearest ' + stepLbl);
    eq(tag + ': no "(i.e." clause', header.includes('(i.e.'), false);
    eq(tag + ': no "×" multiplier', header.includes('×'), false);
  }

  // Spot-check the exact step labels for two representative stops (regression guard).
  eq('AC2-mag3 offset=0.5: header is exactly "1k+ → nearest 5k"',
    fmtHdr(mag, 0.5), '1k+ → nearest 5k');
  eq('AC2-mag3 offset=-1: header is exactly "1k+ → nearest 100"',
    fmtHdr(mag, -1), '1k+ → nearest 100');
  // New extended stops: -1.5 → 0.5·10^(mag-1)=50, -2 → 10^(mag-2)=10.
  eq('AC2-mag3 offset=-1.5: header is exactly "1k+ → nearest 50"',
    fmtHdr(mag, -1.5), '1k+ → nearest 50');
  eq('AC2-mag3 offset=-2: header is exactly "1k+ → nearest 10"',
    fmtHdr(mag, -2), '1k+ → nearest 10');
})();

// -------------------------------------------------------------------------
// AC3 (Bug #1): embedded-in-text numbers feed maxMag.
// A table whose only large values are embedded in mixed-text cells (like
// "₹2,000 crore") must produce maxMag=3 (from 2,000) even when a stand-alone
// small numeric cell (e.g. "5") is also present.
// -------------------------------------------------------------------------
(function ac3_embeddedInTextMaxMag() {
  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }

  // The large number is embedded inside prose; the small number is pure-numeric.
  // "₹2,000 crore": toNumber returns null (not a pure number), so
  // extractNumbersInText extracts 2000 → magnitude 3.
  // "5": toNumber returns 5 → magnitude 0.
  //
  // A header row + label column keep the data off row 0 / column 0
  // (DR_DEFAULTS excludes both by default; see the merge-ladder divergence
  // tests below).
  const table = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('₹2,000 crore'), tdCell('5')] },
    ],
  };

  const result = extractPreviewSamples(table);

  eq('AC3: maxMag is 3 (from embedded 2,000, not suppressed by stand-alone 5)',
    result.maxMag, 3);

  eq('AC3: top band contains the large embedded number',
    result.samples.top.length >= 1, true);

  eq('AC3: top band num is 2000 (the embedded value)',
    result.samples.top[0] && result.samples.top[0].num, 2000);

  // Complementary: a pure-number table still works as before (regression guard).
  const pureTable = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('27,000,000'), tdCell('286')] },
    ],
  };
  const pureResult = extractPreviewSamples(pureTable);
  eq('AC3-regression: pure-number table maxMag is 7 (27M)',
    pureResult.maxMag, 7);

  // Also verify that collectNumericCells picks up the embedded number from
  // the mixed-text cell, proving the extraction path is exercised.
  const mixedTable = {
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('Revenue: ₹2,000 crore'), tdCell('5')] },
    ],
  };
  const cells = collectNumericCells(mixedTable);
  // Should find at least 2000 among the collected cells.
  const nums = cells.map(c => c.num);
  eq('AC3-collect: collectNumericCells finds 2000 from embedded text',
    nums.includes(2000), true);
})();


// -------------------------------------------------------------------------
// Issue #4: era-marked years are dates, not offset-rounded numbers.
// eraYearDigitRanges locates each year token bound to an era marker;
// collectNumericCells / extractPreviewSamples must exclude such tokens from
// magnitude detection and the preview examples.
// -------------------------------------------------------------------------
(function eraYearDetection() {
  // The number at [index, index + numStr.length) sits in an era-year range.
  const isEraYear = (text, index, numStr) =>
    overlapsQuoteRange(eraYearDigitRanges(text), index, index + numStr.length);

  // The digit token bound to a marker (either order) is an era year.
  eq('era: "Kalki 2898 AD" → 2898 is an era year',
    isEraYear('Kalki 2898 AD', 'Kalki '.length, '2898'), true);
  eq('era: "500 BC" → 500 is an era year',
    isEraYear('500 BC', 0, '500'), true);
  eq('era: "AD 79" → 79 is an era year',
    isEraYear('AD 79', 'AD '.length, '79'), true);
  eq('era: "1200 CE" → 1200 is an era year',
    isEraYear('1200 CE', 0, '1200'), true);
  eq('era: "2,898 BCE" → comma year is an era year',
    isEraYear('2,898 BCE', 0, '2,898'), true);

  // Negatives: plain numbers, and marker letters embedded in a word.
  eq('era: plain "Revenue 3,000,000" is NOT an era year',
    isEraYear('Revenue 3,000,000', 'Revenue '.length, '3,000,000'), false);
  eq('era: bare "2898" (no marker) is NOT an era year',
    isEraYear('2898', 0, '2898'), false);
  eq('era: "ADELAIDE 12" does NOT match (AD inside a word)',
    isEraYear('ADELAIDE 12', 'ADELAIDE '.length, '12'), false);

  // Lowercase, period-less marker letters are ordinary words/abbreviations, not
  // eras: "3,420 ad hoc", "120 bp" (basis points), "5 ah", "12 ce", "9 bc".
  // These must NOT be read as years (they'd otherwise be excluded from rounding).
  eq('era: "3,420 ad hoc" → "ad" is a word, NOT an era year',
    isEraYear('3,420 ad hoc', 0, '3,420'), false);
  eq('era: "120 bp" (basis points) is NOT an era year',
    isEraYear('120 bp', 0, '120'), false);
  eq('era: "5 ah" is NOT an era year',
    isEraYear('5 ah', 0, '5'), false);
  // Period-punctuated lowercase forms stay unambiguous and DO match.
  eq('era: "79 a.d." (dotted, lowercase) is still an era year',
    isEraYear('79 a.d.', 0, '79'), true);

  function tdCell(text) {
    return withTextPiece({ tagName: 'TD', innerText: text, textContent: text });
  }
  function thCell(text) {
    return withTextPiece({ tagName: 'TH', innerText: text, textContent: text });
  }

  // A header row + label column keep the data off row 0 / column 0
  // throughout this block (DR_DEFAULTS excludes both by default; see the
  // merge-ladder divergence tests below).

  // collectNumericCells: the era year is dropped, real numbers are kept.
  const cells = collectNumericCells({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('Kalki 2898 AD'), tdCell('1,050,000,000')] },
    ],
  });
  const nums = cells.map(c => c.num);
  eq('era-collect: 2898 (era year) excluded from numeric cells',
    nums.includes(2898), false);
  eq('era-collect: 1,050,000,000 (real number) still collected',
    nums.includes(1050000000), true);

  // Regression: "~3,420 ad hoc" — "ad" was being read as the AD era marker, so
  // the 3,420 was dropped and the cell never rounded. It must now be collected.
  const adHocCells = collectNumericCells({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B')] },
      { cells: [thCell('Row'), tdCell('~30,800 PAD (EFT)'), tdCell('~3,420 ad hoc')] },
    ],
  });
  const adHocNums = adHocCells.map(c => c.num);
  eq('era-collect: "~3,420 ad hoc" number is collected (not an era year)',
    adHocNums.includes(3420), true);
  eq('era-collect: "~30,800 PAD (EFT)" number is collected',
    adHocNums.includes(30800), true);

  // extractPreviewSamples: maxMag comes from the real number, not the era year,
  // and no sample row carries the era-year value.
  const result = extractPreviewSamples({
    rows: [
      { cells: [thCell(''), thCell('A'), thCell('B'), thCell('C')] },
      { cells: [thCell('Row'), tdCell('Kalki 2898 AD'), tdCell('1,050,000,000'), tdCell('500')] },
    ],
  });
  eq('era-samples: maxMag is 9 (from 1.05B, not the 2898 AD year)',
    result.maxMag, 9);
  const sampleNums = result.samples.top.concat(result.samples.bottom).map(r => r.num);
  eq('era-samples: no example row is the 2898 AD year',
    sampleNums.includes(2898), false);
})();

// -------------------------------------------------------------------------
// Issue #2: when a native table is already simplified, collectNumericCells
// reads the stored original (DR_STORE's table registry, app-model-registry
// sprint — this used to be dataset.originalValue) rather than the rounded
// text now showing in the cell.
// -------------------------------------------------------------------------
(function originalValueOnSimplifiedTable() {
  // A rounded native cell: innerText shows the rounded "3,000,000" but the true
  // original "2,794,356" is recorded in the registry.
  const roundedCell = {
    tagName: 'TD',
    innerText: '3,000,000',
    textContent: '3,000,000',
    dataset: {},
    childNodes: [{ nodeType: 3, nodeValue: '3,000,000' }],
  };
  // A header row + label column keep the cell off row 0 / column 0
  // (DR_DEFAULTS excludes both by default; see the merge-ladder divergence
  // tests below) so this stays a test of the registry original read path,
  // not an incidental first-row/first-column exclusion.
  const labelCell = { tagName: 'TH', innerText: '', textContent: '' };
  const headerCell = { tagName: 'TH', innerText: 'A', textContent: 'A' };
  const rowLabelCell = { tagName: 'TH', innerText: 'Row', textContent: 'Row' };
  const mockTable = {
    rows: [
      { cells: [labelCell, headerCell] },
      { cells: [rowLabelCell, roundedCell] },
    ],
  };
  DR_STORE.setTableOriginal(mockTable, roundedCell, {
    value: '2,794,356', pieces: [{ text: '2,794,356', written: '3,000,000' }], supRanges: null, linkFilteredIdx: null,
  });
  const cells = collectNumericCells(mockTable);
  eq('orig-value: reads original text, not rounded',
    cells[0].text, '2,794,356');
  eq('orig-value: parses num from original, not rounded',
    cells[0].num, 2794356);
})();

// A simplified native cell classifies its stored original pieces, so the
// placement step reads the pieces the value was written from, not the live
// pieces, which hold the written text. The stored pieces hold the value in
// one piece, so it joins the pool. The same split with no stored original
// stays out of the pool, because the placement step reads a value that
// crosses a piece boundary.
(function previewSimplifiedNativeCell_placesItsStoredPieces() {
  withReactiveCreateTreeWalker(function () {
    const opts = { simplifyFirstRow: true, simplifyFirstColumn: true, rangeExpr: '' };
    const roundedCell = makeReactiveCell([{ text: '6,700,000', inSup: false }, { text: ' kg', inSup: false }]);
    const table = { rows: [{ cells: [roundedCell] }], dataset: {} };
    DR_STORE.setTableOriginal(table, roundedCell, {
      value: '6,718,245 kg',
      pieces: [{ text: '6,718,245', written: '6,700,000' }, { text: ' kg', written: ' kg' }],
      supRanges: null, linkFilteredIdx: null,
    });
    const liveCell = makeReactiveCell([{ text: '6,7', inSup: false }, { text: '18,245', inSup: false }]);
    const liveTable = { rows: [{ cells: [liveCell] }], dataset: {} };
    try {
      eq('preview simplified native cell: the stored original joins the pool through its stored pieces',
        collectNumericCells(table, opts).map((c) => c.num), [6718245]);
      eq('preview simplified native cell: the same split with no stored original stays out',
        collectNumericCells(liveTable, opts), []);
    } finally {
      DR_STORE.unregisterTable(table);
    }
  });
})();

// The lens preview writes no log rows: a native value split across text
// pieces, which the simplification pass records with a debug row, leaves
// the log unchanged when the preview classifies it.
(function previewWritesNoLogRows() {
  withReactiveCreateTreeWalker(function () {
    const opts = { simplifyFirstRow: true, simplifyFirstColumn: true, rangeExpr: '' };
    const splitCell = makeReactiveCell([{ text: '3,406,', inSup: false }, { text: '918', inSup: false }]);
    const table = { rows: [{ cells: [splitCell] }], dataset: {} };
    const rows = [];
    const offRow = DR_LOG.onRow((row) => rows.push(row));
    try {
      eq('preview log rows: the split value stays out of the pool',
        collectNumericCells(table, opts), []);
      eq('preview log rows: the preview writes no row', rows.length, 0);
      roundTable(table, opts);
      eq('preview log rows (control): the simplification pass writes the split row',
        rows.some((row) => row.level === 'debug' && /native cell value split across text pieces/.test(row.text)), true);
    } finally {
      offRow();
      DR_STORE.unregisterTable(table);
    }
  });
})();

// ---------------------------------------------------------------------------
// Background message routing.
//
// chrome.runtime.sendMessage from the service worker reaches extension pages
// such as the side panel, and never reaches content scripts. A content script
// is reachable only through chrome.tabs.sendMessage(tabId, ...). Two rules
// follow, and both are asserted at runtime rather than by source regex:
//
//   1. Closing the sidebar notifies the sidebar page alone. A second send,
//      aimed at the tab, used to tell the content script to clear its own
//      copy of "the sidebar is open". The 2026-09-14 sidebar-state-removal
//      design retired that copy (#241), and the content script registers no
//      branch for this message, so the tab-directed send would deliver to
//      nothing.
//   2. state:tableActivated must not be relayed into the tab. content.js already
//      sends it with runtime.sendMessage, which the panel receives directly.
//      Relaying it to sidebarTabId delivers it to a content script that has no
//      handler for that action.
// ---------------------------------------------------------------------------

(function backgroundMessageRouting() {
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');

  // Evaluate background.js against a capturing stub. sidePanel is deliberately
  // omitted: background.js guards on `chrome.sidePanel && chrome.sidePanel.open`,
  // so with it absent the menu handler never awaits and runs to completion
  // synchronously, letting us assert without async plumbing.
  //
  // The worker runs on the bus (#325), so the bus source goes into the same
  // function scope ahead of it, standing in for the importScripts the browser
  // runs. The stub's chrome interfaces follow Chrome's callback contract, which
  // is the one the bus calls: chrome.tabs.query must exist even though every
  // publish here names its tab, because a tab-routed send with no query
  // interface throws.
  //
  // closeSidebarUnreceived simulates a receiving end that is already gone by
  // the time the close topic goes out, which is exactly the onRemoved case.
  // Chrome reports that through chrome.runtime.lastError on the callback, and
  // the bus consumes it.
  function loadBackground({ closeSidebarUnreceived = false } = {}) {
    const runtimeSends = [];
    const tabSends = [];
    const listeners = {};
    const chromeStub = {
      runtime: {
        lastError: null,
        onInstalled: { addListener: () => {} },
        onMessage: { addListener: (fn) => { listeners.message = fn; } },
        sendMessage: (msg, cb) => {
          runtimeSends.push(msg);
          chromeStub.runtime.lastError =
            closeSidebarUnreceived && msg.action === 'intent:closeSidebar'
              ? { message: 'Could not establish connection. Receiving end does not exist.' }
              : null;
          if (cb) cb(undefined);
          chromeStub.runtime.lastError = null;
        },
      },
      contextMenus: {
        create: () => {},
        update: () => {},
        onClicked: { addListener: (fn) => { listeners.menuClicked = fn; } },
      },
      tabs: {
        query: (q, cb) => { cb([{ id: PANEL_TAB }]); },
        sendMessage: (tabId, msg, cb) => {
          tabSends.push({ tabId, msg });
          if (cb) cb(undefined);
        },
        onUpdated:   { addListener: (fn) => { listeners.updated = fn; } },
        onRemoved:   { addListener: (fn) => { listeners.removed = fn; } },
        onActivated: { addListener: (fn) => { listeners.activated = fn; } },
      },
    };
    new Function('chrome', 'console', messagingCode + '\n' + bgSrc)(
      chromeStub,
      { warn: () => {}, debug: () => {}, log: () => {} }
    );
    return { runtimeSends, tabSends, listeners };
  }

  const PANEL_TAB = 7;

  function openPanel(ctx) {
    ctx.listeners.menuClicked({ menuItemId: 'dr-action-sidebar' }, { id: PANEL_TAB });
  }

  // --- Rule 1: closing notifies the sidebar page, and nothing else ---
  (function closeNotifiesTheSidebarOnly() {
    const ctx = loadBackground();
    openPanel(ctx);
    eq('bg routing: opening the sidebar sends the sidebar-opened report to that tab',
      ctx.tabSends.some(s => s.tabId === PANEL_TAB && s.msg.action === 'state:sidebarOpened'),
      true);

    ctx.runtimeSends.length = 0;
    ctx.tabSends.length = 0;

    // Activating a different tab closes the sidebar.
    ctx.listeners.activated({ tabId: 99 });

    eq('bg routing: close topic broadcast reaches the sidebar page',
      ctx.runtimeSends.some(m => m.action === 'intent:closeSidebar'), true);
    eq('bg routing: close topic is not sent into the tab — the content script has no handler for it',
      ctx.tabSends.some(s => s.msg.action === 'intent:closeSidebar'),
      false);
  })();

  // The same must hold for the other two close triggers.
  (function closeOnNavigationAndRemoval() {
    const navCtx = loadBackground();
    openPanel(navCtx);
    navCtx.runtimeSends.length = 0;
    navCtx.tabSends.length = 0;
    navCtx.listeners.updated(PANEL_TAB, { status: 'loading' });
    eq('bg routing: navigating away broadcasts the close topic to the sidebar page',
      navCtx.runtimeSends.some(m => m.action === 'intent:closeSidebar'), true);
    eq('bg routing: navigating away sends nothing into the tab',
      navCtx.tabSends.some(s => s.msg.action === 'intent:closeSidebar'), false);

    // A removed tab: the close must not surface an error. The broadcast is
    // all that goes out now, and the stub rejects it, so this pins the
    // service worker's own catch.
    const goneCtx = loadBackground({ closeSidebarUnreceived: true });
    openPanel(goneCtx);
    let threw = false;
    try {
      goneCtx.listeners.removed(PANEL_TAB);
    } catch (e) {
      threw = true;
    }
    eq('bg routing: closing a removed tab does not throw', threw, false);
  })();

  // --- The page-unload guard: only the sidebar's own tab closes it ---
  //
  // The plan's first correction. The worker reads the sending tab's number off
  // the bus's meta argument and acts only when it matches the tab the sidebar
  // was opened for. Without the number, a page unload in any tab would close
  // the sidebar. A message from an extension page reports null, which must not
  // match either, including when the worker holds no tab number at all.
  (function pageUnloadClosesOnlyItsOwnTab() {
    const ctx = loadBackground();
    const closes = () => ctx.runtimeSends.filter(m => m.action === 'intent:closeSidebar').length;
    const unload = (sender) => ctx.listeners.message(
      { action: 'state:pageUnloaded' }, sender, () => {});

    // No sidebar open yet: the worker holds no tab number.
    unload({ tab: { id: 42 } });
    eq('page unload: a tab unload closes nothing while no sidebar is open', closes(), 0);

    // The case that isolates the null clause. An extension page reports no
    // tab, and the worker holding no tab number reports none either, so a
    // guard comparing the two alone would match nothing against nothing and
    // broadcast the close. An idle restart reaches this state: Chrome clears
    // the worker's variables while the panel stays open.
    unload({});
    eq('page unload: an extension page closes nothing while no sidebar is open', closes(), 0);

    openPanel(ctx);
    ctx.runtimeSends.length = 0;

    unload({ tab: { id: 99 } });
    eq('page unload: another tab unloading leaves the sidebar open', closes(), 0);

    unload({});
    eq('page unload: a message from an extension page carries no tab and closes nothing',
      closes(), 0);

    unload({ tab: { id: PANEL_TAB } });
    eq('page unload: the sidebar\'s own tab unloading closes it', closes(), 1);
  })();

  // --- Rule 2: the activation report is not relayed into the tab ---
  (function activatedNotRelayedToTab() {
    const ctx = loadBackground();
    openPanel(ctx);
    ctx.tabSends.length = 0;

    ctx.listeners.message({ action: 'state:tableActivated' }, {});

    eq('bg routing: the activation report is not relayed to the content script',
      ctx.tabSends.filter(s => s.msg.action === 'state:tableActivated').length, 0);
  })();
})();

// ---------------------------------------------------------------------------
// Manifest-driven source loading: lock the properties the bootstrap section
// (the setup piece) depends on, so a future edit cannot quietly reintroduce
// hardcoded content-script filenames or silently load zero scripts.
// ---------------------------------------------------------------------------
(function manifestDrivenSourceLoading() {
  const CONTENT_SCRIPT_FILES = [
    'constants.js',
    'lib/dr-number/rounding.js', 'lib/dr-number/core.js',
    'lib/dr-number/parsing.js', 'lib/dr-number/index.js',
    'lib/dr-table/detect.js', 'lib/dr-table/index.js',
    'lib/dr-simplify/ladder.js', 'lib/dr-simplify/index.js',
    'adapters/messaging.js', 'app/store.js',
    'ui-toggle.js', 'ui-toast.js', 'content.js',
  ];

  // AC1: no content-script filename literal reaches readFileSync/path.join
  // anywhere in the suite, whether directly (`readFileSync('content.js')`,
  // or `path.join(__dirname, 'content.js')` assigned to a path variable
  // that's read next) or indirectly (a hardcoded array mixing content-script
  // names with other names, later iterated by a loop that reads via
  // readFileSync/path.join). A loop-variable read fed by the manifest itself
  // (`readFileSync(path.join(__dirname, file))` where `file` comes from
  // contentScriptFiles) is allowed — only a hardcoded name is a violation.
  // Guarded lookups (sourceByName(...), contentScriptSources.get(...)) and
  // eq()/comment text that merely name a file are not reads and are stripped
  // first so they can't hide a real violation or false-positive one.
  const testsSelfSource = SUITE_SOURCE;
  const literalAlternation = CONTENT_SCRIPT_FILES.join('|').replace(/\./g, '\\.');
  const literalNamePattern = new RegExp(`['"](${literalAlternation})['"]`);

  function findContentScriptFilenameLeaks(source) {
    const stripped = source
      // eq() label strings (the first argument) are descriptive text.
      .replace(/\beq\(\s*(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, 'eq(LABEL')
      // Comments may name a file without reading it.
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // A guarded lookup by literal key is not a filesystem read.
      .replace(/sourceByName\(\s*(['"])[^'"]+\1\s*\)/g, 'sourceByName(GUARDED)')
      .replace(/contentScriptSources\.get\(\s*(['"])[^'"]+\1\s*\)/g, 'contentScriptSources.get(GUARDED)');

    const violations = [];

    // Direct: a literal filename sharing a line with readFileSync or
    // path.join — catches both a literal read argument and a literal path
    // built on the same line and read from a variable right after.
    stripped.split('\n').forEach((line, i) => {
      if (literalNamePattern.test(line) && /readFileSync|path\.join/.test(line)) {
        violations.push(`line ${i + 1}: content-script filename literal combined with readFileSync/path.join`);
      }
    });

    // Indirect: a hardcoded array mixing 2+ content-script names, assigned
    // to a const, later iterated by a for-of loop whose body reads via
    // readFileSync/path.join.
    const arrayDeclPattern = /const\s+(\w+)\s*=\s*\[([^\]]*)\]/g;
    let m;
    while ((m = arrayDeclPattern.exec(stripped))) {
      const [, varName, arrBody] = m;
      const nameHits = arrBody.match(new RegExp(`['"](${literalAlternation})['"]`, 'g')) || [];
      if (nameHits.length < 2) continue;
      const loopPattern = new RegExp(
        `\\n(\\s*)for\\s*\\(\\s*const\\s+\\w+\\s+of\\s+${varName}\\s*\\)\\s*\\{([\\s\\S]*?)\\n\\1\\}`
      );
      const loopMatch = loopPattern.exec(stripped);
      if (loopMatch && /readFileSync|path\.join/.test(loopMatch[2])) {
        violations.push(`array "${varName}" mixes content-script filenames with a readFileSync/path.join loop`);
      }
    }

    return violations;
  }

  const filenameLeaks = findContentScriptFilenameLeaks(testsSelfSource);
  eq('manifest-driven loading AC1: no content-script filename literal (direct or via a loop-fed array) reaches readFileSync/path.join',
    filenameLeaks.length === 0 ? 'none' : filenameLeaks.join('; '), 'none');

  // "concatenated in manifest order": contentScriptBundle must equal the
  // per-file sources (as looked up in contentScriptSources, keyed by the
  // manifest's own file list) joined in the order the manifest lists them.
  const expectedBundle = contentScriptFiles
    .map((file) => contentScriptSources.get(file))
    .join('\n');
  eq('manifest-driven loading: contentScriptBundle is the manifest-order concatenation of sources',
    contentScriptBundle, expectedBundle);

  // Guard against the failure mode where the manifest's js list becomes empty
  // (or truncated) and contentScriptBundle silently becomes '' or partial —
  // every "source includes X" assertion elsewhere in the suite would then
  // vacuously pass instead of catching a real regression.
  // NOTE: this count changes when a content-script package is added to or
  // removed from manifest.json; update it alongside the manifest edit.
  // Sprint extract-dr-number replaced rounding.js/core.js/parsing.js with the
  // four-file lib/dr-number package (rounding.js, core.js, parsing.js,
  // index.js), raising the count from 7 to 8. Sprint extract-dr-table then
  // replaced dom-adapters.js with the two-file lib/dr-table package
  // (detect.js, index.js), raising the count from 8 to 9. Sprint merge-ladder
  // then added the two-file lib/dr-simplify package (ladder.js, index.js),
  // raising the count from 9 to 11. Sprint app-model-selection then added
  // adapters/messaging.js and app/store.js, raising the count from 11 to 13.
  // The capture feature then added the log buffer (lib/dr-log/index.js) and
  // the three-file lib/dr-capture package (state.js, render.js, index.js),
  // raising the count from 13 to 17. The error-surfacing feature then added
  // the toast view (ui-toast.js), raising the count from 17 to 18. The
  // identifier shapes (lib/dr-number/identifiers.js) then raised it from 18
  // to 19.
  eq('manifest-driven loading: manifest content_scripts[0].js lists exactly 19 files today',
    manifest.content_scripts[0].js.length, 19);
})();

// ---------------------------------------------------------------------------
// Sprint extract-dr-number: the pure number-logic package now lives under
// lib/dr-number/ (rounding.js, core.js, parsing.js, index.js). These two
// tests are the discipline checks the sprint calls for: (a) index.js's only
// job — assigning every public function onto one DR_NUMBER bundle — actually
// happened, and (b) every lib/ content script the manifest lists loads before
// any non-lib content script, so the package boundary shows up in load order,
// not just in the filesystem.
// ---------------------------------------------------------------------------
(function drNumberBundleIsPublished() {
  const EXPECTED_DR_NUMBER_NAMES = [
    // rounding.js
    'roundWithOffset', 'roundCellSetAware', 'stepForOffset', 'formatStep', 'trimNum',
    // core.js
    'findMaxMagnitude', 'toNumber',
    // parsing.js
    'lettersToColIndex', 'parseRangeEndpoint', 'parseRangeToken', 'parseRangeExpr',
    'isInRanges', 'resolveOffset', 'resolveNumTop', 'matchUnitNumber', 'getExclusionReason',
    'resolveMonthName', 'normalizeDateCandidate', 'parseDateLike', 'parseAmbiguousNumericDate',
    'isDateLike', 'isTimeLike', 'parseISODateTime', 'isDateTimeLike',
    'roundDateText', 'roundISODateTime', 'roundTimeText',
    'getQuoteMaskedRanges', 'overlapsQuoteRange', 'extractNumberInText', 'extractNumbersInText',
    'bracketSignSpan', 'isBracketedNegative', 'matchBracketedNumber',
    'eraYearDigitRanges', 'decimalCount', 'formatExtractedNumber', 'restoreFormatting',
    // identifiers.js
    'matchIdentifierShape', 'getIdentifierMaskedRanges', 'isGroupedDigitIdentifier', 'isIsbnShape',
  ].sort();

  eq('lib/dr-number/index.js: DR_NUMBER exists on the global scope after the main eval',
    typeof globalThis.DR_NUMBER, 'object');
  eq('lib/dr-number/index.js: DR_NUMBER exposes exactly the expected public function names',
    Object.keys(globalThis.DR_NUMBER || {}).sort(), EXPECTED_DR_NUMBER_NAMES);
  eq('lib/dr-number/index.js: every DR_NUMBER entry is itself a function',
    EXPECTED_DR_NUMBER_NAMES.every((n) => typeof (globalThis.DR_NUMBER || {})[n] === 'function'),
    true);
})();

// ---------------------------------------------------------------------------
// Sprint delete-dead-code removed ROUND_DYNAMIC, singleValueMode, datasetMode,
// and validateOffset from core.js as unreachable: nothing in the extension
// ever called ROUND_DYNAMIC or the two mode functions it dispatched to, and
// validateOffset only existed to serve them. These typeof checks read the
// bare names the main eval's function declarations leave in this module's
// scope (the same sloppy-mode leak DR_NUMBER's helpers rely on before their
// explicit globalThis bridge) — so a reintroduced declaration in core.js
// flips a result from 'undefined' to 'function' even if nobody re-adds a
// globalThis bridge or a DR_NUMBER entry for it.
// ---------------------------------------------------------------------------
(function deletedRoundingEntryPointsStayDeleted() {
  eq('core.js: ROUND_DYNAMIC stays deleted', typeof ROUND_DYNAMIC, 'undefined');
  eq('core.js: singleValueMode stays deleted', typeof singleValueMode, 'undefined');
  eq('core.js: datasetMode stays deleted', typeof datasetMode, 'undefined');
  eq('core.js: validateOffset stays deleted', typeof validateOffset, 'undefined');

  const deletedNames = ['ROUND_DYNAMIC', 'singleValueMode', 'datasetMode', 'validateOffset'];
  eq('lib/dr-number/index.js: DR_NUMBER does not re-expose any deleted rounding entry point',
    deletedNames.some((n) => Object.prototype.hasOwnProperty.call(globalThis.DR_NUMBER || {}, n)),
    false);
})();

(function libPathsLoadBeforeNonLibContentScripts() {
  // constants.js is the one deliberate exception: it declares every shared
  // constant (the settings defaults and the cross-context topic names) and
  // loads first, ahead of the lib/dr-number package itself. Every OTHER
  // non-lib content script (ui-toggle.js, content.js — the DOM/UI consumers)
  // must load after every lib/ path.
  const js = manifest.content_scripts[0].js;
  const isLib = (f) => f.startsWith('lib/');
  const isConsumer = (f) => !isLib(f) && f !== 'constants.js';
  const lastLibIndex = js.reduce((last, f, i) => (isLib(f) ? i : last), -1);
  const firstConsumerIndex = js.findIndex(isConsumer);
  eq('manifest: at least one lib/ content script is listed',
    lastLibIndex >= 0, true);
  eq('manifest: every lib/ content script loads before any non-lib, non-defaults content script',
    firstConsumerIndex === -1 || lastLibIndex < firstConsumerIndex, true);
})();

// index.js's own doc comment says "No logic lives here — this is a pure
// re-export list." That claim is only as good as index.js's grammar: the file
// must introduce exactly one top-level binding (DR_NUMBER) and nothing else.
// drNumberBundleIsPublished above checks DR_NUMBER's *contents*; this checks
// that index.js could not have smuggled in a second global even if its
// contents were otherwise correct — a stray second `const`/`function` at top
// level would land on the shared content-script scope unnoticed by any
// content-only assertion.
(function indexJsDeclaresExactlyOneGlobal() {
  const indexSrc = sourceByName('lib/dr-number/index.js');
  if (indexSrc === null) {
    eq('lib/dr-number/index.js: source present in manifest', false, true);
    return;
  }
  const topLevelDeclarations = indexSrc.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('lib/dr-number/index.js: exactly one top-level declaration in the file',
    topLevelDeclarations.length, 1);
  eq('lib/dr-number/index.js: the sole top-level declaration is DR_NUMBER',
    /^const DR_NUMBER\b/m.test(indexSrc), true);
})();

// The EXPECTED_DR_NUMBER_NAMES list in drNumberBundleIsPublished above is a
// hand-copied literal, kept explicit on purpose. This test instead derives
// the expected set mechanically — regex-extracting every top-level
// `function name(...)` declaration straight from rounding.js, core.js, and
// parsing.js — so a function added to (or removed from) one of those files
// without a matching index.js edit fails here even if someone forgets to
// update the hand-copied list too.
(function drNumberBundleMatchesSourceDeclarations() {
  const FUNCTION_DECL_RE = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  const declaredNamesIn = (src) => src === null ? [] : [...src.matchAll(FUNCTION_DECL_RE)].map((m) => m[1]);
  const declaredNames = [
    ...declaredNamesIn(sourceByName('lib/dr-number/rounding.js')),
    ...declaredNamesIn(sourceByName('lib/dr-number/core.js')),
    ...declaredNamesIn(sourceByName('lib/dr-number/parsing.js')),
    ...declaredNamesIn(sourceByName('lib/dr-number/identifiers.js')),
  ].sort();
  eq('lib/dr-number bundle: source files declared at least one top-level function',
    declaredNames.length > 0, true);
  eq('lib/dr-number bundle: DR_NUMBER keys are exactly the top-level functions declared in rounding.js + core.js + parsing.js + identifiers.js',
    Object.keys(globalThis.DR_NUMBER || {}).sort(), declaredNames);
})();

// ---------------------------------------------------------------------------
// Sprint extract-dr-table: table detection now lives under lib/dr-table/
// (detect.js, index.js), mirroring the lib/dr-number package structure and
// discipline checks above. Four groups of tests:
//   1. DR_TABLE bundle discipline (mirrors drNumberBundleIsPublished /
//      indexJsDeclaresExactlyOneGlobal, but against an explicit hand-written
//      list, not a source-derived one — detect.js also carries write-engine
//      helpers alongside detection, so "every top-level function" is not the
//      right criterion here the way it is for the pure lib/dr-number files).
//   2. The jsdom-less criterion: detection runs with no Chrome globals at all.
//   3. VendorProfiles: a custom list replaces (not merges with) the default.
//   4. findTables' tableFilter: default drops a phantom a11y table; a
//      pass-through filter keeps it.
// ---------------------------------------------------------------------------
(function drTableBundleIsPublished() {
  const EXPECTED_DR_TABLE_NAMES = [
    'NativeTableAdapter',
    'GridAdapter',
    'makeAdapter',
    'getSuperscriptRanges',
    'isCellWholeLink',
    'filterLinkMatches',
    'collectTextPieces',
    'mapRenderedToFlat',
    'applyExtractedPatches',
    'restoreTextPieces',
    'placeDecision',
    'layoutPieceHolding',
    'flatPatches',
    'sortCellByRecord',
    'looksLikeGrid',
    'findTargetTable',
    'findTables',
    'chainRootOf',
    'isPhantomA11yTable',
    'isDataTable',
    'readTableFingerprint',
    'sameTableFingerprint',
  ].sort();

  eq('lib/dr-table/index.js: DR_TABLE exists on the global scope after the main eval',
    typeof globalThis.DR_TABLE, 'object');
  eq('lib/dr-table/index.js: DR_TABLE exposes exactly the expected public names',
    Object.keys(globalThis.DR_TABLE || {}).sort(), EXPECTED_DR_TABLE_NAMES);
  eq('lib/dr-table/index.js: every DR_TABLE entry is itself a function (classes included — typeof a class is "function")',
    EXPECTED_DR_TABLE_NAMES.every((n) => typeof (globalThis.DR_TABLE || {})[n] === 'function'),
    true);
})();

(function drTableIndexJsDeclaresExactlyOneGlobal() {
  const indexSrc = sourceByName('lib/dr-table/index.js');
  if (indexSrc === null) {
    eq('lib/dr-table/index.js: source present in manifest', false, true);
    return;
  }
  const topLevelDeclarations = indexSrc.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('lib/dr-table/index.js: exactly one top-level declaration in the file',
    topLevelDeclarations.length, 1);
  eq('lib/dr-table/index.js: the sole top-level declaration is DR_TABLE',
    /^const DR_TABLE\b/m.test(indexSrc), true);
})();

// jsdom-less criterion: detect.js is evaluated with its two dependencies —
// constants.js, for DR_DETECTION_SETTINGS, and lib/dr-number/core.js, for the
// currency signs the numeric probe strips — and nothing else, in a vm context with no
// `chrome`, no `window`, and no `getComputedStyle` at all, against a minimal
// fake document holding one plain <table>. Detection must still find the
// table and must not throw — this is the acceptance bar for "runs under
// jsdom-style stubs with no Chrome globals."
(function detectionRunsWithNoChromeGlobals() {
  if (detectCode === null || constantsCode === null) {
    eq('jsdom-less: source files constants.js and lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const vm = require('vm');

  const fakeTable = {
    tagName: 'TABLE',
    rows: [
      { cells: [{ textContent: 'Name' }, { textContent: '100' }] },
      { cells: [{ textContent: 'Foo' },  { textContent: '200' }] },
    ],
  };
  const fakeDoc = {
    querySelectorAll(sel) {
      if (sel === 'table') return [fakeTable];
      return [];
    },
  };

  // The sandbox carries ONLY fakeDoc/fakeTable and whatever constantsCode,
  // coreCode and detectCode themselves declare — no window, no
  // getComputedStyle, no chrome, no document global. constantsCode is plain
  // values only and coreCode is framework-free and side-effect-free, so
  // prepending them costs the sandbox no browser dependency.
  const sandbox = { fakeDoc, fakeTable, results: null, threw: null };
  const ctx = vm.createContext(sandbox);

  vm.runInContext(
    constantsCode + '\n' + coreCode + '\n' + detectCode + `
    try {
      var found = findTables(fakeDoc);
      results = {
        isDataTable: isDataTable(fakeTable),
        tablesFound: found.length,
        firstIsFakeTable: found[0] && found[0].handle === fakeTable,
        firstIsNew: found[0] && found[0].isNew,
      };
    } catch (e) {
      threw = e.message;
    }
    `,
    ctx
  );

  eq('jsdom-less: detection does not throw with no chrome/window/getComputedStyle',
    sandbox.threw, null);
  eq('jsdom-less: isDataTable finds a plain 2x2 numeric table with no getComputedStyle',
    sandbox.results && sandbox.results.isDataTable, true);
  eq('jsdom-less: findTables finds the one plain table under a minimal fake document',
    sandbox.results && sandbox.results.tablesFound, 1);
  eq('jsdom-less: findTables resolves to the same table object',
    sandbox.results && sandbox.results.firstIsFakeTable, true);
  eq('jsdom-less: findTables reports the plain table as isNew (no registry supplied)',
    sandbox.results && sandbox.results.firstIsNew, true);
})();

